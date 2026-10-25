# Dane

| Plik | Co to jest | Źródło i licencja |
| --- | --- | --- |
| raw/LoD1_2024_Warszawa_1465.zip | Modele 3D budynków LoD1 2024, cała Warszawa (CityGML, EPSG:2180, 127 arkuszy, 153 109 budynków) | GUGiK, geoportal.gov.pl, CC BY 4.0 |
| bielany_lod1_2024.geojson | Wycinek obszaru gry (od kroku 3.3: bbox 52.262,20.900 do 52.311,20.995, w EPSG:2180 629485,490141 do 636110,495764): 9025 budynków; WGS84; height_m, ground_z, source_year | jw. |
| podglad_budynkow.png | Podgląd wycinka, kolor = wysokość | jw. |
| extract_bielany_lod1.py | Skrypt wycinający bbox z paczki zip (bez pyproj) | kod projektu |
| bielany_trees_2023.json | Drzewa w bboxie obszaru gry (od kroku 3.3 jak wyżej; w kroku 1.7 było 27 341 koron) z modeli 3D drzew LoD1 2023 (lotnicze skanowanie laserowe, drzewa od 4 m): lon, lat, wysokość, podstawa korony, promień korony | GUGiK, geoportal.gov.pl, CC BY 4.0 |
| extract_bielany_trees.py | Skrypt wycinający drzewa strumieniowo z paczki Warszawy (8,6 GB, bez zapisu paczki na dysk; bez pyproj) | kod projektu |
| bielany_nmt_4m.bin, bielany_nmt_4m.json | Teren (krok 3.1): numeryczny model terenu na siatce 4 m w układzie świata, obszar Fazy 3 (52.262,20.900 do 52.311,20.995), 1623 x 1365 punktów; uint16, cm ponad `base` (74 m); wysokości 75,2-111,8 m, stacja Stare Bielany 101,4 m | GUGiK, geoportal.gov.pl (NMT, usługa WCS GRID1), dane otwarte |
| podglad_terenu.png | Podgląd terenu (8 m na piksel): kolor = wysokość, cieniowanie z północnego zachodu, urwiska z OSM na czerwono, obecna mapa w białej ramce | jw. i © OpenStreetMap (ODbL) |

Teren: `node tools/terrain-bielany.mjs` (pobiera 15 kafli po 2 km z WCS GUGiK do data/raw/nmt/, ok. 1 min; `--offline` z pamięci podręcznej).

Statystyki wycinka: wysokość min 2,2 m, mediana 8,8 m, max 49,2 m.
Rozkład: 0-6 m: 543, 6-12 m: 1070, 12-20 m: 433, 20-35 m: 186, powyżej 35 m: 64.

Link do paczki: https://opendata.geoportal.gov.pl/InneDane/Budynki3D/LOD1/2024/14/1465.zip
Drzewa: https://opendata.geoportal.gov.pl/InneDane/Drzewa3D/LOD1/2023/14/1465.zip (12 z 484 arkuszy w bboxie; każde drzewo to dwa obiekty: pień i korona, skrypt bierze korony).
Atrybucja w aplikacji: "Budynki: GUGiK, geoportal.gov.pl (CC BY 4.0)".

