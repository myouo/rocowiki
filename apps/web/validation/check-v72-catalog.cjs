/** V7.2 catalogue identity, original appearances, ability form, sorted skills and bloodline-first references. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const project = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "roco-v72-catalog-"));
const bundle = path.join(temporary, "suite.cjs");
const esbuild = require(require.resolve("esbuild", { paths: [project] }));
const React = require(require.resolve("react", { paths: [project] }));
const { JSDOM } = require(require.resolve("jsdom", { paths: [project] }));
const checks = [], errors = [];
const originalError = console.error;
console.error = (...args) => errors.push(args.map(String).join(" "));
let dom, root;
const check = (label, value) => { const pass = Boolean(value); checks.push({ label, pass }); assert.ok(pass, label); };

async function main() {
  await esbuild.build({
    stdin: { contents: 'export * from "./src/wiki/CatalogPages.jsx"; export * from "./src/wiki/catalogBloodlines.js"; export * from "./src/wiki/PetStatsMini.jsx"; export {default as PetStatsMini} from "./src/wiki/PetStatsMini.jsx"; export {calculateStats} from "./src/wiki/rocoCalculations.js"; export * from "./src/wiki/catalogPublished.js"; export * from "./src/wiki/counterVoteState.js"; export * from "./src/wiki/matchupBloodlines.js"; export * from "./src/wiki/editingContext.js"; export * from "./src/wiki/skillPresentation.js"; export * from "./src/wiki/editing/publishedRecords.js"; export { pets as seedPets, skills as seedSkills } from "./src/wiki/data.js"; export { default as CounterVotes } from "./src/wiki/CounterVotes.jsx"; export {default as InlineSectionEdits} from "./src/wiki/InlineSectionEdits.jsx"; export {default as ToolsPages} from "./src/wiki/ToolsPages.jsx";', resolveDir: project, loader: "jsx" },
    outfile: bundle, bundle: true, format: "cjs", platform: "node", loader: { ".css": "empty" }, logLevel: "silent",
    plugins: [{ name: "local-ui-environment", setup(build) {
      build.onResolve({ filter: /^(react|react-dom|lucide-react)(\/.*)?$/ }, (args) => ({ path: require.resolve(args.path, { paths: [project] }), external: true }));
      build.onResolve({ filter: /^@docusaurus\// }, (args) => ({ path: args.path, namespace: "docusaurus-stub" }));
      build.onLoad({ filter: /.*/, namespace: "docusaurus-stub" }, (args) => ({ loader: "jsx", resolveDir: project, contents: args.path.endsWith("/useBrokenLinks") ? "export default function useBrokenLinks(){return {collectAnchor(value){if(value)globalThis.__rocoAnchorSet?.add(value)},collectLink(){}};}" : args.path.endsWith("/Link")
        ? 'import React from "react"; export default function Link({to,children,...rest}) { return <a href={to} {...rest}>{children}</a>; }'
        : args.path.endsWith("/useBaseUrl") ? "export default function useBaseUrl(value){return value;}"
        : 'import React from "react"; const read=()=>({pathname:window.location.pathname,search:window.location.search,hash:window.location.hash}); export function useLocation(){const [value,set]=React.useState(read);React.useEffect(()=>{const update=()=>set(read());window.addEventListener("test-route",update);return()=>window.removeEventListener("test-route",update)},[]);return value;} export function useHistory(){return {replace(url){window.history.replaceState({},"",url);window.dispatchEvent(new window.Event("test-route"))},push(url){window.history.pushState({},"",url);window.dispatchEvent(new window.Event("test-route"))}};}' }));
    } }],
  });
  dom = new JSDOM('<div id="app" class="rw"></div>', { url: "https://wiki.test/pets/", pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  Object.assign(global, { window: w, document: d, HTMLElement: w.HTMLElement, Node:w.Node, localStorage: w.localStorage, MutationObserver: w.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
  w.matchMedia = () => ({matches:false,addEventListener(){},removeEventListener(){}});
  w.HTMLElement.prototype.scrollIntoView = function() {};
  const { createRoot } = require(require.resolve("react-dom/client", {paths:[project]}));
  const C = require(bundle), meta = JSON.parse(fs.readFileSync(path.join(project, "content/pet-metadata-v6.json")));
  const createSubmission = (id, mode, typedData, editorRequest, status = "published", updatedAt = "2026-10-10T14:00:00.000Z") => ({ id, editorMode:mode, editorVersion:7, status, typedData, editorRequest, target:editorRequest.entity, updatedAt });
  const added = createSubmission("pet-new", "pet", { slug:"local-pet-new", name:"验证宠物", number:9001, types:"草\n水", hp:101, attack:102, defense:103, magicAttack:104, magicDefense:105, speed:106, bloodlines:"验证血脉", group:"精灵组", sourceUrl:"https://example.test/evidence" }, {entity:"宠物图鉴",section:"新增宠物",mode:"pet",intent:"add",returnTo:"/pets/"});
  const projectPets = (submissions) => C.resolvePublishedCatalogPets({pets:C.seedPets,metadata:meta,submissions});
  const initial = JSON.stringify(C.seedPets);
  let projected = projectPets([added]), local = projected.find(p=>p.slug==="local-pet-new");
  check("New published pet receives its own stable detail URL and catalogue metadata", local?.name === "验证宠物" && C.petDetailHref(local) === "/pets/?entry=local-pet-new" && local.metadata.bloodlines[0] === "验证血脉");
  check("Six species stats are read back without changing the seeded data", local.stats.join(",") === "101,102,103,104,105,106" && JSON.stringify(C.seedPets) === initial);
  check("Unpublished pet submissions do not appear in the catalogue", projectPets([{...added,status:"pending_review"}]).length === C.seedPets.length);
  const renamed = createSubmission("pet-rename", "pet", {...added.typedData,slug:"attempted-new-identity",name:"验证宠物修订",speed:130}, {entity:"验证宠物",section:"基础资料",mode:"pet",record:local.slug,returnTo:C.petDetailHref(local),intent:"edit"}, "published", "2026-10-10T14:01:00.000Z");
  local = projectPets([renamed,added]).find(p=>p.slug==="local-pet-new");
  check("Renaming a local pet preserves identity and updates its stats", local?.name === "验证宠物修订" && local.stats[5] === 130 && local.localEntry);
  const deletePet = createSubmission("pet-delete", "pet", {name:local.name,slug:local.slug,deletionReason:"重复条目测试",redirectTo:"/pets/haifu/"}, {entity:local.name,mode:"pet",record:local.slug,returnTo:C.petDetailHref(local),intent:"delete"}, "pending_review", "2026-10-10T14:02:00.000Z");
  check("A deletion proposal leaves the published pet available until reviewed", !projectPets([added,renamed,deletePet]).find(p=>p.slug===local.slug).deleted);
  const deleted = projectPets([added,renamed,{...deletePet,status:"published"}]).find(p=>p.slug===local.slug);
  check("Reviewed deletion retains a tombstone with its reason and redirection", deleted?.deleted && deleted.deletionReason === "重复条目测试" && deleted.redirectTo === "/pets/haifu/");
  check("A new submission cannot overwrite an existing pet by reusing its slug", projectPets([{...added,typedData:{...added.typedData,slug:"haifu"}}]).find(p=>p.slug==="haifu").name === "海芙约忒");
  check("Unknown species data does not become zero-filled radar values", projectPets([{...added,typedData:{...added.typedData,speed:""}}]).find(p=>p.slug===local.slug).stats === null);
  const branch = {id:"custom-cycle",label:"分段测试",conditionTree:{kind:"group",operator:"all",children:[{kind:"rounds",basis:"skill-sequence",mode:"ranges",ranges:[{start:2,end:5},{start:7,end:7}]},{kind:"group",operator:"any",children:[{kind:"clause",text:"满足状态甲"},{kind:"clause",text:"满足状态乙"}]}]},effect:"触发分段效果",children:[{label:"继续判断",when:"护盾仍存在",effect:"记录护盾结果"}],otherwiseBranch:{effect:"保留不成立结果",conditionTree:null,children:[]}};
  const skillEdit = createSubmission("skill-tree", "skill", {name:"灵火之杖",summary:"用于读回验证的描述",common:"用于验证的基础效果",phases:[branch]}, {entity:"灵火之杖",section:"效果与触发条件",mode:"skill",record:"branch-1",returnTo:"/skills/linghuo/#effects"});
  const updatedSkill = C.resolvePublishedCatalogSkills({skills:C.seedSkills,submissions:[skillEdit]}).find(s=>s.slug==="linghuo");
  check("A published advanced branch survives nested and range data unchanged", JSON.stringify(updatedSkill.phases[0]) === JSON.stringify(branch));
  check("Historical display overrides cannot mask published skill changes", C.skillRulePresentation(updatedSkill).branches[0].label === "分段测试" && C.skillRulePresentation(updatedSkill).base[0] === "用于验证的基础效果");

  root = createRoot(d.querySelector("#app"));
  async function render(Component, props = {}, route = "/pets/", inline = true) {
    await React.act(async()=>root.unmount());
    w.history.replaceState({},"",route);
    root = createRoot(d.querySelector("#app"));
    await React.act(async()=>root.render(React.createElement(React.Fragment,null,React.createElement("div",{id:"rw-main"},React.createElement(Component,props)),inline&&React.createElement(C.InlineSectionEdits))));
  }
  async function click(element) { assert.ok(element,"click target exists"); await React.act(async()=>element.click()); }
  const save = async (submissions) => { await React.act(async()=>{w.localStorage.setItem("roco-wiki-v4:community",JSON.stringify({version:1,submissions}));w.dispatchEvent(new w.Event("roco:community-updated"));}); };
  await render(C.PetsPage);
  const headerLinks = [...d.querySelectorAll(".rw-pageheader .rw-edit-entry,.rw-page-header .rw-edit-entry,.rw-page-head .rw-edit-entry")];
  const petEdits = [...d.querySelectorAll('a[href^="/edit/"]')];
  check("Pet catalogue offers add-pet but no broad directory edit", petEdits.some(a=>a.textContent.includes("新增宠物")) && !petEdits.some(a=>new URL(a.href).searchParams.get("mode")==="index") && !d.body.textContent.includes("编辑目录"));
  check("Pet cards and filter headings do not acquire injected edit buttons", !d.querySelector(".rw-petcard .rw-edit-entry,.rw-catalog-tabs .rw-edit-entry,.rw-filterbox .rw-edit-entry,.rw-petgrid .rw-inline-section-edit"));
  await render(C.SkillsPage,{},"/skills/");
  check("Skill overview retains description and effect filters without row editors", [...d.querySelectorAll("th")].at(-1).textContent === "技能描述" && d.querySelector(".rw-filterchips") && !d.querySelector(".rw-skill-table .rw-edit-entry"));
  await render(C.PetPage,{slug:"haifu"},"/pets/haifu/");
  const skillLink = d.querySelector('.rw-skill-table a[href*="/skills/"]');
  check("Pet skill pool navigates to skill detail with the originating pet preserved", skillLink?.getAttribute("href").includes("?pet=haifu") && !d.querySelector(".rw-skill-table .rw-edit-entry"));
  check("Original Counter records explicitly show both bloodlines as unrecorded", d.querySelectorAll(".rw-counter-bloodline-side-v71.unknown").length >= 2 && d.querySelector(".rw-counter-bloodlines-v71").textContent.includes("我方血脉") && d.querySelector(".rw-counter-bloodlines-v71").textContent.includes("对手血脉"));
  check("Pet maintenance offers an explicit deletion proposal rather than immediate deletion", [...d.querySelectorAll(".rw-entry-maintenance-v71 a")].some(a=>new URL(a.href).searchParams.get("intent")==="delete"));
  await save([added,renamed]);
  await render(C.PetsPage);
  check("New and renamed pets appear immediately in the catalogue", [...d.querySelectorAll(".rw-petcard h3")].some(el=>el.textContent === "验证宠物修订"));
  await render(C.PetsPage,{},"/pets/?entry=local-pet-new");
  check("A local pet opens its own detail page, with the published name and species data", d.querySelector("h1")?.textContent === "验证宠物修订" && d.querySelector(".rw-pet-radar")?.textContent.includes("645"));
  check("Local detail editors preserve the stable identity and return URL", [...d.querySelectorAll('.rw-pet-facts .rw-edit-entry')].some(a=>{const q=new URL(a.href).searchParams;return q.get("record")==="local-pet-new"&&q.get("returnTo")==="/pets/?entry=local-pet-new#overview";}));
  await render(C.ToolsPages,{path:"/tools/compare/",query:new URLSearchParams("pets=local-pet-new,haifu")},"/tools/compare/?pets=local-pet-new,haifu");
  check("A newly published pet can enter the same comparison tool", d.querySelector(".rw-compare-table")?.textContent.includes("验证宠物修订") && d.querySelector('.rw-compare-table a[href="/pets/?entry=local-pet-new"]'));
  await save([added,renamed,{...deletePet,status:"published"}]);
  await render(C.PetsPage);
  check("Reviewed deleted pets leave the catalogue", ![...d.querySelectorAll(".rw-petcard h3")].some(el=>el.textContent === "验证宠物修订"));
  await render(C.PetsPage,{},"/pets/?entry=local-pet-new");
  check("Old local references show the reviewed tombstone without destroying related records", d.body.textContent.includes("重复条目测试") && d.querySelector('a[href="/pets/haifu/"]') && !d.querySelector(".rw-pet-overview"));
  await save([skillEdit]);
  await render(C.SkillPage,{slug:"linghuo"},"/skills/linghuo/");
  check("Public skill detail displays disjoint ranges and a nested any-condition group", d.body.textContent.includes("第 2–5 回合") && d.body.textContent.includes("第 7 回合") && d.body.textContent.includes("满足任一项"));
  check("Public skill detail displays child branches and otherwise results", d.body.textContent.includes("记录护盾结果") && d.body.textContent.includes("保留不成立结果") && d.querySelector(".rw-skill-branch-nested"));
  check("Skill detail retains a focused entry editor and each branch editor", d.querySelector('a[href*="record=branch-1"]') && [...d.querySelectorAll(".rw-edit-entry")].some(a=>a.textContent.includes("编辑条目")));

  const record = { id:"claim", scene:"lead-together", opponent:"对手甲", opponentSlug:"bishui", conclusion:"测试结论", conditions:["条件甲"], claimRevision:"r1" };
  const unknown = C.counterClaimKey("haifu", record);
  const none = C.counterClaimKey("haifu", {...record,myBloodline:{status:"none"}});
  const myChoice = {...record,myBloodline:{status:"specified",names:["怒海狂涛"],note:"配置记录"},opponentBloodline:{status:"none"}};
  const chosen = C.counterClaimKey("haifu",myChoice);
  check("Unknown bloodline and confirmed no-bloodline are distinct claims", unknown !== none);
  check("Changing either side's bloodline creates a separate support pool", chosen !== none && chosen !== C.counterClaimKey("haifu",{...myChoice,opponentBloodline:{status:"specified",names:["对手血脉"]}}));
  check("Dormant names under an unknown status do not create false equipped-bloodline claims", C.counterClaimKey("haifu",{...record,myBloodline:{status:"unknown",names:["不应生效"]}}) === unknown);
  const ballot = C.toggleCounterVote(C.emptyCounterVotes(),unknown,"guest:catalog-test",1);
  check("A vote on unknown configurations is not counted for a specified configuration", C.counterVoteSummary(ballot,unknown,"guest:catalog-test").total === 1 && C.counterVoteSummary(ballot,chosen,"guest:catalog-test").total === 0);
  const storedClaim = meta.pets.haifu.matchups.pvp[0];
  const revisedClaim = {...storedClaim,myBloodline:myChoice.myBloodline,opponentBloodline:myChoice.opponentBloodline};
  const bloodlinePublication = createSubmission("bloodline-record", "matchup", {records:[revisedClaim]}, {entity:"海芙约忒",section:"对位 Counter",mode:"matchup",record:storedClaim.id,returnTo:"/pets/haifu/#matchups"});
  const readClaim = C.resolvePublishedRecords({entity:"海芙约忒",mode:"matchup",records:[storedClaim],submissions:[bloodlinePublication]}).records[0];
  check("Published record projection preserves each side's selected or absent bloodline", readClaim.myBloodline.status === "specified" && readClaim.myBloodline.names[0] === "怒海狂涛" && readClaim.opponentBloodline.status === "none");
  check("Changing only bloodlines revises the published Counter claim", readClaim.claimRevision !== (storedClaim.claimRevision || "r1") && C.counterClaimKey("haifu",readClaim) !== C.counterClaimKey("haifu",storedClaim));
  await save([bloodlinePublication]);
  await render(C.PetPage,{slug:"haifu"},"/pets/haifu/");
  const bloodlineSides = d.querySelector(".rw-counter-bloodlines-v71");
  check("Public Counter reader shows the two published configurations with their notes", bloodlineSides?.textContent.includes("怒海狂涛") && bloodlineSides.textContent.includes("确认未携带血脉") && bloodlineSides.textContent.includes("配置记录"));
  const petRenameWithRecord = createSubmission("haifu-rename", "pet", {slug:"haifu",name:"海芙约忒 · 修订名"}, {entity:"海芙约忒",mode:"pet",record:"haifu",returnTo:"/pets/haifu/"}, "published", "2026-10-10T14:03:00.000Z");
  await save([bloodlinePublication,petRenameWithRecord]);
  await render(C.PetPage,{slug:"haifu"},"/pets/haifu/");
  check("Renaming a pet preserves its earlier published Counter records under the stable identity", d.querySelector("h1")?.textContent === "海芙约忒 · 修订名" && d.querySelector(".rw-counter-bloodlines-v71")?.textContent.includes("配置记录"));
  await render(C.CounterVotes,{petSlug:"haifu",record},"/pets/haifu/",false);
  await click(d.querySelector('.rw-counter-vote-buttons-v7 button'));
  check("Visitor voting records support for the currently visible claim", d.querySelector('.rw-counter-vote-buttons-v7 button[aria-pressed="true"]')?.textContent.includes("支持 1"));
  await React.act(async()=>root.render(React.createElement("div",{id:"rw-main"},React.createElement(C.CounterVotes,{petSlug:"haifu",record:myChoice}))));
  check("Rerendering a new bloodline configuration clears the previous vote state and announcement", !d.querySelector('.rw-counter-vote-buttons-v7 button[aria-pressed="true"]') && d.body.textContent.includes("暂无投票") && !d.body.textContent.includes("已支持这条"));

  check("Automatic heading edits reject catalogue, filter and account screens", !C.canAutoEditSection("/pets/",{title:"全部宠物"}) && !C.canAutoEditSection("/skills/",{title:"技能概览"}) && !C.canAutoEditSection("/account/",{title:"我的投稿",explicit:true}));
  check("Unmarked custom headings are not assumed to be editable documents", !C.canAutoEditSection("/adventure/",{title:"常用地区"}) && !C.canAutoEditSection("/pets/haifu/",{title:"六维种族值"}));
  check("Known knowledge articles and explicit article sections remain editable", C.isEditableArticlePath("/mechanics/priority/") && C.canAutoEditSection("/mechanics/priority/",{title:"先手"}) && C.canAutoEditSection("/bloodlines/haifu/",{title:"资源与技能的关系",explicit:true}));
  function KnowledgeFixture() { return React.createElement(React.Fragment,null,React.createElement("h1",null,"行动顺序"),React.createElement("h2",null,"有效正文标题"),React.createElement("div",{className:"rw-notice"},React.createElement("h3",null,"界面提示标题"))); }
  await save([]);
  await render(KnowledgeFixture,{},"/mechanics/priority/?q=verified");
  check("Real article headings receive one contextual edit while UI notices receive none", d.querySelectorAll("h2 .rw-inline-section-edit").length === 1 && !d.querySelector(".rw-notice .rw-edit-entry"));
  const contextual = d.querySelector("h2 .rw-edit-entry");
  check("Article heading edit preserves current query and stable anchor", new URL(contextual.href).searchParams.get("returnTo").startsWith("/mechanics/priority/?q=verified#"));

  await save([]);
  await render(C.PetPage,{slug:"haifu"},"/pets/haifu/");
  const overview=d.querySelector(".rw-pet-overview-v72"), labels=[...overview.querySelectorAll("dt")].map(el=>el.textContent);
  check("Pet infobox combines series, bloodlines, size, colour and capture category", ["所属系列","可选血脉","身高","体重","颜色","捕捉分类"].every(name=>labels.includes(name)) && !d.querySelector(".rw-pet-metadata-v6"));
  check("Ladder cost occupies the original portrait corner and leaves the facts table", !labels.includes("天梯魔力值") && overview.querySelector(".rw-pet-hero-magic-v72 .rw-magic-cost-v6")?.textContent === "5");
  check("Recorded bloodline names link from pet infobox to bloodline-first details", overview.querySelector('.rw-pet-fact-links-v72 a[href="/bloodlines/?entry=%E5%87%8C%E8%99%9A%E5%90%AB%E7%83%9F"]'));
  const factsBefore=overview.querySelector(".rw-pet-facts").textContent;
  const appearanceButtons=[...d.querySelectorAll(".rw-pet-appearance-options-v72 button")];
  check("Only the original and two verified Haifu appearances are offered", appearanceButtons.length === 3 && appearanceButtons.map(b=>b.textContent).join("/") === "原始外观/闲情/玉蟾");
  await click(appearanceButtons[2]);
  check("Appearance switching changes the source image without changing pet facts", d.querySelector(".rw-pet-gallery-image-v72 img")?.getAttribute("src").endsWith("haifu-yuchan.jpg") && overview.querySelector(".rw-pet-facts").textContent===factsBefore && d.querySelector('.rw-pet-appearance-options-v72 button[aria-pressed="true"]')?.textContent==="玉蟾");
  await React.act(async()=>appearanceButtons[2].dispatchEvent(new w.KeyboardEvent("keydown",{key:"ArrowLeft",bubbles:true})));
  check("Appearance selection supports arrow keys and roving focus", d.activeElement.textContent === "闲情" && d.querySelector(".rw-pet-gallery-image-v72 img")?.getAttribute("src").endsWith("haifu-xianqing.png"));
  const artwork=JSON.parse(fs.readFileSync(path.join(project,"content/pet-appearances-v72.json")));
  check("Both appearance artworks retain their fetched bytes and provenance", artwork.pets.haifu.every(row=>createHash("sha256").update(fs.readFileSync(path.join(project,"static",row.image))).digest("hex")===row.sha256 && /^https:\/\//.test(row.sourceUrl)));
  check("The miniature ability tool gives the known 100-level zero-effort health value", d.querySelector(".rw-pet-mini-result .stat-hp strong")?.textContent === "465");
  async function inputValue(el,value){assert.ok(el);await React.act(async()=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,"value").set.call(el,String(value));el.dispatchEvent(new w.Event("input",{bubbles:true}));});}
  await inputValue(d.querySelector('input[aria-label="简易能力 · 等级"]'),50);
  check("Changing level recalculates the pet miniature rather than only its label", d.querySelector(".rw-pet-mini-result .stat-hp strong")?.textContent === "237");
  const fullLink=d.querySelector(".rw-pet-mini-heading > a"), carried=JSON.parse(new URL(fullLink.href).searchParams.get("calc"));
  check("The full ability tool receives all selected cultivation values in its URL", carried.level==="50" && carried.base.join(",")==="162,105,142,146,142,132" && carried.talent.every(n=>n==="31"));
  for(const name of ["精力","物攻","物防"])await inputValue(d.querySelector(`input[aria-label="${name}努力值"]`),255);
  check("Over-budget effort suppresses stale numerical results and explains the issue", d.querySelector(".rw-pet-mini-errors")?.textContent.includes("超过 510") && !d.querySelector(".rw-pet-mini-result .stat-hp"));
  await render(C.PetStatsMini,{pet:{slug:"unknown",name:"缺失种族",stats:null,localEntry:true}},"/pets/?entry=unknown",false);
  const missingForm=JSON.parse(new URL(d.querySelector(".rw-pet-mini-heading > a").href).searchParams.get("calc"));
  check("Missing species stats never receive another pet's computed result", !d.querySelector(".rw-pet-mini-result") && d.body.textContent.includes("暂不计算能力") && missingForm.base.every(n=>n==="") && missingForm.pet==="custom");
  const tinySkills=[{slug:"known-low",name:"低威力",power:40,pp:5},{slug:"unknown-a",name:"变化甲",power:null,pp:6},{slug:"known-high",name:"高威力",power:90,pp:5},{slug:"unknown-b",name:"变化乙",pp:8}];
  check("Skill numeric sorting keeps unknown and inapplicable values last in both directions", C.sortCatalogSkills(tinySkills,"power","asc").map(s=>s.slug).join(",")==="known-low,known-high,unknown-a,unknown-b" && C.sortCatalogSkills(tinySkills,"power","desc").map(s=>s.slug).join(",")==="known-high,known-low,unknown-a,unknown-b");
  check("Equal skill values preserve source order without mutation", C.sortCatalogSkills(tinySkills,"pp","asc").slice(0,2).map(s=>s.slug).join(",")==="known-low,known-high" && tinySkills[1].slug==="unknown-a");
  check("Skill IDs become a sort option only when an actual ID is recorded", !C.availableSkillSortFields(tinySkills).some(f=>f.value==="number") && C.availableSkillSortFields([{number:1234}]).some(f=>f.value==="number"));
  await render(C.SkillsPage,{},"/skills/?kind=变化&effect=防控&q=霞");
  await click(d.querySelector('[role="combobox"][aria-label="技能排序字段"]'));
  await click([...d.querySelectorAll('[role="option"]')].find(el=>el.textContent==="PP"));
  const sortQuery=new URLSearchParams(w.location.search);
  check("The custom skill sort preserves all active filters in the URL", sortQuery.get("sort")==="pp" && sortQuery.get("kind")==="变化" && sortQuery.get("effect")==="防控" && sortQuery.get("q")==="霞");
  await click(d.querySelector(".rw-skill-sort-v72 .rw-sort-direction-v6"));
  check("Skill sort direction updates independently of the selected field", new URLSearchParams(w.location.search).get("order")==="desc" && new URLSearchParams(w.location.search).get("sort")==="pp");
  await save([added,renamed]);
  const options=C.getPetBloodlineOptions("验证宠物",{submissions:[added,renamed]});
  check("Counter bloodline choices follow the published pet and its previous names", options.pet.name==="验证宠物修订" && options.options[0].value==="验证血脉" && options.recorded);
  check("Unrecorded bloodlines are not interpreted as a confirmed empty loadout", !C.getPetBloodlineOptions("bishui").recorded && C.getPetBloodlineOptions("bishui").options.length===0);
  check("Deleted pets cannot supply active bloodline choices", !C.getPetBloodlineOptions("local-pet-new",{submissions:[added,renamed,{...deletePet,status:"published"}]}).pet);
  const anyClaim=C.counterClaimKey("haifu",{...record,myBloodline:{status:"any",names:["ignored"]}});
  check("Any bloodline applicability is distinct from unknown, none and specified claims", new Set([unknown,none,chosen,anyClaim]).size===4 && C.matchupBloodlineText({status:"any"})==="任意血脉均适用" && C.matchupBloodlineClaim({status:"any",names:["old"]}).names.length===0);
  const anyPublication=createSubmission("any-record","matchup",{records:[{...storedClaim,myBloodline:{status:"any"},opponentBloodline:{status:"any"}}]},{entity:"海芙约忒",section:"对位 Counter",mode:"matchup",record:storedClaim.id,returnTo:"/pets/haifu/#matchups"});
  await save([anyPublication]);
  await render(C.PetPage,{slug:"haifu"},"/pets/haifu/");
  check("Published Counter renders any-applicability for both sides", d.querySelectorAll(".rw-counter-bloodline-side-v71.any").length===2 && d.querySelector(".rw-counter-bloodlines-v71").textContent.includes("任意血脉均适用"));
  await save([]);
  await render(C.BloodlinePage,{},"/bloodlines/");
  check("The bloodline index uses bloodline names as the four main entries", [...d.querySelectorAll(".rw-bloodline-card-main-v72 h2")].map(e=>e.textContent).sort().join("/")===["凌虚含烟","碧水惊秋","咏叹调","宣叙调"].sort().join("/") && d.querySelectorAll(".rw-bloodline-owners-v72 a").length===4);
  await render(C.BloodlinePage,{},C.bloodlineDetailHref("凌虚含烟"));
  check("A bloodline detail leads back to its holding pet and a scoped editor", d.querySelector("h1")?.textContent==="凌虚含烟" && d.querySelector('.rw-bloodline-holders-v72 a[href="/pets/haifu/"]') && [...d.querySelectorAll('a[href^="/edit/"]')].some(a=>{const q=new URL(a.href).searchParams;return q.get("entity")==="凌虚含烟" && q.get("section")==="血脉效果" && q.get("returnTo").includes("?entry=");}));
  const bloodlineRequest={entity:"凌虚含烟",section:"血脉效果",mode:"article",returnTo:C.bloodlineDetailHref("凌虚含烟")+"#effects"};
  check("A new bloodline body starts empty instead of borrowing the index text", C.getBloodlineArticleSnapshot(bloodlineRequest,{}).markdown==="");
  const bodyEdit=createSubmission("bloodline-body","article",{markdown:"记录 [海芙约忒](/pets/haifu/) 的血脉效果校验。",sourceUrl:"https://example.test/bloodline"},bloodlineRequest);
  check("Only the matching bloodline entry receives a published body", C.getBloodlineArticleSnapshot(bloodlineRequest,{submissions:[bodyEdit]}).markdown.includes("血脉效果校验") && C.getBloodlineArticleSnapshot({...bloodlineRequest,entity:"碧水惊秋",returnTo:C.bloodlineDetailHref("碧水惊秋")+"#effects"},{submissions:[bodyEdit]}).markdown==="");
  await save([bodyEdit]);
  await render(C.BloodlinePage,{},C.bloodlineDetailHref("凌虚含烟"));
  check("Bloodline published body renders linked pet references and its revision", d.querySelector('.rw-entity-reference[data-entity-kind="宠物"]') && d.body.textContent.includes("血脉效果校验") && d.body.textContent.includes("正在阅读本机已发布的血脉效果") && d.querySelector('.rw-bloodline-source-links-v72 a[href="https://example.test/bloodline"]'));
  await save([added,renamed]);
  await render(C.BloodlinePage,{},"/bloodlines/");
  check("Published new pet bloodlines enter the same bloodline-first index", [...d.querySelectorAll(".rw-bloodline-card-main-v72 h2")].some(e=>e.textContent==="验证血脉") && d.querySelector('.rw-bloodline-owners-v72 a[href="/pets/?entry=local-pet-new"]'));
  await save([]);
  await render(C.SkillPage,{slug:"xiazi"},"/skills/xiazi/");
  check("The skill detail presents its description once before the component flow", d.querySelectorAll(".rw-skill-summary").length===1 && !d.querySelector(".rw-flow-description") && d.querySelector('[data-skill-flow="components"]') && d.querySelector(".rw-flow-copy-button"));
  await click(d.querySelector(".rw-flow-copy-button"));
  check("Mermaid export has a selectable fallback where clipboard access is unavailable", d.querySelector(".rw-flow-copy-fallback textarea")?.value.startsWith("flowchart"));
  check("No native select or React DOM errors were introduced by these flows", !d.querySelector("select") && errors.length === 0);
}

main().catch(error=>{checks.push({label:"Suite completion",pass:false,error:String(error.stack||error)});process.exitCode=1;}).finally(async()=>{
  if(root)try{await React.act(async()=>root.unmount());}catch{}
  if(dom)dom.window.close();
  console.error=originalError;
  fs.rmSync(temporary,{recursive:true,force:true});
  const sourceFiles=["src/wiki/CatalogV72.css","src/wiki/PetStatsMini.jsx","src/wiki/catalogBloodlines.js","content/pet-appearances-v72.json","src/wiki/CatalogPages.jsx","src/wiki/CatalogV7.css","src/wiki/catalogPublished.js","src/wiki/CounterBloodlineSides.jsx","src/wiki/CounterVotes.jsx","src/wiki/counterVoteState.js","src/wiki/skillPresentation.js","src/wiki/SkillBranchView.jsx","src/wiki/skillConditions.js","src/wiki/matchupBloodlines.js","src/wiki/editingContext.js","src/wiki/InlineSectionEdits.jsx","src/wiki/ToolsPages.jsx","src/wiki/core.jsx","src/wiki/editing/publishedRecords.js"];
  const sources=sourceFiles.map(file=>({path:file,sha256:createHash("sha256").update(fs.readFileSync(path.join(project,file))).digest("hex")}));
  const result={version:"7.2",checkedAt:new Date().toISOString(),scope:"JSDOM interaction and catalogue model checks; no browser layout or performance assertion",passed:checks.filter(row=>row.pass).length,total:checks.length,checks,errors,sources};
  fs.writeFileSync(path.join(__dirname,"v72-catalog-check-results.json"),JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify({passed:result.passed,total:result.total,errors:errors.length,failures:checks.filter(row=>!row.pass)}));
});
