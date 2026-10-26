# Fazy: bieżący zakres

Status: wersja 1.0 opublikowana 2026-10-26, gałąź faza-4. Fazy 0, 1.5, 2, 3 i 4 zaliczone (bramki Faz 2–4 zamknął Test 1.0 na Windows, docs/test-1.8b.md, 2026-10-26). Faza 1 zrobiona, jej bramka czeka na pakiet dla urzędu. Pakiet dla urzędu i pismo (1.9c, 4.6) odłożone. Scalenie do main dopiero po bramkach.

## Faza 0: Rozpoznanie
Bramka: dane się wczytują, plan Fazy 1 zaakceptowany.

- [x] 0.1 Folder zawiera już CLAUDE.md, docs/ i data/. Podłącz do niego fork (git init, remote add origin, fetch, checkout main) bez nadpisywania tych plików; dodaj data/raw/ do .gitignore. Przeczytaj repo, uruchom oryginał lokalnie, przypnij three.js do konkretnego release w importmap.
      Sprawdzam: Nowy Jork działa w mojej przeglądarce.
- [x] 0.2 Pobierz z Overpass ulice, tory tramwajowe, nazwy i adresy dla bbox 52.274,20.915,52.300,20.960. Budynki są już wycięte w data/bielany_lod1_2024.geojson (2296 szt., patrz data/README.md); sprawdź je na tle OSM. Raport: liczba budynków, rozkład wysokości, długość ulic, pokrycie adresów.
      Sprawdzam: raport ma sensowne liczby.
- [x] 0.3 Wypisz funkcje i moduły zakładające siatkę Manhattanu. Zaproponuj szczegółowy plan Fazy 1 (pliki, kolejność, ryzyka).
      Sprawdzam: akceptuję plan.

Nie zmieniaj logiki miasta w Fazie 0.

## Faza 1: MVP "Bielany przy M1"
Bramka: publiczny link na Cloudflare Pages + pakiet dla urzędu.

- [x] 1.1 Nowa ramka współrzędnych i tools/geo-bielany.mjs generujący js/bielany-geodata.js (na razie tylko ulice). Sprawdzam: minimapa pokazuje ulice Bielan.
- [x] 1.2a Płaska płyta i jezdnie z grafu OSM, Manhattan wyłączony, testy zielone. Sprawdzam: widać jezdnie Bielan, da się po nich chodzić.
- [x] 1.2b Kwartały i chodniki z grafu OSM. Sprawdzam: da się chodzić po chodnikach płaskich ulic Bielan.
- [x] 1.3 Budynki z LoD1 jako bryły z prostą fasadą; jako ostatni podkrok uzupełnienie ok. 82 nowszych budynków z OSM (jeśli blokuje, do backlogu). Sprawdzam: bryły w dobrych miejscach i wysokościach.
- [x] 1.4 Typy fasad: blok, nowe osiedle, pawilon. Sprawdzam: bloki wyglądają jak bielańskie bloki.
- [x] 1.5 Ruch aut na grafie dróg, jazda autem. Sprawdzam: przejazd od stacji Stare Bielany do pętli Młociny.
- [x] 1.6 Preset oświetlenia "Złota jesień" jako domyślny: słońce ok. 26 do 29 stopni w południe, czyste niebo, cieplejszy grading. Sprawdzam: porównanie ze zdjęciem referencyjnym.
- [x] 1.7 Drzewa z modelu GUGiK, jesienne korony (żółć, pomarańcz, rdza z domieszką zieleni), liście na ziemi. Sprawdzam: zieleń tam, gdzie jest naprawdę.
- [x] 1.8a Minimapa z polskimi nazwami, teleporty do stref, atrybucja, wydajność. Sprawdzam: kryteria akceptacji niżej.
- [x] 1.9a Deploy podglądowy na Cloudflare Pages pod szczesliwe-bielany.pages.dev (bez własnej domeny). Sprawdzam: działający link.
- [ ] 1.8b (odłożone) Test wydajności na Windows w Edge na linku z 1.9a (preset "Złota jesień", fps, błędy w konsoli); test robi ktoś z zespołu z laptopem z Windows według docs/test-1.8b.md. Sprawdzam: co najmniej 30 fps, brak błędów.
- [x] 1.9b Podpięcie domeny bielany.zbigniew.ai (działa od 2026-10-25). Sprawdzam: działający publiczny link.
- [ ] 1.9c (odłożone) Pakiet dla urzędu według docs/pakiet-urzad.md, potem scalenie faza-1 do main i bramka zaliczona.

