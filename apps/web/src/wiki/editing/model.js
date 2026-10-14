import { serializeSkillBranch, validateSkillBranches } from "../skillConditions";
import { skillTermErrors } from "../skillTerms";
import { matchupBloodlineText, normalizeMatchupBloodline } from "../matchupBloodlines";
import { getPetBloodlineOptions } from "../catalogBloodlines";
import { validatePveGuideData } from "../pvePublished";
import { validateSkillLearnerData } from "../skillLearnerModel";
import { resolvePublishedCatalogPets } from "../catalogPublished";
import { pets as sourcePets } from "../data";
import { contentRoutes } from "../content/bundled.js";
// The editable shapes are deliberately small. Content cannot introduce executable MDX.
export const EDITOR_MODES = {
  article: { label: "章节正文", hint: "只修改这一节；现有正文已经填好。" },
  acquisition: {
    label: "获取记录",
    hint: "每条记录对应一次获取机会；同一活动可以关联多个开放批次。",
  },
  event: {
    label: "活动与开放批次",
    hint: "活动名称只维护一份。每次返场新增批次，保留往年的日期、条件与奖励。",
  },
  skill: {
    label: "技能资料与效果分支",
    hint: "基础描述、触发条件、成立效果和否则分支分别维护。",
  },
  matchup: {
    label: "PVP 对位记录",
    hint: "按当前宠物的视角记录同起、后上拦截或先在场；支持率由投票系统维护。",
  },
  npc: {
    label: "人物与 NPC",
    hint: "名称、出现场景、提供的服务和任务关联分别填写。",
  },
  pet: {
    label: "宠物资料",
    hint: "保留游戏编号与六项种族数据，未知字段留空，不以 0 代替。",
  },
  pve: {
    label: "PVE 挑战方案",
    hint: "从副本记录挑战宠物、必要配置和操作步骤。",
  },
  "pve-guide": { label: "PVE 玩法条目", hint: "维护玩法入口、关卡、挑战对象与奖励；配队另行发布为挑战方案。" },
  index: {
    label: "目录与入口",
    hint: "每个入口有明确名称、站内去向和简短用途。",
  },
  relationship: {
    label: "效果关系实测",
    hint: "施加方向、触发时点与证据必须一起记录。",
  },
};

export function safeInternalPath(value, fallback = "/") {
  return typeof value === "string" && /^\/(?!\/)[^\s<>\\]*$/.test(value)
    ? value.slice(0, 2000)
    : fallback;
}

export function normalizeMode(value) {
  const aliases = {
    counter: "matchup",
    "skill-effects": "skill",
    timeline: "acquisition",
    markdown: "article",
  };
  const mode = aliases[value] || value;
  return EDITOR_MODES[mode] ? mode : "article";
}

