// Strukturvakten. Efterbearbetning av ett färdigskrivet svar.
//
// Doktrinen säger ett påstående per stycke. En 2:a läser det och skriver ändå
// elva meningar i ett block. Vi lärde oss i fas 15 att en instruktion inte är
// en spärr — det som ska gälla måste göras, inte bes om. Det här är spärren.
//
// Regeln för hela filen: **inga ord får ändras.** Vakten bryter, stryker och
// grupperar. Den skriver inte om. En efterbearbetning som formulerar om ett
// juridiskt påstående är farligare än väggen den rättar.

/// Förkortningar som slutar på punkt utan att avsluta en mening.
/// Svenska och engelska (fas 3): "t.ex.", "e.g.", "i.e.", "Dr.", "No.".
const FORKORTNING = /(?:^|\s)(t\.ex|bl\.a|m\.m|m\.fl|d\.v\.s|dvs|osv|ca|kap|mom|nr|st|f\.d|s\.k|jfr|resp|ang|enl|prop|not|avd|fig|e\.g|i\.e|etc|vs|approx|no|cf|mr|mrs|ms|dr|prof|sec|art|para|ch|u\.s|u\.k|inc|ltd|co)\.$/i;

/// Delar text i meningar.
///
/// Svensk lagtext är full av fällor: "5 a §", "1982:80", "1 kap. 3 §",
/// "t.ex." och "m.m.". En naiv split på punkt hackar sönder varje citat.
export function meningar(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const ut = [];
  let start = 0;
  for (let i = 0; i < t.length; i++) {
    if (!'.!?'.includes(t[i])) continue;
    const efter = t.slice(i + 1, i + 3);
    // Slutet på texten, eller mellanslag följt av versal/siffra.
    if (i === t.length - 1) { ut.push(t.slice(start).trim()); start = t.length; break; }
    if (!/^\s/.test(efter)) continue;
    const nasta = t.slice(i + 1).replace(/^\s+/, '')[0] || '';
    if (!/[A-ZÅÄÖ0-9]/.test(nasta)) continue;
    const fore = t.slice(start, i + 1);
    if (FORKORTNING.test(fore)) continue;
    // Ensam siffra eller bokstav före punkten: "1." i en uppräkning, "a." i
    // en paragrafbeteckning. Inte ett meningsslut.
    if (/(?:^|\s)[0-9a-zåäö]\.$/i.test(fore)) continue;
    ut.push(fore.trim());
    start = i + 1;
  }
  if (start < t.length) ut.push(t.slice(start).trim());
  return ut.filter(Boolean);
}

const nyckel = m => m.toLowerCase().replace(/[^a-zåäöé0-9§ ]/g, '').replace(/\s+/g, ' ').trim();

/// Papegojvakten.
///
/// Sett skarpt 2026-09-20: "En anställning har följt på en annan om den
/// tillträtts inom sex månader från den föregående anställningens slutdag"
/// fyra gånger i samma svar, ordagrant. Modellen hade sex lagparagrafer som
/// underlag och återgav samma mening ur varje.
///
/// Två regler, båda konservativa. Ordagranna dubbletter stryks. En mening som
/// helt ryms i en annan mening som redan står kvar stryks också — den bär
/// ingenting eget. Allt annat lämnas i fred: att slå ihop två meningar som
/// bara *liknar* varandra kräver att man skriver om dem, och då ändras orden.
export function strykUpprepning(rader, sedda = new Set()) {
  const kvar = [];
  for (const m of rader) {
    const n = nyckel(m);
    if (!n) continue;
    if (sedda.has(n)) continue;
    // Ryms den i något som redan står kvar? Bara för meningar med tyngd —
    // en kort mening kan vara en avsiktlig sammanfattning.
    if (n.length >= 40 && kvar.some(k => nyckel(k).includes(n))) continue;
    sedda.add(n);
    kvar.push(m);
  }
  // Omvänt håll: en tidigare, kortare mening som nu ryms i en senare, längre.
  return kvar.filter((m, i) => {
    const n = nyckel(m);
    return !(n.length >= 40 && kvar.some((k, j) => j > i && nyckel(k).includes(n)));
  });
}

