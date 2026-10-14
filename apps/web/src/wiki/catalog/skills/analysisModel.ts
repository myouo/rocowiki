// SPDX-License-Identifier: GPL-3.0-only
import type { WikiSkill } from './officialTypes';
import type { SkillAnalysisSnapshot } from './analysisTypes';

export function attachSkillAnalyses(skills: WikiSkill[], snapshot: SkillAnalysisSnapshot) {
  const byId = new Map(snapshot.records.map(record => [record.skillId, record]));
  for (const skill of skills) {
    const record = byId.get(skill.official?.id ?? -1);
    if (!record || !skill.official || skill.name !== record.name) continue;
    const current = skill.official;
    skill.analysis = record;
    skill.analysisCurrent = Object.keys(record.expectedOfficial).every(key =>
      current[key as keyof typeof current] === record.expectedOfficial[key as keyof typeof record.expectedOfficial]);
    if (!skill.analysisCurrent) continue;
    skill.common = record.common;
    skill.phases = record.phases;
    skill.terms = record.terms || [];
    if (record.hitRule) skill.hit = `${record.hitRule} · 解析资料`;
  }
}
