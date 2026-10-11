import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {tmpdir} from 'node:os';
import ts from 'typescript';
import {artifactDigest} from './version-manifest.mjs';

export type Release = {release_id:string;source_commit_sha:string;artifact_digest:string;built_at:string};
type Http = typeof fetch;
type Wait = (milliseconds:number)=>Promise<void>;
const pause:Wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

export async function ensureWorkerExists(accountId:string,token:string,http:Http=fetch):Promise<void>{
  if(!/^[a-f0-9]{32}$/.test(accountId)||!token)throw Error('INVALID_WORKER_BOOTSTRAP_CONFIGURATION');
  const base=`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers`;
  const options={headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000),redirect:'error' as const};
  const existing=await http(`${base}/services/rocowiki-web`,options);
  const found=await existing.json() as {success:boolean;errors?:{code:number}[]};
  if(existing.ok&&found.success)return;
  if(existing.status!==404||!found.errors?.some(error=>error.code===10090))throw Error(`WORKER_LOOKUP_FAILED (${existing.status})`);
  const body=new FormData();
  body.append('metadata',new Blob([JSON.stringify({main_module:'index.mjs',compatibility_date:'2026-10-11',bindings:[]})],{type:'application/json'}));
  body.append('index.mjs',new Blob(['export default {fetch(){return new Response("Wiki deployment in progress",{status:503});}};'],{type:'application/javascript+module'}),'index.mjs');
  const response=await http(`${base}/scripts/rocowiki-web`,{...options,method:'PUT',body});
  const result=await response.json() as {success:boolean;errors?:{code:number}[]};
  if(!response.ok||!result.success){
    if(response.status===403)throw Error('WORKER_BOOTSTRAP_FAILED (403): grant Workers Scripts Write access to the target account, including creation of rocowiki-web');
    throw Error(`WORKER_BOOTSTRAP_FAILED (${response.status}; codes: ${(result.errors??[]).map(error=>error.code).filter(code=>Number.isInteger(code)).join(',')})`);
  }
}

