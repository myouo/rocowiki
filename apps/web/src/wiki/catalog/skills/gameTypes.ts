// SPDX-License-Identifier: GPL-3.0-only
export interface GameSkillObservation {
  source: { kind: 'official-game-server'; commandId: number; retrievedAt: string; bodySha256: string };
  petId: number;
  observedLevel: number;
  skills: { skillId: number; learningMethod: '' | '遗传'; learnLevel: null }[];
}
export interface GameSkillPoolRecord extends GameSkillObservation {
  petName: string;
  scope: 'observed-bag-pool';
}
export interface GameSkillRelationSnapshot {
  schemaVersion: 1;
  source: null | { kind: 'official-game-server'; url: string; retrievedAt: string; sha256: string; petCount: number; relationCount: number };
  pets: Record<string, GameSkillPoolRecord>;
}
