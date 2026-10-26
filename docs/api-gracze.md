# API gry z innymi (Worker bielany-gracze, krok 5.1)

Umowa między grą (js/multiplayer.js, krok 5.2) a serwerem graczy (worker-gracze/). Plan: docs/plan-fazy-5.md.
Zmiany tylko przez koordynatora Fazy 5.

## Adresy
- Publicznie: `https://bielany.zbigniew.ai/api/gracze` (Worker `bielany-gracze` na trasie
  `bielany.zbigniew.ai/api/gracze*`; bardziej szczegółowa od trasy czatu `/api/*`, więc wygrywa).
- Lokalnie: `http://localhost:8789/api/gracze` (`sh tools/gracze-dev.sh`, klucze testowe Turnstile, dowolny port
  gry `localhost:80xx`).
- Gra wybiera adres sama: na `localhost` / `127.0.0.1` lokalny serwer, wszędzie indziej `/api/gracze`.
  `?solo` w adresie gry i wersja dla urzędu (`?urzad`) nie łączą się wcale.

## GET /api/gracze/stan
Odpowiedź 200: `{ "ok": true, "enabled": true, "turnstileSiteKey": "…", "players": 7 }`.
`enabled: false`, gdy wyłącznik GRACZE_OFF jest włączony albo skończył się dzienny limit (wtedy też
`"reason": "off" | "resting"`). Gra pyta o stan przed połączeniem.

## GET /api/gracze (WebSocket)
Zwykłe połączenie WebSocket (`wss://…/api/gracze`). Bez danych w adresie; parametr `?pokoj=test` łączy z pokojem
testowym (dla botów i prób, osobno od publicznych pokoi). Odmowa przed połączeniem: JSON jak w czacie,
`{ "ok": false, "reason": "forbidden" | "off" | "resting" | "full" | "bad_request" }` (403 / 503 / 400).

Wiadomości to JSON, krótkie pola. Pozycje w metrach układu świata (x wschód, z południe, y wysokość),
`h` kierunek w radianach (jak `heading` w controllers.js), `m` tryb: `person`, `car`, `cyclist`, `helicopter`,
`passenger` (jedzie taksówką innego gracza: gra go nie rysuje, tylko kropka na mapie).

### Gra → serwer
| Wiadomość | Kiedy | Treść |
| --- | --- | --- |
| `hej` | pierwsza, w ciągu 10 s od połączenia | `{ "t": "hej", "turnstile": "…", "name": { "a": 3, "b": 12, "n": 27 }, "color": 5 }` |
| `s` (stan) | 5 razy na sekundę w ruchu, raz na sekundę w bezruchu | `{ "t": "s", "x": 9.4, "y": 0, "z": -12.4, "h": -2.2, "m": "car", "v": 13.2 }` |
| `tp` (teleport) | po teleporcie, zmianie miejsca z mapy itp. | jak `s`, `"t": "tp"`; najwyżej 1 na sekundę |
| `g` (gest) | gest lub gotowy zwrot (krok 5.4) | `{ "t": "g", "g": "czesc" }`; najwyżej 1 na 2 s |
| `k` (klakson) | klakson w aucie (B) | `{ "t": "k" }`; najwyżej 1 na 0,8 s, dostają go tylko gracze do 200 m |
| `imie` | „Losuj” w telefonie: nowe losowe imię i kolor | `{ "t": "imie" }`; najwyżej 1 na 2 s |
| `pa` | wyjście z gry z innymi | `{ "t": "pa" }`, potem serwer zamyka połączenie |

- `name`: numery słów z listy imion (worker-gracze/src/names.js): `a` przymiotnik, `b` rzeczownik, `n` 1–99.
  Bez `name` albo z błędnym serwer losuje. Gra pamięta numery w przeglądarce, napisy dostaje od serwera.
- `color`: numer koloru 0–11 z tej samej listy.
- `v`: prędkość w m/s (dla dźwięku i wygładzania), opcjonalna.
- Gesty: `czesc`, `dzieki`, `jedziemy`, `brawo`, `uwaga`, `pa`.

