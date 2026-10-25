import assert from 'node:assert/strict';
import test from 'node:test';
import { MissionEngine, STOP_HOLD } from '../js/missions.js';
import { Medic, HOSPITAL, starsOf } from '../js/medic.js';

const seeded = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('medic: a call to an address near the player, the patient to Szpital Bielański, stars for response and transport', () => {
  assert.match(HOSPITAL.name, /Szpital Bielański/);
  assert.ok(Math.hypot(HOSPITAL.x - 111.8, HOSPITAL.z + 529.9) < 200, 'by the hospital');
  const eng = new MissionEngine();
  const store = memory();
  const medic = new Medic(eng, { random: seeded(9), storage: store });
  medic.near = () => ({ x: 0, z: 0 });
  const [job] = medic.jobs();
  assert.ok(job && /Wezwanie/.test(job.title));
  const o = medic.offers[0];
  assert.ok(Math.hypot(o.start.x, o.start.z) <= 1800);
  assert.ok(medic.accept(o.id));
  const stand = (x, z) => { for (let t = 0; t <= STOP_HOLD + 0.3; t += 0.1) { eng.update(0.1, { x, z, speed: 0, mode: 'car' }); medic.update(0.1); } };
  // a slow response: 2 × its par
  for (let t = 0; t < o.responsePar * 2; t += 1) medic.update(1);
  stand(o.start.x, o.start.z);
  const m = eng.active;
  assert.equal(m.state, 'enRoute');
  assert.ok(m.responseTime >= o.responsePar * 2);
  m.time = m.par * 0.5;
  stand(HOSPITAL.x, HOSPITAL.z);
  assert.equal(m.state, 'late', 'a response far over its time makes the call late');
  assert.equal(m.transportStars, 3);
  assert.equal(m.responseStars, 0);
  assert.equal(m.stars, 0);
  assert.equal(JSON.parse(store.getItem('bielany-medic')).calls, 1);
  assert.deepEqual([50, 100, 130, 170, 200].map((t) => starsOf(t, 100)), [3, 3, 2, 1, 0]);
});
