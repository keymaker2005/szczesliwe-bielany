// js/bridges.js
// Bridges of Bielany (step 3.3): the Skłodowska-Curie bridge over the Vistula with its approaches, and the viaducts of
// the expressway and the valley roads (OpenStreetMap bridge=yes, js/bielany-geodata.js GEO.bridges). The pieces of
// one bridge are joined by their shared ends into a deck; the deck starts and ends on the ground (js/terrain.js) where
// it meets the streets, and in between it lies on the line between those ends, raised by a gentle hump (6 % up from
// each end, at most 6 m); over another road or the water it stands 6 m high where a climb of 12 % from its ends allows
// (an end never leaves its street).
// deckY answers where a deck is; the traffic on a bridge edge, the player arriving along the road and the people
// crossing the river use it, everything under the bridge keeps to the ground.

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GEO } from './bielany-geodata.js';
import { ISLAND_BOUNDS } from './city-config.js';
import { createRoadSurfaceMaterial } from './tsl-materials.js';
import { groundY } from './terrain.js';

const STEP = 4; // m: decks are cut into pieces this long (heights, geometry)
const RISE = 0.06; // the hump's slope from each end
const HUMP = 6; // m, the hump's height at most
const WALK = 3.2; // m of sidewalk on each side of the roadway
const GIRDER = 1.0; // m from the deck surface to its underside
const RAIL = 1.1; // m, the railing
const PIER_EVERY = 40; // m between piers
const CELL = 32; // m, the lookup grid
const CLEAR = 6; // m from a road (or the water) under a deck to the deck's surface (5 m under its girders)
const RAMP = 0.12; // the steepest a deck climbs to clear what is under it (the plateau's embankments are flattened, so
// the decks over Marymoncka by the Skłodowska-Curie bridge rise from street level)

let decks = null; // [{ w, kind, pts: [{ x, z, y }] }] (kind 0: a road, 1: a tram track)
let grid = null;

const key = (x, z) => `${Math.round(x * 2)},${Math.round(z * 2)}`;

function inRing(r, x, z) {
  let c = false;
  for (let k = 0, m = r.length - 2; k < r.length; m = k, k += 2) {
    const xi = r[k], zi = r[k + 1], xj = r[m], zj = r[m + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
const waters = (GEO.water || []).filter(([kind]) => kind === 0).map(([, outer, holes]) => {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let k = 0; k < outer.length; k += 2) {
    x0 = Math.min(x0, outer[k]); x1 = Math.max(x1, outer[k]); z0 = Math.min(z0, outer[k + 1]); z1 = Math.max(z1, outer[k + 1]);
  }
  return { outer, holes, box: [x0, z0, x1, z1] };
});

/** Is (x, z) on water (the Vistula, a pond)? */
function overWater(x, z) {
  for (const w of waters) {
    const b = w.box;
    if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue;
    if (inRing(w.outer, x, z) && !w.holes.some((h) => inRing(h, x, z))) return true;
  }
  return false;
}

// Does a road that is not on a bridge pass under (x, z) across a deck running (dx, dz)? (its roadway within 2 m, at
// more than 30° to the deck: a street alongside the deck's end is the one it lands on)
let under = null;
function roadUnder(x, z, dx, dz) {
  if (!under) {
    under = new Map();
    const RG = GEO.roadGraph;
    for (const l of RG?.links || []) {
      if (l[10]) continue; // itself on a bridge
      const pts = [RG.nodes[l[0] * 2], RG.nodes[l[0] * 2 + 1], ...l[6], RG.nodes[l[1] * 2], RG.nodes[l[1] * 2 + 1]];
      for (let k = 2; k < pts.length; k += 2) {
        const seg = [pts[k - 2], pts[k - 1], pts[k], pts[k + 1], l[3] / 2 + 2];
        for (let gx = Math.floor((Math.min(seg[0], seg[2]) - 12) / CELL); gx <= Math.floor((Math.max(seg[0], seg[2]) + 12) / CELL); gx++) {
          for (let gz = Math.floor((Math.min(seg[1], seg[3]) - 12) / CELL); gz <= Math.floor((Math.max(seg[1], seg[3]) + 12) / CELL); gz++) {
            const key = gx * 100000 + gz;
            if (!under.has(key)) under.set(key, []);
            under.get(key).push(seg);
          }
        }
      }
    }
  }
  const dl = Math.hypot(dx, dz) || 1;
  for (const [ax, az, bx, bz, r] of under.get(Math.floor(x / CELL) * 100000 + Math.floor(z / CELL)) || []) {
    const sx = bx - ax, sz = bz - az, l2 = sx * sx + sz * sz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * sx + (z - az) * sz) / l2));
    if (Math.hypot(x - ax - sx * t, z - az - sz * t) >= r) continue;
    if (Math.abs(sx * dx + sz * dz) / (Math.sqrt(l2) * dl) < 0.87) return true;
  }
  return false;
}

