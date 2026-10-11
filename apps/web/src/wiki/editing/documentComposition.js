import { contentRevision } from "./model";
import { sectionAnchor } from "../sectionAnchor";

export function plainHeading(value) {
  return String(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*`_]/g, "")
    .replace(/\s+#+\s*$/, "")
    .trim();
}

// Offsets refer to the original Markdown, including nested subheadings. Fenced
// examples cannot accidentally become section boundaries.
export function documentSections(markdown, baseline = []) {
  const input = String(markdown || "");
  const headings = [];
  let offset = 0;
  let fence = "";
  let h2 = 0;
  let sub = 0;
  const occurrences = new Map();
  for (const line of input.split(/(?<=\n)/)) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = "";
    } else if (!fence) {
      const match = line.match(/^(#{2,6})\s+(.+?)\s*$/);
      if (match) {
        const level = match[1].length;
        const title = plainHeading(match[2]);
        if (level === 2) {
          h2++;
          sub = 0;
        } else sub++;
        const nth = (occurrences.get(title) || 0) + 1;
        occurrences.set(title, nth);
        const original = baseline.filter((row) => row.title === title)[nth - 1];
        const id =
          original?.id ||
          (baseline.length
            ? sectionAnchor(title, nth)
            : level === 2
              ? `section-${h2}`
              : `subsection-${h2}-${sub}`);
        headings.push({
          id,
          title,
          level,
          start: offset,
          contentStart: offset + line.length,
        });
      }
    }
    offset += line.length;
  }
  return headings.map((heading, index) => {
    const end =
      headings.slice(index + 1).find((next) => next.level <= heading.level)
        ?.start ?? input.length;
    return {
      ...heading,
      end,
      markdown: input.slice(heading.contentStart, end).trim(),
    };
  });
}

const cleanPath = (value) =>
  String(value || "")
    .split(/[?#]/)[0]
    .replace(/\/+$/, "") + "/";
function safeAnchor(value) {
  try {
    return decodeURIComponent(
      String(value || "")
        .split("#")
        .slice(1)
        .join("#"),
    );
  } catch {
    return "";
  }
}

/** Apply only published article edits belonging to this document, in publish order. */
export function composePublishedDocument({ document, submissions = [] }) {
  let markdown = String(document?.markdown || "");
  const baseline = document?.sections || documentSections(markdown);
  const applied = [];
  const unresolved = [];
  const rows = submissions
    .filter(
      (row) =>
        row?.status === "published" &&
        row.editorVersion === 7 &&
        row.editorMode === "article" &&
        typeof row.typedData?.markdown === "string" &&
        cleanPath(row.editorRequest?.returnTo) === cleanPath(document?.path),
    )
    .map((row, index) => ({ ...row, publishOrder: index }))
    .sort(
      (a, b) =>
        String(a.updatedAt).localeCompare(String(b.updatedAt)) ||
        a.publishOrder - b.publishOrder,
    );
  for (const row of rows) {
    const request = row.editorRequest || {};
    if (request.section === "条目正文") {
      markdown = row.typedData.markdown;
      applied.push(row);
      continue;
    }
    const current = documentSections(markdown, baseline);
    const anchor = safeAnchor(request.returnTo);
    const section = current.find(
      (item) =>
        item.id === anchor ||
        item.id === request.record ||
        item.title === request.section,
    );
    if (!section) {
      unresolved.push({ id: row.id, section: request.section });
      continue;
    }
    markdown =
      markdown.slice(0, section.contentStart).trimEnd() +
      "\n\n" +
      row.typedData.markdown.trim() +
      "\n\n" +
      markdown.slice(section.end).trimStart();
    applied.push(row);
  }
  return {
    markdown: markdown.trim(),
    sections: documentSections(markdown.trim(), baseline),
    applied: applied.map((row) => ({
      id: row.id,
      section: row.editorRequest.section,
      updatedAt: row.updatedAt,
    })),
    unresolved,
    isLocal: applied.length > 0,
    publishedAt: applied.at(-1)?.updatedAt || null,
    revision: contentRevision({ markdown: markdown.trim() }),
  };
}
