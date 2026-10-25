// js/firefighter.js
// The firefighter (step 3.6): calls from the fire service's duty officer to real OpenStreetMap addresses 0.3-1.8 km
// from the player, three kinds:
// - a fire: smoke and flames from a window of the building at the address (GUGiK LoD1), put out with the water cannon
//   on the truck's roof (hold G near the fire; the fire grows back a little while nobody sprays);
// - a flooded basement: the pump runs for its countdown while the truck stands by the building (G starts it);
// - a cat up a tree: a real tree (GUGiK, GEO.trees) by the street, the ladder reaches it (hold G).
// Drive there in the fire engine (the player's car, re-bodied: js/fire-engine.js) on lights and siren. Two clocks, two
// sets of stars: the response (call to arrival) and the action (arrival to done); the call keeps the lower. No graphics
// or DOM here: the engine's look follows `scene()`.
//
// In the mission engine (js/missions.js) the start is the spot in the street by the incident and the target is the
// same spot: while the action runs the target's radius is below zero (nobody can be there), when it is done the
// radius opens and stopping there ends the call.

import { GEO } from './bielany-geodata.js';
import { findRoute } from './gps-route.js';

const SERVICE = 'Straż pożarna';
const DISPATCH = 'Dyżurny straży';
const CALL_MIN = 300, CALL_MAX = 1800; // m from the player
const PACE = 12; // m/s on lights and siren
const PAR_EXTRA = 20; // s
const BASE = 30, PER_KM = 4; // zł
const STORE_KEY = 'bielany-firefighter';
const ARRIVE = 15; // m from the street spot: the truck is long
const DONE_RADIUS = 40; // m: where stopping ends the call once the action is done
const STOPPED = 2; // m/s
const REACH = { fire: 45, flood: 22, cat: 14 }; // m from the player to the fire / building / tree
const PUMP_TIME = 30; // s of pumping
const LADDER_TIME = 10; // s to reach the cat
const REGROW = 0.015; // share of the fire per s back while nobody sprays
const KINDS = ['fire', 'flood', 'cat'];
const NAMES = { fire: 'Pożar', flood: 'Zalana piwnica', cat: 'Kot na drzewie' };
const REASONS = {
  fire: ['dym z okna mieszkania', 'pali się w kuchni', 'ogień na balkonie', 'zapach dymu na klatce, widać płomienie'],
  flood: ['woda w piwnicy po ulewie', 'pękła rura w piwnicy', 'zalane komórki lokatorskie', 'woda w garażu podziemnym'],
  cat: ['kot od rana siedzi na drzewie', 'kotek nie umie zejść z drzewa', 'kot sąsiadki utknął na gałęzi'],
};

const STREETS = GEO.addresses.streets;
const ADDRESSES = GEO.addresses.list;
const addressName = (a) => `${STREETS[a[0]]} ${a[1]}`;

// 3 stars within par, 2 within par × 1.35, 1 within par × 1.8, else 0 (as the paramedic's)
const starsOf = (t, par) => (t <= par ? 3 : t <= par * 1.35 ? 2 : t <= par * 1.8 ? 1 : 0);

// The building at an address: the one whose outline is nearest the address point (LoD1, over 6 m and under 60 m)
function buildingAt(x, z, skip) {
  let best = null, bd = 30;
  GEO.buildings.forEach(([r, , h], id) => {
    if (!(h >= 6 && h <= 60) || skip?.has(id)) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let k = 0; k < r.length; k += 2) {
      minX = Math.min(minX, r[k]); maxX = Math.max(maxX, r[k]);
      minZ = Math.min(minZ, r[k + 1]); maxZ = Math.max(maxZ, r[k + 1]);
    }
    if (x < minX - bd || x > maxX + bd || z < minZ - bd || z > maxZ + bd) return;
    for (let k = 0; k < r.length; k += 2) {
      const ax = r[k], az = r[k + 1], bx = r[(k + 2) % r.length], bz = r[(k + 3) % r.length];
      const d = segDist(x, z, ax, az, bx, bz);
      if (d < bd) { bd = d; best = { id, ring: r, h }; }
    }
  });
  return best;
}

function segDist(px, pz, ax, az, bx, bz, out) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  const qx = ax + dx * t, qz = az + dz * t;
  if (out) { out.x = qx; out.z = qz; out.t = t; }
  return Math.hypot(px - qx, pz - qz);
}

