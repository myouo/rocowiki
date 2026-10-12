const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const {JSDOM} = require('jsdom');
const React = require('react');
const {act} = React;
const project = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rocowiki-lifecycle-'));
const checks = [], errors = [], observers = [];
let dom, root;
const originalError = console.error;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
function check(name, result) { checks.push({name, pass:!!result}); assert.ok(result, name); }
const pause = (time = 30) => new Promise(resolve => setTimeout(resolve, time));
async function main() {
  await esbuild.build({
    stdin:{resolveDir:project,loader:'jsx',contents:`
      export {default as WikiPage} from './src/wiki/WikiPage.jsx';
      export {default as InlineSectionEdits} from './src/wiki/InlineSectionEdits.jsx';
      export {default as EntityTextarea} from './src/wiki/EntityTextarea.jsx';
      export {default as BoundedTextarea} from './src/wiki/BoundedTextarea.jsx';
      export {SearchPage} from './src/wiki/catalog/SearchPage.jsx';
      export {GlobalFeedback} from './src/wiki/Feedback.jsx';
      export {SearchLauncher} from './src/wiki/core.jsx';
      export {DirectorySearch} from './src/wiki/DirectoryPanel.jsx';
      export {PreviewFooter} from './src/wiki/core.jsx';
      export {ReadPreviewFrame} from './src/wiki/editing/PreviewContent.jsx';
      export {contributionEntries,emptySocialState} from './src/wiki/communitySocialModel.js';
      export {communityActivityRecords} from './src/wiki/communityActivityModel.js';
      export {readCalculationSnapshots,CALCULATION_SNAPSHOT_KEY} from './src/wiki/calculatorSnapshotStore.js';
      export {statsDefaultsForPet} from './src/wiki/statsProfiles.js';
      export {calculateStats} from './src/wiki/rocoCalculations.js';
      export {pets} from './src/wiki/data.js';
      export {draftPersisted} from './src/wiki/editing/draftPersistence.js';
      export {default as NativeNavbar} from './src/theme/Navbar/index.jsx';
      export {useTOCHighlight as useNativeTOCHighlight} from '@docusaurus/theme-common/lib/hooks/useTOCHighlight';
      export {default as CounterVotes} from './src/wiki/CounterVotes.jsx';
      export {default as PublishedDocument} from './src/wiki/editing/PublishedDocument.jsx';
      export {default as PageCommunityFooter} from './src/wiki/PageCommunityFooter.jsx';
      export {default as RequireRole,VerifiedIdentityContext} from './src/wiki/auth/RequireRole.jsx';
    `},outfile:path.join(temp,'app.cjs'),bundle:true,format:'cjs',platform:'node',loader:{'.css':'empty'},logLevel:'silent',plugins: [require('./runtime-context-plugin.cjs'), {
      name:'test-framework',setup(build){
        build.onResolve({filter:/^(react|react-dom|lucide-react)(\/.*)?$/},args=>({path:require.resolve(args.path,{paths:[project]}),external:true}));
        // Exercise the installed framework hook, rather than mocking away its DOM contract.
        build.onResolve({filter:/^@docusaurus\/theme-common\/lib\/hooks\/useTOCHighlight$/},()=>({path:path.join(path.dirname(require.resolve('@docusaurus/theme-common',{paths:[project]})),'hooks/useTOCHighlight.js')}));
        build.onResolve({filter:/^(@docusaurus\/|@theme\/)/},args=>({path:args.path,namespace:'framework'}));
        build.onLoad({filter:/.*/,namespace:'framework'},args=>({loader:'jsx',resolveDir:project,contents:
          args.path.endsWith('/router') ? `export function useLocation(){return globalThis.__wikiLocation};export function useHistory(){return {push(to){globalThis.__navigation=to},replace(to){globalThis.__navigation=to},goBack(){}}};` :
          args.path.endsWith('/useBrokenLinks') ? `export default function useBrokenLinks(){return {collectAnchor(){},collectLink(){}}}` :
          args.path.endsWith('/useBaseUrl') ? `export default function useBaseUrl(value){return value}` :
          args.path.endsWith('/useDocusaurusContext') ? `export default function useDocusaurusContext(){return {siteConfig:{themeConfig:globalThis.__wikiThemeConfig}}}` :
          args.path.endsWith('/Layout') ? `import React from 'react';export default function Layout({children}){return <>{children}</>}` :
          `import React from 'react';export default function Link({to,href,children,...props}){return <a href={to||href} {...props}>{children}</a>}`
        }));
      }
    }]
  });
  dom = new JSDOM('<!doctype html><head></head><body><div id="root"></div></body>', {url:'https://wiki.test/',pretendToBeVisual:true});
  const w=dom.window,d=w.document;
  Object.assign(globalThis,{window:w,document:d,localStorage:w.localStorage,HTMLElement:w.HTMLElement,Node:w.Node,Event:w.Event,CustomEvent:w.CustomEvent,MutationObserver:w.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,__wikiLocation:{pathname:'/',search:'',hash:''}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});
  globalThis.__wikiThemeConfig=require(path.join(project,'docusaurus.config.js')).themeConfig;
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.HTMLElement.prototype.scrollIntoView=function(){};
  class ResizeObserver {
    constructor(callback){this.callback=callback;this.targets=[];this.active=true;this.source=new Error().stack;observers.push(this);}
    observe(node){this.targets.push(node);}
    disconnect(){this.active=false;this.targets=[];}
  }
  w.ResizeObserver=ResizeObserver;
  console.error=(...args)=>{errors.push(args.map(String).join(' '));};
  w.addEventListener('error',event=>errors.push(String(event.error||event.message)));
  const C=require(path.join(temp,'app.cjs'));
  root=require('react-dom/client').createRoot(d.getElementById('root'));
  const verified={user:{uid:'usr_12345678-1234-4234-8234-123456789abc',role:'reviewer'},loading:false};
  async function render(node){await act(async()=>{root.render(React.createElement(C.VerifiedIdentityContext.Provider,{value:globalThis.__wikiTestIdentity||verified},node));await pause();});await act(async()=>await pause());}
  async function click(label,scope=d){const button=[...scope.querySelectorAll('button')].find(b=>b.textContent.trim()===label||b.getAttribute('aria-label')===label);assert.ok(button,`button: ${label}`);await act(async()=>button.click());await act(async()=>await pause());}
  const tocConfig={linkClassName:'native-test-toc',linkActiveClassName:'native-test-active',minHeadingLevel:2,maxHeadingLevel:2};
  const nativeListeners={scroll:new Set(),resize:new Set()},addListener=d.addEventListener,removeListener=d.removeEventListener;
  d.addEventListener=function(type,listener,...rest){nativeListeners[type]?.add(listener);return addListener.call(this,type,listener,...rest);};
  d.removeEventListener=function(type,listener,...rest){nativeListeners[type]?.delete(listener);return removeListener.call(this,type,listener,...rest);};
  let secondHeadingTop=260;
  function NativeDocumentFixture(){
    C.useNativeTOCHighlight(tocConfig);
    return React.createElement(React.Fragment,null,
      React.createElement(C.NativeNavbar),
      React.createElement('main',null,
        React.createElement('h2',{id:'native-first',className:'anchor',ref:node=>{
          if(node){node.getBoundingClientRect=()=>({top:10,bottom:40});
            Object.defineProperty(d.querySelector('.rw-site-header'),'clientHeight',{configurable:true,value:140});}
        }},'First'),
        React.createElement('h2',{id:'native-second',className:'anchor',ref:node=>{if(node)node.getBoundingClientRect=()=>({top:secondHeadingTop,bottom:secondHeadingTop+30});}},'Second'),
        React.createElement('h2',{id:'native-third',className:'anchor',ref:node=>{if(node)node.getBoundingClientRect=()=>({top:350,bottom:380});}},'Third')),
      React.createElement('a',{href:'#native-first',className:'native-test-toc'},'First'),
      React.createElement('a',{href:'#native-second',className:'native-test-toc'},'Second'),
      React.createElement('a',{href:'#native-third',className:'native-test-toc'},'Third'));
  }
  await render(React.createElement(React.StrictMode,null,React.createElement(NativeDocumentFixture)));
  check('The native header supplies the navbar element required by Docusaurus TOC',d.querySelector('.navbar')===d.querySelector('.rw-site-header'));
  check('The actual Docusaurus TOC hook highlights a visible heading',d.querySelector('a[href="#native-second"]').classList.contains('native-test-active'));
  secondHeadingTop=100;
  await act(async()=>d.dispatchEvent(new w.Event('scroll')));
  check('Native TOC scrolling accounts for the full custom header height',d.querySelector('a[href="#native-third"]').classList.contains('native-test-active'));
  await render(React.createElement('p',null,'after native document'));
  await act(async()=>{d.dispatchEvent(new w.Event('scroll'));d.dispatchEvent(new w.Event('resize'));});
  check('Native TOC handlers are removed on route unmount',Object.values(nativeListeners).every(listeners=>listeners.size===0));
  d.addEventListener=addListener;d.removeEventListener=removeListener;
  for(const [title,url] of [['机制研究与来源规范','/wiki/mechanics/research-method/'],['参与共建','/wiki/guides/contributing/']]){
    globalThis.__wikiLocation={pathname:'/search/',search:'?q='+encodeURIComponent(title),hash:''};
    await render(React.createElement(C.SearchPage));
    check(`Global search renders the formal article ${title}`,d.querySelector(`a[href="${url}"] h2`)?.textContent===title);
  }
  globalThis.__wikiLocation={pathname:'/',search:'',hash:''};
  await render(React.createElement(C.PreviewFooter));
  check('The shared footer links to the copyright statement',d.querySelector('.rw-footer a[href="/copyright/"]')?.textContent.includes('Copyright'));
  for(const [path,title,language] of [['/copyright/','版权与许可','zh-CN'],['/copyright/en/','Copyright and licensing','en']]){
    globalThis.__wikiLocation={pathname:path,search:'',hash:''};
    await render(React.createElement(React.Fragment,null,React.createElement(C.WikiPage,{routeData:{path}}),React.createElement(C.PreviewFooter)));
    check(`The copyright route renders ${language} and offers both languages`,d.querySelector('article.rw-legal')?.lang===language&&d.querySelector('h1')?.textContent===title&&d.querySelector('a[href="/copyright/en/"]')?.textContent==='English');
    check(`The ${language} policy is excluded from article editing, discussion and search indexing`,!d.querySelector('[data-pagefind-body],.rw-edit-entry,#discussion,.rw-page-community-v72'));
  }
  globalThis.__wikiLocation={pathname:'/',search:'',hash:''};
  const author='12345678-1234-4234-8234-123456789abc',row={id:'test',authorId:author,status:'published',before:'old text',after:'new text',updatedAt:'2026-10-10T12:00:00Z',events:{broken:true}};
  check('Malformed contribution events cannot crash community statistics',C.contributionEntries([row]).length===1);
  check('Malformed contribution collections return an empty projection',C.contributionEntries({broken:true}).length===0);
  check('Null activity rows cannot crash the activity page',C.communityActivityRecords({state:C.emptySocialState(),actorId:author,submissions:[null,row],view:'contributions',now:new Date('2026-10-11T12:00:00Z')}).length===1);

  const pet=C.pets.find(p=>p.stats?.length===6),form=C.statsDefaultsForPet(pet),result=C.calculateStats(form);
  w.localStorage.setItem(C.CALCULATION_SNAPSHOT_KEY,JSON.stringify({version:1,records:[{id:'record',label:'record',pet:{slug:pet.slug,name:pet.name,href:'javascript:bad()'},savedAt:'2026-10-10T12:00:00Z',dataVersion:'test',form:{...form,petHref:'javascript:bad()'},panel:result.panel,battle:result.battle}]}));
  const loaded=C.readCalculationSnapshots();check('Stored calculator links are read back through the same sanitization as new records',loaded.ok&&loaded.records[0].pet.href===''&&loaded.records[0].form.petHref==='');
  w.localStorage.removeItem(C.CALCULATION_SNAPSHOT_KEY);

  await render(React.createElement(React.StrictMode,null,React.createElement(C.EntityTextarea,{value:null,onChange(){}})));
  check('A missing or damaged textarea value stays editable',d.querySelector('textarea')?.value==='');
  function ReferenceFixture(){const [value,setValue]=React.useState('');return React.createElement('section',{style:{overflow:'hidden'}},React.createElement(C.EntityTextarea,{value,onChange:setValue,ariaLabel:'Portal reference'}));}
  await render(React.createElement(ReferenceFixture));
  await click('Portal reference：插入词条');
  check('Entity options escape their clipping card through an owned document portal',d.querySelector('.rw-entity-menu')?.parentElement===d.body);
  await act(async()=>{w.dispatchEvent(new w.Event('scroll'));w.dispatchEvent(new w.Event('resize'));await pause();});
  const option=d.querySelector('.rw-entity-menu [role="option"]');
  await act(async()=>{option.dispatchEvent(new w.Event('pointerdown',{bubbles:true}));option.click();await pause();});
  check('Portal options remain clickable and insert the selected reference',d.querySelector('textarea').value.includes('](')&&!d.querySelector('.rw-entity-menu'));
  await render(React.createElement(React.StrictMode,null,React.createElement(C.GlobalFeedback),React.createElement(C.SearchLauncher)));
  await click('反馈问题');check('Unsupported native dialog methods use a safe fallback',d.querySelector('.rw-feedback-dialog').hasAttribute('open'));
  await click('关闭反馈');await click('搜索全站');check('The search dialog can open without showModal support',d.querySelector('.rw-search-dialog').hasAttribute('open'));await click('关闭搜索');

  const inputValueSetter=Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set;
  async function inputText(input,value,isComposing){await act(async()=>{
    inputValueSetter.call(input,value);
    input.dispatchEvent(new w.InputEvent('input',{bubbles:true,data:value,inputType:isComposing?'insertCompositionText':'insertText',isComposing}));
  });}
  let directorySubmitted=null;
  for(const fixture of [
    {name:'Search launcher',node:React.createElement(C.SearchLauncher),form:'.rw-search-dialog form',expected:()=>globalThis.__navigation==='/search/?q='+encodeURIComponent('迪莫'),open:true},
    {name:'Search page',node:React.createElement(C.SearchPage),form:'.rw-searchform.large',expected:()=>globalThis.__navigation==='/search/?q='+encodeURIComponent('迪莫')},
    {name:'Directory search',node:React.createElement(C.DirectorySearch,{query:new URLSearchParams(),onSubmit:value=>{directorySubmitted=value;}}),form:'.rw-directory-search',expected:()=>directorySubmitted==='迪莫'},
  ]){
    globalThis.__wikiLocation={pathname:'/search/',search:'',hash:''};globalThis.__navigation=null;directorySubmitted=null;
    await render(fixture.node);if(fixture.open)await click('搜索全站');
    const form=d.querySelector(fixture.form),input=form.querySelector('input');
    await act(async()=>input.dispatchEvent(new w.CompositionEvent('compositionstart',{bubbles:true})));
    await inputText(input,'dimo',true);
    const key=new w.KeyboardEvent('keydown',{key:'Enter',keyCode:229,isComposing:true,bubbles:true,cancelable:true});
    await act(async()=>{input.dispatchEvent(key);form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));});
    check(`${fixture.name} keeps IME candidate Enter from navigating or submitting`,key.defaultPrevented&&!globalThis.__navigation&&directorySubmitted===null);
    await inputText(input,'迪莫',true);
    await act(async()=>input.dispatchEvent(new w.CompositionEvent('compositionend',{bubbles:true,data:'迪莫'})));
    await inputText(input,'迪莫',false);
    const trailingKey=new w.KeyboardEvent('keydown',{key:'Enter',keyCode:229,isComposing:false,bubbles:true,cancelable:true});
    await act(async()=>input.dispatchEvent(trailingKey));
    check(`${fixture.name} ignores the post-composition keyCode 229 Enter`,trailingKey.defaultPrevented&&!globalThis.__navigation&&directorySubmitted===null);
    await act(async()=>form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})));
    check(`${fixture.name} submits the complete Chinese query afterward`,fixture.expected());
  }
  globalThis.__wikiLocation={pathname:'/',search:'',hash:''};

  const frameTree=()=>React.createElement(React.StrictMode,null,React.createElement('textarea',{'data-parent-draft':true,defaultValue:'unsaved draft'}),React.createElement(C.ReadPreviewFrame,{mode:'article',data:{markdown:'# Preview\n\nSafe body.'},context:{entity:'Test'}}));
  for(let i=0;i<6;i++){
    await render(frameTree());
    const frame=d.querySelector('iframe');
    await act(async()=>{frame.dispatchEvent(new w.Event('load'));frame.dispatchEvent(new w.Event('load'));await pause();});
    check(`Preview cycle ${i+1} creates exactly one React host`,frame.contentDocument.querySelectorAll('#reading-preview-root').length===1);
    check(`Preview cycle ${i+1} keeps the unsaved parent field`,d.querySelector('[data-parent-draft]').value==='unsaved draft');
    await click('手机');await click('桌面');
    const host=frame.contentDocument.getElementById('reading-preview-root');
    host.getBoundingClientRect=()=>{throw new Error('deliberate preview measurement failure');};
    await act(async()=>{host.appendChild(frame.contentDocument.createElement('span'));await pause(50);});
    await click('重新打开预览');
    const replacement=d.querySelector('iframe');
    await act(async()=>{replacement.dispatchEvent(new w.Event('load'));await pause();});
    check(`Preview cycle ${i+1} safely replaces the old iframe`,replacement!==frame&&!frame.isConnected&&replacement.contentDocument.querySelectorAll('#reading-preview-root').length===1);
    await render(React.createElement('p',null,'reading'));
  }

  globalThis.__wikiLocation={pathname:'/custom/',search:'',hash:''};
  function Editable({text}){return React.createElement('main',{id:'rw-main','data-wiki-entity':'Test'},React.createElement('div',{'data-editable-section':true},React.createElement('h2',null,text)),React.createElement(C.InlineSectionEdits));}
  for(let i=0;i<8;i++){await render(React.createElement(React.StrictMode,null,React.createElement(Editable,{text:`Heading ${i}`})));check(`Updated heading ${i+1} has one live edit portal`,d.querySelectorAll('h2 .rw-inline-section-edit').length===1);}
  await render(React.createElement('p',null,'detached'));
  check('Route cleanup removes every retired edit host',!d.querySelector('.rw-inline-section-edit'));

  const storageKey='roco-wiki-v4:community',draft={editorVersion:7,typedData:{markdown:'new'},summary:'change',evidenceUrl:'https://example.com',evidenceNote:'evidence'};
  w.localStorage.setItem(storageKey,JSON.stringify({drafts:[{...draft,key:'draft'}]}));
  check('A durable draft is verified against all submitted fields',C.draftPersisted('draft',draft,storageKey));
  check('Changed content cannot be reported as a successfully saved draft',!C.draftPersisted('draft',{...draft,typedData:{markdown:'unsaved'}},storageKey));
  w.localStorage.clear();

  globalThis.__wikiLocation={pathname:'/edit/',search:'?entity=速度与先手&section=条目正文&mode=article&returnTo=/mechanics/priority/',hash:''};
  await render(React.createElement(React.StrictMode,null,React.createElement(C.WikiPage,{routeData:{path:'/edit/'}})));
  const editor=d.querySelector('textarea[aria-label="本节正文"]');
  assert.ok(editor,'article editor');
  const setValue=Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype,'value').set;
  const setItem=w.Storage.prototype.setItem;
  w.Storage.prototype.setItem=function(){throw new Error('test storage quota failure');};
  await act(async()=>{setValue.call(editor,'Lifecycle draft must survive a failed autosave.');editor.dispatchEvent(new w.Event('input',{bubbles:true}));await pause();});
  await act(async()=>await pause(800));
  check('Failed autosave retains the latest editable text',editor.value==='Lifecycle draft must survive a failed autosave.');
  check('Failed autosave is visible instead of being reported as saved',d.body.textContent.includes('草稿尚未成功保存'));
  w.Storage.prototype.setItem=setItem;
  await act(async()=>{w.dispatchEvent(new w.Event('pagehide'));await pause();});
  check('The dirty draft can still be flushed after storage recovers',JSON.parse(w.localStorage.getItem(storageKey)).drafts.some(row=>row.typedData?.markdown==='Lifecycle draft must survive a failed autosave.'));

  const routes=JSON.parse(fs.readFileSync(path.join(project,'content/routes.json'),'utf8'));
  for(const route of routes){
    globalThis.__wikiLocation={pathname:route,search:'',hash:''};
    await render(React.createElement(React.StrictMode,null,React.createElement(C.WikiPage,{routeData:{path:route}})));
    check(`Native route can mount and unmount: ${route}`,!!d.querySelector('#rw-main')&&!d.querySelector('.rw-recovery-v73'));
  }
  globalThis.__wikiWorkspaceMode='server';
  const poisoned=JSON.stringify({version:1,profile:{uuid:author,uid:'999',nickname:'Local administrator'},drafts:[],submissions:[{id:'poison',status:'published',editorVersion:7,editorMode:'pet',editorRequest:{entity:C.pets[0].name,returnTo:'/pets/'+C.pets[0].slug+'/'},typedData:{...C.pets[0],name:'FAKE LOCAL PUBLICATION'}}]});
  w.localStorage.setItem(storageKey,poisoned);
  for(const route of ['/account/','/review/','/edit/']){
    globalThis.__navigation='';
    globalThis.__wikiLocation={pathname:route,search:route==='/edit/'?'?entity=Unregistered&mode=npc':'',hash:''};
    await render(React.createElement(React.StrictMode,null,React.createElement(C.NativeNavbar),React.createElement(C.WikiPage,{routeData:{path:route}})));
    check(`Formal ${route} never mounts a demo editor or impersonated role`,!d.querySelector('.cm-account-shell,.ev7-editor-layout,.cm-role-bar'));
    check(`Formal ${route} preserves local drafts and identities without using them`,w.localStorage.getItem(storageKey)===poisoned);
  }
  globalThis.__wikiLocation={pathname:'/pets/'+C.pets[0].slug+'/',search:'',hash:''};
  await render(React.createElement(C.WikiPage,{routeData:{path:globalThis.__wikiLocation.pathname}}));
  check('A formal reader ignores local published pet replacements',!d.body.textContent.includes('FAKE LOCAL PUBLICATION'));
  await render(React.createElement(React.Fragment,null,React.createElement(C.CounterVotes,{petSlug:'haifu',record:{id:'counter'}}),React.createElement(C.PageCommunityFooter)));
  check('Formal votes and discussion do not mount local mutation controls',!d.querySelector('.rw-counter-vote-buttons-v7,.rw-discussion-body-v72'));
  const doc={path:'/formal/',title:'Formal',sections:[],markdown:'Original'};
  await render(React.createElement(C.PublishedDocument,{document:doc},React.createElement('p',null,'Formal published body')));
  check('Formal document rendering retains its bundled canonical body',d.body.textContent==='Formal published body');
  globalThis.__wikiWorkspaceMode='demo';
  globalThis.__wikiTestIdentity={user:null,loading:false};
  globalThis.__wikiLocation={pathname:'/edit/',search:'?entity=速度与先手&mode=article',hash:''};
  await render(React.createElement(C.WikiPage,{routeData:{path:'/edit/'}}));
  check('Visitors cannot mount an editor even through a direct edit URL',!d.querySelector('textarea')&&d.body.textContent.includes('注册登录后参与编辑'));
  globalThis.__wikiTestIdentity={user:{uid:verified.user.uid,role:'viewer'},loading:false};
  await render(React.createElement(C.WikiPage,{routeData:{path:'/edit/'}}));
  check('A registered read-only account cannot mount an editor',!d.querySelector('textarea')&&d.body.textContent.includes('当前账号没有'));
  globalThis.__wikiTestIdentity={user:{uid:verified.user.uid,role:'contributor'},loading:false};
  globalThis.__wikiLocation={pathname:'/review/',search:'',hash:''};
  await render(React.createElement(C.WikiPage,{routeData:{path:'/review/'}}));
  check('Contributors cannot impersonate reviewers through the demo role picker',!d.querySelector('.cm-role-bar')&&d.body.textContent.includes('审核需要审核员'));
  delete globalThis.__wikiTestIdentity;
  await act(async()=>root.unmount());root=null;
  const leaked=observers.filter(o=>o.active);
  if(leaked.length)originalError(JSON.stringify({leaked:leaked.map(o=>({targets:o.targets.map(n=>({tag:n.tagName,className:n.className,connected:n.isConnected})),source:o.source.split('\n')[2]})),errors:errors.slice(0,12)},null,2));
  check('All ResizeObserver subscriptions are disconnected after navigation',leaked.length===0);
  const lifecycleErrors=errors.filter(message=>/NotFoundError|not a child|Maximum update|unmounted|InvalidStateError|TypeError|uncaught|removeChild|aggregate/i.test(message));
  check('No unhandled runtime or lifecycle errors',lifecycleErrors.length===0);
  fs.writeFileSync(path.join(__dirname,'runtime-lifecycle-results.json'),JSON.stringify({checks:checks.length,passed:checks.filter(c=>c.pass).length,routeCount:routes.length,results:checks,errors},null,2)+'\n');
  console.log(`Runtime lifecycle check passed: ${checks.length} checks, ${routes.length} route transitions.`);
}
main().catch(error=>{originalError(error);process.exitCode=1;}).finally(async()=>{
  console.error=originalError;
  if(root)await act(async()=>root.unmount());
  dom?.window.close();
  if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);
  else delete globalThis.navigator;
  fs.rmSync(temp,{recursive:true,force:true});
});
