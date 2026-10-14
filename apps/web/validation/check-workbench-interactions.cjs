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
const original={fetch:global.fetch,setTimeout:global.setTimeout,now:Date.now,error:console.error,navigator:Object.getOwnPropertyDescriptor(global,'navigator')};
let dom,root,db;
const checks=[],errors=[],requests=[];
const pause=time=>new Promise(resolve=>original.setTimeout(resolve,time??25));
function check(name,value){checks.push(name);assert.ok(value,name);}
async function main(){
  process.chdir(repo);
  await esbuild.build({
    stdin:{resolveDir:repo,loader:'tsx',contents:`
      export {default as Workbench} from './apps/web/src/pages/workbench';
      export {default as AccountCenter} from './apps/web/src/features/account/AccountCenter';
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
          args.path.endsWith('/router')?`import {useEffect,useState} from 'react';const readLocation=()=>({pathname:window.location.pathname,search:window.location.search,hash:window.location.hash});export function useLocation(){const [location,setLocation]=useState(readLocation);useEffect(()=>{const changed=()=>setLocation(readLocation());window.addEventListener('popstate',changed);return()=>window.removeEventListener('popstate',changed)},[]);return location};export function useHistory(){return {push(url){window.history.pushState({},'',url);window.dispatchEvent(new Event('popstate'));}}};`:
          args.path.endsWith('/useBaseUrl')?`export default value=>value;`:
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
  let current=null,lose=null,switchOnCollections=false,failSubmissions=false,failMeAfterLogin=false,failNextMe=false,clockOffset=0;
  // Accelerate only deliberately lost responses, preserving normal API deadlines.
  global.setTimeout=(callback,time,...args)=>original.setTimeout(callback,time===30000&&lose?40:time,...args);
  Date.now=()=>original.now()+clockOffset;
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
  global.fetch=async(input,init={})=>{
    const url=new URL(String(input)),headers=new Headers(init.headers);
    if(url.origin==='https://api.resend.com'){const message=JSON.parse(init.body);mail.push(new URL(message.text.match(/https?:\/\/\S+/)[0]));return Response.json({id:'fixture-delivery'});}
    requests.push({path:url.pathname,method:init.method??'GET',key:headers.get('Idempotency-Key'),body:init.body,credentials:init.credentials});
    if(switchOnCollections&&['/drafts','/submissions'].includes(url.pathname)){current='viewer';switchOnCollections=false;}
    if(url.pathname==='/me'&&failNextMe){failNextMe=false;return Response.json({error:{code:'UPSTREAM_RETRYING'}},{status:503});}
    if(url.pathname==='/submissions'&&init.method==='GET'&&failSubmissions)return Response.json({error:{code:'UPSTREAM_RETRYING'}},{status:503});
    // Password login, sessions, drafts and decisions all use real API and SQL.
    headers.set('Origin',env.WEB_ORIGIN);
    if(current)headers.set('Cookie',`roco_session=${identities[current].token}`);
    const background=[];
    const response=await C.app.fetch(new Request(url,{...init,headers}),env,{waitUntil:p=>background.push(p),passThroughOnException(){},props:{}});
    await Promise.all(background);
    if(url.pathname==='/auth/login'&&response.ok){const token=/roco_session=([a-f0-9]{64})/.exec(response.headers.get('set-cookie'))[1];current='contributor';identities.contributor.token=token;if(failMeAfterLogin){failMeAfterLogin=false;failNextMe=true;}}
    if((lose===url.pathname||lose==='draft'&&url.pathname.startsWith('/drafts/'))&&init.method!=='GET'){
      lose=null;init.signal.throwIfAborted();
      return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));
    }
    return response;
  };
  root=require('react-dom/client').createRoot(d.getElementById('root'));
  let workspaceMount=0;
  async function render(role,query=''){
    current=role;dom.reconfigure({url:`https://wiki.test/workbench/${query}`});
    await act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(C.Workbench,{key:'workbench-'+(role||'guest')+'-'+(++workspaceMount)})));await pause();});
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
  async function waitFor(condition,label){
    const deadline=original.now()+5000;
    while(!condition()){
      if(original.now()>=deadline)throw new Error(`Timed out: ${label}; rendered: ${d.body.textContent}`);
      await act(async()=>await pause(20));
    }
  }
  await render(null);
  check('Guest sees password login and no editor',d.body.textContent.includes('登录 RocoWiki')&&!d.querySelector('textarea'));
  await fill('input[name="identifier"]','contributor');await fill('input[name="password"]','Fixture long password 2026!');await click('登录');await waitFor(()=>d.body.textContent.includes('账号与归属'),'workbench password login');
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
  await click('注册');await waitFor(()=>mail.length===1&&d.body.textContent.includes('登录 RocoWiki'),'registration acknowledgment');
  check('Registration form sends a verification message without creating an account',mail.length===1&&!db.sql.prepare('SELECT uid FROM users WHERE username=?').get('fresh_player'));
  await render(null,`?flow=verify${mail[0].hash}`);
  await waitFor(()=>d.body.textContent.includes('确认验证邮箱'),'verification form navigation');
  check('Email fragment opens an explicit confirmation form and is removed from the address',d.body.textContent.includes('确认验证邮箱')&&!w.location.hash);
  await fill('input[name="password"]','Registration fixture password!');await click('确认验证');await waitFor(()=>d.body.textContent.includes('邮箱验证成功'),'verification acknowledgment');
  check('Email plus registration password creates a verified account',db.sql.prepare('SELECT email_verified_at FROM password_credentials WHERE email=?').get('fresh@example.test').email_verified_at>0);
  await fill('input[name="identifier"]','FRESH_PLAYER');await fill('input[name="password"]','Registration fixture password!');await click('登录');await waitFor(()=>d.body.textContent.includes('账号与归属'),'workbench password login');
  await click('账号与归属');await fill('input[name="display_name"]','修改后的昵称');await click('保存个人资料');
  check('Account settings keep username immutable while saving a distinct nickname',db.sql.prepare('SELECT username,display_name FROM users WHERE username=?').get('fresh_player').display_name==='修改后的昵称'&&d.body.textContent.includes('fresh_player')&&!d.querySelector('input[name="username"]'));
  await global.fetch('https://api.wiki.test/auth/password/request-reset',{method:'POST',headers:{'Content-Type':'application/json','X-Roco-Request':'1'},body:JSON.stringify({identifier:'fresh_player'})});
  await render('contributor',`?flow=reset${mail[1].hash}`);
  check('A reset link opens its form even when an old session is still logged in',d.body.textContent.includes('设置新密码'));
  await fill('input[name="password"]','Reset fixture password 2026!');await fill('input[name="password_confirmation"]','Reset fixture password 2026!');await click('保存新密码');await waitFor(()=>d.body.textContent.includes('密码已重置'),'password reset acknowledgment');
  await fill('input[name="identifier"]','fresh@example.test');await fill('input[name="password"]','Reset fixture password 2026!');await click('登录');await waitFor(()=>d.body.textContent.includes('账号与归属'),'workbench password login');
  check('The reset password logs in and drops the previous private editor state',d.body.textContent.includes('账号与归属')&&!d.querySelector('.markdown-editor'));
  // The personal center uses the same real API and SQL, and ignores forged demo identity.
  identities.contributor.token=(await C.createSession(env,identities.contributor.uid,C.now())).token;
  const localIdentity=JSON.stringify({version:1,profile:{uid:'999',nickname:'FORGED LOCAL ADMIN',role:'admin'},drafts:[{body:'FORGED LOCAL DRAFT'}],submissions:[]});
  w.localStorage.setItem('roco-wiki-v4:community',localIdentity);
  let accountMount=0;
  async function renderAccount(role,query=''){
    // Separate user journeys in time; production rate limits remain enabled.
    clockOffset+=60000;
    current=role;dom.reconfigure({url:`https://wiki.test/account/${query}`});
    await act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(C.AccountCenter,{key:'account-'+(role||'guest')+'-'+(++accountMount)})));await pause();});
    await act(async()=>await pause(100));
    await waitFor(()=>!d.body.textContent.includes('正在读取登录状态'),'account bootstrap');
  }
  await renderAccount(null);
  check('Account URL shows its own heading and login form without redirecting',d.querySelector('h1')?.textContent==='个人中心'&&w.location.pathname==='/account/'&&d.body.textContent.includes('登录 RocoWiki'));
  check('A visitor cannot promote the local demo identity',!d.body.textContent.includes('FORGED LOCAL ADMIN')&&!d.querySelector('.account-identity'));
  await fill('input[name="identifier"]','contributor');await fill('input[name="password"]','Fixture long password 2026!');await click('登录');await waitFor(()=>!!d.querySelector('.account-identity'),'personal-center login');
  check('Personal-center password login stays on the account URL with server identity',w.location.pathname==='/account/'&&d.querySelector('.account-identity')?.textContent.includes(identities.contributor.uid)&&!d.body.textContent.includes('FORGED LOCAL ADMIN'));
  await waitFor(()=>!!d.querySelector('.rw-checkin-button-v72')&&!d.querySelector('.rw-checkin-button-v72').disabled,'community bootstrap');
  check('Formal community starts from the server empty ledger and exposes the original community sections',db.sql.prepare('SELECT count(*) AS n FROM community_ledger').get().n===0&&d.body.textContent.includes('社区荣誉')&&d.body.textContent.includes('社区足迹')&&d.body.textContent.includes('签到领印记'));
  await click('签到领印记');await waitFor(()=>d.body.textContent.includes('今日已签到'),'community check-in acknowledgment');
  const checked=db.sql.prepare('SELECT daily_reward,streak_bonus FROM community_checkins WHERE uid=?').get(identities.contributor.uid);
  check('A real UI check-in records one server day and credits the fixed reward once',checked.daily_reward>=3&&checked.daily_reward<=7&&db.sql.prepare('SELECT count(*) AS n FROM community_ledger WHERE uid=?').get(identities.contributor.uid).n===1);
  await renderAccount('contributor');await waitFor(()=>d.body.textContent.includes('今日已签到'),'restored check-in');
  check('Reloading the personal center restores its account check-in rather than generating another reward',db.sql.prepare('SELECT count(*) AS n FROM community_checkins WHERE uid=?').get(identities.contributor.uid).n===1&&d.querySelector('.rw-checkin-button-v72').disabled);
  await click('社区荣誉');await waitFor(()=>!!d.querySelector('[data-calendar-day]'),'server check-in calendar');
  check('The restored month calendar uses stored rewards on their actual Beijing day',d.querySelectorAll('[data-calendar-day].is-checked').length===1&&d.querySelector('[data-calendar-day].is-checked').textContent.includes('+'+checked.daily_reward));
  // Exercise redemption through genuine earned credit; do not mint a fixture balance.
  clockOffset+=86400000;
  identities.contributor.token=(await C.createSession(env,identities.contributor.uid,C.now())).token;
  await renderAccount('contributor');await waitFor(()=>!!d.querySelector('.rw-checkin-button-v72')&&!d.querySelector('.rw-checkin-button-v72').disabled,'next-day check-in');
  await click('签到领印记');await waitFor(()=>d.body.textContent.includes('今日已签到'),'second check-in');
  const earnedBalance=Number(db.sql.prepare('SELECT sum(amount) AS n FROM community_ledger WHERE uid=?').get(identities.contributor.uid).n);
  await click('社区荣誉');await click('纪念柜');await waitFor(()=>!!d.querySelector('.rw-honor-item-v72'),'server honor cabinet');
  await click('兑换');await waitFor(()=>db.sql.prepare('SELECT count(*) AS n FROM community_purchases WHERE uid=?').get(identities.contributor.uid).n===1,'honor redemption');
  check('The honor cabinet deducts the real item price exactly once',Number(db.sql.prepare('SELECT sum(amount) AS n FROM community_ledger WHERE uid=?').get(identities.contributor.uid).n)===earnedBalance-5);
  await click('佩戴');await waitFor(()=>d.querySelector('.account-identity').textContent.includes('初见王国'),'equipped honor');
  check('An owned badge persists to the account identity card',db.sql.prepare('SELECT badge FROM community_profiles WHERE uid=?').get(identities.contributor.uid).badge==='badge-first');
  await click('排行榜');await waitFor(()=>!!d.querySelector('.rw-ranking-table-v72'),'live community ranking');
  check('The personal ranking renders its real earned check-ins without fabricated examples',d.querySelector('.rw-ranking-table-v72').textContent.includes('contributor')&&!d.querySelector('.rw-ranking-table-v72').textContent.includes('示例'));
  await click('个人资料');await fill('input[name="display_name"]','正式个人中心昵称');await click('保存个人资料');
  check('Personal profile edit updates the real owner without changing username or demo storage',db.sql.prepare('SELECT display_name,username FROM users WHERE uid=?').get(identities.contributor.uid).display_name==='正式个人中心昵称'&&d.body.textContent.includes('contributor')&&w.localStorage.getItem('roco-wiki-v4:community')===localIdentity);
  await click('草稿与投稿');
  const continueLink=[...d.querySelectorAll('a')].find(node=>node.textContent.includes('继续编辑'));
  check('Owner sees private drafts and submission state with a direct draft link',continueLink?.href.includes('draft=')&&d.body.textContent.includes('补充来源与实测结果')&&d.body.textContent.includes('已批准'));
  const destination=new URL(continueLink.href);
  await render('contributor',destination.search);
  check('The personal-center draft link restores actual content and sources in the workbench',d.querySelector('.markdown-editor')?.value===content&&d.querySelector('input[aria-label="来源 1 地址"]')?.value==='https://example.com/evidence');
  await render(null,destination.search);
  await fill('input[name="identifier"]','contributor');await fill('input[name="password"]','Fixture long password 2026!');await click('登录');await waitFor(()=>d.querySelector('.markdown-editor')?.value===content,'authenticated draft restoration');
  check('Draft restoration also completes when the deep link first requires password login',d.querySelector('.markdown-editor')?.value===content);
  await renderAccount('viewer');await click('草稿与投稿');
  check('An account switch hides another owner private drafts and submissions',!d.body.textContent.includes('补充来源与实测结果')&&d.body.textContent.includes('还没有保存的草稿'));
  await click('账号与安全');
  check('Personal security uses server account fields and exposes real password controls',d.body.textContent.includes('viewer@example.test')&&d.querySelector('input[name="current_password"]')&&!d.querySelector('input[name="display_name"]'));
  await click('退出登录');
  check('Personal-center logout removes identity and private email',!d.querySelector('.account-identity')&&!d.body.textContent.includes('viewer@example.test')&&d.body.textContent.includes('登录 RocoWiki'));
  check('Personal center does not import a demo balance, role or draft',w.localStorage.getItem('roco-wiki-v4:community')===localIdentity&&!d.body.textContent.includes('FORGED LOCAL DRAFT'));
  await renderAccount(null);failMeAfterLogin=true;
  await fill('input[name="identifier"]','contributor');await fill('input[name="password"]','Fixture long password 2026!');await click('登录');await waitFor(()=>d.body.textContent.includes('登录状态需要确认'),'post-login identity recovery');
  check('Successful login with a lost identity refresh shows recovery instead of a guest login form',d.body.textContent.includes('登录状态需要确认')&&!d.querySelector('input[name="identifier"]'));
  await click('重新检查登录状态');
  check('Identity refresh recovery uses the existing session without another password login',d.querySelector('.account-identity')?.textContent.includes(identities.contributor.uid));
  failSubmissions=true;await renderAccount('contributor','?tab=submissions');
  await waitFor(()=>d.body.textContent.includes('投稿暂时无法读取')&&!![...d.querySelectorAll('a')].find(node=>node.textContent.includes('继续编辑')),'independent record loading');
  check('A failed submissions endpoint does not hide healthy private drafts',!![...d.querySelectorAll('a')].find(node=>node.textContent.includes('继续编辑'))&&d.body.textContent.includes('投稿暂时无法读取'));
  identities.viewer.token=(await C.createSession(env,identities.viewer.uid,C.now())).token;
  failSubmissions=false;switchOnCollections=true;await renderAccount('contributor');
  await waitFor(()=>d.body.textContent.includes('账号已在其他页面切换'),'shared-cookie account switch');
  check('A shared-cookie account switch rejects mismatched response ownership and drops stale identity',d.body.textContent.includes('账号已在其他页面切换')&&!d.querySelector('.account-identity')&&!d.body.textContent.includes('补充来源与实测结果'));
  await click('重新检查登录状态');
  check('Cookie account switch recovery loads the new server identity',d.querySelector('.account-identity')?.textContent.includes(identities.viewer.uid)&&!d.body.textContent.includes('补充来源与实测结果'));
  await act(async()=>{root.unmount();await pause();});root=null;
  check('Interactions and unmount produce no React errors',errors.length===0);
  console.log(`Formal workbench interactions passed: ${checks.length} checks (real password login, API and SQLite).`);
}
main().catch(error=>{original.error(error);process.exitCode=1;}).finally(async()=>{
  if(root)await act(async()=>root.unmount());
  db?.close();dom?.window.close();global.fetch=original.fetch;global.setTimeout=original.setTimeout;Date.now=original.now;console.error=original.error;
  if(original.navigator)Object.defineProperty(global,'navigator',original.navigator);
  fs.rmSync(temp,{recursive:true,force:true});
});
