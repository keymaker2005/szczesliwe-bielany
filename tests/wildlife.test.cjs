const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const { loadModule } = require('./helpers/module.cjs');

// The behaviour of js/wildlife.js on a made-up wood: a 400 m square, a building east of it, a path across it
const { planSites, Wildlife, KINDS } = loadModule(readFileSync(join(__dirname, '../js/wildlife.js'), 'utf8'), {
  filename: 'wildlife.js',
  globals: { Math, Infinity, Map, Set, Object },
  imports: {
    'three/webgpu': {},
    './bielany-geodata.js': { GEO: {} },
    './city-config.js': { ISLAND_BOUNDS: {}, blockAt: () => null, buildingAt: () => null },
    './terrain.js': { groundY: () => 0 },
    './forest.js': { inWood: () => false, pathGrid: () => () => Infinity },
  },
});

const inWood = (x, z) => x >= 0 && x <= 400 && z >= 0 && z <= 400;
const blocked = (x, z) => x > 440 && x < 470 && z > 100 && z < 300; // a block of flats by the wood's east edge
const world = { inWood, blocked, toPath: (x, z) => Math.abs(z - 200) - 1, groundAt: (x, z) => x * 0.01 };
const seeded = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const trees = [];
for (let x = 10; x < 400; x += 6) for (let z = 10; z < 400; z += 7) trees.push(x, z, 18, 6, 4);
trees.push(1000, 1000, 18, 6, 4); // a street tree: no squirrel plans there
const sites = planSites({ boxes: [[0, 0, 400, 400]], inWood, blocked, trees });

test('Wildlife: herds and squirrels are planned in the wood only, edge sites by open ground', () => {
  const herds = sites.filter((s) => s.kind !== 'squirrel');
  const squirrels = sites.filter((s) => s.kind === 'squirrel');
  assert.ok(herds.length >= 6 && herds.length <= 25, `${herds.length} herds`);
  assert.ok(squirrels.length >= 20, `${squirrels.length} squirrels`);
  assert.ok(sites.every((s) => inWood(s.x, s.z) && !blocked(s.x, s.z)));
  assert.ok(herds.some((s) => s.kind === 'sounder') && herds.some((s) => s.kind === 'deer'));
  assert.ok(herds.some((s) => s.edge) && herds.some((s) => !s.edge), 'sites by the edge and deep in the wood');
  for (const s of herds) assert.equal(s.edge, Math.min(s.x, s.z, 400 - s.x, 400 - s.z) < 50);
  // the same plan every time (no randomness)
  assert.deepEqual(planSites({ boxes: [[0, 0, 400, 400]], inWood, blocked, trees }), sites);
});

test('Wildlife: animals come out only round the camera, nothing far from the wood or from high above', () => {
  const life = new Wildlife(sites, world, { random: seeded(1) });
  life.update(0.1, { x: 3000, y: 2, z: 3000 }, { x: 3000, y: 0, z: 3000 });
  assert.equal(life.animals.length, 0);
  life.update(0.1, { x: 200, y: 2, z: 200 }, null);
  assert.ok(life.animals.length > 10, `${life.animals.length} animals`);
  assert.ok(life.animals.some((a) => a.kind === 'piglet') && life.animals.some((a) => a.kind === 'squirrel'));
  for (const a of life.animals) if (a.kind !== 'squirrel') assert.ok(Math.hypot(a.site.x - 200, a.site.z - 200) <= 180);
  life.update(0.1, { x: 200, y: 400, z: 200 }, null); // the helicopter high above
  assert.equal(life.animals.length, 0);
  life.update(0.1, { x: 200, y: 2, z: 200 }, null);
  life.update(0.1, { x: 3000, y: 2, z: 3000 }, null);
  assert.equal(life.animals.length, 0, 'put away again');
});

