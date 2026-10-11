import { SignJWT, importPKCS8 } from 'jose';
import { createPrivateKey } from 'node:crypto';
import { contentPath, metadataPath, pageFor, shaSchema, sourceSchema, type CatalogEntry } from '../../wiki-schema/src/index';
import { z } from 'zod';
import { validateStoredContent } from '../../content-validator/src/index';
import type { ApiEnv } from '../../../apps/api/src/types';
import { now,hash } from '../../auth/src/index';

export interface EditBase {commit_sha:string;blob_sha:string;content:string;}
export interface Coauthor {github_id:number;binding_version:string;name:string;email:string;consent_version:string;}
export interface GitCandidate {revision_id:string;uid:string;page_id:string;content:string;base_blob_sha:string;coauthor:Coauthor|null;sources:z.infer<typeof sourceSchema>[];}
export interface GitLink {branch:string;content_commit_sha:string;pr_number:number;}
export interface PullState {merged:boolean;merge_sha:string|null;closed:boolean;head_sha:string;}
export type CoauthorAuthorization=()=>Promise<Coauthor|null>;
export interface GitPort {
  readPage(pageId:string,ref?:string):Promise<EditBase>;
  // Candidate attribution is historical. The callbacks gate future writes only.
  ensurePull(candidate:GitCandidate,canWrite?:()=>Promise<boolean>,authorizeCoauthor?:CoauthorAuthorization,knownLink?:GitLink):Promise<GitLink>;
  pullState(number:number):Promise<PullState>;
  contains(ancestor:string,descendant:string):Promise<boolean>;
}
export class GitError extends Error {constructor(public code:string,public status=502){super(code);}}
const encode=(value:string)=>encodeURIComponent(value);
function decodeBase64(value:string) {return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g,'')),c=>c.charCodeAt(0)));}
export function commitMessage(c:GitCandidate):string {
  if(!/^rev_[0-9a-f-]{36}$/.test(c.revision_id)||!/^usr_[0-9a-f-]{36}$/.test(c.uid))throw new GitError('INVALID_REVISION');
  shaSchema.parse(c.base_blob_sha);
  const trailer=[`wiki: update ${pageFor(c.page_id).id}`,'',`Wiki-Revision-ID: ${c.revision_id}`,`Wiki-User-ID: ${c.uid}`,`Wiki-Base-Blob-SHA: ${c.base_blob_sha}`];
  if(c.coauthor) {
    if(/[\r\n<>]/.test(c.coauthor.name)||!c.coauthor.name.trim()||!/^[-a-zA-Z0-9.!#$%&'*+/=?^_`{|}~]+@[a-zA-Z0-9.-]+$/.test(c.coauthor.email))throw new GitError('INVALID_COAUTHOR');
    trailer.push(`Co-authored-by: ${c.coauthor.name} <${c.coauthor.email}>`);
  }
  return trailer.join('\n');
}
export class GitHub implements GitPort {
  private token?:string;
  private expires=0;
  constructor(private env:ApiEnv,private http:typeof fetch=fetch) {}
  private async installationToken() {
    if(this.token&&this.expires>now()+60)return this.token;
    const e=this.env;
    if(!e.GITHUB_APP_ID||!e.GITHUB_INSTALLATION_ID||!e.GITHUB_APP_PRIVATE_KEY||!e.GITHUB_OWNER||!e.GITHUB_REPO)throw new GitError('GITHUB_NOT_CONFIGURED',503);
    const pem=createPrivateKey(e.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g,'\n')).export({format:'pem',type:'pkcs8'}).toString();
    const jwt=await new SignJWT({}).setProtectedHeader({alg:'RS256'}).setIssuer(e.GITHUB_APP_ID).setIssuedAt(now()-60).setExpirationTime(now()+540).sign(await importPKCS8(pem,'RS256'));
    const r=await this.http(`https://api.github.com/app/installations/${encode(e.GITHUB_INSTALLATION_ID)}/access_tokens`,{
      method:'POST',headers:{Authorization:`Bearer ${jwt}`,'User-Agent':'RocoWiki','Accept':'application/vnd.github+json','Content-Type':'application/json'},
      body:JSON.stringify({repositories:[e.GITHUB_REPO],permissions:{contents:'write',pull_requests:'write'}}),signal:AbortSignal.timeout(15000)
    });
    if(!r.ok)throw new GitError('GITHUB_AUTH_FAILED',r.status);
    const value=await r.json() as {token:string;expires_at:string};
    this.token=value.token;this.expires=Date.parse(value.expires_at)/1000;return value.token;
  }
  private async api<T>(route:string,method='GET',body?:unknown):Promise<T> {
    const token=await this.installationToken();
    const r=await this.http(`https://api.github.com/repos/${encode(this.env.GITHUB_OWNER)}/${encode(this.env.GITHUB_REPO)}${route}`,{
      method,headers:{Authorization:`Bearer ${token}`,'User-Agent':'RocoWiki','Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)
    });
    if(!r.ok)throw new GitError(r.status===429||r.status===403&&(r.headers.get('X-RateLimit-Remaining')==='0'||r.headers.has('Retry-After'))?'GITHUB_RATE_LIMITED':r.status===401||r.status===403?'GITHUB_PERMISSION_DENIED':'GITHUB_REQUEST_FAILED',r.status);
    return await r.json() as T;
  }
  private async head() {return (await this.api<{object:{sha:string}}>(`/git/ref/heads/${encode(this.env.GITHUB_DEFAULT_BRANCH)}`)).object.sha;}
  private async readFileAt(path:string,ref:string,limit=65536):Promise<{sha:string;body:string}> {
    const value=await this.api<{sha:string;content?:string;type:string;size:number;encoding:string}>(`/contents/${path}?ref=${encode(ref)}`);
    if(value.type!=='file'||value.encoding!=='base64'||!value.content||value.size>limit)throw new GitError('INVALID_GIT_CONTENT');
    const body=decodeBase64(value.content);
    if(new TextEncoder().encode(body).length>limit)throw new GitError('INVALID_GIT_CONTENT');
    return {sha:value.sha,body};
  }
  private readAt(page:CatalogEntry,ref:string) {return this.readFileAt(contentPath(page),ref);}
  private async pathExists(page:CatalogEntry,ref:string):Promise<boolean> {
    // Contents 404 may hide missing repository access. Confirm against the
    // readable immutable commit/tree before treating an article as deleted.
    const commit=await this.api<{tree:{sha:string}}>(`/git/commits/${encode(ref)}`);
    let treeSha=shaSchema.parse(commit.tree.sha);
    const parts=contentPath(page).split('/');
    for(let index=0;index<parts.length;index++) {
      const tree=await this.api<{truncated:boolean;tree:{path:string;type:string;sha:string}[]}>(`/git/trees/${treeSha}`);
      if(tree.truncated!==false||!Array.isArray(tree.tree))throw new GitError('GIT_PAGE_LOOKUP_UNCONFIRMED');
      const entry=tree.tree.find(entry=>entry.path===parts[index]);
      if(!entry)return false;
      if(index===parts.length-1)return entry.type==='blob';
      if(entry.type!=='tree')return false;
      treeSha=shaSchema.parse(entry.sha);
    }
    return false;
  }
  async readPage(id:string,ref?:string):Promise<EditBase> {
    if(ref)shaSchema.parse(ref);
    const commit=ref??await this.head(),page=pageFor(id);
    try {
      const blob=await this.readAt(page,commit);
      return {commit_sha:commit,blob_sha:blob.sha,content:blob.body};
    } catch(error) {
      if(error instanceof GitError&&error.status===404) {
        if(!await this.pathExists(page,commit))throw new GitError('PAGE_DELETED',404);
        throw new GitError('GIT_PAGE_LOOKUP_UNCONFIRMED');
      }
      throw error;
    }
  }
  async ensurePull(c:GitCandidate,canWrite:()=>Promise<boolean>=async()=>true,authorizeCoauthor:CoauthorAuthorization=async()=>c.coauthor,knownLink?:GitLink):Promise<GitLink> {
    const page=pageFor(c.page_id);validateStoredContent(page,c.content);
    // c.coauthor is the immutable submission snapshot, never current consent.
    // A past write may legitimately have used that snapshot or omitted attribution.
    const historicalMessages=new Set([commitMessage(c),commitMessage({...c,coauthor:null})]),branch=`wiki/${c.revision_id}`;
    if(knownLink) {
      shaSchema.parse(knownLink.content_commit_sha);
      if(knownLink.branch!==branch||!Number.isSafeInteger(knownLink.pr_number)||knownLink.pr_number<1)throw new GitError('INVALID_GIT_LINK');
    }
    const metadata=JSON.stringify({page_id:page.id,revision_id:c.revision_id,public_uid:c.uid,snapshot_hash:await hash(c.content),sources:z.array(sourceSchema).min(1).max(20).parse(c.sources)},null,2)+'\n';
    const authorized=async()=>{
      const value=await authorizeCoauthor();
      const keys=['github_id','binding_version','name','email','consent_version'] as const;
      if(value&&(!c.coauthor||keys.some(key=>value[key]!==c.coauthor![key])))throw new GitError('INVALID_COAUTHOR_AUTHORIZATION');
      return value;
    };
    let existing:{object:{sha:string}}|undefined;
    try{existing=await this.api(`/git/ref/heads/${encode(branch)}`);}catch(e){if(!(e instanceof GitError&&e.status===404))throw e;}
    let contentSha:string;
    if(knownLink&&!existing)throw new GitError('EXISTING_BRANCH_MISSING',409);
    if(existing) {
      // A saved content commit remains authoritative when main was merged into
      // the PR after an interruption. Never replace it with the latest head.
      contentSha=knownLink?.content_commit_sha??existing.object.sha;
      const commit=await this.api<{message:string;parents:{sha:string}[];tree:{sha:string}}>(`/git/commits/${contentSha}`);
      const blob=await this.readAt(page,contentSha);
      if(!historicalMessages.has(commit.message)||blob.body!==c.content||commit.parents.length!==1)throw new GitError('EXISTING_BRANCH_MISMATCH');
      const parent=await this.readAt(page,commit.parents[0].sha);
      const storedMetadata=await this.readFileAt(metadataPath(page),contentSha,256*1024);
      if(parent.sha!==c.base_blob_sha||storedMetadata.body!==metadata)throw new GitError('EXISTING_BRANCH_MISMATCH');
      if(contentSha!==existing.object.sha) {
        if(!await this.contains(contentSha,existing.object.sha))throw new GitError('PR_SNAPSHOT_CHANGED',409);
        const head=await this.readAt(page,existing.object.sha);
        const headMetadata=await this.readFileAt(metadataPath(page),existing.object.sha,256*1024);
        if(head.body!==c.content||headMetadata.body!==metadata)throw new GitError('PR_SNAPSHOT_CHANGED',409);
      }
    } else {
      const base=await this.readPage(page.id);
      if(base.blob_sha!==c.base_blob_sha)throw new GitError('STALE_BASE',409);
      const parent=await this.api<{tree:{sha:string}}>(`/git/commits/${base.commit_sha}`);
      if(!await canWrite())throw new GitError('LEASE_LOST');
      const tree=await this.api<{sha:string}>('/git/trees','POST',{base_tree:parent.tree.sha,tree:[{path:contentPath(page),mode:'100644',type:'blob',content:c.content},{path:metadataPath(page),mode:'100644',type:'blob',content:metadata}]});
      if(!await canWrite())throw new GitError('LEASE_LOST');
      const coauthor=await authorized(),message=commitMessage({...c,coauthor});
      const commit=await this.api<{sha:string}>('/git/commits','POST',{message,tree:tree.sha,parents:[base.commit_sha]});
      contentSha=commit.sha;
      if(!await canWrite())throw new GitError('LEASE_LOST');
      if(coauthor&&!await authorized())throw new GitError('COAUTHOR_CONSENT_CHANGED');
      try{await this.api('/git/refs','POST',{ref:`refs/heads/${branch}`,sha:contentSha});}
      catch(e){if(e instanceof GitError&&e.status===422){await this.api(`/git/ref/heads/${encode(branch)}`);return this.ensurePull(c,canWrite,authorizeCoauthor,knownLink);}throw e;}
    }
    const pulls=await this.api<{number:number}[]>(`/pulls?state=all&head=${encode(`${this.env.GITHUB_OWNER}:${branch}`)}&base=${encode(this.env.GITHUB_DEFAULT_BRANCH)}&per_page=100`);
    if(pulls.length>1)throw new GitError('DUPLICATE_PR');
    if(knownLink&&pulls[0]?.number!==knownLink.pr_number)throw new GitError('EXISTING_PR_MISMATCH',409);
    if(pulls[0])return {branch,content_commit_sha:contentSha,pr_number:pulls[0].number};
    if(!await canWrite())throw new GitError('LEASE_LOST');
    const pr=await this.api<{number:number}>('/pulls','POST',{head:branch,base:this.env.GITHUB_DEFAULT_BRANCH,title:`wiki: update ${page.id}`,body:`Approved Wiki revision: ${c.revision_id}\n\nMerge with a merge commit after required checks and independent review. Merging main into this PR is allowed only if the original content commit, approved content and source metadata remain intact. Do not rebase or squash. Create a new reviewed revision if the page baseline changed.`});
    return {branch,content_commit_sha:contentSha,pr_number:pr.number};
  }
  async pullState(number:number):Promise<PullState> {
    const p=await this.api<{merged:boolean;merge_commit_sha:string|null;state:string;head:{sha:string};base:{ref:string}}>(`/pulls/${number}`);
    if(p.base.ref!==this.env.GITHUB_DEFAULT_BRANCH)throw new GitError('WRONG_BASE_BRANCH');
    if(p.merged&&p.merge_commit_sha){const commit=await this.api<{parents:unknown[]}>(`/git/commits/${p.merge_commit_sha}`);if(commit.parents.length!==2)throw new GitError('MERGE_COMMIT_REQUIRED');}
    return {merged:p.merged,merge_sha:p.merge_commit_sha,closed:p.state==='closed',head_sha:p.head.sha};
  }
  async contains(ancestor:string,descendant:string):Promise<boolean> {
    shaSchema.parse(ancestor);shaSchema.parse(descendant);
    const r=await this.api<{status:string}>(`/compare/${ancestor}...${descendant}`);
    return r.status==='identical'||r.status==='ahead';
  }
}
