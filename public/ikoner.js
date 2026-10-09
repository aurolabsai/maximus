// Ikonerna. En uppsättning, ett formspråk, en storlek.
//
// ── Första doktrinen, och varför den byttes ──────────────────────────────
//
// Den löd: "formerna är geometriska och inte illustrativa: rektanglar,
// cirklar, raka linjer. Verktyg, inte klistermärken." Alla ritades i 20×20
// med ETT streck på 1.5 och inga fyllningar.
//
// Den räddade oss från emojin. Men den tog med sig något annat på köpet:
// varje märke blev en trådmodell av lika tjocka hårstreck, och en rad av
// dem läser som en ritning ingen målat färdigt. Sagt rakt ut 2026-09-30:
// för små, och för stela.
//
// ── Doktrinen nu ─────────────────────────────────────────────────────────
//
// Fortfarande inga emojier, fortfarande monokromt, fortfarande verktyg. Men
// tre saker till, och de är hela skillnaden:
//
// 1. TVÅ STRECKVIKTER. Konturen som bär formen går tungt (1.9–2.6),
//    detaljen inuti går tunt (1.2–1.6). Det är så en maskinritning är
//    gjord — ytterkontur kraftig, inre linjer fina — och det är därför en
//    sådan ritning läser som ett föremål och inte som ett diagram.
//
// 2. MASSA DÄR SAKEN ÄR MASSIV. Låsets kropp, bokmärket, pilspetsen,
//    maskens svarta balk: fyllda. Ett märke utan en enda fylld yta har
//    ingen tyngdpunkt, och ögat hittar inget att fästa vid.
//
//    Fyllningen är alltid ADDITIV. Aldrig ett urtag som måste ha
//    bakgrundens färg för att fungera — märkena sitter på fyra olika
//    underlag i appen, och ett hål som antar ett av dem är ett hål som
//    lyser fel på de tre andra.
//
// 3. KAPADE HÖRN. `stroke-linejoin="miter"` och `stroke-linecap="square"`.
//    Runda ändar är gjutna; kapade är frästa. Skillnaden är liten vid
//    sexton pixlar och den är hela registret: det här är en maskin.
//
// Ramen är 24×24 och inte 20×20. Inte för att märkena ska bli större —
// storleken sätts där de används — utan för att 20 inte rymde en vinkel
// som inte var 45 eller 90 grader. Allt hamnade i rutnätet, och det var
// rutnätet som gjorde dem stela.

const RAM = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"'
  + ' stroke-linecap="square" stroke-linejoin="miter"';

/// Fylld yta. Egen fill, inget streck — massan ska inte växa med konturen.
const M = 'fill="currentColor" stroke="none"';

