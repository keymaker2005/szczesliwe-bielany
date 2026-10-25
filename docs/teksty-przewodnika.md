# Teksty przewodnika i SMS-y burmistrza – Szczęśliwe Bielany

Stan: 25.10.2026. Teksty własne, fakty sprawdzone w źródłach podanych przy każdym miejscu.

SMS przewodnika wysyłany jest, gdy gracz podejdzie ok. 50 m do miejsca. „Czytaj więcej” otwiera dłuższy opis.

SMS-y burmistrza (`kind: "mayor"`, `draft: true`) to **WERSJA ROBOCZA – do akceptacji burmistrza/urzędu; w grze oznaczone jako wiadomość w grze, nie oficjalne stanowisko**.

## Dane do importu (JSON)

Pola: `id`, `kind` (`guide` | `mayor`), `landmark` (nazwa miejsca lub `null`), `sms`, `more` (tylko `guide`), `sources` (adresy URL). Wpisy `mayor` mają dodatkowo `draft: true` – do usunięcia dopiero po akceptacji urzędu.

```json
[
  {
    "id": "guide-kameduli",
    "kind": "guide",
    "landmark": "Klasztor Kamedułów (kościół Niepokalanego Poczęcia NMP)",
    "sms": "Jesteś przy klasztorze Kamedułów. Pustelnię ufundował tu w 1639 r. król Władysław IV, a od białych habitów mnichów wzięła się nazwa Bielany. Przy północnej ścianie kościoła spoczywa Stanisław Staszic – sam wybrał to miejsce.",
    "more": "Kameduli to zakon pustelników: każdy mnich mieszkał w osobnym domku, czyli eremie, a z braćmi spotykał się głównie na modlitwie. Pierwszy, drewniany zespół powstał jako królewskie wotum Władysława IV za zwycięstwo w wojnie smoleńskiej. Murowany kościół Niepokalanego Poczęcia NMP wznoszono etapami w latach 1669–1710, a w XVIII wieku przebudowano go jeszcze raz. Historycy sztuki łączą projekt z Włochem Izydorem Affaitatim, a późnobarokową fasadę być może z Gaetanem Chiaverim. Do dziś stoi kilkanaście eremów ustawionych w równych rzędach. Stanisław Staszic, zmarły w 1826 r., chciał spocząć w ziemi za kościołem, a nie w krypcie. W podziemiach odbywają się dziś koncerty i spektakle.",
    "sources": [
      "https://en.wikipedia.org/wiki/Camaldolese_Church,_Warsaw",
      "https://pl.wikipedia.org/wiki/Rezerwat_przyrody_Las_Bielański",
      "https://www.gov.pl/web/zsckr-sejny/na-grobie-stanislawa-staszica"
    ]
  },
  {
    "id": "guide-las-bielanski",
    "kind": "guide",
    "landmark": "Las Bielański",
    "sms": "Witaj w Lesie Bielańskim! To kawałek dawnej Puszczy Mazowieckiej w środku miasta, rezerwat przyrody od 1973 r. Rosną tu stare dęby i graby, a symbolem lasu jest dzięcioł czarny – nasłuchuj jego bębnienia.",
    "more": "Rezerwat zajmuje około 130 ha na skarpie i tarasie Wisły. Wyżej dominuje grąd, czyli las liściasty z dębami, grabami, lipami i klonami, a niżej, bliżej rzeki, łęg z jesionami, wiązami i olchami. Niektóre dęby mają ponad 3 m obwodu. Warszawiacy wypoczywają tu od XVII wieku, a za Stanisława Augusta narodziła się tradycja zielonoświątkowych festynów przy klasztorze. Po włączeniu Bielan do miasta działał tu nawet park rozrywki z karuzelą, ale tłumy niszczyły las, więc w 1973 r. utworzono rezerwat. Zimą nocują tu ponad sto tysięcy gawronów i kawek. Na Polkowej Górze jest punkt widokowy. Prosimy: trzymaj się ścieżek.",
    "sources": [
      "https://pl.wikipedia.org/wiki/Rezerwat_przyrody_Las_Bielański",
      "https://muzeumwarszawy.pl/en/for-here-and-to-go-warsaws-cuisine-audioguide/7-a-picnic-by-the-vistula-river"
    ]
  },
  {
    "id": "guide-awf",
    "kind": "guide",
    "landmark": "AWF – Akademia Wychowania Fizycznego, ul. Marymoncka 34",
    "sms": "Przed Tobą AWF, dawny Centralny Instytut Wychowania Fizycznego. Zajęcia ruszyły tu w 1929 r. w gmachach Edgara Norwertha. Architekt wytyczył dziedziniec wokół starej topoli czarnej – dziś to pomnik przyrody.",
    "more": "Uczelnia przy Marymonckiej 34 powstała jako CIWF, nowoczesna szkoła dla nauczycieli wychowania fizycznego i trenerów. Kamień węgielny położono w 1928 r., zajęcia ruszyły w listopadzie 1929 r., a imię Józefa Piłsudskiego uczelnia dostała w 1935 r. Kampus zaprojektował prof. Edgar Norwerth z Politechniki Warszawskiej: modernistyczne gmachy otaczają boiska, hale i zieleń na skraju Lasu Bielańskiego. Ciekawostka: w chwili otwarcia był to jeszcze teren gminy Młociny, a do Warszawy włączono go dopiero w 1930 r. Topola czarna, wokół której Norwerth zaplanował dziedziniec, miała wtedy około 50 lat. W 2009 r. uznano ją za pomnik przyrody, więc rośnie tu dłużej niż stoją budynki.",
    "sources": [
      "https://pl.wikipedia.org/wiki/Akademia_Wychowania_Fizycznego_Józefa_Piłsudskiego_w_Warszawie"
    ]
  },
  {
    "id": "guide-uksw-dewajtis",
    "kind": "guide",
    "landmark": "UKSW – Kampus Dewajtis",
    "sms": "To kampus Dewajtis Uniwersytetu Kardynała Stefana Wyszyńskiego. Uczelnia działa od 1999 r., a jej poprzedniczka, ATK, od 1954 r. Tu mieści się rektorat, biblioteka i muzeum uczelni, otwarte w 2020 r. w zabytkowej kaplicy.",
    "more": "UKSW wyrosła z Akademii Teologii Katolickiej, powołanej w 1954 r. z wydziałów teologicznych Uniwersytetu Warszawskiego i Jagiellońskiego. W 1999 r. ATK przekształcono w uniwersytet imienia prymasa Stefana Wyszyńskiego. Kampus przy Dewajtis sąsiaduje z zespołem pokamedulskim i otaczają go drzewa Lasu Bielańskiego. W 2003 r. kardynał Józef Glemp przekazał uczelni grunt, na którym stanęły nowe budynki. Dziś pracuje tu rektorat, biblioteka główna, wydawnictwo i dziekanaty kilku wydziałów, a w Starym Budynku działa Muzeum UKSW. Drugi bielański kampus jest przy ul. Wóycickiego. Ciekawostka: „Dewajtis” to tytuł powieści Marii Rodziewiczówny z 1889 r., której bohaterem jest prastary dąb – pasuje do miejsca pełnego starych dębów.",
    "sources": [
      "https://uksw.edu.pl/en/studenci/kampusy",
      "https://muzea.waw.pl/en/museums/uksw-university-museum/",
      "https://en.wikipedia.org/wiki/Cardinal_Stefan_Wyszy%C5%84ski_University_in_Warsaw"
    ]
  },
  {
    "id": "guide-metro-stare-bielany",
    "kind": "guide",
    "landmark": "Stacja metra Stare Bielany (M1)",
    "sms": "Stacja Stare Bielany działa od 25 października 2008 r. Zaprojektowała ją pracownia AiB (Zdzisław Kostrzewa), a wnętrza prof. Mirosław Duchowski i Agnieszka Sadkowska-Penczonek. Zwróć uwagę na jasne drewno na peronie.",
    "more": "Stacja leży płytko, nieco ponad 7 m pod ziemią. Cały odcinek od Słodowca do Młocin budowano metodą odkrywkową, czyli w wykopie, który potem przykryto. W projekcie nosiła nazwę „Bielany”, a na „Stare Bielany” zmieniono ją w 2006 r., żeby lepiej wskazywała okolicę. Otwarto ją jesienią 2008 r. razem z Wawrzyszewem i Młocinami, co doprowadziło pierwszą linię do jej północnego krańca. Wnętrze łączy szare posadzki i ściany z ciepłym, jasnym drewnem, które wyróżnia ją wśród stacji M1. Na górze masz kilka minut spaceru do pl. Konfederacji, AWF i Lasu Bielańskiego. Ciekawostka z gry: właśnie tutaj leży punkt zerowy całej mapy.",
    "sources": [
      "https://pl.wikipedia.org/wiki/Stare_Bielany_(stacja_metra)"
    ]
  },
  {
    "id": "guide-metro-wawrzyszew",
    "kind": "guide",
    "landmark": "Stacja metra Wawrzyszew (M1)",
    "sms": "Stacja Wawrzyszew działa od 25 października 2008 r., a zaprojektował ją Andrzej M. Chołdzyński. Wyjście w stronę bazaru Wolumen wyróżnia się czerwonym kolorem – łatwo się przy nim umówić.",
    "more": "Wawrzyszew to jedna z najstarszych bielańskich miejscowości: wieś wzmiankowana już w XIV wieku, której nazwa pochodzi od imienia Wawrzyniec. Dziś to przede wszystkim osiedle bloków zbudowane w latach 1973–1978 dla około 20 tysięcy mieszkańców. Stacja metra jest jednopoziomowa, z peronami po obu stronach torów, i podobnie jak sąsiednie powstała w otwartym wykopie. Za stacją nie ma rozjazdu, więc pociągi zawracają dopiero za Młocinami. Wyjście od strony Wolumenu prowadzi prosto do popularnego bazaru, gdzie kupisz warzywa, ubrania i drobiazgi. W okolicy znajdziesz też zabytkowy kościół św. Marii Magdaleny i Stawy Brustmana, wykopane w XIX wieku przy osuszaniu terenu.",
    "sources": [
      "https://pl.wikipedia.org/wiki/Wawrzyszew_(stacja_metra)",
      "https://en.wikipedia.org/wiki/Wawrzyszew_metro_station",
      "https://pl.wikipedia.org/wiki/Wawrzyszew_(Warszawa)"
    ]
  },
  {
    "id": "guide-metro-mlociny",
    "kind": "guide",
    "landmark": "Stacja metra Młociny (M1)",
    "sms": "Młociny to północna stacja końcowa linii M1, otwarta w 2008 r. Projekt przygotowała pracownia AMC Andrzeja M. Chołdzyńskiego z Metroprojektem. Za peronami są tory odstawcze, gdzie pociągi nocują i przechodzą drobne naprawy.",
    "more": "Stację zaprojektowano tak, by w przyszłości linię można było przedłużyć: na północ w stronę Łomianek, na zachód ku Chomiczówce albo na wschód, pod Mostem Marii Skłodowskiej-Curie. Na razie to koniec trasy. Za peronami ciągną się tory odstawcze, na których pociągi zawracają w stronę Kabat, są sprzątane i czekają na poranny wyjazd. Ciekawostka z budowy: roboty ziemne ruszyły z około dwumiesięcznym opóźnieniem, bo trwał spór o kiosk stojący na placu budowy. Nad stacją działa wielki węzeł przesiadkowy z pętlą tramwajową i autobusową, dworcem autobusów podmiejskich i parkingiem P+R na około 900 aut. Stąd łatwo dojechać na Białołękę, Bemowo i pod Warszawę.",
    "sources": [
      "https://pl.wikipedia.org/wiki/Młociny_(stacja_metra)"
    ]
  },
  {
    "id": "guide-szpital-bielanski",
    "kind": "guide",
    "landmark": "Szpital Bielański",
    "sms": "Szpital Bielański przy Cegłowskiej 80 otwarto w grudniu 1960 r. Projektowali go Julian Sadłowski i Leopold Koehler w stylu socrealistycznym. Od 1999 r. nosi imię ks. Jerzego Popiełuszki.",
    "more": "Budowę rozpoczęto w 1953 r. Była to największa szpitalna inwestycja Warszawy w czasach planu sześcioletniego, od początku pomyślana też jako miejsce kształcenia lekarzy. Pierwotnie planowano około 600 łóżek, dziś jest ich ponad 700. W latach 80. dobudowano trzykondygnacyjny pawilon. W 2021 r. szpital połączył się ze Szpitalem Specjalistycznym „Inflancka”, a w 2022 r. otwarto nowe skrzydło. Monumentalna, symetryczna bryła z czasów socrealizmu dobrze odróżnia się od okolicznych bloków. Imię patrona, ks. Jerzego Popiełuszki, szpital nosi od 14 grudnia 1999 r. W grze to miejsce, gdzie warto zwolnić: karetki mają tu zawsze pierwszeństwo, a przed wjazdem na podjazd trzeba uważać na pieszych.",
    "sources": [
      "https://pl.wikipedia.org/wiki/Szpital_Bielański"
    ]
  },
  {
    "id": "guide-mlociny",
    "kind": "guide",
    "landmark": "Młociny – węzeł przesiadkowy i Galeria Młociny",
    "sms": "Młociny to największy węzeł przesiadkowy Warszawy: metro, tramwaje i autobusy, także podmiejskie. Obok stoi Galeria Młociny, otwarta 23 maja 2019 r., z ogrodem na dachu – dobre miejsce, by spojrzeć na okolicę z góry.",
    "more": "Węzeł nad stacją metra ma trzy poziomy i obsługuje pasażerów z Bielan, Bemowa, Białołęki i miejscowości pod Warszawą. Parking P+R mieści około 900 samochodów, jest też parking rowerowy. Galerię Młociny zaprojektowały pracownie Kuryłowicz & Associates i Chapman Taylor, a budowa trwała od października 2016 r. do maja 2019 r. W środku jest około 200 sklepów, kilkadziesiąt restauracji i kino, a całe drugie piętro zajmuje strefa jedzenia i rozrywki połączona z zielonym dachem. Młociny to dawna podwarszawska miejscowość: jeszcze w 1930 r. istniała osobna gmina Młociny, z której do miasta włączono między innymi teren dzisiejszej AWF.",
    "sources": [
      "https://pl.wikipedia.org/wiki/Galeria_Młociny",
      "https://pl.wikipedia.org/wiki/Młociny_(stacja_metra)",
      "https://pl.wikipedia.org/wiki/Akademia_Wychowania_Fizycznego_Józefa_Piłsudskiego_w_Warszawie"
    ]
  },
  {
    "id": "guide-sw-zygmunt",
    "kind": "guide",
    "landmark": "Kościół św. Zygmunta, pl. Konfederacji",
    "sms": "Kościół św. Zygmunta na pl. Konfederacji zbudowano w latach 1976–1980 według projektu Zbigniewa Pawelskiego. Plan oparto na sześciokącie z trójkątów równobocznych o boku 7,5 m. Świątynia ma dwa poziomy: kościół dolny i górny.",
    "more": "Kościół poświęcono 8 grudnia 1980 r., a budowę prowadził ks. Ryszard Grygielka. Powstawał w czasach PRL, kiedy zgoda na nowy kościół nie była łatwa do zdobycia. Geometria budynku nie jest przypadkowa: trójkąt i sześciokąt mają tu znaczenie symboliczne i trafiły nawet do logo parafii. Dolny kościół mieści około 600 osób i służy też spotkaniom poza liturgią, a górny jest wielokrotnie większy. Plac Konfederacji leży na Starych Bielanach, przy osiedlu Zdobycz Robotnicza, kilka minut spacerem od stacji metra Stare Bielany. Gdy staniesz na placu, przyjrzyj się dachowi i ścianom – z wielu miejsc widać, że cała bryła składa się z powtarzanych trójkątów.",
    "sources": [
      "https://pl.wikipedia.org/wiki/Kościół_św._Zygmunta_w_Warszawie"
    ]
  },
  {
    "id": "guide-sw-maria-magdalena",
    "kind": "guide",
    "landmark": "Kościół św. Marii Magdaleny na Wawrzyszewie",
    "sms": "Kościół św. Marii Magdaleny na Wawrzyszewie zbudowano w latach 1543–1548. Ufundował go Baltazar Smosarski, lekarz króla Zygmunta Starego. To jedna z niewielu pamiątek po dawnej wsi – starsza od bloków dookoła o ponad 400 lat.",
    "more": "Parafię erygował w 1542 r. biskup Benedykt Izdbieński, choć kościół stał we wsi już przed 1446 r. Obecna świątynia łączy cechy późnego renesansu i baroku mazowieckiego. W XVIII wieku przedłużono nawę, w 1830 r. dobudowano kruchtę, a w 1870 r. zakrystię. W ołtarzu głównym z XVIII wieku jest obraz modlącej się Marii Magdaleny i figura św. Wawrzyńca; imię Wawrzyniec kryje się też w nazwie Wawrzyszewa. Warto zerknąć na flamandzki żyrandol z 1894 r. i epitafia w kruchcie. Obok leży cmentarz wawrzyszewski, założony w 1830 r. dla mieszkańców Wawrzyszewa i Chomiczówki. Kościół jest wpisany do rejestru zabytków.",
    "sources": [
      "https://pl.wikipedia.org/wiki/Kościół_św._Marii_Magdaleny_w_Warszawie",
      "https://pl.wikipedia.org/wiki/Wawrzyszew_(Warszawa)"
    ]
  },
  {
    "id": "mayor-welcome",
    "kind": "mayor",
    "landmark": null,
    "sms": "Szanowni Państwo, witam serdecznie na Bielanach! Cieszę się, że odwiedzacie naszą dzielnicę. Mamy tu las w środku miasta, metro pod ręką i mnóstwo zieleni. Rozglądajcie się i dbajmy razem o naszą wspólną przestrzeń.",
    "draft": true,
    "sources": [
      "https://bielany.um.warszawa.pl/-/rozmowa-burmistrz-pietruczuk-122024",
      "https://wsm.pl/z-burmistrzem-bielan-grzegorzem-pietruczukiem-o-bielanskich-korzeniach-i-ambitnych-dzialaniach/",
      "https://tvn24.pl/tvnwarszawa/bielany/warszawa-mieszkancy-bielan-skarza-sie-na-odor-st9188809",
      "https://bielany.um.warszawa.pl/-/gala-edukacji-2026",
      "https://bielany.um.warszawa.pl/-/umowa-modernizacja-skalbmierska"
    ]
  },
  {
    "id": "mayor-invite-las-bielanski",
    "kind": "mayor",
    "landmark": "Las Bielański",
    "sms": "Szanowni Państwo, polecam spacer po Lesie Bielańskim. To rezerwat ze starymi dębami, tuż przy klasztorze Kamedułów. Prosimy chodzić ścieżkami – ten las to nasz wspólny skarb i dbamy o niego wszyscy.",
    "draft": true,
    "sources": [
      "https://bielany.um.warszawa.pl/-/rozmowa-burmistrz-pietruczuk-122024",
      "https://wsm.pl/z-burmistrzem-bielan-grzegorzem-pietruczukiem-o-bielanskich-korzeniach-i-ambitnych-dzialaniach/",
      "https://tvn24.pl/tvnwarszawa/bielany/warszawa-mieszkancy-bielan-skarza-sie-na-odor-st9188809",
      "https://bielany.um.warszawa.pl/-/gala-edukacji-2026",
      "https://bielany.um.warszawa.pl/-/umowa-modernizacja-skalbmierska",
      "https://pl.wikipedia.org/wiki/Rezerwat_przyrody_Las_Bielański"
    ]
  },
  {
    "id": "mayor-invite-kameduli",
    "kind": "mayor",
    "landmark": "Klasztor Kamedułów (kościół Niepokalanego Poczęcia NMP)",
    "sms": "Zapraszam na wzgórze kamedulskie! Kościół, dawne eremy i grób Stanisława Staszica to kawał historii Warszawy. Polecam szczególnie jesienią, gdy las dookoła robi się złoty.",
    "draft": true,
    "sources": [
      "https://bielany.um.warszawa.pl/-/rozmowa-burmistrz-pietruczuk-122024",
      "https://wsm.pl/z-burmistrzem-bielan-grzegorzem-pietruczukiem-o-bielanskich-korzeniach-i-ambitnych-dzialaniach/",
      "https://tvn24.pl/tvnwarszawa/bielany/warszawa-mieszkancy-bielan-skarza-sie-na-odor-st9188809",
      "https://bielany.um.warszawa.pl/-/gala-edukacji-2026",
      "https://bielany.um.warszawa.pl/-/umowa-modernizacja-skalbmierska",
      "https://en.wikipedia.org/wiki/Camaldolese_Church,_Warsaw"
    ]
  },
  {
    "id": "mayor-invite-stawy-brustmana",
    "kind": "mayor",
    "landmark": "Stawy Brustmana",
    "sms": "Serdecznie zapraszam nad Stawy Brustmana na Wawrzyszewie. Woda i zieleń między osiedlami to dobre miejsce na chwilę oddechu. Warto tu zajrzeć w drodze z metra.",
    "draft": true,
    "sources": [
      "https://bielany.um.warszawa.pl/-/rozmowa-burmistrz-pietruczuk-122024",
      "https://wsm.pl/z-burmistrzem-bielan-grzegorzem-pietruczukiem-o-bielanskich-korzeniach-i-ambitnych-dzialaniach/",
      "https://tvn24.pl/tvnwarszawa/bielany/warszawa-mieszkancy-bielan-skarza-sie-na-odor-st9188809",
      "https://bielany.um.warszawa.pl/-/gala-edukacji-2026",
      "https://bielany.um.warszawa.pl/-/umowa-modernizacja-skalbmierska",
      "https://pl.wikipedia.org/wiki/Wawrzyszew_(Warszawa)"
    ]
  },
  {
    "id": "mayor-invite-olszyna",
    "kind": "mayor",
    "landmark": "Zespół przyrodniczo-krajobrazowy Olszyna",
    "sms": "Zapraszam do Olszyny! To zespół przyrodniczo-krajobrazowy, w którym zieleń i woda tworzą spokojny zakątek naszej dzielnicy. Idealne miejsce na niedzielny spacer z rodziną.",
    "draft": true,
    "sources": [
      "https://bielany.um.warszawa.pl/-/rozmowa-burmistrz-pietruczuk-122024",
      "https://wsm.pl/z-burmistrzem-bielan-grzegorzem-pietruczukiem-o-bielanskich-korzeniach-i-ambitnych-dzialaniach/",
      "https://tvn24.pl/tvnwarszawa/bielany/warszawa-mieszkancy-bielan-skarza-sie-na-odor-st9188809",
      "https://bielany.um.warszawa.pl/-/gala-edukacji-2026",
      "https://bielany.um.warszawa.pl/-/umowa-modernizacja-skalbmierska",
      "https://bielany.um.warszawa.pl/-/badania-zachowanie-wody-olszyna"
    ]
  },
  {
    "id": "mayor-invite-park-mlocinski",
    "kind": "mayor",
    "landmark": "Park Młociński",
    "sms": "Szanowni Państwo, polecam Park Młociński na północy Bielan. Dużo zieleni, cisza i miejsce na długi spacer po pracy. Zajrzyjcie, zanim jesień zabierze liście!",
    "draft": true,
    "sources": [
      "https://bielany.um.warszawa.pl/-/rozmowa-burmistrz-pietruczuk-122024",
      "https://wsm.pl/z-burmistrzem-bielan-grzegorzem-pietruczukiem-o-bielanskich-korzeniach-i-ambitnych-dzialaniach/",
      "https://tvn24.pl/tvnwarszawa/bielany/warszawa-mieszkancy-bielan-skarza-sie-na-odor-st9188809",
      "https://bielany.um.warszawa.pl/-/gala-edukacji-2026",
      "https://bielany.um.warszawa.pl/-/umowa-modernizacja-skalbmierska"
    ]
  },
  {
    "id": "mayor-thanks-delivery-1",
    "kind": "mayor",
    "landmark": null,
    "sms": "Dziękuję za sprawną dostawę! Dzięki solidnej codziennej pracy na Bielanach żyje się wygodniej. Proszę uważać na pieszych i rowerzystów – do zobaczenia na trasie.",
    "draft": true,
    "sources": [
      "https://bielany.um.warszawa.pl/-/rozmowa-burmistrz-pietruczuk-122024",
      "https://wsm.pl/z-burmistrzem-bielan-grzegorzem-pietruczukiem-o-bielanskich-korzeniach-i-ambitnych-dzialaniach/",
      "https://tvn24.pl/tvnwarszawa/bielany/warszawa-mieszkancy-bielan-skarza-sie-na-odor-st9188809",
      "https://bielany.um.warszawa.pl/-/gala-edukacji-2026",
      "https://bielany.um.warszawa.pl/-/umowa-modernizacja-skalbmierska"
    ]
  },
  {
    "id": "mayor-thanks-delivery-2",
    "kind": "mayor",
    "landmark": null,
    "sms": "Paczka dotarła na czas – serdecznie dziękuję! Kurierzy znają nasze ulice jak mało kto. Proszę pamiętać o odpoczynku, a w przerwie może krótki spacer po Lesie Bielańskim?",
    "draft": true,
    "sources": [
      "https://bielany.um.warszawa.pl/-/rozmowa-burmistrz-pietruczuk-122024",
      "https://wsm.pl/z-burmistrzem-bielan-grzegorzem-pietruczukiem-o-bielanskich-korzeniach-i-ambitnych-dzialaniach/",
      "https://tvn24.pl/tvnwarszawa/bielany/warszawa-mieszkancy-bielan-skarza-sie-na-odor-st9188809",
      "https://bielany.um.warszawa.pl/-/gala-edukacji-2026",
      "https://bielany.um.warszawa.pl/-/umowa-modernizacja-skalbmierska"
    ]
  }
]
```

