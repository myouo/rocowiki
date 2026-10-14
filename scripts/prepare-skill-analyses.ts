// SPDX-License-Identifier: GPL-3.0-only
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import type { OfficialPetSnapshot } from '../apps/web/src/wiki/catalog/pets/officialTypes';
import type { OfficialSkillSnapshot } from '../apps/web/src/wiki/catalog/skills/officialTypes';
import { buildSkillAnalyses, parseAnalysisDraft } from './updates/skill-analyses';
import { downloadSource } from './updates/download';
import { saveSnapshot } from './updates/snapshot';

const { values } = parseArgs({ options: { repository: { type: 'string' } } });
const read = async (name: string) => JSON.parse(await readFile(`apps/web/content/${name}`, 'utf8'));
const draft = parseAnalysisDraft(await read('skill-analysis-notes.json'));
const path = `pet/pet_info_${draft.source.petId}.json`;
const bytes = values.repository ? execFileSync('git', ['-C', values.repository, 'cat-file', 'blob', `${draft.source.commit}:${path}`], { maxBuffer: 2 * 1024 * 1024, timeout: 10_000 })
  : await downloadSource({ url: `https://api.gitcode.com/api/v5/repos/rocoai-dev/roco-desc/raw/${encodeURIComponent(path)}?ref=${draft.source.commit}`, maxBytes: 2 * 1024 * 1024 });
const snapshot = buildSkillAnalyses(draft, bytes, await read('official-pets.json') as OfficialPetSnapshot, await read('official-skills.json') as OfficialSkillSnapshot, new Date().toISOString());
const changed = await saveSnapshot('apps/web/content/skill-analyses.json', snapshot);
console.log(`${changed ? 'Prepared' : 'Unchanged:'} ${snapshot.records.length} source-backed skill analyses; ${snapshot.unanalysed.length} skills retain official descriptions. No game skill-pool records were changed.`);
