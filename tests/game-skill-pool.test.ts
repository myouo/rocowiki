// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { decodeGameSkillPoolBody, verifyGameSkillPool } from '../scripts/updates/game-skill-pool';

// Actual 2026-10-12 game response body, excluding the account-bearing ADF header.
const body = Buffer.from('00000000000000000CD501000C0195140001AD0A0008F70A00018A1400072A0C0001A40500066005000E1F02000E200C000E210C000E220F000E230F00', 'hex');
// Synthetic private identity: never retain a real account's caught timestamp in fixtures.
const identity = { petId: 3285, bagPosition: 1, observedLevel: 100, caughtAt: 1 };
const retrievedAt = '2026-10-12T14:45:54.959Z';

describe('official game skill-pool responses', () => {
  it('decodes the captured pool without inventing learning levels', () => {
    expect(decodeGameSkillPoolBody(body)).toMatchObject({ echoedPetId: 3285, echoedBagPosition: 1 });
    const result = verifyGameSkillPool(body, identity, identity, identity, retrievedAt);
    expect(result.source).toMatchObject({ kind: 'official-game-server', commandId: 0x0b000d });
    expect(result.source.bodySha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result).not.toHaveProperty('caughtAt');
    expect(result.skills.map(skill => skill.skillId)).toEqual([405, 429, 2295, 394, 1834, 420, 1632, 3615, 3616, 3617, 3618, 3619]);
    expect(result.skills.every(skill => skill.learnLevel === null && skill.learningMethod === '')).toBe(true);
  });
  it('refuses the real failure mode where the server echoes 3402 but returns slot 1 of another pet', () => {
    const misleading = Buffer.from(body); misleading.writeUInt32BE(3402, 6);
    expect(decodeGameSkillPoolBody(misleading).echoedPetId).toBe(3402);
    expect(() => verifyGameSkillPool(misleading, { petId: 3402, bagPosition: 1 }, identity, identity, retrievedAt)).toThrow('actual game bag slot');
  });
  it('rejects a changing bag or a mismatched response instead of publishing another pet pool', () => {
    expect(() => verifyGameSkillPool(body, identity, identity, { ...identity, petId: 3402 }, retrievedAt)).toThrow();
    expect(() => verifyGameSkillPool(body, identity, identity, { ...identity, observedLevel: 99 }, retrievedAt)).toThrow('level changed');
    expect(() => verifyGameSkillPool(body, identity, identity, { ...identity, caughtAt: 2 }, retrievedAt)).toThrow('instance changed');
    const mismatched = Buffer.from(body); mismatched[10] = 2;
    expect(() => verifyGameSkillPool(mismatched, identity, identity, identity, retrievedAt)).toThrow('response identity');
  });
  it('rejects truncation, trailing fields, duplicate skills and undocumented inheritance flags', () => {
    const duplicate = Buffer.from(body); duplicate.writeUInt16BE(405, 17);
    const unknownFlag = Buffer.from(body); unknownFlag[16] = 2;
    for (const invalid of [body.subarray(0, -1), Buffer.concat([body, Buffer.of(0)]), duplicate, unknownFlag]) expect(() => decodeGameSkillPoolBody(invalid)).toThrow();
    const inherited = Buffer.from(body); inherited[16] = 1;
    expect(verifyGameSkillPool(inherited, identity, identity, identity, retrievedAt).skills[0]).toMatchObject({ skillId: 405, learningMethod: '遗传', learnLevel: null });
  });
  it('preserves game rejections and refuses invalid bag levels and collection times', () => {
    const rejected = Buffer.alloc(6); rejected.writeInt32BE(-1);
    expect(() => decodeGameSkillPoolBody(rejected)).toThrow('rejected (-1)');
    expect(() => verifyGameSkillPool(body, identity, { ...identity, observedLevel: 0 }, identity, retrievedAt)).toThrow();
    expect(() => verifyGameSkillPool(body, identity, identity, identity, 'unknown')).toThrow('collection time');
  });
});
