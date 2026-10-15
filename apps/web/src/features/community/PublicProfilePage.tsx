// SPDX-License-Identifier: GPL-3.0-only
import React, {useEffect, useState} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useLocation} from '@docusaurus/router';
import {ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, ExternalLink, FileCheck2, FileText, GitCommitHorizontal, RefreshCw, Search, UserRound, UsersRound} from 'lucide-react';
import {message, RequestError} from '../../components/api';
import {createWorkspaceService} from '../workbench/service';
import type {PublicProfile} from '../workbench/contracts';
import {GithubMark, ProfileAvatar} from '../../wiki/AccountIdentity';
import HonorSymbol from '../../wiki/HonorSymbols';
import {ACHIEVEMENTS, HONOR_ITEMS} from '../../../../../packages/wiki-schema/src/community';
import catalog from '../../generated/catalog.json';
import './PublicProfilePage.css';

const pages = new Map(catalog.pages.map(page => [page.id, page]));
const PAGE_SIZE = 12;
type ProfileResult = {context: string; data?: PublicProfile; error?: string; missing?: boolean};

function ProfileLoading() {
  return <div className="member-loading" role="status" aria-label="正在读取成员主页" aria-busy="true">
    <div className="member-loading-card" aria-hidden="true">
      <span className="member-skeleton member-skeleton-avatar" />
      <div><span className="member-skeleton member-skeleton-name" /><span className="member-skeleton" /><span className="member-skeleton" /></div>
    </div>
    <div className="member-loading-records" aria-hidden="true">{[0, 1, 2].map(row => <span className="member-skeleton" key={row} />)}</div>
    <p>正在读取成员主页…</p>
  </div>;
}

function MemberProfile({profile}: {profile: PublicProfile}) {
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const {user, contributions} = profile;
  const badge = [...HONOR_ITEMS, ...ACHIEVEMENTS].find(item => item.kind !== 'frame' && item.id === profile.profile?.badge);
  const pageCount = new Set(contributions.map(row => row.page_id)).size;
  const limited = contributions.length >= 100;
  const query = search.trim().toLocaleLowerCase();
  const filtered = contributions.filter(row => `${pages.get(row.page_id)?.title ?? row.page_id} ${row.edit_summary}`.toLocaleLowerCase().includes(query));

  return <>
    <header className="member-hero">
      <div className={`member-identity${user.display_name.length > 16 ? ' member-long-name' : ''}`}>
        <ProfileAvatar avatar={profile.profile?.avatar ?? 'dimo'} frame={profile.profile?.frame} size={96} labelled />
        <div className="member-intro">
          <span className="member-eyebrow">在 RocoWiki 相遇</span>
          <h1>{user.display_name || '社区成员'}</h1>
          <div className="member-tags">
            <span><UsersRound size={13} aria-hidden="true" />社区成员</span>
            {user.registration_number !== undefined && <span className="member-registration">注册序号 <b>{user.registration_number}</b></span>}
            {badge && <span className="member-badge"><HonorSymbol item={badge} size={14} />{badge.title}</span>}
          </div>
          <p className={profile.profile?.bio ? '' : 'member-bio-empty'}>{profile.profile?.bio || '这位成员还没有留下个人简介。'}</p>
        </div>
      </div>
      <div className="member-overview">
        <dl className="member-metrics">
          <div><dt><FileCheck2 size={16} aria-hidden="true" />公开修订</dt><dd>{contributions.length}<small>份</small></dd></div>
          <div><dt><BookOpen size={16} aria-hidden="true" />参与词条</dt><dd>{pageCount}<small>个</small></dd></div>
        </dl>
        <p>{limited ? '基于最近 100 条公开修订' : '从本页公开修订中汇总'}</p>
      </div>
    </header>

    <div className="member-content">
      <section className="member-contributions cm-paper" aria-labelledby="member-contributions-title">
        <header className="member-section-heading">
          <span className="member-section-icon"><FileCheck2 size={21} aria-hidden="true" /></span>
          <div><h2 id="member-contributions-title">留下的贡献</h2><p>已采纳并发布的资料修订</p></div>
          <span className="member-count">{contributions.length} 份修订</span>
        </header>
        {contributions.length > 0 ? <>
          <div className="member-record-tools">
            <label className="member-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="搜索公开修订" placeholder="搜索词条或修订内容" value={search} onChange={event => {setSearch(event.target.value); setVisible(PAGE_SIZE);}} /></label>
            <span aria-live="polite">{query ? `找到 ${filtered.length} 条` : '最新修订在前'}</span>
          </div>
          {filtered.length ? <ol className="member-records">
            {filtered.slice(0, visible).map(row => {
              const page = pages.get(row.page_id);
              return <li key={row.revision_id}>
                <span className="member-record-icon"><FileText size={18} aria-hidden="true" /></span>
                <article>
                  <span className="member-record-page">{page?.title ?? '未收录词条'}</span>
                  <h3>{page ? <Link to={`/wiki/${page.slug}/`}>{row.edit_summary || '更新资料'}<ArrowRight size={16} aria-hidden="true" /></Link> : row.edit_summary || '更新资料'}</h3>
                  <div className="member-record-meta"><span className="member-published"><Check size={12} aria-hidden="true" />已发布</span><span title={row.content_commit_sha}><GitCommitHorizontal size={14} aria-hidden="true" /><span className="member-commit-label">内容版本</span><code>{row.content_commit_sha.slice(0, 8)}</code></span></div>
                </article>
              </li>;
            })}
          </ol> : <div className="member-empty"><Search size={28} aria-hidden="true" /><h3>没有找到相关修订</h3><p>试试其他词条名称或关键词。</p><button type="button" className="cm-button" onClick={() => {setSearch(''); setVisible(PAGE_SIZE);}}>清除搜索</button></div>}
          {filtered.length > visible && <div className="member-more"><button type="button" className="cm-button" onClick={() => setVisible(count => count + PAGE_SIZE)}>查看更多修订<ArrowRight size={14} aria-hidden="true" /></button><span>已展示 {visible} / {filtered.length} 条</span></div>}
          {limited && <p className="member-limit">这里展示最近 100 条公开修订，概览按这些记录统计。</p>}
        </> : <div className="member-empty"><span className="member-empty-symbol"><BookOpen size={28} aria-hidden="true" /></span><h3>故事，等待下一笔</h3><p>这位成员暂时没有已发布的贡献。<br />以后采纳并发布的资料修订，会留在这里。</p><Link className="cm-button" to="/pets/">去图鉴逛逛<ArrowRight size={14} aria-hidden="true" /></Link></div>}
      </section>

      <aside className="member-sidebar" aria-label="成员资料">
        <section className="cm-paper member-about">
          <h2><UserRound size={18} aria-hidden="true" />关于这位成员</h2>
          <dl><div><dt>所在社区</dt><dd>RocoWiki · 洛克王国</dd></div><div><dt>Wiki UID</dt><dd><code>{user.uid}</code></dd></div></dl>
          {profile.github && <a className="member-github" href={`https://github.com/${encodeURIComponent(profile.github.login)}`} target="_blank" rel="noreferrer"><GithubMark size={20} /><span><strong>{profile.github.login}</strong><small>GitHub 个人主页</small></span><ExternalLink size={14} aria-hidden="true" /><span className="member-sr-only">（在新标签页打开）</span></a>}
          <p className="member-about-note">每一份贡献，都有自己的署名。</p>
        </section>
        <section className="member-invitation">
          <span className="member-section-icon"><BookOpen size={21} aria-hidden="true" /></span>
          <h2>把发现留给下一位洛克</h2>
          <p>从一处纠错、一条来源开始，<br />一起让王国的资料更完整。</p>
          <Link to="/help/contributing/">了解如何参与共建<ArrowRight size={15} aria-hidden="true" /></Link>
        </section>
      </aside>
    </div>
  </>;
}

