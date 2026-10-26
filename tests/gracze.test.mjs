import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { BOUNDS, LIMITS } from '../worker-gracze/src/config.js';
import { ADJECTIVES, NOUNS, COLORS, nameText, pickName } from '../worker-gracze/src/names.js';
import { RoomCore, parseState, plausibleMove } from '../worker-gracze/src/room-core.js';
import { Lobby, utcDay } from '../worker-gracze/src/lobby.js';
import { handle } from '../worker-gracze/src/index.js';

const T0 = Date.UTC(2026, 9, 26, 12, 0, 0);
const state = (extra = {}) => ({ t: 's', x: 9.4, y: 0, z: -12.4, h: -2.2, m: 'car', v: 10, ...extra });

// In-memory Durable Object storage with the calls the Lobby uses
function fakeStorage() {
  const map = new Map();
  return {
    map,
    get: async (k) => structuredClone(map.get(k)),
    put: async (k, v) => { map.set(k, structuredClone(v)); },
    delete: async (k) => map.delete(k),
    list: async ({ prefix }) => new Map([...map].filter(([k]) => k.startsWith(prefix)).sort()),
  };
}

// A room with fake sockets; `human` decides Turnstile, `resting` the lobby's answer
function makeRoom({ dev = false, human = true, resting = false } = {}) {
  let now = T0;
  const reports = [];
  const io = {
    send: (ws, obj) => ws.inbox.push(obj),
    close: (ws, reason) => { ws.closed = reason ?? 'pa'; if (reason) ws.inbox.push({ t: 'koniec', reason }); },
    persist: (ws, att) => { ws.att = att; },
    verify: async () => human,
    report: async (r) => { reports.push(r); return { resting }; },
  };
  const core = new RoomCore(io, { room: '1', dev, now: () => now, random: () => 0.5 });
  const socket = (ip = 'a') => { const ws = { inbox: [], closed: null }; core.connect(ws, ip); return ws; };
  const say = (ws, obj) => core.message(ws, JSON.stringify(obj));
  const last = (ws, t) => ws.inbox.filter((m) => m.t === t).at(-1);
  return { core, reports, socket, say, last, advance: (ms) => { now += ms; } };
}

async function joined(r, ip) {
  const ws = r.socket(ip);
  await r.say(ws, { t: 'hej', turnstile: 'x' });
  return ws;
}

test('map bounds in the server match the game geodata', () => {
  const geo = readFileSync(new URL('../js/bielany-geodata.js', import.meta.url), 'utf8');
  const bounds = JSON.parse(/"bounds":(\{[^}]*\})/.exec(geo)[1]);
  assert.deepEqual(BOUNDS, bounds);
});

test('names agree in gender, keep a valid choice and change the number when taken', () => {
  assert.equal(nameText(0, 0, 27), 'Rudy Dzik 27');
  assert.equal(nameText(1, NOUNS.findIndex(([w]) => w === 'Wiewiórka'), 4), 'Szybka Wiewiórka 4');
  for (const [, gender] of NOUNS) assert.ok(gender === 'm' || gender === 'f');
  assert.equal(ADJECTIVES.length, 12);
  assert.equal(COLORS.length, 12);
  const kept = pickName({ a: 2, b: 3, n: 50 }, 7, new Set());
  assert.deepEqual([kept.name, kept.color, kept.text], [{ a: 2, b: 3, n: 50 }, 7, 'Wesoły Borsuk 50']);
  const moved = pickName({ a: 2, b: 3, n: 99 }, 7, new Set(['Wesoły Borsuk 99']));
  assert.equal(moved.text, 'Wesoły Borsuk 1');
  for (const bad of [null, { a: 99, b: 0, n: 1 }, { a: 0, b: 0, n: 0 }, { a: 'x', b: 0, n: 5 }]) {
    const p = pickName(bad, 40, new Set(), () => 0);
    assert.equal(p.text, 'Rudy Dzik 1');
    assert.equal(p.color, 0);
  }
});

test('state messages are checked and rounded', () => {
  assert.deepEqual(parseState(state({ x: 1.23456, v: 3.14159 })), { x: 1.23, y: 0, z: -12.4, h: -2.2, m: 'car', v: 3.1 });
  assert.equal(parseState(state({ v: undefined })).v, 0);
  for (const bad of [{ m: 'tank' }, { x: NaN }, { x: BOUNDS.maxX + 300 }, { z: BOUNDS.minZ - 300 }, { y: 2000 },
    { v: 200 }, { v: -1 }, { h: '1' }, { y: undefined }]) {
    assert.equal(parseState(state(bad)), null, JSON.stringify(bad));
  }
  const a = parseState(state());
  assert.ok(plausibleMove(a, T0, { ...a, x: a.x + 60 }, T0 + 1000)); // car 45 m/s * 1.5 + 15
  assert.ok(!plausibleMove(a, T0, { ...a, x: a.x + 90 }, T0 + 1000));
  assert.ok(!plausibleMove({ ...a, m: 'person' }, T0, { ...a, m: 'person', x: a.x + 40 }, T0 + 1000));
  assert.ok(plausibleMove(null, 0, a, T0));
});

