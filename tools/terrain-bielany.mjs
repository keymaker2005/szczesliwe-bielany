// tools/terrain-bielany.mjs
// Terrain of Bielany (step 3.1): the GUGiK digital terrain model (NMT, 1 m grid, heights in PL-KRON86-NH) fetched
// through its WCS at 2 m, resampled onto a 4 m grid in the world frame (tools/bielany-frame.mjs: x = east, z = south,
// origin at Stare Bielany) over the Phase 3 area (decision 1 of docs/plan-fazy-3.md: east to the Vistula, north to the
// Skłodowska-Curie bridge). Writes:
//   data/bielany_nmt_4m.bin   Uint16 little-endian, row-major (z, then x), centimetres above meta.base
//   data/bielany_nmt_4m.json  meta: grid origin, cell, size, base, stats, source
//   data/podglad_terenu.png   preview: height tint + hillshade, OSM cliffs in red, the current map area in white
//   js/bielany-terrain.bin    the game's ground (step 3.2, js/terrain.js): 0 on the plateau, the escarpment and the
//                             Vistula valley below it (see gameField)
// The raw tiles are cached in data/raw/nmt/ (not committed), so a second run works offline.
//
// usage: node tools/terrain-bielany.mjs [--offline]

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { ROOT, DATA, read, BOUNDS, toWorld } from './bielany-frame.mjs';

// Phase 3 area (WGS84), wider than BBOX until step 3.3 regenerates the map data for it
const BBOX3 = { s: 52.262, w: 20.9, n: 52.311, e: 20.995 };
const CELL = 4; // m, output grid
const FETCH = 2; // m, WCS resolution (SCALEFACTOR 0.5 of the 1 m model)
const TILE = 2000; // m, WCS request size in EPSG:2180
const WCS = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WCS/DigitalTerrainModelFormatTIFF';
const CACHE = path.join(ROOT, 'data/raw/nmt');
const PLATEAU = 96; // m a.s.l.: the game's ground level y = 0 (the escarpment's upper edge; the plateau lies 96-112 m)
const RIVER = 77; // m a.s.l.: cells below it are the Vistula, the seeds of the valley
const SMOOTH = 3; // cells: Gaussian blur radius (sigma 6 m) before the game field, so slopes have no 1 m bumps
const OUT = path.join(ROOT, 'data');

// EPSG:2180 (PUWG 1992): transverse Mercator on GRS80, central meridian 19°, k0 0.9993, E0 500 km, N0 -5300 km.
// Forward formulas after Snyder (Map Projections, 1987); the inverse lives in data/extract_bielany_trees.py.
const A = 6378137.0;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9993, LON0 = (19 * Math.PI) / 180, FE = 500000.0, FN = -5300000.0;

export function toPuwg92(lon, lat) {
  const phi = (lat * Math.PI) / 180;
  const s = Math.sin(phi), c = Math.cos(phi), t = Math.tan(phi);
  const n = A / Math.sqrt(1 - E2 * s * s);
  const T = t * t, C = EP2 * c * c, a = ((lon * Math.PI) / 180 - LON0) * c;
  const m = A * ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * phi
    - ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * phi)
    + ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * phi)
    - ((35 * E2 ** 3) / 3072) * Math.sin(6 * phi));
  const e = K0 * n * (a + ((1 - T + C) * a ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * EP2) * a ** 5) / 120);
  const north = K0 * (m + n * t * ((a * a) / 2 + ((5 - T + 9 * C + 4 * C * C) * a ** 4) / 24
    + ((61 - 58 * T + T * T + 600 * C - 330 * EP2) * a ** 6) / 720));
  return [FE + e, FN + north];
}