test('Wildlife: a sounder feeds in the wood and runs from the player, then calms down', () => {
  const sounder = sites.find((s) => s.kind === 'sounder' && !s.edge);
  const life = new Wildlife([sounder], world, { random: seeded(7) });
  const cam = { x: sounder.x, y: 2, z: sounder.z + 150 };
  const far = { x: cam.x, y: 0, z: cam.z };
  for (let t = 0; t < 600; t++) life.update(0.1, cam, far); // a minute of feeding
  const [sow, ...piglets] = life.animals;
  assert.equal(sow.kind, 'boar');
  assert.ok(piglets.length >= 3 && piglets.every((p) => p.kind === 'piglet' && p.leader === sow));
  for (const a of life.animals) {
    assert.ok(inWood(a.x, a.z), 'stays in the wood');
    assert.ok(Math.abs(a.y - a.x * 0.01) < 1e-9, 'on the ground');
    assert.ok(Math.hypot(a.x - sow.x, a.z - sow.z) < 15, 'piglets keep to the sow');
  }
  // the player walks up to 8 m from the sow
  const p = { x: sow.x + 8, y: 0, z: sow.z };
  const before = Math.hypot(sow.x - p.x, sow.z - p.z);
  for (let t = 0; t < 20; t++) life.update(0.1, cam, p);
  assert.equal(sow.state, 'flee');
  assert.ok(sow.speed > 3, `running at ${sow.speed.toFixed(1)} m/s`);
  assert.ok(Math.hypot(sow.x - p.x, sow.z - p.z) > before + 4, 'away from the player');
  assert.ok(piglets.every((a) => a.state === 'flee' && a.speed > 2), 'the piglets run with her');
  for (let t = 0; t < 150; t++) life.update(0.1, cam, p);
  assert.ok(Math.hypot(sow.x - p.x, sow.z - p.z) > KINDS.boar.flee, 'well away');
  assert.notEqual(sow.state, 'flee', 'calmed down');
  for (const a of life.animals) assert.ok(inWood(a.x, a.z) && !blocked(a.x, a.z));
});

test('Wildlife: boars of the edge step out of the wood now and then, never into buildings; deer stay in', () => {
  const edge = sites.filter((s) => s.edge && (s.kind === 'sounder' || s.kind === 'tusker'));
  const deer = sites.filter((s) => s.kind === 'deer');
  assert.ok(edge.length > 0);
  const life = new Wildlife([...edge, ...deer], world, { random: seeded(3) });
  const cam = { x: 200, y: 2, z: 200 };
  let out = 0;
  for (let t = 0; t < 6000; t++) {
    life.update(0.1, cam, null);
    for (const a of life.animals) {
      assert.ok(!blocked(a.x, a.z), 'never in a building');
      if (a.kind === 'deer') assert.ok(inWood(a.x, a.z), 'deer stay in the wood');
      else if (!inWood(a.x, a.z)) out++;
    }
  }
  assert.ok(out > 0, 'some boar out on the open ground');
});

test('Wildlife: a squirrel runs up its tree when the player comes near', () => {
  const site = sites.find((s) => s.kind === 'squirrel');
  const life = new Wildlife([site], world, { random: seeded(5) });
  const cam = { x: site.x, y: 2, z: site.z + 30 };
  const far = { x: site.x, y: 0, z: site.z + 40 };
  for (let t = 0; t < 400; t++) life.update(0.1, cam, far);
  const [sq] = life.animals;
  assert.equal(sq.kind, 'squirrel');
  const near = { x: site.x + 3, y: 0, z: site.z };
  for (let t = 0; t < 60; t++) life.update(0.1, cam, near);
  assert.ok(sq.climb >= 2, `up the trunk at ${sq.climb.toFixed(1)} m`);
  assert.ok(Math.abs(Math.hypot(sq.x - site.tree.x, sq.z - site.tree.z) - site.tree.r) < 1e-6, 'on the bark');
  for (let t = 0; t < 600; t++) life.update(0.1, cam, far);
  assert.equal(sq.climb, 0, 'down again once alone');
});
