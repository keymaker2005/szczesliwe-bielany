import assert from 'node:assert/strict';
import test from 'node:test';
import { MissionEngine, STOP_HOLD } from '../js/missions.js';
import { Taxi } from '../js/taxi.js';

const seeded = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

function ride(eng, taxi, o, drive) {
  assert.ok(taxi.accept(o.id));
  const stand = (x, z) => { for (let t = 0; t <= STOP_HOLD + 0.3; t += 0.1) { eng.update(0.1, { x, z, speed: 0, mode: 'car' }); taxi.update(0.1, { x, z, speed: 0, mode: 'car' }, 0); } };
  stand(o.start.x, o.start.z);
  assert.equal(eng.active.state, 'enRoute');
  drive();
  eng.active.time = o.par * 0.9;
  stand(o.target.x, o.target.z);
  return eng.missions.get(o.id);
}

test('taxi: fares near the player to addresses 0.8-3 km away, car only', () => {
  const eng = new MissionEngine();
  const taxi = new Taxi(eng, null, { random: seeded(11), storage: memory() });
  taxi.near = () => ({ x: 0, z: 0 });
  const jobs = taxi.jobs();
  assert.equal(jobs.length, 2);
  for (const o of taxi.offers) {
    assert.ok(Math.hypot(o.start.x, o.start.z) < 750);
    assert.ok(o.distance >= 800 && o.distance <= 3000);
    assert.deepEqual(o.vehicles, ['car']);
    assert.ok(o.reward >= 11 && o.reward <= 25, `${o.reward} zł`);
  }
});

test('taxi: a smooth ride earns a tip, hard braking and a crash cost comfort', () => {
  const eng = new MissionEngine();
  const store = memory();
  const taxi = new Taxi(eng, null, { random: seeded(5), storage: store });
  taxi.near = () => ({ x: 0, z: 0 });
  // smooth: gentle speed changes
  let o = taxi.refill()[0];
  let m = ride(eng, taxi, o, () => {
    for (let v = 0; v < 12; v += 0.2) taxi.update(0.1, { x: 0, z: 0, speed: v, mode: 'car' }, 0);
    for (let v = 12; v > 0; v -= 0.3) taxi.update(0.1, { x: 0, z: 0, speed: v, mode: 'car' }, 0);
  });
  assert.equal(m.state, 'delivered');
  assert.equal(m.comfort, 100);
  assert.ok(m.tip > 0 && m.paid === Math.round((m.reward * m.stars) / 3) + m.tip);
  // rough: two hard stops and a crash
  o = taxi.refill()[0];
  m = ride(eng, taxi, o, () => {
    const notes = [];
    // an ordinary stop at the cab's full brake (9 m/s²) from 30 km/h: not counted
    let ordinary = null;
    for (let v = 8.3; v >= 0; v -= 0.9) ordinary = taxi.update(0.1, { x: 0, z: 0, speed: v, mode: 'car' }, 0) || ordinary;
    for (let k = 0; k < 50; k++) ordinary = taxi.update(0.1, { x: 0, z: 0, speed: 0, mode: 'car' }, 0) || ordinary;
    assert.equal(ordinary, null);
    for (const [a, b] of [[14, 3], [13, 2]]) { // emergency stops from ~50 km/h, one deduction each
      let note = null;
      for (let v = a; v >= b; v -= 0.9) note = taxi.update(0.1, { x: 0, z: 0, speed: v, mode: 'car' }, 0) || note;
      for (let k = 0; k < 45; k++) note = taxi.update(0.1, { x: 0, z: 0, speed: b, mode: 'car' }, 0) || note;
      notes.push(note);
    }
    taxi.update(0.1, { x: 0, z: 0, speed: 12, mode: 'car' }, 0);
    notes.push(taxi.update(0.1, { x: 0, z: 0, speed: 0, mode: 'car' }, 0));
    assert.deepEqual(notes, ['brake', 'brake', 'crash']);
  });
  assert.equal(m.comfort, 100 - 4 - 4 - 15);
  assert.equal(m.rideNotes.brakes, 2);
  assert.equal(m.rideNotes.crashes, 1);
  assert.ok(m.tip < m.reward * 0.2);
  assert.equal(JSON.parse(store.getItem('bielany-taxi')).rides, 2);
});