### Kryteria akceptacji Fazy 1
- [ ] Startuje w Chrome i Edge na laptopie, bez błędów w konsoli.
- [ ] Widać pas Stare Bielany, Wawrzyszew, Młociny: obrysy i wysokości z LoD1, ulice zgodne z OSM.
- [ ] Da się przejść pieszo i przejechać autem od stacji Stare Bielany do pętli Młociny.
- [ ] Minimapa z polskimi nazwami ulic i pozycją gracza.
- [ ] Co najmniej 30 fps na zwykłym laptopie w presecie "Złota jesień".
- [ ] Atrybucja OSM i GUGiK w stopce, licencja MIT w repo.
- [ ] Publiczny link.

Poza zakresem Fazy 1: tramwaje, teren, Wisła, noc, landmarki poza AWF, gameplay, smartfon. Wszystko to jest w docs/backlog.md.

## Faza 1.5: Smartfon i kurier
Bramka: pierwsza grywalna pętla. Zaliczona 2026-10-26. Plan: docs/plan-fazy-1.5.md (zaakceptowany 2026-10-25). Kroki 1.5.4–1.5.8 zrobione w nocy 2026-10-25/26 bez sprawdzania po każdym kroku (decyzja z 2026-10-25); pętla kuriera działa na bielany.zbigniew.ai, do Twojego sprawdzenia.

- [x] 1.5.0 Plan Fazy 1.5 (pliki, kolejność, ryzyka). Sprawdzam: akceptuję plan.
- [x] 1.5.1 Adresy z OSM jako punkty dostawy przy chodniku, w wyszukiwarce mapy. Sprawdzam: mapa znajduje „Żeromskiego 29” i pokazuje pinezkę.
- [x] 1.5.2 Trasa GPS po grafie dróg. Sprawdzam: trasa od stacji do adresu idzie ulicami i przelicza się po zjechaniu.
- [x] 1.5.3 Silnik zleceń js/missions.js, znacznik celu w świecie i na mapie. Sprawdzam: testowe zlecenie da się ukończyć.
- [x] 1.5.4 Smartfon (P): Zlecenia, Mapa, SMS, Pocztówki. Sprawdzam: telefon otwiera się, zamyka i nie blokuje sterowania.
- [x] 1.5.5 Rola kuriera (rower, auto, gwiazdki, bonus za skrót). Sprawdzam: 3 dostawy pod rząd, ocena ma sens.
- [x] 1.5.6 Landmarki ze zdjęć, każdy osobno. Sprawdzam: każdy landmark porównany ze zdjęciem.
- [x] 1.5.6b Landmarki dokładniej po uwagach (2026-10-26): Galeria (bębny, wejście, litery), metro z oficjalnym „M”, Młociny jako otwarty daszek, AWF z rotundą i wschodnimi skrzydłami, UKSW i eremy z LoD1 za granicą obszaru, św. Zygmunt z dachem-gwiazdą, Kameduły z brązowymi hełmami. Sprawdzam: landmarki rozpoznawalne.
- [x] 1.5.7 Przewodnik i burmistrz w SMS-ach (burmistrz publicznie od 2026-10-26). Sprawdzam: SMS-y przy landmarkach, poprawne teksty.
- [x] 1.5.8 Deploy i test pętli. Sprawdzam: pełna pętla na publicznym linku.

## Faza 2: Osiedla, taksówkarz, ratownik
Bramka: 60 fps na laptopie. Plan: docs/plan-fazy-2.md (zaakceptowany 2026-10-26).

- [x] 2.0 Plan Fazy 2 (pliki, kolejność, ryzyka). Sprawdzam: akceptuję plan.
- [x] 2.1 Większy obszar 52.262,20.900 – 52.300,20.980 (Słodowiec, Piaski, Kaskada, Chomiczówka, Las Bielański). Sprawdzam: nowe osiedla na mapie, dojazd na Słodowiec, Piaski i Kaskadę.
- [x] 2.2 Wydajność pod większy obszar. Sprawdzam: 60 fps na ziemi, płynny przelot helikopterem.
- [x] 2.3 Tramwaje na torach z OSM. Sprawdzam: tramwaj z Marymontu do pętli Młociny, postoje na przystankach.
- [x] 2.4 Taksówkarz. Sprawdzam: 3 kursy, ocena reaguje na styl jazdy.
- [x] 2.5 Ratownik medyczny. Sprawdzam: wezwanie, dojazd na sygnale, przewóz do szpitala.
- [x] 2.6 Aparat i spadające liście. Sprawdzam: zdjęcie w Pocztówkach, zapis do pliku.
- [x] 2.7 Deploy na bielany.zbigniew.ai (2026-10-26): wszystkie role (kurier, taksówkarz, ratownik), tramwaje, Aparat, większy obszar. Sprawdzam: 60 fps, pełna pętla wszystkich ról na publicznym linku.
- [x] Bramka Fazy 2: 60 fps na zwykłym laptopie z Windows (test według docs/test-1.8b.md, punkty 6a i 6b). Zaliczona 2026-10-26: Test 1.0 na Windows (docs/test-1.8b.md) według autora przechodzi. Na MacBooku M4: 54–60 fps z helikoptera, 60 na ziemi.


