// SPDX-License-Identifier: GPL-3.0-only
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { LADDER_CONFIG_URL, MAX_LADDER_BYTES, ladderSnapshot } from './ladder-config';
import { saveSnapshot } from './snapshot';

const { values } = parseArgs({ options: {
  input: { type: 'string' }, 'retrieved-at': { type: 'string' }, force: { type: 'boolean', default: false },
} });
async function download(): Promise<Buffer> {
  // Each refresh gets a fresh CDN request rather than reusing an old version query.
  const url = new URL(LADDER_CONFIG_URL); url.searchParams.set('rocowiki', String(Date.now()));
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error(`LadderMatchConfig download failed: HTTP ${response.status}`);
  const chunks: Uint8Array[] = [], reader = response.body.getReader();
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > MAX_LADDER_BYTES) throw new Error('LadderMatchConfig download exceeds size limit');
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  return Buffer.concat(chunks);
}
const bytes = values.input ? await readFile(values.input) : await download();
const snapshot = ladderSnapshot(bytes, values['retrieved-at'] || new Date().toISOString());
const changed = await saveSnapshot(new URL('../../apps/web/content/official-ladder.json', import.meta.url), snapshot, values.force);
console.log(`${changed ? 'Imported' : 'Unchanged:'} ${Object.keys(snapshot.costs).length} configured ladder costs; ${snapshot.bannedPetIds.length} banned pet IDs; unlisted IDs use the official client default ${snapshot.defaultCost}. SHA-256: ${snapshot.source.sha256}`);
