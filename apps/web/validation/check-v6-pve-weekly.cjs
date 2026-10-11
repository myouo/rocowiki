/** V6 PVE / World / weekly-activity integration. jsdom only; no visual audit. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { JSDOM, VirtualConsole } = require("jsdom");

const project = path.resolve(__dirname, "..");
const previewPath = path.resolve(
  process.env.ROCO_V6_PREVIEW || path.join(project, "RocoWiki_UI_V6.html"),
);
const outputPath = path.join(__dirname, "v6-pve-weekly-check-results.json");
const html = fs.readFileSync(previewPath, "utf8");
const readJson = (file) =>
  JSON.parse(fs.readFileSync(path.join(project, file), "utf8"));
const weekly = readJson("content/weekly-v5.json");
const pve = readJson("content/pve-v6.json");
const routes = readJson("content/routes.json");
const docs = readJson("preview/generated-docs.json");
const routeSet = new Set([...routes, ...Object.keys(docs)]);
const checks = [],
  pageResults = [],
  runtimeErrors = [],
  badLinks = [],
  worlds = [];
const jsdomLimitations = new Map();
const pause = (ms = 45) => new Promise((resolve) => setTimeout(resolve, ms));
const text = (client, selector = "main") =>
  client.document.querySelector(selector)?.textContent || "";
const count = (client, selector) =>
  client.document.querySelectorAll(selector).length;
const query = (client) =>
  new URLSearchParams(client.window.location.hash.split("?")[1] || "");
const same = (a, b) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

function check(name, condition, details) {
  checks.push({
    name,
    pass: Boolean(condition),
    ...(details === undefined ? {} : { details }),
  });
}

function create({ route = "/pve/", at = "2026-10-10T09:00:00Z" } = {}) {
  const clock = { now: Date.parse(at) },
    timers = new Map(),
    scrolls = [];
  const vc = new VirtualConsole();
  let world;
  vc.on("jsdomError", (error) => {
    const message = error.message || String(error);
    if (error.type === "css-parsing") {
      jsdomLimitations.set(
        error.type,
        (jsdomLimitations.get(error.type) || 0) + 1,
      );
    } else
      runtimeErrors.push({
        route: world?.window?.location?.hash || route,
        message,
        type: error.type,
      });
  });
  vc.on("error", (...args) =>
    runtimeErrors.push({
      route: world?.window?.location?.hash || route,
      message: args.map(String).join(" "),
    }),
  );
  world = new JSDOM(html, {
    url: "https://roco-wiki.test/#" + route,
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      const NativeDate = w.Date;
      w.Date = class extends NativeDate {
        constructor(...args) {
          super(...(args.length ? args : [clock.now]));
        }
        static now() {
          return clock.now;
        }
      };
      const nativeTimeout = w.setTimeout.bind(w),
        nativeClear = w.clearTimeout.bind(w);
      w.setTimeout = (callback, delay, ...args) => {
        const id = nativeTimeout(callback, delay, ...args);
        if (typeof callback === "function" && delay >= 1000)
          timers.set(id, { callback, delay, args });
        return id;
      };
      w.clearTimeout = (id) => {
        timers.delete(id);
        nativeClear(id);
      };
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function (options) {
        scrolls.push({ id: this.id, options });
      };
      w.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      });
      if (w.HTMLDialogElement) {
        w.HTMLDialogElement.prototype.showModal = function () {
          this.open = true;
        };
        w.HTMLDialogElement.prototype.close = function () {
          this.open = false;
          this.dispatchEvent(new w.Event("close"));
        };
      }
    },
  });
  worlds.push(world);
  return {
    window: world.window,
    document: world.window.document,
    scrolls,
    async go(route) {
      world.window.location.hash = route;
      await pause(100);
    },
    async click(selector) {
      const element = world.window.document.querySelector(selector);
      if (!element) throw new Error("Missing click target: " + selector);
      element.click();
      await pause();
    },
    async time(at, signal = "focus") {
      clock.now = Date.parse(at);
      if (signal === "timer") {
        const timer = [...timers.entries()].find(
          ([, value]) => value.delay >= 1000 && value.delay <= 20000,
        );
        if (!timer)
          throw new Error("Missing scheduled Shanghai-midnight refresh");
        world.window.clearTimeout(timer[0]);
        timer[1].callback(...timer[1].args);
      } else if (signal === "visibilitychange") {
        world.window.document.dispatchEvent(new world.window.Event(signal));
      } else world.window.dispatchEvent(new world.window.Event(signal));
      await pause(100);
    },
    close() {
      world.window.close();
    },
  };
}

async function choose(client, ariaLabel, optionLabel) {
  const trigger = [
    ...client.document.querySelectorAll('[role="combobox"]'),
  ].find((element) => element.getAttribute("aria-label") === ariaLabel);
  if (!trigger) throw new Error("Missing custom Select: " + ariaLabel);
  trigger.click();
  await pause();
  const option = [...client.document.querySelectorAll('[role="option"]')].find(
    (element) => element.textContent.trim() === optionLabel,
  );
  if (!option) throw new Error("Missing option: " + optionLabel);
  option.click();
  await pause(90);
  return trigger;
}

async function searchPve(client, value) {
  const input = client.document.querySelector(".pv6-search input");
  if (!input) throw new Error("Missing PVE search input");
  Object.getOwnPropertyDescriptor(
    client.window.HTMLInputElement.prototype,
    "value",
  ).set.call(input, value);
  input.dispatchEvent(new client.window.Event("input", { bubbles: true }));
  input.dispatchEvent(new client.window.Event("change", { bubbles: true }));
  await pause();
  client.document
    .querySelector(".pv6-filter")
    .dispatchEvent(
      new client.window.Event("submit", { bubbles: true, cancelable: true }),
    );
  await pause(90);
}

function checkLinks(client, route) {
  for (const anchor of client.document.querySelectorAll('a[href^="#/"]')) {
    const href = anchor.getAttribute("href");
    const destination = href.slice(1).split(/[?#]/)[0];
    if (!routeSet.has(destination)) badLinks.push({ route, href, destination });
  }
}

async function run() {
  const ending = weekly.events.filter((event) => event.category === "ending");
  const sourceIds = new Set(pve.sources.map((source) => source.id));
  const danglingSources = pve.guides
    .flatMap((guide) => [
      ...guide.sourceIds,
      ...guide.entrances.map((item) => item.sourceId),
      ...guide.facts.map((item) => item.sourceId),
      ...guide.rewards.map((item) => item.sourceId),
    ])
    .filter((id) => !sourceIds.has(id));
  check(
    "All five PVE guides keep traceable rule, entrance and reward references",
    pve.guides.length === 5 && danglingSources.length === 0,
    { guides: pve.guides.length, danglingSources },
  );
  const official = pve.sources.find(
    (source) => source.id === "lite-pve-20250910",
  );
  check(
    "Official source keeps a durable URL, section locators and client-verification limit",
    Boolean(
      official?.canonicalUrl &&
        official?.retrievedUrl &&
        official?.locator &&
        official?.evidence?.sections?.length === 7 &&
        official?.evidence?.clientVerified === false,
    ),
  );
  check(
    "Three genuinely earlier activities end on October 15 with date-only precision",
    ending.length === 3 &&
      ending.every(
        (event) =>
          event.startDate === "2026-09-04" &&
          event.endDate === "2026-10-15" &&
          event.endTime === null &&
          event.datePrecision === "date" &&
          event.timeZone === "Asia/Shanghai" &&
          event.sourceIds.length === 2,
      ),
    ending.map((event) => ({
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
    })),
  );

  // Let first-mount passive effects finish before simulating controlled input.
  const client = create();
  await pause(650);
  check(
    "PVE hub displays five independent challenge guides",
    count(client, ".pv6-directory-row") === 5 &&
      text(client, "h1") === "PVE 副本与挑战",
  );
  check(
    "PVE appears as a first-level header destination",
    [...client.document.querySelectorAll("#rw-primary-navigation a")].some(
      (anchor) => anchor.getAttribute("href") === "#/pve/",
    ),
  );
  await searchPve(client, "哨兵阴阴");
  check(
    "Spoken sentry alias finds the formally named guide",
    count(client, ".pv6-directory-row") === 1 &&
      text(client, ".pv6-directory-name h2") === "哨兵因因的情报" &&
      query(client).get("q") === "哨兵阴阴",
  );
  await client.click(".pv6-search button");
  check(
    "PVE search clear restores all five guides and removes its query",
    count(client, ".pv6-directory-row") === 5 && !query(client).has("q"),
  );
  await searchPve(client, "勇者挑战馆");
  check(
    "Spoken training-hall alias finds the formal name",
    count(client, ".pv6-directory-row") === 1 &&
      text(client, ".pv6-directory-name h2") === "勇者训练馆",
  );
  await client.go("/pve/");
  await choose(client, "按 PVE 奖励目标筛选", "培养资源");
  check(
    "PVE reward-target select filters three cultivation modes and persists its query",
    count(client, ".pv6-directory-row") === 3 &&
      query(client).get("goal") === "training",
  );
  await choose(client, "按 PVE 奖励目标筛选", "取得装备");
  check(
    "Equipment target leaves only the star tower",
    count(client, ".pv6-directory-row") === 1 &&
      text(client, ".pv6-directory-name h2") === "星辰之塔",
  );
  await client.go("/pve/?goal=not-a-goal&q=missing-mode");
  check(
    "Unknown goal falls back safely and unknown search has an actionable empty state",
    count(client, ".pv6-directory-row") === 0 &&
      Boolean(client.document.querySelector('.rw-empty a[href="#/pve/"]')),
  );
  await client.go("/pve/star-tower/?level=1");
  await choose(client, "选择星辰塔层数", "第 8 层 · 星辰令");
  check(
    "Tower selector switches to eighth-floor conditions and retains URL context",
    query(client).get("level") === "8" &&
      text(client, ".pv6-context-body").includes("按今天的星辰令核对队伍"),
  );
  check(
    "Current-rule guide links separately labelled historical Boss records",
    client.document
      .querySelector(".pv6-archive-note a")
      ?.getAttribute("href") === "#/challenges/star-tower/?level=8" &&
      text(client, ".pv6-archive-note").includes("2023"),
  );
  const beforeAnchor = client.window.location.hash;
  await client.click(".pv6-evidence-bar a");
  check(
    "Source-jump anchor preserves the preview route and requests the correct section",
    client.window.location.hash === beforeAnchor &&
      client.scrolls.some((item) => item.id === "pve-sources"),
  );
  check(
    "PVE definition-list terms retain valid immediate grouping",
    [...client.document.querySelectorAll(".pv6-facts > div")].every(
      (item) =>
        item.querySelector(":scope > dt") && item.querySelector(":scope > dd"),
    ),
  );
  await client.go("/pve/star-tower/?level=9");
  check(
    "Invalid tower level falls back to the first floor",
    text(client, ".pv6-context-picker").includes("第 1 层"),
  );
  await client.go("/pve/sentry-intelligence/");
  await choose(client, "选择哨兵因因的情报查阅环节", "飞鹰契约");
  check(
    "Sentry contract branch stays separate from bounty exchange",
    query(client).get("view") === "contract" &&
      text(client, ".pv6-context-body h3") === "领取宠物与进化资格分开记录",
  );
  await client.go("/pve/training-hall/");
  await choose(client, "选择勇者训练馆查阅环节", "终极训练馆");
  check(
    "Training-hall selector opens the ultimate-hall branch",
    query(client).get("view") === "ultimate" &&
      text(client, ".pv6-context-body h3") === "为天赋培养取得道具",
  );
  await client.go("/pve/missing-mode/");
  check(
    "Unknown PVE slug never impersonates another guide",
    text(client, "h1") === "尚未收录这个 PVE 页面" &&
      !client.document.querySelector(".pv6-rewards"),
  );

  await client.go("/npcs/");
  await choose(client, "按地区筛选人物", "魔法学院");
  check(
    "NPC custom Select preserves its working area filter",
    query(client).get("area") === "academy" &&
      count(client, ".wa-table tbody tr") === 1 &&
      Boolean(
        client.document.querySelector(
          '.wa-table tbody a[href="#/npcs/griffin/"]',
        ),
      ),
  );
  await client.go("/challenges/star-tower/?level=1");
  await choose(client, "选择历史星辰塔 Boss", "炼狱使者");
  check(
    "Legacy tower Boss selector still filters its historical record",
    query(client).get("boss") === "炼狱使者" &&
      text(client, ".wa-selected-boss h2") === "炼狱使者",
  );
  check(
    "Legacy challenge ownership links back to the PVE chapter",
    text(client, "h1").includes("历史 Boss 目录") &&
      Boolean(
        client.document.querySelector('main a[href="#/pve/star-tower/"]'),
      ),
  );
  await client.go("/adventure/");
  check(
    "Adventure provides a direct PVE cross-link",
    Boolean(client.document.querySelector('main a[href="#/pve/"]')),
  );

  await client.go("/events/");
  check(
    "Activity index contains all ten reviewed events",
    count(client, ".wa-v5-event-row") === 10,
  );
  await client.go("/events/?view=new");
  check(
    "Activity new filter includes three new and one new permanent event",
    count(client, ".wa-v5-event-row") === 4,
  );
  await client.go("/events/?view=continuing");
  check(
    "Activity continuing filter remains three entries",
    count(client, ".wa-v5-event-row") === 3,
  );
  await client.go("/events/?view=ending");
  check(
    "Activity expiry filter now contains three genuine October 15 deadlines",
    count(client, ".wa-v5-event-row") === 3 &&
      ending.every((event) =>
        text(client, ".wa-v5-event-list").includes(event.name),
      ),
  );
  await client.go("/events/honey-homecoming-20260904/");
  check(
    "Ending detail identifies the September opening batch and its October reminder context",
    text(client, ".wa-v6-edition-context").includes("2026.09.04") &&
      text(client, ".wa-facts").includes("2026.09.04"),
  );
  check(
    "Unresolved pet-versus-evolution reward mapping is explicitly preserved",
    text(client, ".wa-v6-reward-note").includes("未在文字中逐项对应") &&
      count(client, "#event-rewards tbody tr") === 2 &&
      [...client.document.querySelectorAll("#event-rewards .rw-badge")].every(
        (badge) => badge.textContent.includes("宠物或进化资格"),
      ),
  );
  check(
    "Uncatalogued ending rewards remain text rather than fabricated pet links",
    count(client, "#event-rewards a") === 0,
  );
  check(
    "Ending details cite the September source edition instead of October sources",
    count(client, "#event-sources a") === 2 &&
      [...client.document.querySelectorAll("#event-sources a")].every(
        (anchor) => /202609-03-1015096|09022026\/172006110/.test(anchor.href),
      ),
  );

  await client.go("/");
  check(
    "Homepage shows new / continuing / ending categories simultaneously as 4 / 3 / 3",
    count(client, ".rw-v6-event-column.new li") === 4 &&
      count(client, ".rw-v6-event-column.continuing li") === 3 &&
      count(client, ".rw-v6-event-column.ending li") === 3,
  );
  check(
    "Homepage preserves the honey activity evolution-qualification summary",
    text(client, ".rw-v6-event-column.ending").includes("含进化资格"),
  );
  check(
    "Every homepage activity opens a registered detail route",
    [...client.document.querySelectorAll(".rw-v6-event-columns li > a")].every(
      (anchor) => routeSet.has(anchor.getAttribute("href").slice(1)),
    ),
  );

  const worldPrefixes = [
    "/pve/",
    "/adventure/",
    "/places/",
    "/npcs/",
    "/items/",
    "/events/",
    "/battle/",
    "/challenges/",
    "/tasks/",
  ];
  const worldRoutes = routes.filter((route) =>
    worldPrefixes.some((prefix) => route.startsWith(prefix)),
  );
  for (const route of worldRoutes) {
    await client.go(route);
    const headings = client.document.querySelectorAll("main h1");
    const item = {
      route,
      h1Count: headings.length,
      title: headings[0]?.textContent || "",
      textLength: text(client).trim().length,
      feedbackCount: count(client, ".rw-feedback-trigger"),
      nativeSelectCount: count(client, "main select"),
    };
    item.pass =
      item.h1Count === 1 &&
      item.textLength > 100 &&
      item.feedbackCount === 1 &&
      item.nativeSelectCount === 0;
    pageResults.push(item);
    checkLinks(client, route);
  }
  check(
    "All registered PVE and legacy World routes render a titled page with one feedback entry",
    pageResults.every((item) => item.pass),
    {
      routeCount: pageResults.length,
      failures: pageResults.filter((item) => !item.pass),
    },
  );
  check(
    "All rendered World / PVE internal links resolve to registered routes",
    badLinks.length === 0,
    badLinks,
  );
  client.close();

  const tomorrow = create({ route: "/", at: "2026-10-13T16:10:00Z" });
  await pause(650);
  check(
    "Shanghai October 14 homepage warns about the next-day activity deadlines",
    text(tomorrow, ".rw-v6-ending-alert").includes("明天"),
  );
  await tomorrow.go("/events/?view=ending");
  check(
    "Shanghai October 14 activity rows show tomorrow rather than today",
    count(tomorrow, ".wa-v5-event-row") === 3 &&
      [
        ...tomorrow.document.querySelectorAll(".wa-v5-event-row .rw-badge"),
      ].every((item) => item.textContent === "明天结束"),
  );
  await tomorrow.time("2026-10-14T16:10:00Z", "visibilitychange");
  check(
    "Activity rows refresh to today when the visible Shanghai date crosses midnight",
    [...tomorrow.document.querySelectorAll(".wa-v5-event-row .rw-badge")].every(
      (item) => item.textContent === "今天结束",
    ),
  );
  tomorrow.close();

  const today = create({ route: "/", at: "2026-10-14T16:10:00Z" });
  await pause(650);
  check(
    "Shanghai October 15 homepage shows the concrete three-event Thursday reminder",
    text(today, ".rw-v6-ending-alert").includes("今日结束") &&
      ending.every((event) =>
        text(today, ".rw-v6-ending-alert").includes(event.name),
      ),
  );
  await today.time("2026-10-15T16:10:00Z");
  check(
    "Kept-open homepage becomes historical after October 16 Shanghai refocus",
    text(today, ".rw-v6-edition").includes("历史周更快照") &&
      text(today, "#rw-weekly-events-title") === "本期活动记录" &&
      !today.document.querySelector(".rw-v6-ending-alert"),
  );
  check(
    "Historical continuation group no longer claims the events are currently available",
    !text(today, ".rw-v6-event-column.continuing header").includes("仍可参与"),
  );
  today.close();

  const stale = create({
    route: "/events/?view=ending",
    at: "2026-10-15T16:10:00Z",
  });
  await pause(650);
  check(
    "Outdated October 9 snapshot stops emitting future-expiry rows",
    count(stale, ".wa-v5-event-row") === 0 &&
      text(stale, ".wa-v5-edition").includes("历史快照"),
  );
  await stale.go("/events/measurement-expert-20260904/");
  check(
    "Expired activity detail remains accessible and labels the activity ended",
    text(stale, ".rw-pagehead").includes("已结束") ||
      [...stale.document.querySelectorAll("main .rw-badge")].some(
        (item) => item.textContent === "已结束",
      ),
  );
  stale.close();

  const midnight = create({ route: "/events/", at: "2026-10-15T15:59:50Z" });
  await pause(650);
  await midnight.time("2026-10-15T16:00:02Z", "timer");
  const expiredRows = [
    ...midnight.document.querySelectorAll(".wa-v5-event-row"),
  ].filter((row) =>
    ending.some((event) => row.textContent.includes(event.name)),
  );
  check(
    "World weekly pages refresh automatically at Shanghai midnight without a navigation",
    text(midnight, ".wa-v5-edition").includes("历史快照") &&
      expiredRows.length === 3 &&
      expiredRows.every(
        (row) => row.querySelector(".rw-badge")?.textContent === "已结束",
      ),
  );
  midnight.close();
  check(
    "No JavaScript runtime or console errors occurred",
    runtimeErrors.length === 0,
    runtimeErrors,
  );
}

run()
  .catch((error) =>
    checks.push({
      name: "PVE / weekly integration run completed",
      pass: false,
      details: error.stack || String(error),
    }),
  )
  .finally(() => {
    for (const world of worlds) {
      try {
        world.window.close();
      } catch {}
    }
    const failures = checks.filter((item) => !item.pass);
    const result = {
      status: failures.length ? "FAIL" : "PASS",
      scope:
        "jsdom PVE/World/weekly-activity DOM and deterministic Shanghai-date integration; not browser rendering, layout, visual QA or animation-performance validation",
      checkCount: checks.length,
      checks,
      preview: path.relative(project, previewPath),
      previewSha256: crypto.createHash("sha256").update(html).digest("hex"),
      ranAt: new Date().toISOString(),
      routeCount: pageResults.length,
      registeredRouteCount: routeSet.size,
      pageResults,
      badLinks,
      runtimeErrors,
      jsdomLimitations: [...jsdomLimitations].map(([type, count]) => ({
        type,
        count,
      })),
    };
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");
    console.log(
      JSON.stringify(
        {
          status: result.status,
          checks: result.checkCount,
          routes: result.routeCount,
          failures,
          runtimeErrors,
          output: path.relative(project, outputPath),
        },
        null,
        2,
      ),
    );
    if (failures.length) process.exitCode = 1;
  });
