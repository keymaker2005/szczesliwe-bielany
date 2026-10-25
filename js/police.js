// js/police.js
// The police officer (step 3.7), in the patrol car (js/patrol-car.js on the player's car). Two kinds of calls from the
// police dispatcher, taking turns:
// - a speed check: drive to a street, measure the cars in front of you with the radar, follow the one you want to
//   check and put the lights on (K): it pulls up to the curb; stop behind it and decide on the spot (dispatch.choose):
//   no remarks, a warning (pouczenie) or a fine (mandat). The stars are for getting it right.
// - a chase: a driver did not stop for a check and drives off faster through the streets (js/traffic.js command);
//   it gives up when you keep close behind it for a few seconds or stand in its way. No weapons, no ramming:
//   every knock into a car costs a star.
// Cars of the traffic are driven through traffic.command(car, order, pace) only; nothing here draws or plays sounds.

import { GEO } from './bielany-geodata.js';
import { findRoute, limitAt } from './gps-route.js';

const SERVICE = 'Policja';
const DISPATCH = 'Dyspozytor policji';
const STORE_KEY = 'bielany-police';
const SPOT_MIN = 300, SPOT_MAX = 1500; // m from the player to the speed check's street
const PACE = 11; // m/s to the spot
const RADAR_RANGE = 90; // m around the patrol car the radar reads
const STOP_RANGE = 50; // m: the lights stop a measured car this close
const TALK_RANGE = 16; // m: stopped this close to the stopped car, the talk starts
const SPEEDER_NEAR = [50, 220], SPEEDER_FAR = 260; // m: a speeder is picked this far off, a new one beyond
const EXCESS = [6, 9, 14, 19, 24, 28]; // km/h over the limit the radar's speeder drives
const CLOSE_RANGE = 14, CLOSE_HOLD = 4; // m right behind the fleeing car, s of it to make the driver give up
const BLOCK_RANGE = 12, BLOCK_HOLD = 2.5; // m in front of it while it stands, s of it
const FLEE_PACE = 16; // m/s (about 58 km/h): faster than the traffic, slower than the patrol car on lights
const FLEE_NEAR = [60, 220];
const LOST_RANGE = 420; // m: further than this, the car is gone
const HIT_GAP = 1.5; // s: one knock counts once
const REWARD = { radar: 40, chase: 70 };
const SPOTS = GEO.addresses.list;
const STREETS = GEO.addresses.streets;

// The fine for speeding (km/h over the limit), after the Polish tariff of 2022
function fineFor(excess) {
  const steps = [[10, 50], [15, 100], [20, 200], [25, 300], [30, 400], [40, 800], [50, 1000], [60, 1500], [70, 2000]];
  for (const [upTo, zl] of steps) if (excess <= upTo) return zl;
  return 2500;
}

// What the measured speed calls for: nothing below the limit, a warning for a small excess (up to 10 km/h), a fine
const verdictFor = (excess) => (excess <= 0 ? 'none' : excess <= 10 ? 'warning' : 'fine');

// Stars for the choice on the spot: [the right one][chosen]
const CHOICE_STARS = {
  none: { none: 3, warning: 1, fine: 0 },
  warning: { warning: 3, fine: 2, none: 1 },
  fine: { fine: 3, warning: 1, none: 0 },
  court: { court: 3, fine: 2, warning: 1 },
};
const choiceStars = (right, chosen) => CHOICE_STARS[right]?.[chosen] ?? 0;

// A word for a car's paint (linear RGB) in the dispatcher's messages
function colourOf(paint) {
  if (!paint) return '';
  const [r, g, b] = paint;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (l > 0.55) return 'jasny';
  if (b > r * 2 && b > g * 1.5) return 'granatowy';
  if (r > g * 2.5 && r > b * 2.5) return 'bordowy';
  if (g > r * 1.15 && g > b * 1.1) return 'zielony';
  return l < 0.03 ? 'czarny' : 'szary';
}
const carWord = (c) => `${colourOf(c.paint)} ${c.bodyType === 'suv' ? 'SUV' : c.bodyType === 'taxi' ? 'taksówka' : 'sedan'}`.trim();

