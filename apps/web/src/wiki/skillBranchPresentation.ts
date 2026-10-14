// SPDX-License-Identifier: GPL-3.0-only
import type { NavigableBranch } from './skillBranchNavigation';

export const UNSPECIFIED_MISS_EFFECT = '本命中分支不触发；其他未命中效果未说明。';

/** A scope is still a prerequisite; show it once instead of repeating it as an if. */
export function skillBranchPresentation(branch: NavigableBranch, condition: string) {
  const hasAlternate = !!branch.otherwiseBranch || !!branch.otherwise || !!branch.otherwiseWhen;
  const hit = /^本次技能命中(?:对手)?$/u.test(condition);
  const missingMiss = hit && !hasAlternate && !branch.otherwiseOmitted;
  const hitCheck = hit && (missingMiss || hasAlternate && !branch.otherwiseWhen && !branch.otherwiseBranch?.conditionTree);
  const scope = !hasAlternate && !missingMiss && (branch.presentation === 'scope' || hit);
  const caption = hitCheck ? '本次技能是否命中？' : scope && hit
    ? condition.includes('对手') ? '命中对手后' : '命中后'
    : condition;
  return { scope, caption, hitCheck, missingMiss };
}
