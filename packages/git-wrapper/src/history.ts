// SPDX-License-Identifier: GPL-3.0-only
import {z} from 'zod';
import {historySha,type HistorySource} from '../../wiki-schema/src/history';
import type {ApiEnv} from '../../../apps/api/src/types';
import {GitError} from './index';

const actor=z.object({id:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),login:z.string().regex(/^[a-zA-Z0-9-]{1,39}(?:\[bot\])?$/)}).nullable();
const commit=z.object({sha:historySha,author:actor,commit:z.object({message:z.string().max(100000),author:z.object({name:z.string().max(500),date:z.string().datetime({offset:true})})})});
const file=z.object({filename:z.string(),status:z.string(),additions:z.number().int().nonnegative(),deletions:z.number().int().nonnegative(),patch:z.string().max(1500000).optional()});
export type PublicGitCommit=z.infer<typeof commit>;

/** Log a fixed diagnostic category, never an upstream URL, message or credential. */
export function historyFailureReason(cause:unknown):string {
  if(!(cause instanceof Error))return 'unknown';
  if(cause.message.includes('Illegal invocation'))return 'fetch_context';
  if(/redirect/i.test(cause.message))return 'redirect_option';
  if(cause.name==='TimeoutError'||cause.name==='AbortError')return 'timeout';
  return 'network';
}

/** Read-only public repository access is independent of the publishing App. */
export class PublicGitHistory {
  readonly repository:string;
  private readonly api:string;
  constructor(env:Pick<ApiEnv,'GITHUB_OWNER'|'GITHUB_REPO'|'GITHUB_DEFAULT_BRANCH'>,private http:typeof fetch=fetch,private cache?:Cache) {
    if(!/^[a-zA-Z0-9-]{1,39}$/.test(env.GITHUB_OWNER)||!/^[a-zA-Z0-9_.-]{1,100}$/.test(env.GITHUB_REPO)||!env.GITHUB_DEFAULT_BRANCH)throw new GitError('HISTORY_NOT_CONFIGURED',503);
    this.repository=`https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
    this.api=`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
    this.branch=env.GITHUB_DEFAULT_BRANCH;
  }
  private branch:string;
  private async read<T>(route:string,schema:z.ZodType<T>,ttl=300):Promise<T> {
    const url=this.api+route,key=new Request(url,{headers:{Accept:'application/vnd.github+json'}});
    const cached=await this.cache?.match(key);
    if(cached){try{return schema.parse(await cached.json());}catch{/* Refresh invalid cached data. */}}
    let response:Response;
    // Native Workers fetch must not receive this adapter as its receiver.
    const http=this.http;
    // Workers accepts manual/follow. Handle redirects as unsuccessful responses.
    try {response=await http(url,{headers:{Accept:'application/vnd.github+json','User-Agent':'RocoWiki','X-GitHub-Api-Version':'2022-11-28'},redirect:'manual',signal:AbortSignal.timeout(12000)});}
    catch(error) {const failure=new GitError('HISTORY_UNAVAILABLE',502);failure.cause=error;throw failure;}
    if(!response.ok){await response.body?.cancel();throw new GitError(response.status===429||response.status===403?'HISTORY_RATE_LIMITED':'HISTORY_UNAVAILABLE',response.status===429||response.status===403?503:502);}
    // GitHub patches and messages can be large. Bound streamed input before parsing.
    const reader=response.body?.getReader();if(!reader)throw new GitError('HISTORY_UNAVAILABLE',502);
    const chunks:Uint8Array[]=[];let size=0;
    for(;;){const result=await reader.read();if(result.done)break;size+=result.value.length;if(size>2*1024*1024){await reader.cancel();throw new GitError('HISTORY_UNAVAILABLE',502);}chunks.push(result.value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    let value:T;
    try{value=schema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch{throw new GitError('HISTORY_UNAVAILABLE',502);}
    // Cache provider data only. Wiki attribution is resolved fresh after every read.
    if(this.cache)await this.cache.put(key,Response.json(value,{headers:{'Cache-Control':`public,max-age=${ttl}`}}));
    return value;
  }
  async head() {return (await this.read(`/git/ref/heads/${encodeURIComponent(this.branch)}`,z.object({object:z.object({sha:historySha})}),300)).object.sha;}
  async reference(requested?:string) {
    const head=await this.head();if(!requested||requested===head)return head;
    historySha.parse(requested);
    const comparison=await this.read(`/compare/${requested}...${head}?per_page=1`,z.object({status:z.enum(['ahead','behind','identical','diverged'])}),86400);
    if(!['ahead','identical'].includes(comparison.status))throw new GitError('HISTORY_REF_NOT_PUBLISHED',400);
    return requested;
  }
  async list(source:HistorySource,ref:string,cursor:number) {
    historySha.parse(ref);
    return this.read(`/commits?${new URLSearchParams({path:source.path,sha:ref,per_page:'20',page:String(cursor)})}`,z.array(commit).max(20),86400);
  }
  async diff(source:HistorySource,sha:string) {
    // Never expose an unpublished candidate just because its SHA is known.
    await this.reference(sha);
    const detail=await this.read(`/commits/${sha}`,z.object({sha:historySha,files:z.array(file).max(300)}),86400);
    if(detail.sha!==sha)throw new GitError('HISTORY_UNAVAILABLE',502);
    const changed=detail.files.find(row=>row.filename===source.path);
    if(!changed){
      // GitHub returns at most 300 files in this preview. Do not mistake an
      // incomplete large-commit listing for proof that the source was unchanged.
      if(detail.files.length===300)return {sha,source:source.id,status:'preview_unavailable',additions:null,deletions:null,patch:null};
      throw new GitError('HISTORY_DIFF_NOT_FOUND',404);
    }
    return {sha,source:source.id,status:changed.status,additions:changed.additions,deletions:changed.deletions,patch:changed.patch&&changed.patch.length<=160000?changed.patch:null};
  }
}
