// SPDX-License-Identifier: GPL-3.0-only
export interface SkillLearningRelation {
  skillId: number;
  name: string;
  learningMethod: string;
  learnLevel: number | null;
}
export interface PetSkillPool {
  petId: number;
  petName: string;
  status: 'available' | 'missing' | 'invalid' | 'stale';
  skills: SkillLearningRelation[];
  unresolved: { name: string; reason: 'not-found' | 'ambiguous' | 'conflicting-parameters' }[];
  sourceCommit?: string;
  recordedAt?: string;
}
export interface SkillRelationSnapshot {
  schemaVersion: 1;
  source: {
    url: string;
    commit: string;
    resolverVersion: number;
    retrievedAt: string;
    sha256: string;
    officialPetSha256: string;
    officialSkillSha256: string;
    petCount: number;
    relationCount: number;
    unavailableCount: number;
    unresolvedCount: number;
  };
  pets: Record<string, PetSkillPool>;
}
