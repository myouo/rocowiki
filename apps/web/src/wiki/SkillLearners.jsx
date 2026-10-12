import {useDemoSubmissions} from "./community/useDemoSubmissions";
import React, { useEffect, useMemo, useState } from "react";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { ArrowRight, Check, ChevronDown, ExternalLink, PawPrint, Search, Trash2, UsersRound, X } from "lucide-react";
import { pets as sourcePets, skills as sourceSkills } from "./data";
import { petSkillPoolHref, resolvePublishedCatalogPets, resolvePublishedCatalogSkills } from "./catalogPublished";
import { MAX_LEARNER_EDITS, resolveSkillLearners } from "./skillLearnerModel";
import { learningLabel } from "./catalog/skills/learningPresentation";
import "./SkillLearners.css";

const searchPet = (pet, query) => !query || [pet.name, pet.slug, pet.number, ...(pet.aliases || [])].some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
function Portrait({ pet }) {
  const image = useBaseUrl(pet?.image || "");
  return <span className="rw-learner-portrait-v73">{pet?.image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <PawPrint size={23} aria-hidden="true" />}</span>;
}
function SearchField({ value, onChange, label }) {
  return <label className="rw-learner-search-v73"><Search size={15} aria-hidden="true" /><input type="search" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder="宠物名、编号或别名" />{value && <button type="button" aria-label={`清除${label}`} onClick={() => onChange("")}><X size={13} aria-hidden="true" /></button>}</label>;
}

