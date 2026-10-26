# Stan projektu (przekazanie sesji, 2026-10-26)

- Faza 4 w toku na gałęzi faza-4; koordynator: sesja „Faza 4 koordynator”. Krok 4.1 (Worker bez modelu) zrobiony i sprawdzony;
  4.2, 4.3, 4.9 scalone do faza-4 (2026-10-26); 4.6 (pismo) czeka na adresata i podpis. Następny: 4.4 (model na żywo,
  potrzebny klucz API Anthropic od autora). Worker lokalnie:
  sh tools/czat-dev.sh (port 8787), umowa docs/api-czat.md. Worker nieopublikowany (deploy w 4.5).

## Gdzie jesteśmy
- Faza 0 zamknięta. Faza 1 zrobiona poza bramką (odłożone: test 1.8b na Windows, pakiet dla urzędu — docs/pakiet-urzad.md).
- Faza 1.5 zaliczona 2026-10-26. Faza 2 opublikowana, bramka (60 fps na Windows) czeka na test według docs/test-1.8b.md.
- Faza 3 (gałąź faza-3, plan docs/plan-fazy-3.md): kroki 3.1-3.8 zrobione i opublikowane 2026-10-25 (wersja b9bfcb1),
  razem z dodatkami: tabliczki MSI, zwierzęta w lasach, Stadion Hutnika, aplikacja Przewodnik. Bramka czeka na test na
  Windows; otwarte przed bramką: 52-56 fps pieszo przy Kamedułach (Chrome, M4), 30 fps zgłoszone w Edge (docs/backlog.md).
- Następny krok (decyzja użytkownika 2026-10-25): plan Fazy 4 (czaty LLM z przewodnikiem i burmistrzem, patronat;
  opis w docs/backlog.md): docs/plan-fazy-4.md zaakceptowany 2026-10-25 ze wszystkimi
  propozycjami decyzji; gałąź faza-4 utworzona. Następny krok: 4.1 (Worker), równolegle 4.2, 4.3, 4.6, 4.9 (tabela
  w planie). Przed 4.1 autor zakłada konto Anthropic z kluczem API; do pisma (4.6) potrzebny adresat i podpis.
- Historia: CHANGELOG.md (publiczne wersje 0.1-0.6 według publikacji na Cloudflare), docs/changelog-wewnetrzny.md
  (kroki i commity). Praca równoległa: docs/praca-rownolegla.md (koordynator + osobne sesje na gałęziach, modele:
  Haiku proste, Sonnet powtarzalne, Opus myślenie; scalanie do gałęzi fazy tylko na polecenie użytkownika).
- Drzewa GUGiK: strumień paczki 8,6 GB urwał się przy 355 z 484 arkuszy; data/bielany_trees_2023.json to stary wycinek
  (bbox z kroku 2.1) + nowy pas (kompletny).
- Panel przeglądarki w aplikacji bywa bez GPU: sprawdzać w Chrome (Claude in Chrome, użytkownik się zgodził) albo prosić
  użytkownika o Edge. Nie używać ctx.filter na dużych płótnach 2D (wysypuje proces GPU przeglądarki razem z WebGPU gry).
- Teren: js/terrain.js (groundY, drapeGeometry, groundPose), dane js/bielany-terrain.bin z tools/terrain-bielany.mjs
  (po zmianie dróg w geodanych uruchomić ponownie: wygładza teren pod głównymi drogami). Mosty: js/bridges.js
  (deckY, surfaceY, deckPose). Każdy nowy obiekt na ziemi bierze wysokość z groundY / surfaceY. ?plaski = płaska mapa.
- Testy: 165 zielonych, w tym test składni wszystkich modułów (po scaleniach sprawdzić też start gry w przeglądarce).
- Gałęzie: faza-0, faza-1, faza-1.5, faza-2, faza-3 (bieżąca). main = oryginał mrdooba (tag nyc-original); scalenie do main
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
- Testy: `node --test tests/*.test.mjs tests/*.test.cjs` (165 zielonych).
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
