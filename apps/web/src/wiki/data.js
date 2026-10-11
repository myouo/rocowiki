import { petSourceData, petMetadata, officialPetData, publicSearchRecords } from "./content/bundled.js";
import { buildOfficialPetCatalog, petCatalogHref } from "./catalog/pets/officialModel";

const sourcePets = Array.isArray(petSourceData)
  ? petSourceData
  : petSourceData.pets || [];
export const pets = buildOfficialPetCatalog(officialPetData, sourcePets, petMetadata.pets);
export const skillSource = "https://news.4399.com/luoke/jinengsearch/";
export const haifuSource = "https://roco.dvg.cn/spirit_info.php?id=3092";
export const skills = [
  {
    slug: "xiazi",
    name: "霞姿月韵",
    type: "神水",
    category: "变化",
    power: null,
    pp: 6,
    priority: 7,
    tags: ["防控", "环境", "回复PP"],
    owner: "海芙约忒",
    ownerSlug: "haifu",
    source: haifuSource,
    hit: "来源未单独说明",
    summary: "净化与续航；召唤环境，首回合和后续回合的 PP 回复条件不同。",
    common: [
      "净化自身并回复精力；异常免疫与海市蜃楼环境均持续 6 回合。",
      "环境伤害及固伤减免、威力技能追加伤害存在联动，精确数值待实测。",
    ],
    phases: [
      {
        label: "首回合",
        when: "对手存在睡眠状态",
        effect: "吞噬睡眠并转为 PP。",
      },
      {
        label: "后续回合",
        when: "其他技能 PP 损耗达到条件",
        effect: "额外回复 PP；阈值待核实。",
      },
    ],
  },
  {
    slug: "yuanyun",
    name: "渊云点墨",
    type: "神水",
    category: "变化",
    power: null,
    pp: 8,
    priority: 4,
    tags: ["防控", "治疗", "专属资源"],
    owner: "海芙约忒",
    ownerSlug: "haifu",
    source: haifuSource,
    hit: "来源未单独说明",
    summary: "消耗怒气；免疫、治疗及后续技能效果随消耗量变化。",
    common: ["消耗已积累怒气，净化并获得异常免疫；每回合首次受伤可触发治疗。"],
    phases: [
      {
        label: "资源判定",
        when: "消耗怒气较多",
        effect: "触发额外技能联动；精确阈值与分支需结合血脉核实。",
      },
      {
        label: "额外分支",
        when: "消耗满额怒气",
        effect: "获得战意，回复霞姿月韵 PP 并删对手 PP。",
      },
    ],
  },
  {
    slug: "diezhang",
    name: "叠嶂扶影",
    type: "神水",
    category: "魔法",
    power: 80,
    pp: 10,
    priority: 3,
    tags: ["格挡", "天气", "异常"],
    owner: "海芙约忒",
    ownerSlug: "haifu",
    source: haifuSource,
    hit: "来源未单独说明",
    summary: "冰冻、阴雨与格挡联动；连续使用需要额外 PP。",
    common: ["格挡对手下次威力伤害；连续使用增加 PP 消耗。"],
    phases: [
      {
        label: "异常判定",
        when: "冰冻被免疫，或天气环境不利",
        effect: "召唤阴雨 3 回合。",
      },
      {
        label: "跨次联动",
        when: "本回合成功格挡",
        effect: "下次使用时依格挡威力追加神水魔法伤害。",
      },
    ],
  },
  {
    slug: "tianhe",
    name: "天河夜转",
    type: "神水",
    category: "魔法",
    power: 120,
    pp: 12,
    priority: 2,
    tags: ["护盾关联", "回复PP", "删除PP"],
    owner: "海芙约忒",
    ownerSlug: "haifu",
    source: haifuSource,
    hit: "来源未单独说明",
    summary: "根据护盾增强威力；按双方精力关系分支处理吸取或回复。",
    common: ["对手护盾影响威力；删除对手 PP。"],
    phases: [
      {
        label: "精力比较",
        when: "对手精力占优",
        effect: "吸取对手精力，怒气影响效果。",
        otherwise: "回复自身其他技能 PP。",
      },
    ],
  },
  {
    slug: "feixing",
    name: "飞星浮渡",
    type: "神水",
    category: "魔法",
    power: 110,
    pp: 12,
    priority: 2,
    tags: ["环境", "回复PP", "条件必中"],
    owner: "海芙约忒",
    ownerSlug: "haifu",
    source: haifuSource,
    hit: "乘胜状态下必中",
    summary: "召唤海市蜃楼；环境结果与 PP 回复共同影响后续效果。",
    common: ["召唤海市蜃楼 3 回合；怒气影响威力。"],
    phases: [
      {
        label: "环境结果",
        when: "召唤环境失败",
        effect: "PP 回复增强，并让对手技能在 4 回合内增加 PP 消耗。",
      },
      { label: "命中判定", when: "处于乘胜状态", effect: "本技能必中。" },
    ],
  },
  {
    slug: "linghuo",
    name: "灵火之杖",
    type: "火",
    category: "物理",
    power: 90,
    pp: 8,
    priority: 2,
    tags: ["条件必中", "回复PP", "异常"],
    owner: "幻晶灵巫",
    ownerSlug: null,
    source: skillSource,
    hit: "任意天气下必中",
    summary: "烧伤失败可触发回复与固伤；对方后手技能类型影响后续效果。",
    common: ["尝试烧伤对方；被免疫时回复其他技能 PP 并追加一段固伤。"],
    phases: [
      {
        label: "命中规则",
        when: "场上存在任意天气",
        effect: "必定命中。环境是否等同天气不作扩张解释。",
      },
      {
        label: "后手响应",
        when: "对方后手使用攻击技能",
        effect: "下回合降低其技能威力。",
        otherwise: "若对方后手使用变化技能，回复自身精力。",
      },
    ],
  },
  {
    slug: "xiufu",
    name: "袖拂尘散",
    type: "普通",
    category: "变化",
    power: null,
    pp: 8,
    priority: 2,
    tags: ["连续回合", "删除PP", "清除天气"],
    owner: "兔仙人",
    ownerSlug: null,
    source: skillSource,
    hit: "来源未单独说明",
    summary: "连续 3 回合，三个阶段分别处理异常、场地与固定伤害。",
    common: ["连续 3 回合发动；期间含技能先手的变化。"],
    phases: [
      {
        label: "第 1 回合",
        when: "尝试令对方混乱",
        effect: "若混乱被免疫，吸取对方 PP 并回复自身 PP。",
      },
      {
        label: "第 2 回合",
        when: "清除场上天气与环境",
        effect: "清除成功时降低自身攻击或防御强化。",
      },
      {
        label: "第 3 回合",
        when: "本阶段结算",
        effect: "对对方造成固定伤害。",
      },
    ],
  },
  {
    slug: "wufa",
    name: "巫法重击",
    type: "火",
    category: "物理",
    power: null,
    pp: 7,
    priority: null,
    tags: ["连续回合", "固定伤害", "删除PP"],
    owner: "幻晶灵巫",
    ownerSlug: null,
    source: skillSource,
    hit: "来源未单独说明",
    summary: "连续 2 回合固定伤害，首末回合的额外效果不同。",
    common: ["连续 2 回合造成固定伤害。"],
    phases: [
      {
        label: "第 1 回合",
        when: "首次发动",
        effect: "清除自身负面，并波及对方队友。",
      },
      {
        label: "末回合",
        when: "场上不是暴晒天气",
        effect: "触发删 PP；涉及的具体技能目标范围待核实。",
      },
    ],
  },
];
for (const p of pets.filter((p) => p.slug === "bishui"))
  for (const [i, s] of (p.skills || []).entries())
    skills.push({
      ...s,
      slug: s.slug,
      owner: p.name,
      ownerSlug: p.slug,
      source: p.sourceUrl,
      hit: "来源未单独说明",
      tags:
        s.name === "水灵动"
          ? ["防控", "护盾"]
          : s.name === "雨飘摇"
            ? ["连续回合", "天气"]
            : ["培养参考"],
      common: [s.summary],
      phases: [],
    });
