import assert from 'node:assert/strict';
import test from 'node:test';
import { MultiplayerClient, Track, SendPolicy, playersEndpoint, soloByUrl, describeStatus, DELAY_MS, STORAGE_KEY, ON_KEY } from '../js/multiplayer-net.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('address: local server on localhost, same host elsewhere, test room on request', () => {
  assert.deepEqual(playersEndpoint({ hostname: 'localhost', host: 'localhost:8080', search: '' }),
    { ws: 'ws://localhost:8789/api/gracze', stan: 'http://localhost:8789/api/gracze/stan' });
  assert.deepEqual(playersEndpoint({ hostname: 'bielany.zbigniew.ai', host: 'bielany.zbigniew.ai', search: '?pokoj=test' }),
    { ws: 'wss://bielany.zbigniew.ai/api/gracze?pokoj=test', stan: '/api/gracze/stan' });
  assert.equal(soloByUrl('?solo'), true);
  assert.equal(soloByUrl('?urzad', true), true);
  assert.equal(soloByUrl(''), false);
});

test('track: draws others 200 ms in the past, between states, heading the short way round', () => {
  const t = new Track();
  t.push({ x: 0, y: 0, z: 0, h: 3.0, m: 'car', v: 10 }, 1000);
  t.push({ x: 10, y: 0, z: 0, h: -3.0, m: 'car', v: 10 }, 1200);
  const s = t.sample(1100 + DELAY_MS);
  close(s.x, 5);
  close(Math.abs(s.h), Math.PI, 0.05); // through ±π, not through 0
  // past the newest: keeps moving for a while at the last speed, then stops
  close(t.sample(1300 + DELAY_MS).x, 15);
  close(t.sample(5000).x, 35); // 500 ms at 50 m/s
  assert.equal(t.sample(5000).v, 0);
  // a teleport forgets the old states
  t.push({ x: 900, y: 0, z: 0, h: 0, m: 'car', v: 0 }, 1300, true);
  close(t.sample(1400).x, 900);
  assert.equal(new Track().sample(0), null);
});

test('send policy: 5 a second moving, 1 a second still, teleport after a jump or a far mode change', () => {
  const p = new SendPolicy();
  const at = (x, m = 'car') => ({ x, y: 0, z: 0, h: 0, m, v: 3 });
  assert.equal(p.next(at(0), 0).t, 's');
  assert.equal(p.next(at(1), 100), null);
  assert.equal(p.next(at(1), 200).t, 's');
  assert.equal(p.next(at(1), 400), null); // still: once a second
  assert.ok(p.next(at(1), 1200));
  assert.equal(p.next(at(500), 1400).t, 'tp');
  assert.equal(p.next(at(520, 'person'), 1600).t, 'tp');
  assert.equal(p.next(at(521, 'cyclist'), 1800).t, 's');
  const m = p.next({ x: 1.23456, y: 0.5, z: 0, h: 7, m: 'car', v: -200 }, 2000);
  assert.deepEqual([m.x, m.h, m.v], [1.23, 0.717, 150]);
});

// A fake server socket: records what the game sends, lets the test answer
class FakeSocket {
  static last = null;
  constructor(url) { this.url = url; this.sent = []; this.readyState = 0; FakeSocket.last = this; queueMicrotask(() => { this.readyState = 1; this.onopen?.(); }); }
  send(s) { this.sent.push(JSON.parse(s)); }
  close() { this.readyState = 3; this.onclose?.(); }
  answer(obj) { this.onmessage?.({ data: JSON.stringify(obj) }); }
}

