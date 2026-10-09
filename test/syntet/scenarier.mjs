/// Syntetiska samtal som ska röra vid varje verktyg i MAXIMUS.
///
/// Inte påhittade för att vara lätta. Varje samtal är ett ärende någon
/// faktiskt skulle ha: ett kommunalt bolag, ett privat företag, en ledning,
/// en entreprenör. Uppgifterna är hittepå men har rätt form — personnummer
/// med rätt kontrollsiffra hade varit att skriva riktiga personnummer, så de
/// är uppenbart falska men rätt formade.
///
/// `ror` säger vilka verktyg samtalet ska väcka. Efteråt går det att se vad
/// som aldrig rördes — och det som aldrig rörs är det som aldrig provas.

export const SCENARIER = [
  // ── Kommunala bolag ────────────────────────────────────────────────────
  {
    id: 'bostadsbolag-storning',
    om: 'Kommunalt bostadsbolag, störningsärende som glider mot socialtjänst',
    lage: 'lokalt', webb: 'auto',
    ror: ['maskering', 'klassning-2', 'socialtjanst', 'lagen.nu', 'ton-personlig'],
    turer: [
      'Jag jobbar på Kvarnby Bostäder AB, org.nr 556712-3344. Vi har en hyresgäst, Ingrid Sjöqvist på Rosenvägen 14 lgh 1203, 19850816-2388, som fått fyra störningsanmälningar sedan i maj. Grannarna säger att det skriks på nätterna. Vad gäller innan vi kan säga upp?',
      'Hon är 82 år och jag misstänker att det handlar om demens snarare än ovilja. Ändrar det något?',
      'Vad säger 12 kap. 42 § jordabalken om detta?',
      'Vem har ansvaret att kontakta socialtjänsten — vi eller grannarna?',
      'Kan du skriva ett utkast till en vänlig första kontakt med henne?',
      'Vad händer om hon inte öppnar dörren?',
    ],
  },
  {
    id: 'energibolag-jav',
    om: 'Kommunalt energibolag, misstänkt jäv i upphandling',
    lage: 'lokalt', webb: 'auto',
    ror: ['klassning-2', 'brott', 'webb', 'granskning', 'lagen.nu'],
    turer: [
      'Jag är inköpschef på Kvarnby Energi AB. En styrelseledamot, Bo Hallgren, sitter också i styrelsen för Hallgren Entreprenad AB som just vann vår upphandling av fjärrvärmeledning på 24 miljoner. Han deltog inte i beslutet men var med på beredningen. Är detta jäv?',
      'Vad säger lagen om offentlig upphandling om detta?',
      'Måste vi avbryta upphandlingen?',
      'Vad är skillnaden mellan jäv enligt kommunallagen och enligt LOU?',
      'Om vi låter det passera, vilket ansvar har jag personligen?',
      'Hur dokumenterar jag detta korrekt?',
      'Skriv ett utkast till en anmälan till vår internrevision.',
    ],
  },
  {
    id: 'va-bolag-miljodom',
    om: 'Kommunalt VA-bolag, miljötillstånd och praxis',
    lage: 'lokalt', webb: 'auto',
    ror: ['lagen.nu-lagrum', 'domstolsverket', 'webb', 'granskning'],
    turer: [
      'Vårt reningsverk har fått ett föreläggande från länsstyrelsen om kväveutsläpp. Vad säger miljöbalken 1998:808 om villkorsändring?',
      'Vad säger 24 kap. 5 § miljöbalken specifikt?',
      'Finns det praxis från Mark- och miljööverdomstolen om kväverening?',
      'Vad har kommit för avgöranden senaste tiden från MÖD?',
      'Hur lång tid har vi på oss att överklaga ett föreläggande?',
    ],
  },
  {
    id: 'fastighetsbolag-ata',
    om: 'Kommunalt fastighetsbolag, ÄTA-tvist med kalkylblad',
    lage: 'lokalt', webb: 'av',
    fil: 'ata.csv',
    ror: ['kalkyl', 'rakning', 'tabell', 'utkast'],
    turer: [
      'Här är våra ÄTA-poster från ombyggnaden av Almbacka skola. Entreprenören vill ha betalt för allt. Vad är den totala summan?',
      'Vilka poster saknar godkännandedatum?',
      'Vad är snittet per godkänd post jämfört med icke godkänd?',
      'Vad gäller för ÄTA enligt AB 04 när skriftligt godkännande saknas?',
      'Skriv ett utkast till svar till entreprenören där vi bestrider de icke godkända posterna.',
    ],
  },
  {
    id: 'avfallsbolag-arbetsmiljo',
    om: 'Kommunalt avfallsbolag, skyddsombuds stopprätt',
    lage: 'lokalt', webb: 'auto',
    ror: ['lagen.nu-lagrum', 'regel-sfs', 'granskning'],
    turer: [
      'Ett skyddsombud på vårt återvinningscentrum har stoppat arbetet vid komprimatorn. Vad säger 6 kap. 7 § i 1977:1160 om det?',
      'Kan vi som arbetsgivare häva stoppet?',
      'Vad kostar det oss om Arbetsmiljöverket ger skyddsombudet rätt?',
      'Vad säger 3 kap. 2 § arbetsmiljölagen om vårt ansvar?',
      'Skriv en kort intern instruktion om hur vi hanterar ett skyddsstopp.',
    ],
  },
  {
    id: 'hamnbolag-statistik',
    om: 'Kommunalt hamnbolag, statistik och nyckeltal',
    lage: 'lokalt', webb: 'auto',
    ror: ['scb', 'kolada', 'kopplingar', 'webb'],
    turer: [
      'Jag ska skriva en omvärldsanalys för Kvarnby Hamn AB. Vilken statistik finns hos SCB om godstransporter?',
      'Vilka nyckeltal finns i Kolada för kommunal näringslivsverksamhet?',
      'Vad är prisbasbeloppet 2026 och varför spelar det roll för våra avgifter?',
      'Hur redovisar vi detta i en styrelserapport?',
    ],
  },

  // ── Privata företag ────────────────────────────────────────────────────
  {
    id: 'byggentreprenor-bedrageri',
    om: 'Byggentreprenör, misstänkt fakturabedrägeri',
    lage: 'lokalt', webb: 'auto',
    ror: ['klassning-2', 'brott', 'maskering', 'webb', 'granskning', 'rubrik'],
    turer: [
      'Jag arbetar på Kvarnby Bygg & Anläggning AB (org.nr 556203-8816) och har hand om leverantörsfakturor. Sedan i mars har vi betalat 14 fakturor till Ferm Konsult & Service, orgnummer 559234-1107, på sammanlagt 1 840 000 kr. Fakturorna säger bara "konsulttjänster enligt överenskommelse". Vår inköpschef Tommy Ferm har samma efternamn.',
      'Företaget registrerades i februari i år. Spelar det roll?',
      'Vem ska jag vända mig till internt?',
      'Vad händer om jag har fel?',
      'Vad gäller för visselblåsning i ett privat bolag av vår storlek?',
      'Vilket skydd har jag mot repressalier?',
      'Skriv ett utkast till en anmälan till styrelsens ordförande.',
      'Hur dokumenterar jag det jag redan sett?',
    ],
  },
  {
    id: 'redovisningsbyra-avvikelser',
    om: 'Redovisningsbyrå, avvikelser i ett kundbokslut',
    lage: 'lokalt', webb: 'av',
    fil: 'kundreskontra.csv',
    ror: ['kalkyl', 'rakning', 'tabell'],
    turer: [
      'Här är kundreskontran för en klient. Vad är totalsumman utestående?',
      'Vilka poster är över 90 dagar gamla?',
      'Vad är medianfordran?',
      'Hur många poster saknar belopp och vad betyder det för summan?',
      'Vad säger bokföringslagen om nedskrivning av osäkra fordringar?',
      'Skriv ett kort PM till klienten.',
    ],
  },
  {
    id: 'vardbolag-lexsarah',
    om: 'Privat vårdbolag, lex Sarah och IVO',
    lage: 'lokalt', webb: 'auto',
    ror: ['klassning-2', 'halsa', 'ivo', 'lagen.nu', 'ton-personlig'],
    turer: [
      'Jag är verksamhetschef på Almbacka Omsorg AB. En undersköterska har rapporterat att en kollega lämnat en brukare, Sven Ohlsson 19850821-2381, ensam i duschen i 40 minuter. Han har demens. Är detta lex Sarah?',
      'Vad är skillnaden mellan lex Sarah och lex Maria?',
      'Vilken statistik har IVO om lex Sarah-anmälningar?',
      'Måste vi anmäla till IVO eller räcker intern utredning?',
      'Vad säger socialtjänstlagen om detta?',
      'Hur informerar vi anhöriga?',
      'Skriv ett utkast till anmälan.',
    ],
  },
  {
    id: 'konsultbolag-gdpr',
    om: 'Konsultbolag, personuppgiftsincident',
    lage: 'lokalt', webb: 'auto',
    ror: ['maskering', 'klassning', 'webb', 'lagen.nu'],
    turer: [
      'En medarbetare har mejlat en kundlista med 4 200 personnummer till fel adress. Vad gör vi först?',
      'Vad är tidsgränsen för anmälan till IMY?',
      'Måste vi informera de registrerade?',
      'Vad blir sanktionsavgiften ungefär?',
      'Skriv ett utkast till incidentanmälan.',
      'Och ett utkast till information till de drabbade.',
    ],
  },
  {
    id: 'restaurang-facklig',
    om: 'Restaurang, facklig fråga och arbetsrätt',
    lage: 'lokalt', webb: 'auto',
    ror: ['klassning-2', 'artikel9', 'lagen.nu', 'webb'],
    turer: [
      'Jag driver Almbacka Kök AB med 14 anställda. En av dem, Miriam Haddad, har gått med i LIVS och vill att vi tecknar kollektivavtal. Måste vi?',
      'Vad händer om vi säger nej?',
      'Vad är en stridsåtgärd och vad får den omfatta?',
      'Vad säger medbestämmandelagen om förhandlingsskyldighet?',
      'Vilken är LIVS officiella hemsida?',
      'Skriv ett sakligt svar till henne.',
    ],
  },
  {
    id: 'transport-kortider',
    om: 'Transportföretag, kör- och vilotider efter kontroll',
    lage: 'lokalt', webb: 'auto',
    ror: ['webb', 'lagen.nu', 'granskning', 'djup'],
    djup: true,
    turer: [
      'Vi fick en kontroll av Transportstyrelsen och tre av våra förare hade överskridit körtiden. Vad blir konsekvensen för bolaget?',
      'Vad säger förordningen om kör- och vilotider om maxtid per dygn?',
      'Kan förarna själva bli ansvariga?',
      'Hur överklagar vi en sanktionsavgift?',
    ],
  },

  // ── Ledningar och styrelser ────────────────────────────────────────────
  {
    id: 'vd-visselblasning',
    om: 'VD som fått en visselblåsarrapport om sig själv',
    lage: 'lokalt', webb: 'auto',
    ror: ['klassning-2', 'brott', 'ton-personlig', 'kris-nej', 'lagen.nu'],
    turer: [
      'Jag är VD för ett bolag med 90 anställda. Igår fick styrelsen en visselblåsarrapport som pekar ut mig för att ha godkänt ersättningar till ett bolag där min svåger är delägare. Jag visste inte om kopplingen. Vad händer nu?',
      'Måste jag kliva åt sidan under utredningen?',
      'Vilka rättigheter har jag som utpekad?',
      'Får jag veta vem som anmält?',
      'Vad säger visselblåsarlagen om det?',
      'Hur bör styrelsen hantera detta formellt?',
      'Jag sover inte och känner mig helt slut. Vad gör jag med det?',
    ],
  },
  {
    id: 'ordforande-ansvarsfrihet',
    om: 'Styrelseordförande, ansvarsfrihet och skadestånd',
    lage: 'lokalt', webb: 'auto',
    ror: ['lagen.nu-lagrum', 'domstolsverket', 'webb'],
    turer: [
      'Vår revisor avstyrker ansvarsfrihet för förra årets styrelse. Vad innebär det praktiskt?',
      'Vad säger aktiebolagslagen 2005:551 om skadeståndsansvar för styrelseledamöter?',
      'Vad säger 29 kap. 1 § i den lagen?',
      'Finns det praxis om styrelseledamöters ansvar vid kapitalbrist?',
      'Hur lång är preskriptionstiden?',
      'Skriv en punktlista till styrelsen om vad som händer härnäst.',
    ],
  },
  {
    id: 'hrchef-uppsagning',
    om: 'HR-chef, uppsägning av personliga skäl och rehabilitering',
    lage: 'lokalt', webb: 'auto',
    ror: ['klassning-2', 'halsa', 'personalarende', 'maskering', 'lagen.nu'],
    turer: [
      'Vi har en medarbetare, Christer Palm 19850822-2398, som varit sjukskriven 60 % i ett år för utmattning. Han sköter inte sina uppgifter när han är här. Kan vi säga upp honom?',
      'Vad är vårt rehabiliteringsansvar?',
      'Vad säger LAS om saklig grund i det här läget?',
      'Måste vi omplacera först?',
      'Vad händer om han är fackligt ansluten?',
      'Skriv ett utkast till kallelse till ett rehabiliteringssamtal.',
      'Hur dokumenterar vi processen så den håller?',
    ],
  },
  {
    id: 'ekonomichef-forskingring',
    om: 'Ekonomichef, misstänkt förskingring i kassan',
    lage: 'lokalt', webb: 'auto',
    fil: 'kassa.csv',
    ror: ['kalkyl', 'klassning-2', 'brott', 'rakning', 'webb'],
    turer: [
      'Här är kassajournalen för tre månader. Jag misstänker att någon tagit pengar. Vad ser du i siffrorna?',
      'Vilken dag avviker mest?',
      'Vad är den totala differensen?',
      'Om detta är förskingring, vad gör jag först?',
      'Ska jag konfrontera personen?',
      'Vad säger lagen om att avskeda vid brottsmisstanke?',
    ],
  },

  // ── Entreprenörer och egenföretagare ───────────────────────────────────
  {
    id: 'underentreprenor-betalning',
    om: 'Underentreprenör som inte får betalt',
    lage: 'lokalt', webb: 'auto',
    ror: ['lagen.nu', 'webb', 'utkast'],
    turer: [
      'Jag är underentreprenör och har 340 000 kr obetalt från en generalentreprenör sedan i juni. De säger att beställaren inte betalat dem. Måste jag vänta?',
      'Vad är en "pay when paid"-klausul och gäller den i Sverige?',
      'Hur gör jag en betalningsföreläggande hos Kronofogden?',
      'Vad kostar det och hur lång tid tar det?',
      'Skriv ett kravbrev.',
    ],
  },
  {
    id: 'egenforetagare-sjuk',
    om: 'Egenföretagare, sjukskrivning och försörjning',
    lage: 'lokalt', webb: 'auto',
    ror: ['klassning-2', 'halsa', 'ton-personlig', 'webb'],
    turer: [
      'Jag har enskild firma och har just fått en cancerdiagnos. Jag vet inte hur jag ska klara ekonomin. Vad finns det för stöd?',
      'Hur räknas sjukpenning för egenföretagare?',
      'Vad är karenstiden och kan jag ändra den?',
      'Vad händer med F-skatten om jag inte kan jobba?',
      'Jag är rädd att förlora allt jag byggt upp.',
    ],
  },
  {
    id: 'akeri-olycka',
    om: 'Åkeri efter en arbetsplatsolycka',
    lage: 'lokalt', webb: 'auto',
    ror: ['klassning-2', 'lagen.nu-lagrum', 'webb', 'granskning', 'djup'],
    djup: true,
    turer: [
      'En av våra chaufförer, Nils Ekblad, klämde handen mellan en container och lastbilsflaket igår. Han är på sjukhus. Vad måste vi göra nu?',
      'Vad säger 3 kap. 3 a § arbetsmiljölagen om anmälan?',
      'Vad är skillnaden mellan allvarligt tillbud och arbetsolycka?',
      'Kan vi bli åtalade för arbetsmiljöbrott?',
      'Vad har hänt i liknande fall i domstol?',
    ],
  },

  // ── Privatpersoner ─────────────────────────────────────────────────────
  {
    id: 'vardnadstvist',
    om: 'Privatperson i vårdnadstvist',
    lage: 'lokalt', webb: 'auto',
    ror: ['klassning-2', 'familjeratt', 'brott', 'maskering', 'ton-personlig', 'lagen.nu'],
    turer: [
      'Klient: Oskar Wendt, 19850814-2398. Vårdnadstvist. Motpart Linnea Ahlberg, gemensam dotter Alma 4 år. Oskar har dömts för ringa narkotikabrott 2023. Linnea vill ha ensam vårdnad. Oskar vill ha växelvis. Var står vi?',
      'Hur tungt väger en gammal dom i bedömningen av barnets bästa?',
      'Vad säger 6 kap. 2 a § föräldrabalken?',
      'Vad krävs för att få till ett informationssamtal?',
      'Vad händer om motparten vägrar samarbeta?',
      'Skriv en sammanfattning av läget till klienten.',
    ],
  },
  {
    id: 'foralder-skola',
    om: 'Förälder, kränkande behandling i skolan',
    lage: 'lokalt', webb: 'auto',
    ror: ['klassning-2', 'halsa', 'ton-personlig', 'kris-nej', 'lagen.nu', 'webb'],
    turer: [
      'jag vet inte vem mer jag ska fråga. min dotter Molly Hedström går i fyran på Almbacka skolan och har blivit utsatt för nåt som jag tycker är helt oacceptabelt, hennes lärare Christer Palm har vid flera tillfällen tagit tag i henne och en gång dragit henne ut ur klassrummet när hon vägrade sätta sig. hon har en ADHD diagnos sen förra året och äter medicin, rektorn Yvonne Blad säger att det är "lågaffektivt bemötande" men det är det ju inte, Molly är rädd för att gå till skolan nu och vaknar på nätterna',
      'Vad säger skollagen om kränkande behandling?',
      'Vem anmäler jag till?',
      'Vad är skillnaden mellan Skolinspektionen och BEO?',
      'Kan skolan ta tag i ett barn över huvud taget?',
      'Vad gör jag om rektorn inte gör något?',
      'Skriv en anmälan åt mig.',
      'Jag orkar snart inte. Molly mår så dåligt.',
    ],
  },
  {
    id: 'anstalld-omplacering',
    om: 'Anställd som blivit omplacerad efter att ha larmat',
    lage: 'lokalt', webb: 'auto',
    ror: ['klassning-2', 'personalarende', 'artikel9', 'ton-personlig', 'lagen.nu'],
    turer: [
      'Jag larmade om brister i städrutinerna på vår avdelning i augusti. I september blev jag omplacerad till nattskift. Chefen säger att det inte har med saken att göra. Vad gäller?',
      'Vad räknas som repressalier enligt visselblåsarlagen?',
      'Måste jag ha larmat internt först?',
      'Hur bevisar jag sambandet?',
      'Vad kan jag få i skadestånd?',
      'Jag är med i Kommunal. Vad gör de?',
      'Skriv en tidslinje över det som hänt utifrån det jag berättat.',
    ],
  },

  // ── Lägen och gränsfall ────────────────────────────────────────────────
  {
    id: 'hjalpen',
    om: 'Frågor om appen själv',
    hjalp: true,
    ror: ['hjalp'],
    turer: [
      'Vad är skillnaden mellan lägena?',
      'Hur fungerar maskeringen?',
      'Vad står under Skickat?',
      'Kan jag låsa en session?',
      'Vad kostar MAXIMUS?',
    ],
  },
  {
    id: 'korta-fragor',
    om: 'Korta frågor som inte ska väcka något alls',
    lage: 'lokalt', webb: 'auto',
    ror: ['ingen-webb', 'klassning-0'],
    turer: [
      'Hej!',
      'Vad kan du hjälpa mig med?',
      'Hur fungerar en överklagan?',
      'Tack, det räckte.',
    ],
  },
];

