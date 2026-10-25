// js/patrol-car.js
// The patrol car: during a police call the player's car is re-bodied as a silver saloon with a blue band along the
// sides, "POLICJA" in a plain typeface on the band and on the boot, and a blue light bar on the roof — with a
// wailing siren (WebAudio). No crest, eagle, star, badge or unit number (docs/plan-fazy-3.md, decision 3). The taxi
// body comes back at the end. The car's chassis, wheels and physics stay as they are (js/controllers.js is not
// touched); the pattern is js/ambulance.js.

import * as THREE from 'three/webgpu';
import { BODY_SPECS, buildCarGeometry, buildCarSidePatch, createLoftedCarMaterial } from './actor-models.js';

const SILVER = 0xc9ced4, BLUE = '#1f3f94';
const SPEC = BODY_SPECS.sedan; // the taxi without its roof sign: the same wheels

// The side band: blue, a thin white line over it, "POLICJA" in white
function bandTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = BLUE;
  g.fillRect(0, 22, 1024, 84);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 14, 1024, 6);
  g.font = '700 62px "Inter", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('POLICJA', 430, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function lettering(text, w, h) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = BLUE;
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#ffffff';
  g.font = '700 66px "Inter", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardNodeMaterial({ map: t, roughness: 0.5 }));
}

function createPatrolCar() {
  const group = new THREE.Group();
  group.name = 'PatrolCarBody';
  const mat = createLoftedCarMaterial(SPEC, SILVER);
  const body = new THREE.Mesh(buildCarGeometry(SPEC, false), mat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const bandMat = new THREE.MeshStandardNodeMaterial({
    map: bandTexture(), transparent: true, alphaTest: 0.4, roughness: 0.4,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  for (const side of [-1, 1]) group.add(new THREE.Mesh(buildCarSidePatch(SPEC, side, -1.95, 1.95, 0.42, 0.66, 0.004, 24, 4), bandMat));
  const back = lettering('POLICJA', 0.62, 0.12);
  back.position.set(0, 0.62, SPEC.zRear - 0.015);
  back.rotation.y = Math.PI;
  group.add(back);
  // the light bar across the roof: a dark base, two blue lenses
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.26), new THREE.MeshStandardNodeMaterial({ color: 0x15181b, roughness: 0.5 }));
  bar.position.set(0, 1.49, -0.32);
  group.add(bar);
  const on = new THREE.MeshBasicNodeMaterial({ color: 0x2a6bff });
  const off = new THREE.MeshBasicNodeMaterial({ color: 0x0b1a40 });
  const lamps = [];
  for (const x of [-0.27, 0.27]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.22), off);
    m.position.set(x, 1.56, -0.32);
    group.add(m);
    lamps.push(m);
  }
  group.visible = false;

  let attachedTo = null, hidden = [], siren = false;
  const audio = { ctx: null, gain: null, osc: null };

  function startSiren() {
    try {
      if (!audio.ctx) {
        audio.ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
        audio.gain = audio.ctx.createGain();
        audio.gain.gain.value = 0;
        const filter = audio.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2400;
        audio.osc = audio.ctx.createOscillator();
        audio.osc.type = 'sawtooth';
        audio.osc.frequency.value = 600;
        audio.osc.connect(filter).connect(audio.gain).connect(audio.ctx.destination);
        audio.osc.start();
      }
      audio.ctx.resume?.();
      audio.gain.gain.setTargetAtTime(0.04, audio.ctx.currentTime, 0.05);
    } catch { /* no audio: the lights still flash */ }
  }
  function stopSiren() {
    if (audio.gain) audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
  }

  return {
    group,
    get active() { return !!attachedTo; },
    get siren() { return !!siren; },
    // put the patrol body on the car (its chassis pivot), hiding the taxi's body, decals and plates; the wheels stay
    attach(carEntity) {
      if (attachedTo) return;
      attachedTo = carEntity;
      hidden = carEntity.chassisPivot.children.filter((o) => o.isMesh && o.visible);
      for (const o of hidden) o.visible = false;
      carEntity.chassisPivot.add(group);
      group.visible = true;
      carEntity.savedLabel = carEntity.label;
      carEntity.label = 'Radiowóz';
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
      // brake lights and indicators follow the taxi's own (its material reads them from this uniform)
      const own = attachedTo?.carState?.value, mine = mat.userData.carState?.value;
      if (own && mine) mine.copy(own);
      if (!siren) return;
      const phase = Math.floor(elapsed * 7) % 2;
      lamps.forEach((l, i) => { l.material = (i + phase) % 2 ? on : off; });
      // the wail: up and down over 3.2 s
      if (audio.osc) audio.osc.frequency.setTargetAtTime(600 + 650 * (0.5 - 0.5 * Math.cos((elapsed / 3.2) * Math.PI * 2)), audio.ctx.currentTime, 0.05);
    },
  };
}

export { createPatrolCar };
