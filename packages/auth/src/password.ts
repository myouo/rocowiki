import {scrypt,timingSafeEqual} from 'node:crypto';
import {registerSchema,loginSchema,changePasswordSchema} from '../../wiki-schema/src/account';
import {hash,now,newId,randomToken,createSession} from './index';
import type {ApiEnv,AuthSession} from '../../../apps/api/src/types';
import {mailConfigured,sendAccountMessage} from './mail';
export {mailConfigured} from './mail';

export class AccountError extends Error {constructor(public code:string,public status=400){super(code);}}
const options={N:16384,r:8,p:5,maxmem:32*1024*1024};
// OWASP's 16 MiB scrypt profile. Parameters are versioned and bounded, including on reads.
const prefix='scrypt:v1:16384:8:5';
const dummy=`${prefix}:${'0'.repeat(64)}:${'0'.repeat(128)}`;
async function derive(password:string,salt:string):Promise<Buffer>{
  return new Promise((resolve,reject)=>scrypt(password,Buffer.from(salt,'hex'),64,options,(error,key)=>error?reject(error):resolve(key)));
}
export async function hashPassword(password:string):Promise<string>{
  const salt=randomToken();return `${prefix}:${salt}:${(await derive(password,salt)).toString('hex')}`;
}
export async function verifyPassword(password:string,encoded:string):Promise<boolean>{
  if(!new RegExp(`^${prefix}:[0-9a-f]{64}:[0-9a-f]{128}$`).test(encoded))throw new AccountError('INVALID_PASSWORD_RECORD',503);
  const parts=encoded.split(':');return timingSafeEqual(await derive(password,parts[5]),Buffer.from(parts[6],'hex'));
}
export async function accountRate(env:ApiEnv,key:string,max=8,seconds=600){
  const bucket=Math.floor(now()/seconds),keyHash=await hash(`account:${key}:${bucket}`);
  const result=await env.DB.prepare('INSERT INTO rate_limits(key_hash,count,expires_at) VALUES(?,1,?) ON CONFLICT(key_hash) DO UPDATE SET count=count+1 RETURNING count').bind(keyHash,(bucket+1)*seconds).first<{count:number}>();
  if(!result||result.count>max)throw new AccountError('RATE_LIMITED',429);
}
export interface Credential {uid:string;email:string;password_hash:string;credential_version:number;email_verified_at:number|null;disabled_at:number|null;}
interface PendingRegistration {email:string;registration_id:string;username:string;display_name:string;password_hash:string;token_hash:string;expires_at:number;}
export async function credentialFor(env:ApiEnv,identifier:string):Promise<Credential|null>{
  return env.DB.prepare('SELECT c.*,u.disabled_at FROM password_credentials c JOIN users u USING(uid) WHERE c.email=? COLLATE NOCASE OR u.username=? COLLATE NOCASE').bind(identifier,identifier).first<Credential>();
}
async function checkedCredential(env:ApiEnv,input:unknown,expectedUid?:string){
  const value=loginSchema.parse(input),record=await credentialFor(env,value.identifier);
  const pending=record?null:await env.DB.prepare('SELECT * FROM pending_registrations WHERE (email=? OR username=?) AND expires_at>? LIMIT 1').bind(value.identifier,value.identifier,now()).first<PendingRegistration>();
  await accountRate(env,record?.uid??pending?.email??value.identifier);
  const matches=await verifyPassword(value.password,record?.password_hash??pending?.password_hash??dummy);
  if(matches&&pending)throw new AccountError('EMAIL_VERIFICATION_REQUIRED',403);
  if(!matches||!record||record.disabled_at!==null||(expectedUid&&record.uid!==expectedUid))throw new AccountError('INVALID_CREDENTIALS',401);
  if(env.EMAIL_VERIFICATION_REQUIRED==='true'&&record.email_verified_at===null)throw new AccountError('EMAIL_VERIFICATION_REQUIRED',403);
  return record;
}
async function credentialSession(env:ApiEnv,record:Credential){
  // Session insertion is fenced against a concurrent password reset/change.
  const session=await createSession(env,record.uid,now(),{passwordHash:record.password_hash,credentialVersion:record.credential_version});
  return session;
}
export async function passwordLogin(env:ApiEnv,input:unknown){return credentialSession(env,await checkedCredential(env,input));}
export async function passwordReauthenticate(env:ApiEnv,session:AuthSession,input:unknown){
  const record=await checkedCredential(env,input,session.uid),renewed=await credentialSession(env,record);
  await env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE id_hash=?').bind(now(),session.id_hash).run();return renewed;
}
export async function registerPassword(env:ApiEnv,input:unknown){
  if(env.REGISTRATION_ENABLED!=='true')throw new AccountError('REGISTRATION_PAUSED',503);
  const value=registerSchema.parse(input);
  if(env.EMAIL_VERIFICATION_REQUIRED==='true'&&!mailConfigured(env))throw new AccountError('MAIL_NOT_CONFIGURED',503);
  await accountRate(env,`register:${value.email}`,3,3600);
  const unavailable=await env.DB.prepare('SELECT uid FROM users WHERE username=? COLLATE NOCASE UNION ALL SELECT uid FROM password_credentials WHERE email=? COLLATE NOCASE LIMIT 1').bind(value.username,value.email).first();
  if(unavailable)throw new AccountError('ACCOUNT_UNAVAILABLE',409);
  const uid=newId('usr'),passwordHash=await hashPassword(value.password),ts=now();
  if(env.EMAIL_VERIFICATION_REQUIRED==='true'){
    const token=randomToken(),registrationId=randomToken(),tokenHash=await hash(token);
    await env.DB.prepare('INSERT INTO pending_registrations(email,registration_id,username,display_name,password_hash,token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET registration_id=excluded.registration_id,username=excluded.username,display_name=excluded.display_name,password_hash=excluded.password_hash,token_hash=excluded.token_hash,expires_at=excluded.expires_at,created_at=excluded.created_at').bind(value.email,registrationId,value.username,value.display_name,passwordHash,tokenHash,ts+86400,ts).run();
    try{await sendTokenEmail(env,value.email,token,'verify_email');}catch(error){await env.DB.prepare('DELETE FROM pending_registrations WHERE registration_id=?').bind(registrationId).run();throw error;}
    return {verification_required:true};
  }
  try {await env.DB.batch([
    env.DB.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').bind(uid,value.username,value.display_name,ts),
    env.DB.prepare('INSERT INTO password_credentials(uid,email,password_hash,created_at,updated_at) VALUES(?,?,?,?,?)').bind(uid,value.email,passwordHash,ts,ts),
    env.DB.prepare("INSERT INTO audit_events(event_id,actor_uid,action,target_id,ts) VALUES(?,?,'account_registered',?,?)").bind(newId('evt'),uid,uid,ts)
  ]);}catch(error){
    const existing=await env.DB.prepare('SELECT uid FROM users WHERE username=? COLLATE NOCASE UNION ALL SELECT uid FROM password_credentials WHERE email=? COLLATE NOCASE LIMIT 1').bind(value.username,value.email).first();
    if(existing)throw new AccountError('ACCOUNT_UNAVAILABLE',409);throw error;
  }
  return {verification_required:false};
}
export async function changePassword(env:ApiEnv,session:AuthSession,input:unknown){
  const value=changePasswordSchema.parse(input),record=await checkedCredential(env,{identifier:session.username,password:value.current_password},session.uid);
  const encoded=await hashPassword(value.new_password),ts=now();
  const result=await env.DB.prepare('UPDATE password_credentials SET password_hash=?,credential_version=credential_version+1,updated_at=? WHERE uid=? AND credential_version=? AND password_hash=? AND EXISTS(SELECT 1 FROM users WHERE uid=password_credentials.uid AND disabled_at IS NULL) RETURNING credential_version').bind(encoded,ts,record.uid,record.credential_version,record.password_hash).first<{credential_version:number}>();
  if(!result)throw new AccountError('CREDENTIALS_CHANGED',409);
  return credentialSession(env,{...record,password_hash:encoded,credential_version:result.credential_version});
}