## Część A – teksty przewodnika

### Klasztor Kamedułów (kościół Niepokalanego Poczęcia NMP)

**SMS** (224 znaków):

> Jesteś przy klasztorze Kamedułów. Pustelnię ufundował tu w 1639 r. król Władysław IV, a od białych habitów mnichów wzięła się nazwa Bielany. Przy północnej ścianie kościoła spoczywa Stanisław Staszic – sam wybrał to miejsce.

**Czytaj więcej** (101 słów):

Kameduli to zakon pustelników: każdy mnich mieszkał w osobnym domku, czyli eremie, a z braćmi spotykał się głównie na modlitwie. Pierwszy, drewniany zespół powstał jako królewskie wotum Władysława IV za zwycięstwo w wojnie smoleńskiej. Murowany kościół Niepokalanego Poczęcia NMP wznoszono etapami w latach 1669–1710, a w XVIII wieku przebudowano go jeszcze raz. Historycy sztuki łączą projekt z Włochem Izydorem Affaitatim, a późnobarokową fasadę być może z Gaetanem Chiaverim. Do dziś stoi kilkanaście eremów ustawionych w równych rzędach. Stanisław Staszic, zmarły w 1826 r., chciał spocząć w ziemi za kościołem, a nie w krypcie. W podziemiach odbywają się dziś koncerty i spektakle.

