import { CALCULATOR_DATA_VERSION, STAT_KEYS, STAT_NAMES, calculateStats, normalizeGuardianInput, statsEquipmentDetails } from "./rocoCalculations";

export const CALCULATION_SNAPSHOT_KEY = "roco-wiki:stats-snapshots:v1";
export const CALCULATION_SNAPSHOT_LIMIT = 40;
const VERSION = 1;
const ARRAY_FIELDS = ["base", "talent", "effort", "intimacy"];
const SCALAR_FIELDS = ["pet", "petName", "petHref", "level", "nature", "guardianLevel", "guardianLegacyRange", "relationship", "accessory", "weapon", "armor", "accessoryBonus", "weaponBonus", "armorBonus", "weaponStat", "armorStat"];

function storageObject(provided) {
  if (provided) return provided;
  if (typeof window === "undefined") throw new Error("no-storage");
  return window.localStorage;
}

export function cleanSnapshotForm(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = normalizeGuardianInput(value), result = {};
  for (const key of SCALAR_FIELDS) {
    if (!["string", "number"].includes(typeof input[key]) && input[key] !== undefined) return null;
    result[key] = input[key] === undefined ? "" : String(input[key]).slice(0, 200);
  }
  for (const key of ARRAY_FIELDS) {
    if (!Array.isArray(input[key]) || input[key].length !== 6 || input[key].some((item) => !["string", "number"].includes(typeof item))) return null;
    result[key] = input[key].map(item => String(item).slice(0, 200));
  }
  if (result.petHref && !/^\/pets\/(?:[a-zA-Z0-9_%~-]+\/|\?entry=[a-zA-Z0-9_%~-]+)$/.test(result.petHref)) result.petHref = "";
  return result;
}

function validSnapshot(row) {
  return row && typeof row.id === "string" && row.id.length <= 100 && typeof row.label === "string" && row.label.length <= 60
    && typeof row.pet?.slug === "string" && typeof row.pet?.name === "string"
    && Number.isFinite(Date.parse(row.savedAt)) && typeof row.dataVersion === "string"
    && cleanSnapshotForm(row.form)
    && [row.panel, row.battle].every((values) => Array.isArray(values) && values.length === 6 && values.every((value) => Number.isSafeInteger(value) && value >= 0));
}

export function readCalculationSnapshots(options = {}) {
  try {
    const raw = storageObject(options.storage).getItem(CALCULATION_SNAPSHOT_KEY);
    if (!raw) return { ok: true, records: [] };
    const data = JSON.parse(raw);
    if (data?.version !== VERSION || !Array.isArray(data.records) || data.records.length > CALCULATION_SNAPSHOT_LIMIT || !data.records.every(validSnapshot)
      || new Set(data.records.map((row) => row.id)).size !== data.records.length) throw new Error("invalid-data");
    return { ok: true, records: data.records.map(row => ({
      ...row, form: cleanSnapshotForm(row.form),
      pet: { slug: row.pet.slug.slice(0, 100), name: row.pet.name.slice(0, 100), href: cleanSnapshotForm(row.form).petHref },
    })) };
  } catch {
    return { ok: false, records: [], message: "计算记录暂时无法读取，现有记录未覆盖。请检查浏览器存储权限。" };
  }
}

function writeRecords(records, options) {
  try {
    const storage = storageObject(options.storage), payload = JSON.stringify({ version: VERSION, records });
    storage.setItem(CALCULATION_SNAPSHOT_KEY, payload);
    if (storage.getItem(CALCULATION_SNAPSHOT_KEY) !== payload) throw new Error("write-verification");
    if (typeof window !== "undefined") window.dispatchEvent(new window.CustomEvent("roco:stats-snapshots-updated"));
    return { ok: true, records };
  } catch {
    return { ok: false, message: "未能保存计算记录。请检查浏览器存储空间或权限，当前参数仍保留在页面上。" };
  }
}

export function saveCalculationSnapshot({ form, pet, label = "" }, options = {}) {
  const current = readCalculationSnapshots(options);
  if (!current.ok) return current;
  if (current.records.length >= CALCULATION_SNAPSHOT_LIMIT) return { ok: false, message: `本机已保存 ${CALCULATION_SNAPSHOT_LIMIT} 条记录，请先删除不需要的记录。` };
  const clean = cleanSnapshotForm(form), result = clean && calculateStats(clean);
  if (!result?.valid) return { ok: false, message: "请先补全有效的培养参数，再保存本次计算。" };
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  if (!Number.isFinite(now.getTime())) return { ok: false, message: "当前时间无法读取，暂未保存。" };
  const id = options.id || globalThis.crypto?.randomUUID?.() || `calc-${now.getTime()}-${Math.random().toString(36).slice(2, 12)}`;
  if (current.records.some((row) => row.id === id)) return { ok: false, message: "记录编号重复，请重试保存。" };
  const identity = {
    slug: String(pet?.slug || clean.pet || "custom").slice(0, 100),
    name: String(pet?.name || clean.petName || "手动种族").slice(0, 100),
    href: clean.petHref,
  };
  const record = {
    id, label: String(label).trim().slice(0, 60) || `${identity.name} · ${clean.nature}`,
    savedAt: now.toISOString(), pet: identity, form: clean,
    dataVersion: CALCULATOR_DATA_VERSION, panel: [...result.panel], battle: [...result.battle],
  };
  const saved = writeRecords([record, ...current.records], options);
  return saved.ok ? { ...saved, record, message: "已保存本次计算，可选择两条记录对比。" } : saved;
}

export function deleteCalculationSnapshot(id, options = {}) {
  const current = readCalculationSnapshots(options);
  if (!current.ok) return current;
  if (!current.records.some((record) => record.id === id)) return { ok: false, message: "这条记录已不存在。" };
  const result = writeRecords(current.records.filter((record) => record.id !== id), options);
  return result.ok ? { ...result, message: "已删除这条计算记录。" } : result;
}

export function compareCalculationSnapshots(a, b) {
  if (!validSnapshot(a) || !validSnapshot(b) || a.id === b.id) return null;
  const equipmentText = (row) => statsEquipmentDetails(row.form).map((item) => item.label || item.name || "未记录").join("；");
  const parameters = [
    ["等级", a.form.level, b.form.level],
    ["性格", a.form.nature, b.form.nature],
    ["守护兽等级", a.form.guardianLevel, b.form.guardianLevel],
    ["亲密关系", a.form.relationship, b.form.relationship],
    ["装备", equipmentText(a), equipmentText(b)],
    ...[["base", "种族"], ["talent", "天赋"], ["effort", "努力"], ["intimacy", "亲密分配"]].map(([key, label]) => [label, a.form[key].join(" / "), b.form[key].join(" / ")]),
  ].map(([label, before, after]) => ({ label, before, after, changed: before !== after }));
  return {
    samePet: a.pet.slug === b.pet.slug && a.pet.slug !== "custom",
    sameVersion: a.dataVersion === b.dataVersion,
    parameters,
    rows: STAT_KEYS.map((key, index) => ({ key, name: STAT_NAMES[index], a: a.battle[index], b: b.battle[index], delta: b.battle[index] - a.battle[index], panelA: a.panel[index], panelB: b.panel[index] })),
  };
}