## Faza 3: Służby i teren
Bramka: cała dzielnica grywalna. Plan: docs/plan-fazy-3.md (zaakceptowany 2026-10-25 ze wszystkimi 4 decyzjami:
mapa do 20.995 na wschód i 52.311 na północ, zgoda na zmiany w controllers.js, pedestrians.js i cameras.js pod teren,
napisy słowne na pojazdach służb bez insygniów, najpierw teren). Gałąź faza-3.

- [x] 3.0 Plan Fazy 3 (pliki, kolejność, ryzyka, 4 decyzje). Sprawdzam: akceptuję plan i odpowiadam na decyzje.
- [x] 3.1 Dane terenu: NMT GUGiK (WCS, 2 m) na siatce 4 m w układzie świata, data/bielany_nmt_4m.bin i .json,
  podgląd data/podglad_terenu.png z urwiskami OSM (tools/terrain-bielany.mjs). Sprawdzam: na podglądzie widać skarpę,
  dolinę Wisły i Las Bielański tam, gdzie są.
- [x] 3.2a Teren w świecie (2026-10-25): płaskowyż płaski (y = 0 od 96 m n.p.m.), skarpa i dolina Wisły do -21 m
  (js/terrain.js, js/bielany-terrain.bin); asfalt, trawniki, krawężniki, chodniki, farba i tory na jednej siatce 8 m;
  budynki, landmarki, drzewa, sygnalizatory, auta, autobusy, tramwaje, piesi, gracz, kamera i helikopter na gruncie.
  Porównanie z płaską mapą: adres z ?plaski. Poprawki po uwagach (2026-10-25): dźwięk pojazdów, pieszych i helikoptera
  liczony od gruntu (audio-sources.js za zgodą), tory i tramwaje na zielonym pasie Marymonckiej z torowiskiem. Sprawdzam: zejście i zjazd ze skarpy, widok z krawędzi, Kameduły na wzgórzu, 60 fps.
- [x] 3.2b Las Bielański (2026-10-25): granice lasów i 384 leśne ścieżki z OSM (GEO.woods, GEO.paths), ściółka z mchem
  i wydeptane ścieżki na trawnikach w lasach (maska w js/forest.js), ok. 64 tys. krzewów rysowanych do 170 m od kamery
  jedną siatką. Sprawdzone w Edge: 60 fps. Sprawdzam: las wygląda jak las.
- [x] 3.3 Wisła, nabrzeże i most (2026-10-25): mapa do 52.311,20.995 (9201 budynków, 114 tys. drzew, Plac Wilsona),
  Wisła, stawy i plaże z OSM (js/water.js, własny materiał wody), pomosty mostów i wiaduktów z OSM z ruchem, pieszymi,
  barierkami, filarami i tramwajem na Moście Północnym (js/bridges.js), teleport „Most Północny”. 60 fps w Chrome na M4.
  Sprawdzam: przejazd przez most, Wisła pod mostem, plaża.
  Poprawki po teście całości (2026-10-25, zaakceptowane w Edge): Wisłostrada z ruchem (S8 i zjazdy w danych, portale na
  krawędzi mapy) i gładka, wiadukty z prześwitem nad drogami, bez zderzeń z autami na innym poziomie.
- [x] 3.4 Wspólna dyspozytornia służb (2026-10-25): js/dispatch.js (rejestr służb, tryb, oznakowanie pojazdu, syrena
  i ustępowanie aut, SMS-y dyspozytora, okno wyboru choose()), zakładka „Służby” w telefonie, ratownik przeniesiony.
  Sprawdzam: ratownik bez zmian, nowa zakładka „Służby”.
