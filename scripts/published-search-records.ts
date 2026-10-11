import type {CatalogEntry} from '../packages/wiki-schema/src/index';
export interface PublishedSearchRecord {id:string;title:string;kind:string;to:string;meta:string;keywords:string;}
/** Only validated public repository content enters the bundled search records. */
export function publishedSearchRecord(page:CatalogEntry,body:string,entity?:{name:string;aliases:string[]}|null):PublishedSearchRecord {
  const title=entity?.name??page.title;
  const description=body.replace(/[#*_`>[\]]/g,'').replace(/\s+/g,' ').trim();
  return {id:page.id,title,kind:page.kind==='article'?'共建文章':page.kind==='pet'?'宠物':'技能',to:`/wiki/${page.slug}/`,meta:description.slice(0,140),keywords:[page.title,...entity?.aliases??[],body].join(' ')};
}
