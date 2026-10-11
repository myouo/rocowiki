/**
 * V6 native Docusaurus static-output acceptance checks.
 * Run after `npm run build`: node validation/check-v6-native.cjs
 * Install validation/package.json dependencies first, or supply jsdom via NODE_PATH.
 * Optional ROCO_V6_BUILD is resolved relative to the project, not the shell cwd.
 * No scripts, network requests, browser rendering, hydration or layout tests run here.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { JSDOM } = require("jsdom");

const project = path.resolve(__dirname, "..");
const buildDirectory = path.resolve(
  project,
  process.env.ROCO_V6_BUILD || "build",
);
const outputPath = path.join(__dirname, "v6-native-check-results.json");
const checks = [];
const pageResults = [];
const docResults = [];
const radarResults = [];
const fontResults = [];
const typeIconResults = [];
let inventory = {};
let baseUrl = "/";
let htmlSha256 = null;

const relative = (file) =>
  path.relative(project, file).split(path.sep).join("/");
const sha256 = (input) =>
  crypto.createHash("sha256").update(input).digest("hex");
const clean = (text) =>
  String(text || "")
    .replace(/[\u200B\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const normalizeRoute = (route) =>
  "/" +
  String(route || "").replace(/^\/+|\/+$/g, "") +
  (String(route || "").replace(/^\/+|\/+$/g, "") ? "/" : "");
const sitePath = (route) => baseUrl.replace(/\/$/, "") + normalizeRoute(route);

function check(name, pass, details) {
  const item = { name, pass: Boolean(pass) };
  if (!item.pass && details !== undefined) item.details = details;
  checks.push(item);
  return item.pass;
}

function filesIn(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? filesIn(file) : entry.isFile() ? [file] : [];
    })
    .sort();
}

function readDocuments() {
  return filesIn(path.join(project, "docs"))
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => {
      const source = fs.readFileSync(file, "utf8");
      const front = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
      if (!front)
        throw new Error("Missing document front matter: " + relative(file));
      const metadata = {};
      for (const line of front[1].split(/\r?\n/)) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) metadata[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
      if (!metadata.slug || !metadata.title)
        throw new Error("Missing document slug/title: " + relative(file));
      const headings = [];
      let fence = null;
      for (const line of source.slice(front[0].length).split(/\r?\n/)) {
        const marker = line.match(/^\s*(`{3,}|~{3,})/);
        if (marker) {
          fence = fence === marker[1][0] ? null : fence || marker[1][0];
          continue;
        }
        if (fence) continue;
        const heading = line.match(/^##\s+(.+?)\s*#*\s*$/);
        if (heading)
          headings.push(clean(heading[1].replace(/\s*\{#[^}]+\}\s*$/, "")));
      }
      return {
        file: relative(file),
        id: path
          .relative(path.join(project, "docs"), file)
          .replace(/\.mdx?$/, "")
          .split(path.sep)
          .join("/"),
        route: normalizeRoute(metadata.slug),
        title: metadata.title,
        sidebarLabel: metadata.sidebar_label || metadata.title,
        headings,
      };
    });
}

function flattenSidebar(items) {
  return items.flatMap((item) =>
    typeof item === "string"
      ? [item]
      : item.items
        ? flattenSidebar(item.items)
        : item.id
          ? [item.id]
          : [],
  );
}

function localAsset(href, ownerPath) {
  const url = new URL(href, "https://roco-wiki.test" + ownerPath);
  if (
    url.origin !== "https://roco-wiki.test" ||
    !url.pathname.startsWith(baseUrl)
  )
    return null;
  const file = path.resolve(
    buildDirectory,
    decodeURIComponent(url.pathname.slice(baseUrl.length)),
  );
  return file.startsWith(buildDirectory + path.sep) &&
    fs.existsSync(file) &&
    fs.statSync(file).isFile()
    ? file
    : null;
}

function summarizeRadar(document) {
  const figure = document.querySelector(".rw-stats-radar");
  const svg = figure?.querySelector(".rw-stats-radar-plot > svg");
  const series = [
    ...(figure?.querySelectorAll(".rw-stats-radar-series > polygon") || []),
  ];
  return {
    figureCount: document.querySelectorAll(".rw-stats-radar").length,
    accessibleImage:
      svg?.getAttribute("role") === "img" &&
      Boolean(
        document.getElementById(svg?.getAttribute("aria-labelledby"))
          ?.textContent,
      ) &&
      Boolean(
        document.getElementById(svg?.getAttribute("aria-describedby"))
          ?.textContent,
      ),
    axes: [
      ...(figure?.querySelectorAll(
        ".rw-stats-radar-labels > text > tspan:first-child",
      ) || []),
    ].map((node) => clean(node.textContent)),
    seriesCount: series.length,
    sixFinitePointsPerSeries: series.every((polygon) => {
      const points = (polygon.getAttribute("points") || "").trim().split(/\s+/);
      return (
        points.length === 6 &&
        points.every(
          (point) =>
            point.split(",").length === 2 &&
            point.split(",").every((value) => Number.isFinite(Number(value))),
        )
      );
    }),
    colors: series.map((polygon) => polygon.getAttribute("stroke")),
    lineStyles: series.map(
      (polygon) => polygon.getAttribute("stroke-dasharray") || "solid",
    ),
    values: [
      ...(figure?.querySelectorAll(".rw-stats-radar-axis-value") || []),
    ].map((node) => Number(node.textContent)),
    scale: clean(figure?.querySelector(".rw-stats-radar-scale")?.textContent),
    legendCount:
      figure?.querySelectorAll(".rw-stats-radar-legend button").length || 0,
  };
}

function run() {
  const routeManifest = JSON.parse(
    fs.readFileSync(path.join(project, "content/routes.json"), "utf8"),
  ).map(normalizeRoute);
  const docs = readDocuments();
  const sidebars = require(path.join(project, "sidebars.js"));
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  const allRoutes = [...routeManifest, ...docs.map((doc) => doc.route)];
  const expectedFiles = allRoutes
    .map((route) =>
      route === "/" ? "index.html" : route.slice(1) + "index.html",
    )
    .concat("404.html")
    .sort();
  check(
    "Native source inventory contains 84 custom routes and 25 documents (109 distinct content routes)",
    routeManifest.length === 84 &&
      docs.length === 25 &&
      new Set(allRoutes).size === 109,
    {
      custom: routeManifest.length,
      documents: docs.length,
      distinct: new Set(allRoutes).size,
    },
  );
  check(
    "Native build directory exists",
    fs.existsSync(buildDirectory),
    relative(buildDirectory),
  );
  if (!fs.existsSync(buildDirectory)) return;
  const buildFiles = filesIn(buildDirectory);
  const htmlFiles = buildFiles.filter((file) => file.endsWith(".html"));
  const cssFiles = buildFiles.filter((file) => file.endsWith(".css"));
  const fontFiles = buildFiles.filter((file) =>
    /\.(woff2?|ttf|otf)$/i.test(file),
  );
  const actualHtml = htmlFiles
    .map((file) =>
      path.relative(buildDirectory, file).split(path.sep).join("/"),
    )
    .sort();
  inventory = {
    buildDirectory: relative(buildDirectory),
    fileCount: buildFiles.length,
    bytes: buildFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0),
    htmlCount: htmlFiles.length,
    cssCount: cssFiles.length,
    jsCount: buildFiles.filter((file) => file.endsWith(".js")).length,
    fontCount: fontFiles.length,
    imageCount: buildFiles.filter((file) =>
      /\.(png|webp|jpe?g|svg|gif)$/i.test(file),
    ).length,
    customRouteCount: routeManifest.length,
    documentRouteCount: docs.length,
    contentRouteCount: new Set(allRoutes).size,
    expectedHtmlCount: expectedFiles.length,
    htmlFiles: actualHtml,
    emptyHtmlFiles: htmlFiles
      .filter((file) => fs.statSync(file).size === 0)
      .map(relative),
  };
  check(
    "Actual native output has exactly 109 route HTML files plus 404.html",
    equal(actualHtml, expectedFiles),
    {
      missing: expectedFiles.filter((file) => !actualHtml.includes(file)),
      unexpected: actualHtml.filter((file) => !expectedFiles.includes(file)),
      count: actualHtml.length,
    },
  );
  check(
    "Every generated HTML file is nonempty",
    inventory.emptyHtmlFiles.length === 0,
    inventory.emptyHtmlFiles,
  );
  htmlSha256 = sha256(
    htmlFiles
      .map(
        (file) =>
          path.relative(buildDirectory, file) +
          "\0" +
          sha256(fs.readFileSync(file)),
      )
      .join("\n"),
  );
  const rootHtml = path.join(buildDirectory, "index.html");
  if (!fs.existsSync(rootHtml)) return;
  const rootDom = new JSDOM(fs.readFileSync(rootHtml, "utf8"));
  const canonical = rootDom.window.document
    .querySelector('link[rel="canonical"]')
    ?.getAttribute("href");
  if (canonical) baseUrl = normalizeRoute(new URL(canonical).pathname);
  rootDom.window.close();

  for (const route of [...allRoutes, "/404.html"]) {
    const filename =
      route === "/404.html"
        ? "404.html"
        : route === "/"
          ? "index.html"
          : route.slice(1) + "index.html";
    const file = path.join(buildDirectory, filename);
    if (!fs.existsSync(file)) continue;
    const dom = new JSDOM(fs.readFileSync(file, "utf8"));
    const d = dom.window.document;
    const header = d.querySelector(".rw-site-header");
    const contribution = header?.querySelector(".rw-contribute-link");
    const account = header?.querySelector(".rw-account-link");
    const mechanics = [
      ...(header?.querySelectorAll("#rw-primary-navigation a") || []),
    ].find((a) => a.getAttribute("href") === sitePath("/mechanics/"));
    const resources = [
      ...d.querySelectorAll('script[src], link[rel="stylesheet"][href]'),
    ].map((node) => node.getAttribute("src") || node.getAttribute("href"));
    const ownerPath =
      route === "/404.html" ? baseUrl + "404.html" : sitePath(route);
    const page = {
      route,
      file: relative(file),
      h1: [...d.querySelectorAll("main h1")].map((node) =>
        clean(node.textContent),
      ),
      mainTextLength: clean(d.querySelector("main")?.textContent).length,
      headerCount: d.querySelectorAll(".rw-site-header").length,
      contributionLink:
        contribution?.getAttribute("href") ===
          sitePath("/help/contributing/") &&
        clean(contribution.textContent) === "贡献指南",
      accountDirectLink:
        account?.getAttribute("href") === sitePath("/account/") &&
        clean(account.textContent) === "个人中心" &&
        !account.closest("details"),
      mechanicsDirectLink:
        clean(mechanics?.textContent) === "战斗机制" &&
        !mechanics?.closest("details"),
      feedbackTriggerCount: d.querySelectorAll(".rw-feedback-trigger").length,
      feedbackDialogCount: d.querySelectorAll(".rw-feedback-dialog").length,
      feedbackAccessible:
        d
          .querySelector(".rw-feedback-trigger")
          ?.getAttribute("aria-haspopup") === "dialog" &&
        Boolean(
          d.getElementById(
            d
              .querySelector(".rw-feedback-dialog")
              ?.getAttribute("aria-labelledby"),
          ),
        ),
      missingResources: resources.filter(
        (href) => !localAsset(href, ownerPath),
      ),
      resourceCount: resources.length,
      breadcrumbCount: d.querySelectorAll(
        ".rw-doc-breadcrumbs, .theme-doc-breadcrumbs, .rw-crumbs",
      ).length,
      hashRouterLinks: [...d.querySelectorAll("a[href]")].filter((a) =>
        a.getAttribute("href").startsWith("#/"),
      ).length,
      nativeSelectCount: d.querySelectorAll("select").length,
    };
    pageResults.push(page);

    const doc = docs.find((entry) => entry.route === route);
    if (doc) {
      const sidebarName = route.startsWith("/help/")
        ? "helpSidebar"
        : route.startsWith("/guides/")
          ? "guidesSidebar"
          : "mechanicsSidebar";
      const expectedItems = sidebars[sidebarName];
      const expectedDocIds = flattenSidebar(expectedItems);
      const expectedRoutes = expectedDocIds.map((id) =>
        sitePath(byId.get(id)?.route),
      );
      const listedInSidebar = expectedDocIds.includes(doc.id);
      // A directly addressable document omitted from a sidebar still appears as
      // the current choice. Closed CustomSelect options are not present in SSR.
      const expectedChapterRoutes = listedInSidebar
        ? expectedRoutes
        : [sitePath(route), ...expectedRoutes];
      const sidebar = d.querySelector(".theme-doc-sidebar-container");
      const currentLinks = [
        ...(sidebar?.querySelectorAll('a[aria-current="page"]') || []),
      ];
      const leafLinks = [
        ...(sidebar?.querySelectorAll(".theme-doc-sidebar-item-link > a") ||
          []),
      ];
      const topMenu = sidebar?.querySelector(".theme-doc-sidebar-menu");
      const actualTopLabels = [...(topMenu?.children || [])].map((item) =>
        clean(item.querySelector("a")?.textContent),
      );
      const expectedTopLabels = expectedItems.map((item) =>
        typeof item === "string" ? byId.get(item)?.sidebarLabel : item.label,
      );
      const headings = [...d.querySelectorAll(".theme-doc-markdown h2")].map(
        (node) => ({ id: node.id, text: clean(node.textContent) }),
      );
      const toc = [
        ...d.querySelectorAll(".theme-doc-toc-desktop .table-of-contents a"),
      ].map((a) => ({
        href: a.getAttribute("href"),
        text: clean(a.textContent),
      }));
      const select = d.querySelector(".rw-native-doc-select");
      const trigger = select?.querySelector('button[role="combobox"]');
      const currentChapterLabel = clean(
        trigger?.querySelector("span")?.textContent,
      );
      const breadcrumbs = d.querySelector(".rw-doc-breadcrumbs");
      const parent = route.startsWith("/help/")
        ? "/help/"
        : route.startsWith("/guides/")
          ? "/guides/"
          : "/mechanics/";
      const result = {
        route,
        sidebar: sidebarName,
        listedInSidebar,
        expectedChapterCount: expectedChapterRoutes.length,
        expectedChapterRoutes,
        sidebarCount: d.querySelectorAll(".theme-doc-sidebar-container").length,
        sidebarTopLabelsMatch: listedInSidebar
          ? equal(actualTopLabels, expectedTopLabels)
          : !sidebar,
        sidebarBelongsToSection: listedInSidebar
          ? leafLinks.length > 0 &&
            leafLinks.every((a) =>
              expectedRoutes.includes(a.getAttribute("href")),
            )
          : !sidebar,
        currentSidebarLink: listedInSidebar
          ? currentLinks.length === 1 &&
            currentLinks[0].getAttribute("href") === sitePath(route) &&
            currentLinks[0].classList.contains("menu__link--active")
          : currentLinks.length === 0,
        titleMatches: page.h1.length === 1 && page.h1[0] === doc.title,
        h2Count: headings.length,
        h2Authored: doc.headings,
        h2Built: headings.map((h) => h.text),
        h2SourceMatches: equal(
          headings.map((h) => h.text),
          doc.headings,
        ),
        headingIdsUnique:
          headings.every((h) => h.id) &&
          new Set(headings.map((h) => h.id)).size === headings.length,
        tocMatchesCurrentH2:
          toc.length === headings.length &&
          toc.every(
            (link, i) =>
              decodeURIComponent(link.href || "") === "#" + headings[i].id &&
              link.text === headings[i].text,
          ),
        chapterSelectCount: d.querySelectorAll(".rw-native-doc-select").length,
        chapterTriggerCount:
          select?.querySelectorAll('button[role="combobox"]').length || 0,
        chapterSelectLabel: clean(trigger?.getAttribute("aria-label")),
        chapterClosedListboxTrigger:
          Boolean(trigger?.id) &&
          trigger?.getAttribute("aria-haspopup") === "listbox" &&
          trigger?.getAttribute("aria-expanded") === "false" &&
          trigger?.getAttribute("aria-controls") === trigger?.id + "-list",
        chapterCurrentLabel: currentChapterLabel,
        chapterDisplaysCurrentTitle:
          currentChapterLabel === doc.title &&
          !trigger?.querySelector(".rw-select-placeholder"),
        chapterOptionsNotRendered:
          select?.querySelectorAll('[role="option"], [role="listbox"]')
            .length === 0,
        chapterNativeSelectCount:
          select?.querySelectorAll("select").length || 0,
        uniqueBreadcrumbs:
          page.breadcrumbCount === 1 &&
          d.querySelectorAll(".rw-doc-breadcrumbs").length === 1 &&
          d.querySelectorAll(".theme-doc-breadcrumbs, .breadcrumbs").length ===
            0,
        breadcrumbContext:
          breadcrumbs?.querySelector("a")?.getAttribute("href") ===
            sitePath(parent) &&
          clean(
            breadcrumbs?.querySelector('[aria-current="page"]')?.textContent,
          ) === doc.title,
      };
      docResults.push(result);
    }
    if (/^\/pets\/[^/]+\/$/.test(route) || route === "/tools/compare/")
      radarResults.push({ route, ...summarizeRadar(d) });
    dom.window.close();
  }

  check(
    "Every built page including 404 has one main title and pre-rendered content",
    pageResults.length === 110 &&
      pageResults.every(
        (page) => page.h1.length === 1 && page.mainTextLength > 0,
      ),
    pageResults.filter(
      (page) => page.h1.length !== 1 || page.mainTextLength === 0,
    ),
  );
  check(
    "Every native page includes exactly one shared site header",
    pageResults.every((page) => page.headerCount === 1),
    pageResults.filter((page) => page.headerCount !== 1),
  );
  check(
    "Contribution guide and account are direct header links on all native pages",
    pageResults.every(
      (page) => page.contributionLink && page.accountDirectLink,
    ),
    pageResults.filter(
      (page) => !page.contributionLink || !page.accountDirectLink,
    ),
  );
  check(
    "Battle mechanics is an independent primary navigation entry on all native pages",
    pageResults.every((page) => page.mechanicsDirectLink),
    pageResults.filter((page) => !page.mechanicsDirectLink),
  );
  check(
    "Each native page has one labelled feedback trigger and one dialog",
    pageResults.every(
      (page) =>
        page.feedbackTriggerCount === 1 &&
        page.feedbackDialogCount === 1 &&
        page.feedbackAccessible,
    ),
    pageResults.filter(
      (page) =>
        page.feedbackTriggerCount !== 1 ||
        page.feedbackDialogCount !== 1 ||
        !page.feedbackAccessible,
    ),
  );
  check(
    "Native HTML references existing local CSS and JavaScript assets",
    pageResults.every(
      (page) => page.resourceCount > 0 && page.missingResources.length === 0,
    ),
    pageResults.filter(
      (page) => !page.resourceCount || page.missingResources.length,
    ),
  );
  check(
    "Native pages contain no preview hash-router links",
    pageResults.every((page) => page.hashRouterLinks === 0),
    pageResults.filter((page) => page.hashRouterLinks),
  );
  check(
    "Native pages use the shared custom controls without native select elements",
    pageResults.every((page) => page.nativeSelectCount === 0),
    pageResults.filter((page) => page.nativeSelectCount),
  );
  check(
    "Native pages do not duplicate breadcrumb rows",
    pageResults.every((page) => page.breadcrumbCount <= 1),
    pageResults.filter((page) => page.breadcrumbCount > 1),
  );
  const sidebarValid = (doc) =>
    doc.sidebarCount === (doc.listedInSidebar ? 1 : 0) &&
    doc.titleMatches &&
    doc.sidebarTopLabelsMatch &&
    doc.sidebarBelongsToSection &&
    doc.currentSidebarLink;
  check(
    "All 25 native documents retain their title and authored sidebar assignment, including unlisted articles",
    docResults.length === 25 && docResults.every(sidebarValid),
    docResults.filter((doc) => !sidebarValid(doc)),
  );
  check(
    "All document H2 headings match authored source and have unique IDs",
    docResults.every(
      (doc) => doc.h2Count > 0 && doc.h2SourceMatches && doc.headingIdsUnique,
    ),
    docResults.filter(
      (doc) => !doc.h2Count || !doc.h2SourceMatches || !doc.headingIdsUnique,
    ),
  );
  check(
    "Each native document table of contents links to that document current H2 headings",
    docResults.every((doc) => doc.tocMatchesCurrentH2),
    docResults.filter((doc) => !doc.tocMatchesCurrentH2),
  );
  const chapterValid = (doc) =>
    doc.chapterSelectCount === 1 &&
    doc.chapterTriggerCount === 1 &&
    doc.chapterSelectLabel === "切换知识文章" &&
    doc.chapterClosedListboxTrigger &&
    doc.chapterDisplaysCurrentTitle &&
    doc.chapterOptionsNotRendered &&
    doc.chapterNativeSelectCount === 0;
  check(
    "All 25 documents pre-render one labelled custom chapter trigger showing the current title; closed options remain unmounted",
    docResults.every(chapterValid),
    docResults.filter((doc) => !chapterValid(doc)),
  );
  const sourcesDoc = docResults.find((doc) => doc.route === "/help/sources/");
  check(
    "The sources article remains directly addressable without returning to helpSidebar",
    sourcesDoc &&
      !sourcesDoc.listedInSidebar &&
      sourcesDoc.sidebarCount === 0 &&
      sourcesDoc.chapterDisplaysCurrentTitle &&
      sourcesDoc.expectedChapterRoutes[0] === sitePath("/help/sources/"),
    sourcesDoc,
  );
  check(
    "Native documents have one custom breadcrumb with correct section and current title",
    docResults.every((doc) => doc.uniqueBreadcrumbs && doc.breadcrumbContext),
    docResults.filter(
      (doc) => !doc.uniqueBreadcrumbs || !doc.breadcrumbContext,
    ),
  );

  const sourceData = JSON.parse(
    fs.readFileSync(path.join(project, "content/pet-sources.json"), "utf8"),
  );
  const sourcePets = Array.isArray(sourceData) ? sourceData : sourceData.pets;
  const petRadars = radarResults.filter((radar) =>
    radar.route.startsWith("/pets/"),
  );
  const axes = ["精力", "物攻", "物防", "魔攻", "魔抗", "速度"];
  check(
    "Every catalogued pet detail pre-renders one accessible six-axis radar",
    petRadars.length === sourcePets.length &&
      petRadars.every(
        (radar) =>
          radar.figureCount === 1 &&
          radar.accessibleImage &&
          equal(radar.axes, axes) &&
          radar.seriesCount === 1 &&
          radar.sixFinitePointsPerSeries,
      ),
    petRadars.filter(
      (radar) =>
        radar.figureCount !== 1 ||
        !radar.accessibleImage ||
        !equal(radar.axes, axes) ||
        radar.seriesCount !== 1 ||
        !radar.sixFinitePointsPerSeries,
    ),
  );
  check(
    "Pet radar axis values match the exact source stats",
    petRadars.every((radar) =>
      equal(
        radar.values,
        sourcePets.find((pet) => "/pets/" + pet.slug + "/" === radar.route)
          ?.stats,
      ),
    ),
    petRadars.filter(
      (radar) =>
        !equal(
          radar.values,
          sourcePets.find((pet) => "/pets/" + pet.slug + "/" === radar.route)
            ?.stats,
        ),
    ),
  );
  const comparison = radarResults.find(
    (radar) => radar.route === "/tools/compare/",
  );
  check(
    "Default comparison pre-renders two accessible series, six axes and two legend controls",
    comparison?.figureCount === 1 &&
      comparison.accessibleImage &&
      equal(comparison.axes, axes) &&
      comparison.seriesCount === 2 &&
      comparison.sixFinitePointsPerSeries &&
      comparison.legendCount === 2,
    comparison,
  );
  check(
    "Default comparison uses distinct colors and line styles on one scale",
    comparison &&
      new Set(comparison.colors).size === 2 &&
      new Set(comparison.lineStyles).size === 2 &&
      /统一刻度 0–\d+/.test(comparison.scale),
    comparison,
  );

  for (const cssFile of cssFiles) {
    const css = fs.readFileSync(cssFile, "utf8");
    const ownerPath =
      baseUrl +
      path.relative(buildDirectory, cssFile).split(path.sep).join("/");
    for (const match of css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
      if (!/font-family\s*:\s*["']?Roco Wiki Serif["']?\s*;/i.test(match[1]))
        continue;
      const urls = [
        ...match[1].matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/g),
      ].map((item) => item[1]);
      for (const url of urls) {
        const file = localAsset(url, ownerPath);
        const buffer = file ? fs.readFileSync(file) : null;
        fontResults.push({
          css: relative(cssFile),
          url,
          localFile: file ? relative(file) : null,
          bytes: buffer?.length || 0,
          sha256: buffer ? sha256(buffer) : null,
          woff2Signature: buffer?.subarray(0, 4).toString() === "wOF2",
          weight600: /font-weight\s*:\s*600(?:;|$)/.test(match[1]),
          displaySwap: /font-display\s*:\s*swap(?:;|$)/.test(match[1]),
        });
      }
    }
  }
  check(
    "Native compiled CSS uses the local serif WOFF2 at weight 600 with font-display swap",
    fontResults.length > 0 &&
      fontResults.every(
        (font) =>
          font.localFile &&
          font.woff2Signature &&
          font.weight600 &&
          font.displaySwap,
      ),
    fontResults,
  );
  const sourceFont = path.join(
    project,
    "static/fonts/roco-wiki-serif-600.woff2",
  );
  const sourceFontSha = sha256(fs.readFileSync(sourceFont));
  const copiedFont = path.join(
    buildDirectory,
    "fonts/roco-wiki-serif-600.woff2",
  );
  const copiedManifest = path.join(buildDirectory, "fonts/FONT-SOURCE.json");
  const copiedLicense = path.join(
    buildDirectory,
    "fonts/OFL-Noto-Serif-SC.txt",
  );
  check(
    "Hashed native font and copied static font match the authored local asset",
    fontResults.length > 0 &&
      fontResults.every((font) => font.sha256 === sourceFontSha) &&
      fs.existsSync(copiedFont) &&
      sha256(fs.readFileSync(copiedFont)) === sourceFontSha,
    { sourceFontSha256: sourceFontSha, fonts: fontResults },
  );
  check(
    "Built font includes its source manifest and original OFL license",
    fs.existsSync(copiedManifest) &&
      JSON.parse(fs.readFileSync(copiedManifest, "utf8")).outputSha256 ===
        sourceFontSha &&
      fs.existsSync(copiedLicense) &&
      /SIL OPEN FONT LICENSE/i.test(fs.readFileSync(copiedLicense, "utf8")),
    {
      sourceManifest: relative(copiedManifest),
      license: relative(copiedLicense),
    },
  );

  const typeIcons = JSON.parse(
    fs.readFileSync(path.join(project, "content/pet-metadata-v6.json"), "utf8"),
  ).typeIcons;
  for (const [type, icon] of Object.entries(typeIcons)) {
    const file = path.join(buildDirectory, icon.path.replace(/^\//, ""));
    const buffer = fs.existsSync(file) ? fs.readFileSync(file) : null;
    typeIconResults.push({
      type,
      file: relative(file),
      bytes: buffer?.length || 0,
      sha256: buffer ? sha256(buffer) : null,
      pngSignature:
        buffer
          ?.subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || false,
      originalBytesMatch:
        Boolean(buffer) &&
        buffer.length === icon.bytes &&
        sha256(buffer) === icon.sha256,
      provenancePresent: Boolean(
        icon.sourceUrl && icon.observedOn && icon.ownership,
      ),
    });
  }
  check(
    "All 21 game attribute icons retain the recorded PNG bytes and provenance in native output",
    typeIconResults.length === 21 &&
      typeIconResults.every(
        (icon) =>
          icon.pngSignature &&
          icon.originalBytesMatch &&
          icon.provenancePresent,
      ),
    typeIconResults.filter(
      (icon) =>
        !icon.pngSignature ||
        !icon.originalBytesMatch ||
        !icon.provenancePresent,
    ),
  );
}

try {
  run();
} catch (error) {
  check(
    "Static build validation completes without a parser or input error",
    false,
    { message: error.message },
  );
}
const report = {
  status: checks.length && checks.every((item) => item.pass) ? "PASS" : "FAIL",
  scope:
    "Native Docusaurus build files and non-executing jsdom HTML structure only. Closed custom chapter controls show their current label; unmounted options and groups are not verified here. No browser visual, layout, animation, performance, hydration, navigation or server checks.",
  ranAt: new Date().toISOString(),
  baseUrl,
  checkCount: checks.length,
  checks,
  build: inventory,
  htmlSha256,
  pageResults,
  docResults,
  radarResults,
  fontResults,
  typeIconResults,
};
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      status: report.status,
      checks: report.checkCount,
      buildFileCount: inventory.fileCount,
      htmlCount: inventory.htmlCount,
      contentRoutes: inventory.contentRouteCount,
      documents: docResults.length,
      emptyHtmlFiles: inventory.emptyHtmlFiles,
      failed: checks.filter((item) => !item.pass).map((item) => item.name),
      results: relative(outputPath),
    },
    null,
    2,
  ),
);
process.exitCode = report.status === "PASS" ? 0 : 1;
