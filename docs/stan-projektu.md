# Stan projektu (przekazanie sesji, 2026-10-26)

## Gdzie jesteśmy
- Faza 0 zamknięta. Faza 1 zrobiona poza bramką (odłożone: test 1.8b na Windows, pakiet dla urzędu — docs/pakiet-urzad.md).
- Faza 1.5 (smartfon, kurier, landmarki, przewodnik, burmistrz) zaliczona 2026-10-26.
- Faza 2 (większy obszar, wydajność, tramwaje, taksówkarz, ratownik, Aparat, liście) zrobiona i opublikowana; bramka
  (60 fps na laptopie z Windows) czeka na test według docs/test-1.8b.md.
- Faza 3 (gałąź faza-3, plan docs/plan-fazy-3.md zaakceptowany 2026-10-25): 3.1 dane terenu i 3.2a teren w świecie
  i 3.2b Las Bielański, 3.3 Wisła i most zrobione (lokalnie, bez deployu); dalej praca równoległa według
  docs/praca-rownolegla.md (ta sesja koordynuje, 3.4 dyspozytornia, potem sesje służb; tabliczki ulic w osobnej sesji).
- Drzewa GUGiK: strumień paczki 8,6 GB urwał się przy 355 z 484 arkuszy; data/bielany_trees_2023.json to stary wycinek
  (bbox z kroku 2.1) + nowy pas (kompletny). Panel przeglądarki w aplikacji bywa bez GPU: sprawdzać w Chrome (Claude in
  Chrome, za zgodą użytkownika) albo prosić użytkownika o Edge.
- Uwaga: filtr (blur) na dużym płótnie 2D wysypuje proces GPU przeglądarki razem z WebGPU gry (3.2b); po takiej awarii
  panel przeglądarki w aplikacji nie ma grafiki do restartu aplikacji. Nie używać ctx.filter w teksturach.
- Teren: js/terrain.js (groundY, drapeGeometry, groundPose), dane js/bielany-terrain.bin z tools/terrain-bielany.mjs;
  każdy nowy obiekt na ziemi musi brać wysokość z groundY. ?plaski w adresie = płaska mapa do porównań.
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
- Testy: `node --test tests/*.test.mjs tests/*.test.cjs` (132 zielone).
- Dane: `node tools/geo-bielany.mjs` generuje js/bielany-geodata.js; Overpass: tools/overpass.sh; budynki:
  data/extract_bielany_lod1.py (bez pyproj); drzewa: data/extract_bielany_trees.py (strumień 8,6 GB, ~40 min);
  teksty: tools/guide-texts.mjs.
- W konsoli strony: globalThis.bielany (missions, phone, courier, taxi, medic, trams, photo, teleport…).

## Ważne decyzje użytkownika
- Oficjalne nazwy zostają (Galeria Młociny itd.); oficjalny znak „M” metra; bez logo firm i insygniów służb.
- Burmistrz Grzegorz Pietruczuk: prawdziwa osoba, SMS-y w tonie z publicznych wypowiedzi, opublikowane (z dopiskiem
  „wiadomość w grze”).
- Wygląd ze zdjęć (Commons, Mapillary, ortofoto); Google Maps/Street View tylko do porównań.
- Piesi materialni + ragdoll (zgoda na zmianę pedestrians.js); do wersji dla urzędu: PEDESTRIAN_CONTACT = false
  w js/city-config.js.
- Moduły przenośne (controllers, cameras, audio-*, scene-culling) bez zmian; pedestrians.js zmieniony za zgodą.
- Użytkownik nie jest programistą: wszystko po polsku, krótko, komendy uruchamia Claude.

## Otwarte sprawy (docs/backlog.md)
- Błędy WebGPU przy starcie lokalnie (ciepła pamięć shaderów), raz zawieszenie po przeładowaniu publicznej strony.
- Landmarki: wysokości wież, rotunda AWF; Las Bielański i skarpa w Fazie 3.
- Tramwaje: brak kolizji z graczem i dzwonka; linia Marymoncką kończy się przy Cmentarzu Włoskim (dane OSM).
