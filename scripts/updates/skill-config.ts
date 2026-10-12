// SPDX-License-Identifier: GPL-3.0-only
import { createHash } from 'node:crypto';
import { ANGEL_CONFIG_URL, decodeAngelConfig, visitXml } from './angel-config';
import type { OfficialSkillRecord, OfficialSkillSnapshot } from '../../apps/web/src/wiki/catalog/skills/officialTypes';

function integer(value: string | undefined, label: string, minimum = 0) {
  if (value === undefined || !/^\d+$/.test(value.trim())) throw new Error(`SpiritSkillConfig: invalid ${label}`);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > 0xffffffff) throw new Error(`SpiritSkillConfig: invalid ${label}`);
  return result;
}

export function parseOfficialSkills(xml: string, spiritXml: string) {
  const properties = new Map<number, string>();
  let petConfigVersion = '', configVersion = '', definitionCount = 0, excludedCount = 0;
  visitXml(spiritXml, (tag, row, depth) => {
    if (depth === 0) {
      if (tag !== 'SpiritConfig' || row.name !== 'spirit_conf') throw new Error('SpiritSkillConfig: pet attributes root missing');
      petConfigVersion = row.version || '';
    }
    if (depth === 1 && tag === 'PropertyDes') {
      const id = integer(row.id, 'attribute ID', 1);
      if (!row.name?.trim() || properties.has(id)) throw new Error('SpiritSkillConfig: invalid attribute');
      properties.set(id, row.name.trim());
    }
  });
  const records = new Map<number, OfficialSkillRecord>(), definitions = new Map<number, Record<string, string>>();
  const duplicateIds = new Set<number>(), overriddenFields = new Map<number, Set<string>>();
  visitXml(xml, (tag, row, depth) => {
    if (depth === 0) {
      if (tag !== 'SpiritSkillConfig' || row.name !== 'spiritSkill_conf') throw new Error('SpiritSkillConfig: root missing');
      configVersion = row.version || '';
    }
    if (depth !== 1 || tag !== 'SpiritSkillDes') return;
    definitionCount++;
    // Buff/effect and capture-ball records share this element name; they have no attackType.
    if (row.attackType === undefined) { excludedCount++; return; }
    const id = integer(row.id, 'skill ID', 1), damageType = integer(row.damageType, 'damage type', 1);
    const type = properties.get(integer(row.property, 'attribute ID', 1));
    const category = ({ 1: '物理', 2: '魔法', 3: '变化' } as const)[damageType as 1 | 2 | 3];
    if (!type || !category || !row.name?.trim()) throw new Error(`SpiritSkillConfig: incomplete skill ${id}`);
    const previous = definitions.get(id);
    if (previous) {
      duplicateIds.add(id);
      const fields = overriddenFields.get(id) || new Set<string>();
      for (const key of new Set([...Object.keys(previous), ...Object.keys(row)])) if (previous[key] !== row[key]) fields.add(key);
      if (fields.size) overriddenFields.set(id, fields);
    }
    // SpiritSkillDesProxy writes db[id] in source order: the last definition is effective.
    definitions.set(id, row);
    records.set(id, {
      id, name: row.name.trim(), type, category,
      power: row.power === '--' ? null : integer(row.power, 'power'),
      pp: integer(row.ppMax, 'PP'), speedCode: integer(row.speed, 'speed code'),
      attackType: integer(row.attackType, 'attack type'), damageType,
      description: row.description?.trim() || '', description2: row.description2?.trim() || '',
    });
  });
  if (!petConfigVersion || !configVersion || !records.size || !properties.size) throw new Error('SpiritSkillConfig: incomplete configuration');
  return {
    skills: [...records.values()].sort((a, b) => a.id - b.id),
    configVersion, petConfigVersion, definitionCount, excludedCount,
    duplicateIds: [...duplicateIds].sort((a, b) => a - b),
    overriddenFields: [...overriddenFields].sort(([a], [b]) => a - b).map(([id, fields]) => ({ id, fields: [...fields].sort() })),
  };
}

export function officialSkillSnapshot(bytes: Buffer, retrievedAt: string): OfficialSkillSnapshot {
  if (!Number.isFinite(Date.parse(retrievedAt))) throw new Error('SpiritSkillConfig: invalid retrieval timestamp');
  const resources = decodeAngelConfig(bytes), skillsXml = resources.get('spiritSkill_conf'), spiritXml = resources.get('spirit_conf');
  if (!skillsXml || !spiritXml) throw new Error('Angel.config: skill or pet resource missing');
  const { skills, ...details } = parseOfficialSkills(skillsXml, spiritXml);
  return { schemaVersion: 1, source: { url: ANGEL_CONFIG_URL, retrievedAt, sha256: createHash('sha256').update(bytes).digest('hex'), objectCount: resources.size, ...details }, skills };
}
