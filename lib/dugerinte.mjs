import { granska } from './maskering.mjs';
import { tx, aktuellt } from './sprakstod.mjs';
/// Vad som inte duger som källa.
///
/// Doktrinen står redan i lib/failclosed.mjs, om maskeringen: hellre en
/// onödig maskering än en missad, för en onödig kostar precision och en
/// missad kostar löftet. Samma sak här, en våning upp.
///
/// ── Vad som hände utan den ────────────────────────────────────────────────
///
/// Frågan var "hur lång tid har vi på oss att överklaga ett föreläggande?".
/// lagen.nu:s sökning matchade på ordet "tid" och gav fem utredningar:
/// Kulturmiljöarbete i en ny tid, Tullverkets rättsliga befogenheter i en ny
/// tid, en proposition från 1930 om beräkning av lagstadgad tid. Noll
/// paragrafer.
///
/// Den listan blev källa [1] med märkningen MYNDIGHET — högsta
/// trovärdighetsnivån i appen. Modellen gjorde rätt och sa att svaret inte
/// fanns i underlaget, men satte ändå [1] på det och skrev "klicka på länken
/// i källan".
///
/// Modellen ljög inte. MAXIMUS gav den skräp och stämplade det.
///
/// ── Varför det ska vägra, inte varna ──────────────────────────────────────
///
/// En varning måste läsas. En källa som kastas kan inte citeras. Skillnaden
/// syns först när någon har bråttom, och det är då det spelar roll.

/// En träfflista: rader som är titel, beteckning och länk, om och om igen.
///
/// Räknas på andelen rader som är en adress eller ser ut som en beteckning.
/// Ett dokument med några länkar i sig är inte en lista; en lista är nästan
/// bara länkar.
const ADRESS = /^\s*https?:\/\/\S+\s*$/;
const BETECKNING = /^\s*(SOU|Prop\.|Ds|Dir\.|Bet\.|SFS|NJA|RÅ|HFD|MÖD|AD)\s*\d{4}/i;

/// Tecken på att texten faktiskt BÄR något: en paragraf, ett stycke,
/// en mening som fortsätter.
const BARANDE = [
  /\d+\s*§/,                       // en paragraf
  /\d+\s*kap\./i,                  // ett kapitel
  /[.!?]\s+[A-ZÅÄÖ]/,              // två meningar efter varandra
];

export function ärLista(text) {
  const rader = String(text || '').split('\n').map(r => r.trim()).filter(Boolean);
  if (rader.length < 3) return false;
  const lank = rader.filter(r => ADRESS.test(r) || BETECKNING.test(r)).length;
  return lank / rader.length >= 0.4;
}

/// Duger det här som underlag för ett svar?
///
/// `null` när det duger, annars skälet — som är det modellen ska få höra i
/// stället. "lagen.nu hittade inget som svarar på frågan" är ett ärligt svar.
/// En länklista är det inte.
export function duger(text, { minsta = 200 } = {}) {
  const t = String(text || '').trim();
  if (!t) return tx('pars.dugerinte.tom');
  if (t.length < minsta) return tx('pars.dugerinte.forLite');
  if (ärLista(t)) return tx('pars.dugerinte.lista');

  // En text utan ett enda tecken på brödtext eller lagrum är rubriker.
  const brod = t.replace(/^\s*https?:\/\/\S+\s*$/gm, '');
  if (!BARANDE.some(r => r.test(brod))) return tx('pars.dugerinte.rubriker');
  return null;
}

/// Tal i ett svar som ingen räknat ut.
///
/// MAXIMUS räknar kolumnsummor, snitt, median, minsta och största i kod, och de
/// följer med frågan. Allt annat — "snittet per godkänd post", "summan för de
/// tre som saknar datum" — adderar modellen i huvudet.
///
/// Sett skarpt: totalsumman 1 366 050,75 stämde på öret (uträknad i kod).
/// Snittet per godkänd post blev 185 137,58 där det rätta är 129 130,15, och
/// det stod i fetstil utan gardering.
///
/// Den här hittar tal i svaret som INTE står i underlaget. Ett tal som inte
/// finns någonstans i det modellen fick är ett tal den hittat på.
/// Ett tal, men inte ett SFS-nummer och inte ett årtal.
///
/// Provet larmade om "1160" i "1977:1160" — andra halvan av ett SFS-nummer
/// ser ut som ett fyrsiffrigt belopp. Kolon före eller efter betyder att det
/// är en beteckning, inte ett belopp.
const TAL = /(?<![\w.,:])(?<!\d{4}:)(\d{1,3}(?:[\s ]\d{3})+|\d{4,})(?:[,.]\d+)?(?![\w:])/g;

