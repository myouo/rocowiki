const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const esbuild=require('esbuild');
const {JSDOM,VirtualConsole}=require('jsdom');
const React=require('react');
const {act}=React;
const project=path.resolve(__dirname,'..'),repo=path.resolve(project,'../..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rocowiki-workbench-'));
const original={fetch:global.fetch,setTimeout:global.setTimeout,error:console.error,navigator:Object.getOwnPropertyDescriptor(global,'navigator')};
let dom,root,db;
const checks=[],errors=[],requests=[];
const pause=time=>new Promise(resolve=>original.setTimeout(resolve,time??25));
function check(name,value){checks.push(name);assert.ok(value,name);}
async function main(){
  process.chdir(repo);
  await esbuild.build({
    stdin:{resolveDir:repo,loader:'tsx',contents:`
      export {default as Workbench} from './apps/web/src/pages/workbench';
      export {app} from './apps/api/src/index';
      export {TestDatabase} from './tests/d1';
      export {newId,now,createSession} from './packages/auth/src/index';
      export {hashPassword} from './packages/auth/src/password';
      export {GitHub} from './packages/git-wrapper/src/index';
    `},outfile:path.join(temp,'app.cjs'),bundle:true,format:'cjs',platform:'node',loader:{'.css':'empty'},logLevel:'silent',plugins:[{
      name:'workbench-framework',setup(build){
        build.onResolve({filter:/^(react|react-dom|lucide-react)(\/.*)?$/},args=>({path:require.resolve(args.path,{paths:[project]}),external:true}));
        build.onResolve({filter:/^(@docusaurus\/|@theme\/)/},args=>({path:args.path,namespace:'framework'}));
        build.onLoad({filter:/.*/,namespace:'framework'},args=>({loader:'jsx',resolveDir:repo,contents:
          args.path.endsWith('/useDocusaurusContext')?`export default function(){return {siteConfig:{customFields:{apiOrigin:'https://api.wiki.test'}}}};`:
          args.path.endsWith('/router')?`export function useLocation(){return {pathname:window.location.pathname,search:window.location.search}};`:
          args.path.endsWith('/Layout')?`import React from 'react';export default function({children}){return <main>{children}</main>}`:
          `import React from 'react';export default function({to,children,...props}){return <a href={to} {...props}>{children}</a>}`
        }));
      }
    }]});
  const virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError',error=>{
    errors.push(error.message);
  });
  dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://wiki.test/workbench/',pretendToBeVisual:true,virtualConsole});
  const w=dom.window,d=w.document;
  Object.assign(global,{window:w,document:d,HTMLElement:w.HTMLElement,Node:w.Node,Event:w.Event,IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(global,'navigator',{configurable:true,value:w.navigator});
  console.error=(...args)=>errors.push(args.map(String).join(' '));
  // Exercise the real controller's 30-second timeout using a shorter test clock.
  global.setTimeout=(callback,time,...args)=>original.setTimeout(callback,time===30000?(d.querySelector('input[name="password"]')?2500:40):time,...args);
  const C=require(path.join(temp,'app.cjs'));
  db=new C.TestDatabase();
  const env=db.env({WEB_ORIGIN:'https://wiki.test',API_ORIGIN:'https://api.wiki.test',MAIL_PROVIDER:'resend',MAIL_FROM:'accounts@example.test',RESEND_API_KEY:'fixture-mail-key'});
  const mail=[];
  const identities={};
  for(const role of ['contributor','reviewer','viewer']){
    const uid=C.newId('usr');
    db.sql.prepare('INSERT INTO users(uid,username,display_name,role,created_at) VALUES(?,?,?,?,?)').run(uid,role,role,role,C.now());
    db.sql.prepare('INSERT INTO password_credentials(uid,email,password_hash,email_verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(uid,`${role}@example.test`,await C.hashPassword('Fixture long password 2026!'),C.now(),C.now(),C.now());
    identities[role]={uid,...await C.createSession(env,uid,C.now())};
  }
  const base={commit_sha:'a'.repeat(40),blob_sha:'b'.repeat(40),content:'# Baseline'};
  C.GitHub.prototype.readPage=async()=>base;C.GitHub.prototype.contains=async()=>true;
  let current=null,lose=null;
  global.fetch=async(input,init={})=>{
    const url=new URL(String(input)),headers=new Headers(init.headers);
    if(url.origin==='https://api.resend.com'){const message=JSON.parse(init.body);mail.push(new URL(message.text.match(/https?:\/\/\S+/)[0]));return Response.json({id:'fixture-delivery'});}
    requests.push({path:url.pathname,method:init.method??'GET',key:headers.get('Idempotency-Key'),body:init.body,credentials:init.credentials});
    // Password login, sessions, drafts and decisions all use real API and SQL.
    headers.set('Origin',env.WEB_ORIGIN);
    if(current)headers.set('Cookie',`roco_session=${identities[current].token}`);
    const background=[];
    const response=await C.app.fetch(new Request(url,{...init,headers}),env,{waitUntil:p=>background.push(p),passThroughOnException(){},props:{}});
    await Promise.all(background);
    if(url.pathname==='/auth/login'&&response.ok){const token=/roco_session=([a-f0-9]{64})/.exec(response.headers.get('set-cookie'))[1];current='contributor';identities.contributor.token=token;}
    if((lose===url.pathname||lose==='draft'&&url.pathname.startsWith('/drafts/'))&&init.method!=='GET'){
      lose=null;init.signal.throwIfAborted();
      return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));
    }
    return response;
  };
  root=require('react-dom/client').createRoot(d.getElementById('root'));
  async function render(role,query=''){
    current=role;dom.reconfigure({url:`https://wiki.test/workbench/${query}`});
    await act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(C.Workbench,{key:role||'guest'})));await pause();});
    await act(async()=>await pause());
  }
  async function click(label){
    const button=[...d.querySelectorAll('button')].find(button=>button.textContent.trim()===label||button.querySelector('b')?.textContent===label);
    assert.ok(button,`Button exists: ${label}`);assert.equal(button.disabled,false,`Button enabled: ${label}`);
    await act(async()=>{button.click();await pause(60);});await act(async()=>await pause());
  }
  async function fill(selector,value){
    const node=d.querySelector(selector);assert.ok(node,`Field exists: ${selector}`);
    const prototype=node.tagName==='TEXTAREA'?w.HTMLTextAreaElement.prototype:node.tagName==='SELECT'?w.HTMLSelectElement.prototype:w.HTMLInputElement.prototype;
    await act(async()=>{Object.getOwnPropertyDescriptor(prototype,'value').set.call(node,value);node.dispatchEvent(new w.Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));});
  }
  await render(null);
  check('Guest sees password login and no editor',d.body.textContent.includes('登录 RocoWiki')&&!d.querySelector('textarea'));
  await fill('input[name="identifier"]','contributor');await fill('input[name="password"]','Fixture long password 2026!');await click('登录');await act(async()=>await pause(500));
  check('Password login establishes a real API session and opens the workbench',requests.some(r=>r.path==='/auth/login'&&r.method==='POST'&&r.credentials==='include')&&d.body.textContent.includes('账号与归属'));
  await render('contributor');await fill('.toolbar select','contributing');await click('加载当前基线');
  const content='# Revised\n\n'+'资料'.repeat(10000);
  check('UTF-8 test content fits the accepted article limit',Buffer.byteLength(content)<=65536);
  await fill('.markdown-editor',content);
  await fill('input[placeholder*="至少 5"]','补充来源与实测结果');
  await fill('input[aria-label="来源 1 标题"]','官方资料');
  await fill('input[aria-label="来源 1 地址"]','https://example.com/evidence');
  lose='draft';await click('保存私有草稿');
  check('A lost draft response shows timeout while the server retains the draft',d.body.textContent.includes('请求超时')&&db.sql.prepare('SELECT count(*) AS n FROM drafts').get().n===1);
  await click('保存私有草稿');
  const saved=requests.filter(r=>r.path.startsWith('/drafts/')&&r.method==='PUT');
  check('Draft timeout retry reuses the same private draft ID',saved.length===2&&saved[0].path===saved[1].path);
  check('Large draft is stored by the real API',db.sql.prepare('SELECT count(*) AS n FROM drafts').get().n===1);
  await click('我的草稿与投稿');await click('继续编辑');
  check('Draft restoration retains both editor content and sources',d.querySelector('.markdown-editor').value===content&&d.querySelector('input[aria-label="来源 1 地址"]').value==='https://example.com/evidence');
  // Return a timed-out response after the API actually committed the revision.
  lose='/submissions';await click('提交审核');
  check('A lost submit response shows timeout and preserves the draft',d.body.textContent.includes('请求超时')&&d.querySelector('.markdown-editor').value===content);
  check('Timeout does not automatically resubmit',requests.filter(r=>r.path==='/submissions'&&r.method==='POST').length===1);
  await click('提交审核');
  const submitted=requests.filter(r=>r.path==='/submissions'&&r.method==='POST');
  check('Explicit retry reuses the idempotency key',submitted.length===2&&submitted[0].key===submitted[1].key);
  check('Response-loss retry creates only one immutable revision',db.sql.prepare('SELECT count(*) AS n FROM submissions').get().n===1&&d.body.textContent.includes('已提交审核'));
  await click('账号与归属');await click('退出登录');
  check('Logout removes the editing surface',!d.querySelector('textarea')&&d.body.textContent.includes('登录 RocoWiki'));
  await render('reviewer','?tab=review');await click('补充来源与实测结果');
  check('Nonempty review queue mounts detail and diff',d.querySelector('.diff-panel')&&d.body.textContent.includes('投稿来源'));
  await fill('.review-panel textarea','已对照官方资料核验');await click('批准');
  check('Independent review creates one outbox job',db.sql.prepare('SELECT status FROM submissions').get().status==='approved'&&db.sql.prepare('SELECT count(*) AS n FROM publish_jobs').get().n===1);
  await render('viewer','?tab=review');
  check('Viewer cannot mount editing controls or review tab',!d.querySelector('textarea')&&![...d.querySelectorAll('[role="tab"]')].some(tab=>tab.textContent==='审核队列'));
  await render(null);await click('创建账号');
  for(const [name,value] of [['email','fresh@example.test'],['username','Fresh_Player'],['display_name','新注册昵称'],['password','Registration fixture password!'],['password_confirmation','Registration fixture password!']])await fill(`input[name="${name}"]`,value);
  await click('注册');await act(async()=>await pause(500));
  check('Registration form sends a verification message without creating an account',mail.length===1&&!db.sql.prepare('SELECT uid FROM users WHERE username=?').get('fresh_player'));
  await render(null,`?flow=verify${mail[0].hash}`);
  check('Email fragment opens an explicit confirmation form and is removed from the address',d.body.textContent.includes('确认验证邮箱')&&!w.location.hash);
  await fill('input[name="password"]','Registration fixture password!');await click('确认验证');await act(async()=>await pause(500));
  check('Email plus registration password creates a verified account',db.sql.prepare('SELECT email_verified_at FROM password_credentials WHERE email=?').get('fresh@example.test').email_verified_at>0);
  await fill('input[name="identifier"]','FRESH_PLAYER');await fill('input[name="password"]','Registration fixture password!');await click('登录');await act(async()=>await pause(500));
  await click('账号与归属');await fill('input[name="display_name"]','修改后的昵称');await click('保存昵称');
  check('Account settings keep username immutable while saving a distinct nickname',db.sql.prepare('SELECT username,display_name FROM users WHERE username=?').get('fresh_player').display_name==='修改后的昵称'&&d.body.textContent.includes('fresh_player')&&!d.querySelector('input[name="username"]'));
  await global.fetch('https://api.wiki.test/auth/password/request-reset',{method:'POST',headers:{'Content-Type':'application/json','X-Roco-Request':'1'},body:JSON.stringify({identifier:'fresh_player'})});
  await render('contributor',`?flow=reset${mail[1].hash}`);
  check('A reset link opens its form even when an old session is still logged in',d.body.textContent.includes('设置新密码'));
  await fill('input[name="password"]','Reset fixture password 2026!');await fill('input[name="password_confirmation"]','Reset fixture password 2026!');await click('保存新密码');await act(async()=>await pause(500));
  await fill('input[name="identifier"]','fresh@example.test');await fill('input[name="password"]','Reset fixture password 2026!');await click('登录');await act(async()=>await pause(500));
  check('The reset password logs in and drops the previous private editor state',d.body.textContent.includes('账号与归属')&&!d.querySelector('.markdown-editor'));
  await act(async()=>{root.unmount();await pause();});root=null;
  check('Interactions and unmount produce no React errors',errors.length===0);
  console.log(`Formal workbench interactions passed: ${checks.length} checks (real password login, API and SQLite).`);
}
main().catch(error=>{original.error(error);process.exitCode=1;}).finally(async()=>{
  if(root)await act(async()=>root.unmount());
  db?.close();dom?.window.close();global.fetch=original.fetch;global.setTimeout=original.setTimeout;console.error=original.error;
  if(original.navigator)Object.defineProperty(global,'navigator',original.navigator);
  fs.rmSync(temp,{recursive:true,force:true});
});
