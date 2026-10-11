/** Source-level DOM interactions and published snapshot contracts; not screenshot QA. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { JSDOM } = require("jsdom");
const project = path.resolve(__dirname, "..");
const esbuild = require(require.resolve("esbuild", { paths: [project] }));
const React = require(require.resolve("react", { paths: [project] }));
const { act } = React;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "roco-v7-editing-"));
const output = path.join(__dirname, "v7-editing-check-results.json");
const checks = [];
const errors = [];
const originalError = console.error;
console.error = (...args) => errors.push(args.map(String).join(" "));
let dom, root;
function check(label, value) {
  checks.push({ label, pass: !!value });
  assert.ok(value, label);
}

async function main() {
  await esbuild.build({
    stdin: {
      contents: `export {default as CommunityPages} from './src/wiki/CommunityPages.jsx'; export * from './src/wiki/editing/registry.js'; export * from './src/wiki/editing/model.js'; export {formFor} from './src/wiki/editing/SectionEditor.jsx'; export {PublishedSection} from './src/wiki/editing/EditEntry.jsx';`,
      resolveDir: project,
      loader: "jsx",
    },
    outfile: path.join(temp, "editing.cjs"),
    bundle: true,
    format: "cjs",
    platform: "node",
    loader: { ".css": "empty" },
    logLevel: "silent",
    plugins: [
      {
        name: "test-framework",
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
            namespace: "docusaurus",
          }));
          build.onLoad({ filter: /.*/, namespace: "docusaurus" }, (args) => ({
            loader: "jsx",
            resolveDir: project,
            contents: args.path.endsWith("/useBrokenLinks") ? "export default function useBrokenLinks(){return {collectAnchor(value){if(value)globalThis.__rocoAnchorSet?.add(value)},collectLink(){}};}" : args.path.endsWith("/Link")
              ? `import React from 'react'; export default function Link({to,children,...rest}) {return <a href={to} {...rest}>{children}</a>}`
              : `export default function useBaseUrl(value){return value}`,
          }));
        },
      },
    ],
  });
  dom = new JSDOM('<div id="root"></div>', {
    url: "https://wiki.test/edit/",
    pretendToBeVisual: true,
  });
  const w = dom.window,
    d = w.document;
  Object.assign(global, {
    window: w,
    document: d,
    HTMLElement: w.HTMLElement,
    CustomEvent: w.CustomEvent,
    localStorage: w.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  const C = require(path.join(temp, "editing.cjs"));
  const { createRoot } = require(
    require.resolve("react-dom/client", { paths: [project] }),
  );
  root = createRoot(d.querySelector("#root"));
  const storageKey = C.COMMUNITY_STORAGE_KEY;
  const workspace = () =>
    JSON.parse(w.localStorage.getItem(storageKey) || "null");
  const bodyText = () => d.body.textContent;
  async function render(route) {
    await act(async () => root.unmount());
    root = createRoot(d.querySelector("#root"));
    const url = new URL(route, "https://wiki.test");
    w.history.replaceState({}, "", url);
    await act(async () =>
      root.render(
        React.createElement(C.CommunityPages, {
          path: url.pathname,
          query: url.searchParams,
        }),
      ),
    );
  }
  async function click(label) {
    const element = [...d.querySelectorAll("button")].find(
      (el) =>
        el.textContent.trim() === label ||
        el.getAttribute("aria-label") === label,
    );
    assert.ok(element, "button " + label);
    await act(async () => element.click());
  }
  async function input(label, value) {
    const el = d.querySelector(`[aria-label="${label}"]`);
    assert.ok(el, "input " + label);
    const proto =
      el.tagName === "TEXTAREA"
        ? w.HTMLTextAreaElement.prototype
        : w.HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new w.Event("input", { bubbles: true }));
    });
  }
  async function role(value) {
    await act(async () => d.querySelector("#cm-review-role").click());
    const option = [...d.querySelectorAll('[role="option"]')].find(
      (row) => row.textContent === value,
    );
    assert.ok(option, "role option");
    await act(async () => option.click());
  }
  function snapshotRequest(overrides = {}) {
    return {
      entity: "海芙约忒",
      section: "获取时间线",
      mode: "acquisition",
      returnTo: "/pets/haifu/#acquire",
      record: "haifu-20240705",
      ...overrides,
    };
  }
  const req = snapshotRequest();
  const first = C.getPublishedSnapshot(req);
  check(
    "Acquisition baseline loads the exact published row with historical dates",
    first.data.records.length === 1 &&
      first.data.records[0].startDate === "2024-07-05" &&
      first.data.records[0].title === "福气一箩筐",
  );
  check(
    "Published revision is a content fingerprint rather than a fabricated Git revision",
    /^pub-[a-f0-9]{8}$/.test(first.revision) &&
      first.revision === C.getPublishedSnapshot(req).revision,
  );
  const docs = JSON.parse(
    fs.readFileSync(path.join(project, "content/published-docs-v7.json")),
  );
  const sourceDoc = docs.documents.find(
    (row) => row.path === "/guides/returning/",
  );
  const docRequest = {
    entity: sourceDoc.title,
    section: sourceDoc.sections[1].title,
    mode: "article",
    returnTo: "/guides/returning/#section-2",
  };
  const doc = C.getPublishedSnapshot(docRequest);
  check(
    "A document subheading edits only its own published Markdown",
    doc.data.markdown === sourceDoc.sections[1].markdown &&
      !doc.data.markdown.includes("第三步："),
  );
  function publishedArticle(id, request, markdown, updatedAt) {
    return {
      id,
      editorVersion: 7,
      editorMode: "article",
      editorRequest: request,
      snapshotKey: C.getPublishedSnapshot(request).key,
      status: "published",
      typedData: { markdown },
      after: markdown,
      updatedAt,
    };
  }
  const newSectionText =
    "核对本次开放的条件和奖励。\n\n| 获取记录 | 核对结果 |\n| --- | --- |\n| 当前开放批次 | 已核对 |";
  const sectionPublication = publishedArticle(
    "test-doc-section",
    docRequest,
    newSectionText,
    "2026-10-10T09:00:00.000Z",
  );
  const wholeRequest = {
    ...docRequest,
    section: "条目正文",
    returnTo: sourceDoc.path,
  };
  const wholeAfterSection = C.getPublishedSnapshot(wholeRequest, {
    submissions: [sectionPublication],
  });
  check(
    "Publishing a subsection updates the whole-document baseline and retains sibling content",
    wholeAfterSection.scope === "local" &&
      wholeAfterSection.data.markdown.includes(newSectionText) &&
      !wholeAfterSection.data.markdown.includes(
        sourceDoc.sections[1].markdown,
      ) &&
      wholeAfterSection.data.markdown.includes(sourceDoc.sections[0].markdown),
  );
  const fromWholeText = "整篇修订中核对的本周活动与参与条件。";
  const wholePublication = publishedArticle(
    "test-doc-whole",
    wholeRequest,
    sourceDoc.markdown.replace(sourceDoc.sections[1].markdown, fromWholeText),
    "2026-10-10T09:10:00.000Z",
  );
  const sectionAfterWhole = C.getPublishedSnapshot(docRequest, {
    submissions: [sectionPublication, wholePublication],
  });
  check(
    "A later whole-document publication becomes the corresponding subsection baseline",
    sectionAfterWhole.data.markdown === fromWholeText &&
      sectionAfterWhole.revision !== doc.revision,
  );
  const siblingRequest = {
    ...docRequest,
    section: sourceDoc.sections[0].title,
    returnTo: `${sourceDoc.path}#${sourceDoc.sections[0].id}`,
  };
  const siblingText = "整理宠物时先确认具体形态，再核对技能与血脉。";
  const siblingPublication = publishedArticle(
    "test-doc-sibling",
    siblingRequest,
    siblingText,
    "2026-10-10T09:20:00.000Z",
  );
  const composedBaseline = C.getPublishedSnapshot(wholeRequest, {
    submissions: [siblingPublication, sectionPublication],
  });
  check(
    "Independent section publications compose in publish order without overwriting each other",
    composedBaseline.data.markdown.includes(newSectionText) &&
      composedBaseline.data.markdown.includes(siblingText) &&
      composedBaseline.data.markdown.includes(sourceDoc.sections[2].markdown),
  );
  const afterSiblingOnly = C.getPublishedSnapshot(docRequest, {
    submissions: [siblingPublication],
  });
  check(
    "A sibling-only publication does not cause a false conflict in an unchanged subsection",
    afterSiblingOnly.data.markdown === doc.data.markdown &&
      afterSiblingOnly.revision === doc.revision,
  );
  check(
    "Unpublished document submissions never replace the current published baseline",
    C.getPublishedSnapshot(docRequest, {
      submissions: [{ ...sectionPublication, status: "pending" }],
    }).data.markdown === doc.data.markdown,
  );
  const skill = C.getPublishedSnapshot({
    entity: "灵火之杖",
    section: "效果与触发条件",
    mode: "skill",
    returnTo: "/skills/linghuo/",
    record: "branch-3",
  });
  check(
    "Skill editor baseline uses the same three presentation branches as the reader",
    skill.data.phases.length === 3 &&
      skill.data.phases[2].otherwiseWhen === "对手后手使用变化技能",
  );
  const event = JSON.parse(
    fs.readFileSync(path.join(project, "content/events-v7.json")),
  ).activities[0];
  const eventRequest = {
    entity: event.name,
    section: "活动与开放批次",
    mode: "event",
    returnTo: `/events/${event.slug}/`,
    intent: "add",
  };
  const eventSnapshot = C.getPublishedSnapshot(eventRequest);
  const eventForm = C.formFor(eventSnapshot, eventRequest);
  check(
    "Adding a return period preserves the immutable existing activity baseline",
    eventSnapshot.data.occurrences.length === event.occurrences.length &&
      eventForm.typedData.occurrences.length === event.occurrences.length + 1 &&
      eventForm.baseData.occurrences.length === event.occurrences.length,
  );
  check(
    "Event record links and add-period links share a master activity identity",
    eventSnapshot.key ===
      C.getPublishedSnapshot({
        ...eventRequest,
        intent: "edit",
        record: event.occurrences[0].id,
        section: "本次开放",
      }).key,
  );
  const evolutionActivity = JSON.parse(
    fs.readFileSync(path.join(project, "content/events-v7.json")),
  ).activities.find((activity) =>
    activity.occurrences.some((period) =>
      period.rewards.some(
        (reward) => reward.kind === "evolution_qualification",
      ),
    ),
  );
  const evolutionPeriod = evolutionActivity.occurrences.find((period) =>
    period.rewards.some((reward) => reward.kind === "evolution_qualification"),
  );
  const evolutionReward = evolutionPeriod.rewards.find(
    (reward) => reward.kind === "evolution_qualification",
  );
  check(
    "Event reward normalization preserves evolution-qualification semantics",
    C.getPublishedSnapshot({
      entity: evolutionActivity.name,
      mode: "event",
      section: "活动与开放批次",
      returnTo: `/events/${evolutionActivity.slug}/`,
    })
      .data.occurrences.find((period) => period.id === evolutionPeriod.id)
      .rewards.includes(`${evolutionReward.name}进化资格`),
  );
  const newNpc = C.getPublishedSnapshot({
    entity: "人物与NPC",
    section: "人物",
    mode: "npc",
    intent: "add",
    returnTo: "/npcs/",
  });
  check(
    "Add NPC opens a blank typed entry instead of editing the directory title",
    newNpc.data.name === "" &&
      newNpc.data.location === "" &&
      newNpc.content === "",
  );
  const existingNpc = C.getPublishedSnapshot({
    entity: "格里芬院长",
    section: "人物条目",
    mode: "npc",
    returnTo: "/npcs/griffin/",
  });
  check(
    "NPC baseline matches the actual reader identity, scene and specific source",
    existingNpc.data.role === "魔法学院院长" &&
      existingNpc.data.location === "魔法学院 · 教学楼" &&
      existingNpc.data.sourceUrl.includes("74004"),
  );
  const createdNpc = {
    id: "local-new-npc",
    editorVersion: 7,
    editorMode: "npc",
    status: "published",
    target: "人物与NPC",
    typedData: {
      name: "本机新人物",
      slug: "",
      location: "本机场景",
      role: "本机测试职责",
      intro: "本机条目介绍",
      sourceUrl: "https://example.com/source",
    },
    updatedAt: "2026-10-10T10:00:00Z",
  };
  const localNpcRequest = {
    entity: "本机新人物",
    section: "人物条目",
    mode: "npc",
    returnTo: "/npcs/?entry=local-new-npc",
    record: "local-new-npc",
  };
  const localNpcSnapshot = C.getPublishedSnapshot(localNpcRequest, {
    submissions: [createdNpc],
  });
  check(
    "A newly published local NPC can be reopened by stable entry key with prefilled values",
    localNpcSnapshot.scope === "local" &&
      localNpcSnapshot.data.name === "本机新人物" &&
      localNpcSnapshot.data.slug === "local-new-npc",
  );
  const renamedNpc = {
    ...createdNpc,
    id: "local-npc-revision",
    typedData: { ...localNpcSnapshot.data, name: "本机新人物修订" },
    updatedAt: "2026-10-10T11:00:00Z",
  };
  check(
    "NPC updates retain their identity even when the display name changes",
    C.getPublishedSnapshot(localNpcRequest, {
      submissions: [createdNpc, renamedNpc],
    }).data.name === "本机新人物修订",
  );
  const pve = C.getPublishedSnapshot({
    entity: "星辰之塔",
    section: "挑战方案",
    mode: "pve",
    record: "bishui-sacred-wu-20200511",
    returnTo: "/pve/star-tower/",
  });
  check(
    "PVE editor loads the historical challenge pet and recorded conditions",
    pve.data.pets === "碧水灵兽" &&
      pve.data.requirements.includes("源头活水") &&
      pve.data.version.includes("2020-05-11"),
  );
  const calculator = C.getPublishedSnapshot({
    entity: "威力伤害计算器",
    section: "计算规则",
    mode: "article",
    returnTo: "/tools/damage/#calculation-rules",
  });
  check(
    "Calculator rules have a source-backed article baseline",
    calculator.data.markdown.length > 200 &&
      calculator.sourcePath.includes("calculator-sources-v7"),
  );
  const merge = C.threeWayMerge(
    { a: "old", b: "old" },
    { a: "new", b: "old" },
    { a: "old", b: "mine" },
  );
  check(
    "Non-overlapping field edits merge without discarding either change",
    merge.conflicts.length === 0 &&
      merge.data.a === "new" &&
      merge.data.b === "mine",
  );
  const conflict = C.threeWayMerge(
    { a: "old" },
    { a: "current" },
    { a: "mine" },
  );
  check(
    "A field changed by both writers requires an explicit conflict choice",
    conflict.conflicts.length === 1 &&
      conflict.conflicts[0].current === "current" &&
      conflict.conflicts[0].mine === "mine",
  );
  const invalid = C.formFor(first, req);
  invalid.summary = "补充历史活动资料";
  invalid.evidenceNote = "以该期公告活动小节为依据核对";
  invalid.typedData.records[0].endDate = "2024-01-01";
  check(
    "Activity validation rejects an end date before its start",
    !!C.validateSectionForm(invalid)["records.0.endDate"],
  );
  invalid.typedData.records[0].startDate = "2026-99-99";
  check(
    "Malformed dates report a field error without crashing",
    !!C.validateSectionForm(invalid)["records.0.startDate"],
  );
  const articleForm = C.formFor(doc, {
    entity: sourceDoc.title,
    section: sourceDoc.sections[1].title,
  });
  articleForm.typedData.markdown = "<script>alert(1)</script>";
  articleForm.summary = "补充说明文字内容";
  articleForm.evidenceNote = "依据当前页面原文核对";
  check(
    "Article submissions reject executable HTML or MDX",
    !!C.validateSectionForm(articleForm).markdown,
  );
  check(
    "Return links reject protocol-relative destinations",
    C.safeInternalPath("//example.com", "/") === "/" &&
      !C.editorHref({ entity: "测试", returnTo: "//example.com" }).includes(
        "example.com",
      ),
  );
  check(
    "Malformed percent-encoded anchors safely fall back to the explicit section title",
    C.getPublishedSnapshot({
      ...docRequest,
      returnTo: `${sourceDoc.path}#%E0%A4%A`,
    }).data.markdown === doc.data.markdown,
  );
  w.localStorage.setItem(
    storageKey,
    JSON.stringify({ submissions: [sectionPublication] }),
  );
  await act(async () =>
    root.render(
      React.createElement(
        C.PublishedSection,
        docRequest,
        React.createElement("p", null, "原阅读正文占位"),
      ),
    ),
  );
  check(
    "Published article content replaces the reading body with rendered Markdown and a local-version notice",
    bodyText().includes("核对本次开放的条件和奖励") &&
      !bodyText().includes("原阅读正文占位") &&
      d.querySelector("table tbody td")?.textContent === "当前开放批次" &&
      d.querySelector(".ev7-local-revision") &&
      !d.querySelector("pre"),
  );
  const liveRevisionText = "收到发布事件后，正文立即显示当前章节的新版本。";
  await act(async () => {
    w.localStorage.setItem(
      storageKey,
      JSON.stringify({
        submissions: [
          { ...sectionPublication, typedData: { markdown: liveRevisionText } },
        ],
      }),
    );
    w.dispatchEvent(new w.CustomEvent("roco:community-updated"));
  });
  check(
    "A publish event refreshes the active reading section without a page reload",
    bodyText().includes(liveRevisionText) &&
      !bodyText().includes("核对本次开放的条件和奖励"),
  );
  w.localStorage.removeItem(storageKey);

  const route = C.editorHref(req);
  await render(route);
  check(
    "Acquisition editor exposes dates, conditions, location, reward and per-record source",
    [
      "开始日期",
      "结束日期",
      "地点／进入路径",
      "完成后获得什么",
      "参与条件与消耗",
      "该次记录的来源链接",
    ].every((label) => d.querySelector(`[aria-label="${label}"]`)),
  );
  check(
    "Field values are prefilled from the published row",
    d.querySelector('[aria-label="开始日期"]').value === "2024-07-05" &&
      d.querySelector('[aria-label="活动／获取记录名称"]').value ===
        "福气一箩筐",
  );
  await input("完成后获得什么", "海芙约忒（本地核对记录）");
  await input("修改摘要", "核对历史返场奖励的具体名称");
  await input(
    "证据定位与核验方法",
    "依据该期更新公告中福气一箩筐活动的奖励段落核对。",
  );
  await click("保存草稿");
  check(
    "Saving a typed draft preserves its immutable baseline and new value",
    workspace().drafts[0].editorVersion === 7 &&
      workspace().drafts[0].baseContent === first.content &&
      workspace().drafts[0].typedData.records[0].reward.includes("本地核对"),
  );
  await render("/account/?tab=drafts");
  check(
    "Drafts live inside My Submissions and preserve mode, record and return context",
    bodyText().includes("我的投稿") &&
      [...d.querySelectorAll("a")].some(
        (el) =>
          el.href.includes("mode=acquisition") &&
          el.href.includes("record=haifu-20240705"),
      ),
  );
  check(
    "Personal center has five clear groups and no ambiguous profile/binding tab",
    [...d.querySelectorAll(".ev7-account-nav button")]
      .map((el) => el.textContent.trim())
      .join("|") === "我的首页|我的投稿|我的收藏|个人资料|账号与安全" &&
      !bodyText().includes("资料与绑定"),
  );
  await render(route);
  check(
    "Reopening the same section restores its typed local draft",
    d
      .querySelector('[aria-label="完成后获得什么"]')
      .value.includes("本地核对") && bodyText().includes("已恢复这个章节"),
  );
  await click("提交本地审核");
  const submission = workspace().submissions.find((row) => !row.isExample);
  check(
    "A valid typed submission starts pending with source revision and actual before/after",
    submission?.status === "pending" &&
      submission.before === first.content &&
      submission.after.includes("本地核对记录") &&
      workspace().drafts.length === 0,
  );
  await render(`/review/?submission=${submission.id}`);
  await click("本地批准");
  await role("发布维护者");
  await click("模拟合并");
  check(
    "Typed review preserves separate approval and normal-merge stages",
    workspace().submissions.find((row) => row.id === submission.id).status ===
      "merged",
  );
  await click("模拟开始构建");
  await click("模拟构建成功");
  await click("模拟发布上线");
  check(
    "Publishing records a local revision without claiming a remote deploy",
    workspace().submissions.find((row) => row.id === submission.id).status ===
      "published" && bodyText().includes("真实站点和仓库尚未发生变化"),
  );
  const refreshed = C.getPublishedSnapshot(req, workspace());
  const collection = C.getPublishedSnapshot(
    snapshotRequest({ record: "", section: "获取历史" }),
    workspace(),
  );
  check(
    "A published row is the next editor baseline and appears in the collection",
    refreshed.scope === "local" &&
      refreshed.data.records[0].reward.includes("本地核对") &&
      collection.data.records
        .find((row) => row.id === "haifu-20240705")
        .reward.includes("本地核对"),
  );
  await render(route);
  check(
    "The editor loads a published local correction instead of reverting to bundle content",
    d
      .querySelector('[aria-label="完成后获得什么"]')
      .value.includes("本地核对") &&
      bodyText().includes("已载入本机已发布版本"),
  );

  await input("参与条件与消耗", "本地草稿：逐项核对活动兑换材料与条件。");
  await input("修改摘要", "补充参与条件与消耗的核验说明");
  await input(
    "证据定位与核验方法",
    "依据活动正文的条件段，逐项核对材料与兑换要求。",
  );
  await click("提交本地审核");
  const second = workspace().submissions.find(
    (row) => !row.isExample && row.id !== submission.id,
  );
  await render(`/review/?submission=${second.id}`);
  await click("本地批准");
  await role("发布维护者");
  await click("模拟上游冲突");
  check(
    "Conflict demonstration creates a real newer local snapshot and pauses the submission",
    workspace().submissions.find((row) => row.id === second.id).status ===
      "conflict" &&
      C.getPublishedSnapshot(req, workspace()).revision !== second.baseVersion,
  );
  await render(C.editorHref({ ...req, submission: second.id }));
  check(
    "A stale draft is retained and cannot be submitted before reconciliation",
    bodyText().includes("这一节出现了新版本") &&
      [...d.querySelectorAll("button")].find(
        (el) => el.textContent.trim() === "提交本地审核",
      ).disabled &&
      d
        .querySelector('[aria-label="参与条件与消耗"]')
        .value.includes("本地草稿"),
  );
  await click("对照新版与我的修改");
  check(
    "Conflicting data requires choosing live or draft rather than silently overwriting",
    d.querySelectorAll('.ev7-conflict-options input[type="radio"]').length >= 2,
  );
  await click("采用以上处理并核对差异");
  check(
    "An unresolved conflict cannot be accepted",
    bodyText().includes("请先逐项选择冲突字段"),
  );
  for (const fieldset of d.querySelectorAll(".ev7-conflict-review fieldset")) {
    const inputs = fieldset.querySelectorAll("input");
    await act(async () => inputs[inputs.length - 1].click());
  }
  await click("采用以上处理并核对差异");
  check(
    "Explicit resolution updates the base revision and keeps the chosen draft value",
    !d.querySelector(".ev7-conflict-review") &&
      ![...d.querySelectorAll("button")].find(
        (el) => el.textContent.trim() === "提交本地审核",
      ).disabled &&
      bodyText().includes("本地草稿"),
  );

  await render(
    C.editorHref({
      entity: "灵火之杖",
      section: "效果与触发条件",
      mode: "skill",
      returnTo: "/skills/linghuo/",
      record: "branch-3",
    }),
  );
  check(
    "A skill branch edit focuses the selected branch and retains its alternative condition",
    d.querySelector('[aria-label="其他分支的条件"]').value ===
      "对手后手使用变化技能" && !d.querySelector('[aria-label="初始 PP"]'),
  );
  await render(
    C.editorHref({
      entity: "灵火之杖",
      section: "效果与触发条件",
      mode: "skill",
      returnTo: "/skills/linghuo/",
      intent: "add",
    }),
  );
  check(
    "Add skill branch appends a blank branch while retaining the existing skill",
    bodyText().includes("灵火之杖 · 条件分支 4") &&
      d.querySelector('[aria-label="如果 · 满足什么条件"]').value === "",
  );
  await render(
    C.editorHref({
      entity: "人物与NPC",
      section: "人物",
      mode: "npc",
      intent: "add",
      returnTo: "/npcs/",
    }),
  );
  check(
    "New NPC exposes a direct typed creation flow",
    d.querySelector('[aria-label="人物／NPC 名称"]').value === "" &&
      d.querySelector('[aria-label="出现场景／具体位置"]') &&
      d.querySelector('[aria-label="提供的服务"]'),
  );
  await render("/account/?tab=profile");
  check(
    "Public profile editing is separate from security and external account connections",
    bodyText().includes("个人资料") && !bodyText().includes("关联 GitHub"),
  );
  await render("/account/?tab=security");
  check(
    "Account and security owns optional GitHub association and accurately labels auth availability",
    bodyText().includes("关联 GitHub") &&
      bodyText().includes("当前原型尚未接入账号服务") &&
      !d.querySelector(".cm-profile-form"),
  );
  check(
    "The tested editors and account controls do not render native selects",
    !d.querySelector("select"),
  );
  check(
    "React interaction checks completed without runtime or accessibility warnings",
    errors.length === 0,
  );
  await act(async () => root.unmount());
  root = null;
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        version: 7,
        scope:
          "Structured editor source DOM tests; no screenshots or remote services",
        checkedAt: new Date().toISOString(),
        passed: checks.length,
        failed: 0,
        checks,
        consoleErrors: errors,
        sourceHashes: Object.fromEntries(
          [
            "src/wiki/CommunityPages.jsx",
            "src/wiki/editing/registry.js",
            "src/wiki/editing/model.js",
            "src/wiki/editing/SectionEditor.jsx",
            "src/wiki/editing/TypedFields.jsx",
            "src/wiki/editing/publishedRecords.js",
            "src/wiki/editing/PreviewContent.jsx",
            "src/wiki/editing/EditEntry.jsx",
            "src/wiki/editing/documentComposition.js",
            "src/wiki/editing/ReadingMarkdown.jsx",
            "src/wiki/npcPresentation.js",
          ].map((file) => [
            file,
            createHash("sha256")
              .update(fs.readFileSync(path.join(project, file)))
              .digest("hex"),
          ]),
        ),
      },
      null,
      2,
    ),
  );
  console.log(`V7 editing: ${checks.length} checks passed.`);
}
main()
  .catch((error) => {
    console.log(error.stack);
    if (errors.length) console.log(errors.join("\n"));
    fs.writeFileSync(
      output,
      JSON.stringify(
        {
          version: 7,
          passed: checks.filter((row) => row.pass).length,
          failed: 1,
          checks,
          error: error.message,
          consoleErrors: errors,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  })
  .finally(() => {
    console.error = originalError;
    if (root) root.unmount();
    dom?.window.close();
    fs.rmSync(temp, { recursive: true, force: true });
  });
