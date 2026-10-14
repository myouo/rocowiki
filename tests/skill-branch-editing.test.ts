// SPDX-License-Identifier: GPL-3.0-only
import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { branchMoveError, moveSkillBranch, wrapSkillBranch } from '../apps/web/src/wiki/editing/skillBranchEditing';
import { skillBranchLocations, type NavigableBranch } from '../apps/web/src/wiki/skillBranchNavigation';

const { validateSkillBranches } = createRequire(import.meta.url)('../apps/web/src/wiki/skillConditions.js');

const fixture = () => [
  { label: '命中前提', when: '本次技能命中', effect: '基础效果', extra: { source: '公开来源' }, children: [
    { label: '阈值甲', when: '数值 ≥ 1', effect: '尝试降低物防', otherwise: '保留旧字段', children: [{ label: '失败', when: '降低物防失败', effect: '召唤天气' }] },
    { label: '阈值乙', when: '数值 ≥ 3', effect: '删除 PP' },
  ] },
  { label: '另一前提', when: '天气存在', effect: '回复精力', otherwiseBranch: { relation: 'else', effect: '否则效果', children: [] } },
];

it('moves a whole subtree to an otherwise route without mutating source or unrelated fields', () => {
  const rows = fixture(), before = JSON.stringify(rows);
  const moved = moveSkillBranch(rows, '0.children.0', { parentPath: '1', route: 'otherwise' })!;
  expect(moved.path).toBe('1.otherwiseBranch.children.0');
  expect(moved.branches[0].children!.map(row => row.label)).toEqual(['阈值乙']);
  expect(moved.branches[1].otherwiseBranch!.children![0]).toBe(rows[0].children![0]);
  expect(moved.branches[0]).toMatchObject({ effect: '基础效果', extra: { source: '公开来源' } });
  expect(JSON.stringify(rows)).toBe(before);
});

it('adjusts a destination root index after removing an earlier root', () => {
  const rows = fixture();
  const moved = moveSkillBranch(rows, '0', { parentPath: '1', route: 'children' })!;
  expect(moved.path).toBe('0.children.0');
  expect(moved.branches).toHaveLength(1);
  expect(moved.branches[0].label).toBe('另一前提');
  expect(moved.branches[0].children![0]).toBe(rows[0]);
});

it('adjusts a later sibling destination while retaining duplicate-label occurrence identity', () => {
  const first = { label: '相同名称', effect: '甲效果' }, second = { label: '相同名称', effect: '乙效果', children: [] };
  const rows = [{ label: '父条件', children: [first, second] }];
  const moved = moveSkillBranch(rows, '0.children.0', { parentPath: '0.children.1', route: 'children' })!;
  expect(moved.path).toBe('0.children.0.children.0');
  expect(moved.branches[0].children![0]).toMatchObject({ effect: '乙效果', children: [first] });
});

it('promotes a child to the top level with its original alternate and descendants intact', () => {
  const rows = fixture();
  const moved = moveSkillBranch(rows, '0.children.0', { parentPath: null, route: 'children' })!;
  expect(moved.path).toBe('2');
  expect(moved.branches[2]).toBe(rows[0].children![0]);
  expect(moved.branches[1]).toBe(rows[1]);
});

it('can move an otherwise descendant back into an ancestor matched route', () => {
  const rows: NavigableBranch[] = [{ when: '甲前提', children: [], otherwiseBranch: { relation: 'else-if', conditionTree: { kind: 'clause', text: '乙前提' }, effect: '乙效果', children: [{ when: '子前提', effect: '子效果' }] } }];
  const moved = moveSkillBranch(rows, '0.otherwiseBranch.children.0', { parentPath: '0', route: 'children' })!;
  expect(moved.path).toBe('0.children.0');
  expect(moved.branches[0].otherwiseBranch).toMatchObject({ relation: 'else-if', effect: '乙效果', children: [] });
  expect(moved.branches[0].children![0].effect).toBe('子效果');
});

it('rejects self, descendant, missing targets and missing alternate routes before editing', () => {
  const rows = fixture(), before = JSON.stringify(rows);
  for (const target of ['0', '0.children.0', '0.children.0.children.0', '99']) {
    expect(moveSkillBranch(rows, '0', { parentPath: target, route: 'children' })).toBeNull();
  }
  expect(moveSkillBranch(rows, '0.children.0', { parentPath: '0', route: 'otherwise' })).toBeNull();
  expect(moveSkillBranch(rows, 'no-such-path', { parentPath: null, route: 'children' })).toBeNull();
  expect(JSON.stringify(rows)).toBe(before);
});

