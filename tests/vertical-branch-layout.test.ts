// SPDX-License-Identifier: GPL-3.0-only
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { branchNeedsFullWidth, verticalBranchRows } from '../apps/web/src/wiki/verticalBranchLayout';
import type { SkillAnalysisSnapshot } from '../apps/web/src/wiki/catalog/skills/analysisTypes';
import type { NavigableBranch } from '../apps/web/src/wiki/skillBranchNavigation';

const snapshot = JSON.parse(readFileSync('apps/web/content/skill-analyses.json', 'utf8')) as SkillAnalysisSnapshot;

it('places the reset thresholds side by side while retaining failure under physical defense', () => {
  const phases = snapshot.records.find(record => record.skillId === 3806)!.phases;
  const before = JSON.stringify(phases), reset = phases[0].children![0];
  const rows = verticalBranchRows(reset.children!);
  expect(rows).toHaveLength(1);
  expect(rows[0].map(lane => lane.branch.when)).toEqual(['重置总等级 ≥ 1', '重置总等级 ≥ 3']);
  expect(rows[0][0].branch.children![0].when).toBe('本次降低对手物防失败');
  expect(rows[0][1].branch.children || []).toEqual([]);
  expect(JSON.stringify(phases)).toBe(before);
});

it('keeps nested forks, alternatives, compound conditions and long content on a full row', () => {
  const simple = (label: string): NavigableBranch => ({ label, when: label, effect: '一项短效果' });
  const fork = { ...simple('父条件'), children: [simple('子条件甲'), simple('子条件乙')] };
  const branches = [simple('甲'), fork, simple('乙'), simple('丙'), { ...simple('丁'), otherwise: '另一结果' }, { ...simple('长段'), effect: '长说明'.repeat(50) }];
  const rows = verticalBranchRows(branches);
  expect(rows.map(row => row.map(lane => lane.index))).toEqual([[0], [1], [2, 3], [4], [5]]);
  expect(branchNeedsFullWidth(fork)).toBe(true);
  expect(branchNeedsFullWidth({ ...simple('组合'), conditionTree: { kind: 'group' } })).toBe(true);
  expect(branchNeedsFullWidth({ ...simple('深层'), children: [fork] })).toBe(true);
});

it('never moves weather or environment out of the after-turn prerequisite and keeps authored order', () => {
  const phases = snapshot.records.find(record => record.skillId === 3808)!.phases;
  const rows = verticalBranchRows(phases);
  expect(rows.map(row => row.map(lane => lane.index))).toEqual([[0, 1], [2]]);
  expect(rows[1][0].branch.when).toBe('自身后手使用本技能');
  const nested = verticalBranchRows(rows[1][0].branch.children!);
  expect(nested.flat().map(lane => lane.branch.label)).toEqual(['环境', '天气']);
  expect(rows.flat().map(lane => lane.branch)).toEqual(phases);
});
