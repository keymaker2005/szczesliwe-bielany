// js/fire-engine.js
// The fire engine and the look of the firefighter's calls (js/firefighter.js):
// - the engine: during a call the player's car is re-bodied as a red truck — a white band along the sides, aluminium
//   locker shutters, "STRAŻ" in plain letters on the front, sides and back, a turntable ladder on the roof, a water
//   cannon over the cab, blue lights — with a wailing siren (WebAudio). No service's logo or insignia. The taxi body
//   comes back at the end; the chassis, wheels and physics stay as they are (js/controllers.js is not touched), so the
//   truck collides like the car (it is a little longer and wider than its box);
// - the effects: flames and smoke from the burning window, the water jets (the cannon; the basement's water along the
//   hose into the pump), the hose, the puddle, the cat on its branch. GPU particles: one plane mesh drawn `count`
//   times, every particle placed by its index and the time in TSL (no per-particle work on the CPU), drawn only while
//   a call has them and near the camera.

import * as THREE from 'three/webgpu';
import { uniform, instanceIndex, hash, float, vec3, fract, mix, uv, smoothstep, step, min } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { groundY } from './terrain.js';

const RED = 0xc21a1a, WHITE = 0xf1f1ec, DARK = 0x1b1f24, GREY = 0x4a4e54, ALU = 0xb9bec4, CHROME = 0xc8ccd0, SHUTTER = 0x9aa0a6;

function paint(g, hex) {
  const c = new THREE.Color(hex).convertSRGBToLinear();
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}
const boxGeo = (w, h, d, x, y, z, hex) => paint(new THREE.BoxGeometry(w, h, d).toNonIndexed().translate(x, y, z), hex);
const rboxGeo = (w, h, d, x, y, z, hex, r = 0.12) => paint(new RoundedBoxGeometry(w, h, d, 3, r).translate(x, y, z), hex);

// Plain white letters (no blur: ctx.filter crashes the GPU process, docs/stan-projektu.md)
function lettering(text, w, h, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.font = '700 96px Arial, "Inter", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardNodeMaterial({ map: t, transparent: true, alphaTest: 0.4, roughness: 0.5 }));
}

