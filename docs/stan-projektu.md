# Stan projektu (przekazanie sesji, 2026-10-26 po publikacji 0.8)

## Faza 4 (gałąź faza-4, plan docs/plan-fazy-4.md) — dla nowej sesji
- Zrobione i sprawdzone: 4.1 Worker z bezpiecznikami, 4.2 aplikacja Czat, 4.3 baza przewodnika, 4.4 przewodnik na
  Haiku 5.5, 4.5 publikacja (0.7), 4.7–4.8 postać „Burmistrz Bielan” na Sonnet 5.5 (decyzja 8: bez zgody urzędu, bez
  imienia i nazwiska, bez patronatu; opublikowana jako 0.8, strona e2c8ab9), 4.9 wersja dla urzędu (?urzad).
- 4.6 pismo do urzędu: szkic scalony (docs/pismo-urzad-czat.md), niewysłany; autor wróci do niego (adresat, podpis).
- 4.10 patronat: pominięty decyzją autora. Trwa 4.11: docs/test-1.8b.md przepisany na „Test 1.0” (skarpa, Most
  Północny, czat w trakcie jazdy, ?czat=off), ceny modeli sprawdzone (Sonnet 5.5: odczyt z pamięci 0,10 USD).
  Decyzje z 2026-10-26: test robi autor; ten sam test zamyka bramki Faz 2, 3 i 4; publikacja przed testem jako 0.9,
  numer 1.0 po zaliczonym teście. Opublikowane jako 0.9 (strona b672de0, gra bez zmian względem 0.8).
  Do zrobienia: test autora, bramki. Zmiana cen w worker/src/config.js działa dopiero po wdrożeniu Workera.
- Przez tydzień od 2026-10-26 autor codziennie patrzy na koszty w konsoli Anthropic (Usage). Koszt pytania: przewodnik
  ok. 0,03 centa, burmistrz ok. 0,7 centa; limity: 20 pytań / 10 min z adresu, 1000 dziennie, 30 USD miesięcznie
  (licznik w Workerze) + twardy limit 30 USD w konsoli Anthropic.
- Wszystkie sesje równoległe Fazy 4 zamknięte, ich gałęzie scalone do faza-4. Gałąź faza-4 wysłana na GitHub.

## Czat (Worker bielany-czat)
- Kod: worker/ (src/index.js limity i Turnstile, counters.js Durable Object, model.js Messages API i drugi bezpiecznik
  burmistrza, config.js modele i ceny), umowa z grą i komendy: docs/api-czat.md. Klient w grze: js/chat.js, js/phone.js.
- Bazy wiedzy: docs/wiedza-przewodnika.md → `node tools/wiedza-przewodnika.mjs`; docs/wiedza-burmistrza.md (publiczne
  strony urzędu i miasta) → `node tools/wiedza-burmistrza.mjs`; instrukcje w worker/prompts/. Po zmianie bazy: skrypt,
  testy, pytania kontrolne (`node tools/czat-pytania.mjs przewodnik|burmistrz`, wynik w docs/odpowiedzi-kontrolne-*.md).
- Lokalnie: `sh tools/czat-dev.sh` (Worker na 8787; klucz API autora w worker/.dev.vars, ignorowany przez git);
  bez klucza Worker odpowiada tekstem testowym. Strona testowa tools/czat-test.html.
