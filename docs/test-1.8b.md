# Test 1.8b: Windows + Edge

Cel: sprawdzić, czy „Szczęśliwe Bielany” działają płynnie (co najmniej 30 klatek na sekundę) i bez błędów na zwykłym
laptopie z Windows w przeglądarce Microsoft Edge. Test trwa ok. 15 minut. Nie trzeba niczego instalować.

Link: **https://szczesliwe-bielany.pages.dev**

## Przygotowanie (2 min)

1. Podłącz laptop do zasilacza (na baterii Windows często zwalnia kartę graficzną).
2. Zamknij inne ciężkie programy i karty przeglądarki (gry, wideo, dużo kart z pocztą).
3. Zaktualizuj Edge: menu `…` → Ustawienia → Informacje o programie Microsoft Edge. Poczekaj, aż napisze, że jest
   aktualny.
4. Włącz akcelerację sprzętową: wpisz w pasku adresu `edge://settings/system` i upewnij się, że „Używaj akceleracji
   graficznej, gdy jest dostępna” jest włączone. Jeśli trzeba było włączyć, kliknij „Uruchom ponownie”.
5. Wpisz `edge://gpu` i zrób zrzut ekranu górnej części strony (sekcja „Graphics Feature Status”). Przy „WebGPU”
   powinno być „Hardware accelerated”.

## Test (10 min)

Otwórz link w Edge na pełnym ekranie (F11 albo zmaksymalizowane okno). Pierwsze ładowanie trwa kilkanaście sekund;
jeśli Edge zapyta, czy strona nie odpowiada, kliknij „Czekaj”.

Licznik klatek (fps) jest w lewym górnym rogu, obok napisu „Szczęśliwe Bielany”. Zapisuj liczbę po kilku sekundach od
każdej zmiany widoku. Na górze powinien być aktywny przycisk „Złota jesień”.

| # | Co zrobić | Zapisz |
| --- | --- | --- |
| 1 | Po załadowaniu nic nie ruszaj przez 10 s (taksówka przy stacji Stare Bielany) | fps |
| 2 | Jedź taksówką: W (gaz), S (hamulec), A/D (skręt) przez ok. minutę po ulicach | najniższy fps w trakcie jazdy |
| 3 | Klawisz **1**, przejdź się pieszo po chodniku (W, A, D) | fps |
| 4 | Teleport (przycisk z pinezką u góry) → Wawrzyszew, rozejrzyj się (przeciągnij myszą) | fps |
| 5 | Teleport → Młociny | fps |
| 6 | Klawisz **4** (helikopter), Spacja, by wznieść się wysoko, i leć nad las na wschodzie (Las Bielański) | najniższy fps |
| 7 | Klawisz **M** (mapa): wpisz w wyszukiwarkę „zeromskiego”, kliknij w mapę, by się przenieść | czy ulica się podświetla |
| 8 | Naciśnij **F12** → zakładka Konsola (Console) | czy są czerwone błędy (zrzut ekranu) |

Jeśli coś się zatnie, zawiesi albo strona wyświetli „Wystąpiły problemy na tej stronie”, zrób zrzut ekranu i zapisz, co
robiłeś chwilę wcześniej.

## Co odesłać

- Model laptopa i karta graficzna (np. „Lenovo ThinkPad T14, Intel Iris Xe”; nazwa karty jest też na `edge://gpu`).
- Wersja Edge (np. 156.0.…; widać ją na `edge://version`).
- Liczby fps z punktów 1–6.
- Zrzut `edge://gpu` (górna część) i zrzut konsoli z punktu 8.
- Krótko: czy coś wyglądało dziwnie (np. czarne budynki, brak drzew, migające cienie).

**Zaliczone**, gdy w punktach 1–5 jest co najmniej 30 fps i w konsoli nie ma czerwonych błędów. Punkt 6 (helikopter
nad lasem) jest najcięższy; wynik poniżej 30 fps zapiszemy, ale nie blokuje testu.
