// SPDX-License-Identifier: GPL-3.0-only
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { SaxesParser } from 'saxes';
import type { OfficialPetRecord, OfficialPetSnapshot, PetStats } from '../apps/web/src/wiki/catalog/pets/officialTypes';

export const ANGEL_CONFIG_URL = 'https://res.17roco.qq.com/conf/Angel.config';
export const MAX_CONFIG_BYTES = 8 * 1024 * 1024;
const MAX_XML_BYTES = 64 * 1024 * 1024;
type Attributes = Record<string, string>;

/** XML is parsed as data only: no DOM, external entities, scripts or network. */
function visitXml(xml: string, visit: (name: string, attributes: Attributes, depth: number) => void) {
  const parser = new SaxesParser({ xmlns: false });
  let depth = 0;
  parser.on('doctype', () => { throw new Error('Angel.config: XML DOCTYPE is unsupported'); });
  parser.on('opentag', tag => visit(tag.name, tag.attributes, depth++));
  parser.on('closetag', () => { depth--; });
  parser.write(xml).close();
}

/** QueueConfs.readObject reads AMF3 XML (0x0b), with a U29 byte-length/reference. */
export function decodeAngelConfig(bytes: Buffer): Map<string, string> {
  if (bytes.length < 7 || bytes.length > MAX_CONFIG_BYTES) throw new Error('Angel.config: invalid package size');
  if (bytes[0] !== 0) throw new Error('Angel.config: unsupported package flag');
  if (bytes.readUInt32BE(1) !== bytes.length - 7) throw new Error('Angel.config: compressed length mismatch');
  const count = bytes.readUInt16BE(5);
  if (!count || count > 512) throw new Error('Angel.config: invalid object count');
  // @types/node does not overload the documented info:true return shape.
  const inflated = inflateSync(bytes.subarray(7), { maxOutputLength: MAX_XML_BYTES, info: true }) as unknown as {
    buffer: Buffer; engine: { bytesWritten: number };
  };
  if (inflated.engine.bytesWritten !== bytes.length - 7) throw new Error('Angel.config: trailing compressed bytes');
  const body = inflated.buffer;
  let offset = 0;
  const readByte = () => {
    if (offset >= body.length) throw new Error('Angel.config: truncated AMF3 XML object');
    return body[offset++];
  };
  const readU29 = () => {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const byte = readByte();
      if (i === 3) return value * 256 + byte;
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw new Error('Angel.config: invalid U29');
  };
  const resources = new Map<string, string>();
  const objects: string[] = [];
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  for (let i = 0; i < count; i++) {
    const marker = readByte();
    if (marker !== 0x0b && marker !== 0x07) throw new Error(`Angel.config: unsupported AMF3 marker ${marker}`);
    const header = readU29();
    let xml: string;
    if (header & 1) {
      const length = Math.floor(header / 2);
      if (!length || offset + length > body.length) throw new Error('Angel.config: invalid XML byte length');
      xml = utf8.decode(body.subarray(offset, offset + length));
      offset += length;
      objects.push(xml);
    } else {
      const referenced = objects[header / 2];
      if (referenced === undefined) throw new Error('Angel.config: invalid AMF3 XML reference');
      xml = referenced;
    }
    let name = '';
    visitXml(xml, (_tag, attributes, depth) => { if (depth === 0) name = attributes.name || ''; });
    if (!name || resources.has(name)) throw new Error(`Angel.config: missing or duplicate resource name ${name}`);
    resources.set(name, xml);
  }
  if (offset !== body.length) throw new Error('Angel.config: trailing AMF3 data');
  return resources;
}

