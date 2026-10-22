// SPDX-License-Identifier: GPL-3.0-only
export type Snapshot = Record<string, any>;
export type Snapshots = Record<string, Snapshot>;

function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}
function indexed(rows: Record<string, any>[] = [], key = 'id'): Record<string, unknown> {
  return Object.fromEntries(rows.map(row => [String(row[key]), row]));
}

/** Include both sides of changed relations, including references removed by a change. */
export function affectedCatalogRoutes(before: Snapshots, after: Snapshots, files: readonly string[]): Set<string> {
  const pets = new Set<string>(), skills = new Set<string>();
  let all = false;
  for (const file of files.filter(file => file.startsWith('apps/web/content/'))) {
    const name = file.slice('apps/web/content/'.length), old = before[name] || {}, next = after[name] || {};
    if (['published-docs-v7.json', 'published-sections-v7.json'].includes(name)) continue;
    if (name === 'official-pets.json' || name === 'official-skills.json') {
      const kind = name === 'official-pets.json' ? 'pets' : 'skills';
      for (const id of changedKeys(indexed(old[kind]), indexed(next[kind]))) (kind === 'pets' ? pets : skills).add(id);
    } else if (name === 'skill-analyses.json') {
      for (const id of changedKeys(indexed(old.records, 'skillId'), indexed(next.records, 'skillId'))) skills.add(id);
    } else if (['pet-skill-relations.json', 'game-skill-relations.json'].includes(name)) {
      for (const id of changedKeys(old.pets || {}, next.pets || {})) {
        pets.add(id);
        for (const snapshot of [old, next]) for (const row of snapshot.pets?.[id]?.skills || []) skills.add(String(row.skillId));
      }
    } else if (name === 'official-ladder.json') {
      if (old.defaultCost !== next.defaultCost) all = true;
      for (const id of changedKeys(old.costs || {}, next.costs || {})) pets.add(id);
      for (const id of [...old.bannedPetIds || [], ...next.bannedPetIds || []]) pets.add(String(id));
    } else {
      // Unmapped content dependencies must never silently become a small sample.
      all = true;
    }
  }
  const changedPets = new Set(pets), changedSkills = new Set(skills);
  for (const snapshots of [before, after]) {
    for (const name of ['pet-skill-relations.json', 'game-skill-relations.json']) {
      for (const [petId, pool] of Object.entries(snapshots[name]?.pets || {}) as [string, {skills?: {skillId: number}[]}][]) {
        for (const row of pool.skills || []) {
          if (changedPets.has(petId)) skills.add(String(row.skillId));
          if (changedSkills.has(String(row.skillId))) pets.add(petId);
        }
      }
    }
  }
  // Only extant routes can render; full route/reference checks detect dangling IDs.
  const result = new Set<string>();
  for (const kind of ['pets', 'skills'] as const) {
    const records = after[`official-${kind}.json`]?.[kind] || [];
    for (const row of records) if (all || (kind === 'pets' ? pets : skills).has(String(row.id))) result.add(`/${kind}/${row.id}/`);
    // Deterministic edge samples exercise common templates even for metadata-only updates.
    for (const row of [records[0], records[Math.floor(records.length / 2)], records.at(-1)]) if (row) result.add(`/${kind}/${row.id}/`);
  }
  return result;
}
