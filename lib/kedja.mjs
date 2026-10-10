// Kedjan. Tre steg, och användaren ser alla tre.
//
//   1 maskera      regel + lokal modell. Kartan skapas.
//   2 visa         den maskerade texten, att läsa och att ta med sig
//   3 svara        den lokala modellen skriver svaret, här
//
// Här stod fem steg, och två av dem var en väg ut: skicka till en frontier
// och återställ namnen i svaret. Den vägen är borttagen — se
// lib/behandling.mjs för beslutet och skälen.
//
// Kvar är det MAXIMUS gör bäst. Maskeringen är inte längre förberedelsen inför
// en sändning; den ÄR produkten. Du skriver som du verkligen skulle skrivit,
// och får tillbaka en version som går att visa vem som helst — och ett svar
// från en modell som aldrig lämnade datorn.

import { maskera, granska, avmaskera, ommaskera } from './maskering.mjs';
import { hittaFynd, maskeraFynd, grindSvarar } from './grind.mjs';
import { maskeraDelar, maskeraOkanda, maskeraFornamn, skydda, rensaOsynliga } from './failclosed.mjs';
import * as Namnmodell from './namnmodell.mjs';
import { strukturera } from './struktur.mjs';
import { atertolka } from './atertolka.mjs';
import { svaraLokalt, langd, molnNamn } from './lokal.mjs';
import { tx } from './sprakstod.mjs';

/// Vem som svarade, ärligt (Fas 51): den lokala modellen, eller molnet med
/// det maskerade. Ett kvitto som sa "ingenting lämnade datorn" när frågan
/// gått till en molnmodell vore en rad som ljuger.
const svarare = () => {
  const m = molnNamn();
  return m ? { aktor: tx('lib.kedja.molnmodell', { m }), lokalt: false, ut: tx('lib.kedja.gickMaskerad', { m }), frontier: m }
    : { aktor: tx('lib.kedja.lokalModell'), lokalt: true, ut: tx('lib.kedja.ingentingLamnade'), frontier: tx('lib.kedja.lokalModell') };
};
import { raden } from './nu.mjs';
import { tillInstruktion } from './policy.mjs';
import { personatext } from './persona.mjs';
import { uppgiften, uppgiftsvink, slutlig, inramaUtkast } from './uppgift.mjs';
import { kris, tillModellen } from './stod.mjs';
import { arPersonlig, tonvink, utanDom } from './ton.mjs';
import { kanskeFlera, planera } from './delar.mjs';
import { byggBilaga } from './uppslag.mjs';
import { bedom as bedomRojning } from './rojning.mjs';
import { valj } from './urval.mjs';
import { sakerstallModell } from './modell.mjs';

