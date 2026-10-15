// SPDX-License-Identifier: GPL-3.0-only
import {describe, expect, it} from 'vitest';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {canonicalCatalogHref, catalogAliases, catalogEntryHref, catalogStorageKey, hasLegacyCatalogContext, matchesCatalogEntry, safeCatalogListReturnTo, withCatalogContext} from '../packages/wiki-schema/src/catalog-routes';
import {requestedCatalogCount} from '../apps/web/src/wiki/catalog/listNavigation';
import {canonicalCommunityPage} from '../packages/wiki-schema/src/community';
import {canonicalHistoryPage} from '../packages/wiki-schema/src/history';
import {historySources} from '../apps/api/src/history-sources';
import {petHrefWithReturnTo} from '../apps/web/src/wiki/catalog/pets/feedModel';

describe('public catalogue URL compatibility', () => {
  it('normalizes slug and query entrances without dropping reading context or chapters', () => {
    expect(canonicalCatalogHref('/pets/haifu/?returnTo=%2Fpets%2F%3Ftype%3D水#skills')).toBe('/pets/3092/?returnTo=%2Fpets%2F%3Ftype%3D%E6%B0%B4#skills');
    expect(canonicalCatalogHref('/pets/?entry=official-3441&section=skills&returnTo=%2Fpets%2F%3Floaded%3D120')).toBe('/pets/3441/?returnTo=%2Fpets%2F%3Floaded%3D120#skills');
    expect(canonicalCatalogHref('/skills/?entry=official-skill-3044&pet=haifu#effects')).toBe('/skills/3044/?pet=3092#effects');
    expect(canonicalCatalogHref('/skills/xiazi/')).toBe('/skills/3044/');
    expect(canonicalCatalogHref('/pets/3092/?entry=official-3441#sources')).toBe('/pets/3092/#sources');
  });
  it('keeps public identities stable when display names or edited numbers change', () => {
    expect(catalogEntryHref('pets', {slug:'haifu',number:9999})).toBe('/pets/3092/');
    expect(catalogEntryHref('skills', {slug:'official-skill-3806',number:42})).toBe('/skills/3806/');
    expect(matchesCatalogEntry('pets', {slug:'haifu',number:9999}, '3092')).toBe(true);
    expect(matchesCatalogEntry('pets', {slug:'haifu',number:9999}, '9999')).toBe(false);
    expect(catalogEntryHref('pets', {slug:'local-synthetic',number:3092,localEntry:true})).toBe('/pets/?entry=local-synthetic');
    expect(matchesCatalogEntry('pets', {slug:'local-synthetic',number:3092,localEntry:true}, '3092')).toBe(false);
  });
  it('does not rewrite filters, other domains or malformed and unknown identity formats', () => {
    expect(catalogStorageKey('/pets/999999999999999999999999999999999999/')).toBe('/pets/999999999999999999999999999999999999/');
    for (const value of ['/pets/?type=水&loaded=120','/skills/?effect=回复PP','/pets/?entry=local-synthetic','/skills/unknown/','/pets/0/','/pets/3092/nested/','//evil.test/pets/haifu/','/pets\\haifu/','https://evil.test/pets/haifu/','/skills/?entry=official-skill-NaN']) expect(canonicalCatalogHref(value)).toBe(value);
    for (const kind of ['pets','skills'] as const) for (const [alias,id] of Object.entries(catalogAliases[kind])) {
      expect(canonicalCatalogHref(`/${kind}/${alias}/`)).toBe(`/${kind}/${id}/`);
      expect(canonicalCatalogHref(`/${kind}/${id}/`)).toBe(`/${kind}/${id}/`);
    }
  });
  it('uses the existing discussion and history identity for new and old URLs', () => {
    for (const [current,legacy] of [['/pets/3092/','/pets/haifu/'],['/pets/3441/','/pets/?entry=official-3441'],['/skills/3044/','/skills/xiazi/'],['/skills/3806/','/skills/?entry=official-skill-3806']]) {
      expect(catalogStorageKey(current)).toBe(legacy);
      expect(canonicalCommunityPage(current+'?returnTo=%2Fpets%2F#discussion')).toBe(canonicalCommunityPage(legacy));
      expect(canonicalHistoryPage(current)).toBe(canonicalHistoryPage(legacy));
      expect(historySources(current)).toEqual(historySources(legacy));
    }
  });
  it('adds context without breaking query separators or the requested fragment', () => {
    expect(withCatalogContext('/skills/3044/#effects',{pet:'haifu'})).toBe('/skills/3044/?pet=3092#effects');
    expect(withCatalogContext('/skills/?entry=local-example',{pet:'haifu'})).toBe('/skills/?entry=local-example&pet=3092');
    expect(petHrefWithReturnTo('/pets/3092/#skills','/pets/?type=水&loaded=120')).toBe('/pets/3092/?returnTo=%2Fpets%2F%3Ftype%3D%E6%B0%B4%26loaded%3D120#skills');
  });
  it('normalizes pet contexts on existing numbered URLs and every shared link factory', () => {
    const reported='/skills/3969/?pet=official-3432';
    expect(canonicalCatalogHref(reported)).toBe('/skills/3969/?pet=3432');
    expect(canonicalCatalogHref(reported+'#effects')).toBe('/skills/3969/?pet=3432#effects');
    expect(withCatalogContext('/skills/3969/',{pet:'official-3432'})).toBe('/skills/3969/?pet=3432');
    expect(canonicalCatalogHref('/skills/3969/?pet=3432')).toBe('/skills/3969/?pet=3432');
    const returned=new URL(canonicalCatalogHref('/skills/3969/?'+new URLSearchParams({pet:'official-3432',returnTo:'/skills/3044/?pet=haifu#effects'})), 'https://wiki.test');
    expect(returned.searchParams.get('pet')).toBe('3432');
    expect(returned.searchParams.get('returnTo')).toBe('/skills/3044/?pet=3092#effects');
    expect(canonicalCatalogHref('/skills/3969/?pet=local-example')).toBe('/skills/3969/?pet=local-example');
    expect(hasLegacyCatalogContext(reported)).toBe(true);
    expect(hasLegacyCatalogContext('/edit/?'+new URLSearchParams({returnTo:reported}))).toBe(true);
    expect(hasLegacyCatalogContext(canonicalCatalogHref(reported))).toBe(false);
    expect(hasLegacyCatalogContext('/edit/?record=official-3432&returnTo=%2Fpets%2F3432%2F')).toBe(false);
    const edit=new URL(canonicalCatalogHref('/edit/?'+new URLSearchParams({record:'official-3432',returnTo:reported})), 'https://wiki.test');
    expect(edit.searchParams.get('returnTo')).toBe('/skills/3969/?pet=3432');
    expect(edit.searchParams.get('record')).toBe('official-3432');
    const history=new URL(canonicalCatalogHref('/history/?'+new URLSearchParams({page:'/pets/?entry=official-3432'})), 'https://wiki.test');
    expect(history.searchParams.get('page')).toBe('/pets/3432/');
    expect(hasLegacyCatalogContext(history.pathname+history.search)).toBe(false);
  });
  it('uses numeric references in comparison and calculator URLs while preserving values and unknown records', () => {
    const compare=new URL(canonicalCatalogHref('/tools/compare/?pets=haifu,official-3432,local-example'), 'https://wiki.test');
    expect(compare.searchParams.get('pets')).toBe('3092,3432,local-example');
    expect(canonicalCatalogHref('/tools/stats/?pet=haifu')).toBe('/tools/stats/?pet=3092');
    const form={pet:'official-3432',petHref:'/pets/?entry=official-3432',petName:'原始名称',level:'83',base:['1','2','3','4','5','6']};
    const before=JSON.stringify(form);
    const href=canonicalCatalogHref('/tools/stats/?'+new URLSearchParams({calc:before}));
    const actual=JSON.parse(new URL(href,'https://wiki.test').searchParams.get('calc')!);
    expect(actual).toEqual({...form,pet:'3432',petHref:'/pets/3432/'});
    expect(JSON.stringify(form)).toBe(before);
    expect(canonicalCatalogHref(href)).toBe(href);
    for(const payload of ['{bad','[]','null']){
      const value='/tools/stats/?'+new URLSearchParams({calc:payload});
      expect(canonicalCatalogHref(value)).toBe(value);
    }
  });
  it('retains directory filters and bounded loading depth while rejecting non-directory return targets', () => {
    const target='/skills/?kind=变化&sort=number&order=desc&loaded=120';
    expect(safeCatalogListReturnTo('skills',target)).toBe(target);
    for(const bad of ['https://evil.test/skills/','//evil.test/skills/','/pets/','/skills/3044/','/skills/?entry=official-skill-3044','/skills/#effects','/skills/?q=bad\nvalue'])expect(safeCatalogListReturnTo('skills',bad)).toBe('/skills/');
    expect(requestedCatalogCount(new URLSearchParams('loaded=120'),3960)).toBe(120);
    expect(requestedCatalogCount(new URLSearchParams('page=3'),3960)).toBe(180);
    for(const bad of ['0','-60','NaN','99999999999999999999'])expect(requestedCatalogCount(new URLSearchParams({loaded:bad}),3960)).toBe(60);
    expect(requestedCatalogCount(new URLSearchParams('loaded=120'),3)).toBe(3);
  });
});

