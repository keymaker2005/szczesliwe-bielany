import assert from 'node:assert/strict';
import test from 'node:test';
import { SHOTS, timeline, stopProfile, frameStats, shotList } from '../js/film-plan.js';
import { readWebm, summary } from '../tools/film-klatki.mjs';

test('the showreel lasts about 40 s and keeps the order of the plan', () => {
  const t = timeline();
  assert.equal(t.length, 7);
  assert.equal(t[0].start, 0);
  assert.ok(Math.abs(t.at(-1).end - 40) < 0.05);
  assert.deepEqual(t.map((s) => s.part), ['1', '2', '3a', '3b', '3c', '4', '5']);
  for (let i = 1; i < t.length; i++) assert.equal(t[i].start, t[i - 1].end);
  // the three short shots are about 3 s each
  for (const s of SHOTS.filter((x) => x.part.startsWith('3'))) assert.ok(s.dur >= 3 && s.dur <= 3.5);
});

test('a vehicle on rails cruises, brakes evenly and stands still at the stop', () => {
  const p = { sEnd: 100, v: 10, tStop: 5, brake: 2 };
  assert.deepEqual(stopProfile(6, p), { s: 100, speed: 0 });
  assert.equal(stopProfile(5, p).s, 100);
  assert.equal(stopProfile(3, p).speed, 10);
  assert.equal(stopProfile(3, p).s, 90); // braking from 10 m/s over 2 s takes 10 m
  assert.equal(stopProfile(1, p).s, 70);
  assert.ok(Math.abs(stopProfile(4, p).speed - 5) < 1e-9);
  // continuous: no jump anywhere
  for (let t = -4; t < 6; t += 0.01) assert.ok(stopProfile(t + 0.01, p).s - stopProfile(t, p).s <= 10 * 0.01 + 1e-9);
});

test('frame statistics count the late and the missing frames', () => {
  const s = frameStats([16.7, 16.7, 16.6, 33.4, 16.7, 50]);
  assert.equal(s.late, 2);
  assert.equal(s.dropped, 3);
  assert.equal(s.max, 50);
  assert.equal(frameStats([]).frames, 0);
});

test('the shot list has a row per shot with its timestamps', () => {
  const md = shotList({ stats: frameStats([16.7, 16.7]) });
  assert.match(md, /\| 1 \| 1 \| 0:00\.00 \| 0:06\.00 \| 6\.00 s \| Helikopter/);
  assert.match(md, /\| 7 \| 5 \| 0:32\.00 \| 0:40\.00 \|/);
  assert.match(md, /OpenStreetMap \(ODbL\); GUGiK/);
  assert.match(md, /## Płynność nagrania/);
});

// A tiny WebM built by hand: EBML header, a segment and a cluster of unknown size (as Chrome writes them), 3 frames
test('the WebM reader finds every frame and its timestamp', () => {
  const el = (id, body) => {
    const idBytes = []; for (let v = id; v > 0; v = Math.floor(v / 256)) idBytes.unshift(v & 0xff);
    return Buffer.concat([Buffer.from(idBytes), Buffer.from([0x80 | body.length]), body]);
  };
  const uintB = (v, n) => { const b = Buffer.alloc(n); b.writeUIntBE(v, 0, n); return b; };
  const block = (rel, key) => { const b = Buffer.alloc(4 + 2); b[0] = 0x81; b.writeInt16BE(rel, 1); b[3] = key ? 0x80 : 0; return el(0xa3, b); };
  const tracks = el(0x1654ae6b, el(0xae, Buffer.concat([el(0x86, Buffer.from('V_VP9')), el(0xe0, Buffer.concat([el(0xb0, uintB(1920, 2)), el(0xba, uintB(1080, 2))]))])));
  const open = (id) => { const idBytes = []; for (let v = id; v > 0; v = Math.floor(v / 256)) idBytes.unshift(v & 0xff); return Buffer.concat([Buffer.from(idBytes), Buffer.from([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])]); };
  const file = Buffer.concat([el(0x1a45dfa3, Buffer.from([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d])), open(0x18538067), tracks,
    open(0x1f43b675), el(0xe7, uintB(1000, 2)), block(0, true), block(17, false), block(50, false)]);
  const w = readWebm(file);
  assert.equal(w.codec, 'V_VP9');
  assert.equal(w.width, 1920);
  assert.deepEqual(w.frames.map((f) => f.t), [1000, 1017, 1050]);
  const s = summary(w);
  assert.equal(s.frames, 3);
  assert.equal(s.late, 1);
});
