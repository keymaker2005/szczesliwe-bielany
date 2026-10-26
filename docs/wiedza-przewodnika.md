# Baza wiedzy przewodnika – Szczęśliwe Bielany

Stan: 26.10.2026. Baza dla czatu z przewodnikiem (krok 4.3). Tylko fakty ze źródeł podanych przy każdym haśle (Wikipedia, strony instytucji). Czego nie da się potwierdzić, tu nie ma, a przewodnik mówi wtedy „nie wiem”. Bez polityki i bez danych osobowych żyjących osób.

Jak to działa: `node tools/wiedza-przewodnika.mjs --docs` odświeża sekcję landmarków z js/guide-texts.js (nie edytuj jej ręcznie), a bez `--docs` składa instrukcje (worker/prompts/przewodnik.md) i tę bazę w plik worker/src/wiedza-przewodnika.js. Hasła ogólne poniżej edytujesz ręcznie; każde ma wiersz „Źródła:”.

## Landmarki (12 miejsc w grze; `id` służy do przycisku „Nawiguj”)

<!-- LANDMARKI:START (generowane przez tools/wiedza-przewodnika.mjs --docs z js/guide-texts.js) -->

### Klasztor Kamedułów [id: kameduly]
Jesteś przy klasztorze Kamedułów. Pustelnię ufundował tu w 1639 r. król Władysław IV, a od białych habitów mnichów wzięła się nazwa Bielany. Przy północnej ścianie kościoła spoczywa Stanisław Staszic – sam wybrał to miejsce.

Kameduli to zakon pustelników: każdy mnich mieszkał w osobnym domku, czyli eremie, a z braćmi spotykał się głównie na modlitwie. Pierwszy, drewniany zespół powstał jako królewskie wotum Władysława IV za zwycięstwo w wojnie smoleńskiej. Murowany kościół Niepokalanego Poczęcia NMP wznoszono etapami w latach 1669–1710, a w XVIII wieku przebudowano go jeszcze raz. Historycy sztuki łączą projekt z Włochem Izydorem Affaitatim, a późnobarokową fasadę być może z Gaetanem Chiaverim. Do dziś stoi kilkanaście eremów ustawionych w równych rzędach. Stanisław Staszic, zmarły w 1826 r., chciał spocząć w ziemi za kościołem, a nie w krypcie. W podziemiach odbywają się dziś koncerty i spektakle.

Źródła: https://en.wikipedia.org/wiki/Camaldolese_Church,_Warsaw https://pl.wikipedia.org/wiki/Rezerwat_przyrody_Las_Bielański https://www.gov.pl/web/zsckr-sejny/na-grobie-stanislawa-staszica

### Las Bielański [id: las-bielanski]
Witaj w Lesie Bielańskim! To kawałek dawnej Puszczy Mazowieckiej w środku miasta, rezerwat przyrody od 1973 r. Rosną tu stare dęby i graby, a symbolem lasu jest dzięcioł czarny – nasłuchuj jego bębnienia.

Rezerwat zajmuje około 130 ha na skarpie i tarasie Wisły. Wyżej dominuje grąd, czyli las liściasty z dębami, grabami, lipami i klonami, a niżej, bliżej rzeki, łęg z jesionami, wiązami i olchami. Niektóre dęby mają ponad 3 m obwodu. Warszawiacy wypoczywają tu od XVII wieku, a za Stanisława Augusta narodziła się tradycja zielonoświątkowych festynów przy klasztorze. Po włączeniu Bielan do miasta działał tu nawet park rozrywki z karuzelą, ale tłumy niszczyły las, więc w 1973 r. utworzono rezerwat. Zimą nocują tu ponad sto tysięcy gawronów i kawek. Na Polkowej Górze jest punkt widokowy. Prosimy: trzymaj się ścieżek.

Źródła: https://pl.wikipedia.org/wiki/Rezerwat_przyrody_Las_Bielański https://muzeumwarszawy.pl/en/for-here-and-to-go-warsaws-cuisine-audioguide/7-a-picnic-by-the-vistula-river

