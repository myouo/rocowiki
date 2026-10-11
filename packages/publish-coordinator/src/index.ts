import { newId, now, hash } from '../../auth/src/index';
import { pageFor } from '../../wiki-schema/src/index';
import { validateStoredContent } from '../../content-validator/src/index';
import { GitError, type Coauthor, type GitPort } from '../../git-wrapper/src/index';
import type { ApiEnv } from '../../../apps/api/src/types';

interface Job {job_id:string;revision_id:string;stage:string;retries:number;lease_token:string;}
interface Revision {uid:string;page_id:string;status:string;snapshot_hash:string;content:string;base_content:string;base_blob_sha:string;coauthor_json:string|null;sources_json:string;}
interface Link {branch:string;pr_number:number;content_commit_sha:string;merge_sha:string|null;}
interface Scan {release_id:string|null;cursor_created_at:number|null;cursor_revision_id:string|null;end_created_at:number|null;end_revision_id:string|null;}
interface Publication {revision_id:string;page_id:string;base_content:string;merge_sha:string;created_at:number;failed_release_id:string|null;error_attempts:number|null;error_next_attempt_at:number|null;}
export interface VersionManifest {release_id:string;source_commit_sha:string;artifact_digest:string;built_at:string;}
export function validManifest(v:unknown):v is VersionManifest {
  if(!v||typeof v!=='object')return false;
  const x=v as Record<string,unknown>;
  return typeof x.release_id==='string'&&/^[a-zA-Z0-9_.-]{1,160}$/.test(x.release_id)&&typeof x.source_commit_sha==='string'&&/^[a-f0-9]{40}$/.test(x.source_commit_sha)&&typeof x.artifact_digest==='string'&&/^[a-f0-9]{64}$/.test(x.artifact_digest)&&typeof x.built_at==='string'&&Number.isFinite(Date.parse(x.built_at));
}
export async function onlineVersion(env:ApiEnv,http:typeof fetch=fetch):Promise<VersionManifest> {
  const u=new URL('/version.json',env.SITE_URL);u.searchParams.set('verify',crypto.randomUUID());
  const r=await http(u,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!r.ok)throw new Error('VERSION_UNAVAILABLE');
  const reader=r.body?.getReader();if(!reader)throw new Error('VERSION_UNAVAILABLE');
  let size=0;const chunks:Uint8Array[]=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw new Error('VERSION_TOO_LARGE');}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
  const v:unknown=JSON.parse(new TextDecoder().decode(bytes));if(!validManifest(v))throw new Error('INVALID_VERSION');return v;
}
export async function currentCoauthor(env:ApiEnv,uid:string,snapshot:Coauthor|null):Promise<Coauthor|null> {
  if(!snapshot)return null;
  const match=await env.DB.prepare('SELECT uid FROM github_identities WHERE uid=? AND github_numeric_id=? AND binding_version=? AND enabled=1 AND coauthor_email=? AND consent_version=?').bind(uid,snapshot.github_id,snapshot.binding_version,snapshot.email,snapshot.consent_version).first();
  return match?snapshot:null;
}
export class Coordinator {
  constructor(private env:ApiEnv,private git:GitPort,private http:typeof fetch=fetch) {}
  private async lease(job:Job):Promise<boolean> {
    const r=await this.env.DB.prepare('UPDATE publish_jobs SET lease_until=? WHERE job_id=? AND lease_token=? AND lease_until>?').bind(now()+600,job.job_id,job.lease_token,now()).run();return r.meta.changes===1;
  }
  private guard() {return 'EXISTS(SELECT 1 FROM publish_jobs WHERE job_id=? AND lease_token=? AND lease_until>?)';}
  private fence(job:Job) {return [job.job_id,job.lease_token,now()] as const;}
  private async advance(job:Job,status:string,stage:string) {
    await this.env.DB.batch([
      this.env.DB.prepare(`UPDATE submissions SET status=?,version=version+1,updated_at=? WHERE revision_id=? AND ${this.guard()}`).bind(status,now(),job.revision_id,...this.fence(job)),
      this.env.DB.prepare('UPDATE publish_jobs SET stage=?,next_attempt_at=?,last_error=NULL,lease_token=NULL,lease_until=NULL,updated_at=? WHERE job_id=? AND lease_token=? AND lease_until>?').bind(stage,now()+60,now(),job.job_id,job.lease_token,now())
    ]);
  }
  async run(limit=5):Promise<void> {
    if(this.env.PUBLISH_ENABLED!=='true')return;
    for(let i=0;i<limit;i++) {
      const job=await this.env.DB.prepare("UPDATE publish_jobs SET lease_token=?,lease_until=?,updated_at=? WHERE job_id=(SELECT job_id FROM publish_jobs WHERE stage IN ('git','pr','deploy') AND next_attempt_at<=? AND (lease_until IS NULL OR lease_until<=?) ORDER BY next_attempt_at LIMIT 1) RETURNING *").bind(crypto.randomUUID(),now()+600,now(),now(),now()).first<Job>();
      if(!job)break;
      try{await this.execute(job);}catch(error){await this.fail(job,error);}
    }
  }
  private async execute(job:Job) {
    const e=this.env;
    const r=await e.DB.prepare('SELECT s.uid,s.page_id,s.status,s.snapshot_hash,c.content,c.base_content,c.base_blob_sha,c.coauthor_json,c.sources_json FROM submissions s JOIN submission_content c USING(revision_id) WHERE revision_id=?').bind(job.revision_id).first<Revision>();
    if(!r)throw new Error('REVISION_MISSING');
    validateStoredContent(pageFor(r.page_id),r.content);
    if(await hash(r.content)!==r.snapshot_hash)throw new Error('SNAPSHOT_MISMATCH');
    const author=await e.DB.prepare('SELECT uid FROM users WHERE uid=? AND disabled_at IS NULL').bind(r.uid).first();
    if(!author)throw new Error('ACCOUNT_DISABLED');
    if(job.stage==='git') {
      if(!await this.lease(job))return;
      await e.DB.prepare(`UPDATE submissions SET status='git_pending',version=version+1,updated_at=? WHERE revision_id=? AND ${this.guard()}`).bind(now(),job.revision_id,...this.fence(job)).run();
      const snapshot:Coauthor|null=r.coauthor_json?JSON.parse(r.coauthor_json):null;
      const knownLink=await e.DB.prepare('SELECT branch,pr_number,content_commit_sha FROM git_links WHERE revision_id=?').bind(job.revision_id).first<Link>();
      const link=await this.git.ensurePull({revision_id:job.revision_id,uid:r.uid,page_id:r.page_id,content:r.content,base_blob_sha:r.base_blob_sha,coauthor:snapshot,sources:JSON.parse(r.sources_json)},
        ()=>this.lease(job),()=>currentCoauthor(e,r.uid,snapshot),knownLink??undefined);
      if(!await this.lease(job))return;
      await e.DB.prepare(`INSERT INTO git_links(revision_id,branch,pr_number,content_commit_sha) SELECT ?,?,?,? WHERE ${this.guard()} ON CONFLICT(revision_id) DO NOTHING`).bind(job.revision_id,link.branch,link.pr_number,link.content_commit_sha,...this.fence(job)).run();
      await this.advance(job,'git_pr_open','pr');return;
    }
    const link=await e.DB.prepare('SELECT * FROM git_links WHERE revision_id=?').bind(job.revision_id).first<Link>();if(!link)throw new Error('GIT_LINK_MISSING');
    if(job.stage==='pr') {
      const pull=await this.git.pullState(link.pr_number);
      // An independent maintainer may merge main into a PR; the original content commit and reviewed bytes must survive.
      if(pull.head_sha!==link.content_commit_sha && (!await this.git.contains(link.content_commit_sha,pull.head_sha)||(await this.git.readPage(r.page_id,pull.head_sha)).content!==r.content))throw new GitError('PR_SNAPSHOT_CHANGED',409);
      if(pull.merged&&pull.merge_sha) {
        if(!await this.git.contains(link.content_commit_sha,pull.merge_sha)||(await this.git.readPage(r.page_id,pull.merge_sha)).content!==r.content)throw new GitError('MERGED_SNAPSHOT_CHANGED',409);
        if(!await this.lease(job))return;
        await e.DB.prepare(`UPDATE git_links SET merge_sha=? WHERE revision_id=? AND ${this.guard()}`).bind(pull.merge_sha,job.revision_id,...this.fence(job)).run();
        await this.advance(job,'git_merged','deploy');return;
      }
      if(pull.closed)throw new GitError('PR_CLOSED',409);
      if((await this.git.readPage(r.page_id)).blob_sha!==r.base_blob_sha)throw new GitError('STALE_BASE',409);
      await this.advance(job,'git_pr_open','pr');return;
    }
    if(!link.merge_sha)throw new Error('MERGE_MISSING');
    if(!await this.lease(job))return;
    await e.DB.prepare(`UPDATE submissions SET status='deploying',version=version+1,updated_at=? WHERE revision_id=? AND ${this.guard()}`).bind(now(),job.revision_id,...this.fence(job)).run();
    const version=await onlineVersion(e,this.http);
    const receipt=await e.DB.prepare('SELECT release_id FROM deployments WHERE release_id=? AND source_sha=? AND artifact_digest=?').bind(version.release_id,version.source_commit_sha,version.artifact_digest).first();
    // The signed receipt is durable. If delivery was lost, CI can replay it safely; no untrusted file alone marks publication.
    if(!receipt)throw new Error('TRUSTED_RECEIPT_PENDING');
    if(!await this.git.contains(link.merge_sha,version.source_commit_sha)||!await this.git.contains(link.content_commit_sha,version.source_commit_sha))throw new Error('DEPLOY_NOT_CONTAINED');
    if((await this.git.readPage(r.page_id,version.source_commit_sha)).content===r.base_content)throw new Error('CONTENT_REVERTED');
    if(!await this.lease(job))return;
    await e.DB.batch([
      e.DB.prepare(`UPDATE deployments SET status='verified',verified_at=? WHERE release_id=? AND ${this.guard()}`).bind(now(),version.release_id,...this.fence(job)),
      e.DB.prepare(`INSERT OR IGNORE INTO publication_events(event_id,revision_id,release_id,action,created_at) SELECT ?,?,?,'published',? WHERE ${this.guard()}`).bind(newId('evt'),job.revision_id,version.release_id,now(),...this.fence(job)),
      e.DB.prepare(`UPDATE submissions SET status='published',version=version+1,updated_at=? WHERE revision_id=? AND ${this.guard()}`).bind(now(),job.revision_id,...this.fence(job)),
      e.DB.prepare("UPDATE publish_jobs SET stage='done',lease_token=NULL,lease_until=NULL,last_error=NULL,updated_at=? WHERE job_id=? AND lease_token=? AND lease_until>?").bind(now(),job.job_id,job.lease_token,now())
    ]);
  }
  private async fail(job:Job,error:unknown) {
    const conflict=error instanceof GitError&&error.status===409;
    const code=error instanceof GitError?error.code:error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'UPSTREAM_RETRYING';
    const attempts=job.retries+1,stage=conflict?'conflict':attempts>=8?'blocked':job.stage;
    await this.env.DB.batch([
      this.env.DB.prepare(`UPDATE submissions SET status=?,version=version+1,updated_at=? WHERE revision_id=? AND ${this.guard()}`).bind(conflict?'conflict':'retryable_error',now(),job.revision_id,...this.fence(job)),
      this.env.DB.prepare('UPDATE publish_jobs SET stage=?,resume_stage=?,retries=?,last_error=?,next_attempt_at=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE job_id=? AND lease_token=? AND lease_until>?').bind(stage,stage==='blocked'?job.stage:null,attempts,code,now()+Math.min(3600,30*2**attempts),now(),job.job_id,job.lease_token,now())
    ]);
    console.warn(JSON.stringify({event:'publish_retry',revision_id:job.revision_id,stage:job.stage,code}));
  }
  async reconcilePublished(limit=10):Promise<void> {
    if(this.env.PUBLISH_ENABLED!=='true')return;
    if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('INVALID_SCAN_LIMIT');
    const version=await onlineVersion(this.env,this.http);
    const receipt=await this.env.DB.prepare('SELECT release_id FROM deployments WHERE release_id=? AND source_sha=? AND artifact_digest=?').bind(version.release_id,version.source_commit_sha,version.artifact_digest).first();if(!receipt)return;
    const db=this.env.DB,token=crypto.randomUUID();
    await db.prepare("INSERT OR IGNORE INTO publication_reconciliation(name,updated_at) VALUES('published',?)").bind(now()).run();
    const state=await db.prepare("UPDATE publication_reconciliation SET lease_token=?,lease_until=?,updated_at=? WHERE name='published' AND (lease_until IS NULL OR lease_until<=?) RETURNING *").bind(token,now()+600,now(),now()).first<Scan>();
    if(!state)return;
    const owned="name='published' AND lease_token=? AND lease_until>?";
    try {
      if(state.end_revision_id===null) {
        const end=await db.prepare("SELECT s.created_at,s.revision_id FROM submissions s JOIN git_links g USING(revision_id) WHERE s.status='published' ORDER BY s.created_at DESC,s.revision_id DESC LIMIT 1").first<{created_at:number;revision_id:string}>();
        state.release_id=version.release_id;state.cursor_created_at=null;state.cursor_revision_id=null;
        state.end_created_at=end?.created_at??null;state.end_revision_id=end?.revision_id??null;
        const started=await db.prepare(`UPDATE publication_reconciliation SET release_id=?,cursor_created_at=NULL,cursor_revision_id=NULL,end_created_at=?,end_revision_id=?,updated_at=? WHERE ${owned}`).bind(state.release_id,state.end_created_at,state.end_revision_id,now(),token,now()).run();
        if(!started.meta.changes||!end)return;
      } else if(state.release_id!==version.release_id) {
        // Keep the round-robin position through frequent releases. Resetting on
        // every deploy could permanently starve records after the first page.
        state.release_id=version.release_id;
        const changed=await db.prepare(`UPDATE publication_reconciliation SET release_id=?,updated_at=? WHERE ${owned}`).bind(state.release_id,now(),token,now()).run();
        if(!changed.meta.changes)return;
      }
      const projection='SELECT s.revision_id,s.page_id,s.created_at,c.base_content,g.merge_sha,e.release_id AS failed_release_id,e.attempts AS error_attempts,e.next_attempt_at AS error_next_attempt_at FROM submissions s JOIN submission_content c USING(revision_id) JOIN git_links g USING(revision_id) LEFT JOIN publication_reconciliation_errors e USING(revision_id)';
      // Reserve a bounded retry budget while always allowing forward progress.
      const retryLimit=limit>1?Math.max(1,Math.floor(limit/4)):0;
      const retries=await db.prepare(`${projection} WHERE s.status='published' AND e.next_attempt_at<=? ORDER BY e.next_attempt_at,e.updated_at LIMIT ?`).bind(now(),retryLimit).all<Publication>();
      const forwardLimit=limit-retries.results.length;
      const rows=await db.prepare(`${projection} WHERE s.status='published' AND (? IS NULL OR (s.created_at,s.revision_id)>(?,?)) AND (s.created_at,s.revision_id)<=(?,?) ORDER BY s.created_at,s.revision_id LIMIT ?`).bind(state.cursor_created_at,state.cursor_created_at,state.cursor_revision_id,state.end_created_at,state.end_revision_id,forwardLimit).all<Publication>();
      const withdrawn:Publication[]=[],successful:string[]=[],failed:{row:Publication;code:string}[]=[];
      const records=new Map([...retries.results,...rows.results].map(row=>[row.revision_id,row]));
      for(const row of records.values()) {
        if(row.failed_release_id===version.release_id&&row.error_next_attempt_at!==null&&row.error_next_attempt_at>now())continue;
        // Renew between remote calls; a stale runner cannot advance the cursor.
        const lease=await db.prepare(`UPDATE publication_reconciliation SET lease_until=? WHERE ${owned}`).bind(now()+600,token,now()).run();
        if(!lease.meta.changes)return;
        try {
          const included=await this.git.contains(row.merge_sha,version.source_commit_sha);
          const restored=included&&(await this.git.readPage(row.page_id,version.source_commit_sha)).content===row.base_content;
          if(!included||restored)withdrawn.push(row);
          successful.push(row.revision_id);
        } catch(error) {
          if(error instanceof GitError&&error.code==='PAGE_DELETED') {
            withdrawn.push(row);successful.push(row.revision_id);
          } else {
            const code=error instanceof GitError?error.status===401||error.status===403&&error.code!=='GITHUB_RATE_LIMITED'?'GITHUB_PERMISSION_DENIED':error.status===404?'GIT_PAGE_LOOKUP_UNCONFIRMED':error.code:error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'UPSTREAM_READ_RETRYING';
            failed.push({row,code});
            console.warn(JSON.stringify({event:'reconcile_record_failed',revision_id:row.revision_id,code}));
          }
        }
      }
      const last=rows.results.at(-1);
      const complete=rows.results.length<forwardLimit||(last?.created_at===state.end_created_at&&last.revision_id===state.end_revision_id);
      const ts=now(),guard=`EXISTS(SELECT 1 FROM publication_reconciliation WHERE ${owned} AND release_id=?)`;
      // Events, per-record retries and forward progress commit together.
      const statements:D1PreparedStatement[]=[
        ...withdrawn.map(row=>db.prepare(`INSERT OR IGNORE INTO publication_events(event_id,revision_id,release_id,action,created_at) SELECT ?,?,?,'withdrawn',? WHERE ${guard}`).bind(newId('evt'),row.revision_id,version.release_id,ts,token,ts,version.release_id)),
        ...failed.map(({row,code})=>{
          const attempts=row.failed_release_id===version.release_id?(row.error_attempts??0)+1:1;
          return db.prepare(`INSERT INTO publication_reconciliation_errors(revision_id,release_id,error_code,attempts,next_attempt_at,updated_at) SELECT ?,?,?,?,?,? WHERE ${guard} ON CONFLICT(revision_id) DO UPDATE SET release_id=excluded.release_id,error_code=excluded.error_code,attempts=excluded.attempts,next_attempt_at=excluded.next_attempt_at,updated_at=excluded.updated_at`).bind(row.revision_id,version.release_id,code,attempts,ts+Math.min(3600,30*2**Math.min(attempts,7)),ts,token,ts,version.release_id);
        })
      ];
      for(let at=0;at<successful.length;at+=80) {
        const ids=successful.slice(at,at+80);
        statements.push(db.prepare(`DELETE FROM publication_reconciliation_errors WHERE revision_id IN (${ids.map(()=>'?').join(',')}) AND ${guard}`).bind(...ids,token,ts,version.release_id));
      }
      statements.push(db.prepare(`UPDATE publication_reconciliation SET cursor_created_at=?,cursor_revision_id=?,end_created_at=?,end_revision_id=?,completed_passes=completed_passes+?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE ${owned} AND release_id=?`).bind(complete?null:last!.created_at,complete?null:last!.revision_id,complete?null:state.end_created_at,complete?null:state.end_revision_id,complete?1:0,ts,token,ts,version.release_id));
      await db.batch(statements);
    } finally {
      await db.prepare("UPDATE publication_reconciliation SET lease_token=NULL,lease_until=NULL WHERE name='published' AND lease_token=?").bind(token).run();
    }
  }
}
