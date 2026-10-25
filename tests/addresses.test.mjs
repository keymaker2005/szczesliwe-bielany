import assert from 'node:assert/strict';
import test from 'node:test';
import { GEO } from '../js/bielany-geodata.js';

const inRing = (x, z, r) => {
  let c = false;
  for (let k = 0, m = r.length - 2; k < r.length; m = k, k += 2) {
    if ((r[k + 1] > z) !== (r[m + 1] > z) && x < ((r[m] - r[k]) * (z - r[k + 1])) / (r[m + 1] - r[k + 1]) + r[k]) c = !c;
  }
  return c;
};
const onSidewalk = (x, z) => GEO.sidewalks.some(([, outer, holes]) => inRing(x, z, outer) && !holes.some((h) => inRing(x, z, h)));

test('Addresses: real Bielany addresses, each with a sidewalk spot on its own street, reachable by the road graph', () => {
  const { streets, list } = GEO.addresses;
  assert.ok(list.length > 1500, `${list.length} addresses`);
  const find = (street, num) => list.find((a) => streets[a[0]] === street && a[1] === num);
  for (const [s, n] of [['Stefana Żeromskiego', '29'], ['Marymoncka', '34'], ['Wólczyńska', '133']]) {
    assert.ok(find(s, n), `missing address ${s} ${n}`);
  }

  // Road graph components (links both ways): delivery spots must lie by the main network
  const { nodes, links, names } = GEO.roadGraph;
  const parent = nodes.map((_, i) => i).slice(0, nodes.length / 2);
  const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (const [a, b] of links) parent[root(a)] = root(b);
  const size = new Map();
  for (let i = 0; i < parent.length; i++) size.set(root(i), (size.get(root(i)) || 0) + 1);
  const main = [...size].sort((p, q) => q[1] - p[1])[0][0];

  let offWalk = 0, offMain = 0;
  for (const [s, num, , , sx, sz] of list) {
    if (!onSidewalk(sx, sz)) offWalk++;
    // the nearest stretch of the address's own street
    const id = names.indexOf(streets[s]);
    let best = Infinity, node = -1;
    for (const [a, b, name, w, , , inner] of links) {
      if (name !== id) continue;
      const pts = [nodes[2 * a], nodes[2 * a + 1], ...inner, nodes[2 * b], nodes[2 * b + 1]];
      for (let k = 0; k + 3 < pts.length; k += 2) {
        const vx = pts[k + 2] - pts[k], vz = pts[k + 3] - pts[k + 1];
        const t = Math.max(0, Math.min(1, ((sx - pts[k]) * vx + (sz - pts[k + 1]) * vz) / (vx * vx + vz * vz || 1e-9)));
        const d = Math.hypot(sx - pts[k] - vx * t, sz - pts[k + 1] - vz * t) - w / 2;
        if (d < best) { best = d; node = a; }
      }
    }
    assert.ok(best < 20, `${streets[s]} ${num}: sidewalk spot ${best.toFixed(1)} m from its street`);
    if (root(node) !== main) offMain++;
  }
  // the 1 m raster and the simplified sidewalk outlines differ by a few cells at the edges
  assert.ok(offWalk / list.length < 0.02, `${offWalk} spots off the sidewalk outlines`);
  assert.ok(offMain / list.length < 0.03, `${offMain} spots by streets cut off from the main network`);
});
