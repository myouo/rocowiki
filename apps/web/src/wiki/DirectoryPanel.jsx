import React, { useEffect, useId, useRef, useState } from "react";
import Link from "@docusaurus/Link";
import { ArrowRight, Search, X } from "lucide-react";
import { ColorIcon } from "./visuals";
import { useInputComposition } from './inputComposition';

/** Shared directory surface. Search state and destination ownership stay with each page. */
export default function DirectoryPanel({ directory, title, Icon, tone = "blue", summary, filters, search, children }) {
  const headingId = "rw-directory-" + useId().replaceAll(":", "");
  return <section className="rw-directory" data-directory={directory} aria-labelledby={headingId} data-no-editor>
    <header className="rw-directory-header">
      <ColorIcon Icon={Icon} tone={tone} size={21} />
      <div className="rw-directory-heading">
        <h2 id={headingId}>{title}</h2>
        {summary != null && <p role="status" aria-live="polite">{summary}</p>}
      </div>
    </header>
    {(filters || search) && <div className="rw-directory-controls">{filters}{search}</div>}
    <div className="rw-directory-body">{children}</div>
  </section>;
}

export function DirectorySearch({ query, onSubmit, placeholder = "输入名称或关键词", label = "搜索资料", extra }) {
  const ime = useInputComposition();
  const current = query?.get("q") || "";
  const [text, setText] = useState(current);
  const input = useRef(null);
  useEffect(() => setText(current), [current]);
  return <form className={`rw-directory-search${extra ? " has-extra" : ""}`} role="search" aria-label={label}
    onSubmit={event => { event.preventDefault(); if (!ime.composing.current) onSubmit(text.trim()); }}>
    <div className="rw-directory-input">
      <Search size={18} aria-hidden="true" />
      <input {...ime.handlers} ref={input} name="q" aria-label={label} placeholder={placeholder} value={text} enterKeyHint="search"
        onChange={event => setText(event.target.value)} />
      {text && <button type="button" className="rw-directory-clear" aria-label="清空搜索" onClick={() => { setText(""); onSubmit(""); input.current?.focus(); }}><X size={16} aria-hidden="true" /></button>}
    </div>
    {extra && <div className="rw-directory-extra">{extra}</div>}
    <button className="rw-directory-submit" type="submit">查询</button>
  </form>;
}

export function DirectoryFilters({ items, current, label }) {
  return <nav className="rw-directory-filters" aria-label={label}>
    {items.map(item => <Link key={item.value} to={item.to} aria-current={current === item.value ? "page" : undefined}>{item.label}</Link>)}
  </nav>;
}

export function DirectoryEntry({ to, title, eyebrow, description, Icon, tone = "blue", facts = [], children, actionLabel = "查看条目" }) {
  return <Link to={to} className={`rw-directory-entry rw-tone-${tone}`}>
    <ColorIcon Icon={Icon} tone={tone} size={24} />
    <div className="rw-directory-entry-copy">
      {eyebrow && <small>{eyebrow}</small>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children && <div className="rw-directory-entry-tags">{children}</div>}
      {facts.length > 0 && <dl>{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
    </div>
    <span className="rw-directory-entry-action">{actionLabel}<ArrowRight size={16} aria-hidden="true" /></span>
  </Link>;
}