// The decks with their heights, once (after the terrain has loaded)
function build() {
  const pieces = (GEO.bridges || []).map(([w, flat, kind = 0]) => {
    const pts = [];
    for (let k = 0; k < flat.length; k += 2) {
      const x = flat[k], z = flat[k + 1];
      if (pts.length) {
        const p = pts[pts.length - 1], n = Math.ceil(Math.hypot(x - p.x, z - p.z) / STEP);
        for (let s = 1; s < n; s++) pts.push({ x: p.x + ((x - p.x) * s) / n, z: p.z + ((z - p.z) * s) / n });
      }
      pts.push({ x, z });
    }
    return { w, kind, pts };
  });
  // the graph of all deck points, shared ends joined
  const nodes = new Map(), adj = new Map();
  const nodeOf = (p, kind) => {
    const k = `${kind}:${key(p.x, p.z)}`; // the road and tram decks are joined each on their own
    if (!nodes.has(k)) { nodes.set(k, { x: p.x, z: p.z }); adj.set(k, []); }
    return k;
  };
  for (const pc of pieces) {
    pc.keys = pc.pts.map((p) => nodeOf(p, pc.kind));
    for (let i = 1; i < pc.keys.length; i++) {
      const a = pc.keys[i - 1], b = pc.keys[i], d = Math.hypot(pc.pts[i].x - pc.pts[i - 1].x, pc.pts[i].z - pc.pts[i - 1].z);
      adj.get(a).push([b, d]);
      adj.get(b).push([a, d]);
    }
  }
  const B = ISLAND_BOUNDS;
  const atEdge = (n) => n.x - B.minX < 3 || B.maxX - n.x < 3 || n.z - B.minZ < 3 || B.maxZ - n.z < 3;
  // components, their ends (where a deck meets the streets: a point with one neighbour), heights from the ends
  const seen = new Set();
  for (const start of nodes.keys()) {
    if (seen.has(start)) continue;
    const comp = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const k = stack.pop();
      comp.push(k);
      for (const [n] of adj.get(k)) if (!seen.has(n)) { seen.add(n); stack.push(n); }
    }
    let ends = comp.filter((k) => new Set(adj.get(k).map(([n]) => n)).size === 1);
    const inside = ends.filter((k) => !atEdge(nodes.get(k)));
    if (inside.length >= 2) ends = inside; // a deck cut by the map's edge rests on its ends inside
    if (!ends.length) ends = [comp[0]];
    const dists = ends.map((e) => {
      const d = new Map([[e, 0]]);
      const queue = [[0, e]];
      while (queue.length) {
        queue.sort((p, q) => q[0] - p[0]);
        const [dk, k] = queue.pop();
        if (dk > d.get(k)) continue;
        for (const [n, w] of adj.get(k)) {
          const nd = dk + w;
          if (nd < (d.get(n) ?? Infinity)) { d.set(n, nd); queue.push([nd, n]); }
        }
      }
      return d;
    });
    const endY = ends.map((e) => groundY(nodes.get(e).x, nodes.get(e).z));
    for (const k of comp) {
      let sw = 0, sy = 0, near = Infinity;
      dists.forEach((d, i) => {
        const dk = d.get(k) ?? Infinity;
        near = Math.min(near, dk);
        const w = 1 / Math.max(1, dk) ** 2;
        sw += w;
        sy += w * endY[i];
      });
      nodes.get(k).base = sy / sw; // on the line between the ends
      nodes.get(k).y = sy / sw + Math.min(near * RISE, HUMP);
    }
    // clearance over the roads and the water below, then no steeper than RAMP towards it (from every such point, along
    // the deck)
    // (not within 15 m of the deck's ends: there the road under it is the street it lands on)
    const need = new Map();
    for (const k of comp) {
      const n = nodes.get(k);
      const fromEnd = Math.min(...dists.map((d) => d.get(k) ?? Infinity));
      const o = nodes.get(adj.get(k)[0]?.[0]) || n;
      // never above what a RAMP climb from the nearest end allows: the ends stay on their streets
      if (fromEnd > 15 && (overWater(n.x, n.z) || roadUnder(n.x, n.z, o.x - n.x, o.z - n.z))) {
        need.set(k, Math.min(groundY(n.x, n.z) + CLEAR, n.base + fromEnd * RAMP));
      }
    }
    if (need.size) {
      const best = new Map([...need]);
      const queue = [...need].map(([k, y]) => [y, k]);
      while (queue.length) {
        queue.sort((p, q) => p[0] - q[0]);
        const [yk, k] = queue.pop();
        if (yk < (best.get(k) ?? -Infinity)) continue;
        for (const [n, w] of adj.get(k)) {
          const yn = yk - w * RAMP;
          if (yn > (best.get(n) ?? -Infinity)) { best.set(n, yn); queue.push([yn, n]); }
        }
      }
      for (const [k, y] of best) nodes.get(k).y = Math.max(nodes.get(k).y, y);
    }
  }
  decks = pieces.map((pc) => ({ w: pc.w, kind: pc.kind, pts: pc.keys.map((k, i) => ({ x: pc.pts[i].x, z: pc.pts[i].z, y: nodes.get(k).y })) }));
  grid = new Map();
  decks.forEach((d, di) => {
    const r = d.w / 2 + WALK;
    for (let i = 1; i < d.pts.length; i++) {
      const a = d.pts[i - 1], b = d.pts[i];
      for (let gx = Math.floor((Math.min(a.x, b.x) - r) / CELL); gx <= Math.floor((Math.max(a.x, b.x) + r) / CELL); gx++) {
        for (let gz = Math.floor((Math.min(a.z, b.z) - r) / CELL); gz <= Math.floor((Math.max(a.z, b.z) + r) / CELL); gz++) {
          const k = gx * 100000 + gz;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push([di, i]);
        }
      }
    }
  });
}

