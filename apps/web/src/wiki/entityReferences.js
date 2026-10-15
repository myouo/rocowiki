import { getSearchRecords, pets, skills } from "./data";
import { getBloodlineEntries } from "./catalogBloodlines";
import { petMetadata } from "./content/bundled.js";
import { resolvePublishedCatalogPets, resolvePublishedCatalogSkills, petDetailHref, skillDetailHref } from "./catalogPublished";
import {canonicalCatalogHref} from '../../../../packages/wiki-schema/src/catalog-routes';

const allowedKinds = new Set(["宠物", "技能", "血脉", "天气", "环境", "机制", "挑战", "PVE", "场景", "物品", "人物", "任务"]);
export function entitySearchRecords(context = {}) {
  const petRows = resolvePublishedCatalogPets({ pets, metadata: petMetadata, submissions: context.submissions || [] }).filter((pet) => !pet.deleted);
  const skillRows = resolvePublishedCatalogSkills({ skills, submissions: context.submissions || [] });
  const records = [...getSearchRecords().filter((row) => !["血脉", "宠物", "技能"].includes(row.kind)), ...getBloodlineEntries(context), ...petRows.map((pet) => ({ title: pet.name, to: petDetailHref(pet), kind: "宠物", keywords: [...(pet.aliases || []), ...(pet.types || [])].join(" "), meta: (pet.types || []).join(" / ") })), ...skillRows.map((skill) => ({ title: skill.name, to: skillDetailHref(skill), kind: "技能", keywords: [skill.owner, ...(skill.tags || [])].join(" "), meta: [skill.type, skill.category, skill.owner].filter(Boolean).join(" · ") }))];
  const unique = new Map();
  for (const row of records) {
    if (!allowedKinds.has(row.kind)) continue;
    const kind = row.to === "/mechanics/weather/" ? "天气" : row.kind;
    unique.set(row.to, { ...row, kind, meta: row.meta || row.description || "" });
  }
  return [...unique.values()];
}

/** Stored references are portable Markdown links. No HTML, executable MDX or opaque token. */
export function entityMarkdown(record) {
  if (!record || !safeEntityTarget(record.to)) return "";
  const label = String(record.title || record.name || "词条").replace(/\\/g, "\\\\").replace(/([\[\]])/g, "\\$1").replace(/[\r\n]/g, " ");
  const href = record.to.replace(/\(/g, "%28").replace(/\)/g, "%29");
  return `[${label}](${href})`;
}
export function safeEntityTarget(value) {
  return typeof value === "string" && /^\/(?!\/)[^\s<>\\]*$/.test(value) && !/[\u0000-\u001f\u007f]/.test(value);
}

let registry;
export function resolveEntityReference(to) {
  if (!safeEntityTarget(to)) return null;
  if (!registry) registry = new Map(entitySearchRecords().map((row) => [row.to, row]));
  const canonical = canonicalCatalogHref(to);
  const [path] = canonical.split(/[?#]/);
  const known = registry.get(canonical) || registry.get(path);
  let kind = known?.kind;
  if (!kind && /^\/pets\/(?:[^/]+\/|\?)/.test(to)) kind = "宠物";
  if (!kind && /^\/skills\/(?:[^/]+\/|\?entry=)/.test(to)) kind = "技能";
  if (!kind && /^\/bloodlines\/(?:[^/]+\/|\?entry=)/.test(to)) kind = "血脉";
  if (!kind && /^\/mechanics\/environments\//.test(path)) kind = "环境";
  if (!kind && /^\/mechanics\/weather\//.test(path)) kind = "天气";
  if (!kind || !allowedKinds.has(kind)) return null;
  const pet = kind === '宠物' ? pets.find(row => petDetailHref(row) === path) : null;
  return { ...known, to: canonical, kind, image: pet?.image || "", title: known?.title || pet?.name || "" };
}
