import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {load}=require('js-yaml');
const env={NODE_ENV:'production',API_ORIGIN:'https://api.rocowiki.test',SITE_URL:'https://wiki.rocowiki.test'};
function config(overrides:Record<string,string|undefined>={},entry='../apps/web/docusaurus.config.js') {
  const next={...env,...overrides},previous:Record<string,string|undefined>={};
  for(const [key,value] of Object.entries(next)){previous[key]=process.env[key];if(value===undefined)delete process.env[key];else process.env[key]=value;}
  const file=require.resolve(entry);delete require.cache[file];
  try {
    const c=require(file);
    return {status:0,stderr:'',stdout:JSON.stringify({url:c.url,apiOrigin:c.customFields.apiOrigin,mode:c.customFields.workspaceMode})};
  } catch(error) {return {status:1,stderr:String(error),stdout:''};}
  finally {delete require.cache[file];for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}
it.each(['API_ORIGIN','SITE_URL'])('fails a real production config load if %s is absent',key=>{
  const result=config({[key]:'',WIKI_URL:'https://fallback.test'});
  expect(result.status).not.toBe(0);expect(result.stderr).toContain(`Missing production configuration: ${key}`);
});
it.each(['http://api.test','https://user:password@api.test','https://api.test/path','https://api.test?x=1','https://api.test#hash',' https://api.test'])('rejects an invalid production API origin: %s',API_ORIGIN=>{
  expect(config({API_ORIGIN}).status).not.toBe(0);
});
it('embeds explicit production origins with no fallback',()=>{
  const result=config({API_ORIGIN:env.API_ORIGIN+'/',SITE_URL:env.SITE_URL+'/'});
  expect(result.status).toBe(0);expect(JSON.parse(result.stdout)).toEqual({url:env.SITE_URL,apiOrigin:env.API_ORIGIN,mode:'server'});
});
it('keeps development defaults usable without production configuration',()=>{
  const result=config({NODE_ENV:'development',API_ORIGIN:'',SITE_URL:'',WIKI_URL:''});
  expect(result.status).toBe(0);expect(JSON.parse(result.stdout).apiOrigin).toBe('http://localhost:8787');
});
it('preflights production configuration before any native build work',()=>{
  const result=config({SITE_URL:'',API_ORIGIN:''},'../scripts/check-production-config.cjs');
  expect(result.status).not.toBe(0);expect(result.stderr).toContain('Missing production configuration');
  const pkg=JSON.parse(readFileSync('package.json','utf8'));
  expect(pkg.scripts.build).toMatch(/^npm run check:production-config &&/);
});
it('puts artifact build and deploy in the same production environment with step-scoped variables',()=>{
  const workflow=load(readFileSync('.github/workflows/deploy.yml','utf8'));
  expect(workflow.jobs.build.environment).toBe('production');expect(workflow.jobs.deploy.environment).toBe('production');
  const build=workflow.jobs.build.steps.find((step:{run?:string})=>step.run==='npm run build');
  expect(build.env).toMatchObject({API_ORIGIN:'${{ vars.API_ORIGIN }}',SITE_URL:'${{ vars.SITE_URL }}',WIKI_WORKSPACE_MODE:'server'});
  expect(workflow.jobs.build.if).toBe("github.ref == 'refs/heads/main'");
  const validate=load(readFileSync('.github/workflows/validate.yml','utf8')).jobs.validate;
  expect(validate.environment).toBeUndefined();
  expect(validate.steps.find((step:{run?:string})=>step.run==='npm run check').env).toMatchObject({API_ORIGIN:env.API_ORIGIN,SITE_URL:env.SITE_URL});
});
it('evaluates optional mirror configuration inside the activated production job',()=>{
  const job=load(readFileSync('.github/workflows/mirror.yml','utf8')).jobs.observe;
  expect(job.environment).toBe('production');expect(job.if).toBeUndefined();
  const gate=job.steps.find((step:{id?:string})=>step.id==='mirror-config');
  expect(gate.env.GITCODE_REMOTE_URL).toBe('${{ vars.GITCODE_REMOTE_URL }}');
  expect(gate.run).toContain('[ -n "$GITCODE_REMOTE_URL" ]');
  expect(gate.run).toContain('enabled=true');expect(gate.run).toContain('enabled=false');
  const observe=job.steps.find((step:{run?:string})=>step.run==='node scripts/check-mirror.mjs');
  expect(observe.if).toBe("steps.mirror-config.outputs.enabled == 'true'");
  expect(job.steps.indexOf(gate)).toBeLessThan(job.steps.indexOf(observe));
});
