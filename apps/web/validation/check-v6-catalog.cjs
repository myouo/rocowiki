/**
 * V6 catalog source interaction checks (35 bounded assertions).
 * Run from any working directory: node validation/check-v6-catalog.cjs
 * Requires project dependencies and validation/package.json dependencies.
 * The transient esbuild bundle is created in the OS temporary directory and
 * removed on success or failure. No browser rendering or network requests run.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const project = path.resolve(__dirname, "..");
const outputPath = path.join(__dirname, "v6-catalog-check-results.json");
const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "roco-wiki-v6-catalog-"),
);
const bundlePath = path.join(temporaryDirectory, "catalog-test-bundle.cjs");
const esbuild = require(require.resolve("esbuild", { paths: [project] }));
const React = require(require.resolve("react", { paths: [project] }));
const { JSDOM } = require("jsdom");
const { act } = React;
const checks = [];
const errors = [];
let dom = null;
let root = null;
const oldError = console.error;
console.error = (...args) => errors.push(args.map(String).join(" "));
function check(label, value) {
  const pass = Boolean(value);
  checks.push({ label, pass });
  assert.ok(pass, label);
}

async function main() {
  await esbuild.build({
    entryPoints: [project + "/src/wiki/CatalogPages.jsx"],
    outfile: bundlePath,
    bundle: true,
    format: "cjs",
    platform: "node",
    loader: { ".css": "empty" },
    logLevel: "silent",
    plugins: [
      {
        name: "test-environment",
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
              contents: args.path.endsWith("/Link")
                ? 'import React from "react"; export default function Link({to,children,...rest}) { return <a href={to} {...rest}>{children}</a>; }'
                : args.path.endsWith("/useBaseUrl")
                  ? "export default function useBaseUrl(value) { return value; }"
                  : 'import React from "react"; const read = () => ({pathname:window.location.pathname,search:window.location.search,hash:window.location.hash}); export function useLocation(){const [value,set]=React.useState(read); React.useEffect(()=>{const update=()=>set(read());window.addEventListener("test-route",update);return ()=>window.removeEventListener("test-route",update)},[]);return value;} export function useHistory(){return {replace(url){window.history.replaceState({},"",url);window.dispatchEvent(new window.Event("test-route"))}};}',
            }),
          );
        },
      },
    ],
  });
  dom = new JSDOM('<div id="root" class="rw"></div>', {
    url: "https://wiki.test/pets/",
    pretendToBeVisual: true,
  });
  const w = dom.window,
    d = w.document;
  Object.assign(global, {
    window: w,
    document: d,
    HTMLElement: w.HTMLElement,
    localStorage: w.localStorage,
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
  const C = require(bundlePath);
  const pets = JSON.parse(
    fs.readFileSync(project + "/content/pet-sources.json"),
  ).map((p) => ({ ...p, types: p.type, aliases: p.aliases || [] }));
  const meta = JSON.parse(
    fs.readFileSync(project + "/content/pet-metadata-v6.json"),
  );
  root = createRoot(d.querySelector("#root"));
  async function render(Component, props = {}, route = "/pets/") {
    await act(async () => root.unmount());
    w.history.replaceState({}, "", route);
    root = createRoot(d.querySelector("#root"));
    await act(async () => root.render(React.createElement(Component, props)));
  }
  async function click(el) {
    assert.ok(el, "control exists");
    await act(async () => el.click());
  }
  async function select(label, value) {
    await click(
      d.querySelector('[role="combobox"][aria-label="' + label + '"]'),
    );
    const option = [...d.querySelectorAll('[role="option"]')].find(
      (el) => el.textContent.trim() === value,
    );
    await click(option);
  }
  const cardNames = () =>
    [...d.querySelectorAll(".rw-petgrid .rw-petcard h3")].map(
      (x) => x.textContent,
    );
  const reset = () =>
    click(
      [...d.querySelectorAll("button")].find(
        (x) => x.textContent.trim() === "清除筛选",
      ),
    );
  await render(C.PetsPage);
  check(
    "12 catalog samples render and no native select remains",
    cardNames().length === 12 && !d.querySelector("select"),
  );
  check(
    "Attribute, five metadata facets, and sorting have named custom comboboxes",
    d.querySelectorAll('[role="combobox"]').length === 7,
  );
  check(
    "Cards do not show stat totals",
    ![...d.querySelectorAll(".rw-petcard")].some((x) =>
      x.textContent.includes("种族总和"),
    ),
  );
  check(
    "All attribute assets have local image paths and alt labels",
    [...d.querySelectorAll(".rw-attribute-v6 img")].every(
      (x) =>
        x.getAttribute("src").startsWith("/img/types/") &&
        x.alt.endsWith("属性"),
    ),
  );
  await select("组别筛选", "精灵组");
  check(
    "Verified group filter selects only the three known starters",
    cardNames().length === 3 && cardNames().includes("水蓝蓝"),
  );
  await click(
    [...d.querySelectorAll(".rw-filterchips button")].find(
      (x) => x.textContent === "火",
    ),
  );
  check(
    "Independent attribute filter intersects group without clearing it",
    cardNames().join() === "火花" && w.location.search.includes("group="),
  );
  await reset();
  await select("经验类型筛选", "164");
  check(
    "Experience type filter uses real recorded codes",
    cardNames().length === 5,
  );
  await select("系列筛选", "年费");
  check(
    "Series intersects experience type and retains 3 recorded annual pets",
    cardNames().length === 3 && cardNames().includes("哈普洛斯"),
  );
  await select("血脉筛选", "凌虚含烟");
  check(
    "Specific bloodline name selects the known holder",
    cardNames().join() === "海芙约忒",
  );
  await reset();
  await select("天梯魔力值筛选", "4 点");
  check(
    "Magic filter selects the dated 4-point record",
    cardNames().join() === "塞勒姆",
  );
  await reset();
  await select("天梯魔力值筛选", "魔力值待核");
  check(
    "Unknown magic remains unknown instead of zero",
    cardNames().length === 10 && !cardNames().includes("海芙约忒"),
  );
  await reset();
  await select("宠物排序字段", "天梯魔力值");
  check(
    "Magic ascending puts 4 then 5 before unknowns",
    cardNames()[0] === "塞勒姆" && cardNames()[1] === "海芙约忒",
  );
  await click(d.querySelector(".rw-sort-direction-v6"));
  check(
    "Magic descending reverses known values while unknowns remain last",
    cardNames()[0] === "海芙约忒" && cardNames()[1] === "塞勒姆",
  );
  await select("宠物排序字段", "速度");
  check(
    "Six-stat sorting uses stable speed position",
    cardNames()[0] === "塞勒姆",
  );
  const haifu = pets.find((p) => p.slug === "haifu"),
    bishui = pets.find((p) => p.slug === "bishui");
  check(
    "All six fields map to exact axis values",
    [162, 105, 142, 146, 142, 132].every(
      (v, i) =>
        C.getPetSortValue(
          haifu,
          ["hp", "atk", "def", "spAtk", "spDef", "speed"][i],
        ) === v,
    ),
  );
  check(
    "Exact totals and dimensions are not inferred from absent data",
    C.getPetSortValue(haifu, "total") === 829 &&
      C.getPetSortValue(bishui, "weightKg") === 34.9 &&
      C.getPetSortValue({ slug: "absent" }, "magic") === null,
  );
  await render(C.PetCard, { pet: haifu });
  await click(d.querySelector(".rw-magic-cost-v6"));
  check(
    "Magic badge is numeric and exposes date and meaning on click",
    d.querySelector(".rw-magic-cost-v6").textContent === "5" &&
      d.querySelector('[role="tooltip"]').textContent.includes("2024-07-05"),
  );
  check(
    "Magic badge stays focused after pointer activation",
    d.activeElement === d.querySelector(".rw-magic-cost-v6"),
  );
  await act(async () =>
    d
      .querySelector(".rw-magic-cost-v6")
      .dispatchEvent(
        new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
  );
  check(
    "Magic tooltip can close with Escape",
    !d.querySelector('[role="tooltip"]'),
  );
  await render(C.PetPage, { slug: "haifu" }, "/pets/haifu/");
  const skillsLinks = [...d.querySelectorAll("#skills .rw-entity-link")];
  check(
    "Pet skill links use canonical skill route with explicit pet context",
    skillsLinks.length === 5 &&
      skillsLinks.every((x) =>
        /^\/skills\/[^/]+\/\?pet=haifu$/.test(x.getAttribute("href")),
      ),
  );
  check(
    "Haifu acquisition timeline uses two real activity periods",
    d.querySelectorAll(".rw-acquisition-timeline-v6 > li").length === 2 &&
      d.querySelector('time[datetime="2023-02-10"]') &&
      d.querySelector('time[datetime="2024-08-01"]'),
  );
  check(
    "PVE/PVP sections separately expose records and their evidence",
    d.querySelectorAll(".rw-matchup-mode-v6").length === 2 &&
      d
        .querySelector(".rw-matchup-card-v6 details")
        .textContent.includes("尚未复现"),
  );
  await render(C.PetPage, { slug: "bishui" }, "/pets/bishui/");
  check(
    "Bishui counter record states exact boss and conditional failure",
    d.querySelector(".rw-matchup-card-v6").textContent.includes("傲凌冰龙王") &&
      d.querySelector(".rw-matchup-card-v6").textContent.includes("净化之后"),
  );
  await render(C.SkillPage, { slug: "xiazi" }, "/skills/xiazi/?pet=haifu");
  check(
    "Canonical skill page retains a verified return-to-pet context",
    d.querySelector(".rw-skill-pet-context-v6 a").getAttribute("href") ===
      "/pets/haifu/#skills",
  );
  check(
    "Skill conditions replace the misleading common-effect heading",
    d.querySelector(".rw-rule-label").textContent === "基础效果" &&
      d.querySelectorAll(".rw-skill-branch-v6").length === 2 &&
      !d.body.textContent.includes("共通效果"),
  );
  check(
    "Skill-specific mechanism references remain available",
    d.querySelectorAll('.rw-relation-list a[href^="/mechanics/"]').length === 3,
  );
  await click(
    [...d.querySelectorAll("button")].find((x) =>
      x.textContent.includes("收起条件"),
    ),
  );
  check(
    "Condition fold control has correct ARIA and hides only conditional content",
    !d.querySelector(".rw-skill-branches-v6") &&
      d
        .querySelector('[aria-controls="rw-skill-branches-v6"]')
        .getAttribute("aria-expanded") === "false" &&
      d.querySelector(".rw-common-rule"),
  );
  await render(C.SkillPage, { slug: "xiazi" }, "/skills/xiazi/?pet=bishui");
  check(
    "Unverified pet query never creates a false learning relationship",
    !d.querySelector(".rw-skill-pet-context-v6"),
  );
  await render(C.SkillPage, { slug: "linghuo" }, "/skills/linghuo/");
  check(
    "Non-complementary conditional alternative explicitly names its own condition",
    d
      .querySelector(".rw-branch-alternative-v6")
      .textContent.includes("对手后手使用变化技能"),
  );
  await render(
    C.SkillPage,
    { slug: "shuilingdong" },
    "/skills/shuilingdong/?pet=bishui",
  );
  check(
    "Formerly undifferentiated skill summary now has weather branch",
    d.querySelector(".rw-branch-condition-v6").textContent.includes("阴雨天气"),
  );
  await render(C.SkillsPage, {}, "/skills/");
  check(
    "Skills category bar has skill and bloodline entries only",
    [...d.querySelectorAll(".rw-subnav a")].length === 2 &&
      !d.querySelector('.rw-subnav a[href="/mechanics/overview/"]') &&
      !d.querySelector('.rw-pagehead a[href^="/mechanics/"]'),
  );
  await render(C.BloodlinePage, {}, "/bloodlines/");
  check(
    "Bloodline category bar uses the same two entries without nesting battle mechanics",
    [...d.querySelectorAll(".rw-subnav a")].length === 2 &&
      !d.querySelector('.rw-subnav a[href^="/mechanics/"]'),
  );
  check(
    "Bloodline index uses the verified names instead of a missing-name placeholder",
    d.querySelector(".rw-bloodline-index p").textContent.includes("凌虚含烟") &&
      d.querySelector(".rw-bloodline-index p").textContent.includes("碧水惊秋"),
  );
  await render(C.BloodlinePage, { detail: true }, "/bloodlines/haifu/");
  check(
    "Bloodline detail retains a source for the names and marks rules separately",
    d
      .querySelector(
        'a[href="' + meta.pets.haifu.fieldSources.bloodlines + '"]',
      )
      .textContent.includes("名称来源") &&
      d.body.textContent.includes("触发时点"),
  );
  check(
    "21 downloaded type icons match manifest byte counts and hashes",
    Object.values(meta.typeIcons).length === 21 &&
      Object.values(meta.typeIcons).every((a) => {
        const data = fs.readFileSync(path.join(project, a.localFile));
        return (
          data.length === a.bytes &&
          createHash("sha256").update(data).digest("hex") === a.sha256
        );
      }),
  );
  await act(async () => root.unmount());
  root = null;
  check(
    "No React DOM console errors during bounded workflows",
    errors.length === 0,
  );
}

async function run() {
  let failure = null;
  try {
    await main();
  } catch (error) {
    failure = error;
  } finally {
    if (root) {
      try {
        await act(async () => root.unmount());
      } catch (error) {
        failure = failure || error;
      }
    }
    dom?.window.close();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    console.error = oldError;
  }
  const sourcePaths = [
    "src/wiki/CatalogPages.jsx",
    "src/wiki/CatalogV6.css",
    "content/pet-metadata-v6.json",
    "src/wiki/Select.jsx",
  ];
  const sourceSha256 = Object.fromEntries(
    sourcePaths.map((file) => [
      file,
      createHash("sha256")
        .update(fs.readFileSync(path.join(project, file)))
        .digest("hex"),
    ]),
  );
  const report = {
    status:
      !failure && checks.length === 36 && checks.every((check) => check.pass)
        ? "PASS"
        : "FAIL",
    checkCount: checks.length,
    checks,
    scope:
      "Independent JSDOM functional harness using bundled source. Docusaurus routing is stubbed; CSS and image loading are not executed. Not preview HTML, browser screenshots, layout, performance, or real-server navigation validation.",
    sourceSha256,
    ranAt: new Date().toISOString(),
  };
  if (failure) report.error = { name: failure.name, message: failure.message };
  if (errors.length) report.runtimeErrors = errors;
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        status: report.status,
        checkCount: report.checkCount,
        failed: checks.filter((check) => !check.pass),
        error: report.error,
        results: path.relative(project, outputPath),
      },
      null,
      2,
    ),
  );
  process.exitCode = report.status === "PASS" ? 0 : 1;
}
run().catch((error) => {
  console.error = oldError;
  console.error(error);
  process.exitCode = 1;
});
