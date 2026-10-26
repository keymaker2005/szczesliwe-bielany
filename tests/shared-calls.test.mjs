import assert from 'node:assert/strict';
import test from 'node:test';
import { MissionEngine, STOP_HOLD } from '../js/missions.js';
import { Firefighter } from '../js/firefighter.js';
import { SharedCalls } from '../js/shared-calls.js';
import { RoomCore } from '../worker-gracze/src/room-core.js';

const seeded = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Two games talking through the real room logic (worker-gracze/src/room-core.js), messages delivered at once
async function setup() {
  let now = 1e9; // epoch-like: the room's cool-downs start from 0
  const sockets = [];
  const io = {
    send: (ws, obj) => ws.game?.calls.onMessage(obj),
    close: () => {}, persist: (ws, att) => { ws.att = att; }, verify: async () => true, report: async () => ({ resting: false }),
  };
  const room = new RoomCore(io, { now: () => now, dev: true });
  const game = async (seed) => {
    const ws = {};
    sockets.push(ws);
    room.connect(ws, 'ip');
    await room.message(ws, JSON.stringify({ t: 'hej', turnstile: 'x' }));
    const missions = new MissionEngine();
    const ff = new Firefighter(missions, { random: seeded(seed), storage: null });
    const p = { x: 0, z: 0, speed: 0, mode: 'car' };
    ff.near = () => p;
    ff.player = () => p;
    const sms = [];
    const client = { status: 'online', me: { id: ws.att.id }, send: (obj) => { room.message(ws, JSON.stringify(obj)); return true; } };
    const calls = new SharedCalls({ client, firefighter: ff, missions, sms: (m) => sms.push(m), player: () => p, now: () => now });
    ws.game = { calls };
    const step = (dt) => { missions.update(dt, p); ff.update(dt); calls.update(); };
    return { ws, missions, ff, p, sms, calls, step };
  };
  const a = await game(5);
  const b = await game(9);
  return { a, b, room, advance: (ms) => { now += ms; } };
}

test('shared fire: one takes it, the other joins from Służby, both spray, done for both, both paid', async () => {
  const { a, b, advance } = await setup();
  a.ff.jobs();
  const o = a.ff.offers.find((x) => x.kind === 'fire');
  assert.ok(a.ff.accept(o.id));
  assert.equal(a.calls.mine.e, 1); // the room numbered our call
  // the other game sees it as a joinable call, rebuilt as the same fire
  b.p.mode = 'car';
  const jobs = b.calls.jobs();
  assert.equal(jobs.length, 1);
  assert.match(jobs[0].title, /Wspólna akcja · Pożar/);
  jobs[0].accept();
  const fa = a.ff.action.incident.fire, fb = b.ff.action.incident.fire;
  assert.deepEqual([fb.x, fb.z, fb.y], [fa.x, fa.z, fa.y]);
  assert.match(a.sms.at(-1).text, /dołącza do akcji/);
  // both drive there and spray
  for (const g of [a, b]) { g.p.x = o.start.x; g.p.z = o.start.z; for (let t = 0; t <= STOP_HOLD + 0.3; t += 0.1) g.step(0.1); }
  a.ff.hold(true); b.ff.hold(true);
  let secs = 0;
  while (!(a.ff.action.done && b.ff.action.done) && secs < o.incident.spray) {
    advance(500); secs += 0.5;
    a.step(0.5); b.step(0.5);
  }
  assert.ok(a.ff.action.done && b.ff.action.done, 'out for both');
  assert.ok(secs < o.incident.spray * 0.75, `two engines are faster (${secs} s of ${o.incident.spray} s)`);
  a.ff.hold(false); b.ff.hold(false);
  for (const g of [a, b]) for (let t = 0; t <= STOP_HOLD + 0.3; t += 0.1) g.step(0.1);
  assert.ok(['delivered', 'late'].includes(a.missions.missions.get(o.id).state));
  assert.equal(b.missions.active, null);
  assert.ok(b.ff.stats.earned > 0 && a.ff.stats.earned > 0);
});

test('shared fire: abandoning leaves the call to the other; the last one out ends it', async () => {
  const { a, b, room } = await setup();
  a.ff.jobs();
  const o = a.ff.offers.find((x) => x.kind === 'cat');
  a.ff.accept(o.id);
  b.calls.jobs()[0].accept();
  assert.equal(room.events.get(1).parts.size, 2);
  a.missions.abandon();
  assert.equal(room.events.get(1).parts.size, 1);
  b.missions.abandon();
  assert.equal(room.events.size, 0);
  assert.equal(b.calls.jobs().length, 0);
});
