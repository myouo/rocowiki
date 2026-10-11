// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { decodeAngelConfig, officialPetSnapshot, parseOfficialPets } from '../scripts/angel-config';
import { buildOfficialPetCatalog, petCatalogHref } from '../apps/web/src/wiki/catalog/pets/officialModel';
import type { OfficialPetSnapshot } from '../apps/web/src/wiki/catalog/pets/officialTypes';
import { useHydratedSearch } from '../apps/web/src/wiki/catalog/pets/useHydratedSearch';

function u29(value: number): Buffer {
  if (value < 0x80) return Buffer.from([value]);
  if (value < 0x4000) return Buffer.from([(value >> 7) | 0x80, value & 0x7f]);
  if (value < 0x200000) return Buffer.from([(value >> 14) | 0x80, ((value >> 7) & 0x7f) | 0x80, value & 0x7f]);
  return Buffer.from([(value >> 22) | 0x80, ((value >> 15) & 0x7f) | 0x80, ((value >> 8) & 0x7f) | 0x80, value & 0xff]);
}

function pack(xmls: string[]): Buffer {
  const body = deflateSync(Buffer.concat(xmls.map(xml => {
    const bytes = Buffer.from(xml);
    return Buffer.concat([Buffer.from([0x0b]), u29(bytes.length * 2 + 1), bytes]);
  })));
  const header = Buffer.alloc(7);
  header.writeUInt32BE(body.length, 1); header.writeUInt16BE(xmls.length, 5);
  return Buffer.concat([header, body]);
}

const pet = (id = 1, book = '0', name = '样本宠物') => `<SpiritDes id="${id}" name="${name}" isInBook="${book}" features="5,3" group="29" sm="45" wg="49" fy="49" mg="65" mk="65" sd="45" iconSrc="001-.png" height="0.7m" weight="6.9kg" expType="105" catchrate="250" description="喜欢 &amp; 阳光" getForm="历史活动"/>`;
const config = (rows: string) => `<SpiritConfig name="spirit_conf" version="B6041">${rows}<PropertyDes id="5" name="草"/><PropertyDes id="3" name="水"/><groupTypeDes id="29" name="精灵组"/></SpiritConfig>`;

describe('official Angel.config decoding', () => {
  it.each([10, 100, 10_000, 1_100_000])('reads AMF3 XML UTF-8 byte lengths across U29 sizes (%i)', length => {
    const xml = `<Data name="sample">${'草'.repeat(length)}</Data>`;
    expect(decodeAngelConfig(pack([xml])).get('sample')).toBe(xml);
  });
  it('rejects corrupt lengths, unsupported markers, object counts and trailing input', () => {
    const bytes = pack([config(pet())]);
    expect(() => decodeAngelConfig(bytes.subarray(0, 6))).toThrow('size');
    expect(() => decodeAngelConfig(bytes.subarray(0, -1))).toThrow('length mismatch');
    const count = Buffer.from(bytes); count.writeUInt16BE(2, 5);
    expect(() => decodeAngelConfig(count)).toThrow('truncated');
    const flag = Buffer.from(bytes); flag[0] = 1;
    expect(() => decodeAngelConfig(flag)).toThrow('flag');
    const wrong = Buffer.from(bytes); wrong.writeUInt16BE(0, 5);
    expect(() => decodeAngelConfig(wrong)).toThrow('count');
    const trailing = Buffer.concat([bytes, Buffer.from([0])]); trailing.writeUInt32BE(trailing.length - 7, 1);
    expect(() => decodeAngelConfig(trailing)).toThrow('trailing compressed');
    expect(() => decodeAngelConfig(pack(['<!DOCTYPE X SYSTEM "https://example.test/entity"><Data name="sample"/>']))).toThrow('DOCTYPE');
    expect(() => decodeAngelConfig(pack(['<Data name="sample">']))).toThrow();
    expect(() => decodeAngelConfig(pack(['<Data name="sample"/>', '<Data name="sample"/>']))).toThrow('duplicate');
  });
  it('resolves dictionaries regardless of order, excludes non-book Bosses and retains high book IDs', () => {
    const { pets, excludedCount } = parseOfficialPets(config(pet() + pet(10001, '1') + pet(11790) + pet(20, '2') + pet(21, '')));
    expect(pets.map(p => p.id)).toEqual([1, 11790]);
    expect(excludedCount).toBe(3);
    expect(pets[0]).toMatchObject({ types: ['草', '水'], stats: [45, 49, 49, 65, 65, 45], description: '喜欢 & 阳光', metadata: { group: '精灵组', heightM: 0.7, weightKg: 6.9, experienceType: 105, catchRate: 250 } });
  });
  it('deduplicates identical IDs, but rejects conflicting rows and unknown attributes', () => {
    expect(parseOfficialPets(config(pet() + pet())).duplicateIds).toEqual([1]);
    expect(() => parseOfficialPets(config(pet() + pet(1, '0', '另一只')))).toThrow('conflicting');
    expect(() => parseOfficialPets(config(pet().replace('features="5,3"', 'features="999"')))).toThrow('unknown reference');
  });
  it('keeps missing stats unknown and mirrors the client truncation of decimal stats', () => {
    expect(parseOfficialPets(config(pet().replace('sm="45"', 'sm=""'))).pets[0].stats).toBeNull();
    expect(parseOfficialPets(config(pet().replace('sm="45"', 'sm="86.7"'))).pets[0].stats?.[0]).toBe(86);
  });
});

