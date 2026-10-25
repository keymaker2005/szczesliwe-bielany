import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { toPuwg92, fromWorld, readTiff, writePng } from '../tools/terrain-bielany.mjs';
import { toWorld } from '../tools/bielany-frame.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('Terrain tool: EPSG:2180 forward projection matches the corners used by the LoD1 and tree extracts', () => {
  // data/extract_bielany_trees.py: E0 = 629517 (north-west corner), N0 = 490141 (south-west), E1 = 635086 (south-east), N1 = 494513 (north-east)
  const [eNW] = toPuwg92(20.9, 52.3), [, nSW] = toPuwg92(20.9, 52.262), [eSE] = toPuwg92(20.98, 52.262), [, nNE] = toPuwg92(20.98, 52.3);
  for (const [got, want] of [[eNW, 629517], [nSW, 490141], [eSE, 635086], [nNE, 494513]]) assert.ok(Math.abs(got - want) < 1, `${got} vs ${want}`);
  // fromWorld is the inverse of the world frame
  const [lon, lat] = fromWorld(...toWorld(20.95, 52.29));
  assert.ok(Math.abs(lon - 20.95) < 1e-9 && Math.abs(lat - 52.29) < 1e-9);
});

test('Terrain tool: reads an uncompressed float32 GeoTIFF and writes a valid PNG', () => {
  // A 2 x 2 GeoTIFF as the GUGiK WCS returns it: tie point (E, N of the top-left corner), pixel scale, one strip
  const entries = [[256, 3, 1, 2], [257, 3, 1, 2], [258, 3, 1, 32], [259, 3, 1, 1], [273, 4, 1, 0], [279, 4, 1, 16], [339, 3, 1, 3], [33550, 12, 3, 0], [33922, 12, 6, 0]];
  const ifdAt = 8, ifdLen = 2 + entries.length * 12 + 4, scaleAt = ifdAt + ifdLen, tieAt = scaleAt + 24, dataAt = tieAt + 48;
  const buf = Buffer.alloc(dataAt + 16);
  buf.write('II', 0, 'latin1');
  buf.writeUInt16LE(42, 2);
  buf.writeUInt32LE(ifdAt, 4);
  buf.writeUInt16LE(entries.length, ifdAt);
  entries.forEach(([tag, type, count, value], k) => {
    const e = ifdAt + 2 + k * 12;
    buf.writeUInt16LE(tag, e);
    buf.writeUInt16LE(type, e + 2);
    buf.writeUInt32LE(count, e + 4);
    const v = tag === 273 ? dataAt : tag === 33550 ? scaleAt : tag === 33922 ? tieAt : value;
    if (type === 3) buf.writeUInt16LE(v, e + 8);
    else buf.writeUInt32LE(v, e + 8);
  });
  [2, 2, 0].forEach((v, k) => buf.writeDoubleLE(v, scaleAt + 8 * k));
  [0, 0, 0, 632000, 490400, 0].forEach((v, k) => buf.writeDoubleLE(v, tieAt + 8 * k));
  [101.5, 101.25, 80, 79.75].forEach((v, k) => buf.writeFloatLE(v, dataAt + 4 * k));
  const t = readTiff(buf);
  assert.deepEqual([t.width, t.height, t.e0, t.n0, t.sx, t.sy], [2, 2, 632000, 490400, 2, 2]);
  assert.deepEqual(Array.from(t.data), [101.5, 101.25, 80, 79.75]);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teren '));
  try {
    const file = path.join(dir, 'p.png');
    writePng(file, 3, 2, new Uint8Array(18).fill(200));
    const png = fs.readFileSync(file);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.toString('latin1', 12, 16), 'IHDR');
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [3, 2]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Terrain data: the 4 m grid covers the Phase 3 area and shows the Vistula escarpment', () => {
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'data/bielany_nmt_4m.json'), 'utf8'));
  const bin = fs.readFileSync(path.join(root, 'data/bielany_nmt_4m.bin'));
  assert.equal(bin.length, meta.nx * meta.nz * 2);
  assert.equal(meta.cell, 4);
  assert.equal(meta.stats.filled, 0, 'no holes in the model');
  const at = (x, z) => meta.base + bin.readUInt16LE((Math.round((z - meta.z0) / meta.cell) * meta.nx + Math.round((x - meta.x0) / meta.cell)) * 2) / 100;
  // The grid reaches the Skłodowska-Curie bridge (north) and the Vistula (east)
  const [bx, bz] = toWorld(20.952, 52.308), [vx, vz] = toWorld(20.9527, 52.3067);
  assert.ok(bx > meta.x0 && bz > meta.z0 && toWorld(20.995, 52.3)[0] <= meta.x0 + (meta.nx - 1) * meta.cell);
  // Plateau at the Stare Bielany station ~101 m, the river ~75 m, the valley below the escarpment ~20 m under the plateau
  const station = at(0, 0);
  assert.ok(station > 98 && station < 104, `station ${station}`);
  assert.ok(at(vx, vz) < 78, `Vistula ${at(vx, vz)}`);
  assert.ok(station - at(1828, -848) > 15, `valley east of the escarpment ${at(1828, -848)}`);
  assert.ok(meta.stats.min > 70 && meta.stats.max < 115, `heights ${meta.stats.min}-${meta.stats.max}`);
});
