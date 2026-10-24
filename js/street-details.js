import * as THREE from 'three/webgpu';
import { uniform, mod, step, float, mix, color } from 'three/tsl';
import { SIGNAL_TIMING } from './city-config.js';

// js/street-details.js
// The street furniture of Bielany. Step 1.5: the traffic signals, a grey pole with a black three-lamp head at the
// right-hand curb of every approach to a signalized junction (road-network.js, from OpenStreetMap), facing the
// traffic, lit by the signal clock in step with the traffic (city-config.js SIGNAL_TIMING). Trees come in step 1.7;
// the New York props (hydrants, steam, carts) are gone (tag nyc-original).
//
// Returns what the rest of the city reads: footprints the traffic keeps clear of, the signal clock (main.js sets it
// every frame), the signals the city audio ticks at, and addSignals(network) to raise the signals once the road
// network is built.

const POLE_H = 3.4;
const HEAD = { w: 0.32, h: 0.95, d: 0.26 }; // the lamp housing
const LENS_R = 0.1;

// A lamp lens: dark, or lit in its colour while its phase runs (main road: group 0; crossing roads: the rest)
function createLensMaterial(clock, isMain, lamp) {
  const { cycle, avenueAmber, avenueRed, streetAmber } = SIGNAL_TIMING;
  const t = mod(clock, cycle);
  const on = {
    green: isMain ? float(1).sub(step(avenueAmber, t)) : step(avenueRed, t).mul(float(1).sub(step(streetAmber, t))),
    amber: isMain ? step(avenueAmber, t).mul(float(1).sub(step(avenueRed, t))) : step(streetAmber, t),
    red: isMain ? step(avenueRed, t) : float(1).sub(step(avenueRed, t))
  }[lamp];
  const hue = { green: 0x18ff68, amber: 0xffaa10, red: 0xff2424 }[lamp];
  const mat = new THREE.MeshBasicNodeMaterial();
  mat.colorNode = mix(color(0x14181e), color(hue).mul(1.6), on);
  return mat;
}

function buildStreetDetails(scene) {
  const group = new THREE.Group();
  group.name = 'BielanyStreetDetails';
  scene.add(group);
  const signalClock = uniform(0);
  const footprints = []; // { minX, maxX, minZ, maxZ }
  const audioSignals = []; // { x, y, z, isAvenue }

  function addSignals(network) {
    const heads = []; // { x, z, yaw, main }
    for (const n of network.nodes) {
      if (!n.signal) continue;
      for (const e of n.in || []) {
        const r = e.half + 1.0; // at the right-hand curb
        const x = e.sx + e.dx * e.len + e.rx * r;
        const z = e.sz + e.dz * e.len + e.rz * r;
        heads.push({ x, z, yaw: Math.atan2(-e.dx, -e.dz), main: e.axisIndex === 0 });
        audioSignals.push({ x, y: POLE_H - 0.4, z, isAvenue: e.axisIndex === 0 });
      }
    }
    if (!heads.length) return;
    const pole = new THREE.CylinderGeometry(0.055, 0.07, POLE_H, 8).translate(0, POLE_H / 2, 0);
    const housing = new THREE.BoxGeometry(HEAD.w, HEAD.h, HEAD.d).translate(0, POLE_H - HEAD.h / 2, HEAD.d / 2 + 0.06);
    const lens = new THREE.CircleGeometry(LENS_R, 16);
    const make = (geo, mat, list, name, cast = true) => {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
      im.name = name;
      im.castShadow = cast;
      im.count = list.length;
      group.add(im);
      return im;
    };
    const poles = make(pole, new THREE.MeshStandardNodeMaterial({ color: 0x7d8186, roughness: 0.5, metalness: 0.6 }), heads, 'SignalPoles');
    const boxes = make(housing, new THREE.MeshStandardNodeMaterial({ color: 0x1b1d20, roughness: 0.6 }), heads, 'SignalHeads');
    const dummy = new THREE.Object3D();
    heads.forEach((h, i) => {
      dummy.position.set(h.x, 0, h.z);
      dummy.rotation.set(0, h.yaw, 0);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
      boxes.setMatrixAt(i, dummy.matrix);
    });
    // lenses on the housing's front, red on top
    const lampY = { red: POLE_H - 0.2, amber: POLE_H - HEAD.h / 2, green: POLE_H - HEAD.h + 0.2 };
    for (const main of [true, false]) {
      const list = heads.filter((h) => h.main === main);
      for (const lamp of ['red', 'amber', 'green']) {
        const im = make(lens, createLensMaterial(signalClock, main, lamp), list, `SignalLens ${main ? 'main' : 'cross'} ${lamp}`, false);
        list.forEach((h, i) => {
          dummy.position.set(h.x, 0, h.z);
          dummy.rotation.set(0, h.yaw, 0);
          dummy.updateMatrix();
          dummy.matrix.multiply(new THREE.Matrix4().makeTranslation(0, lampY[lamp], HEAD.d + 0.065));
          im.setMatrixAt(i, dummy.matrix);
        });
      }
    }
    console.info(`[streetDetails] ${heads.length} signal heads at ${network.nodes.filter((n) => n.signal).length} junctions`);
  }

  return { group, footprints, signalClock, audioSignals, addSignals, update() {} };
}

export { buildStreetDetails };