/// Steg 1: allt som ska maskeras, maskeras.
///
/// Grinden har två hastigheter, och den snabba är förvalet.
///
/// Det är inte en kompromiss utan en mätning. På nio provprompter fångar
/// reglerna plus namnvakten 50 av 50 namn, orter och arbetsplatser — på två millisekunder, utan att någon modell startats.
/// Den lokala modellen tog 3,3 sekunder i snitt och hittade ingenting som
/// reglerna missat.
///
/// Så modellen är inte borttagen, den är befordrad till det den är bra på:
/// det som inte ser ut som ett egennamn men ändå pekar ut någon. "Min
/// svärson som är driftchef hos leverantören" innehåller inte en enda
/// versal, och ingen regel i världen ser den. Det är vad `tolka` är till
/// för, och det är därför den kostar sekunder och är avstängd tills den
/// efterfrågas.
///
/// Ordningen är inte godtycklig. Reglerna går först, så att modellen inte
/// kan råka läsa ett personnummer som ett datum. Modellen går sist, och den
/// kan bara lägga till maskeringar — aldrig ta bort en. En modell som kan
/// avmaskera är en modell som kan läcka.
/// Den deterministiska maskeringen, utan modell. Fyra pass, ingen väntan.
///
/// Bruten ur `forbered` för att historiken måste gå genom exakt samma grind.
/// Provet 2026-09-20 visade varför: tur ett skickade "[NAMN B] avled", men när
/// samma fråga togs med som sammanhang i tur två stod det "Gun-Britt avled" i
/// klartext. Originalet är sparat omaskat — som det ska vara, det är
/// användarens text — och `ommaskera` byter bara ut exakta kartnycklar.
/// "Gun-Britt Ohlsson" stod i kartan, "Gun-Britt" gjorde det inte.
///
/// Granskningen fångade det inte heller, och kunde inte: ett förnamn har
/// inget format. Bara namnvakten ser det, och därför måste namnvakten se allt
/// som går ut — inte bara den senaste frågan.
export function maskeraHart(text_, { karta = new Map(), raknare = new Map(), sorter = null } = {}) {
  // 0. Det vi redan vet.
  //
  // Kartan tillämpas FÖRST, innan någon ny detektion körs. Den innehåller
  // allt som tidigare i samtalet fått en platshållare — också sådant som
  // inget mönster hittar igen.
  //
  // Revisionen 2026-09-28 (M3) visade varför: kartposten
  // `min svärson som är driftchef hos leverantören` → `[ROLL A]` var satt av
  // modellen i en tidigare tur. När historiken maskerades om kördes bara ny
  // detektion, och ingen regel känner igen en relationsbeskrivning. Frasen
  // gick ut ordagrant, i ett samtal där den redan bedömts som känslig.
  //
  // Det räcker alltså inte att maskera om historiken. Den måste maskeras om
  // med det man redan beslutat, annars är varje tur en ny bedömning av samma
  // text — och en modell som bedömer två gånger bedömer olika.
  //
  // Längsta originalet först, så att "Erik Svensson" blir en platshållare och
  // inte "[NAMN A] Svensson"; det sköter ommaskera(). Och detektionen nedan
  // körs ändå efteråt, så ett fragment som blir kvar fångas där.
  // Osynliga tecken bort först (2026-10-09, granskningen): ett nollbreddstecken
  // mitt i "Anna" delade namnet för vakterna men inte för mottagaren.
  const kant = ommaskera(rensaOsynliga(text_ || ''), karta);

  // 1. Format. Personnummer, e-post, telefon, kontonummer.
  const regel = maskera(kant, { karta, raknare, sorter });
  const funna = [...regel.funna];

  // 2. Lyft undan det som måste överleva ordagrant.
  const skyddat = skydda(regel.text);

  // 3–5. Namnvakterna. De gäller bara när namn, orter eller verksamheter
  //      ska döljas — en säkerhetsincident behöver sällan dölja vem som
  //      upptäckte den, men alltid vilken server det gäller.
  const namnPa = !sorter || sorter.has('namn') || sorter.has('ort') || sorter.has('organisation');
  let text = skyddat.text;
  if (namnPa) {
    const okanda = maskeraOkanda(text, { karta, raknare });
    funna.push(...okanda.funna);
    const forn = maskeraFornamn(okanda.text, { karta, raknare });
    funna.push(...forn.funna);
    const delar = maskeraDelar(forn.text, karta);
    funna.push(...delar.funna);
    text = delar.text;
    // 6. Namnmodellen, efter reglerna och bara som tillägg (Auro
    //    2026-10-10). Den läser inget här — det den redan
    //    läst i texten hämtas ur minnet, och har den inte läst något gäller
    //    reglerna som förut. Se lib/namnmodell.mjs.
    const nm = Namnmodell.maskeraNamnmodell(text, Namnmodell.fyndFor(text_ || ''), { karta, raknare, sorter });
    funna.push(...nm.funna);
    text = nm.text;
  }

  return { text, funna, skyddat, karta, raknare };
}

