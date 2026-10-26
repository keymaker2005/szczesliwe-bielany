// js/shared-calls.js
// Shared fire-service calls (step 5.6): a player who takes a call (fire, flooded basement, cat up a tree) tells the
// room; the others see it in Służby as "Wspólna akcja" and may join with their own fire engine. Everybody's work
// (spraying, pumping, the ladder) adds up in the room (worker-gracze/src/events.js), so two engines put a fire out
// twice as fast; when the room says it is done, the call is done for everyone on it and each gets their own pay.
// The call travels as an address number and a storey: every game rebuilds the same incident (firefighter.offerAt).
import { NAMES, addressName, ADDRESSES } from './firefighter.js';

const SEND_MS = 500; // our work goes to the room twice a second
const NOTIFY_RANGE = 2500; // m: shared calls farther away come without an SMS

export class SharedCalls {
  /**
   * client: MultiplayerClient; firefighter: Firefighter; missions: MissionEngine; sms({ id, from, text });
   * player(): { x, z, mode }; now()
   */
  constructor({ client, firefighter, missions, sms, player, from = 'Dyżurny straży', now = () => performance.now() }) {
    Object.assign(this, { client, firefighter, missions, sms, player, from, now });
    this.calls = new Map(); // e -> { e, k, a, f, by, name, n }: the room's open calls, not ours
    this.mine = null; // { e, mission, pending, work, lastSend, done }: the call we are on
    this.announcing = null; // our own call, until the room gives it a number
    firefighter.onWork = (d) => { if (this.mine && !this.mine.done) this.mine.work += d; };
    missions.on('state', (m) => this.onMission(m));
  }

  onMission(m) {
    if (m.role !== 'firefighter') return;
    if (m.state === 'accepted' && !m.shared && this.client.status === 'online' && Number.isInteger(m.ai)) {
      this.announcing = m;
      this.client.send({ t: 'zd', k: m.kind, a: m.ai, f: m.floor || 0 });
    }
    if (['delivered', 'late', 'abandoned'].includes(m.state) && this.mine?.mission === m) {
      if (!this.mine.done) this.client.send({ t: 'zd-x', e: this.mine.e });
      this.mine = null;
    }
    if (['delivered', 'late', 'abandoned'].includes(m.state) && this.announcing === m) this.announcing = null;
  }

  onMessage(msg) {
    switch (msg.t) {
      case 'zd':
        if (msg.mine && this.announcing) {
          this.mine = { e: msg.e, mission: this.announcing, work: 0, lastSend: 0, done: false };
          this.announcing.shared = { e: msg.e };
          this.firefighter.action && (this.firefighter.action.shared = true);
          this.announcing = null;
          return;
        }
        if (msg.mine || msg.by === this.client.me?.id) return;
        this.calls.set(msg.e, msg);
        this.notify(msg);
        break;
      case 'zd-stan':
        if (this.mine?.e === msg.e) this.firefighter.setSharedProgress(msg.p);
        break;
      case 'zd-dol':
        if (this.mine?.e === msg.e) this.sms({ id: `zd-${msg.e}-${msg.id}`, from: this.from, text: `${msg.name} dołącza do akcji. Na miejscu: ${msg.n} wozy.` });
        break;
      case 'zd-koniec':
        if (this.mine?.e === msg.e) { this.mine.done = true; this.firefighter.setSharedProgress(1); }
        break;
      case 'zd-x':
        this.calls.delete(msg.e);
        break;
      default:
    }
  }

  // An SMS about a shared call nearby, when we are free to take it
  notify(c) {
    const p = this.player();
    const at = ADDRESSES[c.a];
    if (!at || this.missions.active || p.mode !== 'car' || Math.hypot(at[4] - p.x, at[5] - p.z) > NOTIFY_RANGE) return;
    this.sms({ id: `zd-${c.e}`, from: this.from, text: `Wspólna akcja: ${NAMES[c.k]}, ${addressName(at)}. Na miejscu ${c.name}. Dołącz w Służbach.` });
  }

  // The room's calls as offers in the phone's Służby (under the fire service), rebuilt from their numbers
  jobs() {
    if (this.missions.active || this.client.status !== 'online') return [];
    const p = this.player();
    const out = [];
    for (const c of this.calls.values()) {
      const o = this.firefighter.offerAt(c.k, c.a, c.f, p);
      if (!o) continue;
      out.push({
        id: `zd-${c.e}`, title: `Wspólna akcja · ${NAMES[c.k]}`, from: `${o.from} (z: ${c.name})`, to: NAMES[c.k],
        distance: o.distance, par: o.responsePar + o.par, reward: o.reward, vehicles: 'wozem strażackim, razem z innymi',
        accept: () => this.join(c.e, o),
      });
    }
    return out;
  }

  join(e, offer) {
    if (!this.client.send({ t: 'zd-dol', e })) return false;
    offer.id = `${offer.id}-zd${e}`;
    if (!this.firefighter.take(offer, { e })) return false;
    this.mine = { e, mission: this.missions.active, work: 0, lastSend: 0, done: false };
    this.calls.delete(e);
    return true;
  }

  // Twice a second: our work since last time goes to the room
  update() {
    const m = this.mine;
    if (!m || m.done || m.work <= 0) return;
    const now = this.now();
    if (now - m.lastSend < SEND_MS) return;
    while (m.work > 0) { // the room takes at most 0.2 of the job per message
      const d = Math.min(m.work, 0.2);
      this.client.send({ t: 'zd-p', e: m.e, d: Math.round(d * 10000) / 10000 });
      m.work -= d;
    }
    m.work = 0;
    m.lastSend = now;
  }

  // The connection went: our call goes on alone, the room's calls are gone
  reset() {
    this.calls.clear();
    this.mine = null;
    this.announcing = null;
  }
}
