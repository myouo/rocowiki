/**
 * 洛克王国页游 calculator rules. These are deliberately separate from the UI.
 * Source: 官方论坛版主团《PK入门·1》, summary formula images (2026-04-14).
 * These are community documentation on the official forum, not game source code.
 */
import { calculatorMappings } from "./content/bundled.js";

export const CALCULATOR_DATA_VERSION = calculatorMappings.version;
export const CALCULATOR_MAPPING_SOURCE = calculatorMappings.source;
export const STAT_NAMES = ["精力", "物攻", "物防", "魔攻", "魔抗", "速度"];
export const STAT_KEYS = [
  "hp",
  "attack",
  "defense",
  "magicAttack",
  "magicDefense",
  "speed",
];

// boost/drop indices use the six-stat order above. Store ratios as integers so
// floor(110 × 1.1) is not exposed to floating-point representation artifacts.
export const NATURES = [
  ["坦率", null, null],
  ["害羞", null, null],
  ["认真", null, null],
  ["实干", null, null],
  ["浮躁", null, null],
  ["固执", 1, 3],
  ["孤僻", 1, 2],
  ["调皮", 1, 4],
  ["勇敢", 1, 5],
  ["保守", 3, 1],
  ["稳重", 3, 2],
  ["马虎", 3, 4],
  ["冷静", 3, 5],
  ["大胆", 2, 1],
  ["淘气", 2, 3],
  ["无虑", 2, 4],
  ["悠闲", 2, 5],
  ["沉着", 4, 1],
  ["慎重", 4, 3],
  ["温顺", 4, 2],
  ["狂妄", 4, 5],
  ["胆小", 5, 1],
  ["开朗", 5, 3],
  ["急躁", 5, 2],
  ["天真", 5, 4],
].map(([name, boost, drop]) => ({
  value: name,
  name,
  boost,
  drop,
  label:
    boost === null
      ? `${name} · 平衡`
      : `${name} · +${STAT_NAMES[boost]} / −${STAT_NAMES[drop]}`,
  group: boost === null ? "平衡" : `${STAT_NAMES[boost]}提升`,
}));

export const RELATIONSHIPS = [
  { value: "none", label: "未培养亲密度", bonus: [0, 0, 0, 0, 0, 0] },
  { value: "friendly", label: "友好 · 无额外加成", bonus: [0, 0, 0, 0, 0, 0] },
  {
    value: "inseparable",
    label: "形影 · 精力、物攻各 +10",
    bonus: [10, 10, 0, 0, 0, 0],
  },
  {
    value: "kindred",
    label: "灵犀 · 精力、魔攻各 +10",
    bonus: [10, 0, 0, 10, 0, 0],
  },
  {
    value: "intimate",
    label: "亲密 · 精力、物防各 +10",
    bonus: [10, 0, 10, 0, 0, 0],
  },
  {
    value: "loyal",
    label: "不弃 · 精力、魔抗各 +10",
    bonus: [10, 0, 0, 0, 10, 0],
  },
];

export const GUARDIAN_LEVELS = calculatorMappings.guardian.levels;
export const GUARDIAN_RANGES = calculatorMappings.guardian.ranges;
// Legacy values are bonuses, not levels. Kept only to read pre-V7.3 links.
export const GUARDIAN_OPTIONS = [
  { value: "0", label: "不计守护兽", bonus: 0, from: 0, to: 0 },
  ...GUARDIAN_RANGES.map((range) => ({ value: String(range.bonus[0]), label: `Lv. ${range.from}–${range.to}`, bonus: range.bonus[0], from: range.from, to: range.to })),
];

export const EQUIPMENT_SLOTS = [["accessory", "饰品", [0]], ["weapon", "武器", [1, 3]], ["armor", "防具", [2, 4]]];
export const EQUIPMENT = Object.fromEntries(EQUIPMENT_SLOTS.map(([slot, label, indices]) => [slot, [
  { value: "none", name: `未穿戴${label}`, label: `不穿戴${label}`, stat: indices[0], bonus: 0 },
  ...calculatorMappings.equipment[slot].map((item) => ({ ...item, label: `${item.name} · ${STAT_NAMES[item.stat]} +${item.bonus}` })),
  { value: "custom", name: `手动${label}`, label: "其他装备 · 按面板填写", manual: true },
]]));

