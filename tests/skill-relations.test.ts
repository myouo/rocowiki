// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSkillRelationSnapshot, parsePetSkillPool, readRelationBlobs } from '../scripts/updates/skill-relations';
import { attachSkillRelations } from '../apps/web/src/wiki/catalog/skills/relationModel';
import { buildOfficialSkillCatalog } from '../apps/web/src/wiki/catalog/skills/officialModel';
import { buildOfficialPetCatalog } from '../apps/web/src/wiki/catalog/pets/officialModel';
import type { OfficialPetSnapshot } from '../apps/web/src/wiki/catalog/pets/officialTypes';
import type { OfficialSkillSnapshot, OfficialSkillRecord } from '../apps/web/src/wiki/catalog/skills/officialTypes';
import type { SkillRelationSnapshot } from '../apps/web/src/wiki/catalog/skills/relationTypes';

const pets = JSON.parse(readFileSync('apps/web/content/official-pets.json', 'utf8')) as OfficialPetSnapshot;
const skills = JSON.parse(readFileSync('apps/web/content/official-skills.json', 'utf8')) as OfficialSkillSnapshot;
const relations = JSON.parse(readFileSync('apps/web/content/pet-skill-relations.json', 'utf8')) as SkillRelationSnapshot;
const pet = pets.pets.find(pet => pet.id === 137)!;
const skill: OfficialSkillRecord = { id: 1, name: '测试技能', type: '光', category: '物理', power: 40, pp: 10, speedCode: 8, description: '', description2: '', attackType: 2, damageType: 1 };
const entry = (info: Record<string, unknown> = { name: skill.name, race: '光系', type_: '物理' }) => ({ pet_id: pet.id, skill_id: 'community-database-key', rank: 40, from_stone: false, from_heredity: false, info });
const document = (rows: unknown[] = [entry()]) => ({ success: true, data: { skill_pet_id: pet.id, name: pet.name, skill_list: rows } });

describe('public skill-pool matching', () => {
  it('checks pet identity and uses official IDs without treating community keys or rank as game fields', () => {
    const pool = parsePetSkillPool(document(), pet, [skill]);
    expect(pool.skills).toEqual([{ skillId: 1, name: skill.name, learningMethod: '', learnLevel: null }]);
    expect(() => parsePetSkillPool({ ...document(), data: { ...document().data, skill_pet_id: 999 } }, pet, [skill])).toThrow();
    expect(() => parsePetSkillPool(document([{ ...entry(), pet_id: 999 }]), pet, [skill])).toThrow();
  });
  it('disambiguates identical names only with checked fields and leaves unresolved variants unlinked', () => {
    const variant = { ...skill, id: 2, power: 80 };
    expect(parsePetSkillPool(document(), pet, [skill, variant]).unresolved).toEqual([{ name: skill.name, reason: 'ambiguous' }]);
    expect(parsePetSkillPool(document([entry({ ...entry().info, power: '80' })]), pet, [skill, variant]).skills[0].skillId).toBe(2);
    expect(parsePetSkillPool(document([entry({ name: 'missing', race: '光系', type_: '物理' })]), pet, [skill]).unresolved[0].reason).toBe('not-found');
  });
  it('retains explicit learning methods and levels, but never infers upgrade learning', () => {
    expect(parsePetSkillPool(document([{ ...entry(), from_stone: true, from_heredity: true, learnLevel: 30 }]), pet, [skill]).skills[0]).toMatchObject({ learningMethod: '技能石 / 遗传', learnLevel: 30 });
  });
  it('preserves prior valid records when a source entry fails and refuses a wholly invalid update', () => {
    const subset = { ...pets, pets: [pet, pets.pets[0]] }, subsetSkills = { ...skills, skills: [skill] };
    const first = buildSkillRelationSnapshot([Buffer.from(JSON.stringify(document())), null], subset, subsetSkills, 'a'.repeat(40), '2026-10-12T00:00:00Z');
    const validSecond = { success: true, data: { skill_pet_id: subset.pets[1].id, name: subset.pets[1].name, skill_list: [] } };
    const second = buildSkillRelationSnapshot([Buffer.from('{broken'), Buffer.from(JSON.stringify(validSecond))], subset, subsetSkills, 'b'.repeat(40), '2026-10-13T00:00:00Z', first);
    expect(second.pets[String(pet.id)]).toMatchObject({ status: 'stale', skills: first.pets[String(pet.id)].skills, sourceCommit: first.source.commit });
    expect(() => buildSkillRelationSnapshot([null, null], subset, subsetSkills, 'b'.repeat(40), '2026-10-13T00:00:00Z', first)).toThrow('previous snapshot');
  });
  it('parses bounded git blobs, handles missing files and rejects trailing or truncated data', () => {
    const bytes = Buffer.from('a'.repeat(40) + ' blob 2\n{}\n' + 'b'.repeat(40) + ':pet/pet_info_2.json missing\n');
    expect(readRelationBlobs(bytes, [1, 2])).toEqual([Buffer.from('{}'), null]);
    expect(() => readRelationBlobs(bytes.subarray(0, -1), [1, 2])).toThrow();
    expect(() => readRelationBlobs(Buffer.concat([bytes, Buffer.from('extra')]), [1, 2])).toThrow();
  });
});

describe('bidirectional skill-pool projections', () => {
  const { petLearnsSkill, resolveSkillLearners } = createRequire(import.meta.url)('../apps/web/src/wiki/skillLearnerModel.js');
  it('joins every imported relation to its official skill and exposes known sample pools in both directions', () => {
    const catalogPets = buildOfficialPetCatalog(pets, [], {}), catalogSkills = buildOfficialSkillCatalog(skills, []);
    attachSkillRelations(catalogPets, catalogSkills, relations);
    const haifu = catalogPets.find(pet => pet.number === 3092)!;
    const xiazi = catalogSkills.find(skill => skill.number === 3044)!;
    expect(petLearnsSkill(haifu, xiazi)).toHaveLength(1);
    expect(resolveSkillLearners({ skill: xiazi, pets: catalogPets }).rows.some((row: { pet: { number: number } }) => row.pet.number === 3092)).toBe(true);
    const official = new Map(skills.skills.map(skill => [skill.id, skill.name]));
    for (const pool of Object.values(relations.pets)) for (const row of pool.skills) expect(official.get(row.skillId)).toBe(row.name);
    expect(catalogSkills.find(skill => skill.name === '猛烈撞击')!.ownerNames!.length).toBeGreaterThan(100);
  });
  it('does not associate same-name skills with different IDs or discard independently known learning details', () => {
    expect(petLearnsSkill({ skills: [{ skillId: 1, name: '同名' }] }, { number: 2, name: '同名' })).toEqual([]);
    const catalogPets = buildOfficialPetCatalog({ ...pets, pets: [pet] }, [], {}), catalogSkills = buildOfficialSkillCatalog({ ...skills, skills: [skill] }, []);
    catalogPets[0].skills = [{ name: skill.name, skillId: 1, learnLevel: 50, learningMethod: '独立实测', sourceUrl: 'https://example.test/verified' }];
    const snapshot = { ...relations, pets: { [pet.id]: parsePetSkillPool(document(), pet, [skill]) } };
    attachSkillRelations(catalogPets, catalogSkills, snapshot);
    expect(catalogPets[0].skills[0]).toMatchObject({ skillId: 1, learnLevel: 50, learningMethod: '独立实测', sourceUrl: 'https://example.test/verified' });
  });
});
