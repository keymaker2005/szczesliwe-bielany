import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

// js/street-details.js
// The street furniture of Bielany. Step 1.2a: none yet. Traffic signals come from OpenStreetMap in step 1.5, trees in
// step 1.7; the New York props (signal heads on the avenues, hydrants, steam, carts) are gone (tag nyc-original).
//
// Returns what the rest of the city reads: footprints the traffic keeps clear of, the signal clock the signal lenses
// animate with (main.js sets it every frame) and the signals the city audio ticks at.

function buildStreetDetails(scene) {
  const group = new THREE.Group();
  group.name = 'BielanyStreetDetails';
  scene.add(group);
  const signalClock = uniform(0);
  const footprints = []; // { minX, maxX, minZ, maxZ }
  const audioSignals = []; // { x, y, z, isAvenue }
  return { group, footprints, signalClock, audioSignals, update() {} };
}

export { buildStreetDetails };