// World frame -> WGS84: the exact inverse of toWorld (a local tangent plane, linear in lon and lat)
const worldScale = (() => {
  const [x1] = toWorld(1, 0), [x0] = toWorld(0, 0);
  const [, z1] = toWorld(0, 1), [, z0] = toWorld(0, 0);
  return { kx: x1 - x0, kz: z1 - z0, lon0: -x0 / (x1 - x0), lat0: -z0 / (z1 - z0) };
})();
export const fromWorld = (x, z) => [worldScale.lon0 + x / worldScale.kx, worldScale.lat0 + z / worldScale.kz];

// The game's ground from the terrain model (heights a.s.l., nx x nz cells): the plateau stays flat at y = 0 (its few
// metres of slope over kilometres go unseen, and the city on it keeps its flat roads, curbs and traffic), the valley
// of the Vistula, flooded from the river over every smoothed cell under PLATEAU, sinks to its real depth below the
// escarpment's edge (y = height - PLATEAU, down to about -21 m at the water). Pits on the plateau that the valley
// does not reach (excavations, ponds, the moat of Fort Bema) stay flat.
export function gameField(h, nx, nz) {
  const r = SMOOTH, w = [];
  let sum = 0;
  for (let k = -r; k <= r; k++) { const v = Math.exp(-(k * k) / (2 * (r / 2) ** 2)); w.push(v); sum += v; }
  const pass = (src, dx, dy) => {
    const out = new Float32Array(src.length);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        let a = 0;
        for (let k = -r; k <= r; k++) {
          const ii = Math.min(nx - 1, Math.max(0, i + k * dx)), jj = Math.min(nz - 1, Math.max(0, j + k * dy));
          a += src[jj * nx + ii] * w[k + r];
        }
        out[j * nx + i] = a / sum;
      }
    }
    return out;
  };
  const hs = pass(pass(h, 1, 0), 0, 1);
  const valley = new Uint8Array(nx * nz);
  const stack = [];
  for (let k = 0; k < h.length; k++) if (h[k] < RIVER) { valley[k] = 1; stack.push(k); }
  while (stack.length) {
    const k = stack.pop(), i = k % nx, j = (k - i) / nx;
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const q = b * nx + a;
      if (!valley[q] && hs[q] < PLATEAU) { valley[q] = 1; stack.push(q); }
    }
  }
  const y = new Int16Array(nx * nz);
  for (let k = 0; k < y.length; k++) if (valley[k]) y[k] = Math.min(0, Math.round((hs[k] - PLATEAU) * 100));
  return y;
}

// js/bielany-terrain.bin: 'BTR1', float32 x0, z0, cell, uint32 nx, nz; then per row a uint16 count of spans, each
// span uint16 first column, uint16 length and that many int16 heights in cm (the cells outside every span are 0)
export function encodeGameField(y, { x0, z0, cell, nx, nz }) {
  const parts = [];
  const head = Buffer.alloc(24);
  head.write('BTR1', 0, 'latin1');
  head.writeFloatLE(x0, 4); head.writeFloatLE(z0, 8); head.writeFloatLE(cell, 12);
  head.writeUInt32LE(nx, 16); head.writeUInt32LE(nz, 20);
  parts.push(head);
  for (let j = 0; j < nz; j++) {
    const spans = [];
    for (let i = 0; i < nx;) {
      if (!y[j * nx + i]) { i++; continue; }
      let e = i;
      while (e < nx && y[j * nx + e]) e++;
      spans.push([i, e - i]);
      i = e;
    }
    const row = Buffer.alloc(2 + spans.reduce((s, [, n]) => s + 4 + 2 * n, 0));
    let o = row.writeUInt16LE(spans.length, 0);
    for (const [i0, n] of spans) {
      o = row.writeUInt16LE(i0, o);
      o = row.writeUInt16LE(n, o);
      for (let k = 0; k < n; k++) o = row.writeInt16LE(y[j * nx + i0 + k], o);
    }
    parts.push(row);
  }
  return Buffer.concat(parts);
}