const walkOf = (d) => (d.kind ? 0.6 : WALK); // a tram deck has a narrow ledge, no sidewalks

/** Height of a bridge deck of this kind (0: a road, 1: a tram track) at (x, z), null where there is none */
function deckY(x, z, kind = 0) {
  if (!decks) build();
  let best = null, bestD = Infinity;
  for (const [di, i] of grid.get(Math.floor(x / CELL) * 100000 + Math.floor(z / CELL)) || []) {
    const d = decks[di], a = d.pts[i - 1], b = d.pts[i];
    if (d.kind !== kind) continue;
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    const off = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    if (off > d.w / 2 + walkOf(d) || off >= bestD) continue;
    bestD = off;
    best = a.y + (b.y - a.y) * t;
  }
  return best;
}

/**
 * The surface under a body at (x, z) that was at height fromY: the deck when it is up there already (within 0.6 m:
 * arrived along the bridge from its end, where the deck meets the ground) or the ground is water, else the ground
 */
function surfaceY(x, z, fromY = -Infinity) {
  const g = groundY(x, z);
  const d = deckY(x, z);
  if (d === null || d - g < 0.05) return g;
  // up there already: within 0.6 m of the deck (a deck rises gently from its ends, so a body arriving along it keeps
  // to it; one passing under even a low viaduct stays on the ground)
  return fromY > d - 0.6 || overWater(x, z) ? d : g;
}

/** Deck pose under a vehicle on a bridge (as terrain.js groundPose), of a road deck or a tram deck (kind 1) */
function deckPose(x, z, sin, cos, halfLen, halfWidth, out = {}, kind = 0) {
  const at = (px, pz) => deckY(px, pz, kind) ?? groundY(px, pz);
  out.y = at(x, z);
  const front = at(x + sin * halfLen, z + cos * halfLen), back = at(x - sin * halfLen, z - cos * halfLen);
  const left = at(x + cos * halfWidth, z - sin * halfWidth), right = at(x - cos * halfWidth, z + sin * halfWidth);
  out.pitch = -Math.atan2(front - back, 2 * halfLen);
  out.roll = Math.atan2(left - right, 2 * halfWidth);
  return out;
}

// A strip along a deck between two offsets from its centreline, from height y0 to y1 above (or below) the deck:
// flat (y0 === y1, facing up) or a wall (facing outwards: the side of `o1`)
function deckStrip(out, d, o0, o1, y0, y1) {
  for (let i = 1; i < d.pts.length; i++) {
    const a = d.pts[i - 1], b = d.pts[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len;
    const P = (p, o, y) => [p.x + nx * o, p.y + y, p.z + nz * o];
    let q;
    if (y0 === y1) q = [P(a, o0, y0), P(a, o1, y0), P(b, o1, y0), P(b, o0, y0)];
    else q = [P(a, o1, y0), P(b, o1, y0), P(b, o1, y1), P(a, o1, y1)];
    // wind both ways: the strips are seen from above and below, from both sides
    for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3], [0, 2, 1], [0, 3, 2]]) out.push(...q[i0], ...q[i1], ...q[i2]);
  }
}

