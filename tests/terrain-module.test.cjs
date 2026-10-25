const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const { loadModule } = require('./helpers/module.cjs');

// Just enough of three.js for js/terrain.js (geometry bookkeeping, no rendering)
class Vector3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } }
class BufferAttribute {
  constructor(array, itemSize, normalized = false) { this.array = array; this.itemSize = itemSize; this.normalized = normalized; }
  get count() { return this.array.length / this.itemSize; }
}
class Float32BufferAttribute extends BufferAttribute { constructor(array, itemSize) { super(Float32Array.from(array), itemSize); } }
class BufferGeometry {
  constructor() { this.attributes = {}; this.index = null; this.groups = []; }
  setAttribute(name, attr) { this.attributes[name] = attr; return this; }
  deleteAttribute(name) { delete this.attributes[name]; return this; }
  setIndex(index) { this.index = Array.isArray(index) ? new BufferAttribute(Uint32Array.from(index), 1) : index; return this; }
  computeBoundingSphere() {}
  computeBoundingBox() {
    const p = this.attributes.position.array, min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (let k = 0; k < p.length; k += 3) {
      min.x = Math.min(min.x, p[k]); min.y = Math.min(min.y, p[k + 1]); min.z = Math.min(min.z, p[k + 2]);
      max.x = Math.max(max.x, p[k]); max.y = Math.max(max.y, p[k + 1]); max.z = Math.max(max.z, p[k + 2]);
    }
    this.boundingBox = { min, max };
  }
  toNonIndexed() {
    const g = new BufferGeometry(), idx = this.index.array;
    for (const [name, a] of Object.entries(this.attributes)) {
      const out = new a.array.constructor(idx.length * a.itemSize);
      idx.forEach((v, k) => { for (let c = 0; c < a.itemSize; c++) out[k * a.itemSize + c] = a.array[v * a.itemSize + c]; });
      g.setAttribute(name, new BufferAttribute(out, a.itemSize, a.normalized));
    }
    return g;
  }
}

const terrain = loadModule(readFileSync(join(__dirname, '../js/terrain.js'), 'utf8'), {
  imports: { 'three/webgpu': { Vector3, BufferAttribute, Float32BufferAttribute, BufferGeometry } },
  globals: { Math, Float32Array, Uint32Array, Uint8Array, DataView, Map, String, Object, Error, Array, Number, Infinity }
});

// A field on the tools' 4 m grid: plateau (0) west of x = 40, a slope of 1 in 4 down to x = 120, then flat at -20
async function field() {
  const { encodeGameField } = await import('../tools/terrain-bielany.mjs');
  const nx = 151, nz = 31, x0 = -400, z0 = -60, cell = 4;
  const y = new Int16Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * cell;
      y[j * nx + i] = Math.round(100 * (x <= 40 ? 0 : x >= 120 ? -20 : -(x - 40) / 4));
    }
  }
  const buf = encodeGameField(y, { x0, z0, cell, nx, nz });
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}

// One upward square [ax, bx] x [az, bz] at height h (two triangles), as the city's flat surfaces come
function square(ax, az, bx, bz, h) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([ax, h, az, ax, h, bz, bx, h, az, bx, h, az, ax, h, bz, bx, h, bz], 3));
  g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  return g;
}

test('Terrain module: flat until loaded, then the file\'s heights on its triangulated grid', async () => {
  terrain.clearTerrain();
  assert.equal(terrain.groundY(80, 0), 0);
  const flat = square(0, 0, 10, 10, 0.15);
  assert.equal(terrain.drapeGeometry(flat), flat, 'nothing to do on a flat world');

  terrain.setTerrain(await field());
  assert.equal(terrain.hasTerrain(), true);
  assert.equal(terrain.groundY(0, 0), 0);
  assert.ok(Math.abs(terrain.groundY(80, 0) + 10) < 1e-6, `${terrain.groundY(80, 0)}`);
  assert.ok(Math.abs(terrain.groundY(83, 5) + 10.75) < 1e-6, 'linear inside a grid square');
  assert.ok(Math.abs(terrain.groundY(500, 0) + 20) < 1e-6, 'held at the edge beyond the grid');
  assert.equal(terrain.flatIn(-400, -60, -300, 60), true);
  assert.equal(terrain.flatIn(60, -10, 70, 10), false);

  const pose = terrain.groundPose(80, 0, 1, 0, 2, 1); // facing +x, downhill
  assert.ok(Math.abs(pose.pitch - Math.atan2(1, 4)) < 1e-6, `pitch ${pose.pitch}`);
  assert.ok(Math.abs(pose.roll) < 1e-9);
  const n = terrain.groundNormal(80, 0);
  assert.ok(n.x > 0.2 && n.y > 0.9 && Math.abs(n.z) < 1e-9, 'the normal leans downhill');
});

test('Terrain module: a lawn 15 cm over the asphalt stays 15 cm over it on the slope', async () => {
  terrain.setTerrain(await field());
  const lawn = terrain.drapeGeometry(square(10.3, -17.1, 131.7, 23.9, 0.15));
  const p = lawn.attributes.position.array, idx = lawn.index.array;
  assert.ok(idx.length / 3 > 20, 'cut along the grid');
  for (let k = 0; k < p.length; k += 3) assert.ok(Math.abs(p[k + 1] - terrain.groundY(p[k], p[k + 2]) - 0.15) < 1e-4);
  // every piece lies in one plane of the surface: its centroid too is exactly 15 cm over the ground
  for (let t = 0; t < idx.length; t += 3) {
    let x = 0, y = 0, z = 0;
    for (let c = 0; c < 3; c++) { x += p[idx[t + c] * 3] / 3; y += p[idx[t + c] * 3 + 1] / 3; z += p[idx[t + c] * 3 + 2] / 3; }
    assert.ok(Math.abs(y - terrain.groundY(x, z) - 0.15) < 1e-3, `piece ${t / 3} at ${x}, ${z}`);
  }
  // up normals tilt with the slope, the area is kept
  const nrm = lawn.attributes.normal.array;
  for (let k = 0; k < p.length; k += 3) {
    if (p[k] > 50 && p[k] < 110) assert.ok(nrm[k] > 0.2 && nrm[k + 1] < 0.98, 'tilted downhill on the slope');
    if (p[k] < 20) assert.equal(nrm[k + 1], 1, 'up on the plateau');
  }
  let area = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((s) => idx[t + s] * 3);
    area += Math.abs((p[b] - p[a]) * (p[c + 2] - p[a + 2]) - (p[c] - p[a]) * (p[b + 2] - p[a + 2])) / 2;
  }
  assert.ok(Math.abs(area - 121.4 * 41) < 0.5, `plan area ${area}`);

  const tiles = terrain.groundTiles(-40, -40, 200, 40, { tile: 120, skirt: { e: 1000 } });
  assert.equal(tiles.length, 2);
  const east = tiles[1].attributes.position.array;
  let far = -Infinity;
  for (let k = 0; k < east.length; k += 3) far = Math.max(far, east[k]);
  assert.equal(far, 1200, 'the skirt reaches out east');
  terrain.clearTerrain();
});
