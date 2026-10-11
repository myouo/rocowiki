import type { ApiEnv, AuthSession } from './types';
import { randomToken, hash, now, consumeState, recentAuthMaxAge } from '../../../packages/auth/src/index';
import * as oidc from 'openid-client';

export const consentVersion='coauthor-public-git-v1';
function recent(session:AuthSession) {if(!Number.isSafeInteger(session.authenticated_at)||session.authenticated_at<=0||session.authenticated_at>now()||now()-session.authenticated_at>recentAuthMaxAge)throw new Error('REAUTH_REQUIRED');}
export async function startGithub(env:ApiEnv,session:AuthSession) {
  recent(session);
  if(!env.GITHUB_OAUTH_CLIENT_ID||!env.GITHUB_OAUTH_CLIENT_SECRET)throw new Error('GITHUB_OAUTH_NOT_CONFIGURED');
  const state=randomToken(),browser=randomToken(),verifier=oidc.randomPKCECodeVerifier();
  await env.DB.prepare('INSERT INTO oauth_states(state_hash,provider,uid,session_hash,browser_hash,verifier,expires_at) VALUES(?,?,?,?,?,?,?)').bind(await hash(state),'github',session.uid,session.id_hash,await hash(browser),verifier,now()+600).run();
  const url=new URL('https://github.com/login/oauth/authorize');
  url.search=new URLSearchParams({client_id:env.GITHUB_OAUTH_CLIENT_ID,redirect_uri:`${env.API_ORIGIN}/auth/github/callback`,scope:'read:user user:email',state,code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256'}).toString();
  return {url:url.toString(),browser};
}
export async function finishGithub(env:ApiEnv,request:Request) {
  const state=await consumeState(env,request,'github');
  if(!state.uid||!state.session_hash)throw new Error('INVALID_OAUTH_STATE');
  const session=await env.DB.prepare('SELECT authenticated_at FROM sessions WHERE id_hash=? AND revoked_at IS NULL AND expires_at>?').bind(state.session_hash,now()).first<{authenticated_at:number}>();
  if(!session||!Number.isSafeInteger(session.authenticated_at)||session.authenticated_at<=0||session.authenticated_at>now()||now()-session.authenticated_at>1200)throw new Error('REAUTH_REQUIRED');
  const code=new URL(request.url).searchParams.get('code');if(!code)throw new Error('INVALID_OAUTH_CODE');
  const response=await fetch('https://github.com/login/oauth/access_token',{
    method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},signal:AbortSignal.timeout(15000),
    body:JSON.stringify({client_id:env.GITHUB_OAUTH_CLIENT_ID,client_secret:env.GITHUB_OAUTH_CLIENT_SECRET,code,code_verifier:state.verifier,redirect_uri:`${env.API_ORIGIN}/auth/github/callback`})
  });
  const token=await response.json() as {access_token?:string};if(!response.ok||!token.access_token)throw new Error('GITHUB_OAUTH_FAILED');
  const headers={Authorization:`Bearer ${token.access_token}`,Accept:'application/vnd.github+json','User-Agent':'RocoWiki'};
  const [userResponse,emailResponse]=await Promise.all([
    fetch('https://api.github.com/user',{headers,signal:AbortSignal.timeout(15000)}),
    fetch('https://api.github.com/user/emails?per_page=100',{headers,signal:AbortSignal.timeout(15000)})
  ]);
  if(!userResponse.ok||!emailResponse.ok)throw new Error('GITHUB_IDENTITY_FAILED');
  const user=await userResponse.json() as {id:number;login:string};
  const emails=await emailResponse.json() as {email:string;verified:boolean;primary:boolean}[];
  if(!Number.isSafeInteger(user.id)||user.id<=0||!/^[a-zA-Z0-9-]{1,39}$/.test(user.login)||!Array.isArray(emails))throw new Error('INVALID_GITHUB_IDENTITY');
  // Never synthesize noreply addresses from the ID/login; only use addresses GitHub actually verifies.
  const verified=emails.filter(v=>v.verified&&/^[^\s<>\r\n]+@[^\s<>\r\n]+$/.test(v.email));
  const chosen=verified.find(v=>v.email.endsWith('@users.noreply.github.com'))??verified.find(v=>v.primary);
  const owner=await env.DB.prepare('SELECT uid FROM github_identities WHERE github_numeric_id=?').bind(user.id).first<{uid:string}>();
  if(owner&&owner.uid!==state.uid)throw new Error('GITHUB_ALREADY_BOUND');
  // Binding is always separate from explicit disclosure consent; (re)binding resets consent.
  await env.DB.batch([
    env.DB.prepare('INSERT INTO github_identities(uid,github_numeric_id,login,coauthor_email,enabled,binding_version) VALUES(?,?,?,?,0,?) ON CONFLICT(uid) DO UPDATE SET github_numeric_id=excluded.github_numeric_id,login=excluded.login,coauthor_email=excluded.coauthor_email,enabled=0,consent_version=NULL,consent_at=NULL,binding_version=excluded.binding_version').bind(state.uid,user.id,user.login,chosen?.email??null,crypto.randomUUID()),
    env.DB.prepare("INSERT INTO audit_events(event_id,actor_uid,action,target_id,ts) VALUES(?,?,'github_bound',?,?)").bind(crypto.randomUUID(),state.uid,state.uid,now())
  ]);
}
export function requireRecent(session:AuthSession) {recent(session);}
