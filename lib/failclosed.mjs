
const STOPP = new Set(`
jag du han hon hen den det vi ni de dom denna detta dessa
och eller men om att som är var vara varit blir blev
har hade ska skall skulle kan kunde vill ville får fick måste bör borde
inte ingen inget inga aldrig alltid ofta
en ett den det min mitt mina din ditt dina sin sitt sina vår vårt våra er ert era
hur vad vem vilken vilket vilka när var varför vart
här där nu sedan efter före under över mellan utan med för till från
ja nej kanske tack hej sen alla in nu redan snart strax igår idag imorgon
bara son dotter mark hus gård del bit rad sida plats ställe
mår mådde dåligt bra illa hem bort hit dit ledsen arg trött orolig rädd
glad stressad sjuk frisk nöjd besviken irriterad förbannad lugn spänd
hjälp stöd råd tips svar besked lösning problem fråga sak grej
dnr diarienummer sökande adress telefon mobil datum bilaga sidan sida bakgrund
bedömning beslut förslag utredning ärende ärendet ärenden sammanträde protokoll
närvarande justerare justering paragraf yrkande reservation ordförande sekreterare
anbud anbudet upphandling upphandlingen utvärdering
underleverantör tilldelning jäv jävet
kalkyl poäng poängsättning
verksamheten enheten förvaltningen nämnden
lön lönen lönerna ersättning arvode timmar heltid deltid tjänsten tjänst
anställningen mötet samtalet
klagomålet klagomålen anmälan ärendet utredningen beslutet yttrandet
hela halva varje andra tredje enda samma olika flera många få
måndag tisdag onsdag torsdag fredag lördag söndag
januari februari mars april maj juni juli augusti september oktober november december
kan gäller finns saknas behövs kostar spelar händer verkar betyder låter
tycker tror undrar vill vet minns hoppas behöver ska skulle måste

senast nyligen därefter slutligen dessutom därför således alltså först
numera tidigare ibland oftast främst särskilt framför övrigt övrig
eftersom medan trots istället annars därmed vidare exempelvis
ungefär cirka drygt knappt minst högst totalt sammanlagt
samtidigt därtill dessvärre förvisso givetvis naturligtvis möjligen
troligen sannolikt kanhända visserligen emellertid dock likaså likväl
faktiskt egentligen framförallt huvudsakligen delvis helt delat
numer hittills fortfarande återigen ånyo äntligen plötsligt genast
strax nyss länge sällan aldrig alltid jämt ständigt ofta
gärna helst hellre snarare nästan knappast ingalunda absolut
förresten alltnog således följaktligen exempel bland utöver förutom
enligt gällande angående beträffande rörande avseende
tack tyvärr hoppas kort sammanfattningsvis avslutningsvis inledningsvis
frågan svaret problemet situationen saken ärendet fallet bakgrunden
syftet målet resultatet slutsatsen förslaget beslutet

tidplan tidsplan budget offert avtal kontrakt projekt plan lansering kund leverans faktura pris
kostnad intäkt försäljning marknad strategi rapport agenda presentation workshop kickoff deadline
frist styrgrupp ledning chef team grupp kollega medarbetare personal avdelning bolag företag
organisation styrelse uppdrag leverantör system tjänst produkt version funktion användare risk
åtgärd uppföljning status steg prioritering mål delmål milstolpe dokument underlag anteckning
checklista analys granskning test pilot införande utbildning kommunikation press kampanj ekonomi
siffror prognos kvartal licens abonnemang prenumeration betalning kalender inbjudan påminnelse
mejl mail brev meddelande möte telefonmöte videomöte inspelning avskrift sammanfattning
beslutspunkt punkt lista tabell modell data rutin process krav kravspec specifikation
förbättring ändring schema vecka månad
`.trim().split(/\s+/));