// Where the fire burns: on the wall facing the street spot (sx, sz), one storey of it; the smoke goes up past the roof
function fireOn(b, sx, sz, random, groundY = () => 0) {
  const r = b.ring;
  let cx = 0, cz = 0;
  for (let k = 0; k < r.length; k += 2) { cx += r[k]; cz += r[k + 1]; }
  cx /= r.length / 2; cz /= r.length / 2;
  let best = null, bd = Infinity;
  const q = {};
  for (let k = 0; k < r.length; k += 2) {
    const ax = r[k], az = r[k + 1], bx = r[(k + 2) % r.length], bz = r[(k + 3) % r.length];
    const d = segDist(sx, sz, ax, az, bx, bz, q);
    if (d < bd) bd = d, best = { ax, az, bx, bz, x: q.x, z: q.z, len: Math.hypot(bx - ax, bz - az) };
  }
  let base = 0; // the building's foot: the lowest ground under its outline (js/buildings.js)
  for (let k = 0; k < r.length; k += 2) base = Math.min(base, groundY(r[k], r[k + 1]));
  const ux = (best.bx - best.ax) / (best.len || 1), uz = (best.bz - best.az) / (best.len || 1);
  // outward: away from the middle of the building
  let nx = uz, nz = -ux;
  if ((best.x - cx) * nx + (best.z - cz) * nz < 0) nx = -nx, nz = -nz;
  const floors = Math.max(1, Math.floor(b.h / 3));
  const floor = Math.floor(random() * Math.min(floors, 6));
  return {
    building: b.id,
    x: best.x + nx * 0.4, z: best.z + nz * 0.4,
    y: base + floor * 3 + 1.6, // the middle of the window band
    roof: base + b.h,
    width: Math.min(best.len * 0.8, 8),
    dir: { x: ux, z: uz }, normal: { x: nx, z: nz },
    floor,
  };
}

// The tree for the cat: a GUGiK tree over 7 m with a crown off the ground, 4-14 m from a street spot
const CELL = 16; // m: the trees' lookup grid
let treeGrid = null;
function treesAround(x, z) {
  if (!treeGrid) {
    treeGrid = new Map();
    const t = GEO.trees;
    for (let k = 0; k < t.length; k += 5) {
      const key = `${Math.floor(t[k] / CELL)},${Math.floor(t[k + 1] / CELL)}`;
      if (!treeGrid.has(key)) treeGrid.set(key, []);
      treeGrid.get(key).push(k);
    }
  }
  const out = [];
  const i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL);
  for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) out.push(...(treeGrid.get(`${i},${j}`) || []));
  return out;
}

function treeNear(sx, sz, groundY = () => 0) {
  const t = GEO.trees;
  let best = null, bd = Infinity;
  for (const k of treesAround(sx, sz)) {
    const d = Math.hypot(t[k] - sx, t[k + 1] - sz);
    if (d < 4 || d > 14 || t[k + 2] < 7 || t[k + 3] < 2) continue;
    if (d < bd) bd = d, best = { x: t[k], z: t[k + 1], height: t[k + 2], crownBase: t[k + 3], crown: t[k + 4] };
  }
  if (!best) return null;
  const g = groundY(best.x, best.z);
  const d = Math.hypot(sx - best.x, sz - best.z) || 1;
  const out = Math.min(best.crown * 0.55, 2);
  // the cat sits on a branch on the street side, a little into the crown
  best.cat = { x: best.x + ((sx - best.x) / d) * out, z: best.z + ((sz - best.z) / d) * out, y: g + Math.min(best.crownBase + 1.5, best.height - 1.5) };
  best.ground = g;
  return best;
}