// The truck in the frame of the car: +z forward, y up from the ground. 2.4 m wide, 7.4 m long (a medium rescue and
// fire truck), the roof at 3 m
const W = 2.4, ZR = -3.6, ZF = 3.8, ROOF = 3.0;
function truckGeometry() {
  const p = [];
  // cab with a sloped front, the body behind it
  p.push(rboxGeo(W, 1.95, 4.95, 0, 1.98, ZR + 2.475, RED, 0.1)); // body over the wheels, roof at 2.95
  p.push(rboxGeo(W - 0.04, 1.85, 1.7, 0, 1.93, 2.95, RED, 0.16)); // cab
  p.push(boxGeo(W - 0.9, 0.5, ZF - ZR - 0.6, 0, 0.78, (ZF + ZR) / 2, DARK)); // the chassis frame between the wheels
  p.push(boxGeo(W - 0.1, 0.05, 1.45, 0, 2.74, 2.95, RED)); // cab roof lip
  const wind = paint(new THREE.BoxGeometry(W - 0.25, 0.9, 0.05).toNonIndexed().rotateX(-0.12).translate(0, 2.15, ZF - 0.02), DARK);
  p.push(wind);
  for (const sd of [-1, 1]) {
    p.push(boxGeo(0.02, 0.75, 1.0, sd * (W / 2 + 0.005), 2.1, 3.0, DARK)); // cab door windows
    p.push(boxGeo(0.02, 0.75, 0.6, sd * (W / 2 + 0.005), 2.1, 2.35, DARK)); // crew cab windows
    p.push(boxGeo(0.025, 1.65, 0.02, sd * (W / 2 + 0.012), 1.55, 2.5, GREY)); // door gap
    // locker shutters: three aluminium panels with their ribs
    for (const [z0, z1] of [[ZR + 0.25, -1.65], [-1.5, 0.05], [0.2, 1.85]]) {
      p.push(boxGeo(0.03, 1.65, z1 - z0, sd * (W / 2 + 0.01), 2.0, (z0 + z1) / 2, SHUTTER));
      for (let y = 1.25; y < 2.7; y += 0.17) p.push(boxGeo(0.04, 0.02, z1 - z0, sd * (W / 2 + 0.015), y, (z0 + z1) / 2, ALU));
    }
    // the white band low down along the whole truck, red skirt under it
    p.push(boxGeo(0.02, 0.18, ZF - ZR - 0.1, sd * (W / 2 + 0.012), 1.1, (ZF + ZR) / 2, WHITE));
    p.push(boxGeo(0.1, 0.25, 0.35, sd * (W / 2 + 0.14), 2.2, 3.55, DARK)); // mirrors
    p.push(boxGeo(0.04, 0.6, 0.04, sd * (W / 2 + 0.07), 2.0, 3.55, GREY));
    p.push(boxGeo(0.03, 0.12, 0.35, sd * (W / 2 + 0.02), 2.75, ZR + 0.4, 0x2a6bff)); // side flashers
    // the pump outlets behind the cab
    p.push(boxGeo(0.12, 0.18, 0.18, sd * (W / 2 + 0.06), 1.3, -0.6, CHROME));
  }
  // rear: shutter, steps, bumper, lamps
  p.push(boxGeo(W - 0.2, 1.65, 0.03, 0, 2.0, ZR - 0.01, SHUTTER));
  for (let y = 1.25; y < 2.8; y += 0.17) p.push(boxGeo(W - 0.2, 0.02, 0.04, 0, y, ZR - 0.02, ALU));
  p.push(boxGeo(W + 0.04, 0.24, 0.3, 0, 0.55, ZR - 0.05, GREY));
  p.push(boxGeo(W - 0.2, 0.14, 0.06, 0, 1.1, ZR - 0.02, WHITE));
  // front: grille, bumper, headlights
  p.push(boxGeo(1.4, 0.28, 0.04, 0, 1.2, ZF + 0.01, DARK));
  p.push(boxGeo(W + 0.04, 0.3, 0.3, 0, 0.55, ZF - 0.1, WHITE));
  for (const sd of [-1, 1]) p.push(boxGeo(0.4, 0.2, 0.04, sd * 0.95, 1.2, ZF + 0.01, CHROME));
  // roof: the ladder's cradle at the front, the turntable's base at the back, the water cannon over the cab
  p.push(boxGeo(1.2, 0.15, 0.3, 0, ROOF + 0.02, 1.8, GREY));
  p.push(new THREE.CylinderGeometry(0.75, 0.8, 0.2, 18).toNonIndexed().translate(0, ROOF + 0.05, ZR + 0.85));
  paint(p[p.length - 1], GREY);
  p.push(paint(new THREE.CylinderGeometry(0.1, 0.12, 0.35, 10).toNonIndexed().translate(0, 2.95, 3.1), CHROME));
  p.push(paint(new THREE.CylinderGeometry(0.05, 0.07, 0.6, 10).toNonIndexed().rotateX(Math.PI / 2 - 0.25).translate(0, 3.15, 3.35), CHROME));
  p.push(boxGeo(1.6, 0.12, 0.3, 0, 2.8, 3.25, GREY)); // the blue bar's housing
  return mergeGeometries(p, false);
}

// One ladder section: two rails and rungs, `len` along +z from 0
function ladderSection(len, width, hex) {
  const p = [];
  for (const sd of [-1, 1]) p.push(boxGeo(0.07, 0.16, len, sd * width / 2, 0, len / 2, hex));
  for (let z = 0.2; z < len - 0.1; z += 0.35) p.push(boxGeo(width, 0.04, 0.05, 0, 0.02, z, hex));
  return mergeGeometries(p, false);
}

function wheelGeometry() {
  const tyre = paint(new THREE.CylinderGeometry(0.5, 0.5, 0.34, 22).toNonIndexed().rotateZ(Math.PI / 2), 0x1b1c1e);
  const hub = paint(new THREE.CylinderGeometry(0.27, 0.27, 0.35, 14).toNonIndexed().rotateZ(Math.PI / 2), 0xb0b4b8);
  return mergeGeometries([tyre, hub], false);
}

