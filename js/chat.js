// js/chat.js
// The phone's "Czat" app, the client side (step 4.2): talks to the chat Worker (worker/, contract: docs/api-czat.md).
// The pure helpers (address, history trimming, error messages) are tested in tests/chat.test.mjs. No API key lives
// here; the Worker holds it. When the Worker is silent, off, resting or refuses us, the chat says so in one line and
// points to the Przewodnik app (ready-made texts), and the game goes on without console errors (one console.info).

const MAX_QUESTION = 300;
const MAX_HISTORY = 12; // entries = 6 exchanges
const MAX_ENTRY = 600;
const TIMEOUT_MS = 15000;
const TURNSTILE_TEST_KEY = '1x00000000000000000000AA';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

// Local Worker on localhost (?czatport=8788 picks another port, for the fake Worker), the same-origin /api/czat elsewhere
function chatEndpoint(location = globalThis.location) {
  if (!LOCAL_HOSTS.has(location?.hostname)) return '/api/czat';
  const port = /^\d{4,5}$/.test(new URLSearchParams(location.search || '').get('czatport') || '') ? new URLSearchParams(location.search).get('czatport') : '8787';
  return `http://localhost:${port}/api/czat`;
}

// ?czat=off in the game's address turns the chat off
function chatDisabledByUrl(search = globalThis.location?.search || '') {
  try { return new URLSearchParams(search).get('czat') === 'off'; } catch { return false; }
}

// The last 6 exchanges (12 entries), every text cut to the Worker's limit
function trimHistory(history, max = MAX_HISTORY) {
  return history.slice(-max).map((h) => ({ role: h.role, text: [...String(h.text)].slice(0, MAX_ENTRY).join('') }));
}

const REST = 'Czat odpoczywa. Zajrzyj do aplikacji Przewodnik: są tam gotowe teksty o Bielanach.';
const SILENT = 'Czat jest teraz niedostępny. Zajrzyj do aplikacji Przewodnik: są tam gotowe teksty o Bielanach.';

// What to show for a Worker answer that is not an answer: { text, down (chat is out of service), guide (offer the
// Przewodnik app), retry (seconds, for slow_down) }
function describeFailure(result) {
  const reason = result?.reason;
  const message = typeof result?.message === 'string' ? result.message : '';
  switch (reason) {
    case 'slow_down': return { text: message || 'Zwolnij trochę, zapytaj ponownie za kilka minut.', down: false, guide: false, retry: Number(result.retryAfter) || 0 };
    case 'bad_request': return { text: message || 'Nie rozumiem tego pytania. Spróbuj krócej.', down: false, guide: false, retry: 0 };
    case 'turnstile': return { text: 'Nie udało się potwierdzić, że jesteś człowiekiem. Spróbuj jeszcze raz.', down: false, guide: false, retry: 0 };
    case 'resting': case 'off': return { text: REST, down: true, guide: true, retry: 0 };
    default: return { text: SILENT, down: true, guide: true, retry: 0 }; // forbidden, error, timeout, network, anything else
  }
}

// Loads Cloudflare Turnstile on the first question only and returns a token (invisible widget)
function turnstileProvider({ doc = globalThis.document, win = globalThis.window } = {}) {
  let loading = null;
  let widgetId = null;
  let pending = null; // { resolve, reject } of the token being fetched
  const load = () => loading || (loading = new Promise((resolve, reject) => {
    if (win.turnstile) { resolve(win.turnstile); return; }
    const s = doc.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => (win.turnstile ? resolve(win.turnstile) : reject(new Error('turnstile')));
    s.onerror = () => { loading = null; reject(new Error('turnstile')); };
    doc.head.appendChild(s);
  }));
  return async (siteKey) => {
    const ts = await load();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending = null; reject(new Error('turnstile timeout')); }, TIMEOUT_MS);
      pending = {
        resolve: (t) => { clearTimeout(timer); resolve(t); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      };
      if (widgetId === null) {
        const host = doc.createElement('div');
        host.style.cssText = 'position:fixed;left:-9999px;top:0';
        doc.body.appendChild(host);
        widgetId = ts.render(host, {
          sitekey: siteKey || TURNSTILE_TEST_KEY, appearance: 'interaction-only', size: 'invisible',
          callback: (t) => pending?.resolve(t), 'error-callback': () => pending?.reject(new Error('turnstile')),
        });
      } else {
        ts.reset(widgetId);
      }
    });
  };
}

