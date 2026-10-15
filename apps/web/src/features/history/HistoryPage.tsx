// SPDX-License-Identifier: GPL-3.0-only
import React,{useEffect,useState} from 'react';
import Link from '@docusaurus/Link';
import {useHistory,useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {ArrowLeft,ChevronDown,ExternalLink,FileClock,GitCommitHorizontal,PencilLine} from 'lucide-react';
import {canonicalHistoryPage,type HistoryResponse,type HistoryAuthor,type HistoryDiff} from '../../../../../packages/wiki-schema/src/history';
import {createWorkspaceService} from '../workbench/service';
import {message} from '../../components/api';
import './HistoryPage.css';

const date=(value:string)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
function Author({author}:{author:HistoryAuthor}) {
  return <span className="revision-author">{author.wiki?<Link to={`/contributors/?uid=${encodeURIComponent(author.wiki.uid)}`}>{author.wiki.display_name}</Link>:<span>{author.name}</span>}{author.github&&<a href={`https://github.com/${encodeURIComponent(author.github.login)}`} target="_blank" rel="noreferrer">@{author.github.login}<ExternalLink size={11} aria-hidden="true"/></a>}</span>;
}
function RevisionDiff({origin,page,source,sha,url}:{origin:string;page:string;source:string;sha:string;url:string}) {
  const [result,setResult]=useState<HistoryDiff|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setResult(null);setError('');
    createWorkspaceService(origin,undefined,controller.signal).historyDiff(page,source,sha).then(value=>{if(!controller.signal.aborted)setResult(value);}).catch(reason=>{if(!controller.signal.aborted)setError(message(reason));});
    return()=>controller.abort();
  },[origin,page,source,sha,retry]);
  if(error)return <div className="revision-diff" role="status"><p>{error}</p><button className="cm-button" onClick={()=>setRetry(value=>value+1)}>重新读取差异</button><a className="cm-button" href={url} target="_blank" rel="noreferrer">GitHub 完整差异<ExternalLink size={12} aria-hidden="true"/></a></div>;
  if(!result)return <p className="revision-diff" role="status">正在读取这次修改…</p>;
  return <div className="revision-diff"><div className="revision-diff-meta">{result.additions!==null&&<span className="revision-added">+{result.additions}</span>}{result.deletions!==null&&<span className="revision-removed">−{result.deletions}</span>}<span>与前一版本比较</span><a href={url} target="_blank" rel="noreferrer">GitHub 完整差异<ExternalLink size={12} aria-hidden="true"/></a></div>{result.patch?<pre tabIndex={0} aria-label="所选资料源的修改差异"><code>{result.patch.split('\n').map((line,index)=><span key={index} className={line.startsWith('+')?'revision-line-added':line.startsWith('-')?'revision-line-removed':line.startsWith('@@')?'revision-line-range':''}>{line+'\n'}</span>)}</code></pre>:<p>此差异较大或 GitHub 未提供该文件的文本预览，请在 GitHub 查看完整修改。</p>}</div>;
}
/** Public reading has no dependency on /me, a role gate, or local demo history. */
export default function HistoryPage({target,title}:{target:string;title:string}) {
  const {siteConfig}=useDocusaurusContext(),origin=String(siteConfig.customFields?.apiOrigin||''),location=useLocation(),router=useHistory();
  let page='';try{page=canonicalHistoryPage(target);}catch{/* Invalid links retain a readable recovery view. */}
  const query=new URLSearchParams(location.search),source=query.get('source')||undefined,ref=query.get('ref')||undefined;
  const cursorText=query.get('cursor')||'1',cursor=/^[1-9]\d{0,3}$/.test(cursorText)&&Number(cursorText)<=1000?Number(cursorText):1;
  const context=JSON.stringify([origin,page,source,cursor,ref]);
  const [state,setState]=useState<{context:string;data?:HistoryResponse;error?:string}|null>(null),[retry,setRetry]=useState(0),[expanded,setExpanded]=useState<string|null>(null);
  const data=state?.context===context?state.data:undefined,error=state?.context===context?state.error:undefined;
  useEffect(()=>{
    const controller=new AbortController();setState(null);setExpanded(null);
    if(!page){setState({context,error:'这个历史链接没有有效的资料地址。请从原页面重新打开修订记录。'});return()=>controller.abort();}
    createWorkspaceService(origin,undefined,controller.signal).history(page,source,cursor,ref).then(value=>{if(!controller.signal.aborted)setState({context,data:value});}).catch(reason=>{if(!controller.signal.aborted)setState({context,error:message(reason)});});
    return()=>controller.abort();
  },[context,retry]);
  function navigate(values:{source?:string;cursor?:number;ref?:string}) {
    const next=new URLSearchParams({page,entity:title,...(values.source?{source:values.source}:{}),...(values.cursor&&values.cursor>1?{cursor:String(values.cursor)}:{}),...(values.ref?{ref:values.ref}:{})});
    router.push('/history/?'+next);
  }
  const repository=data?.repository||String(siteConfig.customFields?.githubUrl||'https://github.com/myouo/rocowiki');
  const commitUrl=(sha:string)=>`${repository}/commit/${sha}`;
  return <section className="cm-root revision-history" aria-label="公开修订历史">
    <header className="cm-page-heading"><div className="cm-heading-main"><div className="cm-eyebrow"><FileClock size={15} aria-hidden="true"/>公开版本记录</div><h1>修订历史 · {title}</h1><p>查看真实修改、原作者与版本差异。阅读历史无需登录。</p></div><div className="cm-heading-actions">{page&&<Link className="cm-button" to={page}><ArrowLeft size={14} aria-hidden="true"/>返回资料</Link>}{page&&<Link className="cm-button cm-button-primary" to={'/edit/?'+new URLSearchParams({entity:title,returnTo:page})}><PencilLine size={14} aria-hidden="true"/>编辑此页</Link>}</div></header>
    {error?<section className="cm-paper" role="status"><p>{error}</p><button className="cm-button" onClick={()=>setRetry(value=>value+1)}>重新读取</button><a className="cm-button" href={repository+'/commits/main/'} target="_blank" rel="noreferrer">在 GitHub 查看<ExternalLink size={13}/></a></section>:!data?<section className="cm-paper" role="status">正在读取公开修订记录…</section>:<>
      <section className="cm-paper revision-sources"><div><h2>资料来源</h2><small>选择要查看的记录</small></div><nav aria-label="修订资料来源">{data.sources.map(item=><button type="button" key={item.id} className="cm-button" aria-pressed={item.id===data.source.id} onClick={()=>navigate({source:item.id})}>{item.label}</button>)}</nav><p>{data.source.shared?'以下是共享资料文件的修订，可能同时涉及其他条目；记录不等于当前条目被逐次修改。':'以下记录对应本页正文源文件。'} 已绑定的 GitHub 作者可通过站内昵称访问个人页。</p><code>{data.source.path}</code></section>
      <section className="cm-paper revision-list" aria-label="GitHub 提交记录"><div className="revision-list-heading"><h2><GitCommitHorizontal size={19} aria-hidden="true"/>修改记录</h2><a href={`${repository}/commits/${data.ref}/${data.source.path}`} target="_blank" rel="noreferrer">GitHub 源记录<ExternalLink size={13} aria-hidden="true"/></a></div>
        {data.commits.length?<ol>{data.commits.map(row=><li key={row.sha}><article><div className="revision-record"><span className="revision-dot" aria-hidden="true"/><div className="revision-record-main"><h3><a href={commitUrl(row.sha)} target="_blank" rel="noreferrer">{row.summary||'更新资料'}</a></h3><div className="revision-record-meta"><Author author={row.author}/><time dateTime={row.date}>{date(row.date)} · 北京时间</time></div>{row.contributors.filter(person=>person.uid!==row.author.wiki?.uid).map(person=><p className="revision-contributor" key={person.uid}>站内投稿：<Link to={`/contributors/?uid=${encodeURIComponent(person.uid)}`}>{person.display_name}</Link></p>)}</div><div className="revision-record-actions"><a href={commitUrl(row.sha)} target="_blank" rel="noreferrer"><code>{row.sha.slice(0,8)}</code></a><button type="button" className="cm-button" aria-expanded={expanded===row.sha} onClick={()=>setExpanded(expanded===row.sha?null:row.sha)}>{expanded===row.sha?'收起差异':'查看差异'}<ChevronDown size={13} aria-hidden="true"/></button></div></div>{expanded===row.sha&&<RevisionDiff key={context+row.sha} origin={origin} page={page} source={data.source.id} sha={row.sha} url={commitUrl(row.sha)}/>}</article></li>)}</ol>:<div className="cm-empty"><FileClock size={25}/><h3>尚无可显示的修订</h3><p>GitHub 当前主分支没有返回这个资料源的记录，可以切换资料来源查看。</p></div>}
        <nav className="revision-pagination" aria-label="修订记录翻页"><button className="cm-button" disabled={cursor===1} onClick={()=>navigate({source:data.source.id,cursor:cursor-1,ref:data.ref})}>较新记录</button><span>第 {cursor} 页</span><button className="cm-button" disabled={data.next_cursor===null} onClick={()=>navigate({source:data.source.id,cursor:data.next_cursor??cursor,ref:data.ref})}>更早记录</button></nav>
      </section>
    </>}
  </section>;
}
