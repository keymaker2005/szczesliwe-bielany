import * as THREE from 'three/webgpu';
import { attribute, uv, fract, floor, mod, mix, color, float, vec3, smoothstep, step, fwidth, max, min, abs, sin } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundY } from './terrain.js';
import { GEO } from './bielany-geodata.js';

// js/buildings.js
// The buildings of Bielany: every GUGiK LoD1 2024 footprint (js/bielany-geodata.js) extruded to its measured height,
// and the newer buildings LoD1 misses (OpenStreetMap, 3 m per storey), flat-roofed, with a facade by type (tools/
// geo-bielany.mjs classifies them), after photographs of Wawrzyszew, Chomiczówka, Wrzeciono & Stare Bielany:
//   1 niska płyta (4-5 storeys): cream panels, a terracotta plinth on the ground floor, a protruding balcony (3D) in
//     every third bay
//   4 wysoka płyta (10-12 storeys): a colour per staircase section (pastels; Chomiczówka: white with blue, yellow, red
//     & lime bands down the loggia bays), loggias with coloured parapets in every third bay
//   both slabs: panel joints, blank gable ends with a vertical colour band, small basement windows on the ground floor
//   5 blok z lat 50. (3-4 storeys): ochre plaster, a darker plinth, deep windows with white frames, a cornice (3D)
//   2 nowe osiedle: big windows on 3.1 m storeys, glass balcony fronts in every other bay, a darker top floor and a
//     glazed ground floor
//   3 pawilon: a band of shop windows with mullions every 2 m, a sign fascia in the accent colour (no names)
//   0 the rest: plaster with a window every 3 m x 2.8 m
//
// Walls carry uv = (window bays along the wall: a whole number of them, each about the type's bay width; metres above
// the ground) and the wall's bay count & height, so windows never wrap round a corner, a top storey cut short stays
// blank (the parapet) and gables know where their band goes. Geometry is merged per 500 m tile (two draws each: walls
// & roofs; balconies & cornices are instanced) for frustum culling. Players collide with every wall as a thin oriented
// box just inside it, so courtyards of L- and U-shaped blocks stay open.

const TILE = 500; // m
const WALL_T = 1.2; // m: thickness of a wall's collider, inside the wall
const GABLE = 16; // m: slab walls shorter than this are gable ends (no windows)
const SECTION = 6; // bays per staircase section (one colour each on the high slabs)

// Per facade type: bay width m, storey height m, wall tones, accents (plinths, bands, parapets, fascias) and, for the
// low slabs, balcony fronts. High slabs in Chomiczówka take the bold set: white walls and band colours.
const TYPES = {
  0: { bay: 3.0, storey: 2.8, walls: [0xe3ddd0, 0xd8d3c8, 0xe6dcc0, 0xcfd2cf, 0xded3bf], accents: [0xb9ad98] },
  1: { bay: 3.6, storey: 2.8, walls: [0xece2c8, 0xe9dbb8, 0xf0e8d4, 0xe4d9c0], accents: [0xb4664c, 0xa95a43, 0xbd7458],
    fronts: [0xf1ede4, 0xd9b48c, 0xc98a62, 0x8f9aa3] },
  4: { bay: 3.6, storey: 2.8, walls: [0xeee1a8, 0xeac2a8, 0xd2e1c6, 0xcad5dd, 0xefe6d2, 0xe8cccb],
    accents: [0xc9a46a, 0x7fa9b3, 0xd39a74, 0xd9b56b], boldWalls: [0xf2f0ea], boldBands: [0x3f78c8, 0xf0cf3a, 0xd9583c, 0x9ccc52] },
  5: { bay: 3.2, storey: 3.2, walls: [0xc9b48e, 0xbfb08d, 0xd2c19c, 0xc6ad86], accents: [0x9a8a6c, 0x8f7f63] },
  2: { bay: 3.0, storey: 3.1, walls: [0xf0eee9, 0xe8e4dc, 0xdedad2, 0xc8c4bc], accents: [0x3d3f44, 0x8a6a52, 0x5b6470] },
  3: { bay: 2.0, storey: 3.4, walls: [0xd8d2c4, 0xcac6bd, 0xe0d8c8], accents: [0x2f6f9f, 0xb8463e, 0x3f8a5a, 0xd2a03a] }
};