class Firefighter {
  /**
   * options: random, storage, skip (Set of building ids drawn as landmarks: no fire there), ground(x, z) -> the
   * ground's height (js/terrain.js groundY; flat without it)
   */
  constructor(missions, { random = Math.random, storage = globalThis.localStorage, skip = null, ground = () => 0 } = {}) {
    this.missions = missions;
    this.random = random;
    this.storage = storage;
    this.skip = skip;
    this.ground = ground;
    this.offers = [];
    this.serial = 0;
    this.near = null; // () -> the player's position
    this.player = null; // () -> { x, z, speed, mode }
    this.holding = false; // G held
    this.action = null; // the incident being worked on: what js/fire-engine.js draws
    this.response = 0; // s since the call was taken
    this.onFrame = null; // (dt) after each update: the look
    this.stats = { calls: 0, earned: 0 };
    try {
      const saved = JSON.parse(storage?.getItem(STORE_KEY) || 'null');
      if (saved) this.stats = { ...this.stats, ...saved };
    } catch { /* storage is optional */ }
    missions.on('state', (m) => {
      if (m.role !== 'firefighter') return;
      if (m.state === 'accepted') {
        this.response = 0;
        this.action = { kind: m.kind, incident: m.incident, phase: 'drive', progress: 0, running: false, spraying: false, done: false, hint: '' };
      }
      if (m.state === 'enRoute') {
        m.responseTime = this.response;
        m.radius = -1; // the action first
        this.action.phase = 'work';
      }
      if (m.state === 'delivered' || m.state === 'late') {
        this.stats.calls++;
        this.stats.earned += m.paid;
        this.save();
      }
      if (['delivered', 'late', 'abandoned'].includes(m.state)) {
        this.offers = [];
        if (this.action) this.action.phase = m.state === 'abandoned' ? 'gone' : 'after';
      }
    });
  }

  save() {
    try { this.storage?.setItem(STORE_KEY, JSON.stringify(this.stats)); } catch { /* storage is optional */ }
  }

  makeOffer(near, kind) {
    if (!near) return null;
    for (let tries = 0; tries < 60; tries++) {
      const a = ADDRESSES[Math.floor(this.random() * ADDRESSES.length)];
      const d = Math.hypot(a[4] - near.x, a[5] - near.z);
      if (d < CALL_MIN || d > CALL_MAX) continue;
      let incident, par;
      if (kind === 'cat') {
        const tree = treeNear(a[4], a[5], this.ground);
        if (!tree) continue;
        incident = { kind, x: a[4], z: a[5], tree };
        par = LADDER_TIME + 15;
      } else {
        const b = buildingAt(a[2], a[3], this.skip);
        if (!b) continue;
        if (kind === 'fire') {
          const fire = fireOn(b, a[4], a[5], this.random, this.ground);
          if (Math.hypot(fire.x - a[4], fire.z - a[5]) > REACH.fire - 10) continue; // the cannon reaches it from the street
          incident = { kind, x: a[4], z: a[5], fire, spray: Math.round(14 + Math.min(b.h, 30) * 0.5) };
          par = incident.spray + 15;
        } else {
          const f = fireOn(b, a[4], a[5], () => 0, this.ground); // the ground floor's wall: where the hose goes in
          if (Math.hypot(f.x - a[4], f.z - a[5]) > REACH.flood - 6) continue; // the hose reaches it from the street
          incident = { kind, x: a[4], z: a[5], wall: { x: f.x, z: f.z, y: f.y - 1.6, normal: f.normal } };
          par = PUMP_TIME + 15;
        }
      }
      const route = findRoute(near.x, near.z, a[4], a[5]);
      if (!route) continue;
      const self = this;
      const where = addressName(a);
      return {
        id: `fire-${++this.serial}`,
        title: `${NAMES[kind]} · ${SERVICE}`,
        role: 'firefighter',
        kind,
        incident,
        reason: REASONS[kind][Math.floor(this.random() * REASONS[kind].length)],
        start: { x: a[4], z: a[5], name: `${NAMES[kind].toLowerCase()}, ${where}` },
        target: { x: a[4], z: a[5], name: `akcja, ${where}` },
        from: where,
        to: NAMES[kind],
        radius: ARRIVE,
        distance: route.length,
        vehicles: ['car'],
        par,
        limit: Math.round(par * 1.8),
        responsePar: Math.round(route.length / PACE + PAR_EXTRA),
        reward: Math.round(BASE + (PER_KM * route.length) / 1000 + (kind === 'fire' ? 15 : 0)),
        onFinish(m) { self.finish(m); },
      };
    }
    return null;
  }

  // One call of each kind waiting (one per refill, the ones not found this time come next time)
  refill() {
    const near = this.near?.();
    for (const kind of KINDS) {
      if (this.offers.some((o) => o.kind === kind)) continue;
      const o = this.makeOffer(near, kind);
      if (o) this.offers.push(o);
    }
    return this.offers;
  }

  accept(id) {
    const o = this.offers.find((x) => x.id === id);
    if (!o || this.missions.active) return false;
    const m = this.missions.offer(o);
    Object.assign(m, { responsePar: o.responsePar, reason: o.reason, kind: o.kind, incident: o.incident }); // before 'accepted'
    this.offers = [];
    return this.missions.accept(o.id);
  }

