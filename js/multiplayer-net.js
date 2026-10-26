// js/multiplayer-net.js
// Playing with others, the network side (step 5.2): connects to the players' server (worker-gracze/, contract:
// docs/api-gracze.md), sends where we are and keeps a smoothed track of everybody else. No three.js here, so tests
// (tests/multiplayer.test.mjs) can drive it; js/multiplayer.js draws the players. When the server is off, resting,
// full or simply not there, the game plays alone without console errors (one console.info).
import { turnstileProvider } from './chat.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const STORAGE_KEY = 'bielany-gracz-v1';
const DELAY_MS = 200; // others are drawn this far in the past, between two received states
const EXTRAPOLATE_MS = 500; // after the last state, keep moving this long at the last speed, then stop
const RETRY_MS = [5000, 15000, 60000];
const MOVE_EPS = 0.05; // metres / radians that count as moving

// Local server on localhost, the same host elsewhere; ?pokoj=test joins the test room (bots)
function playersEndpoint(location = globalThis.location) {
  const test = new URLSearchParams(location?.search || '').get('pokoj') === 'test' ? '?pokoj=test' : '';
  if (LOCAL_HOSTS.has(location?.hostname)) return { ws: `ws://localhost:8788/api/gracze${test}`, stan: 'http://localhost:8788/api/gracze/stan' };
  return { ws: `wss://${location.host}/api/gracze${test}`, stan: '/api/gracze/stan' };
}

// ?solo, and the district office's version, play alone (decision 4)
function soloByUrl(search = globalThis.location?.search || '', urzad = false) {
  if (urzad) return true;
  try { return new URLSearchParams(search).has('solo'); } catch { return false; }
}

const wrapAngle = (a) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;

// Received states of one player, sampled DELAY_MS in the past: linear between states, heading the short way round
class Track {
  constructor() {
    this.snaps = []; // { t, x, y, z, h, m, v }
  }

  push(s, t, teleport = false) {
    if (teleport) this.snaps.length = 0;
    const last = this.snaps.at(-1);
    if (last && t <= last.t) t = last.t + 1;
    this.snaps.push({ t, x: s.x, y: s.y, z: s.z, h: s.h, m: s.m, v: s.v || 0 });
    if (this.snaps.length > 20) this.snaps.shift();
  }

  get empty() { return this.snaps.length === 0; }

  sample(now, out = {}) {
    const snaps = this.snaps;
    if (!snaps.length) return null;
    const t = now - DELAY_MS;
    let i = snaps.length - 1;
    while (i > 0 && snaps[i - 1].t > t) i--;
    const b = snaps[i];
    const a = i > 0 ? snaps[i - 1] : null;
    if (a && t >= a.t && t <= b.t) {
      const k = (t - a.t) / (b.t - a.t);
      out.x = a.x + (b.x - a.x) * k;
      out.y = a.y + (b.y - a.y) * k;
      out.z = a.z + (b.z - a.z) * k;
      out.h = a.h + wrapAngle(b.h - a.h) * k;
      out.m = b.m;
      out.v = a.v + (b.v - a.v) * k;
      return out;
    }
    // Past the newest state: keep going along the heading at its speed, for a moment
    const last = snaps.at(-1);
    const ahead = Math.max(0, Math.min(EXTRAPOLATE_MS, t - last.t)) / 1000;
    const prev = snaps.length > 1 ? snaps.at(-2) : null;
    let vx = 0, vz = 0, vy = 0;
    if (prev && last.t > prev.t) {
      const dt = (last.t - prev.t) / 1000;
      vx = (last.x - prev.x) / dt; vy = (last.y - prev.y) / dt; vz = (last.z - prev.z) / dt;
    }
    if (t < last.t) { vx = vy = vz = 0; } // only one state so far and it is still in the future: hold it
    out.x = last.x + vx * ahead;
    out.y = last.y + vy * ahead;
    out.z = last.z + vz * ahead;
    out.h = last.h;
    out.m = last.m;
    out.v = ahead >= EXTRAPOLATE_MS / 1000 ? 0 : last.v;
    return out;
  }
}

// What to send now: a state 5x a second while moving, once a second standing still, a teleport after a jump
class SendPolicy {
  constructor(rate = { move: 5, idle: 1 }) {
    this.rate = rate;
    this.last = null; // { t, x, y, z, h, m }
  }

