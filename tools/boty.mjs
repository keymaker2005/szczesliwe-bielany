// Test bots for playing with others (step 5.1, docs/api-gracze.md): N bots drive along Bielany streets and talk to
// the server like the game would.
//   node tools/boty.mjs [N] [--pokoj test|1] [--adres ws://localhost:8789/api/gracze] [--czas sekundy] [--blisko metry]
// --blisko 400: only streets within 400 m of the Stare Bielany station (where the game starts), to watch them.
// Defaults: 5 bots, the test room, the local server (sh tools/gracze-dev.sh), until Ctrl+C. A room holds 30: leave
// space for people (at most ~20 bots).
// --taksowkarz K: the first K bots are cab drivers that take taxi calls from players (step 5.5), drive straight to
// the passenger and on to the destination; --pasazer K: the next K bots stand near the Stare Bielany station and call a
// cab to an M1 station every ~30 s (to test driving a real passenger).
// Every 5 s a line: bots in the room, players each bot sees, messages received per second, refusals.
import { GEO } from '../js/bielany-geodata.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const count = Number(args.find((a) => /^\d+$/.test(a)) || 5);
const room = opt('pokoj', 'test');
const base = opt('adres', 'ws://localhost:8789/api/gracze');
const seconds = Number(opt('czas', 0));
const url = room === 'test' ? `${base}?pokoj=test` : base;
const ORIGIN = 'http://localhost:8080';

// Drivable streets as polylines [x0, z0, x1, z1, ...]
const near = Number(opt('blisko', 0));
const roads = GEO.roads.filter((r) => r[6] !== 'pedestrian' && r[5].length >= 4).map((r) => r[5])
  .filter((c) => !near || Math.hypot(c[0], c[1]) < near);
const MODES = [['car', 13], ['car', 13], ['car', 13], ['cyclist', 6], ['person', 1.6], ['helicopter', 30]];
const GESTURES = ['czesc', 'dzieki', 'jedziemy', 'brawo', 'uwaga', 'pa'];
const rand = (n) => Math.floor(Math.random() * n);
const drivers = Number(opt('taksowkarz', 0));
const callers = Number(opt('pasazer', 0));
const STATIONS = GEO.stations;

const stats = { received: 0, refused: 0, ended: {} };
let stopping = false;

class Bot {
  constructor(i) {
    this.i = i;
    [this.mode, this.speed] = MODES[i % MODES.length];
    this.role = i < drivers ? 'driver' : i < drivers + callers ? 'caller' : null;
    if (this.role === 'driver') [this.mode, this.speed] = ['car', 13];
    if (this.role === 'caller') { this.mode = 'person'; this.speed = 0; this.spot = { x: 20 + (i % 5) * 6, z: -25 }; this.nextCall = Date.now() + 8000; }
    this.pos = new Map(); // other players' last positions
    this.job = null; // driver: { r, stage: 'pickup' | 'ride', to } · caller: { stage: 'wait' | 'ride', driver }
    this.seen = new Set();
    this.newRoad(true);
    this.connect();
  }

  newRoad(first = false) {
    this.road = roads[rand(roads.length)];
    this.seg = 0;
    this.along = 0;
    this.teleport = !first;
  }

  // Position on the current street, moving `dist` metres forward
  move(dist) {
    let r = this.road;
    while (dist > 0) {
      const i = this.seg * 2;
      if (i + 3 >= r.length) { this.newRoad(); r = this.road; break; }
      const len = Math.hypot(r[i + 2] - r[i], r[i + 3] - r[i + 1]);
      if (this.along + dist < len) { this.along += dist; dist = 0; } else { dist -= len - this.along; this.along = 0; this.seg++; }
    }
    const i = Math.min(this.seg * 2, r.length - 4);
    const dx = r[i + 2] - r[i], dz = r[i + 3] - r[i + 1];
    const len = Math.hypot(dx, dz) || 1;
    const t = Math.min(1, this.along / len);
    return { x: r[i] + dx * t, z: r[i + 1] + dz * t, h: Math.atan2(dx, dz) };
  }