- [x] 3.5 Strażnik Miejski (2026-10-25, sesja równoległa, scalone): js/guard.js, js/guard-car.js; zgłoszenia trawnik,
  śmieci, hałas, wybór pouczenie / mandat / laweta. Sprawdzam: 3 zgłoszenia, wybór zmienia ocenę.
- [x] Tabliczki ulic w stylu warszawskim (MSI, z backlogu; sesja równoległa, scalone 2026-10-25).
- [x] Zwierzęta w lasach: dziki (locha z warchlakami, odyńce), sarny, wiewiórki; js/wildlife.js (prośba użytkownika,
  sesja równoległa, zaakceptowane w Edge, scalone 2026-10-25).
- [x] Stadion Hutnika jako landmark (teleport „Hutnik”, SMS przewodnika) i aplikacja Przewodnik w telefonie (lista
  landmarków, odwiedzone, Nawiguj); sesje równoległe, scalone 2026-10-25.
- [x] 3.6 Strażak (2026-10-25, sesja równoległa, scalone): js/firefighter.js, js/fire-engine.js; pożar, zalana piwnica,
  kot na drzewie (G na miejscu). Sprawdzam: każde zdarzenie do ukończenia.
- [x] 3.7 Policjant (2026-10-25, sesja równoległa, scalone): js/police.js, js/patrol-car.js, polecenia dla auta AI w
  traffic.js (command), zderzenia przez addCollisionWatcher obok dźwięku. Sprawdzam: 2 kontrole i 1 pościg bez taranowania.
- [x] 3.8 Deploy (2026-10-25): wersja b9bfcb1 na bielany.zbigniew.ai (wszystkie role, teren, Wisła, mosty, lasy ze
  zwierzętami, Stadion Hutnika, Przewodnik); w Chrome na M4 60 fps przy Moście Północnym, bez błędów w konsoli.
- [x] Bramka Fazy 3: cała dzielnica grywalna, 60 fps na laptopie z Windows (docs/test-1.8b.md: skarpa, Kameduły,
  Most Północny, las). Zaliczona 2026-10-26: Test 1.0 na Windows (docs/test-1.8b.md) według autora przechodzi.

## Faza 4: Czaty LLM i patronat
Bramka: wersja 1.0 z patronatem (bez zgody urzędu: 1.0 z przewodnikiem, bez burmistrza i logo). Plan: docs/plan-fazy-4.md
(zaakceptowany 2026-10-25 ze wszystkimi propozycjami: Haiku 5.5 dla przewodnika, Sonnet 5.5 dla burmistrza,
1000 pytań dziennie i 30 USD miesięcznie, najpierw przewodnik, pismo do urzędu wysyła autor, wersja dla urzędu bez
potrącania pieszych, bez zapisu rozmów; SMS-y od „Burmistrz Bielan” bez nazwiska do czasu zgody). Gałąź faza-4.

- [x] 4.0 Plan Fazy 4 (zaakceptowany 2026-10-25): czat z przewodnikiem i burmistrzem przez Cloudflare Worker, limity i koszty,
  tryb bez czatu, warunki dla burmistrza, wersja dla urzędu, patronat. Sprawdzam: akceptuję plan i odpowiadam na decyzje.
