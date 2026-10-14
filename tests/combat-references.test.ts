// SPDX-License-Identifier: GPL-3.0-only
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COMBAT_REFERENCES, analysisTermReferences, combatTextParts } from '../apps/web/src/wiki/combatTerms';
import { skillBranchPresentation } from '../apps/web/src/wiki/skillBranchPresentation';
import { buildSkillFlowGraph } from '../apps/web/src/wiki/skillFlow';
import type { SkillAnalysisSnapshot } from '../apps/web/src/wiki/catalog/skills/analysisTypes';

it('prefers declared full terms over contained game words while preserving values and unknown text', () => {
  const definitions = analysisTermReferences([{ name: '重置总等级' }, { name: '青蚨层数' }], 'skill-3806');
  const text = '重置总等级 ≥ 3；+2 物攻和 -1 速度。对手青蚨 3 层，删除 2 PP；APP 与未知术语。';
  const parts = combatTextParts(text, definitions);
  expect(parts.map(part => part.text).join('')).toBe(text);
  expect(parts.find(part => part.text === '重置总等级')!.reference).toMatchObject({ kind: 'definition', href: '#skill-3806-term-0' });
  expect(parts.find(part => part.text === '青蚨')!.reference!.href).toBe('#skill-3806-term-1');
  expect(parts.filter(part => part.reference?.name === 'PP')).toHaveLength(1);
  expect(parts.find(part => part.reference?.name === '物攻')).toMatchObject({ prefix: '+2 ', text: '+2 物攻', reference: { href: '/mechanics/attributes/#物攻', icon: '/img/combat/ICON_202.png' } });
});

it('uses existing mechanism routes and explicit, inspectable section targets', () => {
  for (const reference of COMBAT_REFERENCES) {
    const url = new URL(reference.href, 'https://wiki.invalid');
    const path = `apps/web/docs${url.pathname.replace(/\/$/u, '')}.md`;
    const text = readFileSync(path, 'utf8');
    if (url.hash) { const target = decodeURIComponent(url.hash.slice(1)); const headings = [...text.matchAll(/^#{2,6}\s+(.+)$/gmu)].map(match => match[1].replace('、', '')); expect(headings, reference.name).toContain(target); }
    if (reference.icon) expect(readFileSync(`apps/web/static${reference.icon}`).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  }
  const provenance = JSON.parse(readFileSync('apps/web/static/img/combat/sources.json', 'utf8'));
  for (const asset of provenance.assets) expect(createHash('sha256').update(readFileSync(`apps/web/${asset.localFile}`)).digest('hex')).toBe(asset.sha256);
  for (const reference of COMBAT_REFERENCES.filter(reference => reference.icon)) {
    const asset = provenance.assets.find((asset: { localFile: string }) => `/${asset.localFile.replace('static/', '')}` === reference.icon);
    expect(asset.transparent, reference.name).toBe(true);
    expect(provenance.activeIcons, reference.name).toContain(asset.name);
    expect(asset.dimensions).toEqual([40, 40]);
    expect(asset.transparentPixels).toBeGreaterThan(200);
  }
});

it('exports hit and miss outcomes without losing thresholds, failure prerequisites or formulas', () => {
  const sample = (JSON.parse(readFileSync('apps/web/content/skill-analyses.json', 'utf8')) as SkillAnalysisSnapshot).records.find(row => row.skillId === 3806)!;
  const graph = buildSkillFlowGraph({ name: sample.name, common: sample.common, phases: sample.phases }, { concise: true, groupEffects: true });
  const gate = graph.nodes.find(node => node.hitCheck)!;
  expect(gate).toMatchObject({ label: '本次技能是否命中？', type: 'decision', conditionTree: { text: '本次技能命中' } });
  expect(graph.edges.filter(edge => edge.from === gate.id).map(edge => edge.label)).toEqual(['命中', '未命中']);
  expect(graph.nodes.find(node => node.role === 'else-effect')!.label).toContain('其他未命中效果，来源未说明');
  expect(graph.nodes.some(node => node.role === 'child-context' || node.role === 'branches')).toBe(false);
  expect(graph.mermaid).not.toContain('本次技能命中');
  for (const text of ['重置总等级 ≥ 1', '重置总等级 ≥ 3', '本次降低对手物防失败', '各删除 2 PP', 'ceil(重置总等级 / 2)']) expect(graph.mermaid).toContain(text);
  expect(graph.edges).toHaveLength(graph.nodes.length - 1);
  expect(skillBranchPresentation({ presentation: 'scope', otherwise: '未命中的结果' }, '本次技能命中').scope).toBe(false);
});
