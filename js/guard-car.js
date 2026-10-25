// js/guard-car.js
// The city guard's patrol car: during a guard call the player's car (the white taxi sedan) gets a navy-and-yellow checkered band with
// "STRAŻ MIEJSKA" in plain lettering on the doors, a roof light bar and the same word on the boot. No coat of
// arms, eagle, star, badge or unit number (docs/plan-fazy-3.md, decision 3). The light bar flashes blue only on a call
// (setSiren(true)); the body, wheels and physics stay the car's (js/controllers.js is not touched). Same interface as
// js/ambulance.js: attach, detach, setSiren, update.

import * as THREE from 'three/webgpu';
import { BODY_SPECS, buildCarSidePatch } from './actor-models.js';

const NAVY = '#14264f', BLUE = '#1f4fa8';

// Doors after the Polish rule for city-guard cars (a navy-and-yellow checkered band over the words, silver-white body)
function doorTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e4e7ea';
  g.fillRect(0, 0, 512, 128);
  const sq = 16;
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 512 / sq; i++) {
      g.fillStyle = (i + row) % 2 ? '#f2c200' : NAVY;
      g.fillRect(i * sq, 8 + row * sq, sq, sq);
    }
  }
  g.fillStyle = NAVY;
  g.font = '800 58px "Inter", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('STRAŻ MIEJSKA', 256, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function lettering(text, w, h) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = NAVY;
  g.font = '800 64px "Inter", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardNodeMaterial({ map: t, transparent: true, alphaTest: 0.4, roughness: 0.5 }));
}

function createPatrolCar() {
  const spec = BODY_SPECS.taxi;
  const group = new THREE.Group();
  group.name = 'GuardLivery';
  const doorMat = new THREE.MeshStandardNodeMaterial({ map: doorTexture(), roughness: 0.3, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const mid = (spec.doors[0] + spec.doors[1]) / 2;
  for (const side of [-1, 1]) group.add(new THREE.Mesh(buildCarSidePatch(spec, side, mid - 0.7, mid + 0.7, 0.45, 0.85, 0.004), doorMat));
  // roof light bar: a dark base and two lamps (blue lit when flashing)
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.26), new THREE.MeshStandardNodeMaterial({ color: 0x1b1f24, roughness: 0.6 }));
  base.position.set(0, 1.5, -0.45);
  group.add(base);
  const on = new THREE.MeshBasicNodeMaterial({ color: 0x2a6bff });
  const off = new THREE.MeshBasicNodeMaterial({ color: 0x0b1a40 });
  const lamps = [-0.25, 0.25].map((x) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.24), off);
    m.position.set(x * 1.0, 1.58, -0.45);
    group.add(m);
    return m;
  });
  const back = lettering('STRAŻ MIEJSKA', 1.1, 0.2);
  back.position.set(0, 0.95, spec.zRear - 0.02);
  back.rotation.y = Math.PI;
  group.add(back);
  group.visible = false;

  let attachedTo = null, hidden = [], flashing = false;
  const audio = { ctx: null, gain: null, osc: null };
  const startTone = () => {
    try {
      if (!audio.ctx) {
        audio.ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
        audio.gain = audio.ctx.createGain();
        audio.gain.gain.value = 0;
        audio.osc = audio.ctx.createOscillator();
        audio.osc.type = 'triangle';
        audio.osc.frequency.value = 700;
        audio.osc.connect(audio.gain).connect(audio.ctx.destination);
        audio.osc.start();
      }
      audio.ctx.resume?.();
      audio.gain.gain.setTargetAtTime(0.03, audio.ctx.currentTime, 0.05);
    } catch { /* no audio: the lights still flash */ }
  };
  const stopTone = () => { if (audio.gain) audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05); };

  return {
    group,
    get active() { return !!attachedTo; },
    get siren() { return flashing; },
    attach(carEntity) {
      if (attachedTo) return;
      attachedTo = carEntity;
      // hide the taxi's own door decals (the patches with polygon offset); the body, plates and wheels stay
      hidden = carEntity.chassisPivot.children.filter((o) => o.isMesh && o.visible && o.material?.polygonOffset);
      for (const o of hidden) o.visible = false;
      carEntity.chassisPivot.add(group);
      group.visible = true;
      carEntity.savedLabel = carEntity.label;
      carEntity.label = 'Radiowóz Straży Miejskiej';
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
      flashing = onOff;
      if (onOff && audible) startTone(); else stopTone();
      if (!onOff) for (const l of lamps) l.material = off;
    },
    update(elapsed) {
      if (!flashing) return;
      const phase = Math.floor(elapsed * 5) % 2;
      lamps.forEach((l, i) => { l.material = (i + phase) % 2 ? on : off; });
      if (audio.osc) audio.osc.frequency.setTargetAtTime(Math.floor(elapsed / 0.6) % 2 ? 880 : 620, audio.ctx.currentTime, 0.02);
    },
  };
}

export { createPatrolCar };
