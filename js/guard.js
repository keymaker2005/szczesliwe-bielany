// js/guard.js
// The city guard (Straż Miejska, step 3.5): reports to real OpenStreetMap addresses 0.25-1.5 km from the player — a car on
// a lawn, litter by the woods or by a block, noise from a balcony or a car. Drive there in the patrol car (the player's
// car, marked: js/guard-car.js), and on the spot choose a warning (pouczenie), a fine (mandat) or, for a car on a lawn,
// a tow (laweta). Each report has a small story (a first offence and an apology, or the third complaint); the stars
// follow how well the choice fits it, capped by the response time. Words only: no weapons, no violence.

import { GEO } from './bielany-geodata.js';
import { findRoute } from './gps-route.js';
import { starsOf } from './medic.js';

const SERVICE = 'Straż Miejska';
const DISPATCH = 'Dyżurny Straży Miejskiej';
const CALL_MIN = 250, CALL_MAX = 1500; // m from the player
const PACE = 10; // m/s in the patrol car
const PAR_EXTRA = 30; // s
const BASE = 20, PER_KM = 4; // zł
const ARRIVE_RADIUS = 8; // m, the mission's (js/missions.js ARRIVE_RADIUS)
const WOOD_REACH = 120; // m: a litter-by-the-woods address lies this close to a wood's edge
const STORE_KEY = 'bielany-guard';

const OPTIONS = {
  warn: { id: 'warn', label: 'Pouczenie', hint: 'Rozmowa i prośba o poprawę, bez kary.' },
  fine: { id: 'fine', label: 'Mandat', hint: 'Kara finansowa, na piśmie.' },
  tow: { id: 'tow', label: 'Wezwij lawetę', hint: 'Auto zostaje odholowane.' },
};
const OPTION_NAMES = { warn: 'pouczenie', fine: 'mandat', tow: 'lawetę' };

// kind: { label (the report), place (where, "przy ..."), options, stories: [{ fact, best, why }] }
const KINDS = {
  lawn: {
    title: 'Auto na trawniku',
    report: 'samochód zaparkowany na trawniku',
    options: ['warn', 'fine', 'tow'],
    stories: [
      { fact: 'Kierowca właśnie wraca z zakupami, przeprasza i od razu odjeżdża. To jego pierwsza taka sytuacja.', best: 'warn', why: 'pierwszy raz i przeprosiny' },
      { fact: 'Ten sam samochód stał tu na trawie już wczoraj i w zeszłym tygodniu. Kierowca wzrusza ramionami.', best: 'fine', why: 'to był powtórny wybryk' },
      { fact: 'Auto stoi przed wyjazdem z garażu podziemnego, mieszkańcy nie mogą wyjechać, kierowcy nie widać.', best: 'tow', why: 'auto blokuje wyjazd, a kierowcy nie ma' },
    ],
  },
  litter: {
    title: 'Śmieci',
    report: 'porzucone śmieci',
    options: ['warn', 'fine'],
    stories: [
      { fact: 'Rodzina z dzieckiem zbiera rozsypane śmieci z przewróconego kosza. Rodzic się tłumaczy: wiatr.', best: 'warn', why: 'ludzie sami sprzątają' },
      { fact: 'Worki z gruzem z remontu. Na jednym z nich leży paczka z adresem pobliskiego mieszkania.', best: 'fine', why: 'to celowe porzucenie, z adresem sprawcy' },
      { fact: 'Torba po pikniku, kilka puszek. Na miejscu jest starszy pan, który zaraz to wyrzuci do kosza.', best: 'warn', why: 'drobna sprawa i dobra wola' },
    ],
  },
  noise: {
    title: 'Hałas',
    report: 'zbyt głośna muzyka',
    options: ['warn', 'fine'],
    stories: [
      { fact: 'Głośna muzyka z balkonu. Mieszkaniec otwiera po pierwszym dzwonku i ścisza, to pierwsza skarga na niego.', best: 'warn', why: 'pierwsza skarga i szybka poprawa' },
      { fact: 'Głośna muzyka z balkonu, to już trzecia skarga sąsiadów w tym miesiącu. Mieszkaniec nie reaguje na uwagi.', best: 'fine', why: 'trzecia skarga i brak reakcji' },
      { fact: 'Auto z odkręconym basem stoi pod blokiem. Kierowca ścisza po pierwszej uwadze i przeprasza.', best: 'warn', why: 'przeprosiny i natychmiastowa poprawa' },
      { fact: 'Auto z hałaśliwym wydechem i basem krąży wokół osiedla, kierowca się śmieje. Skargi trwają od tygodni.', best: 'fine', why: 'uporczywe zakłócanie ciszy' },
    ],
  },
};