/// Bilagorna. Skrivs till disk av köraren.
export const FILER = {
  'ata.csv': `Post;Beskrivning;Belopp;Godkänd av;Godkänt datum
ÄTA-001;Extra dränering norra fasaden;184 500,00;Per Nyström;2026-03-04
ÄTA-002;Tilläggsisolering vind;96 200,50;Per Nyström;2026-03-11
ÄTA-003;Ändrad belysning aula;242 000,00;;
ÄTA-004;Rivning befintligt golv;58 750,00;Anna Wiklund;2026-04-02
ÄTA-005;Asbestsanering källare;415 000,00;;
ÄTA-006;Omdragning ventilation;177 300,25;Anna Wiklund;2026-04-19
ÄTA-007;Extra brandtätning;63 400,00;;
ÄTA-008;Utökad markplanering;128 900,00;Per Nyström;2026-05-06
`,
  'kundreskontra.csv': `Kund;Fakturanr;Belopp;Förfallodatum;Dagar sedan förfall
Almbacka Kök AB;2026-1042;48 500,00;2026-06-15;103
Kvarnby Bygg AB;2026-1051;126 000,00;2026-07-02;86
Hallgren Entreprenad AB;2026-1063;14 250,50;2026-08-20;37
Ferm Konsult & Service;2026-1071;saknas;2026-08-28;29
Almbacka Omsorg AB;2026-1078;92 300,00;2026-09-01;25
Kvarnby Energi AB;2026-1085;307 000,00;2026-05-30;119
Nordvik Transport AB;2026-1090;22 100,75;2026-09-12;14
`,
  'kassa.csv': `Datum;Kassaregister;Räknat;Differens;Signatur
2026-07-01;18 420,00;18 420,00;0,00;MH
2026-07-08;22 140,50;22 140,50;0,00;MH
2026-07-15;19 880,00;18 380,00;-1 500,00;TF
2026-07-22;24 310,00;24 310,00;0,00;MH
2026-07-29;21 050,00;19 250,00;-1 800,00;TF
2026-08-05;17 900,00;17 900,00;0,00;MH
2026-08-12;23 440,00;20 240,00;-3 200,00;TF
2026-08-19;20 100,00;20 100,00;0,00;AW
2026-08-26;25 600,00;25 600,00;0,00;MH
2026-09-02;18 750,00;16 550,00;-2 200,00;TF
2026-09-09;22 800,00;22 800,00;0,00;AW
`,
};
