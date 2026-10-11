import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {branchViolation,pathViolation,secretViolation,policyViolations}=require('../scripts/check-repository.cjs');
const {load}=require('js-yaml');
it('rejects prohibited branch tokens without restricting legitimate publisher or development branches',()=>{
  for(const name of ['fix/agent-login','docs/AGENT-rules','feat/myagent'])expect(branchViolation(name)).not.toBeNull();
  for(const name of ['main','fix/auth-time','docs/governance','wiki/rev_123'])expect(branchViolation(name)).toBeNull();
});
it('allows public examples and migrations but rejects credential files and generated artifacts',()=>{
  for(const file of ['apps/api/.dev.vars','.env.local','private.pem','data.sqlite-wal','id_ed25519','backups/export.sql','apps/web/src/generated/search.json','apps/web/build/index.html'])expect(pathViolation(file)).not.toBeNull();
  for(const file of ['apps/api/.dev.vars.example','.env.example','database/migrations/0005_reconciliation_record_errors.sql','LICENSE','licenses/third-party/react/LICENSE','CONTRIBUTING.md'])expect(pathViolation(file)).toBeNull();
});
it('detects literal private keys and GitHub credentials without exposing them in diagnostics',()=>{
  const credential='ghp_'+'a'.repeat(36),privateKey=['-----BEGIN '+'PRIVATE KEY-----','A'.repeat(60),'-----END '+'PRIVATE KEY-----'].join('\n');
  expect(secretViolation(credential)).toBe('possible GitHub credential');
  expect(secretViolation(privateKey)).toBe('embedded private key');
  expect(secretViolation(credential)).not.toContain(credential);
  expect(secretViolation('OIDC_CLIENT_SECRET=\nconst example = "test-secret";')).toBeNull();
});
it('fails policy revision, language and topic drift instead of accepting a missing translation',()=>{
  const policy={id:'security',version:1,sections:['reporting','boundaries']};
  const text='<!-- rocowiki-policy: security; version: 1; lang: en -->\n<a id="reporting"></a>\n<a id="boundaries"></a>\n';
  expect(policyViolations(text,policy,'en')).toEqual([]);
  expect(policyViolations(text.replace('version: 1','version: 2'),policy,'en')).not.toEqual([]);
  expect(policyViolations(text,policy,'zh-CN')).not.toEqual([]);
  expect(policyViolations(text.replace('<a id="boundaries"></a>',''),policy,'en')).not.toEqual([]);
});
it('keeps bilingual issue forms valid and does not route public bugs to a fabricated security address',()=>{
  for(const name of ['bug_report','feature_request','content_correction','support']){
    const form=load(readFileSync(`.github/ISSUE_TEMPLATE/${name}.yml`,'utf8'));
    expect(form.name).toContain(' / ');expect(form.description).toContain(' / ');
    const ids=form.body.filter((field:{id?:string})=>field.id).map((field:{id:string})=>field.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(form.body.every((field:{type:string})=>['markdown','input','textarea','checkboxes'].includes(field.type))).toBe(true);
  }
  expect(load(readFileSync('.github/ISSUE_TEMPLATE/config.yml','utf8')).contact_links).toBeUndefined();
});
it('runs repository policy checks in the normal validation and production artifact paths',()=>{
  const pkg=JSON.parse(readFileSync('package.json','utf8'));
  expect(pkg.scripts.check).toMatch(/^npm run check:repository &&/);
  const deploy=load(readFileSync('.github/workflows/deploy.yml','utf8'));
  expect(deploy.jobs.build.steps.some((step:{run?:string})=>step.run==='npm run check:repository')).toBe(true);
});
