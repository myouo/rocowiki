import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,appendFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import ts from 'typescript';

type Http=typeof fetch;
const databaseName='rocowiki-production';
const uuid=z.string().uuid().refine(value=>value!=='00000000-0000-0000-0000-000000000000');
const database=z.object({name:z.literal(databaseName),uuid});
type Database=z.infer<typeof database>;
const pause=(milliseconds:number)=>new Promise<void>(resolve=>setTimeout(resolve,milliseconds));

export async function provisionApiDatabase(accountId:string,token:string,knownId?:string,http:Http=fetch):Promise<Database>{
  if(!/^[a-f0-9]{32}$/.test(accountId)||!token)throw Error('INVALID_D1_CONFIGURATION');
  if(knownId)uuid.parse(knownId);
  const base=`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`;
  async function call(url:string,method='GET',body?:unknown){
    const response=await http(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});
    const value=await response.json() as {success:boolean;result?:unknown};
    if(!response.ok||!value.success)throw Error(`D1_API_FAILED (${response.status})${[401,403].includes(response.status)?': Account D1 Edit is required on the deployment token':''}`);
    return value.result;
  }
  const values=await call(`${base}?name=${databaseName}&per_page=10000`);
  if(!Array.isArray(values))throw Error('INVALID_D1_LIST_RESPONSE');
  const rows:unknown[]=values;
  const matches=rows.filter(row=>row&&typeof row==='object'&&'name' in row&&row.name===databaseName);
  if(matches.length>1)throw Error('DUPLICATE_PRODUCTION_DATABASE');
  if(matches.length===1){const found=database.parse(matches[0]);if(knownId&&found.uuid!==knownId)throw Error('PRODUCTION_DATABASE_ID_MISMATCH');return found;}
  if(knownId)throw Error('PRODUCTION_DATABASE_MISSING: restore the configured database rather than creating an empty replacement');
  return database.parse(await call(base,'POST',{name:databaseName,primary_location_hint:'apac'}));
}

const workerConfig=z.object({
  name:z.literal('rocowiki-api'),main:z.literal('src/index.ts'),
  env:z.object({production:z.object({
    name:z.literal('rocowiki-api-production'),vars:z.record(z.string()),
    d1_databases:z.array(z.object({binding:z.literal('DB'),database_name:z.literal(databaseName),database_id:z.string(),migrations_dir:z.string()}).passthrough()).length(1),
    routes:z.array(z.object({pattern:z.literal('api.wiki.rocoai.app'),custom_domain:z.literal(true)})).length(1),
  }).passthrough()}),
}).passthrough();
export function productionApiConfig(input:unknown,databaseId:string,sourceSha:string,values:Record<string,string|undefined>={},root=process.cwd()){
  const config=workerConfig.parse(input);uuid.parse(databaseId);
  if(!/^[a-f0-9]{40}$/.test(sourceSha)||/^0+$/.test(sourceSha))throw Error('INVALID_API_SOURCE_SHA');
  const production=config.env.production;
  if(production.vars.API_ORIGIN!=='https://api.wiki.rocoai.app'||production.vars.WEB_ORIGIN!=='https://wiki.rocoai.app'||production.vars.SITE_URL!=='https://wiki.rocoai.app')throw Error('API_ORIGIN_CONFIGURATION_MISMATCH');
  if(production.vars.SUBMISSIONS_ENABLED!=='false'||production.vars.PUBLISH_ENABLED!=='false')throw Error('API_BOOTSTRAP_REQUIRES_CLOSED_CONTRIBUTIONS');
  for(const key of ['MAIL_PROVIDER','MAIL_FROM','OIDC_ISSUER','OIDC_CLIENT_ID','GITHUB_APP_ID','GITHUB_INSTALLATION_ID','GITHUB_OAUTH_CLIENT_ID']){const value=values[key];if(value)production.vars[key]=value;}
  if(production.vars.AUTH_MODE!=='password'||production.vars.EMAIL_VERIFICATION_REQUIRED!=='true')throw Error('PASSWORD_AUTH_CONFIGURATION_MISMATCH');
  if(!['disabled','resend','brevo'].includes(production.vars.MAIL_PROVIDER))throw Error('INVALID_MAIL_PROVIDER');
  if(production.vars.MAIL_PROVIDER!=='disabled'&&!z.string().email().safeParse(production.vars.MAIL_FROM).success)throw Error('INVALID_MAIL_FROM');
  production.vars.API_SOURCE_COMMIT_SHA=sourceSha;
  production.routes=[];
  production.d1_databases[0]={...production.d1_databases[0],database_id:databaseId,migrations_dir:path.join(root,'database/migrations')};
  // The trusted source routes are verified above; bind the explicit zone after upload.
  return {...config,main:path.join(root,'apps/api/src/index.ts')};
}

export async function verifyApiRelease(sourceSha:string,http:Http=fetch,wait=pause,attempts=60){
  let reason='NO_ATTEMPTS';
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const response=await http(`https://api.wiki.rocoai.app/health?verify=${Date.now()}-${attempt}`,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
      reason=`HTTP_${response.status}`;
      if(response.ok){const value=await response.json() as {status?:string;source_commit_sha?:string;submissions?:boolean;publishing?:boolean};if(value.status==='ok'&&value.source_commit_sha===sourceSha&&value.submissions===false&&value.publishing===false)return;reason='API_RELEASE_MISMATCH';}
    }catch{reason='PUBLIC_API_UNREACHABLE';}
    if(attempt+1<attempts)await wait(3000);
  }
  throw Error(`PUBLIC_API_VERIFICATION_FAILED (${reason})`);
}

