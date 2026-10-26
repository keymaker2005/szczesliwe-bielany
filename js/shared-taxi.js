// js/shared-taxi.js
// Taxi rides between players (step 5.5): a player on foot calls a cab in the phone's Gracze app, drivers in a car
// nearby get the ride in Zlecenia beside the usual fares, the first to accept drives to the passenger, picks them up
// (the passenger's camera rides along in the car) and drives them to the destination. The server referees
// (worker-gracze/src/rides.js, docs/api-gracze.md); this is both sides of the game. Nobody accepts within 60 s: the
// passenger may take the computer cab instead (a quick ride: straight to the destination).
import { getLocationLabel } from './city-config.js';

const WAIT_MS = 60000; // a call nobody takes: the passenger is offered the computer cab
const OFFER_RANGE = 2500; // m: drivers farther away don't see the call
const FLAG = 9, PER_KM = 3.6, PACE = 8.5, PAR_EXTRA = 25; // the cab's own tariff and pace (js/taxi.js)
const STORE_KEY = 'bielany-taxi-gracze';
const RESEND_MS = 2000; // the pick-up / drop-off is sent again until the server agrees

const routeLength = (findRoute, a, b) => {
  const r = findRoute?.(a.x, a.z, b.x, b.z, { oneWay: true });
  return r?.length || Math.hypot(b.x - a.x, b.z - a.z) * 1.3;
};

export class SharedTaxi {
  /**
   * client: MultiplayerClient; missions: MissionEngine; sms({ id, from, text }); player(): { entity, mode };
   * waypoint(x, z, name) / clearWaypoint(); teleport(x, z, heading); findRoute (gps-route.js); now()
   */
  constructor({ client, missions, sms, player, waypoint, teleport, findRoute, storage = globalThis.localStorage, now = () => performance.now() }) {
    Object.assign(this, { client, missions, sms, player, waypoint, teleport, findRoute, storage, now });
    this.call = null; // as passenger: { state: 'wait' | 'pickup' | 'ride' | 'missed', to, at, driver, driverName }
    this.offers = new Map(); // as driver: r -> { r, name, x, z, to, at }
    this.drive = null; // as driver: { r, name, mission, confirmed, ended, lastSend, cancelled }
    this.hidden = false;
    this.stats = { rides: 0, driven: 0, earned: 0 };
    try { Object.assign(this.stats, JSON.parse(storage?.getItem(STORE_KEY) || '{}')); } catch { /* optional */ }
    missions.on('state', (m) => this.onMission(m));
  }

  save() {
    try { this.storage?.setItem(STORE_KEY, JSON.stringify(this.stats)); } catch { /* optional */ }
  }

  get riding() { return this.call?.state === 'ride'; }

  // ---------- messages from the server ----------
  onMessage(msg) {
    const meId = this.client.me?.id;
    switch (msg.t) {
      case 'taxi': {
        if (msg.r === meId) return;
        this.offers.set(msg.r, { r: msg.r, name: msg.name, x: msg.x, z: msg.z, to: msg.to, at: this.now() });
        const { entity, mode } = this.player();
        if (mode === 'car' && !this.missions.active && Math.hypot(msg.x - entity.position.x, msg.z - entity.position.z) < OFFER_RANGE) {
          this.sms({ id: `gracz-${msg.r}-${Math.round(this.now())}`, from: 'Taxi Bielany · gracze',
            text: `${msg.name} zamawia taksówkę przy ${getLocationLabel(msg.x, msg.z)} do: ${msg.to.name}. Kurs czeka w Zleceniach.` });
        }
        break;
      }
      case 'taxi-x':
        this.offers.delete(msg.r);
        if (this.drive?.r === msg.r && !this.drive.mission) this.drive = null; // someone else was faster
        break;
      case 'taxi-ok':
        this.offers.delete(msg.r);
        if (msg.r === meId && this.call) {
          Object.assign(this.call, { state: 'pickup', driver: msg.d, driverName: msg.name });
          this.sms({ id: `kurs-${msg.r}-ok-${Math.round(this.now())}`, from: 'Taxi Bielany · gracze', text: `${msg.name} jedzie po Ciebie. Stój przy ulicy, kierowca zatrzyma się obok.` });
        } else if (msg.d === meId && this.drive?.r === msg.r) this.startDrive();
        break;
      case 'taxi-in':
        if (msg.r === meId && this.call) { this.call.state = 'ride'; this.setHidden(true); }
        else if (this.drive?.r === msg.r) this.drive.confirmed = true;
        break;
      case 'taxi-end':
        if (msg.r === meId && this.call) {
          this.stats.rides++;
          this.save();
          this.sms({ id: `kurs-${msg.r}-end-${Math.round(this.now())}`, from: 'Taxi Bielany · gracze', text: `Dojechałeś: ${msg.to}. Kierowca: ${this.call.driverName}. Przejazdów z graczami: ${this.stats.rides}.` });
          this.leaveCab();
        } else if (this.drive?.r === msg.r) this.drive.ended = true;
        break;
      case 'taxi-no':
        if (msg.r === meId && this.call) {
          if (this.call.state === 'missed') break; // our own give-up at 60 s coming back
          const why = msg.by === 0 ? 'Nikt nie przyjął kursu.' : msg.by === meId ? 'Kurs anulowany.' : 'Kierowca przerwał kurs.';
          if (this.call.state !== 'wait' || msg.by !== meId) this.sms({ id: `kurs-${msg.r}-no-${Math.round(this.now())}`, from: 'Taxi Bielany · gracze', text: why });
          this.leaveCab();
        } else if (this.drive?.r === msg.r) {
          const m = this.drive.mission;
          if (msg.by !== meId) this.sms({ id: `kurs-${msg.r}-no-${Math.round(this.now())}`, from: 'Taxi Bielany · gracze', text: `${this.drive.name} zrezygnował z kursu.` });
          this.drive.cancelled = true;
          if (m && this.missions.active === m) this.missions.abandon();
          this.drive = null;
        }
        this.offers.delete(msg.r);
        break;
      default:
    }
  }

