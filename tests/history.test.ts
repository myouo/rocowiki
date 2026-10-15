// SPDX-License-Identifier: GPL-3.0-only
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {app} from '../apps/api/src/index';
import {historySources} from '../apps/api/src/history-sources';
import {historyResponseSchema,historyDiffSchema} from '../packages/wiki-schema/src/history';
import {createWorkspaceService} from '../apps/web/src/features/workbench/service';
import {PublicGitHistory} from '../packages/git-wrapper/src/history';
import {now} from '../packages/auth/src/index';
import {TestDatabase} from './d1';
import type {ApiEnv} from '../apps/api/src/types';

let db:TestDatabase,env:ApiEnv;
const head='a'.repeat(40),sha='b'.repeat(40),old='c'.repeat(40),uid='usr_history',otherUid='usr_impostor';
const page='/wiki/guides/contributing/',path='content/guides/contributing.md';
function entry(id=12345,login='renamed-octocat') {return {sha,author:{id,login},commit:{message:'Fix source evidence\n\nCo-authored-by: Private <private@example.test>\nWiki-User-ID: usr_impostor',author:{name:'Original Git author',email:'private@example.test',date:'2026-10-14T09:30:00Z'}}};}
function provider(options:{rows?:unknown[];status?:number;comparison?:string;head?:string;files?:unknown[]}={}) {
  return vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=new URL(String(input));expect(url.origin).toBe('https://api.github.com');expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    expect(url.pathname.startsWith('/repos/sample-owner/public-wiki/')).toBe(true);
    if(options.status)return new Response('private upstream response',{status:options.status});
    if(url.pathname.includes('/git/ref/heads/'))return Response.json({object:{sha:options.head??head}});
    if(url.pathname.includes('/compare/'))return Response.json({status:options.comparison??'ahead'});
    if(url.pathname.endsWith('/commits')){expect(url.searchParams.get('path')).toBe(path);expect(url.searchParams.get('per_page')).toBe('20');return Response.json(options.rows??[entry()]);}
    if(url.pathname.endsWith('/commits/'+sha))return Response.json({sha,files:options.files??[{filename:path,status:'modified',additions:2,deletions:1,patch:'@@ -1 +1 @@\n-Old source\n+<img src=x onerror=alert(1)>'},{filename:'apps/api/.dev.vars',status:'modified',additions:1,deletions:0,patch:'+SYNTHETIC_PRIVATE_FILE=hidden'}]});
    throw new Error('Unexpected upstream request: '+url.pathname);
  });
}
const request=(query:Record<string,string>={},route='/history')=>app.request('http://localhost:8787'+route+'?'+new URLSearchParams({page,...query}),{},env);
beforeEach(()=>{
  db=new TestDatabase();env=db.env({GITHUB_OWNER:'sample-owner',GITHUB_REPO:'public-wiki',GITHUB_DEFAULT_BRANCH:'main'});
  db.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run(uid,'history-member','站内作者',now());
  db.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run(otherUid,'impostor','Original Git author',now());
  db.sql.prepare('INSERT INTO github_identities(uid,github_numeric_id,login,enabled,binding_version) VALUES(?,?,?,0,?)').run(uid,12345,'old-octocat-name','binding-version');
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();db.close();});

