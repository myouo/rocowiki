import { pveData as base } from "./content/bundled.js";
import { seven } from "./content/bundled.js";

const text = (value, fallback = "") => typeof value === "string" ? value.slice(0, 15000) : fallback;
const idValue = value => typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,100}$/i.test(value) ? value : "";
const cleanList = value => (Array.isArray(value) ? value : []).filter(row => row && typeof row === "object" && !Array.isArray(row)).slice(0, 40);
export const PVE_CATEGORIES = ["关卡挑战", "每日资源", "限时挑战", "剧情挑战", "其他玩法"];
export const PVE_DIFFICULTIES = [{value:"easy",label:"简单"},{value:"normal",label:"普通"},{value:"hard",label:"困难"}];
export function pveDifficultyDetails(value = {}) {
  return Object.fromEntries(PVE_DIFFICULTIES.map(({value:mode}) => [mode, {bosses:text(value?.[mode]?.bosses),rewards:text(value?.[mode]?.rewards)}]));
}
export function pveEditableSections(data = {}) {
  const rows = cleanList(data.sections);
  if (data.id !== "seven-sanctuaries") return rows;
  // The seven weekday IDs are fixed game locations, not reorderable categories.
  // Missing legacy rows reopen as unfilled fields instead of inheriting another day.
  return seven.stages.map(stage => {
    const row = rows.find(item => item.id === stage.id) || {id:stage.id,title:stage.name,bosses:"",rewards:"",conditions:""};
    return {...row,difficultyDetails:pveDifficultyDetails(row.difficultyDetails)};
  });
}
export function blankPveGuideData(id = "") {
  return { id, name: "", category: "关卡挑战", summary: "", entrance: "", cadence: "", goals: ["progress"], rewardSummary: "", sections: [], sourceUrl: "", sourceTitle: "", checkedAt: "" };
}
function identity(request, data = {}) {
  const raw = text(request?.returnTo);
  let entry = "";
  try { entry = new URL(raw, "https://wiki.invalid").searchParams.get("entry"); } catch {}
  return idValue(request?.record) || idValue(entry) || idValue(/^\/pve\/([^/?#]+)\//.exec(raw)?.[1]) || idValue(data.id);
}
export function pveGuideHref(guide) {
  return guide?.localEntry ? "/pve/?entry=" + encodeURIComponent(guide.slug) : "/pve/" + encodeURIComponent(guide?.slug || "") + "/";
}
export function pveGuideEditorData(guide) {
  if (guide?.editorData) {const data=JSON.parse(JSON.stringify(guide.editorData)); return {...data,sections:pveEditableSections(data)};}
  if (!guide) return blankPveGuideData();
  const source = base.sources.find(row => row.id === guide.sourceIds?.[0]);
  return {
    ...blankPveGuideData(guide.slug), name: guide.name, category: guide.category || "关卡挑战", summary: guide.summary,
    entrance: guide.entrances.map(row => `${row.client}：${row.path}`).join("\n"), cadence: guide.cadence,
    goals: guide.goals || ["progress"], rewardSummary: guide.focus,
    sections: guide.sections.map(row => ({ id: row.value, title: guide.slug === "seven-sanctuaries" ? row.title || row.label : row.label, bosses: row.bosses || "", rewards: row.rewards || "", conditions: [row.body, ...(row.points || [])].filter(Boolean).join("\n"), ...(guide.slug === "seven-sanctuaries" ? {difficultyDetails:pveDifficultyDetails(row.difficultyDetails)} : {}) })),
    sourceUrl: source?.url || "", sourceTitle: source?.title || "", checkedAt: base.asOf,
  };
}
export function getPveGuideEditorData(request = {}, workspace = {}) {
  if (request.intent === "add") return blankPveGuideData(idValue(request.record));
  const id = identity(request);
  const guide = resolvePublishedPveGuides({ submissions: workspace?.submissions || [] }).find(row => id ? row.slug === id : row.name === request.entity);
  return pveGuideEditorData(guide);
}
export function getPveGuidePublishedSnapshot(request = {}, workspace = {}) {
  if (request.intent === "add") return null;
  const id = identity(request);
  const guide = resolvePublishedPveGuides({submissions:workspace?.submissions || []}).find(row => id ? row.slug === id : row.name === request.entity);
  return guide ? {data:pveGuideEditorData(guide),exists:true,publishedAt:guide.publishedAt || null,publishedRevision:guide.publishedRevision || null,sourcePath:guide.localEntry ? pveGuideHref(guide) : "content/pve-v6.json · 玩法条目"} : null;
}
export function validatePveGuideData(data = {}) {
  const errors = [];
  if (!text(data.name).trim()) errors.push("请填写玩法名称。");
  if (!text(data.summary).trim()) errors.push("请用一句话说明这个玩法。");
  if (!text(data.entrance).trim()) errors.push("请填写游戏内入口。");
  if (!PVE_CATEGORIES.includes(data.category)) errors.push("请选择玩法类别。");
  if (!Array.isArray(data.goals) || !data.goals.some(value => ["progress", "pets", "equipment", "training"].includes(value))) errors.push("请选择至少一个奖励目标。");
  if (!text(data.sourceUrl).trim()) errors.push("请提供玩法资料来源。");
  else { try { if (!/^https?:$/.test(new URL(data.sourceUrl).protocol)) throw 0; } catch { errors.push("资料来源须为有效的 HTTP 或 HTTPS 链接。"); } }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(data.checkedAt))) errors.push("请填写资料核对日期。");
  const rows = cleanList(data.sections);
  if (Array.isArray(data.sections) && data.sections.length > 40) errors.push("每份玩法资料最多添加 40 个分区，请将更多关卡整理到分区正文中。");
  if (!rows.length) errors.push("至少添加一个分区或关卡，未核对的 BOSS 和奖励可以留空。");
  rows.forEach((row, index) => { if (!text(row.title).trim()) errors.push(`第 ${index + 1} 个分区缺少名称。`); });
  const ids = rows.map(row => idValue(row.id)).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.push("分区标识重复，请删除重复分区后重新添加。");
  return errors;
}
export function resolvePublishedPveGuides({ guides = base.guides, submissions = [] } = {}) {
  const result = guides.map(guide => ({ ...guide }));
  const rows = (Array.isArray(submissions) ? submissions : []).filter(row => row?.status === "published" && row.editorVersion === 7 && (row.editorMode || row.editorRequest?.mode) === "pve-guide" && row.typedData && typeof row.typedData === "object").slice().sort((a,b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")) || String(a.id).localeCompare(String(b.id)));
  const seen = new Set();
  for (const submission of rows) {
    if (seen.has(submission.id)) continue;
    seen.add(submission.id);
    const data = submission.typedData, request = submission.editorRequest || {}, id = identity(request, data);
    if (!id || !text(data.name).trim()) continue;
    const index = result.findIndex(guide => guide.slug === id), adding = request.intent === "add";
    if ((adding && index >= 0) || (!adding && index < 0)) continue;
    const previous = result[index] || {};
    const sections = cleanList(data.sections).map((row, n) => ({value: idValue(row.id) || `${id}-section-${n + 1}`, label: text(row.title), title: text(row.title), body: text(row.conditions), points: [], bosses: text(row.bosses), rewards: text(row.rewards), ...(id === "seven-sanctuaries" ? {difficultyDetails:pveDifficultyDetails(row.difficultyDetails)} : {})}));
    const guide = {
      ...previous, slug: id, name: text(data.name), shortName: text(data.name), aliases: [...new Set([...(previous.aliases || []), previous.name].filter(Boolean))],
      category: PVE_CATEGORIES.includes(data.category) ? data.category : "其他玩法", summary: text(data.summary), cadence: text(data.cadence),
      goals: Array.isArray(data.goals) ? data.goals.filter(goal => ["progress", "pets", "equipment", "training"].includes(goal)) : ["progress"], focus: text(data.rewardSummary),
      localEntry: previous.localEntry ?? index < 0, sourceIds: previous.sourceIds || [],
      entrances: text(data.entrance).split(/\r?\n/).filter(Boolean).map(path => ({client: "游戏内", path})),
      facts: [...(previous.facts || []).filter(fact => !["玩法类别","开放安排"].includes(fact.label)), {label: "玩法类别", value: text(data.category)}, {label: "开放安排", value: text(data.cadence) || "待补充"}],
      rewards: [...(previous.rewards || []).filter(reward => reward.kind !== "分区奖励"), ...sections.filter(section => section.rewards).map(section => ({name: section.label, kind: "分区奖励", how: section.rewards, note: "按本次核对记录；详情见关卡条件"}))],
      steps: previous.steps || ["确认游戏内入口与开放状态。", "选择分区，再核对挑战对象、条件与奖励。", "在下方阅读或补充适用队伍与实测步骤。"],
      unknowns: id === "seven-sanctuaries" ? sections.flatMap(section => PVE_DIFFICULTIES.filter(mode => !section.difficultyDetails[mode.value].bosses || !section.difficultyDetails[mode.value].rewards).map(mode => `${section.label} · ${mode.label}：${[!section.difficultyDetails[mode.value].bosses && "挑战对象", !section.difficultyDetails[mode.value].rewards && "奖励明细"].filter(Boolean).join("、")}待补充`)) : sections.filter(section => !section.bosses || !section.rewards).map(section => `${section.label}：${[!section.bosses && "挑战对象", !section.rewards && "奖励明细"].filter(Boolean).join("、")}待补充`),
      sections, editorData: {...data, id}, publishedRevision: submission.id, publishedAt: submission.updatedAt,
      authorId: submission.authorId || "", author: submission.author || "", authorAvatar: submission.authorAvatar || "dimo",
      localSource: {url: text(data.sourceUrl), title: text(data.sourceTitle) || "本次资料来源", checkedAt: text(data.checkedAt)},
    };
    if (index >= 0) result[index] = guide; else result.push(guide);
  }
  return result;
}
