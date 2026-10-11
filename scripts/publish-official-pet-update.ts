// SPDX-License-Identifier: GPL-3.0-only
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { OfficialPetSnapshot } from '../apps/web/src/wiki/catalog/pets/officialTypes';
import { officialPetUpdateBranch, sameOfficialPetSnapshot } from './official-pet-snapshot';

// Runs only after protected main tooling has parsed and validated the public configuration.
if (process.env.GITHUB_ACTIONS !== 'true' || !/^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPOSITORY || '')) {
  throw new Error('Official pet PR publication requires the repository Actions environment');
}
const repository = process.env.GITHUB_REPOSITORY!;
const files = ['apps/web/content/official-pets.json', 'apps/web/content/published-sections-v7.json'];
const run = (command: string, args: string[]) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const git = (...args: string[]) => run('git', args).trim();
const gh = (...args: string[]) => run('gh', args).trim();
const changedFiles = git('diff', '--name-only', 'HEAD').split('\n').filter(Boolean);
if (changedFiles.some(file => !files.includes(file)) || !changedFiles.includes(files[0])) {
  throw new Error('Official pet update must change only its snapshot and generated section baselines');
}
const snapshot = JSON.parse(await readFile(files[0], 'utf8')) as OfficialPetSnapshot;
// Including the protected base also supports legitimate upstream rollbacks to an older payload.
const branch = officialPetUpdateBranch(snapshot, git('rev-parse', 'HEAD'));
gh('auth', 'setup-git');
const remote = git('ls-remote', '--heads', 'origin', `refs/heads/${branch}`);
if (remote) {
  // A retry reuses an identical candidate, without rewriting its history or running its code.
  git('fetch', '--no-tags', 'origin', `refs/heads/${branch}`);
  const candidate = JSON.parse(git('show', `FETCH_HEAD:${files[0]}`)) as OfficialPetSnapshot;
  const candidateFiles = git('diff', '--name-only', 'origin/main...FETCH_HEAD').split('\n').filter(Boolean);
  if (!sameOfficialPetSnapshot(snapshot, candidate) || candidateFiles.some(file => !files.includes(file))) {
    throw new Error('Existing official pet update branch differs from the validated data candidate');
  }
} else {
  git('switch', '-c', branch);
  git('config', 'user.name', 'github-actions[bot]');
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
  git('add', '--', ...files);
  git('commit', '-m', 'chore(data): refresh official pet snapshot');
  git('push', 'origin', `HEAD:refs/heads/${branch}`);
}

let pull = gh('pr', 'list', '--repo', repository, '--base', 'main', '--head', branch, '--state', 'open', '--json', 'url', '--jq', '.[0].url // empty');
if (!pull) {
  const bodyFile = join(process.env.RUNNER_TEMP || tmpdir(), 'official-pet-update-pr.md');
  await writeFile(bodyFile, `## Problem and outcome\n\nRefresh the public Angel.config pet snapshot and generated reader baselines. Import only entries marked isInBook=0; this flag does not establish release or acquisition availability.\n\n## Scope\n\n- Official book pets: ${snapshot.pets.length}\n- Non-book records excluded: ${snapshot.source.excludedCount}\n- Configuration: ${snapshot.source.configVersion}\n- Retrieved: ${snapshot.source.retrievedAt}\n- Package SHA-256: ${snapshot.source.sha256}\n\n## Verification\n\nThe importer validated the package, AMF3 XML and pet records; targeted tests and type checks passed. The Validate workflow is dispatched on this branch for full checks before review.\n\n## Upgrade and licensing\n\nPublic game configuration retains its existing provenance and rights status. No database, account or secret changes. Independent review and normal main protection remain required; this workflow does not merge or deploy.\n`);
  pull = gh('pr', 'create', '--repo', repository, '--base', 'main', '--head', branch, '--title', 'chore(data): update official pet snapshot', '--body-file', bodyFile);
}
// GITHUB_TOKEN push events do not run normal push CI. Explicit dispatch starts read-only validation.
gh('workflow', 'run', 'validate.yml', '--repo', repository, '--ref', branch);
console.log(`Official pet update ready for review: ${pull}`);