function numeric(value: string | undefined): number | null {
  if (value === undefined || !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function metric(value: string | undefined, unit: 'm' | 'kg') {
  const match = value?.trim().match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${unit}$`, 'i'));
  return match ? numeric(match[1]) : null;
}

function ids(value: string | undefined): number[] {
  return [...new Set((value || '').split(',').filter(part => part.trim() && part.trim() !== '0').map(part => {
    const id = numeric(part);
    if (id === null || !Number.isSafeInteger(id) || id <= 0) throw new Error(`Angel.config: invalid reference ${part}`);
    return id;
  }))];
}

export function parseOfficialPets(xml: string) {
  const properties = new Map<number, string>(), groups = new Map<number, string>();
  const spirits = new Map<number, Attributes>(), duplicateIds: number[] = [];
  let configVersion = '', spiritCount = 0;
  visitXml(xml, (tag, attributes, depth) => {
    if (depth === 0) {
      if (tag !== 'SpiritConfig' || attributes.name !== 'spirit_conf') throw new Error('Angel.config: SpiritConfig root missing');
      configVersion = attributes.version || '';
    }
    if (depth !== 1) return;
    if (['SpiritDes', 'PropertyDes', 'groupTypeDes'].includes(tag)) {
      const id = numeric(attributes.id);
      if (id === null || !Number.isSafeInteger(id) || id <= 0) throw new Error(`Angel.config: invalid ${tag} id`);
      if (tag === 'SpiritDes') {
        spiritCount++;
        const previous = spirits.get(id);
        if (previous) {
          // Current official data repeats identical rows; conflicting identities must never silently win.
          const keys = [...new Set([...Object.keys(previous), ...Object.keys(attributes)])];
          if (keys.some(key => previous[key] !== attributes[key])) throw new Error(`Angel.config: conflicting SpiritDes id ${id}`);
          duplicateIds.push(id);
        } else spirits.set(id, attributes);
      } else {
        const table = tag === 'PropertyDes' ? properties : groups;
        if (!attributes.name?.trim() || table.has(id)) throw new Error(`Angel.config: invalid ${tag} definition ${id}`);
        table.set(id, attributes.name.trim());
      }
    }
  });
  if (!configVersion || !spirits.size || !properties.size) throw new Error('Angel.config: incomplete spirit_conf');
  const pets: OfficialPetRecord[] = [];
  for (const [id, row] of spirits) {
    // Matches SpiritDesProxy.as. ID thresholds or matching names would import Boss variants.
    if (row.isInBook !== '0') continue;
    const name = row.name?.trim();
    if (!name) throw new Error(`Angel.config: missing pet name ${id}`);
    const resolve = (values: number[], table: Map<number, string>) => values.map(key => {
      const label = table.get(key);
      if (!label) throw new Error(`Angel.config: unknown reference ${key} on pet ${id}`);
      return label;
    });
    const types = resolve(ids(row.features), properties);
    if (!types.length || types.length > 2) throw new Error(`Angel.config: invalid attributes on pet ${id}`);
    const petGroups = resolve(ids(row.group), groups).filter(group => group !== '组别未知');
    const values = ['sm', 'wg', 'fy', 'mg', 'mk', 'sd'].map(key => numeric(row[key]));
    // Client int() conversion truncates the two decimal-stat entries in the official table.
    const stats = values.every(value => value !== null && value > 0)
      ? values.map(value => Math.trunc(value!)) as PetStats : null;
    if (!/^[a-zA-Z0-9_-]+\.png$/.test(row.iconSrc || '')) throw new Error(`Angel.config: invalid pet icon ${id}`);
    pets.push({
      id, name, types, stats,
      iconUrl: `https://res.17roco.qq.com/res/combat/icons/${row.iconSrc}?${encodeURIComponent(configVersion)}`,
      description: row.description?.trim() || '',
      acquisitionText: row.getForm?.trim() || '',
      metadata: {
        group: petGroups[0] || null, groups: petGroups,
        experienceType: numeric(row.expType), heightM: metric(row.height, 'm'), weightKg: metric(row.weight, 'kg'),
        color: row.color?.trim() || null, catchRate: numeric(row.catchrate),
      },
    });
  }
  if (!pets.length) throw new Error('Angel.config: no book pets found');
  pets.sort((a, b) => a.id - b.id);
  return { pets, configVersion, spiritCount, excludedCount: spirits.size - pets.length, duplicateIds: duplicateIds.sort((a, b) => a - b) };
}

export function officialPetSnapshot(bytes: Buffer, retrievedAt: string): OfficialPetSnapshot {
  if (!Number.isFinite(Date.parse(retrievedAt))) throw new Error('Angel.config: invalid retrieval timestamp');
  const resources = decodeAngelConfig(bytes), xml = resources.get('spirit_conf');
  if (!xml) throw new Error('Angel.config: spirit_conf missing');
  const { pets, ...details } = parseOfficialPets(xml);
  return {
    schemaVersion: 1,
    source: { url: ANGEL_CONFIG_URL, retrievedAt, sha256: createHash('sha256').update(bytes).digest('hex'), objectCount: resources.size, ...details },
    pets,
  };
}
