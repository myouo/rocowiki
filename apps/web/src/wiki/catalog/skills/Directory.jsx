import CustomSelect from "../../Select";
import QueryInput from "../../QueryInput";
import { availableSkillSortFields, sortCatalogSkills } from "../../skillPresentation";
import EditEntry from "../../editing/EditEntry";
import React from "react";
import { useHistory, useLocation } from "@docusaurus/router";
import { Search, ArrowUp, ArrowDown } from "lucide-react";
import { PageHeader, Notice, EmptyState, Contribution, Subnav, setQuery } from "../../core";
import { SkillPage } from "./Detail.jsx";
import { usePublishedSkills } from "../hooks.js";
import { SkillTable } from "../components.jsx";
import { useHydratedSearch } from '../pets/useHydratedSearch';
import SkillList from './SkillList';
import { officialSkillData } from '../../content/bundled.js';
import { skillCollection } from './officialModel';

function SkillsPage({ query }) {
  const location = useLocation();
  const search = useHydratedSearch(location.search);
  const params = query || new URLSearchParams(search);
  const entry = params.get('entry');
  return entry ? <SkillPage slug={entry} /> : <SkillCatalogPage query={params} />;
}

function SkillCatalogPage({ query }) {
  const skills = usePublishedSkills();
  const history = useHistory(),
    location = useLocation(),
    q = query;
  const term = q.get("q") || "",
    kind = q.get("kind") || "",
    effect = q.get("effect") || "";
  const collection = ['all', 'placeholder'].includes(q.get('collection')) ? q.get('collection') : 'regular';
  const collections = [
    { value: 'regular', label: '技能条目', count: skills.filter(skill => skillCollection(skill) === 'regular').length },
    { value: 'placeholder', label: '资料待定', count: skills.filter(skill => skillCollection(skill) === 'placeholder').length },
    { value: 'all', label: '全部资料', count: skills.length },
  ];
  const sortFields = availableSkillSortFields(skills);
  const sort = sortFields.some((field) => field.value === q.get("sort")) ? q.get("sort") : 'number';
  const direction = q.get('order') === 'asc' ? 'asc' : q.get('order') === 'desc' ? 'desc' : sort === 'name' ? 'asc' : 'desc';
  const result = sortCatalogSkills(skills.filter(
    (s) =>
      (collection === 'all' || skillCollection(s) === collection) &&
      (!term || [s.name, s.number, s.owner, ...(s.ownerNames || []), s.summary].join(' ').toLowerCase().includes(term.toLowerCase())) &&
      (!kind || s.category === kind) &&
      (!effect || s.tags.includes(effect)),
  ), sort, direction);
  const effectList = [
    "防控",
    "回复PP",
    "删除PP",
    "条件必中",
    "连续回合",
    "环境",
  ];
  return (
    <>
      <PageHeader
        title="技能查询"
        description="从技能名称或机制出发，查参数、条件与学习宠物。"
        eyebrow="SKILLS & INTERACTIONS"
        actions={
          <EditEntry
            entity="技能查询"
            section="技能目录"
            mode="skill"
            returnTo="/skills/"
            intent="add"
            label="新增技能"
          />
        }
      />
      <Subnav
        current="/skills/"
        items={[
          ["/skills/", "技能查询"],
          ["/bloodlines/", "血脉资料"],
        ]}
      />
      <div className="rw-pet-collections" role="group" aria-label="技能收录类别">
        {collections.map(item => <button key={item.value} type="button" aria-pressed={collection === item.value} onClick={() => setQuery(history, location, { collection: item.value === 'regular' ? null : item.value })}>{item.label} <span>{item.count}</span></button>)}
      </div>
      {collection === 'placeholder' && <p className="rw-pet-collection-note">这些名称及描述仍为源表占位内容，保留配置原文供核对。</p>}
      <div className="rw-filterbox">
        <div className="rw-filtertop">
          <label className="rw-input-icon">
            <Search size={17} />
            <QueryInput
              value={term}
              onValueChange={(value) =>
                setQuery(history, location, { q: value })
              }
              aria-label="搜索技能或学习宠物"
              placeholder="技能名称 / 学习宠物"
            />
          </label>
          <CustomSelect
            ariaLabel="技能类别"
            value={kind}
            onChange={(value) => setQuery(history, location, { kind: value })}
            options={[
              { value: "", label: "全部类别" },
              ...["物理", "魔法", "变化"].map((value) => ({
                value,
                label: value,
              })),
            ]}
          />
        </div>
        <div className="rw-filterchips">
          <span>效果</span>
          <button
            className={!effect ? "active" : ""}
            onClick={() => setQuery(history, location, { effect: null })}
          >
            全部
          </button>
          {effectList.map((t) => (
            <button
              className={effect === t ? "active" : ""}
              key={t}
              onClick={() =>
                setQuery(history, location, { effect: t === effect ? null : t })
              }
            >
              {t.replace("PP", " PP")}
            </button>
          ))}
        </div>
      </div>
      <div className="rw-results-meta">
        <span>
          找到 <b>{result.length}</b> 个技能
        </span>
        <div className="rw-catalog-sort-v6 rw-skill-sort-v72">
          <label><span>排序</span><CustomSelect ariaLabel="技能排序字段" value={sort} options={sortFields} onChange={(value) => setQuery(history, location, { sort: value, order: direction })} /></label>
          <button type="button" className="rw-sort-direction-v6" aria-label={"技能当前" + (direction === "asc" ? "升序，切换降序" : "降序，切换升序")} onClick={() => setQuery(history, location, { order: direction === "asc" ? "desc" : "asc" })}>{direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}{direction === "asc" ? "升序" : "降序"}</button>
        </div>
      </div>
      <p className="rw-catalog-key-v6">官方技能表 {officialSkillData.skills.length} 条，采集于 {officialSkillData.source.retrievedAt.slice(0, 10)}。先手值直接读取官方配置；学习关系按各自来源整理。</p>
      {result.length ? (
        <SkillList items={result} scope={q.toString()} renderTable={items => <SkillTable items={items} />} />
      ) : (
        <EmptyState
          action={
            <button
              className="rw-button"
              onClick={() => setQuery(history, location, { q: null, kind: null, effect: null })}
            >
              清除条件
            </button>
          }
        />
      )}
      <div className="rw-callout-grid">
        <Notice title="按效果查宠物">
          进入技能详情，查看已关联的学习宠物。未收录学习关系不会显示成“没有宠物会”。
        </Notice>
        <Notice title="先手与命中有条件">
          列表显示官方先手值；战斗中的修正与条件必中在详情解释。
        </Notice>
      </div>
      <Contribution
        entity="技能查询"
        source="https://news.4399.com/luoke/jinengsearch/"
      />
    </>
  );
}

export { SkillsPage };
