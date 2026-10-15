
import { tx } from './sprakstod.mjs';
import { rensaOsynliga } from './failclosed.mjs';

const niva = n => ({
  get etikett() { return tx(`klassning.etikett.${n}`); },
  get om() { return tx(`klassning.om.${n}`); },
});
export const NIVAER = { 0: niva(0), 1: niva(1), 2: niva(2), 3: niva(3) };

const SKAL = id => tx(`klassning.skal.${id}`);

const ORD = '[\\p{L}\\p{N}_]';
const U = re => new RegExp(re.source
  .replace(/\\b/g, (m, i, src) => (/^(?:[\p{L}\p{N}(]|\\[wdp])/u.test(src.slice(i + 2, i + 4)) ? `(?<!${ORD})` : `(?!${ORD})`))
  .replace(/\\w/g, ORD), re.flags.includes('u') ? re.flags : re.flags + 'u');

const SKYDDAD = [
  [/\b(skyddad identitet\w*|skyddade personuppgifter|skyddad folkbokföring|kvarskrivning\w*|sekretessmarker\w*|fingerade personuppgifter)\b/i, 'skyddadIdentitet'],
  [/\b(hot om våld|dödshot|hotbild\w*|våld i nära relation|misshandel\w*|kvinnofrid|skyddat boende|besöksförbud\w*|kontaktförbud\w*)\b/i, 'hotVald'],
  [/\b(säkerhetsskydd\w*|säkerhetsklass\w*|kvalificerat hemlig\w*|hemlig uppgift\w*|totalförsvar\w*|skyddsobjekt\w*|rikets säkerhet)\b/i, 'sakerhetsskydd'],
  [/\b(människohandel\w*|hedersrelaterat|hedersförtryck\w*|hedersvåld\w*|terrorbrott\w*|vittnesskydd\w*)\b/i, 'utsatt'],
  [/\b(protected identity|witness protection|confidential address|address confidentiality|safe house|women'?s shelter|domestic violence shelter)\b/i, 'skyddadIdentitet'],
  [/\b(death threats?|threat(?:s|ened)? (?:of|with) violence|domestic (?:violence|abuse)|intimate partner violence|restraining order|protective order|no-contact order|assault(?:ed|s)?|battered|stalk(?:ing|er|ed))\b/i, 'hotVald'],
  [/\b(classified (?:information|documents?|material)|top secret|national security|security clearance\w*|critical infrastructure)\b/i, 'sakerhetsskydd'],
  [/\b(human trafficking|honou?r[- ]based (?:violence|abuse)|honou?r killing|forced marriage|terroris[mt]\w*)\b/i, 'utsatt'],
];

const KANSLIG = [
  [/\b(diagnos\w*|sjukdom\w*|sjukskriven\w*|sjukskrivning|vårdskada\w*|journal\w*|remiss\w*|medicin\w*|läkemedel\w*|behandling\w*|psykiatri\w*|beroende\w*|missbruk\w*|(?<!be )patient(?!ly|ce)\w*|brukare\w*|vårdtagare\w*|hemtjänst\w*|hemsjukvård\w*|omsorg\w*|vårdcentral\w*|sjukhus\w*|läkare\w*|sjuksköterska\w*|undersköterska\w*|omvårdnad\w*|rehabilitering\w*|funktionsnedsättning\w*|lss)\b/i, 'halsaOmsorg'],
  [/\b(demens\w*|cancer\w*|hiv|adhd|autism|depression\w*|ångest\w*|självmord\w*|stroke\w*|diabetes\w*|hjärtsvikt\w*|kol|epilepsi\w*|schizofreni\w*|bipolär|ätstörning\w*|psykos\w*|utmattning\w*)\b/i, 'halsa'],
  [/\b(lvu|lvm|lpt|lrv|sol |socialtjänstlagen|biståndsbeslut\w*|omhändertagande\w*|orosanmälan\w*|familjehem\w*|kontaktperson\w*|försörjningsstöd\w*|ekonomiskt bistånd)\b/i, 'socialtjanst'],
  [/\b(facklig\w*|fackförbund\w*|förtroendevald i|religiös\w*|trosuppfattning\w*|etniskt ursprung|sexuell läggning|hbtq|politisk åsikt|medlem i partiet)\b/i, 'artikel9'],
  [/\b(brottsmisstanke\w*|polisanmälan\w*|förundersökning\w*|åtal\w*|dom(?:en|slut)?|straff\w*|villkorlig|kriminalvård\w*|belastningsregistret)\b/i, 'lagovertradelser'],
  [/\b(korruption\w*|mutbrott|muta|mutor|jäv\w*|bestickning|trolöshet mot huvudman|förskingring\w*|bedrägeri\w*|bokföringsbrott|penningtvätt\w*|oegentlighet\w*|urkundsförfalskning|skattebrott|insiderbrott)\b/i, 'misstankeBrott'],
  [/\b(misstänk\w*|anmäl\w*|utred\w*|granskning)\b[^.!?]{0,80}\b(brott|bedrägeri\w*|stöld|fusk|oegentlighet\w*|olagligt|kickback\w*|svarta pengar|falsk\w* faktur\w*|fiktiv\w* faktur\w*)\b/i, 'misstankeBrott'],
  [/\b(?:falsk|fiktiv|påhittad)\w*\s+faktur\w*|\bluftfaktur\w*|\bbluffaktur\w*/i, 'misstankeBrott'],
  [/\b(faktur\w*|betal\w*|utbetal\w*|ersättning\w*|arvode\w*|konsultarvod\w*)\b[\s\S]{0,160}?\b(?:aldrig|inte|utan)\s+(?:\w+\s+){0,3}?(levererat|levererad\w*|utfört|utförd\w*|motpresta\w*|arbetat|arbete)\b/i, 'misstankeBrott'],
  [/\b(?:aldrig|inte|utan)\s+(?:\w+\s+){0,3}?(?:levererat|utfört|motpresta\w*)\b[\s\S]{0,160}?\b(faktur\w*|betal\w*|utbetal\w*)/i, 'misstankeBrott'],
  [/\b(vårdnadstvist\w*|vårdnadsutredning\w*|ensam vårdnad|gemensam vårdnad|växelvis boende|umgängesrätt\w*|umgängesstöd|umgängesbegränsning|boendeutredning\w*|samarbetssamtal|faderskapsutredning\w*|adoptionsutredning\w*)\b/i, 'familjeratt'],
  [/\b(dömd|dömts|dömdes|fälld|fällts|straffad|avtjänat|avtjänar|frivård|skyddstillsyn|samhällstjänst|villkorlig dom|ungdomsvård|kontraktsvård)\b/i, 'lagovertradelser'],
  [/\b(narkotikabrott|narkotikainnehav|ringa narkotika|rattfylleri|grov olovlig körning|vapenbrott|olaga hot|olaga frihetsberövande|sexualbrott|barnpornografibrott|våldtäkt|rån|grov stöld)\b/i, 'lagovertradelser'],
  [/\b(lex sarah|lex maria|vårdskada\w*|avvikelse\w*|tillbud\w*|anmälan till ivo)\b/i, 'tillsyn'],
  [/\b(uppsägning\w*|avsked\w*|varning\w*|omplacer\w*|rehabilitering\w*|arbetsanpassning\w*|kränkande särbehandling|mobbning\w*|trakasserier\w*|visselblås\w*|repressali\w*|larmade om|slagit larm)\b/i, 'personal'],
  [/\b(anbudssekretess|affärshemlighet\w*|företagshemlighet\w*|31 kap\.? 16 §|absolut sekretess)\b/i, 'affarssekretess'],

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

const PERSONNUMMER = /(?<![\d-])(?:19|20)?\d{2}(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01]|6[1-9]|[78]\d|9[01])[-+]?\d{4}(?![\d-])/;

const ID_ENGELSKA = /(?<![\d-])(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}(?![\d-])|\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z] ?\d{2} ?\d{2} ?\d{2} ?[A-D]\b/;

const INCIDENT = [
  [/\b(personuppgiftsincident\w*|dataintrång\w*|personuppgiftsbiträd\w*|registerutdrag\w*|de registrerade|sanktionsavgift\w*|incidentanmäl\w*)\b/i, 'personuppgifter'],
  [/\b(imy|datainspektionen|dataskyddsförordning\w*|gdpr)\b[\s\S]{0,120}?\b(anmäl\w*|klagomål\w*|klaga\w*|incident\w*|läck\w*|sanktion\w*|tillsyn\w*|överträd\w*|brott mot|böter|bötfäll\w*|vite\w*|begäran|begärt|registerutdrag\w*|utlämna\w*|personuppgifter om|complaint\w*|breach\w*|fine[sd]?|sanction\w*|investigat\w*|request\w*|violat\w*|leak\w*)\b/i, 'personuppgifter'],
  [/\b(anmäl\w*|klagomål\w*|klaga\w*|incident\w*|läck\w*|sanktion\w*|tillsyn\w*|överträd\w*|brott mot|böter|bötfäll\w*|vite\w*|begäran|begärt|registerutdrag\w*|complaint\w*|breach\w*|fine[sd]?|sanction\w*|investigat\w*|violat\w*|leak\w*)\b[\s\S]{0,120}?\b(imy|datainspektionen|dataskyddsförordning\w*|gdpr)\b/i, 'personuppgifter'],
  [/\bpersonnummer\b[\s\S]{0,80}\b(fel|läck\w*|obehörig\w*|förlorad\w*|stulen|spridd\w*)\b/i, 'personuppgifter'],
  [/\b(data breach\w*|personal data breach|security breach|unauthori[sz]ed access|data processor|data subjects?|data protection authority|subject access request)\b/i, 'personuppgifter'],
  [/\b(social security numbers?|ssns?|national insurance numbers?|personal data)\b[\s\S]{0,80}\b(wrong|leak\w*|unauthori[sz]ed|lost|stolen|exposed|sent to)\b/i, 'personuppgifter'],
];

const FORBUND = /(?<![\p{L}])(LIVS|Kommunal|Unionen|IF Metall|Byggnads|Vision|Vårdförbundet|Transport|Handels|Seko|Sveriges Ingenjörer|Akademikerförbundet|Lärarförbundet|Fastighets|GS-facket|Hotell- och restaurangfacket|HRF)(?![\p{L}])/u;

const FORBUND_ENGELSKA = /(?<![\p{L}])(Teamsters|AFL-CIO|SEIU|UNISON|UAW|AFSCME|GMB union|Unite the Union|NASUWT|National Education Association|American Federation of Teachers)(?![\p{L}])/u;

const UTPEKAD = [
  /\b\d{6}-\d{4}\b/,
  /\borg\.?\s?nr\b|\borganisationsnummer\b/i,
  /\b(vår|vår[at]|min|mitt|en av (?:våra|dem))\s+(klient\w*|kund\w*|hyresgäst\w*|medarbetar\w*|anställd\w*|chaufför\w*|brukar\w*|elev\w*|patient\w*|leverantör\w*|entreprenör\w*|förare)/i,
  /\b(klienten|kunden|hyresgästen|medarbetaren|brukaren|patienten|eleven|den anställde)\b/i,
  /\b(ett skyddsombud|skyddsombudet|en medarbetare|en anställd|en av våra|en kollega)\b/i,
  /\bkundreskontra\w*|\bleverantörsreskontra\w*|\blöneunderlag\w*|\bkassajournal\w*/i,
  /\b\d{2}-\d{7}\b/,
  /\b(our|my|one of (?:our|my|their))\s+(clients?|customers?|tenants?|employees?|staff members?|drivers?|students?|pupils?|patients?|suppliers?|vendors?|contractors?|residents?)\b/i,
  /\bthe (client|tenant|employee|patient|student|pupil|resident|applicant|claimant)\b/i,
  /\b(a safety rep(?:resentative)?|an employee|a colleague|a coworker|a co-worker|a staff member)\b/i,
  /\b(accounts receivable|accounts payable|payroll (?:data|records?)|cash ledger)\b/i,
];

const PEKAR_UT = new Set(['personnummer', 'identitetsnummer', 'namn', 'okant-egennamn', 'fornamn',
  'epost', 'telefon', 'adress', 'kontonummer', 'iban', 'organisationsnummer']);

for (const lista of [SKYDDAD, KANSLIG, INCIDENT]) for (const rad of lista) rad[0] = U(rad[0]);
for (let i = 0; i < UTPEKAD.length; i++) UTPEKAD[i] = U(UTPEKAD[i]);

export function klassa(text, { funna = [], rojning = null } = {}) {
  const t = rensaOsynliga(text || '');
  const skal = [];
  let niva = 0;

  for (const [re, varfor] of SKYDDAD) if (re.test(t)) { niva = 3; skal.push(SKAL(varfor)); }
  if (niva < 3) for (const [re, varfor] of KANSLIG) if (re.test(t)) { niva = Math.max(niva, 2); skal.push(SKAL(varfor)); }
  if (niva < 3) for (const [re, varfor] of INCIDENT) if (re.test(t)) { niva = Math.max(niva, 2); skal.push(SKAL(varfor)); }

  if (niva < 2 && (PERSONNUMMER.test(t) || ID_ENGELSKA.test(t))) { niva = 2; skal.push(SKAL('personnummer')); }
  if (niva < 2 && (FORBUND.test(t) || FORBUND_ENGELSKA.test(t))) { niva = 2; skal.push(SKAL('artikel9')); }

  if (niva < 1 && UTPEKAD.some(re => re.test(t))) { niva = 1; skal.push(SKAL('utpekad')); }

  const sorter = [...new Set(funna.map(f => f.typ || f.sort).filter(Boolean))];
  const pekar = sorter.filter(s => PEKAR_UT.has(s));
  const namn = { 'okant-egennamn': 'namn', fornamn: 'namn' };
  const pekarNamn = [...new Set(pekar.map(p => namn[p] || p))];
  if (pekarNamn.length) {
    niva = Math.max(niva, 1);
    skal.push(tx('klassning.skal.enskild', { vad: pekarNamn.map(p => tx(`klassning.sort.${p}`)).join(', ') }));
  }

  if (rojning?.niva === 'hog' && niva < 2) { niva = Math.max(niva, 2); skal.push(SKAL('flera')); }
  else if (rojning?.niva === 'markbar' && niva < 1) { niva = 1; skal.push(SKAL('tillsammans')); }

  return { niva, ...NIVAER[niva], skal: [...new Set(skal)] };
}

export const kraverGodkannande = niva => niva >= 2;

const ALLMAN = U(/^\s*(vad (är|innebär|betyder|menas|räknas|skiljer)|vad säger (lagen|en |ett |[a-zåäö]+lagen|[a-zåäö]+balken)|vilken skillnad|skillnaden mellan|hur (fungerar|räknas|definieras)|vad krävs för att|finns det (någon |något )?(regel|lag|praxis)|what (?:is|are|does|do)|what does the (?:law|act|statute|regulation) say|the difference between|what'?s the difference|how (?:does|do|is|are) [^?]{0,60}(?:work|calculated|defined)|what is required (?:to|for)|is there (?:a |any )?(?:rule|law|precedent|case law))\b/i);

const PEKANDE = U(/(?<![\d-])(?:19|20)?\d{2}(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01]|6[1-9]|[78]\d|9[01])[-+]?\d{4}(?![\d-])|\b(han|hon|hen|honom|henne|hens|hans|hennes|denne|vår klient|min klient|barnet|dottern|sonen|he|she|him|her|his|hers|our client|my client|the child|the daughter|the son)\b/i);

export function arvaKlass(egen, burit, fraga) {
  const n = Number(burit) || 0;
  if (!n || n <= egen) return egen;
  const t = String(fraga || '');
  if (PEKANDE.test(t)) return Math.max(egen, n);
  if (ALLMAN.test(t)) return Math.max(egen, n - 1);
  return Math.max(egen, n);
}
