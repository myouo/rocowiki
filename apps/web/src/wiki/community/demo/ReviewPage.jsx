import React, { useEffect, useState } from "react";
import Link from "@docusaurus/Link";
import BoundedTextarea from "../../BoundedTextarea";
import { ArrowRight, ArrowUpRight, Check, CheckCheck, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Clock3, FileCheck2, Eye, GitBranch, GitCompareArrows, GitMerge, History, Link2, ListChecks, LoaderCircle, MessageSquareText, PencilLine, Search, ShieldCheck, UserRound } from "lucide-react";
import CustomSelect from "../../Select";
import { ReadPreviewFrame } from "../../editing/PreviewContent";
import { getPublishedSnapshot } from "../../editing/registry";
import { cloneData, serializeData } from "../../editing/model";
import { makeSeed } from "./fixtures.js";
import { articleHref, editHref, formatTime, historyHref, isHttpUrl, queryValue } from "../navigation.js";
import { ContributionFooter, EmptyState, PageHeading, SectionHeading, StatusBadge } from "../components.jsx";
import { withUpstreamRequirement } from "./editorModel.js";
import { DiffViewer } from "../DiffPreview.jsx";
import { Pipeline } from "./Pipeline.jsx";

function Review({ workspace, update, query, ready }) {
  const requestedId = queryValue(query, "submission");
  const [selectedId, setSelectedId] = useState(requestedId || "");
  const [role, setRole] = useState("reviewer");
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState("");
  const [showConflictDiff, setShowConflictDiff] = useState(false);
  const [reviewView, setReviewView] = useState("preview");
  useEffect(() => {
    setSelectedId(requestedId || "");
  }, [requestedId]);
  const selected =
    workspace.submissions.find((s) => s.id === selectedId) ||
    (!selectedId ? workspace.submissions[0] : undefined);
  useEffect(() => {
    setReviewNote("");
    setError("");
    setShowConflictDiff(false);
    setReviewView("preview");
  }, [selected?.id]);
  const currentSnapshot =
    selected?.editorVersion === 7
      ? getPublishedSnapshot(selected.editorRequest, workspace)
      : null;
  const transition = (status, label, note = "") => {
    const now = new Date().toISOString();
    update((old) => {
      const current =
        selected.editorVersion === 7
          ? getPublishedSnapshot(selected.editorRequest, old)
          : null;
      let nextStatus = status;
      let nextNote = note;
      let nextLabel = label;
      let extra = [];
      if (
        status === "merged" &&
        current &&
        current.revision !== selected.baseVersion
      ) {
        nextStatus = "conflict";
        nextLabel = "版本核对未通过，合并暂停";
        nextNote = `投稿基于 ${selected.baseVersion}，当前为 ${current.revision}。请核对本节变化后重新提交。`;
      } else if (status === "conflict" && current) {
        const data = cloneData(current.data);
        const line = "【本地上游演示】补充准确的来源定位后再核验。";
        if (data.records?.[0])
          data.records[0].conditions = `${data.records[0].conditions || ""}\n${line}`;
        else {
          const key =
            [
              "markdown",
              "summary",
              "intro",
              "description",
              "requirements",
              "conditions",
            ].find((name) => typeof data[name] === "string") || "sourceNote";
          data[key] = `${data[key] || ""}\n${line}`;
        }
        const upstreamId = `upstream-${Date.now().toString(36)}`;
        extra = [
          {
            ...selected,
            id: upstreamId,
            typedData: data,
            before: current.content,
            after: serializeData(selected.editorMode, data),
            status: "published",
            isExample: true,
            author: "上游修订演示",
            submittedAt: now,
            updatedAt: now,
            summary: "演示另一份章节修订已发布",
            events: [
              {
                label: "生成本地上游修订演示",
                at: now,
                note: "仅用于核对版本冲突，不代表线上资料更新。",
              },
            ],
          },
        ];
        nextNote =
          "本机生成了另一份该节的已发布修订。请对照原始基线、当前版本与自己的修改，处理重叠字段。";
      }
      return {
        ...old,
        submissions: [
          ...extra,
          ...old.submissions.map((row) =>
            row.id === selected.id
              ? {
                  ...row,
                  status: nextStatus,
                  firstPublishedAt: nextStatus === "published" ? row.firstPublishedAt || now : row.firstPublishedAt,
                  updatedAt: now,
                  reviewNote: nextNote || row.reviewNote,
                  events: [
                    ...row.events,
                    {
                      label: nextLabel,
                      at: now,
                      note: nextNote || "本地流程演示，未调用远端服务。",
                    },
                  ],
                }
              : row,
          ),
        ],
      };
    });
    setError("");
    setReviewNote("");
  };
  const requestChanges = () => {
    if (reviewNote.trim().length < 6) {
      setError("请先写明退回原因，至少 6 个字符。");
      return;
    }
    transition("changes_requested", "退回：需要修订", reviewNote.trim());
  };
  const canReview = role === "reviewer";
  const canPublish = role === "maintainer";
  return (
    <>
      <PageHeading
        eyebrow="贡献审核与发布"
        title="审核工作台"
        description="核对具体改动和证据，每一步都保留处理记录。"
        parent="/community/"
        actions={
          <Link className="cm-button" to="/account/?tab=submissions">
            我的投稿
            <ArrowRight size={15} />
          </Link>
        }
      />
      <div className="cm-role-bar">
        <div>
          <ShieldCheck size={17} />
          <label htmlFor="cm-review-role">体验身份</label>
          <CustomSelect
            id="cm-review-role"
            ariaLabel="体验身份"
            value={role}
            onChange={setRole}
            options={[
              { value: "reviewer", label: "审核者" },
              { value: "maintainer", label: "发布维护者" },
              { value: "contributor", label: "贡献者" },
            ]}
          />
        </div>
        <p>身份切换仅演示界面；正式权限必须由服务端验证。</p>
      </div>
      {!selected ? (
        <section className="cm-paper">
          <EmptyState
            icon={FileCheck2}
            title={
              !ready
                ? "正在读取本地投稿"
                : selectedId
                  ? "这份投稿不在当前浏览器中"
                  : "当前没有本地投稿"
            }
            text={
              selectedId
                ? "链接对应的投稿可能来自另一台设备，或本地记录已经清除。可从当前浏览器的投稿列表继续。"
                : "先完成一份词条修订，再进入这个工作台体验审核。"
            }
          >
            <Link
              className="cm-button cm-button-primary"
              to={selectedId ? "/review/" : editHref("海芙约忒")}
            >
              {selectedId ? "查看本地投稿列表" : "开始一次词条纠错"}
              <ArrowRight size={14} />
            </Link>
            {ready && !workspace.submissions.length && (
              <button
                type="button"
                className="cm-button"
                onClick={() => {
                  setSelectedId("");
                  update((old) => ({
                    ...old,
                    submissions: makeSeed().submissions,
                  }));
                }}
              >
                加载审核示例
              </button>
            )}
          </EmptyState>
        </section>
      ) : (
        <div className="cm-review-grid">
          <aside className="cm-paper cm-review-list">
            <SectionHeading icon={FileCheck2} title="本地投稿">
              <span className="cm-count-label">
                {workspace.submissions.length}
              </span>
            </SectionHeading>
            {workspace.submissions.map((sub) => (
              <button
                type="button"
                key={sub.id}
                className={selected.id === sub.id ? "is-active" : ""}
                onClick={() => setSelectedId(sub.id)}
              >
                <span className="cm-review-list-title">
                  {sub.target}
                  <ChevronRight size={14} />
                </span>
                <span>{sub.section}</span>
                <StatusBadge status={sub.status} />
                <small>
                  {sub.isExample
                    ? "演示投稿"
                    : `本地投稿 · ${formatTime(sub.submittedAt)}`}
                </small>
              </button>
            ))}
            <Link className="cm-review-new" to="/community/">
              去认领一项待完善任务
              <ArrowRight size={14} />
            </Link>
          </aside>
          <div className="cm-review-main">
            <section className="cm-paper cm-review-overview">
              <div className="cm-review-title">
                <div>
                  <span className="cm-eyebrow">
                    {selected.isExample ? "系统演示投稿" : "本地投稿"} ·{" "}
                    {selected.id}
                  </span>
                  <h2>
                    {selected.target}
                    <span> / {selected.section}</span>
                  </h2>
                </div>
                <StatusBadge status={selected.status} />
              </div>
              <p className="cm-review-summary">{selected.summary}</p>
              <div className="cm-review-meta">
                <span>
                  <UserRound size={14} />
                  {selected.author || "本地访客"}
                </span>
                <span>
                  <GitBranch size={14} />
                  基于 {selected.baseVersion}
                </span>
                <span>
                  <History size={14} />
                  {selected.revisionCount || 1} 次修订
                </span>
                <Link
                  to={
                    selected.editorRequest?.returnTo ||
                    articleHref(selected.target)
                  }
                >
                  查看词条
                  <ArrowUpRight size={13} />
                </Link>
              </div>
              <Pipeline status={selected.status} />
            </section>
            {selected.status === "changes_requested" && (
              <div className="cm-action-note cm-action-note-column">
                <div>
                  <MessageSquareText size={18} />
                  <strong>审核意见：修改后可以重新投稿</strong>
                </div>
                <p>{selected.reviewNote}</p>
                <Link
                  className="cm-button"
                  to={editHref(selected.target, selected.section, selected.id)}
                >
                  <PencilLine size={15} />
                  按意见修订
                </Link>
              </div>
            )}
            {selected.status === "conflict" && (
              <div className="cm-conflict-panel">
                <div>
                  <CircleAlert size={19} />
                  <h3>原文在投稿后发生了变化</h3>
                </div>
                <p>
                  基于 {selected.baseVersion} 的修改遇到了新版{" "}
                  {currentSnapshot?.revision || "demo-r18"}
                  。合并已暂停，请对照上游变化重新修订。
                </p>
                <div className="cm-conflict-actions">
                  <button
                    type="button"
                    className="cm-button"
                    onClick={() => setShowConflictDiff((open) => !open)}
                  >
                    {showConflictDiff ? "收起上游差异" : "查看上游差异"}
                    <ChevronDown size={14} />
                  </button>
                  <Link
                    className="cm-button cm-button-primary"
                    to={editHref(
                      selected.target,
                      selected.section,
                      selected.id,
                    )}
                  >
                    在新版基础上修订
                    <ArrowRight size={14} />
                  </Link>
                </div>
                {showConflictDiff && (
                  <DiffViewer
                    before={selected.before}
                    after={
                      currentSnapshot?.content ||
                      withUpstreamRequirement(selected.before, selected.type)
                    }
                    beforeLabel={selected.baseVersion}
                    afterLabel={
                      currentSnapshot?.revision || "demo-r18 · 演示上游"
                    }
                  />
                )}
              </div>
            )}
            <div className="rw-review-preview-v71">
              <nav className="rw-review-view-tabs-v71" aria-label="审核内容查看方式">
                <button type="button" className={reviewView === "preview" ? "is-active" : ""} aria-pressed={reviewView === "preview"} onClick={() => setReviewView("preview")}><Eye size={16} />页面预览</button>
                <button type="button" className={reviewView === "diff" ? "is-active" : ""} aria-pressed={reviewView === "diff"} onClick={() => setReviewView("diff")}><GitCompareArrows size={16} />修改对比</button>
              </nav>
              {reviewView === "preview" ? <ReadPreviewFrame
                mode={selected.editorMode || "article"}
                data={selected.typedData || { markdown: selected.after }}
                context={{ entity: selected.target, section: selected.section, returnTo: selected.editorRequest?.returnTo || articleHref(selected.target) }}
                intent={selected.editorRequest?.intent}
              /> : <DiffViewer before={selected.before} after={selected.after} />}
            </div>
            <section className="cm-paper cm-review-evidence">
              <SectionHeading icon={Link2} title="投稿证据" />
              <div className="cm-evidence-source">
                <span>来源链接</span>
                {selected.evidenceUrl && isHttpUrl(selected.evidenceUrl) ? (
                  <a
                    href={selected.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {selected.evidenceUrl}
                    <ArrowUpRight size={14} />
                  </a>
                ) : (
                  <span className="cm-muted">
                    未附公开链接，请依据下方说明核验
                  </span>
                )}
              </div>
              <p>{selected.evidenceNote || "未提供证据说明。"}</p>
              <div className="cm-evidence-checks">
                <span>
                  <Search size={14} />
                  能定位到原始内容
                </span>
                <span>
                  <ListChecks size={14} />
                  结论保留完整条件
                </span>
                <span>
                  <Clock3 size={14} />
                  适用时间明确
                </span>
              </div>
            </section>
            <section className="cm-paper cm-review-actions">
              <SectionHeading icon={ShieldCheck} title="处理这份投稿">
                <span className="cm-soft-label">所有操作仅在本机生效</span>
              </SectionHeading>
              {selected.status === "pending" && (
                <>
                  {canReview ? (
                    <>
                      <label className="cm-field">
                        <span>
                          审核意见 <small>退回时必填，批准时可选</small>
                        </span>
                        <BoundedTextarea
                          rows={3}
                          maxLength={1200}
                          value={reviewNote}
                          onChange={(event) => {
                            setReviewNote(event.target.value);
                            setError("");
                          }}
                          placeholder="说明需要修改哪一处，以及应如何补充证据。"
                          aria-invalid={!!error}
                        />
                      </label>
                      {error && (
                        <p className="cm-inline-error" role="alert">
                          {error}
                        </p>
                      )}
                      <div className="cm-review-action-buttons">
                        <button
                          type="button"
                          className="cm-button cm-button-primary"
                          onClick={() =>
                            transition(
                              "approved",
                              "审核通过，等待合并",
                              reviewNote.trim(),
                            )
                          }
                        >
                          <CheckCircle2 size={16} />
                          本地批准
                        </button>
                        <button
                          type="button"
                          className="cm-button"
                          onClick={requestChanges}
                        >
                          <MessageSquareText size={15} />
                          退回需修改
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="cm-role-hint">
                      切换至「审核者」可体验批准与退回操作。
                    </p>
                  )}
                </>
              )}
              {selected.status === "approved" && (
                <>
                  <p>
                    内容已通过本地审核。合并前仍需确认上游版本没有改变，审核通过本身不会使页面上线。
                  </p>
                  {canPublish ? (
                    <div className="cm-review-action-buttons">
                      <button
                        type="button"
                        className="cm-button cm-button-primary"
                        onClick={() => transition("merged", "演示普通合并完成")}
                      >
                        <GitMerge size={16} />
                        模拟合并
                      </button>
                      <button
                        type="button"
                        className="cm-button"
                        onClick={() =>
                          transition(
                            "conflict",
                            "发现上游冲突，合并暂停",
                            "演示上游新增了来源定位要求，请在新版基础上核对正文并补齐证据位置。",
                          )
                        }
                      >
                        <GitCompareArrows size={15} />
                        模拟上游冲突
                      </button>
                    </div>
                  ) : (
                    <p className="cm-role-hint">
                      切换至「发布维护者」可继续体验合并，或触发上游冲突。
                    </p>
                  )}
                </>
              )}
              {selected.status === "merged" && (
                <>
                  <p>
                    演示投稿已合并，保留独立修订。构建成功之前，线上读者仍会看到此前的页面。
                  </p>
                  {canPublish ? (
                    <button
                      type="button"
                      className="cm-button cm-button-primary"
                      onClick={() => transition("building", "启动本地演示构建")}
                    >
                      <LoaderCircle size={16} />
                      模拟开始构建
                    </button>
                  ) : (
                    <p className="cm-role-hint">
                      切换至「发布维护者」可启动构建演示。
                    </p>
                  )}
                </>
              )}
              {selected.status === "building" && (
                <>
                  <p>
                    正在展示构建阶段。选择结果以检查成功与失败两条路径；此处未启动真实构建任务。
                  </p>
                  {canPublish ? (
                    <div className="cm-review-action-buttons">
                      <button
                        type="button"
                        className="cm-button cm-button-primary"
                        onClick={() =>
                          transition("built", "本地演示构建成功，等待发布")
                        }
                      >
                        <Check size={16} />
                        模拟构建成功
                      </button>
                      <button
                        type="button"
                        className="cm-button"
                        onClick={() =>
                          transition(
                            "build_failed",
                            "本地演示构建失败",
                            "示例错误：新增引用未通过检查。已保留投稿与合并记录，可在修复后重试构建。",
                          )
                        }
                      >
                        <CircleAlert size={16} />
                        模拟构建失败
                      </button>
                    </div>
                  ) : (
                    <p className="cm-role-hint">
                      切换至「发布维护者」可选择演示构建结果。
                    </p>
                  )}
                </>
              )}
              {selected.status === "build_failed" && (
                <>
                  <div className="cm-build-error">
                    <CircleAlert size={18} />
                    <p>{selected.reviewNote}</p>
                  </div>
                  {canPublish ? (
                    <button
                      type="button"
                      className="cm-button cm-button-primary"
                      onClick={() => transition("building", "重试本地演示构建")}
                    >
                      <LoaderCircle size={16} />
                      模拟修复后重试
                    </button>
                  ) : (
                    <p className="cm-role-hint">
                      切换至「发布维护者」可重试演示构建。
                    </p>
                  )}
                </>
              )}
              {selected.status === "built" && (
                <>
                  <p>
                    演示构建通过，等待发布。正式服务应核对这次构建对应的合并版本，再更新公开站点。
                  </p>
                  {canPublish ? (
                    <button
                      type="button"
                      className="cm-button cm-button-primary"
                      onClick={() =>
                        transition("published", "本地发布流程演示完成")
                      }
                    >
                      <CheckCheck size={16} />
                      模拟发布上线
                    </button>
                  ) : (
                    <p className="cm-role-hint">
                      切换至「发布维护者」可完成本地发布演示。
                    </p>
                  )}
                </>
              )}
              {selected.status === "published" && (
                <div className="cm-published-result">
                  <CheckCheck size={25} />
                  <div>
                    <h3>本地发布流程已走通</h3>
                    <p>
                      这份修订已成为当前浏览器的编辑基线，真实站点和仓库尚未发生变化。
                    </p>
                    {selected.editorVersion === 7 && (
                      <Link
                        to={
                          selected.editorRequest?.returnTo ||
                          articleHref(selected.target)
                        }
                      >
                        返回原章节查看本机修订
                        <ArrowRight size={14} />
                      </Link>
                    )}
                    <Link to={historyHref(selected.target)}>
                      查看本地修订记录
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              )}
              {["changes_requested", "conflict"].includes(selected.status) && (
                <p>
                  这份投稿已暂停后续步骤，修订后会重新进入「待审核」。
                  <Link
                    to={editHref(
                      selected.target,
                      selected.section,
                      selected.id,
                    )}
                  >
                    打开对应编辑稿
                    <ArrowRight size={14} />
                  </Link>
                </p>
              )}
            </section>
            <section className="cm-paper cm-event-section">
              <SectionHeading icon={History} title="处理记录" />
              <ol className="cm-events">
                {[...selected.events].reverse().map((event, index) => (
                  <li key={`${event.at}-${index}`}>
                    <span className="cm-event-dot" />
                    <div>
                      <strong>{event.label}</strong>
                      <small>{formatTime(event.at)}</small>
                      <p>{event.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      )}
      <ContributionFooter
        target={selected?.target || "贡献指南"}
        section={selected?.section || "审核说明"}
      />
    </>
  );
}

export { Review };
