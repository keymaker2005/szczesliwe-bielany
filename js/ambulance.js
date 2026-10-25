// js/ambulance.js
// The ambulance: during a paramedic call the player's car is re-bodied as a box van — white, a band of the generic
// yellow and green high-visibility checks along the sides, "AMBULANS" on the front (mirrored) and back, blue light
// bars flashing on the roof — with a two-tone siren (WebAudio). No service's logo or insignia. The taxi body comes back
// at the end. The car's chassis, wheels and physics stay as they are (js/controllers.js is not touched).

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

function lettering(text, w, h, mirrored) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  if (mirrored) { g.translate(512, 0); g.scale(-1, 1); }
  g.fillStyle = '#1a6fd1';
  g.font = '800 70px "Inter", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardNodeMaterial({ map: t, transparent: true, alphaTest: 0.4, roughness: 0.5 }));
}

// The van body round the car's own frame: +z forward, y up from the ground
function vanGeometry() {
  const parts = [];
  const white = 0xf4f4f0, dark = 0x1d2228, grey = 0x55595e;
  parts.push(coloredBox(2.05, 2.1, 4.1, 0, 1.45, -0.75, white)); // the patient box
  parts.push(coloredBox(2.0, 1.25, 1.5, 0, 1.0, 2.05, white)); // the bonnet & cab front
  parts.push(coloredBox(1.96, 0.75, 1.0, 0, 1.95, 1.45, dark)); // windscreen
  for (const s of [-1, 1]) parts.push(coloredBox(0.02, 0.6, 0.9, s * 1.03, 1.9, 1.45, dark)); // cab side windows
  parts.push(coloredBox(2.08, 0.18, 5.7, 0, 0.46, 0, grey)); // sills & bumpers
  parts.push(coloredBox(1.7, 0.08, 0.6, 0, 2.55, 1.0, grey)); // light bar base
  // the side band of yellow and green checks, two rows
  const n = 12, L = 5.5;
  for (let k = 0; k < n; k++) {
    for (const row of [0, 1]) {
      const hex = (k + row) % 2 ? 0xd6e800 : 0x1f8a3a;
      for (const s of [-1, 1]) parts.push(coloredBox(0.02, 0.28, L / n, s * 1.04, 1.0 + row * 0.28, -2.75 + (k + 0.5) * (L / n), hex));
    }
  }
  return mergeGeometries(parts, false);
}

function createAmbulance() {
  const group = new THREE.Group();
  group.name = 'AmbulanceBody';
  const body = new THREE.Mesh(vanGeometry(), new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 }));
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const front = lettering('AMBULANS', 1.6, 0.3, true);
  front.position.set(0, 1.3, 2.81);
  const back = lettering('AMBULANS', 1.6, 0.3, false);
  back.position.set(0, 2.2, -2.81);
  back.rotation.y = Math.PI;
  group.add(front, back);
  // blue flashing lights: front bar (two) and the rear corners
  const on = new THREE.MeshBasicNodeMaterial({ color: 0x2a6bff });
  const off = new THREE.MeshBasicNodeMaterial({ color: 0x0b1a40 });
  const lamps = [];
  for (const [x, y, z] of [[-0.55, 2.66, 1.0], [0.55, 2.66, 1.0], [-0.9, 2.55, -2.75], [0.9, 2.55, -2.75]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.22), off);
    m.position.set(x, y, z);
    group.add(m);
    lamps.push(m);
  }
  group.visible = false;

  let attachedTo = null, hidden = [], siren = null;
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
      for (const o of hidden) o.visible = false;
      carEntity.chassisPivot.add(group);
      group.visible = true;
      carEntity.savedLabel = carEntity.label;
      carEntity.label = 'Karetka';
    },
    detach() {
      if (!attachedTo) return;
      for (const o of hidden) o.visible = true;
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
      if (!siren) return;
      const phase = Math.floor(elapsed * 6) % 2;
      lamps.forEach((l, i) => { l.material = (i + phase) % 2 ? on : off; });
      if (audio.osc) audio.osc.frequency.setTargetAtTime(Math.floor(elapsed / 0.55) % 2 ? 940 : 650, audio.ctx.currentTime, 0.02);
    },
  };
}

export { createAmbulance };
