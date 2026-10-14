// SPDX-License-Identifier: GPL-3.0-only
import React, {useEffect, useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useHistory, useLocation} from '@docusaurus/router';
import {ArrowRight, Bookmark, BookOpen, FilePenLine, House, Link2, LockKeyhole, LogOut, PencilLine, UserRound, X} from 'lucide-react';
import {AuthenticationPanel} from '../workbench/AuthenticationPanel';
import {AccountSettings} from '../workbench/AccountSettings';
import {statuses} from '../workbench/contracts';
import {useBookmarks} from '../../wiki/community/useBookmarks';
import catalog from '../../generated/catalog.json';
import {useAccountCenter} from './useAccountCenter';
import '../../css/workbench.css';
import './AccountCenter.css';

const tabs = [
  ['overview', '我的首页', House], ['submissions', '草稿与投稿', FilePenLine],
  ['bookmarks', '我的收藏', Bookmark], ['profile', '个人资料', UserRound], ['security', '账号与安全', LockKeyhole],
] as const;
type Tab = typeof tabs[number][0];
const roles = {viewer: '只读用户', contributor: '贡献者', reviewer: '审核员', admin: '管理员'};
function pageTitle(id: string) { return catalog.pages.find(page => page.id === id)?.title ?? id; }
function internalHref(href: string) { return href.startsWith('/') && !href.startsWith('//') && !/[\\\u0000-\u001f]/.test(href) ? href : '/'; }

