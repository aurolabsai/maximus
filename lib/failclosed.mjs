// Sista försvaret. Det som ser ut som ett egennamn och inte känns igen
// maskeras, även om ingen bett om det.
//
// Skälet: en säkerhetsgräns som missar en gång är bruten. I
// första skarpa provet maskerade den lokala modellen nio uppgifter men
// missade "Lena Nyström" helt och lät lösa "Erik" stå kvar tre gånger. Den
// gör sitt jobb bra nog för att vara värd att ha, och inte bra nog för att
// lita på ensam.
//
// Två regler, båda billiga:
//
//   1. Delarna av ett maskerat namn maskeras också. Är "Erik Svensson"
//      [PERSON B] så är lösa "Erik" och "Svensson" samma person.
//   2. Ett versalt ord mitt i en mening som inte står i stopplistan är ett
//      egennamn tills motsatsen bevisats.
//
// Hellre en onödig maskering än en missad. En onödig kostar precision i
// svaret; en missad kostar löftet.

/// Vanliga svenska ord som börjar med versal utan att vara egennamn.
///
/// Sedan meningens första ord också maskeras bär listan mer vikt än förut,
/// och den är ordnad efter vad som faktiskt inleder svenska meningar:
/// pronomen, hjälpverb, frågeord, konjunktioner, och framför allt adverben.
///
/// Adverben kom in efter ett skarpt fel. "Senast var det Leyla Amin som
/// mejlade mig" gav en platshållare åt ordet Senast, och ChatGPT skrev
/// tillbaka en fråga om vilken koppling Senast hade till händelsen. Ett
/// adverb som inleder en mening ser ut exakt som ett namn som inleder en
/// mening, och det finns ingen regel som skiljer dem åt — bara den här
/// listan.
///
/// Mötesorden sist kom in 2026-10-05: en avskrift av ett möte gav
/// "[NAMN A] flyttas en vecka" för "Tidplanen flyttas en vecka". Ett möte
/// börjar meningar med sina substantiv. Ingen av dem står i SCB:s namnlista.
///
/// Att fylla på den är billigt och reversibelt. Ett namn som slunkit ut är
/// varken det ena eller det andra, så listan får bara innehålla ord som
/// aldrig är namn.
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
anbud anbudet anbudssumma anbudsgivaren upphandling upphandlingen utvärdering
personaltäthet kontraktsvärde avtalsspärr underleverantör tilldelning jäv jävet
inkomna uppskattat prisskillnaden egenregi referensanbud kalkyl poäng poängsättning
verksamheten enheten förvaltningen nämnden myndighetsenheten socialförvaltningen
lön lönen lönerna ersättning arvode timmar heltid deltid tjänsten tjänst
anställningen uppsägningen omplaceringen förhandlingen mötet samtalet
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

