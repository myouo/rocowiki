export class RequestError extends Error {constructor(public code:string){super(code);}}
export const errorText:Record<string,string>={
  INSUFFICIENT_MARKS:'洛克印记还不够，继续积攒后再来兑换。',HONOR_NOT_OWNED:'先获得这件纪念物，再选择佩戴。',INVALID_HONOR_SLOT:'这件纪念物无法放在此位置。',UNKNOWN_HONOR_ITEM:'这件纪念物暂未收录。',
  COMMUNITY_DAY_CHANGED:'签到日期已经切换，请重新读取今天的状态后再试。',COMMUNITY_STREAK_CHANGED:'连签状态已经更新，请刷新后重试。',COMMUNITY_RECORD_UNCONFIRMED:'记录暂时无法确认，请重新读取状态；重试不会重复签到或兑换。',
  SELF_LIKE_FORBIDDEN:'自己的内容不计入自我点赞。',LIKE_TARGET_NOT_FOUND:'内容已被移除或尚未发布，暂时无法点赞。',COMMENT_NOT_FOUND:'这条评论已不存在。',INVALID_COMMUNITY_CURSOR:'记录位置已失效，请重新加载。',
  COMMENT_REMOVED:'这条评论之前已被移除，请重新发表。',
  ACCOUNT_CHANGED:'账号已在其他页面切换，请重新检查登录状态。',
  INVALID_CREDENTIALS:'邮箱、用户名或密码不正确。',EMAIL_VERIFICATION_REQUIRED:'请先验证注册邮箱，再登录。',ACCOUNT_UNAVAILABLE:'这个用户名或邮箱无法用于注册，请换一个或尝试登录。',REGISTRATION_PAUSED:'注册暂未开放。',
  INVALID_REGISTRATION:'请检查邮箱、用户名、昵称和密码。用户名需 3–24 位，密码需 15–128 个字符。',INVALID_PASSWORD:'密码需 15–128 个字符，请避开常见弱密码。',PASSWORD_CONFIRMATION_MISMATCH:'两次输入的密码不一致。',INVALID_DISPLAY_NAME:'昵称需 1–80 个字符，不能包含控制字符或尖括号。',
  INVALID_ACCOUNT_TOKEN:'验证链接已失效或已使用，请重新申请邮件。',CREDENTIALS_CHANGED:'密码或账号状态已变更，请重新登录。',MAIL_NOT_CONFIGURED:'邮箱验证与找回服务尚未开放。',MAIL_DELIVERY_FAILED:'邮件暂时发送失败，请稍后重新申请验证邮件。',
  UNAUTHORIZED:'请先登录。',FORBIDDEN:'当前账号没有此操作权限。',ORIGIN_REJECTED:'请求来源未通过验证。',CSRF_REJECTED:'会话验证已更新，请刷新工作台后重试。',
  AUTH_NOT_CONFIGURED:'登录服务尚未开放，请联系维护者。',GITHUB_NOT_CONFIGURED:'内容服务尚未开放，请联系维护者。',GITHUB_OAUTH_NOT_CONFIGURED:'GitHub 绑定服务尚未开放。',
  INVALID_OIDC_TOKEN:'身份验证信息已过期或不完整，请重新登录。',
  STALE_BASE:'页面已发生变化，请加载新基线、整理修改，再提交新的候选。',CONFLICT:'状态已变更，请重新加载后操作。',SELF_REVIEW_FORBIDDEN:'不能审核自己的投稿。',
  INVALID_CONTENT:'内容或字段未通过校验，请检查格式和来源。',RATE_LIMITED:'操作过于频繁，请稍后再试。',REAUTH_REQUIRED:'此操作需要近期身份验证，请重新登录。',
  COAUTHOR_CONSENT_REQUIRED:'请先绑定 GitHub 并同意公开提交邮箱。',NO_VERIFIED_COMMIT_EMAIL:'没有可核验的提交邮箱，暂时无法开启关联。',
  SUBMISSIONS_PAUSED:'投稿当前暂停，已发布资料仍可阅读。',EMPTY_CHANGE:'正文没有变化。',IDEMPOTENCY_MISMATCH:'投稿请求已变更，请重新发起提交。'
  ,INVALID_SERVICE_RESPONSE:'服务返回的数据格式有误，请重试或联系维护者。',INVALID_DRAFT:'草稿格式或编辑对象有误，原草稿已保留。',REQUEST_TIMEOUT:'请求超时，请重试。'
};
export function message(error:unknown):string {return error instanceof RequestError?errorText[error.code]||`操作未完成（${error.code}），请稍后重试。`:'暂时无法连接服务，请稍后再试。';}
export async function api<T>(origin:string,path:string,options:{method?:string;body?:unknown;csrf?:string;key?:string;signal?:AbortSignal;timeoutMs?:number}={}):Promise<T> {
  options.signal?.throwIfAborted();
  const controller=new AbortController();
  const abort=()=>controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(new RequestError('REQUEST_TIMEOUT')),options.timeoutMs??30000);
  try {
  const r=await fetch(origin+path,{method:options.method??'GET',credentials:'include',signal:controller.signal,headers:{'Content-Type':'application/json','X-Roco-Request':'1',...(options.csrf?{'X-CSRF-Token':options.csrf}:{}),...(options.key?{'Idempotency-Key':options.key}:{})},...(options.body!==undefined?{body:JSON.stringify(options.body)}:{})});
  let data:unknown;
  try{data=await r.json();}catch{throw new RequestError('INVALID_SERVICE_RESPONSE');}
  if(!r.ok){const error=data as {error?:{code?:unknown}};throw new RequestError(typeof error?.error?.code==='string'?error.error.code:'UPSTREAM_RETRYING');}
  return data as T;
  } catch(error) {if(controller.signal.aborted)throw controller.signal.reason;throw error;}
  finally {clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
