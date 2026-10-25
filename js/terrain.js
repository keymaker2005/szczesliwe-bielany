// js/terrain.js
// The ground of Bielany (step 3.2): the plateau the city stands on is flat at y = 0, the Vistula escarpment drops from
// its edge to the valley up to 21 m below (Las Bielański, Kaskada, Młociny by the river). Heights come from the GUGiK
// terrain model, prepared by tools/terrain-bielany.mjs into js/bielany-terrain.bin (4 m grid in the world frame).
// Until loadTerrain/setTerrain runs the world is flat (the tests build modules without it), so every module asks
// groundY and works the same on a flat world.
//
// The surface is one triangulated grid of STEP m (every other point of the file's grid), each square split along the
// same diagonal. groundY answers exactly on it, and drapeGeometry cuts whatever it lays on the ground (the asphalt,
// lawns, curbs, sidewalks, paint, rails) along those grid lines, so all of them lie in the same planes: a lawn 15 cm
// above the asphalt stays 15 cm above it on any slope.

import * as THREE from 'three/webgpu';

const STEP = 8; // m between the surface's grid points
const BLOCK = 8; // grid squares per flag of the coarse "anything below the plateau here?" map
const T = { x0: 0, z0: 0, nx: 0, nz: 0, y: null, rough: null, bx: 0, bz: 0 };

/** Reads js/bielany-terrain.bin (an ArrayBuffer; format in tools/terrain-bielany.mjs encodeGameField) */
function setTerrain(buffer) {
  const v = new DataView(buffer);
  if (String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)) !== 'BTR1') throw new Error('not a BTR1 terrain file');
  const x0 = v.getFloat32(4, true), z0 = v.getFloat32(8, true), cell = v.getFloat32(12, true);
  const fnx = v.getUint32(16, true), fnz = v.getUint32(20, true);
  const every = Math.max(1, Math.round(STEP / cell));
  const nx = Math.floor((fnx - 1) / every) + 1, nz = Math.floor((fnz - 1) / every) + 1;
  const y = new Float32Array(nx * nz);
  let o = 24;
  for (let j = 0; j < fnz; j++) {
    const spans = v.getUint16(o, true);
    o += 2;
    for (let s = 0; s < spans; s++) {
      const i0 = v.getUint16(o, true), n = v.getUint16(o + 2, true);
      o += 4;
      if (j % every === 0) {
        for (let k = 0; k < n; k++) {
          const i = i0 + k;
          if (i % every === 0) y[(j / every) * nx + i / every] = v.getInt16(o + 2 * k, true) / 100;
        }
      }
      o += 2 * n;
    }
  }
  const bx = Math.ceil(nx / BLOCK), bz = Math.ceil(nz / BLOCK);
  const rough = new Uint8Array(bx * bz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) if (y[j * nx + i] !== 0) rough[Math.floor(j / BLOCK) * bx + Math.floor(i / BLOCK)] = 1;
  }
  Object.assign(T, { x0, z0, nx, nz, y, rough, bx, bz });
}

async function loadTerrain(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`terrain: HTTP ${res.status}`);
  setTerrain(await res.arrayBuffer());
}

function clearTerrain() {
  Object.assign(T, { nx: 0, nz: 0, y: null, rough: null });
}

const hasTerrain = () => T.y !== null;

/** Ground height (m, 0 on the plateau) at world (x, z), on the triangulated grid; held at its edge beyond it */
function groundY(x, z) {
  if (!T.y) return 0;
  const fx = Math.min(T.nx - 1, Math.max(0, (x - T.x0) / STEP));
  const fz = Math.min(T.nz - 1, Math.max(0, (z - T.z0) / STEP));
  const i = Math.min(T.nx - 2, Math.floor(fx)), j = Math.min(T.nz - 2, Math.floor(fz));
  const ax = fx - i, az = fz - j, k = j * T.nx + i, y = T.y;
  const a = y[k], b = y[k + 1], c = y[k + T.nx], d = y[k + T.nx + 1];
  if (a === 0 && b === 0 && c === 0 && d === 0) return 0;
  // the square's two triangles meet on the diagonal from (i + 1, j) to (i, j + 1)
  return ax + az <= 1 ? a + (b - a) * ax + (c - a) * az : d + (c - d) * (1 - ax) + (b - d) * (1 - az);
}

/** Up normal of the ground at (x, z) into `out` (a Vector3 or any {x, y, z}), smoothed over the neighbouring squares */
function groundNormal(x, z, out = new THREE.Vector3()) {
  const h = STEP;
  const dx = (groundY(x + h, z) - groundY(x - h, z)) / (2 * h);
  const dz = (groundY(x, z + h) - groundY(x, z - h)) / (2 * h);
  const l = Math.hypot(dx, 1, dz);
  out.x = -dx / l;
  out.y = 1 / l;
  out.z = -dz / l;
  return out;
}

