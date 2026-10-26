# Test 1.0 na Windows + Edge (dawniej test 1.8b)

Cel: sprawdzić, czy „Szczęśliwe Bielany” działają płynnie i bez błędów na zwykłym laptopie z Windows w przeglądarce
Microsoft Edge, razem z czatem w telefonie. Jeden test zamyka bramki Faz 2, 3 i 4 (wersja 1.0). Trwa ok. 25 minut.
Nie trzeba niczego instalować.

Link: **https://bielany.zbigniew.ai**

## Przygotowanie (2 min)

1. Podłącz laptop do zasilacza (na baterii Windows często zwalnia kartę graficzną).
2. Zamknij inne ciężkie programy i karty przeglądarki (gry, wideo, dużo kart z pocztą).
3. Zaktualizuj Edge: menu `…` → Ustawienia → Informacje o programie Microsoft Edge. Poczekaj, aż napisze, że jest
   aktualny.
4. Włącz akcelerację sprzętową: wpisz w pasku adresu `edge://settings/system` i upewnij się, że „Używaj akceleracji
   graficznej, gdy jest dostępna” jest włączone. Jeśli trzeba było włączyć, kliknij „Uruchom ponownie”.
5. Wpisz `edge://gpu` i zrób zrzut ekranu górnej części strony (sekcja „Graphics Feature Status”). Przy „WebGPU”
   powinno być „Hardware accelerated”.

## Test gry (12 min)

Otwórz link w Edge na pełnym ekranie (F11 albo zmaksymalizowane okno). Pierwsze ładowanie trwa kilkanaście sekund;
jeśli Edge zapyta, czy strona nie odpowiada, kliknij „Czekaj”.

Licznik klatek (fps) jest w lewym górnym rogu, obok napisu „Szczęśliwe Bielany”. Zapisuj liczbę po kilku sekundach od
każdej zmiany widoku. Na górze powinien być aktywny przycisk „Złota jesień”. Teleport to przycisk z pinezką u góry.

| # | Co zrobić | Zapisz |
| --- | --- | --- |
| 1 | Po załadowaniu nic nie ruszaj przez 10 s (taksówka przy stacji Stare Bielany) | fps |
| 2 | Jedź taksówką: W (gaz), S (hamulec), A/D (skręt) przez ok. minutę po ulicach | najniższy fps w trakcie jazdy |
| 3 | Klawisz **1**, przejdź się pieszo po chodniku (W, A, D) | fps |
| 4 | Teleport → Wawrzyszew, rozejrzyj się (przeciągnij myszą) | fps |
| 5 | Teleport → Młociny | fps |
| 6 | Klawisz **4** (helikopter), Spacja, by wznieść się wysoko, i leć nad las na wschodzie (Las Bielański) | najniższy fps |
| 6a | Teleport → Słodowiec, potem jedź taksówką na Piaski (Kochanowskiego) | najniższy fps |
| 6b | Klawisz **4**, przeleć nad Lasem Bielańskim i Kamedułami (teleport → Kameduły) | najniższy fps |
| 6c | Teleport → Kameduły, klawisz **1**, przejdź się pieszo przy kościele i w stronę skarpy | najniższy fps |
| 6d | Teleport → Most Północny, przejedź autem przez most nad Wisłą i wróć | najniższy fps |
| 7 | Klawisz **M** (mapa): wpisz w wyszukiwarkę „zeromskiego”, kliknij w mapę, by się przenieść | czy ulica się podświetla |

## Test czatu (8 min)

| # | Co zrobić | Zapisz |
| --- | --- | --- |
| 8 | Stań taksówką. Klawisz **P** (telefon) → Czat → Przewodnik. Zapytaj: „Co to jest Kameduły?” | czy przyszła odpowiedź, czy jest „Nawiguj” |
| 9 | Kliknij „Nawiguj” pod odpowiedzią, zamknij telefon (P) i jedź według trasy przez ok. minutę | czy trasa się pokazała, najniższy fps |
| 10 | Otwórz telefon (P), zadaj przewodnikowi drugie pytanie, wyślij i od razu jedź z otwartym telefonem | najniższy fps z otwartym czatem |
| 11 | Czat → Burmistrz Bielan. Zapytaj: „Gdzie jest urząd dzielnicy?” | czy odpowiedź ma stopkę „Odpowiedź AI w grze…” |
| 12 | Wpisz w pasku adresu **https://bielany.zbigniew.ai/?czat=off**, otwórz Czat i coś napisz | czy czat mówi, że jest niedostępny, a gra działa dalej |
| 13 | Naciśnij **F12** → zakładka Konsola (Console) | czy są czerwone błędy (zrzut ekranu) |

Jeśli coś się zatnie, zawiesi albo strona wyświetli „Wystąpiły problemy na tej stronie”, zrób zrzut ekranu i zapisz, co
robiłeś chwilę wcześniej.

## Co odesłać

- Model laptopa i karta graficzna (np. „Lenovo ThinkPad T14, Intel Iris Xe”; nazwa karty jest też na `edge://gpu`).
- Wersja Edge (np. 156.0.…; widać ją na `edge://version`).
- Liczby fps z punktów 1–6d, 9 i 10.
- Odpowiedzi z punktów 7, 8, 11 i 12 (tak / nie, uwagi).
- Zrzut `edge://gpu` (górna część) i zrzut konsoli z punktu 13.
- Krótko: czy coś wyglądało dziwnie (np. czarne budynki, brak drzew, migające cienie), czy odpowiedzi czatu miały sens.

## Kryteria

- **Faza 1** (dawny test 1.8b): co najmniej 30 fps w punktach 1–5, bez czerwonych błędów w konsoli.
- **Bramka Fazy 2**: co najmniej 60 fps w punktach 1–5 i 6a, nad lasem (6, 6b) bez wyraźnego szarpania.
- **Bramka Fazy 3**: jak Faza 2, do tego 60 fps przy Kamedułach (6c) i na Moście Północnym (6d).
- **Bramka Fazy 4 (1.0)**: punkty 8–12 działają, fps z otwartym czatem (10) jak w punkcie 2, bez czerwonych błędów.