### AWF [id: awf]
Przed Tobą AWF, dawny Centralny Instytut Wychowania Fizycznego. Zajęcia ruszyły tu w 1929 r. w gmachach Edgara Norwertha. Architekt wytyczył dziedziniec wokół starej topoli czarnej – dziś to pomnik przyrody.

Uczelnia przy Marymonckiej 34 powstała jako CIWF, nowoczesna szkoła dla nauczycieli wychowania fizycznego i trenerów. Kamień węgielny położono w 1928 r., zajęcia ruszyły w listopadzie 1929 r., a imię Józefa Piłsudskiego uczelnia dostała w 1935 r. Kampus zaprojektował prof. Edgar Norwerth z Politechniki Warszawskiej: modernistyczne gmachy otaczają boiska, hale i zieleń na skraju Lasu Bielańskiego. Ciekawostka: w chwili otwarcia był to jeszcze teren gminy Młociny, a do Warszawy włączono go dopiero w 1930 r. Topola czarna, wokół której Norwerth zaplanował dziedziniec, miała wtedy około 50 lat. W 2009 r. uznano ją za pomnik przyrody, więc rośnie tu dłużej niż stoją budynki.

Źródła: https://pl.wikipedia.org/wiki/Akademia_Wychowania_Fizycznego_Józefa_Piłsudskiego_w_Warszawie

### UKSW, kampus Dewajtis [id: uksw]
To kampus Dewajtis Uniwersytetu Kardynała Stefana Wyszyńskiego. Uczelnia działa od 1999 r., a jej poprzedniczka, ATK, od 1954 r. Tu mieści się rektorat, biblioteka i muzeum uczelni, otwarte w 2020 r. w zabytkowej kaplicy.

UKSW wyrosła z Akademii Teologii Katolickiej, powołanej w 1954 r. z wydziałów teologicznych Uniwersytetu Warszawskiego i Jagiellońskiego. W 1999 r. ATK przekształcono w uniwersytet imienia prymasa Stefana Wyszyńskiego. Kampus przy Dewajtis sąsiaduje z zespołem pokamedulskim i otaczają go drzewa Lasu Bielańskiego. W 2003 r. kardynał Józef Glemp przekazał uczelni grunt, na którym stanęły nowe budynki. Dziś pracuje tu rektorat, biblioteka główna, wydawnictwo i dziekanaty kilku wydziałów, a w Starym Budynku działa Muzeum UKSW. Drugi bielański kampus jest przy ul. Wóycickiego. Ciekawostka: „Dewajtis” to tytuł powieści Marii Rodziewiczówny z 1889 r., której bohaterem jest prastary dąb – pasuje do miejsca pełnego starych dębów.

Źródła: https://uksw.edu.pl/en/studenci/kampusy https://muzea.waw.pl/en/museums/uksw-university-museum/ https://en.wikipedia.org/wiki/Cardinal_Stefan_Wyszy%C5%84ski_University_in_Warsaw

### Metro Stare Bielany [id: stare-bielany]
Stacja Stare Bielany działa od 25 października 2008 r. Zaprojektowała ją pracownia AiB (Zdzisław Kostrzewa), a wnętrza prof. Mirosław Duchowski i Agnieszka Sadkowska-Penczonek. Zwróć uwagę na jasne drewno na peronie.

Stacja leży płytko, nieco ponad 7 m pod ziemią. Cały odcinek od Słodowca do Młocin budowano metodą odkrywkową, czyli w wykopie, który potem przykryto. W projekcie nosiła nazwę „Bielany”, a na „Stare Bielany” zmieniono ją w 2006 r., żeby lepiej wskazywała okolicę. Otwarto ją jesienią 2008 r. razem z Wawrzyszewem i Młocinami, co doprowadziło pierwszą linię do jej północnego krańca. Wnętrze łączy szare posadzki i ściany z ciepłym, jasnym drewnem, które wyróżnia ją wśród stacji M1. Na górze masz kilka minut spaceru do pl. Konfederacji, AWF i Lasu Bielańskiego. Ciekawostka z gry: właśnie tutaj leży punkt zerowy całej mapy.

