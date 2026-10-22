// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import { ladderBanEntries } from '../catalog/pets/ladderModel';
import { ladderDate } from '../catalog/pets/LadderCostBadge';
import type { OfficialLadderSnapshot } from '../catalog/pets/ladderTypes';
import type { OfficialPetRecord } from '../catalog/pets/officialTypes';

type BanSnapshot = Pick<OfficialLadderSnapshot, 'source' | 'bannedPetIds'>;

export function LadderBanList({ snapshot, catalog, layout = 'chips' }: {
  snapshot: BanSnapshot;
  catalog: readonly Pick<OfficialPetRecord, 'id' | 'name'>[];
  layout?: 'chips' | 'list';
}) {
  const names = ladderBanEntries(snapshot, catalog);
  if (!names.length) return <p>这份配置的禁赛名单为空；完整参赛条件仍需核对。</p>;
  const items = names.map(pet => {
    const label = pet.href ? <a href={pet.href}>{pet.name}</a> : <span className="wa-v5-ban-name">{pet.name}</span>;
    return layout === 'list' ? <li key={pet.number}>{label}</li> : <React.Fragment key={pet.number}>{label}</React.Fragment>;
  });
  return layout === 'list' ? <ul className="rw-v6-ladder-bans">{items}</ul> : <div className="wa-name-chips wa-v5-ban-list">{items}</div>;
}

export function LadderBanSource({ snapshot }: { snapshot: BanSnapshot }) {
  return <div className="wa-source-details">
    <p>采集于 <time dateTime={snapshot.source.retrievedAt}>{ladderDate(snapshot.source.retrievedAt)}</time>（北京时间）。配置未提供生效日期，切换时刻、临时调整及完整参赛条件以游戏内规则为准。</p>
    <a href={snapshot.source.url} target="_blank" rel="noreferrer">官方天梯 XML · 禁赛配置</a>
    <details><summary>查看配置版本</summary>
      <p>禁赛取自 LimitSpirit；天梯费用单独读取 SpiritCost。</p>
      <p className="rw-official-pet-hash">SHA-256：<code>{snapshot.source.sha256}</code></p>
    </details>
  </div>;
}
