// SPDX-License-Identifier: GPL-3.0-only
export type CatalogKind = 'pets' | 'skills';
export interface CatalogIdentity {
  slug?: string;
  number?: number | null;
  official?: {id: number};
  localEntry?: boolean;
  catalogEntry?: boolean;
}

/** Permanent aliases from the published catalogue. Never infer identity from a display name. */
export const catalogAliases: Record<CatalogKind, Readonly<Record<string, number>>> = {
  pets: {miaomiao: 1, huohua: 4, shuilanlan: 7, dimo: 137, abu: 630, 'royal-dimo': 1888, hapuluosi: 2316, moshen: 2531, bishui: 2552, zhuque: 3031, haifu: 3092, sailemu: 3362},
  skills: {feiyanlingbo: 1386, shuilingdong: 1959, yupiaoyao: 1960, chenshiji: 1961, linghuo: 2907, wufa: 2908, xiufu: 2925, diezhang: 3016, xiazi: 3044, yuanyun: 3045, tianhe: 3046, feixing: 3047},
};

const positiveId = (value: number | undefined | null): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
export function catalogRouteId(kind: CatalogKind, key: string): number | null {
  if (Object.hasOwn(catalogAliases[kind], key)) return catalogAliases[kind][key];
  const numeric = key.replace(kind === 'pets' ? /^official-/ : /^official-skill-/, '');
  return /^[1-9]\d*$/.test(numeric) && positiveId(Number(numeric)) ? Number(numeric) : null;
}

export function catalogIdentityId(kind: CatalogKind, entry: CatalogIdentity): number | null {
  if (entry.localEntry) return null;
  // Source IDs remain stable even when a local draft changes the displayed number.
  return catalogRouteId(kind, entry.slug || '') ?? (positiveId(entry.official?.id) ? entry.official!.id : positiveId(entry.number) ? entry.number : null);
}

export function catalogEntryHref(kind: CatalogKind, entry: CatalogIdentity): string {
  const id = catalogIdentityId(kind, entry);
  if (id !== null) return `/${kind}/${id}/`;
  const slug = encodeURIComponent(entry.slug || '');
  return entry.localEntry || entry.catalogEntry ? `/${kind}/?entry=${slug}` : `/${kind}/${slug}/`;
}

export function matchesCatalogEntry(kind: CatalogKind, entry: CatalogIdentity, key: string): boolean {
  if (entry.slug === key) return true;
  const id = catalogRouteId(kind, key);
  return id !== null && id === catalogIdentityId(kind, entry);
}

/** Public URL normalization preserves context, return links and fragments. */
export function canonicalCatalogHref(value: string): string {
  if (!/^\/(?!\/)/.test(value) || /[\\\u0000-\u0020\u007f]/.test(value)) return value;
  const url = new URL(value, 'https://wiki.invalid');
  const match = /^\/(pets|skills)(?:\/([^/]+))?\/?$/.exec(url.pathname);
  if (!match) return value;
  const kind = match[1] as CatalogKind;
  const key = match[2] || url.searchParams.get('entry') || '';
  const id = catalogRouteId(kind, key);
  if (id === null) return value;
  url.pathname = `/${kind}/${id}/`;
  url.searchParams.delete('entry');
  if (kind === 'pets' && url.searchParams.get('section') === 'skills') {
    if (!url.hash) url.hash = 'skills';
    url.searchParams.delete('section');
  }
  return url.pathname + url.search + url.hash;
}

/** Preserve stored discussions and sections: changing a public URL must not split records. */
export function catalogStorageKey(value: string): string {
  const canonical = canonicalCatalogHref(value);
  const url = new URL(canonical, 'https://wiki.invalid');
  const match = /^\/(pets|skills)\/([1-9]\d*)\/$/.exec(url.pathname);
  if (!match) return value;
  const kind = match[1] as CatalogKind, id = Number(match[2]);
  if (!positiveId(id)) return value;
  const alias = Object.entries(catalogAliases[kind]).find(([, number]) => number === id)?.[0];
  return alias ? `/${kind}/${alias}/` : `/${kind}/?entry=${kind === 'pets' ? 'official-' : 'official-skill-'}${id}`;
}

export function withCatalogContext(href: string, values: Record<string, string | undefined>): string {
  const url = new URL(href, 'https://wiki.invalid');
  for (const [key, value] of Object.entries(values)) if (value) url.searchParams.set(key, value);
  return url.pathname + url.search + url.hash;
}

/** A detail may return only to its own category directory, never another entry or origin. */
export function safeCatalogListReturnTo(kind: CatalogKind, value: string | null): string {
  const root = `/${kind}/`;
  if (!value || value.length > 4096 || /[\\<>\u0000-\u001f\u007f]/.test(value) || !value.startsWith(root)) return root;
  const tail = value.slice(root.length);
  if (tail && !tail.startsWith('?') || value.includes('#')) return root;
  const url = new URL(value, 'https://wiki.invalid');
  return url.pathname === root && !url.searchParams.has('entry') ? value : root;
}
