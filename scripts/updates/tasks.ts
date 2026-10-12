// SPDX-License-Identifier: GPL-3.0-only
export interface UpdateTask {
  id: string;
  label: string;
  schedules: readonly string[];
  script: string;
  files: readonly string[];
  tests: readonly string[];
  description: string;
  disabledReason?: string;
  input?: { url: string; maxBytes: number };
}

// Each source owns its cadence. Add its cron to update.yml when registering a new cadence.
export const updateTasks: readonly UpdateTask[] = [
  {
    id: 'pets', label: 'Official pets', schedules: ['23 */3 * * *'],
    script: 'scripts/updates/import-pets.ts', files: ['apps/web/content/official-pets.json'],
    tests: ['tests/official-pets.test.ts'],
    description: 'Angel.config book entries; a catalogue flag does not establish release or acquisition availability.',
    input: { url: 'https://res.17roco.qq.com/conf/Angel.config', maxBytes: 8 * 1024 * 1024 },
  },
  {
    id: 'ladder', label: 'Official ladder costs and bans', schedules: ['23 */3 * * *'],
    script: 'scripts/updates/import-ladder.ts', files: ['apps/web/content/official-ladder.json'],
    tests: ['tests/official-ladder.test.ts'],
    description: 'LadderMatchConfig.xml cost overrides and separate banned IDs; unlisted costs default to one under the official client rule.',
  },
  {
    id: 'skills', label: 'Official skills', schedules: ['23 */3 * * *'],
    script: 'scripts/updates/import-skills.ts', files: ['apps/web/content/official-skills.json'],
    tests: ['tests/official-skills.test.ts'],
    description: 'Angel.config spiritSkill_conf definitions with official IDs; skill pools have separate provenance.',
    input: { url: 'https://res.17roco.qq.com/conf/Angel.config', maxBytes: 8 * 1024 * 1024 },
  },
  {
    id: 'skill-relations', label: 'Public pet skill pools', schedules: ['41 1 * * *'],
    script: 'scripts/updates/import-skill-relations.ts', files: ['apps/web/content/pet-skill-relations.json'],
    tests: ['tests/skill-relations.test.ts'],
    description: 'Public roco-desc learning relations matched to official pet identities and skill IDs; unresolved names stay unlinked.',
    disabledReason: 'Historical roco-desc snapshots are corroboration only; new collection must use official game data.',
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
    if (task.input && (!task.input.url.startsWith('https://') || !Number.isSafeInteger(task.input.maxBytes) || task.input.maxBytes <= 0)) throw new Error(`Invalid source for ${task.id}`);
    for (const file of task.files) {
      if (files.has(file)) throw new Error(`Multiple tasks own ${file}`);
      files.add(file);
    }
  }
  if (selection.schedule) {
    if (selection.only && selection.only !== 'all') throw new Error('Choose a schedule or explicit tasks, not both');
    // Use the cron supplied by GitHub, rather than wall-clock time: queued jobs may start late.
    return tasks.filter(task => !task.disabledReason && task.schedules.includes(selection.schedule!));
  }
  const only = selection.only || 'all';
  if (only === 'all') return tasks.filter(task => !task.disabledReason);
  const selected = only.split(',');
  if (selected.some(id => !ids.has(id)) || new Set(selected).size !== selected.length) throw new Error(`Unknown or duplicate update task: ${only}`);
  for (const id of selected) {
    const task = tasks.find(task => task.id === id)!;
    if (task.disabledReason) throw new Error(`Update task ${id} is disabled: ${task.disabledReason}`);
  }
  return tasks.filter(task => selected.includes(task.id));
}

export const updateFiles = [...new Set(updateTasks.flatMap(task => task.files))];
export const baselineFiles = ['apps/web/content/published-sections-v7.json'];
