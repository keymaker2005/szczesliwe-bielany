import * as THREE from 'three/webgpu';
import { uniform, mod, step, float, mix, color } from 'three/tsl';
import { SIGNAL_TIMING, ISLAND_BOUNDS, blockAt, buildingAt, nearestRoads } from './city-config.js';
import { GEO } from './bielany-geodata.js';
import { createTreeField } from './trees.js';

// js/street-details.js
// The street furniture & trees of Bielany:
// - Trees: every tree of the GUGiK 3D tree survey (LoD1 2023, airborne laser scanning, js/bielany-geodata.js) at its
//   measured height & crown width, in autumn colours (yellows, oranges, rust, some still green); the model by crown
//   shape (trees.js: broad rounded crowns, tall narrow vase crowns, small open crowns). Trunks in the roadway (crowns
//   overhanging a street) and inside buildings are left out.
// - Traffic signals: a grey pole with a black three-lamp head at the right-hand curb of every approach to a
//   signalized junction (road-network.js, from OpenStreetMap), facing the traffic, lit by the signal clock in step
//   with the traffic (city-config.js SIGNAL_TIMING).
// The New York props (hydrants, steam, carts) are gone (tag nyc-original).
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

// Autumn foliage (sRGB, darkish: the tree material brightens them by the leaf atlas) with their shares
const AUTUMN = [[0x9c8424, 22], [0xa0701e, 18], [0x985018, 16], [0x74301a, 11], [0x664223, 7], [0x707a2a, 14], [0x4b6a29, 12]];
const AUTUMN_TOTAL = AUTUMN.reduce((a, [, w]) => a + w, 0);
function autumnTint(r) {
  let k = r * AUTUMN_TOTAL;
  for (const [hex, w] of AUTUMN) if ((k -= w) < 0) return hex;
  return AUTUMN[0][0];
}

// The surveyed trees as tree-field sites: [x, z, height, crown base, crown radius] -> { x, y, z, species, height, crown }
function treeSites() {
  const T = GEO.trees || [];
  const sites = [];
  for (let i = 0; i < T.length; i += 5) {
    const [x, z, h, , r] = [T[i], T[i + 1], T[i + 2], T[i + 3], T[i + 4]];
    if (h < 4 || buildingAt(x, z)) continue;
    const block = blockAt(x, z);
    if (!block && nearestRoads(x, z, 15).some(({ road, dist }) => road.cls !== 'pedestrian' && dist < road.w / 2 + 0.5)) continue;
    const ratio = r / h;
    const species = h < 9 ? 1 : ratio < 0.24 ? 2 : 0; // small & open: locust; tall & narrow: elm (vase); else plane
    const rnd = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    sites.push({ x, y: block ? ISLAND_BOUNDS.sidewalkHeight : 0, z, species, height: h, crown: Math.max(1.2, r), tint: autumnTint(rnd) });
  }
  return sites;
}

function buildStreetDetails(scene) {
  const group = new THREE.Group();
  group.name = 'BielanyStreetDetails';
  scene.add(group);
  const signalClock = uniform(0);
  const footprints = []; // { minX, maxX, minZ, maxZ }
  const audioSignals = []; // { x, y, z, isAvenue }

  const sites = treeSites();
  const trees = sites.length ? createTreeField(scene, sites) : null;
  if (trees) group.add(trees.group);
  console.info(`[streetDetails] ${sites.length} trees of ${(GEO.trees || []).length / 5} surveyed`);

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

  return { group, footprints, signalClock, audioSignals, addSignals, trees: sites, update() {} };
}

export { buildStreetDetails };
