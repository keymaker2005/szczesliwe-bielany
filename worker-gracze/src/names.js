// Random player names with a Bielany touch (decision 7 of docs/plan-fazy-5.md): adjective + animal of the Bielany
// forest and river + number, e.g. "Rudy Dzik 27". Players never type their own names, so there is nothing to moderate.
// The game keeps only the numbers (a, b, n, color); the words live here.

// [masculine, feminine]
export const ADJECTIVES = [
  ['Rudy', 'Ruda'], ['Szybki', 'Szybka'], ['Wesoły', 'Wesoła'], ['Zielony', 'Zielona'], ['Złoty', 'Złota'],
  ['Leśny', 'Leśna'], ['Bielański', 'Bielańska'], ['Śmiały', 'Śmiała'], ['Cichy', 'Cicha'], ['Dzielny', 'Dzielna'],
  ['Sprytny', 'Sprytna'], ['Jesienny', 'Jesienna'],
];

// [word, gender]
export const NOUNS = [
  ['Dzik', 'm'], ['Lis', 'm'], ['Jeż', 'm'], ['Borsuk', 'm'], ['Dzięcioł', 'm'], ['Sokół', 'm'], ['Kos', 'm'],
  ['Bóbr', 'm'], ['Wróbel', 'm'], ['Kruk', 'm'],
  ['Wiewiórka', 'f'], ['Sarna', 'f'], ['Sowa', 'f'], ['Kaczka', 'f'], ['Sroka', 'f'], ['Wydra', 'f'],
  ['Jaskółka', 'f'], ['Mewa', 'f'], ['Czapla', 'f'], ['Kuna', 'f'],
];

// Player colours (cars, bikes, jackets, map dots): bright enough to tell apart from the traffic
export const COLORS = [
  '#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#264653', '#8ecae6',
  '#219ebc', '#6a4c93', '#ff70a6', '#70e000', '#ff9f1c', '#3a86ff',
];

const int = (v, max) => Number.isInteger(v) && v >= 0 && v < max;

export function nameText(a, b, n) {
  const [word, gender] = NOUNS[b];
  return `${ADJECTIVES[a][gender === 'f' ? 1 : 0]} ${word} ${n}`;
}

// The asked-for name and colour when valid, otherwise random ones; the number changes when the name is taken in the room
export function pickName(asked, color, taken, random = Math.random) {
  const ok = asked && typeof asked === 'object' && int(asked.a, ADJECTIVES.length) && int(asked.b, NOUNS.length)
    && Number.isInteger(asked.n) && asked.n >= 1 && asked.n <= 99;
  const a = ok ? asked.a : Math.floor(random() * ADJECTIVES.length);
  const b = ok ? asked.b : Math.floor(random() * NOUNS.length);
  let n = ok ? asked.n : 1 + Math.floor(random() * 99);
  for (let i = 0; i < 99 && taken.has(nameText(a, b, n)); i++) n = (n % 99) + 1;
  return {
    name: { a, b, n },
    text: nameText(a, b, n),
    color: int(color, COLORS.length) ? color : Math.floor(random() * COLORS.length),
  };
}
