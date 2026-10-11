import CustomSelect from "../../Select";
import EditEntry from "../../editing/EditEntry";
import { petMetadata, officialPetData } from "../../content/bundled.js";
import { weekly } from "../../content/bundled.js";
import React, { useState, useEffect, useRef } from "react";
import { useHistory, useLocation } from "@docusaurus/router";
import { Search, ArrowRight, X, GitCompareArrows, Swords, ArrowUp, ArrowDown } from "lucide-react";
import { Link, Badge, PageHeader, EmptyState, Contribution, setQuery } from "../../core";
import { PetPage } from "./Detail.jsx";
import { UNKNOWN, catalogTypes, compareCatalogPets, matchesCatalogMetadata, normalType, petMeta, sortFields } from "../model.js";
import { usePublishedPets } from "../hooks.js";
import { AttributeBadge, PetCard } from "../components.jsx";
import { PetFeed } from "./PetFeed";
import { collectionRank, petCollection, petFeedScope, petHrefWithReturnTo, readPetCollection, requestedPetCount } from "./feedModel";
import { petCatalogHref } from "./officialModel";
import { useHydratedSearch } from "./useHydratedSearch";

function PetsPage({ query }) {
  const location = useLocation();
  const search = useHydratedSearch(location.search);
  const params = query || new URLSearchParams(search);
  const entry = params.get("entry");
  return entry ? <PetPage slug={entry} /> : <PetCatalogPage query={params} />;
}

