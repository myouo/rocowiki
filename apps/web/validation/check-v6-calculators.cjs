/** Pure math + DOM contract checks. This is NOT browser visual/gameplay QA. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const Module = require("node:module");
const { buildSync } = require("esbuild");
const { JSDOM, VirtualConsole } = require("jsdom");
const root = path.resolve(__dirname, "..");
const artifact =
  process.env.ROCO_V6_HTML || path.join(root, "RocoWiki_UI_V6.html");
const output = path.join(__dirname, "v6-calculator-check-results.json");
const checks = [],
  runtimeErrors = [];
const bundled = buildSync({
  entryPoints: [path.join(root, "src/wiki/rocoCalculations.js")],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
});
const mod = new Module(path.join(root, "validation/.v6-math.cjs"), module);
mod.filename = path.join(root, "validation/.v6-math.cjs");
mod.paths = module.paths;
mod._compile(bundled.outputFiles[0].text, mod.filename);
const { calculateStats, calculateDamage, NATURES, DAMAGE_ROLLS } = mod.exports;
function test(name, fn) {
  try {
    fn();
    checks.push({ name, passed: true });
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
  }
}
function stats(overrides = {}) {
  return {
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
    ...overrides,
  };
}
function damage(overrides = {}) {
  return {
    level: 100,
    power: 100,
    attack: 300,
    defense: 300,
    hp: 500,
    category: "physical",
    mode: "ordinary",
    conditions: "plain",
    matchup: "neutral",
    ...overrides,
  };
}

test("Stats: known baseline from sourced species + formula", () =>
  assert.deepEqual(
    calculateStats(stats()).battle,
    [445, 316, 282, 238, 296, 254],
  ));
test("Stats: floor effort / 4 before level scaling (252 = 255)", () =>
  assert.deepEqual(
    calculateStats(stats({ level: 50, effort: [252, 0, 0, 0, 0, 0] })).battle,
    calculateStats(stats({ level: 50, effort: [255, 0, 0, 0, 0, 0] })).battle,
  ));
test("Stats: nature precedes equipment and guardian, HP unaffected by nature", () => {
  const result = calculateStats(
    stats({
      base: [100, 100, 100, 100, 100, 100],
      effort: [0, 252, 0, 0, 0, 0],
      nature: "固执",
      weapon: "sun",
      guardian: 50,
    }),
  );
  assert.deepEqual(result.battle, [391, 468, 286, 262, 286, 236]);
  assert.equal(result.rows[1].cultivated, 328);
});
test("Stats: 25 natures, exactly five balanced", () => {
  assert.equal(NATURES.length, 25);
  assert.equal(NATURES.filter((n) => n.boost === null).length, 5);
});
test("Stats: relation bonus belongs inside level-scaled intimacy", () => {
  const result = calculateStats(
    stats({
      level: 50,
      base: [100, 100, 100, 100, 100, 100],
      relationship: "kindred",
      intimacy: [20, 0, 10, 0, 20, 0],
    }),
  );
  assert.equal(result.rows[0].intimacyPart, 30);
  assert.equal(result.rows[0].battle, 190);
  assert.equal(result.rows[3].battle, 125);
});
test("Stats: guardian is excluded from panel and speed", () => {
  const r = calculateStats(stats({ guardian: 50 }));
  assert.equal(r.panel[0], 445);
  assert.equal(r.battle[0], 495);
  assert.equal(r.panel[5], r.battle[5]);
});
test("Stats: armor, weapon and accessory add to corresponding dimensions", () =>
  assert.deepEqual(
    calculateStats(
      stats({ accessory: "eternal", weapon: "moon", armor: "wind" }),
    ).battle,
    [565, 316, 282, 328, 386, 254],
  ));
test("Stats: reject 100-level equipment on lower-level pet", () =>
  assert.equal(
    calculateStats(stats({ level: 99, weapon: "sun" })).valid,
    false,
  ));
test("Stats: reject effort sum > 510 without silently clipping", () => {
  const r = calculateStats(stats({ effort: [255, 255, 1, 0, 0, 0] }));
  assert.equal(r.valid, false);
  assert.equal(r.effortTotal, 511);
});
test("Stats: reject per-stat effort > 255", () =>
  assert.equal(
    calculateStats(stats({ effort: [256, 0, 0, 0, 0, 0] })).valid,
    false,
  ));
test("Stats: reject speed intimacy, partial relationship budget and non-10 allocations", () => {
  assert.equal(
    calculateStats(
      stats({ relationship: "friendly", intimacy: [20, 0, 10, 0, 10, 10] }),
    ).valid,
    false,
  );
  assert.equal(
    calculateStats(
      stats({ relationship: "friendly", intimacy: [20, 0, 10, 0, 10, 0] }),
    ).valid,
    false,
  );
  assert.equal(
    calculateStats(
      stats({ relationship: "friendly", intimacy: [20, 1, 9, 0, 20, 0] }),
    ).valid,
    false,
  );
});
test("Stats: empty, decimal and out-of-bounds fields are invalid", () => {
  for (const level of ["", "50.5", "-1", "101", "Infinity"])
    assert.equal(calculateStats(stats({ level })).valid, false);
});
test("Damage: exact default rational calculation and fixed 21 rolls", () => {
  const r = calculateDamage(damage());
  assert.equal(r.base, 86);
  assert.equal(r.min, 68);
  assert.equal(r.max, 86);
  assert.equal(r.rolls.length, 21);
  assert.deepEqual(
    r.rolls.map((x) => x.damage),
    [
      68, 69, 70, 71, 72, 73, 73, 74, 75, 76, 77, 78, 79, 79, 80, 81, 82, 83,
      84, 85, 86,
    ],
  );
});
test("Damage: 80 through 100 enumerated without custom float inputs", () =>
  assert.deepEqual(
    DAMAGE_ROLLS,
    Array.from({ length: 21 }, (_, i) => 80 + i),
  ));
test("Damage: category selects corresponding entered ability, not a new formula", () =>
  assert.deepEqual(
    calculateDamage(damage()).rolls,
    calculateDamage(damage({ category: "magic" })).rolls,
  ));
test("Damage: single resistance and effectiveness remain finite", () => {
  const resisted = calculateDamage(damage({ matchup: "resisted" })),
    effective = calculateDamage(damage({ matchup: "effective" }));
  assert.deepEqual([resisted.min, resisted.max], [34, 43]);
  assert.deepEqual([effective.min, effective.max], [137, 172]);
});
test("Damage: unknown special skill / modifiers / complex types return no range", () => {
  for (const change of [
    { mode: "special" },
    { conditions: "modified" },
    { matchup: "other" },
  ]) {
    const r = calculateDamage(damage(change));
    assert.equal(r.supported, false);
    assert.equal(r.rolls, undefined);
    assert.ok(r.reason);
  }
});
test("Damage: zero defense, fractional power and empty HP are rejected", () => {
  for (const change of [{ defense: 0 }, { power: 10.5 }, { hp: "" }])
    assert.equal(calculateDamage(damage(change)).valid, false);
});
test("Damage: unresolved minimum-damage edge is explicitly unsupported", () =>
  assert.equal(
    calculateDamage(
      damage({
        level: 1,
        power: 1,
        attack: 1,
        defense: 9999,
        matchup: "resisted",
      }),
    ).supported,
    false,
  ));
test("Damage: no probability claim in result object", () => {
  const r = calculateDamage(damage());
  assert.equal(r.referenceOnly, true);
  assert.equal(r.knockoutProbability, undefined);
});

const html = fs.readFileSync(artifact, "utf8");
const vc = new VirtualConsole();
vc.on("jsdomError", (error) => runtimeErrors.push(error.message));
vc.on("error", (...args) => runtimeErrors.push(args.map(String).join(" ")));
const dom = new JSDOM(html, {
  url: "https://roco-wiki.test/#/tools/stats/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(w) {
    w.scrollTo = () => {};
    w.HTMLElement.prototype.scrollIntoView = () => {};
    w.matchMedia = () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    });
    w.HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    w.HTMLDialogElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new w.Event("close"));
    };
  },
});
const w = dom.window,
  d = w.document;
const pause = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));
const text = () => d.querySelector("main")?.textContent || "";
const query = () => new URLSearchParams(w.location.hash.split("?")[1] || "");
async function go(route) {
  w.location.hash = route;
  await pause(140);
}
async function number(label, value) {
  const el = [...d.querySelectorAll("input")].find(
    (el) => el.getAttribute("aria-label") === label,
  );
  assert.ok(el, label);
  Object.getOwnPropertyDescriptor(
    w.HTMLInputElement.prototype,
    "value",
  ).set.call(el, value);
  el.dispatchEvent(new w.Event("input", { bubbles: true }));
  await pause();
}
async function select(label, optionText) {
  const trigger = [...d.querySelectorAll('[role="combobox"]')].find(
    (el) => el.getAttribute("aria-label") === label,
  );
  assert.ok(trigger, "custom selector: " + label);
  trigger.click();
  await pause();
  const option = [...d.querySelectorAll('[role="option"]')].find(
    (el) => el.textContent.trim() === optionText,
  );
  assert.ok(option, "option: " + optionText);
  option.click();
  await pause();
}
async function domtest(name, fn) {
  try {
    await fn();
    checks.push({ name, passed: true });
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
  }
}
(async () => {
  await pause(550);
  await domtest(
    "DOM: stats route renders six results and custom selectors",
    async () => {
      assert.match(text(), /能力计算器/);
      assert.equal(d.querySelectorAll(".rw-calc-six-results > div").length, 6);
      assert.equal(d.querySelectorAll("main select").length, 0);
    },
  );
  await domtest(
    "DOM: ability input updates result and shareable query",
    async () => {
      await number("物攻努力值", "252");
      assert.equal(
        d.querySelectorAll(".rw-calc-six-results strong")[1].textContent,
        "379",
      );
      assert.equal(JSON.parse(query().get("calc")).effort[1], "252");
    },
  );
  await domtest(
    "DOM: shareable ability URL restores exact form after navigation",
    async () => {
      const saved = w.location.hash;
      await go("/tools/");
      await go(saved.slice(1));
      assert.equal(
        d.querySelector('input[aria-label="物攻努力值"]').value,
        "252",
      );
    },
  );
  await domtest(
    "DOM: changing relationship allocates legal default then allows invalid budget correction",
    async () => {
      await select("亲密关系", "灵犀 · 精力、魔攻各 +10");
      assert.match(text(), /手动分配 50 \/ 50/);
      await select("精力亲密分配", "0");
      assert.ok(d.querySelector(".rw-calc-errors"));
      assert.equal(d.querySelector(".rw-calc-six-results"), null);
      await select("精力亲密分配", "20");
      assert.equal(d.querySelectorAll(".rw-calc-six-results > div").length, 6);
    },
  );
  await domtest(
    "DOM: invalid total effort suppresses numeric outputs",
    async () => {
      await number("精力努力值", "255");
      await number("速度努力值", "4");
      assert.ok(d.querySelector(".rw-calc-errors"));
      assert.equal(d.querySelector(".rw-calc-six-results"), null);
    },
  );
  await domtest(
    "DOM: malformed calc JSON and nested values fall back safely",
    async () => {
      await go("/tools/stats/?calc=%7Bbad");
      assert.match(text(), /已恢复可读取的参数/);
      assert.equal(d.querySelectorAll(".rw-calc-six-results > div").length, 6);
      await go(
        "/tools/stats/?calc=" +
          encodeURIComponent(
            JSON.stringify({ base: { bad: true }, nature: { bad: true } }),
          ),
      );
      assert.match(text(), /已恢复可读取的参数/);
    },
  );
  await domtest(
    "DOM: ability → damage carries correct category, level and ability",
    async () => {
      await go("/tools/stats/?pet=bishui");
      const link = [...d.querySelectorAll("a")].find((el) =>
        el.textContent.includes("用魔攻计算伤害"),
      );
      assert.ok(link);
      link.click();
      await pause(140);
      assert.equal(query().get("category"), "magic");
      assert.equal(
        d.querySelector('input[aria-label="实际魔攻"]').value,
        "238",
      );
    },
  );
  await domtest("DOM: damage default renders 21 reference rolls", async () => {
    await go("/tools/damage/");
    assert.equal(
      d.querySelector(".rw-damage-number strong").textContent,
      "68–86",
    );
    assert.equal(d.querySelectorAll(".rw-calc-rolls > div").length, 21);
    assert.equal(d.querySelectorAll("main select").length, 0);
  });
  await domtest(
    "DOM: damage change is deterministic and preserved in URL",
    async () => {
      await number("技能威力", "200");
      assert.equal(
        d.querySelector(".rw-damage-number strong").textContent,
        "136–170",
      );
      assert.equal(JSON.parse(query().get("calc")).power, "200");
    },
  );
  await domtest(
    "DOM: unsupported skill replaces result, has mechanics link",
    async () => {
      await select("伤害类型", "固伤 / 条件威力 / 特殊技能");
      assert.match(text(), /这组条件尚不支持/);
      assert.equal(d.querySelector(".rw-damage-number"), null);
      assert.equal(d.querySelector(".rw-calc-rolls"), null);
      assert.ok(d.querySelector(".rw-calc-unsupported a"));
    },
  );
  await domtest(
    "DOM: legacy PP and range routes offer moved links without forms",
    async () => {
      for (const route of ["/tools/pp/", "/tools/range/"]) {
        await go(route);
        assert.match(text(), /工具已更新/);
        assert.equal(
          d.querySelectorAll('main input, main select, main [role="combobox"]')
            .length,
          0,
        );
        assert.ok(
          [...d.querySelectorAll("main a")].some((el) =>
            el.getAttribute("href").includes("/tools/damage/"),
          ),
        );
      }
    },
  );
  await domtest(
    "DOM: comparison keeps radar and uses shared selects",
    async () => {
      await go("/tools/compare/?pets=haifu,bishui");
      assert.match(text(), /六维种族值/);
      assert.ok(d.querySelector(".rw-compare-radar-panel svg"));
      assert.equal(
        d.querySelectorAll('.rw-comparison-selectors [role="combobox"]').length,
        3,
      );
      assert.equal(d.querySelectorAll("main select").length, 0);
    },
  );
  await domtest(
    "DOM: mechanics first recommendation is stable and changes only on explicit action",
    async () => {
      await go("/mechanics/");
      const card = d.querySelector(".rw-mechanics-feature-example");
      const initial = card.querySelector("a").getAttribute("href");
      assert.ok(initial.includes("/mechanics/effects/pressure/"));
      for (let i = 0; i < 4; i++) {
        const before = card.querySelector("a").getAttribute("href");
        [...card.querySelectorAll("button")]
          .find((el) => el.textContent.includes("换一篇"))
          .click();
        await pause();
        const after = card.querySelector("a").getAttribute("href");
        assert.notEqual(after, before);
        assert.match(after, /\/mechanics\//);
        assert.ok(!/relations|evidence/.test(after));
      }
      await go("/tools/");
      await go("/mechanics/");
      assert.equal(
        d.querySelector(".rw-mechanics-feature-example a").getAttribute("href"),
        initial,
      );
    },
  );
  await domtest(
    "DOM: relations retains both selectors with shared component",
    async () => {
      await go("/mechanics/relations/");
      assert.equal(
        d.querySelectorAll('.rw-effect-chooser [role="combobox"]').length,
        2,
      );
      assert.equal(d.querySelectorAll("main select").length, 0);
    },
  );
  test("DOM: no React or jsdom runtime errors", () =>
    assert.deepEqual(runtimeErrors, []));
  const report = {
    checkedAt: new Date().toISOString(),
    artifact: path.basename(artifact),
    sha256: crypto.createHash("sha256").update(html).digest("hex"),
    scope:
      "Pure calculation regression and jsdom interaction contracts. No browser visual, geometry, real-device, live-game or gameplay verification.",
    passed: checks.filter((c) => c.passed).length,
    total: checks.length,
    runtimeErrors,
    checks,
  };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  dom.window.close();
  console.log(
    JSON.stringify({
      passed: report.passed,
      total: report.total,
      output,
      runtimeErrors,
    }),
  );
  if (report.passed !== report.total) {
    console.log(
      JSON.stringify(
        checks.filter((c) => !c.passed),
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
})().catch((error) => {
  dom.window.close();
  console.error(error);
  process.exitCode = 1;
});