  connect() {
    this.ws = new WebSocket(url, { headers: { Origin: ORIGIN } });
    this.ws.onopen = () => this.send({ t: 'hej', turnstile: 'bot', name: { a: this.i % 12, b: this.i % 20, n: 1 + (this.i % 99) }, color: this.i % 12 });
    this.ws.onmessage = (e) => this.receive(JSON.parse(e.data));
    this.ws.onerror = () => { stats.refused++; };
    this.ws.onclose = () => {
      clearInterval(this.timer);
      this.closed = true;
      this.id = null;
      if (!stopping) setTimeout(() => { this.closed = false; this.seen.clear(); this.connect(); }, 3000); // server restarted
    };
  }

  send(obj) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  receive(msg) {
    stats.received++;
    if (msg.t === 'witaj') {
      this.id = msg.id;
      this.name = msg.name;
      for (const p of msg.players) this.seen.add(p.id);
      console.log(`bot ${this.i}: ${msg.name} (id ${msg.id}) w pokoju ${msg.room}, widzi ${msg.players.length}`);
      const every = 1000 / msg.rate.move;
      this.timer = setInterval(() => this.tick(every / 1000), every);
    } else if (msg.t === 'nowy') this.seen.add(msg.p.id);
    else if (msg.t === 'wyszedl') this.seen.delete(msg.id);
    else if (msg.t === 's' || msg.t === 'tp') this.pos.set(msg.id, { x: msg.x, z: msg.z, h: msg.h });
    else if (msg.t.startsWith('taxi')) this.taxi(msg);
    else if (msg.t === 'koniec') {
      stats.ended[msg.reason] = (stats.ended[msg.reason] || 0) + 1;
      console.log(`bot ${this.i}: koniec (${msg.reason})`);
    }
  }

  taxi(msg) {
    if (this.role === 'driver') {
      if (msg.t === 'taxi') (this.lastCallTo ||= new Map()).set(msg.r, msg.to);
      if (msg.t === 'taxi' && !this.job) setTimeout(() => { if (!this.job) this.send({ t: 'taxi-ok', r: msg.r }); }, 2000);
      else if (msg.t === 'taxi-ok' && msg.d === this.id) { this.job = { r: msg.r, stage: 'pickup' }; console.log(`bot ${this.i}: jadę po gracza ${msg.r}`); }
      else if (msg.t === 'taxi-in' && this.job?.r === msg.r) this.job.stage = 'ride';
      else if ((msg.t === 'taxi-end' || msg.t === 'taxi-no') && this.job?.r === msg.r) { console.log(`bot ${this.i}: kurs ${msg.t === 'taxi-end' ? 'zakończony' : `przerwany (przez ${msg.by})`}`); this.job = null; this.newRoad(); }
    } else if (this.role === 'caller') {
      if (msg.t === 'taxi-ok' && msg.r === this.id) { this.job = { stage: 'wait', driver: msg.d }; console.log(`bot ${this.i}: jedzie po mnie ${msg.name}`); }
      else if (msg.t === 'taxi-in' && msg.r === this.id) { this.job.stage = 'ride'; console.log(`bot ${this.i}: wsiadam`); }
      else if ((msg.t === 'taxi-end' || msg.t === 'taxi-no') && msg.r === this.id) {
        console.log(`bot ${this.i}: ${msg.t === 'taxi-end' ? `dojechałem: ${msg.to}` : `kurs przerwany (przez ${msg.by})`}`);
        this.job = null; this.teleport = true; this.nextCall = Date.now() + 30000;
      }
    }
  }

  // Straight towards (x, z) at the bot's speed; true when within `d` metres
  toward(x, z, dt, d) {
    const p = this.at || { x: this.spot?.x || 0, z: this.spot?.z || 0, h: 0 };
    const dx = x - p.x, dz = z - p.z, len = Math.hypot(dx, dz);
    if (len <= d) return true;
    const step = Math.min(len - d * 0.5, 12 * dt);
    this.at = { x: p.x + (dx / len) * step, z: p.z + (dz / len) * step, h: Math.atan2(dx, dz) };
    return false;
  }