export const historicalEvent = {
  slug: "fun-chess-20251128",
  title: "趣味对弈",
  from: "2025-11-28",
  to: "2026-01-08",
  reward: "华魇萌少进化资格",
  source:
    "https://roco.qq.com/webplat/info/news_version3/397/838/839/840/m682/202511/978612.shtml",
};
export const mechanicLinks = [
  ["/mechanics/priority/", "速度与先手", "基础先手、修正与行动顺序"],
  ["/mechanics/pp/", "PP 与技能限制", "当前、上次与全部技能"],
  ["/mechanics/weather/", "天气与环境", "召唤、替换与清除"],
  ["/mechanics/status/", "异常与强化", "防控、免疫、净化与重置"],
  ["/mechanics/shield/", "护盾与伤害", "威力、固伤与格挡"],
  ["/mechanics/stages/", "技能与回合", "连续回合、分段与触发时点"],
];
export const places = [
  {
    slug: "castle",
    name: "王国城堡",
    region: "王国中心",
    role: "城堡与王国事务",
    entries: ["场景入口", "人物与服务", "相关任务"],
    npc: "兰斯洛",
    npcSlug: "lancelot",
  },
  {
    slug: "academy",
    name: "魔法学院",
    region: "王国中心",
    role: "学院与教学",
    entries: ["学院场景", "人物与服务", "入门指引"],
    npc: "格里芬院长",
    npcSlug: "griffin",
  },
  {
    slug: "mermaid-bay",
    name: "人鱼湾",
    region: "沿海地区",
    role: "海湾与水系资料",
    entries: ["地区场景", "宠物捕捉", "相关活动"],
  },
  {
    slug: "snow-valley",
    name: "雪人谷",
    region: "冰雪地区",
    role: "冰雪场景与探索",
    entries: ["地区场景", "宠物捕捉", "相关挑战"],
  },
  {
    slug: "xuan-yu",
    name: "玄玉岛",
    region: "玄玉地区",
    role: "玄玉地区资料",
    entries: ["地区场景", "人物与任务", "相关宠物"],
  },
  {
    slug: "sky",
    name: "天空城",
    region: "空中地区",
    role: "空中场景与探索",
    entries: ["进入条件", "地区场景", "徽章挑战"],
  },
];
export const npcs = [
  {
    slug: "griffin",
    name: "格里芬院长",
    role: "魔法学院",
    place: "academy",
    intro: "按人物集中查找出现场景、对话任务与提供的服务。",
    source: "https://roco.qq.com/",
  },
  {
    slug: "lancelot",
    name: "兰斯洛",
    role: "王国城堡",
    place: "castle",
    intro: "场景入口与任务资料集中在人物页，不与地图详情混用模板。",
    source: "https://roco.qq.com/",
  },
];
export const docTitles = {
  "/guides/training/": "宠物培养资料",
  "/guides/returning/": "回归先查什么",
  "/guides/pve/": "挑战攻略怎么查",
  "/help/sources/": "资料来源与验证",
  "/help/contributing/": "参与编辑",
  "/mechanics/weather/": "天气与环境",
  "/mechanics/environments/mirage/": "海市蜃楼（环境）",
  "/mechanics/stages/": "技能阶段与结算",
  "/mechanics/pp/": "PP 与技能限制",
  "/mechanics/priority/": "速度与先手",
  "/mechanics/status/": "异常、强化与标记",
  "/mechanics/overview/": "战斗机制总目录",
  "/mechanics/shield/": "护盾与减伤",
  "/mechanics/attributes/": "属性、能力与克制",
  "/mechanics/accuracy/": "命中、必中与闪避",
  "/mechanics/damage/": "伤害类型与结算",
  "/mechanics/healing/": "治疗、禁疗与转化",
  "/mechanics/switching/": "换宠、驱逐与场下",
  "/mechanics/passive/": "血脉与被动触发",
  "/mechanics/timing/": "触发顺序与结算时点",
  "/mechanics/effects/": "效果档案与同名识别",
  "/mechanics/interactions/": "覆盖、共存与解除",
  "/mechanics/effects/pressure/": "压迫（双损）",
  "/mechanics/evidence/": "机制实测与争议记录",
  "/mechanics/glossary/": "战斗术语速查",
};
export function getSearchRecords() {
  return [
    ...publicSearchRecords,
    ...[
      {
        title: "战斗机制",
        kind: "机制",
        to: "/mechanics/",
        meta: "独立机制目录 · 行动、伤害、状态与结算",
        keywords: "战斗系统 洛学 机制 百科 总览 规则",
      },
      {
        title: "效果关系对照",
        kind: "机制",
        to: "/mechanics/relations/",
        meta: "已有与新施加 · 条件、方向与来源",
        keywords: "buff 覆盖 优先级 共存 互斥 叠加 刷新 解除 同名 双损 压迫",
      },
      {
        title: "海芙约忒 · 血脉与专属资源",
        kind: "血脉",
        to: "/bloodlines/haifu/",
        meta: "专属资源与技能联动",
        keywords: "海芙 怒气 战意 乘胜 被动 血脉",
      },
      {
        title: "星辰之塔",
        kind: "挑战",
        to: "/pve/star-tower/",
        meta: "PVE · 玩法、奖励与 Boss 攻略",
        keywords: "星塔 挑战 BOSS 层数 PVE",
      },
      {
        title: "HP药剂",
        kind: "物品",
        to: "/items/potion/",
        meta: "道具类别 · 回复精力",
        keywords: "药水 治疗 药剂 商店",
      },
      {
        title: "徽章任务",
        kind: "任务",
        to: "/tasks/badges/",
        meta: "十类徽章资料目录",
        keywords: "草 火 水 电 翼 冰 土 幽 毒 龙 徽章",
      },
      {
        title: "宠物对比",
        kind: "工具",
        to: "/tools/compare/",
        meta: "最多三只 · 基础数据与重点技能",
        keywords: "对比 种族值 比较",
      },
      {
        title: "伤害计算器",
        kind: "工具",
        to: "/tools/damage/",
        meta: "普通威力伤害 · 固定计算口径与适用条件",
        keywords: "伤害 物理 魔法 威力 攻击 防御 计算",
      },
      {
        title: "能力计算器",
        kind: "工具",
        to: "/tools/stats/",
        meta: "六项能力 · 等级、天赋、努力与性格",
        keywords: "能力 种族 天赋 努力 性格 满级 亲密 装备 守护兽 面板",
      },
      {
        title: "赛事与禁赛",
        kind: "规则",
        to: "/battle/",
        meta: "按模式与日期核对规则",
        keywords: "天梯 系别 巅峰 禁赛 禁止 宠物 赛季",
      },
      {
        title: "PVE 指南",
        kind: "PVE",
        to: "/pve/",
        meta: "副本总目录 · 门槛、奖励与打法",
        keywords: "挑战 攻略 BOSS PVE 副本",
      },
      {
        title: "山海秘境",
        kind: "挑战",
        to: "/pve/shanhai/",
        meta: "PVE · 属性秘境与挑战路线",
        keywords: "山海 秘境 挑战 副本",
      },
      {
        title: "哨兵因因的情报",
        kind: "挑战",
        to: "/pve/sentry-intelligence/",
        meta: "PVE · 情报、赏金与挑战",
        keywords: "哨兵因因 哨兵阴阴 赏金 挑战 BOSS",
      },
      {
        title: "勇者训练馆",
        kind: "挑战",
        to: "/pve/training-hall/",
        meta: "PVE · 普通馆与终极馆",
        keywords: "勇者挑战馆 勇者 训练馆 挑战 副本",
      },
      {
        title: "七曜圣地",
        kind: "挑战",
        to: "/pve/seven-sanctuaries/",
        meta: "PVE · 每日挑战与奖励",
        keywords: "七曜 圣地 挑战 副本",
      },
      {
        title: "任务与剧情",
        kind: "任务",
        to: "/tasks/",
        meta: "主线、支线与徽章入口",
        keywords: "故事 主线 支线 前置 NPC",
      },
      {
        title: "贡献中心",
        kind: "共建",
        to: "/community/",
        meta: "待完善任务与贡献署名",
        keywords: "纠错 反馈 补充 编辑 审核 贡献",
      },
    ],
    ...pets.map((p) => ({
      title: p.name,
      kind: "宠物",
      to: petCatalogHref(p),
      meta: "#" + (p.number ?? "待录入") + " · " + p.types.join(" / "),
      keywords: [...p.aliases, ...p.types].join(" "),
    })),
    ...skills.map((s) => ({
      title: s.name,
      kind: "技能",
      to: "/skills/" + s.slug + "/",
      meta: s.type + " · " + s.category + " · " + s.owner,
      keywords: s.tags.join(" ") + " " + s.owner,
    })),
    ...places.map((p) => ({
      title: p.name,
      kind: "场景",
      to: "/places/" + p.slug + "/",
      meta: p.region,
      keywords: p.role,
    })),
    ...Object.entries(docTitles).map(([to, title]) => ({
      title,
      kind: to.includes("/environments/")
        ? "环境"
        : to.startsWith("/mechanics")
          ? "机制"
          : "指南",
      to,
      meta: "知识文档",
      keywords:
        title +
        " " +
        ({
          "/mechanics/status/": "异常 防控 免疫 净化 强化 重置 标记",
          "/mechanics/environments/mirage/":
            "海市蜃楼 幻象长眠 霞姿月韵 飞星浮渡 海芙约忒 环境 召唤",
          "/guides/returning/": "回归玩家指南 老玩家",
          "/guides/training/": "宠物培养指南 性格 努力 装备",
          "/guides/pve/": "挑战攻略怎么选 PVE",
          "/help/contributing/": "贡献指南 编辑 纠错",
          "/help/sources/": "资料与来源规范 验证",
          "/mechanics/stages/": "技能与回合 连续 多段 结算",
          "/mechanics/shield/": "护盾与伤害 固伤 格挡",
          "/mechanics/overview/": "机制目录 系统规则 行动 伤害 状态 资源 战场",
          "/mechanics/attributes/": "属性 克制 抵抗 种族值 能力 面板 强化",
          "/mechanics/accuracy/": "命中 必中 必闪 闪避 致盲 失明 未命中",
          "/mechanics/damage/": "威力 固伤 段伤 反伤 反弹 波及 自损 伤害基准",
          "/mechanics/healing/": "治疗 回复 回血 禁疗 减疗 毒奶 转化 锁血",
          "/mechanics/switching/":
            "换宠 驱逐 防踢 下场 场下 下一只 背包 顺位 连锁",
          "/mechanics/passive/": "血脉 被动 上场 携带 专属资源 计数 标记 触发",
          "/mechanics/timing/":
            "结算 顺序 时机 回合 持续 首段 末段 带出 到期 清理",
          "/mechanics/effects/": "buff 效果 状态 标识 同名 来源 叠层 刷新 覆盖",
          "/mechanics/interactions/":
            "覆盖 优先级 同名 共存 互斥 解除 冲突 叠加 配对",
          "/mechanics/effects/pressure/":
            "压迫 双损 额外 PP 消耗 沉彩飞光 烟波长静 太阳的守护 孤壑分疆 庸惟虚灭",
          "/mechanics/evidence/": "实测 证据 争议 历史 版本 复核 录像 日志",
          "/mechanics/glossary/":
            "术语 简写 名词 缩写 防控 清强 波及 毒奶 双损",
        }[to] || ""),
    })),
    {
      title: "趣味对弈",
      kind: "活动",
      to: "/events/fun-chess-20251128/",
      meta: "历史活动 · 2025-11",
      keywords: "华魇萌少 获取 进化",
    },
    ...npcs.map((n) => ({
      title: n.name,
      kind: "人物",
      to: "/npcs/" + n.slug + "/",
      meta: n.role,
      keywords: n.role,
    })),
  ];
}
