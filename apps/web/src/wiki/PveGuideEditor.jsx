import React, { useEffect, useId, useRef, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, MapPin, Gem, Swords, ExternalLink, CalendarDays, ChevronRight, Check } from "lucide-react";
import CustomSelect from "./Select";
import EntityTextarea from "./EntityTextarea";
import ReadingMarkdown from "./editing/ReadingMarkdown";
import { PVE_CATEGORIES, PVE_DIFFICULTIES, pveDifficultyDetails, pveEditableSections } from "./pvePublished";
import SevenSanctuaries from "./SevenSanctuaries";

const goalOptions = [["progress", "推进关卡"], ["pets", "获取宠物"], ["equipment", "取得装备"], ["training", "培养资源"]];
const text = value => typeof value === "string" ? value : "";
function sourceUrl(value) { try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ""; } catch { return ""; } }
function contextQuery(context) { try { return new URL(context?.returnTo || "/", "https://wiki.invalid").searchParams; } catch { return new URLSearchParams(); } }
function scrollToSection(node, smooth = true) { node?.scrollIntoView?.({behavior:smooth && !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "smooth" : "auto",block:"start"}); }

function DifficultyFields({ row, rowChange, initialDifficulty = "hard" }) {
  const [mode,setMode] = useState(initialDifficulty);
  const details = pveDifficultyDetails(row.difficultyDetails);
  const label = PVE_DIFFICULTIES.find(item => item.value === mode)?.label || "困难";
  const change = (key,value) => rowChange("difficultyDetails",{...details,[mode]:{...details[mode],[key]:value}});
  return <div className="pv72-difficulty-editor" data-difficulty-editor={row.id}>
    <div className="pv72-difficulty-tabs" role="group" aria-label={`${row.title || "本曜"}的资料难度`}>{PVE_DIFFICULTIES.map(item => <button key={item.value} type="button" aria-pressed={mode === item.value} onClick={() => setMode(item.value)}><span>{item.label}</span>{(details[item.value].bosses || details[item.value].rewards) && <Check size={12} aria-label="已有补充" />}</button>)}</div>
    <p className="pv72-field-note">正在填写{label}难度。其他难度独立保存；未知内容可留空，不会沿用相邻难度。</p>
    <div className="pv72-fields-grid"><label>{label} · 挑战 BOSS / NPC<EntityTextarea value={details[mode].bosses} onChange={value => change("bosses",value)} ariaLabel={`${row.title} ${label}挑战对象`} rows={3} placeholder="用 / 关联宠物或 NPC，并注明对手配置" /></label><label>{label} · 奖励与数量<EntityTextarea value={details[mode].rewards} onChange={value => change("rewards",value)} ariaLabel={`${row.title} ${label}奖励`} rows={3} placeholder="记录本次核对的数量、领取条件与奖励形式" /></label></div>
  </div>;
}

