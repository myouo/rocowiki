import {it,expect,vi} from 'vitest';
import {TestDatabase} from './d1';
import {GitHub,commitMessage,type GitCandidate,type Coauthor} from '../packages/git-wrapper/src/index';
import {newId} from '../packages/auth/src/index';
import {githubFixture} from './github-fixture';
const blob='b'.repeat(40);
function candidate():GitCandidate {return {revision_id:newId('rev'),uid:newId('usr'),page_id:'contributing',content:'# Safe candidate',base_blob_sha:blob,coauthor:null,sources:[{title:'Source',url:'https://example.com',level:'tested'}]};}
const author:Coauthor={github_id:1,binding_version:'binding',consent_version:'v1',name:'ExampleUser',email:'verified@example.com'};
it.each(['deleted','present','forbidden','unknown-commit','truncated'] as const)('confirms Contents 404 against readable immutable Git trees: %s',async scenario=>{
  const db=new TestDatabase(),c=candidate(),fixture=githubFixture(db,c,null);
  const ref='e'.repeat(40),root='1'.repeat(40),content='2'.repeat(40),guides='3'.repeat(40);
  const http:typeof fetch=async(input,init)=>{
    const path=new URL(String(input)).pathname;
    if(path.includes('/contents/'))return new Response('{}',{status:404});
    if(path.endsWith(`/git/commits/${ref}`))return scenario==='unknown-commit'?new Response('{}',{status:404}):Response.json({tree:{sha:root}});
    if(path.endsWith(`/git/trees/${root}`))return scenario==='forbidden'?new Response('{}',{status:403}):Response.json({truncated:scenario==='truncated',tree:[{path:'content',type:'tree',sha:content}]});
    if(path.endsWith(`/git/trees/${content}`))return Response.json({truncated:false,tree:[{path:'guides',type:'tree',sha:guides}]});
    if(path.endsWith(`/git/trees/${guides}`))return Response.json({truncated:false,tree:scenario==='present'?[{path:'contributing.md',type:'blob',sha:blob}]:[]});
    return fixture.http(input,init);
  };
  try {
    const expected=scenario==='deleted'?'PAGE_DELETED':scenario==='forbidden'?'GITHUB_PERMISSION_DENIED':scenario==='unknown-commit'?'GITHUB_REQUEST_FAILED':'GIT_PAGE_LOOKUP_UNCONFIRMED';
    await expect(new GitHub(fixture.env,http).readPage('contributing',ref)).rejects.toMatchObject({code:expected});
    expect(fixture.counts).toEqual({commits:0,refs:0,pulls:0});
  } finally {db.close();}
});
it.each(['ancestry','content','metadata'] as const)('rejects a recovered PR with changed %s even when a durable original link exists',async field=>{
  const db=new TestDatabase(),c=candidate(),fixture=githubFixture(db,c,null);
  try {
    const link=await new GitHub(fixture.env,fixture.http).ensurePull(c);
    fixture.remote.branch='f'.repeat(40);fixture.remote.message='Merge main';fixture.remote.parentCount=2;
    if(field==='ancestry')fixture.remote.containsOriginal=false;
    if(field==='content')fixture.remote.content='# Changed content';
    if(field==='metadata')fixture.remote.metadata=fixture.remote.metadata.replace('Source','Forged source');
    await expect(new GitHub(fixture.env,fixture.http).ensurePull(c,async()=>true,async()=>null,link)).rejects.toMatchObject({code:'PR_SNAPSHOT_CHANGED',status:409});
    expect(fixture.counts).toEqual({commits:1,refs:1,pulls:1});
  } finally {db.close();}
});
it('rechecks consent after tree creation before writing the content commit',async()=>{
  const db=new TestDatabase(),c={...candidate(),coauthor:author},fixture=githubFixture(db,c,null);
  try {
    // A revoke delivered while the tree is being created must affect the commit.
    await new GitHub(fixture.env,fixture.http).ensurePull(c,async()=>true,async()=>fixture.trees.length?null:author);
    expect(fixture.remote.message).not.toContain('Co-authored-by');
  } finally {db.close();}
});
it('retries without attribution when consent changes between commit and ref writes',async()=>{
  const db=new TestDatabase(),c={...candidate(),coauthor:author},fixture=githubFixture(db,c,null);
  const authorize=async()=>fixture.counts.commits?null:author;
  try {
    await expect(new GitHub(fixture.env,fixture.http).ensurePull(c,async()=>true,authorize)).rejects.toThrow('COAUTHOR_CONSENT_CHANGED');
    expect(fixture.counts.refs).toBe(0);
    await new GitHub(fixture.env,fixture.http).ensurePull(c,async()=>true,authorize);
    expect(fixture.messages[0]).toContain('Co-authored-by');expect(fixture.messages[1]).not.toContain('Co-authored-by');
    expect(fixture.counts).toEqual({commits:2,refs:1,pulls:1});
  } finally {db.close();}
});
it('still requires write authority to create a PR for a recovered branch',async()=>{
  const db=new TestDatabase(),c={...candidate(),coauthor:author},fixture=githubFixture(db,c,'ref');
  try {
    await expect(new GitHub(fixture.env,fixture.http).ensurePull(c)).rejects.toThrow('simulated lost response');
    await expect(new GitHub(fixture.env,fixture.http).ensurePull(c,async()=>false,async()=>null)).rejects.toThrow('LEASE_LOST');
    expect(fixture.counts).toEqual({commits:1,refs:1,pulls:0});
  } finally {db.close();}
});
it('omits withdrawn consent on a new commit and recovers that unsigned commit from the historical snapshot',async()=>{
  const db=new TestDatabase(),c={...candidate(),coauthor:author},fixture=githubFixture(db,c,'pull');
  try {
    await expect(new GitHub(fixture.env,fixture.http).ensurePull(c,async()=>true,async()=>null)).rejects.toThrow('simulated lost response');
    expect(fixture.remote.message).not.toContain('Co-authored-by');
    expect((await new GitHub(fixture.env,fixture.http).ensurePull(c,async()=>true,async()=>null)).pr_number).toBe(42);
    expect(fixture.counts).toEqual({commits:1,refs:1,pulls:1});
  } finally {db.close();}
});
it.each(['message','content','metadata','parentBlob','parentCount'] as const)('rejects changed historical %s when recovering a branch',async field=>{
  const db=new TestDatabase(),c={...candidate(),coauthor:author},fixture=githubFixture(db,c,'ref');
  try {
    await expect(new GitHub(fixture.env,fixture.http).ensurePull(c)).rejects.toThrow('simulated lost response');
    switch(field) {
      case 'message':fixture.remote.message=fixture.remote.message.replace(author.email,'intruder@example.com');break;
      case 'content':fixture.remote.content='# Changed content';break;
      case 'metadata':fixture.remote.metadata=fixture.remote.metadata.replace('Source','Forged source');break;
      case 'parentBlob':fixture.remote.parentBlob='f'.repeat(40);break;
      case 'parentCount':fixture.remote.parentCount=2;break;
    }
    await expect(new GitHub(fixture.env,fixture.http).ensurePull(c,async()=>true,async()=>null)).rejects.toThrow('EXISTING_BRANCH_MISMATCH');
    expect(fixture.counts).toEqual({commits:1,refs:1,pulls:0});
  } finally {db.close();}
});
it('recovers a remotely created PR after response loss, without a duplicate PR or content commit',async()=>{
  const db=new TestDatabase(),c=candidate(),fixture=githubFixture(db,c);
  const git=new GitHub(fixture.env,fixture.http);await expect(git.ensurePull(c)).rejects.toThrow('simulated lost response');
  const recovered=await new GitHub(fixture.env,fixture.http).ensurePull(c);expect(recovered.pr_number).toBe(42);expect(fixture.counts.pulls).toBe(1);expect(fixture.counts.commits).toBe(1);
  expect(JSON.stringify(fixture.trees)).toContain('content/guides/contributing.md');expect(JSON.stringify(fixture.trees)).toContain('content/metadata/contributing.json');expect(JSON.stringify(fixture.trees)).not.toContain('verified@example.com');db.close();
});
it('rejects unsafe content/paths before acquiring any GitHub token',async()=>{
  const db=new TestDatabase(),http=vi.fn(),git=new GitHub(db.env(),http),c=candidate();
  await expect(git.ensurePull({...c,page_id:'../package.json'})).rejects.toThrow();await expect(git.ensurePull({...c,content:'<script/> '})).rejects.toThrow();expect(http).not.toHaveBeenCalled();db.close();
});
it('keeps coauthor at the content commit and rejects trailer injection',()=>{
  const c=candidate();expect(commitMessage(c)).not.toContain('Co-authored-by');
  c.coauthor={github_id:1,binding_version:'binding',consent_version:'v1',name:'ExampleUser',email:'verified@example.com'};
  expect(commitMessage(c)).toContain('Co-authored-by: ExampleUser <verified@example.com>');expect(commitMessage(c)).toContain(`Wiki-Revision-ID: ${c.revision_id}`);
  expect(()=>commitMessage({...c,coauthor:{...c.coauthor!,name:'Example\nInjected: true'}})).toThrow('INVALID_COAUTHOR');
});