/// Bisatsinledare. Skrivet utan \b, som allt annat här som rör svenska ord.
const BISATS = /(?:^|\s)(då|när|om|som|där|ifall|innan|efter att|medan|såvida|when|if|which|that|where|before|after|while|unless|whereby)(?=\s)/i;

/// Stryker en ordagrant upprepad svans.
///
/// Sett skarpt 2026-09-20. Tre meningar i rad slutade med exakt samma bisats:
/// ", eller under en period då arbetstagaren har haft tidsbegränsade
/// anställningar i form av särskild visstidsanställning, vikariat eller
/// säsongsarbete och anställningarna följt på varandra."
///
/// Meningarna i sig bär olika saker — den ena gäller visstid och tolv
/// månader, den andra vikariat och två år — så att stryka hela meningen vore
/// att tappa innehåll. Det är svansen som är papegojan.
///
/// Kapningen sker bara vid ett kommatecken, och bara när det som blir kvar
/// fortfarande är en hel mening. Annars lämnas meningen i fred. Regeln för
/// hela filen gäller: inga ord ändras, bara bortfall.
export function strykUpprepadSvans(rader, { minOrd = 8 } = {}) {
  const sedda = new Set();
  return rader.map((m, i) => {
    const komman = [...m.matchAll(/,\s+/g)].map(x => x.index);
    if (i > 0) {
      for (const k of komman) {
        const svans = m.slice(k + 1).trim().replace(/[.!?]+$/, '');
        if (svans.split(/\s+/).length < minOrd) continue;

        // Bara en bisats får kapas, aldrig ett led i en uppräkning.
        //
        // Första versionen kapade vid första kommatecknet vars svans setts
        // förut, och slet sönder "i form av särskild visstidsanställning,
        // vikariat eller säsongsarbete" mitt i listan. Inga ord ändrades och
        // innebörden gjorde det ändå — vilket är värre än papegojan den
        // skulle rätta. Svansen måste därför inledas med ett bindeord och
        // innehålla en bisatsinledare; en uppräkning har varken.
        if (!/^(eller|och|samt|or|and)\s/i.test(svans)) continue;
        // Inte \b. I JavaScript är å, ä och ö inte ordtecken, så \bdå\b har
        // ingen gräns efter å:et och matchar aldrig. Samma fälla sänkte
        // routerns \blag tidigare i bygget.
        if (!BISATS.test(svans)) continue;

        if (!sedda.has(nyckel(svans))) continue;
        const kvar = m.slice(0, k).trim();
        // Det som blir kvar måste kunna stå som mening: tillräckligt långt,
        // och inte sluta på ett bindeord som väntar sig en fortsättning.
        if (kvar.split(/\s+/).length < 6) continue;
        if (/(?<![\p{L}])(och|eller|samt|men|som|att|där|när|om|av|i|på|till|and|or|but|that|which|where|when|if|of|in|on|to|the|a|an)$/iu.test(kvar)) continue;
        return `${kvar}.`;
      }
    }
    // Bara bisatser läggs i minnet — samma krav som för kapningen, annars
    // minns vakten uppräkningsled som den ändå aldrig får röra.
    for (const k of komman) {
      const svans = m.slice(k + 1).trim().replace(/[.!?]+$/, '');
      if (svans.split(/\s+/).length < minOrd) continue;
      if (!/^(eller|och|samt|or|and)\s/i.test(svans)) continue;
      if (!BISATS.test(svans)) continue;
      sedda.add(nyckel(svans));
    }
    return m;
  });
}

/// Bryter en lång följd meningar i stycken.
///
/// Taket är ord, inte tecken: 65 ord är ungefär fem rader på en normal skärm,
/// och fem rader är vad ögat orkar utan ett andrum. Brytningen sker alltid
/// vid en meningsgräns, aldrig mitt i.
export function brytStycken(rader, { tak = 65 } = {}) {
  const ut = [];
  let bunt = [], ord = 0;
  for (const m of rader) {
    const n = m.split(/\s+/).length;
    // En ensam mening som är längre än taket får stå ensam — den går inte att
    // bryta utan att ändra den.
    if (bunt.length && ord + n > tak) { ut.push(bunt.join(' ')); bunt = []; ord = 0; }
    bunt.push(m); ord += n;
  }
  if (bunt.length) ut.push(bunt.join(' '));
  return ut;
}

