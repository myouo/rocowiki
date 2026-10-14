// SPDX-License-Identifier: GPL-3.0-only
import type { NavigableBranch } from '../../skillBranchNavigation';
import { separateFormula, type ReaderEffect, type ReaderFormula } from './formulaModel';

export interface CompactRule {
  label: string; when: string; presentation: 'scope' | 'action' | 'condition';
  effects: ReaderEffect[]; otherwise: ReaderEffect[]; children: CompactRule[];
}
export function compactAnalysis(record: { common: string[]; phases: NavigableBranch[]; terms?: { name: string; description: string }[] }) {
  const formulas: ReaderFormula[] = [];
  const effectsByText = new Map<string, ReaderEffect>();
  const lines = (value: string, scope: string) => value.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const effect = separateFormula(line, scope, formulas);
    if (!effectsByText.has(line)) effectsByText.set(line, effect);
    return effect;
  });
  const visit = (row: NavigableBranch): CompactRule => {
    const when = row.conditionTree?.text || row.when || '', label = row.label || '';
    const effects = lines(row.effect || '', label || '条件效果');
    const children = (row.children || []).map(visit);
    const other = row.otherwiseBranch, otherwise = lines(other?.effect ?? row.otherwise ?? '', label || '另一情况');
    // Alternate descendants can also contain formulas, even without a matched effect.
    (other?.children || []).forEach(visit);
    return {
      label, when,
      presentation: row.presentation || (!row.otherwise && !other && ((!row.effect && row.children?.length) || /^本次技能命中(?:对手)?$/u.test(when)) ? 'scope' : 'condition'),
      effects, otherwise, children,
    };
  };
  const common = lines(record.common.join('\n'), '基础效果');
  const rules = record.phases.map(visit);
  return { common, rules, formulas, terms: record.terms || [], effectsByText };
}
