/** V7.2 PVE publishing, difficulty scope, page attribution, DOM and SSR contracts. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const project = path.resolve(__dirname,"..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(),"roco-v72-world-"));
const bundle = path.join(temporary,"suite.cjs");
const esbuild = require(require.resolve("esbuild",{paths:[project]}));
const React = require(require.resolve("react",{paths:[project]}));
const { JSDOM } = require(require.resolve("jsdom",{paths:[project]}));
const checks = [], errors = [];
const originalError = console.error;
console.error = (...args) => errors.push(args.map(String).join(" "));
const check = (label,value,details) => checks.push({label,pass:Boolean(value),...(details?{details}: {})});
let dom,root;
async function main() {
  await esbuild.build({stdin:{contents:`import React from "react";
    import PvePages from "./src/wiki/PvePages.jsx"; import {useLocation} from "@docusaurus/router";
    export function PveApp(){const loc=useLocation();return <PvePages path={loc.pathname} query={new URLSearchParams(loc.search)} />;}
    export {default as PvePages,guidePlansFrom} from "./src/wiki/PvePages.jsx";
    export * from "./src/wiki/pvePublished.js"; export * from "./src/wiki/PveGuideEditor.jsx";
    export {default as SevenSanctuaries} from "./src/wiki/SevenSanctuaries.jsx";
    export * from "./src/wiki/pageCommunityModel.js"; export * from "./src/wiki/communitySocialModel.js";
    export {default as PageCommunityFooter,GuideLikeButton} from "./src/wiki/PageCommunityFooter.jsx";
    export {getPublishedSnapshot} from "./src/wiki/editing/registry.js";
    export {default as TypedFields} from "./src/wiki/editing/TypedFields.jsx";
    export {validateSectionForm} from "./src/wiki/editing/model.js";
    export {PageHeader} from "./src/wiki/core.jsx";`,resolveDir:project,loader:"jsx"},outfile:bundle,bundle:true,format:"cjs",platform:"node",loader:{".css":"empty"},logLevel:"silent",plugins:[{name:"local-ui-environment",setup(build){
      build.onResolve({filter:/^(react|react-dom|lucide-react)(\/.*)?$/},args=>({path:require.resolve(args.path,{paths:[project]}),external:true}));
      build.onResolve({filter:/^@docusaurus\//},args=>({path:args.path,namespace:"docusaurus-stub"}));
      build.onLoad({filter:/.*/,namespace:"docusaurus-stub"},args=>({loader:"jsx",resolveDir:project,contents:args.path.endsWith("/useBrokenLinks")?'export default function(){return {collectAnchor(v){if(v)globalThis.__rocoAnchorSet?.add(v)},collectLink(){}}}':args.path.endsWith("/Link")?'import React from "react";export default function({to,children,...rest}){return <a href={to} {...rest}>{children}</a>}':args.path.endsWith("/useBaseUrl")?'export default value=>value;':'import React from "react";const read=()=>typeof window === "undefined" ? globalThis.__ssrRoute||{pathname:"/pve/",search:"",hash:""}:{pathname:window.location.pathname,search:window.location.search,hash:window.location.hash};export function useLocation(){const[value,set]=React.useState(read);React.useEffect(()=>{const update=()=>set(read());window.addEventListener("test-route",update);return()=>window.removeEventListener("test-route",update)},[]);return value}export function useHistory(){return {replace(url){window.history.replaceState({},"",url);window.dispatchEvent(new window.Event("test-route"))},push(url){window.history.pushState({},"",url);window.dispatchEvent(new window.Event("test-route"))}}}'}));
    }}]});
  const C = require(bundle), base = JSON.parse(fs.readFileSync(path.join(project,"content/pve-v6.json"))), seven = JSON.parse(fs.readFileSync(path.join(project,"content/seven-sanctuaries-v72.json")));
  const authorA = "11111111-1111-4111-8111-111111111111", authorB = "22222222-2222-4222-8222-222222222222";
  const make = (id,mode,typedData,editorRequest,extra={}) => ({id,status:"published",editorVersion:7,editorMode:mode,typedData,editorRequest,authorId:authorA,author:"初稿作者",authorAvatar:"dimo",before:"",after:JSON.stringify(typedData,null,2),updatedAt:"2026-10-10T10:00:00.000Z",...extra});
  const lake = {...C.blankPveGuideData("local-pve-lake"),name:"验证秘境",summary:"验证两组挑战与资料来源",entrance:"页游：学院 → 秘境\nLITE：副本 → 秘境",cadence:"每日",goals:["training"],rewardSummary:"验证果实",sourceUrl:"https://example.test/pve-evidence",sourceTitle:"验证来源",checkedAt:"2026-10-10",sections:[{id:"first",title:"第一组关卡",bosses:"[海芙约忒](/pets/haifu/)",rewards:"验证奖励甲",conditions:"验证条件甲"},{id:"second",title:"第二组关卡",bosses:"验证对手乙",rewards:"验证奖励乙",conditions:"验证条件乙"}]};
  const added = make("pve-new","pve-guide",lake,{mode:"pve-guide",intent:"add",entity:lake.name,record:lake.id,returnTo:"/pve/?entry="+lake.id});
  const projection = submissions => C.resolvePublishedPveGuides({submissions});
  let local = projection([added]).find(row=>row.slug===lake.id);
  check("New PVE publication receives a stable local detail route",local?.name===lake.name&&C.pveGuideHref(local)==="/pve/?entry="+lake.id);
  check("Pending entries are excluded from the public PVE directory",projection([{...added,status:"pending_review"}]).length===base.guides.length);
  check("Native PVE routes keep their existing detail paths",C.pveGuideHref(base.guides[0])==="/pve/star-tower/");
  const renamed=make("pve-rename","pve-guide",{...lake,id:"attempted-id-change",name:"验证秘境修订"},{...added.editorRequest,intent:"edit"},{updatedAt:"2026-10-10T10:01:00.000Z"});
  local=projection([renamed,added]).find(row=>row.slug===lake.id);
  check("Renaming retains the stable PVE identity and searchable former name",local?.name==="验证秘境修订"&&local.aliases.includes(lake.name)&&local.localEntry);
  check("Add intent cannot replace a built-in PVE guide",projection([{...added,typedData:{...lake,id:"star-tower"},editorRequest:{...added.editorRequest,record:"star-tower"}}]).find(row=>row.slug==="star-tower").name==="星辰之塔");
  check("An edit cannot create an unknown PVE guide",projection([{...added,editorRequest:{...added.editorRequest,intent:"edit"}}]).length===base.guides.length);
  check("Complete PVE guide data passes meaningful field validation",C.validatePveGuideData(lake).length===0);
  check("Missing names, entrance, sections and source are reported",C.validatePveGuideData(C.blankPveGuideData()).length>=5);
  check("Unsafe source protocols are rejected before publication",C.validatePveGuideData({...lake,sourceUrl:"javascript:alert(1)"}).some(v=>v.includes("HTTP")));
  check("Over-limit section data is rejected instead of being silently truncated",C.validatePveGuideData({...lake,sections:Array.from({length:41},(_,i)=>({id:"part-"+i,title:"关卡"+i}))}).some(v=>v.includes("40")));
  check("Duplicate section IDs are reported",C.validatePveGuideData({...lake,sections:[lake.sections[0],lake.sections[0]]}).some(v=>v.includes("重复")));
  const reopened=C.getPublishedSnapshot({mode:"pve-guide",entity:local.name,record:lake.id,returnTo:"/pve/?entry="+lake.id,intent:"edit"},{submissions:[added,renamed]});
  check("Reopening a renamed local PVE guide reads its latest published fields",reopened.data.name===local.name&&reopened.data.sections[1].id==="second"&&reopened.scope==="local");

  const tower=base.guides.find(row=>row.slug==="star-tower"), towerData=C.pveGuideEditorData(tower);
  const reordered=make("tower-reorder","pve-guide",{...towerData,sections:[{...towerData.sections[1],conditions:"第八层专用验证条件"},{...towerData.sections[0],conditions:"前七层专用验证条件"}]},{mode:"pve-guide",record:tower.slug,entity:tower.name,returnTo:"/pve/star-tower/"});
  const missing=make("tower-missing","pve-guide",{...towerData,sections:[towerData.sections[0]]},{...reordered.editorRequest});
  check("A single remaining tower section is valid editor data",C.validatePveGuideData(missing.typedData).length===0);
  const sevenData=C.pveGuideEditorData(base.guides.find(row=>row.slug==="seven-sanctuaries"));
  check("All seven stages reopen with their stable weekday IDs",sevenData.sections.length===7&&sevenData.sections.every((row,i)=>row.id===seven.stages[i].id));
  check("Seven-stage editor begins with three independent empty difficulty records",sevenData.sections.every(row=>Object.keys(row.difficultyDetails).length===3&&Object.values(row.difficultyDetails).every(item=>!item.bosses&&!item.rewards)));
  const sevenEdit={...sevenData,sourceUrl:"https://example.test/seven-evidence",sourceTitle:"七曜测试来源",checkedAt:"2026-10-10",sections:sevenData.sections.map(row=>row.id==="moon"?{...row,bosses:"旧综合对手备注",rewards:"旧综合奖励备注",difficultyDetails:{easy:{bosses:"简单验证 BOSS",rewards:"简单验证奖励 11 颗"},normal:{bosses:"",rewards:""},hard:{bosses:"困难验证 BOSS",rewards:"困难验证奖励 23 颗"}}}:row)};
  const sevenPublication=make("seven-difficulties","pve-guide",sevenEdit,{mode:"pve-guide",record:"seven-sanctuaries",entity:"七曜圣地",returnTo:"/pve/seven-sanctuaries/"});
  const sevenProjection=projection([sevenPublication]).find(row=>row.slug==="seven-sanctuaries");
  const originalSeven=base.guides.find(row=>row.slug==="seven-sanctuaries");
  check("A structured guide revision preserves source rules, reward notes and steps outside the form",originalSeven.facts.every(fact=>sevenProjection.facts.some(row=>row.label===fact.label&&row.value===fact.value))&&originalSeven.rewards.every(reward=>sevenProjection.rewards.some(row=>row.name===reward.name&&row.note===reward.note))&&JSON.stringify(sevenProjection.steps)===JSON.stringify(originalSeven.steps));
  check("Published difficulty details preserve easy and hard independently",sevenProjection.sections[0].difficultyDetails.easy.bosses==="简单验证 BOSS"&&sevenProjection.sections[0].difficultyDetails.hard.bosses==="困难验证 BOSS"&&!sevenProjection.sections[0].difficultyDetails.normal.bosses);
  check("Reopening the published seven-day guide preserves every difficulty",JSON.stringify(C.getPveGuideEditorData(sevenPublication.editorRequest,{submissions:[sevenPublication]}).sections[0].difficultyDetails)===JSON.stringify(sevenEdit.sections[0].difficultyDetails));
  check("Seven-stage missing data is reported at the correct day and difficulty",sevenProjection.unknowns.some(row=>row.includes("月曜")&&row.includes("普通"))&&!sevenProjection.unknowns.some(row=>row.includes("月曜")&&row.includes("简单")));

  const planData={title:"单宠挑战记录",challenge:"验证关卡对手",version:"2026-10-10",testedAt:"2026-10-10",pets:"碧水灵兽",requirements:"验证培养配置",steps:"验证步骤",alternatives:"待实测",sourceUrl:"https://example.test/plan"};
  const plan=make("plan-a","pve",planData,{mode:"pve",intent:"add",entity:lake.name,returnTo:"/pve/?entry="+lake.id+"&view=second#pve-pets"});
  const revised=make("plan-b","pve",{...planData,steps:"第二位作者的修订步骤"},{...plan.editorRequest,intent:"edit",record:plan.id},{authorId:authorB,author:"修订作者",updatedAt:"2026-10-10T10:02:00.000Z"});
  const planProjection=C.guidePlansFrom(local,{submissions:[revised,plan]});
  check("PVE plans remain scoped to the specific local entry",planProjection.length===1&&C.guidePlansFrom({...local,slug:"another-local"},{submissions:[plan]}).length===0);
  check("A plan revision replaces its stable record without duplication",planProjection[0].recordId===plan.id&&planProjection[0].data.steps===revised.typedData.steps);
  check("A plan's original creator retains appreciation after another author revises it",planProjection[0].authorId===authorA&&planProjection[0].author==="初稿作者"&&planProjection[0].updatedBy==="修订作者");
  const historyPlan=C.guidePlansFrom(tower,null)[0];
  const historyRevision=make("history-revision","pve",planData,{mode:"pve",intent:"edit",record:historyPlan.recordId,entity:tower.name,returnTo:"/pve/star-tower/"},{authorId:authorB});
  check("Editing a source-derived historical plan does not claim its appreciation",!C.guidePlansFrom(tower,{submissions:[historyRevision]}).find(row=>row.recordId===historyPlan.recordId).authorId);

  check("Page identity retains local entry but removes filters and section anchors",C.canonicalPageKey("/pve/?view=first&entry=local-pve-lake#pve-pets")==="/pve/?entry=local-pve-lake"&&C.canonicalPageKey("/pve/star-tower/?level=8#pve-context")==="/pve/star-tower/");
  check("Unsafe external page identifiers cannot become page keys",C.canonicalPageKey("//outside.test/pve/")==="/"&&C.canonicalPageKey("https://outside.test/pve/")==="/");
  check("Whitespace-only and reordered lines do not inflate contribution totals",C.effectiveContributionLines("甲\n乙"," 乙 \n\n甲")===0&&C.effectiveContributionLines("#\n---\n","")===0);
  check("Replaced line ranges count the larger changed side",C.effectiveContributionLines("甲\n乙","丙\n丁\n戊")===3);
  const edits=[make("credit-a","article",{},{mode:"article",returnTo:"/pve/star-tower/?level=1"},{before:"旧",after:"新甲\n新乙"}),make("credit-b","article",{},{mode:"article",returnTo:"/pve/star-tower/?level=8"},{authorId:authorB,author:"另一作者",before:"",after:"第一行\n第二行\n第三行"}),make("credit-unidentified","article",{},{mode:"article",returnTo:"/pve/star-tower/"},{authorId:"",before:"",after:"历史贡献"})];
  const counts=C.pageMaintainers([...edits,edits[0],{...edits[0],id:"pending",status:"review"},{...edits[0],id:"example",isExample:true}],"/pve/star-tower/");
  check("Maintainers aggregate valid published authors, deduplicate and sort by changed lines",counts.people.length===2&&counts.people[0].uuid===authorB&&counts.people[0].lines===3&&counts.people[1].lines===2);
  check("Unattributed history stays unassigned to the current account",counts.unattributed===1&&counts.people.every(p=>p.revisions.every(row=>row.id!=="credit-unidentified")));
  check("Maintenance of one local entry cannot leak to another",C.pageMaintainers([added],"/pve/?entry=another-local").people.length===0&&C.pageMaintainers([added],"/pve/?entry="+lake.id).people[0].uuid===authorA);
  for(const[mode,kind]of[["pet","pets"],["skill","skills"],["npc","npcs"],["pve-guide","pve"]]){const record=make("created-"+mode,mode,{slug:"local-created-"+mode,id:"local-created-"+mode},{mode,intent:"add",returnTo:"/"+kind+"/"});check("New "+mode+" credit belongs to its new detail page",C.submissionPageKey(record)==="/"+kind+"/?entry=local-created-"+mode&&C.pageMaintainers([record],"/"+kind+"/").people.length===0);}
  check("Adding a skill branch credits the current skill detail, not a new skill",C.submissionPageKey(make("branch","skill",{name:"灵火之杖"},{mode:"skill",intent:"add",returnTo:"/skills/linghuo/#effects"}))==="/skills/linghuo/");

  dom=new JSDOM('<div id="app" class="rw"></div>',{url:"https://wiki.test/pve/",pretendToBeVisual:true});
  const w=dom.window,d=w.document;
  Object.assign(global,{window:w,document:d,HTMLElement:w.HTMLElement,Node:w.Node,localStorage:w.localStorage,MutationObserver:w.MutationObserver,CustomEvent:w.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(global,"navigator",{configurable:true,value:w.navigator});
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  let scrolled="";w.HTMLElement.prototype.scrollIntoView=function(){scrolled=this.dataset.pvePreviewStage||this.dataset.pveEditStage||this.id;};
  global.__rocoAnchorSet=new Set();
  const {createRoot}=require(require.resolve("react-dom/client",{paths:[project]}));root=createRoot(d.querySelector("#app"));
  async function render(Component=C.PveApp,props={},route="/pve/"){await React.act(async()=>root.unmount());w.history.replaceState({},"",route);root=createRoot(d.querySelector("#app"));await React.act(async()=>root.render(React.createElement(Component,props)));}
  async function save(submissions,uuid=authorB){await React.act(async()=>{w.localStorage.setItem(C.COMMUNITY_STORAGE_KEY,JSON.stringify({version:1,profile:{uuid,nickname:uuid===authorA?"初稿作者":"当前读者",avatar:"dimo"},submissions}));w.dispatchEvent(new w.CustomEvent("roco:community-updated"));});}
  async function saveSocial(state){await React.act(async()=>{w.localStorage.setItem(C.SOCIAL_STORAGE_KEY,JSON.stringify(state));w.dispatchEvent(new w.CustomEvent(C.SOCIAL_EVENT));});}
  async function click(el){assert.ok(el,"Click target must exist");await React.act(async()=>el.click());}
  async function input(el,value){assert.ok(el,"Input must exist");await React.act(async()=>{const proto=el.tagName==="TEXTAREA"?w.HTMLTextAreaElement.prototype:w.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,"value").set.call(el,value);el.dispatchEvent(new w.Event("input",{bubbles:true}));});}
  const textButton=(selector,value,scope=d)=>[...scope.querySelectorAll(selector)].find(el=>el.textContent.trim()===value);
  const params=el=>new URL(el.href).searchParams;
  const editors=(scope=d)=>[...scope.querySelectorAll('a[href^="/edit/"]')];
  await save([added,renamed,plan,revised]);await render();
  check("PVE home includes a scoped add-play editor, not a directory editor",editors().some(a=>params(a).get("mode")==="pve-guide"&&params(a).get("intent")==="add")&&!editors().some(a=>params(a).get("mode")==="index"));
  check("Published local guide becomes a direct navigation and directory destination",d.querySelector('[data-guide="local-pve-lake"] a[href="/pve/?entry=local-pve-lake"]')&&d.querySelector('.pv71-nav a[href="/pve/?entry=local-pve-lake"]'));
  check("Local guide quick links retain the entry and chosen section",d.querySelector('[data-guide="local-pve-lake"] a[href="/pve/?entry=local-pve-lake&view=second#pve-context"]'));
  await render(C.PveApp,{},"/pve/?entry=local-pve-lake&view=second&q=preserve#pve-context");
  check("Local detail header, source and multi-client entrances render correctly",d.querySelector("h1").textContent===local.name&&d.querySelectorAll(".pv6-entrances > div").length===2&&d.querySelector('#pve-sources a[href="https://example.test/pve-evidence"]'));
  check("A quick link selects and scrolls the requested local section",d.querySelector('[data-pve-preview-stage="second"]').classList.contains("is-selected")&&d.querySelector('[data-pve-select-stage="second"]').getAttribute("aria-pressed")==="true"&&scrolled==="second");
  await click(d.querySelector('[data-pve-select-stage="first"]'));
  check("Switching local sections updates the URL while preserving entry and other context",new URLSearchParams(w.location.search).get("view")==="first"&&new URLSearchParams(w.location.search).get("entry")==="local-pve-lake"&&new URLSearchParams(w.location.search).get("q")==="preserve"&&d.querySelector('[data-pve-preview-stage="first"]').classList.contains("is-selected"));
  check("Local section references are rendered as linked entities",d.querySelector('[data-pve-preview-stage="first"] a[href="/pets/haifu/"]'));
  check("Local detail editor retains record identity and entry return route",editors().some(a=>params(a).get("mode")==="pve-guide"&&params(a).get("record")===lake.id&&params(a).get("returnTo").includes("entry="+lake.id)));
  check("Local structured sections each have a guide editor and retain entry and stage context",["pve-context","pve-entrance","pve-rewards","pve-sources"].every(id=>editors(d.getElementById(id)).some(a=>params(a).get("mode")==="pve-guide"&&params(a).get("record")===lake.id&&params(a).get("returnTo").includes("entry="+lake.id)&&params(a).get("returnTo").includes("view=first")))&&editors(d.getElementById("pve-process")).length===0);
  check("Published local plans show latest text and original submitter",d.querySelector('[data-pve-recommendation="plan-a"]').textContent.includes("第二位作者的修订步骤")&&d.querySelector('[data-pve-recommendation="plan-a"] .rw-guide-appreciation-v72').textContent.includes("由 初稿作者 提交"));
  const articleRequest={mode:"article",entity:tower.name,section:"关卡与条件",returnTo:"/pve/star-tower/#pve-context"};
  const articleOverlay=make("legacy-article","article",{markdown:"不应覆盖交互的旧通用正文"},articleRequest,{snapshotKey:C.getPublishedSnapshot(articleRequest,{}).key,after:"不应覆盖交互的旧通用正文"});
  await save([reordered,articleOverlay]);await render(C.PveApp,{},"/pve/star-tower/?level=8");
  check("Reordered tower sections resolve by identity rather than array position",d.querySelector(".pv6-context-body").textContent.includes("第八层专用验证条件")&&!d.querySelector(".pv6-context-body").textContent.includes("前七层专用验证条件"));
  check("Structured PVE sections read guide data instead of replacing controls with article snapshots",d.querySelectorAll(".pv71-floor-options button").length===8&&!d.body.textContent.includes("不应覆盖交互的旧通用正文")&&["pve-context","pve-entrance","pve-rewards","pve-sources"].every(id=>editors(d.getElementById(id)).every(a=>params(a).get("mode")==="pve-guide"))&&editors(d.getElementById("pve-process")).length===0);
  await save([missing]);await render(C.PveApp,{},"/pve/star-tower/?level=8");
  check("Removing the eighth-floor record yields an honest empty section without crashing",d.querySelector(".pv6-context-body").textContent.includes("这个分区的资料待补充")&&d.querySelectorAll(".pv71-floor-options button").length===8);
  await save([]);await render(C.PveApp,{},"/pve/shanhai/");
  check("Shanhai summon is a reward activity and absent from challenge choices",d.querySelector('#pve-rewards [data-pve-reward-activity]')&&!d.querySelector('[data-stage="summon"]'));

  await save([sevenPublication]);await render(C.PveApp,{},"/pve/seven-sanctuaries/?view=moon&difficulty=easy&q=preserve");
  check("Seven-day view exposes seven named days and three custom difficulty options",d.querySelectorAll(".pv72-seven-days > button").length===7&&!d.querySelector("select")&&d.querySelector('[aria-label="七曜挑战难度"]'));
  let detail=d.querySelector(".pv72-seven-detail");
  check("Easy mode shows only its own submitted opponent and reward",detail.textContent.includes("简单验证 BOSS")&&detail.textContent.includes("简单验证奖励 11 颗")&&!detail.querySelector(".pv72-boss-reward-grid").textContent.includes("困难验证 BOSS"));
  check("Legacy combined notes remain explicit instead of becoming difficulty data",detail.querySelector(".pv72-general-reading").textContent.includes("旧综合对手备注")&&detail.querySelector(".pv72-general-reading").textContent.includes("适用难度"));
  await click(d.querySelector('[role="combobox"][aria-label="七曜挑战难度"]'));await click(textButton('[role="option"]',"普通"));
  detail=d.querySelector(".pv72-seven-detail");
  check("An unfilled difficulty shows pending bosses and its historical reference value",detail.dataset.sevenDifficulty==="normal"&&detail.querySelector(".pv72-boss-reward-grid").textContent.includes("待实测")&&detail.querySelector(".pv72-fruit-count").textContent.includes("15")&&!detail.querySelector(".pv72-boss-reward-grid").textContent.includes("简单验证"));
  check("Difficulty changes retain other page query context",new URLSearchParams(w.location.search).get("difficulty")==="normal"&&new URLSearchParams(w.location.search).get("q")==="preserve");
  check("The scoped seven-day editor includes both day and difficulty",editors(detail).some(a=>params(a).get("returnTo").includes("view=moon")&&params(a).get("returnTo").includes("difficulty=normal")));
  const moonRow=d.querySelector('[data-seven-table-stage="moon"]');
  check("The reward table independently displays easy, normal and hard data",moonRow.querySelector('[data-seven-reward="easy"]').textContent.includes("11")&&moonRow.querySelector('[data-seven-reward="normal"]').textContent.includes("15 颗")&&moonRow.querySelector('[data-seven-reward="hard"]').textContent.includes("23"));
  await click([...d.querySelectorAll(".pv72-seven-days > button")].at(-1));
  check("Day selection stays shareable and does not inherit another day's opponents",new URLSearchParams(w.location.search).get("view")==="sun"&&d.querySelector(".pv72-seven-detail").dataset.sevenStage==="sun"&&!d.querySelector(".pv72-seven-detail").textContent.includes("简单验证 BOSS"));

  let editedData;
  function EditorHarness({initial,context}){const[data,setData]=React.useState(initial);editedData=data;return React.createElement(C.TypedFields,{mode:"pve-guide",data,context,onChange:setData});}
  await render(EditorHarness,{initial:sevenEdit,context:{returnTo:"/pve/seven-sanctuaries/?view=moon&difficulty=normal"}},"/edit/");
  check("Seven-day editor preserves fixed IDs and opens the requested day and difficulty",d.querySelectorAll('[data-pve-edit-stage]').length===7&&d.querySelector('[data-pve-edit-stage="moon"]').classList.contains("is-selected")&&d.querySelector('[data-difficulty-editor="moon"] [aria-pressed="true"]').textContent.trim()==="普通"&&!d.querySelector(".pv72-section-toolbar"));
  const moonEditor=d.querySelector('[data-difficulty-editor="moon"]');await input(moonEditor.querySelector("textarea"),"普通新增 BOSS");
  await click(textButton("button","简单",moonEditor));
  check("Editing one difficulty preserves the others across tab switches",editedData.sections[0].difficultyDetails.normal.bosses==="普通新增 BOSS"&&moonEditor.querySelector("textarea").value==="简单验证 BOSS");
  await click(textButton("button","普通",moonEditor));
  check("Switching back restores the just-edited difficulty text",moonEditor.querySelector("textarea").value==="普通新增 BOSS");
  await render(C.PveGuidePreview,{data:editedData,context:{entity:"七曜圣地",returnTo:"/pve/seven-sanctuaries/?view=moon&difficulty=normal"}},"/edit/");
  check("Seven-day rendered preview uses the real difficulty reader and contains no editor links",d.querySelector(".pv72-seven-detail").textContent.includes("普通新增 BOSS")&&editors().length===0&&d.querySelector(".pv72-seven-table"));
  const beforePreviewRoute=w.location.href;await click(d.querySelector('[role="combobox"][aria-label="七曜挑战难度"]'));await click(textButton('[role="option"]',"困难"));
  check("Preview difficulty navigation changes preview content without leaving the editor",d.querySelector(".pv72-seven-detail").textContent.includes("困难验证 BOSS")&&w.location.href===beforePreviewRoute);
  await render(EditorHarness,{initial:lake},"/edit/");await click(d.querySelector('[aria-label="下移分区 1"]'));
  check("Generic section reordering preserves IDs and all attached data",editedData.sections[0].id==="second"&&editedData.sections[1].bosses===lake.sections[0].bosses);

  await save(edits,authorA);
  const social=C.emptySocialState();social.comments=[{id:"comment-b",authorId:authorB,author:"讨论作者",avatar:"dimo",targetId:"/pve/star-tower/",body:"[相邻资料](shanhai.md)",at:"2026-10-10T10:00:00.000Z"},{id:"comment-own",authorId:authorA,author:"初稿作者",avatar:"dimo",targetId:"/pve/star-tower/",body:"我的评论",at:"2026-10-10T10:00:01.000Z"},{id:"other-entry-comment",authorId:authorB,author:"另一页",targetId:"/pve/?entry=other",body:"不应出现的评论",at:"2026-10-10T10:00:00.000Z"}];
  await saveSocial(social);await render(C.PageCommunityFooter,{},"/pve/star-tower/?level=8");
  check("Rendered maintainers show ranked identities and explain unassigned history",d.querySelectorAll(".rw-maintainers-list-v72 > li").length===2&&d.querySelector(".rw-maintainers-list-v72 > li strong").title===authorB&&d.body.textContent.includes("1 次历史修订"));
  check("Page comments use the reading context for relative wiki links",d.querySelector('.rw-comments-v72 a[href="/pve/shanhai/"]'));
  check("Comment filtering and own-comment voting follow the exact page and user",d.querySelectorAll(".rw-comments-v72 > li").length===2&&d.querySelector(".rw-comments-v72 > li button[disabled]")&&!d.body.textContent.includes("不应出现的评论"));
  await render(C.GuideLikeButton,{targetId:"test-plan",title:"测试攻略",href:"/pve/star-tower/",authorId:authorA,author:"初稿作者"});
  check("Creators cannot award their own plan a helpful vote",d.querySelector("button").disabled);
  await save([],authorB);await render(C.GuideLikeButton,{targetId:"test-plan",title:"测试攻略",href:"/pve/star-tower/",authorId:authorA,author:"初稿作者"});await click(d.querySelector("button"));
  check("Reader appreciation records the original plan author UUID",JSON.parse(w.localStorage.getItem(C.SOCIAL_STORAGE_KEY)).likes.some(row=>row.targetId==="test-plan"&&row.authorId===authorA&&row.actorId===authorB));

  for(const route of ["pets","skills","bloodlines","mechanics","events","battle","pve","adventure","tools"]){await render(C.PageHeader,{title:"目录",edit:false},"/"+route+"/");check(route+" main directory has the shared illustrated header contract",d.querySelector(".rw-pagehead-illustrated-v72")?.dataset.headerKind===route);}
  await render(C.PageHeader,{title:"本机宠物",edit:false},"/pets/?entry=local-pet");check("Local detail queries do not receive the broad catalogue illustration",!d.querySelector(".rw-pagehead-illustrated-v72"));
  const postcss=require(require.resolve("postcss",{paths:[project]}));
  const pveCss=fs.readFileSync(path.join(project,"src/wiki/PveV72.css"),"utf8"),globalCss=fs.readFileSync(path.join(project,"src/css/v72.css"),"utf8");
  check("V7.2 PVE and shared styles parse with the installed CSS parser",postcss.parse(pveCss).nodes.length>0&&postcss.parse(globalCss).nodes.length>0);
  check("New PVE controls include focus, narrow layout and reduced-motion rules",pveCss.includes(":focus-visible")&&pveCss.includes("@media (max-width: 600px)")&&pveCss.includes("prefers-reduced-motion")&&pveCss.includes("minmax(0,1fr)"));
  await React.act(async()=>root.unmount());root=null;
  const server=require(require.resolve("react-dom/server",{paths:[project]}));
  const restored={window:global.window,document:global.document,localStorage:global.localStorage};delete global.window;delete global.document;delete global.localStorage;
  try {
    const markup=server.renderToString(React.createElement(C.PveApp));check("PVE directory renders on the server without window or storage",markup.includes("新增玩法")&&markup.includes("PVE 副本与挑战"));
    const footer=server.renderToString(React.createElement(C.PageCommunityFooter));check("Community footer renders server-side without generating browser identity",footer.includes("本页维护人员")&&footer.includes("本页讨论"));
    const preview=server.renderToString(React.createElement(C.PveGuidePreview,{data:sevenEdit,context:{returnTo:"/pve/seven-sanctuaries/?view=moon&difficulty=hard"}}));check("Seven-day rich preview renders server-side with scoped difficulty",preview.includes("困难验证 BOSS")&&preview.includes("七曜奖励与挑战对象对照"));
  } finally {Object.assign(global,restored);}
  check("DOM and server renders produced no React runtime or key warnings",errors.length===0,errors.length?errors:undefined);
}
main().catch(error=>{checks.push({label:"World validation runner completed",pass:false,details:error.stack});process.exitCode=1;}).finally(async()=>{
  if(root) await React.act(async()=>root.unmount());if(dom)dom.window.close();console.error=originalError;
  const sourceFiles=["src/wiki/PvePages.jsx","src/wiki/PveGuideEditor.jsx","src/wiki/pvePublished.js","src/wiki/SevenSanctuaries.jsx","src/wiki/PageCommunityFooter.jsx","src/wiki/pageCommunityModel.js","src/wiki/core.jsx","src/css/v72.css","src/wiki/PveV72.css","src/wiki/editing/TypedFields.jsx","src/wiki/editing/SectionEditor.jsx"];
  const result={version:"7.2",scope:"JSDOM, pure-model, CSS parse and SSR checks. No browser visual or performance assertions.",passed:checks.filter(row=>row.pass).length,total:checks.length,checks,reactErrors:errors,sourceSha256:Object.fromEntries(sourceFiles.map(file=>[file,createHash("sha256").update(fs.readFileSync(path.join(project,file))).digest("hex")]))};
  fs.writeFileSync(path.join(__dirname,"v72-world-check-results.json"),JSON.stringify(result,null,2)+"\n");
  process.stdout.write(JSON.stringify({passed:result.passed,total:result.total,failures:checks.filter(row=>!row.pass),reactErrors:errors},null,2)+"\n");if(result.passed!==result.total)process.exitCode=1;fs.rmSync(temporary,{recursive:true,force:true});
});
