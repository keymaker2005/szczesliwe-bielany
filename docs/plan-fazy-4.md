# Plan Fazy 4: Czaty LLM i patronat

Bramka: wersja 1.0 z patronatem (kryteria na końcu). Gałąź faza-4 (z faza-3).
Zaakceptowany 2026-10-25 ze wszystkimi propozycjami decyzji (decyzja 5: SMS-y od „Burmistrz Bielan”, bez nazwiska).

## Co mamy na wejściu
- Telefon (js/phone.js): aplikacje Zlecenia, Mapa, Służby, Przewodnik, SMS, Pocztówki, Aparat. SMS-y to lista
  wiadomości z kartą „Czytaj więcej”; nie ma pola do pisania.
- Przewodnik (js/guide.js): 12 landmarków (SITES, NAMES), SMS przy pierwszym podejściu, aplikacja Przewodnik z listą
  i „Nawiguj”. Teksty w js/guide-texts.js (generowane z docs/teksty-przewodnika.md przez tools/guide-texts.mjs),
  razem ok. 20 KB z adresami źródeł. To wystarcza jako cała baza wiedzy przewodnika w jednym zapytaniu (bez wyszukiwarki).
- Burmistrz: SMS-y w tonie z publicznych wypowiedzi, z dopiskiem „wiadomość w grze, nie oficjalne stanowisko urzędu”,
  opublikowane decyzją z 2026-10-26. Od 2026-10-25 (wersja b55f491) nadawca to „Burmistrz Bielan”, bez imienia
  i nazwiska, do czasu pisemnej zgody. Zgody burmistrza ani urzędu na razie nie ma.
- Cloudflare: strona na Pages (bielany.zbigniew.ai), wrangler 3.114.15 podpięty do konta. Workera jeszcze nie ma.
- Wersja dla urzędu: przełącznik PEDESTRIAN_CONTACT w js/city-config.js (dziś true). Pakiet dla urzędu
  (docs/pakiet-urzad.md) odłożony.
- Modele Claude (cennik Anthropic, stan z 2026-10-06; przed 4.1 sprawdzę ponownie), za 1 mln tokenów wejście / wyjście:
  - Claude Haiku 5.5 (`claude-haiku-5-5`): 0,10 / 0,50 USD (do 100 tys. tokenów wejścia),
  - Claude Sonnet 5.5 (`claude-sonnet-5-5`): 2 / 10 USD, odczyt z pamięci podręcznej 0,20 USD,
  - Claude Opus 5.5 (`claude-opus-5-5`): 4 / 20 USD, odczyt z pamięci podręcznej 0,20 USD.

## Jak to działa (w skrócie)
- W telefonie nowa aplikacja „Czat” z dwiema rozmowami: Przewodnik i Burmistrz Bielan (ta druga dopiero po zgodzie;
  imię i nazwisko tylko wtedy, gdy zgoda je obejmuje).
- Gra wysyła pytanie do Workera na Cloudflare (np. bielany.zbigniew.ai/api/czat). Worker trzyma klucz API, dokleja
  instrukcje i bazę wiedzy, pyta model Claude i odsyła odpowiedź. Klucz nigdy nie trafia do przeglądarki.
- Bez kont graczy i bez zapisu rozmów: historia rozmowy żyje tylko w otwartej karcie gry (znika po odświeżeniu),
  Worker niczego nie zapisuje poza licznikami (ile zapytań dziś, ile z jednego adresu w ostatniej minucie).
- Instrukcje i baza wiedzy są stałe, więc korzystają z pamięci podręcznej modelu (taniej i szybciej).

