import assert from 'node:assert/strict';
import test from 'node:test';
import { MissionEngine, STOP_HOLD } from '../js/missions.js';
import { Police, fineFor, verdictFor, choiceStars } from '../js/police.js';

const seeded = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const car = (x, z, kmh, yaw = 0) => ({ x, z, yaw, speed: kmh / 3.6, edge: {}, order: null, paint: [0.6, 0.65, 0.7], bodyType: 'sedan' });
// traffic.command as in js/traffic.js: the order and the pace on the car
const fakeTraffic = (cars) => ({ cars, command(c, order, pace) { c.order = order || null; c.pace = pace; } });

function setup(cars) {
  const eng = new MissionEngine();
  const store = memory();
  const police = new Police(eng, fakeTraffic(cars), { random: seeded(4), storage: store, limit: () => 50 });
  const p = { position: { x: 0, z: 0 }, heading: 0, speed: 0 };
  const chosen = [];
  let answer = null;
  Object.assign(police, {
    near: () => p.position,
    player: () => p,
    siren: () => false,
    choose: (o) => { chosen.push(o); return Promise.resolve(answer); },
  });
  const frame = (dt = 0.1) => { police.update(dt); eng.update(dt, { x: p.position.x, z: p.position.z, speed: p.speed, mode: 'car' }); };
  const stand = () => { for (let t = 0; t <= STOP_HOLD + 0.3; t += 0.1) frame(); };
  return { eng, store, police, p, chosen, frame, stand, answer: (a) => { answer = a; } };
}

test('police: a speed check: the radar reads the car ahead, the lights stop it, the right choice gets 3 stars', async () => {
  const cars = [];
  const s = setup(cars);
  const jobs = s.police.jobs();
  assert.deepEqual(jobs.map((j) => j.title.split(' ·')[0]), ['Kontrola drogowa', 'Pościg'], 'both kinds to pick from');
  const job = jobs[0];
  const o = s.police.offers[0];
  assert.ok(Math.hypot(o.start.x, o.start.z) >= 300 && Math.hypot(o.start.x, o.start.z) <= 1500);
  assert.ok(job.accept());
  // at the spot, facing +z: a car 30 m ahead at 70 km/h and two further off
  Object.assign(s.p.position, { x: o.start.x, z: o.start.z });
  const fast = car(o.start.x, o.start.z + 30, 70);
  cars.push(fast, car(o.start.x + 120, o.start.z, 40, 1.5), car(o.start.x - 150, o.start.z, 40, -1.5));
  s.stand();
  assert.equal(s.eng.active.state, 'enRoute');
  s.frame();
  const speeder = cars.find((c) => c.order === 'speed');
  assert.ok(speeder && speeder !== fast, 'a car further off speeds for the radar');
  assert.ok(speeder.pace * 3.6 > 50, 'over the limit');
  assert.equal(s.police.job.measured.get(fast).excess, 20);
  // lights on behind it: it pulls up, the other speeder goes back to normal
  s.police.siren = () => true;
  s.frame();
  assert.equal(fast.order, 'stop');
  assert.equal(speeder.order, null);
  fast.speed = 0;
  s.p.position.z = fast.z - 10;
  s.answer('fine');
  s.frame();
  assert.equal(s.chosen.length, 1);
  assert.match(s.chosen[0].text, /70 km\/h.*50 km\/h/);
  assert.ok(s.chosen[0].options.some((x) => x.label === 'Mandat 200 zł'));
  await Promise.resolve();
  s.stand();
  const m = s.eng.missions.get(o.id);
  assert.equal(m.state, 'delivered');
  assert.equal(m.choice, 'fine');
  assert.equal(m.stars, 3);
  assert.equal(m.paid, 40);
  assert.equal(fast.order, null, 'released after the check');
  assert.equal(JSON.parse(s.store.getItem('bielany-police')).checks, 1);
});

test('police: a chase ends close behind the car; a knock costs a star; a car far away is lost', async () => {
  const cars = [];
  const s = setup(cars);
  const job = s.police.jobs().find((j) => /Pościg/.test(j.title));
  assert.ok(job.accept());
  assert.equal(s.eng.active.state, 'enRoute', 'it starts at once');
  const runner = car(0, 100, 50);
  cars.push(runner);
  const marks = [];
  s.police.mark = (x, z) => marks.push([x, z]);
  s.frame();
  assert.equal(runner.order, 'flee');
  assert.ok(runner.pace > 14);
  assert.deepEqual(marks.at(-1), [0, 100]);
  s.police.onCollision({ b: runner });
  s.police.onCollision({ b: runner }); // the same knock
  assert.equal(s.police.job.hits, 1);
  // right behind it, going its way, for 4 s
  s.p.position.z = 90;
  s.p.speed = 12;
  for (let t = 0; t < 4.2; t += 0.1) s.police.update(0.1);
  assert.equal(runner.order, 'stop');
  runner.speed = 0;
  s.p.speed = 0;
  s.answer('court');
  s.frame();
  await Promise.resolve();
  s.stand();
  const m = s.eng.missions.get(job.id);
  assert.equal(m.state, 'delivered');
  assert.equal(m.stars, 2, 'three for the right choice, one off for the knock');
  assert.equal(runner.order, null);

  // the next chase: the car gets 420 m away
  const next = s.police.jobs().find((j) => /Pościg/.test(j.title));
  next.accept();
  const far = car(0, 200, 50);
  cars.length = 0;
  cars.push(far);
  s.frame();
  far.z = 600;
  s.frame();
  s.stand();
  const lost = s.eng.missions.get(next.id);
  assert.equal(lost.state, 'late');
  assert.ok(lost.lost);
  assert.equal(far.order, null);
});

test('police: the verdict and the fine follow the measured excess', () => {
  assert.deepEqual([-3, 0, 6, 10, 11, 25].map(verdictFor), ['none', 'none', 'warning', 'warning', 'fine', 'fine']);
  assert.deepEqual([5, 12, 20, 33, 80].map(fineFor), [50, 100, 200, 800, 2500]);
  assert.equal(choiceStars('warning', 'warning'), 3);
  assert.equal(choiceStars('warning', 'fine'), 2);
  assert.equal(choiceStars('none', 'fine'), 0);
});
