# Plan Fazy 1: "Bielany przy M1" (krok 0.3)

Stan: propozycja do akceptacji. Nic z tego nie jest jeszcze zrobione.

## Główna strategia

1. **Zachowujemy "kontrakt miasta", wymieniamy jego zawartość.** Moduły przenośne (controllers, cameras, pedestrians, scene-culling, audio-*) importują z miasta tylko kilka nazw. Nowe moduły Bielan eksportują te same nazwy, więc moduły przenośne zostają nietknięte:
   - z `city-config.js`: `ISLAND_BOUNDS`, `CENTRAL_PARK_BOUNDS`, `getIslandBoundsAtZ`, `blockAt`, `streetZ`, `isTypingInField`, `signalPhase`, `walkSignal`;
   - z `landmarks.js`: `bryantParkLawn` (zaślepka: pusty trawnik poza mapą).
2. **Kod Nowego Jorku usuwamy, nie ukrywamy za przełącznikiem.** Zostaje w historii gita (gałąź main sprzed Fazy 1). Dzięki temu kod jest o ok. 40% krótszy i nie ma dwóch światów do utrzymania.
3. **Dane budujemy narzędziem, nie w przeglądarce.** `tools/geo-bielany.mjs` czyta `tools/data/osm_bielany_*.json` i `data/bielany_lod1_2024.geojson`, a zapisuje `js/bielany-geodata.js` (jak dziś `nyc-geodata.js`). Ramka współrzędnych jest już gotowa w `tools/report-bielany.mjs`.
4. **Ruch zostaje.** `traffic.js` już działa na ogólnym grafie (krawędzie z dowolnym kierunkiem, zakręty jako krzywe Béziera). Wystarczy usunąć z `road-network.js` etapy siatki i zostawić gałąź `general`.

## Moduły zakładające siatkę Manhattanu

Trudność: **ł** = łatwe (głównie usunięcie), **ś** = średnie, **t** = trudne (wymaga nowego kodu).

| Moduł | Co zakłada | Co robimy | Trudność |
| --- | --- | --- | --- |
| `city-config.js` | ulice = stałe z, aleje = stałe x (`streetZ`, `avenueX`, `ALL_AVENUES`, `ALL_STREETS`), wyspa opisana szerokością na danym z, dzielnice, mosty, mola, teleporty NYC, sygnalizacja "aleja/ulica" | przepisać na dane z OSM: lista ulic z nazwami, wielokąt obszaru, osiedla z OSM, teleporty Bielan; zachować eksportowane nazwy | ś |
| `city-grid.js` | wybrzeże Manhattanu, Central Park, place (Times Sq.), mola, wiadukt FDR; chodniki jako prostokąty osiowe | usunąć NYC; teren = płaska płyta; chodniki jako wielokąty z obrysów kwartałów | ś |
| `road-network.js` | etapy 2–4 (korytarze alej, przecznice, skrzyżowania 90°), sygnalizacja na skrzyżowaniach alej i ulic, `MAJOR` po nazwach NYC | usunąć etapy 2–4 i 8; graf tylko z OSM; sygnalizacja z węzłów OSM `highway=traffic_signals`; klasa drogi z tagu `highway` | ś |
| `traffic.js` | faza świateł wybierana z dwóch osi (`phaseOf`, l. 421, 1959); przejścia piesze po stronach świata (l. 1469, 1592); taksówki i radiowozy NYPD, autobus "M1 5 AV" | fazy świateł według grup (0..n); przejścia według krawędzi; fikcyjne malowania | ś |
| `pedestrian-routes.js` | `across` (l. 49–67): 4 strony, przejścia osiowe | przejścia budowane wzdłuż normalnej krawędzi | ś |
| `road-paint.js`, `vehicle-lights.js` | nic | bez zmian | - |
| `buildings.js` | każdy budynek to suma prostokątów osiowych na działce; typologie Manhattanu; Times Square | nowy generator: obrys LoD1 wyciągnięty na wysokość `height_m`; zostają Quadtree, strumieniowanie detali, wyposażenie dachów | t |
| `tsl-materials.js` | shader fasad liczy okna z `x` albo `z` świata (na skośnej ścianie okna rozciągają się do 1,41×) | wariant fasady z atrybutami ściany (długość, pozycja wzdłuż ściany, wysokość, rodzaj); reszta shadera (wnętrza, okna) zostaje | ś |
| `boroughs.js` | cały Nowy Jork poza Manhattanem, mosty, wyspy | usunąć; zachować narzędzia: `extrudeFootprint`, `buildBuildingChunks`, `createPartCollector` | ł |
| `landmarks.js` | 11 ikon NYC | usunąć; zostawić `fitToSite` (z obrotem) i zaślepkę `bryantParkLawn` | ł |
| `street-details.js` | sygnalizatory, hydranty, drzewa przy alejach; współrzędne NYC | sygnalizatory z węzłów OSM; latarnie już chodzą po krawędziach wielokątów; drzewa w kroku 1.7 | ś |
| `trees.js` | gatunki NYC | dodać polskie gatunki w kroku 1.7 | ł |
| `fire-escapes.js` | schody pożarowe NYC | wyłączyć (wzór przyda się na balkony w Fazie 2) | ł |
| `nyc-map.js` | obrót siatki 29°; NYC: obszary, aliasy, środek mapy w Times Square | podać dane Bielan; poprawić błąd obrotu; polskie etykiety; wyszukiwanie bez polskich znaków ("zlota" znajduje "Złota") | ś |
| `lighting.js` | kierunki słońca w obróconej ramce NYC | nowy preset "Złota jesień"; przeliczyć azymuty pozostałych | ł |
| `main.js`, `index.html` | nazwy grup do cullingu "Manhattan...", kamery 8/9/0, teksty, mph, klucz zapisu `nyc-player-state` | teksty po polsku, km/h, nowy klucz zapisu, stopka z atrybucją | ł |
| `tools/geo-*.mjs`, `build-geodata.mjs` | dane NYC (CSCL, DCP) | usunąć; nowe `tools/geo-bielany.mjs` (rdp, pointInRing, łączenie węzłów co 1 m przeniesiemy) | ś |

