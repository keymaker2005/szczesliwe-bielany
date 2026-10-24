import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ISLAND_BOUNDS } from './city-config.js';
import { createRoadSurfaceMaterial, createParkLawnMaterial } from './tsl-materials.js';
import { GEO } from './bielany-geodata.js';

// js/city-grid.js
// Builds the ground of Bielany: a flat plate (Faza 1: no terrain) reaching well past the MVP area, and the roadway of
// every drivable street of the OpenStreetMap graph (js/bielany-geodata.js) at its curb-to-curb width, with round
// joins at the junctions and bends. Blocks, curbs & sidewalks come in step 1.2b.

const PLATE_MARGIN = 1500; // m of ground beyond the MVP area, out to the horizon haze
const ROAD_Y = 0.0; // roadway top
const PLATE_Y = -0.03; // the plate just below it, so the asphalt always wins

// Ribbon of half width h along a polyline [{x, z}] (mitred at the inner points, the mitre capped at 2h)
function ribbon(pts, h, pos, idx) {
  const n = pts.length;
  const base = pos.length / 3;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    // unit directions of the segments before and after p
    let ux = p.x - a.x, uz = p.z - a.z;
    let vx = b.x - p.x, vz = b.z - p.z;
    const lu = Math.hypot(ux, uz) || 1, lv = Math.hypot(vx, vz) || 1;
    ux /= lu; uz /= lu; vx /= lv; vz /= lv;
    if (i === 0) { ux = vx; uz = vz; }
    if (i === n - 1) { vx = ux; vz = uz; }
    // mitre: the mean of the two right normals, scaled to keep the half width
    let mx = -(uz + vz), mz = ux + vx;
    const lm = Math.hypot(mx, mz) || 1;
    mx /= lm; mz /= lm;
    const cos = Math.max(0.5, mx * -uz + mz * ux);
    const s = h / cos;
    pos.push(p.x + mx * s, ROAD_Y, p.z + mz * s, p.x - mx * s, ROAD_Y, p.z - mz * s);
    if (i > 0) {
      const k = base + 2 * (i - 1);
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); // facing up
    }
  }
}

// Disc of radius r at (x, z): the round join where streets meet or bend
function disc(x, z, r, pos, idx) {
  const seg = Math.max(10, Math.min(28, Math.round(r * 2)));
  const base = pos.length / 3;
  pos.push(x, ROAD_Y, z);
  for (let k = 0; k <= seg; k++) {
    const t = (k / seg) * Math.PI * 2;
    pos.push(x + Math.cos(t) * r, ROAD_Y, z - Math.sin(t) * r);
    if (k > 0) idx.push(base, base + k, base + k + 1);
  }
}

function roadwayGeometry() {
  const RG = GEO.roadGraph;
  const node = (i) => ({ x: RG.nodes[2 * i], z: RG.nodes[2 * i + 1] });
  const joinR = new Map(); // node -> half width of the widest street meeting there
  const geos = [];
  let pos = [];
  let idx = [];
  const flush = () => {
    if (!idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    geos.push(g);
    pos = [];
    idx = [];
  };
  for (const [a, b, , w, , , inner] of RG.links) {
    const pts = [node(a)];
    for (let k = 0; k < inner.length; k += 2) pts.push({ x: inner[k], z: inner[k + 1] });
    pts.push(node(b));
    const h = Math.max(2.5, w / 2);
    ribbon(pts, h, pos, idx);
    for (let k = 1; k < pts.length - 1; k++) disc(pts[k].x, pts[k].z, h, pos, idx);
    for (const i of [a, b]) joinR.set(i, Math.max(joinR.get(i) || 0, h));
    if (pos.length > 180000) flush();
  }
  for (const [i, r] of joinR) {
    const p = node(i);
    disc(p.x, p.z, r, pos, idx);
  }
  flush();
  const merged = mergeGeometries(geos, false);
  // Upward normals and world-space uv (the road material works in world space)
  const n = merged.attributes.position.count;
  const normals = new Float32Array(n * 3);
  const uvs = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    normals[3 * i + 1] = 1;
    uvs[2 * i] = merged.attributes.position.getX(i);
    uvs[2 * i + 1] = merged.attributes.position.getZ(i);
  }
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.computeBoundingSphere();
  return merged;
}

function buildCityGrid(scene) {
  const group = new THREE.Group();
  group.name = 'BielanyCityGrid';

  // 1. The ground plate: lawn and bare ground between the streets for now (blocks & sidewalks in step 1.2b)
  const b = ISLAND_BOUNDS;
  const plateGeo = new THREE.PlaneGeometry(b.maxX - b.minX + 2 * PLATE_MARGIN, b.maxZ - b.minZ + 2 * PLATE_MARGIN, 1, 1);
  plateGeo.rotateX(-Math.PI / 2);
  const plate = new THREE.Mesh(plateGeo, createParkLawnMaterial(false));
  plate.name = 'GroundPlate';
  plate.position.set((b.minX + b.maxX) / 2, PLATE_Y, (b.minZ + b.maxZ) / 2);
  plate.receiveShadow = true;
  group.add(plate);

  // 2. The roadway of every drivable street, merged into one mesh
  const roads = new THREE.Mesh(roadwayGeometry(), createRoadSurfaceMaterial());
  roads.name = 'Roadway';
  roads.receiveShadow = true;
  group.add(roads);

  scene.add(group);

  // Nothing raised yet: no curbs for the traffic to keep to (step 1.2b), no obstacles, no shore highways
  return { group, sidewalks: [], footprints: [], highwayLanes: [], colliders: [] };
}

export { buildCityGrid };