export default function PublicProfilePage() {
  const {siteConfig} = useDocusaurusContext();
  const location = useLocation();
  const origin = String(siteConfig.customFields?.apiOrigin || '');
  const uid = new URLSearchParams(location.search).get('uid') || '';
  const [attempt, setAttempt] = useState(0);
  const context = JSON.stringify([origin, uid, attempt]);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const current = result?.context === context ? result : null;

  useEffect(() => {
    if (!uid) return;
    const controller = new AbortController();
    createWorkspaceService(origin, undefined, controller.signal).profile(uid).then(data => {
      if (!controller.signal.aborted) setResult({context, data});
    }).catch(error => {
      if (!controller.signal.aborted) setResult({context, error: message(error), missing: error instanceof RequestError && error.code === 'NOT_FOUND'});
    });
    return () => controller.abort();
  }, [origin, uid, context]);

  return <section className="cm-root member-page" aria-label="公开成员主页">
    <nav className="member-breadcrumb" aria-label="面包屑"><Link to="/">首页</Link><ChevronRight size={13} aria-hidden="true" /><span aria-current="page">社区成员</span><span className="member-public-label"><UserRound size={13} aria-hidden="true" />公开主页</span></nav>
    {!uid || current?.error ? <section className="cm-paper member-unavailable" role="status"><span className="member-empty-symbol"><UserRound size={30} aria-hidden="true" /></span><h1>{!uid ? '每一份发现，背后都有一位洛克' : current?.missing ? '没有找到这位成员' : '成员主页暂时无法读取'}</h1><p>{!uid ? '点击文章修订记录中的成员昵称，就能查看这位成员的主页与公开贡献。' : current?.missing ? '这位成员可能已不可用，请从修订记录重新打开主页。' : current?.error}</p><div>{uid && !current?.missing && <button type="button" className="cm-button" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={15} aria-hidden="true" />重新加载</button>}<Link className="cm-button" to="/"><ArrowLeft size={15} aria-hidden="true" />返回首页</Link></div></section> : current?.data ? <MemberProfile key={context} profile={current.data} /> : <ProfileLoading />}
  </section>;
}
