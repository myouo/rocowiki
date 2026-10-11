const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require("jsdom");

const project = path.resolve(__dirname, "..");
const output = path.join(__dirname, "v5-review-check-results.json");
const html = fs.readFileSync(project + "/RocoWiki_UI_V5.html", "utf8");
const key = "roco-wiki-v4:community";
const checks = [];
const consoleErrors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (error) => consoleErrors.push(error.message));
vc.on("error", (...args) => consoleErrors.push(args.map(String).join(" ")));

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
      for (const [storageKey, value] of Object.entries(storage))
        w.localStorage.setItem(storageKey, value);
    },
  });
}

let dom = create();
let w = dom.window;
let d = w.document;
const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const text = () => d.querySelector("main")?.textContent || "";
const workspace = () => JSON.parse(w.localStorage.getItem(key) || "null");
const submission = (id) =>
  workspace()?.submissions.find((item) => item.id === id);
const reviewStatus = () =>
  d.querySelector(".cm-review-title .cm-status")?.textContent || "";
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
}
async function go(route) {
  w.location.hash = route;
  await pause(70);
}
async function clickButton(label) {
  const button = [...d.querySelectorAll("button")].find(
    (item) =>
      item.textContent.trim() === label ||
      item.getAttribute("aria-label") === label,
  );
  assert.ok(button, "Button exists: " + label);
  button.click();
  await pause(70);
}
async function clickLink(label) {
  const link = [...d.querySelectorAll("main a")].find(
    (item) => item.textContent.trim() === label,
  );
  assert.ok(link, "Link exists: " + label);
  link.click();
  await pause(70);
}
async function setValue(element, value) {
  assert.ok(element, "Form field exists");
  const prototype =
    element.tagName === "SELECT"
      ? w.HTMLSelectElement.prototype
      : element.tagName === "TEXTAREA"
        ? w.HTMLTextAreaElement.prototype
        : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
  element.dispatchEvent(
    new w.Event(element.tagName === "SELECT" ? "change" : "input", {
      bubbles: true,
    }),
  );
  await pause(70);
}
async function refreshPreservingStorage(route) {
  const storage = {};
  for (let index = 0; index < w.localStorage.length; index++) {
    const storageKey = w.localStorage.key(index);
    storage[storageKey] = w.localStorage.getItem(storageKey);
  }
  dom.window.close();
  dom = create(storage);
  w = dom.window;
  d = w.document;
  await pause(130);
  await go(route);
}

