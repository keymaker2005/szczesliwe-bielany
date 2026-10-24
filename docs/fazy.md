# Fazy: bieżący zakres

Status: FAZA 1 (MVP "Bielany przy M1"). Faza 0 zamknięta 2026-10-24, plan: docs/plan-fazy-1.md. Kolejna faza startuje dopiero po przejściu bramki poprzedniej.

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
- [ ] 1.6 Preset oświetlenia "Złota jesień" jako domyślny: słońce ok. 26 do 29 stopni w południe, czyste niebo, cieplejszy grading. Sprawdzam: porównanie ze zdjęciem referencyjnym.
- [ ] 1.7 Drzewa z modelu GUGiK, jesienne korony (żółć, pomarańcz, rdza z domieszką zieleni), liście na ziemi. Sprawdzam: zieleń tam, gdzie jest naprawdę.
- [ ] 1.8a Minimapa z polskimi nazwami, teleporty do stref, atrybucja, wydajność. Sprawdzam: kryteria akceptacji niżej.
- [ ] 1.8b Test wydajności na Windows w Edge (preset "Złota jesień", fps, błędy w konsoli). Sprawdzam: co najmniej 30 fps, brak błędów.
- [ ] 1.9 Deploy na Cloudflare Pages pod bielany.zbigniew.ai. Sprawdzam: działający publiczny link.

### Kryteria akceptacji Fazy 1
- [ ] Startuje w Chrome i Edge na laptopie, bez błędów w konsoli.
- [ ] Widać pas Stare Bielany, Wawrzyszew, Młociny: obrysy i wysokości z LoD1, ulice zgodne z OSM.
- [ ] Da się przejść pieszo i przejechać autem od stacji Stare Bielany do pętli Młociny.
- [ ] Minimapa z polskimi nazwami ulic i pozycją gracza.
- [ ] Co najmniej 30 fps na zwykłym laptopie w presecie "Złota jesień".
- [ ] Atrybucja OSM i GUGiK w stopce, licencja MIT w repo.
- [ ] Publiczny link.

Poza zakresem Fazy 1: tramwaje, teren, Wisła, noc, landmarki poza AWF, gameplay, smartfon. Wszystko to jest w docs/backlog.md.