class Police {
  /**
   * traffic: { cars, command(car, order, pace) } (js/traffic.js). The game sets the hooks: player() -> the patrol
   * car's entity (position, heading, speed); siren() -> lights on; choose(opts) -> Promise of an option id
   * (js/dispatch.js); sms(id, text); mark(x, z, refresh) the pillar of light over a car (refresh: the GPS too);
   * note(text) a line under the mission's panel
   */
  constructor(missions, traffic, { random = Math.random, storage = globalThis.localStorage, limit = limitAt } = {}) {
    Object.assign(this, { missions, traffic, random, storage, limit });
    this.player = () => null;
    this.siren = () => false;
    this.choose = () => Promise.resolve(null);
    this.sms = () => {};
    this.mark = () => {};
    this.note = () => {};
    this.offers = [];
    this.serial = 0;
    this.near = null;
    this.job = null; // the call under way: { m, kind, phase, car, ... }
    this.stats = { checks: 0, chases: 0, earned: 0 };
    try {
      const saved = JSON.parse(storage?.getItem(STORE_KEY) || 'null');
      if (saved) this.stats = { ...this.stats, ...saved };
    } catch { /* storage is optional */ }
    missions.on('state', (m) => {
      if (m.role !== 'police') return;
      if (m.state === 'accepted') this.job = { m, kind: m.kind, phase: m.kind === 'radar' ? 'drive' : 'search', hits: 0, lastHit: -Infinity, t: 0, measured: new Map(), markAt: 0 };
      if (m.state === 'enRoute' && this.job) {
        m.radius = -1; // the mission ends when the call is dealt with (finishHere), not at a place
        if (this.job.kind === 'radar') this.job.phase = 'radar';
      }
      if (['delivered', 'late', 'abandoned'].includes(m.state)) {
        if (m.state !== 'abandoned') {
          this.stats[m.kind === 'chase' ? 'chases' : 'checks']++;
          this.stats.earned += m.paid;
          this.save();
        }
        this.release();
        this.job = null;
        this.offers = [];
        this.say('');
      }
    });
  }

  save() {
    try { this.storage?.setItem(STORE_KEY, JSON.stringify(this.stats)); } catch { /* storage is optional */ }
  }

  // Lets the cars the call ordered about go back to their own driving
  release() {
    const j = this.job;
    if (!j) return;
    for (const c of new Set([j.car, j.speeder])) if (c) this.traffic.command(c, null);
    j.car = j.speeder = null;
  }

  // A speed check on a street 0.3-1.5 km away, or a chase starting around the player
  makeOffer(near, kind) {
    if (!near) return null;
    const police = this;
    const base = { role: 'police', kind, vehicles: ['car'], onFinish(m) { police.finish(m); } };
    if (kind === 'chase') {
      return {
        ...base, id: `police-${++this.serial}`, title: `Pościg · ${SERVICE}`, start: null,
        target: { x: near.x, z: near.z, name: 'uciekające auto' }, from: 'w pobliżu', to: 'uciekające auto', distance: 0,
        par: 180, limit: 400, reward: REWARD.chase,
      };
    }
    for (let tries = 0; tries < 40; tries++) {
      const a = SPOTS[Math.floor(this.random() * SPOTS.length)];
      const d = Math.hypot(a[4] - near.x, a[5] - near.z);
      if (d < SPOT_MIN || d > SPOT_MAX) continue;
      const route = findRoute(near.x, near.z, a[4], a[5]);
      if (!route) continue;
      const spot = { x: a[4], z: a[5], name: `kontrola prędkości, ${STREETS[a[0]]}` };
      return {
        ...base, id: `police-${++this.serial}`, title: `Kontrola drogowa · ${SERVICE}`, start: spot, target: { ...spot },
        from: STREETS[a[0]], to: 'kontrola prędkości', distance: route.length,
        par: Math.round(route.length / PACE + 240), limit: 900, reward: REWARD.radar,
      };
    }
    return null;
  }

  // One of each kind in the phone, to pick from
  refill() {
    for (const kind of ['radar', 'chase']) {
      if (this.offers.some((o) => o.kind === kind)) continue;
      const o = this.makeOffer(this.near?.(), kind);
      if (o) this.offers.push(o);
    }
    return this.offers;
  }

  accept(id) {
    const o = this.offers.find((x) => x.id === id);
    if (!o || this.missions.active) return false;
    const m = this.missions.offer(o);
    m.kind = o.kind; // before 'accepted' is heard
    this.offers = [];
    return this.missions.accept(o.id);
  }