  next(p, now) {
    const l = this.last;
    const jump = l && (Math.hypot(p.x - l.x, p.z - l.z) > 60 || (l.m !== p.m && Math.hypot(p.x - l.x, p.z - l.z) > 15));
    const moved = !l || l.m !== p.m || Math.abs(p.x - l.x) > MOVE_EPS || Math.abs(p.y - l.y) > MOVE_EPS
      || Math.abs(p.z - l.z) > MOVE_EPS || Math.abs(wrapAngle(p.h - l.h)) > MOVE_EPS;
    const every = 1000 / (moved ? this.rate.move : this.rate.idle);
    if (l && now - l.t < every - 5) return null;
    this.last = { t: now, x: p.x, y: p.y, z: p.z, h: p.h, m: p.m };
    return {
      t: jump ? 'tp' : 's',
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100,
      z: Math.round(p.z * 100) / 100,
      h: Math.round(wrapAngle(p.h) * 1000) / 1000,
      m: p.m,
      v: Math.round(Math.min(150, Math.abs(p.v || 0)) * 10) / 10,
    };
  }
}

function loadIdentity(storage) {
  try {
    const d = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    if (d && d.name && typeof d.name === 'object') return { name: d.name, color: d.color };
  } catch { /* storage is optional */ }
  return null;
}

function saveIdentity(storage, identity) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(identity)); } catch { /* storage is optional */ }
}

// Connection to the players' server. status: 'off' (not started / solo), 'connecting', 'online', 'resting', 'down'
class MultiplayerClient {
  constructor({
    location = globalThis.location, fetchImpl = (...a) => globalThis.fetch(...a), WebSocketImpl = globalThis.WebSocket,
    getToken = null, storage = globalThis.localStorage, now = () => performance.now(), setTimer = setTimeout,
    clearTimer = clearTimeout, urzad = false, log = (...a) => console.info(...a), doc = globalThis.document,
  } = {}) {
    this.endpoint = playersEndpoint(location);
    this.solo = soloByUrl(location?.search || '', urzad);
    this.fetch = fetchImpl;
    this.WebSocket = WebSocketImpl;
    this.getToken = getToken || turnstileProvider();
    this.storage = storage;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.log = log;
    this.status = 'off';
    this.reason = '';
    this.players = new Map(); // id -> { id, name, color, track, gesture: { g, t } }
    this.me = null; // { id, name, color }
    this.colors = [];
    this.policy = new SendPolicy();
    this.ws = null;
    this.retries = 0;
    this.timer = null;
    this.enabled = !this.solo;
    this.onChange = null; // (event, data) for the phone app (5.3) and the renderer
    // A hidden tab stops sending (no frames) and the server lets it go after 10 s; coming back reconnects at once
    doc?.addEventListener?.('visibilitychange', () => {
      if (doc.hidden || this.status !== 'down' || !this.enabled) return;
      this.clearTimer(this.timer);
      this.retries = 0;
      this.start();
    });
  }

  emit(event, data) {
    try { this.onChange?.(event, data); } catch { /* listeners never break the network */ }
  }

  setStatus(status, reason = '') {
    if (this.status === status && this.reason === reason) return;
    this.status = status;
    this.reason = reason;
    this.emit('status', { status, reason });
  }

  async start() {
    if (!this.enabled || this.status === 'connecting' || this.status === 'online') return;
    this.setStatus('connecting');
    let stan;
    try {
      const r = await this.fetch(this.endpoint.stan, { cache: 'no-store' });
      stan = await r.json();
    } catch {
      return this.down('unreachable');
    }
    if (!this.enabled) return this.setStatus('off');
    if (!stan?.ok || !stan.enabled) {
      this.setStatus('resting', stan?.reason || 'resting');
      this.log('[gracze] gra z innymi niedostępna:', stan?.reason || 'resting');
      return;
    }
    let token = '';
    try { token = await this.getToken(stan.turnstileSiteKey); } catch { return this.down('turnstile'); }
    if (!this.enabled) return this.setStatus('off');
    this.open(token);
  }

