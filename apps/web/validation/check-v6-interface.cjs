/** V6 interface/DOM integration checks. This is not a browser visual audit. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { JSDOM, VirtualConsole } = require("jsdom");

const project = path.resolve(__dirname, "..");
const previewPath = path.resolve(
  process.env.ROCO_V6_PREVIEW || path.join(project, "RocoWiki_UI_V6.html"),
);
const outputPath = path.join(__dirname, "v6-interface-check-results.json");
const html = fs.readFileSync(previewPath, "utf8");
const routes = JSON.parse(
  fs.readFileSync(path.join(project, "content/routes.json"), "utf8"),
);
const docs = JSON.parse(
  fs.readFileSync(path.join(project, "preview/generated-docs.json"), "utf8"),
);
const allRoutes = [...new Set([...routes, ...Object.keys(docs)])];
const routeSet = new Set(allRoutes);
const checks = [];
const pageResults = [];
const runtimeErrors = [];
const jsdomLimitations = [];
const badLinks = [];
const worlds = [];
const pause = (ms = 45) => new Promise((resolve) => setTimeout(resolve, ms));

function check(name, condition, details) {
  const item = { name, pass: Boolean(condition) };
  if (!condition && details !== undefined) item.details = details;
  checks.push(item);
  return item.pass;
}
function create({
  route = "/",
  at = "2026-10-10T09:00:00Z",
  storage = {},
} = {}) {
  const clock = { value: Date.parse(at) };
  const scheduled = new Map();
  const vc = new VirtualConsole();
  vc.on("jsdomError", (error) => {
    const message = error.message || String(error);
    if (error.type === "css-parsing")
      jsdomLimitations.push({ type: error.type, message });
    else
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
  let world;
  world = new JSDOM(html, {
    url: "https://roco-wiki.test/#" + route,
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      const NativeDate = w.Date;
      w.Date = class extends NativeDate {
        constructor(...args) {
          super(...(args.length ? args : [clock.value]));
        }
        static now() {
          return clock.value;
        }
      };
      const nativeTimeout = w.setTimeout.bind(w);
      const nativeClear = w.clearTimeout.bind(w);
      w.setTimeout = (callback, delay, ...args) => {
        const id = nativeTimeout(callback, delay, ...args);
        if (typeof callback === "function" && delay >= 1000)
          scheduled.set(id, { callback, delay, args });
        return id;
      };
      w.clearTimeout = (id) => {
        scheduled.delete(id);
        nativeClear(id);
      };
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
      for (const [key, value] of Object.entries(storage))
        w.localStorage.setItem(key, value);
    },
  });
  worlds.push(world);
  return {
    window: world.window,
    document: world.window.document,
    async go(route) {
      world.window.location.hash = route;
      await pause();
      await pause();
    },
    async click(selector) {
      const element = world.window.document.querySelector(selector);
      if (!element) throw new Error("Missing click target: " + selector);
      element.click();
      await pause();
    },
    async setTime(instant, signal = "focus") {
      clock.value = Date.parse(instant);
      if (signal === "timer") {
        const candidate = [...scheduled.entries()].find(
          ([, item]) => item.delay >= 1000 && item.delay <= 12000,
        );
        if (!candidate)
          throw new Error("No scheduled Shanghai-midnight refresh timer");
        world.window.clearTimeout(candidate[0]);
        candidate[1].callback(...candidate[1].args);
      } else {
        world.window.dispatchEvent(new world.window.Event(signal));
      }
      await pause();
      await pause();
    },
    close() {
      world.window.close();
    },
  };
}
function mainText(client) {
  return client.document.querySelector("main")?.textContent || "";
}
function cards(client) {
  return [...client.document.querySelectorAll(".rw-petcard h3")]
    .map((item) => item.textContent.trim())
    .sort();
}
function equalsNames(actual, expected) {
  return (
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
  );
}
function routeFromHref(href) {
  if (!href.startsWith("#/")) return null;
  return href.slice(1).split(/[?#]/)[0];
}
async function clickByAria(client, label) {
  const button = [...client.document.querySelectorAll("button")].find(
    (item) => item.getAttribute("aria-label") === label,
  );
  if (!button) throw new Error("Missing button: " + label);
  button.click();
  await pause();
}

async function setInput(client, element, value) {
  if (!element) throw new Error("Missing input");
  const proto =
    element.tagName === "TEXTAREA"
      ? client.window.HTMLTextAreaElement.prototype
      : client.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
  if (element.setSelectionRange) {
    try {
      element.setSelectionRange(value.length, value.length);
    } catch {}
  }
  element.dispatchEvent(new client.window.Event("input", { bubbles: true }));
  element.dispatchEvent(new client.window.Event("change", { bubbles: true }));
  await pause();
}
function key(client, element, key, extras = {}) {
  element.dispatchEvent(
    new client.window.KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...extras,
    }),
  );
}
async function selectOption(client, label, text) {
  const button = [...client.document.querySelectorAll("[role=combobox]")].find(
    (button) => button.getAttribute("aria-label") === label,
  );
  if (!button) throw new Error("Missing combobox: " + label);
  button.click();
  await pause();
  const option = [...client.document.querySelectorAll("[role=option]")].find(
    (option) => option.textContent.trim() === text,
  );
  if (!option) throw new Error("Missing option: " + text);
  option.click();
  await pause();
  return button;
}
async function run() {
  const client = create();
  await pause(160);
  const d = client.document;
  check(
    "RocoWiki wordmark retains the approved lettering",
    d.querySelector(".rw-wordmark b")?.textContent === "RocoWiki" &&
      fs
        .readFileSync(path.join(project, "src/css/v5.css"), "utf8")
        .includes('font-family: Georgia, "Times New Roman", serif;'),
  );
  check(
    "Account and contribution guide remain direct labelled header links",
    d.querySelector(".rw-account-link")?.getAttribute("href") ===
      "#/account/" &&
      d.querySelector(".rw-contribute-link")?.getAttribute("href") ===
        "#/help/contributing/",
  );
  check(
    "PVE has a first-level header link and homepage entry",
    !!d.querySelector('#rw-primary-navigation a[href="#/pve/"]') &&
      !!d.querySelector('.rw-v6-portal-index a[href="#/pve/"]'),
  );
  check(
    "Source module entry removed from global navigation without deleting its route",
    !d.querySelector('.rw-footer a[href="#/help/sources/"]') &&
      !!docs["/help/sources/"],
  );
  const competitions = d.querySelectorAll(".rw-v6-pvp-tables>section");
  check(
    "Homepage renders ladder first and type tournament second as two simultaneous tables",
    competitions.length === 2 &&
      competitions[0].classList.contains("rw-v6-ladder") &&
      competitions[1].classList.contains("rw-v6-type-tournament") &&
      [...competitions].every((section) => section.querySelector("table")),
  );
  check(
    "No homepage mode or activity tab hides the weekly summaries",
    !d.querySelector(".rw-home-v6 [role=tablist]"),
  );
  check(
    "Both type periods and all 12 ladder bans are initially readable",
    d.querySelectorAll(".rw-v6-type-tournament tbody tr").length === 2 &&
      d.querySelectorAll(".rw-v6-ladder-bans li").length === 12 &&
      d.querySelector(".rw-v6-type-tournament").textContent.includes("11 只") &&
      d.querySelector(".rw-v6-type-tournament").textContent.includes("10 只"),
  );
  check(
    "Activity columns contain four new, three continuing, and three expiring activities",
    d.querySelectorAll(".rw-v6-event-column.new li").length === 4 &&
      d.querySelectorAll(".rw-v6-event-column.continuing li").length === 3 &&
      d.querySelectorAll(".rw-v6-event-column.ending li").length === 3,
  );
  check(
    "Date-only activity deadlines do not invent a countdown time",
    !/23:59|倒计时|剩余\s*\d+\s*小时/.test(
      d.querySelector(".rw-v6-weekly-activities").textContent,
    ),
  );
  check(
    "Official-game type images are embedded in the single-file preview",
    [...d.querySelectorAll(".rw-type-icon img,.rw-attribute-v6 img")].length >
      10 &&
      [...d.querySelectorAll(".rw-type-icon img,.rw-attribute-v6 img")].every(
        (img) =>
          img.getAttribute("src").startsWith("data:image/png;base64,") &&
          img.alt,
      ),
  );

  await client.go("/edit/?entity=海芙约忒&section=效果与条件");
  check(
    "Structured editor exposes entity linking in all three content fields",
    d.querySelectorAll(".rw-entity-editor").length === 3,
  );
  let field = d.querySelector('textarea[aria-label="触发条件"]');
  await setInput(client, field, "当场上存在/海市");
  check(
    "Slash after Chinese prose finds the environment entity",
    d
      .querySelector(".rw-entity-menu [role=option]")
      ?.textContent.includes("海市蜃楼（环境）"),
  );
  key(client, field, "Enter");
  await pause();
  check(
    "Entity selection inserts a portable canonical internal Markdown link",
    field.value ===
      "当场上存在[海市蜃楼（环境）](/mechanics/environments/mirage/)" &&
      !d.querySelector(".rw-entity-menu"),
  );
  check(
    "After entity insertion, caret returns to the end of the inserted link",
    d.activeElement === field &&
      field.selectionStart === field.value.length &&
      field.selectionEnd === field.value.length,
  );
  [...d.querySelectorAll("button")]
    .find((button) => button.textContent.includes("预览与差异"))
    .click();
  await pause();
  check(
    "Structured reading preview resolves quick-inserted entity links",
    !!d.querySelector(
      '.cm-structured-preview a[href="#/mechanics/environments/mirage/"]',
    ),
  );
  [...d.querySelectorAll("button")]
    .find((button) => button.textContent.trim() === "编辑")
    .click();
  await pause();
  const returnedField = d.querySelector('textarea[aria-label="触发条件"]');
  if (returnedField) field = returnedField;
  await setInput(client, field, "https://roco.qq.com/path/");
  check(
    "Typing a URL slash does not open the entity menu",
    !d.querySelector(".rw-entity-menu"),
  );
  await setInput(client, field, "/海弗耶特");
  check(
    "Entity lookup recognizes the supplied speech alias and proposes canonical pet name",
    d
      .querySelector(".rw-entity-menu [role=option]")
      ?.textContent.includes("海芙约忒"),
  );
  key(client, field, "Escape");
  await pause();
  check(
    "Escape dismisses autocomplete without changing authored text",
    !d.querySelector(".rw-entity-menu") && field.value === "/海弗耶特",
  );
  await setInput(client, field, "海芙");
  field.focus();
  field.setSelectionRange(0, 2);
  field.dispatchEvent(new client.window.Event("select", { bubbles: true }));
  d.querySelector('button[aria-label="触发条件：插入词条"]').click();
  await pause();
  check(
    "Visible insert-entity button opens the same searchable entry list",
    !!d.querySelector(".rw-entity-menu [role=listbox]") && field.value === "/",
  );
  field.dispatchEvent(
    new client.window.CompositionEvent("compositionstart", { bubbles: true }),
  );
  await pause();
  check(
    "IME composition temporarily suppresses autocomplete navigation",
    !d.querySelector(".rw-entity-menu"),
  );
  field.dispatchEvent(
    new client.window.CompositionEvent("compositionend", { bubbles: true }),
  );
  await pause();
  key(client, field, "Escape");
  await pause();
  const markdownMode = [...d.querySelectorAll("button")].find((button) =>
    button.textContent.includes("受限 Markdown"),
  );
  markdownMode.click();
  await pause();
  const markdown = d.querySelector('textarea[aria-label="正文"]');
  await setInput(
    client,
    markdown,
    "## 环境关联\n\n[海市蜃楼](/mechanics/environments/mirage/) 的适用条件需要注明。\n\n[无效路径](/\\example.test/)",
  );
  const previewButton = [...d.querySelectorAll("button")].find((button) =>
    button.textContent.includes("预览与差异"),
  );
  previewButton.click();
  await pause();
  check(
    "Markdown preview renders inserted internal links as working Wiki links",
    d.querySelector(
      '.cm-markdown-preview a[href="#/mechanics/environments/mirage/"]',
    )?.textContent === "海市蜃楼",
  );
  check(
    "Markdown internal-link preview leaves backslash-normalized external paths unlinked",
    [...d.querySelectorAll(".cm-markdown-preview a")].every(
      (a) => a.textContent !== "无效路径",
    ),
  );

  await client.go("/review/?submission=demo-001");
  const role = d.querySelector("#cm-review-role");
  check(
    "Review role control is a custom combobox, not a native select",
    role?.getAttribute("role") === "combobox" &&
      d.querySelectorAll("select").length === 0,
  );
  key(client, role, "ArrowDown");
  await pause();
  check(
    "Arrow key opens custom role list with selection state",
    role.getAttribute("aria-expanded") === "true" &&
      d.querySelectorAll("[role=listbox] [role=option]").length === 3,
  );
  key(client, role, "ArrowDown");
  await pause();
  key(client, role, "Enter");
  await pause();
  check(
    "Keyboard selection changes role and returns focus to the trigger",
    role.textContent.includes("发布维护者") &&
      role.getAttribute("aria-expanded") === "false" &&
      d.activeElement === role,
  );
  role.click();
  await pause();
  key(client, role, "Escape");
  await pause();
  check(
    "Escape closes a custom dropdown without changing selection",
    role.textContent.includes("发布维护者") &&
      role.getAttribute("aria-expanded") === "false",
  );
  role.click();
  await pause();
  d.body.dispatchEvent(
    new client.window.Event("pointerdown", { bubbles: true }),
  );
  await pause();
  check(
    "Clicking outside dismisses a custom dropdown",
    role.getAttribute("aria-expanded") === "false",
  );
  const viewport = {
    width: client.window.innerWidth,
    height: client.window.innerHeight,
  };
  client.window.innerWidth = 390;
  client.window.innerHeight = 720;
  role.click();
  await pause();
  const roleRoot = role.closest(".rw-select"),
    rolePanel = roleRoot.querySelector(".rw-select-panel");
  roleRoot.getBoundingClientRect = () => ({
    left: 250,
    right: 370,
    top: 650,
    bottom: 690,
    width: 120,
    height: 40,
  });
  rolePanel.getBoundingClientRect = () => ({
    left: 250,
    right: 490,
    top: 695,
    bottom: 975,
    width: 240,
    height: 280,
  });
  client.window.dispatchEvent(new client.window.Event("resize"));
  await pause();
  check(
    "Custom dropdown placement logic keeps a simulated narrow-viewport popup inside the right edge",
    Number.parseFloat(rolePanel.style.left) === -116,
  );
  check(
    "Custom dropdown placement logic opens above when the simulated space below is insufficient",
    rolePanel.classList.contains("opens-up"),
  );
  client.window.dispatchEvent(new client.window.Event("scroll"));
  await pause();
  key(client, role, "Escape");
  await pause();
  client.window.innerWidth = viewport.width;
  client.window.innerHeight = viewport.height;

  await client.go("/mechanics/weather/");
  const chapter = d.querySelector(".rw-mobile-doc-select [role=combobox]");
  chapter.click();
  await pause();
  const chapterSearch = d.querySelector(
    ".rw-mobile-doc-select .rw-select-search input",
  );
  check(
    "Searchable custom dropdown associates focused search input with its list and active option",
    !!d.getElementById(chapterSearch.getAttribute("aria-controls")) &&
      !!d.getElementById(chapterSearch.getAttribute("aria-activedescendant")),
  );
  await setInput(client, chapterSearch, "海市");
  check(
    "Article chapter dropdown supports searching grouped choices",
    d.querySelectorAll(".rw-mobile-doc-select [role=option]").length === 1 &&
      d
        .querySelector(".rw-mobile-doc-select [role=option]")
        ?.textContent.includes("海市蜃楼"),
  );
  key(client, chapterSearch, "Enter", { isComposing: true });
  await pause();
  check(
    "Committing Chinese input in a searchable dropdown does not prematurely choose an option",
    client.window.location.hash === "#/mechanics/weather/" &&
      chapter.getAttribute("aria-expanded") === "true",
  );
  key(client, chapterSearch, "Enter");
  await pause();
  await pause();
  check(
    "Choosing a chapter navigates to its stable document route",
    client.window.location.hash === "#/mechanics/environments/mirage/" &&
      d.querySelector("main h1")?.textContent === "海市蜃楼（环境）",
  );

  await client.go("/pets/haifu/");
  const skill = d.querySelector(
    '#skills a[href*="/skills/"][href*="pet=haifu"]',
  );
  check(
    "Pet skill pool links to canonical skill with entering-pet context",
    !!skill,
  );
  skill.click();
  await pause();
  await pause();
  check(
    "Skill page keeps its entering pet and explicit return-to-pool link",
    d
      .querySelector(".rw-skill-pet-context-v6")
      ?.textContent.includes("海芙约忒") &&
      !!d.querySelector(
        '.rw-skill-pet-context-v6 a[href="#/pets/haifu/#skills"]',
      ),
  );
  d.querySelector(
    '.rw-skill-pet-context-v6 a[href="#/pets/haifu/#skills"]',
  ).click();
  await pause();
  await pause();
  check(
    "Pet skill-pool anchor returns to the pet rather than becoming a broken preview route",
    client.window.location.hash === "#/pets/haifu/#skills" &&
      d.querySelector("main h1")?.textContent === "海芙约忒" &&
      !!d.querySelector("#skills"),
  );

  await client.go("/");
  d.querySelector(".rw-feedback-trigger").click();
  await pause();
  await selectOption(client, "反馈问题类型", "规则已过期");
  check(
    "Global feedback uses the shared custom dropdown and retains the chosen issue type",
    d
      .querySelector(".rw-feedback-dialog [role=combobox]")
      ?.textContent.includes("规则已过期"),
  );
  const close = d.querySelector(
    '.rw-feedback-dialog button[aria-label="关闭反馈"]',
  );
  if (close) {
    close.click();
    await pause();
  } else d.querySelector(".rw-feedback-dialog")?.close();
  const sourceLinks = [];
  for (const route of allRoutes) {
    await client.go(route);
    const h1s = [...d.querySelectorAll("main h1")];
    const feedbackCount = d.querySelectorAll(".rw-feedback-trigger").length;
    const nativeSelects = d.querySelectorAll("select").length;
    pageResults.push({
      route,
      title: h1s[0]?.textContent || null,
      pass:
        h1s.length === 1 &&
        (mainText(client).trim().length > 90 ||
          (["/tools/pp/", "/tools/range/"].includes(route) &&
            d.querySelectorAll(".rw-calculator-moved a").length === 3)) &&
        feedbackCount === 1 &&
        nativeSelects === 0,
      h1Count: h1s.length,
      feedbackButtons: feedbackCount,
      nativeSelects,
    });
    for (const a of d.querySelectorAll('a[href^="#/"]')) {
      const href = a.getAttribute("href"),
        destination = routeFromHref(href);
      if (!routeSet.has(destination))
        badLinks.push({ route, destination, href });
    }
    if (route === "/help/sources/")
      sourceLinks.push(d.querySelector("main h1")?.textContent);
  }
  check(
    "All registered content routes render one readable page and one feedback entry, with zero native selects",
    pageResults.every((result) => result.pass),
    pageResults.filter((result) => !result.pass),
  );
  check(
    "All rendered internal entity, navigation, and document links resolve",
    badLinks.length === 0,
    badLinks,
  );
  check(
    "The sources module remains accessible through its existing route",
    sourceLinks[0] === "资料来源与验证",
  );
  client.close();

  const thursday = create({ at: "2026-10-15T04:00:00Z" });
  await pause(600);
  check(
    "Thursday visitor sees the three verified activities expiring today",
    thursday.document
      .querySelector(".rw-v6-ending-alert")
      ?.textContent.includes("这 3 项活动") &&
      ["测量专家", "采蜜归巢", "米粒小铺"].every((name) =>
        thursday.document
          .querySelector(".rw-v6-ending-alert")
          .textContent.includes(name),
      ),
  );
  const reminder = thursday.document.querySelector(".rw-v6-ending-alert>a");
  reminder.click();
  await pause();
  check(
    "Jump-to-expiring-activities stays on homepage in the hash-routed preview",
    thursday.window.location.hash === "#/" &&
      !!thursday.document.querySelector(".rw-v6-event-column.ending"),
  );
  await thursday.setTime("2026-10-16T00:00:00Z");
  check(
    "An open homepage refreshes to historical context after the edition expires",
    thursday.document
      .querySelector(".rw-v6-edition")
      ?.textContent.includes("历史周更快照") &&
      !thursday.document.querySelector(".rw-v6-ending-alert") &&
      thursday.document.querySelector("#rw-weekly-pvp-title")?.textContent ===
        "本期竞赛记录",
  );
  thursday.close();
  const midnight = create({ at: "2026-10-14T15:59:50Z" });
  await pause(600);
  await midnight.setTime("2026-10-14T16:00:02Z", "timer");
  check(
    "Shanghai-midnight refresh activates Thursday reminder without reload",
    !!midnight.document.querySelector(".rw-v6-ending-alert"),
  );
  midnight.close();
  check(
    "No JavaScript runtime or console errors occurred",
    runtimeErrors.length === 0,
    runtimeErrors,
  );
}

run()
  .catch((error) => {
    checks.push({
      name: "QA run completed",
      pass: false,
      details: error.stack || String(error),
    });
  })
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
        "jsdom DOM/data integration and deterministic clock tests; not browser rendering, visual QA or animation performance validation",
      preview: path.relative(project, previewPath),
      previewSha256: crypto.createHash("sha256").update(html).digest("hex"),
      ranAt: new Date().toISOString(),
      routeCount: pageResults.length,
      checkCount: checks.length,
      checks,
      pageResults,
      badLinks,
      runtimeErrors,
      jsdomLimitations,
    };
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");
    console.log(
      JSON.stringify(
        {
          status: result.status,
          routes: result.routeCount,
          checks: result.checkCount,
          failed: failures,
          runtimeErrors,
          jsdomLimitations: jsdomLimitations.length,
          results: path.relative(project, outputPath),
        },
        null,
        2,
      ),
    );
    if (failures.length) process.exitCode = 1;
  });
