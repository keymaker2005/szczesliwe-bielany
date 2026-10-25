import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Guide, SITES } from '../js/guide.js';
import { GUIDE_TEXTS } from '../js/guide-texts.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const phone = () => ({ sms: [], addSms(m) { this.sms.push(m); return true; } });

test('guide: one message per landmark, the first time the player comes near', () => {
  const guides = GUIDE_TEXTS.filter((t) => t.kind === 'guide');
  assert.equal(guides.length, 12);
  for (const t of guides) {
    assert.ok(SITES[t.landmark], `site for ${t.id}`);
    assert.ok(t.sms.length > 60 && t.sms.length <= 280);
    assert.ok(t.sources.length >= 1);
  }
  const p = phone();
  const g = new Guide(p, { mayor: false, storage: memory() });
  const awf = SITES.awf;
  g.update(1, { x: awf.x + 500, z: awf.z });
  assert.equal(p.sms.length, 0);
  g.update(1, { x: awf.x + 10, z: awf.z });
  assert.equal(p.sms.length, 1);
  assert.match(p.sms[0].text, /AWF/);
  assert.ok(p.sms[0].more.length > 200);
  g.update(1, { x: awf.x, z: awf.z });
  assert.equal(p.sms.length, 1, 'once only');
  g.start();
  g.delivered(1);
  assert.ok(!p.sms.some((m) => /burmistrz/.test(m.from)), 'no mayor when off');
});

test('guide: the mayor greets and writes after deliveries, marked as an in-game message', () => {
  const p = phone();
  const g = new Guide(p, { mayor: true, storage: memory() });
  g.send(g.mayorTexts.find((t) => t.trigger === 'start'));
  g.delivered(1);
  g.delivered(2);
  g.delivered(3);
  assert.equal(p.sms.length, 3);
  for (const m of p.sms) assert.match(m.text, /wiadomość w grze/);
});

test('published site: guide and mayor messages, versioned module URLs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bielany-dist '));
  try {
    const r = spawnSync(process.execPath, [path.join(root, 'tools/build-dist.mjs'), dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const pub = fs.readFileSync(path.join(dir, 'js/guide-texts.js'), 'utf8');
    assert.ok(/"kind": "mayor"/.test(pub));
    assert.ok(/"kind": "guide"/.test(pub));
    assert.ok(/"kind": "mayor"/.test(fs.readFileSync(path.join(root, 'js/guide-texts.js'), 'utf8')));
    // every module and the stylesheet carry the build, so no cached older file mixes with a newer page
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.match(html, /src="\.\/js\/main\.js\?v=\w+"/);
    assert.match(html, /href="\.\/css\/style\.css\?v=\w+"/);
    assert.match(fs.readFileSync(path.join(dir, 'js/main.js'), 'utf8'), /from '\.\/phone\.js\?v=\w+'/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('guide: landmarks() lists every site with a player name and the visited state', async () => {
  const { NAMES } = await import('../js/guide.js');
  const g = new Guide(phone(), { mayor: false, storage: memory() });
  const list = g.landmarks();
  assert.equal(list.length, Object.keys(SITES).length);
  for (const l of list) {
    assert.ok(NAMES[l.id], `name for ${l.id}`);
    assert.ok(l.sms && l.more, `texts for ${l.id}`);
    assert.equal(l.seen, false);
    assert.equal(l.x, SITES[l.id].x);
  }
  assert.ok(list.some((l) => l.id === 'hutnik'));
  g.update(1, { x: SITES.awf.x, z: SITES.awf.z });
  assert.equal(g.landmarks().find((l) => l.id === 'awf').seen, true);
  assert.equal(g.landmarks().filter((l) => l.seen).length, 1);
});

test('phone: Przewodnik app is wired in phone.js and main.js sets the GPS waypoint', () => {
  const src = fs.readFileSync(path.join(root, 'js/phone.js'), 'utf8');
  assert.match(src, /id: 'guide', name: 'Przewodnik'/);
  assert.match(src, /data-act="navigate"/);
  assert.match(src, /Czytaj więcej/);
  const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
  assert.match(main, /landmarks: \(\) => guide\.landmarks\(\)/);
  assert.match(main, /onNavigate: \(l\) => \{ mapSystem\.waypoint = \{ x: l\.x, z: l\.z, name: l\.name \}/);
});
