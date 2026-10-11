import * as oidc from 'openid-client';
import {timingSafeEqual} from 'node:crypto';
import type { ApiEnv, AuthSession } from '../../../apps/api/src/types';

export const now = () => Math.floor(Date.now()/1000);
export const newId = (prefix:string) => `${prefix}_${crypto.randomUUID()}`;
export function randomToken():string {return [...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function hash(value:string):Promise<string> {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function cookieName(env:ApiEnv,kind='session') {return `${env.ENVIRONMENT==='production'?'__Host-':''}roco_${kind}`;}
export function cookieValue(request:Request,name:string):string|undefined {
  return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${name}=`))?.slice(name.length+1);
}
export function cookie(env:ApiEnv,kind:string,value:string,age:number):string {
  return `${cookieName(env,kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${env.ENVIRONMENT==='production'?'; Secure':''}`;
}
export async function getSession(request:Request,env:ApiEnv):Promise<AuthSession|null> {
  const token=cookieValue(request,cookieName(env));
  if(!token||!/^[0-9a-f]{64}$/.test(token))return null;
  return env.DB.prepare('SELECT u.uid,u.username,u.display_name,u.role,s.id_hash,s.csrf_hash,s.authenticated_at FROM sessions s JOIN users u ON u.uid=s.uid WHERE s.id_hash=? AND s.expires_at>? AND s.revoked_at IS NULL AND u.disabled_at IS NULL').bind(await hash(token),now()).first<AuthSession>();
}
export const recentAuthMaxAge=600;
const authClockTolerance=30;
export async function createSession(env:ApiEnv,uid:string,authenticatedAt:number) {
  const token=randomToken(),csrf=await deriveCsrf(token),ts=now();
  if(!Number.isSafeInteger(authenticatedAt)||authenticatedAt<=0||authenticatedAt>ts+authClockTolerance)throw new Error('INVALID_OIDC_TOKEN');
  await env.DB.prepare('INSERT INTO sessions(id_hash,uid,csrf_hash,created_at,authenticated_at,expires_at) VALUES(?,?,?,?,?,?)').bind(await hash(token),uid,await hash(csrf),ts,Math.min(authenticatedAt,ts),ts+604800).run();
  return {token,csrf};
}
// Domain-separated from the HttpOnly session secret; stable until the session changes.
// Account reads never mutate session state or invalidate tokens held by another tab.
function deriveCsrf(token:string):Promise<string> {return hash(`rocowiki:csrf:v1:${token}`);}
export async function sessionCsrf(request:Request,env:ApiEnv):Promise<string> {
  const token=cookieValue(request,cookieName(env));
  if(!token||!/^[0-9a-f]{64}$/.test(token))throw new Error('UNAUTHORIZED');
  return deriveCsrf(token);
}
export async function verifyCsrf(request:Request,env:ApiEnv,session:AuthSession):Promise<boolean> {
  const csrf=request.headers.get('X-CSRF-Token');
  if(!csrf||!/^[0-9a-f]{64}$/.test(csrf))return false;
  const digest=await hash(csrf);
  // Keep pre-upgrade tabs usable until their session expires or is revoked.
  const encoder=new TextEncoder(),provided=encoder.encode(digest),stored=encoder.encode(session.csrf_hash);
  const stable=encoder.encode(await hash(await sessionCsrf(request,env)));
  const legacyMatch=provided.byteLength===stored.byteLength&&timingSafeEqual(provided,stored);
  const stableMatch=timingSafeEqual(provided,stable);
  return legacyMatch||stableMatch;
}
export async function verifyHmac(secret:string|undefined,body:string,signature:string|null):Promise<boolean> {
  if(!secret||!signature||!/^sha256=[0-9a-f]{64}$/.test(signature))return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const bytes=Uint8Array.from(signature.slice(7).match(/../g)!,v=>parseInt(v,16));
  return crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(body));
}
export async function oidcConfiguration(env:ApiEnv) {
  if(!env.OIDC_ISSUER||!env.OIDC_CLIENT_ID||!env.OIDC_CLIENT_SECRET)throw new Error('AUTH_NOT_CONFIGURED');
  return oidc.discovery(new URL(env.OIDC_ISSUER),env.OIDC_CLIENT_ID,env.OIDC_CLIENT_SECRET,undefined,{timeout:15});
}
export async function beginOidc(env:ApiEnv,session:AuthSession|null) {
  const config=await oidcConfiguration(env),state=oidc.randomState(),verifier=oidc.randomPKCECodeVerifier(),nonce=oidc.randomNonce(),browser=randomToken();
  await env.DB.prepare('INSERT INTO oauth_states(state_hash,provider,uid,session_hash,browser_hash,verifier,nonce,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(await hash(state),'oidc',session?.uid??null,session?.id_hash??null,await hash(browser),verifier,nonce,now()+600).run();
  const url=oidc.buildAuthorizationUrl(config,{redirect_uri:`${env.API_ORIGIN}/auth/callback`,scope:'openid email profile',state,nonce,code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',max_age:String(session?0:recentAuthMaxAge),...(session?{prompt:'login'}:{})});
  return {url:url.toString(),browser};
}
export interface OAuthState {uid:string|null;session_hash:string|null;verifier:string;nonce:string;}
export async function consumeState(env:ApiEnv,request:Request,provider:'oidc'|'github'):Promise<OAuthState> {
  const state=new URL(request.url).searchParams.get('state'),browser=cookieValue(request,cookieName(env,provider));
  if(!state||!browser)throw new Error('INVALID_OAUTH_STATE');
  const result=await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash=? AND provider=? AND browser_hash=? AND expires_at>? RETURNING uid,session_hash,verifier,nonce').bind(await hash(state),provider,await hash(browser),now()).first<OAuthState>();
  if(!result)throw new Error('INVALID_OAUTH_STATE');
  if(result.session_hash) {
    const session=await getSession(request,env);
    if(!session||session.id_hash!==result.session_hash||session.uid!==result.uid)throw new Error('SESSION_CHANGED');
  }
  return result;
}
export async function finishOidc(env:ApiEnv,request:Request,state:OAuthState) {
  let tokens:Awaited<ReturnType<typeof oidc.authorizationCodeGrant>>;
  try {
    tokens=await oidc.authorizationCodeGrant(await oidcConfiguration(env),new URL(request.url),{
      pkceCodeVerifier:state.verifier,expectedState:new URL(request.url).searchParams.get('state')!,expectedNonce:state.nonce,idTokenExpected:true,
      // Determined by server-side state, regardless of edited authorization URL parameters.
      maxAge:state.session_hash?0:recentAuthMaxAge
    });
  } catch(error) {
    if(error instanceof oidc.ClientError&&['OAUTH_INVALID_RESPONSE','OAUTH_JWT_TIMESTAMP_CHECK_FAILED','OAUTH_JWT_CLAIM_COMPARISON_FAILED'].includes(error.code??''))throw new Error('INVALID_OIDC_TOKEN');
    throw error;
  }
  const claims=tokens.claims();
  if(!claims||claims.email_verified!==true||typeof claims.email!=='string'||!claims.sub)throw new Error('VERIFIED_EMAIL_REQUIRED');
  const authenticatedAt=claims.auth_time,ts=now();
  if(typeof authenticatedAt!=='number'||!Number.isSafeInteger(authenticatedAt)||authenticatedAt<=0||authenticatedAt>ts+authClockTolerance||ts-authenticatedAt>recentAuthMaxAge)throw new Error('INVALID_OIDC_TOKEN');
  let identity=await env.DB.prepare('SELECT uid FROM oidc_identities WHERE issuer=? AND subject=?').bind(env.OIDC_ISSUER,claims.sub).first<{uid:string}>();
  if(state.uid&&identity?.uid!==state.uid)throw new Error('REAUTH_IDENTITY_MISMATCH');
  if(!identity) {
    const uid=newId('usr'),username=`roco-${crypto.randomUUID().slice(0,12)}`;
    const display=typeof claims.name==='string'?claims.name.replace(/[\u0000-\u001f\u007f<>]/gu,'').slice(0,80):'新洛克';
    try {await env.DB.batch([
      env.DB.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').bind(uid,username,display||'新洛克',now()),
      env.DB.prepare('INSERT INTO oidc_identities(issuer,subject,uid) VALUES(?,?,?)').bind(env.OIDC_ISSUER,claims.sub,uid)
    ]);} catch(error) {
      identity=await env.DB.prepare('SELECT uid FROM oidc_identities WHERE issuer=? AND subject=?').bind(env.OIDC_ISSUER,claims.sub).first<{uid:string}>();
      if(!identity)throw error;
    }
    identity??={uid};
  }
  const active=await env.DB.prepare('SELECT uid FROM users WHERE uid=? AND disabled_at IS NULL').bind(identity.uid).first();
  if(!active)throw new Error('ACCOUNT_DISABLED');
  if(state.session_hash)await env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE id_hash=?').bind(now(),state.session_hash).run();
  return createSession(env,identity.uid,authenticatedAt);
}