export function contentRevision(value) {
  const input = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `pub-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function cloneData(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

// Sanitize local storage without trusting its object prototypes or unlimited nesting.
export function sanitizeData(value, depth = 0) {
  // A branch may contain a nested condition group and a nested effect. Preserve
  // those explicit structures while still bounding untrusted stored objects.
  if (depth > 32) return null;
  if (typeof value === "string") return value.slice(0, 15000);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value))
    return value.slice(0, 100).map((item) => sanitizeData(item, depth + 1));
  if (!value || typeof value !== "object") return null;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) => !["__proto__", "constructor", "prototype"].includes(key),
      )
      .slice(0, 100)
      .map(([key, item]) => [key.slice(0, 100), sanitizeData(item, depth + 1)]),
  );
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function threeWayMerge(base, current, mine) {
  const conflicts = [];
  function visit(oldValue, liveValue, draftValue, path) {
    if (same(draftValue, oldValue)) return cloneData(liveValue);
    if (same(liveValue, oldValue) || same(liveValue, draftValue))
      return cloneData(draftValue);
    if (
      [oldValue, liveValue, draftValue].every(
        (value) => value && typeof value === "object" && !Array.isArray(value),
      )
    ) {
      return Object.fromEntries(
        [
          ...new Set([
            ...Object.keys(oldValue),
            ...Object.keys(liveValue),
            ...Object.keys(draftValue),
          ]),
        ].map((key) => [
          key,
          visit(
            oldValue[key] ?? null,
            liveValue[key] ?? null,
            draftValue[key] ?? null,
            [...path, key],
          ),
        ]),
      );
    }
    // Record lists are compared as a unit: never silently delete a new upstream row.
    conflicts.push({
      path,
      base: cloneData(oldValue),
      current: cloneData(liveValue),
      mine: cloneData(draftValue),
    });
    return cloneData(draftValue);
  }
  return { data: visit(base, current, mine, []), conflicts };
}

export function setAtPath(value, path, replacement) {
  if (!path.length) return cloneData(replacement);
  const next = cloneData(value);
  let node = next;
  path.slice(0, -1).forEach((key) => {
    node = node[key];
  });
  node[path[path.length - 1]] = cloneData(replacement);
  return next;
}

export function blankAcquisition() {
  return {
    id: "",
    activityId: "",
    occurrenceId: "",
    title: "",
    kind: "限时活动",
    startDate: "",
    endDate: "",
    place: "",
    conditions: "",
    method: "",
    reward: "",
    sourceUrl: "",
    sourceLabel: "",
  };
}
export function blankOccurrence() {
  return {
    id: "",
    label: "",
    startDate: "",
    endDate: "",
    location: "",
    conditions: "",
    rewards: "",
    sourceUrl: "",
    sourceTitle: "",
    certainty: "待核验",
  };
}
export function blankMatchup() {
  return {
    id: "",
    opponent: "",
    scene: "",
    conclusion: "",
    conditions: "",
    limitations: "",
    recordedAt: "",
    testedAt: "",
    sourceUrl: "",
    sourceLabel: "",
    evidenceLabel: "待复现",
    claimRevision: "r1",
    myBloodline: { status: "unknown", names: [], note: "" },
    opponentBloodline: { status: "unknown", names: [], note: "" },
  };
}

const lines = (value) =>
  Array.isArray(value) ? value.join("\n") : String(value ?? "");
const LABELS = {
  id: "记录标识",
  activityId: "活动条目标识",
  occurrenceId: "开放批次标识",
  title: "名称",
  name: "名称",
  label: "本次开放名称",
  slug: "条目路径",
  summary: "描述",
  type: "属性",
  category: "技能类型",
  power: "威力",
  pp: "PP",
  priority: "先手",
  hit: "命中说明",
  startDate: "开始日期",
  endDate: "结束日期",
  place: "地点",
  location: "地点",
  conditions: "成立／参与条件",
  method: "获取方式",
  reward: "获得奖励",
  rewards: "奖励",
  sourceUrl: "来源链接",
  sourceLabel: "来源名称",
  sourceTitle: "来源名称",
  kind: "获取类型",
  opponent: "对手",
  scene: "上场情境",
  conclusion: "对位结论",
  limitations: "限制与例外",
  recordedAt: "资料日期",
  testedAt: "实测日期",
  evidenceLabel: "证据状态",
  claimRevision: "结论版本",
  role: "身份／职责",
  intro: "人物介绍",
  services: "提供的服务",
  relatedTasks: "相关任务",
  aliases: "别名",
  number: "游戏编号",
  types: "属性",
  group: "组别",
  series: "系列",
  experienceType: "经验类型",
  bloodlines: "血脉",
  ladderMagic: "天梯费用",
  heightM: "身高（米）",
  weightKg: "体重（千克）",
  color: "颜色",
  catchCategory: "捕捉分类",
  entrance: "游戏内入口",
  cadence: "开放与重置安排",
  rewardSummary: "主要奖励",
  sections: "分区与关卡",
  bosses: "BOSS／NPC",
  checkedAt: "资料核对日期",
  goals: "奖励目标",
  hp: "精力",
  attack: "攻击",
  defense: "防御",
  magicAttack: "魔攻",
  magicDefense: "魔抗",
  speed: "速度",
  challenge: "挑战对象",
  version: "适用版本",
  pets: "挑战宠物",
  requirements: "必要配置",
  steps: "操作步骤",
  alternatives: "替代方案",
  href: "站内去向",
  description: "用途说明",
  sourceEffect: "已有来源",
  incomingEffect: "新施加来源",
  order: "施加顺序",
  timing: "结算时点",
  result: "观察结果",
  certainty: "核验状态",
  reproduction: "复现步骤",
  when: "如果",
  effect: "则",
  otherwise: "否则",
  common: "基础效果",
  terms: "技能内名词定义",
  markdown: "正文",
  records: "记录",
  occurrences: "开放批次",
  phases: "效果分支",
  myBloodline: "当前宠物的本场血脉",
  opponentBloodline: "对手的本场血脉",
  deletionReason: "删除提议的理由",
  redirectTo: "替代条目",
  entries: "目录入口",
  learners: "学习关系补充",
  petSlug: "宠物条目标识",
  level: "学习等级",
};
export function fieldLabel(key) {
  return LABELS[key] || key;
}
const SCENES = {
  "lead-together": "同起",
  "switch-in": "后上拦截",
  "already-active": "先在场",
  unspecified: "尚未标明",
};

export function serializeData(mode, data) {
  if (mode === "article") return data.markdown || "";
  function write(value, depth = 0) {
    return Object.entries(value || {})
      .filter(([key]) => !["claimRevision", "sourceIds"].includes(key))
      .map(([key, item]) => {
        if (key === "method" && mode === "skill" && Array.isArray(data.learners)) return `学习方式：${item || "待补充"}`;
        if (key === "phases" && Array.isArray(item)) return `\n### 条件与效果分支\n${item.map((row) => serializeSkillBranch(row)).join("\n\n")}`;
        if (["myBloodline", "opponentBloodline"].includes(key)) return `${fieldLabel(key)}：${matchupBloodlineText(item)}${item?.note ? `；${item.note}` : ""}`;
        if (item == null || item === "") return `${fieldLabel(key)}：待补充`;
        if (
          Array.isArray(item) &&
          item.some((row) => row && typeof row === "object")
        )
          return `\n${"#".repeat(Math.min(3 + depth, 6))} ${fieldLabel(key)}\n${item.map((row, index) => `\n${index + 1}. ${row.title || row.name || row.label || row.opponent || `记录 ${index + 1}`}\n${write(row, depth + 1)}`).join("\n")}`;
        if (item && typeof item === "object" && !Array.isArray(item)) return `${fieldLabel(key)}\n${write(item, depth + 1)}`;
        return `${fieldLabel(key)}：${key === "scene" ? SCENES[item] || item : lines(item)}`;
      })
      .join("\n");
  }
  return write(data);
}

