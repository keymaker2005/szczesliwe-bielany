// js/landmarks.js
// Landmarks of Bielany, modelled after photographs (docs/landmarki-referencje.md: Wikimedia Commons, Wikipedia; no
// Google imagery) on their real footprints: Galeria Młociny, the M1 station pavilions (Stare Bielany, Wawrzyszew,
// Młociny), AWF with its tower, UKSW Dewajtis, Szpital Bielański, the church of St Sigismund with its bell tower, the
// old church of St Mary Magdalene in Wawrzyszew and the Camaldolese church in Las Bielański. Their LoD1 blocks are
// left out of js/buildings.js (landmarkBuildingIds) but keep their colliders there; the Camaldolese church, outside
// the LoD1 cut, brings its own. Real names stay; no company logos (the metro sign is a plain "M" on a blue square, not
// the operator's emblem), tenant signs are fictional.
//
// bryantParkLawn: a raised lawn the controllers and cameras stand players on (New York's Bryant Park). Bielany has
// none, so it is null (both modules check for that).

import * as THREE from 'three/webgpu';
import { GEO } from './bielany-geodata.js';
import { Builder, frameOf, toPts, facadeTexture, mat } from './landmark-kit.js';
import { groundY } from './terrain.js';

const bryantParkLawn = null;

// Each landmark's LoD1 blocks: the buildings (GEO.buildings) under these points of the world frame
const POINTS = {
  galeria: [[-1294.7, -1444.6]],
  stareBielany: [[60, 46.5], [-60.8, -44.8]],
  wawrzyszew: [[-728.3, -546.6], [-610.9, -459.8]],
  mlociny: [[-1281.1, -958.3], [-1378.6, -1034]],
  awf: [[616.2, -416.4], [653.7, -377.5]],
  uksw: [[667.4, -1593.7]],
  szpital: [[111.8, -529.9], [68, -614], [73, -560], [136, -493]],
  zygmunt: [[-187.1, 282.4]],
  magdalena: [[-1384.1, 121]],
};
// The rest of the AWF campus and of the Dewajtis campus with the Camaldolese hermitages: buildings whose middle lies
// in these boxes (x0, z0, x1, z1), east of the MVP strip of Faza 1
const CAMPUS = { awf: [727, -631, 1000, -75], uksw: [727, -1800, 1000, -1299] };

// The Camaldolese church (OpenStreetMap way 173130486; its LoD1 block is replaced): footprint in the world frame
const KAMEDULY_RING = [711.7, -1575, 713.2, -1577.9, 715.6, -1576.6, 716.9, -1579.7, 720.3, -1577.1, 724, -1576.7, 725.4, -1578.5,
  728.2, -1577.3, 729.1, -1579.4, 730.1, -1579.7, 737.6, -1575.7, 737.9, -1574.8, 736.6, -1572.5, 738.9, -1571.1, 738.1, -1569, 740,
  -1566.2, 743.4, -1564.5, 744.6, -1567.1, 745.6, -1567.3, 754.7, -1561.8, 746.6, -1547.7, 743.2, -1541.6, 733.9, -1546.9, 735.5, -1550,
  732.9, -1551.6, 728.7, -1552, 727.4, -1550.2, 725, -1551.5, 723.7, -1549.3, 722.8, -1549, 715.1, -1553, 716.3, -1556.3, 714, -1557.5,
  714.8, -1558.7, 714.5, -1560, 712.4, -1562.6, 708.5, -1564.1, 710.1, -1566.5, 708.1, -1568, 709.7, -1571.1, 711, -1570.9, 712.7, -1574.5];

const WALL_T = 1.2; // m, as js/buildings.js

const inRing = (x, z, r) => {
  let c = false;
  for (let k = 0, m = r.length - 2; k < r.length; m = k, k += 2) {
    if ((r[k + 1] > z) !== (r[m + 1] > z) && x < ((r[m] - r[k]) * (z - r[k + 1])) / (r[m + 1] - r[k + 1]) + r[k]) c = !c;
  }
  return c;
};
const centroid = (r) => {
  let x = 0, z = 0;
  for (let k = 0; k < r.length; k += 2) { x += r[k]; z += r[k + 1]; }
  return [x / (r.length / 2), z / (r.length / 2)];
};
// The building under a point, else the one whose middle is nearest (within 30 m)
function buildingAt(x, z) {
  let best = -1, bd = 30;
  for (let i = 0; i < GEO.buildings.length; i++) {
    const r = GEO.buildings[i][0];
    if (inRing(x, z, r)) return i;
    const [cx, cz] = centroid(r);
    const d = Math.hypot(cx - x, cz - z);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

let resolved = null;
function resolve() {
  if (resolved) return resolved;
  const IDS = {};
  for (const [name, pts] of Object.entries(POINTS)) IDS[name] = pts.map(([x, z]) => buildingAt(x, z)).filter((i) => i >= 0);
  const taken = new Set(Object.values(IDS).flat());
  // the Camaldolese church's own LoD1 block(s), replaced by the model
  const church = new Set();
  for (let i = 0; i < GEO.buildings.length; i++) {
    const [cx, cz] = centroid(GEO.buildings[i][0]);
    if (inRing(cx, cz, KAMEDULY_RING)) church.add(i);
  }
  const campus = { awf: [], uksw: [] };
  for (let i = 0; i < GEO.buildings.length; i++) {
    if (taken.has(i) || church.has(i)) continue;
    const [cx, cz] = centroid(GEO.buildings[i][0]);
    for (const [area, [x0, z0, x1, z1]] of Object.entries(CAMPUS)) {
      if (cx >= x0 && cx <= x1 && cz >= z0 && cz <= z1) campus[area].push(i);
    }
  }
  resolved = { IDS, church, campus };
  return resolved;
}

function landmarkBuildingIds() {
  const { IDS, church, campus } = resolve();
  return new Set([...Object.values(IDS).flat(), ...church, ...campus.awf, ...campus.uksw]);
}

const ringOf = (id) => toPts(GEO.buildings[id][0]);
const heightOf = (id) => GEO.buildings[id][2];

// Colliders for a ring without a LoD1 block (the format of js/buildings.js)
function pushColliders(ring, h, out) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.3) continue;
    const ex = (b.x - a.x) / len, ez = (b.z - a.z) / len;
    const cx = (a.x + b.x) / 2 - ez * WALL_T / 2, cz = (a.z + b.z) / 2 + ex * WALL_T / 2;
    const hx = len / 2 + 0.05, hz = WALL_T / 2;
    const rx = Math.abs(ex) * hx + Math.abs(ez) * hz, rz = Math.abs(ez) * hx + Math.abs(ex) * hz;
    out.push({ minX: cx - rx, maxX: cx + rx, minZ: cz - rz, maxZ: cz + rz, minY: 0, maxY: h, obb: { cx, cz, hx, hz, cs: ex, sn: -ez } });
  }
}

