import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root=process.cwd(),digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifests=['package.json','apps/api/package.json','apps/web/package.json',...fs.readdirSync('packages').sort().map(name=>`packages/${name}/package.json`)];
const dependencies=new Map();
for(const file of manifests){
  const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const [name,version] of Object.entries({...manifest.dependencies,...manifest.devDependencies})){
    const row=dependencies.get(name)??{name,requests:[]};row.requests.push({manifest:file,version});dependencies.set(name,row);
  }
}
const output=path.join(root,'licenses/third-party');fs.mkdirSync(output,{recursive:true});
const retained=new Set(),rows=[];
for(const row of [...dependencies.values()].sort((a,b)=>a.name.localeCompare(b.name,'en'))){
  const dir=path.join(root,'node_modules',row.name),manifest=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
  const collect=relative=>{
    const full=path.join(dir,relative);
    return fs.statSync(full).isDirectory()?fs.readdirSync(full).sort().flatMap(name=>collect(path.join(relative,name))):[relative];
  };
  const files=fs.readdirSync(dir).filter(name=>/^(license|copying|notice)([.-]|$)/i.test(name)).flatMap(collect);
  const notices=files.map(name=>{
    const file=`licenses/third-party/${row.name.replace(/^@/,'').replaceAll('/','__')}/${name}`;
    if(retained.has(file))throw Error(`Duplicate license destination: ${file}`);retained.add(file);
    const bytes=fs.readFileSync(path.join(dir,name));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
    return {file,sha256:digest(bytes),source:`node_modules/${row.name}/${name}`};
  });
  rows.push({...row,version:manifest.version,declaredLicense:typeof manifest.license==='string'?manifest.license:manifest.license?.type??'UNDECLARED',status:notices.length?'notice-retained':'metadata-only',notices});
}
function prune(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){prune(file);if(!fs.readdirSync(file).length)fs.rmdirSync(file);}else if(!retained.has(path.relative(root,file).split(path.sep).join('/')))fs.unlinkSync(file);}}
prune(output);
const policies=JSON.parse(fs.readFileSync('docs/policies.json','utf8'));
const inventory={schema:1,projectLicense:policies.projectLicense,wikiContentLicense:policies.wikiContentLicense,contentPolicy:'COPYRIGHT.md',scope:'Direct dependencies only; transitive artifact licensing requires release review. Wiki licensing applies only to material with valid rights; imported content is not automatically relicensed.',licenseText:{file:'LICENSE',source:'https://raw.githubusercontent.com/spdx/license-list-data/main/text/GPL-3.0-only.txt',sha256:digest(fs.readFileSync('LICENSE')),retrievedAt:'2026-10-11'},dependencies:rows,assets:[
  {id:'serif-font',status:'notice-retained',license:'OFL-1.1',file:'apps/web/static/fonts/roco-wiki-serif-600.woff2',notice:'apps/web/static/fonts/OFL-Noto-Serif-SC.txt',evidence:'apps/web/static/fonts/FONT-SOURCE.json'},
  {id:'sans-font',status:'notice-retained',license:'OFL-1.1',file:'apps/web/static/fonts/roco-wiki-sans-v7.woff2',notice:'apps/web/static/fonts/OFL-Noto-Sans-SC.txt',evidence:'apps/web/static/fonts/FONT-SOURCE-V7.json'},
  {id:'game-images',status:'permission-unverified',license:'Not established by this repository',directory:'apps/web/static/img',evidence:['apps/web/content/asset-sources.json','apps/web/content/pet-sources.json']},
  {id:'official-pet-data',status:'permission-unverified',license:'Not established by this repository',file:'apps/web/content/official-pets.json',source:'https://res.17roco.qq.com/conf/Angel.config',evidence:['apps/web/content/official-pets.json']}
]};
fs.writeFileSync('docs/license-inventory.json',JSON.stringify(inventory,null,2)+'\n');
console.log(`License inventory: ${rows.length} direct packages; ${rows.filter(row=>row.status==='metadata-only').length} metadata-only entries. Game-image permissions remain unverified.`);
