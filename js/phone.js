// js/phone.js
// The player's smartphone: an HTML overlay (P or the phone button) with eight apps: Zlecenia (offered and active
// errands, from js/missions.js), Służby (the emergency services and their calls, js/dispatch.js), Mapa (the full map),
// Przewodnik (the landmarks: visited, navigate, read more), Czat (AI conversations, js/chat.js), SMS (messages from the guide, the mayor, the dispatchers),
// Pocztówki (the photos, js/postcards.js), Aparat (photo mode, js/photo-mode.js) and Gracze (playing with others,
// js/multiplayer-net.js: who is in the room, navigate to them, my name, the switch). A fictional handset: no maker's
// name or logo. The game keeps running under it; keys still drive the player, the phone only takes clicks.

import { MAX_QUESTION } from './chat.js';
import { GESTURES } from './multiplayer-net.js';

// Shown above every AI conversation, before the first question (step 4.5)
// The mayor conversation (decision 8 of docs/plan-fazy-4.md): an in-game character, no name, never the office's voice
const MAYOR_INFO = 'Burmistrz Bielan to postać AI w grze, nie prawdziwy burmistrz ani urząd. ';
const MAYOR_FOOTER = 'Odpowiedź AI w grze, nie oficjalne stanowisko Urzędu Dzielnicy Bielany';
const CHAT_INFO = 'Odpowiedzi tworzy model AI (Claude, Anthropic) na podstawie bazy wiedzy o Bielanach i mogą zawierać błędy. '
  + 'Rozmowy nie są zapisywane; pytanie trafia do dostawcy modelu tylko po to, by na nie odpowiedzieć. Nie podawaj danych osobowych.';

const APPS = [
  { id: 'jobs', name: 'Zlecenia', glyph: '📦' },
  { id: 'services', name: 'Służby', glyph: '🚨' },
  { id: 'map', name: 'Mapa', glyph: '🗺️' },
  { id: 'guide', name: 'Przewodnik', glyph: '🧭' },
  { id: 'sms', name: 'SMS', glyph: '💬' },
  { id: 'chat', name: 'Czat', glyph: '🤖' },
  { id: 'cards', name: 'Pocztówki', glyph: '🖼️' },
  { id: 'camera', name: 'Aparat', glyph: '📷' },
  { id: 'players', name: 'Gracze', glyph: '👥' },
];

const MODE_NAMES = { person: 'pieszo', car: 'autem', cyclist: 'rowerem', helicopter: 'helikopterem' };
const PLAYERS_INFO = 'Grasz z innymi: widzą Twoją postać, losowe imię i miejsce w grze. Bez kont, nic nie zapisujemy.';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const dist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

class Phone {
  /**
   * options: { root (element), button (element), missions (MissionEngine), jobs: () => [{ id, title, from, to,
   * distance, par, reward, vehicles }] offered now, services: () => [{ role, name, glyph, status, jobs }] (the
   * dispatch), onOpenMap(), status: () => line under the clock, time: '12:40' }
   */
  constructor({ root, button, missions, jobs, services, onOpenMap, onCamera, postcards, landmarks, onNavigate, status, time = '12:40', chat = null, chats = [{ id: 'przewodnik', name: 'Przewodnik' }], players = null }) {
    // players: { status(), available(), enabled(), setEnabled(on), me() -> { name, color }, rename(),
    //   list() -> [{ id, name, color, mode, distance }], navigate(id), navigating() -> id, gesture(id), gestureReady() }
    //   (main.js), or null
    this.players = players;
    this.chat = chat; // ChatClient (js/chat.js), { [conversation id]: ChatClient }, or null: no chat app content
    this.chats = chats; // the conversations shown in the Czat app (the mayor's one only when city-config CHAT_MAYOR)
    this.chatLogs = {}; // per conversation: [{ who: 'me' | 'ai' | 'note', text, guide, navigate }], in this tab's memory only
    this.chatBusy = false;
    this.chatDraft = '';
    this.chatEl = null;
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
    this.screen.addEventListener('input', (e) => { if (e.target.classList?.contains('chat-input')) this.chatInput(e.target); });
    this.screen.addEventListener('keydown', (e) => {
      // typing stays in the field: no other key handler (drive, map, camera) may see it
      if (e.target.classList?.contains('chat-input')) {
        e.stopPropagation();
        if (e.code === 'Enter' && !e.isComposing) { e.preventDefault(); this.chatSend(); }
        else if (e.code === 'Escape') e.target.blur();
      }
    });
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
    setInterval(() => { if (this.isOpen && (this.app === 'jobs' || this.app === 'services' || this.app === 'players')) this.render(); }, 500);
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
    this.chatEl = null;
    this.chatId = null;
    this.render();
  }


