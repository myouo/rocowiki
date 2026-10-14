// SPDX-License-Identifier: GPL-3.0-only
import React, { type ReactNode } from 'react';
import { branchTitle, type NavigableBranch } from './skillBranchNavigation';
import { verticalBranchRows } from './verticalBranchLayout';
import { branchReadingKind } from './branchReadingLayout';
import './VerticalBranchGroup.css';

export default function VerticalBranchGroup({ branches, nested = false, layout = 'cards', renderBranch }: {
  branches: NavigableBranch[];
  nested?: boolean;
  layout?: 'cards' | 'rules' | 'followups';
  renderBranch: (branch: NavigableBranch, index: number) => ReactNode;
}) {
  const fork = branches.length > 1;
  const rows = layout === 'cards' ? verticalBranchRows(branches) : branches.map((branch, index) => [{ branch, index, fullWidth: false }]);
  const table = layout === 'rules' && fork && branches.every(branch => branchReadingKind(branch) === 'row');
  return <div className={`rw-flow-vertical-group${nested ? ' is-nested' : ''}${fork ? ' is-fork' : ''}`} data-vertical-siblings={branches.length} data-vertical-layout={layout}>
    {fork && <p className="rw-flow-vertical-group-label">以下条件分别判断<span>可同时生效</span></p>}
    {table && <div className="rw-rule-column-headings" aria-hidden="true"><span>触发条件</span><span>效果</span></div>}
    <div className="rw-flow-vertical-rows">{rows.map((row, rowIndex) => <div className="rw-flow-vertical-row" data-vertical-pair={row.length === 2 ? 'true' : undefined} key={rowIndex}>
      {row.map(lane => <div className="rw-flow-vertical-lane" key={lane.branch.id || lane.index} data-vertical-branch-index={lane.index} data-vertical-branch-title={branchTitle(lane.branch)} data-vertical-full-width={lane.fullWidth ? 'true' : undefined}>
        {renderBranch(lane.branch, lane.index)}
      </div>)}
    </div>)}</div>
  </div>;
}
