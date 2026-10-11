import {useMemo} from "react";
import {useDemoSubmissions} from "../community/useDemoSubmissions";
import React, { useEffect, useState } from "react";
import { ArrowRight, BookOpen, ChevronRight, ExternalLink, Flag, Map, MapPin, Search, Users } from "lucide-react";
import { Link, PageHeader, Section, EmptyState, Contribution, TextLink, DocGrid, BookmarkButton } from "../core";
import { places, npcs } from "../data";
import { contentRoutes as knownRoutes } from "../content/bundled.js";
import EditEntry from "../editing/EditEntry";
import DirectoryPanel, { DirectorySearch } from "../DirectoryPanel";
import { ColorIcon } from "../visuals";
import { COMMUNITY_STORAGE_KEY } from "../editing/registry";
import { AdventureNav, MissingInline, SOURCES, SourceLine, Trail, WorldNotFound, hrefWith, useWorldQuery } from "./components.jsx";
import { PLACE_DETAILS, PLACE_VISUALS } from "./placeData.js";

function placeQuickLinksFrom(workspace) {
  const entries = new globalThis.Map();
  const rows = (Array.isArray(workspace?.submissions) ? workspace.submissions : [])
    .filter((row) => row?.status === "published" && row.editorVersion === 7 && row.editorMode === "index" && row.editorRequest?.intent === "add" && String(row.editorRequest?.returnTo || "").split(/[?#]/)[0] === "/places/")
    .sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || ""))).slice(-500);
  for (const row of rows) {
    if (!Array.isArray(row.typedData?.entries) || row.typedData.entries.length !== 1) continue;
    const entry = row.typedData.entries[0];
    const target = typeof entry.href === "string" ? entry.href : "";
    const path = target.split(/[?#]/)[0];
    if (!target.startsWith("/places/") || !knownRoutes.includes(path) || /[<>\\]/.test(target) || typeof entry.title !== "string" || !entry.title.trim()) continue;
    const id = String(entry.id || row.id || "");
    if (id) entries.set(id, {id, title: entry.title, href: target, description: typeof entry.description === "string" ? entry.description : "", placeSlug: path.split("/")[2]});
  }
  return [...entries.values()];
}

function usePlaceQuickLinks() { const submissions=useDemoSubmissions(); return useMemo(()=>placeQuickLinksFrom({submissions}),[submissions]); }

function PlacesIndex({ query }) {
  const update = useWorldQuery(query);
  const search = (query.get("q") || "").toLowerCase();
  const region = query.get("region") || "all";
  const quickLinks = usePlaceQuickLinks().filter((entry) => (!search || `${entry.title} ${entry.description}`.toLowerCase().includes(search)) && (region === "all" || (region === "center" ? ["castle", "academy"].includes(entry.placeSlug) : !["castle", "academy"].includes(entry.placeSlug))));
  const groups = [
    ["all", "全部地区"],
    ["center", "王国中心"],
    ["field", "野外与其他"],
  ];
  const rows = places.filter(
    (place) =>
      (!search ||
        [place.name, place.region, ...(PLACE_DETAILS[place.slug]?.scenes || [])]
          .join(" ")
          .toLowerCase()
          .includes(search)) &&
      (region === "all" ||
        (region === "center"
          ? ["castle", "academy"].includes(place.slug)
          : !["castle", "academy"].includes(place.slug))),
  );
  return (
    <div className="wa-page wa-v71-places" data-no-editor>
      <PageHeader
        title="地图与地区"
        eyebrow="大地图索引"
        description="先定位地区，再查看子场景、进入条件与关联人物。"
        crumbs={[
          { label: "首页", to: "/" },
          { label: "冒险资料", to: "/adventure/" },
          { label: "地图与地区" },
        ]}
        edit={false}
        actions={
          <>
            <EditEntry
              entity="地图与地区"
              section="地区目录"
              mode="index"
              intent="add"
              returnTo="/places/"
              label="补充地点快捷入口"
              variant="primary"
            />
            <Link className="rw-button" to="/npcs/">
              <Users size={15} />
              按人物找地点
            </Link>
          </>
        }
      />
      <AdventureNav current="/places/" />
      <div className="wa-atlas">
        <aside className="wa-atlas-index" data-no-editor>
          <ColorIcon Icon={Map} tone="teal" size={25} />
          <h2>王国地区目录</h2>
          <p>按场景名称检索。</p>
          <nav aria-label="地区分类">
            {groups.map(([value, label]) => (
              <Link
                key={value}
                to={hrefWith("/places/", query, { region: value })}
                className={region === value ? "active" : ""}
                aria-current={region === value ? "page" : undefined}
              >
                {label}
                <ChevronRight size={14} />
              </Link>
            ))}
          </nav>
          <small>
            地区按资料类别分组，
            <br />
            位置路径在详情页中查看。
          </small>
        </aside>
        <DirectoryPanel directory="places" title="地区与子场景" Icon={MapPin} tone="teal" summary={`${rows.length} 条匹配 · ${places.length} 个已收录地区`}
          search={<DirectorySearch
            query={query}
            onSubmit={(q) => update({ q })}
            placeholder="地区或子场景，如教学楼"
            label="搜索地区和子场景"
          />}>
          {rows.length ? (
            <div className="wa-place-rows">
              {rows.map((place) => {
                const visual = PLACE_VISUALS[place.slug] || {Icon: MapPin, tone: "teal"};
                return <Link key={place.slug} className={`rw-tone-${visual.tone}`} to={"/places/" + place.slug + "/"}>
                  <ColorIcon Icon={visual.Icon} tone={visual.tone} size={23} />
                  <div className="wa-place-main">
                    <h3>{place.name}</h3>
                    <p>
                      {PLACE_DETAILS[place.slug]?.scenes.slice(1).join(" · ") ||
                        "子场景待补"}
                    </p>
                  </div>
                  <span className="wa-place-focus">
                    {PLACE_DETAILS[place.slug]?.focus}
                  </span>
                  <ArrowRight size={17} />
                </Link>;
              })}
            </div>
          ) : (
            <EmptyState
              action={
                <Link className="rw-button" to="/places/">
                  重置筛选
                </Link>
              }
            >
              没有匹配的地区或子场景；可换一个正式地名查询。
            </EmptyState>
          )}
          {quickLinks.length > 0 && <div className="wa71-place-quicklinks" data-no-editor><h3>补充的地点快捷入口</h3><p>这些入口指向已有地区中的具体场景或说明。</p><div>{quickLinks.map((entry) => <Link key={entry.id} to={entry.href} data-place-quicklink={entry.id}><MapPin size={18} /><span><strong>{entry.title}</strong>{entry.description && <small>{entry.description}</small>}</span><ChevronRight size={15} /></Link>)}</div></div>}
        </DirectoryPanel>
      </div>
      <p className="wa71-directory-note"><BookOpen size={16} />进入地区条目后，可补充进入方式、子场景和关联人物。</p>
    </div>
  );
}

function PlaceDetail({ slug }) {
  const place = places.find((item) => item.slug === slug);
  const detail = PLACE_DETAILS[slug];
  if (!place || !detail) return <WorldNotFound kind="地区" back="/places/" />;
  const residents = npcs.filter((npc) => npc.place === slug);
  return (
    <div className="wa-page wa-v71-place">
      <PageHeader
        title={place.name}
        eyebrow="地区资料"
        description={detail.intro}
        back="/places/"
        crumbs={[
          { label: "冒险资料", to: "/adventure/" },
          { label: "地图与地区", to: "/places/" },
          { label: place.name },
        ]}
        actions={
          <BookmarkButton
            id={"place-" + slug}
            title={place.name}
            href={"/places/" + slug + "/"}
            kind="地区"
          />
        }
      />
      <DocGrid
        toc={[
          ["entrance", "进入方式"],
          ["scenes", "子场景"],
          ["residents", "人物与服务"],
          ["place-events", "相关活动与任务"],
        ]}
      >
        <div className={"wa-place-summary wa-place-" + slug} data-no-editor>
          <ColorIcon Icon={PLACE_VISUALS[slug]?.Icon || MapPin} tone={PLACE_VISUALS[slug]?.tone || "teal"} size={26} />
          <div>
            <span className="wa-kicker">所在资料分类</span>
            <h2>{slug === "xuan-yu" ? "玄玉地区" : place.region}</h2>
            <Trail items={detail.path} />
          </div>
          <span className="wa-summary-count">
            <strong>{detail.scenes.length}</strong>已收录场景
          </span>
        </div>
        <Section title="进入方式" id="entrance">
          <p>{detail.entrance}</p>
          {slug === "mermaid-bay" && (
            <Trail
              items={["人鱼湾", "海洋研究院", "杰诺斯浅海", "杰诺斯深海"]}
            />
          )}
          <SourceLine
            source={detail.source}
            note="入口若有调整，可在下方补充最新截图"
          />
          {!detail.source && (
            <p className="wa-source">场景目录已整理；具体进入路径仍待核验。</p>
          )}
        </Section>
        <Section
          title="子场景"
          id="scenes"
          aside={<span className="wa-small">从地区继续查到具体地点</span>}
        >
          <ul className="wa-scene-list">
            {detail.scenes.map((scene, index) => (
              <li key={scene}>
                <span className="wa-scene-order">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{scene}</strong>
                <span>{index === 0 ? "地区主场景" : "子场景"}</span>
                {scene === "教学楼" ? (
                  <Link to="/npcs/griffin/">
                    格里芬院长 <ChevronRight size={13} />
                  </Link>
                ) : (
                  <Link to={"/search/?q=" + encodeURIComponent(scene)}>
                    查相关资料 <Search size={12} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="人物与服务" id="residents">
          <p>{detail.service}</p>
          {residents.length ? (
            <div className="wa-resident-list">
              {residents.map((npc) => (
                <Link to={"/npcs/" + npc.slug + "/"} key={npc.slug}>
                  <span className="wa-npc-mark">
                    <Users size={19} />
                  </span>
                  <div>
                    <strong>{npc.name}</strong>
                    <small>
                      {npc.slug === "griffin"
                        ? "教学楼 · 学院人物"
                        : "王国城堡 · 白银骑士团"}
                    </small>
                  </div>
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <MissingInline
              title="人物条目尚未关联"
              entity={place.name + " · 人物与位置"}
            >
              可以补充人物名称、具体子场景和出现条件。
            </MissingInline>
          )}
        </Section>
        <Section title="相关活动与任务" id="place-events">
          {slug === "sky" ? (
            <div className="wa-related-lines">
              <Link to="/tasks/badges/">
                <Flag size={18} />
                <div>
                  <strong>徽章任务</strong>
                  <span>查看徽章分类及历史挑战资料</span>
                </div>
                <ArrowRight size={16} />
              </Link>
              <a href={SOURCES.flight.url} target="_blank" rel="noreferrer">
                <BookOpen size={18} />
                <div>
                  <strong>御风术历史资料</strong>
                  <span>课程和空中场景的旧版记录</span>
                </div>
                <ExternalLink size={14} />
              </a>
            </div>
          ) : (
            <MissingInline
              title="本地区当前活动尚未逐项核验"
              entity={place.name + " · 活动关联"}
            >
              查限时活动时，请同时确认日期与领取条件。
            </MissingInline>
          )}
          <TextLink to="/events/">前往活动与获取</TextLink>
        </Section>
        <Contribution entity={place.name} source={detail.source?.url} />
      </DocGrid>
    </div>
  );
}

export { PlacesIndex, PlaceDetail };
