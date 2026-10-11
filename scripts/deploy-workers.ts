import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {artifactDigest} from './version-manifest.mjs';

export type Release = {release_id:string;source_commit_sha:string;artifact_digest:string;built_at:string};
type Http = typeof fetch;
type Wait = (milliseconds:number)=>Promise<void>;
const pause:Wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

export async function inspectArtifact(root:string,expectedSha:string):Promise<Release> {
  const version:Release=JSON.parse(await readFile(`${root}/version.json`,'utf8'));
  if(!/^[a-f0-9]{40}$/.test(expectedSha)||/^0+$/.test(expectedSha)||version.source_commit_sha!==expectedSha)throw Error('SOURCE_SHA_MISMATCH');
  if(!version.release_id||!version.built_at||await artifactDigest(root)!==version.artifact_digest)throw Error('ARTIFACT_DIGEST_MISMATCH');
  return version;
}
export async function verifyPublicRelease(version:Release,origin:string,http:Http=fetch,wait:Wait=pause,attempts=60):Promise<void> {
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const url=new URL('/version.json',origin);url.searchParams.set('verify',`${Date.now()}-${attempt}`);
      const response=await http(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
      if(response.ok){const found=await response.json() as Partial<Release>;if(found.release_id===version.release_id&&found.source_commit_sha===version.source_commit_sha&&found.artifact_digest===version.artifact_digest)return;}
    }catch{}
    if(attempt+1<attempts)await wait(3000);
  }
  throw Error('PUBLIC_VERSION_VERIFICATION_FAILED');
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
async function main(){
  const env=process.env;
  for(const key of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','SITE_URL'])if(!env[key])throw Error(`Missing ${key}`);
  if(env.SITE_URL!=='https://wiki.rocoai.app')throw Error('SITE_URL_DOES_NOT_MATCH_WORKER_DOMAIN');
  const enabled=env.DEPLOY_RECEIPTS_ENABLED??'true';
  if(!['true','false'].includes(enabled))throw Error('INVALID_RECEIPT_MODE');
  if(enabled==='true'&&(!env.API_ORIGIN||!env.DEPLOY_WEBHOOK_SECRET))throw Error('MISSING_RECEIPT_CONFIGURATION');
  const sha=env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const version=await inspectArtifact('apps/web/build',sha);
  execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--config','apps/web/wrangler.jsonc'],{stdio:'inherit',env:{...env,CI:'true'}});
  await verifyPublicRelease(version,env.SITE_URL!);
  console.log(`Verified public release: ${version.release_id}`);
  if(enabled==='true'){await sendReceipt(version,env.API_ORIGIN!,env.DEPLOY_WEBHOOK_SECRET!);console.log('Release receipt accepted');}
  else console.log('Reader-site bootstrap: publication receipts are explicitly disabled; no submission is marked published.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