**Źródła:**

- https://en.wikipedia.org/wiki/Camaldolese_Church,_Warsaw
- https://pl.wikipedia.org/wiki/Rezerwat_przyrody_Las_Bielański
- https://www.gov.pl/web/zsckr-sejny/na-grobie-stanislawa-staszica

### Las Bielański

**SMS** (204 znaków):

> Witaj w Lesie Bielańskim! To kawałek dawnej Puszczy Mazowieckiej w środku miasta, rezerwat przyrody od 1973 r. Rosną tu stare dęby i graby, a symbolem lasu jest dzięcioł czarny – nasłuchuj jego bębnienia.

**Czytaj więcej** (97 słów):

Rezerwat zajmuje około 130 ha na skarpie i tarasie Wisły. Wyżej dominuje grąd, czyli las liściasty z dębami, grabami, lipami i klonami, a niżej, bliżej rzeki, łęg z jesionami, wiązami i olchami. Niektóre dęby mają ponad 3 m obwodu. Warszawiacy wypoczywają tu od XVII wieku, a za Stanisława Augusta narodziła się tradycja zielonoświątkowych festynów przy klasztorze. Po włączeniu Bielan do miasta działał tu nawet park rozrywki z karuzelą, ale tłumy niszczyły las, więc w 1973 r. utworzono rezerwat. Zimą nocują tu ponad sto tysięcy gawronów i kawek. Na Polkowej Górze jest punkt widokowy. Prosimy: trzymaj się ścieżek.

