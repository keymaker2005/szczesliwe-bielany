import assert from 'node:assert/strict';
import test from 'node:test';
import { GEO } from '../js/bielany-geodata.js';

test('trams: OpenStreetMap tracks and three lines there and back, each on its own track, stops in order', () => {
  const { tracks, routes } = GEO.trams;
  assert.ok(tracks.length > 100, `${tracks.length} tracks`);
  assert.equal(routes.length, 6);
  const names = routes.map((r) => r.name);
  for (const n of ['Metro Marymont – Cmentarz Włoski', 'Piastów Śląskich – Metro Młociny', 'Plac Grunwaldzki – Metro Młociny']) {
    assert.ok(names.includes(n), `route ${n}`);
    const [a, b] = n.split(' – ');
    assert.ok(names.includes(`${b} – ${a}`), `way back ${b} – ${a}`);
  }
  for (const r of routes) {
    assert.ok(r.length > 2500, `${r.name}: ${r.length} m`);
    assert.ok(r.stops.length >= 8, `${r.name}: ${r.stops.length} stops`);
    for (let k = 1; k < r.stops.length; k++) assert.ok(r.stops[k][0] >= r.stops[k - 1][0], 'stops in order along the route');
    const [a, b] = r.name.split(' – ');
    assert.equal(r.stops[0][1], a);
    assert.equal(r.stops[r.stops.length - 1][1], b);
    // the polyline's length matches
    let l = 0;
    for (let k = 2; k < r.pts.length; k += 2) l += Math.hypot(r.pts[k] - r.pts[k - 2], r.pts[k + 1] - r.pts[k - 1]);
    assert.ok(Math.abs(l - r.length) < 1);
  }
  // there and back run on different tracks for most of the way
  const there = routes.find((r) => r.name === 'Metro Marymont – Cmentarz Włoski');
  const back = routes.find((r) => r.name === 'Cmentarz Włoski – Metro Marymont');
  const key = (x, z) => `${Math.round(x)},${Math.round(z)}`;
  const set = new Set();
  for (let k = 0; k < there.pts.length; k += 2) set.add(key(there.pts[k], there.pts[k + 1]));
  let shared = 0;
  for (let k = 0; k < back.pts.length; k += 2) if (set.has(key(back.pts[k], back.pts[k + 1]))) shared++;
  assert.ok(shared / (back.pts.length / 2) < 0.3, `${shared} of ${back.pts.length / 2} points shared`);
});