  tick(dt) {
    if (this.role === 'caller') return this.callerTick(dt);
    if (this.role === 'driver' && this.job) return this.driverTick(dt);
    const p = this.move(this.speed * dt);
    this.at = p;
    const y = this.mode === 'helicopter' ? 80 : 0;
    this.send({ t: this.teleport ? 'tp' : 's', x: p.x, y, z: p.z, h: p.h, m: this.mode, v: this.speed });
    this.teleport = false;
    if (Math.random() < 0.01) this.send({ t: 'g', g: GESTURES[rand(GESTURES.length)] });
    if (this.mode === 'car' && Math.random() < 0.004) this.send({ t: 'k' });
  }

  driverTick(dt) {
    const j = this.job;
    if (j.stage === 'pickup') {
      const pas = this.pos.get(j.r);
      if (pas && this.toward(pas.x, pas.z, dt, 6) && !j.sentIn) { this.send({ t: 'taxi-in', r: j.r }); j.sentIn = Date.now(); }
      if (j.sentIn && Date.now() - j.sentIn > 2000) j.sentIn = 0; // again until the server agrees
    } else if (j.stage === 'ride') {
      if (!j.to) j.to = this.lastCallTo?.get(j.r);
      if (j.to && this.toward(j.to.x, j.to.z, dt, 10) && !j.sentEnd) { this.send({ t: 'taxi-end', r: j.r }); j.sentEnd = Date.now(); }
      if (j.sentEnd && Date.now() - j.sentEnd > 2000) j.sentEnd = 0;
    }
    const p = this.at;
    if (p) this.send({ t: 's', x: p.x, y: 0, z: p.z, h: p.h, m: 'car', v: 12 });
  }

  callerTick() {
    const j = this.job;
    if (j?.stage === 'ride') {
      const car = this.pos.get(j.driver);
      if (car) { this.at = { ...car }; this.send({ t: 's', x: car.x, y: 0, z: car.z, h: car.h || 0, m: 'passenger', v: 12 }); }
      return;
    }
    const p = this.at || this.spot;
    this.at = p;
    this.send({ t: this.teleport ? 'tp' : 's', x: p.x, y: 0, z: p.z, h: 0, m: 'person', v: 0 });
    this.teleport = false;
    if (!j && Date.now() > this.nextCall) {
      const st = STATIONS[rand(STATIONS.length)];
      this.send({ t: 'taxi', to: { x: st.x, z: st.z, name: `Stacja metra ${st.name}` } });
      this.nextCall = Date.now() + 70000; // the server lets an untaken call lapse after 90 s
      console.log(`bot ${this.i}: zamawiam taksówkę do ${st.name}`);
    }
  }
}

console.log(`${count} botów → ${url}`);
const bots = Array.from({ length: count }, (_, i) => new Bot(i));
let lastReceived = 0;
const report = setInterval(() => {
  const inRoom = bots.filter((b) => b.id && !b.closed);
  const seen = inRoom.map((b) => b.seen.size);
  console.log(`w pokoju ${inRoom.length}/${count}, każdy widzi ${Math.min(...seen, 0) === 0 && !seen.length ? 0 : Math.min(...seen)}–${Math.max(0, ...seen)} innych, `
    + `${Math.round((stats.received - lastReceived) / 5)} wiadomości/s, odmowy ${stats.refused}, koniec ${JSON.stringify(stats.ended)}`);
  lastReceived = stats.received;
}, 5000);

const stop = () => {
  stopping = true;
  clearInterval(report);
  for (const b of bots) { b.send({ t: 'pa' }); clearInterval(b.timer); }
  setTimeout(() => process.exit(0), 300);
};
process.on('SIGINT', stop);
if (seconds > 0) setTimeout(stop, seconds * 1000);