test('a player says hej, gets the others and is announced to them', async () => {
  const r = makeRoom();
  const first = await joined(r, 'a');
  assert.equal(r.last(first, 'witaj').id, 1);
  assert.equal(r.last(first, 'witaj').name, 'Bielańska Wiewiórka 50'); // random 0.5 for every pick
  await r.say(first, state());
  const second = r.socket('b');
  await r.say(second, { t: 'hej', turnstile: 'x', name: { a: 0, b: 0, n: 27 }, color: 5 });
  const hello = r.last(second, 'witaj');
  assert.equal(hello.id, 2);
  assert.equal(hello.name, 'Rudy Dzik 27');
  assert.equal(hello.color, 5);
  assert.deepEqual(hello.rate, { move: 5, idle: 1 });
  assert.deepEqual(hello.players, [{ id: 1, name: 'Bielańska Wiewiórka 50', color: 6, x: 9.4, y: 0, z: -12.4, h: -2.2, m: 'car', v: 10 }]);
  assert.deepEqual(r.last(first, 'nowy').p, { id: 2, name: 'Rudy Dzik 27', color: 5 });
  assert.equal(r.reports.length, 2);
  assert.equal(r.reports[1].players, 2);
});

test('states go to the others, never back to the sender, and not to players before hej', async () => {
  const r = makeRoom();
  const a = await joined(r, 'a');
  const b = await joined(r, 'b');
  const waiting = r.socket('c');
  r.advance(200);
  await r.say(a, state({ x: 12 }));
  assert.deepEqual(r.last(b, 's'), { t: 's', id: 1, x: 12, y: 0, z: -12.4, h: -2.2, m: 'car', v: 10 });
  assert.equal(r.last(a, 's'), undefined);
  assert.equal(waiting.inbox.length, 0);
  await r.say(waiting, state()); // ignored until hej
  assert.equal(r.last(a, 's'), undefined);
});

test('a failed Turnstile check ends the connection', async () => {
  const r = makeRoom({ human: false });
  const ws = r.socket();
  await r.say(ws, { t: 'hej', turnstile: 'bot' });
  assert.equal(ws.closed, 'turnstile');
  assert.equal(r.core.count(), 0);
});

test('no hej within 10 s and 10 s of silence both end the connection', async () => {
  const r = makeRoom();
  const quiet = await joined(r, 'a');
  const talker = await joined(r, 'b');
  const lurker = r.socket('c');
  r.advance(LIMITS.helloMs + 1);
  await r.say(talker, state());
  assert.equal(lurker.closed, 'timeout');
  assert.equal(quiet.closed, 'timeout');
  assert.deepEqual(r.last(talker, 'wyszedl'), { t: 'wyszedl', id: 1 });
  assert.equal(talker.closed, null);
});

test('more than the burst is dropped and 200 drops in a minute end the connection', async () => {
  const r = makeRoom();
  const a = await joined(r, 'a');
  const b = await joined(r, 'b');
  r.advance(5000);
  b.inbox.length = 0;
  for (let i = 0; i < 30; i++) await r.say(a, state());
  assert.equal(b.inbox.filter((m) => m.t === 's').length, LIMITS.rateBurst);
  for (let i = 0; i < 200 && !a.closed; i++) await r.say(a, state());
  assert.equal(a.closed, 'abuse');
  assert.deepEqual(r.last(b, 'wyszedl'), { t: 'wyszedl', id: 1 });
});

test('broken or oversized messages are dropped', async () => {
  const r = makeRoom();
  const a = await joined(r, 'a');
  const b = await joined(r, 'b');
  await r.core.message(a, '{not json');
  await r.core.message(a, JSON.stringify(state({ pad: 'x'.repeat(600) })));
  await r.say(a, { nothing: 1 });
  assert.equal(b.inbox.filter((m) => m.t === 's').length, 0);
  assert.equal(a.att.drops.length, 3);
});

