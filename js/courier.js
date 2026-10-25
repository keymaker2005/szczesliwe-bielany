// js/courier.js
// The courier role: parcels for "Pocztylion Bielański" (a fictional courier firm) from pick-up points by the three M1
// stations to real OpenStreetMap addresses 0.5-2 km away along the streets. By bike or by car; the par time is the
// GPS route at a steady bike pace, a delivery well under it (a shortcut through a park, along a path) pays a bonus.
// Offers sit in the phone's Zlecenia app; the earnings stay in this browser (localStorage).

import { GEO } from './bielany-geodata.js';
import { findRoute } from './gps-route.js';

const COMPANY = 'Pocztylion Bielański';
const OFFERS = 3;
const MIN_ROUTE = 500; // m along the streets from the pick-up
const MAX_ROUTE = 2000;
const PACE = 5.5; // m/s by bike, lights and junctions included
const PAR_EXTRA = 20; // s: parking, the walk to the door
const BASE_PAY = 8; // zł per parcel
const PAY_PER_KM = 6; // zł per km of route
const SHORTCUT_BONUS = 0.25;
const STORE_KEY = 'bielany-courier';
const VEHICLES = ['cyclist', 'car'];

const STREETS = GEO.addresses.streets;
const ADDRESSES = GEO.addresses.list;
const addressName = (a) => `${STREETS[a[0]]} ${a[1]}`;
// 1 dostawa, 2-4 dostawy, 5-21 dostaw, 22-24 dostawy ...
const deliveries = (n) => {
  const t = n % 100, u = n % 10;
  return `${n} ${n === 1 ? 'dostawa' : u >= 2 && u <= 4 && (t < 12 || t > 14) ? 'dostawy' : 'dostaw'}`;
};

// Pick-up points: the sidewalk address spot nearest each M1 station
const PICKUPS = GEO.stations.map((s) => {
  let best = null, bd = Infinity;
  for (const a of ADDRESSES) {
    const d = Math.hypot(a[4] - s.x, a[5] - s.z);
    if (d < bd) { bd = d; best = a; }
  }
  return { id: s.name, name: `Punkt odbioru, metro ${s.name}`, short: `metro ${s.name}`, x: best[4], z: best[5] };
});

class Courier {
  /**
   * missions: the MissionEngine; random: () => [0, 1) (tests pass a seeded one)
   */
  constructor(missions, { random = Math.random, storage = globalThis.localStorage } = {}) {
    this.missions = missions;
    this.random = random;
    this.storage = storage;
    this.offers = [];
    this.serial = 0;
    this.stats = { deliveries: 0, earned: 0, stars: 0 };
    try {
      const saved = JSON.parse(storage?.getItem(STORE_KEY) || 'null');
      if (saved) this.stats = { ...this.stats, ...saved };
    } catch { /* storage is optional */ }
    missions.on('state', (m) => {
      if (m.role !== 'courier' || !m.id.startsWith('poczt-')) return;
      if (m.state === 'delivered' || m.state === 'late') {
        this.stats.deliveries++;
        this.stats.earned += m.paid;
        this.stats.stars += m.stars;
        this.save();
      }
      if (['delivered', 'late', 'abandoned'].includes(m.state)) this.refill(true);
    });
  }

  save() {
    try { this.storage?.setItem(STORE_KEY, JSON.stringify(this.stats)); } catch { /* storage is optional */ }
  }

  // One offer from a random pick-up (the nearest to the player first) to a random address in range
  makeOffer(near) {
    const pickups = near
      ? [...PICKUPS].sort((a, b) => Math.hypot(a.x - near.x, a.z - near.z) - Math.hypot(b.x - near.x, b.z - near.z))
      : PICKUPS;
    for (let tries = 0; tries < 40; tries++) {
      // two in three from the nearest pick-up
      const p = pickups[this.random() < 0.67 ? 0 : 1 + Math.floor(this.random() * (pickups.length - 1))];
      const ring = ADDRESSES.filter((a) => {
        const d = Math.hypot(a[4] - p.x, a[5] - p.z);
        return d > MIN_ROUTE * 0.6 && d < MAX_ROUTE * 0.9;
      });
      const a = ring[Math.floor(this.random() * ring.length)];
      if (!a || this.offers.some((o) => o.target.name === addressName(a))) continue;
      const r = findRoute(p.x, p.z, a[4], a[5]);
      if (!r || r.length < MIN_ROUTE || r.length > MAX_ROUTE) continue;
      const km = r.length / 1000;
      return {
        id: `poczt-${++this.serial}`,
        title: `Paczka · ${COMPANY}`,
        role: 'courier',
        start: { x: p.x, z: p.z, name: p.name },
        target: { x: a[4], z: a[5], name: addressName(a) },
        from: p.short,
        to: addressName(a),
        distance: r.length,
        vehicles: VEHICLES,
        par: Math.round(r.length / PACE + PAR_EXTRA),
        reward: Math.round(BASE_PAY + PAY_PER_KM * km),
        bonus: SHORTCUT_BONUS,
      };
    }
    return null;
  }

  // Tops the offers up to OFFERS (all new after a delivery: fresh parcels from where the player now is)
  refill(fresh = false, near = null) {
    if (fresh) this.offers = [];
    while (this.offers.length < OFFERS) {
      const o = this.makeOffer(near || this.near?.());
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

  // The phone's job list
  jobs() {
    if (!this.offers.length) this.refill();
    return this.offers.map((o) => ({
      id: o.id, title: o.title, from: o.from, to: o.to, distance: o.distance, par: o.par, reward: o.reward,
      vehicles: 'rowerem lub autem', accept: () => this.accept(o.id),
    }));
  }

  statusLine() {
    const s = this.stats;
    return s.deliveries ? `${COMPANY} · ${deliveries(s.deliveries)} · ${s.earned} zł` : `${COMPANY} · zacznij od Zleceń`;
  }
}

export { Courier, PICKUPS, COMPANY, MIN_ROUTE, MAX_ROUTE, deliveries };
