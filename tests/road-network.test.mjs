import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRoadNetwork } from '../js/road-network.js';

test('the Bielany road network carries traffic from Stare Bielany to the Młociny terminus', () => {
  const info = console.info;
  console.info = () => {};
  let net;
  try {
    net = buildRoadNetwork([], []);
  } finally {
    console.info = info;
  }
  const { nodes, edges } = net;
  // most of the 119 km of drivable OpenStreetMap streets, both ways, stay in the connected network
  const km = edges.reduce((a, e) => a + e.span, 0) / 1000;
  assert.ok(km > 100, `${km.toFixed(1)} km of directed edges`);
  assert.ok(nodes.filter((n) => n.signal).length > 40, 'signalized junctions from OpenStreetMap');
  for (const n of nodes) assert.equal(n.sideGroups.length, n.arms.length);

  // a route along the moves from Kasprowicza at the Stare Bielany station to the Metro Młociny terminus
  const near = (x, z) => edges.reduce((best, e) => {
    const d = Math.hypot(e.x0 + e.dx * e.span / 2 - x, e.z0 + e.dz * e.span / 2 - z);
    return !best || d < best.d ? { e, d } : best;
  }, null);
  const from = near(9.4, -12.4), to = near(-1336.5, -1005.0);
  assert.ok(from.d < 30 && to.d < 30);
  const seen = new Set([from.e]);
  const queue = [from.e];
  while (queue.length) {
    const e = queue.shift();
    for (const m of e.moves) if (!seen.has(m.to)) { seen.add(m.to); queue.push(m.to); }
  }
  assert.ok(seen.has(to.e), 'Młociny is reachable');
});
