import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { ArrowRight, BookOpen, CalendarDays, CircleHelp, Eye, Gift, MapPin, Monitor, PawPrint, Smartphone, Swords, Trash2, UsersRound, WandSparkles } from "lucide-react";
import { safeInternalPath } from "./model";
import ReadingMarkdown from "./ReadingMarkdown";
import StatsRadar from "../StatsRadar";
import SkillRuleReading from "../SkillRuleReading";
import { SkillLearnersPreview } from "../SkillLearners";
import { EntityText } from "../EntityReference";
import { PveGuidePreview } from "../PveGuideEditor";
import CounterBloodlineSides from "../CounterBloodlineSides";
import PvePlanCard from "../PvePlanCard";
import { TypeBadge } from "../core";
import { pets } from "../data";
import PreviewBoundary from "./PreviewBoundary";
import { observePreviewSize, preparePreviewDocument } from "./previewRuntime";

const text = (value) => Array.isArray(value) ? value.join("\n") : String(value ?? "");
const SCENES = { "lead-together": "同起", "switch-in": "后上拦截", "already-active": "先在场", unspecified: "上场情境待补充" };
const MODE_NAMES = { article: "章节正文", acquisition: "获取时间线", event: "活动与历次开放", skill: "技能条目", matchup: "PVP 对位", npc: "人物条目", pet: "宠物资料", pve: "挑战方案", "pve-guide": "PVE 玩法条目", index: "资料入口", relationship: "效果关系" };
function Source({ url, label }) {
  let valid = false;
  try { valid = ["http:", "https:"].includes(new URL(url).protocol); } catch {}
  return <p className="ev7-preview-source">来源：{!url ? "待补充" : valid ? <a href={url} target="_blank" rel="noreferrer">{label || url}</a> : <span>{label || url} · 链接格式待检查</span>}</p>;
}
function Details({ rows }) { return <dl className="ev7-preview-details">{rows.filter(([, value]) => value !== undefined && value !== null && value !== "").map(([label, value]) => <div key={label}><dt>{label}</dt><dd><EntityText text={text(value)} /></dd></div>)}</dl>; }
function Prose({ value, context }) { return value ? <ReadingMarkdown markdown={text(value)} context={context} editHeadings={false} className="ev71-preview-prose" /> : <p className="ev71-preview-placeholder">这部分尚未填写。</p>; }
function Block({ title, value, children, context }) { return <section className="ev71-preview-block"><h3>{title}</h3>{children || <Prose value={value} context={context} />}</section>; }

