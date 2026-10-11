import {vi,expect} from 'vitest';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {contentPath,metadataPath,pageFor} from '../packages/wiki-schema/src/index';
import type {GitCandidate} from '../packages/git-wrapper/src/index';
import {TestDatabase} from './d1';

/** GitHub HTTP boundary with real Git wrapper; mutations survive response loss. */
export function githubFixture(db:TestDatabase,c:GitCandidate,loss:'ref'|'pull'|null='pull') {
  const baseSha='a'.repeat(40),page=pageFor(c.page_id),prefix='/repos/wiki/content';
  const env=db.env({PUBLISH_ENABLED:'true',GITHUB_OWNER:'wiki',GITHUB_REPO:'content',GITHUB_APP_ID:'1',GITHUB_INSTALLATION_ID:'2',GITHUB_APP_PRIVATE_KEY:generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({format:'pem',type:'pkcs8'}).toString()});
  const counts={commits:0,refs:0,pulls:0};
  const remote={branch:null as string|null,pull:false,message:'',content:c.content,metadata:'',parentBlob:c.base_blob_sha,parentCount:1,containsOriginal:true};
  const commits=new Map<string,{message:string;content:string;metadata:string}>();
  const trees:{tree:{path:string;content:string}[]}[]=[],messages:string[]=[];
  let lose=loss;
  const file=(content:string,sha=c.base_blob_sha)=>Response.json({sha,type:'file',encoding:'base64',size:Buffer.byteLength(content),content:Buffer.from(content).toString('base64')});
  const http:typeof fetch=vi.fn(async(input,init)=>{
    const url=new URL(String(input)),path=url.pathname,body=init?.body?JSON.parse(String(init.body)):null;
    if(path==='/app/installations/2/access_tokens') {
      expect(body).toEqual({repositories:['content'],permissions:{contents:'write',pull_requests:'write'}});
      return Response.json({token:'installation',expires_at:new Date(Date.now()+3600000).toISOString()});
    }
    if(path===`${prefix}/git/ref/heads/main`)return Response.json({object:{sha:baseSha}});
    if(path.startsWith(`${prefix}/git/ref/heads/wiki`))return remote.branch?Response.json({object:{sha:remote.branch}}):new Response('{}',{status:404});
    if(path===`${prefix}/contents/${contentPath(page)}`) {
      const ref=url.searchParams.get('ref');
      if(ref===remote.branch)return file(remote.content);
      if(ref&&commits.has(ref))return file(commits.get(ref)!.content);
      return file('# Base',remote.parentBlob);
    }
    if(path===`${prefix}/contents/${metadataPath(page)}`)return file(url.searchParams.get('ref')===remote.branch?remote.metadata:commits.get(url.searchParams.get('ref')!)?.metadata??remote.metadata);
    if(path===`${prefix}/git/commits/${baseSha}`)return Response.json({tree:{sha:'tree-base'}});
    if(path===`${prefix}/git/commits/${remote.branch}`)return Response.json({message:remote.message,parents:Array.from({length:remote.parentCount},()=>({sha:baseSha})),tree:{sha:'new-tree'}});
    const old=commits.get(path.split('/').at(-1)!);
    if(old&&path.startsWith(`${prefix}/git/commits/`))return Response.json({message:old.message,parents:[{sha:baseSha}],tree:{sha:'new-tree'}});
    if(path.startsWith(`${prefix}/compare/`)) {
      const [ancestor,descendant]=path.split('/').at(-1)!.split('...');
      return Response.json({status:ancestor===descendant?'identical':remote.containsOriginal&&commits.has(ancestor)&&descendant===remote.branch?'ahead':'diverged'});
    }
    if(path===`${prefix}/git/trees`) {trees.push(body);remote.metadata=body.tree.find((entry:{path:string})=>entry.path===metadataPath(page)).content;return Response.json({sha:'new-tree'});}
    if(path===`${prefix}/git/commits`&&init?.method==='POST') {
      counts.commits++;remote.message=body.message;messages.push(body.message);
      const sha=createHash('sha1').update(body.message).digest('hex');
      commits.set(sha,{message:body.message,content:remote.content,metadata:remote.metadata});return Response.json({sha});
    }
    if(path===`${prefix}/git/refs`) {
      counts.refs++;remote.branch=body.sha;
      if(lose==='ref'){lose=null;throw new Error('simulated lost response');}
      return Response.json({});
    }
    if(path===`${prefix}/pulls`&&init?.method==='POST') {
      counts.pulls++;remote.pull=true;
      if(lose==='pull'){lose=null;throw new Error('simulated lost response');}
      return Response.json({number:42});
    }
    if(path===`${prefix}/pulls`)return Response.json(remote.pull?[{number:42}]:[]);
    throw Error(`Unexpected route ${path}`);
  });
  return {env,http,counts,remote,trees,messages,commits};
}
