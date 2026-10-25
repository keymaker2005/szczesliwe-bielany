# API czatu (Worker, krok 4.1)

Umowa między grą (aplikacja „Czat” w telefonie, krok 4.2) a Workerem na Cloudflare (worker/, krok 4.1).
Zmiany tylko przez koordynatora Fazy 4.

## Adresy
- Publicznie: `https://bielany.zbigniew.ai/api/czat` (Worker `bielany-czat` na trasie `bielany.zbigniew.ai/api/*`,
  ten sam adres co gra, bez CORS).
- Lokalnie: `http://localhost:8787/api/czat` (`wrangler dev` w worker/, odpowiedzi testowe; CORS dla
  `http://localhost:80xx` i `http://127.0.0.1:80xx`).
- Gra wybiera adres sama: na `localhost` / `127.0.0.1` lokalny Worker, wszędzie indziej `/api/czat`.
  Parametr `?czat=off` w adresie gry wyłącza czat (tryb bez czatu do testów).

## GET /api/czat/stan
Odpowiedź 200: `{ "ok": true, "enabled": true, "turnstileSiteKey": "…", "maxQuestion": 300, "maxHistory": 12 }`.
`enabled: false`, gdy wyłącznik awaryjny jest włączony albo limit dnia/miesiąca się skończył.
Gra pyta o stan przy pierwszym otwarciu aplikacji „Czat” (nie przy starcie gry).

## POST /api/czat
Treść (JSON, `Content-Type: application/json`):
```json
{
  "chat": "przewodnik",
  "question": "Kto zbudował klasztor kamedułów?",
  "history": [ { "role": "user", "text": "…" }, { "role": "assistant", "text": "…" } ],
  "session": "…",
  "turnstile": "…"
}
```
- `chat`: `"przewodnik"` (od 4.7 także `"burmistrz"`; dziś Worker go odrzuca).
- `question`: 1–300 znaków po przycięciu spacji.
- `history`: najwyżej 12 wpisów (6 wymian), każdy `text` do 600 znaków; starsze gra obcina sama.
- `session`: token z poprzedniej odpowiedzi; przy pierwszym pytaniu w karcie go nie ma.
- `turnstile`: token Cloudflare Turnstile, wymagany, gdy nie ma ważnego `session`.

Odpowiedź 200:
```json
{ "ok": true, "answer": "…", "session": "…" }
```
Od kroku 4.4 może dojść `"navigate": "<id landmarku z SITES w js/guide.js>"` (przycisk „Nawiguj” pod odpowiedzią).
Gra zapisuje nowy `session` i wysyła go przy kolejnym pytaniu (ważny 1 godzinę).

Błędy: `{ "ok": false, "reason": "…", "message": "tekst po polsku do pokazania w rozmowie", "retryAfter": 120 }`

| reason | HTTP | kiedy | co robi gra |
| --- | --- | --- | --- |
| `slow_down` | 429 | ponad 20 pytań w 10 minut z jednego adresu | pokazuje `message`, `retryAfter` w sekundach |
| `resting` | 503 | limit dnia (1000) albo miesiąca wyczerpany | „czat odpoczywa”, podpowiedź aplikacji Przewodnik |
| `off` | 503 | wyłącznik awaryjny | jak `resting` |
| `turnstile` | 403 | brak / zły token Turnstile, sesja wygasła | odświeża Turnstile i ponawia raz |
| `forbidden` | 403 | obcy adres źródłowy (Origin) | jak `off` |
| `bad_request` | 400 | zły JSON, za długie pytanie, zła historia | pokazuje `message` |
| `error` | 502 | błąd modelu (od 4.4) | jak `resting` |

Brak odpowiedzi w 15 s, błąd sieci albo inna treść niż JSON: gra traktuje jak `off` (tryb bez czatu), bez błędów
w konsoli poza jednym `console.info`.

## Turnstile
- Lokalnie testowe klucze Cloudflare (zawsze przepuszczają): klucz strony `1x00000000000000000000AA`,
  sekret `1x0000000000000000000000000000000AA`.
- Gra ładuje `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` dopiero przy pierwszym pytaniu,
  widżet niewidoczny (`appearance: "interaction-only"`, `size: "invisible"` gdy dostępny).

## Bezpieczeństwo
- Klucz API modelu tylko jako sekret Workera (`ANTHROPIC_API_KEY`); nigdy w odpowiedziach ani w kodzie gry.
- Worker niczego nie zapisuje poza licznikami (adres IP jako skrót SHA-256 z solą, czas życia 10 minut; licznik dnia
  i miesiąca).
