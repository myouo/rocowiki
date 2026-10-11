import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import * as oidc from 'openid-client';
import {generateKeyPair,SignJWT} from 'jose';
import {TestDatabase} from './d1';
import {finishOidc,beginOidc,createSession,getSession,hash,newId,now} from '../packages/auth/src/index';
import {requireRecent} from '../apps/api/src/github-binding';
import {app} from '../apps/api/src/index';
vi.mock('openid-client',async original=>({...await original<typeof import('openid-client')>(),discovery:vi.fn()}));
let db:TestDatabase;
beforeEach(()=>{db=new TestDatabase();});
afterEach(()=>{vi.clearAllMocks();vi.useRealTimers();db.close();});
const request=new Request('http://localhost:8787/auth/callback?state=state&code=code');
const state={uid:null,session_hash:null,verifier:'verifier',nonce:'nonce'};
async function provider(authTime:unknown) {
  const env=db.env({OIDC_ISSUER:'https://issuer.test',OIDC_CLIENT_ID:'client',OIDC_CLIENT_SECRET:'secret'});
  const config=new oidc.Configuration({issuer:env.OIDC_ISSUER,authorization_endpoint:'https://issuer.test/authorize',token_endpoint:'https://issuer.test/token'},'client','secret');
  const {privateKey}=await generateKeyPair('RS256');
  const token=await new SignJWT({sub:'subject',nonce:'nonce',email:'private@example.com',email_verified:true,...(authTime===undefined?{}:{auth_time:authTime})})
    .setProtectedHeader({alg:'RS256'}).setIssuer(env.OIDC_ISSUER).setAudience('client').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const http=vi.fn(async(input:RequestInfo|URL)=>{
    expect(String(input)).toBe('https://issuer.test/token');
    return Response.json({access_token:'access',token_type:'Bearer',id_token:token});
  });
  config[oidc.customFetch]=http;vi.mocked(oidc.discovery).mockResolvedValue(config);
  return {env,http};
}
it.each([undefined,now()-86400,'123',-1,1.5,now()+3600])('rejects invalid provider authentication time with the real grant implementation: %s',async authTime=>{
  const {env,http}=await provider(authTime);
  await expect(finishOidc(env,request,state)).rejects.toThrow('INVALID_OIDC_TOKEN');
  expect(http).toHaveBeenCalledTimes(1);
  expect(db.sql.prepare('SELECT count(*) AS n FROM users').get()!.n).toBe(0);
  expect(db.sql.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(0);
});
it('persists provider auth_time instead of granting a new ten-minute window at callback arrival',async()=>{
  const authenticatedAt=now()-480,{env}=await provider(authenticatedAt);
  const session=await finishOidc(env,request,state);
  const row=db.sql.prepare('SELECT authenticated_at,created_at FROM sessions').get()!;
  expect(row.authenticated_at).toBe(authenticatedAt);expect(Number(row.created_at)).toBeGreaterThan(authenticatedAt);
  const authenticated=await getSession(new Request('http://localhost:8787/me',{headers:{Cookie:`roco_session=${session.token}`}}),env);
  expect(()=>requireRecent(authenticated!)).not.toThrow();
  vi.useFakeTimers();vi.setSystemTime((authenticatedAt+601)*1000);
  expect(()=>requireRecent(authenticated!)).toThrow('REAUTH_REQUIRED');
});
it('rejects an old SSO token during reauthentication even without prompt/max_age on the callback URL',async()=>{
  const {env}=await provider(now()-86400),uid=newId('usr');
  db.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run(uid,uid,'Test',now());
  db.sql.prepare('INSERT INTO oidc_identities VALUES(?,?,?)').run(env.OIDC_ISSUER,'subject',uid);
  const previous=await createSession(env,uid,now()-3600),sessionHash=await hash(previous.token);
  await expect(finishOidc(env,request,{...state,uid,session_hash:sessionHash})).rejects.toThrow('INVALID_OIDC_TOKEN');
  expect(db.sql.prepare('SELECT revoked_at FROM sessions WHERE id_hash=?').get(sessionHash)!.revoked_at).toBeNull();
  expect(db.sql.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(1);
});
it('requests max_age and enforces fresh reauthentication through the library',async()=>{
  const {env}=await provider(now()-60),uid=newId('usr');
  db.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run(uid,uid,'Test',now());
  db.sql.prepare('INSERT INTO oidc_identities VALUES(?,?,?)').run(env.OIDC_ISSUER,'subject',uid);
  const previous=await createSession(env,uid,now()-3600),sessionHash=await hash(previous.token);
  const session=await getSession(new Request('http://localhost:8787/me',{headers:{Cookie:`roco_session=${previous.token}`}}),env);
  expect(new URL((await beginOidc(env,null)).url).searchParams.get('max_age')).toBe('600');
  const reauth=new URL((await beginOidc(env,session)).url);
  expect(reauth.searchParams.get('max_age')).toBe('0');expect(reauth.searchParams.get('prompt')).toBe('login');
  await expect(finishOidc(env,request,{...state,uid,session_hash:sessionHash})).rejects.toThrow('INVALID_OIDC_TOKEN');
});
it('returns authentication failure at the real callback API without issuing a session',async()=>{
  const {env}=await provider(now()-86400),browser='browser';
  db.sql.prepare("INSERT INTO oauth_states(state_hash,provider,browser_hash,verifier,nonce,expires_at) VALUES(?,'oidc',?,?,?,?)").run(await hash('state'),await hash(browser),'verifier','nonce',now()+600);
  const response=await app.fetch(new Request(request,{headers:{Cookie:`roco_oidc=${browser}`}}),env);
  expect(response.status).toBe(401);expect(response.headers.get('Set-Cookie')).toBeNull();
  expect(await response.json()).toMatchObject({error:{code:'INVALID_OIDC_TOKEN'}});
});
it('accepts recent provider authentication for the same UID and replaces the old session at the callback',async()=>{
  const authenticatedAt=now()-5,{env}=await provider(authenticatedAt),uid=newId('usr');
  db.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run(uid,uid,'Test',now());
  db.sql.prepare('INSERT INTO oidc_identities VALUES(?,?,?)').run(env.OIDC_ISSUER,'subject',uid);
  const previous=await createSession(env,uid,now()-3600),previousHash=await hash(previous.token),browser='browser';
  db.sql.prepare("INSERT INTO oauth_states(state_hash,provider,uid,session_hash,browser_hash,verifier,nonce,expires_at) VALUES(?,'oidc',?,?,?,?,?,?)").run(await hash('state'),uid,previousHash,await hash(browser),'verifier','nonce',now()+600);
  const response=await app.fetch(new Request(request,{headers:{Cookie:`roco_oidc=${browser}; roco_session=${previous.token}`}}),env);
  expect(response.status).toBe(302);expect(response.headers.get('Set-Cookie')).toContain('roco_session=');
  expect(db.sql.prepare('SELECT uid,authenticated_at FROM sessions WHERE revoked_at IS NULL').get()).toMatchObject({uid,authenticated_at:authenticatedAt});
  expect(db.sql.prepare('SELECT revoked_at FROM sessions WHERE id_hash=?').get(previousHash)!.revoked_at).not.toBeNull();
  expect(db.sql.prepare('SELECT count(*) AS n FROM users').get()!.n).toBe(1);
});
