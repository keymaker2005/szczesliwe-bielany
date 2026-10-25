// js/phone.js
// The player's smartphone: an HTML overlay (P or the phone button) with four apps: Zlecenia (offered and active
// errands, from js/missions.js), Mapa (the full map), SMS (messages from the guide, the mayor, the dispatcher) and
// Pocztówki (empty until the camera app). A fictional handset: no maker's name or logo. The game keeps running under
// it; keys still drive the player, the phone only takes clicks.

const APPS = [
  { id: 'jobs', name: 'Zlecenia', glyph: '📦' },
  { id: 'map', name: 'Mapa', glyph: '🗺️' },
  { id: 'sms', name: 'SMS', glyph: '💬' },
  { id: 'cards', name: 'Pocztówki', glyph: '🖼️' },
];

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const dist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

class Phone {
  /**
   * options: { root (element), button (element), missions (MissionEngine), jobs: () => [{ id, title, from, to,
   * distance, par, reward, vehicles }] offered now, onOpenMap(), status: () => line under the clock, time: '12:40' }
   */
  constructor({ root, button, missions, jobs, onOpenMap, status, time = '12:40' }) {
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
    setInterval(() => { if (this.isOpen && this.app !== 'sms') this.render(); }, 500);
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
    if (app === 'map') {
      this.app = 'home';
      this.toggle(false);
      if (this.onOpenMap) this.onOpenMap();
      return;
    }
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
      const job = this.jobs().find((j) => j.id === id);
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
    } else if (act === 'back') {
      if (this.openSms) this.openSms = null;
      else this.app = 'home';
      this.render();
    }
    if (document.activeElement && this.root.contains(document.activeElement)) document.activeElement.blur();
  }

  render() {
    const s = this.screen;
    if (this.app === 'home') {
      const badge = (id) => (id === 'sms' && this.unread() ? `<span class="phone-badge">${this.unread()}</span>` : id === 'jobs' && this.missions.active ? '<span class="phone-badge">1</span>' : '');
      s.innerHTML = `
        <div class="phone-status">${esc(this.status())}</div>
        <div class="phone-apps">${APPS.map((a) => `
          <button class="phone-app" type="button" data-act="app" data-id="${a.id}">
            <span class="phone-icon phone-icon-${a.id}" aria-hidden="true">${a.glyph}</span>${badge(a.id)}<span>${a.name}</span>
          </button>`).join('')}
        </div>
        <div class="phone-hint">P / Esc zamyka telefon</div>`;
      return;
    }
    const head = (title) => `<div class="phone-head"><button type="button" class="phone-back" data-act="back" aria-label="Wstecz">‹</button><h2>${esc(title)}</h2></div>`;
    if (this.app === 'jobs') {
      const m = this.missions.active;
      const active = m ? `
        <div class="phone-card is-active">
          <div class="phone-card-title">${esc(m.title)}<span>${m.state === 'enRoute' ? `${clock(m.time)} / ${clock(m.par)}` : 'odbiór'}</span></div>
          <div class="phone-card-line">${m.state === 'accepted' ? `Odbierz: ${esc(m.start?.name)}` : `Dostarcz: ${esc(m.target.name)}`}</div>
          <button type="button" class="phone-btn is-quiet" data-act="abandon">Przerwij zlecenie</button>
        </div>` : '';
      const jobs = m ? [] : this.jobs();
      const offers = jobs.length ? jobs.map((j) => `
        <div class="phone-card">
          <div class="phone-card-title">${esc(j.title)}<span>${j.reward} zł</span></div>
          <div class="phone-card-line">${esc(j.from)} → ${esc(j.to)}</div>
          <div class="phone-card-line is-dim">${dist(j.distance)} · na 3★ ${clock(j.par)} · ${esc(j.vehicles)}</div>
          <button type="button" class="phone-btn" data-act="accept" data-id="${esc(j.id)}">Przyjmij</button>
        </div>`).join('') : m ? '' : '<p class="phone-empty">Brak zleceń w okolicy. Podjedź do punktu odbioru przy stacji metra.</p>';
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
    if (this.app === 'cards') {
      s.innerHTML = `${head('Pocztówki')}<p class="phone-empty">Tu trafią zdjęcia z Aparatu (wkrótce).</p>`;
    }
  }
}

export { Phone };