const meshOf = (pos, material, name) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

/** The decks: asphalt, sidewalks, girders, railings and piers; colliders on the railings */
function buildBridges(scene) {
  if (!decks) build();
  const group = new THREE.Group();
  group.name = 'BielanyBridges';
  const road = [], walks = [], concrete = [], rails = [];
  const colliders = [];
  const piers = [];
  for (const d of decks) {
    const h = d.w / 2, e = h + walkOf(d);
    deckStrip(road, d, -h, h, 0.0, 0.0);
    for (const s of [-1, 1]) {
      if (!d.kind) {
        deckStrip(walks, d, s * h, s * e, 0.15, 0.15); // sidewalks a curb above the roadway
        deckStrip(concrete, d, s * h, s * h, 0, 0.15); // the curbs
      }
      deckStrip(concrete, d, s * e, s * e, -GIRDER, 0.15); // the girders' faces
      deckStrip(rails, d, s * (e - 0.1), s * (e - 0.1), 0.15, RAIL);
    }
    deckStrip(concrete, d, -e, e, -GIRDER, -GIRDER); // the underside
    // piers wherever the deck stands high, colliders along both railings
    let run = PIER_EVERY / 2;
    for (let i = 1; i < d.pts.length; i++) {
      const a = d.pts[i - 1], b = d.pts[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      run += len;
      if (run >= PIER_EVERY) {
        run = 0;
        const g = groundY(b.x, b.z);
        if (b.y - g > 3) piers.push({ x: b.x, z: b.z, y0: g - 1, y1: b.y - GIRDER, yaw: Math.atan2(b.x - a.x, b.z - a.z), w: d.w });
      }
      const ex = (b.x - a.x) / (len || 1), ez = (b.z - a.z) / (len || 1);
      for (const s of [-1, 1]) {
        const cx = (a.x + b.x) / 2 - ez * s * e, cz = (a.z + b.z) / 2 + ex * s * e;
        const hx = len / 2 + 0.05, hz = 0.15;
        const rx = Math.abs(ex) * hx + Math.abs(ez) * hz, rz = Math.abs(ez) * hx + Math.abs(ex) * hz;
        const y = Math.min(a.y, b.y);
        if (Math.max(a.y, b.y) - Math.max(groundY(a.x, a.z), groundY(b.x, b.z)) < 1) continue; // at the ends: the street's curb
        colliders.push({ minX: cx - rx, maxX: cx + rx, minZ: cz - rz, maxZ: cz + rz, minY: y - 0.5, maxY: Math.max(a.y, b.y) + RAIL, base: y, obb: { cx, cz, hx, hz, cs: ex, sn: -ez } });
      }
    }
  }
  const concreteMat = new THREE.MeshStandardNodeMaterial({ color: 0xaaa69c, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  if (road.length) group.add(meshOf(road, createRoadSurfaceMaterial(), 'BridgeDecks'));
  if (walks.length) group.add(meshOf(walks, new THREE.MeshStandardNodeMaterial({ color: 0x9d9a94, roughness: 0.85, metalness: 0 }), 'BridgeSidewalks'));
  if (concrete.length) group.add(meshOf(concrete, concreteMat, 'BridgeGirders'));
  if (rails.length) group.add(meshOf(rails, new THREE.MeshStandardNodeMaterial({ color: 0x55595f, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), 'BridgeRailings'));
  if (piers.length) {
    const geos = piers.map((p) => {
      const g = new THREE.BoxGeometry(1.6, p.y1 - p.y0, Math.max(3, p.w * 0.6));
      g.rotateY(p.yaw + Math.PI / 2);
      g.translate(p.x, (p.y0 + p.y1) / 2, p.z);
      return g.toNonIndexed();
    });
    const m = new THREE.Mesh(mergeGeometries(geos, false), concreteMat);
    m.name = 'BridgePiers';
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }
  scene.add(group);
  console.info(`[bridges] ${decks.length} deck pieces, ${piers.length} piers, ${colliders.length} railing colliders`);
  return { group, colliders };
}

export { buildBridges, deckY, deckPose, surfaceY, overWater };
