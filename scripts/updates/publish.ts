// SPDX-License-Identifier: GPL-3.0-only
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { updateBranch, sameSnapshot } from './snapshot';
import { baselineFiles, selectUpdateTasks, updateFiles, updateTasks } from './tasks';

// Runs only after main tooling has parsed and validated the selected public sources.
if (process.env.GITHUB_ACTIONS !== 'true' || !/^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPOSITORY || '')) {
  throw new Error('Data update PR publication requires the repository Actions environment');
}
const repository = process.env.GITHUB_REPOSITORY!;
selectUpdateTasks(updateTasks, { only: 'all' });
const files = [...updateFiles, ...baselineFiles];
const run = (command: string, args: string[]) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const git = (...args: string[]) => run('git', args).trim();
const gh = (...args: string[]) => run('gh', args).trim();
const changedFiles = git('diff', '--name-only', 'HEAD').split('\n').filter(Boolean);
if (changedFiles.some(file => !files.includes(file)) || !changedFiles.some(file => updateFiles.includes(file))) {
  throw new Error('Data update must change only registered snapshots and generated section baselines');
}
const snapshots: Record<string, unknown> = {};
for (const file of updateFiles) snapshots[file] = JSON.parse(await readFile(file, 'utf8'));
// The main baseline distinguishes legitimate upstream rollbacks from older candidates.
const branch = updateBranch(snapshots, git('rev-parse', 'HEAD'));
gh('auth', 'setup-git');
const remote = git('ls-remote', '--heads', 'origin', `refs/heads/${branch}`);
let head: string;
if (remote) {
  // A retry reuses an identical candidate, without rewriting its history or running its code.
  git('fetch', '--no-tags', 'origin', `refs/heads/${branch}`);
  head = git('rev-parse', 'FETCH_HEAD');
  const candidateMatches = updateFiles.every(file => sameSnapshot(snapshots[file], JSON.parse(git('show', `FETCH_HEAD:${file}`))));
  const candidateFiles = git('diff', '--name-only', 'origin/main...FETCH_HEAD').split('\n').filter(Boolean);
  if (!candidateMatches || candidateFiles.some(file => !files.includes(file))) {
    throw new Error('Existing data update branch differs from the validated candidate');
  }
} else {
  git('switch', '-c', branch);
  git('config', 'user.name', 'github-actions[bot]');
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
  git('add', '--', ...files);
  git('commit', '-m', 'chore(data): refresh selected source snapshots');
  git('push', 'origin', `HEAD:refs/heads/${branch}`);
  head = git('rev-parse', 'HEAD');
}

let pull = gh('pr', 'list', '--repo', repository, '--base', 'main', '--head', branch, '--state', 'open', '--json', 'url', '--jq', '.[0].url // empty');
if (!pull) {
  const bodyFile = join(process.env.RUNNER_TEMP || tmpdir(), 'data-update-pr.md');
  const scope = updateTasks.filter(task => task.files.some(file => changedFiles.includes(file))).map(task => {
    const sources = task.files.map(file => {
      const source = (snapshots[file] as { source?: { retrievedAt?: string; sha256?: string } })?.source;
      return `- ${file}${source ? `; retrieved: ${source.retrievedAt || 'not supplied'}; SHA-256: ${source.sha256 || 'not supplied'}` : ''}`;
    }).join('\n');
    return `### ${task.label}\n\n${task.description}\n\n${sources}`;
  }).join('\n\n');
  await writeFile(bodyFile, `## Problem and outcome\n\nRefresh changed source snapshots and generated reader baselines using each source's own schedule.\n\n## Scope\n\n${scope}\n\n## Verification\n\nSource importers, targeted tests and type checks passed. Validate is dispatched for this candidate commit when no successful or active dispatch exists.\n\n## Upgrade and licensing\n\nPublic game configuration retains existing provenance and rights status. No database, account or secret changes. Independent review and normal main protection remain required; this workflow does not merge or deploy.\n`);
  pull = gh('pr', 'create', '--repo', repository, '--base', 'main', '--head', branch, '--title', 'chore(data): update source snapshots', '--body-file', bodyFile);
}
// GITHUB_TOKEN push events do not run normal push CI. Explicit dispatch starts read-only validation.
const runs = JSON.parse(gh('run', 'list', '--repo', repository, '--workflow', 'validate.yml', '--branch', branch, '--commit', head, '--event', 'workflow_dispatch', '--limit', '1', '--json', 'status,conclusion')) as { status: string; conclusion: string }[];
if (!runs.some(run => run.status !== 'completed' || run.conclusion === 'success')) {
  gh('workflow', 'run', 'validate.yml', '--repo', repository, '--ref', branch);
} else console.log('Candidate validation already succeeded or is active; skipping duplicate dispatch.');
console.log(`Data update ready for review: ${pull}`);
