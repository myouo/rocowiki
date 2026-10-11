import {z} from 'zod';
import {api, RequestError} from '../../components/api';
import * as dto from './contracts';

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
  return {
    me:()=>request('/me',dto.me),
    profile:async(uid:string)=>{const result=await request(`/users/${encodeURIComponent(uid)}`,dto.publicProfile);if(result.user.uid!==uid)throw new RequestError('INVALID_SERVICE_RESPONSE');return result;},
    login:()=>request('/auth/login',redirect,'POST',{}),
    base:async(id:string)=>{const result=await request(`/pages/${encodeURIComponent(id)}/edit-base`,dto.base);if(result.page.id!==id)throw new RequestError('INVALID_SERVICE_RESPONSE');return result;},
    mine:()=>request('/submissions',z.object({submissions:z.array(dto.submissionRow)})),
    drafts:()=>request('/drafts',z.object({drafts:z.array(dto.draft)})),
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
  };
}
