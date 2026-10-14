// SPDX-License-Identifier: GPL-3.0-only
import React,{useEffect,useState} from 'react';
import Link from '@docusaurus/Link';
import {useHistory} from '@docusaurus/router';
import {ArrowRight,BookOpen,ChevronLeft,ChevronRight,FileCheck2,Heart,History,MessageCircle} from 'lucide-react';
import Select from '../../wiki/Select';
import {ProfileAvatar} from '../../wiki/AccountIdentity';
import ReadingMarkdown from '../../wiki/editing/ReadingMarkdown';
import {activityViews,periods,type ActivityView,type CommunityPeriod} from '../../../../../packages/wiki-schema/src/community';
import type {Me} from '../workbench/contracts';
import type {CommunityAccountState} from './useCommunityAccount';
import {useCommunityQuery} from './useCommunityQuery';

const views=[{id:'guideLikes',label:'攻略被点赞',Icon:Heart,event:'赞了你的攻略',empty:'攻略还没有收到点赞'},{id:'commentLikes',label:'评论被点赞',Icon:MessageCircle,event:'赞了你的评论',empty:'评论还没有收到点赞'},{id:'comments',label:'参与讨论',Icon:BookOpen,event:'发表了评论',empty:'还没有参与讨论'},{id:'contributions',label:'已发布贡献',Icon:FileCheck2,event:'发布了一份修订',empty:'还没有已发布贡献'}] as const;
const periodOptions=[{value:'all',label:'全部时间'},{value:'month',label:'本月'},{value:'week',label:'本周'},{value:'day',label:'今天'}];
const format=(seconds:number)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(seconds*1000));
export default function CommunityActivity({origin,me,query,state,onIdentityError}:{origin:string;me:Me;query:URLSearchParams;state:CommunityAccountState;onIdentityError:(error:unknown)=>void}) {
  const history=useHistory(),view=activityViews.includes(query.get('view') as ActivityView)?query.get('view') as ActivityView:'comments',period=periods.includes(query.get('period') as CommunityPeriod)?query.get('period') as CommunityPeriod:'all';
  const [cursors,setCursors]=useState<string[]>([]),cursor=cursors.at(-1),selected=views.find(item=>item.id===view)!,Icon=selected.Icon;
  useEffect(()=>setCursors([]),[me.user.uid,view,period]);
  const result=useCommunityQuery(origin,me,`${view}:${period}:${cursor??''}:${state.version}`,service=>service.activity(me.user.uid,view,period,cursor),onIdentityError);
  const navigate=(nextView:ActivityView,nextPeriod=period)=>history.push('/account/?'+new URLSearchParams({tab:'activity',view:nextView,period:nextPeriod}));
  const counts={guideLikes:state.data?.stats.guide_likes,commentLikes:state.data?.stats.comment_likes,comments:state.data?.stats.comments,contributions:state.data?.stats.contributions};
  return <section className="rw-community-activity-v73"><div className="rw-activity-heading-v73"><span><History size={21}/></span><div><h2>社区足迹</h2><p>从收到的每一份赞同，回到你参与过的资料和讨论。</p></div></div>
    <nav className="rw-activity-tabs-v73" aria-label="社区足迹分类">{views.map(item=><button key={item.id} aria-pressed={view===item.id} className={view===item.id?'is-active':''} onClick={()=>navigate(item.id)}><item.Icon size={16}/><span>{item.label}</span><strong>{counts[item.id]??'—'}</strong></button>)}</nav>
    <div className="rw-activity-records-heading-v73"><div><h3>{selected.label}</h3><p>北京时间 · 最新在前</p></div><label><span>记录时间</span><Select ariaLabel="社区足迹时间范围" value={period} options={periodOptions} onChange={value=>navigate(view,value as CommunityPeriod)}/></label></div>
    {!result.data?<div className="rw-social-empty-v72" role="status"><p>{result.error||'正在读取社区足迹…'}</p>{result.error&&<button className="cm-button" onClick={result.retry}>重新加载</button>}</div>:result.data.rows.length?<>
      <ol className="rw-activity-records-v73">{result.data.rows.map(row=><li key={row.event_id}><div className="rw-activity-avatar-v73"><ProfileAvatar avatar={row.avatar} size={38}/></div><article><header><div><strong>{row.display_name}</strong><span>{selected.event}</span></div><time dateTime={new Date(row.created_at*1000).toISOString()}>{format(row.created_at)}</time></header><h4><Link to={row.href}>{row.title}<ArrowRight size={13}/></Link></h4>{row.body&&<div className="rw-activity-excerpt-v73">{view==='contributions'?<p>{row.body}</p>:<ReadingMarkdown markdown={row.body} context={{entity:row.title,returnTo:row.href}} editHeadings={false}/>}</div>}<footer><Link to={row.href}>{view==='comments'||view==='commentLikes'?'回到这条讨论':'查看条目'}<ArrowRight size={13}/></Link>{view==='comments'&&<span><Heart size={13}/>收到 {row.received_count} 个赞</span>}</footer></article></li>)}</ol>
      <div className="community-record-pagination"><button className="cm-button" disabled={!cursors.length} onClick={()=>setCursors(old=>old.slice(0,-1))}><ChevronLeft size={14}/>上一页</button><span>第 {cursors.length+1} 页</span><button className="cm-button" disabled={!result.data.next_cursor} onClick={()=>{if(result.data?.next_cursor)setCursors(old=>[...old,result.data!.next_cursor!]);}}>下一页<ChevronRight size={14}/></button></div>
    </>:<div className="rw-social-empty-v72"><Icon size={28}/><strong>{period==='all'?selected.empty:'这个时间范围还没有记录'}</strong><p>{view==='contributions'?'草稿和待审核投稿仍在草稿与投稿中；只有已发布的有效修订计入这里。':'在词条的本页讨论中分享发现、提出疑问或补充证据。'}</p><Link className="cm-button" to={view==='contributions'?'/account/?tab=submissions':'/pets/'}>{view==='contributions'?'查看我的投稿':'浏览资料'}<ArrowRight size={14}/></Link></div>}
    <p className="rw-social-footnote-v72">记录来自正式社区服务。取消点赞或移除评论后，对应获赞会同步回退；重新点赞保留最初的时间。</p>
  </section>;
}