// ----------------------------------------------------------------------------------------------------------------
// Looks
// ----------------------------------------------------------------------------------------------------------------
const LOOK = {
  roofGrey: mat({ color: 0x8e8f8c, rough: 0.95 }),
  white: mat({ color: 0xf1f0ea, rough: 0.8 }),
  steel: mat({ color: 0x8c8f92, rough: 0.5, metal: 0.6 }),
  darkGlass: mat({ color: 0x25282c, rough: 0.15, metal: 0.5 }),
  copper: mat({ color: 0x6f9a86, rough: 0.6, metal: 0.3 }),
  domeCopper: mat({ color: 0x7fa592, rough: 0.55, metal: 0.35 }),
  gold: mat({ color: 0xd8b04a, rough: 0.35, metal: 0.8 }),
  tile: mat({ color: 0xa8432a, rough: 0.85 }),
  graphite: mat({ color: 0x4b4f55, rough: 0.7, metal: 0.2 }),
  concrete: mat({ color: 0xa9a69d, rough: 0.95 }),
  shingle: mat({ color: 0x5b5548, rough: 0.95 }),
  wood: mat({ color: 0xc9925a, rough: 0.9 }),
  green: mat({ color: 0x5f7f3a, rough: 0.95 }),
  rust: mat({ color: 0x8a3b22, rough: 0.8, metal: 0.2 }),
  milky: mat({ color: 0xe8ecef, rough: 0.3, opacity: 0.85 }),
};

// Metal panel stripes of Galeria Młociny: light grey, silver, graphite, narrow dark windows between
function galeriaTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256; // 8 m × 4 m
  const g = c.getContext('2d');
  const tones = ['#c9c9c6', '#a8a9a8', '#3d3f42', '#c9c9c6', '#a8a9a8', '#c9c9c6', '#3d3f42', '#a8a9a8'];
  tones.forEach((t, i) => { g.fillStyle = t; g.fillRect(i * 64, 0, 64, 256); });
  g.fillStyle = '#25282c';
  for (const x of [52, 180, 300, 436]) g.fillRect(x, 40, 10, 170);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 8, 1 / 4);
  return t;
}

