// js/water.js
// Water of Bielany (step 3.3): the Vistula, the ponds and canals of OpenStreetMap (js/bielany-geodata.js GEO.water)
// and the beaches and sandbanks along the river. Every water body is one level surface at the height of the ground
// along its shore (js/terrain.js; the river some 20 m below the plateau, the ponds on it at 0), just over the lawn of
// the curb island it lies in, so its banks, wherever the ground rises above it, draw the shoreline. The water has its
// own material (the estuary material of the original, js/tsl-materials.js createWaterMaterial, does not compile without
// New York's shorelines and its mesh was silently left out): slow drifting ripples from noise, a murky green-grey body,
// the sky and the banks reflected through the low roughness; the ponds on the plateau greener. Sand is laid on the
// ground between the lawn and the water.

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GEO } from './bielany-geodata.js';
import { ISLAND_BOUNDS } from './city-config.js';
import { positionWorld, cameraViewMatrix, time, vec2, vec3, float, color, mix, smoothstep, normalize, mx_noise_float } from 'three/tsl';
import { groundY, drapeGeometry } from './terrain.js';

const ABOVE_LAWN = 0.2; // m over the ground under the shore: over the curb islands' lawn (0.15)
const SAND = 0.165; // m over the ground: over the lawn and the sidewalks, under the water

const toPts = (flat) => {
  const out = [];
  for (let k = 0; k < flat.length; k += 2) out.push(new THREE.Vector2(flat[k], -flat[k + 1]));
  return out;
};

// A flat surface (x, 0, z) of a ring with holes, facing up
function ringGeometry(outer, holes) {
  const shape = new THREE.Shape(toPts(outer));
  for (const h of holes) shape.holes.push(new THREE.Path(toPts(h)));
  const g = new THREE.ShapeGeometry(shape, 1).toNonIndexed();
  g.rotateX(-Math.PI / 2);
  g.deleteAttribute('uv');
  return g;
}

// The level of a water body: the median ground height along its shore (the smoothed terrain is a little higher on
// the banks than on the water itself, so the surface floods to the bank)
function levelOf(outer) {
  const b = ISLAND_BOUNDS;
  const ys = [];
  for (let k = 0; k < outer.length; k += 2) {
    const x = outer[k], z = outer[k + 1];
    if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) ys.push(groundY(x, z));
  }
  if (!ys.length) return 0;
  ys.sort((a, c) => a - c);
  return ys[Math.floor(ys.length / 2)];
}

function createRiverMaterial() {
  const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.12, metalness: 0 });
  const p = positionWorld.xz;
  // two drifting layers of ripples (heights in arbitrary units), their slope by central differences
  const ripples = (q) => mx_noise_float(vec3(q.x.mul(0.09).add(time.mul(0.12)), q.y.mul(0.09), time.mul(0.05))).mul(0.5)
    .add(mx_noise_float(vec3(q.x.mul(0.31), q.y.mul(0.31).sub(time.mul(0.2)), time.mul(0.11))).mul(0.18));
  const e = 0.6;
  const dx = ripples(p.add(vec2(e, 0))).sub(ripples(p.sub(vec2(e, 0))));
  const dz = ripples(p.add(vec2(0, e))).sub(ripples(p.sub(vec2(0, e))));
  mat.normalNode = cameraViewMatrix.transformDirection(normalize(vec3(dx.negate(), float(2 * e), dz.negate())));
  const silt = mx_noise_float(vec3(p.mul(0.004), 1.7)).mul(0.5).add(0.5);
  const river = mix(color(0x17302c), color(0x2b3d35), silt);
  const pond = mix(color(0x22331f), color(0x34432a), silt);
  mat.colorNode = mix(river, pond, smoothstep(-3, -1, positionWorld.y)); // the ponds lie on the plateau (y = 0)
  return mat;
}

function buildWater(scene) {
  const group = new THREE.Group();
  group.name = 'BielanyWater';
  const water = [], sand = [];
  for (const [kind, outer, holes] of GEO.water || []) {
    const g = ringGeometry(outer, holes);
    if (kind === 0) {
      g.translate(0, levelOf(outer) + ABOVE_LAWN, 0);
      water.push(g);
    } else {
      g.translate(0, SAND, 0);
      const laid = drapeGeometry(g);
      sand.push(laid.index ? laid.toNonIndexed() : laid);
    }
  }
  if (water.length) {
    const mesh = new THREE.Mesh(mergeGeometries(water, false), createRiverMaterial());
    mesh.name = 'Water';
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (sand.length) {
    const mesh = new THREE.Mesh(mergeGeometries(sand, false), new THREE.MeshStandardNodeMaterial({ color: 0xcdbb8e, roughness: 1, metalness: 0 }));
    mesh.name = 'Sand';
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  scene.add(group);
  console.info(`[water] ${water.length} water bodies, ${sand.length} beaches & sandbanks`);
  return { group };
}

export { buildWater };
