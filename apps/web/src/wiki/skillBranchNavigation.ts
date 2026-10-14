// SPDX-License-Identifier: GPL-3.0-only
export interface NavigableCondition {
  kind: string;
  text?: string;
}
export interface NavigableBranch {
  id?: string;
  label?: string;
  when?: string;
  effect?: string;
  otherwise?: string;
  otherwiseWhen?: string;
  presentation?: 'scope' | 'action';
  /** Reading-only flag: a focused matched route intentionally omits alternatives. */
  otherwiseOmitted?: boolean;
  conditionTree?: NavigableCondition;
  children?: NavigableBranch[];
  otherwiseBranch?: {
    conditionTree?: NavigableCondition | null;
    relation?: string;
    effect?: string;
    children?: NavigableBranch[];
  } | null;
}
export interface BranchLocation {
  path: string;
  branch: NavigableBranch;
  depth: number;
  rootIndex: number;
  ancestors: { path: string; label: string; when: string; route: string; conditionTree?: NavigableCondition }[];
}
export const branchTitle = (branch: NavigableBranch) => branch.label || branch.when || branch.conditionTree?.text || '条件分支';

/** Paths refer to occurrences, so repeated labels never select the wrong branch. */
export function skillBranchLocations(branches: NavigableBranch[]): BranchLocation[] {
  const result: BranchLocation[] = [];
  function visit(rows: NavigableBranch[], prefix: string, ancestors: BranchLocation['ancestors'], rootIndex: number) {
    rows.forEach((branch, index) => {
      const path = `${prefix}${index}`, root = ancestors.length ? rootIndex : index;
      result.push({ path, branch, depth: ancestors.length, rootIndex: root, ancestors });
      const parent = { path, label: branchTitle(branch), when: branch.conditionTree?.text || branch.when || '', route: '成立', conditionTree: branch.conditionTree };
      visit(branch.children || [], `${path}.children.`, [...ancestors, parent], root);
      const alternate = branch.otherwiseBranch;
      if (alternate?.children?.length) {
        const route = alternate.conditionTree ? alternate.relation === 'else-if' ? '不成立后再判断' : '独立判断' : '不成立';
        visit(alternate.children, `${path}.otherwiseBranch.children.`, [...ancestors, { ...parent, route, when: alternate.conditionTree?.text || parent.when, conditionTree: alternate.conditionTree || parent.conditionTree }], root);
      }
    });
  }
  visit(branches, '', [], -1);
  return result;
}

/** Keep the selected subtree and every parent prerequisite/effect on its route. */
export function focusSkillBranch<T extends NavigableBranch>(branches: T[], path: string): T[] {
  if (!path) return branches;
  const parts = path.split('.'), index = Number(parts.shift()), branch = branches[index];
  if (!branch || !Number.isInteger(index)) return branches;
  if (!parts.length) return [branch];
  if (parts.shift() === 'otherwiseBranch') {
    if (parts.shift() !== 'children' || !branch.otherwiseBranch) return branches;
    if (branch.otherwiseBranch.conditionTree && branch.otherwiseBranch.relation !== 'else-if') return [{
      ...branch, label: `独立判断 · ${branchTitle(branch)}`, when: branch.otherwiseBranch.conditionTree.text || '',
      conditionTree: branch.otherwiseBranch.conditionTree, effect: branch.otherwiseBranch.effect,
      children: focusSkillBranch(branch.otherwiseBranch.children || [], parts.join('.')), otherwiseBranch: null, otherwise: '', otherwiseWhen: '',
    }];
    return [{ ...branch, effect: '', children: [], otherwiseBranch: { ...branch.otherwiseBranch, children: focusSkillBranch(branch.otherwiseBranch.children || [], parts.join('.')) } }];
  }
  return [{ ...branch, children: focusSkillBranch(branch.children || [], parts.join('.')), otherwiseBranch: null, otherwise: '', otherwiseWhen: '', otherwiseOmitted: true }];
}

/** Update one occurrence without mutating its siblings or losing legacy fields. */
export function replaceSkillBranch<T extends NavigableBranch>(branches: T[], path: string, replacement: NavigableBranch): T[] {
  const [head, ...parts] = path.split('.'), index = Number(head);
  return branches.map((branch, i) => {
    if (i !== index) return branch;
    if (!parts.length) return replacement as T;
    if (parts[0] === 'otherwiseBranch' && branch.otherwiseBranch) return { ...branch, otherwiseBranch: { ...branch.otherwiseBranch, children: replaceSkillBranch(branch.otherwiseBranch.children || [], parts.slice(2).join('.'), replacement) } };
    return { ...branch, children: replaceSkillBranch(branch.children || [], parts.slice(1).join('.'), replacement) };
  });
}

export function changeSkillBranchSiblings(branches: NavigableBranch[], path: string, change: (rows: NavigableBranch[], index: number) => NavigableBranch[]): NavigableBranch[] {
  const parts = path.split('.'), index = Number(parts.shift());
  if (!parts.length) return change(branches, index);
  return branches.map((branch, i) => {
    if (i !== index) return branch;
    if (parts[0] === 'otherwiseBranch' && branch.otherwiseBranch) return { ...branch, otherwiseBranch: { ...branch.otherwiseBranch, children: changeSkillBranchSiblings(branch.otherwiseBranch.children || [], parts.slice(2).join('.'), change) } };
    return { ...branch, children: changeSkillBranchSiblings(branch.children || [], parts.slice(1).join('.'), change) };
  });
}
