import { petMetadata } from "../content/bundled.js";

const UNKNOWN = "__unknown";

const petMeta = (pet) => pet?.metadata || petMetadata.pets[pet?.slug] || {};

const normalType = (type) => (type === "幽" ? "幽灵" : type?.replace("系", ""));

const catalogTypes = Object.keys(petMetadata.typeIcons);

const externalSource = (value) =>
  typeof value === "string" && /^https?:\/\//i.test(value) ? value : undefined;

const sortFields = [
  { value: "number", label: "图鉴编号", group: "图鉴资料" },
  { value: "name", label: "名称", group: "图鉴资料" },
  { value: "hp", label: "精力", group: "种族值" },
  { value: "atk", label: "物攻", group: "种族值" },
  { value: "def", label: "物防", group: "种族值" },
  { value: "spAtk", label: "魔攻", group: "种族值" },
  { value: "spDef", label: "魔抗", group: "种族值" },
  { value: "speed", label: "速度", group: "种族值" },
  { value: "total", label: "种族总和", group: "种族值" },
  { value: "magic", label: "天梯魔力值", group: "补充资料" },
  { value: "experienceType", label: "经验类型", group: "补充资料" },
  { value: "heightM", label: "身高", group: "补充资料" },
  { value: "weightKg", label: "体重", group: "补充资料" },
];

function getPetSortValue(pet, sort) {
  const index = ["hp", "atk", "def", "spAtk", "spDef", "speed"].indexOf(sort);
  if (index >= 0)
    return Number.isFinite(pet.stats?.[index]) ? pet.stats[index] : null;
  if (sort === "total")
    return pet.stats?.length === 6 && pet.stats.every(Number.isFinite)
      ? pet.stats.reduce((a, b) => a + b, 0)
      : null;
  if (sort === "magic") return petMeta(pet).ladderMagic?.value ?? null;
  if (["experienceType", "heightM", "weightKg"].includes(sort))
    return petMeta(pet)[sort] ?? null;
  return pet[sort] ?? null;
}

function compareCatalogPets(a, b, sort, direction = "asc") {
  const av = getPetSortValue(a, sort),
    bv = getPetSortValue(b, sort);
  if (av == null && bv != null) return 1;
  if (av != null && bv == null) return -1;
  const difference =
    av == null
      ? 0
      : typeof av === "string"
        ? av.localeCompare(bv, "zh-CN")
        : av - bv;
  return difference
    ? difference * (direction === "desc" ? -1 : 1)
    : (a.number ?? Number.MAX_SAFE_INTEGER) -
        (b.number ?? Number.MAX_SAFE_INTEGER);
}

function matchesCatalogMetadata(pet, filters) {
  const meta = petMeta(pet);
  return Object.entries(filters).every(([key, selected]) => {
    if (!selected) return true;
    const value = key === "magic" ? meta.ladderMagic?.value : meta[key];
    if (selected === UNKNOWN) return value == null;
    if (key === "bloodlines" && selected === "recorded")
      return Array.isArray(value) && value.length > 0;
    return Array.isArray(value)
      ? value.includes(selected)
      : value != null && String(value) === selected;
  });
}

export { UNKNOWN, petMeta, normalType, catalogTypes, externalSource, sortFields, getPetSortValue, compareCatalogPets, matchesCatalogMetadata };
