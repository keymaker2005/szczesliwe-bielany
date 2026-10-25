# Landmarki Bielan: karta referencyjna do modelowania

Stan: 2026-10-25. Cel: proste bryły proceduralne (prostopadłościany, walce, dachy, okna, kolory, napisy).

Jak czytać dane:
- Pozycja = środek obrysu OSM (WGS84). Wymiary L×W = najmniejszy prostokąt opisany na obrysie OSM (`tools/data/osm_bielany_buildings.json`).
- Oś = azymut dłuższego boku od północy (0° = N, 90° = E), zakres 0–180°.
- `height_m` = GUGiK LoD1 2024 (`data/bielany_lod1_2024.geojson`). LoD1 to jedna wysokość na budynek, bez wież i dachów spadzistych.
- Wycinek MVP kończy się na lon 20.9602. Kościół Kamedułów, część UKSW i wschodnia część AWF leżą za tą granicą. Ich wysokości odczytałem z pełnej paczki `data/raw/LoD1_2024_Warszawa_1465.zip` (arkusze N-34-138-b-b-2-3 i 4-1), bez zmian w danych projektu.
- Kolory hex to przybliżenia odczytane ze zdjęć z Commons (światło dzienne). Do strojenia w grze, nie do druku.
- Szyldy sklepów i znaki firm zastąp fikcyjnymi nazwami (zasada z CLAUDE.md). Napisy z nazwami miejsc (np. „Galeria Młociny”, nazwy stacji) zostawiam dosłownie.

---