class ChatClient {
  /** options: { endpoint, fetchImpl, getToken: (siteKey) => Promise<string>, disabled, timeoutMs } */
  constructor({ endpoint = chatEndpoint(), fetchImpl = (...a) => globalThis.fetch(...a), getToken, disabled = chatDisabledByUrl(), timeoutMs = TIMEOUT_MS } = {}) {
    this.endpoint = endpoint;
    this.fetch = fetchImpl;
    this.getToken = getToken || turnstileProvider();
    this.timeoutMs = timeoutMs;
    this.state = disabled ? 'off' : 'unknown'; // unknown → ready | off
    this.siteKey = TURNSTILE_TEST_KEY;
    this.session = '';
    this.history = []; // { role: 'user' | 'assistant', text }, in this tab's memory only
    this.informed = false;
  }

  get available() { return this.state !== 'off'; }

  async request(path, init) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const r = await this.fetch(`${this.endpoint}${path}`, { ...init, signal: ctl.signal });
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // GET /api/czat/stan, once, when the app is opened for the first time
  async init() {
    if (this.state !== 'unknown') return this.state;
    try {
      const s = await this.request('/stan', { method: 'GET' });
      if (s?.ok && s.enabled) {
        this.state = 'ready';
        if (typeof s.turnstileSiteKey === 'string') this.siteKey = s.turnstileSiteKey;
      } else {
        this.state = 'off';
        this.offReason = s?.ok ? 'resting' : 'error';
      }
    } catch {
      this.state = 'off';
      this.offReason = 'error';
      this.note();
    }
    return this.state;
  }

  note() {
    if (this.informed) return;
    this.informed = true;
    console.info('Czat: Worker nie odpowiada, gra działa bez czatu.');
  }

  async post(question, turnstile) {
    const body = { chat: 'przewodnik', question, history: trimHistory(this.history), session: this.session };
    if (turnstile) body.turnstile = turnstile;
    return this.request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  /** @returns {Promise<{ ok: true, text: string } | { ok: false, text, down, guide, retry }>} */
  async ask(question) {
    const q = question.trim();
    if (!q || [...q].length > MAX_QUESTION) return { ok: false, ...describeFailure({ reason: 'bad_request' }) };
    if (this.state === 'unknown') await this.init();
    if (this.state === 'off') return { ok: false, ...describeFailure({ reason: this.offReason === 'error' ? 'error' : 'off' }) };
    try {
      let res = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        let token = '';
        if (!this.session) {
          try { token = await this.getToken(this.siteKey); } catch { token = ''; }
          if (!token) return { ok: false, ...describeFailure({ reason: 'turnstile' }) };
        }
        res = await this.post(q, token);
        if (res?.ok === false && res.reason === 'turnstile') { this.session = ''; continue; } // refresh and retry once
        break;
      }
      if (res?.ok && typeof res.answer === 'string') {
        if (typeof res.session === 'string') this.session = res.session;
        this.history.push({ role: 'user', text: q }, { role: 'assistant', text: res.answer });
        this.history = trimHistory(this.history);
        return { ok: true, text: res.answer, navigate: typeof res.navigate === 'string' ? res.navigate : '' };
      }
      const f = describeFailure(res);
      if (f.down) { this.state = 'off'; this.offReason = res?.reason === 'resting' || res?.reason === 'off' ? 'off' : 'error'; this.note(); }
      return { ok: false, ...f };
    } catch {
      this.state = 'off';
      this.offReason = 'error';
      this.note();
      return { ok: false, ...describeFailure({ reason: 'error' }) };
    }
  }
}

export { ChatClient, chatEndpoint, chatDisabledByUrl, trimHistory, describeFailure, turnstileProvider, MAX_QUESTION, MAX_HISTORY, MAX_ENTRY, TIMEOUT_MS };
