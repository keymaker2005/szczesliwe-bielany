# Test 1.1: gra z innymi (dwie osoby)

Cel: sprawdzić, czy dwie osoby na różnych komputerach grają razem w „Szczęśliwe Bielany” płynnie i bez błędów.
Ten test zamyka bramkę Fazy 5 (wersja 1.1). Trwa ok. 30 minut. Nie trzeba niczego instalować.

- **Osoba A**: Ty, na laptopie z Windows w Edge (jak w Teście 1.0, docs/test-1.8b.md: zasilacz, aktualny Edge,
  akceleracja sprzętowa).
- **Osoba B**: ktokolwiek, na drugim komputerze (Windows albo Mac, Edge albo Chrome). Może być w innym miejscu:
  wystarczy, że w tym samym czasie otworzy link. Najlepiej rozmawiajcie przez telefon w trakcie testu.

Link dla obu: **https://bielany.zbigniew.ai**

## Przygotowanie (3 min)

1. Obie osoby otwierają link na pełnym ekranie i czekają na załadowanie.
2. Przy pierwszym wejściu przychodzi SMS „Gra z innymi” (telefon: klawisz **P**). Każdy zapisuje swoje imię z SMS-a
   albo z telefonu → **Gracze** (np. „Rudy Dzik 27”).
3. Telefon → **Gracze**: u obu na górze ma być „Pokój 1 · oprócz Ciebie: 1 gracz”. Jeśli jest „na razie jesteś sam”,
   odśwież stronę (Ctrl+F5).
4. Obie osoby: teleport (przycisk z pinezką u góry) → **Stare Bielany**.

## Widzimy się (8 min)

| # | Co zrobić | Zapisz |
| --- | --- | --- |
| 1 | Obie osoby stoją pieszo (klawisz **1**) przy stacji. Spójrzcie na siebie | czy widać drugą postać i jej imię nad głową |
| 2 | B jedzie autem (**2**) wokół A przez minutę | czy auto B jest w kolorze B, jedzie płynnie, bez skoków |
| 3 | B jedzie rowerem (**3**), potem helikopterem (**4**) | czy widać rower i helikopter |
| 4 | Minimapa w lewym dolnym rogu i mapa (**M**) | czy jest kropka drugiej osoby (na mapie z imieniem) |
| 5 | A: telefon → Gracze → przy B „Nawiguj” | czy na minimapie jest trasa do B i czy idzie za B |
| 6 | B teleportuje się na Młociny | czy u A kropka B jest przy krawędzi minimapy |

## Razem (12 min)

| # | Co zrobić | Zapisz |
| --- | --- | --- |
| 7 | Obie osoby w autach obok siebie. B trąbi (**B**) | czy A słyszy klakson z kierunku auta B (dźwięk włączony, **N**) |
| 8 | A naciska **T** i wybiera **1** („Cześć!”) | czy B widzi dymek nad A; czy u A tryb się nie zmienił |
| 9 | Telefon → **Rozmowy**: A pisze „Cześć, jedziemy na Kameduły?”, B odpisuje | czy wiadomości dochodzą, czy są w dymkach |
| 10 | B pisze słowo „kurwa” | czy u obu jest zakryte („k****”) |
| 11 | **Taksówka:** A pieszo (**1**): telefon → Gracze → Taksówka z graczem → np. AWF. B w aucie: telefon → Zlecenia → „Kurs z graczem” → Przyjmij, podjedź do A, zatrzymaj się | czy A „wsiadł” (kamera A jedzie w aucie B) |
| 12 | B wiezie A do AWF i zatrzymuje się w żółtym kręgu | czy A wysiadł przy AWF, czy obaj dostali SMS z wynikiem |
| 13 | **Pożar:** A w aucie: telefon → Służby → „Pożar · Straż pożarna” → Przyjmij. B: telefon → Służby → „Wspólna akcja · Pożar” → Przyjmij. Obie osoby jadą na miejsce i trzymają **G** | czy obaj widzą ten sam pożar, czy gaszą razem, czy obaj dostali wypłatę |

## Płynność i bez serwera (7 min)

| # | Co zrobić | Zapisz |
| --- | --- | --- |
| 14 | A otwiera **https://bielany.zbigniew.ai/?pokoj=test** (pokój testowy) i pisze mi „boty” w czacie z Claude: puszczę 20 botów przy Starych Bielanach. Teleport → Stare Bielany, jazda autem przez minutę | najniższy fps (lewy górny róg) |
| 15 | A otwiera **https://bielany.zbigniew.ai/?solo** | czy gra działa, w telefonie Gracze: „bez gry z innymi” |
| 16 | A: telefon → Gracze → „Wyłącz grę z innymi”, potem odświeża stronę | czy B zniknął i czy po odświeżeniu nadal wyłączone (na koniec włącz) |
| 17 | **F12** → zakładka Konsola (Console), u obu osób | czy są czerwone błędy (zrzut ekranu) |

Jeśli coś się zatnie, zawiesi albo strona wyświetli „Wystąpiły problemy na tej stronie”, zróbcie zrzut ekranu
i zapiszcie, co robiliście chwilę wcześniej.

## Co odesłać

- Komputery obu osób (model, karta graficzna) i przeglądarki z wersją.
- Odpowiedzi z punktów 1–13, 15 i 16 (tak / nie, uwagi), fps z punktu 14.
- Zrzut konsoli z punktu 17 od obu osób.
- Krótko: co wyglądało dziwnie (np. ktoś „skakał”, znikał, imiona się nakładały, dymki nie znikały).

## Kryteria (bramka Fazy 5, docs/plan-fazy-5.md)

- Punkty 1–6: dwie osoby widzą się w każdym trybie, ruch płynny.
- Punkty 7–8 i 11–12: klakson, gesty i pełny kurs taksówki działają; punkt 13: wspólny pożar.
- Punkty 9–10: rozmowy działają, filtr zakrywa wulgaryzmy (krok 5.6b, decyzja 8).
- Punkt 14: co najmniej 60 fps z 20 graczami w pobliżu (jak bramka Fazy 2–4 na tym samym laptopie).
- Punkty 15–16: gra działa sama z ?solo i po wyłączeniu gry z innymi; czat z AI bez zmian.
- Punkt 17: bez czerwonych błędów.
- Wyłączony serwer i dzienny limit sprawdzamy bez Was (wyłącznik GRACZE_OFF, testy automatyczne).