function makeClient({ stan = { ok: true, enabled: true, turnstileSiteKey: 'k' }, search = '', storage = null, token = async () => 'tok' } = {}) {
  let now = 0;
  const timers = [];
  const store = storage || new Map();
  const client = new MultiplayerClient({
    location: { hostname: 'localhost', host: 'localhost:8080', search },
    fetchImpl: async () => ({ json: async () => stan }),
    WebSocketImpl: FakeSocket,
    getToken: token,
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    now: () => now,
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimer: () => {},
    log: () => {},
  });
  const events = [];
  client.onChange = (e, d) => events.push([e, d]);
  return { client, timers, store, events, advance: (ms) => { now += ms; } };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test('client: hej with Turnstile and the saved name, welcome, others join, move and leave', async () => {
  const store = new Map([[STORAGE_KEY, JSON.stringify({ name: { a: 1, b: 2, n: 3 }, color: 4 })]]);
  const { client, events, advance } = makeClient({ storage: store });
  await client.start();
  await tick();
  const ws = FakeSocket.last;
  assert.equal(ws.url, 'ws://localhost:8789/api/gracze');
  assert.deepEqual(ws.sent[0], { t: 'hej', turnstile: 'tok', name: { a: 1, b: 2, n: 3 }, color: 4 });
  ws.answer({ t: 'witaj', id: 2, name: 'Szybki Jeż 3', nameId: { a: 1, b: 2, n: 3 }, color: 4, colors: ['#000', '#111', '#222', '#333', '#444'],
    room: '1', players: [{ id: 1, name: 'Rudy Dzik 1', color: 0, x: 5, y: 0, z: 5, h: 0, m: 'person', v: 0 }], rate: { move: 5, idle: 1 } });
  assert.equal(client.status, 'online');
  assert.equal(client.players.get(1).name, 'Rudy Dzik 1');
  assert.equal(client.colorOf(client.players.get(1)), '#000');
  assert.deepEqual(JSON.parse(store.get(STORAGE_KEY)), { name: { a: 1, b: 2, n: 3 }, color: 4 });
  ws.answer({ t: 'nowy', p: { id: 3, name: 'Cicha Sowa 9', color: 2 } });
  advance(100);
  ws.answer({ t: 's', id: 3, x: 1, y: 0, z: 2, h: 0, m: 'car', v: 4 });
  assert.equal(client.players.get(3).track.snaps.length, 1);
  ws.answer({ t: 'g', id: 3, g: 'czesc' });
  assert.equal(client.players.get(3).gesture.g, 'czesc');
  ws.answer({ t: 'wyszedl', id: 1 });
  assert.equal(client.players.has(1), false);
  assert.deepEqual(events.map((e) => e[0]).filter((e) => e !== 'status'), ['join', 'welcome', 'join', 'gesture', 'leave']);
  // our own position goes out through the send policy
  client.update({ x: 1, y: 0, z: 1, h: 0, m: 'car', v: 2 });
  assert.equal(ws.sent.at(-1).t, 's');
  client.update({ x: 1.5, y: 0, z: 1, h: 0, m: 'car', v: 2 });
  assert.equal(ws.sent.filter((m) => m.t === 's').length, 1);
});

test('client: resting server, solo, and a dropped connection that retries', async () => {
  const resting = makeClient({ stan: { ok: true, enabled: false, reason: 'resting' } });
  await resting.client.start();
  assert.equal(resting.client.status, 'resting');

  const solo = makeClient({ search: '?solo' });
  await solo.client.start();
  assert.equal(solo.client.status, 'off');

  const down = makeClient();
  down.client.fetch = async () => { throw new Error('no server'); };
  await down.client.start();
  assert.equal(down.client.status, 'down');
  assert.equal(down.timers[0].ms, 5000);

  const { client, timers } = makeClient();
  await client.start();
  await tick();
  FakeSocket.last.answer({ t: 'witaj', id: 1, name: 'x', color: 0, colors: [], players: [{ id: 2, name: 'y', color: 1 }] });
  FakeSocket.last.close();
  assert.equal(client.status, 'down');
  assert.equal(client.players.size, 0);
  assert.equal(timers.length, 1);
  // ended for abuse: no retry
  await client.start();
  await tick();
  FakeSocket.last.answer({ t: 'koniec', reason: 'abuse' });
  assert.equal(client.status, 'down');
  assert.equal(timers.length, 1);
});

test('client: the switch says goodbye and stays off', async () => {
  const { client } = makeClient();
  await client.start();
  await tick();
  const ws = FakeSocket.last;
  ws.answer({ t: 'witaj', id: 1, name: 'x', color: 0, colors: [], players: [] });
  client.setEnabled(false);
  assert.deepEqual(ws.sent.at(-1), { t: 'pa' });
  assert.equal(client.status, 'off');
  await client.start();
  assert.equal(client.status, 'off');
});

test('client: a tab coming back to the front reconnects at once', async () => {
  const listeners = {};
  const doc = { hidden: true, addEventListener: (e, fn) => { listeners[e] = fn; } };
  const client = new MultiplayerClient({
    location: { hostname: 'localhost', host: 'localhost:8080', search: '' },
    fetchImpl: async () => { throw new Error('away'); }, WebSocketImpl: FakeSocket, getToken: async () => 't',
    storage: null, setTimer: () => 1, clearTimer: () => {}, log: () => {}, doc,
  });
  await client.start();
  assert.equal(client.status, 'down');
  let started = 0;
  client.start = async () => { started++; };
  listeners.visibilitychange();
  assert.equal(started, 0);
  doc.hidden = false;
  listeners.visibilitychange();
  assert.equal(started, 1);
});

test('client: new names for me and the others, the switch remembered, one status line', async () => {
  const { client, store } = makeClient();
  await client.start();
  await tick();
  const ws = FakeSocket.last;
  ws.answer({ t: 'witaj', id: 1, name: 'Rudy Dzik 1', color: 0, colors: ['#a', '#b', '#c'], room: '1', players: [{ id: 2, name: 'Cicha Sowa 3', color: 1 }] });
  assert.equal(describeStatus(client), 'Pokój 1 · oprócz Ciebie: 1 gracz.');
  client.rename();
  assert.deepEqual(ws.sent.at(-1), { t: 'imie' });
  ws.answer({ t: 'imie', id: 1, name: 'Złoty Kos 8', nameId: { a: 4, b: 6, n: 8 }, color: 2 });
  assert.equal(client.me.name, 'Złoty Kos 8');
  assert.deepEqual(JSON.parse(store.get(STORAGE_KEY)), { name: { a: 4, b: 6, n: 8 }, color: 2 });
  ws.answer({ t: 'imie', id: 2, name: 'Leśna Mewa 5', color: 0 });
  assert.equal(client.players.get(2).name, 'Leśna Mewa 5');
  client.setEnabled(false);
  assert.equal(store.get(ON_KEY), '0');
  assert.equal(describeStatus(client), 'Grasz sam. Włącz grę z innymi, by widzieć innych graczy.');
  const again = makeClient({ storage: store });
  assert.equal(again.client.enabled, false);
  await again.client.start();
  assert.equal(again.client.status, 'off');
  assert.match(describeStatus({ solo: true }), /bez gry z innymi/);
  assert.match(describeStatus({ status: 'resting', reason: 'resting', players: new Map() }), /2:00/);
  assert.match(describeStatus({ status: 'online', me: { room: 'test' }, players: new Map() }), /^Pokój testowy · na razie jesteś sam/);
});

test('client: horn out and in, gestures once in two seconds with my own bubble', async () => {
  const { client, events, advance } = makeClient();
  await client.start();
  await tick();
  const ws = FakeSocket.last;
  ws.answer({ t: 'witaj', id: 1, name: 'x', color: 0, colors: [], players: [{ id: 2, name: 'y', color: 1 }] });
  client.honk();
  assert.deepEqual(ws.sent.at(-1), { t: 'k' });
  ws.answer({ t: 'k', id: 2 });
  assert.equal(events.at(-1)[0], 'horn');
  assert.equal(events.at(-1)[1].id, 2);
  assert.equal(client.gesture('czesc'), true);
  assert.deepEqual(ws.sent.at(-1), { t: 'g', g: 'czesc' });
  assert.equal(client.myGesture.g, 'czesc');
  assert.equal(client.gestureReady(), false);
  assert.equal(client.gesture('brawo'), false);
  assert.equal(client.gesture('kup-teraz'), false);
  advance(2000);
  assert.equal(client.gesture('brawo'), true);
});

test('client: players chat in memory, bubbles, mute and report, notes from the server', async () => {
  const { client } = makeClient();
  await client.start();
  await tick();
  const ws = FakeSocket.last;
  ws.answer({ t: 'witaj', id: 1, name: 'Ja 1', color: 0, colors: ['#a', '#b'], players: [{ id: 2, name: 'Ty 2', color: 1 }] });
  assert.equal(client.talk('  hej   tam '), '');
  assert.deepEqual(ws.sent.at(-1), { t: 'czat', txt: 'hej tam' });
  assert.equal(client.talk('x'.repeat(141)), 'Najwyżej 140 znaków.');
  assert.equal(client.talk('   '), 'Napisz coś.');
  ws.answer({ t: 'czat', id: 1, name: 'Ja 1', color: 0, txt: 'hej tam' });
  ws.answer({ t: 'czat', id: 2, name: 'Ty 2', color: 1, txt: 'cześć' });
  assert.equal(client.talkLog.length, 2);
  assert.equal(client.talkLog[0].me, true);
  assert.equal(client.talkUnread, 1);
  assert.equal(client.players.get(2).said.txt, 'cześć');
  assert.equal(client.mySaid.txt, 'hej tam');
  client.report(2);
  assert.deepEqual(ws.sent.at(-1), { t: 'zglos', id: 2 });
  assert.equal(client.talkLog.some((m) => m.id === 2), false);
  ws.answer({ t: 'czat', id: 2, name: 'Ty 2', color: 1, txt: 'znowu' });
  assert.equal(client.talkLog.some((m) => m.id === 2), false);
  ws.answer({ t: 'czat-x', reason: 'slow' });
  assert.match(client.talkLog.at(-1).note, /3 sekundy/);
  ws.answer({ t: 'czat-x', reason: 'silenced', until: Date.now() + 60000 });
  assert.match(client.talk('halo'), /nie możesz/);
});

