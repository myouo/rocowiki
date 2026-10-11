import React from "react";
import Link from "@docusaurus/Link";
import { ArrowLeft, FileText, History, Info, PencilLine, UsersRound } from "lucide-react";
import { STATUS } from "./constants.js";
import { editHref, historyHref } from "./navigation.js";

function StatusBadge({ status }) {
  const item = STATUS[status] || STATUS.pending;
  return (
    <span className={`cm-status cm-status-${item.tone}`}>
      <span />
      {item.label}
    </span>
  );
}

function PageHeading({ eyebrow, title, description, actions, parent }) {
  return (
    <header className="cm-page-heading">
      <div className="cm-heading-main">
        <div className="cm-eyebrow">
          {parent && (
            <Link
              className="cm-parent"
              to={parent}
              aria-label="前往上一级"
              title="前往上一级"
            >
              <ArrowLeft size={15} />
            </Link>
          )}
          {eyebrow}
        </div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="cm-heading-actions">{actions}</div>}
    </header>
  );
}

function PrototypeNote({ storageError }) {
  return (
    <div
      className={`cm-prototype ${storageError ? "cm-prototype-warning" : ""}`}
      role={storageError ? "alert" : "note"}
    >
      <Info size={16} />
      <div>
        <strong>本地交互原型</strong>
        <span>
          {storageError ||
            "本页草稿、审核、积分和点赞为本机演示记录。正式账号与投稿通过服务端工作台验证。"}
        </span>
      </div>
    </div>
  );
}

function ContributionFooter({ target = "贡献指南", section = "页面说明" }) {
  return (
    <footer className="cm-contribution-footer">
      <div>
        <UsersRound size={17} />
        <span>
          <strong>{target}</strong>
          <small>由社区共同完善 · 当前为界面原型</small>
        </span>
      </div>
      <nav aria-label="本页贡献入口">
        <Link to={historyHref(target)}>
          <History size={14} />
          修订记录
        </Link>
        <Link to={editHref(target, section)}>
          <PencilLine size={14} />
          纠错与补充
        </Link>
      </nav>
    </footer>
  );
}

function SectionHeading({ icon: Icon, title, children }) {
  return (
    <div className="cm-section-heading">
      <h2>
        {Icon && <Icon size={19} />}
        {title}
      </h2>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon = FileText, title, text, children }) {
  return (
    <div className="cm-empty">
      <Icon size={27} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}

function TextButton({ children, className = "", ...props }) {
  return (
    <button type="button" className={`cm-text-button ${className}`} {...props}>
      {children}
    </button>
  );
}

export { StatusBadge, PageHeading, PrototypeNote, ContributionFooter, SectionHeading, EmptyState, TextButton };
