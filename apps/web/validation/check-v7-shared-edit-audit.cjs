/** Read-only shared editor integration audit; uses the catalog JSDOM setup. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const project = path.resolve(__dirname, "..");
const esbuild = require(require.resolve("esbuild", { paths: [project] }));
const React = require(require.resolve("react", { paths: [project] }));
const { JSDOM } = require("jsdom");
const { act } = React;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "roco-v7-edit-audit-"));
const bundle = path.join(directory, "audit.cjs");
const checks = [];
const errors = [];
const oldError = console.error;
let root;
let dom;
console.error = (...args) => errors.push(args.map(String).join(" "));
const check = (label, pass, details) =>
  checks.push({ label, pass: Boolean(pass), ...(details ? { details } : {}) });

async function main() {
  await esbuild.build({
    stdin: {
      contents:
        'export * from "./src/wiki/CatalogPages.jsx"; export {MechanicsHome, EffectRelations} from "./src/wiki/MechanicsPages.jsx"; export {default as InlineSectionEdits} from "./src/wiki/InlineSectionEdits.jsx";',
      resolveDir: project,
      loader: "jsx",
    },
    outfile: bundle,
    bundle: true,
    format: "cjs",
    platform: "node",
    loader: { ".css": "empty" },
    logLevel: "silent",
    plugins: [
      {
        name: "read-only-edit-audit",
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
    MutationObserver: w.MutationObserver,
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
  const C = require(bundle);
  function Reader({ Component, props }) {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "main",
        { id: "rw-main" },
        React.createElement(Component, props),
      ),
      React.createElement(C.InlineSectionEdits),
    );
  }
  async function render(Component, props, route) {
    if (root) await act(async () => root.unmount());
    w.history.replaceState({}, "", route);
    root = createRoot(d.querySelector("#root"));
    await act(async () =>
      root.render(React.createElement(Reader, { Component, props })),
    );
  }
  const editInfo = (element) =>
    Object.fromEntries(
      new URL(element.getAttribute("href"), w.location.href).searchParams,
    );
  const headerEdits = () =>
    [...d.querySelectorAll(".rw-pagehead .rw-edit-entry")].map(editInfo);
  async function click(element) {
    if (!element) throw new Error("Audit control is missing");
    await act(async () => element.click());
  }
  const sceneButton = (text) =>
    [...d.querySelectorAll(".rw-counter-scenes-v7 button")].find((button) =>
      button.textContent.startsWith(text),
    );
  const validTypedRecords = (selector, mode) => {
    const rows = [...d.querySelectorAll(selector)];
    return (
      rows.length > 0 &&
      rows.every((row) => {
        const edits = [...row.querySelectorAll(".rw-edit-entry")];
        return (
          edits.length === 1 &&
          editInfo(edits[0]).mode === mode &&
          Boolean(editInfo(edits[0]).record) &&
          !row.querySelector(".rw-inline-section-edit")
        );
      })
    );
  };
  await render(C.PetsPage, {}, "/pets/");
  const indexActions = headerEdits();
  check(
    "Catalog PageHeader preserves add and a single directory editor",
    indexActions.length === 2 &&
      indexActions.filter(
        (action) => action.intent === "add" && action.mode === "pet",
      ).length === 1 &&
      indexActions.filter((action) => action.mode === "index").length === 1,
    indexActions,
  );

  await render(C.PetPage, { slug: "haifu" }, "/pets/haifu/");
  const petActions = headerEdits();
  check(
    "Pet PageHeader renders exactly one dedicated entry editor",
    petActions.length === 1 &&
      petActions[0].mode === "pet" &&
      petActions[0].section === "基础资料",
    petActions,
  );
  check(
    "Acquisition headings preserve one typed record editor without a generic duplicate",
    validTypedRecords(".rw-acquisition-entry-v6", "acquisition"),
  );
  check(
    "Counter headings preserve one typed record editor without a generic duplicate",
    validTypedRecords(".rw-matchup-card-v7", "matchup"),
  );
  check(
    "Shared section headings render only one section editor",
    [...d.querySelectorAll(".rw-section-head")].every(
      (heading) => heading.querySelectorAll(".rw-edit-entry").length === 1,
    ),
  );

  await click(sceneButton("同起"));
  const emptyHeading = d.querySelector(".rw-matchup-empty-v7 h4");
  check(
    "The empty Counter state keeps its add action without a competing generic heading editor",
    Boolean(emptyHeading) &&
      !emptyHeading.querySelector(".rw-inline-section-edit") &&
      d.querySelectorAll(
        '.rw-matchup-empty-v7 .rw-edit-entry[href*="intent=add"]',
      ).length === 1,
  );
  await click(sceneButton("全部"));
  check(
    "Restoring filtered Counter records does not add generic editors to typed headings",
    validTypedRecords(".rw-matchup-card-v7", "matchup"),
  );
  await click(sceneButton("同起"));
  check(
    "Repeated filtering never duplicates the empty state's add action",
    d.querySelectorAll(".rw-matchup-empty-v7 .rw-edit-entry").length === 1 &&
      !d.querySelector(".rw-matchup-empty-v7 h4 .rw-inline-section-edit"),
  );

  await render(C.SkillPage, { slug: "xiazi" }, "/skills/xiazi/?pet=haifu");
  const skillActions = headerEdits();
  check(
    "Skill PageHeader renders one editor and preserves the originating pet query",
    skillActions.length === 1 &&
      skillActions[0].mode === "skill" &&
      skillActions[0].returnTo === "/skills/xiazi/?pet=haifu",
    skillActions,
  );
  check(
    "Skill branch headings preserve their dedicated typed editors",
    validTypedRecords(".rw-skill-branch-v6", "skill"),
  );
  await click(d.querySelector('[aria-controls="rw-skill-branches-v6"]'));
  await click(d.querySelector('[aria-controls="rw-skill-branches-v6"]'));
  check(
    "Expanding skill conditions again does not create competing generic editors",
    validTypedRecords(".rw-skill-branch-v6", "skill"),
  );
  const effectsEdit = d.querySelector(
    "#effects > .rw-section-head .rw-edit-entry",
  );
  const effectsInfo = effectsEdit ? editInfo(effectsEdit) : null;
  check(
    "Shared skill-section editor preserves the originating pet query",
    effectsInfo?.returnTo === "/skills/xiazi/?pet=haifu#effects",
    effectsInfo,
  );
  await render(C.MechanicsHome, {}, "/mechanics/?source=haifu");
  const inlineEdits = [
    ...d.querySelectorAll(".rw-inline-section-edit .rw-edit-entry"),
  ];
  check(
    "Real mechanism subheading editors preserve query context and resolve through stable ASCII anchors",
    inlineEdits.length >= 7 &&
      inlineEdits.every((link) => {
        const href = editInfo(link).returnTo;
        const target = new URL(href, w.location.href);
        const heading = link.closest("h2,h3,h4,h5,h6");
        return (
          target.search === "?source=haifu" &&
          /^wiki-[a-f0-9]+(?:-\d+)?$/.test(heading.id) &&
          heading.querySelectorAll(".rw-edit-entry").length === 1 &&
          d.getElementById(decodeURIComponent(target.hash.slice(1))) === heading
        );
      }),
    inlineEdits.map(editInfo),
  );
  await render(C.EffectRelations, {}, "/mechanics/relations/");
  const relationHeadings = () => [
    ...d.querySelectorAll(
      ".rw-relation-results h2,.rw-relation-results h3,.rw-relation-results h4",
    ),
  ];
  const initialRelationAnchors = relationHeadings().map(
    (heading) => heading.id,
  );
  const validRelations = () =>
    relationHeadings().length > 0 &&
    relationHeadings().every((heading) => {
      const edits = heading.querySelectorAll(".rw-edit-entry");
      if (edits.length !== 1 || !/^wiki-[a-f0-9]+(?:-\d+)?$/.test(heading.id))
        return false;
      const target = new URL(editInfo(edits[0]).returnTo, w.location.href);
      return (
        target.search === w.location.search &&
        d.getElementById(decodeURIComponent(target.hash.slice(1))) === heading
      );
    });
  check(
    "Dynamic relation result headings start with one working generic editor each",
    validRelations(),
    initialRelationAnchors,
  );
  await click(d.querySelector('[aria-label="交换已有与新施加效果"]'));
  check(
    "Changing the relation query remounts generic editors once with current query context",
    validRelations(),
    relationHeadings().map((heading) => ({
      id: heading.id,
      edits: heading.querySelectorAll(".rw-edit-entry").length,
    })),
  );
  await click(d.querySelector('[aria-label="交换已有与新施加效果"]'));
  check(
    "Restoring a relation query preserves stable anchors without duplicate generic editors",
    validRelations() &&
      JSON.stringify(relationHeadings().map((heading) => heading.id)) ===
        JSON.stringify(initialRelationAnchors),
  );
  await act(async () => root.unmount());
  root = null;
  check(
    "No React DOM errors while automatic editor portals mount and disappear",
    errors.length === 0,
    errors,
  );
}

async function run() {
  let failure;
  try {
    await main();
  } catch (error) {
    failure = { name: error.name, message: error.message };
  } finally {
    if (root) {
      try {
        await act(async () => root.unmount());
      } catch (error) {
        failure ||= { name: error.name, message: error.message };
      }
    }
    dom?.window.close();
    fs.rmSync(directory, { recursive: true, force: true });
    console.error = oldError;
  }
  const sourcePaths = [
    "src/wiki/core.jsx",
    "src/wiki/InlineSectionEdits.jsx",
    "src/wiki/sectionAnchor.js",
    "src/wiki/editingContext.js",
    "src/wiki/CatalogPages.jsx",
    "src/wiki/MechanicsPages.jsx",
  ];
  const result = {
    status:
      !failure && checks.length >= 14 && checks.every((entry) => entry.pass)
        ? "PASS"
        : "FAIL",
    checkCount: checks.length,
    checks,
    sourceSha256: Object.fromEntries(
      sourcePaths.map((file) => [
        file,
        createHash("sha256")
          .update(fs.readFileSync(path.join(project, file)))
          .digest("hex"),
      ]),
    ),
    scope:
      "Read-only integration audit of source in React/JSDOM. Docusaurus routing stubbed. No browser screenshot, layout, network, or real router validation.",
    ranAt: new Date().toISOString(),
    ...(failure ? { error: failure } : {}),
  };
  fs.writeFileSync(
    path.join(__dirname, "v7-shared-edit-audit-results.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        status: result.status,
        checkCount: result.checkCount,
        failed: checks.filter((entry) => !entry.pass),
        error: failure,
      },
      null,
      2,
    ),
  );
  process.exitCode = result.status === "PASS" ? 0 : 1;
}
run();
