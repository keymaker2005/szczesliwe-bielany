// js/forest.js
// The woods of Bielany (step 3.2b): Las Bielański, Las Młociński, Park Młociński and the smaller woods of
// OpenStreetMap (js/bielany-geodata.js GEO.woods, their paths GEO.paths). Inside them the lawn of the curb islands turns
// into a forest floor (brown leaf litter, patches of moss) crossed by trodden earth paths, both painted from one mask
// texture, and an undergrowth of shrubs (hazel, young maples, elder: autumn green, yellow and rust) grows between the
// paths, drawn only round the camera.

import * as THREE from 'three/webgpu';
import { texture, positionWorld, vec2, vec3, float, color, mix, smoothstep, fract, sin, dot, floor, min } from 'three/tsl';
import { GEO } from './bielany-geodata.js';
import { ISLAND_BOUNDS, blockAt, buildingAt } from './city-config.js';
import { groundY } from './terrain.js';

const MASK_TEXEL = 2; // m per texel of the woods & paths mask
const SHRUB_CELL = 5; // m: at most one shrub per square this wide
const SHRUB_CHANCE = 0.42;
const TILE = 128; // m: shrubs are drawn per tile
const NEAR = 170; // m from the camera to a tile's middle for its shrubs to be drawn

const toPts = (flat) => {
  const out = [];
  for (let k = 0; k < flat.length; k += 2) out.push([flat[k], flat[k + 1]]);
  return out;
};
const woods = (GEO.woods || []).map(([outer, holes]) => {
  const o = toPts(outer);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of o) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return { outer: o, holes: holes.map(toPts), box: [x0, z0, x1, z1] };
});
const paths = (GEO.paths || []).map(([w, flat]) => ({ w, pts: toPts(flat) }));

