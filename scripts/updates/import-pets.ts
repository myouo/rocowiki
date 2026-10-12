// SPDX-License-Identifier: GPL-3.0-only
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { ANGEL_CONFIG_URL, MAX_CONFIG_BYTES, officialPetSnapshot } from './angel-config';
import { saveSnapshot } from './snapshot';
import { downloadSource } from './download';

const { values } = parseArgs({ options: {
  input: { type: 'string' },
  'retrieved-at': { type: 'string' },
  force: { type: 'boolean', default: false },
} });

const bytes = values.input ? await readFile(values.input) : await downloadSource({ url: ANGEL_CONFIG_URL, maxBytes: MAX_CONFIG_BYTES });
const snapshot = officialPetSnapshot(bytes, values['retrieved-at'] || new Date().toISOString());
const destination = new URL('../../apps/web/content/official-pets.json', import.meta.url);
// All validation completes before replacing the last successful snapshot.
const changed = await saveSnapshot(destination, snapshot, values.force);
console.log(`${changed ? 'Imported' : 'Unchanged:'} ${snapshot.pets.length} official book pets; excluded ${snapshot.source.excludedCount} non-book records; duplicate IDs: ${snapshot.source.duplicateIds.join(', ') || 'none'}. SHA-256: ${snapshot.source.sha256}`);
