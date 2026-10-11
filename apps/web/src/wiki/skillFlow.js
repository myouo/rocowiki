import { conditionText, normalizeSkillBranch } from "./skillConditions";

export function effectLines(value) {
  return (Array.isArray(value) ? value : String(value || "").split(/\r?\n/)).map((line) => String(line).trim()).filter(Boolean);
}
export function normalizeSkillFlow(data = {}) {
  return { name: String(data.name || "技能效果"), description: String(data.summary || data.description || ""), base: effectLines(data.common ?? data.base), branches: (data.phases || data.branches || []).map(normalizeSkillBranch) };
}

/** Layout is a reading preference; it never changes nodes, conditions or edges. */
export function mermaidFlowDirection(value = "vertical") {
  const direction = typeof value === "object" && value ? value.direction : value;
  return direction === "horizontal" || direction === "LR" ? "LR" : "TD";
}

/** Every label is quoted, with syntax characters encoded using Mermaid entities. */
export function mermaidLabel(value) {
  return String(value ?? "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[\r\n\u0000-\u001f\u007f\u2028\u2029]+/g, " / ").replace(/[&#"<>\[\]{}|`;\\]/g, (char) => `#${char.charCodeAt(0)};`);
}

/** This graph describes recorded effects, not an invented battle simulator. */
export function buildSkillFlowGraph(input = {}, options = {}) {
  const data = normalizeSkillFlow(input), nodes = [], edges = [];
  const node = (label, type = "effect", role = "", reading = {}) => { const id = `n${nodes.length + 1}`; nodes.push({ id, label, type, role, ...reading }); return id; };
  const edge = (from, to, label = "") => edges.push({ from, to, label });
  function effects(value, from, label = "", role = "effect") {
    let tail = from;
    effectLines(value).forEach((text, index) => { const id = node(text, "effect", role, { stepNumber: index + 1 }); edge(tail, id, index ? "随后" : label); tail = id; });
    return tail;
  }
  function children(rows, from, label) {
    if (!rows.length) return;
    const hub = node(rows.length > 1 ? "分别判断 · 可同时成立" : "继续判断", "group", "child-context");
    edge(from, hub, label);
    rows.forEach((row) => branch(row, hub));
  }
  function branch(input, from, branchIndex) {
    const row = normalizeSkillBranch(input), alternate = row.otherwiseBranch;
    let entry = from;
    if (alternate?.conditionTree && alternate.relation !== "else-if") { entry = node("并列条件 · 可同时成立", "group", "independent-alternate"); edge(from, entry); }
    const decision = node(`${row.label ? row.label + " · " : ""}${conditionText(row.conditionTree)}`, "decision", "condition", { conditionTree: row.conditionTree, branchLabel: row.label, ...(branchIndex === undefined ? {} : { branchIndex }) });
    edge(entry, decision);
    const end = effects(row.effect, decision, "成立", "true-effect");
    children(row.children, end, end === decision ? "成立" : "继续");
    if (!alternate) return;
    if (alternate.conditionTree) {
      const alternativeDecision = node(conditionText(alternate.conditionTree), "decision", alternate.relation === "else-if" ? "else-if-condition" : "independent-condition", { conditionTree: alternate.conditionTree });
      edge(alternate.relation === "else-if" ? decision : entry, alternativeDecision, alternate.relation === "else-if" ? "不成立" : "独立判断");
      const otherEnd = effects(alternate.effect, alternativeDecision, "成立", "alternate-effect");
      children(alternate.children, otherEnd, otherEnd === alternativeDecision ? "成立" : "继续");
    } else {
      const otherEnd = effects(alternate.effect, decision, "不成立", "else-effect");
      children(alternate.children, otherEnd, otherEnd === decision ? "不成立" : "继续");
    }
  }
  const start = node(data.name + " · 效果结构", "group", "root");
  if (data.base.length) {
    const base = node("基础效果 · 按资料顺序", "group", "base"); edge(start, base, "不依赖分支的效果"); effects(data.base, base);
  }
  if (data.branches.length) {
    const hub = node("各条件分别判断 · 可同时成立", "group", "branches"); edge(start, hub, "触发条件"); data.branches.forEach((row, index) => branch(row, hub, index));
  }
  const syntax = nodes.map((row) => `  ${row.id}${row.type === "decision" ? `{\"${mermaidLabel(row.label)}\"}` : `[\"${mermaidLabel(row.label)}\"]`}`);
  const connections = edges.map(({from,to,label}) => `  ${from} -->${label ? `|\"${mermaidLabel(label)}\"|` : ""} ${to}`);
  const direction = mermaidFlowDirection(options);
  return { nodes, edges, direction, mermaid: [`flowchart ${direction}`, "  %% 实线只表达已录入的条件、分支和局部顺序；不同根分支可同时成立。", ...syntax, ...connections].join("\n") };
}
export function skillToMermaid(data, options = {}) { return buildSkillFlowGraph(data, options).mermaid; }

/**
 * The authored flow model creates a fresh node for every occurrence: it is a
 * rooted tree, including else-if and independent conditions, with no merges.
 * Keep every graph edge in the layout. Reject future DAG/cycle input explicitly
 * instead of silently dropping an edge or duplicating a shared target node.
 */
export function buildSkillFlowTree(graph) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  if (nodes.size !== graph.nodes.length) throw new Error("横向技能流程包含重复的节点 ID。");
  const outgoing = new Map(graph.nodes.map((node) => [node.id, []])), incoming = new Map();
  for (const edge of graph.edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) throw new Error("横向技能流程的连线指向了不存在的节点。");
    if (incoming.has(edge.to)) throw new Error("横向技能流程暂不支持多个分支合流到同一节点。");
    incoming.set(edge.to, edge);
    outgoing.get(edge.from).push(edge);
  }
  const roots = graph.nodes.filter((node) => !incoming.has(node.id));
  if (roots.length !== 1) throw new Error("横向技能流程必须有一个起始节点，且不能包含循环。");
  const visited = new Set();
  function visit(id, edge = null) {
    if (visited.has(id)) throw new Error("横向技能流程包含循环连线。");
    visited.add(id);
    return { node: nodes.get(id), edge, children: outgoing.get(id).map((next) => visit(next.to, next)) };
  }
  const tree = visit(roots[0].id);
  if (visited.size !== nodes.size) throw new Error("横向技能流程包含未连接的节点或循环。");
  return tree;
}
