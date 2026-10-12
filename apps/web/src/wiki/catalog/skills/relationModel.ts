// SPDX-License-Identifier: GPL-3.0-only
import type { WikiPet } from '../pets/officialTypes';
import type { WikiSkill } from './officialTypes';
import type { SkillRelationSnapshot } from './relationTypes';

export function skillPoolSourceUrl(petId: number, commit: string) {
  return `https://api.gitcode.com/api/v5/repos/rocoai-dev/roco-desc/raw/pet%2Fpet_info_${petId}.json?ref=${commit}`;
}

/** Retain independently sourced pools while adding only verified official-ID links. */
export function attachSkillRelations(pets: WikiPet[], skills: WikiSkill[], snapshot: SkillRelationSnapshot) {
  const byId = new Map(skills.filter(skill => skill.official).map(skill => [skill.official!.id, skill]));
  const bySlug = new Map(skills.map(skill => [skill.slug, skill]));
  const names = new Map<string, WikiSkill[]>();
  for (const skill of skills) names.set(skill.name, [...(names.get(skill.name) || []), skill]);
  const owners = new Map<number, Set<string>>();
  for (const pet of pets) {
    const pool = snapshot.pets[String(pet.number)];
    const sourceUrl = skillPoolSourceUrl(pet.number, pool?.sourceCommit || snapshot.source.commit);
    const links: Record<string, unknown>[] = [];
    for (const entry of pet.skills) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const row = entry as Record<string, unknown>, candidates = typeof row.name === 'string' ? names.get(row.name) || [] : [];
      const skill = typeof row.skillId === 'number' ? byId.get(row.skillId) :
        (typeof row.slug === 'string' ? bySlug.get(row.slug) : undefined) || (candidates.length === 1 ? candidates[0] : undefined);
      links.push({ ...row, ...(skill?.official ? { skillId: skill.official.id, slug: skill.slug } : {}), sourceUrl: row.sourceUrl || pet.sourceUrl });
    }
    if (pool?.petName === pet.name) for (const row of pool.skills) {
      const skill = byId.get(row.skillId); if (!skill) continue;
      const existing = links.find(link => link.skillId === row.skillId);
      const details = { skillId: row.skillId, slug: skill.slug, name: skill.name, learnLevel: row.learnLevel, learningMethod: row.learningMethod, sourceUrl, sourceTitle: '公开资料技能池 · roco-desc' };
      if (existing) {
        const level = existing.learnLevel ?? existing.learningLevel ?? existing.level;
        const method = existing.learningMethod || existing.learnMethod || existing.method;
        const learningSources = Array.isArray(existing.learningSources) ? [...existing.learningSources] : [];
        if (!learningSources.some(source => source && typeof source === 'object' && 'sourceUrl' in source && source.sourceUrl === sourceUrl)) learningSources.push({ sourceUrl, sourceTitle: details.sourceTitle });
        Object.assign(existing, { ...details,
          learningMethod: method || details.learningMethod,
          learnLevel: typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 100 ? level : details.learnLevel,
          sourceUrl: existing.sourceUrl || sourceUrl, sourceTitle: existing.sourceTitle || '独立技能池资料', learningSources,
        });
      } else links.push(details);
    }
    pet.skills = links;
    pet.skillPool = {
      status: pool?.petName === pet.name ? pool.status : 'missing',
      sourceUrl, recordedAt: pool?.recordedAt || snapshot.source.retrievedAt,
      commit: pool?.sourceCommit || snapshot.source.commit,
      unresolvedCount: pool?.unresolved.length || 0,
    };
    for (const link of links) if (typeof link.skillId === 'number') {
      const names = owners.get(link.skillId) || new Set<string>(); names.add(pet.name); owners.set(link.skillId, names);
    }
  }
  for (const skill of skills) {
    skill.ownerNames = [...(owners.get(skill.official?.id ?? skill.number ?? -1) || [])];
    if (!skill.ownerSlug && skill.ownerNames.length) skill.owner = `${skill.ownerNames.length} 只已关联宠物`;
  }
}
