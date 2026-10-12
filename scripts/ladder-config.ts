// SPDX-License-Identifier: GPL-3.0-only
import { createHash } from 'node:crypto';
import { SaxesParser } from 'saxes';
import type { OfficialLadderSnapshot } from '../apps/web/src/wiki/catalog/pets/ladderTypes';

export const LADDER_CONFIG_URL = 'https://res.17roco.qq.com/plugins/LadderMatch/LadderMatchConfig.xml';
export const MAX_LADDER_BYTES = 2 * 1024 * 1024;

function integer(value: string | undefined, label: string, minimum: number) {
  if (value === undefined || !/^\d+$/.test(value.trim())) throw new Error(`LadderMatchConfig: invalid ${label}`);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > 0xffffffff) throw new Error(`LadderMatchConfig: invalid ${label}`);
  return result;
}

export function ladderSnapshot(bytes: Buffer, retrievedAt: string): OfficialLadderSnapshot {
  if (!bytes.length || bytes.length > MAX_LADDER_BYTES) throw new Error('LadderMatchConfig: invalid XML size');
  if (!Number.isFinite(Date.parse(retrievedAt))) throw new Error('LadderMatchConfig: invalid retrieval timestamp');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const parser = new SaxesParser({ xmlns: false }), path: string[] = [];
  const costs: Record<string, number> = {}, banned = new Set<number>();
  let root = false, costSections = 0, banSections = 0, costEntryCount = 0, banEntryCount = 0, banText = '';
  parser.on('doctype', () => { throw new Error('LadderMatchConfig: XML DOCTYPE is unsupported'); });
  parser.on('opentag', tag => {
    path.push(tag.name);
    const current = path.join('/');
    if (path.length === 1) {
      if (tag.name !== 'LadderMatchConfig') throw new Error('LadderMatchConfig: root missing');
      root = true;
    }
    if (current === 'LadderMatchConfig/SpiritCost') costSections++;
    if (current === 'LadderMatchConfig/LimitSpirit') banSections++;
    if (current === 'LadderMatchConfig/SpiritCost/spirit') {
      const id = integer(tag.attributes.id, 'spirit ID', 1), cost = integer(tag.attributes.cost, 'cost', 0);
      if (Object.prototype.hasOwnProperty.call(costs, String(id)) && costs[String(id)] !== cost) throw new Error(`LadderMatchConfig: conflicting cost for ${id}`);
      costs[String(id)] = cost; costEntryCount++;
    }
    if (current === 'LadderMatchConfig/LimitSpirit/id') banText = '';
  });
  const appendBanText = (value: string) => { if (path.join('/') === 'LadderMatchConfig/LimitSpirit/id') banText += value; };
  parser.on('text', appendBanText); parser.on('cdata', appendBanText);
  parser.on('closetag', () => {
    if (path.join('/') === 'LadderMatchConfig/LimitSpirit/id') { banned.add(integer(banText, 'banned spirit ID', 1)); banEntryCount++; }
    path.pop();
  });
  parser.write(text).close();
  if (!root || costSections !== 1 || banSections !== 1) throw new Error('LadderMatchConfig: required or unique sections missing');
  return {
    schemaVersion: 1,
    source: { url: LADDER_CONFIG_URL, retrievedAt, sha256: createHash('sha256').update(bytes).digest('hex'), costEntryCount, banEntryCount },
    // The official client charges one point, then adds (configured cost - 1) for listed IDs.
    defaultCost: 1, costs, bannedPetIds: [...banned].sort((a, b) => a - b),
  };
}