  open(token) {
    let ws;
    try { ws = new this.WebSocket(this.endpoint.ws); } catch { return this.down('unreachable'); }
    this.ws = ws;
    ws.onopen = () => {
      const saved = loadIdentity(this.storage);
      ws.send(JSON.stringify({ t: 'hej', turnstile: token, ...(saved || {}) }));
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.receive(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.clearPlayers();
      if (this.status === 'online' || this.status === 'connecting') this.down('closed');
    };
    ws.onerror = () => { /* onclose follows */ };
  }

  receive(msg) {
    const now = this.now();
    switch (msg.t) {
      case 'witaj':
        this.me = { id: msg.id, name: msg.name, color: msg.color };
        this.colors = Array.isArray(msg.colors) ? msg.colors : [];
        if (msg.rate) this.policy.rate = msg.rate;
        if (msg.nameId) saveIdentity(this.storage, { name: msg.nameId, color: msg.color });
        this.retries = 0;
        this.clearPlayers();
        for (const p of msg.players || []) this.add(p, now);
        this.setStatus('online');
        this.emit('welcome', this.me);
        break;
      case 'nowy':
        this.add(msg.p, now);
        break;
      case 's':
      case 'tp': {
        const p = this.players.get(msg.id);
        if (p) p.track.push(msg, now, msg.t === 'tp');
        break;
      }
      case 'g': {
        const p = this.players.get(msg.id);
        if (p) { p.gesture = { g: msg.g, t: now }; this.emit('gesture', p); }
        break;
      }
      case 'wyszedl':
        if (this.players.delete(msg.id)) this.emit('leave', msg.id);
        break;
      case 'koniec':
        this.end(msg.reason);
        break;
      default:
    }
  }

  add(p, now) {
    if (!p || typeof p.id !== 'number') return;
    const player = { id: p.id, name: String(p.name || ''), color: p.color, track: new Track(), gesture: null };
    if (typeof p.x === 'number') player.track.push(p, now, true);
    this.players.set(p.id, player);
    this.emit('join', player);
  }

  colorOf(player) {
    return this.colors[player?.color] || '#ffffff';
  }

  clearPlayers() {
    if (!this.players.size) return;
    this.players.clear();
    this.emit('clear');
  }

  // The server ended us: some reasons are final for this session, the rest retry
  end(reason) {
    const ws = this.ws;
    this.ws = null;
    try { ws?.close(); } catch { /* closed */ }
    this.clearPlayers();
    if (reason === 'resting' || reason === 'off') this.setStatus('resting', reason);
    else if (reason === 'abuse' || reason === 'turnstile' || reason === 'too_many') this.down(reason, false);
    else this.down(reason || 'closed');
  }

  down(reason, retry = true) {
    this.setStatus('down', reason);
    if (this.retries === 0) this.log('[gracze] gra z innymi bez połączenia:', reason);
    if (!retry || !this.enabled) return;
    const wait = RETRY_MS[Math.min(this.retries, RETRY_MS.length - 1)];
    this.retries++;
    this.clearTimer(this.timer);
    this.timer = this.setTimer(() => { this.timer = null; if (this.status === 'down') this.start(); }, wait);
  }

  // Called every frame with the player's position (x, y, z, heading h, mode m, speed v)
  update(p) {
    if (this.status !== 'online' || !this.ws || this.ws.readyState !== 1) return;
    const msg = this.policy.next(p, this.now());
    if (msg) {
      try { this.ws.send(JSON.stringify(msg)); } catch { /* onclose follows */ }
    }
  }

  gesture(g) {
    if (this.status === 'online' && this.ws?.readyState === 1) this.ws.send(JSON.stringify({ t: 'g', g }));
  }

  // The switch in the phone (5.3); off says goodbye and stays off until switched on
  setEnabled(on) {
    if (this.solo) return;
    this.enabled = on;
    if (on) { this.retries = 0; this.start(); return; }
    this.clearTimer(this.timer);
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      try { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'pa' })); ws.close(); } catch { /* closed */ }
    }
    this.clearPlayers();
    this.setStatus('off');
  }
}

export { MultiplayerClient, Track, SendPolicy, playersEndpoint, soloByUrl, wrapAngle, DELAY_MS, EXTRAPOLATE_MS, RETRY_MS, STORAGE_KEY };
