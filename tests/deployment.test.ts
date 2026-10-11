import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHmac} from 'node:crypto';
import {artifactDigest} from '../scripts/version-manifest.mjs';
import {inspectArtifact,verifyPublicRelease,sendReceipt,type Release} from '../scripts/deploy-workers';
const version:Release={release_id:'test-release',source_commit_sha:'1'.repeat(40),artifact_digest:'2'.repeat(64),built_at:'2026-10-11T00:00:00Z'};
const noWait=async()=>{};
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