Źródła: https://pl.wikipedia.org/wiki/Stare_Bielany_(stacja_metra)

### Metro Wawrzyszew [id: wawrzyszew]
Stacja Wawrzyszew działa od 25 października 2008 r., a zaprojektował ją Andrzej M. Chołdzyński. Wyjście w stronę bazaru Wolumen wyróżnia się czerwonym kolorem – łatwo się przy nim umówić.

Wawrzyszew to jedna z najstarszych bielańskich miejscowości: wieś wzmiankowana już w XIV wieku, której nazwa pochodzi od imienia Wawrzyniec. Dziś to przede wszystkim osiedle bloków zbudowane w latach 1973–1978 dla około 20 tysięcy mieszkańców. Stacja metra jest jednopoziomowa, z peronami po obu stronach torów, i podobnie jak sąsiednie powstała w otwartym wykopie. Za stacją nie ma rozjazdu, więc pociągi zawracają dopiero za Młocinami. Wyjście od strony Wolumenu prowadzi prosto do popularnego bazaru, gdzie kupisz warzywa, ubrania i drobiazgi. W okolicy znajdziesz też zabytkowy kościół św. Marii Magdaleny i Stawy Brustmana, wykopane w XIX wieku przy osuszaniu terenu.

Źródła: https://pl.wikipedia.org/wiki/Wawrzyszew_(stacja_metra) https://en.wikipedia.org/wiki/Wawrzyszew_metro_station https://pl.wikipedia.org/wiki/Wawrzyszew_(Warszawa)

### Metro Młociny [id: mlociny]
Młociny to północna stacja końcowa linii M1, otwarta w 2008 r. Projekt przygotowała pracownia AMC Andrzeja M. Chołdzyńskiego z Metroprojektem. Za peronami są tory odstawcze, gdzie pociągi nocują i przechodzą drobne naprawy.

Stację zaprojektowano tak, by w przyszłości linię można było przedłużyć: na północ w stronę Łomianek, na zachód ku Chomiczówce albo na wschód, pod Mostem Marii Skłodowskiej-Curie. Na razie to koniec trasy. Za peronami ciągną się tory odstawcze, na których pociągi zawracają w stronę Kabat, są sprzątane i czekają na poranny wyjazd. Ciekawostka z budowy: roboty ziemne ruszyły z około dwumiesięcznym opóźnieniem, bo trwał spór o kiosk stojący na placu budowy. Nad stacją działa wielki węzeł przesiadkowy z pętlą tramwajową i autobusową, dworcem autobusów podmiejskich i parkingiem P+R na około 900 aut. Stąd łatwo dojechać na Białołękę, Bemowo i pod Warszawę.

Źródła: https://pl.wikipedia.org/wiki/Młociny_(stacja_metra)

### Szpital Bielański [id: szpital-bielanski]
Szpital Bielański przy Cegłowskiej 80 otwarto w grudniu 1960 r. Projektowali go Julian Sadłowski i Leopold Koehler w stylu socrealistycznym. Od 1999 r. nosi imię ks. Jerzego Popiełuszki.

Budowę rozpoczęto w 1953 r. Była to największa szpitalna inwestycja Warszawy w czasach planu sześcioletniego, od początku pomyślana też jako miejsce kształcenia lekarzy. Pierwotnie planowano około 600 łóżek, dziś jest ich ponad 700. W latach 80. dobudowano trzykondygnacyjny pawilon. W 2021 r. szpital połączył się ze Szpitalem Specjalistycznym „Inflancka”, a w 2022 r. otwarto nowe skrzydło. Monumentalna, symetryczna bryła z czasów socrealizmu dobrze odróżnia się od okolicznych bloków. Imię patrona, ks. Jerzego Popiełuszki, szpital nosi od 14 grudnia 1999 r. W grze to miejsce, gdzie warto zwolnić: karetki mają tu zawsze pierwszeństwo, a przed wjazdem na podjazd trzeba uważać na pieszych.

