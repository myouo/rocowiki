// SPDX-License-Identifier: GPL-3.0-only
import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { OfficialPetSnapshot } from '../apps/web/src/wiki/catalog/pets/officialTypes';

function content(snapshot: OfficialPetSnapshot) {
  const { retrievedAt: _retrievedAt, ...source } = snapshot.source;
  return { ...snapshot, source };
}

export function sameOfficialPetSnapshot(a: OfficialPetSnapshot, b: OfficialPetSnapshot) {
  return isDeepStrictEqual(content(a), content(b));
}

export function officialPetUpdateBranch(snapshot: OfficialPetSnapshot, baseCommit = '') {
  if (baseCommit && !/^[a-f0-9]{40}$/.test(baseCommit)) throw new Error('Invalid official pet update base commit');
  const digest = createHash('sha256').update(JSON.stringify(content(snapshot))).digest('hex');
  return `chore/official-pets-${digest.slice(0, 20)}${baseCommit ? `-${baseCommit.slice(0, 12)}` : ''}`;
}

export async function saveOfficialPetSnapshot(destination: string | URL, snapshot: OfficialPetSnapshot, force = false): Promise<boolean> {
  try {
    const previous = JSON.parse(await readFile(destination, 'utf8')) as OfficialPetSnapshot;
    if (!force && sameOfficialPetSnapshot(previous, snapshot)) return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const temporary = `${destination instanceof URL ? fileURLToPath(destination) : destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n');
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  return true;
}
