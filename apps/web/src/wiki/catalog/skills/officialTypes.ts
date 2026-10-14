// SPDX-License-Identifier: GPL-3.0-only
import type { SkillAnalysisRecord } from './analysisTypes';
import type { OfficialSkillRecord } from './skillRecordTypes';
import type { SkillTerm } from '../../skillTerms';
export type { OfficialSkillRecord } from './skillRecordTypes';

export interface OfficialSkillSnapshot {
  schemaVersion: 1;
  source: {
    url: string;
    retrievedAt: string;
    sha256: string;
    configVersion: string;
    petConfigVersion: string;
    objectCount: number;
    definitionCount: number;
    excludedCount: number;
    duplicateIds: number[];
    overriddenFields: { id: number; fields: string[] }[];
  };
  skills: OfficialSkillRecord[];
}

export interface WikiSkill {
  slug: string;
  name: string;
  number?: number;
  type: string;
  category: string;
  power: number | null;
  pp: number | null;
  priority: number | null;
  speedCode?: number;
  tags: string[];
  owner: string;
  ownerSlug: string | null;
  ownerNames?: string[];
  source: string;
  hit: string;
  summary: string;
  common: string[];
  phases: unknown[];
  terms?: SkillTerm[];
  catalogEntry?: boolean;
  localEntry?: boolean;
  official?: OfficialSkillRecord;
  curatedSource?: string;
  analysis?: SkillAnalysisRecord;
  analysisCurrent?: boolean;
}
