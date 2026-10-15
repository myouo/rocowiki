import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {productionApiConfig,productionApiSecrets,provisionApiDatabase,verifyApiRelease,verifyPasswordRuntime,obsoleteMailSecrets} from '../scripts/deploy-api';
import {app} from '../apps/api/src/index';
import {TestDatabase} from './d1';
const account='a'.repeat(32),id='11111111-1111-4111-8111-111111111111',sha='1'.repeat(40);
const database={name:'rocowiki-production',uuid:id};
const response=(result:unknown)=>new Response(JSON.stringify({success:true,result}));
const {load}=createRequire(import.meta.url)('js-yaml') as {load:(source:string)=>unknown};
it('maps valid production OAuth configuration names to the binding runtime without putting its secret into vars',async()=>{
  const workflow=load(readFileSync('.github/workflows/deploy-api.yml','utf8')) as {jobs:{deploy:{environment:string;steps:{run?:string;env?:Record<string,string>}[]}}};
  const job=workflow.jobs.deploy,step=job.steps.find(step=>step.run==='npm run deploy:api')!;
  expect(job.environment).toBe('production');
  for(const expression of Object.values(step.env!))expect(expression).not.toMatch(/(?:vars|secrets)\.GITHUB_/);
  const values={OAUTH_CLIENT_ID:'synthetic-client-id',OAUTH_CLIENT_SECRET:'synthetic-private-value'};
  const resolve=(expression:string)=>{
    const match=/^\$\{\{ (vars|secrets)\.(\w+) \}\}$/.exec(expression);
    expect(match).not.toBeNull();expect(match![2]).not.toMatch(/^GITHUB_/);
    expect(match![1]).toBe(match![2]==='OAUTH_CLIENT_ID'?'vars':'secrets');
    return values[match![2] as keyof typeof values];
  };
  const runtime={GITHUB_OAUTH_CLIENT_ID:resolve(step.env!.GITHUB_OAUTH_CLIENT_ID),GITHUB_OAUTH_CLIENT_SECRET:resolve(step.env!.GITHUB_OAUTH_CLIENT_SECRET)};
  const source=JSON.parse(readFileSync('apps/api/wrangler.jsonc','utf8'));
  const config=productionApiConfig(source,id,sha,runtime,'/tmp/wiki-source');
  const secrets=productionApiSecrets({...runtime,CLOUDFLARE_API_TOKEN:'synthetic-deployer-token'});
  expect(config.env.production.vars.GITHUB_OAUTH_CLIENT_ID).toBe(values.OAUTH_CLIENT_ID);
  expect(secrets.GITHUB_OAUTH_CLIENT_SECRET).toBe(values.OAUTH_CLIENT_SECRET);
  expect(secrets).not.toHaveProperty('GITHUB_OAUTH_CLIENT_ID');
  expect(secrets).not.toHaveProperty('CLOUDFLARE_API_TOKEN');
  expect(JSON.stringify(config)).not.toContain(values.OAUTH_CLIENT_SECRET);
  const db=new TestDatabase();
  try {
    const env=db.env({...config.env.production.vars,...secrets});
    expect(await(await app.request('https://api.wiki.rocoai.app/health',{},env)).json()).toMatchObject({github_binding_available:true});
  } finally {db.close();}
});
it('removes retired mail credentials and omitted Resend keys while preserving unrelated secrets',()=>{
  const secrets=['BREVO_API_KEY','RESEND_API_KEY','DEPLOY_WEBHOOK_SECRET','GITHUB_APP_PRIVATE_KEY'].map(name=>({name,type:'secret_text'}));
  expect(obsoleteMailSecrets(secrets,{RESEND_API_KEY:'synthetic-key'})).toEqual(['BREVO_API_KEY']);
  expect(obsoleteMailSecrets(secrets,{})).toEqual(['BREVO_API_KEY','RESEND_API_KEY']);
  expect(obsoleteMailSecrets(secrets,{RESEND_API_KEY:' '})).toEqual(['BREVO_API_KEY','RESEND_API_KEY']);
  expect(()=>obsoleteMailSecrets({success:false},{})).toThrow();
});
it('creates only the named Wiki database after a valid empty lookup',async()=>{
  const methods:string[]=[];
  const http:typeof fetch=async(input,options)=>{
    methods.push(options?.method||'GET');
    if(methods.length===1){expect(String(input)).toContain('name=rocowiki-production');return response([{name:'other-database',uuid:'other'}]);}
    expect(String(input)).toBe(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database`);
    expect(JSON.parse(String(options?.body))).toEqual({name:'rocowiki-production',primary_location_hint:'apac'});
    return response(database);
  };
  expect(await provisionApiDatabase(account,'fixture-token',undefined,http)).toEqual(database);
  expect(methods).toEqual(['GET','POST']);
});
it('requires real Worker password failures, rather than accepting a successful health response as proof',async()=>{
  const db=new TestDatabase();let count=0;
  try{
    const env=db.env({WEB_ORIGIN:'https://wiki.rocoai.app'});
    await verifyPasswordRuntime(async(input,options)=>{count++;const body=JSON.parse(String(options?.body));expect(body.identifier.length).toBeGreaterThan(24);expect(body.identifier).not.toContain('@');return app.fetch(new Request(input,options),env);});
    expect(count).toBe(3);expect(db.sql.prepare('SELECT count(*) AS n FROM users').get()!.n).toBe(0);
    await expect(verifyPasswordRuntime(async()=>Response.json({status:'ok'}))).rejects.toThrow('PASSWORD_RUNTIME_CHECK_FAILED (HTTP_200)');
    await expect(verifyPasswordRuntime(async()=>new Response('Worker exceeded CPU limits',{status:500}))).rejects.toThrow('PASSWORD_RUNTIME_CHECK_FAILED (HTTP_500)');
  }finally{db.close();}
});
it('reuses the existing Wiki database without writes',async()=>{
  let calls=0;
  const http:typeof fetch=async(_input,options)=>{calls++;expect(options?.method).toBe('GET');return response([database]);};
  expect(await provisionApiDatabase(account,'fixture-token',id,http)).toEqual(database);expect(calls).toBe(1);
});
it('does not create an empty replacement when a pinned database is missing or mismatched',async()=>{
  await expect(provisionApiDatabase(account,'fixture-token',id,async(_input,options)=>{expect(options?.method).toBe('GET');return response([]);})).rejects.toThrow('PRODUCTION_DATABASE_MISSING');
  await expect(provisionApiDatabase(account,'fixture-token','22222222-2222-4222-8222-222222222222',async()=>response([database]))).rejects.toThrow('PRODUCTION_DATABASE_ID_MISMATCH');
});
it('rejects permission errors and ambiguous lookup responses before database creation',async()=>{
  const http:typeof fetch=async(_input,options)=>{expect(options?.method).toBe('GET');return new Response(JSON.stringify({success:false,errors:[{message:'fixture-token'}]}),{status:403});};
  await expect(provisionApiDatabase(account,'fixture-token',undefined,http)).rejects.toThrow('D1_API_FAILED (403): Account D1 Edit');
  await expect(provisionApiDatabase(account,'fixture-token',undefined,async()=>response([database,database]))).rejects.toThrow('DUPLICATE_PRODUCTION_DATABASE');
  await expect(provisionApiDatabase(account,'fixture-token',undefined,async()=>response(null))).rejects.toThrow('INVALID_D1_LIST_RESPONSE');
});
it('builds an isolated runtime configuration without secrets or changes to the source',()=>{
  const source=JSON.parse(readFileSync('apps/api/wrangler.jsonc','utf8')),original=JSON.stringify(source);
  const config=productionApiConfig(source,id,sha,{OIDC_CLIENT_ID:'public-id',OIDC_CLIENT_SECRET:'private-fixture'},'/tmp/wiki-source');
  expect(JSON.stringify(source)).toBe(original);
  expect(config.main).toBe('/tmp/wiki-source/apps/api/src/index.ts');
  expect(config.env.production.d1_databases[0]).toMatchObject({database_id:id,migrations_dir:'/tmp/wiki-source/database/migrations'});
  expect(config.env.production.vars).toMatchObject({OIDC_CLIENT_ID:'public-id',API_SOURCE_COMMIT_SHA:sha,SUBMISSIONS_ENABLED:'false',PUBLISH_ENABLED:'false'});
  expect(JSON.stringify(config)).not.toContain('private-fixture');expect(config.env.production.routes).toEqual([]);
  source.env.production.vars.PUBLISH_ENABLED='true';expect(()=>productionApiConfig(source,id,sha)).toThrow('API_BOOTSTRAP_REQUIRES_CLOSED_CONTRIBUTIONS');
});
it('uses the selected Resend sender while keeping missing credentials from enabling registration',async()=>{
  const source=JSON.parse(readFileSync('apps/api/wrangler.jsonc','utf8'));
  const config=productionApiConfig(source,id,sha,{},'/tmp/wiki-source');
  expect(config.env.production.vars).toMatchObject({MAIL_PROVIDER:'resend',MAIL_FROM:'noreply@wiki.rocoai.app',EMAIL_VERIFICATION_REQUIRED:'true'});
  expect(JSON.stringify(config)).not.toContain('RESEND_API_KEY');
  const db=new TestDatabase();
  try{
    for(const key of [undefined,'synthetic-resend-key']){
      const env=db.env({...config.env.production.vars,...(key?{RESEND_API_KEY:key}:{})});
      const response=await app.request('https://api.wiki.rocoai.app/health',{},env);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({registration_enabled:Boolean(key),password_reset_available:Boolean(key),email_verification_required:true,submissions:false,publishing:false});
    }
  }finally{db.close();}
});
it('does not accept a stale API release or open contribution endpoints as a bootstrap success',async()=>{
  let calls=0;
  const direct:typeof fetch=async(_input,options)=>{expect(options?.cache).toBe('no-store');return Response.json(++calls===1?{status:'ok',source_commit_sha:'old',submissions:false,publishing:false}:{status:'ok',source_commit_sha:sha,submissions:false,publishing:false});};
  await verifyApiRelease(sha,direct,async()=>{},2);expect(calls).toBe(2);
  await expect(verifyApiRelease(sha,async()=>Response.json({status:'ok',source_commit_sha:sha,submissions:true,publishing:false}),async()=>{},1)).rejects.toThrow('API_RELEASE_MISMATCH');
});
it('reports bootstrap readiness through the real API after its D1 rate-limit write',async()=>{
  const db=new TestDatabase();
  try{
    const result=await app.request('http://localhost:8787/health',{},db.env({API_SOURCE_COMMIT_SHA:sha,SUBMISSIONS_ENABLED:'false',PUBLISH_ENABLED:'false'}));
    expect(result.status).toBe(200);expect(await result.json()).toMatchObject({status:'ok',registration:'password',authentication_configured:true,registration_enabled:false,submissions:false,publishing:false,source_commit_sha:sha});
    expect(db.sql.prepare('SELECT count(*) AS n FROM rate_limits').get()!.n).toBe(1);
  }finally{db.close();}
});