function createFacadeMaterial() {
  const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0.0 });
  // Seven vertex buffers (WebGPU allows eight): position, normal, uv and
  const info = attribute('info', 'vec4'); // type, wall height, bays on the wall (0: a gable or a narrow wall), 0..1 per building
  const tint = attribute('tint', 'vec4'); // wall colour, 1 for the bold palette (Chomiczówka)
  const kind = info.x, wallH = info.y, wallB = info.z, bid = info.w;
  const bold = tint.w;
  const segA = tint.xyz;
  const segB = attribute('tintB', 'vec3'); // the second section colour (bold: a band colour)
  const accent = attribute('accent', 'vec3'); // plinths, gable bands, parapets, fascias (bold: the other band colour)
  const segC = mix(segA, segB, 0.5);
  const is = (k) => float(1).sub(min(abs(kind.sub(k)).mul(2), 1)); // 1 for this type, else 0
  const k1 = is(1), k2 = is(2), k3 = is(3), k4 = is(4), k5 = is(5);
  const slabK = k1.add(k4);
  const storey = mix(mix(mix(mix(float(2.8), float(3.1), k2), float(3.4), k3), float(3.2), k5), float(2.8), slabK);

  const u = uv().x; // bays along the wall (gables & narrow walls: 0..-1 along it)
  const y = uv().y; // metres above the ground
  const v = y.div(storey);
  const cu = fract(u), cv = fract(v);
  const bi = floor(u), si = floor(v);
  const floors = floor(wallH.div(storey)); // whole storeys under the roof (a top storey cut short is the parapet)
  const hasBays = step(0.5, wallB);
  const lit = hasBays.mul(step(si.add(1), floors)); // window storeys on walls with bays
  const ground = float(1).sub(step(1, si));
  const above = step(1, si);
  // anti-aliased box [a0, a1] x [b0, b1] in the bay & storey cell, faded to its mean once under a pixel
  const wu = max(fwidth(u), 0.001), wv = max(fwidth(v), 0.001), wy = max(fwidth(y), 0.001);
  const far = smoothstep(0.25, 0.6, max(wu, wv));
  const edge = (e, w, x) => smoothstep(float(e).sub(w), float(e).add(w), x);
  const box = (a0, a1, b0, b1) => edge(a0, wu, cu).mul(float(1).sub(edge(a1, wu, cu)))
    .mul(edge(b0, wv, cv)).mul(float(1).sub(edge(b1, wv, cv)));
  const band = (a, b) => edge(a, wy, y).mul(float(1).sub(edge(b, wy, y)));
  const aa = (m, mean) => mix(m, float(mean), far);
  const glass = vec3(color(0x2e3a44));
  const frameC = vec3(color(0xf2f1ec));
  // A window [a0, a1] x [b0, b1] set into a wall: white frame, glass, the reveal's shadow along its top & left edge
  // (sunk into the wall); far away a flat mix of wall & glass
  const windowIn = (wall, a0, a1, b0, b1, frame, reveal) => {
    const share = (a1 - a0) * (b1 - b0) * 0.8;
    const outer = box(a0, a1, b0, b1);
    const pane = box(a0 + frame, a1 - frame, b0 + frame * 1.6, b1 - frame * 1.6);
    const shade = min(box(a0, a1, b1 - reveal, b1).add(box(a0, a0 + reveal * 0.5, b0, b1)), float(1)).mul(outer).mul(0.55);
    const near = mix(mix(mix(wall, frameC, outer), glass, pane), mix(wall, frameC, outer).mul(0.45), shade);
    return { col: mix(near, mix(wall, glass, float(share)), far), win: aa(pane, share) };
  };
  // pseudo-random 0..1 per staircase section of each building
  const sec = floor(u.div(SECTION));
  const rnd = fract(sin(sec.mul(12.9898).add(bid.mul(78.233))).mul(43758.5453));

  // 0. plaster with windows
  const w0 = windowIn(segA, 0.24, 0.76, 0.32, 0.8, 0.03, 0.12);
  const col0 = mix(segA, w0.col, lit);

  // 1 & 4. prefab slabs: joints, a window per panel, basement windows, balcony / loggia bays, gable bands
  const third = float(1).sub(min(abs(mod(bi, 3).sub(1)), 1)); // the balcony / loggia bays
  const balconyBay = third.mul(above);
  const pastelSection = mix(mix(segA, segB, step(0.34, rnd)), segC, step(0.67, rnd));
  const boldBand = mix(segB, accent, step(0.5, rnd));
  const slabWall = mix(mix(segA, pastelSection, k4), mix(segA, boldBand, third), bold); // a colour per section
  const wSlab = windowIn(slabWall, 0.2, 0.8, 0.3, 0.74, 0.035, 0.14);
  const wDoor = windowIn(slabWall, 0.14, 0.52, 0.04, 0.76, 0.035, 0.12); // balcony door & window
  const wBase = windowIn(slabWall, 0.28, 0.72, 0.12, 0.3, 0.04, 0.1);
  let col1 = mix(mix(wSlab.col, wDoor.col, balconyBay), wBase.col, ground);
  col1 = mix(slabWall, col1, lit);
  // loggias (high slabs): the recess dark above a parapet panel in the bay's lower third
  const recess = aa(box(0.06, 0.94, 0.34, 1.0), 0.6).mul(balconyBay).mul(k4).mul(lit);
  const parapet = aa(box(0.06, 0.94, 0.0, 0.34), 0.28).mul(balconyBay).mul(k4).mul(lit);
  col1 = mix(col1, mix(slabWall, glass, 0.6).mul(0.5), recess);
  col1 = mix(col1, mix(accent, slabWall.mul(0.9), bold), parapet);
  // low slabs: the terracotta plinth up to the first floor (the basement windows stay)
  col1 = mix(col1, accent, band(0, 3.0).mul(k1).mul(float(1).sub(min(wBase.win.mul(4), float(1)))).mul(hasBays));
  // panel joints
  const joint = aa(float(1).sub(box(0.01, 0.99, 0.012, 0.988)), 0.04).mul(hasBays);
  col1 = mix(col1, col1.mul(0.74), joint);
  // gable ends: blank, a vertical band in the accent colour
  const t = u.negate();
  const gableBand = edge(0.55, wu, t).mul(float(1).sub(edge(0.82, wu, t)));
  col1 = mix(col1, mix(slabWall, mix(accent, segB, bold), gableBand), float(1).sub(hasBays));

  // 5. 1950s blocks: deep windows with white frames, darker plinth
  const w5 = windowIn(segA, 0.26, 0.74, 0.28, 0.82, 0.05, 0.2);
  const col5 = mix(mix(segA, w5.col, lit), accent, band(0, 1.1));

  // 2. nowe osiedle: big windows, glass balcony fronts in every other bay, darker top floor, glazed ground floor
  const top = float(1).sub(min(abs(floors.sub(1).sub(si)), 1));
  const front = float(1).sub(mod(bi, 2)).mul(above);
  const wall2 = mix(segA, accent, top);
  const w2 = windowIn(wall2, 0.1, 0.9, 0.12, 0.9, 0.02, 0.08);
  const w2g = windowIn(wall2, 0.05, 0.95, 0.05, 0.88, 0.015, 0.05);
  const rail = aa(box(0.04, 0.96, 0.0, 0.34), 0.31).mul(front);
  const col2 = mix(mix(wall2, mix(w2.col, w2g.col, ground), lit), vec3(color(0x9fb4c0)), rail.mul(lit).mul(0.7));

  // 3. pawilon: shop windows 0.35-2.6 m with mullions, the sign fascia 2.75-3.35 m
  const shop = aa(edge(0.04, wu, cu).mul(float(1).sub(edge(0.96, wu, cu))), 0.92).mul(band(0.35, 2.6)).mul(hasBays);
  const fascia = band(2.75, 3.35).mul(step(3.4, wallH));
  const col3 = mix(mix(segA, vec3(color(0x2c3640)), shop), accent, fascia);

  const win = mix(mix(mix(mix(w0.win, wSlab.win, slabK), w2.win, k2), shop, k3), w5.win, k5).mul(mix(lit, float(1), k3));
  mat.colorNode = mix(mix(mix(mix(col0, col1, slabK), col2, k2), col3, k3), col5, k5);
  mat.roughnessNode = mix(float(0.9), float(0.16), win);
  mat.metalnessNode = mix(float(0.0), float(0.3), win);
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
// with a whole number of bays about `bay` wide. Walls under 60 % of a bay, and the gable ends of slabs, have none:
// their uv.x runs 0..-1 along the wall instead. onWall(a, ex, ez, len, bays) is called for every wall with bays.
function pushWalls(ring, h, look, w, onWall) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) continue;
    const ex = (b.x - a.x) / len, ez = (b.z - a.z) / len;
    const nx = ez, nz = -ex;
    const bays = look.slab && len < GABLE ? 0 : Math.round(len / look.bay);
    const u1 = bays || -1;
    // A, D, B and B, D, C: bottom start, top start, bottom end, top end
    const A = [a.x, 0, a.z], B = [b.x, 0, b.z], C = [b.x, h, b.z], D = [a.x, h, a.z];
    const uvA = [0, 0], uvB = [u1, 0], uvC = [u1, h], uvD = [0, h];
    for (const [p, t] of [[A, uvA], [D, uvD], [B, uvB], [B, uvB], [D, uvD], [C, uvC]]) {
      w.pos.push(...p);
      w.nrm.push(nx, 0, nz);
      w.uv.push(...t);
      w.tint.push(...look.tint, look.bold);
      w.tintB.push(...look.tintB);
      w.accent.push(...look.accent);
      w.info.push(look.kind, h, bays, look.bid);
    }
    if (bays) onWall(a, ex, ez, len, bays);
  }
}

