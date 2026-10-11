import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  CircleAlert,
  FileClock,
  FilePenLine,
  Eye,
  GitCompareArrows,
  Info,
  Link2,
  PencilLine,
  Save,
  Send,
} from "lucide-react";
import TypedFields from "./TypedFields";
import { ReadPreviewFrame } from "./PreviewContent";
import BoundedTextarea from "../BoundedTextarea";
import { blankSkillBranch } from "../skillConditions";
import {
  EDITOR_MODES,
  blankOccurrence,
  cloneData,
  fieldLabel,
  serializeData,
  setAtPath,
  safeInternalPath,
  threeWayMerge,
  validateSectionForm,
} from "./model";
import { COMMUNITY_STORAGE_KEY, editorHref, getPublishedSnapshot, requestFromQuery } from "./registry";
import { draftPersisted } from "./draftPersistence";

function formFor(snapshot, request) {
  const typedData = cloneData(snapshot.data);
  if (
    snapshot.mode === "event" &&
    (request.intent === "add" || !typedData.occurrences?.length)
  )
    typedData.occurrences = [
      ...(typedData.occurrences || []),
      blankOccurrence(),
    ];
  if (snapshot.mode === "skill" && request.record !== "learners" && request.intent === "add" && snapshot.exists)
    typedData.phases = [
      ...(typedData.phases || []),
      blankSkillBranch(),
    ];
  if (snapshot.mode === "index" && request.intent === "add")
    typedData.entries = [
      ...(typedData.entries || []),
      { title: "", href: "/", description: "" },
    ];
  return {
    editorVersion: 7,
    editorMode: snapshot.mode,
    editorRequest: {
      ...request,
      mode: snapshot.mode,
      returnTo: snapshot.returnTo,
    },
    snapshotKey: snapshot.key,
    target: request.entity,
    section: request.section,
    type: snapshot.mode === "article" ? "markdown" : "structured",
    typedData,
    baseData: cloneData(snapshot.data),
    baseContent: snapshot.content,
    baseVersion: snapshot.revision,
    fields: { trigger: "", effect: "", limits: "" },
    markdown: snapshot.mode === "article" ? snapshot.data.markdown : "",
    summary: "",
    evidenceUrl: "",
    evidenceNote: "",
    revisesSubmissionId: request.submission || "",
  };
}

