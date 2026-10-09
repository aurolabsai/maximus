// Informationsklassning: hur illa vore det om det här röjdes?
//
// Fyra nivåer, som i KLASSA och i de flesta kommuners egna anvisningar. De
// avgör inte VAD som maskeras — reglerna i maskering.mjs gör det ändå — utan
// vad MAXIMUS får göra utan att fråga.
//
//   0  Ingen skada          Allmänt, offentligt, ingen enskild berörd.
//   1  Begränsad skada      Interna uppgifter, namn och kontaktuppgifter.
//   2  Allvarlig skada      Känsliga personuppgifter och sekretess enligt OSL.
//   3  Mycket allvarlig     Skyddad identitet, hot och våld, säkerhetsskydd.
//
// Klassningen görs av regler, på originaltexten, innan något lämnat datorn.
// En modell som får avgöra det här gissar, och den som gissar fel om nivå 3
// gissar fel om någons säkerhet.
//
// Nivån styr två saker: om en sökning på webben får ske utan att fråga, och
// vad grinden säger innan något skickas till en frontier.

import { tx } from './sprakstod.mjs';
import { rensaOsynliga } from './failclosed.mjs';

// Etiketterna läses på det språk som gäller när de läses: `{ ...NIVAER[2] }`
// ger en färdig kopia på rätt språk.
const niva = n => ({
  get etikett() { return tx(`klassning.etikett.${n}`); },
  get om() { return tx(`klassning.om.${n}`); },
});
export const NIVAER = { 0: niva(0), 1: niva(1), 2: niva(2), 3: niva(3) };

/// Skälet på det språk som gäller.
const SKAL = id => tx(`klassning.skal.${id}`);

