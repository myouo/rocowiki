import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const readJson = async (name) =>
  JSON.parse(await fs.readFile(path.join(root, name), "utf8"));
const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");
const escape = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const cell = (value) =>
  String(value ?? "")
    .replaceAll("|", "\\|")
    .replace(/[\r\n]+/g, " ");
async function optionalBytes(name) {
  try {
    return await fs.readFile(path.resolve(root, name));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
async function filesIn(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const groups = await Promise.all(
    entries.map(async (entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? filesIn(file) : entry.isFile() ? [file] : [];
    }),
  );
  return groups.flat().sort();
}
const [design, routes, docs, petMetadata, weekly, pve, assets, fontMetadata] =
  await Promise.all([
    readJson("archive/design/design-v6.json"),
    readJson("content/routes.json"),
    readJson("preview/generated-docs.json"),
    readJson("content/pet-metadata-v6.json"),
    readJson("content/weekly-v5.json"),
    readJson("content/pve-v6.json"),
    readJson("content/asset-sources.json"),
    readJson("static/fonts/FONT-SOURCE.json"),
  ]);
const previewFile = design.previewFile || "RocoWiki_UI_V6.html";
const outputFile = design.outputFile || "RocoWiki_Design_V6.html";
const previewBytes = await optionalBytes(previewFile);
const previewSha256 = previewBytes ? sha256(previewBytes) : null;
const buildDirectory = path.join(root, "build");
const buildFiles = await filesIn(buildDirectory);
const htmlFiles = buildFiles.filter((file) => file.endsWith(".html"));
const htmlRecords = await Promise.all(
  htmlFiles.map(async (file) => ({ file, bytes: await fs.readFile(file) })),
);
const nativeHtmlSha256 = htmlRecords.length
  ? sha256(
      htmlRecords
        .map(
          ({ file, bytes }) =>
            path.relative(buildDirectory, file) + "\0" + sha256(bytes),
        )
        .join("\n"),
    )
  : null;
const allRoutes = [...new Set([...routes, ...Object.keys(docs)])];
const petRows = Object.entries(petMetadata.pets || {});
const petNames = Object.fromEntries(
  (assets.assets || []).map((asset) => [asset.slug, asset.name]),
);
const matchups = petRows.flatMap(([slug, pet]) =>
  ["pve", "pvp"].flatMap((mode) =>
    (pet.matchups?.[mode] || []).map((record) => ({ slug, mode, ...record })),
  ),
);
const acquisitionCount = petRows.reduce(
  (sum, [, pet]) => sum + (pet.acquisitionHistory?.length || 0),
  0,
);
const periods = weekly.pvp?.typeTournament?.periods || [];
const ladder = weekly.pvp?.ladder || {};
const matchupTable = matchups.length
  ? [
      "| 宠物 | 模式 | 对手 | 记录日期 | 本站复现 | 资料出处 |",
      "| --- | --- | --- | --- | --- | --- |",
      ...matchups.map(
        (record) =>
          "| " +
          [
            petNames[record.slug] || record.slug,
            record.mode.toUpperCase(),
            record.opponent,
            record.recordedAt || "原文未载明",
            record.testedAt || "尚未复现",
            record.sourceUrl
              ? `[${cell(record.sourceLabel || "原始来源")}](${record.sourceUrl})`
              : "来源待补",
          ]
            .map(cell)
            .join(" | ") +
          " |",
      ),
    ].join("\n")
  : "当前尚未收录具体对位记录；请以页面待补状态为准。";
const counts = {
  customRouteCount: routes.length,
  docCount: Object.keys(docs).length,
  routeCount: allRoutes.length,
  mechanicsDocCount: Object.keys(docs).filter((route) =>
    route.startsWith("/mechanics/"),
  ).length,
  expectedHtmlCount: allRoutes.length + 1,
  nativeHtmlCount: htmlFiles.length || "待构建",
  nativeFileCount: buildFiles.length || "待构建",
  petCount: petRows.length,
  petImageCount: (assets.assets || []).length,
  typeIconCount: Object.keys(petMetadata.typeIcons || {}).length,
  acquisitionCount,
  matchupCount: matchups.length,
  pveMatchupCount: matchups.filter((record) => record.mode === "pve").length,
  pvpMatchupCount: matchups.filter((record) => record.mode === "pvp").length,
  pveGuideCount: (pve.guides || []).length,
  newEventCount: weekly.events.filter((event) =>
    ["new", "new_permanent"].includes(event.category),
  ).length,
  continuingEventCount: weekly.events.filter(
    (event) => event.category === "continuing",
  ).length,
  endingEventCount: weekly.events.filter((event) => event.category === "ending")
    .length,
  fontBytes: fontMetadata.outputBytes ?? "未记录",
  fontCharacters: fontMetadata.coveredCharacters ?? "未记录",
};
const tokens = {
  ...counts,
  matchupTable,
  editionStartDate: weekly.edition.startDate,
  reviewDueDate: weekly.edition.reviewDueDate,
  ladderStartDate: ladder.startDate || "未记录",
  ladderBannedCount: ladder.bannedPets?.length ?? "未记录",
  typeOneDate: periods[0]?.startDate || "未记录",
  typeOneTypes: periods[0]?.types?.join("、") || "未记录",
  typeOneBannedCount: periods[0]?.bannedPets?.length ?? "未记录",
  typeTwoDate: periods[1]?.startDate || "未记录",
  typeTwoTypes: periods[1]?.types?.join("、") || "未记录",
  typeTwoBannedCount: periods[1]?.bannedPets?.length ?? "未记录",
};
const markdown = design.markdown.replace(
  /\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g,
  (_, key) => {
    if (!(key in tokens)) throw new Error("Unknown report token: " + key);
    return String(tokens[key]);
  },
);

const suites = [
  {
    file: "v6-interface-check-results.json",
    title: "全站界面、导航与关联编辑",
  },
  { file: "v6-catalog-check-results.json", title: "图鉴、技能与条件对位" },
  { file: "v6-pve-weekly-check-results.json", title: "PVE、World 与活动日期" },
  { file: "v6-calculator-check-results.json", title: "计算函数与工具交互" },
  { file: "v6-review-check-results.json", title: "投稿、修订与审阅流程" },
  { file: "v6-native-check-results.json", title: "原生 Docusaurus 静态构建" },
];
const statusLabels = {
  PASS: "通过",
  FAIL: "失败",
  PENDING: "待运行",
  STALE: "待复跑",
  ERROR: "读取失败",
};
async function fingerprint(data, file) {
  if (data.sourceSha256 && typeof data.sourceSha256 === "object") {
    const changed = [];
    const entries = Object.entries(data.sourceSha256);
    for (const [name, expected] of entries) {
      const absolute = path.resolve(root, name);
      if (!absolute.startsWith(root + path.sep)) {
        changed.push(name);
        continue;
      }
      const bytes = await optionalBytes(name);
      if (!bytes || sha256(bytes) !== expected) changed.push(name);
    }
    return entries.length
      ? {
          matches: changed.length === 0,
          note: changed.length
            ? "关联源码已变化：" + changed.join("、")
            : "关联源码摘要一致",
        }
      : { matches: null, note: "未记录可比对摘要" };
  }
  const native = file === "v6-native-check-results.json";
  const recorded = native
    ? data.htmlSha256
    : data.previewSha256 || data.artifactSha256 || data.sha256;
  const current = native ? nativeHtmlSha256 : previewSha256;
  if (!recorded) return { matches: null, note: "报告未记录产物摘要" };
  if (!current)
    return {
      matches: false,
      note: native
        ? "原生构建不存在，需构建后复跑"
        : "预览不存在，需构建后复跑",
    };
  return {
    matches: recorded === current,
    note:
      recorded === current ? "当前产物摘要一致" : "当前产物已变化，请重新验证",
  };
}
const reports = await Promise.all(
  suites.map(async (suite) => {
    let data;
    try {
      data = await readJson("validation/" + suite.file);
    } catch (error) {
      return {
        ...suite,
        data: null,
        status: error.code === "ENOENT" ? "PENDING" : "ERROR",
        checkCount: null,
        note:
          error.code === "ENOENT"
            ? "尚未生成这份报告"
            : "JSON 无法读取或解析：" + error.message,
      };
    }
    const checks = Array.isArray(data.checks) ? data.checks : [];
    const checkCount = Number.isFinite(data.checkCount)
      ? data.checkCount
      : Number.isFinite(data.total)
        ? data.total
        : checks.length;
    const values = checks.map((item) =>
      typeof item.pass === "boolean"
        ? item.pass
        : typeof item.passed === "boolean"
          ? item.passed
          : null,
    );
    const failed =
      values.includes(false) ||
      (data.runtimeErrors?.length || 0) > 0 ||
      (data.consoleErrors?.length || 0) > 0;
    let declared = String(data.status || "").toUpperCase();
    if (!declared)
      declared =
        checkCount > 0 &&
        ((values.length === checkCount &&
          values.every((value) => value === true)) ||
          data.passed === checkCount)
          ? "PASS"
          : failed
            ? "FAIL"
            : "PENDING";
    if (!["PASS", "FAIL", "PENDING"].includes(declared)) declared = "PENDING";
    if (failed) declared = "FAIL";
    const current = await fingerprint(data, suite.file);
    let status = declared;
    if (
      status === "PASS" &&
      (checkCount <= 0 || (checks.length > 0 && checkCount !== checks.length))
    )
      status = "ERROR";
    else if (status === "PASS" && current.matches === false) status = "STALE";
    return {
      ...suite,
      data,
      status,
      declared,
      checkCount,
      note: current.note,
      fingerprintMatches: current.matches,
    };
  }),
);
const completed = reports.filter((report) => report.data).length;
const totalChecks = reports.reduce(
  (sum, report) =>
    sum + (Number.isFinite(report.checkCount) ? report.checkCount : 0),
  0,
);
const currentPassing = reports.filter(
  (report) => report.status === "PASS",
).length;
const failing = reports.filter((report) =>
  ["FAIL", "ERROR"].includes(report.status),
).length;
const pending = reports.filter((report) =>
  ["PENDING", "STALE"].includes(report.status),
).length;
const pill = (status) =>
  `<span class="state ${status.toLowerCase()}">${escape(statusLabels[status] || status)}</span>`;
const proofRows = reports
  .map(
    (report) =>
      `<tr><th scope="row">${escape(report.title)}<small>${escape(report.file)}</small></th><td>${pill(report.status)}</td><td class="num">${report.checkCount ?? "—"}</td><td>${escape(report.note)}</td></tr>`,
  )
  .join("");
const proofDetails = reports
  .map(
    (report) =>
      `<details class="proof"><summary>${escape(report.title)} · ${escape(statusLabels[report.status])}${report.checkCount === null ? "" : ` · ${report.checkCount} 项`}</summary>${report.data ? `<p>${escape(report.data.scope || "报告未单列检查范围")}</p><p class="muted">${escape(report.note)}${report.declared !== report.status ? `；原报告状态 ${escape(report.declared)}` : ""}</p><pre>${escape(JSON.stringify(report.data, null, 2))}</pre>` : `<p>${escape(report.note)}</p>`}</details>`,
  )
  .join("");
let body = await marked.parse(markdown);
const headings = [];
body = body.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, title) => {
  const id = "report-section-" + (headings.length + 1);
  headings.push({ id, title: title.replace(/<[^>]*>/g, "") });
  return `<h2 id="${id}">${title}</h2>`;
});
body = body
  .replaceAll("<table>", '<div class="table-scroll"><table>')
  .replaceAll("</table>", "</table></div>");
