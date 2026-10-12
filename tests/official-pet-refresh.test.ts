// SPDX-License-Identifier: GPL-3.0-only
import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { updateBranch, saveSnapshot } from '../scripts/updates/snapshot';
import type { OfficialPetSnapshot } from '../apps/web/src/wiki/catalog/pets/officialTypes';
import type { OfficialLadderSnapshot } from '../apps/web/src/wiki/catalog/pets/ladderTypes';

const temporary: string[] = [];
afterEach(async () => { for (const directory of temporary.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function directory() { const value = await mkdtemp(join(tmpdir(), 'official-pet-refresh-')); temporary.push(value); return value; }
const snapshot = (time = '2026-10-11T00:00:00Z'): OfficialPetSnapshot => ({
  schemaVersion: 1,
  source: { url: 'https://example.test/Angel.config', retrievedAt: time, sha256: 'a'.repeat(64), configVersion: 'test', objectCount: 1, spiritCount: 1, excludedCount: 0, duplicateIds: [] },
  pets: [],
});
const ladderSnapshot = (): OfficialLadderSnapshot => ({ schemaVersion: 1, source: { url: 'https://example.test/LadderMatchConfig.xml', retrievedAt: '2026-10-11T00:00:00Z', sha256: 'a'.repeat(64), costEntryCount: 0, banEntryCount: 0 }, defaultCost: 1, costs: {}, bannedPetIds: [] });
const branchFor = (pets: OfficialPetSnapshot, base = '', ladder?: OfficialLadderSnapshot) => updateBranch({ 'apps/web/content/official-pets.json': pets, ...(ladder ? { 'apps/web/content/official-ladder.json': ladder } : {}) }, base);

describe('scheduled official pet refresh', () => {
  it('does not rewrite a snapshot or change its branch when only the check time changes', async () => {
    const file = join(await directory(), 'snapshot.json'), first = snapshot();
    expect(await saveSnapshot(file, first)).toBe(true);
    const bytes = await readFile(file, 'utf8');
    const later = snapshot('2026-10-12T00:00:00Z');
    expect(await saveSnapshot(file, later)).toBe(false);
    expect(await readFile(file, 'utf8')).toBe(bytes);
    expect(branchFor(later)).toBe(branchFor(first));
    const changed = { ...later, source: { ...later.source, sha256: 'b'.repeat(64) } };
    expect(await saveSnapshot(file, changed)).toBe(true);
    expect(branchFor(changed)).not.toBe(branchFor(first));
    expect(branchFor(changed)).not.toMatch(/agent/i);
    expect(branchFor(first, 'a'.repeat(40))).not.toBe(branchFor(first, 'b'.repeat(40)));
  });
  it('preserves a corrupt previous snapshot for investigation instead of silently overwriting it', async () => {
    const file = join(await directory(), 'snapshot.json');
    await writeFile(file, '{broken');
    await expect(saveSnapshot(file, snapshot())).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe('{broken');
  });
  it('allows an explicit fresh capture and leaves no temporary files on a successful write', async () => {
    const dir = await directory(), file = join(dir, 'snapshot.json');
    await saveSnapshot(file, snapshot());
    expect(await saveSnapshot(file, snapshot('2026-10-12T00:00:00Z'), true)).toBe(true);
    expect(JSON.parse(await readFile(file, 'utf8')).source.retrievedAt).toBe('2026-10-12T00:00:00Z');
    const { readdir } = await import('node:fs/promises');
    expect(await readdir(dir)).toEqual(['snapshot.json']);
  });
  it('schedules eight daily checks, isolates credentials, and dispatches validation without production secrets', async () => {
    const { load } = createRequire(import.meta.url)('js-yaml');
    const workflow = load(await readFile('.github/workflows/update.yml', 'utf8'));
    expect(workflow.on.schedule).toEqual([{ cron: '23 */3 * * *' }]);
    expect(workflow.on).toHaveProperty('workflow_dispatch');
    expect(workflow.concurrency['cancel-in-progress']).toBe(false);
    const job = workflow.jobs.refresh;
    expect(job.if).toBe("github.ref == 'refs/heads/main'");
    expect(job.environment).toBeUndefined();
    expect(job.steps[0].with).toMatchObject({ ref: 'main', 'persist-credentials': false });
    const credentialSteps = job.steps.filter((step: { env?: { GH_TOKEN?: string } }) => step.env?.GH_TOKEN);
    expect(credentialSteps).toHaveLength(1);
    expect(credentialSteps[0].run).toBe('node --import tsx scripts/updates/publish.ts');
    expect(JSON.stringify(workflow)).not.toContain('secrets.');
    const refresh = job.steps.find((step: { name?: string }) => step.name === 'Refresh selected public sources');
    expect(refresh.run).toBe('npm run data:update');
    expect(job.steps.find((step: { id?: string }) => step.id === 'data').run).toBe('npm run data:update -- --changes');
    const validation = load(await readFile('.github/workflows/validate.yml', 'utf8'));
    expect(validation.on).toHaveProperty('workflow_dispatch');
    expect(validation.permissions).toEqual({ contents: 'read' });
  });
});

describe('official pet PR publication through real Git', () => {
  const script = resolve('scripts/updates/publish.ts');
  const tsx = resolve('node_modules/tsx/dist/loader.mjs');
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  async function fixture(kind: 'pets' | 'ladder' = 'pets') {
    const root = await directory(), remote = join(root, 'remote.git'), work = join(root, 'work'), bin = join(root, 'bin');
    await mkdir(work); await mkdir(bin);
    git(root, 'init', '--bare', '--initial-branch=main', remote);
    git(work, 'init', '--initial-branch=main'); git(work, 'config', 'user.name', 'Fixture'); git(work, 'config', 'user.email', 'fixture@example.test');
    // Fixture commits must not inherit the developer's personal signing key.
    git(work, 'config', 'commit.gpgsign', 'false');
    await mkdir(join(work, 'apps/web/content'), { recursive: true });
    await writeFile(join(work, 'apps/web/content/official-pets.json'), JSON.stringify(snapshot()));
    await writeFile(join(work, 'apps/web/content/official-ladder.json'), JSON.stringify(ladderSnapshot()));
    await writeFile(join(work, 'apps/web/content/published-sections-v7.json'), '{}');
    await writeFile(join(work, 'code.txt'), 'reviewed code');
    git(work, 'add', '.'); git(work, 'commit', '-m', 'fixture base'); git(work, 'remote', 'add', 'origin', remote); git(work, 'push', '-u', 'origin', 'main');
    await writeFile(join(bin, 'gh'), `#!/usr/bin/env node
const fs=require('node:fs'),args=process.argv.slice(2);
fs.appendFileSync(process.env.GH_TEST_LOG,JSON.stringify(args)+'\\n');
if(args[0]==='pr'&&args[1]==='list'&&process.env.GH_TEST_EXISTING)process.stdout.write(process.env.GH_TEST_EXISTING);
if(args[0]==='pr'&&args[1]==='create')process.stdout.write('https://github.com/example/fixture/pull/1');
if(args[0]==='run'&&args[1]==='list')process.stdout.write(process.env.GH_TEST_RUNS|| (fs.existsSync(process.env.GH_TEST_STATE)?fs.readFileSync(process.env.GH_TEST_STATE,'utf8'):'[]'));
if(args[0]==='workflow'&&args[1]==='run')fs.writeFileSync(process.env.GH_TEST_STATE,JSON.stringify([{status:'queued',conclusion:''}]));
`, { mode: 0o755 });
    const next = kind === 'pets' ? { ...snapshot('2026-10-12T00:00:00Z'), source: { ...snapshot().source, retrievedAt: '2026-10-12T00:00:00Z', sha256: 'b'.repeat(64) } } : snapshot();
    const ladder = kind === 'ladder' ? { ...ladderSnapshot(), costs: { '137': 2 }, source: { ...ladderSnapshot().source, sha256: 'b'.repeat(64), costEntryCount: 1 } } : ladderSnapshot();
    await writeFile(join(work, 'apps/web/content/official-pets.json'), JSON.stringify(next));
    await writeFile(join(work, 'apps/web/content/official-ladder.json'), JSON.stringify(ladder));
    await writeFile(join(work, 'apps/web/content/published-sections-v7.json'), '{"updated":true}');
    const log = join(root, 'gh.log');
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'example/fixture', GH_TOKEN: 'synthetic-actions-token', RUNNER_TEMP: root, GH_TEST_LOG: log, GH_TEST_STATE: join(root, 'runs.json'), GH_TEST_EXISTING: '' };
    const publish = (overrides = {}) => execFileSync(process.execPath, ['--import', tsx, script], { cwd: work, env: { ...env, ...overrides }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { work, remote, log, next, ladder, publish };
  }
  it('pushes only data to a new branch, creates a PR, dispatches checks, and reuses the candidate on retry', async () => {
    const f = await fixture(), main = git(f.remote, 'rev-parse', 'main'), branch = branchFor(f.next, main, f.ladder);
    expect(f.publish()).toContain('ready for review');
    const head = git(f.remote, 'rev-parse', branch);
    expect(git(f.remote, 'rev-parse', 'main')).toBe(main);
    expect(git(f.remote, 'diff', '--name-only', `main...${branch}`).split('\n').sort()).toEqual(['apps/web/content/official-pets.json', 'apps/web/content/published-sections-v7.json']);
    git(f.work, 'switch', 'main');
    await writeFile(join(f.work, 'apps/web/content/official-pets.json'), JSON.stringify({ ...f.next, source: { ...f.next.source, retrievedAt: '2026-10-12T03:00:00Z' } }));
    await writeFile(join(f.work, 'apps/web/content/published-sections-v7.json'), '{"updated":true}');
    f.publish({ GH_TEST_EXISTING: 'https://github.com/example/fixture/pull/1' });
    expect(git(f.remote, 'rev-parse', branch)).toBe(head);
    const calls = (await readFile(f.log, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as string[]);
    expect(calls.filter(args => args[0] === 'pr' && args[1] === 'create')).toHaveLength(1);
    expect(calls.filter(args => args[0] === 'workflow')).toEqual([['workflow', 'run', 'validate.yml', '--repo', 'example/fixture', '--ref', branch]]);
    expect(calls.filter(args => args[0] === 'run').every(args => args.includes(head))).toBe(true);
    expect(calls.some(args => args.includes('merge'))).toBe(false);
  });
  it('rejects unrelated local code changes before any GitHub operation', async () => {
    const f = await fixture(); await writeFile(join(f.work, 'code.txt'), 'unreviewed code');
    expect(() => f.publish()).toThrow();
    await expect(readFile(f.log, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it.each(['success', 'failure', 'cancelled'])('handles completed validation with conclusion %s on the exact candidate', async conclusion => {
    const f = await fixture();
    f.publish();
    git(f.work, 'switch', 'main');
    await writeFile(join(f.work, 'apps/web/content/official-pets.json'), JSON.stringify(f.next));
    await writeFile(join(f.work, 'apps/web/content/published-sections-v7.json'), '{"updated":true}');
    f.publish({ GH_TEST_EXISTING: 'https://github.com/example/fixture/pull/1', GH_TEST_RUNS: JSON.stringify([{ status: 'completed', conclusion }]) });
    const calls = (await readFile(f.log, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as string[]);
    expect(calls.filter(args => args[0] === 'workflow')).toHaveLength(conclusion === 'success' ? 1 : 2);
  });
  it('publishes a ladder-only update even when Angel.config did not change', async () => {
    const f = await fixture('ladder'), main = git(f.remote, 'rev-parse', 'main'), branch = branchFor(f.next, main, f.ladder);
    expect(f.publish()).toContain('ready for review');
    expect(git(f.remote, 'rev-parse', 'main')).toBe(main);
    expect(git(f.remote, 'diff', '--name-only', `main...${branch}`).split('\n').sort()).toEqual(['apps/web/content/official-ladder.json', 'apps/web/content/published-sections-v7.json']);
    expect(branch).not.toBe(branchFor(f.next, main, ladderSnapshot()));
  });
  it('refuses to reuse a branch containing code changes even when the snapshot matches', async () => {
    const f = await fixture(), branch = branchFor(f.next, git(f.work, 'rev-parse', 'HEAD'), f.ladder);
    git(f.work, 'switch', '-c', branch); await writeFile(join(f.work, 'code.txt'), 'unexpected code');
    git(f.work, 'add', '.'); git(f.work, 'commit', '-m', 'unexpected branch'); git(f.work, 'push', 'origin', branch);
    git(f.work, 'switch', 'main');
    await writeFile(join(f.work, 'apps/web/content/official-pets.json'), JSON.stringify(f.next));
    await writeFile(join(f.work, 'apps/web/content/published-sections-v7.json'), '{"updated":true}');
    expect(() => f.publish()).toThrow();
    const calls = await readFile(f.log, 'utf8');
    expect(calls).not.toContain('"create"'); expect(calls).not.toContain('"workflow"');
  });
});
