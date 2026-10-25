// js/wildlife.js
// Animals of the Bielany woods (GEO.woods, js/forest.js): wild boars (a sow with her striped piglets, lone tuskers),
// roe deer and red squirrels on the trunks and under the trees of GEO.trees. They feed in the undergrowth off the
// paths, run off when the player comes close and calm down again; the boars of the woods' edges now and then step out
// onto the lawns of the estates next door. No attacks, no harm: they only run away.
//
// Their homes (sites) are planned once over the woods; only the sites round the camera have their animals out, all of
// them drawn with a few instanced pools of low-poly parts (boxes, blobs, cones, sticks). Far from the woods nothing runs.

import * as THREE from 'three/webgpu';
import { GEO } from './bielany-geodata.js';
import { ISLAND_BOUNDS, blockAt, buildingAt } from './city-config.js';
import { groundY } from './terrain.js';
import { inWood, pathGrid } from './forest.js';

const SITE_CELL = 80; // m: at most one herd's home per square this wide
const SQUIRREL_EVERY = 20; // one surveyed wood tree in this many has a squirrel
const ACTIVE = 180; // m from the camera: sites this near have their animals out
const ACTIVE_SQUIRREL = 70; // squirrels are small: only near ones
const DROP = 230; // m: sites this far are put away again (their animals forgotten)
const BUCKET = 200; // m: the sites' spatial buckets
const MAX_ANIMALS = 160;
const AIRBORNE = 6; // m above the ground: the player is no threat (the helicopter)

// Per kind: how near the player may come, how fast they walk and run, how far from home they roam
// stride: m per step cycle at a walk, hz: the fastest the legs swing (a faster run lengthens the stride instead)
const KINDS = {
  boar: { flee: 20, calm: 55, walk: 0.9, run: 6.5, roam: 35, leash: 110, size: 1, stride: 0.9, hz: 2.6 },
  piglet: { flee: 20, calm: 55, walk: 0.9, run: 6.5, roam: 0, leash: 110, size: 0.48, stride: 0.5, hz: 3.4 },
  deer: { flee: 32, calm: 80, walk: 1.1, run: 10, roam: 40, leash: 130, size: 1, stride: 1.2, hz: 2.2 },
  squirrel: { flee: 7, calm: 14, walk: 1.2, run: 4, roam: 4, leash: 8, size: 1.3, stride: 0.3, hz: 4.5 },
};

