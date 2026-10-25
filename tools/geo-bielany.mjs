// tools/geo-bielany.mjs
// Builds js/bielany-geodata.js: the Bielany MVP area (Stare Bielany, Wawrzyszew, Młociny) in the simulation's world
// frame (tools/bielany-frame.mjs: 1 unit = 1 m, x = east, z = south, origin at the Stare Bielany metro station, no
// rotation): the streets (map lines and the drivable graph), the blocks between them with their sidewalks, the
// buildings, the M1 stations, the addresses.
//
// Inputs: tools/data/osm_bielany_{streets,rail,buildings,districts,signals,addresses}.json (OpenStreetMap via Overpass, see
// tools/overpass.sh and tools/data/q_bielany_*.overpassql); data/bielany_lod1_2024.geojson (GUGiK LoD1 buildings)
//
// usage: node tools/geo-bielany.mjs [outFile]

import fs from 'node:fs';
import { ROOT, read, osm, BBOX, BOUNDS, LAT0, LON0, toWorld } from './bielany-frame.mjs';

const OUT = process.argv[2] || ROOT + 'js/bielany-geodata.js';
const log = (...a) => console.log('[geo-bielany]', ...a);
const q = (v) => Math.round(v * 10) / 10;

// =====================================================================================================================
// 1. ROAD CLASSES
// =====================================================================================================================
// OSM highway class -> [short class code, default travel lanes (two-way), default curb-to-curb width per lane (m)]
const CLASSES = {
  trunk: ['trunk', 4, 3.5], trunk_link: ['trunk', 1, 3.5],
  primary: ['primary', 4, 3.5], primary_link: ['primary', 1, 3.5],
  secondary: ['secondary', 2, 3.5], secondary_link: ['secondary', 1, 3.5],
  tertiary: ['tertiary', 2, 3.25], tertiary_link: ['tertiary', 1, 3.25],
  unclassified: ['local', 2, 3.0], residential: ['local', 2, 3.0],
  living_street: ['living', 2, 2.5],
  service: ['service', 2, 2.25],
  pedestrian: ['pedestrian', 0, 0],
};
// Service roads that are not streets: parking aisles and private driveways stay off the map and the graph
const SKIP_SERVICE = new Set(['parking_aisle', 'driveway', 'emergency_access', 'drive-through']);

function roadOf(tags) {
  const cls = CLASSES[tags.highway];
  if (!cls || tags.area === 'yes' || tags.tunnel === 'yes') return null;
  if (tags.highway === 'service' && SKIP_SERVICE.has(tags.service)) return null;
  const [code, defLanes, laneW] = cls;
  const oneway = tags.oneway === 'yes' || tags.oneway === '1' || tags.junction === 'roundabout' || tags.junction === 'circular';
  const dir = tags.oneway === '-1' ? -1 : oneway ? 1 : 0;
  const tagLanes = parseInt(tags.lanes, 10);
  const lanes = code === 'pedestrian' ? 0 : tagLanes > 0 ? tagLanes : dir ? Math.max(1, defLanes >> 1) : defLanes;
  const tagW = parseFloat(tags.width);
  // curb to curb: the lanes plus the gutters; pedestrian streets are drawn 6 m wide
  const w = tagW > 0 && tagW < 40 ? tagW : code === 'pedestrian' ? 6 : lanes * laneW + 1;
  const ring = tags.junction === 'roundabout' || tags.junction === 'circular';
  // speed limit (km/h): the maxspeed tag, else the Polish urban defaults by class (50 in built-up areas, 20 in a
  // living street, 30 on service roads, 70 on the expressway-like trunk roads)
  const tagLimit = parseInt(tags.maxspeed, 10);
  const limit = tagLimit >= 5 && tagLimit <= 140 ? tagLimit : tags.maxspeed === 'PL:living_street' ? 20 : tags.maxspeed === 'PL:zone30' ? 30
    : ({ trunk: 70, living: 20, service: 30 })[code] ?? 50;
  return { name: tags.name || '', code, dir, lanes, w: q(w), ring, limit, drivable: code !== 'pedestrian' };
}

