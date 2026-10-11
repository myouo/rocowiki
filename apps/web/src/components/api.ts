export class RequestError extends Error {constructor(public code:string){super(code);}}
export const errorText:Record<string,string>={
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
