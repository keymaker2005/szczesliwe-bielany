// js/dispatch.js
// The emergency services' dispatch (step 3.4): one place for what every service shares. A service registers itself
// (the paramedic today; the city guard, the firefighter and the police officer next, docs/plan-fazy-3.md) with its
// name, dispatcher, the travel mode it needs, its vehicle livery (js/ambulance.js style: attach, detach, setSiren,
// update) and its messages; the dispatch then, for the service's missions (js/missions.js, by `role`):
// - switches the player to the service's mode, puts the livery on the vehicle and the lights & siren on;
// - sends the dispatcher's text messages (the call, the pick-up, the result);
// - takes the livery off at the end;
// - lists the services and their calls for the phone's Służby app (js/phone.js);
// - answers whether a siren is on (the traffic pulls over: traffic.js yieldTo; the speed cap rises: main.js);
// - asks the player to choose on the spot (pouczenie / mandat / ...): choose().

class Dispatch {
  /**
   * missions: MissionEngine; phone: Phone (addSms) or null; selectMode(mode); vehicle(mode) -> the player's entity in
   * that mode; mode() -> the current mode; soundOn() -> audio enabled; onLivery() after the livery changed (labels)
   */
  constructor({ missions, phone = null, selectMode = () => {}, vehicle = () => null, mode = () => 'car', soundOn = () => true, onLivery = () => {} }) {
    Object.assign(this, { missions, phone, selectMode, vehicle, mode, soundOn, onLivery });
    this.list = [];
    this.worn = null; // the livery on the player's vehicle now
    missions.on('state', (m) => this.onState(m));
  }

  /**
   * service: { role, name, dispatcher, glyph, mode ('car'...), livery (or null), siren (on at the call), provider:
   * { jobs(), statusLine(), update(dt) }, messages: { call(m), picked(m), done(m) } (each -> text or '') }
   */
  register(service) {
    this.list.push({ glyph: '🚨', mode: 'car', livery: null, siren: false, messages: {}, ...service });
    return this;
  }

  byRole(role) {
    return this.list.find((s) => s.role === role) || null;
  }

  /** The services for the phone: { role, name, glyph, status, jobs } */
  services() {
    const busy = Boolean(this.missions.active);
    return this.list.map((s) => ({
      role: s.role, name: s.name, glyph: s.glyph, status: s.provider.statusLine?.() || '', jobs: busy ? [] : s.provider.jobs?.() || [],
    }));
  }

  jobs() {
    return this.services().flatMap((s) => s.jobs);
  }

  get siren() {
    return Boolean(this.worn?.siren);
  }

  toggleSiren() {
    if (this.worn?.active) this.worn.setSiren(!this.worn.siren, this.soundOn());
  }

  sms(service, id, text) {
    if (text && this.phone) this.phone.addSms({ id, from: service.dispatcher, text });
  }

  onState(m) {
    const s = this.byRole(m.role);
    if (!s) return;
    if (m.state === 'accepted') {
      if (s.mode && this.mode() !== s.mode) this.selectMode(s.mode);
      if (s.livery) {
        s.livery.attach(this.vehicle(s.mode));
        if (s.siren) s.livery.setSiren(true, this.soundOn());
        this.worn = s.livery;
        this.onLivery();
      }
      this.sms(s, `${m.id}-call`, s.messages.call?.(m));
    } else if (m.state === 'enRoute') {
      this.sms(s, `${m.id}-picked`, s.messages.picked?.(m));
    } else if (['delivered', 'late', 'abandoned'].includes(m.state)) {
      if (this.worn) {
        this.worn.detach();
        this.worn = null;
        this.onLivery();
      }
      if (m.state !== 'abandoned') this.sms(s, `${m.id}-done`, s.messages.done?.(m));
    }
  }

  update(dt, elapsed) {
    for (const s of this.list) s.provider.update?.(dt);
    this.worn?.update?.(elapsed);
  }

  /**
   * A choice on the spot (a warning or a fine...): a panel over the game with the title, the situation and a button
   * per option; resolves with the chosen option's id. options: [{ id, label, hint }]
   */
  choose({ title, text, options }) {
    const doc = globalThis.document;
    if (!doc) return Promise.resolve(options[0]?.id ?? null);
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const panel = doc.createElement('div');
    panel.className = 'duty-choice';
    panel.setAttribute('role', 'dialog');
    panel.innerHTML = `<div class="duty-card"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="duty-options">${options.map((o) => `
      <button type="button" class="duty-option" data-id="${esc(o.id)}"><b>${esc(o.label)}</b>${o.hint ? `<span>${esc(o.hint)}</span>` : ''}</button>`).join('')}</div></div>`;
    doc.body.appendChild(panel);
    return new Promise((resolve) => {
      panel.addEventListener('click', (e) => {
        const b = e.target.closest('[data-id]');
        if (!b) return;
        panel.remove();
        resolve(b.dataset.id);
      });
    });
  }
}

export { Dispatch };
