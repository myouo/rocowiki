// SPDX-License-Identifier: GPL-3.0-only
import type { OfficialSkillSnapshot, WikiSkill } from './officialTypes';

type ExistingSkill = Partial<WikiSkill> & { slug: string; name: string };

export function buildOfficialSkillCatalog(snapshot: OfficialSkillSnapshot, existing: ExistingSkill[]): WikiSkill[] {
  const byNumber = new Map(existing.filter(skill => Number.isFinite(skill.number)).map(skill => [skill.number, skill]));
  const byName = new Map<string, ExistingSkill[]>(), officialNames = new Map<string, number>();
  for (const skill of existing) byName.set(skill.name, [...(byName.get(skill.name) || []), skill]);
  for (const skill of snapshot.skills) officialNames.set(skill.name, (officialNames.get(skill.name) || 0) + 1);
  const matched = new Set<string>();
  const result: WikiSkill[] = snapshot.skills.map(official => {
    // Only uniquely identified historical articles receive an official ID; same-name variants stay separate.
    const candidates = byName.get(official.name) || [];
    const previous = byNumber.get(official.id) || (officialNames.get(official.name) === 1 && candidates.length === 1 && candidates[0].number == null ? candidates[0] : undefined);
    if (previous) matched.add(previous.slug);
    return {
      ...previous,
      slug: previous?.slug || `official-skill-${official.id}`, number: official.id,
      name: official.name, type: official.type, category: official.category,
      power: official.power, pp: official.pp, speedCode: official.speedCode,
      // Preserve separately sourced initiative; the configuration's speed code is not +N initiative.
      priority: previous?.priority ?? null, hit: previous?.hit || '配置未提供独立命中规则',
      tags: previous?.tags || [], owner: previous?.owner || '学习关系待补', ownerSlug: previous?.ownerSlug || null,
      source: snapshot.source.url, curatedSource: previous?.source,
      summary: official.description, common: previous?.common || [], phases: previous?.phases || [],
      catalogEntry: !previous, official,
    };
  });
  for (const previous of existing) if (!matched.has(previous.slug)) result.push({
    type: '', category: '变化', power: null, pp: null, priority: null, tags: [],
    owner: '学习关系待补', ownerSlug: null, source: '', hit: '命中规则待核', summary: '', common: [], phases: [], ...previous,
  });
  return result;
}

export function skillCatalogHref(skill: { slug?: string; localEntry?: boolean; catalogEntry?: boolean }) {
  const slug = encodeURIComponent(skill.slug || '');
  return skill.localEntry || skill.catalogEntry ? `/skills/?entry=${slug}` : `/skills/${slug}/`;
}

export function skillCollection(skill: { name?: string; official?: { description?: string } }) {
  return skill.official && /^[A-Za-z0-9_-]+$/.test(skill.name || '') && ['空', '介绍', '待定', '无', ''].includes(skill.official.description?.trim() || '')
    ? 'placeholder' : 'regular';
}
