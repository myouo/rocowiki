// SPDX-License-Identifier: GPL-3.0-only
import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
function content(snapshot: unknown): unknown {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return snapshot;
  const record = snapshot as Record<string, unknown>;
  if (!record.source || typeof record.source !== 'object' || Array.isArray(record.source)) return snapshot;
  const { retrievedAt: _retrievedAt, ...source } = record.source as Record<string, unknown>;
  return { ...record, source };
}

export function sameSnapshot(a: unknown, b: unknown) {
  return isDeepStrictEqual(content(a), content(b));
}

export function updateBranch(snapshots: Record<string, unknown>, baseCommit = '') {
  if (baseCommit && !/^[a-f0-9]{40}$/.test(baseCommit)) throw new Error('Invalid data update base commit');
  const hash = createHash('sha256');
  for (const file of Object.keys(snapshots).sort()) hash.update(file + '\0').update(JSON.stringify(content(snapshots[file])) + '\0');
  const digest = hash.digest('hex');
  return `chore/data-update-${digest.slice(0, 20)}${baseCommit ? `-${baseCommit.slice(0, 12)}` : ''}`;
}

export async function saveSnapshot(destination: string | URL, snapshot: unknown, force = false): Promise<boolean> {
  try {
    const previous: unknown = JSON.parse(await readFile(destination, 'utf8'));
    if (!force && sameSnapshot(previous, snapshot)) return false;
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
