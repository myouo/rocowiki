// SPDX-License-Identifier: GPL-3.0-only
import { expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { compactAnalysis } from '../apps/web/src/wiki/catalog/skills/compactAnalysisModel';
import { parseFormula, separateFormula } from '../apps/web/src/wiki/catalog/skills/formulaModel';
import CompactAnalysis from '../apps/web/src/wiki/catalog/skills/CompactAnalysis';
import { SkillBranchCard } from '../apps/web/src/wiki/SkillBranchView';
import CombatText from '../apps/web/src/wiki/CombatText';
import type { SkillAnalysisSnapshot } from '../apps/web/src/wiki/catalog/skills/analysisTypes';

vi.mock('../apps/web/src/wiki/EntityReference', () => ({ EntityText: ({ text, renderText }: { text: string; renderText?: (text: string) => React.ReactNode }) => React.createElement('span', null, renderText ? renderText(text) : text) }));

const snapshot = JSON.parse(readFileSync('apps/web/content/skill-analyses.json', 'utf8')) as SkillAnalysisSnapshot;
const sample = snapshot.records.find(row => row.skillId === 3806)!;

it('separates formula notation without flattening rounding, fractions or parentheses', () => {
  expect(parseFormula('ceil(重置总等级 / 2)')).toMatchObject({ kind: 'function', name: 'ceil', args: [{ kind: 'binary', operator: '/', left: { value: '重置总等级' }, right: { value: '2' } }] });
  expect(parseFormula('min(40% × (对手速度 − 自身速度), 200)')).toMatchObject({ kind: 'function', name: 'min', args: [{ kind: 'binary', operator: '×', right: { kind: 'group' } }, { value: '200' }] });
  expect(() => parseFormula('globalThis.alert(1)')).toThrow();
  const formulas: Parameters<typeof separateFormula>[2] = [];
  const line = '追加 min(50% × 本次威力伤害, 150) 点固伤。';
  expect(separateFormula(line, '重置与追伤', formulas)).toMatchObject({ before: '追加 ', after: ' 点固伤。', formula: 0 });
  expect(formulas[0].label).toBe('追加固伤');
  const unknown: Parameters<typeof separateFormula>[2] = [];
  expect(separateFormula('固伤 = custom(2) + 10。', '来源算式', unknown).formula).toBe(0);
  expect(unknown[0]).toMatchObject({ expression: 'custom(2) + 10', verbatim: true, tree: { kind: 'atom' } });
});

it('preserves sibling thresholds and failed-lowering scope while reducing visible containers', () => {
  const view = compactAnalysis(sample), action = view.rules[0].children[0];
  expect(view.rules[0].presentation).toBe('condition');
  expect(sample.phases[0].otherwise).toContain('来源未说明');
  expect(action.presentation).toBe('action');
  expect(action.children.map(row => row.when)).toEqual(['重置总等级 ≥ 1', '重置总等级 ≥ 3']);
  expect(action.children[0].children[0].when).toBe('本次降低对手物防失败');
  expect(action.children[1].children).toEqual([]);
  expect(view.formulas).toHaveLength(2);
});

it('keeps the existing graph, branch selection, export and formula references together', () => {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(CompactAnalysis, { record: sample })));
  const d = dom.window.document;
  expect(d.querySelectorAll('.rw-analysis-formulas math')).toHaveLength(2);
  expect(d.querySelectorAll('[data-skill-flow] math')).toHaveLength(2);
  expect(d.querySelector('mfrac')).not.toBeNull();
  expect(d.querySelector('.rw-analysis-definitions')!.compareDocumentPosition(d.querySelector('math')!) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  for (const link of d.querySelectorAll('.rw-analysis-formula-link')) expect(d.getElementById(link.getAttribute('href')!.slice(1))).not.toBeNull();
  expect(d.querySelector('[data-skill-flow="components"]')!.textContent).not.toMatch(/ceil|floor|R\s*≥/);
  expect(d.querySelector('[data-reading-kind="hit"]')).not.toBeNull();
  expect(d.querySelector('[data-skill-flow]')!.textContent).not.toContain('本次技能是否命中');
  expect(d.querySelector('.is-hit-check > [data-reading-outcome="matched"] > .rw-flow-reading-outcome-label')!.textContent).toBe('命中后');
  expect(d.querySelector('[data-skill-flow]')!.textContent).not.toContain('本次技能命中');
  expect(d.querySelector('[data-skill-flow]')!.textContent).not.toContain('继续判断');
  for (const link of d.querySelectorAll('.rw-combat-definition')) expect(d.getElementById(link.getAttribute('href')!.slice(1))).not.toBeNull();
  expect(d.querySelector('.rw-analysis-definitions [data-combat-reference="物攻"]')!.getAttribute('href')).toBe('/mechanics/attributes/#物攻');
  expect(d.querySelector('.rw-analysis-definitions [data-combat-reference="物攻"] img')).not.toBeNull();
  expect(d.querySelector('.rw-branch-navigator')!.textContent).toContain('陨石与速度强化');
  expect(d.querySelector('.rw-flow-copy-button')!.textContent).toBe('复制为 Mermaid');
  expect(d.querySelector('.rw-analysis-formulas')!.compareDocumentPosition(d.querySelector('[data-skill-flow]')!) & dom.window.Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  dom.window.close();
});

it('retains every formula and note across the complete sample without page-specific reader branches', () => {
  const records = snapshot.records.map(record => ({ record, view: compactAnalysis(record) }));
  expect(records.find(row => row.record.skillId === 3807)!.view.formulas).toHaveLength(5);
  expect(records.find(row => row.record.skillId === 3808)!.view.formulas).toHaveLength(3);
  expect(records.find(row => row.record.skillId === 713)!.view.formulas[0].tree).toMatchObject({ kind: 'function', name: 'floor' });
  for (const { record } of records) expect(() => renderToStaticMarkup(React.createElement(CompactAnalysis, { record }))).not.toThrow();
});

it('encloses failure in the lowering attempt and keeps both thresholds in one sibling group without routing arrows', () => {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(CompactAnalysis, { record: sample })));
  const d = dom.window.document;
  const lower = d.querySelector('[data-vertical-branch-title="降低物防"]')!;
  const extra = d.querySelector('[data-vertical-branch-title="追加删 PP"]')!;
  const failure = d.querySelector('[data-vertical-branch-title="陨石与速度强化"]')!;
  expect(lower.contains(failure)).toBe(true);
  expect(extra.contains(failure)).toBe(false);
  expect(lower.closest('[data-vertical-siblings="2"]')).toBe(extra.closest('[data-vertical-siblings="2"]'));
  expect(lower.querySelector('[data-reading-kind="row"]')).not.toBeNull();
  expect(failure.querySelector('[data-reading-kind="followup"]')).not.toBeNull();
  expect(lower.closest('[data-vertical-branch-title="重置强化"]')!.contains(extra)).toBe(true);
  expect(lower.closest('.is-hit-check')!.querySelector('[data-reading-outcome="matched"]')!.contains(extra)).toBe(true);
  expect(lower.closest('[data-vertical-siblings="2"]')!.querySelector('.rw-flow-vertical-group-label')!.textContent).toContain('可同时生效');
  expect(d.querySelector('.rw-flow-path, .rw-flow-vertical-entry-arrow')).toBeNull();
  dom.window.close();
});

