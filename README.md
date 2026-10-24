# Szczęśliwe Bielany

Warszawskie Bielany wzdłuż linii M1 — Stare Bielany, Wawrzyszew, Młociny — w 3D w przeglądarce, w słoneczny dzień
złotej polskiej jesieni. Pieszo, autem, rowerem albo helikopterem. Zbudowane na [three.js](https://threejs.org/)
(WebGPURenderer, TSL).

## Oryginał

Projekt jest forkiem [Slop New York](https://github.com/mrdoob/slop-newyork) autorstwa Mr.doob
([wersja na żywo](https://mrdoob.github.io/slop-newyork/)), symulacji Nowego Jorku na licencji MIT. Silnik (sterowanie,
kamery, dźwięk, piesi, ruch drogowy, shadery) pochodzi z oryginału; miasto, dane i wygląd są przeniesione na Bielany.
Stan oryginału zachowuje tag `nyc-original`.

## Uruchomienie lokalnie

```bash
node tools/serve.mjs 8080
```

i w przeglądarce z WebGPU (Chrome, Edge) adres http://localhost:8080. Testy: `node --test tests/`.

Dane miasta (`js/bielany-geodata.js`) generuje `node tools/geo-bielany.mjs` z plików w `tools/data/` i `data/`
(zob. `data/README.md`).

## Licencja i dane

Kod jest dostępny na [licencji MIT](LICENSE).

Dane: © [współtwórcy OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL); GUGiK,
[geoportal.gov.pl](https://www.geoportal.gov.pl/) — modele 3D budynków LoD1 2024 i modele 3D drzew LoD1 2023
(CC BY 4.0). Dane i zależności zewnętrzne zachowują swoje licencje. Nazwy szyldów, linii autobusowych i malowania
pojazdów są fikcyjne.
