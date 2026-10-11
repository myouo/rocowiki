import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import BoundedTextarea from "../../BoundedTextarea";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCheck, CheckCircle2, CircleAlert, Clock3, FileClock, FilePenLine, FileText, Eye, GitCompareArrows, Info, Link2, ListChecks, MessageSquareText, PencilLine, Save, Send, X } from "lucide-react";
import EntityTextarea from "../../EntityTextarea";
import { ReadPreviewFrame } from "../../editing/PreviewContent";
import { safeInternalPath } from "../../editing/model";
import { draftPersisted } from "../../editing/draftPersistence";
import { STORAGE_KEY } from "../constants.js";
import { articleHref, defaultSection, domainFor, formatTime, isHttpUrl, queryValue } from "../navigation.js";
import { ContributionFooter, PageHeading, SectionHeading, StatusBadge } from "../components.jsx";
import { baselineFor, contentFor, defaultForm, validateForm, withUpstreamRequirement } from "./editorModel.js";
import { DiffViewer } from "../DiffPreview.jsx";

function Editor({ workspace, update, ready, query, storageError }) {
  const editorHistory = useHistory();
  const target = queryValue(query, "entity", "海芙约忒").slice(0, 80);
  const section = queryValue(query, "section", defaultSection(target)).slice(
    0,
    80,
  );
  const submissionId = queryValue(query, "submission");
  const draftKey = `${target}:${section}:${submissionId || "new"}`;
  const [form, setForm] = useState(() =>
    defaultForm(target, section, submissionId),
  );
  const [errors, setErrors] = useState({});
  const [view, setView] = useState("edit");
  const [dirty, setDirty] = useState(false);
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  const [notice, setNotice] = useState("");
  const restoreKey = useRef("");
  const pendingDraft = useRef(null);
  const reviewSource = workspace.submissions.find((s) => s.id === submissionId);
  const sourceIsImmutable =
    reviewSource &&
    ["merged", "building", "build_failed", "built", "published"].includes(
      reviewSource.status,
    );
  useEffect(() => {
    if (!ready || restoreKey.current === draftKey) return;
    restoreKey.current = draftKey;
    const saved = workspace.drafts.find((d) => d.key === draftKey);
    const original = workspace.submissions.find((s) => s.id === submissionId);
    if (saved) {
      setForm({ ...defaultForm(target, section, submissionId), ...saved });
      setSavedAt(saved.updatedAt || "");
      setRestored(true);
    } else if (original) {
      const conflict = original.status === "conflict";
      setForm({
        ...defaultForm(target, section, submissionId),
        ...original,
        target,
        section,
        revisesSubmissionId: submissionId,
        markdown: conflict
          ? withUpstreamRequirement(original.markdown || "", "markdown")
          : original.markdown,
        fields: conflict
          ? {
              ...original.fields,
              limits: withUpstreamRequirement(
                original.fields.limits || "",
                "markdown",
              ).trim(),
            }
          : original.fields,
        baseVersion: conflict
          ? "demo-r18"
          : [
                "merged",
                "building",
                "build_failed",
                "built",
                "published",
              ].includes(original.status)
            ? original.id
            : original.baseVersion,
      });
      setRestored(false);
      setSavedAt("");
    } else {
      setForm(defaultForm(target, section, submissionId));
      setRestored(false);
      setSavedAt("");
    }
    setDirty(false);
    setErrors({});
    setSubmittedId("");
    setView("edit");
    setNotice("");
  }, [ready, draftKey, target, section, submissionId]);
  const saveDraft = useCallback(
    (value = form, showNotice = false) => {
      const now = new Date().toISOString();
      const draft = { ...value, key: draftKey, updatedAt: now };
      update((old) => ({
        ...old,
        drafts: [draft, ...old.drafts.filter((d) => d.key !== draftKey)],
      }));
      const persisted = draftPersisted(draftKey, value, STORAGE_KEY);
      setSavedAt(persisted ? now : "");
      setDirty(!persisted);
      if (!persisted) setNotice("草稿尚未成功保存，当前内容仍保留在编辑页。请重试保存或复制内容。");
      if (showNotice) {
        let persisted = false;
        try { const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null"); const saved = stored?.drafts?.find((row) => row.key === draftKey); persisted = Boolean(saved && saved.markdown === value.markdown && JSON.stringify(saved.fields) === JSON.stringify(value.fields) && saved.summary === value.summary && saved.evidenceUrl === value.evidenceUrl && saved.evidenceNote === value.evidenceNote); } catch {}
        setNotice(persisted ? "草稿已留在当前浏览器，可从「个人中心」继续编辑。" : "草稿尚未成功保存，当前内容留在编辑页。请重试保存或先复制内容。");
      }
    },
    [form, draftKey, update],
  );
  function returnToReader() {
    const destination = safeInternalPath(queryValue(query, "returnTo", reviewSource?.editorRequest?.returnTo || ""), articleHref(target));
    if (dirty || restored || savedAt) {
      saveDraft(form);
      try {
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
        const draft = stored?.drafts?.find((row) => row.key === draftKey);
        if (!draft || draft.markdown !== form.markdown || JSON.stringify(draft.fields) !== JSON.stringify(form.fields) || draft.summary !== form.summary || draft.evidenceUrl !== form.evidenceUrl || draft.evidenceNote !== form.evidenceNote) throw new Error("Draft not persisted");
      } catch {
        setNotice("草稿尚未成功保存，已留在编辑页。请重试“保存草稿”或复制内容后再返回。");
        return;
      }
    }
    pendingDraft.current = null;
    editorHistory.push(destination);
  }
  useEffect(() => {
    if (!ready || !dirty || submittedId) return;
    const timer = window.setTimeout(() => saveDraft(form), 700);
    return () => window.clearTimeout(timer);
  }, [form, dirty, ready, submittedId, saveDraft]);
  useEffect(() => {
    pendingDraft.current = { form, dirty, submittedId, key: draftKey };
  }, [form, dirty, submittedId, draftKey]);
  useEffect(() => {
    const flush = () => {
      const pending = pendingDraft.current;
      if (!pending?.dirty || pending.submittedId) return;
      const draft = {
        ...pending.form,
        key: pending.key,
        updatedAt: new Date().toISOString(),
      };
      update((old) => ({
        ...old,
        drafts: [draft, ...old.drafts.filter((d) => d.key !== pending.key)],
      }));
      if (draftPersisted(pending.key, pending.form, STORAGE_KEY)) pending.dirty = false;
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [update]);
  const change = (key, value) => {
    setForm((old) => ({ ...old, [key]: value }));
    setDirty(true);
    setErrors((old) => ({ ...old, [key]: undefined }));
    setNotice("");
  };
  const changeField = (key, value) => {
    setForm((old) => ({ ...old, fields: { ...old.fields, [key]: value } }));
    setDirty(true);
    setErrors((old) => ({ ...old, [key]: undefined }));
    setNotice("");
  };
  const originalBefore =
    reviewSource && form.type === reviewSource.type
      ? sourceIsImmutable
        ? reviewSource.after
        : reviewSource.before
      : baselineFor(form.type);
  const before =
    reviewSource?.status === "conflict"
      ? withUpstreamRequirement(originalBefore, form.type)
      : originalBefore;
  const after = contentFor(form);
  const fillExample = () => {
    setForm((old) => ({
      ...old,
      fields: {
        trigger: "示例：按实测资料填写完整的触发条件。",
        effect: "示例：依据原始对战记录，分条注明效果与结算顺序。",
        limits: "示例：尚未复现的例外，应明确标为待验证。",
      },
      markdown:
        "## 资料记录\n- 触发条件：逐条填写，并附可定位的出处。\n- 结算顺序：对照原始对战记录核验。\n- 例外情况：区分已复现结论与待验证猜测。\n\n> 这是编辑流程示例，不是已确认的游戏机制。",
      summary: "演示：把资料记录拆成触发、结算和例外三个可核验项目。",
      evidenceUrl: "https://roco.qq.com/",
      evidenceNote:
        "演示证据说明：正式投稿须替换为具体公告或原始日志，并写明时间或回合位置。",
    }));
    setDirty(true);
    setErrors({});
    setNotice("已填入流程演示内容；其中没有新增已确认的游戏结论。");
  };
  const preview = () => {
    setView("preview");
    setNotice("");
  };
  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setView("edit");
      setNotice("请补齐标红项目后再提交本地审核。");
      return;
    }
    const now = new Date().toISOString();
    const revising = reviewSource && !sourceIsImmutable;
    const id = revising ? reviewSource.id : `local-${Date.now().toString(36)}`;
    const record = {
      ...form,
      id,
      isExample: false,
      target,
      section,
      before,
      after,
      status: "pending",
      author: workspace.profile.nickname || "本地访客",
      authorId: workspace.profile.uuid || "",
      authorAvatar: workspace.profile.avatar || "dimo",
      submittedAt: (revising && reviewSource.submittedAt) || now,
      updatedAt: now,
      revisionCount: (revising ? reviewSource.revisionCount || 0 : 0) + 1,
      reviewNote: "",
      events: [
        ...(revising ? reviewSource.events : []),
        {
          label: revising ? "修订后重新投稿" : "提交本地审核",
          at: now,
          note: form.summary.trim(),
        },
      ],
    };
    pendingDraft.current = null;
    update((old) => ({
      ...old,
      drafts: old.drafts.filter((d) => d.key !== draftKey),
      submissions: [record, ...old.submissions.filter((s) => s.id !== id)],
    }));
    setDirty(false);
    setSubmittedId(id);
    setNotice("");
  };
  if (submittedId)
    return (
      <>
        <PageHeading
          eyebrow="本地投稿已记录"
          title="修改进入待审核状态"
          description={`${target} / ${section}`}
          parent="/community/"
        />
        <section className="cm-paper cm-submission-success">
          <span className="cm-success-icon">
            <CheckCheck size={29} />
          </span>
          <h2>草稿已经转为本地投稿</h2>
          <p>
            本次内容保存在当前浏览器，尚未发送到服务器或
            GitHub。你可以继续体验差异核验、退回修订和逐步发布。
          </p>
          <div className="cm-success-context">
            <span>修改摘要</span>
            <strong>{form.summary}</strong>
            <StatusBadge status="pending" />
          </div>
          <div className="cm-success-actions">
            <Link
              className="cm-button cm-button-primary"
              to={`/review/?submission=${encodeURIComponent(submittedId)}`}
            >
              查看并体验审核
              <ArrowRight size={16} />
            </Link>
            <Link className="cm-button" to="/account/?tab=submissions">
              我的投稿
            </Link>
            <Link className="cm-text-button" to={articleHref(target)}>
              查看词条
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
        <DiffViewer before={before} after={after} />
        <ContributionFooter target={target} section={section} />
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow="词条纠错与补充"
        title={`编辑 · ${target}`}
        description={`当前章节：${section} · 基于演示版本 ${form.baseVersion}`}
        parent={articleHref(target)}
        actions={
          <Link className="cm-button" to={articleHref(target)}>
            <BookOpen size={15} />
            查看词条
          </Link>
        }
      />
      {restored && (
        <div className="cm-restored-note">
          <FileClock size={16} />
          <span>已恢复这份本地草稿，可继续上次的修改。</span>
          <button
            type="button"
            onClick={() => setRestored(false)}
            aria-label="关闭草稿恢复提示"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {reviewSource &&
        ["changes_requested", "conflict"].includes(reviewSource.status) && (
          <div className="cm-action-note cm-action-note-column">
            <div>
              <CircleAlert size={17} />
              <strong>
                {reviewSource.status === "conflict"
                  ? "上游已更新，请在新版基础上核对修改"
                  : "这份投稿需要修订"}
              </strong>
            </div>
            <p>
              {reviewSource.reviewNote ||
                "演示上游新增了来源定位要求。重新检查差异，补齐说明后再提交。"}
            </p>
            <Link
              to={`/review/?submission=${encodeURIComponent(reviewSource.id)}`}
            >
              查看审核意见
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      <form onSubmit={submit} noValidate>
        <div className="cm-editor-toolbar">
          <div className="cm-segmented">
            <button
              type="button"
              className={view === "edit" ? "is-active" : ""}
              onClick={() => setView("edit")}
            >
              <PencilLine size={14} />
              编辑
            </button>
            <button
              type="button"
              className={view === "preview" ? "is-active" : ""}
              onClick={preview}
            >
              <Eye size={14} />
              页面预览
            </button>
            <button
              type="button"
              className={view === "diff" ? "is-active" : ""}
              onClick={() => setView("diff")}
            >
              <GitCompareArrows size={14} />
              修改对比
            </button>
          </div>
          <span className="cm-save-status" aria-live="polite">
            {dirty ? (
              <>
                <Clock3 size={13} />
                正在编辑…
              </>
            ) : savedAt ? (
              <>
                <Check size={13} />
                {storageError ? "暂存于会话" : "已保存到本机"} ·{" "}
                {formatTime(savedAt)}
              </>
            ) : (
              "修改后自动保存草稿"
            )}
          </span>
        </div>
        {notice && (
          <div
            className={
              Object.keys(errors).length
                ? "cm-form-notice cm-form-notice-error"
                : "cm-form-notice"
            }
            role="status"
          >
            <Info size={15} />
            <span>{notice}</span>
          </div>
        )}
        {view === "edit" ? (
          <div className="cm-editor-grid">
            <section className="cm-paper cm-editor-main">
              <SectionHeading icon={FilePenLine} title="修改内容">
                <button
                  type="button"
                  className="cm-text-button"
                  onClick={fillExample}
                >
                  填入演示内容
                </button>
              </SectionHeading>
              <div
                className="cm-edit-type"
                role="group"
                aria-label="编辑内容类型"
              >
                <button
                  type="button"
                  className={form.type === "structured" ? "is-active" : ""}
                  onClick={() => change("type", "structured")}
                >
                  <ListChecks size={17} />
                  <span>
                    <strong>结构化资料</strong>
                    <small>条件、效果、例外分别填写</small>
                  </span>
                  {form.type === "structured" && <CheckCircle2 size={16} />}
                </button>
                <button
                  type="button"
                  className={form.type === "markdown" ? "is-active" : ""}
                  onClick={() => change("type", "markdown")}
                >
                  <FileText size={17} />
                  <span>
                    <strong>受限 Markdown</strong>
                    <small>用于解释与可读的正文</small>
                  </span>
                  {form.type === "markdown" && <CheckCircle2 size={16} />}
                </button>
              </div>
              <div className="cm-baseline-note">
                <Info size={14} />
                <p>
                  当前原文是流程演示占位。正式编辑将从对应 Git
                  修订读取；身份、编号等核心字段由维护者管理。
                </p>
              </div>
              {form.type === "structured" ? (
                <div className="cm-structured-fields">
                  <div className="cm-field">
                    <span>
                      触发条件 <em>必填</em>
                    </span>
                    <EntityTextarea
                      ariaLabel="触发条件"
                      rows={3}
                      maxLength={2000}
                      value={form.fields.trigger}
                      aria-invalid={!!errors.trigger}
                      onChange={(value) => changeField("trigger", value)}
                      placeholder="何时触发？是否需要前置状态、天气或属性条件？"
                    />
                    {errors.trigger && (
                      <small className="cm-inline-error">
                        {errors.trigger}
                      </small>
                    )}
                  </div>
                  <div className="cm-field">
                    <span>
                      效果与结算 <em>必填</em>
                    </span>
                    <EntityTextarea
                      ariaLabel="效果与结算"
                      rows={5}
                      maxLength={4000}
                      value={form.fields.effect}
                      aria-invalid={!!errors.effect}
                      onChange={(value) => changeField("effect", value)}
                      placeholder="按结算顺序写明效果；分支、对象和数值变化应明确区分。"
                    />
                    {errors.effect && (
                      <small className="cm-inline-error">{errors.effect}</small>
                    )}
                  </div>
                  <div className="cm-field">
                    <span>限制与例外</span>
                    <EntityTextarea
                      ariaLabel="限制与例外"
                      rows={3}
                      maxLength={2000}
                      value={form.fields.limits}
                      onChange={(value) => changeField("limits", value)}
                      placeholder="未验证的推测请显式注明，避免将其写成已确认事实。"
                    />
                  </div>
                </div>
              ) : (
                <div className="cm-field cm-markdown-field">
                  <span>
                    正文 <em>必填</em>
                    <small>支持标题、列表、引用、粗体与来源链接</small>
                  </span>
                  <EntityTextarea
                    ariaLabel="正文"
                    rows={17}
                    maxLength={10000}
                    value={form.markdown}
                    aria-invalid={!!errors.markdown}
                    onChange={(value) => change("markdown", value)}
                    placeholder={
                      "## 机制说明\n\n- 触发条件：\n- 结算顺序：\n\n## 来源\n[具体公告或原始记录](https://...)"
                    }
                    spellCheck={false}
                  />
                  {errors.markdown && (
                    <small className="cm-inline-error">{errors.markdown}</small>
                  )}
                  <small>不支持 HTML、MDX 组件、脚本和模块导入。</small>
                </div>
              )}
            </section>
            <aside className="cm-editor-evidence">
              <section className="cm-paper">
                <SectionHeading icon={Link2} title="让修改可以核验" />
                <label className="cm-field">
                  <span>来源链接</span>
                  <input
                    type="url"
                    inputMode="url"
                    maxLength={2000}
                    value={form.evidenceUrl}
                    aria-invalid={!!errors.evidenceUrl}
                    onChange={(event) =>
                      change("evidenceUrl", event.target.value)
                    }
                    placeholder="https://…（具体公告或原始记录）"
                  />
                  {errors.evidenceUrl && (
                    <small className="cm-inline-error">
                      {errors.evidenceUrl}
                    </small>
                  )}
                  <small>
                    没有可公开链接时，在下方说明原始记录与核验方法。
                  </small>
                </label>
                <label className="cm-field">
                  <span>
                    证据与定位说明 <em>必填</em>
                  </span>
                  <BoundedTextarea
                    rows={6}
                    maxLength={3000}
                    value={form.evidenceNote}
                    aria-invalid={!!errors.evidenceNote}
                    onChange={(event) =>
                      change("evidenceNote", event.target.value)
                    }
                    placeholder="来源中的哪一段？实测在什么条件、第几回合发生？资料适用哪一时间或赛季？"
                  />
                  {errors.evidenceNote && (
                    <small className="cm-inline-error">
                      {errors.evidenceNote}
                    </small>
                  )}
                </label>
              </section>
              <section className="cm-paper">
                <SectionHeading icon={MessageSquareText} title="修改摘要" />
                <label className="cm-field">
                  <span>
                    这次改了什么 <em>必填</em>
                  </span>
                  <BoundedTextarea
                    rows={4}
                    maxLength={500}
                    value={form.summary}
                    aria-invalid={!!errors.summary}
                    onChange={(event) => change("summary", event.target.value)}
                    placeholder="例如：补充触发条件，避免把条件效果写成固定效果。"
                  />
                  {errors.summary && (
                    <small className="cm-inline-error">{errors.summary}</small>
                  )}
                </label>
                <p className="cm-small-copy">
                  摘要会跟随投稿和修订记录，帮助下一位维护者理解这次修改。
                </p>
              </section>
            </aside>
          </div>
        ) : (
          <div className="cm-preview-content">
            {view === "diff" ? <DiffViewer before={before} after={after} /> :
              <ReadPreviewFrame mode="article" data={{ markdown: form.type === "markdown" ? form.markdown : after }} context={{ entity: target, section, returnTo: articleHref(target) }} />}
            <div className="cm-preview-evidence">
              <h3>本次证据</h3>
              {form.evidenceUrl && isHttpUrl(form.evidenceUrl) && (
                <a
                  href={form.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {domainFor(form.evidenceUrl)}
                  <ArrowUpRight size={14} />
                </a>
              )}
              <p>{form.evidenceNote || "尚未填写证据说明。"}</p>
              <h3>修改摘要</h3>
              <p>{form.summary || "尚未填写修改摘要。"}</p>
            </div>
          </div>
        )}
        <div className="cm-editor-submit">
          <div>
            <strong>署名：{workspace.profile.nickname || "本地访客"}</strong>
            <span>本地提交不会写入服务器或 GitHub。</span>
            {notice.startsWith("草稿尚未成功保存") && <small className="ev72-return-error" role="alert">{notice}</small>}
          </div>
          <div>
            <button type="button" className="cm-button ev72-bottom-return" disabled={!ready} title="返回前保留当前草稿" onClick={returnToReader}><ArrowLeft size={15} />返回原页</button>
            <button
              type="button"
              className="cm-button"
              disabled={!ready}
              onClick={() => saveDraft(form, true)}
            >
              <Save size={15} />
              保存草稿
            </button>
            {view === "edit" && (
              <button type="button" className="cm-button" onClick={preview}>
                页面预览
              </button>
            )}
            <button
              type="submit"
              className="cm-button cm-button-primary"
              disabled={!ready}
            >
              <Send size={15} />
              提交本地审核
            </button>
          </div>
        </div>
      </form>
      <ContributionFooter target={target} section={section} />
    </>
  );
}

export { Editor };