export function guardianForLevel(value, levels = GUARDIAN_LEVELS) {
  const level = parseInteger(value, 0, 40);
  if (level === null) return { valid: false, error: "守护兽等级须为 0–40 的整数；0 表示不计加成。" };
  if (level === 0) return { valid: true, level, bonus: [0, 0, 0, 0, 0, 0], disabled: true };
  const bonus = levels[String(level)];
  if (!Array.isArray(bonus) || bonus.length !== 6 || bonus.some((x) => !Number.isSafeInteger(x) || x < 0) || bonus[5] !== 0)
    return { valid: false, level, error: `守护兽 ${level} 级的映射尚未核对，暂不计算。` };
  return { valid: true, level, bonus: [...bonus], version: CALCULATOR_DATA_VERSION };
}

export function normalizeGuardianInput(input) {
  if (Object.prototype.hasOwnProperty.call(input, "guardianLevel") || !Object.prototype.hasOwnProperty.call(input, "guardian")) return { ...input };
  const legacy = GUARDIAN_OPTIONS.find((item) => item.value === String(input.guardian));
  if (!legacy) return { ...input, guardianLevel: "" };
  return { ...input, guardianLevel: String(legacy.from), guardianLegacyRange: legacy.from !== legacy.to ? `${legacy.from}–${legacy.to}` : "" };
}

export function statsEquipmentDetails(input) {
  return EQUIPMENT_SLOTS.map(([slot, label, indices]) => {
    const item = EQUIPMENT[slot].find((entry) => entry.value === input[slot]);
    if (!item) return { slot, label, valid: false, error: `请选择已收录的${label}或按面板填写。` };
    if (!item.manual) return { ...item, slot, slotLabel: label, valid: true };
    const stat = slot === "accessory" ? 0 : STAT_KEYS.indexOf(input[slot + "Stat"]);
    const bonus = parseInteger(input[slot + "Bonus"], 0, 9999);
    if (!indices.includes(stat) || bonus === null) return { slot, label, valid: false, error: `${label}主加成须选择对应能力，数值为 0–9999 的整数。` };
    return { ...item, slot, slotLabel: label, stat, bonus, valid: true, label: `手动${label} · ${STAT_NAMES[stat]} +${bonus}` };
  });
}

export function parseInteger(value, min, max) {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    !/^\d+$/.test(String(value))
  )
    return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max
    ? number
    : null;
}

