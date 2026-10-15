import {z} from 'zod';
import {api, RequestError} from '../../components/api';
import * as dto from './contracts';
import type {Registration,PasswordLogin} from '../../../../../packages/wiki-schema/src/account';
import {historyResponseSchema,historyDiffSchema} from '../../../../../packages/wiki-schema/src/history';
import {communitySnapshotSchema,calendarResponseSchema,checkinResponseSchema,rankingResponseSchema,discussionResponseSchema,activityResponseSchema,guideLikeResponseSchema,type CommunityProfile,type CommunityPeriod,type RankMetric,type ActivityView} from '../../../../../packages/wiki-schema/src/community';

function decode<T>(schema:z.ZodType<T>,value:unknown):T {
  const result=schema.safeParse(value);
  if(!result.success)throw new RequestError('INVALID_SERVICE_RESPONSE');
  return result.data;
}
export function parseDraft(draft:dto.Draft):dto.DraftBody {
  try {const data=decode(dto.draftBody,JSON.parse(draft.body_json));if(data.base.page.id!==draft.page_id)throw new Error('page mismatch');return data;}
  catch {throw new RequestError('INVALID_DRAFT');}
}
export function parseSources(content:string):dto.Source[] {
  try{return decode(z.array(dto.source),JSON.parse(content));}catch{throw new RequestError('INVALID_SERVICE_RESPONSE');}
}