export const OFARLIGA = new Set(`
las mbl aml osl gdpr sfs afs eu sverige svensk svenska
lvu lvm lss sol hsl psl pdl lou luf abl tf rf fl ktl ffs hslf-fs
socialtjänstlagen patientsäkerhetslagen skollagen aktiebolagslagen
handelsbanken swedbank nordea seb danske länsförsäkringar sbab avanza nordnet
skandia folksam if trygghansa alecta amf
arbetsmiljölagen semesterlagen diskrimineringslagen förvaltningslagen
arbetsmiljöverket skatteverket försäkringskassan arbetsdomstolen
kommunal vision unionen saco tco lo akademikerförbundet
hr it vd chef enhetschef avdelningschef förvaltningschef rektor handläggare
medarbetare arbetsgivare arbetstagare facket skyddsombud
socialtjänsten socialnämnden kommunstyrelsen kommunfullmäktige
utbildningsförvaltningen miljöförvaltningen
tekniska nämnden hr-avdelningen kommunen regionen
skolinspektionen skolverket ivo imy bolagsverket kronofogden domstolsverket
diskrimineringsombudsmannen justitieombudsmannen konkurrensverket
förvaltningsrätten kammarrätten tingsrätten hovrätten polisen åklagarmyndigheten
danmark norge finland island tyskland england frankrike polen estland lettland litauen
norden eu-domstolen europadomstolen
förskolan skolan gymnasiet universitetet sjukhuset vårdcentralen akuten
verksamhetschef avdelningen kliniken mottagningen enheten sektionen
sjuksköterskan undersköterskan läkaren överläkaren underläkaren patienten
anhöriga vårdnadshavare eleven kollegan leverantören anbudet
klient klienten motpart motparten huvudman ombud målsägande
vårdnad umgänge bodelning arvskifte konkurs
adhd add autism asperger npf dyslexi bipolaritet depression utmattning
diagnos sjukskrivning rehabilitering avstängning
lägenhet villa fastighet förskola trädgården arbetsmiljö
utredning utredningen anmälan anmälan yttrande yttrandet beslut protokoll
sammanfattning bakgrund bedömning slutsats åtgärd åtgärder underlag bilaga
journal journalen anteckning anteckningar rapport rapporten avvikelse
dokument dokumentet handling handlingen akten ärende diarium
kapitel paragraf stycke punkt avsnitt rubrik datum tid plats
avtal avtalet faktura fakturan offert anbud upphandling tilldelning
incident incidenten loggen logg kostnad kostnaden intäkt summa belopp
systemet servern databasen miljön kontot mappen filen katalogen
klockan tiden dagen veckan månaden året perioden
lokalen byggnaden
`.trim().split(/\s+/));

import { FORNAMN } from './fornamn.mjs';
import { aktuellt } from './sprakstod.mjs';
import { readFileSync } from 'node:fs';
import { maskera, ommaskera, granska, maskeraKvar, etikett } from './maskering.mjs';

const ARPLATSHALLARE = /^\[[A-ZÅÄÖ][A-ZÅÄÖ0-9\s-]*\s[A-Z]+\]$/;

const OSYNLIGA = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\p{Cf}\u034f\u115f\u1160\u17b4\u17b5\u3164\uffa0\ufe00-\ufe0f\u{e0100}-\u{e01ef}]/gu;
export function rensaOsynliga(t) {
  let ut = String(t ?? '');
  for (let forra = null; ut !== forra;) { forra = ut; ut = ut.replace(OSYNLIGA, '').normalize('NFKC'); }
  return ut;
}

function bokstav(n) { let s = ''; while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }

const SUBSTANTIV = /(?:orna|arna|erna|ingen|ningen|heten|skapet|andet|endet|tionen|elsen)$/u;

const ANDELSER = [/s$/, /n$/, /en$/, /et$/, /na$/, /arna$/, /erna$/, /orna$/];

const skala = o => o.replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e');
export const VANLIGA = new Set(
  readFileSync(new URL('../data/vanliga-ord.txt', import.meta.url), 'utf8')
    .split('\n').filter(r => r && !r.startsWith('#')).map(r => r.split('\t')[0]));

