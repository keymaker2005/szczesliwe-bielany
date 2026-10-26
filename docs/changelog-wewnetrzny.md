# Wewnętrzny changelog

Historia prac nad projektem: fazy, kroki, gałęzie, ważne decyzje i poprawki, z commitami. Od najnowszej fazy.
Publiczne wersje (to, co było na bielany.zbigniew.ai): CHANGELOG.md. Plany faz: docs/plan-fazy-*.md, lista kroków:
docs/fazy.md, otwarte sprawy: docs/backlog.md, przekazanie sesji: docs/stan-projektu.md.

## Faza 4: Czaty LLM i patronat (gałąź faza-4, 2026-10-26)

Plan: docs/plan-fazy-4.md (zaakceptowany ze wszystkimi decyzjami). Praca równoległa jak w Fazie 3: koordynator robi 4.1,
4.4, 4.5, 4.7, 4.8, 4.10, 4.11; 4.2, 4.3, 4.6, 4.9 w osobnych sesjach na własnych gałęziach.

- `6d9426b` 4.0 plan Fazy 4.
- `3a62dee` 4.1 umowa API czatu (docs/api-czat.md) przed startem sesji równoległych.
- 4.1 Worker bez modelu (worker/: limity, Turnstile, sesja, wyłącznik CHAT_OFF, Durable Object z licznikami),
  tests/worker.test.mjs, tools/czat-dev.sh, tools/czat-test.html (`a43f59f`). Sprawdzony 2026-10-26.
- `8adbe7b` 4.2 aplikacja Czat w telefonie — sesja czat-telefon (gałąź claude/peaceful-tharp-f7a4f7), scalone `3c75dd9`.
- `976adde` 4.3 baza wiedzy przewodnika i 30 pytań kontrolnych — sesja wiedza-przewodnika (claude/wiedza-przewodnika-4-3),
  scalone `a988841`.
- `e07334f` 4.9 wersja dla urzędu ?urzad — sesja urzad-wersja (claude/intelligent-stonebraker-07792c), scalone `0d93482`.
- `48354cb` 4.4 model w Workerze (Haiku 5.5, bez rozumowania, effort low), Nawiguj pod odpowiedzią, skrypt pytań
  kontrolnych; pierwszy przebieg 30 pytań: 0,0086 USD (ok. 0,03 centa za pytanie). Sprawdzony 2026-10-26.