const STREETS = GEO.addresses.streets;
const ADDRESSES = GEO.addresses.list;
const addressName = (a) => `${STREETS[a[0]]} ${a[1]}`;

// The woods' outer-edge vertices (every 4th), for "litter by the woods"; built on first use
let woodEdge = null;
function nearWood(x, z) {
  if (!woodEdge) {
    woodEdge = [];
    for (const [outer] of GEO.woods || []) for (let k = 0; k < outer.length; k += 8) woodEdge.push(outer[k], outer[k + 1]);
  }
  for (let k = 0; k < woodEdge.length; k += 2) if (Math.hypot(woodEdge[k] - x, woodEdge[k + 1] - z) < WOOD_REACH) return true;
  return false;
}

/** Stars for a choice: 3 for the story's best, 2 when it is nearly as good (tow <-> fine), else 1 */
function choiceStars(best, choice) {
  if (choice === best) return 3;
  return (best === 'tow' && choice === 'fine') || (best === 'fine' && choice === 'tow') ? 2 : 1;
}

const RULES = 'Ocena: gwiazdki za trafną decyzję (pouczenie przy pierwszym razie i przeprosinach, mandat przy powtórce lub uporczywym łamaniu, laweta gdy auto blokuje) oraz za czas dojazdu; liczy się niższa.';
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const starText = (n) => '★'.repeat(n) || 'za długo';

class Guard {
  constructor(missions, { random = Math.random, storage = globalThis.localStorage, choose = null } = {}) {
    this.missions = missions;
    this.random = random;
    this.storage = storage;
    this.choose = choose; // async ({ title, text, options }) -> option id (dispatch.choose in the game)
    this.offers = [];
    this.serial = 0;
    this.near = null;
    this.response = 0; // s since the call was taken
    this.served = { lawn: 0, litter: 0, noise: 0 };
    this.stats = { calls: 0, earned: 0 };
    try {
      const saved = JSON.parse(storage?.getItem(STORE_KEY) || 'null');
      if (saved) this.stats = { ...this.stats, ...saved };
    } catch { /* storage is optional */ }
    missions.on('state', (m) => {
      if (m.role !== 'guard') return;
      if (m.state === 'accepted') this.response = 0;
      if (m.state === 'enRoute') {
        m.responseTime = this.response;
        this.decide(m);
      }
      if (m.state === 'delivered' || m.state === 'late') {
        this.stats.calls++;
        this.stats.earned += m.paid;
        this.served[m.kind]++;
        this.save();
      }
      if (['delivered', 'late', 'abandoned'].includes(m.state)) this.offers = [];
    });
  }

  save() {
    try { this.storage?.setItem(STORE_KEY, JSON.stringify(this.stats)); } catch { /* storage is optional */ }
  }

  // On the spot: the mission waits (radius 0 = never "there") until the player has chosen
  decide(m) {
    m.radius = 0;
    const kind = KINDS[m.kind];
    const story = kind.stories[m.story];
    const pick = this.choose
      ? this.choose({ title: `${kind.title}: ${m.start.name.replace(/^zgłoszenie, /, '')}`, text: `${story.fact} ${RULES}`, options: kind.options.map((k) => OPTIONS[k]) })
      : Promise.resolve(kind.options[0]);
    return Promise.resolve(pick).then((choice) => {
      if (this.missions.active !== m) return;
      m.choice = choice;
      m.choiceStars = choiceStars(story.best, choice);
      m.radius = ARRIVE_RADIUS; // the player is still there: the call ends with a short stop
    });
  }

  nextKind() {
    const least = Math.min(...Object.values(this.served));
    const pool = Object.keys(KINDS).filter((k) => this.served[k] === least);
    return pool[Math.floor(this.random() * pool.length)];
  }