**Źródła:**

- https://pl.wikipedia.org/wiki/Rezerwat_przyrody_Las_Bielański
- https://muzeumwarszawy.pl/en/for-here-and-to-go-warsaws-cuisine-audioguide/7-a-picnic-by-the-vistula-river

### AWF – Akademia Wychowania Fizycznego, ul. Marymoncka 34

**SMS** (207 znaków):

> Przed Tobą AWF, dawny Centralny Instytut Wychowania Fizycznego. Zajęcia ruszyły tu w 1929 r. w gmachach Edgara Norwertha. Architekt wytyczył dziedziniec wokół starej topoli czarnej – dziś to pomnik przyrody.

**Czytaj więcej** (101 słów):

Uczelnia przy Marymonckiej 34 powstała jako CIWF, nowoczesna szkoła dla nauczycieli wychowania fizycznego i trenerów. Kamień węgielny położono w 1928 r., zajęcia ruszyły w listopadzie 1929 r., a imię Józefa Piłsudskiego uczelnia dostała w 1935 r. Kampus zaprojektował prof. Edgar Norwerth z Politechniki Warszawskiej: modernistyczne gmachy otaczają boiska, hale i zieleń na skraju Lasu Bielańskiego. Ciekawostka: w chwili otwarcia był to jeszcze teren gminy Młociny, a do Warszawy włączono go dopiero w 1930 r. Topola czarna, wokół której Norwerth zaplanował dziedziniec, miała wtedy około 50 lat. W 2009 r. uznano ją za pomnik przyrody, więc rośnie tu dłużej niż stoją budynki.

