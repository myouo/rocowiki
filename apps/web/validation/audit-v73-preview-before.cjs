const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {JSDOM}=require('jsdom'),React=require('react'),{act}=React,esbuild=require('esbuild');
const project=path.resolve(__dirname,'..'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'v73-preview-before-'));
async function main(){
  await esbuild.build({ stdin: { resolveDir: project, loader: 'jsx', contents: `
    import React, {useState,useRef} from 'react';
    import SectionEditor from './src/wiki/editing/SectionEditor';
    import SkillBranchEditor, {EffectStepsEditor} from './src/wiki/editing/SkillBranchEditor';
    import BloodlinePicker from './src/wiki/editing/BloodlinePicker';
    import EntityTextarea from './src/wiki/EntityTextarea';
    export * from './src/wiki/editing/model';
    export * from './src/wiki/editing/registry';
    export * from './src/wiki/skillConditions';
    export * from './src/wiki/skillFlow';
    export * from './src/wiki/matchupBloodlines';
    export * from './src/wiki/catalogBloodlines';
    export * from './src/wiki/pvePublished';
    export * from './src/wiki/entityReferences';
    export * from './src/wiki/SkillBranchView';
    export {default as ReadingMarkdown} from './src/wiki/editing/ReadingMarkdown';
    export {default as PreviewContent, ReadPreviewFrame} from './src/wiki/editing/PreviewContent';
    export {default as WikiMarkdownLink} from './src/theme/MDXComponents/A';
    export {default as CommunityPages} from './src/wiki/CommunityPages';
    export {default as TypedFields} from './src/wiki/editing/TypedFields';
    export {EntityText} from './src/wiki/EntityReference';
    export {formFor} from './src/wiki/editing/SectionEditor';
    export function BranchHarness({seed,onChange}) { const [rows,setRows]=useState(seed); return <SkillBranchEditor branches={rows} onChange={next=>{setRows(next);onChange(next)}} />; }
    export function StepsHarness({seed,onChange}) { const [value,setValue]=useState(seed); return <EffectStepsEditor value={value} label="步骤" onChange={next=>{setValue(next);onChange(next)}} />; }
    export function BloodlineHarness({seed,onChange,pet='海芙约忒'}) { const [value,setValue]=useState(seed); return <BloodlinePicker value={value} label="当前宠物 · 本场血脉" petIdentity={pet} onChange={next=>{setValue(next);onChange(next)}} />; }
    export function EntityHarness({seed,onChange}) { const [value,setValue]=useState(seed); return <EntityTextarea value={value} ariaLabel="正文" onChange={next=>{setValue(next);onChange(next)}} />; }
    export function Harness({query,workspace,onWorkspace,blocked=false}) {
      const [value,setValue]=useState(workspace);const ref=useRef(value);
      const update=React.useCallback(fn=>{const next=fn(ref.current);ref.current=next;setValue(next);onWorkspace?.(next);if(!blocked)window.localStorage.setItem('roco-wiki-v4:community',JSON.stringify(next));return next},[onWorkspace,blocked]);
      return <SectionEditor workspace={value} update={update} ready query={query} storageError={blocked?'storage blocked':''} DiffViewer={({before,after})=><div data-test-diff>{before}<hr/>{after}</div>} />;
    }
  ` }, outfile: path.join(temporary,'check.cjs'), bundle:true, format:'cjs', platform:'node', loader:{'.css':'empty'}, logLevel:'silent', plugins:[{name:'framework',setup(build){
    build.onResolve({filter:/^(react|react-dom|lucide-react)(\/.*)?$/}, args=>({path:require.resolve(args.path,{paths:[project]}),external:true}));
    build.onResolve({filter:/^@theme-original\/MDXComponents\/A$/}, args=>({path:args.path,namespace:'original-link'}));
    build.onLoad({filter:/.*/,namespace:'original-link'},()=>({loader:'jsx',resolveDir:project,contents:`import React from 'react';export default function Link(props){return <a data-original-link {...props}/>}`}));
    build.onResolve({filter:/^@docusaurus\//}, args=>({path:args.path,namespace:'mock'}));
    build.onLoad({filter:/.*/,namespace:'mock'}, args=>({loader:'jsx',resolveDir:project,contents:args.path.endsWith('/router') ? `export function useHistory(){return {replace(value){globalThis.__returned=value},push(value){globalThis.__returned=value}}};export function useLocation(){return {pathname:'/',search:''}}` : args.path.endsWith('/Link') ? `import React from 'react';export default function Link({to,children,...rest}){return <a href={to} {...rest}>{children}</a>}` : args.path.endsWith('/useBrokenLinks') ? `export default function useBrokenLinks(){return {collectAnchor(){},collectLink(){}}}` : `export default function useBaseUrl(value){return value}` }));
  }}] });

const dom=new JSDOM('<!doctype html><head><style>body{color:#456}</style></head><body><div id="root"></div></body>',{url:'https://wiki.test/edit/',pretendToBeVisual:true});
const w=dom.window,d=w.document;
Object.assign(global,{window:w,document:d,HTMLElement:w.HTMLElement,CustomEvent:w.CustomEvent,localStorage:w.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=()=>{};
let measures=0, resolveFonts;const fontsPromise=new Promise(resolve=>resolveFonts=resolve);
let fontCallbacks=0;const ready={then(callback){return fontsPromise.then(()=>{fontCallbacks++;return callback()})}};
const getDocument=Object.getOwnPropertyDescriptor(w.HTMLIFrameElement.prototype,'contentDocument').get;
Object.defineProperty(w.HTMLIFrameElement.prototype,'contentDocument',{get(){const child=getDocument.call(this);if(child&&!child.fonts)Object.defineProperty(child,'fonts',{value:{ready},configurable:true,writable:true});return child}});
w.HTMLElement.prototype.getBoundingClientRect=function(){if(this.id==='reading-preview-root')measures++;return {width:800,height:420,top:0,left:0,right:800,bottom:420}};
const C=require(path.join(temporary,'check.cjs'));const {createRoot}=require('react-dom/client');
const errors=[];const orig=console.error;console.error=(...args)=>errors.push(args.map(String).join(' '));
let root=createRoot(d.querySelector('#root'));
await act(async()=>{root.render(React.createElement(React.Fragment,null,React.createElement('textarea',{'data-parent-draft':true,defaultValue:'保留草稿'}),React.createElement(C.ReadPreviewFrame,{mode:'skill',data:{name:'技能',common:'效果',phases:[]}})));await new Promise(r=>setTimeout(r,20))});
await act(async()=>{await new Promise(r=>setTimeout(r,20))});
const iframe=d.querySelector('iframe'), oldDocument=iframe.contentDocument, oldTarget=oldDocument.getElementById('reading-preview-root');
oldTarget.getBoundingClientRect=()=>({height:1170,width:800});
await act(async()=>{oldDocument.fonts={ready:Promise.resolve()};oldDocument.open();oldDocument.write('<!doctype html><head></head><body></body>');oldDocument.close();iframe.dispatchEvent(new w.Event('load'));await new Promise(r=>setTimeout(r,20))});
const newTarget=iframe.contentDocument.getElementById('reading-preview-root');newTarget.getBoundingClientRect=()=>({height:540,width:800});
await act(async()=>{iframe.dispatchEvent(new w.Event('load'));await new Promise(r=>setTimeout(r,20))});
await act(async()=>{await new Promise(r=>setTimeout(r,20))});
const currentHeight=iframe.style.height;
await act(async()=>{resolveFonts();await new Promise(r=>setTimeout(r,20))});
const staleHeight=iframe.style.height;
const heightBeforeCleanup=measures;
await act(async()=>root.unmount());
const measureAtCleanup=measures;
await act(async()=>{resolveFonts();await new Promise(r=>setTimeout(r,5))});
const staleMeasures=measures-measureAtCleanup;
root=createRoot(d.querySelector('#root'));
let thrown='';
try{await act(async()=>{root.render(React.createElement(React.Fragment,null,React.createElement('textarea',{'data-parent-draft':true,defaultValue:'保留草稿'}),React.createElement(C.ReadPreviewFrame,{mode:'acquisition',data:{records:'broken saved records'}})));await new Promise(r=>setTimeout(r,10))});}catch(error){thrown=error.message}
const output={sourceSha256:crypto.createHash('sha256').update(fs.readFileSync('src/wiki/editing/PreviewContent.jsx')).digest('hex'),confirmed:[{issue:'Font promise from old iframe document overwrites new-document height',currentHeight,staleHeight,fontCallbacks,pass:currentHeight==='540px'&&staleHeight==='1170px'},{issue:'Malformed preview list throws through portal and removes parent draft UI',thrown,parentDraftPresent:!!d.querySelector('[data-parent-draft]'),pass:!!thrown&&!d.querySelector('[data-parent-draft]')}],notConfirmed:'No graphical browser / no aspect ratio or black-screen reproduction; source and JSDOM only'};
console.error=orig;fs.writeFileSync('validation/v73-preview-before.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
try{await act(async()=>root.unmount())}catch{}dom.window.close();fs.rmSync(temporary,{recursive:true,force:true});
}
main().catch(error=>{console.error(error);process.exitCode=1});