/** True when the whole box [minX, maxX] x [minZ, maxZ] is plateau (y = 0), from the coarse map */
function flatIn(minX, minZ, maxX, maxZ) {
  if (!T.y) return true;
  const span = BLOCK * STEP;
  // beyond the grid the ground is held at its edge: the edge flags speak for it
  const clampI = (v) => Math.min(T.bx - 1, Math.max(0, v)), clampJ = (v) => Math.min(T.bz - 1, Math.max(0, v));
  const i0 = clampI(Math.floor((minX - T.x0) / span) - 1), i1 = clampI(Math.floor((maxX - T.x0) / span) + 1);
  const j0 = clampJ(Math.floor((minZ - T.z0) / span) - 1), j1 = clampJ(Math.floor((maxZ - T.z0) / span) + 1);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) if (T.rough[j * T.bx + i]) return false;
  }
  return true;
}

const flatNear = (x, z, r) => flatIn(x - r, z - r, x + r, z + r);

/**
 * A body standing on the ground at (x, z), facing (sin, cos) of its yaw (forward = +z local, left = +x local, as the
 * vehicles here): its height and the pitch & roll (radians, for rotation order 'YXZ') that lay it along the slope,
 * from the ground under its front & back (halfLen) and its two sides (halfWidth)
 */
function groundPose(x, z, sin, cos, halfLen, halfWidth, out = {}) {
  out.y = groundY(x, z);
  if (!T.y || (out.y === 0 && flatNear(x, z, Math.max(halfLen, halfWidth)))) {
    out.pitch = out.roll = 0;
    return out;
  }
  const front = groundY(x + sin * halfLen, z + cos * halfLen), back = groundY(x - sin * halfLen, z - cos * halfLen);
  const left = groundY(x + cos * halfWidth, z - sin * halfWidth), right = groundY(x - cos * halfWidth, z + sin * halfWidth);
  out.pitch = -Math.atan2(front - back, 2 * halfLen);
  out.roll = Math.atan2(left - right, 2 * halfWidth);
  return out;
}

// A convex polygon (vertices: Float32Arrays of every attribute) split by the line f(v) = 0 into its parts with f <= 0
// and f >= 0 (null when empty); new vertices on crossing edges carry every attribute interpolated
function splitPolygon(poly, f, width) {
  const neg = [], pos = [];
  const n = poly.length;
  for (let k = 0; k < n; k++) {
    const a = poly[k], b = poly[(k + 1) % n];
    const fa = f(a), fb = f(b);
    if (fa <= 1e-7) neg.push(a);
    if (fa >= -1e-7) pos.push(a);
    if ((fa < -1e-7 && fb > 1e-7) || (fa > 1e-7 && fb < -1e-7)) {
      const t = fa / (fa - fb), v = new Float32Array(width);
      for (let c = 0; c < width; c++) v[c] = a[c] + (b[c] - a[c]) * t;
      neg.push(v);
      pos.push(v);
    }
  }
  return [neg.length >= 3 ? neg : null, pos.length >= 3 ? pos : null];
}

// Cuts a convex polygon along a family of parallel grid lines g(v) = m for every integer m in (lo, hi); returns pieces
function cutAlong(polys, g, width) {
  const out = [];
  for (const poly of polys) {
    let lo = Infinity, hi = -Infinity;
    for (const v of poly) { const u = g(v); lo = Math.min(lo, u); hi = Math.max(hi, u); }
    let rest = poly;
    for (let m = Math.floor(lo) + 1; m < hi && rest; m++) {
      const [below, above] = splitPolygon(rest, (v) => g(v) - m, width);
      if (below) out.push(below);
      rest = above;
    }
    if (rest) out.push(rest);
  }
  return out;
}

/**
 * Lays world-space geometry on the ground: triangles over the valley are cut along the surface's grid lines and
 * diagonals (so every piece lies in one of its planes), every vertex rises or sinks by groundY under it, and upward
 * normals (lawns, paving, road paint) tilt with the slope. Triangles on the plateau stay as they are. `every` cuts on
 * every n-th grid line only (a coarser surface through the same points, for ground nothing stands on). Returns an
 * indexed geometry (the same one when there is nothing to do).
 */
