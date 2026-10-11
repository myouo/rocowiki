/** V7.1: public navigation, contextual PVE selection and published record boundaries. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { createHash } = require("node:crypto");
const project = path.resolve(__dirname, "..");
const esbuild = require(require.resolve("esbuild", { paths: [project] }));
const React = require(require.resolve("react", { paths: [project] })),
  { act } = React;
const { JSDOM } = require("jsdom");
const events = require("../content/events-v7.json"),
  routes = require("../content/routes.json"),
  pve = require("../content/pve-v6.json");
const checks = [],
  runtimeErrors = [],
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), "roco-v71-world-"));
const bundlePath = path.join(temporary, "world.cjs"),
  oldConsoleError = console.error;
let dom, root;
function check(name, condition) {
  checks.push({ name, passed: !!condition });
  assert.ok(condition, name);
}
async function main() {
  console.error = (...args) => runtimeErrors.push(args.map(String).join(" "));
  await esbuild.build({
    stdin: {
      contents:
        "import React from 'react'; import {useLocation} from '@docusaurus/router'; import World from './src/wiki/WorldPages.jsx'; import Pve from './src/wiki/PvePages.jsx'; import {MechanicsHome} from './src/wiki/MechanicsPages.jsx'; export {default as PreviewContent} from './src/wiki/editing/PreviewContent.jsx'; export {getPublishedSnapshot,COMMUNITY_STORAGE_KEY} from './src/wiki/editing/registry'; export default function Harness(){ const loc=useLocation(), Component=loc.pathname.startsWith('/pve/')?Pve:World; return loc.pathname==='/mechanics/'?<MechanicsHome/>:<Component path={loc.pathname} query={new URLSearchParams(loc.search)}/>; }",
      resolveDir: project,
      loader: "jsx",
    },
    outfile: bundlePath,
    bundle: true,
    format: "cjs",
    platform: "node",
    loader: { ".css": "empty" },
    logLevel: "silent",
    plugins: [
      {
        name: "test-router",
        setup(build) {
          build.onResolve(
            { filter: /^(react|react-dom|lucide-react)(\/.*)?$/ },
            (args) => ({
              path: require.resolve(args.path, { paths: [project] }),
              external: true,
            }),
          );
          build.onResolve({ filter: /^@docusaurus\// }, (args) => ({
            path: args.path,
            namespace: "docusaurus-stub",
          }));
          build.onLoad(
            { filter: /.*/, namespace: "docusaurus-stub" },
            (args) => ({
              loader: "jsx",
              resolveDir: project,
              contents: args.path.endsWith("/useBrokenLinks") ? "export default function useBrokenLinks(){return {collectAnchor(value){if(value)globalThis.__rocoAnchorSet?.add(value)},collectLink(){}};}" : args.path.endsWith("/Link")
                ? 'import React from "react"; export default function Link({to,children,...rest}){return <a href={to} {...rest}>{children}</a>}'
                : args.path.endsWith("/useBaseUrl")
                  ? "export default function useBaseUrl(value){return value}"
                  : 'import React from "react";const read=()=>({pathname:window.location.pathname,search:window.location.search,hash:window.location.hash});export function useLocation(){const [value,set]=React.useState(read);React.useEffect(()=>{const update=()=>set(read());window.addEventListener("test-route",update);return()=>window.removeEventListener("test-route",update)},[]);return value;}export function useHistory(){return{replace(url){window.history.replaceState({},"",url);window.dispatchEvent(new window.Event("test-route"))}};}',
            }),
          );
        },
      },
    ],
  });
  dom = new JSDOM('<div id="root" class="rw"></div>', {
    url: "https://wiki.test/events/",
    pretendToBeVisual: true,
  });
  const w = dom.window,
    d = w.document;
  Object.assign(global, {
    window: w,
    document: d,
    HTMLElement: w.HTMLElement,
    localStorage: w.localStorage,
    CustomEvent: w.CustomEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  const { createRoot } = require(
    require.resolve("react-dom/client", { paths: [project] }),
  );
  const api = require(bundlePath),
    Component = api.default;
  root = createRoot(d.querySelector("#root"));
  async function render(route) {
    await act(async () => root.unmount());
    w.history.replaceState({}, "", route);
    root = createRoot(d.querySelector("#root"));
    await act(async () => root.render(React.createElement(Component)));
  }
  async function publish(submissions) {
    await act(async () => {
      w.localStorage.setItem(
        api.COMMUNITY_STORAGE_KEY,
        JSON.stringify({version: 1, submissions}),
      );
      w.dispatchEvent(new w.CustomEvent("roco:community-updated"));
    });
  }
  const editors = (scope = d) => [...scope.querySelectorAll('a[href^="/edit/"]')];
  const params = (el) => new URL(el.href).searchParams;
  const q = () => new URLSearchParams(w.location.search);
  const byText = (selector, text, scope = d) => [...scope.querySelectorAll(selector)].find((el) => el.textContent.trim() === text);
  const click = async (el) => {assert.ok(el, "Interactive target exists"); await act(async () => el.click());};
  const setInput = async (el, value) => {await act(async () => {Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(el, value); el.dispatchEvent(new w.Event("input", {bubbles: true}));});};
  const submit = async (el) => {await act(async () => el.dispatchEvent(new w.Event("submit", {bubbles: true, cancelable: true})));};
  global.__rocoAnchorSet = new Set();
  let copied = "";
  Object.defineProperty(w.navigator, "clipboard", {configurable: true, value: {writeText: async (value) => {copied = value;}}});
  Object.defineProperty(global, "navigator", {configurable: true, value: w.navigator});

  await render("/pve/");
  check("PVE has six named navigation entries with colour icons", d.querySelectorAll(".pv71-nav > a").length === 6 && [...d.querySelectorAll(".pv71-nav > a")].every((link) => link.querySelector(".rw-color-icon") && link.textContent.trim()));
  check("Exactly one PVE navigation entry is current", d.querySelectorAll('.pv71-nav a[aria-current="page"]').length === 1 && d.querySelector('.pv71-nav a[aria-current="page"]').getAttribute("href") === "/pve/");
  check("Five separate readable challenge cards have named CTAs", d.querySelectorAll(".pv71-guide-card").length === 5 && [...d.querySelectorAll(".pv71-guide-card")].every((card) => card.querySelector("h2 a") && card.querySelector(".pv71-open-guide").textContent.trim().length > 4 && card.querySelectorAll(".pv71-card-sections a").length >= 2));
  check("PVE home avoids directory-wide or per-card editing", editors().length === 0 && d.querySelector(".pv6-hub").hasAttribute("data-no-editor"));
  check("Tower card directly opens early floors and eighth-floor rules", d.querySelector('[data-guide="star-tower"] a[href="/pve/star-tower/?level=1#pve-context"]') && d.querySelector('[data-guide="star-tower"] a[href="/pve/star-tower/?level=8#pve-context"]'));
  check("Shanhai card has challenge and summon as distinct destinations", d.querySelector('[data-guide="shanhai"] a[href="/pve/shanhai/?view=challenge#pve-context"]') && d.querySelector('[data-guide="shanhai"] a[href="/pve/shanhai/?view=summon#pve-context"]'));
  check("Goal filters are visible, custom and labelled", d.querySelectorAll('.pv71-goal-filter button').length === 5 && !d.querySelector("select"));
  await click(byText('.pv71-goal-filter button', "获取宠物"));
  check("Selecting a reward goal updates URL and all resulting cards", q().get("goal") === "pets" && [...d.querySelectorAll("[data-guide]")].every((card) => pve.guides.find((guide) => guide.slug === card.dataset.guide).goals.includes("pets")));
  await setInput(d.querySelector('.pv6-search input'), "飞鹰契约");
  await submit(d.querySelector('.pv71-filter'));
  check("Search submits alongside the active reward filter", q().get("q") === "飞鹰契约" && q().get("goal") === "pets" && d.querySelectorAll("[data-guide]").length === 1 && d.querySelector("[data-guide]").dataset.guide === "sentry-intelligence");
  await click(byText('.pv71-results-meta button', "清除筛选"));
  check("Clearing filters resets both URL state and search input", !q().has("goal") && !q().has("q") && d.querySelector('.pv6-search input').value === "" && d.querySelectorAll("[data-guide]").length === 5);
  await render("/pve/?q=definitely-unrecorded");
  check("Unmatched PVE queries have an honest empty state", d.querySelectorAll("[data-guide]").length === 0 && d.body.textContent.includes("没有匹配的 PVE 资料"));

  await render("/pve/star-tower/?level=3&view=obsolete&q=留存条件");
  check("Tower opens the requested floor with eight directly available choices", d.querySelectorAll('.pv71-floor-options button').length === 8 && d.querySelector('.pv71-floor-options button[aria-pressed="true"]').dataset.floor === "3");
  check("Challenge selector is the first content section", d.querySelector('.rw-doc-main .rw-section, .rw-doc-body .rw-section, .rw-docgrid .rw-section')?.id === "pve-context" || [...d.querySelectorAll('.pv6-guide .rw-section')][0]?.id === "pve-context");
  await click(d.querySelector('[data-floor="8"]'));
  check("Floor selection retains other query context and removes stale stage", q().get("level") === "8" && !q().has("view") && q().get("q") === "留存条件" && d.querySelector('.pv6-context-body').textContent.includes("星辰令"));
  check("Historical Boss action stays scoped to selected floor", d.querySelector('[data-pve-archive-link]').getAttribute("href") === "/challenges/star-tower/?level=8");
  check("Current floor knowledge gaps are labelled without invented opponents", d.querySelector('.pv71-data-status').textContent.includes("当前第 8 层") && d.querySelector('.pv71-data-status').textContent.includes("仍待补充"));
  await click(d.querySelector('.pv71-share'));
  check("Sharing preserves the selected floor URL", copied.includes("level=8") && new URL(copied).searchParams.get("q") === "留存条件" && d.querySelector('[role="status"]').textContent.includes("已复制"));
  check("PVE has a single scoped add-plan entry", editors(d.querySelector('#pve-pets')).filter((el) => params(el).get("intent") === "add").length === 1 && editors(d.querySelector('#pve-pets')).every((el) => params(el).get("returnTo").includes("level=8")));
  check("Custom section DOM ids are registered for the Docusaurus checker", ["pve-context", "pve-pets", "pve-rewards"].every((id) => d.getElementById(id) && global.__rocoAnchorSet.has(id)));
  const {handleBrokenLinks} = require(path.join(project, "node_modules/@docusaurus/core/lib/server/brokenLinks.js"));
  await handleBrokenLinks({onBrokenLinks: "throw", onBrokenAnchors: "throw", routes: [{path: "/pve/", exact: true}, {path: "/pve/star-tower/", exact: true}], collectedLinks: {
    "/pve/": {anchors: [], links: ["/pve/star-tower/?level=8#pve-context"]},
    "/pve/star-tower/": {anchors: [...global.__rocoAnchorSet], links: ["/pve/star-tower/?level=8#pve-pets", "/pve/star-tower/?level=8#pve-rewards"]},
  }});
  check("Installed Docusaurus checker accepts query-and-anchor URLs after registration", true);
  for (const value of ["0", "9", "1.5", "not-a-floor"]) {
    await render("/pve/star-tower/?level=" + value);
    check("Invalid floor " + value + " safely falls back to first floor", d.querySelector('.pv71-floor-options button[aria-pressed="true"]').dataset.floor === "1");
  }
  check("Historical plan retains its known floor and unknown-floor caution separately", d.querySelector('[data-pve-recommendation="bishui-sacred-wu-20200511"]').textContent.includes("历史第 7 层") && d.querySelector('[data-pve-recommendation="bishui-ice-dragon"]').textContent.includes("层数待补") && d.querySelectorAll('.pv71-plan.is-caution').length === 1);

  await render("/pve/shanhai/?level=4&view=challenge");
  check("Shanhai presents challenge and summon controls without invented floors", d.querySelectorAll('.pv71-stage-options button').length === 2 && !d.querySelector('.pv71-floor-options') && d.querySelector('.pv71-data-status').textContent.includes("今日秘境"));
  await click(d.querySelector('[data-stage="summon"]'));
  check("Shanhai selection updates readable rules and removes unrelated floor", q().get("view") === "summon" && !q().has("level") && d.querySelector('.pv6-context-body').textContent.includes("祥云印记") && d.querySelector('.pv71-context-current').textContent.includes("山海召唤"));
  await render("/pve/shanhai/?view=not-a-stage");
  check("Unrecognised Shanhai stage falls back to challenge", d.querySelector('.pv71-stage-options button[aria-pressed="true"]').dataset.stage === "challenge");
  for (const guide of pve.guides.filter((guide) => guide.slug !== "star-tower")) {
    const stage = guide.sections.at(-1).value;
    await render(`/pve/${guide.slug}/?view=${stage}`);
    check(guide.name + " restores stage from a shared URL", d.querySelector('.pv71-stage-options button[aria-pressed="true"]').dataset.stage === stage && editors(d.querySelector('#pve-pets')).filter((el) => params(el).get("intent") === "add").length === 1);
  }
  const newPlan = {id: "v71-pve-new", status: "published", editorVersion: 7, editorMode: "pve", editorRequest: {entity: "山海秘境", section: "挑战方案", mode: "pve", intent: "add", returnTo: "/pve/shanhai/?view=challenge#pve-pets"}, updatedAt: "2026-10-10T13:00:00Z", typedData: {title: "条件测试方案", challenge: "测试秘境 · 测试对手", version: "2026-10-10 测试", testedAt: "2026-10-10", pets: "碧水灵兽", requirements: "测试限制一\n测试限制二", steps: "先确认条件，再进行测试。", alternatives: "其他队伍尚未验证。", sourceUrl: "https://example.com/pve-test"}};
  await render("/pve/shanhai/");
  await publish([newPlan, {...newPlan, id: "v71-pve-pending", status: "review", typedData: {...newPlan.typedData, challenge: "不能出现在正文的待审方案"}}]);
  check("Published new PVE plan appears without leaking pending submissions", d.querySelectorAll('[data-pve-recommendation]').length === 1 && d.body.textContent.includes("测试秘境 · 测试对手") && !d.body.textContent.includes("不能出现在正文的待审方案"));
  check("New PVE plan has a stable record-aware re-edit entry", params(editors(d.querySelector('[data-pve-recommendation]'))[0]).get("record") === newPlan.id);
  const snapshot = api.getPublishedSnapshot({entity: "山海秘境", section: "挑战方案", mode: "pve", record: newPlan.id, returnTo: "/pve/shanhai/#pve-pets"}, {version: 1, submissions: [newPlan]});
  check("Reopening a newly published PVE plan loads its current content", snapshot.scope === "local" && snapshot.data.challenge === newPlan.typedData.challenge && snapshot.data.pets === "碧水灵兽");
  const edited = {...newPlan, id: "v71-pve-edit", updatedAt: "2026-10-10T14:00:00Z", editorRequest: {...newPlan.editorRequest, record: newPlan.id, intent: "edit"}, typedData: {...newPlan.typedData, steps: "更新后的可读步骤"}};
  await publish([newPlan, edited]);
  check("A revision replaces its own PVE record and keeps one visible card", d.querySelectorAll('[data-pve-recommendation]').length === 1 && d.querySelector('.pv71-plan').textContent.includes("更新后的可读步骤"));
  await render("/pve/training-hall/");
  check("PVE publication stays within its requested guide", d.querySelectorAll('[data-pve-recommendation]').length === 0);
  const oldPatch = {...newPlan, id: "v71-pve-old-edit", editorRequest: {entity: "星辰之塔", section: "挑战方案", mode: "pve", record: "bishui-sacred-wu-20200511", returnTo: "/pve/star-tower/", intent: "edit"}, typedData: {...newPlan.typedData, challenge: "圣尊武王修订记录"}};
  await render("/pve/star-tower/");
  await publish([oldPatch]);
  check("Existing PVE records update in place while the other record survives", d.querySelectorAll('[data-pve-recommendation]').length === 2 && d.querySelector('[data-pve-recommendation="bishui-sacred-wu-20200511"]').textContent.includes("圣尊武王修订记录") && d.querySelector('[data-pve-recommendation="bishui-ice-dragon"]'));
  await act(async () => root.render(React.createElement(api.PreviewContent, {mode: "pve", data: newPlan.typedData})));
  check("Rendered PVE editing preview uses the same readable card and field layout", d.querySelector('.pv71-plan .pv71-plan-field') && d.querySelector('.pv71-plan h3').textContent === newPlan.typedData.challenge && d.querySelector('.pv71-plan').textContent.includes("必要配置与条件") && !d.querySelector('a[href^="/edit/"]'));
  await publish([]);

  await render("/adventure/");
  check("Adventure has four consistent coloured entry cards", d.querySelectorAll('.wa71-entry').length === 4 && [...d.querySelectorAll('.wa71-entry')].every((card) => card.querySelector('.rw-color-icon') && card.querySelector('.wa71-entry-action')));
  check("Common places each have their own coloured icon and destination", d.querySelectorAll('.wa-compact-places > a').length === 6 && [...d.querySelectorAll('.wa-compact-places > a')].every((card) => card.querySelector('.rw-color-icon') && routes.includes(card.getAttribute("href"))));
  check("Adventure navigation has no duplicate PVE category or broad editor", d.querySelectorAll('.wa-v71-nav > a').length === 5 && !d.querySelector('.wa-v71-nav a[href="/pve/"]') && editors().length === 0);
  await render("/places/");
  check("Places list has one scoped shortcut addition and no directory-wide editor", editors().length === 1 && params(editors()[0]).get("mode") === "index" && params(editors()[0]).get("intent") === "add" && editors()[0].textContent.includes("快捷入口"));
  check("Place entries use coloured icons and preserve existing detail routes", d.querySelectorAll('.wa-place-rows > a').length === 6 && [...d.querySelectorAll('.wa-place-rows > a')].every((card) => card.querySelector('.rw-color-icon') && routes.includes(card.getAttribute("href"))));
  const placeEntry = {id: "v71-place-link", status: "published", editorVersion: 7, editorMode: "index", updatedAt: "2026-10-10T13:00:00Z", editorRequest: {intent: "add", returnTo: "/places/"}, typedData: {entries: [{id: "academy-scenes", title: "学院内的场景", href: "/places/academy/#scenes", description: "定位教学楼与图书馆。"}]}};
  await publish([placeEntry, {...placeEntry, id: "pending", status: "review", typedData: {entries: [{id: "pending", title: "待审入口", href: "/places/castle/"}]}}, {...placeEntry, id: "invalid", typedData: {entries: [{title: "不存在的地区", href: "/places/not-a-real-place/"}]}}]);
  check("Place shortcut readback admits published existing destinations only", d.querySelectorAll('[data-place-quicklink]').length === 1 && d.querySelector('[data-place-quicklink]').getAttribute("href") === "/places/academy/#scenes" && !d.body.textContent.includes("待审入口") && !d.body.textContent.includes("不存在的地区"));
  await publish([placeEntry, {...placeEntry, id: "edited-link", updatedAt: "2026-10-10T14:00:00Z", typedData: {entries: [{...placeEntry.typedData.entries[0], title: "学院场景快捷入口"}]}}]);
  check("Stable shortcut ID prevents duplicate rows on later publication", d.querySelectorAll('[data-place-quicklink]').length === 1 && d.querySelector('[data-place-quicklink]').textContent.includes("学院场景快捷入口"));
  await render("/places/?region=field");
  check("Places category filters remain shareable and scope shortcuts", d.querySelectorAll('.wa-place-rows > a').length === 4 && !d.querySelector('[data-place-quicklink]') && d.querySelector('.wa-atlas-index a[aria-current="page"]').textContent === "野外与其他");
  await publish([]);
  await render("/places/academy/");
  check("Specific place details retain meaningful article editing", d.querySelector('.wa-v71-place .wa-place-summary .rw-color-icon') && editors().length > 0 && d.querySelector('#scenes'));

  await render("/mechanics/");
  check("Mechanics top level directly opens the real all-mechanisms document", d.querySelector('[data-mechanics-overview-entry]').textContent.trim() === "全部机制" && d.querySelector('[data-mechanics-overview-entry]').getAttribute("href") === "/mechanics/overview/");
  check("Mechanics overview does not offer broad catalogue editing", editors().length === 0 && d.querySelector('.rw-mechanics-v71').hasAttribute("data-no-editor"));
  check("Six mechanism topics carry distinct coloured icons", d.querySelectorAll('.rw-mechanics-directory .rw-color-icon').length === 6);
  const overview = fs.readFileSync(path.join(project, "docs/mechanics/overview.md"), "utf8");
  const sidebar = require("../sidebars.js");
  const previewSource = fs.readFileSync(path.join(project, "preview/main.jsx"), "utf8");
  check("Overview route is a native docs sidebar entry with a page TOC", fs.readFileSync(path.join(project, "docusaurus.config.js"), "utf8").includes('routeBasePath: "/"') && overview.includes("slug: /mechanics/overview") && sidebar.mechanicsSidebar[0] === "mechanics/overview" && (overview.match(/^## /gm) || []).length >= 4);
  check("Standalone preview also uses the same full document sidebar", previewSource.includes("sidebars.mechanicsSidebar") && previewSource.includes("rw-preview-sidebar") && previewSource.includes("rw-preview-doc-body") && previewSource.includes("rw-preview-doc-toc"));

  const pveCss = fs.readFileSync(path.join(project, "src/wiki/PveV71.css"), "utf8");
  const worldCss = fs.readFileSync(path.join(project, "src/wiki/WorldV7.css"), "utf8");
  const customCss = fs.readFileSync(path.join(project, "src/css/custom.css"), "utf8");
  const postcss = require("postcss");
  check("New stylesheets parse and both builds share the same PVE/skill CSS order", postcss.parse(pveCss).nodes.length > 0 && postcss.parse(worldCss).nodes.length > 0 && ["../wiki/PveV71.css", "../wiki/SkillBranchView.css"].every((file) => customCss.indexOf(file) > customCss.indexOf('./v7.css') && customCss.indexOf(file) < customCss.indexOf('./v71.css')) && !fs.readFileSync(path.join(project, "src/wiki/PvePages.jsx"), "utf8").includes('import "./PveV71.css"') && !fs.readFileSync(path.join(project, "src/wiki/SkillBranchView.jsx"), "utf8").includes('import "./SkillBranchView.css"'));
  check("Navigation and floor controls have explicit mobile wrapping", pveCss.includes("@media (max-width: 520px)") && pveCss.includes(".pv71 .pv71-nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }") && pveCss.includes(".pv71 .pv71-floor-options { grid-template-columns: repeat(4, minmax(0, 1fr)); }"));
  check("Adventure and places layouts keep zero-minimum tracks and mobile stacks", worldCss.includes(".wa-page.wa-v71-adventure .wa-directory { grid-template-columns: minmax(0, 1fr)") && worldCss.includes(".wa-page.wa-v71-places .wa-atlas { grid-template-columns: minmax(0, 1fr)") && worldCss.includes(".wa-page.wa-v71-adventure .wa-compact-places > a:nth-child(n)"));
  const luminance = (hex) => {const rgb = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((x) => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];};
  const contrast = (fg,bg) => (luminance(bg) + .05) / (luminance(fg) + .05);
  check("PVE and adventure helper text colour pairs meet 4.5:1 contrast", [["66748a", "ffffff"], ["526f60", "eff6f3"], ["65758a", "ffffff"], ["536e62", "f0f6f3"], ["7d6740", "faf7ee"]].every(([fg,bg]) => contrast(fg,bg) >= 4.5));
  check("New interactions explicitly honour reduced motion", pveCss.includes("@media (prefers-reduced-motion: reduce)") && worldCss.includes(".wa-page.wa-v71-adventure .wa71-entry { transition: none; }"));
  check("World/PVE/mechanics interactions produce no React runtime errors", runtimeErrors.length === 0);
}
main().catch((error) => checks.push({name: "V7.1 world DOM run completed", passed: false, error: error.stack})).finally(async () => {
  if (root) await act(async () => root.unmount());
  if (dom) dom.window.close();
  console.error = oldConsoleError;
  fs.rmSync(temporary, {recursive: true, force: true});
  const tracked = ["src/wiki/core.jsx", "preview/broken-links.js", "scripts/build-preview.mjs", "scripts/build-section-snapshots.cjs", "src/css/custom.css", "src/wiki/SkillBranchView.jsx", "src/wiki/SkillBranchView.css", "src/wiki/PvePages.jsx", "src/wiki/PvePlanCard.jsx", "src/wiki/PveV71.css", "src/wiki/WorldPages.jsx", "src/wiki/WorldV7.css", "src/wiki/MechanicsPages.jsx", "src/wiki/editing/registry.js", "src/wiki/editing/PreviewContent.jsx", "content/routes.json", "content/pve-v6.json", "content/pve-pet-recommendations-v7.json", "docs/mechanics/overview.md", "sidebars.js", "preview/main.jsx"];
  const report = {version: "7.1", scope: "PVE navigation, floor/stage URL state, scoped publication/readback, adventure consistency, direct native mechanisms entry. DOM/source/colour checks; no browser layout or game-client verification.", generatedAt: new Date().toISOString(), sourceHashes: Object.fromEntries(tracked.map((file) => [file, createHash("sha256").update(fs.readFileSync(path.join(project, file))).digest("hex")])), checks, runtimeErrors, passed: checks.every((row) => row.passed) && !runtimeErrors.length};
  fs.writeFileSync(path.join(__dirname,"v71-world-check-results.json"),JSON.stringify(report,null,2)+"\n");
  console.log(checks.filter((row)=>row.passed).length+"/"+checks.length+" V7.1 world checks passed.");
  for (const row of checks.filter((row)=>!row.passed)) console.log(row.name,row.error||"");
  if (runtimeErrors.length) console.log(runtimeErrors);
  process.exitCode=report.passed?0:1;
});
