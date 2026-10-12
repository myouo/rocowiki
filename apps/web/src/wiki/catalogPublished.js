import { normalizeSkillLearners } from "./skillLearnerModel";
import { petCatalogHref } from "./catalog/pets/officialModel";
export { petSkillPoolHref } from './catalog/pets/officialModel';
import { skillCatalogHref } from './catalog/skills/officialModel';
/* Published catalogue projections. Drafts and deletion proposals stay out of the reader. */
const plain = (value) => value && typeof value === "object" && !Array.isArray(value);
const text = (value, fallback = "") => typeof value === "string" ? value.slice(0, 15000) : fallback;
const slugValue = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,119}$/i.test(value) ? value : "";
const list = (value) => [...new Set((Array.isArray(value) ? value : String(value || "").split(/[\n、,，/]+/))
  .filter((part) => typeof part === "string").map((part) => part.trim()).filter(Boolean))];
const number = (value) => value !== "" && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const published = (submissions, mode) => (Array.isArray(submissions) ? submissions : [])
  .filter((row) => plain(row) && row.status === "published" && row.editorVersion === 7 &&
    (row.editorMode || row.editorRequest?.mode) === mode && plain(row.typedData))
  .slice().sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")) || String(a.id || "").localeCompare(String(b.id || "")));

function requestSlug(submission, kind) {
  const request = submission.editorRequest || {};
  const path = String(request.returnTo || "").split(/[?#]/)[0];
  const routeSlug = new RegExp(`^/${kind}/([^/]+)/?$`).exec(path)?.[1];
  let entry = "";
  try { entry = new URLSearchParams(String(request.returnTo || "").split("?")[1]?.split("#")[0] || "").get("entry"); } catch {}
  return (kind === "pets" ? slugValue(request.record) : "") || slugValue(routeSlug) || slugValue(entry) || slugValue(submission.typedData.slug);
}

export function petDetailHref(pet) {
  return petCatalogHref(pet || {});
}

export function skillDetailHref(skill) {
  return skillCatalogHref(skill || {});
}

export function resolvePublishedCatalogPets({ pets = [], metadata = {}, submissions = [] } = {}) {
  const meta = metadata.pets || metadata;
  const result = pets.map((pet) => ({ ...pet, catalogNames: pet.catalogNames || [pet.name], metadata: { ...(meta[pet.slug] || {}), ...(pet.metadata || {}) } }));
  for (const submission of published(submissions, "pet")) {
    const data = submission.typedData, request = submission.editorRequest || {};
    const identity = requestSlug(submission, "pets");
    const adding = request.intent === "add" || request.action === "create";
    let index = result.findIndex((pet) => identity ? pet.slug === identity : pet.name === request.entity);
    // Additions cannot overwrite an existing pet. Subsequent edits use its stable identity.
    if (adding && index >= 0) continue;
    if (request.intent === "delete") {
      if (index >= 0) result[index] = { ...result[index], deleted: true, deletionReason: text(data.deletionReason), redirectTo: text(data.redirectTo), publishedRevision: submission.id, publishedAt: submission.updatedAt };
      continue;
    }
    if (index < 0 && !adding) continue;
    const previous = index >= 0 ? result[index] : { slug: identity || `local-${String(submission.id || "pet").replace(/[^a-z0-9_-]/gi, "_")}`, types: [], aliases: [], skills: [], stats: null, image: "", localEntry: true, metadata: {} };
    const statsKeys = ["hp", "attack", "defense", "magicAttack", "magicDefense", "speed"];
    const stats = statsKeys.map((key, i) => own(data, key) ? number(data[key]) : previous.stats?.[i] ?? null);
    const next = {
      ...previous,
      name: text(data.name, previous.name || "待命名宠物"),
      catalogNames: [...new Set([...(previous.catalogNames || []), previous.name, text(data.name)].filter(Boolean))],
      number: own(data, "number") ? number(data.number) : previous.number,
      types: own(data, "types") ? list(data.types).map((type) => type.replace(/系$/, "")) : previous.types,
      aliases: own(data, "aliases") ? list(data.aliases) : previous.aliases,
      stats: stats.every(Number.isFinite) ? stats : null,
      sourceUrl: text(data.sourceUrl, previous.sourceUrl),
      metadata: { ...previous.metadata },
      publishedRevision: submission.id,
      publishedAt: submission.updatedAt,
    };
    if (own(data, "group")) next.metadata.group = text(data.group) || null;
    if (own(data, "experienceType")) next.metadata.experienceType = number(data.experienceType);
    for (const key of ["heightM", "weightKg", "catchCategory"]) if (own(data, key)) next.metadata[key] = number(data[key]);
    if (own(data, "color")) next.metadata.color = text(data.color) || null;
    for (const key of ["series", "bloodlines"]) if (own(data, key)) {
      const entries = list(data[key]);
      next.metadata[key] = entries.length ? entries : null;
    }
    if (own(data, "ladderMagic")) next.metadata.ladderMagic = number(data.ladderMagic) == null ? null : {
      ...(previous.metadata.ladderMagic || {}), value: number(data.ladderMagic), sourceUrl: next.sourceUrl,
      effectiveFrom: text(data.ladderMagicDate, previous.metadata.ladderMagic?.effectiveFrom || "日期待补"),
    };
    if (index >= 0) result[index] = next; else result.push(next);
  }
  return result;
}

export function resolvePublishedCatalogSkills({ skills = [], submissions = [] } = {}) {
  const result = skills.map((skill) => ({ ...skill, catalogNames: skill.catalogNames || [skill.name] }));
  for (const submission of published(submissions, "skill")) {
    const data = submission.typedData, request = submission.editorRequest || {};
    const identity = requestSlug(submission, "skills");
    const adding = request.intent === "add" && (!request.record || request.section === "技能目录");
    const index = result.findIndex((skill) => identity ? skill.slug === identity : skill.name === request.entity);
    if (index < 0 && !adding) continue;
    if (index >= 0 && adding && request.section === "技能目录") continue;
    const previous = index >= 0 ? result[index] : { slug: identity || `local-${String(submission.id || "skill").replace(/[^a-z0-9_-]/gi, "_")}`, tags: [], owner: "学习关系待补", ownerSlug: null, localEntry: true };
    if (request.record === "learners") {
      if (index >= 0 && Array.isArray(data.learners)) result[index] = { ...previous, learners: normalizeSkillLearners(data.learners), publishedLearnersRevision: submission.id, publishedLearnersAt: submission.updatedAt };
      continue;
    }
    const next = { ...previous, publishedRules: true, publishedRevision: submission.id, publishedAt: submission.updatedAt };
    for (const key of ["name", "type", "category", "summary", "hit"]) if (own(data, key)) next[key] = text(data[key]);
    next.catalogNames = [...new Set([...(previous.catalogNames || []), previous.name, next.name].filter(Boolean))];
    for (const key of ["number", "power", "pp", "priority"]) if (own(data, key)) next[key] = number(data[key]);
    if (own(data, "common")) next.common = (Array.isArray(data.common) ? data.common : String(data.common || "").split(/\r?\n/)).filter((part) => typeof part === "string" && part.trim());
    if (Array.isArray(data.phases)) next.phases = data.phases;
    if (own(data, "sourceUrl")) next.source = text(data.sourceUrl);
    if (index >= 0) result[index] = next; else result.push(next);
  }
  return result;
}