  // The Gracze app: the switch, my name (new one at random), the others nearest first with "Nawiguj"
  renderPlayers(head) {
    const pl = this.players;
    if (!pl) { this.screen.innerHTML = `${head('Gracze')}<p class="phone-empty">Gra z innymi jest niedostępna.</p>`; return; }
    const dot = (css) => `<span class="player-dot" style="background:${esc(css)}"></span>`;
    const on = pl.enabled();
    const me = pl.me();
    const list = on ? pl.list() : [];
    const nav = pl.navigating();
    const toggle = pl.available()
      ? `<button type="button" class="phone-btn${on ? ' is-quiet' : ''}" data-act="players-toggle">${on ? 'Wyłącz grę z innymi' : 'Włącz grę z innymi'}</button>` : '';
    const mine = on && me ? `
      <div class="phone-card">
        <div class="phone-card-title">${dot(me.color)} ${esc(me.name)}<span>to Ty</span></div>
        <button type="button" class="phone-btn is-quiet" data-act="players-rename">Losuj nowe imię i kolor</button>
        <div class="phone-card-line is-dim">Zwroty do graczy w pobliżu (albo klawisz T):</div>
        <div class="phone-gestures">${GESTURES.map((g) => `<button type="button" class="phone-btn is-quiet" data-act="players-gesture" data-id="${g.id}"${pl.gestureReady() ? '' : ' disabled'}>${g.icon} ${esc(g.text)}</button>`).join('')}</div>
      </div>` : '';
    const rows = list.map((p) => `
      <div class="phone-card">
        <div class="phone-card-title">${dot(p.color)} ${esc(p.name)}<span>${p.distance == null ? '' : dist(p.distance)}</span></div>
        <div class="phone-card-line is-dim">${esc(MODE_NAMES[p.mode] || 'w drodze')}</div>
        <button type="button" class="phone-btn is-quiet" data-act="players-nav" data-id="${p.id}">${nav === p.id ? 'Prowadzę do gracza (mapa)' : 'Nawiguj'}</button>
      </div>`).join('');
    this.screen.innerHTML = `${head('Gracze')}<div class="phone-list">
      <div class="phone-card-line is-dim">${esc(pl.status())}</div>
      ${on ? `<div class="phone-card-line is-dim">${esc(PLAYERS_INFO)}</div>` : ''}
      ${mine}${on ? this.taxiCard() : ''}${rows}${toggle}</div>`;
  }

