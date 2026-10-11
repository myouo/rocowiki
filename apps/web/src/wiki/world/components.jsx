import React from "react";
import { useHistory, useLocation } from "@docusaurus/router";
import { ArrowRight, BookOpen, ChevronRight, CircleHelp, Compass, ExternalLink, Flag, Map, Package, Users } from "lucide-react";
import { Link, PageHeader, Badge, EmptyState } from "../core";
import { historicalEvent, pets } from "../data";
import { petCatalogHref } from "../catalog/pets/officialModel";
import { ColorIcon } from "../visuals";
import { NPC_SOURCE } from "../npcPresentation";

const CHECK_DATE = "2026-10-10";

const SOURCES = {
  npcs: NPC_SOURCE,
  maps: {
    url: "https://news.7k7k.com/content/20101124/23845.html",
    label: "7k7k · 页游地图资料",
    date: "2010-11-24",
  },
  sea: {
    url: "https://ol.3dmgame.com/gl/341877.html",
    label: "3DM网游 · 杰诺斯深海位置资料",
    date: "2026-05-27",
  },
  flight: {
    url: "https://news.4399.com/luoke/xinwengonggao/201007-26-73899.html",
    label: "4399 · 御风术与天空城",
    date: "2010-07-26",
  },
  badges: {
    url: "https://news.4399.com/gonglue/luoke/wenda/201611-08-694798.html",
    label: "4399 · 徽章资料",
    date: "2016-11-08",
  },
  potion: {
    url: "https://news.7k7k.com/roco/20141119-684284.html",
    label: "7k7k · HP药剂购买地点",
    date: "2014-11-19",
  },
  tower: {
    url: "https://news.4399.com/luoke/xinwengonggao/202308-30-985230.html",
    label: "4399 · 2023年9月1日更新资料",
    date: "2023-09-01",
  },
  towerOld: {
    url: "https://news.4399.com/gonglue/luoke/miji/635987.html",
    label: "4399 · 星辰之塔历史Boss目录",
    date: "2016-06-13",
  },
  event: {
    url: historicalEvent.source,
    label: "腾讯页游官网 · 11月28日更新速递",
    date: "2025-11-26",
  },
};

function hrefWith(path, query, changes) {
  const next = new URLSearchParams(query?.toString() || "");
  Object.entries(changes).forEach(([key, value]) =>
    value === null || value === ""
      ? next.delete(key)
      : next.set(key, String(value)),
  );
  return path + (next.toString() ? "?" + next.toString() : "");
}

function useWorldQuery(query) {
  const history = useHistory();
  const location = useLocation();
  return (changes) =>
    history.replace(hrefWith(location.pathname, query, changes));
}

function SourceLine({ source, note }) {
  if (!source) return null;
  return (
    <p className="wa-source">
      <BookOpen size={13} />
      <a href={source.url} target="_blank" rel="noreferrer">
        {source.label}
        <ExternalLink size={11} />
      </a>
      <span>
        {source.date}
        {note ? " · " + note : ""}
      </span>
    </p>
  );
}

function Tabs({ path, query, name, current, items, label }) {
  return (
    <nav className="wa-tabs" aria-label={label}>
      {items.map(([value, text]) => (
        <Link
          key={value}
          to={hrefWith(path, query, { [name]: value })}
          className={current === value ? "active" : ""}
          aria-current={current === value ? "page" : undefined}
        >
          {text}
        </Link>
      ))}
    </nav>
  );
}

function AdventureNav({ current }) {
  return (
    <nav className="wa-section-nav wa-v71-nav" aria-label="冒险资料栏目" data-no-editor>
      {[
        ["/adventure/", "冒险概览", Compass, "teal"],
        ["/places/", "地图与地区", Map, "blue"],
        ["/npcs/", "人物", Users, "amber"],
        ["/tasks/", "任务与剧情", Flag, "coral"],
        ["/items/", "道具", Package, "violet"],
      ].map(([to, text, Icon, tone]) => (
        <Link
          key={to}
          to={to}
          className={`rw-tone-${tone} ${current === to ? "active" : ""}`}
          aria-current={current === to ? "page" : undefined}
        >
          <ColorIcon Icon={Icon} tone={tone} size={16} /><span>{text}</span>
        </Link>
      ))}
    </nav>
  );
}

function Trail({ items }) {
  return (
    <ol className="wa-trail" aria-label="场景路径">
      {items.map((item, index) => (
        <li key={index}>
          {index > 0 && <ChevronRight size={13} />}
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function MissingInline({ title, children, entity }) {
  return (
    <div className="wa-missing">
      <CircleHelp size={18} />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
        {entity && (
          <Link to={"/edit/?entity=" + encodeURIComponent(entity)}>
            补充这项资料 <ArrowRight size={12} />
          </Link>
        )}
      </div>
    </div>
  );
}

function WorldNotFound({ kind, back }) {
  return (
    <div className="wa-page">
      <PageHeader title={kind + "资料尚未收录"} back={back} />
      <EmptyState
        title="还没有这个条目"
        action={
          <Link className="rw-button" to={back}>
            返回{kind}索引
          </Link>
        }
      >
        可以回到索引按名称查找，或从已有条目提交补充。
      </EmptyState>
    </div>
  );
}

function EventRow() {
  return (
    <Link className="wa-event-row" to={"/events/" + historicalEvent.slug + "/"}>
      <div className="wa-event-date">
        <strong>28</strong>
        <span>2025 · 11</span>
      </div>
      <div className="wa-event-copy">
        <div>
          <Badge>已结束</Badge>
          <span className="wa-small">宠物获取</span>
        </div>
        <h2>{historicalEvent.title}</h2>
        <p>华魇萌少进化资格 · 活动地图：宠物园</p>
        <small>2025.11.28 — 2026.01.08</small>
      </div>
      <ArrowRight size={20} />
    </Link>
  );
}

function PetNameChips({ names }) {
  return (
    <div className="wa-name-chips wa-v5-ban-list">
      {names.map((item) => {
        const name = typeof item === "string" ? item : item.name;
        const pet = pets.find((candidate) => candidate.name === name);
        return pet ? (
          <Link
            key={name}
            to={petCatalogHref(pet)}
            title={`查看${name}的图鉴`}
          >
            {name}
          </Link>
        ) : (
          <span className="wa-v5-ban-name" key={name}>
            {name}
          </span>
        );
      })}
    </div>
  );
}

export { CHECK_DATE, SOURCES, hrefWith, useWorldQuery, SourceLine, Tabs, AdventureNav, Trail, MissingInline, WorldNotFound, EventRow, PetNameChips };
