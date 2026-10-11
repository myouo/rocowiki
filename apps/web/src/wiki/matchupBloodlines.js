/** A battle loadout is distinct from all bloodlines the species can possess. */
export function normalizeMatchupBloodline(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const status = ["unknown", "none", "specified", "any"].includes(input.status) ? input.status : "unknown";
  return {
    status,
    names: Array.isArray(input.names) ? [...new Set(input.names.filter((name) => typeof name === "string").map((name) => name.trim()).filter(Boolean))] : typeof input.names === "string" ? [...new Set(input.names.split(/[\n、,，]/).map((name) => name.trim()).filter(Boolean))] : [],
    note: typeof input.note === "string" ? input.note : "",
  };
}
export function matchupBloodlineText(value) {
  const row = normalizeMatchupBloodline(value);
  if (row.status === "any") return "任意血脉均适用";
  if (row.status === "none") return "确认未携带血脉";
  if (row.status === "specified") return row.names.length ? row.names.join("、") : "已指定 · 名称待补充";
  return "血脉未记录";
}
export function matchupBloodlineClaim(value) {
  const row = normalizeMatchupBloodline(value);
  return { status: row.status, names: row.status === "specified" ? [...row.names].sort() : [], note: row.note };
}
