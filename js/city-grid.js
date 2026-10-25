import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ISLAND_BOUNDS, BLOCKS, SIDEWALKS } from './city-config.js';
import { texture, positionWorld, vec2, vec3, float, color, mix, fract, sin, dot, floor, smoothstep, fwidth, length, max, min } from 'three/tsl';
import { createRoadSurfaceMaterial, createParkLawnMaterial, createSidewalkMaterial, createCurbMaterial } from './tsl-materials.js';
import { GEO } from './bielany-geodata.js';
import { drapeGeometry, groundTiles } from './terrain.js';
import { withForestFloor, withForestPaths } from './forest.js';

// js/city-grid.js
// Builds the ground of Bielany: the roadway is everything between the blocks, so the MVP area is one asphalt plate
// (flat on the plateau, laid on the escarpment & the valley below it, js/terrain.js); on it stand the blocks (curb islands from tools/geo-bielany.mjs, city-config.js BLOCKS)
// raised to the curb height, granite-grey curb faces, lawn on top and the sidewalks along their curbs. Beyond the area
// lawn runs out to the horizon haze. Autumn: the lawns a little faded, and fallen leaves under and round every tree of
// the survey (a density map drawn from the crowns) on lawns, sidewalks & the roadway's edges.

const PLATE_MARGIN = 1500; // m of ground beyond the MVP area
const HORIZON = 20000; // m the outermost ground reaches further out, flat at its edge heights
const CURB = ISLAND_BOUNDS.sidewalkHeight; // block top above the roadway
const SIDEWALK_LIFT = 0.006; // sidewalk paving just above the lawn on the block top

// Fallen-leaf density over the MVP area (1.5 m per texel): a soft disc under each surveyed crown, a little wider
const LEAF_TEXEL = 1.5;
function leafDensityTexture() {
  const b = ISLAND_BOUNDS;
  const W = Math.ceil((b.maxX - b.minX) / LEAF_TEXEL), H = Math.ceil((b.maxZ - b.minZ) / LEAF_TEXEL);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const T = GEO.trees || [];
  for (let i = 0; i < T.length; i += 5) {
    const x = (T[i] - b.minX) / LEAF_TEXEL, z = (T[i + 1] - b.minZ) / LEAF_TEXEL, r = (T[i + 4] * 1.35 + 1) / LEAF_TEXEL;
    const g = ctx.createRadialGradient(x, z, 0, x, z, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, z - r, 2 * r, 2 * r);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

// A ground material with fallen leaves: scattered leaf-sized specks (yellow, orange, rust, brown) as dense as the map
// says times `amount`, faded to their mean colour once a speck is under a pixel; `fade` dulls the base towards a dry
// autumn yellow-green
function withLeaves(mat, density, amount, fade = 0) {
  const b = ISLAND_BOUNDS;
  const wp = positionWorld.xz;
  const st = vec2(wp.x.sub(b.minX).div(b.maxX - b.minX), wp.y.sub(b.minZ).div(b.maxZ - b.minZ));
  const d = texture(density, st).r.mul(amount);
  const cell = floor(wp.mul(7)); // ~14 cm leaves
  const r1 = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453));
  const r2 = fract(sin(dot(cell, vec2(39.3468, 11.135))).mul(24634.6345));
  const speck = smoothstep(float(1).sub(d), float(1).sub(d).add(0.08), r1);
  const leaf = mix(mix(vec3(color(0xc9a23a)), vec3(color(0xb8692a)), smoothstep(0.3, 0.6, r2)), vec3(color(0x7a4a26)), smoothstep(0.72, 0.95, r2));
  const far = smoothstep(0.08, 0.3, length(fwidth(wp)));
  const cover = mix(speck, d.mul(0.85), far);
  const base = mix(mat.colorNode, mat.colorNode.mul(vec3(1.06, 0.98, 0.78)), fade);
  mat.colorNode = mix(base, leaf, min(max(cover, float(0)), float(1)));
  return mat;
}

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

  // 1. Lawn out to the horizon round the area's asphalt plate (just below its edge): four strips on the terrain
  const M = PLATE_MARGIN, H = HORIZON;
  const strips = [
    [b.minX - M, b.minZ - M, b.minX, b.maxZ + M, { w: H, n: H, s: H }],
    [b.maxX, b.minZ - M, b.maxX + M, b.maxZ + M, { e: H, n: H, s: H }],
    [b.minX, b.minZ - M, b.maxX, b.minZ, { n: H }],
    [b.minX, b.maxZ, b.maxX, b.maxZ + M, { s: H }]
  ];
  const leaves = leafDensityTexture();
  const outerGeo = merge(strips.flatMap(([x0, z0, x1, z1, skirt]) => groundTiles(x0, z0, x1, z1, { skirt, every: 2 })));
  const outer = new THREE.Mesh(outerGeo, withLeaves(createParkLawnMaterial(false), leaves, 0, 0.35));
  outer.name = 'GroundBeyond';
  outer.position.y = -0.03;
  outer.receiveShadow = true;
  group.add(outer);

  // 2. The roadway: the whole MVP area (the blocks stand on it)
  const plateGeo = merge(groundTiles(b.minX, b.minZ, b.maxX, b.maxZ));
  const roadway = new THREE.Mesh(plateGeo, withLeaves(createRoadSurfaceMaterial(), leaves, 0.35));
  roadway.name = 'Roadway';
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
    for (const part of [tops.at(-1), curbs.at(-1)]) part.deleteAttribute('uv'); // their materials paint by world position
    g.dispose();
  }
  if (tops.length) {
    // in the woods the lawn is a forest floor with paths (js/forest.js)
    const lawn = new THREE.Mesh(drapeGeometry(merge(tops)), withForestPaths(withLeaves(withForestFloor(createParkLawnMaterial(false)), leaves, 1.0, 0.35)));
    lawn.name = 'BlockTops';
    lawn.receiveShadow = true;
    const curb = new THREE.Mesh(drapeGeometry(merge(curbs)), createCurbMaterial());
    curb.name = 'Curbs';
    curb.receiveShadow = true;
    curb.castShadow = true;
    group.add(lawn, curb);
  }

  // 4. Sidewalks: flat paving along the curbs on the block tops
  const walkGeo = drapeGeometry(merge(SIDEWALKS.map((s) => {
    const g = new THREE.ShapeGeometry(shapeOf(s.poly, s.holes), 1).toNonIndexed();
    g.deleteAttribute('uv'); // the paving is painted by world position
    g.rotateX(-Math.PI / 2);
    g.translate(0, CURB + SIDEWALK_LIFT, 0);
    return g;
  })));
  if (walkGeo) {
    const walks = new THREE.Mesh(walkGeo, withLeaves(createSidewalkMaterial(), leaves, 0.6));
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
