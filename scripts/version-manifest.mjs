import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export async function artifactDigest(root) {
  const files=[];
  async function visit(dir,relative='') {for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isSymbolicLink())throw Error('Artifact symlink forbidden');const p=relative?`${relative}/${entry.name}`:entry.name;if(entry.isDirectory())await visit(`${dir}/${entry.name}`,p);else if(p!=='version.json')files.push(p);}}
  await visit(root);const digest=createHash('sha256');
  for(const p of files.sort()){digest.update(p+'\0');digest.update(await readFile(`${root}/${p}`));digest.update('\0');}return digest.digest('hex');
}
if(process.argv[1]?.endsWith('version-manifest.mjs')) {
  let sha=process.env.SOURCE_COMMIT_SHA||process.env.GITHUB_SHA;
  if(!sha){try{sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{sha='0'.repeat(40);}}
  if(!/^[a-f0-9]{40}$/.test(sha))throw Error('Invalid source SHA');
  const manifest={release_id:`${sha}-${process.env.GITHUB_RUN_ID||'local'}-${process.env.GITHUB_RUN_ATTEMPT||'1'}`,source_commit_sha:sha,artifact_digest:await artifactDigest('apps/web/build'),built_at:new Date().toISOString()};
  await writeFile('apps/web/build/version.json',JSON.stringify(manifest,null,2));console.log(`Version manifest: ${manifest.release_id}`);
}
