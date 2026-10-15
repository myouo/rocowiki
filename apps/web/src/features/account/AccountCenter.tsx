// SPDX-License-Identifier: GPL-3.0-only
import React,{useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useHistory,useLocation} from '@docusaurus/router';
import {ArrowRight,Award,Bookmark,BookOpen,ChevronRight,FileClock,FilePenLine,History,House,LockKeyhole,LogOut,UserRound,X} from 'lucide-react';
import {AuthenticationPanel} from '../workbench/AuthenticationPanel';
import {AccountSettings} from '../workbench/AccountSettings';
import {statuses} from '../workbench/contracts';
import {useBookmarks} from '../../wiki/community/useBookmarks';
import catalog from '../../generated/catalog.json';
import {useAccountCenter} from './useAccountCenter';
import {useCommunityAccount} from './useCommunityAccount';
import CommunityOverview from './CommunityOverview';
import CommunityHonors from './CommunityHonors';
import CommunityActivity from './CommunityActivity';
import AccountIdentityCard,{accountRoles} from './AccountIdentityCard';
import AccountLoading from './AccountLoading';
import GithubBindingPanel from './GithubBindingPanel';
import '../../css/workbench.css';
import './AccountCenter.css';

const tabs=[['overview','我的首页',House],['submissions','我的投稿',FilePenLine],['bookmarks','我的收藏',Bookmark],['activity','社区足迹',History],['honors','社区荣誉',Award],['profile','个人资料',UserRound],['security','账号与安全',LockKeyhole]] as const;
type Tab=typeof tabs[number][0]|'drafts';
function pageTitle(id:string){return catalog.pages.find(page=>page.id===id)?.title??id;}
function internalHref(href:string){return href.startsWith('/')&&!href.startsWith('//')&&!/[\\\u0000-\u001f]/.test(href)?href:'/';}