/// Tre eller fler meningar som börjar likadant blir en lista.
///
/// Parallella led lästa som löptext ser ut som upprepning även när de inte är
/// det. Som lista syns det som skiljer dem åt, vilket är hela poängen med att
/// de står där.
export function tillLista(rader) {
  if (rader.length < 3) return null;
  const inledning = m => m.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
  const forsta = inledning(rader[0]);
  if (!rader.every(m => inledning(m) === forsta)) return null;
  if (rader.some(m => m.split(/\s+/).length > 40)) return null;
  return rader.map(m => `- ${m}`).join('\n');
}

/// Block som aldrig rörs: kod, tabell, citat, rubrik, lista, ruta.
const ORORT = /^\s*(?:```|\||#{1,4}\s|>|[-*+]\s|\d+[.)]\s)/;

/// Rättar rutor som modellen skrivit på fel sätt.
///
/// Sett skarpt 2026-09-20 på Maximus Pro:
///
///   # [!slutsats] Uppsägningstiden är inte lika …
///   **Slutsats:** Uppsägningstiden är inte lika …
///   **Varning:** En risk för skada kan …
///   **Lucka:** Det går inte att belägga …
///
/// Den första blev en rubrik med bokstavlig `[!slutsats]` i texten; de tre
/// andra blev fet prosa. Ingen av dem var en ruta, så ruträknaren såg noll
/// och kapade ingenting — och svaret sa samma sak två gånger, en gång överst
/// och en gång längst ned.
///
/// Att rätta markören är inte att skriva om. Orden står kvar; de får bara den
/// form de var avsedda att ha, och då gäller taket som vanligt.
// Rutmärkena ([!slutsats], [!varning], [!lucka]) är maskinens format och
// står kvar på svenska. Etiketterna läses på båda språken.
const RUTORD = { slutsats: 'slutsats', slutsatsen: 'slutsats', varning: 'varning', varningar: 'varning', lucka: 'lucka', luckor: 'lucka',
  conclusion: 'slutsats', warning: 'varning', warnings: 'varning', caution: 'varning', gap: 'lucka', gaps: 'lucka' };

export function rattaRutor(text) {
  return String(text || '').split('\n').map(rad => {
    // Rubrik med rutmärke: "# [!slutsats] ..." eller "## [!varning] ..."
    const h = /^\s*#{1,4}\s*(\[!\w+\].*)$/.exec(rad);
    if (h) return `> ${h[1]}`;
    // Rutmärke utan citattecken: "[!lucka] ..." först på raden.
    const m = /^\s*(\[!\w+\]\s.*)$/.exec(rad);
    if (m) return `> ${m[1]}`;
    // Fet etikett i stället för ruta: "**Slutsats:** ..."
    const f = /^\s*\*\*([A-Za-zÅÄÖåäö]+)\s*:?\*\*\s*:?\s*(.+)$/.exec(rad);
    if (f) {
      const sort = RUTORD[f[1].toLowerCase()];
      if (sort) return `> [!${sort}] ${f[2].trim()}`;
    }
    return rad;
  }).join('\n');
}

/// Sätter blockmärken på egen rad.
///
/// Skyddsnät, inte huvudlösning — huvudlösningen är att skrivsteget saknar
/// schema. Men en modell kan fortfarande skriva "...slutdag. > [!slutsats]
/// Gränsen går vid tolv månader." i ett svep, och då blir rutan löptext.
///
/// Arbetar rad för rad, och en rad som redan börjar med ett blockmärke lämnas
/// orörd. Första versionen sökte i hela texten på en gång och klöv "| A | B |"
/// mitt itu — en regel som ska rädda trasig struktur får inte bryta hel.
export function radbryt(text) {
  return String(text || '').split('\n').map(rad => {
    if (ORORT.test(rad)) return rad;
    // Ruta, citat eller rubrik som börjar mitt i en mening.
    let r = rad.replace(/(\S)\s+(?=>\s*\[!)/g, '$1\n\n');
    r = r.replace(/(\S)\s+(?=>\s)/g, '$1\n\n');
    r = r.replace(/(\S)\s+(?=#{2,4}\s)/g, '$1\n\n');
    // En tabell som börjar mitt i en rad: bryt före första rörtecknet och
    // sedan vid varje radgräns, som är ett rör direkt följt av ett rör.
    const t = r.search(/\s\|\s[^|]*\|/);
    if (t > 0 && !/^\s*\|/.test(r)) {
      r = `${r.slice(0, t)}\n\n${r.slice(t + 1)}`;
    }
    return r.replace(/\|\s+\|/g, '|\n|');
  }).join('\n').replace(/\n{3,}/g, '\n\n');
}


/// Lägger hämtad lagtext i citatblock.
///
/// Ett ordagrant citat ur en författning ska se ut som ett citat. Skrivet som
/// löptext blandas källans ord ihop med modellens, och just den skillnaden är
/// vad doktrinen bygger på.
export function arKalltext(stycke, kalltexter) {
  const n = nyckel(stycke);
  if (n.length < 60 || !kalltexter?.length) return false;
  return kalltexter.some(t => { const tn = nyckel(t); return tn.length >= 60 && tn.includes(n); });
}

export function citeraLagtext(stycke, kalltexter) {
  if (!kalltexter?.length) return null;
  return arKalltext(stycke, kalltexter) ? stycke.split('\n').map(r => `> ${r}`).join('\n') : null;
}

/// En rad som inleds med en paragrafbeteckning: "5 a §", "33 d §", "6 §".
const PARAGRAFSTART = /^\s*\d{1,3}\s*[a-zåäö]?\s*§/i;

/// Tar bort citatmärket där texten inte är någons ord utom modellens egna.
///
/// Sett skarpt 2026-09-20 på Maximus Pro: modellen satte > framför varenda
/// stycke, även sina egna slutsatser. Formexemplet i doktrinen lärde den att
/// citera, inte när. Ett svar där allt är citat är lika oläsbart som ett där
/// inget är det, och värre: det suddar ut just den skillnad doktrinen bygger
/// på — vad källan säger mot vad modellen drar för slutsats.
///
/// Bara märket tas bort. Inga ord ändras.
function avcitera(stycke, kalltexter) {
  if (!kalltexter?.length) return stycke;          // Går inte att avgöra — låt stå.
  if (/^\s*>\s*\[!/.test(stycke)) return stycke;   // Rutor är inte citat.
  const rader = stycke.split('\n');
  if (!rader.every(r => /^\s*>/.test(r))) return stycke;
  const ren = rader.map(r => r.replace(/^\s*>\s?/, '')).join('\n');
  // Ett citat som inleds med en paragrafbeteckning är ett lagcitat även när
  // modellen kortat det med uteslutningstecken. Utan undantaget föll
  // "5 a § ... eller 2. under en period då..." tillbaka till löptext, för
  // ellipsen bryter den ordagranna jämförelsen.
  if (PARAGRAFSTART.test(ren)) return stycke;
  return arKalltext(ren, kalltexter) ? stycke : ren;
}

/// Stryker identiska rader i en tabell.
///
/// Sett skarpt: samma rad — "Vad källan säger | Arbetsgivaren har visat att
/// arbetstagaren inte behöver stå till förfogande | 11 § LAS" — upprepad tills
/// taket slog i. Tabellblock är orörda av dubblettvakten, som arbetar på
/// meningar i prosa, så raderna överlevde alla andra skydd.
export function rensaTabell(block) {
  const rader = block.split('\n');
  if (rader.filter(r => /^\s*\|/.test(r)).length < 3) return block;
  const sedda = new Set();
  return rader.filter(r => {
    if (!/^\s*\|/.test(r)) return true;
    const n = nyckel(r);
    if (/^[\s|:-]*$/.test(r)) return true;      // skiljeraden
    if (sedda.has(n)) return false;
    sedda.add(n);
    return true;
  }).join('\n');
}

/// Tak på antal rutor, per sort.
///
/// Doktrinen säger "sparsamt — tre rutor i ett svar är noll rutor". Skarpt
/// 2026-09-20 skrev Maximus Pro trettio, och de sista tio var modellen som
/// pratade med sig själv: "Användaren behöver ett slut på svaret", "Sluta
/// här". Fortsättningsskrivningen förstärkte urartningen i stället för att
/// avsluta den.
///
/// Första rutan av varje sort behålls. Resten faller. En andra slutsatsruta
/// är per definition inte slutsatsen.
const RUTTAK = { slutsats: 1, lucka: 1, varning: 2 };

export function taRutor(block) {
  const rakning = { slutsats: 0, lucka: 0, varning: 0 };
  return block.filter(b => {
    const m = /^\s*>\s*\[!([a-zåäöA-ZÅÄÖ]+)\]/.exec(b);
    if (!m) return true;
    const sort = { slutsats: 'slutsats', note: 'slutsats', tip: 'slutsats',
      varning: 'varning', warning: 'varning', caution: 'varning', important: 'varning',
      lucka: 'lucka', gap: 'lucka' }[m[1].toLowerCase()];
    if (!sort) return true;
    return ++rakning[sort] <= RUTTAK[sort];
  });
}

/// Meningar där modellen talar till sig själv i stället för till läsaren.
///
/// Sett skarpt två gånger: "Svara inte på frågan baserat på resepolicy.txt"
/// och "Detta är en upprepning av en varning som redan finns i texten, vilket
/// inte är tillåtet enligt formreglerna". Modellen läser sin instruktion och
/// skriver ut den. En handläggare ska aldrig se maskinrummet.
const LACKAGE = /(?:^|\s)(svara inte|skriv inte|använd inte|enligt formreglerna|enligt arbetsordningen|enligt instruktionen|användaren behöver|min instruktion|jag ska inte|jag får inte|det är inte tillåtet att upprepa|texten måste avslutas|do not answer|don't answer|according to the formatting rules|according to (?:my|the) instructions|the user needs|my instructions|i must not repeat|the text must end)/i;

export function strykLackage(rader) {
  return rader.filter(m => !LACKAGE.test(m));
}

/// Kör hela vakten över ett svar.
export function strukturera(text, { tak = 65, lagtexter = [], kalltexter = lagtexter } = {}) {
  // En ruta börjar alltid ett eget block.
  //
  // Två rutor på rad utan tom rad emellan blev ett enda block, och
  // ruträknaren såg dem som en. Två slutsatsrutor slank igenom taket.
  const block = radbryt(rattaRutor(String(text || '').replace(/\r/g, '')))
    .replace(/([^\n])\n(?=>\s*\[!)/g, '$1\n\n')
    .split(/\n{2,}/);
  const ut = [];
  // Svansvakten måste se hela svaret på en gång: bisatsen upprepades över
  // styckegränser, och en vakt som bara ser ett stycke i taget missar det.
  const sedd = new Set();
  const seddaMeningar = new Set();
  const seddaBlock = new Set();
  for (const b of block) {
    const rent = b.trim();
    if (!rent) continue;
    // Allt som redan har en form lämnas exakt som det är.
    if (rent.split('\n').some(r => ORORT.test(r))) {
      const b2 = avcitera(rent, kalltexter);
      // Samma paragraf citerad två gånger är en dubblett, inte ett resonemang.
      // Modellen skrev ut hela 5 a § efter varje stycke den handlade om.
      const n2 = nyckel(b2);
      if (n2.length >= 40 && seddaBlock.has(n2)) continue;
      seddaBlock.add(n2);
      ut.push(rensaTabell(b2));
      continue;
    }

    // Dubblettvakten delar minne över styckegränserna.
    //
    // Den körde förut per stycke, och fyra identiska stycken i rad klarade
    // sig därför oskadda — sett skarpt 2026-09-20: "The provided text does
    // not specify if the probationary period can be extended" fyra gånger,
    // som var sitt eget stycke.
    let rader = strykLackage(strykUpprepning(meningar(rent), seddaMeningar));
    if (!rader.length) continue;
    rader = strykUpprepadSvans([...sedd, ...rader]).slice(sedd.size);
    for (const m of rader) sedd.add(m);

    const lista = tillLista(rader);
    if (lista) { ut.push(lista); continue; }

    for (const stycke of brytStycken(rader, { tak })) {
      // Lagcitat som modellen glömt märka får sitt märke. Att en paragraf
      // står som löptext är samma fel som att en slutsats står som citat,
      // bara åt andra hållet: källans ord och modellens blandas ihop.
      const citat = citeraLagtext(stycke, kalltexter)
        || (PARAGRAFSTART.test(stycke) ? stycke.split('\n').map(r => `> ${r}`).join('\n') : null);
      ut.push(citat || stycke);
    }
  }
  return taRutor(ut).join('\n\n');
}