export default function AccountCenter() {
  const {siteConfig} = useDocusaurusContext();
  const origin = typeof siteConfig.customFields?.apiOrigin === 'string' ? siteConfig.customFields.apiOrigin : '';
  const state = useAccountCenter(origin);
  const {me, booting, busy, notice, setNotice, drafts, submissions, collectionState, collectionError, service, refresh, action, login, logout, loadCollections} = state;
  const {bookmarks, remove, error: bookmarkError} = useBookmarks();
  const location = useLocation(), history = useHistory(), accountPath = useBaseUrl('/account/');
  const requested = new URLSearchParams(location.search).get('tab');
  const tab: Tab = requested === 'drafts' ? 'submissions' : tabs.some(item => item[0] === requested) ? requested as Tab : 'overview';
  const [consent, setConsent] = useState(false);
  useEffect(() => { setConsent(false); }, [me?.user.uid, me?.github?.login]);
  const open = (next: Tab) => history.push(accountPath + (next === 'overview' ? '' : `?tab=${next}`));
  const workbench = (params: Record<string, string>) => `/workbench/?${new URLSearchParams(params)}`;
  const ready = collectionState === 'ready';
  const canContribute = me && me.user.role !== 'viewer';
  const published = submissions.filter(row => row.status === 'published');

  const savedItems = <section className="cm-paper account-shelf">
    <div className="cm-section-heading"><h2><Bookmark size={19} />我的收藏</h2><small>保存在这台浏览器中</small></div>
    {bookmarkError && <p role="status">{bookmarkError}</p>}
    {bookmarks.length ? <div className="cm-bookmark-list">{bookmarks.map(item => <div key={item.id}>
      <Bookmark size={16} aria-hidden="true" /><Link to={internalHref(item.href)}>{item.title}</Link><span>{item.kind}</span>
      <button type="button" aria-label={`取消收藏${item.title}`} onClick={() => remove(item.id)}><X size={15} /></button>
    </div>)}</div> : <div className="cm-empty"><Bookmark size={27} /><h3>把常查的资料留在手边</h3><p>在词条内点击收藏，就可以从这里快速打开。</p><Link className="cm-button" to="/pets/">浏览宠物图鉴<ArrowRight size={14} /></Link></div>}
  </section>;

  return <section className="account-center cm-root workspace" aria-label="个人中心">
    <header className="cm-page-heading"><div className="cm-heading-main"><div className="cm-eyebrow">我的 RocoWiki</div><h1>个人中心</h1><p>从上次停下的地方继续，管理收藏、投稿与个人资料。</p></div>
      {me && <Link className="cm-button" to="/workbench/">共建工作台<ArrowRight size={15} /></Link>}
    </header>
    {notice && <p className="notice" role="status">{notice}</p>}
    {booting ? <div className="cm-paper" role="status">正在读取登录状态…</div> : !me ? <div className="account-guest cm-paper">
      <div><div className="account-welcome-icon"><BookOpen size={30} /></div><h2>让每一次发现都有自己的署名</h2><p>登录后管理你的资料与账号安全，查看私有草稿和投稿进度。</p><Link className="cm-button" to="/pets/">先逛逛资料库<ArrowRight size={14} /></Link></div>
      <AuthenticationPanel service={service} busy={busy} action={action} login={login} notice={setNotice} />
    </div> : <>
      <section className="account-identity" aria-label="我的身份"><div className="account-avatar"><UserRound size={34} /></div><div className="account-identity-main">
        <span className="account-eyebrow">我的 RocoWiki</span><h2>{me.user.display_name}</h2><div className="account-tags"><span>{roles[me.user.role]}</span>{me.account && <span>{me.account.email_verified ? '邮箱已验证' : '邮箱待验证'}</span>}</div>
        <p>用户名：{me.user.username}<span className="account-uid">Wiki UID：<code>{me.user.uid}</code></span></p>
      </div><button type="button" className="cm-button" onClick={() => open('profile')}><PencilLine size={15} />编辑个人资料</button></section>
      <div className="ev7-account-shell"><nav className="ev7-account-nav" aria-label="个人中心分区">{tabs.map(([id, label, Icon]) => <button type="button" key={id} className={tab === id ? 'is-active' : ''} aria-pressed={tab === id} onClick={() => open(id)}><Icon size={18} /><span>{label}</span></button>)}</nav>
        <div className="ev7-account-main">
          {tab === 'overview' && <>
            <div className="cm-account-stats account-stats">{[
              [FilePenLine, ready ? String(drafts.length) : '—', '私有草稿', 'submissions'],
              [BookOpen, ready ? String(submissions.length) : '—', '最近投稿', 'submissions'],
              [Bookmark, String(bookmarks.length), '阅读收藏', 'bookmarks'],
            ].map(([Icon, count, label, destination]) => { const Mark = Icon as typeof Bookmark; return <button type="button" key={String(label)} onClick={() => open(destination as Tab)}><Mark size={20} /><strong>{String(count)}</strong><span>{String(label)}</span></button>; })}</div>
            <section className="cm-paper account-overview"><h2>从这里继续</h2><p>草稿只对你可见，投稿进度随审核与发布状态更新。</p><div className="account-shortcuts"><button type="button" onClick={() => open('submissions')}><FilePenLine size={20} /><span><b>草稿与投稿</b><small>{ready ? `${drafts.length} 份草稿 · ${published.length} 条最近投稿已发布` : '正在读取你的记录'}</small></span><ArrowRight size={16} /></button><button type="button" onClick={() => open('security')}><LockKeyhole size={20} /><span><b>账号与安全</b><small>密码、GitHub 关联与退出登录</small></span><ArrowRight size={16} /></button></div></section>
            {savedItems}
          </>}
          {(tab === 'overview' || tab === 'submissions') && collectionState === 'error' && <div className="cm-paper" role="status"><p>{collectionError}</p><button type="button" className="cm-button" disabled={busy} onClick={() => void action(loadCollections)}>重新加载记录</button></div>}
          {tab === 'submissions' && <>
            <section className="cm-paper"><div className="cm-section-heading"><h2><FilePenLine size={19} />私有草稿</h2>{canContribute && <Link className="cm-button" to="/workbench/">开始一份修订<ArrowRight size={14} /></Link>}</div>
              {!ready ? <p role="status">{collectionState === 'loading' ? '正在读取草稿…' : '草稿暂时无法读取。'}</p> : drafts.length ? <div className="account-records">{drafts.map(draft => <article key={draft.draft_id}><div><b>{pageTitle(draft.page_id)}</b><small>仅自己可见</small></div><div className="account-record-actions">{canContribute && <Link className="cm-button" to={workbench({tab: 'edit', page: draft.page_id, draft: draft.draft_id})}>继续编辑<ArrowRight size={14} /></Link>}<button type="button" className="cm-text-button" disabled={busy} onClick={() => void action(async () => { await service.deleteDraft(draft.draft_id); await loadCollections(); setNotice('草稿已删除。'); })}>删除草稿</button></div></article>)}</div> : <div className="cm-empty"><FilePenLine size={27} /><h3>还没有保存的草稿</h3><p>在工作台保存后，就能从这里继续编辑。</p></div>}
            </section>
            <section className="cm-paper"><div className="cm-section-heading"><h2><BookOpen size={19} />最近投稿</h2><small>最近 100 条</small></div>
              {!ready ? <p role="status">{collectionState === 'loading' ? '正在读取投稿…' : '投稿暂时无法读取。'}</p> : submissions.length ? <div className="account-records">{submissions.map(row => <article key={row.revision_id}><div><Link to={workbench({tab: 'mine', submission: row.revision_id})}>{row.edit_summary}</Link><small>{pageTitle(row.page_id)}</small></div><span className="account-status">{statuses[row.status]}</span></article>)}</div> : <div className="cm-empty"><BookOpen size={27} /><h3>还没有投稿记录</h3><p>提交审核后，可在这里查看处理进度。</p></div>}
            </section>
          </>}
          {tab === 'bookmarks' && savedItems}
          {tab === 'profile' && <section className="cm-paper"><h2>个人资料</h2><p className="account-muted">昵称用于公开展示，用户名和 Wiki UID 保持不变。邮箱仅自己可见。</p><AccountSettings key={me.user.uid} section="profile" me={me} service={service} busy={busy} action={action} refresh={refresh} notice={setNotice} /></section>}
          {tab === 'security' && <>
            <section className="cm-paper"><h2>账号与安全</h2><AccountSettings key={me.user.uid} section="security" me={me} service={service} busy={busy} action={action} refresh={refresh} notice={setNotice} /></section>
            <section className="cm-paper"><h2><Link2 size={19} />GitHub 关联</h2>{me.github ? <>
              <p>已绑定 <b>{me.github.login}</b> · Co-author {me.github.enabled ? '已开启' : '未开启'}</p><p>可核验提交邮箱：{me.github.coauthor_email || '暂无'}</p>
              <label className="checkbox-field"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />我同意在主动选择关联的投稿中公开此邮箱。已进入 Git 历史的邮箱无法保证撤回。</label>
              <div className="toolbar"><button type="button" className="cm-button" disabled={busy || !me.github.enabled && !consent} onClick={() => void action(async () => { await service.consent(!me.github!.enabled, me.consent_version); await refresh(); setConsent(false); })}>{me.github.enabled ? '关闭未来关联' : '开启 Co-author 关联'}</button><button type="button" className="cm-text-button" disabled={busy} onClick={() => void action(async () => { await service.unbind(); await refresh(); setConsent(false); })}>解绑 GitHub</button></div>
            </> : <><p>GitHub 关联可选，不影响邮箱登录。开启关联后，投稿仍需再次选择是否添加公开署名。</p><button type="button" className="cm-button" disabled={busy} onClick={() => void action(async () => { const result = await service.bind(); window.location.assign(result.redirect_url); })}>绑定 GitHub</button></>}</section>
            <section className="cm-paper"><h2>登录状态</h2><p>退出后，需要重新输入邮箱或用户名与密码登录。</p><button type="button" className="cm-button" disabled={busy} onClick={() => void action(logout)}><LogOut size={15} />退出登录</button></section>
          </>}
        </div>
      </div>
    </>}
  </section>;
}
