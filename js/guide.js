// js/guide.js
// The guide and the mayor in the phone's SMS app. The guide writes once when the player first comes near a landmark
// (2-3 sentences, a "Czytaj więcej" card); the mayor greets the player and invites them to places as the courier work
// goes on. Texts: js/guide-texts.js (from docs/teksty-przewodnika.md); the mayor's are marked as in-game messages, not
// the office's position (published by the author's decision of 2026-10-26). Whom the player has already heard from
// stays in this browser (localStorage).

import { GUIDE_TEXTS } from './guide-texts.js';

const SEEN_KEY = 'bielany-guide-seen';
const CHECK_EVERY = 0.5; // s
const GUIDE = 'Przewodnik po Bielanach';
const MAYOR = 'Grzegorz Pietruczuk, burmistrz Bielan';
const MAYOR_NOTE = ' (wiadomość w grze, nie oficjalne stanowisko urzędu)';

// Where each landmark's message comes: world x, z (js/bielany-geodata.js frame) and the radius it rings in
const SITES = {
  kameduly: { x: 728, z: -1563, r: 60 },
  'las-bielanski': { x: 600, z: -1230, r: 220 },
  awf: { x: 611, z: -427, r: 90 },
  uksw: { x: 666, z: -1593, r: 80 },
  'stare-bielany': { x: 0, z: 0, r: 50 },
  wawrzyszew: { x: -671.3, z: -502.9, r: 50 },
  mlociny: { x: -1329.7, z: -995.1, r: 60 },
  'szpital-bielanski': { x: 106, z: -529, r: 80 },
  'galeria-mlociny': { x: -1287, z: -1454, r: 120 },
  'sw-zygmunt': { x: -200, z: 283, r: 60 },
  'maria-magdalena': { x: -1387, z: 120, r: 50 },
  hutnik: { x: -374.5, z: -2020.8, r: 90 },
};

// Player-facing names for the phone's Przewodnik app
const NAMES = {
  kameduly: 'Klasztor Kamedułów',
  'las-bielanski': 'Las Bielański',
  awf: 'AWF',
  uksw: 'UKSW, kampus Dewajtis',
  'stare-bielany': 'Metro Stare Bielany',
  wawrzyszew: 'Metro Wawrzyszew',
  mlociny: 'Metro Młociny',
  'szpital-bielanski': 'Szpital Bielański',
  'galeria-mlociny': 'Galeria Młociny',
  'sw-zygmunt': 'Kościół św. Zygmunta',
  'maria-magdalena': 'Kościół św. Marii Magdaleny',
  hutnik: 'Stadion Hutnika',
};

class Guide {
  /**
   * phone: js/phone.js Phone; mayor: whether the mayor's messages run
   */
  constructor(phone, { texts = GUIDE_TEXTS, mayor = true, storage = globalThis.localStorage } = {}) {
    this.phone = phone;
    this.storage = storage;
    this.mayor = mayor;
    this.guide = texts.filter((t) => t.kind === 'guide' && SITES[t.landmark]);
    this.mayorTexts = mayor ? texts.filter((t) => t.kind === 'mayor') : [];
    this.timer = 0;
    try { this.seen = new Set(JSON.parse(storage?.getItem(SEEN_KEY) || '[]')); } catch { this.seen = new Set(); }
  }

  save() {
    try { this.storage?.setItem(SEEN_KEY, JSON.stringify([...this.seen])); } catch { /* storage is optional */ }
  }

  send(t) {
    if (this.seen.has(t.id)) return false;
    this.seen.add(t.id);
    this.save();
    const fromMayor = t.kind === 'mayor';
    return this.phone.addSms({
      id: `guide-${t.id}`, from: fromMayor ? MAYOR : GUIDE,
      text: fromMayor ? `${t.sms}${MAYOR_NOTE}` : t.sms,
      more: t.more ? `${t.more}${t.sources?.length ? `\n\nŹródła: ${t.sources.join(', ')}` : ''}` : '',
    });
  }

  // Every landmark for the phone's Przewodnik app: its name, whether the player has been there, the text, the spot
  landmarks() {
    return this.guide.map((t) => {
      const s = SITES[t.landmark];
      return {
        id: t.landmark, name: NAMES[t.landmark] || t.landmark, seen: this.seen.has(t.id),
        x: s.x, z: s.z, sms: t.sms,
        more: t.more ? `${t.more}${t.sources?.length ? `\n\nŹródła: ${t.sources.join(', ')}` : ''}` : '',
      };
    });
  }

  // The mayor's welcome once the game is on screen
  start() {
    const hello = this.mayorTexts.find((t) => t.trigger === 'start') || this.mayorTexts[0];
    if (hello) setTimeout(() => this.send(hello), 4000);
  }

  // After the n-th delivery: the mayor's next invitation or thank-you (one every other delivery)
  delivered(n) {
    const rest = this.mayorTexts.filter((t) => t.trigger !== 'start' && !this.seen.has(t.id));
    if (rest.length && n % 2 === 1) this.send(rest[0]);
  }

  update(dt, pos) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = CHECK_EVERY;
    for (const t of this.guide) {
      if (this.seen.has(t.id)) continue;
      const s = SITES[t.landmark];
      if (Math.hypot(pos.x - s.x, pos.z - s.z) <= s.r) this.send(t);
    }
  }
}

export { Guide, SITES, NAMES, MAYOR, GUIDE };
