import { readFile,readdir } from 'node:fs/promises';
import { catalog,contentPath,sourceSchema } from '../packages/wiki-schema/src/index';
import { validateStoredContent } from '../packages/content-validator/src/index';
import { z } from 'zod';
import {createHash} from 'node:crypto';
z.object({external_image_hosts:z.array(z.string().regex(/^[a-z0-9.-]+$/)).max(100)}).strict().parse(JSON.parse(await readFile('content/policy.json','utf8')));
const expected=new Set(catalog.map(contentPath));
async function scan(dir:string):Promise<string[]> {
  let result:string[]=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){const p=`${dir}/${entry.name}`;if(entry.isSymbolicLink())throw new Error(`Symlink forbidden: ${p}`);if(entry.isDirectory())result.push(...await scan(p));else result.push(p);}
  return result;
}
for(const file of await scan('content')) {
  if(file==='content/catalog.json'||file==='content/policy.json')continue;
  if(file.startsWith('content/metadata/')) {
    const value=z.object({page_id:z.string(),revision_id:z.string().regex(/^rev_[0-9a-f-]{36}$/),public_uid:z.string().regex(/^usr_[0-9a-f-]{36}$/),snapshot_hash:z.string().regex(/^[a-f0-9]{64}$/),sources:z.array(sourceSchema).min(1).max(20)}).strict().parse(JSON.parse(await readFile(file,'utf8')));
    if(!catalog.some(p=>p.id===value.page_id)||file!==`content/metadata/${value.page_id}.json`)throw new Error('Invalid public metadata path');
    const body=await readFile(contentPath(catalog.find(p=>p.id===value.page_id)!),'utf8');
    if(createHash('sha256').update(body).digest('hex')!==value.snapshot_hash)throw new Error('Public snapshot hash mismatch');
    continue;
  }
  if(!expected.has(file))throw new Error(`Unregistered content: ${file}`);
}
for(const page of catalog)validateStoredContent(page,await readFile(contentPath(page),'utf8'));
console.log(`Validated ${catalog.length} registered content files.`);
