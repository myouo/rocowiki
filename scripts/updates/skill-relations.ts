// SPDX-License-Identifier: GPL-3.0-only
import { createHash } from 'node:crypto';
import type { OfficialPetSnapshot, OfficialPetRecord } from '../../apps/web/src/wiki/catalog/pets/officialTypes';
import type { OfficialSkillSnapshot, OfficialSkillRecord } from '../../apps/web/src/wiki/catalog/skills/officialTypes';
import type { PetSkillPool, SkillRelationSnapshot } from '../../apps/web/src/wiki/catalog/skills/relationTypes';

export const SKILL_RELATION_REPO = 'https://gitcode.com/rocoai-dev/roco-desc.git';
export const SKILL_RELATION_URL = 'https://gitcode.com/rocoai-dev/roco-desc';
export const SKILL_RELATION_RESOLVER_VERSION = 2;
export const MAX_RELATION_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_RELATION_TOTAL_BYTES = 128 * 1024 * 1024;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export function parsePetSkillPool(value: unknown, pet: OfficialPetRecord, skills: readonly OfficialSkillRecord[], indexedNames?: Map<string, OfficialSkillRecord[]>): PetSkillPool {
  if (!object(value) || value.success !== true || !object(value.data)) throw new Error('Invalid public pet record');
  const data = value.data;
  if (data.errCode !== undefined || data.skill_pet_id !== pet.id || data.name !== pet.name || !Array.isArray(data.skill_list)) throw new Error('Pet identity or skill list does not match');
  const result: PetSkillPool = { petId: pet.id, petName: pet.name, status: 'available', skills: [], unresolved: [] };
  const names = indexedNames || new Map<string, OfficialSkillRecord[]>();
  if (!indexedNames) for (const skill of skills) names.set(skill.name, [...(names.get(skill.name) || []), skill]);
  for (const entry of data.skill_list) {
    if (!object(entry) || !object(entry.info) || typeof entry.info.name !== 'string' || !entry.info.name.trim()) throw new Error('Invalid skill-pool entry');
    if (entry.pet_id != null && entry.pet_id !== pet.id) throw new Error('Skill-pool entry belongs to another pet');
    const info = entry.info, name = (info.name as string).trim();
    let candidates = names.get(name) || [];
    let reason: PetSkillPool['unresolved'][number]['reason'] = candidates.length ? 'conflicting-parameters' : 'not-found';
    if (typeof info.race === 'string' && info.race.trim()) candidates = candidates.filter(skill => skill.type === (info.race as string).trim().replace(/系$/, ''));
    if (typeof info.type_ === 'string' && info.type_.trim()) candidates = candidates.filter(skill => skill.category === (info.type_ as string).trim());
    if (candidates.length > 1) {
      reason = 'ambiguous';
      const matches = candidates.filter(skill =>
        (info.pp == null || Number(info.pp) === skill.pp) &&
        (info.speed == null || Number(info.speed) === skill.speedCode) &&
        (info.power == null || (info.power === '--' ? skill.power === null : Number(info.power) === skill.power)));
      if (matches.length) candidates = matches;
    }
    if (candidates.length !== 1) { result.unresolved.push({ name, reason: candidates.length > 1 ? 'ambiguous' : reason }); continue; }
    // Community skill_id values are database keys, not official game IDs. Never use them as IDs.
    const official = candidates[0];
    // rank is the source's learning level; zero means initial and -1 is unspecified.
    const levelValue = entry.rank ?? entry.learnLevel ?? entry.learn_level ?? entry.learningLevel;
    const learnLevel = typeof levelValue === 'number' && Number.isInteger(levelValue) && levelValue >= 0 && levelValue <= 100 ? levelValue : null;
    const methods = [entry.from_stone === true ? '技能石' : '', entry.from_heredity === true ? '遗传' : ''].filter(Boolean);
    const learningMethod = methods.length ? methods.join(' / ') : learnLevel === 0 ? '初始' : learnLevel !== null ? '升级' : '';
    const previous = result.skills.find(row => row.skillId === official.id);
    if (!previous) result.skills.push({ skillId: official.id, name: official.name, learningMethod, learnLevel });
    else {
      previous.learningMethod = [...new Set([...previous.learningMethod.split(' / '), ...learningMethod.split(' / ')].filter(Boolean))].join(' / ');
      if (previous.learnLevel !== learnLevel) previous.learnLevel = null;
    }
  }
  result.skills.sort((a, b) => a.skillId - b.skillId);
  return result;
}

