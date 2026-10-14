// SPDX-License-Identifier: GPL-3.0-only
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { OfficialPetSnapshot } from '../../apps/web/src/wiki/catalog/pets/officialTypes';
import type { OfficialSkillSnapshot, OfficialSkillRecord } from '../../apps/web/src/wiki/catalog/skills/officialTypes';
import type { SkillAnalysisBranch, SkillAnalysisDraft, SkillAnalysisSnapshot } from '../../apps/web/src/wiki/catalog/skills/analysisTypes';
import { parsePetSkillPool } from './skill-relations';

const text = z.string().trim().min(1).max(4000);
const branch: z.ZodType<SkillAnalysisBranch> = z.lazy(() => z.object({ label: text, when: text, effect: z.string().trim().max(4000), otherwise: text.optional(), children: z.array(branch).max(20).optional(), presentation: z.enum(['scope', 'action']).optional() }).strict().refine(row => Boolean(row.effect || row.children?.length), 'A branch needs effects or real child conditions').refine(row => row.presentation !== 'scope' || !row.otherwise, 'Scope presentation cannot hide an alternate result'));
const draftSchema = z.object({ schemaVersion: z.literal(1), source: z.object({
  repository: z.literal('https://gitcode.com/rocoai-dev/roco-desc'), commit: z.string().regex(/^[a-f0-9]{40}$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  officialDefinitionsSha256: z.string().regex(/^[a-f0-9]{64}$/),
  petId: z.number().int().positive(), petName: text,
}).strict(), records: z.array(z.object({ skillId: z.number().int().positive(), name: text, hitRule: text.nullable(),
  common: z.array(text).max(30), phases: z.array(branch).max(30), notes: z.array(text).max(30),
  terms: z.array(z.object({ name: text, description: text }).strict()).max(20).optional(),
}).strict()).min(1).max(1000) }).strict();
export const parseAnalysisDraft = (value: unknown): SkillAnalysisDraft => draftSchema.parse(value);
const digest = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
export const officialAnalysisDigest = (records: readonly OfficialSkillRecord[]) => digest(JSON.stringify([...records].sort((a, b) => a.id - b.id).map(record => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b))))));

export function buildSkillAnalyses(draft: SkillAnalysisDraft, bytes: Buffer, pets: OfficialPetSnapshot, skills: OfficialSkillSnapshot, retrievedAt: string): SkillAnalysisSnapshot {
  if (bytes.length > 2 * 1024 * 1024 || !Number.isFinite(Date.parse(retrievedAt))) throw new Error('Invalid analysis source size or date');
  if (digest(bytes) !== draft.source.sha256) throw new Error('Analysis source changed; review notes against the new source before regenerating');
  const pet = pets.pets.find(pet => pet.id === draft.source.petId && pet.name === draft.source.petName);
  if (!pet) throw new Error('Analysis pet identity does not match official data');
  const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const pool = parsePetSkillPool(raw, pet, skills.skills);
  const seen = new Set<number>();
  const records = draft.records.map(record => {
    if (seen.has(record.skillId)) throw new Error('Duplicate analysis skill ID');
    seen.add(record.skillId);
    const official = skills.skills.find(skill => skill.id === record.skillId && skill.name === record.name);
    if (!official || !pool.skills.some(skill => skill.skillId === record.skillId)) throw new Error(`Unmatched official skill: ${record.name}`);
    const candidates = raw.data.skill_list.filter((row: { info?: { name?: string; race?: string; type_?: string } }) => row.info?.name === record.name && row.info.race?.replace(/系$/, '') === official.type && row.info.type_ === official.category);
    if (candidates.length !== 1) throw new Error(`Ambiguous source description: ${record.name}`);
    const info = candidates[0].info;
    if (typeof info.cur_best_test !== 'string' || !info.cur_best_test.trim()) throw new Error(`No detailed source analysis: ${record.name}`);
    if (!record.common.length && !record.phases.length) throw new Error(`Empty analysis: ${record.name}`);
    let originalUrl: string | null = null;
    try { const url = new URL(info.source); if (['http:', 'https:'].includes(url.protocol)) originalUrl = url.href; } catch { /* Optional attribution URL. */ }
    const reportedAt = typeof info.test_time === 'number' && Number.isFinite(info.test_time) && info.test_time >= 0 && info.test_time <= 8.64e15 ? new Date(info.test_time).toISOString() : null;
    return { ...record, expectedOfficial: official, source: {
      url: `https://api.gitcode.com/api/v5/repos/rocoai-dev/roco-desc/raw/pet%2Fpet_info_${pet.id}.json?ref=${draft.source.commit}`,
      commit: draft.source.commit, petId: pet.id, petName: pet.name, field: 'cur_best_test' as const,
      textSha256: digest(info.cur_best_test), authors: Array.isArray(info.author) ? info.author.filter((author: unknown): author is string => typeof author === 'string' && author.trim().length > 0 && author.length <= 200) : [],
      reportedAt, originalUrl,
    } };
  });
  if (officialAnalysisDigest(records.map(record => record.expectedOfficial)) !== draft.source.officialDefinitionsSha256) throw new Error('Official definitions changed; review analysis notes before rebinding their baseline');
  return { schemaVersion: 1, source: { ...draft.source, url: `${draft.source.repository}/tree/${draft.source.commit}/pet/pet_info_${pet.id}.json`, retrievedAt, sha256: digest(bytes) }, records,
    unanalysed: pool.skills.filter(skill => !seen.has(skill.skillId)).map(skill => ({ skillId: skill.skillId, name: skill.name, reason: '本次未整理详细解析；继续显示官方描述。' })),
  };
}