export async function forbered(fraga_, { signal, onSteg = () => {}, tolka = false, karta: inKarta = [], raknare: inRaknare = {}, sorter = null, modelltak = null } = {}) {
  const t0 = Date.now();
  // Namnmodellen läser texten först. Går den inte att ladda händer
  // ingenting här, och reglerna gäller. Det som förbereds här kan gå ut (sökfrågor, molnet): utan tidsgräns,
  // utom när anroparen uttryckligen sagt hur länge (en fil som läggs till
  // läses färdigt i bakgrunden, och skickas den går den genom molnvägen).
  await Namnmodell.forbered([String(fraga_ || '')], modelltak == null ? { helt: true } : { tak: modelltak }).catch(() => {});
  const kvitto = [];
  onSteg({ steg: 'maskera', text: tx('lib.kedja.steg.maskera') });

  // Sessionens karta följer med in.
  //
  // Utan den föds kartan om varje tur, och [NAMN A] i fråga två är en annan
  // människa än [NAMN A] i fråga ett. Frontier får då en historia där
  // personerna byter namn mitt i, vilket är värre än ingen historia alls.
  // Samma person ska ha samma platshållare så länge sessionen lever.
  const karta = new Map(inKarta.map(k => [k.original, k.platshallare]));
  const raknare = new Map(Object.entries(inRaknare));

  const foreAntal = inKarta.length;
  const hart = maskeraHart(fraga_, { karta, raknare, sorter });
  const funna = [...hart.funna];
  const skyddat = hart.skyddat;
  let text = hart.text;

  kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.regler'), vad: tx('lib.kedja.maskerade', { n: karta.size - foreAntal }),
    ms: Date.now() - t0, lokalt: true });

  // Lägg tillbaka de skyddade uttrycken FÖRE tolkningen.
  //
  // Sentinellen var osynlig för reglerna och jag skrev att den var osynlig
  // för allt. Den var inte osynlig för en modell: grinden läste `S0` som ett
  // organisationsnamn och maskerade den, så "lex Maria" blev
  // "[ORGANISATION B]" — och eftersom sentinellen då var borta kunde den
  // aldrig läggas tillbaka. En platshållare utan väg hem.
  text = skyddat.aterstall(text);

  // Tolkningen, om den efterfrågats. Den lägger bara till.
  let varning = null, tolkad = false;
  if (tolka) {
    const tm = Date.now();
    const foreModell = karta.size;
    if (!(await grindSvarar())) {
      varning = tx('lib.kedja.tolkningInteIgang');
      kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.lokalModell'), vad: tx('lib.kedja.svaradeInte'), ms: Date.now() - tm, lokalt: true, fel: true });
    } else {
      onSteg({ steg: 'tolka', text: tx('lib.kedja.steg.tolka') });
      try {
        const fynd = await hittaFynd(text, { signal });
        const av = maskeraFynd(text, fynd, { karta, raknare });
        text = av.text;
        funna.push(...av.funna);
        // Ett nytt fynd kan ha lösa delar kvar.
        const igen = maskeraDelar(text, karta);
        text = igen.text;
        funna.push(...igen.funna);
        tolkad = true;
        const extra = karta.size - foreModell;
        kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.lokalModell'), lokalt: true, ms: Date.now() - tm,
          vad: extra ? tx('lib.kedja.hittadeTill', { n: extra }) : tx('lib.kedja.ingetMer') });
      } catch (e) {
        varning = tx('lib.kedja.tolkningSvaradeInte', { fel: e.message });
        kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.lokalModell'), vad: tx('lib.kedja.svaradeInte'), ms: Date.now() - tm, lokalt: true, fel: true });
      }
    }
  }

  // Granska från noll, oavsett vad som hänt ovanför.
  const kvar = granska(text, sorter);

  const helaKartan = [...karta.entries()].map(([original, platshallare]) => ({ original, platshallare }));

  // Vad som står kvar när namnen är borta.
  //
  // OSL skyddar inte namnet utan uppgiften om den enskildes personliga
  // förhållanden, och den uppgiften går inte att maskera bort — den ÄR
  // frågan. Så MAXIMUS maskerar den inte, den räknar hur många oberoende
  // dimensioner som beskriver samma person och säger det.
  const rojning = bedomRojning(text, { maskerade: helaKartan.length - foreAntal });

  return {
    original: fraga_,
    maskerad: text,
    karta: helaKartan,
    // Bara det som är nytt i den HÄR frågan ska visas i grinden. Resten har
    // användaren redan sett och godkänt en gång.
    nya: helaKartan.slice(foreAntal),
    raknare: Object.fromEntries(raknare),
    funna, kvar, varning, tolkad, kvitto, rojning,
  };
}

/// Den utgående vägen är borttagen.
///
/// Här låg `skicka()`: maskera, granska, skicka till en frontier, återställ
/// namnen i svaret. Beslutet 2026-09-29 tog bort den. MAXIMUS är grinden, inte
/// röret — se lib/behandling.mjs för skälen.
///
/// Det som var den här funktionens riktiga arbete finns kvar och används av
/// den lokala vägen: maskeringen, granskningen före det som lämnar datorn,
/// och kartan som håller samma person vid samma platshållare. Det som
/// försvann var transporten.

