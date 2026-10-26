// js/film.js
// ?film (on localhost only; tools/build-dist.mjs leaves this module out of the published site): the game plays a
// ~40 s showreel by itself and records it, for a video on LinkedIn. The shots are in js/film-plan.js. Each one is set
// up while the recorder is paused (the traffic fills the new place, what is new compiles its shaders), so the cuts land
// on a living city. Every frame the 3D canvas, and in the phone shot the phone drawn here, go into a 1920×1080 canvas
// recorded with captureStream + MediaRecorder (no sound, no captions: the editing comes later). At the end the video
// and the shot list go to tools/serve.mjs (PUT /__film/...), which writes them to docs/media/.
// ?film=podglad records nothing and saves three stills per shot instead (docs/media/podglad/), to frame the shots.
// The game's own modules stay as they are: the shots move the player's entities and the camera from outside, after
// the controllers' update (like a teleport every frame), and use the services' liveries through their interfaces.

import * as THREE from 'three/webgpu';
import { BODY_SPECS, buildCarGeometry, createLoftedCarMaterial } from './actor-models.js';
import { GEO } from './bielany-geodata.js';
import { blockAt, TELEPORT_LOCATIONS } from './city-config.js';
import { findRoute, nearestOnStreet } from './gps-route.js';
import { GUIDE_TEXTS } from './guide-texts.js';
import { groundY } from './terrain.js';
import { at as tramAt } from './trams.js';
import { SHOTS, PHONE, timeline, stopProfile, smooth, frameStats, shotList } from './film-plan.js';

const W = 1920, H = 1080, FPS = 60;
const MIMES = { vp9: 'video/webm;codecs=vp9', vp8: 'video/webm;codecs=vp8', h264: 'video/webm;codecs=h264', av1: 'video/webm;codecs=av01' };
const KAMEDULY = { x: 720, z: -1575 }; // the church (js/landmarks.js KAMEDULY_RING)
const TAXI = { yellow: '#ffc21a', ink: '#17140a' };
const ADDRESSES = GEO.addresses.list;
const STREETS = GEO.addresses.streets;
const wrap = (a) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, k) => a + (b - a) * k;

// Repeatable "random" for the services' offers (the same fire every run)
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A drive along the streets: a GPS route (flat x, z pairs) shifted `offset` m to the right (the lane), resampled
// every metre and rounded at the corners. -> { x[], z[], length }
function rail(pts, offset) {
  const n = pts.length / 2;
  const px = [], pz = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let dx = pts[2 * b] - pts[2 * a], dz = pts[2 * b + 1] - pts[2 * a + 1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    px.push(pts[2 * i] - dz * offset);
    pz.push(pts[2 * i + 1] + dx * offset);
  }
  const x = [px[0]], z = [pz[0]];
  let carry = 0;
  for (let i = 1; i < n; i++) {
    const dx = px[i] - px[i - 1], dz = pz[i] - pz[i - 1], l = Math.hypot(dx, dz);
    for (let d = 1 - carry; d <= l; d += 1) { x.push(px[i - 1] + (dx * d) / l); z.push(pz[i - 1] + (dz * d) / l); }
    carry = (carry + l) % 1;
  }
  // rounded: a moving average over ±5 m (the ends stay put)
  const sx = x.slice(), sz = z.slice();
  for (let i = 5; i < x.length - 5; i++) {
    let ax = 0, az = 0;
    for (let k = -5; k <= 5; k++) { ax += x[i + k]; az += z[i + k]; }
    sx[i] = ax / 11; sz[i] = az / 11;
  }
  return { x: sx, z: sz, length: sx.length - 1 };
}

function railAt(r, s) {
  const c = clamp(s, 0, r.length);
  const i = Math.min(r.length - 1, Math.floor(c)), f = c - i;
  const a = clamp(Math.floor(c - 2.5), 0, r.length), b = clamp(Math.ceil(c + 2.5), 0, r.length);
  return {
    x: lerp(r.x[i], r.x[i + 1], f), z: lerp(r.z[i], r.z[i + 1], f),
    heading: Math.atan2(r.x[b] - r.x[a], r.z[b] - r.z[a]),
  };
}

// The last `len` m of a route (flat pairs)
function routeTail(pts, len) {
  let acc = 0;
  for (let i = pts.length - 2; i >= 2; i -= 2) {
    acc += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    if (acc >= len) return pts.slice(i - 2);
  }
  return pts.slice();
}

// How much a route turns (rad, summed every 5 m)
function turning(pts) {
  const r = rail(pts, 0);
  let sum = 0, prev = null;
  for (let s = 0; s <= r.length; s += 5) {
    const h = railAt(r, s).heading;
    if (prev !== null) sum += Math.abs(wrap(h - prev));
    prev = h;
  }
  return sum;
}

// The street's direction at a point next to it: across the line from the point to its nearest street spot
function streetFrame(x, z) {
  const s = nearestOnStreet(x, z);
  const nx = (x - s.x) / (s.d || 1), nz = (z - s.z) / (s.d || 1); // from the street towards the point
  return { s, nx, nz, dx: -nz, dz: nx };
}

// ---------------------------------------------------------------------------------------------------------------------
// The phone (shot 6), drawn like js/phone.js looks (css/style.css .phone*, .chat*), 1.6× its on-screen size
// ---------------------------------------------------------------------------------------------------------------------
const PW = 468, PH = 900, PAD = 60; // the phone; margin for its shadow
const FONT = '"Inter", -apple-system, "Helvetica Neue", Arial, sans-serif';

