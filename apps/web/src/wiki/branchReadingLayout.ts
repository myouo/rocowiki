// SPDX-License-Identifier: GPL-3.0-only
import type { NavigableBranch } from './skillBranchNavigation';
import { skillBranchPresentation } from './skillBranchPresentation';

export type BranchReadingKind = 'scope' | 'row' | 'followup' | 'hit';

/** Layout changes presentation only; prerequisites stay in the authored subtree. */
export function branchReadingKind(branch: NavigableBranch): 'scope' | 'row' | 'hit' {
  const condition = branch.conditionTree ? branch.conditionTree.kind === 'clause' ? branch.conditionTree.text || '' : '' : branch.when || '';
  if (skillBranchPresentation(branch, condition).hitCheck) return 'hit';
  const children = branch.children || [];
  return branch.presentation === 'scope' || branch.presentation === 'action' || children.length > 1 || children.some(child => (child.children || []).length > 0)
    ? 'scope' : 'row';
}

export function canReadAsFollowup(branch: NavigableBranch): boolean {
  const condition = branch.conditionTree;
  const lines = (branch.effect || '').split('\n').filter(Boolean);
  return branchReadingKind(branch) !== 'hit' && (!condition || condition.kind === 'clause') && !(branch.children || []).length && !branch.otherwiseBranch && !branch.otherwise && !branch.otherwiseWhen
    && (condition?.text || branch.when || '').length <= 80 && lines.length <= 3 && lines.every(line => line.length <= 180);
}
