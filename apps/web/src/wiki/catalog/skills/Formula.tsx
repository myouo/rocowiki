// SPDX-License-Identifier: GPL-3.0-only
import React, { createElement, type ReactNode } from 'react';
import type { MathNode, ReaderFormula } from './formulaModel';
import MathReferenceText from './MathReferenceText';

const tag = (name: string, ...children: ReactNode[]) => createElement(name, null, ...children);
function MathContent({ node }: { node: MathNode }): ReactNode {
  if (node.kind === 'atom') return /^\d/u.test(node.value) ? tag('mn', node.value) : <MathReferenceText value={node.value} />;
  if (node.kind === 'negative') return tag('mrow', tag('mo', '−'), <MathContent node={node.value} />);
  if (node.kind === 'binary') {
    const a = <MathContent node={node.left} />, b = <MathContent node={node.right} />;
    if (node.operator === '/' || node.operator === '÷') return tag('mfrac', a, b);
    return tag('mrow', a, tag('mo', node.operator === '*' ? '×' : node.operator === '-' ? '−' : node.operator), b);
  }
  if (node.kind === 'group' || node.kind === 'absolute') return tag('mrow', tag('mo', node.kind === 'group' ? '(' : '|'), <MathContent node={node.value} />, tag('mo', node.kind === 'group' ? ')' : '|'));
  if (node.name !== 'min') return tag('mrow', tag('mo', node.name === 'ceil' ? '⌈' : '⌊'), <MathContent node={node.args[0]} />, tag('mo', node.name === 'ceil' ? '⌉' : '⌋'));
  return tag('mrow', tag('mtext', '较小值'), tag('mo', '('), <MathContent node={node.args[0]} />, tag('mo', ','), <MathContent node={node.args[1]} />, tag('mo', ')'));
}

export function FormulaExpression({ formula, inline = false, includeLabel = false }: { formula: ReaderFormula; inline?: boolean; includeLabel?: boolean }) {
  const spoken = formula.expression.replaceAll('ceil', '向上取整').replaceAll('floor', '向下取整').replaceAll('min', '取较小值');
  return createElement('math', { xmlns: 'http://www.w3.org/1998/Math/MathML', display: inline ? 'inline' : 'block', displaystyle: 'true', 'aria-label': `${includeLabel ? formula.label + ' = ' : ''}${spoken}` }, tag('mrow', ...(includeLabel ? [<MathReferenceText key="label" value={formula.label} />, tag('mo', '=')] : []), <MathContent node={formula.tree} />));
}

export default function Formula({ formula, id, number }: { formula: ReaderFormula; id: string; number: number }) {
  return <figure className="rw-analysis-formula" id={id} tabIndex={-1}>
    <figcaption><span>式 {number}</span><strong>{formula.label}</strong>{formula.scope !== '基础效果' && <small>{formula.scope}</small>}</figcaption>
    <div className="rw-analysis-math-scroll" tabIndex={0} aria-label={`${formula.label}的计算式`}>
      <FormulaExpression formula={formula} includeLabel />
    </div>
    {formula.tree.kind === 'function' && formula.tree.name !== 'min' && <small className="rw-analysis-rounding">{formula.tree.name === 'ceil' ? '向上取整' : '向下取整'}</small>}
    {formula.verbatim && <small className="rw-analysis-rounding">保留原始算式</small>}
  </figure>;
}
