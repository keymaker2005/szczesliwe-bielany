# Backlog (poza bieżącą fazą, nie realizować bez decyzji)

## Faza 1.5: Smartfon i kurier
Bramka: pierwsza grywalna pętla.
- Silnik zleceń js/missions.js: zlecenie = rola, start, cel, pojazd, warunek ukończenia, ocena.
- Rola kuriera: rower i auto, dostawy pod prawdziwe adresy z OSM, ocena za czas i skróty.
- Smartfon (nakładka HTML): Zlecenia, Mapa, SMS, Pocztówki.
- Przewodnik: SMS po wjeździe w promień ok. 50 m od landmarku, 2 do 3 zdań + karta "czytaj więcej". Landmarki: klasztor Kamedułów, Las Bielański, AWF, UKSW, stacje M1, Szpital Bielański, Młociny. Teksty pisane ręcznie ze źródeł, do akceptacji urzędu.
- Burmistrz Grzegorz Pietruczuk w zatwierdzonych SMS-ach (powitanie, zaproszenia do miejsc).

## Faza 2: Osiedla, taksówkarz, ratownik
Bramka: 60 fps na laptopie.
- Strefy: Słodowiec, Marymont-Ruda, Marymont-Kaskada, Chomiczówka, Piaski.
- Tramwaj na torach z OSM, ronda w grafie dróg, fasady z wielkiej płyty.
- Taksówkarz: kurs z pasażerem, ocena za czas i płynność jazdy.
- Ratownik medyczny: karetka, wezwanie, transport do Szpitala Bielańskiego, ruch ustępuje pojazdom uprzywilejowanym.
- Aplikacja Aparat: tryb foto, eksport do X. Animowane spadające liście.

## Faza 3: Służby i teren
Bramka: cała dzielnica grywalna.
- Strażnik Miejski: parkowanie na trawniku, śmieci, hałas; wybór pouczenie lub mandat.
- Strażak: pożar, zalana piwnica, kot na drzewie.
- Policjant: kontrola drogowa, pościg bez broni.
- Służby: generyczne oznaczenia, bez oficjalnych logo i insygniów, bez broni i przemocy.
- Teren: skarpa wiślana z NMT, Las Bielański, nabrzeże Wisły, Młociny z mostem, klasztor Kamedułów.

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
