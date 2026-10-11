/** V7.3 capability mappings, immutable local snapshots and mounted calculator interactions. No browser geometry/gameplay QA. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const project = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "roco-v73-calculators-"));
const bundle = path.join(temporary, "suite.cjs");
const esbuild = require(require.resolve("esbuild", { paths: [project] }));
const React = require(require.resolve("react", { paths: [project] }));
const { JSDOM } = require(require.resolve("jsdom", { paths: [project] }));
const checks = [], runtimeErrors = [];
const originalError = console.error;
let dom, root;
function check(name, value) { const pass = Boolean(value); checks.push({ name, pass }); assert.ok(pass, name); }
function equal(name, actual, expected) { assert.deepEqual(actual, expected, name); checks.push({ name, pass: true }); }
function memoryStorage() { const values = new Map(); return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) }; }

async function main() {
  await esbuild.build({
    stdin: { contents: 'export * from "./src/wiki/rocoCalculations.js"; export * from "./src/wiki/statsProfiles.js"; export * from "./src/wiki/calculatorSnapshotStore.js"; export {default as PetStatsMini} from "./src/wiki/PetStatsMini.jsx"; export {default as ToolsPages} from "./src/wiki/ToolsPages.jsx"; export {pets} from "./src/wiki/data.js";', resolveDir: project, loader: "jsx" },
    outfile: bundle, bundle: true, format: "cjs", platform: "node", loader: { ".css": "empty" }, logLevel: "silent",
    plugins: [require('./runtime-context-plugin.cjs'), { name: "local-ui-environment", setup(build) {
      build.onResolve({ filter: /^(react|react-dom|lucide-react)(\/.*)?$/ }, (args) => ({ path: require.resolve(args.path, { paths: [project] }), external: true }));
      build.onResolve({ filter: /^@docusaurus\// }, (args) => ({ path: args.path, namespace: "docusaurus-stub" }));
      build.onLoad({ filter: /.*/, namespace: "docusaurus-stub" }, (args) => ({ loader: "jsx", resolveDir: project, contents: args.path.endsWith("/useBrokenLinks") ? "export default function useBrokenLinks(){return {collectAnchor(){},collectLink(){}};}" : args.path.endsWith("/Link")
        ? 'import React from "react"; export default function Link({to,children,...rest}) { return <a href={to} {...rest}>{children}</a>; }'
        : args.path.endsWith("/useBaseUrl") ? "export default function useBaseUrl(value){return value;}"
        : 'import React from "react"; const read=()=>({pathname:window.location.pathname,search:window.location.search,hash:window.location.hash}); export function useLocation(){const [value,set]=React.useState(read);React.useEffect(()=>{const update=()=>set(read());window.addEventListener("test-route",update);return()=>window.removeEventListener("test-route",update)},[]);return value;} export function useHistory(){return {replace(url){window.history.replaceState({},"",url);window.dispatchEvent(new window.Event("test-route"))},push(url){window.history.pushState({},"",url);window.dispatchEvent(new window.Event("test-route"))}};}' }));
    } }],
  });
  const C = require(bundle), primary = JSON.parse(fs.readFileSync(path.join(project, "content/calculator-mappings-v73.json")));
  const haifu = C.pets.find((pet) => pet.slug === "haifu"), bishui = C.pets.find((pet) => pet.slug === "bishui"), form = C.statsDefaultsForPet(bishui);
  equal("Known species and forum cultivation baseline is unchanged", C.calculateStats(form).battle, [445, 316, 282, 238, 296, 254]);
  check("Mapping has forty explicit levels and a primary official forum provenance", Object.keys(C.GUARDIAN_LEVELS).length === 40 && primary.source.url.includes("17roco.gamebbs.qq.com") && primary.source.retrievedHtmlSha256.length === 64);
  for (const [from, to, bonus] of [[1,4,1],[5,9,7],[10,14,13],[15,20,20],[21,26,28],[27,32,34],[33,39,40],[40,40,50]]) {
    for (let level = from; level <= to; level++) {
      const result = C.calculateStats({ ...form, guardianLevel: String(level) });
      assert.equal(result.valid, true); assert.deepEqual(result.battle.map((value, index) => value - result.panel[index]), [bonus, bonus, bonus, bonus, bonus, 0]);
    }
    check(`All mapped levels ${from}–${to} use the sourced +${bonus} five-stat bonus`, true);
  }
  equal("Zero explicitly disables the guardian without inventing level zero game data", C.guardianForLevel(0).bonus, [0,0,0,0,0,0]);
  check("Missing level data stops the calculation rather than interpolating or using zero", !C.guardianForLevel(17, {}).valid);
  for (const value of ["", "1.5", "-1", "41", "Infinity"]) check(`Invalid guardian level ${JSON.stringify(value)} is rejected`, !C.calculateStats({ ...form, guardianLevel: value }).valid);
  const legacy = { ...form, guardian: "7" }; delete legacy.guardianLevel; delete legacy.guardianLegacyRange;
  const normalized = C.normalizeStatsLinkData(legacy);
  check("Legacy bonus values migrate to a labelled range, not a fabricated exact level", normalized.guardianLevel === "5" && normalized.guardianLegacyRange === "5–9" && C.calculateStats(legacy).warnings[0].includes("旧链接"));
  const oldMax = { ...legacy, guardian: "50" };
  equal("Old max-stage links still yield the exact same six numbers", C.calculateStats(oldMax).battle, C.calculateStats({ ...form, guardianLevel: "40" }).battle);
  const named = C.calculateStats({ ...form, nature: "固执", accessory: "eternal", weapon: "sun", armor: "flame", guardianLevel: "40" });
  check("Named equipment is added after nature and guardian stays outside panel", named.rows[1].panel === Math.floor(316 * 11 / 10) + 90 && named.rows[1].battle === named.rows[1].panel + 50 && named.rows[0].equipment === 120 && named.rows[5].equipment === 0);
  equal("Magic weapon, armor and accessory affect only their respective dimensions", C.calculateStats({ ...form, accessory: "eternal", weapon: "moon", armor: "wind" }).battle, [565,316,282,328,386,254]);
  check("Named level 100 gear rejects a lower-level pet", !C.calculateStats({ ...form, level: "99", weapon: "sun" }).valid);
  const manual = C.calculateStats({ ...form, accessory: "custom", accessoryBonus: "17", weapon: "custom", weaponStat: "magicAttack", weaponBonus: "23", armor: "custom", armorStat: "defense", armorBonus: "31" });
  equal("Manual three-slot values apply separately to the selected dimensions", manual.battle, [462,316,313,261,296,254]);
  check("Manual gear is explicitly marked and may not alter speed", manual.warnings.length === 3 && !C.calculateStats({ ...form, weapon: "custom", weaponStat: "speed", weaponBonus: "23" }).valid);
  check("Accessory secondary affixes remain one-of metadata, excluded from six stats", primary.equipment.accessory[0].secondaryMode === "one-of" && primary.equipment.accessory[0].secondary.accuracy === 65 && named.rows[5].battle === C.calculateStats({ ...form, nature: "固执" }).rows[5].battle);
  check("Effort and intimacy validation remain intact", !C.calculateStats({ ...form, effort: [255,255,1,0,0,0] }).valid && !C.calculateStats({ ...form, relationship: "kindred", intimacy: [20,0,10,0,10,10] }).valid);
  equal("Nature-before-equipment rounding regression remains exact", C.calculateStats({ ...form, base: [100,100,100,100,100,100], effort: [0,252,0,0,0,0], nature: "固执", weapon: "sun", guardianLevel: "40" }).battle, [391,468,286,262,286,236]);
  const damageFixtures = require("./fixtures/v7-forum-calculator-cases.json");
  for (const fixture of damageFixtures.cases) assert.deepEqual(C.calculatePowerDamage(fixture.input).rolls.map((roll) => roll.damage), fixture.expected);
  check(`All ${damageFixtures.cases.length} official forum damage fixtures remain unchanged (21 rolls each)`, true);

  const storage = memoryStorage();
  const a = C.saveCalculationSnapshot({ form, pet: bishui, label: "初始" }, { storage, now: "2026-10-10T14:00:00Z", id: "snap-a" });
  check("Snapshot saves identity, nature, complete inputs, result and version", a.ok && a.record.pet.slug === "bishui" && a.record.form.nature === "坦率" && a.record.form.effort.length === 6 && a.record.dataVersion === C.CALCULATOR_DATA_VERSION);
  form.level = "90";
  check("Saved calculations are immutable after the live form changes", a.record.form.level === "100" && C.readCalculationSnapshots({ storage }).records[0].form.level === "100");
  const b = C.saveCalculationSnapshot({ form: { ...form, level: "100", nature: "保守", guardianLevel: "40" }, pet: bishui, label: "满守护保守" }, { storage, now: "2026-10-10T14:01:00Z", id: "snap-b" });
  const comparison = C.compareCalculationSnapshots(a.record, b.record);
  check("Same-pet comparison includes six deltas and nature/guardian changes", comparison.samePet && comparison.rows.length === 6 && comparison.parameters.some((row) => row.label === "性格" && row.changed) && comparison.parameters.some((row) => row.label === "守护兽等级" && row.changed));
  check("Comparison direction is B minus A and can be reversed", comparison.rows[0].delta === 50 && C.compareCalculationSnapshots(b.record, a.record).rows[0].delta === -50);
  const other = C.saveCalculationSnapshot({ form: C.statsDefaultsForPet(haifu), pet: haifu }, { storage, id: "snap-c" });
  check("Cross-pet comparisons explicitly include species differences", !C.compareCalculationSnapshots(a.record, other.record).samePet && C.compareCalculationSnapshots(a.record, other.record).parameters.find((row) => row.label === "种族").changed);
  check("Duplicate snapshot IDs are rejected without overwriting records", !C.saveCalculationSnapshot({ form, pet: bishui }, { storage, id: "snap-a" }).ok && C.readCalculationSnapshots({ storage }).records.length === 3);
  const beforeQuota = storage.getItem(C.CALCULATION_SNAPSHOT_KEY);
  const blocked = { getItem: storage.getItem, setItem() { throw new Error("quota"); } };
  const failed = C.saveCalculationSnapshot({ form, pet: bishui }, { storage: blocked, id: "quota" });
  check("Failed writes report failure and preserve previous local records", !failed.ok && failed.message.includes("未能保存") && storage.getItem(C.CALCULATION_SNAPSHOT_KEY) === beforeQuota);
  const corrupt = memoryStorage(); corrupt.setItem(C.CALCULATION_SNAPSHOT_KEY, "{broken");
  check("Malformed storage is not silently erased by a new save", !C.saveCalculationSnapshot({ form, pet: bishui }, { storage: corrupt }).ok && corrupt.getItem(C.CALCULATION_SNAPSHOT_KEY) === "{broken");
  check("Only the selected snapshot is deleted", C.deleteCalculationSnapshot("snap-b", { storage }).ok && C.readCalculationSnapshots({ storage }).records.map((row) => row.id).join(",") === "snap-c,snap-a");
  check("Invalid live inputs cannot become a saved record", !C.saveCalculationSnapshot({ form: { ...form, level: "" }, pet: bishui }, { storage }).ok);

  dom = new JSDOM('<div id="app" class="rw"></div>', { url: "https://wiki.test/pets/haifu/", pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  Object.assign(global, { window: w, document: d, HTMLElement: w.HTMLElement, Node: w.Node, localStorage: w.localStorage, MutationObserver: w.MutationObserver, CustomEvent: w.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = function() {};
  console.error = (...args) => runtimeErrors.push(args.map(String).join(" "));
  const { createRoot } = require(require.resolve("react-dom/client", { paths: [project] }));
  root = createRoot(d.querySelector("#app"));
  async function renderMini(pet) { await React.act(async () => root.render(React.createElement(C.PetStatsMini, { pet }))); }
  async function remount(Component, props, route) { await React.act(async () => root.unmount()); w.history.replaceState({}, "", route); root = createRoot(d.querySelector("#app")); await React.act(async () => root.render(React.createElement(Component, props))); }
  async function click(element) { assert.ok(element, "click target exists"); await React.act(async () => element.click()); }
  async function input(label, value) {
    const element = d.querySelector(`input[aria-label="${label}"]`); assert.ok(element, label);
    await React.act(async () => { Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(element, String(value)); element.dispatchEvent(new w.Event("input", { bubbles: true })); });
  }
  async function select(label, prefix) { await click(d.querySelector(`[role="combobox"][aria-label="${label}"]`)); await click([...d.querySelectorAll('[role="option"]')].find((el) => el.textContent.trim().startsWith(prefix))); }
  const button = (text) => [...d.querySelectorAll("button")].find((el) => el.textContent.trim() === text);
  const results = () => [...d.querySelectorAll(".rw-pet-mini-result > div > strong")].map((el) => Number(el.textContent));
  await renderMini(haifu);
  check("Compact calculator directly exposes nature, guardian level input and six results", d.querySelector('input[aria-label="简易能力 · 守护兽等级"]')?.type === "number" && !d.querySelector('[role="combobox"][aria-label*="守护兽"]') && results().length === 6);
  check("All calculator dropdowns use the shared custom component", !d.querySelector("select") && d.querySelectorAll('[role="combobox"]').length >= 5);
  const initialHaifu = results(); await input("简易能力 · 守护兽等级", "40");
  equal("Live guardian level produces five +50 results and unchanged speed", results().map((value, index) => value - initialHaifu[index]), [50,50,50,50,50,0]);
  await input("计算记录名称", "海芙满守护"); await click(button("保存本次计算"));
  check("Saving a live compact calculation opens its named record with an A marker", d.querySelector('.rw-record-select-v73[aria-pressed="true"]')?.textContent.includes("A海芙满守护") && C.readCalculationSnapshots().records.length === 1);
  await select("简易能力 · 性格", "保守"); await input("计算记录名称", "海芙保守"); await click(button("保存本次计算"));
  check("Two saves immediately create a six-row comparison with visible nature differences", d.querySelectorAll('.rw-calculation-compare-v73 > .rw-calculation-table-scroll-v73 tbody tr').length === 6 && d.querySelector('.rw-calculation-compare-v73').textContent.includes("保守"));
  await input("简易能力 · 等级", "50");
  await click([...d.querySelectorAll('.rw-record-actions-v73 button')].find((el) => el.textContent.includes("载入参数")));
  check("Loading a saved record restores live parameters and preserves both snapshots", d.querySelector('input[aria-label="简易能力 · 等级"]').value === "100" && C.readCalculationSnapshots().records.length === 2);
  await renderMini(bishui);
  check("Changing species resets level, nature, guardian and live identity together", d.querySelector('input[aria-label="简易能力 · 守护兽等级"]').value === "0" && d.querySelector('[role="combobox"][aria-label="简易能力 · 性格"]').textContent.includes("坦率") && new URL(d.querySelector('.rw-pet-mini-heading a').href).searchParams.get("calc").includes('"pet":"bishui"'));
  check("Different species starts with a scoped empty history while retaining previous records", !d.querySelector('.rw-calculation-record-list-v73 article') && C.readCalculationSnapshots().records.length === 2);
  await click(button("全部记录"));
  check("All-records view exposes prior pets without restoring them into the wrong pet", d.querySelectorAll('.rw-calculation-record-list-v73 article').length === 2 && ![...d.querySelectorAll('.rw-record-actions-v73 button')].some((el) => el.textContent.includes("载入参数")) && d.querySelector('.rw-record-actions-v73 a').textContent.includes("完整工具"));
  await select("简易能力 · 武器", "其他装备"); await select("简易能力 · 武器加成能力", "魔攻"); await input("简易能力 · 武器面板加成", "23");
  check("Manual gear has an inline sourced-scope explanation and affects only its chosen stat", results()[3] === 261 && d.querySelector('.rw-equipment-manual-v73').textContent.includes("按游戏装备面板填写"));
  await input("简易能力 · 守护兽等级", "41");
  check("Invalid input displays the error and disables snapshot save", d.querySelector('.rw-pet-mini-errors').textContent.includes("0–40") && button("保存本次计算").disabled);
  await input("简易能力 · 守护兽等级", "0");
  const beforeFailedUiSave = C.readCalculationSnapshots().records.length;
  const originalSetItem = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function(key, value) { if (key === C.CALCULATION_SNAPSHOT_KEY) throw new Error("quota"); return originalSetItem.call(this, key, value); };
  await click(button("保存本次计算"));
  check("Actual save-button failure stays on the calculation and shows no false saved entry", d.querySelector('.rw-calculation-status-v73').textContent.includes("未能保存") && C.readCalculationSnapshots().records.length === beforeFailedUiSave && results()[3] === 261);
  w.Storage.prototype.setItem = originalSetItem;
  for (const width of [320, 540, 768, 1100, 1920, 420]) { w.innerWidth = width; await React.act(async () => w.dispatchEvent(new w.Event("resize"))); }
  check("Resize events and repeated route identity changes do not throw or erase live inputs", results()[3] === 261 && d.querySelector('input[aria-label="简易能力 · 武器面板加成"]').value === "23");
  const fullForm = JSON.parse(new URL(d.querySelector('.rw-pet-mini-heading a').href).searchParams.get("calc"));
  const fullRoute = C.fullStatsToolHref(fullForm);
  await remount(C.ToolsPages, { path: "/tools/stats/", query: new URLSearchParams(new URL(fullRoute, "https://wiki.test").search) }, fullRoute);
  equal("Full capability tool reads the compact form through the same calculation core", [...d.querySelectorAll('.rw-calc-six-results > div > strong')].map((el) => Number(el.textContent)), C.calculateStats(fullForm).battle);
  check("Full tool also uses guardian levels and the shared snapshots section", d.querySelector('input[aria-label="守护兽等级"]') && d.querySelector('.rw-calculation-records-v73') && !d.querySelector('[role="combobox"][aria-label*="守护兽"]'));
  await click(button("全部记录"));
  await click(d.querySelector('.rw-record-select-v73'));
  await select("选择宠物种族", "海芙约忒");
  check("Changing the full-tool species clears the old comparison selection and rescopes history", !d.querySelector('.rw-record-select-v73[aria-pressed="true"]') && button("当前宠物").getAttribute("aria-pressed") === "true");
  await remount(C.ToolsPages, { path: "/tools/stats/", query: new URLSearchParams() }, C.fullStatsToolHref(legacy));
  check("Old full-tool links visibly disclose stage migration and retain their numeric result", d.querySelector('input[aria-label="守护兽等级"]').value === "5" && d.querySelector('.rw-guardian-note-v73').textContent.includes("5–9") && d.querySelector('.rw-calc-six-results > div > strong').textContent === "452");
  await remount(C.ToolsPages, { path: "/tools/stats/", query: new URLSearchParams() }, C.fullStatsToolHref({ level: "50" }));
  check("Partial shared links retain the explicit no-guardian default instead of manufacturing a migration error", d.querySelector('input[aria-label="守护兽等级"]').value === "0" && d.querySelectorAll('.rw-calc-six-results > div').length === 6);
  const css = fs.readFileSync(path.join(project, "src/wiki/CalculatorsV73.css"), "utf8");
  check("Capability CSS sets bounded inputs, min-zero grids, breakpoints and internal comparison scrolling", css.includes("max-width: 100%") && css.includes("minmax(0, 1fr)") && css.includes("overflow-x: auto") && css.includes("@media (max-width: 600px)"));
  check("No React runtime warnings or uncaught exceptions occurred in mounted calculator flows", runtimeErrors.length === 0);
}

main().catch((error) => { checks.push({ name: "Suite completion", pass: false, error: error.stack }); process.exitCode = 1; }).finally(async () => {
  if (root) await React.act(async () => root.unmount());
  dom?.window.close(); console.error = originalError;
  const files = ["src/wiki/PetStatsMini.jsx", "src/wiki/ToolsPages.jsx", "src/wiki/rocoCalculations.js", "src/wiki/statsProfiles.js", "src/wiki/StatsInputsV73.jsx", "src/wiki/CalculatorSnapshots.jsx", "src/wiki/calculatorSnapshotStore.js", "src/wiki/CalculatorsV73.css", "content/calculator-mappings-v73.json", "validation/check-v73-calculators.cjs"];
  const sourceHashes = Object.fromEntries(files.map((file) => [file, createHash("sha256").update(fs.readFileSync(path.join(project, file))).digest("hex")]));
  const result = { version: "7.3", generatedAt: new Date().toISOString(), scope: "Official forum numerical regression, explicit level mappings, immutable local calculation records, mounted DOM interactions and responsive CSS contracts. Not browser visual/layout/gameplay verification.", totals: { checks: checks.length, passed: checks.filter((row) => row.pass).length, failed: checks.filter((row) => !row.pass).length }, sourceHashes, runtimeErrors, checks };
  fs.writeFileSync(path.join(__dirname, "v73-calculators-check-results.json"), JSON.stringify(result, null, 2) + "\n");
  fs.rmSync(temporary, { recursive: true, force: true });
  console.log(JSON.stringify({ ...result.totals, failures: checks.filter((row) => !row.pass), runtimeErrors }, null, 2));
});
