# Plan Fazy 5: Gra dla wielu osób

Bramka: dwie osoby na różnych komputerach jeżdżą razem po Bielanach płynnie, w 60 fps, a gra działa dalej, gdy
serwer graczy jest wyłączony (kryteria na końcu). Gałąź faza-5 (z main po 1.0.1). Publikacja jako 1.1.
Do akceptacji (krok 5.0).

## Co mamy na wejściu
- Gracz ma cztery tryby (controllers.js, moduł przenośny): pieszo, auto, rower, helikopter. Pozycja, kierunek i tryb
  są w `controllerManager.getActiveEntity()`; nie trzeba zmieniać controllers.js, tylko je odczytywać.
- Modele postaci, aut, roweru i helikoptera już są (actor-models.js, traffic.js, pedestrians.js). Inni gracze
  dostaną te same modele w innych kolorach.
- Cloudflare: strona na Pages, Worker czatu `bielany-czat` z Durable Object (liczniki) i Turnstile, wrangler 3.114.15.
- Klakson jest dźwiękiem (audio-events.js), teraz tylko u siebie.
- Cennik Cloudflare Durable Objects (strona z 18.10.2026):
  - plan darmowy: 100 000 zapytań dziennie, 13 000 GB-s czasu pracy dziennie; po przekroczeniu operacje się nie udają
    (bez rachunku), licznik zeruje się o 2:00 w nocy czasu polskiego (północ UTC);
  - plan płatny (ok. 5 USD/mies.): 1 mln zapytań miesięcznie w cenie, potem 0,15 USD za milion;
  - wiadomości od graczy liczą się w proporcji 20:1 (100 wiadomości = 5 zapytań), wiadomości wysyłane do graczy
    są darmowe; tryb uśpienia (hibernation) nie nalicza czasu, gdy nikt nic nie wysyła.

## Jak to działa (w skrócie)
- Gra łączy się z serwerem graczy (nowy Worker `bielany-gracze`, adres bielany.zbigniew.ai/api/gracze) przez
  WebSocket, czyli stałe połączenie w obie strony. Serwer to jeden „pokój” na dzielnicę (Durable Object).
- Kilka razy na sekundę gra wysyła: gdzie jestem, w którą stronę jadę, jakim trybem. Serwer rozsyła to pozostałym,
  a gra płynnie przesuwa ich postacie i auta (wygładzanie z opóźnieniem ok. 0,2 s).
- Bez kont: każdy dostaje losowe imię (np. „Rudy Dzik 27”) i kolor. Nic nie zapisujemy: pozycje żyją tylko
  w pamięci pokoju, a po wyjściu gracza znikają.
- Bez wolnego czatu z obcymi. Na start: widzimy się nawzajem, klakson słyszą inni, gotowe gesty i zwroty
  („Cześć!”, „Dzięki!”, „Jedziemy?”) jako dymek nad głową.
- Gdy serwer nie odpowiada, jest wyłączony albo skończył się dzienny limit: gra działa jak dziś, sama.

## Kroki
- 5.0 Plan Fazy 5 (ten dokument). Sprawdzam: akceptuję plan i odpowiadam na decyzje.
- 5.1 Serwer graczy (Worker i pokój). Worker `bielany-gracze` z Durable Object „pokój”, umowa z grą w
  docs/api-gracze.md (wiadomości: wejście, stan, gest, wyjście). Bezpieczniki:
  - tylko połączenia ze strony gry, Turnstile przy wejściu (ten sam widżet co czat), najwyżej 2 połączenia z adresu;
  - limit graczy w pokoju (decyzja 2), limit wiadomości na gracza (np. 12 na sekundę, nadmiar odrzucany),
    sprawdzanie danych (pozycja w granicach mapy, rozsądna prędkość, tryb z listy);
  - dzienny licznik zapytań poniżej limitu planu; po jego przekroczeniu pokój odpowiada „wróć jutro” i gra działa
    sama; wyłącznik GRACZE_OFF jak CHAT_OFF, bez wdrożenia.
  Testy: protokół, limity, odrzucenie obcego adresu, złe dane. Skrypt tools/boty.mjs wpuszcza do pokoju N botów
  jeżdżących po ulicach (lokalnie przez `wrangler dev`).
  Sprawdzam: w terminalu 2 boty widzą się nawzajem; 13. wiadomość w sekundzie zostaje odrzucona.
- 5.2 Inni gracze w grze. Moduł js/multiplayer.js: łączenie, wysyłanie stanu (decyzja 3), odbiór, wygładzanie ruchu,
  modele czterech trybów w kolorze gracza, imię nad głową (widoczne do ok. 150 m), najwyżej 20 rysowanych graczy
  (najbliżsi), proste wersje modeli w oddali. Inni gracze są „duchami”: można przez nich przejechać (decyzja 5).
  Gracze widoczni też na mapie i minimapie (city-map.js, kropki w kolorze gracza).
  Sprawdzam: dwie karty Edge na localhost widzą się nawzajem w każdym trybie, ruch jest płynny; 20 botów i 60 fps.
