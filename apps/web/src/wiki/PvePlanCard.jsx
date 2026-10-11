import React from "react";
import Link from "@docusaurus/Link";
import { ArrowRight, ExternalLink, Shield, Swords } from "lucide-react";
import { pets } from "./data";
import ReadingMarkdown from "./editing/ReadingMarkdown";
import "./WorldV7.css";

const text = (value) => typeof value === "string" ? value : value == null ? "" : String(value);
const lines = (value) => (Array.isArray(value) ? value : text(value).split(/\r?\n/)).map(text).map((line) => line.trim()).filter(Boolean);
function sourceHref(value) {
  try { const url = new URL(text(value)); return /^https?:$/.test(url.protocol) ? url.href : ""; }
  catch { return ""; }
}
function PetNames({ value }) {
  if (/\[[^\]]+\]\(/.test(text(value))) return <ReadingMarkdown editHeadings={false} markdown={text(value)} />;
  const names = lines(value).flatMap((line) => line.split(/[、,，;；]/)).map((name) => name.trim()).filter(Boolean);
  return names.length ? names.map((name, index) => {
    const pet = pets.find((row) => row.name === name || row.slug === name);
    return pet ? <Link key={index} to={`/pets/${pet.slug}/`}>{pet.name}<ArrowRight size={13} /></Link> : <span key={index}>{name}</span>;
  }) : <span>挑战宠物待补充</span>;
}
/** The same readable plan is used in PVE pages and the editor's rendered preview. */
export default function PvePlanCard({ data = {}, actions, appreciation, recordId, meta = {} }) {
  const caution = meta.caution ?? /需防范的反制|不适用与失败/.test(text(data.title));
  const requirements = lines(data.requirements);
  const source = sourceHref(data.sourceUrl);
  return <article className={`wv7-pve-plan pv71-plan ${caution ? "is-caution" : ""}`} data-pve-recommendation={recordId} data-no-editor>
    <div className="wv7-pve-plan-heading">
      <span>{caution ? <Shield size={22} /> : <Swords size={22} />}</span>
      <div><h3>{text(data.challenge) || "挑战对象待补充"}</h3><p>{caution ? "不适用与失败条件" : text(data.title) || "挑战方案"}</p></div>
      {actions}
    </div>
    <div className="wv7-pve-pet-link">
      <span>{caution ? "涉及宠物" : "挑战宠物"}</span><PetNames value={data.pets} />
      {meta.evidenceLabel && <span className="rw-badge amber">{meta.evidenceLabel}</span>}
      {meta.floorLabel && <span className="rw-badge blue">{meta.floorLabel}</span>}
    </div>
    {(data.version || meta.recordedAt || data.testedAt) && <div className="pv71-plan-version">
      {(data.version || meta.recordedAt) && <span>适用资料：{text(data.version) || meta.recordedAt}</span>}
      <span>复测日期：{text(data.testedAt) || "待复现"}</span>
    </div>}
    {requirements.length > 0 && <div className="pv71-plan-field"><h4>必要配置与条件</h4><ul>{requirements.map((line, index) => <li key={index}><ReadingMarkdown editHeadings={false} markdown={line} /></li>)}</ul></div>}
    {data.steps && <div className="pv71-plan-field"><h4>{meta.historical ? "记录中的挑战思路" : "操作步骤"}</h4><ReadingMarkdown editHeadings={false} markdown={text(data.steps)} /></div>}
    {data.alternatives && <div className="wv7-pve-limitation"><strong>{caution || meta.historical ? "适用范围与限制" : "替代方案与失败条件"}</strong><ReadingMarkdown editHeadings={false} markdown={text(data.alternatives)} /></div>}
    <div className="wv7-pve-plan-source">
      {!data.version && !meta.recordedAt && <span>资料日期：待补充</span>}
      {!data.testedAt && !data.version && !meta.recordedAt && <span>复测日期：待复现</span>}
      {source ? <a href={source} target="_blank" rel="noreferrer">{meta.sourceLabel || "查看方案来源"}<ExternalLink size={12} /></a> : <span>资料来源待补充</span>}
    </div>
    {appreciation}
  </article>;
}
