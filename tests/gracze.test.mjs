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
  assert.deepEqual(hello.nameId, { a: 0, b: 0, n: 27 });
  assert.equal(hello.colors.length, 12);
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

test('a new random name for everyone to see, once in two seconds', async () => {
  const r = makeRoom();
  const a = await joined(r, 'a');
  const b = await joined(r, 'b');
  let k = 0;
  r.core.random = () => [0.01, 0.01, 0.001, 0.99][k++ % 4];
  await r.say(a, { t: 'imie' });
  const mine = r.last(a, 'imie');
  assert.deepEqual(mine, { t: 'imie', id: 1, name: 'Rudy Dzik 1', nameId: { a: 0, b: 0, n: 1 }, color: 11 });
  assert.deepEqual(r.last(b, 'imie'), { t: 'imie', id: 1, name: 'Rudy Dzik 1', color: 11 });
  await r.say(a, { t: 'imie' });
  assert.equal(a.inbox.filter((m) => m.t === 'imie').length, 1);
  r.advance(LIMITS.renameMs);
  await r.say(a, { t: 'imie' });
  assert.equal(a.inbox.filter((m) => m.t === 'imie').length, 2);
});

test('the horn reaches only players within 200 m, once in 0.8 s', async () => {
  const r = makeRoom();
  const a = await joined(r, 'a');
  const near = await joined(r, 'b');
  const far = await joined(r, 'c');
  await r.say(a, state({ x: 0, z: 0 }));
  await r.say(near, state({ x: 150, z: 0 }));
  await r.say(far, state({ x: 0, z: 900 }));
  await r.say(a, { t: 'k' });
  await r.say(a, { t: 'k' });
  assert.deepEqual(near.inbox.filter((m) => m.t === 'k'), [{ t: 'k', id: 1 }]);
  assert.equal(far.inbox.filter((m) => m.t === 'k').length, 0);
  r.advance(LIMITS.hornMs);
  await r.say(a, { t: 'k' });
  assert.equal(near.inbox.filter((m) => m.t === 'k').length, 2);
});

test('taxi between players: call, the first driver wins, pick-up and drop-off checked by position', async () => {
  const r = makeRoom();
  const pas = await joined(r, 'a');
  const drv = await joined(r, 'b');
  const other = await joined(r, 'c');
  await r.say(pas, state({ m: 'person', x: 0, z: 0 }));
  await r.say(drv, state({ m: 'car', x: 300, z: 0 }));
  await r.say(other, state({ m: 'car', x: -300, z: 0 }));
  const to = { x: 1000, z: 0, name: 'Klasztor Kamedułów' };
  await r.say(pas, { t: 'taxi', to });
  assert.deepEqual(r.last(drv, 'taxi'), { t: 'taxi', r: 1, name: pas.att.text, x: 0, z: 0, to });
  // a newcomer sees the waiting call
  const late = r.socket('d');
  await r.say(late, { t: 'hej', turnstile: 'x' });
  assert.equal(r.last(late, 'witaj').rides.length, 1);
  await r.say(drv, { t: 'taxi-ok', r: 1 });
  await r.say(other, { t: 'taxi-ok', r: 1 });
  assert.equal(r.last(pas, 'taxi-ok').d, 2);
  assert.equal(r.last(drv, 'taxi-ok').d, 2);
  assert.deepEqual(r.last(other, 'taxi-x'), { t: 'taxi-x', r: 1 });
  // too far for the pick-up: ignored; close by: in
  await r.say(drv, { t: 'taxi-in', r: 1 });
  assert.equal(r.last(pas, 'taxi-in'), undefined);
  r.advance(8000);
  await r.say(other, state({ m: 'car', x: -300, z: 0 }));
  await r.say(drv, state({ m: 'car', x: 10, z: 0 }));
  await r.say(pas, state({ m: 'person', x: 0, z: 0 }));
  await r.say(drv, { t: 'taxi-in', r: 1 });
  assert.deepEqual(r.last(pas, 'taxi-in'), { t: 'taxi-in', r: 1 });
  // riding: the passenger moves with the car; drop-off only at the destination
  for (const x of [300, 600, 900]) {
    r.advance(8000);
    await r.say(pas, state({ m: 'passenger', x, z: 0 }));
    await r.say(drv, state({ m: 'car', x, z: 0 }));
  }
  await r.say(drv, { t: 'taxi-end', r: 1 });
  assert.equal(r.last(pas, 'taxi-end'), undefined);
  r.advance(3000);
  await r.say(drv, state({ m: 'car', x: 990, z: 5 }));
  await r.say(drv, { t: 'taxi-end', r: 1 });
  assert.deepEqual(r.last(pas, 'taxi-end'), { t: 'taxi-end', r: 1, to: 'Klasztor Kamedułów' });
  assert.equal(pas.att.ride, undefined);
  assert.equal(drv.att.drive, undefined);
});

