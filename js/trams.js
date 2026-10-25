// js/trams.js
// Trams on the OpenStreetMap tracks (js/bielany-geodata.js GEO.trams): the rails along every track, and three-section
// articulated trams in Warsaw colours (yellow body, red skirt and front, no operator's logo) running the routes there
// and back, stopping at every stop on their track, waiting at the termini, holding back for the player and for the
// tram ahead. Cars treat the trams as obstacles (traffic.js blockers): they stop short of one crossing or standing in
// their lane. Out of the area (a line may run round its edge) a tram is hidden.

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GEO } from './bielany-geodata.js';
import { groundPose, drapeGeometry } from './terrain.js';
import { blockAt, ISLAND_BOUNDS } from './city-config.js';
import { deckY, deckPose } from './bridges.js';

const SECTION = 10.2; // m, one body section
const GAP = 0.5; // m between sections (the bellows)
const SECTIONS = 3;
const HALF_W = 1.25;
const CRUISE = 11; // m/s (40 km/h)
const ACCEL = 1.0;
const DECEL = 1.3;
const DWELL = 15; // s at a stop
const TERMINUS = 35; // s at the end of the line
const HEADWAY = 1800; // m of route per tram
const LOOKAHEAD = 40; // m: the player or a tram ahead within this makes it brake
const GAUGE = 1.435;
const PIECE = 4; // m: the rails & the bed follow the ground and the curb islands in pieces this long
const BED_W = 2.8; // m, the ballast bed of one track on a tramway of its own

// Height of a track at (x, z) above the ground: on a curb island (the tramway between Marymoncka's carriageways, as
// OpenStreetMap draws it) it lies on the island's top, in a street on the asphalt
const trackLift = (x, z) => (blockAt(x, z) ? ISLAND_BOUNDS.sidewalkHeight : 0);

// Route geometry: points and cumulative lengths, position and heading at arc length s
function prepare(route) {
  const p = route.pts, cum = [0];
  for (let k = 2; k < p.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[k] - p[k - 2], p[k + 1] - p[k - 1]));
  return { ...route, cum, length: cum[cum.length - 1] };
}
function at(r, s, out) {
  s = Math.max(0, Math.min(r.length, s));
  let lo = 0, hi = r.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (r.cum[mid] <= s) lo = mid; else hi = mid;
  }
  const f = (s - r.cum[lo]) / (r.cum[hi] - r.cum[lo] || 1);
  const ax = r.pts[2 * lo], az = r.pts[2 * lo + 1], bx = r.pts[2 * hi], bz = r.pts[2 * hi + 1];
  out.x = ax + (bx - ax) * f;
  out.z = az + (bz - az) * f;
  out.yaw = Math.atan2(bx - ax, bz - az);
  return out;
}

// One body section along +z, centred: yellow body, red skirt, a dark window band, a grey roof with the pantograph;
// the front section gets a red nose and a dark windscreen
function sectionGeometry(front) {
  const parts = [];
  const box = (w, h, d, x, y, z, hex) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.translate(x, y, z);
    const c = new THREE.Color(hex).convertSRGBToLinear();
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    parts.push(g);
  };
  const L = SECTION, W = HALF_W * 2;
  box(W, 0.9, L, 0, 0.75, 0, 0xc8102e); // skirt
  box(W, 1.0, L, 0, 1.7, 0, 0xf2c200); // body under the windows
  box(W + 0.02, 1.15, L - 0.6, 0, 2.75, 0, 0x2b3038); // window band
  box(W, 0.45, L, 0, 3.55, 0, 0xf2c200); // above the windows
  box(W - 0.3, 0.25, L - 0.4, 0, 3.9, 0, 0x9a9da1); // roof
  for (const s of [-1, 1]) box(0.5, 0.05, 0.08, s * 0.3, 0.38, s * L * 0.3, 0x3a3d40); // bogies hint
  box(0.12, 0.7, 0.12, 0, 4.35, 0, 0x55595e); // pantograph
  box(1.6, 0.06, 0.12, 0, 4.72, 0, 0x55595e);
  if (front) {
    box(W - 0.1, 2.0, 0.4, 0, 2.2, L / 2 + 0.15, 0x1d2228); // windscreen
    box(W - 0.1, 1.0, 0.45, 0, 0.75, L / 2 + 0.17, 0xc8102e); // nose
    box(W - 0.6, 0.35, 0.42, 0, 3.55, L / 2 + 0.16, 0x111111); // destination display
  }
  return mergeGeometries(parts, false);
}

