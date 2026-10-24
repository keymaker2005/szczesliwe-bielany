import * as THREE from 'three/webgpu';
import { attribute, uv, fract, floor, mod, mix, color, float, vec3, smoothstep, step, fwidth, max, min, abs } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GEO } from './bielany-geodata.js';

// js/buildings.js
// The buildings of Bielany: every GUGiK LoD1 2024 footprint (js/bielany-geodata.js) extruded to its measured height,
// and the newer buildings LoD1 misses (OpenStreetMap, 3 m per storey), flat-roofed, with a facade by type (tools/
// geo-bielany.mjs classifies them):
//   1 blok (wielka płyta): concrete panels 3.6 m x 2.8 m with their joints, a window per panel, balcony slabs in every
//     third bay, a stair-core stripe in the accent colour, small basement windows on the ground floor; pastel after the
//     insulation of the 2000s
//   2 nowe osiedle: big windows on 3.1 m storeys, glass balcony fronts in every other bay, a darker recessed top floor
//     and a glazed ground floor
//   3 pawilon: a band of shop windows with mullions every 2 m, a sign fascia in the accent colour (no names), plain wall
//   0 the rest: plaster with a window every 3 m x 2.8 m
//
// Walls carry uv = (window bays along the wall: a whole number of them, each about the type's bay width; metres above
// the ground), so windows never wrap round a corner and keep their size on walls at any angle, and the building's
// height (no windows in a top storey cut short: the parapet). Geometry is merged per 500 m tile (two draws each: walls
// & roofs) for frustum culling. Players collide with every wall as a thin oriented box just inside it, so courtyards
// of L- and U-shaped blocks stay open.

const TILE = 500; // m
const WALL_T = 1.2; // m: thickness of a wall's collider, inside the wall
// Per facade type (0 other, 1 blok, 2 nowe osiedle, 3 pawilon): bay width m, storey height m, wall & accent tones
const TYPES = [
  { bay: 3.0, storey: 2.8, tones: [0xe3ddd0, 0xd8d3c8, 0xe6dcc0, 0xcfd2cf, 0xded3bf, 0xe9e4da], accents: [0xb9ad98] },
  { bay: 3.6, storey: 2.8, tones: [0xece3c4, 0xe9d6c2, 0xd9e2d2, 0xd5dde2, 0xe6e1d6, 0xeadfb5, 0xdcd3e0],
    accents: [0xc9824e, 0x6f8fa8, 0x8aa36b, 0xb5625a, 0xd0a64a] },
  { bay: 3.0, storey: 3.1, tones: [0xf0eee9, 0xe8e4dc, 0xdedad2, 0xc8c4bc], accents: [0x3d3f44, 0x8a6a52, 0x5b6470] },
  { bay: 2.0, storey: 3.4, tones: [0xd8d2c4, 0xcac6bd, 0xe0d8c8], accents: [0x2f6f9f, 0xb8463e, 0x3f8a5a, 0xd2a03a] }
];

