// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import type { WikiPet } from '../pets/officialTypes';

export default function SkillPoolSource({ pet }: { pet: WikiPet }) {
  const source = pet.skillPool;
  if (!source) return null;
  return <div className="rw-source-row">
    <div><strong>宠物技能关联 · 公开资料技能池</strong>
      <p>学习关系来自 roco-desc，按宠物身份与官方技能编号核对；采集于 {source.recordedAt.slice(0, 10)}。</p>
      {source.status === 'stale' && <p>当前公开记录缺失或未通过校验，保留此前已核对的关联。</p>}
      {(source.status === 'missing' || source.status === 'invalid') && <p>当前来源记录尚未通过核对，已有独立资料继续保留；未列出不表示无法学习。</p>}
      {source.unresolvedCount > 0 && <p>另有 {source.unresolvedCount} 条技能名称或编号关系待核，未自动匹配。</p>}
      <details><summary>查看关联版本</summary><p>来源提交：<code>{source.commit}</code></p></details>
    </div>
    <a href={source.sourceUrl} target="_blank" rel="noreferrer">查看关联来源 ↗</a>
  </div>;
}
