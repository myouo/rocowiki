// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import type { OfficialLadderCost } from './ladderTypes';
import { ladderDate } from './LadderCostBadge';

export default function LadderSource({ magic }: { magic?: OfficialLadderCost }) {
  if (!magic) return null;
  return <div className="rw-official-pet-source">
    <strong>官方天梯费用与配置禁赛 · LadderMatchConfig.xml</strong>
    <p>天梯费用 {magic.value} 魔力 · {magic.listed ? '费用表明确列出' : '按官方客户端默认 1 费规则'}{magic.banned ? ' · 列入配置禁赛名单' : ''}</p>
    <p>采集于 <time dateTime={magic.recordedAt}>{ladderDate(magic.recordedAt)}</time>（北京时间）。配置没有给出生效日期，临时调整及完整参赛条件请核对游戏内规则。</p>
    <details><summary>查看费用来源</summary>
      <p>费用取自 SpiritCost；禁赛取自 LimitSpirit，禁赛不改变费用。</p>
      <p className="rw-official-pet-hash">SHA-256：<code>{magic.sha256}</code></p>
      <a href={magic.sourceUrl} target="_blank" rel="noreferrer">查看线上官方 XML</a>
    </details>
  </div>;
}
