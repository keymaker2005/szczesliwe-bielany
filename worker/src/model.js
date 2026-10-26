// The model call for the guide (step 4.4): one Messages API request per question, raw fetch (the Worker has no
// dependencies), fixed system prompt cached (instructions + knowledge base from tools/wiedza-przewodnika.mjs).
// Only text goes to the model; it has no tools. The API key comes from the Worker secret ANTHROPIC_API_KEY.
import { LIMITS, MODELS, PRICES } from './config.js';
import { GUIDE_SYSTEM } from './wiedza-przewodnika.js';

export const API_URL = 'https://api.anthropic.com/v1/messages';
export const API_VERSION = '2026-10-21';

const SYSTEMS = { przewodnik: GUIDE_SYSTEM };

// Landmark ids the guide may offer "Nawiguj" for (SITES in js/guide.js; tests check they match)
export const SITE_IDS = ['kameduly', 'las-bielanski', 'awf', 'uksw', 'stare-bielany', 'wawrzyszew', 'mlociny',
  'szpital-bielanski', 'galeria-mlociny', 'sw-zygmunt', 'maria-magdalena', 'hutnik'];

const FALLBACK = 'Na to pytanie nie odpowiem. Zapytaj mnie o Bielany: miejsca, historię, metro, tramwaje albo lasy.';

// History from the game as API messages: roles alternate and the first one is the player's
export function toMessages(history, question) {
  const messages = [];
  for (const h of [...history, { role: 'user', text: question }]) {
    const text = h.text.trim();
    if (!text) continue;
    if (!messages.length && h.role !== 'user') continue;
    const last = messages[messages.length - 1];
    if (last && last.role === h.role) last.content += `\n\n${text}`;
    else messages.push({ role: h.role, content: text });
  }
  return messages;
}

// "[[nawiguj:id]]" at the end of the answer becomes the navigate field (only known ids); the marker never reaches the player
export function splitAnswer(text) {
  let navigate = '';
  const clean = text.replace(/\s*\[\[\s*nawiguj\s*:\s*([\w-]+)\s*\]\]\s*/gi, (m, id) => {
    if (!navigate && SITE_IDS.includes(id)) navigate = id;
    return ' ';
  }).replace(/[ \t]+\n/g, '\n').trim();
  return { text: clean, navigate };
}

export function costUsd(usage, price) {
  if (!usage) return 0;
  const M = 1e6;
  return ((usage.input_tokens || 0) * price.input
    + (usage.cache_creation_input_tokens || 0) * price.input * 1.25
    + (usage.cache_read_input_tokens || 0) * price.cacheRead
    + (usage.output_tokens || 0) * price.output) / M;
}

export async function askModel(req, env, fetchImpl = fetch) {
  const model = (req.chat === 'przewodnik' && env.GUIDE_MODEL) || MODELS[req.chat];
  if (!env.ANTHROPIC_API_KEY) throw new Error('no key');
  if (!PRICES[model]) throw new Error(`no price for ${model}`); // the budget must know what each answer costs
  const body = {
    model,
    max_tokens: LIMITS.answerTokens,
    system: [{ type: 'text', text: SYSTEMS[req.chat], cache_control: { type: 'ephemeral' } }],
    messages: toMessages(req.history, req.question),
    // Short answers from a fixed base need no reasoning (faster, cheaper); Sonnet 5.5 turns it off with between_tools
    thinking: { type: model.startsWith('claude-sonnet-5-5') ? 'between_tools' : 'disabled' },
    output_config: { effort: 'low' },
  };
  const r = await fetchImpl(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': API_VERSION },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`model ${r.status}`);
  const data = await r.json();
  const cost = costUsd(data.usage, PRICES[model]);
  if (data.stop_reason === 'refusal') return { text: FALLBACK, navigate: '', costUsd: cost };
  const raw = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const { text, navigate } = splitAnswer(raw);
  return { text: text || FALLBACK, navigate, costUsd: cost, usage: data.usage };
}