function drapeGeometry(geo, { every = 1 } = {}) {
  if (!T.y) return geo;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (flatIn(bb.min.x, bb.min.z, bb.max.x, bb.max.z)) return geo;
  const src = geo.index ? geo.toNonIndexed() : geo;
  const names = Object.keys(src.attributes);
  const attrs = names.map((n) => src.attributes[n]);
  const sizes = attrs.map((a) => a.itemSize);
  const offs = sizes.map((_, m) => sizes.slice(0, m).reduce((s, n) => s + n, 0));
  const width = sizes.reduce((s, n) => s + n, 0);
  const P = offs[names.indexOf('position')];
  const N = names.includes('normal') ? offs[names.indexOf('normal')] : -1;
  const gx = (v) => (v[P] - T.x0) / (STEP * every), gz = (v) => (v[P + 2] - T.z0) / (STEP * every);
  const gd = (v) => gx(v) + gz(v);

  const tris = []; // three per triangle: a source vertex index (plateau, copied as it is) or a cut vertex
  const vert = (k) => {
    const v = new Float32Array(width);
    attrs.forEach((attr, m) => {
      for (let c = 0; c < sizes[m]; c++) v[offs[m] + c] = attr.array[k * sizes[m] + c];
    });
    return v;
  };
  const p = src.attributes.position.array;
  const count = src.attributes.position.count;
  for (let k = 0; k < count; k += 3) {
    const xa = p[k * 3], xb = p[k * 3 + 3], xc = p[k * 3 + 6], za = p[k * 3 + 2], zb = p[k * 3 + 5], zc = p[k * 3 + 8];
    if (flatIn(Math.min(xa, xb, xc), Math.min(za, zb, zc), Math.max(xa, xb, xc), Math.max(za, zb, zc))) {
      tris.push(k, k + 1, k + 2);
      continue;
    }
    const tri = [vert(k), vert(k + 1), vert(k + 2)];
    for (const piece of cutAlong(cutAlong(cutAlong([tri], gx, width), gz, width), gd, width)) {
      for (let t = 1; t + 1 < piece.length; t++) tris.push(piece[0], piece[t], piece[t + 1]);
    }
  }

  // shared vertices once: a source vertex by its index, a cut vertex by its identity (the pieces of a cut share them)
  const slot = new Map(), verts = [], index = new Uint32Array(tris.length);
  tris.forEach((v, k) => {
    let i = slot.get(v);
    if (i === undefined) { i = verts.length; verts.push(v); slot.set(v, i); }
    index[k] = i;
  });
  const arrays = attrs.map((attr, m) => new (attr.array.constructor)(verts.length * sizes[m]));
  const n3 = new THREE.Vector3();
  verts.forEach((v, k) => {
    if (typeof v === 'number') {
      attrs.forEach((attr, m) => arrays[m].set(attr.array.subarray(v * sizes[m], (v + 1) * sizes[m]), k * sizes[m]));
      return;
    }
    const x = v[P], z = v[P + 2], gy = groundY(x, z);
    const up = N >= 0 && gy !== 0 && v[N + 1] > 0.99;
    if (up) groundNormal(x, z, n3);
    attrs.forEach((attr, m) => {
      for (let c = 0; c < sizes[m]; c++) {
        let value = v[offs[m] + c];
        if (offs[m] + c === P + 1) value += gy;
        else if (up && offs[m] === N) value = c === 0 ? n3.x : c === 1 ? n3.y : n3.z;
        arrays[m][k * sizes[m] + c] = value;
      }
    });
  });
  const g = new THREE.BufferGeometry();
  names.forEach((n, m) => g.setAttribute(n, new THREE.BufferAttribute(arrays[m], sizes[m], attrs[m].normalized)));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * Ground surface over [minX, maxX] x [minZ, maxZ] (plan), in tiles of about `tile` m: two triangles where the tile is
 * plateau, cut along the surface's grid and laid on it elsewhere. `skirt` ({ w, e, n, s } m) pushes the outermost
 * edges on those sides further out at their heights, so the ground reaches the horizon without a step. Returns
 * BufferGeometries (position, normal), one per tile.
 */
function groundTiles(minX, minZ, maxX, maxZ, { tile = 256, skirt = {}, every = 1 } = {}) {
  const out = [];
  const nxT = Math.max(1, Math.ceil((maxX - minX) / tile)), nzT = Math.max(1, Math.ceil((maxZ - minZ) / tile));
  const tw = (maxX - minX) / nxT, td = (maxZ - minZ) / nzT;
  for (let tj = 0; tj < nzT; tj++) {
    for (let ti = 0; ti < nxT; ti++) {
      const ax = minX + ti * tw, az = minZ + tj * td, bx = ax + tw, bz = az + td;
      const quad = new THREE.BufferGeometry();
      // (ax, az) (ax, bz) (bx, az) and (bx, az) (ax, bz) (bx, bz): facing up
      quad.setAttribute('position', new THREE.Float32BufferAttribute([ax, 0, az, ax, 0, bz, bx, 0, az, bx, 0, az, ax, 0, bz, bx, 0, bz], 3));
      quad.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      quad.setIndex([0, 1, 2, 3, 4, 5]);
      const g = drapeGeometry(quad, { every });
      const sw = ti === 0 ? skirt.w || 0 : 0, se = ti === nxT - 1 ? skirt.e || 0 : 0;
      const sn = tj === 0 ? skirt.n || 0 : 0, ss = tj === nzT - 1 ? skirt.s || 0 : 0;
      if (sw || se || sn || ss) {
        const pos = g.attributes.position.array;
        for (let k = 0; k < pos.length; k += 3) {
          if (sw && pos[k] <= ax + 1e-3) pos[k] -= sw;
          if (se && pos[k] >= bx - 1e-3) pos[k] += se;
          if (sn && pos[k + 2] <= az + 1e-3) pos[k + 2] -= sn;
          if (ss && pos[k + 2] >= bz - 1e-3) pos[k + 2] += ss;
        }
        g.computeBoundingSphere();
      }
      out.push(g);
    }
  }
  return out;
}

export { STEP, setTerrain, loadTerrain, clearTerrain, hasTerrain, groundY, groundNormal, groundPose, flatIn, drapeGeometry, groundTiles };