it('reads conditions directly into effects without repeating directory labels or losing calculations and icon names', () => {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  for (const record of snapshot.records) {
    const before = JSON.stringify(record);
    const dom = new JSDOM(renderToStaticMarkup(React.createElement(CompactAnalysis, { record })));
    const d = dom.window.document;
    expect(d.querySelector('.rw-flow-reading-effect-title'), record.name).toBeNull();
    for (const card of d.querySelectorAll('.rw-flow-concise-card[data-flow-presentation]')) {
      const condition = card.dataset.readingKind === 'hit' ? card.querySelector('[data-reading-outcome="matched"] > .rw-flow-reading-outcome-label')! : card.querySelector('.rw-flow-concise-head')!;
      const content = card.querySelector('.rw-flow-reading-content')!;
      const effects = card.querySelector('.rw-flow-effect-steps');
      expect(condition, record.name).not.toBeNull();
      if (effects) expect(condition.compareDocumentPosition(effects) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, record.name).toBeTruthy();
      expect(content, record.name).not.toBeNull();
    }
    for (const link of d.querySelectorAll('.rw-analysis-formula-link')) {
      const equation = link.closest('.rw-analysis-outcome')!.querySelector('math')!;
      const full = d.getElementById(link.getAttribute('href')!.slice(1))!.querySelector('math')!;
      expect(equation, record.name).not.toBeNull();
      expect(equation.firstElementChild!.firstElementChild!.outerHTML).toBe(full.firstElementChild!.lastElementChild!.outerHTML);
    }
    if (record.skillId === 3806) {
      const lower = d.querySelector('[data-vertical-branch-title="降低物防"]')!;
      expect(lower.querySelector('h5')!.textContent).toBe('重置总等级 ≥ 1');
      expect(lower.querySelector('.rw-flow-reading-trigger')!.textContent).toBe('重置总等级 ≥ 1');
      expect(lower.querySelector('math mfrac')!.lastElementChild!.textContent).toBe('2');
      expect(lower.querySelector('.rw-analysis-inline-rounding')!.textContent).toContain('向上取整');
      expect(lower.querySelector('.rw-analysis-outcome [data-combat-reference="物防"]')!.classList.contains('rw-combat-icon-named')).toBe(true);
      const failure = d.querySelector('[data-vertical-branch-title="陨石与速度强化"]')!;
      expect(failure.querySelector('.rw-flow-reading-trigger [data-combat-reference="物防"]')!.classList.contains('rw-combat-icon-named')).toBe(true);
      expect(failure.querySelector('.rw-flow-reading-outcomes')!.querySelector('[data-combat-reference="速度"]')!.classList.contains('rw-combat-icon-named')).toBe(true);
      expect(failure.textContent).not.toContain('陨石与速度强化');
      expect(failure.textContent).toContain('召唤陨石天气 3 回合');
      expect(d.querySelector('.rw-branch-navigator')!.textContent).toContain('陨石与速度强化');
      const extra = d.querySelector('[data-vertical-branch-title="追加删 PP"]')!;
      expect(extra.querySelector('.rw-flow-reading-trigger')!.textContent).toBe('重置总等级 ≥ 3');
      expect(extra.textContent).not.toContain('陨石');
    }
    expect(JSON.stringify(record)).toBe(before);
    dom.window.close();
  }
});

