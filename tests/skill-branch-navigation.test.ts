// SPDX-License-Identifier: GPL-3.0-only
import { expect, it } from 'vitest';
import { changeSkillBranchSiblings, focusSkillBranch, replaceSkillBranch, skillBranchLocations, type NavigableBranch } from '../apps/web/src/wiki/skillBranchNavigation';
import { buildSkillFlowGraph } from '../apps/web/src/wiki/skillFlow';
import { skillBranchPresentation } from '../apps/web/src/wiki/skillBranchPresentation';

const fixture: NavigableBranch[] = [
  { label: '命中', when: '技能命中', effect: '基础 PP 删除', children: [
    { label: '重置', when: '存在强化', effect: '重置强化', children: [
      { label: '阈值', when: '重置等级 ≥ 1', effect: '尝试降低物防', children: [{ label: '失败', when: '降低物防失败', effect: '召唤天气' }] },
      { label: '阈值', when: '重置等级 ≥ 3', effect: '额外删除 PP' },
    ] },
  ] },
  { label: '其他根条件', when: '速度较低', effect: '追加固伤', otherwiseBranch: { relation: 'else', effect: '回复', children: [{ label: '失败', when: '回复失败', effect: '获得护盾' }] } },
];

it('selects duplicate labels by occurrence and preserves all prerequisites on a focused route', () => {
  const locations = skillBranchLocations(fixture);
  expect(locations.filter(row => row.branch.label === '失败').map(row => row.path)).toEqual(['0.children.0.children.0.children.0', '1.otherwiseBranch.children.0']);
  const before = JSON.stringify(fixture);
  const focused = focusSkillBranch(fixture, '0.children.0.children.0.children.0');
  expect(focused).toHaveLength(1);
  expect(focused[0].effect).toBe('基础 PP 删除');
  expect(focused[0].children![0].effect).toBe('重置强化');
  expect(focused[0].children![0].children!.map(row => row.when)).toEqual(['重置等级 ≥ 1']);
  expect(JSON.stringify(focused)).not.toContain('额外删除 PP');
  expect(JSON.stringify(fixture)).toBe(before);
});

it('keeps otherwise prerequisites and edits only the chosen occurrence', () => {
  const focused = focusSkillBranch(fixture, '1.otherwiseBranch.children.0');
  expect(focused[0].when).toBe('速度较低');
  expect(focused[0].effect).toBe('');
  expect(focused[0].otherwiseBranch!.effect).toBe('回复');
  const updated = replaceSkillBranch(fixture, '1.otherwiseBranch.children.0', { ...fixture[1].otherwiseBranch!.children![0], effect: '获得 20 点护盾' });
  expect(updated[0]).toBe(fixture[0]);
  expect(updated[1].otherwiseBranch!.children![0].effect).toBe('获得 20 点护盾');
  expect(fixture[1].otherwiseBranch!.children![0].effect).toBe('获得护盾');
});

it('keeps a focused matched route from treating its deliberately omitted miss outcome as unrecorded', () => {
  const branches: NavigableBranch[] = [{ when: '本次技能命中', effect: '命中后的效果', otherwise: '来源确认的未命中效果', children: [{ when: '自身先手', effect: '先手效果' }] }];
  const focused = focusSkillBranch(branches, '0.children.0');
  expect(focused[0].otherwiseOmitted).toBe(true);
  expect(skillBranchPresentation(focused[0], focused[0].when!)).toMatchObject({ scope: true, missingMiss: false });
  expect(buildSkillFlowGraph({ phases: focused }, { concise: true }).nodes.some(node => node.role === 'unrecorded-outcome')).toBe(false);
  const full = buildSkillFlowGraph({ phases: branches }, { concise: true });
  expect(full.mermaid).toContain('来源确认的未命中效果');
  expect(full.edges.some(edge => edge.label === '未命中')).toBe(true);
});

it('exports an unrecorded miss with a dashed annotation rather than a no-effect claim', () => {
  const branches: NavigableBranch[] = [{ when: '本次技能命中', effect: '命中后的效果' }];
  const before = JSON.stringify(branches);
  const graph = buildSkillFlowGraph({ phases: branches }, { concise: true });
  const note = graph.nodes.find(node => node.role === 'unrecorded-outcome')!;
  expect(note).toMatchObject({ type: 'note' });
  expect(note.label).toContain('其他未命中效果未说明');
  expect(graph.edges.find(edge => edge.to === note.id)).toMatchObject({ label: '未命中', unspecified: true });
  expect(graph.mermaid).toContain('-.->');
  expect(graph.edges).toHaveLength(graph.nodes.length - 1);
  expect(JSON.stringify(branches)).toBe(before);
});

it('moves and removes nested siblings without changing the parent scope or other paths', () => {
  const moved = changeSkillBranchSiblings(fixture, '0.children.0.children.0', rows => [...rows].reverse());
  expect(moved[0].children![0].children!.map(row => row.when)).toEqual(['重置等级 ≥ 3', '重置等级 ≥ 1']);
  expect(moved[1]).toBe(fixture[1]);
  const removed = changeSkillBranchSiblings(moved, '0.children.0.children.1', (rows, i) => rows.filter((_, n) => n !== i));
  expect(removed[0].children![0].children).toHaveLength(1);
  expect(removed[0].children![0].effect).toBe('重置强化');
});

it('does not turn an independent alternate into a prerequisite when selecting its descendants', () => {
  const branches: NavigableBranch[] = [{ label: '天气与环境', when: '天气存在', effect: '天气效果', otherwiseBranch: { relation: 'independent', conditionTree: { kind: 'clause', text: '环境存在' }, effect: '环境效果', children: [{ label: '环境子项', when: '环境回合足够', effect: '延长环境' }] } }];
  const focused = focusSkillBranch(branches, '0.otherwiseBranch.children.0');
  expect(focused[0].conditionTree!.text).toBe('环境存在');
  expect(focused[0].effect).toBe('环境效果');
  expect(JSON.stringify(focused)).not.toContain('天气存在');
});

it('groups horizontal effect steps without dropping order, thresholds, failure branches or Mermaid text', () => {
  const data = { name: '合成技能', common: ['基础效果甲', '基础效果乙'], phases: fixture };
  const graph = buildSkillFlowGraph(data, { direction: 'horizontal', groupEffects: true });
  expect(graph.nodes.find(row => row.effectLines?.length === 2)!.effectLines).toEqual(['基础效果甲', '基础效果乙']);
  for (const text of ['重置等级 ≥ 1', '重置等级 ≥ 3', '降低物防失败', '回复失败', '额外删除 PP']) expect(graph.mermaid).toContain(text);
  expect(graph.mermaid).toContain('不成立');
  expect(graph.edges).toHaveLength(graph.nodes.length - 1);
});