const hash = (x, z, s) => {
  const v = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Homes of the animals over the woods: herds on a SITE_CELL grid in the woods (boars, deer), squirrels at some of the
 * surveyed wood trees. `boxes` are the woods' bounds [x0, z0, x1, z1]; `trees` the flat GEO.trees (5 numbers a tree).
 * A herd site near the wood's edge (open, unbuilt ground within 50 m) is an edge site: its boars may step out.
 */
function planSites({ boxes, inWood, blocked, trees = [] }) {
  const sites = [], seen = new Set();
  for (const [x0, z0, x1, z1] of boxes) {
    for (let cx = Math.floor(x0 / SITE_CELL); cx * SITE_CELL < x1; cx++) {
      for (let cz = Math.floor(z0 / SITE_CELL); cz * SITE_CELL < z1; cz++) {
        const key = `${cx},${cz}`;
        if (seen.has(key)) continue;
        const r = hash(cx, cz, 11);
        const kind = r < 0.22 ? 'sounder' : r < 0.34 ? 'tusker' : r < 0.6 ? 'deer' : null;
        if (!kind) { seen.add(key); continue; }
        const x = (cx + 0.15 + hash(cx, cz, 12) * 0.7) * SITE_CELL, z = (cz + 0.15 + hash(cx, cz, 13) * 0.7) * SITE_CELL;
        if (!inWood(x, z) || blocked(x, z)) continue; // another wood's box may still hold this square
        seen.add(key);
        let edge = false;
        for (let a = 0; a < 8 && !edge; a++) {
          const ex = x + Math.cos(a * Math.PI / 4) * 50, ez = z + Math.sin(a * Math.PI / 4) * 50;
          edge = !inWood(ex, ez) && !blocked(ex, ez);
        }
        sites.push({ kind, x, z, edge, seed: hash(cx, cz, 14) });
      }
    }
  }
  for (let i = 0; i < trees.length; i += 5) {
    const x = trees[i], z = trees[i + 1], h = trees[i + 2];
    if (h < 7 || hash(x, z, 21) * SQUIRREL_EVERY >= 1 || !inWood(x, z) || blocked(x, z)) continue;
    sites.push({ kind: 'squirrel', x, z, edge: false, seed: hash(x, z, 22), tree: { x, z, h, r: Math.max(0.14, h * 0.016) } });
  }
  return sites;
}

/**
 * The animals' behaviour, apart from drawing. `world` answers: inWood(x, z), blocked(x, z) (buildings), toPath(x, z)
 * (m to the nearest forest path's edge), groundAt(x, z). update(dt, camera {x, y, z}, player {x, y, z} or null).
 */
class Wildlife {
  constructor(sites, world, { random = Math.random } = {}) {
    // the wood's limits and the buildings, asked many times a frame, answered once per square metre (at its middle)
    const memo = (fn) => {
      const known = new Map();
      return (x, z) => {
        const i = Math.floor(x), j = Math.floor(z), key = i * 65536 + j;
        let v = known.get(key);
        if (v === undefined) {
          if (known.size > 200000) known.clear();
          known.set(key, (v = !!fn(i + 0.5, j + 0.5)));
        }
        return v;
      };
    };
    this.world = world = { ...world, inWood: memo(world.inWood), blocked: memo(world.blocked) };
    this.random = random;
    this.sites = sites;
    this.buckets = new Map();
    for (const s of sites) {
      const key = `${Math.floor(s.x / BUCKET)},${Math.floor(s.z / BUCKET)}`;
      if (!this.buckets.has(key)) this.buckets.set(key, []);
      this.buckets.get(key).push(s);
    }
    this.active = new Map(); // site -> its animals
    this.animals = [];
    this.lastX = Infinity;
    this.lastZ = Infinity;
  }

  // Sites in and out round the camera, whenever it has moved a few metres (nothing out from high above)
  refresh(cam) {
    const w = this.world;
    if (cam.y - w.groundAt(cam.x, cam.z) > 120) {
      if (this.active.size) { this.active.clear(); this.animals = []; }
      this.lastX = Infinity;
      return;
    }
    if (Math.hypot(cam.x - this.lastX, cam.z - this.lastZ) < 10) return;
    this.lastX = cam.x;
    this.lastZ = cam.z;
    let changed = false;
    for (const [site, list] of this.active) {
      const d = Math.min(Math.hypot(site.x - cam.x, site.z - cam.z), ...list.map((a) => Math.hypot(a.x - cam.x, a.z - cam.z)));
      if (d > (site.kind === 'squirrel' ? ACTIVE_SQUIRREL + 30 : DROP)) { this.active.delete(site); changed = true; }
    }
    const bi = Math.floor(cam.x / BUCKET), bj = Math.floor(cam.z / BUCKET);
    let count = [...this.active.values()].reduce((s, l) => s + l.length, 0);
    for (let i = bi - 1; i <= bi + 1; i++) {
      for (let j = bj - 1; j <= bj + 1; j++) {
        for (const site of this.buckets.get(`${i},${j}`) || []) {
          if (this.active.has(site)) continue;
          if (Math.hypot(site.x - cam.x, site.z - cam.z) > (site.kind === 'squirrel' ? ACTIVE_SQUIRREL : ACTIVE)) continue;
          const herd = this.spawn(site);
          if (count + herd.length > MAX_ANIMALS) continue;
          this.active.set(site, herd);
          count += herd.length;
          changed = true;
        }
      }
    }
    if (changed) this.animals = [...this.active.values()].flat();
  }

  animal(kind, site, x, z, extra = {}) {
    const r = this.random;
    return {
      kind, site, x, z, y: this.world.groundAt(x, z), yaw: r() * Math.PI * 2, speed: 0, state: 'graze', timer: 1 + r() * 5,
      tx: x, tz: z, phase: r() * 10, root: 0, move: 0, look: 0, side: r() < 0.5 ? 1 : -1, rest: false, leader: null, ox: 0, oz: 0, climb: 0, ...extra,
    };
  }

  // A herd at its home: the sow leads her 3-5 piglets, a lone tusker, 2-3 roe deer, a squirrel at its tree
  spawn(site) {
    const r = this.random, { x, z } = site;
    if (site.kind === 'squirrel') {
      const t = site.tree, up = r() < 0.5;
      const a = r() * Math.PI * 2;
      return [this.animal('squirrel', site, t.x + Math.cos(a) * (up ? t.r : 1.5), t.z + Math.sin(a) * (up ? t.r : 1.5), { climb: up ? 2 + r() * 4 : 0, state: up ? 'perch' : 'graze', around: a })];
    }
    if (site.kind === 'tusker') return [this.animal('boar', site, x, z, { tusks: true })];
    const leadKind = site.kind === 'sounder' ? 'boar' : 'deer';
    const lead = this.animal(leadKind, site, x, z, { buck: site.kind === 'deer' && site.seed < 0.4 });
    const herd = [lead];
    const n = site.kind === 'sounder' ? 3 + Math.floor(site.seed * 3) : 1 + Math.floor(site.seed * 2.99);
    for (let k = 0; k < n; k++) {
      const a = Math.PI * (0.6 + 0.8 * r()) * (k % 2 ? 1 : -1), d = site.kind === 'sounder' ? 1.2 + r() * 2 : 3 + r() * 4;
      herd.push(this.animal(site.kind === 'sounder' ? 'piglet' : 'deer', site, x + Math.sin(a) * d, z + Math.cos(a) * d, { leader: lead, ox: Math.sin(a) * d, oz: Math.cos(a) * d }));
    }
    return herd;
  }

  // Where an animal may stand: no buildings; in the wood, or (boars of an edge site) out on the open ground near home
  allowed(a, x, z) {
    const w = this.world;
    if (w.blocked(x, z)) return false;
    if (Math.hypot(x - a.site.x, z - a.site.z) > KINDS[a.kind].leash) return false;
    if (w.inWood(x, z)) return true;
    return a.site.edge && (a.kind === 'boar' || a.kind === 'piglet') && Math.hypot(x - a.site.x, z - a.site.z) < 90;
  }

  // The next spot to feed at: in the bushes (off the paths), now and then (edge boars) out of the wood
  pickTarget(a) {
    const r = this.random, k = KINDS[a.kind], w = this.world;
    let best = null;
    const outside = a.site.edge && a.kind === 'boar' && r() < 0.35;
    for (let t = 0; t < 8; t++) {
      const ang = r() * Math.PI * 2, d = k.roam * (0.3 + 0.7 * r());
      // home pulls the roaming animal back
      const x = a.x + Math.cos(ang) * d + (a.site.x - a.x) * 0.3, z = a.z + Math.sin(ang) * d + (a.site.z - a.z) * 0.3;
      if (!this.allowed(a, x, z)) continue;
      if (w.toPath(x, z) < 1.5 && r() > 0.1) continue; // crossing a path is fine, feeding on it is not
      best = [x, z];
      if (!outside || !w.inWood(x, z)) break;
    }
    return best;
  }

  update(dt, cam, player) {
    this.refresh(cam);
    if (!this.animals.length) return;
    const w = this.world;
    const threat = player && player.y - w.groundAt(player.x, player.z) < AIRBORNE ? player : null;
    for (const a of this.animals) if (!a.leader) this.think(a, dt, threat);
    for (const a of this.animals) if (a.leader) this.follow(a, dt, threat);
    for (const a of this.animals) {
      if (a.kind === 'squirrel') this.place(a);
      else a.y = w.groundAt(a.x, a.z);
      // the step cycle (2 per stride) and the eased poses, so nothing snaps from one state to the next
      const k = KINDS[a.kind], ease = Math.min(1, dt * 4);
      a.phase += dt * 2 * Math.min(k.hz, a.speed / k.stride);
      a.move += (Math.min(1.6, a.speed / k.walk) - a.move) * ease;
      a.root += ((a.state === 'graze' && a.speed < 0.2 ? 1 : 0) - a.root) * Math.min(1, dt * 2);
      a.look += ((a.state === 'alert' || a.state === 'flee' ? 1 : 0) - a.look) * ease;
    }
  }

  // A leader (or a lone animal): feeding, walking to the next spot, running off and standing alert after
  think(a, dt, threat) {
    const k = KINDS[a.kind], r = this.random;
    const d = threat ? Math.hypot(a.x - threat.x, a.z - threat.z) : Infinity;
    if (a.kind === 'squirrel') return this.squirrel(a, dt, d);
    if (d < k.flee && a.state !== 'flee') { a.state = 'flee'; a.timer = 6 + r() * 3; }
    a.timer -= dt;
    if (a.state === 'flee') {
      if (d > k.calm || a.timer <= 0) { a.state = 'alert'; a.timer = 2 + r() * 3; a.speed = 0; return; }
      const away = threat ? Math.atan2(a.x - threat.x, a.z - threat.z) : a.yaw;
      this.steer(a, away, k.run, dt, 6);
      return;
    }
    if (a.state === 'alert') { // stand still, head up, looking back
      a.speed = Math.max(0, a.speed - dt * 8);
      if (a.timer <= 0) { a.state = 'graze'; a.timer = 2 + r() * 4; }
      return;
    }
    if (a.state === 'graze') {
      a.speed = Math.max(0, a.speed - dt * 3);
      if (a.timer <= 0) {
        const t = this.pickTarget(a);
        if (t) { [a.tx, a.tz] = t; a.state = 'walk'; a.timer = 40; } else a.timer = 1 + r() * 2;
      }
      return;
    }
    // walk
    const dist = Math.hypot(a.tx - a.x, a.tz - a.z);
    if (dist < 0.6 || a.timer <= 0) { a.state = 'graze'; a.timer = 4 + r() * 8; return; }
    this.steer(a, Math.atan2(a.tx - a.x, a.tz - a.z), k.walk, dt, 2);
  }

  // Turn toward `yaw` (rad, 0 = +Z) and move at `speed`, sliding round buildings and the wood's limits
  steer(a, yaw, speed, dt, turn) {
    let best = null;
    for (const o of [0, 0.5, -0.5, 1.1, -1.1, 1.8, -1.8, Math.PI]) { // round an obstacle on the side taken before
      const off = o * a.side, y = yaw + off, step = Math.max(speed * dt, 0.3);
      if (this.allowed(a, a.x + Math.sin(y) * step * 3, a.z + Math.cos(y) * step * 3)) { best = y; if (off) a.side = Math.sign(off); break; }
    }
    if (best === null) { a.speed = 0; return; } // cornered: stand
    let dy = best - a.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    a.yaw += Math.max(-turn * dt, Math.min(turn * dt, dy));
    a.speed += (speed - a.speed) * Math.min(1, dt * 4);
    const nx = a.x + Math.sin(a.yaw) * a.speed * dt, nz = a.z + Math.cos(a.yaw) * a.speed * dt;
    if (this.allowed(a, nx, nz)) { a.x = nx; a.z = nz; } else a.speed *= 0.5;
  }

  // Piglets keep to their mother, deer to the leading doe: their place by her, running when she runs
  follow(a, dt, threat) {
    const L = a.leader, k = KINDS[a.kind];
    a.state = L.state;
    if (L.state === 'flee' && a.timer > -1) { // a running herd bunches up behind the leader
      a.ox *= 0.6; a.oz *= 0.6; a.timer = -1;
    } else if (L.state !== 'flee' && a.timer === -1) {
      const s = a.kind === 'piglet' ? 1.5 + this.random() * 2 : 3 + this.random() * 4, ang = this.random() * Math.PI * 2;
      a.ox = Math.sin(ang) * s; a.oz = Math.cos(ang) * s; a.timer = 0;
    }
    const c = Math.cos(L.yaw), s = Math.sin(L.yaw);
    const tx = L.x + a.ox * c + a.oz * s, tz = L.z - a.ox * s + a.oz * c;
    const dist = Math.hypot(tx - a.x, tz - a.z);
    // at its place it stays put till the leader is a couple of metres on (no stop-and-go on every step)
    if (dist < 0.5) a.rest = true;
    else if (dist > (L.state === 'flee' ? 0.8 : 2.5)) a.rest = false;
    if (a.rest) {
      a.speed = Math.max(0, a.speed - dt * 3);
      if (L.state === 'alert') a.yaw += Math.atan2(Math.sin(L.yaw - a.yaw), Math.cos(L.yaw - a.yaw)) * Math.min(1, dt * 2);
      if (L.state === 'walk') a.state = 'graze'; // nibbling while the sow ambles on
      return;
    }
    const want = L.state === 'flee' ? k.run * 1.05 : Math.min(KINDS[L.kind].walk * 2.2, dist * 1.2);
    const before = a.state;
    this.steer(a, Math.atan2(tx - a.x, tz - a.z), want, dt, L.state === 'flee' ? 8 : 4);
    a.state = before;
  }

  // A squirrel forages under its tree and runs up the trunk when the player comes near, down again once alone
  squirrel(a, dt, d) {
    const t = a.site.tree, k = KINDS.squirrel, r = this.random;
    a.timer -= dt;
    if (d < k.flee && a.state !== 'climb' && (a.state !== 'perch' || a.climb < 3)) {
      a.state = 'climb'; a.goal = Math.min(t.h * 0.6, 4 + r() * 3); a.timer = 10;
      a.around = Math.atan2(a.x - t.x, a.z - t.z);
    }
    if (a.state === 'climb') {
      const atTrunk = Math.hypot(a.x - t.x, a.z - t.z) <= t.r + 0.05;
      if (!atTrunk) { this.dash(a, t.x + Math.sin(a.around) * t.r, t.z + Math.cos(a.around) * t.r, k.run, dt); return; }
      a.climb = Math.min(a.goal, a.climb + dt * 2.2);
      a.speed = a.climb < a.goal ? 2.2 : 0;
      a.around += dt * 0.6; // spiralling round the trunk
      if (a.climb >= a.goal) { a.state = 'perch'; a.timer = 6 + r() * 8; }
      return;
    }
    if (a.state === 'perch') {
      a.speed = 0;
      if (a.timer <= 0 && d > k.calm) { a.state = 'down'; }
      return;
    }
    if (a.state === 'down') {
      a.climb = Math.max(0, a.climb - dt * 1.6);
      a.speed = a.climb > 0 ? 1.6 : 0;
      if (a.climb === 0) { a.state = 'graze'; a.timer = 2 + r() * 4; a.x = t.x + Math.sin(a.around) * (t.r + 0.3); a.z = t.z + Math.cos(a.around) * (t.r + 0.3); }
      return;
    }
    if (a.state === 'graze') {
      a.speed = 0;
      if (a.timer <= 0) {
        const ang = r() * Math.PI * 2, s = t.r + 0.6 + r() * k.roam;
        a.tx = t.x + Math.sin(ang) * s; a.tz = t.z + Math.cos(ang) * s; a.state = 'walk'; a.timer = 8;
      }
      return;
    }
    if (Math.hypot(a.tx - a.x, a.tz - a.z) < 0.15 || a.timer <= 0) { a.state = 'graze'; a.timer = 1.5 + r() * 4; return; }
    this.dash(a, a.tx, a.tz, k.walk, dt);
  }

  dash(a, tx, tz, speed, dt) {
    const d = Math.hypot(tx - a.x, tz - a.z), step = Math.min(d, speed * dt);
    a.yaw = Math.atan2(tx - a.x, tz - a.z);
    a.speed = speed;
    if (d > 0) { a.x += ((tx - a.x) / d) * step; a.z += ((tz - a.z) / d) * step; }
  }

  // A squirrel on the trunk sits on its bark, head up; on the ground it stands on it
  place(a) {
    const t = a.site.tree;
    if (a.climb > 0) {
      a.x = t.x + Math.sin(a.around) * t.r;
      a.z = t.z + Math.cos(a.around) * t.r;
      a.yaw = a.around + Math.PI; // facing the trunk
    }
    a.y = this.world.groundAt(a.x, a.z) + a.climb;
  }
}

// ---- Drawing ---------------------------------------------------------------------------------------------------

// The part pools: unit shapes, each part a scaled, coloured instance of one
function shapes() {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const blob = new THREE.IcosahedronGeometry(0.5, 1);
  const cone = new THREE.ConeGeometry(0.5, 1, 6).rotateX(Math.PI / 2); // tip along +Z
  const stick = new THREE.CylinderGeometry(0.5, 0.42, 1, 6);
  return { box, blob, cone, stick };
}

// Rigs in the animal's frame (m, +Z forward, y up, feet at 0): [shape, colour, pos, scale, rot?, motion?]
// Motions: leg (swings from its top with the gait, `side` the phase), head (dips to root / graze), tail (wags)
const C = {
  boar: 0x3a2f27, boarDark: 0x261e19, snout: 0x5c4339, tusk: 0xe0d6bc, piglet: 0x9a7048, stripe: 0xd8c08a,
  deer: 0x7a5d44, deerDark: 0x4a3a2c, rump: 0xeee6d6, nose: 0x1d1a18, squirrel: 0xa4471f, belly: 0xe8d8bc,
};
function legs(color, hipY, len, x, zf, zb, r) {
  return [[x, zf, 0], [-x, zf, Math.PI], [x, zb, Math.PI], [-x, zb, 0]].map(([lx, lz, side]) =>
    ['stick', color, [lx, hipY, lz], [r, len, r], null, { leg: side, hinge: [lx, hipY, lz] }]);
}
function boarRig(color, { tusks = false, stripes = false } = {}) {
  const dark = stripes ? 0x7a5636 : C.boarDark;
  const rig = [
    ['blob', color, [0, 0.6, -0.12], [0.6, 0.62, 1.15]],
    ['blob', color, [0, 0.68, 0.3], [0.62, 0.74, 0.7]], // the high shoulders
    ['blob', dark, [0, 0.83, 0.28], [0.18, 0.3, 0.7]], // bristly mane
    ['cone', color, [0, 0.58, 0.78], [0.44, 0.5, 0.62], [0.25, 0, 0], { head: 1, hinge: [0, 0.7, 0.55] }],
    ['stick', C.snout, [0, 0.42, 1.08], [0.16, 0.06, 0.16], [Math.PI / 2 + 0.25, 0, 0], { head: 1, hinge: [0, 0.7, 0.55] }],
    ['cone', dark, [0.14, 0.86, 0.66], [0.1, 0.18, 0.1], [-1.2, 0, 0], { head: 1, hinge: [0, 0.7, 0.55] }],
    ['cone', dark, [-0.14, 0.86, 0.66], [0.1, 0.18, 0.1], [-1.2, 0, 0], { head: 1, hinge: [0, 0.7, 0.55] }],
    ['stick', dark, [0, 0.6, -0.72], [0.04, 0.3, 0.04], [0.5, 0, 0], { tail: 1, hinge: [0, 0.72, -0.68] }],
    ...legs(C.boarDark, 0.42, 0.44, 0.16, 0.4, -0.45, 0.11),
  ];
  if (tusks) for (const s of [-1, 1]) rig.push(['cone', C.tusk, [s * 0.08, 0.47, 1.0], [0.04, 0.04, 0.16], [-0.9, s * 0.4, 0], { head: 1, hinge: [0, 0.7, 0.55] }]);
  if (stripes) for (const [x, y] of [[0.1, 0.9], [-0.1, 0.9], [0.26, 0.8], [-0.26, 0.8], [0.32, 0.62], [-0.32, 0.62]]) rig.push(['box', C.stripe, [x, y, -0.02], [0.05, 0.05, 1.05]]);
  return rig;
}
function deerRig(buck) {
  const h = [0, 1.1, 0.42];
  const rig = [
    ['blob', C.deer, [0, 0.9, 0], [0.42, 0.44, 1.05]],
    ['blob', C.rump, [0, 0.92, -0.5], [0.3, 0.32, 0.12]], // the white rump patch
    ['stick', C.deer, [0, 1.18, 0.48], [0.13, 0.5, 0.13], [0.55, 0, 0], { head: 1, hinge: h }],
    ['blob', C.deer, [0, 1.42, 0.62], [0.17, 0.18, 0.3], [0.2, 0, 0], { head: 1, hinge: h }],
    ['cone', C.deerDark, [0, 1.38, 0.82], [0.1, 0.1, 0.14], [0.3, 0, 0], { head: 1, hinge: h }],
    ['blob', C.nose, [0, 1.36, 0.89], [0.05, 0.05, 0.05], null, { head: 1, hinge: h }],
    ['cone', C.deer, [0.1, 1.56, 0.56], [0.06, 0.14, 0.04], [-1.3, 0, -0.5], { head: 1, hinge: h }],
    ['cone', C.deer, [-0.1, 1.56, 0.56], [0.06, 0.14, 0.04], [-1.3, 0, 0.5], { head: 1, hinge: h }],
    ...legs(C.deerDark, 0.75, 0.76, 0.12, 0.35, -0.36, 0.06),
  ];
  if (buck) for (const s of [-1, 1]) rig.push(['stick', 0x6a5a44, [s * 0.05, 1.66, 0.6], [0.025, 0.24, 0.025], [0, 0, s * -0.2], { head: 1, hinge: h }]);
  return rig;
}
function squirrelRig() {
  const head = { head: 1, hinge: [0, 0.14, 0.06] }, tail = { tail: 1, hinge: [0, 0.1, -0.12] };
  return [
    ['blob', C.squirrel, [0, 0.11, 0.02], [0.09, 0.1, 0.2], [-0.25, 0, 0]], // a slim body, the front raised
    ['blob', C.squirrel, [0, 0.09, -0.07], [0.12, 0.11, 0.12]], // haunches
    ['blob', C.belly, [0, 0.1, 0.07], [0.06, 0.07, 0.08]], // the white chest
    ['blob', C.squirrel, [0, 0.18, 0.12], [0.08, 0.08, 0.1], null, head],
    ['cone', C.squirrel, [0, 0.17, 0.18], [0.05, 0.05, 0.06], null, head], // the snout
    ['cone', C.squirrel, [0.025, 0.24, 0.11], [0.022, 0.07, 0.022], [-1.45, 0, 0], head], // tufted ears
    ['cone', C.squirrel, [-0.025, 0.24, 0.11], [0.022, 0.07, 0.022], [-1.45, 0, 0], head],
    // the bushy tail: up from the rump and curled forward at the top, one thick plume
    ['blob', C.squirrel, [0, 0.13, -0.15], [0.09, 0.1, 0.1], null, tail],
    ['blob', C.squirrel, [0, 0.22, -0.19], [0.11, 0.14, 0.11], null, tail],
    ['blob', C.squirrel, [0, 0.31, -0.16], [0.11, 0.11, 0.11], null, tail],
    ['blob', C.squirrel, [0, 0.35, -0.09], [0.08, 0.07, 0.08], null, tail],
    ...legs(C.squirrel, 0.07, 0.07, 0.035, 0.08, -0.06, 0.03),
  ];
}

/** The animals of the woods in the scene: wildlife.update(dt, camera, playerPosition) every frame */
function buildWildlife(scene) {
  const boxes = (GEO.woods || []).map(([outer]) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < outer.length; k += 2) {
      x0 = Math.min(x0, outer[k]); z0 = Math.min(z0, outer[k + 1]); x1 = Math.max(x1, outer[k]); z1 = Math.max(z1, outer[k + 1]);
    }
    return [x0, z0, x1, z1];
  });
  const b = ISLAND_BOUNDS;
  const blocked = (x, z) => x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ || !!buildingAt(x, z);
  const sites = planSites({ boxes, inWood, blocked, trees: GEO.trees || [] });
  const world = {
    inWood, blocked, toPath: pathGrid(),
    groundAt: (x, z) => groundY(x, z) + (blockAt(x, z) ? b.sidewalkHeight : 0),
  };
  const life = new Wildlife(sites, world);

  const rigs = {
    sow: boarRig(C.boar), tusker: boarRig(C.boar, { tusks: true }), piglet: boarRig(C.piglet, { stripes: true }),
    doe: deerRig(false), buck: deerRig(true), squirrel: squirrelRig(),
  };
  const geo = shapes();
  const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0 });
  const group = new THREE.Group();
  group.name = 'BielanyWildlife';
  const pools = {};
  for (const [name, g] of Object.entries(geo)) {
    const most = Math.max(...Object.values(rigs).map((r) => r.filter((p) => p[0] === name).length));
    const mesh = new THREE.InstancedMesh(g, mat, Math.max(1, most * MAX_ANIMALS));
    mesh.name = `Wildlife-${name}`;
    mesh.castShadow = true;
    mesh.frustumCulled = false; // only the animals round the camera are in it
    mesh.setColorAt(0, new THREE.Color(C.boar));
    mesh.count = 0;
    pools[name] = { mesh, n: 0 };
    group.add(mesh);
  }
  scene.add(group);
  const counts = {};
  for (const s of sites) counts[s.kind] = (counts[s.kind] || 0) + 1;
  console.info(`[wildlife] ${Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ')} sites`);

  // Each rig part's colour once; its rest matrix (rotation & scale) once, the motion on top every frame
  const tone = new THREE.Color();
  for (const rig of Object.values(rigs)) {
    for (const p of rig) {
      p.color = tone.setHex(p[1]).toArray([]);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p[4] || [0, 0, 0]))), new THREE.Vector3(...p[3]));
      p.rest = m;
    }
  }
  const body = new THREE.Matrix4(), part = new THREE.Matrix4(), swing = new THREE.Matrix4(), tmp = new THREE.Matrix4();
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3();
  let wasDrawing = false;

  function draw(a) {
    const rig = a.kind === 'piglet' ? rigs.piglet : a.kind === 'squirrel' ? rigs.squirrel
      : a.kind === 'deer' ? (a.buck ? rigs.buck : rigs.doe) : a.tusks ? rigs.tusker : rigs.sow;
    const k = KINDS[a.kind], move = Math.min(1, a.move), run = Math.max(0, a.move - 1) / 0.6; // 0..1 each
    const climbing = a.kind === 'squirrel' && a.climb > 0;
    const gait = Math.sin(a.phase * Math.PI);
    const bob = Math.abs(gait) * (a.kind === 'squirrel' ? 0.04 : 0.02 + run * 0.05) * move;
    // deer bound: the body rocks with the stride when running
    e.set(climbing ? -Math.PI / 2 : a.kind === 'deer' ? gait * 0.1 * run : 0, a.yaw, 0, 'YXZ');
    q.setFromEuler(e);
    one.setScalar(k.size);
    v.set(a.x, a.y + bob, a.z);
    if (climbing) v.y += 0.1;
    body.compose(v, q, one);
    const amp = (a.kind === 'squirrel' ? 0.8 : 0.35 + run * 0.35) * move;
    for (const p of rig) {
      const pool = pools[p[0]];
      if (pool.n >= pool.mesh.instanceMatrix.count) continue;
      const mo = p[5];
      if (mo && mo.leg !== undefined) { // legs hang from the hip (the unit stick's middle half its length below), swinging
        const angle = Math.sin(a.phase * Math.PI + mo.leg) * amp;
        part.copy(p.rest).setPosition(0, -p[3][1] / 2, 0).premultiply(tmp.makeRotationX(angle)).premultiply(swing.makeTranslation(...mo.hinge));
      } else {
        part.copy(p.rest).setPosition(p[2][0], p[2][1], p[2][2]);
        let angle = 0;
        if (mo && mo.head) angle = (a.root * (a.kind === 'deer' ? 1.0 : 0.45) - a.look * 0.25) * mo.head;
        else if (mo && mo.tail) angle = a.kind === 'squirrel' ? Math.sin(a.phase * 1.5) * 0.12 * move : Math.sin(a.phase * 2.5) * 0.35;
        if (angle) { // turned round its hinge (the neck, the tail's root)
          const [hx, hy, hz] = mo.hinge;
          swing.makeTranslation(hx, hy, hz).multiply(tmp.makeRotationX(angle)).multiply(tmp.makeTranslation(-hx, -hy, -hz));
          part.premultiply(swing);
        }
      }
      part.premultiply(body);
      part.toArray(pool.mesh.instanceMatrix.array, pool.n * 16);
      pool.mesh.instanceColor.array.set(p.color, pool.n * 3);
      pool.n++;
    }
  }

  return {
    group,
    life,
    sites: sites.length,
    update(dt, camera, player) {
      const c = camera.position;
      life.update(dt, c, player);
      if (!life.animals.length && !wasDrawing) return; // far from the woods: nothing to do
      for (const pool of Object.values(pools)) pool.n = 0;
      for (const a of life.animals) if (Math.hypot(a.x - c.x, a.z - c.z) < ACTIVE) draw(a);
      wasDrawing = life.animals.length > 0;
      for (const pool of Object.values(pools)) {
        pool.mesh.count = pool.n;
        pool.mesh.instanceMatrix.needsUpdate = true;
        pool.mesh.instanceColor.needsUpdate = true;
      }
    },
  };
}

export { buildWildlife, planSites, Wildlife, KINDS };
