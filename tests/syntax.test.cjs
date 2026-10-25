const assert = require('node:assert/strict');
const { readdirSync, copyFileSync, mkdtempSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

// Every game module parses as an ES module (a merge once left main.js without a brace and with a name imported twice;
// the unit tests load pieces of the modules and missed it)
test('every js/ module is valid ES module syntax', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bielany-syntax-'));
  try {
    for (const f of readdirSync(join(__dirname, '../js')).filter((n) => n.endsWith('.js'))) {
      const copy = join(dir, f.replace(/\.js$/, '.mjs'));
      copyFileSync(join(__dirname, '../js', f), copy);
      const r = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8' });
      assert.equal(r.status, 0, `js/${f}: ${r.stderr.split('\n').slice(0, 5).join(' ')}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
