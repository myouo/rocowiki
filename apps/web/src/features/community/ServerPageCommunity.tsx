// SPDX-License-Identifier: GPL-3.0-only
import React,{useEffect,useRef,useState} from 'react';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {ArrowRight,Heart,History,MessageCircle,NotebookPen,Send,Trash2,UsersRound} from 'lucide-react';
import {canonicalCommunityPage,type DiscussionResponse} from '../../../../../packages/wiki-schema/src/community';
import {canonicalCatalogHref} from '../../../../../packages/wiki-schema/src/catalog-routes';
import {message,RequestError} from '../../components/api';
import {createWorkspaceService} from '../workbench/service';
import {useHeaderProfile} from '../account/useHeaderProfile';
import {ProfileAvatar} from '../../wiki/AccountIdentity';
import EntityTextarea from '../../wiki/EntityTextarea';
import ReadingMarkdown from '../../wiki/editing/ReadingMarkdown';

const time=(seconds:number)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(seconds*1000));
export default function ServerPageCommunity({title}:{title:string}) {
  const {siteConfig}=useDocusaurusContext(),origin=String(siteConfig.customFields?.apiOrigin||''),location=useLocation();
  let page:string;
  try{page=canonicalCommunityPage(location.pathname+location.search);}catch{page='';}
  const {me,ready,refresh}=useHeaderProfile(origin);
  const context=page+'|'+(me?.user.uid??''),currentContext=useRef(context);currentContext.current=context;
  const [result,setResult]=useState<{page:string;uid:string|null;data:DiscussionResponse}|null>(null),[draftValue,setDraftValue]=useState({context:'',text:''}),[notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
  const draft=draftValue.context===context?draftValue.text:'',setDraft=(text:string)=>setDraftValue({context,text});
  const lifetime=useRef<AbortController|null>(null),generation=useRef(0),acting=useRef(false),pending=useRef<{body:string;key:string}|null>(null),discussion=useRef<HTMLDetailsElement>(null);
  const uid=me?.user.uid??null,comments=result?.page===page&&result.uid===uid?result.data.comments:[],total=result?.page===page&&result.uid===uid?result.data.total:null;
  useEffect(()=>{
    const controller=new AbortController();lifetime.current=controller;const request=++generation.current;
    setResult(null);setError('');setBusy(false);acting.current=false;
    if(!ready||!page||!origin)return ()=>controller.abort();
    const service=createWorkspaceService(origin,me?.csrf_token,controller.signal);
    void service.discussion(page,uid??undefined).then(data=>{if(!controller.signal.aborted&&request===generation.current)setResult({page,uid,data});}).catch(reason=>{if(!controller.signal.aborted){setError(message(reason));if(reason instanceof RequestError&&reason.code==='ACCOUNT_CHANGED')refresh();}});
    return ()=>controller.abort();
  },[origin,page,uid,me?.csrf_token,ready,retry]);
  useEffect(()=>{setDraft('');setNotice('');pending.current=null;},[page,uid]);
  useEffect(()=>{
    let fragment=location.hash.slice(1);try{fragment=decodeURIComponent(fragment);}catch{}
    if(!discussion.current||!(fragment==='discussion'||fragment.startsWith('comment-')))return;
    discussion.current.open=true;
    const frame=requestAnimationFrame(()=>document.getElementById(fragment)?.scrollIntoView({block:'start'}));
    return ()=>cancelAnimationFrame(frame);
  },[page,location.hash,comments.length]);
  async function run(operation:(service:ReturnType<typeof createWorkspaceService>)=>Promise<string>,onSuccess?:()=>void) {
    if(!me||!page||acting.current)return;
    const scope=lifetime.current,captured=context;if(!scope||scope.signal.aborted)return;
    acting.current=true;setBusy(true);setNotice('');
    try{const value=await operation(createWorkspaceService(origin,me.csrf_token,scope.signal));if(scope===lifetime.current&&!scope.signal.aborted&&currentContext.current===captured){onSuccess?.();setNotice(value);setRetry(n=>n+1);}}
    catch(reason){if(scope===lifetime.current&&!scope.signal.aborted&&currentContext.current===captured){setNotice(message(reason));if(reason instanceof RequestError&&reason.code==='COMMENT_REMOVED')pending.current=null;if(reason instanceof RequestError&&['ACCOUNT_CHANGED','UNAUTHORIZED'].includes(reason.code))refresh();}}
    finally{if(scope===lifetime.current&&!scope.signal.aborted&&currentContext.current===captured){acting.current=false;setBusy(false);}}
  }
  if(!page)return null;
  return <section className="rw-page-community-v72" aria-label="本页共建与讨论" data-no-editor>
    <div className="rw-maintainers-v72"><div className="rw-maintainers-heading-v72"><div><UsersRound size={20}/><h2>参与本页共建</h2></div><Link to={'/history/?'+new URLSearchParams({page:canonicalCatalogHref(page),entity:title})}><History size={14}/>修订历史</Link><Link to="/wiki/guides/contributing/"><NotebookPen size={14}/>投稿与署名规范<ArrowRight size={13}/></Link></div></div>
    <details ref={discussion} className="rw-page-discussion-v72" id="discussion"><summary><MessageCircle size={17}/><strong>本页讨论</strong><span>{total===null?'正在读取…':`${total} 条评论`}</span></summary><div className="rw-discussion-body-v72">
      <p>分享发现、提出疑问，或补充资料依据。输入 / 可关联宠物与技能。</p>
      {me?<form onSubmit={event=>{event.preventDefault();void run(async service=>{
        const body=draft.trim();if(!pending.current||pending.current.body!==body)pending.current={body,key:crypto.randomUUID()};
        const request=pending.current;await service.comment(me.user.uid,page,title,body,request.key);
        return '评论已发表。';
      },()=>{setDraft('');pending.current=null;});}}><EntityTextarea value={draft} onChange={setDraft} ariaLabel="本页评论" rows={3} maxLength={2000} disabled={busy} placeholder="说说你的发现，例如这个条件还需要什么证据？"/><div><span>{me.user.display_name}</span><button type="submit" className="rw-button" disabled={busy||draft.trim().length<2}><Send size={14}/>{busy?'正在保存…':'发表评论'}</button></div></form>:<p>{ready?<Link to="/account/">登录后参与讨论<ArrowRight size={13}/></Link>:'正在确认登录状态…'}</p>}
      {notice&&<p role="status">{notice}</p>}{error&&<p role="status">{error}<button type="button" className="rw-small-button" onClick={()=>setRetry(n=>n+1)}>重新加载</button></p>}
      <ol className="rw-comments-v72">{comments.map(comment=>{const own=uid===comment.author_uid,canRemove=own||me&&['reviewer','admin'].includes(me.user.role);return <li key={comment.comment_id} id={'comment-'+comment.comment_id}><ProfileAvatar avatar={comment.avatar} size={36}/><div><header><strong>{comment.display_name}</strong><time dateTime={new Date(comment.created_at*1000).toISOString()}>{time(comment.created_at)}</time></header><ReadingMarkdown markdown={comment.body} context={{entity:title,returnTo:page}} editHeadings={false}/><button type="button" aria-pressed={comment.liked} disabled={!me||own||busy} title={own?'自己的评论不计入自我点赞':'赞同这条评论'} onClick={()=>void run(async service=>{await service.like(me!.user.uid,'comment',comment.comment_id,!comment.liked);return comment.liked?'已取消点赞。':'已点赞。';})}><Heart size={13} fill={comment.liked?'currentColor':'none'}/>{comment.likes}{own&&<span>我的评论</span>}</button>{canRemove&&<button type="button" disabled={busy} onClick={()=>void run(async service=>{await service.removeComment(me!.user.uid,comment.comment_id);return '评论已移除。';})}><Trash2 size={13}/>移除</button>}</div></li>;})}</ol>
      {total===0&&!error&&<p>还没有讨论，留下第一个有依据的发现吧。</p>}{total!==null&&total>100&&<p>显示最近 100 条评论；自己的历史讨论可以在个人中心的社区足迹查看。</p>}
    </div></details>
  </section>;
}
