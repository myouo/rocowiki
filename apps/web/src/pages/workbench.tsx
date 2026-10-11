import { useWorkbench } from "../features/workbench/useWorkbench";
import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { diffLines } from 'diff';
import data from '../generated/catalog.json';
import '../css/workbench.css';
import BoundedTextarea from '../wiki/BoundedTextarea';
import { statuses, freshSource, type SubmissionRow } from '../features/workbench/contracts';
import { parseSources } from '../features/workbench/service';
export default function Workbench() {
  const {
    me,
    setMe,
    booting,
    busy,
    notice,
    setNotice,
    tab,
    setTab,
    pageId,
    setPageId,
    base,
    setBase,
    body,
    setBody,
    entity,
    setEntity,
    summary,
    setSummary,
    sources,
    setSources,
    optIn,
    setOptIn,
    consent,
    setConsent,
    preview,
    setPreview,
    setDraftId,
    supersedes,
    setSupersedes,
    submissions,
    drafts,
    queue,
    setQueue,
    selected,
    setSelected,
    comment,
    setComment,
    jobs,
    service,
    action,
    refreshMe,
    login,
    listMine,
    openTab,
    loadBase,
    save,
    restore,
    submit,
    show,
    updateSource,
    canReview,
    canContribute
  } = useWorkbench();
  return <Layout title="共建工作台"><main className="workspace">
    <div className="workspace-heading"><div><div className="eyebrow">COMMUNITY WORKSPACE</div><h1>共建工作台</h1><p>保存发现，附上证据，让修订经过审核走向公开。</p></div>{me && <div className="identity-chip">{me.user.display_name}<small>{me.user.role === 'admin' ? '管理员' : canReview ? '审核员' : me.user.role === 'viewer' ? '只读用户' : '贡献者'}</small></div>}</div>
    {notice && <div className="notice" role="status">{notice}</div>}
    {booting ? <p role="status">正在读取登录状态…</p> : !me ? <div className="empty-state"><h2>从你的第一份记录开始</h2><p>使用已验证邮箱的身份服务登录。Wiki 会为你建立独立账号，GitHub 绑定可选。</p><button className="button button--primary" disabled={busy} onClick={() => void action(login)}>注册 / 登录</button><p><Link to="/wiki/guides/contributing">先了解投稿流程 ↗</Link></p></div> : <>
      <div className="workspace-tabs" role="tablist" aria-label="工作台栏目">{[['edit', '编辑投稿'], ['mine', '我的草稿与投稿'], ...(canReview ? [['review', '审核队列']] : []), ...(me.user.role === 'admin' ? [['jobs', '发布任务']] : []), ['account', '账号与归属']].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} disabled={busy} onClick={() => void action(() => openTab(id))}>{label}</button>)}</div>
      {tab === 'edit' && !canContribute && <p role="status">当前账号只有阅读权限，不能编辑或投稿。</p>}
      {tab === 'edit' && canContribute && <section className="editor-panel"><div className="toolbar"><label>编辑对象 <select disabled={busy} value={pageId} onChange={e => {
                setPageId(e.target.value);
                setBase(null);
                setPreview('');
                setDraftId('');
              }}>{data.pages.map(p => <option value={p.id} key={p.id}>{p.title} · {p.kind}</option>)}</select></label><button className="button button--secondary" disabled={busy} onClick={() => void action(() => loadBase())}>加载当前基线</button></div>
        {!base ? <div className="empty-state"><p>选择页面并加载基线，开始编写你的修订。</p></div> : <><div className="baseline">基线 {base.commit_sha.slice(0, 8)} · {base.blob_sha.slice(0, 8)}{supersedes && <> · 新候选承接 {supersedes}</>}</div>
          {supersedes && selected?.revision_id === supersedes && <details className="review-panel"><summary>对照原候选正文（只读，保留修订历史）</summary><pre className="diff-panel">{selected.content}</pre></details>}
          {base.page.kind === 'article' ? <label className="field">Markdown 正文<BoundedTextarea className="markdown-editor" minHeight={300} spellCheck={false} value={body} onChange={e => {
                setBody(e.target.value);
                setPreview('');
              }} /></label> : <div className="entity-form"><p>实体 ID：<code>{pageId}</code> · 数据修订 {base.base_data_revision}</p>{['name', 'description', ...(base.page.kind === 'skill' ? ['type', 'category', 'power', 'pp'] : [])].map(field => <label className="field" key={field}>{({
                  name: '名称',
                  description: '说明',
                  type: '属性',
                  category: '分类（physical / magical / status）',
                  power: '威力（未知可留空）',
                  pp: 'PP'
                } as Record<string, string>)[field]}<input value={String(entity[field] ?? '')} onChange={e => setEntity({
                  ...entity,
                  [field]: ['power', 'pp'].includes(field) ? e.target.value === '' ? null : Number(e.target.value) : e.target.value
                })} /></label>)}{['aliases', ...(base.page.kind === 'pet' ? ['types', 'skills'] : [])].map(field => <label className="field" key={field}>{field === 'aliases' ? '别名' : field === 'types' ? '属性' : '技能 ID'}（以逗号分隔）<input value={Array.isArray(entity[field]) ? (entity[field] as string[]).join(', ') : ''} onChange={e => setEntity({
                  ...entity,
                  [field]: e.target.value.split(/[,，]/).map(v => v.trim()).filter(Boolean)
                })} /></label>)}{base.page.kind === 'pet' && <div className="stats-grid">{Object.entries((entity.stats ?? {}) as Record<string, number>).map(([field, value]) => <label key={field}>{field}<input type="number" min="1" value={value} onChange={e => setEntity({
                    ...entity,
                    stats: {
                      ...(entity.stats as object),
                      [field]: Number(e.target.value)
                    }
                  })} /></label>)}</div>}</div>}
          <div className="toolbar"><button className="button button--secondary" disabled={busy} onClick={() => void action(async () => setPreview((await service.preview(base.page.kind === 'article' ? body : String(entity.description ?? ''))).html))}>安全预览</button><span>支持受限 Markdown，禁止 HTML 与可执行组件。</span></div>{preview && <div className="preview-panel" dangerouslySetInnerHTML={{
              __html: preview
            }} />}
          <label className="field">编辑说明<input maxLength={500} value={summary} onChange={e => setSummary(e.target.value)} placeholder="说明本次修改和依据（至少 5 个字）" /></label>
          <fieldset className="source-fields"><legend>来源与证据</legend>{sources.map((s, i) => <div className="source-row" key={i}><input aria-label={`来源 ${i + 1} 标题`} placeholder="来源标题" value={s.title} onChange={e => updateSource(i, 'title', e.target.value)} /><input aria-label={`来源 ${i + 1} 地址`} placeholder="https://…" value={s.url} onChange={e => updateSource(i, 'url', e.target.value)} /><select aria-label={`来源 ${i + 1} 等级`} value={s.level} onChange={e => updateSource(i, 'level', e.target.value)}><option value="unverified">待验证</option><option value="official">官方资料</option><option value="tested">实测记录</option><option value="inferred">玩家推导</option></select>{sources.length > 1 && <button aria-label={`移除来源 ${i + 1}`} onClick={() => setSources(sources.filter((_, n) => n !== i))}>移除</button>}</div>)}<button className="text-button" disabled={sources.length >= 20} onClick={() => setSources([...sources, freshSource()])}>＋ 添加来源</button></fieldset>
          <label className="checkbox-field"><input type="checkbox" checked={optIn} disabled={!me.github?.enabled} onChange={e => setOptIn(e.target.checked)} />本次修订关联 GitHub Co-author{!me.github?.enabled && <small>可在账号与归属中开启</small>}</label>
          <div className="toolbar"><button className="button button--secondary" disabled={busy} onClick={() => void action(save)}>保存私有草稿</button><button className="button button--primary" disabled={busy} onClick={() => void action(submit)}>提交审核</button><small>提交后锁定快照，后续修改需创建新候选。</small></div>
        </>}
      </section>}
      {tab === 'mine' && <section><h2>私有草稿</h2>{!drafts.length ? <p>还没有保存的草稿。</p> : drafts.map(d => <div className="list-row" key={d.draft_id}><span>{data.pages.find(p => p.id === d.page_id)?.title || d.page_id}</span><button className="text-button" disabled={busy} onClick={() => void action(async () => restore(d))}>继续编辑</button><button className="text-button" disabled={busy} onClick={() => void action(async () => {
              await service.deleteDraft(d.draft_id);
              await listMine();
            })}>删除草稿</button></div>)}<h2>投稿历史</h2><SubmissionList rows={submissions} onOpen={id => void action(() => show(id))} /></section>}
      {tab === 'review' && <section><h2>待审核修订</h2><SubmissionList rows={queue} onOpen={id => void action(() => show(id))} /></section>}
      {selected && ['mine', 'review'].includes(tab) && <section className="review-panel"><h2>{selected.edit_summary}</h2><div className="baseline">{selected.revision_id} · {statuses[selected.status]} · {selected.reviews.filter(r => r.verdict === 'approve').length}/{selected.required_reviews} 份批准</div><h3>基线差异</h3><pre className="diff-panel">{diffLines(selected.base_content, selected.content).map((part, i) => <span key={i} className={part.added ? 'diff-added' : part.removed ? 'diff-removed' : ''}>{part.value}</span>)}</pre><h3>投稿来源</h3><ul>{parseSources(selected.sources_json).map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> · {s.level}</li>)}</ul>{selected.reviews.map((r, i) => <p key={i}><b>{r.verdict}</b> · {r.comment}</p>)}{selected.last_error && <p>任务状态：{selected.last_error}</p>}{selected.pr_number && <p>GitHub PR #{selected.pr_number}</p>}{selected.publication_events?.some(e => e.action === 'withdrawn') && <p role="status">历史上已发布；存在后续撤回或站点回滚记录。</p>}
        {tab === 'review' && selected.status === 'pending_review' && selected.uid !== me.user.uid && <><label className="field">审核意见<BoundedTextarea value={comment} onChange={e => setComment(e.target.value)} maxLength={4000} /></label><div className="toolbar">{[['approve', '批准'], ['changes_requested', '要求补充'], ['reject', '驳回']].map(([verdict, label]) => <button key={verdict} className={`button ${verdict === 'approve' ? 'button--primary' : 'button--secondary'}`} disabled={busy || !comment.trim()} onClick={() => void action(async () => {
                setSelected(await service.decide(selected.revision_id, verdict, comment, selected.version));
                setQueue((await service.reviews()).submissions);
              })}>{label}</button>)}</div></>}
        {selected.uid === me.user.uid && ['pending_review', 'changes_requested', 'rejected', 'conflict', 'cancelled'].includes(selected.status) && <button className="button button--secondary" disabled={busy} onClick={() => void action(async () => {
            await loadBase(selected.page_id);
            setPageId(selected.page_id);
            setSupersedes(selected.revision_id);
            setTab('edit');
            setNotice('已加载新基线。请对照原投稿整理修订，再提交新候选。');
          })}>加载新基线，创建候选</button>}
        {['pending_review', 'changes_requested', 'approved', 'conflict'].includes(selected.status) && !selected.pr_number && (selected.uid === me.user.uid || me.user.role === 'admin') && <button className="text-button" disabled={busy} onClick={() => void action(async () => {
            await service.cancel(selected.revision_id);
            await show(selected.revision_id);
            await listMine();
          })}>撤销此候选</button>}
      </section>}
      {tab === 'jobs' && <section><h2>发布任务</h2>{jobs.length ? jobs.map(j => <div className="job-row" key={j.job_id}><code>{j.revision_id}</code><span>{statuses[j.status]} · {j.stage}</span><span>{j.last_error || '正常'} · 重试 {j.retries} 次</span>{j.status === 'retryable_error' && <button disabled={busy} onClick={() => void action(async () => {
              await service.retry(j.job_id);
              await openTab('jobs');
            })}>重试</button>}</div>) : <p>暂无发布任务。</p>}</section>}
      {tab === 'account' && <section className="account-panel"><h2>账号与贡献归属</h2><p>Wiki UID：<code>{me.user.uid}</code></p><p><Link to={`/contributors?uid=${me.user.uid}`}>查看公开贡献主页 ↗</Link></p><h3>可选 GitHub 绑定</h3>{me.github ? <><p>已绑定 <b>{me.github.login}</b> · Co-author {me.github.enabled ? '已开启' : '未开启'}</p><p>可核验提交邮箱：{me.github.coauthor_email || '暂无'}</p><label className="checkbox-field"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />我同意在未来主动勾选的投稿中公开此邮箱。已进入 Git 历史的邮箱无法保证撤回。</label><div className="toolbar"><button className="button button--secondary" disabled={busy || !me.github.enabled && !consent} onClick={() => void action(async () => {
                await service.consent(!me.github!.enabled, me.consent_version);
                await refreshMe();
              })}>{me.github.enabled ? '关闭未来关联' : '开启 Co-author 关联'}</button><button className="text-button" disabled={busy} onClick={() => void action(async () => {
                await service.unbind();
                await refreshMe();
              })}>解绑 GitHub</button></div></> : <><p>绑定不影响站内投稿。只有再次同意公开邮箱并在投稿中选择关联时，提交才会带 Co-author。</p><button className="button button--secondary" disabled={busy} onClick={() => void action(async () => {
              const r = await service.bind();
              window.location.assign(r.redirect_url);
            })}>绑定 GitHub</button></>}<hr /><div className="toolbar"><button className="text-button" disabled={busy} onClick={() => void action(login)}>重新验证身份</button><button className="button button--secondary" disabled={busy} onClick={() => void action(async () => {
              await service.logout();
              setMe(null);
              setSelected(null);
              setBase(null);
            })}>退出登录</button></div></section>}
    </>}
  </main></Layout>;
}
function SubmissionList({
  rows,
  onOpen
}: {
  rows: SubmissionRow[];
  onOpen: (id: string) => void;
}) {
  return rows.length ? <div className="submission-list">{rows.map(r => <button className="submission-row" key={r.revision_id} onClick={() => onOpen(r.revision_id)}><div><b>{r.edit_summary}</b><small>{r.page_id} · {r.revision_id.slice(0, 12)}</small></div><span className="tag">{statuses[r.status] || r.status}</span></button>)}</div> : <div className="empty-state"><p>暂无投稿。</p></div>;
}
