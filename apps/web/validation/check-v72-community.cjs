/** Community accounting, identity migration, period definitions and real account interactions. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash, webcrypto } = require("node:crypto");
const project = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "roco-v72-community-"));
const bundle = path.join(temporary, "suite.cjs");
const esbuild = require(require.resolve("esbuild", { paths: [project] }));
const React = require(require.resolve("react", { paths: [project] }));
const { JSDOM } = require(require.resolve("jsdom", { paths: [project] }));
const checks = [], errors = [];
const originalError = console.error;
console.error = (...args) => errors.push(args.map(String).join(" "));
const check = (label, value) => { checks.push({ label, pass: Boolean(value) }); assert.ok(value, label); };
const A = "20000000-0000-4000-8000-000000000001", B = "20000000-0000-4000-8000-000000000002", C = "20000000-0000-4000-8000-000000000003";
let dom, root;
class MemoryStorage {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); this.failWrite = false; }
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { if (this.failWrite) throw new Error("QuotaExceededError"); this.values.set(key, value); }
}

async function main() {
  await esbuild.build({
    stdin: { contents: 'export * from "./src/wiki/communitySocialModel.js"; export * from "./src/wiki/communitySocialStore.js"; export {default as CommunityPages} from "./src/wiki/CommunityPages.jsx"; export {HeaderProfileAvatar} from "./src/wiki/AccountIdentity.jsx";', resolveDir: project, loader: "jsx" },
    outfile: bundle, bundle: true, format: "cjs", platform: "node", loader: { ".css": "empty" }, logLevel: "silent",
    plugins: [{ name: "local-ui-environment", setup(build) {
      build.onResolve({ filter: /^(react|react-dom|lucide-react)(\/.*)?$/ }, args => ({ path: require.resolve(args.path, { paths: [project] }), external: true }));
      build.onResolve({ filter: /^@docusaurus\// }, args => ({ path: args.path, namespace: "docusaurus-stub" }));
      build.onLoad({ filter: /.*/, namespace: "docusaurus-stub" }, args => ({ loader: "jsx", resolveDir: project, contents: args.path.endsWith("/useBrokenLinks") ? "export default function useBrokenLinks(){return {collectAnchor(){},collectLink(){}};}" : args.path.endsWith("/Link")
        ? 'import React from "react"; export default function Link({to,children,...rest}) { return <a href={to} {...rest}>{children}</a>; }'
        : args.path.endsWith("/useBaseUrl") ? "export default function useBaseUrl(value){return value;}"
        : 'import React from "react"; const read=()=>({pathname:window.location.pathname,search:window.location.search,hash:window.location.hash}); export function useLocation(){const [value,set]=React.useState(read);React.useEffect(()=>{const update=()=>set(read());window.addEventListener("test-route",update);return()=>window.removeEventListener("test-route",update)},[]);return value;} export function useHistory(){return {replace(url){window.history.replaceState({},"",url);window.dispatchEvent(new window.Event("test-route"))},push(url){window.history.pushState({},"",url);window.dispatchEvent(new window.Event("test-route"))}};}' }));
    } }],
  });
  const M = require(bundle);
  const identity = { uuid: A, nickname: "验证编辑者", avatar: "dimo" };
  const action = (state, payload, at, who = identity, submissions = []) => M.applySocialAction(state, payload, { identity: who, now: at, submissions, uuidFactory: () => C });
  check("Beijing day changes exactly at 16:00 UTC", M.chinaDay("2026-10-10T15:59:59Z") === "2026-10-10" && M.chinaDay("2026-10-10T16:00:00Z") === "2026-10-11");
  check("Week starts on Monday in Beijing, including a UTC Sunday boundary", M.periodBounds("week", "2026-10-11T15:59:59Z").start === "2026-10-05" && M.periodBounds("week", "2026-10-11T16:00:00Z").start === "2026-10-12");
  check("Month rollover is determined in Beijing", M.periodBounds("month", "2026-10-31T15:59:59Z").start === "2026-10-01" && M.periodBounds("month", "2026-10-31T16:00:00Z").start === "2026-11-01");
  check("Leap-day calculation retains February 29", M.addDays("2028-02-28", 1) === "2028-02-29" && M.periodBounds("month", "2028-02-29T03:00:00Z").end === "2028-03-01");
  const generated = M.createUuid(webcrypto);
  check("Generated profile identity is a real UUID", M.UUID_RE.test(generated));
  const legacyStorage = new MemoryStorage({ [M.COMMUNITY_STORAGE_KEY]: JSON.stringify({ version: 1, profile: { nickname: "旧名字", avatar: "haifu" }, drafts: [{ key: "keep" }], submissions: [{ id: "legacy", author: "旧名字" }] }) });
  let uuidCalls = 0;
  const migrated = M.readLocalIdentity({ storage: legacyStorage, uuidFactory: () => { uuidCalls++; return A; } });
  const savedMigration = JSON.parse(legacyStorage.getItem(M.COMMUNITY_STORAGE_KEY));
  check("A legacy profile receives a durable UUID without losing drafts", migrated.uuid === A && migrated.persisted && savedMigration.drafts[0].key === "keep" && savedMigration.profile.nickname === "旧名字");
  savedMigration.profile.nickname = "新名字";
  legacyStorage.setItem(M.COMMUNITY_STORAGE_KEY, JSON.stringify(savedMigration));
  check("Renaming a profile does not replace its UUID", M.readLocalIdentity({ storage: legacyStorage, uuidFactory: () => { uuidCalls++; return B; } }).uuid === A && uuidCalls === 1);
  check("Migration does not guess legacy submission authors from matching nicknames", !JSON.parse(legacyStorage.getItem(M.COMMUNITY_STORAGE_KEY)).submissions[0].authorId && M.getSubmissionAuthorIdentity(savedMigration.submissions[0]) === null);
  const denied = new MemoryStorage(); denied.failWrite = true;
  check("Failed UUID persistence cannot claim a durable account identity", !M.readLocalIdentity({ storage: denied, uuidFactory: () => A }).persisted && denied.values.size === 0);
  const migrationDenied = new MemoryStorage({ [M.COMMUNITY_STORAGE_KEY]: JSON.stringify({ version: 1, profile: { nickname: "保留旧资料", avatar: "haifu" } }) });
  migrationDenied.failWrite = true;
  const readableLegacy = M.readLocalIdentity({ storage: migrationDenied, uuidFactory: () => A });
  check("Storage failure during UUID migration preserves the readable old profile", readableLegacy.nickname === "保留旧资料" && readableLegacy.avatar === "haifu" && !readableLegacy.persisted && !readableLegacy.uuid);

  let state = M.emptySocialState();
  check("An unknown identity cannot earn currency", !M.applySocialAction(state, { type: "check-in" }, { identity: { uuid: "nickname" }, now: "2026-10-10T00:00:00Z" }).ok);
  const insufficient = action(state, { type: "redeem", itemId: "badge-first" }, "2026-10-01T01:00:00Z");
  check("Insufficient balance prevents both purchase and debit", insufficient.code === "insufficient-balance" && !insufficient.state.purchases.length && !insufficient.state.ledger.length);
  const first = action(state, { type: "check-in" }, "2026-10-01T01:00:00Z");
  state = first.state;
  check("First check-in adds exactly one day and one five-token ledger entry", first.ok && first.result.amount === 5 && M.walletBalance(state, A) === 5 && state.checkins.length === 1 && state.ledger.length === 1);
  const duplicate = action(state, { type: "check-in" }, "2026-10-01T15:59:59Z");
  check("Repeated same-day check-in is idempotent", duplicate.code === "already-checked" && M.walletBalance(duplicate.state, A) === 5 && duplicate.state.checkins.length === 1);
  const redeemed = action(state, { type: "redeem", itemId: "badge-first" }, "2026-10-01T03:00:00Z");
  check("First-day check-in can fund a complete badge redemption", redeemed.ok && M.walletBalance(redeemed.state, A) === 0 && redeemed.state.purchases.length === 1 && redeemed.state.ledger.at(-1).amount === -5);
  const repeatedRedemption = action(redeemed.state, { type: "redeem", itemId: "badge-first" }, "2026-10-01T04:00:00Z");
  check("Owned cosmetic items cannot charge the wallet again", repeatedRedemption.code === "already-owned" && repeatedRedemption.state.ledger.length === 2);
  const equipped = action(redeemed.state, { type: "equip", slot: "badge", itemId: "badge-first" }, "2026-10-01T04:00:00Z");
  check("A redeemed badge can be worn and removed without affecting money", equipped.state.equipped[A].badge === "badge-first" && action(equipped.state, { type: "equip", slot: "badge", itemId: "" }, "2026-10-01T04:01:00Z").state.equipped[A].badge === "" && M.walletBalance(equipped.state, A) === 0);
  check("Unowned cosmetics cannot be worn", action(state, { type: "equip", slot: "frame", itemId: "frame-night" }, "2026-10-01T04:00:00Z").code === "not-owned");
  check("A badge cannot be installed into the frame slot", action(redeemed.state, { type: "equip", slot: "frame", itemId: "badge-first" }, "2026-10-01T04:00:00Z").code === "invalid-slot");
  for (let day = 2; day <= 14; day++) state = action(state, { type: "check-in" }, `2026-10-${String(day).padStart(2, "0")}T01:00:00Z`).state;
  check("Seven-day bonus is awarded at day 7 and again at day 14", M.walletBalance(state, A) === 80 && state.ledger.filter(row => row.amount === 10).map(row => row.ref).join(",") === "2026-10-07,2026-10-14");
  check("Current, cumulative and longest streaks remain distinct fields", M.checkinSummary(state, A, "2026-10-14T03:00:00Z").current === 14 && M.checkinSummary(state, A, "2026-10-16T03:00:00Z").current === 0 && M.checkinSummary(state, A, "2026-10-16T03:00:00Z").total === 14);
  state = action(state, { type: "check-in" }, "2026-10-16T04:00:00Z").state;
  const afterGap = M.checkinSummary(state, A, "2026-10-16T06:00:00Z");
  check("A missed day resets current streak and preserves historical records", afterGap.current === 1 && afterGap.total === 15 && afterGap.longest === 14);
  check("Clock rollback cannot create another rewarded past day", action(state, { type: "check-in" }, "2026-10-15T01:00:00Z").code === "clock-backwards");
  check("Seven-day achievement follows a true contiguous streak", M.earnedAchievements(state, A, [], "2026-10-16T06:00:00Z").some(item => item.id === "achievement-week"));

  let likesState = M.emptySocialState();
  const guide = { type: "toggle-like", targetType: "guide", targetId: "guide:one", targetTitle: "验证攻略", authorId: B, href: "/pve/" };
  likesState = action(likesState, guide, "2026-10-10T01:00:00Z").state;
  check("Guide likes credit their explicit author and remain separate from comments", M.influenceStats(likesState, B, [], "2026-10-10T02:00:00Z").guideLikes === 1 && M.influenceStats(likesState, B, [], "2026-10-10T02:00:00Z").commentLikes === 0);
  check("Self-likes are rejected", action(likesState, { ...guide, authorId: A, targetId: "own-guide" }, "2026-10-10T02:00:00Z").code === "self-like");
  check("Counter support votes are not accepted by the social-like model", action(likesState, { ...guide, targetType: "counter" }, "2026-10-10T02:00:00Z").code === "invalid-target");
  likesState = action(likesState, guide, "2026-10-11T01:00:00Z").state;
  check("Withdrawing a like reverses author influence immediately", M.influenceStats(likesState, B, [], "2026-10-11T02:00:00Z").guideLikes === 0);
  likesState = action(likesState, guide, "2026-11-01T01:00:00Z").state;
  check("Reliking retains the original period instead of farming a new monthly score", likesState.likes[0].at === "2026-10-10T01:00:00.000Z" && M.rankCommunity({ state: likesState, participants: [{ uuid: B }], metric: "guideLikes", period: "month", now: "2026-11-01T02:00:00Z" }).length === 0);
  const unknownAuthor = action(likesState, { ...guide, authorId: "", targetId: "historic-guide" }, "2026-11-01T02:00:00Z");
  check("A historical guide can receive a content like without inventing an author", unknownAuthor.ok && unknownAuthor.state.likes.at(-1).authorId === "" && M.influenceStats(unknownAuthor.state, B, [], "2026-11-01T03:00:00Z").guideLikes === 1);
  const commentAdded = action(likesState, { type: "add-comment", targetId: "/pve/", body: "可复现实测记录", href: "/pve/" }, "2026-11-01T03:00:00Z", { uuid: B, nickname: "评论者", avatar: "haifu" });
  check("Comments preserve author UUID, display name and avatar", commentAdded.ok && commentAdded.result.comment.authorId === B && commentAdded.result.comment.author === "评论者" && commentAdded.result.comment.avatar === "haifu");
  const commentId = commentAdded.result.comment.id;
  const commentLiked = action(commentAdded.state, { type: "toggle-like", targetType: "comment", targetId: commentId, authorId: C }, "2026-11-01T04:00:00Z");
  check("Comment likes use the real comment author, not a caller-supplied owner", commentLiked.ok && commentLiked.state.likes.at(-1).authorId === B && M.influenceStats(commentLiked.state, B, [], "2026-11-01T05:00:00Z").commentLikes === 1);
  check("Only a comment's own author can remove it", action(commentLiked.state, { type: "delete-comment", commentId }, "2026-11-01T05:00:00Z").code === "not-comment-author");
  const commentRemoved = action(commentLiked.state, { type: "delete-comment", commentId }, "2026-11-01T06:00:00Z", { uuid: B });
  check("Removing a comment also removes its active likes", commentRemoved.ok && !commentRemoved.state.comments.length && M.influenceStats(commentRemoved.state, B, [], "2026-11-01T07:00:00Z").commentLikes === 0);

  const submission = { id: "actual-one", status: "published", authorId: A, author: "验证编辑者", before: "原文", after: "补充有意义的内容", firstPublishedAt: "2026-10-31T15:00:00Z", updatedAt: "2026-11-01T02:00:00Z" };
  const submissions = [submission, { ...submission }, { ...submission, id: "empty", after: "原文" }, { ...submission, id: "demo", isExample: true }, { ...submission, id: "unknown", authorId: "" }, { ...submission, id: "pending", status: "pending" }];
  check("Contribution count excludes duplicates, examples, no-op changes, unowned history and drafts", M.influenceStats(state, A, submissions, "2026-11-01T05:00:00Z").contributions === 1);
  check("Repeated publication stays in its original publication period", M.rankCommunity({ state, participants: [identity], submissions, metric: "contributions", period: "month", now: "2026-11-01T05:00:00Z" }).length === 0);
  check("A withdrawn publication leaves the currently effective contribution count", M.influenceStats(state, A, [{ ...submission, status: "changes_requested" }], "2026-11-01T05:00:00Z").contributions === 0);
  check("Spending check-in currency cannot decrease earned contribution influence", M.influenceStats(redeemed.state, A, [submission], "2026-11-01T05:00:00Z").contributions === 1 && M.walletBalance(redeemed.state, A) === 0);
  let rankState = M.emptySocialState();
  const participants = [{ uuid: A, nickname: "甲" }, { uuid: B, nickname: "乙" }, { uuid: C, nickname: "丙" }];
  for (const [person, days] of [[participants[0], ["2026-10-01", "2026-10-03", "2026-10-04"]], [participants[1], ["2026-10-02", "2026-10-03", "2026-10-04"]], [participants[2], ["2026-10-04"]]]) for (const day of days) rankState = action(rankState, { type: "check-in" }, `${day}T01:00:00Z`, person).state;
  const rankedDays = M.rankCommunity({ state: rankState, participants, metric: "checkins", period: "all", now: "2026-10-04T02:00:00Z" });
  check("Equal scores receive shared competition ranks 1, 1, 3", rankedDays.map(row => row.rank).join(",") === "1,1,3");
  const rankedStreak = M.rankCommunity({ state: rankState, participants, metric: "streak", period: "all", now: "2026-10-04T02:00:00Z" });
  check("Streak ranking is based on consecutive days, not check-in totals", rankedStreak[0].uuid === B && rankedStreak[0].value === 3 && rankedStreak[1].uuid === A && rankedStreak[1].value === 2);
  let acrossMonth = M.emptySocialState();
  for (const day of ["2026-10-30", "2026-10-31", "2026-11-01"]) acrossMonth = action(acrossMonth, { type: "check-in" }, `${day}T01:00:00Z`).state;
  check("A new-month streak milestone carries genuine previous-month continuity", M.rankCommunity({ state: acrossMonth, participants: [identity], metric: "streak", period: "month", now: "2026-11-01T02:00:00Z" })[0].value === 3 && M.rankCommunity({ state: acrossMonth, participants: [identity], metric: "checkins", period: "month", now: "2026-11-01T02:00:00Z" })[0].value === 1);
  check("Zero-score users are omitted without fabricated rankings", M.rankCommunity({ state: M.emptySocialState(), participants, metric: "guideLikes", period: "all", now: "2026-10-10T02:00:00Z" }).length === 0);
  const example = M.makeRankingExample("2026-11-01T00:00:00Z");
  check("Example rankings are explicit and detached from real account data", example.participants.every(row => row.nickname.startsWith("示例")) && !example.participants.some(row => row.uuid === A) && M.emptySocialState().checkins.length === 0);
  const secureStorage = new MemoryStorage({ [M.COMMUNITY_STORAGE_KEY]: JSON.stringify({ version: 1, profile: identity, submissions: [] }) });
  secureStorage.failWrite = true;
  const failedWrite = M.socialAction({ type: "check-in" }, { storage: secureStorage, now: "2026-10-10T01:00:00Z" });
  check("Failed wallet persistence does not report success or alter saved state", !failedWrite.ok && failedWrite.code === "storage-failed" && secureStorage.getItem(M.SOCIAL_STORAGE_KEY) === null);

  dom = new JSDOM('<div id="app" class="rw"></div>', { url: "https://wiki.test/account/?tab=profile", pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  Object.assign(global, { window: w, document: d, HTMLElement: w.HTMLElement, localStorage: w.localStorage, MutationObserver: w.MutationObserver, CustomEvent: w.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(global, "navigator", { value: w.navigator, configurable: true });
  w.matchMedia = () => ({matches:false,addEventListener(){},removeEventListener(){}});
  w.HTMLElement.prototype.scrollIntoView = function() {};
  w.localStorage.setItem(M.COMMUNITY_STORAGE_KEY, JSON.stringify({ version: 1, profile: { nickname: "初始昵称", avatar: "haifu", bio: "整理历史资料" }, drafts: [], submissions: [], claimedTasks: [] }));
  let copied = "";
  Object.defineProperty(w.navigator, "clipboard", { value: { async writeText(text) { copied = text; } }, configurable: true });
  const { createRoot } = require(require.resolve("react-dom/client", { paths: [project] }));
  function Harness() {
    const [location, setLocation] = React.useState(() => ({ path: w.location.pathname, search: w.location.search }));
    React.useEffect(() => { const refresh = () => setLocation({ path: w.location.pathname, search: w.location.search }); w.addEventListener("test-route", refresh); return () => w.removeEventListener("test-route", refresh); }, []);
    return React.createElement(React.Fragment, null, React.createElement("header", { className: "rw-account-link" }, React.createElement(M.HeaderProfileAvatar)), React.createElement(M.CommunityPages, { path: location.path, query: new URLSearchParams(location.search) }));
  }
  root = createRoot(d.querySelector("#app"));
  await React.act(async () => root.render(React.createElement(Harness)));
  async function click(element) { assert.ok(element, "click target exists"); await React.act(async () => element.click()); }
  async function go(url) { await React.act(async () => { w.history.pushState({}, "", url); w.dispatchEvent(new w.Event("test-route")); }); }
  const findButton = (parent, text) => [...parent.querySelectorAll("button")].find(button => button.textContent.trim() === text);
  const uiUuid = JSON.parse(w.localStorage.getItem(M.COMMUNITY_STORAGE_KEY)).profile.uuid;
  check("Actual profile screen migrates a UUID and retains old profile details", M.UUID_RE.test(uiUuid) && d.querySelector("#rw-profile-uuid").value === uiUuid && d.querySelector(".rw-account-name-v71 h2").textContent === "初始昵称");
  await click(findButton(d.querySelector(".rw-profile-serial-v72"), "复制"));
  check("Profile UUID copy uses the actual stable identifier", copied === uiUuid && d.querySelector(".rw-profile-serial-message-v72").textContent.includes("已复制"));
  const picker = d.querySelector('[role="radiogroup"]');
  await React.act(async () => { picker.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
  check("Avatar keyboard navigation remains available", d.activeElement.getAttribute("role") === "radio" && d.activeElement.getAttribute("aria-checked") === "true");
  await click(findButton(d, "保存本地资料"));
  check("Saving profile and avatar preserves the UUID", JSON.parse(w.localStorage.getItem(M.COMMUNITY_STORAGE_KEY)).profile.uuid === uiUuid && JSON.parse(w.localStorage.getItem(M.COMMUNITY_STORAGE_KEY)).profile.avatar === "bishui");
  await go("/account/");
  check("Account homepage shows distinct guide-like and comment-like influence counters", d.querySelector(".rw-influence-grid-v72").textContent.includes("攻略被点赞") && d.querySelector(".rw-influence-grid-v72").textContent.includes("评论被点赞") && [...d.querySelectorAll(".rw-influence-grid-v72 strong")].every(el => el.textContent === "0"));
  await click(d.querySelector(".rw-checkin-button-v72"));
  check("Homepage check-in saves one event and updates the live wallet", JSON.parse(w.localStorage.getItem(M.SOCIAL_STORAGE_KEY)).checkins.length === 1 && d.querySelector(".rw-checkin-button-v72").disabled && d.querySelector(".rw-wallet-teaser-v72 > strong").textContent === "5枚");
  const signed = w.localStorage.getItem(M.SOCIAL_STORAGE_KEY);
  await click(d.querySelector(".rw-checkin-button-v72"));
  check("Disabled same-day check-in cannot create duplicate rewards", w.localStorage.getItem(M.SOCIAL_STORAGE_KEY) === signed);
  await click(findButton(d.querySelector(".ev7-account-nav"), "社区荣誉"));
  check("Community honors has a clear top-level account section", w.location.search === "?tab=honors" && d.querySelector(".rw-community-honors-v72 h2").textContent === "社区荣誉");
  await click(findButton(d.querySelector(".rw-honors-tabs-v72"), "徽章与头像框"));
  check("Badge cabinet updates its deep-link URL", w.location.search.includes("view=badges") && d.querySelectorAll(".rw-honor-item-v72").length === 5);
  const firstItem = d.querySelector(".rw-honor-item-v72");
  await click(findButton(firstItem, "兑换"));
  check("The first cosmetic is redeemable in the actual UI with zero remaining balance", firstItem.textContent.includes("已拥有") && JSON.parse(w.localStorage.getItem(M.SOCIAL_STORAGE_KEY)).ledger.reduce((sum, row) => sum + row.amount, 0) === 0);
  await click(findButton(firstItem, "佩戴"));
  check("Wearing a badge updates the identity card immediately", d.querySelector(".rw-profile-honor-v72").textContent === "初见王国" && JSON.parse(w.localStorage.getItem(M.SOCIAL_STORAGE_KEY)).equipped[uiUuid].badge === "badge-first");
  await click(findButton(d.querySelector(".rw-honors-tabs-v72"), "签到与印记"));
  check("The wallet ledger exposes credit, debit and running balances", d.querySelectorAll(".rw-ledger-table-v72 tbody tr").length === 2 && d.querySelector(".rw-ledger-table-v72 .is-credit").textContent === "+5" && d.querySelector(".rw-ledger-table-v72 .is-debit").textContent === "-5");
  await go("/account/?tab=honors&view=rankings");
  check("Rankings can be opened directly by URL", d.querySelector(".rw-ranking-v72") && findButton(d.querySelector(".rw-honors-tabs-v72"), "社区榜单").getAttribute("aria-pressed") === "true");
  check("Default rankings show only the genuine local participant", d.querySelectorAll(".rw-ranking-table-v72 tbody tr").length === 1 && !d.querySelector(".rw-ranking-v72").textContent.includes("示例 · 星光"));
  const beforeExample = w.localStorage.getItem(M.SOCIAL_STORAGE_KEY);
  await click(findButton(d.querySelector(".rw-ranking-sources-v72"), "查看示例榜单"));
  check("Example rankings require an explicit switch and are visibly marked", d.querySelector(".rw-ranking-v72.is-sample") && d.querySelectorAll(".rw-ranking-table-v72 tbody tr").length === 3 && d.querySelector(".rw-ranking-v72").textContent.includes("虚构示例"));
  await click(findButton(d.querySelector(".rw-ranking-periods-v72"), "日榜"));
  check("Day/week/month/all period controls are interactive", findButton(d.querySelector(".rw-ranking-periods-v72"), "日榜").getAttribute("aria-pressed") === "true" && d.querySelectorAll(".rw-ranking-periods-v72 button").length === 4);
  check("Viewing examples never writes fabricated scores into the real account", w.localStorage.getItem(M.SOCIAL_STORAGE_KEY) === beforeExample);
  await go("/account/?tab=honors&view=badges");
  check("Returning through a deep link restores the correct honors view", d.querySelector(".rw-honor-shop-grid-v72") && !d.querySelector(".rw-ranking-v72"));
  check("Custom selection controls do not introduce native select menus", d.querySelectorAll("select").length === 0);
  const sourceFiles = ["src/wiki/CommunityPages.jsx", "src/wiki/AccountIdentity.jsx", "src/wiki/communitySocialModel.js", "src/wiki/communitySocialStore.js", "src/wiki/CommunityHonors.jsx", "src/wiki/CommunityHonors.css", "src/wiki/HonorSymbols.jsx", "content/community-ecology-v72.json"];
  check("Actual community UI rendered without React errors", errors.length === 0);
  const report = { version: "7.2", scope: "UUID migration, check-in accounting, social attribution, rankings, and actual React account interactions", generatedAt: new Date().toISOString(), total: checks.length, passed: checks.filter(row => row.pass).length, checks, errors, sourceFiles: Object.fromEntries(sourceFiles.map(file => [file, createHash("sha256").update(fs.readFileSync(path.join(project, file))).digest("hex")])) };
  fs.writeFileSync(path.join(project, "validation/v72-community-check-results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`V7.2 community: ${report.passed}/${report.total} passed`);
}
main().catch(error => { originalError(error); process.exitCode = 1; }).finally(async () => { if (root) await React.act(async () => root.unmount()); dom?.window.close(); console.error = originalError; fs.rmSync(temporary, { recursive: true, force: true }); });
