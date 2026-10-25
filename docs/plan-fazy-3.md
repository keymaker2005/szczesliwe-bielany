# Plan Fazy 3: Służby i teren

Bramka: cała dzielnica grywalna (kryteria na końcu). Gałąź faza-3 (z faza-2).
Zaakceptowany 2026-10-25 ze wszystkimi czterema propozycjami decyzji.

## Co mamy na wejściu
- Świat płaski (y = 0), wysokość gruntu liczy `getGroundHeight` w js/controllers.js (moduł przenośny).
- W LoD1 grunt pod budynkami ma od 80,7 do 111,0 m n.p.m. Płaskowyż leży wyżej, a dolina Wisły i Młociny
  przy rzece są ok. 20 m niżej.
- Skarpa według OSM (urwiska): przy Lesie Bielańskim i Kaskadzie (52.272–52.278, 20.963–20.972) oraz w Lesie
  Młocińskim (52.295–52.306, 20.945–20.962).
- Wisła i nabrzeże leżą w większości poza obecną mapą (wschodnia krawędź 20.980). Most Marii Skłodowskiej-Curie
  (Północny) jest na 52.305–52.310, czyli na północ od mapy (północna krawędź 52.300).
- Służby: wzorzec gotowy w js/medic.js, js/ambulance.js, js/taxi.js i js/missions.js (wezwania, adresy OSM, ocena,
  zakładka w telefonie).

## Kroki
- 3.1 Dane terenu. Numeryczny model terenu GUGiK (NMT, siatka 1 m, usługa WCS lub arkusze z opendata) dla
  całego obszaru, uproszczony do siatki ok. 4 m i zapisany jako mały plik wysokości (ok. 2–5 MB). Do tego skrypt
  w tools/ oraz podgląd PNG z cieniowaniem i nałożonymi urwiskami z OSM. W grze nic się nie zmienia.
  Sprawdzam: na podglądzie widać skarpę, dolinę Wisły i Las Bielański tam, gdzie są.
- 3.2 Skarpa i Las Bielański w świecie. Teren z siatki wysokości tylko w strefie skarpy i doliny. Płaskowyż
  zostaje płaski (różnice kilku metrów są niewidoczne, a płaskość chroni ruch, pieszych i tramwaje). Drogi
  zjeżdżające ze skarpy dostają spadek, budynki stoją na swoim gruncie z LoD1. Las Bielański dostaje
  ścieżki, gęstsze poszycie i drzewa GUGiK na prawdziwym zboczu, a Kameduły stają na wzgórzu.
  Sprawdzam: zejście i zjazd ze skarpy, widok z krawędzi na dolinę, Kameduły na wzgórzu, 60 fps.
  Wykonanie (3.2a, 2026-10-25): próg płaskowyżu 96 m n.p.m. (y = 0); dolina to obszar poniżej progu połączony z Wisłą,
  dołki na płaskowyżu (wykopy, fosa Fortu Bema) zostają płaskie. W obecnej mapie w dół schodzi ok. 4,1 km² (18%).
  Krok podzielony: 3.2b to wygląd Lasu Bielańskiego (dno lasu, ścieżki, poszycie).
- 3.3 Wisła, nabrzeże i most (zakres zależy od decyzji 1). Woda z refleksami (materiał z portu Nowego Jorku
  wraca do użycia), plaże i bulwar, Wisłostrada, a przy Młocinach Most Marii Skłodowskiej-Curie z dojazdem.
  Sprawdzam: dojazd Wisłostradą na most, spacer nabrzeżem, woda wygląda jak rzeka, a nie jak lustro.
- 3.4 Wspólna dyspozytornia służb. Jedna zakładka „Służby” w telefonie zamiast osobnych ról, wspólne wezwania,
  sygnał i ustępowanie aut (przeniesione z ratownika), okno wyboru „pouczenie / mandat / inne” do kolejnych ról.
  Ratownik działa dalej jak dziś.
  Sprawdzam: ratownik bez zmian, nowa zakładka pokazuje dostępne służby.
- 3.5 Strażnik Miejski (pieszo, rowerem albo autem). Zgłoszenia: auto na trawniku, śmieci w lesie lub przy
  bloku, hałas z balkonu albo z auta. Na miejscu wybór: pouczenie lub mandat, a ocena zależy od trafności
  (na przykład pouczenie przy pierwszym razie).
  Sprawdzam: 3 zgłoszenia, każdy rodzaj raz, wybór zmienia ocenę i SMS-y.