function wrapText(g, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    if (!para) { lines.push(''); continue; }
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// The handset and its wallpaper (no content): drawn once
function phoneBody() {
  const [c, g] = canvas2d(PW + PAD * 2, PH + PAD * 2);
  g.translate(PAD, PAD);
  g.save();
  g.shadowColor = 'rgba(0, 0, 0, 0.55)';
  g.shadowBlur = 50;
  g.shadowOffsetY = 26;
  g.beginPath();
  g.roundRect(0, 0, PW, PH, 54);
  const body = g.createLinearGradient(0, 0, PW * 0.6, PH);
  body.addColorStop(0, '#2b2d33');
  body.addColorStop(1, '#121317');
  g.fillStyle = body;
  g.fill();
  g.restore();
  g.lineWidth = 5;
  g.strokeStyle = '#08090b';
  g.beginPath(); g.roundRect(3, 3, PW - 6, PH - 6, 51); g.stroke();
  g.lineWidth = 1.5;
  g.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  g.beginPath(); g.roundRect(0.75, 0.75, PW - 1.5, PH - 1.5, 54); g.stroke();
  // the bar: the time, the network
  g.fillStyle = '#f6f5f2';
  g.font = `700 19px ${FONT}`;
  g.textBaseline = 'middle';
  g.fillText('12:40', 40, 34);
  g.font = `500 17px ${FONT}`;
  g.fillStyle = 'rgba(246, 245, 242, 0.68)';
  g.textAlign = 'right';
  g.fillText('LTE ▮▮▮▯ 🔋', PW - 40, 34);
  g.textAlign = 'left';
  // the home indicator
  g.fillStyle = 'rgba(255, 255, 255, 0.5)';
  g.beginPath(); g.roundRect(PW / 2 - 88, PH - 22, 176, 8, 4); g.fill();
  return c;
}

const SCREEN = { x: 16, y: 56, w: PW - 32, h: PH - 56 - 40, r: 38 };

// One screenful (the wallpaper and what is on it): view 'sms' or 'chat' with stage 'empty' | 'ask' | 'typing' | 'answer'
function phoneScreen(view, stage, sms, answer) {
  const [c, g] = canvas2d(SCREEN.w, SCREEN.h);
  g.beginPath();
  g.roundRect(0, 0, SCREEN.w, SCREEN.h, SCREEN.r);
  g.clip();
  const wall = g.createLinearGradient(0, 0, 0, SCREEN.h);
  wall.addColorStop(0, '#f4b23c');
  wall.addColorStop(0.55, '#d9662b');
  wall.addColorStop(1, '#7a2e1f');
  g.fillStyle = wall;
  g.fillRect(0, 0, SCREEN.w, SCREEN.h);
  const X = 22, IW = SCREEN.w - 44;
  g.textBaseline = 'alphabetic';
  // the head: back arrow, title (and the AI chip in the chat)
  const shadowText = (text, x, y) => {
    g.fillStyle = 'rgba(0, 0, 0, 0.35)';
    g.fillText(text, x, y + 2);
    g.fillStyle = '#ffffff';
    g.fillText(text, x, y);
  };
  g.font = `400 42px ${FONT}`;
  shadowText('‹', X, 58);
  g.font = `700 28px ${FONT}`;
  shadowText('Przewodnik', X + 36, 54);
  const bubble = (x, y, w, h, fill, tail) => {
    g.fillStyle = fill;
    g.beginPath();
    g.roundRect(x, y, w, h, tail === 'left' ? [22, 22, 22, 6] : tail === 'right' ? [22, 22, 6, 22] : 18);
    g.fill();
  };
  if (view === 'sms') {
    g.font = `500 17px ${FONT}`;
    g.fillStyle = 'rgba(255, 255, 255, 0.85)';
    g.fillText('SMS · dziś 12:40', X + 2, 98);
    g.font = `400 23px ${FONT}`;
    const lines = wrapText(g, sms, IW - 40);
    const lh = 33, h = lines.length * lh + 30;
    bubble(X, 112, IW, h, 'rgba(16, 17, 20, 0.82)', null);
    g.fillStyle = '#f6f5f2';
    lines.forEach((l, i) => g.fillText(l, X + 20, 112 + 40 + i * lh));
    // the "read more" card under it
    const y = 112 + h + 14;
    bubble(X, y, IW, 70, 'rgba(16, 17, 20, 0.82)', null);
    g.font = `700 20px ${FONT}`;
    g.fillStyle = TAXI.yellow;
    g.fillText('Czytaj więcej', X + 20, y + 30);
    g.font = `400 18px ${FONT}`;
    g.fillStyle = 'rgba(246, 245, 242, 0.68)';
    g.fillText('Kameduli to zakon pustelników: każdy…', X + 20, y + 56);
    return c;
  }
  // the chat
  g.font = `800 17px ${FONT}`;
  const chipW = g.measureText('AI').width + 22;
  g.fillStyle = 'rgba(16, 17, 20, 0.82)';
  g.beginPath(); g.roundRect(SCREEN.w - X - chipW, 30, chipW, 30, 12); g.fill();
  g.fillStyle = TAXI.yellow;
  g.fillText('AI', SCREEN.w - X - chipW + 11, 52);
  // the input at the bottom
  const inputY = SCREEN.h - 74;
  g.fillStyle = 'rgba(255, 255, 255, 0.94)';
  g.beginPath(); g.roundRect(X, inputY, IW - 112, 54, 16); g.fill();
  g.fillStyle = 'rgba(27, 28, 32, 0.45)';
  g.font = `400 21px ${FONT}`;
  g.fillText('Zapytaj o Bielany…', X + 16, inputY + 35);
  g.fillStyle = TAXI.yellow;
  g.beginPath(); g.roundRect(SCREEN.w - X - 100, inputY, 100, 54, 16); g.fill();
  g.fillStyle = TAXI.ink;
  g.font = `700 20px ${FONT}`;
  g.fillText('Wyślij', SCREEN.w - X - 82, inputY + 34);
  g.font = `500 17px ${FONT}`;
  g.fillStyle = 'rgba(255, 255, 255, 0.85)';
  g.fillText('Odpowiedzi tworzy sztuczna inteligencja', X + 2, 98);
  if (stage === 'empty') return c;
  let y = 120;
  // the question, on the right in taxi yellow
  g.font = `500 23px ${FONT}`;
  const q = 'Kto ufundował klasztor Kamedułów?';
  const qLines = wrapText(g, q, IW * 0.86 - 36);
  const qW = Math.max(...qLines.map((l) => g.measureText(l).width)) + 36;
  const qH = qLines.length * 32 + 24;
  bubble(SCREEN.w - X - qW, y, qW, qH, TAXI.yellow, 'right');
  g.fillStyle = TAXI.ink;
  qLines.forEach((l, i) => g.fillText(l, SCREEN.w - X - qW + 18, y + 36 + i * 32));
  y += qH + 12;
  if (stage === 'typing') {
    bubble(X, y, 110, 52, 'rgba(16, 17, 20, 0.82)', 'left');
    g.font = `italic 400 21px ${FONT}`;
    g.fillStyle = 'rgba(246, 245, 242, 0.68)';
    g.fillText('pisze…', X + 18, y + 34);
    return c;
  }
  if (stage !== 'answer') return c;
  // the answer, on the left; the sources in their own lines
  g.font = `400 21px ${FONT}`;
  const [body, sources] = answer;
  const aW = IW * 0.92;
  const aLines = wrapText(g, body, aW - 36);
  g.font = `400 18px ${FONT}`;
  const sLines = wrapText(g, sources, aW - 36);
  const lh = 29, slh = 25;
  const aH = aLines.length * lh + 14 + sLines.length * slh + 30;
  bubble(X, y, aW, aH, 'rgba(16, 17, 20, 0.82)', 'left');
  g.font = `400 21px ${FONT}`;
  g.fillStyle = '#f6f5f2';
  aLines.forEach((l, i) => g.fillText(l, X + 18, y + 36 + i * lh));
  const sy = y + 36 + aLines.length * lh + 12;
  g.font = `400 18px ${FONT}`;
  g.fillStyle = 'rgba(246, 245, 242, 0.75)';
  sLines.forEach((l, i) => {
    if (i === 0 && l.startsWith('Źródła:')) {
      g.font = `700 18px ${FONT}`;
      g.fillStyle = TAXI.yellow;
      g.fillText('Źródła:', X + 18, sy + i * slh);
      const w = g.measureText('Źródła: ').width;
      g.font = `400 18px ${FONT}`;
      g.fillStyle = 'rgba(246, 245, 242, 0.75)';
      g.fillText(l.slice(8), X + 18 + w, sy + i * slh);
    } else g.fillText(l, X + 18, sy + i * slh);
  });
  y += aH + 12;
  // Nawiguj (the answer names a landmark: js/phone.js chatNavigate)
  g.font = `700 19px ${FONT}`;
  const nav = 'Nawiguj: Klasztor Kamedułów';
  const nW = g.measureText(nav).width + 32;
  g.fillStyle = TAXI.yellow;
  g.beginPath(); g.roundRect(X, y, nW, 44, 12); g.fill();
  g.fillStyle = TAXI.ink;
  g.fillText(nav, X + 16, y + 29);
  return c;
}

// ---------------------------------------------------------------------------------------------------------------------
// A Warsaw street plate (Miejski System Informacji, as the HUD's .street-sign) on a pole, for the walk on Marymoncka
// ---------------------------------------------------------------------------------------------------------------------
function drawPlate(c, name) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = '#1d4fa0';
  g.beginPath(); g.roundRect(0, 0, c.width, c.height, 22); g.fill();
  g.fillStyle = '#d02a35';
  g.beginPath(); g.roundRect(0, c.height - 92, c.width, 92, [0, 0, 22, 22]); g.fill();
  g.fillStyle = '#ffffff';
  g.textBaseline = 'alphabetic';
  g.font = '500 54px "Overpass", "Inter", Arial, sans-serif';
  g.fillText('ulica', 48, 86);
  let size = 168;
  g.font = `600 ${size}px "Overpass", "Inter", Arial, sans-serif`;
  while (g.measureText(name).width > c.width - 96 && size > 60) { size -= 6; g.font = `600 ${size}px "Overpass", "Inter", Arial, sans-serif`; }
  g.fillText(name, 48, 250);
  g.font = '500 54px "Overpass", "Inter", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('Bielany', c.width / 2, c.height - 28);
  g.textAlign = 'left';
}

