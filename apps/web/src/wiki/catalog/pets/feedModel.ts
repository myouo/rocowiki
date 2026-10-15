// SPDX-License-Identifier: GPL-3.0-only
import type { WikiPet } from './officialTypes';
import {requestedCatalogCount} from '../listNavigation';
import {safeCatalogListReturnTo} from '../../../../../../packages/wiki-schema/src/catalog-routes';

export const PET_BATCH_SIZE = 60;
export type PetCollection = 'regular' | 'placeholder' | 'internal' | 'all';

export function petCollection(pet: Pick<WikiPet, 'official'>): Exclude<PetCollection, 'all'> {
  const source = pet.official;
  if (!source) return 'regular';
  // Keep source-table IDs separate; this is a catalogue convention, not a release flag.
  if (source.id >= 10_000) return 'internal';
  if (/^[A-Za-z]+$/.test(source.name) && ['介绍', '待定', ''].includes(source.description) && ['待定', ''].includes(source.acquisitionText)) return 'placeholder';
  return 'regular';
}

export function collectionRank(pet: Pick<WikiPet, 'official'>) {
  return { regular: 0, placeholder: 1, internal: 2 }[petCollection(pet)];
}

export function readPetCollection(value: string | null): PetCollection {
  return value === 'placeholder' || value === 'internal' || value === 'all' ? value : 'regular';
}

export function petFeedScope(params: URLSearchParams) {
  const query = new URLSearchParams();
  for (const key of ['q', 'type', 'typeMode', 'sort', 'order', 'group', 'series', 'experience', 'bloodline', 'magic', 'pvp', 'period', 'collection']) {
    const value = params.get(key);
    if (value !== null) query.set(key, value);
  }
  query.sort();
  return query.toString();
}

export function requestedPetCount(params: URLSearchParams, total: number) {
  return requestedCatalogCount(params, total, PET_BATCH_SIZE);
}

export function petWindow(loaded: number, columns: number, pitch: number, top: number, scroll: number, height: number, overscan = 3) {
  const rows = Math.ceil(loaded / Math.max(1, columns));
  const start = Math.min(Math.max(0, rows - 1), Math.max(0, Math.floor((scroll - top) / pitch) - overscan));
  const end = Math.min(rows, Math.max(start + 1, Math.ceil((scroll + height - top) / pitch) + overscan));
  return { start, end, rows };
}

export function safePetListReturnTo(value: string | null) {
  return safeCatalogListReturnTo('pets', value);
}

export function petHrefWithReturnTo(href: string, returnTo: string) {
  const url = new URL(href, 'https://wiki.invalid');
  url.searchParams.set('returnTo', safePetListReturnTo(returnTo));
  return url.pathname + url.search + url.hash;
}

export interface PetFeedPosition {
  scope: string;
  version: string;
  loaded: number;
  scroll: number;
  anchor?: string;
  offset?: number;
}
export const PET_FEED_STORAGE_KEY = 'roco-wiki:pet-feed:v1';

export function readPetFeedPosition(storage: Storage, scope: string, version: string, total: number): PetFeedPosition | null {
  try {
    const records: unknown = JSON.parse(storage.getItem(PET_FEED_STORAGE_KEY) || '[]');
    if (!Array.isArray(records)) return null;
    const record = records.find(row => row && row.scope === scope && row.version === version);
    if (!record || !Number.isSafeInteger(record.loaded) || record.loaded < 0 || !Number.isFinite(record.scroll) || record.scroll < 0 || record.scroll > 10_000_000) return null;
    return {
      scope, version, loaded: Math.min(total, Math.max(PET_BATCH_SIZE, record.loaded)), scroll: record.scroll,
      anchor: typeof record.anchor === 'string' && /^[a-z0-9_-]{1,120}$/i.test(record.anchor) ? record.anchor : undefined,
      offset: Number.isFinite(record.offset) && Math.abs(record.offset) < 10_000 ? record.offset : undefined,
    };
  } catch { return null; }
}

export function savePetFeedPosition(storage: Storage, position: PetFeedPosition) {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PET_FEED_STORAGE_KEY) || '[]');
    const previous = Array.isArray(parsed) ? parsed.filter(row => row && typeof row.scope === 'string' && row.scope !== position.scope).slice(0, 7) : [];
    storage.setItem(PET_FEED_STORAGE_KEY, JSON.stringify([position, ...previous]));
  } catch { /* Browsing remains available when session storage is blocked. */ }
}
