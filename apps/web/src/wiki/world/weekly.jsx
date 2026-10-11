import React, { useEffect, useState } from "react";
import { CalendarDays, ExternalLink } from "lucide-react";
import { Link, Badge } from "../core";
import { pets } from "../data";
import { petCatalogHref } from "../catalog/pets/officialModel";
import { weekly } from "../content/bundled.js";

function shanghaiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function useWeeklyDate() {
  // Keep the server render stable; refresh to the reader's Shanghai date on mount.
  const [today, setToday] = useState(weekly.asOf);
  useEffect(() => {
    let midnightTimer;
    const refresh = () => {
      const date = shanghaiDate();
      setToday(date);
      window.clearTimeout(midnightTimer);
      const nextMidnight =
        new Date(`${date}T00:00:00+08:00`).getTime() + 86400000;
      midnightTimer = window.setTimeout(
        refresh,
        Math.max(100, nextMidnight - Date.now() + 100),
      );
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(midnightTimer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return { today, stale: today >= weekly.edition.reviewDueDate };
}

function dateLabel(value) {
  return value ? value.replaceAll("-", ".") : "长期";
}

function eventStatus(event, today, stale) {
  if (event.endDate && event.endDate < today) return "已结束";
  if (stale) return "公告档案";
  if (event.startDate > today) return "即将开始";
  if (event.endDate === today) return "今天结束";
  if (
    event.endDate &&
    new Date(`${event.endDate}T00:00:00+08:00`).getTime() -
      new Date(`${today}T00:00:00+08:00`).getTime() ===
      86400000
  )
    return "明天结束";
  return event.endDate ? "进行中" : "长期活动";
}

function WeeklySources({
  detailed = false,
  sourceIds = [
    "weekly-4399-20261009",
    "weekly-17173-20261009",
    "weekly-3dm-20261009",
  ],
}) {
  const sources = weekly.sources.filter((source) =>
    sourceIds.includes(source.id),
  );
  return (
    <div className="wa-v5-sources">
      <p className="wa-small">
        公告交叉核对 · {dateLabel(weekly.verification.checkedAt)}
        {detailed && " · 依据同一期公告转载整理，尚未校验游戏内临时调整。"}
      </p>
      <div className="wa-v5-source-links">
        {sources.map((source) => (
          <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
            {source.publisher} · {dateLabel(source.publishedAt)}
            <ExternalLink size={12} />
          </a>
        ))}
      </div>
    </div>
  );
}

function WeeklyEdition({ stale }) {
  return (
    <div className={"wa-v5-edition" + (stale ? " is-stale" : "")} role="status">
      <CalendarDays size={17} />
      <div>
        <strong>
          {stale ? "历史快照" : "本期更新"} · {weekly.edition.label}
        </strong>
        <span>
          {stale
            ? "本期资料待更新；以下保留当期公告与临期活动档案，不代表当前仍有效。"
            : "活动与赛规按 10 月 9 日周整理，另含往期公告核实的临期活动；请结合日期查阅。"}
        </span>
      </div>
      <Badge tone={stale ? "amber" : "blue"}>
        {stale ? "待更新" : "10.09—10.15"}
      </Badge>
    </div>
  );
}

function RewardName({ reward }) {
  const pet = pets.find((item) => item.name === reward.name);
  return pet ? (
    <Link to={petCatalogHref(pet)}>{reward.name}</Link>
  ) : (
    <span>{reward.name}</span>
  );
}

export { useWeeklyDate, dateLabel, eventStatus, WeeklySources, WeeklyEdition, RewardName };
