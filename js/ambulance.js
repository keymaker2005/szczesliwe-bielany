// js/ambulance.js
// The ambulance: during a paramedic call the player's car is re-bodied as a box van — white, a band of the generic
// yellow and green high-visibility checks along the sides, "AMBULANS" on the front (mirrored) and back, blue light
// bars flashing on the roof — with a two-tone siren (WebAudio). No service's logo or insignia. The taxi body comes back
// at the end. The car's chassis, wheels and physics stay as they are (js/controllers.js is not touched).

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function coloredBox(w, h, d, x, y, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.translate(x, y, z);
  const c = new THREE.Color(hex).convertSRGBToLinear();
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

function lettering(text, w, h, mirrored, color = '#c8202e') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  if (mirrored) { g.translate(512, 0); g.scale(-1, 1); }
  g.fillStyle = color;
  g.font = '800 70px "Inter", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardNodeMaterial({ map: t, transparent: true, alphaTest: 0.4, roughness: 0.5 }));
}

// The van (after a photograph of a Warsaw ambulance, Commons "Ambulance in Poland 02"): a high-roof box van, white,
// a red band low down, a blue one at the waist and a red one under the roof line, frosted patient windows, a sliding
// side door, twin rear doors with windows, a blue LED bar on the cab roof and blue lamps at the rear corners.
// Frame of the car: +z forward, y up from the ground
const WHITE = 0xf3f3ef, RED = 0xc8202e, BLUE = 0x1f4fa8, DARK = 0x1b1f24, GREY = 0x4a4e54, FROST = 0xd9dde0, CHROME = 0xb8bcc0;
function vanGeometry() {
  const parts = [];
  const rbox = (w, h, d, x, y, z, hex, r = 0.12) => {
    const g = new RoundedBoxGeometry(w, h, d, 3, r).toNonIndexed();
    g.translate(x, y, z);
    const c = new THREE.Color(hex).convertSRGBToLinear();
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    parts.push(g);
  };
  const box = (...a) => parts.push(coloredBox(...a));
  const W = 2.05, zR = -2.95, zF = 2.95;
  // body: the high box back to the rear, the cab with its sloped bonnet in front
  rbox(W, 2.15, 4.4, 0, 1.55, -0.75, WHITE, 0.16); // patient box, roof at 2.62
  rbox(W - 0.04, 1.75, 1.25, 0, 1.35, 1.95, WHITE, 0.18); // cab
  rbox(W - 0.08, 0.85, 0.95, 0, 0.88, 2.48, WHITE, 0.2); // bonnet
  // the bonnet's slope up to the windscreen
  const slope = new THREE.BoxGeometry(W - 0.1, 0.08, 0.9).toNonIndexed();
  slope.rotateX(-0.45);
  slope.translate(0, 1.45, 2.3);
  { const c = new THREE.Color(WHITE).convertSRGBToLinear(); const col = new Float32Array(slope.attributes.position.count * 3); for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i); slope.setAttribute('color', new THREE.BufferAttribute(col, 3)); slope.deleteAttribute('uv'); parts.push(slope); }
  // glass: windscreen, cab side windows, the frosted patient windows, rear door windows
  const wind = new THREE.BoxGeometry(W - 0.22, 0.82, 0.05).toNonIndexed();
  wind.rotateX(-0.32);
  wind.translate(0, 1.88, 2.6);
  { const c = new THREE.Color(DARK).convertSRGBToLinear(); const col = new Float32Array(wind.attributes.position.count * 3); for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i); wind.setAttribute('color', new THREE.BufferAttribute(col, 3)); wind.deleteAttribute('uv'); parts.push(wind); }
  for (const sd of [-1, 1]) {
    box(0.02, 0.62, 0.85, sd * (W / 2 + 0.005), 1.85, 1.95, DARK); // cab doors' windows
    box(0.02, 0.62, 1.05, sd * (W / 2 + 0.01), 1.85, 0.25, FROST); // the sliding door's frosted window
    box(0.02, 0.55, 0.9, sd * (W / 2 + 0.01), 1.88, -1.5, FROST); // the rear side window
    box(0.025, 1.85, 0.02, sd * (W / 2 + 0.012), 1.4, -0.35, GREY); // the sliding door's gaps
    box(0.025, 1.85, 0.02, sd * (W / 2 + 0.012), 1.4, 0.85, GREY);
    // the bands: red low, blue at the waist, red under the roof line (behind the cab)
    box(0.02, 0.3, 5.75, sd * (W / 2 + 0.008), 0.72, 0, RED);
    box(0.02, 0.32, 5.75, sd * (W / 2 + 0.008), 1.18, 0, BLUE);
    box(0.02, 0.3, 4.3, sd * (W / 2 + 0.008), 2.35, -0.8, RED);
    box(0.08, 0.2, 0.28, sd * (W / 2 + 0.12), 1.85, 2.45, DARK); // mirrors
    box(0.04, 0.5, 0.04, sd * (W / 2 + 0.06), 1.72, 2.47, GREY);
    box(0.02, 0.12, 0.3, sd * (W / 2 + 0.01), 1.55, -2.6, 0x2a6bff); // side flashers (lit by the lamps' colour pass)
  }
  // rear: twin doors with windows, the bands round the back, bumper
  box(W - 0.1, 1.95, 0.03, 0, 1.45, zR + 0.03, WHITE);
  box(0.02, 1.95, 0.04, 0, 1.45, zR + 0.01, GREY);
  for (const sd of [-1, 1]) box(0.7, 0.7, 0.03, sd * 0.47, 1.9, zR + 0.01, DARK);
  box(W - 0.1, 0.3, 0.03, 0, 0.72, zR + 0.005, RED);
  box(W - 0.1, 0.32, 0.03, 0, 1.18, zR + 0.005, BLUE);
  box(W - 0.1, 0.26, 0.03, 0, 2.42, zR + 0.005, RED);
  box(W + 0.04, 0.22, 0.22, 0, 0.42, zR - 0.02, GREY); // rear bumper & step
  // front: grille, bumper, headlights, the blue bar's housing
  box(W - 0.3, 0.32, 0.04, 0, 0.82, zF - 0.01, DARK);
  box(W + 0.02, 0.26, 0.22, 0, 0.42, zF - 0.1, GREY);
  for (const sd of [-1, 1]) box(0.42, 0.18, 0.04, sd * 0.72, 1.08, zF - 0.03, CHROME);
  box(1.5, 0.1, 0.32, 0, 2.27, 1.55, GREY);
  return mergeGeometries(parts, false);
}

