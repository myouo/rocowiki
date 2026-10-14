// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import type { WikiSkill } from './officialTypes';

export function SkillAnalysisNotes({ skill }: { skill: WikiSkill }) {
  if (!skill.analysis) return null;
  return <div className="rw-table-note">
    <p><strong>详细解析 · roco-desc</strong> · 以{skill.analysis.source.petName}的来源记录整理，未作本站独立游戏实测。</p>
    {!skill.analysisCurrent && <p>官方技能定义已变化，原解析需要复核，未自动套用旧条件与数值。</p>}
    {skill.analysisCurrent && skill.analysis.notes.length > 0 && <ul>{skill.analysis.notes.map(note => <li key={note}>{note}</li>)}</ul>}
  </div>;
}

export default function SkillAnalysisSource({ skill }: { skill: WikiSkill }) {
  const source = skill.analysis?.source;
  if (!source) return null;
  return <div className="rw-source-row"><div>
    <strong>技能详细解析 · roco-desc 辅证资料</strong>
    <p>按{source.petName}（{source.petId}）的详细解析整理。
      {source.reportedAt ? ` 来源记录日期 ${source.reportedAt.slice(0, 10)}，该日期不代表本站实测或技能生效时间。` : ' 来源未提供记录日期。'}
    </p>
    {source.authors.length > 0 && <p>来源署名：{source.authors.join('、')}。</p>}
    {source.originalUrl && <p><a href={source.originalUrl} target="_blank" rel="noreferrer">来源记录引用的原始出处 ↗</a></p>}
    <details><summary>查看解析版本</summary><p>来源提交：<code>{source.commit}</code></p><p>详细描述 SHA-256：<code>{source.textSha256}</code></p></details>
  </div><a href={source.url} target="_blank" rel="noreferrer">查看来源记录 ↗</a></div>;
}
