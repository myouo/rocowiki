import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {TestDatabase} from './d1';
import {app} from '../apps/api/src/index';
import {hash,now,createSession,getSession,sessionCsrf} from '../packages/auth/src/index';
import {hashPassword,verifyPassword,credentialFor,consumeAccountToken} from '../packages/auth/src/password';
import type {ApiEnv} from '../apps/api/src/types';
import {mailConfigured,sendAccountMessage} from '../packages/auth/src/mail';

let db:TestDatabase,env:ApiEnv;
const password='A long wiki passphrase 2026!';
const registration={email:'Player@Example.test',username:'Player_01',display_name:'小洛克',password};
beforeEach(()=>{db=new TestDatabase();env=db.env({EMAIL_VERIFICATION_REQUIRED:'false'});});
afterEach(()=>{db.close();vi.unstubAllGlobals();});
function request(path:string,body?:unknown,session?:{token:string;csrf:string},method=body===undefined?'GET':'POST'){
  const headers:Record<string,string>={Origin:env.WEB_ORIGIN,'X-Roco-Request':'1','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.10'};
  if(session){headers.Cookie=`roco_session=${session.token}`;headers['X-CSRF-Token']=session.csrf;}
  return app.request(`http://localhost:8787${path}`,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})},env);
}
async function register(value=registration){const r=await request('/auth/register',value);expect(r.status).toBe(201);return credentialFor(env,value.email.toLowerCase());}
async function login(identifier='player_01',value=password){const r=await request('/auth/login',{identifier,password:value});expect(r.status).toBe(200);const token=/roco_session=([a-f0-9]{64})/.exec(r.headers.get('set-cookie')!)![1];const csrf=await sessionCsrf(new Request('http://localhost',{headers:{Cookie:`roco_session=${token}`}}),env);return {token,csrf};}
function mailFixture(){
  const sent:{to:string;token:string;url:URL;text:string;html:string}[]=[];
  env={...env,EMAIL_VERIFICATION_REQUIRED:'true',MAIL_PROVIDER:'resend',MAIL_FROM:'accounts@example.test',RESEND_API_KEY:'fixture-mail-key'};
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
    expect(url).toBe('https://api.resend.com/emails');
    const input=JSON.parse(String(init.body)),text=input.text;
    const link=new URL(text.match(/https?:\/\/\S+/)[0]);
    sent.push({to:input.to[0],token:link.hash.split('=')[1],url:link,text,html:input.html});
    // The provider receives confirmation links, never the account password.
    expect(String(init.body)).not.toContain(password);
    return Response.json({id:'fixture-delivery'});
  }));
  return sent;
}

