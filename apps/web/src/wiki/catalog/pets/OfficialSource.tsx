// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import type { OfficialPetRecord, OfficialPetSnapshot } from './officialTypes';

export default function OfficialPetSource({ pet, source }: { pet?: OfficialPetRecord; source: OfficialPetSnapshot['source'] }) {
  if (!pet) return null;
  return <div className="rw-official-pet-source">
    <strong>官方客户端基础资料 · Angel.config</strong>
    <p>编号、名称、属性与种族值来自官方配置；采集于 <time dateTime={source.retrievedAt}>{source.retrievedAt.slice(0, 10)}</time>。</p>
    {pet.description && <p>{pet.description}</p>}
    {pet.acquisitionText && <p>配置中的获取说明：{pet.acquisitionText} <small>实际开放时间请核对活动记录。</small></p>}
    <details>
      <summary>查看资料版本</summary>
      <p>配置版本 {source.configVersion} · 图鉴编号 {pet.id}</p>
      <p className="rw-official-pet-hash">SHA-256：<code>{source.sha256}</code></p>
      <a href={source.url} target="_blank" rel="noreferrer">下载官方配置</a>
    </details>
  </div>;
}
