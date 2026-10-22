// SPDX-License-Identifier: GPL-3.0-only
import {execFileSync} from 'node:child_process';
import {appendFileSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export type Scope = 'docs' | 'api' | 'content' | 'full';
export interface ChangePlan {scope: Scope; files: string[]; base: string | null; head: string; reason: string}
export interface WorkflowEvent {before?: string; pull_request?: {base?: {sha?: string}}}
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, {cwd, encoding:'utf8', stdio:['ignore','pipe','pipe'], maxBuffer:32 * 1024 * 1024});

export function fileScope(file: string): Scope {
  // Only explicitly non-runtime documents get the documentation-only path.
  // Copyright changes require site review. Native MD/MDX can execute components.
  if (/^(?:README|AGENTS|CONTRIBUTING|GOVERNANCE|SECURITY|SUPPORT|CODE_OF_CONDUCT|THIRD_PARTY_NOTICES)(?:\.en)?\.md$/.test(file)
    || file === 'docs/policies.json' || file === 'docs/license-inventory.json'
    || /^\.github\/(?:ISSUE_TEMPLATE\/[^/]+\.yml|PULL_REQUEST_TEMPLATE\.md|CODEOWNERS(?:\.example)?)$/.test(file)) return 'docs';
  if (/^apps\/api\//.test(file) || /^database\/migrations\/[^/]+\.sql$/.test(file)) return 'api';
  if (/^apps\/web\/content\/[^/]+\.json$/.test(file) && file !== 'apps/web/content/routes.json') return 'content';
  if (/^content\/(?:metadata\/[^/]+\.json|data\/[^/]+\/[^/]+\.json|[^/]+\/[^/]+\.md)$/.test(file)) return 'content';
  return 'full';
}

export function classifyChanges(files: readonly string[]): Scope {
  const scopes = new Set(files.map(fileScope));
  scopes.delete('docs');
  if (!scopes.size) return 'docs';
  if (scopes.size !== 1 || scopes.has('full')) return 'full';
  return [...scopes][0];
}

export function planChanges(cwd: string, base: string | null, head = 'HEAD', force = false): ChangePlan {
  const sha = git(cwd, 'rev-parse', '--verify', `${head}^{commit}`).trim();
  if (force || !base) return {scope:'full', files:[], base:null, head:sha, reason:force ? 'Full validation requested' : 'No reliable comparison base'};
  try {
    const baseSha = git(cwd, 'rev-parse', '--verify', `${base}^{commit}`).trim();
    // No rename detection: both the old and new path must influence the scope.
    const files = git(cwd, 'diff', '--no-renames', '--name-only', '-z', baseSha, sha).split('\0').filter(Boolean);
    return {scope:classifyChanges(files), files, base:baseSha, head:sha, reason:'Classified every changed path'};
  } catch {
    return {scope:'full', files:[], base:null, head:sha, reason:'Comparison unavailable; using full validation'};
  }
}

export function eventBase(cwd: string, eventName: string, event: WorkflowEvent): string | null {
  if (eventName === 'push') return typeof event.before === 'string' && /^[a-f0-9]{40}$/.test(event.before) && !/^0+$/.test(event.before) ? event.before : null;
  if (eventName === 'pull_request') {
    const sha = event.pull_request?.base?.sha;
    if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/.test(sha)) return null;
    // Compare the tested merge tree to its base; include interactions with main.
    return sha;
  }
  if (eventName === 'workflow_dispatch' && process.env.GITHUB_REF !== 'refs/heads/main') {
    try { return git(cwd, 'merge-base', 'origin/main', 'HEAD').trim(); } catch { return null; }
  }
  return null;
}

export function canDeployRevision(cwd: string, candidate: string, latest: string): boolean {
  // A force-pushed/divergent branch must fail closed, never roll production back.
  git(cwd, 'merge-base', '--is-ancestor', candidate, latest);
  return ['docs', 'api'].includes(planChanges(cwd, candidate, latest).scope);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.includes('--deployment')) {
    git(process.cwd(), 'fetch', 'origin', 'main');
    const latest = git(process.cwd(), 'rev-parse', 'FETCH_HEAD').trim();
    const deploy = canDeployRevision(process.cwd(), 'HEAD', latest);
    if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required');
    appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${deploy}\n`);
    console.log(deploy ? 'This revision still represents the current website.' : 'A newer main revision changes the website; skipping this obsolete artifact.');
  } else {
    const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
    const baseArg = process.argv.indexOf('--base');
    const base = baseArg >= 0 ? process.argv[baseArg + 1] : eventBase(process.cwd(), process.env.GITHUB_EVENT_NAME || '', event);
    const force = process.argv.includes('--full') || process.env.CI_FULL === 'true';
    const plan = planChanges(process.cwd(), base, 'HEAD', force);
    if (process.env.GITHUB_ACTIONS !== 'true' && plan.base && !force) {
      const dirty = git(process.cwd(), 'diff', '--no-renames', '--name-only', '-z', 'HEAD').split('\0').filter(Boolean);
      const untracked = git(process.cwd(), 'ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean);
      plan.files = [...new Set([...plan.files, ...dirty, ...untracked])].sort();
      plan.scope = classifyChanges(plan.files);
      plan.reason += ', including local uncommitted files';
    }
    const web = ['content', 'full'].includes(plan.scope);
    console.log(JSON.stringify(plan, null, 2));
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `scope=${plan.scope}\nweb=${web}\nbase=${plan.base || ''}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Validation scope: ${plan.scope}\n\n${plan.reason}. ${plan.files.length} changed paths.\n\nFull builds run for shared code, native MD/MDX, routing, dependencies and unknown paths. Production assets are built once after validation.\n`);
  }
}
