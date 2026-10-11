// SPDX-License-Identifier: GPL-3.0-only
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { ANGEL_CONFIG_URL, MAX_CONFIG_BYTES, officialPetSnapshot } from './angel-config';
import { saveOfficialPetSnapshot } from './official-pet-snapshot';

const { values } = parseArgs({ options: {
  input: { type: 'string' },
  'retrieved-at': { type: 'string' },
  force: { type: 'boolean', default: false },
} });

async function download(): Promise<Buffer> {
  const response = await fetch(ANGEL_CONFIG_URL, { signal: AbortSignal.timeout(30_000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error(`Angel.config download failed: HTTP ${response.status}`);
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_CONFIG_BYTES) throw new Error('Angel.config download exceeds size limit');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

const bytes = values.input ? await readFile(values.input) : await download();
const snapshot = officialPetSnapshot(bytes, values['retrieved-at'] || new Date().toISOString());
const destination = new URL('../apps/web/content/official-pets.json', import.meta.url);
// All validation completes before replacing the last successful snapshot.
const changed = await saveOfficialPetSnapshot(destination, snapshot, values.force);
console.log(`${changed ? 'Imported' : 'Unchanged:'} ${snapshot.pets.length} official book pets; excluded ${snapshot.source.excludedCount} non-book records; duplicate IDs: ${snapshot.source.duplicateIds.join(', ') || 'none'}. SHA-256: ${snapshot.source.sha256}`);