it('supports legacy otherwise destinations without losing their text or changing independent semantics', () => {
  for (const when of ['', '另一独立条件']) {
    const child = { when: '子条件', effect: '子效果' };
    const rows = [{ when: '父条件', effect: '成立效果', otherwise: '另一情况效果', otherwiseWhen: when, children: [child] }];
    const moved = moveSkillBranch(rows, '0.children.0', { parentPath: '0', route: 'otherwise' })!;
    expect(moved.path).toBe('0.otherwiseBranch.children.0');
    expect(moved.branches[0]).toMatchObject({ otherwise: '另一情况效果', otherwiseWhen: when, children: [], otherwiseBranch: { relation: when ? 'independent' : 'else', effect: '另一情况效果', children: [child] } });
    expect(moved.branches[0].otherwiseBranch!.conditionTree).toEqual(when ? { kind: 'clause', text: when } : null);
    expect(rows[0].children).toEqual([child]);
    expect(rows[0]).not.toHaveProperty('otherwiseBranch');
  }
});

it('enforces selected-root boundaries in the helper as well as the editor', () => {
  const rows = fixture();
  expect(moveSkillBranch(rows, '0', { parentPath: '1', route: 'children' }, 0)).toBeNull();
  expect(moveSkillBranch(rows, '0.children.0', { parentPath: '1', route: 'children' }, 0)).toBeNull();
  expect(moveSkillBranch(rows, '0.children.0', { parentPath: null, route: 'children' }, 0)).toBeNull();
  expect(moveSkillBranch(rows, '0.children.0.children.0', { parentPath: '0', route: 'children' }, 0)!.path).toBe('0.children.2');
});

it('wraps an existing subtree in a new prerequisite and preserves original legacy metadata', () => {
  const rows = fixture(), parent = { id: 'new-parent', conditionTree: { kind: 'clause', text: '' } };
  const wrapped = wrapSkillBranch(rows, '0', parent)!;
  expect(wrapped.path).toBe('0');
  expect(wrapped.branches[0]).toMatchObject({ id: 'new-parent', presentation: 'scope' });
  expect(wrapped.branches[0].children![0]).toBe(rows[0]);
  expect(wrapped.branches[1]).toBe(rows[1]);
  expect(parent).not.toHaveProperty('children');
});

it('enforces the maximum depth for the entire moved or wrapped subtree', () => {
  let deep: NavigableBranch = { when: '最深条件', effect: '最深效果' };
  for (let i = 0; i < 5; i++) deep = { when: `条件 ${i}`, children: [deep] };
  const rows = [deep, { when: '另一个条件', children: [] }];
  const leaf = skillBranchLocations(rows).find(row => row.depth === 5)!;
  expect(wrapSkillBranch(rows, '0', {})).toBeNull();
  expect(wrapSkillBranch(rows, leaf.path, {})).toBeNull();
  expect(branchMoveError(rows, '1', { parentPath: leaf.path, route: 'children' })).toContain('层级过深');
  expect(moveSkillBranch(rows, '0', { parentPath: '1', route: 'children' })).toBeNull();
  expect(wrapSkillBranch(rows, '1', {})).not.toBeNull();
});

it('accepts the editor maximum depth when leaf nodes have no further matched or alternate children', () => {
  for (const route of ['matched', 'otherwise']) {
    let branch: NavigableBranch = { when: '合成叶条件', effect: '叶条件效果' };
    for (let depth = 0; depth < 5; depth++) branch = route === 'matched'
      ? { when: `合成父条件 ${depth}`, children: [branch] }
      : { when: `合成父条件 ${depth}`, effect: '成立效果', otherwiseBranch: { relation: 'else', effect: '否则效果', children: [branch] } };
    expect(skillBranchLocations([branch]).at(-1)!.depth).toBe(5);
    expect(validateSkillBranches([branch]).errors).toEqual({});
    expect(branchMoveError([branch, { when: '另一个条件', effect: '另一个效果' }], '0', { parentPath: null, route: 'children' })).toBe('');
  }
});

it('still rejects a real child beyond the maximum branch depth', () => {
  let branch: NavigableBranch = { when: '合成叶条件', effect: '叶条件效果' };
  for (let depth = 0; depth < 6; depth++) branch = { when: `合成父条件 ${depth}`, children: [branch] };
  const errors = validateSkillBranches([branch]).errors;
  expect(Object.keys(errors)).toEqual(['phases.0.children.0.children.0.children.0.children.0.children.0.children']);
  expect(Object.values(errors)[0]).toContain('最多嵌套 5 层');
  expect(branchMoveError([branch], '0', { parentPath: null, route: 'children' })).toContain('层级过深');
});
