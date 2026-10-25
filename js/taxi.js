// js/taxi.js
// The taxi driver: fares for "Taxi Bielany" (the player's fictional cab) from passengers waving on the sidewalk near
// the player to real OpenStreetMap addresses 0.8-3 km away. Car only. The pay comes from the route; on top of the
// stars for time, the passenger rates the ride's comfort (0-100): hard braking, crashes and red lights cost points,
// and a comfortable ride brings a tip. Offers sit in the phone's Zlecenia app beside the courier's.

import { GEO } from './bielany-geodata.js';
import { findRoute } from './gps-route.js';
import { signalPhase } from './city-config.js';

const BRAND = 'Taxi Bielany';
const OFFERS = 2;
const PICKUP_MIN = 120, PICKUP_MAX = 700; // m from the player to the passenger
const RIDE_MIN = 800, RIDE_MAX = 3000; // m along the streets
const PACE = 8.5; // m/s by car, lights included
const PAR_EXTRA = 25; // s
const FLAG = 9; // zł flag fall
const PER_KM = 3.6; // zł per km
const TIP_SHARE = 0.45; // share of the fare at a perfect ride
const STORE_KEY = 'bielany-taxi';
// Comfort: deductions
const HARD_BRAKE = 5.5; // m/s² of deceleration above 4 m/s
const CRASH = 14; // m/s² of deceleration: an impact, not braking
const COST = { brake: 8, crash: 20, red: 15 };
const COOLDOWN = 1.5; // s between two deductions of one kind

const STREETS = GEO.addresses.streets;
const ADDRESSES = GEO.addresses.list;
const addressName = (a) => `${STREETS[a[0]]} ${a[1]}`;
const rides = (n) => {
  const t = n % 100, u = n % 10;
  return `${n} ${n === 1 ? 'kurs' : u >= 2 && u <= 4 && (t < 12 || t > 14) ? 'kursy' : 'kursów'}`;
};

// Directed road edges on a 100 m grid, for knowing which approach of a junction the car comes in by
function edgeGrid(network) {
  const grid = new Map();
  for (const e of network?.edges || []) {
    const n = Math.max(1, Math.ceil(e.span / 50));
    for (let k = 0; k <= n; k++) {
      const x = e.x0 + e.dx * (e.span * k) / n, z = e.z0 + e.dz * (e.span * k) / n;
      const key = Math.floor(x / 100) * 100000 + Math.floor(z / 100);
      if (!grid.has(key)) grid.set(key, new Set());
      grid.get(key).add(e);
    }
  }
  return grid;
}

class Taxi {
  /**
   * missions: the MissionEngine; network: the traffic road network (red lights), optional; random: () => [0, 1)
   */
  constructor(missions, network, { random = Math.random, storage = globalThis.localStorage } = {}) {
    this.missions = missions;
    this.random = random;
    this.storage = storage;
    this.grid = edgeGrid(network);
    this.offers = [];
    this.serial = 0;
    this.near = null; // () => player position
    this.stats = { rides: 0, earned: 0, tips: 0 };
    this.ride = null; // the comfort of the ride under way
    try {
      const saved = JSON.parse(storage?.getItem(STORE_KEY) || 'null');
      if (saved) this.stats = { ...this.stats, ...saved };
    } catch { /* storage is optional */ }
    missions.on('state', (m) => {
      if (m.role !== 'taxi') return;
      if (m.state === 'enRoute') this.ride = { comfort: 100, brakes: 0, crashes: 0, reds: 0, cool: { brake: 0, crash: 0, red: 0 }, lastSpeed: null, lastNode: null };
      if (['delivered', 'late', 'abandoned'].includes(m.state)) {
        if (m.state !== 'abandoned') {
          this.stats.rides++;
          this.stats.earned += m.paid;
          this.stats.tips += m.tip || 0;
          this.save();
        }
        this.ride = null;
        this.offers = [];
      }
    });
  }

  save() {
    try { this.storage?.setItem(STORE_KEY, JSON.stringify(this.stats)); } catch { /* storage is optional */ }
  }