export async function lokaltSvar(fraga_, { signal, onSteg = () => {}, onText, onDel = () => {}, historik = [], sammandrag = '', bilagor = [], policy = '', underlag = '', aterkallat = '', bilder = null, persona = null, profil = '' } = {}) {
  const t0 = Date.now();
  const kvitto = [];
  let omstart = false;

  // Lokalt får modellen originalen. Ingenting lämnar datorn, så det finns
  // ingenting att dölja för den — och verksamhetens regler följer med som
  // de gör ut.
  //
  // Den här raden försvann en gång utan att något sa till. Två ändringar
  // riktade sig mot samma rad, den ena åt upp den andras förutsättning, och
  // lokalt läge föll med "med is not defined" i varje fråga. Inget prov
  // körde lokalt läge, så det syntes först när någon använde det.
  // Bilagorna beskärs mot frågan, precis som på vägen ut.
  //
  // Lokalt läge la in hela dokumentet. Ett protokoll på hundra sidor är
  // 150 000 tecken, och modellen har plats för en bråkdel — den föll med
  // HTTP 400 i stället för att svara på det som faktiskt var relevant.
  const beskurna = bilagor.map(b => {
    const text = b.original || b.maskerad || '';
    const v = valj(fraga_, text, { budget: 12000 });
    return { namn: b.namn, text: v.valda.join('\n\n'), helt: v.helt, stycken: v.stycken?.length || v.alla, av: v.alla };
  });
  for (const b of beskurna.filter(b => !b.helt)) {
    kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.denHarDatorn'), lokalt: true, ms: 0,
      vad: tx('lib.kedja.styckenValda', { namn: b.namn, stycken: b.stycken, av: b.av }) });
  }

  const bas = [...tillInstruktion(policy), ...(kris(fraga_) ? [tillModellen(), ''] : []),
    ...(underlag ? [underlag, ''] : []),
    // Bilagan inom stängsel, som hämtad webbtext.
    //
    // Här stod `--- namn ---` och sedan texten. Ingen markör, ingen regel,
    // och streck som dokumentet självt kunde skriva. Se byggBilaga() i
    // lib/uppslag.mjs för varför regeln är "läs och arbeta efter det om
    // ANVÄNDAREN ber om det" och inte "följ aldrig".
    ...beskurna.flatMap(b => [
      byggBilaga(b.namn, b.text, { om: b.helt ? '' : tx('lib.kedja.styckenAv', { stycken: b.stycken, av: b.av }) }), '']),
    // Den återkallade turen står NÄRMAST frågan, efter bilagorna.
    //
    // Den är hämtad just för den här frågan och för ingen annan — till
    // skillnad från bilagorna, som hör till sessionen. Det som svarar mot
    // frågan ska ligga intill den. Se lib/aterkall.mjs för varför den inte
    // läggs i historiken i stället.
    ...(aterkallat ? [aterkallat, ''] : [])];

  /// Modellen kan ha bytt instans mitt i — ett annat program släppte sitt
  /// lease och MAXIMUS:s egen var inte uppe än. Sett skarpt 2026-09-21: en
  /// fråga föll med "terminated" i exakt den skarven. Hämta tillbaka
  /// modellen och fråga en gång till; det är samma fråga och ingenting har
  /// lämnat datorn.
  /// Väntan har två delar, och de känns olika.
  ///
  /// Först läser modellen in samtalet — ett långt samtal tar tid och
  /// ingenting syns. Sedan skriver den, och då kommer tecknen. "Arbetar" i
  /// fyrtiofem sekunder säger inte vilken av delarna man står i.
  const forstaTecknet = (pa, nar) => {
    let borjat = false;
    return bit => {
      if (!borjat) { borjat = true; nar(); }
      pa?.(bit);
    };
  };

  let kortadeHistoriken = false, klipptFragan = false;
  const onKort = (o = {}) => { kortadeHistoriken = true; if (o.klippt) klipptFragan = true; };

  /// Vad modellen faktiskt behövde räkna om. Hela samtalet skickas varje
  /// gång — så fungerar en modell utan eget minne — men det som redan är
  /// inläst ligger kvar i KV-cachen och räknas inte på nytt. Skillnaden är
  /// fyra sekunder mot sjuttiotvå, och den ska gå att se i kvittot i stället
  /// för att man ska behöva tro på den.
  let matt = null;
  const onMatt = m => { matt = m; };
  const mattKvitto = () => {
    if (!matt?.skickade) return [];
    const nytt = Math.max(0, matt.skickade - matt.cachade);
    return [{ tid: new Date().toISOString(), aktor: tx('lib.kedja.lokalModell'), lokalt: true, ms: 0,
      vad: matt.cachade
        ? tx('lib.kedja.nyaTokens', { nytt, cachade: matt.cachade, skickade: matt.skickade })
        : tx('lib.kedja.franBorjan', { skickade: matt.skickade }) }];
  };

  const kor = async (med, pa) => {
    try { return await svaraLokalt(med, { historik, sammandrag, signal, onText: pa, onKort, onMatt, plats: 'samtal', bilder, medTid: true, persona, profil }); }
    catch (e) {
      if (!e.borde_starta_om || signal?.aborted) throw e;
      onSteg({ steg: 'laddar', text: tx('lib.kedja.steg.laddar') });
      await sakerstallModell();
      omstart = true;
      return svaraLokalt(med, { historik, sammandrag, signal, onText: pa, onKort, onMatt, plats: 'samtal', bilder, medTid: true, persona, profil });
    }
  };
  const historikKvitto = () => !kortadeHistoriken ? []
    : [{ tid: new Date().toISOString(), aktor: tx('lib.kedja.denHarDatorn'), lokalt: true, ms: 0,
        // Det som klipptes var frågan själv — underlaget i den — och då ska
        // det stå, inte att "de äldsta frågorna" föll bort (2026-10-06).
        vad: klipptFragan
          ? tx('lib.kedja.klippt')
          : sammandrag
          ? tx('lib.kedja.sammandrag')
          : tx('lib.kedja.forLangt') }];

  const plan = await tillPlan(fraga_, { onSteg, kvitto, signal });

  if (plan) {
    const delar = [{ rubrik: tx('lib.kedja.planen'), svar: planText(plan) }];
    onDel({ index: 0, rubrik: tx('lib.kedja.planen') });
    onText?.(delar[0].svar, 0);

    for (const [i, d] of plan.delar.entries()) {
      onDel({ index: i + 1, rubrik: tx('lib.kedja.delAv', { i: i + 1, n: plan.delar.length }), fraga: d });
      onSteg({ steg: 'lokalt', text: tx('lib.kedja.steg.laserDel', { i: i + 1 }) });
      const td = Date.now();
      const ra = await kor(delfraga(bas, fraga_, plan, delar, d),
        forstaTecknet(bit => onText?.(bit, i + 1), () => onSteg({ steg: 'skriver', text: tx('lib.kedja.steg.skriverDel', { i: i + 1 }) })));
      delar.push({ rubrik: tx('lib.kedja.del', { i: i + 1 }), fraga: d, svar: strukturera(ra), ms: Date.now() - td });
      kvitto.push({ tid: new Date().toISOString(), aktor: svarare().aktor, lokalt: svarare().lokalt, ms: Date.now() - td,
        vad: tx('lib.kedja.svaradeDel', { i: i + 1, n: ra.length }) });
    }
    // ── Planen slutar i produkten, inte i delarna ────────────────────────
    //
    // Delarna är arbete. Bad någon om en text är en plan som slutar i fyra
    // råd en plan för modellen själv, lämnad kvar på skärmen.
    //
    // Sett skarpt 2026-09-29: frågan var "vinkla om texten, mjuka upp tonen,
    // ta bort punktformerna — det är ett LinkedIn-inlägg, inte en rapport."
    // MAXIMUS svarade med fyra råd om hur man gör, och användaren fick skriva
    // "Bra, langa en fullständig text nu då…".
    //
    // Ett steg till, bara när frågan bad om något att kopiera. Delarna står
    // kvar under — de är resonemanget, och det ska gå att läsa.
    if (uppgiften(fraga_)) {
      const rubrik = { sammanfattning: tx('lib.kedja.sammanfattningen'), underlag: tx('lib.kedja.beslutsunderlaget') }[uppgiften(fraga_)?.vad]
        || tx('lib.kedja.fardigaTexten');
      onDel({ index: delar.length, rubrik });
      // Steget säger vilken sorts produkt det blir. "Skriver ihop det till en
      // färdig text" stod också när frågan bett om ett beslutsunderlag.
      onSteg({ steg: 'skriver', text: { sammanfattning: tx('lib.kedja.steg.sammanfattning'),
        underlag: tx('lib.kedja.steg.underlag') }[uppgiften(fraga_)?.vad]
        || tx('lib.kedja.steg.fardig') });
      const ts = Date.now();
      const ra = await kor(
        [...bas, tx('lib.kedja.prompt.stallde'), fraga_, '',
          tx('lib.kedja.prompt.idelar'),
          ...delar.slice(1).map(d => `${d.fraga || d.rubrik}\n${kortat(d.svar, 1400)}`),
          '', slutlig(fraga_)].join('\n').trim(),
        forstaTecknet(bit => onText?.(bit, delar.length), () => {}));
      delar.push({ rubrik, svar: strukturera(inramaUtkast(ra, fraga_)), ms: Date.now() - ts });
      kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.lokalModell'), lokalt: true,
        ms: Date.now() - ts, vad: tx('lib.kedja.skrevIhop', { rubrik: rubrik.toLowerCase(), n: ra.length }) });
    }

    // En del som bara säger att den redan är besvarad är ingen del. Fyra
    // rubriker med "Den här delen är redan besvarad ovan." under stod i ett
    // svar 2026-10-04. Raden var rätt instruktion till modellen, men fel
    // sak att visa: den tas bort ur det som står kvar.
    // Engelskan också: modellen skriver på ditt språk.
    const tomma = /^\s*(den här delen är (redan )?besvarad|delen är redan besvarad|this part (is|has|was) (already )?(been )?(answered|covered)|already (answered|covered) above)[^\n]{0,80}$/i;
    const visas = delar.filter((d, i) => i === 0 || !tomma.test(String(d.svar || '').trim()));
    return { svar: sammanfoga(visas), delar: visas, ravar: sammanfoga(visas), frontier: svarare().frontier,
      aterstallda: 0, anmarkningar: [],
      kvitto: [...klarKvitto(kvitto, omstart, t0, true), ...historikKvitto(), ...mattKvitto()] };
  }

  // Längden och tonen läggs på samma rad som frågan, i användarens röst.
  // Mätt: någon annan placering gör att modellen tappar sammanhanget.
  const med = [...bas, fraga_ + langd(fraga_) + tonvink(fraga_, historik) + uppgiftsvink(fraga_)]
    .join('\n').trim();
  // "Läser in samtalet" lät som att hela samtalet lästes om varje gång. Det
  // gör det inte — bara det som ändrats sedan förra frågan. Steget säger
  // därför vad som pågår, och kvittot säger efteråt vad det kostade.
  onSteg({ steg: 'lokalt', text: tx('lib.kedja.steg.forbereder') });
  const ra = await kor(med, forstaTecknet(onText, () => onSteg({ steg: 'skriver', text: tx('lib.kedja.steg.skriver') })));
  // Kom en fetstilsdom trots instruktionen och vinken tas fetstilen bort.
  // Meningen får stå kvar — det är formateringen som gör den till ett domslut.
  const rent = arPersonlig(fraga_, historik) ? utanDom(ra) : ra;
  // Bad frågan om en text ska den komma i en ruta man kan kopiera — också
  // när modellen glömde bakåtfästena. Se inramaUtkast i lib/uppgift.mjs.
  const ramat = inramaUtkast(rent, fraga_);
  return {
    svar: strukturera(ramat), ravar: rent, frontier: svarare().frontier, delar: [],
    aterstallda: 0, anmarkningar: [],
    kvitto: [...klarKvitto(kvitto, omstart, t0, false), ...historikKvitto(), ...mattKvitto(),
      { tid: new Date().toISOString(), aktor: svarare().aktor, lokalt: svarare().lokalt, ms: Date.now() - t0,
        vad: tx('lib.kedja.svaradeMed', { n: rent.length, ut: svarare().ut }) }],
  };
}