Źródła: https://pl.wikipedia.org/wiki/Szpital_Bielański

### Galeria Młociny [id: galeria-mlociny]
Młociny to największy węzeł przesiadkowy Warszawy: metro, tramwaje i autobusy, także podmiejskie. Obok stoi Galeria Młociny, otwarta 23 maja 2019 r., z ogrodem na dachu – dobre miejsce, by spojrzeć na okolicę z góry.

Węzeł nad stacją metra ma trzy poziomy i obsługuje pasażerów z Bielan, Bemowa, Białołęki i miejscowości pod Warszawą. Parking P+R mieści około 900 samochodów, jest też parking rowerowy. Galerię Młociny zaprojektowały pracownie Kuryłowicz & Associates i Chapman Taylor, a budowa trwała od października 2016 r. do maja 2019 r. W środku jest około 200 sklepów, kilkadziesiąt restauracji i kino, a całe drugie piętro zajmuje strefa jedzenia i rozrywki połączona z zielonym dachem. Młociny to dawna podwarszawska miejscowość: jeszcze w 1930 r. istniała osobna gmina Młociny, z której do miasta włączono między innymi teren dzisiejszej AWF.

Źródła: https://pl.wikipedia.org/wiki/Galeria_Młociny https://pl.wikipedia.org/wiki/Młociny_(stacja_metra) https://pl.wikipedia.org/wiki/Akademia_Wychowania_Fizycznego_Józefa_Piłsudskiego_w_Warszawie

### Kościół św. Zygmunta [id: sw-zygmunt]
Kościół św. Zygmunta na pl. Konfederacji zbudowano w latach 1976–1980 według projektu Zbigniewa Pawelskiego. Plan oparto na sześciokącie z trójkątów równobocznych o boku 7,5 m. Świątynia ma dwa poziomy: kościół dolny i górny.

Kościół poświęcono 8 grudnia 1980 r., a budowę prowadził ks. Ryszard Grygielka. Powstawał w czasach PRL, kiedy zgoda na nowy kościół nie była łatwa do zdobycia. Geometria budynku nie jest przypadkowa: trójkąt i sześciokąt mają tu znaczenie symboliczne i trafiły nawet do logo parafii. Dolny kościół mieści około 600 osób i służy też spotkaniom poza liturgią, a górny jest wielokrotnie większy. Plac Konfederacji leży na Starych Bielanach, przy osiedlu Zdobycz Robotnicza, kilka minut spacerem od stacji metra Stare Bielany. Gdy staniesz na placu, przyjrzyj się dachowi i ścianom – z wielu miejsc widać, że cała bryła składa się z powtarzanych trójkątów.

Źródła: https://pl.wikipedia.org/wiki/Kościół_św._Zygmunta_w_Warszawie

### Kościół św. Marii Magdaleny [id: maria-magdalena]
Kościół św. Marii Magdaleny na Wawrzyszewie zbudowano w latach 1543–1548. Ufundował go Baltazar Smosarski, lekarz króla Zygmunta Starego. To jedna z niewielu pamiątek po dawnej wsi – starsza od bloków dookoła o ponad 400 lat.

Parafię erygował w 1542 r. biskup Benedykt Izdbieński, choć kościół stał we wsi już przed 1446 r. Obecna świątynia łączy cechy późnego renesansu i baroku mazowieckiego. W XVIII wieku przedłużono nawę, w 1830 r. dobudowano kruchtę, a w 1870 r. zakrystię. W ołtarzu głównym z XVIII wieku jest obraz modlącej się Marii Magdaleny i figura św. Wawrzyńca; imię Wawrzyniec kryje się też w nazwie Wawrzyszewa. Warto zerknąć na flamandzki żyrandol z 1894 r. i epitafia w kruchcie. Obok leży cmentarz wawrzyszewski, założony w 1830 r. dla mieszkańców Wawrzyszewa i Chomiczówki. Kościół jest wpisany do rejestru zabytków.