/// Engelska tal (fas 3): "1,366,050.75" — kommatecken mellan tusentalen,
/// punkt före decimalerna. Läses när det inte kan vara svenska: två
/// tusentalsgrupper eller decimaler efter punkt. "12,500" ensamt är ett
/// svenskt decimaltal och lämnas åt svenskan, utom på engelska.
const TAL_EN = /(?<![\w.,:])(\d{1,3}(?:,\d{3}){2,}(?:\.\d+)?|\d{1,3},\d{3}\.\d+)(?![\w:,]|\.\d)/g;
const TAL_EN_ETT = /(?<![\w.,:])(\d{1,3},\d{3})(?![\w:,.])/g;
const talen = text => {
  const t = String(text || '');
  const en = [...t.matchAll(TAL_EN), ...(aktuellt() === 'en' ? [...t.matchAll(TAL_EN_ETT)] : [])];
  const sv = [...t.matchAll(TAL)].filter(m => !en.some(e => m.index >= e.index && m.index < e.index + e[0].length));
  return [...en.map(m => ({ text: m[0], tal: m[0].replace(/,/g, '') })), ...sv.map(m => ({ text: m[0], tal: normalisera(m[0]) }))];
};

const normalisera = t => String(t).replace(/[\s ]/g, '').replace(',', '.');

/// Siffror som pekar ut någon är inga belopp.
///
/// Sett skarpt 2026-09-29: rutan sa "2 tal står i svaret men inte i
/// underlaget: 19880614, 3372. Räkna om innan du använder dem." Det första
/// är ett födelsedatum i personnummerform — det är ingen summa någon räknat
/// fel på, det är en identifierare.
///
/// Två fel i ett. Kontrollen bad användaren räkna om ett personnummer, vilket
/// är obegripligt. Och den SKREV UT det, i klartext, i en ruta som ligger
/// kvar i svaret — i en produkt vars hela uppgift är att sådana siffror inte
/// ska stå framme.
///
/// Identifierarna känns igen med samma mönster som maskeringen använder, inte
/// med en egen lista. Två listor över vad ett personnummer är hinner bli två
/// olika listor.
function arIdentifierare(text) {
  const kvar = granska(String(text || ''));
  if (!kvar.length) return () => false;
  // Siffrorna ur varje träff, utan avskiljare — så att "19850812-2382"
  // fångar både "19880614" och "3372".
  const siffror = new Set();
  for (const k of kvar) {
    const varde = String(k.varde ?? '');
    const rent = varde.replace(/\D/g, '');
    if (rent.length >= 4) siffror.add(rent);
    // Och varje siffergrupp för sig: "19850812-2382" står i svaret som två
    // tal, och båda ska räknas som delar av samma identifierare.
    for (const bit of varde.split(/\D+/)) if (bit.length >= 4) siffror.add(bit);
  }
  return tal => siffror.has(String(tal).replace(/\D/g, ''));
}

export function opåkomnaTal(svar, underlag, { minsta = 1000 } = {}) {
  const fanns = new Set();
  for (const m of talen(underlag)) fanns.add(String(Number(m.tal)));
  // Vad i SVARET som är en identifierare och inte ett belopp.
  const identifierare = arIdentifierare(svar);
  const ut = [];
  for (const { text: hel, tal } of talen(svar)) {
    const m = [hel];
    const n = Number(tal);
    // Ett personnummer, ett organisationsnummer, ett telefonnummer eller ett
    // kontonummer är ingen uträkning. Be aldrig någon räkna om det, och
    // skriv det framför allt aldrig i en ruta på skärmen.
    if (identifierare(m[0])) continue;
    // Små tal är paragrafer och antal. Det är de stora som ser ut som belopp
    // och som någon fattar beslut på.
    if (!Number.isFinite(n) || n < minsta) continue;
    // Ett blankt fyrsiffrigt tal mellan 1900 och 2100 är ett årtal, inte ett
    // belopp. Utan det larmade provet om "2026" i "enligt 7 § från 2026".
    if (/^\d{4}$/.test(m[0]) && n >= 1900 && n <= 2100) continue;
    if (!fanns.has(String(n))) ut.push(m[0]);
  }
  return [...new Set(ut)];
}