export function AcquisitionTimelineView({ records = [], activity = false }) {
  if (!records.length) return <p className="ev71-preview-placeholder">尚未添加开放或获取记录。</p>;
  return <div className="ev7-timeline-preview">{records.map((row, index) => <article key={row.id || index}><div className="ev7-preview-date"><CalendarDays size={14} />{row.startDate || "开始日期待补"}<span>—</span>{row.endDate || "截止日期未记录"}</div><h3>{(activity ? row.label : row.title) || "记录名称待补"}</h3><div className="ev7-preview-meta"><span><MapPin size={13} />{(activity ? row.location : row.place) || "地点待补"}</span><span><Gift size={13} />{text(activity ? row.rewards : row.reward) || "奖励待补"}</span></div><Details rows={[["参与条件", row.conditions], ["完成方式", row.method]]} /><Source url={row.sourceUrl} label={row.sourceTitle || row.sourceLabel} /></article>)}</div>;
}
function PetPreview({ data, context }) {
  const original = pets.find((pet) => pet.slug === data.slug || pet.name === context.entity);
  const image = useBaseUrl(original?.image || "");
  const stats = ["hp", "attack", "defense", "magicAttack", "magicDefense", "speed"].map((key) => data[key] !== "" && data[key] != null && Number.isFinite(Number(data[key])) ? Number(data[key]) : null);
  const attributes = text(data.types).split(/[\n、,，/]/).map((value) => value.trim().replace(/系$/, "")).filter(Boolean);
  return <><header className="ev71-preview-entity ev71-preview-pet"><div className="ev71-preview-portrait">{original?.image ? <img src={image} alt={original.name} /> : <PawPrint size={46} />}</div><div><span className="ev71-preview-eyebrow">图鉴编号 {data.number || "待补"}</span><h2>{data.name || "宠物名称待补"}</h2><div className="ev71-preview-types">{attributes.map((type) => <TypeBadge key={type} type={type} />)}{data.ladderMagic !== "" && data.ladderMagic != null && <span className="rw-cost-badge" title="天梯费用">{data.ladderMagic}</span>}</div></div></header><Details rows={[["组别", data.group], ["系列", data.series], ["经验类型", data.experienceType], ["可拥有的血脉", data.bloodlines], ["身高（米）", data.heightM], ["体重（千克）", data.weightKg], ["颜色", data.color], ["捕捉分类", data.catchCategory]]} /><StatsRadar pets={[{ name: data.name || "待命名宠物", slug: data.slug || "preview-pet", stats }]} showLegend={false} /><Source url={data.sourceUrl} /></>;
}
function PreviewContentBody({ mode, data = {}, context = {}, intent = "edit" }) {
  if (typeof data === "string") data = { markdown: data };
  if (!data || typeof data !== "object") data = {};
  if (mode === "article") return <ReadingMarkdown markdown={data.markdown || ""} context={context} editHeadings={false} className="ev71-preview-article" />;
  if (mode === "acquisition") return <><h2 className="ev7-preview-title">{context.entity} · 获取时间线</h2><AcquisitionTimelineView records={data.records} /></>;
  if (mode === "event") return <><header className="ev71-preview-entity"><CalendarDays size={28} /><div><span className="ev71-preview-eyebrow">活动资料</span><h2>{data.name || "活动名称待补"}</h2></div></header><Prose value={data.summary} context={context} /><h3 className="ev71-preview-subheading">历次开放</h3><AcquisitionTimelineView records={data.occurrences} activity /></>;
  if (mode === "skill" && context.record === "learners") return <SkillLearnersPreview data={data} />;
  if (mode === "skill") return <><header className="ev71-preview-entity"><WandSparkles size={28} /><div><span className="ev71-preview-eyebrow">技能资料</span><h2>{data.name || "技能名称待补"}</h2></div></header><Details rows={[["编号", data.number], ["属性", data.type], ["类别", data.category], ["威力", data.power], ["PP", data.pp], ["先手", data.priority], ["命中说明", data.hit]]} /><SkillRuleReading data={data} context={context} headingLevel={3} /><Source url={data.sourceUrl} /></>;
  if (mode === "matchup") return <div className="ev7-matchup-preview">{(data.records || []).map((row, index) => <article key={row.id || index}><div className="ev7-preview-date"><Swords size={15} />{SCENES[row.scene] || "上场情境待补充"}</div><h3>{context.entity || "当前宠物"} 对阵 {row.opponent || "对手待补"}</h3><p className="ev71-preview-conclusion"><EntityText text={row.conclusion || "结论待填写"} /></p><CounterBloodlineSides record={row} myName={context.entity || "当前宠物"} /><Details rows={[["成立条件", row.conditions], ["限制与例外", row.limitations], ["资料日期", row.recordedAt], ["实测日期", row.testedAt]]} /><p className="ev71-preview-vote-note"><CircleHelp size={14} />这是新结论的阅读预览。公共投票不会在预览中提交，也不会沿用旧版本的支持率。</p><Source url={row.sourceUrl} label={row.sourceLabel} /></article>)}</div>;
  if (mode === "npc") return <><header className="ev71-preview-entity"><UsersRound size={28} /><div><span className="ev71-preview-eyebrow">人物与 NPC</span><h2>{data.name || "人物名称待补"}</h2><p>{data.role}</p></div></header><Details rows={[["别名", data.aliases], ["出现场景", data.location]]} /><Block title="人物介绍" value={data.intro} context={context} /><Block title="提供的服务" value={data.services} context={context} /><Block title="相关任务与剧情" value={data.relatedTasks} context={context} /><Source url={data.sourceUrl} label={data.sourceTitle} /></>;
  if (mode === "pet" && intent === "delete") return <section className="ev71-preview-deletion"><Trash2 size={25} /><h2>「{data.name}」的删除提议</h2><p>提议审核通过并发布后，此宠物条目显示为已移除，其他资料保持原有归属。</p><Block title="提议理由" value={data.deletionReason} context={context} />{safeInternalPath(data.redirectTo, "") && <p>替代条目：<Link to={data.redirectTo}>{data.redirectTo}</Link></p>}<Source url={data.sourceUrl} /></section>;
  if (mode === "pet") return <PetPreview data={data} context={context} />;
  if (mode === "pve-guide") return <PveGuidePreview data={data} context={context} />;
  if (mode === "pve") return <PvePlanCard data={data} />;
  if (mode === "index") return <><h2 className="ev7-preview-title">{intent === "add" ? "新增资料入口" : data.title}</h2>{data.description && <Prose value={data.description} context={context} />}<div className="ev7-index-preview">{(data.entries || []).map((row, index) => <article key={row.id || index}><BookOpen size={20} /><div><strong>{row.title || "入口名称待补"}</strong><p>{row.description || "用途说明待补"}</p>{safeInternalPath(row.href, "") ? <Link to={row.href}>进入条目 <ArrowRight size={13} /></Link> : <small>站内去向待补充</small>}</div></article>)}</div></>;
  if (mode === "relationship") return <><header className="ev71-preview-entity"><Swords size={28} /><div><span className="ev71-preview-eyebrow">效果关系实测</span><h2>{data.sourceEffect || "已有来源"} 与 {data.incomingEffect || "新施加来源"}</h2></div></header><div className="ev71-preview-relationship"><div><small>原有状态来源</small><strong>{data.sourceEffect || "待补充"}</strong></div><div><small>随后施加的来源</small><strong>{data.incomingEffect || "待补充"}</strong></div></div><Details rows={[["施加顺序", data.order], ["结算时点", data.timing], ["核验状态", data.certainty]]} /><Block title="成立条件" value={data.conditions} context={context} /><Block title="观察结果" value={data.result} context={context} /><Block title="复现步骤与对照" value={data.reproduction} context={context} /><Source url={data.sourceUrl} /></>;
  return <p className="ev71-preview-placeholder">此内容类型暂未提供阅读预览。</p>;
}