## Kroki
- 4.0 Plan Fazy 4 (ten dokument). Sprawdzam: akceptuję plan i odpowiadam na decyzje.
- 4.1 Worker i bezpieczniki (bez modelu). Cloudflare Worker pod bielany.zbigniew.ai/api/czat, klucz API jako sekret
  Cloudflare (wpisujesz go sam w panelu albo w terminalu, ja go nie widzę), ochrona:
  - tylko zapytania ze strony gry (sprawdzanie adresu źródłowego), Cloudflare Turnstile (niewidoczna weryfikacja,
    że to człowiek) przy pierwszym pytaniu w sesji;
  - limity: np. 20 pytań na 10 minut z jednego adresu, 300 znaków na pytanie, ostatnie 6 wymian w historii,
    krótkie odpowiedzi (do ok. 120 słów);
  - dzienny limit wszystkich zapytań i miesięczny budżet (decyzja 2); po przekroczeniu Worker odpowiada „czat
    odpoczywa, wróć jutro”, a do tego twardy limit wydatków ustawiony w konsoli Anthropic;
  - wyłącznik awaryjny: jedna zmienna w Cloudflare wyłącza czat bez nowego deployu.
  Na tym kroku Worker odpowiada stałym tekstem. Testy: limity, odrzucenie obcego adresu, brak klucza w odpowiedziach.
  Sprawdzam: w grze na localhost pytanie dostaje odpowiedź testową, 21. pytanie w 10 minut dostaje „zwolnij”.
- 4.2 Aplikacja „Czat” w telefonie i tryb bez czatu. Okno rozmowy w telefonie (pole tekstowe, dymki, „pisze…”),
  pisanie nie steruje postacią (telefon już pomija klawisze w polach tekstowych). Gdy Worker nie odpowiada, jest
  wyłączony albo limit się skończył: rozmowa pokazuje krótki komunikat i podpowiada aplikację Przewodnik
  (gotowe teksty działają jak dziś), gra działa dalej bez błędów w konsoli. Na localhost bez Workera ten sam tryb.
  Sprawdzam: rozmowa z odpowiedziami testowymi; po wyłączeniu Workera gra dalej działa, a czat mówi, że odpoczywa.
- 4.3 Baza wiedzy przewodnika. Plik docs/wiedza-przewodnika.md: teksty 12 landmarków z guide-texts.js plus krótkie
  hasła o osiedlach, ulicach, metrze, tramwajach i lasach (z tych samych źródeł co teksty: Wikipedia, strony
  instytucji; bez zmyślania), skrypt w tools/ składa z niego plik dla Workera. Instrukcje przewodnika: odpowiada
  tylko o Bielanach i grze, po polsku, krótko, podaje źródło, a gdy czegoś nie ma w bazie, mówi „nie wiem” i odsyła
  do aplikacji Przewodnik. Lista 30 pytań kontrolnych (docs/pytania-kontrolne-przewodnik.md): fakty z bazy, pytania
  spoza bazy, próby wyciągnięcia instrukcji, polityka, wulgaryzmy, prośby o dane osobowe.
  Sprawdzam: czytam bazę wiedzy (czy fakty się zgadzają) i listę pytań.
- 4.4 Czat z przewodnikiem na żywo (localhost). Worker pyta model z decyzji 1. Skrypt testowy przepuszcza 30 pytań
  kontrolnych i zapisuje odpowiedzi do docs/ do Twojego przeglądu (koszt testu kilka centów). W grze: przewodnik
  może zaproponować „Nawiguj” do landmarku, o który pytasz (przycisk pod odpowiedzią).
  Sprawdzam: 10 własnych pytań w grze; przegląd odpowiedzi na pytania kontrolne (każda „OK” albo uwaga).
- 4.5 Publikacja czatu z przewodnikiem. Deploy Workera i strony, oznaczenie „AI” w nagłówku rozmowy, krótka informacja
  przed pierwszym pytaniem (odpowiedzi tworzy model AI, mogą zawierać błędy, rozmowy nie są zapisywane), wpis
  w CHANGELOG.md. Przez pierwszy tydzień codzienny podgląd liczników i kosztów.
  Sprawdzam: czat działa na bielany.zbigniew.ai w Edge, koszty dnia w zakładanym limicie.
- 4.6 Zgoda burmistrza i materiały urzędu (Twoja część, ja przygotowuję dokumenty). Pismo do Urzędu Dzielnicy
  Bielany (docs/pismo-urzad-czat.md): opis gry i czatu, prośba o:
  - pisemną zgodę burmistrza na imię, nazwisko i wizerunek w grze i w czacie AI;
  - materiały do bazy wiedzy (lub akceptację listy materiałów, np. strony urzędu, budżet obywatelski, inwestycje);
  - wskazanie osoby do akceptacji pytań kontrolnych;
  - opinię o patronacie (osobna decyzja urzędu).
  Do pisma dołączam pakiet z docs/pakiet-urzad.md (zrzuty, link, licencje) i wersję dla urzędu (krok 4.9).
  Sprawdzam: czytam i wysyłam pismo sam (ja nic nie wysyłam w Twoim imieniu).
  Kroki 4.7–4.8 ruszają dopiero po pisemnej zgodzie. Bez zgody Faza 4 kończy się na przewodniku (patrz bramka).