export function calculateStats(input) {
  input = normalizeGuardianInput(input || {});
  const errors = [];
  const warnings = [];
  const level = parseInteger(input.level, 1, 100);
  if (level === null) errors.push("等级必须是 1–100 的整数。");
  const nature = NATURES.find((item) => item.value === input.nature);
  if (!nature) errors.push("请选择已收录的性格。");
  const relationship = RELATIONSHIPS.find(
    (item) => item.value === input.relationship,
  );
  if (!relationship) errors.push("请选择已收录的亲密关系。");
  const guardian = guardianForLevel(input.guardianLevel);
  if (!guardian.valid) errors.push(guardian.error);
  if (input.guardianLegacyRange) warnings.push(`旧链接只记录了 ${input.guardianLegacyRange} 级的加成阶段，暂按该区间起始等级代入；请确认实际等级。`);

  const normalized = {};
  for (const [key, maximum, label] of [
    ["base", 999, "种族值"],
    ["talent", 31, "天赋"],
    ["effort", 255, "努力值"],
    ["intimacy", 20, "亲密值分配"],
  ]) {
    const values = Array.isArray(input[key]) ? input[key] : [];
    normalized[key] = STAT_NAMES.map((name, index) => {
      const value = parseInteger(
        values[index],
        key === "base" ? 1 : 0,
        maximum,
      );
      if (value === null)
        errors.push(
          `${name}${label}须为 ${key === "base" ? 1 : 0}–${maximum} 的整数。`,
        );
      return value;
    });
  }
  const effortTotal = normalized.effort.reduce(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  const intimacyTotal = normalized.intimacy.reduce(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  if (effortTotal > 510)
    errors.push(`努力值总和为 ${effortTotal}，超过 510 点上限。`);
  if (
    normalized.intimacy.some(
      (value, index) => (value ?? 0) % 10 !== 0 || (index === 5 && value !== 0),
    )
  ) {
    errors.push("亲密值按 10 点分配，速度不能分配亲密值。");
  }
  if (relationship?.value === "none" && intimacyTotal !== 0)
    errors.push("未培养亲密度时，亲密值分配应为 0。");
  if (relationship && relationship.value !== "none" && intimacyTotal !== 50)
    errors.push("已培养亲密关系时，请分配全部 50 点亲密值。");

  const equipmentBonus = [0, 0, 0, 0, 0, 0];
  const equipment = statsEquipmentDetails(input);
  for (const item of equipment) {
    if (!item.valid) errors.push(item.error);
    else if (item.minLevel && level !== null && level < item.minLevel)
      errors.push(
        `${item.label.split(" · ")[0]}需要宠物达到 ${item.minLevel} 级。`,
      );
    else equipmentBonus[item.stat] += item.bonus;
    if (item.manual) warnings.push(`${item.slotLabel}加成来自手动面板输入，穿戴条件与特殊效果需自行核对。`);
  }
  if (errors.length)
    return { valid: false, errors, warnings, effortTotal, intimacyTotal };

  const rows = STAT_NAMES.map((name, index) => {
    const effortPart = Math.floor(normalized.effort[index] / 4);
    const intimacyPart = normalized.intimacy[index] + relationship.bonus[index];
    const levelPart = Math.floor(
      ((normalized.base[index] * 2 +
        normalized.talent[index] +
        effortPart +
        intimacyPart) *
        level) /
        100,
    );
    const neutral = levelPart + (index === 0 ? level + 10 : 5);
    const natureNumerator =
      index === nature.boost ? 11 : index === nature.drop ? 9 : 10;
    const cultivated = Math.floor((neutral * natureNumerator) / 10);
    const panel = cultivated + equipmentBonus[index];
    const guardianBonus = guardian.bonus[index];
    return {
      key: STAT_KEYS[index],
      name,
      base: normalized.base[index],
      effortPart,
      intimacyPart,
      levelPart,
      neutral,
      natureNumerator,
      cultivated,
      equipment: equipmentBonus[index],
      guardian: guardianBonus,
      panel,
      battle: panel + guardianBonus,
    };
  });
  return {
    valid: true,
    errors: [],
    warnings,
    guardian,
    equipment,
    dataVersion: CALCULATOR_DATA_VERSION,
    rows,
    panel: rows.map((row) => row.panel),
    battle: rows.map((row) => row.battle),
    effortTotal,
    intimacyTotal,
  };
}

// Twenty-one hundredth-step coefficients are directly visible in the 2022
// author experiment. They are enumerated; this is not a user-defined range.
export const DAMAGE_ROLLS = Array.from(
  { length: 21 },
  (_, index) => 80 + index,
);
export const DAMAGE_MATCHUPS = [
  { value: "neutral", label: "普通 · ×1", numerator: 1, denominator: 1 },
  { value: "resisted", label: "单重抵抗 · ×0.5", numerator: 1, denominator: 2 },
  { value: "effective", label: "单重克制 · ×2", numerator: 2, denominator: 1 },
  { value: "other", label: "双属性 / 神系 / 特殊克制（未纳入）" },
];

/**
 * A historical ordinary-power reference model, NOT an exact client simulator.
 * The published basic expression is (L+5)*P*A/(125*D)+2. The reference result
 * is floored once, after relation and random coefficient. Primary sources do
 * not establish intermediate client rounding; this uncertainty is shown in UI.
 * BigInt fractions make the implemented convention deterministic and auditable.
 */
export function calculateDamage(input) {
  const errors = [];
  const bounds = [
    ["level", 1, 100, "攻击方等级"],
    ["power", 1, 1000, "技能威力"],
    ["attack", 1, 9999, "攻击能力"],
    ["defense", 1, 9999, "防御能力"],
    ["hp", 1, 99999, "目标当前精力"],
  ];
  const values = {};
  for (const [key, minimum, maximum, label] of bounds) {
    values[key] = parseInteger(input[key], minimum, maximum);
    if (values[key] === null)
      errors.push(`${label}须为 ${minimum}–${maximum} 的整数。`);
  }
  if (!["physical", "magic"].includes(input.category))
    errors.push("请选择物理或魔法类别。");
  const matchup = DAMAGE_MATCHUPS.find((item) => item.value === input.matchup);
  if (!matchup) errors.push("请选择已收录的克制关系。");
  if (!["ordinary", "special"].includes(input.mode))
    errors.push("请选择伤害类型。");
  if (!["plain", "modified"].includes(input.conditions))
    errors.push("请选择适用条件。");
  if (errors.length) return { valid: false, errors, supported: false };
  if (input.mode !== "ordinary")
    return {
      valid: true,
      supported: false,
      errors: [],
      reason:
        "固定伤害、条件威力、斩杀、多段与波及需要各自的技能公式，不能套用普通威力公式。",
    };
  if (input.conditions !== "plain")
    return {
      valid: true,
      supported: false,
      errors: [],
      reason:
        "当前模型未核验本系加成、暴击、天气环境、血脉、护盾和限伤的组合顺序。请先查对应机制和技能记录。",
    };
  if (!matchup.numerator)
    return {
      valid: true,
      supported: false,
      errors: [],
      reason:
        "双属性与神系的克制规则未纳入这一普通单重模型，不能把两次克制直接相乘。",
    };

  const { level, power, attack, defense, hp } = values;
  const denominator = BigInt(125 * defense);
  const numerator = BigInt((level + 5) * power * attack) + 2n * denominator;
  const rolls = DAMAGE_ROLLS.map((coefficient) => {
    const damage = Number(
      (numerator * BigInt(matchup.numerator) * BigInt(coefficient)) /
        (denominator * BigInt(matchup.denominator) * 100n),
    );
    return { coefficient, damage, percent: (damage / hp) * 100 };
  });
  if (rolls[0].damage < 1)
    return {
      valid: true,
      supported: false,
      errors: [],
      reason:
        "这一组参数触及最低伤害与取整边界，当前参考模型不能确定游戏显示值。",
    };
  return {
    valid: true,
    supported: true,
    errors: [],
    ...values,
    rolls,
    min: rolls[0].damage,
    max: rolls.at(-1).damage,
    percentMin: rolls[0].percent,
    percentMax: rolls.at(-1).percent,
    base: Number(numerator) / Number(denominator),
    matchup: matchup.numerator / matchup.denominator,
    referenceOnly: true,
  };
}

/**
 * V7 uses the public power-damage calculator on the official web-game forum.
 * Source: thread 162103, edited 2026-10-06; its complete page was inspected.
 * This implements that tool's arithmetic, not all of the game client's effects.
 * The older calculateDamage export remains for historical V6 validation only.
 */
export const POWER_MATCHUPS = [
  { value: "double", label: "双重克制 · ×3", numerator: 3, denominator: 1 },
  { value: "effective", label: "克制 · ×2", numerator: 2, denominator: 1 },
  {
    value: "neutral",
    label: "不克制不抵抗 · ×1",
    numerator: 1,
    denominator: 1,
  },
  { value: "resisted", label: "抵抗 · ×½", numerator: 1, denominator: 2 },
  {
    value: "strong-resist",
    label: "强力抵抗 · ×⅓",
    numerator: 1,
    denominator: 3,
  },
];

export const POWER_STAGES = Array.from({ length: 13 }, (_, index) => {
  const stage = index - 6;
  const [numerator, denominator] = powerStageRatio(stage);
  return {
    value: String(stage),
    label:
      stage === 0
        ? "0 · 无强化"
        : `${stage > 0 ? "+" : ""}${stage} 级 · ×${Number((numerator / denominator).toFixed(3))}`,
  };
});

export function powerStageRatio(stage) {
  return stage >= 0 ? [stage + 2, 2] : [2, 2 - stage];
}

export function calculatePowerDamage(input) {
  const errors = [];
  const values = {};
  for (const [key, minimum, maximum, label] of [
    ["level", 1, 100, "攻击方等级"],
    ["power", 1, 99999, "技能威力"],
    ["attack", 1, 99999, "攻击能力"],
    ["defense", 1, 99999, "防御能力"],
    ["hp", 1, 99999, "目标当前精力"],
    ["boost", 0, 10000, "增伤比例（%）"],
    ["reduction", 0, 100, "减伤比例（%）"],
  ]) {
    values[key] = parseInteger(
      input[key] ?? (minimum === 0 ? 0 : undefined),
      minimum,
      maximum,
    );
    if (values[key] === null)
      errors.push(`${label}须为 ${minimum}–${maximum} 的整数。`);
  }
  for (const [key, label] of [
    ["attackStage", "攻击强化等级"],
    ["defenseStage", "防御强化等级"],
  ]) {
    const raw = String(input[key] ?? "0");
    const value = /^-?\d+$/.test(raw) ? Number(raw) : NaN;
    values[key] =
      Number.isInteger(value) && value >= -6 && value <= 6 ? value : null;
    if (values[key] === null) errors.push(`${label}须为 −6 至 +6 的整数。`);
  }
  if (!["physical", "magic"].includes(input.category))
    errors.push("请选择物理或魔法类别。");
  if (!["ordinary", "special"].includes(input.mode))
    errors.push("请选择结算类型。");
  if (!["plain", "modified"].includes(input.conditions))
    errors.push("请选择其他结算条件。");
  const matchup = POWER_MATCHUPS.find((item) => item.value === input.matchup);
  if (!matchup) errors.push("请选择本次判定的属性关系。");
  if (errors.length) return { valid: false, supported: false, errors };
  if (input.mode !== "ordinary" || input.conditions !== "plain") {
    return {
      valid: true,
      supported: false,
      errors: [],
      reason:
        "固伤、斩杀、多段分结算、护盾、限伤和伤害转化需要对应技能规则；不能用一个百分比替代这些机制。请先查该技能的结算分支。",
    };
  }

  const {
    level,
    power,
    attack,
    defense,
    hp,
    attackStage,
    defenseStage,
    boost,
    reduction,
  } = values;
  const [attackN, attackD] = powerStageRatio(attackStage);
  const [defenseN, defenseD] = powerStageRatio(defenseStage);
  // Equivalent to ((0.4L+2) × P × A' / D' / 50 + 2).
  // Rational arithmetic keeps intermediate fractions; only final damage floors.
  const denominator =
    125n * BigInt(defense) * BigInt(defenseN) * BigInt(attackD);
  const numerator =
    BigInt(level + 5) *
      BigInt(power) *
      BigInt(attack) *
      BigInt(attackN) *
      BigInt(defenseD) +
    2n * denominator;
  const modifierN =
    BigInt(matchup.numerator) * BigInt(100 + boost) * BigInt(100 - reduction);
  const modifierD = BigInt(matchup.denominator) * 100n * 100n;
  const rolls = DAMAGE_ROLLS.map((coefficient) => {
    const damage = Math.max(
      1,
      Number(
        (numerator * modifierN * BigInt(coefficient)) /
          (denominator * modifierD * 100n),
      ),
    );
    return { coefficient, damage, percent: (damage / hp) * 100 };
  });
  return {
    valid: true,
    supported: true,
    errors: [],
    ...values,
    rolls,
    min: rolls[0].damage,
    max: rolls.at(-1).damage,
    percentMin: rolls[0].percent,
    percentMax: rolls.at(-1).percent,
    base: Number(numerator) / Number(denominator),
    attackAfterStage: (attack * attackN) / attackD,
    defenseAfterStage: (defense * defenseN) / defenseD,
    matchup: matchup.numerator / matchup.denominator,
    matchupLabel: matchup.label,
    referenceOnly: true,
    model: "official-forum-power-2026-10-06",
  };
}
