// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseOfficialSkills } from '../scripts/updates/skill-config';
import { buildOfficialSkillCatalog, skillCatalogHref, skillCollection } from '../apps/web/src/wiki/catalog/skills/officialModel';
import type { OfficialSkillSnapshot } from '../apps/web/src/wiki/catalog/skills/officialTypes';
import { petSkillPoolHref } from '../apps/web/src/wiki/catalog/pets/officialModel';

const spirit = '<SpiritConfig name="spirit_conf" version="P1"><PropertyDes id="1" name="普通"/><PropertyDes id="3" name="水"/></SpiritConfig>';
const row = (id = 87, name = '拍打', power = '40', damageType = 1) => `<SpiritSkillDes id="${id}" name="${name}" attackType="2" damageType="${damageType}" power="${power}" ppMax="35" property="1" speed="8" description="给对手造成伤害。"/>`;
const xml = (rows: string) => `<SpiritSkillConfig name="spiritSkill_conf" version="S1"><PropertyDes id="1" name="睡眠"/>${rows}</SpiritSkillConfig>`;
const data = JSON.parse(readFileSync('apps/web/content/official-skills.json', 'utf8')) as OfficialSkillSnapshot;

describe('official skill configuration', () => {
  it('uses pet element definitions and damageType, excluding buff and ball records', () => {
    const parsed = parseOfficialSkills(xml(row() + row(88, '水技', '--', 3).replace('property="1"', 'property="3"') + '<SpiritSkillDes id="10001" name="睡眠" property="1"/><SpiritSkillDes id="20001" name="捕捉球" catchRate="100"/>'), spirit);
    expect(parsed.skills).toMatchObject([{ id: 87, type: '普通', category: '物理', power: 40, pp: 35, speedCode: 8 }, { id: 88, type: '水', category: '变化', power: null }]);
    expect(parsed.excludedCount).toBe(2);
  });
  it('retains the effective last definition and audits duplicate overrides like the official client', () => {
    const parsed = parseOfficialSkills(xml(row(188, '光刺炮', '25') + row(188, '光刺炮', '60') + row(188, '光刺炮', '60')), spirit);
    expect(parsed.skills).toHaveLength(1); expect(parsed.skills[0].power).toBe(60);
    expect(parsed.duplicateIds).toEqual([188]); expect(parsed.overriddenFields).toEqual([{ id: 188, fields: ['power'] }]);
  });
  it('rejects malformed roots, unsupported fields and XML entities without publishing defaults', () => {
    for (const value of [xml(row()).slice(0, -1), '<html/>', '<!DOCTYPE x SYSTEM "https://example.test">' + xml(row()), xml(row().replace('ppMax="35"', 'ppMax="bad"')), xml(row().replace('property="1"', 'property="999"')), xml(row().replace('damageType="1"', 'damageType="9"'))]) expect(() => parseOfficialSkills(value, spirit)).toThrow();
  });
  it('has unique IDs in the committed snapshot with current source-order overrides', () => {
    expect(new Set(data.skills.map(skill => skill.id)).size).toBe(data.skills.length);
    expect(data.skills.find(skill => skill.id === 188)?.power).toBe(60);
    expect(data.skills.find(skill => skill.id === 3044)).toMatchObject({ name: '霞姿月韵', category: '变化', pp: 6, speedCode: 15 });
    expect(data.skills.every(skill => skill.id < 10000)).toBe(true);
  });
});

describe('official skill catalogue identities', () => {
  it('preserves historical URLs and interpretations while using current official basic fields', () => {
    const snapshot = { ...data, skills: data.skills.filter(skill => skill.id === 3044 || skill.id === 87) };
    const catalog = buildOfficialSkillCatalog(snapshot, [{ slug: 'xiazi', name: '霞姿月韵', pp: 99, priority: 7, common: ['独立解析'], source: 'https://example.test/guide' }]);
    expect(catalog.find(skill => skill.slug === 'xiazi')).toMatchObject({ number: 3044, pp: 6, priority: 7, common: ['独立解析'], curatedSource: 'https://example.test/guide' });
    expect(skillCatalogHref(catalog.find(skill => skill.slug === 'xiazi')!)).toBe('/skills/xiazi/');
    expect(skillCatalogHref(catalog.find(skill => skill.number === 87)!)).toBe('/skills/?entry=official-skill-87');
    expect(catalog.find(skill => skill.number === 87)?.priority).toBeNull();
  });
  it('keeps same-name variants separate and preserves unmatched historical entries', () => {
    const first = data.skills[0];
    const snapshot = { ...data, skills: [{ ...first, id: 1, name: '同名' }, { ...first, id: 2, name: '同名' }] };
    const catalog = buildOfficialSkillCatalog(snapshot, [{ slug: 'historical', name: '同名' }]);
    expect(catalog.map(skill => skill.slug)).toEqual(['official-skill-1', 'official-skill-2', 'historical']);
    expect(catalog.map(skill => skill.name)).toEqual(['同名', '同名', '同名']);
  });
  it('links dynamic pet entries to a query-selected section and existing pages to a static anchor', () => {
    expect(petSkillPoolHref({ slug: 'official-3263', catalogEntry: true })).toBe('/pets/?entry=official-3263&section=skills');
    expect(petSkillPoolHref({ slug: 'haifu' })).toBe('/pets/haifu/#skills');
  });
  it('keeps alphabetic placeholders accessible without putting them first in the normal skill list', () => {
    const catalog = buildOfficialSkillCatalog(data, []);
    expect(catalog.filter(skill => skillCollection(skill) === 'placeholder')).toHaveLength(13);
    expect(skillCollection({ name: 'WX2', official: { description: '空' } })).toBe('placeholder');
    expect(skillCollection({ name: 'HP', official: { description: '明确的技能说明' } })).toBe('regular');
    expect(skillCollection({ name: 'HP' })).toBe('regular');
  });
});
