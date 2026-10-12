// SPDX-License-Identifier: GPL-3.0-only
import { createConnection, type Socket } from 'node:net';

export type GameReadMethod = 'session_get_snapshot' | 'spirit_bag_request_spirit_bag' | 'lineup_query_skill_pool' |
  'session_open_traffic_monitor_stream' | 'session_close_traffic_monitor_stream' | 'session_set_traffic_monitor_enabled';
const methods = new Set<GameReadMethod>(['session_get_snapshot', 'spirit_bag_request_spirit_bag', 'lineup_query_skill_pool',
  'session_open_traffic_monitor_stream', 'session_close_traffic_monitor_stream', 'session_set_traffic_monitor_enabled']);
const MAX_FRAME = 1024 * 1024;
export const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export interface GameRpc {
  request(method: GameReadMethod, params?: Record<string, unknown>): Promise<unknown>;
  onNotification(handler: (value: unknown) => void): () => void;
}

/** Only a configured loopback runtime/tunnel is contacted; this client cannot log in or change game state. */
export class HeadlessGameRpc implements GameRpc {
  private socket?: Socket;
  private buffer = Buffer.alloc(0);
  private nextId = 1;
  private readonly handlers = new Set<(value: unknown) => void>();
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor(private readonly endpoint: string, private readonly accessToken?: string, private readonly timeoutMs = 15000) {}

  async connect() {
    let url: URL;
    try { url = new URL(this.endpoint); } catch { throw new Error('Invalid loopback runtime endpoint'); }
    if (url.protocol !== 'tcp:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password ||
      url.search || url.hash || (url.pathname && url.pathname !== '/') || !/^\d+$/.test(url.port) || Number(url.port) < 1 || Number(url.port) > 65535) throw new Error('Use an explicit loopback tcp://host:port runtime or SSH tunnel');
    if (this.socket) throw new Error('Headless runtime is already connected');
    const socket = this.socket = createConnection({ host: url.hostname.replace(/^\[|\]$/g, ''), port: Number(url.port) });
    socket.on('data', chunk => {
      try {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        let end: number;
        while ((end = this.buffer.indexOf(10)) !== -1) {
          if (end > MAX_FRAME) throw new Error('Headless frame exceeds size limit');
          const line = this.buffer.subarray(0, end); this.buffer = this.buffer.subarray(end + 1);
          if (line.length) this.receive(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(line)));
        }
        if (this.buffer.length > MAX_FRAME) throw new Error('Headless frame exceeds size limit');
      } catch { this.fail(new Error('Invalid or oversized headless frame')); socket.destroy(); }
    });
    socket.on('error', () => this.fail(new Error('Headless runtime connection failed')));
    socket.on('close', () => this.fail(new Error('Headless runtime connection closed')));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { finish(); socket.destroy(); reject(new Error('Headless connection timed out')); }, this.timeoutMs);
      const finish = () => { clearTimeout(timer); socket.off('error', failed); socket.off('connect', connected); };
      const connected = () => {
        finish();
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(socket.remoteAddress ?? '')) {
          socket.destroy(); reject(new Error('Headless runtime must resolve to loopback')); return;
        }
        resolve();
      };
      const failed = () => { finish(); reject(new Error('Headless runtime connection failed')); };
      socket.once('connect', connected); socket.once('error', failed);
    });
  }

  request(method: GameReadMethod, params?: Record<string, unknown>) {
    if (!methods.has(method)) return Promise.reject(new Error('Only approved read and local-monitor operations are allowed'));
    const socket = this.socket;
    if (!socket || socket.destroyed) return Promise.reject(new Error('Headless runtime is not connected'));
    if (this.pending.size >= 16) return Promise.reject(new Error('Too many pending headless requests'));
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Headless ${method} timed out`)); }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      socket.write(JSON.stringify({ accessToken: this.accessToken ?? null, id, method, ...(params ? { params } : {}) }) + '\n', error => {
        if (error) this.fail(new Error('Headless runtime write failed'));
      });
    });
  }

  onNotification(handler: (value: unknown) => void) { this.handlers.add(handler); return () => { this.handlers.delete(handler); }; }
  private receive(frame: unknown) {
    if (!isObject(frame) || typeof frame.type !== 'string') throw new Error('Invalid frame');
    if (frame.type === 'notification') { for (const handler of this.handlers) handler(frame.payload); return; }
    if (frame.type !== 'response' && frame.type !== 'protocol_error') return;
    if (!isObject(frame.payload)) throw new Error('Invalid response');
    const payload = frame.payload, id = payload.id ?? payload.requestId;
    if (typeof id !== 'number' || !Number.isSafeInteger(id)) { this.fail(new Error('Headless protocol refused request')); return; }
    const pending = this.pending.get(id); if (!pending) return;
    this.pending.delete(id); clearTimeout(pending.timer);
    if (frame.type === 'response' && payload.status === 'ok') pending.resolve(payload.result);
    else {
      const code = isObject(payload.error) && typeof payload.error.code === 'string' && /^[a-z_][a-z_.-]{0,79}$/.test(payload.error.code) ? payload.error.code : 'request_failed';
      // Error messages and rejected frame contents can contain account-local values.
      pending.reject(new Error(`Headless runtime refused request (${code})`));
    }
  }
  private fail(error: Error) {
    for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    this.pending.clear();
  }
  async close() {
    const socket = this.socket; this.handlers.clear(); this.fail(new Error('Headless client closed'));
    this.socket = undefined; this.buffer = Buffer.alloc(0);
    if (!socket || socket.closed) return;
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => { socket.destroy(); }, 2000);
      socket.once('close', () => { clearTimeout(timer); resolve(); }); socket.end();
    });
  }
}

export function runtimeData(value: unknown, kind: string) {
  if (!isObject(value) || value.kind !== kind || !isObject(value.data)) throw new Error(`Unexpected ${kind} runtime result`);
  return value.data;
}
