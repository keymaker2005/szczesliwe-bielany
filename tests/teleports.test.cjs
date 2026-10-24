const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = (path) => readFileSync(join(__dirname, '..', path), 'utf8');
let TELEPORT_LOCATIONS, LANDMARKS, blockAt, nearestRoads, getIslandBoundsAtZ;
test.before(async () => {
  ({ TELEPORT_LOCATIONS, LANDMARKS, blockAt, nearestRoads, getIslandBoundsAtZ } = await import('../js/city-config.js'));
});

test('every teleport button has a destination on a real roadway inside the Bielany area', () => {
  const buttons = [...read('index.html').matchAll(/data-teleport="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(Object.keys(TELEPORT_LOCATIONS).sort(), buttons.sort());
  for (const [name, point] of Object.entries(TELEPORT_LOCATIONS)) {
    assert.ok(Number.isFinite(point.heading), `${name} has a heading`);
    assert.equal(blockAt(point.x, point.z), null, `${name} lands outside building blocks`);
    const edge = getIslandBoundsAtZ(point.z);
    assert.ok(point.x > edge.westX + 8 && point.x < edge.eastX - 8, `${name} stays inside the area`);
    const nearby = nearestRoads(point.x, point.z, 20);
    assert.ok(nearby.some(({ road, dist }) => road.name && dist < road.w / 2), `${name} lands within a street's width`);
  }
});

test('the metro teleports arrive at their stations, along the street', () => {
  for (const [key, station] of [['stareBielany', 'Stare Bielany'], ['wawrzyszew', 'Wawrzyszew'], ['mlociny', 'Młociny']]) {
    const point = TELEPORT_LOCATIONS[key];
    const s = LANDMARKS.find((l) => l.short === station);
    assert.ok(Math.hypot(s.x - point.x, s.z - point.z) < 30, `${key} lands next to the ${station} station`);
    // facing along the nearest street, not across it
    const { road } = nearestRoads(point.x, point.z, 20)[0];
    let along = 0;
    for (let i = 0; i + 1 < road.pts.length; i++) {
      const a = road.pts[i], b = road.pts[i + 1];
      const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const t = ((point.x - a.x) * (b.x - a.x) + (point.z - a.z) * (b.z - a.z)) / (L * L);
      if (t < 0 || t > 1) continue;
      along = Math.max(along, Math.abs(((b.x - a.x) * Math.sin(point.heading) + (b.z - a.z) * Math.cos(point.heading)) / L));
    }
    assert.ok(along > 0.97, `${key} faces along ${road.name}`);
  }
});

test('preset and map teleports share arrival resets and mark the resolved landing point', () => {
  const main = read('js/main.js');
  const start = main.indexOf('  function teleportTo(');
  const end = main.indexOf('  const openMapBtn', start);
  const handlers = new Map();
  const calls = [];
  const landed = { x: -305.7, z: 5210 };
  let map;
  const environment = {
    TELEPORT_LOCATIONS,
    controllerManager: {
      teleportActiveTo: (...args) => { calls.push(['teleport', ...args]); return landed; }
    },
    touchControls: { reset: () => calls.push(['touch']) },
    gamepadControls: { reset: () => calls.push(['gamepad']) },
    cameraSystem: { resetForTeleport: () => calls.push(['camera']) },
    selectCamera: (...args) => calls.push(['selectCamera', ...args]),
    getLocationLabel: (x, z) => `${x}, ${z}`,
    cityBlocks: { allBlocks: [] },
    trafficSystem: {},
    NYCMapSystem: class {
      constructor(options) { this.onTeleport = options.onTeleport; map = this; }
    },
    teleportButtons: Object.keys(TELEPORT_LOCATIONS).map((key) => ({
      getAttribute: () => key,
      addEventListener: (_event, handler) => handlers.set(key, handler)
    })),
    closePopovers: () => {}
  };
  vm.runInNewContext(main.slice(start, end), environment);
  for (const [name, point] of Object.entries(TELEPORT_LOCATIONS)) {
    calls.length = 0;
    handlers.get(name)();
    assert.deepEqual(calls, [
      ['teleport', point.x, point.z, point.heading], ['touch'], ['gamepad'], ['camera'], ['selectCamera', 'chase', true]
    ]);
    assert.equal(map.waypoint.x, landed.x);
    assert.equal(map.waypoint.z, landed.z);
  }
  map.waypoint = { x: 100, z: 200, name: 'inside a building' };
  map.onTeleport(100, 200);
  assert.equal(map.waypoint.x, landed.x, 'map marker follows the safe position returned by the controller');
  assert.equal(map.waypoint.z, landed.z);
  assert.equal(map.waypoint.name, `${landed.x}, ${landed.z}`);
});
