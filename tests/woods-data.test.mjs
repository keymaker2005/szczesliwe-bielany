import assert from 'node:assert/strict';
import test from 'node:test';
import { GEO } from '../js/bielany-geodata.js';

const inRing = (r, x, z) => {
  let c = false;
  for (let k = 0, m = r.length - 2; k < r.length; m = k, k += 2) {
    const xi = r[k], zi = r[k + 1], xj = r[m], zj = r[m + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
const inWood = (x, z) => GEO.woods.some(([outer, holes]) => inRing(outer, x, z) && !holes.some((h) => inRing(h, x, z)));

test('Woods (step 3.2b): Las Bielański and its paths from OpenStreetMap, the city outside them', () => {
  assert.ok(GEO.woods.length > 100, `${GEO.woods.length} woods`);
  assert.ok(GEO.paths.length > 300, `${GEO.paths.length} forest paths`);
  assert.ok(inWood(1032, -822), 'Las Bielański east of AWF');
  assert.ok(!inWood(0, 0), 'the Stare Bielany station is no wood');
  // every path lies mostly in a wood, with a sane width
  for (const [w, pts] of GEO.paths) {
    assert.ok(w >= 1.5 && w <= 3, `width ${w}`);
    assert.ok(pts.length >= 4);
  }
});
