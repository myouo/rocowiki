import React,{useEffect,useState} from 'react';
import Link from '@docusaurus/Link';
import {registerSchema,passwordSchema} from '../../../../../packages/wiki-schema/src/account';
import {RequestError} from '../../components/api';
import type {WorkspaceService} from './service';
import type {AuthStatus} from './contracts';

type View='login'|'register'|'forgot'|'resend'|'verify'|'reset';
export function AuthenticationPanel({service,busy,action,login,notice}:{service:WorkspaceService;busy:boolean;action:(fn:()=>Promise<void>)=>Promise<void>;login:(identifier:string,password:string)=>Promise<void>;notice:(value:string)=>void}){
  const [view,setView]=useState<View>('login'),[identifier,setIdentifier]=useState(''),[email,setEmail]=useState(''),[username,setUsername]=useState(''),[nickname,setNickname]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[token,setToken]=useState(''),[status,setStatus]=useState<AuthStatus|null>(null);
  useEffect(()=>{
    let active=true;
    service.authStatus().then(value=>{if(active)setStatus(value);}).catch(()=>{});
    const params=new URLSearchParams(window.location.hash.slice(1));
    for(const kind of ['verify','reset'] as const){const value=params.get(kind);if(value&&/^[a-f0-9]{64}$/.test(value)){setToken(value);setView(kind);window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);break;}}
    return()=>{active=false;};
  },[service]);
  function switchView(next:View){setView(next);setPassword('');setConfirmation('');notice('');}
  async function submit(){
    try{
      if(view==='login'){await login(identifier,password);return;}
      if(view==='register'){
        if(password!==confirmation)throw new RequestError('PASSWORD_CONFIRMATION_MISMATCH');
        const parsed=registerSchema.safeParse({email,username,display_name:nickname,password});
        if(!parsed.success)throw new RequestError('INVALID_REGISTRATION');
        const result=await service.register(parsed.data);setIdentifier(parsed.data.username);setView('login');
        notice(result.verification_required?'注册信息已保存，请打开邮箱中的验证链接，再登录。':'注册成功，可以使用邮箱或用户名登录。');return;
      }
      if(view==='verify'){await service.verifyEmail(token,password);setToken('');setView('login');notice('邮箱验证成功，请输入密码登录。');return;}
      if(view==='reset'){
        if(password!==confirmation)throw new RequestError('PASSWORD_CONFIRMATION_MISMATCH');
        if(!passwordSchema.safeParse(password).success)throw new RequestError('INVALID_PASSWORD');
        await service.resetPassword(token,password);setToken('');setView('login');notice('密码已重置，原有登录已退出，请重新登录。');return;
      }
      if(view==='forgot')await service.requestReset(identifier);else await service.resendVerification(identifier);
      notice('若账号符合条件，我们会发送邮件。请检查收件箱和垃圾邮件。');
    }finally{setPassword('');setConfirmation('');}
  }
  return <section className="auth-panel"><h2>{({login:'登录 RocoWiki',register:'创建你的账号',forgot:'找回密码',resend:'重新发送验证邮件',verify:'确认验证邮箱',reset:'设置新密码'} as Record<View,string>)[view]}</h2>
    <p>用户名是固定的登录标识，昵称用于展示。GitHub 绑定可选。</p>
    <form onSubmit={event=>{event.preventDefault();void action(submit);}}>
      {['login','forgot','resend'].includes(view)&&<label className="field">邮箱或用户名<input name="identifier" autoComplete="username" required maxLength={254} value={identifier} onChange={e=>setIdentifier(e.target.value)} /></label>}
      {view==='register'&&<><label className="field">邮箱<input name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} /><small>邮箱不公开，用于登录和账号验证。</small></label>
        <label className="field">用户名<input name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z][A-Za-z0-9_-]*" value={username} onChange={e=>setUsername(e.target.value)} /><small>3–24 位，以字母开头，可包含字母、数字、下划线和连字符。不区分大小写，注册后不可更改。</small></label>
        <label className="field">昵称<input name="display_name" autoComplete="nickname" required maxLength={80} value={nickname} onChange={e=>setNickname(e.target.value)} /><small>展示给其他读者，可以修改。</small></label></>}
      {['login','register','reset','verify'].includes(view)&&<label className="field">{view==='reset'?'新密码':view==='verify'?'注册时设置的密码':'密码'}<input name="password" type="password" autoComplete={['login','verify'].includes(view)?'current-password':'new-password'} required minLength={['login','verify'].includes(view)?1:15} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} />{['register','reset'].includes(view)&&<small>15–128 个字符，支持空格和中文；建议使用密码管理器。</small>}</label>}
      {['register','reset'].includes(view)&&<label className="field">再次输入密码<input name="password_confirmation" type="password" autoComplete="new-password" required minLength={15} maxLength={128} value={confirmation} onChange={e=>setConfirmation(e.target.value)} /></label>}
      {view==='verify'&&<p>输入注册密码并点击确认，完成邮箱验证。请忽略非本人发起的验证邮件。</p>}
      {view==='register'&&status&&!status.registration_enabled&&<p role="status">注册暂未开放，请稍后再来。</p>}
      <button className="button button--primary" type="submit" disabled={busy||(view==='register'&&status?.registration_enabled===false)}>{({login:'登录',register:'注册',forgot:'发送找回邮件',resend:'发送验证邮件',verify:'确认验证',reset:'保存新密码'} as Record<View,string>)[view]}</button>
    </form>
    <div className="auth-links">{view!=='login'&&<button type="button" className="text-button" disabled={busy} onClick={()=>switchView('login')}>返回登录</button>}{view==='login'&&<><button type="button" className="text-button" disabled={busy} onClick={()=>switchView('register')}>创建账号</button>{status?.password_reset_available&&<><button type="button" className="text-button" disabled={busy} onClick={()=>switchView('forgot')}>忘记密码</button><button type="button" className="text-button" disabled={busy} onClick={()=>switchView('resend')}>重新验证邮箱</button></>}</>}
      <Link to="/wiki/guides/contributing">了解投稿流程 ↗</Link></div>
  </section>;
}
