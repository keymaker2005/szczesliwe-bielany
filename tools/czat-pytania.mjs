// Runs the guide's 30 control questions (docs/pytania-kontrolne-przewodnik.md) through the model with the Worker's own
// request code (worker/src/model.js) and writes the answers for review: node tools/czat-pytania.mjs
// The API key is read from worker/.dev.vars (ANTHROPIC_API_KEY, set by the author) and is never printed.
// Each question is asked on its own (no history). Cost: printed at the end (a few cents).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { askModel } from '../worker/src/model.js';
import { MODELS } from '../worker/src/config.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const vars = Object.fromEntries(readFileSync(`${root}worker/.dev.vars`, 'utf8').split('\n')
  .map((l) => /^([A-Z_]+)=(.*)$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2]]));
if (!vars.ANTHROPIC_API_KEY) {
  console.error('Brak ANTHROPIC_API_KEY w worker/.dev.vars');
  process.exit(1);
}
const env = { ANTHROPIC_API_KEY: vars.ANTHROPIC_API_KEY, GUIDE_MODEL: process.env.GUIDE_MODEL || vars.GUIDE_MODEL || '' };

const lines = readFileSync(`${root}docs/pytania-kontrolne-przewodnik.md`, 'utf8').split('\n');
const questions = lines.map((l) => /^(\d+)\.\s+(.*?)\s+→\s+(.*)$/.exec(l)).filter(Boolean)
  .map((m) => ({ n: Number(m[1]), question: m[2], expected: m[3] }));

let cost = 0;
let cacheRead = 0;
const out = [];
for (const q of questions) {
  const t0 = Date.now();
  let r;
  try {
    r = await askModel({ chat: 'przewodnik', question: q.question, history: [] }, env);
  } catch (e) {
    r = { text: `(błąd: ${e.message})`, navigate: '', costUsd: 0 };
  }
  cost += r.costUsd;
  cacheRead += r.usage?.cache_read_input_tokens || 0;
  const words = r.text.split(/\s+/).filter(Boolean).length;
  out.push(`### ${q.n}. ${q.question}\n\n**Oczekiwane:** ${q.expected}\n\n**Odpowiedź** (${words} słów${r.navigate ? `, Nawiguj: \`${r.navigate}\`` : ''}, ${((Date.now() - t0) / 1000).toFixed(1)} s):\n\n${r.text.split('\n').map((l) => `> ${l}`).join('\n')}\n\n**Ocena:** OK / uwaga: …\n`);
  console.log(`${q.n}. ${words} słów${r.navigate ? `, ${r.navigate}` : ''}`);
}

const model = env.GUIDE_MODEL || MODELS.przewodnik;
const date = new Date().toISOString().slice(0, 10);
writeFileSync(`${root}docs/odpowiedzi-kontrolne-przewodnik.md`, `# Odpowiedzi na pytania kontrolne przewodnika (krok 4.4)

Model \`${model}\`, ${date}, ${questions.length} pytań, każde osobno (bez historii rozmowy). Koszt przebiegu ok.
${cost.toFixed(4)} USD (odczyt z pamięci podręcznej: ${cacheRead} tokenów). Pytania i oczekiwane zachowanie:
docs/pytania-kontrolne-przewodnik.md. Skrypt: node tools/czat-pytania.mjs. Przy każdej odpowiedzi wpisz „OK” albo uwagę.

${out.join('\n')}`);
console.log(`Gotowe: ${questions.length} pytań, koszt ok. ${cost.toFixed(4)} USD`);