### Serwer → gra
| Wiadomość | Treść |
| --- | --- |
| `witaj` | `{ "t": "witaj", "id": 4, "name": "Rudy Dzik 27", "nameId": { "a": 0, "b": 0, "n": 27 }, "color": 5, "colors": ["#e63946", …], "room": "1", "players": [ { "id": 2, "name": "…", "color": 1, "x": …, "y": …, "z": …, "h": …, "m": "person", "v": 0 } ], "rate": { "move": 5, "idle": 1 } }` |
| `nowy` | `{ "t": "nowy", "p": { "id": 7, "name": "…", "color": 3, "x": …, … } }` (pozycja może być pusta do pierwszego stanu) |
| `s` / `tp` | `{ "t": "s", "id": 7, "x": …, "y": …, "z": …, "h": …, "m": "car", "v": 12.5 }` (pozycje z dokładnością 1 cm) |
| `g` | `{ "t": "g", "id": 7, "g": "czesc" }` |
| `k` | `{ "t": "k", "id": 7 }` (klakson gracza w pobliżu; dźwięk z jego auta) |
| `imie` | `{ "t": "imie", "id": 7, "name": "…", "color": 3 }` (nowe imię gracza; ten, kto losował, dostaje też `nameId`) |
| `wyszedl` | `{ "t": "wyszedl", "id": 7 }` (wyjście, zamknięcie karty albo 10 s ciszy) |
| `koniec` | `{ "t": "koniec", "reason": "resting" | "off" | "timeout" | "abuse" | "turnstile" | "full" }`, potem zamknięcie |

### Taksówka z prawdziwym pasażerem (krok 5.5)
Kurs żyje na serwerze przy pasażerze (`r` = id pasażera); serwer pilnuje jednego kierowcy i sprawdza miejsca.
| Wiadomość | Kto → serwer | Serwer → kto |
| --- | --- | --- |
| `{ "t": "taxi", "to": { "x", "z", "name" } }` | pasażer (pieszo), najwyżej 1 na 5 s | wszyscy inni: `{ "t": "taxi", "r", "name", "x", "z", "to" }` |
| `{ "t": "taxi-ok", "r" }` | kierowca w aucie | pasażer i kierowca: `{ "t": "taxi-ok", "r", "d", "name" }` (name: kierowca); reszta: `{ "t": "taxi-x", "r" }`; spóźniony kierowca: `taxi-x` |
| `{ "t": "taxi-in", "r" }` | kierowca, gdy stanie przy pasażerze (do 25 m) | obaj: `{ "t": "taxi-in", "r" }` |
| `{ "t": "taxi-end", "r" }` | kierowca, gdy stanie u celu (do 40 m) | obaj: `{ "t": "taxi-end", "r", "to" }` |
| `{ "t": "taxi-no", "r" }` | pasażer albo kierowca | obaj: `{ "t": "taxi-no", "r", "by" }` (`by`: kto przerwał, 0: nikt nie przyjął w 90 s); przy wyjściu jednej strony to samo |
`witaj` ma też `rides`: kursy czekające na kierowcę (`[{ "r", "name", "x", "z", "to" }]`).

### Wspólne akcje straży (krok 5.6)
Zdarzenie to numer adresu (`a`, GEO.addresses.list) i piętro (`f`); każda gra odtwarza z nich ten sam pożar
(js/firefighter.js `offerAt`). Pokój trzyma tylko liczby, w pamięci (najwyżej 20 naraz, 15 minut).
| Wiadomość | Kto → serwer | Serwer → kto |
| --- | --- | --- |
| `{ "t": "zd", "k": "fire" \| "flood" \| "cat", "a", "f" }` | gracz, który przyjął wezwanie (1 na 5 s) | wszyscy: `{ "t": "zd", "e", "k", "a", "f", "by", "name", "p", "n", "mine" }` (`mine`: to Twoje) |
| `{ "t": "zd-dol", "e" }` | dołączający | on: `{ "t": "zd-stan", "e", "p", "n" }`; uczestnicy: `{ "t": "zd-dol", "e", "id", "name", "n" }`; zamknięte: `zd-x` |
| `{ "t": "zd-p", "e", "d" }` | uczestnik: jego część pracy (ułamek całości, do 0,2 na wiadomość) | uczestnicy co 2%: `{ "t": "zd-stan", "e", "p", "n" }`; na końcu `{ "t": "zd-koniec", "e", "n" }`, reszta `zd-x` |
| `{ "t": "zd-x", "e" }` | uczestnik wychodzi (przerwał albo skończył) | gdy wyszedł ostatni: wszyscy `{ "t": "zd-x", "e" }` |
`witaj` ma też `events`: otwarte akcje (`[{ "e", "k", "a", "f", "by", "name", "p", "n" }]`).