  // The connection went: everything shared ends here too
  reset() {
    this.offers.clear();
    if (this.call) this.leaveCab();
    if (this.drive) {
      const m = this.drive.mission;
      this.drive.cancelled = true;
      if (m && this.missions.active === m) this.missions.abandon();
      this.drive = null;
    }
  }

  // ---------- passenger ----------
  canCall() {
    return this.client.status === 'online' && this.player().mode === 'person' && !this.call && !this.drive;
  }

  request(to) {
    if (!this.canCall()) return false;
    if (!this.client.send({ t: 'taxi', to: { x: to.x, z: to.z, name: to.name } })) return false;
    this.call = { state: 'wait', to, at: this.now(), driver: null, driverName: '' };
    return true;
  }

  cancel() {
    if (!this.call) return;
    if (this.call.state === 'missed') { this.call = null; return; }
    this.client.send({ t: 'taxi-no', r: this.client.me?.id });
    if (this.call.state === 'ride') this.leaveCab();
    else this.call = null;
  }

  // The computer cab after nobody took the call: a quick ride straight to the destination
  computerCab() {
    const to = this.call?.to;
    if (!to || this.call.state !== 'missed') return;
    this.call = null;
    this.teleport(to.x, to.z);
    this.sms({ id: `kurs-komp-${Math.round(this.now())}`, from: 'Taxi Bielany', text: `Taksówka komputerowa dowiozła Cię: ${to.name}.` });
  }

  // Out of the cab: on the pavement beside it, visible again
  leaveCab() {
    const wasRiding = this.call?.state === 'ride';
    this.call = null;
    this.setHidden(false);
    if (wasRiding) {
      const { entity } = this.player();
      const side = entity.heading + Math.PI / 2;
      this.teleport(entity.position.x + Math.sin(side) * 2.4, entity.position.z + Math.cos(side) * 2.4, entity.heading);
    }
  }

  setHidden(on) {
    if (this.hidden === on) return;
    this.hidden = on;
    const { person } = this.player();
    if (!person) return;
    if (person.mesh) person.mesh.visible = !on;
    for (const m of person.crowd?.meshes || []) m.visible = !on;
  }

  // ---------- driver ----------
  // Calls nearby as offers for the phone's Zlecenia (car only, nothing else on)
  jobs() {
    const { entity, mode } = this.player();
    if (mode !== 'car' || this.missions.active || this.call || this.drive) return [];
    const out = [];
    for (const o of this.offers.values()) {
      const pick = Math.hypot(o.x - entity.position.x, o.z - entity.position.z);
      if (pick > OFFER_RANGE) continue;
      const len = routeLength(this.findRoute, o, o.to);
      out.push({
        id: `gracz-${o.r}`, title: `Kurs z graczem · ${o.name}`, from: `${o.name}, ${getLocationLabel(o.x, o.z)}`, to: o.to.name,
        distance: len, par: Math.round(len / PACE + PAR_EXTRA), reward: Math.round(FLAG + (PER_KM * len) / 1000),
        vehicles: 'tylko autem · prawdziwy pasażer', accept: () => this.accept(o.r),
      });
    }
    return out;
  }

