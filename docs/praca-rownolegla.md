# Praca równoległa (od kroku 3.4, decyzja z 2026-10-25)

Służby i małe zadania z backlogu powstają w osobnych sesjach, każda na własnej gałęzi (worktree). Odstępstwo od zasady
„jeden krok naraz” z CLAUDE.md dotyczy tylko tych zadań; sprawdzanie przez użytkownika i commit po kroku zostają.

## Role
- Koordynator (sesja Opus, na razie ta, która robi 3.3): kończy 3.3, sam robi 3.4 (wspólna dyspozytornia: na niej opierają
  się wszystkie służby), uruchamia sesje, przegląda ich gałęzie, scala do faza-3 po akceptacji użytkownika, robi 3.8
  (deploy) i prowadzi docs/fazy.md i docs/stan-projektu.md. Sesja, z której powstał (94% kontekstu), tylko odbiera
  raporty albo zostaje zamknięta.
- Sesje robocze: jedno zadanie, własna gałąź z faza-3, własny port serwera (8081, 8082...), commit na swojej gałęzi,
  raport do koordynatora. Nie scalają do faza-3 i nie publikują.

## Zadania i modele
| Zadanie | Gałąź | Model | Kiedy |
| --- | --- | --- | --- |
| 3.4 Dyspozytornia służb | faza-3 | Opus (koordynator) | po 3.3 |
| 3.5 Strażnik Miejski | faza-3-straznik | Sonnet (wzorzec z 3.4 i medic.js) | po 3.4 |
| 3.6 Strażak (ogień, dym, woda) | faza-3-strazak | Opus (efekty i wydajność) | po 3.4 |
| 3.7 Policjant (kontrola, pościg) | faza-3-policja | Opus (pościg AI w traffic.js) | po 3.4 |
| Tabliczki ulic w stylu warszawskim | tabliczki-ulic | Sonnet | od razu |
| Proste, mechaniczne prace (np. przebiegi testów, regeneracja danych, porządki w nazwach) | wg zadania | Haiku | gdy się pojawią |

## Jak sprawdzasz
- Każda sesja podaje własny adres (np. http://localhost:8082) i listę rzeczy do sprawdzenia w Edge.
- Akceptujesz albo zgłaszasz uwagi w tej sesji; koordynator scala dopiero po Twoim „OK”.
- Kolejność scalania: 3.4 → tabliczki → 3.5 → 3.6 → 3.7 → 3.8 (deploy i bramka).

## Gdy kontekst się kończy
- Koordynator przed końcem kontekstu zapisuje stan w docs/stan-projektu.md; nowa sesja-koordynator zaczyna od tego pliku
  i od tego dokumentu.