export async function sendAccountToken(env:ApiEnv,record:Credential,purpose:'verify_email'|'reset_password'){
  if(!mailConfigured(env))throw new AccountError('MAIL_NOT_CONFIGURED',503);
  const token=randomToken(),tokenHash=await hash(token),ts=now();
  await env.DB.prepare('INSERT INTO account_tokens(token_hash,uid,purpose,credential_version,expires_at) VALUES(?,?,?,?,?)').bind(tokenHash,record.uid,purpose,record.credential_version,ts+(purpose==='verify_email'?86400:1800)).run();
  try{await sendTokenEmail(env,record.email,token,purpose);}catch(error){await env.DB.prepare('DELETE FROM account_tokens WHERE token_hash=? AND consumed_at IS NULL').bind(tokenHash).run();throw error;}
}
async function sendTokenEmail(env:ApiEnv,email:string,token:string,purpose:'verify_email'|'reset_password'){
  const tokenHash=await hash(token),url=new URL('/workbench/',env.WEB_ORIGIN);url.hash=`${purpose==='verify_email'?'verify':'reset'}=${token}`;
  const subject=purpose==='verify_email'?'验证你的 RocoWiki 邮箱':'重置你的 RocoWiki 密码';
  try {
    await sendAccountMessage(env,{email,subject,idempotencyKey:`account-${tokenHash}`,text:`${subject}\n\n请在 RocoWiki 中确认操作：${url}\n${purpose==='verify_email'?'确认时还需要输入注册密码。':''}\n若非本人操作，请忽略此邮件。`,html:`<p>${subject}</p><p><a href="${url}">在 RocoWiki 中确认</a></p><p>${purpose==='verify_email'?'确认时还需要输入注册密码。':''}</p><p>若非本人操作，请忽略此邮件。</p>`});
  }catch{throw new AccountError('MAIL_DELIVERY_FAILED',503);}
}
export async function requestAccountEmail(env:ApiEnv,input:unknown,purpose:'verify_email'|'reset_password'){
  // The public response does not reveal accounts, email addresses or tokens.
  const value=loginSchema.pick({identifier:true}).strict().parse(input);
  if(!mailConfigured(env))throw new AccountError('MAIL_NOT_CONFIGURED',503);
  const record=await credentialFor(env,value.identifier);
  const pending=!record&&purpose==='verify_email'?await env.DB.prepare('SELECT * FROM pending_registrations WHERE (email=? OR username=?) AND expires_at>? LIMIT 1').bind(value.identifier,value.identifier,now()).first<PendingRegistration>():null;
  await accountRate(env,`email:${record?.email??pending?.email??value.identifier}`,3,3600);
  if(record&&record.disabled_at===null&&(purpose==='verify_email'?record.email_verified_at===null:record.email_verified_at!==null))await sendAccountToken(env,record,purpose);
  if(!record&&purpose==='verify_email'){
    if(pending){const token=randomToken();const changed=await env.DB.prepare('UPDATE pending_registrations SET token_hash=? WHERE registration_id=?').bind(await hash(token),pending.registration_id).run();if(changed.meta.changes)await sendTokenEmail(env,pending.email,token,purpose);}
  }
  return {ok:true};
}
export async function consumeAccountToken(env:ApiEnv,token:string,purpose:'verify_email'|'reset_password',password?:string){
  if(!/^[a-f0-9]{64}$/.test(token))throw new AccountError('INVALID_ACCOUNT_TOKEN',400);
  const tokenHash=await hash(token),claim=randomToken();let ts=now();
  if(purpose==='verify_email'){
    const pending=await env.DB.prepare('SELECT * FROM pending_registrations WHERE token_hash=? AND expires_at>?').bind(tokenHash,ts).first<PendingRegistration>();
    if(pending){
      await accountRate(env,`verify:${pending.email}`);
      if(!await verifyPassword(loginSchema.shape.password.parse(password),pending.password_hash))throw new AccountError('INVALID_CREDENTIALS',401);
      ts=now();
      const uid=newId('usr'),condition='registration_id=? AND token_hash=? AND password_hash=? AND expires_at>?';
      const fence=[pending.registration_id,tokenHash,pending.password_hash,ts];
      let results:D1Result[];
      try{results=await env.DB.batch([
        env.DB.prepare(`INSERT INTO users(uid,username,display_name,created_at) SELECT ?,username,display_name,? FROM pending_registrations WHERE ${condition}`).bind(uid,ts,...fence),
        env.DB.prepare(`INSERT INTO password_credentials(uid,email,password_hash,email_verified_at,created_at,updated_at) SELECT ?,email,password_hash,?,?,? FROM pending_registrations WHERE ${condition} AND EXISTS(SELECT 1 FROM users WHERE uid=?)`).bind(uid,ts,ts,ts,...fence,uid),
        env.DB.prepare("INSERT INTO audit_events(event_id,actor_uid,action,target_id,ts) SELECT ?,uid,'account_registered',uid,? FROM users WHERE uid=?").bind(newId('evt'),ts,uid),
        env.DB.prepare('DELETE FROM pending_registrations WHERE registration_id=? AND EXISTS(SELECT 1 FROM password_credentials WHERE uid=?)').bind(pending.registration_id,uid)
      ]);}catch(error){const unavailable=await env.DB.prepare('SELECT uid FROM users WHERE username=? COLLATE NOCASE UNION ALL SELECT uid FROM password_credentials WHERE email=? COLLATE NOCASE LIMIT 1').bind(pending.username,pending.email).first();if(unavailable)throw new AccountError('ACCOUNT_UNAVAILABLE',409);throw error;}
      if(!results[0].meta.changes)throw new AccountError('INVALID_ACCOUNT_TOKEN',400);return {ok:true};
    }
  }
  const record=await env.DB.prepare('SELECT c.*,u.disabled_at FROM account_tokens t JOIN password_credentials c USING(uid) JOIN users u USING(uid) WHERE t.token_hash=? AND t.purpose=? AND t.expires_at>? AND t.consumed_at IS NULL AND t.credential_version=c.credential_version AND u.disabled_at IS NULL').bind(tokenHash,purpose,ts).first<Credential>();
  if(!record)throw new AccountError('INVALID_ACCOUNT_TOKEN',400);
  if(purpose==='verify_email'&&!await verifyPassword(loginSchema.shape.password.parse(password),record.password_hash))throw new AccountError('INVALID_CREDENTIALS',401);
  const encoded=purpose==='reset_password'?await hashPassword(changePasswordSchema.shape.new_password.parse(password)):null;
  ts=now();
  const results=await env.DB.batch([
    env.DB.prepare('UPDATE account_tokens SET consumed_at=?,claim_id=? WHERE token_hash=? AND purpose=? AND expires_at>? AND consumed_at IS NULL AND credential_version=(SELECT credential_version FROM password_credentials WHERE uid=account_tokens.uid) AND EXISTS(SELECT 1 FROM users WHERE uid=account_tokens.uid AND disabled_at IS NULL)').bind(ts,claim,tokenHash,purpose,ts),
    purpose==='verify_email'
      ?env.DB.prepare('UPDATE password_credentials SET email_verified_at=COALESCE(email_verified_at,?) WHERE uid=(SELECT uid FROM account_tokens WHERE claim_id=?)').bind(ts,claim)
      :env.DB.prepare('UPDATE password_credentials SET password_hash=?,credential_version=credential_version+1,updated_at=? WHERE uid=(SELECT uid FROM account_tokens WHERE claim_id=?)').bind(encoded,ts,claim),
    env.DB.prepare('INSERT INTO audit_events(event_id,actor_uid,action,target_id,ts) SELECT ?,uid,?,uid,? FROM account_tokens WHERE claim_id=?').bind(newId('evt'),purpose,ts,claim)
  ]);
  if(!results[0].meta.changes)throw new AccountError('INVALID_ACCOUNT_TOKEN',400);
  return {ok:true};
}
