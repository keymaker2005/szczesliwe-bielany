// js/mission-marker.js
// The current mission goal in the world: a taxi-yellow pillar of light (fading upwards, seen over the roofs) on a
// ring the size of the arrival radius, gently pulsing.

import * as THREE from 'three/webgpu';
import { groundY } from './terrain.js';

const PILLAR_H = 70; // m

function createMissionMarker(radius) {
  const group = new THREE.Group();
  group.name = 'MissionMarker';
  // The fade upwards as an alpha map (a 1 × 64 gradient along the cylinder's v), the pulse as the plain opacity: an
  // opacityNode made the pillar vanish after its first frames in the scene pass
  const fade = new Uint8Array(64 * 4);
  for (let k = 0; k < 64; k++) {
    const a = Math.round(255 * Math.pow(k / 63, 1.8)); // v = 1 at the top of the cylinder geometry, 0 at its foot
    fade.set([255 - a, 255 - a, 255 - a, 255], k * 4);
  }
  const fadeMap = new THREE.DataTexture(fade, 1, 64);
  fadeMap.needsUpdate = true;
  const pillarMat = new THREE.MeshBasicNodeMaterial({
    color: 0xffc21a, alphaMap: fadeMap, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide
  });
  const pillarGeo = new THREE.CylinderGeometry(1.1, 1.1, PILLAR_H, 24, 1, true);
  pillarGeo.translate(0, PILLAR_H / 2, 0);
  const pillar = new THREE.Mesh(pillarGeo, pillarMat);

  const ringMat = new THREE.MeshBasicNodeMaterial({ color: 0xffc21a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const ringGeo = new THREE.RingGeometry(radius - 0.5, radius, 64);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.25; // just over the sidewalk

  for (const m of [pillar, ring]) {
    m.castShadow = false;
    m.receiveShadow = false;
    m.frustumCulled = false;
    group.add(m);
  }

  return {
    group,
    show(x, z) {
      group.position.set(x, groundY(x, z), z);
      group.visible = true;
    },
    hide() {
      group.visible = false;
    },
    update(elapsed) {
      if (!group.visible) return;
      const pulse = 0.75 + 0.25 * Math.sin(elapsed * 3);
      pillarMat.opacity = 0.5 * pulse;
      ringMat.opacity = 0.8 * pulse;
    },
  };
}

export { createMissionMarker };