  // Taxi with a real driver (step 5.5): call it on foot, wait, ride, get out
  taxiCard() {
    const pl = this.players;
    const t = pl.taxi?.();
    if (!t || t.state === 'offline') return '';
    const title = '<div class="phone-card-title">🚕 Taksówka z graczem<span></span></div>';
    const cancel = (label) => `<button type="button" class="phone-btn is-quiet" data-act="taxi-cancel">${label}</button>`;
    let body = '';
    if (t.state === 'idle') {
      body = `<div class="phone-card-line is-dim">Zamów kurs: kierowcy-gracze w pobliżu dostaną go w Zleceniach.${t.rides ? ` Twoje przejazdy: ${t.rides}.` : ''}</div>
        <div class="phone-gestures">${pl.destinations().map((d) => `<button type="button" class="phone-btn is-quiet" data-act="taxi-call" data-id="${esc(d.id)}">${esc(d.name)}</button>`).join('')}</div>`;
    } else if (t.state === 'not-on-foot') {
      body = '<div class="phone-card-line is-dim">Taksówkę zamówisz pieszo (klawisz 1). Autem możesz wozić innych: kursy od graczy są w Zleceniach.</div>';
    } else if (t.state === 'driving') {
      body = '<div class="phone-card-line is-dim">Wieziesz gracza (Zlecenia).</div>';
    } else if (t.state === 'wait') {
      body = `<div class="phone-card-line">Do: ${esc(t.to)} · czekasz na kierowcę (${t.waitLeft} s)</div>${cancel('Anuluj')}`;
    } else if (t.state === 'missed') {
      body = `<div class="phone-card-line">Nikt nie przyjął kursu do: ${esc(t.to)}.</div>
        <button type="button" class="phone-btn" data-act="taxi-computer">Taksówka komputerowa (szybki przejazd)</button>${cancel('Zamknij')}`;
    } else if (t.state === 'pickup') {
      body = `<div class="phone-card-line">${esc(t.driverName)} jedzie po Ciebie. Stój przy ulicy.</div>${cancel('Anuluj kurs')}`;
    } else if (t.state === 'ride') {
      body = `<div class="phone-card-line">Jedziesz z ${esc(t.driverName)} do: ${esc(t.to)}.</div>${cancel('Wysiądź')}`;
    }
    return `<div class="phone-card">${title}${body}</div>`;
  }

  // The Czat app. The screen is built once per conversation and then updated in place, so the text field keeps what
  // is typed while missions re-render the phone. The conversation lives in this tab's memory only.
  renderChat(head) {
    if (this.chats.length === 1) this.chatId = this.chats[0].id;
    const conv = this.chats.find((c) => c.id === this.chatId);
    if (!conv) {
      this.screen.innerHTML = `${head('Czat')}<div class="phone-list">${this.chats.map((c) => `
        <button type="button" class="phone-sms" data-act="chat-open" data-id="${esc(c.id)}"><b>${esc(c.name)}</b><span>Rozmowa z AI</span></button>`).join('')}</div>`;
      return;
    }
    if (this.chatEl && this.chatEl.isConnected) return;
    this.screen.innerHTML = `
      <div class="phone-head"><button type="button" class="phone-back" data-act="back" aria-label="Wstecz">‹</button><h2>${esc(conv.name)}</h2><span class="chat-ai" title="Odpowiedzi tworzy sztuczna inteligencja">AI</span></div>
      <div class="chat">
        <div class="chat-log" aria-live="polite"></div>
        <div class="chat-count"></div>
        <form class="chat-form" action="javascript:void(0)">
          <input class="chat-input" type="text" maxlength="${MAX_QUESTION}" placeholder="Zapytaj o Bielany…" autocomplete="off" autocapitalize="sentences" aria-label="Twoje pytanie">
          <button type="button" class="phone-btn chat-send" data-act="chat-send">Wyślij</button>
        </form>
      </div>`;
    this.chatEl = this.screen.querySelector('.chat');
    this.chatInputEl = this.chatEl.querySelector('.chat-input');
    this.chatInputEl.value = this.chatDraft;
    this.chatInput(this.chatInputEl);
    this.chatLines();
    const client = this.chatClient();
    if (client && client.state === 'unknown') client.init().then(() => this.chatLines());
  }

  chatInput(input) {
    this.chatDraft = input.value;
    const count = this.chatEl?.querySelector('.chat-count');
    if (count) count.textContent = `${[...input.value].length} / ${MAX_QUESTION}`;
  }

