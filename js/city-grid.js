import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ISLAND_BOUNDS, BLOCKS, SIDEWALKS } from './city-config.js';
import { createRoadSurfaceMaterial, createParkLawnMaterial, createSidewalkMaterial, createCurbMaterial } from './tsl-materials.js';

// js/city-grid.js
// Builds the ground of Bielany (Faza 1: flat, no terrain): the roadway is everything between the blocks, so the MVP
// area is one asphalt plate; on it stand the blocks (curb islands from tools/geo-bielany.mjs, city-config.js BLOCKS)
// raised to the curb height, granite-grey curb faces, lawn on top and the sidewalks along their curbs. Beyond the area
// lawn runs out to the horizon haze.

const PLATE_MARGIN = 1500; // m of ground beyond the MVP area
const CURB = ISLAND_BOUNDS.sidewalkHeight; // block top above the roadway
const SIDEWALK_LIFT = 0.006; // sidewalk paving just above the lawn on the block top

// THREE.Shape (with holes) of an outline [{x, z}] in the plane the extrusion turns upright: shape y = -z
function shapeOf(poly, holes) {
  const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, -p.z)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, -p.z))));
  return shape;
}

// Merged geometry of many pieces (one draw)
function merge(geos) {
  return geos.length ? mergeGeometries(geos, false) : null;
}

// The vertices of material group `index` of a non-indexed geometry (an ExtrudeGeometry: 0 the caps, 1 the sides)
function groupPart(g, index) {
  const part = new THREE.BufferGeometry();
  const ranges = g.groups.filter((r) => r.materialIndex === index);
  for (const [name, attr] of Object.entries(g.attributes)) {
    const n = attr.itemSize;
    const out = new Float32Array(ranges.reduce((s, r) => s + r.count, 0) * n);
    let o = 0;
    for (const r of ranges) {
      out.set(attr.array.subarray(r.start * n, (r.start + r.count) * n), o);
      o += r.count * n;
    }
    part.setAttribute(name, new THREE.BufferAttribute(out, n));
  }
  return part;
}

function buildCityGrid(scene) {
  const group = new THREE.Group();
  group.name = 'BielanyCityGrid';
  const b = ISLAND_BOUNDS;

  // 1. Lawn out to the horizon, just below the area's asphalt plate
  const outerGeo = new THREE.PlaneGeometry(b.maxX - b.minX + 2 * PLATE_MARGIN, b.maxZ - b.minZ + 2 * PLATE_MARGIN, 1, 1);
  outerGeo.rotateX(-Math.PI / 2);
  const outer = new THREE.Mesh(outerGeo, createParkLawnMaterial(false));
  outer.name = 'GroundBeyond';
  outer.position.set((b.minX + b.maxX) / 2, -0.03, (b.minZ + b.maxZ) / 2);
  outer.receiveShadow = true;
  group.add(outer);

  // 2. The roadway: the whole MVP area (the blocks stand on it)
  const plateGeo = new THREE.PlaneGeometry(b.maxX - b.minX, b.maxZ - b.minZ, 1, 1);
  plateGeo.rotateX(-Math.PI / 2);
  const roadway = new THREE.Mesh(plateGeo, createRoadSurfaceMaterial());
  roadway.name = 'Roadway';
  roadway.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  roadway.receiveShadow = true;
  group.add(roadway);

  // 3. Blocks: extruded outlines, lawn on the top (the extrusion's caps) and curb faces (its sides)
  const tops = [];
  const curbs = [];
  for (const blk of BLOCKS) {
    const g = new THREE.ExtrudeGeometry(shapeOf(blk.poly, blk.holes), { depth: CURB, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    tops.push(groupPart(g, 0));
    curbs.push(groupPart(g, 1));
    g.dispose();
  }
  if (tops.length) {
    const lawn = new THREE.Mesh(merge(tops), createParkLawnMaterial(false));
    lawn.name = 'BlockTops';
    lawn.receiveShadow = true;
    const curb = new THREE.Mesh(merge(curbs), createCurbMaterial());
    curb.name = 'Curbs';
    curb.receiveShadow = true;
    curb.castShadow = true;
    group.add(lawn, curb);
  }

  // 4. Sidewalks: flat paving along the curbs on the block tops
  const walkGeo = merge(SIDEWALKS.map((s) => {
    const g = new THREE.ShapeGeometry(shapeOf(s.poly, s.holes), 1).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    g.translate(0, CURB + SIDEWALK_LIFT, 0);
    return g;
  }));
  if (walkGeo) {
    const walks = new THREE.Mesh(walkGeo, createSidewalkMaterial());
    walks.name = 'Sidewalks';
    walks.receiveShadow = true;
    group.add(walks);
  }

  scene.add(group);

  // The blocks bound the roads by their outlines (city-config.js blockAt), so no curb rectangles; no obstacles yet,
  // no shore highways
  return { group, sidewalks: [], footprints: [], highwayLanes: [], colliders: [] };
}

export { buildCityGrid };