### Rozmowy graczy (krok 5.6b)
| Wiadomość | Kto → serwer | Serwer → kto |
| --- | --- | --- |
| `{ "t": "czat", "txt": "…" }` | gracz: 1–140 znaków, 1 na 3 s | wszyscy (z nadawcą): `{ "t": "czat", "id", "name", "color", "txt" }` po filtrze (worker-gracze/src/filter.js) |
| | za szybko / wyciszony | nadawca: `{ "t": "czat-x", "reason": "slow" \| "silenced", "until"? }` |
| `{ "t": "zglos", "id" }` | gracz zgłasza innego (raz liczy się jedno zgłoszenie od osoby) | zgłaszający: `{ "t": "zglos-ok", "id" }`; po 3 zgłoszeniach (w małym pokoju 2): zgłoszony `czat-x silenced`, reszta `{ "t": "czat-cisza", "id" }`, 30 minut bez pisania |
„Wycisz” działa tylko w grze (bez serwera). Rozmowy nie są nigdzie zapisywane.

## Zasady serwera (bezpieczniki)
- Tylko połączenia ze strony gry (nagłówek Origin), Turnstile w wiadomości `hej` (bez niej po 10 s `koniec`).
- Najwyżej 30 graczy w pokoju; kolejni trafiają do pokoju 2, 3… (lobby pilnuje obsady). Najwyżej 2 połączenia
  z jednego adresu w pokoju (lokalnie i w pokoju testowym bez limitu, dla botów; boty na serwerze wchodzą do pokoju
  testowego z kluczem BOTS_KEY zamiast Turnstile: `node tools/boty.mjs 20 --adres wss://bielany.zbigniew.ai/api/gracze --klucz worker-gracze/.bots-key`).
- Najwyżej 12 wiadomości na sekundę od gracza (krótki zapas do 24); nadmiar jest pomijany, 200 pominiętych
  w minucie kończy połączenie (`abuse`).
- Stan sprawdzany: liczby skończone, pozycja w granicach mapy z zapasem 200 m, wysokość −50…1500 m, tryb z listy,
  prędkość 0–150 m/s; skok szybszy niż pozwala tryb (bez `tp`) jest pomijany.
- Gracz bez żadnej wiadomości przez 10 s znika (sprawdzane przy wiadomościach innych graczy i przy wejściu nowych,
  bez budzików, żeby pokój mógł zasypiać).
- Dzienny limit: pokój liczy wiadomości (20 wiadomości = 1 zapytanie w cenniku Cloudflare) i połączenia, zgłasza
  je do lobby co 2000 wiadomości i przy wejściu/wyjściu. Po przekroczeniu 80 000 zapytań dziennie (doba UTC,
  jak w Cloudflare; zapas 20 000 dla czatu) wszystkie pokoje wysyłają `koniec` z `resting`, a nowe połączenia
  dostają odmowę do 2:00 w nocy czasu polskiego.
- Nic nie jest zapisywane poza obsadą pokoi i licznikami dnia; adresy IP tylko jako skrót z solą w pamięci pokoju.
- Wyłącznik bez zmiany kodu: `echo 1 | npx --yes wrangler@3.114.15 secret put GRACZE_OFF --name bielany-gracze`,
  włączenie: `npx --yes wrangler@3.114.15 secret delete GRACZE_OFF --name bielany-gracze`.

## Lokalnie
- `sh tools/gracze-dev.sh` uruchamia serwer na 8789 (wrangler dev, klucze testowe Turnstile: każdy token przechodzi).
- `node tools/boty.mjs 5` wpuszcza 5 botów jeżdżących po ulicach Bielan do pokoju testowego
  (`--pokoj 1` do publicznego pokoju lokalnie, `--adres ws://…` do innego serwera).
