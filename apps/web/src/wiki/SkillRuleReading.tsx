// SPDX-License-Identifier: GPL-3.0-only
import React, { useId, useMemo, type ReactNode } from 'react';
import { SkillEffectFlow, type SkillFlowData, type SkillFlowProps } from './SkillBranchView';
import { compactAnalysis } from './catalog/skills/compactAnalysisModel';
import Formula, { FormulaExpression } from './catalog/skills/Formula';
import CombatText, { CombatDefinitions, CombatIconLabels } from './CombatText';
import { analysisTermReferences } from './combatTerms';
import type { SkillTerm } from './skillTerms';
import './catalog/skills/CompactAnalysis.css';

export interface SkillRuleData extends SkillFlowData {
  terms?: SkillTerm[];
}

/** Reader and draft previews share notation, definitions, icons and hierarchy. */
export default function SkillRuleReading({ data = {}, children, ...props }: Omit<SkillFlowProps, 'data' | 'renderEffect'> & { data?: SkillRuleData; children?: ReactNode }) {
  const prefix = useId();
  const view = useMemo(() => compactAnalysis({
    common: Array.isArray(data.common ?? data.base) ? (data.common ?? data.base) as string[] : String(data.common ?? data.base ?? '').split('\n'),
    phases: data.phases || data.branches || [], terms: data.terms,
  }), [data.common, data.base, data.phases, data.branches, data.terms]);
  const definitions = useMemo(() => analysisTermReferences(view.terms, prefix), [view.terms, prefix]);
  const renderEffect = (text: string) => {
    const row = view.effectsByText.get(text);
    const formula = row?.formula !== undefined ? view.formulas[row.formula] : undefined;
    return row ? <span className="rw-analysis-outcome"><CombatText text={row.before} />{formula && <><span className="rw-analysis-inline-math" tabIndex={0} aria-label={`${formula.label}的计算式`}><FormulaExpression formula={formula} inline /></span>{formula.tree.kind === 'function' && formula.tree.name !== 'min' && <small className="rw-analysis-inline-rounding">（{formula.tree.name === 'ceil' ? '向上取整' : '向下取整'}）</small>}</>}<CombatText text={row.after} />{formula && <a className="rw-analysis-formula-link" href={`#${prefix}-${row.formula}`} aria-label={`查看公式 ${row.formula! + 1}`}>式 {row.formula! + 1}</a>}</span> : <CombatText text={text} />;
  };
  return <CombatDefinitions.Provider value={definitions}><CombatIconLabels.Provider value="first"><div className="rw-rule-reading-preview">
    {view.terms.length > 0 && <dl className="rw-analysis-definitions">{view.terms.map((term, index) => <div key={index} id={`${prefix}-term-${index}`} tabIndex={-1}><dt>{term.name}</dt><dd><CombatText text={term.description} definitions={[]} /></dd></div>)}</dl>}
    <SkillEffectFlow {...props} data={data} renderEffect={renderEffect} concise groupEffects />
    {view.formulas.length > 0 && <section className="rw-analysis-formulas" aria-label="计算公式">{view.formulas.map((formula, i) => <Formula key={i} formula={formula} id={`${prefix}-${i}`} number={i + 1} />)}</section>}
    {children}
  </div></CombatIconLabels.Provider></CombatDefinitions.Provider>;
}