function createPlate() {
  const group = new THREE.Group();
  group.name = 'FilmStreetPlate';
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 400;
  drawPlate(c, 'Marymoncka');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const face = new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.55, metalness: 0.05 });
  const metal = new THREE.MeshStandardNodeMaterial({ color: 0x7d8186, roughness: 0.5, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 3.3, 12), metal);
  pole.position.y = 1.65;
  group.add(pole);
  const PLATE_W = 0.92, PLATE_H = PLATE_W * (400 / 1024);
  const back = new THREE.Mesh(new THREE.BoxGeometry(PLATE_W + 0.02, PLATE_H + 0.02, 0.025), metal);
  back.position.set(0, 3.0, 0);
  group.add(back);
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W, PLATE_H), face);
    m.position.set(0, 3.0, side * 0.0135);
    if (side < 0) m.rotation.y = Math.PI;
    group.add(m);
  }
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group, redraw: () => { drawPlate(c, 'Marymoncka'); tex.needsUpdate = true; } };
}

// ---------------------------------------------------------------------------------------------------------------------
// The director
// ---------------------------------------------------------------------------------------------------------------------
class Film {
  /**
   * renderer, scene, cameraSystem, controllerManager, trafficSystem, trams, dispatch, passenger, fire ({ firefighter }),
   * search (location.search)
   */
  constructor(o) {
    Object.assign(this, o);
    const q = new URLSearchParams(o.search || '');
    this.preview = q.get('film') === 'podglad';
    this.only = q.get('ujecie'); // one shot only (its id or number), for framing
    this.codec = MIMES[q.get('kodek')] ? q.get('kodek') : 'vp9';
    this.bitrate = Number(q.get('mbps')) > 0 ? Number(q.get('mbps')) * 1e6 : 40e6;
    this.camera = o.cameraSystem.camera;
    this.cm = o.controllerManager;
    this.running = false;
    this.index = -1;
    this.lastFrame = -Infinity;
    // the props, in the scene from the start (far under the ground) so the shader warm-up compiles them
    const sedan = BODY_SPECS.sedan;
    this.lawnCar = new THREE.Mesh(buildCarGeometry(sedan, true), createLoftedCarMaterial(sedan, 0x6e1f24));
    this.lawnCar.name = 'FilmLawnCar';
    this.lawnCar.castShadow = this.lawnCar.receiveShadow = true;
    this.lawnCar.position.set(0, -500, 0);
    this.plate = createPlate();
    this.plate.group.position.set(0, -500, 0);
    o.scene.add(this.lawnCar, this.plate.group);
  }

