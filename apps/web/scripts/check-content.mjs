import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const docsRoot = path.join(projectRoot, "docs");
const normalize = (value) =>
  value === "/" ? "/" : `${value.replace(/\/+$/, "")}/`;
const errors = [];

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory()
        ? walk(absolute)
        : /\.mdx?$/.test(entry.name)
          ? [absolute]
          : [];
    }),
  );
  return nested.flat();
}

let manifest = [];
try {
  manifest = JSON.parse(
    await fs.readFile(path.join(projectRoot, "content/routes.json"), "utf8"),
  );
} catch (error) {
  errors.push(`Cannot read the route manifest: ${error.message}`);
}
if (
  !Array.isArray(manifest) ||
  manifest.some((value) => typeof value !== "string")
) {
  errors.push("content/routes.json must contain an array of strings.");
  manifest = [];
}

const routes = new Map();
for (const route of manifest) {
  const canonical = normalize(route);
  if (!route.startsWith("/") || /[?#]/.test(route) || route.includes(".."))
    errors.push(`Invalid route: ${route}`);
  if (routes.has(canonical)) errors.push(`Duplicate route: ${canonical}`);
  routes.set(canonical, "content/routes.json");
}

const documentPaths = await walk(docsRoot);
const documents = await Promise.all(
  documentPaths.map(async (absolutePath) => ({
    absolutePath,
    name: path.relative(projectRoot, absolutePath),
    source: await fs.readFile(absolutePath, "utf8"),
  })),
);
for (const doc of documents) {
  const frontmatter = doc.source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const slug = frontmatter?.[1].match(/^slug:\s*(\/\S+)\s*$/m)?.[1];
  if (!slug) {
    errors.push(`${doc.name}: an explicit absolute slug is required.`);
    continue;
  }
  const canonical = normalize(slug);
  if (routes.has(canonical))
    errors.push(
      `Route collision: ${canonical} (${routes.get(canonical)} and ${doc.name})`,
    );
  routes.set(canonical, doc.name);
}

for (const doc of documents) {
  const withoutCode = doc.source.replace(/```[\s\S]*?```/g, "");
  for (const link of withoutCode.matchAll(
    /(?<!!)\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g,
  )) {
    const href = link[1];
    if (/^(?:https?:|mailto:|tel:|#)/.test(href)) continue;
    const target = decodeURIComponent(href.split(/[?#]/)[0]);
    if (target.startsWith("/")) {
      if (!routes.has(normalize(target)))
        errors.push(`${doc.name}: unknown Wiki route ${href}`);
    } else if (/\.mdx?$/.test(target)) {
      try {
        await fs.access(path.resolve(path.dirname(doc.absolutePath), target));
      } catch {
        errors.push(`${doc.name}: missing Markdown target ${href}`);
      }
    }
  }
}

if (errors.length) {
  for (const error of errors) process.stderr.write(`ERROR ${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Content check passed: ${manifest.length} Wiki routes, ${documents.length} docs, ${routes.size} unique paths.\n`,
  );
}
