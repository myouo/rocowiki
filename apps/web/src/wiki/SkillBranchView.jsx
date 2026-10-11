import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Check, Copy, GitBranch, Layers3, Repeat2 } from "lucide-react";
import { conditionText, normalizeSkillBranch, roundBasisLabel, ROUND_PHASES, rangeLabel } from "./skillConditions";
import { buildSkillFlowGraph, buildSkillFlowTree, effectLines, normalizeSkillFlow, skillToMermaid } from "./skillFlow";
import { EntityText } from "./EntityReference";
import BoundedTextarea from "./BoundedTextarea";
import PreviewBoundary from "./editing/PreviewBoundary";

export const FLOW_HORIZONTAL_MIN_WIDTH = 760;

/** Observe this flow's own document and width, including inside a preview iframe. */
function useFlowRoom(ref) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const view = element.ownerDocument.defaultView;
    let active = true, queued = null;
    const measure = () => {
      queued = null;
      if (!active || !element.isConnected) return;
      const width = element.getBoundingClientRect().width || element.clientWidth;
      setWide(width >= FLOW_HORIZONTAL_MIN_WIDTH);
    };
    const schedule = () => {
      if (!active || queued !== null) return;
      queued = view.requestAnimationFrame ? view.requestAnimationFrame(measure) : view.setTimeout(measure, 0);
    };
    const observer = view.ResizeObserver ? new view.ResizeObserver(schedule) : null;
    observer?.observe(element);
    view.addEventListener("resize", schedule);
    measure();
    return () => {
      active = false; observer?.disconnect(); view.removeEventListener("resize", schedule);
      if (queued !== null) {
        if (view.requestAnimationFrame) view.cancelAnimationFrame?.(queued);
        else view.clearTimeout(queued);
      }
    };
  }, [ref]);
  return wide;
}

export function SkillConditionView({ condition }) {
  if (condition?.kind === "group") return <div className="rw-condition-group"><span className="rw-condition-operator">{condition.operator === "any" ? "满足任一项" : "同时满足"}</span><ul>{(condition.children || []).map((child, index) => <li key={index}><SkillConditionView condition={child} /></li>)}</ul></div>;
  if (condition?.kind === "rounds") return <div className="rw-condition-rounds"><span className="rw-condition-basis"><Repeat2 size={13} />{roundBasisLabel(condition.basis, condition.basisNote || "")}</span><div className="rw-condition-round-tags">{condition.mode === "phase" ? <span>{ROUND_PHASES.find((row) => row.value === condition.phase)?.label || "阶段待补"}</span> : (condition.ranges || []).map((range, index) => <span key={index}>{rangeLabel(range, condition.basis)}</span>)}</div>{condition.phaseNote && <small><EntityText text={condition.phaseNote} /></small>}</div>;
  return <span className="rw-condition-clause"><EntityText text={conditionText(condition)} /></span>;
}
function EffectSteps({ value }) { return <ol className="rw-flow-effect-steps">{effectLines(value).map((line, index) => <li key={index}><span className="rw-flow-step-number" aria-hidden="true">{index + 1}</span><EntityText text={line} /></li>)}</ol>; }
function ContinuedBranches({ rows, headingLevel, depth, label = "继续判断" }) { return rows?.length ? <div className="rw-skill-nested-branches"><div className="rw-skill-nested-label"><Layers3 size={13} />{label}{rows.length > 1 ? " · 各项分别成立" : ""}</div>{rows.map((child, index) => <SkillBranchCard key={child.id || index} branch={child} index={index} headingLevel={headingLevel + 1} depth={depth + 1} />)}</div> : null; }

