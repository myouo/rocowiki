// SPDX-License-Identifier: GPL-3.0-only
import type { ReactNode } from 'react';
import type { NavigableBranch, NavigableCondition } from './skillBranchNavigation';
import type { CombatIconLabelMode } from './CombatText';
import type { BranchReadingKind } from './branchReadingLayout';

export interface SkillFlowData {
  name?: string; summary?: string; description?: string;
  common?: string | string[]; base?: string | string[];
  phases?: NavigableBranch[]; branches?: NavigableBranch[];
}
export interface SkillFlowProps {
  data?: SkillFlowData;
  context?: { entity?: string; returnTo?: string };
  actionFor?: (branch: NavigableBranch, index: number) => ReactNode;
  baseAction?: ReactNode;
  headingLevel?: number; showDescription?: boolean; showExport?: boolean;
  initialDirection?: 'horizontal' | 'vertical'; showNavigation?: boolean;
  groupEffects?: boolean; concise?: boolean;
  renderEffect?: (text: string) => ReactNode;
}
export const FLOW_HORIZONTAL_MIN_WIDTH: number;
export function SkillEffectFlow(props: SkillFlowProps): ReactNode;
export function MermaidCopy(props: { data: SkillFlowData; direction?: 'horizontal' | 'vertical'; groupEffects?: boolean; concise?: boolean }): ReactNode;
export function SkillConditionView(props: { condition?: NavigableCondition; iconLabels?: CombatIconLabelMode }): ReactNode;
export function SkillBranchCard(props: { branch: NavigableBranch; index?: number; headingLevel?: number; action?: ReactNode; depth?: number; renderEffect?: (text: string) => ReactNode; concise?: boolean; readingKind?: BranchReadingKind }): ReactNode;
export default function SkillBranchList(props: { branches?: NavigableBranch[]; headingLevel?: number; className?: string; actionFor?: SkillFlowProps['actionFor']; renderEffect?: SkillFlowProps['renderEffect']; concise?: boolean }): ReactNode;