Źródła: https://pl.wikipedia.org/wiki/Kościół_św._Marii_Magdaleny_w_Warszawie https://pl.wikipedia.org/wiki/Wawrzyszew_(Warszawa)

### Stadion Hutnika [id: hutnik]
Jesteś przy Stadionie Hutnika przy Marymonckiej 42. Obiekt przebudowano w latach 2019–2021: zniknęły ziemne nasypy, a po bokach murawy stanęły dwie zadaszone trybuny na ok. 1300 widzów. Trybuny mają klubowe barwy: pomarańczową i czarną.

Stary stadion z 1985 r. miał trybuny tylko po jednej stronie i bieżnię. Nowy, otwarty 25 sierpnia 2021 r., jest czysto piłkarski. Zachodnia trybuna ma pomarańczowy beton i czarny dach, wschodnia odwrotnie. Pod trybunami są szatnie, pomieszczenia sędziów i część konferencyjna, a ławki rezerwowych i miejsca dla prasy i gości stoją po zachodniej stronie. Murawa ma drenaż i podgrzewanie, a cztery maszty oświetleniowe dają 500 luksów. Obok leżą dwa boiska treningowe ze sztuczną nawierzchnią i korty tenisowe, całością zarządza ośrodek Aktywna Warszawa.

Źródła: https://stadiumdb.com/stadiums/pol/osrodek_hutnik_warszawa https://en.wikipedia.org/wiki/Hutnik_Warsaw https://pik.warszawa.pl/miejsca/osrodek-hutnik/

<!-- LANDMARKI:END -->

## Dzielnica i osiedla

### Dzielnica Bielany
Bielany to jedna z 18 dzielnic Warszawy, w lewobrzeżnej części miasta. Powierzchnia 32,34 km², ludność 129 774 osób (stan na 1 stycznia 2026). Dzielnica wyodrębniła się z Żoliborza w 1994 r. Obszary Miejskiego Systemu Informacji (MSI) w dzielnicy: Chomiczówka, Huta, Las Bielański, Marymont-Kaskada, Marymont-Ruda, Młociny, Piaski, Placówka, Radiowo, Stare Bielany, Słodowiec, Wawrzyszew, Wólka Węglowa i Wrzeciono. W drugiej połowie XVII w. sprowadzono tu kamedułów. W 1916 r. granice Warszawy poszerzono m.in. o Stare Bielany, Marymont i Słodowiec. W okresie międzywojennym powstały lotnisko bielańskie i Akademia Wychowania Fizycznego, a dzielnica dostała połączenie tramwajowe z centrum.
Źródła: https://pl.wikipedia.org/wiki/Bielany_(Warszawa)

### Stare Bielany (osiedle)
Obszar MSI w dzielnicy Bielany. Granice według MSI: od północnego wschodu ul. Marymoncka, od północnego zachodu ul. Lindego, Kasprowicza, Oczapowskiego i al. Reymonta, od południa ul. Broniewskiego i Żeromskiego, od wschodu ul. Jarzębskiego. Włączony do Warszawy 30 września 1930 r. Międzywojenne osiedle Zdobycz Robotnicza powstało w latach 1926–1932, a po II wojnie światowej na wolnej przestrzeni zbudowano bloki. W 2012 r. znaczną część obszaru wpisano do gminnej ewidencji zabytków jako układ urbanistyczny. Ważniejsze obiekty: plac Konfederacji, kościół św. Zygmunta, Szpital Bielański, Lasek Lindego, Akademia Wychowania Fizycznego im. Józefa Piłsudskiego, stacja metra Stare Bielany.
Źródła: https://pl.wikipedia.org/wiki/Stare_Bielany

