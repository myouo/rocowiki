import React, {useEffect, useRef, useState} from "react";
import Link from "@docusaurus/Link";
import {createWorkspaceService} from "../../features/workbench/service";
import {message, RequestError} from "../../components/api";
import {useWikiRuntime} from "../runtime/useWikiRuntime";

/** Formal identity controls stay separate from the browser demonstration's wallet and profile. */
export default function AccountSessionPanel() {
  const {apiOrigin} = useWikiRuntime();
  const [me,setMe] = useState(null),[loading,setLoading] = useState(true),[busy,setBusy] = useState(false),[notice,setNotice] = useState('');
  const scope = useRef(null);
  useEffect(()=>{
    const controller=new AbortController();scope.current=controller;
    if(!apiOrigin){setLoading(false);return()=>controller.abort();}
    createWorkspaceService(String(apiOrigin),undefined,controller.signal).me().then(setMe)
      .catch(error=>{if(!controller.signal.aborted&&!(error instanceof RequestError&&error.code==='UNAUTHORIZED'))setNotice(message(error));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[apiOrigin]);
  async function act(kind){
    const controller=scope.current;setBusy(true);setNotice('');
    try{
      if(!apiOrigin)throw new RequestError('AUTH_NOT_CONFIGURED');
      const service=createWorkspaceService(String(apiOrigin),me?.csrf_token,controller?.signal);
      if(kind==='logout'){await service.logout();setMe(null);}
      else {const result=await(kind==='bind'?service.bind():service.login());window.location.assign(result.redirect_url);}
    }catch(error){if(!controller?.signal.aborted)setNotice(message(error));}
    finally{if(!controller?.signal.aborted)setBusy(false);}
  }
  return <section className="cm-paper rw-account-session" aria-label="正式站点账号">
    <div><span className="rw-social-local-tag">服务端身份</span><h2>站内账号与 GitHub 关联</h2></div>
    {loading?<p role="status">正在读取登录状态…</p>:me?<>
      <p>{me.user.display_name} · {me.user.role==='viewer'?'只读账号':me.user.role==='admin'?'管理员':me.user.role==='reviewer'?'审核员':'贡献者'}</p>
      <p>Wiki UID：<code>{me.user.uid}</code></p>
      <p>{me.github?`已关联 GitHub：${me.github.login}`:'尚未绑定 GitHub；不影响注册或投稿。'}</p>
      <div className="rw-actions">{!me.github&&<button type="button" className="rw-button" disabled={busy} onClick={()=>act('bind')}>绑定 GitHub</button>}<Link className="rw-button" to="/workbench/?tab=account">管理账号与贡献署名</Link><button type="button" className="rw-button" disabled={busy} onClick={()=>act('logout')}>退出登录</button></div>
    </>:<>
      <p>游客可阅读资料；编辑需要注册登录。注册使用已验证邮箱，GitHub 关联可选。</p>
      <button type="button" className="rw-button primary" disabled={busy} onClick={()=>act('login')}>注册 / 登录</button>
    </>}
    {notice&&<p role="status">{notice}</p>}
    <p className="rw-muted">下方积分、签到和点赞仍是本机体验记录，尚未接入服务端账本。</p>
  </section>;
}