const SKALADE = new Set([...STOPP, ...OFARLIGA].map(skala));

const VARDAGSORD = new Set('tala lova stig dan frank vide vida tom max bror kris lina rut'.split(' '));

const VERB = new Set('använd avboka berätta beställ betala bjud boka börja dela fixa flytta fortsätt fråga följ förbered försök ge glöm granska gå gör hjälp hälsa hämta hör ihåg jämför kolla kom kontrollera köp kör lansera leverera lyssna lägg läs läsa låt lös mejla notera ordna planera prata prioritera påminn ring ringa sammanfatta skicka skjut skriv skriva sluta spara starta stoppa ställ stäng svara säg sälj sätt tacka testa titta träffa tänk undvik uppdatera välj vänd vänta ändra öppna'.split(' '));

const engelska = f => readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8')
  .split('\n').filter(r => r && !r.startsWith('#')).map(r => r.split('\t'));
const EN_ALLA_ORD = engelska('engelska-ord.txt').map(r => r[0]);
const EN_ORD = new Set(EN_ALLA_ORD.filter(o => !FORNAMN.has(o)));
const EN_NAMNORD = new Set([...engelska('engelska-namnord.txt').map(r => r[0]), ...EN_ALLA_ORD.filter(o => FORNAMN.has(o))]);
const EN_ANDEL = new Map(engelska('engelska-fornamn.txt').map(([n, a]) => [n, Number(a)]));
const EN_EFTERNAMN = new Set(engelska('engelska-efternamn.txt').map(r => r[0]));
const vanligtNamn = n => (EN_ANDEL.get(n) || 0) >= 0.0005;

const STOPP_EN = new Set(`
i me my mine myself you your yours yourself yourselves he him his himself she her hers herself
it its itself we us our ours ourselves they them their theirs themselves
a an the this that these those some any each every either neither both all none no not nor
and or but so yet for because although though while whereas if unless until since than as
of to in on at by from with without within into onto upon about above below over under after before
between among through during against across along around behind beyond near off out up down
is am are was were be been being have has had having do does did done doing
will would shall should can could may might must ought need dare
what which who whom whose when where why how whatever whoever wherever however whenever
here there now then today tonight tomorrow yesterday soon later already still just only also too very
yes no ok okay hi hello hey dear thanks thank please sorry regards sincerely cheers best kind warm
monday tuesday wednesday thursday friday saturday sunday
january february march april may june july august september october november december
mr mrs ms miss mx dr prof sir madam
ceo cfo cto coo cio vp svp evp hr it pm pr qa ui ux ai ml api sdk pdf csv faq fyi asap eod eow eta tbd
kpi okr roi crm erp sla nda rfp rfq gdpr hipaa ccpa sox iso ssn ein vat tax llc ltd inc corp plc co
us usa uk eu un nato nhs irs fbi cia nasa fda sec ftc dhs ok tv id
google microsoft apple amazon linkedin facebook meta instagram twitter youtube whatsapp
excel word powerpoint outlook teams zoom slack gmail iphone ipad mac macos windows android
chatgpt openai claude anthropic notion jira confluence salesforce hubspot
america england britain scotland wales ireland canada australia sweden norway denmark finland
germany france spain italy netherlands poland china japan india mexico brazil russia ukraine
european american british english swedish
`.trim().split(/\s+/));

const NAMNLIKA_STOPP = new Set([...STOPP_EN].filter(vanligtNamn));
const MANADER_EN = new Set('january february march april may june july august september october november december'.split(' '));
const VALUTOR = new Set('sek eur usd gbp nok dkk chf jpy'.split(' '));
const valuta = (d, fore = '', efter = '') => VALUTOR.has(d.toLowerCase()) && d === d.toUpperCase()
  && (/\d[\d\s.,]*$/.test(fore) || /^\s*\d/.test(efter));

