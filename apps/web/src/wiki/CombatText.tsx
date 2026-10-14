// SPDX-License-Identifier: GPL-3.0-only
import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { EntityText } from './EntityReference';
import { combatTextParts, type CombatReference } from './combatTerms';
import './CombatText.css';

export const CombatDefinitions = createContext<CombatReference[]>([]);
export type CombatIconLabelMode = 'hidden' | 'first' | 'all';
export const CombatIconLabels = createContext<CombatIconLabelMode>('hidden');
export const CombatKnownIcons = createContext<readonly string[]>([]);

/** Only visible trigger text introduces icons; directory labels are not read here. */
export function CombatIconScope({ introducedBy, children }: { introducedBy: string; children: ReactNode }) {
  const definitions = useContext(CombatDefinitions);
  const known = useMemo(() => [...new Set(combatTextParts(introducedBy, definitions).flatMap(part => part.reference?.icon ? [part.reference.name] : []))], [introducedBy, definitions]);
  return <CombatKnownIcons.Provider value={known}>{children}</CombatKnownIcons.Provider>;
}

function Reference({ text, reference, prefix, showName }: { text: string; reference: CombatReference; prefix?: string; showName: boolean }) {
  const [failed, setFailed] = useState(false);
  return <a href={reference.href} className={`rw-combat-reference rw-combat-${reference.kind}${reference.icon && !failed ? ` rw-combat-icon-reference${showName ? ' rw-combat-icon-named' : ''}` : ''}`} data-combat-reference={reference.name} title={reference.kind === 'definition' ? `查看「${text}」的定义` : `查看「${text}」的战斗机制说明`}>
    {reference.icon && !failed ? <>{prefix}<img src={reference.icon} alt="" aria-hidden="true" width={20} height={20} onError={() => setFailed(true)} /><span className="rw-combat-icon-label">{reference.name}</span></> : text}
  </a>;
}

/** Enrich text tokens only; authored links and code keep their original boundaries. */
export default function CombatText({ text, path = '/', definitions, iconLabels }: { text: string; path?: string; definitions?: CombatReference[]; iconLabels?: CombatIconLabelMode }) {
  const inherited = useContext(CombatDefinitions), inheritedLabels = useContext(CombatIconLabels), known = useContext(CombatKnownIcons);
  const labelMode = iconLabels ?? inheritedLabels;
  const renderText = (value: string) => {
    const parts = combatTextParts(value, definitions ?? inherited);
    return parts.map((part, index) => part.reference ? <Reference key={index} text={part.text} reference={part.reference} prefix={part.prefix} showName={labelMode === 'all' || labelMode === 'first' && !known.includes(part.reference.name) && !parts.slice(0, index).some(previous => previous.reference?.name === part.reference?.name)} /> : part.text);
  };
  return <EntityText text={text} path={path} renderText={renderText} />;
}