function inRing(r, x, z) {
  let c = false;
  for (let k = 0, m = r.length - 1; k < r.length; m = k++) {
    const [xi, zi] = r[k], [xj, zj] = r[m];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/** Is (x, z) in a wood (OpenStreetMap natural=wood, landuse=forest)? */
function inWood(x, z) {
  for (const w of woods) {
    const b = w.box;
    if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue;
    if (inRing(w.outer, x, z) && !w.holes.some((h) => inRing(h, x, z))) return true;
  }
  return false;
}

// Woods (red) and paths (green) over the area, MASK_TEXEL m per texel. No canvas filter (a blur on a canvas this
// large took the browser's GPU process down with the game's WebGPU device): the texture's linear filtering and the
// smoothsteps in the materials soften the edges
function woodsMask() {
  const b = ISLAND_BOUNDS;
  const W = Math.ceil((b.maxX - b.minX) / MASK_TEXEL), H = Math.ceil((b.maxZ - b.minZ) / MASK_TEXEL);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const px = ([x, z]) => [(x - b.minX) / MASK_TEXEL, (z - b.minZ) / MASK_TEXEL];
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#ff0000';
  for (const w of woods) {
    ctx.beginPath();
    for (const ring of [w.outer, ...w.holes]) {
      ring.forEach((p, k) => (k ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }
  ctx.strokeStyle = '#00ff00';
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const p of paths) {
    ctx.lineWidth = p.w / MASK_TEXEL;
    ctx.beginPath();
    p.pts.forEach((q, k) => (k ? ctx.lineTo(...px(q)) : ctx.moveTo(...px(q))));
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

let mask = null;
const maskAt = () => {
  const b = ISLAND_BOUNDS, wp = positionWorld.xz;
  return texture(mask || (mask = woodsMask()), vec2(wp.x.sub(b.minX).div(b.maxX - b.minX), wp.y.sub(b.minZ).div(b.maxZ - b.minZ)));
};

/** The lawn of a ground material turns into the forest floor inside the woods (before its fallen leaves are added) */
function withForestFloor(mat) {
  if (!woods.length) return mat;
  const wood = maskAt().r;
  const wp = positionWorld.xz;
  const cell = floor(wp.mul(0.9));
  const r = fract(sin(dot(cell, vec2(17.13, 61.7))).mul(43758.5453));
  const litter = mix(vec3(color(0x4a3a26)), vec3(color(0x6a5232)), r); // brown leaf litter, darker & lighter patches
  const moss = vec3(color(0x3c4a24));
  const floorC = mix(litter, moss, smoothstep(0.82, 0.97, fract(sin(dot(floor(wp.mul(0.25)), vec2(5.1, 9.7))).mul(9134.3))));
  mat.colorNode = mix(mat.colorNode, floorC, smoothstep(0.15, 0.75, wood).mul(0.92));
  return mat;
}

/** Trodden earth paths through the woods, over the fallen leaves */
function withForestPaths(mat) {
  if (!paths.length) return mat;
  const path = maskAt().g;
  const wp = positionWorld.xz;
  const grain = fract(sin(dot(floor(wp.mul(3)), vec2(12.9898, 78.233))).mul(43758.5453));
  const earth = mix(vec3(color(0x8a7354)), vec3(color(0x9c8664)), grain);
  mat.colorNode = mix(mat.colorNode, earth, min(smoothstep(0.2, 0.7, path), float(0.9)));
  return mat;
}

// One shrub: three squashed blobs round a stem, about 1 m high and 1.4 m across before scaling
function shrubGeometry() {
  const parts = [[0, 0.55, 0, 0.62], [0.38, 0.45, 0.15, 0.48], [-0.3, 0.42, -0.22, 0.5]];
  const pos = [], nrm = [];
  for (const [cx, cy, cz, r] of parts) {
    const g = new THREE.IcosahedronGeometry(r, 1); // non-indexed already
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let k = 0; k < p.length; k += 3) {
      pos.push(cx + p[k], cy + p[k + 1] * 0.78, cz + p[k + 2]);
      nrm.push(n[k], n[k + 1], n[k + 2]);
    }
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

const hash = (x, z, s) => {
  const v = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

// Distance from (x, z) to the nearest forest path's edge (Infinity when none is within `reach`)
function pathGrid() {
  const CELL = 32, grid = new Map();
  for (const p of paths) {
    for (let k = 1; k < p.pts.length; k++) {
      const [ax, az] = p.pts[k - 1], [bx, bz] = p.pts[k];
      for (let i = Math.floor(Math.min(ax, bx) / CELL) - 1; i <= Math.floor(Math.max(ax, bx) / CELL) + 1; i++) {
        for (let j = Math.floor(Math.min(az, bz) / CELL) - 1; j <= Math.floor(Math.max(az, bz) / CELL) + 1; j++) {
          const key = i * 100000 + j;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push([ax, az, bx, bz, p.w / 2]);
        }
      }
    }
  }
  return (x, z) => {
    let d = Infinity;
    for (const [ax, az, bx, bz, h] of grid.get(Math.floor(x / CELL) * 100000 + Math.floor(z / CELL)) || []) {
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t) - h);
    }
    return d;
  };
}

/** The undergrowth: shrubs in the woods, on the curb islands, off the paths and out of the buildings */
function buildForest(scene) {
  const group = new THREE.Group();
  group.name = 'BielanyForest';
  const b = ISLAND_BOUNDS, curb = ISLAND_BOUNDS.sidewalkHeight;
  const toPath = pathGrid();
  const tiles = new Map(); // key -> { cx, cz, list: [x, y, z, yaw, scale, tint] }
  const tints = [0x4f6b2a, 0x6b7a2c, 0x8f8a2e, 0xa5772a, 0x8a4a22, 0x5d7232];
  let count = 0;
  for (const w of woods) {
    const [x0, z0, x1, z1] = w.box;
    for (let x = Math.max(b.minX, Math.floor(x0 / SHRUB_CELL) * SHRUB_CELL); x < Math.min(b.maxX, x1); x += SHRUB_CELL) {
      for (let z = Math.max(b.minZ, Math.floor(z0 / SHRUB_CELL) * SHRUB_CELL); z < Math.min(b.maxZ, z1); z += SHRUB_CELL) {
        if (hash(x, z, 1) > SHRUB_CHANCE) continue;
        const sx = x + hash(x, z, 2) * SHRUB_CELL, sz = z + hash(x, z, 3) * SHRUB_CELL;
        if (!inRing(w.outer, sx, sz) || w.holes.some((h) => inRing(h, sx, sz))) continue;
        if (!blockAt(sx, sz) || buildingAt(sx, sz) || toPath(sx, sz) < 0.9) continue;
        const key = `${Math.floor(sx / TILE)},${Math.floor(sz / TILE)}`;
        if (!tiles.has(key)) tiles.set(key, { cx: (Math.floor(sx / TILE) + 0.5) * TILE, cz: (Math.floor(sz / TILE) + 0.5) * TILE, list: [] });
        const s = 0.6 + hash(sx, sz, 4) * 1.0;
        tiles.get(key).list.push([sx, groundY(sx, sz) + curb, sz, hash(sx, sz, 5) * Math.PI * 2, s, tints[Math.floor(hash(sx, sz, 6) * tints.length)]]);
        count++;
      }
    }
  }
  // One instanced draw for the whole undergrowth: the shrubs of the tiles round the camera are packed into it, again
  // whenever the camera has moved a few metres (each tile keeps its instance matrices & colours ready)
  const dummy = new THREE.Object3D(), tone = new THREE.Color();
  const ready = [...tiles.values()].map((t) => {
    const matrices = new Float32Array(t.list.length * 16), colors = new Float32Array(t.list.length * 3);
    t.list.forEach(([x, y, z, yaw, s, tint], i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(s, s * (0.8 + hash(x, z, 7) * 0.5), s);
      dummy.updateMatrix();
      dummy.matrix.toArray(matrices, i * 16);
      tone.setHex(tint).multiplyScalar(0.85 + hash(z, x, 8) * 0.3).toArray(colors, i * 3);
    });
    return { cx: t.cx, cz: t.cz, n: t.list.length, matrices, colors };
  });
  let capacity = 1;
  for (const t of ready) {
    const near = ready.filter((o) => Math.hypot(o.cx - t.cx, o.cz - t.cz) < NEAR + TILE).reduce((s, o) => s + o.n, 0);
    capacity = Math.max(capacity, near);
  }
  const mesh = new THREE.InstancedMesh(shrubGeometry(), new THREE.MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0 }), capacity);
  mesh.name = 'Shrubs';
  mesh.receiveShadow = true;
  mesh.frustumCulled = false; // only the shrubs round the camera are in it
  mesh.setColorAt(0, tone.setHex(tints[0]));
  mesh.count = 0;
  group.add(mesh);
  scene.add(group);
  console.info(`[forest] ${woods.length} woods, ${paths.length} paths, ${count} shrubs in ${ready.length} tiles, up to ${capacity} drawn`);

  let lastX = Infinity, lastZ = Infinity;
  return {
    group,
    shrubs: count,
    // the shrubs round the camera (from high above none: they are too small to see)
    update(camera) {
      const p = camera.position;
      if (p.y - groundY(p.x, p.z) > 120) { mesh.count = 0; lastX = Infinity; return; }
      if (Math.hypot(p.x - lastX, p.z - lastZ) < 8) return;
      lastX = p.x;
      lastZ = p.z;
      let n = 0;
      for (const t of ready) {
        if (Math.hypot(t.cx - p.x, t.cz - p.z) >= NEAR || n + t.n > capacity) continue;
        mesh.instanceMatrix.array.set(t.matrices, n * 16);
        mesh.instanceColor.array.set(t.colors, n * 3);
        n += t.n;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  };
}

export { buildForest, withForestFloor, withForestPaths, inWood, pathGrid };
