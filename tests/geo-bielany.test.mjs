import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('Bielany geodata: frame at Stare Bielany, real streets with Polish names, a consistent road graph', { timeout: 60000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'Bielany Żoliborz '));
  try {
    const out = path.join(dir, 'bielany-geodata.js');
    const result = spawnSync(process.execPath, [path.join(root, 'tools/geo-bielany.mjs'), out], { encoding: 'utf8', timeout: 60000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const { GEO } = await import(pathToFileURL(out).href);

    // Frame: not rotated, origin at the Stare Bielany station, Młociny about 1.7 km to the north-west
    assert.equal(GEO.frame.bearingDeg, 0);
    const station = (name) => GEO.stations.find((s) => s.name === name);
    assert.deepEqual([station('Stare Bielany').x, station('Stare Bielany').z].map(Math.abs), [0, 0]);
    const m = station('Młociny');
    assert.ok(m.x < -1000 && m.z < -800, `Młociny lies north-west: ${m.x}, ${m.z}`);
    assert.ok(Math.abs(Math.hypot(m.x, m.z) - 1660) < 100);
    const b = GEO.frame.bounds;
    assert.ok(b.maxX - b.minX > 3000 && b.maxX - b.minX < 3150, 'about 3.1 km east to west');
    assert.ok(b.maxZ - b.minZ > 2800 && b.maxZ - b.minZ < 2950, 'about 2.9 km north to south');

    // Streets: the main roads of the strip, names with Polish letters, every point inside the area
    const names = new Set(GEO.roads.map((r) => r[0]));
    for (const n of ['Aleja Zjednoczenia', 'Aleja Władysława Reymonta', 'Wólczyńska', 'Stefana Żeromskiego', 'Marymoncka']) {
      assert.ok(names.has(n), `missing street ${n}`);
    }
    for (const [, w, dir, , , flat] of GEO.roads) {
      assert.ok(w > 0 && [-1, 0, 1].includes(dir));
      for (let i = 0; i < flat.length; i += 2) {
        assert.ok(flat[i] >= b.minX - 0.1 && flat[i] <= b.maxX + 0.1 && flat[i + 1] >= b.minZ - 0.1 && flat[i + 1] <= b.maxZ + 0.1);
      }
    }

    // Graph: links join existing nodes, most nodes are real junctions, all named links have a name
    const { nodes, links, names: linkNames } = GEO.roadGraph;
    const n = nodes.length / 2;
    assert.ok(n > 1000 && links.length > 1500);
    const degree = new Array(n).fill(0);
    for (const [a, c, name, w, lanes, dir, inner] of links) {
      assert.ok(a >= 0 && a < n && c >= 0 && c < n);
      assert.ok(name >= 0 && name < linkNames.length && w > 0 && lanes > 0 && [-1, 0, 1].includes(dir));
      assert.equal(inner.length % 2, 0);
      degree[a]++;
      degree[c]++;
    }
    assert.ok(degree.filter((d) => d >= 3).length > n * 0.4, 'junctions are shared between streets');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
