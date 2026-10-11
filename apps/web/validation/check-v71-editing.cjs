/** V7.1 editing contracts and real DOM interactions; does not claim visual device QA. */
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
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'roco-v71-editing-'));
const checks = [];
const warnings = [];
const check = (label, value) => { checks.push({ label, pass: Boolean(value) }); assert.ok(value, label); };
const sourceFiles = ['src/wiki/editing/model.js','src/wiki/editing/registry.js','src/wiki/editing/TypedFields.jsx','src/wiki/editing/SkillBranchEditor.jsx','src/wiki/editing/SectionEditor.jsx','src/wiki/editing/PreviewContent.jsx','src/wiki/editing/publishedRecords.js','src/wiki/skillConditions.js','src/wiki/SkillBranchView.jsx','src/wiki/SkillBranchView.css','src/wiki/matchupBloodlines.js','src/wiki/EditingV7.css'];
async function main() {
  await esbuild.build({ stdin: { resolveDir: project, loader: 'jsx', contents: `
    import React, {useState} from 'react';
    import SectionEditor from './src/wiki/editing/SectionEditor';
    import SkillBranchEditor from './src/wiki/editing/SkillBranchEditor';
    export * from './src/wiki/editing/model';
    export * from './src/wiki/editing/registry';
    export * from './src/wiki/editing/publishedRecords';
    export * from './src/wiki/skillConditions';
    export * from './src/wiki/matchupBloodlines';
    export * from './src/wiki/catalogPublished';
    export {default as PreviewContent, ReadPreviewFrame} from './src/wiki/editing/PreviewContent';
    export {default as SkillBranchEditor} from './src/wiki/editing/SkillBranchEditor';
    export {formFor} from './src/wiki/editing/SectionEditor';
    export function BranchHarness({seed,onChange}) { const [rows,setRows]=useState(seed); return <SkillBranchEditor branches={rows} onChange={next=>{setRows(next);onChange(next)}} />; }
    export function Harness({query,workspace,onWorkspace}) {
      const [value,setValue]=useState(workspace);
      const update=React.useCallback(fn=>setValue(old=>{const next=fn(old);onWorkspace?.(next);return next}),[onWorkspace]);
      return <SectionEditor workspace={value} update={update} ready query={query} DiffViewer={({before,after})=><div data-test-diff>{before}<hr/>{after}</div>} />;
    }
  ` }, outfile: path.join(temporary,'check.cjs'), bundle: true, format:'cjs', platform:'node', loader:{'.css':'empty'}, logLevel:'silent', plugins:[{name:'framework',setup(build){
    build.onResolve({filter:/^(react|react-dom|lucide-react)(\/.*)?$/}, args=>({path:require.resolve(args.path,{paths:[project]}),external:true}));
    build.onResolve({filter:/^@docusaurus\//}, args=>({path:args.path,namespace:'mock'}));
    build.onLoad({filter:/.*/,namespace:'mock'}, args=>({loader:'jsx',resolveDir:project,contents: args.path.endsWith("/useBrokenLinks") ? "export default function useBrokenLinks(){return {collectAnchor(value){if(value)globalThis.__rocoAnchorSet?.add(value)},collectLink(){}};}" : args.path.endsWith('/router') ? `export function useHistory(){return {replace(){},push(){}}};export function useLocation(){return {pathname:"/",search:""}}` : args.path.endsWith('/Link') ? `import React from 'react';export default function Link({to,children,...rest}){return <a href={to} {...rest}>{children}</a>}` : `export default function useBaseUrl(value){return value}`}));
  }}] });
  const dom = new JSDOM('<!doctype html><head><style>.preview-marker { color: purple }</style></head><body><div id="root"></div></body>', {url:'https://wiki.test/edit/',pretendToBeVisual:true});
  const w = dom.window, d=w.document;
  Object.assign(global,{window:w,document:d,HTMLElement:w.HTMLElement,CustomEvent:w.CustomEvent,localStorage:w.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  w.HTMLElement.prototype.scrollIntoView=()=>{}; w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  const oldError=console.error; console.error=(...args)=>warnings.push(args.map(String).join(' '));
  const C=require(path.join(temporary,'check.cjs'));
  const {createRoot}=require('react-dom/client');
  const {renderToStaticMarkup}=require('react-dom/server');
  let root=createRoot(d.querySelector('#root'));
  async function render(node){await act(async()=>root.unmount());root=createRoot(d.querySelector('#root'));await act(async()=>{root.render(node);await new Promise(r=>setTimeout(r,5))})}
  async function click(label, scope=d){const button=[...scope.querySelectorAll('button')].find(el=>el.textContent.trim()===label||el.getAttribute('aria-label')===label);assert.ok(button,'button '+label);await act(async()=>button.click());return button}
  async function input(label,value){const el=d.querySelector(`[aria-label="${label}"]`);assert.ok(el,'input '+label);const proto=el.tagName==='TEXTAREA'?w.HTMLTextAreaElement.prototype:w.HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new w.Event('input',{bubbles:true}));});}
  const legacy={label:'来源中的阶段标题',when:'满足原文条件',effect:'原有成立效果',otherwiseWhen:'另有来源明确的条件',otherwise:'另一效果',input:true,extra:{source:'original'}};
  const normalized=C.normalizeSkillBranch(legacy);
  check('Legacy branch normalization retains original fields and metadata losslessly',Object.keys(legacy).every(key=>JSON.stringify(normalized[key])===JSON.stringify(legacy[key])));
  check('Legacy alternate conditions become an explicit secondary branch',normalized.otherwiseBranch.conditionTree.text===legacy.otherwiseWhen&&normalized.otherwiseBranch.effect===legacy.otherwise);
  for(const preset of ['1-2-3','1-2to5-6','1to2-3-4','first-middle-last','first-later']){
    const rows=C.makeBranchPreset(preset,'skill-sequence','',preset).map(row=>({...row,effect:'有来源的阶段效果'}));
    check('Preset supports '+preset,Object.keys(C.validateSkillBranches(rows).errors).length===0&&rows.length>=2);
  }
  const grouped=C.makeBranchPreset('1-2to5-6','skill-sequence','','schedule');grouped.forEach(row=>row.effect='可核验的效果');grouped[1].conditionTree.ranges=[{start:1,end:5}];
  check('Overlapping exclusive schedule segments are rejected',Object.values(C.validateSkillBranches(grouped).errors).some(value=>value.includes('重叠')));
  const arbitrary={label:'不连续回合',effect:'示例效果',conditionTree:{kind:'rounds',basis:'battle-round',mode:'ranges',ranges:[{start:1,end:2},{start:4,end:4},{start:7,end:9}]}};
  check('Arbitrary disjoint ordinal groups remain valid',Object.keys(C.validateSkillBranches([arbitrary]).errors).length===0);
  check('Reversed or noninteger range ends are rejected',Object.keys(C.validateSkillBranches([{...arbitrary,conditionTree:{...arbitrary.conditionTree,ranges:[{start:3,end:2}]}}]).errors).length>0);
  check('Counting basis is required for structured round conditions',Object.values(C.validateSkillBranches([{...arbitrary,conditionTree:{...arbitrary.conditionTree,basis:'unspecified'}}]).errors).some(value=>value.includes('计数')));
  const nested={label:'复合条件',when:'原始文字保留',effect:'先结算主效果',conditionTree:{kind:'group',operator:'all',children:[arbitrary.conditionTree,{kind:'group',operator:'any',children:[{kind:'clause',text:'存在来源说明的天气'},{kind:'clause',text:'具有指定标记'}]}]},children:[{label:'子分支',when:'精力满足条件',effect:'再结算子效果'}],otherwiseBranch:{conditionTree:null,effect:'来源明确说明的否则效果',children:[]}};
  check('Nested all/any conditions and effect branches validate',Object.keys(C.validateSkillBranches([nested]).errors).length===0);
  check('Nested branch serialization stays human-readable',C.serializeData('skill',{phases:[nested]}).includes('任')===false&&C.serializeData('skill',{phases:[nested]}).includes('或')&&!C.serializeData('skill',{phases:[nested]}).includes('[object Object]'));
  check('Stored nested conditions survive bounded sanitization',JSON.stringify(C.sanitizeData({phases:[nested]}))===JSON.stringify({phases:[nested]}));
  const repeated=[{...arbitrary,conditionTree:{...arbitrary.conditionTree,ranges:[{start:1,end:3},{start:3,end:6}]}}];
  check('Overlaps within a single condition are rejected',Object.values(C.validateSkillBranches(repeated).errors).some(value=>value.includes('合并')));
  const independent=[arbitrary,{...arbitrary,label:'另一个可同时结算的效果'}];
  check('Potentially simultaneous effects produce a warning instead of invented exclusivity',!Object.keys(C.validateSkillBranches(independent).errors).length&&C.validateSkillBranches(independent).warnings.length===1);
  check('Missing bloodline is distinct from confirmed none',C.matchupBloodlineText(undefined)!==C.matchupBloodlineText({status:'none'}));
  check('Bloodline order does not change claim identity',JSON.stringify(C.matchupBloodlineClaim({status:'specified',names:['乙','甲']}))===JSON.stringify(C.matchupBloodlineClaim({status:'specified',names:['甲','乙']})));
  const matchup={...C.blankMatchup(),id:'pair',opponent:'对手',scene:'already-active',conditions:'明确的成立条件',conclusion:'有条件占优',limitations:'例外条件待逐项核验',sourceUrl:'https://example.org/evidence'};
  const publication={id:'pub-bloodline',status:'published',editorVersion:7,editorMode:'matchup',editorRequest:{entity:'旧宠物名',mode:'matchup',record:'pair'},updatedAt:'2026-10-10',typedData:{records:[{...matchup,myBloodline:{status:'specified',names:['指定血脉'],note:'满级'}}]}};
  const resolved=C.resolvePublishedRecords({entity:'新宠物名',entityAliases:['旧宠物名'],mode:'matchup',records:[matchup],submissions:[publication]});
  check('Both bloodline loadouts survive publication and change the claim version',resolved.records[0].myBloodline.names[0]==='指定血脉'&&resolved.records[0].opponentBloodline.status==='unknown'&&resolved.records[0].claimRevision.startsWith('local-'));
  let editedBranches=[legacy];
  await render(React.createElement(C.BranchHarness,{seed:editedBranches,onChange:value=>{editedBranches=value}}));
  d.querySelector('.ev71-preset-panel').open=true;
  await click('模板计数依据');const basisOption=[...d.querySelectorAll('[role="option"]')].find(el=>el.textContent==='本次连续技能内的回合');await act(async()=>basisOption.click());
  await click('添加这组分支');
  check('The branch form appends a 1 / 2–5 / 6 schedule without erasing an existing effect',editedBranches.length===4&&editedBranches[0].effect===legacy.effect&&editedBranches[2].conditionTree.ranges[0].end===5);
  await click('再加文字条件');
  check('The branch form preserves the existing condition when combining it with another',editedBranches[0].conditionTree.kind==='group'&&editedBranches[0].conditionTree.children[0].text===legacy.when);
  await click('条件组判断方式 · 分支 1 · 条件');const anyOption=[...d.querySelectorAll('[role="option"]')].find(el=>el.textContent==='以下条件任一满足（或）');await act(async()=>anyOption.click());
  check('Editors can choose any instead of all for a condition group',editedBranches[0].conditionTree.operator==='any');
  await click('在成立效果下添加嵌套分支');
  check('The form supports effects nested below a satisfied parent condition',editedBranches[0].children.length===1);
  check('The visible form uses human field labels instead of schema paths',!d.body.textContent.includes('phases.')&&!d.body.textContent.includes('conditionTree'));
  const req={entity:'新增宠物',section:'宠物资料',mode:'pet',intent:'add',returnTo:'/pets/'};
  const snap=C.getPublishedSnapshot(req,{submissions:[]});check('New pet editor starts with one blank pet, not a catalogue',snap.data.name===''&&snap.data.slug===''&&!snap.data.entries&&!snap.exists);
  const directory=C.getPublishedSnapshot({entity:'宠物图鉴',section:'目录',mode:'index',returnTo:'/pets/'});check('Legacy catalogue editor URLs are explicitly scope-blocked',directory.directoryManaged);
  const placeReq={entity:'地图与地区',section:'补充地点快捷入口',mode:'index',intent:'add',returnTo:'/places/'};const placeForm=C.formFor(C.getPublishedSnapshot(placeReq),placeReq);
  check('Adding a place shortcut starts with exactly one empty entry',placeForm.typedData.entries.length===1&&!placeForm.typedData.entries[0].title);
  const validBase={summary:'补充已核验资料',evidenceNote:'原始来源中对应的条目说明'};
  const badPlace={...placeForm,...validBase,typedData:{...placeForm.typedData,entries:[{title:'错误入口',href:'/places/not-real/'}]}};check('A new place shortcut must point at an existing registered place',!!C.validateSectionForm(badPlace)['entries.0.href']);
  const pveReq={entity:'星辰之塔',section:'挑战方案',mode:'pve',returnTo:'/pve/star-tower/',record:'new-pve'};const pveLocal={id:'new-pve',editorVersion:7,editorMode:'pve',status:'published',editorRequest:{...pveReq,intent:'add',record:''},typedData:{title:'新方案标题',challenge:'指定关卡',pets:'指定宠物',requirements:'必要配置',steps:'步骤一',version:'已核验版本',sourceUrl:'https://example.org/pve'},updatedAt:'2026-10-10'};
  check('Newly published PVE plans reopen their actual content',C.getPublishedSnapshot(pveReq,{submissions:[pveLocal]}).data.title==='新方案标题');
  const dataByMode={article:{markdown:'## 修改后的标题\n\n这是**修改后的正文**。\n\n| 条件 | 效果 |\n| --- | --- |\n| 一 | 二 |'},acquisition:{records:[{title:'历史获取',startDate:'2024-01-01',endDate:'2024-02-01',place:'资料地点',conditions:'明确条件',reward:'宠物奖励',sourceUrl:'https://example.org'}]},event:{name:'返场活动',summary:'活动说明',occurrences:[{label:'首次开放',startDate:'2024-01-01',location:'地点',rewards:'旧奖励'},{label:'再次开放',startDate:'2025-01-01',location:'地点',rewards:'新奖励'}]},skill:{name:'技能示例',summary:'技能描述',common:'基础效果',phases:[nested]},matchup:{records:[publication.typedData.records[0]]},npc:{name:'人物示例',role:'身份',location:'地点',intro:'人物介绍正文',services:'服务内容',relatedTasks:'任务内容'},pet:{name:'宠物示例',types:'水、火',number:123,hp:100,attack:120,defense:100,magicAttack:130,magicDefense:100,speed:120},pve:pveLocal.typedData,index:{title:'入口',entries:[{title:'魔法学院',href:'/places/academy/',description:'地点用途'}]},relationship:{sourceEffect:'已有状态',incomingEffect:'新状态',order:'先施加已有状态',timing:'回合末',conditions:'相同配置',result:'观察到覆盖',certainty:'已复现',reproduction:'重复对照步骤'}};
  for(const [mode,data] of Object.entries(dataByMode)){
    const html=renderToStaticMarkup(React.createElement(C.PreviewContent,{mode,data,context:{entity:'当前宠物',returnTo:'/pets/haifu/'}}));
    check('Rendered reading preview supports '+mode,html.length>80&&!html.includes('[object Object]')&&!html.includes('/edit/?')&&!html.includes('<pre>{'));
  }
  await render(React.createElement(C.ReadPreviewFrame,{mode:'skill',data:dataByMode.skill,context:{entity:'技能示例',section:'条件与效果分支'}}));
  let frame=d.querySelector('iframe');
  check('Reading preview uses a named same-origin script-disabled iframe',frame&&frame.getAttribute('sandbox')==='allow-same-origin'&&frame.title.includes('技能'));
  check('Real rendered draft branches mount inside the isolated iframe',frame.contentDocument.body.textContent.includes('先结算主效果')&&frame.contentDocument.body.textContent.includes('否则效果'));
  check('Preview copies the reader styles into the iframe',frame.contentDocument.head.textContent.includes('preview-marker'));
  const beforeStorage=w.localStorage.length;await click('手机');check('Phone preview switches the independent viewport to 390 px styling',d.querySelector('[data-preview-width="mobile"]')&&d.querySelector('[aria-pressed="true"]').textContent==='手机');
  check('Changing reading viewport writes no local records',w.localStorage.length===beforeStorage);
  await render(React.createElement(C.ReadPreviewFrame,{mode:'index',data:dataByMode.index,context:{entity:'资料入口'}}));frame=d.querySelector('iframe');const anchor=frame.contentDocument.querySelector('a');const previousUrl=w.location.href;await act(async()=>anchor.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true})));
  check('Preview links cannot navigate away from the draft',w.location.href===previousUrl&&d.querySelector('[role="status"]').textContent.includes('/places/academy/'));
  const workspace={version:1,profile:{nickname:'测试访客'},submissions:[],drafts:[]};let updated=workspace;const onWorkspace=next=>{updated=next};
  await render(React.createElement(C.Harness,{workspace,query:new URLSearchParams(C.editorHref(req).split('?')[1]),onWorkspace}));
  check('The main editor exposes effect preview separately from diff', [...d.querySelectorAll('button')].some(el=>el.textContent.trim()==='预览效果')&&[...d.querySelectorAll('button')].some(el=>el.textContent.trim()==='对照差异'));
  await input('宠物名称','新增测试宠物');await input('修改摘要','新增有来源的测试宠物');await input('证据定位与核验方法','测试用来源明确记录这只宠物的编号与资料。');await click('预览效果');
  check('Preview displays the changed pet name before submission',d.querySelector('iframe').contentDocument.body.textContent.includes('新增测试宠物'));
  await click('对照差异');check('Diff view does not replace the reading preview tab',d.querySelector('[data-test-diff]')&&!d.querySelector('iframe'));
  await click('继续编辑');await click('提交本地审核');
  const submission=updated.submissions[0];check('New pet submission has a stable identity and narrowly scoped add intent',submission?.editorRequest.intent==='add'&&submission.typedData.slug===submission.editorRequest.record&&submission.snapshotKey==='pet::'+submission.typedData.slug&&submission.target==='新增测试宠物');
  check('New pet merge baseline remains compatible after identity allocation',C.getPublishedSnapshot(submission.editorRequest,{submissions:[]}).revision===submission.baseVersion);
  const pub={...submission,status:'published'};const catalogue=C.resolvePublishedCatalogPets({pets:[],submissions:[pub]});const editReq={entity:'新增测试宠物',section:'宠物资料',mode:'pet',record:pub.typedData.slug,returnTo:C.petDetailHref(catalogue[0])};
  check('Published new pet can be reopened by stable ID with all fields',C.getPublishedSnapshot(editReq,{submissions:[pub]}).data.name==='新增测试宠物');
  await render(React.createElement(C.Harness,{workspace,query:new URLSearchParams('entity=宠物图鉴&mode=index&returnTo=%2Fpets%2F'),onWorkspace}));
  check('Old broad pet-directory edit shows scoped actions instead of form fields',d.body.textContent.includes('请编辑具体条目')&&!d.querySelector('form')&&[...d.querySelectorAll('a')].some(el=>el.textContent==='新增宠物'));
  await act(async()=>root.unmount());console.error=oldError;
  check('No React or uncaught render errors in the edited workflows',warnings.length===0);
  dom.window.close();
}
main().then(()=>{const sourceHashes=Object.fromEntries(sourceFiles.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(project,file))).digest('hex')]));fs.writeFileSync(path.join(__dirname,'v71-editing-check-results.json'),JSON.stringify({version:'7.1',checkedAt:new Date().toISOString(),checks,total:checks.length,passed:checks.filter(x=>x.pass).length,sourceHashes,method:'esbuild + React SSR + JSDOM interaction; no screenshot or device performance claims'},null,2)+'\n');process.stdout.write(`${checks.length}/${checks.length} V7.1 editing checks passed\n`);fs.rmSync(temporary,{recursive:true,force:true})}).catch(error=>{process.stderr.write(error.stack+'\n'+warnings.join('\n')+'\n');process.exitCode=1;fs.rmSync(temporary,{recursive:true,force:true})});
