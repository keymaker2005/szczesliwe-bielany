import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { SITES } from '../js/guide.js';
import { GUIDE_SYSTEM } from '../worker/src/wiedza-przewodnika.js';
import { build, refreshDocs } from '../tools/wiedza-przewodnika.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const md = fs.readFileSync(root + 'docs/wiedza-przewodnika.md', 'utf8');
const prompt = fs.readFileSync(root + 'worker/prompts/przewodnik.md', 'utf8');

test('wiedza przewodnika: sekcja landmarków w docs jest aktualna względem js/guide-texts.js', () => {
  assert.equal(refreshDocs(md), md, 'uruchom: node tools/wiedza-przewodnika.mjs --docs');
});

test('wiedza przewodnika: plik Workera jest aktualny względem docs i instrukcji', () => {
  assert.equal(GUIDE_SYSTEM, build(md, prompt), 'uruchom: node tools/wiedza-przewodnika.mjs');
});

test('wiedza przewodnika: każdy landmark z SITES ma hasło z id i źródłem', () => {
  for (const id of Object.keys(SITES)) {
    const at = md.indexOf(`[id: ${id}]`);
    assert.ok(at > 0, `hasło dla ${id}`);
    const entry = md.slice(at, md.indexOf('\n### ', at) > 0 ? md.indexOf('\n### ', at) : undefined);
    assert.match(entry, /Źródła: https?:\/\//, `źródło dla ${id}`);
  }
});

test('wiedza przewodnika: każde hasło ma źródło, a baza mieści się w budżecie tokenów', () => {
  const entries = md.split('\n### ').slice(1);
  assert.ok(entries.length >= 25);
  for (const e of entries) assert.match(e, /Źródła: .*https?:\/\//, e.split('\n')[0]);
  assert.ok(GUIDE_SYSTEM.length / 4 <= 15000);
});

test('wiedza przewodnika: instrukcje mają kluczowe zasady i znacznik nawigacji', () => {
  for (const s of ['120 słów', 'nie wiem', 'Przewodnik', '[[nawiguj:', 'polityce', 'wulgaryzm', 'danych osobowych']) {
    assert.ok(GUIDE_SYSTEM.includes(s), s);
  }
  assert.doesNotMatch(GUIDE_SYSTEM, /Pietruczuk/);
});

test('pytania kontrolne: 30 pytań, każde z oczekiwanym zachowaniem', () => {
  const q = fs.readFileSync(root + 'docs/pytania-kontrolne-przewodnik.md', 'utf8');
  const lines = q.split('\n').filter((l) => /^\d+\. /.test(l));
  assert.equal(lines.length, 30);
  for (const l of lines) assert.match(l, /→/);
  for (const id of q.match(/(?<=NAW `)[a-z-]+/g) || []) assert.ok(SITES[id], id);
});
