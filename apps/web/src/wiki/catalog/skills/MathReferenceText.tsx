// SPDX-License-Identifier: GPL-3.0-only
import React, { createElement, useContext, useEffect, useRef } from 'react';
import { CombatDefinitions, CombatIconLabels, CombatKnownIcons } from '../../CombatText';
import { combatTextParts } from '../../combatTerms';

/** MathML mtext is an HTML integration point. React currently inherits its
 * MathML namespace for descendants, so this component owns native HTML links.
 * SSR retains the complete plain token; no source expression is evaluated.
 */
export default function MathReferenceText({ value }: { value: string }) {
  const root = useRef<Element>(null), definitions = useContext(CombatDefinitions), iconLabels = useContext(CombatIconLabels), knownIcons = useContext(CombatKnownIcons);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    element.textContent = value;
    const parts = combatTextParts(value, definitions);
    if (!parts.some(part => part.reference)) return;
    const document = element.ownerDocument, fragment = document.createDocumentFragment();
    const cleanup: (() => void)[] = [];
    for (const part of parts) {
      if (!part.reference) { fragment.append(document.createTextNode(part.text)); continue; }
      const { reference } = part, link = document.createElement('a');
      link.href = reference.href;
      link.className = `rw-combat-reference rw-combat-${reference.kind}`;
      link.dataset.combatReference = reference.name;
      link.title = reference.kind === 'definition' ? `查看「${part.text}」的定义` : `查看「${part.text}」的战斗机制说明`;
      if (reference.icon) {
        link.classList.add('rw-combat-icon-reference');
        if (iconLabels === 'all' || iconLabels === 'first' && !knownIcons.includes(reference.name)) link.classList.add('rw-combat-icon-named');
        const icon = document.createElement('img'), label = document.createElement('span');
        icon.src = reference.icon; icon.alt = ''; icon.setAttribute('aria-hidden', 'true'); icon.width = icon.height = 20;
        label.className = 'rw-combat-icon-label'; label.textContent = reference.name;
        const fallback = () => { link.textContent = part.text; link.classList.remove('rw-combat-icon-reference'); };
        icon.addEventListener('error', fallback, { once: true }); cleanup.push(() => icon.removeEventListener('error', fallback));
        if (part.prefix) link.appendChild(document.createTextNode(part.prefix));
        link.appendChild(icon); link.appendChild(label);
      } else link.textContent = part.text;
      fragment.append(link);
    }
    const token = document.createElement('span');
    token.className = 'rw-math-reference-token';
    token.appendChild(fragment);
    element.replaceChildren(token);
    return () => { cleanup.forEach(dispose => dispose()); element.textContent = value; };
  }, [value, definitions, iconLabels, knownIcons]);
  return createElement('mtext', { ref: root }, value);
}
