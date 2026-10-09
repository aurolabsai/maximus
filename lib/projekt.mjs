/// Projektminnet: vad som redan sagts i samma mapp.
///
/// Ett projekt är inte ordning för ordningens skull. Femton samtal om samma
/// upphandling är femton halva minnen — den som frågar i det sextonde vet
/// inte vad som sagts i det fjärde, och modellen vet det inte heller. Varje
/// samtal börjar om från noll i en fråga som pågått i veckor.
///
/// Det här läser de andra samtalen i projektet och tar med det som svarar
/// mot frågan. Inte allt: det som svarar mot frågan.
///
/// ── Varför urval och inte allt ────────────────────────────────────────────
///
/// För att allt inte får plats, och för att allt inte hör hit. Femton samtal
/// är lätt hundra tusen tecken. Modellens fönster är trettiotvå tusen tokens
/// och ska rymma frågan, svaret och samtalet man faktiskt sitter i.
///
/// Samma urval som används för bifogade dokument — se lib/urval.mjs. Det
/// rankar stycken mot frågan och lämnar tillbaka dem i sin egen ordning, för
/// ett resonemang läst i fel ordning är ett annat resonemang.
///
/// ── Vad som lämnar datorn ─────────────────────────────────────────────────
///
/// Ingenting mer än vanligt. Underlaget läggs till frågan INNAN grinden, inte
/// efter, och går därför genom exakt samma maskering som allt annat. Det syns
/// i grinden före sändning och det räknas i liggaren.
///
/// Det är viktigt att det sker i den ordningen. Text ur ett annat samtal är
/// text som en gång maskerats mot en annan karta, och att lita på den
/// maskeringen vore att lita på att två kartor råkar stämma överens. De gör
/// de inte. Originalet går in, grinden maskerar om det mot sessionens egen
/// karta, och samma person får samma platshållare genom hela projektet.

import { valj } from './urval.mjs';
import { tx } from './sprakstod.mjs';

/// Hur mycket projektminne som får plats. Hårt tak.
///
/// Tolv tusen tecken är ungefär fyra tusen tokens — en åttondel av ett
/// 32k-fönster. Det räcker för fem, sex relevanta stycken ur andra samtal
/// och lämnar resten åt det man faktiskt håller på med.
export const BUDGET = 12000;

/// Sessionerna i samma projekt, utom den man sitter i.
export function syskon(alla, sess) {
  if (!sess?.projekt) return [];
  return alla.filter(s => s.id !== sess.id
    && s.projekt === sess.projekt
    && (s.turer || []).length
    // Låsta och förseglade lämnas utanför. En session med kod är en session
    // någon valt att stänga, och att låta den läcka in i ett annat samtal
    // vore att öppna den bakvägen.
    && !s.las
    // Och ett samtal man bett Maximus glömma ska inte minnas av ett annat.
    && s.minne !== 'glom');
}

/// Dina tidigare samtal, för den som bett Maximus minnas (Fas 10).
///
/// Samma regler som syskonen — inga låsta, inga förseglade, inga som ska
/// glömmas — men över alla dina samtal utanför projektet, nyast först. De i
/// samma projekt har redan sin egen väg in, och samma text två gånger är
/// samma budget två gånger.
export function tidigare(alla, sess, { tak = 30 } = {}) {
  return alla.filter(s => s.id !== sess.id
    && (s.turer || []).length
    && !s.las && !s.forseglad
    && s.minne !== 'glom'
    && !(sess.projekt && s.projekt === sess.projekt))
    .sort((a, b) => String(b.andrad || b.skapad || '').localeCompare(String(a.andrad || a.skapad || '')))
    .slice(0, tak);
}

/// En tur som läsbar text.
const turtext = t => [
  `Fråga: ${String(t.fraga || '').trim()}`,
  String(t.svar || '').trim(),
].filter(Boolean).join('\n');

/// Underlaget ur de andra samtalen i projektet.
///
/// Returnerar `null` när det inte finns något att hämta — då ska ingenting
/// läggas till frågan, och ingen rad skrivas om saken.
export function underlagUr(syskonen, fraga, { budget = BUDGET, rubrik = 'Tidigare i det här projektet:' } = {}) {
  if (!syskonen.length) return null;

  // Varje samtal får sin egen del av budgeten, men bara så mycket det
  // behöver. Ett kort samtal ska inte reservera plats det inte fyller.
  const per = Math.max(900, Math.floor(budget / Math.min(syskonen.length, 6)));
  const bitar = [];
  let tecken = 0;

  for (const s of syskonen) {
    if (tecken >= budget) break;
    const hela = (s.turer || []).map(turtext).join('\n\n');
    if (!hela.trim()) continue;
    const v = valj(fraga, hela, { budget: Math.min(per, budget - tecken), minstaPoang: 0.12 });
    const valt = v.valda.join('\n\n').trim();
    if (!valt) continue;
    bitar.push({ titel: s.titel || 'Ett samtal', id: s.id, text: valt, helt: v.helt });
    tecken += valt.length;
  }

  if (!bitar.length) return null;
  return {
    bitar,
    tecken,
    text: [
      rubrik,
      ...bitar.map(b => `\n── ${b.titel}${b.helt ? '' : ' (utdrag)'} ──\n${b.text}`),
    ].join('\n'),
  };
}

/// Raden som visas för användaren.
///
/// Den ska säga VAD som togs med och VARIFRÅN. "Läste tre tidigare samtal" är
/// en upplysning; "läste Anbudsöppningen, Tilldelningsbeslutet och
/// Överprövningen" är ett kvitto man kan kontrollera.
export function kvittot(u, { aktor = tx('projekt.aktor') } = {}) {
  if (!u) return null;
  const namn = u.bitar.map(b => b.titel);
  const sista = namn.pop();
  return {
    tid: new Date().toISOString(), aktor, lokalt: true, ms: 0,
    vad: tx('projekt.kvitto', { lista: namn.length ? tx('projekt.lista', { forra: namn.join(', '), sista }) : sista, tecken: u.tecken }),
  };
}