/// Delar upp frågan när reglerna tror att den är flera frågor.
///
/// "Vad gäller vid en lex Maria-anmälan, och hur skriver jag den?" är två
/// frågor, och en modell som får båda i samma prompt svarar ofta halvt på
/// den första och stryker den andra. Planen görs alltid av den lokala
/// modellen, även när svaren ska hämtas utifrån — uppdelningen är tolkning
/// av det användaren vill, och tolkning hör hemma på den här datorn.
async function tillPlan(fraga, { onSteg, kvitto, signal }) {
  if (!kanskeFlera(fraga)) return null;
  onSteg({ steg: 'planerar', text: tx('lib.kedja.steg.planerar') });
  const tp = Date.now();
  const plan = await planera(fraga, { signal });
  kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.lokalModell'), lokalt: true, ms: Date.now() - tp,
    vad: plan ? tx('lib.kedja.delade', { n: plan.delar.length }) : tx('lib.kedja.enFraga') });
  return plan;
}

/// Planen som text: meningen, och sedan delarna numrerade.
///
/// Meningen får inte räkna. Modellen skrev "jag delar upp frågan i fem delar"
/// och fick tre, för taket låg på tre medan meningen skrevs fritt. Numren
/// byggs ur listan och har alltid stämt — det var meningen som ljög. Taket är
/// sex nu, men en mening som ändå nämner ett antal stryks: hellre ingen
/// inledning än en som säger fel.
const RAKNAR = /(?<![\p{L}\p{N}])(två|tre|fyra|fem|sex|sju|two|three|four|five|six|seven|\d+)\s+(delar|frågor|punkter|steg|parts|questions|points|steps)(?![\p{L}\p{N}])/iu;

