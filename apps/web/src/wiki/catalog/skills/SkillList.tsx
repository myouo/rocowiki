// SPDX-License-Identifier: GPL-3.0-only
import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { WikiSkill } from './officialTypes';

export default function SkillList({ items, scope, renderTable }: { items: WikiSkill[]; scope: string; renderTable(items: WikiSkill[]): ReactNode }) {
  const [visible, setVisible] = useState({ scope, count: 60 });
  const count = Math.min(visible.scope === scope ? visible.count : 60, items.length);
  useEffect(() => { setVisible({ scope, count: 60 }); }, [scope]);
  return <>
    {renderTable(items.slice(0, count))}
    <div className="rw-pet-feed-more">
      <p aria-live="polite">已显示 {count} / {items.length} 个技能</p>
      {count < items.length && <button type="button" className="rw-button" onClick={() => setVisible({ scope, count: count + 60 })}>显示更多技能</button>}
    </div>
  </>;
}
