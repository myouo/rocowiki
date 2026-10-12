// SPDX-License-Identifier: GPL-3.0-only
import { createServer, type Socket } from 'node:net';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { collectGameSkillPools } from '../scripts/updates/collect-game-skills';
import { HeadlessGameRpc, type GameReadMethod, type GameRpc } from '../scripts/updates/headless-rpc';
import { buildGameSkillSnapshot, emptyGameSkillSnapshot, parseGameSkillCaptures, validateGameSkillSnapshot } from '../scripts/updates/game-skill-snapshot';
import { verifyGameSkillPool } from '../scripts/updates/game-skill-pool';
import { buildOfficialPetCatalog } from '../apps/web/src/wiki/catalog/pets/officialModel';
import { buildOfficialSkillCatalog } from '../apps/web/src/wiki/catalog/skills/officialModel';
import { attachGameSkillRelations } from '../apps/web/src/wiki/catalog/skills/gameModel';
import type { OfficialPetSnapshot } from '../apps/web/src/wiki/catalog/pets/officialTypes';
import type { OfficialSkillSnapshot } from '../apps/web/src/wiki/catalog/skills/officialTypes';

// Real packet body with only public species/skill data. All account and instance values below are synthetic.
const hex = '00000000000000000CD501000C0195140001AD0A0008F70A00018A1400072A0C0001A40500066005000E1F02000E200C000E210C000E220F000E230F00';
const time = '2026-10-12T14:45:54.959Z';
const identity = { petId: 3285, bagPosition: 1, observedLevel: 100, caughtAt: 1 };
const observation = verifyGameSkillPool(Buffer.from(hex, 'hex'), identity, identity, identity, time);
const pets = JSON.parse(readFileSync('apps/web/content/official-pets.json', 'utf8')) as OfficialPetSnapshot;
const skills = JSON.parse(readFileSync('apps/web/content/official-skills.json', 'utf8')) as OfficialSkillSnapshot;

class GameFixture implements GameRpc {
  enabled = false;
  sequence = 100;
  nextStream = 1;
  bagReads = 0;
  mode: 'normal' | 'swapped' | 'wrong_packet' | 'cleanup_failure' | 'offline' = 'normal';
  readonly calls: { method: string; params?: Record<string, unknown> }[] = [];
  readonly streams = new Set<number>();
  readonly records: unknown[] = [];
  readonly handlers = new Set<(value: unknown) => void>();
  onNotification(handler: (value: unknown) => void) { this.handlers.add(handler); return () => { this.handlers.delete(handler); }; }
  async request(method: GameReadMethod, params?: Record<string, unknown>): Promise<unknown> {
    this.calls.push({ method, params });
    if (method === 'session_get_snapshot') return { kind: 'session', data: { isOnline: this.mode !== 'offline', uin: 42 } };
    if (method === 'spirit_bag_request_spirit_bag') {
      this.bagReads++;
      return { kind: 'spirit_bag', data: { spirits: [{ id: 3285, bagIndex: 1, level: 100, caughtTime: this.mode === 'swapped' && this.bagReads >= 3 ? 2 : 1, nickname: 'synthetic private nickname' }] } };
    }
    if (method === 'session_open_traffic_monitor_stream') {
      const id = this.nextStream++; this.streams.add(id);
      return { kind: 'traffic_monitor_stream', data: { streamId: id, snapshot: { enabled: this.enabled, records: [...this.records] } } };
    }
    if (method === 'session_close_traffic_monitor_stream') { this.streams.delete(Number(params?.stream_id)); return { kind: 'empty' }; }
    if (method === 'session_set_traffic_monitor_enabled') {
      if (params?.enabled === false && this.mode === 'cleanup_failure') throw new Error('synthetic cleanup failure');
      this.enabled = params?.enabled === true; return { kind: 'traffic_monitor_status', data: { enabled: this.enabled } };
    }
    if (method === 'lineup_query_skill_pool') {
      const body = Buffer.from(hex, 'hex');
      if (this.mode === 'wrong_packet') body.writeUInt32BE(3402, 6);
      this.records.push({ sequence: ++this.sequence, capturedAtMs: Date.parse(time), direction: 'inbound', payload: { kind: 'adf', data: {
        head: { commandId: 0xb000d, uin: 42 }, bodyHex: body.toString('hex'), truncated: false,
      } } });
      const value = { notifications: [{ domain: 'tools', event: { kind: 'traffic_monitor', data: { type: 'records', data: { records: this.records.slice(-1) } } } }] };
      for (const handler of this.handlers) handler(value);
      return { kind: 'spirit_skill_pool', data: { spiritId: 3285, spiritIndex: 1, skills: observation.skills.map((skill, i) => ({ skillId: skill.skillId, inherited: false, poolPosition: i + 1 })) } };
    }
    throw new Error('Unexpected operation');
  }
}

