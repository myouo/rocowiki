// SPDX-License-Identifier: GPL-3.0-only
import { createHash } from 'node:crypto';

export const GAME_SKILL_POOL_COMMAND = 0x0b000d;
const MAX_BODY_BYTES = 64 * 1024;

export interface GameBagIdentity {
  petId: number;
  bagPosition: number;
  observedLevel: number;
  /** Private instance identity from the bag response; never included in the published result. */
  caughtAt: number;
}

export interface GameSkillPoolBody {
  echoedPetId: number;
  echoedBagPosition: number;
  skills: { skillId: number; pp: number; inherited: boolean }[];
}

/** Decode only the response body; account IDs and credentials from packet headers stay private. */
export function decodeGameSkillPoolBody(bytes: Buffer): GameSkillPoolBody {
  if (bytes.length < 6 || bytes.length > MAX_BODY_BYTES) throw new Error('Invalid game skill-pool body size');
  const code = bytes.readInt32BE(0), messageLength = bytes.readUInt16BE(4);
  const payload = 6 + messageLength;
  if (payload > bytes.length) throw new Error('Truncated game return code');
  if (code !== 0) throw new Error(`Game skill-pool request rejected (${code})`);
  if (payload + 7 > bytes.length) throw new Error('Truncated game skill-pool identity');
  const echoedPetId = bytes.readUInt32BE(payload), echoedBagPosition = bytes[payload + 4];
  const count = bytes.readUInt16BE(payload + 5);
  if (!echoedPetId || echoedBagPosition < 1 || echoedBagPosition > 12 || count > 4096) throw new Error('Invalid game skill-pool identity or count');
  if (payload + 7 + count * 4 !== bytes.length) throw new Error('Truncated or unexpected game skill-pool fields');
  const skills: GameSkillPoolBody['skills'] = [];
  for (let index = 0; index < count; index++) {
    const offset = payload + 7 + index * 4;
    const skillId = bytes.readUInt16BE(offset), pp = bytes[offset + 2], flag = bytes[offset + 3];
    if (!skillId || flag > 1 || skills.some(skill => skill.skillId === skillId)) throw new Error('Invalid or duplicate game skill-pool entry');
    skills.push({ skillId, pp, inherited: flag === 1 });
  }
  return { echoedPetId, echoedBagPosition, skills };
}

/** The server can echo a requested ID while returning the actual bag slot's skills. */
export function verifyGameSkillPool(bytes: Buffer, requested: { petId: number; bagPosition: number }, before: GameBagIdentity, after: GameBagIdentity, retrievedAt: string) {
  for (const identity of [before, after]) {
    if (!Number.isSafeInteger(identity.petId) || identity.petId < 1 ||
      !Number.isInteger(identity.bagPosition) || identity.bagPosition < 1 || identity.bagPosition > 12 ||
      !Number.isInteger(identity.observedLevel) || identity.observedLevel < 1 || identity.observedLevel > 100 ||
      !Number.isSafeInteger(identity.caughtAt) || identity.caughtAt < 1 || identity.caughtAt > 0xffffffff) throw new Error('Invalid independently read game bag identity');
    if (identity.petId !== requested.petId || identity.bagPosition !== requested.bagPosition) throw new Error('Requested pet does not match the actual game bag slot');
  }
  if (before.caughtAt !== after.caughtAt) throw new Error('Game bag instance changed during collection');
  if (before.observedLevel !== after.observedLevel) throw new Error('Game bag level changed during collection');
  if (!Number.isFinite(Date.parse(retrievedAt))) throw new Error('Invalid game collection time');
  const pool = decodeGameSkillPoolBody(bytes);
  if (pool.echoedPetId !== requested.petId || pool.echoedBagPosition !== requested.bagPosition) throw new Error('Game response identity does not match the request');
  return {
    source: { kind: 'official-game-server' as const, commandId: GAME_SKILL_POOL_COMMAND, retrievedAt, bodySha256: createHash('sha256').update(bytes).digest('hex') },
    petId: before.petId, observedLevel: before.observedLevel,
    // This protocol reports available skills and inheritance, without learning levels or stone flags.
    skills: pool.skills.map(skill => ({ skillId: skill.skillId, learningMethod: skill.inherited ? '遗传' : '', learnLevel: null })),
  };
}
