import {it,expect} from 'vitest';
import {TestDatabase} from './d1';
import {newId,now,hash} from '../packages/auth/src/index';
import {readFileSync} from 'node:fs';
it('adds durable reconciliation state to an existing schema without changing existing identities',()=>{
  const legacy=new TestDatabase(':memory:',false),uid=newId('usr');
  try {
    for(const file of ['0001_initial.sql','0002_mirror.sql'])legacy.sql.exec(readFileSync(`database/migrations/${file}`,'utf8'));
    legacy.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run(uid,uid,'Existing user',now());
    legacy.sql.exec(readFileSync('database/migrations/0003_publication_reconciliation.sql','utf8'));
    expect(legacy.sql.prepare('SELECT uid FROM users').get()!.uid).toBe(uid);
    expect(legacy.sql.prepare('SELECT count(*) AS n FROM publication_reconciliation').get()!.n).toBe(0);
    expect(legacy.sql.prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok');
    expect(legacy.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  } finally {legacy.close();}
});
it('resets legacy recent-authentication timestamps without deleting existing sessions or drafts',()=>{
  const legacy=new TestDatabase(':memory:',false),uid=newId('usr');
  try {
    for(const file of ['0001_initial.sql','0002_mirror.sql','0003_publication_reconciliation.sql'])legacy.sql.exec(readFileSync(`database/migrations/${file}`,'utf8'));
    legacy.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run(uid,uid,'Existing user',now());
    legacy.sql.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,NULL)').run('session-hash',uid,'csrf-hash',now(),now(),now()+1000);
    legacy.sql.prepare('INSERT INTO drafts VALUES(?,?,?,?,?)').run('draft-existing',uid,'contributing','{}',now());
    for(const file of ['0004_verified_authentication_time.sql','0005_reconciliation_record_errors.sql'])legacy.sql.exec(readFileSync(`database/migrations/${file}`,'utf8'));
    expect(legacy.sql.prepare('SELECT uid,authenticated_at,revoked_at FROM sessions').get()).toMatchObject({uid,authenticated_at:0,revoked_at:null});
    expect(legacy.sql.prepare('SELECT count(*) AS n FROM drafts').get()!.n).toBe(1);
    expect(legacy.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  } finally {legacy.close();}
});
it('restores identities, immutable snapshots, outbox and audit constraints from an independent SQL export',async()=>{
  const source=new TestDatabase(),uid=newId('usr'),rev=newId('rev');
  source.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run(uid,uid,'Test',now());
  source.sql.prepare('INSERT INTO oidc_identities VALUES(?,?,?)').run('https://issuer.example','subject',uid);
  source.sql.prepare("INSERT INTO submissions(revision_id,uid,page_id,snapshot_hash,status,edit_summary,required_reviews,idempotency_key,request_hash,created_at,updated_at) VALUES(?,?,'contributing',?,'pending_review','Recover test',1,?,?,?,?)").run(rev,uid,await hash('# Snapshot'),'restore-request','requesthash',now(),now());
  source.sql.prepare('INSERT INTO submission_content VALUES(?,?,?,?,?,?,?)').run(rev,'# Snapshot','# Base','a'.repeat(40),'b'.repeat(40),'[]',null);
  source.sql.prepare("UPDATE submissions SET status='approved' WHERE revision_id=?").run(rev);
  const objects=source.sql.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
  const quote=(v:unknown)=>v===null?'NULL':typeof v==='number'||typeof v==='bigint'?String(v):`'${String(v).replace(/'/g,"''")}'`;
  const tables=objects.filter(o=>o.type==='table'),statements=tables.map(t=>String(t.sql)+';');
  for(const t of tables)for(const row of source.sql.prepare(`SELECT * FROM "${t.name}"`).all())statements.push(`INSERT INTO "${t.name}" VALUES(${Object.values(row).map(quote).join(',')});`);
  statements.push(...objects.filter(o=>o.type!=='table').map(o=>String(o.sql)+';'));
  const exported='PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n'+statements.join('\n')+'\nCOMMIT;';source.close();
  const restored=new TestDatabase(':memory:',false);
  restored.sql.exec(exported);restored.sql.exec('PRAGMA foreign_keys=ON');
  expect(restored.sql.prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok');expect(restored.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  expect(restored.sql.prepare('SELECT uid FROM oidc_identities').get()!.uid).toBe(uid);expect(restored.sql.prepare('SELECT content FROM submission_content WHERE revision_id=?').get(rev)!.content).toBe('# Snapshot');expect(restored.sql.prepare('SELECT revision_id FROM publish_jobs').get()!.revision_id).toBe(rev);
  expect(()=>restored.sql.prepare("UPDATE submission_content SET content='changed'").run()).toThrow('immutable snapshot');restored.close();
});
