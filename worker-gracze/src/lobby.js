// Lobby (one Durable Object for the whole game): which room has space and how many Cloudflare requests playing with
// others used today. Stores only head counts per room and day totals; no players, no addresses.
import { LIMITS } from './config.js';

// Cloudflare's free-plan day starts at 00:00 UTC (2:00 at night in Warsaw in winter, 1:00 in summer)
export const utcDay = (now) => new Date(now).toISOString().slice(0, 10);

export class Lobby {
  constructor(state, env) {
    this.storage = state.storage;
    this.env = env;
    this.now = () => Date.now();
  }

  async used() {
    return (await this.storage.get(`day:${utcDay(this.now())}`)) || 0;
  }

  async rooms() {
    return (await this.storage.get('rooms')) || {};
  }

  // Head count of a room, unless its last report is too old to trust (a room dropped by a deploy never says 0)
  fresh(entry) {
    return entry && this.now() - entry.at < LIMITS.occupancyStaleMs ? entry.players : 0;
  }

  // First public room with space, skipping the ones that just refused (full)
  async pick(skip = []) {
    if ((await this.used()) >= LIMITS.dayRequests) return { ok: false, reason: 'resting' };
    const rooms = await this.rooms();
    for (let n = 1; n <= LIMITS.rooms; n++) {
      const room = String(n);
      if (!skip.includes(room) && this.fresh(rooms[room]) < LIMITS.roomSize) return { ok: true, room };
    }
    return { ok: false, reason: 'full' };
  }

  async report(room, players, requests) {
    const day = `day:${utcDay(this.now())}`;
    const used = ((await this.storage.get(day)) || 0) + Math.max(0, requests | 0);
    await this.storage.put(day, used);
    if (room !== 'test') {
      const rooms = await this.rooms();
      if (players > 0) rooms[room] = { players, at: this.now() };
      else delete rooms[room];
      await this.storage.put('rooms', rooms);
    }
    if (!(await this.storage.get('pruned:' + day))) await this.prune(day);
    return { resting: used >= LIMITS.dayRequests };
  }

  async status() {
    const rooms = await this.rooms();
    const used = await this.used();
    return {
      players: Object.values(rooms).reduce((sum, e) => sum + this.fresh(e), 0),
      requests: used,
      resting: used >= LIMITS.dayRequests,
    };
  }

  // Once a day: forget day totals older than a week
  async prune(day) {
    const old = `day:${utcDay(this.now() - 7 * 24 * 3600 * 1000)}`;
    for (const key of (await this.storage.list({ prefix: 'day:' })).keys()) if (key < old) await this.storage.delete(key);
    for (const key of (await this.storage.list({ prefix: 'pruned:' })).keys()) await this.storage.delete(key);
    await this.storage.put('pruned:' + day, true);
  }

  // Internal RPC over fetch (the Worker and the rooms are the only callers): POST /<method> with a JSON argument array
  async fetch(request) {
    const method = new URL(request.url).pathname.slice(1);
    if (!['pick', 'report', 'status'].includes(method)) return new Response('not found', { status: 404 });
    const args = await request.json();
    return Response.json({ result: await this[method](...args) });
  }
}