- 4.7 Baza wiedzy i instrukcje burmistrza. Tylko materiały zatwierdzone przez urząd (docs/wiedza-burmistrza.md,
  każdy fragment z adresem i datą akceptacji). Instrukcje:
  - oznaczenie „AI” przy każdej odpowiedzi i stała stopka „Odpowiedź AI w grze, nie oficjalne stanowisko Urzędu
    Dzielnicy Bielany”;
  - bez polityki i wyborów (partie, kampanie, oceny innych polityków, głosowania, spory w radzie): grzeczna odmowa
    jednym zdaniem;
  - pytania spoza bazy i sprawy urzędowe (wnioski, skargi, terminy): odesłanie do urzędu z adresem strony i telefonem
    z materiałów;
  - bez obietnic, deklaracji i opinii w imieniu burmistrza, bez danych osobowych.
  Do tego drugi bezpiecznik w Workerze: krótkie sprawdzenie odpowiedzi przed wysłaniem (np. słowa o wyborach i
  partiach), a przy wątpliwości stała odpowiedź odsyłająca do urzędu.
  Lista pytań kontrolnych burmistrza (docs/pytania-kontrolne-burmistrz.md), ok. 50: z bazy, spoza bazy, polityka
  wprost i podchwytliwie, prowokacje, prośby o obietnice, próby obejścia instrukcji.
  Sprawdzam: czytam bazę i listę pytań, potem przekazuję je urzędowi.
- 4.8 Czat z burmistrzem: testy i akceptacja urzędu. Na localhost i na osobnym adresie testowym (np.
  test.bielany.zbigniew.ai, dostęp tylko dla Ciebie i urzędu) skrypt przepuszcza pytania kontrolne, wyniki w tabeli
  do akceptacji. Publikacja dopiero po pisemnym „OK” urzędu dla wyników. Do tego czasu rozmowa „Burmistrz” w telefonie
  jest ukryta (przełącznik w js/city-config.js).
  Sprawdzam: urząd akceptuje wyniki pytań kontrolnych na piśmie.
- 4.9 Wersja dla urzędu. Jeden przełącznik ?urzad (albo osobny build) ustawia: PEDESTRIAN_CONTACT = false (bez
  potrącania pieszych i ragdolla), ewentualnie bez pościgu policyjnego (decyzja 6), czat tylko z bazą zatwierdzoną przez
  urząd. Dopisany do pakietu i do pisma z 4.6.
  Sprawdzam: w wersji dla urzędu pieszych nie da się potrącić, reszta gry działa.
- 4.10 Logo dzielnicy i patronat. Dopiero po formalnej decyzji o patronacie: logo i napis „Patronat Burmistrza
  Dzielnicy Bielany” na ekranie startowym i w stopce, w formie wskazanej przez urząd. Bez decyzji krok pomijamy.
  Sprawdzam: wygląd i treść zgodne z decyzją urzędu.
- 4.11 Deploy 1.0 i bramka. Publikacja wersji 1.0 (z czatem burmistrza, jeśli jest zgoda i akceptacja), wpis
  w CHANGELOG.md, test na Windows według docs/test-1.8b.md z czatem otwartym w trakcie jazdy.
  Sprawdzam: pełna pętla na bielany.zbigniew.ai, czat działa, a po wyłączeniu Workera gra działa dalej.

## Decyzje do akceptacji
1. Dostawca i model. Proponuję Anthropic (Claude) przez Workera bez pośredników:
   - przewodnik: Claude Haiku 5.5 (`claude-haiku-5-5`), najtańszy, wystarczy do odpowiedzi z gotowej bazy;
   - burmistrz: Claude Sonnet 5.5 (`claude-sonnet-5-5`), staranniej trzyma się zasad (polityka, odsyłanie do urzędu);
   - Opus 5.5 nie jest potrzebny w czacie (2× droższy od Sonnet).
   Jeśli testy 30 pytań przewodnika pokażą słabe odpowiedzi Haiku, przełączę przewodnika na Sonnet (jedna zmienna).