  jobs() {
    if (this.missions.active) return [];
    this.refill();
    return this.offers.map((o) => ({
      id: o.id, title: o.title, from: o.from, to: o.to, distance: o.distance, par: o.par, reward: o.reward,
      vehicles: 'radiowozem (auto)', accept: () => this.accept(o.id),
    }));
  }

  // A knock between the player and a car of the traffic (traffic.setCollisionListener): one star off, once per knock
  onCollision(e) {
    const j = this.job;
    if (!j || j.phase === 'drive' || j.phase === 'done' || j.t - j.lastHit < HIT_GAP) return;
    j.lastHit = j.t;
    j.hits++;
    if (e?.b && e.b === j.car) j.hitTarget = true;
  }

  // The stars: the choice on the spot, one off per knock; a car that got away: none
  finish(m) {
    const j = this.job || {};
    m.choice = j.choice || null;
    m.hits = j.hits || 0;
    m.excess = j.excess;
    m.lost = !!j.lost;
    m.stars = j.lost ? 0 : Math.max(0, choiceStars(j.right, j.choice) - m.hits);
    m.paid = Math.round((m.reward * Math.max(m.stars, 0.5)) / 3);
  }

  // The call is dealt with: the mission's target comes to the player, who is standing there (missions.update ends it)
  finishHere(radius = 30) {
    const j = this.job, p = this.player();
    if (!j || !p) return;
    j.phase = 'done';
    j.m.target = { x: p.position.x, z: p.position.z, name: j.lost ? 'koniec pościgu' : 'zgłoszenie załatwione' };
    j.m.radius = radius;
    this.release();
  }

  // Cars of the traffic around the player: [{ car, d, ahead (m along its heading), side }]
  around(p, range) {
    const fx = Math.sin(p.heading || 0), fz = Math.cos(p.heading || 0);
    const out = [];
    for (const c of this.traffic.cars) {
      if (!c.edge) continue;
      const dx = c.x - p.position.x, dz = c.z - p.position.z;
      if (Math.abs(dx) > range || Math.abs(dz) > range) continue;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      out.push({ car: c, d, ahead: dx * fx + dz * fz, side: dz * fx - dx * fz });
    }
    return out;
  }

  limitFor(c) {
    return this.limit(c.x, c.z) || 50;
  }

  // The radar measures every moving car within its range and remembers each one's worst; it reports the fastest
  // over its limit now (or the fastest at all)
  read(p) {
    let best = null;
    const m = this.job.measured;
    for (const o of this.around(p, RADAR_RANGE)) {
      const c = o.car, kmh = Math.round(c.speed * 3.6);
      if (kmh < 5) continue;
      const limit = this.limitFor(c), excess = kmh - limit;
      const was = m.get(c);
      if (!was || excess > was.excess) m.set(c, { kmh, limit, excess });
      if (!best || excess > best.excess) best = { car: c, kmh, limit, excess, d: o.d };
    }
    return best;
  }

  // One car near the player drives over the limit, for the radar to find
  keepSpeeder(p) {
    const j = this.job;
    const far = (c) => Math.hypot(c.x - p.position.x, c.z - p.position.z) > SPEEDER_FAR;
    if (j.speeder && !far(j.speeder)) return;
    if (j.speeder) this.traffic.command(j.speeder, null);
    j.speeder = null;
    const pool = this.around(p, SPEEDER_NEAR[1]).filter((o) => o.d >= SPEEDER_NEAR[0] && !o.car.order);
    if (!pool.length) return;
    const c = pool[Math.floor(this.random() * pool.length)].car;
    const excess = EXCESS[Math.floor(this.random() * EXCESS.length)];
    this.traffic.command(c, 'speed', (this.limitFor(c) + excess) / 3.6);
    j.speeder = c;
  }

  // The car to stop: within reach of the lights, the measured one most over its limit
  stopCandidate(p) {
    let best = null, worst = -Infinity;
    for (const o of this.around(p, STOP_RANGE)) {
      const r = this.job.measured.get(o.car);
      if (r && r.excess > worst) { best = o.car; worst = r.excess; }
    }
    return best;
  }

