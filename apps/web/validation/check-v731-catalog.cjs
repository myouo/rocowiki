/** V7.3.1 adventure-directory interactions and primary-edit style contracts.
 * JSDOM does not validate browser geometry, screenshots, zoom or animation performance.
 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { createHash } = require("node:crypto");
const project = path.resolve(__dirname, "..");
const esbuild = require("esbuild"), React = require("react"), postcss = require("postcss"), { JSDOM, VirtualConsole } = require("jsdom");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "roco-v731-catalog-"));
const checks = [], errors = [], oldError = console.error;
let dom, root;
const check = (name, result) => { checks.push({ name, passed: Boolean(result) }); assert.ok(result, name); };
async function main() {
  console.error = (...args) => errors.push(args.map(String).join(" "));
  const virtualConsole = new VirtualConsole(); virtualConsole.on("jsdomError", error => errors.push(String(error)));
  dom = new JSDOM('<main id="root" class="rw"></main>', { url: "https://wiki.test/items/", pretendToBeVisual: true, virtualConsole });
  const w = dom.window, d = w.document;
  Object.assign(global, { window: w, document: d, HTMLElement: w.HTMLElement, Node: w.Node, localStorage: w.localStorage, CustomEvent: w.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(global, "navigator", { value: w.navigator, configurable: true });
  w.HTMLElement.prototype.scrollIntoView = function() {};
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  await esbuild.build({
    stdin: { contents: 'import React from "react"; import {useLocation} from "@docusaurus/router"; import World from "./src/wiki/WorldPages.jsx"; import Pve from "./src/wiki/PvePages.jsx"; export default function Harness(){const loc=useLocation();if(loc.pathname==="/edit/")return <output data-editor-route>{loc.search}</output>;const Component=loc.pathname.startsWith("/pve/")?Pve:World;return <Component path={loc.pathname} query={new URLSearchParams(loc.search)}/>;}', resolveDir: project, loader: "jsx" },
    outfile: path.join(temporary, "catalog.cjs"), bundle: true, format: "cjs", platform: "node", logLevel: "silent", loader: { ".css": "empty" },
    plugins: [require('./runtime-context-plugin.cjs'), { name: "local-route-interactions", setup(build) {
      build.onResolve({ filter: /^(react|react-dom|lucide-react)(\/.*)?$/ }, args => ({ path: require.resolve(args.path, { paths: [project] }), external: true }));
      build.onResolve({ filter: /^@docusaurus\// }, args => ({ path: args.path, namespace: "docusaurus" }));
      build.onLoad({ filter: /.*/, namespace: "docusaurus" }, args => ({ loader: "jsx", resolveDir: project, contents: args.path.endsWith("/useBrokenLinks") ? "export default function(){return {collectAnchor(){},collectLink(){}};}" : args.path.endsWith("/useBaseUrl") ? "export default function(value){return value;}" : args.path.endsWith("/Link")
        ? 'import React from "react";export default function Link({to,children,onClick,...props}){return <a href={to} {...props} onClick={event=>{onClick?.(event);if(!event.defaultPrevented&&String(to).startsWith("/")){event.preventDefault();window.history.pushState({},"",to);window.dispatchEvent(new window.Event("test-route"));}}}>{children}</a>;}'
        : 'import React from "react";const read=()=>({pathname:window.location.pathname,search:window.location.search,hash:window.location.hash});export function useLocation(){const [value,set]=React.useState(read);React.useEffect(()=>{const update=()=>set(read());window.addEventListener("test-route",update);return()=>window.removeEventListener("test-route",update)},[]);return value;}export function useHistory(){return {replace(url){window.history.replaceState({},"",url);window.dispatchEvent(new window.Event("test-route"));}};}' }));
    } }],
  });
  const Harness = require(path.join(temporary, "catalog.cjs")).default;
  root = require("react-dom/client").createRoot(d.querySelector("#root"));
  await React.act(async () => root.render(React.createElement(Harness)));
  const click = async element => { assert.ok(element, "Expected click target"); await React.act(async () => element.click()); };
  const go = async url => { await React.act(async () => { w.history.pushState({}, "", url); w.dispatchEvent(new w.Event("test-route")); }); };
  const inputText = async (label, value) => { const input = d.querySelector(`input[aria-label="${label}"]`); assert.ok(input); await React.act(async () => { input.focus(); Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new w.Event("input", { bubbles: true })); }); return input; };
  const linkText = (text, scope = d) => [...scope.querySelectorAll("a")].find(node => node.textContent.trim() === text);
  const params = () => new URLSearchParams(w.location.search);
  const directory = key => d.querySelector(`.rw-directory[data-directory="${key}"]`);
  const mainCreate = () => d.querySelector('.rw-pagehead .rw-edit-entry-primary');
  const submit = () => click(d.querySelector('.rw-directory-search button[type="submit"]'));

  for (const [key, title, label, mode] of [["items", "物品目录", "新增物品入口", "index"], ["tasks", "任务目录", "新增任务入口", "index"], ["npcs", "人物目录", "新增人物条目", "npc"], ["places", "地区与子场景", "补充地点快捷入口", "index"]]) {
    await go(`/${key}/`);
    const panel = directory(key), action = mainCreate();
    check(`${key}: shared directory has an accessible title, coloured icon and one primary creation action`, panel && d.getElementById(panel.getAttribute('aria-labelledby'))?.textContent === title && panel.querySelector('.rw-directory-header .rw-color-icon') && d.querySelectorAll('.rw-pagehead .rw-edit-entry-primary').length === 1 && action.textContent.trim() === label && [...d.querySelectorAll('a')].filter(node => node.textContent.trim() === label).length === 1);
    await click(action);
    check(`${key}: creation click preserves the original typed editor and return destination`, w.location.pathname === "/edit/" && params().get("mode") === mode && params().get("intent") === "add" && params().get("returnTo") === `/${key}/`);
  }

  await go('/items/');
  await inputText('搜索道具', '  HP  '); await submit();
  check('Item search trims input, updates its shareable URL and keeps the existing item route', params().get('q') === 'HP' && directory('items').querySelectorAll('.rw-directory-entry').length === 1 && directory('items').querySelector('.rw-directory-entry').getAttribute('href') === '/items/potion/');
  await click(linkText('宠物装备', directory('items')));
  check('Item categories preserve search state and show an honest zero-result state', params().get('category') === 'equipment' && params().get('q') === 'HP' && !directory('items').querySelector('.rw-directory-entry') && directory('items').textContent.includes('这一分类还没有匹配的物品'));
  const clearItem = d.querySelector('[aria-label="清空搜索"]'); clearItem.focus(); await click(clearItem);
  check('Clearing item search retains the category and returns keyboard focus to the live input', !params().has('q') && params().get('category') === 'equipment' && d.activeElement === d.querySelector('input[aria-label="搜索道具"]') && d.activeElement.value === '');
  await click(linkText('查看全部已收录物品', directory('items')));
  await click(directory('items').querySelector('.rw-directory-entry'));
  check('The reusable item entry opens its existing detail page', w.location.pathname === '/items/potion/' && d.querySelector('h1')?.textContent === 'HP药剂');

  await go('/npcs/'); await inputText('搜索人物', '格里芬'); await submit();
  check('NPC search filters existing rows and preserves individual character routes', directory('npcs').querySelectorAll('tbody tr').length === 1 && directory('npcs').querySelector('tbody .wa-title-link').getAttribute('href') === '/npcs/griffin/');
  await click(d.querySelector('[aria-label="按地区筛选人物"]'));
  await click([...d.querySelectorAll('[role="option"]')].find(node => node.textContent.includes('王国城堡')));
  check('NPC area filtering combines with the current search instead of resetting it', params().get('area') === 'castle' && params().get('q') === '格里芬' && directory('npcs').querySelectorAll('tbody tr').length === 0);
  d.querySelector('[aria-label="清空搜索"]').focus(); await click(d.querySelector('[aria-label="清空搜索"]'));
  check('NPC clear restores the matching region results and input focus', !params().has('q') && params().get('area') === 'castle' && directory('npcs').querySelector('tbody .wa-title-link').textContent === '兰斯洛' && d.activeElement === d.querySelector('input[aria-label="搜索人物"]'));

  await go('/places/'); await inputText('搜索地区和子场景', '教学楼'); await submit();
  check('Place search includes child scenes and retains the canonical parent place route', directory('places').querySelectorAll('.wa-place-rows > a').length === 1 && directory('places').querySelector('.wa-place-rows > a').getAttribute('href') === '/places/academy/');
  await click([...d.querySelectorAll('.wa-atlas-index a')].find(node => node.textContent.includes('野外与其他')));
  check('Map category links retain the search and correctly display no matching scenes', params().get('region') === 'field' && params().get('q') === '教学楼' && !directory('places').querySelector('.wa-place-rows') && directory('places').textContent.includes('没有匹配的地区或子场景'));
  await click(linkText('重置筛选', directory('places')));
  check('Map reset restores all six original place destinations', directory('places').querySelectorAll('.wa-place-rows > a').length === 6 && !w.location.search);

  await go('/tasks/');
  check('Tasks reuse the rounded entry, retain official type icons and do not add an unneeded search mode', directory('tasks').querySelector('.rw-directory-entry')?.getAttribute('href') === '/tasks/badges/' && directory('tasks').querySelectorAll('.rw-type-icon img').length === 10 && !directory('tasks').querySelector('form'));
  await click(linkText('主线剧情', directory('tasks')));
  const taskEmptyCreate = linkText('补充任务记录', directory('tasks'));
  check('Task category empty state keeps a scoped add action with the current return filter', params().get('view') === 'story' && directory('tasks').textContent.includes('主线章节目录待补充') && new URL(taskEmptyCreate.href).searchParams.get('mode') === 'index' && new URL(taskEmptyCreate.href).searchParams.get('intent') === 'add' && new URL(taskEmptyCreate.href).searchParams.get('returnTo') === '/tasks/?view=story');
  await click(linkText('徽章任务', directory('tasks'))); await click(directory('tasks').querySelector('.rw-directory-entry'));
  check('The reusable task entry opens the original badge index', w.location.pathname === '/tasks/badges/' && d.querySelector('h1')?.textContent === '徽章任务');

  await go('/pve/');
  const pveCreate = mainCreate();
  check('PVE creation uses the same primary variant as the adventure directories', pveCreate?.classList.contains('rw-catalog-create-v73') && pveCreate.textContent.trim() === '新增玩法');
  const legacy = postcss.parse(fs.readFileSync(path.join(project, 'src/wiki/EditingV7.css'), 'utf8'));
  const primary = postcss.parse(fs.readFileSync(path.join(project, 'src/wiki/editing/EditEntry.css'), 'utf8'));
  const matchingImportantColors = [];
  legacy.walkRules(rule => { if (rule.selectors.some(selector => { try { return pveCreate.matches(selector); } catch { return false; } })) rule.walkDecls('color', declaration => { if (declaration.important) matchingImportantColors.push(declaration.value); }); });
  check('Legacy important editing colours no longer match a primary create link', matchingImportantColors.length === 0);
  const declaration = (selector, property) => { let value; primary.walkRules(rule => { if (rule.selectors.includes(selector)) rule.walkDecls(property, node => { value = node.value; }); }); return value; };
  const base = '.rw-edit-entry.rw-edit-entry-primary';
  check('Primary action declares white foreground in normal, link, visited, hover, focus and active states', ['', ':link', ':visited', ':hover', ':focus-visible', ':active'].every(state => declaration(base + state, 'color') === '#fff'));
  const luminance = hex => hex.replace('#', '').match(/../g).map(part => parseInt(part, 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
  check('All primary-action backgrounds keep at least 4.5:1 contrast with their white label', ['', ':hover', ':active'].every(state => 1.05 / (luminance(declaration(base + state, 'background')) + .05) >= 4.5));
  await click(pveCreate);
  check('The PVE primary action remains a real link to the scoped add-playstyle editor', w.location.pathname === '/edit/' && params().get('mode') === 'pve-guide' && params().get('intent') === 'add' && params().get('returnTo') === '/pve/');

  const directoryCss = fs.readFileSync(path.join(project, 'src/wiki/DirectoryPanel.css'), 'utf8');
  const cssRoot = postcss.parse(directoryCss), style = (selector, property) => { let value; cssRoot.walkRules(rule => { if (rule.selectors.includes(selector)) rule.walkDecls(property, declaration => { value = declaration.value; }); }); return value; };
  check('Shared CSS declares rounded search/cards and bounded responsive tracks without page-specific important patches', style('.rw-directory-search .rw-directory-input', 'border-radius') === '14px' && style('.rw-directory .rw-directory-entry', 'border-radius') === '18px' && directoryCss.includes('grid-template-columns: minmax(0, 1fr) auto') && directoryCss.includes('max-width: 100%') && !directoryCss.includes('!important'));
  const imports = fs.readFileSync(path.join(project, 'src/css/custom.css'), 'utf8');
  check('Both shared component styles are imported after the legacy V7.3 cascade', ['../wiki/DirectoryPanel.css', '../wiki/editing/EditEntry.css'].every(file => imports.indexOf(file) > imports.indexOf('./v73.css')));
  check('Focused directory interactions complete without unrelated React/runtime errors', errors.length === 0);
}
main().catch(error => { checks.push({ name: 'Focused directory run completed', passed: false, error: error.stack }); oldError(error); }).finally(async () => {
  if (root) await React.act(async () => root.unmount());
  dom?.window.close(); console.error = oldError; fs.rmSync(temporary, { recursive: true, force: true });
  const sourceFiles = ['src/wiki/DirectoryPanel.jsx', 'src/wiki/DirectoryPanel.css', 'src/wiki/WorldPages.jsx', 'src/wiki/editing/EditEntry.jsx', 'src/wiki/editing/EditEntry.css', 'src/wiki/EditingV7.css', 'src/wiki/PvePages.jsx', 'src/css/custom.css'];
  const report = { version: '7.3.1', scope: 'Adventure directory/search/clear/category/create/detail route clicks; primary-action CSS matching and declared colour contrast. JSDOM interactions and CSS contracts only, not browser geometry, screenshots, zoom, animation or lifecycle validation.', generatedAt: new Date().toISOString(), total: checks.length, passed: checks.filter(check => check.passed).length, checks, errors, sourceHashes: Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(project, file))).digest('hex')])) };
  fs.writeFileSync(path.join(__dirname, 'v731-catalog-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`V7.3.1 catalog: ${report.passed}/${report.total} passed`); process.exitCode = checks.every(check => check.passed) && !errors.length ? 0 : 1;
});