const FORMER = {
  ny:        '<path d="M12 4.6v14.8M4.6 12h14.8" stroke-width="2.2"/>',
  // Mikrofonen: kapseln massiv, bygeln och foten i streck.
  mikrofon:  `<rect ${M} x="8.4" y="2.6" width="7.2" height="11.6" rx="3.6"/>`
             + '<path d="M5.2 11.2a6.8 6.8 0 0 0 13.6 0" stroke-width="1.9"/><path d="M12 18v3.4" stroke-width="2.2"/>',
  // Skicka: en spets med tyngd och en skaftlinje som är tjockare än
  // resten. En tunn pil ser ut som en anvisning; den här ser ut som en
  // knapp man trycker på.
  skicka:    `<path ${M} d="M12 3.2l7.2 7.6h-14.4z"/><path d="M12 10.4v10.4" stroke-width="2.6"/>`,
  ner:       `<path ${M} d="M12 20.8l-7.2-7.6h14.4z"/><path d="M12 13.6V3.2" stroke-width="2.6"/>`,
  // Importera: en pil ned i ett maximus som står öppet. Delningsikonen dög
  // inte — att dela ut och att ta emot är motsatta handlingar.
  importera: `<path ${M} d="M12 14.2l-4.8-5.2h9.6z"/><path d="M12 9V2.8" stroke-width="2.6"/>`
             + '<path d="M3.6 14.4v6.2h16.8v-6.2" stroke-width="2"/>',
  hjalp:     `<circle cx="12" cy="12" r="9" stroke-width="2.1"/>`
             + '<path d="M9.3 9.4a2.8 2.8 0 1 1 3.2 3.1v1.6" stroke-width="1.5"/>'
             + `<path ${M} d="M11.2 16.4h1.7v1.7h-1.7z"/>`,
  // Djupsökning: lins och handtag tungt, plustecknet inuti fint.
  djup:      '<circle cx="10.4" cy="10.4" r="6.3" stroke-width="2.1"/>'
             + '<path d="M15.1 15.1L20.8 20.8" stroke-width="2.8"/>'
             + '<path d="M7.4 10.4h6M10.4 7.4v6" stroke-width="1.4"/>',
  // Dela: fyrkanter och inte cirklar. En nod i ett system är en enhet, och
  // enheter i den här appen är rätvinkliga.
  dela:      `<path ${M} d="M16.4 2.6h4.8v4.8h-4.8zM2.6 9.6h4.8v4.8H2.6zM16.4 16.6h4.8v4.8h-4.8z"/>`
             + '<path d="M7.8 11.1l8.6-3.8M7.8 12.9l8.6 3.8" stroke-width="1.4"/>',
  sido:      '<rect x="3" y="4" width="18" height="16" rx="1" stroke-width="2.1"/>'
             + `<path ${M} d="M4.1 5.1h4.9v13.8H4.1z"/>`,
  // Liggaren: en bok med en kolumnlinje. Utan den var den en rektangel med
  // tre streck i — samma sak som `underlag`, och två märken som betyder
  // olika saker får inte se lika ut. Kolumnen är vad som skiljer en liggare
  // från ett papper: den är förd i spalter.
  liggare:   '<rect x="4.4" y="2.8" width="15.2" height="18.4" rx="1" stroke-width="2.1"/>'
             + `<path ${M} d="M4.4 2.8h3.4v18.4H4.4z"/>`
             + '<path d="M10.2 7.6h6.4M10.2 12h6.4M10.2 16.4h3.6" stroke-width="1.4"/>',
  papperskorg: '<path d="M3.4 6.4h17.2" stroke-width="2.6"/>'
             + `<path ${M} d="M9.2 3h5.6v2.4H9.2z"/>`
             + '<path d="M5.8 6.6l1.1 14.2h10.2l1.1-14.2" stroke-width="2"/>'
             + '<path d="M10 10.4v6.6M14 10.4v6.6" stroke-width="1.3"/>',
  arkiv:     `<path ${M} d="M2.8 3.6h18.4v4.6H2.8z"/>`
             + '<path d="M4.6 8.8v10.6a1 1 0 0 0 1 1h12.8a1 1 0 0 0 1-1V8.8" stroke-width="2"/>'
             + '<path d="M9.6 13h4.8" stroke-width="1.6"/>',
  // Mappen: ett projekt. Pilen ned i den säger att något läggs dit.
  // Listen (Fas 48): hem, agenten, uppdragen och samtalen. Samma två
  // streckvikter och samma massa där saken är massiv som resten.
  // Kugghjulet (Auro 2026-10-05: reglagen "suger häst jämfört med resten").
  // Åtta kuggar räknade, inte ritade på fri hand; navet massivt.
  kugghjul:  '<path d="M19.07 9.81 L21.46 10.38 L21.46 13.62 L19.07 14.19 L18.55 15.45 L19.84 17.54 L17.54 19.84 L15.45 18.55 L14.19 19.07 L13.62 21.46 L10.38 21.46 L9.81 19.07 L8.55 18.55 L6.46 19.84 L4.16 17.54 L5.45 15.45 L4.93 14.19 L2.54 13.62 L2.54 10.38 L4.93 9.81 L5.45 8.55 L4.16 6.46 L6.46 4.16 L8.55 5.45 L9.81 4.93 L10.38 2.54 L13.62 2.54 L14.19 4.93 L15.45 5.45 L17.54 4.16 L19.84 6.46 L18.55 8.55Z" stroke-width="2" stroke-linejoin="round"/>'
             + '<circle cx="12" cy="12" r="3.4" stroke-width="1.6"/>'
             + `<circle ${M} cx="12" cy="12" r="1.3"/>`,
  hem:       '<path d="M3.6 10.6L12 3.6l8.4 7v9.8H3.6z" stroke-width="2"/>'
             + `<path ${M} d="M9.8 20.4v-5.6h4.4v5.6z"/>`,
  agent:     '<path d="M12 2.8v8.6" stroke-width="2.4"/>'
             + '<path d="M6.4 6.2a8.2 8.2 0 1 0 11.2 0" stroke-width="2"/>',
  uppdrag:   '<circle cx="12" cy="12" r="8.6" stroke-width="2"/>'
             + '<circle cx="12" cy="12" r="4.4" stroke-width="1.5"/>'
             + `<circle ${M} cx="12" cy="12" r="1.6"/>`,
  samtal:    '<path d="M3.4 5.2a1 1 0 0 1 1-1h15.2a1 1 0 0 1 1 1v10.4a1 1 0 0 1-1 1H9.4l-4.6 3.6v-3.6H4.4a1 1 0 0 1-1-1z" stroke-width="2"/>'
             + '<path d="M7.6 9.2h8.8M7.6 12.4h5.6" stroke-width="1.4"/>',
  mapp:      '<path d="M3 20.4V6.6a1 1 0 0 1 1-1h6.2l2.1 2.8H21v12z" stroke-width="2"/>'
             + `<path ${M} d="M12 17.2l-3.4-3.8h6.8z"/>`
             + '<path d="M12 13.8v-3.4" stroke-width="2.2"/>',
  inkorg:    '<path d="M2.6 13.4L5 4.4h14l2.4 9v6H2.6z" stroke-width="2"/>'
             + `<path ${M} d="M2.6 13.4h5.4l1.4 2.8h5.4l1.4-2.8h5.4v6H2.6z"/>`,
  // Låset: kroppen är massiv, bygeln är smidd. Det är två material, och det
  // syns nu.
  las:       `<path ${M} d="M4.4 10.2h15.2v10.6H4.4z"/>`
             + '<path d="M7.8 10.2V7.4a4.2 4.2 0 0 1 8.4 0v2.8" stroke-width="2.3"/>',
  laset_upp: `<path ${M} d="M4.4 10.2h15.2v10.6H4.4z"/>`
             + '<path d="M7.8 10.2V7.4a4.2 4.2 0 0 1 8.1-1.5" stroke-width="2.3"/>',
  // Kopiera: arket framför är fyllt, arket bakom bara antytt. Två lika
  // tunna rektanglar såg ut som ett fönster i ett fönster.
  kopiera:   '<path d="M15.6 3.4H4.4v11.8" stroke-width="1.7"/>'
             + `<path ${M} d="M8.2 7.2h11.8v13.4H8.2z"/>`,
  // Reglage, inte kugghjul. Ett kugghjul blir åtta ekrar runt en cirkel och
  // läser som en sol. Vreden är fyrkantiga: ett vred på en maskin är frest,
  // inte svarvat.
  installningar: '<path d="M2.8 6.6h18.4M2.8 12h18.4M2.8 17.4h18.4" stroke-width="1.4"/>'
             + `<path ${M} d="M6 4.2h2.8v4.8H6zM13.8 9.6h2.8v4.8h-2.8zM9 15h2.8v4.8H9z"/>`,
  stopp:     `<path ${M} d="M6.4 6.4h11.2v11.2H6.4z"/>`,
  klar:      '<path d="M4.2 12.2l5.2 5.2L20 6.6" stroke-width="2.8"/>',
  fastnal:   `<path ${M} d="M14.6 2.8l6.6 6.6-2.8 2.8-1.6 5.8-8.4-8.4 5.8-1.6z"/>`
             + '<path d="M9 15L3.4 20.6" stroke-width="2.2"/>',
  // Bokmärke för att fästa: fyllt. En kontur ensam var en tom ficka.
  bokmarke:  `<path ${M} d="M5.8 3h12.4v18.2L12 16.4l-6.2 4.8z"/>`,
  plus:      '<path d="M12 5.2v13.6M5.2 12h13.6" stroke-width="2.2"/>',
  // Citat: två massiva block med en svans. Krusidullen i det gamla
  // citattecknet var den enda kurvan i hela uppsättningen.
  citat:     `<path ${M} d="M4.2 8.8h4.6v4.6H4.2zM13.2 8.8h4.6v4.6h-4.6z"/>`
             + '<path d="M8.8 13.4c0 2.8-1.5 4.5-4.6 5.2M17.8 13.4c0 2.8-1.5 4.5-4.6 5.2" stroke-width="1.4"/>',
  // Masken: tre textrader med en svärtad balk över den mellersta.
  //
  // Först var det en sköld med ett streck över. Den läste som ett
  // förbudsmärke — en cirkel med ett minus i — och en knapp som ser ut att
  // neka är inte en knapp man trycker på.
  //
  // Det här är i stället bokstavligen vad en maskering ÄR: text med en
  // svart rektangel över det som inte får läsas. Ingenting annat i
  // uppsättningen ser ut så, och ingen behöver få det förklarat.
  mask:      '<path d="M3.6 6.6h16.8" stroke-width="1.5"/>'
             + `<path ${M} d="M3.6 10.4h10.4v3.2H3.6z"/>`
             + '<path d="M16.4 12h4" stroke-width="1.5"/>'
             + '<path d="M3.6 17.4h12.6" stroke-width="1.5"/>',
  // Lägena, som lager. Det översta är fyllt: det är det som gäller.
  lage:      `<path ${M} d="M12 3l8.6 4.3-8.6 4.3-8.6-4.3z"/>`
             + '<path d="M3.4 12l8.6 4.3 8.6-4.3M3.4 16.4l8.6 4.3 8.6-4.3" stroke-width="1.6"/>',
  // Kalendern: bladet med sin sotade list. Bar plustecknet förut — och ett
  // plus betyder "lägg till" överallt annars i appen, inte "läs".
  kalender:  '<path d="M7.4 2.6v3.8M16.6 2.6v3.8" stroke-width="2.2"/>'
             + '<rect x="3.4" y="4.8" width="17.2" height="15.8" rx="1" stroke-width="2"/>'
             + `<path ${M} d="M3.4 4.8h17.2v4.2H3.4z"/>`
             + '<path d="M7.4 13h3.2M13.4 13h3.2M7.4 16.8h3.2" stroke-width="1.4"/>',
  // Fristen: en klocka. Bevakningarna bar bocken, och en bock betyder
  // "gjort" — raka motsatsen till något som ännu inte gått ut.
  frist:     '<circle cx="12" cy="12.4" r="8.4" stroke-width="2.1"/>'
             + '<path d="M12 7.2v5.2l3.8 2.3" stroke-width="2.2"/>',
  pil_upp:   '<path d="M5.8 14.8L12 8.6l6.2 6.2" stroke-width="2.2"/>',
  // Strömbrytaren: samma tecken som sitter på varje maskin. Stapeln tyngre
  // än bågen — det är stapeln som är handlingen.
  strom:     '<path d="M12 2.8v7.6" stroke-width="2.8"/>'
             + '<path d="M17.6 6.4a7.8 7.8 0 1 1-11.2 0" stroke-width="2.1"/>',
  paus:      `<path ${M} d="M7.2 4.6h3.4v14.8H7.2zM13.4 4.6h3.4v14.8h-3.4z"/>`,
  spela:     `<path ${M} d="M7.4 4.2L19.4 12 7.4 19.8z"/>`,
  // Jordklot: meridianer och ekvator, inga kontinenter. Kontinenter i
  // sexton pixlar blir grus. Ytterringen tung, nätet inuti fint.
  glob:      '<circle cx="12" cy="12" r="8.6" stroke-width="2.1"/>'
             + '<path d="M3.4 12h17.2" stroke-width="1.5"/>'
             + '<ellipse cx="12" cy="12" rx="3.9" ry="8.6" stroke-width="1.5"/>',
  // Kör om: en cirkel som inte sluts, och en kil där den börjar igen.
  omkor:     '<path d="M20.6 12a8.6 8.6 0 1 1-2.6-6.2" stroke-width="2.1"/>'
             + `<path ${M} d="M21.4 2.4v6.6h-6.6z"/>`,
  // Pennan: hylsan är metall och fylld, skaftet är ritat.
  penna:     `<path ${M} d="M16.2 2.8l5 5-2.8 2.8-5-5z"/>`
             + '<path d="M13.4 5.6L3.6 15.4v5h5l9.8-9.8" stroke-width="1.9"/>',
  // Tre punkter: "mer att göra med den här raden". Fyrkantiga, som allt
  // annat som är en enhet här.
  punkter:   `<path ${M} d="M3.2 10.4h3.2v3.2H3.2zM10.4 10.4h3.2v3.2h-3.2zM17.6 10.4h3.2v3.2h-3.2z"/>`,
  mapp_ny:   '<path d="M3 20.4V6.6a1 1 0 0 1 1-1h6.2l2.1 2.8H21v12z" stroke-width="2"/>'
             + '<path d="M12 11v5.4M9.3 13.7h5.4" stroke-width="2.2"/>',
  // Beslutsunderlaget: ett dokument med vikt hörn, inte en mapp. Hörnet är
  // fyllt — det är där man ser att det är ETT papper och inte en ruta.
  underlag:  '<path d="M13.6 3.2H5.8a1 1 0 0 0-1 1v15.6a1 1 0 0 0 1 1h12.4a1 1 0 0 0 1-1V8.8z" stroke-width="2"/>'
             + `<path ${M} d="M13.6 3.2L19.2 8.8h-5.6z"/>`
             + '<path d="M8.2 13h7.6M8.2 16.6h4.6" stroke-width="1.4"/>',
};

/// Ger tillbaka ett SVG-element. Aldrig en sträng — en sträng frestar till
/// innerHTML, och innerHTML med data i frestar till läckage.
export function ikon(namn, storlek = 18) {
  const d = document.createElement('div');
  // Storleken i rem, inte bara som attribut i px (Fas 15). Attributen står
  // kvar som reserv, men ett attribut på 18 följer inte ⌘+ — ikonerna stod
  // still medan allt runt dem växte.
  //
  // Via CSSOM och inte som style-attribut i texten: sidans CSP
  // (style-src 'self') stoppar inline-stilar i HTML, men inte egenskaper
  // som sätts från skript.
  d.innerHTML = `<svg ${RAM} width="${storlek}" height="${storlek}">${FORMER[namn] || ''}</svg>`;
  const svg = d.firstChild;
  svg.style.width = svg.style.height = `${storlek / 16}rem`;
  return svg;
}

export const IKONER = Object.keys(FORMER);
