const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');

/** @param {string} name @returns {string|null} */
function branchViolation(name){return /agent/i.test(name)?'branch names must not contain agent':null;}
/** @param {string} file @returns {string|null} */
function pathViolation(file){
  const normalized=file.replaceAll('\\','/'),name=path.posix.basename(normalized);
  if(/^(\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$/i.test(name)&&!name.endsWith('.example'))return 'private environment file';
  if(/\.(pem|key|p12|pfx|sqlite(?:3)?(?:-wal|-shm|-journal)?|db(?:-wal|-shm|-journal)?|age)$/i.test(name)||/^id_(?:rsa|ed25519|ecdsa)$/.test(name))return 'private key, database or backup file';
  if(/(?:^|\/)(node_modules|\.wrangler|\.git|backups|coverage)(?:\/|$)/.test(normalized))return 'local dependency/runtime state';
  if(/^apps\/web\/(?:build|dist|\.docusaurus(?:-build)?|docs-generated|src\/generated)\//.test(normalized)||/^apps\/web\/RocoWiki_(?:UI|Design)_.*\.html$/.test(normalized))return 'generated web output';
  return null;
}
/** @param {string} text @returns {string|null} */
function secretViolation(text){
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{16,}/.test(text))return 'embedded private key';
  if(/\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{80,}\b/.test(text))return 'possible GitHub credential';
  return null;
}
/** @param {string} text @param {{id:string,version:number,sections:string[]}} policy @param {string} language */
function policyViolations(text,policy,language){
  const errors=[],marker=text.match(/<!-- rocowiki-policy: ([a-z-]+); version: (\d+); lang: ([a-zA-Z-]+) -->/);
  if(!marker||marker[1]!==policy.id||Number(marker[2])!==policy.version||marker[3]!==language)errors.push('policy identity, revision or language does not match manifest');
  const anchors=[...text.matchAll(/<a id="([a-z-]+)"><\/a>/g)].map(match=>match[1]);
  if(new Set(anchors).size!==anchors.length)errors.push('duplicate explicit section anchor');
  if(policy.sections.some(section=>!anchors.includes(section)))errors.push('missing required bilingual section');
  if(!text.endsWith('\n'))errors.push('missing final newline');
  return errors;
}
function git(root,args){return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:20*1024*1024});}
function candidates(root){
  try{return git(root,['ls-files','-z','--cached','--others','--exclude-standard']).split('\0').filter(Boolean);}
  catch{return [];}
}
async function run(root=process.cwd()){
  const read=file=>fs.readFileSync(path.join(root,file),'utf8'),errors=[];
  const policies=JSON.parse(read('docs/policies.json'));
  if(policies.schema!==1||policies.projectLicense!=='GPL-3.0-only'||policies.wikiContentLicense!=='CC-BY-SA-4.0'||!Array.isArray(policies.documents))throw Error('Invalid policy manifest');
  const ids=new Set(),documents=[];
  for(const policy of policies.documents){
    if(ids.has(policy.id))errors.push(`Duplicate policy: ${policy.id}`);ids.add(policy.id);
    for(const [file,language,other] of [[policy.zh,'zh-CN',policy.en],[policy.en,'en',policy.zh]]){
      const text=read(file);documents.push({file,text});
      errors.push(...policyViolations(text,policy,language).map(reason=>`${file}: ${reason}`));
      const switchPath=path.relative(path.dirname(file),other).split(path.sep).join('/');
      if(!text.includes(`](${switchPath})`))errors.push(`${file}: missing counterpart language link`);
    }
  }
  const [{unified},{default:remarkParse},{visit}]=await Promise.all([import('unified'),import('remark-parse'),import('unist-util-visit')]);
  for(const {file,text} of documents){
    visit(unified().use(remarkParse).parse(text),node=>{
      if(!['link','definition'].includes(node.type))return;
      const url=node.url;
      if(/^(https?:|mailto:)/i.test(url))return;
      if(/^[a-z][a-z0-9+.-]*:/i.test(url)){errors.push(`${file}: unsupported link scheme`);return;}
      let relative;try{relative=decodeURIComponent(url.split('#')[0].split('?')[0]);}catch{errors.push(`${file}: invalid encoded link`);return;}
      if(!relative)return;
      const target=path.resolve(root,path.dirname(file),relative);
      if(!target.startsWith(root+path.sep)||!fs.existsSync(target))errors.push(`${file}: missing or outside-repository link ${relative}`);
    });
  }
  const manifests=['package.json','apps/api/package.json','apps/web/package.json',...fs.readdirSync(path.join(root,'packages')).sort().map(name=>`packages/${name}/package.json`)];
  const lock=JSON.parse(read('package-lock.json'));
  for(const file of manifests){
    const manifest=JSON.parse(read(file)),key=file==='package.json'?'':file.slice(0,-'/package.json'.length);
    if(manifest.license!==policies.projectLicense||lock.packages[key]?.license!==policies.projectLicense)errors.push(`${file}: project license differs from manifest/lockfile`);
  }
  const inventory=JSON.parse(read('docs/license-inventory.json'));
  if(inventory.wikiContentLicense!==policies.wikiContentLicense)errors.push('Wiki content license differs from policy inventory');
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  if(inventory.projectLicense!==policies.projectLicense||digest(fs.readFileSync(path.join(root,'LICENSE')))!==inventory.licenseText.sha256||!read('LICENSE').includes('Version 3, 29 June 2007'))errors.push('LICENSE/inventory mismatch');
  const direct=new Map();
  for(const file of manifests){const p=JSON.parse(read(file));for(const [name,version] of Object.entries({...p.dependencies,...p.devDependencies})){const requests=direct.get(name)||[];requests.push({manifest:file,version});direct.set(name,requests);}}
  if(direct.size!==inventory.dependencies.length)errors.push('Direct-dependency license inventory is stale');
  for(const dependency of inventory.dependencies){
    if(JSON.stringify(direct.get(dependency.name))!==JSON.stringify(dependency.requests))errors.push(`${dependency.name}: dependency request inventory is stale`);
    if(lock.packages[`node_modules/${dependency.name}`]?.version!==dependency.version)errors.push(`${dependency.name}: lockfile version differs from license inventory`);
    for(const notice of dependency.notices)if(!fs.existsSync(path.join(root,notice.file))||digest(fs.readFileSync(path.join(root,notice.file)))!==notice.sha256)errors.push(`${dependency.name}: retained license missing or modified`);
  }
  for(const asset of inventory.assets)for(const file of [asset.file,asset.directory,asset.notice,...Array.isArray(asset.evidence)?asset.evidence:[asset.evidence]].filter(Boolean))if(!fs.existsSync(path.join(root,file)))errors.push(`Asset evidence missing: ${file}`);
  let branch=process.env.ROCO_BRANCH_NAME||process.env.GITHUB_HEAD_REF||process.env.GITHUB_REF_NAME||'';
  if(!branch)try{branch=git(root,['branch','--show-current']).trim();}catch{}
  if(branchViolation(branch))errors.push('Branch name contains the prohibited token agent');
  const files=candidates(root);
  for(const file of files){
    const reason=pathViolation(file);if(reason){errors.push(`${JSON.stringify(file)}: ${reason}`);continue;}
    const full=path.join(root,file);if(!/\.(?:[cm]?js|jsx|tsx?|md|json|ya?ml|sh|py|toml|txt)$/.test(file)||!fs.existsSync(full)||!fs.statSync(full).isFile())continue;
    const secret=secretViolation(fs.readFileSync(full,'utf8'));if(secret)errors.push(`${JSON.stringify(file)}: ${secret}; value redacted`);
  }
  if(errors.length)throw Error(errors.join('\n'));
  console.log(`Repository standards passed: ${policies.documents.length} bilingual policies, ${inventory.dependencies.length} direct license records, ${files.length} Git candidate files. Structural checks do not verify translations, all secret types or asset permission.`);
}
module.exports={branchViolation,pathViolation,secretViolation,policyViolations,run};
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
