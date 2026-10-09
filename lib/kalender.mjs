/// Apple Kalender, läst och aldrig skriven.
///
/// Samma tre regler som lib/post.mjs, och de är inte förhandlingsbara:
///
///   1. LÄSER. Aldrig skapar en händelse, aldrig flyttar en, aldrig raderar,
///      aldrig svarar på en inbjudan. EventKit kan allt det; MAXIMUS anropar
///      ingenting av det, och ett test ser efter att verben inte finns.
///   2. Ingenting lämnar datorn vid hämtning. Dagens möten läses lokalt och
///      stannar lokalt. En händelse går vidare först när någon valt den, och
///      då genom samma grind som allt annat.
///   3. Bara fönstret som efterfrågas. En kalender med tio års historik ska
///      inte läsas in för att någon öppnade en vy.
///
/// ── Varför kalendern hör hemma i MAXIMUS ─────────────────────────────────────
///
/// För att en kalender säger vad ett ärende HANDLAR om. "Möte med [NAMN A]
/// och facket, torsdag 14.00" är sammanhanget till frågan som ställs på
/// onsdagen, och det sammanhanget har användaren redan skrivit ner en gång.
/// Att be henne skriva det igen är att be om samma arbete två gånger.
///
/// ── Varför EventKit och inte AppleScript ──────────────────────────────────
///
/// Därför att AppleScript klarar det på papperet och inte i praktiken. Mätt
/// 2026-09-28 på elva kalendrar: sexton sekunder för en vecka som innehöll
/// noll händelser, trettio för ±60 dagar. Kostnaden ligger i att varje
/// `every event of c whose ...` tvingar Kalender att gå igenom hela
/// kalendern, och de prenumererade — helgdagar, födelsedagar, Siri-förslag —
/// är stora. Pluralformen som brukar göra AppleScript snabb svarade dessutom
/// -1728 på flera av dem.
///
/// EventKit är samma uppgift mot ett index i stället för mot en app.
///
/// ── Varför inte CalDAV ────────────────────────────────────────────────────
///
/// Samma skäl som för Mail: kontot är redan inloggat. Ett CalDAV-bygge hade
/// krävt lösenord eller OAuth — en hemlighet till på datorn och en inloggning
/// till att förvalta. MAXIMUS ber inte om nycklar.
///
/// Det gäller också Google-kalendrar och Exchange: har användaren lagt till
/// dem i Kalender syns de här, utan att MAXIMUS någonsin rört en OAuth-dialog.
/// Det är hela poängen med att gå via appen som redan har förtroendet.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { AR_MAC, hitta } from './plattform.mjs';
import { tx } from './sprakstod.mjs';

const kor = promisify(execFile);
const HJALPEN = join(new URL('../verktyg/', import.meta.url).pathname, 'kalender.swift');

export const finns = () => AR_MAC;

/// Frågar hjälpen.
///
/// Svaret är JSON på en rad. Ett fel kommer också som JSON — med `tillstand`
/// satt när macOS sagt nej — för att den som väntar ska få veta skillnaden
/// mellan "du har inte gett tillstånd" och "något gick sönder". Det första
/// går att rätta; det andra går att rapportera.
async function fraga(argument, { timeout = 60000 } = {}) {
  if (!AR_MAC) return [];
  let ut;
  try {
    // Det kompilerade programmet först (Fas 22): /usr/bin/swift finns bara
    // med Xcodes verktyg, och en ren Mac har dem inte. Skriptet är reserven
    // när Maximus körs ur repot.
    const bin = await hitta('maximus-kalender');
    const r = bin
      ? await kor(bin, argument, { timeout, maxBuffer: 32e6 })
      : await kor('/usr/bin/swift', [HJALPEN, ...argument], { timeout, maxBuffer: 32e6 });
    ut = r.stdout;
  } catch (e) {
    // Hjälpen svarar med JSON också när den avslutar med felkod.
    ut = e.stdout || '';
    if (!ut.trim()) {
      if (/ETIMEDOUT|timed out/i.test(String(e.message))) {
        throw new Error(tx('lib.kalender.svaradeInte'));
      }
      throw new Error(tx('lib.kalender.kundeInte'));
    }
  }
  let d;
  try { d = JSON.parse(ut.trim().split('\n').at(-1)); }
  catch { throw new Error(tx('lib.kalender.olasbart')); }
  if (d && !Array.isArray(d) && d.fel) {
    throw Object.assign(new Error(d.fel), { tillstand: Boolean(d.tillstand) });
  }
  return Array.isArray(d) ? d : [];
}

