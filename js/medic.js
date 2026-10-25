// js/medic.js
// The paramedic: emergency calls from the medical dispatcher to real OpenStreetMap addresses 0.3-1.8 km from the
// player; drive there in the ambulance (the player's car, re-bodied: js/ambulance.js) on lights and siren, pick the
// patient up and take them to the Szpital Bielański emergency entrance. Two clocks, two sets of stars: the response
// (accept to patient) and the transport (patient to hospital); the mission keeps the lower. Calls are described in
// general words only (no injuries shown).

import { GEO } from './bielany-geodata.js';
import { findRoute } from './gps-route.js';

const SERVICE = 'Ratownictwo medyczne';
const DISPATCH = 'Dyspozytor medyczny';
const CALL_MIN = 300, CALL_MAX = 1800; // m from the player
const PACE = 12; // m/s on lights and siren
const PAR_EXTRA = 20; // s
const BASE = 25, PER_KM = 4; // zł
const STORE_KEY = 'bielany-medic';
const REASONS = [
  'osoba starsza zasłabła w domu', 'upadek na schodach, pacjent przytomny', 'silny ból brzucha', 'duszności',
  'wysoka gorączka u dziecka', 'skręcona kostka po upadku', 'zawroty głowy, pacjent siedzi', 'uraz ręki przy pracy w ogrodzie',
];

const STREETS = GEO.addresses.streets;
const ADDRESSES = GEO.addresses.list;
const addressName = (a) => `${STREETS[a[0]]} ${a[1]}`;

// The emergency entrance: the sidewalk spot of Cegłowska 80, else the address spot nearest the hospital's middle
const HOSPITAL = (() => {
  const own = ADDRESSES.find((a) => STREETS[a[0]] === 'Cegłowska' && a[1] === '80');
  let best = own, bd = Infinity;
  if (!best) for (const a of ADDRESSES) { const d = Math.hypot(a[4] - 111.8, a[5] + 529.9); if (d < bd) { bd = d; best = a; } }
  return { x: best[4], z: best[5], name: 'Szpital Bielański, SOR' };
})();

// 3 stars within par, 2 within par × 1.35, 1 within par × 1.8, else 0
const starsOf = (t, par) => (t <= par ? 3 : t <= par * 1.35 ? 2 : t <= par * 1.8 ? 1 : 0);

class Medic {
  constructor(missions, { random = Math.random, storage = globalThis.localStorage } = {}) {
    this.missions = missions;
    this.random = random;
    this.storage = storage;
    this.offers = [];
    this.serial = 0;
    this.near = null;
    this.response = 0; // s since the call was taken
    this.stats = { calls: 0, earned: 0 };
    try {
      const saved = JSON.parse(storage?.getItem(STORE_KEY) || 'null');
      if (saved) this.stats = { ...this.stats, ...saved };
    } catch { /* storage is optional */ }
    missions.on('state', (m) => {
      if (m.role !== 'medic') return;
      if (m.state === 'accepted') this.response = 0;
      if (m.state === 'enRoute') m.responseTime = this.response;
      if (m.state === 'delivered' || m.state === 'late') {
        this.stats.calls++;
        this.stats.earned += m.paid;
        this.save();
      }
      if (['delivered', 'late', 'abandoned'].includes(m.state)) this.offers = [];
    });
  }

  save() {
    try { this.storage?.setItem(STORE_KEY, JSON.stringify(this.stats)); } catch { /* storage is optional */ }
  }

  makeOffer(near) {
    if (!near) return null;
    for (let tries = 0; tries < 40; tries++) {
      const a = ADDRESSES[Math.floor(this.random() * ADDRESSES.length)];
      const d = Math.hypot(a[4] - near.x, a[5] - near.z);
      if (d < CALL_MIN || d > CALL_MAX) continue;
      const toPatient = findRoute(near.x, near.z, a[4], a[5]);
      const toHospital = findRoute(a[4], a[5], HOSPITAL.x, HOSPITAL.z);
      if (!toPatient || !toHospital || toHospital.length < 150) continue;
      const medic = this;
      const responsePar = Math.round(toPatient.length / PACE + PAR_EXTRA);
      return {
        id: `medic-${++this.serial}`,
        title: `Wezwanie · ${SERVICE}`,
        role: 'medic',
        reason: REASONS[Math.floor(this.random() * REASONS.length)],
        start: { x: a[4], z: a[5], name: `pacjent, ${addressName(a)}` },
        target: HOSPITAL,
        from: addressName(a),
        to: HOSPITAL.name,
        distance: toPatient.length + toHospital.length,
        vehicles: ['car'],
        par: Math.round(toHospital.length / PACE + PAR_EXTRA),
        limit: Math.round((toHospital.length / PACE + PAR_EXTRA) * 1.8),
        responsePar,
        reward: Math.round(BASE + (PER_KM * (toPatient.length + toHospital.length)) / 1000),
        onFinish(m) { medic.finish(m); },
      };
    }
    return null;
  }

  refill() {
    const near = this.near?.();
    if (!this.offers.length) {
      const o = this.makeOffer(near);
      if (o) this.offers.push(o);
    }
    return this.offers;
  }

  accept(id) {
    const o = this.offers.find((x) => x.id === id);
    if (!o || this.missions.active) return false;
    const m = this.missions.offer(o);
    Object.assign(m, { responsePar: o.responsePar, reason: o.reason }); // before 'accepted' is heard
    this.offers = [];
    return this.missions.accept(o.id);
  }

  jobs() {
    if (this.missions.active) return [];
    this.refill();
    return this.offers.map((o) => ({
      id: o.id, title: o.title, from: `${o.from} (${o.reason})`, to: o.to, distance: o.distance, par: o.responsePar + o.par,
      reward: o.reward, vehicles: 'karetką (auto)', accept: () => this.accept(o.id),
    }));
  }

  // The lower of the response and transport stars; the pay follows them
  finish(m) {
    m.responseStars = starsOf(m.responseTime ?? 0, m.responsePar || m.par);
    m.transportStars = m.stars;
    m.stars = Math.min(m.stars, m.responseStars);
    m.paid = Math.round((m.reward * Math.max(m.stars, 0.5)) / 3);
  }

  update(dt) {
    const m = this.missions.active;
    if (m && m.role === 'medic' && m.state === 'accepted') this.response += dt;
  }

  statusLine() {
    const s = this.stats;
    return s.calls ? `${SERVICE} · wezwania: ${s.calls} · ${s.earned} zł` : `${SERVICE} · czekamy na wezwania`;
  }
}

export { Medic, HOSPITAL, SERVICE, DISPATCH, starsOf };