const ORD_FORST = new Set(`frank mark carol grace jack crystal jean rose hazel amber pearl dawn ruby robin
earl warren hunter daisy will angel destiny mason may brandy dale lily misty flora don holly bill ray chase
sue violet victor gene faith opal trinity rosemary olive penny jay belle guy bob cooper dean lance autumn
august jade joy sandy genesis grant pat serenity summer glen earnest junior melody ebony fern drew hope
raven chance diamond ginger piper charity iris jasper cadence jewel fay heath merle wade nick drake tucker
marina tiara heaven beau cash chuck newton lane dock gale candy laurel buddy aurora justice harper ivy arch
harmony sherry lee martin heather jasmine randy roger mike derrick sierra baby general major king prince
queen royal noble judge colonel admiral captain doctor deacon bishop sterling rusty dusty early ever art
fate karma bliss miracle spring meadow sage willow forest river brook stone clay ford bell best day park
brown green black white gray young long little wood hill hall price cross ward rich love sunny happy lucky
golden gold silver dove fox bird finch crane crow star sky storm rain snow frost fair good grand free add do
dick fanny patty lacy roman homer chandler griffin sawyer tanner gage birdie cole kelly`.split(/\s+/));
const NAMN_FORST = new Set([...EN_NAMNORD].filter(n => vanligtNamn(n) && !ORD_FORST.has(n)));

const SATSSTART_EN = new Set('hope will may best kind warm grace mark'.split(' '));