  // The worst speeder measured so far that is still around: { car, kmh, limit, excess, d }
  caught(p) {
    let best = null;
    for (const [c, r] of this.job.measured) {
      if (r.excess <= 0) continue;
      const d = Math.hypot(c.x - p.position.x, c.z - p.position.z);
      if (d < SPEEDER_FAR && (!best || r.excess > best.excess)) best = { car: c, ...r, d };
    }
    return best;
  }

  // The line under the mission's panel: what to do now. Rewritten at most 4 times a second (the DOM costs)
  say(text) {
    const j = this.job;
    if (text === this.said || (j && j.t - (j.saidAt ?? -1) < 0.25 && text)) return;
    this.said = text;
    if (j) j.saidAt = j.t;
    this.note(text);
  }

  pinCar(c, dt) {
    const j = this.job;
    j.markAt -= dt;
    const refresh = j.markAt <= 0;
    if (refresh) j.markAt = 1.5;
    this.mark(c.x, c.z, refresh);
  }

  talk() {
    const j = this.job;
    j.phase = 'talk';
    this.say('');
    const c = j.car;
    if (j.kind === 'radar') {
      const r = j.measured.get(c) || { kmh: Math.round(c.speed * 3.6), limit: this.limitFor(c), excess: 0 };
      j.excess = r.excess;
      j.right = verdictFor(r.excess);
      const fine = fineFor(Math.max(1, r.excess));
      this.choose({
        title: 'Kontrola drogowa',
        text: `Kierowca: ${carWord(c)}. Radar: ${r.kmh} km/h przy ograniczeniu do ${r.limit} km/h${r.excess > 0 ? ` (o ${r.excess} km/h za szybko)` : ' (bez przekroczenia)'}. Dokumenty w porządku. Co robisz?`,
        options: [
          { id: 'none', label: 'Bez uwag', hint: 'jechał przepisowo, szerokiej drogi' },
          { id: 'warning', label: 'Pouczenie', hint: 'drobne przekroczenie, rozmowa zamiast kary' },
          { id: 'fine', label: `Mandat ${fine} zł`, hint: 'według taryfikatora' },
        ],
      }).then((id) => this.decided(id));
    } else {
      j.right = 'court';
      this.choose({
        title: 'Koniec pościgu',
        text: `Kierowca (${carWord(c)}) zatrzymał się i wysiada z rękami na widoku. Nie zatrzymał się do kontroli i uciekał ulicami. Co robisz?`,
        options: [
          { id: 'warning', label: 'Pouczenie', hint: 'rozmowa i puszczasz dalej' },
          { id: 'fine', label: 'Mandat', hint: 'za wykroczenia drogowe po drodze' },
          { id: 'court', label: 'Wniosek do sądu', hint: 'ucieczka przed kontrolą to więcej niż wykroczenie' },
        ],
      }).then((id) => this.decided(id));
    }
  }

  decided(id) {
    const j = this.job;
    if (!j || j.phase !== 'talk') return;
    j.choice = id;
    this.finishHere();
  }

  // A chase or a check that ends with the car gone
  lose() {
    const j = this.job;
    j.lost = true;
    this.sms(`${j.m.id}-lost`, 'Straciliśmy go z oczu. Zgłoszenie zamykamy, zatrzymaj się, żeby wrócić do patrolu.');
    this.say('Auto uciekło. Zatrzymaj się, żeby zamknąć zgłoszenie.');
    this.finishHere(60);
  }

