// One room of players (docs/api-gracze.md), without Cloudflare specifics so tests can drive it: room.js wraps it in a
// hibernating Durable Object. Everything a player is lives in its socket's attachment (`att`), so a room that woke up
// from hibernation rebuilds itself from its sockets; the only other state is the unreported message count.
import { BOUNDS, GESTURES, LIMITS, MODES, MODE_SPEED, RATE } from './config.js';
import { COLORS, pickName } from './names.js';
import { dropRides, expireRides, rideMessage, waitingRides } from './rides.js';

const round = (v) => Math.round(v * 100) / 100;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

// Clean position of a "s" / "tp" message, or null
export function parseState(msg) {
  const { x, y, z, h, m } = msg;
  const v = msg.v ?? 0;
  if (![x, y, z, h, v].every(finite) || !MODES.includes(m)) return null;
  const g = LIMITS.margin;
  if (x < BOUNDS.minX - g || x > BOUNDS.maxX + g || z < BOUNDS.minZ - g || z > BOUNDS.maxZ + g) return null;
  if (y < LIMITS.minY || y > LIMITS.maxY || v < 0 || v > LIMITS.maxV || Math.abs(h) > 100) return null;
  return { x: round(x), y: round(y), z: round(z), h: Math.round(h * 1000) / 1000, m, v: Math.round(v * 10) / 10 };
}

// Whether a move from `a` (at time ta) to `b` (now) is possible without a teleport
export function plausibleMove(a, ta, b, now) {
  if (!a) return true;
  const dt = Math.max(0, now - ta) / 1000;
  const speed = Math.max(MODE_SPEED[a.m], MODE_SPEED[b.m]);
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) <= speed * dt * 1.5 + 15;
}

export function publicPlayer(att) {
  return { id: att.id, name: att.text, color: att.color, ...(att.p || {}) };
}

export class RoomCore {
  // io: { send(ws, obj), close(ws, reason), persist(ws, att), verify(token) -> Promise<bool>,
  //       report({ players, requests }) -> Promise<{ resting }> }
  constructor(io, { room = '1', dev = false, now = () => Date.now(), random = Math.random } = {}) {
    this.io = io;
    this.room = room;
    this.dev = dev;
    this.now = now;
    this.random = random;
    this.players = new Map(); // ws -> att
    this.unreported = 0; // incoming messages not yet reported to the lobby
    this.connects = 0;
    this.lastSweep = 0;
  }

  adopt(ws, att) {
    if (att) this.players.set(ws, att);
    if (att?.room) this.room = att.room;
  }

  count() { return this.players.size; }
  joined() { return [...this.players.values()].filter((a) => a.stage === 'in').length; }

  // Before accepting a socket: null when it may connect, else the refusal reason
  refusal(ipKey) {
    if (this.players.size >= LIMITS.roomSize) return 'full';
    if (!this.dev && [...this.players.values()].filter((a) => a.ip === ipKey).length >= LIMITS.perAddress) return 'too_many';
    return null;
  }

  connect(ws, ipKey) {
    const now = this.now();
    const att = { stage: 'new', room: this.room, ip: ipKey, t0: now, last: now, tokens: LIMITS.rateBurst, tt: now, drops: [] };
    this.players.set(ws, att);
    this.connects++;
    this.io.persist(ws, att);
    this.sweep(true);
  }

  others(ws) {
    return [...this.players].filter(([w, a]) => w !== ws && a.stage === 'in').map(([w]) => w);
  }

  broadcast(from, obj) {
    for (const w of this.others(from)) this.io.send(w, obj);
  }

  // Token bucket per player; false when the message has to be dropped
  take(att, now) {
    att.tokens = Math.min(LIMITS.rateBurst, att.tokens + ((now - att.tt) / 1000) * LIMITS.ratePerSecond);
    att.tt = now;
    if (att.tokens >= 1) { att.tokens -= 1; return true; }
    return false;
  }

  // Counts a dropped message; true when the player has to go ("abuse")
  dropped(att, now) {
    att.drops = att.drops.filter((t) => now - t < 60000);
    att.drops.push(now);
    return att.drops.length >= LIMITS.droppedPerMinute;
  }

