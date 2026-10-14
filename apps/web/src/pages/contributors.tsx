import React,{useEffect,useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { message } from '../components/api';
import {createWorkspaceService} from '../features/workbench/service';
import type {PublicProfile} from '../features/workbench/contracts';
import {useLocation} from '@docusaurus/router';
import data from '../generated/catalog.json';
import '../css/workbench.css';
export default function Contributors() {
  const {siteConfig}=useDocusaurusContext(),location=useLocation(),[profile,setProfile]=useState<PublicProfile|null>(null),[notice,setNotice]=useState('正在读取公开资料…');
  const origin=String(siteConfig.customFields?.apiOrigin);
  useEffect(()=>{
    const controller=new AbortController(),uid=new URLSearchParams(location.search).get('uid');
    setProfile(null);
    if(!uid){setNotice('通过文章修订记录或账号页打开社区成员主页。');return;}
    setNotice('正在读取公开资料…');
    createWorkspaceService(origin,undefined,controller.signal).profile(uid).then(v=>{setProfile(v);setNotice('');}).catch(e=>{if(!controller.signal.aborted)setNotice(message(e));});
    return()=>controller.abort();
  },[origin,location.search]);
  return <Layout title="社区成员"><main className="workspace"><div className="eyebrow">COMMUNITY MEMBER</div><h1>{profile?.user.display_name||'社区成员'}</h1>{notice&&<p role="status">{notice}</p>}{profile&&<>{profile.user.registration_number!==undefined&&<p>注册序号：<b>{profile.user.registration_number}</b></p>}<p>Wiki UID：<code>{profile.user.uid}</code></p>{profile.github&&<a href={`https://github.com/${profile.github.login}`} target="_blank" rel="noreferrer">GitHub · {profile.github.login} ↗</a>}<h2>已采纳贡献</h2>{profile.contributions.length?profile.contributions.map(c=><div className="list-row" key={c.revision_id}><Link to={`/wiki/${data.pages.find(p=>p.id===c.page_id)?.slug||''}`}>{c.edit_summary}</Link><code>{c.content_commit_sha.slice(0,8)}</code></div>):<p>暂时没有已发布贡献。</p>}</>}</main></Layout>;
}