/** A component flow: a condition feeds its true/else lanes; siblings are independent. */
export function SkillBranchCard({ branch, index = 0, headingLevel = 3, action, depth = 0 }) {
  const row = normalizeSkillBranch(branch), alternate = row.otherwiseBranch;
  const Heading = `h${Math.min(6, Math.max(3, headingLevel))}`;
  const independent = alternate?.conditionTree && alternate.relation !== "else-if";
  return <article className={`rw-skill-branch-card rw-skill-flow-card${depth ? " rw-skill-branch-nested" : ""}`} data-flow-relation={independent ? "independent" : alternate ? "conditional" : "single"}>
    <div className="rw-skill-branch-heading"><Heading><GitBranch size={16} />{row.label || `条件分支 ${index + 1}`}</Heading>{action}</div>
    {independent ? <div className="rw-flow-sibling-hub"><GitBranch size={13} />下面两项各自判断，可以同时成立。</div> : <div className="rw-flow-decision"><span className="rw-skill-branch-step"><GitBranch size={13} />如果</span><SkillConditionView condition={row.conditionTree} /></div>}
    <div className={`rw-flow-paths${alternate ? " rw-flow-paths-paired" : ""}`}>
      <div className="rw-flow-path rw-flow-path-yes"><span className="rw-flow-edge-label"><ArrowDown size={12} />{independent ? "条件一" : "成立"}</span>{independent && <div className="rw-flow-alternative-decision"><span className="rw-skill-branch-step">如果</span><SkillConditionView condition={row.conditionTree} /></div>}<div className="rw-skill-branch-effect rw-flow-effect-node">{independent && <span className="rw-flow-alternate-yes">此条件成立时</span>}{row.effect ? <EffectSteps value={row.effect} /> : <span className="rw-flow-empty-effect">继续判断下级条件</span>}</div><ContinuedBranches rows={row.children} headingLevel={headingLevel} depth={depth} label="在上述条件成立后继续判断" /></div>
      {alternate && <div className={`rw-flow-path rw-skill-branch-else ${independent ? "rw-flow-path-independent" : "rw-flow-path-no"}`}><span className="rw-flow-edge-label"><ArrowDown size={12} />{independent ? "条件二" : "不成立"}</span>{alternate.conditionTree && <div className="rw-flow-alternative-decision"><span className="rw-skill-branch-step">{independent ? "如果" : "再判断"}</span><SkillConditionView condition={alternate.conditionTree} /></div>}<div className="rw-flow-effect-node">{alternate.conditionTree && <span className="rw-flow-alternate-yes">此条件成立时</span>}{alternate.effect ? <EffectSteps value={alternate.effect} /> : <span className="rw-flow-empty-effect">继续判断下级条件</span>}</div><ContinuedBranches rows={alternate.children} headingLevel={headingLevel} depth={depth} /></div>}
    </div>
  </article>;
}

/** Existing branches/actionFor callers remain supported. */
export default function SkillBranchList({ branches = [], headingLevel = 3, className = "", actionFor }) {
  return <div className={`rw-skill-branch-list ${className}`} data-flow-siblings="independent">{branches.length ? branches.map((branch, index) => <SkillBranchCard key={branch.id || index} branch={branch} index={index} headingLevel={headingLevel} action={actionFor?.(branch, index)} />) : <p className="rw-skill-no-branches">尚未收录独立的条件分支。</p>}</div>;
}

function HorizontalFlowNode({ node, presentation }) {
  const { idPrefix, flow, context, headingLevel, actionFor, baseAction } = presentation;
  const Heading = `h${Math.min(6, Math.max(3, headingLevel))}`;
  const action = node.role === "base" ? baseAction : node.branchIndex !== undefined ? actionFor?.(flow.branches[node.branchIndex], node.branchIndex) : null;
  const conditionLabel = node.role === "else-if-condition" ? "不成立后再判断" : node.role === "independent-condition" ? "独立判断" : "如果";
  return <article id={`${idPrefix}-${node.id}`} className="rw-flow-horizontal-node" data-flow-node-id={node.id} data-flow-node-type={node.type} data-flow-node-role={node.role} data-flow-branch-index={node.branchIndex} aria-label={node.label}>
    {node.type === "decision" ? <><div className="rw-flow-horizontal-node-head"><span className="rw-flow-horizontal-kind"><GitBranch size={13} aria-hidden="true" />{conditionLabel}</span>{action}</div>{node.branchLabel && <Heading className="rw-flow-horizontal-heading">{node.branchLabel}</Heading>}<SkillConditionView condition={node.conditionTree} /></> : node.type === "group" ? <div className="rw-flow-horizontal-node-head"><strong><Layers3 size={14} aria-hidden="true" /><EntityText text={node.label} path={context?.returnTo || "/"} /></strong>{action}</div> : <><div className="rw-flow-horizontal-kind"><span className="rw-flow-step-number" aria-hidden="true">{node.stepNumber}</span>效果</div><EntityText text={node.label} path={context?.returnTo || "/"} /></>}
  </article>;
}

