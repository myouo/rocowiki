// SPDX-License-Identifier: GPL-3.0-only
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { ANGEL_CONFIG_URL, MAX_CONFIG_BYTES } from './angel-config';
import { officialSkillSnapshot } from './skill-config';
import { downloadSource } from './download';
import { saveSnapshot } from './snapshot';

const { values } = parseArgs({ options: {
  input: { type: 'string' }, 'retrieved-at': { type: 'string' }, force: { type: 'boolean', default: false },
} });
const bytes = values.input ? await readFile(values.input) : await downloadSource({ url: ANGEL_CONFIG_URL, maxBytes: MAX_CONFIG_BYTES });
const snapshot = officialSkillSnapshot(bytes, values['retrieved-at'] || new Date().toISOString());
const changed = await saveSnapshot(new URL('../../apps/web/content/official-skills.json', import.meta.url), snapshot, values.force);
console.log(`${changed ? 'Imported' : 'Unchanged:'} ${snapshot.skills.length} official skills; excluded ${snapshot.source.excludedCount} non-skill effects/balls; ${snapshot.source.duplicateIds.length} duplicate IDs follow client source order. SHA-256: ${snapshot.source.sha256}`);
