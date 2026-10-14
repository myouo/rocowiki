// SPDX-License-Identifier: GPL-3.0-only
import React, { type ReactNode } from 'react';
import type { SkillAnalysisRecord } from './analysisTypes';
import { type SkillFlowProps } from '../../SkillBranchView';
import SkillRuleReading from '../../SkillRuleReading';
import './CompactAnalysis.css';
import CombatText from '../../CombatText';

export default function CompactAnalysis({ record, context, actionFor, baseAction }: {
  record: SkillAnalysisRecord;
  context?: SkillFlowProps['context'];
  actionFor?: SkillFlowProps['actionFor'];
  baseAction?: ReactNode;
}) {
  const hasUncertainty = record.notes.some(note => /误差|疑似|未提供|未说明|尚未|回合.{0,12}同时/u.test(note));
  return <div className="rw-compact-analysis" data-compact-analysis={record.skillId}>
    <SkillRuleReading data={record} context={context} actionFor={actionFor} baseAction={baseAction} showDescription={false}>
    {record.notes.length > 0 && <details className="rw-analysis-notes" open={hasUncertainty}><summary>解析备注与适用边界（{record.notes.length}）</summary><ul>{record.notes.map(note => <li key={note}><CombatText text={note} /></li>)}</ul></details>}
    </SkillRuleReading>
  </div>;
}