/** Each child owns its incoming edge; subtree centres are the connector endpoints. */
function HorizontalFlowBranch({ tree, presentation }) {
  return <div className="rw-flow-horizontal-tree" data-flow-subtree-root={tree.node.id}>
    <HorizontalFlowNode node={tree.node} presentation={presentation} />
    {tree.children.length > 0 && <ul className="rw-flow-horizontal-children" aria-label="后续节点" data-flow-parent-id={tree.node.id}>{tree.children.map((child) => <li key={child.node.id} className="rw-flow-horizontal-child" data-flow-child-id={child.node.id}>
      <span className="rw-flow-horizontal-edge" data-flow-edge-from={child.edge.from} data-flow-edge-to={child.edge.to} data-flow-edge-label={child.edge.label} data-flow-edge-kind={child.edge.label === "不成立" ? "false" : child.edge.label === "成立" ? "true" : child.edge.label === "独立判断" ? "independent" : "continuation"} role="img" aria-label={child.edge.label ? `沿“${child.edge.label}”分支进入下一节点` : "进入下一节点"}>{child.edge.label && <span className="rw-flow-horizontal-edge-label" aria-hidden="true">{child.edge.label}</span>}</span>
      <HorizontalFlowBranch tree={child} presentation={presentation} />
    </li>)}</ul>}
  </div>;
}

