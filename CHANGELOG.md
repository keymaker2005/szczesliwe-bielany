# Zmiany w Szczęśliwych Bielanach

Historia tego, co było publicznie dostępne na https://bielany.zbigniew.ai (Cloudflare Pages, projekt
szczesliwe-bielany), od najnowszej publikacji. Każda publikacja ma numer wersji wpisany do adresów plików (`?v=...`),
czyli commit, z którego zbudowano stronę. Godziny podane w przybliżeniu (CET).
Wewnętrzna historia prac (kroki, gałęzie, decyzje): docs/changelog-wewnetrzny.md.

Dane: © współtwórcy OpenStreetMap (ODbL); GUGiK, geoportal.gov.pl. Na podstawie mrdoob/slop-newyork.

## 0.9 — 2026-10-26, ok. 12:55 · wersja b672de0 · Faza 4: wersja do testu 1.0

**Wersja testowa**
- Gra i czaty bez zmian względem 0.8. Ta publikacja to wersja kandydująca do 1.0: na niej autor robi test na
  Windows (cała pętla Faz 2–4, skarpa, Most Północny, czat w trakcie jazdy, gra z ?czat=off).
- Numer 1.0 dostanie po zaliczonym teście.

## 0.8 — 2026-10-26 · wersja e2c8ab9 · Faza 4: czat z Burmistrzem Bielan

**Czat w telefonie**
- Druga rozmowa w aplikacji „Czat”: „Burmistrz Bielan”, postać AI w grze (bez imienia i nazwiska, nie prawdziwy
  burmistrz ani urząd). Pod każdą odpowiedzią stopka „Odpowiedź AI w grze, nie oficjalne stanowisko Urzędu Dzielnicy
  Bielany”.
- Odpowiada o dzielnicy na podstawie publicznych stron urzędu i miasta (kontakt i godziny urzędu, Warszawa 19115,
  budżet obywatelski, instytucje, remonty ulic) i o miejscach z bazy przewodnika; sprawy urzędowe odsyła do urzędu.
- Nie rozmawia o polityce ani wyborach, niczego nie obiecuje, nie przyjmuje zgłoszeń.

## 0.7 — 2026-10-26 · wersja 6d6dadd · Faza 4: czat z przewodnikiem

**Czat w telefonie**
- Nowa aplikacja „Czat”: rozmowa z Przewodnikiem po Bielanach (AI). Odpowiada krótko, po polsku, tylko o Bielanach
  i o grze, na podstawie bazy wiedzy ze źródłami; gdy czegoś nie wie, mówi to i odsyła do aplikacji Przewodnik.
- Przy pytaniu o landmark pod odpowiedzią jest przycisk „Nawiguj”, który wyznacza trasę na mapie.
- Nad rozmową informacja: odpowiedzi tworzy model AI (Claude, Anthropic) i mogą zawierać błędy, rozmowy nie są
  zapisywane. Bez kont; historia rozmowy znika po odświeżeniu strony.
- Gdy czat odpoczywa (limit dzienny, wyłączenie albo brak połączenia), gra działa dalej, a czat podpowiada aplikację
  Przewodnik.

**Wersja dla urzędu**
- Adres https://bielany.zbigniew.ai/?urzad: bez potrącania pieszych, ze znaczkiem „wersja dla urzędu”.

## 0.6 — 2026-10-25, ok. 21:45 · wersja b9bfcb1 · Faza 3: Służby i teren

**Teren**
- Prawdziwa rzeźba terenu z modelu GUGiK: skarpa wiślana i dolina Wisły do ok. 21 m poniżej Starych Bielan.
  Płaskowyż z miastem zostaje płaski.
- Wszystko stoi na gruncie: ulice, trawniki, chodniki, budynki, drzewa, auta, tramwaje, piesi i gracz. Auta
  pochylają się na zboczach, a Kameduły stoją na wzgórzu nad doliną.
- Główne drogi w dolinie mają równą jezdnię.

**Większa mapa, Wisła i mosty**
- Mapa sięga teraz do Wisły i Mostu Marii Skłodowskiej-Curie: ok. 3 tys. budynków więcej i stacja Plac Wilsona.
- Wisła, stawy (Kellera, Brustmana, Młocińskie) i plaże, w tym Plaża Miejska przy Moście Północnym.
- Mosty i wiadukty (także trasa S8) z jezdnią, chodnikami, barierkami i filarami. Tramwaj jeździ po Moście Północnym.
- Wisłostrada ma ruch. Na wiaduktach i pod nimi nie ma już zderzeń z autami jadącymi na innym poziomie.
- Nowy teleport: „Most Północny”.

**Lasy i zwierzęta**
- Las Bielański, Las Młociński, Park Młociński i mniejsze lasy: ściółka z mchem, wydeptane ścieżki, krzewy.
- Dziki (locha z warchlakami, odyńce, czasem na skraju osiedli), sarny i wiewiórki. Uciekają przed graczem.

