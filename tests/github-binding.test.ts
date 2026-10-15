// SPDX-License-Identifier: GPL-3.0-only
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {app} from '../apps/api/src/index';
import {createSession,hash,now} from '../packages/auth/src/index';
import {TestDatabase} from './d1';
import type {ApiEnv} from '../apps/api/src/types';

let db:TestDatabase,env:ApiEnv,session:{token:string;csrf:string};
beforeEach(async()=>{
  db=new TestDatabase();env=db.env({GITHUB_OAUTH_CLIENT_ID:'synthetic-client-id',GITHUB_OAUTH_CLIENT_SECRET:'synthetic-client-secret'});
  db.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run('usr_binding','binding','测试洛克',now());
  session=await createSession(env,'usr_binding',now());
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();db.close();});
function request(path:string,method='GET',browser='',auth=session){
  return app.request('http://localhost:8787'+path,{method,headers:{Origin:env.WEB_ORIGIN,'X-Roco-Request':'1','X-CSRF-Token':auth.csrf,Cookie:`roco_session=${auth.token}${browser?'; roco_github='+browser:''}`}},env);
}
async function start(){
  const response=await request('/auth/github/start','POST');expect(response.status).toBe(200);
  const body=await response.json() as {redirect_url:string},url=new URL(body.redirect_url);
  const browser=/roco_github=([^;]+)/.exec(response.headers.get('Set-Cookie')!)![1];
  return {url,browser,path:'/auth/github/callback?state='+url.searchParams.get('state')};
}
function provider(onUser?:()=>void){
  return vi.stubGlobal('fetch',vi.fn(async(input:string,options?:RequestInit)=>{
    if(input==='https://github.com/login/oauth/access_token'){
      const body=JSON.parse(String(options?.body));expect(body.redirect_uri).toBe(env.API_ORIGIN+'/auth/github/callback');expect(body.code_verifier).toBeTruthy();
      return Response.json({access_token:'synthetic-provider-token'});
    }
    if(input==='https://api.github.com/user'){onUser?.();return Response.json({id:12345,login:'sample-octocat'});}
    if(input==='https://api.github.com/user/emails?per_page=100')return Response.json([{email:'sample@users.noreply.github.com',verified:true,primary:false},{email:'private@example.test',verified:true,primary:true}]);
    throw new Error('Unexpected provider request');
  }));
}
function result(response:Response){const location=new URL(response.headers.get('Location')!);expect(location.origin).toBe(env.WEB_ORIGIN);expect(location.pathname).toBe('/account/');expect(location.searchParams.get('tab')).toBe('security');expect(location.hash).toBe('#github');return location.searchParams.get('github');}

it('reports unavailable configuration before presenting an authorization action',async()=>{
  env={...env,GITHUB_OAUTH_CLIENT_ID:'',GITHUB_OAUTH_CLIENT_SECRET:''};
  expect(await(await request('/me')).json()).toMatchObject({github_binding_available:false});
  expect(await(await request('/health')).json()).toMatchObject({github_binding_available:false});
  expect((await request('/auth/github/start','POST')).status).toBe(503);
  expect(db.sql.prepare('SELECT count(*) AS n FROM oauth_states').get()!.n).toBe(0);
});
it('starts a browser/session-bound PKCE flow with only identity and email scopes',async()=>{
  const flow=await start();expect(flow.url.origin).toBe('https://github.com');expect(flow.url.pathname).toBe('/login/oauth/authorize');
  expect(flow.url.searchParams.get('scope')).toBe('read:user user:email');expect(flow.url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(db.sql.prepare('SELECT uid,state_hash,session_hash,browser_hash FROM oauth_states').get()).toMatchObject({uid:'usr_binding',state_hash:await hash(flow.url.searchParams.get('state')!),session_hash:await hash(session.token),browser_hash:await hash(flow.browser)});
});
it('returns to account security with persisted identity and no automatic disclosure consent',async()=>{
  provider();const flow=await start(),response=await request(flow.path+'&code=synthetic-code','GET',flow.browser);
  expect(result(response)).toBe('bound');expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  expect(db.sql.prepare('SELECT uid,github_numeric_id,login,coauthor_email,enabled FROM github_identities').get()).toMatchObject({uid:'usr_binding',github_numeric_id:12345,login:'sample-octocat',coauthor_email:'sample@users.noreply.github.com',enabled:0});
  expect(db.sql.prepare("SELECT count(*) AS n FROM audit_events WHERE action='github_bound'").get()!.n).toBe(1);
  expect(result(await request(flow.path+'&code=synthetic-code','GET',flow.browser))).toBe('expired');
});
it('treats denial as a cancelled flow and consumes the browser state without contacting the provider',async()=>{
  provider();const flow=await start();expect(result(await request(flow.path+'&error=access_denied','GET',flow.browser))).toBe('cancelled');
  expect(fetch).not.toHaveBeenCalled();expect(db.sql.prepare('SELECT count(*) AS n FROM github_identities').get()!.n).toBe(0);
  expect(result(await request(flow.path+'&code=synthetic-code','GET',flow.browser))).toBe('expired');
});
it('rejects a callback after the Wiki session changes and does not reveal provider details',async()=>{
  provider();const flow=await start();db.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run('usr_other','other','另一个洛克',now());
  const other=await createSession(env,'usr_other',now());
  expect(result(await request(flow.path+'&code=synthetic-code&error_description=private-provider-detail','GET',flow.browser,other))).toBe('account-changed');
  expect(fetch).not.toHaveBeenCalled();expect(db.sql.prepare('SELECT count(*) AS n FROM github_identities').get()!.n).toBe(0);
});
it('requests verification again if authentication is no longer recent during authorization',async()=>{
  provider();const flow=await start();db.sql.prepare('UPDATE sessions SET authenticated_at=?').run(now()-601);
  expect(result(await request(flow.path+'&code=synthetic-code','GET',flow.browser))).toBe('expired');expect(fetch).not.toHaveBeenCalled();
});
it('does not write a binding or success audit if the session is revoked while GitHub responds',async()=>{
  provider(()=>db.sql.prepare('UPDATE sessions SET revoked_at=?').run(now()));
  const flow=await start();expect(result(await request(flow.path+'&code=synthetic-code','GET',flow.browser))).toBe('account-changed');
  expect(db.sql.prepare('SELECT count(*) AS n FROM github_identities').get()!.n).toBe(0);
  expect(db.sql.prepare("SELECT count(*) AS n FROM audit_events WHERE action='github_bound'").get()!.n).toBe(0);
});
it('keeps an existing GitHub owner when another Wiki account tries to bind it',async()=>{
  provider();db.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run('usr_other','other','另一个洛克',now());
  db.sql.prepare('INSERT INTO github_identities(uid,github_numeric_id,login,enabled,binding_version) VALUES(?,?,?,0,?)').run('usr_other',12345,'sample-octocat','synthetic-binding');
  const flow=await start();expect(result(await request(flow.path+'&code=synthetic-code','GET',flow.browser))).toBe('already-bound');
  expect(db.sql.prepare('SELECT uid FROM github_identities').get()!.uid).toBe('usr_other');
});
