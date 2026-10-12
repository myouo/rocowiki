// SPDX-License-Identifier: GPL-3.0-only
export interface UpdateTask {
  id: string;
  label: string;
  schedules: readonly string[];
  script: string;
  files: readonly string[];
  tests: readonly string[];
  description: string;
}

// Each source owns its cadence. Add its cron to update.yml when registering a new cadence.
export const updateTasks: readonly UpdateTask[] = [
  {
    id: 'pets', label: 'Official pets', schedules: ['23 */3 * * *'],
    script: 'scripts/updates/import-pets.ts', files: ['apps/web/content/official-pets.json'],
    tests: ['tests/official-pets.test.ts'],
    description: 'Angel.config book entries; a catalogue flag does not establish release or acquisition availability.',
  },
  {
    id: 'ladder', label: 'Official ladder costs and bans', schedules: ['23 */3 * * *'],
    script: 'scripts/updates/import-ladder.ts', files: ['apps/web/content/official-ladder.json'],
    tests: ['tests/official-ladder.test.ts'],
    description: 'LadderMatchConfig.xml cost overrides and separate banned IDs; unlisted costs default to one under the official client rule.',
  },
];

export function selectUpdateTasks(tasks: readonly UpdateTask[], selection: { schedule?: string; only?: string }) {
  const ids = new Set<string>(), files = new Set<string>();
  for (const task of tasks) {
    if (!/^[a-z][a-z0-9-]*$/.test(task.id) || ids.has(task.id)) throw new Error('Invalid or duplicate update task ID');
    ids.add(task.id);
    if (!task.schedules.length || task.schedules.some(cron => !cron.trim())) throw new Error(`Missing schedule for ${task.id}`);
    if (![task.script, ...task.files, ...task.tests].every(file => /^[\w./-]+$/.test(file) && !file.split('/').includes('..') && !file.startsWith('/'))) throw new Error(`Invalid path for ${task.id}`);
    if (!task.files.length || !task.tests.length) throw new Error(`Missing outputs or tests for ${task.id}`);
    for (const file of task.files) {
      if (files.has(file)) throw new Error(`Multiple tasks own ${file}`);
      files.add(file);
    }
  }
  if (selection.schedule) {
    if (selection.only && selection.only !== 'all') throw new Error('Choose a schedule or explicit tasks, not both');
    // Use the cron supplied by GitHub, rather than wall-clock time: queued jobs may start late.
    return tasks.filter(task => task.schedules.includes(selection.schedule!));
  }
  const only = selection.only || 'all';
  if (only === 'all') return [...tasks];
  const selected = only.split(',');
  if (selected.some(id => !ids.has(id)) || new Set(selected).size !== selected.length) throw new Error(`Unknown or duplicate update task: ${only}`);
  return tasks.filter(task => selected.includes(task.id));
}

export const updateFiles = [...new Set(updateTasks.flatMap(task => task.files))];
export const baselineFiles = ['apps/web/content/published-sections-v7.json'];