// Gabions (stone-filled steel cages) of the Młociny pavilions; autumn creepers on the Wawrzyszew mesh
function noiseTexture(base, spots, mesh, w, h, seed = 1) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = spots[Math.floor(rnd() * spots.length)];
    const r = 3 + rnd() * 9;
    g.beginPath();
    g.ellipse(rnd() * 256, rnd() * 256, r, r * (0.6 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  if (mesh) {
    g.strokeStyle = mesh;
    g.lineWidth = 3;
    for (let x = 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
    for (let y = 0; y <= 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / w, 1 / h);
  return t;
}

// The station name board under a metro sign
function stationBoard(b, f, u, v, name) {
  b.sign(f, name, u, v, 2.6, { w: 3, h: 0.45, bg: '#1f3a8a', fg: '#ffffff', font: '700' });
}

// ----------------------------------------------------------------------------------------------------------------
// The landmarks
// ----------------------------------------------------------------------------------------------------------------
// Galeria Młociny (photo: Commons "2019 Warszawa Galeria Młociny, 2"): a long body of vertical metal panel stripes on
// a glazed ground floor, a dark glass band with louvres under the roof, at the entrance corner two stacked oval drums
// (the lower one dark glass, the upper one striped and overhanging), the name over the glazed entrance and the big
// rust letters "Młociny" spread over the plaza; tenant boards with fictional names
function galeria(b) {
  const { IDS } = resolve();
  const id = IDS.galeria[0], ring = ringOf(id), h = heightOf(id);
  const f = frameOf(ring);
  const panels = mat({ map: galeriaTexture(), rough: 0.45, metal: 0.4 });
  const shopfront = mat({ map: facadeTexture({ glass: true, win: '#2b3036', frame: '#9a9c9e', w: 6, h: 8, mullion: 3 }), rough: 0.15, metal: 0.4 });
  const louvred = mat({ map: facadeTexture({ glass: true, win: '#22262b', frame: '#5d6166', w: 4, h: 4, mullion: 4, louvres: 0.6 }), rough: 0.25, metal: 0.5 });
  const dark = mat({ color: 0x2a2c30, rough: 0.5, metal: 0.3 });
  b.prism(ring, 0, 8, shopfront);
  b.prism(ring, 8, h - 5, panels);
  b.prism(ring, h - 5, h - 0.6, louvred);
  b.prism(ring, h - 0.6, h + 0.4, dark, LOOK.roofGrey);
  // the entrance corner (towards the Młociny hub, north-east) and the far end
  const ne = f.at(f.hu, 0).z < f.at(-f.hu, 0).z ? 1 : -1;
  const rA = Math.min(26, f.hv * 0.5), rB = rA + 3.5, dv = f.hv - rA * 0.75; // the drums stand out of the front
  const cu = ne * (f.hu - rA * 1.25);
  b.cylinder(f, cu, dv, rA, 4.5, 8, louvred, { seg: 40, su: 1.3, uvScale: 1 });
  b.cylinder(f, cu, dv + 1.5, rB, 1.6, 12.5, mat({ color: 0x1f2226, rough: 0.2, metal: 0.6 }), { seg: 40, su: 1.25, uvScale: 1 });
  b.cylinder(f, cu, dv + 1.5, rB, h + 4 - 14.1, 14.1, panels, { seg: 40, su: 1.25, uvScale: 1 });
  b.cylinder(f, cu, dv + 1.5, rB + 0.3, 0.5, h + 4, dark, { seg: 40, su: 1.25 });
  b.cylinder(f, cu, dv + 1.5, rB - 4, 3, h + 4.5, LOOK.roofGrey, { seg: 24, su: 1.2 }); // the plant room on top
  b.cylinder(f, -ne * (f.hu - f.hv * 0.5), 0, f.hv * 0.6, h + 1.5, 0, panels, { seg: 32, su: 1.2, uvScale: 1 });
  // roof garden: lawns and shrubs, plant rooms
  for (let k = -3; k <= 2; k++) {
    b.box(f, k * f.hu * 0.16, 0, f.hu * 0.11, f.hv * 0.9, 0.5, h + 0.4, LOOK.green);
    for (const dv of [-0.25, 0.25]) b.cone(f, k * f.hu * 0.16, dv * f.hv, 1.6, 3.2, h + 0.9, mat({ color: 0x6d8a3e, rough: 1 }), 7);
  }
  b.box(f, -ne * f.hu * 0.55, 0, 22, 14, 4, h + 0.4, mat({ color: 0x9a9c9e, rough: 0.6, metal: 0.4 }));
  // the glazed double-height entrance on the front with the name on a dark fascia
  const eu = cu - ne * (rA * 1.3 + 16);
  b.box(f, eu, f.hv + 1.5, 26, 3, 9, 0, mat({ map: facadeTexture({ glass: true, win: '#263038', frame: '#b5b8bb', w: 2.6, h: 9, mullion: 1.3 }), rough: 0.1, metal: 0.5 }));
  b.box(f, eu, f.hv + 1.6, 27, 3.4, 2.6, 9, dark);
  b.sign(f, 'Galeria Młociny', eu, f.hv + 3.35, 10.3, { w: 18, h: 1.9, bg: null, fg: '#ffffff', font: '600' });
  // the rust letters on the plaza, each its own block, spread out
  const word = 'Młociny';
  [...word].forEach((ch, i) => {
    const lu = eu + ne * (i - 3) * 6.5;
    b.letters(f, ch, lu, f.hv + 16 + (i % 2) * 1.5, 1.5, { w: 2.6, h: 3, bg: null, fg: '#8a3b22', font: '800' }, (i % 3 - 1) * 0.12, 0.4);
  });
  b.box(f, eu, f.hv + 14, 70, 26, 0.06, 0, mat({ color: 0xb5b3ad, rough: 0.95 })); // the paved plaza
  // tenant boards (fictional names) on the upper drum and the long front
  const tenants = ['DOM MODY WISŁA', 'Księgarnia Kartka', 'Sport Bielany', 'Kawiarnia Pod Kasztanem', 'Apteka Na Rogu', 'Obuwie Krok'];
  tenants.forEach((name, i) => b.sign(f, name, cu - ne * 3, dv + 1.5 + rB + 0.25, 22 - i * 1.6, { w: 11, h: 1.3, bg: null, fg: '#f2f2f0', font: '700' }));
  b.box(f, cu - ne * 3, dv + 1.5 + rB - 0.4, 13, 0.6, 10.5, 12.6, dark);
  ['Market Wawrzyszew', 'Moda Młociny', 'Elektro Bielany'].forEach((name, i) => b.sign(f, name, (-0.45 + i * 0.25) * f.hu * ne, f.hv + 0.1, 9.6, { w: 12, h: 1.4, bg: '#2a2c30', fg: '#f2f2f0' }));
}

// Stare Bielany (photo: Commons, ul. Kasprowicza 2010): low glass pavilions with steel mullions under a thick dark
// roof slab overhanging by ~2 m, the metro sign on a post by the entrance
function stareBielany(b) {
  const glass = mat({ map: facadeTexture({ glass: true, win: '#4a5560', frame: '#5f6468', w: 3, h: 3.6, mullion: 1.2 }), rough: 0.1, metal: 0.5 });
  const slab = mat({ color: 0x55595e, rough: 0.6, metal: 0.3 });
  for (const id of resolve().IDS.stareBielany) {
    const ring = ringOf(id), h = heightOf(id), f = frameOf(ring);
    b.prism(ring, 0, h - 0.9, glass);
    b.box(f, 0, 0, f.hu * 2 + 4.5, f.hv * 2 + 4.5, 0.9, h - 0.9, slab);
    b.box(f, 0, 0, f.hu * 2 + 4.7, f.hv * 2 + 4.7, 0.25, h - 0.15, mat({ color: 0x3d4146, rough: 0.6 }));
    for (const s of [-1, 1]) b.cylinder(f, s * (f.hu + 1.7), f.hv + 1.7, 0.14, h - 0.9, 0, LOOK.steel, { seg: 10 });
    b.box(f, f.hu * 0.35, f.hv + 0.05, 4, 0.2, 2.6, 0, mat({ color: 0x1c2024, rough: 0.2, metal: 0.4 })); // the doors
    b.metro(f, f.hu * 0.35 + 4, f.hv + 3);
    stationBoard(b, f, f.hu * 0.35, f.hv + 2.4, 'Stare Bielany');
  }
}

function wawrzyszew(b) {
  const creeper = mat({ map: noiseTexture('#5b2a22', ['#a3271f', '#c23b23', '#7d1f19', '#d0602a', '#4f6b2e'], '#6e7276', 2, 2, 7), rough: 0.95 });
  for (const id of resolve().IDS.wawrzyszew) {
    const ring = ringOf(id), h = heightOf(id), f = frameOf(ring);
    b.prism(ring, 0, h - 0.4, creeper);
    // the steel pergola roof, overhanging, with cross slats on slender columns
    b.box(f, 0, 0, f.hu * 2 + 3, f.hv * 2 + 3, 0.25, h - 0.4, LOOK.steel);
    const n = Math.round((f.hu * 2 + 3) / 1.2);
    for (let k = 0; k <= n; k++) b.box(f, -f.hu - 1.5 + k * 1.2, 0, 0.12, f.hv * 2 + 3, 0.5, h - 0.15, mat({ color: 0x6e7276, rough: 0.6, metal: 0.5 }));
    for (const s of [-1, 1]) for (const t of [-1, 1]) b.cylinder(f, s * (f.hu + 1.2), t * (f.hv + 1.2), 0.12, h - 0.4, 0, LOOK.steel, { seg: 8 });
    b.box(f, 0, f.hv + 0.05, 5, 0.2, 2.6, 0, mat({ color: 0x1c2024, rough: 0.2, metal: 0.4 }));
    b.metro(f, 5, f.hv + 3);
    stationBoard(b, f, 0, f.hv + 2.6, 'Wawrzyszew');
  }
}

// Młociny (photo: Commons MeroA23_7): an open canopy — a flat roof on slender columns with a band of milky glass
// round its edge and a mesh railing on top — over free-standing gabion walls; the stairs go down in the open middle
function mlociny(b) {
  const gabion = mat({ map: noiseTexture('#8f8572', ['#a39883', '#b8ae99', '#7d7563', '#c7bfae'], '#8d8f90', 1, 1, 3), rough: 0.95 });
  for (const id of resolve().IDS.mlociny) {
    const ring = ringOf(id), h = heightOf(id), f = frameOf(ring);
    const W = f.hu * 2, D = f.hv * 2;
    b.box(f, 0, 0, W + 1, D + 1, 0.4, h - 1.6, mat({ color: 0xd9dcdf, rough: 0.6 }));
    b.box(f, 0, 0, W + 1.2, D + 1.2, 1.3, h - 1.3, LOOK.milky);
    b.box(f, 0, 0, W + 1.2, D + 1.2, 0.08, h - 0.02, mat({ color: 0xbfc3c7, rough: 0.6 }));
    b.prism(toRect(f, W / 2 + 0.6, D / 2 + 0.6), h, h + 1.1, mat({ color: 0x8d8f90, rough: 0.5, metal: 0.6, opacity: 0.55, double: true }));
    const cols = Math.max(2, Math.round(W / 7));
    for (let k = 0; k <= cols; k++) for (const t of [-1, 1]) b.cylinder(f, -W / 2 + (k * W) / cols, t * (D / 2 - 0.4), 0.13, h - 1.6, 0, LOOK.steel, { seg: 8 });
    // gabion walls: blocks along the back and the ends, open at the front
    for (let k = 0; k < cols; k++) {
      if (k % 3 === 1) continue;
      b.box(f, -W / 2 + ((k + 0.5) * W) / cols, -(D / 2 - 0.9), W / cols - 1.2, 1.2, h - 2.2, 0, gabion);
    }
    for (const s of [-1, 1]) b.box(f, s * (W / 2 - 0.9), 0, 1.2, D * 0.6, h - 2.2, 0, gabion);
    b.box(f, 0, 0.5, W * 0.35, D * 0.35, 0.1, 0.01, mat({ color: 0x15171a, rough: 1 })); // the stairwell
    b.metro(f, W / 2 + 1.5, D / 2 + 2.5);
    stationBoard(b, f, W / 2 + 1.5, D / 2 + 1.8, 'Młociny');
  }
}

// Axis-aligned rectangle in frame f as world points (for prisms round boxes)
function toRect(f, hu, hv) {
  return [f.at(-hu, -hv), f.at(hu, -hv), f.at(hu, hv), f.at(-hu, hv)].map((p) => ({ x: p.x, z: p.z }));
}

// AWF (photo: Commons "Budynek główny AWF Warszawa", 2015): white modernist blocks with a porthole row on the ground
// floor and railings on the flat roofs; the slender tower with single windows on little ledges, a narrower shaft beside
// it, a kiosk, a railing and masts on top; the rotunda ringed by touching white cylinders with portholes above them and
// a low blue-grey dome; the eastern wings from the full LoD1 package
function awf(b, colliders) {
  const { IDS, campus } = resolve();
  const main = IDS.awf[0], tower = IDS.awf[1];
  const upper = mat({ map: facadeTexture({ wall: '#f3f2ec', win: '#34383c', frame: '#3a3d40', w: 3.2, h: 3.8, ww: 1.8, wh: 1.9, sill: 1 }), rough: 0.85 });
  const portholes = mat({ map: facadeTexture({ wall: '#f3f2ec', win: '#34383c', frame: '#d9d7cf', w: 2.6, h: 3.8, ww: 1.1, sill: 1.2, round: true }), rough: 0.85 });
  const railing = mat({ color: 0x8c8f92, rough: 0.5, metal: 0.6, opacity: 0.5, double: true });
  const roof = mat({ color: 0x4a4a4a, rough: 0.95 });
  const block = (ring, h) => {
    b.prism(ring, 0, Math.min(3.8, h), portholes);
    if (h > 3.8) b.prism(ring, 3.8, h, upper);
    b.prism(ring, h, h + 0.8, LOOK.white, roof);
    b.prism(ring, h + 0.8, h + 1.8, railing);
  };
  block(ringOf(main), heightOf(main));
  for (const i of campus.awf) {
    const h = heightOf(i);
    if (h > 2.5) block(ringOf(i), h);
  }
  // the tower
  const tr = ringOf(tower), th = heightOf(tower), tf = frameOf(tr);
  const towerWall = mat({ map: facadeTexture({ wall: '#f3f2ec', win: '#2f3236', frame: '#2f3236', w: tf.hu * 2, h: 3.3, ww: 1.2, wh: 1.3, sill: 1.1, ledge: '#e2e0d8' }), rough: 0.85 });
  b.prism(tr, 0, th, towerWall, LOOK.white);
  b.box(tf, tf.hu + 1.4, 0, 2.8, tf.hv * 1.4, th - 2.5, 0, mat({ map: facadeTexture({ wall: '#f3f2ec', win: '#2f3236', frame: '#2f3236', w: 2.8, h: 3.3, ww: 0.7, wh: 1.1, sill: 1.2 }), rough: 0.85 }));
  b.box(tf, 0, 0, tf.hu * 1.15, tf.hv * 1.15, 0.5, th, LOOK.white);
  b.box(tf, -tf.hu * 0.2, 0, tf.hu * 0.9, tf.hv * 0.9, 3.2, th + 0.5, LOOK.white);
  b.box(tf, -tf.hu * 0.2, 0, tf.hu * 1.0, tf.hv * 1.0, 0.4, th + 3.7, LOOK.white);
  b.prism(toRect(tf, tf.hu, tf.hv), th + 0.5, th + 1.6, railing);
  for (const s of [-1, 1]) b.cylinder(tf, -tf.hu * 0.2 + s * 1.2, 0, 0.07, 6, th + 4.1, LOOK.steel, { seg: 6 });
  b.box(tf, -tf.hu * 0.2, 0, 2.6, 0.08, 0.08, th + 8.5, LOOK.steel);
  // the rotunda beside the tower
  const rv = tf.hv + 16, R = 13;
  const drumWall = mat({ map: facadeTexture({ wall: '#f3f2ec', win: '#34383c', frame: '#d9d7cf', w: 5.1, h: 3, ww: 1.3, sill: 0.8, round: true }), rough: 0.85 });
  b.cylinder(tf, 0, rv, R, 7, 0, LOOK.white, { seg: 40 });
  b.cylinder(tf, 0, rv, R, 3, 7, drumWall, { seg: 40, uvScale: 1 });
  b.dome(tf, 0, rv, R + 0.3, 10, mat({ color: 0x5b6a7a, rough: 0.6, metal: 0.3 }), { squash: 0.22 });
  const n = Math.round((2 * Math.PI * (R + 1.5)) / 3.1);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    b.cylinder(tf, Math.cos(a) * (R + 1.4), rv + Math.sin(a) * (R + 1.4), 1.55, 7, 0, LOOK.white, { seg: 14 });
  }
}

// UKSW Dewajtis: cream plaster, white windows in deep reveals, steep dark metal roofs (hip roofs on the simple
// blocks, a mansard band on the long ones); the campus buildings east of the area from the full LoD1 package
function uksw(b, colliders) {
  const plaster = mat({ map: facadeTexture({ wall: '#ece6d6', win: '#3f4650', frame: '#ffffff', w: 2.8, h: 3.5, ww: 1.2, wh: 1.7, sill: 0.95, band: '#cfcac0' }), rough: 0.9 });
  const building = (ring, h) => {
    b.prism(ring, 0, h, plaster);
    if (ring.length <= 6) {
      const f = frameOf(ring);
      b.hip(f, 0, 0, f.hu * 2, f.hv * 2, h, Math.min(6, f.hv * 0.8), LOOK.graphite, { o: 0.5 });
    } else {
      b.prism(ring, h, h + 2.6, LOOK.graphite, LOOK.graphite, { inset: 1.6 });
    }
  };
  const { IDS, campus } = resolve();
  const id = IDS.uksw[0];
  building(ringOf(id), heightOf(id));
  const f = frameOf(ringOf(id));
  b.sign(f, 'Uniwersytet Kardynała Stefana Wyszyńskiego', 0, f.hv + 0.4, 3.6, { w: 16, h: 0.9, bg: null, fg: '#7a1f2b', serif: true });
  for (const i of campus.uksw) {
    if (heightOf(i) >= 9) building(ringOf(i), heightOf(i)); // the low ones are the hermitages (kameduly)
  }
}

function szpital(b) {
  const plaster = mat({ map: facadeTexture({ wall: '#dcd8cc', win: '#4a5058', frame: '#eeeeea', w: 3, h: 3.6, ww: 1.5, wh: 1.6, sill: 0.95 }), rough: 0.9 });
  resolve().IDS.szpital.forEach((id, i) => {
    const ring = ringOf(id), h = heightOf(id), f = frameOf(ring);
    b.prism(ring, 0, h, plaster, LOOK.roofGrey);
    b.prism(ring, h, h + 0.8, mat({ color: 0xcfcbbf, rough: 0.9 }));
    b.box(f, 0, 0, Math.min(16, f.hu), Math.min(8, f.hv), 3.2, h, mat({ color: 0xb9b6ad, rough: 0.9 })); // machine room
    if (i === 0) {
      b.box(f, 0, f.hv + 2, 14, 4, 0.35, 4, LOOK.white); // entrance canopy
      for (const s of [-1, 1]) b.cylinder(f, s * 6, f.hv + 3.6, 0.2, 4, 0, LOOK.white, { seg: 10 });
      b.sign(f, 'Szpital Bielański', 0, f.hv + 0.1, h - 2.5, { w: 14, h: 1.6, bg: null, fg: '#1f4e8c' });
    }
  });
}

// St Sigismund (photo: Commons, 2013): a low white concrete base with a relief medallion over the wooden doors, the
// roof a star of six folded triangular planes whose tips stick out as sharp beaks, grey-green metal, a spiky star
// crown with a big cross on top; the tall concrete bell tower with vertical slots and the bells in its open top
// stands at the east corner; a tall wooden cross in front
function zygmunt(b) {
  const id = resolve().IDS.zygmunt[0], ring = ringOf(id), h = heightOf(id), f = frameOf(ring);
  const base = mat({ map: facadeTexture({ wall: '#dedad0', win: '#3c4248', frame: '#dedad0', w: 3, h: h, ww: 2.4, wh: 2.2, sill: h - 3 }), rough: 0.9 });
  b.prism(ring, 0, h - 0.3, base, LOOK.roofGrey);
  // the folded star roof
  const R = Math.max(f.hu, f.hv) * 1.02, top = h + 15, roof = mat({ color: 0x6f7d74, rough: 0.55, metal: 0.4, double: true });
  const edge = mat({ color: 0x3f4844, rough: 0.6, metal: 0.3, double: true });
  const at = (ang, r, y) => [Math.cos(ang) * r, y, Math.sin(ang) * r];
  const facets = [], rims = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2, l = a - Math.PI / 6, r = a + Math.PI / 6;
    const beak = at(a, R * 1.22, h + 5.5), apex = at(a, R * 0.12, top);
    facets.push([apex, at(l, R * 0.86, h - 0.2), beak], [apex, beak, at(r, R * 0.86, h - 0.2)]);
    // the beak's underside back to the wall
    rims.push([beak, at(l, R * 0.86, h - 0.2), at(a, R * 0.8, h - 0.2)], [beak, at(a, R * 0.8, h - 0.2), at(r, R * 0.86, h - 0.2)]);
  }
  const apexes = Array.from({ length: 6 }, (_, k) => at((k / 6) * Math.PI * 2, R * 0.12, top));
  for (let k = 0; k < 6; k++) facets.push([[0, top + 0.6, 0], apexes[k], apexes[(k + 1) % 6]]);
  b.tris(f, facets, roof);
  b.tris(f, rims, edge);
  // the star crown: six spikes leaning out, the cross
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    b.tris(f, [[[0, top + 0.4, 0], at(a - 0.18, 1.2, top + 0.8), at(a, 3.8, top + 3.6)], [[0, top + 0.4, 0], at(a, 3.8, top + 3.6), at(a + 0.18, 1.2, top + 0.8)]], edge);
  }
  b.cross(f, 0, 0, 6, top + 1, mat({ color: 0x2f3433, rough: 0.5, metal: 0.5 }));
  // the front: relief medallion, wooden doors, the tall cross
  b.box(f, 0, f.hv + 0.1, 12, 0.3, 4.2, 4.8, mat({ color: 0xe9e5d8, rough: 0.8 }));
  b.cylinder(f, 0, f.hv + 0.35, 1.6, 0.25, 5.4, mat({ color: 0xd2cdbf, rough: 0.8 }), { seg: 24 });
  b.box(f, 0, f.hv + 0.2, 6, 0.3, 3.4, 0, mat({ color: 0x8a6a45, rough: 0.8 }));
  b.box(f, -5, f.hv + 7, 0.5, 0.5, 11, 0, mat({ color: 0x6b4a2e, rough: 0.9 }));
  b.box(f, -5, f.hv + 7, 4.2, 0.5, 0.5, 8, mat({ color: 0x6b4a2e, rough: 0.9 }));
  // the bell tower at the east corner
  const east = f.at(1, 0).x > f.at(-1, 0).x ? 1 : -1;
  const tu = east * (f.hu + 2.5), tv = f.hv * 0.55, TH = 40;
  const concrete = LOOK.concrete, slot = mat({ color: 0x55534d, rough: 1 });
  b.box(f, tu, tv, 4.6, 4.6, TH - 9, 0, concrete);
  for (const s of [-1, 1]) {
    b.box(f, tu + s * 1.0, tv + 2.31, 0.35, 0.05, 14, 6 + (s > 0 ? 4 : 0), slot);
    b.box(f, tu - 2.31, tv + s * 1.0, 0.05, 0.35, 10, 16, slot);
    b.box(f, tu + s * 1.95, tv, 0.7, 4.6, 7, TH - 9, concrete); // the open bell chamber's sides
  }
  b.box(f, tu, tv, 4.6, 4.6, 2, TH - 2, concrete);
  for (let k = 0; k < 2; k++) {
    b.cone(f, tu, tv + (k - 0.5) * 1.6, 0.75, 1.2, TH - 6.5 + k * 1.6, mat({ color: 0x7b5a2a, rough: 0.35, metal: 0.85 }), 14);
  }
  b.cross(f, tu, tv, 4, TH, mat({ color: 0x2f3433, rough: 0.5, metal: 0.5 }));
}

