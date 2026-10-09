import { galler } from './grader.mjs';
import { aktuellt } from './sprakstod.mjs';

// Deterministisk maskering. Det som har ett format fångas av en regel, aldrig
// av en modell.
//
// Skälet är enkelt: en modell som missar ett personnummer en gång på hundra
// har brutit löftet. En regel som känner igen formatet missar aldrig. Modellen får ta det som inte har format — namn, orter,
// relationer — och där är misstag dyrare men inte lika katastrofala.
//
// Ordningen spelar roll. Längsta mönstret först, annars äter personnumret
// upp datumet som ligger inuti det.

// Plus är skiljetecknet för den som fyllt hundra: 19850817+2387. Utan det
// i teckenklassen blev numret tretton tecken långt och föll på längdkravet.
/// Avskiljarna, som de faktiskt skrivs.
///
/// `[-\s]` räcker inte. Revisionen 2026-09-28 (M3) skickade
/// `personnummer 19900101\u20111234` — med ett icke-brytande bindestreck,
/// U+2011 — och numret gick rakt igenom. Efterkontrollen rapporterade noll
/// kvar, alltså sa grinden att allt var maskerat.
///
/// Tecknet är inget någon skriver med flit. Det kommer ur Word, ur en
/// inklistrad PDF, ur ett mejl som passerat en klient som "snyggar till"
/// bindestreck. Just den texten — klistrad ur ett dokument — är precis den
/// text en handläggare för in i MAXIMUS.
///
/// Varianterna räknas därför upp i stället för att texten skrivs om. Att
/// normalisera användarens text före maskeringen hade flyttat varje position
/// och gjort att det vi maskerar inte längre står där vi tror; att vidga
/// klassen ändrar ingenting utom vad som matchar.
///
/// U+2010 hyphen · U+2011 non-breaking hyphen · U+2012 figure dash
/// U+2013 en dash · U+2014 em dash · U+2015 horizontal bar · U+2212 minus
/// U+FE63 small hyphen · U+FF0D fullwidth hyphen
const STRECK = '\\u2010-\\u2015\\u2212\\uFE63\\uFF0D-';

/// Mellanslagen likaså: U+00A0 hårt mellanslag är vad en webbsida ger, och
/// U+202F och U+2007 kommer ur tabeller och siffergrupper.
const BLANK = '\\s\\u00A0\\u2007\\u202F';

/// Båda, för det som skiljer siffergrupper åt.
const AVSKILJARE = STRECK + BLANK;
/// Samma tecken med strecket sist, för mönster med u-flaggan: där är
/// "-\s" ett ogiltigt intervall i stället för ett bindestreck.
const AVSKILJARE_U = BLANK + STRECK;

/// Bara siffrorna. Städar samma tecken som mönstren släpper igenom.
///
/// Den här och AVSKILJARE måste följas åt. Vidgades mönstret utan att `rent`
/// vidgades skulle `giltig()` få `1990010111234` med ett osynligt streck kvar
/// i, räkna fel antal tecken och avvisa ett personnummer som just matchats —
/// alltså maskera ingenting, tyst.
// Punkt, understreck och parentes med (2026-10-09, granskningen): 900101.1234,
// 900101_1234 och +46 (0)70-… är samma nummer, och `giltig()` måste räkna
// siffrorna i dem lika rätt som i den vanliga formen.
const SKRAP = new RegExp(`[+._()${AVSKILJARE}]`, 'g');
const rent = t => String(t).replace(SKRAP, '');

/// Börjar de tio siffrorna med ett datum som en människa kan vara född på?
///
/// Samordningsnummer lägger 60 på dagen, därav det andra intervallet.
export function arFodelsedag(s) {
  const m = Number(s.slice(2, 4)), d = Number(s.slice(4, 6));
  return m >= 1 && m <= 12 && ((d >= 1 && d <= 31) || (d >= 61 && d <= 91));
}