**Źródła:**

- https://pl.wikipedia.org/wiki/Akademia_Wychowania_Fizycznego_Józefa_Piłsudskiego_w_Warszawie

### UKSW – Kampus Dewajtis

**SMS** (221 znaków):

> To kampus Dewajtis Uniwersytetu Kardynała Stefana Wyszyńskiego. Uczelnia działa od 1999 r., a jej poprzedniczka, ATK, od 1954 r. Tu mieści się rektorat, biblioteka i muzeum uczelni, otwarte w 2020 r. w zabytkowej kaplicy.

**Czytaj więcej** (102 słów):

UKSW wyrosła z Akademii Teologii Katolickiej, powołanej w 1954 r. z wydziałów teologicznych Uniwersytetu Warszawskiego i Jagiellońskiego. W 1999 r. ATK przekształcono w uniwersytet imienia prymasa Stefana Wyszyńskiego. Kampus przy Dewajtis sąsiaduje z zespołem pokamedulskim i otaczają go drzewa Lasu Bielańskiego. W 2003 r. kardynał Józef Glemp przekazał uczelni grunt, na którym stanęły nowe budynki. Dziś pracuje tu rektorat, biblioteka główna, wydawnictwo i dziekanaty kilku wydziałów, a w Starym Budynku działa Muzeum UKSW. Drugi bielański kampus jest przy ul. Wóycickiego. Ciekawostka: „Dewajtis” to tytuł powieści Marii Rodziewiczówny z 1889 r., której bohaterem jest prastary dąb – pasuje do miejsca pełnego starych dębów.