**Służby** (telefon P → „Służby”, syrena: K)
- Wspólna dyspozytornia: zakładka „Służby”, SMS-y dyżurnych, sygnał, przed którym auta zjeżdżają na bok.
- Straż Miejska: auto na trawniku, śmieci, hałas. Na miejscu wybierasz pouczenie, mandat albo lawetę.
- Straż pożarna: pożar, zalana piwnica i kot na drzewie (G na miejscu).
- Policja: kontrola z radarem i pościg bez broni i bez taranowania.
- Ratownik medyczny działa teraz przez tę samą dyspozytornię. Pojazdy służb mają tylko napisy słowne, bez insygniów.

**Miasto**
- Stadion Hutnika przy Marymonckiej, z teleportem „Hutnik”.
- Tabliczki ulic po warszawsku: niebieskie, z białym napisem i czerwonym paskiem „Bielany”.
- Aplikacja Przewodnik w telefonie: lista landmarków z odhaczaniem odwiedzonych i przyciskiem „Nawiguj”.
- Tory i torowisko widać na zielonym pasie Marymonckiej. Dźwięk działa także w dolinie.

## 0.5 — 2026-10-25, ok. 16:50 · wersja 15dd4b8 · Faza 2: Osiedla, taksówkarz, ratownik

- Większy obszar: Słodowiec, Piaski, Marymont-Kaskada, cała Chomiczówka, Las Bielański z Kamedułami. Nowe teleporty:
  Słodowiec, Marymont, Piaski, Kaskada, Kameduły.
- Drzewa GUGiK dla całego obszaru i lepsza płynność (dalekie drzewa bez cieni, krótsze zasięgi szczegółów).
- Tramwaje na torach z OSM: 3 linie w obie strony, postoje na przystankach. Auta ustępują tramwajom.
- Taksówkarz (Taxi Bielany): pasażer macha na chodniku, kursy pod prawdziwe adresy, ocena za komfort jazdy i napiwek.
  Limity prędkości z OSM i znak przy prędkościomierzu.
- Ratownik medyczny: wezwania pod adresy, karetka na sygnale, przewóz na SOR Szpitala Bielańskiego.
- Aparat (F albo w telefonie): swobodna kamera, 5 filtrów, zdjęcia z podpisem miejsca w Pocztówkach, zapis do pliku
  i udostępnianie na X. Spadające liście.
- Piesi są „materialni”: po zderzeniu przewracają się jak szmaciana lalka. W ruchu jest mniej aut, autobusów i pieszych.

## 0.4 — 2026-10-25, ok. 06:15 · wersja 3d513d4 · Landmarki dokładniej

- Galeria Młociny (bębny, wejście, litery), stacje metra z oficjalnym znakiem „M”, Młociny jako otwarty daszek, AWF
  z rotundą i skrzydłami, UKSW i eremy, kościół św. Zygmunta z dachem-gwiazdą, Kameduły z brązowymi hełmami.
- SMS-y burmistrza (oznaczone jako wiadomość w grze) widoczne także na publicznej stronie.

## 0.3 — 2026-10-25, ok. 04:00 · wersja 9e5a64c · Poprawka publikacji

- Nowa wersja strony nie miesza się już ze starymi plikami z pamięci przeglądarki (wcześniej stary `main.js` mógł psuć
  nową stronę).

## 0.2 — 2026-10-25, ok. 04:00 · wersja 494f7b6 · Faza 1.5: Smartfon i kurier

- Smartfon (P): Zlecenia, Mapa, SMS, Pocztówki.
- Adresy z OSM jako punkty dostawy i wyszukiwarka adresów na mapie. Trasa GPS po prawdziwych ulicach.
- Kurier (Pocztylion Bielański): odbiór przy stacjach M1, oferty 0,5–2 km, gwiazdki, premia za skrót.
- Landmarki ze zdjęć: Galeria Młociny, pawilony M1, AWF, UKSW, Szpital Bielański, kościoły św. Zygmunta i św. Marii
  Magdaleny, Kameduły.
- Przewodnik: SMS-y przy 11 miejscach, z „Czytaj więcej” i źródłami.

## 0.1 — 2026-10-25, ok. 02:10 · wersja 50b4865 · Faza 1: Bielany wzdłuż M1

- Pierwsza publiczna wersja, najpierw pod szczesliwe-bielany.pages.dev, potem pod bielany.zbigniew.ai.
- Pas Stare Bielany – Wawrzyszew – Młociny: ulice z OpenStreetMap, budynki z modeli 3D GUGiK (LoD1 2024) i nowsze z OSM.
- Kwartały z krawężnikami i chodnikami, bloki według zdjęć Bielan (trzy rodzaje fasad, balkony, kolory osiedli).
- Ruch aut na prawdziwym grafie ulic, z sygnalizacją z OSM, przejściami i malowaniem jezdni.
- Złota polska jesień: słoneczne światło, drzewa GUGiK w jesiennych kolorach, liście na ziemi.
- Minimapa z polskimi nazwami, teleporty, km/h, atrybucja danych w stopce. Chodzenie, auto, rower i helikopter.