function PetCatalogPage({ query }) {
  const pets = usePublishedPets().filter((pet) => !pet.deleted);
  const history = useHistory(),
    location = useLocation();
  const q = query,
    term = q.get("q") || "",
    type = q.get("type") || "",
    sort = sortFields.some((field) => field.value === q.get("sort"))
      ? q.get("sort")
      : "number",
    typeMode = q.get("typeMode") || "any";
  const direction =
    q.get("order") === "desc"
      ? "desc"
      : q.get("order") === "asc"
        ? "asc"
        : sort === "name"
          ? "asc"
          : "desc";
  const collection = readPetCollection(q.get("collection"));
  const collections = [
    { value: "regular", label: "图鉴条目", count: pets.filter(p => petCollection(p) === "regular").length },
    { value: "placeholder", label: "资料待定", count: pets.filter(p => petCollection(p) === "placeholder").length },
    { value: "internal", label: "特殊编号", count: pets.filter(p => petCollection(p) === "internal").length },
    { value: "all", label: "全部资料", count: pets.length },
  ];
  const group = q.get("group") || "",
    series = q.get("series") || "",
    experience = q.get("experience") || "",
    bloodline = q.get("bloodline") || "",
    magic = q.get("magic") || "";
  const metadataFilters = {
    group,
    series,
    experienceType: experience,
    bloodlines: bloodline,
    magic,
  };
  const pvp = q.get("pvp") === "type";
  const period =
    weekly.pvp.typeTournament.periods.find(
      (p) => p.startDate === q.get("period"),
    ) || weekly.pvp.typeTournament.periods[0];
  const [compare, setCompare] = useState([]),
    [message, setMessage] = useState("");
  /** @type {import('react').RefObject<import('./PetFeed').PetFeedHandle | null>} */
  const feed = useRef(null);
  const changeFilters = (changes) => setQuery(history, location, { ...changes, page: null, loaded: null });
  useEffect(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("roco-wiki-v4:compare") || "[]",
      );
      setCompare(
        Array.isArray(value)
          ? [...new Set(value)]
              .filter((id) => pets.some((p) => p.slug === id))
              .slice(0, 3)
          : [],
      );
    } catch {}
  }, []);
  function toggle(slug) {
    if (!compare.includes(slug) && compare.length >= 3) {
      setMessage("已选满 3 只，请先移除一只再添加。");
      return;
    }
    const next = compare.includes(slug)
      ? compare.filter((x) => x !== slug)
      : [...compare, slug];
    setCompare(next);
    setMessage("");
    try {
      localStorage.setItem("roco-wiki-v4:compare", JSON.stringify(next));
    } catch {
      setMessage("当前选择可用，但无法保存在本机。");
    }
  }
  let result = pets.filter(
    (p) =>
      (collection === "all" || petCollection(p) === collection) &&
      (!type ||
        (typeMode === "primary"
          ? normalType(p.types[0]) === normalType(type)
          : p.types.map(normalType).includes(normalType(type)))) &&
      (!term ||
        [p.name, p.number, ...p.aliases]
          .join(" ")
          .toLowerCase()
          .includes(term.toLowerCase())) &&
      matchesCatalogMetadata(p, metadataFilters) &&
      (!pvp ||
        (period.types.includes(p.types[0]) &&
          !period.bannedPets.some(
            (b) =>
              b.name === p.name || (b.number !== null && b.number === p.number),
          ))),
  );
  result = [...result].sort((a, b) =>
    collectionRank(a) - collectionRank(b) || compareCatalogPets(a, b, sort, direction),
  );
  const scope = petFeedScope(q);
  const requested = requestedPetCount(q, result.length);
  const returnParams = new URLSearchParams(scope);
  for (const key of ["loaded", "page"]) if (q.has(key)) returnParams.set(key, q.get(key));
  const returnTo = "/pets/" + (returnParams.size ? "?" + returnParams.toString() : "");
  const valuesFor = (key) =>
    [
      ...new Set(
        pets.flatMap((p) => {
          const value =
            key === "magic" ? petMeta(p).ladderMagic?.value : petMeta(p)[key];
          return value == null ? [] : Array.isArray(value) ? value : [value];
        }),
      ),
    ].sort((a, b) =>
      typeof a === "number" ? a - b : a.localeCompare(b, "zh-CN"),
    );
  const fieldOptions = (key, title, values = valuesFor(key)) => [
    { value: "", label: "全部" + title },
    ...values.map((value) => ({
      value: String(value),
      label: String(value) + (key === "magic" ? " 点" : ""),
    })),
    { value: UNKNOWN, label: title + "待核" },
  ];
  const facets = [
    {
      key: "group",
      label: "组别",
      value: group,
      options: fieldOptions("group", "组别", petMetadata.fieldModel.groups),
    },
    {
      key: "series",
      label: "系列",
      value: series,
      options: fieldOptions("series", "系列"),
    },
    {
      key: "experience",
      label: "经验类型",
      value: experience,
      options: fieldOptions("experienceType", "经验类型"),
    },
    {
      key: "bloodline",
      label: "血脉",
      value: bloodline,
      options: [
        { value: "", label: "全部血脉" },
        { value: "recorded", label: "已收录血脉" },
        ...valuesFor("bloodlines").map((value) => ({
          value,
          label: value,
          group: "已知名称",
        })),
        { value: UNKNOWN, label: "血脉待核", group: "资料状态" },
      ],
    },
    {
      key: "magic",
      label: "天梯魔力值",
      value: magic,
      options: fieldOptions("magic", "魔力值"),
    },
  ];
  const activeFacets = facets.filter((field) => field.value);
  const reset = () =>
    setQuery(history, location, {
      q: null,
      type: null,
      typeMode: null,
      pvp: null,
      period: null,
      group: null,
      series: null,
      experience: null,
      bloodline: null,
      magic: null,
      page: null,
      loaded: null,
    });
  return (
    <div className="rw-pets-v5 rw-catalog-v6">
      <PageHeader
        title="宠物图鉴"
        description="按名称、属性和培养资料找到宠物，进入图鉴查技能、获取记录与对局条件。"
        crumbs={[{ label: "Wiki", to: "/" }, { label: "宠物图鉴" }]}
        actions={
          <>
            <Link to="/tools/compare/" className="rw-button">
              <GitCompareArrows size={16} />
              种族值对比
            </Link>
            <EditEntry
              entity="宠物图鉴"
              section="新增宠物"
              mode="pet"
              returnTo="/pets/"
              intent="add"
              label="新增宠物"
            />
          </>
        }
      />
      <div className="rw-catalog-tabs">
        <strong>
          收录资料 <span>{pets.length}</span>
        </strong>
        <div>
          <Link to="/skills/">
            技能反查 <ArrowRight size={13} />
          </Link>
          <Link to="/guides/training/">
            培养资料 <ArrowRight size={13} />
          </Link>
        </div>
      </div>
      <div className="rw-pet-collections" role="group" aria-label="收录类别">
        {collections.map(item => <button key={item.value} type="button" aria-pressed={collection === item.value} onClick={() => changeFilters({ collection: item.value === "regular" ? null : item.value })}>
          {item.label} <span>{item.count}</span>
        </button>)}
      </div>
      <p className="rw-subnote">
        官方图鉴基础资料采集于 {officialPetData.source.retrievedAt.slice(0, 10)}。
        技能、血脉与活动记录按各自来源补充。
      </p>
      {collection === "placeholder" && <p className="rw-pet-collection-note">名称或说明仍为占位内容，尚未确认正式发布；条目保留官方配置原文。</p>}
      {collection === "internal" && <p className="rw-pet-collection-note">这些源表特殊编号与普通图鉴分开展示，请核对具体形态与适用数据。</p>}
      {pvp && (
        <div className="rw-pvp-filter-note">
          <Swords size={21} />
          <div>
            <strong>
              系别赛 · {period.startDate.slice(5).replace("-", ".")} 起的名单
            </strong>
            <p>
              仅展示主属性匹配“{period.types.join("、")}
              ”、且未列入该期禁赛的收录宠物。等级、满血与完整阵容等参赛条件仍需核对。
            </p>
          </div>
          <button
            className="rw-small-button"
            onClick={() => changeFilters({ pvp: null, period: null })}
          >
            移除赛事条件 <X size={14} />
          </button>
        </div>
      )}
      <section className="rw-catalog-filter" aria-label="宠物筛选">
        <div className="rw-filtertop">
          <label className="rw-input-icon">
            <Search size={18} />
            <input
              value={term}
              onChange={(e) =>
                changeFilters({ q: e.target.value })
              }
              aria-label="筛选宠物"
              placeholder="输入宠物名、图鉴编号或别名"
            />
          </label>
          <label className="rw-catalog-type-mode">
            属性口径
            <CustomSelect
              ariaLabel="属性筛选口径"
              value={typeMode}
              onChange={(value) =>
                changeFilters({ typeMode: value })
              }
              options={[
                { value: "any", label: "主属性或副属性" },
                { value: "primary", label: "仅主属性" },
              ]}
            />
          </label>
        </div>
        <div className="rw-filterchips">
          <span>属性</span>
          <button
            className={!type ? "active" : ""}
            aria-pressed={!type}
            onClick={() => changeFilters({ type: null })}
          >
            全部
          </button>
          {catalogTypes.map((t) => (
            <button
              key={t}
              className={type === t ? "active" : ""}
              aria-pressed={type === t}
              onClick={() =>
                changeFilters({ type: type === t ? null : t })
              }
            >
              <AttributeBadge type={t} />
            </button>
          ))}
        </div>
        <div className="rw-catalog-facets-v6">
          {facets.map((field) => (
            <label className="rw-catalog-facet-v6" key={field.key}>
              <span>{field.label}</span>
              <CustomSelect
                ariaLabel={field.label + "筛选"}
                value={field.value}
                options={field.options}
                searchable={field.key === "group" || field.key === "bloodline"}
                onChange={(value) =>
                  changeFilters({ [field.key]: value || null })
                }
              />
            </label>
          ))}
        </div>
        {(type || term || pvp || activeFacets.length > 0) && (
          <div className="rw-activefilters">
            <span>已选条件</span>
            {type && (
              <Badge>
                {typeMode === "primary" ? "主属性" : "属性"}：{type}
              </Badge>
            )}
            {term && <Badge>{term}</Badge>}
            {pvp && <Badge>系别赛 {period.startDate.slice(5)}</Badge>}
            {activeFacets.map((field) => (
              <button
                key={field.key}
                className="rw-filter-token-v6"
                aria-label={"移除" + field.label + "筛选"}
                onClick={() =>
                  changeFilters({ [field.key]: null })
                }
              >
                {field.label}：
                {field.options.find((option) => option.value === field.value)
                  ?.label || field.value}
                <X size={12} />
              </button>
            ))}
            <button onClick={reset}>
              清除筛选 <X size={13} />
            </button>
          </div>
        )}
      </section>
      <div className="rw-results-meta" id="pet-catalog-results">
        <span>
          <b>{result.length}</b> 只宠物{" "}
          <small>· 已收录 {pets.length} 只；未知值始终排在末尾</small>
        </span>
        <div className="rw-catalog-sort-v6">
          <label>
            <span>排序</span>
            <CustomSelect
              ariaLabel="宠物排序字段"
              value={sort}
              onChange={(value) =>
                changeFilters({ sort: value, order: direction })
              }
              options={sortFields}
            />
          </label>
          <button
            type="button"
            className="rw-sort-direction-v6"
            aria-label={
              "当前" +
              (direction === "asc" ? "升序，切换降序" : "降序，切换升序")
            }
            onClick={() =>
              changeFilters({
                order: direction === "asc" ? "desc" : "asc",
              })
            }
          >
            {direction === "asc" ? (
              <ArrowUp size={14} />
            ) : (
              <ArrowDown size={14} />
            )}
            {direction === "asc" ? "升序" : "降序"}
          </button>
        </div>
      </div>
      <p className="rw-catalog-key-v6">
        <span className="rw-magic-key-v6">5</span>
        圆圈为天梯组队魔力值，点按可查看记录日期；<b>?</b> 表示尚未核实。
      </p>
      <div className="rw-comparison-message" role="status" aria-live="polite">
        {message}
      </div>
      {result.length ? (
        <PetFeed
          ref={feed}
          items={result}
          scope={scope}
          version={officialPetData.source.sha256}
          ready={q.toString() === new URLSearchParams(location.search).toString()}
          requested={requested}
          onCountChange={(loaded) => setQuery(history, location, { loaded, page: null })}
          renderPet={(p) => <>
            <PetCard
              pet={p}
              href={petHrefWithReturnTo(petCatalogHref(p), returnTo)}
              onOpen={() => feed.current?.remember(p.slug)}
              onCompare={toggle}
              compared={compare.includes(p.slug)}
            />
            {petCollection(p) !== "regular" && <span className="rw-pet-record-label">{petCollection(p) === "placeholder" ? "资料待定" : "特殊编号"}</span>}
          </>}
        />
      ) : (
        <EmptyState
          action={
            <button className="rw-button" onClick={reset}>
              清除筛选
            </button>
          }
        >
          当前分类没有匹配项；也可切换到“全部资料”查找待定或特殊编号条目。
        </EmptyState>
      )}
      {compare.length > 0 && (
        <div className="rw-comparebar">
          <GitCompareArrows size={20} />
          <div>
            <strong>对比 {compare.length} / 3</strong>
            <div className="rw-compare-selection">
              {compare.map((id) => (
                <button
                  key={id}
                  onClick={() => toggle(id)}
                  aria-label={
                    "移出对比：" + pets.find((p) => p.slug === id)?.name
                  }
                >
                  {pets.find((p) => p.slug === id)?.name}
                  <X size={12} />
                </button>
              ))}
            </div>
          </div>
          <Link
            className="rw-button primary"
            to={"/tools/compare/?pets=" + compare.join(",")}
          >
            查看六维对比 <ArrowRight size={15} />
          </Link>
          <button
            className="rw-icon-button"
            aria-label="清空对比"
            onClick={() => {
              setCompare([]);
              setMessage("");
              try {
                localStorage.setItem("roco-wiki-v4:compare", "[]");
              } catch {}
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <Contribution entity="宠物图鉴" />
    </div>
  );
}

export { PetsPage };