describe('official pet catalogue integration', () => {
  const snapshot = officialPetSnapshot(pack([config(pet())]), '2026-10-11T00:00:00Z');
  it('preserves existing routes, images, skills and guide metadata while updating official base facts', () => {
    const previous = { slug: 'miaomiao', name: '喵喵', number: 1, image: '/img/pets/miaomiao.png', stats: [1, 1, 1, 1, 1, 1], skills: [{ name: '样本技能' }], sourceUrl: 'https://example.test/guide' };
    const [merged] = buildOfficialPetCatalog(snapshot, [previous], { miaomiao: { bloodlines: ['样本血脉'], ladderMagic: { value: 5 } } });
    expect(merged).toMatchObject({ slug: 'miaomiao', stats: [45, 49, 49, 65, 65, 45], image: previous.image, skills: previous.skills, aliases: ['喵喵'], metadata: { bloodlines: ['样本血脉'], ladderMagic: { value: 5 }, group: '精灵组' } });
    expect(petCatalogHref(merged)).toBe('/pets/miaomiao/');
    const [imported] = buildOfficialPetCatalog(snapshot, [], {});
    expect(petCatalogHref(imported)).toBe('/pets/?entry=official-1');
    expect(imported.image).toBe('https://res.17roco.qq.com/res/combat/icons/001-.png?B6041');
  });
  it('hydrates static HTML before applying a direct detail or filtered query', async () => {
    const { JSDOM } = createRequire(import.meta.url)('jsdom');
    for (const query of ['?entry=official-3441', '?type=草&page=2']) {
      const App = () => createElement('p', null, useHydratedSearch(query) || 'catalogue');
      const html = renderToString(createElement(App));
      expect(html).toBe('<p>catalogue</p>');
      const dom = new JSDOM(`<div id="root">${html}</div>`);
      vi.stubGlobal('window', dom.window); vi.stubGlobal('document', dom.window.document);
      vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
      const container = dom.window.document.getElementById('root');
      const errors: unknown[] = [];
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => { root = hydrateRoot(container, createElement(App), { onRecoverableError: error => errors.push(error) }); });
        expect(errors).toEqual([]);
        expect(container.textContent).toBe(query);
      } finally {
        if (root) await act(async () => root!.unmount());
        vi.unstubAllGlobals(); dom.window.close();
      }
    }
  });
  it('validates the committed source snapshot and retains all existing articles', () => {
    const data = JSON.parse(readFileSync('apps/web/content/official-pets.json', 'utf8')) as OfficialPetSnapshot;
    const previous = JSON.parse(readFileSync('apps/web/content/pet-sources.json', 'utf8'));
    const catalog = buildOfficialPetCatalog(data, previous, {});
    expect(data.pets.length).toBeGreaterThan(3300);
    expect(new Set(data.pets.map(pet => pet.id)).size).toBe(data.pets.length);
    expect(data.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(data.source.spiritCount).toBe(data.pets.length + data.source.excludedCount + data.source.duplicateIds.length);
    for (const original of previous) expect(catalog.find(pet => pet.number === original.number)?.slug).toBe(original.slug);
    expect(catalog.find(pet => pet.number === 3092)?.stats).toEqual([162, 105, 142, 146, 142, 132]);
    expect(catalog.some(pet => pet.number === 10198)).toBe(false);
  });
});
