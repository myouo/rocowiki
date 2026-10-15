// SPDX-License-Identifier: GPL-3.0-only
/** Shared directory depth parsing; malformed and oversized values never expand the list. */
export function requestedCatalogCount(params: URLSearchParams, total: number, batchSize = 60): number {
  const loaded = params.get('loaded'), page = params.get('page');
  const count = loaded && /^\d+$/.test(loaded) ? Number(loaded)
    : page && /^\d+$/.test(page) ? Number(page) * batchSize : batchSize;
  return Math.min(total, Math.max(batchSize, Number.isSafeInteger(count) ? count : batchSize));
}