  accept(r) {
    const o = this.offers.get(r);
    if (!o || this.drive || this.missions.active) return false;
    if (!this.client.send({ t: 'taxi-ok', r })) return false;
    this.drive = { r, name: o.name, offer: o, mission: null, confirmed: false, ended: false, lastSend: 0, cancelled: false };
    return true;
  }

  // The server gave us the ride: a mission like any fare, its pick-up following the passenger
  startDrive() {
    const d = this.drive;
    const o = d.offer;
    const len = routeLength(this.findRoute, o, o.to);
    const spec = {
      id: `gracz-${o.r}-${Math.round(this.now())}`, role: 'taxi-gracz', title: `Kurs z graczem · ${o.name}`,
      start: { x: o.x, z: o.z, name: `${o.name} (gracz)` }, target: { x: o.to.x, z: o.to.z, name: o.to.name },
      vehicles: ['car'], par: Math.round(len / PACE + PAR_EXTRA), reward: Math.round(FLAG + (PER_KM * len) / 1000), radius: 12,
    };
    this.missions.offer(spec);
    d.mission = this.missions.missions.get(spec.id);
    this.missions.accept(spec.id);
    this.sms({ id: `${spec.id}-ok`, from: 'Taxi Bielany · gracze', text: `Kurs Twój. ${o.name} czeka przy ${getLocationLabel(o.x, o.z)}. Zatrzymaj się obok. Cel: ${o.to.name}.` });
  }

  onMission(m) {
    const d = this.drive;
    if (m.role !== 'taxi-gracz' || !d || d.mission !== m) return;
    if (m.state === 'enRoute') { this.client.send({ t: 'taxi-in', r: d.r }); d.lastSend = this.now(); }
    else if (m.state === 'delivered' || m.state === 'late') {
      this.client.send({ t: 'taxi-end', r: d.r });
      this.stats.driven++;
      this.stats.earned += m.paid;
      this.save();
      this.sms({ id: `${m.id}-done`, from: 'Taxi Bielany · gracze', text: `Kurs z ${d.name} zakończony, ${'★'.repeat(m.stars) || 'po czasie'}. ${m.paid} zł. Kursów z graczami: ${this.stats.driven}.` });
      this.drive = null;
    } else if (m.state === 'abandoned') {
      if (!d.cancelled) this.client.send({ t: 'taxi-no', r: d.r });
      this.drive = null;
    }
  }

  // ---------- every frame ----------
  update() {
    const now = this.now();
    for (const [r, o] of this.offers) if (now - o.at > 90000 || !this.client.players.has(r)) this.offers.delete(r);
    const c = this.call;
    if (c?.state === 'wait' && now - c.at > WAIT_MS) {
      this.client.send({ t: 'taxi-no', r: this.client.me?.id });
      c.state = 'missed';
      this.sms({ id: `kurs-brak-${Math.round(now)}`, from: 'Taxi Bielany · gracze', text: 'Nikt nie przyjął kursu. W telefonie (Gracze) możesz wziąć taksówkę komputerową albo zamówić jeszcze raz.' });
    }
    if (c && (c.state === 'pickup' || c.state === 'ride') && !this.client.players.has(c.driver)) this.leaveCab(); // driver gone
    if (c?.state === 'ride') {
      // In the cab: the passenger is where the driver's car is (drawn, as everyone sees it, 0.2 s back)
      const at = this.client.players.get(c.driver)?.track.sample(now);
      const { entity } = this.player();
      if (at) { entity.position.set(at.x, at.y, at.z); entity.heading = at.h; entity.speed = at.v; }
    }
    const d = this.drive;
    if (d?.mission) {
      const m = d.mission;
      if (m.state === 'accepted') {
        // The pick-up follows the passenger (they may walk to the kerb)
        const at = this.client.players.get(d.r)?.track.sample(now);
        if (at && Math.hypot(at.x - m.start.x, at.z - m.start.z) > 1) {
          m.start.x = at.x; m.start.z = at.z;
          this.waypoint(at.x, at.z, m.start.name);
        }
      } else if (m.state === 'enRoute' && !d.confirmed && now - d.lastSend > RESEND_MS) {
        this.client.send({ t: 'taxi-in', r: d.r });
        d.lastSend = now;
      }
    }
  }

  // For the phone's Gracze app
  view() {
    const c = this.call;
    return {
      state: c ? c.state : this.client.status !== 'online' ? 'offline' : this.drive ? 'driving' : this.player().mode === 'person' ? 'idle' : 'not-on-foot',
      to: c?.to?.name || '', driverName: c?.driverName || '', waitLeft: c?.state === 'wait' ? Math.max(0, Math.ceil((WAIT_MS - (this.now() - c.at)) / 1000)) : 0,
      rides: this.stats.rides, driven: this.stats.driven,
    };
  }
}
