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

## Pomysły luźne
(tu dopisuj nowe pomysły w trakcie pracy)
- Faza 1.5: tabliczki z nazwami ulic w stylu warszawskim (niebiesko-białe) zamiast nowojorskich zielonych (main.js renderLocation, css/style.css .street-sign).
- Porządki: w tsl-materials.js zostały nieużywane materiały Nowego Jorku (reklamy Times Square, korona Chryslera, schody TKTS, odbicia wody portu); do usunięcia.
- Porządki: wewnętrzne nazwy plików i komentarzy z Nowego Jorku (nyc-map.js, NYCMapSystem, „Manhattan” w komentarzach controllers.js i helikoptera); niewidoczne dla gracza.
- Błąd w konsoli przy starcie (lokalnie, przy powtórnym wczytaniu tej samej strony): „GPUValidationError: Binding size for [Buffer] is zero” (storage buffer w shaderze fragmentów, ok. 200 razy w trakcie rozgrzewki, potem cisza). Widoczne od co najmniej 1.5.2 na localhost:8080; na świeżym originie (localhost:8081, bielany.zbigniew.ai) brak. Podejrzenie: wyścig między szybką kompilacją z pamięci podręcznej a pierwszą klatką (ClusteredLighting lub instancje z zerową liczbą). Sprawdzić przed testem 1.8b.
- Landmarki (1.5.6): do potwierdzenia ze zdjęciami wysokości wież Kamedułów i dzwonnicy św. Zygmunta, funkcja rotundy AWF, napis nad wejściem do Szpitala Bielańskiego (otwarte kwestie w docs/landmarki-referencje.md). Las Bielański i Kameduły leżą na wschodnim skraju obszaru (poza wycinkiem LoD1 i drzewami): uzupełnić w Fazie 3 razem ze skarpą.
- Znak metra: w grze uproszczone białe „M” na granatowym kwadracie zamiast oficjalnego znaku Metra Warszawskiego; do decyzji, czy użyć oryginału (zgoda operatora).
- SMS-y burmistrza (docs/teksty-przewodnika.md, wersja robocza): działają tylko na localhost, na publicznej stronie po akceptacji burmistrza lub urzędu (wtedy usunąć --public w tools/build-dist.mjs).
- Raz podczas testu ponowne wczytanie bielany.zbigniew.ai zatrzymało się na ekranie ładowania („Failed to resolve module specifier three/webgpu”) po moich ręcznych wstrzyknięciach skryptów; kolejne wczytania działały. Obserwować przy teście 1.8b.
- Tramwaje: linia Marymoncką według danych OSM kończy się przy Cmentarzu Włoskim (tory nie łączą się z pętlą Młociny w obszarze); gracz przenika przez tramwaj (tramwaj hamuje przed graczem, ale nie ma kolizji); brak dźwięku dzwonka i rozjazdów na ekranie.
- Wersja dla urzędu: wyłączyć kontakt z pieszymi i ragdolla (PEDESTRIAN_CONTACT = false w js/city-config.js), decyzja z 2026-10-26.
