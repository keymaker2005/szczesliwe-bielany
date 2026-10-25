// js/missions.js
// Mission engine: an errand for one role, from a start (pick-up) to a target, in the allowed vehicles, finished by
// stopping within a few metres of the target; scored 1-3 stars on time. No graphics or DOM here: the game feeds it
// the player each frame (update) and draws what it reports (events, current goal).
//
// States: offered -> accepted (on the way to the start) -> enRoute (picked up, the clock runs) -> delivered | late,
// or abandoned at any point before the end.

const ARRIVE_RADIUS = 8; // m from the start or the target that counts as there
const STOP_SPEED = 1.5; // m/s: slower than this counts as stopped
const STOP_HOLD = 0.8; // s stopped inside the radius to pick up or deliver
const STAR_SLACK = [1, 1.35]; // 3 stars within par time, 2 within par × 1.35, 1 within the time limit
const SHORTCUT = 0.8; // delivered within par × 0.8: faster than the GPS route, a shortcut bonus

const ENDED = new Set(['delivered', 'late', 'abandoned']);

/**
 * A mission: { id, role, title, start: { x, z, name } | null (picked up at once), target: { x, z, name },
 * vehicles: modes allowed (person, cyclist, car, helicopter), par: s for 3 stars, limit: s before it is late,
 * reward: zł at 3 stars, bonus: share of the pay added for a shortcut (0: none), onFinish(m): called on delivery
 * before the state changes }
 */
function createMission(spec) {
  const m = {
    id: spec.id,
    role: spec.role || 'courier',
    title: spec.title || 'Zlecenie',
    start: spec.start || null,
    target: spec.target,
    vehicles: spec.vehicles || ['person', 'cyclist', 'car'],
    par: spec.par,
    limit: spec.limit ?? spec.par * 1.8,
    reward: spec.reward ?? 0,
    bonus: spec.bonus ?? 0,
    onFinish: spec.onFinish || null,
    radius: spec.radius ?? ARRIVE_RADIUS,
    state: 'offered',
    time: 0, // s since the pick-up
    hold: 0, // s stopped in the radius
    stars: 0,
    paid: 0,
    shortcut: 0, // zł of shortcut bonus paid
  };
  if (!(m.par > 0) || !m.target) throw new Error(`mission ${m.id}: needs a target and a par time`);
  return m;
}

// Stars for a delivery time: 0 when late
function starsFor(m, time) {
  if (time > m.limit) return 0;
  return time <= m.par * STAR_SLACK[0] ? 3 : time <= m.par * STAR_SLACK[1] ? 2 : 1;
}

class MissionEngine {
  constructor() {
    this.missions = new Map();
    this.active = null;
    this.listeners = new Map();
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
    return () => this.listeners.set(event, this.listeners.get(event).filter((f) => f !== fn));
  }

  emit(event, ...args) {
    for (const fn of this.listeners.get(event) || []) fn(...args);
  }

  setState(m, state) {
    const from = m.state;
    m.state = state;
    m.hold = 0;
    this.emit('state', m, from);
  }

  offer(spec) {
    const m = createMission(spec);
    this.missions.set(m.id, m);
    this.emit('state', m, null);
    return m;
  }

  // Takes an offered mission (one at a time); without a start it is picked up at once
  accept(id) {
    const m = this.missions.get(id);
    if (!m || m.state !== 'offered' || this.active) return false;
    this.active = m;
    this.setState(m, 'accepted');
    if (!m.start) this.setState(m, 'enRoute');
    return true;
  }

  abandon() {
    const m = this.active;
    if (!m) return false;
    this.active = null;
    this.setState(m, 'abandoned');
    return true;
  }

  // Where the player should go now: the start, then the target (null when nothing is active)
  goal() {
    const m = this.active;
    if (!m) return null;
    return m.state === 'accepted' ? m.start : m.target;
  }

  /**
   * One frame: player = { x, z, speed (m/s), mode }. Counts the clock, picks up and delivers. Returns a note for the
   * HUD when the player is at the goal in a vehicle the mission does not allow (else null).
   */
  update(dt, player) {
    const m = this.active;
    if (!m) return null;
    if (m.state === 'enRoute') m.time += dt;
    const goal = this.goal();
    const there = Math.hypot(player.x - goal.x, player.z - goal.z) <= m.radius;
    if (!there) { m.hold = 0; return null; }
    if (!m.vehicles.includes(player.mode)) { m.hold = 0; return 'wrong-vehicle'; }
    m.hold = Math.abs(player.speed) < STOP_SPEED ? m.hold + dt : 0;
    if (m.hold < STOP_HOLD) return null;
    if (m.state === 'accepted') {
      this.setState(m, 'enRoute');
    } else {
      m.stars = starsFor(m, m.time);
      m.paid = Math.round((m.reward * Math.max(m.stars, 0.5)) / 3);
      if (m.bonus && m.time <= m.par * SHORTCUT) m.shortcut = Math.round(m.paid * m.bonus);
      m.paid += m.shortcut;
      if (m.onFinish) m.onFinish(m); // the role adds its own (a tip) before anyone hears of the end
      this.active = null;
      this.setState(m, m.stars ? 'delivered' : 'late');
    }
    return null;
  }

  // Missions not yet ended
  open() {
    return [...this.missions.values()].filter((m) => !ENDED.has(m.state));
  }
}

export { MissionEngine, createMission, starsFor, ARRIVE_RADIUS, STOP_HOLD, SHORTCUT };
