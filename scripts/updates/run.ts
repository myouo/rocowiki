// SPDX-License-Identifier: GPL-3.0-only
import { execFileSync } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { selectUpdateTasks, updateTasks } from './tasks';

const { values } = parseArgs({ options: {
  only: { type: 'string' }, schedule: { type: 'string' },
  plan: { type: 'boolean' }, changes: { type: 'boolean' }, validate: { type: 'boolean' },
} });
if ([values.plan, values.changes, values.validate].filter(Boolean).length > 1) throw new Error('Choose one update operation');
if (process.env.GITHUB_EVENT_NAME === 'schedule' && !values.schedule && !process.env.UPDATE_SCHEDULE) throw new Error('Scheduled update is missing its trigger cron');
const tasks = selectUpdateTasks(updateTasks, {
  schedule: values.schedule ?? (process.env.GITHUB_EVENT_NAME === 'schedule' ? process.env.UPDATE_SCHEDULE : undefined),
  only: values.only ?? process.env.UPDATE_TARGET,
});
async function output(name: string, value: string) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
const files = tasks.flatMap(task => task.files);
if (values.plan) {
  console.log(JSON.stringify(tasks.map(({ id, schedules, files }) => ({ id, schedules, files })), null, 2));
  await output('has_tasks', String(tasks.length > 0));
} else if (values.changes) {
  const changed = files.length ? execFileSync('git', ['diff', '--name-only', 'HEAD', '--', ...files], { encoding: 'utf8' }).trim() : '';
  await output('changed', String(Boolean(changed)));
  console.log(changed || 'Selected update data is unchanged.');
} else if (values.validate) {
  if (tasks.length) execFileSync('npx', ['vitest', 'run', ...new Set([...tasks.flatMap(task => task.tests), 'tests/official-pet-refresh.test.ts', 'tests/data-updates.test.ts'])], { stdio: 'inherit' });
} else {
  for (const task of tasks) {
    console.log(`Updating ${task.id}: ${task.label}`);
    execFileSync(process.execPath, ['--import', 'tsx', task.script], { stdio: 'inherit' });
  }
  if (!tasks.length) console.log('No update tasks match this schedule.');
}