function safeIds(data, mode, submissionId) {
  const next = cloneData(data);
  if (mode === "pet" && !next.slug) next.slug = `local-${String(submissionId).replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
  if (mode === "pve-guide" && !next.id) next.id = `local-pve-${String(submissionId).replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
  if (mode === "pve-guide" && Array.isArray(next.sections)) next.sections = next.sections.map((row,index) => ({ ...row, id: row.id || `${next.id}-section-${index + 1}` }));
  for (const name of ["records", "occurrences", "phases", "entries"])
    if (Array.isArray(next[name]))
      next[name] = next[name].map((row, index) => ({
        ...row,
        id: row.id || `record-${Date.now().toString(36)}-${index + 1}`,
      }));
  return next;
}

export default function SectionEditor({
  workspace,
  update,
  ready,
  query,
  storageError,
  DiffViewer,
  MarkdownPreview,
  StatusBadge,
}) {
  const history = useHistory();
  const incoming = requestFromQuery(query);
  const reviewSource = workspace.submissions.find(
    (row) => row.id === incoming.submission,
  );
  const request = reviewSource?.editorRequest
    ? { ...reviewSource.editorRequest, submission: incoming.submission }
    : incoming;
  const requestKey = JSON.stringify(request);
  const snapshot = useMemo(
    () => getPublishedSnapshot(request, workspace),
    [requestKey, workspace.submissions],
  );
  const draftKey = `${snapshot.key}::${request.record || "all"}::${request.intent || "edit"}::${request.submission || "draft"}`;
  const [form, setForm] = useState(() => formFor(snapshot, request));
  const [view, setView] = useState("edit");
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [notice, setNotice] = useState("");
  const [restored, setRestored] = useState(false);
  const [submittedId, setSubmittedId] = useState("");
  const [conflictReview, setConflictReview] = useState(null);
  const [choices, setChoices] = useState({});
  const restoredKey = useRef("");
  const pending = useRef(null);
  const immutable =
    reviewSource &&
    ["merged", "building", "build_failed", "built", "published"].includes(
      reviewSource.status,
    );
  const stale = form.baseVersion !== snapshot.revision && !immutable;

  useEffect(() => {
    if (!ready || restoredKey.current === draftKey) return;
    restoredKey.current = draftKey;
    const saved = workspace.drafts.find(
      (row) => row.key === draftKey && row.editorVersion === 7,
    );
    if (saved) {
      setForm(saved);
      setSavedAt(saved.updatedAt || "");
      setRestored(true);
    } else if (reviewSource?.editorVersion === 7) {
      const base = immutable ? formFor(snapshot, request) : reviewSource;
      setForm({
        ...base,
        typedData: cloneData(reviewSource.typedData),
        revisesSubmissionId: request.submission,
      });
      setSavedAt("");
      setRestored(false);
    } else {
      setForm(formFor(snapshot, request));
      setSavedAt("");
      setRestored(false);
    }
    setDirty(false);
    setErrors({});
    setView("edit");
    setSubmittedId("");
    setNotice("");
    setConflictReview(null);
    setChoices({});
  }, [ready, draftKey]);

  const save = useCallback(
    (value = form, showNotice = false) => {
      const now = new Date().toISOString();
      update((old) => ({
        ...old,
        drafts: [
          { ...value, key: draftKey, updatedAt: now },
          ...old.drafts.filter((row) => row.key !== draftKey),
        ],
      }));
      const persisted = draftPersisted(draftKey, value, COMMUNITY_STORAGE_KEY);
      setDirty(!persisted);
      setSavedAt(persisted ? now : "");
      if (!persisted) setNotice("草稿尚未成功保存，当前内容仍保留在编辑页。请重试保存或复制内容。");
      if (showNotice) {
        let persisted = false;
        try { const stored = JSON.parse(window.localStorage.getItem(COMMUNITY_STORAGE_KEY) || "null"); const draft = stored?.drafts?.find((row) => row.key === draftKey); persisted = Boolean(draft && JSON.stringify(draft.typedData) === JSON.stringify(value.typedData) && draft.summary === value.summary && draft.evidenceUrl === value.evidenceUrl && draft.evidenceNote === value.evidenceNote); } catch {}
        setNotice(persisted ? "草稿已保存到本机，可以从「个人中心 → 我的投稿 → 草稿」继续。" : "草稿尚未成功保存，当前内容留在编辑页。请重试保存或先复制内容。");
      }
    },
    [draftKey, form, update],
  );
  function returnToReader(event) {
    event?.preventDefault();
    const target = safeInternalPath(snapshot.returnTo, "/");
    if (dirty || restored || savedAt) {
      save(form);
      try {
        const stored = JSON.parse(window.localStorage.getItem(COMMUNITY_STORAGE_KEY) || "null");
        const draft = stored?.drafts?.find((row) => row.key === draftKey);
        if (!draft || JSON.stringify(draft.typedData) !== JSON.stringify(form.typedData) || draft.summary !== form.summary || draft.evidenceUrl !== form.evidenceUrl || draft.evidenceNote !== form.evidenceNote) throw new Error("Draft not persisted");
      } catch {
        setNotice("草稿尚未成功保存，已留在编辑页。请重试“保存草稿”或复制内容后再返回。");
        return;
      }
    }
    pending.current = null;
    history.push(target);
  }
  useEffect(() => {
    if (!dirty || !ready || submittedId) return;
    const timer = window.setTimeout(() => save(form), 650);
    return () => window.clearTimeout(timer);
  }, [dirty, ready, submittedId, form, save]);
  useEffect(() => {
    pending.current = { form, dirty, submittedId, key: draftKey };
  }, [form, dirty, submittedId, draftKey]);
  useEffect(() => {
    function flush() {
      const value = pending.current;
      if (!value?.dirty || value.submittedId) return;
      update((old) => ({
        ...old,
        drafts: [
          {
            ...value.form,
            key: value.key,
            updatedAt: new Date().toISOString(),
          },
          ...old.drafts.filter((row) => row.key !== value.key),
        ],
      }));
      if (draftPersisted(value.key, value.form, COMMUNITY_STORAGE_KEY)) value.dirty = false;
    }
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [update]);

  function change(key, value) {
    setForm((old) => ({
      ...old,
      [key]: value,
      ...(key === "typedData" && old.editorMode === "article"
        ? { markdown: value.markdown }
        : {}),
    }));
    setDirty(true);
    setErrors({});
    setNotice("");
  }
  const after = serializeData(form.editorMode, form.typedData);
  const unchanged = after === form.baseContent;
  function prepareRebase() {
    const merged = threeWayMerge(form.baseData, snapshot.data, form.typedData);
    setConflictReview(merged);
    setChoices({});
  }
  function acceptRebase() {
    if (!conflictReview) return;
    if (conflictReview.conflicts.some((_, index) => !choices[index])) {
      setNotice("请先逐项选择冲突字段的处理方式。你的草稿已保留。");
      return;
    }
    let data = conflictReview.data;
    conflictReview.conflicts.forEach((conflict, index) => {
      data = setAtPath(
        data,
        conflict.path,
        choices[index] === "current" ? conflict.current : conflict.mine,
      );
    });
    setForm((old) => ({
      ...old,
      baseData: cloneData(snapshot.data),
      baseContent: snapshot.content,
      baseVersion: snapshot.revision,
      typedData: data,
      markdown: old.editorMode === "article" ? data.markdown : old.markdown,
    }));
    setDirty(true);
    setConflictReview(null);
    setChoices({});
    setNotice("已在新版基础上保留选定的修改，请再次核对差异。");
    setView("diff");
  }
  function submit(event) {
    event.preventDefault();
    const nextErrors = validateSectionForm(form, { submissions: workspace.submissions });
    if (stale) nextErrors.version = "本节已出现新版，请先核对版本差异。";
    if (unchanged && request.intent !== "add")
      nextErrors.unchanged = "正文或字段尚未改变，请修改后再投稿。";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setView("edit");
      setNotice(
        nextErrors.scope || nextErrors.version ||
          nextErrors.unchanged ||
          "请补齐标红的字段，再提交审核。",
      );
      return;
    }
    const now = new Date().toISOString();
    const revising = reviewSource && !immutable;
    const id = revising ? reviewSource.id : `local-${Date.now().toString(36)}`;
    const typedData = safeIds(form.typedData, form.editorMode, id);
    const record = {
      ...form,
      typedData,
      ...(form.editorMode === "pet" && request.intent === "add" ? { target: typedData.name, snapshotKey: `pet::${typedData.slug}`, editorRequest: { ...form.editorRequest, entity: typedData.name, record: typedData.slug } } : {}),
      ...(form.editorMode === "pve-guide" ? { target: typedData.name, snapshotKey: `pve-guide::${typedData.id}`, editorRequest: { ...form.editorRequest, entity: typedData.name, record: typedData.id, returnTo: request.intent === "add" ? `/pve/?entry=${encodeURIComponent(typedData.id)}` : safeInternalPath(form.editorRequest.returnTo, `/pve/?entry=${encodeURIComponent(typedData.id)}`) } } : {}),
      id,
      isExample: false,
      before: form.baseContent,
      after: serializeData(form.editorMode, typedData),
      status: "pending",
      author: workspace.profile.nickname || "本地访客",
      authorId: (revising && reviewSource.authorId) || workspace.profile.uuid || "",
      authorAvatar: (revising && reviewSource.authorAvatar) || workspace.profile.avatar || "",
      submittedAt: revising ? reviewSource.submittedAt : now,
      updatedAt: now,
      revisionCount: (revising ? reviewSource.revisionCount || 0 : 0) + 1,
      reviewNote: "",
      events: [
        ...(revising ? reviewSource.events : []),
        {
          label: revising ? "修订后重新提交审核" : "提交章节修订",
          at: now,
          note: `${form.summary} · 基线 ${form.baseVersion}`,
        },
      ],
    };
    pending.current = null;
    update((old) => ({
      ...old,
      drafts: old.drafts.filter((row) => row.key !== draftKey),
      submissions: [record, ...old.submissions.filter((row) => row.id !== id)],
    }));
    setForm((old) => ({ ...old, typedData }));
    setDirty(false);
    setSubmittedId(id);
    setNotice("");
  }
  const mode = form.editorMode === "skill" && request.record === "learners" ? { label: "技能学习关系", hint: "从已收录宠物中选择多只，补充学习方式、等级和来源。原有技能池关联继续保留。" } : EDITOR_MODES[form.editorMode] || EDITOR_MODES.article;

  if (snapshot.directoryManaged) return <section className="cm-paper ev71-directory-scope"><BookOpen size={28} /><h1>请编辑具体条目</h1><p>这个资料目录由已收录条目自动组成。新增、修订或提出删除建议，均只针对选中的条目。</p><div className="ev7-actions"><Link className="cm-button cm-button-primary" to={snapshot.returnTo}>返回目录选择条目</Link>{snapshot.returnTo.split(/[?#]/)[0] === "/pets/" && <Link className="cm-button" to={editorHref({ entity: "新增宠物", section: "宠物资料", mode: "pet", intent: "add", returnTo: "/pets/" })}>新增宠物</Link>}</div></section>;

  if (submittedId)
    return (
      <div className="ev7-root">
        <section className="cm-paper ev7-success">
          <CheckCheck size={34} />
          <p className="ev7-kicker">修订已进入本地审核</p>
          <h1>
            {request.intent === "delete" ? "删除提议已经提交" : request.intent === "add"
              ? "新记录已经写好"
              : "这一节的修改已经提交"}
          </h1>
          <p>
            {request.entity} · {request.section}
          </p>
          <p className="ev7-muted">
            投稿仍保存在当前浏览器，可体验审核、修订、普通合并和发布流程。
          </p>
          <div className="ev7-actions">
            <Link
              className="cm-button cm-button-primary"
              to={`/review/?submission=${encodeURIComponent(submittedId)}`}
            >
              查看审核与差异
              <ArrowRight size={15} />
            </Link>
            <Link className="cm-button" to="/account/?tab=submissions">
              我的投稿
            </Link>
            <Link className="cm-button" to={snapshot.returnTo}>
              返回原章节
            </Link>
          </div>
        </section>
        <ReadPreviewFrame mode={form.editorMode} data={form.typedData} context={request} intent={request.intent} />
        <details className="ev71-submitted-diff"><summary>查看本次修改差异</summary><DiffViewer before={form.baseContent} after={after} /></details>
      </div>
    );

  return (
    <div className="ev7-root">
      <div className="ev7-heading">
        <div>
          <Link className="ev7-back" to={snapshot.returnTo} onClick={returnToReader}>
            <ArrowLeft size={14} />
            返回原章节
          </Link>
          <p className="ev7-kicker">
            {request.intent === "delete" ? "提出单个条目的删除建议" : request.intent === "add" ? "补充新记录" : "编辑当前发布版本"}
          </p>
          <h1>
            {request.entity}
            <span> / {request.section}</span>
          </h1>
          <p>{mode.hint}</p>
        </div>
        <span className="ev7-mode-pill">
          <FilePenLine size={15} />
          {mode.label}
        </span>
      </div>
      <section className="ev7-baseline" aria-label="编辑基线">
        <span className="ev7-baseline-icon">
          <BookOpen size={20} />
        </span>
        <div>
          <strong>
            {snapshot.scope === "local"
              ? "已载入本机已发布版本"
              : snapshot.exists
                ? "已载入随站发布的当前内容"
                : "这是一条待补充的新记录"}
          </strong>
          <p>
            {snapshot.scope === "local"
              ? "继续修订本浏览器完成发布流程后的内容。"
              : snapshot.exists
                ? "表单中的原文与字段来自当前页面的数据快照。"
                : "请填写有来源的资料；保存草稿不会直接创建线上条目。"}
            <code>{form.baseVersion}</code>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView("diff")}
          className="cm-text-button"
        >
          查看原文与差异
          <GitCompareArrows size={15} />
        </button>
      </section>
      {restored && (
        <div className="ev7-restored" role="status">
          <FileClock size={16} />
          <span>已恢复这个章节的本地草稿。</span>
          <button type="button" onClick={() => setRestored(false)}>
            知道了
          </button>
        </div>
      )}
      {reviewSource?.reviewNote &&
        ["changes_requested", "conflict"].includes(reviewSource.status) && (
          <div className="ev7-review-note">
            <CircleAlert size={18} />
            <div>
              <strong>
                {reviewSource.status === "conflict"
                  ? "版本冲突，需要核对"
                  : "审核建议修改"}
              </strong>
              <p>{reviewSource.reviewNote}</p>
            </div>
            <Link to={`/review/?submission=${reviewSource.id}`}>查看审核</Link>
          </div>
        )}
      {stale && (
        <div className="ev7-version-conflict" role="alert">
          <div>
            <CircleAlert size={20} />
            <strong>开始编辑后，这一节出现了新版本</strong>
          </div>
          <p>
            你的草稿基于 {form.baseVersion}，当前版本为 {snapshot.revision}
            。先核对变化，再提交，避免覆盖其他修订。
          </p>
          <button type="button" className="cm-button" onClick={prepareRebase}>
            对照新版与我的修改
          </button>
        </div>
      )}
      {conflictReview && (
        <section className="cm-paper ev7-conflict-review">
          <h2>处理版本变化</h2>
          <p>不同字段的修改可以合并。同一字段两边都修改过时，需要你选择。</p>
          {!conflictReview.conflicts.length && (
            <p className="ev7-ok">
              <Check size={16} />
              没有重叠字段，将保留双方的修改。
            </p>
          )}
          {conflictReview.conflicts.map((conflict, index) => (
            <fieldset key={index}>
              <legend>
                {conflict.path.map(fieldLabel).join(" / ") || "章节内容"}
              </legend>
              <div className="ev7-conflict-options">
                {["current", "mine"].map((choice) => (
                  <label key={choice}>
                    <input
                      type="radio"
                      name={`conflict-${index}`}
                      checked={choices[index] === choice}
                      onChange={() =>
                        setChoices((old) => ({ ...old, [index]: choice }))
                      }
                    />
                    <strong>
                      {choice === "current" ? "采用当前版本" : "保留我的修改"}
                    </strong>
                    <pre>
                      {typeof conflict[choice] === "string"
                        ? conflict[choice]
                        : JSON.stringify(conflict[choice], null, 2)}
                    </pre>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="ev7-actions">
            <button
              type="button"
              className="cm-button cm-button-primary"
              onClick={acceptRebase}
            >
              采用以上处理并核对差异
            </button>
            <button
              type="button"
              className="cm-button"
              onClick={() => setConflictReview(null)}
            >
              保留草稿，稍后处理
            </button>
          </div>
        </section>
      )}
      <form onSubmit={submit} noValidate>
        <div className="ev7-toolbar">
          <div className="cm-segmented">
            <button
              type="button"
              className={view === "edit" ? "is-active" : ""}
              aria-pressed={view === "edit"}
              onClick={() => setView("edit")}
            >
              <PencilLine size={15} />
              填写与修改
            </button>
            <button
              type="button"
              className={view === "preview" ? "is-active" : ""}
              aria-pressed={view === "preview"}
              onClick={() => setView("preview")}
            >
              <Eye size={15} />
              预览效果
            </button>
            <button type="button" className={view === "diff" ? "is-active" : ""} aria-pressed={view === "diff"} onClick={() => setView("diff")}>
              <GitCompareArrows size={15} />
              对照差异
            </button>
          </div>
          <span role="status" aria-live="polite">
            {dirty
              ? "正在编辑…"
              : savedAt
                ? `${storageError ? "暂存于会话" : "已保存到本机"}`
                : "修改后自动保存草稿"}
          </span>
        </div>
        {notice && (
          <p
            role="status"
            className={`ev7-form-notice ${Object.keys(errors).length ? "ev7-error" : ""}`}
          >
            <Info size={15} />
            {notice}
          </p>
        )}
        {view === "edit" ? (
          <div className="ev7-editor-layout">
            <section className="cm-paper ev7-fields">
              <TypedFields
                mode={form.editorMode}
                data={form.typedData}
                onChange={(value) => change("typedData", value)}
                errors={errors}
                intent={request.intent}
                entity={request.entity}
                submissions={workspace.submissions}
                context={request}
                record={
                  request.intent === "add" &&
                  form.editorMode === "skill" &&
                  request.record !== "learners" &&
                  snapshot.exists
                    ? `branch-${form.typedData.phases.length}`
                    : request.record
                }
              />
            </section>
            <aside className="ev7-submit-context">
              <section className="cm-paper">
                <h2>
                  <Link2 size={17} />
                  说明这次修改
                </h2>
                <label className="cm-field">
                  <span>
                    修改摘要 <em>必填</em>
                  </span>
                  <BoundedTextarea
                    aria-label="修改摘要"
                    value={form.summary}
                    onChange={(event) => change("summary", event.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="例如：补充这次返场的地点与进化奖励。"
                  />
                  {errors.summary && (
                    <small className="ev7-error">{errors.summary}</small>
                  )}
                </label>
                <label className="cm-field">
                  <span>补充来源链接</span>
                  <input
                    type="url"
                    aria-label="补充来源链接"
                    value={form.evidenceUrl}
                    onChange={(event) =>
                      change("evidenceUrl", event.target.value)
                    }
                    placeholder="https://…"
                  />
                  {errors.evidenceUrl && (
                    <small className="ev7-error">{errors.evidenceUrl}</small>
                  )}
                </label>
                <label className="cm-field">
                  <span>
                    证据定位／核验方法 <em>必填</em>
                  </span>
                  <BoundedTextarea
                    aria-label="证据定位与核验方法"
                    value={form.evidenceNote}
                    onChange={(event) =>
                      change("evidenceNote", event.target.value)
                    }
                    rows={5}
                    maxLength={3000}
                    placeholder="来源中哪一段支持这次修改？视频在哪个时间、哪一回合？"
                  />
                  {errors.evidenceNote && (
                    <small className="ev7-error">{errors.evidenceNote}</small>
                  )}
                </label>
              </section>
              <section className="ev7-writing-help">
                <h3>第一次编辑？</h3>
                <ol>
                  <li>从现有字段改起，只补充你能核验的内容。</li>
                  <li>
                    输入 <kbd>/</kbd> 可以关联站内术语。
                  </li>
                  <li>先看修改后的阅读效果，再核对差异并投稿。</li>
                </ol>
                <Link to="/help/contributing/">
                  阅读贡献指南
                  <ArrowRight size={14} />
                </Link>
              </section>
            </aside>
          </div>
        ) : view === "preview" ? (
          <div className="ev7-previews"><ReadPreviewFrame mode={form.editorMode} data={form.typedData} context={request} intent={request.intent} /><p className="ev7-muted">修改摘要：{form.summary || "尚未填写"}</p></div>
        ) : (
          <div className="ev7-previews">
            <DiffViewer before={form.baseContent} after={after} />
            <button type="button" className="cm-button ev71-open-reading" onClick={() => setView("preview")}><Eye size={16} />查看修改后的阅读效果</button>
            <p className="ev7-muted">修改摘要：{form.summary || "尚未填写"}</p>
          </div>
        )}
        <div className="ev7-submit-bar">
          <div>
            <strong>{workspace.profile.nickname || "本地访客"}</strong>
            <span>提交到当前浏览器的审核流程</span>
            {notice.startsWith("草稿尚未成功保存") && <small className="ev72-return-error" role="alert">{notice}</small>}
          </div>
          <div>
            <button type="button" className="cm-button ev72-bottom-return" disabled={!ready} title="返回前保留当前草稿" onClick={returnToReader}><ArrowLeft size={15} />返回原页</button>
            <button
              type="button"
              className="cm-button"
              disabled={!ready}
              onClick={() => save(form, true)}
            >
              <Save size={15} />
              保存草稿
            </button>
            <button
              type="button"
              className="cm-button"
              onClick={() => setView(view === "edit" ? "preview" : "edit")}
            >
              {view === "edit" ? "预览效果" : "继续编辑"}
            </button>
            <button
              type="submit"
              className="cm-button cm-button-primary"
              disabled={!ready || stale}
            >
              <Send size={15} />
              {request.intent === "delete" ? "提交删除提议" : "提交本地审核"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export { formFor };
