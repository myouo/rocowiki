import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {TestDatabase} from './d1';
import {now,newId,hash,createSession,consumeState,finishOidc} from '../packages/auth/src/index';
import {currentCoauthor} from '../packages/publish-coordinator/src/index';
import * as oidc from 'openid-client';
vi.mock('openid-client',async importOriginal=>{
  const actual=await importOriginal<typeof import('openid-client')>();
  return {...actual,discovery:vi.fn(),authorizationCodeGrant:vi.fn()};
});
let db:TestDatabase;
beforeEach(()=>{db=new TestDatabase();});afterEach(()=>{vi.clearAllMocks();db.close();});
it('consumes browser/session-bound OAuth state once, refusing callback replay',async()=>{
  const uid=newId('usr');db.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run(uid,uid,'Test',now());
  const env=db.env(),session=await createSession(env,uid,now()),state='one-time-state',browser='browser-secret';
  db.sql.prepare("INSERT INTO oauth_states(state_hash,provider,uid,session_hash,browser_hash,verifier,nonce,expires_at) VALUES(?,'github',?,?,?,?,?,?)").run(await hash(state),uid,await hash(session.token),await hash(browser),'verifier','nonce',now()+100);
  const request=new Request(`http://localhost:8787/auth/github/callback?state=${state}`,{headers:{Cookie:`roco_session=${session.token}; roco_github=${browser}`}});
  expect((await consumeState(env,request,'github')).uid).toBe(uid);await expect(consumeState(env,request,'github')).rejects.toThrow('INVALID_OAUTH_STATE');
});
it('refuses expired OAuth state and a state from another browser',async()=>{
  const env=db.env();db.sql.prepare("INSERT INTO oauth_states(state_hash,provider,browser_hash,verifier,nonce,expires_at) VALUES(?,'oidc',?,?,?,?)").run(await hash('state'),await hash('browser'),'verifier','nonce',now()-1);
  await expect(consumeState(env,new Request('http://localhost:8787/auth/callback?state=state',{headers:{Cookie:'roco_oidc=browser'}}),'oidc')).rejects.toThrow('INVALID_OAUTH_STATE');
});
it('requires verified email and maps a returning OIDC subject to its existing Wiki UID',async()=>{
  const env=db.env({OIDC_ISSUER:'https://issuer.example',OIDC_CLIENT_ID:'test',OIDC_CLIENT_SECRET:'test'});
  const grant=vi.mocked(oidc.authorizationCodeGrant),state={uid:null,session_hash:null,verifier:'verifier',nonce:'nonce'},request=new Request('http://localhost:8787/auth/callback?state=state&code=code');
  // Mock only the provider/library boundary; account/session persistence uses real SQLite.
  const tokens=(verified:boolean)=>Object.defineProperties({access_token:'test',token_type:'bearer'}, {expiresIn:{value:()=>100},claims:{value:()=>({iss:env.OIDC_ISSUER,aud:'test',iat:now(),auth_time:now(),exp:now()+100,sub:'subject',email:'private@example.com',email_verified:verified,name:'Contributor'})}}) as Awaited<ReturnType<typeof oidc.authorizationCodeGrant>>;
  grant.mockResolvedValue(tokens(false));
  await expect(finishOidc(env,request,state)).rejects.toThrow('VERIFIED_EMAIL_REQUIRED');
  grant.mockResolvedValue(tokens(true));
  const first=await finishOidc(env,request,state),second=await finishOidc(env,request,state);
  expect(first.token).not.toBe(second.token);expect(db.sql.prepare('SELECT count(*) AS n FROM users').get()!.n).toBe(1);
  expect(JSON.stringify(db.sql.prepare('SELECT * FROM users').all())).not.toContain('private@example.com');
});
it('prevents GitHub identity takeover at the database boundary and clears future coauthor consent',async()=>{
  const a=newId('usr'),b=newId('usr');for(const uid of[a,b])db.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run(uid,uid,'Test',now());
  const binding=crypto.randomUUID();db.sql.prepare('INSERT INTO github_identities(uid,github_numeric_id,login,coauthor_email,enabled,binding_version,consent_version,consent_at) VALUES(?,?,?,?,1,?,?,?)').run(a,123,'example','verified@example.com',binding,'v1',now());
  expect(()=>db.sql.prepare('INSERT INTO github_identities(uid,github_numeric_id,login,binding_version) VALUES(?,?,?,?)').run(b,123,'example',crypto.randomUUID())).toThrow();
  const snapshot={github_id:123,binding_version:binding,name:'example',email:'verified@example.com',consent_version:'v1'};
  expect(await currentCoauthor(db.env(),a,snapshot)).toEqual(snapshot);
  db.sql.prepare('UPDATE github_identities SET enabled=0 WHERE uid=?').run(a);expect(await currentCoauthor(db.env(),a,snapshot)).toBeNull();
  db.sql.prepare('DELETE FROM github_identities WHERE uid=?').run(a);expect(await currentCoauthor(db.env(),a,snapshot)).toBeNull();
});