**Źródła:**

- https://uksw.edu.pl/en/studenci/kampusy
- https://muzea.waw.pl/en/museums/uksw-university-museum/
- https://en.wikipedia.org/wiki/Cardinal_Stefan_Wyszy%C5%84ski_University_in_Warsaw

### Stacja metra Stare Bielany (M1)

**SMS** (216 znaków):

> Stacja Stare Bielany działa od 25 października 2008 r. Zaprojektowała ją pracownia AiB (Zdzisław Kostrzewa), a wnętrza prof. Mirosław Duchowski i Agnieszka Sadkowska-Penczonek. Zwróć uwagę na jasne drewno na peronie.

**Czytaj więcej** (99 słów):

Stacja leży płytko, nieco ponad 7 m pod ziemią. Cały odcinek od Słodowca do Młocin budowano metodą odkrywkową, czyli w wykopie, który potem przykryto. W projekcie nosiła nazwę „Bielany”, a na „Stare Bielany” zmieniono ją w 2006 r., żeby lepiej wskazywała okolicę. Otwarto ją jesienią 2008 r. razem z Wawrzyszewem i Młocinami, co doprowadziło pierwszą linię do jej północnego krańca. Wnętrze łączy szare posadzki i ściany z ciepłym, jasnym drewnem, które wyróżnia ją wśród stacji M1. Na górze masz kilka minut spaceru do pl. Konfederacji, AWF i Lasu Bielańskiego. Ciekawostka z gry: właśnie tutaj leży punkt zerowy całej mapy.

**Źródła:**

- https://pl.wikipedia.org/wiki/Stare_Bielany_(stacja_metra)

### Stacja metra Wawrzyszew (M1)

**SMS** (187 znaków):

> Stacja Wawrzyszew działa od 25 października 2008 r., a zaprojektował ją Andrzej M. Chołdzyński. Wyjście w stronę bazaru Wolumen wyróżnia się czerwonym kolorem – łatwo się przy nim umówić.

**Czytaj więcej** (97 słów):

Wawrzyszew to jedna z najstarszych bielańskich miejscowości: wieś wzmiankowana już w XIV wieku, której nazwa pochodzi od imienia Wawrzyniec. Dziś to przede wszystkim osiedle bloków zbudowane w latach 1973–1978 dla około 20 tysięcy mieszkańców. Stacja metra jest jednopoziomowa, z peronami po obu stronach torów, i podobnie jak sąsiednie powstała w otwartym wykopie. Za stacją nie ma rozjazdu, więc pociągi zawracają dopiero za Młocinami. Wyjście od strony Wolumenu prowadzi prosto do popularnego bazaru, gdzie kupisz warzywa, ubrania i drobiazgi. W okolicy znajdziesz też zabytkowy kościół św. Marii Magdaleny i Stawy Brustmana, wykopane w XIX wieku przy osuszaniu terenu.

**Źródła:**

- https://pl.wikipedia.org/wiki/Wawrzyszew_(stacja_metra)
- https://en.wikipedia.org/wiki/Wawrzyszew_metro_station
- https://pl.wikipedia.org/wiki/Wawrzyszew_(Warszawa)

### Stacja metra Młociny (M1)

**SMS** (223 znaków):

> Młociny to północna stacja końcowa linii M1, otwarta w 2008 r. Projekt przygotowała pracownia AMC Andrzeja M. Chołdzyńskiego z Metroprojektem. Za peronami są tory odstawcze, gdzie pociągi nocują i przechodzą drobne naprawy.

**Czytaj więcej** (100 słów):

Stację zaprojektowano tak, by w przyszłości linię można było przedłużyć: na północ w stronę Łomianek, na zachód ku Chomiczówce albo na wschód, pod Mostem Marii Skłodowskiej-Curie. Na razie to koniec trasy. Za peronami ciągną się tory odstawcze, na których pociągi zawracają w stronę Kabat, są sprzątane i czekają na poranny wyjazd. Ciekawostka z budowy: roboty ziemne ruszyły z około dwumiesięcznym opóźnieniem, bo trwał spór o kiosk stojący na placu budowy. Nad stacją działa wielki węzeł przesiadkowy z pętlą tramwajową i autobusową, dworcem autobusów podmiejskich i parkingiem P+R na około 900 aut. Stąd łatwo dojechać na Białołękę, Bemowo i pod Warszawę.