export function PveGuideFields({ data = {}, onChange, errors = [], context = {} }) {
  const rows = pveEditableSections(data);
  const isSeven = data.id === "seven-sanctuaries";
  const query = contextQuery(context), requested = query.get("view");
  const initialDifficulty = PVE_DIFFICULTIES.some(row => row.value === query.get("difficulty")) ? query.get("difficulty") : "hard";
  const rowRefs = useRef(new Map());
  useEffect(() => { if (requested) scrollToSection(rowRefs.current.get(requested),false); },[requested]);
  const change = (key, value) => onChange({ ...data, [key]: value });
  const rowChange = (index, key, value) => change("sections", rows.map((row, i) => i === index ? {...row, [key]: value} : row));
  const move = (index, direction) => {
    const next = [...rows], target = index + direction;
    if (target < 0 || target >= rows.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    change("sections", next);
  };
  return <div className="pv72-guide-editor">
    <p className="pv72-editor-intro">维护玩法名称、入口、关卡、挑战对象和奖励；配队与出招步骤单独添加为挑战方案。{isSeven && "七曜的位置固定，每个曜的简单、普通、困难资料分别保存。"}</p>
    <div className="pv72-fields-grid">
      <label>玩法名称<input value={text(data.name)} onChange={event => change("name", event.target.value)} placeholder="游戏内的正式名称" /></label>
      <label>玩法类别<CustomSelect ariaLabel="玩法类别" value={data.category || "关卡挑战"} options={PVE_CATEGORIES} onChange={value => change("category", value)} /></label>
      <label className="is-wide">一句话简介<EntityTextarea value={text(data.summary)} onChange={value => change("summary", value)} ariaLabel="玩法简介" rows={2} /></label>
      <label className="is-wide">游戏内入口<EntityTextarea value={text(data.entrance)} onChange={value => change("entrance", value)} ariaLabel="游戏内入口" rows={2} placeholder="场景 → 入口 → 玩法；页游和 LITE 可分别写一行" /></label>
      <label>开放与重置安排<input value={text(data.cadence)} onChange={event => change("cadence", event.target.value)} placeholder="每日 / 每周 / 限定日期；未知可留空" /></label>
      <label>主要奖励<input value={text(data.rewardSummary)} onChange={event => change("rewardSummary", event.target.value)} placeholder="例如：努力值果实、装备" /></label>
    </div>
    <fieldset className="pv72-goal-options"><legend>读者可以按哪些目标找到它？</legend>{goalOptions.map(([value,label]) => <label key={value}><input type="checkbox" checked={(data.goals || []).includes(value)} onChange={event => change("goals", event.target.checked ? [...(data.goals || []),value] : (data.goals || []).filter(goal => goal !== value))} />{label}</label>)}</fieldset>
    <div className="pv72-section-editor-heading"><h3>{isSeven ? "七曜与各档难度" : "分区与关卡"}</h3>{!isSeven && <button type="button" className="rw-button" disabled={rows.length >= 40} onClick={() => change("sections", [...rows, {id: `stage-${Date.now().toString(36)}-${rows.length}`,title:"",bosses:"",rewards:"",conditions:""}])}><Plus size={15} />添加分区</button>}</div>
    {!rows.length && <p className="pv72-editor-empty">添加第一个分区，再填写挑战谁、获得什么，以及参与条件。</p>}
    {rows.map((row,index) => <fieldset className={`pv72-section-editor ${row.id === requested ? "is-selected" : ""}`} key={row.id || index} ref={node => { if(node) rowRefs.current.set(row.id,node); else rowRefs.current.delete(row.id); }} data-pve-edit-stage={row.id}>
      <legend>分区 {index + 1} · {row.title || "未命名"}</legend>
      {!isSeven && <div className="pv72-section-toolbar"><button type="button" disabled={index === 0} onClick={() => move(index,-1)} aria-label={`上移分区 ${index + 1}`}><ArrowUp size={14} /></button><button type="button" disabled={index === rows.length - 1} onClick={() => move(index,1)} aria-label={`下移分区 ${index + 1}`}><ArrowDown size={14} /></button><button type="button" onClick={() => change("sections", rows.filter((_,i) => i !== index))}><Trash2 size={14} />删除此分区</button></div>}
      <label>分区 / 层数名称<input value={text(row.title)} onChange={event => rowChange(index,"title",event.target.value)} /></label>
      {isSeven ? <>
        <DifficultyFields row={row} rowChange={(key,value) => rowChange(index,key,value)} initialDifficulty={initialDifficulty} />
        <details className="pv72-general-notes"><summary>本曜综合备注（不自动适用于每个难度）</summary><div className="pv72-fields-grid"><label>综合对手备注<EntityTextarea value={text(row.bosses)} onChange={value => rowChange(index,"bosses",value)} ariaLabel={`${row.title}综合对手备注`} rows={2} /></label><label>综合奖励备注<EntityTextarea value={text(row.rewards)} onChange={value => rowChange(index,"rewards",value)} ariaLabel={`${row.title}综合奖励备注`} rows={2} /></label></div></details>
      </> : <div className="pv72-fields-grid"><label>挑战 BOSS / NPC<EntityTextarea value={text(row.bosses)} onChange={value => rowChange(index,"bosses",value)} ariaLabel={`分区 ${index + 1} 挑战对象`} rows={3} placeholder="用 / 关联宠物或 NPC，未核对可留空" /></label><label>奖励与数量<EntityTextarea value={text(row.rewards)} onChange={value => rowChange(index,"rewards",value)} ariaLabel={`分区 ${index + 1} 奖励`} rows={3} placeholder="注明难度、首通或日常奖励" /></label></div>}
      <label>解锁与参与条件<EntityTextarea value={text(row.conditions)} onChange={value => rowChange(index,"conditions",value)} ariaLabel={`分区 ${index + 1} 条件`} rows={3} /></label>
    </fieldset>)}
    <div className="pv72-fields-grid"><label className="is-wide">资料来源链接<input type="url" value={text(data.sourceUrl)} onChange={event => change("sourceUrl",event.target.value)} placeholder="https://" /></label><label>来源名称<input value={text(data.sourceTitle)} onChange={event => change("sourceTitle",event.target.value)} /></label><label>资料核对日期<input type="date" value={text(data.checkedAt)} onChange={event => change("checkedAt",event.target.value)} /></label></div>
    {errors.length > 0 && <p className="pv72-field-note">请按上方校验提示补充必填项。未知的挑战对象和奖励不必猜测。</p>}
  </div>;
}

export function PveGuidePreview({ data = {}, context = {}, onSelectSection }) {
  const source = sourceUrl(data.sourceUrl);
  const rows = pveEditableSections(data), query = contextQuery(context);
  const requested = query.get("view"), route = context.returnTo || "";
  const [choice,setChoice] = useState(null), refs = useRef(new Map()), scrollPending = useRef(false);
  const prefix = "pve-preview-" + useId().replace(/[^\w-]/g, "");
  const selected = rows.some(row => row.id === choice?.id) && choice.route === route ? choice.id : rows.find(row => row.id === requested)?.id || rows[0]?.id;
  const isSeven = data.id === "seven-sanctuaries";
  useEffect(() => {if ((requested && requested === selected) || scrollPending.current) {scrollToSection(refs.current.get(selected));scrollPending.current=false;}},[selected,requested,route]);
  function select(id) {scrollPending.current=true;setChoice({id,route});onSelectSection?.(id);if(id === selected) {scrollToSection(refs.current.get(id));scrollPending.current=false;}}
  return <div className="pv72-guide-preview" data-pve-guide-preview data-no-editor>
    <header><span className="rw-badge violet">{text(data.category) || "PVE 玩法"}</span><h2>{text(data.name) || "新玩法"}</h2><ReadingMarkdown editHeadings={false} markdown={text(data.summary)} context={context} /></header>
    <div className="pv72-guide-summary"><div><MapPin size={18} /><section><h3>游戏内入口</h3><ReadingMarkdown editHeadings={false} markdown={text(data.entrance) || "待补充"} context={context} /></section></div><div><CalendarDays size={18} /><section><h3>开放安排</h3><p>{text(data.cadence) || "待补充"}</p></section></div><div><Gem size={18} /><section><h3>奖励目标</h3><p>{text(data.rewardSummary) || "详见分区奖励"}</p></section></div></div>
    {isSeven ? <SevenSanctuaries preview query={query} guide={{slug:data.id,name:data.name,localSource:{checkedAt:data.checkedAt},sections:rows.map(row => ({value:row.id,title:row.title,bosses:row.bosses,rewards:row.rewards,body:row.conditions,difficultyDetails:row.difficultyDetails}))}} /> : <>
    {rows.length > 0 && <nav className="pv72-guide-section-nav" aria-label="选择玩法分区">{rows.map((row,index) => <button key={row.id || index} type="button" aria-pressed={selected === row.id} aria-controls={`${prefix}-${row.id || index}`} data-pve-select-stage={row.id} onClick={() => select(row.id)}><span>{String(index + 1).padStart(2,"0")}</span><strong>{text(row.title) || `分区 ${index + 1}`}</strong><ChevronRight size={14} /></button>)}</nav>}
    <div className="pv72-guide-stage-list">{rows.map((row,index) => <article key={row.id || index} id={`${prefix}-${row.id || index}`} data-pve-preview-stage={row.id} className={selected === row.id ? "is-selected" : ""} ref={node => {if(node) refs.current.set(row.id,node);else refs.current.delete(row.id);}}><h3>{text(row.title) || `分区 ${index + 1}`}{selected === row.id && <span className="pv72-selected-stage-label"><Check size={12} />当前分区</span>}</h3>
      <div className="pv72-boss-reward-grid"><section><h4><Swords size={16} />挑战对象</h4><ReadingMarkdown editHeadings={false} markdown={text(row.bosses) || "BOSS / NPC 名称待核对"} context={context} /></section><section><h4><Gem size={16} />奖励</h4><ReadingMarkdown editHeadings={false} markdown={text(row.rewards) || "数量与领取条件待核对"} context={context} /></section></div>
      {row.conditions && <div className="pv72-stage-conditions"><h4>参与条件</h4><ReadingMarkdown editHeadings={false} markdown={text(row.conditions)} context={context} /></div>}</article>)}</div></>}
    <p className="pv72-guide-source">{source ? <a href={source} target="_blank" rel="noreferrer">{text(data.sourceTitle) || "查看资料来源"}<ExternalLink size={12} /></a> : <span>来源待补充</span>}<span>核对于 {text(data.checkedAt) || "待补充"}</span></p>
  </div>;
}
