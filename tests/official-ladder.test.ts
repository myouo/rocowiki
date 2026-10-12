// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { ladderSnapshot } from '../scripts/ladder-config';
import { officialLadderCost, petMetadataWithOfficialLadder } from '../apps/web/src/wiki/catalog/pets/ladderModel';
import LadderCostBadge, { ladderCostDescription } from '../apps/web/src/wiki/catalog/pets/LadderCostBadge';
import { buildOfficialPetCatalog } from '../apps/web/src/wiki/catalog/pets/officialModel';
import type { OfficialLadderSnapshot } from '../apps/web/src/wiki/catalog/pets/ladderTypes';
import type { OfficialPetSnapshot } from '../apps/web/src/wiki/catalog/pets/officialTypes';
import { sameOfficialPetSnapshot } from '../scripts/official-pet-snapshot';

const capture = '2026-10-12T00:00:00Z';
const xml = (costs = '<spirit id="3092" cost="5"/><spirit id="3362" cost="4"/>', bans = '<id>3362</id>') => `<LadderMatchConfig><SpiritCost>${costs}</SpiritCost><LimitSpirit>${bans}</LimitSpirit></LadderMatchConfig>`;
const parse = (value: string) => ladderSnapshot(Buffer.from(value), capture);

describe('official ladder XML', () => {
  it('parses explicit costs and independent banned IDs with whitespace or CDATA', () => {
    const data = parse(xml(undefined, '<id> 3362 </id><id><![CDATA[3092]]></id><id>3362</id>'));
    expect(data.costs).toEqual({ '3092': 5, '3362': 4 });
    expect(data.bannedPetIds).toEqual([3092, 3362]);
    expect(data.source).toMatchObject({ costEntryCount: 2, banEntryCount: 3, retrievedAt: capture });
  });
  it('only reads direct configuration fields and rejects malformed or ambiguous data', () => {
    const valid = parse(xml('<spirit id="3092" cost="5"/>') .replace('</LadderMatchConfig>', '<Quest><spirit id="137" cost="9"/></Quest></LadderMatchConfig>'));
    expect(valid.costs).toEqual({ '3092': 5 });
    for (const value of ['<html/>', '<LadderMatchConfig/>', xml().slice(0, -1), '<!DOCTYPE x SYSTEM "https://example.test/entity">' + xml(), xml('<spirit id="3092"/>'), xml('<spirit id="x" cost="5"/>'), xml('<spirit id="3092" cost="-1"/>'), xml('<spirit id="3092" cost="2.5"/>'), xml(undefined, '<id>bad</id>'), xml().replace('</LadderMatchConfig>', '<SpiritCost/></LadderMatchConfig>')]) expect(() => parse(value)).toThrow();
    expect(() => parse(xml('<spirit id="3092" cost="5"/><spirit id="3092" cost="4"/>'))).toThrow('conflicting');
  });
  it('supports explicit zero, identical duplicates and intentionally empty but present sections', () => {
    expect(parse(xml('<spirit id="137" cost="0"/><spirit id="137" cost="0"/>', '')).costs).toEqual({ '137': 0 });
    expect(parse(xml('', '')).defaultCost).toBe(1);
  });
  it('does not churn a snapshot when only retrieval time changes', () => {
    const data = parse(xml());
    expect(sameOfficialPetSnapshot(data, { ...data, source: { ...data.source, retrievedAt: '2026-10-13T00:00:00Z' } })).toBe(true);
    expect(sameOfficialPetSnapshot(data, { ...data, costs: { ...data.costs, '3092': 4 } })).toBe(false);
  });
});

describe('ladder cost projections and reader labels', () => {
  const data = parse(xml());
  it('uses exact IDs, defaults unlisted IDs to one, and retains a banned pet fee', () => {
    expect(officialLadderCost(data, 3092)).toMatchObject({ value: 5, listed: true, banned: false });
    expect(officialLadderCost(data, 3362)).toMatchObject({ value: 4, listed: true, banned: true });
    expect(officialLadderCost(data, 137)).toMatchObject({ value: 1, listed: false, banned: false });
    expect(officialLadderCost(data, 13092).value).toBe(1);
  });
  it('gives every committed pet a current fee instead of an old or unknown history value', () => {
    const pets = JSON.parse(readFileSync('apps/web/content/official-pets.json', 'utf8')) as OfficialPetSnapshot;
    const ladder = JSON.parse(readFileSync('apps/web/content/official-ladder.json', 'utf8')) as OfficialLadderSnapshot;
    const existing = JSON.parse(readFileSync('apps/web/content/pet-sources.json', 'utf8'));
    const catalog = buildOfficialPetCatalog(pets, existing, { haifu: { ladderMagic: { value: 99, effectiveFrom: '2020-01-01' } } }, ladder);
    expect(catalog.every(pet => Number.isFinite(pet.officialLadder?.value))).toBe(true);
    expect(catalog.find(pet => pet.number === 3092)?.metadata?.ladderMagic).toMatchObject({ value: ladder.costs['3092'], status: 'official-config' });
    expect(catalog.find(pet => pet.number === 137)?.officialLadder).toMatchObject({ value: 1, listed: false });
    for (const id of ladder.bannedPetIds) expect(catalog.find(pet => pet.number === id)?.officialLadder?.banned).toBe(true);
    for (const id of Object.keys(ladder.costs)) expect(catalog.some(pet => pet.number === Number(id))).toBe(true);
  });
  it('keeps historical or local overrides from replacing current official costs used by filters and sorting', () => {
    const current = officialLadderCost(data, 3362);
    const metadata = petMetadataWithOfficialLadder({ group: '精灵组', ladderMagic: { value: 99, effectiveFrom: '2020-01-01' } }, current);
    expect(metadata).toMatchObject({ group: '精灵组', ladderMagic: { value: 4, banned: true, status: 'official-config' } });
  });
  it('labels source capture time, default rules and bans without inventing an effective date or zero fee', () => {
    const banned = officialLadderCost(data, 3362);
    const description = ladderCostDescription('塞勒姆', banned);
    expect(description).toContain('4 魔力'); expect(description).toContain('禁赛'); expect(description).toContain('采集于'); expect(description).not.toContain('生效日');
    expect(ladderCostDescription('迪莫', officialLadderCost(data, 137))).toContain('默认 1 费');
    const html = renderToString(createElement(LadderCostBadge, { name: '塞勒姆', magic: banned }));
    expect(html).toContain('is-banned'); expect(html).toContain('>4<'); expect(html).toContain('禁');
    const zero = officialLadderCost(parse(xml('<spirit id="137" cost="0"/>', '')), 137);
    expect(renderToString(createElement(LadderCostBadge, { name: '零费样本', magic: zero }))).toContain('>0<');
  });
});
