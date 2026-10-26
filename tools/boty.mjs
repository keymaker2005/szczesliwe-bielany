// Test bots for playing with others (step 5.1, docs/api-gracze.md): N bots drive along Bielany streets and talk to
// the server like the game would.
//   node tools/boty.mjs [N] [--pokoj test|1] [--adres ws://localhost:8788/api/gracze] [--czas sekundy]
// Defaults: 5 bots, the test room, the local server (sh tools/gracze-dev.sh), until Ctrl+C.
// Every 5 s a line: bots in the room, players each bot sees, messages received per second, refusals.
import { GEO } from '../js/bielany-geodata.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const count = Number(args.find((a) => /^\d+$/.test(a)) || 5);
const room = opt('pokoj', 'test');
const base = opt('adres', 'ws://localhost:8788/api/gracze');
const seconds = Number(opt('czas', 0));
const url = room === 'test' ? `${base}?pokoj=test` : base;
const ORIGIN = 'http://localhost:8080';

// Drivable streets as polylines [x0, z0, x1, z1, ...]
const roads = GEO.roads.filter((r) => r[6] !== 'pedestrian' && r[5].length >= 4).map((r) => r[5]);
const MODES = [['car', 13], ['car', 13], ['car', 13], ['cyclist', 6], ['person', 1.6], ['helicopter', 30]];
const GESTURES = ['czesc', 'dzieki', 'jedziemy', 'brawo', 'uwaga', 'pa'];
const rand = (n) => Math.floor(Math.random() * n);

const stats = { received: 0, refused: 0, ended: {} };

class Bot {
  constructor(i) {
    this.i = i;
    [this.mode, this.speed] = MODES[i % MODES.length];
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
    this.ws.onclose = () => { clearInterval(this.timer); this.closed = true; };
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
    else if (msg.t === 'koniec') {
      stats.ended[msg.reason] = (stats.ended[msg.reason] || 0) + 1;
      console.log(`bot ${this.i}: koniec (${msg.reason})`);
    }
  }

  tick(dt) {
    const p = this.move(this.speed * dt);
    const y = this.mode === 'helicopter' ? 80 : 0;
    this.send({ t: this.teleport ? 'tp' : 's', x: p.x, y, z: p.z, h: p.h, m: this.mode, v: this.speed });
    this.teleport = false;
    if (Math.random() < 0.01) this.send({ t: 'g', g: GESTURES[rand(GESTURES.length)] });
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
  clearInterval(report);
  for (const b of bots) { b.send({ t: 'pa' }); clearInterval(b.timer); }
  setTimeout(() => process.exit(0), 300);
};
process.on('SIGINT', stop);
if (seconds > 0) setTimeout(stop, seconds * 1000);