// The rails of every track: two steel strips GAUGE apart, slightly above the road; on a tramway of its own (a curb
// island) they stand on sleepers in a ballast bed laid on the lawn
function trackGeometry() {
  const rails = [], bed = [], high = []; // high: the rails on the tram bridges' decks, at their heights
  const strip = (out, ax, az, bx, bz, nx, nz, o0, o1, ya, yb) => {
    const p = [ax + nx * o0, az + nz * o0, ax + nx * o1, az + nz * o1, bx + nx * o1, bz + nz * o1, bx + nx * o0, bz + nz * o0];
    out.push(p[0], ya, p[1], p[2], ya, p[3], p[4], yb, p[5], p[0], ya, p[1], p[4], yb, p[5], p[6], yb, p[7]);
  };
  for (const t of GEO.trams?.tracks || []) {
    for (let k = 0; k + 3 < t.length; k += 2) {
      const ax = t[k], az = t[k + 1], bx = t[k + 2], bz = t[k + 3];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.05) continue;
      const nx = -(bz - az) / len, nz = (bx - ax) / len;
      const n = Math.ceil(len / PIECE);
      for (let s = 0; s < n; s++) {
        const x0 = ax + ((bx - ax) * s) / n, z0 = az + ((bz - az) * s) / n;
        const x1 = ax + ((bx - ax) * (s + 1)) / n, z1 = az + ((bz - az) * (s + 1)) / n;
        const d0 = deckY(x0, z0, 1), d1 = deckY(x1, z1, 1);
        if (d0 !== null && d1 !== null) {
          for (const side of [-1, 1]) strip(high, x0, z0, x1, z1, nx, nz, (side * GAUGE) / 2 - 0.04, (side * GAUGE) / 2 + 0.04, d0 + 0.035, d1 + 0.035);
          continue;
        }
        const l0 = trackLift(x0, z0), l1 = trackLift(x1, z1);
        if (trackLift((x0 + x1) / 2, (z0 + z1) / 2)) strip(bed, x0, z0, x1, z1, nx, nz, -BED_W / 2, BED_W / 2, l0 + 0.03, l1 + 0.03);
        for (const side of [-1, 1]) {
          const o = (side * GAUGE) / 2;
          strip(rails, x0, z0, x1, z1, nx, nz, o - 0.04, o + 0.04, l0 + (l0 ? 0.12 : 0.035), l1 + (l1 ? 0.12 : 0.035));
        }
      }
    }
  }
  // up-facing normals; the strips are wound either way, so the materials are double-sided
  const geometry = (pos) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const n = new Float32Array(pos.length);
    for (let i = 1; i < n.length; i += 3) n[i] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    return g;
  };
  return { rails: geometry(rails), bed: geometry(bed), high: geometry(high) };
}

