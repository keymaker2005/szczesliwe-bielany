// js/landmark-kit.js
// Small modelling kit for the landmarks (js/landmarks.js): every landmark is built from its footprint (GUGiK LoD1 or
// OpenStreetMap) in the frame of its oriented bounding box: u along the long side, v across it, the "front" the side
// facing the nearest street. Pieces: extruded footprints with facade textures in metres (windows, plaster, glass),
// boxes, gable & hip roofs, towers, domes, crosses, lettering on boards. Materials are cached by look.

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { nearestOnStreet } from './gps-route.js';

const toPts = (flat) => {
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ x: flat[i], z: flat[i + 1] });
  return out;
};

const ringArea = (pts) => {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += pts[j].x * pts[i].z - pts[i].x * pts[j].z;
  return s / 2;
};

// Oriented bounding box of a ring (the edge direction giving the smallest box): centre, unit axes u (long) and v,
// half sizes
function obbOf(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.5) continue;
    const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of pts) {
      const u = p.x * ux + p.z * uz, v = -p.x * uz + p.z * ux;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) best = { area, ux, uz, u0, u1, v0, v1 };
  }
  let { ux, uz, u0, u1, v0, v1 } = best;
  if (u1 - u0 < v1 - v0) { // u along the long side
    [ux, uz] = [-uz, ux];
    [u0, u1, v0, v1] = [v0, v1, -u1, -u0];
  }
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  return {
    cx: cu * ux - cv * uz, cz: cu * uz + cv * ux, ux, uz, vx: -uz, vz: ux,
    hu: (u1 - u0) / 2, hv: (v1 - v0) / 2,
  };
}

// A frame on the OBB: local (u, v) -> world (x, z); the front (+v) faces the nearest street
function frameOf(pts) {
  const o = obbOf(pts);
  const s = nearestOnStreet(o.cx, o.cz);
  if (s && (s.x - o.cx) * o.vx + (s.z - o.cz) * o.vz < 0) { // flip so +v points at the street
    o.ux = -o.ux; o.uz = -o.uz; o.vx = -o.vx; o.vz = -o.vz;
  }
  o.at = (u, v) => ({ x: o.cx + u * o.ux + v * o.vx, z: o.cz + u * o.uz + v * o.vz });
  o.yaw = Math.atan2(-o.uz, o.ux); // rotation about y that turns local +x into u
  return o;
}

// ------------------------------------------------------------------------------------------------------------------
// Textures: facades drawn on a canvas, repeated per metre-scaled uv
// ------------------------------------------------------------------------------------------------------------------
const texCache = new Map();
/**
 * A facade tile `w` × `h` metres: wall colour, a window (ww × wh m, sill at sill m) in its middle with a frame, an
 * optional band (plinth stripe at the bottom) — repeated along walls.
 */