test('taxi: only on foot, cancel by either side, a leaving driver ends the ride, calls lapse', async () => {
  const r = makeRoom();
  const pas = await joined(r, 'a');
  const drv = await joined(r, 'b');
  const to = { x: 500, z: 0, name: 'AWF' };
  await r.say(pas, state({ m: 'car' }));
  await r.say(pas, { t: 'taxi', to });
  assert.equal(r.last(drv, 'taxi'), undefined); // in a car you don't call a cab
  r.advance(1000);
  await r.say(pas, state({ m: 'person' }));
  await r.say(drv, state({ m: 'car' }));
  await r.say(pas, { t: 'taxi', to: { x: 'x', z: 0, name: '' } });
  assert.equal(r.last(drv, 'taxi'), undefined); // bad destination
  r.advance(6000);
  await r.say(drv, state({ m: 'car' }));
  await r.say(pas, { t: 'taxi', to });
  await r.say(pas, { t: 'taxi-no', r: 1 });
  assert.deepEqual(r.last(drv, 'taxi-x'), { t: 'taxi-x', r: 1 });
  r.advance(6000);
  await r.say(drv, state({ m: 'car' }));
  await r.say(pas, { t: 'taxi', to });
  await r.say(drv, { t: 'taxi-ok', r: 1 });
  await r.core.closed(drv);
  assert.deepEqual(r.last(pas, 'taxi-no'), { t: 'taxi-no', r: 1, by: 2 });
  assert.equal(pas.att.ride, undefined);
  r.advance(6000);
  await r.say(pas, { t: 'taxi', to });
  r.advance(LIMITS.rideWaitMs + 1);
  await r.say(pas, state({ m: 'person' }));
  assert.deepEqual(r.last(pas, 'taxi-no'), { t: 'taxi-no', r: 1, by: 0 });
});

test('shared calls: announce, join, the room adds up the work, done for everyone on it', async () => {
  const r = makeRoom();
  const a = await joined(r, 'a');
  const b = await joined(r, 'b');
  const c = await joined(r, 'c');
  await r.say(a, { t: 'zd', k: 'fire', a: 1234, f: 2 });
  const call = r.last(b, 'zd');
  assert.deepEqual(call, { t: 'zd', e: 1, k: 'fire', a: 1234, f: 2, by: 1, name: a.att.text, p: 0, n: 1, mine: false });
  assert.equal(r.last(a, 'zd').mine, true);
  await r.say(b, { t: 'zd-dol', e: 1 });
  assert.deepEqual(r.last(b, 'zd-stan'), { t: 'zd-stan', e: 1, p: 0, n: 2 });
  assert.equal(r.last(a, 'zd-dol').n, 2);
  // a newcomer sees the open call
  const d = r.socket('d');
  await r.say(d, { t: 'hej', turnstile: 'x' });
  assert.equal(r.last(d, 'witaj').events[0].n, 2);
  for (let i = 0; i < 3; i++) { r.advance(200); await r.say(a, { t: 'zd-p', e: 1, d: 0.2 }); }
  assert.equal(r.last(b, 'zd-stan').p, 0.6);
  await r.say(c, { t: 'zd-p', e: 1, d: 0.2 }); // not on the call: ignored
  r.advance(200);
  await r.say(b, { t: 'zd-p', e: 1, d: 5 }); // capped at one step
  r.advance(200);
  await r.say(b, { t: 'zd-p', e: 1, d: 0.2 });
  assert.deepEqual(r.last(a, 'zd-koniec'), { t: 'zd-koniec', e: 1, n: 2 });
  assert.deepEqual(r.last(b, 'zd-koniec'), { t: 'zd-koniec', e: 1, n: 2 });
  assert.deepEqual(r.last(c, 'zd-x'), { t: 'zd-x', e: 1 });
  assert.equal(r.core.events.size, 0);
});

