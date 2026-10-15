// SPDX-License-Identifier: GPL-3.0-only
import {describe, expect, it} from 'vitest';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {canonicalCatalogHref, catalogAliases, catalogEntryHref, catalogStorageKey, matchesCatalogEntry, withCatalogContext} from '../packages/wiki-schema/src/catalog-routes';
import {canonicalCommunityPage} from '../packages/wiki-schema/src/community';
import {canonicalHistoryPage} from '../packages/wiki-schema/src/history';
import {historySources} from '../apps/api/src/history-sources';
import {petHrefWithReturnTo} from '../apps/web/src/wiki/catalog/pets/feedModel';

describe('public catalogue URL compatibility', () => {
  it('normalizes slug and query entrances without dropping reading context or chapters', () => {
    expect(canonicalCatalogHref('/pets/haifu/?returnTo=%2Fpets%2F%3Ftype%3D水#skills')).toBe('/pets/3092/?returnTo=%2Fpets%2F%3Ftype%3D%E6%B0%B4#skills');
    expect(canonicalCatalogHref('/pets/?entry=official-3441&section=skills&returnTo=%2Fpets%2F%3Floaded%3D120')).toBe('/pets/3441/?returnTo=%2Fpets%2F%3Floaded%3D120#skills');
    expect(canonicalCatalogHref('/skills/?entry=official-skill-3044&pet=haifu#effects')).toBe('/skills/3044/?pet=haifu#effects');
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
    expect(withCatalogContext('/skills/3044/#effects',{pet:'haifu'})).toBe('/skills/3044/?pet=haifu#effects');
    expect(withCatalogContext('/skills/?entry=local-example',{pet:'haifu'})).toBe('/skills/?entry=local-example&pet=haifu');
    expect(petHrefWithReturnTo('/pets/3092/#skills','/pets/?type=水&loaded=120')).toBe('/pets/3092/?returnTo=%2Fpets%2F%3Ftype%3D%E6%B0%B4%26loaded%3D120#skills');
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