it('names the first icon of each kind in a text fragment and preserves signed values and repeated references', () => {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  const text = '+2 物攻和 -1 速度；再次提高物攻。';
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(CombatText, { text, iconLabels: 'first' })));
  const d = dom.window.document;
  const attack = d.querySelectorAll('[data-combat-reference="物攻"]');
  expect(attack).toHaveLength(2);
  expect(attack[0].classList.contains('rw-combat-icon-named')).toBe(true);
  expect(attack[1].classList.contains('rw-combat-icon-named')).toBe(false);
  expect(attack[0].textContent).toBe('+2 物攻');
  expect(d.querySelector('[data-combat-reference="速度"]')!.textContent).toBe('-1 速度');
  expect(attack[0].getAttribute('href')).toBe(attack[1].getAttribute('href'));
  expect(d.body.textContent).toBe(text);
  dom.window.close();
});

it('distinguishes exclusive alternatives from independent conditions in the grouped reader', () => {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  for (const relation of ['else', 'else-if', 'independent']) {
    const branch = {
      when: '自身后手', effect: '父条件效果',
      children: [{ when: '场上有天气', effect: '满足路径子效果' }],
      otherwiseBranch: {
        relation,
        conditionTree: relation === 'else' ? null : { kind: 'clause', text: '自身有护盾' },
        effect: '另一条件效果', children: [{ when: '场上有环境', effect: '其他路径子效果' }],
      },
    };
    const before = JSON.stringify(branch);
    const dom = new JSDOM(renderToStaticMarkup(React.createElement(SkillBranchCard, { branch, concise: true })));
    const d = dom.window.document;
    if (relation === 'independent') {
      expect(d.querySelector('[data-flow-relation="independent"]')!.textContent).toContain('可同时生效');
      expect(d.querySelector('.rw-flow-reading-outcome-label')).toBeNull();
      const siblings = d.querySelectorAll('[data-vertical-siblings="2"] > .rw-flow-vertical-rows > .rw-flow-vertical-row > .rw-flow-vertical-lane');
      expect(siblings[0].textContent).toContain('满足路径子效果');
      expect(siblings[0].textContent).not.toContain('其他路径子效果');
      expect(siblings[1].textContent).toContain('其他路径子效果');
      expect(siblings[1].textContent).not.toContain('满足路径子效果');
    } else {
      const matched = d.querySelector('[data-reading-outcome="matched"]')!;
      const otherwise = d.querySelector('[data-reading-outcome="otherwise"]')!;
      expect(matched.textContent).toContain('条件成立');
      expect(matched.textContent).not.toContain('其他路径子效果');
      expect(otherwise.textContent).toContain(relation === 'else-if' ? '不成立时，再判断' : '否则');
      expect(otherwise.textContent).not.toContain('满足路径子效果');
      if (relation === 'else-if') expect(otherwise.textContent).toContain('再判断自身有护盾');
    }
    expect(d.querySelector('.rw-flow-path, .rw-flow-vertical-entry-arrow')).toBeNull();
    expect(JSON.stringify(branch)).toBe(before);
    dom.window.close();
  }
});