**Źródła:**

- https://pl.wikipedia.org/wiki/Młociny_(stacja_metra)

### Szpital Bielański

**SMS** (186 znaków):

> Szpital Bielański przy Cegłowskiej 80 otwarto w grudniu 1960 r. Projektowali go Julian Sadłowski i Leopold Koehler w stylu socrealistycznym. Od 1999 r. nosi imię ks. Jerzego Popiełuszki.

**Czytaj więcej** (101 słów):

Budowę rozpoczęto w 1953 r. Była to największa szpitalna inwestycja Warszawy w czasach planu sześcioletniego, od początku pomyślana też jako miejsce kształcenia lekarzy. Pierwotnie planowano około 600 łóżek, dziś jest ich ponad 700. W latach 80. dobudowano trzykondygnacyjny pawilon. W 2021 r. szpital połączył się ze Szpitalem Specjalistycznym „Inflancka”, a w 2022 r. otwarto nowe skrzydło. Monumentalna, symetryczna bryła z czasów socrealizmu dobrze odróżnia się od okolicznych bloków. Imię patrona, ks. Jerzego Popiełuszki, szpital nosi od 14 grudnia 1999 r. W grze to miejsce, gdzie warto zwolnić: karetki mają tu zawsze pierwszeństwo, a przed wjazdem na podjazd trzeba uważać na pieszych.

**Źródła:**

- https://pl.wikipedia.org/wiki/Szpital_Bielański

### Młociny – węzeł przesiadkowy i Galeria Młociny

**SMS** (216 znaków):

> Młociny to największy węzeł przesiadkowy Warszawy: metro, tramwaje i autobusy, także podmiejskie. Obok stoi Galeria Młociny, otwarta 23 maja 2019 r., z ogrodem na dachu – dobre miejsce, by spojrzeć na okolicę z góry.

**Czytaj więcej** (95 słów):

Węzeł nad stacją metra ma trzy poziomy i obsługuje pasażerów z Bielan, Bemowa, Białołęki i miejscowości pod Warszawą. Parking P+R mieści około 900 samochodów, jest też parking rowerowy. Galerię Młociny zaprojektowały pracownie Kuryłowicz & Associates i Chapman Taylor, a budowa trwała od października 2016 r. do maja 2019 r. W środku jest około 200 sklepów, kilkadziesiąt restauracji i kino, a całe drugie piętro zajmuje strefa jedzenia i rozrywki połączona z zielonym dachem. Młociny to dawna podwarszawska miejscowość: jeszcze w 1930 r. istniała osobna gmina Młociny, z której do miasta włączono między innymi teren dzisiejszej AWF.

**Źródła:**

- https://pl.wikipedia.org/wiki/Galeria_Młociny
- https://pl.wikipedia.org/wiki/Młociny_(stacja_metra)
- https://pl.wikipedia.org/wiki/Akademia_Wychowania_Fizycznego_Józefa_Piłsudskiego_w_Warszawie

### Kościół św. Zygmunta, pl. Konfederacji

**SMS** (225 znaków):

> Kościół św. Zygmunta na pl. Konfederacji zbudowano w latach 1976–1980 według projektu Zbigniewa Pawelskiego. Plan oparto na sześciokącie z trójkątów równobocznych o boku 7,5 m. Świątynia ma dwa poziomy: kościół dolny i górny.

**Czytaj więcej** (101 słów):

Kościół poświęcono 8 grudnia 1980 r., a budowę prowadził ks. Ryszard Grygielka. Powstawał w czasach PRL, kiedy zgoda na nowy kościół nie była łatwa do zdobycia. Geometria budynku nie jest przypadkowa: trójkąt i sześciokąt mają tu znaczenie symboliczne i trafiły nawet do logo parafii. Dolny kościół mieści około 600 osób i służy też spotkaniom poza liturgią, a górny jest wielokrotnie większy. Plac Konfederacji leży na Starych Bielanach, przy osiedlu Zdobycz Robotnicza, kilka minut spacerem od stacji metra Stare Bielany. Gdy staniesz na placu, przyjrzyj się dachowi i ścianom – z wielu miejsc widać, że cała bryła składa się z powtarzanych trójkątów.

**Źródła:**

- https://pl.wikipedia.org/wiki/Kościół_św._Zygmunta_w_Warszawie

### Kościół św. Marii Magdaleny na Wawrzyszewie

**SMS** (225 znaków):

> Kościół św. Marii Magdaleny na Wawrzyszewie zbudowano w latach 1543–1548. Ufundował go Baltazar Smosarski, lekarz króla Zygmunta Starego. To jedna z niewielu pamiątek po dawnej wsi – starsza od bloków dookoła o ponad 400 lat.

**Czytaj więcej** (96 słów):

Parafię erygował w 1542 r. biskup Benedykt Izdbieński, choć kościół stał we wsi już przed 1446 r. Obecna świątynia łączy cechy późnego renesansu i baroku mazowieckiego. W XVIII wieku przedłużono nawę, w 1830 r. dobudowano kruchtę, a w 1870 r. zakrystię. W ołtarzu głównym z XVIII wieku jest obraz modlącej się Marii Magdaleny i figura św. Wawrzyńca; imię Wawrzyniec kryje się też w nazwie Wawrzyszewa. Warto zerknąć na flamandzki żyrandol z 1894 r. i epitafia w kruchcie. Obok leży cmentarz wawrzyszewski, założony w 1830 r. dla mieszkańców Wawrzyszewa i Chomiczówki. Kościół jest wpisany do rejestru zabytków.

**Źródła:**

- https://pl.wikipedia.org/wiki/Kościół_św._Marii_Magdaleny_w_Warszawie
- https://pl.wikipedia.org/wiki/Wawrzyszew_(Warszawa)

## Część B – burmistrz Grzegorz Pietruczuk

### Ton wypowiedzi (na podstawie publicznych źródeł)