const toc =
  headings
    .map((heading) => `<a href="#${heading.id}">${heading.title}</a>`)
    .join("") +
  '<a href="#report-checks">自动汇总 · 检查记录</a><a href="#report-routes">附录 · 实际路由</a>';
const inventory = [
  [
    "内容地址",
    `${counts.routeCount}`,
    `${counts.customRouteCount} 个自定义路由 + ${counts.docCount} 篇 docs`,
  ],
  [
    "原生 HTML",
    `${counts.nativeHtmlCount}`,
    `预期 ${counts.expectedHtmlCount} 页，包含 404`,
  ],
  [
    "宠物样本",
    `${counts.petCount}`,
    `${counts.typeIconCount} 个属性图标；不是全量图鉴`,
  ],
  [
    "历史资料",
    `${counts.acquisitionCount} / ${counts.matchupCount}`,
    "获取记录 / 条件对位记录，按宠物计",
  ],
];
const inventoryHtml = `<dl class="inventory" aria-label="从当前工程读取的规模">${inventory.map(([label, value, detail]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}<small>${escape(detail)}</small></dd></div>`).join("")}</dl>`;
const routeList = allRoutes
  .map(
    (route) =>
      `<a href="${escape(previewFile + "#" + route)}"><code>${escape(route)}</code></a>`,
  )
  .join("");