it('lets a guest read real Git history and links a renamed GitHub ID to its Wiki owner without publishing email or trailers',async()=>{
  const upstream=provider();vi.stubGlobal('fetch',upstream);
  const response=await request();expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('no-store');
  const data=historyResponseSchema.parse(await response.json());
  expect(data).toMatchObject({page,ref:head,source:{path,shared:false},commits:[{sha,summary:'Fix source evidence',author:{name:'Original Git author',github:{id:12345,login:'renamed-octocat'},wiki:{uid,display_name:'站内作者'}},contributors:[]}]});
  const serialized=JSON.stringify(data);expect(serialized).not.toContain('@example.test');expect(serialized).not.toContain('coauthor_email');expect(serialized).not.toContain(otherUid);
  expect(upstream).toHaveBeenCalledTimes(2);
  for(const route of ['/pages/contributing/edit-base','/drafts','/submissions','/reviews'])expect((await app.request('http://localhost:8787'+route,{},env)).status).toBe(401);
});
it('does not infer a Wiki identity from a matching Git name or reused login',async()=>{
  vi.stubGlobal('fetch',provider({rows:[entry(98765,'old-octocat-name')]}));
  expect(historyResponseSchema.parse(await (await request()).json()).commits[0].author.wiki).toBeNull();
});
it('credits site submissions only after a verified nonempty publication, independently of Git author binding',async()=>{
  const revision='rev_history',time=now();
  db.sql.prepare("INSERT INTO submissions(revision_id,uid,page_id,snapshot_hash,status,edit_summary,required_reviews,idempotency_key,request_hash,created_at,updated_at) VALUES(?,?,'contributing','snapshot','published','Evidence update',1,'history-key','request',?,?)").run(revision,otherUid,time,time);
  db.sql.prepare('INSERT INTO submission_content VALUES(?,?,?,?,?,?,NULL)').run(revision,'# New source','# Old source',head,old,'[]');
  db.sql.prepare('INSERT INTO git_links VALUES(?,?,?,?,?)').run(revision,'wiki/'+revision,1,sha,head);
  db.sql.prepare("INSERT INTO deployments VALUES('history-release',?,?,'production','reported',?,NULL)").run(head,'f'.repeat(64),time);
  db.sql.prepare("INSERT INTO publication_events VALUES('history-event',?,'history-release','published',?)").run(revision,time);
  vi.stubGlobal('fetch',provider());
  expect(historyResponseSchema.parse(await(await request()).json()).commits[0].contributors).toEqual([]);
  db.sql.prepare("UPDATE deployments SET status='verified',verified_at=? WHERE release_id='history-release'").run(time);
  expect(historyResponseSchema.parse(await(await request()).json()).commits[0].contributors).toEqual([{uid:otherUid,display_name:'Original Git author'}]);
  db.sql.prepare("UPDATE submissions SET status='retryable_error' WHERE revision_id=?").run(revision);
  expect(historyResponseSchema.parse(await(await request()).json()).commits[0].contributors).toEqual([]);
});
it('refreshes attribution after unlinking or disabling the Wiki account even when provider data is cached',async()=>{
  const saved=new Map<string,Response>(),cache:Pick<Cache,'match'|'put'>={match:async key=>saved.get(String(key instanceof Request?key.url:key))?.clone(),put:async(key,value)=>{saved.set(String(key instanceof Request?key.url:key),value.clone());}};
  vi.stubGlobal('caches',{open:async()=>cache});const upstream=provider();vi.stubGlobal('fetch',upstream);
  expect(historyResponseSchema.parse(await(await request()).json()).commits[0].author.wiki?.uid).toBe(uid);
  db.sql.prepare('UPDATE users SET disabled_at=? WHERE uid=?').run(now(),uid);
  expect(historyResponseSchema.parse(await(await request()).json()).commits[0].author.wiki).toBeNull();
  db.sql.prepare('UPDATE users SET disabled_at=NULL WHERE uid=?').run(uid);
  db.sql.prepare('DELETE FROM github_identities WHERE uid=?').run(uid);
  expect(historyResponseSchema.parse(await(await request()).json()).commits[0].author.wiki).toBeNull();expect(upstream).toHaveBeenCalledTimes(2);
});
it('pins pagination to a main-branch ancestor when new commits arrive',async()=>{
  const upstream=provider({head:old,rows:Array.from({length:20},()=>entry())});vi.stubGlobal('fetch',upstream);
  const first=historyResponseSchema.parse(await(await request()).json());expect(first.next_cursor).toBe(2);expect(first.ref).toBe(old);
  const newer=provider();vi.stubGlobal('fetch',newer);
  expect((await request({ref:first.ref,cursor:'2'})).status).toBe(200);
  const list=newer.mock.calls.map(([url])=>new URL(String(url))).find(url=>url.pathname.endsWith('/commits'))!;
  expect(list.searchParams.get('sha')).toBe(old);expect(list.searchParams.get('page')).toBe('2');
});
it.each(['behind','diverged'])('rejects an unpublished history reference (%s)',async comparison=>{
  const upstream=provider({comparison});vi.stubGlobal('fetch',upstream);
  expect((await request({ref:old})).status).toBe(400);expect(upstream.mock.calls.some(([url])=>String(url).includes('/commits?'))).toBe(false);
});
it('shows only the selected public source patch and keeps editing authenticated',async()=>{
  vi.stubGlobal('fetch',provider());const response=await request({source:'article',sha},'/history/diff');expect(response.status).toBe(200);
  const data=historyDiffSchema.parse(await response.json());expect(data).toMatchObject({sha,source:'article',additions:2,deletions:1});expect(data.patch).toContain('<img');expect(JSON.stringify(data)).not.toContain('SYNTHETIC_PRIVATE_FILE');
  expect((await app.request('http://localhost:8787/history',{method:'POST'},env)).status).toBe(403);
});
it('rejects a pending commit before fetching its diff',async()=>{
  const upstream=provider({comparison:'diverged'});vi.stubGlobal('fetch',upstream);
  expect((await request({source:'article',sha},'/history/diff')).status).toBe(400);expect(upstream.mock.calls.some(([url])=>String(url).endsWith('/commits/'+sha))).toBe(false);
});
it('keeps an honest upstream fallback when a large commit exceeds the GitHub file preview',async()=>{
  vi.stubGlobal('fetch',provider({files:Array.from({length:300},(_,index)=>({filename:`public/data-${index}.json`,status:'added',additions:1,deletions:0}))}));
  const response=await request({source:'article',sha},'/history/diff');expect(response.status).toBe(200);
  expect(historyDiffSchema.parse(await response.json())).toMatchObject({status:'preview_unavailable',patch:null,additions:null,deletions:null});
});
it('rejects arbitrary repository paths, unknown pages, and malformed cursors without contacting GitHub',async()=>{
  const upstream=provider();vi.stubGlobal('fetch',upstream);
  expect((await request({source:'../../apps/api/.dev.vars'})).status).toBe(404);
  expect((await request({page:'/skills/not-in-this-wiki/'})).status).toBe(404);
  expect((await request({page:'https://attacker.test/'})).status).toBe(400);
  expect((await request({cursor:'0'})).status).toBe(400);expect(upstream).not.toHaveBeenCalled();
});
it('keeps official query-string entry identities and marks shared-file history honestly',()=>{
  const sources=historySources('/skills/?entry=official-skill-3806&pet=example');expect(sources[0]).toMatchObject({path:'apps/web/content/official-skills.json',shared:true});
  expect(historySources('/mechanics/effects/pressure/')).toEqual([{id:'article',label:'页面正文',path:'apps/web/docs/mechanics/effects/pressure.md',shared:false}]);
});
it('maps world pages to the files that actually supply their content rather than an unrelated weekly snapshot',()=>{
  for(const [page,path] of [['/places/castle/','world/placeData.js'],['/npcs/griffin/','npcPresentation.js'],['/items/potion/','world/ItemPages.jsx'],['/tasks/badges/','world/TaskPages.jsx'],['/challenges/star-tower/','world/ChallengePages.jsx']])expect(historySources(page)[0]).toMatchObject({path:'apps/web/src/wiki/'+path,shared:true});
  expect(historySources('/battle/rules/')[0].path).toBe('apps/web/content/weekly-v5.json');
});
it.each([403,429,500])('returns a readable failure instead of an empty successful history when GitHub returns %s',async status=>{
  vi.stubGlobal('fetch',provider({status}));const response=await request();expect(response.status).toBeGreaterThanOrEqual(500);const body=await response.text();expect(body).toContain(status===500?'HISTORY_UNAVAILABLE':'HISTORY_RATE_LIMITED');expect(body).not.toContain('private upstream response');
});
it('bounds streamed GitHub responses before JSON parsing',async()=>{
  const git=new PublicGitHistory(env,async()=>new Response('x'.repeat(2*1024*1024+1)));
  await expect(git.head()).rejects.toMatchObject({code:'HISTORY_UNAVAILABLE'});
});
it('validates public history and diff response ownership at the real frontend service boundary',async()=>{
  const upstream=provider();vi.stubGlobal('fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
    if(String(input).startsWith('https://api.github.com/'))return upstream(input,init);
    return app.request(String(input),init,env);
  });
  const service=createWorkspaceService('http://localhost:8787');expect((await service.history(page)).commits[0].author.wiki?.uid).toBe(uid);
  expect((await service.historyDiff(page,'article',sha)).sha).toBe(sha);
  vi.stubGlobal('fetch',async()=>Response.json({sha:old,source:'article',status:'modified',additions:1,deletions:0,patch:'+Wrong version'}));
  await expect(service.historyDiff(page,'article',sha)).rejects.toMatchObject({code:'INVALID_SERVICE_RESPONSE'});
});
