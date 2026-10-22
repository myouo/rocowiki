// SPDX-License-Identifier: GPL-3.0-only
import {describe, expect, it} from 'vitest';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {canDeployRevision, classifyChanges, eventBase, planChanges} from '../scripts/ci/plan';
import {affectedCatalogRoutes, type Snapshots} from '../scripts/ci/content-routes';
const {load} = createRequire(import.meta.url)('js-yaml');
const workflow = load(readFileSync('.github/workflows/validate.yml', 'utf8'));
const deployment = load(readFileSync('.github/workflows/deploy.yml', 'utf8'));

describe('CI scope', () => {
  it.each([
    [['CONTRIBUTING.md', 'CONTRIBUTING.en.md', 'docs/policies.json'], 'docs'],
    [['.github/ISSUE_TEMPLATE/bug_report.yml'], 'docs'],
    [['apps/api/src/index.ts', 'README.md', 'database/migrations/0042_example.sql'], 'api'],
    [['content/guides/example.md', 'content/metadata/example.json'], 'content'],
    [['apps/web/content/official-pets.json', 'apps/web/content/published-sections-v7.json'], 'content'],
    [['apps/web/content/official-pets.json', 'apps/api/src/index.ts'], 'full'],
    [['apps/web/docs/help/example.md'], 'full'],
    [['apps/web/content/routes.json'], 'full'],
    [['content/catalog.json'], 'full'],
    [['content/policy.json'], 'full'],
    [['package-lock.json'], 'full'],
    [['.github/workflows/validate.yml'], 'full'],
    [['scripts/ci/plan.ts'], 'full'],
    [['packages/auth/src/index.ts'], 'full'],
    [['apps/web/src/wiki/WikiPage.jsx'], 'full'],
    [['COPYRIGHT.md'], 'full'],
    [['unmapped-new-input.json'], 'full'],
  ])('classifies %j as %s', (files, scope) => expect(classifyChanges(files as string[])).toBe(scope));

  it('includes deletions, renames and every path in multi-commit pushes, and fails closed without a base', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'wiki-ci-scope-'));
    const git = (...args: string[]) => execFileSync('git', args, {cwd:dir, encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim();
    const commit = () => {git('add', '-A'); git('-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','fixture'); return git('rev-parse','HEAD');};
    try {
      git('init','-q','-b','main');
      mkdirSync(path.join(dir,'apps/web/src'), {recursive:true});
      writeFileSync(path.join(dir,'apps/web/src/page.ts'), 'export const value=1;');
      writeFileSync(path.join(dir,'README.md'), 'base');
      const base = commit();
      renameSync(path.join(dir,'apps/web/src/page.ts'),path.join(dir,'CONTRIBUTING.md'));
      const renamed = commit();
      expect(planChanges(dir,base).files).toEqual(expect.arrayContaining(['apps/web/src/page.ts','CONTRIBUTING.md']));
      expect(planChanges(dir,base).scope).toBe('full');
      writeFileSync(path.join(dir,'README.md'), 'new docs'); const docs = commit();
      expect(planChanges(dir,renamed).scope).toBe('docs');
      expect(planChanges(dir,base).scope).toBe('full');
      expect(planChanges(dir,null).scope).toBe('full');
      expect(planChanges(dir,'f'.repeat(40)).scope).toBe('full');
      expect(planChanges(dir,docs,'HEAD',true).scope).toBe('full');
      expect(canDeployRevision(dir,renamed,docs)).toBe(true);
      expect(canDeployRevision(dir,base,docs)).toBe(false);
      expect(() => canDeployRevision(dir,docs,base)).toThrow();
      writeFileSync(path.join(dir,'new-input.json'),'{}');
      const local=JSON.parse(execFileSync(process.execPath,[path.resolve('scripts/ci/plan.ts'),'--base','HEAD'],{
        cwd:dir,encoding:'utf8',env:{...process.env,GITHUB_ACTIONS:'false',GITHUB_EVENT_PATH:'',GITHUB_OUTPUT:'',GITHUB_STEP_SUMMARY:'',CI_FULL:''},
      }));
      expect(local.scope).toBe('full');expect(local.files).toContain('new-input.json');
    } finally {rmSync(dir,{recursive:true,force:true});}
  });

  it('uses the tested merge base on PRs and the complete previous push head', () => {
    expect(eventBase('.', 'pull_request', {pull_request:{base:{sha:'a'.repeat(40)}}})).toBe('a'.repeat(40));
    expect(eventBase('.', 'push', {before:'b'.repeat(40)})).toBe('b'.repeat(40));
    expect(eventBase('.', 'push', {before:'0'.repeat(40)})).toBeNull();
    expect(eventBase('.', 'pull_request', {})).toBeNull();
  });
});

