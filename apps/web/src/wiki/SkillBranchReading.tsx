// SPDX-License-Identifier: GPL-3.0-only
import React, { type ReactNode } from 'react';
import CombatText, { CombatIconScope } from './CombatText';
import type { NavigableBranch, NavigableCondition } from './skillBranchNavigation';
import { skillBranchPresentation, UNSPECIFIED_MISS_EFFECT } from './skillBranchPresentation';
import { branchReadingKind, canReadAsFollowup, type BranchReadingKind } from './branchReadingLayout';
import './SkillBranchReading.css';

export default function SkillBranchReading({ branch, conditionText, headingLevel = 3, action, kind, renderCondition, renderEffects, renderChildren }: {
  branch: NavigableBranch;
  conditionText: string;
  headingLevel?: number;
  action?: ReactNode;
  kind?: BranchReadingKind;
  renderCondition: (condition?: NavigableCondition) => ReactNode;
  renderEffects: (text: string) => ReactNode;
  renderChildren: (branches: NavigableBranch[], followup?: boolean) => ReactNode;
}) {
  const reading = skillBranchPresentation(branch, conditionText), alternate = branch.otherwiseBranch;
  const layout = reading.hitCheck ? 'hit' : kind || branchReadingKind(branch);
  const Heading = `h${Math.min(6, Math.max(3, headingLevel))}` as 'h3' | 'h4' | 'h5' | 'h6';
  const children = branch.children || [];
  const followup = layout === 'row' && children.length === 1 && canReadAsFollowup(children[0]);
  const content = <div className={`rw-flow-reading-outcomes${alternate || reading.missingMiss ? ' is-paired' : ''}${reading.hitCheck ? ' is-hit-check' : ''}`}>
    <section className="rw-flow-reading-outcome" data-reading-outcome="matched">
      {(alternate || reading.missingMiss) && <Heading className="rw-flow-reading-outcome-label">{reading.hitCheck ? '命中后' : '条件成立'}</Heading>}
      {branch.effect && renderEffects(branch.effect)}
      {children.length > 0 && renderChildren(children, followup)}
    </section>
    {alternate && <section className="rw-flow-reading-outcome" data-reading-outcome="otherwise">
      <Heading className="rw-flow-reading-outcome-label">{reading.hitCheck ? '未命中' : alternate.conditionTree ? '不成立时，再判断' : '否则'}</Heading>
      {alternate.conditionTree && <div className="rw-flow-alternative-decision">{renderCondition(alternate.conditionTree)}</div>}
      {alternate.effect && renderEffects(alternate.effect)}
      {!!alternate.children?.length && renderChildren(alternate.children)}
    </section>}
    {reading.missingMiss && <section className="rw-flow-reading-outcome is-unrecorded" data-reading-outcome="otherwise" data-reading-unrecorded="true">
      <Heading className="rw-flow-reading-outcome-label">未命中 · 说明待补</Heading>
      <p className="rw-flow-reading-unrecorded"><CombatText text={UNSPECIFIED_MISS_EFFECT} /></p>
    </section>}
  </div>;
  return <article className="rw-skill-branch-card rw-skill-flow-card rw-flow-concise-card rw-rule-reading" data-reading-kind={layout} data-flow-relation={alternate ? 'conditional' : 'single'} data-flow-presentation={reading.scope ? 'scope' : branch.presentation === 'action' ? 'action' : 'condition'}>
    {layout === 'hit' ? action && <div className="rw-rule-reading-controls">{action}</div> : <div className={`rw-flow-concise-head${reading.scope ? ' rw-flow-scope-head' : ' rw-flow-decision'}`}>
      <div className="rw-flow-reading-heading">{reading.scope ? <Heading className="rw-flow-reading-trigger"><CombatText text={reading.caption} iconLabels="all" /></Heading> : !branch.conditionTree || branch.conditionTree.kind === 'clause' ? <Heading className="rw-flow-reading-trigger">{renderCondition(branch.conditionTree)}</Heading> : <div className="rw-flow-reading-trigger">{renderCondition(branch.conditionTree)}</div>}</div>{action}
    </div>}
    <CombatIconScope introducedBy={reading.scope ? reading.caption : conditionText}><div className="rw-flow-reading-content">{content}</div></CombatIconScope>
  </article>;
}