function magdalena(b) {
  const id = resolve().IDS.magdalena[0], ring = ringOf(id), h = heightOf(id), f = frameOf(ring);
  const wall = mat({ map: facadeTexture({ wall: '#f2f0ea', win: '#46413a', frame: '#f2f0ea', w: 4, h: h, ww: 1.1, wh: 2.6, sill: 2.4 }), rough: 0.9 });
  const eaves = h - 1.5;
  b.prism(ring, 0, eaves, wall);
  b.gable(f, 0, 0, f.hu * 2, f.hv * 2, eaves, f.hv * 1.5, LOOK.tile, { o: 0.4 });
  // gable walls up to the ridge at both ends
  for (const s of [-1, 1]) {
    const g = new THREE.BufferGeometry();
    const hv = f.hv;
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, eaves, -hv, 0, eaves, hv, 0, eaves + hv * 1.5, 0], 3));
    g.computeVertexNormals();
    const gg = g.clone();
    gg.translate(s * f.hu, 0, 0);
    b.place(gg, f, 0, 0);
    b.add(gg, mat({ color: 0xf2f0ea, rough: 0.9, double: true }));
  }
  // the west front: the dates on the gable, a round window, the porch with its pediment
  const west = f.at(1, 0).x < f.at(-1, 0).x ? 1 : -1;
  b.sign(f, '1542      2002', west * (f.hu + 0.05), 0, eaves + 1.6, { w: f.hv * 1.4, h: 0.9, bg: null, fg: '#2f2f2f', serif: true }, west * Math.PI / 2);
  b.cylinder(f, west * (f.hu + 0.02), 0, 0.5, 0.1, eaves + 3.2, mat({ color: 0x46413a }), { seg: 16 });
  b.box(f, west * (f.hu + 2), 0, 4, 5, eaves - 1.5, 0, LOOK.white);
  b.gable(f, west * (f.hu + 2), 0, 4, 5, eaves - 1.5, 2, LOOK.tile, { yaw: Math.PI / 2, o: 0.25 });
  b.box(f, west * (f.hu + 4.05), 0, 0.1, 1.6, 2.6, 0, mat({ color: 0x4a3426, rough: 0.8 }));
  // the roof turret: an octagonal dark helmet with a lantern and a cross
  const tu = west * f.hu * 0.45, ridge = eaves + f.hv * 1.5;
  b.cylinder(f, tu, 0, 0.8, 2, ridge - 0.5, LOOK.white, { seg: 8 });
  b.cone(f, tu, 0, 1.1, 2.4, ridge + 1.5, mat({ color: 0x4d4f50, rough: 0.5, metal: 0.4 }), 8);
  b.cross(f, tu, 0, 1.6, ridge + 3.9, LOOK.gold);
}

