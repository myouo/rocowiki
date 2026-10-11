/** V7.3 component directions and preview lifetime regression checks. No browser visual claims. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const React = require('react');
const { act } = React;
const esbuild = require('esbuild');
const project = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'roco-v73-flow-'));
const checks = [], expectedErrors = [], runtimeErrors = [];
const sourceFiles = ['src/wiki/SkillBranchView.jsx','src/wiki/SkillBranchView.css','src/wiki/skillFlow.js','src/wiki/skillConditions.js','src/wiki/editing/PreviewContent.jsx','src/wiki/editing/PreviewBoundary.jsx','src/wiki/editing/previewRuntime.js','src/wiki/editing/ReadingMarkdown.jsx','src/wiki/editing/SectionEditor.jsx','src/wiki/BoundedTextarea.jsx','src/wiki/BoundedTextarea.css'];
const check = (name, value) => { checks.push({ name, pass: Boolean(value) }); assert.ok(value, name); };
const pause = (ms = 35) => new Promise(resolve => setTimeout(resolve, ms));
let root, dom, previousConsoleError, previousNavigator;
async function main() {
  await esbuild.build({ stdin:{resolveDir:project,loader:'jsx',contents:`
    import React from 'react';
    import {createPortal} from 'react-dom';
    import ReadingMarkdown from './src/wiki/editing/ReadingMarkdown';
    export * from './src/wiki/SkillBranchView';
    export * from './src/wiki/skillFlow';
    export * from './src/wiki/editing/previewRuntime';
    export {default as PreviewContent,ReadPreviewFrame} from './src/wiki/editing/PreviewContent';
    export {default as PreviewBoundary} from './src/wiki/editing/PreviewBoundary';
    export function MarkdownPortal({target,markdown}){return createPortal(<ReadingMarkdown markdown={markdown} editHeadings={false}/>,target)};
  `},outfile:path.join(temporary,'check.cjs'),bundle:true,format:'cjs',platform:'node',loader:{'.css':'empty'},logLevel:'silent',plugins:[{name:'framework',setup(build){
    build.onResolve({filter:/^(react|react-dom|lucide-react)(\/.*)?$/}, args=>({path:require.resolve(args.path,{paths:[project]}),external:true}));
    build.onResolve({filter:/^@docusaurus\//}, args=>({path:args.path,namespace:'mock'}));
    build.onLoad({filter:/.*/,namespace:'mock'},args=>({loader:'jsx',resolveDir:project,contents:args.path.endsWith('/router')?`export function useHistory(){return {replace(){},push(){}}};export function useLocation(){return {pathname:'/',search:''}}`:args.path.endsWith('/Link')?`import React from 'react';export default function Link({to,children,...rest}){return <a href={to} {...rest}>{children}</a>}`:args.path.endsWith('/useBrokenLinks')?`export default function useBrokenLinks(){return {collectAnchor(){},collectLink(){}}}`:`export default function useBaseUrl(value){return value}`}));
  }}]});
  dom=new JSDOM('<!doctype html><head><style>.test-preview-style{color:purple}</style></head><body><div id="root"></div></body>',{url:'https://wiki.test/edit/',pretendToBeVisual:true});
  const w=dom.window,d=w.document;
  Object.assign(global,{window:w,document:d,HTMLElement:w.HTMLElement,CustomEvent:w.CustomEvent,localStorage:w.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  previousNavigator=Object.getOwnPropertyDescriptor(global,'navigator');
  Object.defineProperty(global,'navigator',{value:w.navigator,configurable:true});
  const observers=[], widths=new WeakMap(), scrolls=[];
  class FakeResizeObserver {
    constructor(callback){this.callback=callback;this.targets=new Set();this.active=true;observers.push(this)}
    observe(node){this.targets.add(node)}
    unobserve(node){this.targets.delete(node)}
    disconnect(){this.active=false;this.targets.clear()}
    fire(){if(this.active)this.callback([...this.targets].map(target=>({target,contentRect:target.getBoundingClientRect()})))}
  }
  const decorated=new WeakSet();
  function decorate(view){
    if(!view||decorated.has(view))return;decorated.add(view);
    view.ResizeObserver=FakeResizeObserver;
    view.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
    view.HTMLElement.prototype.scrollIntoView=function(){scrolls.push({node:this,document:this.ownerDocument})};
    view.HTMLElement.prototype.getBoundingClientRect=function(){const frame=this.ownerDocument.defaultView?.frameElement;const width=widths.get(this)??(frame?.parentElement?.dataset.previewWidth==='mobile'?390:960);return {width,height:420,x:0,y:0,top:0,left:0,right:width,bottom:420}};
  }
  decorate(w);
  const childGetter=Object.getOwnPropertyDescriptor(w.HTMLIFrameElement.prototype,'contentDocument').get;
  Object.defineProperty(w.HTMLIFrameElement.prototype,'contentDocument',{configurable:true,get(){const doc=childGetter.call(this);if(doc)decorate(doc.defaultView);return doc}});
  previousConsoleError=console.error;
  console.error=(...args)=>{const message=args.map(String).join(' ');if(/records\.map|condition\.children|phases|malformed-flow|deliberate-local-failure/.test(message))expectedErrors.push(message);else runtimeErrors.push(message)};
  w.addEventListener('error',event=>runtimeErrors.push(String(event.error||event.message)));
  const C=require(path.join(temporary,'check.cjs'));
  const {createRoot}=require('react-dom/client');
  root=createRoot(d.querySelector('#root'));
  async function render(node){await act(async()=>{root.render(node);await pause()});await act(async()=>await pause())}
  async function click(label,scope=d){const button=[...scope.querySelectorAll('button')].find(node=>node.textContent.trim()===label||node.getAttribute('aria-label')===label);assert.ok(button,'button: '+label);await act(async()=>button.click());await act(async()=>await pause());return button}
  async function resize(node,width){if(node)widths.set(node,width);await act(async()=>{observers.forEach(observer=>observer.fire());node?.ownerDocument.defaultView.dispatchEvent(new node.ownerDocument.defaultView.Event('resize'));await pause()});await act(async()=>await pause())}
  const branch={id:'one',label:'环境判断',when:'环境存在',effect:'回复精力\n回复 PP',otherwise:'消耗 PP',children:[{id:'nested',when:'第 2 回合',effect:'追加效果'}]};
  const flow={name:'技能 A',summary:'[海芙约忒](/pets/haifuyueti/)',common:['基础效果一','基础效果二'],phases:[branch,{id:'two',label:'独立条件',when:'天气存在',effect:'效果甲',otherwiseWhen:'血脉生效',otherwise:'效果乙'}]};
  const vertical=C.buildSkillFlowGraph(flow),horizontal=C.buildSkillFlowGraph(flow,{direction:'horizontal'});
  check('Default Mermaid direction is TD',vertical.direction==='TD'&&vertical.mermaid.startsWith('flowchart TD\n'));
  check('Horizontal Mermaid direction is LR',horizontal.direction==='LR'&&horizontal.mermaid.startsWith('flowchart LR\n'));
  check('Layout does not modify nodes or their metadata',JSON.stringify(vertical.nodes)===JSON.stringify(horizontal.nodes));
  check('Layout does not modify edges or branch semantics',JSON.stringify(vertical.edges)===JSON.stringify(horizontal.edges));
  check('Only Mermaid direction line changes',vertical.mermaid.split('\n').slice(1).join('\n')===horizontal.mermaid.split('\n').slice(1).join('\n'));
  check('String LR option and invalid-option fallback are explicit',C.skillToMermaid(flow,'LR').startsWith('flowchart LR')&&C.skillToMermaid(flow,{direction:'bad'}).startsWith('flowchart TD'));
  check('Unicode and delimiters stay escaped in either direction',C.skillToMermaid({name:'中文"[]|',common:'效果 <&>'},{direction:'horizontal'}).includes('#34;#91;#93;#124;'));
  const directionCase=React.createElement(React.StrictMode,null,React.createElement('section',{'data-flow-holder':'A'},React.createElement(C.SkillEffectFlow,{data:flow})),React.createElement('section',{'data-flow-holder':'B'},React.createElement(C.SkillEffectFlow,{data:{...flow,name:'技能 B'}})));
  await render(directionCase);
  const first=d.querySelector('[data-flow-holder="A"]'),second=d.querySelector('[data-flow-holder="B"]'),firstFlow=first.querySelector('[data-skill-flow]');
  check('Each flow starts with a vertical preference',firstFlow.dataset.flowPreference==='vertical'&&second.querySelector('[data-skill-flow]').dataset.flowPreference==='vertical');
  await click('横向',first);
  check('Wide flow selects horizontal layout',firstFlow.dataset.flowDirection==='horizontal'&&first.querySelector('button[aria-pressed=true]').textContent==='横向');
  check('Direction changes stay inside one flow instance',second.querySelector('[data-skill-flow]').dataset.flowDirection==='vertical');
  const graphText=firstFlow.querySelector('[data-flow-graph="tree"]').textContent;
  check('Direction change keeps every condition and effect',['环境存在','回复精力','回复 PP','消耗 PP','第 2 回合','追加效果','天气存在','效果甲','血脉生效','效果乙'].every(text=>graphText.includes(text)));
  let copied='';Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text}}});
  await click('复制为 Mermaid',first);
  check('Wide-view copy uses LR and preserves graph',copied===horizontal.mermaid);
  await resize(firstFlow,500);
  check('Narrow container temporarily becomes vertical',firstFlow.dataset.flowDirection==='vertical'&&firstFlow.dataset.flowPreference==='horizontal');
  check('Narrow fallback is explained to the reader',first.querySelector('.rw-flow-responsive-note-v73')?.textContent.includes('加宽后恢复横向'));
  await click('复制为 Mermaid',first);
  check('Narrow-view export follows the actual TD layout',copied===vertical.mermaid);
  await resize(firstFlow,1040);
  check('Restoring width restores the horizontal preference',firstFlow.dataset.flowDirection==='horizontal'&&!first.querySelector('.rw-flow-responsive-note-v73'));
  await click('纵向',first);await resize(firstFlow,500);await resize(firstFlow,1040);
  check('Explicit vertical preference survives later resizing',firstFlow.dataset.flowDirection==='vertical');
  let finishCopy;Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise(resolve=>{finishCopy=resolve})}});
  await click('复制为 Mermaid',first);await click('横向',first);
  await act(async()=>{finishCopy();await pause()});
  check('Old clipboard completion cannot claim the new direction was copied',!first.querySelector('.rw-flow-export>small'));
  await click('纵向',first);
  Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('clipboard blocked')}}});
  await click('复制为 Mermaid',first);
  check('Clipboard failure exposes selectable code using the bounded textarea',first.querySelector('.rw-flow-copy-fallback textarea')?.value===vertical.mermaid);
  check('Fallback code fields have unique IDs across flows',new Set([...d.querySelectorAll('.rw-flow-copy-fallback textarea')].map(node=>node.id)).size===d.querySelectorAll('.rw-flow-copy-fallback textarea').length);
  await render(React.createElement(React.Fragment,null,React.createElement('input',{'data-parent-draft':true,defaultValue:'保留输入'}),React.createElement(C.SkillEffectFlow,{data:{name:'malformed-flow',phases:'bad-record'}})));
  check('Malformed flow stays inside a visible local error boundary',!!d.querySelector('[data-render-error-scope="skill-flow"]')&&d.querySelector('[data-parent-draft]')?.value==='保留输入');
  await click('重新显示');
  check('Retrying invalid flow keeps the parent alive and the reason inspectable',!!d.querySelector('[data-parent-draft]')&&d.querySelector('[data-render-error-scope] details pre')?.textContent.length>0);
  await render(React.createElement(React.Fragment,null,React.createElement('input',{'data-parent-draft':true,defaultValue:'保留输入'}),React.createElement(C.SkillEffectFlow,{data:flow})));
  check('Corrected data restores only the failed flow',!!d.querySelector('[data-skill-flow]')&&!d.querySelector('[data-render-error-scope]')&&d.querySelector('[data-parent-draft]')?.value==='保留输入');
  let fail=true;
  function Recoverable(){if(fail)throw Error('deliberate-local-failure');return React.createElement('p',{'data-recovered':true},'已恢复')}
  await render(React.createElement(React.Fragment,null,React.createElement('p',{'data-parent-safe':true},'母页'),React.createElement(C.PreviewBoundary,{scope:'test-component'},React.createElement(Recoverable))));
  fail=false;await click('重新显示');
  check('A local retry genuinely rerenders recovered content',!!d.querySelector('[data-recovered]')&&!!d.querySelector('[data-parent-safe]'));
  function PreviewPage({data=flow,mode='skill'}){return React.createElement(React.Fragment,null,React.createElement('textarea',{'data-editor-draft':true,defaultValue:'尚未提交的草稿'}),React.createElement(C.ReadPreviewFrame,{mode,data,context:{entity:'测试条目',section:'测试小节'}}))}
  await render(React.createElement(React.StrictMode,null,React.createElement(PreviewPage)));
  let iframe=d.querySelector('iframe'),child=iframe.contentDocument,host=child.getElementById('reading-preview-root');
  check('Preview creates one same-origin read-only host',child.querySelectorAll('#reading-preview-root').length===1&&iframe.getAttribute('sandbox')==='allow-same-origin');
  check('Preview uses the same flow with both direction controls',!!child.querySelector('[data-skill-flow]')&&child.querySelector('[aria-label="技能流程阅读方向"]')?.querySelectorAll('button').length===2);
  check('Styles are copied once per frame document',child.querySelectorAll('[data-preview-style]').length===d.head.querySelectorAll('style,link[rel="stylesheet"]').length&&child.querySelectorAll('[data-preview-reset]').length===1);
  await click('横向',child);const childFlow=child.querySelector('[data-skill-flow]');
  check('Iframe flow reads its own width',childFlow.dataset.flowDirection==='horizontal');
  await click('手机');await resize(childFlow,390);
  check('Mobile preview switches layout without replacing the React host',iframe===d.querySelector('iframe')&&host===iframe.contentDocument.getElementById('reading-preview-root')&&childFlow.dataset.flowDirection==='vertical');
  await click('桌面');await resize(childFlow,960);
  check('Returning to desktop preserves the chosen horizontal preference',childFlow.dataset.flowPreference==='horizontal'&&childFlow.dataset.flowDirection==='horizontal');
  for(let i=0;i<6;i++){await click(i%2?'桌面':'手机');await resize(childFlow,i%2?960:390)}
  check('Repeated device toggles preserve parent input and do not clone extra styles',d.querySelector('[data-editor-draft]')?.value==='尚未提交的草稿'&&host===iframe.contentDocument.getElementById('reading-preview-root')&&child.querySelectorAll('[data-preview-reset]').length===1);
  await act(async()=>{iframe.dispatchEvent(new w.Event('load'));iframe.dispatchEvent(new w.Event('load'));await pause()});
  check('Repeated load notifications do not duplicate preview hosts or styles',child.querySelectorAll('#reading-preview-root').length===1&&child.querySelectorAll('[data-preview-reset]').length===1);
  check('Repeated load notifications retain flow view state',child.querySelector('[data-skill-flow]').dataset.flowPreference==='horizontal');
  await render(React.createElement(React.StrictMode,null,React.createElement(PreviewPage,{mode:'acquisition',data:{records:'broken saved records'}})));
  iframe=d.querySelector('iframe');child=iframe.contentDocument;
  check('Malformed acquisition list is caught inside the iframe',!!child.querySelector('[data-render-error-scope="reading-content:acquisition"]'));
  check('Preview failure no longer removes the parent draft or device controls',d.querySelector('[data-editor-draft]')?.value==='尚未提交的草稿'&&!!d.querySelector('[aria-label="预览内容宽度"]'));
  await render(React.createElement(React.StrictMode,null,React.createElement(PreviewPage,{mode:'acquisition',data:{records:[{title:'可获取记录',startDate:'2026-10-01',endDate:'2026-10-08',reward:'宠物'}]}})));
  check('Correcting preview data recovers in the same frame',iframe===d.querySelector('iframe')&&iframe.contentDocument.body.textContent.includes('可获取记录')&&!iframe.contentDocument.querySelector('[data-render-error-scope]'));
  // Reproduce the exact pre-fix late-font race on an actual ReadPreviewFrame.
  let resolveOldFont;const pendingFont=new Promise(resolve=>resolveOldFont=resolve);
  const oldDoc=iframe.contentDocument;Object.defineProperty(oldDoc,'fonts',{configurable:true,writable:true,value:{ready:pendingFont}});
  await act(async()=>{iframe.dispatchEvent(new w.Event('load'));await pause()});
  const oldHost=oldDoc.getElementById('reading-preview-root');oldHost.getBoundingClientRect=()=>({width:900,height:1170});
  await act(async()=>{oldDoc.fonts={ready:Promise.resolve()};oldDoc.open();oldDoc.write('<!doctype html><head></head><body></body>');oldDoc.close();iframe.dispatchEvent(new w.Event('load'));await pause()});
  const newHost=iframe.contentDocument.getElementById('reading-preview-root');newHost.getBoundingClientRect=()=>({width:900,height:540});
  await act(async()=>{iframe.dispatchEvent(new w.Event('load'));await pause()});await act(async()=>await pause());
  check('Reloaded frame measures the replacement host',iframe.style.height==='540px'&&newHost!==oldHost);
  await act(async()=>{resolveOldFont();await pause()});
  check('Old document font completion cannot overwrite current frame height',iframe.style.height==='540px');
  check('Frame reload retains editor text and the current data',d.querySelector('[data-editor-draft]')?.value==='尚未提交的草稿'&&iframe.contentDocument.body.textContent.includes('可获取记录'));
  newHost.getBoundingClientRect=()=>({width:900,height:680});
  const image=oldDoc.createElement('img');newHost.appendChild(image);
  await act(async()=>{image.dispatchEvent(new oldDoc.defaultView.Event('load'));await pause()});
  check('Late inserted image load triggers a fresh height measurement',iframe.style.height==='680px');
  newHost.getBoundingClientRect=()=>({width:900,height:720});
  await act(async()=>{image.dispatchEvent(new oldDoc.defaultView.Event('error'));await pause()});
  check('Broken image event also updates the height instead of stalling',iframe.style.height==='720px');
  newHost.getBoundingClientRect=()=>({width:900,height:50000});
  await act(async()=>{observers.forEach(observer=>observer.fire());await pause()});
  check('Pathological preview heights are bounded with an explicit scrolling note',iframe.style.height===C.PREVIEW_MAX_HEIGHT+'px'&&d.body.textContent.includes('预览区域内继续滚动'));
  check('Finite and fallback height bounds are deterministic',C.previewHeight(12)===300&&C.previewHeight(NaN)===420&&C.previewHeight(Infinity)===420&&C.previewHeight(420.2)===421);
  // Markdown anchors belong to the document containing the clicked link.
  await render(React.createElement('div',null,React.createElement('h2',{id:'相同标题'},'母页标题')));
  const isolated=d.createElement('iframe');d.body.appendChild(isolated);const isolatedDoc=isolated.contentDocument;const mount=isolatedDoc.createElement('div');isolatedDoc.body.appendChild(mount);
  await render(React.createElement(React.Fragment,null,React.createElement('h2',{id:'相同标题'},'母页标题'),React.createElement(C.MarkdownPortal,{target:mount,markdown:'[跳转](#相同标题)\n\n## 相同标题\n\n正文'})));
  const anchor=mount.querySelector('a[href="#相同标题"]');await act(async()=>anchor.dispatchEvent(new isolatedDoc.defaultView.MouseEvent('click',{bubbles:true,cancelable:true})));
  check('A local Markdown anchor scrolls its own document',scrolls.at(-1)?.document===isolatedDoc&&scrolls.at(-1)?.node.id==='相同标题');
  await render(React.createElement('p',null,'结束'));
  isolated.remove();
  check('Unmounting all previews disconnects every size observer',observers.every(observer=>!observer.active));
  const runtimeSource=fs.readFileSync(path.join(project,'src/wiki/editing/previewRuntime.js'),'utf8');
  const viewSource=fs.readFileSync(path.join(project,'src/wiki/SkillBranchView.jsx'),'utf8');
  const css=fs.readFileSync(path.join(project,'src/wiki/SkillBranchView.css'),'utf8');
  check('Preview scheduling verifies live frame, live host and document generation',runtimeSource.includes('frame.contentDocument === document')&&runtimeSource.includes('document.getElementById("reading-preview-root") === root')&&runtimeSource.includes('active = false'));
  check('Font rejection and late loading share a guarded scheduler',runtimeSource.includes('document.fonts?.ready?.then(schedule, schedule)')&&runtimeSource.includes('document.addEventListener("load", schedule, true)'));
  check('Height measurement is coalesced per animation frame',runtimeSource.includes('queued !== null')&&runtimeSource.includes('requestAnimationFrame(measure)'));
  check('Direction observer uses owner document, not global viewport dimensions',viewSource.includes('element.ownerDocument.defaultView')&&!viewSource.includes('window.innerWidth'));
  check('Horizontal styling is scoped to one skill flow and retains rounded cards',css.includes('[data-flow-direction=horizontal]')&&css.includes('border-radius:20px')&&css.includes('.rw-flow-horizontal-node'));
  check('Vertical styling has no two-column root layout',css.includes('[data-flow-direction=vertical]>.rw-skill-branch-list{grid-template-columns:minmax(0,1fr)}'));
  const editorSource=fs.readFileSync(path.join(project,'src/wiki/editing/SectionEditor.jsx'),'utf8');
  check('Section editor and Mermaid fallback use bounded textarea controls',!editorSource.includes('<textarea')&&editorSource.includes('<BoundedTextarea')&&!viewSource.includes('<textarea')&&viewSource.includes('<BoundedTextarea'));
  check('Unexpected React or JavaScript errors are absent',runtimeErrors.length===0);
  check('Expected local rendering faults were exercised',expectedErrors.length>=3);
}
main().catch(error=>{runtimeErrors.push(String(error.stack||error));process.exitCode=1}).finally(async()=>{
  if(root)try{await act(async()=>root.unmount())}catch{}
  if(dom)dom.window.close();
  if(previousConsoleError)console.error=previousConsoleError;
  if(previousNavigator)Object.defineProperty(global,'navigator',previousNavigator);
  const sourceHashes=Object.fromEntries(sourceFiles.filter(file=>fs.existsSync(path.join(project,file))).map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(project,file))).digest('hex')]));
  const result={suite:'V7.3 directions and preview lifecycle',checkedAt:new Date().toISOString(),checks,passed:checks.filter(row=>row.pass).length,total:checks.length,failed:checks.filter(row=>!row.pass).length,sourceHashes,expectedRenderErrors:expectedErrors.length,unexpectedErrors:runtimeErrors,browserVisualQA:false,limitations:'Source and JSDOM only; no real aspect-ratio, screenshot, native rendering or frame-rate reproduction.'};
  fs.writeFileSync(path.join(project,'validation/v73-flow-check.json'),JSON.stringify(result,null,2)+'\n');
  fs.rmSync(temporary,{recursive:true,force:true});
  console.log(JSON.stringify({passed:result.passed,total:result.total,failed:result.failed,unexpectedErrors:runtimeErrors},null,2));
});
