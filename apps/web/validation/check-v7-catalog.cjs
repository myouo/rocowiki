/**
 * V7 catalog and conditional matchup vote interaction checks.
 * Run from any working directory: node validation/check-v7-catalog.cjs
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
const outputPath = path.join(__dirname, "v7-catalog-check-results.json");
const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "roco-wiki-v7-catalog-"),
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
    stdin: {
      contents:
        'export * from "./src/wiki/CatalogPages.jsx"; export * from "./src/wiki/counterVoteState.js"; export * from "./src/wiki/editing/publishedRecords.js"; export {default as CounterVotes} from "./src/wiki/CounterVotes.jsx";',
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
              contents: args.path.endsWith("/useBrokenLinks") ? "export default function useBrokenLinks(){return {collectAnchor(value){if(value)globalThis.__rocoAnchorSet?.add(value)},collectLink(){}};}" : args.path.endsWith("/Link")
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
    "Editing a skill from a pet pool returns to that same pool",
    new URL(
      d.querySelector('#skills a[href*="mode=skill"]').href,
    ).searchParams.get("returnTo") === "/pets/haifu/#skills",
  );
  check(
    "Haifu acquisition timeline uses two real activity periods",
    d.querySelectorAll(".rw-acquisition-timeline-v6 > li").length === 2 &&
      d.querySelector('time[datetime="2023-02-10"]') &&
      d.querySelector('time[datetime="2024-08-01"]'),
  );
  check(
    "Pet Counter is PVP only with explicit dates and evidence",
    d.querySelectorAll(".rw-matchup-card-v7").length === 2 &&
      !d.querySelector("#matchups").textContent.includes("PVE") &&
      d
        .querySelector(".rw-counter-record-meta-v7")
        .textContent.includes("本站待复现") &&
      d.querySelector(".rw-counter-evidence-v7 a"),
  );
  check(
    "Both known and unspecified entry scenes are honestly identified",
    [...d.querySelectorAll(".rw-counter-scene-badge-v7")]
      .map((x) => x.textContent)
      .join("|") === "出场情形待补|先在场",
  );
  check(
    "The three scene definitions use the current pet's point of view",
    d
      .querySelector(".rw-counter-scene-guide-v7")
      .textContent.includes("我方后上") &&
      d.querySelector(".rw-matchup-intro-v7").textContent.includes("海芙约忒"),
  );
  check(
    "Fresh Counter cards display zero-sample text instead of a fabricated percentage",
    d.querySelectorAll(".rw-counter-vote-rate-v7").length === 2 &&
      [...d.querySelectorAll(".rw-counter-vote-rate-v7")].every(
        (x) => x.textContent === "暂无投票",
      ),
  );
  check(
    "Acquisition rows expose prefilled edit links and add another period action",
    d.querySelectorAll('.rw-acquisition-title-v6 a[href*="record="]').length ===
      2 &&
      d.querySelector('.rw-acquisition-v6 a[href*="intent=add"]') &&
      d.querySelector(".rw-acquisition-v6").textContent.includes("获得"),
  );
  const firstCard = () => d.querySelector(".rw-matchup-card-v7");
  const voteButtons = () =>
    firstCard().querySelectorAll(".rw-counter-vote-buttons-v7 button");
  await click(voteButtons()[0]);
  check(
    "Visitor support vote is counted and marked pressed",
    voteButtons()[0].getAttribute("aria-pressed") === "true" &&
      firstCard()
        .querySelector(".rw-counter-vote-rate-v7")
        .textContent.includes("100%") &&
      firstCard()
        .querySelector(".rw-counter-vote-rate-v7")
        .textContent.includes("1 票"),
  );
  check(
    "A vote on one matchup cannot change another matchup's totals",
    d.querySelectorAll(".rw-counter-vote-rate-v7")[1].textContent ===
      "暂无投票",
  );
  await click(voteButtons()[1]);
  check(
    "Switching support to opposition keeps one vote and shows 0 percent",
    voteButtons()[1].getAttribute("aria-pressed") === "true" &&
      firstCard()
        .querySelector(".rw-counter-vote-rate-v7")
        .textContent.includes("0%") &&
      firstCard()
        .querySelector(".rw-counter-vote-rate-v7")
        .textContent.includes("1 票") &&
      !firstCard()
        .querySelector(".rw-counter-vote-rate-v7")
        .textContent.includes("100%"),
  );
  await click(voteButtons()[1]);
  check(
    "Repeating the selected vote withdraws it and restores the empty sample state",
    firstCard().querySelector(".rw-counter-vote-rate-v7").textContent ===
      "暂无投票" &&
      [...voteButtons()].every(
        (x) => x.getAttribute("aria-pressed") === "false",
      ),
  );
  await click(voteButtons()[0]);
  await render(C.PetPage, { slug: "haifu" }, "/pets/haifu/");
  check(
    "Visitor identity and vote survive a component remount",
    voteButtons()[0].getAttribute("aria-pressed") === "true" &&
      firstCard()
        .querySelector(".rw-counter-vote-rate-v7")
        .textContent.includes("1 票"),
  );
  await click(
    [...d.querySelectorAll(".rw-counter-scenes-v7 button")].find((x) =>
      x.textContent.startsWith("先在场"),
    ),
  );
  check(
    "Scene filtering shows only the sourced already-active matchup",
    d.querySelectorAll(".rw-matchup-card-v7").length === 1 &&
      firstCard().textContent.includes("混沌石王") &&
      !firstCard().textContent.includes("海芙约忒（内战）"),
  );
  await click(
    [...d.querySelectorAll(".rw-counter-scenes-v7 button")].find((x) =>
      x.textContent.startsWith("同起"),
    ),
  );
  check(
    "A missing scene gets an actionable empty state without inventing records",
    !d.querySelector(".rw-matchup-card-v7") &&
      d.querySelector('.rw-matchup-empty-v7 a[href*="intent=add"]'),
  );
  await render(C.PetPage, { slug: "bishui" }, "/pets/bishui/");
  check(
    "Bishui Counter has no PVE record or reverse PVE guide link",
    !d.querySelector("#matchups").textContent.includes("傲凌冰龙王") &&
      !d.querySelector("#matchups").textContent.includes("PVE") &&
      d.querySelector(".rw-matchup-empty-v7") &&
      !d.querySelector('a[href="/challenges/"]'),
  );
  check(
    "All pet metadata removes the old PVE Counter field and migrated history is preserved",
    Object.values(meta.pets).every((p) => !("pve" in p.matchups)) &&
      JSON.parse(
        fs.readFileSync(project + "/content/pve-pet-recommendations-v7.json"),
      ).records.length === 2,
  );
  const mirror = meta.pets.haifu.matchups.pvp[0];
  const key = C.counterClaimKey("haifu", mirror);
  const guest = "guest:one";
  let local = C.toggleCounterVote(
    C.emptyCounterVotes(),
    key,
    guest,
    1,
    "2026-10-10T12:00:00Z",
  );
  check(
    "A changed scene starts an independent vote pool",
    C.counterClaimKey("haifu", { ...mirror, scene: "lead-together" }) !== key &&
      C.counterVoteSummary(
        local,
        C.counterClaimKey("haifu", { ...mirror, scene: "lead-together" }),
        guest,
      ).total === 0,
  );
  check(
    "Changing conclusion or revision cannot inherit votes for the old statement",
    C.counterClaimKey("haifu", { ...mirror, conclusion: "changed" }) !== key &&
      C.counterClaimKey("haifu", { ...mirror, claimRevision: "r2" }) !== key,
  );
  check(
    "A stable unchanged claim produces the same vote key",
    C.counterClaimKey("haifu", JSON.parse(JSON.stringify(mirror))) === key,
  );
  check(
    "Explicit account IDs are distinct from display nicknames and guest identity",
    C.counterVoter({ authenticatedUserId: "account-42", guestId: guest }) ===
      "user:account-42" &&
      C.counterVoter({ guestId: guest }) === guest &&
      C.counterVoter({ guestId: "nickname" }) === null,
  );
  const migrated = C.adoptVisitorCounterVotes(local, guest, "user:account-42");
  check(
    "Signing in can adopt a guest ballot exactly once",
    C.counterVoteSummary(migrated, key, "user:account-42").total === 1 &&
      C.counterVoteSummary(migrated, key, "user:account-42").choice === 1 &&
      C.counterVoteSummary(migrated, key, guest).choice === 0,
  );
  local = C.toggleCounterVote(local, key, "user:account-42", -1);
  const deduplicated = C.adoptVisitorCounterVotes(
    local,
    guest,
    "user:account-42",
  );
  check(
    "Existing account ballot wins over guest ballot without double counting",
    C.counterVoteSummary(deduplicated, key, "user:account-42").total === 1 &&
      C.counterVoteSummary(deduplicated, key, "user:account-42").choice === -1,
  );
  const corrupt = {
    schemaVersion: 1,
    votes: {
      [key]: {
        "guest:valid": { choice: 1 },
        "guest:bad": { choice: 999 },
        impostor: { choice: -1 },
      },
    },
  };
  check(
    "Malformed saved vote choices and identities are discarded",
    C.counterVoteSummary(C.normalizeCounterVotes(corrupt), key, "guest:valid")
      .total === 1 &&
      Object.keys(
        C.normalizeCounterVotes({ schemaVersion: 999, votes: corrupt.votes })
          .votes,
      ).length === 0,
  );
  check(
    "Prototype-like keys cannot create a valid ballot target",
    Object.keys(
      C.normalizeCounterVotes(
        JSON.parse(
          '{"schemaVersion":1,"votes":{"__proto__":{"guest:one":{"choice":1}}}}',
        ),
      ).votes,
    ).length === 0,
  );
  w.localStorage.setItem(C.COUNTER_VOTE_KEY, "broken-json");
  await render(
    C.CounterVotes,
    { petSlug: "haifu", record: mirror },
    "/pets/haifu/",
  );
  check(
    "Corrupt local JSON degrades to an operable empty vote card",
    d.querySelector(".rw-counter-vote-rate-v7").textContent === "暂无投票" &&
      !d.querySelector(".rw-counter-vote-buttons-v7 button").disabled,
  );
  await click(d.querySelector(".rw-counter-vote-buttons-v7 button"));
  check(
    "A new vote repairs a corrupt store without a runtime error",
    d.querySelector(".rw-counter-vote-rate-v7").textContent.includes("1 票") &&
      JSON.parse(w.localStorage.getItem(C.COUNTER_VOTE_KEY)).schemaVersion ===
        1,
  );
  const storageDescriptor = Object.getOwnPropertyDescriptor(w, "localStorage");
  Object.defineProperty(w, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Blocked storage");
    },
  });
  await render(
    C.CounterVotes,
    { petSlug: "haifu", record: mirror },
    "/pets/haifu/",
  );
  await click(d.querySelector(".rw-counter-vote-buttons-v7 button"));
  check(
    "Blocked storage keeps voting functional and explains session-only persistence",
    d.querySelector(".rw-counter-vote-rate-v7").textContent.includes("1 票") &&
      d
        .querySelector(".rw-counter-vote-message-v7")
        .textContent.includes("当前会话"),
  );
  Object.defineProperty(w, "localStorage", storageDescriptor);

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
    "Every displayed skill condition has a dedicated branch editor",
    d.querySelectorAll('.rw-skill-branch-v6 a[href*="record=branch-"]')
      .length === 2 &&
      d.querySelector('.rw-common-rule a[href*="record=base"]'),
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
    "Skills table ends with description and does not append hit-rule badges",
    [...d.querySelectorAll(".rw-skill-table th")].at(-1).textContent ===
      "技能描述" && !d.querySelector(".rw-skill-table .rw-hit"),
  );
  check(
    "Skill rows and the catalog expose direct edit and add actions",
    d.querySelectorAll('.rw-skill-name-top-v7 a[href*="mode=skill"]').length >
      0 && d.querySelector('.rw-pagehead a[href*="intent=add"]'),
  );
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
  const brokenRecords = C.resolvePublishedRecords({
    entity: "海芙约忒",
    mode: "matchup",
    records: [
      {
        id: "bad",
        opponent: { bad: true },
        conditions: [{}, "valid condition"],
        scene: "wrong",
        relatedSkills: "wrong",
      },
    ],
    submissions: [],
  }).records;
  check(
    "Malformed saved record fields normalize before rendering",
    brokenRecords[0].opponent === "" &&
      brokenRecords[0].conditions.length === 1 &&
      brokenRecords[0].scene === "unspecified" &&
      brokenRecords[0].relatedSkills.length === 0,
  );
  const originalAcquisition = meta.pets.haifu.acquisitionHistory;
  const publication = (
    id,
    mode,
    typedRecords,
    request = {},
    updatedAt = "2026-10-10T12:00:00Z",
  ) => ({
    id,
    editorVersion: 7,
    editorMode: mode,
    target: "海芙约忒",
    status: "published",
    updatedAt,
    editorRequest: {
      entity: "海芙约忒",
      mode,
      section: mode === "matchup" ? "对位 Counter" : "获取时间线",
      intent: "edit",
      ...request,
    },
    typedData: { records: typedRecords },
  });
  const changedAcquisition = {
    ...originalAcquisition[0],
    conditions: "本机流程示例：补充兑换条件",
  };
  const rowEdit = publication("row-edit", "acquisition", [changedAcquisition], {
    record: originalAcquisition[0].id,
  });
  const resolvedRow = C.resolvePublishedRecords({
    entity: "海芙约忒",
    mode: "acquisition",
    records: originalAcquisition,
    submissions: [rowEdit],
  });
  check(
    "Publishing a single acquisition edits only that record",
    resolvedRow.records.length === 2 &&
      resolvedRow.records[0].conditions === changedAcquisition.conditions &&
      resolvedRow.records[1].id === originalAcquisition[1].id &&
      resolvedRow.revision === "row-edit",
  );
  const anotherVisit = {
    ...originalAcquisition[0],
    id: "future-local-example",
    startDate: "2027-07-02",
    endDate: "2027-07-29",
  };
  const addedVisit = publication(
    "another-visit",
    "acquisition",
    [anotherVisit],
    { intent: "add" },
    "2026-10-10T12:10:00Z",
  );
  const visits = C.resolvePublishedRecords({
    entity: "海芙约忒",
    mode: "acquisition",
    records: originalAcquisition,
    submissions: [addedVisit, rowEdit],
  });
  check(
    "Adding another occurrence of the same activity preserves previous openings and row edits",
    visits.records.length === 3 &&
      visits.records.filter((row) => row.title === anotherVisit.title)
        .length === 2 &&
      visits.records[0].conditions === changedAcquisition.conditions &&
      visits.publishedAt === addedVisit.updatedAt,
  );
  const pending = { ...addedVisit, status: "pending" };
  const otherPet = {
    ...addedVisit,
    editorRequest: { ...addedVisit.editorRequest, entity: "碧水灵兽" },
  };
  check(
    "Pending and unrelated publications never leak into another pet's records",
    C.resolvePublishedRecords({
      entity: "海芙约忒",
      mode: "acquisition",
      records: originalAcquisition,
      submissions: [pending, otherPet],
    }).records.length === 2,
  );
  const whole = publication(
    "whole-section",
    "acquisition",
    [originalAcquisition[1]],
    {},
    "2026-10-10T12:20:00Z",
  );
  check(
    "A later whole-section replacement is applied after earlier row additions",
    C.resolvePublishedRecords({
      entity: "海芙约忒",
      mode: "acquisition",
      records: originalAcquisition,
      submissions: [whole, addedVisit, rowEdit],
    }).records.length === 1,
  );
  const deleted = publication("delete-one", "acquisition", [], {
    record: originalAcquisition[0].id,
  });
  check(
    "An explicit empty row publication removes only its addressed record",
    C.resolvePublishedRecords({
      entity: "海芙约忒",
      mode: "acquisition",
      records: originalAcquisition,
      submissions: [deleted],
    }).records[0].id === originalAcquisition[1].id,
  );
  const counterEdited = {
    ...mirror,
    conclusion: "本机流程示例：修订后的条件对位结论。",
    conditions: mirror.conditions.join("\n"),
  };
  const matchupPublication = publication(
    "counter-row-edit",
    "matchup",
    [counterEdited],
    { record: mirror.id },
  );
  const resolvedCounter = C.resolvePublishedRecords({
    entity: "海芙约忒",
    mode: "matchup",
    records: meta.pets.haifu.matchups.pvp,
    submissions: [matchupPublication],
  });
  check(
    "A published changed Counter claim receives a new revision while other claims retain their votes",
    resolvedCounter.records[0].claimRevision.startsWith(
      "local-counter-row-edit-",
    ) &&
      resolvedCounter.records[1].claimRevision ===
        meta.pets.haifu.matchups.pvp[1].claimRevision,
  );
  const equivalent = publication(
    "unchanged-row",
    "matchup",
    [{ ...mirror, conditions: mirror.conditions.join("\n") }],
    { record: mirror.id },
  );
  check(
    "String and array representations of unchanged conditions keep the same claim revision",
    C.resolvePublishedRecords({
      entity: "海芙约忒",
      mode: "matchup",
      records: meta.pets.haifu.matchups.pvp,
      submissions: [equivalent],
    }).records[0].claimRevision === mirror.claimRevision,
  );
  const originalStone = meta.pets.haifu.matchups.pvp[1];
  const boundStone = C.resolvePublishedRecords({
    entity: "海芙约忒",
    mode: "matchup",
    records: meta.pets.haifu.matchups.pvp,
    submissions: [],
  }).records[1];
  check(
    "Bundled explicit scene wording remains bound to the original entry scenario",
    boundStone.sceneDirectionFor === "already-active" &&
      C.counterSceneDescription("海芙约忒", boundStone) ===
        originalStone.sceneDirection,
  );
  const changedScene = {
    ...boundStone,
    scene: "switch-in",
    conditions: ["本机流程示例：海芙约忒后上，混沌石王已经在场。"],
  };
  const scenePublication = publication(
    "counter-scene-edit",
    "matchup",
    [changedScene],
    { record: originalStone.id },
  );
  const resolvedScene = C.resolvePublishedRecords({
    entity: "海芙约忒",
    mode: "matchup",
    records: meta.pets.haifu.matchups.pvp,
    submissions: [scenePublication],
  }).records[1];
  check(
    "Changing a scene clears its stale hidden direction wording and advances the claim revision",
    resolvedScene.sceneDirection === "" &&
      resolvedScene.sceneDirectionFor === "switch-in" &&
      resolvedScene.claimRevision.startsWith("local-counter-scene-edit-") &&
      C.counterSceneDescription("海芙约忒", resolvedScene) ===
        "海芙约忒后上，拦截已在场的混沌石王。",
  );
  const compatibleScene = C.resolvePublishedRecords({
    entity: "海芙约忒",
    mode: "matchup",
    records: meta.pets.haifu.matchups.pvp,
    submissions: [
      publication("counter-same-scene", "matchup", [boundStone], {
        record: boundStone.id,
      }),
    ],
  }).records[1];
  check(
    "Publishing an unchanged scenario retains its explicit wording and existing vote revision",
    compatibleScene.sceneDirection === originalStone.sceneDirection &&
      compatibleScene.claimRevision === originalStone.claimRevision,
  );
  const noId = publication(
    "new-entry",
    "acquisition",
    [{ title: "local-entry" }],
    { intent: "add" },
  );
  check(
    "New rows without IDs receive deterministic local IDs",
    C.resolvePublishedRecords({
      entity: "海芙约忒",
      mode: "acquisition",
      records: [],
      submissions: [noId],
    }).records[0].id === "local-new-entry-1",
  );
  w.localStorage.setItem(
    "roco-wiki-v4:community",
    JSON.stringify({ submissions: [rowEdit, addedVisit, matchupPublication] }),
  );
  await render(C.PetPage, { slug: "haifu" }, "/pets/haifu/");
  check(
    "Published acquisitions appear in the reading timeline immediately on remount",
    d.querySelectorAll(".rw-acquisition-timeline-v6 > li").length === 3 &&
      d
        .querySelector(".rw-acquisition-v6")
        .textContent.includes(changedAcquisition.conditions) &&
      d.querySelector(".rw-acquisition-v6 .rw-catalog-local-revision-v7"),
  );
  check(
    "Published Counter text is actually rendered and starts its own zero-vote pool",
    firstCard().textContent.includes(counterEdited.conclusion) &&
      firstCard().querySelector(".rw-counter-vote-rate-v7").textContent ===
        "暂无投票" &&
      d.querySelector(".rw-matchups-v7 .rw-catalog-local-revision-v7"),
  );
  w.localStorage.removeItem("roco-wiki-v4:community");
  await act(async () => w.dispatchEvent(new w.Event("roco:community-updated")));
  check(
    "Publication events refresh the reading view without a full reload",
    d.querySelectorAll(".rw-acquisition-timeline-v6 > li").length === 2 &&
      !firstCard().textContent.includes(counterEdited.conclusion),
  );
  const stoneCard = () =>
    [...d.querySelectorAll(".rw-matchup-card-v7")].find((card) =>
      card
        .querySelector(".rw-matchup-opponent-v7 h4")
        .textContent.includes("混沌石王"),
    );
  await click(stoneCard().querySelector(".rw-counter-vote-buttons-v7 button"));
  const previousStoneVoteMessage = stoneCard().querySelector(
    ".rw-counter-vote-message-v7",
  ).textContent;
  const previousStoneVoteKey = stoneCard()
    .querySelector(".rw-counter-vote-v7")
    .getAttribute("data-claim-key");
  const previousVisitor = w.localStorage.getItem(C.COUNTER_VISITOR_KEY);
  w.localStorage.setItem(
    "roco-wiki-v4:community",
    JSON.stringify({ submissions: [scenePublication] }),
  );
  await act(async () => w.dispatchEvent(new w.Event("roco:community-updated")));
  check(
    "A published scene switch renders the matching badge and current-pet direction without stale wording",
    stoneCard().querySelector(".rw-counter-scene-badge-v7").textContent ===
      "后上拦截" &&
      stoneCard().querySelector(".rw-counter-scene-direction-v7")
        .textContent === "海芙约忒后上，拦截已在场的混沌石王。" &&
      !stoneCard().textContent.includes(originalStone.sceneDirection),
  );
  check(
    "The scene revision starts a fresh rendered vote pool while preserving the visitor identity",
    stoneCard().querySelector(".rw-counter-vote-rate-v7").textContent ===
      "暂无投票" &&
      [
        ...stoneCard().querySelectorAll(".rw-counter-vote-buttons-v7 button"),
      ].every((button) => button.getAttribute("aria-pressed") === "false") &&
      stoneCard()
        .querySelector(".rw-counter-vote-v7")
        .getAttribute("data-claim-key") !== previousStoneVoteKey &&
      w.localStorage.getItem(C.COUNTER_VISITOR_KEY) === previousVisitor,
  );
  check(
    "Publishing a different scenario clears the previous claim's support confirmation",
    previousStoneVoteMessage.includes("已支持这条对位结论") &&
      stoneCard().querySelector(".rw-counter-vote-message-v7").textContent ===
        "",
  );
  w.localStorage.removeItem("roco-wiki-v4:community");
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
    "src/wiki/CatalogV7.css",
    "src/wiki/CounterVotes.jsx",
    "src/wiki/counterVoteState.js",
    "src/wiki/skillPresentation.js",
    "src/wiki/editing/publishedRecords.js",
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
      !failure && checks.length >= 55 && checks.every((check) => check.pass)
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