const fontBytes = await optionalBytes("static/fonts/roco-wiki-serif-600.woff2");
const fontFace = fontBytes
  ? `@font-face{font-family:ReportSerif;src:url(data:font/woff2;base64,${fontBytes.toString("base64")}) format('woff2');font-weight:600;font-display:swap}`
  : "";
const css = `${fontFace}
*{box-sizing:border-box}html{scroll-padding-top:20px}body{margin:0;background:#fff;color:#46515f;font:15px/1.9 -apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif}a{color:#315d8b;text-underline-offset:3px}a:focus-visible,summary:focus-visible{outline:2px solid #9a6a2f;outline-offset:4px}.masthead{max-width:1320px;margin:auto;padding:28px 42px 22px;border-bottom:1px solid #dfe3e8;display:flex;justify-content:space-between;align-items:baseline;gap:20px}.wordmark{font:34px/1.2 Georgia,'Times New Roman',serif;color:#293b50;letter-spacing:-1px}.edition{font-size:12px;color:#778290}.frame{max-width:1320px;margin:auto;padding:24px 42px 70px;display:grid;grid-template-columns:220px minmax(0,1fr);gap:44px}.contents{position:sticky;top:24px;align-self:start;max-height:calc(100vh - 48px);overflow:auto;font-size:12px;padding-right:15px}.contents strong{display:block;color:#516276;font-size:13px;margin-bottom:10px}.contents a{display:block;color:#637385;text-decoration:none;padding:5px 0;line-height:1.65}.contents a:hover{color:#315d8b;text-decoration:underline}main{min-width:0}h1,h2,h3{font-family:ReportSerif,'Noto Serif SC','Songti SC',SimSun,serif;color:#263448;font-weight:600;line-height:1.6}h1{font-size:31px;margin:0 0 20px}h2{font-size:23px;border-bottom:1px solid #dfe3e8;padding-bottom:10px;margin:38px 0 17px;scroll-margin-top:20px}h3{font-size:19px;margin:25px 0 13px}p{margin:12px 0 18px}strong{color:#33465d}ul,ol{padding-left:24px}li{margin:6px 0}.inventory{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin:0 0 30px;border-block:1px solid #dfe3e8;background:#fafbfc}.inventory>div{padding:15px;border-right:1px solid #e4e8ed}.inventory>div:last-child{border-right:0}.inventory dt{font-size:11px;color:#778290}.inventory dd{margin:3px 0;font-size:26px;color:#334a63;font-variant-numeric:tabular-nums;line-height:1.4}.inventory small{display:block;font-size:11px;line-height:1.7;color:#7b8490}.table-scroll{overflow:auto;margin:20px 0 25px}table{border-collapse:collapse;width:100%;font-size:12px;line-height:1.85;background:#fff}td,th{border:1px solid #dfe3e8;padding:10px 12px;text-align:left;vertical-align:top}thead th{background:#f5f6f8;color:#506074;font-weight:600}tbody th{font-weight:500;color:#52657b;background:#fafbfc}th small{display:block;font-size:11px;font-weight:400;color:#818b96;overflow-wrap:anywhere}td.num{font-variant-numeric:tabular-nums;text-align:right}code{font-size:12px;background:#f3f5f7;padding:2px 5px;border-radius:3px;overflow-wrap:anywhere}pre{font-size:11px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f6f8;padding:16px;max-height:480px;overflow:auto}.state{display:inline-block;font-size:11px;line-height:1.6;white-space:nowrap;padding:3px 8px;border:1px solid #d6e1ee;background:#edf3fa;color:#315d8b;border-radius:3px}.state.fail,.state.error{color:#914847;background:#fff4f3;border-color:#e8cccc}.state.pending,.state.stale{color:#8a6b37;background:#fffaee;border-color:#e6d8b9}.proof{border-block:1px solid #e2e6eb;padding:12px 0;margin:9px 0}.proof summary{cursor:pointer;font-size:13px;color:#52657c}.proof p{font-size:12px;overflow-wrap:anywhere}.muted,.generated{color:#7b8592;font-size:12px}.proof-summary{border-left:3px solid #94a8bf;padding:10px 15px;background:#f5f7fa;font-size:13px}.routes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 15px}.routes a{display:block;text-decoration:none}.routes code{display:block;background:#fafbfc;border-bottom:1px solid #e7ebef;padding:7px 9px;font-size:11px}.artifact-note{font-size:11px;color:#7d8795;border-top:1px solid #dfe3e8;padding-top:20px;margin-top:30px;overflow-wrap:anywhere}@media(max-width:1000px){.frame{grid-template-columns:180px minmax(0,1fr);gap:25px;padding-inline:25px}.masthead{padding-inline:25px}.inventory{grid-template-columns:repeat(2,minmax(0,1fr))}.inventory>div:nth-child(2){border-right:0}.inventory>div:nth-child(-n+2){border-bottom:1px solid #e4e8ed}}@media(max-width:760px){.masthead{display:block;padding:22px 20px 17px}.edition{display:block;margin-top:10px}.frame{display:block;padding:18px 20px 45px}.contents{position:static;max-height:none;padding:0 0 20px;margin:0 0 25px;border-bottom:1px solid #dfe3e8;column-count:2;column-gap:20px}.contents strong{column-span:all}.contents a{break-inside:avoid;font-size:11px}h1{font-size:28px}h2{font-size:21px}.inventory>div{padding:12px}.inventory dd{font-size:23px}.routes{grid-template-columns:1fr}td,th{min-width:115px;padding:9px 10px}.wordmark{font-size:31px}}@media print{body{font-size:10px}.masthead{padding:0 0 12px}.frame{display:block;padding:0}.contents,.proof,.routes{display:none}.inventory{grid-template-columns:repeat(4,1fr);font-size:10px}.inventory dd{font-size:19px}h1{font-size:25px}h2{font-size:17px;break-after:avoid}h3{font-size:14px}table{font-size:9px}td,th{padding:5px 7px}a{color:#33465d}.table-scroll{overflow:visible}.artifact-note{font-size:9px}}
`;
const generatedAt = new Date().toISOString();
const summary = `已读取 ${completed} / ${suites.length} 组报告，累计 ${totalChecks} 个检查条目。当前通过 ${currentPassing} 组，失败或读取异常 ${failing} 组，待运行或复跑 ${pending} 组。各组范围可能重叠，累计数量不代表独立用户场景数量。`;
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(design.title)}</title><style>${css}</style></head><body><header class="masthead"><span class="wordmark">RocoWiki</span><span class="edition">${escape(design.version)} · 界面系统与交付记录 · ${escape(design.updatedAt)}</span></header><div class="frame"><nav class="contents" aria-label="设计报告目录"><strong>本报告内容</strong>${toc}</nav><main>${inventoryHtml}${body}<h2 id="report-checks">自动汇总 · 实际检查记录</h2><p class="proof-summary">${escape(summary)}</p><p>以下为计算回归、受控 DOM 与原生静态产物检查。没有浏览器视觉、布局、动画性能、线上服务或当前游戏实机通过结论。</p><div class="table-scroll"><table><thead><tr><th>检查范围</th><th>当前结果</th><th>检查数量</th><th>产物或源码一致性</th></tr></thead><tbody>${proofRows}</tbody></table></div>${proofDetails}<h2 id="report-routes">附录 · ${allRoutes.length} 个实际内容地址</h2><p>${routes.length} 个自定义路由、${Object.keys(docs).length} 篇 docs；原生产物当前扫描到 ${htmlFiles.length} 个 HTML、${buildFiles.length} 个文件。预期 HTML 比内容地址多一个独立 404 页面。点击以下路径可打开同目录的交互预览。</p><div class="routes">${routeList}</div><footer class="artifact-note"><p>生成时间（UTC）：${escape(generatedAt)}。资料快照：${escape(weekly.edition.startDate)}；生成报告不会更新游戏资料。</p><p>预览 SHA-256：${escape(previewSha256 || "预览尚未生成")}<br>原生 HTML 集合 SHA-256：${escape(nativeHtmlSha256 || "原生产物尚未生成")}</p><p>来源文件：archive/design/design-v6.json、content/routes.json、preview/generated-docs.json、content/pet-metadata-v6.json、content/weekly-v5.json、content/pve-v6.json、字体元数据与六份 V6 检查报告。</p></footer></main></div></body></html>`;
if (/\{\{[A-Za-z][A-Za-z0-9]*\}\}/.test(html))
  throw new Error("Unresolved placeholder in report output");
if (!checkOnly) await fs.writeFile(path.join(root, outputFile), html);
console.log(
  JSON.stringify(
    {
      mode: checkOnly ? "check-only; no output written" : "written",
      file: outputFile,
      bytes: Buffer.byteLength(html),
      counts,
      reports: reports.map(({ file, status, checkCount, note }) => ({
        file,
        status,
        checkCount,
        note,
      })),
      totalChecks,
      previewSha256,
      nativeHtmlSha256,
    },
    null,
    2,
  ),
);
