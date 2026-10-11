/**
 * Describes conditions recorded by editors; it does not simulate game rules.
 * Legacy when/effect/otherwise fields remain intact so migrations are lossless.
 */
export const ROUND_BASES = [
  { value: "unspecified", label: "来源未明确计数方式" },
  { value: "skill-sequence", label: "本次连续技能内的回合" },
  { value: "battle-round", label: "整场战斗回合" },
  { value: "skill-uses", label: "该技能的使用次数" },
  { value: "effect-duration", label: "本次效果持续的回合" },
  { value: "custom", label: "自定义计数方式" },
];
export const ROUND_PHASES = [
  { value: "first", label: "首回合" },
  { value: "middle", label: "中间回合" },
  { value: "later", label: "后续回合" },
  { value: "last", label: "末回合" },
];
export const BRANCH_PRESETS = [
  { value: "1-2-3", label: "第 1 / 2 / 3 回合", ranges: [[1, 1], [2, 2], [3, 3]] },
  { value: "1-2to5-6", label: "第 1 / 2–5 / 6 回合", ranges: [[1, 1], [2, 5], [6, 6]] },
  { value: "1to2-3-4", label: "第 1–2 / 3 / 4 回合", ranges: [[1, 2], [3, 3], [4, 4]] },
  { value: "first-middle-last", label: "首回合 / 中间回合 / 末回合", phases: ["first", "middle", "last"] },
  { value: "first-later", label: "首回合 / 后续回合", phases: ["first", "later"] },
];
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
export function blankSkillCondition(kind = "clause") {
  if (kind === "group") return { kind: "group", operator: "all", children: [blankSkillCondition()] };
  if (kind === "rounds") return { kind: "rounds", basis: "unspecified", basisNote: "", mode: "ranges", ranges: [{ start: 1, end: 1 }], phase: "first", phaseNote: "" };
  return { kind: "clause", text: "" };
}
export function blankSkillBranch() {
  return { label: "", when: "", effect: "", otherwiseWhen: "", otherwise: "", conditionTree: blankSkillCondition(), children: [] };
}
export function normalizeSkillBranch(input = {}) {
  const row = isObject(input) ? clone(input) : {};
  const normalized = {
    ...row,
    label: String(row.label || ""),
    effect: Array.isArray(row.effect) ? row.effect.join("\n") : String(row.effect || ""),
    conditionTree: isObject(row.conditionTree) ? clone(row.conditionTree) : { kind: "clause", text: String(row.when || "") },
    children: Array.isArray(row.children) ? row.children.map(normalizeSkillBranch) : [],
  };
  if (isObject(row.otherwiseBranch)) {
    normalized.otherwiseBranch = {
      ...clone(row.otherwiseBranch),
      conditionTree: isObject(row.otherwiseBranch.conditionTree) ? clone(row.otherwiseBranch.conditionTree) : null,
      relation: row.otherwiseBranch.conditionTree ? (row.otherwiseBranch.relation === "else-if" ? "else-if" : "independent") : "else",
      effect: String(row.otherwiseBranch.effect || ""),
      children: Array.isArray(row.otherwiseBranch.children) ? row.otherwiseBranch.children.map(normalizeSkillBranch) : [],
    };
  } else if (row.otherwise || row.otherwiseWhen) {
    normalized.otherwiseBranch = { conditionTree: row.otherwiseWhen ? { kind: "clause", text: String(row.otherwiseWhen) } : null, relation: row.otherwiseWhen ? "independent" : "else", effect: String(row.otherwise || ""), children: [] };
  }
  return normalized;
}
export function roundBasisLabel(basis, note = "") {
  if (basis === "custom") return note.trim() || "自定义计数（待说明）";
  return ROUND_BASES.find((row) => row.value === basis)?.label || ROUND_BASES[0].label;
}
export function rangeLabel(range, basis = "") {
  const start = range?.start ?? "?", end = range?.end ?? start;
  const unit = basis === "skill-uses" ? "次" : "回合";
  return Number(start) === Number(end) ? `第 ${start} ${unit}` : `第 ${start}–${end} ${unit}`;
}
export function conditionText(condition) {
  if (!isObject(condition)) return "条件待补充";
  if (condition.kind === "group") {
    const children = (condition.children || []).map(conditionText);
    return children.length ? `（${children.join(condition.operator === "any" ? "，或 " : "，且 ")}）` : "条件组待补充";
  }
  if (condition.kind === "rounds") {
    const selection = condition.mode === "phase"
      ? ROUND_PHASES.find((row) => row.value === condition.phase)?.label || "阶段待补充"
      : (condition.ranges || []).map((range) => rangeLabel(range, condition.basis)).join("、") || "回合范围待补充";
    return `${roundBasisLabel(condition.basis, condition.basisNote || "")} · ${selection}${condition.phaseNote ? `（${condition.phaseNote}）` : ""}`;
  }
  return String(condition.text || "").trim() || "条件待补充";
}
export function branchConditionText(branch) { return conditionText(normalizeSkillBranch(branch).conditionTree); }
export function makeBranchPreset(value, basis = "unspecified", basisNote = "", groupId = "") {
  const preset = BRANCH_PRESETS.find((row) => row.value === value);
  if (!preset) return [];
  const selections = preset.ranges || preset.phases || [];
  return selections.map((selection, index) => ({
    ...blankSkillBranch(),
    label: preset.ranges ? rangeLabel({ start: selection[0], end: selection[1] }, basis) : ROUND_PHASES.find((row) => row.value === selection)?.label || selection,
    scheduleGroup: groupId,
    scheduleExclusive: true,
    conditionTree: {
      ...blankSkillCondition("rounds"), basis, basisNote,
      mode: preset.ranges ? "ranges" : "phase",
      ranges: preset.ranges ? [{ start: selection[0], end: selection[1] }] : [],
      phase: preset.phases ? selection : "first",
    },
    id: groupId ? `${groupId}-${index + 1}` : "",
  }));
}
export function serializeSkillBranch(branch, depth = 0) {
  const row = normalizeSkillBranch(branch), pad = "  ".repeat(depth);
  const output = [`${pad}${row.label || "条件分支"}`, `${pad}如果：${conditionText(row.conditionTree)}`];
  if (row.effect) output.push(`${pad}则：${row.effect}`);
  row.children.forEach((child) => output.push(serializeSkillBranch(child, depth + 1)));
  if (row.otherwiseBranch) {
    const alternate = row.otherwiseBranch;
    output.push(`${pad}${alternate.conditionTree ? `${alternate.relation === "else-if" ? "不成立后再判断" : "独立判断（可同时满足）"}：${conditionText(alternate.conditionTree)}` : "否则"}`);
    if (alternate.effect) output.push(`${pad}则：${alternate.effect}`);
    alternate.children.forEach((child) => output.push(serializeSkillBranch(child, depth + 1)));
  }
  return output.join("\n");
}
const positiveInteger = (value) => String(value ?? "").trim() !== "" && Number.isInteger(Number(value)) && Number(value) > 0;
function intervals(condition) {
  if (condition?.kind === "rounds" && condition.mode !== "phase") return (condition.ranges || []).map((row) => ({ start: Number(row.start), end: Number(row.end), basis: condition.basis, basisNote: condition.basisNote || "" }));
  return [];
}
/** Returns errors for invalid records and warnings for possible, not proven, overlaps. */
export function validateSkillBranches(branches = [], prefix = "phases") {
  const errors = {}, warnings = [];
  function validateCondition(condition, path, depth = 0) {
    if (depth > 6) { errors[path] = "条件最多嵌套 6 层，请将过深的条件拆开说明。"; return; }
    if (!isObject(condition)) { errors[path] = "请填写分支条件。"; return; }
    if (condition.kind === "group") {
      if (!["all", "any"].includes(condition.operator)) errors[path] = "请选择全部满足或任一满足。";
      if (!Array.isArray(condition.children) || !condition.children.length) errors[path] = "条件组至少需要一个条件。";
      (condition.children || []).forEach((child, i) => validateCondition(child, `${path}.children.${i}`, depth + 1));
    } else if (condition.kind === "rounds") {
      if (!ROUND_BASES.some((row) => row.value === condition.basis) || condition.basis === "unspecified") errors[`${path}.basis`] = "请说明这些回合或次数从哪里开始计数。来源未说明时可改用文字条件。";
      if (condition.basis === "custom" && !String(condition.basisNote || "").trim()) errors[`${path}.basisNote`] = "请填写自定义计数方式。";
      if (condition.mode === "phase") {
        if (!ROUND_PHASES.some((row) => row.value === condition.phase)) errors[`${path}.phase`] = "请选择阶段。";
      } else {
        if (!condition.ranges?.length) errors[`${path}.ranges`] = "至少保留一个回合或次数范围。";
        (condition.ranges || []).forEach((range, i) => {
          if (!positiveInteger(range.start)) errors[`${path}.ranges.${i}.start`] = "起始序号必须为正整数。";
          if (!positiveInteger(range.end) || Number(range.end) < Number(range.start)) errors[`${path}.ranges.${i}.end`] = "终止序号必须为正整数，并且不小于起始序号。";
        });
        const sorted = intervals(condition).filter((row) => Number.isFinite(row.start) && Number.isFinite(row.end)).sort((a, b) => a.start - b.start);
        for (let i = 1; i < sorted.length; i++) if (sorted[i].start <= sorted[i - 1].end) errors[`${path}.ranges`] = "同一条件中的回合范围重复或重叠，请合并为一个范围。";
      }
    } else if (condition.kind !== "clause" || !String(condition.text || "").trim()) errors[path] = "请填写可核验的条件。";
  }
  function visit(rows, path, depth = 0) {
    if (depth > 5) { errors[path] = "效果分支最多嵌套 5 层，请将过深的分支拆开说明。"; return; }
    rows.forEach((input, i) => {
      const row = normalizeSkillBranch(input), key = `${path}.${i}`;
      validateCondition(row.conditionTree, `${key}.conditionTree`);
      if (!row.effect.trim() && !row.children.length) errors[`${key}.effect`] = "请填写成立时的效果，或添加下一级效果分支。";
      visit(row.children, `${key}.children`, depth + 1);
      if (row.otherwiseBranch) {
        if (row.otherwiseBranch.conditionTree) validateCondition(row.otherwiseBranch.conditionTree, `${key}.otherwiseBranch.conditionTree`);
        if (!row.otherwiseBranch.effect.trim() && !row.otherwiseBranch.children.length) errors[`${key}.otherwiseBranch.effect`] = "已添加其他分支，请填写效果；来源未说明时请移除此分支。";
        visit(row.otherwiseBranch.children, `${key}.otherwiseBranch.children`, depth + 1);
      }
    });
    // A shared exclusive schedule is explicitly editor-authored. Ordinary
    // conditions can legitimately overlap and are never rejected by inference.
    for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
      const a = normalizeSkillBranch(rows[i]), b = normalizeSkillBranch(rows[j]);
      const overlapping = intervals(a.conditionTree).some((x) => intervals(b.conditionTree).some((y) => x.basis === y.basis && x.basisNote === y.basisNote && x.start <= y.end && y.start <= x.end));
      if (!overlapping) continue;
      const message = `「${a.label || `分支 ${i + 1}`}」与「${b.label || `分支 ${j + 1}`}」的回合范围有重叠。`;
      if (a.scheduleGroup && a.scheduleGroup === b.scheduleGroup && a.scheduleExclusive && b.scheduleExclusive) errors[`${path}.${j}.conditionTree.ranges`] = `${message} 同一分段模板内的阶段应分开；若确实同时结算，请解除分段组约束。`;
      else warnings.push(`${message} 若两个效果可同时结算，可保留并说明结算关系。`);
    }
  }
  visit(Array.isArray(branches) ? branches : [], prefix);
  return { errors, warnings };
}
