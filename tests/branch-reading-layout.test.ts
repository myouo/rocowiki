// SPDX-License-Identifier: GPL-3.0-only
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { branchReadingKind, canReadAsFollowup } from '../apps/web/src/wiki/branchReadingLayout';
import type { SkillAnalysisSnapshot } from '../apps/web/src/wiki/catalog/skills/analysisTypes';

it('keeps hit outcomes and shared prerequisites distinct from parallel comparison rows and local followups', () => {
  const snapshot = JSON.parse(readFileSync('apps/web/content/skill-analyses.json', 'utf8')) as SkillAnalysisSnapshot;
  const root = snapshot.records.find(row => row.skillId === 3806)!.phases[0];
  const before = JSON.stringify(root), reset = root.children![0], lower = reset.children![0];
  expect(branchReadingKind(root)).toBe('hit');
  expect(branchReadingKind(reset)).toBe('scope');
  expect(reset.children!.map(branchReadingKind)).toEqual(['row', 'row']);
  expect(canReadAsFollowup(lower.children![0])).toBe(true);
  expect(JSON.stringify(root)).toBe(before);
});

it('does not collapse alternate, nested, long or unrecorded-hit paths into a simple followup', () => {
  const leaf = { when: '降低失败', effect: '召唤天气' };
  expect(canReadAsFollowup({ ...leaf, otherwise: '另一结果' })).toBe(false);
  expect(canReadAsFollowup({ ...leaf, children: [leaf] })).toBe(false);
  expect(canReadAsFollowup({ ...leaf, when: '复杂条件'.repeat(30) })).toBe(false);
  expect(canReadAsFollowup({ when: '本次技能命中', effect: '命中效果' })).toBe(false);
  expect(canReadAsFollowup({ ...leaf, conditionTree: { kind: 'group' } })).toBe(false);
});