### Wawrzyszew (osiedle)
Obszar MSI; granice: ul. Kasprowicza (północ), al. Reymonta i ul. Oczapowskiego (wschód), ul. Wólczyńska z cmentarzem Wawrzyszewskim (południe), ul. Nocznickiego (zachód). W XIV w. wzmiankowana jako dawna wieś szlachecka. Kościół św. Marii Magdaleny wzniesiono w latach 1543–1548. W 1819 r. folwark przejął Instytut Agronomiczny. W 1830 r. założono przykościelny cmentarz. Wieś należała do gminy Młociny, a w 1951 r. tereny przyłączono do Warszawy. W latach 70. XX w. zburzono niemal całą dawną zabudowę wsi; w latach 1973–1978 powstało osiedle mieszkaniowe dla ok. 20 tys. mieszkańców. Z dawnej wsi zostały kościół św. Marii Magdaleny, cmentarz Wawrzyszewski i przydrożne kapliczki. 3 sierpnia 1944 r. Niemcy dokonali pacyfikacji wsi.
Źródła: https://pl.wikipedia.org/wiki/Wawrzyszew_(Warszawa)

### Młociny (osiedle)
Osiedle i obszar MSI na północy dzielnicy; graniczy z gminą Łomianki, Wisłą, osiedlem Wrzeciono, Lasem Bielańskim i Wólką Węglową. Pierwsza wzmianka o osadzie pochodzi z XIV w.; od 1580 r. wieś królewska. W latach 1752–1758 Henryk von Brühl zbudował tu pałac. W 1907 r. miasto założyło park Młociński na ok. 110 ha lasu. W 1938 r. zbudowano lotnisko Bielany; zlikwidowano je w 1951 r., gdy Młociny weszły w granice Warszawy (14 maja 1951 r.). Osiedle Młociny budowano w latach 1961–1967. Ważniejsze obiekty: pałac Brühla, Instytut Sportu, Uniwersytet Kardynała Stefana Wyszyńskiego, zespół przyrodniczo-krajobrazowy Dęby Młocińskie.
Źródła: https://pl.wikipedia.org/wiki/Młociny

### Chomiczówka (osiedle)
Obszar MSI w południowej części dzielnicy. Nazwa pochodzi od rodziny Chomiczów, właścicieli okolicznych gruntów (Józef Chomicz założył w 1909 r. firmę ogrodniczą Bracia Chomicz). Granice: ul. Wólczyńska (północ), ul. Powstańców Śląskich i al. Reymonta (wschód), ul. Księżycowa (południe), fosa fortu Wawrzyszew (zachód). Od 1974 r. zburzono dawną zabudowę i zbudowano osiedle (projekt H. Drewiczewskiej, D. Małkowskiej i J. Szmidta; inwestor Warszawska Spółdzielnia Mieszkaniowa); pierwsze bloki miały od 9 do 16 kondygnacji. Bloki stoją w pierścieniach, których wnętrza zajmują tereny zielone. Obszar do gminy Warszawa-Bielany przeniesiono z Żoliborza 19 czerwca 1994 r.
Źródła: https://pl.wikipedia.org/wiki/Chomiczówka

### Piaski (osiedle)
Obszar MSI na wysokości 109 m n.p.m. Granice: al. Armii Krajowej (wschód), ul. gen. Maczka (południe), ul. Broniewskiego (północ), al. Reymonta (zachód). Nazwa pochodzi od piasków, które zostały po wyjałowieniu gleb. Do 1916 r. miejscowość nazywała się Młociny B; 1 kwietnia 1916 r. włączono ją do Warszawy, a w 1918 r. nazwano Piaskami, m.in. żeby nie mylić jej z Młocinami. Większą część terenu zajmuje zabudowa Warszawskiej Spółdzielni Mieszkaniowej.
Źródła: https://pl.wikipedia.org/wiki/Piaski_(Warszawa)