/** HTTP and response validation stay here. Components only express user actions. */
export function createWorkspaceService(origin:string,csrf?:string,signal?:AbortSignal|(()=>AbortSignal|undefined)) {
  const request=async<T>(path:string,schema:z.ZodType<T>,method='GET',body?:unknown,key?:string)=>{
    if(!origin || origin==='undefined')throw new RequestError('AUTH_NOT_CONFIGURED');
    const currentSignal=typeof signal==='function'?signal():signal;
    currentSignal?.throwIfAborted();
    const value=await api<unknown>(origin,path,{method,body,csrf,key,signal:currentSignal});
    currentSignal?.throwIfAborted();
    return decode(schema,value);
  };
  const ok=z.object({ok:z.boolean()});
  const redirect=z.object({redirect_url:z.string().url().refine(value=>{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;})});
  async function owned<T extends {owner_uid?:string}>(path:string,schema:z.ZodType<T>,expectedUid?:string,method='GET',body?:unknown,key?:string):Promise<T>{
    const result=await request(path,schema,method,body,key);
    if(expectedUid&&result.owner_uid!==expectedUid)throw new RequestError(result.owner_uid?'ACCOUNT_CHANGED':'INVALID_SERVICE_RESPONSE');
    return result;
  }
  return {
    me:()=>request('/me',dto.me),
    profile:async(uid:string)=>{const result=await request(`/users/${encodeURIComponent(uid)}`,dto.publicProfile);if(result.user.uid!==uid)throw new RequestError('INVALID_SERVICE_RESPONSE');return result;},
    history:async(page:string,source?:string,cursor=1,ref?:string)=>{const result=await request(`/history?${new URLSearchParams({page,cursor:String(cursor),...(source?{source}:{}),...(ref?{ref}:{})})}`,historyResponseSchema);if(result.page!==page||source&&result.source.id!==source||ref&&result.ref!==ref)throw new RequestError('INVALID_SERVICE_RESPONSE');return result;},
    historyDiff:async(page:string,source:string,sha:string)=>{const result=await request(`/history/diff?${new URLSearchParams({page,source,sha})}`,historyDiffSchema);if(result.sha!==sha||result.source!==source)throw new RequestError('INVALID_SERVICE_RESPONSE');return result;},
    authStatus:()=>request('/health',dto.authStatus),
    login:(input:PasswordLogin)=>request('/auth/login',ok,'POST',input),
    register:(input:Registration)=>request('/auth/register',z.object({verification_required:z.boolean()}),'POST',input),
    reauthenticate:(input:PasswordLogin)=>request('/auth/reauthenticate',ok,'POST',input),
    updateProfile:(display_name:string,profile?:Pick<CommunityProfile,'avatar'|'bio'>)=>request('/me',ok,'PATCH',{display_name,...profile}),
    changePassword:(current_password:string,new_password:string)=>request('/auth/password/change',ok,'POST',{current_password,new_password}),
    requestReset:(identifier:string)=>request('/auth/password/request-reset',ok,'POST',{identifier}),
    resendVerification:(identifier:string)=>request('/auth/email/resend',ok,'POST',{identifier}),
    verifyEmail:(token:string,password:string)=>request('/auth/email/verify',ok,'POST',{token,password}),
    resetPassword:(token:string,password:string)=>request('/auth/password/reset',ok,'POST',{token,password}),
    base:async(id:string)=>{const result=await request(`/pages/${encodeURIComponent(id)}/edit-base`,dto.base);if(result.page.id!==id)throw new RequestError('INVALID_SERVICE_RESPONSE');return result;},
    mine:(uid?:string)=>owned('/submissions',z.object({owner_uid:z.string().optional(),submissions:z.array(dto.submissionRow)}),uid),
    drafts:(uid?:string)=>owned('/drafts',z.object({owner_uid:z.string().optional(),drafts:z.array(dto.draft)}),uid),
    reviews:()=>request('/reviews',z.object({submissions:z.array(dto.submissionRow)})),
    jobs:()=>request('/admin/jobs',z.object({jobs:z.array(dto.job)})),
    detail:async(id:string)=>{const result=await request(`/submissions/${encodeURIComponent(id)}`,dto.submission);if(result.revision_id!==id)throw new RequestError('INVALID_SERVICE_RESPONSE');return result;},
    saveDraft:(id:string,pageId:string,body:dto.DraftBody)=>{if(body.base.page.id!==pageId)throw new RequestError('INVALID_DRAFT');return request(`/drafts/${encodeURIComponent(id)}`,z.object({draft_id:z.string()}),'PUT',{page_id:pageId,body});},
    deleteDraft:(id:string)=>request(`/drafts/${encodeURIComponent(id)}`,ok,'DELETE'),
    preview:(markdown:string)=>request('/preview',z.object({html:z.string()}),'POST',{content_markdown:markdown}),
    submit:(input:unknown,key:string)=>request('/submissions',z.object({revision_id:z.string()}),'POST',input,key),
    decide:(id:string,verdict:string,comment:string,version:number)=>request(`/reviews/${encodeURIComponent(id)}/decision`,dto.submission,'POST',{verdict,comment,version}),
    cancel:(id:string)=>request(`/submissions/${encodeURIComponent(id)}/cancel`,ok,'POST',{}),
    retry:(id:string)=>request(`/admin/jobs/${encodeURIComponent(id)}/retry`,ok,'POST',{}),
    consent:(enabled:boolean,consent_version:string)=>request('/me/github/consent',ok,'POST',{enabled,consent_version}),
    unbind:()=>request('/me/github',ok,'DELETE'),
    bind:()=>request('/auth/github/start',redirect,'POST',{}),
    logout:()=>request('/auth/logout',ok,'POST',{}),
    community:(uid:string)=>owned('/community/me',communitySnapshotSchema,uid),
    checkIn:(uid:string)=>owned('/community/checkin',checkinResponseSchema,uid,'POST',{}),
    checkins:(uid:string,start:string,end:string)=>owned(`/community/checkins?${new URLSearchParams({start,end})}`,calendarResponseSchema,uid),
    redeem:(uid:string,item_id:string)=>owned('/community/redeem',z.object({owner_uid:z.string(),item_id:z.string()}),uid,'POST',{item_id}),
    equip:(uid:string,slot:'badge'|'frame',item_id:string)=>owned('/community/equip',z.object({owner_uid:z.string(),slot:z.enum(['badge','frame']),item_id:z.string()}),uid,'POST',{slot,item_id}),
    rankings:async(metric:RankMetric,period:CommunityPeriod,uid?:string)=>{const result=await request(`/community/rankings?${new URLSearchParams({metric,period})}`,rankingResponseSchema);if(uid&&result.owner_uid!==uid)throw new RequestError('ACCOUNT_CHANGED');return result;},
    discussion:async(page:string,uid?:string)=>{const result=await request(`/community/discussion?${new URLSearchParams({page})}`,discussionResponseSchema);if(result.page!==page)throw new RequestError('INVALID_SERVICE_RESPONSE');if(uid&&result.owner_uid!==uid)throw new RequestError('ACCOUNT_CHANGED');return result;},
    guideLike:async(id:string,uid?:string)=>{const result=await request(`/community/guide-like?${new URLSearchParams({id})}`,guideLikeResponseSchema);if(result.target_id!==id)throw new RequestError('INVALID_SERVICE_RESPONSE');if(uid&&result.owner_uid!==uid)throw new RequestError('ACCOUNT_CHANGED');return result;},
    comment:(uid:string,page:string,title:string,body:string,key:string)=>owned('/community/comments',z.object({owner_uid:z.string(),comment_id:z.string()}),uid,'POST',{page,title,body},key),
    removeComment:(uid:string,id:string)=>owned(`/community/comments/${encodeURIComponent(id)}`,z.object({owner_uid:z.string(),ok:z.boolean()}),uid,'DELETE'),
    like:(uid:string,target_type:'comment'|'guide',target_id:string,active:boolean)=>owned('/community/likes',z.object({owner_uid:z.string(),active:z.boolean()}),uid,'POST',{target_type,target_id,active}),
    activity:(uid:string,view:ActivityView,period:CommunityPeriod,cursor?:string)=>owned(`/community/activity?${new URLSearchParams({view,period,...(cursor?{cursor}:{})})}`,activityResponseSchema,uid),
  };
}
export type WorkspaceService=ReturnType<typeof createWorkspaceService>;
