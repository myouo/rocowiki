// @ts-check
import React, {createContext, useContext, useEffect, useRef, useState} from "react";
import Link from "@docusaurus/Link";
import {createWorkspaceService} from "../../features/workbench/service";
import {message, RequestError} from "../../components/api";
import {useWikiRuntime} from "../runtime/useWikiRuntime";

// A normal React context permits explicit identity fixtures in component tests.
// Application code obtains identity from the authenticated API, never localStorage.
/** @typedef {{user: Pick<import('../../features/workbench/contracts').Me['user'], 'role'> | null, loading?: boolean}} VerifiedIdentity */
/** @typedef {{children: import('react').ReactNode, review?: boolean}} RoleProps */
export const VerifiedIdentityContext = createContext(/** @type {VerifiedIdentity|null} */(null));
const EDIT_ROLES = ["contributor", "reviewer", "admin"];
const REVIEW_ROLES = ["reviewer", "admin"];

/** @param {RoleProps} props */
export default function RequireRole({children, review = false}) {
  const supplied = useContext(VerifiedIdentityContext);
  return supplied ? <RoleDecision identity={supplied} review={review}>{children}</RoleDecision> : <RemoteRoleDecision review={review}>{children}</RemoteRoleDecision>;
}
/** @param {RoleProps & {identity: VerifiedIdentity, login?: ()=>Promise<void>, error?: string, busy?: boolean}} props */
function RoleDecision({identity, review, children, login, error = "", busy = false}) {
  const roles = review ? REVIEW_ROLES : EDIT_ROLES;
  if (identity.user && roles.includes(identity.user.role)) return children;
  return <section className="cm-root"><div className="cm-paper rw-auth-required">
    <h1>{identity.loading ? "正在验证账号" : identity.user ? "当前账号没有此操作权限" : "注册登录后参与编辑"}</h1>
    <p>{identity.user ? review ? "审核需要审核员或管理员权限。" : "当前账号可以阅读资料，编辑需要贡献者权限。" : "阅读资料无需登录。编辑与投稿使用已验证邮箱的站内账号，GitHub 绑定可选。"}</p>
    {error && <p role="status">{error}</p>}
    {!identity.loading && !identity.user && login && <button type="button" className="rw-button primary" disabled={busy} onClick={login}>注册 / 登录</button>}
    <Link className="rw-textlink" to="/workbench/">打开共建工作台</Link>
  </div></section>;
}
/** @param {RoleProps} props */
function RemoteRoleDecision({children, review}) {
  const {apiOrigin} = useWikiRuntime();
  const [identity, setIdentity] = useState(/** @type {VerifiedIdentity} */({user:null, loading:true}));
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const scope = useRef(/** @type {AbortController|null} */(null));
  useEffect(() => {
    const controller = new AbortController();
    scope.current = controller;
    if (!apiOrigin) { setIdentity({user:null, loading:false}); return ()=>controller.abort(); }
    createWorkspaceService(String(apiOrigin),undefined,controller.signal).me()
      .then(me=>setIdentity({user:me.user, loading:false}))
      .catch(reason=>{if(!controller.signal.aborted){setIdentity({user:null, loading:false});if(!(reason instanceof RequestError && reason.code==='UNAUTHORIZED'))setError(message(reason));}});
    return ()=>controller.abort();
  }, [apiOrigin]);
  async function login() {
    const controller = scope.current;
    setBusy(true);setError("");
    try {if(!apiOrigin)throw new RequestError('AUTH_NOT_CONFIGURED');const result=await createWorkspaceService(String(apiOrigin),undefined,controller?.signal).login();window.location.assign(result.redirect_url);}
    catch(reason){if(!controller?.signal.aborted)setError(message(reason));}
    finally{if(!controller?.signal.aborted)setBusy(false);}
  }
  return <RoleDecision identity={identity} review={review} login={login} error={error} busy={busy}>{children}</RoleDecision>;
}
