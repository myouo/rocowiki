// SPDX-License-Identifier: GPL-3.0-only
import type { WikiPet } from '../pets/officialTypes';
import type { WikiSkill } from './officialTypes';
import type { GameSkillRelationSnapshot } from './gameTypes';

/** Verified membership does not promote an auxiliary learning level into a game fact. */
export function attachGameSkillRelations(pets: WikiPet[], skills: WikiSkill[], snapshot: GameSkillRelationSnapshot) {
  const byId = new Map(skills.filter(skill => skill.official).map(skill => [skill.official!.id, skill]));
  for (const pet of pets) {
    const game = snapshot.pets[String(pet.number)];
    if (!game || game.petName !== pet.name) continue;
    const previous = pet.skills.filter(row => row && typeof row === 'object' && !Array.isArray(row)) as Record<string, unknown>[];
    const observed = new Set(game.skills.map(row => row.skillId));
    let unresolved = 0;
    const gameRows: Record<string, unknown>[] = [];
    for (const row of game.skills) {
      const skill = byId.get(row.skillId);
      if (!skill) { unresolved++; continue; }
      const auxiliary = previous.find(entry => entry.skillId === row.skillId);
      gameRows.push({ skillId: row.skillId, name: skill.name, slug: skill.slug, learningMethod: row.learningMethod, learnLevel: null,
        evidence: 'game', sourceUrl: 'https://17roco.qq.com/', sourceTitle: '官方游戏服务端采集',
        ...(auxiliary ? { auxiliaryLearning: auxiliary } : {}),
      });
    }
    const auxiliaryRows = previous.filter(row => !observed.has(Number(row.skillId))).map(row => ({ ...row, evidence: 'auxiliary' }));
    pet.skills = [...gameRows, ...auxiliaryRows];
    pet.skillPool = { status: 'available', sourceUrl: 'https://17roco.qq.com/', recordedAt: game.source.retrievedAt,
      commit: pet.skillPool?.commit || '', unresolvedCount: unresolved,
      game: { recordedAt: game.source.retrievedAt, observedLevel: game.observedLevel, bodySha256: game.source.bodySha256, verifiedCount: gameRows.length, auxiliaryCount: auxiliaryRows.length },
    };
  }
  const owners = new Map<number, Set<string>>();
  for (const pet of pets) for (const row of pet.skills) if (row && typeof row === 'object' && 'skillId' in row && typeof row.skillId === 'number') {
    const names = owners.get(row.skillId) || new Set<string>(); names.add(pet.name); owners.set(row.skillId, names);
  }
  for (const skill of skills) {
    skill.ownerNames = [...(owners.get(skill.official?.id ?? skill.number ?? -1) || [])];
    if (!skill.ownerSlug && skill.ownerNames.length) skill.owner = `${skill.ownerNames.length} 只已关联宠物`;
  }
}