export default function AccountCenter(){
  const {siteConfig}=useDocusaurusContext(),origin=typeof siteConfig.customFields?.apiOrigin==='string'?siteConfig.customFields.apiOrigin:'';
  const state=useAccountCenter(origin),community=useCommunityAccount(origin,state.me,state.invalidateSession);
  const {me,booting,busy,notice,sessionError,recheck,setNotice,drafts,submissions,draftState,submissionState,collectionState,collectionError,service,refresh,action,login,logout,loadCollections}=state;
  const {bookmarks,remove,error:bookmarkError}=useBookmarks();
  const location=useLocation(),history=useHistory(),accountPath=useBaseUrl('/account/'),query=new URLSearchParams(location.search);
  const requested=query.get('tab'),tab:Tab=requested==='drafts'?'drafts':tabs.some(item=>item[0]===requested)?requested as Tab:'overview';
  const [passwordOpen,setPasswordOpen]=useState(false);
  const open=(next:Tab,view?:string)=>history.push(accountPath+(next==='overview'?'':'?'+new URLSearchParams({tab:next,...(view?{view}:{})})));
  const workbench=(params:Record<string,string>)=>`/workbench/?${new URLSearchParams(params)}`;
  const draftReady=draftState==='ready',submissionReady=submissionState==='ready',canContribute=me&&me.user.role!=='viewer';
  function renderDrafts(compact=false){return !draftReady?<p role="status">{draftState==='loading'?'正在读取草稿…':'草稿暂时无法读取。'}</p>:drafts.length?<div className="cm-work-list">{drafts.slice(0,compact?3:80).map(draft=><article className="cm-work-row" key={draft.draft_id}><FilePenLine size={19} className="cm-muted-icon"/><div className="cm-work-main"><b>{pageTitle(draft.page_id)}</b><p>私有草稿 · 仅自己可见</p></div><div className="cm-work-status">{canContribute&&<Link className="cm-button" to={workbench({tab:'edit',page:draft.page_id,draft:draft.draft_id})}>继续编辑<ArrowRight size={14}/></Link>}{!compact&&<button type="button" className="cm-text-button" disabled={busy} onClick={()=>void action(async()=>{await service.deleteDraft(draft.draft_id);await loadCollections();setNotice('草稿已删除。');})}>删除草稿</button>}</div></article>)}</div>:<div className="cm-empty"><FilePenLine size={27}/><h3>还没有保存的草稿</h3><p>在工作台保存后，可以从这里继续编辑。</p>{canContribute&&<Link className="cm-button" to="/workbench/">找一项可以完善的内容<ArrowRight size={14}/></Link>}</div>;}
  function renderSubmissions(compact=false){return !submissionReady?<p role="status">{submissionState==='loading'?'正在读取投稿…':'投稿暂时无法读取。'}</p>:submissions.length?<div className="cm-work-list">{submissions.slice(0,compact?4:100).map(row=><article className="cm-work-row" key={row.revision_id}><FileClock size={19} className="cm-muted-icon"/><div className="cm-work-main"><Link to={workbench({tab:'mine',submission:row.revision_id})}>{row.edit_summary}</Link><p>{pageTitle(row.page_id)}</p></div><span className="account-status">{statuses[row.status]}</span></article>)}</div>:<div className="cm-empty"><FileClock size={27}/><h3>还没有投稿记录</h3><p>提交审核后，可以在这里跟踪进度。</p><Link className="cm-button" to="/workbench/">查看共建工作台<ArrowRight size={14}/></Link></div>;}
  function renderBookmarks(compact=false){return <>{bookmarkError&&<p role="status">{bookmarkError}</p>}{bookmarks.length?<div className="cm-bookmark-list">{bookmarks.slice(0,compact?4:bookmarks.length).map(item=><div key={item.id}><Bookmark size={16} aria-hidden="true"/><Link to={internalHref(item.href)}>{item.title}</Link><span>{item.kind}</span><button type="button" aria-label={`取消收藏${item.title}`} onClick={()=>remove(item.id)}><X size={15}/></button></div>)}</div>:<div className="cm-empty"><Bookmark size={27}/><h3>把常查的资料留在手边</h3><p>在词条内点击收藏，即可从这里快速打开。收藏保存在这台浏览器中。</p><Link className="cm-button" to="/pets/">浏览宠物图鉴<ArrowRight size={14}/></Link></div>}</>;}
  return <section className="account-center cm-root" aria-label="个人中心">
    <header className="cm-page-heading"><div className="cm-heading-main"><div className="cm-eyebrow">阅读与贡献</div><h1>个人中心</h1><p>从上次停下的地方继续，管理收藏、投稿与个人资料。</p></div>{me&&<Link className="cm-button" to="/workbench/">共建工作台<ArrowRight size={15}/></Link>}</header>
    {notice&&!sessionError&&<p className="notice" role="status">{notice}</p>}
    {booting?<AccountLoading/>:sessionError?<section className="cm-paper"><h2>登录状态需要确认</h2><p>{sessionError}</p><button type="button" className="cm-button" disabled={busy} onClick={()=>void action(recheck)}>重新检查登录状态</button></section>:!me?<div className="account-guest cm-paper"><div><BookOpen size={30}/><h2>让每一次发现都有自己的署名</h2><p>登录后管理个人资料，查看私有草稿与社区记录。</p><Link className="cm-button" to="/pets/">先逛逛资料库<ArrowRight size={14}/></Link></div><AuthenticationPanel service={service} busy={busy} action={action} login={login} notice={setNotice}/></div>:<>
      <AccountIdentityCard me={me} profile={community.data?.profile??me.profile} onProfile={()=>open('profile')} onSecurity={()=>open('security')} onHonors={()=>open('honors','badges')}/>
      <div className="ev7-account-shell"><nav className="ev7-account-nav" aria-label="个人中心分区">{tabs.map(([id,label,Icon])=><button type="button" key={id} className={tab===id||id==='submissions'&&tab==='drafts'?'is-active':''} aria-pressed={tab===id||id==='submissions'&&tab==='drafts'} onClick={()=>open(id)}><Icon size={18}/><span>{label}</span></button>)}</nav><div className="ev7-account-main">
        {['drafts','submissions'].includes(tab)&&<div className="ev7-account-work-tabs"><h2>我的投稿</h2><div className="cm-segmented"><button type="button" className={tab==='drafts'?'is-active':''} aria-pressed={tab==='drafts'} onClick={()=>open('drafts')}>草稿 <span>{draftReady?drafts.length:'—'}</span></button><button type="button" className={tab==='submissions'?'is-active':''} aria-pressed={tab==='submissions'} onClick={()=>open('submissions')}>已提交 <span>{submissionReady?submissions.length:'—'}</span></button></div></div>}
        {tab==='overview'&&<><CommunityOverview state={community} onHonors={view=>open('honors',view)} onActivity={view=>open('activity',view)}/>
          <div className="cm-account-stats">{[[Bookmark,String(bookmarks.length),'阅读收藏','bookmarks'],[FilePenLine,draftReady?String(drafts.length):'—','私有草稿','drafts'],[FileClock,submissionReady?String(submissions.length):'—','我的投稿','submissions']].map(([Icon,count,label,destination])=>{const Mark=Icon as typeof Bookmark;return <button type="button" key={String(label)} onClick={()=>open(destination as Tab)}><Mark size={20}/><span><strong>{String(count)}</strong><small>{String(label)}</small></span><ChevronRight size={17}/></button>;})}</div>
          <div className="cm-account-overview-grid"><section className="cm-paper"><div className="cm-section-heading"><h2><FilePenLine size={19}/>继续编辑</h2><button className="cm-text-button" onClick={()=>open('drafts')}>全部草稿<ArrowRight size={14}/></button></div>{renderDrafts(true)}</section><section className="cm-paper"><div className="cm-section-heading"><h2><Bookmark size={19}/>常用资料</h2><button className="cm-text-button" onClick={()=>open('bookmarks')}>全部收藏<ArrowRight size={14}/></button></div>{renderBookmarks(true)}</section></div>
          <section className="cm-paper cm-account-recent"><div className="cm-section-heading"><h2><FileClock size={19}/>最近投稿</h2><button className="cm-text-button" onClick={()=>open('submissions')}>查看全部<ArrowRight size={14}/></button></div>{renderSubmissions(true)}</section>
        </>}
        {['overview','drafts','submissions'].includes(tab)&&collectionState==='error'&&<div className="cm-paper" role="status"><p>{collectionError}</p><button className="cm-button" disabled={busy} onClick={()=>void action(loadCollections)}>重新加载记录</button></div>}
        {tab==='drafts'&&<section className="cm-paper"><div className="cm-section-heading"><h2><FilePenLine size={19}/>私有草稿</h2>{canContribute&&<Link className="cm-button" to="/workbench/">开始一份修订<ArrowRight size={14}/></Link>}</div>{renderDrafts()}</section>}
        {tab==='submissions'&&<section className="cm-paper"><div className="cm-section-heading"><h2><FileClock size={19}/>最近投稿</h2><small>最近 100 条</small></div>{renderSubmissions()}</section>}
        {tab==='bookmarks'&&<section className="cm-paper"><div className="cm-section-heading"><h2><Bookmark size={19}/>我的收藏</h2><small>保存在这台浏览器中</small></div>{renderBookmarks()}</section>}
        {tab==='honors'&&<CommunityHonors origin={origin} me={me} query={query} state={community} onIdentityError={state.invalidateSession}/>}
        {tab==='activity'&&<CommunityActivity origin={origin} me={me} query={query} state={community} onIdentityError={state.invalidateSession}/>}
        {tab==='profile'&&<section className="cm-paper ev7-account-edit"><h2><UserRound size={19}/>个人资料</h2><p className="cm-section-note">头像、昵称与简介用于公开展示。注册序号和身份标识保持不变。</p><AccountSettings key={me.user.uid} section="profile" me={me} service={service} busy={busy} action={action} refresh={refresh} notice={setNotice}/><div className="rw-profile-serial-v72"><label htmlFor="account-wiki-uid">身份标识 <span>Wiki UID</span></label><input id="account-wiki-uid" value={me.user.uid} readOnly/><p>用于关联投稿、评论与社区记录，修改昵称或头像不会改变它。</p></div></section>}
        {tab==='security'&&<div className="ev7-account-edit"><section className="cm-paper ev7-account-security"><div className="cm-section-heading"><h2><LockKeyhole size={19}/>账号与安全</h2><span className="cm-soft-label">{accountRoles[me.user.role]}</span></div><div className="ev7-security-row"><div><strong>Wiki 账号</strong><p>{me.user.username}</p></div><span className="cm-soft-label">已登录</span></div>{me.account&&<><div className="ev7-security-row"><div><strong>验证邮箱</strong><p>{me.account.email}</p></div><span className="cm-soft-label">{me.account.email_verified?'已验证':'待验证'}</span></div><div className="ev7-security-row"><div><strong>登录密码</strong><p>用当前密码验证后，可设置新密码。</p></div><button type="button" className="cm-button" aria-expanded={passwordOpen} onClick={()=>setPasswordOpen(!passwordOpen)}>{passwordOpen?'收起密码表单':'修改密码'}</button></div>{passwordOpen&&<AccountSettings key={me.user.uid} section="security" showIdentity={false} showReauthentication={false} me={me} service={service} busy={busy} action={action} refresh={refresh} notice={setNotice}/>}</>}<div className="ev7-security-row"><div><strong>登录状态</strong><p>当前会话使用你的 Wiki 账号。</p></div><button type="button" className="cm-button" disabled={busy} onClick={()=>void action(logout)}><LogOut size={15}/>退出登录</button></div></section><GithubBindingPanel key={me.user.uid} origin={origin} me={me} result={query.get('github')} refresh={refresh} onIdentityError={state.invalidateSession}/></div>}
      </div></div>
    </>}
  </section>;
}
