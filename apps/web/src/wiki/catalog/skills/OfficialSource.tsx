// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import type { OfficialSkillRecord, OfficialSkillSnapshot } from './officialTypes';

export default function OfficialSkillSource({ skill, source }: { skill?: OfficialSkillRecord; source: OfficialSkillSnapshot['source'] }) {
  if (!skill) return null;
  return <div className="rw-source-row">
    <div><strong>官方技能基础资料 · Angel.config</strong>
      <p>技能编号 {skill.id}，配置 {source.configVersion}，采集于 {source.retrievedAt.slice(0, 10)}。属性、类别、威力、PP、先手值 {skill.speedCode} 与原始描述来自技能表。</p>
      <details><summary>查看资料版本</summary><p>原包 SHA-256：<code>{source.sha256}</code></p></details>
    </div>
    <a href={source.url} target="_blank" rel="noreferrer">查看官方来源 ↗</a>
  </div>;
}