// The Camaldolese church (photos: Commons "Camaldolese Church in Warsaw", 2019): white plaster, a green copper roof,
// a three-bay front with pilasters, round-headed windows and a pediment between volutes; two square white towers at
// the east end with arched belfry openings (brown louvres) and double onion helmets of brown copper with lanterns and
// crosses; in front the wooden gate to the hermitages under steep crossed shingle gables and a picket fence; the
// hermitages themselves (low white houses, red tiled hip roofs) on their LoD1 footprints
function kameduly(b, colliders) {
  const ring = toPts(KAMEDULY_RING), h = 18.2, f = frameOf(ring);
  const wall = mat({ map: facadeTexture({ wall: '#f0ede4', win: '#3e4246', frame: '#e3dfd3', w: 5, h: 9, ww: 1.9, wh: 3.4, sill: 3, arch: true }), rough: 0.85 });
  const white = LOOK.white, trim = mat({ color: 0xe2ded2, rough: 0.8 });
  const bronze = mat({ color: 0x7a4f32, rough: 0.45, metal: 0.6 }), louvre = mat({ color: 0x5a3b26, rough: 0.8 });
  const eaves = h - 3;
  b.prism(ring, 0, eaves, wall);
  b.prism(ring, eaves - 0.6, eaves, trim);
  b.gable(f, 0, 0, f.hu * 1.7, f.hv * 1.5, eaves, 8, LOOK.copper, { o: 0.7 });
  pushColliders(ring, h, colliders);
  // the west front
  const west = f.at(1, 0).x < f.at(-1, 0).x ? 1 : -1;
  const fu = west * f.hu, fw = f.hv * 1.5;
  b.box(f, fu, 0, 1.4, fw, eaves + 2.5, 0, white);
  for (const s of [-0.45, -0.18, 0.18, 0.45]) b.box(f, fu + west * 0.9, s * fw, 0.5, 0.9, eaves + 1.5, 0, trim);
  b.box(f, fu + west * 0.9, 0, 0.6, fw + 0.6, 0.7, eaves + 1.5, trim); // the entablature
  b.gable(f, fu + west * 0.5, 0, 1.8, fw * 0.62, eaves + 2.2, 4.6, white, { yaw: Math.PI / 2, o: 0.3 });
  for (const s of [-1, 1]) b.cone(f, fu + west * 0.6, s * fw * 0.38, 1.4, 2.6, eaves + 2.2, white, 4); // volutes, stylised
  b.box(f, fu + west * 0.75, 0, 0.12, 2.6, 4.4, 0, mat({ color: 0x5a3d26, rough: 0.8 }));
  const win = mat({ color: 0x3e4246, rough: 0.3, metal: 0.3 });
  for (const s of [-0.3, 0, 0.3]) b.box(f, fu + west * 0.75, s * fw, 0.08, 1.6, 3, eaves - 7 + (s === 0 ? 1 : 0), win);
  // the two east towers
  const eu = -west * (f.hu - 4.5), TOP = 25;
  for (const s of [-1, 1]) {
    const tv = s * (f.hv - 3.2);
    b.box(f, eu, tv, 5.6, 5.6, TOP, 0, white);
    for (const y of [eaves - 0.6, TOP - 5.6, TOP]) b.box(f, eu, tv, 6.2, 6.2, 0.5, y, trim);
    for (const d of [-1, 1]) {
      b.box(f, eu + d * 2.83, tv, 0.06, 1.7, 3.2, TOP - 4.6, louvre);
      b.box(f, eu, tv + d * 2.83, 1.7, 0.06, 3.2, TOP - 4.6, louvre);
      b.cylinder(f, eu + d * 2.83, tv, 0.85, 0.06, TOP - 1.45, louvre, { seg: 12 });
    }
    // double onion helmet of brown copper: drum, bulb, lantern, small bulb, spire, cross
    b.cylinder(f, eu, tv, 2.4, 1.2, TOP + 0.5, white, { seg: 16 });
    b.dome(f, eu, tv, 2.9, TOP + 1.7, bronze, { squash: 1.25 });
    b.cylinder(f, eu, tv, 2.5, 0.5, TOP + 1.7, bronze, { seg: 16 });
    b.cylinder(f, eu, tv, 0.75, 2, TOP + 5.2, bronze, { seg: 8 });
    b.dome(f, eu, tv, 1.15, TOP + 7.2, bronze, { squash: 1.6 });
    b.cone(f, eu, tv, 0.3, 2.4, TOP + 8.9, bronze, 8);
    b.cross(f, eu, tv, 2, TOP + 11.2, LOOK.gold);
  }
  // the wooden gate to the hermitages: posts and crossed steep shingle gables, a little turret
  const gu = fu + west * 17;
  for (const s of [-1, 1]) for (const t of [-1, 1]) b.box(f, gu + s * 2.2, t * 2.2, 0.35, 0.35, 3.2, 0, LOOK.wood);
  b.gable(f, gu, 0, 5.6, 5.6, 3.2, 4.2, LOOK.shingle, { o: 0.5 });
  b.gable(f, gu, 0, 5.6, 5.6, 3.2, 4.2, LOOK.shingle, { o: 0.5, yaw: Math.PI / 2 });
  b.cylinder(f, gu, 0, 0.4, 1.2, 7.2, LOOK.shingle, { seg: 8 });
  b.cone(f, gu, 0, 0.6, 1.4, 8.4, LOOK.shingle, 8);
  b.cross(f, gu, 0, 1, 9.8, LOOK.gold);
  // the picket fence along the front, either side of the gate
  for (const s of [-1, 1]) b.box(f, gu - west * 1, s * 15, 0.12, 22, 1.4, 0, LOOK.wood);
  // the hermitages (LoD1 annex, the low buildings round the church)
  for (const i of resolve().campus.uksw) {
    const hh = heightOf(i);
    if (hh >= 9) continue;
    const r = ringOf(i), hf = frameOf(r);
    b.prism(r, 0, Math.max(2.8, hh - 2.4), white);
    b.hip(hf, 0, 0, hf.hu * 2, hf.hv * 2, Math.max(2.8, hh - 2.4), 2.6, LOOK.tile, { o: 0.45 });
  }
}