test('an impossible jump is dropped, a teleport passes once a second', async () => {
  const r = makeRoom();
  const a = await joined(r, 'a');
  const b = await joined(r, 'b');
  await r.say(a, state({ x: 0 }));
  r.advance(200);
  await r.say(a, state({ x: 500 }));
  assert.equal(r.last(b, 's').x, 0);
  await r.say(a, state({ t: 'tp', x: 500 }));
  assert.equal(r.last(b, 'tp').x, 500);
  r.advance(200);
  await r.say(a, state({ t: 'tp', x: -900 }));
  assert.equal(r.last(b, 'tp').x, 500);
  r.advance(1000);
  await r.say(a, state({ t: 'tp', x: -900 }));
  assert.equal(r.last(b, 'tp').x, -900);
});

test('gestures from the list, once in two seconds', async () => {
  const r = makeRoom();
  const a = await joined(r, 'a');
  const b = await joined(r, 'b');
  await r.say(a, { t: 'g', g: 'czesc' });
  await r.say(a, { t: 'g', g: 'dzieki' });
  await r.say(a, { t: 'g', g: 'kup-teraz' });
  assert.deepEqual(b.inbox.filter((m) => m.t === 'g'), [{ t: 'g', id: 1, g: 'czesc' }]);
  r.advance(LIMITS.gestureMs);
  await r.say(a, { t: 'g', g: 'dzieki' });
  assert.equal(r.last(b, 'g').g, 'dzieki');
});

test('pa and a closed tab both remove the player', async () => {
  const r = makeRoom();
  const a = await joined(r, 'a');
  const b = await joined(r, 'b');
  const c = await joined(r, 'c');
  await r.say(a, { t: 'pa' });
  assert.equal(a.closed, 'pa');
  assert.equal(a.inbox.filter((m) => m.t === 'koniec').length, 0);
  await r.core.closed(b);
  assert.deepEqual(c.inbox.filter((m) => m.t === 'wyszedl').map((m) => m.id), [1, 2]);
  assert.equal(r.core.count(), 1);
  assert.equal(r.reports.at(-1).players, 1);
});

test('room size and connections per address', async () => {
  const r = makeRoom();
  r.socket('same');
  r.socket('same');
  assert.equal(r.core.refusal('same'), 'too_many');
  assert.equal(r.core.refusal('other'), null);
  for (let i = 0; i < LIMITS.roomSize - 2; i++) r.socket(`ip${i}`);
  assert.equal(r.core.refusal('new'), 'full');
  const local = makeRoom({ dev: true });
  for (let i = 0; i < 5; i++) local.socket('127.0.0.1');
  assert.equal(local.core.refusal('127.0.0.1'), null);
});

test('usage is reported every 2000 messages and a resting lobby ends everyone', async () => {
  const r = makeRoom();
  const a = await joined(r, 'a');
  assert.equal(r.reports[0].requests, LIMITS.requestsPerConnect + 1);
  for (let i = 0; i < LIMITS.reportEvery; i++) { r.advance(100); await r.say(a, state()); }
  assert.equal(r.reports.length, 2);
  assert.equal(r.reports[1].requests, Math.ceil(LIMITS.reportEvery / LIMITS.messagesPerRequest));

  const tired = makeRoom({ resting: true });
  const x = await joined(tired, 'a');
  assert.equal(x.closed, 'resting');
  assert.equal(tired.core.count(), 0);
});

test('a room rebuilds its players from the socket attachments after hibernation', async () => {
  const r = makeRoom();
  const a = await joined(r, 'a');
  const b = await joined(r, 'b');
  const woken = new RoomCore(r.core.io, { now: () => T0 + 100 });
  woken.adopt(a, a.att);
  woken.adopt(b, b.att);
  assert.equal(woken.room, '1');
  assert.equal(woken.joined(), 2);
  await woken.message(a, JSON.stringify(state({ x: 1 })));
  assert.equal(r.last(b, 's').x, 1);
});

test('lobby hands out rooms with space, distrusts old head counts and rests over the day budget', async () => {
  const lobby = new Lobby({ storage: fakeStorage() }, {});
  let now = T0;
  lobby.now = () => now;
  assert.deepEqual(await lobby.pick(), { ok: true, room: '1' });
  await lobby.report('1', LIMITS.roomSize, 10);
  assert.deepEqual(await lobby.pick(), { ok: true, room: '2' });
  assert.deepEqual(await lobby.pick(['2']), { ok: true, room: '3' });
  await lobby.report('test', 5, 10); // the test room never takes a public slot
  assert.equal((await lobby.status()).players, LIMITS.roomSize);
  now += LIMITS.occupancyStaleMs + 1;
  assert.deepEqual(await lobby.pick(), { ok: true, room: '1' });
  assert.equal((await lobby.status()).players, 0);
  const over = await lobby.report('1', 3, LIMITS.dayRequests);
  assert.equal(over.resting, true);
  assert.deepEqual(await lobby.pick(), { ok: false, reason: 'resting' });
  now += 24 * 3600 * 1000; // next UTC day
  assert.deepEqual(await lobby.pick(), { ok: true, room: '1' });
  assert.equal(utcDay(Date.UTC(2026, 9, 26, 23, 30)), '2026-10-26');
});

