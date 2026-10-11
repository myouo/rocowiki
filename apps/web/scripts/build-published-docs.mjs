import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function walk(dir) {
  const out = [];
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...(await walk(file)));
    else if (/\.mdx?$/.test(file)) out.push(file);
  }
  return out;
}
export async function buildPublishedDocs() {
  const documents = [];
  for (const file of await walk(path.join(root, "docs"))) {
    const source = await fs.readFile(file, "utf8");
    const front = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    const meta = Object.fromEntries(
      (front?.[1] || "")
        .split("\n")
        .map((line) => line.match(/^(\w+):\s*(.+)$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
    );
    const markdown = source.slice(front?.[0].length || 0).trim();
    const headings = [...markdown.matchAll(/^(#{2,6})\s+(.+)$/gm)];
    let h2 = 0,
      sub = 0;
    const sections = headings.map((heading, i) => {
      const level = heading[1].length;
      if (level === 2) {
        h2++;
        sub = 0;
      } else {
        sub++;
      }
      const end =
        headings.slice(i + 1).find((next) => next[1].length <= level)?.index ??
        markdown.length;
      return {
        id: level === 2 ? `section-${h2}` : `subsection-${h2}-${sub}`,
        title: heading[2].replace(/[*`]/g, ""),
        level,
        markdown: markdown.slice(heading.index + heading[0].length, end).trim(),
      };
    });
    documents.push({
      path: "/" + String(meta.slug || "").replace(/^\/+|\/+$/g, "") + "/",
      title: meta.title || "",
      sourceFile: path.relative(root, file),
      markdown,
      sections,
    });
  }
  const output = {
    schemaVersion: 7,
    description:
      "Built from the exact Markdown bundled in this release; no invented online revision.",
    documents,
  };
  await fs.writeFile(
    path.join(root, "content/published-docs-v7.json"),
    JSON.stringify(output, null, 2) + "\n",
  );
  return output;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await buildPublishedDocs();
  console.log(
    JSON.stringify({
      documents: result.documents.length,
      sections: result.documents.reduce((n, d) => n + d.sections.length, 0),
    }),
  );
}