export default function PreviewContent(props) {
  return <PreviewBoundary scope={`reading-content:${props.mode}`} resetKey={props.data} title="这一节的阅读预览暂时无法展示"><PreviewContentBody {...props} /></PreviewBoundary>;
}

/** Same-origin blank frame; React supplies read-only nodes, never uploaded HTML. */
function ReadPreviewFrameContent({ mode, data, context = {}, intent = "edit", initialWidth = "desktop" }) {
  const [width, setWidth] = useState(initialWidth === "mobile" ? "mobile" : "desktop");
  const [target, setTarget] = useState(null);
  const [height, setHeight] = useState(420);
  const [limited, setLimited] = useState(false);
  const [navigationNotice, setNavigationNotice] = useState("");
  const [frameError, setFrameError] = useState("");
  const [loaded, setLoaded] = useState(0);
  const [reload, setReload] = useState(0);
  const [reloading, setReloading] = useState(false);
  const frame = useRef(null), sizing = useRef(null);
  const titleId = `preview-${useId().replace(/:/g, "")}`;
  const contentName = mode === "skill" && context.record === "learners" ? "技能学习关系" : MODE_NAMES[mode] || "内容";
  useEffect(() => {
    if (!loaded || !frame.current) return;
    let prepared;
    try { prepared = preparePreviewDocument(frame.current, frame.current.ownerDocument); }
    catch (error) { setFrameError(String(error?.message || "无法准备预览页面")); return; }
    if (!prepared) return;
    const { document, root } = prepared;
    setFrameError(""); setTarget(root);
    const subscription = observePreviewSize({
      frame: frame.current, document, root,
      onHeight(next, isLimited) { setHeight((old) => old === next ? old : next); setLimited(isLimited); },
      onError(error) { setFrameError(String(error?.message || "无法测量预览页面")); },
    });
    sizing.current = subscription;
    return () => {
      subscription.dispose();
      if (sizing.current === subscription) sizing.current = null;
    };
  }, [loaded, reload]);
  // Detach the portal in one commit before the next commit replaces its iframe.
  useEffect(() => {
    if (!reloading || target) return;
    setLoaded(0);
    setReload((value) => value + 1);
    setReloading(false);
  }, [reloading, target]);
  useEffect(() => { sizing.current?.schedule(); }, [target, data, width, mode]);
  useEffect(() => { setNavigationNotice(""); }, [mode, context.entity, context.section]);
  function preventPreviewNavigation(event) {
    const link = event.target.closest?.("a");
    if (!link) return;
    event.preventDefault(); event.stopPropagation();
    setNavigationNotice(`链接指向：${link.getAttribute("href") || link.textContent}。可继续留在此处核对预览。`);
  }
  function reloadFrame() { setTarget(null); setFrameError(""); setReloading(true); }
  return <section className="ev71-reading-preview" aria-labelledby={titleId}>
    <div className="ev71-preview-toolbar"><div><h2 id={titleId}><Eye size={19} />修改后的阅读效果</h2><p>展示{contentName}的呈现方式；桌面与手机按各自内容宽度渲染。</p></div><div className="ev71-preview-device" role="group" aria-label="预览内容宽度"><button type="button" aria-pressed={width === "desktop"} onClick={() => setWidth("desktop")}><Monitor size={15} />桌面</button><button type="button" aria-pressed={width === "mobile"} onClick={() => setWidth("mobile")}><Smartphone size={15} />手机</button></div></div>
    {frameError && <div className="rw-local-render-error-v73" role="alert"><CircleHelp size={20} aria-hidden="true" /><div><strong>预览页面遇到了问题</strong><p>当前输入保留在编辑器中。可以重新打开预览，或返回填写界面。</p><button type="button" onClick={reloadFrame}>重新打开预览</button><details><summary>错误信息</summary><pre>{frameError}</pre></details></div></div>}
    <div className="ev71-preview-stage"><div className="ev71-preview-frame" data-preview-width={width}><div className="ev71-preview-page-context"><BookOpen size={13} /><span>{context.entity || data?.name || data?.title || "条目"}{context.section ? ` / ${context.section}` : ""}</span><span>内容预览</span></div>{target && createPortal(<div className="ev71-preview-content" data-readonly-preview="true" onClickCapture={preventPreviewNavigation} onSubmitCapture={(event) => event.preventDefault()}><PreviewContent mode={mode} data={data} context={context} intent={intent} /></div>, target)}<iframe key={reload} ref={frame} srcDoc="<!doctype html><html><head></head><body></body></html>" title={`修改后的${contentName}阅读预览`} className="ev71-preview-iframe" sandbox="allow-same-origin" style={{ height }} onLoad={() => setLoaded((value) => value + 1)} onError={() => setFrameError("预览页面未能载入")} /></div></div>
    {limited && <p className="ev71-preview-navigation">这节内容较长，可以在预览区域内继续滚动阅读。</p>}
    {navigationNotice && <p className="ev71-preview-navigation" role="status">{navigationNotice}</p>}
  </section>;
}

export function ReadPreviewFrame(props) {
  return <PreviewBoundary scope={`reading-frame:${props.mode}`} resetKey={props.data} title="阅读预览暂时无法展示"><ReadPreviewFrameContent {...props} /></PreviewBoundary>;
}
