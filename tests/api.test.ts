import {beforeEach,afterEach,it,expect,vi,describe} from 'vitest';
import {app} from '../apps/api/src/index';
import {TestDatabase} from './d1';
import {createSession,now,hash,newId} from '../packages/auth/src/index';
import {GitHub} from '../packages/git-wrapper/src/index';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type {ApiEnv} from '../apps/api/src/types';
import {createWorkspaceService,parseDraft} from '../apps/web/src/features/workbench/service';
import {pageFor} from '../packages/wiki-schema/src/index';
import type {DraftBody} from '../apps/web/src/features/workbench/contracts';
let db:TestDatabase,env:ApiEnv,author:string,reviewer:string,second:string;
let credentials:Map<string,{token:string;csrf:string}>;
beforeEach(async()=>{
  db=new TestDatabase();env=db.env({GITHUB_WEBHOOK_SECRET:'test-secret',DEPLOY_WEBHOOK_SECRET:'deploy-secret'});credentials=new Map();
  author=newId('usr');reviewer=newId('usr');second=newId('usr');
  for(const [uid,role]of [[author,'contributor'],[reviewer,'reviewer'],[second,'reviewer']]) {
    db.sql.prepare('INSERT INTO users(uid,username,display_name,role,created_at) VALUES(?,?,?,?,?)').run(uid,uid,'Test User',role,now());credentials.set(uid,await createSession(env,uid,now()));
  }
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();db.close();});
async function request(path:string,uid:string|null=author,method='GET',body?:unknown,extra:Record<string,string>={}) {
  const s=uid?credentials.get(uid):null,background:Promise<unknown>[]=[];
  const headers=new Headers({Origin:env.WEB_ORIGIN,'Content-Type':'application/json','X-Roco-Request':'1',...(s?{Cookie:`roco_session=${s.token}`,'X-CSRF-Token':s.csrf}:{})});
  for(const [key,value] of Object.entries(extra))headers.set(key,value);
  const response=await app.fetch(new Request(`http://localhost:8787${path}`,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})}),env,{waitUntil:p=>background.push(p),passThroughOnException(){},props:{}});
  await Promise.all(background);return response;
}
async function seed(required=1,page='contributing') {
  const id=newId('rev'),body='# Revision\n\nReviewed content.';
  db.sql.prepare("INSERT INTO submissions(revision_id,uid,page_id,snapshot_hash,status,edit_summary,required_reviews,idempotency_key,request_hash,created_at,updated_at) VALUES(?,?,?,?,'pending_review','Test change',?,?,?, ?,?)").run(id,author,page,await hash(body),required,crypto.randomUUID(),'requesthash',now(),now());
  db.sql.prepare('INSERT INTO submission_content VALUES(?,?,?,?,?,?,?)').run(id,body,'# Base','a'.repeat(40),'b'.repeat(40),JSON.stringify([{title:'Evidence',url:'https://example.com',level:'tested'}]),null);return id;
}
describe('API account and submission security',()=>{
  it('keeps old sessions logged in while requiring verified reauthentication after upgrade',async()=>{
    db.sql.exec(readFileSync('database/migrations/0004_verified_authentication_time.sql','utf8'));
    expect((await request('/me')).status).toBe(200);
    expect((await request('/me/github',author,'DELETE')).status).toBe(401);
    expect((await request('/me/github/consent',author,'POST',{enabled:false,consent_version:'coauthor-public-git-v1'})).status).toBe(401);
    expect(db.sql.prepare('SELECT authenticated_at FROM sessions WHERE uid=?').get(author)!.authenticated_at).toBe(0);
  });
  it('stores session tokens only as hashes and rejects expiry',async()=>{
    const s=credentials.get(author)!;expect(db.sql.prepare('SELECT id_hash FROM sessions WHERE uid=?').get(author)!.id_hash).toBe(await hash(s.token));
    db.sql.prepare('UPDATE sessions SET expires_at=? WHERE uid=?').run(now()-1,author);expect((await request('/me')).status).toBe(401);
  });
  it('rejects unauthorized, cross-origin and CSRF mutations',async()=>{
    expect((await request('/drafts',null)).status).toBe(401);
    expect((await request('/auth/logout',author,'POST',{}, {Origin:'https://evil.example'})).status).toBe(403);
    expect((await request('/auth/logout',author,'POST',{}, {'X-CSRF-Token':'wrong'})).status).toBe(403);
    expect((await request('/auth/logout',author,'POST',{})).status).toBe(200);expect((await request('/me')).status).toBe(401);
  });
  it('keeps both tabs writable after repeated and concurrent account reads',async()=>{
    const initial=credentials.get(author)!.csrf;
    const first=await (await request('/me')).json() as {csrf_token:string};
    const tabs=await Promise.all([request('/me'),request('/me')]);
    const tokens=await Promise.all(tabs.map(async response=>(await response.json() as {csrf_token:string}).csrf_token));
    expect(tokens).toEqual([first.csrf_token,first.csrf_token]);
    for(const token of [initial,first.csrf_token,...tokens]) {
      expect((await request(`/drafts/${newId('draft')}`,author,'PUT',{page_id:'contributing',body:{text:'From a tab'}},{'X-CSRF-Token':token})).status).toBe(200);
    }
    const other=credentials.get(second)!.csrf;
    expect((await request(`/drafts/${newId('draft')}`,author,'PUT',{page_id:'contributing',body:{}},{'X-CSRF-Token':other})).status).toBe(403);
    await request('/auth/logout',author,'POST',{}, {'X-CSRF-Token':first.csrf_token});
    expect((await request('/me')).status).toBe(401);
  });
  it('keeps an existing session and its former CSRF token valid without writing on account reads',async()=>{
    const legacy='f'.repeat(64),session=credentials.get(author)!;
    db.sql.prepare('UPDATE sessions SET csrf_hash=? WHERE uid=?').run(await hash(legacy),author);
    const before=db.sql.prepare('SELECT * FROM sessions WHERE uid=?').get(author);
    const me=await (await request('/me')).json() as {csrf_token:string};
    expect(db.sql.prepare('SELECT * FROM sessions WHERE uid=?').get(author)).toEqual(before);
    for(const token of [legacy,me.csrf_token])expect((await request(`/drafts/${newId('draft')}`,author,'PUT',{page_id:'contributing',body:{}},{'X-CSRF-Token':token})).status).toBe(200);
    const fresh=await createSession(env,author,now());credentials.set(author,fresh);
    expect((await request(`/drafts/${newId('draft')}`,author,'PUT',{page_id:'contributing',body:{}},{'X-CSRF-Token':me.csrf_token})).status).toBe(403);
    expect(session.token).not.toBe(fresh.token);
  });
  it.each(['# '+ 'x'.repeat(55000),'# '+ '文'.repeat(21844),'# '+ '\\"'.repeat(32767)])('round trips a large draft with two UTF-8 bodies and JSON escaping (%#)',async content=>{
    expect(new TextEncoder().encode(content).length).toBeLessThanOrEqual(65536);
    const id=newId('draft');
    const body:DraftBody={base:{page:pageFor('contributing'),commit_sha:'a'.repeat(40),blob_sha:'b'.repeat(40),content,base_data_revision:null},body:content,entity:{},summary:'Pending edit',sources:[],optIn:false};
    const payload={page_id:'contributing',body};
    expect(new TextEncoder().encode(JSON.stringify(payload)).length).toBeGreaterThan(100000);
    expect((await request(`/drafts/${id}`,author,'PUT',payload)).status).toBe(200);
    const result=await (await request('/drafts')).json() as {drafts:{draft_id:string;page_id:string;body_json:string}[]};
    const restored=parseDraft(result.drafts[0]);expect(restored.body).toBe(content);expect(restored.base.content).toBe(content);
  });
  it('rejects oversized declared and streamed drafts without overwriting saved data',async()=>{
    const id=newId('draft'),payload={page_id:'contributing',body:{text:'Saved'}};
    expect((await request(`/drafts/${id}`,author,'PUT',payload)).status).toBe(200);
    expect((await request(`/drafts/${id}`,author,'PUT',payload,{'Content-Length':String(1024*1024+1)})).status).toBe(413);
    expect((await request(`/drafts/${id}`,author,'PUT',{...payload,body:{text:'x'.repeat(1024*1024)}})).status).toBe(413);
    expect(db.sql.prepare('SELECT body_json FROM drafts WHERE draft_id=?').get(id)!.body_json).toBe(JSON.stringify(payload.body));
    expect((await request('/preview',author,'POST',{content_markdown:'x'.repeat(100001)})).status).toBe(413);
  });
  it('accepts maximum-size draft bodies encoded using six-byte JSON Unicode escapes',async()=>{
    const id=newId('draft'),content='x'.repeat(65536),s=credentials.get(author)!;
    const body:DraftBody={base:{page:pageFor('contributing'),commit_sha:'a'.repeat(40),blob_sha:'b'.repeat(40),content,base_data_revision:null},body:content,entity:{},summary:'Working draft',sources:[],optIn:false};
    const serialized=JSON.stringify({page_id:'contributing',body}).replaceAll(JSON.stringify(content),'"'+'\\u0078'.repeat(65536)+'"');
    expect(Buffer.byteLength(serialized)).toBeGreaterThan(780000);
    const response=await app.fetch(new Request(`http://localhost:8787/drafts/${id}`,{method:'PUT',headers:{Origin:env.WEB_ORIGIN,'Content-Type':'application/json','X-Roco-Request':'1',Cookie:`roco_session=${s.token}`,'X-CSRF-Token':s.csrf},body:serialized}),env);
    expect(response.status).toBe(200);
    const result=await (await request('/drafts')).json() as {drafts:{draft_id:string;page_id:string;body_json:string}[]};
    expect(parseDraft(result.drafts[0]).body).toBe(content);
  });
  it('rejects ambiguous image references as invalid client content at the preview API',async()=>{
    const response=await request('/preview',author,'POST',{content_markdown:'![x][ref]\n\n[ref]: https://example.com/external.svg\n[REF]: /media/allowed.png'});
    expect(response.status).toBe(400);expect(await response.json()).toMatchObject({error:{code:'INVALID_CONTENT'}});
  });
  it('prevents another user from reading or overwriting private drafts/submissions',async()=>{
    const id=newId('draft');expect((await request(`/drafts/${id}`,author,'PUT',{page_id:'contributing',body:{text:'private'}})).status).toBe(200);
    expect((await request(`/drafts/${id}`,second,'PUT',{page_id:'contributing',body:{text:'overwrite'}})).status).toBe(404);
    const rows=await (await request('/drafts',second)).json() as {drafts:unknown[]};expect(rows.drafts).toHaveLength(0);
    db.sql.prepare("UPDATE users SET role='contributor' WHERE uid=?").run(second);expect((await request(`/submissions/${await seed()}`,second)).status).toBe(404);
  });
  it('validates before any GitHub call and deduplicates an immutable candidate',async()=>{
    const read=vi.spyOn(GitHub.prototype,'readPage').mockResolvedValue({commit_sha:'a'.repeat(40),blob_sha:'b'.repeat(40),content:'# Base'});vi.spyOn(GitHub.prototype,'contains').mockResolvedValue(true);
    const input={kind:'article',page_id:'contributing',base_commit_sha:'a'.repeat(40),base_blob_sha:'b'.repeat(40),content_markdown:'# New safe body',edit_summary:'Updated based on evidence',source_references:[{title:'Evidence',url:'https://example.com',level:'tested'}]};
    expect((await request('/submissions',author,'POST',{...input,path:'../../script'},{'Idempotency-Key':'same-request'})).status).toBe(400);expect(read).not.toHaveBeenCalled();
    const first=await request('/submissions',author,'POST',input,{'Idempotency-Key':'same-request'});expect(first.status).toBe(201);
    const rev=(await first.json() as {revision_id:string}).revision_id;
    expect((await request('/submissions',author,'POST',input,{'Idempotency-Key':'same-request'})).status).toBe(200);
    expect((await request('/submissions',author,'POST',{...input,content_markdown:'# Different'},{'Idempotency-Key':'same-request'})).status).toBe(409);
    expect(()=>db.sql.prepare('UPDATE submission_content SET content=? WHERE revision_id=?').run('tampered',rev)).toThrow('immutable snapshot');
    expect(db.sql.prepare('SELECT count(*) AS n FROM submissions').get()!.n).toBe(1);
  });
  it('does not attach a frontend-supplied coauthor without consent',async()=>{
    vi.spyOn(GitHub.prototype,'readPage').mockResolvedValue({commit_sha:'a'.repeat(40),blob_sha:'b'.repeat(40),content:'# Base'});vi.spyOn(GitHub.prototype,'contains').mockResolvedValue(true);
    const response=await request('/submissions',author,'POST',{kind:'article',page_id:'contributing',base_commit_sha:'a'.repeat(40),base_blob_sha:'b'.repeat(40),content_markdown:'# Different content',edit_summary:'Different source',source_references:[{title:'Evidence',url:'https://example.com',level:'tested'}],coauthor_opt_in:true},{'Idempotency-Key':'coauthor-request'});
    expect(response.status).toBe(400);expect(db.sql.prepare('SELECT count(*) AS n FROM submissions').get()!.n).toBe(0);
  });
});
describe('review protocol',()=>{
  it('loads empty and populated queues through the frontend service, then reviews both page types',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=new URL(String(input));
      const headers:Record<string,string>={};new Headers(init?.headers).forEach((value,key)=>{headers[key]=value;});
      return request(url.pathname,reviewer,init?.method??'GET',init?.body?JSON.parse(String(init.body)):undefined,headers);
    }));
    const service=createWorkspaceService(env.API_ORIGIN,credentials.get(reviewer)!.csrf);
    expect((await service.reviews()).submissions).toEqual([]);
    const regular=await seed(),critical=await seed(2,'research-method');
    expect((await service.reviews()).submissions).toEqual(expect.arrayContaining([
      expect.objectContaining({revision_id:regular,status:'pending_review'}),
      expect.objectContaining({revision_id:critical,status:'pending_review'}),
    ]));
    const detail=await service.detail(regular);
    expect((await service.decide(regular,'approve','Checked evidence',detail.version)).status).toBe('approved');
    const criticalDetail=await service.detail(critical);
    expect((await service.decide(critical,'approve','Checked evidence',criticalDetail.version)).status).toBe('pending_review');
    expect((await service.reviews()).submissions.map(row=>row.revision_id)).toEqual([critical]);
  });
  it('refuses self-review and requires distinct reviewers for a critical page',async()=>{
    db.sql.prepare("UPDATE users SET role='reviewer' WHERE uid=?").run(author);const revision=await seed(2,'research-method');
    expect((await request(`/reviews/${revision}/decision`,author,'POST',{verdict:'approve',comment:'Self approval',version:0})).status).toBe(403);
    expect((await request(`/reviews/${revision}/decision`,reviewer,'POST',{verdict:'approve',comment:'Checked evidence',version:0})).status).toBe(200);
    expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(revision)!.status).toBe('pending_review');expect(db.sql.prepare('SELECT count(*) AS n FROM publish_jobs').get()!.n).toBe(0);
    expect((await request(`/reviews/${revision}/decision`,reviewer,'POST',{verdict:'approve',comment:'Repeat approval',version:1})).status).toBe(409);
    expect((await request(`/reviews/${revision}/decision`,second,'POST',{verdict:'approve',comment:'Independently checked',version:1})).status).toBe(200);
    expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(revision)!.status).toBe('approved');expect(db.sql.prepare('SELECT count(*) AS n FROM publish_jobs').get()!.n).toBe(1);
  });
  it('resolves concurrent decisions through compare-and-swap, with a single outbox job',async()=>{
    const revision=await seed();const responses=await Promise.all([request(`/reviews/${revision}/decision`,reviewer,'POST',{verdict:'approve',comment:'Checked evidence',version:0}),request(`/reviews/${revision}/decision`,second,'POST',{verdict:'reject',comment:'Missing source',version:0})]);
    expect(responses.map(r=>r.status).sort()).toEqual([200,409]);expect(db.sql.prepare('SELECT count(*) AS n FROM reviews').get()!.n).toBe(1);expect(db.sql.prepare('SELECT count(*) AS n FROM publish_jobs').get()!.n).toBeLessThanOrEqual(1);
  });
  it('allows withdrawal only before external work begins, retaining audit history',async()=>{
    const revision=await seed();await request(`/reviews/${revision}/decision`,reviewer,'POST',{verdict:'approve',comment:'Checked evidence',version:0});
    expect((await request(`/submissions/${revision}/cancel`,author,'POST',{})).status).toBe(200);
    expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(revision)!.status).toBe('cancelled');expect(db.sql.prepare('SELECT count(*) AS n FROM reviews').get()!.n).toBe(1);
    expect(()=>db.sql.prepare("DELETE FROM audit_events").run()).toThrow('append-only');
  });
});
describe('signed external receipts',()=>{
  it('rejects invalid signatures and deduplicates GitHub deliveries',async()=>{
    const body={repository:{name:env.GITHUB_REPO,owner:{login:env.GITHUB_OWNER}}},raw=JSON.stringify(body),signature='sha256='+createHmac('sha256',env.GITHUB_WEBHOOK_SECRET!).update(raw).digest('hex');
    expect((await request('/webhooks/github',null,'POST',body,{'X-Hub-Signature-256':'sha256='+'0'.repeat(64),'X-GitHub-Delivery':'same-id'})).status).toBe(401);
    for(let i=0;i<2;i++)expect((await request('/webhooks/github',null,'POST',body,{'X-Hub-Signature-256':signature,'X-GitHub-Delivery':'same-id','X-GitHub-Event':'pull_request'})).status).toBe(202);
    expect(db.sql.prepare('SELECT count(*) AS n FROM webhook_events').get()!.n).toBe(1);
  });
  it('records a trusted deployment without declaring a submission published',async()=>{
    const revision=await seed(),body={release_id:'test-release',source_commit_sha:'d'.repeat(40),artifact_digest:'e'.repeat(64),built_at:new Date().toISOString()},time=String(now());
    const signed={'X-Webhook-Timestamp':time,'X-Signature':'sha256='+createHmac('sha256',env.DEPLOY_WEBHOOK_SECRET!).update(`${time}.${JSON.stringify(body)}`).digest('hex')};
    for(let i=0;i<2;i++)expect((await request('/webhooks/deploy',null,'POST',body,signed)).status).toBe(202);
    expect(db.sql.prepare('SELECT count(*) AS n FROM deployments').get()!.n).toBe(1);expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(revision)!.status).toBe('pending_review');
    expect((await request('/webhooks/deploy',null,'POST',body,{...signed,'X-Webhook-Timestamp':String(now()-1000)})).status).toBe(401);
  });
});
