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

const bryantParkLawn = null;

// GEO.buildings indices of each landmark's LoD1 blocks (tools: the building containing the reference point)
const IDS = {
  galeria: [50],
  stareBielany: [1723, 1724],
  wawrzyszew: [1722, 2247],
  mlociny: [339, 338],
  awf: [1071, 1520],
  uksw: [187],
  szpital: [804, 2153, 2265, 995],
  zygmunt: [1827],
  magdalena: [376],
};

// The Camaldolese church (OpenStreetMap way 173130486, outside the LoD1 cut): footprint in the world frame
const KAMEDULY_RING = [711.7, -1575, 713.2, -1577.9, 715.6, -1576.6, 716.9, -1579.7, 720.3, -1577.1, 724, -1576.7, 725.4, -1578.5,
  728.2, -1577.3, 729.1, -1579.4, 730.1, -1579.7, 737.6, -1575.7, 737.9, -1574.8, 736.6, -1572.5, 738.9, -1571.1, 738.1, -1569, 740,
  -1566.2, 743.4, -1564.5, 744.6, -1567.1, 745.6, -1567.3, 754.7, -1561.8, 746.6, -1547.7, 743.2, -1541.6, 733.9, -1546.9, 735.5, -1550,
  732.9, -1551.6, 728.7, -1552, 727.4, -1550.2, 725, -1551.5, 723.7, -1549.3, 722.8, -1549, 715.1, -1553, 716.3, -1556.3, 714, -1557.5,
  714.8, -1558.7, 714.5, -1560, 712.4, -1562.6, 708.5, -1564.1, 710.1, -1566.5, 708.1, -1568, 709.7, -1571.1, 711, -1570.9, 712.7, -1574.5];

const WALL_T = 1.2; // m, as js/buildings.js

