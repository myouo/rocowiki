// SPDX-License-Identifier: GPL-3.0-only
// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import Formula from '../apps/web/src/wiki/catalog/skills/Formula';
import { parseFormula } from '../apps/web/src/wiki/catalog/skills/formulaModel';
import { CombatDefinitions, CombatIconLabels } from '../apps/web/src/wiki/CombatText';
import { analysisTermReferences } from '../apps/web/src/wiki/combatTerms';

vi.mock('../apps/web/src/wiki/EntityReference', () => ({ EntityText: ({ text }: { text: string }) => React.createElement('span', null, text) }));

it('hydrates native, keyboard-accessible variable links inside MathML without losing notation and cleans up on unmount', async () => {
  const definitions = analysisTermReferences([{ name: '重置总等级' }], 'formula-test');
  const formula = { label: '物防降低级数', expression: 'ceil(重置总等级 / 2)', scope: '降低物防', tree: parseFormula('ceil(重置总等级 / 2)') };
  const node = React.createElement(CombatDefinitions.Provider, { value: definitions }, React.createElement(CombatIconLabels.Provider, { value: 'first' }, React.createElement(Formula, { formula, id: 'formula', number: 1 })));
  const container = document.createElement('div');
  container.innerHTML = renderToString(node);
  document.body.appendChild(container);
  expect(container.textContent).toContain('重置总等级');
  const errors: unknown[] = [];
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => { root = hydrateRoot(container, node, { onRecoverableError: error => errors.push(error) }); });
    const link = container.querySelector<HTMLAnchorElement>('math [data-combat-reference="重置总等级"]')!;
    expect(link.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
    expect(link.getAttribute('href')).toBe('#formula-test-term-0');
    expect(link.tabIndex).toBe(0);
    expect(container.querySelector('mfrac')).not.toBeNull();
    expect(container.querySelector('math [data-combat-reference="物防"]')!.classList.contains('rw-combat-icon-named')).toBe(true);
    expect(container.textContent).toContain('向上取整');
    expect(errors).toEqual([]);
    const token = link.closest('mtext')!;
    await act(async () => root!.render(React.createElement(CombatDefinitions.Provider, { value: definitions }, React.createElement(CombatIconLabels.Provider, { value: 'hidden' }, React.createElement(Formula, { formula, id: 'formula', number: 1 })))));
    expect(container.querySelector('math [data-combat-reference="物防"]')!.classList.contains('rw-combat-icon-named')).toBe(false);
    const revised = { ...formula, expression: 'ceil(未知量 / 2)', tree: parseFormula('ceil(未知量 / 2)') };
    await act(async () => root!.render(React.createElement(CombatDefinitions.Provider, { value: definitions }, React.createElement(CombatIconLabels.Provider, { value: 'hidden' }, React.createElement(Formula, { formula: revised, id: 'formula', number: 1 })))));
    expect(container.textContent).toContain('未知量');
    expect(container.textContent).not.toContain('重置总等级');
    await act(async () => root!.unmount()); root = undefined;
    expect(token.textContent).toBe('未知量');
    expect(token.querySelector('a')).toBeNull();
  } finally {
    if (root) await act(async () => root!.unmount());
    container.remove(); environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