- 3.6 Strażak (wóz z drabiną). Pożar (dym i płomienie na budynku z LoD1, gaszenie strumieniem wody), zalana
  piwnica (pompa, odliczanie), kot na drzewie (drabina przy prawdziwym drzewie GUGiK).
  Sprawdzam: każde z trzech zdarzeń da się ukończyć, wóz mieści się w uliczkach osiedli.
- 3.7 Policjant (radiowóz). Kontrola drogowa: radar, zatrzymanie auta, pouczenie lub mandat. Pościg bez broni
  i bez taranowania: uciekające auto zatrzymuje się, gdy jedziesz tuż za nim albo odetniesz mu drogę.
  Zderzenia obniżają ocenę.
  Sprawdzam: 2 kontrole i 1 pościg, w tym pościg kończy się bez uderzania w auto.
- 3.8 Deploy i bramka. Wszystkie role na bielany.zbigniew.ai, test wydajności z nowymi trasami (skarpa,
  nabrzeże, most) dopisanymi do docs/test-1.8b.md.

## Decyzje do akceptacji
1. Granice mapy. Proponuję poszerzenie na wschód do 20.995 (Wisła z lewym brzegiem) i na północ do 52.311
   (most Północny z dojazdem). Mapa urośnie o ok. 20%, a dane (ulice, budynki, drzewa) trzeba wyciąć od nowa,
   drzewa ok. 40 minut w tle. Druga możliwość: bez poszerzania, wtedy 3.3 to tylko Wisłostrada i widok na
   rzekę z daleka.
2. Zgoda na zmianę modułów przenośnych:
   - controllers.js: `getGroundHeight` czyta wysokość z siatki terenu (jedna funkcja, reszta bez zmian);
   - pedestrians.js: piesi w lesie i na zboczu chodzą po terenie;
   - cameras.js: kamera nie wchodzi w zbocze.
   Bez tej zgody teren byłby tylko tłem, po którym nie da się chodzić.
3. Oznaczenia służb. Proponuję napisy słowne zwykłą czcionką („STRAŻ MIEJSKA”, „STRAŻ”, „POLICJA”), kolory zbliżone
   do prawdziwych, bez herbów, orłów, gwiazd, odznak i numerów jednostek. Tak samo jak „Ratownictwo medyczne”
   na karetce.
4. Kolejność. Proponuję najpierw teren (3.1–3.3), bo służby jeżdżą po gotowym gruncie. Druga możliwość: najpierw
   służby (3.4–3.7) na płaskim, teren na końcu.

## Ryzyka
- Teren to największa zmiana od początku projektu. Płaskowyż zostaje płaski, a każdy krok terenu kończy się
  pełnymi testami i pomiarem fps, zanim ruszy następny.
- Ruch aut i tramwajów zakłada płaską drogę. Na spadkach skarpy auta AI mogą „pływać”, wtedy dostaną prosty spadek
  na odcinkach dróg zamiast pełnej fizyki.
- Wydajność: woda, ogień i dym to nowe efekty. Każdy dostaje próg jakości w ustawieniach, a cel 60 fps zostaje.
- NMT: jeśli usługa GUGiK nie odpowie, siatkę zbuduję z punktów ground_z budynków LoD1 i urwisk z OSM (gorzej,
  ale wystarczy na skarpę).
- Pościg: bez broni, bez przemocy, bez przejeżdżania pieszych na sygnale (piesi uciekają z drogi).

## Kryteria bramki Fazy 3
- Wszystkie role (kurier, taksówkarz, ratownik, strażnik, strażak, policjant) dostępne z telefonu, wezwania
  rozłożone po wszystkich osiedlach w obszarze.
- Skarpa, Las Bielański i nabrzeże: da się tam dojść i dojechać, a Kameduły stoją na wzgórzu.
- 60 fps na M4 w panelu, test na Windows według docs/test-1.8b.md.
- Pełna pętla wszystkich ról na bielany.zbigniew.ai.

## Poza zakresem
Noc i pogoda, kolizja z tramwajem i dzwonek, czaty LLM (Faza 4), tabliczki ulic i porządki w kodzie z
Nowego Jorku (zostają w backlogu).