function landmarkBuildingIds() {
  return new Set(Object.values(IDS).flat());
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

// A simplified metro sign: a white "M" on a blue square on a post, and the station name board
function metroSign(b, f, u, v, name) {
  b.cylinder(f, u, v, 0.08, 3.2, 0, LOOK.steel, { seg: 8 });
  b.sign(f, 'M', u, v, 3.6, { w: 0.9, h: 0.9, bg: '#1f3a8a', fg: '#ffffff', font: '800' });
  b.sign(f, name, u, v, 2.75, { w: 2.4, h: 0.42, bg: '#1f3a8a', fg: '#ffffff', font: '700' });
}

// ----------------------------------------------------------------------------------------------------------------
// The landmarks
// ----------------------------------------------------------------------------------------------------------------
function galeria(b) {
  const id = IDS.galeria[0], ring = ringOf(id), h = heightOf(id);
  const f = frameOf(ring);
  const panels = mat({ map: galeriaTexture(), rough: 0.45, metal: 0.4 });
  const shopfront = mat({ map: facadeTexture({ glass: true, win: '#2b3036', frame: '#9a9c9e', w: 6, h: 8, mullion: 3 }), rough: 0.15, metal: 0.4 });
  b.prism(ring, 0, 8, shopfront);
  b.prism(ring, 8, h, panels, LOOK.roofGrey);
  // rounded corner drums at both ends, a dark glass band and an overhang
  for (const s of [-1, 1]) {
    const u = s * (f.hu - f.hv * 0.55), r = f.hv * 0.62;
    b.cylinder(f, u, 0, r, h + 2.5, 0, panels, { seg: 28 });
    b.cylinder(f, u, 0, r + 1.2, 4.5, h + 2.5, LOOK.darkGlass, { seg: 28 });
    b.cylinder(f, u, 0, r + 1.6, 0.5, h + 7, LOOK.roofGrey, { seg: 28 });
  }
  // roof garden: lawns and shrubs on the middle of the roof
  for (let k = -3; k <= 3; k++) {
    b.box(f, k * f.hu * 0.18, 0, f.hu * 0.13, f.hv * 0.9, 0.5, h, LOOK.green);
    for (const dv of [-0.25, 0.25]) b.cone(f, k * f.hu * 0.18, dv * f.hv, 1.6, 3.2, h + 0.5, mat({ color: 0x6d8a3e, rough: 1 }), 7);
  }
  // the name over the main entrance (the north-east end, towards the Młociny hub), the rust letters on the plaza
  const ne = f.at(f.hu, 0).z < f.at(-f.hu, 0).z ? 1 : -1;
  const eu = ne * (f.hu - f.hv * 1.4);
  b.box(f, eu, f.hv + 0.1, 26, 0.6, 3.2, 10.5, LOOK.darkGlass);
  b.sign(f, 'Galeria Młociny', eu, f.hv + 0.45, 12.1, { w: 24, h: 2.6, bg: null, fg: '#ffffff', font: '700' });
  b.sign(f, 'Młociny', eu - ne * 6, f.hv + 14, 1.0, { w: 9, h: 2, bg: null, fg: '#8a3b22', font: '800' });
  // fictional tenant boards on the long front
  const shops = ['Księgarnia Kartka', 'Sport Bielany', 'Kawiarnia Pod Kasztanem', 'Dom Mody Wisła'];
  shops.forEach((name, i) => b.sign(f, name, (-0.5 + i * 0.3) * f.hu, f.hv + 0.1, 9.2, { w: 12, h: 1.4, bg: '#2a2c30', fg: '#f2f2f0' }));
}

function stareBielany(b) {
  const glass = mat({ map: facadeTexture({ glass: true, win: '#4a5560', frame: '#8c8f92', w: 3, h: 3.6, mullion: 1.5 }), rough: 0.1, metal: 0.5 });
  for (const id of IDS.stareBielany) {
    const ring = ringOf(id), h = heightOf(id), f = frameOf(ring);
    b.prism(ring, 0, h - 1, glass);
    b.prism(ring, h - 1, h, LOOK.white, LOOK.roofGrey);
    metroSign(b, f, f.hu - 2, f.hv + 2.5, 'Stare Bielany');
  }
}

function wawrzyszew(b) {
  const creeper = mat({ map: noiseTexture('#5b2a22', ['#a3271f', '#c23b23', '#7d1f19', '#d0602a', '#4f6b2e'], '#6e7276', 2, 2, 7), rough: 0.95 });
  for (const id of IDS.wawrzyszew) {
    const ring = ringOf(id), h = heightOf(id), f = frameOf(ring);
    b.prism(ring, 0, h - 0.4, creeper);
    // the steel pergola roof, overhanging, with cross slats
    b.box(f, 0, 0, f.hu * 2 + 3, f.hv * 2 + 3, 0.25, h - 0.4, LOOK.steel);
    const n = Math.round((f.hu * 2 + 3) / 1.2);
    for (let k = 0; k <= n; k++) b.box(f, -f.hu - 1.5 + k * 1.2, 0, 0.12, f.hv * 2 + 3, 0.5, h - 0.15, mat({ color: 0x6e7276, rough: 0.6, metal: 0.5 }));
    metroSign(b, f, f.hu, f.hv + 3, 'Wawrzyszew');
  }
}

function mlociny(b) {
  const gabion = mat({ map: noiseTexture('#8f8572', ['#a39883', '#b8ae99', '#7d7563', '#c7bfae'], '#8d8f90', 1, 1, 3), rough: 0.95 });
  for (const id of IDS.mlociny) {
    const ring = ringOf(id), h = heightOf(id), f = frameOf(ring);
    b.prism(ring, 0, h - 1.6, gabion);
    b.prism(ring, h - 1.6, h - 0.2, LOOK.milky, LOOK.roofGrey);
    b.prism(ring, h - 0.2, h + 0.9, mat({ color: 0x8d8f90, rough: 0.5, metal: 0.6, opacity: 0.55, double: true }));
    metroSign(b, f, f.hu + 1.5, f.hv + 2.5, 'Młociny');
  }
}

function awf(b) {
  const main = IDS.awf[0], tower = IDS.awf[1];
  const plaster = mat({ map: facadeTexture({ wall: '#f1f0ea', win: '#3a3d40', frame: '#3a3d40', w: 3.2, h: 3.8, ww: 1.8, wh: 1.9, sill: 1, band: '#d9d7cf' }), rough: 0.85 });
  const ring = ringOf(main), h = heightOf(main);
  b.prism(ring, 0, h, plaster, mat({ color: 0x4a4a4a, rough: 0.95 }));
  b.prism(ring, h, h + 0.9, LOOK.white); // attic
  // the white tower: paired windows in a vertical strip, a kiosk and masts on top, a terrace railing
  const tr = ringOf(tower), th = heightOf(tower), tf = frameOf(tr);
  const towerWall = mat({ map: facadeTexture({ wall: '#f1f0ea', win: '#3a3d40', frame: '#e4e2da', w: 2.4, h: 2.9, ww: 0.9, wh: 1.5, sill: 0.8 }), rough: 0.85 });
  b.prism(tr, 0, th, towerWall, LOOK.white);
  b.box(tf, 0, 0, tf.hu * 1.1, tf.hv * 1.1, 3, th, LOOK.white);
  for (const s of [-1, 1]) b.cylinder(tf, s * tf.hu * 0.4, 0, 0.08, 7, th + 3, LOOK.steel, { seg: 6 });
  b.prism(tr, th, th + 1.1, mat({ color: 0x8c8f92, rough: 0.5, metal: 0.6, opacity: 0.5, double: true }));
  // the rotunda at the tower's foot: a drum ringed by white cylinders, round windows above
  const rf = frameOf(tr);
  const rv = rf.hv + 14;
  b.cylinder(rf, 0, rv, 11, 8, 0, LOOK.white, { seg: 32 });
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    b.cylinder(rf, Math.cos(a) * 11.6, rv + Math.sin(a) * 11.6, 1.1, 6.5, 0, LOOK.white, { seg: 12 });
  }
  b.cylinder(rf, 0, rv, 11.4, 0.5, 8, mat({ color: 0x4a4a4a, rough: 0.95 }), { seg: 32 });
}

