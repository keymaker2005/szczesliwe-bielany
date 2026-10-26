// Runs a conversation's control questions (docs/pytania-kontrolne-<chat>.md) through the model with the Worker's own
// request code (worker/src/model.js) and writes the answers for review (docs/odpowiedzi-kontrolne-<chat>.md):
// node tools/czat-pytania.mjs [przewodnik|burmistrz]
// The API key is read from worker/.dev.vars (ANTHROPIC_API_KEY, set by the author) and is never printed.
// Each question is asked on its own (no history). Cost: printed at the end (a few cents).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { askModel, MAYOR_SAFE } from '../worker/src/model.js';
import { MODELS } from '../worker/src/config.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const vars = Object.fromEntries(readFileSync(`${root}worker/.dev.vars`, 'utf8').split('\n')
  .map((l) => /^([A-Z_]+)=(.*)$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2]]));
if (!vars.ANTHROPIC_API_KEY) {
  console.error('Brak ANTHROPIC_API_KEY w worker/.dev.vars');
  process.exit(1);
}
const chat = process.argv[2] || 'przewodnik';
if (!MODELS[chat]) {
  console.error(`Nieznana rozmowa: ${chat}`);
  process.exit(1);
}
const VAR = { przewodnik: 'GUIDE_MODEL', burmistrz: 'MAYOR_MODEL' }[chat];
const env = { ANTHROPIC_API_KEY: vars.ANTHROPIC_API_KEY, [VAR]: process.env[VAR] || vars[VAR] || '' };

const lines = readFileSync(`${root}docs/pytania-kontrolne-${chat}.md`, 'utf8').split('\n');
const questions = lines.map((l) => /^(\d+)\.\s+(.*?)\s+→\s+(.*)$/.exec(l)).filter(Boolean)
  .map((m) => ({ n: Number(m[1]), question: m[2], expected: m[3] }));

let cost = 0;
let cacheRead = 0;
const out = [];
for (const q of questions) {
  const t0 = Date.now();
  let r;
  try {
    r = await askModel({ chat, question: q.question, history: [] }, env);
  } catch (e) {
    r = { text: `(błąd: ${e.message})`, navigate: '', costUsd: 0 };
  }
  cost += r.costUsd;
  cacheRead += r.usage?.cache_read_input_tokens || 0;
  const words = r.text.split(/\s+/).filter(Boolean).length;
  const guard = r.guarded ? ', drugi bezpiecznik' : '';
  out.push(`### ${q.n}. ${q.question}\n\n**Oczekiwane:** ${q.expected}\n\n**Odpowiedź** (${words} słów${guard}${r.navigate ? `, Nawiguj: \`${r.navigate}\`` : ''}, ${((Date.now() - t0) / 1000).toFixed(1)} s):\n\n${r.text.split('\n').map((l) => `> ${l}`).join('\n')}\n\n**Ocena:** OK / uwaga: …\n`);
  console.log(`${q.n}. ${words} słów${r.navigate ? `, ${r.navigate}` : ''}`);
}

const model = env[VAR] || MODELS[chat];
const NAMES = { przewodnik: 'przewodnika', burmistrz: 'postaci „Burmistrz Bielan”' };
const guarded = out.filter((o) => o.includes('drugi bezpiecznik')).length;
const date = new Date().toISOString().slice(0, 10);
writeFileSync(`${root}docs/odpowiedzi-kontrolne-${chat}.md`, `# Odpowiedzi na pytania kontrolne ${NAMES[chat]}

Model \`${model}\`, ${date}, ${questions.length} pytań, każde osobno (bez historii rozmowy). Koszt przebiegu ok.
${cost.toFixed(4)} USD (odczyt z pamięci podręcznej: ${cacheRead} tokenów). Pytania i oczekiwane zachowanie:
docs/pytania-kontrolne-${chat}.md. Skrypt: node tools/czat-pytania.mjs ${chat}. Przy każdej odpowiedzi wpisz „OK” albo uwagę.
${chat === 'burmistrz' ? `Drugi bezpiecznik zadziałał ${guarded} razy (stała odpowiedź: „${MAYOR_SAFE}”). Pod każdą odpowiedzią gra dopisuje stopkę\n„Odpowiedź AI w grze, nie oficjalne stanowisko Urzędu Dzielnicy Bielany”.\n` : ''}

${out.join('\n')}`);
console.log(`Gotowe: ${questions.length} pytań, koszt ok. ${cost.toFixed(4)} USD`);
