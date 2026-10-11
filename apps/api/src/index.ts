import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z, ZodError } from 'zod';
import { catalog, pageFor, submissionSchema, idSchema, type SubmissionState } from '../../../packages/wiki-schema/src/index';
import { candidateContent, renderMarkdown } from '../../../packages/content-validator/src/index';
import { getSession, sessionCsrf, verifyCsrf, hash, now, newId, cookie, beginOidc, finishOidc, consumeState, verifyHmac } from '../../../packages/auth/src/index';
import { GitHub, GitError, type Coauthor } from '../../../packages/git-wrapper/src/index';
import { Coordinator, validManifest } from '../../../packages/publish-coordinator/src/index';
import { startGithub, finishGithub, requireRecent, consentVersion } from './github-binding';
import {AccountError,passwordLogin,passwordReauthenticate,registerPassword,changePassword,mailConfigured,requestAccountEmail,consumeAccountToken} from '../../../packages/auth/src/password';
import {profileSchema} from '../../../packages/wiki-schema/src/account';
import type { ApiEnv, Bindings, AuthSession } from './types';

export class ApiError extends Error {constructor(public code:string,public status=400){super(code);}}
export const app=new Hono<Bindings>();
// Drafts contain both the baseline and edited body (64 KiB each). Allow the
// six-byte JSON escaping worst case plus metadata, while bounding streamed input.
const draftBodyLimit=1024*1024;
async function rawBody(request:Request,limit=100000):Promise<string> {
  if(Number(request.headers.get('content-length')??0)>limit)throw new ApiError('CONTENT_TOO_LARGE',413);
  if(!request.body)return '';
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new ApiError('CONTENT_TOO_LARGE',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const v of chunks){bytes.set(v,at);at+=v.length;}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
async function jsonBody(request:Request,limit=100000) {if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ApiError('JSON_REQUIRED',415);try{return JSON.parse(await rawBody(request,limit));}catch(e){if(e instanceof ApiError)throw e;throw new ApiError('INVALID_JSON');}}
async function rate(env:ApiEnv,key:string,max:number,seconds:number) {
  const bucket=Math.floor(now()/seconds),keyHash=await hash(`${key}:${bucket}`);
  const value=await env.DB.prepare('INSERT INTO rate_limits(key_hash,count,expires_at) VALUES(?,1,?) ON CONFLICT(key_hash) DO UPDATE SET count=count+1 RETURNING count').bind(keyHash,(bucket+1)*seconds).first<{count:number}>();
  if(!value||value.count>max)throw new ApiError('RATE_LIMITED',429);
}
function reviewer(s:AuthSession) {if(!['reviewer','admin'].includes(s.role))throw new ApiError('FORBIDDEN',403);}
function contributor(s:AuthSession) {if(s.role==='viewer')throw new ApiError('FORBIDDEN',403);}
function coordinator(env:ApiEnv) {return new Coordinator(env,new GitHub(env));}
async function detail(env:ApiEnv,id:string,session:AuthSession) {
  const row=await env.DB.prepare('SELECT s.*,c.content,c.base_content,c.base_commit_sha,c.base_blob_sha,c.sources_json,g.pr_number,g.content_commit_sha,g.merge_sha,j.stage,j.last_error,j.retries FROM submissions s JOIN submission_content c USING(revision_id) LEFT JOIN git_links g USING(revision_id) LEFT JOIN publish_jobs j USING(revision_id) WHERE s.revision_id=?').bind(id).first<Record<string,unknown>>();
  if(!row||(row.uid!==session.uid&&!['reviewer','admin'].includes(session.role)))throw new ApiError('NOT_FOUND',404);
  const reviews=await env.DB.prepare('SELECT review_id,reviewer_uid,verdict,comment,created_at FROM reviews WHERE revision_id=? ORDER BY created_at').bind(id).all();
  const events=await env.DB.prepare('SELECT action,release_id,created_at FROM publication_events WHERE revision_id=? ORDER BY created_at').bind(id).all();
  return {uid:row.uid,...row,reviews:reviews.results,publication_events:events.results};
}
app.use('*',async(c,next)=>{
  c.set('correlationId',crypto.randomUUID());
  c.header('X-Correlation-ID',c.get('correlationId'));c.header('X-Content-Type-Options','nosniff');c.header('Cache-Control','no-store');
  await next();
});
app.use('*',cors({origin:(origin,c)=>origin===c.env.WEB_ORIGIN?origin:'',credentials:true,allowMethods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'],allowHeaders:['Content-Type','X-CSRF-Token','X-Roco-Request','Idempotency-Key']}));
app.use('*',async(c,next)=>{
  if(c.req.method==='OPTIONS'){await next();return;}
  const path=c.req.path;
  if(path.startsWith('/webhooks/')){await next();return;}
  await rate(c.env,`ip:${c.req.header('CF-Connecting-IP')??'local'}:${path.startsWith('/auth')?'auth':'api'}`,path.startsWith('/auth')?20:120,60);
  const isMutation=['POST','PUT','PATCH','DELETE'].includes(c.req.method);
  if(isMutation&&(c.req.header('Origin')!==c.env.WEB_ORIGIN||c.req.header('X-Roco-Request')!=='1'))throw new ApiError('ORIGIN_REJECTED',403);
  const s=await getSession(c.req.raw,c.env);
  if(s)c.set('session',s);
  const publicAuth=['/auth/login','/auth/register','/auth/email/resend','/auth/email/verify','/auth/password/request-reset','/auth/password/reset'];
  const publicRoute=path==='/health'||path==='/pages'||path.startsWith('/users/')||path==='/mirror'||publicAuth.includes(path)||path==='/auth/callback'||path==='/auth/github/callback';
  if(!publicRoute&&!s)throw new ApiError('UNAUTHORIZED',401);
  if(isMutation&&s&&!publicAuth.includes(path)) {
    if(!await verifyCsrf(c.req.raw,c.env,s))throw new ApiError('CSRF_REJECTED',403);
  }
  await next();
});
app.get('/health',c=>c.json({status:'ok',schema:1,registration:c.env.AUTH_MODE,
  authentication_configured:c.env.AUTH_MODE==='password'||Boolean(c.env.OIDC_ISSUER&&c.env.OIDC_CLIENT_ID&&c.env.OIDC_CLIENT_SECRET),
  registration_enabled:c.env.REGISTRATION_ENABLED==='true'&&(c.env.EMAIL_VERIFICATION_REQUIRED!=='true'||mailConfigured(c.env)),
  email_verification_required:c.env.EMAIL_VERIFICATION_REQUIRED==='true',password_reset_available:mailConfigured(c.env),
  submissions:c.env.SUBMISSIONS_ENABLED==='true',publishing:c.env.PUBLISH_ENABLED==='true',
  source_commit_sha:c.env.API_SOURCE_COMMIT_SHA||null,
}));
app.get('/pages',c=>c.json({pages:catalog}));
app.get('/mirror',async c=>c.json(await c.env.DB.prepare('SELECT source_sha,mirror_sha,status,checked_at FROM mirror_observations ORDER BY checked_at DESC LIMIT 1').first()??{status:'unknown'}));
app.post('/auth/register',async c=>{
  if(c.env.AUTH_MODE==='password')return c.json(await registerPassword(c.env,await jsonBody(c.req.raw,8192)),201);
  const start=await beginOidc(c.env,c.get('session')??null);c.header('Set-Cookie',cookie(c.env,'oidc',start.browser,600));return c.json({redirect_url:start.url});
});
app.post('/auth/login',async c=>{
  if(c.env.AUTH_MODE==='password'){const session=await passwordLogin(c.env,await jsonBody(c.req.raw,8192));c.header('Set-Cookie',cookie(c.env,'session',session.token,604800));return c.json({ok:true});}
  const start=await beginOidc(c.env,c.get('session')??null);c.header('Set-Cookie',cookie(c.env,'oidc',start.browser,600));return c.json({redirect_url:start.url});
});
app.post('/auth/reauthenticate',async c=>{const session=await passwordReauthenticate(c.env,c.get('session'),await jsonBody(c.req.raw,8192));c.header('Set-Cookie',cookie(c.env,'session',session.token,604800));return c.json({ok:true});});
app.post('/auth/password/change',async c=>{const session=await changePassword(c.env,c.get('session'),await jsonBody(c.req.raw,8192));c.header('Set-Cookie',cookie(c.env,'session',session.token,604800));return c.json({ok:true});});
app.post('/auth/email/resend',async c=>c.json(await requestAccountEmail(c.env,await jsonBody(c.req.raw,4096),'verify_email')));
app.post('/auth/password/request-reset',async c=>c.json(await requestAccountEmail(c.env,await jsonBody(c.req.raw,4096),'reset_password')));
app.post('/auth/email/verify',async c=>{const input=z.object({token:z.string(),password:z.string().min(1).max(128)}).strict().parse(await jsonBody(c.req.raw,8192));return c.json(await consumeAccountToken(c.env,input.token,'verify_email',input.password));});
app.post('/auth/password/reset',async c=>{const input=z.object({token:z.string(),password:z.string()}).strict().parse(await jsonBody(c.req.raw,8192));return c.json(await consumeAccountToken(c.env,input.token,'reset_password',input.password));});
app.get('/auth/callback',async c=>{
  if(c.env.AUTH_MODE==='password')throw new ApiError('OIDC_DISABLED',410);
  const state=await consumeState(c.env,c.req.raw,'oidc'),session=await finishOidc(c.env,c.req.raw,state);
  c.header('Set-Cookie',cookie(c.env,'session',session.token,604800));c.header('Set-Cookie',cookie(c.env,'oidc','',0),{append:true});
  return c.redirect(`${c.env.WEB_ORIGIN}/workbench`);
});
app.post('/auth/logout',async c=>{await c.env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE id_hash=?').bind(now(),c.get('session').id_hash).run();c.header('Set-Cookie',cookie(c.env,'session','',0));return c.json({ok:true});});
app.get('/me',async c=>{
  const s=c.get('session'),github=await c.env.DB.prepare('SELECT login,github_numeric_id,coauthor_email,enabled,consent_version FROM github_identities WHERE uid=?').bind(s.uid).first();
  const credential=await c.env.DB.prepare('SELECT email,email_verified_at FROM password_credentials WHERE uid=?').bind(s.uid).first<{email:string;email_verified_at:number|null}>();
  return c.json({user:{uid:s.uid,username:s.username,display_name:s.display_name,role:s.role},account:credential?{email:credential.email,email_verified:credential.email_verified_at!==null}:null,csrf_token:await sessionCsrf(c.req.raw,c.env),github,consent_version:consentVersion});
});
app.patch('/me',async c=>{const input=profileSchema.parse(await jsonBody(c.req.raw,4096));await c.env.DB.prepare('UPDATE users SET display_name=? WHERE uid=?').bind(input.display_name,c.get('session').uid).run();return c.json({ok:true});});
app.post('/auth/github/start',async c=>{const start=await startGithub(c.env,c.get('session'));c.header('Set-Cookie',cookie(c.env,'github',start.browser,600));return c.json({redirect_url:start.url});});
app.get('/auth/github/callback',async c=>{await finishGithub(c.env,c.req.raw);c.header('Set-Cookie',cookie(c.env,'github','',0));return c.redirect(`${c.env.WEB_ORIGIN}/workbench?github=bound`);});
app.post('/me/github/consent',async c=>{
  const s=c.get('session');requireRecent(s);
  const input=z.object({enabled:z.boolean(),consent_version:z.literal(consentVersion)}).strict().parse(await jsonBody(c.req.raw));
  const r=await c.env.DB.batch([
    c.env.DB.prepare('UPDATE github_identities SET enabled=?,consent_version=?,consent_at=?,binding_version=? WHERE uid=? AND (coauthor_email IS NOT NULL OR ?=0)').bind(input.enabled?1:0,input.enabled?consentVersion:null,input.enabled?now():null,crypto.randomUUID(),s.uid,input.enabled?1:0),
    c.env.DB.prepare("INSERT INTO audit_events(event_id,actor_uid,action,target_id,ts,metadata) SELECT ?,?,'github_consent',?,?,? WHERE changes()>0").bind(newId('evt'),s.uid,s.uid,now(),JSON.stringify({enabled:input.enabled}))
  ]);if(!r[0].meta.changes)throw new ApiError('NO_VERIFIED_COMMIT_EMAIL');return c.json({ok:true});
});
app.delete('/me/github',async c=>{
  const s=c.get('session');requireRecent(s);
  await c.env.DB.batch([c.env.DB.prepare('DELETE FROM github_identities WHERE uid=?').bind(s.uid),c.env.DB.prepare("INSERT INTO audit_events(event_id,actor_uid,action,target_id,ts) VALUES(?,?,'github_unbound',?,?)").bind(newId('evt'),s.uid,s.uid,now())]);return c.json({ok:true});
});
app.get('/pages/:pageId/edit-base',async c=>{
  const page=pageFor(c.req.param('pageId'));const base=await new GitHub(c.env).readPage(page.id);
  return c.json({page,...base,base_data_revision:page.kind==='article'?null:JSON.parse(base.content).revision});
});
app.post('/preview',async c=>{
  const data=z.object({content_markdown:z.string().max(65536)}).strict().parse(await jsonBody(c.req.raw));return c.json({html:await renderMarkdown(data.content_markdown)});
});
app.get('/drafts',async c=>{const result=await c.env.DB.prepare('SELECT draft_id,page_id,body_json,updated_at FROM drafts WHERE uid=? ORDER BY updated_at DESC LIMIT 20').bind(c.get('session').uid).all();return c.json({drafts:result.results});});
app.put('/drafts/:draftId',async c=>{
  const s=c.get('session');contributor(s);await rate(c.env,`draft:${s.uid}`,60,3600);
  const id=z.string().regex(/^draft_[0-9a-f-]{36}$/).parse(c.req.param('draftId'));
  const data=z.object({page_id:idSchema,body:z.record(z.unknown())}).strict().parse(await jsonBody(c.req.raw,draftBodyLimit));pageFor(data.page_id);
  const existing=await c.env.DB.prepare('SELECT uid FROM drafts WHERE draft_id=?').bind(id).first<{uid:string}>();if(existing&&existing.uid!==s.uid)throw new ApiError('NOT_FOUND',404);
  if(!existing){const count=await c.env.DB.prepare('SELECT count(*) AS n FROM drafts WHERE uid=?').bind(s.uid).first<{n:number}>();if(count&&count.n>=20)throw new ApiError('DRAFT_QUOTA',429);}
  const result=await c.env.DB.prepare('INSERT INTO drafts(draft_id,uid,page_id,body_json,updated_at) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM drafts WHERE uid=?)<20 OR EXISTS(SELECT 1 FROM drafts WHERE draft_id=? AND uid=?) ON CONFLICT(draft_id) DO UPDATE SET page_id=excluded.page_id,body_json=excluded.body_json,updated_at=excluded.updated_at WHERE drafts.uid=excluded.uid').bind(id,s.uid,data.page_id,JSON.stringify(data.body),now(),s.uid,id,s.uid).run();
  if(!result.meta.changes)throw new ApiError('NOT_FOUND',404);return c.json({draft_id:id});
});
app.delete('/drafts/:draftId',async c=>{await c.env.DB.prepare('DELETE FROM drafts WHERE draft_id=? AND uid=?').bind(c.req.param('draftId'),c.get('session').uid).run();return c.json({ok:true});});
app.post('/submissions',async c=>{
  if(c.env.SUBMISSIONS_ENABLED!=='true')throw new ApiError('SUBMISSIONS_PAUSED',503);
  const s=c.get('session');contributor(s);
  const key=z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/).parse(c.req.header('Idempotency-Key'));
  const input=submissionSchema.parse(await jsonBody(c.req.raw)),requestHash=await hash(JSON.stringify(input));
  const prior=await c.env.DB.prepare('SELECT revision_id,request_hash,status FROM submissions WHERE uid=? AND idempotency_key=?').bind(s.uid,key).first<{revision_id:string;request_hash:string;status:string}>();
  if(prior){if(prior.request_hash!==requestHash)throw new ApiError('IDEMPOTENCY_MISMATCH',409);return c.json(prior);}
  await rate(c.env,`submission:${s.uid}`,8,3600);
  const page=pageFor(input.page_id),git=new GitHub(c.env),base=await git.readPage(page.id,input.base_commit_sha);
  if(base.blob_sha!==input.base_blob_sha)throw new ApiError('STALE_BASE',409);
  if(!await git.contains(input.base_commit_sha,(await git.readPage(page.id)).commit_sha))throw new ApiError('INVALID_BASE',409);
  const content=candidateContent(page,input,base.content);if(content===base.content)throw new ApiError('EMPTY_CHANGE');
  let coauthor:Coauthor|null=null;
  if(input.coauthor_opt_in){const binding=await c.env.DB.prepare('SELECT github_numeric_id,login,coauthor_email,enabled,consent_version,binding_version FROM github_identities WHERE uid=? AND enabled=1').bind(s.uid).first<{github_numeric_id:number;login:string;coauthor_email:string;consent_version:string;binding_version:string}>();if(!binding)throw new ApiError('COAUTHOR_CONSENT_REQUIRED');coauthor={github_id:binding.github_numeric_id,name:binding.login,email:binding.coauthor_email,consent_version:binding.consent_version,binding_version:binding.binding_version};}
  if(input.supersedes){const old=await c.env.DB.prepare('SELECT uid,page_id,status FROM submissions WHERE revision_id=?').bind(input.supersedes).first<{uid:string;page_id:string;status:SubmissionState}>();if(!old||old.uid!==s.uid||old.page_id!==page.id||!['pending_review','changes_requested','conflict','rejected','cancelled'].includes(old.status))throw new ApiError('INVALID_SUPERSEDED_REVISION',409);}
  const revision=newId('rev'),ts=now();
  const statements=[
    c.env.DB.prepare("INSERT INTO submissions(revision_id,uid,page_id,snapshot_hash,status,edit_summary,required_reviews,idempotency_key,request_hash,supersedes,created_at,updated_at) SELECT ?,?,?,?,'pending_review',?,?,?,?,?,?,? WHERE ? IS NULL OR EXISTS(SELECT 1 FROM submissions WHERE revision_id=? AND uid=? AND status IN ('pending_review','changes_requested','conflict','rejected','cancelled'))").bind(revision,s.uid,page.id,await hash(content),input.edit_summary,page.critical?2:1,key,requestHash,input.supersedes??null,ts,ts,input.supersedes??null,input.supersedes??null,s.uid),
    c.env.DB.prepare('INSERT INTO submission_content(revision_id,content,base_content,base_commit_sha,base_blob_sha,sources_json,coauthor_json) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM submissions WHERE revision_id=?)').bind(revision,content,base.content,input.base_commit_sha,input.base_blob_sha,JSON.stringify(input.source_references),coauthor?JSON.stringify(coauthor):null,revision),
    c.env.DB.prepare("INSERT INTO audit_events(event_id,actor_uid,action,target_id,ts) SELECT ?,?,'submitted',?,? WHERE EXISTS(SELECT 1 FROM submissions WHERE revision_id=?)").bind(newId('evt'),s.uid,revision,ts,revision)
  ];
  if(input.supersedes)statements.push(c.env.DB.prepare("UPDATE submissions SET status='cancelled',version=version+1,updated_at=? WHERE revision_id=? AND uid=? AND status='pending_review' AND EXISTS(SELECT 1 FROM submissions WHERE revision_id=?)").bind(ts,input.supersedes,s.uid,revision));
  try{const result=await c.env.DB.batch(statements);if(!result[0].meta.changes)throw new ApiError('CONFLICT',409);}catch(error){const duplicate=await c.env.DB.prepare('SELECT revision_id,request_hash,status FROM submissions WHERE uid=? AND idempotency_key=?').bind(s.uid,key).first<{revision_id:string;request_hash:string;status:string}>();if(duplicate?.request_hash===requestHash)return c.json(duplicate);throw error;}
  return c.json({revision_id:revision,status:'pending_review'},201);
});
app.get('/submissions',async c=>{const result=await c.env.DB.prepare('SELECT revision_id,page_id,status,edit_summary,created_at FROM submissions WHERE uid=? ORDER BY created_at DESC LIMIT 100').bind(c.get('session').uid).all();return c.json({submissions:result.results});});
app.get('/submissions/:id',async c=>c.json(await detail(c.env,c.req.param('id'),c.get('session'))));
app.get('/reviews',async c=>{reviewer(c.get('session'));const rows=await c.env.DB.prepare("SELECT revision_id,page_id,status,uid,edit_summary,required_reviews,created_at,version FROM submissions WHERE status='pending_review' ORDER BY created_at LIMIT 100").all();return c.json({submissions:rows.results});});
app.post('/reviews/:id/decision',async c=>{
  const s=c.get('session');reviewer(s);const revision=c.req.param('id');
  const input=z.object({verdict:z.enum(['approve','changes_requested','reject']),comment:z.string().trim().min(1).max(4000),version:z.number().int().nonnegative()}).strict().parse(await jsonBody(c.req.raw));
  const snapshot=await detail(c.env,revision,s);if(snapshot.uid===s.uid)throw new ApiError('SELF_REVIEW_FORBIDDEN',403);
  if((snapshot.reviews as {reviewer_uid:string}[]).some(r=>r.reviewer_uid===s.uid))throw new ApiError('ALREADY_REVIEWED',409);
  const review=newId('review'),ts=now();
  const result=await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO reviews(review_id,revision_id,reviewer_uid,verdict,comment,created_at) SELECT ?,?,?,?,?,? FROM submissions WHERE revision_id=? AND status='pending_review' AND version=?").bind(review,revision,s.uid,input.verdict,input.comment,ts,revision,input.version),
    c.env.DB.prepare("UPDATE submissions SET status=CASE WHEN ?='reject' THEN 'rejected' WHEN ?='changes_requested' THEN 'changes_requested' WHEN (SELECT count(*) FROM reviews WHERE revision_id=? AND verdict='approve')>=required_reviews THEN 'approved' ELSE 'pending_review' END,version=version+1,updated_at=? WHERE revision_id=? AND status='pending_review' AND version=? AND EXISTS(SELECT 1 FROM reviews WHERE review_id=?)").bind(input.verdict,input.verdict,revision,ts,revision,input.version,review),
    c.env.DB.prepare("INSERT INTO audit_events(event_id,actor_uid,action,target_id,ts,metadata) SELECT ?,?,'reviewed',?,?,? WHERE EXISTS(SELECT 1 FROM reviews WHERE review_id=?)").bind(newId('evt'),s.uid,revision,ts,JSON.stringify({verdict:input.verdict}),review)
  ]);
  if(!result[0].meta.changes)throw new ApiError('CONFLICT',409);
  c.executionCtx.waitUntil(coordinator(c.env).run(1));return c.json(await detail(c.env,revision,s));
});
app.post('/submissions/:id/cancel',async c=>{
  const s=c.get('session'),revision=c.req.param('id');
  const result=await c.env.DB.batch([
    c.env.DB.prepare("UPDATE submissions SET status='cancelled',version=version+1,updated_at=? WHERE revision_id=? AND (uid=? OR ?='admin') AND status IN ('pending_review','changes_requested','approved','conflict') AND NOT EXISTS(SELECT 1 FROM git_links WHERE revision_id=?) AND NOT EXISTS(SELECT 1 FROM publish_jobs WHERE revision_id=? AND lease_until>?)").bind(now(),revision,s.uid,s.role,revision,revision,now()),
    c.env.DB.prepare("UPDATE publish_jobs SET stage='blocked',last_error='CANCELLED' WHERE revision_id=? AND EXISTS(SELECT 1 FROM submissions WHERE revision_id=? AND status='cancelled')").bind(revision,revision),
    c.env.DB.prepare("INSERT INTO audit_events(event_id,actor_uid,action,target_id,ts) SELECT ?,?,'cancelled',?,? WHERE EXISTS(SELECT 1 FROM submissions WHERE revision_id=? AND status='cancelled')").bind(newId('evt'),s.uid,revision,now(),revision)
  ]);if(!result[0].meta.changes)throw new ApiError('CANNOT_CANCEL',409);return c.json({ok:true});
});
app.get('/admin/jobs',async c=>{if(c.get('session').role!=='admin')throw new ApiError('FORBIDDEN',403);const rows=await c.env.DB.prepare('SELECT j.*,s.page_id,s.status FROM publish_jobs j JOIN submissions s USING(revision_id) ORDER BY j.updated_at DESC LIMIT 100').all();return c.json({jobs:rows.results});});
app.post('/admin/jobs/:id/retry',async c=>{
  const s=c.get('session');if(s.role!=='admin')throw new ApiError('FORBIDDEN',403);
  const id=c.req.param('id');const rows=await c.env.DB.batch([
    c.env.DB.prepare("UPDATE publish_jobs SET stage=coalesce(resume_stage,stage),resume_stage=NULL,retries=0,next_attempt_at=?,last_error=NULL WHERE job_id=? AND stage IN ('git','pr','deploy','blocked') AND (lease_until IS NULL OR lease_until<=?) AND EXISTS(SELECT 1 FROM submissions s WHERE s.revision_id=publish_jobs.revision_id AND s.status='retryable_error')").bind(now(),id,now()),
    c.env.DB.prepare("INSERT INTO audit_events(event_id,actor_uid,action,target_id,ts) SELECT ?,?,'job_retry',?,? WHERE changes()>0").bind(newId('evt'),s.uid,id,now())
  ]);if(!rows[0].meta.changes)throw new ApiError('CANNOT_RETRY',409);c.executionCtx.waitUntil(coordinator(c.env).run(1));return c.json({ok:true});
});
app.get('/users/:uid',async c=>{
  const uid=c.req.param('uid');const user=await c.env.DB.prepare('SELECT uid,username,display_name,created_at FROM users WHERE uid=? AND disabled_at IS NULL').bind(uid).first();if(!user)throw new ApiError('NOT_FOUND',404);
  const github=await c.env.DB.prepare('SELECT login FROM github_identities WHERE uid=?').bind(uid).first();
  const contributions=await c.env.DB.prepare("SELECT s.revision_id,s.page_id,s.edit_summary,g.content_commit_sha,g.merge_sha FROM submissions s JOIN git_links g USING(revision_id) WHERE s.uid=? AND s.status='published' ORDER BY s.created_at DESC LIMIT 100").bind(uid).all();return c.json({user,github,contributions:contributions.results});
});
app.post('/webhooks/github',async c=>{
  const body=await rawBody(c.req.raw,200000);if(!await verifyHmac(c.env.GITHUB_WEBHOOK_SECRET,body,c.req.header('X-Hub-Signature-256')??null))throw new ApiError('INVALID_SIGNATURE',401);
  const delivery=z.string().regex(/^[a-zA-Z0-9-]{1,100}$/).parse(c.req.header('X-GitHub-Delivery'));const payload=JSON.parse(body) as {repository?:{name?:string;owner?:{login?:string}}};
  if(payload.repository&&(payload.repository.name!==c.env.GITHUB_REPO||payload.repository.owner?.login!==c.env.GITHUB_OWNER))throw new ApiError('WRONG_REPOSITORY',403);
  const r=await c.env.DB.prepare('INSERT OR IGNORE INTO webhook_events(delivery_id,event_type,received_at) VALUES(?,?,?)').bind(`github:${delivery}`,c.req.header('X-GitHub-Event')??'unknown',now()).run();
  if(r.meta.changes)c.executionCtx.waitUntil(coordinator(c.env).run());return c.json({accepted:true},202);
});
app.post('/webhooks/deploy',async c=>{
  const body=await rawBody(c.req.raw,8192),time=c.req.header('X-Webhook-Timestamp');
  if(!time||!/^\d{10}$/.test(time)||Math.abs(now()-Number(time))>300||!await verifyHmac(c.env.DEPLOY_WEBHOOK_SECRET,`${time}.${body}`,c.req.header('X-Signature')??null))throw new ApiError('INVALID_SIGNATURE',401);
  const v:unknown=JSON.parse(body);if(!validManifest(v))throw new ApiError('INVALID_VERSION');
  const prior=await c.env.DB.prepare('SELECT source_sha,artifact_digest FROM deployments WHERE release_id=?').bind(v.release_id).first<{source_sha:string;artifact_digest:string}>();if(prior&&(prior.source_sha!==v.source_commit_sha||prior.artifact_digest!==v.artifact_digest))throw new ApiError('RELEASE_MISMATCH',409);
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT OR IGNORE INTO deployments(release_id,source_sha,artifact_digest,environment,status,deployed_at) VALUES(?,?,?,'production','reported',?)").bind(v.release_id,v.source_commit_sha,v.artifact_digest,now()),
    c.env.DB.prepare('INSERT OR IGNORE INTO webhook_events(delivery_id,event_type,received_at) VALUES(?,?,?)').bind(`deploy:${v.release_id}`,'deploy',now())
  ]);c.executionCtx.waitUntil(coordinator(c.env).run());return c.json({accepted:true},202);
});
app.post('/webhooks/mirror',async c=>{
  const body=await rawBody(c.req.raw,8192),time=c.req.header('X-Webhook-Timestamp');
  if(!time||!/^\d{10}$/.test(time)||Math.abs(now()-Number(time))>300||!await verifyHmac(c.env.DEPLOY_WEBHOOK_SECRET,`${time}.${body}`,c.req.header('X-Signature')??null))throw new ApiError('INVALID_SIGNATURE',401);
  const v=z.object({source_sha:z.string().regex(/^[a-f0-9]{40}$/),mirror_sha:z.string().regex(/^[a-f0-9]{40}$/).nullable(),status:z.enum(['synced','lagging','failed']),checked_at:z.number().int()}).strict().parse(JSON.parse(body));
  if(v.status==='synced'&&v.source_sha!==v.mirror_sha)throw new ApiError('MIRROR_MISMATCH');
  await c.env.DB.prepare('INSERT OR IGNORE INTO mirror_observations(observation_id,source_sha,mirror_sha,status,checked_at) VALUES(?,?,?,?,?)').bind(await hash(body),v.source_sha,v.mirror_sha,v.status,v.checked_at).run();return c.json({accepted:true},202);
});
app.notFound(c=>c.json({error:{code:'NOT_FOUND',correlation_id:c.get('correlationId')}},404));
app.onError((error,c)=>{
  const invalid=error instanceof Error&&/^(UNSAFE_|MDX_|FRONT_MATTER_|TOO_MANY_|DUPLICATE_REFERENCE_DEFINITION|ENTITY_ID_|UNKNOWN_SKILL|KIND_MISMATCH|INVALID_CONTENT)/.test(error.message);
  const code=error instanceof ApiError||error instanceof AccountError?error.code:error instanceof GitError?error.code:error instanceof ZodError||invalid?'INVALID_CONTENT':error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'INTERNAL_ERROR';
  const status=error instanceof ApiError||error instanceof AccountError?error.status:error instanceof GitError?error.status===409?409:503:error instanceof ZodError||invalid?400:code==='CREDENTIALS_CHANGED'?409:code.endsWith('NOT_CONFIGURED')?503:code==='REAUTH_REQUIRED'||code==='INVALID_OIDC_TOKEN'?401:code.includes('OAUTH')||code.includes('IDENTITY')?401:500;
  if(status>=500)console.error(JSON.stringify({event:'api_error',code,correlation_id:c.get('correlationId')}));
  return c.json({error:{code,correlation_id:c.get('correlationId')}},status as 400);
});
export default {
  fetch:app.fetch,
  async scheduled(_controller:ScheduledController,env:ApiEnv,ctx:ExecutionContext) {
    ctx.waitUntil((async()=>{
      await env.DB.batch([env.DB.prepare('DELETE FROM oauth_states WHERE expires_at<?').bind(now()),env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now()-3600),env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now()-86400)]);
      await env.DB.prepare('DELETE FROM account_tokens WHERE expires_at<?').bind(now()).run();
      await env.DB.prepare('DELETE FROM pending_registrations WHERE expires_at<?').bind(now()).run();
      const worker=coordinator(env);await worker.run();
      try{await worker.reconcilePublished();}catch{console.warn(JSON.stringify({event:'reconcile_waiting',code:'UPSTREAM_RETRYING'}));}
    })());
  }
} satisfies ExportedHandler<ApiEnv>;
