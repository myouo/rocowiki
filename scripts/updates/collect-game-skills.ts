// SPDX-License-Identifier: GPL-3.0-only
import type { GameSkillObservation } from '../../apps/web/src/wiki/catalog/skills/gameTypes';
import { GAME_SKILL_POOL_COMMAND, verifyGameSkillPool, type GameBagIdentity } from './game-skill-pool';
import { isObject, runtimeData, type GameRpc } from './headless-rpc';

function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error('Invalid game runtime scalar');
  return value;
}
function bag(value: unknown): GameBagIdentity[] {
  const data = runtimeData(value, 'spirit_bag');
  if (!Array.isArray(data.spirits) || data.spirits.length > 6) throw new Error('Invalid actual game bag');
  return data.spirits.map((row, index) => {
    if (!isObject(row)) throw new Error('Invalid actual game bag');
    const position = integer(row.bagIndex, 1, 6);
    if (position !== index + 1) throw new Error('Game bag ordering does not match declared positions');
    return { petId: integer(row.id, 1, 0xffffffff), bagPosition: position, observedLevel: integer(row.level, 1, 100), caughtAt: integer(row.caughtTime, 1, 0xffffffff) };
  });
}
interface PoolPacket { sequence: number; capturedAtMs: number; bodyHex: string; account: number }
function packets(value: unknown): PoolPacket[] {
  if (!Array.isArray(value) || value.length > 4096) throw new Error('Invalid traffic snapshot');
  const result: PoolPacket[] = [];
  for (const row of value) {
    if (!isObject(row) || row.direction !== 'inbound' || !isObject(row.payload) || row.payload.kind !== 'adf' || !isObject(row.payload.data)) continue;
    const data = row.payload.data;
    if (!isObject(data.head) || data.head.commandId !== GAME_SKILL_POOL_COMMAND) continue;
    if (data.truncated !== false || typeof data.bodyHex !== 'string' || !/^(?:[a-f0-9]{2})+$/i.test(data.bodyHex) || data.bodyHex.length > 128 * 1024) throw new Error('Invalid captured game skill-pool body');
    result.push({ sequence: integer(row.sequence), capturedAtMs: integer(row.capturedAtMs, 1), bodyHex: data.bodyHex, account: integer(data.head.uin, 0, 0xffffffff) });
  }
  return result;
}

