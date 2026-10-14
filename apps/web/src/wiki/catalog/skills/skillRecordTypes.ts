// SPDX-License-Identifier: GPL-3.0-only
export interface OfficialSkillRecord {
  id: number;
  name: string;
  type: string;
  category: '物理' | '魔法' | '变化';
  power: number | null;
  pp: number;
  speedCode: number;
  description: string;
  description2: string;
  attackType: number;
  damageType: number;
}
