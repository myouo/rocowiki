// SPDX-License-Identifier: GPL-3.0-only
import { execFileSync } from 'node:child_process';
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { selectUpdateTasks, updateTasks } from './tasks';
import { downloadSource } from './download';

const { values } = parseArgs({ options: {
  only: { type: 'string' }, schedule: { type: 'string' },
  plan: { type: 'boolean' }, changes: { type: 'boolean' }, validate: { type: 'boolean' },
} });
if ([values.plan, values.changes, values.validate].filter(Boolean).length > 1) throw new Error('Choose one update operation');
if (process.env.GITHUB_EVENT_NAME === 'schedule' && !values.schedule && !process.env.UPDATE_SCHEDULE) throw new Error('Scheduled update is missing its trigger cron');
const tasks = selectUpdateTasks(updateTasks, {
  schedule: values.schedule ?? (process.env.GITHUB_EVENT_NAME === 'schedule' ? process.env.UPDATE_SCHEDULE : undefined),
  only: values.only ?? process.env.UPDATE_TARGET,
}, process.env);
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
  const inputs = new Map<string, { path: string; retrievedAt: string }>();
  const directory = tasks.some(task => task.input) ? await mkdtemp(join(tmpdir(), 'rocowiki-update-')) : null;
  try {
    for (const task of tasks) {
      const args = ['--import', 'tsx', task.script];
      if (task.input && directory) {
        let input = inputs.get(task.input.url);
        if (!input) {
          const peers = tasks.filter(peer => peer.input?.url === task.input!.url);
          console.log(`Downloading shared source for ${peers.map(peer => peer.id).join(', ')}: ${task.input.url}`);
          const bytes = await downloadSource({ url: task.input.url, maxBytes: Math.min(...peers.map(peer => peer.input!.maxBytes)) });
          input = { path: join(directory, `${inputs.size}.bin`), retrievedAt: new Date().toISOString() };
          await writeFile(input.path, bytes); inputs.set(task.input.url, input);
        }
        args.push('--input', input.path, '--retrieved-at', input.retrievedAt);
      }
      console.log(`Updating ${task.id}: ${task.label}`);
      execFileSync(process.execPath, args, { stdio: 'inherit' });
    }
  } finally { if (directory) await rm(directory, { recursive: true, force: true }); }
  if (!tasks.length) console.log('No update tasks match this schedule.');
}
