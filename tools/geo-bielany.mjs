// tools/geo-bielany.mjs
// Builds js/bielany-geodata.js: the Bielany MVP area (Stare Bielany, Wawrzyszew, Młociny) in the simulation's world
// frame (tools/bielany-frame.mjs: 1 unit = 1 m, x = east, z = south, origin at the Stare Bielany metro station, no
// rotation): the streets (map lines and the drivable graph), the blocks between them with their sidewalks, the
// buildings, the M1 stations.
//
// Inputs: tools/data/osm_bielany_streets.json and osm_bielany_rail.json (OpenStreetMap via Overpass, see
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
  return { name: tags.name || '', code, dir, lanes, w: q(w), drivable: code !== 'pedestrian' };
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
      links.push([a, b, nameId(r.name), r.w, r.lanes, r.dir, flat(inner), r.code]);
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
  return { blocks: outBlocks, sidewalks: outWalks };
}

// =====================================================================================================================
// 7. BUILDINGS: GUGiK LoD1 2024 footprints (data/bielany_lod1_2024.geojson, data/extract_bielany_lod1.py) with their
//    heights above the ground; outer rings counter-clockwise in x/z, simplified to 0.2 m
// =====================================================================================================================
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
    out.push([flat(outer), holes.map(flat), q(f.properties.height_m)]);
  }
  return out;
}

// =====================================================================================================================
// 8. POINTS: metro stations (spawn & teleports later)
// =====================================================================================================================
const stations = osm('rail')
  .filter((e) => e.type === 'node' && e.tags?.station === 'subway' && e.tags?.name)
  .map((e) => { const [x, z] = toWorld(e.lon, e.lat); return { name: e.tags.name, x: q(x), z: q(z) }; })
  .filter((s) => inside([s.x, s.z]));

// =====================================================================================================================
// 9. OUTPUT
// =====================================================================================================================
const roadGraph = buildRoadGraph();
const { blocks, sidewalks } = buildBlocks(roadGraph);
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
  // direction (1: a -> b, -1: b -> a, 0: both), inner shape points [x, z, ...], class]
  roadGraph,
  // Blocks (curb islands between the roadways): [outer ring [x, z, ...], holes [[x, z, ...], ...], area m²]
  blocks,
  // Sidewalks along the curbs: [block index, outer ring, holes]
  sidewalks,
  // Buildings (GUGiK LoD1 2024, CC BY 4.0): [outer ring [x, z, ...], holes, height above the ground m]
  buildings: buildBuildings(),
  stations,
};

const json = JSON.stringify(GEO);
const header = `// js/bielany-geodata.js — GENERATED by tools/geo-bielany.mjs, do not edit by hand.
// Warsaw Bielany (Stare Bielany, Wawrzyszew, Młociny) in the simulation's world frame: 1 unit = 1 m, x = east,
// z = south (north = -z), origin at the Stare Bielany metro station, no rotation. Polylines are flat [x0, z0, ...].
// Sources: © OpenStreetMap contributors (ODbL), via Overpass; buildings GUGiK, geoportal.gov.pl (LoD1 2024, CC BY 4.0).
`;
fs.writeFileSync(OUT, `${header}export const GEO = ${json};\n`);
log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB): ${GEO.roads.length} roads, ` +
  `${GEO.roadGraph.nodes.length / 2} nodes, ${GEO.roadGraph.links.length} links, ${GEO.blocks.length} blocks, ` +
  `${GEO.sidewalks.length} sidewalks, ${GEO.buildings.length} buildings, ${GEO.stations.length} stations`);