it('separates immutable username, mutable nickname, email and Wiki UID, storing only a salted password hash',async()=>{
  const record=(await register())!;
  expect(record.uid).toMatch(/^usr_/);expect(record.email).toBe('player@example.test');
  expect(db.sql.prepare('SELECT username,display_name FROM users').get()).toMatchObject({username:'player_01',display_name:'小洛克'});
  expect(record.password_hash).not.toContain(password);expect(await verifyPassword(password,record.password_hash)).toBe(true);
  expect(await verifyPassword('another long password',record.password_hash)).toBe(false);
  expect(await hashPassword(password)).not.toBe(record.password_hash);
});
it('logs in by email or username without case sensitivity and returns private account information only to its session',async()=>{
  await register();const emailSession=await login('PLAYER@EXAMPLE.TEST'),nameSession=await login('PLAYER_01');
  for(const session of [emailSession,nameSession]){const r=await request('/me',undefined,session);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({user:{username:'player_01',display_name:'小洛克'},account:{email:'player@example.test',email_verified:false}});}
  expect((await request('/me')).status).toBe(401);
});
it('rejects duplicate normalized emails/usernames atomically without orphaning accounts',async()=>{
  await register();
  for(const input of [{...registration,email:'another@example.test'},{...registration,username:'other_name'}])expect((await request('/auth/register',input)).status).toBe(409);
  expect(db.sql.prepare('SELECT count(*) AS n FROM users').get()!.n).toBe(1);expect(db.sql.prepare('SELECT count(*) AS n FROM password_credentials').get()!.n).toBe(1);
});
it('enforces username and UID immutability in SQLite and exposes a strict nickname-only update',async()=>{
  const record=(await register())!,session=await login();
  for(const field of ['username','uid'])expect(()=>db.sql.prepare(`UPDATE users SET ${field}=? WHERE uid=?`).run('changed',record.uid)).toThrow('immutable user identity');
  expect((await request('/me',{display_name:'新昵称'},session,'PATCH')).status).toBe(200);
  expect((await request('/me',{display_name:'新昵称',username:'changed'},session,'PATCH')).status).toBe(400);
  expect(await (await request('/me',undefined,session)).json()).toMatchObject({user:{username:'player_01',display_name:'新昵称'}});
});
it('rejects invalid usernames, weak passwords, controls and client-supplied privileges before creating accounts',async()=>{
  for(const input of [{...registration,username:'admin'},{...registration,username:'12name'},{...registration,password:'short'},{...registration,display_name:'bad\u0000name'},{...registration,role:'admin'}])expect((await request('/auth/register',input)).status).toBe(400);
  expect(db.sql.prepare('SELECT count(*) AS n FROM users').get()!.n).toBe(0);
});
it('returns the same credential error for unknown accounts, wrong passwords and disabled users',async()=>{
  const record=(await register())!;
  for(const identifier of ['missing','player_01']){const r=await request('/auth/login',{identifier,password:'wrong password value'});expect(r.status).toBe(401);expect(await r.json()).toMatchObject({error:{code:'INVALID_CREDENTIALS'}});}
  db.sql.prepare('UPDATE users SET disabled_at=? WHERE uid=?').run(now(),record.uid);
  const disabled=await request('/auth/login',{identifier:'player_01',password});expect(disabled.status).toBe(401);expect(await disabled.json()).toMatchObject({error:{code:'INVALID_CREDENTIALS'}});
});
it('does not let alternating email and username bypass the account login rate limit',async()=>{
  await register();
  for(let n=0;n<8;n++)expect((await request('/auth/login',{identifier:n%2?'player_01':'player@example.test',password:'wrong'})).status).toBe(401);
  const limited=await request('/auth/login',{identifier:'player_01',password});expect(limited.status).toBe(429);
});
it('changes the password, invalidates every old session, and issues a session for the new credential version',async()=>{
  await register();const first=await login(),second=await login(),next='Another long wiki password!';
  const changed=await request('/auth/password/change',{current_password:password,new_password:next},first);expect(changed.status).toBe(200);expect(changed.headers.get('set-cookie')).toContain('roco_session=');
  for(const session of [first,second])expect((await request('/me',undefined,session)).status).toBe(401);
  expect((await request('/auth/login',{identifier:'player_01',password})).status).toBe(401);await login('player_01',next);
});
it('fences session creation against a password reset racing with a completed password check',async()=>{
  const old=(await register())!;
  db.sql.prepare('UPDATE password_credentials SET password_hash=?,credential_version=credential_version+1,updated_at=? WHERE uid=?').run(await hashPassword('new valid long password'),now(),old.uid);
  await expect(createSession(env,old.uid,now(),{passwordHash:old.password_hash,credentialVersion:old.credential_version})).rejects.toThrow('CREDENTIALS_CHANGED');
  expect(db.sql.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(0);
});
it('refreshes recent authentication by checking the same account password and rotating the session',async()=>{
  await register();const previous=await login();db.sql.prepare('UPDATE sessions SET authenticated_at=?').run(now()-86400);
  const result=await request('/auth/reauthenticate',{identifier:'PLAYER_01',password},previous);expect(result.status).toBe(200);
  const token=/roco_session=([a-f0-9]{64})/.exec(result.headers.get('set-cookie')!)![1];
  expect((await getSession(new Request('http://localhost',{headers:{Cookie:`roco_session=${token}`}}),env))?.authenticated_at).toBeGreaterThan(now()-10);
  expect((await request('/me',undefined,previous)).status).toBe(401);
});
it('does not create an unusable pending account when required mail is unconfigured',async()=>{
  env.EMAIL_VERIFICATION_REQUIRED='true';const result=await request('/auth/register',registration);
  expect(result.status).toBe(503);expect(await result.json()).toMatchObject({error:{code:'MAIL_NOT_CONFIGURED'}});expect(db.sql.prepare('SELECT count(*) AS n FROM users').get()!.n).toBe(0);
});
it('requires mailbox verification, uses a fragment token, stores only its hash and rejects replay',async()=>{
  const sent=mailFixture();await register();
  const blocked=await request('/auth/login',{identifier:'player_01',password});expect(blocked.status).toBe(403);expect(await blocked.json()).toMatchObject({error:{code:'EMAIL_VERIFICATION_REQUIRED'}});
  expect(db.sql.prepare('SELECT count(*) AS n FROM users').get()!.n).toBe(0);
  expect(sent[0].url.search).toBe('');expect(db.sql.prepare('SELECT token_hash FROM pending_registrations').get()!.token_hash).toBe(await hash(sent[0].token));
  expect((await request('/auth/email/verify',{token:sent[0].token,password:'wrong password'})).status).toBe(401);
  expect((await request('/auth/email/verify',{token:sent[0].token,password})).status).toBe(200);
  expect((await request('/auth/email/verify',{token:sent[0].token,password})).status).toBe(400);await login();
});
it('resets a verified account password once and rejects all earlier tokens and sessions',async()=>{
  const sent=mailFixture();await register();await consumeAccountToken(env,sent[0].token,'verify_email',password);const session=await login();
  await request('/auth/password/request-reset',{identifier:'player@example.test'});await request('/auth/password/request-reset',{identifier:'player_01'});
  const next='Reset to a strong passphrase!';expect((await request('/auth/password/reset',{token:sent[1].token,password:next})).status).toBe(200);
  expect((await request('/auth/password/reset',{token:sent[2].token,password:next})).status).toBe(400);expect((await request('/me',undefined,session)).status).toBe(401);await login('player_01',next);
});
it('keeps reset responses generic, refuses unverified resets, and does not consume verification tokens on GET',async()=>{
  const sent=mailFixture();await register();
  for(const identifier of ['missing@example.test','player_01']){const result=await request('/auth/password/request-reset',{identifier});expect(await result.json()).toEqual({ok:true});}
  expect(sent).toHaveLength(1);expect((await request(`/auth/email/verify?token=${sent[0].token}`)).status).toBe(404);
  expect(db.sql.prepare('SELECT token_hash FROM pending_registrations').get()!.token_hash).toBe(await hash(sent[0].token));
});
it('does not reserve an account or username after explicit email rejection and permits a fresh registration',async()=>{
  const sent=mailFixture();const delivery=vi.mocked(fetch);delivery.mockResolvedValueOnce(Response.json({error:'upstream'}, {status:403}));
  expect((await request('/auth/register',registration)).status).toBe(503);
  expect(db.sql.prepare('SELECT count(*) AS n FROM users').get()!.n).toBe(0);expect(db.sql.prepare('SELECT count(*) AS n FROM pending_registrations').get()!.n).toBe(0);
  expect((await request('/auth/register',registration)).status).toBe(201);expect(sent).toHaveLength(1);
});
it('upgrades an existing database without changing credentials or invalidating the original verification link',async()=>{
  db.close();db=new TestDatabase(':memory:',false);
  for(const file of readdirSync('database/migrations').filter(name=>name.endsWith('.sql')&&!name.startsWith('0007_')).sort())db.sql.exec(readFileSync(`database/migrations/${file}`,'utf8'));
  env=db.env({EMAIL_VERIFICATION_REQUIRED:'false'});const existing=(await register())!;
  const sent=mailFixture();
  expect((await request('/auth/register',{...registration,email:'pending@example.test',username:'pending_01'})).status).toBe(201);
  db.sql.exec(readFileSync('database/migrations/0007_pending_registration_tokens.sql','utf8'));
  expect(await credentialFor(env,registration.email.toLowerCase())).toEqual(existing);
  expect((await request('/auth/email/resend',{identifier:'pending_01'})).status).toBe(200);
  expect((await request('/auth/email/verify',{token:sent[0].token,password})).status).toBe(200);
  expect(db.sql.prepare('SELECT count(*) AS n FROM users').get()!.n).toBe(2);
});
it('preserves earlier verification links on resend and consumes all links together',async()=>{
  const sent=mailFixture();await register();
  const response=await request('/auth/email/resend',{identifier:'player_01'});
  expect(await response.json()).toEqual({ok:true});expect(sent).toHaveLength(2);
  expect(sent.map(message=>message.to)).toEqual(['player@example.test','player@example.test']);
  expect(sent[1].token).not.toBe(sent[0].token);
  expect(db.sql.prepare('SELECT token_hash FROM pending_registration_tokens').get()!.token_hash).toBe(await hash(sent[1].token));
  expect((await request('/auth/email/verify',{token:sent[0].token,password})).status).toBe(200);
  expect((await request('/auth/email/verify',{token:sent[1].token,password})).status).toBe(400);
  expect(db.sql.prepare('SELECT count(*) AS n FROM pending_registration_tokens').get()!.n).toBe(0);
  await login();
});
it('shows the original registration deadline on a resend rather than advertising another 24 hours',async()=>{
  const clock=vi.spyOn(Date,'now').mockReturnValue(Date.UTC(2026,9,14,10,30));
  try{
    const sent=mailFixture();await register();
    clock.mockReturnValue(Date.UTC(2026,9,15,10,20));
    expect((await request('/auth/email/resend',{identifier:'player_01'})).status).toBe(200);
    for(const message of sent){
      expect(message.html).toContain('2026年10月15日 18:30（北京时间）');
      expect(message.text).toContain('2026年10月15日 18:30（北京时间）');
    }
    expect(sent).toHaveLength(2);
  }finally{clock.mockRestore();}
});
it('allows overlapping resends to complete out of order without invalidating their links',async()=>{
  const sent=mailFixture();await register();
  const delivery=vi.mocked(fetch),deliver=delivery.getMockImplementation()!;
  let entered!:()=>void;
  const bothEntered=new Promise<void>(resolve=>{entered=resolve;});
  const release:(()=>void)[]=[];
  delivery.mockImplementation(async(...args)=>{
    const result=await deliver(...args);
    await new Promise<void>(resolve=>{release.push(resolve);if(release.length===2)entered();});
    return result;
  });
  const first=request('/auth/email/resend',{identifier:'player_01'}),second=request('/auth/email/resend',{identifier:'player@example.test'});
  await bothEntered;release[1]();release[0]();
  expect((await first).status).toBe(200);expect((await second).status).toBe(200);
  expect(sent).toHaveLength(3);expect(db.sql.prepare('SELECT count(*) AS n FROM pending_registration_tokens').get()!.n).toBe(2);
  expect((await request('/auth/email/verify',{token:sent[1].token,password})).status).toBe(200);
  for(const token of [sent[0].token,sent[2].token])expect((await request('/auth/email/verify',{token,password})).status).toBe(400);
  expect(db.sql.prepare('SELECT count(*) AS n FROM users').get()!.n).toBe(1);
});
it('preserves pending verification when the provider accepts mail but the response is lost',async()=>{
  const sent=mailFixture(),delivery=vi.mocked(fetch),deliver=delivery.getMockImplementation()!;
  delivery.mockImplementationOnce(async(...args)=>{await deliver(...args);throw new DOMException('synthetic timeout','TimeoutError');});
  expect((await request('/auth/register',registration)).status).toBe(503);
  expect(db.sql.prepare('SELECT count(*) AS n FROM users').get()!.n).toBe(0);
  expect(db.sql.prepare('SELECT count(*) AS n FROM pending_registrations').get()!.n).toBe(1);
  expect((await request('/auth/email/resend',{identifier:'player_01'})).status).toBe(200);
  expect((await request('/auth/email/verify',{token:sent[0].token,password})).status).toBe(200);
});
it('preserves reset tokens when a successful provider response lacks its acknowledgment',async()=>{
  const sent=mailFixture();await register();await consumeAccountToken(env,sent[0].token,'verify_email',password);
  const delivery=vi.mocked(fetch),deliver=delivery.getMockImplementation()!;
  delivery.mockImplementationOnce(async(...args)=>{await deliver(...args);return Response.json({});});
  expect((await request('/auth/password/request-reset',{identifier:'player_01'})).status).toBe(503);
  expect((await request('/auth/password/reset',{token:sent[1].token,password:'A new recovery passphrase!'})).status).toBe(200);
  await login('player_01','A new recovery passphrase!');
});
it('does not let an unverified registration reserve a permanent username or hijack a later registration',async()=>{
  const sent=mailFixture();await register();
  await request('/auth/email/resend',{identifier:'player_01'});
  expect((await request('/auth/register',{...registration,username:'chosen_name',password:'A different owner passphrase!'})).status).toBe(201);
  for(const token of [sent[0].token,sent[1].token])expect((await request('/auth/email/verify',{token,password})).status).toBe(400);
  expect((await request('/auth/email/verify',{token:sent[2].token,password:'A different owner passphrase!'})).status).toBe(200);
  expect(db.sql.prepare('SELECT username FROM users').get()!.username).toBe('chosen_name');
});
it('checks the Resend HTTP contract and rejects failed or malformed delivery acknowledgments',async()=>{
  const configured={...env,MAIL_PROVIDER:'resend',MAIL_FROM:'accounts@example.test',RESEND_API_KEY:'fixture-resend-key'};
  const http=vi.fn(async(input:string,init:RequestInit)=>{
    const headers=new Headers(init.headers),body=JSON.parse(String(init.body));
    expect(input).toBe('https://api.resend.com/emails');expect(headers.get('Authorization')).toBe('Bearer fixture-resend-key');
    expect(headers.get('Idempotency-Key')).toBe('fixture-delivery');
    expect(body).toMatchObject({from:`RocoWiki <${configured.MAIL_FROM}>`,to:['owner@example.test'],text:'plain text',html:'<p>plain text</p>'});
    expect(init.redirect).toBe('manual');expect(init.signal).toBeInstanceOf(AbortSignal);
    return Response.json({id:'fixture-message'});
  });vi.stubGlobal('fetch',http);
  const input={email:'owner@example.test',subject:'verify',text:'plain text',html:'<p>plain text</p>',idempotencyKey:'fixture-delivery'};
  await sendAccountMessage(configured,input);
  for(const response of [Response.json({ok:true}),Response.json(null),Response.json({id:''}),Response.json({id:' '}),Response.json({id:1}),new Response('{',{status:200}),Response.json({error:'synthetic'}, {status:403}),new Response(null,{status:302,headers:{Location:'https://untrusted.example.test'}})]){
    http.mockResolvedValueOnce(response);await expect(sendAccountMessage(configured,input)).rejects.toThrow('MAIL_DELIVERY_FAILED');
  }
});
it('distinguishes explicit provider rejection from uncertain delivery without leaking provider responses',async()=>{
  const configured={...env,MAIL_PROVIDER:'resend',MAIL_FROM:'accounts@example.test',RESEND_API_KEY:'fixture-resend-key'};
  const input={email:'owner@example.test',subject:'verify',text:'plain',html:'<p>plain</p>',idempotencyKey:'fixture-delivery'};
  const http=vi.fn();vi.stubGlobal('fetch',http);
  for(const [status,uncertain] of [[403,false],[422,false],[302,false],[503,true],[408,true],[200,true]] as const){
    http.mockResolvedValueOnce(Response.json({error:'private provider detail'}, {status}));
    await expect(sendAccountMessage(configured,input)).rejects.toMatchObject({message:'MAIL_DELIVERY_FAILED',deliveryUncertain:uncertain});
  }
  http.mockRejectedValueOnce(new Error('private transport detail'));
  await expect(sendAccountMessage(configured,input)).rejects.toMatchObject({message:'MAIL_DELIVERY_FAILED',deliveryUncertain:true});
});
it('rejects disabled, unsupported and incomplete mail configuration before contacting the provider',async()=>{
  const http=vi.fn();vi.stubGlobal('fetch',http);
  const configured={...env,MAIL_PROVIDER:'resend',MAIL_FROM:'accounts@example.test',RESEND_API_KEY:'fixture-resend-key'};
  for(const partial of [{MAIL_PROVIDER:'disabled'},{MAIL_PROVIDER:'unsupported'},{MAIL_FROM:''},{MAIL_FROM:' '},{RESEND_API_KEY:undefined},{RESEND_API_KEY:' '}]){
    const next={...configured,...partial};expect(mailConfigured(next)).toBe(false);
    await expect(sendAccountMessage(next,{email:'owner@example.test',subject:'verify',text:'plain',html:'<p>plain</p>',idempotencyKey:'fixture'})).rejects.toThrow('MAIL_NOT_CONFIGURED');
  }
  expect(http).not.toHaveBeenCalled();
});