export async function verifyPasswordRuntime(http:Http=fetch){
  // Longer than the allowed username and contains no @: cannot identify a real account.
  const identifier=`runtime-check-${crypto.randomUUID()}`;
  for(let attempt=0;attempt<3;attempt++){
    const response=await http('https://api.wiki.rocoai.app/auth/login',{method:'POST',headers:{Origin:'https://wiki.rocoai.app','X-Roco-Request':'1','Content-Type':'application/json'},body:JSON.stringify({identifier,password:'Synthetic runtime validation; no account exists'}),redirect:'error',signal:AbortSignal.timeout(15000)});
    if(response.status!==401)throw Error(`PASSWORD_RUNTIME_CHECK_FAILED (HTTP_${response.status}): inspect Workers errors and CPU limits before enabling registration`);
    const value=await response.json() as {error?:{code?:string}};
    if(value.error?.code!=='INVALID_CREDENTIALS')throw Error('PASSWORD_RUNTIME_CHECK_INVALID_RESPONSE');
  }
}

async function main(){
  const env=process.env;
  for(const key of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_ZONE_ID','DEPLOY_WEBHOOK_SECRET'])if(!env[key])throw Error(`Missing ${key}`);
  const account=env.CLOUDFLARE_ACCOUNT_ID!,zoneId=env.CLOUDFLARE_ZONE_ID!,token=env.CLOUDFLARE_API_TOKEN!;
  if(!/^[a-f0-9]{32}$/.test(account)||!/^[a-f0-9]{32}$/.test(zoneId))throw Error('INVALID_API_ACCOUNT_CONFIGURATION');
  const zoneResponse=await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`,{headers:{Authorization:`Bearer ${env.CLOUDFLARE_ZONE_API_TOKEN||token}`},redirect:'error',signal:AbortSignal.timeout(15000)});
  const zone=await zoneResponse.json() as {success:boolean;result?:{name:string;status:string;account:{id:string}}};
  if(!zoneResponse.ok||!zone.success||zone.result?.name!=='rocoai.app'||zone.result.status!=='active'||zone.result.account.id!==account)throw Error('API_ACCOUNT_ZONE_MISMATCH');
  const parsed=ts.parseConfigFileTextToJson('apps/api/wrangler.jsonc',await readFile('apps/api/wrangler.jsonc','utf8'));
  if(parsed.error)throw Error('INVALID_API_WORKER_CONFIG');
  const source=workerConfig.parse(parsed.config),configuredId=source.env.production.d1_databases[0].database_id;
  const sourceSha=env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  // Validate the deployment before creating a database or changing the Worker.
  productionApiConfig(source,'11111111-1111-4111-8111-111111111111',sourceSha,env);
  const found=await provisionApiDatabase(account,token,env.D1_DATABASE_ID||(uuid.safeParse(configuredId).success?configuredId:undefined));
  console.log(`Verified API database: ${found.name} (${found.uuid})`);
  if(env.GITHUB_OUTPUT)await appendFile(env.GITHUB_OUTPUT,`database_id=${found.uuid}\n`);
  const config=productionApiConfig(source,found.uuid,sourceSha,env),temporary=await mkdtemp(path.join(tmpdir(),'rocowiki-api-deploy-'));
  try{
    const file=path.join(temporary,'wrangler.json'),secretFile=path.join(temporary,'secrets.json');
    await writeFile(file,JSON.stringify(config));
    const names=['BREVO_API_KEY','RESEND_API_KEY','OIDC_CLIENT_SECRET','GITHUB_APP_PRIVATE_KEY','GITHUB_OAUTH_CLIENT_SECRET','GITHUB_WEBHOOK_SECRET','DEPLOY_WEBHOOK_SECRET'];
    await writeFile(secretFile,JSON.stringify(Object.fromEntries(names.filter(name=>env[name]?.trim()).map(name=>[name,env[name]]))),{mode:0o600});
    const run=(args:string[])=>execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args,'--config',file,'--env','production'],{stdio:'inherit',env:{...env,CI:'true',WRANGLER_SEND_METRICS:'false'}});
    run(['d1','migrations','apply',databaseName,'--remote']);
    run(['deploy','--secrets-file',secretFile]);
  }finally{await rm(temporary,{recursive:true,force:true});}
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/domains`,{
    method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({hostname:'api.wiki.rocoai.app',service:'rocowiki-api-production',zone_id:zoneId,zone_name:'rocoai.app',enabled:true}),redirect:'error',signal:AbortSignal.timeout(15000),
  });
  const domain=await response.json() as {success:boolean;result?:{hostname:string;service:string;zone_id:string;enabled:boolean}};
  if(!response.ok||!domain.success)throw Error(`API_DOMAIN_BINDING_FAILED (${response.status})`);
  if(domain.result?.hostname!=='api.wiki.rocoai.app'||domain.result.service!=='rocowiki-api-production'||domain.result.zone_id!==zoneId||!domain.result.enabled)throw Error('API_DOMAIN_RESPONSE_MISMATCH');
  await verifyApiRelease(sourceSha);
  await verifyPasswordRuntime();
  console.log('Verified native password hashing on Workers without creating an account');
  console.log(`Verified public API release: ${sourceSha}; contributions remain closed`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