/** Read existing bag pets only. All account/instance identities and packet headers remain in memory. */
export async function collectGameSkillPools(rpc: GameRpc, requestedPetIds?: readonly number[], positions?: readonly number[]): Promise<GameSkillObservation[]> {
  const session = runtimeData(await rpc.request('session_get_snapshot'), 'session');
  if (session.isOnline !== true) throw new Error('Game collection requires an already-online headless session');
  const account = integer(session.uin, 1, 0xffffffff);
  const initialBag = bag(await rpc.request('spirit_bag_request_spirit_bag'));
  if (requestedPetIds && (new Set(requestedPetIds).size !== requestedPetIds.length || requestedPetIds.some(id => !initialBag.some(pet => pet.petId === id)))) throw new Error('Requested pet is not present in the actual game bag');
  if (positions && (new Set(positions).size !== positions.length || positions.some(position => !initialBag.some(pet => pet.bagPosition === position)))) throw new Error('Requested game bag position is unavailable');
  const targets = initialBag.filter(pet => (!requestedPetIds || requestedPetIds.includes(pet.petId)) && (!positions || positions.includes(pet.bagPosition)));
  if (requestedPetIds?.some(id => !targets.some(pet => pet.petId === id))) throw new Error('Requested species is absent from selected bag positions');
  if (!targets.length || new Set(targets.map(pet => pet.petId)).size !== targets.length) throw new Error('Select one actual bag instance per species');

  const streams = new Set<number>(), captured = new Map<number, PoolPacket>();
  let originalEnabled: boolean | undefined, captureFailure: Error | undefined, failure: unknown;
  const result: GameSkillObservation[] = [];
  const remember = (records: unknown) => { for (const packet of packets(records)) captured.set(packet.sequence, packet); if (captured.size > 256) throw new Error('Too many skill-pool packets in one collection'); };
  const unsubscribe = rpc.onNotification(value => {
    try {
      if (!isObject(value) || !Array.isArray(value.notifications)) return;
      for (const row of value.notifications) {
        if (!isObject(row) || row.domain !== 'tools' || !isObject(row.event) || row.event.kind !== 'traffic_monitor' || !isObject(row.event.data)) continue;
        if (row.event.data.type === 'records' && isObject(row.event.data.data)) remember(row.event.data.data.records);
      }
    } catch { captureFailure = new Error('Invalid game traffic notification'); }
  });
  async function snapshot() {
    const stream = runtimeData(await rpc.request('session_open_traffic_monitor_stream'), 'traffic_monitor_stream');
    const id = integer(stream.streamId, 1); streams.add(id);
    if (!isObject(stream.snapshot) || typeof stream.snapshot.enabled !== 'boolean' || !Array.isArray(stream.snapshot.records)) throw new Error('Invalid traffic monitor snapshot');
    let cursor = -1;
    for (const row of stream.snapshot.records) if (isObject(row)) cursor = Math.max(cursor, integer(row.sequence));
    remember(stream.snapshot.records);
    await rpc.request('session_close_traffic_monitor_stream', { stream_id: id }); streams.delete(id);
    return { enabled: stream.snapshot.enabled, cursor };
  }
  try {
    originalEnabled = (await snapshot()).enabled;
    if (!originalEnabled) await rpc.request('session_set_traffic_monitor_enabled', { enabled: true });
    for (const target of targets) {
      const before = bag(await rpc.request('spirit_bag_request_spirit_bag')).find(pet => pet.bagPosition === target.bagPosition);
      if (!before || before.petId !== target.petId || before.caughtAt !== target.caughtAt) throw new Error('Selected game bag instance changed before collection');
      const cursor = (await snapshot()).cursor;
      const payload = runtimeData(await rpc.request('lineup_query_skill_pool', { spirit_id: target.petId, spirit_index: target.bagPosition }), 'spirit_skill_pool');
      const after = bag(await rpc.request('spirit_bag_request_spirit_bag')).find(pet => pet.bagPosition === target.bagPosition);
      if (!after) throw new Error('Selected game bag slot disappeared during collection');
      await snapshot();
      if (captureFailure) throw captureFailure;
      const candidates = [...captured.values()].filter(packet => packet.sequence > cursor && (packet.account === 0 || packet.account === account));
      const unique = new Map<string, PoolPacket>();
      for (const packet of candidates) unique.set(packet.bodyHex.toLowerCase(), packet);
      if (unique.size !== 1) throw new Error('Missing or ambiguous raw game skill-pool response');
      const packet = [...unique.values()][0], bytes = Buffer.from(packet.bodyHex, 'hex');
      const observation = verifyGameSkillPool(bytes, target, before, after, new Date(packet.capturedAtMs).toISOString());
      if (bytes.readUInt16BE(4) !== 0) throw new Error('Public captures cannot retain game response messages');
      if (payload.spiritId !== target.petId || payload.spiritIndex !== target.bagPosition || !Array.isArray(payload.skills) || payload.skills.length !== observation.skills.length) throw new Error('Headless projection does not match the game packet');
      for (let i = 0; i < observation.skills.length; i++) {
        const row = payload.skills[i], expected = observation.skills[i];
        if (!isObject(row) || row.skillId !== expected.skillId || row.inherited !== (expected.learningMethod === '遗传')) throw new Error('Headless skill projection differs from game data');
      }
      result.push(observation);
    }
    const finalSession = runtimeData(await rpc.request('session_get_snapshot'), 'session');
    if (finalSession.isOnline !== true || finalSession.uin !== account) throw new Error('Game session changed during collection');
  } catch (error) { failure = error; }
  finally {
    unsubscribe();
    const cleanupFailures: unknown[] = [];
    for (const id of streams) try { await rpc.request('session_close_traffic_monitor_stream', { stream_id: id }); } catch (error) { cleanupFailures.push(error); }
    if (originalEnabled === false) try { await rpc.request('session_set_traffic_monitor_enabled', { enabled: false }); } catch (error) { cleanupFailures.push(error); }
    captured.clear();
    if (cleanupFailures.length) failure = new AggregateError([...(failure ? [failure] : []), ...cleanupFailures], 'Game collection or local monitor cleanup failed');
  }
  if (failure) throw failure;
  return result;
}
