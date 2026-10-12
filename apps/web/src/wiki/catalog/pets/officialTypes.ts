// SPDX-License-Identifier: GPL-3.0-only
import type { OfficialLadderCost } from './ladderTypes';
export type PetStats = [number, number, number, number, number, number];

export interface OfficialPetRecord {
  id: number;
  name: string;
  types: string[];
  stats: PetStats | null;
  iconUrl: string;
  description: string;
  acquisitionText: string;
  metadata: {
    group: string | null;
    groups: string[];
    experienceType: number | null;
    heightM: number | null;
    weightKg: number | null;
    color: string | null;
    catchRate: number | null;
  };
}

export interface OfficialPetSnapshot {
  schemaVersion: 1;
  source: {
    url: string;
    retrievedAt: string;
    sha256: string;
    configVersion: string;
    objectCount: number;
    spiritCount: number;
    excludedCount: number;
    duplicateIds: number[];
  };
  pets: OfficialPetRecord[];
}

export interface WikiPet {
  slug: string;
  name: string;
  number: number;
  types: string[];
  aliases: string[];
  image: string;
  stats: PetStats | null;
  skills: unknown[];
  sourceUrl: string;
  catalogEntry?: boolean;
  metadata?: Record<string, unknown>;
  official?: OfficialPetRecord;
  officialLadder?: OfficialLadderCost;
  skillPool?: { status: 'available' | 'missing' | 'invalid' | 'stale'; sourceUrl: string; recordedAt: string; commit: string; unresolvedCount: number };
}
