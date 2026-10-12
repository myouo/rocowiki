// SPDX-License-Identifier: GPL-3.0-only
import type { OfficialLadderCost, OfficialLadderSnapshot } from './ladderTypes';

export function officialLadderCost(snapshot: OfficialLadderSnapshot, number: number): OfficialLadderCost {
  const listed = Object.prototype.hasOwnProperty.call(snapshot.costs, String(number));
  return {
    value: listed ? snapshot.costs[String(number)] : snapshot.defaultCost,
    listed, banned: snapshot.bannedPetIds.includes(number), status: 'official-config',
    sourceUrl: snapshot.source.url, recordedAt: snapshot.source.retrievedAt, sha256: snapshot.source.sha256,
  };
}

export function petMetadataWithOfficialLadder(metadata: Record<string, unknown>, ladder?: OfficialLadderCost) {
  return ladder ? { ...metadata, ladderMagic: ladder } : metadata;
}