const SECTION = 6.2, SLIDE = 4.9; // m: one section, how far each fly slides out (reach ≈ 6.2 + 2 × 4.9 = 16 m)
const TURNTABLE = new THREE.Vector3(0, ROOF + 0.2, ZR + 0.85);
const NOZZLE = new THREE.Vector3(0, 3.3, 3.6);

function createFireEngine() {
  const group = new THREE.Group();
  group.name = 'FireEngineBody';
  const vertexMat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.15 });
  const body = new THREE.Mesh(truckGeometry(), vertexMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const front = lettering('STRAŻ', 1.0, 0.25);
  front.position.set(0, 1.55, ZF + 0.03);
  const back = lettering('STRAŻ', 1.5, 0.37);
  back.position.set(0, 2.62, ZR - 0.04);
  back.rotation.y = Math.PI;
  group.add(front, back);
  for (const sd of [-1, 1]) {
    const side = lettering('STRAŻ', 1.0, 0.25);
    side.position.set(sd * (W / 2 + 0.03), 1.4, 3.0);
    side.rotation.y = sd * Math.PI / 2;
    group.add(side);
  }
  // the turntable ladder: yaw at the turntable, pitch at its hinge, two fly sections sliding out
  const turntable = new THREE.Group();
  turntable.position.copy(TURNTABLE);
  const hinge = new THREE.Group();
  hinge.position.y = 0.25;
  turntable.add(hinge);
  const sections = [[0.8, ALU], [0.66, 0xd0d4d8], [0.52, ALU]].map(([w, hex], k) => {
    const s = new THREE.Mesh(ladderSection(SECTION, w, hex), vertexMat);
    s.position.y = k * 0.06;
    s.castShadow = true;
    hinge.add(s);
    return s;
  });
  turntable.add(new THREE.Mesh(paint(new THREE.BoxGeometry(0.9, 0.3, 0.7).toNonIndexed().translate(0, 0.12, 0), GREY), vertexMat));
  group.add(turntable);
  const ladder = { yaw: 0, pitch: 0, ext: 0 };

  // blue flashing lights: the cab bar (two) and the rear corners
  const on = new THREE.MeshBasicNodeMaterial({ color: 0x2a6bff });
  const off = new THREE.MeshBasicNodeMaterial({ color: 0x0b1a40 });
  const lamps = [];
  for (const [x, y, z, w] of [[-0.42, 2.92, 3.25, 0.6], [0.42, 2.92, 3.25, 0.6], [-1.0, 3.05, ZR + 0.15, 0.3], [1.0, 3.05, ZR + 0.15, 0.3]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.26), off);
    m.position.set(x, y, z);
    group.add(m);
    lamps.push(m);
  }
  group.visible = false;

  const wheelGeo = wheelGeometry();
  const wheelMat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.7 });
  const truckWheels = [];
  let attachedTo = null, hidden = [], siren = false, pivots = [];
  const audio = { ctx: null, gain: null, osc: null };

  function startSiren() {
    try {
      if (!audio.ctx) {
        audio.ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
        audio.gain = audio.ctx.createGain();
        audio.gain.gain.value = 0;
        const filter = audio.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1900;
        audio.osc = audio.ctx.createOscillator();
        audio.osc.type = 'sawtooth';
        audio.osc.frequency.value = 600;
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
    attach(carEntity) {
      if (attachedTo) return;
      attachedTo = carEntity;
      hidden = carEntity.chassisPivot.children.filter((o) => o.isMesh && o.visible);
      for (const w of carEntity.wheels || []) hidden.push(w.tire);
      for (const o of hidden) o.visible = false;
      // truck wheels on the car's own pivots (they steer and spin), set out to the truck's wheelbase
      pivots = (carEntity.wheels || []).map((w) => ({ p: w.steerPivot, z: w.steerPivot.position.z, x: w.steerPivot.position.x, y: w.steerPivot.position.y }));
      for (const [k, { p }] of pivots.entries()) {
        const m = new THREE.Mesh(wheelGeo, wheelMat);
        m.castShadow = true;
        m.userData.tire = carEntity.wheels[k].tire;
        p.add(m);
        truckWheels.push(m);
        p.position.set(Math.sign(p.position.x) * 1.0, 0.5, p.position.z > 0 ? 2.45 : -1.9);
      }
      carEntity.chassisPivot.add(group);
      group.visible = true;
      carEntity.savedLabel = carEntity.label;
      carEntity.label = 'Wóz strażacki';
    },
    detach() {
      if (!attachedTo) return;
      for (const o of hidden) o.visible = true;
      for (const m of truckWheels) m.parent?.remove(m);
      truckWheels.length = 0;
      for (const { p, x, y, z } of pivots) p.position.set(x, y, z);
      attachedTo.chassisPivot.remove(group);
      attachedTo.label = attachedTo.savedLabel || attachedTo.label;
      attachedTo = null;
      group.visible = false;
      Object.assign(ladder, { yaw: 0, pitch: 0, ext: 0 });
      this.setSiren(false);
    },
    setSiren(onOff, audible = true) {
      siren = onOff;
      if (onOff && audible) startSiren(); else stopSiren();
      if (!onOff) for (const l of lamps) l.material = off;
    },
    /** The ladder's pose: yaw (rad, 0 = forward), pitch (rad up), ext 0..1 (both flies out) */
    setLadder(yaw, pitch, ext) {
      Object.assign(ladder, { yaw, pitch, ext });
    },
    get ladder() { return ladder; },
    /** World points on the truck: the water cannon's nozzle, the turntable, a pump outlet (side ±1) */
    nozzle(out) { return group.localToWorld(out.copy(NOZZLE)); },
    turntable(out) { return group.localToWorld(out.copy(TURNTABLE).setY(TURNTABLE.y + 0.25)); },
    outlet(side, out) { return group.localToWorld(out.set(side * (W / 2 + 0.12), 1.3, -0.6)); },
    toLocal(v) { return group.worldToLocal(v); },
    update(elapsed) {
      for (const m of truckWheels) m.rotation.x = m.userData.tire.rotation.x;
      turntable.rotation.y = ladder.yaw;
      hinge.rotation.x = -ladder.pitch;
      sections[1].position.z = ladder.ext * SLIDE;
      sections[2].position.z = ladder.ext * SLIDE * 2;
      if (!siren) return;
      const phase = Math.floor(elapsed * 5) % 2;
      lamps.forEach((l, i) => { l.material = (i + phase) % 2 ? on : off; });
      // the wail: up and down over 3 s
      if (audio.osc) audio.osc.frequency.setTargetAtTime(600 + 520 * (0.5 - 0.5 * Math.cos((elapsed / 3) * Math.PI * 2)), audio.ctx.currentTime, 0.05);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------------------------------------------------
const SHOW_DIST = 900; // m from the camera: the smoke is a beacon over the roofs
const AFTER = 12; // s the smoke clears / the cat sits on the ground after the end

// A particle cloud: a plane drawn `count` times, a soft round sprite each, placed by TSL from its index
function particles(count, build, { additive = false } = {}) {
  const mat = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const i = float(instanceIndex);
  const r = [hash(i), hash(i.add(17.31)), hash(i.add(41.7)), hash(i.add(73.9))];
  const disk = smoothstep(0.15, 0.5, uv().sub(0.5).length()).oneMinus();
  const { position, scale, color, opacity } = build(r, disk);
  mat.positionNode = position;
  mat.scaleNode = scale;
  mat.colorNode = color;
  mat.opacityNode = opacity;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.count = count;
  mesh.frustumCulled = false;
  mesh.castShadow = mesh.receiveShadow = false;
  mesh.renderOrder = 2;
  return mesh;
}

function createFireEffects(scene) {
  const root = new THREE.Group();
  root.name = 'FireEffects';
  scene.add(root);
  const uTime = uniform(0);
  const UP = vec3(0, 1, 0);

  // flames: out of the window band, licking up the wall
  const fire = {
    origin: uniform(new THREE.Vector3()), dir: uniform(new THREE.Vector3(1, 0, 0)), normal: uniform(new THREE.Vector3(0, 0, 1)),
    width: uniform(4), power: uniform(1), roof: uniform(10), smoke: uniform(1), steam: uniform(0),
  };
  const flames = particles(56, (r, disk) => {
    const life = fract(uTime.mul(r[2].mul(0.7).add(0.9)).add(r[0]));
    const across = r[1].sub(0.5).mul(fire.width).mul(life.mul(-0.4).add(1));
    const position = fire.origin.add(fire.dir.mul(across)).add(fire.normal.mul(life.mul(0.9).add(0.2)))
      .add(UP.mul(life.mul(r[2].mul(1.8).add(1.6)).sub(0.9)));
    const alive = step(r[3], fire.power.mul(1.1));
    return {
      position,
      scale: life.mul(-0.65).add(1).mul(r[2].mul(0.9).add(1.1)).mul(fire.power.mul(0.5).add(0.5)).mul(alive),
      color: mix(vec3(1, 0.82, 0.32), vec3(1, 0.22, 0.04), life).mul(3.2),
      opacity: life.oneMinus().mul(disk).mul(0.9),
    };
  }, { additive: true });
  // smoke: from the window, past the roof, drifting east with the wind; grey, paler (steam) as the fire goes out
  const smoke = particles(36, (r, disk) => {
    const life = fract(uTime.mul(r[2].mul(0.05).add(0.1)).add(r[0]));
    const rise = life.mul(fire.roof.add(26));
    const position = fire.origin.add(fire.dir.mul(r[1].sub(0.5).mul(fire.width).mul(0.7)))
      .add(fire.normal.mul(life.mul(4).add(0.8))).add(UP.mul(rise)).add(vec3(1, 0, 0.35).mul(life.mul(life).mul(14)));
    return {
      position,
      scale: life.mul(10).add(1.8),
      color: mix(vec3(0.16, 0.15, 0.15), vec3(0.62, 0.62, 0.62), min(life.mul(0.6).add(fire.steam), 1)),
      opacity: smoothstep(0, 0.06, life).mul(life.oneMinus()).mul(disk).mul(0.5).mul(fire.smoke),
    };
  });
  root.add(flames, smoke);

  // water jets: from a nozzle to a point along an arc, spreading on the way
  function jet(count, size) {
    const u = { from: uniform(new THREE.Vector3()), to: uniform(new THREE.Vector3()), arc: uniform(2), on: uniform(0), speed: uniform(1.3) };
    const mesh = particles(count, (r, disk) => {
      const t = fract(uTime.mul(u.speed).add(r[0]));
      const spread = vec3(r[1].sub(0.5), r[2].sub(0.5), r[3].sub(0.5)).mul(t.mul(size * 2.2));
      return {
        position: mix(u.from, u.to, t).add(UP.mul(u.arc.mul(4).mul(t).mul(t.oneMinus()))).add(spread),
        scale: t.mul(size * 2).add(size * 0.3).mul(u.on),
        color: vec3(0.82, 0.9, 1.0),
        opacity: t.mul(-0.5).add(0.75).mul(disk),
      };
    });
    root.add(mesh);
    return u;
  }
  const cannon = jet(90, 0.45);
  const outflow = jet(36, 0.22);

  // the hose: a pump outlet down to the ground, then to the wall
  const hoseMat = new THREE.MeshStandardNodeMaterial({ color: 0xd8d2c0, roughness: 0.8 });
  const hoseGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 8).translate(0, 0.5, 0).rotateX(Math.PI / 2); // along +z
  const hoses = [0, 1].map(() => { const m = new THREE.Mesh(hoseGeo, hoseMat); root.add(m); return m; });
  const lay = (m, a, b) => {
    m.position.copy(a);
    m.lookAt(b);
    m.scale.set(1, 1, Math.max(0.01, a.distanceTo(b)));
  };
  // the water by the flooded building, going down as the pump works
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2),
    new THREE.MeshStandardNodeMaterial({ color: 0x2a3540, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.75 }));
  root.add(puddle);

  // the cat: a ginger sitting cat, small
  const cat = new THREE.Group();
  {
    const fur = new THREE.MeshStandardNodeMaterial({ color: 0xc8742c, roughness: 0.9 });
    const add = (g, x, y, z) => { const m = new THREE.Mesh(g, fur); m.position.set(x, y, z); cat.add(m); return m; };
    add(new THREE.SphereGeometry(0.16, 10, 8).scale(1, 1.2, 1.25), 0, 0.18, 0);
    add(new THREE.SphereGeometry(0.11, 10, 8), 0, 0.42, 0.1);
    for (const sd of [-1, 1]) add(new THREE.ConeGeometry(0.04, 0.08, 5), sd * 0.06, 0.53, 0.1);
    add(new THREE.CylinderGeometry(0.025, 0.02, 0.4, 5).rotateX(0.9), 0, 0.15, -0.3);
  }
  root.add(cat);

  const parts = { flames, smoke, cannon, outflow, hoses, puddle, cat };
  const all = [flames, smoke, ...hoses, puddle, cat];
  const v = new THREE.Vector3(), w = new THREE.Vector3(), q = new THREE.Vector3();
  let after = 0, frames = 0, ladderPose = { yaw: 0, pitch: 0, ext: 0 };

  // the pipelines compile in the warm-up frame (main.js): everything shown, at zero size, for the first frames
  const show = (list) => { for (const o of all) o.visible = list.includes(o); };

  return {
    root,
    parts,
    /**
     * One frame: action = firefighter.scene() (or null), truck = createFireEngine(), camera; expire() when the
     * incident has nothing left to show
     */
    update(action, dt, truck, camera, expire) {
      uTime.value += dt;
      if (frames < 3) { frames++; fire.power.value = 0; fire.smoke.value = 0; cannon.on.value = outflow.on.value = 0; return; }
      cannon.on.value = 0;
      outflow.on.value = 0;
      const a = action;
      const i = a?.incident;
      const at = i && (i.fire || i.wall || i.tree);
      if (!a || !at || Math.hypot(camera.position.x - at.x, camera.position.z - at.z) > SHOW_DIST) {
        root.visible = false;
        if (a?.phase === 'after' && (after += dt) > AFTER) { after = 0; expire?.(); }
        this.ladderTo(truck, null, dt);
        return;
      }
      root.visible = true;
      if (a.phase === 'after') after += dt; else after = 0;
      const fade = a.phase === 'after' ? Math.max(0, 1 - after / AFTER) : 1;
      if (after > AFTER) { after = 0; expire?.(); }

      if (i.kind === 'fire') {
        show([flames, smoke]);
        const f = i.fire;
        fire.origin.value.set(f.x, f.y, f.z);
        fire.dir.value.set(f.dir.x, 0, f.dir.z);
        fire.normal.value.set(f.normal.x, 0, f.normal.z);
        fire.width.value = f.width;
        fire.roof.value = f.roof - f.y;
        fire.power.value = a.done ? 0 : Math.max(0, 1 - a.progress);
        fire.steam.value = Math.min(1, a.progress * 1.2);
        fire.smoke.value = a.done ? 0.6 * fade : Math.max(0.35, 1 - a.progress * 0.7);
        if (a.spraying && truck.active) {
          truck.nozzle(v);
          cannon.from.value.copy(v);
          cannon.to.value.set(f.x, f.y + 0.5, f.z);
          cannon.arc.value = Math.min(6, v.distanceTo(cannon.to.value) * 0.1);
          cannon.speed.value = 1.6 / Math.max(1, v.distanceTo(cannon.to.value) / 15);
          cannon.on.value = 1;
        }
      } else if (i.kind === 'flood') {
        const wall = i.wall;
        if (truck.active && a.phase === 'work' && a.running) {
          show([...hoses, puddle]);
          // the hose from the building to the outlet on its side of the truck
          truck.toLocal(v.set(wall.x, 0, wall.z));
          const side = v.x >= 0 ? 1 : -1;
          truck.outlet(side, v);
          w.copy(v).setY(groundY(v.x, v.z) + 0.06);
          lay(hoses[0], v, w);
          q.set(wall.x, groundY(wall.x, wall.z) + 0.3, wall.z);
          lay(hoses[1], w, q);
          // the water pumped out of the basement: from the basement window along the hose into the truck's pump
          outflow.from.value.set(wall.x + wall.normal.x * 0.5, q.y + 0.3, wall.z + wall.normal.z * 0.5);
          truck.outlet(side, v);
          outflow.to.value.copy(v);
          outflow.arc.value = 0.5;
          outflow.speed.value = 0.8;
          outflow.on.value = 1;
          // the water by the building goes down as the pump works
          const r = 0.4 + 2.6 * (1 - a.progress);
          puddle.position.set(wall.x + wall.normal.x * 2.2, groundY(wall.x, wall.z) + 0.03, wall.z + wall.normal.z * 2.2);
          puddle.scale.set(r, 1, r * 0.8);
        } else {
          show([]);
        }
      } else {
        show([cat]);
        const t = i.tree;
        if (a.done) {
          // down safe, sitting at the foot of the tree on the street side
          const d = Math.hypot(i.x - t.x, i.z - t.z) || 1;
          const x = t.x + ((i.x - t.x) / d) * 1.2, z = t.z + ((i.z - t.z) / d) * 1.2;
          cat.position.set(x, groundY(x, z), z);
          if (a.phase === 'after' && fade < 0.3) cat.visible = false;
        } else {
          cat.position.set(t.cat.x, t.cat.y, t.cat.z);
        }
        cat.rotation.y = Math.atan2(i.x - t.x, i.z - t.z);
      }
      this.ladderTo(truck, i.kind === 'cat' && a.phase === 'work' && !a.done ? { cat: i.tree.cat, progress: a.progress } : null, dt);
    },
    // The ladder: up and round to the cat (the first 30% of the progress), then the flies out; back down otherwise
    ladderTo(truck, goal, dt) {
      if (!truck.active) return;
      let yaw = 0, pitch = 0, ext = 0;
      if (goal) {
        truck.turntable(v);
        truck.toLocal(w.copy(goal.cat));
        truck.toLocal(q.copy(v));
        const dx = w.x - q.x, dy = w.y - q.y - 0.4, dz = w.z - q.z;
        const horiz = Math.hypot(dx, dz);
        const len = Math.hypot(horiz, dy);
        const raise = Math.min(1, goal.progress / 0.3);
        yaw = Math.atan2(dx, dz) * raise;
        pitch = Math.atan2(dy, horiz) * raise;
        ext = Math.min(1, Math.max(0, (len - SECTION + 0.3) / (SLIDE * 2))) * Math.max(0, (goal.progress - 0.3) / 0.7);
      }
      // ease towards the pose (also on the way back)
      const k = Math.min(1, dt * (goal ? 12 : 1.5));
      let dyaw = yaw - ladderPose.yaw;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      ladderPose = { yaw: ladderPose.yaw + dyaw * k, pitch: ladderPose.pitch + (pitch - ladderPose.pitch) * k, ext: ladderPose.ext + (ext - ladderPose.ext) * k };
      truck.setLadder(ladderPose.yaw, ladderPose.pitch, ladderPose.ext);
    },
  };
}

// The progress line under the mission panel (#mission-hud): the hint and a bar
function createFireHud(doc = globalThis.document) {
  const host = doc?.getElementById('mission-hud');
  if (!host) return { update() {} };
  const el = doc.createElement('div');
  el.className = 'duty-progress hidden';
  el.innerHTML = '<div class="duty-progress-text"></div><div class="duty-progress-bar"><span></span></div>';
  host.appendChild(el);
  const text = el.firstChild, bar = el.lastChild.firstChild;
  let last = '';
  return {
    update(action, active) {
      const on = Boolean(active && action && action.phase === 'work');
      el.classList.toggle('hidden', !on);
      if (!on) return;
      if (action.hint !== last) text.textContent = last = action.hint;
      bar.style.width = `${Math.round(action.progress * 100)}%`;
    },
  };
}

export { createFireEngine, createFireEffects, createFireHud };