  /** In the animation loop before anything else: false = skip this display refresh (60 frames a second, steady) */
  frameDue(now) {
    if (now - this.lastFrame < 1000 / FPS - 4) return false;
    this.lastFrame = now;
    return true;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    const style = document.createElement('style');
    style.textContent = `body.film > :not(#canvas-container):not(.film-out):not(.film-status) { display: none !important; }
      body.film { background: #000; cursor: none; }
      .film-out { position: fixed; inset: 0; width: 100vw; height: 100vh; object-fit: contain; background: #000; z-index: 1000; }
      .film-status { position: fixed; left: 12px; top: 10px; z-index: 1001; font: 600 13px ${FONT}; color: #fff; background: rgba(0,0,0,.55); padding: 6px 10px; border-radius: 8px; }`;
    document.head.appendChild(style);
    document.body.classList.add('film');
    [this.out, this.ctx] = canvas2d(W, H);
    this.out.className = 'film-out';
    document.body.appendChild(this.out);
    this.status = document.createElement('div');
    this.status.className = 'film-status';
    document.body.appendChild(this.status);
    try { await Promise.all([`400 23px ${FONT}`, `700 28px ${FONT}`, `800 17px ${FONT}`, '600 168px "Overpass"', '500 54px "Overpass"'].map((f) => document.fonts.load(f))); } catch { /* the fallback fonts */ }
    this.plate.redraw();
    this.phoneBody = phoneBody();
    const kam = GUIDE_TEXTS.find((t) => t.id === 'guide-kameduli');
    // the guide's answer to this question in the check run of 2026-10-26 (docs/odpowiedzi-kontrolne-przewodnik.md, 1)
    const answer = ['Klasztor Kamedułów na Bielanach ufundował król Władysław IV. Pustelnię założono w 1639 r. jako królewskie wotum za zwycięstwo w wojnie smoleńskiej, a od białych habitów mnichów wzięła się nazwa Bielany.',
      'Źródła: Wikipedia, hasło „Rezerwat przyrody Las Bielański” oraz Wikipedia (EN), „Camaldolese Church, Warsaw”.'];
    this.screens = {
      sms: phoneScreen('sms', '', kam?.sms || '', answer),
      empty: phoneScreen('chat', 'empty', '', answer),
      ask: phoneScreen('chat', 'ask', '', answer),
      typing: phoneScreen('chat', 'typing', '', answer),
      answer: phoneScreen('chat', 'answer', '', answer),
    };
    this.shots = timeline(SHOTS.filter((s, i) => !this.only || s.id === this.only || String(i + 1) === this.only));
    this.recorded = [];
    this.intervals = [];
    this.shotIntervals = [];
    this.log = { date: new Date().toISOString(), shots: {} };
    if (!this.preview) this.makeRecorder();
    this.next();
  }