describe('game-only collection boundaries', () => {
  it('reads the independently identified bag and raw packet, excluding account and instance data', async () => {
    const rpc = new GameFixture();
    const result = await collectGameSkillPools(rpc, [3285]);
    expect(result).toEqual([observation]);
    expect(JSON.stringify(result)).not.toMatch(/uin|caughtTime|caughtAt|nickname|bodyHex|accessToken/);
    expect(rpc.enabled).toBe(false); expect(rpc.streams.size).toBe(0); expect(rpc.handlers.size).toBe(0);
    expect(rpc.calls.some(call => /login|switch_skill|train|move|clear_traffic/.test(call.method))).toBe(false);
  });
  it('refuses an absent species before submitting a pool request', async () => {
    const rpc = new GameFixture();
    await expect(collectGameSkillPools(rpc, [3402])).rejects.toThrow('actual game bag');
    expect(rpc.calls.some(call => call.method === 'lineup_query_skill_pool')).toBe(false);
  });
  it('refuses an instance swap and misleading packet identity while restoring capture state', async () => {
    for (const mode of ['swapped', 'wrong_packet'] as const) {
      const rpc = new GameFixture(); rpc.mode = mode;
      await expect(collectGameSkillPools(rpc)).rejects.toThrow();
      expect(rpc.enabled).toBe(false); expect(rpc.streams.size).toBe(0); expect(rpc.handlers.size).toBe(0);
    }
  });
  it('preserves already enabled monitoring, refuses offline runtimes and exposes cleanup failures', async () => {
    const active = new GameFixture(); active.enabled = true;
    await collectGameSkillPools(active); expect(active.enabled).toBe(true);
    const offline = new GameFixture(); offline.mode = 'offline';
    await expect(collectGameSkillPools(offline)).rejects.toThrow('already-online');
    expect(offline.calls).toHaveLength(1);
    const failure = new GameFixture(); failure.mode = 'cleanup_failure';
    await expect(collectGameSkillPools(failure)).rejects.toThrow('cleanup failed');
    expect(failure.streams.size).toBe(0); expect(failure.handlers.size).toBe(0);
  });
});

describe('sanitized game snapshots and bidirectional reading', () => {
  it('rejects account fields and auxiliary ranks, retaining captured times when membership is unchanged', () => {
    expect(() => parseGameSkillCaptures({ schemaVersion: 1, captures: [{ ...observation, uin: 42 }] })).toThrow();
    expect(() => parseGameSkillCaptures({ schemaVersion: 1, captures: [{ ...observation, skills: [{ ...observation.skills[0], learnLevel: 60 }] }] })).toThrow();
    const first = buildGameSkillSnapshot([observation], pets, skills);
    const later = { ...observation, source: { ...observation.source, retrievedAt: '2026-10-13T01:00:00Z', bodySha256: 'b'.repeat(64) } };
    expect(buildGameSkillSnapshot([later], pets, skills, first)).toEqual(first);
    expect(validateGameSkillSnapshot(first)).toEqual(first);
    expect(validateGameSkillSnapshot(emptyGameSkillSnapshot()).source).toBeNull();
    expect(() => validateGameSkillSnapshot({ ...first, source: { ...first.source, sha256: 'c'.repeat(64) } })).toThrow('digest');
    const changed = { ...later, observedLevel: 50, skills: later.skills.slice(0, 2) };
    const next = buildGameSkillSnapshot([changed], pets, skills, first);
    expect(next.pets['3285']).toMatchObject({ observedLevel: 50, scope: 'observed-bag-pool', skills: changed.skills });
    expect(() => buildGameSkillSnapshot([observation], pets, skills, next)).toThrow('newer');
  });
  it('joins game IDs without promoting legacy or community learning levels', () => {
    const snapshot = buildGameSkillSnapshot([observation], pets, skills);
    const catalogPets = buildOfficialPetCatalog({ ...pets, pets: pets.pets.filter(pet => pet.id === 3285) }, [], {});
    const catalogSkills = buildOfficialSkillCatalog(skills, []);
    catalogPets[0].skills = [{ skillId: 405, name: catalogSkills.find(skill => skill.number === 405)!.name, learnLevel: 50, learningMethod: '升级', sourceUrl: 'https://example.test/auxiliary' }];
    attachGameSkillRelations(catalogPets, catalogSkills, snapshot);
    expect(catalogPets[0].skills[0]).toMatchObject({ skillId: 394, learnLevel: null, evidence: 'game' });
    const { resolveSkillLearners } = createRequire(import.meta.url)('../apps/web/src/wiki/skillLearnerModel.js');
    const skill = catalogSkills.find(skill => skill.number === 405)!;
    const row = resolveSkillLearners({ skill, pets: catalogPets, learners: [{ petSlug: catalogPets[0].slug, method: '升级', level: 50, sourceUrl: 'https://example.test/auxiliary' }] }).rows[0];
    expect(row).toMatchObject({ gameObserved: true, method: '', level: null });
    expect(resolveSkillLearners({ skill, pets: catalogPets }).unknownOwner).toBe('');
  });
});

