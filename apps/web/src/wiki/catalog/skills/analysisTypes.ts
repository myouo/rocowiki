// SPDX-License-Identifier: GPL-3.0-only
import type { OfficialSkillRecord } from './skillRecordTypes';

export interface SkillAnalysisBranch {
  label: string;
  when: string;
  effect: string;
  otherwise?: string;
  children?: SkillAnalysisBranch[];
  presentation?: 'scope' | 'action';
}
export interface SkillAnalysisNotes {
  skillId: number;
  name: string;
  hitRule: string | null;
  common: string[];
  phases: SkillAnalysisBranch[];
  notes: string[];
  terms?: { name: string; description: string }[];
}
export interface SkillAnalysisDraft {
  schemaVersion: 1;
  source: { repository: string; commit: string; sha256: string; officialDefinitionsSha256: string; petId: number; petName: string };
  records: SkillAnalysisNotes[];
}
export interface SkillAnalysisRecord extends SkillAnalysisNotes {
  expectedOfficial: OfficialSkillRecord;
  source: {
    url: string; commit: string; petId: number; petName: string;
    field: 'cur_best_test'; textSha256: string; authors: string[];
    reportedAt: string | null; originalUrl: string | null;
  };
}
export interface SkillAnalysisSnapshot {
  schemaVersion: 1;
  source: SkillAnalysisDraft['source'] & { url: string; retrievedAt: string; sha256: string };
  records: SkillAnalysisRecord[];
  unanalysed: { skillId: number; name: string; reason: string }[];
}
