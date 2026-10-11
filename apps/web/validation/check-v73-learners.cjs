/** V7.3 many-to-many skill learning, scoped edits and shared reading preview. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {JSDOM}=require('jsdom'),React=require('react'),{act}=React,esbuild=require('esbuild');
const project=path.resolve(__dirname,'..'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'v73-learners-'));
const checks=[],errors=[];const check=(name,value)=>{checks.push({name,pass:Boolean(value)});assert.ok(value,name)};const pause=()=>new Promise(resolve=>setTimeout(resolve,25));
const sourceFiles=['src/wiki/skillLearnerModel.js','src/wiki/SkillLearners.jsx','src/wiki/SkillLearners.css','src/wiki/CatalogPages.jsx','src/wiki/catalogPublished.js','src/wiki/editing/registry.js','src/wiki/editing/TypedFields.jsx','src/wiki/editing/model.js','src/wiki/editing/PreviewContent.jsx','src/wiki/editing/SectionEditor.jsx'];
let dom,root,oldError;
async function main(){
await esbuild.build({stdin:{resolveDir:project,loader:'jsx',contents:`
import React,{useState,useRef,useCallback} from 'react';
import SectionEditor from './src/wiki/editing/SectionEditor';
import {SkillLearnerFields} from './src/wiki/SkillLearners';
export * from './src/wiki/skillLearnerModel';export * from './src/wiki/catalogPublished';export * from './src/wiki/editing/registry';export * from './src/wiki/editing/model';
export {default as SkillLearners,SkillLearnersPreview} from './src/wiki/SkillLearners';export {SkillPage,PetPage} from './src/wiki/CatalogPages';export {default as PreviewContent,ReadPreviewFrame} from './src/wiki/editing/PreviewContent';export {pets,skills} from './src/wiki/data';export {formFor} from './src/wiki/editing/SectionEditor';
export function FieldHarness({initial,onData}){const [data,setData]=useState(initial);return <SkillLearnerFields data={data} onChange={next=>{setData(next);onData(next)}}/>}
export function EditorHarness({query,initial,onWorkspace}){const [workspace,setWorkspace]=useState(initial),ref=useRef(initial);const update=useCallback(fn=>{const next=fn(ref.current);ref.current=next;setWorkspace(next);onWorkspace(next);window.localStorage.setItem('roco-wiki-v4:community',JSON.stringify(next));return next},[onWorkspace]);return <SectionEditor workspace={workspace} update={update} ready query={query} DiffViewer={({before,after})=><div>{before}<hr/>{after}</div>}/> }
`},outfile:path.join(temporary,'check.cjs'),bundle:true,format:'cjs',platform:'node',loader:{'.css':'empty'},logLevel:'silent',plugins: [require('./runtime-context-plugin.cjs'), {name:'framework',setup(build){
build.onResolve({filter:/^(react|react-dom|lucide-react)(\/.*)?$/},args=>({path:require.resolve(args.path,{paths:[project]}),external:true}));
build.onResolve({filter:/^@docusaurus\//},args=>({path:args.path,namespace:'mock'}));
build.onLoad({filter:/.*/,namespace:'mock'},args=>({loader:'jsx',resolveDir:project,contents:args.path.endsWith('/router')?`export function useHistory(){return {replace(value){globalThis.__returned=value},push(value){globalThis.__returned=value}}};export function useLocation(){return globalThis.__location||{pathname:'/skills/xiazi/',search:''}}`:args.path.endsWith('/Link')?`import React from 'react';export default function Link({to,children,...rest}){return <a href={to} {...rest}>{children}</a>}`:args.path.endsWith('/useBrokenLinks')?`export default function useBrokenLinks(){return {collectAnchor(){},collectLink(){}}}`:`export default function useBaseUrl(value){return value||'/'}`}));
}}]});
dom=new JSDOM('<!doctype html><body><div id="root"></div></body>',{url:'https://wiki.test/edit/',pretendToBeVisual:true});const w=dom.window,d=w.document;
Object.assign(global,{window:w,document:d,HTMLElement:w.HTMLElement,CustomEvent:w.CustomEvent,localStorage:w.localStorage,IS_REACT_ACT_ENVIRONMENT:true});w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=()=>{};oldError=console.error;console.error=(...args)=>errors.push(args.map(String).join(' '));
const C=require(path.join(temporary,'check.cjs')),{createRoot}=require('react-dom/client');root=createRoot(d.querySelector('#root'));
async function render(node,reset=true){if(reset){await act(async()=>root.unmount());root=createRoot(d.querySelector('#root'))}await act(async()=>{root.render(node);await pause()});await act(async()=>await pause())}
async function click(label,scope=d){const el=[...scope.querySelectorAll('button,a')].find(node=>node.textContent.trim()===label||node.getAttribute('aria-label')===label);assert.ok(el,'click '+label);await act(async()=>el.click());await act(async()=>await pause());return el}
async function input(label,value){const el=d.querySelector(`[aria-label="${label}"]`);assert.ok(el,'input '+label);const proto=el.tagName==='TEXTAREA'?w.HTMLTextAreaElement.prototype:w.HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new w.Event('input',{bubbles:true}))});}
const shared={slug:'shared',name:'共享技能',ownerSlug:'a',source:'https://source.test/skill',owner:'甲宠'};
const fixturePets=[{slug:'a',name:'甲宠',number:1,aliases:['甲'],skills:[{name:'共享技能',learnMethod:'升级学习',learnLevel:15}],sourceUrl:'https://source.test/a'},{slug:'b',name:'乙宠',number:2,skills:[{slug:'shared',name:'旧技能名'}]},{slug:'c',name:'丙宠',number:3,localEntry:true,skills:[]}];
const extras=[{petSlug:'a',method:'技能石',level:20,sourceUrl:'https://source.test/a-note'},{petSlug:'c',method:'',level:'',sourceUrl:'https://source.test/c'}];
const combined=C.resolveSkillLearners({skill:shared,pets:fixturePets,learners:extras});
check('Owner hints, pet pools and explicit additions merge into a deduplicated union',combined.rows.map(row=>row.pet.slug).join(',')==='a,b,c');
check('Known pool method and level are preserved',C.resolveSkillLearners({skill:shared,pets:fixturePets}).rows[0].method==='升级学习'&&C.resolveSkillLearners({skill:shared,pets:fixturePets}).rows[0].level===15);
check('Explicit source-backed learning details can refine the aggregate',combined.rows[0].method==='技能石'&&combined.rows[0].level===20&&combined.rows[0].sources.some(row=>row.url==='https://source.test/a-note'));
check('Unknown method and level remain unknown',combined.rows[1].method===''&&combined.rows[1].level===null&&combined.rows[2].method==='');
check('Removing supplemental rows retains every imported pool relation',C.resolveSkillLearners({skill:shared,pets:fixturePets,learners:[]}).rows.map(row=>row.pet.slug).join(',')==='a,b');
check('Stable skill slug still matches after a name change',combined.rows.some(row=>row.pet.slug==='b'));
check('Missing or deleted pet references are reported without broken cards',C.resolveSkillLearners({skill:shared,pets:[...fixturePets,{slug:'gone',name:'已删除',deleted:true}],learners:[{petSlug:'gone',sourceUrl:'https://source.test/gone'},{petSlug:'unknown',sourceUrl:'https://source.test/u'}]}).unresolved.length===2);
check('Local pet routes retain the entry query',C.petDetailHref(fixturePets[2])==='/pets/?entry=c');
check('Missing learning method and level are valid with a source',Object.keys(C.validateSkillLearnerData({learners:[{petSlug:'c',method:'',level:'',sourceUrl:'https://source.test/c'}]},fixturePets)).length===0);
check('Invalid levels, unknown pets and duplicate relations are rejected',Object.keys(C.validateSkillLearnerData({learners:[{petSlug:'c',level:101,sourceUrl:'https://source.test/c'},{petSlug:'c',level:'',sourceUrl:'https://source.test/c'},{petSlug:'unknown',sourceUrl:'https://source.test/u'}]},fixturePets)).length===3);
check('Learning source URLs reject executable schemes',!!C.validateSkillLearnerData({learners:[{petSlug:'a',sourceUrl:'javascript:alert(1)'}]},fixturePets)['learners.0.sourceUrl']);
const request={entity:'霞姿月韵',section:'学习宠物',mode:'skill',record:'learners',returnTo:'/skills/xiazi/#owners',intent:'edit'};
const snapshot=C.getPublishedSnapshot(request,{submissions:[]});
check('Learning edits have an isolated snapshot identity',snapshot.key==='skill-learners::xiazi'&&snapshot.key!==C.getPublishedSnapshot({...request,record:'base'},{submissions:[]}).key);
check('Learning snapshots contain no editable effect or description payload',Array.isArray(snapshot.data.learners)&&!Object.hasOwn(snapshot.data,'phases')&&!Object.hasOwn(snapshot.data,'summary'));
const learningData={...snapshot.data,learners:[{petSlug:'dimo',method:'验证用学习方式',level:18,sourceUrl:'https://source.test/dimo',sourceTitle:'测试证据'}]};
const submission={id:'learner-published',status:'published',editorVersion:7,editorMode:'skill',editorRequest:request,snapshotKey:snapshot.key,typedData:{...learningData,name:'不得覆盖名称',common:'不得覆盖效果',summary:'不得覆盖描述'},updatedAt:'2026-10-10T12:00:00Z'};
const original=C.skills.find(row=>row.slug==='xiazi'),projected=C.resolvePublishedCatalogSkills({skills:C.skills,submissions:[submission]}).find(row=>row.slug==='xiazi');
check('A learning publication modifies only the learning relation',projected.name===original.name&&projected.summary===original.summary&&JSON.stringify(projected.common)===JSON.stringify(original.common)&&projected.learners[0].petSlug==='dimo');
check('A learning publication does not claim to replace battle rules',!projected.publishedRules&&projected.publishedLearnersRevision===submission.id);
check('Draft learning records stay out of public reading',!C.resolvePublishedCatalogSkills({skills:C.skills,submissions:[{...submission,status:'pending'}]}).find(row=>row.slug==='xiazi').learners);
const full=C.getPublishedSnapshot({...request,record:'base'},{submissions:[]});const normalEdit={...submission,id:'ordinary-skill',editorRequest:{...request,record:'base'},snapshotKey:full.key,typedData:{...full.data,common:'新的基础效果',learners:[]},updatedAt:'2026-10-10T13:00:00Z'};
const afterNormal=C.resolvePublishedCatalogSkills({skills:C.skills,submissions:[submission,normalEdit]}).find(row=>row.slug==='xiazi');
check('Later normal skill edits preserve learning data',afterNormal.common[0]==='新的基础效果'&&afterNormal.learners[0].petSlug==='dimo');
const next=C.getPublishedSnapshot(request,{submissions:[submission,normalEdit]});
check('Reopening a learning edit reads the published relation and current skill identity',next.scope==='local'&&next.data.name===original.name&&next.data.learners[0].level===18&&!Object.hasOwn(next.data,'common'));
check('General skill editor cannot load the learning-only snapshot by accident',Object.hasOwn(C.getPublishedSnapshot({...request,record:'base'},{submissions:[submission]}).data,'common'));
const scopedForm={...C.formFor(snapshot,request),typedData:learningData,summary:'补充学习关系资料',evidenceNote:'测试资料中记录了宠物与技能的学习条件'};
check('Learning-specific validation does not require unrelated skill description',Object.keys(C.validateSectionForm(scopedForm)).length===0);
check('Learning differences use the learning-method label',C.serializeData('skill',learningData).includes('学习方式：验证用学习方式'));
check('Even an add-intent learner request cannot append a skill branch',!Object.hasOwn(C.formFor(snapshot,{...request,intent:'add'}).typedData,'phases'));
await render(React.createElement(C.SkillLearners,{skill:{...shared,learners:extras},pets:fixturePets}));
check('Reader renders a compact card for each distinct learner',d.querySelectorAll('.rw-learner-card-v73').length===3&&!d.querySelector('.rw-owner-row'));
check('Pets without an image use the portrait symbol instead of requesting a blank URL',d.querySelectorAll('.rw-learner-card-v73 img').length===0&&d.querySelectorAll('.rw-learner-portrait-v73 svg').length===3);
check('Local learner card opens the local pet skill pool',!!d.querySelector('a[href="/pets/?entry=c#skills"]'));
check('All contributing sources stay accessible',!!d.querySelector('a[href="https://source.test/a-note"]')&&!!d.querySelector('a[href="https://source.test/a"]'));
await input('搜索学习宠物','乙');check('Search filters the compact relationship grid',d.querySelectorAll('.rw-learner-card-v73').length===1&&d.querySelector('.rw-learner-card-v73').textContent.includes('乙宠'));
const many=Array.from({length:30},(_,index)=>({slug:'pet-'+index,name:'宠物'+index,number:index+1,skills:[{name:shared.name}]}));
await render(React.createElement(C.SkillLearners,{skill:shared,pets:many}));check('Large learner sets start with a bounded card batch',d.querySelectorAll('.rw-learner-card-v73').length===12);
await click('显示更多（还有 18 只）');check('More results expand without replacing previous cards',d.querySelectorAll('.rw-learner-card-v73').length===24);
await input('搜索学习宠物','宠物29');check('Searching covers the entire set, not just the visible batch',d.querySelectorAll('.rw-learner-card-v73').length===1&&d.querySelector('.rw-learner-card-v73').textContent.includes('宠物29'));
let data;
await render(React.createElement(C.FieldHarness,{initial:snapshot.data,onData:next=>{data=next}}));
await click('补充 迪莫 的学习关系');await click('补充 阿布 的学习关系');
check('The dedicated editor supports selecting multiple recorded pets',data.learners.length===2&&d.querySelectorAll('[role="checkbox"][aria-checked=true]').length===2);
await input('迪莫 · 学习方式（可选）','验证用学习方式');await input('迪莫 · 学习等级（可选）','18');await input('迪莫 · 来源链接','https://source.test/dimo');
check('Learning method, optional level and source edit their own relation',data.learners[0].method==='验证用学习方式'&&data.learners[0].level==='18'&&data.learners[0].sourceUrl==='https://source.test/dimo'&&data.learners[1].method==='');
await click('移除 阿布 的关联补充');check('Removing one supplemental relation leaves the others intact',data.learners.length===1&&data.learners[0].petSlug==='dimo');
await render(React.createElement(C.ReadPreviewFrame,{mode:'skill',data,context:request}));
check('Learning preview uses the same aggregated card component',!!d.querySelector('iframe').contentDocument.querySelector('[data-skill-learners="xiazi"]')&&d.querySelector('iframe').contentDocument.querySelectorAll('.rw-learner-card-v73').length===2);
check('Learning preview does not invent an empty skill-effect form',!d.querySelector('iframe').contentDocument.querySelector('[data-skill-flow]'));
let workspace={profile:{nickname:'验证用户',uuid:'11111111-1111-4111-8111-111111111111'},drafts:[],submissions:[]};
const query=new URLSearchParams({entity:request.entity,section:request.section,mode:'skill',record:'learners',returnTo:request.returnTo});
await render(React.createElement(C.EditorHarness,{query,initial:workspace,onWorkspace:next=>{workspace=next}}));
check('The full editor opens directly on the learning form',!!d.querySelector('.rw-learner-editor-v73')&&!d.querySelector('.ev72-skill-flow-editor'));
await click('补充 迪莫 的学习关系');await input('迪莫 · 来源链接','https://source.test/dimo');
await input('修改摘要','补充学习宠物关联');await input('证据定位与核验方法','来源页的技能列表中记载了学习关系');
await click('预览效果');check('Full editor preview shows both imported and newly selected learners',d.querySelector('iframe')?.contentDocument.querySelectorAll('.rw-learner-card-v73').length===2);
await click('提交本地审核');
check('Submitting a learning edit creates a scoped reviewable record',workspace.submissions.length===1&&workspace.submissions[0].snapshotKey==='skill-learners::xiazi'&&workspace.submissions[0].editorRequest.record==='learners'&&!Object.hasOwn(workspace.submissions[0].typedData,'phases'));
workspace.submissions=workspace.submissions.map(row=>({...row,status:'published'}));w.localStorage.setItem('roco-wiki-v4:community',JSON.stringify(workspace));
await render(React.createElement(C.SkillPage,{slug:'xiazi'}));
check('The real SkillPage reads published additions beside imported learners',d.querySelectorAll('#owners .rw-learner-card-v73').length===2&&d.querySelector('#owners').textContent.includes('迪莫'));
const editLink=[...d.querySelectorAll('#owners a')].find(node=>node.textContent.includes('编辑学习关系'));const url=new URL(editLink.href);
check('The real learning section exposes the precise implemented editor route',url.searchParams.get('mode')==='skill'&&url.searchParams.get('record')==='learners'&&url.searchParams.get('returnTo').endsWith('#owners'));
check('Owners no longer offers the unrelated generic article editor',![...d.querySelectorAll('#owners a[href^="/edit/"]')].some(node=>new URL(node.href).searchParams.get('mode')==='article'));
global.__location={pathname:'/pets/dimo/',search:''};await render(React.createElement(C.PetPage,{slug:'dimo'}));
check('The reverse pet skill pool also contains the newly related skill',!!d.querySelector('#skills a[href*="/skills/xiazi/"]'));
const css=fs.readFileSync(path.join(project,'src/wiki/SkillLearners.css'),'utf8');
check('Learner, relationship and source cards share rounded responsive styling',css.includes('.rw-learner-grid-v73{display:grid')&&css.includes('#relations .rw-relation-list>a')&&css.includes('#sources .rw-source-row')&&css.includes('border-radius:20px'));
check('No unexpected React or JavaScript errors occurred',errors.length===0);
}
main().catch(error=>{errors.push(String(error.stack||error));process.exitCode=1}).finally(async()=>{if(root)try{await act(async()=>root.unmount())}catch{}if(dom)dom.window.close();if(oldError)console.error=oldError;const sourceHashes=Object.fromEntries(sourceFiles.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(project,file))).digest('hex')]));const report={suite:'V7.3 many-to-many skill learners',checkedAt:new Date().toISOString(),checks,passed:checks.filter(row=>row.pass).length,total:checks.length,failed:checks.filter(row=>!row.pass).length,sourceHashes,errors,browserVisualQA:false};fs.writeFileSync(path.join(project,'validation/v73-learners-check-results.json'),JSON.stringify(report,null,2)+'\n');fs.rmSync(temporary,{recursive:true,force:true});console.log(JSON.stringify({passed:report.passed,total:report.total,failed:report.failed,errors},null,2))});
