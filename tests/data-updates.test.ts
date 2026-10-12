// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { selectUpdateTasks, updateTasks, type UpdateTask } from '../scripts/updates/tasks';
import { sameSnapshot, updateBranch } from '../scripts/updates/snapshot';

const daily: UpdateTask = { ...updateTasks[0], id: 'daily-example', schedules: ['41 1 * * *'], script: 'scripts/updates/import-example.ts', files: ['apps/web/content/example.json'], tests: ['tests/example.test.ts'] };
const weekly: UpdateTask = { ...daily, id: 'weekly-example', schedules: ['47 1 * * 5'], files: ['apps/web/content/weekly-example.json'] };

describe('independent source update schedules', () => {
  it('selects only tasks matching the trigger, including daily and weekly extensions', () => {
    const tasks = [...updateTasks, daily, weekly];
    expect(selectUpdateTasks(tasks, { schedule: '23 */3 * * *' }).map(task => task.id)).toEqual(['pets', 'ladder', 'skills']);
    expect(selectUpdateTasks(tasks, { schedule: '41 1 * * *' }).map(task => task.id)).toEqual(['daily-example']);
    expect(selectUpdateTasks(tasks, { schedule: '47 1 * * 5' }).map(task => task.id)).toEqual(['weekly-example']);
    expect(selectUpdateTasks(tasks, { schedule: 'unused' })).toEqual([]);
  });
  it('allows a manual subset or all, while rejecting unknown selections and output collisions', () => {
    expect(selectUpdateTasks(updateTasks, { only: 'ladder' }).map(task => task.id)).toEqual(['ladder']);
    expect(selectUpdateTasks([...updateTasks, daily], { only: 'daily-example,pets' }).map(task => task.id)).toEqual(['pets', 'daily-example']);
    expect(selectUpdateTasks(updateTasks, { only: 'all' })).toEqual(updateTasks.filter(task => !task.disabledReason && !task.requiresOneOf));
    expect(selectUpdateTasks(updateTasks, { schedule: '41 1 * * *' }, { ROCO_GAME_RUNTIME: 'tcp://127.0.0.1:17682' }).map(task => task.id)).toEqual(['game-skill-relations']);
    expect(() => selectUpdateTasks(updateTasks, { only: 'game-skill-relations' })).toThrow('collection is not configured');
    expect(() => selectUpdateTasks(updateTasks, { only: 'skill-relations' })).toThrow('official game data');
    for (const only of ['pets,pets', 'missing', '../pets']) expect(() => selectUpdateTasks(updateTasks, { only })).toThrow();
    expect(() => selectUpdateTasks(updateTasks, { only: 'pets', schedule: '23 */3 * * *' })).toThrow();
    expect(() => selectUpdateTasks([...updateTasks, { ...daily, files: updateTasks[0].files }], {})).toThrow('own');
  });
  it('plans through the real CLI without downloading data and does not infer a missing cron from current time', () => {
    const env = { ...process.env, GITHUB_EVENT_NAME: 'workflow_dispatch', UPDATE_TARGET: 'all', UPDATE_SCHEDULE: '', ROCO_GAME_RUNTIME: '', ROCO_GAME_SKILL_CAPTURE_FILE: '' };
    const run = (args: string[], overrides = {}) => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/updates/run.ts', '--plan', ...args], { env: { ...env, ...overrides }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    expect(JSON.parse(run(['--only', 'ladder'])).map((task: UpdateTask) => task.id)).toEqual(['ladder']);
    expect(JSON.parse(run([], { GITHUB_EVENT_NAME: 'schedule', UPDATE_SCHEDULE: '47 1 * * 5' }))).toEqual([]);
    expect(JSON.parse(run([], { GITHUB_EVENT_NAME: 'schedule', UPDATE_SCHEDULE: '41 1 * * *' }))).toEqual([]);
    expect(() => run(['--only', 'skill-relations'])).toThrow();
    expect(() => run([], { GITHUB_EVENT_NAME: 'schedule' })).toThrow();
    expect(() => run(['--only', 'events'])).toThrow();
  });
  it('keeps configured schedules, task scripts, outputs and checks aligned with the single workflow', () => {
    const { load } = createRequire(import.meta.url)('js-yaml');
    const workflow = load(readFileSync('.github/workflows/update.yml', 'utf8'));
    const crons = workflow.on.schedule.map((event: { cron: string }) => event.cron);
    for (const task of updateTasks) {
      expect(task.schedules.every(cron => crons.includes(cron))).toBe(true);
      for (const file of [task.script, ...task.files, ...task.tests]) expect(readFileSync(file).length).toBeGreaterThan(0);
    }
    expect(workflow.jobs.refresh.env.UPDATE_SCHEDULE).toBe('${{ github.event.schedule }}');
    expect(workflow.on.workflow_dispatch.inputs.target.default).toBe('all');
  });
  it('supports new snapshot shapes and hashes all registered files without timestamp-only churn', () => {
    expect(sameSnapshot({ records: [1] }, { records: [2] })).toBe(false);
    const a = { source: { retrievedAt: '2026-01-01', sha256: 'a' }, records: [1] };
    const b = { ...a, source: { ...a.source, retrievedAt: '2026-01-02' } };
    expect(sameSnapshot(a, b)).toBe(true);
    expect(updateBranch({ 'a.json': a, 'b.json': [1] })).toBe(updateBranch({ 'b.json': [1], 'a.json': b }));
    expect(updateBranch({ 'a.json': a, 'b.json': [2] })).not.toBe(updateBranch({ 'a.json': a, 'b.json': [1] }));
  });
});
