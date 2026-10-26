// js/film-plan.js
// The plan of the ?film showreel (js/film.js) without three.js or the DOM, so the tests can load it: the shots and
// their lengths, the motion of a vehicle on rails (cruise, brake, stop), the frame-time statistics of a recording and
// the shot list written next to the raw video (docs/media/film-ujecia.md) for the editing session.

// The shots in order: id, name for the shot list, seconds recorded, seconds set up before (the recorder paused: the
// traffic fills the new place, the shaders of what is new compile)
const SHOTS = [
  { id: 'helikopter', part: '1', name: 'Helikopter nad Kamedułami i skarpą, przelot w stronę Starych Bielan', dur: 6, pre: 4 },
  { id: 'karetka', part: '2', name: 'Karetka na sygnale Marymoncką, auta zjeżdżają do krawężnika, dojazd pod Szpital Bielański', dur: 8, pre: 4 },
  { id: 'straz-pozarna', part: '3a', name: 'Strażak gasi pożar (działko wodne z wozu)', dur: 3.3, pre: 3 },
  { id: 'straz-miejska', part: '3b', name: 'Straż Miejska przy aucie na trawniku', dur: 3.3, pre: 3 },
  { id: 'taksowka', part: '3c', name: 'Taksówka podjeżdża po pasażera', dur: 3.4, pre: 3 },
  { id: 'telefon', part: '4', name: 'Telefon: SMS przewodnika przy klasztorze, potem czat z odpowiedzią ze źródłem', dur: 8, pre: 3 },
  { id: 'marymoncka', part: '5', name: 'Pieszo Marymoncką: tabliczka ulicy, tramwaj, spadające liście', dur: 8, pre: 3 },
];

// The phone shot's own timeline (s from the start of the shot)
const PHONE = { slideIn: 0.3, slideDur: 0.5, chatAt: 4.0, chatDur: 0.35, askAt: 4.4, typingAt: 4.9, answerAt: 6.0 };

/** Start and end of every shot on the recording's clock (s) */
function timeline(shots = SHOTS) {
  let t = 0;
  return shots.map((s) => {
    const row = { ...s, start: t, end: t + s.dur };
    t += s.dur;
    return row;
  });
}

/**
 * A vehicle on rails that cruises at v, brakes evenly over `brake` s and stands still at sEnd from tStop on (times on
 * the shot's clock, negative while it is set up). -> { s, speed }
 */
function stopProfile(t, { sEnd, v, tStop, brake }) {
  const t0 = tStop - brake; // brakes from here
  const s0 = sEnd - (v * brake) / 2;
  if (t >= tStop) return { s: sEnd, speed: 0 };
  if (t <= t0) return { s: s0 - v * (t0 - t), speed: v };
  const tau = t - t0;
  return { s: s0 + v * tau - (v / (2 * brake)) * tau * tau, speed: v * (1 - tau / brake) };
}

// Smooth 0..1 (ease in and out)
const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

/** Frame intervals (ms) of a recording -> fps and how many frames came late */
function frameStats(intervals, fps = 60) {
  const n = intervals.length;
  if (!n) return { frames: 0, fps: 0, mean: 0, p99: 0, max: 0, late: 0, dropped: 0 };
  const sorted = [...intervals].sort((a, b) => a - b);
  const sum = intervals.reduce((a, b) => a + b, 0);
  const budget = 1000 / fps;
  return {
    frames: n + 1,
    fps: Math.round((n / sum) * 1000 * 10) / 10,
    mean: Math.round((sum / n) * 100) / 100,
    p99: Math.round(sorted[Math.min(n - 1, Math.floor(n * 0.99))] * 100) / 100,
    max: Math.round(sorted[n - 1] * 100) / 100,
    late: intervals.filter((d) => d > budget * 1.5).length, // a frame shown twice
    dropped: Math.round(intervals.reduce((a, d) => a + Math.max(0, Math.round(d / budget) - 1), 0)), // frames missing
  };
}

const sec = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

/** The shot list for the editing session: Markdown with the timestamps, the recording's settings and smoothness */
function shotList({ shots = timeline(), recorded = null, stats = null, perShot = null, render = null, settings = {} } = {}) {
  const lines = [
    '# Film z gry: znaczniki ujęć (surowe nagranie)',
    '',
    `Plik: docs/media/film-surowy.webm. Nagranie z trybu ?film (js/film.js), ${settings.date || ''}.`.trim(),
    `Obraz: ${settings.width || 1920}×${settings.height || 1080}, ${settings.fps || 60} kl./s, ${settings.mime || 'WebM'}, ${settings.bitrate ? `${Math.round(settings.bitrate / 1e6)} Mb/s` : ''}; bez dźwięku, bez napisów, bez interfejsu gry poza telefonem w ujęciu 6 (część 4 planu).`,
    'Preset: Złota jesień · 12:40. Ujęcia sklejone bez przejść (cięcia na styk): przejścia i napisy w montażu.',
    'Do montażu dopisać atrybucję danych: „Dane: © współtwórcy OpenStreetMap (ODbL); GUGiK, geoportal.gov.pl”.',
    '',
    '| Nr | Część planu | Od | Do | Długość | Ujęcie |',
    '|---|---|---|---|---|---|',
    ...shots.map((s, i) => {
      const r = recorded?.[i];
      const start = r ? r.start : s.start;
      const end = r ? r.end : s.end;
      return `| ${i + 1} | ${s.part || ''} | ${sec(start)} | ${sec(end)} | ${(end - start).toFixed(2)} s | ${s.name} |`;
    }),
    '',
    'Telefon w ujęciu 6 (czas od początku ujęcia): wsuwa się 0,3–0,8 s; SMS przewodnika do 4,0 s; czat od 4,0 s, pytanie 4,4 s, „pisze…” 4,9 s, odpowiedź ze źródłem 6,0 s.',
  ];
  if (stats) {
    lines.push('', '## Płynność nagrania', '',
      `Klatki: ${stats.frames}, średnio ${stats.fps} kl./s, średni odstęp ${stats.mean} ms, 99% klatek do ${stats.p99} ms, najdłuższa przerwa ${stats.max} ms, spóźnione klatki (powtórzona poprzednia): ${stats.late}, brakujące klatki: ${stats.dropped}.`);
    if (render) {
      lines.push('', `Nagranie klatka po klatce (WebCodecs): każda klatka to dokładnie 1/${settings.fps || 60} s gry, niezależnie od tego, jak szybko komputer ją narysował. Sama gra rysowała w tym czasie średnio ${render.fps} kl./s (najdłuższa klatka ${render.max} ms).`);
    }
    if (perShot) {
      lines.push('', '| Nr | kl./s | najdłuższa przerwa | spóźnione |', '|---|---|---|---|',
        ...perShot.map((p, i) => `| ${i + 1} | ${p.fps} | ${p.max} ms | ${p.late} |`));
    }
  }
  return `${lines.join('\n')}\n`;
}

export { SHOTS, PHONE, timeline, stopProfile, smooth, frameStats, shotList };
