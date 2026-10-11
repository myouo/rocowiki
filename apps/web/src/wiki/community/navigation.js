import { getSearchRecords } from "../data";
import { editorHref as sectionEditHref } from "../editing/registry";

function queryValue(query, key, fallback = "") {
  try {
    return query?.get?.(key) || fallback;
  } catch {
    return fallback;
  }
}

function isMechanicsEntry(target) {
  const name = String(target).split(/\s*·\s*/)[0];
  return (
    getSearchRecords().some(
      (record) =>
        record.title === name && ["宠物", "技能", "机制"].includes(record.kind),
    ) ||
    name.includes("血脉") ||
    name.includes("效果关系")
  );
}

function defaultSection(target) {
  if (String(target).includes("效果关系")) return "效果关系实测";
  return isMechanicsEntry(target) ? "机制解析" : "条目正文";
}

function editHref(target, section = "", submission = "", legacy = false) {
  return sectionEditHref({ entity: target, section: section || defaultSection(target), returnTo: articleHref(target), submission }) + (legacy ? "&legacy=1" : "");
}

function historyHref(target) {
  return `/history/?entity=${encodeURIComponent(target)}`;
}

function articleHref(target) {
  const parts = String(target).split(/\s*·\s*/);
  const name = parts[0];
  const known = getSearchRecords().find(
    (record) =>
      record.title === String(target) ||
      (parts.length === 1 && record.title === name),
  );
  if (known) return known.to;
  const indexes = {
    首页: "/",
    全站搜索: "/search/",
    宠物图鉴: "/pets/",
    技能查询: "/skills/",
    血脉资料: "/bloodlines/",
    地图与地区索引: "/places/",
    人物与NPC索引: "/npcs/",
    活动与获取: "/events/",
    PVE挑战目录: "/challenges/",
    道具与物品索引: "/items/",
    任务与剧情目录: "/tasks/",
    冒险资料: "/adventure/",
    玩家指南: "/guides/",
    帮助中心: "/help/",
    实用工具: "/tools/",
    宠物对比: "/tools/compare/",
    "PP 预算工具": "/tools/pp/",
    自定义浮动区间: "/tools/range/",
    HP药剂: "/items/potion/",
  };
  if (indexes[name]) return indexes[name];
  if (name === "星辰之塔") {
    const floor = parts[1]?.match(/第\s*([1-8])\s*层/)?.[1];
    const params = new URLSearchParams();
    if (floor) params.set("level", floor);
    if (parts[2]) params.set("boss", parts[2]);
    return `/challenges/star-tower/${params.size ? `?${params}` : ""}`;
  }
  const badge = name.match(/^(.+)系徽章$/);
  if (badge) return `/tasks/badges/?type=${encodeURIComponent(badge[1])}`;
  if (name === "徽章任务") return "/tasks/badges/";
  if (name === "主线剧情目录") return "/tasks/?view=story";
  if (name === "支线任务目录") return "/tasks/?view=side";
  if (/天梯|系别|巅峰/.test(name)) {
    const params = new URLSearchParams({
      mode: name.includes("系别")
        ? "type"
        : name.includes("巅峰")
          ? "peak"
          : "ladder",
    });
    const date = parts.find((part) => /^\d{4}-\d{2}-\d{2}$/.test(part));
    if (date) params.set("date", date);
    return `/battle/?${params}`;
  }
  if (name.includes("贡献") || name.includes("账号"))
    return "/help/contributing/";
  return `/search/?q=${encodeURIComponent(name)}`;
}

function formatTime(iso) {
  if (!iso) return "示例时间";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function domainFor(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

export { queryValue, isMechanicsEntry, defaultSection, editHref, historyHref, articleHref, formatTime, isHttpUrl, domainFor };
