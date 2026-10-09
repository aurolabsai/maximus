// Frågorna modellen ställer tillbaka.
//
// Ett svar slutar ofta med att modellen behöver veta mer: vilket datum,
// vilken kommun, om du redan har överklagat. I dag skriver man av dem en i
// taget i skrivfältet. Sagt 2026-10-01: "här får vi FRÅGOR. frågor vi skulle
// kunna besvara, bifoga till och/eller lösa redan direkt utan att behöva
// skriva punkt för punkt."
//
// ── Vad som räknas som en fråga TILL DIG ──────────────────────────────────
//
// Inte varje rad som slutar med frågetecken. "Vad händer om nämnden avslår?"
// är en rubrik modellen själv besvarar två rader ned, och ett svarsfält under
// den vore en uppmaning att svara på något ingen frågat.
//
// Två signaler skiljer dem åt, och båda kommer av hur modeller faktiskt
// skriver:
//
//   andra person   "har DU redan överklagat", "vilket datum fick du"
//   punktform      frågor till användaren radas upp; retoriska frågor står
//                  i löpande text som övergångar
//
// Den som är osäker ska hellre missa en fråga än hitta på en. Ett fält för
// mycket ber dig svara på något som inte frågades; ett fält för lite kostar
// att du skriver frågan själv, vilket är precis vad som gäller i dag.

import { arUtkast } from './md.js';
import { t } from './sprakstod.js';

// Engelska sedan 2026-10-09: svaret kommer på det språk frågan ställdes på.
const DU = /\b(du|dig|din|ditt|dina|ni|er|ert|era|you|your|yours|yourself|yourselves)\b/i;
const PUNKT = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;