/// Kalendrarna som finns.
export function kalendrar() {
  return fraga(['kalendrar'], { timeout: 45000 });
}

/// Händelser i ett tidsfönster.
///
/// `fran` och `till` är Date. Fönstret är ett krav och inte en bekvämlighet:
/// EventKit vill ha ett spann, och utan det blir varje kalenderläsning
/// långsam oavsett väg in.
export async function handelser({ fran, till, kalender = null } = {}) {
  const a = fran instanceof Date ? fran : new Date(fran);
  const b = till instanceof Date ? till : new Date(till);
  if (Number.isNaN(+a) || Number.isNaN(+b)) throw new Error(tx('lib.kalender.tidsfonster'));
  const lista = await fraga(['handelser', a.toISOString(), b.toISOString()]);
  return (kalender ? lista.filter(h => h.kalender === kalender) : lista)
    .map(h => ({ ...h, text: stada(h.text) }));
}

/// Dagens händelser.
export function idag(nu = new Date()) {
  const fran = new Date(nu); fran.setHours(0, 0, 0, 0);
  const till = new Date(nu); till.setHours(23, 59, 59, 0);
  return { fran, till };
}

/// Den närmaste veckan: sju dygn inklusive idag.
///
/// Stod +7 dagar och slutade 23.59, vilket är åtta dygn. En vecka som är åtta
/// dagar lång är inte fel med mycket, men den är fel — och den som ser ett
/// möte dyka upp under "den här veckan" ska kunna räkna till sju.
export function veckan(nu = new Date()) {
  const fran = new Date(nu); fran.setHours(0, 0, 0, 0);
  const till = new Date(fran); till.setDate(till.getDate() + 6); till.setHours(23, 59, 59, 0);
  return { fran, till };
}

/// Städar en beskrivning.
///
/// Möteslänkar och inbjudningsfotnoter är halva texten i ett kalenderkort och
/// säger ingenting om vad mötet gäller. Osynlig utfyllnad bort av samma skäl
/// som i lib/post.mjs: den fyller förhandsvisningen utan att synas.
export function stada(t) {
  return String(t || '')
    .replace(/[\u034f\u200b-\u200f\u2028\u2029\ufeff]/g, '')
    .replace(/^-::~:~::~:~[\s\S]*$/m, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/// En händelse som underlag till en fråga.
///
/// Formen är text och inte JSON: det är en människa som ska läsa den i
/// grinden innan den går vidare, och en människa läser inte klammerparenteser.
export function somText(h) {
  const nar = h.heldag
    ? tx('lib.kalender.heldag', { datum: String(h.start || '').slice(0, 10) })
    : `${String(h.start || '').replace('T', ' ')}–${String(h.slut || '').slice(11, 16)}`;
  return [
    h.rubrik,
    tx('lib.kalender.nar', { nar }),
    h.plats ? tx('lib.kalender.var', { plats: h.plats }) : null,
    h.deltagare?.length ? tx('lib.kalender.kallade', { vem: h.deltagare.join(', ') }) : null,
    // "Ur kalendern" och inte "Kalender". Sett skarpt 2026-09-28: ett ord
    // med versal först på raden, följt av kolon, är precis formen
    // namnvakten letar efter — och "Kalender: Svenska helgdagar" blev
    // "[NAMN A]: Svenska helgdagar". Maskeringen gjorde rätt enligt sin
    // regel; det var etiketten som såg ut som ett namn.
    tx('lib.kalender.urKalendern', { kalender: h.kalender }),
    h.text ? `\n${h.text}` : null,
  ].filter(Boolean).join('\n');
}
