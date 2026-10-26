import assert from 'node:assert/strict';
import test from 'node:test';
import { SharedTaxi } from '../js/shared-taxi.js';
import { MissionEngine } from '../js/missions.js';
import { Track } from '../js/multiplayer-net.js';

// A fake network client and player; `say` plays a server message into the taxi
function setup({ mode = 'person', meId = 1 } = {}) {
  let now = 10000;
  const sent = [], sms = [], teleports = [];
  const players = new Map();
  const client = { status: 'online', me: { id: meId }, players, send: (m) => { sent.push(m); return true; } };
  const entity = { position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, heading: 0, speed: 0 };
  const person = { mesh: { visible: true }, crowd: { meshes: [{ visible: true }] } };
  const player = { mode };
  const missions = new MissionEngine();
  const taxi = new SharedTaxi({
    client, missions, sms: (m) => sms.push(m), storage: null, now: () => now,
    player: () => ({ entity, mode: player.mode, person }),
    waypoint: () => {}, teleport: (x, z) => { teleports.push([x, z]); entity.position.x = x; entity.position.z = z; },
    findRoute: () => ({ length: 1000 }),
  });
  const addPlayer = (id, x = 0, z = 0) => { const track = new Track(); track.push({ x, y: 0, z, h: 0, m: 'car', v: 0 }, now - 1000); players.set(id, { id, name: `gracz ${id}`, track }); };
  return { taxi, client, sent, sms, teleports, entity, person, player, missions, addPlayer, advance: (ms) => { now += ms; }, say: (m) => taxi.onMessage(m) };
}

test('passenger: call on foot, a driver comes, ride hidden in the car, out at the end', () => {
  const t = setup();
  const to = { x: 800, z: 0, name: 'AWF' };
  assert.equal(t.taxi.request(to), true);
  assert.deepEqual(t.sent.at(-1), { t: 'taxi', to });
  assert.equal(t.taxi.view().state, 'wait');
  t.addPlayer(2, 50, 0);
  t.say({ t: 'taxi-ok', r: 1, d: 2, name: 'gracz 2' });
  assert.equal(t.taxi.view().state, 'pickup');
  t.say({ t: 'taxi-in', r: 1 });
  assert.equal(t.taxi.riding, true);
  assert.equal(t.person.mesh.visible, false);
  t.taxi.update();
  assert.equal(t.entity.position.x, 50); // where the driver's car is
  t.say({ t: 'taxi-end', r: 1, to: 'AWF' });
  assert.equal(t.taxi.riding, false);
  assert.equal(t.person.mesh.visible, true);
  assert.equal(t.teleports.length, 1); // out on the pavement beside the car
  assert.equal(t.taxi.stats.rides, 1);
  assert.match(t.sms.at(-1).text, /Dojechałeś: AWF/);
});

test('passenger: only on foot; nobody takes it in 60 s: the computer cab', () => {
  const t = setup({ mode: 'car' });
  assert.equal(t.taxi.request({ x: 1, z: 1, name: 'x' }), false);
  t.player.mode = 'person';
  t.taxi.request({ x: 500, z: 500, name: 'Kameduły' });
  t.advance(61000);
  t.taxi.update();
  assert.deepEqual(t.sent.at(-1), { t: 'taxi-no', r: 1 });
  assert.equal(t.taxi.view().state, 'missed');
  t.say({ t: 'taxi-no', r: 1, by: 1 }); // our own give-up echoed: the choice stays
  assert.equal(t.taxi.view().state, 'missed');
  t.taxi.computerCab();
  assert.deepEqual(t.teleports.at(-1), [500, 500]);
  assert.equal(t.taxi.view().state, 'idle');
});

test('driver: the call shows in Zlecenia, accept, pick-up follows the passenger, drop-off and pay', () => {
  const t = setup({ mode: 'car', meId: 2 });
  t.addPlayer(1, 100, 0);
  t.say({ t: 'taxi', r: 1, name: 'gracz 1', x: 100, z: 0, to: { x: 1000, z: 0, name: 'Młociny' } });
  assert.match(t.sms.at(-1).text, /zamawia taksówkę/);
  const jobs = t.taxi.jobs();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].reward, Math.round(9 + 3.6));
  jobs[0].accept();
  assert.deepEqual(t.sent.at(-1), { t: 'taxi-ok', r: 1 });
  t.say({ t: 'taxi-ok', r: 1, d: 2, name: 'gracz 2' });
  const m = t.missions.active;
  assert.equal(m.role, 'taxi-gracz');
  t.taxi.update();
  assert.equal(m.start.x, 100);
  // stop by the passenger: picked up, the server hears it
  t.entity.position.x = 100;
  t.missions.update(1, { x: 100, z: 0, speed: 0, mode: 'car' });
  assert.deepEqual(t.sent.at(-1), { t: 'taxi-in', r: 1 });
  t.say({ t: 'taxi-in', r: 1 });
  t.missions.update(1, { x: 1000, z: 0, speed: 0, mode: 'car' });
  assert.deepEqual(t.sent.at(-1), { t: 'taxi-end', r: 1 });
  assert.equal(t.taxi.stats.driven, 1);
  assert.equal(t.missions.active, null);
});

test('driver: the passenger cancels, or another driver is faster', () => {
  const t = setup({ mode: 'car', meId: 2 });
  t.addPlayer(1, 100, 0);
  t.say({ t: 'taxi', r: 1, name: 'gracz 1', x: 100, z: 0, to: { x: 1000, z: 0, name: 'Młociny' } });
  t.taxi.jobs()[0].accept();
  t.say({ t: 'taxi-x', r: 1 });
  assert.equal(t.taxi.drive, null);
  assert.equal(t.taxi.jobs().length, 0);
  t.say({ t: 'taxi', r: 1, name: 'gracz 1', x: 100, z: 0, to: { x: 1000, z: 0, name: 'Młociny' } });
  t.taxi.jobs()[0].accept();
  t.say({ t: 'taxi-ok', r: 1, d: 2, name: 'gracz 2' });
  t.say({ t: 'taxi-no', r: 1, by: 1 });
  assert.equal(t.missions.active, null);
  assert.equal(t.sent.filter((m) => m.t === 'taxi-no').length, 0); // no echo back
  assert.match(t.sms.at(-1).text, /zrezygnował/);
});