function createFacadeMaterial() {
  const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0.0 });
  const kind = attribute('kind', 'float');
  const wallH = attribute('wallH', 'float');
  const tint = attribute('tint', 'vec3');
  const accent = attribute('accent', 'vec3');
  const is = (k) => float(1).sub(min(abs(kind.sub(k)).mul(2), 1)); // 1 for this type, else 0
  const k1 = is(1), k2 = is(2), k3 = is(3);
  const storey = mix(mix(mix(float(TYPES[0].storey), float(TYPES[1].storey), k1), float(TYPES[2].storey), k2), float(TYPES[3].storey), k3);

  const u = uv().x; // bays along the wall
  const y = uv().y; // metres above the ground
  const v = y.div(storey);
  const cu = fract(u), cv = fract(v);
  const bi = floor(u), si = floor(v);
  const floors = floor(wallH.div(storey)); // whole storeys under the roof (a top storey cut short is the parapet)
  const lit = step(0, u).mul(step(si.add(1), floors)); // window storeys on walls wide enough for a bay
  // anti-aliased box [a0, a1] x [b0, b1] in the bay & storey cell, faded to its mean once under a pixel
  const wu = max(fwidth(u), 0.001), wv = max(fwidth(v), 0.001);
  const edge = (e, w, x) => smoothstep(float(e).sub(w), float(e).add(w), x);
  const box = (a0, a1, b0, b1) => edge(a0, wu, cu).mul(float(1).sub(edge(a1, wu, cu)))
    .mul(edge(b0, wv, cv)).mul(float(1).sub(edge(b1, wv, cv)));
  const far = smoothstep(0.25, 0.6, max(wu, wv));
  const aa = (m, mean) => mix(m, float(mean), far);
  const glass = vec3(color(0x34404a));

  // 0. plaster with windows
  const win0 = aa(box(0.22, 0.78, 0.32, 0.8), 0.17).mul(lit);
  const col0 = mix(tint, glass, win0);

  // 1. blok: panel joints, a window per panel (ground floor: small basement windows), balcony slabs in every third
  //    bay, the stair core (every sixth bay) in the accent colour
  const core = float(1).sub(min(abs(mod(bi, 6).sub(3)), 1));
  const balcony = float(1).sub(min(abs(mod(bi, 3).sub(1)), 1)).mul(step(1, si)).mul(float(1).sub(core));
  const ground = float(1).sub(step(1, si));
  const joint = aa(float(1).sub(box(0.012, 0.988, 0.015, 0.985)), 0.05);
  const win1 = mix(mix(box(0.18, 0.82, 0.3, 0.74), box(0.38, 0.62, 0.18, 0.8), core), box(0.25, 0.75, 0.12, 0.3), ground);
  const slab = aa(box(0.02, 0.98, 0.0, 0.3), 0.29).mul(balcony);
  const panel = mix(tint, accent, core);
  const col1 = mix(mix(mix(panel, glass, aa(win1, 0.18).mul(lit)), panel.mul(0.78), slab.mul(lit)), panel.mul(0.62), joint);

  // 2. nowe osiedle: big windows, glass balcony fronts in every other bay, darker top floor, glazed ground floor
  const top = float(1).sub(min(abs(floors.sub(1).sub(si)), 1));
  const front = float(1).sub(mod(bi, 2)).mul(step(1, si));
  const win2 = mix(box(0.1, 0.9, 0.12, 0.9), box(0.05, 0.95, 0.05, 0.88), ground);
  const rail = box(0.04, 0.96, 0.0, 0.34).mul(front);
  const wall2 = mix(tint, accent, top);
  const col2 = mix(mix(wall2, glass, aa(win2, 0.6).mul(lit)), vec3(color(0x9fb4c0)), aa(rail, 0.31).mul(lit).mul(0.7));

  // 3. pawilon: shop windows 0.35-2.6 m with mullions, the sign fascia 2.75-3.35 m
  const wm = max(fwidth(y), 0.001);
  const band = (a, b) => smoothstep(float(a).sub(wm), float(a).add(wm), y).mul(float(1).sub(smoothstep(float(b).sub(wm), float(b).add(wm), y)));
  const shop = aa(edge(0.04, wu, cu).mul(float(1).sub(edge(0.96, wu, cu))), 0.92).mul(band(0.35, 2.6)).mul(step(0, u));
  const fascia = band(2.75, 3.35).mul(step(3.4, wallH));
  const col3 = mix(mix(tint, vec3(color(0x2c3640)), shop), accent, fascia);

  const win = mix(mix(mix(win0, aa(win1, 0.18).mul(lit), k1), aa(win2, 0.6).mul(lit), k2), shop, k3);
  mat.colorNode = mix(mix(mix(col0, col1, k1), col2, k2), col3, k3);
  mat.roughnessNode = mix(float(0.88), float(0.16), win);
  mat.metalnessNode = mix(float(0.0), float(0.35), win);
  return mat;
}

function createRoofMaterial() {
  return new THREE.MeshStandardNodeMaterial({ color: 0x8d8c88, roughness: 0.92, metalness: 0.0 });
}

const toPts = (flat) => {
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ x: flat[i], z: flat[i + 1] });
  return out;
};

// Walls of one ring (counter-clockwise in x/z: the outward normal of edge (ex, ez) is (ez, -ex)) up to height h, each
// with a whole number of bays about `bay` wide (none on walls under 60 % of a bay: uv.x stays negative there)
function pushWalls(ring, h, bay, look, w) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) continue;
    const ex = (b.x - a.x) / len, ez = (b.z - a.z) / len;
    const nx = ez, nz = -ex;
    const bays = Math.round(len / bay);
    const u0 = bays ? 0 : -1, u1 = bays ? bays : -1;
    // A, D, B and B, D, C: bottom start, top start, bottom end, top end
    const A = [a.x, 0, a.z], B = [b.x, 0, b.z], C = [b.x, h, b.z], D = [a.x, h, a.z];
    const uvA = [u0, 0], uvB = [u1, 0], uvC = [u1, h], uvD = [u0, h];
    for (const [p, t] of [[A, uvA], [D, uvD], [B, uvB], [B, uvB], [D, uvD], [C, uvC]]) {
      w.pos.push(...p);
      w.nrm.push(nx, 0, nz);
      w.uv.push(...t);
      w.tint.push(...look.tint);
      w.accent.push(...look.accent);
      w.kind.push(look.kind);
      w.wallH.push(h);
    }
  }
}

