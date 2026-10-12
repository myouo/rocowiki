export function skillRulePresentation(skill) {
  const defaults = { base: skill.common || [], branches: skill.phases || [] };
  // A reviewed edit owns its condition tree; historical display overrides cannot hide it.
  if (skill.publishedRules) return defaults;
  const overrides = {
    linghuo: {
      base: ["尝试令对手烧伤。"],
      branches: [
        {
          label: "异常结果",
          when: "对手免疫烧伤",
          effect: "回复自身其他技能 PP，并追加固定伤害。",
        },
        {
          label: "命中判定",
          when: "场上存在天气",
          effect: "本技能必中；是否存在环境需另行判断，不直接当作天气。",
        },
        {
          label: "后手响应",
          when: "对手后手使用攻击技能",
          effect: "降低对手下回合的技能威力。",
          otherwiseWhen: "对手后手使用变化技能",
          otherwise: "回复自身精力。",
        },
      ],
    },
    xiufu: {
      base: skill.common,
      branches: [
        {
          label: "第 1 回合",
          when: "本次施加混乱被对手免疫",
          effect: "吸取对手 PP，同时回复自身 PP。",
        },
        {
          label: "第 2 回合",
          when: "本次清除场上天气与环境成功",
          effect: "降低自身攻击或防御强化。",
        },
        {
          label: "第 3 回合",
          when: "进入本阶段结算",
          effect: "对对手造成固定伤害。",
        },
      ],
    },
    shuilingdong: {
      base: [
        "净化自身，暂时免疫异常与负面强化并回复精力。",
        "持续造成固定伤害并回复自身精力；来源记载持续 2–5 回合。",
      ],
      branches: [
        {
          label: "天气判定",
          when: "处于阴雨天气",
          effect: "获得护盾，额度与本次回复量相同。",
        },
      ],
    },
    yupiaoyao: {
      base: ["连续 3 回合施加负面强化，强化种类随回合变化。"],
      branches: [
        {
          label: "首回合",
          when: "本次连续技能的第 1 回合",
          effect: "清除对手正面强化，并召唤 6 回合阴雨。",
        },
      ],
    },
    chenshiji: {
      base: ["对手负面强化的种类与等级影响本技能威力。"],
      branches: [
        {
          label: "天气判定",
          when: "处于阴雨天气",
          effect: "先降低对手物防，再结算伤害。",
        },
      ],
    },
    feiyanlingbo: {
      base: ["回复己方全体精力。"],
      branches: [
        {
          label: "PP 关联",
          input: true,
          when: "本技能剩余 PP",
          effect:
            "据此决定对己方全体的强化效果；具体 PP 与强化的对应数值待补。",
        },
      ],
    },
  };
  return overrides[skill.slug] || defaults;
}

export const skillSortFields = [
  { value: "name", label: "技能名称", group: "基本资料" },
  { value: "type", label: "属性", group: "基本资料" },
  { value: "category", label: "技能类别", group: "基本资料" },
  { value: "power", label: "基础威力", group: "数值参数" },
  { value: "pp", label: "PP", group: "数值参数" },
  { value: "priority", label: "先手值", group: "数值参数" },
];

export function availableSkillSortFields(skills) {
  const fields = skills.some((skill) => Number.isFinite(skill.number))
    ? [{ value: "number", label: "技能编号", group: "基本资料" }, ...skillSortFields]
    : skillSortFields;
  return fields;
}

export function getSkillSortValue(skill, field) {
  const value = skill[field];
  if (["number", "power", "pp", "priority", "speedCode"].includes(field)) return Number.isFinite(value) ? value : null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function sortCatalogSkills(skills, field = "name", order = "asc") {
  return skills.map((skill, index) => ({ skill, index })).sort((a, b) => {
    const av = getSkillSortValue(a.skill, field), bv = getSkillSortValue(b.skill, field);
    if (av == null && bv != null) return 1;
    if (bv == null && av != null) return -1;
    const difference = av == null ? 0 : typeof av === "string" ? av.localeCompare(bv, "zh-CN") : av - bv;
    return difference ? difference * (order === "desc" ? -1 : 1) : a.index - b.index;
  }).map(({ skill }) => skill);
}
