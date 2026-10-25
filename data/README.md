# Dane

| Plik | Co to jest | Źródło i licencja |
| --- | --- | --- |
| raw/LoD1_2024_Warszawa_1465.zip | Modele 3D budynków LoD1 2024, cała Warszawa (CityGML, EPSG:2180, 127 arkuszy, 153 109 budynków) | GUGiK, geoportal.gov.pl, CC BY 4.0 |
| bielany_lod1_2024.geojson | Wycinek MVP: 2296 budynków w bbox 52.274,20.915 do 52.300,20.960; WGS84; height_m, ground_z, source_year | jw. |
| podglad_budynkow.png | Podgląd wycinka, kolor = wysokość | jw. |
| extract_bielany_lod1.py | Skrypt wycinający bbox z paczki zip (wymaga pyproj) | kod projektu |
| bielany_trees_2023.json | Drzewa w bboxie: 27 341 koron z modeli 3D drzew LoD1 2023 (lotnicze skanowanie laserowe, drzewa od 4 m): lon, lat, wysokość, podstawa korony, promień korony | GUGiK, geoportal.gov.pl, CC BY 4.0 |
| extract_bielany_trees.py | Skrypt wycinający drzewa strumieniowo z paczki Warszawy (8,6 GB, bez zapisu paczki na dysk; bez pyproj) | kod projektu |

Statystyki wycinka: wysokość min 2,2 m, mediana 8,8 m, max 49,2 m.
Rozkład: 0-6 m: 543, 6-12 m: 1070, 12-20 m: 433, 20-35 m: 186, powyżej 35 m: 64.

Link do paczki: https://opendata.geoportal.gov.pl/InneDane/Budynki3D/LOD1/2024/14/1465.zip
Drzewa: https://opendata.geoportal.gov.pl/InneDane/Drzewa3D/LOD1/2023/14/1465.zip (12 z 484 arkuszy w bboxie; każde drzewo to dwa obiekty: pień i korona, skrypt bierze korony).
Atrybucja w aplikacji: "Budynki: GUGiK, geoportal.gov.pl (CC BY 4.0)".


## Aneks LoD1 dla landmarków (bielany_lod1_annex.geojson)
47 budynków GUGiK LoD1 2024 tuż za wschodnią granicą obszaru (lon > 20.960): wschodnie skrzydła AWF, kampus UKSW przy Dewajtis i eremy Kamedułów. Skrypt: data/extract_bielany_lod1_annex.py (z pełnej paczki w data/raw/). Licencja CC BY 4.0, GUGiK.