### Marymont-Ruda i Marymont-Kaskada (osiedla)
Marymont-Ruda to obszar MSI w południowo-wschodniej części Bielan, na tarasie zalewowym Wisły, u podnóża skarpy warszawskiej. Granice: ul. Podleśna i Gwiaździsta (północ), Wisła (wschód), al. Armii Krajowej i most gen. Grota-Roweckiego (południe), ul. Klaudyny (zachód). W 1412 r. wspomniano Rudny Młyn nad Rudawką; król Władysław IV przekazał młyn kamedułom z Bielan (1641 lub 1639). 1 kwietnia 1916 r. Rudę włączono do Warszawy. 20 grudnia 1924 r. uruchomiono linię tramwajową ulicami Potocką i Marii Kazimiery. Budowa osiedla Ruda ruszyła w 1973 r. Marymont-Kaskada sąsiaduje z Rudą od zachodu; osiedle Kaskada zaprojektowano jako zabudowę niską, jednorodzinną. Obszar nie ma własnej stacji metra; najbliższe to Marymont i Plac Wilsona. Stacja „Ruda” jest tylko planowana w ramach linii M4.
Źródła: https://pl.wikipedia.org/wiki/Marymont-Ruda

## Ulice, metro, tramwaje

### Główne ulice
Z granic osiedli wynika, że ważne ulice to: ul. Kasprowicza, ul. Żeromskiego, ul. Broniewskiego, ul. Marymoncka, al. Reymonta, ul. Wólczyńska, ul. Księżycowa, al. Armii Krajowej (Trasa Armii Krajowej) i Wisłostrada. Pętla autobusowo-tramwajowa Metro Młociny leży przy al. gen. Marii Wittek i ul. Zgrupowania AK „Kampinos”; pod tym ostatnim adresem (nr 15) stoi Galeria Młociny. Stacja metra Stare Bielany jest przy ul. Kasprowicza. Baza nie zawiera opisu przebiegu ani długości tych ulic.
Źródła: https://pl.wikipedia.org/wiki/Stare_Bielany https://pl.wikipedia.org/wiki/Wawrzyszew_(Warszawa) https://pl.wikipedia.org/wiki/Marymont-Ruda https://pl.wikipedia.org/wiki/Chomiczówka https://pl.wikipedia.org/wiki/Piaski_(Warszawa) https://pl.wikipedia.org/wiki/Tramwaje_w_Warszawie https://pl.wikipedia.org/wiki/Galeria_M%C5%82ociny

### Metro, linia M1
Pierwszy odcinek linii M1 (Kabaty–Politechnika) otwarto 7 kwietnia 1995 r. Odcinek na północ od placu Wilsona otwierano etapami: Plac Wilsona–Marymont 29 grudnia 2006 r., Marymont–Słodowiec 23 kwietnia 2008 r., Słodowiec–Młociny 25 października 2008 r. Stacje na Bielanach, od centrum: Marymont (otwarta 29 grudnia 2006 r.), Słodowiec (23 kwietnia 2008 r.), Stare Bielany, Wawrzyszew i Młociny (wszystkie trzy 25 października 2008 r.). Linia M1 ma 23,1 km i 21 stacji. Młociny to ostatnia stacja linii od północy.
Źródła: https://pl.wikipedia.org/wiki/Metro_w_Warszawie

### Tramwaje na Bielanach
Pętla Metro Młociny (al. gen. Marii Wittek / ul. Zgrupowania AK „Kampinos”) ma 6 torów postojowych i obsługują ją linie 2, 6, 26 i 33. Linię 2 uruchomiono 21 stycznia 2013 r. na trasie Metro Młociny–Stare Świdry. Linia 17 kursowała początkowo z pętli Metro Młociny; po 24 grudnia 2014 r. przeniesiono ją na pętlę Tarchomin Kościelny. Pętla Metro Marymont (ul. Słowackiego / ul. Gdańska) obsługuje linię 17 (kursy skrócone) i 27, a pętla Marymont-Potok (ul. Mickiewicza / ul. Potocka) linię 15. Pierwszą linię tramwajową na Marymont-Rudę (ulicami Potocką i Marii Kazimiery) uruchomiono 20 grudnia 1924 r. Aktualnych rozkładów baza nie zawiera; sprawdź w ZTM Warszawa.
Źródła: https://pl.wikipedia.org/wiki/Tramwaje_w_Warszawie https://pl.wikipedia.org/wiki/Marymont-Ruda