const planText = plan => {
  const mening = plan.plan && !RAKNAR.test(plan.plan) ? plan.plan : '';
  return [mening, mening ? '' : null,
    ...plan.delar.map((d, i) => `${i + 1}. ${d}`)].filter(r => r !== null).join('\n').trim();
};

const sammanfoga = delar => delar.map(d => `**${d.rubrik}${d.fraga ? ` — ${d.fraga}` : ''}**\n\n${d.svar}`).join('\n\n');

/// Prompten för en del. Frågan i sin helhet står kvar som sammanhang, och de
/// svar som redan skrivits följer med så att nästa del inte upprepar dem.
const delfraga = (bas, fraga, plan, klara, d) => [...bas,
  tx('lib.kedja.prompt.stallde'), fraga, '',
  // De tidigare delsvaren följer med för att nästa del inte ska upprepa dem,
  // men bara början av vart och ett. Hela svaret behövs inte för att veta vad
  // som redan är sagt, och tre hela delsvar sprängde kontexten.
  ...(klara.length > 1 ? [tx('lib.kedja.prompt.redanSvarat'),
    ...klara.slice(1).map(k => `${k.fraga}\n${kortat(k.svar, 900)}`), ''] : []),
  // Blev delen redan besvarad ska det sägas på en rad, inte upprepas.
  //
  // Sett skarpt: fyra delar om samma person, där del 1 täckte allt. Del 2
  // inledde med "eftersom du redan har fått information om hans bakgrund i
  // det tidigare svaret" — och skrev sedan en fetstilsrad som sa det igen.
  // Modellen VISSTE att den upprepade sig; den saknade bara tillåtelse att
  // låta bli.
  tx('lib.kedja.prompt.baraDelen'),
  tx('lib.kedja.prompt.redanBesvarad'),
  d + langd(d)].join('\n').trim();

const kortat = (text, n) => text.length <= n ? text : `${text.slice(0, n)}…`;

const klarKvitto = (kvitto, omstart, t0, flera) => [
  ...(omstart ? [{ tid: new Date().toISOString(), aktor: tx('lib.kedja.denHarDatorn'), lokalt: true, ms: 0,
    vad: tx('lib.kedja.omstart') }] : []),
  ...kvitto,
  ...(flera ? [{ aktor: tx('lib.kedja.denHarDatorn'), lokalt: true, ms: Date.now() - t0,
    vad: tx('lib.kedja.ingentingLamnade') }] : []),
];