it('shows recorded miss outcomes separately from hit-only subtrees and distinguishes source statements from scoped deductions', () => {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  for (const id of [345, 713, 521, 567, 3805, 3806]) {
    const record = snapshot.records.find(row => row.skillId === id)!;
    const dom = new JSDOM(renderToStaticMarkup(React.createElement(CompactAnalysis, { record })));
    const d = dom.window.document;
    const outcomes = d.querySelector('.is-hit-check')!;
    const hit = outcomes.querySelector(':scope > [data-reading-outcome="matched"]')!;
    const miss = outcomes.querySelector(':scope > [data-reading-outcome="otherwise"]')!;
    expect(hit.querySelector('.rw-flow-reading-outcome-label')!.textContent).toBe('命中后');
    expect(miss.querySelector('.rw-flow-reading-outcome-label')!.textContent).toBe('未命中');
    expect(miss.querySelector('.rw-flow-vertical-group')).toBeNull();
    if (id === 345) expect(miss.textContent).toContain('无任何效果（来源明确记载）');
    else {
      expect(miss.textContent).toContain('按命中前提');
      expect(miss.textContent).toContain('来源未说明');
      expect(miss.textContent).not.toContain('无任何效果');
    }
    dom.window.close();
  }
});

it('displays an unrecorded miss as a note without writing an invented otherwise effect into source data', () => {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  const branch = { label: '命中后', when: '本次技能命中', effect: '增加自身物攻 1 级。' };
  const before = JSON.stringify(branch);
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(SkillBranchCard, { branch, concise: true })));
  const miss = dom.window.document.querySelector('[data-reading-unrecorded="true"]')!;
  expect(miss.textContent).toContain('未命中 · 说明待补');
  expect(miss.textContent).toContain('其他未命中效果未说明');
  expect(miss.textContent).not.toContain('无效果');
  expect(JSON.stringify(branch)).toBe(before);
  dom.window.close();
});
