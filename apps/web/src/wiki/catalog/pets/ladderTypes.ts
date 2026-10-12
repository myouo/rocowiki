// SPDX-License-Identifier: GPL-3.0-only
export interface OfficialLadderSnapshot {
  schemaVersion: 1;
  source: { url: string; retrievedAt: string; sha256: string; costEntryCount: number; banEntryCount: number };
  defaultCost: 1;
  costs: Record<string, number>;
  bannedPetIds: number[];
}

export interface OfficialLadderCost {
  value: number;
  listed: boolean;
  banned: boolean;
  status: 'official-config';
  sourceUrl: string;
  recordedAt: string;
  sha256: string;
}

export interface LegacyLadderCost {
  value?: number | null;
  status?: string;
  effectiveFrom?: string | null;
  sourceUrl?: string | null;
  recordedAt?: string;
  listed?: boolean;
  banned?: boolean;
}
