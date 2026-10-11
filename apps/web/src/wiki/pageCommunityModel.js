import { getSubmissionAuthorIdentity } from "./communitySocialModel";

/** Shared stable fragment used by profile records and the original discussion. */
export function commentAnchor(id) {
  return `comment-${String(id).replace(/^comment:/, "").replace(/[^a-z0-9_-]/gi, "-")}`;
}

export function canonicalPageKey(value = "/") {
  if (typeof value !== "string" || !/^\/(?!\/)/.test(value) || /[<>\\]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://wiki.invalid");
    const path = url.pathname.replace(/\/+$/, "") + "/";
    const entry = url.searchParams.get("entry");
    return path + (entry && /^\/(pets|skills|bloodlines|pve|npcs)\/$/.test(path) ? "?entry=" + encodeURIComponent(entry) : "");
  } catch { return "/"; }
}
function meaningfulLines(value) {
  return String(value || "").split(/\r?\n/).map(line => line.trim().replace(/\s+/g, " ")).filter(line => line && !/^[`~#{}\[\],\-_*|: ]+$/.test(line) && !/^(id|slug|标识|sourceIds|claimRevision)\s*[:：]/i.test(line));
}
/** Cumulative changed text lines, not current-line ownership and not a reward currency. */
export function effectiveContributionLines(before, after) {
  const counts = lines => lines.reduce((map,line) => (map.set(line,(map.get(line) || 0) + 1),map), new Map());
  const a = counts(meaningfulLines(before)), b = counts(meaningfulLines(after));
  let added = 0, removed = 0;
  for (const key of new Set([...a.keys(), ...b.keys()])) { const delta = (b.get(key) || 0) - (a.get(key) || 0); if (delta > 0) added += delta; else removed -= delta; }
  return Math.max(added,removed);
}
export function submissionPageKey(row = {}) {
  const request = row.editorRequest || {}, data = row.typedData || {};
  const path = request.returnTo || row.sourcePath || row.returnTo || "";
  const mode = row.editorMode || request.mode;
  const kind = {pet:"pets",skill:"skills",npc:"npcs","pve-guide":"pve"}[mode];
  if (kind && request.intent === "add" && canonicalPageKey(path) === `/${kind}/`) {
    const cleanId = value => typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,119}$/i.test(value) ? value : "";
    const stable = cleanId(data.slug) || cleanId(data.id) || cleanId(request.record) || (mode === "npc" ? cleanId(row.id) : mode === "skill" || mode === "pet" ? `local-${String(row.id || "").replace(/[^a-z0-9_-]/gi,"_")}` : "");
    return stable ? `/${kind}/?entry=${encodeURIComponent(stable)}` : "";
  }
  return path ? canonicalPageKey(path) : "";
}
export function pageMaintainers(submissions = [], page = "/") {
  const key = canonicalPageKey(page), people = new Map(), ids = new Set();
  let unattributed = 0;
  const rows = (Array.isArray(submissions) ? submissions : []).filter(row => row?.status === "published" && !row.isExample).slice().sort((a,b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")));
  for (const row of rows) {
    if (!row.id || ids.has(row.id)) continue;
    ids.add(row.id);
    if (submissionPageKey(row) !== key) continue;
    const lines = effectiveContributionLines(row.before, row.after);
    if (!lines) continue;
    const author = getSubmissionAuthorIdentity(row);
    if (!author) { unattributed++; continue; }
    const prior = people.get(author.uuid) || { ...author, lines: 0, revisions: [] };
    people.set(author.uuid, { ...prior, ...author, lines: prior.lines + lines, revisions: [...prior.revisions, {id:row.id,title:row.summary || row.title || row.target || "条目修订",lines,at:row.updatedAt}] });
  }
  return { people: [...people.values()].sort((a,b) => b.lines - a.lines || a.uuid.localeCompare(b.uuid)), unattributed };
}
