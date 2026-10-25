const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const { loadModule } = require('./helpers/module.cjs');

const source = readFileSync(join(__dirname, '../js/bridges.js'), 'utf8');

test('Bridges: decks rest on the ground at their ends and rise over the Vistula, the river stays under them', async () => {
  const { GEO } = await import('../js/bielany-geodata.js');
  const valley = -18; // a flat valley: the hump alone lifts the decks
  const bridges = loadModule(source, {
    imports: {
      'three/webgpu': {},
      'three/addons/utils/BufferGeometryUtils.js': {},
      './bielany-geodata.js': { GEO },
      './city-config.js': { ISLAND_BOUNDS: GEO.frame.bounds },
      './tsl-materials.js': {},
      './terrain.js': { groundY: () => valley }
    },
    globals: { Math, Map, Set, Infinity, Array, Object, Number }
  });
  assert.ok(GEO.bridges.length > 10, `${GEO.bridges.length} bridge pieces`);
  // the Skłodowska-Curie bridge crosses the river in the north of the area: the middle of its longest piece is high
  const [w, pts] = GEO.bridges.reduce((a, b) => (b[1].length > a[1].length ? b : a));
  const mid = pts.length / 2 - ((pts.length / 2) % 2);
  const x = pts[mid], z = pts[mid + 1];
  const d = bridges.deckY(x, z);
  assert.ok(d !== null && d - valley > 4 && d - valley <= 6 + 1e-9, `deck ${d} over the ground ${valley} (width ${w})`);
  assert.equal(bridges.deckY(0, 0), null, 'no deck at the Stare Bielany station');
  // under the deck: the ground for someone coming along the ground, the deck for someone up there or over water
  assert.equal(bridges.surfaceY(x, z, valley), bridges.overWater(x, z) ? d : valley);
  assert.equal(bridges.surfaceY(x, z, d), d);
  const pose = bridges.deckPose(x, z, 0, 1, 2, 1);
  assert.ok(Math.abs(pose.y - d) < 1e-9 && Math.abs(pose.pitch) < 0.1);
});