### Ukryte założenia w modułach przenośnych (wymagają Twojej zgody)
Dzięki strategii z punktu 1 logika tych modułów zostaje bez zmian. Kilka rzeczy jest jednak wpisanych na sztywno:
- `controllers.js`: napisy "NYC TAXI" i "NYC T&LC" na taksówce gracza, nazwy 'NYC Yellow Taxi' i 'NYC Bike Lane Cyclist', start gracza przy x = −11,6 / 3,6 / 5,2 (przy 5th Ave), wysokość trawnika Central Parku 1,24 m w `getGroundHeight`.
- `cameras.js`: 8 ujęć z NYC (Central Park, Times Square, Chrysler...) o stałych współrzędnych.
- `audio-sources.js`: dźwięk przejścia zależy od podziału "aleja/ulica". Wystarczy, że nowy graf poda `axisIndex` i `isAvenue`, a samego modułu nie trzeba ruszać.

**Prośba o zgodę (w krokach 1.2 i 1.8):** zmienić w `controllers.js` napisy i miejsce startu oraz w `cameras.js` tabelę ujęć. To zmiany danych, nie logiki.

## Kolejność kroków (zgodnie z docs/fazy.md)

### 1.1 Ramka współrzędnych i ulice
- Pliki: nowe `tools/geo-bielany.mjs` oraz wygenerowany `js/bielany-geodata.js` (ulice, nazwy, graf dróg w formacie `roadGraph` z NYC); w `nyc-map.js` poprawka obrotu (`||` na `??`) i podpięcie ulic Bielan.
- Test: nowy `tests/geo-bielany.test.mjs` (stacja Stare Bielany w punkcie 0,0; Młociny ok. 1,7 km na pn.-zach.; nazwy z polskimi znakami).
- Uwaga: w tym kroku świat 3D jest jeszcze Nowym Jorkiem, a minimapa pokazuje już Bielany. To normalne, do kroku 1.2.

### 1.2 Jezdnie i chodniki, Manhattan wyłączony
- Pliki: `city-config.js` (nowa zawartość, stare nazwy eksportów), `city-grid.js` (płaska płyta + chodniki z wielokątów), `road-network.js` (sam graf OSM), `main.js` (bez boroughs/landmarks NYC, nowe nazwy grup), zaślepka `landmarks.js`.
- Kwartały (obszary między ulicami) liczymy w `geo-bielany.mjs` metodą rastrową z `geo-blocks.mjs`.
- Testy: przepisać `teleports.test.cjs` i `geodata.test.mjs` na Bielany; poprawić `boot.test.cjs` (liczba modułów).

### 1.3 Budynki z LoD1 jako bryły
- Pliki: nowy generator w `buildings.js` (obrys → ściany + dach, scalone w paczki ok. 400 m), kolizje jako obrócone prostokąty (OBB) dopasowane do obrysu.
- Koszt: ok. 2,3 tys. budynków, ok. 70 tys. trójkątów, czyli sto razy mniej niż Manhattan.

