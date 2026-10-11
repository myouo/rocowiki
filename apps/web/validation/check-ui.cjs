const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require("jsdom");
const project = path.resolve(__dirname, "..");
const html = fs.readFileSync(project + "/RocoWiki_UI_V4.html", "utf8");
const routes = JSON.parse(
  fs.readFileSync(project + "/content/routes.json", "utf8"),
);
const docs = JSON.parse(
  fs.readFileSync(project + "/preview/generated-docs.json", "utf8"),
);
const allRoutes = [...routes, ...Object.keys(docs)];
const errors = [],
  checks = [],
  pageResults = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push(e.message));
vc.on("error", (...args) => errors.push(args.map(String).join(" ")));
function create(storage = {}) {
  return new JSDOM(html, {
    url: "https://roco-wiki.test/#/",
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
      };
      for (const [k, v] of Object.entries(storage))
        w.localStorage.setItem(k, v);
    },
  });
}
let dom = create();
let w = dom.window,
  d = w.document;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function go(route) {
  w.location.hash = route;
  await pause(60);
}
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
}
function text() {
  return d.querySelector("main")?.textContent || "";
}
function button(label) {
  const el = [...d.querySelectorAll("button")].find(
    (b) =>
      b.textContent.trim() === label || b.getAttribute("aria-label") === label,
  );
  assert.ok(el, "button exists: " + label);
  return el;
}
async function click(label) {
  button(label).click();
  await pause(60);
}
async function value(el, value) {
  assert.ok(el, "input exists");
  const proto =
    el.tagName === "SELECT"
      ? w.HTMLSelectElement.prototype
      : el.tagName === "TEXTAREA"
        ? w.HTMLTextAreaElement.prototype
        : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(
    new w.Event(el.tagName === "SELECT" ? "change" : "input", {
      bubbles: true,
    }),
  );
  await pause(60);
}
async function run() {
  await pause(100);
  const badLinks = [];
  for (const route of allRoutes) {
    await go(route);
    const h1s = [...d.querySelectorAll("main h1")];
    assert.equal(h1s.length, 1, route + ": one main H1");
    assert.ok(text().length > 120, route + ": substantive page renders");
    for (const a of d.querySelectorAll('a[href^="#/"]')) {
      const dest = a.getAttribute("href").slice(1).split("?")[0];
      if (!allRoutes.includes(dest)) badLinks.push({ route, dest });
    }
    pageResults.push({ route, h1: h1s[0].textContent });
  }
  check("All 74 routes render one titled page", pageResults.length === 74);
  check(
    "All rendered internal route links have a destination",
    badLinks.length === 0,
  );
  await go("/pets/");
  check(
    "Pet index renders 12 distinct sample cards",
    d.querySelectorAll(".rw-petcard").length === 12,
  );
  await click("水");
  check(
    "Water filter changes results",
    d.querySelectorAll(".rw-petcard").length === 2 &&
      text().includes("碧水灵兽") &&
      text().includes("水蓝蓝"),
  );
  check(
    "Filter state is encoded in route query",
    w.location.hash.includes("type="),
  );
  await go("/pets/?q=不存在的宠物");
  check("Empty search state is rendered", d.querySelector(".rw-empty"));
  await go("/pets/haifu/");
  check(
    "Haifu identity and stats are correct",
    d.querySelector("h1").textContent.includes("海芙约忒") &&
      text().includes("3092") &&
      text().includes("829"),
  );
  check(
    "Pet picture is embedded original PNG",
    d
      .querySelector(".rw-portrait.hero img")
      .src.startsWith("data:image/png;base64,"),
  );
  const haifuSkills = [...d.querySelectorAll(".rw-skill-table tbody tr")].map(
    (n) => n.textContent,
  );
  check("Haifu skill pool has 5 independent rows", haifuSkills.length === 5);
  await click("收藏");
  check(
    "Bookmark is stored with entity route",
    JSON.parse(w.localStorage.getItem("roco-wiki-v4:bookmarks"))[0].href ===
      "/pets/haifu/",
  );
  await go("/account/?tab=bookmarks");
  check(
    "Account reads shared bookmark protocol",
    d.querySelector(".cm-bookmark-list")?.textContent.includes("海芙约忒"),
  );
  await click("取消收藏海芙约忒");
  await go("/pets/haifu/");
  check(
    "Removing bookmark updates source button",
    button("收藏").getAttribute("aria-pressed") === "false",
  );
  w.localStorage.setItem("roco-wiki-v4:bookmarks", '{"invalid":true}');
  w.dispatchEvent(new w.Event("roco-wiki-bookmarks"));
  await click("收藏");
  check(
    "Bookmark recovers from malformed storage shape",
    Array.isArray(JSON.parse(w.localStorage.getItem("roco-wiki-v4:bookmarks"))),
  );
  await go("/pets/bishui/");
  check(
    "Second pet has independent identity and data",
    d.querySelector("h1").textContent.includes("碧水灵兽") &&
      text().includes("2552") &&
      text().includes("755"),
  );
  check(
    "Second pet has its own 4 skills",
    d.querySelectorAll(".rw-skill-table tbody tr").length === 4 &&
      !d.querySelector(".rw-skill-table").textContent.includes("霞姿月韵"),
  );
  await go("/pets/sailemu/");
  check(
    "WebP artwork preserves its correct MIME type",
    d
      .querySelector(".rw-portrait.hero img")
      .src.startsWith("data:image/webp;base64,"),
  );
  await go("/skills/linghuo/");
  check(
    "Conditional hit is distinct from base stats",
    text().includes("任意天气下必中") &&
      d.querySelectorAll(".rw-phase").length >= 2,
  );
  await go("/skills/?effect=" + encodeURIComponent("条件必中"));
  check(
    "Mechanic-based skill filter returns correct entries",
    d.querySelectorAll(".rw-skill-table tbody tr").length === 2,
  );
  await go("/search/?q=" + encodeURIComponent("海芙"));
  check(
    "Global search supports pet aliases",
    d.querySelector(".rw-search-results")?.textContent.includes("海芙约忒"),
  );
  await go("/tools/compare/?pets=haifu,bishui,dimo");
  check(
    "Comparison renders three entities and stat total row",
    d.querySelectorAll(".rw-compare-table thead th").length === 4 &&
      text().includes("种族总和"),
  );
  await go("/tools/pp/");
  check(
    "Default PP budget shows 8 rows",
    d.querySelectorAll(".rw-tool-results tbody tr").length === 8,
  );
  await value(d.querySelector('input[type="number"]'), "0");
  check(
    "PP zero case shows no possible use",
    d.querySelectorAll(".rw-tool-results tbody tr").length === 0 &&
      text().includes("起始 PP 不足"),
  );
  await go("/mechanics/priority/");
  check(
    "Preview TOC is scoped to article H2",
    d.querySelectorAll(".rw-preview-doc-toc a").length ===
      d.querySelectorAll(".theme-doc-markdown h2").length,
  );
  check(
    "Article parent is explicit route, not history back",
    d.querySelector(".rw-doc-native-back .rw-back").getAttribute("href") ===
      "#/mechanics/overview/",
  );
  await go("/bloodlines/unknown/");
  check(
    "Unknown bloodline does not show Haifu content",
    text().includes("没有找到这份资料") && !text().includes("怒气、战意与乘胜"),
  );
  await go("/edit/?entity=" + encodeURIComponent("王国城堡"));
  await click("提交本地审核");
  check(
    "Editor validates missing evidence and text",
    d.querySelectorAll('[aria-invalid="true"]').length >= 3,
  );
  await click("填入演示内容");
  await click("保存草稿");
  check(
    "Draft is persisted locally",
    JSON.parse(w.localStorage.getItem("roco-wiki-v4:community")).drafts.some(
      (x) => x.target === "王国城堡",
    ),
  );
  await go("/account/?tab=drafts");
  check(
    "Draft can be resumed from account",
    text().includes("王国城堡") && text().includes("继续编辑"),
  );
  await go("/edit/?entity=" + encodeURIComponent("王国城堡"));
  check(
    "Saved editor content is restored",
    text().includes("已恢复这份本地草稿") &&
      d.querySelector("textarea").value.includes("示例"),
  );
  await click("预览与差异");
  check(
    "Editor shows actual before/after diff",
    d.querySelectorAll(".cm-diff-add").length > 0,
  );
  await click("提交本地审核");
  check("Local submission succeeds", text().includes("修改进入待审核状态"));
  const state = JSON.parse(w.localStorage.getItem("roco-wiki-v4:community"));
  const sub = state.submissions.find((x) => x.target === "王国城堡");
  check(
    "Successful submission removes corresponding draft",
    !!sub && !state.drafts.some((x) => x.target === "王国城堡"),
  );
  check(
    "World submission links to its actual article",
    [...d.querySelectorAll("a")].some(
      (a) =>
        a.textContent.includes("查看词条") &&
        a.getAttribute("href") === "#/places/castle/",
    ),
  );
  await go("/review/?submission=" + sub.id);
  check(
    "Review displays submitted content and difference",
    text().includes("王国城堡") && d.querySelector(".cm-diff"),
  );
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        scope: "jsdom DOM integration, not a real browser visual audit",
        routes: pageResults.length,
        checks,
        consoleErrors: errors,
        pageResults,
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(__dirname, "ui-check-results.json"),
    JSON.stringify(
      {
        status: "PASS",
        scope:
          "jsdom DOM integration; no actual browser visual or layout assertions",
        routeCount: pageResults.length,
        checks,
        consoleErrors: errors,
        pages: pageResults,
      },
      null,
      2,
    ),
  );
  assert.equal(errors.length, 0, "No runtime console errors");
  dom.window.close();
}
run().catch((error) => {
  console.error(error.stack);
  console.error("Console errors", errors);
  dom.window.close();
  process.exitCode = 1;
});
