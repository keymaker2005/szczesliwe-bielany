// Shared emergency calls (step 5.6, docs/api-gracze.md): a player who takes a fire-service call announces it, the
// others in the room may join, and the room adds up everybody's work (spraying, pumping, the ladder) until it is
// done for all. The call is sent as an address and a storey, and every game rebuilds the same incident from them
// (js/firefighter.js incidentAt), so the room keeps only numbers. The calls live in the room's memory: a room only
// sleeps when nobody sends anything, and then nobody is working on a call either.
import { LIMITS } from './config.js';

const KINDS = ['fire', 'flood', 'cat'];

function others(core, ids, except = null) {
  const out = [];
  for (const [w, a] of core.players) if (a.stage === 'in' && ids.has(a.id) && w !== except) out.push(w);
  return out;
}

function everyone(core) {
  return [...core.players].filter(([, a]) => a.stage === 'in').map(([w]) => w);
}

export function publicEvent(e) {
  return { e: e.e, k: e.k, a: e.a, f: e.f, by: e.by, name: e.name, p: Math.round(e.progress * 100) / 100, n: e.parts.size };
}

export function openEvents(core) {
  return [...(core.events?.values() || [])].filter((e) => !e.done).map(publicEvent);
}

// A player stops working on a call; the last one out ends it for everybody
function quit(core, e, id) {
  e.parts.delete(id);
  if (e.parts.size === 0 && !e.done) {
    core.events.delete(e.e);
    for (const w of everyone(core)) core.io.send(w, { t: 'zd-x', e: e.e });
  }
}

// Returns true when the message was a shared-call one ("zd", "zd-dol", "zd-p", "zd-x")
export function eventMessage(core, ws, att, msg, now) {
  core.events ??= new Map();
  switch (msg.t) {
    case 'zd': { // announce a call I took
      const ok = KINDS.includes(msg.k) && Number.isInteger(msg.a) && msg.a >= 0 && msg.a < 1e6 && Number.isInteger(msg.f) && msg.f >= 0 && msg.f < 50;
      if (!ok || now - (att.tz || 0) < LIMITS.callMs || core.events.size >= LIMITS.maxEvents) return true;
      for (const e of core.events.values()) if (e.parts.has(att.id)) quit(core, e, att.id); // one call at a time
      att.tz = now;
      core.eventSerial = (core.eventSerial || 0) + 1;
      const e = { e: core.eventSerial, k: msg.k, a: msg.a, f: msg.f, by: att.id, name: att.text, parts: new Set([att.id]), progress: 0, sent: 0, done: false, at: now };
      core.events.set(e.e, e);
      for (const w of everyone(core)) core.io.send(w, { t: 'zd', ...publicEvent(e), mine: w === ws });
      return true;
    }
    case 'zd-dol': { // join a call
      const e = core.events.get(msg.e);
      if (!e || e.done) { core.io.send(ws, { t: 'zd-x', e: msg.e }); return true; }
      for (const o of core.events.values()) if (o !== e && o.parts.has(att.id)) quit(core, o, att.id);
      e.parts.add(att.id);
      core.io.send(ws, { t: 'zd-stan', e: e.e, p: e.progress, n: e.parts.size });
      for (const w of others(core, e.parts, ws)) core.io.send(w, { t: 'zd-dol', e: e.e, id: att.id, name: att.text, n: e.parts.size });
      return true;
    }
    case 'zd-p': { // my share of the work since the last one (a fraction of the whole job)
      const e = core.events.get(msg.e);
      const d = typeof msg.d === 'number' && Number.isFinite(msg.d) ? Math.min(Math.max(msg.d, 0), LIMITS.workStep) : 0;
      if (!e || e.done || !e.parts.has(att.id) || !d) return true;
      e.progress = Math.min(1, e.progress + d);
      if (e.progress >= 1) {
        e.done = true;
        for (const w of others(core, e.parts)) core.io.send(w, { t: 'zd-koniec', e: e.e, n: e.parts.size });
        for (const w of everyone(core)) if (!e.parts.has(core.players.get(w).id)) core.io.send(w, { t: 'zd-x', e: e.e });
        core.events.delete(e.e);
      } else if (e.progress - e.sent >= 0.02) {
        e.sent = e.progress;
        for (const w of others(core, e.parts)) core.io.send(w, { t: 'zd-stan', e: e.e, p: Math.round(e.progress * 1000) / 1000, n: e.parts.size });
      }
      return true;
    }
    case 'zd-x': { // I leave the call (abandoned, or finished on my side)
      const e = core.events.get(msg.e);
      if (e && e.parts.has(att.id)) quit(core, e, att.id);
      return true;
    }
    default:
      return false;
  }
}

// A player leaves the room: out of every call; calls nobody touched for too long go
export function dropEvents(core, att, now) {
  if (!core.events) return;
  for (const e of [...core.events.values()]) {
    if (e.parts.has(att?.id)) quit(core, e, att.id);
    else if (now - e.at > LIMITS.eventMs) { e.parts.clear(); quit(core, e, -1); }
  }
}
