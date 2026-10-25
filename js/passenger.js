// js/passenger.js
// A taxi passenger waiting on the sidewalk: a simple figure (legs, coat, head, hair) waving one raised arm at the cab,
// shown at the pick-up of a taxi fare and gone once they are in the car. A new coat colour for every fare.

import * as THREE from 'three/webgpu';
import { groundY } from './terrain.js';

const COATS = [0x8a3b2e, 0x2f4f6f, 0x5b6b3a, 0x6b4a7a, 0xb07a2a, 0x3a3d40];

function createPassenger() {
  const group = new THREE.Group();
  group.name = 'TaxiPassenger';
  const coat = new THREE.MeshStandardNodeMaterial({ color: COATS[0], roughness: 0.85 });
  const dark = new THREE.MeshStandardNodeMaterial({ color: 0x2a2c30, roughness: 0.9 });
  const skin = new THREE.MeshStandardNodeMaterial({ color: 0xe0b89a, roughness: 0.8 });
  const hair = new THREE.MeshStandardNodeMaterial({ color: 0x4a3426, roughness: 0.9 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.09, 0.08, 0.85, 8), dark, s * 0.11, 0.43, 0);
  add(new THREE.CylinderGeometry(0.23, 0.2, 0.75, 12), coat, 0, 1.22, 0);
  add(new THREE.SphereGeometry(0.13, 14, 10), skin, 0, 1.75, 0);
  add(new THREE.SphereGeometry(0.135, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair, 0, 1.78, -0.01);
  add(new THREE.CylinderGeometry(0.055, 0.05, 0.62, 8), coat, -0.28, 1.2, 0); // the arm down
  // the waving arm: pivots at the shoulder
  const shoulder = new THREE.Group();
  shoulder.position.set(0.28, 1.5, 0);
  group.add(shoulder);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.62, 8), coat);
  arm.position.y = 0.31;
  arm.castShadow = true;
  shoulder.add(arm);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skin);
  hand.position.y = 0.65;
  shoulder.add(hand);
  group.visible = false;
  let serial = 0;

  return {
    group,
    // stand at (x, z) facing (fx, fz) (the street)
    show(x, z, fx = 0, fz = 1) {
      coat.color.setHex(COATS[serial++ % COATS.length]);
      group.position.set(x, groundY(x, z) + 0.15, z);
      group.rotation.y = Math.atan2(fx, fz);
      group.visible = true;
    },
    hide() {
      group.visible = false;
    },
    update(elapsed) {
      if (group.visible) shoulder.rotation.z = -0.35 + Math.sin(elapsed * 7) * 0.35; // waving above the head
    },
  };
}

export { createPassenger };
