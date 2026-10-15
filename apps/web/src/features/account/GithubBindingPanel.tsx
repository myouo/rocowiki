// SPDX-License-Identifier: GPL-3.0-only
import React,{useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,ChevronDown,Link2,LockKeyhole} from 'lucide-react';
import {GithubMark} from '../../wiki/AccountIdentity';
import {message,RequestError} from '../../components/api';
import {createWorkspaceService,type WorkspaceService} from '../workbench/service';
import type {Me} from '../workbench/contracts';

type Operation=(service:WorkspaceService,identity:Me)=>Promise<void>;
const callbackMessages:Record<string,string>={cancelled:'你已取消 GitHub 授权，可以随时重新关联。',expired:'本次授权已过期，请验证当前密码后重新关联。','account-changed':'登录账号已变化，本次关联未保存。请确认当前账号后重试。','already-bound':'这个 GitHub 账号已关联另一个 Wiki 账号，请选择其他 GitHub 账号。',unavailable:'GitHub 关联服务暂未开放。',failed:'本次 GitHub 关联未完成，请重新尝试。'};

export default function GithubBindingPanel({origin,me,result,refresh,onIdentityError}:{origin:string;me:Me;result:string|null;refresh:()=>Promise<unknown>;onIdentityError:(error:unknown)=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[password,setPassword]=useState(''),[reauth,setReauth]=useState(false),[consent,setConsent]=useState(false),[confirmUnbind,setConfirmUnbind]=useState(false),[detailsOpen,setDetailsOpen]=useState(false);
  const lifetime=useRef<AbortController|null>(null),acting=useRef(false),pending=useRef<Operation|null>(null),handled=useRef(false),heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{const scope=new AbortController();lifetime.current=scope;return()=>scope.abort();},[]);
  useEffect(()=>{
    if(!result||handled.current)return;
    handled.current=true;
    if(result==='bound')setNotice(me.github?'GitHub 账号已关联，投稿署名由你另行选择。':'关联结果尚未确认，请重新读取账号状态。');
    else if(Object.hasOwn(callbackMessages,result))setError(callbackMessages[result]);
    const url=new URL(window.location.href);url.searchParams.delete('github');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
    heading.current?.focus();
  },[result,me.github]);

  async function run(operation:Operation,resume:Operation=operation) {
    const scope=lifetime.current;if(!scope||scope.signal.aborted||acting.current)return;
    acting.current=true;setBusy(true);setError('');setNotice('');
    try {await operation(createWorkspaceService(origin,me.csrf_token,scope.signal),me);}
    catch(failure) {
      if(!scope.signal.aborted){
        if(failure instanceof RequestError&&failure.code==='REAUTH_REQUIRED'){pending.current=resume;setReauth(true);}
        else {setError(message(failure));if(failure instanceof RequestError&&['UNAUTHORIZED','ACCOUNT_CHANGED'].includes(failure.code))onIdentityError(failure);}
      }
    } finally {if(!scope.signal.aborted){acting.current=false;setBusy(false);}}
  }
  const connect:Operation=async service=>{
    const response=await service.bind(),target=new URL(response.redirect_url);
    if(target.origin!=='https://github.com'||target.pathname!=='/login/oauth/authorize')throw new RequestError('INVALID_SERVICE_RESPONSE');
    lifetime.current?.signal.throwIfAborted();window.location.assign(target.toString());
  };
  async function verify(event:React.FormEvent) {
    event.preventDefault();
    const operation=pending.current;if(!operation)return;
    await run(async service=>{
      try {
        await service.reauthenticate({identifier:me.user.username,password});
        const identity=await service.me();if(identity.user.uid!==me.user.uid)throw new RequestError('ACCOUNT_CHANGED');
        await refresh();
        const scope=lifetime.current;if(!scope||scope.signal.aborted)return;
        await operation(createWorkspaceService(origin,identity.csrf_token,scope.signal),identity);
        if(!scope.signal.aborted){pending.current=null;setReauth(false);}
      } finally {if(!lifetime.current?.signal.aborted)setPassword('');}
    },operation);
  }
  const available=me.github_binding_available===true;
  return <section className="cm-paper cm-github-panel" id="github" aria-labelledby="account-github-title">
    <div className="cm-section-heading"><h2 id="account-github-title" ref={heading} tabIndex={-1}><GithubMark size={19}/>关联 GitHub</h2></div><span className={`cm-status ${me.github?'cm-status-success':'cm-status-neutral'}`}><span/>{me.github?'已关联':available?'未关联':'暂未开放'}</span>
    <p>{available||me.github?'Wiki 账号独立使用。关联 GitHub 后，可以选择为投稿添加 GitHub 署名。':'Wiki 账号独立使用。GitHub 关联尚未开放，启用后可以自愿关联账号，为选择的投稿添加署名。'}</p>
    {error&&<p className="cm-inline-error" role="alert">{error}</p>}{notice&&<p className="cm-inline-success" role="status">{notice}</p>}
    {me.github?<>
      <div className="account-github-identity"><GithubMark size={23}/><a href={`https://github.com/${encodeURIComponent(me.github.login)}`} target="_blank" rel="noreferrer">{me.github.login}<ArrowUpRight size={14}/></a><Check size={16}/></div>
      <details className="account-github-consent"><summary>投稿署名设置<ChevronDown size={15}/></summary><p>开启后，每次投稿仍需选择是否添加公开署名。已进入 Git 历史的邮箱无法保证撤回。</p><p>提交邮箱：<code>{me.github.coauthor_email||'暂无可核验邮箱'}</code></p>
        {!me.github.enabled&&<label className="checkbox-field"><input type="checkbox" checked={consent} disabled={busy||!me.github.coauthor_email} onChange={event=>setConsent(event.target.checked)}/>我同意在自己选择的投稿中公开此提交邮箱。</label>}
        <button type="button" className="cm-button" disabled={busy||!me.github.enabled&&(!consent||!me.github.coauthor_email)} onClick={()=>void run(async(service,identity)=>{await service.consent(!me.github!.enabled,identity.consent_version);await refresh();setConsent(false);setNotice(me.github!.enabled?'已关闭后续投稿署名。':'已开启投稿署名，提交时仍需再次选择。');})}>{me.github.enabled?'关闭投稿署名':'开启投稿署名'}</button>
      </details>
      <div className="account-github-actions">{confirmUnbind?<><span>确认解除这个 GitHub 账号的关联？</span><button className="cm-button" disabled={busy} onClick={()=>void run(async service=>{await service.unbind();await refresh();setConfirmUnbind(false);setNotice('GitHub 关联已解除。');})}>确认解除关联</button><button className="cm-text-button" disabled={busy} onClick={()=>setConfirmUnbind(false)}>取消</button></>:<button className="cm-text-button" disabled={busy} onClick={()=>setConfirmUnbind(true)}>解除关联</button>}</div>
    </>:available?<button type="button" className="cm-button" disabled={busy||reauth} onClick={()=>void run(connect)}><Link2 size={15}/>{busy?'正在连接…':'绑定 GitHub'}</button>:null}
    {reauth&&<form className="account-github-reauth" onSubmit={event=>void verify(event)}><h3><LockKeyhole size={16}/>验证身份后继续</h3><p>为保护账号关联，请输入当前 Wiki 账号的密码。</p>{me.account?<><label className="field">当前账号密码<input name="github_reauth_password" type="password" autoComplete="current-password" required maxLength={128} value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/></label><div className="account-github-actions"><button type="submit" className="cm-button cm-button-primary" disabled={busy}>{busy?'正在验证…':'验证并继续'}</button><button type="button" className="cm-text-button" disabled={busy} onClick={()=>{setReauth(false);setPassword('');pending.current=null;}}>取消</button></div></>:<p>请重新登录后再进行关联操作。</p>}</form>}
    <button type="button" className="cm-button" aria-expanded={detailsOpen} onClick={()=>setDetailsOpen(!detailsOpen)}>署名与绑定说明<ChevronDown size={15}/></button>{detailsOpen&&<div className="cm-github-detail"><h3>授权方式</h3><p>通过 GitHub 官方授权页面，仅请求读取账号和验证邮箱。不需要在 Wiki 中提供 GitHub 密码或访问令牌。</p><p>关联账号与公开投稿署名分别授权；关联成功不会自动公开提交邮箱。</p></div>}
  </section>;
}