function facadeTexture({ wall = '#e8e1d0', win = '#3d4a57', frame = '#f4f1ea', w = 3, h = 3.2, ww = 1.4, wh = 1.6, sill = 0.9, band = null, glass = false, mullion = 0 }) {
  const key = JSON.stringify(arguments[0]);
  if (texCache.has(key)) return texCache.get(key);
  const px = 64; // per metre
  const c = document.createElement('canvas');
  c.width = Math.round(w * px / 4) * 4;
  c.height = Math.round(h * px / 4) * 4;
  const g = c.getContext('2d');
  g.fillStyle = wall;
  g.fillRect(0, 0, c.width, c.height);
  if (glass) {
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, win);
    grad.addColorStop(1, '#6f8597');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = frame;
    for (let x = 0; x <= c.width; x += (mullion || 1.5) * px) g.fillRect(x - 2, 0, 4, c.height);
    g.fillRect(0, c.height - 4, c.width, 4);
  } else if (ww > 0) {
    const x0 = (w - ww) / 2 * px, y0 = (h - sill - wh) * px;
    g.fillStyle = frame;
    g.fillRect(x0 - 5, y0 - 5, ww * px + 10, wh * px + 10);
    g.fillStyle = win;
    g.fillRect(x0, y0, ww * px, wh * px);
    if (mullion) {
      g.fillStyle = frame;
      g.fillRect(x0 + ww * px / 2 - 2, y0, 4, wh * px);
      g.fillRect(x0, y0 + wh * px * 0.35, ww * px, 3);
    }
  }
  if (band) {
    g.fillStyle = band;
    g.fillRect(0, c.height - 6, c.width, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / w, 1 / h);
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

const matCache = new Map();
function mat(look) {
  const o = typeof look === 'object' && !(look instanceof THREE.Texture) ? look : { color: look };
  const key = JSON.stringify({ ...o, map: o.map ? o.map.uuid : undefined });
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardNodeMaterial({
    color: o.map ? 0xffffff : (o.color ?? 0xdddddd), map: o.map || null, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0,
    side: o.double ? THREE.DoubleSide : THREE.FrontSide, transparent: !!o.opacity, opacity: o.opacity ?? 1,
  });
  matCache.set(key, m);
  return m;
}

// Lettering on a board (both sides): text in the given colours, the board w × h metres
function signGeometryMaterial(text, { w, h, bg = '#ffffff', fg = '#1b2a4a', font = '700', serif = false }) {
  const px = 96;
  const c = document.createElement('canvas');
  c.width = Math.min(4096, Math.round(w * px));
  c.height = Math.round(h * px);
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
  }
  g.fillStyle = fg;
  let size = c.height * 0.72;
  const family = serif ? 'Georgia, "Times New Roman", serif' : '"Inter", "Helvetica Neue", Arial, sans-serif';
  g.font = `${font} ${size}px ${family}`;
  while (g.measureText(text).width > c.width * 0.92 && size > 8) {
    size *= 0.92;
    g.font = `${font} ${size}px ${family}`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + size * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const m = new THREE.MeshStandardNodeMaterial({ map: t, roughness: 0.6, transparent: !bg, side: THREE.DoubleSide, alphaTest: bg ? 0 : 0.4 });
  return { geometry: new THREE.PlaneGeometry(w, h), material: m };
}

// ------------------------------------------------------------------------------------------------------------------
// Builder: collects geometry per material and merges it into one mesh per material at the end
// ------------------------------------------------------------------------------------------------------------------
class Builder {
  constructor(name) {
    this.group = new THREE.Group();
    this.group.name = name;
    this.parts = new Map(); // material -> geometries
  }

  add(geo, material) {
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(geo);
    return geo;
  }

  mesh(geo, material) { // a mesh of its own (signs, transparent pieces)
    const m = new THREE.Mesh(geo, material);
    m.castShadow = !material.transparent;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  /**
   * Walls (and a flat top) of a ring from y0 to y1; uv in metres (along the walls, height) for facade textures. inset
   * shrinks the ring towards its centroid (setbacks, upper storeys).
   */
  prism(pts, y0, y1, wallMat, topMat = null, { inset = 0 } = {}) {
    let ring = pts;
    if (ringArea(ring) < 0) ring = ring.slice().reverse(); // counter-clockwise in x/(-z)... keep outward normals
    if (inset) {
      let cx = 0, cz = 0;
      for (const p of ring) { cx += p.x; cz += p.z; }
      cx /= ring.length; cz /= ring.length;
      ring = ring.map((p) => {
        const d = Math.hypot(p.x - cx, p.z - cz) || 1;
        const k = Math.max(0, (d - inset) / d);
        return { x: cx + (p.x - cx) * k, z: cz + (p.z - cz) * k };
      });
    }
    const pos = [], nrm = [], uv = [];
    let run = 0;
    // which way round: outward normal (ez, -ex) for counter-clockwise rings in x/z as GEO stores them
    const sign = ringArea(ring) > 0 ? 1 : -1;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.02) continue;
      const ex = (b.x - a.x) / len, ez = (b.z - a.z) / len;
      const nx = ez * sign, nz = -ex * sign;
      const quad = [[a, y0, run], [b, y0, run + len], [b, y1, run + len], [a, y1, run]];
      const order = sign > 0 ? [0, 3, 1, 1, 3, 2] : [0, 1, 3, 1, 2, 3];
      for (const k of order) {
        const [p, y, s] = quad[k];
        pos.push(p.x, y, p.z);
        nrm.push(nx, 0, nz);
        uv.push(s, y);
      }
      run += len;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.add(g, wallMat);
    if (topMat) {
      const shape = new THREE.Shape(ring.map((p) => new THREE.Vector2(p.x, -p.z)));
      const cap = new THREE.ShapeGeometry(shape, 1);
      cap.rotateX(-Math.PI / 2);
      cap.translate(0, y1, 0);
      this.add(cap, topMat);
    }
    return ring;
  }

  // A box w (along u) × d (along v) × h, its base centre at local (u, v) of frame f, y0 up, turned by extra yaw
  box(f, u, v, w, d, h, y0, material, yaw = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    // box uv in metres on its sides (for facade textures)
    const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
      const s = ax > 0.5 ? p.getZ(i) + d / 2 : ay > 0.5 ? p.getX(i) + w / 2 : p.getX(i) + w / 2;
      t.setXY(i, s, p.getY(i) + h / 2 + y0);
    }
    g.translate(0, y0 + h / 2, 0);
    this.place(g, f, u, v, yaw);
    return this.add(g, material);
  }

  // Moves a geometry built round the origin (x along u, z along v) to local (u, v) of frame f
  place(g, f, u, v, yaw = 0) {
    g.rotateY(f.yaw + yaw);
    const w = f.at(u, v);
    g.translate(w.x, 0, w.z);
    return g;
  }

  // Gable roof over a w × d rectangle (ridge along u), eaves at y0, ridge rise r, overhang o
  gable(f, u, v, w, d, y0, r, material, { o = 0.4, yaw = 0 } = {}) {
    const hw = w / 2 + o, hd = d / 2 + o;
    const v3 = [
      -hw, y0, -hd, hw, y0, -hd, hw, y0 + r, 0, -hw, y0 + r, 0, // back slope
      -hw, y0, hd, -hw, y0 + r, 0, hw, y0 + r, 0, hw, y0, hd, // front slope
      -hw, y0, -hd, -hw, y0 + r, 0, -hw, y0, hd, // gable ends
      hw, y0, -hd, hw, y0, hd, hw, y0 + r, 0,
    ];
    const idx = [0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6, 8, 9, 10, 11, 12, 13];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v3, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const ng = g.toNonIndexed();
    ng.computeVertexNormals();
    this.place(ng, f, u, v, yaw);
    return this.add(ng, material);
  }

  // Hip roof (a flattened pyramid) over w × d at y0, rise r
  hip(f, u, v, w, d, y0, r, material, { o = 0.4, yaw = 0, ridge = 0.5 } = {}) {
    const hw = w / 2 + o, hd = d / 2 + o, rr = Math.max(0, hw - hd) * ridge + 0.01;
    const P = [[-hw, y0, -hd], [hw, y0, -hd], [hw, y0, hd], [-hw, y0, hd], [-rr, y0 + r, 0], [rr, y0 + r, 0]];
    const tri = [[0, 5, 1], [0, 4, 5], [3, 2, 5], [3, 5, 4], [0, 3, 4], [1, 5, 2]];
    const pos = [];
    for (const t of tri) for (const k of t) pos.push(...P[k]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    this.place(g, f, u, v, yaw);
    return this.add(g, material);
  }

  cylinder(f, u, v, r, h, y0, material, { r1 = r, seg = 20, open = false } = {}) {
    const g = new THREE.CylinderGeometry(r1, r, h, seg, 1, open);
    g.translate(0, y0 + h / 2, 0);
    this.place(g, f, u, v);
    return this.add(g, material);
  }

  // Half sphere (or an onion-ish dome with squash > 1) of radius r on y0
  dome(f, u, v, r, y0, material, { squash = 1 } = {}) {
    const g = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, squash, 1);
    g.translate(0, y0, 0);
    this.place(g, f, u, v);
    return this.add(g, material);
  }

  cone(f, u, v, r, h, y0, material, seg = 8) {
    const g = new THREE.ConeGeometry(r, h, seg);
    g.translate(0, y0 + h / 2, 0);
    this.place(g, f, u, v);
    return this.add(g, material);
  }

  // A Latin cross h high at y0 facing along v
  cross(f, u, v, h, y0, material) {
    this.box(f, u, v, h * 0.12, h * 0.12, h, y0, material);
    this.box(f, u, v, h * 0.6, h * 0.12, h * 0.12, y0 + h * 0.62, material);
  }

  // Lettering on the front of frame f at local (u, v), centre height y, facing +v (outwards), lifted 5 cm
  sign(f, text, u, v, y, opts, yaw = 0) {
    const { geometry, material } = signGeometryMaterial(text, opts);
    const m = this.mesh(geometry, material);
    const w = f.at(u, v + 0.06);
    m.position.set(w.x, y, w.z);
    m.rotation.y = f.yaw + yaw;
    m.castShadow = false;
    return m;
  }

  // Merges everything per material into meshes
  finish() {
    for (const [material, geos] of this.parts) {
      const g = mergeGeometries(geos.map((x) => (x.index ? x.toNonIndexed() : x)).map((x) => {
        for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
        if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
        return x;
      }), false);
      const m = new THREE.Mesh(g, material);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }
    this.parts.clear();
    return this.group;
  }
}

export { Builder, frameOf, obbOf, toPts, ringArea, facadeTexture, mat };