it('registers every committed official ID for static rendering and preserves legacy entrances', async () => {
  const require=createRequire(import.meta.url);
  const plugin=require('../apps/web/plugins/wiki-routes/index.js')({siteDir:path.resolve('apps/web'),baseUrl:'/wiki-preview/'});
  const routes:string[]=await plugin.loadContent();
  const original:string[]=JSON.parse(readFileSync('apps/web/content/routes.json','utf8'));
  const added:{path:string;modules?:unknown}[]=[];
  let dataFiles=0;
  await plugin.contentLoaded({content:routes,actions:{addRoute:(route:{path:string;modules?:unknown})=>added.push(route),createData:async()=>`route-${++dataFiles}.json`}});
  expect(new Set(routes).size).toBe(routes.length);
  expect(dataFiles).toBe(original.length);
  for(const legacy of original)expect(routes).toContain(legacy);
  for(const kind of ['pets','skills'] as const) {
    const snapshot=JSON.parse(readFileSync(`apps/web/content/official-${kind}.json`,'utf8')) as Record<string,{id:number}[]>;
    const routeSet=new Set(added.map(row=>row.path));
    for(const entry of snapshot[kind])expect(routeSet.has(`/wiki-preview/${kind}/${entry.id}/`)).toBe(true);
    const ids=new Set(snapshot[kind].map(row=>row.id));
    for(const id of Object.values(catalogAliases[kind]))expect(ids.has(id)).toBe(true);
  }
});

it('fails the real static-page build check when an emitted href reintroduces a legacy pet context', async () => {
  const require=createRequire(import.meta.url);
  const plugin=require('../apps/web/plugins/wiki-routes/index.js')({siteDir:path.resolve('apps/web'),baseUrl:'/'});
  const outDir=await mkdtemp(path.join(tmpdir(),'catalog-public-links-'));
  const file=path.join(outDir,'skills/3969/index.html');
  try {
    await mkdir(path.dirname(file),{recursive:true});
    await writeFile(file,'<html><body><a href="/skills/3969/?pet=official-3432">对焦</a></body></html>');
    await expect(plugin.postBuild({outDir,routesPaths:['/skills/3969/'],baseUrl:'/'})).rejects.toThrow('Legacy pet context');
    await writeFile(file,'<html><body><a href="/skills/3969/?pet=3432">对焦</a><a href="/edit/?record=official-3432&amp;returnTo=%2Fpets%2F3432%2F">编辑</a></body></html>');
    await expect(plugin.postBuild({outDir,routesPaths:['/skills/3969/'],baseUrl:'/'})).resolves.toBeUndefined();
  } finally {await rm(outDir,{recursive:true,force:true});}
});
