// Taxi rides between players (step 5.5, docs/api-gracze.md): a player on foot calls a cab, the first driver in a car
// to accept gets the ride, picks the passenger up and drives them to the destination. The room only referees: one
// driver per ride, and the pick-up and the drop-off count only where the positions it knows agree. A ride lives on
// the passenger's attachment (att.ride) and the driver's (att.drive = ride id = passenger id), so it survives
// hibernation like everything else in the room.
import { BOUNDS, LIMITS } from './config.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const near = (a, b, d) => Boolean(a && b) && Math.hypot(a.x - b.x, a.z - b.z) <= d;

// Clean destination { x, z, name }, or null
export function parseDestination(to) {
  if (!to || typeof to !== 'object' || !finite(to.x) || !finite(to.z) || typeof to.name !== 'string') return null;
  const name = to.name.trim().slice(0, 60);
  if (!name || to.x < BOUNDS.minX || to.x > BOUNDS.maxX || to.z < BOUNDS.minZ || to.z > BOUNDS.maxZ) return null;
  return { x: Math.round(to.x * 10) / 10, z: Math.round(to.z * 10) / 10, name };
}

// The rides waiting for a driver, for a player who just came in
export function waitingRides(core) {
  const out = [];
  for (const a of core.players.values()) {
    if (a.stage === 'in' && a.ride?.state === 'wait' && a.p) out.push({ r: a.id, name: a.text, x: a.p.x, z: a.p.z, to: a.ride.to });
  }
  return out;
}

function byId(core, id) {
  for (const [w, a] of core.players) if (a.stage === 'in' && a.id === id) return [w, a];
  return [null, null];
}

// Ends a ride: both sides hear why, everybody else forgets the offer if it was still open
function end(core, passengerWs, passenger, t, extra = {}) {
  const ride = passenger.ride;
  if (!ride) return;
  const [driverWs, driver] = ride.driver ? byId(core, ride.driver) : [null, null];
  const msg = { t, r: passenger.id, ...extra };
  if (passengerWs) core.io.send(passengerWs, msg);
  if (driverWs) { core.io.send(driverWs, msg); delete driver.drive; core.io.persist(driverWs, driver); }
  if (ride.state === 'wait') {
    for (const [w, a] of core.players) if (w !== passengerWs && w !== driverWs && a.stage === 'in') core.io.send(w, { t: 'taxi-x', r: passenger.id });
  }
  delete passenger.ride;
  if (passengerWs) core.io.persist(passengerWs, passenger);
}

// A ride message ("taxi", "taxi-ok", "taxi-in", "taxi-end", "taxi-no"); returns true when it was one
export function rideMessage(core, ws, att, msg, now) {
  switch (msg.t) {
    case 'taxi': { // the passenger calls a cab
      const to = parseDestination(msg.to);
      if (!to || !att.p || att.p.m !== 'person' || att.ride || att.drive || now - (att.tr || 0) < LIMITS.rideCallMs) return true;
      att.tr = now;
      att.ride = { state: 'wait', to, at: now, driver: null };
      core.broadcast(ws, { t: 'taxi', r: att.id, name: att.text, x: att.p.x, z: att.p.z, to });
      return true;
    }
    case 'taxi-ok': { // a driver takes it: the first one wins
      const [pw, passenger] = byId(core, msg.r);
      const free = passenger?.ride?.state === 'wait' && att.p?.m === 'car' && !att.drive && !att.ride && passenger !== att;
      if (!free) { core.io.send(ws, { t: 'taxi-x', r: msg.r }); return true; }
      passenger.ride.state = 'pickup';
      passenger.ride.driver = att.id;
      att.drive = passenger.id;
      core.io.persist(pw, passenger);
      const ok = { t: 'taxi-ok', r: passenger.id, d: att.id, name: att.text };
      core.io.send(pw, ok);
      core.io.send(ws, ok);
      for (const [w, a] of core.players) if (w !== pw && w !== ws && a.stage === 'in') core.io.send(w, { t: 'taxi-x', r: passenger.id });
      return true;
    }
    case 'taxi-in': { // the driver stopped by the passenger
      const [pw, passenger] = byId(core, msg.r);
      if (att.drive !== msg.r || passenger?.ride?.state !== 'pickup' || !near(att.p, passenger.p, LIMITS.pickupRange)) return true;
      passenger.ride.state = 'ride';
      core.io.persist(pw, passenger);
      core.io.send(pw, { t: 'taxi-in', r: passenger.id });
      core.io.send(ws, { t: 'taxi-in', r: passenger.id });
      return true;
    }
    case 'taxi-end': { // the driver stopped at the destination
      const [pw, passenger] = byId(core, msg.r);
      if (att.drive !== msg.r || passenger?.ride?.state !== 'ride' || !near(att.p, passenger.ride.to, LIMITS.dropRange)) return true;
      end(core, pw, passenger, 'taxi-end', { to: passenger.ride.to.name });
      return true;
    }
    case 'taxi-no': { // either side calls it off
      if (att.ride) end(core, ws, att, 'taxi-no', { by: att.id });
      else if (att.drive) {
        const [pw, passenger] = byId(core, att.drive);
        if (passenger?.ride) end(core, pw, passenger, 'taxi-no', { by: att.id });
        else delete att.drive;
      }
      return true;
    }
    default:
      return false;
  }
}

// A player leaves: their ride, as a passenger or as the driver, ends for the other side
export function dropRides(core, ws, att) {
  if (att.ride) end(core, null, att, 'taxi-no', { by: att.id });
  if (att.drive) {
    const [pw, passenger] = byId(core, att.drive);
    if (passenger?.ride) end(core, pw, passenger, 'taxi-no', { by: att.id });
  }
}

// Calls nobody took for too long lapse (looked at in the room's sweep)
export function expireRides(core, now) {
  for (const [w, a] of core.players) {
    if (a.ride?.state === 'wait' && now - a.ride.at > LIMITS.rideWaitMs) end(core, w, a, 'taxi-no', { by: 0 });
  }
}
