import assert from 'node:assert/strict';
import test from 'node:test';
import { MissionEngine, STOP_HOLD } from '../js/missions.js';
import { Guard, KINDS, MESSAGES, choiceStars } from '../js/guard.js';

const seeded = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

// Runs one call to the end choosing `pick(story)`; returns the mission
async function runCall(eng, guard, pick) {
  const [job] = guard.jobs();
  const o = guard.offers[0];
  assert.ok(job && /Zgłoszenie/.test(job.title));
  assert.ok(guard.accept(o.id));
  const stand = (x, z) => { for (let t = 0; t <= STOP_HOLD + 0.3; t += 0.1) { eng.update(0.1, { x, z, speed: 0, mode: 'car' }); guard.update(0.1); } };
  stand(o.start.x, o.start.z);
  const m = eng.active;
  assert.equal(m.state, 'enRoute');
  assert.equal(m.radius, 0, 'the call waits for the decision');
  await new Promise((r) => setImmediate(r));
  stand(o.start.x, o.start.z);
  return m;
}

test('guard: choice stars fit the story (best 3, fine<->tow 2, else 1)', () => {
  assert.equal(choiceStars('warn', 'warn'), 3);
  assert.equal(choiceStars('warn', 'fine'), 1);
  assert.equal(choiceStars('fine', 'warn'), 1);
  assert.equal(choiceStars('tow', 'fine'), 2);
  assert.equal(choiceStars('fine', 'tow'), 2);
});

test('guard: every kind has stories with a best option the kind offers; no insignia words', () => {
  for (const k of Object.values(KINDS)) {
    assert.ok(k.stories.some((s) => s.best === 'warn') && k.stories.some((s) => s.best !== 'warn'), 'warning and stronger answers both occur');
    for (const s of k.stories) assert.ok(k.options.includes(s.best));
  }
});

test('guard: a good choice gets 3 stars, a bad one fewer, and the SMS tells which', async () => {
  for (const wantBest of [true, false]) {
    const eng = new MissionEngine();
    const store = memory();
    let asked = null;
    const guard = new Guard(eng, {
      random: seeded(5), storage: store,
      choose: async (q) => { asked = q; const best = KINDS[eng.active.kind].stories[eng.active.story].best; return wantBest ? best : (best === 'warn' ? 'fine' : 'warn'); },
    });
    guard.near = () => ({ x: 0, z: 0 });
    const m = await runCall(eng, guard, null);
    assert.ok(asked && asked.options.length >= 2 && asked.text);
    assert.ok(['delivered', 'late'].includes(m.state));
    assert.equal(m.choiceStars, wantBest ? 3 : 1);
    assert.ok(m.stars <= m.choiceStars);
    assert.equal(JSON.parse(store.getItem('bielany-guard')).calls, 1);
    const text = MESSAGES.done(m);
    assert.match(text, wantBest ? /Trafna decyzja/ : /nie pasowało/);
  }
});

test('guard: the three kinds come one after another, each addressed near the player', async () => {
  const eng = new MissionEngine();
  const guard = new Guard(eng, { random: seeded(11), storage: memory(), choose: async () => 'warn' });
  guard.near = () => ({ x: 0, z: 0 });
  const kinds = [];
  for (let i = 0; i < 3; i++) {
    guard.jobs();
    const o = guard.offers[0];
    assert.ok(Math.hypot(o.start.x, o.start.z) <= 1500 && Math.hypot(o.start.x, o.start.z) >= 250);
    kinds.push(o.kind);
    await runCall(eng, guard, null);
    assert.equal(eng.active, null);
  }
  assert.deepEqual([...kinds].sort(), ['lawn', 'litter', 'noise']);
});

test('guard: abandoning during the decision leaves nothing active and ignores a late answer', async () => {
  const eng = new MissionEngine();
  let answer;
  const guard = new Guard(eng, { random: seeded(3), storage: memory(), choose: () => new Promise((r) => { answer = r; }) });
  guard.near = () => ({ x: 0, z: 0 });
  guard.jobs();
  const o = guard.offers[0];
  guard.accept(o.id);
  for (let t = 0; t <= STOP_HOLD + 0.3; t += 0.1) eng.update(0.1, { x: o.start.x, z: o.start.z, speed: 0, mode: 'car' });
  eng.abandon();
  answer('warn');
  await new Promise((r) => setImmediate(r));
  assert.equal(eng.active, null);
});