  makeOffer(near) {
    if (!near) return null;
    for (let tries = 0; tries < 40; tries++) {
      const pick = ADDRESSES[Math.floor(this.random() * ADDRESSES.length)];
      const d0 = Math.hypot(pick[4] - near.x, pick[5] - near.z);
      if (d0 < PICKUP_MIN || d0 > PICKUP_MAX) continue;
      const ring = ADDRESSES.filter((a) => {
        const d = Math.hypot(a[4] - pick[4], a[5] - pick[5]);
        return d > RIDE_MIN * 0.6 && d < RIDE_MAX * 0.85;
      });
      const a = ring[Math.floor(this.random() * ring.length)];
      if (!a || this.offers.some((o) => o.target.name === addressName(a))) continue;
      const r = findRoute(pick[4], pick[5], a[4], a[5], { oneWay: true });
      if (!r || r.length < RIDE_MIN || r.length > RIDE_MAX) continue;
      const fare = Math.round(FLAG + (PER_KM * r.length) / 1000);
      const taxi = this;
      return {
        id: `taxi-${++this.serial}`,
        title: `Kurs · ${BRAND}`,
        role: 'taxi',
        start: { x: pick[4], z: pick[5], name: `pasażer, ${addressName(pick)}` },
        target: { x: a[4], z: a[5], name: addressName(a) },
        from: addressName(pick),
        to: addressName(a),
        distance: r.length,
        vehicles: ['car'],
        par: Math.round(r.length / PACE + PAR_EXTRA),
        reward: fare,
        onFinish(m) { taxi.finish(m); },
      };
    }
    return null;
  }

  refill() {
    const near = this.near?.();
    while (this.offers.length < OFFERS) {
      const o = this.makeOffer(near);
      if (!o) break;
      this.offers.push(o);
    }
    return this.offers;
  }

  accept(id) {
    const o = this.offers.find((x) => x.id === id);
    if (!o || this.missions.active) return false;
    this.missions.offer(o);
    this.offers = this.offers.filter((x) => x !== o);
    return this.missions.accept(o.id);
  }

  jobs() {
    if (this.missions.active) return [];
    if (!this.offers.length) this.refill();
    return this.offers.map((o) => ({
      id: o.id, title: o.title, from: o.from, to: o.to, distance: o.distance, par: o.par, reward: o.reward,
      vehicles: 'tylko autem', accept: () => this.accept(o.id),
    }));
  }

  // The tip and the comfort stay on the mission (m.comfort, m.tip) and add to its pay
  finish(m) {
    const c = this.ride ? Math.max(0, Math.round(this.ride.comfort)) : 100;
    m.comfort = c;
    m.tip = c >= 50 && m.stars > 0 ? Math.round(m.reward * TIP_SHARE * ((c - 50) / 50) ** 1.5) : 0;
    m.paid += m.tip;
    m.rideNotes = this.ride ? { brakes: this.ride.brakes, crashes: this.ride.crashes, reds: this.ride.reds } : null;
  }

  deduct(kind) {
    const r = this.ride;
    if (r.cool[kind] > 0) return null;
    r.cool[kind] = COOLDOWN;
    r.comfort -= COST[kind];
    r[kind === 'brake' ? 'brakes' : kind === 'crash' ? 'crashes' : 'reds']++;
    return kind;
  }

  /**
   * One frame of a ride: player = { x, z, speed (m/s, signed), mode, heading? }, time: the signal clock (s).
   * Returns 'brake' | 'crash' | 'red' when the passenger just noticed one (for the HUD), else null.
   */
  update(dt, player, time) {
    const m = this.missions.active, r = this.ride;
    if (!m || m.role !== 'taxi' || m.state !== 'enRoute' || !r) return null;
    for (const k of Object.keys(r.cool)) r.cool[k] = Math.max(0, r.cool[k] - dt);
    const v = Math.abs(player.speed);
    let note = null;
    if (r.lastSpeed !== null && dt > 0) {
      const decel = (r.lastSpeed - v) / dt;
      if (decel > CRASH && r.lastSpeed > 3) note = this.deduct('crash');
      else if (decel > HARD_BRAKE && r.lastSpeed > 4) note = this.deduct('brake') || note;
    }
    r.lastSpeed = v;
    // red lights: the approach the car is on, as it reaches the junction
    if (v > 2 && this.grid.size) {
      const list = this.grid.get(Math.floor(player.x / 100) * 100000 + Math.floor(player.z / 100));
      let best = null, bd = 6;
      const hx = Math.sin(player.heading ?? 0), hz = Math.cos(player.heading ?? 0);
      for (const e of list || []) {
        if (e.dx * hx + e.dz * hz < 0.7) continue;
        const t = (player.x - e.x0) * e.dx + (player.z - e.z0) * e.dz;
        if (t < 0 || t > e.span) continue;
        const d = Math.abs((player.x - e.x0) * e.rx + (player.z - e.z0) * e.rz);
        if (d < bd) { bd = d; best = { e, left: e.span - t }; }
      }
      if (best && best.e.to.signal && best.left < 4 && r.lastNode !== best.e.to) {
        r.lastNode = best.e.to;
        if (signalPhase(time, best.e.axisIndex === 0) === 'red') note = this.deduct('red') || note;
      }
    }
    return note;
  }

  statusLine() {
    const s = this.stats;
    return s.rides ? `${BRAND} · ${rides(s.rides)} · ${s.earned} zł (napiwki ${s.tips} zł)` : `${BRAND} · weź kurs w Zleceniach`;
  }
}

export { Taxi, BRAND, COST };