const validUrl = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};
export function validateSectionForm(form, context = {}) {
  const errors = {};
  const data = form.typedData || {};
  const mode = normalizeMode(form.editorMode);
  const requireField = (object, key, path = key, min = 1) => {
    if (String(object[key] ?? "").trim().length < min)
      errors[path] = `请填写${fieldLabel(key)}。`;
  };
  function source(object, prefix = "") {
    if (object.sourceUrl && !validUrl(object.sourceUrl))
      errors[`${prefix}sourceUrl`] =
        "请填写完整的 http:// 或 https:// 来源链接。";
  }
  function datePair(row, prefix) {
    if (!row.startDate)
      errors[`${prefix}startDate`] = "请填写本次开放的开始日期。";
    for (const key of ["startDate", "endDate"])
      if (row[key] && !validDate(row[key]))
        errors[`${prefix}${key}`] = "请填写有效日期。";
    if (row.startDate && row.endDate && row.endDate < row.startDate)
      errors[`${prefix}endDate`] = "结束日期不能早于开始日期。";
  }
  if (mode === "article") {
    if ((data.markdown || "").trim().length < 8)
      errors.markdown = "请填写有效的章节正文。";
    if (
      /<\/?[a-zA-Z][^>]*>|(^|\n)\s*(import|export)\s|javascript\s*:|data\s*:|\{\s*[^}]+\s*\}/im.test(
        data.markdown || "",
      )
    )
      errors.markdown =
        "正文仅支持受限 Markdown，请移除 HTML、MDX 表达式和脚本。";
  }
  if (mode === "acquisition") {
    if (!data.records?.length) errors.records = "至少保留一条获取记录。";
    (data.records || []).forEach((row, i) => {
      const prefix = `records.${i}.`;
      ["title", "place", "conditions", "reward", "sourceUrl"].forEach((key) =>
        requireField(row, key, prefix + key),
      );
      datePair(row, prefix);
      source(row, prefix);
    });
  }
  if (mode === "event") {
    requireField(data, "name");
    if (!data.occurrences?.length)
      errors.occurrences = "至少记录一次开放批次。";
    (data.occurrences || []).forEach((row, i) => {
      const prefix = `occurrences.${i}.`;
      ["label", "location", "conditions", "rewards", "sourceUrl"].forEach(
        (key) => requireField(row, key, prefix + key),
      );
      datePair(row, prefix);
      source(row, prefix);
    });
  }
  if (mode === "npc")
    ["name", "location", "role", "intro", "sourceUrl"].forEach((key) =>
      requireField(data, key),
    );
  if (mode === "skill" && form.editorRequest?.record === "learners") {
    requireField(data, "name");
    Object.assign(errors, validateSkillLearnerData(data, resolvePublishedCatalogPets({ pets: sourcePets, submissions: context.submissions || [] })));
  } else if (mode === "skill") {
    if (data.number !== "" && data.number != null && (!Number.isInteger(Number(data.number)) || Number(data.number) < 1)) errors.number = "技能编号须为已核实的正整数；未知时留空。";
    ["name", "summary"].forEach((key) => requireField(data, key));
    Object.assign(errors, validateSkillBranches(data.phases || []).errors);
    Object.assign(errors, skillTermErrors(data.terms));
  }
  if (mode === "matchup") {
    if (!data.records?.length) errors.records = "请新增一个 PVP 对位。";
    (data.records || []).forEach((row, i) => {
      const prefix = `records.${i}.`;
      [
        "opponent",
        "conclusion",
        "conditions",
        "limitations",
        "sourceUrl",
      ].forEach((key) => requireField(row, key, prefix + key));
      if (!["lead-together", "switch-in", "already-active", "unspecified"].includes(row.scene))
        errors[prefix + "scene"] = "请选择当前宠物的上场情境。";
      for (const side of ["myBloodline", "opponentBloodline"]) {
        const bloodline = normalizeMatchupBloodline(row[side]);
        if (bloodline.status === "specified" && !bloodline.names.length) errors[prefix + side] = "已选择指定血脉，请补充本场使用的血脉名称。";
        if (bloodline.status === "specified" && bloodline.names.length) {
          const identity = side === "myBloodline" ? form.editorRequest?.entity || form.target : row.opponent;
          const { options } = getPetBloodlineOptions(identity, { submissions: context.submissions || [] });
          if (bloodline.names.some((name) => !options.some((option) => option.value === name))) errors[prefix + side] = "所选名称不在该宠物已收录的血脉列表中，请先核对宠物资料，或标记为尚未记录。";
        }
      }
      source(row, prefix);
    });
  }
  if (mode === "pet") {
    for (const key of ["heightM", "weightKg"]) if (data[key] !== "" && data[key] != null && (!Number.isFinite(Number(data[key])) || Number(data[key]) <= 0)) errors[key] = "请填写大于 0 的数值；未知时留空。";
    if (data.catchCategory !== "" && data.catchCategory != null && (!Number.isInteger(Number(data.catchCategory)) || Number(data.catchCategory) < 0)) errors.catchCategory = "捕捉分类须为来源表中的非负整数；未知时留空。";
    requireField(data, "name");
    if (data.slug && !/^[a-z0-9][a-z0-9-]{0,99}$/.test(data.slug)) errors.slug = "路径标识只能使用小写字母、数字与连字符；新条目可留空。";
    if (form.editorRequest?.intent === "delete") {
      if (String(data.deletionReason || "").trim().length < 8) errors.deletionReason = "请具体说明为什么应删除这一只宠物条目，至少 8 个字。";
      if (data.redirectTo && safeInternalPath(data.redirectTo, "") === "") errors.redirectTo = "替代条目必须是站内路径。";
    }
    for (const key of [
      "number",
      "hp",
      "attack",
      "defense",
      "magicAttack",
      "magicDefense",
      "speed",
    ])
      if (
        data[key] !== "" &&
        data[key] != null &&
        (!Number.isInteger(Number(data[key])) || Number(data[key]) < 1)
      )
        errors[key] = "请填写正整数；未知项留空。";
  }
  if (mode === "pve-guide") {
    validatePveGuideData(data).forEach((error, index) => { errors[`pveGuide.${index}`] = error; });
    if (data.checkedAt && !validDate(data.checkedAt)) errors["pveGuide.date"] = "请填写有效的资料核对日期。";
  }
  if (mode === "pve")
    [
      "challenge",
      "pets",
      "requirements",
      "steps",
      "version",
      "sourceUrl",
    ].forEach((key) => requireField(data, key));
  if (mode === "index")
    (data.entries || []).forEach((row, i) => {
      requireField(row, "title", `entries.${i}.title`);
      if (safeInternalPath(row.href, "") === "")
        errors[`entries.${i}.href`] = "目录入口必须指向站内页面。";
    });
  if (mode === "index") {
    const directory = (form.editorRequest?.returnTo || "").split(/[?#]/)[0];
    if (["/pets/", "/skills/"].includes(directory) || (form.editorRequest?.intent !== "add" && ["/bloodlines/", "/npcs/", "/events/", "/places/", "/pve/"].includes(directory))) errors.scope = "资料目录由条目自动生成，请新增或编辑具体条目。";
    if (form.editorRequest?.intent === "add" && data.entries?.length !== 1) errors.entries = "新增入口每次只提交一条记录，不修改其他目录内容。";
    if (form.editorRequest?.intent === "add" && directory === "/places/") (data.entries || []).forEach((row, i) => {
      const target = safeInternalPath(row.href, "").split(/[?#]/)[0];
      if (!/^\/places\/[^/]+\/$/.test(target) || !contentRoutes.includes(target)) errors[`entries.${i}.href`] = "地点快捷入口须指向已经收录的地点页面，可带本页小节锚点。";
    });
  }
  if (mode === "relationship")
    [
      "sourceEffect",
      "incomingEffect",
      "order",
      "timing",
      "result",
      "reproduction",
    ].forEach((key) => requireField(data, key));
  source(data);
  if ((form.summary || "").trim().length < 6)
    errors.summary = "请用至少 6 个字说明这次修改。";
  if (form.evidenceUrl && !validUrl(form.evidenceUrl))
    errors.evidenceUrl = "请填写有效的来源链接。";
  if ((form.evidenceNote || "").trim().length < 8)
    errors.evidenceNote = "请说明来源中的具体位置或复现方法。";
  return errors;
}