  update(dt) {
    const j = this.job;
    if (!j || j.m.state !== 'enRoute' || j.phase === 'done' || j.phase === 'talk') return;
    const p = this.player();
    if (!p) return;
    j.t += dt;
    const px = p.position.x, pz = p.position.z;

    if (j.phase === 'radar') {
      this.keepSpeeder(p);
      const r = this.read(p);
      const got = this.caught(p);
      const pinned = got?.car || j.speeder;
      if (pinned) this.pinCar(pinned, dt);
      const c = this.siren() ? this.stopCandidate(p) : null;
      if (c) {
        j.car = c;
        if (j.speeder && j.speeder !== c) this.traffic.command(j.speeder, null);
        j.speeder = null;
        this.traffic.command(c, 'stop');
        j.phase = 'stopping';
        this.say('Krok 3/3 · Auto zwalnia i zjeżdża na pobocze. Zatrzymaj się tuż za nim.');
      } else if (got) {
        const reach = got.d <= STOP_RANGE ? 'włącz sygnał (K)' : `podjedź bliżej: ${Math.round(got.d)} m, trzeba ${STOP_RANGE} m`;
        this.say(`Krok 2/3 · Zmierzone: ${got.kmh} km/h przy ograniczeniu ${got.limit}! Jedź za nim (słup światła) i ${reach}.`);
      } else {
        const now = r ? `teraz ${r.kmh} km/h przy ${r.limit}` : 'nic nie jedzie w zasięgu';
        const far = j.speeder ? Math.round(Math.hypot(j.speeder.x - px, j.speeder.z - pz)) : null;
        this.say(`Krok 1/3 · Radar mierzy auta do ${RADAR_RANGE} m (${now}). ${far ? `Słup światła: podejrzane auto, ${far} m stąd. Podjedź, radar je zmierzy.` : 'Czekaj na auta.'}`);
      }
      return;
    }

    if (j.phase === 'search') {
      const pool = this.around(p, FLEE_NEAR[1]).filter((o) => o.d >= FLEE_NEAR[0] && !o.car.order);
      if (!pool.length) { this.say('Dyspozytor szuka auta, jedź dalej ulicą.'); return; }
      const c = pool[Math.floor(this.random() * pool.length)].car;
      j.car = c;
      this.traffic.command(c, 'flee', FLEE_PACE);
      j.phase = 'chase';
      j.close = j.block = 0;
      this.sms(`${j.m.id}-seen`, `Uciekający to ${carWord(c)}, ${Math.round(Math.hypot(c.x - px, c.z - pz) / 10) * 10} m od ciebie. Słup światła nad nim.`);
    }

    const c = j.car;
    const d = Math.hypot(c.x - px, c.z - pz);
    if (d > LOST_RANGE) { this.lose(); return; }
    this.pinCar(c, dt);

    if (j.phase === 'chase') {
      // the player relative to the fleeing car: behind it going its way, or in front of it while it stands
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      const along = (px - c.x) * fx + (pz - c.z) * fz;
      const sameWay = Math.cos((p.heading || 0) - c.yaw) > 0.5;
      j.close = along < -2 && d < CLOSE_RANGE && sameWay ? j.close + dt : Math.max(0, j.close - dt * 0.5);
      j.block = along > 1 && d < BLOCK_RANGE && c.speed < 1 ? j.block + dt : Math.max(0, j.block - dt);
      if (j.close >= CLOSE_HOLD || j.block >= BLOCK_HOLD) {
        this.traffic.command(c, 'stop');
        j.phase = 'stopping';
        this.sms(`${j.m.id}-gave-up`, j.block >= BLOCK_HOLD ? 'Droga zablokowana, kierowca się poddaje. Zatrzymaj się przy nim.' : 'Kierowca widzi, że nie ucieknie, i zjeżdża na pobocze. Zatrzymaj się za nim.');
        return;
      }
      const bar = '█'.repeat(Math.round((j.close / CLOSE_HOLD) * 8)).padEnd(8, '░');
      this.say(j.close > 0
        ? `Trzymaj się za nim: ${bar} ${j.close.toFixed(1)} z ${CLOSE_HOLD} s. Nie uderzaj.`
        : `Uciekający ${Math.round(d)} m (słup światła). ${this.siren() ? '' : 'Włącz sygnał (K), pojedziesz szybciej. '}Dojedź tuż za niego (do ${CLOSE_RANGE} m) i trzymaj się ${CLOSE_HOLD} s albo stań mu na drodze.`);
      return;
    }

    // stopping: the car pulls up; stop close to it to talk
    if (c.speed < 0.5 && d < TALK_RANGE && Math.abs(p.speed || 0) < 1.5) this.talk();
    else this.say(c.speed >= 0.5 ? 'Auto zwalnia i zjeżdża na pobocze. Zwolnij za nim.' : `Auto stoi. Zatrzymaj się tuż za nim (${d < TALK_RANGE ? 'zahamuj' : `${Math.round(d)} m, trzeba ${TALK_RANGE} m`}).`);
  }

  statusLine() {
    const s = this.stats;
    return s.checks || s.chases ? `${SERVICE} · kontrole: ${s.checks} · pościgi: ${s.chases} · ${s.earned} zł` : `${SERVICE} · patrol czeka na zgłoszenia`;
  }
}

export { Police, SERVICE, DISPATCH, fineFor, verdictFor, choiceStars };
