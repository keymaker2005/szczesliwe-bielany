# Raport kroku 0.2: dane dla bbox Bielan

Bbox (WGS84): 52.274,20.915 do 52.3,20.96, czyli ok. 3,07 km (wsch.-zach.) na 2,89 km (płn.-płd.), 8,9 km².
Punkt zerowy: stacja metra Stare Bielany (52.28183, 20.94935).
Źródła: GUGiK LoD1 2024 (CC BY 4.0), OpenStreetMap przez Overpass, pobrane 2026-10-24 (ODbL).
Skrypt: `node tools/report-bielany.mjs`.

## Budynki

| | LoD1 (GUGiK) | OSM |
| --- | ---: | ---: |
| liczba budynków w bbox | 2296 | 2837 |
| w tym o powierzchni ≥ 100 m² | 1515 | 1528 |
| pokrywa się z drugim źródłem (punkt wewnątrz obrysu leży w budynku z drugiego źródła) | 2227 (97,0 %) | 2237 (78,9 %) |
| budynki ≥ 100 m² z LoD1 obecne w OSM | 1456 (96,1 %) | |
| budynki ≥ 100 m² z OSM, których brak w LoD1 | | 82 |

Rok pomiaru w LoD1 (pole source_year): 2023: 2296. Paczka to wydanie 2024, ale pomiar pochodzi z 2023 r.

### Wysokości LoD1

- min 2,2 m, mediana 8,8 m, 90. percentyl 22,4 m, max 49,2 m.
- Rozkład: 0-6 m: 543; 6-12 m: 1070; 12-20 m: 433; 20-35 m: 186; powyżej 35 m: 64.
- Kontrola z OSM (building:levels × 3 m): 2016 par, mediana różnicy 1,5 m, 90 % par mieści się w 3,9 m.
- Najwyższe: 49,2 m przy x=-2007, z=56; 49,2 m przy x=-1981, z=23; 49,2 m przy x=-1962, z=14; 49,1 m przy x=-2034, z=93; 48,9 m przy x=-1477, z=575.

## Ulice i tory (długość przycięta do bbox)

| Kategoria | Długość |
| --- | ---: |
| główne (trunk, primary, secondary) | 17,8 km |
| lokalne (tertiary, unclassified, residential) | 45,3 km |
| osiedlowe i dojazdy (service, living_street) | 90,7 km |
| piesze i rowerowe (footway, path, cycleway, pedestrian, steps) | 277,8 km |
| pozostałe (drogi gruntowe, w budowie, perony itd.) | 21,8 km |
| **razem** | **453,4 km** |

- Jezdnie dla aut (główne + lokalne): 63,1 km, z nazwą ulicy: 95,9 %.
- Liczba różnych nazw ulic i ścieżek: 118.
- Tory tramwajowe: 26,4 km (toru pojedynczego, czyli linie dwutorowe liczone podwójnie).
- Metro M1: 6,5 km w tunelu, 0,0 km na powierzchni.
- Kolej: 13,1 km (bocznice przemysłowe huty ArcelorMittal Warszawa, bez ruchu pasażerskiego).
- Stacje metra w bbox: Stare Bielany (x=0, z=-0), Wawrzyszew (x=-671, z=-503), Młociny (x=-1330, z=-995).
- Przystanki tramwajowe: 15 (Aleja Reymonta, Aspekt, AWF, Bogusławskiego, Cmentarz Wawrzyszewski, Cmentarz Włoski, Metro Młociny, Nocznickiego, Podleśna IMGW, Popiela, Przy Agorze, Szpital Bielański, Twardowska, UKSW, Zajezdnia Żoliborz).

## Nazwy

- Osiedla i części dzielnicy: Bielany, Bielany I, Bielany I – Skalbmierska, Bielany II, Bielany II – Serek, Bielany IV, Brzeziny, Chomiczówka, Huta, Kaliszówka, Las Bielański, Nowy Wawrzyszew, Plac Konfederacji, Skwer Anny Jantar, Skwer Maryny Falskiej, Skwer Polskich Olimpijczyków, Stare Bielany, Stary Wawrzyszew, Wawrzyszew, Wrzeciono, Zdobycz Robotnicza.
- Wybrane obiekty z nazwą (szkoły, uczelnie, szpitale, kościoły, parki): 54, np. Akademia Wychowania Fizycznego, Bielańskie Centrum Edukacji Kulturalnej, Branżowa Szkoła I Stopnia nr 18, Centrum Medyczne Kształcenia Podyplomowego, CXLI Liceum Ogólnokształcące Specjalne, Dom zakonny Sióstr Salezjanek, Eco Skwerek, I Liceum w Chmurze, Jordanek, Kaplica domowa, Kaplica Matki Bożej Fatimskiej, Kaplica pw. Błogosławionego Stefana Kardynała Wyszyńskiego, Kaplica pw. Matki Bożej Częstochowskiej, Kaplica rekolekcyjna, Kościół Matki Bożej Zawierzenia.

## Adresy

- Punkty adresowe w OSM: 2113, z nazwą ulicy lub placu: 100,0 %.
- Ulice występujące w adresach: 93.
- Budynki LoD1 z co najmniej jednym adresem: 1717 z 2296 (74,8 %).
- To samo dla budynków ≥ 100 m² (bez garaży i altan): 1173 z 1515 (77,4 %).
