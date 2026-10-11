import {resolveNs,resolveCname,resolve4} from 'node:dns/promises';

type Envelope = {success:boolean;result?:unknown;errors?:{code:number}[];result_info?:unknown};
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw Error('Missing CLOUDFLARE_API_TOKEN');
async function api(resource:string,credential?:'account'|'zone',method='GET',body?:unknown){
  const selectedToken=(credential==='zone'||(!credential&&resource.startsWith('zones')))?(process.env.CLOUDFLARE_ZONE_API_TOKEN||token):token;
  const response=await fetch(`https://api.cloudflare.com/client/v4/${resource}`,{method,headers:{Authorization:`Bearer ${selectedToken}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  const data=await response.json() as Envelope;
  return {status:response.status,success:data.success,codes:(data.errors??[]).map(error=>error.code),result:data.result,resultInfo:data.result_info};
}
function objects(value:unknown):Record<string,unknown>[] {return Array.isArray(value)?value.filter(row=>row&&typeof row==='object') as Record<string,unknown>[]:[];}
const [zones,accounts,memberships,verification]=await Promise.all([
  api('zones?name=rocoai.app'),api('accounts'),api('memberships'),api('user/tokens/verify'),
]);
const selected=objects(zones.result).filter(zone=>zone.name==='rocoai.app');
const dnsQueries:readonly [string,()=>Promise<string[]>][]=[
  ['nameservers',()=>resolveNs('rocoai.app')],['wikiCname',()=>resolveCname('wiki.rocoai.app')],['wikiAddresses',()=>resolve4('wiki.rocoai.app')],
  ['preferredCname',()=>resolveCname('rocowiki.cf.090227.xyz')],['preferredAddresses',()=>resolve4('rocowiki.cf.090227.xyz')],
];
const publicDns=Object.fromEntries(await Promise.all(dnsQueries.map(async([name,run])=>{try{return [name,await run()] as const;}catch(error){return [name,{error:(error as NodeJS.ErrnoException).code||'DNS_QUERY_FAILED'}] as const;}})));
const summary=(result:Awaited<ReturnType<typeof api>>)=>({status:result.status,success:result.success,codes:result.codes});
const publicHttp=await Promise.all(['wiki-direct.rocoai.app','wiki.rocoai.app'].map(async(hostname)=>{
  try{
    const url=new URL(`https://${hostname}/version.json`);url.searchParams.set('verify',String(Date.now()));
    const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
    const contentType=response.headers.get('content-type');
    let sourceSha:string|null=null;
    if(response.ok&&contentType?.includes('application/json')){
      const value=await response.json() as {source_commit_sha?:unknown};
      if(typeof value.source_commit_sha==='string'&&/^[a-f0-9]{40}$/.test(value.source_commit_sha))sourceSha=value.source_commit_sha;
    }else await response.body?.cancel();
    return {hostname,status:response.status,contentType,sourceSha,mitigation:response.headers.get('cf-mitigated')};
  }catch(error){
    const cause=error instanceof Error?error.cause:undefined;
    const code=cause&&typeof cause==='object'&&'code' in cause?cause.code:undefined;
    return {hostname,error:typeof code==='string'&&/^[A-Z0-9_]+$/.test(code)?code:'PUBLIC_HTTP_FAILED'};
  }
}));
console.log(JSON.stringify({
  zoneLookup:{...summary(zones),returned:objects(zones.result).length,zones:selected.map(zone=>({id:zone.id,name:zone.name,status:zone.status,accountId:zone.account&&typeof zone.account==='object'?(zone.account as Record<string,unknown>).id:null,nameServers:zone.name_servers}))},
  accounts:{...summary(accounts),ids:objects(accounts.result).map(account=>account.id),pagination:accounts.resultInfo},
  memberships:{...summary(memberships),accounts:objects(memberships.result).map(row=>({status:row.status,account:row.account&&typeof row.account==='object'?(row.account as Record<string,unknown>).id:null}))},
  tokenVerification:{...summary(verification),state:verification.result&&typeof verification.result==='object'?(verification.result as Record<string,unknown>).status:null},
  publicDns,publicHttp,probeLocation:'GitHub-hosted runner; DNS and public-version inspection, not a mainland latency measurement',
},null,2));
for(const zone of selected){
  if(typeof zone.id!=='string'||!/^[a-f0-9]{32}$/.test(zone.id))continue;
  const records=await api(`zones/${zone.id}/dns_records?name=wiki.rocoai.app`);
  console.log(JSON.stringify({wikiRecords:{...summary(records),records:objects(records.result).filter(row=>['A','AAAA','CNAME'].includes(String(row.type))).map(row=>({id:row.id,type:row.type,name:row.name,content:row.content,proxied:row.proxied,meta:row.meta}))}},null,2));
  const account=zone.account&&typeof zone.account==='object'?(zone.account as Record<string,unknown>).id:null;
  if(typeof account!=='string'||!/^[a-f0-9]{32}$/.test(account))continue;
  for(const credential of ['account','zone'] as const){
    const scripts=await api(`accounts/${account}/workers/scripts`,credential);
    const service=await api(`accounts/${account}/workers/services/rocowiki-web`,credential);
    const routes=await api(`zones/${zone.id}/workers/routes`,credential);
    // Empty manifest probes upload-session authorization only. Never print its JWT.
    const upload=await api(`accounts/${account}/workers/scripts/rocowiki-web/assets-upload-session`,credential,'POST',{manifest:{}});
    console.log(JSON.stringify({workerPermissions:{credential,scripts:summary(scripts),service:summary(service),routes:summary(routes),assetUploadSession:summary(upload)}},null,2));
  }
}