  jobs() {
    if (this.missions.active) return [];
    this.refill();
    return this.offers.map((o) => ({
      id: o.id, title: o.title, from: `${o.from} (${o.reason})`, to: o.to, distance: o.distance, par: o.responsePar + o.par,
      reward: o.reward, vehicles: 'wozem strażackim (auto)', accept: () => this.accept(o.id),
    }));
  }

  hold(on) {
    this.holding = Boolean(on);
  }

  // The lower of the response and action stars; the pay follows them
  finish(m) {
    m.responseStars = starsOf(m.responseTime ?? 0, m.responsePar || m.par);
    m.actionStars = m.stars;
    m.stars = Math.min(m.stars, m.responseStars);
    m.paid = Math.round((m.reward * Math.max(m.stars, 0.5)) / 3);
  }

  /** Distance from the player to what the action needs: the fire, the building's wall, the cat's tree */
  reachOf(a, p) {
    const i = a.incident;
    const at = i.kind === 'fire' ? i.fire : i.kind === 'flood' ? i.wall : i.tree;
    return Math.hypot(p.x - at.x, p.z - at.z);
  }

  update(dt) {
    const m = this.missions.active;
    if (m && m.role === 'firefighter') {
      if (m.state === 'accepted') this.response += dt;
      if (m.state === 'enRoute' && this.action && !this.action.done) this.work(m, dt);
    }
    this.onFrame?.(dt);
  }

  // The action on the spot: progress 0..1 and the hint for the HUD
  work(m, dt) {
    const a = this.action;
    const p = this.player?.() || { ...(this.near?.() || { x: 0, z: 0 }), speed: 0, mode: 'car' };
    const close = this.reachOf(a, p) <= REACH[a.kind];
    const ready = close && p.mode === 'car' && Math.abs(p.speed) < STOPPED;
    a.spraying = false;
    if (a.kind === 'fire') {
      if (ready && this.holding) {
        a.spraying = true;
        a.progress += dt / a.incident.spray;
      } else if (a.progress > 0) {
        a.progress = Math.max(0, a.progress - REGROW * dt);
      }
      a.hint = !close ? `Podjedź bliżej ognia (do ${REACH.fire} m)` : !ready ? 'Zatrzymaj wóz' : a.spraying ? `Gaszenie ${Math.round(a.progress * 100)}%` : 'Trzymaj G: woda z działka';
    } else if (a.kind === 'flood') {
      if (ready && this.holding) a.running = true;
      if (a.running && close && p.mode === 'car') a.progress += dt / PUMP_TIME;
      const left = Math.max(0, Math.ceil(PUMP_TIME * (1 - a.progress)));
      a.hint = !close ? `Podjedź pod budynek (do ${REACH.flood} m)` : !a.running ? (ready ? 'Naciśnij G: pompa' : 'Zatrzymaj wóz') : `Pompowanie, jeszcze ${left} s`;
    } else {
      if (ready && this.holding) a.progress += dt / LADDER_TIME;
      a.hint = !close ? `Podjedź bliżej drzewa (do ${REACH.cat} m)` : !ready ? 'Zatrzymaj wóz' : this.holding ? `Drabina ${Math.round(a.progress * 100)}%` : 'Trzymaj G: drabina do kota';
    }
    if (a.progress >= 1) {
      a.progress = 1;
      a.done = true;
      a.spraying = false;
      a.hint = 'Gotowe. Zostań na miejscu, akcja się kończy';
      m.radius = DONE_RADIUS; // stopping here ends the call (js/missions.js)
    }
  }

  /** What js/fire-engine.js draws: the incident and its action, or null */
  scene() {
    return this.action && this.action.phase !== 'gone' ? this.action : null;
  }

  /** The incident is over and drawn no more (the cat walked off, the smoke cleared) */
  clear() {
    this.action = null;
  }

  statusLine() {
    const s = this.stats;
    return s.calls ? `${SERVICE} · akcje: ${s.calls} · ${s.earned} zł` : `${SERVICE} · czekamy na wezwania`;
  }
}

export { Firefighter, SERVICE, DISPATCH, NAMES, PUMP_TIME, LADDER_TIME, REACH, starsOf, buildingAt, treeNear, fireOn };