/// Raden utan markdown. Fetstil och kodspann hör till formen, inte frågan.
const ren = t => String(t)
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[*_`~]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/// Frågorna i ett svar, i den ordning de står.
export function fragorna(svar, { hogst = 6, fraga = '' } = {}) {
  const text = String(svar ?? '').replace(/\r/g, '');
  const rader = text.split('\n');
  const ut = [];
  const sedda = new Set();
  // Dina egna ord, att känna igen när de kommer tillbaka.
  const egna = delfragor(fraga);
  let iBlock = false;
  let langst = 0;

  for (const rad of rader) {
    // Kodblock räknas inte: en fråga i ett kodexempel är ett kodexempel.
    //
    // Men MAXIMUS:s egna rutor — ```utkast, ```mejl, ```underlag — är prosa i
    // en ruta, inte kod. 2026-10-01 la modellen alla sina sju frågor i en
    // ```utkast-ruta, och panelen hittade noll. md.js äger listan över vad
    // som är vad; den frågas, den kopieras inte.
    if (/^\s*```/.test(rad)) {
      iBlock = iBlock ? false : !arUtkast(rad.trim().slice(3).trim());
      continue;
    }
    if (iBlock) continue;
    // Rubriker räknas inte. "## Vad händer nu?" är en avdelning i svaret.
    if (/^\s*#{1,6}\s/.test(rad)) continue;
    // Citat räknas inte: de är något som citeras, inte något som frågas.
    if (/^\s*>/.test(rad)) continue;

    const punkt = PUNKT.exec(rad);
    const radtext = ren(punkt ? punkt[2] : rad);
    if (!radtext.endsWith('?')) continue;
    // En rad med flera meningar: bara den sista är frågan.
    //
    // Men punkten i "t.ex." är inget meningsslut. Första versionen klippte
    // där, och "Vilken typ av avtal rör det sig om (t.ex. tjänsteavtal,
    // köpeavtal)?" blev frågan "tjänsteavtal, köpeavtal)?". En punkt räknas
    // bara när nästa mening börjar med versal.
    const delar = radtext.split(/(?<=[.!?])\s+(?=\p{Lu})/u);
    const fragan = delar[delar.length - 1].trim();
    if (fragan.length < 10 || fragan.length > 220) continue;
    if (!punkt && !DU.test(fragan)) continue;

    const nyckel = normalisera(fragan);
    if (sedda.has(nyckel)) continue;
    // Din egen fråga, upprepad. Modellen skriver ofta om uppdraget överst
    // innan den löser det — det är en innehållsförteckning, inte en begäran.
    if (arEko(nyckel, egna)) continue;
    sedda.add(nyckel);
    langst = Math.max(langst, text.indexOf(rad));
    ut.push(fragan);
    if (ut.length >= hogst) break;
  }

  // Frågor till dig står SIST. Ligger allihop i början av ett långt svar är
  // de rubriker modellen själv besvarar nedanför.
  //
  // Sett 2026-10-01: fyra frågor, alla inom de första två procenten av ett
  // svar på nio tusen tecken, och var och en besvarad i texten under dem.
  // Panelen bad användaren svara på frågor hon själv ställt och redan fått
  // svar på: "hur ska JAG svara på de frågorna?"
  //
  // Undantaget är korta svar som nästan BARA är frågor — då finns ingen
  // senare del att stå i, och de är just vad panelen finns för.
  if (text.length > 1200 && langst < text.length * 0.5) return [];
  return ut;
}

/// Frågorna i en text, som ordmängder. Används på DIN fråga, för att känna
/// igen den när modellen upprepar den.
function delfragor(t) {
  return String(t ?? '')
    .split(/(?<=\?)\s+/)
    .map(d => normalisera(d))
    .filter(d => d.length >= 8)
    .map(d => new Set(d.split(' ').filter(Boolean)));
}

/// Är det här din fråga, omskriven?
///
/// Exakt jämförelse räcker inte. Modellen skriver om i förbifarten — "dom
/// svaren" blir "dessa svar" — och svenskans bestämda form gör två ord av
/// ett. Därför ordöverlapp: delar frågan tre fjärdedelar av sina ord med
/// något du själv frågade, är den din.
function arEko(kandidat, egna) {
  const a = new Set(String(kandidat).split(' ').filter(Boolean));
  if (!a.size) return false;
  for (const b of egna) {
    // Exakt lika korta frågor fångas av mängdjämförelsen nedan ändå; den
    // här raden finns för "Vad behövs?" mot "Vad behövs?".
    let traff = 0;
    for (const o of a) if (b.has(o)) traff++;
    if (traff / a.size >= 0.75) return true;
  }
  return false;
}

/// Två formuleringar av samma fråga ska se lika ut.
///
/// Modellen skriver om i förbifarten: "dom svaren" blir "dessa svar", "och
/// hur kan vi" blir "hur kan vi". Jämförelsen får inte falla på det.
const normalisera = t => String(t ?? '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/(?<![\p{L}\d])(och|samt|men|dom|dessa|dom här|de|den|det|dessa|just|and|but|also|the|a|an|these|those|this|that)(?![\p{L}\d])/giu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/// Svaren, satta samman till ETT meddelande.
///
/// Frågan står som citat över sitt svar. Den som läser samtalet i efterhand
/// ska se vad som besvarades — ett meddelande med bara "12 september" och
/// "nej" är obegripligt tre dagar senare.
///
/// Obesvarade frågor tas med som obesvarade. Att tiga om dem vore att låta
/// modellen tro att den fått svar på allt.
export function sammanstall(par) {
  const svarade = par.filter(p => p.svar?.trim());
  if (!svarade.length) return '';
  const stycken = svarade.map(p => `> ${p.fraga}\n\n${p.svar.trim()}`);
  const kvar = par.filter(p => !p.svar?.trim()).map(p => p.fraga);
  if (kvar.length) {
    stycken.push(kvar.length === 1
      ? t('fragor.oneUnanswered', { fraga: kvar[0] })
      : t('fragor.manyUnanswered', { fragor: kvar.map(f => `- ${f}`).join('\n') }));
  }
  return stycken.join('\n\n');
}
