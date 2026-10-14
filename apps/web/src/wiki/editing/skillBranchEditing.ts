// SPDX-License-Identifier: GPL-3.0-only
import { changeSkillBranchSiblings, replaceSkillBranch, skillBranchLocations, type NavigableBranch } from '../skillBranchNavigation';

export const MAX_BRANCH_DEPTH = 5;
export interface BranchDestination {
  parentPath: string | null;
  route: 'children' | 'otherwise';
}
export interface BranchEdit {
  branches: NavigableBranch[];
  path: string;
}

/** Existing skills store alternatives in legacy text fields as well as trees. */
export function editableBranchAlternate(branch: NavigableBranch): NavigableBranch['otherwiseBranch'] {
  if (branch.otherwiseBranch) return branch.otherwiseBranch;
  if (!branch.otherwise && !branch.otherwiseWhen) return null;
  return { relation: branch.otherwiseWhen ? 'independent' : 'else', conditionTree: branch.otherwiseWhen ? { kind: 'clause', text: branch.otherwiseWhen } : null, effect: branch.otherwise || '', children: [] };
}

function subtreeDepth(branch: NavigableBranch): number {
  const children = [...(branch.children || []), ...(branch.otherwiseBranch?.children || [])];
  return children.length ? 1 + Math.max(...children.map(subtreeDepth)) : 0;
}

/** Validate before removing anything, including the whole subtree's depth. */
export function branchMoveError(branches: NavigableBranch[], path: string, destination: BranchDestination, rootIndex?: number): string {
  const locations = skillBranchLocations(branches);
  const source = locations.find(row => row.path === path);
  if (!source) return '找不到待移动的分支。';
  const parent = destination.parentPath === null ? null : locations.find(row => row.path === destination.parentPath);
  if (destination.parentPath !== null && !parent) return '找不到目标父条件。';
  if (parent && (parent.path === path || parent.path.startsWith(`${path}.`))) return '不能放入自身或自己的下级分支。';
  if (rootIndex !== undefined && (source.rootIndex !== rootIndex || source.depth === 0 || !parent || parent.rootIndex !== rootIndex)) return '请在当前根分支内调整层级。';
  if (parent && destination.route === 'otherwise' && !editableBranchAlternate(parent.branch)) return '请先为目标父条件添加另一情况的路径。';
  if ((parent ? parent.depth + 1 : 0) + subtreeDepth(source.branch) > MAX_BRANCH_DEPTH) return '移动后层级过深，请先简化下级分支。';
  return '';
}

/** Destination paths are occurrences; adjust indices after removing a sibling. */
export function moveSkillBranch(branches: NavigableBranch[], path: string, destination: BranchDestination, rootIndex?: number): BranchEdit | null {
  if (branchMoveError(branches, path, destination, rootIndex)) return null;
  const source = skillBranchLocations(branches).find(row => row.path === path)!;
  const removed = changeSkillBranchSiblings(branches, path, (rows, index) => rows.filter((_, i) => i !== index));
  if (destination.parentPath === null) return { branches: [...removed, source.branch], path: String(removed.length) };
  const sourceParts = path.split('.'), targetParts = destination.parentPath.split('.');
  const prefix = sourceParts.slice(0, -1), index = Number(sourceParts.at(-1));
  if (targetParts.length > prefix.length && prefix.every((part, i) => targetParts[i] === part) && Number(targetParts[prefix.length]) > index) {
    targetParts[prefix.length] = String(Number(targetParts[prefix.length]) - 1);
  }
  const parentPath = targetParts.join('.');
  const parent = skillBranchLocations(removed).find(row => row.path === parentPath)!.branch;
  const alternate = editableBranchAlternate(parent);
  const children = destination.route === 'children' ? parent.children || [] : alternate!.children || [];
  const next = destination.route === 'children' ? { ...parent, children: [...children, source.branch] }
    : { ...parent, otherwiseBranch: { ...alternate!, children: [...children, source.branch] } };
  return { branches: replaceSkillBranch(removed, parentPath, next), path: `${parentPath}.${destination.route === 'children' ? 'children' : 'otherwiseBranch.children'}.${children.length}` };
}

/** Wrap in a new prerequisite without rewriting the existing branch or effects. */
export function wrapSkillBranch(branches: NavigableBranch[], path: string, parent: NavigableBranch): BranchEdit | null {
  const source = skillBranchLocations(branches).find(row => row.path === path);
  if (!source || source.depth + 1 + subtreeDepth(source.branch) > MAX_BRANCH_DEPTH) return null;
  return { branches: replaceSkillBranch(branches, path, { ...parent, presentation: 'scope', children: [source.branch] }), path };
}
