// js/phone.js
// The player's smartphone: an HTML overlay (P or the phone button) with seven apps: Zlecenia (offered and active
// errands, from js/missions.js), Służby (the emergency services and their calls, js/dispatch.js), Mapa (the full map),
// Przewodnik (the landmarks: visited, navigate, read more), SMS (messages from the guide, the mayor, the dispatchers),
// Pocztówki (the photos, js/postcards.js) and Aparat (photo mode, js/photo-mode.js). A fictional handset: no maker's
// name or logo. The game keeps running under it; keys still drive the player, the phone only takes clicks.

const APPS = [
  { id: 'jobs', name: 'Zlecenia', glyph: '📦' },
  { id: 'services', name: 'Służby', glyph: '🚨' },
  { id: 'map', name: 'Mapa', glyph: '🗺️' },
  { id: 'guide', name: 'Przewodnik', glyph: '🧭' },
  { id: 'sms', name: 'SMS', glyph: '💬' },
  { id: 'cards', name: 'Pocztówki', glyph: '🖼️' },
  { id: 'camera', name: 'Aparat', glyph: '📷' },
];

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const dist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

class Phone {
  /**
   * options: { root (element), button (element), missions (MissionEngine), jobs: () => [{ id, title, from, to,
   * distance, par, reward, vehicles }] offered now, services: () => [{ role, name, glyph, status, jobs }] (the
   * dispatch), onOpenMap(), status: () => line under the clock, time: '12:40' }
   */
  constructor({ root, button, missions, jobs, services, onOpenMap, onCamera, postcards, landmarks, onNavigate, status, time = '12:40' }) {
    this.services = services || (() => []);
    this.onCamera = onCamera;
    this.landmarks = landmarks || (() => []); // [{ id, name, seen, x, z, sms, more }]
    this.onNavigate = onNavigate;
    this.openSite = null;
    this.navigating = null;
    this.postcards = postcards || null;
    this.openCard = null;
    this.root = root;
    this.button = button;
    this.missions = missions;
    this.jobs = jobs || (() => []);
    this.onOpenMap = onOpenMap;
    this.status = status || (() => '');
    this.time = time;
    this.isOpen = false;
    this.app = 'home';
    this.sms = []; // { id, from, text, more, at, read }
    this.openSms = null;
    this.toastTimer = 0;

    root.innerHTML = `
      <div class="phone-frame">
        <div class="phone-bar"><span class="phone-time">${esc(time)}</span><span class="phone-net">LTE ▮▮▮▯ 🔋</span></div>
        <div class="phone-screen"></div>
        <button class="phone-home" type="button" aria-label="Ekran główny"></button>
      </div>`;
    this.screen = root.querySelector('.phone-screen');
    this.toast = document.createElement('div');
    this.toast.className = 'phone-toast hidden';
    this.toast.setAttribute('role', 'status');
    document.body.appendChild(this.toast);

    root.querySelector('.phone-home').addEventListener('click', () => this.show('home'));
    root.addEventListener('click', (e) => this.onClick(e));
    if (button) button.addEventListener('click', () => this.toggle());
    this.toast.addEventListener('click', () => {
      this.toggle(true);
      this.show('sms');
    });
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
      if (e.code === 'KeyP' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) this.toggle();
      else if (e.code === 'Escape' && this.isOpen) this.toggle(false);
    });
    // the lists change while the phone is open (offers, the active clock)
    setInterval(() => { if (this.isOpen && (this.app === 'jobs' || this.app === 'services')) this.render(); }, 500);
    if (this.postcards) this.postcards.onChange(() => { if (this.isOpen && this.app === 'cards') this.render(); });
    missions.on('state', () => { if (this.isOpen) this.render(); this.renderBadge(); });
    this.render();
  }

  toggle(open = !this.isOpen) {
    this.isOpen = Boolean(open);
    this.root.classList.toggle('hidden', !this.isOpen);
    document.body.classList.toggle('phone-open', this.isOpen);
    if (this.button) this.button.setAttribute('aria-pressed', String(this.isOpen));
    if (this.isOpen) {
      this.toast.classList.add('hidden');
      this.render();
    }
    // a button that keeps focus would swallow the next Space / arrow keys meant for driving
    if (document.activeElement && this.root.contains(document.activeElement)) document.activeElement.blur();
  }

  show(app) {
    this.app = app;
    this.openSms = null;
    this.openSite = null;
    if (app === 'map' || app === 'camera') {
      this.app = 'home';
      this.toggle(false);
      if (app === 'map' && this.onOpenMap) this.onOpenMap();
      if (app === 'camera' && this.onCamera) this.onCamera();
      return;
    }
    this.openCard = null;
    this.render();
  }

  // A text message; it rings in as a toast while the phone is closed
  addSms({ id, from, text, more = '' }) {
    if (id && this.sms.some((m) => m.id === id)) return false;
    this.sms.unshift({ id, from, text, more, at: this.time, read: false });
    this.renderBadge();
    if (this.isOpen && this.app === 'sms') this.render();
    if (!this.isOpen) {
      this.toast.innerHTML = `<b>${esc(from)}</b> ${esc(text.length > 90 ? `${text.slice(0, 88)}…` : text)}`;
      this.toast.classList.remove('hidden');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => this.toast.classList.add('hidden'), 7000);
    }
    return true;
  }

  unread() {
    return this.sms.filter((m) => !m.read).length;
  }

  renderBadge() {
    if (!this.button) return;
    const n = this.unread();
    this.button.dataset.badge = n ? String(n) : '';
  }

  onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const id = t.dataset.id;
    if (act === 'app') this.show(id);
    else if (act === 'accept') {
      const job = [...this.jobs(), ...this.services().flatMap((sv) => sv.jobs)].find((j) => j.id === id);
      if (job && job.accept) job.accept();
      this.render();
    } else if (act === 'abandon') {
      this.missions.abandon();
      this.render();
    } else if (act === 'sms') {
      this.openSms = this.sms.find((m) => String(m.id) === id) || null;
      if (this.openSms) this.openSms.read = true;
      this.renderBadge();
      this.render();
    } else if (act === 'site') {
      this.openSite = id;
      this.render();
    } else if (act === 'navigate') {
      const site = this.landmarks().find((l) => l.id === id);
      if (site && this.onNavigate) {
        this.onNavigate(site);
        this.navigating = site.id;
      }
      this.render();
    } else if (act === 'card') {
      this.openCard = id;
      this.render();
    } else if (act === 'card-save') {
      this.postcards?.save(id);
    } else if (act === 'card-share') {
      this.postcards?.share(id);
    } else if (act === 'card-delete') {
      this.postcards?.remove(id);
      this.openCard = null;
      this.render();
    } else if (act === 'back') {
      if (this.openCard) this.openCard = null;
      else if (this.openSite) this.openSite = null;
      else if (this.openSms) this.openSms = null;
      else this.app = 'home';
      this.render();
    }
    if (document.activeElement && this.root.contains(document.activeElement)) document.activeElement.blur();
  }

  render() {
    const s = this.screen;
    if (this.app === 'home') {
      const serviceRoles = new Set(this.services().map((sv) => sv.role));
      const active = this.missions.active;
      const onDuty = Boolean(active && serviceRoles.has(active.role));
      const badge = (id) => (id === 'sms' && this.unread() ? `<span class="phone-badge">${this.unread()}</span>`
        : (id === 'jobs' && active && !onDuty) || (id === 'services' && onDuty) ? '<span class="phone-badge">1</span>' : '');
      s.innerHTML = `
        <div class="phone-status">${esc(this.status())}</div>
        <div class="phone-apps">${APPS.map((a) => `
          <button class="phone-app" type="button" data-act="app" data-id="${a.id}">
            <span class="phone-icon phone-icon-${a.id}" aria-hidden="true">${a.glyph}</span>${badge(a.id)}<span>${a.name}</span>
          </button>`).join('')}
        </div>
        <div class="phone-hint">P / Esc zamyka telefon · F: Aparat</div>`;
      return;
    }
    const head = (title) => `<div class="phone-head"><button type="button" class="phone-back" data-act="back" aria-label="Wstecz">‹</button><h2>${esc(title)}</h2></div>`;
    const offerCard = (j) => `
        <div class="phone-card">
          <div class="phone-card-title">${esc(j.title)}<span>${j.reward} zł</span></div>
          <div class="phone-card-line">${esc(j.from)} → ${esc(j.to)}</div>
          <div class="phone-card-line is-dim">${dist(j.distance)} · na 3★ ${clock(j.par)} · ${esc(j.vehicles)}</div>
          <button type="button" class="phone-btn" data-act="accept" data-id="${esc(j.id)}">Przyjmij</button>
        </div>`;
    if (this.app === 'services') {
      const m = this.missions.active;
      const list = this.services();
      const mine = m && list.some((sv) => sv.role === m.role);
      const active = mine ? `
        <div class="phone-card is-active">
          <div class="phone-card-title">${esc(m.title)}<span>${m.state === 'enRoute' ? `${clock(m.time)} / ${clock(m.par)}` : 'w drodze'}</span></div>
          <div class="phone-card-line">${m.state === 'accepted' ? `Na miejsce: ${esc(m.start?.name)}` : `Dalej: ${esc(m.target.name)}`}</div>
          <button type="button" class="phone-btn is-quiet" data-act="abandon">Przerwij wezwanie</button>
        </div>` : '';
      const busy = m && !mine ? '<p class="phone-empty">Najpierw skończ bieżące zlecenie.</p>' : '';
      const services = mine ? '' : list.map((sv) => `
        <div class="phone-service"><b>${esc(sv.glyph)} ${esc(sv.name)}</b><span>${esc(sv.status)}</span></div>
        ${sv.jobs.map(offerCard).join('') || (busy ? '' : '<p class="phone-empty">Brak wezwań. Dyspozytor odezwie się, gdy coś się wydarzy.</p>')}`).join('');
      s.innerHTML = `${head('Służby')}<div class="phone-list">${active}${busy}${services}</div>`;
      return;
    }
    if (this.app === 'jobs') {
      const m = this.missions.active;
      const onDuty = m && this.services().some((sv) => sv.role === m.role);
      const active = m && !onDuty ? `
        <div class="phone-card is-active">
          <div class="phone-card-title">${esc(m.title)}<span>${m.state === 'enRoute' ? `${clock(m.time)} / ${clock(m.par)}` : 'odbiór'}</span></div>
          <div class="phone-card-line">${m.state === 'accepted' ? `Odbierz: ${esc(m.start?.name)}` : `Dostarcz: ${esc(m.target.name)}`}</div>
          <button type="button" class="phone-btn is-quiet" data-act="abandon">Przerwij zlecenie</button>
        </div>` : '';
      const jobs = m ? [] : this.jobs();
      const offers = jobs.length ? jobs.map(offerCard).join('') : onDuty ? '<p class="phone-empty">Jesteś na wezwaniu (Służby).</p>'
        : m ? '' : '<p class="phone-empty">Brak zleceń w okolicy. Podjedź do punktu odbioru przy stacji metra.</p>';
      s.innerHTML = `${head('Zlecenia')}<div class="phone-list">${active}${offers}</div>`;
      return;
    }
    if (this.app === 'sms') {
      if (this.openSms) {
        const m = this.openSms;
        s.innerHTML = `${head(m.from)}<div class="phone-list"><div class="phone-bubble">${esc(m.text)}</div>${m.more ? `<div class="phone-more"><h3>Czytaj więcej</h3><p>${esc(m.more)}</p></div>` : ''}</div>`;
        return;
      }
      s.innerHTML = `${head('SMS')}<div class="phone-list">${this.sms.length ? this.sms.map((m) => `
        <button type="button" class="phone-sms${m.read ? '' : ' is-unread'}" data-act="sms" data-id="${esc(m.id)}">
          <b>${esc(m.from)}</b><span>${esc(m.text)}</span>
        </button>`).join('') : '<p class="phone-empty">Brak wiadomości.</p>'}</div>`;
      return;
    }
    if (this.app === 'guide') {
      const list = this.landmarks();
      const site = this.openSite && list.find((l) => l.id === this.openSite);
      if (site) {
        s.innerHTML = `${head(site.name)}<div class="phone-list">
          <div class="phone-card-line is-dim">${site.seen ? '✓ Odwiedzone' : 'Jeszcze nie odwiedzone'}</div>
          <div class="phone-bubble">${esc(site.sms)}</div>
          <button type="button" class="phone-btn" data-act="navigate" data-id="${esc(site.id)}">${this.navigating === site.id ? 'Trasa wyznaczona na mapie' : 'Nawiguj'}</button>
          ${site.more ? `<div class="phone-more"><h3>Czytaj więcej</h3><p>${esc(site.more)}</p></div>` : ''}</div>`;
        return;
      }
      const seen = list.filter((l) => l.seen).length;
      s.innerHTML = `${head('Przewodnik')}<div class="phone-list">
        <div class="phone-card-line is-dim">Odwiedzone: ${seen} z ${list.length}</div>${list.map((l) => `
        <button type="button" class="phone-sms${l.seen ? '' : ' is-unread'}" data-act="site" data-id="${esc(l.id)}">
          <b>${l.seen ? '✓' : '○'} ${esc(l.name)}</b></button>`).join('') || '<p class="phone-empty">Brak miejsc.</p>'}</div>`;
      return;
    }
    if (this.app === 'cards') {
      const pc = this.postcards;
      const open = this.openCard && pc?.get(this.openCard);
      if (open) {
        s.innerHTML = `${head(open.place || 'Pocztówka')}<div class="phone-list">
          <img class="phone-photo" src="${open.thumb}" alt="${esc(open.place)}">
          <div class="phone-card-line is-dim">${esc(open.filter)} · ${esc(new Date(open.at).toLocaleString('pl-PL'))}</div>
          <button type="button" class="phone-btn" data-act="card-share" data-id="${esc(open.id)}">Udostępnij na X</button>
          <button type="button" class="phone-btn is-quiet" data-act="card-save" data-id="${esc(open.id)}">Zapisz do pliku</button>
          <button type="button" class="phone-btn is-quiet" data-act="card-delete" data-id="${esc(open.id)}">Usuń</button></div>`;
        return;
      }
      const items = pc ? pc.items : [];
      s.innerHTML = `${head('Pocztówki')}${items.length ? `<div class="phone-grid">${items.map((p) => `
        <button type="button" class="phone-thumb" data-act="card" data-id="${esc(p.id)}"><img src="${p.thumb}" alt="${esc(p.place)}"></button>`).join('')}</div>`
        : '<p class="phone-empty">Brak zdjęć. Otwórz Aparat w telefonie albo naciśnij F, ustaw kadr i naciśnij Spację.</p>'}`;
    }
  }
}

export { Phone };
