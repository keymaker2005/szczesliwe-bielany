import assert from 'node:assert/strict';
import test from 'node:test';
import { MissionEngine, STOP_HOLD } from '../js/missions.js';
import { Courier, PICKUPS, MIN_ROUTE, MAX_ROUTE, deliveries } from '../js/courier.js';
import { findRoute } from '../js/gps-route.js';

// a small seeded generator (mulberry32) for repeatable offers
const seeded = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('courier: pick-ups by the M1 stations, three offers to real addresses 0.5-2 km away', () => {
  assert.deepEqual(PICKUPS.map((p) => p.id).sort(), ['Marymont', 'Młociny', 'Plac Wilsona', 'Stare Bielany', 'Słodowiec', 'Wawrzyszew']);
  const c = new Courier(new MissionEngine(), { random: seeded(7), storage: memory() });
  const jobs = c.jobs();
  assert.equal(jobs.length, 3);
  for (const o of c.offers) {
    assert.ok(o.distance >= MIN_ROUTE && o.distance <= MAX_ROUTE);
    assert.ok(PICKUPS.some((p) => p.x === o.start.x && p.z === o.start.z));
    assert.match(o.target.name, /\S+ \d/);
    assert.ok(o.reward >= 11 && o.reward <= 20, `${o.reward} zł`);
    assert.ok(o.par > 100 && o.par < 400);
    const r = findRoute(o.start.x, o.start.z, o.target.x, o.target.z);
    assert.ok(Math.abs(r.length - o.distance) < 1);
  }
  assert.equal(new Set(c.offers.map((o) => o.target.name)).size, 3, 'three different addresses');
});

test('courier: accept, pick up, deliver; earnings saved; fresh offers after', () => {
  const store = memory();
  const eng = new MissionEngine();
  const c = new Courier(eng, { random: seeded(3), storage: store });
  const o = c.refill()[0];
  assert.ok(c.accept(o.id));
  assert.equal(eng.goal().name, o.start.name);
  const stand = (x, z, mode = 'cyclist') => { for (let t = 0; t <= STOP_HOLD + 0.3; t += 0.1) eng.update(0.1, { x, z, speed: 0, mode }); };
  stand(o.start.x, o.start.z);
  assert.equal(eng.goal().name, o.target.name);
  eng.active.time = o.par * 0.5; // a shortcut
  stand(o.target.x, o.target.z, 'car');
  const m = eng.missions.get(o.id);
  assert.equal(m.state, 'delivered');
  assert.ok(m.shortcut > 0);
  assert.equal(c.stats.deliveries, 1);
  assert.equal(c.stats.earned, m.paid);
  assert.equal(JSON.parse(store.getItem('bielany-courier')).earned, m.paid);
  assert.equal(c.offers.length, 3);
  assert.ok(!c.offers.some((x) => x.id === o.id));
  // walking does not count for a courier
  const o2 = c.offers[0];
  c.accept(o2.id);
  stand(o2.start.x, o2.start.z, 'person');
  assert.equal(eng.active.state, 'accepted');
});

test('courier: Polish plural of deliveries', () => {
  assert.deepEqual([1, 2, 4, 5, 12, 22, 25, 104].map(deliveries),
    ['1 dostawa', '2 dostawy', '4 dostawy', '5 dostaw', '12 dostaw', '22 dostawy', '25 dostaw', '104 dostawy']);
});
