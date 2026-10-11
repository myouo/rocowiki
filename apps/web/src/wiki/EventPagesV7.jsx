import React, { useEffect, useState } from "react";
import { petCatalogHref } from "./catalog/pets/officialModel";
import { useHistory, useLocation } from "@docusaurus/router";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  ExternalLink,
  Gift,
  History,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  Link,
  PageHeader,
  Section,
  Badge,
  Notice,
  EmptyState,
  Contribution,
  BookmarkButton,
} from "./core";
import EditEntry, { usePublishedSection } from "./editing/EditEntry";
import { pets } from "./data";
import { eventData as activitiesData } from "./content/bundled.js";
import { weekly } from "./content/bundled.js";
import "./WorldV7.css";

const tabs = [
  ["current", "本期活动"],
  ["new", "本周新增"],
  ["continuing", "精彩继续"],
  ["ending", "即将过期"],
  ["archive", "历史档案"],
  ["all", "全部活动"],
];
const activityPath = (activity) => `/events/${activity.slug || activity.id}/`;
const periodId = (occurrence) => `opening-${occurrence.id}`;
const dateLabel = (value) => (value ? value.replaceAll("-", ".") : "日期待补");
const isPermanent = (occurrence) =>
  occurrence.category === "new_permanent" || occurrence.permanent === true;
const endLabel = (occurrence) =>
  occurrence.endDate
    ? dateLabel(occurrence.endDate)
    : isPermanent(occurrence)
      ? "长期开放"
      : "结束日期待补";
const rewardsOf = (occurrence) =>
  Array.isArray(occurrence.rewards)
    ? occurrence.rewards
    : String(occurrence.rewards || "")
        .split("\n")
        .filter(Boolean)
        .map((name) => ({ name, kind: "unknown" }));
const rewardLabel = (reward) =>
  `${reward.name}${reward.kind === "evolution_qualification" ? "进化资格" : ""}`;