/** Parse git cat-file's length-delimited blobs, never checking out or executing source files. */
export function readRelationBlobs(bytes: Buffer, ids: readonly number[]): (Buffer | null)[] {
  if (bytes.length > MAX_RELATION_TOTAL_BYTES) throw new Error('Public relation data exceeds size limit');
  const blobs: (Buffer | null)[] = [];
  let offset = 0;
  for (const id of ids) {
    const end = bytes.indexOf(10, offset);
    if (end < 0) throw new Error('Truncated relation blob header');
    const header = bytes.subarray(offset, end).toString('utf8'); offset = end + 1;
    if (header.endsWith(`:pet/pet_info_${id}.json missing`)) { blobs.push(null); continue; }
    const match = /^([a-f0-9]{40}) blob (\d+)$/.exec(header);
    const size = match ? Number(match[2]) : NaN;
    if (!Number.isSafeInteger(size) || size > MAX_RELATION_FILE_BYTES || offset + size >= bytes.length || bytes[offset + size] !== 10) throw new Error('Invalid relation blob size or type');
    blobs.push(bytes.subarray(offset, offset + size)); offset += size + 1;
  }
  if (offset !== bytes.length) throw new Error('Unexpected relation blob data');
  return blobs;
}

export function buildSkillRelationSnapshot(blobs: readonly (Buffer | null)[], pets: OfficialPetSnapshot, skills: OfficialSkillSnapshot, commit: string, retrievedAt: string, previous?: SkillRelationSnapshot): SkillRelationSnapshot {
  if (!/^[a-f0-9]{40}$/.test(commit) || !Number.isFinite(Date.parse(retrievedAt)) || blobs.length !== pets.pets.length) throw new Error('Invalid relation snapshot source');
  const records: Record<string, PetSkillPool> = {}, hash = createHash('sha256');
  const knownSkills = new Set(skills.skills.map(skill => skill.id));
  const names = new Map<string, OfficialSkillRecord[]>();
  for (const skill of skills.skills) names.set(skill.name, [...(names.get(skill.name) || []), skill]);
  let relationCount = 0, unavailableCount = 0, unresolvedCount = 0, availableCount = 0;
  for (let index = 0; index < pets.pets.length; index++) {
    const pet = pets.pets[index], bytes = blobs[index];
    hash.update(String(pet.id) + '\0').update(bytes || 'missing').update('\0');
    let record: PetSkillPool;
    try {
      if (!bytes) record = { petId: pet.id, petName: pet.name, status: 'missing', skills: [], unresolved: [] };
      else {
        if (bytes.length > MAX_RELATION_FILE_BYTES) throw new Error('Oversized pet record');
        record = parsePetSkillPool(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), pet, skills.skills, names);
        availableCount++;
      }
    } catch { record = { petId: pet.id, petName: pet.name, status: 'invalid', skills: [], unresolved: [] }; }
    if (record.status !== 'available') {
      unavailableCount++;
      const old = previous?.pets[String(pet.id)];
      if (old?.petName === pet.name && old.skills.length) record = { ...old, status: 'stale', skills: old.skills.filter(skill => knownSkills.has(skill.skillId)), sourceCommit: old.sourceCommit || previous!.source.commit, recordedAt: old.recordedAt || previous!.source.retrievedAt };
    }
    relationCount += record.skills.length; unresolvedCount += record.unresolved.length;
    records[String(pet.id)] = record;
  }
  if (!availableCount) throw new Error('No valid public skill-pool records; previous snapshot left untouched');
  return { schemaVersion: 1, source: { url: SKILL_RELATION_URL, commit, resolverVersion: SKILL_RELATION_RESOLVER_VERSION, retrievedAt, sha256: hash.digest('hex'), officialPetSha256: pets.source.sha256, officialSkillSha256: skills.source.sha256, petCount: pets.pets.length, relationCount, unavailableCount, unresolvedCount }, pets: records };
}