test('shared calls: the last one out ends it, a leaving player is out, bad calls are ignored', async () => {
  const r = makeRoom();
  const a = await joined(r, 'a');
  const b = await joined(r, 'b');
  await r.say(a, { t: 'zd', k: 'volcano', a: 1, f: 0 });
  await r.say(a, { t: 'zd', k: 'cat', a: -1, f: 0 });
  assert.equal(r.last(b, 'zd'), undefined);
  await r.say(a, { t: 'zd', k: 'cat', a: 77, f: 0 });
  await r.say(b, { t: 'zd-dol', e: 1 });
  await r.core.closed(b);
  assert.equal(r.core.events.get(1).parts.size, 1);
  await r.say(a, { t: 'zd-x', e: 1 });
  assert.equal(r.core.events.size, 0);
  const c = await joined(r, 'c');
  await r.say(c, { t: 'zd-dol', e: 1 });
  assert.deepEqual(r.last(c, 'zd-x'), { t: 'zd-x', e: 1 });
});

test('players chat: to everybody, filtered, one per 3 s, at most 140 characters', async () => {
  const r = makeRoom();
  const a = await joined(r, 'a');
  const b = await joined(r, 'b');
  await r.say(a, { t: 'czat', txt: '  Cześć,   jedziemy na Kameduły?  ' });
  assert.deepEqual(r.last(b, 'czat'), { t: 'czat', id: 1, name: a.att.text, color: a.att.color, txt: 'Cześć, jedziemy na Kameduły?' });
  assert.equal(r.last(a, 'czat').txt, 'Cześć, jedziemy na Kameduły?'); // the sender sees what went out
  await r.say(a, { t: 'czat', txt: 'znowu' });
  assert.deepEqual(r.last(a, 'czat-x'), { t: 'czat-x', reason: 'slow' });
  r.advance(LIMITS.chatMs);
  await r.say(a, { t: 'czat', txt: 'ty kurwa' });
  assert.equal(r.last(b, 'czat').txt, 'ty k****');
  r.advance(LIMITS.chatMs);
  await r.say(a, { t: 'czat', txt: 'x'.repeat(141) });
  assert.equal(r.last(b, 'czat').txt, 'ty k****');
});

test('players chat: three reports silence a player for 30 minutes', async () => {
  const r = makeRoom();
  const rude = await joined(r, 'a');
  const others = [];
  for (const ip of ['b', 'c', 'd', 'e']) others.push(await joined(r, ip));
  await r.say(others[0], { t: 'zglos', id: 1 });
  await r.say(others[0], { t: 'zglos', id: 1 }); // the same reporter twice counts once
  await r.say(others[1], { t: 'zglos', id: 1 });
  assert.equal(r.last(others[3], 'czat-cisza'), undefined);
  await r.say(others[2], { t: 'zglos', id: 1 });
  assert.deepEqual(r.last(others[3], 'czat-cisza'), { t: 'czat-cisza', id: 1 });
  assert.equal(r.last(rude, 'czat-x').reason, 'silenced');
  await r.say(rude, { t: 'czat', txt: 'halo' });
  assert.equal(r.last(others[3], 'czat'), undefined);
  for (let t = 0; t <= LIMITS.silenceMs; t += 9000) { // 30 minutes, everybody still playing
    r.advance(9000);
    for (const p of [rude, ...others]) await r.say(p, state());
  }
  await r.say(rude, { t: 'czat', txt: 'przepraszam' });
  assert.equal(r.last(others[3], 'czat').txt, 'przepraszam');
});

