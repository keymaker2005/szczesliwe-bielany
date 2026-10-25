# Zmiany w Szczęśliwych Bielanach

Historia wersji publicznej pod adresem https://bielany.zbigniew.ai, od najnowszej. Gra jest w przeglądarce (WebGPU),
na podstawie mrdoob/slop-newyork. Dane: © współtwórcy OpenStreetMap (ODbL); GUGiK, geoportal.gov.pl.

## 0.4 — Faza 3: Służby i teren (2026-10-25, wersja b9bfcb1)

**Teren**
- Prawdziwa rzeźba terenu z numerycznego modelu terenu GUGiK: skarpa wiślana i dolina Wisły do ok. 21 m poniżej
  Starych Bielan. Płaskowyż z miastem zostaje płaski.
- Wszystko stoi na gruncie: ulice, trawniki, chodniki, budynki, drzewa, sygnalizatory, auta, tramwaje, piesi i gracz.
  Auta pochylają się na zboczach, a Kameduły stoją na wzgórzu nad doliną.
- Główne drogi w dolinie mają wygładzoną, równą jezdnię.

**Większa mapa, Wisła i mosty**
- Mapa sięga teraz na wschód do Wisły i na północ do Mostu Marii Skłodowskiej-Curie. Doszły ok. 3 tys. budynków,
  nowe ulice i stacja Plac Wilsona.
- Wisła, stawy (m.in. Kellera, Brustmana, Młocińskie) i plaże, w tym Plaża Miejska przy Moście Północnym.
- Mosty i wiadukty z OpenStreetMap (także trasa S8) z jezdnią, chodnikami, barierkami i filarami. Tramwaj jeździ po
  Moście Północnym po własnym torowisku.
- Wisłostrada ma ruch. Na krawędzi mapy auta zawracają poza zasięgiem wzroku.
- Na wiaduktach ani pod nimi nie ma już zderzeń z autami jadącymi na innym poziomie.
- Nowy teleport: „Most Północny”.

**Lasy i zwierzęta**
- Las Bielański, Las Młociński, Park Młociński i mniejsze lasy z OSM: leśna ściółka z mchem, wydeptane ścieżki
  i krzewy podszytu.
- Zwierzęta: dziki (locha z warchlakami i samotne odyńce, czasem na skraju osiedli), sarny i wiewiórki. Uciekają
  przed graczem.

**Służby** (telefon P → „Służby”, syrena: K)
- Wspólna dyspozytornia: zakładka „Służby”, SMS-y dyżurnych, sygnał świetlny i dźwiękowy, przed którym auta
  zjeżdżają na bok.
- Straż Miejska: auto na trawniku, śmieci, hałas. Na miejscu wybierasz pouczenie, mandat albo lawetę.
- Straż pożarna: pożar (gaszenie działkiem), zalana piwnica (pompa) i kot na drzewie (drabina). Na miejscu
  przytrzymaj G.
- Policja: kontrola prędkości z radarem i pościg bez broni i bez taranowania.
- Ratownik medyczny działa teraz przez tę samą dyspozytornię.
- Pojazdy służb mają tylko napisy słowne, bez herbów i insygniów.

**Miasto**
- Stadion Hutnika przy Marymonckiej jako nowy landmark, z teleportem „Hutnik”.
- Tabliczki ulic w stylu warszawskim: niebieskie, z białym napisem i czerwonym paskiem „Bielany”.
- Aplikacja Przewodnik w telefonie: lista landmarków z odhaczaniem odwiedzonych i przyciskiem „Nawiguj”.
- Na zielonym pasie Marymonckiej widać tory i torowisko.
- Dźwięk pojazdów, pieszych i helikoptera działa także w dolinie.

## 0.3 — Faza 2: Osiedla, taksówkarz, ratownik (2026-10-25, krok 2.7)

- Większy obszar: Słodowiec, Piaski, Marymont-Kaskada, cała Chomiczówka, Las Bielański z Kamedułami. Nowe teleporty:
  Słodowiec, Marymont, Piaski, Kaskada, Kameduły.
- Drzewa GUGiK dla całego obszaru i lepsza wydajność (dalekie drzewa bez cieni, krótsze zasięgi szczegółów).
- Tramwaje na torach z OSM: 3 linie w obie strony, postoje na przystankach. Auta ustępują tramwajom.
- Taksówkarz (Taxi Bielany): pasażer macha na chodniku, kursy pod prawdziwe adresy. Ocena za komfort jazdy
  (hamowania, stłuczki, czerwone światła) i napiwek. Limity prędkości z OSM i znak przy prędkościomierzu.
- Ratownik medyczny: wezwania pod adresy, karetka na sygnale, przewóz na SOR Szpitala Bielańskiego, gwiazdki za
  dojazd i transport.
- Aparat (F albo w telefonie): swobodna kamera, 5 filtrów, zdjęcia z podpisem miejsca w Pocztówkach, zapis do pliku
  i udostępnianie na X. Spadające liście.
- Piesi są „materialni”: zderzenie przewraca ich jak szmacianą lalkę. W ruchu jest mniej aut, autobusów i pieszych,
  żeby gra działała płynniej.

## 0.2 — Faza 1.5: Smartfon i kurier (2026-10-25, krok 1.5.8)

- Smartfon (P): Zlecenia, Mapa, SMS i Pocztówki.
- Adresy z OSM jako punkty dostawy i wyszukiwarka adresów na mapie.
- Trasa GPS po prawdziwych ulicach (z jednokierunkowymi dla auta), przeliczana na bieżąco.
- Kurier (Pocztylion Bielański): odbiór paczek przy stacjach M1, oferty 0,5–2 km, gwiazdki, premia za skrót.
- Landmarki według zdjęć: Galeria Młociny, pawilony stacji M1 z oficjalnym znakiem „M”, AWF z wieżą i rotundą,
  UKSW, Szpital Bielański, kościoły św. Zygmunta i św. Marii Magdaleny, Kameduły.
- Przewodnik: SMS-y przy 11 miejscach, z „Czytaj więcej” i źródłami.
- Nowe wersje strony nie mieszają się już ze starymi plikami w pamięci przeglądarki.

## 0.1 — Faza 1: Bielany wzdłuż M1 (2026-10-25, kroki 1.9a i 1.9b)

- Pierwsza publiczna wersja, od kroku 1.9b pod adresem bielany.zbigniew.ai.
- Pas Stare Bielany – Wawrzyszew – Młociny: ulice z OpenStreetMap, budynki z modeli 3D GUGiK (LoD1 2024) i nowsze
  budynki z OSM.
- Kwartały z krawężnikami i chodnikami, bloki według zdjęć Bielan (trzy rodzaje fasad, balkony, kolory osiedli).
- Ruch aut na prawdziwym grafie ulic, z sygnalizacją z OSM, przejściami i malowaniem jezdni.
- Słoneczny dzień złotej polskiej jesieni („Złota jesień”), drzewa z modeli GUGiK w jesiennych kolorach, liście na
  ziemi.
- Minimapa z polskimi nazwami ulic, teleporty, km/h. Atrybucja danych w stopce.
- Chodzenie, auto, rower i helikopter z oryginału.
