// SPDX-License-Identifier: GPL-3.0-only
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import type { OfficialPetSnapshot } from '../../apps/web/src/wiki/catalog/pets/officialTypes';
import type { OfficialSkillSnapshot } from '../../apps/web/src/wiki/catalog/skills/officialTypes';
import type { SkillRelationSnapshot } from '../../apps/web/src/wiki/catalog/skills/relationTypes';
import { buildSkillRelationSnapshot, MAX_RELATION_TOTAL_BYTES, readRelationBlobs, SKILL_RELATION_REPO, SKILL_RELATION_RESOLVER_VERSION } from './skill-relations';
import { saveSnapshot } from './snapshot';

const { values } = parseArgs({ options: { repository: { type: 'string' }, force: { type: 'boolean', default: false } } });
const read = async <T>(file: string) => JSON.parse(await readFile(new URL(`../../apps/web/content/${file}`, import.meta.url), 'utf8')) as T;
const pets = await read<OfficialPetSnapshot>('official-pets.json'), skills = await read<OfficialSkillSnapshot>('official-skills.json');
const destination = new URL('../../apps/web/content/pet-skill-relations.json', import.meta.url);
let previous: SkillRelationSnapshot | undefined;
try { previous = JSON.parse(await readFile(destination, 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const git = (...args: string[]) => execFileSync('git', ['-c', 'credential.helper=', '-c', 'core.hooksPath=/dev/null', ...args], { encoding: 'utf8', timeout: 120_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, maxBuffer: MAX_RELATION_TOTAL_BYTES }).trim();
const remoteCommit = values.repository ? git('-C', values.repository, 'rev-parse', 'HEAD') : git('ls-remote', SKILL_RELATION_REPO, 'refs/heads/main').split(/\s/)[0];
if (!/^[a-f0-9]{40}$/.test(remoteCommit)) throw new Error('Public relation repository has no main commit');
if (!values.force && previous?.source.commit === remoteCommit && previous.source.resolverVersion === SKILL_RELATION_RESOLVER_VERSION && previous.source.officialPetSha256 === pets.source.sha256 && previous.source.officialSkillSha256 === skills.source.sha256) {
  console.log('Unchanged: public skill-pool source and official IDs; no clone or download required.');
} else {
  const temporary = values.repository ? null : await mkdtemp(join(tmpdir(), 'rocowiki-skill-relations-'));
  const repository = values.repository || join(temporary!, 'source');
  try {
    if (temporary) git('clone', '--depth', '1', '--single-branch', '--branch', 'main', '--no-checkout', SKILL_RELATION_REPO, repository);
    const commit = git('-C', repository, 'rev-parse', 'HEAD');
    const input = pets.pets.map(pet => `${commit}:pet/pet_info_${pet.id}.json\n`).join('');
    const bytes = execFileSync('git', ['-C', repository, 'cat-file', '--batch'], { input, timeout: 120_000, maxBuffer: MAX_RELATION_TOTAL_BYTES });
    const blobs = readRelationBlobs(bytes, pets.pets.map(pet => pet.id));
    const snapshot = buildSkillRelationSnapshot(blobs, pets, skills, commit, new Date().toISOString(), previous);
    const changed = await saveSnapshot(destination, snapshot, values.force);
    console.log(`${changed ? 'Imported' : 'Unchanged:'} ${snapshot.source.relationCount} public skill-pool relations; ${snapshot.source.unavailableCount} unavailable pets; ${snapshot.source.unresolvedCount} unresolved skill names. Commit: ${commit}`);
  } finally { if (temporary) await rm(temporary, { recursive: true, force: true }); }
}
