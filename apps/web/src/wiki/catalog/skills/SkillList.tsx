// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import type { ReactNode } from 'react';
import type { WikiSkill } from './officialTypes';

export default function SkillList({ items, count, onShowMore, renderTable }: { items: WikiSkill[]; count: number; onShowMore: () => void; renderTable(items: WikiSkill[]): ReactNode }) {
  return <>
    {renderTable(items.slice(0, count))}
    <div className="rw-pet-feed-more">
      <p aria-live="polite">已显示 {count} / {items.length} 个技能</p>
      {count < items.length && <button type="button" className="rw-button" onClick={onShowMore}>显示更多技能</button>}
    </div>
  </>;
}