- 5.3 Telefon: aplikacja „Gracze” i tryb solo. Lista graczy w pokoju (imię, tryb, odległość, „Nawiguj” do gracza),
  moje imię i kolor (losuj ponownie, bez wpisywania własnego), przełącznik „Graj z innymi” (decyzja 4), ?solo w adresie
  wyłącza grę z innymi. Brak serwera, limit albo wyłącznik: krótka informacja, gra działa dalej.
  Sprawdzam: lista się zgadza, „Nawiguj” prowadzi do gracza, po wyłączeniu serwera gra działa bez błędów w konsoli.
- 5.4 Klakson, gesty i gotowe zwroty. Klakson słyszą gracze w pobliżu (dźwięk z kierunku auta), 6 gestów
  i zwrotów pod klawiszem G (koło wyboru) i w telefonie, dymek nad głową przez 4 s, limit 1 na 2 s.
  Sprawdzam: w dwóch kartach klakson i dymki widać i słychać tylko w pobliżu.
- 5.5 Taksówka z prawdziwym pasażerem. Pieszy gracz wzywa taksówkę w telefonie (cel z mapy), kierowcy taksówek
  w pobliżu dostają zlecenie obok zwykłych, kierowca podjeżdża, pasażer wsiada (kamera jedzie z autem), na miejscu
  obaj dostają punkty. Gdy nikt nie przyjmie w 60 s, przyjeżdża taksówka komputerowa jak dziś (taxi.js, passenger.js).
  Sprawdzam: w dwóch kartach pełny kurs od wezwania do wysiadki; rezygnacja w trakcie nikogo nie blokuje.
- 5.6 Wspólne zlecenia służb (decyzja 6). Pożar albo wypadek z dyspozytorni (dispatch.js) widoczny dla wszystkich
  w pokoju; kto pierwszy dojedzie, gasi albo ratuje, pozostali widzą efekt (zgaszony ogień, odjeżdżająca karetka).
  Sprawdzam: w dwóch kartach ten sam pożar, gaszą obaj, punkty dla obu.
- 5.7 Publikacja 1.1. Wdrożenie Workera `bielany-gracze` i strony (tylko na Twoje polecenie), wpis w CHANGELOG.md,
  informacja przy pierwszym wejściu: „Grasz z innymi: widzą Twoją postać i losowe imię, nic nie zapisujemy”.
  Test obciążenia na żywo: 20 botów przez 10 minut, sprawdzenie liczników Cloudflare.
  Sprawdzam: na bielany.zbigniew.ai widzę boty i mogę je wyłączyć; liczniki zgodne z szacunkiem.
- 5.8 Test 1.1 i bramka. Test na Windows według docs/test-1.8b.md z drugą osobą (albo drugim komputerem): wspólna
  jazda, taksówka z prawdziwym pasażerem, gesty, 60 fps; potem ?solo i wyłączony serwer.

## Decyzje do akceptacji
1. Serwer. Proponuję osobny Worker `bielany-gracze` na adresie bielany.zbigniew.ai/api/gracze (osobny wyłącznik
   i osobne liczniki; awaria gry z innymi nie rusza czatu). Druga możliwość: dopisać pokój do Workera czatu.
2. Pokoje. Proponuję jeden pokój na całą dzielnicę, do 30 graczy; 31. osoba trafia do pokoju 2 itd. Druga możliwość:
   pokoje według miejsca (np. osobno Młociny, Wawrzyszew), co komplikuje przejazdy przez granice.
3. Częstotliwość i koszty. Proponuję 5 wiadomości na sekundę w ruchu i 1 na sekundę w bezruchu (bot bez ruchu
   nic nie kosztuje dzięki uśpieniu). Szacunek: 1 gracz przez godzinę to ok. 900 zapytań, czyli plan darmowy
   wystarcza na ok. 100 graczogodzin dziennie (np. 10 osób po 10 godzin albo 50 osób po 2 godziny), a czas pracy
   na ok. 29 godzin zajętego pokoju dziennie (jeden pokój cały dzień, drugi tylko w szczycie). Proponuję zostać
   na planie darmowym z dziennym licznikiem; plan płatny (ok. 5 USD/mies., starcza na ok. 1000 graczogodzin
   miesięcznie ponad darmowy przydział) dopiero gdy limit będzie się kończył, i tylko po Twojej decyzji.
4. Domyślnie z innymi czy sam. Proponuję: na publicznej stronie gra z innymi włączona od razu (z informacją przy
   pierwszym wejściu i przełącznikiem w telefonie), w wersji dla urzędu (?urzad) i z ?solo wyłączona.
   Druga możliwość: domyślnie sam, gra z innymi po włączeniu w telefonie.
