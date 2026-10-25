import assert from 'node:assert/strict';
import test from 'node:test';
import { GEO } from '../js/bielany-geodata.js';
import { findRoute, distanceToRoute, nearestOnStreet } from '../js/gps-route.js';

const len = (pts) => {
  let s = 0;
  for (let k = 2; k < pts.length; k += 2) s += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
  return s;
};

test('GPS route: Stare Bielany station to Żeromskiego 29 and to Młociny along the streets', () => {
  const { streets, list } = GEO.addresses;
  const z29 = list.find((a) => streets[a[0]] === 'Stefana Żeromskiego' && a[1] === '29');
  for (const oneWay of [false, true]) {
    const r = findRoute(9.4, -12.4, z29[4], z29[5], { oneWay });
    assert.ok(r, 'a route exists');
    assert.deepEqual(r.pts.slice(0, 2), [9.4, -12.4]);
    assert.deepEqual(r.pts.slice(-2), [z29[4], z29[5]]);
    const straight = Math.hypot(z29[4] - 9.4, z29[5] + 12.4);
    assert.ok(r.length >= straight * 0.95 && r.length < straight * 2.2, `${r.length.toFixed(0)} m vs ${straight.toFixed(0)} m straight`);
    // every point of the route (but the two ends) lies on a street
    for (let k = 2; k < r.pts.length - 2; k += 2) assert.ok(nearestOnStreet(r.pts[k], r.pts[k + 1]).d < 0.05);
    assert.ok(Math.abs(len(r.pts.slice(2, -2)) - r.length) < 1, 'the length is the polyline along the streets');
  }
  const far = findRoute(9.4, -12.4, -1336.5, -1005.0, { oneWay: true });
  assert.ok(far && far.length > 1600 && far.length < 3000, `Młociny ${far?.length.toFixed(0)} m`);
  assert.ok(distanceToRoute(far.pts, -660, -520) < 400, 'via Wawrzyszew, along the M1 line');
});

test('GPS route: the car keeps to one-way streets, on foot they run both ways', () => {
  const { nodes, links } = GEO.roadGraph;
  // a long one-way link: driving against it takes a detour, walking does not
  const one = links.map((l, i) => ({ l, i })).filter(({ l }) => l[5] !== 0).find(({ l }) => {
    const [a, b] = l;
    return Math.hypot(nodes[2 * a] - nodes[2 * b], nodes[2 * a + 1] - nodes[2 * b + 1]) > 120;
  });
  assert.ok(one, 'a one-way street over 120 m');
  const [a, b, , , , dir] = one.l;
  const [s, e] = dir === 1 ? [b, a] : [a, b]; // against the traffic
  const mid = (n, m, f) => [nodes[2 * n] + (nodes[2 * m] - nodes[2 * n]) * f, nodes[2 * n + 1] + (nodes[2 * m + 1] - nodes[2 * n + 1]) * f];
  const [x0, z0] = mid(s, e, 0.2), [x1, z1] = mid(s, e, 0.8);
  const walk = findRoute(x0, z0, x1, z1);
  const drive = findRoute(x0, z0, x1, z1, { oneWay: true });
  assert.ok(walk.length < Math.hypot(x1 - x0, z1 - z0) * 1.3);
  assert.ok(!drive || drive.length > walk.length * 1.5, 'the car goes round');
});
