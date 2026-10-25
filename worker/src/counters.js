// Counters for the chat (one Durable Object for the whole game): questions per address in the last 10 minutes,
// questions per day and estimated model cost per month. Nothing else is stored: no questions, no answers, no raw
// addresses (only a salted SHA-256 hash that disappears with its 10-minute window). The salt and the session key are
// random values made here on first use, so the Worker needs no extra secrets for them.
import { LIMITS } from './config.js';

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Day and month in Warsaw time, so "wróć jutro" means the Polish tomorrow
export function warsawDay(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}

export class Counters {
  constructor(state, env) {
    this.storage = state.storage;
    this.env = env;
    this.now = () => Date.now();
  }

  async secret(name) {
    let value = await this.storage.get(`secret:${name}`);
    if (!value) {
      value = hex(crypto.getRandomValues(new Uint8Array(32)));
      await this.storage.put(`secret:${name}`, value);
    }
    return value;
  }

  async hmac(name, text) {
    const key = await crypto.subtle.importKey('raw', enc.encode(await this.secret(name)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', key, enc.encode(text));
  }

  async addressKey(ip) {
    return `ip:${hex(await this.hmac('salt', ip || 'unknown')).slice(0, 32)}`;
  }

  // Questions are counted before the model is asked (a burst cannot slip past the limit while answers are pending)
  async take(ip) {
    const key = await this.addressKey(ip); // before any read: only storage awaits below, so the input gate keeps it atomic
    const now = this.now();
    const day = warsawDay(now);
    const month = day.slice(0, 7);
    const dayCount = (await this.storage.get(`day:${day}`)) || 0;
    const monthCost = (await this.storage.get(`cost:${month}`)) || 0;
    if (dayCount >= LIMITS.perDay || monthCost >= LIMITS.monthBudgetUsd) return { ok: false, reason: 'resting' };

    const recent = ((await this.storage.get(key)) || []).filter((t) => now - t < LIMITS.perAddressWindowMs);
    if (recent.length >= LIMITS.perAddress) {
      return { ok: false, reason: 'slow_down', retryAfter: Math.ceil((recent[0] + LIMITS.perAddressWindowMs - now) / 1000) };
    }
    recent.push(now);
    await this.storage.put(key, recent);
    await this.storage.put(`day:${day}`, dayCount + 1);
    if (!(await this.storage.getAlarm())) await this.storage.setAlarm(now + LIMITS.perAddressWindowMs);
    return { ok: true };
  }

  async addCost(usd) {
    if (!(usd > 0)) return;
    const month = warsawDay(this.now()).slice(0, 7);
    await this.storage.put(`cost:${month}`, ((await this.storage.get(`cost:${month}`)) || 0) + usd);
  }

  async status() {
    const now = this.now();
    const day = warsawDay(now);
    const dayCount = (await this.storage.get(`day:${day}`)) || 0;
    const monthCost = (await this.storage.get(`cost:${day.slice(0, 7)}`)) || 0;
    return { day, questions: dayCount, monthCostUsd: monthCost, resting: dayCount >= LIMITS.perDay || monthCost >= LIMITS.monthBudgetUsd };
  }

  // Session token: expiry + HMAC, issued after Turnstile so later questions in the same tab skip it
  async issueSession() {
    const exp = this.now() + LIMITS.sessionMs;
    return `${exp}.${b64url(await this.hmac('session', `s:${exp}`))}`;
  }

  async checkSession(token) {
    const m = /^(\d{13})\.([\w-]{43})$/.exec(typeof token === 'string' ? token : '');
    if (!m || Number(m[1]) < this.now()) return false;
    return m[2] === b64url(await this.hmac('session', `s:${m[1]}`));
  }

  // Drop address windows that have run out, and day counters older than 40 days
  async alarm() {
    const now = this.now();
    let pending = false;
    for (const [key, times] of await this.storage.list({ prefix: 'ip:' })) {
      if (times.every((t) => now - t >= LIMITS.perAddressWindowMs)) await this.storage.delete(key);
      else pending = true;
    }
    const oldDay = warsawDay(now - 40 * 24 * 3600 * 1000);
    for (const key of (await this.storage.list({ prefix: 'day:' })).keys()) if (key.slice(4) < oldDay) await this.storage.delete(key);
    if (pending) await this.storage.setAlarm(now + LIMITS.perAddressWindowMs);
  }

  // Internal RPC over fetch (the Worker is the only caller): POST /<method> with a JSON array of arguments
  async fetch(request) {
    const method = new URL(request.url).pathname.slice(1);
    if (!['take', 'addCost', 'status', 'issueSession', 'checkSession'].includes(method)) return new Response('not found', { status: 404 });
    const args = await request.json();
    return Response.json({ result: await this[method](...args) });
  }
}
