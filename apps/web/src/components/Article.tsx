import React from 'react';
import Link from '@docusaurus/Link';
import '../css/workbench.css';
import {catalog} from '../../../../packages/wiki-schema/src/index';

type Meta={id:string;title:string;source_commit_sha:string;revision_id?:string;public_uid?:string;sources?:{title:string;url:string;level:string}[]};
const level:Record<string,string>={official:'官方资料',tested:'实测记录',inferred:'玩家推导',unverified:'待验证'};
export default function Article({html,page}:{html:string;page:Meta}) {
  return <>
    <div className="wiki-provenance"><span>公开版本 · {page.source_commit_sha==='unversioned'?'本地构建':page.source_commit_sha.slice(0,8)}</span><Link to={`/workbench?page=${page.id}`}>提交修订 ↗</Link></div>
    {!/<h1(?:\s|>)/.test(html)&&<h1>{page.title}</h1>}
    <div data-pagefind-body className="wiki-body" dangerouslySetInnerHTML={{__html:html}}/>
    <aside className="wiki-evidence"><h3>来源与修订</h3>
      {page.sources?.length?<ul>{page.sources.map((s,i)=><li key={i}><span className="tag">{level[s.level]||'待验证'}</span> <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>:<p>本页为共建流程说明。后续游戏资料需附可核验来源。</p>}
      {page.revision_id&&<p>修订：<code>{page.revision_id}</code>{page.public_uid&&<> · <Link to={`/contributors?uid=${page.public_uid}`}>贡献者</Link></>}</p>}
      <Link to={'/history/?'+new URLSearchParams({page:`/wiki/${catalog.find(row=>row.id===page.id)?.slug||''}/`,entity:page.title})}>查看修订历史 ↗</Link>
    </aside>
  </>;
}