const ANDELSER_EN = [[/['’]s$/, ''], [/ies$/, 'y'], [/ied$/, 'y'], [/es$/, ''], [/s$/, ''], [/ed$/, ''], [/ed$/, 'e'],
  [/d$/, ''], [/ing$/, ''], [/ing$/, 'e'], [/ly$/, ''], [/ers?$/, ''], [/ers?$/, 'e'], [/est$/, '']];
function kantEn(o) {
  if (STOPP_EN.has(o) || EN_ORD.has(o)) return true;
  for (const [re, till] of ANDELSER_EN) {
    if (!re.test(o)) continue;
    const stam = o.replace(re, till);
    if (stam.length >= 3 && (STOPP_EN.has(stam) || EN_ORD.has(stam))) return true;
    if (stam.length >= 3 && !/s$/.test(re.source.replace(/\$$/, '')) && EN_NAMNORD.has(stam)) return true;
  }
  return false;
}

const SNIFF_EN = new Set('the and is are was were you your it this that of to for with have has be will would can not what how when we they he she his her my i'.split(' '));
const SNIFF_SV = new Set('och att är det som en ett på för med inte jag har till den av om så var men vi du hon han kan ska från eller när vad hur min mitt också efter bara nu här där dig mig oss dem sig alla mycket kommer finns skulle måste vill'.split(' '));
export function arEngelsk(text) {
  let en = 0, sv = 0;
  for (const o of String(text || '').toLowerCase().split(/[^\p{L}]+/u)) {
    if (SNIFF_EN.has(o)) en++;
    else if (SNIFF_SV.has(o)) sv++;
  }
  return en > sv || (en === sv && aktuellt() === 'en');
}

const kant = (o, en = false) => {
  if (STOPP.has(o) || OFARLIGA.has(o) || VANLIGA.has(o) || SKALADE.has(skala(o))) return true;
  for (const re of ANDELSER) {
    const stam = o.replace(re, '');
    if (stam.length >= 3 && (STOPP.has(stam) || OFARLIGA.has(stam) || SKALADE.has(skala(stam)))) return true;
  }
  return en && kantEn(o);
};

export function maskeraDelar(text, karta) {
  const gjorda = [];
  const en = arEngelsk(text);
  const delar = new Map();
  const par = [...karta.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [original, platshallare] of par) {
    if (!/^\p{Lu}/u.test(original)) continue;
    if (!/^[\p{L}\s._-]+$/u.test(original)) continue;
    for (const del of original.split(/[\s._]+/)) {
      if (del.length < 4 || delar.has(del)) continue;
      if (kant(del.toLowerCase(), en)) continue;
      delar.set(del, platshallare);
    }
  }
  if (!delar.size) return { text, funna: gjorda };
  const sett = new Set();
  const ut = String(text).replace(/(?<![\p{L}\]-])[\p{L}-]+/gu, ord => {
    const p = delar.get(ord);
    if (!p) return ord;
    if (!sett.has(ord)) { sett.add(ord); gjorda.push({ typ: 'namndel', original: ord, platshallare: p }); }
    return p;
  });
  return { text: ut, funna: gjorda };
}

const BOJT = /(?:ar|er|or|de|te|it|at|ade|ande|ende|orna|arna|erna|heten|ningen|tionen)$/u;

const NAMNEN = new Set([...FORNAMN].filter(n => n.length >= 3 && !kant(n)));
const NAMNEN_EN = new Set();
for (const [n, a] of EN_ANDEL) {
  if (a >= 0.0001 && n.length >= 3 && !kant(n) && !EN_ORD.has(n) && !STOPP_EN.has(n)
    && (!EN_NAMNORD.has(n) || NAMN_FORST.has(n))) NAMNEN_EN.add(n);
}
const arNamnet = (g, en) => NAMNEN.has(g) || (en && NAMNEN_EN.has(g));

const arEngelsktEfternamn = (g, en, versal) => (en || versal) && g.length >= 4 && EN_EFTERNAMN.has(g) && !EN_ORD.has(g) && !EN_NAMNORD.has(g) && !kant(g) && !VANLIGA.has(g);

const EFTERNAMNSFORM = /(?:sson|ström|strom|qvist|kvist|dotter)s?$/u;
const EFTERNAMNSFORM_GEMENT = /^(?!lessons?$).*(?:sson|qvist|kvist)s?$/u;

const ORTFORM = /(?:berg|borg|hamn|holm|hult|köping|lund|näs|stad|sund|torp|vik|gården|gårdarna|backa|hagen|dalen|liden|åker|ryd|tuna|löv|arp|inge|boda|fors|bruk)$/u;

function efternamnKandidat(kandidat, en) {
  const kg = kandidat?.toLowerCase();
  return Boolean(kandidat && kg.length >= 3 && !kant(kg, en) && !VANLIGA.has(kg) && !BOJT.test(kg)
    && !(en && /^\p{Ll}/u.test(kandidat) && EN_NAMNORD.has(kg) && !EN_EFTERNAMN.has(kg) && !NAMN_FORST.has(kg)));
}

export function maskeraFornamn(text, { karta = new Map(), raknare = new Map() } = {}) {
  const gjorda = [];
  const en = arEngelsk(text);
  const bitar = String(text || '').split(/(\s+|[._/]+)/);
  const arMellanrum = t => /^\s+$/.test(t || '');
  const allaOrd = new Set(), forsta = new Map();
  let ordning = 0;
  const minnsPost = (helt, p) => {
    const ord_ = helt.toLowerCase().split(/\s+/);
    for (const d of ord_) allaOrd.add(d);
    if (!/^[\p{L}\s-]+$/u.test(helt)) return;
    const n = ordning++;
    for (const d of ord_) if (arNamnet(d, en) && !forsta.has(d)) forsta.set(d, { p, n });
  };
  for (const [helt, p] of karta) minnsPost(helt, p);
  const kartord = () => allaOrd;

  for (let i = 0; i < bitar.length; i++) {
    const rått = bitar[i];
    if (!rått || /^\s+$/.test(rått) || /^[._/]+$/.test(rått)) continue;
    const m = /^([^\p{L}]*)([\p{L}](?:[\p{L}-]|['’](?=\p{L}))*)([^\p{L}]*)$/u.exec(rått);
    if (!m) continue;
    const [, fore, ordet, efter] = m;
    const gement = ordet.toLowerCase();
    const efternamnEfter = () => {
      if (efter) return false;
      const n = /^([\p{L}](?:[\p{L}-]|['’](?=\p{L}))*)/u.exec(bitar[i + 2] || '');
      const kg = n?.[1]?.toLowerCase();
      return Boolean(kg && kg.length >= 3 && !kant(kg, en) && !VANLIGA.has(kg) && !BOJT.test(kg) && !VARDAGSORD.has(kg)
        && !(en && EN_NAMNORD.has(kg) && !NAMN_FORST.has(kg) && !EN_EFTERNAMN.has(kg)));
    };
    const redanMaskerat = () => kartord().has(gement);
    const engelsktVardagsord = en && (EN_NAMNORD.has(gement) || STOPP_EN.has(gement) || kantEn(gement)) && !NAMN_FORST.has(gement);
    const funktionsord = en && ordet === gement && STOPP_EN.has(gement) && !NAMNLIKA_STOPP.has(gement);
    const vardagsord = funktionsord || (ordet === gement && (VARDAGSORD.has(gement) || engelsktVardagsord) && !efternamnEfter() && !redanMaskerat());
    const engelsktOrd = en && ordet !== gement && (kantEn(gement) || SATSSTART_EN.has(gement)) && !NAMN_FORST.has(gement);
    const arFornamn = arNamnet(gement, en) && !vardagsord && !engelsktOrd;
    const arEfternamn = !arFornamn && ((gement.length >= 6 && !kant(gement) && !VANLIGA.has(gement)
      && (EFTERNAMNSFORM.test(gement) && (ordet !== gement || EFTERNAMNSFORM_GEMENT.test(gement))))
      || arEngelsktEfternamn(gement, en, ordet !== gement));
    const delar_ = gement.split('-').filter(Boolean);
    const bindestrecksnamn = !arFornamn && !arEfternamn && delar_.length > 1
      && delar_.some(d => arNamnet(d, en)) && delar_.every(d => arNamnet(d, en) || efternamnKandidat(d, en));
    const arNamn = arFornamn || arEfternamn || bindestrecksnamn;
    const arOrt = !arNamn && ordet === gement && gement.length >= 5
      && ORTFORM.test(gement) && !kant(gement);
    if (!arNamn && !arOrt) continue;

    let traff = ordet, slut = i;
    const mellan = bitar[i + 1];
    const nasta = arFornamn && (arMellanrum(mellan) || mellan === '.' || mellan === '_') ? bitar[i + 2] : null;
    if (nasta && !efter) {
      const n = /^([\p{L}](?:[\p{L}-]|['’](?=\p{L}))*)([^\p{L}]*)$/u.exec(nasta);
      const kandidat = n?.[1];
      const kg = kandidat?.toLowerCase();
      if (efternamnKandidat(kandidat, en)) {
        traff = `${ordet}${arMellanrum(mellan) ? ' ' : mellan}${kandidat}`;
        slut = i + 2;
        bitar[i + 2] = n[2];
        let sist = kg, punkt = n[2];
        while (!punkt && arMellanrum(bitar[slut + 1])) {
          const n2 = /^([\p{L}](?:[\p{L}-]|['’](?=\p{L}))*)([^\p{L}]*)$/u.exec(bitar[slut + 2] || '');
          const k2 = n2?.[1]?.toLowerCase();
          if (!efternamnKandidat(n2?.[1], en) || !(arNamnet(sist, en) || /^\p{Lu}/u.test(n2[1]))) break;
          traff += ` ${n2[1]}`;
          bitar[slut + 1] = '';
          slut += 2;
          bitar[slut] = n2[2];
          sist = k2; punkt = n2[2];
        }
      }
    }

    let platshallare = karta.get(traff);
    if (!platshallare) {
      let basta = null;
      for (const d of traff.toLowerCase().split(/\s+/)) {
        const f = forsta.get(d);
        if (f && (!basta || f.n < basta.n)) basta = f;
      }
      platshallare = basta?.p;
    }
    if (!platshallare) {
      const e = etikett(arOrt ? 'ORT' : 'NAMN');
      const n = (raknare.get(e) || 0) + 1;
      raknare.set(e, n);
      platshallare = `[${e} ${bokstav(n)}]`;
      gjorda.push({ typ: arOrt ? 'ort' : 'fornamn', original: traff, platshallare });
    }
    if (!karta.has(traff)) minnsPost(traff, platshallare);
    karta.set(traff, platshallare);
    bitar[i] = fore + platshallare + efter;
    if (slut > i) { bitar[i + 1] = ''; i = slut; }
  }
  return { text: bitar.join(''), karta, raknare, funna: gjorda };
}

export function maskeraOkanda(text, { karta = new Map(), raknare = new Map() } = {}) {
  let ut = text;
  const gjorda = [];
  const en = arEngelsk(text);
  const iNamn = new Map();
  const minnsNamn = (helt, p) => {
    if (!/\s/.test(helt) || !/^[\p{L}\s-]+$/u.test(helt)) return;
    for (const d of helt.split(/\s+/)) if (!iNamn.has(d)) iNamn.set(d, p);
  };
  for (const [helt, p] of karta) minnsNamn(helt, p);
  const verkliga = new Set(karta.values());
  const lyfta = [];
  ut = rensaOsynliga(ut).replace(/\[[^\]\n]{1,40}\]/g, p => (verkliga.has(p) ? `\u0003${lyfta.push(p) - 1}\u0003` : p));
  const ord = /(?:(?<![\p{L}\p{N}_.@\\/-])|(?<=(?<![\/\p{L}\p{N}])\p{Lu}\p{L}+\/))(\p{Lu}(?:['’]\p{Lu})?[\p{L}]{2,}(?:-\p{Lu}?[\p{L}]+)*(?:\s+\p{Lu}(?:['’]\p{Lu})?[\p{L}](?:[\p{L}]|-\p{Lu}?[\p{L}])*)*)/gu;

  ut = ut.replace(ord, (traff, _g, pos, hel) => {
    if (ARPLATSHALLARE.test(traff)) return traff;
    let delar = traff.split(/\s+/);
    const fram = hel.slice(Math.max(0, pos - 64), pos);
    const forst = /(?:[.!?]\s+|\n\s*)$/.test(fram) || (/^\s*$/.test(fram));
    const l = traff.toLowerCase();
    if (delar.length === 1 && forst && (VERB.has(l) || (en && SATSSTART_EN.has(l)))) return traff;
    if (en && delar.length === 1 && forst && EN_NAMNORD.has(l) && !vanligtNamn(l)) return traff;
    const efterTraff = hel.slice(pos + traff.length, pos + traff.length + 8);
    const namnlik = (d, i) => en && NAMNLIKA_STOPP.has(d.toLowerCase()) && !(i === 0 && forst)
      && !(delar.length === 1 && MANADER_EN.has(d.toLowerCase()))
      && !/^\s*\d/.test(i === delar.length - 1 ? efterTraff : '') && !/\d\s*$/.test(i === 0 ? fram : '');
    const kantHar = (d, i) => (en && delar.length === 1 && valuta(d, fram, efterTraff)) || (kant(d.toLowerCase(), en) && !namnlik(d, i));
    if (delar.every(kantHar)) return traff;
    if (delar.length === 1 && SUBSTANTIV.test(l)) return traff;

    let fore = '', efter = '';
    const ledande = (d, i) => kantHar(d, i) && !(en && vanligtNamn(d.toLowerCase()));
    const bakre = d => kant(d.toLowerCase()) || (en && STOPP_EN.has(d.toLowerCase()));
    let i0 = 0;
    while (delar.length > 1 && ledande(delar[0], i0++)) fore += delar.shift() + ' ';
    while (delar.length > 1 && bakre(delar.at(-1))) efter = ' ' + delar.pop() + efter;
    if (fore || efter) {
      const namn = delar.join(' ');
      if (SUBSTANTIV.test(namn.toLowerCase()) && delar.length === 1) return traff;
      return fore + byt(namn) + efter;
    }
    return byt(traff);
  });
  ut = ut.replace(/\u0003(\d+)\u0003/g, (m, i) => lyfta[Number(i)] ?? m);
  return { text: ut, karta, raknare, funna: gjorda };

  function byt(traff) {
    if (karta.has(traff)) return karta.get(traff);
    const finns = iNamn.get(traff);
    if (finns) { karta.set(traff, finns); return finns; }
    const e = etikett('NAMN');
    const n = (raknare.get(e) || 0) + 1;
    raknare.set(e, n);
    const platshallare = `[${e} ${bokstav(n)}]`;
    karta.set(traff, platshallare);
    minnsNamn(traff, platshallare);
    gjorda.push({ typ: 'okant-egennamn', original: traff, platshallare });
    return platshallare;
  }
}

const LAGBEGREPP = /(?<![\p{L}\p{N}_])lex\s+(?:Maria|Sarah)(?![\p{L}\p{N}_])/giu;
const SKYDDADE = [LAGBEGREPP];

const SENTINELL = i => `\ue001S${i}\ue001`;

export function skydda(text) {
  const funna = [];
  let ut = String(text || '');
  for (const re of SKYDDADE) {
    ut = ut.replace(re, (traff, i, hela) => {
      if (NAMNFOLJER(traff, i, hela)) return traff;
      funna.push(traff); return SENTINELL(funna.length - 1);
    });
  }
  return { text: ut, aterstall: t => funna.reduce((acc, v, i) => acc.split(SENTINELL(i)).join(v), String(t)) };
}

export { ARPLATSHALLARE, STOPP, SKYDDADE };

const BEGREPP = LAGBEGREPP;
function NAMNFOLJER(hela, i, t) {
  if (/^-\p{Lu}/u.test(t.slice(i + hela.length, i + hela.length + 2))) return true;
  const n = /^\s+([\p{L}](?:[\p{L}-]|['’](?=\p{L}))*)/u.exec(t.slice(i + hela.length, i + hela.length + 80));
  return Boolean(n && (/^\p{Lu}/u.test(n[1]) || efternamnKandidat(n[1], arEngelsk(t))));
}

export function utatGrind(text, { karta = new Map(), raknare = new Map(), sorter = null } = {}) {
  const kant = ommaskera(rensaOsynliga(text), karta);
  const m0 = maskera(kant, { karta, raknare, sorter });
  const m = maskeraKvar(m0.text, { karta, raknare, sorter });

  const skydd = [];
  const undan = m.text.replace(BEGREPP, (t, i, hela) => {
    if (NAMNFOLJER(t, i, hela)) return t;
    skydd.push(t); return `\u0000${skydd.length - 1}\u0000`;
  });

  const forn = maskeraFornamn(undan, { karta, raknare });
  const delar = maskeraDelar(forn.text, karta);
  return delar.text.replace(/\u0000(\d+)\u0000/g, (m, i) => skydd[Number(i)] ?? m);
}

export function grindaArgument(argument, { karta = new Map(), raknare = new Map(), sorter = null } = {}) {
  const utanPlatshallare = t => String(t).replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  const gaGenom = v => {
    if (typeof v === 'string') return utanPlatshallare(utatGrind(v, { karta, raknare, sorter }));
    if (Array.isArray(v)) return v.map(gaGenom);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, gaGenom(x)]));
    }
    return v;
  };
  const ut = gaGenom(argument);
  const kvar = granska(JSON.stringify(ut));
  if (kvar.length) {
    const e = new Error(`Anropet stoppades: ${[...new Set(kvar.map(k => k.typ))].join(', ')} `
      + 'fanns kvar i argumenten. Ingenting skickades.');
    e.kvar = kvar;
    throw e;
  }
  return ut;
}
