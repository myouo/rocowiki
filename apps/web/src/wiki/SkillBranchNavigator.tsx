// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import { GitBranch, Layers3 } from 'lucide-react';
import { branchTitle, type BranchLocation } from './skillBranchNavigation';
import './SkillBranchNavigator.css';

export default function SkillBranchNavigator({ locations, selected, onSelect, allowAll = true, errors = {} }: {
  locations: BranchLocation[]; selected: string; onSelect: (path: string) => void;
  allowAll?: boolean; errors?: Record<string, string>;
}) {
  return <nav className="rw-branch-navigator" aria-label="技能分支目录">
    <div className="rw-branch-navigator-title"><GitBranch size={14} aria-hidden="true" /><strong>分支目录</strong><span>{locations.length}</span></div>
    {allowAll && <button type="button" className="rw-branch-navigator-all" aria-pressed={selected === ''} onClick={() => onSelect('')}><Layers3 size={14} aria-hidden="true" />全部分支</button>}
    <ol>{locations.map(location => {
      const hasError = Object.keys(errors).some(key => key === `phases.${location.path}` || key.startsWith(`phases.${location.path}.`));
      return <li key={location.path} style={{ paddingLeft: Math.min(location.depth, 5) * 12 }}>
        <button type="button" aria-label={`选择分支 ${(location.path.match(/\d+/gu) || []).map(n => Number(n) + 1).join('.')}：${branchTitle(location.branch)}`} aria-pressed={selected === location.path} onClick={() => onSelect(location.path)} title={location.branch.conditionTree?.text || location.branch.when}>
          <span className="rw-branch-navigator-marker" aria-hidden="true">{location.depth ? '↳' : location.rootIndex + 1}</span>
          <span>{branchTitle(location.branch)}{location.ancestors.at(-1)?.route !== '成立' && location.depth > 0 && <small>{location.ancestors.at(-1)?.route}</small>}</span>
          {hasError && <small className="rw-branch-navigator-error">待补</small>}
        </button>
      </li>;
    })}</ol>
  </nav>;
}