export async function inspectArtifact(root:string,expectedSha:string):Promise<Release> {
  const version:Release=JSON.parse(await readFile(`${root}/version.json`,'utf8'));
  if(!/^[a-f0-9]{40}$/.test(expectedSha)||/^0+$/.test(expectedSha)||version.source_commit_sha!==expectedSha)throw Error('SOURCE_SHA_MISMATCH');
  if(!version.release_id||!version.built_at||await artifactDigest(root)!==version.artifact_digest)throw Error('ARTIFACT_DIGEST_MISMATCH');
  return version;
}
export async function verifyPublicRelease(version:Release,origin:string,http:Http=fetch,wait:Wait=pause,attempts=60):Promise<void> {
  let failure='NO_ATTEMPTS';
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const url=new URL('/version.json',origin);url.searchParams.set('verify',`${Date.now()}-${attempt}`);
      const response=await http(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
      failure=`HTTP_${response.status}`;
      if(response.ok){
        const found=await response.json() as Partial<Release>;
        if(found.release_id!==version.release_id)failure='RELEASE_ID_MISMATCH';
        else if(found.source_commit_sha!==version.source_commit_sha)failure='SOURCE_SHA_MISMATCH';
        else if(found.artifact_digest!==version.artifact_digest)failure='ARTIFACT_DIGEST_MISMATCH';
        else return;
      }
    }catch(error){
      const cause=error instanceof Error?error.cause:undefined;
      const code=cause&&typeof cause==='object'&&'code' in cause?cause.code:undefined;
      failure=typeof code==='string'&&/^[A-Z0-9_]+$/.test(code)?code:error instanceof SyntaxError?'INVALID_VERSION_JSON':error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'NETWORK_TIMEOUT':'NETWORK_ERROR';
    }
    if(attempt+1<attempts)await wait(3000);
  }
  throw Error(`PUBLIC_VERSION_VERIFICATION_FAILED (${new URL(origin).hostname}: ${failure})`);
}
export async function sendReceipt(version:Release,origin:string,secret:string,http:Http=fetch,wait:Wait=pause):Promise<void> {
  const body=JSON.stringify(version);
  for(let attempt=0;attempt<5;attempt++){
    const timestamp=String(Math.floor(Date.now()/1000));
    const signature='sha256='+createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex');
    try{
      const response=await http(new URL('/webhooks/deploy',origin),{method:'POST',headers:{'Content-Type':'application/json','X-Webhook-Timestamp':timestamp,'X-Signature':signature},body,signal:AbortSignal.timeout(15000),redirect:'error'});
      if(response.ok)return;
    }catch{}
    if(attempt<4)await wait(2000*2**attempt);
  }
  throw Error('RECEIPT_DELIVERY_FAILED: replay the receipt from this immutable artifact');
}
export async function bindWorkerDomain(accountId:string,zoneId:string,token:string,http:Http=fetch):Promise<void> {
  if(!/^[a-f0-9]{32}$/.test(accountId)||!/^[a-f0-9]{32}$/.test(zoneId)||!token)throw Error('INVALID_DOMAIN_CONFIGURATION');
  const response=await http(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/domains`,{
    method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({hostname:'wiki-direct.rocoai.app',service:'rocowiki-web',zone_id:zoneId,zone_name:'rocoai.app',enabled:true}),
    redirect:'error',signal:AbortSignal.timeout(15000),
  });
  const data=await response.json() as {success:boolean;errors?:{code:number}[];result?:{hostname:string;service:string;zone_id:string;enabled:boolean}};
  if(!response.ok||!data.success)throw Error(`DOMAIN_BINDING_FAILED (${response.status}; codes: ${(data.errors??[]).map(error=>error.code).join(',')})`);
  if(data.result?.hostname!=='wiki-direct.rocoai.app'||data.result.service!=='rocowiki-web'||data.result.zone_id!==zoneId||!data.result.enabled)throw Error('DOMAIN_BINDING_RESPONSE_MISMATCH');
}
export async function configurePreferredRoute(zoneId:string,accountToken:string,dnsToken:string,http:Http=fetch):Promise<void> {
  if(!/^[a-f0-9]{32}$/.test(zoneId)||!accountToken||!dnsToken)throw Error('INVALID_PREFERRED_ROUTE_CONFIGURATION');
  const call=async(resource:string,token:string,method='GET',body?:unknown)=>{
    const response=await http(`https://api.cloudflare.com/client/v4/zones/${zoneId}/${resource}`,{
      method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000),redirect:'error',
    });
    const data=await response.json() as {success:boolean;result?:unknown;errors?:{code:number}[]};
    if(!response.ok||!data.success)throw Error(`PREFERRED_ROUTE_API_FAILED (${response.status}; codes: ${(data.errors??[]).map(error=>error.code).join(',')})`);
    return data.result;
  };
  const routes=await call('workers/routes',accountToken) as {id:string;pattern:string;script:string}[];
  const records=await call('dns_records?name=wiki.rocoai.app',dnsToken) as {id:string;type:string;content:string;proxied:boolean}[];
  if(!Array.isArray(routes)||!Array.isArray(records))throw Error('INVALID_PREFERRED_ROUTE_RESPONSE');
  const addresses=records.filter(record=>['A','AAAA','CNAME'].includes(record.type));
  if(addresses.length>1||addresses.some(record=>record.type!=='CNAME'))throw Error('PREFERRED_DNS_CONFLICT: existing records require review');
  const existing=routes.find(route=>route.pattern==='wiki.rocoai.app/*');
  // Install only this exact hostname's route before changing its DNS.
  if(existing?.script!=='rocowiki-web')await call(`workers/routes${existing?`/${existing.id}`:''}`,accountToken,existing?'PUT':'POST',{pattern:'wiki.rocoai.app/*',script:'rocowiki-web'});
  const record=addresses[0],content='rocowiki.cf.090227.xyz';
  if(record?.content!==content||record.proxied)await call(`dns_records${record?`/${record.id}`:''}`,dnsToken,record?'PUT':'POST',{type:'CNAME',name:'wiki.rocoai.app',content,proxied:false,ttl:300});
}
async function main(){
  const env=process.env;
  for(const key of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_ZONE_ID','SITE_URL'])if(!env[key])throw Error(`Missing ${key}`);
  if(env.SITE_URL!=='https://wiki.rocoai.app')throw Error('SITE_URL_DOES_NOT_MATCH_WORKER_DOMAIN');
  const enabled=env.DEPLOY_RECEIPTS_ENABLED??'true';
  if(!['true','false'].includes(enabled))throw Error('INVALID_RECEIPT_MODE');
  if(enabled==='true'&&(!env.API_ORIGIN||!env.DEPLOY_WEBHOOK_SECRET))throw Error('MISSING_RECEIPT_CONFIGURATION');
  const sha=env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const version=await inspectArtifact('apps/web/build',sha);
  await ensureWorkerExists(env.CLOUDFLARE_ACCOUNT_ID!,env.CLOUDFLARE_API_TOKEN!);
  // Account and DNS credentials may have deliberately separate permissions.
  // Upload with the account token; bind the verified zone through its explicit ID.
  const parsed=ts.parseConfigFileTextToJson('wrangler.jsonc',await readFile('apps/web/wrangler.jsonc','utf8'));
  if(parsed.error)throw Error('INVALID_WORKER_CONFIG');
  const config=parsed.config;
  if(config.name!=='rocowiki-web'||config.routes?.[0]?.pattern!=='wiki.rocoai.app/*')throw Error('WORKER_CONFIG_MISMATCH');
  const temporary=await mkdtemp(path.join(tmpdir(),'rocowiki-worker-config-'));
  try{
    const file=path.join(temporary,'wrangler.json');
    await writeFile(file,JSON.stringify({...config,routes:[],assets:{...config.assets,directory:path.resolve('apps/web/build')}}));
    execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--config',file],{stdio:'inherit',env:{...env,CI:'true'}});
  }finally{await rm(temporary,{recursive:true,force:true});}
  await bindWorkerDomain(env.CLOUDFLARE_ACCOUNT_ID!,env.CLOUDFLARE_ZONE_ID!,env.CLOUDFLARE_API_TOKEN!);
  await configurePreferredRoute(env.CLOUDFLARE_ZONE_ID!,env.CLOUDFLARE_API_TOKEN!,env.CLOUDFLARE_ZONE_API_TOKEN||env.CLOUDFLARE_API_TOKEN!);
  // Prepare both hostnames before validation; no receipt is sent until both verify.
  await verifyPublicRelease(version,'https://wiki-direct.rocoai.app');
  await verifyPublicRelease(version,env.SITE_URL!);
  console.log(`Verified public release: ${version.release_id}`);
  if(enabled==='true'){await sendReceipt(version,env.API_ORIGIN!,env.DEPLOY_WEBHOOK_SECRET!);console.log('Release receipt accepted');}
  else console.log('Reader-site bootstrap: publication receipts are explicitly disabled; no submission is marked published.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