/**
 * Builds every landmark into one group; colliders: those of the landmarks without a LoD1 block
 */
function buildLandmarks(scene) {
  const b = new Builder('BielanyLandmarks');
  const colliders = [];
  for (const [name, fn] of Object.entries({ galeria, stareBielany, wawrzyszew, mlociny, awf, uksw, szpital, zygmunt, magdalena, kameduly })) {
    const parts = new Map([...b.parts].map(([m, list]) => [m, list.length]));
    const meshes = b.group.children.length, firstCollider = colliders.length;
    try {
      fn(b, colliders);
    } catch (e) {
      console.warn(`[landmarks] ${name}:`, e);
    }
    onGround(b, parts, meshes, colliders.slice(firstCollider));
  }
  const group = b.finish();
  scene.add(group);
  console.info(`[landmarks] ${group.children.length} meshes, ${colliders.length} colliders`);
  return { group, colliders };
}

// A landmark on the escarpment (js/terrain.js) stands as a whole at the lowest ground under its walls' feet: the
// pieces just built (the parts added since `parts`, the meshes since `meshes`) and its colliders move down together
function onGround(b, parts, meshes, colliders) {
  const geos = new Set();
  for (const [m, list] of b.parts) for (const g of list.slice(parts.get(m) || 0)) geos.add(g);
  const own = b.group.children.slice(meshes);
  let base = 0;
  const v = new THREE.Vector3();
  const feet = (g, matrix) => {
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      if (matrix) v.applyMatrix4(matrix);
      if (v.y < 0.5) base = Math.min(base, groundY(v.x, v.z));
    }
  };
  for (const g of geos) feet(g, null);
  for (const m of own) { m.updateMatrix(); feet(m.geometry, m.matrix); }
  if (!base) return;
  for (const g of geos) g.translate(0, base, 0);
  for (const m of own) m.position.y += base;
  for (const c of colliders) { c.minY = (c.minY ?? 0) + base; c.maxY += base; c.base = base; }
}

export { bryantParkLawn, buildLandmarks, landmarkBuildingIds };
