// SPDX-License-Identifier: GPL-3.0-only
export interface CombatReference {
  name: string;
  href: string;
  kind: 'definition' | 'mechanic';
  icon?: string;
}

const stat = (name: string, id: number, anchor: string): CombatReference => ({ name, href: `/mechanics/attributes/#${anchor}`, kind: 'mechanic', icon: `/img/combat/ICON_${id}.png` });
const mechanic = (name: string, href: string, icon?: number | string): CombatReference => ({ name, href, kind: 'mechanic', ...(icon ? { icon: `/img/combat/ICON_${icon}.png` } : {}) });

/** Curated destinations: do not infer mechanics from arbitrary words or URLs. */
export const COMBAT_REFERENCES: CombatReference[] = [
  stat('物攻', 202, '物攻'), stat('物防', 203, '物防'),
  stat('魔攻', 204, '魔攻'), stat('魔防', 205, '魔防与魔抗'), stat('魔抗', 205, '魔防与魔抗'),
  stat('速度', 206, '速度'),
  mechanic('命中强化', '/mechanics/accuracy/#命中与回避的等级'),
  mechanic('闪避强化', '/mechanics/accuracy/#命中与回避的等级'),
  mechanic('回避强化', '/mechanics/accuracy/#命中与回避的等级'),
  mechanic('正面强化', '/mechanics/attributes/#能力与强化等级'), mechanic('负面强化', '/mechanics/attributes/#能力与强化等级'),
  mechanic('正负面强化', '/mechanics/attributes/#能力与强化等级'),
  mechanic('强化', '/mechanics/attributes/#能力与强化等级'),
  mechanic('重置', '/mechanics/status/#强化重置'),
  mechanic('PP', '/mechanics/pp/#删除消耗与回复'),
  mechanic('固伤', '/mechanics/damage/'), mechanic('威力伤害', '/mechanics/damage/'),
  mechanic('威力', '/mechanics/damage/'),
  mechanic('护盾', '/mechanics/shield/'), mechanic('减伤', '/mechanics/shield/'),
  mechanic('净化', '/mechanics/status/#清除与免疫'), mechanic('免疫', '/mechanics/status/#清除与免疫'),
  mechanic('异常', '/mechanics/status/#状态分类'),
  mechanic('沉睡', '/mechanics/status/#状态分类', '101_bak'), mechanic('睡眠', '/mechanics/status/#状态分类', '101_bak'),
  mechanic('麻醉', '/mechanics/status/#状态分类', '102_bak'), mechanic('烧伤', '/mechanics/status/#状态分类', '103_bak'),
  mechanic('冰冻', '/mechanics/status/#状态分类', '104_bak'), mechanic('中毒', '/mechanics/status/#状态分类', '105_bak'),
  mechanic('剧毒', '/mechanics/status/#状态分类', '106_bak'), mechanic('混乱', '/mechanics/status/#状态分类', '107_bak'),
  mechanic('恐惧', '/mechanics/status/#状态分类', '108_bak'), mechanic('寄生', '/mechanics/status/#状态分类', '109_bak'),
  mechanic('先手', '/mechanics/priority/'), mechanic('后手', '/mechanics/priority/'),
  mechanic('必中', '/mechanics/accuracy/'), mechanic('命中', '/mechanics/accuracy/'),
  mechanic('天气', '/mechanics/weather/'), mechanic('环境', '/mechanics/weather/'),
  mechanic('回合', '/mechanics/stages/'), mechanic('精力', '/mechanics/healing/'),
];

export interface CombatTextPart { text: string; reference?: CombatReference; prefix?: string }
export function combatTextParts(text: string, definitions: CombatReference[] = []): CombatTextPart[] {
  const byName = new Map([...COMBAT_REFERENCES, ...definitions].map(reference => [reference.name, reference]));
  const names = [...byName.keys()].filter(Boolean).sort((a, b) => b.length - a.length);
  const result: CombatTextPart[] = [];
  let offset = 0, plain = '';
  while (offset < text.length) {
    const name = names.find(name => text.startsWith(name, offset) && (!/^[A-Za-z]+$/u.test(name) || (!/[A-Za-z]/u.test(text[offset - 1] || '') && !/[A-Za-z]/u.test(text[offset + name.length] || ''))));
    if (!name) { plain += text[offset++]; continue; }
    const reference = byName.get(name)!;
    const prefix = reference.icon && reference.href.startsWith('/mechanics/attributes/') ? plain.match(/[+−-]\d+\s*$/u)?.[0] || '' : '';
    if (prefix) plain = plain.slice(0, -prefix.length);
    if (plain) { result.push({ text: plain }); plain = ''; }
    result.push({ text: prefix + name, reference, ...(prefix ? { prefix } : {}) });
    offset += name.length;
  }
  if (plain) result.push({ text: plain });
  return result;
}

export function analysisTermReferences(terms: { name: string }[], prefix: string): CombatReference[] {
  return terms.flatMap((term, index) => {
    const reference: CombatReference = { name: term.name, kind: 'definition', href: `#${prefix}-term-${index}` };
    return term.name.endsWith('层数') ? [reference, { ...reference, name: term.name.slice(0, -2) }] : [reference];
  });
}