### 1.4 Typy fasad: blok, nowe osiedle, pawilon
- Pliki: `tsl-materials.js` (wariant fasady z atrybutami ściany), `buildings.js` (wybór typu).
- Reguła typu (do dopracowania): wysokość, rok budowy (OSM `start_date`, jeśli jest), kształt obrysu, tag `building` z OSM (`apartments`, `retail`, `commercial`).
- Punkty wyjścia: `projectsBlock` (bloki na trawniku) dla wielkiej płyty, `createCurtainWallMaterial` dla nowych osiedli i pawilonów, `createPreWarBuildingMaterial` dla przedwojennych Starych Bielan.

### 1.5 Ruch aut i jazda autem
- Pliki: `traffic.js` (fazy świateł według grup, przejścia według krawędzi, fikcyjne malowania aut i autobusów), `pedestrian-routes.js` (`across`).
- Trasa testowa: Stare Bielany → pętla Młociny (al. Reymonta lub Wólczyńska / Kasprowicza).

### 1.6 Preset "Złota jesień"
- Pliki: `lighting.js`, `index.html`.
- Słońce w Warszawie (52,3° N) w południe stoi na wysokości 26–29° w drugiej połowie października. Wektor przy azymucie z południa: `(0, 0,454, 0,891)` (+z = południe w nowej ramce).
- Pozostałe presety: przeliczyć azymuty po usunięciu obrotu 29°.

### 1.7 Drzewa z GUGiK
- Dane: modele drzew GUGiK LoD1 2023 dla Warszawy. Nie są jeszcze pobrane; ich format i rozmiar ustalimy na początku kroku.
- Pliki: `tools/geo-bielany.mjs` (wycinek drzew), `trees.js` (gatunki: lipa, kasztanowiec, klon, brzoza, sosna; jesienne korony), `street-details.js` (liście na ziemi).

### 1.8 Minimapa, teleporty, atrybucja, wydajność
- Pliki: `nyc-map.js` (polskie etykiety osiedli, ulic, stacji), `city-config.js` (teleporty: Stare Bielany, Wawrzyszew, Młociny, AWF), `index.html` (stopka z atrybucją, teksty po polsku, km/h).
- Pomiar: licznik fps w presecie "Złota jesień" na Twoim laptopie (M4), cel ≥ 30 fps.

### 1.9 Deploy na Cloudflare Pages
- Strona jest statyczna (bez budowania), więc wystarczy wgrać katalog z repo.
- Od Ciebie: konto Cloudflare i domena zbigniew.ai w Cloudflare. Kliknięcia poprowadzę krok po kroku.

## Ryzyka

| Ryzyko | Skutek | Jak ograniczamy |
| --- | --- | --- |
| three.js przypięty do commita dev; kod mrdooba może wymagać nowszych funkcji | po aktualizacji wersji coś się psuje | zostajemy na `fae8734` do końca Fazy 1; zmiana wersji tylko świadomie |
| Kwartały z OSM nie są zamknięte (ulice kończą się ślepo, ścieżki przecinają osiedla) | chodniki i kolizje mają dziury | kwartały rastrowo, tylko z jezdni (bez ścieżek); test na całym obszarze |
| Shader fasad na skośnych ścianach | rozciągnięte okna | nowy wariant z atrybutami ściany; test `facade-projection` rozszerzony o ścianę pod 45° |
| Ronda i drogi dwujezdniowe w grafie OSM | korki lub auta stające na rondach | ronda jako łańcuchy jednokierunkowe (już obsługiwane); w razie problemów wyłączamy ruch na rondzie i wpisujemy to do backlogu |
| Długie pierwsze ładowanie (shadery) i komunikat Edge "strona nie odpowiada" | złe pierwsze wrażenie | mniejsze miasto (2,3 tys. zamiast 118 tys. budynków) powinno to rozwiązać; mierzymy w 1.3 |
| Drzewa GUGiK: nieznany format i rozmiar | opóźnienie 1.7 | rozpoznanie danych na początku kroku; w razie problemów drzewa z OSM (`natural=tree`, `landuse=forest`) |
| Budynki nowsze niż pomiar GUGiK z 2023 r. (82 duże obiekty w OSM) | brakujące bryły | w 1.3 uzupełniamy z OSM (wysokość z `building:levels` × 3 m) |
| Testy zależne od danych NYC (`teleports`, `geodata`, `boot`) | czerwone testy w 1.1–1.2 | przepisujemy je w tym samym kroku, w którym zmienia się miasto |

## Drobne błędy znalezione przy okazji (naprawa w Fazie 1)
- `nyc-map.js:44`: kąt obrotu 0 jest traktowany jak brak wartości (`||`), więc mapa obróciłaby się o 29°. Naprawa w 1.1.
- Brak atrybucji OSM i GUGiK w interfejsie (jest tylko link do GitHuba). Naprawa w 1.8.
