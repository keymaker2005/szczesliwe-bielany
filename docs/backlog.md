# Backlog (poza bieżącą fazą, nie realizować bez decyzji)

## Faza 1.5: Smartfon i kurier
Przeniesiona do docs/fazy.md (bieżąca faza).

## Faza 2: Osiedla, taksówkarz, ratownik
Przeniesiona do docs/fazy.md (bieżąca faza).

## Faza 3: Służby i teren
Przeniesiona do docs/fazy.md (bieżąca faza).

## Faza 4: Czaty LLM i patronat
Bramka: wersja 1.0 z patronatem.
- Czat z przewodnikiem i z burmistrzem przez Cloudflare Worker (klucz API po stronie serwera).
- Warunki czatu z burmistrzem:
  - pisemna zgoda na imię, nazwisko i wizerunek w grze i w czacie AI;
  - baza wiedzy wyłącznie z materiałów zatwierdzonych przez Urząd Dzielnicy Bielany;
  - oznaczenie "AI" i informacja, że odpowiedzi nie są oficjalnym stanowiskiem urzędu;
  - bez tematów politycznych i wyborczych, pytania spoza bazy odsyłane do urzędu;
  - lista pytań kontrolnych przetestowana przed publikacją;
  - logo dzielnicy po formalnej decyzji o patronacie.

## Faza 5: gra dla wielu osób
Przeniesiona do docs/fazy.md (bieżąca faza), plan: docs/plan-fazy-5.md.

## Pomysły luźne
(tu dopisuj nowe pomysły w trakcie pracy)
- [przeniesione 2026-10-26] Czat tekstowy z innymi graczami: krok 5.6b w docs/plan-fazy-5.md (decyzja 8).
- Gra z innymi (5.2): inni gracze lekko przezroczyści, gdy przez nich przejeżdżamy (decyzja 5 Fazy 5); teraz przenikanie bez przezroczystości. Imiona dalekich graczy mogą na siebie nachodzić (bliższe są na wierzchu).
- [zrobione 2026-10-26, gałąź porzadki] Nieużywane materiały Nowego Jorku usunięte z tsl-materials.js (3041 → ok. 720 linii) razem z dwoma testami martwego kodu.
- [zrobione 2026-10-26, gałąź porzadki] nyc-map.js → city-map.js (CityMapSystem), komentarze o Manhattanie poprawione. Zostały: controllers.js, audio-*, scene-culling.js (moduły przenośne, bez zmian bez zgody) i nazwy w city-config.js (CENTRAL_PARK_BOUNDS, ISLAND_BOUNDS), których używa controllers.js.
- [nie występuje, sprawdzone 2026-10-26] Błąd „GPUValidationError: Binding size for [Buffer] is zero” przy powtórnym wczytaniu localhost:8080: 4 wczytania w Chrome na M4 bez błędu (wyłapywanie błędów WebGPU sprawdzone celowym błędem), w teście 1.0 na Windows konsola bez czerwonych błędów. Przyczyny nie ustalono; prawdopodobnie zniknął przy wcześniejszych zmianach. Wraca → zapisać, przy jakim kroku.
- Landmarki (1.5.6): do potwierdzenia ze zdjęciami wysokości wież Kamedułów i dzwonnicy św. Zygmunta, funkcja rotundy AWF, napis nad wejściem do Szpitala Bielańskiego (otwarte kwestie w docs/landmarki-referencje.md). Las Bielański i Kameduły leżą na wschodnim skraju obszaru (poza wycinkiem LoD1 i drzewami): uzupełnić w Fazie 3 razem ze skarpą.
- Znak metra: w grze uproszczone białe „M” na granatowym kwadracie zamiast oficjalnego znaku Metra Warszawskiego; do decyzji, czy użyć oryginału (zgoda operatora).
- SMS-y burmistrza (docs/teksty-przewodnika.md, wersja robocza): działają tylko na localhost, na publicznej stronie po akceptacji burmistrza lub urzędu (wtedy usunąć --public w tools/build-dist.mjs).
- Raz podczas testu ponowne wczytanie bielany.zbigniew.ai zatrzymało się na ekranie ładowania („Failed to resolve module specifier three/webgpu”) po moich ręcznych wstrzyknięciach skryptów; kolejne wczytania działały. Obserwować przy teście 1.8b.
- Tramwaje: linia Marymoncką według danych OSM kończy się przy Cmentarzu Włoskim (tory nie łączą się z pętlą Młociny w obszarze); gracz przenika przez tramwaj (tramwaj hamuje przed graczem, ale nie ma kolizji); brak dźwięku dzwonka i rozjazdów na ekranie.
- Wersja dla urzędu: wyłączyć kontakt z pieszymi i ragdolla (PEDESTRIAN_CONTACT = false w js/city-config.js), decyzja z 2026-10-26.
- Teren (3.2a): trawniki w dolinie to ok. 0,9 mln trójkątów (długie trójkąty z podziału wielokątów kwartałów cięte siatką 8 m);
  jeśli test na Windows pokaże spadek fps, przebudować dachy kwartałów w dolinie na siatkę zamiast cięcia.
- Krok 3.3: kominy EC Żerań (200 m czerwono-biały i 90 m szary, OSM man_made=chimney) widoczne zza Wisły; dziś pominięte
  w budynkach z OSM (dostałyby fasadę z oknami). Do zrobienia jako landmark.
- Krok 3.3: na Moście Północnym i w węźle przy Żoliborzu ruch AI nadal słaby (osobne pętle w sieci ruchu mimo portali na
  krawędzi mapy); most stoi wyżej niż w rzeczywistości (ok. 23 m nad wodą: zachodni przyczółek na krawędzi skarpy).
- Wiadukty na płaskowyżu: płaskowyż jest spłaszczony do 0, więc nasypy pod najazdami zniknęły; pomosty nad innymi
  drogami wznoszą się do 12% od ulicy i ich profil faluje (np. nad Marymoncką przy Trasie Mostu Północnego).
- Wydajność (przed bramką Fazy 3): w Chrome na M4 pieszo przy Kamedułach 52-56 fps (wcześniej 60), także bez zwierząt;
  na Starych Bielanach 60. Sprawdzić, co kosztuje (wiadukty S8, większa mapa, las), razem z testem na Windows.
## Przewodnik jako lista landmarków w telefonie (prośba z 2026-10-25, przy Stadionie Hutnika)
- Nowa aplikacja „Przewodnik” w telefonie (js/phone.js): lista wszystkich landmarków (SITES z js/guide.js, wraz ze stadionem), odhaczanie odwiedzonych (stan „seen” z localStorage), „Nawiguj” wyznacza trasę GPS do landmarku (js/gps-route.js, jak przy zleceniach), „Czytaj więcej” otwiera tekst z guide-texts.js. Do zrobienia osobnym krokiem, nie w zadaniu Stadion Hutnika.
