import { pets as seedPets } from "./data";
import { petMetadata as seedMetadata } from "./content/bundled.js";
import { resolvePublishedCatalogPets, petDetailHref } from "./catalogPublished";

const names = (value) => [...new Set((Array.isArray(value) ? value : []).filter((name) => typeof name === "string").map((name) => name.trim()).filter(Boolean))];

/** The choices describe this species' recorded options, never its battle loadout. */
export function getPetBloodlineOptions(petOrIdentity, { pets = seedPets, metadata = seedMetadata, submissions = [] } = {}) {
  const catalog = resolvePublishedCatalogPets({ pets, metadata, submissions });
  const identity = typeof petOrIdentity === "object" && petOrIdentity ? petOrIdentity.slug : String(petOrIdentity || "").trim();
  const pet = catalog.find((entry) => !entry.deleted && (entry.slug === identity || entry.name === identity || String(entry.number) === identity || entry.catalogNames?.includes(identity) || entry.aliases?.includes(identity)))
    || (petOrIdentity && typeof petOrIdentity === "object" && !petOrIdentity.deleted ? petOrIdentity : null);
  const bloodlines = names(pet?.metadata?.bloodlines || (metadata.pets || metadata)?.[pet?.slug]?.bloodlines);
  return { pet, options: bloodlines.map((name) => ({ value: name, label: name })), recorded: bloodlines.length > 0 };
}

export function bloodlineDetailHref(name) {
  return "/bloodlines/?entry=" + encodeURIComponent(name);
}

/** Group the index by bloodline identity; holders are a relationship under it. */
export function resolveCatalogBloodlines({ pets = seedPets, metadata = seedMetadata, submissions = [] } = {}) {
  const catalog = resolvePublishedCatalogPets({ pets, metadata, submissions });
  const records = new Map();
  for (const pet of catalog.filter((entry) => !entry.deleted)) {
    const meta = pet.metadata || (metadata.pets || metadata)[pet.slug] || {};
    for (const name of names(meta.bloodlines)) {
      if (!records.has(name)) records.set(name, { name, href: bloodlineDetailHref(name), owners: [], sources: [] });
      const row = records.get(name);
      row.owners.push({ ...pet, href: petDetailHref(pet) });
      const specific = meta.bloodlineSources?.filter((source) => source.name === name) || [];
      const sourceRows = specific.length ? specific : [{ name: pet.name + " · 血脉名称来源", url: meta.fieldSources?.bloodlines || pet.sourceUrl }];
      for (const source of sourceRows) if (/^https?:\/\//i.test(source.url || "") && !row.sources.some((old) => old.url === source.url)) row.sources.push(source);
    }
  }
  return [...records.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export function getBloodlineEntries(context = {}) {
  return resolveCatalogBloodlines(context).map((row) => ({
    id: "bloodline:" + row.name,
    name: row.name,
    title: row.name,
    to: row.href,
    kind: "血脉",
    description: "已收录持有者：" + row.owners.map((pet) => pet.name).join("、"),
  }));
}

/** A bloodline's body is scoped to its entry query and name, not the index page. */
export function getBloodlineArticleSnapshot(request = {}, workspace = {}) {
  const submissions = Array.isArray(workspace?.submissions) ? workspace.submissions : [];
  const returnTo = String(request.returnTo || "");
  const path = returnTo.split(/[?#]/)[0];
  if (path !== "/bloodlines/") return null;
  let name = "";
  try { name = new URLSearchParams(returnTo.split("?")[1]?.split("#")[0] || "").get("entry") || ""; } catch {}
  if (!name || request.entity && request.entity !== name) return null;
  const bloodline = resolveCatalogBloodlines({ submissions }).find((row) => row.name === name);
  if (!bloodline) return null;
  const revision = submissions.filter((row) => {
    if (!row || typeof row !== "object") return false;
    if (row.status !== "published" || row.editorVersion !== 7 || (row.editorMode || row.editorRequest?.mode) !== "article" || typeof row.typedData?.markdown !== "string") return false;
    if ((row.editorRequest?.entity || row.target) !== name || (row.editorRequest?.section || row.section) !== "血脉效果") return false;
    let entry = "";
    const to = row.editorRequest?.returnTo || "";
    try { entry = new URLSearchParams(to.split("?")[1]?.split("#")[0] || "").get("entry") || ""; } catch {}
    return to.split(/[?#]/)[0] === "/bloodlines/" && entry === name;
  }).slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) || String(b.id).localeCompare(String(a.id)))[0];
  return {
    markdown: revision?.typedData.markdown || "",
    exists: true,
    sourcePath: bloodline.href + "#effects",
    sourceUrl: revision?.typedData.sourceUrl || bloodline.sources[0]?.url || "",
    publishedAt: revision?.updatedAt,
    publishedRevision: revision?.id,
  };
}
