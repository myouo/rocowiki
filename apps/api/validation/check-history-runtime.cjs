// SPDX-License-Identifier: GPL-3.0-only
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const esbuild=require('esbuild');
const runtimeRequire=createRequire(require.resolve('wrangler'));
const {Miniflare,convertV4MiniflareOptions}=runtimeRequire('miniflare');
const root=path.resolve(__dirname,'../../..'),temporary=mkdtempSync(path.join(tmpdir(),'rocowiki-history-runtime-'));
const head='a'.repeat(40),sha='b'.repeat(40),source='content/guides/contributing.md';

async function main(){
  let calls=0,redirect=false;
  const bundle=await esbuild.build({
    stdin:{resolveDir:root,loader:'ts',contents:`
      import {PublicGitHistory} from './packages/git-wrapper/src/history';
      export default {async fetch(request){
        const mode=new URL(request.url).searchParams.get('mode')||'list';
        const git=new PublicGitHistory({GITHUB_OWNER:'sample-owner',GITHUB_REPO:'public-wiki',GITHUB_DEFAULT_BRANCH:'main'},fetch,await caches.open('history-runtime-'+mode));
        const source={id:'article',label:'正文',path:'${source}',shared:false};
        try{
          if(mode==='diff')return Response.json(await git.diff(source,'${sha}'));
          const ref=await git.head();return Response.json({ref,rows:await git.list(source,ref,1)});
        }catch(error){return Response.json({error:error.code||error.message,...(error.cause?{cause:String(error.cause)}:{})},{status:503});}
      }};
    `},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent',
  });
  const worker=new Miniflare(convertV4MiniflareOptions({
    modules:true,compatibilityDate:'2026-10-10',compatibilityFlags:['nodejs_compat'],script:bundle.outputFiles[0].text,rootPath:temporary,
    outboundService:async request=>{
      calls++;const url=new URL(request.url);
      assert.equal(url.origin,'https://api.github.com');assert.equal(request.method,'GET');assert.equal(request.headers.get('authorization'),null);
      assert.ok(url.pathname.startsWith('/repos/sample-owner/public-wiki/'));
      if(redirect)return new Response(null,{status:302,headers:{Location:'https://untrusted.example.test/'}});
      if(url.pathname.includes('/git/ref/heads/'))return Response.json({object:{sha:head}});
      if(url.pathname.includes('/compare/'))return Response.json({status:'ahead'});
      if(url.pathname.endsWith('/commits'))return Response.json([{sha,author:{id:12345,login:'sample-octocat'},commit:{message:'Public source update',author:{name:'Synthetic author',date:'2026-10-14T09:30:00Z'}}}]);
      if(url.pathname.endsWith('/commits/'+sha))return Response.json({sha,files:[{filename:source,status:'modified',additions:1,deletions:1,patch:'@@ -1 +1 @@\n-Old\n+New'}]});
      throw new Error('Unexpected upstream history route');
    },
  }));
  try{
    let response=await worker.dispatchFetch('https://history-runtime.test/');
    const first=await response.json();assert.equal(response.status,200,'the real Workers fetch must accept the history adapter options: '+JSON.stringify(first));
    assert.equal(first.ref,head);assert.equal(first.rows[0].sha,sha);assert.equal(calls,2);
    response=await worker.dispatchFetch('https://history-runtime.test/');assert.equal(response.status,200);await response.json();
    assert.equal(calls,2,'immutable provider data should be read from the real Worker cache');
    response=await worker.dispatchFetch('https://history-runtime.test/?mode=diff');assert.equal(response.status,200);
    const diff=await response.json();assert.equal(diff.source,'article');assert.equal(diff.patch,'@@ -1 +1 @@\n-Old\n+New');
    const beforeRedirect=calls;redirect=true;
    response=await worker.dispatchFetch('https://history-runtime.test/?mode=redirect');assert.equal(response.status,503);
    assert.deepEqual(await response.json(),{error:'HISTORY_UNAVAILABLE'});assert.equal(calls,beforeRedirect+1,'an upstream redirect must not be followed');
    console.log('Worker history runtime passed: real fetch, cache reuse, main-branch diff and redirect rejection. No external provider contacted.');
  }finally{await worker.dispose();}
}
main().finally(()=>rmSync(temporary,{recursive:true,force:true})).catch(error=>{console.error(error);process.exitCode=1;});