/** The same compact relation reader is used in the public page and edit preview. */
export default function SkillLearners({ skill = {}, pets = [], initialCount = 12 }) {
  const [query, setQuery] = useState(""), [limit, setLimit] = useState(initialCount);
  const result = useMemo(() => resolveSkillLearners({ skill, pets }), [skill, pets]);
  const rows = result.rows.filter((row) => searchPet(row.pet, query.trim().toLocaleLowerCase()));
  function search(value) { setQuery(value); setLimit(initialCount); }
  return <div className="rw-skill-learners-v73" data-skill-learners={skill.slug || skill.name}>
    <div className="rw-learner-toolbar-v73"><p><UsersRound size={16} aria-hidden="true" /><strong>已关联 {result.rows.length} 只宠物</strong><span>按已收录资料整理</span></p><SearchField label="搜索学习宠物" value={query} onChange={search} /></div>
    <div className="rw-learner-grid-v73">{rows.slice(0, limit).map((row) => <article className="rw-learner-card-v73" key={row.pet.slug}>
      <Link className="rw-learner-main-v73" to={petSkillPoolHref(row.pet)}><Portrait pet={row.pet} /><span><small>{row.pet.number ? `No. ${row.pet.number}` : "编号待补"}</small><strong>{row.pet.name}</strong></span><ArrowRight size={14} aria-hidden="true" /></Link>
      <div className="rw-learner-detail-v73"><span>{learningLabel(row.method, row.level)}</span><small>{row.origins.join(" · ")}</small>{row.sources.length > 0 && <span className="rw-learner-sources-v73">{row.sources.map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" title={source.title}>{row.sources.length > 1 ? `来源 ${index + 1}` : "资料来源"} <ExternalLink size={10} aria-hidden="true" /></a>)}</span>}</div>
    </article>)}</div>
    {!rows.length && <p className="rw-learner-empty-v73">{query ? "没有找到对应宠物。试试编号或其他别名。" : "尚未关联已收录宠物，可以通过「编辑学习关系」补充。"}</p>}
    <div className="rw-learner-bottom-v73"><span aria-live="polite">{query ? `搜索结果 ${rows.length} 只` : "未收录学习关系，不表示这只宠物不能学习。"}</span>{rows.length > limit && <button type="button" onClick={() => setLimit((value) => value + initialCount)}>显示更多（还有 {rows.length - limit} 只）<ChevronDown size={13} aria-hidden="true" /></button>}{limit > initialCount && rows.length > initialCount && <button type="button" onClick={() => setLimit(initialCount)}>收起列表</button>}</div>
    {result.unknownOwner && <p className="rw-learner-unresolved-v73">原始资料还提及「{result.unknownOwner}」，目前尚未匹配到已收录图鉴。</p>}
    {result.unresolved.length > 0 && <p className="rw-learner-unresolved-v73">另有 {result.unresolved.length} 条补充关系的宠物暂不可用，请在编辑学习关系中核对。</p>}
  </div>;
}

function useLearnerCatalog(data, submissions) {
  return useMemo(() => {
    const pets = resolvePublishedCatalogPets({ pets: sourcePets, submissions });
    const skills = resolvePublishedCatalogSkills({ skills: sourceSkills, submissions });
    const original = skills.find((row) => row.slug === data.slug || row.name === data.name) || { name: data.name, slug: data.slug };
    return { pets, skill: { ...original, learners: data.learners || [] } };
  }, [data, submissions]);
}

function useReadingSubmissions(provided) { const saved=useDemoSubmissions(); return provided===undefined?saved:provided; }

export function SkillLearnersPreview({ data = {}, submissions }) {
  const catalog = useLearnerCatalog(data, useReadingSubmissions(submissions));
  return <section className="rw-learner-preview-v73"><h3>{catalog.skill.name || "技能"} · 学习宠物</h3><SkillLearners {...catalog} /></section>;
}

export function SkillLearnerFields({ data, onChange, errors = {}, submissions = [] }) {
  const { pets, skill } = useLearnerCatalog(data, submissions);
  const [query, setQuery] = useState(""), [limit, setLimit] = useState(24);
  const rows = Array.isArray(data.learners) ? data.learners : [];
  const base = resolveSkillLearners({ skill, pets, learners: [] });
  const inherited = new Set(base.rows.map((row) => row.pet.slug));
  const selected = new Set(rows.map((row) => row.petSlug));
  const choices = pets.filter((pet) => !pet.deleted && searchPet(pet, query.trim().toLocaleLowerCase()));
  const changeRows = (learners) => onChange({ ...data, learners });
  function toggle(pet) {
    if (selected.has(pet.slug)) changeRows(rows.filter((row) => row.petSlug !== pet.slug));
    else if (rows.length < MAX_LEARNER_EDITS) changeRows([...rows, { petSlug: pet.slug, method: "", level: "", sourceUrl: inherited.has(pet.slug) ? pet.sourceUrl || skill.source || "" : "", sourceTitle: "" }]);
  }
  function field(row, index, key, label, attributes = {}) {
    const error = errors[`learners.${index}.${key}`];
    return <label className="rw-learner-field-v73"><span>{label}</span><input aria-label={`${pets.find((pet) => pet.slug === row.petSlug)?.name || row.petSlug} · ${label}`} value={row[key] ?? ""} onChange={(event) => changeRows(rows.map((entry, position) => position === index ? { ...entry, [key]: event.target.value } : entry))} aria-invalid={Boolean(error)} {...attributes} />{error && <small role="alert">{error}</small>}</label>;
  }
  return <div className="rw-learner-editor-v73">
    <h3 className="ev7-subtitle">{skill.name} · 学习关系</h3>
    <p className="rw-learner-editor-note-v73">宠物技能池等原始资料已关联 {base.rows.length} 只宠物，这些关系会自动保留。在这里选择多只宠物，补充学习方式、等级和来源；未知方式或等级留空。</p>
    <div className="rw-learner-picker-v73"><div className="rw-learner-toolbar-v73"><strong>选择要补充的宠物</strong><SearchField label="搜索可关联宠物" value={query} onChange={(value) => { setQuery(value); setLimit(24); }} /></div><div className="rw-learner-options-v73">{choices.slice(0, limit).map((pet) => <button type="button" role="checkbox" aria-checked={selected.has(pet.slug)} aria-label={`补充 ${pet.name} 的学习关系`} disabled={!selected.has(pet.slug) && rows.length >= MAX_LEARNER_EDITS} onClick={() => toggle(pet)} key={pet.slug}><span className="rw-learner-check-v73"><Check size={12} aria-hidden="true" /></span><Portrait pet={pet} /><span><strong>{pet.name}</strong><small>{inherited.has(pet.slug) ? "已有技能池／原始关联" : "新增学习关系"}</small></span></button>)}</div>{!choices.length && <p className="rw-learner-empty-v73">未找到已收录宠物。</p>}{choices.length > limit && <button type="button" className="rw-learner-more-v73" onClick={() => setLimit((value) => value + 24)}>显示更多候选</button>}</div>
    <div className="rw-learner-edit-records-v73">{rows.map((row, index) => {
      const pet = pets.find((entry) => entry.slug === row.petSlug), name = pet?.name || row.petSlug;
      return <fieldset key={row.petSlug || index}><legend>{name}</legend><div className="rw-learner-record-head-v73"><span>{inherited.has(row.petSlug) ? "移除本条补充后，原有技能池关系仍保留。" : "这是一条额外的学习关系。"}</span><button type="button" aria-label={`移除 ${name} 的关联补充`} onClick={() => changeRows(rows.filter((_, position) => position !== index))}><Trash2 size={13} aria-hidden="true" />移除补充</button></div>{errors[`learners.${index}.petSlug`] && <p className="ev7-error" role="alert">{errors[`learners.${index}.petSlug`]}</p>}<div className="rw-learner-field-grid-v73">{field(row, index, "method", "学习方式（可选）", { placeholder: "例如升级、技能石；未知留空", maxLength: 200 })}{field(row, index, "level", "学习等级（可选）", { type: "number", min: 1, max: 100, step: 1, placeholder: "未知留空" })}{field(row, index, "sourceUrl", "来源链接", { type: "url", placeholder: "https://", required: true })}{field(row, index, "sourceTitle", "来源名称（可选）", { maxLength: 200 })}</div></fieldset>;
    })}</div>
    {errors.learners && <p className="ev7-error" role="alert">{errors.learners}</p>}
    {!rows.length && <p className="rw-learner-editor-note-v73">尚未选中补充项。上方可以同时选择多只宠物，预览会合并展示现有关系。</p>}
    {rows.length >= MAX_LEARNER_EDITS && <p className="rw-learner-editor-note-v73">本次已达到 {MAX_LEARNER_EDITS} 条补充关系上限。原始技能池的聚合与查阅不受这个上限影响。</p>}
  </div>;
}
