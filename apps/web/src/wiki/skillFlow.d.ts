// SPDX-License-Identifier: GPL-3.0-only
import type { NavigableBranch, NavigableCondition } from './skillBranchNavigation';
import type { SkillFlowData } from './SkillBranchView';
export interface SkillFlowOptions { direction?: 'horizontal' | 'vertical' | 'LR' | 'TD'; groupEffects?: boolean; concise?: boolean }
export interface SkillFlowNode {
  id: string; label: string; type: 'effect' | 'group' | 'decision' | 'note'; role: string;
  branchIndex?: number; branchLabel?: string; branchPath?: string; conditionTree?: NavigableCondition;
  stepNumber?: number; effectLines?: string[];
  hitCheck?: boolean;
}
export interface SkillFlowEdge { from: string; to: string; label: string; unspecified?: boolean }
export interface SkillFlowGraph { nodes: SkillFlowNode[]; edges: SkillFlowEdge[]; direction: 'LR' | 'TD'; mermaid: string }
export interface SkillFlowTree { node: SkillFlowNode; edge: SkillFlowEdge | null; children: SkillFlowTree[] }
export function effectLines(value?: string | string[]): string[];
export function normalizeSkillFlow(data?: SkillFlowData): { name: string; description: string; base: string[]; branches: NavigableBranch[] };
export function mermaidFlowDirection(value?: SkillFlowOptions | string): 'LR' | 'TD';
export function mermaidLabel(value: unknown): string;
export function buildSkillFlowGraph(data?: SkillFlowData, options?: SkillFlowOptions): SkillFlowGraph;
export function skillToMermaid(data: SkillFlowData, options?: SkillFlowOptions): string;
export function buildSkillFlowTree(graph: SkillFlowGraph): SkillFlowTree;