- Cloudflare: Worker na trasie bielany.zbigniew.ai/api/*, sekrety ANTHROPIC_API_KEY i TURNSTILE_SECRET wpisał autor
  (nigdy ich nie oglądamy), widżet Turnstile „bielany-czat” (klucz strony w worker/wrangler.toml).
  Wdrożenie Workera: `npx --yes wrangler@3.114.15 deploy --config <repo>/worker/wrangler.toml` z katalogu scratchpad,
  tylko na wyraźne polecenie autora (bez niego tryb auto odrzuca wdrożenie).
- Wyłączniki bez wdrożenia: CHAT_OFF (cały czat), MAYOR_OFF (sam burmistrz):
  `echo 1 | npx --yes wrangler@3.114.15 secret put MAYOR_OFF --name bielany-czat`, włączenie: `secret delete`.
- Gra: CHAT_MAYOR w js/city-config.js pokazuje rozmowę z burmistrzem; ?czat=off wyłącza czat w przeglądarce.

## Gdzie jesteśmy
- Faza 0 zamknięta. Faza 1 zrobiona poza bramką (odłożone: test 1.8b na Windows, pakiet dla urzędu — docs/pakiet-urzad.md).
- Faza 1.5 zaliczona 2026-10-26. Faza 2 opublikowana, bramka (60 fps na Windows) czeka na test według docs/test-1.8b.md.
- Faza 3 (gałąź faza-3, plan docs/plan-fazy-3.md): kroki 3.1-3.8 zrobione i opublikowane 2026-10-25 (wersja b9bfcb1),
  razem z dodatkami: tabliczki MSI, zwierzęta w lasach, Stadion Hutnika, aplikacja Przewodnik. Bramka czeka na test na
  Windows; otwarte przed bramką: 52-56 fps pieszo przy Kamedułach (Chrome, M4), 30 fps zgłoszone w Edge (docs/backlog.md).
- Faza 4: patrz sekcja na górze.
- Historia: CHANGELOG.md (publiczne wersje 0.1-0.9 według publikacji na Cloudflare), docs/changelog-wewnetrzny.md
  (kroki i commity). Praca równoległa: docs/praca-rownolegla.md (koordynator + osobne sesje na gałęziach, modele:
  Haiku proste, Sonnet powtarzalne, Opus myślenie; scalanie do gałęzi fazy tylko na polecenie użytkownika).
- Drzewa GUGiK: strumień paczki 8,6 GB urwał się przy 355 z 484 arkuszy; data/bielany_trees_2023.json to stary wycinek
  (bbox z kroku 2.1) + nowy pas (kompletny).
- Panel przeglądarki w aplikacji bywa bez GPU: sprawdzać w Chrome (Claude in Chrome, użytkownik się zgodził) albo prosić
  użytkownika o Edge. Nie używać ctx.filter na dużych płótnach 2D (wysypuje proces GPU przeglądarki razem z WebGPU gry).
- Teren: js/terrain.js (groundY, drapeGeometry, groundPose), dane js/bielany-terrain.bin z tools/terrain-bielany.mjs
  (po zmianie dróg w geodanych uruchomić ponownie: wygładza teren pod głównymi drogami). Mosty: js/bridges.js
  (deckY, surfaceY, deckPose). Każdy nowy obiekt na ziemi bierze wysokość z groundY / surfaceY. ?plaski = płaska mapa.
- Testy: 193 zielone, w tym test składni wszystkich modułów (po scaleniach sprawdzić też start gry w przeglądarce).
- Gałęzie: faza-0, faza-1, faza-1.5, faza-2, faza-3, faza-4 (bieżąca). main = oryginał mrdooba (tag nyc-original); scalenie do main
  dopiero po bramkach.

## Publikacja
- https://bielany.zbigniew.ai (Cloudflare Pages, projekt szczesliwe-bielany, konto keymaker2005@gmail.com).
- Deploy: `node tools/build-dist.mjs`, potem z katalogu scratchpad (nie z repo!):
  `npx --yes wrangler@3.114.15 pages deploy <repo>/dist --project-name szczesliwe-bielany --branch main --commit-hash <hash> --commit-dirty=false`.
  wrangler 4.x psuje projekt (autoconfig Workers) — nie używać.
- build-dist dokleja ?v=<commit> do adresów modułów (inaczej przeglądarki mieszały stare pliki z nowymi).

## Narzędzia lokalne
- Node: ~/.local/node/bin (dopisać do PATH). gh: ~/.local/bin/gh (zalogowany jako keymaker2005).
- Serwer: `node tools/serve.mjs 8080`, podgląd w panelu przeglądarki (.claude/launch.json, nazwa „bielany”).
  Ukryty panel daje ~1 fps — pomiary fps tylko przy widocznym panelu.
- Testy: `node --test tests/*.test.mjs tests/*.test.cjs` (193 zielone).
- Dane: `node tools/geo-bielany.mjs` generuje js/bielany-geodata.js; Overpass: tools/overpass.sh; budynki:
  data/extract_bielany_lod1.py (bez pyproj); drzewa: data/extract_bielany_trees.py (strumień 8,6 GB, ~40 min);
  teksty: tools/guide-texts.mjs.
- W konsoli strony: globalThis.bielany (missions, phone, courier, taxi, medic, trams, photo, teleport…).

## Ważne decyzje użytkownika
- Oficjalne nazwy zostają (Galeria Młociny itd.); oficjalny znak „M” metra; bez logo firm i insygniów służb.
- Burmistrz Grzegorz Pietruczuk: prawdziwa osoba, SMS-y w tonie z publicznych wypowiedzi, opublikowane (z dopiskiem
  „wiadomość w grze”). Decyzja z 2026-10-25: nadawca SMS-ów to „Burmistrz Bielan”, bez imienia i nazwiska, do czasu
  pisemnej zgody (js/guide.js, stała MAYOR).
- Wygląd ze zdjęć (Commons, Mapillary, ortofoto); Google Maps/Street View tylko do porównań.
- Piesi materialni + ragdoll (zgoda na zmianę pedestrians.js); do wersji dla urzędu: PEDESTRIAN_CONTACT = false
  w js/city-config.js.
- Moduły przenośne (controllers, cameras, audio-*, scene-culling) bez zmian; pedestrians.js zmieniony za zgodą.
- Użytkownik nie jest programistą: wszystko po polsku, krótko, komendy uruchamia Claude.

## Otwarte sprawy (docs/backlog.md)
- Błędy WebGPU przy starcie lokalnie (ciepła pamięć shaderów), raz zawieszenie po przeładowaniu publicznej strony.
- Landmarki: wysokości wież, rotunda AWF; Las Bielański i skarpa w Fazie 3.
- Tramwaje: brak kolizji z graczem i dzwonka; linia Marymoncką kończy się przy Cmentarzu Włoskim (dane OSM).
