// tools/geo-bielany.mjs
// Builds js/bielany-geodata.js: the Bielany MVP area (Stare Bielany, Wawrzyszew, Młociny) in the simulation's world
// frame (tools/bielany-frame.mjs: 1 unit = 1 m, x = east, z = south, origin at the Stare Bielany metro station, no
// rotation). Step 1.1: streets only. The output keeps the shapes of js/nyc-geodata.js (roads, roadGraph) so the city
// modules can switch over in step 1.2a.
//
// Inputs: tools/data/osm_bielany_streets.json and osm_bielany_rail.json (OpenStreetMap via Overpass, see
// tools/overpass.sh and tools/data/q_bielany_*.overpassql)
//
// usage: node tools/geo-bielany.mjs [outFile]

import fs from 'node:fs';
import { ROOT, osm, BBOX, BOUNDS, LAT0, LON0, toWorld } from './bielany-frame.mjs';

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
// 6. POINTS: metro stations (spawn & teleports later)
// =====================================================================================================================
const stations = osm('rail')
  .filter((e) => e.type === 'node' && e.tags?.station === 'subway' && e.tags?.name)
  .map((e) => { const [x, z] = toWorld(e.lon, e.lat); return { name: e.tags.name, x: q(x), z: q(z) }; })
  .filter((s) => inside([s.x, s.z]));

// =====================================================================================================================
// 7. OUTPUT
// =====================================================================================================================
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
  roadGraph: buildRoadGraph(),
  stations,
};

const json = JSON.stringify(GEO);
const header = `// js/bielany-geodata.js — GENERATED by tools/geo-bielany.mjs, do not edit by hand.
// Warsaw Bielany (Stare Bielany, Wawrzyszew, Młociny) in the simulation's world frame: 1 unit = 1 m, x = east,
// z = south (north = -z), origin at the Stare Bielany metro station, no rotation. Polylines are flat [x0, z0, ...].
// Source: © OpenStreetMap contributors (ODbL), via Overpass.
`;
fs.writeFileSync(OUT, `${header}export const GEO = ${json};\n`);
log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB): ${GEO.roads.length} roads, ` +
  `${GEO.roadGraph.nodes.length / 2} nodes, ${GEO.roadGraph.links.length} links, ${GEO.stations.length} stations`);
