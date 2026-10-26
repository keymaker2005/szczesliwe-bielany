// The players' chat (step 5.6b, decision 8 of docs/plan-fazy-5.md): short messages to everybody in the room, through
// the filter (filter.js), one per 3 s, nothing stored. Players can report someone: when enough different players in the
// room report the same one, that player can't write for 30 minutes (and everybody stops seeing their messages).
// "Wycisz" (mute) is the game's own, for the one who mutes; it needs no server.
import { LIMITS } from './config.js';
import { cleanChat } from './filter.js';

const everyone = (core) => [...core.players].filter(([, a]) => a.stage === 'in').map(([w]) => w);

// How many different reporters silence a player: 3, fewer in a small room (but never one person alone)
export function reportsNeeded(playersInRoom) {
  return Math.max(2, Math.min(LIMITS.reportsToSilence, playersInRoom - 1));
}

// Returns true when the message was a chat one ("czat", "zglos")
export function talkMessage(core, ws, att, msg, now) {
  if (msg.t === 'czat') {
    const raw = typeof msg.txt === 'string' ? msg.txt.replace(/\s+/g, ' ').trim() : '';
    if (!raw || [...raw].length > LIMITS.chatChars) return true;
    if (att.silenced > now) { core.io.send(ws, { t: 'czat-x', reason: 'silenced', until: att.silenced }); return true; }
    if (now - (att.tc || 0) < LIMITS.chatMs) { core.io.send(ws, { t: 'czat-x', reason: 'slow' }); return true; }
    att.tc = now;
    const { text } = cleanChat(raw);
    for (const w of everyone(core)) core.io.send(w, { t: 'czat', id: att.id, name: att.text, color: att.color, txt: text });
    return true;
  }
  if (msg.t === 'zglos') {
    let target = null, targetWs = null;
    for (const [w, a] of core.players) if (a.stage === 'in' && a.id === msg.id) { target = a; targetWs = w; }
    if (!target || target === att) return true;
    target.reports = [...new Set([...(target.reports || []), att.id])];
    core.io.send(ws, { t: 'zglos-ok', id: target.id });
    const room = everyone(core).length;
    if (target.reports.length >= reportsNeeded(room) && !(target.silenced > now)) {
      target.silenced = now + LIMITS.silenceMs;
      target.reports = [];
      core.io.send(targetWs, { t: 'czat-x', reason: 'silenced', until: target.silenced });
      for (const w of everyone(core)) if (w !== targetWs) core.io.send(w, { t: 'czat-cisza', id: target.id });
    }
    core.io.persist(targetWs, target);
    return true;
  }
  return false;
}