2. Limit dzienny i budżet. Szacunek na jedno pytanie (instrukcje i baza ok. 10–15 tys. tokenów, odpowiedź ok. 300):
   Haiku ok. 0,002 USD, Sonnet ok. 0,006 USD z pamięcią podręczną. Proponuję:
   - limit 1000 pytań dziennie na cały czat (przewodnik ok. 2 USD, burmistrz ok. 6 USD dziennie przy pełnym limicie);
   - twardy limit w konsoli Anthropic 30 USD miesięcznie; po jego wyczerpaniu czat odpoczywa do końca miesiąca;
   - Workers na darmowym planie Cloudflare (limity planu sprawdzę w 4.1; plan płatny ok. 5 USD/mies. tylko gdy trzeba).
   Konto Anthropic z kluczem API i kartą zakładasz sam (ja nie wpisuję danych płatniczych ani kluczy).
3. Kolejność. Proponuję najpierw przewodnika (4.1–4.5, opublikowany niezależnie), równolegle pismo do urzędu (4.6),
   a burmistrza (4.7–4.8) dopiero po zgodzie. Druga możliwość: czekać z całym czatem na zgodę urzędu.
4. Kto zbiera zgody. Proponuję: Ty wysyłasz pismo i prowadzisz kontakt z urzędem (ja przygotowuję pismo, pakiet,
   listy pytań i tabelę wyników). Potrzebuję od Ciebie: adresata (wydział lub osoba), Twojego imienia, nazwiska
   i e-maila do podpisu (decyzje z docs/pakiet-urzad.md).
5. SMS-y burmistrza do czasu zgody. Podjęta 2026-10-25: nadawca „Burmistrz Bielan”, bez imienia i nazwiska,
   z dopiskiem „wiadomość w grze”; opublikowane (b55f491). Czat z burmistrzem dopiero po zgodzie, a imię i nazwisko
   wracają tylko, jeśli zgoda je obejmuje.
6. Zakres wersji dla urzędu. Proponuję: bez kontaktu z pieszymi (PEDESTRIAN_CONTACT = false), reszta gry bez zmian
   (służby, pościg bez taranowania, mandaty zostają). Druga możliwość: dodatkowo bez pościgu policyjnego.
7. Bez kont i bez zapisu rozmów. Proponuję tak jak w backlogu: nic nie zapisujemy, tylko liczniki. Konsekwencja: nie
   zobaczymy, o co gracze pytają. Druga możliwość: zapis anonimowych pytań (bez odpowiedzi i adresów) przez 7 dni
   do poprawiania bazy wiedzy, z informacją w czacie. Proponuję pierwszą.

8. Burmistrz bez zgody (decyzja autora z 2026-10-26, zmienia 4.6–4.8 i decyzję 3): czat z postacią „Burmistrz Bielan”
   powstaje bez pisma i bez zgody urzędu, bez imienia i nazwiska, bez patronatu i bez logo dzielnicy. Baza wiedzy
   z publicznych stron urzędu i miasta (docs/wiedza-burmistrza.md, każde hasło z adresem i datą), nie z materiałów
   zatwierdzonych przez urząd. Bez zmian zostają: oznaczenie „AI”, stała stopka „Odpowiedź AI w grze, nie oficjalne
   stanowisko Urzędu Dzielnicy Bielany”, bez polityki i wyborów, bez obietnic i opinii, sprawy urzędowe odsyłane do
   urzędu, drugi bezpiecznik w Workerze, ok. 50 pytań kontrolnych. Pytania kontrolne akceptuje autor (nie urząd).
   Model: Claude Sonnet 5.5. Pismo do urzędu (4.6) czeka; patronat (4.10) pominięty.

