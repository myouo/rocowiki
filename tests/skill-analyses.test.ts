// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSkillAnalyses, parseAnalysisDraft, officialAnalysisDigest } from '../scripts/updates/skill-analyses';
import { attachSkillAnalyses } from '../apps/web/src/wiki/catalog/skills/analysisModel';
import { buildOfficialSkillCatalog } from '../apps/web/src/wiki/catalog/skills/officialModel';
import type { OfficialPetSnapshot } from '../apps/web/src/wiki/catalog/pets/officialTypes';
import type { OfficialSkillSnapshot } from '../apps/web/src/wiki/catalog/skills/officialTypes';
import type { SkillAnalysisSnapshot } from '../apps/web/src/wiki/catalog/skills/analysisTypes';

const read = (name: string) => JSON.parse(readFileSync(`apps/web/content/${name}`, 'utf8'));
const draft = parseAnalysisDraft(read('skill-analysis-notes.json'));
const snapshot = read('skill-analyses.json') as SkillAnalysisSnapshot;
const pets = read('official-pets.json') as OfficialPetSnapshot;
const skills = read('official-skills.json') as OfficialSkillSnapshot;
const { validateSkillBranches } = createRequire(import.meta.url)('../apps/web/src/wiki/skillConditions.js');
const { skillRulePresentation } = createRequire(import.meta.url)('../apps/web/src/wiki/skillPresentation.js');

describe('source-backed skill analysis', () => {
  it('keeps every sample analysis attached to an official definition and preserves valid nested scopes', () => {
    expect(snapshot.records.map(row => row.skillId).sort((a, b) => a - b)).toEqual(draft.records.map(row => row.skillId).sort((a, b) => a - b));
    expect(snapshot.records).toHaveLength(15);
    expect(snapshot.unanalysed.map(row => row.skillId)).toEqual([35]);
    for (const row of snapshot.records) {
      expect(row.expectedOfficial).toMatchObject({ id: row.skillId, name: row.name });
      expect(row.source).toMatchObject({ petId: 3361, petName: '赑瑞玄龟', commit: draft.source.commit, field: 'cur_best_test' });
      expect(row.source.textSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(validateSkillBranches(row.phases).errors).toEqual({});
    }
    expect(JSON.stringify(snapshot)).not.toMatch(/<(?:p|span|script)[>\s]|created_by|"_id"/);
  });
  it('preserves the conditional formulas and shared parents that the upstream concise output can omit', () => {
    const yinyang = snapshot.records.find(row => row.skillId === 3806)!;
    const reset = yinyang.phases[0].children![0];
    expect(reset.when).toContain('威力伤害前');
    expect(reset.children!.map(row => row.when)).toEqual(['重置总等级 ≥ 1', '重置总等级 ≥ 3']);
    expect(reset.children![0].effect).toContain('ceil(重置总等级 / 2)');
    const jiegui = snapshot.records.find(row => row.skillId === 3808)!;
    expect(jiegui.phases.find(row => row.label === '后手')!.children!.map(row => row.label)).toEqual(['环境', '天气']);
    expect(jiegui.phases.some(row => ['环境', '天气'].includes(row.label))).toBe(false);
    const gantang = snapshot.records.find(row => row.skillId === 3805)!;
    expect(gantang.phases[0].when).toBe('本次技能命中');
    expect(gantang.phases[0].children!.find(row => row.label === '末回合')!.effect).toContain('6 回合');
    expect(gantang.phases[0].children!.find(row => row.label === '首回合')!.effect).toContain('至少连续发动 2 回合');
    expect(gantang.common.join(' ')).not.toContain('至少连续发动');
    expect(gantang.phases[0].otherwise).toContain('是否继续连续发动，来源未说明');
    expect(gantang.notes.join(' ')).toContain('两组效果都适用');
    const jishou = snapshot.records.find(row => row.skillId === 3807)!;
    expect(jishou.common.join(' ')).toContain('40% × 自身最大精力 + 50');
    expect(jishou.phases.find(row => row.label === '携带被动')!.children!.find(row => row.label === '阵亡追加伤害')!.effect).toContain('15% + 5%');
    expect(snapshot.records.find(row => row.skillId === 713)!.phases[0].effect).toContain('floor((70');
  });
  it('uses verified source metadata, rejects source drift and does not import HTML or account fields', () => {
    const source = { success: true, data: { skill_pet_id: 3361, name: '赑瑞玄龟', skill_list: [{ pet_id: 3361, info: {
      name: '钢贝壳', race: '水系', type_: '变化', cur_best_test: '<p>提高自身1级物防。</p>', author: ['公开署名'],
      source: 'javascript:alert(1)', created_by: 'private-account', test_time: null,
    } }] } };
    const bytes = Buffer.from(JSON.stringify(source));
    const sample = { ...draft, source: { ...draft.source, sha256: createHash('sha256').update(bytes).digest('hex'), officialDefinitionsSha256: officialAnalysisDigest([skills.skills.find(row => row.id === 332)!]) }, records: [draft.records[0]] };
    const built = buildSkillAnalyses(sample, bytes, pets, skills, '2026-10-13T00:00:00Z');
    expect(built.records[0].source).toMatchObject({ originalUrl: null, authors: ['公开署名'], reportedAt: null });
    expect(JSON.stringify(built)).not.toContain('private-account');
    expect(() => buildSkillAnalyses(sample, Buffer.concat([bytes, Buffer.from(' ')]), pets, skills, '2026-10-13T00:00:00Z')).toThrow('source changed');
    expect(() => buildSkillAnalyses({ ...sample, records: [...sample.records, ...sample.records] }, bytes, pets, skills, '2026-10-13T00:00:00Z')).toThrow('Duplicate');
    expect(() => buildSkillAnalyses(sample, bytes, pets, { ...skills, skills: skills.skills.map(row => row.id === 332 ? { ...row, pp: row.pp + 1 } : row) }, '2026-10-13T00:00:00Z')).toThrow('Official definitions changed');
  });
  it('withdraws old numeric rules after an official change while respecting independently published edits', () => {
    // Historical analyses are allowed to become stale as the live snapshot updates.
    const baseline = { ...skills, skills: snapshot.records.map(row => row.expectedOfficial) };
    const catalog = buildOfficialSkillCatalog(baseline, []);
    attachSkillAnalyses(catalog, snapshot);
    const skill = catalog.find(skill => skill.number === 3806)!;
    expect(skill.analysisCurrent).toBe(true);
    expect(skillRulePresentation(skill).branches[0].children[0].children).toHaveLength(2);
    const edited = { ...skill, publishedRules: true, common: ['独立复核的新规则'], phases: [] };
    expect(skillRulePresentation(edited)).toEqual({ base: edited.common, branches: [] });
    const changed = buildOfficialSkillCatalog({ ...baseline, skills: baseline.skills.map(row => row.id === 3806 ? { ...row, pp: row.pp + 1 } : row) }, []);
    attachSkillAnalyses(changed, snapshot);
    const stale = changed.find(skill => skill.number === 3806)!;
    expect(stale.analysisCurrent).toBe(false);
    expect(stale.phases).toEqual([]);
    expect(stale.pp).toBe(skill.pp! + 1);
  });
});
