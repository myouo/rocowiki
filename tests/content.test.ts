import {describe,it,expect} from 'vitest';
import {validateMarkdown,renderMarkdown,validateEntity} from '../packages/content-validator/src/index';
import {pageFor,contentPath,submissionSchema,petPatchSchema,skillPatchSchema} from '../packages/wiki-schema/src/index';
describe('content trust boundary',()=>{
  it.each(['../package','../../.github/workflows/deploy.yml','%2e%2e%2fmain','/etc/passwd','research-method.mdx','ｒesearch-method','Research-method','research-method/other','unknown'])('rejects an uncontrolled page ID: %s',id=>expect(()=>pageFor(id)).toThrow());
  it('maps IDs to a fixed content path',()=>expect(contentPath(pageFor('research-method'))).toBe('content/mechanics/research-method.md'));
  it.each([
    '<script>alert(1)</script>','<img src=x onerror=alert(1)>','<svg><script/></svg>','<Widget />',
    'import X from "evil"','export const x = 1','Hello {globalThis.process}',
    '[x](javascript:alert%281%29)','[x](javascript&#58;alert%281%29)','[x](data:text/html,evil)',
    '![x](https://example.com/a.svg)','![x][ref]\n\n[ref]: https://example.com/a.svg',
    '---\nslug: /hacked\n---\nText','```js title="injected"\nx\n```','\u0000'
  ])('rejects executable or invalid content: %s',body=>expect(()=>validateMarkdown(body)).toThrow());
  it('rejects oversized bodies',()=>expect(()=>validateMarkdown('x'.repeat(65537))).toThrow());
  it.each(['![x][ref]','![ref][]','![ref]'])('rejects duplicate image definitions through the rendering entry point: %s',async reference=>{
    const content=`${reference}\n\n[ref]: https://example.com/external.svg\n[REF]: /media/allowed.png`;
    expect(()=>validateMarkdown(content)).toThrow('DUPLICATE_REFERENCE_DEFINITION');
    await expect(renderMarkdown(content)).rejects.toThrow('DUPLICATE_REFERENCE_DEFINITION');
  });
  it.each([
    '[a b]: https://example.com/first\n[A  B]: https://example.com/second',
    '[ref]: /media/first.png\n[REF]: /media/second.png',
    '[ref]: /media/same.png\n[ref]: /media/same.png',
    '[ß]: /media/first.png\n[SS]: /media/second.png',
  ])('rejects duplicate normalized definitions even when both targets are safe: %s',body=>{
    expect(()=>validateMarkdown(body)).toThrow('DUPLICATE_REFERENCE_DEFINITION');
  });
  it('renders a unique normalized image reference with the validated target',async()=>{
    expect(await renderMarkdown('![image][A  B]\n\n[a b]: /media/safe.png')).toContain('src="/media/safe.png"');
  });
  it('safely renders code, tables and HTTPS links',async()=>{
    const html=await renderMarkdown('# Heading\n\n| Key | Value |\n| --- | --- |\n| a | b |\n\n```html\n<script>alert(1)</script>\n```\n\n[x](https://example.com)');
    expect(html).toContain('<table>');expect(html).toMatch(/(&lt;|&#x3C;)script/);expect(html).not.toContain('<script>');expect(html).toContain('href="https://example.com"');
  });
  it('rejects frontend identity and arbitrary path fields',()=>expect(()=>submissionSchema.parse({kind:'article',page_id:'contributing',base_commit_sha:'a'.repeat(40),base_blob_sha:'b'.repeat(40),content_markdown:'hello',edit_summary:'meaningful edit',source_references:[{url:'https://example.com',title:'source',level:'tested'}],uid:'admin',path:'.github/workflows/a.yml'})).toThrow());
  it('keeps entity identity/revision outside editable patches',()=>{expect(()=>petPatchSchema.parse({id:'another'})).toThrow();expect(()=>skillPatchSchema.parse({revision:1})).toThrow();});
  it('checks entity references and strict fields',()=>expect(()=>validateEntity({id:'pet-test',kind:'pet',section:'pets',title:'Test',slug:'pets/test',critical:false},{id:'pet-test',revision:1,name:'Test',aliases:[],types:['test'],skills:['unregistered'],stats:{hp:1,attack:1,defense:1,magicAttack:1,magicDefense:1,speed:1},description:'Sample',sources:[{title:'sample',url:'https://example.com',level:'unverified'}]})).toThrow('UNKNOWN_SKILL'));
});
