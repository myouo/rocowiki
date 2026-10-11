/** Activity recurrence and local contributor readback; no visual or game QA. */
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
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), "roco-v7-world-"));
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
        "import React from 'react'; import {useLocation} from '@docusaurus/router'; import World from './src/wiki/WorldPages.jsx'; import Pve from './src/wiki/PvePages.jsx'; export {getPublishedSnapshot,COMMUNITY_STORAGE_KEY} from './src/wiki/editing/registry'; export default function Harness(){ const loc=useLocation(), Component=loc.pathname.startsWith('/pve/')?Pve:World; return <Component path={loc.pathname} query={new URLSearchParams(loc.search)}/>; }",
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
        JSON.stringify({ submissions }),
      );
      w.dispatchEvent(new w.CustomEvent("roco:community-updated"));
    });
  }
  const editors = (scope = d) => [
    ...scope.querySelectorAll('a[href^="/edit/"]'),
  ];
  const params = (el) => new URL(el.href).searchParams;
  const byLabel = (label, scope = d) =>
    editors(scope).filter((el) => el.textContent === label);
  const fun = events.activities.find((a) => a.slug === "fun-chess");
  check(
    "Eleven activities retain twelve independent periods",
    events.activities.length === 11 &&
      events.activities.flatMap((a) => a.occurrences).length === 12,
  );
  check(
    "Canonical and dated activity routes are registered",
    events.activities.every(
      (a) =>
        routes.includes("/events/" + a.slug + "/") &&
        a.occurrences.every((o) =>
          routes.includes("/events/" + (o.legacySlug || o.id) + "/"),
        ),
    ),
  );
  check(
    "May 2025 recurrence has its own dates and reward set",
    fun.occurrences.some(
      (o) =>
        o.startDate === "2025-05-02" &&
        o.endDate === "2025-06-12" &&
        o.rewards.length === 1 &&
        o.sourceUrl ===
          "https://news.4399.com/luoke/xinwengonggao/202504-30-1003356.html",
    ),
  );
  await render("/events/");
  check(
    "Current edition renders ten master rows",
    d.querySelectorAll(".wv7-event-list > article").length === 10,
  );
  const weekly = require("../content/weekly-v5.json");
  const expectedEditionLabel =
    new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) >=
    weekly.edition.reviewDueDate
      ? "历史周报"
      : "本期周报";
  check(
    "Weekly display respects the edition review deadline",
    d.querySelector(".wv7-edition")?.textContent.includes(expectedEditionLabel),
  );
  await act(async () =>
    [...d.querySelectorAll(".wv7-event-tabs button")]
      .find((el) => el.textContent === "全部活动")
      .click(),
  );
  check(
    "Activity tabs update directory without a reload",
    d.querySelectorAll(".wv7-event-list > article").length === 11 &&
      w.location.search === "?view=all",
  );
  check(
    "Activity rows link to stable master addresses",
    [...d.querySelectorAll(".wv7-event-list article h2 a")].length === 11 &&
      [...d.querySelectorAll(".wv7-event-list article h2 a")].every((el) =>
        events.activities.some(
          (a) => el.getAttribute("href") === "/events/" + a.slug + "/",
        ),
      ),
  );
  await render("/events/fun-chess/");
  check(
    "Activity archive displays both periods together",
    d.querySelectorAll("[data-occurrence-id]").length === 2 &&
      d.querySelector("h1")?.textContent === "趣味对弈",
  );
  check(
    "Every occurrence has a record-aware editor",
    [...d.querySelectorAll("[data-occurrence-id]")].every((el) =>
      editors(el).some(
        (link) =>
          params(link).get("record") === el.dataset.occurrenceId &&
          params(link).get("mode") === "event",
      ),
    ),
  );
  check(
    "Add-period action targets same master",
    byLabel("新增一次开放").length > 0 &&
      byLabel("新增一次开放").every(
        (el) =>
          params(el).get("entity") === "趣味对弈" &&
          params(el).get("intent") === "add" &&
          params(el).get("returnTo") === "/events/fun-chess/",
      ),
  );
  await render("/events/fun-chess-20250502/");
  check(
    "Legacy May URL retains all history and locates May",
    d.querySelectorAll("[data-occurrence-id]").length === 2 &&
      d.querySelector(".wv7-occurrence.is-selected")?.dataset.occurrenceId ===
        "fun-chess-20250502" &&
      !!d.querySelector(".wv7-legacy-context"),
  );
  await render("/events/fun-chess-20251128/");
  check(
    "Legacy November URL locates original period",
    d.querySelector(".wv7-occurrence.is-selected")?.dataset.occurrenceId ===
      "fun-chess-20251128",
  );
  const eventRequest = {
    entity: fun.name,
    section: "活动与开放批次",
    mode: "event",
    returnTo: "/events/fun-chess/",
  };
  const eventSnapshot = api.getPublishedSnapshot(eventRequest);
  const editedEvent = {
    ...eventSnapshot.data,
    summary: "DOM 验证新一期。",
    occurrences: [
      ...eventSnapshot.data.occurrences,
      {
        id: "fun-chess-test-opening",
        label: "测试开放记录",
        startDate: "2026-10-10",
        endDate: null,
        location: "宠物园",
        conditions: "测试条件",
        rewards: "测试奖励",
        sourceUrl: "https://news.4399.com/luoke/",
        note: "仅用于 DOM fixture",
      },
    ],
  };
  await publish([
    {
      id: "event-review-test",
      status: "published",
      editorVersion: 7,
      editorMode: "event",
      editorRequest: eventRequest,
      snapshotKey: eventSnapshot.key,
      typedData: editedEvent,
      after: JSON.stringify(editedEvent),
      updatedAt: "2026-10-10T09:00:00Z",
    },
  ]);
  check(
    "Local next opening appears without replacing history",
    d.querySelectorAll("[data-occurrence-id]").length === 3 &&
      d.body.textContent.includes("本机已发布修订"),
  );
  check(
    "Unknown end date is not presented as permanent",
    d
      .querySelector('[data-occurrence-id="fun-chess-test-opening"]')
      .textContent.includes("结束日期待补") &&
      !d
        .querySelector('[data-occurrence-id="fun-chess-test-opening"]')
        .textContent.includes("长期开放"),
  );
  const nextSnapshot = api.getPublishedSnapshot(
    { ...eventRequest, intent: "add" },
    JSON.parse(w.localStorage.getItem(api.COMMUNITY_STORAGE_KEY)),
  );
  check(
    "Add-next editor receives latest full master",
    nextSnapshot.data.occurrences.length === 3 &&
      nextSnapshot.scope === "local",
  );
  await publish([]);
  await render("/npcs/");
  check(
    "NPC list has two published rows with per-person editors",
    d.querySelectorAll(".wa-table tbody tr").length === 2 &&
      byLabel("编辑人物").length === 2,
  );
  check(
    "One prominent typed add-person action exists",
    byLabel("新增人物条目").length === 1 &&
      params(byLabel("新增人物条目")[0]).get("mode") === "npc" &&
      params(byLabel("新增人物条目")[0]).get("intent") === "add",
  );
  check(
    "Adventure navigation omits duplicate PVE entry",
    !d.querySelector('.wa-section-nav a[href="/pve/"]'),
  );
  const newRequest = {
    entity: "人物与NPC",
    section: "人物条目",
    mode: "npc",
    intent: "add",
    returnTo: "/npcs/",
  };
  const newNpc = {
    name: "验证员洛洛",
    slug: "validation-luoluo",
    aliases: "小洛",
    location: "魔法学院 · 教学楼",
    role: "资料校对员",
    intro: "局部检查测试条目。",
    services: "校对与咨询",
    relatedTasks: "检查任务 A",
    sourceUrl: "https://news.4399.com/luoke/shouce/201007-26-74004.html",
    sourceTitle: "测试来源",
  };
  const created = {
    id: "local-validation-npc",
    status: "published",
    editorVersion: 7,
    editorMode: "npc",
    editorRequest: newRequest,
    snapshotKey: api.getPublishedSnapshot(newRequest).key,
    typedData: newNpc,
    updatedAt: "2026-10-10T10:00:00Z",
  };
  await publish([created]);
  check(
    "Reviewed new NPC immediately appears in directory",
    d.querySelectorAll(".wa-table tbody tr").length === 3 &&
      d.querySelector(".wa-table").textContent.includes("验证员洛洛") &&
      d.querySelector(".wa-table").textContent.includes("本机新条目"),
  );
  check(
    "New NPC uses supported query URL and retains area",
    !!d.querySelector('a[href="/npcs/?entry=validation-luoluo"]') &&
      [...d.querySelectorAll(".wa-table tbody tr")]
        .find((el) => el.textContent.includes("验证员洛洛"))
        .querySelector('a[href="/places/academy/"]'),
  );
  await render("/npcs/?entry=validation-luoluo");
  check(
    "Local NPC detail displays submitted content and scope",
    d.querySelector("h1")?.textContent === "验证员洛洛" &&
      d.body.textContent.includes("检查任务 A") &&
      d.body.textContent.includes("尚未同步到线上"),
  );
  check(
    "Formal local NPC path is explanatory only",
    d.querySelector("code")?.textContent === "/npcs/validation-luoluo/" &&
      !d.querySelector('a[href="/npcs/validation-luoluo/"]'),
  );
  const resumeRequest = {
    entity: newNpc.name,
    section: "人物条目",
    mode: "npc",
    record: "validation-luoluo",
    returnTo: "/npcs/?entry=validation-luoluo",
  };
  const resumed = api.getPublishedSnapshot(resumeRequest, {
    submissions: [created],
  });
  check(
    "Local editor resumes its baseline and stable identity",
    resumed.scope === "local" &&
      resumed.data.role === "资料校对员" &&
      resumed.key === "npc::validation-luoluo",
  );
  const revised = {
    ...created,
    id: "local-validation-revision",
    editorRequest: resumeRequest,
    snapshotKey: resumed.key,
    typedData: { ...newNpc, name: "验证员洛洛二版", services: "修订后的服务" },
    updatedAt: "2026-10-10T11:00:00Z",
  };
  await publish([created, revised]);
  check(
    "Revising local NPC replaces current presentation",
    d.querySelector("h1")?.textContent === "验证员洛洛二版" &&
      d.body.textContent.includes("修订后的服务"),
  );
  await render("/npcs/");
  check(
    "Renaming local NPC does not duplicate it",
    d.querySelectorAll(".wa-table tbody tr").length === 3,
  );
  const knownRequest = {
    entity: "格里芬院长",
    section: "人物条目",
    mode: "npc",
    returnTo: "/npcs/griffin/",
  };
  const knownBaseline = api.getPublishedSnapshot(knownRequest);
  check(
    "Known editor has exact role, scene and source baseline",
    knownBaseline.data.role === "魔法学院院长" &&
      knownBaseline.data.location === "魔法学院 · 教学楼" &&
      knownBaseline.data.sourceUrl ===
        "https://news.4399.com/luoke/shouce/201007-26-74004.html",
  );
  const knownRevision = {
    id: "known-npc-revision",
    status: "published",
    editorVersion: 7,
    editorMode: "npc",
    editorRequest: knownRequest,
    snapshotKey: knownBaseline.key,
    typedData: {
      ...knownBaseline.data,
      name: "格里芬院长修订",
      services: "验证教学服务",
      relatedTasks: "修订后的课程说明",
    },
    updatedAt: "2026-10-10T12:00:00Z",
  };
  await publish([created, revised, knownRevision]);
  check(
    "Existing NPC revision updates list without adding row",
    d.querySelectorAll(".wa-table tbody tr").length === 3 &&
      d.querySelector(".wa-table").textContent.includes("格里芬院长修订"),
  );
  await render("/npcs/griffin/");
  check(
    "Canonical NPC detail reads latest reviewed content",
    d.querySelector("h1")?.textContent === "格里芬院长修订" &&
      d.body.textContent.includes("验证教学服务") &&
      d.body.textContent.includes("修订后的课程说明"),
  );
  check(
    "Composite scene preserves region association",
    !!d.querySelector('#npc-location a[href="/places/academy/"]'),
  );
  await act(async () => {
    w.localStorage.setItem(api.COMMUNITY_STORAGE_KEY, "{broken json");
    w.dispatchEvent(new w.CustomEvent("roco:community-updated"));
  });
  await render("/npcs/");
  check(
    "Malformed JSON safely falls back to published NPC list",
    d.querySelectorAll(".wa-table tbody tr").length === 2,
  );
  await publish([
    null,
    { ...created, typedData: null },
    {
      ...created,
      id: "unsafe-source",
      typedData: { ...newNpc, sourceUrl: "javascript:alert(1)" },
    },
  ]);
  await render("/npcs/?entry=validation-luoluo");
  check(
    "Malformed records and unsafe sources create no active URL",
    d.querySelector("h1")?.textContent === "验证员洛洛" &&
      !d.querySelector('a[href^="javascript:"]'),
  );
  await publish([]);
  for (const [route, label] of [
    ["/places/", "补充地点快捷入口"],
    ["/items/", "新增物品入口"],
    ["/tasks/", "新增任务入口"],
  ]) {
    await render(route);
    check(
      route + " contextual directory add action",
      byLabel(label).some(
        (el) =>
          params(el).get("mode") === "index" &&
          params(el).get("intent") === "add" &&
          params(el).get("returnTo") === route,
      ),
    );
    check(
      route + " no PVE duplicate in local navigation",
      !d.querySelector('.wa-section-nav a[href="/pve/"]'),
    );
  }
  for (const guide of pve.guides) {
    await render("/pve/" + guide.slug + "/");
    check(
      guide.name + " has one-way pet section and typed add-plan",
      !!d.querySelector("#pve-pets") &&
        byLabel("新增挑战方案", d.querySelector("#pve-pets")).some(
          (el) =>
            params(el).get("mode") === "pve" &&
            params(el).get("intent") === "add",
        ),
    );
  }
  await render("/pve/star-tower/");
  check(
    "Star tower shows two records with one negative caution",
    d.querySelectorAll("[data-pve-recommendation]").length === 2 &&
      d.querySelectorAll(".wv7-pve-plan.is-caution").length === 1,
  );
  check(
    "Negative record is a failure condition",
    d
      .querySelector(".wv7-pve-plan.is-caution")
      .textContent.includes("不适用与失败条件") &&
      !d
        .querySelector(".wv7-pve-plan.is-caution")
        .textContent.includes("挑战宠物"),
  );
  const historical = d.querySelector(
    '[data-pve-recommendation="bishui-sacred-wu-20200511"]',
  );
  check(
    "Historical plan keeps date, pet link and original source",
    historical.textContent.includes("2020-05-11") &&
      historical.querySelector('a[href="/pets/bishui/"]') &&
      historical.querySelector(
        'a[href="https://www.sohu.com/a/394472186_120099891"]',
      ),
  );
  check(
    "Each PVE record passes its ID to editor",
    [...d.querySelectorAll("[data-pve-recommendation]")].every((el) =>
      editors(el).some(
        (link) =>
          params(link).get("record") === el.dataset.pveRecommendation &&
          params(link).get("mode") === "pve",
      ),
    ),
  );
  check(
    "World/event/PVE render without React runtime errors",
    runtimeErrors.length === 0,
  );
}
main()
  .catch((error) =>
    checks.push({
      name: "DOM run completed",
      passed: false,
      error: error.stack,
    }),
  )
  .finally(async () => {
    if (root) await act(async () => root.unmount());
    if (dom) dom.window.close();
    console.error = oldConsoleError;
    fs.rmSync(temporary, { recursive: true, force: true });
    const tracked = [
      "src/wiki/WorldPages.jsx",
      "src/wiki/EventPagesV7.jsx",
      "src/wiki/PvePages.jsx",
      "src/wiki/npcPresentation.js",
      "src/wiki/WorldV7.css",
      "content/events-v7.json",
      "content/routes.json",
      "content/pve-pet-recommendations-v7.json",
    ];
    const report = {
      version: 7,
      scope:
        "Activity recurrence, local NPC readback, PVE references and contextual editing; no visual or game-client verification",
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
      path.join(__dirname, "v7-world-check-results.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      checks.filter((c) => c.passed).length +
        "/" +
        checks.length +
        " V7 world checks passed.",
    );
    for (const result of checks.filter((c) => !c.passed))
      console.log(result.name, result.error || "");
    if (runtimeErrors.length) console.log(runtimeErrors);
    process.exitCode = report.passed ? 0 : 1;
  });
