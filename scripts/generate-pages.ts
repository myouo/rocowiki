import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { catalog, contentPath } from '../packages/wiki-schema/src/index';
import { renderMarkdown, validateEntity } from '../packages/content-validator/src/index';
import {publishedSearchRecord,type PublishedSearchRecord} from './published-search-records';

const root=process.cwd(),out=path.join(root,'apps/web/docs-generated');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
let sha=process.env.SOURCE_COMMIT_SHA||process.env.GITHUB_SHA||'unversioned';
if(sha==='unversioned'){try{sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}}
const entities=[];
const searchRecords:PublishedSearchRecord[]=[];
for(const page of catalog) {
  const body=await readFile(path.join(root,contentPath(page)),'utf8');
  const data=page.kind==='article'?null:validateEntity(page,JSON.parse(body));
  const html=await renderMarkdown(data?`# ${data.name}\n\n${data.description}`:body);
  let metadata:Record<string,unknown>={};
  try{metadata=JSON.parse(await readFile(path.join(root,`content/metadata/${page.id}.json`),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const publicMeta={...metadata,id:page.id,title:page.title,source_commit_sha:sha};
  const front=`---\nid: ${JSON.stringify(page.id)}\ntitle: ${JSON.stringify(page.title)}\nslug: /${page.slug}\nhide_title: true\n---\n\n`;
  // User data only enters literal JSON strings. The imported component is repository-owned.
  const generated=front+`import Article from '@site/src/components/Article';\n\n<Article html={${JSON.stringify(html)}} page={${JSON.stringify(publicMeta)}} />\n`;
  await mkdir(path.join(out,page.section),{recursive:true});await writeFile(path.join(out,page.section,`${page.id}.mdx`),generated);
  if(data)entities.push({kind:page.kind,slug:page.slug,...data});
  searchRecords.push(publishedSearchRecord(page,body,data));
}
await mkdir(path.join(root,'apps/web/src/generated'),{recursive:true});
await writeFile(path.join(root,'apps/web/src/generated/catalog.json'),JSON.stringify({pages:catalog,entities},null,2));
await writeFile(path.join(root,'apps/web/src/generated/search.json'),JSON.stringify(searchRecords,null,2));
console.log(`Generated ${catalog.length} public pages (${sha.slice(0,8)}).`);
