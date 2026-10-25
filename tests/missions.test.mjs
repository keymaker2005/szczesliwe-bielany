import assert from 'node:assert/strict';
import test from 'node:test';
import { MissionEngine, createMission, starsFor, STOP_HOLD } from '../js/missions.js';

const spec = (over = {}) => ({
  id: 'd1', title: 'Paczka', start: { x: 0, z: 0, name: 'Stare Bielany' }, target: { x: 400, z: 0, name: 'Żeromskiego 29' },
  vehicles: ['cyclist', 'car'], par: 100, limit: 180, reward: 30, ...over,
});
// Drive the player along x at speed v until x1, then stand still for the hold time
function travel(eng, from, to, v, mode = 'cyclist') {
  for (let x = from; x < to; x += v * 0.1) eng.update(0.1, { x, z: 0, speed: v, mode });
  for (let t = 0; t <= STOP_HOLD + 0.2; t += 0.1) eng.update(0.1, { x: to, z: 0, speed: 0, mode });
}

test('missions: offered -> accepted -> enRoute -> delivered with stars and pay', () => {
  const eng = new MissionEngine();
  const states = [];
  eng.on('state', (m, from) => states.push(`${from}>${m.state}`));
  eng.offer(spec());
  assert.ok(eng.accept('d1'));
  assert.equal(eng.goal().name, 'Stare Bielany');
  assert.ok(!eng.accept('d1'), 'one mission at a time');
  travel(eng, -50, 0, 6);
  assert.equal(eng.active.state, 'enRoute');
  assert.equal(eng.goal().name, 'Żeromskiego 29');
  travel(eng, 0, 400, 6); // ~67 s
  const m = eng.missions.get('d1');
  assert.equal(m.state, 'delivered');
  assert.equal(m.stars, 3);
  assert.equal(m.paid, 30);
  assert.equal(eng.active, null);
  assert.deepEqual(states, ['null>offered', 'offered>accepted', 'accepted>enRoute', 'enRoute>delivered']);
});

test('missions: passing the target without stopping does not deliver; wrong vehicle is reported', () => {
  const eng = new MissionEngine();
  eng.offer(spec({ start: null }));
  eng.accept('d1');
  assert.equal(eng.active.state, 'enRoute', 'no start: picked up at once');
  for (let x = 390; x < 420; x += 1) eng.update(0.1, { x, z: 0, speed: 10, mode: 'car' });
  assert.equal(eng.active.state, 'enRoute');
  assert.equal(eng.update(0.1, { x: 400, z: 0, speed: 0, mode: 'person' }), 'wrong-vehicle');
  for (let t = 0; t < 2; t += 0.1) eng.update(0.1, { x: 400, z: 0, speed: 0, mode: 'person' });
  assert.equal(eng.active.state, 'enRoute', 'on foot it does not count');
});

test('missions: late and abandoned', () => {
  const eng = new MissionEngine();
  eng.offer(spec({ start: null }));
  eng.accept('d1');
  travel(eng, 0, 400, 2); // 200 s > limit
  assert.equal(eng.missions.get('d1').state, 'late');
  assert.equal(eng.missions.get('d1').stars, 0);
  assert.ok(eng.missions.get('d1').paid > 0, 'a late parcel still pays a little');

  eng.offer(spec({ id: 'd2' }));
  eng.accept('d2');
  assert.ok(eng.abandon());
  assert.equal(eng.missions.get('d2').state, 'abandoned');
  assert.equal(eng.goal(), null);
  assert.deepEqual(eng.open(), []);
});

test('missions: star thresholds and a mission needs a target and par', () => {
  const m = createMission(spec());
  assert.deepEqual([90, 100, 130, 170, 181].map((t) => starsFor(m, t)), [3, 3, 2, 1, 0]);
  assert.throws(() => createMission({ id: 'x', target: { x: 0, z: 0 } }));
});

test('missions: a shortcut (well under par) pays a bonus', () => {
  const eng = new MissionEngine();
  eng.offer(spec({ start: null, bonus: 0.25 }));
  eng.accept('d1');
  travel(eng, 0, 400, 6); // ~67 s < 100 × 0.8
  const m = eng.missions.get('d1');
  assert.equal(m.shortcut, 8);
  assert.equal(m.paid, 38);
});
