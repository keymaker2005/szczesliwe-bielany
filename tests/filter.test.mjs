import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanChat, fold } from '../worker-gracze/src/filter.js';

test('chat filter: vulgar words covered, also disguised', () => {
  for (const w of ['kurwa', 'KURWAAA', 'k.u.r.w.a', 'kurw4', 'chuj', 'pierdolę', 'zajebisty', 'spierdalaj', 'jebać', 'pizda', 'fuck', 'skurw1syn', 'k u r w a']) {
    const r = cleanChat(`no ${w} serio`);
    assert.ok(r.changed, w);
    assert.match(r.text, /^no \S\*+ serio$/, `${w} -> ${r.text}`);
  }
  assert.equal(fold('Ździebko'), 'zdziebko');
});

test('chat filter: ordinary Bielany talk passes untouched', () => {
  for (const t of ['Cześć, jedziemy na Kameduły?', 'Nigdy nie byłem w Lesie Bielańskim', 'Pedał mi się urwał w rowerze',
    'Ciotka mieszka na Wrzecionie', 'Gdzie jest Galeria Młociny?', 'Spotkajmy się przy AWF o 18', 'Hutnik gra dziś mecz']) {
    assert.deepEqual(cleanChat(t), { text: t, changed: false }, t);
  }
});

test('chat filter: no links, e-mails or phone numbers', () => {
  assert.equal(cleanChat('wejdź na www.example.com teraz').text, 'wejdź na [link] teraz');
  assert.equal(cleanChat('pisz: ala@poczta.pl').text, 'pisz: [adres]');
  assert.equal(cleanChat('dzwoń 600 123 456').text, 'dzwoń [numer]');
  assert.equal(cleanChat('mój discord.gg/abc').text, 'mój [link]');
});