async function run() {
  await pause(130);

  // Flow A: the seeded demonstration goes through each distinct publishing stage.
  await go("/review/?submission=demo-001");
  check(
    "Seed review explicitly identifies its submission as a demonstration",
    text().includes("系统演示投稿") && text().includes("本地交互原型"),
  );
  check(
    "Pending review renders its evidence and actual content difference",
    reviewStatus().includes("待审核") &&
      !!d.querySelector(".cm-review-evidence") &&
      d.querySelectorAll(".cm-diff-add").length > 0,
  );
  await clickButton("本地批准");
  check(
    "Approval persists as approved and does not skip the merge stage",
    submission("demo-001").status === "approved" &&
      reviewStatus().includes("待合并"),
  );
  check(
    "Reviewer UI requires switching to the publishing role for merge actions",
    ![...d.querySelectorAll("button")].some(
      (item) => item.textContent.trim() === "模拟合并",
    ) && text().includes("发布维护者"),
  );
  await setValue(d.querySelector("#cm-review-role"), "maintainer");
  await clickButton("模拟合并");
  check(
    "Merge persists independently from build and publication",
    submission("demo-001").status === "merged" &&
      reviewStatus().includes("待构建"),
  );
  await clickButton("模拟开始构建");
  check(
    "Starting a build moves the stored and visible state to building",
    submission("demo-001").status === "building" &&
      reviewStatus().includes("构建中"),
  );
  await clickButton("模拟构建失败");
  check(
    "Failed build retains the submission and displays the error explanation",
    submission("demo-001").status === "build_failed" &&
      !!d.querySelector(".cm-build-error") &&
      text().includes("新增引用未通过检查"),
  );
  await clickButton("模拟修复后重试");
  check(
    "Retry returns to building while retaining the failed build event",
    submission("demo-001").status === "building" &&
      submission("demo-001").events.some((event) =>
        event.label.includes("构建失败"),
      ),
  );
  await clickButton("模拟构建成功");
  check(
    "Successful build waits for a separate publication action",
    submission("demo-001").status === "built" &&
      reviewStatus().includes("待发布"),
  );
  await clickButton("模拟发布上线");
  check(
    "Publication persists as published and visibly remains a local demonstration",
    submission("demo-001").status === "published" &&
      !!d.querySelector(".cm-published-result") &&
      text().includes("真实站点和仓库尚未发生变化"),
  );
  check(
    "Audit trail retains approval, merge, failure, retry, build success, and publication events",
    ["审核通过", "普通合并", "构建失败", "重试", "构建成功", "发布流程"].every(
      (needle) =>
        submission("demo-001").events.some((event) =>
          event.label.includes(needle),
        ),
    ),
  );
  await clickLink("查看本地修订记录");
  check(
    "Published submission appears in the correct entity history",
    w.location.hash.includes("/history/") &&
      d
        .querySelector(".cm-version-list")
        ?.textContent.includes("本地修订 · demo-001"),
  );
  d.querySelector(".cm-local-filter input").click();
  await pause(70);
  check(
    "Only-local history includes the published demo submission and excludes static sample versions",
    d.querySelectorAll(".cm-version-list article").length === 1 &&
      d
        .querySelector(".cm-version-list article")
        ?.textContent.includes("demo-001"),
  );
  await refreshPreservingStorage("/review/?submission=demo-001");
  check(
    "Published state and its audit history survive a fresh DOM instance with persisted browser storage",
    submission("demo-001").status === "published" &&
      reviewStatus().includes("本地演示") &&
      d.querySelectorAll(".cm-events li").length >= 8,
  );

  // Flow B: validation and requested changes, then a merge conflict and resubmission.
  await go(
    "/edit/?entity=" +
      encodeURIComponent("海芙约忒") +
      "&section=" +
      encodeURIComponent("机制解析"),
  );
  await clickButton("填入演示内容");
  await clickButton("提交本地审核");
  const local = workspace().submissions.find(
    (item) => !item.isExample && item.target === "海芙约忒",
  );
  assert.ok(local, "New local submission was created");
  const localId = local.id;
  await clickLink("查看并体验审核");
  check(
    "Editor success link opens the exact newly created submission",
    w.location.hash.includes(localId) &&
      d.querySelector(".cm-review-title")?.textContent.includes(localId),
  );
  await clickButton("退回需修改");
  check(
    "Returning a submission without a reason is blocked with an inline validation error",
    submission(localId).status === "pending" &&
      !!d.querySelector('.cm-review-actions textarea[aria-invalid="true"]') &&
      text().includes("至少 6 个字符"),
  );
  const reason = "请补充原始对战日志，并注明可定位的回合与验证条件。";
  await setValue(d.querySelector(".cm-review-actions textarea"), reason);
  await clickButton("退回需修改");
  check(
    "A valid return reason persists with changes_requested and a direct revision link",
    submission(localId).status === "changes_requested" &&
      submission(localId).reviewNote === reason &&
      text().includes("按意见修订"),
  );
  await clickLink("按意见修订");
  check(
    "Revision opens the same submission with preserved body and reviewer feedback",
    w.location.hash.includes(localId) &&
      text().includes(reason) &&
      d.querySelector(".cm-structured-fields textarea")?.value.includes("示例"),
  );
  const evidence = d.querySelector(".cm-editor-evidence textarea");
  await setValue(
    evidence,
    evidence.value +
      " 修订说明：已补充原始记录的回合与验证条件，仅作流程演示。",
  );
  await clickButton("提交本地审核");
  check(
    "Resubmission resets the same record to pending and increments its revision count",
    submission(localId).status === "pending" &&
      submission(localId).revisionCount === 2 &&
      submission(localId).reviewNote === "",
  );
  await clickLink("查看并体验审核");
  await clickButton("本地批准");
  await setValue(d.querySelector("#cm-review-role"), "maintainer");
  await clickButton("模拟上游冲突");
  check(
    "Simulated upstream conflict blocks merge and persists the conflict state",
    submission(localId).status === "conflict" &&
      !!d.querySelector(".cm-conflict-panel") &&
      ![...d.querySelectorAll("button")].some(
        (item) => item.textContent.trim() === "模拟合并",
      ),
  );
  await clickButton("查看上游差异");
  check(
    "Upstream conflict expands into a concrete before-and-after difference",
    d
      .querySelector(".cm-conflict-panel .cm-diff")
      ?.textContent.includes("来源要求：注明可定位的时间或回合数。"),
  );
  await clickLink("在新版基础上修订");
  check(
    "Conflict revision rebases its displayed version and preserves the added upstream requirement",
    text().includes("demo-r18") &&
      [...d.querySelectorAll(".cm-structured-fields textarea")].some(
        (element) =>
          element.value.includes("来源要求：注明可定位的时间或回合数。"),
      ),
  );
  const conflictEvidence = d.querySelector(".cm-editor-evidence textarea");
  await setValue(
    conflictEvidence,
    conflictEvidence.value + " 冲突修订：已核对演示上游新增的来源定位要求。",
  );
  await clickButton("提交本地审核");
  check(
    "Conflict resubmission returns to pending on demo-r18 while preserving upstream content",
    submission(localId).status === "pending" &&
      submission(localId).baseVersion === "demo-r18" &&
      submission(localId).revisionCount === 3 &&
      submission(localId).after.includes(
        "来源要求：注明可定位的时间或回合数。",
      ),
  );
  check(
    "Revision audit history retains both requested changes and the upstream conflict",
    submission(localId).events.some((event) =>
      event.label.includes("需要修订"),
    ) &&
      submission(localId).events.some((event) =>
        event.label.includes("上游冲突"),
      ) &&
      submission(localId).events.filter(
        (event) => event.label === "修订后重新投稿",
      ).length === 2,
  );
  await refreshPreservingStorage("/review/?submission=" + localId);
  check(
    "The revised pending submission and upstream base version survive refresh",
    submission(localId).status === "pending" &&
      submission(localId).baseVersion === "demo-r18" &&
      reviewStatus().includes("待审核") &&
      d.querySelector(".cm-review-meta")?.textContent.includes("demo-r18"),
  );
  check(
    "No runtime console errors occurred during the bounded DOM workflow tests",
    consoleErrors.length === 0,
  );

  const result = {
    status: "PASS",
    scope:
      "jsdom DOM integration only; no actual-browser rendering, geometry, or visual assertions",
    artifact: project + "/RocoWiki_UI_V5.html",
    artifactSha256: crypto.createHash("sha256").update(html).digest("hex"),
    checkCount: checks.length,
    checks,
    finalStates: {
      publishedDemo: {
        id: "demo-001",
        status: submission("demo-001").status,
        eventCount: submission("demo-001").events.length,
      },
      revisedLocal: {
        id: localId,
        status: submission(localId).status,
        baseVersion: submission(localId).baseVersion,
        revisionCount: submission(localId).revisionCount,
        eventCount: submission(localId).events.length,
      },
    },
    consoleErrors,
  };
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  dom.window.close();
}

run().catch((error) => {
  const failure = {
    status: "FAIL",
    scope: "jsdom DOM integration only; no visual assertions",
    checkCount: checks.length,
    checks,
    error: error.message,
    stack: error.stack,
    consoleErrors,
  };
  fs.writeFileSync(output, JSON.stringify(failure, null, 2));
  console.error(JSON.stringify(failure, null, 2));
  dom.window.close();
  process.exitCode = 1;
});
