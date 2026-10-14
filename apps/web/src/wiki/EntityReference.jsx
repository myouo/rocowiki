import React from "react";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { ArrowUpRight, BookOpen, CloudSun, Dna, Gift, MapPin, PawPrint, Sparkles, Swords, UsersRound, WandSparkles } from "lucide-react";
import { marked } from "marked";
import { resolveEntityReference } from "./entityReferences";

const iconByKind = { "宠物": PawPrint, "技能": WandSparkles, "血脉": Dna, "天气": CloudSun, "环境": Sparkles, "机制": BookOpen, "挑战": Swords, PVE: Swords, "场景": MapPin, "物品": Gift, "人物": UsersRound, "任务": BookOpen };
const toneByKind = { "宠物": "pet", "技能": "skill", "血脉": "bloodline", "天气": "weather", "环境": "environment" };
export default function EntityReference({ to, children, className = "", ...linkProps }) {
  const record = resolveEntityReference(to);
  const image = useBaseUrl(record?.image || "");
  if (!record) return <Link {...linkProps} to={to} className={className || undefined}>{children}</Link>;
  const Icon = iconByKind[record.kind] || BookOpen;
  return <Link {...linkProps} to={to} className={`rw-entity-reference rw-entity-reference-${toneByKind[record.kind] || "other"} ${className}`} data-entity-kind={record.kind} title={linkProps.title || `${record.kind}词条：${record.title || (typeof children === "string" ? children : "查看详情")}`}><span className="rw-entity-reference-icon" aria-hidden="true">{image && record.kind === "宠物" ? <img src={image} alt="" loading="lazy" decoding="async" /> : <Icon size={13} />}</span><span className="rw-entity-reference-label">{children || record.title}</span><ArrowUpRight className="rw-entity-reference-arrow" size={12} aria-hidden="true" /></Link>;
}

function target(href, path) {
  const value = String(href || "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (!value || /^\/\//.test(value) || /^[a-z][a-z\d+.-]*:/i.test(value) || /[<>\\\u0000-\u0020]/.test(value)) return "";
  try { const url = new URL(value, "https://wiki.invalid" + (path || "/")); return url.origin === "https://wiki.invalid" ? url.pathname + url.search + url.hash : ""; } catch { return ""; }
}
/** Small fields share the same entity chips as document Markdown, without block wrappers. */
export function EntityText({ text = "", path = "/", className = "", renderText }) {
  let serial = 0;
  function render(tokens, withinLink = false) { return tokens.map((token) => {
    const key = serial++;
    const content = token.tokens ? render(token.tokens, withinLink || token.type === "link") : token.text || "";
    if (token.type === "link") { const to = target(token.href, path); return !to ? <span key={key}>{content}</span> : to.startsWith("/") ? <EntityReference key={key} to={to}>{content}</EntityReference> : <a key={key} href={to} target="_blank" rel="noreferrer">{content}</a>; }
    if (token.type === "strong") return <strong key={key}>{content}</strong>;
    if (token.type === "em") return <em key={key}>{content}</em>;
    if (token.type === "del") return <del key={key}>{content}</del>;
    if (token.type === "codespan") return <code key={key}>{token.text}</code>;
    if (token.type === "br") return <br key={key} />;
    const value = content || token.raw || "";
    return <React.Fragment key={key}>{renderText && !withinLink && !token.tokens && token.type !== "html" ? renderText(String(value)) : value}</React.Fragment>;
  }); }
  return <span className={`rw-entity-text ${className}`}>{render(marked.Lexer.lexInline(String(text), { gfm: true }))}</span>;
}
