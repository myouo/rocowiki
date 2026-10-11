import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Root, Link, Image, Definition, Code } from 'mdast';
import { catalog, petSchema, skillSchema, type CatalogEntry, type SubmissionInput } from '../../wiki-schema/src/index';
import policy from '../../../content/policy.json';

const allowed = new Set(['root','paragraph','text','heading','blockquote','list','listItem','thematicBreak','strong','emphasis','delete','break','inlineCode','code','link','image','definition','linkReference','imageReference','table','tableRow','tableCell']);
const imageHosts:readonly string[]=policy.external_image_hosts;
export function safeUrl(value:string, image=false): boolean {
  if (/[\u0000-\u0020\u007f\\]/u.test(value)) return false;
  if (/^\/(?!\/)/.test(value)) return !value.includes('..')&&(!image||/^\/media\/[a-zA-Z0-9_/-]+\.(png|jpe?g|webp|gif)$/.test(value));
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && (!image || imageHosts.includes(u.hostname)&&/\.(png|jpe?g|webp|gif)$/i.test(u.pathname));
  } catch { return false; }
}
export function validateMarkdown(body:string): Root {
  if (new TextEncoder().encode(body).length > 65536 || !body.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(body)) throw new Error('INVALID_CONTENT');
  if (/^\s*---\s*\r?\n/.test(body)) throw new Error('FRONT_MATTER_FORBIDDEN');
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body);
  let count=0, images=0;
  visit(tree, node => {
    if (++count > 10000 || !allowed.has(node.type)) throw new Error('UNSAFE_MARKDOWN');
    if (node.type === 'code') {
      const code=node as Code;
      if (code.meta || (code.lang && !/^[a-z0-9+-]{1,32}$/i.test(code.lang))) throw new Error('UNSAFE_CODE_METADATA');
    }
    if (node.type === 'text' && /(^|\n)\s*(import\s|export\s)|\{[^\n]*\}/u.test(node.value)) throw new Error('MDX_FORBIDDEN');
    if (['link','image','definition'].includes(node.type)) {
      const link=node as Link|Image|Definition;
      if (!safeUrl(link.url,node.type==='image') || (link.title && link.title.length>500)) throw new Error('UNSAFE_URL');
      if (node.type==='image' && ++images>20) throw new Error('TOO_MANY_IMAGES');
    }
  });
  // remark already normalizes identifier whitespace. Use the renderer's uppercase
  // lookup and reject ambiguity instead of validating a different duplicate target.
  const definitions = new Map<string,string>();
  visit(tree,'definition',node=>{
    const key=node.identifier.toUpperCase();
    if(definitions.has(key))throw new Error('DUPLICATE_REFERENCE_DEFINITION');
    definitions.set(key,node.url);
  });
  visit(tree,'imageReference',node=>{if(!safeUrl(definitions.get(node.identifier.toUpperCase())??'',true)||++images>20)throw new Error('UNSAFE_IMAGE_REFERENCE');});
  return tree;
}
export async function renderMarkdown(body:string):Promise<string> {
  const tree=validateMarkdown(body);
  const renderer=unified().use(remarkRehype).use(rehypeSanitize).use(rehypeStringify);
  return renderer.stringify(await renderer.run(tree));
}
export function validateEntity(page:CatalogEntry,value:unknown) {
  const data = page.kind==='pet' ? petSchema.parse(value) : skillSchema.parse(value);
  if(data.id!==page.id)throw new Error('ENTITY_ID_MISMATCH');
  validateMarkdown(data.description);
  if ('skills' in data && data.skills.some(id=>!catalog.some(e=>e.kind==='skill'&&e.id===id)))throw new Error('UNKNOWN_SKILL');
  return data;
}
export function candidateContent(page:CatalogEntry,input:SubmissionInput,baseBody:string):string {
  if(page.kind!==input.kind)throw new Error('KIND_MISMATCH');
  if(input.kind==='article'){validateMarkdown(input.content_markdown);return input.content_markdown.replace(/\r\n/g,'\n');}
  const base=validateEntity(page,JSON.parse(baseBody));
  if(base.revision!==input.base_data_revision)throw new Error('STALE_BASE');
  const result=validateEntity(page,{...base,...input.patch,id:page.id,revision:base.revision+1});
  return JSON.stringify(result,null,2)+'\n';
}
export function validateStoredContent(page:CatalogEntry,body:string) {
  return page.kind==='article' ? validateMarkdown(body) : validateEntity(page,JSON.parse(body));
}
