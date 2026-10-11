/** Skill learning is a many-to-many relation. An owner hint is never exclusivity. */
const plain = (value) => value && typeof value === "object" && !Array.isArray(value);
const text = (value, limit = 200) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const slug = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,119}$/i.test(value) ? value : "";
export const MAX_LEARNER_EDITS = 100;
export function learnerSourceUrl(value) {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}
export function normalizeSkillLearners(value) {
  const result = new Map();
  for (const row of Array.isArray(value) ? value : []) {
    if (!plain(row) || !slug(row.petSlug)) continue;
    const level = row.level !== "" && row.level != null && Number.isInteger(Number(row.level)) && Number(row.level) >= 1 && Number(row.level) <= 100 ? Number(row.level) : null;
    result.set(row.petSlug, { petSlug: row.petSlug, method: text(row.method), level, sourceUrl: learnerSourceUrl(row.sourceUrl), sourceTitle: text(row.sourceTitle) });
  }
  return [...result.values()];
}
export function petLearnsSkill(pet, skill) {
  const names = new Set([skill?.name, ...(skill?.catalogNames || [])].filter(Boolean));
  return (pet?.skills || []).filter((row) => (row.slug && row.slug === skill?.slug) || names.has(row.name));
}
function knownLearning(row = {}) {
  const method = text(row.learningMethod || row.learnMethod || row.method);
  const value = row.learnLevel ?? row.learningLevel ?? row.level;
  const level = value !== "" && value != null && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 100 ? Number(value) : null;
  return { method, level };
}

/** Keep imported skill-pool links while overlaying explicitly maintained details. */
export function resolveSkillLearners({ skill = {}, pets = [], learners = skill.learners || [] } = {}) {
  const byPet = new Map(), available = new Map(pets.filter((pet) => !pet.deleted).map((pet) => [pet.slug, pet]));
  const add = (pet, details, origin, sourceUrl, sourceTitle) => {
    const previous = byPet.get(pet.slug) || { pet, method: "", level: null, origins: [], sources: [] };
    const source = learnerSourceUrl(sourceUrl);
    const next = { ...previous, method: details.method || previous.method, level: details.level ?? previous.level, origins: [...new Set([...previous.origins, origin])], sources: [...previous.sources] };
    if (source && !next.sources.some((row) => row.url === source)) next.sources.push({ url: source, title: text(sourceTitle) || "学习关系来源" });
    byPet.set(pet.slug, next);
  };
  for (const pet of available.values()) {
    for (const entry of petLearnsSkill(pet, skill)) add(pet, knownLearning(entry), "宠物技能池", entry.sourceUrl || pet.sourceUrl, entry.sourceTitle || "宠物技能池来源");
    if (pet.slug === skill.ownerSlug) add(pet, {}, "技能原始资料", skill.source, "技能资料来源");
  }
  const unresolved = [];
  for (const entry of normalizeSkillLearners(learners)) {
    const pet = available.get(entry.petSlug);
    if (!pet) { unresolved.push(entry); continue; }
    add(pet, entry, "社区补充", entry.sourceUrl, entry.sourceTitle);
  }
  const rows = [...byPet.values()].sort((a, b) => (Number.isFinite(a.pet.number) ? a.pet.number : Infinity) - (Number.isFinite(b.pet.number) ? b.pet.number : Infinity) || a.pet.name.localeCompare(b.pet.name, "zh-CN") || a.pet.slug.localeCompare(b.pet.slug));
  const unknownOwner = skill.owner && !available.has(skill.ownerSlug) && !rows.some((row) => row.pet.name === skill.owner) && !/待补|待收录|未关联/.test(skill.owner) ? skill.owner : "";
  return { rows, unresolved, unknownOwner };
}

export function validateSkillLearnerData(data = {}, pets = []) {
  const errors = {}, available = new Set(pets.filter((pet) => !pet.deleted).map((pet) => pet.slug));
  if (!Array.isArray(data.learners)) return { learners: "学习关系列表格式无效，请重新载入当前版本。" };
  if (data.learners.length > MAX_LEARNER_EDITS) errors.learners = `一次最多维护 ${MAX_LEARNER_EDITS} 条补充关系；既有技能池关系会继续保留。`;
  const seen = new Set();
  data.learners.forEach((row, index) => {
    const key = `learners.${index}.`;
    if (!plain(row)) { errors[key + "petSlug"] = "请从已收录宠物中选择。"; return; }
    if (!slug(row.petSlug) || !available.has(row.petSlug)) errors[key + "petSlug"] = "请从仍在图鉴中的已收录宠物中选择。";
    if (seen.has(row.petSlug)) errors[key + "petSlug"] = "同一只宠物只需保留一条补充关系。";
    seen.add(row.petSlug);
    if (row.level !== "" && row.level != null && (!Number.isInteger(Number(row.level)) || Number(row.level) < 1 || Number(row.level) > 100)) errors[key + "level"] = "学习等级需为 1～100 的整数；未知时留空。";
    if (!learnerSourceUrl(row.sourceUrl)) errors[key + "sourceUrl"] = "请提供可核验的 http:// 或 https:// 来源。";
    if (String(row.method || "").length > 200) errors[key + "method"] = "学习方式请控制在 200 字以内。";
  });
  return errors;
}