// Wall colliders of one ring: oriented boxes WALL_T thick just inside each wall, from the ground to the roof
// base: the ground under the building (js/terrain.js; 0 on the plateau); its walls reach well below it on a slope
function pushColliders(ring, h, out, base = 0) {
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
      minX: cx - rx, maxX: cx + rx, minZ: cz - rz, maxZ: cz + rz, minY: base ? base - 40 : 0, maxY: base + h, base,
      obb: { cx, cz, hx, hz, cs: ex, sn: -ez }
    });
  }
}

// Balcony of the low slabs in its own frame (x along the wall, unit width; z out of it; y up from the slab's
// underside): a concrete slab 1.2 m deep, and the front & side parapets (which take the instance colour)
function balconyParts() {
  const slab = new THREE.BoxGeometry(1, 0.14, 1.2).translate(0, 0.07, 0.6);
  const front = new THREE.BoxGeometry(1, 1.0, 0.06).translate(0, 0.64, 1.17);
  const left = new THREE.BoxGeometry(0.03, 1.0, 1.2).translate(-0.485, 0.64, 0.6);
  const right = left.clone().translate(0.97, 0, 0);
  return { slab, rails: mergeGeometries([front, left, right], false) };
}

// skip: building indices (GEO.buildings) modelled by js/landmarks.js instead: they keep their colliders and their
// footprints on the maps, but get no walls or roof here
function buildCityBlocks(scene, { skip = new Set() } = {}) {
  const group = new THREE.Group();
  group.name = 'BielanyBuildings';
  const facadeMat = createFacadeMaterial();
  const roofMat = createRoofMaterial();
  const tiles = new Map(); // tile key -> { walls, roofs }
  const colliders = [];
  const footprints = []; // for the maps: { h, pts }
  const tone = new THREE.Color();
  const rgb = (hex) => { tone.setHex(hex).convertSRGBToLinear(); return [tone.r, tone.g, tone.b]; };
  const balconies = []; // { m: Matrix4, c: front colour }
  const cornices = []; // Matrix4
  const m4 = new THREE.Matrix4(), basis = new THREE.Matrix4(), scale = new THREE.Matrix4();
  const along = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), out = new THREE.Vector3();

  let fromOsm = 0;
  const byType = [0, 0, 0, 0, 0, 0];
  GEO.buildings.forEach(([outerFlat, holesFlat, h, source, type, palette], id) => {
    if (source === 1) fromOsm++;
    byType[type || 0]++;
    if (!(h > 0.5)) return;
    const outer = toPts(outerFlat);
    const holes = holesFlat.map(toPts);
    // On the escarpment the building stands at the lowest ground under its outline, the uphill side in the slope
    let base = 0;
    for (const p of outer) base = Math.min(base, groundY(p.x, p.z));
    if (skip.has(id)) {
      pushColliders(outer, h, colliders, base);
      for (const hole of holes) pushColliders(hole.slice().reverse(), h, colliders, base);
      footprints.push({ h, pts: outer });
      return;
    }
    let cx = 0, cz = 0;
    for (const p of outer) { cx += p.x; cz += p.z; }
    cx /= outer.length;
    cz /= outer.length;
    const key = `${Math.floor(cx / TILE)},${Math.floor(cz / TILE)}`;
    if (!tiles.has(key)) {
      tiles.set(key, { walls: { pos: [], nrm: [], uv: [], tint: [], tintB: [], accent: [], info: [] }, roofs: [] });
    }
    const t = tiles.get(key);

    const T = TYPES[type] || TYPES[0];
    const hash = Math.imul(id + 1, 2654435761) >>> 0;
    const bold = type === 4 && palette === 1;
    const pick = (list, k) => list[(hash >>> k) % list.length];
    const i0 = hash % T.walls.length;
    const look = {
      kind: TYPES[type] ? type : 0, bay: T.bay, slab: type === 1 || type === 4, bid: (hash % 1000) / 1000, bold: bold ? 1 : 0,
      // the wall colour and a second section colour (bold: white, and two of the band colours)
      tint: rgb(bold ? T.boldWalls[0] : T.walls[i0]),
      tintB: rgb(bold ? pick(T.boldBands, 5) : T.walls[(i0 + 1 + ((hash >>> 9) % 2)) % T.walls.length]),
      accent: rgb(bold ? T.boldBands[((hash >>> 5) + 1 + ((hash >>> 11) % 3)) % T.boldBands.length] : pick(T.accents, 3))
    };
    const front = T.fronts ? pick(T.fronts, 13) : 0xffffff;
    const floors = Math.floor(h / T.storey);
    // Low slabs: a balcony on every storey but the ground floor in every third bay; 1950s blocks: a cornice
    const onWall = (a, ex, ez, len, bays) => {
      along.set(ex, 0, ez);
      out.set(ez, 0, -ex);
      basis.makeBasis(along, up, out);
      if (type === 1) {
        for (let k = 1; k < bays; k += 3) {
          const s0 = ((k + 0.5) / bays) * len;
          for (let s = 1; s < floors; s++) {
            scale.makeScale((len / bays) * 0.86, 1, 1);
            m4.multiplyMatrices(basis, scale).setPosition(a.x + ex * s0, base + s * T.storey - 0.08, a.z + ez * s0);
            balconies.push({ m: m4.clone(), c: front });
          }
        }
      } else if (type === 5) {
        scale.makeScale(len + 0.5, 0.42, 0.5);
        m4.multiplyMatrices(basis, scale).setPosition(a.x + ex * len / 2 + ez * 0.2, base + h - 0.55, a.z + ez * len / 2 - ex * 0.2);
        cornices.push(m4.clone());
      }
    };
    const first = t.walls.pos.length;
    pushWalls(outer, h, look, t.walls, onWall);
    for (const hole of holes) pushWalls(hole.slice().reverse(), h, look, t.walls, onWall); // courtyard walls face inwards
    if (base) for (let k = first + 1; k < t.walls.pos.length; k += 3) t.walls.pos[k] += base;

    const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x, -p.z)));
    for (const hole of holes) shape.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(p.x, -p.z))));
    const roof = new THREE.ShapeGeometry(shape, 1);
    roof.rotateX(-Math.PI / 2);
    roof.translate(0, base + h, 0);
    roof.deleteAttribute('uv');
    t.roofs.push(roof);

    pushColliders(outer, h, colliders, base);
    for (const hole of holes) pushColliders(hole.slice().reverse(), h, colliders, base);
    footprints.push({ h, pts: outer });
  });

  let walls = 0;
  for (const [key, t] of tiles) {
    const g = new THREE.BufferGeometry();
    const W = t.walls;
    g.setAttribute('position', new THREE.Float32BufferAttribute(W.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(W.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(W.uv, 2));
    g.setAttribute('tint', new THREE.Float32BufferAttribute(W.tint, 4));
    g.setAttribute('tintB', new THREE.Float32BufferAttribute(W.tintB, 3));
    g.setAttribute('accent', new THREE.Float32BufferAttribute(W.accent, 3));
    g.setAttribute('info', new THREE.Float32BufferAttribute(W.info, 4));
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
    walls += W.pos.length / 18;
  }

  // Balconies (concrete slabs; parapets in the building's front colour) and cornices, instanced
  const instanced = (geo, mat, count, name) => {
    const im = new THREE.InstancedMesh(geo, mat, count);
    im.name = name;
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
    return im;
  };
  if (balconies.length) {
    const { slab, rails } = balconyParts();
    const slabs = instanced(slab, new THREE.MeshStandardNodeMaterial({ color: 0xa7a49c, roughness: 0.9 }), balconies.length, 'BalconySlabs');
    const fronts = instanced(rails, new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.75 }), balconies.length, 'BalconyFronts');
    const c = new THREE.Color();
    balconies.forEach((b, i) => {
      slabs.setMatrixAt(i, b.m);
      fronts.setMatrixAt(i, b.m);
      fronts.setColorAt(i, c.setHex(b.c));
    });
    slabs.computeBoundingSphere();
    fronts.computeBoundingSphere();
  }
  if (cornices.length) {
    const im = instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardNodeMaterial({ color: 0xd9ccae, roughness: 0.85 }), cornices.length, 'Cornices');
    cornices.forEach((m, i) => im.setMatrixAt(i, m));
    im.computeBoundingSphere();
  }
  scene.add(group);
  console.info(`[buildings] ${footprints.length - fromOsm} LoD1 + ${fromOsm} OpenStreetMap buildings (${byType[1]} niskie płyty, ` +
    `${byType[4]} wysokie płyty, ${byType[5]} z lat 50., ${byType[2]} nowe osiedla, ${byType[3]} pawilony), ${walls} walls, ` +
    `${balconies.length} balconies, ${cornices.length} cornices in ${tiles.size} tiles, ${colliders.length} wall colliders`);

  // allBlocks: what the maps draw (one group holding every footprint)
  return { group, colliders, allBlocks: [{ footprints }], update() {} };
}

export { buildCityBlocks };
