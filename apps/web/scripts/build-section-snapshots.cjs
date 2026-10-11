/** Read-only section snapshots are generated from this release's actual rendered components. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { build } = require("esbuild");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(
  path.join(os.tmpdir(), "roco-published-sections-"),
);
const bundle = path.join(temporary, "render.cjs");
const routes = JSON.parse(
  fs.readFileSync(path.join(root, "content/routes.json"), "utf8"),
).filter(
  (route) =>
    !/^\/(edit|account|review|history|feedback|search|community)\//.test(route),
);

function asMarkdown(node) {
  if (node.nodeType === 3) return node.textContent.replace(/\s+/g, " ");
  if (node.nodeType !== 1) return "";
  const tag = node.tagName.toLowerCase();
  if (
    [
      "svg",
      "button",
      "input",
      "textarea",
      "select",
      "script",
      "style",
      "img",
      "nav",
    ].includes(tag) ||
    node.matches(
      ".rw-edit-entry,.rw-section-actions,.rw-inline-section-edit,.rw-actions,.rw-breadcrumbs,.rw-prototype-label,.rw-contribution,.rw-select,.rw-toc,.rw-published-section>details",
    )
  )
    return "";
  const inside = () => [...node.childNodes].map(asMarkdown).join("");
  if (tag === "br") return "\n";
  if (tag === "a") {
    const text = inside().trim();
    let href = node.getAttribute("href") || "";
    if (href.startsWith("#/")) href = href.slice(1);
    return text && /^(\/|https?:|#)/.test(href) ? `[${text}](${href})` : text;
  }
  if (tag === "table") {
    const rows = [...node.querySelectorAll("tr")]
      .map((tr) =>
        [...tr.children]
          .filter((td) => ["TD", "TH"].includes(td.tagName))
          .map((td) =>
            asMarkdown(td).trim().replace(/\n+/g, " · ").replace(/\|/g, "\\|"),
          ),
      )
      .filter((row) => row.length);
    if (!rows.length) return "";
    const head = rows.shift();
    return (
      "\n| " +
      head.join(" | ") +
      " |\n| " +
      head.map(() => "---").join(" | ") +
      " |\n" +
      rows.map((row) => "| " + row.join(" | ") + " |").join("\n") +
      "\n"
    );
  }
  if (tag === "ul" || tag === "ol")
    return (
      "\n" +
      [...node.children]
        .filter((child) => child.tagName === "LI")
        .map(
          (child, index) =>
            (tag === "ol" ? `${index + 1}. ` : "- ") + asMarkdown(child).trim(),
        )
        .join("\n") +
      "\n"
    );
  if (tag === "pre") return "\n```\n" + node.textContent.trim() + "\n```\n";
  if (tag === "code") return "`" + inside() + "`";
  if (/^h[1-6]$/.test(tag))
    return "\n" + "#".repeat(Number(tag[1])) + " " + inside().trim() + "\n";
  if (["strong", "b"].includes(tag)) return "**" + inside().trim() + "**";
  if (
    [
      "p",
      "div",
      "section",
      "article",
      "header",
      "aside",
      "dl",
      "dt",
      "dd",
      "blockquote",
      "details",
      "summary",
      "li",
    ].includes(tag)
  )
    return "\n" + inside().trim() + "\n";
  return inside();
}
function clean(text) {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  await build({
    stdin: {
      contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {PageContent} from './src/wiki/WikiPage.jsx'; import {RouterContext} from './preview/router.jsx'; export {sectionAnchor} from './src/wiki/sectionAnchor.js'; export function render(path){return renderToStaticMarkup(<RouterContext.Provider value={{pathname:path,search:'',hash:''}}><main><PageContent path={path} query={new URLSearchParams()}/></main></RouterContext.Provider>);}`,
      loader: "jsx",
      resolveDir: root,
    },
    outfile: bundle,
    bundle: true,
    platform: "node",
    format: "cjs",
    loader: { ".css": "empty" },
    alias: {
      "@docusaurus/useDocusaurusContext": path.join(root, "preview/docusaurus-context.js"),
      "@docusaurus/Link": path.join(root, "preview/router.jsx"),
      "@docusaurus/router": path.join(root, "preview/router.jsx"),
      "@docusaurus/useBrokenLinks": path.join(root, "preview/broken-links.js"),
      "@docusaurus/useBaseUrl": path.join(root, "preview/base-url.js"),
      "@theme/Layout": path.join(root, "preview/layout.jsx"),
    },
    logLevel: "silent",
  });
  const { render, sectionAnchor } = require(bundle);
  const sections = [];
  for (const route of routes) {
    const dom = new JSDOM(render(route)),
      doc = dom.window.document;
    const entity =
      doc
        .querySelector("[data-wiki-entity]")
        ?.getAttribute("data-wiki-entity") ||
      doc.querySelector("h1")?.textContent.trim() ||
      route;
    const whole = doc.querySelector("main").cloneNode(true);
    const introduction = whole.querySelector(".rw-lead")?.textContent || "";
    whole.querySelectorAll(".rw-pagehead,.rw-prototype-label,.rw-toc,.rw-contribution,.rw-crumbs").forEach((node) => node.remove());
    const wholeMarkdown = clean(introduction + "\n\n" + asMarkdown(whole));
    if (wholeMarkdown) sections.push({ path: route, entity, title: "条目正文", id: "", markdown: wholeMarkdown });
    const titles = new Map();
    for (const heading of doc.querySelectorAll("h2,h3,h4,h5,h6")) {
      if (
        heading.closest(
          "a,button,form,dialog,.rw-petcard,.cm-root,nav,fieldset,[data-no-editor]",
        )
      )
        continue;
      const headingClone = heading.cloneNode(true);
      headingClone
        .querySelectorAll(".rw-edit-entry,.rw-inline-section-edit")
        .forEach((el) => el.remove());
      const title = headingClone.textContent.trim();
      if (!title) continue;
      const count = (titles.get(title) || 0) + 1;
      titles.set(title, count);
      const id = heading.id || sectionAnchor(title, count);
      let nodes = [];
      if (heading.parentElement.matches(".rw-section-head"))
        nodes = [...heading.parentElement.parentElement.children].filter(
          (el) => el !== heading.parentElement,
        );
      else if (heading.parentElement.tagName === "HEADER")
        nodes = [...heading.parentElement.parentElement.children].filter(
          (el) => el !== heading.parentElement,
        );
      else {
        for (let next = heading.nextSibling; next; next = next.nextSibling) {
          if (
            next.nodeType === 1 &&
            /^H[1-6]$/.test(next.tagName) &&
            Number(next.tagName[1]) <= Number(heading.tagName[1])
          )
            break;
          nodes.push(next);
        }
      }
      const markdown = clean(nodes.map(asMarkdown).join(""));
      if (markdown) sections.push({ path: route, entity, title, id, markdown });
    }
    dom.window.close();
  }
  const sources = [
    "src/wiki/core.jsx",
    "src/wiki/WikiPage.jsx",
    "src/wiki/HomePage.jsx",
    "src/wiki/CatalogPages.jsx",
    "src/wiki/MechanicsPages.jsx",
    "src/wiki/WorldPages.jsx",
    "src/wiki/EventPagesV7.jsx",
    "src/wiki/PvePages.jsx",
    "src/wiki/ToolsPages.jsx",
    "src/wiki/data.js",
  ];
  const fingerprints = Object.fromEntries(
    sources
      .filter((file) => fs.existsSync(path.join(root, file)))
      .map((file) => [
        file,
        createHash("sha256")
          .update(fs.readFileSync(path.join(root, file)))
          .digest("hex"),
      ]),
  );
  const output = {
    schemaVersion: 7,
    description:
      "Section text from the exact release components. Generated before packaging; no simulated online revision.",
    fingerprints,
    sections,
  };
  fs.writeFileSync(
    path.join(root, "content/published-sections-v7.json"),
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      routes: routes.length,
      sections: sections.length,
      bytes: Buffer.byteLength(JSON.stringify(output)),
      framework: "React server render; no browser screenshot claim",
    }),
  );
}
main()
  .finally(() => fs.rmSync(temporary, { recursive: true, force: true }))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
