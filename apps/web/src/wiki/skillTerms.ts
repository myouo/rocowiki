// SPDX-License-Identifier: GPL-3.0-only
export interface SkillTerm { name: string; description: string }

/** Validate untrusted drafts; older drafts may omit the optional definitions. */
export function skillTermErrors(terms: unknown): Record<string, string> {
  if (terms === undefined) return {};
  if (!Array.isArray(terms) || terms.length > 50) return { terms: '名词定义须为列表，最多 50 项。' };
  const errors: Record<string, string> = {}, names = new Set<string>();
  terms.forEach((term: unknown, index) => {
    const row = term && typeof term === 'object' ? term as Record<string, unknown> : {};
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name || name.length > 100) errors[`terms.${index}.name`] = '填写名词名称，最多 100 字。';
    else if (names.has(name)) errors[`terms.${index}.name`] = '同一技能中的名词名称不能重复。';
    names.add(name);
    if (typeof row.description !== 'string' || !row.description.trim() || row.description.length > 4000) errors[`terms.${index}.description`] = '填写名词定义，最多 4000 字。';
  });
  return errors;
}
