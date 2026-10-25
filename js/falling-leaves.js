// js/falling-leaves.js
// Falling leaves round the camera on the golden autumn day: a few hundred small leaf cards in autumn colours drifting
// down, swaying and tumbling within ~30 m of the view, coming back up above it when they reach the ground or fall
// behind. One instanced mesh; the leaves sit in a box that follows the camera, so they cost the same anywhere.

import * as THREE from 'three/webgpu';
import { groundY } from './terrain.js';

const COUNT = 320;
const RADIUS = 30; // m round the camera
const TOP = 16; // m above the ground where a leaf starts
const COLOURS = [0xd9a521, 0xc9781e, 0xa8471c, 0xe2c04a, 0x8a5a24, 0x9a8a2a];

// A leaf: a pointed oval card, bent a little along its middle
function leafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.07);
  shape.quadraticCurveTo(0.055, -0.01, 0, 0.08);
  shape.quadraticCurveTo(-0.055, -0.01, 0, -0.07);
  const g = new THREE.ShapeGeometry(shape, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.abs(p.getX(i)) * 0.35);
  g.computeVertexNormals();
  return g;
}

function createFallingLeaves(scene) {
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.8, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(leafGeometry(), material, COUNT);
  mesh.name = 'FallingLeaves';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const c = new THREE.Color();
  const leaves = [];
  for (let i = 0; i < COUNT; i++) {
    mesh.setColorAt(i, c.setHex(COLOURS[i % COLOURS.length]).multiplyScalar(0.85 + Math.random() * 0.3));
    leaves.push({
      x: (Math.random() - 0.5) * 2 * RADIUS, y: Math.random() * TOP, z: (Math.random() - 0.5) * 2 * RADIUS,
      fall: 0.6 + Math.random() * 0.7, sway: 0.4 + Math.random() * 0.9, phase: Math.random() * 6.28,
      spin: (Math.random() - 0.5) * 4, size: 0.8 + Math.random() * 0.8,
    });
  }
  scene.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  let on = true;

  return {
    mesh,
    set enabled(x) { on = x; mesh.visible = x; },
    get enabled() { return on; },
    // cam: the camera position; wind: m/s along x
    update(dt, elapsed, cam, wind = 0.6) {
      if (!on) return;
      const cx = cam.x, cz = cam.z, base = Math.max(groundY(cx, cz), cam.y - TOP * 0.6);
      for (let i = 0; i < COUNT; i++) {
        const l = leaves[i];
        l.y -= l.fall * dt;
        l.x += (wind + Math.sin(elapsed * l.sway + l.phase) * 0.8) * dt;
        l.z += Math.cos(elapsed * l.sway * 0.7 + l.phase) * 0.5 * dt;
        // keep each leaf in the box round the camera: wrap round it, back to the top when on the ground
        let wx = cx + l.x, wz = cz + l.z;
        if (l.x > RADIUS) l.x -= 2 * RADIUS; else if (l.x < -RADIUS) l.x += 2 * RADIUS;
        if (l.z > RADIUS) l.z -= 2 * RADIUS; else if (l.z < -RADIUS) l.z += 2 * RADIUS;
        wx = cx + l.x; wz = cz + l.z;
        if (l.y < 0.05) { l.y = TOP; l.x = (Math.random() - 0.5) * 2 * RADIUS; l.z = (Math.random() - 0.5) * 2 * RADIUS; }
        e.set(elapsed * l.spin + l.phase, elapsed * l.spin * 0.6, Math.sin(elapsed * l.sway + l.phase) * 0.9);
        q.setFromEuler(e);
        m4.compose(v.set(wx, base + l.y, wz), q, s.setScalar(l.size));
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

export { createFallingLeaves };
