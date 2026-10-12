// SPDX-License-Identifier: GPL-3.0-only
import React, { useId, useState } from 'react';
import type { LegacyLadderCost, OfficialLadderCost } from './ladderTypes';

const dateFormatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
export function ladderDate(value?: string) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : '日期待补';
}

export function ladderCostDescription(name: string, magic?: LegacyLadderCost | OfficialLadderCost) {
  if (!Number.isFinite(magic?.value)) return `${name} · 天梯费用尚未收录，不按 0 计算。`;
  if (magic?.status === 'official-config') return `${name} · 天梯费用 ${magic.value} 魔力。${magic.listed ? '线上配置明确列出此费用。' : '线上费用表未列出此编号，按官方客户端规则使用默认 1 费。'}${magic.banned ? '该编号列在这份线上 XML 的禁赛名单中。' : ''}采集于 ${ladderDate(magic.recordedAt)}（北京时间）。费用不代表当前可获取或完整阵容可参赛。`;
  return `${name} · 天梯费用 ${magic?.value} 魔力。历史记录生效日 ${(magic as LegacyLadderCost)?.effectiveFrom || '日期待补'}，后续调整请核对赛规。`;
}

export default function LadderCostBadge({ name, magic }: { name: string; magic?: LegacyLadderCost | OfficialLadderCost }) {
  const id = useId(), [open, setOpen] = useState(false);
  const known = Number.isFinite(magic?.value), description = ladderCostDescription(name, magic);
  return <>
    <button type="button" className={`rw-magic-cost-v6${known ? '' : ' unknown'}${magic?.banned ? ' is-banned' : ''}`} title={description} aria-label={description} aria-expanded={open} aria-describedby={open ? id : undefined}
      onClick={event => { event.currentTarget.focus(); setOpen(!open); }} onBlur={() => setOpen(false)} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
      {known ? magic?.value : '?'}
      {magic?.banned && <span className="rw-ladder-ban-dot" aria-hidden="true">禁</span>}
    </button>
    {open && <span className="rw-magic-tooltip-v6" id={id} role="tooltip">{description}</span>}
  </>;
}
