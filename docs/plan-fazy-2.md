# Plan Fazy 2: Osiedla, taksówkarz, ratownik

Bramka: 60 fps na laptopie (preset „Złota jesień”). Gałąź faza-2 (z faza-1.5).

## Kroki
- 2.1 Większy obszar. Nowy bbox 52.262,20.900 – 52.300,20.980 (dziś 52.274,20.915 – 52.300,20.960): dochodzą
  Słodowiec, Piaski, Marymont-Kaskada, cała Chomiczówka, Las Bielański z Kamedułami i wschodnia część AWF. Ulice,
  tory, adresy, światła i nazwy z Overpass; budynki z lokalnej paczki LoD1 2024; drzewa GUGiK z ponownego
  przejścia przez paczkę 8,6 GB (ok. 40 min, w tle); aneks landmarków znika (wszystko w obszarze). Punkt zerowy
  zostaje przy stacji Stare Bielany. Obszar rośnie ok. 2,5 raza (z ok. 9 do ok. 23 km²).
  Sprawdzam: mapa pokazuje nowe osiedla, da się dojechać na Słodowiec, Piaski i Kaskadę.
- 2.2 Wydajność pod większy obszar: budynki i drzewa w kaflach z poziomami szczegółów i wyłączaniem dalekich, lżejsze
  cienie, licznik fps na stałe w ustawieniach testowych. Cel: 60 fps na M4 w panelu, test na Windows według
  docs/test-1.8b.md (rozszerzonego o nowe trasy).
  Sprawdzam: 60 fps na ziemi, płynny przelot helikopterem.
- 2.3 Tramwaje na torach z OSM (Marymoncka, Kasprowicza, pętla Młociny): wagony w barwach warszawskich (czerwień
  i żółć, bez logo przewoźnika), przystanki, światła, ruch aut ustępuje na skrzyżowaniach.
  Sprawdzam: tramwaj jedzie z Marymontu do pętli Młociny i staje na przystankach.
- 2.4 Taksówkarz: pasażerowie machają na chodnikach i przy postojach, kurs pod adres OSM, ocena za czas i płynność
  (gwałtowne hamowania, uderzenia, czerwone światła), napiwek; zlecenia w telefonie obok kuriera.
  Sprawdzam: 3 kursy, ocena reaguje na styl jazdy.
- 2.5 Ratownik medyczny: karetka (biało-żółta, ogólne oznaczenia, bez logo i insygniów służb), wezwania pod adresy,
  sygnał (światła i dźwięk), auta zjeżdżają na bok, transport do Szpitala Bielańskiego, ocena za czas.
  Sprawdzam: wezwanie, dojazd na sygnale, przewóz do szpitala.
- 2.6 Aparat: tryb foto (swobodna kamera, ukryty interfejs, filtry jesienne), zdjęcia w Pocztówkach w telefonie,
  zapis do pliku i „Udostępnij na X” (link z tekstem, bez logowania w grze). Animowane spadające liście.
  Sprawdzam: zdjęcie trafia do Pocztówek i da się je zapisać.
- 2.7 Deploy i bramka: 60 fps na laptopie, pełna pętla wszystkich ról na bielany.zbigniew.ai.

## Ryzyka i decyzje
- Większy obszar to więcej geometrii: krok 2.2 jest warunkiem bramki; jeśli 60 fps nie wyjdzie, zmniejszam gęstość
  drzew i zasięg cieni, zanim cokolwiek wytnę z mapy.
- Wschodnia krawędź (Kaskada, Las Bielański) to skarpa wiślana: w Fazie 2 dalej płasko, teren w Fazie 3.
- Karetka i służby: tylko ogólne oznaczenia (zasada z CLAUDE.md); napis „Ratownictwo medyczne” bez herbów i logo.
- Tramwaje: barwy jak w Warszawie, bez logo Tramwajów Warszawskich.
- Poza zakresem: Strażnik Miejski, strażak, policjant, teren (Faza 3); czaty LLM (Faza 4).
