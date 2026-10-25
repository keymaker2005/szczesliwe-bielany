# Szczęśliwe Bielany

Fork mrdoob/slop-newyork (three.js, WebGPU, TSL, licencja MIT) przeniesiony na warszawskie Bielany.
Cel MVP: współczesne Bielany wzdłuż M1 (Stare Bielany, Wawrzyszew, Młociny), słoneczny dzień złotej polskiej jesieni.
Pełna dokumentacja: https://claude.ai/artifact/4wjHwfUPzV9NmL6BudsRnL

## Zasady pracy
- Pracuj tylko w zakresie bieżącej fazy z docs/fazy.md. Pomysły spoza zakresu dopisuj do docs/backlog.md i nie realizuj ich.
- Jeden krok z docs/fazy.md na raz. Po kroku: uruchom testy z tests/, uruchom lokalny serwer, podaj adres i napisz w punktach, co mam sprawdzić w przeglądarce.
- Nie zmieniaj modułów przenośnych (controllers, cameras, audio-*, pedestrians, scene-culling) bez pytania.
- three.js przypięty do jednej wersji w importmap (nie @dev).
- Atrybucja w stopce aplikacji: "Dane: © współtwórcy OpenStreetMap (ODbL); GUGiK, geoportal.gov.pl". Informacja o oryginale mrdooba zostaje w README i LICENSE.
- Commit po każdym zamkniętym kroku. Jedna gałąź na fazę, scalenie do main po przejściu bramki.
- Bez prawdziwych logotypów firm i oficjalnych insygniów służb. Fikcyjne nazwy szyldów zwykłych sklepów; oficjalne nazwy miejsc, instytucji i obiektów (np. Galeria Młociny) zostają prawdziwe. Projekt niekomercyjny.
- Nie jestem programistą: komendy terminala uruchamiasz sam, mnie prosisz tylko o decyzje i sprawdzenie efektu. Pisz po polsku, krótko, w punktach.

## Dane
- Ulice, tory, nazwy, adresy: OpenStreetMap przez Overpass (tools/overpass.sh).
- Budynki: modele 3D budynków GUGiK LoD1 2024 (licencja CC BY 4.0). Pełna paczka Warszawy (CityGML, EPSG:2180) w data/raw/LoD1_2024_Warszawa_1465.zip.
  Gotowy wycinek MVP: data/bielany_lod1_2024.geojson (2296 budynków, WGS84, pola height_m, ground_z), skrypt: data/extract_bielany_lod1.py.
  Dla Warszawy istnieje też LoD2 2017 z dachami (https://opendata.geoportal.gov.pl/InneDane/Budynki3D/LOD2/1465_gml.zip), ale jest starsze niż nowe osiedla.
- Drzewa: modele 3D drzew GUGiK dla Warszawy (LoD1 2023), od kroku 1.7.
- Granice MVP (bbox WGS84): 52.274,20.915,52.300,20.960. Potwierdzone w kroku 0.2.

## Układ świata
- 1 jednostka = 1 m. Punkt zerowy przy stacji metra Stare Bielany. Osie bez obrotu (północ = -Z).
- Teren płaski w Fazie 1. Skarpa wiślana dopiero w Fazie 3.
