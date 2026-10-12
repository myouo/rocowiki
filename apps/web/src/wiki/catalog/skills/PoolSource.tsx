// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import type { WikiPet } from '../pets/officialTypes';

export default function SkillPoolSource({ pet }: { pet: WikiPet }) {
  const source = pet.skillPool;
  if (!source) return null;
  if (source.game) return <div className="rw-source-row">
    <div><strong>宠物技能关联 · 官方游戏采集</strong>
      <p>采集于 {source.game.recordedAt.slice(0, 10)}，采集时该实例为 {source.game.observedLevel} 级；确认了 {source.game.verifiedCount} 个可选技能。此接口未提供各技能的学习等级，未采到不代表无法学习。</p>
      {source.game.auxiliaryCount > 0 && <p>另有 {source.game.auxiliaryCount} 项仅来自辅证，列表中已单独标注。</p>}
      {source.unresolvedCount > 0 && <p>另有 {source.unresolvedCount} 个游戏技能编号尚待对应当前官方定义。</p>}
      <details><summary>查看采集版本</summary><p>游戏响应体 SHA-256：<code>{source.game.bodySha256}</code></p></details>
    </div><a href={source.sourceUrl} target="_blank" rel="noreferrer">查看游戏来源 ↗</a>
  </div>;
  return <div className="rw-source-row">
    <div><strong>宠物技能关联 · 辅证资料</strong>
      <p>这些学习关系来自历史 roco-desc 快照，仅作辅证，尚未由游戏数据核验。历史采集于 {source.recordedAt.slice(0, 10)}。</p>
      {source.status === 'stale' && <p>当前公开记录缺失或未通过校验，保留此前已核对的关联。</p>}
      {(source.status === 'missing' || source.status === 'invalid') && <p>当前来源记录尚未通过核对，已有独立资料继续保留；未列出不表示无法学习。</p>}
      {source.unresolvedCount > 0 && <p>另有 {source.unresolvedCount} 条技能名称或编号关系待核，未自动匹配。</p>}
      <details><summary>查看关联版本</summary><p>来源提交：<code>{source.commit}</code></p></details>
    </div>
    <a href={source.sourceUrl} target="_blank" rel="noreferrer">查看关联来源 ↗</a>
  </div>;
}