// Wall colliders of one ring: oriented boxes WALL_T thick just inside each wall, from the ground to the roof
function pushColliders(ring, h, out) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.3) continue;
    const ex = (b.x - a.x) / len, ez = (b.z - a.z) / len;
    const cx = (a.x + b.x) / 2 - ez * WALL_T / 2, cz = (a.z + b.z) / 2 + ex * WALL_T / 2; // inward: (-ez, ex)
    const hx = len / 2 + 0.05, hz = WALL_T / 2;
    const rx = Math.abs(ex) * hx + Math.abs(ez) * hz, rz = Math.abs(ez) * hx + Math.abs(ex) * hz;
    out.push({
      minX: cx - rx, maxX: cx + rx, minZ: cz - rz, maxZ: cz + rz, minY: 0, maxY: h,
      obb: { cx, cz, hx, hz, cs: ex, sn: -ez }
    });
  }
}

function buildCityBlocks(scene) {
  const group = new THREE.Group();
  group.name = 'BielanyBuildings';
  const facadeMat = createFacadeMaterial();
  const roofMat = createRoofMaterial();
  const tiles = new Map(); // tile key -> { walls, roofs }
  const colliders = [];
  const footprints = []; // for the maps: { h, pts }
  const tone = new THREE.Color();
  const rgb = (hex) => { tone.setHex(hex).convertSRGBToLinear(); return [tone.r, tone.g, tone.b]; };

  let fromOsm = 0;
  const byType = [0, 0, 0, 0];
  GEO.buildings.forEach(([outerFlat, holesFlat, h, source, type], id) => {
    if (source === 1) fromOsm++;
    byType[type || 0]++;
    if (!(h > 0.5)) return;
    const outer = toPts(outerFlat);
    const holes = holesFlat.map(toPts);
    let cx = 0, cz = 0;
    for (const p of outer) { cx += p.x; cz += p.z; }
    cx /= outer.length;
    cz /= outer.length;
    const key = `${Math.floor(cx / TILE)},${Math.floor(cz / TILE)}`;
    if (!tiles.has(key)) tiles.set(key, { walls: { pos: [], nrm: [], uv: [], tint: [], accent: [], kind: [], wallH: [] }, roofs: [] });
    const t = tiles.get(key);

    const T = TYPES[type] || TYPES[0];
    const hash = Math.imul(id + 1, 2654435761) >>> 0;
    const look = { kind: TYPES[type] ? type : 0, tint: rgb(T.tones[hash % T.tones.length]), accent: rgb(T.accents[(hash >>> 8) % T.accents.length]) };
    pushWalls(outer, h, T.bay, look, t.walls);
    for (const hole of holes) pushWalls(hole.slice().reverse(), h, T.bay, look, t.walls); // courtyard walls face inwards

    const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x, -p.z)));
    for (const hole of holes) shape.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(p.x, -p.z))));
    const roof = new THREE.ShapeGeometry(shape, 1);
    roof.rotateX(-Math.PI / 2);
    roof.translate(0, h, 0);
    roof.deleteAttribute('uv');
    t.roofs.push(roof);

    pushColliders(outer, h, colliders);
    for (const hole of holes) pushColliders(hole.slice().reverse(), h, colliders);
    footprints.push({ h, pts: outer });
  });

  let walls = 0;
  for (const [key, t] of tiles) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(t.walls.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(t.walls.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(t.walls.uv, 2));
    g.setAttribute('tint', new THREE.Float32BufferAttribute(t.walls.tint, 3));
    g.setAttribute('accent', new THREE.Float32BufferAttribute(t.walls.accent, 3));
    g.setAttribute('kind', new THREE.Float32BufferAttribute(t.walls.kind, 1));
    g.setAttribute('wallH', new THREE.Float32BufferAttribute(t.walls.wallH, 1));
    g.computeBoundingSphere();
    const wallMesh = new THREE.Mesh(g, facadeMat);
    wallMesh.name = `BuildingWalls ${key}`;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    const roofMesh = new THREE.Mesh(mergeGeometries(t.roofs, false), roofMat);
    roofMesh.name = `BuildingRoofs ${key}`;
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    group.add(wallMesh, roofMesh);
    walls += t.walls.pos.length / 18;
  }
  scene.add(group);
  console.info(`[buildings] ${footprints.length - fromOsm} LoD1 + ${fromOsm} OpenStreetMap buildings (${byType[1]} bloki, ${byType[2]} nowe osiedla, ${byType[3]} pawilony), ${walls} walls in ${tiles.size} tiles, ${colliders.length} wall colliders`);

  // allBlocks: what the maps draw (one group holding every footprint)
  return { group, colliders, allBlocks: [{ footprints }], update() {} };
}

export { buildCityBlocks };