5. Zderzenia. Proponuję w Fazie 5 bez zderzeń między graczami (przejeżdżamy przez siebie jak przez duchy, model
   lekko przezroczysty przy przenikaniu): bez sporów o to, kto kogo staranował, i bez zmian w controllers.js.
   Druga możliwość: proste odbicie aut graczy (wymaga zmian w controllers.js, czyli Twojej zgody na moduł przenośny).
6. Zakres interakcji. Proponuję kolejność 5.4 (klakson, gesty) → 5.5 (taksówka) → 5.6 (wspólne służby), a 5.6 jako
   opcjonalny: jeśli 5.5 zajmie dużo czasu, 5.6 przechodzi do backlogu, a 1.1 wychodzi bez niego.
7. Imiona. Proponuję losowe dwuczłonowe imiona z bielańskim akcentem (przymiotnik + zwierzę albo miejsce z gry:
   „Rudy Dzik 27”, „Szybka Wiewiórka 4”), bez wpisywania własnych (nie trzeba moderować), z przyciskiem „losuj
   ponownie”. Imię i kolor pamięta tylko przeglądarka gracza.

## Praca równoległa (wg docs/praca-rownolegla.md)
| Zadanie | Gałąź | Model | Kiedy |
| --- | --- | --- | --- |
| 5.1 Serwer graczy, protokół, boty | faza-5 | Opus (koordynator: bezpieczeństwo, koszty) | po akceptacji |
| 5.2 Inni gracze w grze | faza-5 | Opus (wydajność, wygładzanie ruchu) | po 5.1 |
| 5.3 Aplikacja „Gracze” w telefonie | faza-5-telefon | Sonnet (wzorzec z phone.js i chat.js) | razem z 5.2 (na botach) |
| 5.4 Klakson, gesty, zwroty | faza-5-gesty | Sonnet | po 5.2 |
| 5.5, 5.6 Taksówka i wspólne służby | faza-5 | Opus (koordynator) | po 5.4 |
| 5.7, 5.8 Publikacja i bramka | faza-5 | Opus (koordynator) | na końcu |
Scalanie do faza-5 tylko po Twoim „OK”.

## Ryzyka
- Moderacja: bez wolnego czatu, bez własnych imion, tylko gotowe zwroty; nie ma czego moderować. Wersja dla urzędu
  bez gry z innymi.
- Koszty: plan darmowy nie wystawia rachunku, po limicie gra przechodzi w tryb solo do 2:00 w nocy. Licznik
  w pokoju zatrzymuje ruch trochę wcześniej, żeby czat (ten sam plan Cloudflare) nie stracił swoich zapytań.
- Prywatność: bez kont, bez zapisu pozycji, adresy IP tylko w licznikach połączeń z krótkim czasem życia;
  inni widzą wyłącznie postać, losowe imię i miejsce w grze. Informacja przy pierwszym wejściu.
- Oszukiwanie (teleport, nierealna prędkość): serwer odrzuca stany spoza mapy i zbyt szybkie skoki; teleport z menu
  wysyła osobną wiadomość. Bez rankingów i nagród za punkty, więc oszustwo niewiele daje.
- Wydajność: najwyżej 20 rysowanych graczy, proste modele w oddali, imiona jako jedna warstwa; pomiar fps z 20 botami
  przed publikacją, test na Windows w 5.8.
- Opóźnienia sieci: wygładzanie z buforem ok. 0,2 s, przewidywanie ruchu przy krótkich przerwach, gracz bez
  wiadomości przez 10 s znika.
- Pusty pokój: przy małej liczbie graczy gra z innymi to często jazda w pojedynkę. Lista graczy w telefonie
  pokazuje, czy ktoś jest; boty nie wchodzą do publicznego pokoju (tylko testy i pokój testowy).

## Kryteria bramki Fazy 5
- Dwie osoby na różnych komputerach widzą się nawzajem na bielany.zbigniew.ai w każdym trybie, ruch płynny.
- Klakson i gesty działają w pobliżu; taksówka z prawdziwym pasażerem przechodzi pełny kurs (5.6 tylko jeśli
  nie przeszedł do backlogu, decyzja 6).
- Gra działa sama, gdy serwer graczy jest wyłączony, gdy limit się skończył i z ?solo; czat bez zmian.
- Bez kont i zapisu danych graczy; wersja dla urzędu bez gry z innymi.
- 60 fps z 20 graczami w pobliżu (test na Windows według docs/test-1.8b.md, „Test 1.1”); koszty w planie darmowym.

## Poza zakresem
Konta i rankingi, wolny czat tekstowy i głosowy, własne imiona, zderzenia między graczami (decyzja 5), wyścigi
i tryby rywalizacji, prywatne pokoje dla znajomych, gra na telefonie przez sieć komórkową z oszczędzaniem danych,
noc i pogoda.