test('lobby forgets day totals older than a week', async () => {
  const storage = fakeStorage();
  const lobby = new Lobby({ storage }, {});
  let now = T0;
  lobby.now = () => now;
  await lobby.report('1', 1, 5);
  now += 8 * 24 * 3600 * 1000;
  await lobby.report('1', 1, 5);
  assert.deepEqual([...storage.map.keys()].filter((k) => k.startsWith('day:')), [`day:${utcDay(now)}`]);
});

// Worker routing with a real Lobby and stand-in rooms (WebSocketPair exists only on Cloudflare)
function makeEnv({ full = [], extra = {} } = {}) {
  const lobbyObj = new Lobby({ storage: fakeStorage() }, {});
  lobbyObj.now = () => T0;
  const forwarded = [];
  const env = {
    DEV: '1',
    LOBBY: { idFromName: () => 'lobby', get: () => ({ fetch: (url, init) => lobbyObj.fetch(new Request(url, init)) }) },
    ROOMS: {
      idFromName: (name) => name,
      get: (name) => ({
        fetch: async (req) => {
          forwarded.push({ name, room: req.headers.get('X-Room'), address: req.headers.get('X-Address') });
          return full.includes(name) ? Response.json({ ok: false, reason: 'full' }, { status: 503 }) : new Response('ws', { status: 200 });
        },
      }),
    },
    ...extra,
  };
  return { env, forwarded, lobbyObj };
}

const upgrade = (path = '/api/gracze', origin = 'http://localhost:8080') => new Request(`https://bielany.zbigniew.ai${path}`, {
  headers: { Upgrade: 'websocket', Origin: origin, 'CF-Connecting-IP': '203.0.113.9' },
});

test('worker: status, refusals and the kill switch', async () => {
  const { env } = makeEnv();
  const stan = await (await handle(new Request('https://bielany.zbigniew.ai/api/gracze/stan', { headers: { Origin: 'http://localhost:8080' } }), env)).json();
  assert.deepEqual(stan, { ok: true, enabled: true, turnstileSiteKey: '1x00000000000000000000AA', players: 0 });
  assert.equal((await handle(upgrade('/api/gracze', 'https://evil.example'), env)).status, 403);
  assert.equal((await handle(new Request('https://bielany.zbigniew.ai/api/gracze', { headers: { Origin: 'http://localhost:8080' } }), env)).status, 400);
  assert.equal((await handle(upgrade('/api/gracze/inne'), env)).status, 404);
  const off = makeEnv({ extra: { GRACZE_OFF: '1' } }).env;
  const offRes = await handle(upgrade(), off);
  assert.equal(offRes.status, 503);
  assert.equal((await offRes.json()).reason, 'off');
  const offStan = await (await handle(new Request('https://bielany.zbigniew.ai/api/gracze/stan'), off)).json();
  assert.equal(offStan.enabled, false);
  assert.equal(offStan.reason, 'off');
  const prod = makeEnv({ extra: { DEV: undefined } }).env;
  assert.equal((await handle(upgrade(), prod)).status, 403); // localhost only in local runs
  assert.equal((await handle(upgrade('/api/gracze', 'https://bielany.zbigniew.ai'), prod)).status, 200);
});

test('worker: a full room passes the player to the next one, the test room stays apart', async () => {
  const { env, forwarded } = makeEnv({ full: ['pokoj-1'] });
  assert.equal((await handle(upgrade(), env)).status, 200);
  assert.deepEqual(forwarded.map((f) => f.room), ['1', '2']);
  assert.equal(forwarded[0].address, '203.0.113.9');
  forwarded.length = 0;
  assert.equal((await handle(upgrade('/api/gracze?pokoj=test'), env)).status, 200);
  assert.deepEqual(forwarded.map((f) => f.name), ['pokoj-test']);
  const allFull = makeEnv({ full: ['pokoj-1', 'pokoj-2', 'pokoj-3', 'pokoj-4'] }).env;
  const res = await handle(upgrade(), allFull);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).reason, 'full');
});

test('worker: over the day budget nobody gets in', async () => {
  const { env, lobbyObj } = makeEnv();
  await lobbyObj.report('1', 1, LIMITS.dayRequests);
  const res = await handle(upgrade(), env);
  assert.equal((await res.json()).reason, 'resting');
  assert.equal((await handle(upgrade('/api/gracze?pokoj=test'), env)).status, 503);
});
