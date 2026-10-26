// Cloudflare Worker for the in-game chat: safety limits (step 4.1) and the guide's model (step 4.4, worker/src/model.js).
// Contract with the game: docs/api-czat.md. Secrets (never in the repo): TURNSTILE_SECRET, later ANTHROPIC_API_KEY.
// Kill switch without a code deploy: `wrangler secret put CHAT_OFF` (any value) turns the chat off, `wrangler secret
// delete CHAT_OFF` turns it back on. MAYOR_OFF does the same for the mayor character only.
import { CHATS, LIMITS, MESSAGES, PRODUCTION_ORIGINS, TURNSTILE_TEST_SITE_KEY } from './config.js';
import { Counters } from './counters.js';
import { askModel } from './model.js';

export { Counters };

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):80\d\d$/;

export function allowedOrigin(origin, env) {
  if (!origin) return false;
  if (PRODUCTION_ORIGINS.includes(origin)) return true;
  return env.DEV === '1' && LOCAL_ORIGIN.test(origin);
}

const isOff = (env) => Boolean(env.CHAT_OFF);

function reply(body, status, origin, env, extra = {}) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra };
  if (allowedOrigin(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

const STATUS = { slow_down: 429, resting: 503, off: 503, turnstile: 403, forbidden: 403, bad_request: 400, error: 502 };

function fail(reason, origin, env, retryAfter) {
  const body = { ok: false, reason, message: MESSAGES[reason] };
  if (retryAfter) body.retryAfter = retryAfter;
  return reply(body, STATUS[reason], origin, env, retryAfter ? { 'Retry-After': String(retryAfter) } : {});
}

// Request body check: returns the clean request or null
export function parseQuestion(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!data || typeof data !== 'object') return null;
  const chat = data.chat;
  const question = typeof data.question === 'string' ? data.question.trim() : '';
  if (!CHATS.includes(chat) || !question || [...question].length > LIMITS.questionChars) return null;
  const history = data.history ?? [];
  if (!Array.isArray(history) || history.length > LIMITS.historyEntries) return null;
  for (const h of history) {
    if (!h || (h.role !== 'user' && h.role !== 'assistant') || typeof h.text !== 'string' || [...h.text].length > LIMITS.historyEntryChars) return null;
  }
  return {
    chat,
    question,
    history: history.map((h) => ({ role: h.role, text: h.text })),
    session: typeof data.session === 'string' ? data.session : '',
    turnstile: typeof data.turnstile === 'string' ? data.turnstile : '',
  };
}

export async function verifyTurnstile(token, ip, env, fetchImpl = fetch) {
  if (!token || token.length > 2048 || !env.TURNSTILE_SECRET) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const r = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const data = await r.json();
    return data.success === true;
  } catch {
    return false;
  }
}

function counters(env) {
  const stub = env.COUNTERS.get(env.COUNTERS.idFromName('bielany'));
  return (method, ...args) => stub.fetch(`https://counters/${method}`, { method: 'POST', body: JSON.stringify(args) })
    .then((r) => r.json()).then((d) => d.result);
}

// The model answers when the Worker has a key; without one (local runs, tests) a fixed test answer
async function answer(req, env, fetchImpl) {
  if (env.ANTHROPIC_API_KEY) return askModel(req, env, fetchImpl);
  return { text: `To odpowiedź testowa czatu (bez klucza API). Twoje pytanie miało ${[...req.question].length} znaków.`, navigate: '', costUsd: 0 };
}

async function readBody(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > LIMITS.bodyBytes) return null;
  const text = await request.text();
  return text.length > LIMITS.bodyBytes ? null : text;
}

export async function handle(request, env, fetchImpl = fetch) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const path = url.pathname.replace(/\/+$/, '');

  if (request.method === 'OPTIONS') {
    if (!allowedOrigin(origin, env)) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
      },
    });
  }

  if (path === '/api/czat/stan' && request.method === 'GET') {
    const status = isOff(env) ? { resting: true } : await counters(env)('status');
    return reply({
      ok: true,
      enabled: !isOff(env) && !status.resting,
      turnstileSiteKey: env.TURNSTILE_SITE_KEY || TURNSTILE_TEST_SITE_KEY,
      maxQuestion: LIMITS.questionChars,
      maxHistory: LIMITS.historyEntries,
    }, 200, origin, env);
  }

  if (path !== '/api/czat') return reply({ ok: false, reason: 'not_found' }, 404, origin, env);
  if (request.method !== 'POST') return reply({ ok: false, reason: 'bad_request', message: MESSAGES.bad_request }, 405, origin, env);
  if (!allowedOrigin(origin, env)) return fail('forbidden', origin, env);
  if (isOff(env)) return fail('off', origin, env);

  const raw = await readBody(request);
  const req = raw === null ? null : parseQuestion(raw);
  if (!req) return fail('bad_request', origin, env);
  if (req.chat === 'burmistrz' && env.MAYOR_OFF) return fail('off', origin, env); // the mayor alone: wrangler secret put MAYOR_OFF

  const call = counters(env);
  let session = req.session;
  if (!(await call('checkSession', session))) {
    if (!(await verifyTurnstile(req.turnstile, ip, env, fetchImpl))) return fail('turnstile', origin, env);
    session = await call('issueSession');
  }

  const taken = await call('take', ip);
  if (!taken.ok) return fail(taken.reason, origin, env, taken.retryAfter);

  let result;
  try {
    result = await answer(req, env, fetchImpl);
  } catch {
    return fail('error', origin, env);
  }
  await call('addCost', result.costUsd);
  const body = { ok: true, answer: result.text, session };
  if (result.navigate) body.navigate = result.navigate;
  return reply(body, 200, origin, env);
}

export default {
  fetch: (request, env) => handle(request, env),
};
