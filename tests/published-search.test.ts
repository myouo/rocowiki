import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {catalog,pageFor,contentPath} from '../packages/wiki-schema/src/index';
import {publishedSearchRecord} from '../scripts/published-search-records';
import {searchRecords,matchedExcerpt} from '../apps/web/src/wiki/catalog/searchModel';
it('builds public search records for every registered page from repository content',()=>{
  const records=JSON.parse(readFileSync('apps/web/src/generated/search.json','utf8')) as ReturnType<typeof publishedSearchRecord>[];
  expect(records.map(record=>record.id).sort()).toEqual(catalog.map(page=>page.id).sort());
  for(const page of catalog){
    const record=records.find(record=>record.id===page.id)!;
    expect(record.to).toBe(`/wiki/${page.slug}/`);expect(record.title).toBe(page.title);
    expect(record.keywords).toContain(readFileSync(contentPath(page),'utf8'));
  }
});
it('ranks formal titles first and returns bounded excerpts for public body matches',()=>{
  const page=pageFor('contributing'),content='开头'.repeat(500)+'最终检索词'+'结尾'.repeat(500);
  const record=publishedSearchRecord(page,content);
  expect(searchRecords([record],'最终检索词','共建文章')).toEqual([record]);
  const snippet=matchedExcerpt(record.keywords,'最终检索词');
  expect(snippet.length).toBeLessThanOrEqual(160);expect(snippet).toContain('最终检索词');
  const weaker={...record,title:'相关资料',keywords:page.title};
  expect(searchRecords([weaker,record],` ${page.title} `)[0].title).toBe(page.title);
});
it.each(['机制研究与来源规范','参与共建'])('includes the complete formal title: %s',title=>{
  const records=JSON.parse(readFileSync('apps/web/src/generated/search.json','utf8')) as ReturnType<typeof publishedSearchRecord>[];
  expect(records.filter(record=>(record.title+' '+record.keywords+' '+record.meta).includes(title))).not.toHaveLength(0);
});
it('automatically derives routes, new titles and public body text without maintaining a second list',()=>{
  const page={...pageFor('contributing'),id:'new-article',title:'新增真实资料',slug:'guides/new-article'};
  const record=publishedSearchRecord(page,'# 新资料\n\n只在正文出现的检索词');
  expect(record).toMatchObject({id:page.id,title:page.title,to:'/wiki/guides/new-article/',kind:'共建文章'});
  expect(record.keywords).toContain('只在正文出现的检索词');
});
