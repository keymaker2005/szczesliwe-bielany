import * as THREE from 'three/webgpu';
import { attribute, uv, fract, mix, color, float, vec3, smoothstep, fwidth, max } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GEO } from './bielany-geodata.js';

// js/buildings.js
// The buildings of Bielany: every GUGiK LoD1 2024 footprint (js/bielany-geodata.js) extruded to its measured height,
// flat-roofed, with a simple facade (step 1.3): plaster in a few light tones and a grid of windows, one bay every 3 m
// along the wall and one storey every 2.8 m. The facade types (blok, nowe osiedle, pawilon) come in step 1.4.
//
// Walls carry uv = (metres along the building's perimeter, metres above the ground), so the windows keep their size on
// walls at any angle. Geometry is merged per 500 m tile (two draws each: walls & roofs) for frustum culling. Players
// collide with every wall as a thin oriented box just inside it, so courtyards of L- and U-shaped blocks stay open.

const TILE = 500; // m
const BAY = 3.0; // m of wall per window bay
const STOREY = 2.8; // m per storey
const WALL_T = 1.2; // m: thickness of a wall's collider, inside the wall
// Plaster tones (light, as on Bielany's blocks): picked per building
const TONES = [0xe3ddd0, 0xd8d3c8, 0xe6dcc0, 0xcfd2cf, 0xded3bf, 0xe9e4da];

function createFacadeMaterial() {
  const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0.0 });
  const u = uv().x.div(BAY);
  const v = uv().y.div(STOREY);
  // window opening in each bay & storey, anti-aliased by the pixel footprint (fades to the mean far away)
  const cu = fract(u);
  const cv = fract(v);
  const wu = max(fwidth(u), 0.001);
  const wv = max(fwidth(v), 0.001);
  const edge = (e, w, x) => smoothstep(float(e).sub(w), float(e).add(w), x);
  const inU = edge(0.22, wu, cu).mul(float(1).sub(edge(0.78, wu, cu)));
  const inV = edge(0.32, wv, cv).mul(float(1).sub(edge(0.8, wv, cv)));
  const far = smoothstep(0.25, 0.6, max(wu, wv)); // windows under a pixel: their mean
  const win = mix(inU.mul(inV), float(0.3), far);
  const tint = attribute('tint', 'vec3');
  mat.colorNode = mix(tint, vec3(color(0x34404a)), win);
  mat.roughnessNode = mix(float(0.88), float(0.18), win);
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

// Walls of one ring (counter-clockwise in x/z: the outward normal of edge (ex, ez) is (ez, -ex)) up to height h
function pushWalls(ring, h, tint, w) {
  let u = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) continue;
    const ex = (b.x - a.x) / len, ez = (b.z - a.z) / len;
    const nx = ez, nz = -ex;
    // A, D, B and B, D, C: bottom start, top start, bottom end, top end
    const A = [a.x, 0, a.z], B = [b.x, 0, b.z], C = [b.x, h, b.z], D = [a.x, h, a.z];
    const uvA = [u, 0], uvB = [u + len, 0], uvC = [u + len, h], uvD = [u, h];
    for (const [p, t] of [[A, uvA], [D, uvD], [B, uvB], [B, uvB], [D, uvD], [C, uvC]]) {
      w.pos.push(...p);
      w.nrm.push(nx, 0, nz);
      w.uv.push(...t);
      w.tint.push(...tint);
    }
    u += len;
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

  GEO.buildings.forEach(([outerFlat, holesFlat, h], id) => {
    if (!(h > 0.5)) return;
    const outer = toPts(outerFlat);
    const holes = holesFlat.map(toPts);
    let cx = 0, cz = 0;
    for (const p of outer) { cx += p.x; cz += p.z; }
    cx /= outer.length;
    cz /= outer.length;
    const key = `${Math.floor(cx / TILE)},${Math.floor(cz / TILE)}`;
    if (!tiles.has(key)) tiles.set(key, { walls: { pos: [], nrm: [], uv: [], tint: [] }, roofs: [] });
    const t = tiles.get(key);

    tone.setHex(TONES[(Math.imul(id + 1, 2654435761) >>> 0) % TONES.length]).convertSRGBToLinear();
    const tint = [tone.r, tone.g, tone.b];
    pushWalls(outer, h, tint, t.walls);
    for (const hole of holes) pushWalls(hole.slice().reverse(), h, tint, t.walls); // courtyard walls face inwards

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
  console.info(`[buildings] ${footprints.length} LoD1 buildings, ${walls} walls in ${tiles.size} tiles, ${colliders.length} wall colliders`);

  // allBlocks: what the maps draw (one group holding every footprint)
  return { group, colliders, allBlocks: [{ footprints }], update() {} };
}

export { buildCityBlocks };
