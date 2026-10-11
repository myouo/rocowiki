/** Official-forum numerical fixtures + calculator DOM interactions; not visual/game QA. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const Module = require("node:module");
const project = path.resolve(__dirname, "..");
const esbuild = require(require.resolve("esbuild", { paths: [project] }));
const React = require(require.resolve("react", { paths: [project] }));
const { JSDOM } = require("jsdom");
const { act } = React;
const fixtures = require("./fixtures/v7-forum-calculator-cases.json");
const checks = [],
  runtimeErrors = [];
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "roco-v7-calc-"));
const bundlePath = path.join(temporary, "tools.cjs");
const oldConsoleError = console.error;
let dom, root;
function check(name, valid) {
  const passed = !!valid;
  checks.push({ name, passed });
  assert.ok(passed, name);
}
function mathCheck(name, fn) {
  try {
    fn();
    checks.push({ name, passed: true });
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
  }
}
const mathBundle = esbuild.buildSync({
  entryPoints: [path.join(project, "src/wiki/rocoCalculations.js")],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
});
const mathModule = new Module(path.join(temporary, "math.cjs"), module);
mathModule.filename = path.join(temporary, "math.cjs");
mathModule._compile(mathBundle.outputFiles[0].text, mathModule.filename);
const {
  calculatePowerDamage,
  calculateStats,
  NATURES,
  POWER_STAGES,
  POWER_MATCHUPS,
} = mathModule.exports;
const baseline = fixtures.cases[0].input;
for (const fixture of fixtures.cases) {
  mathCheck(`Official forum outputs: ${fixture.name} (all 21 rolls)`, () => {
    const result = calculatePowerDamage(fixture.input);
    assert.equal(result.supported, true);
    assert.deepEqual(
      result.rolls.map((roll) => roll.damage),
      fixture.expected,
    );
    assert.equal(result.min, fixture.expected[0]);
    assert.equal(result.max, fixture.expected.at(-1));
  });
}
for (const [name, patch] of [
  ["negative defense", { defense: -1 }],
  ["blank power", { power: "" }],
  ["fractional stage", { attackStage: "1.5" }],
  ["out-of-range stage", { defenseStage: "7" }],
  ["reduction beyond 100%", { reduction: 101 }],
  ["negative boost", { boost: -1 }],
  ["unknown type relation", { matchup: "invented" }],
])
  mathCheck(`Validation rejects ${name}`, () =>
    assert.equal(calculatePowerDamage({ ...baseline, ...patch }).valid, false),
  );
mathCheck("Special damage does not receive an ordinary-power result", () =>
  assert.equal(
    calculatePowerDamage({ ...baseline, mode: "special" }).supported,
    false,
  ),
);
mathCheck(
  "Shield/limit/conversion conditions do not receive a misleading result",
  () =>
    assert.equal(
      calculatePowerDamage({ ...baseline, conditions: "modified" }).supported,
      false,
    ),
);
mathCheck("13 stage choices and five sourced type relations", () => {
  assert.equal(POWER_STAGES.length, 13);
  assert.equal(POWER_MATCHUPS.length, 5);
});
mathCheck("Capability formula remains available with 25 natures", () => {
  assert.equal(NATURES.length, 25);
  const r = calculateStats({
    level: 100,
    nature: "坦率",
    guardian: 0,
    relationship: "none",
    base: [152, 140, 123, 101, 130, 109],
    talent: [31, 31, 31, 31, 31, 31],
    effort: [0, 0, 0, 0, 0, 0],
    intimacy: [0, 0, 0, 0, 0, 0],
    accessory: "none",
    weapon: "none",
    armor: "none",
  });
  assert.deepEqual(r.battle, [445, 316, 282, 238, 296, 254]);
});

async function main() {
  console.error = (...args) => runtimeErrors.push(args.map(String).join(" "));
  await esbuild.build({
    entryPoints: [path.join(project, "src/wiki/ToolsPages.jsx")],
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
                ? 'import React from "react"; export default function Link({to,children,...rest}) { return <a href={to} {...rest}>{children}</a>; }'
                : args.path.endsWith("/useBaseUrl")
                  ? "export default function useBaseUrl(value) { return value; }"
                  : 'import React from "react"; const read=()=>({pathname:window.location.pathname,search:window.location.search,hash:window.location.hash});export function useLocation(){const [value,set]=React.useState(read);React.useEffect(()=>{const update=()=>set(read());window.addEventListener("test-route",update);return()=>window.removeEventListener("test-route",update)},[]);return value;}export function useHistory(){return{replace(url){window.history.replaceState({},"",url);window.dispatchEvent(new window.Event("test-route"))}};}',
            }),
          );
        },
      },
    ],
  });
  dom = new JSDOM('<div id="root" class="rw"></div>', {
    url: "https://wiki.test/tools/damage/",
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
  const Component = require(bundlePath).default;
  root = createRoot(d.querySelector("#root"));
  async function render(route) {
    await act(async () => root.unmount());
    w.history.replaceState({}, "", route);
    root = createRoot(d.querySelector("#root"));
    await act(async () =>
      root.render(
        React.createElement(Component, {
          path: w.location.pathname,
          query: new URLSearchParams(w.location.search),
        }),
      ),
    );
  }
  async function click(el) {
    assert.ok(el, "control exists");
    await act(async () => el.click());
  }
  async function input(label, value) {
    const el = d.querySelector(`input[aria-label="${label}"]`);
    assert.ok(el, label);
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        w.HTMLInputElement.prototype,
        "value",
      ).set.call(el, String(value));
      el.dispatchEvent(new w.Event("input", { bubbles: true }));
    });
  }
  async function select(label, prefix) {
    await click(d.querySelector(`[role="combobox"][aria-label="${label}"]`));
    await click(
      [...d.querySelectorAll('[role="option"]')].find((el) =>
        el.textContent.trim().startsWith(prefix),
      ),
    );
  }
  const maximum = () =>
    d
      .querySelector(".rw-power-maximum strong")
      ?.textContent.replaceAll(",", "");
  await render("/tools/damage/");
  check(
    "Correct official tool name and upper/lower outputs are prominent",
    d.querySelector("h1")?.textContent === "威力伤害计算器" &&
      maximum() === "102" &&
      d.querySelector(".rw-power-minimum strong")?.textContent === "82",
  );
  check(
    "All 21 rows are in a collapsible result table",
    d.querySelectorAll(".rw-power-roll-details .rw-calc-rolls > div").length ===
      21 && !d.querySelector(".rw-power-roll-details").open,
  );
  check(
    "Attacker, defender and modifiers have independent labelled sections",
    [
      "power-attacker-heading",
      "power-defender-heading",
      "power-modifiers-heading",
    ].every((id) => d.getElementById(id)),
  );
  check(
    "All dropdowns use custom comboboxes; no native select",
    !d.querySelector("select") &&
      d.querySelectorAll('[role="combobox"]').length >= 6,
  );
  check(
    "No custom random interval is exposed",
    ![...d.querySelectorAll("input")].some((el) =>
      /浮动|随机/.test(el.getAttribute("aria-label") || ""),
    ),
  );
  await input("增伤比例（%）", 50);
  check(
    "Percent boost immediately changes the upper result",
    maximum() === "154",
  );
  await input("减伤比例（%）", 20);
  check(
    "Boost and reduction are separate multiplicative terms",
    maximum() === "123",
  );
  await select("攻击强化等级", "+6");
  check(
    "Stage selection updates both effective ability and damage",
    maximum() === "486" &&
      d.querySelector(".rw-power-attacker .rw-power-effective-stat strong")
        .textContent === "1,200",
  );
  await select("属性关系", "双重克制");
  check("Sourced double effectiveness uses x3", maximum() === "1458");
  const savedRoute = w.location.pathname + w.location.search;
  await render(savedRoute);
  check("Shareable parameters survive remount", maximum() === "1458");
  await input("技能威力", "");
  check(
    "Incomplete numeric input clears result and shows correction message",
    !maximum() && !!d.querySelector(".rw-calc-errors"),
  );
  await click(
    [...d.querySelectorAll("button")].find((el) =>
      el.textContent.includes("重置参数"),
    ),
  );
  check("Reset restores the official default example", maximum() === "102");
  await select("结算类型", "固伤");
  check(
    "Special mode gives a skill-specific explanation instead of a number",
    !maximum() &&
      d
        .querySelector(".rw-calc-unsupported h3")
        ?.textContent.includes("技能专属公式"),
  );
  check(
    "Calculation rules have a dedicated contextual edit link",
    [...d.querySelectorAll('a[href^="/edit/"]')].some(
      (el) => new URL(el.href).searchParams.get("section") === "计算规则",
    ),
  );
  await render("/tools/stats/");
  check(
    "Ability calculator retains six-stat inputs and results",
    d.querySelectorAll(".rw-calc-stat-inputs fieldset").length === 6 &&
      d.querySelectorAll(".rw-calc-six-results > div").length === 6,
  );
  await render("/tools/compare/?pets=haifu,bishui");
  check(
    "Pet comparison still provides a shared six-axis chart",
    !!d.querySelector(".rw-compare-radar-panel svg"),
  );
  await render("/tools/");
  check(
    "Toolkit entry uses verified name and three distinct tools",
    d.querySelectorAll(".rw-tools-index > a").length === 3 &&
      d.querySelector(".rw-tools-index").textContent.includes("威力伤害计算器"),
  );
  check(
    "Calculator renders without React runtime errors",
    runtimeErrors.length === 0,
  );
}
main()
  .catch((error) => {
    checks.push({
      name: "DOM run completed",
      passed: false,
      error: error.stack,
    });
  })
  .finally(async () => {
    if (root) await act(async () => root.unmount());
    if (dom) dom.window.close();
    console.error = oldConsoleError;
    fs.rmSync(temporary, { recursive: true, force: true });
    const tracked = [
      "src/wiki/ToolsPages.jsx",
      "src/wiki/rocoCalculations.js",
      "src/wiki/ToolsV7.css",
      "content/calculator-sources-v7.json",
      "validation/fixtures/v7-forum-calculator-cases.json",
    ];
    const report = {
      version: 7,
      scope:
        "official-forum numerical outputs and local DOM interaction; no visual/game-client verification",
      generatedAt: new Date().toISOString(),
      sourceHashes: Object.fromEntries(
        tracked.map((file) => [
          file,
          createHash("sha256")
            .update(fs.readFileSync(path.join(project, file)))
            .digest("hex"),
        ]),
      ),
      checks,
      runtimeErrors,
      passed: checks.every((c) => c.passed) && runtimeErrors.length === 0,
    };
    fs.writeFileSync(
      path.join(__dirname, "v7-calculator-check-results.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      `${checks.filter((c) => c.passed).length}/${checks.length} V7 calculator checks passed.`,
    );
    for (const c of checks.filter((c) => !c.passed))
      console.log(c.name, c.error || "");
    if (runtimeErrors.length) console.log(runtimeErrors);
    process.exitCode = report.passed ? 0 : 1;
  });
