// A room as a Durable Object with hibernating WebSockets: Cloudflare keeps the sockets open while the object sleeps,
// and nothing is billed for the time between messages. The room logic is in room-core.js.
import { verifyTurnstile } from '../../worker/src/index.js';
import { RoomCore } from './room-core.js';

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function lobby(env) {
  const stub = env.LOBBY.get(env.LOBBY.idFromName('bielany'));
  return (method, ...args) => stub.fetch(`https://lobby/${method}`, { method: 'POST', body: JSON.stringify(args) })
    .then((r) => r.json()).then((d) => d.result);
}

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.core = null;
  }

  getCore(room) {
    if (!this.core) {
      const call = lobby(this.env);
      this.core = new RoomCore({
        send: (ws, obj) => { try { ws.send(JSON.stringify(obj)); } catch { /* already closed */ } },
        close: (ws, reason) => {
          try {
            if (reason) ws.send(JSON.stringify({ t: 'koniec', reason }));
            ws.close(1000, reason || 'pa');
          } catch { /* already closed */ }
        },
        persist: (ws, att) => { try { ws.serializeAttachment(att); } catch { /* closed */ } },
        // Test bots get into the test room with a key (secret BOTS_KEY) instead of Turnstile; nowhere else
        verify: async (token) => {
          if (this.env.BOTS_KEY && this.core.room === 'test' && token === `boty:${this.env.BOTS_KEY}`) return true;
          return verifyTurnstile(token, '', this.env);
        },
        report: ({ players, requests }) => call('report', this.core.room, players, requests),
      }, { room: room || '1', dev: this.env.DEV === '1' });
      // After hibernation the players are still there, in their sockets' attachments
      for (const ws of this.ctx.getWebSockets()) this.core.adopt(ws, ws.deserializeAttachment());
    }
    if (room) this.core.room = room;
    return this.core;
  }

  // Salted address hash, kept only in the attachments of open sockets
  async addressKey(ip) {
    let salt = await this.ctx.storage.get('salt');
    if (!salt) {
      salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      await this.ctx.storage.put('salt', salt);
    }
    return hex(await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${ip || 'unknown'}`))).slice(0, 24);
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const core = this.getCore(request.headers.get('X-Room'));
    core.sweep(true);
    const ipKey = await this.addressKey(request.headers.get('X-Address'));
    const refusal = core.refusal(ipKey);
    if (refusal) return Response.json({ ok: false, reason: refusal }, { status: refusal === 'full' ? 503 : 429 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    core.connect(server, ipKey);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    await this.getCore().message(ws, typeof message === 'string' ? message : '');
  }

  async webSocketClose(ws) {
    await this.getCore().closed(ws);
  }

  async webSocketError(ws) {
    await this.getCore().closed(ws);
  }
}
