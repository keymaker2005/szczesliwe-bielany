import assert from 'node:assert/strict';
import test from 'node:test';
import { Dispatch } from '../js/dispatch.js';
import { MissionEngine } from '../js/missions.js';

test('Dispatch (step 3.4): a service\'s call switches the mode, dresses the vehicle, sounds the siren and texts', async () => {
  const missions = new MissionEngine();
  const sms = [];
  let mode = 'person';
  const livery = {
    active: false, siren: false, on: null,
    attach(v) { this.active = true; this.on = v; }, detach() { this.active = false; this.siren = false; this.on = null; },
    setSiren(on) { this.siren = on; }, update() {},
  };
  const offers = [{ id: 'x-1', title: 'Wezwanie', from: 'A', to: 'B', distance: 500, par: 60, reward: 30, vehicles: 'auto' }];
  const provider = { jobs: () => offers, statusLine: () => 'czekamy', updated: 0, update(dt) { this.updated += dt; } };
  const d = new Dispatch({
    missions, phone: { addSms: (m) => sms.push(m) }, selectMode: (m) => { mode = m; }, vehicle: (m) => ({ mode: m }), mode: () => mode,
  });
  d.register({ role: 'guard', name: 'Straż Miejska', dispatcher: 'Dyżurny', mode: 'car', livery, siren: true, provider,
    messages: { call: (m) => `Jedź do ${m.start.name}`, done: (m) => `Gotowe: ${m.paid} zł` } });

  assert.deepEqual(d.services().map((s) => [s.role, s.name, s.status, s.jobs.length]), [['guard', 'Straż Miejska', 'czekamy', 1]]);
  missions.offer({ id: 'g1', role: 'guard', title: 'Wezwanie', start: { x: 0, z: 0, name: 'Żeromskiego 29' }, target: { x: 100, z: 0, name: 'tu' }, par: 60, limit: 100, reward: 30, vehicles: ['car'] });
  missions.accept('g1');
  assert.equal(mode, 'car');
  assert.deepEqual(livery.on, { mode: 'car' });
  assert.equal(d.siren, true);
  assert.equal(sms[0].from, 'Dyżurny');
  assert.match(sms[0].text, /Żeromskiego 29/);
  assert.deepEqual(d.services()[0].jobs, [], 'no calls while on one');
  d.toggleSiren();
  assert.equal(d.siren, false);
  d.update(0.5, 10);
  assert.equal(provider.updated, 0.5);
  missions.abandon();
  assert.equal(livery.active, false);
  assert.equal(d.siren, false);
  assert.equal(sms.length, 1, 'no result text after an abandoned call');
  // other roles (the courier, the taxi) are none of its business
  missions.offer({ id: 'c1', role: 'courier', title: 'Paczka', start: { x: 0, z: 0, name: 'a' }, target: { x: 1, z: 0, name: 'b' }, par: 60, limit: 100, reward: 5, vehicles: ['cyclist'] });
  missions.accept('c1');
  assert.equal(livery.active, false);
  assert.equal(await d.choose({ title: 'Parkowanie na trawniku', text: '…', options: [{ id: 'warn', label: 'Pouczenie' }, { id: 'fine', label: 'Mandat' }] }), 'warn', 'without a page the first option');
});
