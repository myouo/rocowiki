import { build } from "esbuild";
import { marked } from "marked";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { buildPublishedDocs } from "./build-published-docs.mjs";
const published = await buildPublishedDocs();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
execFileSync(
  process.execPath,
  [path.join(root, "scripts/build-section-snapshots.cjs")],
  { cwd: root, stdio: "inherit" },
);
async function files(dir) {
  let out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(p)));
    else if (/\.mdx?$/.test(p)) out.push(p);
  }
  return out;
}
const docFiles = await files(path.join(root, "docs"));
const docs = {},
  fileRoute = {};
for (const f of docFiles) {
  const text = await fs.readFile(f, "utf8"),
    front = text.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = {};
  for (const line of (front?.[1] || "").split("\n")) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) meta[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  const route = "/" + String(meta.slug || "").replace(/^\/+|\/+$/g, "") + "/";
  fileRoute[f] = route;
  docs[route] = {
    title: meta.title,
    source: f,
    body: text.replace(/^---\n[\s\S]*?\n---\n/, ""),
  };
}
for (const [route, doc] of Object.entries(docs)) {
  let body = doc.body.replace(
    /\]\(([^)]+\.mdx?)(#[^)]*)?\)/g,
    (_, rel, hash) =>
      "](" +
      (fileRoute[path.resolve(path.dirname(doc.source), rel)] || rel) +
      (hash || "") +
      ")",
  );
  doc.headings = [];
  let index = 0,
    sub = 0;
  const escapeAttr = (text) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
  doc.html = String(await marked.parse(body)).replace(
    /<h([2-6])>([\s\S]*?)<\/h[2-6]>/g,
    (_, level, heading) => {
      if (level === "2") {
        index++;
        sub = 0;
      } else {
        sub++;
      }
      const id =
        level === "2" ? `section-${index}` : `subsection-${index}-${sub}`;
      const title = heading.replace(/<[^>]+>/g, "");
      if (level === "2") doc.headings.push({ id, text: title });
      const href =
        "/edit/?" +
        new URLSearchParams({
          entity: doc.title,
          section: title,
          mode: "article",
          returnTo: route + "#" + id,
        });
      const edit =
        '<span class="rw-inline-section-edit"><a class="rw-edit-entry" href="' +
        escapeAttr(href) +
        '" aria-label="' +
        escapeAttr("编辑本节：" + title) +
        '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5"/></svg><span>编辑</span></a></span>';
      return `<h${level} id="${id}" data-has-editor="true">${heading}${edit}</h${level}>`;
    },
  );
  delete doc.body;
  delete doc.source;
}
await fs.writeFile(
  path.join(root, "preview/generated-docs.json"),
  JSON.stringify(docs, null, 2),
);
const result = await build({
  entryPoints: [path.join(root, "preview/main.jsx")],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    "@docusaurus/Head": path.join(root, "preview/head.tsx"),
    "@docusaurus/useDocusaurusContext": path.join(root, "preview/docusaurus-context.js"),
    "@docusaurus/useBrokenLinks": path.join(root, "preview/broken-links.js"),
    "@docusaurus/useBaseUrl": path.join(root, "preview/base-url.js"),
    "@docusaurus/Link": path.join(root, "preview/router.jsx"),
    "@docusaurus/router": path.join(root, "preview/router.jsx"),
    "@theme/Layout": path.join(root, "preview/layout.jsx"),
  },
  loader: { ".css": "empty" },
  plugins: [
    {
      name: "embed-local-pet-art",
      setup(b) {
        b.onLoad({ filter: /pet-metadata-v6\.json$/ }, async (args) => {
          const metadata = JSON.parse(await fs.readFile(args.path, "utf8"));
          for (const icon of Object.values(metadata.typeIcons || {})) {
            if (icon.path?.startsWith("/img/"))
              icon.path =
                "data:image/png;base64," +
                (
                  await fs.readFile(path.join(root, "static", icon.path))
                ).toString("base64");
          }
          return { contents: JSON.stringify(metadata), loader: "json" };
        });
        b.onLoad({ filter: /pet-appearances-v72\.json$/ }, async (args) => {
          const metadata = JSON.parse(await fs.readFile(args.path, "utf8"));
          for (const appearances of Object.values(metadata.pets || {})) {
            for (const appearance of appearances) {
              if (!appearance.image?.startsWith("/img/")) continue;
              const mime = /\.jpe?g$/i.test(appearance.image) ? "jpeg" : "png";
              appearance.image = "data:image/" + mime + ";base64," + (await fs.readFile(path.join(root, "static", appearance.image))).toString("base64");
            }
          }
          return { contents: JSON.stringify(metadata), loader: "json" };
        });
        b.onLoad({ filter: /pet-sources\.json$/ }, async (args) => {
          const records = JSON.parse(await fs.readFile(args.path, "utf8"));
          for (const p of records) {
            if (p.image?.startsWith("/img/"))
              p.image =
                "data:image/" +
                (p.image.endsWith(".webp") ? "webp" : "png") +
                ";base64," +
                (
                  await fs.readFile(path.join(root, "static", p.image))
                ).toString("base64");
          }
          return { contents: JSON.stringify(records), loader: "json" };
        });
      },
    },
  ],
});
const cssResult = await build({
  entryPoints: [path.join(root, "src/css/custom.css")],
  bundle: true,
  write: false,
  minify: true,
  loader: {
    ".css": "css",
    ".woff2": "dataurl",
    ".webp": "dataurl",
    ".png": "dataurl",
  },
});
const css = cssResult.outputFiles[0].text;
const js = result.outputFiles.find(
  (f) => f.path.endsWith(".js") || f.path === "<stdout>",
).text;
const html =
  '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>RocoWiki · 全页面设计预览</title><meta name="description" content="洛克王国页游 Wiki 全页面交互预览，与原生 Docusaurus 工程共用 React 组件。"><style>' +
  css.replaceAll("</style", "<\\/style") +
  '</style></head><body><div id="root"></div><noscript>此交互预览需要启用 JavaScript。原生 Docusaurus 构建提供可静态阅读的页面。</noscript><script>' +
  js.replaceAll("</script", "<\\/script") +
  "</script></body></html>";
await fs.mkdir(path.join(root, "dist"), { recursive: true });
await fs.writeFile(path.join(root, "dist/index.html"), html);
await fs.writeFile(path.join(root, "RocoWiki_UI_V7_3_1.html"), html);
console.log(
  JSON.stringify(
    {
      output: "RocoWiki_UI_V7_3_1.html",
      bytes: Buffer.byteLength(html),
      docs: Object.keys(docs).length,
      framework: "shared React components; native Docusaurus source alongside",
    },
    null,
    2,
  ),
);