// A van wheel in the frame of a car's wheel pivot (axle along x): tyre and a silver hub
function wheelGeometry() {
  const tyre = new THREE.CylinderGeometry(0.37, 0.37, 0.24, 20).toNonIndexed();
  tyre.rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.2, 0.2, 0.25, 14).toNonIndexed();
  hub.rotateZ(Math.PI / 2);
  for (const [g, hex] of [[tyre, 0x1b1c1e], [hub, CHROME]]) {
    const c = new THREE.Color(hex).convertSRGBToLinear();
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
  }
  return mergeGeometries([tyre, hub], false);
}

function createAmbulance() {
  const group = new THREE.Group();
  group.name = 'AmbulanceBody';
  const body = new THREE.Mesh(vanGeometry(), new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 }));
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const front = lettering('AMBULANS', 1.4, 0.26, true);
  front.position.set(0, 1.08, 2.97);
  const back = lettering('AMBULANS', 1.5, 0.28, false, '#ffffff');
  back.position.set(0, 2.42, -2.97);
  back.rotation.y = Math.PI;
  group.add(front, back);
  for (const sd of [-1, 1]) {
    const side = lettering('POGOTOWIE RATUNKOWE', 1.9, 0.22, false, '#1f4fa8');
    side.position.set(sd * 1.04, 1.62, -1.2);
    side.rotation.y = sd * Math.PI / 2;
    group.add(side);
  }
  // blue flashing lights: front bar (two) and the rear corners
  const on = new THREE.MeshBasicNodeMaterial({ color: 0x2a6bff });
  const off = new THREE.MeshBasicNodeMaterial({ color: 0x0b1a40 });
  const lamps = [];
  for (const [x, y, z, w] of [[-0.45, 2.38, 1.55, 0.55], [0.45, 2.38, 1.55, 0.55], [-0.82, 2.68, -2.85, 0.3], [0.82, 2.68, -2.85, 0.3]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, 0.26), off);
    m.position.set(x, y, z);
    group.add(m);
    lamps.push(m);
  }
  group.visible = false;

  const wheelGeo = wheelGeometry();
  const wheelMat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.7 });
  const vanWheels = [];
  let attachedTo = null, hidden = [], siren = null, pivots = [];
  const audio = { ctx: null, gain: null, osc: null };

  function startSiren() {
    try {
      if (!audio.ctx) {
        audio.ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
        audio.gain = audio.ctx.createGain();
        audio.gain.gain.value = 0;
        const filter = audio.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2200;
        audio.osc = audio.ctx.createOscillator();
        audio.osc.type = 'sawtooth';
        audio.osc.frequency.value = 650;
        audio.osc.connect(filter).connect(audio.gain).connect(audio.ctx.destination);
        audio.osc.start();
      }
      audio.ctx.resume?.();
      audio.gain.gain.setTargetAtTime(0.045, audio.ctx.currentTime, 0.05);
    } catch { /* no audio: the lights still flash */ }
  }
  function stopSiren() {
    if (audio.gain) audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
  }

  return {
    group,
    get active() { return !!attachedTo; },
    get siren() { return !!siren; },
    // put the van body on the car (its chassis pivot), hiding the taxi's own meshes
    attach(carEntity) {
      if (attachedTo) return;
      attachedTo = carEntity;
      hidden = carEntity.chassisPivot.children.filter((o) => o.isMesh && o.visible);
      for (const w of carEntity.wheels || []) hidden.push(w.tire);
      for (const o of hidden) o.visible = false;
      // van wheels on the car's own pivots (they steer and spin), set out to the van's wheelbase
      pivots = (carEntity.wheels || []).map((w) => ({ p: w.steerPivot, z: w.steerPivot.position.z, x: w.steerPivot.position.x, y: w.steerPivot.position.y }));
      for (const [k, { p }] of pivots.entries()) {
        const m = new THREE.Mesh(wheelGeo, wheelMat);
        m.castShadow = true;
        m.userData.tire = carEntity.wheels[k].tire; // spins with it (js/controllers.js turns the tyre)
        p.add(m);
        vanWheels.push(m);
        p.position.set(Math.sign(p.position.x) * 0.9, 0.37, Math.sign(p.position.z) * 1.75);
      }
      carEntity.chassisPivot.add(group);
      group.visible = true;
      carEntity.savedLabel = carEntity.label;
      carEntity.label = 'Karetka';
    },
    detach() {
      if (!attachedTo) return;
      for (const o of hidden) o.visible = true;
      for (const m of vanWheels) m.parent?.remove(m);
      vanWheels.length = 0;
      for (const { p, x, y, z } of pivots) p.position.set(x, y, z);
      attachedTo.chassisPivot.remove(group);
      attachedTo.label = attachedTo.savedLabel || attachedTo.label;
      attachedTo = null;
      group.visible = false;
      this.setSiren(false);
    },
    setSiren(onOff, audible = true) {
      siren = onOff;
      if (onOff && audible) startSiren(); else stopSiren();
      if (!onOff) for (const l of lamps) l.material = off;
    },
    update(elapsed) {
      for (const m of vanWheels) m.rotation.x = m.userData.tire.rotation.x;
      if (!siren) return;
      const phase = Math.floor(elapsed * 6) % 2;
      lamps.forEach((l, i) => { l.material = (i + phase) % 2 ? on : off; });
      if (audio.osc) audio.osc.frequency.setTargetAtTime(Math.floor(elapsed / 0.55) % 2 ? 940 : 650, audio.ctx.currentTime, 0.02);
    },
  };
}

export { createAmbulance };