Uwaga o źródłach: profili Facebook / X (@GPietruczuk) / Instagram nie dało się odczytać bezpośrednio (wymagają logowania). Opis opiera się na wywiadach, komunikatach urzędu dzielnicy i wpisie z mediów społecznościowych zacytowanym przez TVN Warszawa. Przed użyciem warto, żeby ktoś z urzędu potwierdził styl.

- **Powitanie:** formalne i z szacunkiem – „Szanowni Państwo”, „Szanowni Mieszkańcy Bielan”. Zwroty do odbiorców w 2. osobie liczby mnogiej („Wasze”, „Waszą”), często wielką literą.
- **Wspólnotowe „my”:** „nasza dzielnica”, „razem z mieszkańcami”, „mała ojczyzna”. Mieszkańcy jako partnerzy, a nie petenci.
- **Formalność:** półoficjalna. Słownictwo samorządowe miesza się z potocznymi obrazami; ton pewny siebie, ale uprzejmy, z podkreślaniem pracy zespołu.
- **Długość zdań:** przeważnie krótkie zdania oznajmujące, czasem jednowyrazowe („Niestety.”). Dłuższe zdania pojawiają się przy wyliczaniu inwestycji.
- **Czasowniki działania:** „Dbamy o…”, „Inwestujemy w…”, „Stawiamy na…”, „Modernizujemy…”.
- **Wdzięczność i gratulacje:** „Serdecznie gratuluję…!”, podziękowania „za pasję” i „serce” – tu pojawiają się wykrzykniki.
- **Empatia i osobisty ton:** „doskonale rozumiem”, przyznaje, że sam odczuwa problem, o którym piszą mieszkańcy.
- **Typowe tematy:** place zabaw, szkoły i sport szkolny, seniorzy, zieleń i retencja wody, drogi; bielańskie korzenie (urodzony w Szpitalu Bielańskim, szkoły na Bielanach).
- **Konkret:** chętnie podaje liczby, adresy i przykłady zamiast ogólników.
- **Emoji:** w dostępnych tekstach brak. Zalecenie dla gry: bez emoji. Nie używać też hasła „Razem dla Bielan” – to nazwa stowarzyszenia i komitetu wyborczego, więc ma charakter polityczny.

**Źródła tonu:**

- https://bielany.um.warszawa.pl/-/rozmowa-burmistrz-pietruczuk-122024
- https://wsm.pl/z-burmistrzem-bielan-grzegorzem-pietruczukiem-o-bielanskich-korzeniach-i-ambitnych-dzialaniach/
- https://tvn24.pl/tvnwarszawa/bielany/warszawa-mieszkancy-bielan-skarza-sie-na-odor-st9188809
- https://bielany.um.warszawa.pl/-/gala-edukacji-2026
- https://bielany.um.warszawa.pl/-/umowa-modernizacja-skalbmierska
- https://razemdlabielan.waw.pl/zarzad-dzielnicy-wybrany-kilka-slow-od-burmistrza-grzegorza-pietruczuka/

### WERSJA ROBOCZA – do akceptacji burmistrza/urzędu; w grze oznaczone jako wiadomość w grze, nie oficjalne stanowisko

Zasady tych tekstów: nic politycznego ani wyborczego, żadnych obietnic, żadnych wymyślonych wydarzeń, nie są to prawdziwe wypowiedzi burmistrza. W grze każda z tych wiadomości ma etykietę „wiadomość w grze”. Wszystkie miejsca leżą na Bielanach.

**Powitanie** (215 znaków, `mayor-welcome`):

> Szanowni Państwo, witam serdecznie na Bielanach! Cieszę się, że odwiedzacie naszą dzielnicę. Mamy tu las w środku miasta, metro pod ręką i mnóstwo zieleni. Rozglądajcie się i dbajmy razem o naszą wspólną przestrzeń.

**Zaproszenie 1 – Las Bielański** (198 znaków, `mayor-invite-las-bielanski`):

> Szanowni Państwo, polecam spacer po Lesie Bielańskim. To rezerwat ze starymi dębami, tuż przy klasztorze Kamedułów. Prosimy chodzić ścieżkami – ten las to nasz wspólny skarb i dbamy o niego wszyscy.

**Zaproszenie 2 – wzgórze kamedulskie** (171 znaków, `mayor-invite-kameduli`):

> Zapraszam na wzgórze kamedulskie! Kościół, dawne eremy i grób Stanisława Staszica to kawał historii Warszawy. Polecam szczególnie jesienią, gdy las dookoła robi się złoty.

**Zaproszenie 3 – Stawy Brustmana** (159 znaków, `mayor-invite-stawy-brustmana`):

> Serdecznie zapraszam nad Stawy Brustmana na Wawrzyszewie. Woda i zieleń między osiedlami to dobre miejsce na chwilę oddechu. Warto tu zajrzeć w drodze z metra.

**Zaproszenie 4 – Olszyna** (171 znaków, `mayor-invite-olszyna`):

> Zapraszam do Olszyny! To zespół przyrodniczo-krajobrazowy, w którym zieleń i woda tworzą spokojny zakątek naszej dzielnicy. Idealne miejsce na niedzielny spacer z rodziną.

**Zaproszenie 5 – Park Młociński** (157 znaków, `mayor-invite-park-mlocinski`):

> Szanowni Państwo, polecam Park Młociński na północy Bielan. Dużo zieleni, cisza i miejsce na długi spacer po pracy. Zajrzyjcie, zanim jesień zabierze liście!

**Podziękowanie po dostawie 1** (161 znaków, `mayor-thanks-delivery-1`):

> Dziękuję za sprawną dostawę! Dzięki solidnej codziennej pracy na Bielanach żyje się wygodniej. Proszę uważać na pieszych i rowerzystów – do zobaczenia na trasie.

**Podziękowanie po dostawie 2** (169 znaków, `mayor-thanks-delivery-2`):

> Paczka dotarła na czas – serdecznie dziękuję! Kurierzy znają nasze ulice jak mało kto. Proszę pamiętać o odpoczynku, a w przerwie może krótki spacer po Lesie Bielańskim?