## Praca równoległa (wg docs/praca-rownolegla.md)
| Zadanie | Gałąź | Model | Kiedy |
| --- | --- | --- | --- |
| 4.1 Worker i bezpieczniki | faza-4 | Opus (koordynator: bezpieczeństwo, koszty) | po akceptacji |
| 4.2 Aplikacja „Czat” i tryb bez czatu | faza-4-czat-telefon | Sonnet (wzorzec z phone.js) | razem z 4.1 (na odpowiedziach testowych) |
| 4.3 Baza wiedzy przewodnika i pytania kontrolne | faza-4-wiedza | Sonnet (teksty ze źródeł) | od razu po akceptacji |
| 4.6 Pismo do urzędu i pakiet | faza-4-urzad | Sonnet (dokumenty) | od razu po akceptacji |
| 4.9 Wersja dla urzędu (przełącznik) | faza-4-urzad-wersja | Haiku (prosta zmiana konfiguracji) | od razu po akceptacji |
| 4.4, 4.5, 4.7, 4.8, 4.10, 4.11 | faza-4 | Opus (koordynator) | po scaleniu poprzednich |
Scalanie do faza-4 tylko po Twoim „OK”, kolejność: 4.1 → 4.2 → 4.3 → 4.4 → 4.5; 4.6 i 4.9 niezależnie.

## Ryzyka
- Koszty i nadużycia: ktoś może zasypywać czat pytaniami. Limity na adres, Turnstile, dzienny limit w Workerze
  i twardy limit w konsoli Anthropic; najgorszy przypadek to czat odpoczywający do jutra, nie rachunek.
- Wypowiedzi w imieniu prawdziwej osoby: największe ryzyko fazy. Burmistrz tylko po zgodzie, tylko z bazy urzędu,
  z oznaczeniem „AI”, z drugim bezpiecznikiem w Workerze i z akceptacją pytań kontrolnych przez urząd. Bez akceptacji
  nie publikujemy.
- Zmyślanie faktów przez przewodnika: odpowiedzi tylko z bazy, „nie wiem” poza bazą, źródło przy faktach, 30 pytań
  kontrolnych przed publikacją.
- Próby obejścia instrukcji („zapomnij zasady…”): instrukcje i baza po stronie Workera, pytania kontrolne z takimi
  próbami, krótkie odpowiedzi; model nie ma narzędzi ani dostępu do niczego poza tekstem.
- Prywatność: bez kont, bez zapisu rozmów, adresy IP tylko w licznikach z krótkim czasem życia. Informacja przed
  pierwszym pytaniem. Dane idą do Anthropic (dostawca modelu) wyłącznie w celu odpowiedzi.
- Wydajność gry: czat to zwykły HTML w telefonie i jedno zapytanie sieciowe; bez wpływu na fps (sprawdzam w 4.11).
- Zmiany cen i modeli: identyfikator modelu i ceny w jednym miejscu konfiguracji Workera; sprawdzam je przed 4.1 i 4.11.
- Brak odpowiedzi urzędu: Faza 4 kończy się wtedy jako 1.0 bez burmistrza i bez patronatu (patrz bramka).

## Kryteria bramki Fazy 4
- Czat z przewodnikiem działa na bielany.zbigniew.ai, przeszedł 30 pytań kontrolnych, mieści się w budżecie.
- Klucz API tylko w Cloudflare, limity i wyłącznik awaryjny działają, rozmowy nie są zapisywane.
- Gra działa bez czatu (Worker wyłączony, limit wyczerpany, localhost bez Workera).
- Wersja dla urzędu gotowa (PEDESTRIAN_CONTACT = false) i opisana w pakiecie.
- Czat z postacią „Burmistrz Bielan” według decyzji 8: bez imienia i nazwiska, baza z publicznych stron, stopka
  „Odpowiedź AI w grze…”, drugi bezpiecznik, 50 pytań kontrolnych zaakceptowanych przez autora. Logo dzielnicy tylko po
  decyzji o patronacie; bez niej bramka to „1.0 bez patronatu” (4.10 pominięty).
- 60 fps jak w Fazie 3, także z otwartym czatem w trakcie jazdy (test na Windows według docs/test-1.8b.md, „Test 1.0”).

## Poza zakresem
Gra dla wielu osób (Faza 5, backlog), konta graczy, czat głosowy, czat z pieszymi i służbami, tłumaczenia na inne
języki, noc i pogoda, porządki w kodzie z Nowego Jorku (backlog).