// `\b` och `\w` i JavaScript är ASCII: /\bångest/ träffar aldrig "ångest"
// först i en text, och /\bvåld\w*/ inte "våldet". U() skriver om mönstret
// med gränser över hela Unicode (fas 3) — samma mönster, rätt gränser.
const ORD = '[\\p{L}\\p{N}_]';
// Gränsen avgörs av vad som står efter: före en bokstav, en siffra, "(",
// \w eller \d är det en ordbörjan, annars ett ordslut. En enkel lookaround
// per gräns, så att mönstren förblir linjära och snabba.
const U = re => new RegExp(re.source
  .replace(/\\b/g, (m, i, src) => (/^(?:[\p{L}\p{N}(]|\\[wdp])/u.test(src.slice(i + 2, i + 4)) ? `(?<!${ORD})` : `(?!${ORD})`))
  .replace(/\\w/g, ORD), re.flags.includes('u') ? re.flags : re.flags + 'u');

/// Nivå 3. Det som kan sluta med att någon kommer till skada.
const SKYDDAD = [
  [/\b(skyddad identitet\w*|skyddade personuppgifter|skyddad folkbokföring|kvarskrivning\w*|sekretessmarker\w*|fingerade personuppgifter)\b/i, 'skyddadIdentitet'],
  [/\b(hot om våld|dödshot|hotbild\w*|våld i nära relation|misshandel\w*|kvinnofrid|skyddat boende|besöksförbud\w*|kontaktförbud\w*)\b/i, 'hotVald'],
  // Svenskan sätter ihop ord: "säkerhetsskyddsklassificerad" innehåller
  // "säkerhetsskydd" men ordgränsen efter faller aldrig. Ändelserna måste
  // med, annars klassas det farligaste som harmlöst.
  [/\b(säkerhetsskydd\w*|säkerhetsklass\w*|kvalificerat hemlig\w*|hemlig uppgift\w*|totalförsvar\w*|skyddsobjekt\w*|rikets säkerhet)\b/i, 'sakerhetsskydd'],
  [/\b(människohandel\w*|hedersrelaterat|hedersförtryck\w*|hedersvåld\w*|terrorbrott\w*|vittnesskydd\w*)\b/i, 'utsatt'],
  // Engelska (fas 3). Körs alltid, bredvid svenskan.
  [/\b(protected identity|witness protection|confidential address|address confidentiality|safe house|women'?s shelter|domestic violence shelter)\b/i, 'skyddadIdentitet'],
  [/\b(death threats?|threat(?:s|ened)? (?:of|with) violence|domestic (?:violence|abuse)|intimate partner violence|restraining order|protective order|no-contact order|assault(?:ed|s)?|battered|stalk(?:ing|er|ed))\b/i, 'hotVald'],
  [/\b(classified (?:information|documents?|material)|top secret|national security|security clearance\w*|critical infrastructure)\b/i, 'sakerhetsskydd'],
  [/\b(human trafficking|honou?r[- ]based (?:violence|abuse)|honou?r killing|forced marriage|terroris[mt]\w*)\b/i, 'utsatt'],
];

/// Nivå 2. Känsliga personuppgifter enligt artikel 9, och det OSL skyddar.
const KANSLIG = [
  // Sammanhanget, inte sjukdomsnamnen. En lista på diagnoser blir aldrig
  // färdig; orden runt omkring säger samma sak och tar inte slut.
  [/\b(diagnos\w*|sjukdom\w*|sjukskriven\w*|sjukskrivning|vårdskada\w*|journal\w*|remiss\w*|medicin\w*|läkemedel\w*|behandling\w*|psykiatri\w*|beroende\w*|missbruk\w*|(?<!be )patient(?!ly|ce)\w*|brukare\w*|vårdtagare\w*|hemtjänst\w*|hemsjukvård\w*|omsorg\w*|vårdcentral\w*|sjukhus\w*|läkare\w*|sjuksköterska\w*|undersköterska\w*|omvårdnad\w*|rehabilitering\w*|funktionsnedsättning\w*|lss)\b/i, 'halsaOmsorg'],
  [/\b(demens\w*|cancer\w*|hiv|adhd|autism|depression\w*|ångest\w*|självmord\w*|stroke\w*|diabetes\w*|hjärtsvikt\w*|kol|epilepsi\w*|schizofreni\w*|bipolär|ätstörning\w*|psykos\w*|utmattning\w*)\b/i, 'halsa'],
  [/\b(lvu|lvm|lpt|lrv|sol |socialtjänstlagen|biståndsbeslut\w*|omhändertagande\w*|orosanmälan\w*|familjehem\w*|kontaktperson\w*|försörjningsstöd\w*|ekonomiskt bistånd)\b/i, 'socialtjanst'],
  [/\b(facklig\w*|fackförbund\w*|förtroendevald i|religiös\w*|trosuppfattning\w*|etniskt ursprung|sexuell läggning|hbtq|politisk åsikt|medlem i partiet)\b/i, 'artikel9'],
  [/\b(brottsmisstanke\w*|polisanmälan\w*|förundersökning\w*|åtal\w*|dom(?:en|slut)?|straff\w*|villkorlig|kriminalvård\w*|belastningsregistret)\b/i, 'lagovertradelser'],
  // Brott heter sällan "brottsmisstanke" när någon berättar om det.
  //
  // Sett skarpt 2026-09-26: en fråga om fjorton fakturor till en leverantör
  // som kanske inte levererat något, med företagsnamn, organisationsnummer
  // och en utpekad inköpschef, klassades som Öppen — nivå 0. Ingen av
  // raderna ovan matchade, för personen skrev "jag misstänker" och "ska jag
  // anmäla", inte "brottsmisstanke". En misstanke om brott mot en namngiven
  // person är en uppgift om lagöverträdelse oavsett vilka ord den bärs i.
  [/\b(korruption\w*|mutbrott|muta|mutor|jäv\w*|bestickning|trolöshet mot huvudman|förskingring\w*|bedrägeri\w*|bokföringsbrott|penningtvätt\w*|oegentlighet\w*|urkundsförfalskning|skattebrott|insiderbrott)\b/i, 'misstankeBrott'],
  [/\b(misstänk\w*|anmäl\w*|utred\w*|granskning)\b[^.!?]{0,80}\b(brott|bedrägeri\w*|stöld|fusk|oegentlighet\w*|olagligt|kickback\w*|svarta pengar|falsk\w* faktur\w*|fiktiv\w* faktur\w*)\b/i, 'misstankeBrott'],
  [/\b(?:falsk|fiktiv|påhittad)\w*\s+faktur\w*|\bluftfaktur\w*|\bbluffaktur\w*/i, 'misstankeBrott'],
  // Formen på fakturabedrägeri, utan att ordet nämns: något är betalt och
  // ingenting levererat. Det var precis så fallet ovan var skrivet — "14
  // fakturor till en ny leverantör som jag misstänker inte levererat något".
  // Avståndet är generöst för att meningen kan vara lång, men båda leden
  // måste finnas: en faktura ensam är inget brott, och "inte levererat"
  // ensamt är en leveransförsening.
  [/\b(faktur\w*|betal\w*|utbetal\w*|ersättning\w*|arvode\w*|konsultarvod\w*)\b[\s\S]{0,160}?\b(?:aldrig|inte|utan)\s+(?:\w+\s+){0,3}?(levererat|levererad\w*|utfört|utförd\w*|motpresta\w*|arbetat|arbete)\b/i, 'misstankeBrott'],
  [/\b(?:aldrig|inte|utan)\s+(?:\w+\s+){0,3}?(?:levererat|utfört|motpresta\w*)\b[\s\S]{0,160}?\b(faktur\w*|betal\w*|utbetal\w*)/i, 'misstankeBrott'],
  // Familjerätt när barn är inblandade. En vårdnadstvist med ett namngivet
  // barn klassades som Öppen — nivå 0, ingen grind alls — fast den innehöll
  // personnummer, en fyraåring vid namn och en narkotikadom.
  //
  // "Vårdnadshavare" står INTE här. Det ordet finns i varje skolutskick, och
  // en regel som stoppar dem gör grinden till en dörr ingen orkar öppna.
  [/\b(vårdnadstvist\w*|vårdnadsutredning\w*|ensam vårdnad|gemensam vårdnad|växelvis boende|umgängesrätt\w*|umgängesstöd|umgängesbegränsning|boendeutredning\w*|samarbetssamtal|faderskapsutredning\w*|adoptionsutredning\w*)\b/i, 'familjeratt'],
  // Någon HAR dömts. "Brottsmisstanke" och "dom" fanns redan, men ingen skriver
  // så — man skriver "har dömts för" och nämner brottet vid namn.
  [/\b(dömd|dömts|dömdes|fälld|fällts|straffad|avtjänat|avtjänar|frivård|skyddstillsyn|samhällstjänst|villkorlig dom|ungdomsvård|kontraktsvård)\b/i, 'lagovertradelser'],
  [/\b(narkotikabrott|narkotikainnehav|ringa narkotika|rattfylleri|grov olovlig körning|vapenbrott|olaga hot|olaga frihetsberövande|sexualbrott|barnpornografibrott|våldtäkt|rån|grov stöld)\b/i, 'lagovertradelser'],
  [/\b(lex sarah|lex maria|vårdskada\w*|avvikelse\w*|tillbud\w*|anmälan till ivo)\b/i, 'tillsyn'],
  [/\b(uppsägning\w*|avsked\w*|varning\w*|omplacer\w*|rehabilitering\w*|arbetsanpassning\w*|kränkande särbehandling|mobbning\w*|trakasserier\w*|visselblås\w*|repressali\w*|larmade om|slagit larm)\b/i, 'personal'],
  [/\b(anbudssekretess|affärshemlighet\w*|företagshemlighet\w*|31 kap\.? 16 §|absolut sekretess)\b/i, 'affarssekretess'],

  // ── Engelska (fas 3) ────────────────────────────────────────────────────
  //
  // Körs alltid, bredvid svenskan, på vilket språk ytan än står. Samma
  // princip: sammanhanget, inte en lista på diagnoser.
  [/\b(diagnos(?:is|es|ed)|illness\w*|disease\w*|sick (?:leave|note)|medical (?:record|history|condition|leave)\w*|health record\w*|referral|medication\w*|prescription\w*|psychiatr\w*|addiction\w*|substance abuse|patients|the patient|a patient|my patient|hospitali[sz]\w*|hospital|physician|nurse|nursing home|home care|caregiver|rehab(?:ilitation)?|disabilit(?:y|ies)|therap(?:y|ist))\b/i, 'halsaOmsorg'],
  [/\b(dementia|alzheimer'?s|cancer|hiv|aids|adhd|autism|autistic|depress(?:ion|ed)|anxiety|suicid\w*|stroke|diabetes|diabetic|heart failure|copd|epilep\w*|schizophreni\w*|bipolar|eating disorder|anorexia|bulimia|psychosis|psychotic|burnout|pregnan\w*|miscarriage|abortion)\b/i, 'halsa'],
  [/\b(child protective services|child welfare|foster (?:care|home|parent)\w*|social services|social worker|welfare benefits?|social assistance|taken into care|safeguarding (?:concern|referral))\b/i, 'socialtjanst'],
  [/\b(trade union|labou?r union|union member\w*|union rep\w*|shop steward|religio(?:n|us)|church member\w*|ethnic\w*|racial|sexual orientation|lgbtq?\+?|gay|lesbian|bisexual|transgender|political (?:opinion|views|affiliation|belief)s?|party member\w*)\b/i, 'artikel9'],
  [/\b(criminal (?:record|charges?|investigation|offen[cs]e|case)|police report\w*|arrest(?:ed)?|indict\w*|prosecut\w*|convict(?:ed|ion)|sentenced|probation|parole|prison|jail(?:ed)?|felony|misdemeanou?r|dui|dwi)\b/i, 'lagovertradelser'],
  [/\b(corruption|brib\w*|kickbacks?|embezzle\w*|fraud\w*|money laundering|tax evasion|insider trading|forg(?:ery|ed)|conflict of interest|misappropriat\w*)\b/i, 'misstankeBrott'],
  [/\b(suspect\w*|report\w*|investigat\w*)\b[^.!?]{0,80}\b(crime|fraud\w*|theft|stole|stealing|illegal\w*|kickbacks?|cheat\w*|fake invoices?|fictitious invoices?)\b/i, 'misstankeBrott'],
  [/\b(?:fake|fictitious|bogus|sham|phony)\s+invoices?\b/i, 'misstankeBrott'],
  [/\b(invoice\w*|paid|payment\w*|payout\w*|fees?)\b[\s\S]{0,160}?\bnothing\s+(?:\w+\s+){0,3}?(delivered|done|performed|provided|received)\b/i, 'misstankeBrott'],
  [/\b(invoice\w*|paid|payment\w*|payout\w*|fees?)\b[\s\S]{0,160}?\b(?:never|not|without)\s+(?:\w+\s+){0,3}?(delivered|performed|done|rendered|provided|worked)\b/i, 'misstankeBrott'],
  [/\b(custody (?:dispute|battle|evaluation|case|hearing)|sole custody|joint custody|shared custody|visitation rights|supervised visitation|parenting plan|paternity (?:test|case)|adoption (?:study|investigation|home study))\b/i, 'familjeratt'],
  [/\b(incident report|adverse event|patient safety incident|near miss|serious incident)\b/i, 'tillsyn'],
  [/\b(dismissal|dismissed|fired|termination of employment|written warning|disciplinary|harassment|harassed|bullying|bullied|whistleblow\w*|retaliation|grievance|performance improvement plan)\b/i, 'personal'],
  [/\b(trade secrets?|confidential (?:bid|tender|pricing)|proprietary information)\b/i, 'affarssekretess'],
];

/// Nivå 2: ett personnummer hör till en människa.
///
/// Stod förut bara som en av flera "pekar ut"-träffar på nivå 1. Men ett
/// personnummer är det mest identifierande som finns i svensk förvaltning —
/// det öppnar folkbokföring, vård och ekonomi. Sett skarpt: en fråga med
/// hyresgästens personnummer, namn och adress klassades Öppen.
/// Månad 01–12 och dag 01–31, annars är det inget datum.
///
/// Ett organisationsnummer har samma form: 556712-3344. Utan datumkravet
/// klassades "org.nr 556712-3344" som personnummer — men 67 är ingen månad.
/// Samordningsnummer har dag + 60, och de ska också med.
const PERSONNUMMER = /(?<![\d-])(?:19|20)?\d{2}(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01]|6[1-9]|[78]\d|9[01])[-+]?\d{4}(?![\d-])/;

/// Nivå 2: engelska identitetsnummer (fas 3) — amerikanskt SSN (inte 000,
/// 666 eller 9xx först) och brittiskt National Insurance-nummer.
const ID_ENGELSKA = /(?<![\d-])(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}(?![\d-])|\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z] ?\d{2} ?\d{2} ?\d{2} ?[A-D]\b/;

/// Nivå 2: personuppgifter på drift.
///
/// En läcka är känslig även när ingen enskild nämns vid namn. "4 200
/// personnummer till fel adress" klassades Öppen.
const INCIDENT = [
  [/\b(personuppgiftsincident\w*|dataintrång\w*|personuppgiftsbiträd\w*|registerutdrag\w*|de registrerade|sanktionsavgift\w*|incidentanmäl\w*)\b/i, 'personuppgifter'],
  [/\b(imy|datainspektionen|dataskyddsförordning\w*|gdpr)\b/i, 'personuppgifter'],
  [/\bpersonnummer\b[\s\S]{0,80}\b(fel|läck\w*|obehörig\w*|förlorad\w*|stulen|spridd\w*)\b/i, 'personuppgifter'],
  // Engelska (fas 3)
  [/\b(data breach\w*|personal data breach|security breach|unauthori[sz]ed access|data processor|data subjects?|data protection authority|subject access request)\b/i, 'personuppgifter'],
  [/\b(social security numbers?|ssns?|national insurance numbers?|personal data)\b[\s\S]{0,80}\b(wrong|leak\w*|unauthori[sz]ed|lost|stolen|exposed|sent to)\b/i, 'personuppgifter'],
];

/// Nivå 2: namngivna fackförbund.
///
/// "Facklig" fångas redan. Ingen skriver så — man skriver "hon har gått med
/// i LIVS". Medlemskap i fackförening är artikel 9 oavsett hur det uttrycks.
const FORBUND = /(?<![\p{L}])(LIVS|Kommunal|Unionen|IF Metall|Byggnads|Vision|Vårdförbundet|Transport|Handels|Seko|Sveriges Ingenjörer|Akademikerförbundet|Lärarförbundet|Fastighets|GS-facket|Hotell- och restaurangfacket|HRF)(?![\p{L}])/u;

/// Engelska förbund (fas 3). Namn som också är vanliga ord (Unite, Vision)
/// står inte här.
const FORBUND_ENGELSKA = /(?<![\p{L}])(Teamsters|AFL-CIO|SEIU|UNISON|UAW|AFSCME|GMB union|Unite the Union|NASUWT|National Education Association|American Federation of Teachers)(?![\p{L}])/u;

/// Nivå 1: en utpekad part i texten, utan maskeringens hjälp.
///
/// Nivå 1 hängde helt på `funna` — maskeringens fynd. I lokalt läge maskeras
/// ingenting, så `funna` är tom och nivå 1 tändes aldrig. Sett skarpt: noll
/// av 135 frågor blev nivå 1, fast tjugotvå borde.
const UTPEKAD = [
  /\b\d{6}-\d{4}\b/,                                   // organisationsnummer
  /\borg\.?\s?nr\b|\borganisationsnummer\b/i,
  /\b(vår|vår[at]|min|mitt|en av (?:våra|dem))\s+(klient\w*|kund\w*|hyresgäst\w*|medarbetar\w*|anställd\w*|chaufför\w*|brukar\w*|elev\w*|patient\w*|leverantör\w*|entreprenör\w*|inköpschef\w*|förare)/i,
  /\b(klienten|kunden|hyresgästen|medarbetaren|brukaren|patienten|eleven|den anställde)\b/i,
  /\b(ett skyddsombud|skyddsombudet|en medarbetare|en anställd|en av våra|en kollega)\b/i,
  /\bkundreskontra\w*|\bleverantörsreskontra\w*|\blöneunderlag\w*|\bkassajournal\w*/i,
  // Engelska (fas 3)
  /\b\d{2}-\d{7}\b/,                                  // EIN
  /\b(our|my|one of (?:our|my|their))\s+(clients?|customers?|tenants?|employees?|staff members?|drivers?|students?|pupils?|patients?|suppliers?|vendors?|contractors?|purchasing managers?|residents?)\b/i,
  /\bthe (client|tenant|employee|patient|student|pupil|resident|applicant|claimant)\b/i,
  /\b(a safety rep(?:resentative)?|an employee|a colleague|a coworker|a co-worker|a staff member)\b/i,
  /\b(accounts receivable|accounts payable|payroll (?:data|records?)|cash ledger)\b/i,
];

/// Nivå 1 avgörs av maskeringen: fanns det uppgifter om enskilda?
const PEKAR_UT = new Set(['personnummer', 'identitetsnummer', 'namn', 'okant-egennamn', 'fornamn',
  'epost', 'telefon', 'adress', 'kontonummer', 'iban', 'organisationsnummer']);

/// Klassar en text. `funna` är maskeringens fynd, om de finns.
for (const lista of [SKYDDAD, KANSLIG, INCIDENT]) for (const rad of lista) rad[0] = U(rad[0]);
for (let i = 0; i < UTPEKAD.length; i++) UTPEKAD[i] = U(UTPEKAD[i]);

export function klassa(text, { funna = [], rojning = null } = {}) {
  // Samma form som vakten (2026-10-09, granskningen): helbredda siffror och
  // "dia\u200bgnos" sänkte klassen, fast vakten läste dem som det de är.
  const t = rensaOsynliga(text || '');
  const skal = [];
  let niva = 0;

  for (const [re, varfor] of SKYDDAD) if (re.test(t)) { niva = 3; skal.push(SKAL(varfor)); }
  if (niva < 3) for (const [re, varfor] of KANSLIG) if (re.test(t)) { niva = Math.max(niva, 2); skal.push(SKAL(varfor)); }
  if (niva < 3) for (const [re, varfor] of INCIDENT) if (re.test(t)) { niva = Math.max(niva, 2); skal.push(SKAL(varfor)); }

  // Ett personnummer hör till en människa, och det är det mest
  // identifierande som finns. Sett skarpt: en fråga med hyresgästens
  // personnummer, namn och adress klassades Öppen.
  if (niva < 2 && (PERSONNUMMER.test(t) || ID_ENGELSKA.test(t))) { niva = 2; skal.push(SKAL('personnummer')); }
  // Medlemskap i fackförening är artikel 9, oavsett om ordet "facklig" står
  // där. Ingen skriver "facklig organisation" — man skriver "gått med i LIVS".
  if (niva < 2 && (FORBUND.test(t) || FORBUND_ENGELSKA.test(t))) { niva = 2; skal.push(SKAL('artikel9')); }

  // En utpekad part, läst ur texten. Nivå 1 hängde helt på maskeringens fynd,
  // och i lokalt läge maskeras ingenting — så `funna` var tom och nivå 1
  // tändes aldrig. Noll av 135 frågor blev nivå 1 i den skarpa körningen.
  if (niva < 1 && UTPEKAD.some(re => re.test(t))) { niva = 1; skal.push(SKAL('utpekad')); }

  const sorter = [...new Set(funna.map(f => f.typ || f.sort).filter(Boolean))];
  const pekar = sorter.filter(s => PEKAR_UT.has(s));
  const namn = { 'okant-egennamn': 'namn', fornamn: 'namn' };
  const pekarNamn = [...new Set(pekar.map(p => namn[p] || p))];
  if (pekarNamn.length) {
    niva = Math.max(niva, 1);
    skal.push(tx('klassning.skal.enskild', { vad: pekarNamn.map(p => tx(`klassning.sort.${p}`)).join(', ') }));
  }

  // Röjningsrisken lyfter en nivå: många oberoende uppgifter om samma person
  // pekar ut hen även när varje uppgift för sig är harmlös.
  if (rojning?.niva === 'hog' && niva < 2) { niva = Math.max(niva, 2); skal.push(SKAL('flera')); }
  else if (rojning?.niva === 'markbar' && niva < 1) { niva = 1; skal.push(SKAL('tillsammans')); }

  return { niva, ...NIVAER[niva], skal: [...new Set(skal)] };
}

/// Får en sökfråga gå ut utan att fråga användaren?
///
/// Noll och ett går ut. Två och tre frågar — och det är vid två och tre som
/// en sökhistorik hos någon annan blir ett problem, inte vid noll.
export const kraverGodkannande = niva => niva >= 2;

/// En allmän fråga om hur något fungerar. Ärver inte samtalets klass.
///
/// Utan ventilen blev "Vad är skillnaden mellan lex Sarah och lex Maria?"
/// nivå 2 därför att den ställdes mitt i ett ärende. Den frågan står i varje
/// lärobok. En grind som frågar om läroboksfrågor är en dörr ingen orkar
/// öppna, och då öppnas den till slut utan att någon läser.
const ALLMAN = U(/^\s*(vad (är|innebär|betyder|menas|räknas|skiljer)|vad säger (lagen|en |ett |[a-zåäö]+lagen|[a-zåäö]+balken)|vilken skillnad|skillnaden mellan|hur (fungerar|räknas|definieras)|vad krävs för att|finns det (någon |något )?(regel|lag|praxis)|what (?:is|are|does|do)|what does the (?:law|act|statute|regulation) say|the difference between|what'?s the difference|how (?:does|do|is|are) [^?]{0,60}(?:work|calculated|defined)|what is required (?:to|for)|is there (?:a |any )?(?:rule|law|precedent|case law))\b/i);

/// Något som pekar ut någon. Ärver alltid, hur allmänt formulerad frågan än är.
const PEKANDE = U(/(?<![\d-])(?:19|20)?\d{2}(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01]|6[1-9]|[78]\d|9[01])[-+]?\d{4}(?![\d-])|\b(han|hon|hen|honom|henne|hens|hans|hennes|denne|vår klient|min klient|barnet|dottern|sonen|he|she|him|her|his|hers|our client|my client|the child|the daughter|the son)\b/i);

/// Klassen samtalet bär vidare.
///
/// Klassningen kördes förut på varje fråga för sig. Men känsligheten sitter i
/// ÄRENDET, inte i meningen: "Vad händer om hon inte öppnar dörren?" bär inget
/// känsligt ord alls och handlar ändå om en 82-årig kvinna med demens.
///
/// Mätt mot facit på 135 frågor: utan arv 33 % rätt och 64 % för lågt. Med arv
/// och böjda mönster 81 %, med 5 % för lågt.
///
/// Ventilen: en allmän fråga utan utpekande ord ärver inte. En fråga med ett
/// pronomen gör det alltid — "hon" är den som samtalet handlar om.
export function arvaKlass(egen, burit, fraga) {
  const n = Number(burit) || 0;
  if (!n || n <= egen) return egen;
  const t = String(fraga || '');
  if (PEKANDE.test(t)) return Math.max(egen, n);
  // Ett steg ned, inte hela vägen. Första försöket släppte den allmänna
  // frågan till sin egen nivå och bytte fem onödiga grindar mot sex missade
  // — ett dåligt byte, för en missad grind kostar löftet och en onödig
  // kostar bara tålamod.
  if (ALLMAN.test(t)) return Math.max(egen, n - 1);
  return Math.max(egen, n);
}
