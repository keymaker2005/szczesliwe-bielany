// The players' chat filter (step 5.6b, decision 8 of docs/plan-fazy-5.md): vulgar and abusive words are covered
// (the first letter stays, the rest becomes asterisks), links, e-mail addresses and phone numbers are hidden (no
// personal data in a game anyone can join). Words are matched after folding Polish letters, look-alike digits and
// repeated letters, so "k.u.r.w.a", "kurwaaa" and "k0rwa"-style tricks are caught too. Nothing is stored.

// Word roots (folded: no Polish letters). A word containing a root is covered. Kept short on purpose: common
// vulgarities and slurs; plain words that only look alike are listed in SAFE.
const ROOTS = [
  'kurw', 'kurv', 'chuj', 'huj', 'pierdol', 'pierdal', 'jeba', 'jebi', 'jebn', 'jebc', 'jebl', 'zjeb', 'wyjeb', 'pojeb',
  'pizd', 'cipa', 'cipy', 'cipe', 'skurw', 'spierd', 'zajeb', 'dziwk', 'szmat', 'cwel', 'ciot', 'pedzi',
  'kutas', 'fiut', 'dupek', 'gowno', 'sraj', 'zasran', 'debil', 'kretyn', 'idiot', 'frajer',
  'fuck', 'shit', 'cunt', 'bitch', 'whore', 'asshole', 'retard',
];
// Words that contain a root but are fine (folded)
const SAFE = new Set(['ciotka', 'ciotki', 'ciotce', 'ciotke', 'ciotko', 'cioteczny', 'cioteczna', 'szmatka', 'szmatki', 'szmatke']);
// ("pedał" is left out: in this game it is mostly the bicycle's; "ciotka" is an aunt)

const FOLD = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z', 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };

export function fold(word) {
  let out = '';
  for (const ch of word.toLowerCase()) out += FOLD[ch] ?? ch;
  out = out.replace(/[^a-z]/g, ''); // dots, dashes, stars between the letters
  return out.replace(/(.)\1+/g, '$1'); // "kurwaaa" -> "kurwa"
}

const bad = (folded) => folded.length > 1 && !SAFE.has(folded) && ROOTS.some((r) => folded.includes(fold(r)));

const URL = /\b(?:https?:\/\/|www\.)\S+|\b[\w.-]+\.(?:pl|com|net|org|eu|io|gg|tv|me|app)\b\S*/gi;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const PHONE = /(?:\+?\d[\s-]?){7,}/g;

/** Cleans one chat message: { text, changed } (text already trimmed and limited by the caller) */
export function cleanChat(text) {
  let out = text.replace(EMAIL, '[adres]').replace(URL, '[link]').replace(PHONE, '[numer]');
  const cover = (w) => {
    const f = fold(w);
    if (!bad(f)) return w;
    const first = [...w.replace(/[^\p{L}\d]/gu, '')][0] || '*';
    return first + '*'.repeat(Math.max(2, Math.min(8, f.length - 1)));
  };
  // Spelled out letter by letter ("k u r w a"), then every word (letters, digits and the joiners people slip in)
  out = out.replace(/(?<![\p{L}\d])(?:[\p{L}\d] ){2,}[\p{L}\d](?![\p{L}\d])/gu, cover);
  out = out.replace(/[\p{L}\d@$!*.\-_]+/gu, cover);
  return { text: out, changed: out !== text };
}