describe('content impact', () => {
  const snapshot = (): Snapshots => ({
    'official-pets.json':{pets:[1,2,3,4,5,6,7].map(id=>({id,name:`pet-${id}`}))},
    'official-skills.json':{skills:[10,20,30,40,50,60,70].map(id=>({id,name:`skill-${id}`}))},
    'pet-skill-relations.json':{pets:{2:{skills:[{skillId:20}]},3:{skills:[{skillId:20}]}}},
    'game-skill-relations.json':{pets:{6:{skills:[{skillId:60}]}}},
  });
  it('renders every learner of a changed skill, including old relations', () => {
    const before=snapshot(),after=snapshot();
    after['official-skills.json'].skills[1].name='changed';
    delete after['pet-skill-relations.json'].pets[3];
    const routes=affectedCatalogRoutes(before,after,['apps/web/content/official-skills.json']);
    for(const route of ['/skills/20/','/pets/2/','/pets/3/'])expect(routes.has(route)).toBe(true);
    expect(routes.has('/pets/5/')).toBe(false);
  });
  it('includes both skill pages when a pet switches learning relations', () => {
    const before=snapshot(),after=snapshot();
    after['pet-skill-relations.json'].pets[2].skills=[{skillId:50}];
    const routes=affectedCatalogRoutes(before,after,['apps/web/content/pet-skill-relations.json']);
    for(const route of ['/pets/2/','/pets/3/','/skills/20/','/skills/50/'])expect(routes.has(route)).toBe(true);
  });
  it('tracks new IDs, game pools, analysis and ladder changes and falls back to all for unmapped dependencies', () => {
    const before=snapshot(),after=snapshot();
    after['official-pets.json'].pets.push({id:8,name:'new'});
    after['official-pets.json'].pets[5].name='changed';
    let routes=affectedCatalogRoutes(before,after,['apps/web/content/official-pets.json']);
    expect(routes.has('/pets/8/')).toBe(true);expect(routes.has('/skills/60/')).toBe(true);
    after['skill-analyses.json']={records:[{skillId:20,name:'analysis'}]};
    routes=affectedCatalogRoutes(before,after,['apps/web/content/skill-analyses.json']);
    expect(routes.has('/pets/2/')).toBe(true);
    after['official-ladder.json']={defaultCost:1,costs:{5:4},bannedPetIds:[6]};
    before['official-ladder.json']={defaultCost:1,costs:{},bannedPetIds:[]};
    routes=affectedCatalogRoutes(before,after,['apps/web/content/official-ladder.json']);
    expect(routes.has('/pets/5/')).toBe(true);expect(routes.has('/pets/6/')).toBe(true);
    expect(affectedCatalogRoutes(before,after,['apps/web/content/new-source.json']).size).toBe(15);
  });
});

describe('workflow gates', () => {
  it('always reports validate and rejects failed, cancelled, skipped or missing prerequisites', () => {
    const gate=workflow.jobs.validate;
    expect(gate.if).toBe('always()');
    expect(gate.needs).toEqual(['plan','content-boundary','checks']);
    const run=(results: object)=>spawnSync('sh',['-c',gate.steps[0].run],{env:{...process.env,RESULTS:JSON.stringify(results)}}).status;
    const success=Object.fromEntries(gate.needs.map((name: string)=>[name,{result:'success',outputs:{scope:'full'}}]));
    expect(run(success)).toBe(0);
    for(const name of gate.needs)for(const result of ['failure','cancelled','skipped'])expect(run({...success,[name]:{result}})).toBe(1);
    expect(run({})).toBe(1);
    expect(run({...success,plan:{result:'success',outputs:{scope:'unknown'}}})).toBe(1);
    expect(workflow.on.pull_request?.paths).toBeUndefined();
  });
  it('builds once for shared changes and publications, with no production access on PRs or branch dispatches', () => {
    // These workflow conditions deliberately use only boolean expressions, with
    // the same typed string/boolean operands in JavaScript and Actions.
    const evaluate=(expression: string, scope: string, event: string, ref: string, deploy: boolean)=>
      new Function('needs','github','inputs',`return Boolean(${expression})`)({plan:{outputs:{scope,web:String(['content','full'].includes(scope))}}},{event_name:event,ref},{deploy});
    const build=workflow.jobs.checks.steps.find((step: any)=>step.run==='npm run build');
    for(const scope of ['docs','api','content','full'])for(const event of ['pull_request','push','workflow_dispatch'])for(const main of [false,true])for(const deploy of [false,true]) {
      // PRs are always tested on refs/pull; only main pushes are configured.
      if(event==='pull_request'&&main || event==='push'&&!main)continue;
      const ref=main?'refs/heads/main':event==='pull_request'?'refs/pull/42/merge':'refs/heads/chore/data';
      const publishing=evaluate(workflow.jobs.release.if,scope,event,ref,deploy);
      const testing=evaluate(build.if,scope,event,ref,deploy);
      const expectedPublishing=main && (event==='push'||deploy) && ['content','full'].includes(scope);
      expect(publishing).toBe(expectedPublishing);
      expect(Number(publishing)+Number(testing)).toBe(scope==='full'||expectedPublishing?1:0);
    }
  });
  it('preserves protected community tooling and has one validated production build path', () => {
    const boundary=workflow.jobs['content-boundary'];
    expect(boundary.steps[0].with.ref).toBe('${{ github.event.pull_request.base.sha }}');
    expect(boundary.steps.find((step: any)=>step.run?.includes('check-content-pr')).run).toContain('npm ci --ignore-scripts');
    expect(workflow.jobs.release.needs).toContain('validate');
    expect(workflow.jobs.release.uses).toBe('./.github/workflows/deploy.yml');
    expect(workflow.jobs.release.if).toContain("github.ref == 'refs/heads/main'");
    expect(Object.keys(deployment.on)).toEqual(['workflow_call']);
    expect(deployment.concurrency).toBeUndefined();
    expect(deployment.jobs.deploy.concurrency).toEqual({group:'production-wiki','cancel-in-progress':false});
    expect(deployment.jobs.build.steps.filter((step: any)=>step.run==='npm run build')).toHaveLength(1);
    expect(deployment.jobs.build.steps.some((step: any)=>step.run==='npm test')).toBe(false);
    expect(deployment.jobs.deploy.steps.find((step: any)=>step.run==='npm run deploy:web').if).toContain("steps.current.outputs.deploy == 'true'");
    expect(workflow.jobs.checks.steps.find((step: any)=>step.run==='npm run build').if).toContain("github.ref == 'refs/heads/main'");
    expect(workflow.jobs.checks.environment).toBeUndefined();
    expect(workflow.concurrency['cancel-in-progress']).toBe("${{ github.event_name == 'pull_request' }}");
  });
});
