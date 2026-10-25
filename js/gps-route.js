// js/gps-route.js
// GPS routes along the Bielany street graph (js/bielany-geodata.js roadGraph): from any point to any point, joined to
// the nearest stretch of street at both ends. The car keeps to the one-way streets; on foot and by bike every street
// runs both ways. Shortest by length (A*, straight-line distance as the estimate).

import { GEO } from './bielany-geodata.js';

const { nodes, links } = GEO.roadGraph;
const N = nodes.length / 2;

// Every link as its points [x, z, ...] from node a to node b, its length and the directions it may be driven
const LINKS = links.map(([a, b, , , , dir, inner]) => {
  const pts = [nodes[2 * a], nodes[2 * a + 1], ...inner, nodes[2 * b], nodes[2 * b + 1]];
  const cum = [0];
  for (let k = 2; k < pts.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]));
  return { a, b, dir, pts, cum, len: cum[cum.length - 1] };
});
// node -> [{ link, forward }] (forward: leaving from a towards b)
const OUT = Array.from({ length: N }, () => []);
LINKS.forEach((l, i) => {
  OUT[l.a].push({ i, forward: true });
  OUT[l.b].push({ i, forward: false });
});

// Stretches indexed on a 100 m grid for the nearest-street lookups
const GRID = 100;
const grid = new Map();
LINKS.forEach((l, i) => {
  for (let k = 0; k + 3 < l.pts.length; k += 2) {
    const x0 = Math.min(l.pts[k], l.pts[k + 2]), x1 = Math.max(l.pts[k], l.pts[k + 2]);
    const z0 = Math.min(l.pts[k + 1], l.pts[k + 3]), z1 = Math.max(l.pts[k + 1], l.pts[k + 3]);
    for (let gx = Math.floor(x0 / GRID); gx <= Math.floor(x1 / GRID); gx++) {
      for (let gz = Math.floor(z0 / GRID); gz <= Math.floor(z1 / GRID); gz++) {
        const key = gx * 100000 + gz;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i, k);
      }
    }
  }
});

// The nearest point on a street to (x, z): { i: link, k: segment start, t, s: distance along the link, x, z, d }
function nearestOnStreet(x, z) {
  let best = null;
  for (let r = 0; r <= 6 && (!best || best.d > (r - 1) * GRID); r++) {
    const gx0 = Math.floor(x / GRID), gz0 = Math.floor(z / GRID);
    for (let gx = gx0 - r; gx <= gx0 + r; gx++) {
      for (let gz = gz0 - r; gz <= gz0 + r; gz++) {
        if (Math.max(Math.abs(gx - gx0), Math.abs(gz - gz0)) !== r) continue; // the ring at distance r only
        const list = grid.get(gx * 100000 + gz);
        if (!list) continue;
        for (let n = 0; n < list.length; n += 2) {
          const l = LINKS[list[n]], k = list[n + 1];
          const ax = l.pts[k], az = l.pts[k + 1], vx = l.pts[k + 2] - ax, vz = l.pts[k + 3] - az;
          const L2 = vx * vx + vz * vz || 1e-9;
          const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
          const px = ax + vx * t, pz = az + vz * t, d = Math.hypot(x - px, z - pz);
          if (!best || d < best.d) best = { i: list[n], k, t, s: l.cum[k / 2] + Math.sqrt(L2) * t, x: px, z: pz, d };
        }
      }
    }
  }
  return best;
}

// Points of link l between distances s0 and s1 along it (s0 > s1 walks it backwards), flat [x, z, ...]
function piece(l, s0, s1, out) {
  const at = (s) => {
    let k = 1;
    while (k < l.cum.length - 1 && l.cum[k] < s) k++;
    const f = (s - l.cum[k - 1]) / (l.cum[k] - l.cum[k - 1] || 1);
    return [l.pts[2 * k - 2] + (l.pts[2 * k] - l.pts[2 * k - 2]) * f, l.pts[2 * k - 1] + (l.pts[2 * k + 1] - l.pts[2 * k - 1]) * f];
  };
  out.push(...at(s0));
  if (s1 > s0) {
    for (let k = 1; k < l.cum.length - 1; k++) if (l.cum[k] > s0 && l.cum[k] < s1) out.push(l.pts[2 * k], l.pts[2 * k + 1]);
  } else {
    for (let k = l.cum.length - 2; k >= 1; k--) if (l.cum[k] < s0 && l.cum[k] > s1) out.push(l.pts[2 * k], l.pts[2 * k + 1]);
  }
  out.push(...at(s1));
}

