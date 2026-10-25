# Plan Fazy 1.5: Smartfon i kurier

Bramka: pierwsza grywalna pętla. Gracz bierze zlecenie w smartfonie, jedzie rowerem lub autem pod prawdziwy adres
z OSM, dostaje ocenę, a po drodze przewodnik pisze SMS-y przy landmarkach. Gałąź faza-1.5 (z faza-1).

## Kroki
- 1.5.1 Adresy i punkty dostawy. 2132 adresy z OSM (tools/data/osm_bielany_addresses.json) trafiają do
  js/bielany-geodata.js jako punkt na chodniku przy budynku (ulica, numer, pozycja). Test: każdy punkt leży na
  chodniku i da się do niego dojechać grafem dróg.
  Sprawdzam: wyszukiwarka mapy znajduje adres (np. „Żeromskiego 29”) i pokazuje pinezkę.
- 1.5.2 Trasa GPS po grafie dróg. Żółta trasa na minimapie i mapie biegnie ulicami (dziś: odcinki „najpierw x, potem z”
  z Nowego Jorku). Sprawdzam: trasa od stacji do adresu idzie po ulicach i przelicza się po zjechaniu z niej.
- 1.5.3 Silnik zleceń js/missions.js: zlecenie = rola, start, cel, dozwolone pojazdy, warunek ukończenia (dojazd
  w promień ok. 8 m i postój), limit czasu, ocena 1–3 gwiazdki. Znacznik celu w świecie (słupek światła) i na mapie.
  Testy jednostkowe stanów (przyjęte, w drodze, dostarczone, spóźnione, przerwane).
  Sprawdzam: testowe zlecenie z konsoli da się ukończyć.
- 1.5.4 Smartfon: nakładka HTML (klawisz P i przycisk w rogu), ekran główny z aplikacjami Zlecenia, Mapa, SMS,
  Pocztówki (na razie pusta). Styl telefonu fikcyjny, bez logo producentów. Gra działa dalej pod nakładką.
  Sprawdzam: telefon się otwiera, zamyka i nie blokuje sterowania po zamknięciu.
- 1.5.5 Rola kuriera. Fikcyjna firma kurierska (nazwa do wyboru), 3 punkty odbioru (np. przy stacjach M1), losowe
  dostawy pod adresy w zasięgu 0,5–2 km. Rower i auto; czas docelowy z trasy GPS, gwiazdki za czas, bonus za skrót
  (szybciej niż trasa GPS, np. przez chodnik lub park rowerem). Licznik dostaw i zarobku w telefonie.
  Sprawdzam: 3 dostawy pod rząd rowerem i autem, ocena ma sens.
- 1.5.6 Przewodnik: SMS po wjeździe w promień ok. 50 m od landmarku, 2–3 zdania i karta „czytaj więcej”.
  Landmarki: klasztor Kamedułów, Las Bielański, AWF, UKSW, stacje M1, Szpital Bielański, Młociny. Teksty piszę
  ręcznie ze źródeł (z linkami) jako wersję roboczą do akceptacji urzędu; każdy SMS przychodzi raz.
  Sprawdzam: przejazd obok AWF i stacji daje SMS-y, teksty są poprawne.
- 1.5.7 Deploy podglądowy na bielany.zbigniew.ai i test pętli. Sprawdzam: bramka (pełna pętla na publicznym linku).

## Pliki
- Nowe: js/missions.js, js/phone.js (nakładka), js/guide.js (SMS-y przewodnika), docs/teksty-przewodnika.md,
  tests/missions.test.mjs, tests/addresses.test.mjs.
- Zmiany: tools/geo-bielany.mjs (adresy), js/road-network.js (trasa dla GPS), js/nyc-map.js (trasa, pinezka, adresy
  w wyszukiwarce), js/main.js (podpięcie), index.html, css/style.css.
- Bez zmian w modułach przenośnych (controllers, cameras, audio-*, pedestrians, scene-culling). Zlecenia tylko czytają
  pozycję i tryb gracza z controllerManager.

## Ryzyka i decyzje
- Burmistrz w SMS-ach: prawdziwa osoba. Proponuję odłożyć do pisemnej zgody (jak w Fazie 4); do tego czasu bez SMS-ów
  od burmistrza i bez nazwiska w grze.
- Klasztor Kamedułów nie wyszedł w obecnym wycinku miejsc z OSM; dopiszę zapytanie albo pozycję ze źródła.
- „Galeria Młociny” to prawdziwa marka: w grze tylko „Młociny” (pętla, stacja), bez nazw centrów handlowych.
- Adresy OSM mają luki (2132 adresy na ok. 2300 budynków); zlecenia losują tylko adresy z punktem przy chodniku.
- Wydajność: nakładka HTML i znaczniki są lekkie; drzewa z helikoptera zostają w backlogu.
- Poza zakresem: taksówkarz z pasażerem, karetka, Aparat (Faza 2), tabliczki ulic (osobny pomysł w backlogu).
