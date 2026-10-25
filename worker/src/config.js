// Chat limits, models and prices in one place (docs/plan-fazy-4.md, decisions 1-2; contract: docs/api-czat.md)

export const LIMITS = {
  questionChars: 300,
  historyEntries: 12, // last 6 exchanges
  historyEntryChars: 600,
  bodyBytes: 8192,
  perAddress: 20, // questions per address per window
  perAddressWindowMs: 10 * 60 * 1000,
  perDay: 1000, // all questions, all players (day in Europe/Warsaw)
  monthBudgetUsd: 30, // estimated model cost per calendar month; hard limit also set in the Anthropic console
  sessionMs: 60 * 60 * 1000,
  answerWords: 120,
};

// Model per conversation and prices in USD per 1M tokens (checked 2026-10-06; check again before 4.4 and 4.11)
export const MODELS = {
  przewodnik: { id: 'claude-haiku-5-5', input: 0.10, output: 0.50, cacheRead: 0.01 },
};

export const CHATS = Object.keys(MODELS);

export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

export const PRODUCTION_ORIGINS = ['https://bielany.zbigniew.ai', 'https://szczesliwe-bielany.pages.dev'];

export const MESSAGES = {
  slow_down: 'Zwolnij trochę: za dużo pytań naraz. Spróbuj za kilka minut.',
  resting: 'Czat odpoczywa, wróć jutro. Do tego czasu zajrzyj do aplikacji Przewodnik.',
  off: 'Czat jest chwilowo wyłączony. Zajrzyj do aplikacji Przewodnik.',
  turnstile: 'Nie udało się sprawdzić, że piszesz z gry. Spróbuj jeszcze raz.',
  forbidden: 'Czat działa tylko w grze Szczęśliwe Bielany.',
  bad_request: 'Nie rozumiem tego pytania. Napisz je krócej (do 300 znaków).',
  error: 'Coś poszło nie tak po stronie czatu. Zajrzyj do aplikacji Przewodnik.',
};
