// SPDX-License-Identifier: GPL-3.0-only
import type { NavigableBranch } from './skillBranchNavigation';

export interface VerticalBranchLane {
  branch: NavigableBranch;
  index: number;
  fullWidth: boolean;
}
/** Layout never promotes, sorts or rewrites a condition. Only siblings from
 * the same authored array may share a row. Complex subtrees keep their width.
 */
export function branchNeedsFullWidth(branch: NavigableBranch): boolean {
  const children = branch.children || [], alternate = branch.otherwiseBranch;
  if (children.length > 1 || alternate || branch.otherwise || branch.otherwiseWhen) return true;
  if (children.some(child => (child.children || []).length > 0 || child.otherwiseBranch)) return true;
  if (branch.conditionTree?.kind === 'group' || [...(branch.conditionTree?.text || branch.when || '')].length > 90) return true;
  const effects = (branch.effect || '').split('\n').filter(Boolean);
  return effects.length > 5 || effects.some(line => [...line].length > 110);
}

export function verticalBranchRows(branches: NavigableBranch[]): VerticalBranchLane[][] {
  const rows: VerticalBranchLane[][] = [];
  let pair: VerticalBranchLane[] = [];
  function flush() { if (pair.length) { rows.push(pair); pair = []; } }
  branches.forEach((branch, index) => {
    const lane = { branch, index, fullWidth: branchNeedsFullWidth(branch) };
    if (lane.fullWidth) { flush(); rows.push([lane]); }
    else { pair.push(lane); if (pair.length === 2) flush(); }
  });
  flush();
  return rows;
}