/// Ord som är versala men aldrig pekar ut någon: lagar, myndighetsbegrepp,
/// allmänna termer. De skulle göra svaret sämre utan att skydda någon.
/// Ord som aldrig pekar ut någon.
///
/// Listan finns för svarets skull, inte för säkerhetens. "Jag är [PERSON C]
/// på [ORGANISATION A]" är sämre indata än "Jag är enhetschef på
/// socialförvaltningen", och ingen av de två orden gör någon
/// identifierbar. Bara det som binder rollen till en plats eller en person
/// gör det, och det maskeras ändå.
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
socialförvaltningen socialtjänsten socialnämnden kommunstyrelsen kommunfullmäktige
utbildningsförvaltningen barnochutbildningsförvaltningen miljöförvaltningen
tekniska nämnden överförmyndarnämnden hr-avdelningen kommunen regionen
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
vårdnadstvist vårdnad umgänge bodelning arvskifte konkurs uppsägning
adhd add autism asperger npf dyslexi bipolaritet depression utmattning
diagnos sjukskrivning rehabilitering omplacering avstängning
lägenhet villa fastighet gruppboende förskola trädgården arbetsmiljö
utredning utredningen anmälan anmälan yttrande yttrandet beslut protokoll
sammanfattning bakgrund bedömning slutsats åtgärd åtgärder underlag bilaga
journal journalen anteckning anteckningar rapport rapporten avvikelse
dokument dokumentet handling handlingen akten ärende diarium
kapitel paragraf stycke punkt avsnitt rubrik datum tid plats
avtal avtalet faktura fakturan offert anbud upphandling tilldelning
incident incidenten loggen logg kostnad kostnaden intäkt summa belopp
systemet servern databasen miljön kontot mappen filen katalogen
klockan tiden dagen veckan månaden året perioden
bakgården innergården gården huset hemmet lokalen byggnaden
`.trim().split(/\s+/));

import { FORNAMN } from './fornamn.mjs';
import { aktuellt } from './sprakstod.mjs';
import { readFileSync } from 'node:fs';
import { maskera, ommaskera, granska, maskeraKvar, etikett } from './maskering.mjs';

const ARPLATSHALLARE = /^\[[A-ZÅÄÖ][A-ZÅÄÖ0-9\s-]*\s[A-Z]+\]$/;

/// Osynliga tecken bort innan någon vakt läser texten (2026-10-09,
/// granskningen). Vakterna lyfter undan sina platshållare som \u0000n\u0000,
/// \u0001n\u0001 och \u0003n\u0003 och lägger tillbaka dem efteråt, och en
/// token som inte var deras blev tomma strängen: "An\u00039\u0003na
/// Sv\u00039\u0003ensson" lästes som fyra ofarliga bitar och gick ut som
/// "Anna Svensson". Nollbreddstecken (\u200b, mjukt bindestreck, BOM) delade
/// namnet på samma sätt utan sentinell, och mottagaren läser ändå "Anna".
/// Vakten ska se exakt det som går ut: styrtecken (utom tab och radbrytning)
/// och formattecken (\p{Cf}) tas bort. Ett emoji med nollbreddsfog blir två
/// emojier — billigt mot ett namn i klartext. Våra egna sentineller ligger
/// därför i privata området (\ue000, \ue001), som rensningen inte rör.
// Också de osynliga som inte är formattecken (2026-10-09, granskningen):
// U+034F (kombinerande ordfog), variantväljarna och hangul- och khmerfyllnad
// delade "An\u034fna" för vakten, mottagaren läste "Anna". Ett emoji tappar
// sin variantväljare; det ser likadant ut.
const OSYNLIGA = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\p{Cf}\u034f\u115f\u1160\u17b4\u17b5\u3164\uffa0\ufe00-\ufe0f\u{e0100}-\u{e01ef}]/gu;
/// Sedan NFKC (2026-10-09, granskningen): "𝐀𝐧𝐧𝐚 𝐒𝐯𝐞𝐧𝐬𝐬𝐨𝐧", "Ａｎｎａ" och
/// "Soﬁa" läses som namn av mottagaren men fanns inte i någon lista, och
/// grinden släppte dem. Det är den normaliserade texten som går ut. Vanlig
/// text (åäö, é, citattecken, tankstreck) är oförändrad; privata området
/// också, så sentinellerna överlever. "…" blir "...", "½" blir "1⁄2".
/// Till en fast punkt: att ta bort ett tecken kan ställa ett kombinerande
/// tecken intill en bokstav som NFKC då slår ihop ("o\u2060\u0308" → "ö"),
/// och vakten ska läsa samma form som en andra rensning skulle ge.
export function rensaOsynliga(t) {
  let ut = String(t ?? '');
  for (let forra = null; ut !== forra;) { forra = ut; ut = ut.replace(OSYNLIGA, '').normalize('NFKC'); }
  return ut;
}

function bokstav(n) { let s = ''; while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }

/// Svenska substantivändelser som inget personnamn har.
///
/// Meningens första ord maskeras numera, och priset var "Fakturorna är
/// väldigt vaga" och "Fastigheten heter Sörgården". Stopplistan kan inte
/// innehålla svenskans substantiv, men den behöver inte: bestämd form och
/// avledning syns i ändelsen, och ingen heter något som slutar på -orna.
///
/// Ändelsen får bara fria ett ord som står ENSAMT. "Boström" slutar inte på
/// något av det här, men skulle en ändelse råka träffa ett efternamn står det
/// ändå kvar i kartan via förnamnet bredvid.
const SUBSTANTIV = /(?:orna|arna|erna|ingen|ningen|heten|skapet|andet|endet|tionen|elsen)$/u;

/// Står ordet i en av listorna, i grundform eller genitiv?
///
/// "Bolagsverkets uppgifter" maskerades fast myndigheten står i listan, för
/// listan har grundformen. Att stryka ett avslutande s är ofarligt: ett namn
/// som Lars blir "lar", och "lar" står inte i någon lista.
/// Bestämd form räknas också.
///
/// "Handläggaren på förvaltningen" gav en platshållare åt handläggaren,
/// fast "handläggare" står i listan. Listan kan inte innehålla varje ords
/// alla böjningar, men ändelsen går att stryka: genitivets s, och bestämd
/// forms n, en, et, na och arna.
const ANDELSER = [/s$/, /n$/, /en$/, /et$/, /na$/, /arna$/, /erna$/, /orna$/];

/// Samma ord utan å, ä och ö.
///
/// En PDF som tappat sina diakriter, ett transkript, ett tangentbord som
/// ställts om — och "från" blir "fran". Det står inte i stopplistan, men SCB
/// har det som tilltalsnamn, så namnlistan tog det. I ett skarpt prov blev
/// "tre klagomål från kollegor" till "tre klagomål [NAMN F] kollegor".
///
/// Listorna får alltså en avskalad tvilling. Att bygga den kostar en
/// millisekund vid start och stänger hålet helt istället för ord för ord.
const skala = o => o.replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e');
/// Ord som både är vanliga svenska ord och registrerade namn.
///
/// HÄRLEDDA, inte handskrivna. SCB registrerar "grund", "till", "fall" och
/// månadsnamnen som tilltalsnamn — någon heter faktiskt så — och rått gav
/// listan platshållare åt "ligga till grund".
///
/// Kommentaren vid NAMNEN nedan hade redan rätt avsikt: ett ord som också är
/// ett vanligt ord ska maskeras bara när det står med versal. Men listan den
/// läste var STOPP och OFARLIGA, båda handskrivna, och "grund" stod inte i
/// någon av dem.
///
/// Nionde gången samma form dyker upp i det här förrådet: en handbyggd lista
/// bredvid den riktiga strukturen. Alltså härleds den nu ur lagtexterna vi
/// redan skeppar — se scripts/vanliga-ord.mjs. Ett ord som står i en lagtext
/// är ett ord, hur många som än råkar heta så.
export const VANLIGA = new Set(
  readFileSync(new URL('../data/vanliga-ord.txt', import.meta.url), 'utf8')
    .split('\n').filter(r => r && !r.startsWith('#')).map(r => r.split('\t')[0]));

const SKALADE = new Set([...STOPP, ...OFARLIGA].map(skala));

/// Vanliga svenska ord som också står i SCB:s namnregister (2026-10-06).
/// I en avskrift blev "nu kommer jag tala in" till "nu kommer jag [NAMN I]
/// in". Bara den gemena formen släpps här; med versal tar namnvakten dem
/// som förut ("Tom sa att …", "Stig Andersson" maskeras fortfarande).
const VARDAGSORD = new Set('tala lova stig dan frank vide vida tom max bror kris lina rut'.split(' '));

/// Vanliga verb i uppmaningsform (2026-10-09, inför demot): "Prata med tre
/// kunder" och "Vänta med lanseringen" i en avskrift blev [NAMN A] och
/// [NAMN B] — ordlistan kommer ur lagtexter, där ingen säger "Prata". Ord
/// som också är förnamn i namnregistret är borttagna ur listan med flit.
const VERB = new Set('använd avboka berätta beställ betala bjud boka börja dela fixa flytta fortsätt fråga följ förbered försök ge glöm granska gå gör hjälp hälsa hämta hör ihåg jämför kolla kom kontrollera köp kör lansera leverera lyssna lägg läs läsa låt lös mejla notera ordna planera prata prioritera påminn ring ringa sammanfatta skicka skjut skriv skriva sluta spara starta stoppa ställ stäng svara säg sälj sätt tacka testa titta träffa tänk undvik uppdatera välj vänd vänta ändra öppna'.split(' '));

// ── Engelska (fas 3, 2026-10-09) ────────────────────────────────────────
//
// Vakterna ovan läser svensk text: svenska stoppord, ord ur svenska lagar,
// SCB:s förnamn. En engelsk text fick därför "Budget", "Meeting" och "Thanks"
// maskerade som namn, och "i can see it" gav en platshållare åt "can" — SCB
// har det som tilltalsnamn. Engelskan får samma sorts listor, härledda ur
// öppna källor (data/README.md):
//
//   EN_ORD       vanliga engelska ord som inte är namn (Moby, public domain)
//   EN_NAMNORD   vanliga engelska ord som OCKSÅ är namn: will, rose, grace,
//                brown, smith — och de svenska förnamn som är engelska ord
//                (love, can, are)
//   EN_ANDEL     amerikanska förnamn med hur vanliga de varit (SSA)
//   EN_EFTERNAMN de 2 000 vanligaste amerikanska efternamnen (US Census)
//
// Listorna gäller bara en text som LÄSES som engelska (arEngelsk nedan):
// en svensk text maskeras exakt som förut. En blandad text räknas som
// svensk, och då maskeras mer, inte mindre.
const engelska = f => readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8')
  .split('\n').filter(r => r && !r.startsWith('#')).map(r => r.split('\t'));
const EN_ALLA_ORD = engelska('engelska-ord.txt').map(r => r[0]);
// Ett ord som SCB har som förnamn är inget rent ord, ens på engelska.
const EN_ORD = new Set(EN_ALLA_ORD.filter(o => !FORNAMN.has(o)));
const EN_NAMNORD = new Set([...engelska('engelska-namnord.txt').map(r => r[0]), ...EN_ALLA_ORD.filter(o => FORNAMN.has(o))]);
const EN_ANDEL = new Map(engelska('engelska-fornamn.txt').map(([n, a]) => [n, Number(a)]));
const EN_EFTERNAMN = new Set(engelska('engelska-efternamn.txt').map(r => r[0]));
/// Ett förnamn som varit vanligt något år: minst 0,05 % av de födda.
const vanligtNamn = n => (EN_ANDEL.get(n) || 0) >= 0.0005;

/// Engelska ord som aldrig är namn i en mening, och som inte står i
/// ordlistan med säkerhet: funktionsord, hälsningar, veckodagar och månader,
/// titlar, förkortningar, varumärken och länder. Samma roll som STOPP och
/// OFARLIGA på svenska.
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

/// Stoppord som också är vanliga förnamn: Will, May, June, April, August.
/// Först i en mening är de ord ("Will you…", "May I…"); mitt i en mening, med
/// versal och utan ett tal intill ("on May 5"), är de namn.
const NAMNLIKA_STOPP = new Set([...STOPP_EN].filter(vanligtNamn));
const MANADER_EN = new Set('january february march april may june july august september october november december'.split(' '));
/// Valutakoderna är inga stoppord (2026-10-09, granskningen). De stod i
/// STOPP_EN, i alla skrivsätt, och "Nok" är också ett förnamn: "Nok Larsson"
/// skalades i kanten, efternamnet maskerades och förnamnet gick ut. En valuta
/// skrivs med versaler ("48 500 SEK"); bara så räknas den som känd.
const VALUTOR = new Set('sek eur usd gbp nok dkk chf jpy'.split(' '));
/// Och bara intill ett tal (korpusprovet, samma dag): "NOK LARSSON" i en
/// versal rubrik skalade NOK som valuta och släppte förnamnet.
const valuta = (d, fore = '', efter = '') => VALUTOR.has(d.toLowerCase()) && d === d.toUpperCase()
  && (/\d[\d\s.,]*$/.test(fore) || /^\s*\d/.test(efter));

/// Vanliga förnamn som också är ord, och som skrivna med gemen nästan
/// alltid är ordet: "i will", "grace period", "frank discussion". Med gemen
/// släpps de som VARDAGSORD; med versal mitt i en mening är de namn.
/// Resten av de vanliga förnamnen bland orden (john, anna, henry, peter …)
/// maskeras också med gemen.
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

/// Ett ensamt ord först i en mening som är en hälsning eller ett hjälpverb,
/// inte ett namn: "Hope you are well", "Best regards", "Will do".
const SATSSTART_EN = new Set('hope will may best kind warm grace mark'.split(' '));

/// Engelska böjningsändelser: plural, genitiv, dåtid, -ing, -ly, -er.
const ANDELSER_EN = [[/['’]s$/, ''], [/ies$/, 'y'], [/ied$/, 'y'], [/es$/, ''], [/s$/, ''], [/ed$/, ''], [/ed$/, 'e'],
  [/d$/, ''], [/ing$/, ''], [/ing$/, 'e'], [/ly$/, ''], [/ers?$/, ''], [/ers?$/, 'e'], [/est$/, '']];
function kantEn(o) {
  if (STOPP_EN.has(o) || EN_ORD.has(o)) return true;
  for (const [re, till] of ANDELSER_EN) {
    if (!re.test(o)) continue;
    const stam = o.replace(re, till);
    if (stam.length >= 3 && (STOPP_EN.has(stam) || EN_ORD.has(stam))) return true;
    // "pricing" och "booked" är ord, fast "price" och "book" också är
    // efternamn. Plural-s räknas inte här: "the Browns" är en familj.
    if (stam.length >= 3 && !/s$/.test(re.source.replace(/\$$/, '')) && EN_NAMNORD.has(stam)) return true;
  }
  return false;
}

/// Läses texten som engelska? Funktionsorden räknas: the, and, is, you … mot
/// och, att, är, jag … Lika många (också noll) avgörs av appens språk.
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

/// Är ordet ett känt ord? `en`: också de engelska listorna.
const kant = (o, en = false) => {
  if (STOPP.has(o) || OFARLIGA.has(o) || VANLIGA.has(o) || SKALADE.has(skala(o))) return true;
  for (const re of ANDELSER) {
    const stam = o.replace(re, '');
    if (stam.length >= 3 && (STOPP.has(stam) || OFARLIGA.has(stam) || SKALADE.has(skala(stam)))) return true;
  }
  return en && kantEn(o);
};

/// Regel 1: delarna av ett redan maskerat namn.
export function maskeraDelar(text, karta) {
  const gjorda = [];
  const en = arEngelsk(text);
  // Delarna samlas först och byts sedan i ett enda svep (2026-10-09,
  // granskningen, ReDoS): ett reguljärt uttryck per del över hela texten
  // tog en sekund med några tusen namn i kartan. Längsta originalen först,
  // så att en del som står i två namn hör till det längsta, som förut.
  const delar = new Map();
  const par = [...karta.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [original, platshallare] of par) {
    if (!/^\p{Lu}/u.test(original)) continue;                 // bara namnlika
    if (!/^[\p{L}\s._-]+$/u.test(original)) continue;        // inte nummer, e-post
    // Bindestrecket delar INTE. "Gun-Britt Ohlsson" gav delarna Gun, Britt
    // och Ohlsson, och "Britt" matchade inuti "Gun-Britt" eftersom tecknet
    // före var ett bindestreck och inte en bokstav. Resultatet blev
    // "Gun-[NAMN B] avled" — halva namnet kvar och fullt läsbart.
    // Punkt och understreck delar ("Erik.Svensson" ur en adress).
    for (const del of original.split(/[\s._]+/)) {
      // Stopporden måste med, inte bara de ofarliga.
      //
      // Grinden gav en gång spannet "Kommunal och Vision". Delvakten delade
      // det i ord, och "och" är tre tecken — varje "och" i hela texten byttes
      // mot organisationen. Ett bindeord som försvinner ändrar meningen utan
      // att någon ser det.
      if (del.length < 4 || delar.has(del)) continue;
      if (kant(del.toLowerCase(), en)) continue;
      delar.set(del, platshallare);
    }
  }
  if (!delar.size) return { text, funna: gjorda };
  // En del träffar bara ett helt ord: ingen bokstav, ], eller bindestreck
  // intill. Det är precis en hel följd av bokstäver och bindestreck.
  const sett = new Set();
  const ut = String(text).replace(/(?<![\p{L}\]-])[\p{L}-]+/gu, ord => {
    const p = delar.get(ord);
    if (!p) return ord;
    if (!sett.has(ord)) { sett.add(ord); gjorda.push({ typ: 'namndel', original: ord, platshallare: p }); }
    return p;
  });
  return { text: ut, funna: gjorda };
}

/// Böjningsändelser som gör ett ord till ett verb eller ett substantiv,
/// aldrig till ett efternamn. "elisabeth kommer" är ett förnamn och ett
/// verb; "ella nordin" är ett namn.
const BOJT = /(?:ar|er|or|de|te|it|at|ade|ande|ende|orna|arna|erna|heten|ningen|tionen)$/u;

/// Namnlistan silad mot stopporden.
///
/// SCB registrerar "min", "sen", "alla", "in" och "nu" som tilltalsnamn —
/// någon heter faktiskt så — och rått gav listan platshållare åt "min
/// kollega" och "sen mars". Ett ord som både är ett vanligt svenskt ord och
/// ett ovanligt namn ska följa den vanliga regeln: maskeras bara när det
/// står med versal mitt i en mening.
///
/// Golvet på tre tecken tar resten. Ingen skriver ut ett tvåbokstavsnamn i
/// ett ärende utan att också skriva efternamnet, och efternamnet fångas.
const NAMNEN = new Set([...FORNAMN].filter(n => n.length >= 3 && !kant(n)));
// Engelska förnamn (fas 3): de som varit vanliga något år (minst 0,01 %),
// silade som de svenska. Ett namn som också är ett engelskt ord släpps med
// gemen i en engelsk text, se ORD_FORST.
// En egen lista, och bara för en engelsk text: SSA har "Leta" och "Park",
// och i en svensk text är de ord. Ett namn som också är ett engelskt ord är
// med bara om det nästan alltid är namnet (john, anna).
const NAMNEN_EN = new Set();
for (const [n, a] of EN_ANDEL) {
  if (a >= 0.0001 && n.length >= 3 && !kant(n) && !EN_ORD.has(n) && !STOPP_EN.has(n)
    && (!EN_NAMNORD.has(n) || NAMN_FORST.has(n))) NAMNEN_EN.add(n);
}
const arNamnet = (g, en) => NAMNEN.has(g) || (en && NAMNEN_EN.has(g));

/// Vanliga amerikanska efternamn som inte är ord: johnson, williams, garcia.
/// "email johnson about it" och "ask Williams" gick ut: ingen ändelse
/// avslöjar dem. Gäller i alla texter — ett efternamn är ett efternamn.
const arEngelsktEfternamn = (g, en, versal) => (en || versal) && g.length >= 4 && EN_EFTERNAMN.has(g) && !EN_ORD.has(g) && !EN_NAMNORD.has(g) && !kant(g) && !VANLIGA.has(g);

/// Svenska ortnamnsändelser. Ingen lista behövs — formen räcker.
///
/// Gemena ortnamn hade samma hål som gemena personnamn: "jobbar hos oss på
/// solgläntan i norrby" gick ut orört. En ortnamnslista hade varit 2 000
/// rader; ändelserna är tjugofem tecken och fångar elva av femton i provet.
/// De fyra som slipper igenom — Ekliden, Solna, Kalmar, Mälardalen — är
/// orter vars namn inte har någon ortform kvar, och dem får den lokala
/// modellen ta.
/// Ändelser som nästan bara efternamn har. Genitiv-s:et får följa med.
const EFTERNAMNSFORM = /(?:sson|ström|strom|qvist|kvist|dotter)s?$/u;
// "lesson" är det enda vanliga ordet på -sson, och det är engelska.
const EFTERNAMNSFORM_GEMENT = /^(?!lessons?$).*(?:sson|qvist|kvist)s?$/u;

const ORTFORM = /(?:berg|borg|hamn|holm|hult|köping|lund|näs|stad|sund|torp|vik|gården|gårdarna|backa|hagen|dalen|liden|åker|ryd|tuna|löv|arp|inge|boda|fors|bruk)$/u;

/// Regel 3: ett känt förnamn, oavsett hur det skrivs.
///
/// Namnvakten läser versaler. Den som skriver "ella nordin" med små
/// bokstäver kom förbi henne helt, och det är så en stressad handläggare
/// skriver på telefonen. Ett förnamn ur SCB:s register är ett förnamn
/// oavsett skiftläge.
///
/// Skrivet som ett reguljärt uttryck med en frivillig andra grupp åt det
/// sig självt: "med elisabeth" matchade med "med" som förnamnskandidat,
/// föll på att "med" inte är ett namn, och hade då redan ätit "elisabeth".
/// Därför en ordvandring — varje ord prövas för sig, och nästa ord tas bara
/// när det första faktiskt var ett namn.
/// Kan ordet vara ett efternamn efter ett förnamn? En regel för förnamnsvakten
/// och för undantagen, så att de inte läser olika (2026-10-09, granskningen).
/// Golv på tre tecken: "bettan sa att det var fel" tog "sa" som efternamn.
function efternamnKandidat(kandidat, en) {
  const kg = kandidat?.toLowerCase();
  return Boolean(kandidat && kg.length >= 3 && !kant(kg, en) && !VANLIGA.has(kg) && !BOJT.test(kg)
    && !(en && /^\p{Ll}/u.test(kandidat) && EN_NAMNORD.has(kg) && !EN_EFTERNAMN.has(kg) && !NAMN_FORST.has(kg)));
}

export function maskeraFornamn(text, { karta = new Map(), raknare = new Map() } = {}) {
  const gjorda = [];
  const en = arEngelsk(text);
  // Orden och mellanrummen. Punkt, understreck och snedstreck delar också
  // (2026-10-09, granskningen): "facebook.com/erik.svensson.77" och
  // "erik_svensson" bar namnet ut i en enda token som vakten aldrig läste.
  const bitar = String(text || '').split(/(\s+|[._/]+)/);
  const arMellanrum = t => /^\s+$/.test(t || '');
  // Kartans ord, uppslagna i stället för genomsökta vid varje ord
  // (2026-10-09, granskningen, ReDoS): med några tusen namn i kartan tog
  // varvet över kartan per ord sekunder. `forsta` minns för varje namnord
  // den tidigaste posten det står i — samma val som genomsökningen gjorde.
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

  /// ── En regel som INTE står här, och varför ──────────────────────────
  ///
  /// Första rättningen av övermaskeringen krävde STÖD för ett ensamt gement
  /// ord: ett efternamn efter det, eller samma ord med versal någon
  /// annanstans i texten. Den dödade "ligga till grund" — och "ring bengt
  /// om det" med den.
  ///
  /// Det är fel avvägning. Ett missat namn är ett läckage; ett övermaskerat
  /// ord är en skadad text. Det första är värre, och det står redan skrivet
  /// längre ned i den här filen.
  ///
  /// Skillnaden mellan "bengt" och "grund" är att det ena är ett vanligt
  /// svenskt ord. Den skillnaden går inte att läsa ur meningen — den kräver
  /// en ordlista, och ordlistan är VANLIGA ovan.

  for (let i = 0; i < bitar.length; i++) {
    const rått = bitar[i];
    if (!rått || /^\s+$/.test(rått) || /^[._/]+$/.test(rått)) continue;
    // Skiljetecken runtomkring hör inte till namnet.
    // Apostrof inuti ordet hör till namnet (2026-10-09, korpusprovet):
    // "Sarah O'Brien" tog Sarah, och O'Brien gick ut på nivån Personuppgifter.
    const m = /^([^\p{L}]*)([\p{L}](?:[\p{L}-]|['’](?=\p{L}))*)([^\p{L}]*)$/u.exec(rått);
    if (!m) continue;
    const [, fore, ordet, efter] = m;
    const gement = ordet.toLowerCase();
    // Ett vardagsord med gemen släpps bara när inget talar för ett namn:
    // följer ett möjligt efternamn ("tom svensson"), eller står samma ord
    // redan maskerat i samtalet, maskeras det ändå (fail-closed; säkerhets-
    // granskningen 2026-10-06).
    const efternamnEfter = () => {
      if (efter) return false;
      const n = /^([\p{L}](?:[\p{L}-]|['’](?=\p{L}))*)/u.exec(bitar[i + 2] || '');
      const kg = n?.[1]?.toLowerCase();
      return Boolean(kg && kg.length >= 3 && !kant(kg, en) && !VANLIGA.has(kg) && !BOJT.test(kg) && !VARDAGSORD.has(kg)
        && !(en && EN_NAMNORD.has(kg) && !NAMN_FORST.has(kg) && !EN_EFTERNAMN.has(kg)));
    };
    const redanMaskerat = () => kartord().has(gement);
    // På engelska också orden som är namn (will, rose, love, can) — utom de
    // som nästan bara är namn (john, anna).
    const engelsktVardagsord = en && (EN_NAMNORD.has(gement) || STOPP_EN.has(gement) || kantEn(gement)) && !NAMN_FORST.has(gement);
    // Ett rent funktionsord ("the", "into") är aldrig ett förnamn med gemen,
    // vad som än följer. Will och May kan vara det ("will smith").
    const funktionsord = en && ordet === gement && STOPP_EN.has(gement) && !NAMNLIKA_STOPP.has(gement);
    const vardagsord = funktionsord || (ordet === gement && (VARDAGSORD.has(gement) || engelsktVardagsord) && !efternamnEfter() && !redanMaskerat());
    // I en engelsk text är ett engelskt ord med versal namnvaktens sak för
    // versala ord, inte förnamnens: "The", "Monday" och "Can" står i SCB:s
    // register, och "Will" mitt i en mening tas redan där.
    const engelsktOrd = en && ordet !== gement && (kantEn(gement) || SATSSTART_EN.has(gement)) && !NAMN_FORST.has(gement);
    const arFornamn = arNamnet(gement, en) && !vardagsord && !engelsktOrd;
    // Efternamn på en ändelse som nästan bara efternamn har (2026-10-09,
    // granskningen): "Hedströms sjukskrivning" och "ring andersson" gick ut,
    // för ingen lista här känner efternamn. Gement bara -sson/-qvist/-kvist:
    // "elström" och "informationsström" är ord.
    const arEfternamn = !arFornamn && ((gement.length >= 6 && !kant(gement) && !VANLIGA.has(gement)
      && (EFTERNAMNSFORM.test(gement) && (ordet !== gement || EFTERNAMNSFORM_GEMENT.test(gement))))
      || arEngelsktEfternamn(gement, en, ordet !== gement));
    // Ett namn med bindestreck i en adress (2026-10-09, korpusprovet):
    // "linkedin.com/in/karin-hedstrom" var en token som inte var ett namn,
    // fast den bär både förnamn och efternamn. Är en del ett förnamn och
    // varje annan del ett förnamn eller ett möjligt efternamn tas hela.
    // "maria-anmälan" släpps: anmälan är ett ord.
    const delar_ = gement.split('-').filter(Boolean);
    const bindestrecksnamn = !arFornamn && !arEfternamn && delar_.length > 1
      && delar_.some(d => arNamnet(d, en)) && delar_.every(d => arNamnet(d, en) || efternamnKandidat(d, en));
    const arNamn = arFornamn || arEfternamn || bindestrecksnamn;
    // Ortformen gäller bara gemena ord — versala tas redan av namnvakten,
    // och där finns sammanhanget som skiljer Berg från berg.
    const arOrt = !arNamn && ordet === gement && gement.length >= 5
      && ORTFORM.test(gement) && !kant(gement);
    if (!arNamn && !arOrt) continue;

    // Efternamnet, om nästa ord kan vara ett.
    let traff = ordet, slut = i;
    // En ort har inget efternamn, och ett efternamn tar inte nästa ord.
    // Över en punkt eller ett understreck bara mitt i en token
    // ("erik.svensson"), aldrig över ett snedstreck.
    const mellan = bitar[i + 1];
    const nasta = arFornamn && (arMellanrum(mellan) || mellan === '.' || mellan === '_') ? bitar[i + 2] : null;
    if (nasta && !efter) {
      const n = /^([\p{L}](?:[\p{L}-]|['’](?=\p{L}))*)([^\p{L}]*)$/u.exec(nasta);
      const kandidat = n?.[1];
      // Ett efternamn som också är ett förnamn är fortfarande ett efternamn.
      // "leyla amin" gav två platshållare för att Amin står i SCB:s
      // register, och frontier fick två personer där det fanns en.
      // Ett vanligt svenskt ord är inget efternamn. "elisabeth igen" tog
      // "igen" — regeln frågade bara om ordet var ett stoppord, och "igen"
      // stod inte i den handskrivna listan. Nu frågar den ordlistan.
      const kg = kandidat?.toLowerCase();
      if (efternamnKandidat(kandidat, en)) {
        traff = `${ordet}${arMellanrum(mellan) ? ' ' : mellan}${kandidat}`;
        slut = i + 2;
        bitar[i + 2] = n[2];          // behåll skiljetecknet
        // Ett ord till, med samma efternamnsregel, när det förra var ett
        // förnamn eller nästa är versalt (2026-10-09, granskningen): "lex
        // Maria Øberg", "anna maria qwertzon" och "Anna Lind Qwertzon" tog
        // två ord, och resten stod kvar i klartext.
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
    // Samma person, oavsett om det korta eller det långa namnet kom först.
    //
    // "ella har varit sjukskriven, och ella nordin ringer" gav
    // [NAMN A] och [NAMN B] — två kollegor där det fanns en, eftersom
    // uppslaget bara letade efter LÄNGRE namn i kartan. Delar de ett ord är
    // det samma människa, och att av misstag slå ihop två är sämre svar
    // medan att missa ett är ett läckage.
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

/// Regel 2: versalt ord som inte känns igen.
///
/// Bara mitt i en mening. Ett versalt ord först i en mening är oftast bara
/// en menings början, och att maskera "Kan vi omplacera" vore absurt.
export function maskeraOkanda(text, { karta = new Map(), raknare = new Map() } = {}) {
  let ut = text;
  const gjorda = [];
  const en = arEngelsk(text);
  // Varje ord i ett maskerat flerordsnamn, uppslaget (2026-10-09,
  // granskningen, ReDoS): `byt` gick igenom hela kartan för varje nytt ord.
  // Den tidigaste posten vinner, som i genomgången.
  const iNamn = new Map();
  const minnsNamn = (helt, p) => {
    if (!/\s/.test(helt) || !/^[\p{L}\s-]+$/u.test(helt)) return;
    for (const d of helt.split(/\s+/)) if (!iNamn.has(d)) iNamn.set(d, p);
  };
  for (const [helt, p] of karta) minnsNamn(helt, p);
  // Bindestrecket måste med i ordet. Utan det blev "Ann-Katrin Boström"
  // till "[NAMN A]-Katrin Boström": förnamnet maskerat, resten kvar och
  // läsbart. Ett avstavat namn är ett namn, inte två.
  //
  // Före namnet duger mer än bokstav-plus-mellanslag. Villkoret var
  // `[\p{L},]\s`, och "Klient: Oskar Wendt" blev därför "Klient: Oskar
  // [NAMN A]" — kolonet diskvalificerade "Oskar", så vakten började om på
  // "Wendt" som mycket riktigt följer på en bokstav och ett mellanslag.
  // Efternamnet maskerat, förnamnet kvar, och eftersom hela namnet aldrig kom
  // in i kartan kunde inte delvakten städa upp heller.
  //
  // Kolon, semikolon, parentes och citattecken hör till samma mening som det
  // som följer. Punkt, utropstecken och radbrytning gör det inte, och är
  // fortfarande undantagna: "Kan vi omplacera" ska inte bli ett namn.
  //
  // Meningens första ord är också med, och det är ett omvänt beslut.
  //
  // Regeln var att ett versalt ord först i en mening bara är en menings
  // början. Den lät "Bettan kommer säkert säga" och "Oskar har dömts" gå ut
  // i klartext, och folk skriver namn först i meningar hela tiden. Jag prövade
  // macOS stavningskontroll som skiljedomare — den skulle veta att
  // "fakturorna" är ett ord och "Bettan" ett namn. Den svarade ORD på bettan,
  // oskar, wendt, molly och hedström. Oanvändbar.
  //
  // Då återstår ett binärt val: låta namn först i meningar passera, eller
  // maskera ett och annat substantiv i onödan. Stopplistan fångar det
  // vanligaste, grinden visar resten, och användaren kan skriva om. Ett namn
  // som slipper ut går inte att skriva om.
  //
  // Ordet efter det första får vara två bokstäver. "Enhetschef Marcus Ek"
  // gav "[NAMN E] Ek" eftersom kravet på tre bokstäver gällde varje ord i
  // kedjan, och Ek är ett vanligt svenskt efternamn. Första ordet måste
  // fortfarande vara tre, annars blir varje "Vi", "En" och "Om" ett namn.
  //
  // Gränsen före namnet är numera "inget ord-tecken intill" (2026-10-09,
  // granskningen). Den gamla listan över vad som fick stå före släppte
  // "rum 3 Hedström", "Mötet med  Hedström" (två mellanslag), "- Hedström"
  // i en punktlista, "Hedström & Wendt", "**Hedström**" och efternamnet i
  // "Svensson/Hedström". Undantagen är det som bär en token: bokstav,
  // siffra, punkt, @, bindestreck och snedstreck. Snedstrecket släpps bara mellan två versala
  // ord, så att en sökväg som /Users/namn inte blir namn. Apostrof före och
  // en platshållare tätt före ("[NAMN A]Hedström") stoppar inte: 'Hedström'
  // inom citattecken maskerades förut och ska fortsätta göra det. Inuti
  // namnet hör apostrofen till: "O’Brien" lämnade "Brien" kvar.
  //
  // Hakparentesen är inte längre en gräns (granskningen 2026-10-09). Den
  // fanns där för att våra egna platshållare inte skulle maskeras om, men den
  // släppte också allt du själv skrivit inom hakparentes: "[Xylo Svensson]"
  // och "[NAME Kalle]" gick ut med förnamnet. Nu lyfts bara de platshållare
  // som faktiskt står i kartan undan före vakten och läggs tillbaka efter;
  // en hakparentes som bara ser ut som en platshållare är text som all annan.
  const verkliga = new Set(karta.values());
  const lyfta = [];
  // Först bort med osynliga tecken, så att \u0003-tokens bara kan vara våra.
  ut = rensaOsynliga(ut).replace(/\[[^\]\n]{1,40}\]/g, p => (verkliga.has(p) ? `\u0003${lyfta.push(p) - 1}\u0003` : p));
  const ord = /(?:(?<![\p{L}\p{N}_.@\\/-])|(?<=(?<![\/\p{L}\p{N}])\p{Lu}\p{L}+\/))(\p{Lu}(?:['’]\p{Lu})?[\p{L}]{2,}(?:-\p{Lu}?[\p{L}]+)*(?:\s+\p{Lu}(?:['’]\p{Lu})?[\p{L}](?:[\p{L}]|-\p{Lu}?[\p{L}])*)*)/gu;

  ut = ut.replace(ord, (traff, _g, pos, hel) => {
    if (ARPLATSHALLARE.test(traff)) return traff;
    let delar = traff.split(/\s+/);
    // Bara de närmaste tecknen läses, aldrig hela texten före: en skiva från
    // början per träff är kvadratisk (ReDoS-provet). En lång följd blanktecken
    // räknas som en ny mening.
    const fram = hel.slice(Math.max(0, pos - 64), pos);
    const forst = /(?:[.!?]\s+|\n\s*)$/.test(fram) || (/^\s*$/.test(fram));
    const l = traff.toLowerCase();
    // Ett ensamt verb först i en mening är en uppmaning, inte ett namn. BARA
    // där: i kanten av ett namn ("Anna Ring") är det ett efternamn, och kant()
    // fick därför inte verben (säkerhetsgranskningen 2026-10-09).
    if (delar.length === 1 && forst && (VERB.has(l) || (en && SATSSTART_EN.has(l)))) return traff;
    // Engelska (fas 3): ett ord som också är ett efternamn men inte ett
    // vanligt förnamn — Best, Brown, Day, Park — först i en mening är ordet.
    if (en && delar.length === 1 && forst && EN_NAMNORD.has(l) && !vanligtNamn(l)) return traff;
    // Ett stoppord som också är ett förnamn är ett namn mitt i en mening
    // ("I met Will", "with May Johnson"), men inte bredvid ett tal ("May 5").
    const efterTraff = hel.slice(pos + traff.length, pos + traff.length + 8);
    // En månad ensam är en månad ("ends in April"); bara före ett efternamn
    // ("April Johnson") är den ett förnamn.
    const namnlik = (d, i) => en && NAMNLIKA_STOPP.has(d.toLowerCase()) && !(i === 0 && forst)
      && !(delar.length === 1 && MANADER_EN.has(d.toLowerCase()))
      && !/^\s*\d/.test(i === delar.length - 1 ? efterTraff : '') && !/\d\s*$/.test(i === 0 ? fram : '');
    const kantHar = (d, i) => (en && delar.length === 1 && valuta(d, fram, efterTraff)) || (kant(d.toLowerCase(), en) && !namnlik(d, i));
    if (delar.every(kantHar)) return traff;
    if (delar.length === 1 && SUBSTANTIV.test(l)) return traff;

    // Skala bort ofarliga ord i kanterna innan namnet maskeras.
    //
    // "Motpart Linnea Ahlberg" blev en enda platshållare, för villkoret var
    // att ALLA ord skulle vara ofarliga och två av tre var det inte. Säkert,
    // men frontier fick "Vårdnadstvist. [NAMN B], gemensam dotter" och
    // förlorade vem som var motpart. Rollen är inte namnet.
    let fore = '', efter = '';
    // Engelska: ett vanligt förnamn först i ett flerordsnamn hör till namnet,
    // också när det är ett ord ("Will Smith", "May Johnson", "Grace Kelly").
    // Bakifrån skalas bara stopporden, inte de vanliga engelska orden: ett
    // efternamn som råkar vara ett ord ("Anna Strand") ska inte bli kvar.
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
  // En okänd token lämnas, aldrig tom: tom fogade ihop namnet runt den.
  ut = ut.replace(/\u0003(\d+)\u0003/g, (m, i) => lyfta[Number(i)] ?? m);
  return { text: ut, karta, raknare, funna: gjorda };

  function byt(traff) {
    if (karta.has(traff)) return karta.get(traff);
    // Är det en del av ett namn vi redan maskerat? Då är det samma person.
    //
    // Utan det blev "Amina Tahir" till [NAMN C] och lösa "Amina" till
    // [NAMN G], och frontier fick två sjuksköterskor att hålla isär i en
    // fråga som handlade om att inte peka ut en enda. Sammanhanget går
    // förlorat i precis det fall där det betyder mest.
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

/// Uttryck som måste överleva maskeringen ordagrant.
///
/// "lex Maria" innehåller ett förnamn, och namnvakten tog det: en fråga om
/// en lex Maria-anmälan gick iväg som en fråga om en "lex [NAMN C]-anmälan",
/// vilket ingen modell i världen kan svara på. Uttrycken nedan pekar inte ut
/// någon — de är namnet på en regel.
///
/// En lista och en ordgräns för kedjan och grinden (2026-10-09,
/// granskningen): grinden kände bara Maria och Sarah, kedjan också Laval och
/// Britannia, och båda använde \b, som är ASCII — "Ålex Maria" lyftes som
/// "lex Maria" ur mitten av ett namn. Gränsen är nu densamma som vaktens:
/// ingen bokstav, siffra eller understreck intill.
///
/// Den smalare listan (korpusprovet, samma dag): när listorna gjordes till en
/// tog grinden också Laval och Britannia, och "lex Laval" som grinden
/// maskerade förut gick ut. Ett undantag får inte växa av en sammanslagning.
/// Laval och Britannia maskeras nu i båda vägarna — en sämre sökfråga, inget
/// läckage.
const LAGBEGREPP = /(?<![\p{L}\p{N}_])lex\s+(?:Maria|Sarah)(?![\p{L}\p{N}_])/giu;
const SKYDDADE = [LAGBEGREPP];

const SENTINELL = i => `\ue001S${i}\ue001`;

/// Lyfter undan de skyddade uttrycken, kör det som ska köras, lägger tillbaka.
///
/// En sentinell utan versaler och utan bokstäver kan varken matcha namnregeln
/// eller något mönster — den är osynlig för allt som kommer emellan.
export function skydda(text) {
  const funna = [];
  let ut = String(text || '');
  // Inte när ett namn följer (2026-10-09, granskningen): "lex Maria
  // Svensson" lyftes undan här utan att fråga, och kedjan skickade
  // "lex Maria [NAMN A]" — förnamnet i klartext. Samma villkor som utatGrind.
  for (const re of SKYDDADE) {
    ut = ut.replace(re, (traff, i, hela) => {
      if (NAMNFOLJER(traff, i, hela)) return traff;
      funna.push(traff); return SENTINELL(funna.length - 1);
    });
  }
  return { text: ut, aterstall: t => funna.reduce((acc, v, i) => acc.split(SENTINELL(i)).join(v), String(t)) };
}

export { ARPLATSHALLARE, STOPP, SKYDDADE };

/// ── Den utgående grinden ──────────────────────────────────────────────────
///
/// En text som ska lämna datorn utanför den granskade nyttolasten — en
/// sökfråga, ett verktygsargument — går genom den här. Ett ställe, så att de
/// inte kan glida isär.
///
/// De gled isär. Sökrutan hade sin egen grind som bara körde mönstren, och
/// verktygsargumenten hade ingen alls: revisionen 2026-09-29 (H6) skickade
/// ett syntetiskt namn och personnummer oförändrade i en URL-parameter till
/// riksdagens koppling. En maskerad inledande fråga säger ingenting om vad
/// modellen sedan hittar på för argument.
///
/// Kartan först, mönstren sedan, personnamnsvakten sist — samma ordning som
/// sändvägen. `maskeraOkanda` är inte med, med flit: den fångar också varje
/// versalt ord den inte känner igen, och hade strypt "Malmö" ur en fråga om
/// en kommunal taxa. Se lib/uppslag.mjs för mätningen.
/// Begrepp som bär ett förnamn men inte är en person.
///
/// "lex Maria" och "lex Sarah" är författningar, och bland det vanligaste en
/// handläggare i vård och omsorg slår upp. Namnvakten ser bara "Maria" och
/// "Sarah" och strök dem, så "lex Maria tidsfrist" blev "tidsfrist" — en
/// sökning på ingenting.
///
/// Listan är kort med flit: varje post är ett begrepp där namnet INTE pekar
/// ut någon.
///
/// Men bara när inget namn följer (2026-10-09, granskningen): "lex Maria
/// Svensson" lyfte undan "lex Maria", och Svensson stod ensam kvar där ingen
/// vakt känner igen ett efternamn. Följer ett versalt ord är Maria ett
/// förnamn och hela namnet ska bort.
const BEGREPP = LAGBEGREPP;
// Ett namn följer om nästa ord är versalt (\p{Lu}, som vakten räknar) eller
// skulle tas som efternamn av förnamnsvakten (2026-10-09, granskningen): med
// [A-ZÅÄÖ] släpptes "lex Maria Øberg", med bara versal "lex maria qwertzon".
function NAMNFOLJER(hela, i, t) {
  // "lex Maria-Qwertzon": ett versalt led efter bindestrecket är ett namn,
  // "lex Maria-anmälan" är begreppet.
  if (/^-\p{Lu}/u.test(t.slice(i + hela.length, i + hela.length + 2))) return true;
  const n = /^\s+([\p{L}](?:[\p{L}-]|['’](?=\p{L}))*)/u.exec(t.slice(i + hela.length, i + hela.length + 80));
  return Boolean(n && (/^\p{Lu}/u.test(n[1]) || efternamnKandidat(n[1], arEngelsk(t))));
}

export function utatGrind(text, { karta = new Map(), raknare = new Map(), sorter = null } = {}) {
  // Osynliga tecken bort först: \u0000-tokens nedan ska bara kunna vara våra.
  const kant = ommaskera(rensaOsynliga(text), karta);
  const m0 = maskera(kant, { karta, raknare, sorter });
  // Sist bland siffrorna: den oberoende efterkontrollen. Det den hittar som
  // mönstren missat maskeras här i stället för att gå ut — grinden fallerar
  // stängt på riktigt, inte bara i ett prov (2026-10-09, granskningen).
  const m = maskeraKvar(m0.text, { karta, raknare, sorter });

  // Begreppen lyfts undan före namnvakten och läggs tillbaka efter.
  const skydd = [];
  const undan = m.text.replace(BEGREPP, (t, i, hela) => {
    if (NAMNFOLJER(t, i, hela)) return t;
    skydd.push(t); return `\u0000${skydd.length - 1}\u0000`;
  });

  const forn = maskeraFornamn(undan, { karta, raknare });
  const delar = maskeraDelar(forn.text, karta);
  return delar.text.replace(/\u0000(\d+)\u0000/g, (m, i) => skydd[Number(i)] ?? m);
}

/// Samma grind över ett helt argumentobjekt.
///
/// Varje strängvärde, hur djupt det än ligger. Nycklarna rörs inte — de är
/// verktygets schema, inte användarens text.
///
/// Fail closed: står en identifierare kvar efteråt kastar den. Ett anrop som
/// inte går är begripligt; ett anrop som tyst bär ut ett personnummer i en
/// querysträng upptäcks aldrig.
export function grindaArgument(argument, { karta = new Map(), raknare = new Map(), sorter = null } = {}) {
  // Platshållarna städas bort, precis som ur en sökfråga.
  //
  // "[NAMN A] klagomål" i en söksträng säger två saker till mottagaren: att
  // något maskerats, och var. Och den hittar ingenting — ett verktyg som
  // söker på en platshållare söker på en text som inte finns.
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