// Minimal GeoTIFF reader for what the GUGiK WCS returns: one band, float32, uncompressed strips, a tie point and
// a pixel scale (GeoTIFF model space = EPSG:2180 easting, northing)
export function readTiff(buf) {
  const le = buf.toString('latin1', 0, 2) === 'II';
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const f64 = (o) => (le ? buf.readDoubleLE(o) : buf.readDoubleBE(o));
  const SIZE = { 3: 2, 4: 4, 12: 8 };
  const tags = {};
  const ifd = u32(4);
  for (let i = 0, n = u16(ifd); i < n; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
    const size = (SIZE[type] || 1) * count;
    const at = size <= 4 ? e + 8 : u32(e + 8);
    const one = (k) => (type === 3 ? u16(at + 2 * k) : type === 4 ? u32(at + 4 * k) : type === 12 ? f64(at + 8 * k) : buf[at + k]);
    tags[tag] = Array.from({ length: type === 2 ? 0 : count }, (_, k) => one(k));
  }
  const [width] = tags[256], [height] = tags[257];
  if (tags[258][0] !== 32 || tags[339]?.[0] !== 3 || tags[259][0] !== 1) throw new Error('expected an uncompressed float32 GeoTIFF');
  const data = new Float32Array(width * height);
  let px = 0;
  tags[273].forEach((off, k) => {
    const bytes = tags[279][k];
    for (let b = 0; b < bytes; b += 4, px++) data[px] = le ? buf.readFloatLE(off + b) : buf.readFloatBE(off + b);
  });
  const [, , , e0, n0] = tags[33922], [sx, sy] = tags[33550];
  return { width, height, data, e0, n0, sx, sy };
}

// Minimal PNG writer (RGB, 8 bit)
export function writePng(file, w, h, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4), sum = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    len.writeUInt32BE(data.length);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  const hdr = Buffer.alloc(13);
  hdr.writeUInt32BE(w, 0);
  hdr.writeUInt32BE(h, 4);
  hdr[8] = 8;
  hdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

async function fetchTile(e0, n0, offline) {
  const file = path.join(CACHE, `nmt_${FETCH}m_${e0}_${n0}.tif`);
  if (!fs.existsSync(file)) {
    if (offline) throw new Error(`missing cached tile ${file}`);
    const url = `${WCS}?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=DTM_PL-KRON86-NH_TIFF&FORMAT=image/tiff`
      + `&SUBSET=x(${e0},${e0 + TILE})&SUBSET=y(${n0},${n0 + TILE})&SCALEFACTOR=${1 / FETCH}`;
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'szczesliwe-bielany/1.0 (terrain tool)' } });
        const buf = Buffer.from(await res.arrayBuffer());
        if (!res.ok || buf.toString('latin1', 0, 2) !== 'II') throw new Error(`HTTP ${res.status}`);
        fs.writeFileSync(file, buf);
        break;
      } catch (err) {
        if (attempt >= 4) throw err;
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }
  return readTiff(fs.readFileSync(file));
}

