// Cloudflare Worker for playing with others (step 5.1): status and the WebSocket into a room. Contract with the game:
// docs/api-gracze.md. Secret (never in the repo): TURNSTILE_SECRET. Kill switch without a code deploy:
// `wrangler secret put GRACZE_OFF --name bielany-gracze` (any value) turns it off, `secret delete` back on.
import { allowedOrigin } from '../../worker/src/index.js';
import { MESSAGES, TURNSTILE_TEST_SITE_KEY } from './config.js';
import { Lobby } from './lobby.js';
import { Room, lobby } from './room.js';

export { Lobby, Room };

const isOff = (env) => Boolean(env.GRACZE_OFF);
const STATUS = { off: 503, resting: 503, full: 503, too_many: 429, forbidden: 403, bad_request: 400 };

function reply(body, status, origin, env) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (allowedOrigin(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

const fail = (reason, origin, env) => reply({ ok: false, reason, message: MESSAGES[reason] }, STATUS[reason], origin, env);

function room(env, name) {
  return env.ROOMS.get(env.ROOMS.idFromName(`pokoj-${name}`));
}

export async function handle(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const path = url.pathname.replace(/\/+$/, '');
  const call = lobby(env);

  if (path === '/api/gracze/stan' && request.method === 'GET') {
    const status = isOff(env) ? { resting: false, players: 0 } : await call('status');
    const body = {
      ok: true,
      enabled: !isOff(env) && !status.resting,
      turnstileSiteKey: env.TURNSTILE_SITE_KEY || TURNSTILE_TEST_SITE_KEY,
      players: status.players,
    };
    if (!body.enabled) body.reason = isOff(env) ? 'off' : 'resting';
    return reply(body, 200, origin, env);
  }

  if (path !== '/api/gracze') return reply({ ok: false, reason: 'not_found' }, 404, origin, env);
  if (request.method !== 'GET' || request.headers.get('Upgrade') !== 'websocket') return fail('bad_request', origin, env);
  if (!allowedOrigin(origin, env)) return fail('forbidden', origin, env);
  if (isOff(env)) return fail('off', origin, env);

  const forward = (name) => {
    const headers = new Headers(request.headers);
    headers.set('X-Room', name);
    headers.set('X-Address', request.headers.get('CF-Connecting-IP') || '');
    return room(env, name).fetch(new Request(request.url, { method: 'GET', headers }));
  };

  if (url.searchParams.get('pokoj') === 'test') {
    const used = await call('pick', []);
    if (!used.ok && used.reason === 'resting') return fail('resting', origin, env);
    return forward('test');
  }

  // A room may turn out full (its head count in the lobby was old): try the next one, a few times
  const skip = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    const picked = await call('pick', skip);
    if (!picked.ok) return fail(picked.reason, origin, env);
    const res = await forward(picked.room);
    if (res.status !== 503) return res;
    skip.push(picked.room);
  }
  return fail('full', origin, env);
}

export default {
  fetch: (request, env) => handle(request, env),
};
