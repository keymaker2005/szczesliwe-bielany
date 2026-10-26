// Fake chat Worker for testing the phone's Czat app without wrangler: node tools/fake-czat.mjs [port=8787]
// Answers by the contract in docs/api-czat.md (stan, POST with a session or a Turnstile token). Magic words in the
// question steer the answer: "zwolnij" -> slow_down (429), "wylacz" -> off (503), "odpoczywa" -> resting (503),
// "blad" -> error (502), "cisza" -> no answer for 20 s, "html" -> not JSON, "turnstile" -> turnstile (403).
// Option --stan=off makes GET /api/czat/stan say enabled:false. Not used in production; the real one is worker/.
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):80\d\d$/;
const MESSAGES = {
  slow_down: 'Zwolnij trochę, zadałeś dużo pytań. Spróbuj za kilka minut.',
  resting: 'Czat odpoczywa do jutra. Zajrzyj do aplikacji Przewodnik.',
  off: 'Czat jest chwilowo wyłączony. Zajrzyj do aplikacji Przewodnik.',
  turnstile: 'Nie udało się potwierdzić, że jesteś człowiekiem.',
  bad_request: 'Nie rozumiem tego pytania.',
  error: 'Czat ma kłopot. Zajrzyj do aplikacji Przewodnik.',
};
const STATUS = { slow_down: 429, resting: 503, off: 503, turnstile: 403, bad_request: 400, error: 502 };
const WORDS = [['zwolnij', 'slow_down'], ['wylacz', 'off'], ['odpoczywa', 'resting'], ['blad', 'error'], ['turnstile', 'turnstile']];
const fold = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

function createFakeServer({ stan = 'on' } = {}) {
  const sessions = new Set();
  const log = [];
  const server = createServer((req, res) => {
    const origin = req.headers.origin || '';
    const send = (code, body, extra = {}) => {
      const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra };
      if (ORIGIN.test(origin)) { h['Access-Control-Allow-Origin'] = origin; h.Vary = 'Origin'; }
      res.writeHead(code, h).end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    const path = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type' }).end();
      return;
    }
    if (path === '/api/czat/stan' && req.method === 'GET') {
      send(200, { ok: true, enabled: stan !== 'off', turnstileSiteKey: '1x00000000000000000000AA', maxQuestion: 300, maxHistory: 12 });
      return;
    }
    if (path !== '/api/czat' || req.method !== 'POST') { send(404, { ok: false, reason: 'not_found' }); return; }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      let data;
      try { data = JSON.parse(raw); } catch { send(400, { ok: false, reason: 'bad_request', message: MESSAGES.bad_request }); return; }
      log.push(data);
      const q = fold(String(data.question || ''));
      if (!q || q.length > 300 || !Array.isArray(data.history ?? []) || (data.history ?? []).length > 12) {
        send(400, { ok: false, reason: 'bad_request', message: MESSAGES.bad_request });
        return;
      }
      if (q.includes('cisza')) return; // never answers; the game gives up after 15 s
      if (q.includes('html')) { send(200, '<html>nie JSON</html>'); return; }
      const hit = WORDS.find(([w]) => q.includes(w));
      if (hit) { send(STATUS[hit[1]], { ok: false, reason: hit[1], message: MESSAGES[hit[1]], ...(hit[1] === 'slow_down' ? { retryAfter: 120 } : {}) }); return; }
      let session = data.session;
      if (!sessions.has(session)) {
        if (!data.turnstile) { send(403, { ok: false, reason: 'turnstile', message: MESSAGES.turnstile }); return; }
        session = `fake-${Math.random().toString(36).slice(2)}`;
        sessions.add(session);
      }
      send(200, { ok: true, answer: `Odpowiedź testowa (atrapa). Pytanie: „${data.question.trim()}”. W historii mam ${data.history?.length ?? 0} wpisów.`, session });
    });
  });
  return { server, log };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv.find((a) => /^\d+$/.test(a)) || 8787);
  const { server } = createFakeServer({ stan: process.argv.includes('--stan=off') ? 'off' : 'on' });
  server.listen(port, () => console.log(`Atrapa czatu: http://localhost:${port}/api/czat (zwolnij / wylacz / odpoczywa / blad / cisza / html w pytaniu)`));
}

export { createFakeServer };