function uksw(b) {
  const id = IDS.uksw[0], ring = ringOf(id), h = heightOf(id);
  const plaster = mat({ map: facadeTexture({ wall: '#ece6d6', win: '#3f4650', frame: '#ffffff', w: 2.8, h: 3.5, ww: 1.2, wh: 1.7, sill: 0.95, band: '#cfcac0' }), rough: 0.9 });
  b.prism(ring, 0, h, plaster);
  // a steep dark metal roof: a mansard band, then the flat top
  b.prism(ring, h, h + 2.6, LOOK.graphite, LOOK.graphite, { inset: 1.6 });
  const f = frameOf(ring);
  b.sign(f, 'Uniwersytet Kardynała Stefana Wyszyńskiego', 0, f.hv + 0.4, 3.6, { w: 16, h: 0.9, bg: null, fg: '#7a1f2b', serif: true });
}

function szpital(b) {
  const plaster = mat({ map: facadeTexture({ wall: '#dcd8cc', win: '#4a5058', frame: '#eeeeea', w: 3, h: 3.6, ww: 1.5, wh: 1.6, sill: 0.95 }), rough: 0.9 });
  IDS.szpital.forEach((id, i) => {
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

function zygmunt(b) {
  const id = IDS.zygmunt[0], ring = ringOf(id), h = heightOf(id), f = frameOf(ring);
  const base = mat({ map: facadeTexture({ wall: '#d8d4c8', win: '#3c4248', frame: '#d8d4c8', w: 3, h: h, ww: 2.4, wh: 2.2, sill: h - 3 }), rough: 0.9 });
  b.prism(ring, 0, h - 0.3, base, LOOK.roofGrey);
  // the hexagonal tent roof with sharp "beaks", a star crown and a cross
  const r = Math.max(f.hu, f.hv) * 1.05, tentH = 15;
  const tent = new THREE.ConeGeometry(r, tentH, 6, 1, true);
  tent.translate(0, h - 0.3 + tentH / 2, 0);
  b.place(tent, f, 0, 0, Math.PI / 6);
  b.add(tent, mat({ color: 0x6f7d74, rough: 0.6, metal: 0.35, double: true }));
  const top = h - 0.3 + tentH;
  for (let k = 0; k < 6; k++) b.box(f, 0, 0, 0.3, 4.5, 0.3, top - 0.4, LOOK.gold, (k / 6) * Math.PI);
  b.cross(f, 0, 0, 4, top, LOOK.gold);
  b.box(f, 0, f.hv + 0.1, 3.2, 0.3, 3.2, 6, mat({ color: 0xe9e5d8, rough: 0.8 })); // the relief medallion over the door
  b.box(f, 0, f.hv + 0.2, 3.6, 0.3, 3, 0, mat({ color: 0x8a6a45, rough: 0.8 })); // wooden doors
  // the free-standing concrete bell tower on the east side: two slabs, the bells in the open chamber, a cross
  const east = f.at(1, 0).x > f.at(-1, 0).x ? 1 : -1;
  const tu = east * (f.hu + 9), tv = f.hv * 0.3;
  for (const s of [-1, 1]) b.box(f, tu + s * 1.6, tv, 1.2, 4.4, 36, 0, LOOK.concrete);
  b.box(f, tu, tv, 4.4, 4.4, 1.2, 36, LOOK.concrete);
  for (let k = 0; k < 3; k++) b.cone(f, tu, tv, 0.7 - k * 0.15, 1.1, 34.4 - k * 2.6, mat({ color: 0x7b5a2a, rough: 0.4, metal: 0.8 }), 12);
  b.cross(f, tu, tv, 4, 37.2, LOOK.gold);
}

function magdalena(b) {
  const id = IDS.magdalena[0], ring = ringOf(id), h = heightOf(id), f = frameOf(ring);
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

function kameduly(b, colliders) {
  const ring = toPts(KAMEDULY_RING), h = 18.2, f = frameOf(ring);
  const wall = mat({ map: facadeTexture({ wall: '#f0ede4', win: '#4a4a4a', frame: '#e3dfd3', w: 5, h: 9, ww: 1.8, wh: 4.2, sill: 3 }), rough: 0.85 });
  const eaves = h - 3;
  b.prism(ring, 0, eaves, wall);
  b.gable(f, 0, 0, f.hu * 1.7, f.hv * 1.55, eaves, 7.5, LOOK.copper, { o: 0.6 });
  pushColliders(ring, h, colliders);
  // west front: three bays, paired pilasters, a triangular pediment
  const west = f.at(1, 0).x < f.at(-1, 0).x ? 1 : -1;
  const fu = west * f.hu;
  b.box(f, fu, 0, 1.2, f.hv * 1.55, eaves + 2, 0, LOOK.white);
  for (const s of [-1, -0.33, 0.33, 1]) b.box(f, fu + west * 0.8, s * f.hv * 0.45, 0.6, 0.9, eaves + 1, 0, mat({ color: 0xe6e2d6, rough: 0.8 }));
  b.gable(f, fu + west * 0.4, 0, 1.6, f.hv * 1.4, eaves + 2, 5, LOOK.white, { yaw: Math.PI / 2, o: 0.2 });
  b.box(f, fu + west * 0.65, 0, 0.1, 2.6, 4.6, 0, mat({ color: 0x5a3d26, rough: 0.8 }));
  // two towers at the east end, either side of the chancel: white shafts, belfry openings, onion helmets, crosses
  const eu = -west * (f.hu - 4);
  for (const s of [-1, 1]) {
    const tv = s * (f.hv - 3.5);
    b.box(f, eu, tv, 6, 6, 26, 0, LOOK.white);
    b.box(f, eu, tv, 6.6, 6.6, 0.6, 26, mat({ color: 0xe6e2d6, rough: 0.8 }));
    for (const d of [-1, 1]) b.box(f, eu + d * 3.02, tv, 0.06, 1.6, 3, 21.5, mat({ color: 0x4a4a4a }));
    for (const d of [-1, 1]) b.box(f, eu, tv + d * 3.02, 1.6, 0.06, 3, 21.5, mat({ color: 0x4a4a4a }));
    b.dome(f, eu, tv, 3.4, 26.6, LOOK.domeCopper, { squash: 1.35 });
    b.cylinder(f, eu, tv, 0.9, 2.2, 31, LOOK.white, { seg: 8 });
    b.dome(f, eu, tv, 1.2, 33.2, LOOK.domeCopper, { squash: 1.6 });
    b.cone(f, eu, tv, 0.35, 1.4, 35, LOOK.domeCopper, 8);
    b.cross(f, eu, tv, 2.2, 36.3, LOOK.gold);
  }
  // the wooden gate to the hermitages in front: an octagonal shingled pavilion with a turret
  const gu = fu + west * 16;
  b.cylinder(f, gu, 0, 3.2, 3.4, 0, LOOK.wood, { seg: 8 });
  b.cone(f, gu, 0, 4.2, 4.5, 3.4, LOOK.shingle, 8);
  b.cylinder(f, gu, 0, 0.5, 1.2, 7.9, LOOK.shingle, { seg: 8 });
  b.cross(f, gu, 0, 1.2, 9.1, LOOK.gold);
  // hermit cottages: low white houses with red roofs in a row behind the chancel
  for (let k = 0; k < 4; k++) {
    const cu = -west * (f.hu + 14 + k * 11), cv = (k % 2 ? 1 : -1) * 9;
    b.box(f, cu, cv, 7, 6, 3.2, 0, LOOK.white);
    b.gable(f, cu, cv, 7, 6, 3.2, 2.6, LOOK.tile);
  }
}

/**
 * Builds every landmark into one group; colliders: those of the landmarks without a LoD1 block
 */
function buildLandmarks(scene) {
  const b = new Builder('BielanyLandmarks');
  const colliders = [];
  for (const [name, fn] of Object.entries({ galeria, stareBielany, wawrzyszew, mlociny, awf, uksw, szpital, zygmunt, magdalena, kameduly })) {
    try {
      fn(b, colliders);
    } catch (e) {
      console.warn(`[landmarks] ${name}:`, e);
    }
  }
  const group = b.finish();
  scene.add(group);
  console.info(`[landmarks] ${group.children.length} meshes, ${colliders.length} colliders`);
  return { group, colliders };
}

export { bryantParkLawn, buildLandmarks, landmarkBuildingIds };