- `6923d98`, `6d6dadd` 4.5 informacja o AI, klucz Turnstile; Worker bielany-czat wdrożony (trasa bielany.zbigniew.ai/api/*),
  publikacja strony 6d6dadd (wersja 0.7 w CHANGELOG.md). Wdrożenie Workera wymaga wyraźnego polecenia autora
  (ochrona trybu auto odrzuciła próbę bez niego).
- 4.7–4.8 czat z postacią „Burmistrz Bielan” (decyzja 8: bez zgody urzędu, bez nazwiska i patronatu): baza z publicznych
  stron (pomocnik Sonnet), Sonnet 5.5, drugi bezpiecznik, osobne rozmowy w telefonie; 50 pytań kontrolnych 0,35 USD,
  bezpiecznik nie zadziałał ani razu (`e2c8ab9`). Zaakceptowane i opublikowane 2026-10-26 (wersja 0.8).
- `a0fb317` 4.6 szkic pisma do urzędu i pakiet — sesja pismo-urzad (faza-4-krok-4.6-pismo), scalone 2026-10-26, nie wysłane.
- Uwaga z scaleń: sesje w ponownie użytych folderach worktree zacommitowały kopie macOS „plik 2.js” (`git add -A`);
  usunięte przed scaleniem. Przy kolejnych sesjach sprawdzać `git diff --stat faza-4...<gałąź>` przed scaleniem.

## Faza 3: Służby i teren (gałąź faza-3, 2026-10-25)

Plan: docs/plan-fazy-3.md (decyzje: mapa do Wisły i mostu, zgoda na zmiany w controllers.js / pedestrians.js /
cameras.js pod teren, napisy słowne na pojazdach służb, najpierw teren). Od kroku 3.4 praca równoległa
(docs/praca-rownolegla.md): sesja koordynująca + osobne sesje na służby i zadania z backlogu, scalenia po akceptacji.

- `90f6d89` 3.0 plan Fazy 3.
- `5bb7e74` 3.1 dane terenu: NMT GUGiK przez WCS (2 m) na siatce 4 m w układzie świata (tools/terrain-bielany.mjs,
  data/bielany_nmt_4m.*, podgląd z urwiskami OSM).
- `4392998` 3.2a teren w grze: js/terrain.js (groundY na trójkątnej siatce 8 m, drapeGeometry, groundTiles,
  groundPose), pole gry js/bielany-terrain.bin (próg płaskowyżu 96 m n.p.m., dolina połączona z Wisłą); wszystkie warstwy
  i ruch na terenie, przełącznik ?plaski.
- `90a33d9` 3.2a poprawki: dźwięk od gruntu (audio-sources.js za zgodą), tory i tramwaje na zielonym pasie Marymonckiej
  z torowiskiem.
- `267c877` 3.2b lasy: GEO.woods / GEO.paths z OSM, js/forest.js (maska ściółki i ścieżek, krzewy w jednej puli).
  Lekcja: ctx.filter (blur) na dużym płótnie 2D wysypywał proces GPU przeglądarki — usunięty.
- `dce1107` plan pracy równoległej; `a37a2f4` backlog: pomysł gry dla wielu osób (Faza 5).
- `d4f1b9f` 3.3 mapa do 52.311,20.995 (OSM, LoD1, drzewa: stary wycinek + nowy pas, bo strumień paczki urwał się przy
  355 z 484 arkuszy), js/water.js (Wisła, stawy, plaże; własny materiał wody, bo nowojorski nie kompilował się),
  js/bridges.js (pomosty z bridge=yes dla dróg i tramwaju, garb, barierki, filary), teleport Most Północny, kominy EC
  Żerań pominięte.
- `0955398` 3.4 js/dispatch.js: rejestr służb, oznakowanie pojazdu, syrena i ustępowanie aut, SMS-y dyspozytora,
  choose(); zakładka „Służby”, ratownik przeniesiony.
- `38d75bb` tabliczki ulic po warszawsku (MSI) — sesja tabliczki-ulic, scalone `0cf146e`.
- `52446cd` 3.5 Strażnik Miejski (js/guard.js, js/guard-car.js) — sesja straznik-miejski, scalone `ec3a266`.
- `a0e9d32` 3.6 Strażak (js/firefighter.js, js/fire-engine.js) — sesja strazak, scalone `4e881a5`.
- `88ddc56` 3.7 Policjant (js/police.js, js/patrol-car.js, polecenia dla auta AI w traffic.js) — sesja policjant,
  scalone `6a42310` (addCollisionWatcher obok słuchacza dźwięku).
- `6e22778` po scaleniu: podwójna nazwa createPatrolCar i zgubiony nawias w main.js zatrzymywały grę; nowy test
  składni wszystkich modułów (tests/syntax.test.cjs).
- `e1f0817` po teście całości: S8 (motorway, motorway_link) w danych, portale na krawędzi mapy i mosty bez sprawdzania
  krawężników w sieci ruchu (Wisłostrada z ruchem), wygładzony teren pod głównymi drogami, prześwit 6 m nad drogami
  (podjazd do 12 %), wejście na pomost z 0,6 m, kontakty z ruchem tylko na tym samym poziomie, wygładzone pochylenie aut.
- `293439e` zwierzęta: dziki, sarny, wiewiórki (js/wildlife.js) — sesja zwierzeta-las, scalone `230213f`.
- `80703c9`, `482afa2` Stadion Hutnika (landmark, teleport, SMS) — sesja stadion-hutnika; `d3fb217` aplikacja Przewodnik
  w telefonie — sesja przewodnik-lista-landmar; scalone `af26253`, `418f12c`.
- `0e19fb6` 3.8 publikacja b9bfcb1. Bramka (60 fps na Windows) czeka; otwarte: 52-56 fps pieszo przy Kamedułach w Chrome
  na M4, 30 fps zgłoszone w Edge, słaby ruch AI na Moście Północnym, falujące wiadukty na płaskowyżu (backlog).

## Faza 2: Osiedla, taksówkarz, ratownik (gałąź faza-2, 2026-10-25)

Plan: docs/plan-fazy-2.md. Bramka (60 fps na Windows) czeka na test według docs/test-1.8b.md.

- `671d84b`, `7187631` 2.1 obszar 52.262,20.900–52.300,20.980: OSM, LoD1 (6016), drzewa GUGiK (77 777), teleporty.
- `f319421` 2.2 wydajność: dalekie korony bez cieni, przerzedzenie dalekich drzew, krótsze LOD.
- `c722b7a` 2.3 tramwaje na torach z OSM (3 linie, przystanki, auta ustępują).
- `c37f4bf`, `47939c1` 2.4 taksówkarz, ocena komfortu, limity prędkości z OSM.
- `f553847`, `7b2105a` 2.5 ratownik i karetka według zdjęcia warszawskiego ambulansu; Shift zdejmuje limit.
- `b32adf0` 2.6 Aparat, Pocztówki (IndexedDB), udostępnianie na X, spadające liście.
- `f8034b4`, `15dd4b8` piesi materialni i ragdoll (pedestrians.js za zgodą; PEDESTRIAN_CONTACT do wersji dla urzędu),
  mniej aut, autobusów i pieszych. Publikacja 15dd4b8.
- `44fda98` 2.7 Faza 2 na bielany.zbigniew.ai; `84ec8a1` stan projektu do przekazania sesji.

## Faza 1.5: Smartfon i kurier (gałąź faza-1.5, 2026-10-25)

Plan: docs/plan-fazy-1.5.md (prawdziwe nazwy miejsc, burmistrz, źródła wyglądu). Zaliczona 2026-10-26 (zapis w fazy.md).

- `050b9be` 1.5.1 adresy OSM i wyszukiwarka; `fa5d808` 1.5.2 GPS (A*); `f0fe66a`, `e92bbfa` 1.5.3 silnik zleceń.
- `bb6eaf5` 1.5.4 smartfon; `9f4c9be` 1.5.5 kurier Pocztylion Bielański.
- `5252e17` 1.5.7 przewodnik i robocze SMS-y burmistrza; `494f7b6` 1.5.6 landmarki ze zdjęć (publikacja).
- `9e5a64c` 1.5.8 wersja wydania (?v=) w adresach modułów (publikacja); `04944dd` 1.5.8 zamknięty.
- `3d513d4` landmarki dokładniej, oficjalny znak „M” metra, SMS-y burmistrza publicznie (publikacja); `60bf11f` Faza 1.5
  zaliczona, start Fazy 2.

## Faza 1: Bielany wzdłuż M1 (gałąź faza-1, 2026-10-24/25)

Plan: docs/plan-fazy-1.md. Bramka czeka na test na Windows (1.8b) i pakiet dla urzędu (docs/pakiet-urzad.md).

- `52f87f0` 1.1 ramka Bielan, tools/geo-bielany.mjs, minimapa.
- `d153613` 1.2a jezdnie z OSM (Manhattan wyłączony); `10ca322` 1.2b kwartały, krawężniki, chodniki.
- `7c732f8`, `a313cc4` 1.3 bryły z LoD1 i nowsze budynki z OSM.
- `b178272`, `93fffea` 1.4 fasady według zdjęć Bielan.
- `7a768f7` 1.5 ruch aut na grafie Bielan, sygnalizacja z OSM.
- `54704e9` 1.6 preset „Złota jesień”; `7f4224b` 1.7 drzewa GUGiK; `08442de` 1.8a polskie nazwy, teleporty, atrybucja.
- `50b4865` 1.9a paczka strony (tools/build-dist.mjs), pierwsza publikacja; `4c7252c` 1.9b domena bielany.zbigniew.ai.

## Faza 0: Przygotowanie (2026-10-24)

- `d8ae9b6`, `18d3083`, `3fc21fe` 0.1 fork, three.js przypięty do commita dev fae8734, serwer lokalny.
- `b45831c`, `82c2c07` 0.2 dane OSM dla bbox i raport z porównaniem LoD1 (docs/raport-0.2.md).
- `e34b869`, `b1e86d4` 0.3 zależności od siatki Manhattanu, plan Fazy 1.

Przed Fazą 0: historia oryginału mrdoob/slop-newyork (tag nyc-original, od `2a1d5e7`).
