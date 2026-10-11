import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {TestDatabase} from './d1';
import {now,newId,hash} from '../packages/auth/src/index';
import {Coordinator} from '../packages/publish-coordinator/src/index';
import {GitError,GitHub,type GitPort,type Coauthor,type GitCandidate} from '../packages/git-wrapper/src/index';
import {githubFixture} from './github-fixture';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
let db:TestDatabase,uid:string;
const baseSha='a'.repeat(40),blobSha='b'.repeat(40),contentSha='c'.repeat(40),mergeSha='d'.repeat(40),releaseSha='e'.repeat(40);
const candidate='# Revised\n\nNew evidence.',base='# Baseline';
beforeEach(()=>{db=new TestDatabase();uid=newId('usr');db.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run(uid,uid,'Test',now());});afterEach(()=>db.close());
async function seed(stage='git',coauthor:Coauthor|null=null) {
  const rev=newId('rev');db.sql.prepare("INSERT INTO submissions(revision_id,uid,page_id,snapshot_hash,status,edit_summary,required_reviews,idempotency_key,request_hash,created_at,updated_at) VALUES(?,?,'contributing',?,'pending_review','A change',1,?,?,?,?)").run(rev,uid,await hash(candidate),crypto.randomUUID(),'hash',now(),now());
  db.sql.prepare('INSERT INTO submission_content VALUES(?,?,?,?,?,?,?)').run(rev,candidate,base,baseSha,blobSha,JSON.stringify([{title:'Evidence',url:'https://example.com',level:'tested'}]),coauthor?JSON.stringify(coauthor):null);
  db.sql.prepare("UPDATE submissions SET status='approved' WHERE revision_id=?").run(rev);
  if(stage!=='git') {db.sql.prepare('INSERT INTO git_links VALUES(?,?,?,?,?)').run(rev,`wiki/${rev}`,1,contentSha,stage==='deploy'?mergeSha:null);db.sql.prepare('UPDATE publish_jobs SET stage=? WHERE revision_id=?').run(stage,rev);}
  return rev;
}
function git():GitPort{return {readPage:vi.fn().mockResolvedValue({commit_sha:baseSha,blob_sha:blobSha,content:candidate}),ensurePull:vi.fn().mockImplementation(async c=>({branch:`wiki/${c.revision_id}`,content_commit_sha:contentSha,pr_number:1})),pullState:vi.fn().mockResolvedValue({merged:false,merge_sha:null,closed:false,head_sha:contentSha}),contains:vi.fn().mockResolvedValue(true)};}
const version={release_id:'test-release',source_commit_sha:releaseSha,artifact_digest:'f'.repeat(64),built_at:new Date().toISOString()};
function online(manifest=version):typeof fetch {return vi.fn().mockImplementation(async()=>new Response(JSON.stringify(manifest),{headers:{'Content-Type':'application/json'}}));}
function receipt(){db.sql.prepare("INSERT INTO deployments VALUES(?,?,?,'production','reported',?,NULL)").run(version.release_id,version.source_commit_sha,version.artifact_digest,now());}
it('does not reuse a submission consent snapshot for a new write after GitHub unbinding',async()=>{
  const coauthor:Coauthor={github_id:123,binding_version:'old-binding',name:'Example',email:'verified@example.com',consent_version:'v1'};
  const rev=await seed('git',coauthor);
  const c:GitCandidate={revision_id:rev,uid,page_id:'contributing',content:candidate,base_blob_sha:blobSha,coauthor,sources:[{title:'Evidence',url:'https://example.com',level:'tested'}]};
  const fixture=githubFixture(db,c,null);
  await new Coordinator(fixture.env,new GitHub(fixture.env,fixture.http)).run(1);
  expect(fixture.remote.message).not.toContain('Co-authored-by');
  expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(rev)!.status).toBe('git_pr_open');
});
it.each(['ref','pull'] as const)('recovers lost %s responses after coauthor revocation through the real Git adapter',async loss=>{
  const coauthor:Coauthor={github_id:123,binding_version:'original-binding',name:'Example',email:'verified@example.com',consent_version:'v1'};
  db.sql.prepare('INSERT INTO github_identities(uid,github_numeric_id,login,coauthor_email,enabled,binding_version,consent_version,consent_at) VALUES(?,?,?,?,1,?,?,?)').run(uid,coauthor.github_id,coauthor.name,coauthor.email,coauthor.binding_version,coauthor.consent_version,now());
  const rev=await seed('git',coauthor);
  const c:GitCandidate={revision_id:rev,uid,page_id:'contributing',content:candidate,base_blob_sha:blobSha,coauthor,sources:[{title:'Evidence',url:'https://example.com',level:'tested'}]};
  const fixture=githubFixture(db,c,loss);
  await new Coordinator(fixture.env,new GitHub(fixture.env,fixture.http)).run(1);
  expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(rev)!.status).toBe('retryable_error');
  expect(fixture.remote.message).toContain('Co-authored-by: Example <verified@example.com>');
  expect(db.sql.prepare('SELECT count(*) AS n FROM git_links').get()!.n).toBe(0);
  db.sql.prepare('UPDATE github_identities SET enabled=0,binding_version=? WHERE uid=?').run('revoked-binding',uid);
  db.sql.prepare('UPDATE publish_jobs SET next_attempt_at=? WHERE revision_id=?').run(now()-1,rev);
  await new Coordinator(fixture.env,new GitHub(fixture.env,fixture.http)).run(1);
  expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(rev)!.status).toBe('git_pr_open');
  expect(db.sql.prepare('SELECT stage,last_error FROM publish_jobs WHERE revision_id=?').get(rev)).toMatchObject({stage:'pr',last_error:null});
  expect(db.sql.prepare('SELECT content_commit_sha FROM git_links WHERE revision_id=?').get(rev)!.content_commit_sha).toBe(fixture.remote.branch);
  expect(fixture.counts).toEqual({commits:1,refs:1,pulls:1});
  expect(db.sql.prepare('SELECT coauthor_json FROM submission_content WHERE revision_id=?').get(rev)!.coauthor_json).toBe(JSON.stringify(coauthor));
});
it('leases work exclusively and cannot create a second job/PR under overlapping runners',async()=>{
  const rev=await seed(),port=git();let release:()=>void=()=>{};const pending=new Promise<void>(resolve=>{release=resolve;});
  vi.mocked(port.ensurePull).mockImplementation(async c=>{await pending;return {branch:`wiki/${c.revision_id}`,content_commit_sha:contentSha,pr_number:1};});
  const env=db.env({PUBLISH_ENABLED:'true'}),first=new Coordinator(env,port).run(1);
  await vi.waitFor(()=>expect(port.ensurePull).toHaveBeenCalledTimes(1));await new Coordinator(env,port).run(1);expect(port.ensurePull).toHaveBeenCalledTimes(1);
  release();await first;expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(rev)!.status).toBe('git_pr_open');expect(db.sql.prepare('SELECT count(*) AS n FROM publish_jobs').get()!.n).toBe(1);
});
it('recovers the saved original commit after interruption and a maintainer merge of main into the PR',async()=>{
  const rev=await seed();
  const c:GitCandidate={revision_id:rev,uid,page_id:'contributing',content:candidate,base_blob_sha:blobSha,coauthor:null,sources:[{title:'Evidence',url:'https://example.com',level:'tested'}]};
  const fixture=githubFixture(db,c,null),git=new GitHub(fixture.env,fixture.http);
  const link=await git.ensurePull(c);
  // The link was durable, but advancing the job failed/crashed.
  db.sql.prepare('INSERT INTO git_links VALUES(?,?,?,?,NULL)').run(rev,link.branch,link.pr_number,link.content_commit_sha);
  fixture.remote.branch='f'.repeat(40);fixture.remote.message='Merge main into wiki PR';fixture.remote.parentCount=2;
  await new Coordinator(fixture.env,new GitHub(fixture.env,fixture.http)).run(1);
  expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(rev)!.status).toBe('git_pr_open');
  expect(db.sql.prepare('SELECT stage,last_error FROM publish_jobs WHERE revision_id=?').get(rev)).toMatchObject({stage:'pr',last_error:null});
  expect(db.sql.prepare('SELECT content_commit_sha FROM git_links WHERE revision_id=?').get(rev)!.content_commit_sha).toBe(link.content_commit_sha);
  expect(fixture.counts).toEqual({commits:1,refs:1,pulls:1});
});
it('fences stale completion after a lease has been reassigned',async()=>{
  const rev=await seed(),port=git();vi.mocked(port.ensurePull).mockImplementation(async c=>{db.sql.prepare('UPDATE publish_jobs SET lease_token=?,lease_until=? WHERE revision_id=?').run(crypto.randomUUID(),now()+600,rev);return {branch:`wiki/${c.revision_id}`,content_commit_sha:contentSha,pr_number:1};});
  await new Coordinator(db.env({PUBLISH_ENABLED:'true'}),port).run(1);expect(db.sql.prepare('SELECT count(*) AS n FROM git_links').get()!.n).toBe(0);expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(rev)!.status).toBe('git_pending');
});
it('preserves the submitted snapshot and routes stale content to manual conflict review',async()=>{
  const rev=await seed(),port=git();vi.mocked(port.ensurePull).mockRejectedValue(new GitError('STALE_BASE',409));
  await new Coordinator(db.env({PUBLISH_ENABLED:'true'}),port).run(1);expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(rev)!.status).toBe('conflict');expect(db.sql.prepare('SELECT content FROM submission_content WHERE revision_id=?').get(rev)!.content).toBe(candidate);
});
it('never treats a merge or an old CDN version as publication',async()=>{
  const rev=await seed('deploy'),port=git();receipt();vi.mocked(port.contains).mockResolvedValue(false);
  await new Coordinator(db.env({PUBLISH_ENABLED:'true'}),port,online()).run(1);expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(rev)!.status).toBe('retryable_error');expect(db.sql.prepare('SELECT count(*) AS n FROM publication_events').get()!.n).toBe(0);
});
it('confirms a later descendant release that includes the immutable content commit',async()=>{
  const rev=await seed('deploy'),port=git();receipt();await new Coordinator(db.env({PUBLISH_ENABLED:'true'}),port,online()).run(1);
  expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(rev)!.status).toBe('published');expect(db.sql.prepare('SELECT stage FROM publish_jobs WHERE revision_id=?').get(rev)!.stage).toBe('done');expect(port.contains).toHaveBeenCalledWith(mergeSha,releaseSha);expect(port.contains).toHaveBeenCalledWith(contentSha,releaseSha);
});
it('requires a durable signed receipt even when the public version appears correct',async()=>{
  const rev=await seed('deploy');await new Coordinator(db.env({PUBLISH_ENABLED:'true'}),git(),online()).run(1);
  expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(rev)!.status).toBe('retryable_error');expect(db.sql.prepare('SELECT last_error FROM publish_jobs WHERE revision_id=?').get(rev)!.last_error).toBe('TRUSTED_RECEIPT_PENDING');
});
it('rejects a changed PR snapshot even when the original commit remains in ancestry',async()=>{
  const rev=await seed('pr'),port=git();vi.mocked(port.pullState).mockResolvedValue({merged:true,merge_sha:mergeSha,closed:true,head_sha:contentSha});vi.mocked(port.readPage).mockResolvedValue({commit_sha:mergeSha,blob_sha:'f'.repeat(40),content:'# Tampered'});
  await new Coordinator(db.env({PUBLISH_ENABLED:'true'}),port).run(1);expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(rev)!.status).toBe('conflict');
});
it('records rollback as a separate event while retaining the original published record',async()=>{
  const rev=await seed('deploy'),port=git();receipt();const worker=new Coordinator(db.env({PUBLISH_ENABLED:'true'}),port,online());await worker.run(1);vi.mocked(port.contains).mockResolvedValue(false);await worker.reconcilePublished();
  expect(db.sql.prepare('SELECT status FROM submissions WHERE revision_id=?').get(rev)!.status).toBe('published');expect(db.sql.prepare("SELECT count(*) AS n FROM publication_events WHERE action='withdrawn'").get()!.n).toBe(1);
});
async function published(count:number) {
  const revisions:string[]=[];
  for(let i=0;i<count;i++) {
    const rev=await seed('deploy');revisions.push(rev);
    db.sql.prepare("UPDATE submissions SET status='published',created_at=?,updated_at=? WHERE revision_id=?").run(i+1,i+1,rev);
    db.sql.prepare("UPDATE publish_jobs SET stage='done' WHERE revision_id=?").run(rev);
    db.sql.prepare('UPDATE git_links SET merge_sha=? WHERE revision_id=?').run(i.toString(16).padStart(40,'0'),rev);
  }
  return revisions;
}
it('checks all 101 publications across bounded scans, including the oldest after restart',async()=>{
  const revisions=await published(101),port=git(),seen=new Set<string>();receipt();
  vi.mocked(port.contains).mockImplementation(async sha=>{seen.add(sha);return sha!=='0'.repeat(40);});
  const env=db.env({PUBLISH_ENABLED:'true'});
  for(let i=0;i<11;i++)await new Coordinator(env,port,online()).reconcilePublished();
  expect(seen.size).toBe(101);
  expect(db.sql.prepare("SELECT revision_id FROM publication_events WHERE action='withdrawn'").all()).toEqual([{revision_id:revisions[0]}]);
});
it('resumes the persisted cursor after closing and reopening the database',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'rocowiki-scan-')),file=join(directory,'state.sqlite');
  db.close();db=new TestDatabase(file);
  try {
    db.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run(uid,uid,'Test',now());
    await published(12);receipt();const port=git();vi.mocked(port.contains).mockResolvedValue(false);
    await new Coordinator(db.env({PUBLISH_ENABLED:'true'}),port,online()).reconcilePublished();
    expect(db.sql.prepare('SELECT cursor_created_at FROM publication_reconciliation').get()!.cursor_created_at).toBe(10);
    db.close();db=new TestDatabase(file,false);
    await new Coordinator(db.env({PUBLISH_ENABLED:'true'}),port,online()).reconcilePublished();
    expect(db.sql.prepare('SELECT count(*) AS n FROM publication_events').get()!.n).toBe(12);
    expect(db.sql.prepare('SELECT completed_passes FROM publication_reconciliation').get()!.completed_passes).toBe(1);
    expect(port.contains).toHaveBeenCalledTimes(12);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
it('finishes a fixed sweep while new publications arrive, then wraps around to include them',async()=>{
  await published(11);receipt();const port=git(),env=db.env({PUBLISH_ENABLED:'true'});
  await new Coordinator(env,port,online()).reconcilePublished();
  const end=db.sql.prepare('SELECT end_revision_id FROM publication_reconciliation').get()!.end_revision_id;
  const newest=await seed('deploy');
  db.sql.prepare("UPDATE submissions SET status='published',created_at=1000,updated_at=1000 WHERE revision_id=?").run(newest);
  db.sql.prepare('UPDATE git_links SET merge_sha=? WHERE revision_id=?').run('9'.repeat(40),newest);
  await new Coordinator(env,port,online()).reconcilePublished();
  expect(port.contains).toHaveBeenCalledTimes(11);
  expect(db.sql.prepare('SELECT end_revision_id,completed_passes FROM publication_reconciliation').get()).toMatchObject({end_revision_id:null,completed_passes:1});
  expect(end).not.toBe(newest);
  for(let i=0;i<2;i++)await new Coordinator(env,port,online()).reconcilePublished();
  expect(port.contains).toHaveBeenCalledWith('9'.repeat(40),releaseSha);
});
it('does not lose records with the same timestamp',async()=>{
  await published(4);receipt();db.sql.prepare('UPDATE submissions SET created_at=1,updated_at=1').run();
  const port=git(),env=db.env({PUBLISH_ENABLED:'true'});
  for(let i=0;i<4;i++)await new Coordinator(env,port,online()).reconcilePublished(1);
  expect(new Set(vi.mocked(port.contains).mock.calls.map(call=>call[0])).size).toBe(4);
  expect(db.sql.prepare('SELECT completed_passes FROM publication_reconciliation').get()!.completed_passes).toBe(1);
});
it('preserves scan progress when the verified release changes, then checks earlier records on the next pass',async()=>{
  await published(12);receipt();const port=git(),env=db.env({PUBLISH_ENABLED:'true'});
  await new Coordinator(env,port,online()).reconcilePublished();
  const next={...version,release_id:'next-release',source_commit_sha:'9'.repeat(40)};
  db.sql.prepare("INSERT INTO deployments VALUES(?,?,?,'production','reported',?,NULL)").run(next.release_id,next.source_commit_sha,next.artifact_digest,now());
  await new Coordinator(env,port,online(next)).reconcilePublished();
  expect(port.contains).toHaveBeenCalledWith((10).toString(16).padStart(40,'0'),next.source_commit_sha);
  expect(port.contains).not.toHaveBeenCalledWith('0'.repeat(40),next.source_commit_sha);
  expect(db.sql.prepare('SELECT release_id,cursor_created_at,completed_passes FROM publication_reconciliation').get()).toMatchObject({release_id:next.release_id,cursor_created_at:null,completed_passes:1});
  await new Coordinator(env,port,online(next)).reconcilePublished();
  expect(port.contains).toHaveBeenCalledWith('0'.repeat(40),next.source_commit_sha);
});
it('does not starve later publications when every batch observes a different trusted release',async()=>{
  await published(101);const port=git(),env=db.env({PUBLISH_ENABLED:'true'}),seen=new Set<string>();
  vi.mocked(port.contains).mockImplementation(async sha=>{seen.add(sha);return true;});
  for(let i=0;i<11;i++){
    const current={...version,release_id:`release-${i}`,source_commit_sha:i.toString(16).padStart(40,'0')};
    db.sql.prepare("INSERT INTO deployments VALUES(?,?,?,'production','reported',?,NULL)").run(current.release_id,current.source_commit_sha,current.artifact_digest,now());
    await new Coordinator(env,port,online(current)).reconcilePublished();
  }
  expect(seen.size).toBe(101);
  expect(db.sql.prepare('SELECT completed_passes FROM publication_reconciliation').get()!.completed_passes).toBe(1);
});
it('isolates a transient record failure, advances the sweep and durably retries the failed record',async()=>{
  const revisions=await published(3);receipt();const port=git(),env=db.env({PUBLISH_ENABLED:'true'});
  vi.mocked(port.contains).mockResolvedValueOnce(false).mockRejectedValueOnce(Error('upstream unavailable')).mockResolvedValueOnce(true);
  await new Coordinator(env,port,online()).reconcilePublished();
  expect(port.contains).toHaveBeenCalledTimes(3);
  expect(db.sql.prepare('SELECT count(*) AS n FROM publication_events').get()!.n).toBe(1);
  expect(db.sql.prepare('SELECT revision_id,error_code FROM publication_reconciliation_errors').get()).toMatchObject({revision_id:revisions[1],error_code:'UPSTREAM_READ_RETRYING'});
  expect(db.sql.prepare('SELECT cursor_revision_id,lease_token FROM publication_reconciliation').get()).toMatchObject({cursor_revision_id:null,lease_token:null});
  vi.mocked(port.contains).mockResolvedValue(false);
  db.sql.prepare('UPDATE publication_reconciliation_errors SET next_attempt_at=?').run(now()-1);
  await new Coordinator(env,port,online()).reconcilePublished();
  expect(db.sql.prepare('SELECT count(*) AS n FROM publication_events').get()!.n).toBe(3);
  expect(db.sql.prepare('SELECT count(*) AS n FROM publication_reconciliation_errors').get()!.n).toBe(0);
});
it('records a confirmed deletion and still checks the next article on repeated scans',async()=>{
  const revisions=await published(2);receipt();const port=git(),env=db.env({PUBLISH_ENABLED:'true'});
  vi.mocked(port.readPage).mockRejectedValueOnce(new GitError('PAGE_DELETED',404)).mockResolvedValue({commit_sha:releaseSha,blob_sha:blobSha,content:candidate});
  await new Coordinator(env,port,online()).reconcilePublished();
  expect(db.sql.prepare('SELECT revision_id FROM publication_events').get()!.revision_id).toBe(revisions[0]);
  expect(port.contains).toHaveBeenCalledWith('1'.padStart(40,'0'),releaseSha);
  await new Coordinator(env,port,online()).reconcilePublished();
  expect(port.contains).toHaveBeenCalledTimes(4);
  expect(db.sql.prepare('SELECT count(*) AS n FROM publication_reconciliation_errors').get()!.n).toBe(0);
});
it.each([
  [new GitError('GITHUB_REQUEST_FAILED',404),'GIT_PAGE_LOOKUP_UNCONFIRMED'],
  [new GitError('GITHUB_PERMISSION_DENIED',403),'GITHUB_PERMISSION_DENIED'],
  [new GitError('GITHUB_RATE_LIMITED',429),'GITHUB_RATE_LIMITED'],
] as const)('does not treat %s as deletion or prevent later record checks',async(error,code)=>{
  const revisions=await published(2);receipt();const port=git(),env=db.env({PUBLISH_ENABLED:'true'});
  vi.mocked(port.readPage).mockRejectedValueOnce(error).mockResolvedValue({commit_sha:releaseSha,blob_sha:blobSha,content:candidate});
  await new Coordinator(env,port,online()).reconcilePublished();
  expect(db.sql.prepare('SELECT count(*) AS n FROM publication_events').get()!.n).toBe(0);
  expect(db.sql.prepare('SELECT revision_id,error_code,attempts FROM publication_reconciliation_errors').get()).toMatchObject({revision_id:revisions[0],error_code:code,attempts:1});
  await new Coordinator(env,port,online()).reconcilePublished();
  expect(port.readPage).toHaveBeenCalledTimes(3);
  expect(db.sql.prepare('SELECT attempts FROM publication_reconciliation_errors').get()!.attempts).toBe(1);
});
it('commits rollback events and scan progress in the same transaction',async()=>{
  await published(1);receipt();const port=git(),env=db.env({PUBLISH_ENABLED:'true'});vi.mocked(port.contains).mockResolvedValue(false);
  db.sql.exec("CREATE TRIGGER fail_scan BEFORE UPDATE OF completed_passes ON publication_reconciliation WHEN NEW.completed_passes>OLD.completed_passes BEGIN SELECT RAISE(ABORT,'simulated cursor failure'); END;");
  await expect(new Coordinator(env,port,online()).reconcilePublished()).rejects.toThrow('simulated cursor failure');
  expect(db.sql.prepare('SELECT count(*) AS n FROM publication_events').get()!.n).toBe(0);
  expect(db.sql.prepare('SELECT completed_passes,cursor_revision_id FROM publication_reconciliation').get()).toMatchObject({completed_passes:0,cursor_revision_id:null});
  db.sql.exec('DROP TRIGGER fail_scan');
  await new Coordinator(env,port,online()).reconcilePublished();
  expect(db.sql.prepare('SELECT count(*) AS n FROM publication_events').get()!.n).toBe(1);
});
it('does not drop a failed record if the retry ledger and cursor transaction is interrupted',async()=>{
  await published(2);receipt();const port=git(),env=db.env({PUBLISH_ENABLED:'true'});
  vi.mocked(port.contains).mockResolvedValueOnce(false).mockRejectedValueOnce(Error('temporary error'));
  db.sql.exec("CREATE TRIGGER fail_scan BEFORE UPDATE OF completed_passes ON publication_reconciliation WHEN NEW.completed_passes>OLD.completed_passes BEGIN SELECT RAISE(ABORT,'interrupted transaction'); END;");
  await expect(new Coordinator(env,port,online()).reconcilePublished()).rejects.toThrow('interrupted transaction');
  expect(db.sql.prepare('SELECT count(*) AS n FROM publication_events').get()!.n).toBe(0);
  expect(db.sql.prepare('SELECT count(*) AS n FROM publication_reconciliation_errors').get()!.n).toBe(0);
  expect(db.sql.prepare('SELECT cursor_revision_id FROM publication_reconciliation').get()!.cursor_revision_id).toBeNull();
  db.sql.exec('DROP TRIGGER fail_scan');vi.mocked(port.contains).mockResolvedValue(false);
  await new Coordinator(env,port,online()).reconcilePublished();
  expect(db.sql.prepare('SELECT count(*) AS n FROM publication_events').get()!.n).toBe(2);
});
it('leases overlapping reconciliation exclusively',async()=>{
  await published(1);receipt();const port=git(),env=db.env({PUBLISH_ENABLED:'true'});
  let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});
  vi.mocked(port.contains).mockImplementation(async()=>{await barrier;return false;});
  const first=new Coordinator(env,port,online()).reconcilePublished();
  await vi.waitFor(()=>expect(port.contains).toHaveBeenCalledTimes(1));
  await new Coordinator(env,port,online()).reconcilePublished();expect(port.contains).toHaveBeenCalledTimes(1);
  release();await first;expect(db.sql.prepare('SELECT count(*) AS n FROM publication_events').get()!.n).toBe(1);
});
it('fences stale reconciliation after its lease was reassigned',async()=>{
  await published(1);receipt();const port=git(),env=db.env({PUBLISH_ENABLED:'true'});
  vi.mocked(port.contains).mockImplementation(async()=>{db.sql.prepare('UPDATE publication_reconciliation SET lease_token=?,lease_until=?').run('new-owner',now()+600);return false;});
  await new Coordinator(env,port,online()).reconcilePublished();
  expect(db.sql.prepare('SELECT count(*) AS n FROM publication_events').get()!.n).toBe(0);
  expect(db.sql.prepare('SELECT lease_token,completed_passes FROM publication_reconciliation').get()).toMatchObject({lease_token:'new-owner',completed_passes:0});
});