/// Mönstren, i den ordning de ska prövas.
export const MONSTER = [
  {
    typ: 'personnummer',
    re: new RegExp(`\\b(?:19|20)?\\d{6}[+${AVSKILJARE}]?\\d{4}\\b`, 'g'),
    // Formen avgör, inte kontrollsiffran.
    //
    // Luhn stod här som villkor, och i första skarpa provet gick
    // 19850817-2387 rakt igenom grinden — granskningen sa noll kvar. Ett
    // personnummer med en felskriven siffra är fortfarande ett personnummer
    // i fel händer, och en felskriven siffra är precis vad en handläggare
    // som skriver ur minnet producerar. Att maskera ett datum i onödan
    // kostar en rad i svaret. Att släppa ut ett personnummer kostar
    // produkten.
    giltig: v => { const s = rent(v); return (s.length === 10 || s.length === 12) && arFodelsedag(s.slice(-10)); },
  },
  // Varianterna som gick igenom (2026-10-09, granskningen): 1990-01-01-1234,
  // 900101.1234, 900101_1234 och x19850813-2399. `\b` brister mot en bokstav
  // intill, så gränsen är "ingen siffra", inte "ordgräns".
  {
    typ: 'personnummer',
    re: new RegExp(`(?<!\\p{N})(?:19|20)?\\d{2}(?:[-.]?\\d{2}){2}[+._${STRECK}]?\\d{4}(?!\\p{N})`, 'gu'),
    giltig: v => { const s = rent(v); return (s.length === 10 || s.length === 12) && arFodelsedag(s.slice(-10)); },
  },
  // Nordeas personkonto är clearing 3300 och personnumret (2026-10-09,
  // granskningen): "konto 33009001011234" skickade personnumret i klartext.
  // Sorten är personnummer, som inte går att stänga av.
  {
    typ: 'personkonto',
    re: new RegExp(`(?<!\\p{N})3300[${AVSKILJARE_U}]?(?:19|20)?\\d{6}[-+${AVSKILJARE_U}]?\\d{4}(?!\\p{N})`, 'gu'),
    giltig: v => { const s = rent(v); return (s.length === 14 || s.length === 16) && arFodelsedag(s.slice(-10)); },
  },
  {
    typ: 'organisationsnummer',
    // Månadspositionen är 20 eller högre — det är vad som skiljer en
    // organisation från en person. Luhn får styrka gissningen, inte stoppa den.
    re: new RegExp(`\\b\\d{6}[${AVSKILJARE}]?\\d{4}\\b`, 'g'),
    giltig: v => { const s = rent(v); return s.length === 10 && Number(s[2]) >= 2; },
  },
  {
    // Kvar blir det som har identitetsnumrets form men varken går att läsa
    // som födelsedag eller organisation: 771332-4855. Det är inget
    // artikelnummer — artikelnummer skrivs inte med bindestreck efter sjätte
    // siffran i ett kommunalt ärende.
    typ: 'identitetsnummer',
    re: /\b\d{6}[-+]\d{4}\b/g,
  },
  // ── Engelska identitetsnummer (fas 3, 2026-10-09) ──────────────────────
  //
  // Formerna körs alltid, oavsett språk: ett amerikanskt personnummer i en
  // svensk text är lika känsligt som i en engelsk.
  //
  // US Social Security Number: 123-45-6789 eller 123 45 6789. Områdena 000,
  // 666 och 900–999 delas aldrig ut, inte heller gruppen 00 eller serien
  // 0000. Utan avskiljare bara när ordet står bredvid — nio siffror i sig är
  // ett belopp eller ett ordernummer.
  { typ: 'ssn', re: new RegExp(`(?<![\\p{N}-])(?!000|666|9\\d\\d)\\d{3}([${AVSKILJARE_U}])(?!00)\\d{2}\\1(?!0000)\\d{4}(?![\\p{N}-])`, 'gu') },
  { typ: 'ssn', re: /(?<=\b(?:SSN|SS#|social security(?: number| no\.?| #)?)[\s:#.]{0,3})(?!000|666|9\d\d)\d{3}[\s.-]?(?!00)\d{2}[\s.-]?(?!0000)\d{4}(?!\p{N})/giu },
  // UK National Insurance number: AB123456C, AB 12 34 56 C. Prefixen BG, GB,
  // KN, NK, NT, TN och ZZ delas inte ut. Övriga ogiltiga bokstäver tas ändå:
  // QQ 12 34 56 C är HMRC:s eget exempel, och ett felskrivet nummer är ett nummer.
  { typ: 'ni', re: /(?<![\p{L}\p{N}])(?!BG|GB|KN|NK|NT|TN|ZZ)[A-Z]{2} ?\d{2} ?\d{2} ?\d{2} ?[A-D](?![\p{L}\p{N}])/gu },
  // Början av adressen är "inget adresstecken före", inte `\b` (2026-10-09,
  // granskningen, ReDoS): `\b` finns mellan varje bokstav och punkt i
  // "a.a.a.…", och varje sådan start läste raden till slutet — kvadratiskt,
  // elva sekunder på 50 000 tecken. Nu prövas varje följd en gång. Och
  // å, ä, ö hör till namnet: "åsa@kommun.se" lämnade "å" kvar framför.
  { typ: 'epost', re: /(?<![\w\u00C0-\u024F.+-])[\w\u00C0-\u024F.+-]+@[\w-]+\.[\w.-]+\b/g },
  // Skrivet för att undgå skördare, eller utan toppdomän (2026-10-09,
  // granskningen): "erik.svensson [at] kommun.se", "erik(at)kommun.se" och
  // "erik@kommun" gick ut med namnet i.
  { typ: 'epost', re: /(?<![\w\u00C0-\u024F.+-])[\w\u00C0-\u024F.+-]+(?:\s*(?:\[at\]|\(at\)|\{at\})\s*|@)[\w-]+(?:(?:\.|\s*(?:\[dot\]|\(dot\))\s*)[\w-]+)*/gi },
  // Sista gruppen är valfri. "0435-712 09" är nio siffror och ett fullgott
  // telefonnummer — mönstret krävde tio och lät det stå kvar i ett kommunalt
  // beslutsunderlag, mitt bland uppgifter som maskerades.
  // Och inte mitt i en sifferrad: "19 38 09 22 28 41" är ett uppläst
  // personnummer, inte ett telefonnummer som börjar på "09".
  { typ: 'telefon', re: new RegExp(`(?<!\\d)(?<!\\d[${AVSKILJARE}])(?:\\+46|0)[${AVSKILJARE}]?[1-9]\\d{0,2}[${AVSKILJARE}]?\\d{2,3}[${AVSKILJARE}]?\\d{2}(?:[${AVSKILJARE}]?\\d{2})?\\b`, 'g'),
    giltig: v => { const n = rent(v).replace(/^46/, '0').length; return n >= 8 && n <= 11; } },
  // Grupper med valfri längd efter riktnumret, punkt som avskiljare, (0)
  // efter landskoden och 0046 (2026-10-09, granskningen): "08-123 456 78",
  // "+46 (0)70-123 45 67", "0046701234567" och "070.123.45.67" stod kvar.
  // Ett datum med punkter är inget telefonnummer, därav undantaget.
  { typ: 'telefon',
    re: new RegExp(`(?<![\\p{N}+])(?<!\\p{N}[${AVSKILJARE_U}])(?:\\+46[${BLANK}]*(?:\\(0\\)[${BLANK}]*)?|0046[${AVSKILJARE_U}]?|0)[1-9](?:[.${AVSKILJARE_U}]?\\d){5,9}(?!\\p{N})`, 'gu'),
    giltig: v => telefonGiltig(v) },
  // Nordamerikanska nummer (fas 3): (555) 234-5678, 555-234-5678,
  // 555.234.5678, +1 555 234 5678, 1-800-234-5678. Riktnummer och växel
  // börjar på 2–9; de fyra sista står efter en avskiljare, så att tio siffror
  // i ett svep (ett ordernummer) inte tas här.
  { typ: 'telefon', re: new RegExp(`(?<![\\p{N}+])(?:(?:\\+|00)?1[.${AVSKILJARE_U}]?)?(?:\\([2-9]\\d{2}\\)|[2-9]\\d{2})[.${AVSKILJARE_U}]?[2-9]\\d{2}[.${AVSKILJARE_U}]\\d{4}(?!\\p{N})`, 'gu'),
    giltig: v => !DATUMLIK.test(v.trim()) && /^1?\d{10}$/.test(v.replace(/\D/g, '').replace(/^00/, '')) },
  // Brittiska nummer (fas 3): +44 20 7946 0958, +44 (0)20 7946 0958,
  // 020 7946 0958, 07700 900123, 0044 7700 900123. Nationellt tio siffror
  // efter nollan, och första siffran 1, 2, 3, 5, 7, 8 eller 9.
  { typ: 'telefon', re: new RegExp(`(?<![\\p{N}+])(?:\\+44[${BLANK}]?(?:\\(0\\)[${BLANK}]?)?|0044[${BLANK}]?|0)[1235789](?:[.${AVSKILJARE_U}]?\\d){8,9}(?!\\p{N})`, 'gu'),
    giltig: v => brittisktTelefon(v) },
  { typ: 'iban', re: /\b[A-Z]{2}\d{2}[\sA-Z0-9]{10,30}\b/g, giltig: v => rent(v).length >= 15 },
  { typ: 'kontonummer', re: new RegExp(`\\b\\d{4}[${AVSKILJARE}]\\d{6,10}\\b`, 'g') },
  // Betalkort: 13–19 siffror i fyrgrupper, eller 15–16 i ett svep, och Luhn
  // (2026-10-09, granskningen: "4111 1111 1111 1111" gick ut). Luhn håller
  // ett vanligt löpnummer ute; ett felskrivet kort är sällan ett problem.
  { typ: 'kort', re: /(?<!\p{N})(?:\d{4}(?:[ -]\d{4}){2,3}(?:[ -]\d{1,3})?|[3-6]\d{14,15})(?!\p{N})/gu,
    giltig: v => { const s = v.replace(/\D/g, ''); return s.length >= 13 && s.length <= 19 && luhn(s); } },
  // Swedbank skriver clearing med kontrollsiffra och komma: "8327-9, 123 456
  // 789-0" (2026-10-09, granskningen).
  { typ: 'kontonummer', re: /(?<!\p{N})8\d{3}-\d,?\s?\d{1,3}(?:[ .]?\d{3}){1,3}(?:-\d)?(?!\p{N})/gu },
  // Kontonummer skrivs på lika många sätt som det finns banker:
  // "8214-9 447 221 350-1" gick rakt igenom i ett kommunalt underlag. När
  // ordet står bredvid räcker formen "siffror och avdelare" — utan ordet
  // vore samma mönster ett belopp, ett datum eller ett diarienummer.
  { typ: 'kontonummer',
    re: /(?<=\b(?:kontonummer|kontonr|bankkonto|personkonto|konto|bankgiro|plusgiro|clearingnummer|clearing)\b[\s:]{0,3})\d[\d\s,.-]{3,28}\d/gi },

  // Talade siffror. Whisper skriver "5592 34 11 07", inte "559234-1107".
  //
  // Sett skarpt 2026-09-24 i en transkribering: organisationsnumret gick
  // rakt igenom grinden eftersom mönstren väntade sig skriven form. Den som
  // läser upp ett nummer i telefon delar det i grupper, och en inspelning
  // är precis där sådana nummer sägs högt.
  //
  // De ligger efter telefonnumret så att ett uppläst telefonnummer får heta
  // telefonnummer. Formen avgör, som alltid: tio eller tolv siffror i
  // grupper, och sedan samma prövning som för skriven form.
  { typ: 'personnummer', re: /\b\d{2,4}(?: \d{2,4}){2,5}\b/g,
    giltig: v => { const s = rent(v); return (s.length === 10 || s.length === 12) && arFodelsedag(s.slice(-10)); } },
  { typ: 'organisationsnummer', re: /\b\d{2,4}(?: \d{2,4}){2,5}\b/g,
    giltig: v => { const s = rent(v); return s.length === 10 && Number(s[2]) >= 2; } },
  // Siffror med ett mellanslag eller en punkt mellan varje (2026-10-09,
  // granskningen): "9 0 0 1 0 1 1 2 3 4" och "900101-12 34". Efter
  // telefonnumret, så att ett uppläst telefonnummer får heta telefonnummer.
  { typ: 'personnummer', re: new RegExp(`(?<!\\p{N})\\d(?:[._${AVSKILJARE_U}]?\\d){9,11}(?!\\p{N})`, 'gu'),
    giltig: v => { const s = rent(v); return (s.length === 10 || s.length === 12) && arFodelsedag(s.slice(-10)) && !DATUMLIK.test(v); } },
  { typ: 'diarienummer', re: new RegExp(`\\b[A-ZÅÄÖ]{1,4}[${AVSKILJARE}]?\\d{4}[/:${STRECK}]\\d{1,6}\\b`, 'g') },
  // Versal och gemen som namnvakten räknar dem (2026-10-09, granskningen):
  // [A-ZÅÄÖ][a-zåäö]+ efter \b släppte Linnégatan, Östermalmsgatan och
  // Ängsvägen — \b är ASCII och ser ingen gräns före Ö.
  { typ: 'adress', re: /(?<![\p{L}\p{N}_])\p{Lu}\p{Ll}+(?:gatan|vägen|gränd|torget|plan|allén)\s+\d+(?:\p{L}(?!\p{L}))?(?!\p{N})/gu },
  // Postnummer räknas bara som adress när orten står efter. Fem siffror i
  // sig är ett belopp lika ofta som ett postnummer.
  { typ: 'adress', re: /\b\d{3}\s?\d{2}\s+\p{Lu}[\p{L}-]+\b/gu },
  // Engelska adresser (fas 3). Gatan med husnumret före: "1600 Pennsylvania
  // Avenue", "221B Baker Street", "10 Downing St". Brittiskt postnummer i
  // sin fasta form ("SW1A 1AA", "M1 1AE"), amerikanskt ZIP+4 ("94105-1234")
  // och ZIP efter en delstat ("CA 94105"). Fem siffror i sig är inget
  // postnummer — det är ett belopp lika ofta.
  { typ: 'adress', re: /(?<![\p{L}\p{N}])\d{1,5}[A-Z]?\s+(?:[NSEW]\.?\s+)?(?:\p{Lu}[\p{L}'’-]*\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Way|Terrace|Parkway|Pkwy|Highway|Hwy|Square|Sq|Close|Crescent|Gardens|Row|Mews|Circle|Cir)\b\.?(?:,?\s+(?:Apt|Apartment|Suite|Ste|Unit|Flat)\.?\s*#?[\w-]{1,6}|\s+#[\w-]{1,6})?/gu },
  { typ: 'postnummer', re: /(?<![\p{L}\p{N}])(?:[A-Z]{1,2}\d[A-Z\d]?|GIR) ?\d[ABD-HJLNP-UW-Z]{2}(?![\p{L}\p{N}])/gu },
  { typ: 'postnummer', re: /(?<![\p{N}-])\d{5}-\d{4}(?![\p{N}-])/g },
  { typ: 'postnummer', re: /(?<=\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY),?\s)\d{5}(?:-\d{4})?(?!\p{N})/gu },
  { typ: 'url', re: /\bhttps?:\/\/[^\s<>"]+/g },

  // ── Sorter som bara gäller när de valts ──────────────────────────────────
  //
  // De ligger sist med avsikt: ett personnummer ska tas innan ett belopp
  // hinner tolka dess siffror.

  // Nycklar först av dessa. En API-nyckel innehåller ofta siffergrupper som
  // ett beloppsmönster annars skulle hugga i.
  { typ: 'nyckel', re: /\b(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|(?:[A-Za-z0-9+/]{32,}={0,2}))\b/g,
    giltig: v => v.length >= 24 && /\d/.test(v) && /[A-Za-z]/.test(v) },
  { typ: 'ip', re: /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?\b|\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/gi,
    giltig: v => !/^\d+\.\d+\.\d+$/.test(v) && v.split('.').every(d => Number(d.split(':')[0]) <= 255 || d.includes(':')) },
  { typ: 'sokvag', re: /(?<![\w/])(?:\/(?:Users|home|var|etc|opt|srv|mnt|data)\/[\w./-]+|[A-Z]:\\[\w\\.-]+|\\\\[\w.-]+\\[\w\\.-]+)/g },
  { typ: 'server', re: /\b(?:srv|vm|db|app|web|api|prod|test|stage|dc|fs|ad)[-_]?[a-z0-9]{1,12}(?:\.[a-z0-9-]+){1,3}\b/gi },
  { typ: 'belopp', re: /\b\d{1,3}(?:[ .]\d{3})+(?:[,.]\d{1,2})?\s*(?:kr|kronor|SEK|EUR|USD|€|\$)|\b\d+(?:[,.]\d{1,2})?\s*(?:kr|kronor|SEK|EUR|USD|€|\$)|(?:€|\$)\s?\d[\d ., ]*/gi },
  { typ: 'datum', re: /\b(?:(?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])|(?:0?[1-9]|[12]\d|3[01])[ /](?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)(?:\s+(?:19|20)\d{2})?|\b(?:19|20)\d{2})\b/gi },
];

/// Luhn, för kortnummer.
function luhn(s) {
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    let d = Number(s[s.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/// Ett datum eller en tid, inte ett nummer: "2026-10-09 14.30", "01.02.2024",
/// "08.15 09.30". Kalendrar skriver så hela tiden, och ett datum som blir
/// [TELEFON A] gör agentens schema obrukbart.
const DATUMLIK = /^(?:\d{4}[-./]\d{1,2}[-./]\d{1,2}(?:[ T]\d{1,2}[.:]\d{2}(?:[.:]\d{2})?)?|\d{1,2}[-./]\d{1,2}[-./]\d{2,4}(?:\s\d{1,2}[.:]\d{2})?|\d{1,2}[.:]\d{2}(?:\s+\d{1,2}[.:]\d{2})*)$/;

/// Brittiskt nummer: nationellt 10–11 siffror med nollan, efter +44 eller 0044.
function brittisktTelefon(v) {
  if (DATUMLIK.test(v.trim())) return false;
  let s = String(v).replace(/\D/g, '');
  if (s.startsWith('0044')) s = s.slice(4);
  else if (s.startsWith('440')) s = s.slice(3);
  else if (/^\s*\+/.test(v) && s.startsWith('44')) s = s.slice(2);
  else if (s.startsWith('0')) s = s.slice(1);
  else return false;
  return (s.length === 9 || s.length === 10) && /^[1235789]/.test(s);
}

/// Svenskt nummer efter landskoden: 8–10 siffror med nollan.
function telefonGiltig(v) {
  if (DATUMLIK.test(v.trim())) return false;
  let s = String(v).replace(/\D/g, '');
  if (s.startsWith('460')) s = s.slice(2);
  else if (s.startsWith('0046')) s = '0' + s.slice(4);
  else if (/^\s*\+/.test(v) && s.startsWith('46')) s = '0' + s.slice(2);
  return s.length >= 8 && s.length <= 10 && s[0] === '0' && s[1] !== '0';
}

const ETIKETT = {
  personnummer: 'PERSONNUMMER', organisationsnummer: 'ORGNR', epost: 'E-POST',
  telefon: 'TELEFON', iban: 'KONTO', kontonummer: 'KONTO', diarienummer: 'DIARIENR', identitetsnummer: 'IDNR',
  adress: 'ADRESS', url: 'LÄNK', namn: 'PERSON', ort: 'ORT', organisation: 'ORGANISATION',
  personkonto: 'KONTO', kort: 'KORT',
  belopp: 'BELOPP', datum: 'DATUM', ip: 'ADRESS', server: 'SERVER', sokvag: 'SÖKVÄG', nyckel: 'NYCKEL',
  // Engelska format (fas 3): de är identitetsnummer, telefonnummer och
  // adresser, och heter så också på svenska.
  ssn: 'PERSONNUMMER', ni: 'PERSONNUMMER', postnummer: 'ADRESS',
};

/// Platshållarnas etiketter på engelska (fas 3, 2026-10-09).
///
/// Platshållaren följer appens språk: en engelsk fråga till molnet läses
/// bättre med [NAME A] än med [NAMN A]. Svenskan är orörd. Återställningen
/// (avmaskera) tar båda formerna, så att en karta från före ett språkbyte —
/// eller en modell som "översätter" platshållaren — fortfarande hittar hem.
export const ETIKETT_EN = {
  PERSONNUMMER: 'ID NUMBER', ORGNR: 'ORG NUMBER', 'E-POST': 'EMAIL', TELEFON: 'PHONE',
  KONTO: 'ACCOUNT', DIARIENR: 'CASE NUMBER', IDNR: 'ID', ADRESS: 'ADDRESS', 'LÄNK': 'LINK',
  PERSON: 'PERSON', NAMN: 'NAME', ORT: 'PLACE', ORGANISATION: 'ORGANIZATION', KORT: 'CARD',
  BELOPP: 'AMOUNT', DATUM: 'DATE', SERVER: 'SERVER', 'SÖKVÄG': 'PATH', NYCKEL: 'KEY',
  ROLL: 'ROLE', UPPGIFT: 'DETAIL',
};
const ETIKETT_SV = Object.fromEntries(Object.entries(ETIKETT_EN).map(([sv, en]) => [en, sv]));

/// Etiketten på språket som gäller. `svensk` är den svenska etiketten.
export const etikett = (svensk, kod = aktuellt()) => (kod === 'sv' ? svensk : ETIKETT_EN[svensk] || svensk);

/// En platshållares etikett tillbaka till svenska, för jämförelsen i
/// avmaskera: "[NAME A]" och "[NAMN A]" är samma sak.
const tillSvensk = p => p.replace(/^\[([^\]]*?)\s+([A-Z]+)\](:?s)?$/, (hela, e, b, g) => `[${ETIKETT_SV[e.trim().toUpperCase()] || e} ${b}]${g || ''}`);

/// Vilken sort i inställningarna styr vilket mönster.
///
/// Flera mönster hör till samma val: den som stänger av "Orter och platser"
/// menar både ortnamn och gatuadresser, och den som slår på "IP och nätverk"
/// menar inte att sökvägar också ska bort.
export const MONSTERSORT = {
  personnummer: 'personnummer', organisationsnummer: 'organisationsnummer',
  identitetsnummer: 'organisationsnummer', epost: 'epost', telefon: 'telefon',
  personkonto: 'personnummer', kort: 'kontonummer', ssn: 'personnummer', ni: 'personnummer', postnummer: 'ort',
  iban: 'kontonummer', kontonummer: 'kontonummer', diarienummer: 'diarienummer',
  adress: 'ort', url: 'url', belopp: 'belopp', datum: 'datum',
  ip: 'ip', server: 'server', sokvag: 'sokvag', nyckel: 'nyckel',
};

/// Maskerar det som har format.
///
/// Returnerar den maskerade texten och kartan. Kartan är det enda som är
/// hemligt — den lämnar aldrig datorn.
/// Mönster utöver de inbyggda, ur ett signerat regelpaket.
///
/// Sätts av servern vid start och när ett nytt paket hämtats. Aldrig av något
/// annat: ett osignerat tillägg vore en väg in för den som vill stänga av
/// maskeringen, inte en uppdatering.
let EXTRA = [];
export const satExtraMonster = m => { EXTRA = Array.isArray(m) ? m : []; };
export const extraMonster = () => EXTRA.length;

export function maskera(text, { karta = new Map(), raknare = new Map(), sorter } = {}) {
  // Utan besked gäller standardpaketet, inte varenda mönster. Belopp, datum
  // och sökvägar är val man gör, inte något som slinker på av sig självt.
  sorter ||= galler({});
  // Helbredda tecken och siffror ur andra skrivsätt blir vanliga först.
  // Texten som går ut bär då de vanliga tecknen; det är samma nummer.
  let ut = siffrorTillAscii(String(text || ''));
  const funna = [];

  // Mönster från ett signerat regelpaket läggs sist: det inbyggda har alltid
  // körts först, och ett tillägg ska aldrig kunna ta över ett mönster som
  // redan fungerar. Se lib/regelpaket.mjs.
  for (const m of [...MONSTER, ...EXTRA]) {
    if (!sorter.has(MONSTERSORT[m.typ] || m.typ)) continue;
    ut = ut.replace(new RegExp(m.re.source, m.re.flags), traff => {
      if (m.giltig && !m.giltig(traff)) return traff;
      // Samma värde ska alltid få samma etikett, annars går sammanhanget
      // förlorat: "Erik ringde Erik" måste bli "Person A ringde Person A".
      if (karta.has(traff)) return karta.get(traff);
      const e = etikett(ETIKETT[m.typ] || m.typ.toUpperCase());
      const n = (raknare.get(e) || 0) + 1;
      raknare.set(e, n);
      const platshallare = `[${e} ${bokstav(n)}]`;
      karta.set(traff, platshallare);
      funna.push({ typ: m.typ, original: traff, platshallare });
      return platshallare;
    });
  }
  return { text: ut, karta, raknare, funna };
}

/// A, B, C … Z, AA, AB. Bokstäver läses som personer; siffror läses som
/// mängder, och "Person 17" får en text att låta som ett register.
function bokstav(n) {
  let s = '';
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

/// Svensk genitiv på ett namn som just kommit tillbaka.
///
/// Hakparentesen kan inte böjas, så frontier skriver "[NAMN D]:s introduktion"
/// — kolonet är konventionen för förkortningar. Sätter man bara tillbaka
/// namnet står det "Karl Fredrik Brandt:s introduktion", vilket ingen svensk
/// har skrivit någonsin. Namn på s, x eller z får ingen ändelse alls.
const genitiv = namn => /[sxzSXZ]$/.test(namn) ? namn : `${namn}s`;

/// Platshållaren utan mellanrum och skiljetecken, bara versalerna kvar.
///
/// Frontier skriver inte alltid tillbaka platshållaren som den fick den. I
/// ett skarpt prov kom "[NAMN G]" tillbaka som "[NAM T G]", och en exakt
/// jämförelse hittade ingenting — svaret visade en hakparentes där ett namn
/// skulle stått, mitt i en mening som annars var riktig.
///
/// Nyckeln är alltså bokstäverna och siffrorna i ordning. "NAM T G" och
/// "NAMN G" ger båda NAMNG, och då hittar den hem.
const nyckel = p => p.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();

/// Det som faktiskt skiljer två platshållare åt.
///
/// En platshållare är [ETIKETT BOKSTAV], och bokstaven sist är hela
/// skillnaden mellan två personer. Etikettens första tecken skiljer sorterna:
/// [NAMN G] och [ORT G] blir NG och OG.
///
/// Att jämföra så här är avsiktligt grovt, men bara där det är ofarligt. "NAM
/// T G" hade förlorat ett N och vunnit ett T, och ingen exakt jämförelse i
/// världen hade hittat hem. Sorten och bokstaven satt kvar.
function kort(p) {
  const bitar = p.replace(/[[\]]/g, '').trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!bitar.length) return null;
  return bitar[0][0] + bitar.at(-1);
}

/// Vänder tillbaka. Längsta platshållaren först, så att [PERSON A] inte
/// träffar inuti [PERSON AB].
export function avmaskera(text, karta) {
  let ut = String(text || '');
  const par = [...karta.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [original, platshallare] of par) {
    // Genitiven först, annars står kolonet kvar när namnet redan är insatt.
    ut = ut.split(`${platshallare}:s`).join(genitiv(original));
    ut = ut.split(`${platshallare}s`).join(genitiv(original));
    ut = ut.split(platshallare).join(original);
  }

  // Andra varvet: det som ser ut som en platshållare men inte stavats rätt.
  //
  // Bara exakta nyckelträffar byts. En hakparentes vi inte känner igen får
  // stå kvar — den ska synas som det fel den är, inte gissas bort.
  const efterNyckel = new Map(), efterKort = new Map();
  for (const [original, platshallare0] of karta) {
    const platshallare = tillSvensk(platshallare0);
    // Två poster som blir samma nyckel — [NAMN A] från före ett språkbyte
    // och [NAME A] efter — går inte att skilja åt i den ungefärliga
    // jämförelsen, och då gissas ingenting (granskningen 2026-10-09). Den
    // exakta formen ovan har redan återställt var och en till sin egen.
    const nk = nyckel(platshallare);
    efterNyckel.set(nk, efterNyckel.has(nk) && efterNyckel.get(nk) !== original ? null : original);
    const k = kort(platshallare);
    // Två som krymper till samma sak går inte att skilja åt, och då gissar vi
    // inte. En hakparentes som står kvar är ett synligt fel; ett namn på fel
    // person är ett osynligt.
    if (k) efterKort.set(k, efterKort.has(k) && efterKort.get(k) !== original ? null : original);
  }
  ut = ut.replace(/\[[^\]\n]{1,40}\](:?s)?/g, (hela, bojning) => {
    const rent = tillSvensk(hela.replace(/(:?s)$/, ''));
    const original = efterNyckel.get(nyckel(rent)) || efterKort.get(kort(rent));
    if (!original) return hela;
    return bojning ? genitiv(original) : original;
  });
  return ut;
}

/// Maskerar om med en känd karta. Ingen nyupptäckt, bara utbyte.
///
/// Behövs för historiken. Svaret från förra turen ligger sparat i klartext —
/// det är användarens svar och hen ska kunna läsa det — men när det skickas
/// med som sammanhang måste namnen ut igen. Samma karta, samma platshållare,
/// så att frontier ser en sammanhängande historia där [NAMN A] är [NAMN A]
/// hela vägen.
export function ommaskera(text, karta) {
  let ut = String(text || '');
  // Längsta originalet först: "Erik Svensson" ska bli en platshållare, inte
  // "[NAMN A] Svensson".
  for (const [original, platshallare] of [...karta.entries()].sort((a, b) => b[0].length - a[0].length)) {
    ut = ut.split(original).join(platshallare);
  }
  return ut;
}

/// Siffror ur andra skriftsystem till 0–9, och helbredda tecken till vanliga
/// (2026-10-09, granskningen): "１９９００１０１－１２３４" ur en PDF,
/// arabisk-indiska siffror, matematiska siffror (𝟏𝟗𝟗𝟎…) och en helbredd
/// adress som "ｅｒｉｋ＠ｋｏｍｍｕｎ．ｓｅ" gick rakt igenom, eftersom `\d`
/// och `\w` bara känner ASCII.
///
/// `fran[i]` är var tecken i i utdata stod i originalet. Ett tecken utanför
/// BMP är två kodenheter in och en ut, och efterkontrollen måste kunna peka
/// på rätt ställe i originalet för att maskera det där det står.
function normalisera(text) {
  const t = String(text ?? '');
  let ut = '';
  const fran = [];
  for (let i = 0; i < t.length;) {
    const k = t.codePointAt(i);
    const bredd = k > 0xFFFF ? 2 : 1;
    let c = String.fromCodePoint(k);
    if (k >= 0xFF01 && k <= 0xFF5E) c = String.fromCharCode(k - 0xFEE0);
    else if (k === 0x3000) c = ' ';
    else if (k >= 0x80 && /\p{Nd}/u.test(c)) {
      // Siffrorna ligger i följder om tio; nollan är där följden börjar.
      let noll = k;
      while (k - noll < 100 && /\p{Nd}/u.test(String.fromCodePoint(noll - 1))) noll--;
      c = String((k - noll) % 10);
    }
    for (let j = 0; j < c.length; j++) fran.push(i);
    ut += c;
    i += bredd;
  }
  fran.push(t.length);
  return { text: ut, fran };
}
export const siffrorTillAscii = text => normalisera(text).text;

/// Den oberoende efterkontrollen (2026-10-09, granskningen).
///
/// `granska()` prövade texten med samma mönster som `maskera()`, så det som
/// maskeringen missade missade granskningen också, och "fail closed" sa noll
/// kvar för precis de nummer som läckte. Här är metoden en annan: siffrorna
/// normaliseras, varje sifferkörning läses ihop över enstaka avskiljare
/// (punkt, mellanslag, streck, understreck, parentes), och körningen prövas
/// på vad den ÄR (antal siffror, födelsedag, riktnummer, Luhn) i stället
/// för hur den är skriven. E-post prövas på @ och dess omskrivningar.
///
/// Positionerna gäller originaltexten, genom skuggans indextabell, så att
/// det som hittas går att maskera där det står.
export function hittaKvar(text) {
  const norm = normalisera(text);
  const skugga = norm.text;
  // Tillbaka till originalets positioner: början på första tecknet, slutet
  // efter sista (som kan vara två kodenheter).
  const ursprung = (i, n) => {
    const start = norm.fran[i], sista = norm.fran[i + n - 1];
    const slut = sista + (String(text).codePointAt(sista) > 0xFFFF ? 2 : 1);
    return { start, slut, varde: String(text).slice(start, slut) };
  };
  const fynd = [];
  // En ensam bokstav före räddar inte numret ("x19850813-2399"), men ett
  // längre ord gör det: siffror inuti ett id eller en hash är inget nummer.
  const kropp = /(?<!\p{N})(?<![\p{L}\p{N}]\p{L})(?:\+\s?)?\d(?:(?:\s?\(0\)\s?|[ ._()\u00A0\u2007\u202F\u2010-\u2015\u2212\uFE63\uFF0D+-])?\d)*(?!\p{N})/gu;
  for (const m of skugga.matchAll(kropp)) {
    const v = m[0], s = v.replace(/\D/g, '');
    if (s.length < 7 || DATUMLIK.test(v.replace(/^\+\s?/, ''))) continue;
    let typ = null;
    // Grupperna ska vara hela tal, inte en tidtabell eller ett belopp med
    // tusentalsavskiljare som råkar bli tio siffror.
    if ((s.length === 10 || s.length === 12) && arFodelsedag(s.slice(-10)) && !(s.length === 12 && !/^(?:19|20)/.test(s))) typ = 'personnummer';
    else if ((s.length === 14 || s.length === 16) && s.startsWith('3300') && arFodelsedag(s.slice(-10))) typ = 'personkonto';
    else if (telefonGiltig(v)) typ = 'telefon';
    // Engelska former (fas 3): SSN i grupperna 3-2-4, nordamerikanskt nummer
    // med landskod eller i grupperna 3-3-4, brittiskt efter +44/0044.
    else if (s.length === 9 && /^\d{3}[ .\-\u2010-\u2015\u2212]\d{2}[ .\-\u2010-\u2015\u2212]\d{4}$/.test(v) && !/^(?:000|666|9)/.test(s) && !/^\d{3}00/.test(s) && !s.endsWith('0000')) typ = 'ssn';
    else if (/^\+\s?1|^001|^1[ .\-]/.test(v) ? /^1[2-9]\d{2}[2-9]\d{6}$/.test(s.replace(/^00/, '')) : (s.length === 10 && /^\(?[2-9]\d{2}\)?[ .\-]?[2-9]\d{2}[ .\-]\d{4}$/.test(v))) typ = 'telefon';
    else if (/^(?:\+\s?44|0044)/.test(v) && brittisktTelefon(v)) typ = 'telefon';
    else if (s.length >= 13 && s.length <= 19 && luhn(s) && (/^\d{4}(?:[ -]\d{4}){2,}/.test(v) || /^[3-6]\d{14,15}$/.test(v))) typ = 'kort';
    if (typ) fynd.push({ typ, ...ursprung(m.index, v.length) });
  }
  const post = /(?<![\w\u00C0-\u024F.+-])[\w\u00C0-\u024F.+-]+(?:\s*(?:\[at\]|\(at\)|\{at\}|\[snabel-a\])\s*|[@\uFF20])[\w-]+(?:(?:\.|\s*(?:\[dot\]|\(dot\)|\[punkt\])\s*)[\w-]+)*/giu;
  for (const m of skugga.matchAll(post)) {
    fynd.push({ typ: 'epost', ...ursprung(m.index, m[0].length) });
  }
  return fynd.sort((a, b) => a.start - b.start);
}

/// Maskerar det efterkontrollen hittar, med samma karta och samma sorts
/// platshållare som `maskera()`. Det är grindens sista steg: står något
/// identitetslikt kvar efter reglerna stängs det, i stället för att gå ut.
export function maskeraKvar(text, { karta = new Map(), raknare = new Map(), sorter } = {}) {
  sorter ||= galler({});
  let ut = String(text ?? '');
  const funna = [];
  // Bakifrån, så att positionerna framför står still.
  for (const f of hittaKvar(ut).reverse()) {
    if (!sorter.has(MONSTERSORT[f.typ] || f.typ)) continue;
    if (/^\[[^\]]*\]$/.test(f.varde)) continue;
    let p = karta.get(f.varde);
    if (!p) {
      const e = etikett(ETIKETT[f.typ] || f.typ.toUpperCase());
      const n = (raknare.get(e) || 0) + 1;
      raknare.set(e, n);
      p = `[${e} ${bokstav(n)}]`;
      karta.set(f.varde, p);
      funna.push({ typ: f.typ, original: f.varde, platshallare: p });
    }
    ut = ut.slice(0, f.start) + p + ut.slice(f.slut);
  }
  return { text: ut, karta, raknare, funna };
}

/// Sista kontrollen före sändning. Hittar den något här har grinden brustit,
/// och då skickas ingenting.
///
/// Den här funktionen litar inte på maskera(). Den prövar texten som om den
/// aldrig sett den, med samma mönster, och rapporterar allt som återstår.
export function granska(text, sorter) {
  sorter ||= galler({});
  const kvar = [];
  for (const m of MONSTER) {
    // Granskningen prövar bara det som pekar ut någon. Ett belopp eller ett
    // årtal som står kvar är ett val, inte ett läckage.
    if (!['personnummer', 'personkonto', 'organisationsnummer', 'identitetsnummer', 'epost', 'telefon', 'iban', 'kontonummer', 'kort', 'nyckel', 'ssn', 'ni'].includes(m.typ)) continue;
    if (!sorter.has(MONSTERSORT[m.typ] || m.typ)) continue;
    for (const t of String(text || '').match(new RegExp(m.re.source, m.re.flags)) || []) {
      if (m.giltig && !m.giltig(t)) continue;
      // Ett nummer är ett fynd, även när två mönster ser det.
      if (kvar.some(k => k.varde.includes(t) || t.includes(k.varde))) continue;
      kvar.push({ typ: m.typ, varde: t });
    }
  }
  // Och den oberoende kontrollen ovanpå: den som inte delar mönstren med
  // maskeringen och därför ser det maskeringen missar (2026-10-09,
  // granskningen).
  for (const f of hittaKvar(text)) {
    if (!sorter.has(MONSTERSORT[f.typ] || f.typ)) continue;
    if (!kvar.some(k => k.varde.includes(f.varde) || f.varde.includes(k.varde))) kvar.push({ typ: f.typ, varde: f.varde });
  }
  return kvar;
}