function useEditionDate() {
  const [today, setToday] = useState(weekly.asOf);
  useEffect(() => {
    let timer;
    const refresh = () => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const map = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
      );
      const current = `${map.year}-${map.month}-${map.day}`;
      setToday(current);
      clearTimeout(timer);
      const next = new Date(`${current}T00:00:00+08:00`).getTime() + 86400000;
      timer = window.setTimeout(
        refresh,
        Math.max(100, next - Date.now() + 100),
      );
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return { today, stale: today >= weekly.edition.reviewDueDate };
}
function statusOf(occurrence, today, stale) {
  if (occurrence.endDate && occurrence.endDate < today)
    return { text: "已结束", tone: "neutral" };
  if (occurrence.startDate > today) return { text: "即将开始", tone: "blue" };
  if (stale) return { text: "公告档案 · 待更新", tone: "amber" };
  if (occurrence.endDate === today) return { text: "今天结束", tone: "amber" };
  const difference = occurrence.endDate
    ? (Date.parse(occurrence.endDate) - Date.parse(today)) / 86400000
    : Infinity;
  if (difference <= 7) return { text: "即将结束", tone: "amber" };
  return {
    text: isPermanent(occurrence) ? "长期活动" : "进行中",
    tone: "blue",
  };
}
function Reward({ reward }) {
  const pet = pets.find((item) => item.name === reward.name);
  return (
    <span className="wv7-reward">
      <Gift size={14} />
      {pet ? (
        <Link to={petCatalogHref(pet)}>{rewardLabel(reward)}</Link>
      ) : (
        <span>{rewardLabel(reward)}</span>
      )}
    </span>
  );
}
function EventList({ query }) {
  const history = useHistory(),
    location = useLocation();
  const { today, stale } = useEditionDate();
  const raw = query.get("view") || "current";
  const view = tabs.some(([id]) => id === raw) ? raw : "current";
  const q = (query.get("q") || "").trim().toLowerCase();
  const [search, setSearch] = useState(query.get("q") || "");
  useEffect(() => setSearch(query.get("q") || ""), [query.toString()]);
  const setQuery = (changes) => {
    const params = new URLSearchParams(query);
    Object.entries(changes).forEach(([key, value]) =>
      value ? params.set(key, value) : params.delete(key),
    );
    history.replace(
      location.pathname + (params.toString() ? "?" + params : ""),
    );
  };
  const editionSlugs = new Set(weekly.events.map((event) => event.slug));
  const matchesView = (occurrence) => {
    const inEdition = editionSlugs.has(occurrence.legacySlug || occurrence.id);
    if (view === "all") return true;
    if (view === "archive")
      return (
        (occurrence.endDate && occurrence.endDate < today) ||
        (stale && inEdition)
      );
    if (view === "ending")
      return (
        !stale &&
        occurrence.endDate &&
        occurrence.endDate >= today &&
        (Date.parse(occurrence.endDate) - Date.parse(today)) / 86400000 <= 7
      );
    if (view === "new")
      return (
        inEdition && ["new", "new_permanent"].includes(occurrence.category)
      );
    if (view === "continuing")
      return inEdition && occurrence.category === "continuing";
    return inEdition;
  };
  const rows = activitiesData.activities
    .map((activity) => ({
      activity,
      occurrences: activity.occurrences.filter(
        (occurrence) =>
          matchesView(occurrence) &&
          (!q ||
            [
              activity.name,
              occurrence.label,
              occurrence.startDate,
              occurrence.endDate,
              occurrence.location,
              ...rewardsOf(occurrence).map(rewardLabel),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q)),
      ),
    }))
    .filter((row) => row.occurrences.length);
  return (
    <div className="wa-page wv7-events">
      <PageHeader
        title="活动与获取"
        eyebrow="王国活动档案"
        description="这周做什么、哪些快结束，以及喜欢的活动曾经何时回来。"
        crumbs={[{ label: "首页", to: "/" }, { label: "活动与获取" }]}
        actions={
          <EditEntry
            entity="活动与获取"
            section="活动与开放批次"
            mode="event"
            intent="add"
            returnTo="/events/"
            label="新增活动条目"
          />
        }
      />
      <div className={`wv7-edition ${stale ? "is-stale" : ""}`}>
        <CalendarDays size={22} />
        <div>
          <strong>
            {stale ? "历史周报" : "本期周报"} · {weekly.edition.label}
          </strong>
          <p>
            {stale
              ? "本期快照已到复核日期，以下日期与条件供历史查阅。"
              : "每周五更新。活动截止与领取奖励的截止时间分开记录。"}
          </p>
        </div>
        <Link to="/battle/">
          查看同期禁赛 <ArrowRight size={14} />
        </Link>
      </div>
      <nav className="wv7-event-tabs" aria-label="活动分类">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setQuery({ view: id === "current" ? null : id })}
            className={view === id ? "is-active" : ""}
            aria-pressed={view === id}
          >
            {label}
          </button>
        ))}
      </nav>
      <form
        className="wv7-event-search"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery({ q: search.trim() });
        }}
      >
        <Search size={18} />
        <input
          aria-label="搜索活动、日期或奖励"
          placeholder="活动名称、奖励、地点或年份"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {search && (
          <button
            type="button"
            aria-label="清空活动搜索"
            onClick={() => {
              setSearch("");
              setQuery({ q: null });
            }}
          >
            <X size={15} />
          </button>
        )}
        <button type="submit" className="rw-button">
          查询
        </button>
      </form>
      <div className="wv7-list-toolbar">
        <span>
          {rows.length} 项活动 ·{" "}
          {rows.reduce((sum, row) => sum + row.occurrences.length, 0)}{" "}
          次开放记录
        </span>
        <EditEntry
          entity="活动与获取"
          section="活动与开放批次"
          mode="event"
          intent="add"
          returnTo="/events/"
          label="新增活动条目"
        />
      </div>
      <div className="wv7-event-list">
        {rows.map(({ activity, occurrences }) => {
          const occurrence = occurrences[0],
            status = statusOf(occurrence, today, stale);
          return (
            <article key={activity.id} className="wv7-event-list-card">
              <span className="wv7-event-list-symbol">
                <CalendarDays size={26} />
              </span>
              <div className="wv7-event-list-copy">
                <div className="wv7-record-badges">
                  <Badge tone={status.tone}>{status.text}</Badge>
                  <small>{activity.occurrences.length} 次开放已收录</small>
                </div>
                <h2>
                  <Link to={activityPath(activity)}>{activity.name}</Link>
                </h2>
                <p>
                  {rewardsOf(occurrence).map(rewardLabel).join("、") ||
                    "奖励待补充"}
                </p>
                <div className="wv7-event-list-meta">
                  <span>
                    <Clock3 size={13} />
                    {dateLabel(occurrence.startDate)} — {endLabel(occurrence)}
                  </span>
                  <span>
                    <MapPin size={13} />
                    {occurrence.location || occurrence.map || "地点待补"}
                  </span>
                </div>
              </div>
              <div className="wv7-event-list-actions">
                <Link to={activityPath(activity)} className="rw-textlink">
                  查看活动档案 <ArrowRight size={14} />
                </Link>
                <EditEntry
                  entity={activity.name}
                  section="活动与开放批次"
                  mode="event"
                  returnTo={activityPath(activity)}
                  record={occurrence.id}
                  label="编辑本次开放"
                />
              </div>
            </article>
          );
        })}
      </div>
      {!rows.length && (
        <EmptyState
          title="没有匹配的活动"
          action={
            <Link className="rw-button" to="/events/?view=all">
              查看全部活动档案
            </Link>
          }
        >
          换一个活动名或年份，或者补充尚未收录的活动。
        </EmptyState>
      )}
      <div className="wv7-archive-note">
        <History size={20} />
        <div>
          <h2>同一个活动，保留每一次返场</h2>
          <p>
            每次开放都有独立日期、条件、地点、奖励与来源。查看{" "}
            <Link to="/events/fun-chess/">趣味对弈的两次开放记录</Link>
            ，或为已有活动新增一期。
          </p>
        </div>
      </div>
      <Contribution entity="活动与获取" />
    </div>
  );
}
function Occurrence({ activity, occurrence, today, stale, selected }) {
  const status = statusOf(occurrence, today, stale);
  const sources = activitiesData.sources.filter((source) =>
    (occurrence.sourceIds || []).includes(source.id),
  );
  const sourceUrl = occurrence.sourceUrl || sources[0]?.url;
  return (
    <article
      id={periodId(occurrence)}
      data-occurrence-id={occurrence.id}
      className={`wv7-occurrence ${selected ? "is-selected" : ""}`}
    >
      <div className="wv7-occurrence-top">
        <span className="wv7-opening-dot">
          <CalendarDays size={19} />
        </span>
        <div>
          <h3>{occurrence.label || occurrence.name || "开放记录"}</h3>
          <p>
            {dateLabel(occurrence.startDate)} — {endLabel(occurrence)}
          </p>
        </div>
        <Badge tone={status.tone}>{status.text}</Badge>
        <EditEntry
          entity={activity.name}
          section="活动与开放批次"
          mode="event"
          returnTo={`${activityPath(activity)}#${periodId(occurrence)}`}
          record={occurrence.id}
          label="编辑本次开放"
        />
      </div>
      <dl className="wv7-opening-facts">
        <div>
          <dt>
            <MapPin size={14} />
            本次地点
          </dt>
          <dd>{occurrence.location || occurrence.map || "待补充"}</dd>
        </div>
        <div>
          <dt>
            <Clock3 size={14} />
            领奖截止
          </dt>
          <dd>
            {occurrence.claimDeadline
              ? dateLabel(occurrence.claimDeadline)
              : "未单独公布"}
          </dd>
        </div>
        <div className="wv7-opening-wide">
          <dt>参与条件</dt>
          <dd>
            {Array.isArray(occurrence.conditions)
              ? occurrence.conditions.join("；")
              : occurrence.conditions || "本次条件待补充"}
          </dd>
        </div>
        <div className="wv7-opening-wide">
          <dt>
            <Gift size={14} />
            本次奖励
          </dt>
          <dd className="wv7-opening-rewards">
            {rewardsOf(occurrence).length
              ? rewardsOf(occurrence).map((reward, index) => (
                  <Reward key={`${reward.name}-${index}`} reward={reward} />
                ))
              : "奖励记录待补充"}
          </dd>
        </div>
      </dl>
      {occurrence.note && <p className="wv7-opening-note">{occurrence.note}</p>}
      <div className="wv7-opening-source">
        <span>{occurrence.certainty || "来源待核对"}</span>
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            {occurrence.sourceTitle || sources[0]?.title || "本次公告"}
            <ExternalLink size={12} />
          </a>
        ) : (
          <span>来源链接待补充</span>
        )}
        <small>
          {occurrence.clientVerified ? "已记录实机核对" : "未标记实机复现"}
        </small>
      </div>
    </article>
  );
}
function ActivityDetail({ original, legacyOccurrence, query }) {
  const { today, stale } = useEditionDate();
  const location = useLocation();
  const request = {
    entity: original.name,
    section: "活动与开放批次",
    mode: "event",
    returnTo: activityPath(original),
  };
  const published = usePublishedSection(request);
  const activity = published?.data
    ? { ...original, ...published.data, slug: original.slug }
    : original;
  const occurrences = [...(activity.occurrences || [])].sort((a, b) =>
    (b.startDate || "").localeCompare(a.startDate || ""),
  );
  const requested =
    legacyOccurrence?.id ||
    query.get("occurrence") ||
    (location.hash.startsWith("#opening-") ? location.hash.slice(9) : "");
  useEffect(() => {
    if (requested)
      document
        .getElementById(`opening-${requested}`)
        ?.scrollIntoView?.({ block: "start", behavior: "auto" });
  }, [requested]);
  return (
    <div className="wa-page wv7-events wv7-event-detail">
      <PageHeader
        title={activity.name}
        eyebrow="活动档案"
        description={activity.summary}
        back="/events/"
        crumbs={[
          { label: "活动与获取", to: "/events/" },
          { label: activity.name },
        ]}
        edit={request}
        actions={
          <>
            <BookmarkButton
              id={`event-${activity.id}`}
              title={activity.name}
              href={activityPath(activity)}
              kind="活动"
            />
            <EditEntry {...request} intent="add" label="新增一次开放" />
          </>
        }
      />
      {legacyOccurrence && (
        <div className="wv7-legacy-context">
          <History size={18} />
          <span>
            你从{" "}
            {legacyOccurrence.label || dateLabel(legacyOccurrence.startDate)}{" "}
            的旧链接进入，已定位这次开放；下方保留活动的全部历史。
          </span>
          <Link to={activityPath(activity)}>活动总档案</Link>
        </div>
      )}
      {published && (
        <Notice title="本机已发布修订">
          当前展示在此浏览器审核发布后的活动版本；线上站点尚未发生变化。
        </Notice>
      )}
      <div className="wv7-activity-summary">
        <span>
          <Sparkles size={24} />
        </span>
        <div>
          <strong>{occurrences.length} 次开放已收录</strong>
          <p>同一活动的返场分别记录，新增一期不会覆盖之前的日期和奖励。</p>
        </div>
        <a
          href="#activity-openings"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById("activity-openings")?.scrollIntoView?.({
              behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
                ?.matches
                ? "auto"
                : "smooth",
            });
          }}
        >
          查看历次开放 <ArrowRight size={14} />
        </a>
      </div>
      <Section
        title="历次开放"
        id="activity-openings"
        edit={false}
        aside={<EditEntry {...request} intent="add" label="新增一次开放" />}
      >
        <nav className="wv7-opening-jumps" aria-label="定位开放批次">
          {occurrences.map((occurrence) => (
            <a
              key={occurrence.id}
              href={`#${periodId(occurrence)}`}
              onClick={(event) => {
                event.preventDefault();
                document
                  .getElementById(periodId(occurrence))
                  ?.scrollIntoView?.({
                    behavior: window.matchMedia?.(
                      "(prefers-reduced-motion: reduce)",
                    )?.matches
                      ? "auto"
                      : "smooth",
                    block: "start",
                  });
              }}
            >
              {occurrence.label || dateLabel(occurrence.startDate)}
            </a>
          ))}
        </nav>
        <div className="wv7-occurrence-list">
          {occurrences.map((occurrence) => (
            <Occurrence
              key={occurrence.id}
              activity={activity}
              occurrence={occurrence}
              today={today}
              stale={stale}
              selected={occurrence.id === requested}
            />
          ))}
        </div>
        <div className="wv7-add-opening">
          <CalendarDays size={23} />
          <div>
            <strong>这个活动又回来了？</strong>
            <p>
              新增本次开放的日期、条件、地点、奖励与来源，原有记录会一起保留。
            </p>
          </div>
          <EditEntry {...request} intent="add" label="新增一次开放" />
        </div>
      </Section>
      <Contribution entity={activity.name} source={occurrences[0]?.sourceUrl} />
    </div>
  );
}
export default function EventPagesV7({ path, query = new URLSearchParams() }) {
  const slug = path.split("/").filter(Boolean)[1];
  if (!slug) return <EventList query={query} />;
  const activity = activitiesData.activities.find(
    (row) =>
      row.slug === slug ||
      row.id === slug ||
      row.occurrences.some(
        (occurrence) =>
          occurrence.legacySlug === slug || occurrence.id === slug,
      ),
  );
  if (!activity)
    return (
      <>
        <PageHeader title="尚未收录这个活动" back="/events/" />
        <EmptyState
          action={
            <Link className="rw-button" to="/events/?view=all">
              查看活动档案
            </Link>
          }
        >
          可以从活动名称、地点或奖励重新查找。
        </EmptyState>
      </>
    );
  return (
    <ActivityDetail
      key={activity.id}
      original={activity}
      legacyOccurrence={activity.occurrences.find(
        (occurrence) =>
          occurrence.legacySlug === slug || occurrence.id === slug,
      )}
      query={query}
    />
  );
}
