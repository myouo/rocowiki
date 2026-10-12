// SPDX-License-Identifier: GPL-3.0-only
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { GameSkillObservation, GameSkillRelationSnapshot } from '../../apps/web/src/wiki/catalog/skills/gameTypes';
import type { OfficialPetSnapshot } from '../../apps/web/src/wiki/catalog/pets/officialTypes';
import type { OfficialSkillSnapshot } from '../../apps/web/src/wiki/catalog/skills/officialTypes';
import { GAME_SKILL_POOL_COMMAND } from './game-skill-pool';

const observationSchema = z.object({
  source: z.object({ kind: z.literal('official-game-server'), commandId: z.literal(GAME_SKILL_POOL_COMMAND), retrievedAt: z.string().datetime(), bodySha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  petId: z.number().int().min(1).max(0xffffffff), observedLevel: z.number().int().min(1).max(100),
  skills: z.array(z.object({ skillId: z.number().int().min(1).max(65535), learningMethod: z.enum(['', '遗传']), learnLevel: z.null() }).strict()).max(4096),
}).strict();
const capturesSchema = z.object({ schemaVersion: z.literal(1), captures: z.array(observationSchema).min(1).max(4096) }).strict();
export function parseGameSkillCaptures(value: unknown): GameSkillObservation[] {
  const parsed = capturesSchema.safeParse(value);
  if (!parsed.success) throw new Error('Invalid sanitized game captures; credentials, account fields and third-party data are forbidden');
  return parsed.data.captures;
}
export const emptyGameSkillSnapshot = (): GameSkillRelationSnapshot => ({ schemaVersion: 1, source: null, pets: {} });

export function buildGameSkillSnapshot(captures: GameSkillObservation[], pets: OfficialPetSnapshot, skills: OfficialSkillSnapshot, previous = emptyGameSkillSnapshot()): GameSkillRelationSnapshot {
  const checked = parseGameSkillCaptures({ schemaVersion: 1, captures });
  const knownPets = new Map(pets.pets.map(pet => [pet.id, pet.name])), knownSkills = new Set(skills.skills.map(skill => skill.id));
  const records = { ...validateGameSkillSnapshot(previous).pets }, incoming = new Set<number>();
  for (const capture of checked) {
    if (incoming.has(capture.petId)) throw new Error('Duplicate species observations require selecting one bag instance');
    incoming.add(capture.petId);
    const petName = knownPets.get(capture.petId);
    if (!petName) throw new Error('Captured pet is absent from the official book snapshot; refresh official definitions first');
    if (new Set(capture.skills.map(skill => skill.skillId)).size !== capture.skills.length || capture.skills.some(skill => !knownSkills.has(skill.skillId))) throw new Error('Captured skills are duplicated or absent from official definitions');
    const record = { ...capture, petName, scope: 'observed-bag-pool' as const, skills: [...capture.skills].sort((a, b) => a.skillId - b.skillId) };
    const old = records[String(capture.petId)];
    if (old && old.petName === petName && old.observedLevel === record.observedLevel && JSON.stringify(old.skills) === JSON.stringify(record.skills)) continue;
    if (old && Date.parse(capture.source.retrievedAt) <= Date.parse(old.source.retrievedAt)) throw new Error('Changed game observations must be newer than the saved capture');
    records[String(capture.petId)] = record;
  }
  const sorted = Object.fromEntries(Object.entries(records).sort(([a], [b]) => Number(a) - Number(b)));
  const values = Object.values(sorted);
  return { schemaVersion: 1, source: {
    kind: 'official-game-server', url: 'https://17roco.qq.com/', retrievedAt: values.reduce((latest, pool) => Date.parse(pool.source.retrievedAt) > Date.parse(latest) ? pool.source.retrievedAt : latest, values[0].source.retrievedAt),
    sha256: createHash('sha256').update(JSON.stringify(sorted)).digest('hex'), petCount: values.length, relationCount: values.reduce((n, pool) => n + pool.skills.length, 0),
  }, pets: sorted };
}

export function validateGameSkillSnapshot(value: unknown): GameSkillRelationSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid game snapshot');
  const row = value as Record<string, unknown>;
  if (row.schemaVersion !== 1 || !row.pets || typeof row.pets !== 'object' || Array.isArray(row.pets)) throw new Error('Invalid game snapshot');
  const records = row.pets as Record<string, unknown>;
  if (Object.keys(records).length > 4096) throw new Error('Too many saved game observations');
  for (const [id, value] of Object.entries(records)) {
    const parsed = observationSchema.extend({ petName: z.string().min(1).max(100), scope: z.literal('observed-bag-pool') }).safeParse(value);
    if (!parsed.success || String(parsed.data.petId) !== id || new Set(parsed.data.skills.map(skill => skill.skillId)).size !== parsed.data.skills.length) throw new Error('Invalid saved game observation');
  }
  const source = z.object({ kind: z.literal('official-game-server'), url: z.literal('https://17roco.qq.com/'), retrievedAt: z.string().datetime(), sha256: z.string().regex(/^[a-f0-9]{64}$/), petCount: z.number().int().min(1), relationCount: z.number().int().min(0) }).strict().nullable().safeParse(row.source);
  if (!source.success || Boolean(source.data) !== Boolean(Object.keys(records).length) || Object.keys(row).some(key => !['schemaVersion', 'source', 'pets'].includes(key))) throw new Error('Invalid game snapshot source');
  const snapshot = value as GameSkillRelationSnapshot;
  if (snapshot.source && (snapshot.source.petCount !== Object.keys(snapshot.pets).length || snapshot.source.relationCount !== Object.values(snapshot.pets).reduce((n, pool) => n + pool.skills.length, 0))) throw new Error('Game snapshot counts do not match');
  if (snapshot.source && snapshot.source.sha256 !== createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(snapshot.pets).sort(([a], [b]) => Number(a) - Number(b))))).digest('hex')) throw new Error('Game snapshot digest does not match');
  if (snapshot.source && Date.parse(snapshot.source.retrievedAt) !== Math.max(...Object.values(snapshot.pets).map(pool => Date.parse(pool.source.retrievedAt)))) throw new Error('Game snapshot time does not match its observations');
  return snapshot;
}