  makeOffer(near) {
    if (!near) return null;
    const kindKey = this.nextKind();
    const kind = KINDS[kindKey];
    for (let tries = 0; tries < 60; tries++) {
      const a = ADDRESSES[Math.floor(this.random() * ADDRESSES.length)];
      const d = Math.hypot(a[4] - near.x, a[5] - near.z);
      if (d < CALL_MIN || d > CALL_MAX) continue;
      // litter: half by the woods (needs a wood within reach), half by a block
      const story = Math.floor(this.random() * kind.stories.length);
      const byWood = kindKey === 'litter' && this.random() < 0.5;
      if (byWood && !nearWood(a[4], a[5])) continue;
      const route = findRoute(near.x, near.z, a[4], a[5]);
      if (!route) continue;
      const guard = this;
      const par = Math.round(route.length / PACE + PAR_EXTRA);
      const where = kindKey === 'litter' ? (byWood ? 'przy lesie, ' : 'przy bloku, ') : '';
      return {
        id: `guard-${++this.serial}`,
        title: `Zgłoszenie · ${SERVICE}`,
        role: 'guard',
        kind: kindKey,
        story,
        reason: kind.report,
        start: { x: a[4], z: a[5], name: `zgłoszenie, ${where}${addressName(a)}` },
        target: { x: a[4], z: a[5], name: `${where}${addressName(a)}` },
        from: `${where}${addressName(a)}`,
        to: 'na miejscu: pouczenie, mandat lub inne (ocena: trafność decyzji i czas dojazdu)',
        distance: route.length,
        vehicles: ['car'],
        par,
        limit: par * 3,
        responsePar: par,
        reward: Math.round(BASE + (PER_KM * route.length) / 1000),
        onFinish(m) { guard.finish(m); },
      };
    }
    return null;
  }

  refill() {
    const near = this.near?.();
    if (!this.offers.length) {
      const o = this.makeOffer(near);
      if (o) this.offers.push(o);
    }
    return this.offers;
  }

  accept(id) {
    const o = this.offers.find((x) => x.id === id);
    if (!o || this.missions.active) return false;
    const m = this.missions.offer(o);
    Object.assign(m, { responsePar: o.responsePar, reason: o.reason, kind: o.kind, story: o.story }); // before 'accepted' is heard
    this.offers = [];
    return this.missions.accept(o.id);
  }

  jobs() {
    if (this.missions.active) return [];
    this.refill();
    return this.offers.map((o) => ({
      id: o.id, title: o.title, from: `${o.from} (${o.reason})`, to: o.to, distance: o.distance, par: o.par,
      reward: o.reward, vehicles: 'radiowozem (auto)', accept: () => this.accept(o.id),
    }));
  }

  // The lower of the response time's and the choice's stars; the pay follows them
  finish(m) {
    m.responseStars = starsOf(m.responseTime ?? 0, m.responsePar || m.par);
    m.stars = Math.min(m.choiceStars ?? 1, m.responseStars);
    m.paid = Math.round((m.reward * Math.max(m.stars, 0.5)) / 3);
  }

  update(dt) {
    const m = this.missions.active;
    if (m && m.role === 'guard' && m.state === 'accepted') this.response += dt;
  }

  statusLine() {
    const s = this.stats;
    return s.calls ? `${SERVICE} · zgłoszenia: ${s.calls} · ${s.earned} zł` : `${SERVICE} · czekamy na zgłoszenia`;
  }
}

// The dispatcher's text messages (js/dispatch.js)
const MESSAGES = {
  call: (m) => `Zgłoszenie: ${m.start.name.replace(/^zgłoszenie, /, '')} — ${m.reason || 'prosimy o interwencję'}. Jedź radiowozem, na miejscu zdecydujesz, co zrobić. ${RULES}`,
  picked: (m) => `Jesteś na miejscu (dojazd ${clock(m.responseTime || 0)}). Oceń sytuację i wybierz: pouczenie, mandat albo inne rozwiązanie.`,
  done: (m) => {
    const story = KINDS[m.kind]?.stories[m.story];
    const chose = OPTION_NAMES[m.choice] || 'decyzję';
    const verdict = m.choiceStars === 3 ? `Trafna decyzja (${chose}): ${story?.why}.` : m.choiceStars === 2 ? `${chose[0].toUpperCase()}${chose.slice(1)} to też wyjście, ale lepiej pasowało inne: ${story?.why}.` : `Wybrane ${chose} nie pasowało do sytuacji. Tu liczyło się: ${story?.why}.`;
    return `${verdict} Dojazd ${clock(m.responseTime || 0)} (${starText(m.responseStars)}). Ocena ${starText(m.stars)}, ${m.paid} zł.`;
  },
};

export { Guard, KINDS, MESSAGES, SERVICE, DISPATCH, choiceStars };