function createTrams(scene, { blockers = [] } = {}) {
  const group = new THREE.Group();
  group.name = 'BielanyTrams';
  const routes = (GEO.trams?.routes || []).map(prepare);
  const bounds = GEO.frame.bounds;

  const track = trackGeometry();
  const railMat = new THREE.MeshStandardNodeMaterial({ color: 0x8e9196, roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide });
  const rails = new THREE.Mesh(drapeGeometry(track.rails), railMat);
  const bridgeRails = new THREE.Mesh(track.high, railMat);
  bridgeRails.name = 'TramBridgeRails';
  rails.name = 'TramRails';
  rails.receiveShadow = true;
  const bed = new THREE.Mesh(drapeGeometry(track.bed), new THREE.MeshStandardNodeMaterial({ color: 0x6e675e, roughness: 1, side: THREE.DoubleSide }));
  bed.name = 'TramBed';
  bed.receiveShadow = true;
  group.add(bed, rails, bridgeRails);

  // trams: spaced along each route; the routes come in pairs (there, back)
  const trams = [];
  routes.forEach((r, ri) => {
    const n = Math.max(1, Math.round(r.length / HEADWAY));
    for (let k = 0; k < n; k++) {
      const s = (k + 0.3) * (r.length / n);
      const next = r.stops.findIndex(([ss]) => ss > s);
      trams.push({ route: ri, s, speed: 0, wait: 2 + k * 3, next: next < 0 ? r.stops.length : next, x: 0, z: 0, yaw: 0, vx: 0, vz: 0, visible: true });
    }
  });
  const mat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.15 });
  const fronts = new THREE.InstancedMesh(sectionGeometry(true), mat, trams.length * 2);
  const middles = new THREE.InstancedMesh(sectionGeometry(false), mat, trams.length * Math.max(1, SECTIONS - 2));
  for (const m of [fronts, middles]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.name = m === fronts ? 'TramFronts' : 'TramMiddles';
    group.add(m);
  }
  scene.add(group);

  const p = { x: 0, z: 0, yaw: 0 };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0), v3 = new THREE.Vector3();
  const flip = new THREE.Quaternion().setFromAxisAngle(up, Math.PI);
  const pose = {}, tilt = new THREE.Euler(0, 0, 0, 'YXZ');
  const inArea = (x, z) => x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;

  function place() {
    let fi = 0, mi = 0;
    trams.forEach((t) => {
      const r = routes[t.route];
      for (let k = 0; k < SECTIONS; k++) {
        const s = t.s - SECTION / 2 - k * (SECTION + GAP);
        at(r, s, p);
        const mesh = k === 0 || k === SECTIONS - 1 ? fronts : middles;
        const idx = mesh === fronts ? fi++ : mi++;
        if (!t.visible) { mesh.setMatrixAt(idx, zero); continue; }
        // each section on the ground under it, along the slope (js/terrain.js)
        const onDeck = deckY(p.x, p.z, 1) !== null; // across the Skłodowska-Curie bridge
        (onDeck ? deckPose : groundPose)(p.x, p.z, Math.sin(p.yaw), Math.cos(p.yaw), SECTION / 2, HALF_W, pose, 1);
        q.setFromEuler(tilt.set(pose.pitch, p.yaw, pose.roll, 'YXZ'));
        if (k === SECTIONS - 1) q.multiply(flip); // the rear section's nose faces backwards
        const lift = onDeck ? 0 : trackLift(p.x, p.z);
        m4.compose(v3.set(p.x, pose.y + (lift ? lift + 0.09 : 0), p.z), q, one);
        mesh.setMatrixAt(idx, m4);
      }
    });
    fronts.instanceMatrix.needsUpdate = true;
    middles.instanceMatrix.needsUpdate = true;
  }

  // the pair route of route ri (the way back), by its name "A – B" / "B – A"
  const partner = routes.map((r) => {
    const [a, b] = r.name.split(' – ');
    return routes.findIndex((o) => o.name === `${b} – ${a}`);
  });

  function update(dt, player) {
    blockers.length = 0;
    for (const t of trams) {
      const r = routes[t.route];
      if (t.wait > 0) {
        t.wait -= dt;
        t.speed = 0;
        if (t.wait <= 0 && t.s >= r.length - 1 && partner[t.route] >= 0) {
          // end of the line: the way back starts here
          t.route = partner[t.route];
          t.s = SECTIONS * (SECTION + GAP);
          t.next = routes[t.route].stops.findIndex(([ss]) => ss > t.s + 1);
          if (t.next < 0) t.next = routes[t.route].stops.length;
        }
      } else {
        // the target: the next stop, the end of the line, the tram ahead or the player on the track
        let target = r.length;
        if (t.next < r.stops.length) target = Math.min(target, r.stops[t.next][0]);
        for (const o of trams) {
          if (o === t || o.route !== t.route || o.s <= t.s) continue;
          target = Math.min(target, o.s - SECTIONS * (SECTION + GAP) - 8);
        }
        if (player) {
          for (let d = 4; d <= LOOKAHEAD; d += 4) {
            at(r, t.s + d, p);
            if (Math.hypot(player.x - p.x, player.z - p.z) < HALF_W + 1.6) { target = Math.min(target, t.s + d - 6); break; }
          }
        }
        const gap = target - t.s;
        const vMax = Math.sqrt(Math.max(0, 2 * DECEL * Math.max(0, gap - 0.5)));
        const want = Math.min(CRUISE, vMax);
        t.speed = want > t.speed ? Math.min(want, t.speed + ACCEL * dt) : Math.max(want, t.speed - DECEL * 2 * dt);
        t.s += t.speed * dt;
        if (t.next < r.stops.length && t.s >= r.stops[t.next][0] - 1 && t.speed < 0.3) {
          t.wait = DWELL;
          t.next++;
        } else if (t.next < r.stops.length && t.s > r.stops[t.next][0] + 2) {
          t.next++; // passed it (started past it)
        }
        if (t.s >= r.length - 0.5 && t.speed < 0.3) t.wait = TERMINUS;
      }
      at(r, t.s - (SECTIONS * (SECTION + GAP)) / 2, p);
      t.x = p.x;
      t.z = p.z;
      t.yaw = p.yaw;
      t.vx = Math.sin(p.yaw) * t.speed;
      t.vz = Math.cos(p.yaw) * t.speed;
      t.visible = inArea(t.x, t.z);
      if (t.visible) blockers.push({ x: t.x, z: t.z, yaw: t.yaw, halfW: HALF_W, halfL: (SECTIONS * (SECTION + GAP)) / 2, vx: t.vx, vz: t.vz });
    }
    place();
  }
  place();
  console.info(`[trams] ${routes.length} routes, ${trams.length} trams, ${(GEO.trams?.tracks || []).length} tracks`);
  return { group, update, trams, routes };
}

export { createTrams, prepare, at };