async function main() {
  const offline = process.argv.includes('--offline');
  fs.mkdirSync(CACHE, { recursive: true });

  // Output grid: world-frame vertices every CELL m over the Phase 3 area
  const [wx0, wz1] = toWorld(BBOX3.w, BBOX3.s);
  const [wx1, wz0] = toWorld(BBOX3.e, BBOX3.n);
  const x0 = Math.floor(wx0 / CELL) * CELL, z0 = Math.floor(wz0 / CELL) * CELL;
  const nx = Math.ceil((wx1 - x0) / CELL) + 1, nz = Math.ceil((wz1 - z0) / CELL) + 1;

  // EPSG:2180 extent of the grid (the frames differ by ~1.5° of meridian convergence), tiles snapped to TILE
  let eMin = Infinity, eMax = -Infinity, nMin = Infinity, nMax = -Infinity;
  for (const [x, z] of [[x0, z0], [x0 + (nx - 1) * CELL, z0], [x0, z0 + (nz - 1) * CELL], [x0 + (nx - 1) * CELL, z0 + (nz - 1) * CELL]]) {
    const [e, n] = toPuwg92(...fromWorld(x, z));
    eMin = Math.min(eMin, e); eMax = Math.max(eMax, e); nMin = Math.min(nMin, n); nMax = Math.max(nMax, n);
  }
  const tiles = new Map();
  const te0 = Math.floor((eMin - 10) / TILE) * TILE, tn0 = Math.floor((nMin - 10) / TILE) * TILE;
  for (let e = te0; e < eMax + 10; e += TILE) {
    for (let n = tn0; n < nMax + 10; n += TILE) {
      tiles.set(`${e},${n}`, await fetchTile(e, n, offline));
      process.stdout.write('.');
    }
  }
  process.stdout.write('\n');

  // Bilinear sample of the 2 m model at an EPSG:2180 point (NaN where the model has no data)
  const sample = (e, n) => {
    const t = tiles.get(`${Math.floor(e / TILE) * TILE},${Math.floor(n / TILE) * TILE}`);
    if (!t) return NaN;
    const fx = (e - t.e0) / t.sx - 0.5, fy = (t.n0 - n) / t.sy - 0.5;
    const ix = Math.max(0, Math.min(t.width - 2, Math.floor(fx))), iy = Math.max(0, Math.min(t.height - 2, Math.floor(fy)));
    const ax = Math.min(1, Math.max(0, fx - ix)), ay = Math.min(1, Math.max(0, fy - iy));
    const v = (i, j) => t.data[j * t.width + i];
    const a = v(ix, iy), b = v(ix + 1, iy), c = v(ix, iy + 1), d = v(ix + 1, iy + 1);
    if (![a, b, c, d].every((h) => h > -100 && h < 1000)) return NaN;
    return (a * (1 - ax) + b * ax) * (1 - ay) + (c * (1 - ax) + d * ax) * ay;
  };

  const h = new Float32Array(nx * nz);
  let missing = 0;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const v = sample(...toPuwg92(...fromWorld(x0 + i * CELL, z0 + j * CELL)));
      if (Number.isNaN(v)) missing++;
      h[j * nx + i] = v;
    }
  }
  // Fill the rare holes from the nearest valid neighbour in the row (none expected inside Warsaw)
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      if (!Number.isNaN(h[j * nx + i])) continue;
      for (let d = 1; d < nx; d++) {
        const l = h[j * nx + i - d], r = h[j * nx + i + d];
        if (i - d >= 0 && !Number.isNaN(l)) { h[j * nx + i] = l; break; }
        if (i + d < nx && !Number.isNaN(r)) { h[j * nx + i] = r; break; }
      }
    }
  }

  const sorted = Float32Array.from(h).sort();
  const min = sorted[0], max = sorted[sorted.length - 1], median = sorted[sorted.length >> 1];
  const base = Math.floor(min) - 1;
  const bin = Buffer.alloc(nx * nz * 2);
  for (let k = 0; k < h.length; k++) bin.writeUInt16LE(Math.round((h[k] - base) * 100), k * 2);
  const at = (x, z) => h[Math.round((z - z0) / CELL) * nx + Math.round((x - x0) / CELL)];
  const meta = {
    version: 1,
    source: 'Numeryczny model terenu, GUGiK, geoportal.gov.pl (WCS NMT GRID1, wysokości PL-KRON86-NH), dane otwarte',
    frame: 'tools/bielany-frame.mjs (x = wschód, z = południe, początek przy stacji Stare Bielany)',
    bbox: BBOX3, cell: CELL, x0, z0, nx, nz, base, encoding: 'uint16 LE, cm above base, row-major z then x',
    stats: { min: +min.toFixed(2), max: +max.toFixed(2), median: +median.toFixed(2), station: +at(0, 0).toFixed(2), filled: missing },
  };
  fs.writeFileSync(path.join(OUT, 'bielany_nmt_4m.bin'), bin);
  fs.writeFileSync(path.join(OUT, 'bielany_nmt_4m.json'), JSON.stringify(meta, null, 2) + '\n');
  const field = gameField(h, nx, nz);
  const game = encodeGameField(field, { x0, z0, cell: CELL, nx, nz });
  fs.writeFileSync(path.join(ROOT, 'js/bielany-terrain.bin'), game);
  let low = 0;
  for (const v of field) if (v < 0) low++;

  // Preview, 8 m per pixel: hypsometric tint (valley green -> plateau ochre) with a north-west hillshade
  const S = 2, pw = Math.floor((nx - 1) / S), ph = Math.floor((nz - 1) / S);
  const rgb = new Uint8Array(pw * ph * 3);
  const stops = [[min, [70, 110, 150]], [min + 4, [110, 150, 95]], [median - 8, [150, 170, 105]], [median, [205, 190, 130]], [max, [235, 225, 210]]];
  const tint = (v) => {
    for (let k = 1; k < stops.length; k++) {
      if (v <= stops[k][0] || k === stops.length - 1) {
        const [a, ca] = stops[k - 1], [b, cb] = stops[k], f = Math.min(1, Math.max(0, (v - a) / (b - a || 1)));
        return ca.map((c, m) => c + (cb[m] - c) * f);
      }
    }
  };
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const i = x * S, j = y * S, v = h[j * nx + i];
      const dx = (h[j * nx + Math.min(nx - 1, i + 1)] - h[j * nx + Math.max(0, i - 1)]) / (2 * CELL);
      const dz = (h[Math.min(nz - 1, j + 1) * nx + i] - h[Math.max(0, j - 1) * nx + i]) / (2 * CELL);
      const shade = Math.max(0.35, Math.min(1.25, 0.85 + (dx + dz) * 1.6)); // light from the north-west
      const c = tint(v), o = (y * pw + x) * 3;
      for (let m = 0; m < 3; m++) rgb[o + m] = Math.max(0, Math.min(255, c[m] * shade));
    }
  }
  const plot = (x, z, col) => {
    const px = Math.round((x - x0) / (CELL * S)), py = Math.round((z - z0) / (CELL * S));
    if (px < 0 || py < 0 || px >= pw || py >= ph) return;
    rgb.set(col, (py * pw + px) * 3);
  };
  const line = (ax, az, bx, bz, col) => {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 4) + 1;
    for (let k = 0; k <= n; k++) plot(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, col);
  };
  const B = BOUNDS;
  for (const [a, b, c, d] of [[B.minX, B.minZ, B.maxX, B.minZ], [B.maxX, B.minZ, B.maxX, B.maxZ], [B.maxX, B.maxZ, B.minX, B.maxZ], [B.minX, B.maxZ, B.minX, B.minZ]]) line(a, b, c, d, [255, 255, 255]);
  const cliffs = path.join(DATA, 'osm_bielany_cliffs.json');
  let cliffCount = 0;
  if (fs.existsSync(cliffs)) {
    for (const w of read(cliffs).elements) {
      if (!w.geometry) continue;
      cliffCount++;
      const p = w.geometry.map((g) => toWorld(g.lon, g.lat));
      for (let k = 1; k < p.length; k++) line(p[k - 1][0], p[k - 1][1], p[k][0], p[k][1], [220, 30, 30]);
    }
  }
  for (let r = -6; r <= 6; r++) { plot(r * 4, 0, [0, 0, 0]); plot(0, r * 4, [0, 0, 0]); } // the Stare Bielany station
  writePng(path.join(OUT, 'podglad_terenu.png'), pw, ph, rgb);

  console.log(`grid ${nx} x ${nz} (${CELL} m), tiles ${tiles.size}, heights ${min.toFixed(1)}-${max.toFixed(1)} m (median ${median.toFixed(1)}), `
    + `station ${meta.stats.station} m, holes filled ${missing}, cliffs drawn ${cliffCount}; game field: valley `
    + `${((low * CELL * CELL) / 1e6).toFixed(2)} km², ${(game.length / 1e6).toFixed(2)} MB`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