- [x] 4.1 Worker i bezpieczniki (bez modelu): worker/ (Cloudflare Worker bielany-czat, trasa bielany.zbigniew.ai/api/*,
  jeszcze nieopublikowany), umowa z grą docs/api-czat.md, limity 20 pytań / 10 min z adresu, 300 znaków, 6 wymian,
  1000 pytań dziennie, 30 USD miesięcznie, Turnstile + sesja na 1 h, tylko adresy gry, wyłącznik CHAT_OFF, liczniki bez
  treści i bez adresów IP (skrót z solą). Lokalnie: sh tools/czat-dev.sh, strona tools/czat-test.html.
  Sprawdzam: na localhost pytanie dostaje odpowiedź testową, 21. pytanie w 10 minut dostaje „zwolnij” (sprawdzone 2026-10-26).
- [x] 4.2 Aplikacja „Czat” w telefonie i tryb bez czatu (js/chat.js, ?czat=off, CHAT_MAYOR = false, atrapa tools/fake-czat.mjs).
  Sprawdzam: rozmowa z odpowiedziami testowymi, „zwolnij”, tryb bez czatu (sprawdzone 2026-10-26).
- [x] 4.3 Baza wiedzy przewodnika (docs/wiedza-przewodnika.md, tools/wiedza-przewodnika.mjs → worker/src/wiedza-przewodnika.js)
  i 30 pytań kontrolnych (docs/pytania-kontrolne-przewodnik.md). Sprawdzam: baza i lista pytań (zaakceptowane 2026-10-26).
- [x] 4.4 Czat z przewodnikiem na żywo (localhost): Worker pyta Claude Haiku 5.5 (worker/src/model.js, baza wiedzy
  w pamięci podręcznej, koszt do budżetu, GUIDE_MODEL przełącza model), „Nawiguj: <miejsce>” pod odpowiedzią,
  tools/czat-pytania.mjs → docs/odpowiedzi-kontrolne-przewodnik.md (30 pytań, koszt ok. 0,009 USD).
  Sprawdzam: 10 własnych pytań w grze; przegląd odpowiedzi na pytania kontrolne (każda „OK” albo uwaga) (sprawdzone 2026-10-26).
- [x] 4.5 Publikacja czatu z przewodnikiem: Worker bielany-czat na bielany.zbigniew.ai/api/* (sekrety ANTHROPIC_API_KEY
  i TURNSTILE_SECRET wpisane przez autora, widżet Turnstile „bielany-czat”), strona 6d6dadd (wersja 0.7), informacja
  o AI nad rozmową. Sprawdzone w Chrome: odpowiedź z bazy, bez błędów w konsoli. Przez tydzień codzienny podgląd
  kosztów w konsoli Anthropic.
  Sprawdzam: czat działa na bielany.zbigniew.ai w Edge (sprawdzone 2026-10-26), koszty dnia w zakładanym limicie.
- [x] 4.7–4.8 Czat z postacią „Burmistrz Bielan” bez zgody urzędu (decyzja 8 w docs/plan-fazy-4.md): bez imienia
  i nazwiska, bez patronatu; baza z publicznych stron (docs/wiedza-burmistrza.md, 28 haseł ze źródłami) + baza
  przewodnika, instrukcje worker/prompts/burmistrz.md, Claude Sonnet 5.5, drugi bezpiecznik w Workerze (polityka,
  obietnice, nazwiska), wyłącznik MAYOR_OFF, stopka „Odpowiedź AI w grze, nie oficjalne stanowisko Urzędu Dzielnicy
  Bielany” pod każdą odpowiedzią. 50 pytań kontrolnych: docs/odpowiedzi-kontrolne-burmistrz.md (0,35 USD).
  Sprawdzam: rozmowa w grze na localhost; przegląd 50 odpowiedzi (OK albo uwaga) (zaakceptowane 2026-10-26).
  Opublikowane 2026-10-26 (wersja 0.8, strona e2c8ab9).
- [ ] 4.6 Pismo do urzędu (docs/pismo-urzad-czat.md, pakiet docs/pakiet-urzad.md): szkic scalony do faza-4 2026-10-26,
  nie wysłany; czeka na adresata i dane do podpisu (autor wróci do niego później).
- [x] 4.9 Wersja dla urzędu: ?urzad wyłącza kontakt z pieszymi (URZAD, PEDESTRIAN_CONTACT w js/city-config.js), znaczek
  „wersja dla urzędu”. Sprawdzam: pieszych nie da się potrącić, znaczek widoczny (sprawdzone 2026-10-26).
- [ ] 4.10 Logo dzielnicy i patronat: pominięty decyzją autora z 2026-10-26 (bez decyzji urzędu o patronacie).
- [x] 4.11 Wersja 1.0 i bramka: ceny modeli sprawdzone 2026-10-26 (Sonnet 5.5 tańszy odczyt z pamięci podręcznej),
  test na Windows rozszerzony o skarpę, Most Północny i czat w trakcie jazdy (docs/test-1.8b.md, „Test 1.0”).
  Publikacja przed testem jako 0.9, numer 1.0 po zaliczonym teście. Test robi autor.
  Sprawdzam: pełna pętla na bielany.zbigniew.ai w Edge na Windows, czat działa, z ?czat=off gra działa dalej.
  Test przeszedł 2026-10-26 (według autora); opublikowane jako 1.0.
- [x] Bramka Fazy 4: „1.0 bez patronatu” (decyzja 8), kryteria w docs/plan-fazy-4.md; ten sam test zamyka bramki Faz 2 i 3. Zaliczona 2026-10-26: Test 1.0 na Windows (docs/test-1.8b.md) według autora przechodzi.