// =====================================================================================================================
// 2. CLIPPING TO THE MVP AREA
// =====================================================================================================================
const { minX: X0, maxX: X1, minZ: Z0, maxZ: Z1 } = BOUNDS;
const inside = (p) => p[0] >= X0 && p[0] <= X1 && p[1] >= Z0 && p[1] <= Z1;
// Liang-Barsky: [t0, t1] of segment a-b inside the bounds, or null
function clipT(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  let t0 = 0, t1 = 1;
  for (const [p, r] of [[-dx, a[0] - X0], [dx, X1 - a[0]], [-dz, a[1] - Z0], [dz, Z1 - a[1]]]) {
    if (p === 0) { if (r < 0) return null; continue; }
    const t = r / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [t0, t1];
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// The pieces of a polyline inside the bounds. Each point keeps its OSM key (rounded lon/lat) so shared OSM nodes stay
// shared; points made by the cut get a key of their own.
function clipLine(pts) {
  const pieces = [];
  let cur = null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const t = clipT(a.p, b.p);
    if (!t) { if (cur) { pieces.push(cur); cur = null; } continue; }
    const pa = t[0] > 0 ? { p: lerp(a.p, b.p, t[0]), key: `cut:${a.key}:${b.key}` } : a;
    const pb = t[1] < 1 ? { p: lerp(a.p, b.p, t[1]), key: `cut:${b.key}:${a.key}` } : b;
    if (!cur) cur = [pa];
    cur.push(pb);
    if (t[1] < 1) { pieces.push(cur); cur = null; }
  }
  if (cur) pieces.push(cur);
  return pieces.filter((pc) => pc.length > 1);
}

// Douglas-Peucker on [x, z] points
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [ax, az] = pts[0], [bx, bz] = pts[pts.length - 1];
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
  let best = -1, bi = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / len;
    if (d > best) { best = d; bi = i; }
  }
  if (best <= eps) return [pts[0], pts[pts.length - 1]];
  return [...rdp(pts.slice(0, bi + 1), eps).slice(0, -1), ...rdp(pts.slice(bi), eps)];
}
// Closed-ring Douglas-Peucker: split at the vertex farthest from the first, simplify both halves
function rdpRing(pts, eps) {
  let far = 0, fd = -1;
  for (let k = 1; k < pts.length; k++) {
    const d = Math.hypot(pts[k][0] - pts[0][0], pts[k][1] - pts[0][1]);
    if (d > fd) { fd = d; far = k; }
  }
  const a = rdp(pts.slice(0, far + 1), eps), b = rdp([...pts.slice(far), pts[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
const flat = (pts) => pts.flatMap(([x, z]) => [q(x), q(z)]);

// =====================================================================================================================
// 3. STREET PIECES
// =====================================================================================================================
const keyOf = (g) => `${g.lon.toFixed(7)},${g.lat.toFixed(7)}`;
const pieces = [];
for (const e of osm('streets')) {
  if (e.type !== 'way' || !e.geometry) continue;
  const road = roadOf(e.tags);
  if (!road) continue;
  const pts = e.geometry.map((g) => ({ p: toWorld(g.lon, g.lat), key: keyOf(g) }));
  for (const pc of clipLine(pts)) pieces.push({ ...road, pts: pc });
}

// =====================================================================================================================
// 4. ROAD GRAPH (drivable pieces): nodes at shared OSM nodes, way ends and cuts; one link per stretch in between
// =====================================================================================================================
function buildRoadGraph() {
  const drivable = pieces.filter((r) => r.drivable);
  const uses = new Map();
  for (const r of drivable) for (const pt of new Set(r.pts.map((pt) => pt.key))) uses.set(pt, (uses.get(pt) || 0) + 1);
  const nodes = [];
  const nodeIds = new Map();
  const nodeAt = (pt) => {
    if (!nodeIds.has(pt.key)) { nodeIds.set(pt.key, nodes.length / 2); nodes.push(q(pt.p[0]), q(pt.p[1])); }
    return nodeIds.get(pt.key);
  };
  const names = [];
  const nameIds = new Map();
  const nameId = (n) => {
    if (!nameIds.has(n)) { nameIds.set(n, names.length); names.push(n); }
    return nameIds.get(n);
  };
  const links = [];
  for (const r of drivable) {
    let start = 0;
    for (let i = 1; i < r.pts.length; i++) {
      const last = i === r.pts.length - 1;
      if (!last && uses.get(r.pts[i].key) < 2) continue;
      const run = r.pts.slice(start, i + 1);
      const a = nodeAt(run[0]), b = nodeAt(run[run.length - 1]);
      start = i;
      if (a === b && run.length < 3) continue;
      const inner = rdp(run.map((pt) => pt.p), 0.4).slice(1, -1);
      links.push([a, b, nameId(r.name), r.w, r.lanes, r.dir, flat(inner), r.code, r.ring ? 1 : 0, r.limit]);
    }
  }
  return { nodes, links, names };
}

// =====================================================================================================================
// 5. NAMED ROADS (map lines and labels): pieces of one street joined end to end
// =====================================================================================================================
function mergeRoads() {
  const groups = new Map();
  for (const r of pieces) {
    const k = `${r.name}|${r.code}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push({ ...r, pts: r.pts.slice() });
  }
  const out = [];
  for (const list of groups.values()) {
    // Join pieces sharing an end node (reversing two-way pieces as needed) until nothing joins
    let joined = true;
    while (joined) {
      joined = false;
      for (let i = 0; i < list.length && !joined; i++) {
        for (let j = 0; j < list.length && !joined; j++) {
          if (i === j) continue;
          const A = list[i], B = list[j];
          if (A.dir !== B.dir || A.lanes !== B.lanes) continue;
          const aEnd = A.pts[A.pts.length - 1].key, bStart = B.pts[0].key;
          const canFlip = A.dir === 0;
          if (aEnd === bStart) A.pts.push(...B.pts.slice(1));
          else if (canFlip && aEnd === B.pts[B.pts.length - 1].key) A.pts.push(...B.pts.slice(0, -1).reverse());
          else continue;
          list.splice(j, 1);
          joined = true;
        }
      }
    }
    for (const r of list) out.push(r);
  }
  return out.map((r) => [r.name, r.w, r.dir, r.lanes, r.code === 'trunk' ? 1 : 0, flat(rdp(r.pts.map((pt) => pt.p), 0.4)), r.code]);
}

// =====================================================================================================================
// 6. BLOCKS & SIDEWALKS, on a 1 m raster of the area: the roadway (every drivable link at its width, corners rounded at
//    the junctions) splits the ground into blocks (curb islands); the cells of a block within a sidewalk's width of the
//    roadway are its sidewalk. Both are traced back into outlines (outer ring + holes) and simplified.
// =====================================================================================================================
const RES = 1; // m per cell
const SIDEWALK = { major: 3.0, street: 2.5, minor: 1.5 }; // sidewalk width by the class of the road it runs along
const CORNER = 3.0; // m added to the widest street's half width at a junction: the curb corner radius
const MIN_BLOCK = 30; // m²: smaller islands stay roadway

function buildBlocks(graph) {
  const W = Math.ceil((X1 - X0) / RES), H = Math.ceil((Z1 - Z0) / RES);
  const road = new Uint8Array(W * H); // 0: ground, else 1 + road class (sidewalk width) of the roadway there
  const classOf = (code) => (code === 'trunk' || code === 'primary' || code === 'secondary' ? 3 : code === 'service' || code === 'living' ? 1 : 2);
  const widthOf = [0, SIDEWALK.minor, SIDEWALK.street, SIDEWALK.major];
  // Paint a capsule (segment a-b, radius r) of roadway; wider classes win where streets meet
  function paint(ax, az, bx, bz, r, cls) {
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - r - X0) / RES)), i1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + r - X0) / RES));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - r - Z0) / RES)), j1 = Math.min(H - 1, Math.ceil((Math.max(az, bz) + r - Z0) / RES));
    const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1e-9;
    for (let j = j0; j <= j1; j++) {
      const z = Z0 + (j + 0.5) * RES;
      for (let i = i0; i <= i1; i++) {
        const x = X0 + (i + 0.5) * RES;
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
        if (Math.hypot(ax + vx * t - x, az + vz * t - z) <= r) road[j * W + i] = Math.max(road[j * W + i], cls);
      }
    }
  }
  const { nodes, links } = graph;
  const joinR = new Map();
  const degree = new Map();
  for (const [a, b, , w, , , inner, code] of links) {
    const pts = [[nodes[2 * a], nodes[2 * a + 1]]];
    for (let k = 0; k < inner.length; k += 2) pts.push([inner[k], inner[k + 1]]);
    pts.push([nodes[2 * b], nodes[2 * b + 1]]);
    const h = Math.max(2.5, w / 2);
    for (let k = 0; k + 1 < pts.length; k++) paint(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], h, 1 + classOf(code));
    for (const n of [a, b]) {
      joinR.set(n, Math.max(joinR.get(n) || 0, h));
      degree.set(n, (degree.get(n) || 0) + 1);
    }
  }
  for (const [n, h] of joinR) {
    if (degree.get(n) < 3) continue; // corners only where streets meet
    const x = nodes[2 * n], z = nodes[2 * n + 1];
    paint(x, z, x, z, h + CORNER, 1);
  }

  // Blocks: 4-connected ground components
  const label = new Int32Array(W * H).fill(-1);
  const blocks = [];
  const queue = new Int32Array(W * H);
  for (let start = 0; start < W * H; start++) {
    if (road[start] || label[start] >= 0) continue;
    const id = blocks.length;
    let head = 0, tail = 0;
    queue[tail++] = start;
    label[start] = id;
    while (head < tail) {
      const c = queue[head++];
      const i = c % W, j = (c - i) / W;
      for (const n of [i > 0 ? c - 1 : -1, i < W - 1 ? c + 1 : -1, j > 0 ? c - W : -1, j < H - 1 ? c + W : -1]) {
        if (n >= 0 && !road[n] && label[n] < 0) { label[n] = id; queue[tail++] = n; }
      }
    }
    blocks.push({ id, cells: tail });
  }

  // Sidewalks: block cells nearer the roadway than its sidewalk width (nearest roadway cell carried along, 8-connected)
  const near = new Float32Array(W * H).fill(Infinity);
  const src = new Int32Array(W * H).fill(-1);
  let head = 0, tail = 0;
  const q2 = new Int32Array(W * H * 2);
  for (let c = 0; c < W * H; c++) {
    if (!road[c]) continue;
    const i = c % W, j = (c - i) / W;
    if ((i > 0 && !road[c - 1]) || (i < W - 1 && !road[c + 1]) || (j > 0 && !road[c - W]) || (j < H - 1 && !road[c + W])) {
      src[c] = c;
      near[c] = 0;
      q2[tail++] = c;
    }
  }
  while (head < tail) {
    const c = q2[head++];
    const s = src[c], si = s % W, sj = (s - si) / W, lim = widthOf[road[s] - 1] + 0.5;
    const i = c % W, j = (c - i) / W;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj;
        if ((!di && !dj) || ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const n = nj * W + ni;
        if (road[n]) continue;
        const d = Math.hypot(ni - si, nj - sj) * RES;
        if (d > lim || d >= near[n]) continue;
        near[n] = d;
        src[n] = s;
        if (tail < q2.length) q2[tail++] = n;
      }
    }
  }

  // Outline of the cells where inside(i, j): every cell side facing outside, joined into rings (region on the left,
  // outer rings counter-clockwise in x/z), corners of the cell staircase simplified away
  function trace(i0, j0, i1, j1, inside) {
    const out = new Map(); // vertex key -> [{ to, cell }]
    const key = (i, j) => j * (W + 1) + i;
    const add = (ai, aj, bi, bj, cell) => {
      const k = key(ai, aj);
      if (!out.has(k)) out.set(k, []);
      out.get(k).push({ to: key(bi, bj), cell });
    };
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (!inside(i, j)) continue;
        const cell = j * W + i;
        if (!inside(i, j - 1)) add(i, j, i + 1, j, cell);
        if (!inside(i + 1, j)) add(i + 1, j, i + 1, j + 1, cell);
        if (!inside(i, j + 1)) add(i + 1, j + 1, i, j + 1, cell);
        if (!inside(i - 1, j)) add(i, j + 1, i, j, cell);
      }
    }
    const rings = [];
    for (const [k0, list0] of out) {
      while (list0.length) {
        const ring = [];
        let k = k0;
        let e = list0.pop();
        ring.push(k);
        for (let guard = 0; guard < 4e6; guard++) {
          k = e.to;
          if (k === k0) break;
          ring.push(k);
          const list = out.get(k);
          // at a pinch (two cells meeting at a corner) keep to the same cell's boundary
          let idx = list.findIndex((f) => f.cell === e.cell);
          if (idx < 0) idx = list.length - 1;
          e = list.splice(idx, 1)[0];
        }
        const pts = ring.map((v) => { const vi = v % (W + 1), vj = (v - vi) / (W + 1); return [X0 + vi * RES, Z0 + vj * RES]; });
        const simple = rdpRing(pts, 1.2);
        if (simple.length >= 3) rings.push(simple);
      }
    }
    return rings;
  }
  const ringArea = (r) => {
    let s = 0;
    for (let k = 0, m = r.length - 1; k < r.length; m = k++) s += r[m][0] * r[k][1] - r[k][0] * r[m][1];
    return s / 2;
  };
  const pointIn = (p, r) => {
    let c = false;
    for (let k = 0, m = r.length - 1; k < r.length; m = k++) {
      if ((r[k][1] > p[1]) !== (r[m][1] > p[1]) && p[0] < ((r[m][0] - r[k][0]) * (p[1] - r[k][1])) / (r[m][1] - r[k][1]) + r[k][0]) c = !c;
    }
    return c;
  };
  // Rings -> polygons: each counter-clockwise ring with the clockwise rings inside it as its holes
  function polygons(rings) {
    const outers = rings.filter((r) => ringArea(r) > 0).sort((a, b) => ringArea(a) - ringArea(b));
    const holes = rings.filter((r) => ringArea(r) < 0);
    const polys = outers.map((o) => ({ outer: o, holes: [] }));
    for (const h of holes) {
      const p = polys.find((q) => pointIn(h[0], q.outer)); // the smallest outer ring around it
      if (p) p.holes.push(h);
    }
    return polys;
  }

  // Bounds of every block's cells
  const bb = blocks.map(() => [W, H, -1, -1]);
  for (let c = 0; c < W * H; c++) {
    const id = label[c];
    if (id < 0) continue;
    const i = c % W, j = (c - i) / W, b = bb[id];
    if (i < b[0]) b[0] = i; if (j < b[1]) b[1] = j; if (i > b[2]) b[2] = i; if (j > b[3]) b[3] = j;
  }
  const outBlocks = [];
  const outWalks = [];
  for (const b of blocks) {
    if (b.cells * RES * RES < MIN_BLOCK) continue;
    const [i0, j0, i1, j1] = bb[b.id];
    const lab = (i, j) => i >= 0 && j >= 0 && i < W && j < H && label[j * W + i] === b.id;
    const shape = polygons(trace(i0, j0, i1, j1, lab));
    if (!shape.length) continue;
    const index = outBlocks.length;
    // the largest polygon is the block; stray pieces (cut off by a pinch) are dropped
    shape.sort((p, q) => ringArea(q.outer) - ringArea(p.outer));
    const main = shape[0];
    outBlocks.push([flat(main.outer), main.holes.map(flat), q(b.cells * RES * RES)]);
    const walk = (i, j) => lab(i, j) && near[j * W + i] <= widthOf[road[src[j * W + i]] - 1];
    for (const p of polygons(trace(i0, j0, i1, j1, walk))) {
      if (Math.abs(ringArea(p.outer)) >= 4) outWalks.push([index, flat(p.outer), p.holes.map(flat)]);
    }
  }
  // Sidewalk lookup for the addresses: a cell of a kept block within its sidewalk's width of the roadway
  const kept = new Uint8Array(blocks.length);
  for (const b of blocks) kept[b.id] = b.cells * RES * RES >= MIN_BLOCK ? 1 : 0;
  const isWalk = (x, z) => {
    const i = Math.floor((x - X0) / RES), j = Math.floor((z - Z0) / RES);
    if (i < 0 || j < 0 || i >= W || j >= H) return false;
    const c = j * W + i;
    return label[c] >= 0 && kept[label[c]] === 1 && near[c] <= widthOf[road[src[c]] - 1];
  };
  return { blocks: outBlocks, sidewalks: outWalks, isWalk };
}

// =====================================================================================================================
// 7. BUILDINGS: GUGiK LoD1 2024 footprints (data/bielany_lod1_2024.geojson, data/extract_bielany_lod1.py) with their
//    heights above the ground, and the newer buildings LoD1 misses from OpenStreetMap; outer rings counter-clockwise
//    in x/z, simplified to 0.2 m
// =====================================================================================================================
// District outlines (OSM MSI areas): their outer member ways joined end to end into rings
function districtRings() {
  const key = (p) => `${p.lon.toFixed(7)},${p.lat.toFixed(7)}`;
  return osm('districts').map((rel) => {
    const pieces = (rel.members || []).filter((m) => m.role === 'outer' && m.geometry).map((m) => m.geometry.slice());
    const rings = [];
    while (pieces.length) {
      const ring = pieces.pop();
      for (let joined = true; joined && key(ring[0]) !== key(ring[ring.length - 1]);) {
        joined = false;
        for (let k = 0; k < pieces.length; k++) {
          const p = pieces[k], end = key(ring[ring.length - 1]);
          if (key(p[0]) === end) ring.push(...p.slice(1));
          else if (key(p[p.length - 1]) === end) ring.push(...p.slice(0, -1).reverse());
          else continue;
          pieces.splice(k, 1);
          joined = true;
          break;
        }
      }
      rings.push(ring.map((g) => toWorld(g.lon, g.lat)));
    }
    return { name: rel.tags.name, rings };
  });
}

function buildBuildings() {
  const ringArea = (r) => {
    let s = 0;
    for (let k = 0, m = r.length - 1; k < r.length; m = k++) s += r[m][0] * r[k][1] - r[k][0] * r[m][1];
    return s / 2;
  };
  const out = [];
  for (const f of read(ROOT + 'data/bielany_lod1_2024.geojson').features) {
    const rings = f.geometry.coordinates.map((ring) => {
      const pts = ring.map(([lon, lat]) => toWorld(lon, lat));
      if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
      return rdpRing(pts, 0.2);
    }).filter((r) => r.length >= 3);
    if (!rings.length) continue;
    const [outer, ...holes] = rings.map((r, k) => ((ringArea(r) > 0) === (k === 0) ? r : r.slice().reverse()));
    // BDOT10k records from the original database carry Oracle-style ids (...-E053-CA2BA8C0BE14); buildings added
    // to it later get random UUIDs: newer buildings (source 2)
    const recent = !/E053-CA2BA8C0BE14$/i.test(f.properties.id || '');
    out.push([flat(outer), holes.map(flat), q(f.properties.height_m), recent ? 2 : 0]);
  }

  // Buildings newer than the LoD1 survey (2023): OpenStreetMap footprints of 100 m² or more with no LoD1 building
  // under their middle or near any corner (L- and U-shaped blocks have their middle in the courtyard), heights from
  // the `height` tag, else 3 m per storey, else 3 m for garages & sheds and 6 m for the rest
  const CELL = 50;
  const grid = new Map();
  const lod = out.map(([o]) => { const r = []; for (let k = 0; k < o.length; k += 2) r.push([o[k], o[k + 1]]); return r; });
  lod.forEach((r, i) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of r) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) {
      for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) {
        const k = `${gx},${gz}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
    }
  });
  const pointIn = (p, r) => {
    let c = false;
    for (let k = 0, m = r.length - 1; k < r.length; m = k++) {
      if ((r[k][1] > p[1]) !== (r[m][1] > p[1]) && p[0] < ((r[m][0] - r[k][0]) * (p[1] - r[k][1])) / (r[m][1] - r[k][1]) + r[k][0]) c = !c;
    }
    return c;
  };
  const onLod = (p) => (grid.get(`${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`) || []).some((i) => pointIn(p, lod[i]));
  const SKIP = new Set(['construction', 'roof', 'carport', 'ruins', 'no']);
  const LOW = new Set(['garage', 'garages', 'shed', 'service', 'outbuilding', 'kiosk', 'farm_auxiliary']);
  let added = 0;
  for (const e of osm('buildings')) {
    const t = e.tags || {};
    if (SKIP.has(t.building)) continue;
    const geom = e.type === 'way' ? [e.geometry] : (e.members || []).filter((m) => m.role === 'outer').map((m) => m.geometry);
    for (const g of geom) {
      if (!g || g.length < 4) continue;
      let r = g.map(({ lon, lat }) => toWorld(lon, lat));
      if (r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
      r = rdpRing(r, 0.2);
      if (r.length < 3) continue;
      if (ringArea(r) < 0) r.reverse();
      if (ringArea(r) < 100) continue;
      let cx = 0, cz = 0;
      for (const [x, z] of r) { cx += x; cz += z; }
      const c = [cx / r.length, cz / r.length];
      if (!inside(c)) continue;
      const probes = [c, ...r.map(([x, z]) => [x + (c[0] - x) * 0.2, z + (c[1] - z) * 0.2])].filter((p) => pointIn(p, r));
      if (probes.some(onLod)) continue;
      const levels = parseFloat(t['building:levels']);
      const h = parseFloat(t.height) > 0 ? parseFloat(t.height) : levels > 0 ? levels * 3 : LOW.has(t.building) ? 3 : 6;
      out.push([flat(r), [], q(h), 1]);
      added++;
    }
  }
  console.log('[geo-bielany]', `${out.length - added} LoD1 buildings, ${added} newer ones from OpenStreetMap`);

  // Facade type of every building (step 1.4), from its OpenStreetMap `building` tag (the OSM footprint whose middle
  // lies inside it) and its shape, since OSM has almost no construction dates here:
  //   1 niska płyta / 4 wysoka płyta: a prefab block (wielka płyta, 1960s-80s) from the original BDOT10k records — a
  //     plain, nearly rectangular slab up to 22 m deep, under / over 20 m high (4-5 / 10-12 storeys; towers of 28 m
  //     and more count as high slabs whatever their plan)
  //   5 blok z lat 50.: the old residential blocks of the 1950s quarters (Stare Bielany, Marymont, Słodowiec) under 20 m
  //   2 nowe osiedle: apartment houses added to BDOT10k later (source 2) or newer than the LoD1 survey (source 1)
  //   3 pawilon: one-storey shops & services (or untagged low boxes of a shop's size)
  //   0 the rest: houses, schools, halls, garages, the steelworks
  // and a palette by district (OSM MSI areas, tools/data/osm_bielany_districts.json): 1 bold for Chomiczówka, else 0
  const tagOf = new Array(out.length).fill(null);
  const tagArea = new Array(out.length).fill(0);
  for (const e of osm('buildings')) {
    const geom = e.type === 'way' ? e.geometry : (e.members || []).find((m) => m.role === 'outer')?.geometry;
    if (!geom || geom.length < 4) continue;
    const r = geom.map(({ lon, lat }) => toWorld(lon, lat));
    const a = Math.abs(ringArea(r));
    let cx = 0, cz = 0;
    for (const [x, z] of r) { cx += x; cz += z; }
    const c = [cx / r.length, cz / r.length];
    for (const i of grid.get(`${Math.floor(c[0] / CELL)},${Math.floor(c[1] / CELL)}`) || []) {
      if (pointIn(c, lod[i]) && a > tagArea[i]) { tagOf[i] = e.tags || {}; tagArea[i] = a; }
    }
  }
  // The smallest box around a ring, over the directions of its edges: [length, depth, how much of it the ring fills]
  const box = (r) => {
    const area = Math.abs(ringArea(r));
    let best = null;
    for (let k = 0; k < r.length; k++) {
      const [ax, az] = r[k], [bx, bz] = r[(k + 1) % r.length];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 1) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (const [x, z] of r) {
        const u = x * ux + z * uz, v = -x * uz + z * ux;
        u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
      }
      const A = (u1 - u0) * (v1 - v0);
      if (!best || A < best[3]) best = [Math.max(u1 - u0, v1 - v0), Math.min(u1 - u0, v1 - v0), area / A, A];
    }
    return best || [0, 0, 0, 1];
  };
  const SHOPS = new Set(['retail', 'commercial', 'kiosk', 'supermarket', 'service', 'yes', 'office']);
  const HOMES = new Set(['house', 'detached', 'semidetached_house', 'terrace', 'villa', 'bungalow']);
  // The 1950s quarters (osiedla Bielany I-IV, Marymont): their old residential blocks are brick, not prefab
  const FIFTIES = new Set(['Stare Bielany', 'Marymont-Kaskada', 'Słodowiec']);
  // Palettes: 0 pastel (Wawrzyszew, Młociny, Wrzeciono...: a pastel per staircase after the insulation), 1 bold
  // (Chomiczówka: blue, yellow, red & lime bands)
  const BOLD = new Set(['Chomiczówka']);
  const districts = districtRings();
  const districtAt = (p) => (districts.find((d) => d.rings.some((r) => pointIn(p, r))) || {}).name;
  const counts = [0, 0, 0, 0, 0, 0];
  out.forEach((bd, i) => {
    const r = [];
    for (let k = 0; k < bd[0].length; k += 2) r.push([bd[0][k], bd[0][k + 1]]);
    const t = tagOf[i] || {};
    const kind = t.building;
    const [len, depth, fill] = box(r);
    const h = bd[2];
    let cx = 0, cz = 0;
    for (const [x, z] of r) { cx += x; cz += z; }
    const district = districtAt([cx / r.length, cz / r.length]);
    let type = 0;
    if (h <= 7 && depth >= 6 && (SHOPS.has(kind) || (!kind && len * depth >= 80 && len * depth <= 3000))) type = 3;
    else if (HOMES.has(kind) || h < 9) type = 0;
    else if (kind === 'apartments' || kind === 'residential' || !kind || kind === 'yes') {
      const slab = (fill >= 0.85 && depth >= 9 && depth <= 22 && r.length <= 16) || h >= 28;
      if (bd[3] !== 0) type = kind === 'apartments' || kind === 'residential' || len * depth < 2500 ? 2 : 0;
      else if (FIFTIES.has(district) && h < 20) type = 5;
      else if (slab) type = h >= 20 ? 4 : 1;
    }
    bd.push(type, BOLD.has(district) ? 1 : 0);
    counts[type]++;
  });
  console.log('[geo-bielany]', `facade types: ${counts[1]} niskie płyty, ${counts[4]} wysokie płyty, ${counts[5]} bloki z lat 50., ` +
    `${counts[2]} nowe osiedla, ${counts[3]} pawilony, ${counts[0]} inne`);
  return out;
}

// =====================================================================================================================
// 8. POINTS: metro stations (spawn & teleports later)
// =====================================================================================================================
// Trees: GUGiK 3D tree models LoD1 2023 (data/bielany_trees_2023.json, data/extract_bielany_trees.py): [x, z, height,
// crown base (trunk height), crown radius], m; none if the cut-out is missing
const TREES_FILE = ROOT + 'data/bielany_trees_2023.json';
const trees = fs.existsSync(TREES_FILE)
  ? read(TREES_FILE).trees.flatMap(([lon, lat, h, base, r]) => {
    const [x, z] = toWorld(lon, lat);
    return inside([x, z]) ? [q(x), q(z), h, base, r] : [];
  })
  : [];

// Traffic signals (OSM highway=traffic_signals nodes; at a junction or on its approaches): road-network.js signals the
// junctions they stand at
const signals = osm('signals').filter((e) => e.type === 'node' && e.tags?.highway === 'traffic_signals')
  .map((e) => toWorld(e.lon, e.lat)).filter(inside).flatMap(([x, z]) => [q(x), q(z)]);

// District names for the maps (OSM MSI areas): at the middle of each district's part inside the MVP area (the mean of
// a 50 m grid of points in it); districts with under 0.15 km² inside are left out
const districtLabels = districtRings().flatMap(({ name, rings }) => {
  const inRing = (p, r) => {
    let c = false;
    for (let k = 0, m = r.length - 1; k < r.length; m = k++) {
      if ((r[k][1] > p[1]) !== (r[m][1] > p[1]) && p[0] < ((r[m][0] - r[k][0]) * (p[1] - r[k][1])) / (r[m][1] - r[k][1]) + r[k][0]) c = !c;
    }
    return c;
  };
  let x = 0, z = 0, n = 0;
  for (let px = X0 + 25; px < X1; px += 50) {
    for (let pz = Z0 + 25; pz < Z1; pz += 50) {
      if (rings.some((r) => inRing([px, pz], r))) { x += px; z += pz; n++; }
    }
  }
  return n >= 60 ? [[name, q(x / n), q(z / n)]] : [];
});

const stations = osm('rail')
  .filter((e) => e.type === 'node' && e.tags?.station === 'subway' && e.tags?.name)
  .map((e) => { const [x, z] = toWorld(e.lon, e.lat); return { name: e.tags.name, x: q(x), z: q(z) }; })
  .filter((s) => inside([s.x, s.z]));

// =====================================================================================================================
// 9. ADDRESSES (OpenStreetMap addr:*): each street + number once, at its building (the door end of a delivery) and at
//    the sidewalk spot in front of it on its own street (where a courier stops): the point of the nearest stretch of
//    the named street, stepped from the curb towards the building to the first sidewalk cell
// =====================================================================================================================
const ADDR_MAX = 150; // m from the building to its street; farther addresses (deep in a courtyard, a lost tag) are left out
function buildAddresses(graph, isWalk, sidewalks) {
  const { nodes, links, names } = graph;
  // A spot counts when its 1 m cell and the cells half a metre around are sidewalk and it lies inside a simplified
  // sidewalk outline (what the game walks on): outlines indexed on a 50 m grid
  const GRID = 50, grid = new Map();
  const inRing = (x, z, r) => {
    let c = false;
    for (let k = 0, m = r.length - 2; k < r.length; m = k, k += 2) {
      if ((r[k + 1] > z) !== (r[m + 1] > z) && x < ((r[m] - r[k]) * (z - r[k + 1])) / (r[m + 1] - r[k + 1]) + r[k]) c = !c;
    }
    return c;
  };
  sidewalks.forEach(([, outer], n) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < outer.length; k += 2) {
      x0 = Math.min(x0, outer[k]); x1 = Math.max(x1, outer[k]); z0 = Math.min(z0, outer[k + 1]); z1 = Math.max(z1, outer[k + 1]);
    }
    for (let gx = Math.floor(x0 / GRID); gx <= Math.floor(x1 / GRID); gx++) {
      for (let gz = Math.floor(z0 / GRID); gz <= Math.floor(z1 / GRID); gz++) {
        const k = `${gx},${gz}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(n);
      }
    }
  });
  const onOutline = (x, z) => (grid.get(`${Math.floor(x / GRID)},${Math.floor(z / GRID)}`) || [])
    .some((n) => inRing(x, z, sidewalks[n][1]) && !sidewalks[n][2].some((h) => inRing(x, z, h)));
  const good = (x, z) => isWalk(x, z) && isWalk(x + 0.5, z) && isWalk(x - 0.5, z) && isWalk(x, z + 0.5) && isWalk(x, z - 0.5) && onOutline(x, z);
  // The main network (links both ways): addresses by streets cut off from it could not be driven to
  const parent = Array.from({ length: nodes.length / 2 }, (_, i) => i);
  const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (const [a, b] of links) parent[root(a)] = root(b);
  const size = new Map();
  for (let i = 0; i < parent.length; i++) size.set(root(i), (size.get(root(i)) || 0) + 1);
  const main = [...size].sort((p, r) => r[1] - p[1])[0][0];
  // Every stretch of the main network as [ax, az, bx, bz, name index, half width]
  const segs = [];
  for (const [a, b, name, w, , , inner] of links) {
    if (root(a) !== main) continue;
    const pts = [nodes[2 * a], nodes[2 * a + 1], ...inner, nodes[2 * b], nodes[2 * b + 1]];
    for (let k = 0; k + 3 < pts.length; k += 2) segs.push([pts[k], pts[k + 1], pts[k + 2], pts[k + 3], name, w / 2]);
  }
  const closest = (x, z, ok) => {
    let best = null, bd = Infinity;
    for (const sg of segs) {
      if (!ok(sg)) continue;
      const [ax, az, bx, bz] = sg, vx = bx - ax, vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1e-9)));
      const px = ax + vx * t, pz = az + vz * t, d = Math.hypot(x - px, z - pz);
      if (d < bd) { bd = d; best = { px, pz, d, half: sg[5] }; }
    }
    return best;
  };
  // street + number -> the building's centre (a building outline wins over a shop or entrance node)
  const seen = new Map();
  for (const e of osm('addresses')) {
    const t = e.tags || {};
    const street = t['addr:street'] || t['addr:place'], num = t['addr:housenumber'];
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (!street || !num || lat == null) continue;
    const [x, z] = toWorld(lon, lat);
    if (!inside([x, z])) continue;
    const k = `${street}|${num.toLowerCase()}`, isBuilding = e.type !== 'node' && !!t.building;
    if (!seen.has(k) || (isBuilding && !seen.get(k).isBuilding)) seen.set(k, { street, num, x, z, isBuilding });
  }
  const streetNames = [];
  const streetIds = new Map();
  const out = [];
  let far = 0, noWalk = 0;
  for (const a of seen.values()) {
    const id = names.indexOf(a.street);
    const hit = id >= 0 ? closest(a.x, a.z, (sg) => sg[4] === id) : null;
    if (!hit || hit.d > ADDR_MAX) { far++; continue; }
    // from the curb towards the building, 0.5 m steps, to the first sidewalk cell
    const ux = (a.x - hit.px) / (hit.d || 1), uz = (a.z - hit.pz) / (hit.d || 1);
    let spot = null;
    for (let s = hit.half; s <= Math.min(hit.d, hit.half + 12); s += 0.5) {
      const x = hit.px + ux * s, z = hit.pz + uz * s;
      if (good(x, z)) { spot = [x, z]; break; }
    }
    // else the sidewalk cell nearest that stretch of curb (a narrow walk, a driveway cut in front of the door)
    for (let r = 1; !spot && r <= 15; r += 1) {
      let bd = Infinity;
      for (let k = 0; k < 8 * r; k++) {
        const ang = (k / (8 * r)) * Math.PI * 2, x = hit.px + Math.cos(ang) * (hit.half + r), z = hit.pz + Math.sin(ang) * (hit.half + r);
        const d = Math.hypot(x - a.x, z - a.z);
        if (d < bd && good(x, z)) { bd = d; spot = [x, z]; }
      }
    }
    if (!spot) { noWalk++; continue; }
    if (!streetIds.has(a.street)) { streetIds.set(a.street, streetNames.length); streetNames.push(a.street); }
    out.push([streetIds.get(a.street), a.num, q(a.x), q(a.z), q(spot[0]), q(spot[1])]);
  }
  out.sort((p, r) => streetNames[p[0]].localeCompare(streetNames[r[0]], 'pl') || p[1].localeCompare(r[1], 'pl', { numeric: true }));
  log(`addresses: ${seen.size} in the area, ${out.length} with a sidewalk spot (${far} without their street within ${ADDR_MAX} m, ${noWalk} without a sidewalk in front)`);
  return { streets: streetNames, list: out };
}

// =====================================================================================================================
// 9b. TRAMS (OpenStreetMap railway=tram): every track for the rails on the street, and the tram routes the game runs:
//     from a stop at one end to a stop at the other along the tracks (depot tracks left out), the way back on the other
//     track (its edges cost four times as much, so it takes the parallel one), the stops on each track in order
// =====================================================================================================================
// each route: its stops to pass, in order (the line along Marymoncka, the one from Bemowo along Wólczyńska, the one
// from Żoliborz through Piaski)
const TRAM_ROUTES = [
  ['Metro Marymont', 'AWF', 'UKSW', 'Cmentarz Włoski'], // its tracks do not join the Młociny loop (OSM)
  ['Piastów Śląskich', 'Metro Młociny'],
  ['Plac Grunwaldzki', 'Piaski', 'Metro Młociny'],
];
function buildTrams() {
  const rail = osm('rail');
  const nearArea = (p) => p[0] >= X0 - 800 && p[0] <= X1 + 800 && p[1] >= Z0 - 800 && p[1] <= Z1 + 800;
  const key = (g) => `${g.lon.toFixed(7)},${g.lat.toFixed(7)}`;
  const ids = new Map(), pos = [], adj = [];
  const nodeOf = (g) => {
    const k = key(g);
    if (!ids.has(k)) {
      ids.set(k, pos.length);
      pos.push(toWorld(g.lon, g.lat));
      adj.push([]);
    }
    return ids.get(k);
  };
  const tracks = [];
  for (const w of rail) {
    if (w.type !== 'way' || w.tags?.railway !== 'tram' || !w.geometry) continue;
    const pts = w.geometry.map((g) => toWorld(g.lon, g.lat));
    const inPts = pts.filter((p) => inside(p));
    if (inPts.length >= 2) tracks.push(flat(rdp(inPts, 0.15)));
    if (w.tags.service) continue; // yards and sidings: rails only
    for (let i = 1; i < w.geometry.length; i++) {
      const a = nodeOf(w.geometry[i - 1]), b = nodeOf(w.geometry[i]);
      // a line may leave the area and come back (Marymoncka round the north edge): js/trams.js hides trams out there
      if (!nearArea(pos[a]) || !nearArea(pos[b])) continue;
      const d = Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]);
      adj[a].push([b, d]);
      adj[b].push([a, d]);
    }
  }
  const stops = rail.filter((e) => e.type === 'node' && e.tags?.railway === 'tram_stop' && e.tags.name && ids.has(key(e)))
    .map((e) => ({ name: e.tags.name.replace(/\s+\d+$/, ''), node: ids.get(key(e)) }));
  const ekey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  function dijkstra(from, to, penal) {
    const dist = new Float64Array(pos.length).fill(Infinity), prev = new Int32Array(pos.length).fill(-1);
    dist[from] = 0;
    const heap = [[0, from]];
    while (heap.length) {
      let bi = 0;
      for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
      const [d, n] = heap.splice(bi, 1)[0];
      if (d > dist[n]) continue;
      if (n === to) break;
      for (const [m, w] of adj[n]) {
        const c = d + w * (penal.has(ekey(n, m)) ? 4 : 1);
        if (c < dist[m]) { dist[m] = c; prev[m] = n; heap.push([c, m]); }
      }
    }
    if (!Number.isFinite(dist[to])) return null;
    const path = [];
    for (let n = to; n >= 0; n = prev[n]) path.push(n);
    return path.reverse();
  }
  const routes = [];
  // A path through the waypoints in order: from the start's stops, at each waypoint the stop nearest along the track
  function chain(names, penal) {
    let best = null;
    for (const start of stops.filter((s) => s.name === names[0])) {
      let path = [start.node], ok = true;
      for (let k = 1; k < names.length && ok; k++) {
        let leg = null;
        for (const t of stops.filter((s) => s.name === names[k])) {
          const p = dijkstra(path[path.length - 1], t.node, penal);
          if (p && (!leg || pathLen(p) < pathLen(leg))) leg = p;
        }
        if (!leg) ok = false;
        else path = path.concat(leg.slice(1));
      }
      if (ok && (!best || pathLen(path) < pathLen(best))) best = path;
    }
    return best;
  }
  for (const names of TRAM_ROUTES) {
    const there = chain(names, new Set());
    if (!there) { log(`tram route ${names.join(' - ')}: no path`); continue; }
    const used = new Set();
    for (let i = 1; i < there.length; i++) used.add(ekey(there[i - 1], there[i]));
    const back = chain(names.slice().reverse(), used); // on the other track
    const a = names[0], b = names[names.length - 1];
    for (const [name, path] of [[`${a} – ${b}`, there], [`${b} – ${a}`, back]]) {
      if (!path) continue;
      const onPath = new Map(path.map((n, i) => [n, i]));
      const cum = [0];
      for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(pos[path[i]][0] - pos[path[i - 1]][0], pos[path[i]][1] - pos[path[i - 1]][1]));
      const routeStops = stops.filter((s) => onPath.has(s.node)).map((s) => [q(cum[onPath.get(s.node)]), s.name])
        .sort((x, y) => x[0] - y[0]);
      routes.push({ name, pts: flat(path.map((n) => pos[n])), stops: routeStops, length: q(cum[cum.length - 1]) });
    }
  }
  function pathLen(p) {
    let l = 0;
    for (let i = 1; i < p.length; i++) l += Math.hypot(pos[p[i]][0] - pos[p[i - 1]][0], pos[p[i]][1] - pos[p[i - 1]][1]);
    return l;
  }
  for (const r of routes) log(`tram ${r.name}: ${(r.length / 1000).toFixed(1)} km, ${r.stops.length} stops (${r.stops.map((x) => x[1]).join(', ')})`);
  return { tracks, routes };
}

// =====================================================================================================================
// 10. OUTPUT
// =====================================================================================================================
const roadGraph = buildRoadGraph();
const { blocks, sidewalks, isWalk } = buildBlocks(roadGraph);
const addresses = buildAddresses(roadGraph, isWalk, sidewalks);
const trams = buildTrams();

const GEO = {
  version: 1,
  frame: {
    bearingDeg: 0, units: 'm', origin: { name: 'Stare Bielany (stacja metra)', lat: LAT0, lon: LON0 },
    bbox: BBOX, bounds: { minX: q(X0), maxX: q(X1), minZ: q(Z0), maxZ: q(Z1) }
  },
  // [name, curb-to-curb width, direction (1: along the points, -1: against, 0: both), travel lanes, trunk road, flat
  // points [x, z, ...], class (trunk, primary, secondary, tertiary, local, living, service, pedestrian)]
  roads: mergeRoads(),
  // Drivable street graph: nodes [x, z, ...], links [node a, node b, name index, curb-to-curb width, travel lanes,
  // direction (1: a -> b, -1: b -> a, 0: both), inner shape points [x, z, ...], class, 1 on a roundabout, speed limit
  // km/h]
  roadGraph,
  // Blocks (curb islands between the roadways): [outer ring [x, z, ...], holes [[x, z, ...], ...], area m²]
  blocks,
  // Sidewalks along the curbs: [block index, outer ring, holes]
  sidewalks,
  // Traffic signals [x, z, ...]
  signals,
  // District names for the maps: [name, x, z]
  districts: districtLabels,
  // Trees (GUGiK LoD1 2023, CC BY 4.0): [x, z, height, crown base, crown radius, ...] flat, m
  trees,
  // Buildings: [outer ring [x, z, ...], holes, height above the ground m, source (0: GUGiK LoD1 2024, CC BY 4.0;
  // 2: the same, a record added to BDOT10k later; 1: OpenStreetMap, ODbL), facade type (0: other, 1: niska płyta,
  // 2: nowe osiedle, 3: pawilon, 4: wysoka płyta, 5: blok z lat 50.), palette (0: pastel, 1: bold)]
  buildings: buildBuildings(),
  stations,
  // Trams (OpenStreetMap): tracks [flat points, ...] for the rails, routes [{ name, pts flat, stops [[s, name], ...],
  // length }] (each direction its own route, on its own track)
  trams,
  // Addresses (OpenStreetMap): streets [name, ...] and list [street index, number, building x, z, sidewalk spot x, z]
  addresses,
};

const json = JSON.stringify(GEO);
const header = `// js/bielany-geodata.js — GENERATED by tools/geo-bielany.mjs, do not edit by hand.
// Warsaw Bielany (Stare Bielany, Wawrzyszew, Młociny) in the simulation's world frame: 1 unit = 1 m, x = east,
// z = south (north = -z), origin at the Stare Bielany metro station, no rotation. Polylines are flat [x0, z0, ...].
// Sources: © OpenStreetMap contributors (ODbL), via Overpass; buildings & trees GUGiK, geoportal.gov.pl (LoD1 2024,
// LoD1 2023, CC BY 4.0).
`;
fs.writeFileSync(OUT, `${header}export const GEO = ${json};\n`);
log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB): ${GEO.roads.length} roads, ` +
  `${GEO.roadGraph.nodes.length / 2} nodes, ${GEO.roadGraph.links.length} links, ${GEO.blocks.length} blocks, ` +
  `${GEO.sidewalks.length} sidewalks, ${GEO.signals.length / 2} signals, ${GEO.trees.length / 5} trees, ${GEO.buildings.length} buildings, ${GEO.stations.length} stations, ${GEO.addresses.list.length} addresses`);