describe('native headless transport', () => {
  it('handles real TCP framing, interleaved notifications and denies game writes before transmission', async () => {
    const peers = new Set<Socket>(), received: string[] = [];
    const server = createServer(socket => {
      peers.add(socket); socket.on('close', () => peers.delete(socket));
      let buffer = '';
      socket.on('data', bytes => {
        buffer += bytes.toString();
        let end;
        while ((end = buffer.indexOf('\n')) !== -1) {
          const frame = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1); received.push(frame.method);
          const result = { type: 'response', payload: { id: frame.id, status: 'ok', result: { kind: 'session', data: { isOnline: false, label: '中文帧' } } } };
          const response = Buffer.from(JSON.stringify(result) + '\n');
          socket.write(JSON.stringify({ type: 'notification', payload: { notifications: [] } }) + '\n');
          socket.write(response.subarray(0, response.length - 5)); socket.write(response.subarray(response.length - 5));
        }
      });
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
    const rpc = new HeadlessGameRpc(`tcp://127.0.0.1:${address.port}`, 'synthetic-ipc-token', 1000);
    let notifications = 0; const unsubscribe = rpc.onNotification(() => notifications++);
    try {
      await rpc.connect();
      expect(await rpc.request('session_get_snapshot')).toMatchObject({ kind: 'session', data: { label: '中文帧' } });
      await expect(rpc.request('lineup_switch_skill' as GameReadMethod)).rejects.toThrow('Only approved');
      expect(received).toEqual(['session_get_snapshot']); expect(notifications).toBe(1);
    } finally {
      unsubscribe(); await rpc.close(); for (const socket of peers) socket.destroy();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
  it('refuses credential-bearing or remote endpoints without connecting', async () => {
    for (const endpoint of ['Key@synthetic', 'tcp://example.test:1234', 'tcp://secret@example.test:1234', 'tcp://127.0.0.1:1234?token=synthetic']) {
      const rpc = new HeadlessGameRpc(endpoint); await expect(rpc.connect()).rejects.toThrow(); await rpc.close();
    }
  });
  it('suppresses account-local errors and rejects outstanding requests when the transport closes', async () => {
    const peers = new Set<Socket>();
    const server = createServer(socket => {
      peers.add(socket); socket.on('close', () => peers.delete(socket));
      let buffer = '';
      socket.on('data', bytes => {
        buffer += bytes.toString();
        const end = buffer.indexOf('\n'); if (end < 0) return;
        const frame = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
        if (frame.method === 'session_get_snapshot') socket.write(JSON.stringify({ type: 'response', payload: { id: frame.id, status: 'error', error: { code: 'not_online', message: 'synthetic-private-key' } } }) + '\n');
        else socket.end();
      });
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
    const rpc = new HeadlessGameRpc(`tcp://127.0.0.1:${address.port}`, undefined, 1000);
    try {
      await rpc.connect();
      await expect(rpc.request('session_get_snapshot')).rejects.toThrow('Headless runtime refused request (not_online)');
      await expect(rpc.request('spirit_bag_request_spirit_bag')).rejects.toThrow('connection closed');
    } finally { await rpc.close(); for (const socket of peers) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
