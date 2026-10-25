# Fazy: bieżący zakres

Status: FAZA 2 (osiedla, taksówkarz, ratownik), gałąź faza-2. Faza 1.5 zaliczona 2026-10-26. Faza 0 zamknięta 2026-10-24. Faza 1 zrobiona poza bramką: test 1.8b i pakiet dla urzędu odłożone decyzją z 2026-10-25 (wracamy później); do tego czasu main zostaje bez zmian, a faza-1.5 wychodzi z faza-1. Kolejna faza startuje dopiero po przejściu bramki poprzedniej, chyba że zdecyduję inaczej.

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
- [ ] 2.1 Większy obszar 52.262,20.900 – 52.300,20.980 (Słodowiec, Piaski, Kaskada, Chomiczówka, Las Bielański). Sprawdzam: nowe osiedla na mapie, dojazd na Słodowiec, Piaski i Kaskadę.
- [ ] 2.2 Wydajność pod większy obszar. Sprawdzam: 60 fps na ziemi, płynny przelot helikopterem.
- [ ] 2.3 Tramwaje na torach z OSM. Sprawdzam: tramwaj z Marymontu do pętli Młociny, postoje na przystankach.
- [ ] 2.4 Taksówkarz. Sprawdzam: 3 kursy, ocena reaguje na styl jazdy.
- [ ] 2.5 Ratownik medyczny. Sprawdzam: wezwanie, dojazd na sygnale, przewóz do szpitala.
- [ ] 2.6 Aparat i spadające liście. Sprawdzam: zdjęcie w Pocztówkach, zapis do pliku.
- [ ] 2.7 Deploy i bramka. Sprawdzam: 60 fps, pełna pętla wszystkich ról na publicznym linku.