  async message(ws, raw) {
    const att = this.players.get(ws);
    if (!att) return;
    const now = this.now();
    this.unreported++;
    att.last = now; // any message, even a dropped one, shows the player is still there
    this.sweep();
    let msg = null;
    if (typeof raw === 'string' && raw.length <= LIMITS.messageBytes) {
      try { msg = JSON.parse(raw); } catch { msg = null; }
    }
    const ok = msg && typeof msg === 'object' && typeof msg.t === 'string' && this.take(att, now);
    if (!ok) {
      if (this.dropped(att, now)) return this.leave(ws, 'abuse');
      this.io.persist(ws, att);
      return;
    }

    if (att.stage === 'new') {
      if (msg.t !== 'hej') { this.io.persist(ws, att); return; }
      att.stage = 'checking';
      this.io.persist(ws, att);
      const human = await this.io.verify(typeof msg.turnstile === 'string' ? msg.turnstile : '');
      if (!this.players.has(ws)) return; // gone while Turnstile answered
      if (!human) return this.leave(ws, 'turnstile');
      return this.join(ws, att, msg);
    }
    if (att.stage !== 'in') { this.io.persist(ws, att); return; }

    if (msg.t === 's' || msg.t === 'tp') {
      const p = parseState(msg);
      const teleport = msg.t === 'tp';
      if (!p || (teleport && now - (att.ttp || 0) < LIMITS.teleportMs) || (!teleport && !plausibleMove(att.p, att.pt, p, now))) {
        if (this.dropped(att, now)) return this.leave(ws, 'abuse');
      } else {
        att.p = p;
        att.pt = now;
        if (teleport) att.ttp = now;
        this.broadcast(ws, { t: msg.t, id: att.id, ...p });
      }
    } else if (msg.t === 'g') {
      if (GESTURES.includes(msg.g) && now - (att.tg || 0) >= LIMITS.gestureMs) {
        att.tg = now;
        this.broadcast(ws, { t: 'g', id: att.id, g: msg.g });
      }
    } else if (msg.t === 'k') {
      // The horn, heard only nearby (its sound carries ~140 m in the game)
      if (now - (att.tk || 0) >= LIMITS.hornMs && att.p) {
        att.tk = now;
        for (const [w, a] of this.players) {
          if (w === ws || a.stage !== 'in' || !a.p) continue;
          if (Math.hypot(a.p.x - att.p.x, a.p.z - att.p.z) <= LIMITS.hornRange) this.io.send(w, { t: 'k', id: att.id });
        }
      }
    } else if (msg.t === 'imie') {
      // A new random name and colour (the phone's "Losuj"), for everybody to see
      if (now - (att.tn || 0) >= LIMITS.renameMs) {
        att.tn = now;
        const taken = new Set([...this.players.values()].filter((a) => a.stage === 'in' && a !== att).map((a) => a.text));
        const picked = pickName(null, -1, taken, this.random);
        Object.assign(att, { name: picked.name, text: picked.text, color: picked.color });
        this.io.send(ws, { t: 'imie', id: att.id, name: att.text, nameId: att.name, color: att.color });
        this.broadcast(ws, { t: 'imie', id: att.id, name: att.text, color: att.color });
      }
    } else if (msg.t === 'pa') {
      return this.leave(ws, null);
    } else {
      rideMessage(this, ws, att, msg, now);
    }
    this.io.persist(ws, att);
    if (this.unreported >= LIMITS.reportEvery) await this.report();
  }

  async join(ws, att, msg) {
    const ins = [...this.players.values()].filter((a) => a.stage === 'in');
    const used = new Set(ins.map((a) => a.id));
    let id = 1;
    while (used.has(id)) id++;
    const picked = pickName(msg.name, msg.color, new Set(ins.map((a) => a.text)), this.random);
    Object.assign(att, { stage: 'in', id, name: picked.name, text: picked.text, color: picked.color });
    this.io.persist(ws, att);
    this.io.send(ws, {
      t: 'witaj', id, name: att.text, nameId: att.name, color: att.color, colors: COLORS, room: this.room,
      players: ins.map(publicPlayer), rides: waitingRides(this), rate: RATE,
    });
    this.broadcast(ws, { t: 'nowy', p: publicPlayer(att) });
    await this.report();
  }

  // Server-side end of a player: tell it why (unless it said goodbye), close, tell the others
  async leave(ws, reason) {
    const att = this.players.get(ws);
    if (!att) return;
    dropRides(this, ws, att);
    this.players.delete(ws);
    this.io.close(ws, reason);
    if (att.stage === 'in') {
      this.broadcast(ws, { t: 'wyszedl', id: att.id });
      await this.report();
    }
  }

  // The socket closed from the player's side (tab closed, network gone)
  async closed(ws) {
    const att = this.players.get(ws);
    if (!att) return;
    dropRides(this, ws, att);
    this.players.delete(ws);
    if (att.stage === 'in') {
      this.broadcast(ws, { t: 'wyszedl', id: att.id });
      await this.report();
    }
  }

  // Silent players and ones that never said "hej" go; at most every LIMITS.sweepMs, only when something happens
  sweep(force = false) {
    const now = this.now();
    if (!force && now - this.lastSweep < LIMITS.sweepMs) return;
    this.lastSweep = now;
    for (const [w, a] of [...this.players]) {
      const late = a.stage === 'in' ? now - a.last > LIMITS.silentMs : now - a.t0 > LIMITS.helloMs;
      if (late) this.leave(w, 'timeout');
    }
    expireRides(this, now);
  }

  async report() {
    const requests = Math.ceil(this.unreported / LIMITS.messagesPerRequest) + this.connects * LIMITS.requestsPerConnect;
    this.unreported = 0;
    this.connects = 0;
    let answer;
    try {
      answer = await this.io.report({ players: this.joined(), requests });
    } catch {
      return;
    }
    if (answer?.resting) this.endAll('resting');
  }

  endAll(reason) {
    for (const w of [...this.players.keys()]) {
      this.players.delete(w);
      this.io.close(w, reason);
    }
  }
}
