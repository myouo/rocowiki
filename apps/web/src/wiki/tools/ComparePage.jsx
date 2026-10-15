import React, { useState, useEffect } from "react";
import { useHistory, useLocation } from "@docusaurus/router";
import { Calculator, SlidersHorizontal, ArrowRight } from "lucide-react";
import { Link, PageHeader, Notice, Contribution, EmptyState, TypeBadge, setQuery } from "../core";
import { PetPortrait, usePublishedPets, usePublishedSkills } from "../CatalogPages";
import { petDetailHref, skillDetailHref } from "../catalogPublished";
import StatsRadar from "../StatsRadar";
import CustomSelect from "../Select";
import {matchesCatalogEntry} from '../../../../../packages/wiki-schema/src/catalog-routes';

function MovedToolPage() {
  return (
    <>
      <PageHeader
        title="工具已更新"
        back="/tools/"
        description="这里已迁至新的计算工具。选择要解决的问题，继续查看。"
      />
      <div className="rw-calculator-moved">
        <Link to="/tools/damage/" className="rw-button primary">
          <Calculator size={17} />
          计算伤害
        </Link>
        <Link to="/tools/stats/" className="rw-button">
          <SlidersHorizontal size={17} />
          计算宠物能力
        </Link>
        <Link to="/mechanics/pp/" className="rw-textlink">
          查阅 PP 与技能限制 <ArrowRight size={15} />
        </Link>
      </div>
    </>
  );
}

function ComparePage({ query }) {
  const pets = usePublishedPets().filter((pet) => !pet.deleted);
  const skills = usePublishedSkills();
  const catalogIdentities = pets.map((pet) => pet.slug).join(",");
  const history = useHistory(),
    location = useLocation();
  const param = query.get("pets");
  const normalizeIds = (values) =>
    [...new Set((Array.isArray(values) ? values : [])
      .map(key => pets.find(pet => matchesCatalogEntry('pets', pet, String(key)))?.slug)
      .filter(Boolean))]
      .slice(0, 3);
  const [ids, setIds] = useState(() =>
    normalizeIds((param === null ? "haifu,bishui" : param).split(",")),
  );
  useEffect(() => {
    if (param !== null) setIds(normalizeIds(param.split(",")));
    else
      try {
        const saved = normalizeIds(
          JSON.parse(localStorage.getItem("roco-wiki-v4:compare") || "[]"),
        );
        if (saved.length) setIds(saved);
      } catch {}
  }, [param, catalogIdentities]);
  const set = (values) => {
    const value = normalizeIds(values);
    setIds(value);
    setQuery(history, location, { pets: value.join(",") });
    try {
      localStorage.setItem("roco-wiki-v4:compare", JSON.stringify(value));
    } catch {}
  };
  const selected = ids
    .map((id) => pets.find((p) => p.slug === id))
    .filter(Boolean);
  return (
    <>
      <PageHeader
        title="宠物对比"
        back="/tools/"
        crumbs={[{ label: "实用工具", to: "/tools/" }, { label: "宠物对比" }]}
        description="同一口径下比较基础数据，再回到技能和用途判断。"
      />
      <div className="rw-comparison-selectors">
        {[0, 1, 2].map((i) => (
          <label key={i}>
            <span>宠物 {i + 1}</span>
            <CustomSelect
              ariaLabel={"选择第" + (i + 1) + "只宠物"}
              value={ids[i] || ""}
              onChange={(value) => {
                const n = [...ids];
                if (value) n[i] = value;
                else n.splice(i, 1);
                set(n.filter(Boolean));
              }}
              options={[
                { value: "", label: "添加宠物" },
                ...pets.map((p) => ({
                  value: p.slug,
                  label: p.name,
                  disabled: ids.includes(p.slug) && ids[i] !== p.slug,
                })),
              ]}
              searchable
            />
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <section className="rw-compare-radar-panel">
          <div>
            <h2>六维种族值</h2>
            <p>
              蓝、橙、紫三条轮廓使用同一量尺。点击图例可暂时隐藏一只宠物；准确数值见下表。
            </p>
          </div>
          <StatsRadar pets={selected} showTable={false} />
        </section>
      )}
      {selected.length ? (
        <div className="rw-table-scroll">
          <table className="rw-table rw-compare-table">
            <thead>
              <tr>
                <th>基础资料</th>
                {selected.map((p) => (
                  <th key={p.slug}>
                    <PetPortrait pet={p} />
                    <Link to={petDetailHref(p)}>{p.name}</Link>
                    <small>No. {p.number}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>属性</th>
                {selected.map((p) => (
                  <td key={p.slug}>
                    {p.types.map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </td>
                ))}
              </tr>
              {["精力", "物攻", "物防", "魔攻", "魔抗", "速度", "种族总和"].map(
                (name, i) => {
                  const vals = selected.map((p) =>
                      p.stats
                        ? i === 6
                          ? p.stats.reduce((a, b) => a + b, 0)
                          : p.stats[i]
                        : null,
                    ),
                    max = Math.max(...vals.filter((x) => x !== null));
                  return (
                    <tr key={name}>
                      <th>{name}</th>
                      {selected.map((p, k) => (
                        <td
                          key={p.slug}
                          className={vals[k] === max ? "rw-compare-max" : ""}
                        >
                          {vals[k] ?? "待核实"}
                          {vals[k] === max && selected.length > 1 && (
                            <span className="sr-only">本组最高</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                },
              )}
              <tr>
                <th>重点技能</th>
                {selected.map((p) => (
                  <td key={p.slug}>
                    <div className="rw-compare-skills">
                      {skills.filter((s) => s.ownerSlug === p.slug).length ? (
                        skills
                          .filter((s) => s.ownerSlug === p.slug)
                          .map((s) => (
                            <Link key={s.slug} to={skillDetailHref(s)}>
                              {s.name} <small>+{s.priority}</small>
                            </Link>
                          ))
                      ) : (
                        <span className="rw-muted">完整技能池待补</span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <th>获取情况</th>
                {selected.map((p) => (
                  <td key={p.slug}>
                    <Link to={petDetailHref(p)}>到图鉴核对来源</Link>
                    <small>当前开放状态待核验</small>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="先选择要比较的宠物">
          上方可添加 1–3 只，或从图鉴加入对比。
        </EmptyState>
      )}
      <Notice title="最高数值不等于最强宠物">
        这里只比较来源记录的基础种族值。血脉、技能联动、培养与规则环境要一起考虑。
      </Notice>
      <Contribution entity="宠物对比" />
    </>
  );
}

export { MovedToolPage, ComparePage };