## Przyroda

### Lasy i parki na Bielanach
Las Bielański to rezerwat przyrody (opis w landmarku powyżej). Park Młociński (Las Młociny) to park leśny w dzielnicy Bielany, ok. 102 ha, na lewym brzegu Wisły. Rosną tu sosny, dęby, olchy i jesiony; ze strony Puszczy Kampinoskiej zaglądają dziki, sarny i łosie. Miasto kupiło ten teren w 1907 r. Park leży w otulinie Kampinoskiego Parku Narodowego i w Warszawskim Obszarze Chronionego Krajobrazu, a na jego terenie jest odcinek skarpy warszawskiej. Są dwie oznakowane pętle, plac zabaw, ścieżka sprawnościowa i dwie drewniane platformy widokowe. W lesie leżą groby żołnierzy 21. Pułku Ułanów poległych w bitwie pod Łomiankami, a na starych drzewach widać ślady kul z 1939 r. i Powstania Warszawskiego. Lasek Lindego jest wymieniony wśród ważniejszych obiektów Starych Bielan (baza nie ma o nim więcej szczegółów).
Źródła: https://pl.wikipedia.org/wiki/Park_Młociński https://pl.wikipedia.org/wiki/Stare_Bielany https://pl.wikipedia.org/wiki/Rezerwat_przyrody_Las_Bielański

### Lasek na Kole (to nie są Bielany)
Lasek na Kole leży w dzielnicy Wola (osiedle Koło), nie na Bielanach: otaczają go al. Prymasa Tysiąclecia, ul. Ostrowiecka, Dobrogniewa i Dalibora. Ma ok. 43–48 ha, rosną w nim głównie sosny i robinie akacjowe, a powstał w okresie międzywojennym na dawnych bagnach nad Rudawką. W grze go nie ma. Jeśli ktoś pyta o lasy Bielan, wskaż Las Bielański i Park Młociński.
Źródła: https://pl.wikipedia.org/wiki/Lasek_na_Kole

### Wisła i skarpa warszawska
Skarpa warszawska to wysoki zachodni brzeg Wisły w Warszawie, krawędź erozyjna wysoczyzny Równiny Warszawskiej. Jej wysokość się zmienia: na Marymoncie ma 6–8 m, a w Lesie Bielańskim przy klasztorze kamedułów ok. 10 m. Przechodzi przez rezerwat Las Bielański, potem przez park Młociński; na północ od kościoła kamedułów zagrażają jej osuwiska. Marymont-Ruda leży niżej, na tarasie zalewowym Wisły, u podnóża skarpy; od wschodu graniczy z Wisłą, a od południa z mostem gen. Grota-Roweckiego. Wzdłuż rzeki biegnie Wisłostrada.
Źródła: https://pl.wikipedia.org/wiki/Skarpa_warszawska https://pl.wikipedia.org/wiki/Marymont-Ruda

## Gra

### Gra „Szczęśliwe Bielany” i telefon
To przeglądarkowa gra 3D osadzona na warszawskich Bielanach (Stare Bielany, Wawrzyszew, Młociny) w słoneczny dzień złotej polskiej jesieni. Dane: ulice, tory i adresy z OpenStreetMap, budynki z modeli 3D GUGiK (LoD1 2024), drzewa z modeli GUGiK. Gracz ma w grze telefon z aplikacjami; jedna z nich to „Przewodnik”, z opisami 12 miejsc ze źródłami i przyciskiem „Nawiguj”, który wyznacza trasę na mapie. Przewodnik wysyła też krótką wiadomość, gdy gracz podejdzie do miejsca. Obecna aplikacja „Czat” to rozmowa z przewodnikiem AI. Gra jest hobbystycznym projektem; to nie jest oficjalna aplikacja żadnej instytucji. Zasady sterowania i misji baza nie opisuje; przewodnik odsyła do samej gry.
Źródła: https://github.com/mrdoob/slop-newyork (oryginał, licencja MIT) https://bielany.zbigniew.ai