  makeRecorder() {
    this.stream = this.out.captureStream(FPS);
    let mime = MIMES[this.codec];
    if (!MediaRecorder.isTypeSupported(mime)) mime = Object.values(MIMES).find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
    this.mime = mime;
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime, videoBitsPerSecond: this.bitrate });
    this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
  }

  setStatus(text) {
    if (this.status) this.status.textContent = text;
  }

  // ---- the shots' building blocks ------------------------------------------------------------------------------

  show(which) {
    for (const [mode, e] of Object.entries(this.cm.entities)) {
      const on = which.includes(mode);
      e.mesh.visible = on;
      e.crowd?.meshes.forEach((m) => { m.visible = on; });
    }
  }

  setMode(mode) {
    this.cm.setMode(mode);
    for (const k of Object.keys(this.cm.keys)) this.cm.keys[k] = false;
  }

  cam(px, py, pz, tx, ty, tz, fov) {
    const c = this.camera;
    c.position.set(px, py, pz);
    c.lookAt(tx, ty, tz);
    if (c.fov !== fov) { c.fov = fov; c.updateProjectionMatrix(); }
    this.cameraSystem.currentPos.copy(c.position);
  }

  // The car on the street (after the controllers' update; the next update starts from here)
  placeCar(x, z, heading, speed, dt = 0) {
    const c = this.cm.entities.car;
    const turn = dt > 0 ? wrap(heading - c.heading) / dt : 0;
    c.position.x = x;
    c.position.z = z;
    c.position.y = this.cm.getGroundHeight(x, z, 'car', c.position.y);
    c.heading = heading;
    c.speed = speed;
    c.vx = c.vz = c.angularVel = 0;
    c.steerAngle = speed > 0.5 ? clamp(turn / (2.4 * Math.min(1, speed / 8)), -0.52, 0.52) : c.steerAngle * 0.9;
    c.mesh.position.copy(c.position);
    c.mesh.rotation.y = heading;
  }

  wear(livery) {
    const car = this.cm.entities.car;
    livery.attach(car);
    livery.setSiren(true, false); // the lights, not the sound
    this.dispatch.worn = livery;
  }

  cleanup() {
    const d = this.dispatch;
    for (const s of d.list) if (s.livery?.active) s.livery.detach();
    d.worn = null;
    if (this.fire) this.fire.firefighter.action = null;
    this.passenger.hide();
    this.lawnCar.position.set(0, -500, 0);
    this.plate.group.position.set(0, -500, 0);
    for (const k of Object.keys(this.cm.keys)) this.cm.keys[k] = false;
  }

  // ---- the shots ---------------------------------------------------------------------------------------------------

  setup(id) {
    const st = {};
    const cm = this.cm;
    if (id === 'helikopter') {
      // from over the Vistula side of the escarpment, past the church, towards Stare Bielany
      this.setMode('helicopter');
      this.show(['helicopter']);
      const dx = -KAMEDULY.x, dz = -KAMEDULY.z, l = Math.hypot(dx, dz);
      Object.assign(st, { fx: dx / l, fz: dz / l, y: groundY(KAMEDULY.x, KAMEDULY.z) + 62, speed: 18 });
      st.heading = Math.atan2(st.fx, st.fz);
    } else if (id === 'karetka') {
      this.setMode('car');
      this.show(['car']);
      const sor = ADDRESSES.find((a) => STREETS[a[0]] === 'Cegłowska' && a[1] === '80');
      const goal = sor ? { x: sor[4], z: sor[5] } : { x: 111.8, z: -529.9 };
      // the straightest approach of the last 170 m among routes from addresses 250-600 m away
      let best = null;
      for (let i = 0, tried = 0; i < ADDRESSES.length && tried < 160; i += 7) {
        const a = ADDRESSES[i];
        const d = Math.hypot(a[4] - goal.x, a[5] - goal.z);
        if (d < 250 || d > 600) continue;
        tried++;
        const r = findRoute(a[4], a[5], goal.x, goal.z, { oneWay: true });
        if (!r || r.length < 200) continue;
        const tail = routeTail(r.pts, 170);
        const score = turning(tail);
        if (!best || score < best.score) best = { score, tail, from: `${STREETS[a[0]]} ${a[1]}` };
      }
      st.rail = rail(best.tail, 1.9);
      st.profile = { sEnd: st.rail.length - 6, v: 13, tStop: 7.3, brake: 2.2 };
      this.log.shots.karetka = { from: best.from, turning: best.score, length: st.rail.length };
      this.wear(this.dispatch.byRole('medic').livery);
      const p = stopProfile(-this.shot.pre, st.profile);
      const at = railAt(st.rail, p.s);
      cm.teleportActiveTo(at.x, at.z, at.heading);
    } else if (id === 'straz-pozarna') {
      this.setMode('car');
      this.show(['car']);
      const ff = this.fire.firefighter;
      const saved = ff.random;
      let found = null;
      for (let seed = 1; seed < 60 && !found; seed++) {
        ff.random = seeded(seed);
        const o = ff.makeOffer(TELEPORT_LOCATIONS.stareBielany, 'fire');
        if (!o) continue;
        const f = o.incident.fire;
        const fr = streetFrame(f.x, f.z);
        if (f.y - groundY(f.x, f.z) < 5 || fr.s.d < 12 || fr.s.d > 26) continue;
        found = { o, f, fr, seed };
      }
      ff.random = saved;
      const { f, fr } = found;
      // the truck on the building's side of the street, along it
      st.truck = { x: fr.s.x + fr.nx * 2.2, z: fr.s.z + fr.nz * 2.2, heading: Math.atan2(fr.dx, fr.dz) };
      st.fire = f;
      st.fr = fr;
      this.log.shots.pozar = { seed: found.seed, where: found.o.from, fire: { x: f.x, y: f.y, z: f.z } };
      this.wear(this.dispatch.byRole('firefighter').livery);
      cm.teleportActiveTo(st.truck.x, st.truck.z, st.truck.heading);
      ff.action = { kind: 'fire', incident: found.o.incident, phase: 'work', progress: 0.3, running: false, spraying: true, done: false, hint: '' };
    } else if (id === 'straz-miejska') {
      this.setMode('car');
      this.show(['car']);
      // a lawn (a park block) 6-10 m from a street near Stare Bielany, clear of buildings
      const c0 = TELEPORT_LOCATIONS.stareBielany;
      let spot = null;
      for (let r = 40; r < 700 && !spot; r += 12) {
        for (let k = 0; k < 48 && !spot; k++) {
          const ang = (k / 48) * Math.PI * 2;
          const x = c0.x + Math.cos(ang) * r, z = c0.z + Math.sin(ang) * r;
          const b = blockAt(x, z);
          if (!b || !(b.park > 0.6) || b.median) continue;
          const fr = streetFrame(x, z);
          if (fr.s.d < 7 || fr.s.d > 10) continue;
          if (cm.nearColliders(x, z, 6).some((c) => x > c.minX - 3 && x < c.maxX + 3 && z > c.minZ - 3 && z < c.maxZ + 3)) continue;
          spot = { x, z, fr };
        }
      }
      const { fr } = spot;
      st.lawn = { x: spot.x, z: spot.z, heading: Math.atan2(fr.dx, fr.dz) + 0.5 };
      // the patrol car at the curb beside it
      st.car = { x: fr.s.x + fr.nx * 2.6 + fr.dx * 3, z: fr.s.z + fr.nz * 2.6 + fr.dz * 3, heading: Math.atan2(fr.dx, fr.dz) };
      st.fr = fr;
      this.log.shots.trawnik = { lawn: st.lawn, park: blockAt(spot.x, spot.z)?.parkName || '' };
      this.lawnCar.position.set(st.lawn.x, groundY(st.lawn.x, st.lawn.z) + 0.02, st.lawn.z);
      this.lawnCar.rotation.set(0, st.lawn.heading, 0);
      this.wear(this.dispatch.byRole('guard').livery);
      cm.teleportActiveTo(st.car.x, st.car.z, st.car.heading);
    } else if (id === 'taksowka') {
      this.setMode('car');
      this.show(['car']);
      const t0 = TELEPORT_LOCATIONS.stareBielany;
      const fx = Math.sin(t0.heading), fz = Math.cos(t0.heading);
      const r = findRoute(t0.x - fx * 110, t0.z - fz * 110, t0.x + fx * 30, t0.z + fz * 30, { oneWay: true });
      st.rail = rail(r.pts, 1.9);
      const sStop = Math.min(st.rail.length - 10, 100);
      st.profile = { sEnd: sStop, v: 9, tStop: 2.5, brake: 2.4 };
      const stop = railAt(st.rail, sStop);
      const rx = -Math.cos(stop.heading), rz = Math.sin(stop.heading); // to the right of the heading
      st.stop = stop;
      st.right = { x: rx, z: rz };
      // the passenger waves on the sidewalk by the stop, facing the street
      this.passenger.show(stop.x + rx * 4.2, stop.z + rz * 4.2, -rx, -rz);
      const p = stopProfile(-this.shot.pre, st.profile);
      const at = railAt(st.rail, p.s);
      cm.teleportActiveTo(at.x, at.z, at.heading);
    } else if (id === 'telefon') {
      this.setMode('person');
      this.show(['person']);
      // the player on Dewajtis, looking at the church
      const t = TELEPORT_LOCATIONS.kameduly;
      const h = Math.atan2(KAMEDULY.x - t.x, KAMEDULY.z - t.z);
      cm.teleportActiveTo(t.x + 40 * Math.sin(h), t.z + 40 * Math.cos(h), h);
      st.h = h;
    } else if (id === 'marymoncka') {
      this.setMode('person');
      this.show(['person']);
      const t = TELEPORT_LOCATIONS.awf;
      cm.teleportActiveTo(t.x, t.z, t.heading);
      const p = cm.entities.person.position;
      const fr = streetFrame(p.x, p.z);
      // walk along the street, in the teleport's sense
      const along = Math.sign(fr.dx * Math.sin(t.heading) + fr.dz * Math.cos(t.heading)) || 1;
      st.fx = fr.dx * along;
      st.fz = fr.dz * along;
      st.heading = Math.atan2(st.fx, st.fz);
      st.nx = fr.nx; st.nz = fr.nz; // from the street to the walker
      st.start = { x: p.x, z: p.z };
      st.look = { x: p.x, y: p.y + 1.3, z: p.z };
      cm.entities.person.heading = st.heading;
      // the plate on its pole at the curb, 15 m ahead, facing the walker
      const curb = fr.s.d - 1.0;
      const px = p.x + st.fx * 15 - st.nx * curb * 0.5, pz = p.z + st.fz * 15 - st.nz * curb * 0.5;
      this.plate.group.position.set(px, groundY(px, pz), pz);
      this.plate.group.rotation.set(0, Math.atan2(-st.fx, -st.fz), 0);
      st.plate = { x: px, z: pz };
      // a tram passes by on Marymoncka mid-shot
      st.tram = this.sendTram(p.x + st.fx * 10, p.z + st.fz * 10, 4.0 + this.shot.pre);
      this.log.shots.marymoncka = { start: st.start, plate: st.plate, tram: st.tram };
    }
    return st;
  }

  // Put a tram on the route nearest (x, z) so that it passes there `inS` s from now, with no stop on the way
  sendTram(x, z, inS) {
    const { routes, trams } = this.trams;
    const p = {};
    let best = null;
    routes.forEach((r, ri) => {
      for (let s = 0; s < r.length; s += 3) {
        tramAt(r, s, p);
        const d = Math.hypot(p.x - x, p.z - z);
        if (d > 40) continue;
        const half = (3 * (10.2 + 0.5)) / 2;
        const from = s + half - 11 * inS; // the tram's s (its rear end leads its centre by half a length)
        const stopOnWay = r.stops.some(([ss]) => ss > from && ss < s + half + 5);
        const score = d + (stopOnWay ? 100 : 0) + (from < 0 ? 200 : 0);
        if (!best || score < best.score) best = { score, ri, from: Math.max(0, from), d };
      }
    });
    if (!best) return null;
    const t = trams.find((o) => !o.visible) || trams[0];
    const r = routes[best.ri];
    Object.assign(t, { route: best.ri, s: best.from, speed: 11, wait: 0 });
    t.next = r.stops.findIndex(([ss]) => ss > t.s + 1);
    if (t.next < 0) t.next = r.stops.length;
    return { route: r.name, d: Math.round(best.d), stopOnWay: best.score >= 100 };
  }

  frame(id, st, t, dt) {
    const cm = this.cm;
    if (id === 'helikopter') {
      const h = cm.entities.helicopter;
      const d = 150 - st.speed * t; // m before the church
      h.position.set(KAMEDULY.x - st.fx * d, st.y, KAMEDULY.z - st.fz * d);
      h.heading = st.heading;
      h.speed = st.speed;
      h.mesh.position.copy(h.position);
      h.mesh.rotation.y = h.heading;
      // behind and to the right, drifting in towards the tail, looking ahead past the helicopter at the church
      const k = smooth(t / 6);
      const rx = -st.fz, rz = st.fx;
      const back = lerp(52, 40, k), side = lerp(30, 14, k), up = lerp(10, 16, k);
      this.cam(h.position.x - st.fx * back + rx * side, st.y + up, h.position.z - st.fz * back + rz * side,
        h.position.x + st.fx * 90, st.y - 34, h.position.z + st.fz * 90, 50);
    } else if (id === 'karetka') {
      const p = stopProfile(t, st.profile);
      const at = railAt(st.rail, p.s);
      this.placeCar(at.x, at.z, at.heading, p.speed, dt);
      // chasing it, lagging a little on the bends
      const fx = Math.sin(at.heading), fz = Math.cos(at.heading);
      const want = new THREE.Vector3(at.x - fx * 12.5, groundY(at.x, at.z) + 4.6, at.z - fz * 12.5);
      if (!st.camPos) st.camPos = want.clone();
      st.camPos.lerp(want, 1 - Math.exp(-dt * 3));
      this.cam(st.camPos.x, st.camPos.y, st.camPos.z, at.x + fx * 9, groundY(at.x, at.z) + 1.2, at.z + fz * 9, 54);
    } else if (id === 'straz-pozarna') {
      const tr = st.truck;
      this.placeCar(tr.x, tr.z, tr.heading, 0);
      const a = this.fire.firefighter.action;
      if (a) { a.spraying = true; a.progress = Math.min(0.55, a.progress + dt * 0.04); }
      // from the far side of the street, a slow sideways drift
      const f = st.fire, fr = st.fr;
      const k = t / 3.3;
      const cx = fr.s.x - fr.nx * 9 + fr.dx * lerp(-20, -15, k), cz = fr.s.z - fr.nz * 9 + fr.dz * lerp(-20, -15, k);
      this.cam(cx, groundY(cx, cz) + 2.2, cz, (tr.x + f.x) / 2, (groundY(tr.x, tr.z) + f.y) / 2 + 1, (tr.z + f.z) / 2, 56);
    } else if (id === 'straz-miejska') {
      const c = st.car;
      this.placeCar(c.x, c.z, c.heading, 0);
      // low, across the patrol car towards the car on the lawn, slowly round
      const l = st.lawn, fr = st.fr;
      const mx = (c.x + l.x) / 2, mz = (c.z + l.z) / 2;
      const ang = Math.atan2(-fr.nx, -fr.nz) + lerp(-0.75, -0.5, t / 3.3);
      const cx = mx + Math.sin(ang) * 13, cz = mz + Math.cos(ang) * 13;
      this.cam(cx, groundY(cx, cz) + 2.0, cz, mx, groundY(mx, mz) + 0.9, mz, 52);
    } else if (id === 'taksowka') {
      const p = stopProfile(t, st.profile);
      const at = railAt(st.rail, p.s);
      this.placeCar(at.x, at.z, at.heading, p.speed, dt);
      // from the sidewalk ahead of the stop, looking back along the curb at the cab and the waving passenger
      const s = st.stop, r = st.right, fx = Math.sin(s.heading), fz = Math.cos(s.heading);
      const cx = s.x + fx * 13 + r.x * 6.5, cz = s.z + fz * 13 + r.z * 6.5;
      const k = smooth(t / 3.4);
      this.cam(cx, groundY(cx, cz) + 1.7, cz, lerp(at.x, s.x + r.x * 2, k), groundY(s.x, s.z) + 1.0, lerp(at.z, s.z + r.z * 2, k), 50);
    } else if (id === 'telefon') {
      // a slow push towards the church; the phone comes up on the right (drawn in afterRender)
      const p = cm.entities.person.position, h = st.h, k = smooth((t + 3) / 11);
      const fx = Math.sin(h), fz = Math.cos(h), rx = -fz, rz = fx;
      const cx = p.x - fx * lerp(9, 6.5, k) + rx * 3.2, cz = p.z - fz * lerp(9, 6.5, k) + rz * 3.2;
      this.cam(cx, p.y + 2.2, cz, KAMEDULY.x - rx * 25, groundY(KAMEDULY.x, KAMEDULY.z) + 11, KAMEDULY.z - rz * 25, 50);
    } else if (id === 'marymoncka') {
      const e = cm.entities.person;
      // walking from just before the recording on, straight along the sidewalk
      const keys = cm.keys;
      keys.forward = t > -0.8 ? 0.42 : false;
      const err = wrap(st.heading - e.heading);
      keys.left = err > 0.01 ? Math.min(1, err * 4) : false;
      keys.right = err < -0.01 ? Math.min(1, -err * 4) : false;
      const p = e.position;
      // behind and a little to the building side, a smooth follow
      const k = 1 - Math.exp(-dt * 5);
      st.look.x = lerp(st.look.x, p.x, k);
      st.look.y = lerp(st.look.y, p.y + 1.3, k);
      st.look.z = lerp(st.look.z, p.z, k);
      const L = st.look;
      this.cam(L.x - st.fx * 4.6 + st.nx * 1.4, L.y + 0.55, L.z - st.fz * 4.6 + st.nz * 1.4,
        L.x + st.fx * 7 - st.nx * 0.8, L.y + 0.1, L.z + st.fz * 7 - st.nz * 0.8, 56);
    }
  }

  // ---- the run -----------------------------------------------------------------------------------------------------

  next() {
    this.cleanup();
    this.index++;
    if (this.index >= this.shots.length) { this.finish(); return; }
    const shot = this.shots[this.index];
    this.shot = shot;
    this.state = this.setup(shot.id);
    this.t = -shot.pre;
    this.phase = 'pre';
    this.stills = this.preview ? [0.1, shot.dur / 2, shot.dur - 0.1] : [];
    this.setStatus(`Film: ujęcie ${this.index + 1}/${this.shots.length} (${shot.id}), ustawianie…`);
  }

  /** Each frame after the controllers' update, instead of the camera system's */
  update(dt) {
    if (!this.running || !this.shot) return;
    this.t += dt;
    this.frame(this.shot.id, this.state, this.t, dt);
  }

  /** Each frame after the render: into the recorded canvas, the phone over it; the recorder on and off */
  afterRender(now) {
    if (!this.running || !this.out) return;
    const g = this.ctx;
    g.drawImage(this.renderer.domElement, 0, 0, W, H);
    if (this.shot?.id === 'telefon') this.drawPhone(g, this.t);
    if (!this.shot) return;
    const shot = this.shot;
    if (this.phase === 'pre' && this.t >= -0.5 / FPS) {
      this.phase = 'rec';
      this.recStart = now;
      this.prevNow = null;
      this.shotIntervals.push([]);
      if (this.recorder) {
        if (this.recorder.state === 'inactive') this.recorder.start(1000);
        else if (this.recorder.state === 'paused') this.recorder.resume();
      }
      this.setStatus(`Film: ujęcie ${this.index + 1}/${this.shots.length} (${shot.id}), ${this.preview ? 'podgląd' : 'nagrywanie'}`);
    }
    if (this.phase !== 'rec') return;
    if (this.prevNow !== null) {
      const d = now - this.prevNow;
      this.intervals.push(d);
      this.shotIntervals.at(-1).push(d);
    }
    this.prevNow = now;
    if (this.stills.length && this.t >= this.stills[0]) {
      const at = this.stills.shift();
      const name = `podglad/${String(this.index + 1).padStart(2, '0')}-${shot.id}-${at.toFixed(1)}.jpg`;
      this.out.toBlob((b) => this.save(name, b, 'image/jpeg'), 'image/jpeg', 0.85);
    }
    if (this.t >= shot.dur) {
      const prev = this.recorded.at(-1);
      const start = prev ? prev.end : 0;
      const length = this.shotIntervals.at(-1).reduce((a, b) => a + b, 0) / 1000 + 1 / FPS;
      this.recorded.push({ start, end: start + length });
      if (this.recorder?.state === 'recording') this.recorder.pause();
      this.next();
    }
  }

  drawPhone(g, t) {
    const P = PHONE;
    if (t < P.slideIn) return;
    const k = 1 - (1 - smooth((t - P.slideIn) / P.slideDur)) ** 2;
    const x = W - PW - 190, y = lerp(H + 40, (H - PH) / 2, k);
    g.drawImage(this.phoneBody, x - PAD, y - PAD);
    const sx = x + SCREEN.x, sy = y + SCREEN.y;
    const s = this.screens;
    const chat = t < P.askAt ? s.empty : t < P.typingAt ? s.ask : t < P.answerAt ? s.typing : s.answer;
    if (t < P.chatAt) g.drawImage(s.sms, sx, sy);
    else {
      // the chat slides in from the right over the SMS, the conversation's steps cross-fade
      const kc = smooth((t - P.chatAt) / P.chatDur);
      g.save();
      g.beginPath(); g.roundRect(sx, sy, SCREEN.w, SCREEN.h, SCREEN.r); g.clip();
      g.drawImage(s.sms, sx - SCREEN.w * 0.25 * kc, sy);
      const prev = t < P.askAt ? s.empty : t < P.typingAt ? s.empty : t < P.answerAt ? s.ask : s.typing;
      const step = t < P.askAt ? 1 : smooth((t - (t < P.typingAt ? P.askAt : t < P.answerAt ? P.typingAt : P.answerAt)) / 0.22);
      const cx = sx + SCREEN.w * (1 - kc);
      g.drawImage(prev, cx, sy);
      g.globalAlpha = step;
      g.drawImage(chat, cx, sy);
      g.globalAlpha = 1;
      g.restore();
    }
  }

  save(name, body, type) {
    return fetch(`/__film/${name}`, { method: 'PUT', headers: { 'Content-Type': type }, body })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })
      .catch((e) => console.error(`[film] ${name} nie zapisany:`, e));
  }

  finish() {
    this.shot = null;
    const stats = frameStats(this.intervals, FPS);
    const perShot = this.shotIntervals.map((iv) => frameStats(iv, FPS));
    const md = shotList({
      shots: this.shots, recorded: this.recorded, stats, perShot,
      settings: { date: new Date().toLocaleDateString('pl-PL'), mime: this.mime || 'podgląd', bitrate: this.bitrate, width: W, height: H, fps: FPS },
    });
    const report = { ...this.log, stats, perShot, recorded: this.recorded, mime: this.mime, bitrate: this.bitrate, ua: navigator.userAgent };
    console.info('[film]', report);
    const done = async () => {
      if (this.recorder) {
        this.setStatus('Film: zapisywanie…');
        const blob = new Blob(this.chunks, { type: this.mime });
        await this.save('film-surowy.webm', blob, 'video/webm');
        await this.save('film-ujecia.md', md, 'text/markdown');
      }
      await this.save(this.preview ? 'podglad/raport.json' : 'film-raport.json', JSON.stringify(report, null, 2), 'application/json');
      this.setStatus(`Film: gotowe (${stats.fps} kl./s, spóźnione klatki: ${stats.late}). Pliki w docs/media/.`);
    };
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = done;
      this.recorder.stop();
    } else done();
  }
}

export { Film, rail, railAt };
