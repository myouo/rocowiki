// SPDX-License-Identifier: GPL-3.0-only
import { open, readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import type { OfficialPetSnapshot } from '../../apps/web/src/wiki/catalog/pets/officialTypes';
import type { OfficialSkillSnapshot } from '../../apps/web/src/wiki/catalog/skills/officialTypes';
import type { GameSkillObservation } from '../../apps/web/src/wiki/catalog/skills/gameTypes';
import { buildGameSkillSnapshot, emptyGameSkillSnapshot, parseGameSkillCaptures, validateGameSkillSnapshot } from './game-skill-snapshot';
import { HeadlessGameRpc } from './headless-rpc';
import { collectGameSkillPools } from './collect-game-skills';
import { saveSnapshot } from './snapshot';

const { values } = parseArgs({ options: { input: { type: 'string' }, runtime: { type: 'string' }, pets: { type: 'string' }, positions: { type: 'string' }, initialize: { type: 'boolean' } } });
const destination = new URL('../../apps/web/content/game-skill-relations.json', import.meta.url);
let previous = emptyGameSkillSnapshot();
try { previous = validateGameSkillSnapshot(JSON.parse(await readFile(destination, 'utf8'))); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Saved game snapshot is invalid; it has been preserved for investigation'); }
const input = values.input ?? (values.runtime ? undefined : process.env.ROCO_GAME_SKILL_CAPTURE_FILE);
const endpoint = values.runtime ?? (values.input ? undefined : process.env.ROCO_GAME_RUNTIME);
if (input && endpoint) throw new Error('Choose a sanitized game capture file or a live runtime');
if (values.initialize) {
  if (input || endpoint || Object.keys(previous.pets).length) throw new Error('Initialization cannot reset collected game observations');
  await saveSnapshot(destination, emptyGameSkillSnapshot());
  console.log('Initialized an empty game-only snapshot; no game collection is claimed.');
} else {
  let captures: GameSkillObservation[];
  if (input) {
    const file = await open(input, 'r');
    try {
      const bytes = Buffer.alloc(2 * 1024 * 1024 + 1);
      let length = 0;
      while (length < bytes.length) { const read = await file.read(bytes, length, bytes.length - length); if (!read.bytesRead) break; length += read.bytesRead; }
      if (length > 2 * 1024 * 1024) throw new Error('Game captures exceed size limit');
      let value: unknown;
      try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length))); } catch { throw new Error('Invalid sanitized game capture JSON'); }
      captures = parseGameSkillCaptures(value);
    } finally { await file.close(); }
  } else {
    if (!endpoint) throw new Error('Configure ROCO_GAME_RUNTIME or ROCO_GAME_SKILL_CAPTURE_FILE; game collection is not available');
    const ids = (values.pets ?? process.env.ROCO_GAME_SKILL_PETS)?.split(',').map(value => {
      if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid requested game pet ID'); return Number(value);
    });
    const positions = (values.positions ?? process.env.ROCO_GAME_SKILL_POSITIONS)?.split(',').map(value => {
      if (!/^[1-9]\d*$/.test(value) || Number(value) > 6) throw new Error('Invalid requested bag position'); return Number(value);
    });
    const rpc = new HeadlessGameRpc(endpoint, process.env.ROCO_GAME_RUNTIME_TOKEN);
    try { await rpc.connect(); captures = await collectGameSkillPools(rpc, ids, positions); }
    finally { await rpc.close(); }
  }
  const pets = JSON.parse(await readFile(new URL('../../apps/web/content/official-pets.json', import.meta.url), 'utf8')) as OfficialPetSnapshot;
  const skills = JSON.parse(await readFile(new URL('../../apps/web/content/official-skills.json', import.meta.url), 'utf8')) as OfficialSkillSnapshot;
  const snapshot = buildGameSkillSnapshot(captures, pets, skills, previous);
  const changed = await saveSnapshot(destination, snapshot);
  console.log(`${changed ? 'Imported' : 'Unchanged:'} ${snapshot.source!.petCount} game-observed pet pools; ${snapshot.source!.relationCount} skill relations. Account identities and credentials are excluded.`);
}
