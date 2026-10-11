import React, { useEffect, useState } from "react";
import Link from "@docusaurus/Link";
import { FileCheck2, PencilLine, Plus } from "lucide-react";
import { editorHref, readLocalPublished } from "./registry";
import ReadingMarkdown from "./ReadingMarkdown";
import { useWikiRuntime } from "../runtime/useWikiRuntime";
import { formalWorkspaceHref, registeredEditTarget } from "../runtime/policy";
import catalog from "../../generated/catalog.json";

export default function EditEntry({
  entity,
  section = "条目正文",
  mode,
  returnTo,
  record,
  intent,
  label,
  className = "",
  compact = false,
  variant = "subtle",
}) {
  const adding = intent === "add";
  const {demo} = useWikiRuntime();
  const request = {entity, section, mode, returnTo, record, intent};
  const registered = registeredEditTarget(catalog.pages, request);
  const Icon = adding ? Plus : PencilLine;
  const text = label || (adding ? "新增记录" : "编辑本节");
  return (
    <Link
      className={`rw-edit-entry ${adding ? "rw-edit-entry-add" : ""} ${variant === "primary" ? "rw-edit-entry-primary" : ""} ${className}`}
      to={demo ? editorHref(request) : registered ? formalWorkspaceHref(catalog.pages, request) : editorHref(request)}
      aria-label={`${text}：${entity || ""} · ${section}`}
      title={`${adding ? "添加" : "基于当前版本编辑"} ${section}`}
    >
      <Icon size={14} />
      <span>{compact ? "编辑" : text}</span>
    </Link>
  );
}

export function usePublishedSection(request) {
  const {demo} = useWikiRuntime();
  const [snapshot, setSnapshot] = useState(null);
  const key = JSON.stringify(request);
  useEffect(() => {
    const refresh = () => setSnapshot(demo ? readLocalPublished(request) : null);
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("roco:community-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("roco:community-updated", refresh);
    };
  }, [key, demo]);
  return snapshot;
}

// Hosts can replace their data with snapshot.data, or show this explicit local revision panel.
export function PublishedSection({ children, ...request }) {
  const snapshot = usePublishedSection(request);
  if (!snapshot) return children || null;
  if (snapshot.mode === "article") return <div className="rw-published-section"><div className="ev7-local-revision"><FileCheck2 size={15} /><div><strong>正在阅读本机已发布版本</strong><span>{snapshot.revision} · 线上站点未发生变化</span></div><EditEntry {...request} label="继续修订" /></div><ReadingMarkdown markdown={snapshot.data.markdown || ""} context={request} editHeadings /></div>;
  return (
    <div className="rw-published-section">
      {children}
      <details>
        <summary>
          <FileCheck2 size={15} />
          本机已发布修订 · {snapshot.revision}
          <span>展开查看</span>
        </summary>
        <p>这是当前浏览器完成审核流程后的版本，线上站点未发生变化。</p>
        <pre>{snapshot.content}</pre>
        <EditEntry {...request} label="继续修订此版本" />
      </details>
    </div>
  );
}