function HorizontalSkillFlow({ data, flow, context, headingLevel, actionFor, baseAction }) {
  const idPrefix = `skill-flow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const tree = useMemo(() => buildSkillFlowTree(buildSkillFlowGraph(data, { direction: "horizontal" })), [data]);
  const presentation = { idPrefix, flow, context, headingLevel, actionFor, baseAction };
  return <><p id={`${idPrefix}-hint`} className="rw-flow-horizontal-hint"><ArrowRight size={13} aria-hidden="true" />从左向右沿箭头阅读，可横向滚动查看后续效果。</p><div className="rw-flow-horizontal-scroll" data-flow-graph="tree" role="region" aria-label={`${flow.name} · 横向效果流程`} aria-describedby={`${idPrefix}-hint`} tabIndex={0}><div className="rw-flow-horizontal-canvas"><HorizontalFlowBranch tree={tree} presentation={presentation} /></div></div></>;
}

export function MermaidCopy({ data, direction = "vertical" }) {
  const [notice, setNotice] = useState(""), [manual, setManual] = useState(false);
  const field = useRef(null), id = `mermaid-${useId().replace(/:/g, "")}`;
  const source = useMemo(() => skillToMermaid(data, { direction }), [data, direction]);
  const active = useRef(true), copyRequest = useRef(0);
  useEffect(() => { active.current = true; return () => { active.current = false; copyRequest.current += 1; }; }, []);
  useEffect(() => { copyRequest.current += 1; setNotice(""); setManual(false); }, [source]);
  async function copy() {
    const request = ++copyRequest.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(source);
      if (active.current && request === copyRequest.current) { setNotice("Mermaid 已复制，可以粘贴到支持 Mermaid 的编辑器。"); setManual(false); }
    } catch { if (active.current && request === copyRequest.current) { setManual(true); setNotice("当前环境无法直接复制，请选择下方代码后复制。"); } }
  }
  return <div className="rw-flow-export"><button type="button" className="rw-flow-copy-button" onClick={copy}>{notice && !manual ? <Check size={14} /> : <Copy size={14} />}复制为 Mermaid</button>{notice && <small role="status">{notice}</small>}{manual && <div className="rw-flow-copy-fallback"><label htmlFor={id}>Mermaid 源码</label><BoundedTextarea id={id} ref={field} value={source} readOnly rows={9} onFocus={(event) => event.target.select()} /><button type="button" onClick={() => { field.current?.focus(); field.current?.select(); }}>选择全部代码</button></div>}</div>;
}

/** Shared by the public skill detail and isolated editing preview. */
function SkillEffectFlowContent({ data = {}, context, actionFor, baseAction, headingLevel = 3, showDescription = true, showExport = true, initialDirection = "vertical" }) {
  const [preference, setPreference] = useState(initialDirection === "horizontal" ? "horizontal" : "vertical");
  const root = useRef(null), wide = useFlowRoom(root);
  const direction = preference === "horizontal" && wide ? "horizontal" : "vertical";
  const collapsed = preference === "horizontal" && !wide;
  const flow = useMemo(() => normalizeSkillFlow(data), [data]), Heading = `h${Math.min(6, Math.max(3, headingLevel))}`;
  return <div ref={root} className="rw-skill-effect-flow" data-skill-flow="components" data-flow-direction={direction} data-flow-preference={preference}>
    {showDescription && flow.description && <section className="rw-flow-description"><Heading>技能描述</Heading><p><EntityText text={flow.description} path={context?.returnTo || "/"} /></p></section>}
    <div className="rw-flow-toolbar"><div className="rw-flow-origin"><GitBranch size={15} /><strong>效果与触发条件</strong></div><div className="rw-flow-tools-v73"><div className="rw-flow-directions-v73" role="group" aria-label="技能流程阅读方向"><button type="button" aria-pressed={preference === "vertical"} onClick={() => setPreference("vertical")}><ArrowDown size={13} aria-hidden="true" />纵向</button><button type="button" aria-pressed={preference === "horizontal"} onClick={() => setPreference("horizontal")}><ArrowRight size={13} aria-hidden="true" />横向</button></div>{showExport && <MermaidCopy data={data} direction={direction} />}</div></div>
    {collapsed && <p className="rw-flow-responsive-note-v73" role="status">空间较窄，当前按纵向阅读；加宽后恢复横向。Mermaid 按当前纵向视图导出。</p>}
    <p className="rw-flow-reading-note">按连线阅读成立与否则分支。各组条件分别判断，可以同时成立；未记载的结算时序与反向结果不作推断。</p>
    {direction === "horizontal" && (flow.base.length > 0 || flow.branches.length > 0) ? <HorizontalSkillFlow data={data} flow={flow} context={context} headingLevel={headingLevel} actionFor={actionFor} baseAction={baseAction} /> : <>
      {flow.base.length > 0 && <section className="rw-flow-base"><div className="rw-skill-branch-heading"><Heading><Layers3 size={15} />基础效果</Heading>{baseAction}</div><EffectSteps value={flow.base} /></section>}
      {flow.branches.length > 0 && <><div className="rw-flow-branch-root"><GitBranch size={13} />分别检查以下条件 <span>可同时满足</span></div><SkillBranchList branches={flow.branches} headingLevel={headingLevel} actionFor={actionFor} /></>}
    </>}
    {!flow.base.length && !flow.branches.length && <p className="rw-skill-no-branches">尚未收录结构化效果，可以从一项效果或判断条件开始补充。</p>}
  </div>;
}

export function SkillEffectFlow(props) {
  return <PreviewBoundary scope="skill-flow" resetKey={props.data} title="这组技能效果暂时无法展示" message="可以重新显示，或进入编辑核对条件与效果；页面的其他资料仍可继续使用。"><SkillEffectFlowContent {...props} /></PreviewBoundary>;
}