## 1. Galeria Młociny (ul. Zgrupowania AK „Kampinos” 15)
- Pozycja: 52.29481, 20.93038 (OSM way 1358700356, building=mall, 5 kondygnacji w OSM).
- Obrys: ok. 438 × 107 m, oś 37° (NE–SW, wzdłuż ul. Kasprowicza / torów metra). Powierzchnia obrysu ok. 40 400 m², kształt nieregularny, wygięty.
- Wysokość LoD1: 23,5 m. Wikipedia podaje 7 kondygnacji i 46 m (pewnie najwyższy punkt, np. narożna wieża). Otwarcie 23.05.2019. Projekt: Kuryłowicz & Associates + Chapman Taylor.
- Bryła: długi 3–4-kondygnacyjny korpus. Narożniki zaokrąglone, wyższe „bębny” z zaokrąglonymi górnymi kondygnacjami, które wysuwają się nad dolne.
- Dach: płaski. Na dachu ogród o powierzchni ok. 2 500 m² z krzewami i drzewami (zieleń #5f7f3a na tle szarej nawierzchni #9a9a96).
- Elewacja: pionowe pasy paneli metalowych w trzech tonach: jasny szary #c9c9c6, srebrny #a8a9a8, grafit #3d3f42. Między nimi ciemne pionowe okna. Parter to przeszklone witryny wysokie do ok. 8 m (#2b3036 z odbiciem nieba). Górne bębny mają ciemne szklane pasy (#25282c).
- Rozpoznawalne cechy:
  - biały, podświetlany napis „Galeria Młociny” na ciemnym pasie nad głównym wejściem (narożnik od strony ul. Kasprowicza / węzła Młociny);
  - przed wejściem duże, wolnostojące litery „Młociny” w kolorze rdzy lub cortenu (#8a3b22), rozstawione po placu, wysokie mniej więcej na wysokość człowieka;
  - zaokrąglone narożne bębny z poziomym pasem ciemnego szkła i nadwieszeniem;
  - duże ciemne panele z białymi logotypami najemców na narożnikach (w grze dać fikcyjne szyldy);
  - szerokie chodniki, latarnie, kostka w kolorze jasnoszarym #b5b3ad;
  - po drugiej stronie ulicy stoi węzeł Młociny (sekcja 2c).
- Źródła:
  - https://commons.wikimedia.org/wiki/File:2019_Warszawa_Galeria_M%C5%82ociny,_2.jpg (CC0, Cybularny, 2019)
  - https://pl.wikipedia.org/wiki/Galeria_M%C5%82ociny
  - https://www.chapmantaylor.com/news/galeria-młociny-retail-and-leisure-complex-in-warsaw-shortlisted-for-prime-property-architecture-prize

## 2. Metro M1: co widać nad ziemią
Wspólne dla trzech stacji: stacje płytkie, podziemne (otwarte 2008), na powierzchni tylko niskie pawilony wejściowe z płaskim dachem. Znak „M” to biała litera na czerwonym kole w żółtej obwódce, na słupku przy wejściu. To oficjalny znak Metra Warszawskiego, więc w grze lepiej użyć uproszczonego, ogólnego symbolu „M” (decyzja do podjęcia). Wnętrza peronów: Stare Bielany ma jasnoszare płyty i drewniane (miedziane) akcenty, Wawrzyszew ma betonowe słupy-kielichy, Młociny mają faliste sufity i kielichowe słupy. Wnętrza nie są potrzebne w MVP.

### 2a. Stare Bielany (A-21, punkt zerowy świata)
- Pawilony (OSM building=train_station, 1 kondygnacja, dach płaski):
  - pawilon SE: 52.28141, 20.95023, 21 × 21 m, oś 37°, LoD1 4,4 m;
  - pawilon NW: 52.28223, 20.94846, 21 × 19 m, oś 37°, LoD1 4,7 m.
  Oba leżą przy ul. Kasprowicza, po obu stronach skrzyżowania z ul. Żeromskiego (do potwierdzenia na mapie).
- Bryła: niski prostopadłościan około 4,5 m. Ściany prawie w całości przeszklone (szkło #4a5560 z odbiciem). Gruby jasnoszary gzyms lub attyka #d9d9d6, około 1 m. Wsporniki i słupki stalowe szare #8c8f92.
- Cechy: przeszklony pawilon stoi na tle 5-piętrowych socrealistycznych bloków z jasnym tynkiem (#e6e0d2). Przy wejściu słupek z „M”. Napis na peronie: „Stare Bielany”, biały na granatowym pasie (#1f3a8a).
- Źródło: https://commons.wikimedia.org/wiki/File:Warszawa,_Metro_-_Stare_Bielany,_ul.Kasprowicza_-_panoramio.jpg (CC BY-SA 3.0, tawa, 2010)

### 2b. Wawrzyszew (A-22)
- Pawilony (OSM building=transportation, dach płaski):
  - pawilon N: 52.28674, 20.93868, 54 × 23 m, oś 127°, LoD1 4,3 m;
  - pawilon S: 52.28596, 20.94040, 28 × 23 m, oś 127°, LoD1 4,2 m.
- Bryła: niski pawilon około 4,3 m. Dach to płaski stalowy ruszt lub pergola z poprzecznymi lamelami (szary #6e7276), który wystaje poza ściany jak daszek.
- Ściany: przeszklone, przed szkłem stalowe siatki-kratownice obrośnięte pnączami. Jesienią pnącza są czerwone (#a3271f, winobluszcz), latem zielone (#4f6b2e). To najbardziej charakterystyczny detal tej stacji.
- Cechy: wejście z ulicy, tuż obok nowe bloki z pomarańczowymi akcentami balkonów (#e07a2e) i grafitową cegłą (#4a4a4c). Napis na peronie: „Wawrzyszew”.
- Źródło: https://commons.wikimedia.org/wiki/File:Warszawa,_stacja_metra_Wawrzyszew_-_panoramio.jpg (CC BY-SA 3.0, tawa, 2010)

### 2c. Młociny (A-23) i węzeł przesiadkowy
- Pawilony stacji (building=train_station, h=5 m w OSM, dach płaski):
  - pawilon S: 52.29044, 20.93058, 40 × 20 m, oś 127°, LoD1 5,3 m;
  - pawilon N: 52.29112, 20.92915, 41 × 20 m, oś 126°, LoD1 5,3 m.
- Wygląd pawilonu: ściany z gabionów, czyli stalowych koszy z łamanym kamieniem (beż i szarość #a39883, siatka #8d8f90). Nad nimi gruby pas mlecznego, podświetlanego szkła (#e8ecef), na dachu ażurowa barierka ze stalowej siatki. Między gabionami cienkie stalowe słupy.
- Węzeł autobusowo-tramwajowy (poziom 0, nad nim parking P+R):
  - budynek węzła przy ul. Kasprowicza 145: 52.29142, 20.92835, 147 × 17 m, oś 37°, 3 kondygnacje, LoD1 11,25 m;
  - zadaszenie pętli (building=transportation, h 5,5 m, roof=many): 52.29179, 20.92971, 75 × 43 m, oś 37°, oraz drugie 50 × 13 m przy 52.29223, 20.92882;
  - zadaszenia peronów (building=roof, h 4,3 m): 68 × 35 m (52.29096, 20.92776) i 68 × 26 m (52.29125, 20.92796), szklane kładki 89 × 4 m i 83 × 7 m;
  - parking P+R „Metro Młociny”: 52.29044, 20.92779, 129 × 64 m, oś 127°, LoD1 10,1 m.
- Wygląd zadaszeń: płaski dach na stalowej kratownicy przestrzennej (jasnoszara stal #b8bcbf), od spodu jasny, z rzędami lamp. Okrągłe słupy stalowe w odcieniu rdzawoczerwonym lub brązowym (#7a3b2e, do weryfikacji) i jasnoszarym. Na peronach balustrady z siatki, tła z cegły (#9b5a43). Tramwaje w barwach warszawskich: czerwony #c8102e + żółty #f2c200.
- Źródła:
  - https://commons.wikimedia.org/wiki/File:MeroA23_7.jpg (CC BY-SA 3.0, Daniel Rumiancew, 2012): pawilon z gabionami
  - https://commons.wikimedia.org/wiki/File:Warszawa_dworzec_autubusowy_Metro_M%C5%82ociny_02.jpg (CC0, 2018): zadaszenie pętli autobusowej
  - https://commons.wikimedia.org/wiki/File:Warsazwa_-_W%C4%99ze%C5%82_przesiadkowy_M%C5%82ociny.jpg (CC BY-SA 2.0, IngolfBLN, 2011): pętla tramwajowa
  - https://pl.wikipedia.org/wiki/M%C5%82ociny_(stacja_metra)

## 3. AWF Warszawa: gmach główny (ul. Marymoncka 34)
- Pozycja: główny korpus 52.28557, 20.95838 (OSM way 1083833747, adres Marymoncka 34E, 3 kondygnacje). Wieża: 52.28522, 20.95893 (way 1083833748, 10 kondygnacji). Punkt adresowy Marymoncka 34: 52.28406, 20.95629 (brama od Marymonckiej).
- Obrys korpusu: ok. 268 × 67 m, oś 157° (NNW–SSE, równolegle do Marymonckiej). Obrys ma dziedzińce, powierzchnia ok. 10 500 m². LoD1 12,0 m. Wieża: 10 × 9 m, LoD1 26,6 m.
- Sąsiednie skrzydła na wschód, poza wycinkiem MVP (LoD1 z pełnej paczki): 83 × 52 m / 13,0 m (52.28563, 20.95944), 95 × 56 m / 11,0 m (52.28491, 20.96030), 44 × 35 m / 11,2 m (52.28351, 20.96027). Skrzydło Marymoncka 34D: 63 × 10 m, 11,3 m.
- Historia: projekt Edgar Norwerth, budowa 1928–1930 (zajęcia od 1929). Modernizm międzywojenny, zespół jest zabytkiem. Na dziedzińcu rośnie pomnikowa topola czarna, wokół której Norwerth zaplanował dziedziniec.
- Bryła: długie 3-kondygnacyjne skrzydła z płaskimi dachami tworzą dziedzińce. Nad nimi pionowa, smukła wieża (ok. 26 m) z małym nadbudowanym kioskiem i masztami na szczycie. Przy wieży niska rotunda, czyli hala na planie koła lub łuku (do weryfikacji, czy to aula, czy hala sportowa).
- Dach: płaski, ciemnoszara papa #4a4a4a, cienka attyka. Na wieży barierka tarasu.
- Elewacja: gładki tynk biały lub złamana biel #f1f0ea. Okna w ciemnych ramach (#3a3d40), na wieży po 2 okna na kondygnację, zebrane w pionowy pas z cienkimi gzymsikami.
- Rozpoznawalne cechy:
  - biała wieża (ok. 10 × 9 m, 26,6 m), z oknami parami na każdej kondygnacji;
  - rotunda otoczona rzędem pełnych białych walców, które wyglądają jak przypory lub silosy, z okrągłymi okienkami (bulajami) nad nimi;
  - w skrzydle obok wieży rząd okrągłych okien-bulajów w parterze;
  - płaskie białe bryły w stylu „okrętowym”, z barierkami na dachu;
  - na zdjęciu z 2015 r. wisi baner jubileuszowy „1929–2014”. Był tymczasowy, w grze opcjonalnie;
  - przed gmachem duży plac z jasną nawierzchnią (#c9c6bf) i wysokie latarnie;
  - na przedpolu pomnik marszałka Piłsudskiego, patrona uczelni. Nie zweryfikowałem, czy stoi i gdzie dokładnie.
- Źródła:
  - https://commons.wikimedia.org/wiki/File:Budynek_g%C5%82%C3%B3wny_AWF_Warszawa.JPG (CC BY-SA 4.0, Darpaw, 2015)
  - https://pl.wikipedia.org/wiki/Akademia_Wychowania_Fizycznego_J%C3%B3zefa_Pi%C5%82sudskiego_w_Warszawie
  - https://www.awf.edu.pl/uczelnia/o-nas/jubileusz-90-lecia/pliki/90-lat-AWF-2_2019.pdf

## 4. UKSW, Kampus Dewajtis (ul. Dewajtis 5)
- Pozycja i bryły (OSM relacje multipolygon, wymiary z pełnej paczki LoD1, bo wycinek MVP ich nie obejmuje):
  - Dewajtis 5 (relacja 14425202, 3 kondygnacje): bbox 52.29476–52.29546, 20.95949–20.96199. Elementy LoD1: 73 × 47 m / 14,7 m, 57 × 43 m / 11,7 m, 31 × 27 m / 11,0 m, oś bryły głównej ok. 115° (WNW–ESE);
  - Dewajtis 3 (relacja 14425203, 4 kondygnacje, historic=yes): bbox 52.29551–52.29694, 20.95814–20.96024, LoD1 155 × 80 m (obrys łączny) / 11,2 m, środek 52.29615, 20.95913. W wycinku MVP jest ten sam budynek: 52.29615, 20.95913, 11,24 m.
- Bryła głównego gmachu (widok z Dewajtis 5): symetryczny, 3-kondygnacyjny, kremowy budynek z ryzalitami na końcach. W osi środkowej ryzalit z wieżyczką lub sygnaturką na kalenicy. Dachy czterospadowe.
- Budynek przy kościele (dawne ATK, zdjęcie z 2007): prostokątny, 3 kondygnacje, dach dwuspadowy lub czterospadowy, kryty blachą w kolorze ciemnego grafitu (#4b4f55), z ceglanym kominem (#8a4a36). Wejście z dwoma łukowymi portalami i schodami z balustradą.
- Elewacje: tynk kremowy lub złamana biel (#ece6d6), cokół jasnoszary (#cfcac0), okna białe w głębokich wnękach.
- Nowsze skrzydło (zdjęcie z 2008): mansardowy dach z blachy w kolorze ciemnego brązu lub grafitu (#4a403a), z gęstym rzędem lukarn. Łącznik z ciemną okładziną i pasem okien (#5a4d44).
- Rozpoznawalne cechy:
  - kampus leży w Lesie Bielańskim, drzewa podchodzą pod budynki;
  - zza budynków widać zielone hełmy wież kościoła Kamedułów (sekcja 8);
  - w alei kampusu grota z figurą Matki Bożej z polnych kamieni (#8f8a80), przy murze;
  - dawne domki pustelnicze (eremy) z czerwoną dachówką (#a4472d) obok budynków uczelni;
  - słupki parkingowe w czerwono-białe pasy przy podjeździe (detal opcjonalny).
- Uwaga: przypisanie zdjęć do konkretnych numerów (3 i 5) nie jest pewne. Wieżyczka na kalenicy pochodzi z miniatury 300 px.
- Źródła:
  - https://commons.wikimedia.org/wiki/File:Dewajtis_5.jpg (CC BY-SA 4.0, Monika felicja, 2022)
  - https://commons.wikimedia.org/wiki/File:POL_Warsaw_ATK.jpg (CC BY 3.0, Hubert Śmietanka, 2007)
  - https://commons.wikimedia.org/wiki/File:Poland_Warsaw_UKSW_Dewajtis_nowy.jpg (domena publiczna, 2008)

## 5. Szpital Bielański (ul. Cegłowska 80)
- Teren: OSM way 288525189, bbox 52.28499–52.28815, 20.94782–20.95283. Wejście główne od strony SE (dziedziniec z parkingiem).
- Bryły (OSM building=hospital, LoD1):
  - korpus środkowy, 6 kondygnacji: 52.28659, 20.95099, 93 × 52 m, oś 60°, 24,7 m;
  - skrzydło 6 kondygnacji: 52.28736, 20.95041, 79 × 53 m, oś 60°, 23,8 m;
  - skrzydło 6 kondygnacji: 52.28688, 20.95040, 80 × 35 m, oś 150°, 20,0 m;
  - blok 6 kondygnacji: 52.28699, 20.95070, 28 × 23 m, 26,0 m (najwyższy punkt);
  - skrzydło 4 kondygnacje (Cegłowska 80): 52.28627, 20.95134, 92 × 37 m, oś 60°, 18,8 m;
  - niskie pawilony 2 kondygnacje: 56 × 24 m / 12,5 m (52.28695, 20.95165) i 56 × 50 m (52.28747, 20.95097).
- Historia: projekt Julian Sadłowski i Leopold Koehler, socrealizm, budowa od 1953, otwarcie XII 1960. Plan: skrzydło północne, skrzydło południowe i łącznik. W latach 80. dobudowano pawilon 3-kondygnacyjny, w 2022 r. nowe skrzydło (lokalizacja nowego skrzydła niezweryfikowana).
- Bryła: symetryczny zespół w kształcie litery E lub U otwarty na SE. Centralny 6-kondygnacyjny blok z wyższą środkową częścią i szerokim wejściem w osi. Dwa boczne 6-kondygnacyjne skrzydła wysunięte do przodu, przed nimi niższe 1–2-kondygnacyjne pawilony z płaskimi dachami, zamykające dziedziniec-parking.
- Dach: płaski, szary (#8e8f8c), z kominami wentylacyjnymi i maszynowniami. Na dachu środkowego bloku nadbudówka techniczna.
- Elewacja: gładki tynk jasnoszary lub kremowy (#dcd8cc), na nowszych częściach biały (#eeeeea). Regularne rzędy prostokątnych okien (#4a5058), w osi środkowej pionowe pasy okien klatki schodowej. Brak ozdób, typowy powojenny socrealizm „uproszczony”.
- Cechy: długa aleja dojazdowa w osi do wejścia, z pasem zieleni i parkingami po bokach. Z tyłu las (Las Bielański). Szyld szpitala nad wejściem: dokładny tekst niezweryfikowany, w grze np. „Szpital Bielański”.
- Źródła:
  - https://commons.wikimedia.org/wiki/File:Szpital_Bielanski_Warsaw_2023_aerial.jpg (CC BY-SA 4.0, Emptywords, 2023, widok z lotu ptaka od wschodu)
  - https://pl.wikipedia.org/wiki/Szpital_Bielański

## 6. Kościół św. Zygmunta (pl. Konfederacji 55)
- Pozycja: 52.27929, 20.94661 (OSM way 28411484). Obrys: 47 × 39 m, oś 112°. Powierzchnia OSM 1 476 m², obrys LoD1 2 304 m² (razem z przybudówkami). LoD1 12,75 m, co odpowiada korpusowi bez dachu-namiotu i bez dzwonnicy.
- Historia: projekt Zbigniew Pawelski, budowa 1976–1980, konsekracja 8.12.1980. Kościół dwupoziomowy, z kościołem dolnym i górnym. Plan oparty na sześciokącie foremnym (moduł trójkąta o boku 7,5 m). Zespół ma trzy części: kościół, dzwonnicę i plebanię.
- Bryła: niski, szeroki cokół (ok. 10–12 m), nad nim ogromny wielospadowy dach-namiot na planie sześciokąta. Połacie ostro załamane, brzegi wysunięte w ostre „dzioby”. Na szczycie gwiaździsta korona z promieni i krzyż.
- Dach: blacha w kolorze szarozielonym lub patyny (#6f7d74), ciemne krawędzie. Pod okapem pas okien (#3c4248). Szczyt dachu około 25–30 m (szacunek ze zdjęcia, niezweryfikowane).
- Dzwonnica: osobna, betonowa, smukły prostopadłościan z dwiema wąskimi pionowymi szczelinami. W górnej części otwarta ażurowa izba dzwonów z widocznymi dzwonami, na szczycie krzyż. Wysokość ok. 40 m (szacunek ze zdjęcia, niezweryfikowane). Kolor surowego betonu #a9a69d. Stoi po stronie wschodniej, przy plebanii (do weryfikacji).
- Elewacja cokołu: jasny beton lub tynk (#d8d4c8). Na ścianie frontowej płaskorzeźba z wizerunkiem Matki Bożej w medalionie. Wejście przeszklone, z drewnianymi drzwiami (#8a6a45). Przed kościołem wysoki drewniany krzyż.
- Cechy: sześcioboczny dach-namiot z „gwiazdą” na szczycie; wolnostojąca betonowa dzwonnica z dzwonami w prześwicie; płaskorzeźba nad wejściem; duży plac (pl. Konfederacji) z parkingiem przed kościołem.
- Źródła:
  - https://commons.wikimedia.org/wiki/File:Warszawa_Bielany,_ko%C5%9Bci%C3%B3%C5%82_pw._%C5%9Bw._Zygmunta.jpg (CC BY-SA 3.0, Wojciech Bieńkowski, 2013)
  - https://pl.wikipedia.org/wiki/Ko%C5%9Bci%C3%B3%C5%82_%C5%9Bw._Zygmunta_w_Warszawie

## 7. Stary kościół św. Marii Magdaleny (Wawrzyszew)
- Weryfikacja: to zabytkowy kościół filialny parafii św. Marii Magdaleny na Wawrzyszewie (dzielnica Bielany). Ufundował go Baltazar Smosarski, budowa 1543–1548 (infobox podaje 1543–1558). Nawę przedłużono w XVIII w., kruchtę dobudowano w 1830, zakrystię w 1870. W rejestrze zabytków od 1965 r. (nr 650). Obok stoi nowy kościół parafialny (OSM: „Kościół Matki Bożej Zawierzenia”, 52.28092, 20.92783, 38 × 37 m, LoD1 13,7 m). Ulica i numer starego kościoła są niezweryfikowane. OSM nie podaje adresu, a najbliższy adres to budynek przy ul. Wólczyńskiej 64. Kościół stoi przy Cmentarzu Wawrzyszewskim, w rejonie ulic Wólczyńskiej i Wawrzyszewskiej.
- Pozycja: 52.28074, 20.92907 (OSM way 237313759). Obrys: 26 × 12 m, oś 111° (fasada na zachód, prezbiterium na wschód). LoD1 9,0 m (do okapu lub średnio).
- Bryła: mała jednonawowa świątynia, ceglana, otynkowana. Od zachodu niższa kruchta z trójkątnym frontonem. Nad nią wyższy szczyt nawy, schodkowy lub z falistymi spływami, zwieńczony krzyżem. Z boku wieżyczka-sygnaturka na kalenicy.
- Dach: dwuspadowy, kryty czerwoną dachówką (#a8432a), stromy. Sygnaturka z ośmiobocznym, ciemnym blaszanym hełmem z latarnią (#4d4f50) i krzyżem.
- Elewacja: biały tynk (#f2f0ea). Przypory na ścianach nawy. Kruchta ma boniowanie (poziome pasy) na narożnikach i ścianie.
- Rozpoznawalne cechy:
  - na szczycie nawy duże cyfry „1542” i „2002” (rocznica), po obu stronach okna, czarne lub ciemnoszare na białym (zdjęcie 2007 i 2026);
  - nad nimi okrągłe okienko-oculus;
  - w szczycie kruchty półkoliste okno z drewnianymi szprosami (#7a4a2a);
  - drewniane, ciemnobrązowe drzwi w kasetony (#4a3426) w półkolistej wnęce;
  - przy wejściu kute latarnie na wysięgnikach po obu stronach;
  - przed wejściem kostka brukowa ułożona w półokrąg, rozetę lub wachlarz;
  - obok niskie zabudowania z czerwoną dachówką, mur cmentarny, stare drzewa.
- Źródła:
  - https://commons.wikimedia.org/wiki/File:POL_Warszyszew_Warsaw_old_church.JPG (CC BY 3.0, Hiuppo, 2007)
  - https://commons.wikimedia.org/wiki/File:Warszawa_Wawrzyszew_ko%C5%9Bci%C3%B3%C5%82_Marii_Magdaleny_(3).jpg (CC BY-SA 4.0, Olowirnik, 2026)
  - https://pl.wikipedia.org/wiki/Ko%C5%9Bci%C3%B3%C5%82_%C5%9Bw._Marii_Magdaleny_w_Warszawie

## 8. Kościół pokamedulski Niepokalanego Poczęcia NMP (Las Bielański, ul. Dewajtis 3)
- Pozycja: 52.29588, 20.96002 (OSM way 173130486), na granicy wycinka MVP. Obrys: 44 × 30 m, oś 118° (WNW–ESE). LoD1 (pełna paczka): 44 × 31 m, 18,2 m, co odpowiada korpusowi bez wież. Wieże mają ok. 35–40 m razem z hełmami (szacunek ze zdjęć, niezweryfikowane).
- Historia: późny barok, budowa 1669–1710 i 1733–1755. Fasada przypisywana Gaetano Chiaveriemu, projekt kościoła (wg Karpowicza) Isidoro Affaitatiemu. Ceglany, otynkowany. Plan: wydłużony ośmiobok przecięty transeptem z dwóch kaplic, prezbiterium zamknięte półkoliście. Zabytek (rejestr 1965). Obok 13 eremów, czyli domków pustelników z 2. poł. XVII w.
- Bryła: wysoki jednonawowy korpus. Fasada trójosiowa, środkowa oś lekko wysunięta, z parą pilastrów i kolumn kompozytowych, zwieńczona trójkątnym frontonem z wolutami. Dwie smukłe wieże stoją nie przy fasadzie, tylko z tyłu, po bokach prezbiterium (od wschodu). Z zachodu wyglądają, jakby wyrastały za korpusem.
- Dach: dwuspadowy, kryty blachą miedzianą z patyną (#6f9a86). Hełmy wież wielokondygnacyjne, cebulaste, z latarniami i krzyżami. Na zdjęciu z 2019 r. hełmy są w kolorze świeżej lub ciemnej miedzi (#8a5a3c), na starszych zdjęciach zielone (#7fa592), więc prawdopodobnie były odnawiane.
- Elewacja: biały lub kremowy tynk (#f0ede4), detal (pilastry, gzymsy) w tym samym kolorze. Okna półkoliście zamknięte, w ciemnych ramach. W bocznych niszach fasady drewniane polichromowane rzeźby św. Benedykta i św. Romualda.
- Wieże: kwadratowe, białe, w górnej kondygnacji okna dzwonnicze zamknięte półkoliście (ciemne, #4a4a4a), gzymsy, nad nimi hełm.
- Rozpoznawalne cechy:
  - dwie białe wieże z cebulastymi hełmami nad lasem, widoczne z daleka;
  - trójkątny fronton fasady na tle zielonego dachu;
  - przed kościołem drewniana, sześcioboczna lub ośmioboczna kapliczka lub brama z gontowym, wysokim dachem (#5b5548) z sygnaturką. To „brama do eremów”: https://commons.wikimedia.org/wiki/File:Gate_to_hermitages_-_Church_of_Camaldoleses_in_Warsaw.JPG;
  - obok niskie domki eremów z czerwoną dachówką (#a4472d) i białymi ścianami;
  - przed kościołem drewniany płot w kolorze naturalnego drewna (#c9925a), latarnie, stare kasztanowce i lipy, jesienią złote (#d4a42c);
  - kościół stoi na skarpie wiślanej (w Fazie 1 teren jest płaski).
- Źródła:
  - https://commons.wikimedia.org/wiki/File:Camaldolese_Church_in_Warsaw.jpg (CC BY-SA 4.0, LoMit, 2019, jesień)
  - https://commons.wikimedia.org/wiki/File:Warszawa,_ko%C5%9Bci%C3%B3%C5%82_pokamedulski_na_Bielanach.jpg (CC BY 3.0, Korwin3, wiosna)
  - https://en.wikipedia.org/wiki/Camaldolese_Church,_Warsaw
  - https://pl.wikipedia.org/wiki/Zesp%C3%B3%C5%82_klasztorny_kameduł%C3%B3w_na_Bielanach

## 9. Stadion Hutnika Warszawa (ul. Marymoncka 42)
- Pozycja z OSM (tools/data/osm_hutnik_stadium.json, zapytanie q_hutnik_stadium.overpassql): leisure=stadium way 1218325012, trybuny (building=grandstand) way 1239190581 i 1239190582; środek murawy ok. 52.2999 N, 20.9438 E (świat: -374,5; -2020,8), ok. 1,4 km na północny zachód od AWF wzdłuż Marymonckiej. Oś trybun ok. 60° od osi x, trybuny po obu stronach, 68 × 11,5 m, w LoD1 bloki 6 m (zastąpione modelem).
- Wygląd (opis w StadiumDB i Aktywnej Warszawie, odbudowa 2019–2021, otwarcie 25.08.2021): murawa naturalna z podgrzewaniem, dwie zadaszone trybuny (ok. 1330–1390 miejsc), zachodnia w pomarańczowym betonie z czarnym dachem, wschodnia w czarnym betonie z pomarańczowym dachem (barwy klubu), ławki rezerwowych przy trybunie zachodniej, cztery maszty oświetleniowe po bokach trybun, bez bieżni (nasypy rozebrane). Herbu klubu nie odwzorowujemy, napis „HUTNIK WARSZAWA” zwykłą czcionką.
- Źródła: https://stadiumdb.com/stadiums/pol/osrodek_hutnik_warszawa ; https://en.wikipedia.org/wiki/Hutnik_Warsaw ; https://pik.warszawa.pl/miejsca/osrodek-hutnik/ ; zdjęcia: kategoria Stadion Hutnika Warszawa na Wikimedia Commons (do porównania przez użytkownika, kolory dachów i trybun niezweryfikowane na zdjęciu).

---

## Otwarte kwestie (do weryfikacji)
- Wysokość dzwonnicy św. Zygmunta i szczytu dachu-namiotu (LoD1 jej nie rozróżnia).
- Wysokość wież kościoła Kamedułów i obecny kolor hełmów (miedź po renowacji czy patyna).
- Funkcja rotundy z walcami przy wieży AWF oraz to, czy przed gmachem stoi pomnik Piłsudskiego.
- Adres starego kościoła na Wawrzyszewie (ulica i numer).
- Dokładny tekst szyldu nad wejściem do Szpitala Bielańskiego i lokalizacja skrzydła z 2022 r.
- Wycinek LoD1 MVP (lon ≤ 20.9602) nie obejmuje Kamedułów, większości UKSW i wschodnich skrzydeł AWF. Zapisane wyżej wysokości pochodzą z pełnej paczki.

## Tabliczki z nazwami ulic (Miejski System Informacji)
- Wygląd: niebieskie pole (ok. #1d4fa0), biały krój bezszeryfowy; u góry małe „ulica/aleja/plac” po lewej i imię małą czcionką nad nazwiskiem; na dole czerwony pasek (ok. #d02a35) z nazwą dzielnicy; skośne rogi niewielkie. Bez herbu.
- Zdjęcia (Wikimedia Commons, CC BY-SA 4.0):
  - https://commons.wikimedia.org/wiki/File:Street_signs_Ciszewskiego_and_Cynamonowa,_Warsaw.jpg
  - https://commons.wikimedia.org/wiki/File:Modzelewskiego_and_Wilanowska_street_signs_in_Warsaw.jpg
  - kategoria: Street signs in Warsaw (City Information System)
