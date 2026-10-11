import React from "react";
import Link from "@docusaurus/Link";
import { ArrowRight, ChevronRight, FileCheck2, Send } from "lucide-react";
import { editHref, formatTime } from "./navigation.js";
import { EmptyState, StatusBadge } from "./components.jsx";

function SubmissionRows({ submissions, compact = false }) {
  if (!submissions.length)
    return (
      <EmptyState
        icon={Send}
        title="还没有投稿"
        text="从词条的「纠错与补充」进入编辑，提交后可以在这里跟踪进度。"
      >
        <Link className="cm-button" to="/community/">
          查看待完善任务
          <ArrowRight size={14} />
        </Link>
      </EmptyState>
    );
  return (
    <div className="cm-work-list">
      {submissions.slice(0, compact ? 3 : 100).map((sub) => (
        <article className="cm-work-row" key={sub.id}>
          <FileCheck2 size={19} className="cm-muted-icon" />
          <div className="cm-work-main">
            <Link to={`/review/?submission=${encodeURIComponent(sub.id)}`}>
              {sub.target}
              <span> / {sub.section}</span>
            </Link>
            <p>{sub.summary}</p>
            <small>
              {sub.isExample
                ? "系统提供的演示投稿"
                : `本地投稿 · ${formatTime(sub.submittedAt)}`}{" "}
              · {sub.revisionCount || 1} 次修订
            </small>
          </div>
          <div className="cm-work-status">
            <StatusBadge status={sub.status} />
            <Link
              to={
                ["changes_requested", "conflict"].includes(sub.status)
                  ? editHref(sub.target, sub.section, sub.id)
                  : `/review/?submission=${encodeURIComponent(sub.id)}`
              }
            >
              {["changes_requested", "conflict"].includes(sub.status)
                ? "修订后重提"
                : "查看进度"}
              <ChevronRight size={14} />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

export { SubmissionRows };
