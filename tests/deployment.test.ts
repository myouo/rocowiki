import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHmac} from 'node:crypto';
import {artifactDigest} from '../scripts/version-manifest.mjs';
import {inspectArtifact,verifyPublicRelease,sendReceipt,bindWorkerDomain,configurePreferredRoute,type Release} from '../scripts/deploy-workers';
const version:Release={release_id:'test-release',source_commit_sha:'1'.repeat(40),artifact_digest:'2'.repeat(64),built_at:'2026-10-11T00:00:00Z'};
const noWait=async()=>{};
it('uses separate credentials and creates the exact Worker route before preferred DNS',async()=>{
  const calls:{url:string;method:string;body:unknown}[]=[],zone='b'.repeat(32);
  const http:typeof fetch=async(input,options)=>{
    const url=String(input),method=options?.method||'GET',body=options?.body?JSON.parse(String(options.body)):null;
    expect(new Headers(options?.headers).get('Authorization')).toBe(`Bearer ${url.includes('dns_records')?'fixture-dns-token':'fixture-worker-token'}`);
    calls.push({url,method,body});
    return new Response(JSON.stringify({success:true,result:method==='GET'?[]:body}));
  };
  await configurePreferredRoute(zone,'fixture-worker-token','fixture-dns-token',http);
  expect(calls.map(call=>call.method)).toEqual(['GET','GET','POST','POST']);
  expect(calls[2].body).toEqual({pattern:'wiki.rocoai.app/*',script:'rocowiki-web'});
  expect(calls[3].body).toEqual({type:'CNAME',name:'wiki.rocoai.app',content:'rocowiki.cf.090227.xyz',proxied:false,ttl:300});
});
it('leaves an existing correct route and CNAME unchanged on redeployment',async()=>{
  let calls=0;
  const http:typeof fetch=async(input,options)=>{
    expect(options?.method).toBe('GET');calls++;
    const result=String(input).includes('dns_records')?[{id:'dns',type:'CNAME',content:'rocowiki.cf.090227.xyz',proxied:false}]:[{id:'route',pattern:'wiki.rocoai.app/*',script:'rocowiki-web'}];
    return new Response(JSON.stringify({success:true,result}));
  };
  await configurePreferredRoute('b'.repeat(32),'fixture-worker-token','fixture-dns-token',http);
  expect(calls).toBe(2);
});
it('checks conflicting DNS before changing the existing route',async()=>{
  const http:typeof fetch=async(input,options)=>{
    expect(options?.method).toBe('GET');
    return new Response(JSON.stringify({success:true,result:String(input).includes('dns_records')?[{id:'dns',type:'A',content:'192.0.2.1',proxied:true}]:[{id:'route',pattern:'wiki.rocoai.app/*',script:'existing-service'}]}));
  };
  await expect(configurePreferredRoute('b'.repeat(32),'fixture-worker-token','fixture-dns-token',http)).rejects.toThrow('PREFERRED_DNS_CONFLICT');
});
it('binds the explicit verified zone using the Workers token without relying on zone enumeration',async()=>{
  const account='a'.repeat(32),zone='b'.repeat(32);
  const http:typeof fetch=async(input,options)=>{
    expect(String(input)).toBe(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/domains`);
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer fixture-account-token');
    const body=JSON.parse(String(options?.body));
    expect(body).toEqual({hostname:'wiki-direct.rocoai.app',service:'rocowiki-web',zone_id:zone,zone_name:'rocoai.app',enabled:true});
    return new Response(JSON.stringify({success:true,result:body}));
  };
  await bindWorkerDomain(account,zone,'fixture-account-token',http);
});
it('rejects an incorrect domain response and redacts provider error text',async()=>{
  const account='a'.repeat(32),zone='b'.repeat(32);
  await expect(bindWorkerDomain(account,zone,'fixture-account-token',async()=>new Response(JSON.stringify({success:true,result:{hostname:'other.test',service:'rocowiki-web',zone_id:zone,enabled:true}})))).rejects.toThrow('DOMAIN_BINDING_RESPONSE_MISMATCH');
  const http:typeof fetch=async()=>new Response(JSON.stringify({success:false,errors:[{code:10000,message:'do not log fixture-account-token'}]}),{status:403});
  await expect(bindWorkerDomain(account,zone,'fixture-account-token',http)).rejects.toThrow('DOMAIN_BINDING_FAILED (403; codes: 10000)');
});
it('checks the actual artifact bytes and source commit before upload',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'rocowiki-artifact-'));
  try{
    await writeFile(path.join(dir,'index.html'),'<h1>Wiki</h1>');
    const release={...version,artifact_digest:await artifactDigest(dir)};
    await writeFile(path.join(dir,'version.json'),JSON.stringify(release));
    expect(await inspectArtifact(dir,version.source_commit_sha)).toEqual(release);
    await expect(inspectArtifact(dir,'3'.repeat(40))).rejects.toThrow('SOURCE_SHA_MISMATCH');
    await writeFile(path.join(dir,'index.html'),'<h1>Changed</h1>');
    await expect(inspectArtifact(dir,version.source_commit_sha)).rejects.toThrow('ARTIFACT_DIGEST_MISMATCH');
  }finally{await rm(dir,{recursive:true,force:true});}
});
it('does not accept an old CDN version and verifies release ID, source SHA and digest',async()=>{
  let calls=0;
  const http:typeof fetch=async(input,options)=>{
    expect(new URL(String(input)).searchParams.has('verify')).toBe(true);
    expect(options).toMatchObject({cache:'no-store',redirect:'error'});
    calls++;
    return new Response(JSON.stringify(calls===1?{...version,artifact_digest:'stale'}:version));
  };
  await verifyPublicRelease(version,'https://wiki.rocoai.app',http,noWait,2);
  expect(calls).toBe(2);
});
it('fails public verification after bounded network errors instead of reporting success',async()=>{
  let calls=0;
  const http:typeof fetch=async()=>{calls++;throw Error('network');};
  await expect(verifyPublicRelease(version,'https://wiki.rocoai.app',http,noWait,2)).rejects.toThrow('PUBLIC_VERSION_VERIFICATION_FAILED');
  expect(calls).toBe(2);
});
it('retries a lost receipt response with the same immutable release and a valid timestamped signature',async()=>{
  let calls=0;
  const http:typeof fetch=async(input,options)=>{
    expect(String(input)).toBe('https://api.rocoai.app/webhooks/deploy');
    const headers=new Headers(options?.headers),body=String(options?.body),timestamp=headers.get('X-Webhook-Timestamp');
    expect(JSON.parse(body)).toEqual(version);
    expect(headers.get('X-Signature')).toBe('sha256='+createHmac('sha256','fixture-secret').update(`${timestamp}.${body}`).digest('hex'));
    expect(options?.redirect).toBe('error');
    if(++calls===1)throw Error('response lost');
    return new Response('{}');
  };
  await sendReceipt(version,'https://api.rocoai.app','fixture-secret',http,noWait);
  expect(calls).toBe(2);
});
