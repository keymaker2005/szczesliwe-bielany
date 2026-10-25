import assert from 'node:assert/strict';
import test from 'node:test';
import { MissionEngine, STOP_HOLD } from '../js/missions.js';
import { Firefighter, PUMP_TIME, LADDER_TIME, REACH, starsOf } from '../js/firefighter.js';
import { GEO } from '../js/bielany-geodata.js';

const seeded = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

// A firefighter with the player standing at `p` (moved by the test)
function setup(seed = 3) {
  const eng = new MissionEngine();
  const store = memory();
  const ff = new Firefighter(eng, { random: seeded(seed), storage: store });
  const p = { x: 0, z: 0, speed: 0, mode: 'car' };
  ff.near = () => p;
  ff.player = () => p;
  const step = (dt = 0.1) => { eng.update(dt, p); ff.update(dt); };
  const stand = (x, z, s = STOP_HOLD + 0.3) => { p.x = x; p.z = z; for (let t = 0; t <= s; t += 0.1) step(); };
  return { eng, store, ff, p, step, stand };
}

test('firefighter: one call of each kind near the player, at real addresses', () => {
  const { ff } = setup();
  const jobs = ff.jobs();
  assert.equal(jobs.length, 3);
  assert.deepEqual(ff.offers.map((o) => o.kind).sort(), ['cat', 'fire', 'flood']);
  for (const o of ff.offers) {
    const d = Math.hypot(o.start.x, o.start.z);
    assert.ok(d >= 300 && d <= 1800, `${o.kind} at ${Math.round(d)} m`);
    assert.ok(GEO.addresses.list.some((a) => a[4] === o.start.x && a[5] === o.start.z), 'a real address spot');
    assert.deepEqual(o.vehicles, ['car']);
  }
  const fire = ff.offers.find((o) => o.kind === 'fire').incident.fire;
  const b = GEO.buildings[fire.building];
  assert.ok(b[2] >= 6, 'a building of a few storeys');
  assert.ok(fire.y > 0 && fire.y < fire.roof, 'the window below the roof');
  const tree = ff.offers.find((o) => o.kind === 'cat').incident.tree;
  const t = GEO.trees;
  let found = false;
  for (let k = 0; k < t.length; k += 5) if (t[k] === tree.x && t[k + 1] === tree.z) found = true;
  assert.ok(found, 'a GUGiK tree');
  assert.ok(tree.cat.y > tree.ground + 2 && tree.cat.y < tree.ground + tree.height, 'the cat up in the tree');
});

test('firefighter: a fire is put out by holding G near it, then the call ends with both sets of stars', () => {
  const { eng, store, ff, p, step, stand } = setup(5);
  ff.jobs();
  const o = ff.offers.find((x) => x.kind === 'fire');
  assert.ok(ff.accept(o.id));
  assert.equal(ff.action.phase, 'drive');
  stand(o.start.x, o.start.z);
  const m = eng.active;
  assert.equal(m.state, 'enRoute');
  assert.ok(m.responseTime > 0);
  // standing there without spraying does not end it
  for (let t = 0; t < 5; t++) step(1);
  assert.equal(m.state, 'enRoute');
  // too far from the fire: nothing happens
  p.x = o.incident.fire.x + REACH.fire + 20; p.z = o.incident.fire.z;
  ff.hold(true);
  for (let t = 0; t < 10; t++) step(1);
  assert.equal(ff.action.progress, 0);
  assert.match(ff.action.hint, /Podjedź/);
  // by the fire, spraying, until it is out
  p.x = o.start.x; p.z = o.start.z;
  for (let t = 0; t < o.incident.spray + 2 && !ff.action.done; t += 0.5) step(0.5);
  assert.ok(ff.action.done, 'the fire is out');
  ff.hold(false);
  stand(p.x, p.z);
  assert.ok(['delivered', 'late'].includes(m.state));
  assert.equal(m.responseStars, 3);
  assert.ok(m.actionStars >= 2);
  assert.equal(m.stars, Math.min(m.responseStars, m.actionStars));
  assert.equal(JSON.parse(store.getItem('bielany-firefighter')).calls, 1);
  assert.equal(ff.action.phase, 'after');
  ff.clear();
  assert.equal(ff.scene(), null);
});

test('firefighter: the fire grows back while nobody sprays', () => {
  const { ff, p, step, stand } = setup(5);
  ff.jobs();
  const o = ff.offers.find((x) => x.kind === 'fire');
  ff.accept(o.id);
  stand(o.start.x, o.start.z);
  ff.hold(true);
  for (let t = 0; t < 5; t++) step(1);
  const half = ff.action.progress;
  assert.ok(half > 0.1);
  ff.hold(false);
  for (let t = 0; t < 5; t++) step(1);
  assert.ok(ff.action.progress < half);
  p.speed = 5; // driving: no spraying
  ff.hold(true);
  const before = ff.action.progress;
  step(1);
  assert.ok(ff.action.progress <= before);
});

test('firefighter: the pump starts with G and counts down only while the truck stays by the building', () => {
  const { eng, ff, p, step, stand } = setup(7);
  ff.jobs();
  const o = ff.offers.find((x) => x.kind === 'flood');
  ff.accept(o.id);
  stand(o.start.x, o.start.z);
  assert.ok(Math.hypot(p.x - o.incident.wall.x, p.z - o.incident.wall.z) <= REACH.flood, 'the street spot is by the building');
  ff.hold(true);
  step(0.1);
  ff.hold(false);
  assert.ok(ff.action.running);
  for (let t = 0; t < PUMP_TIME / 2; t++) step(1);
  const half = ff.action.progress;
  assert.ok(Math.abs(half - 0.5) < 0.05);
  p.x += 200; // driven off: the pump waits
  for (let t = 0; t < 10; t++) step(1);
  assert.equal(ff.action.progress, half);
  p.x -= 200;
  for (let t = 0; t < PUMP_TIME; t++) step(1);
  assert.ok(ff.action.done);
  assert.ok(['delivered', 'late'].includes(eng.missions.get(o.id).state));
});

test('firefighter: the ladder reaches the cat in its time, the call keeps the lower stars', () => {
  const { eng, ff, step, stand } = setup(11);
  ff.jobs();
  const o = ff.offers.find((x) => x.kind === 'cat');
  ff.accept(o.id);
  for (let t = 0; t < o.responsePar * 2; t++) ff.update(1); // a slow response
  stand(o.start.x, o.start.z);
  ff.hold(true);
  for (let t = 0; t < LADDER_TIME + 1 && !ff.action.done; t += 0.5) step(0.5);
  assert.ok(ff.action.done);
  stand(o.start.x, o.start.z);
  const m = eng.missions.get(o.id);
  assert.equal(m.state, 'late', 'a response far over its time');
  assert.equal(m.actionStars, 3);
  assert.equal(m.responseStars, 0);
  assert.deepEqual([50, 100, 130, 170, 200].map((t) => starsOf(t, 100)), [3, 3, 2, 1, 0]);
});

test('firefighter: an abandoned call leaves nothing drawn', () => {
  const { eng, ff } = setup(2);
  ff.jobs();
  ff.accept(ff.offers[0].id);
  assert.ok(ff.scene());
  eng.abandon();
  assert.equal(ff.scene(), null);
  assert.equal(ff.jobs().length, 3, 'new calls after');
});