const may = (l, forward, oneWay) => !oneWay || l.dir === 0 || (l.dir === 1) === forward;

/**
 * Route from (x0, z0) to (x1, z1) along the streets; oneWay: keep to the one-way streets (the car).
 * Returns { pts: flat [x, z, ...] from the start to the end, length: m along the streets } or null.
 */
function findRoute(x0, z0, x1, z1, { oneWay = false } = {}) {
  const A = nearestOnStreet(x0, z0), B = nearestOnStreet(x1, z1);
  if (!A || !B) return null;
  const la = LINKS[A.i], lb = LINKS[B.i];
  const pts = [x0, z0];
  // both ends on one link, the way it may be driven: straight along it
  if (A.i === B.i && may(la, B.s >= A.s, oneWay)) {
    piece(la, A.s, B.s, pts);
    pts.push(x1, z1);
    return { pts, length: Math.abs(B.s - A.s) };
  }
  // A* over the nodes; the start reaches the ends of its link, the goal is reached from the ends of its link
  const g = new Float64Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-2); // -1: from the start, else the index into OUT of the move taken
  const via = new Int32Array(N).fill(-1); // the previous node
  const h = (n) => Math.hypot(nodes[2 * n] - B.x, nodes[2 * n + 1] - B.z);
  const heap = [];
  const push = (n, f) => {
    heap.push([f, n]);
    for (let c = heap.length - 1; c > 0;) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let p = 0; ;) {
        const l = 2 * p + 1, r = l + 1;
        let m = p;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === p) break;
        [heap[p], heap[m]] = [heap[m], heap[p]];
        p = m;
      }
    }
    return top;
  };
  if (may(la, true, oneWay)) { g[la.b] = la.len - A.s; from[la.b] = -1; push(la.b, g[la.b] + h(la.b)); }
  if (may(la, false, oneWay) && A.s < g[la.a]) { g[la.a] = A.s; from[la.a] = -1; push(la.a, g[la.a] + h(la.a)); }
  // the goal through either end of its link
  const endVia = (n) => (n === lb.a && may(lb, true, oneWay) ? B.s : n === lb.b && may(lb, false, oneWay) ? lb.len - B.s : Infinity);
  let best = Infinity, bestNode = -1;
  while (heap.length) {
    const [f, n] = pop();
    if (f >= best) break;
    if (f - h(n) > g[n] + 1e-6) continue;
    const e = endVia(n);
    if (g[n] + e < best) { best = g[n] + e; bestNode = n; }
    for (let m = 0; m < OUT[n].length; m++) {
      const { i, forward } = OUT[n][m];
      const l = LINKS[i];
      if (!may(l, forward, oneWay)) continue;
      const to = forward ? l.b : l.a, cost = g[n] + l.len;
      if (cost < g[to]) { g[to] = cost; from[to] = m; via[to] = n; push(to, cost + h(to)); }
    }
  }
  if (bestNode < 0) return null;
  // walk back: the nodes from the start's link to the goal's link
  const chain = [];
  for (let n = bestNode; n >= 0 && from[n] !== -2; n = via[n]) {
    chain.push(n);
    if (from[n] === -1) break;
  }
  chain.reverse();
  const first = chain[0];
  piece(la, A.s, first === la.b ? la.len : 0, pts);
  for (let c = 1; c < chain.length; c++) {
    const { i, forward } = OUT[chain[c - 1]][from[chain[c]]];
    const l = LINKS[i];
    piece(l, forward ? 0 : l.len, forward ? l.len : 0, pts);
  }
  piece(lb, bestNode === lb.a ? 0 : lb.len, B.s, pts);
  pts.push(x1, z1);
  return { pts, length: best };
}

// Distance from (x, z) to a route's polyline
function distanceToRoute(pts, x, z) {
  let d = Infinity;
  for (let k = 0; k + 3 < pts.length; k += 2) {
    const ax = pts[k], az = pts[k + 1], vx = pts[k + 2] - ax, vz = pts[k + 3] - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1e-9)));
    d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return d;
}

export { findRoute, nearestOnStreet, distanceToRoute };