  chatLines() {
    if (!this.chatEl || !this.chatEl.isConnected) return;
    const client = this.chatClient();
    const mayor = this.chatId === 'burmistrz';
    const lines = [...this.chatLog()];
    if (!client || !client.available) {
      if (!lines.some((l) => l.guide)) lines.push({ who: 'note', off: true, guide: true, text: 'Czat odpoczywa. Zajrzyj do aplikacji Przewodnik: są tam gotowe teksty o Bielanach.' });
    }
    const log = this.chatEl.querySelector('.chat-log');
    log.innerHTML = `<div class="chat-note chat-info">${esc(mayor ? MAYOR_INFO + CHAT_INFO : CHAT_INFO)}</div>`
      + (lines.length ? '' : '<p class="phone-empty">Zapytaj mnie o Bielany: klasztor, las, metro, osiedla.</p>') + lines.map((l) => (l.who === 'note'
      ? `<div class="chat-note">${esc(l.text)}${l.guide ? '<button type="button" class="phone-btn is-quiet" data-act="app" data-id="guide">Otwórz Przewodnika</button>' : ''}</div>`
      : `<div class="chat-msg is-${l.who}">${esc(l.text)}${mayor && l.who === 'ai' ? `<span class="chat-foot">${esc(MAYOR_FOOTER)}</span>` : ''}</div>${this.chatNavigate(l.navigate)}`)).join('') + (this.chatBusy ? '<div class="chat-msg is-ai is-typing">pisze…</div>' : '');
    const off = !client || !client.available;
    this.chatInputEl.disabled = off;
    this.chatEl.querySelector('.chat-send').disabled = off || this.chatBusy;
    log.scrollTop = log.scrollHeight;
  }

  // The open conversation's client and messages (one per conversation: the guide and the mayor character)
  chatClient() {
    const c = this.chat;
    if (!c) return null;
    return typeof c.ask === 'function' ? c : c[this.chatId] || null;
  }

  chatLog() {
    return (this.chatLogs[this.chatId] ||= []);
  }

  // "Nawiguj" under a guide's answer about a landmark (the Worker's navigate field, step 4.4)
  chatNavigate(id) {
    const site = id && this.landmarks().find((l) => l.id === id);
    if (!site) return '';
    const label = this.navigating === site.id ? 'Trasa wyznaczona na mapie' : `Nawiguj: ${site.name}`;
    return `<button type="button" class="phone-btn is-quiet chat-nav" data-act="navigate" data-id="${esc(site.id)}">${esc(label)}</button>`;
  }

  async chatSend() {
    const input = this.chatInputEl;
    const q = (input?.value || '').trim();
    const client = this.chatClient();
    const log = this.chatLog();
    if (!q || this.chatBusy || !client || !client.available) return;
    log.push({ who: 'me', text: q });
    input.value = '';
    this.chatInput(input);
    this.chatBusy = true;
    this.chatLines();
    const r = await client.ask(q);
    this.chatBusy = false;
    log.push(r.ok ? { who: 'ai', text: r.text, navigate: r.navigate } : { who: 'note', text: r.text, guide: r.guide });
    this.chatLines();
    if (r.ok && this.chatInputEl?.isConnected) this.chatInputEl.focus();
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
      this.chatLines(); // the Czat screen keeps its element across render(): repaint the button label
    } else if (act === 'players-toggle') {
      this.players?.setEnabled(!this.players.enabled());
      this.render();
    } else if (act === 'players-rename') {
      this.players?.rename();
    } else if (act === 'players-gesture') {
      this.players?.gesture(id);
      this.render();
    } else if (act === 'taxi-call') {
      this.players?.taxiCall(id);
      this.render();
    } else if (act === 'taxi-cancel') {
      this.players?.taxiCancel();
      this.render();
    } else if (act === 'taxi-computer') {
      this.players?.taxiComputer();
      this.render();
    } else if (act === 'players-nav') {
      this.players?.navigate(Number(id));
      this.render();
    } else if (act === 'chat-open') {
      this.chatId = id;
      this.chatEl = null;
      this.render();
    } else if (act === 'chat-send') {
      this.chatSend();
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
      else if (this.app === 'chat' && this.chatId && this.chats.length > 1) { this.chatId = null; this.chatEl = null; }
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
    if (this.app === 'chat') {
      this.renderChat(head);
      return;
    }
    if (this.app === 'players') {
      this.renderPlayers(head);
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
