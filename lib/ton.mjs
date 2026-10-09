/// Tonen: när ett svar ska vara ett resonemang och inte ett beslut.
///
/// MAXIMUS svarar på två slags frågor med samma modell. Ett ärende ska ha
/// slutsatsen först, i fetstil, så att någon kan agera. Något personligt ska
/// inte ha någon slutsats alls — den som berättar att hon börjat få känslor
/// för en kollega ska inte mötas av en fetstilsrad som avgör saken.
///
/// Instruktionen säger det. Gemma 4 12B följer den. E4B gör det nästan:
/// omdömesbänken 2026-09-25 gav en anmärkning av tio svar, och den var precis
/// den här — en fetstilsdom i ett personligt samtal. E4B är den modell en
/// vanlig kommundator med 16 GB minne får, så "nästan" räcker inte.
///
/// Alltså avgör regler, och modellen fyller i. Samma ordning som maskeringen,
/// krisdetektionen och webbeslutet.
///
/// Det viktiga, som första försöket missade: **det är samtalet som är
/// personligt, inte meddelandet.** "Avhandla moral" är en neutral uppmaning i
/// sig, och en tröstlös sak att svara på i en tråd om ett äktenskap. Därför
/// läses historiken med.

/// `\b` i JavaScript är ASCII, så gränserna görs över Unicode. Se stod.mjs för
/// samma fälla — /\båterge\b/ matchar aldrig "Återge".
const G = m => new RegExp(`(?<![\\p{L}\\d])(?:${m})(?![\\p{L}\\d])`, 'iu');

/// Det som gör en fråga personlig.
///
/// Listan är skriven av det folk faktiskt skriver, inte av kategorier. "Usch",
/// "jag skäms", "det känns fel" — det är hur någon inleder när det är svårt.
const PERSONLIGT = [
  G('jag (?:känner|mår|är ledsen|är arg|är rädd|är kär|orkar inte|vet inte vad jag ska|skäms|ångrar)'),
  G('(?:känslor|förälskad|attraherad|kär) (?:för|i)'),
  G('min (?:partner|man|fru|sambo|pojkvän|flickvän|mamma|pappa|dotter|son|bror|syster|vän)'),
  G('mitt (?:förhållande|äktenskap|mående)'),
  G('känns (?:fel|jobbigt|tungt|skamligt|hopplöst)'),
  G('(?:jag har ett|ett personligt) dilemma'),
  G('(?:är det|varför är det) (?:fel|okej|tillåtet)'),
  G('(?:avhandla|resonera om) moral'),
  G('usch|skamset|skuldkänslor'),
  // Engelska (fas 3), alltid vid sidan av svenskan.
  G("i (?:feel|am sad|am angry|am scared|am afraid|am in love|can't cope|don't know what to do|am ashamed|regret)|i'm (?:sad|angry|scared|afraid|in love|ashamed|struggling)"),
  G('(?:feelings|in love|attracted) (?:for|with|to)'),
  G('my (?:partner|husband|wife|boyfriend|girlfriend|mom|mum|mother|dad|father|daughter|son|brother|sister|friend)'),
  G('my (?:relationship|marriage|wellbeing|well-being|mental health)'),
  G('(?:it )?feels (?:wrong|hard|heavy|shameful|hopeless)'),
  G('(?:i have a|a personal) dilemma'),
  G('(?:is it|why is it) (?:wrong|okay|ok|allowed)'),
  G('(?:discuss|reason about) (?:morality|morals|ethics)'),
  G('ugh|ashamed|guilt|guilty conscience'),
];

/// En tydlig arbetsfråga, som ska ha sin slutsats i fetstil även om samtalet
/// runt den handlat om något annat.
///
/// Utan den smittade historiken allt: "Vad kostar bygglov?" blev personlig
/// bara för att någon tidigare i samma tråd skrivit om ett äktenskap. Den som
/// byter ämne har bytt ämne.
const ARBETE = [
  G('vad (?:gäller|kostar|krävs|säger (?:lagen|regeln|föreskriften))'),
  G('hur (?:fungerar|går|hanterar|ansöker|överklagar)'),
  G('vilka (?:regler|krav|skyldigheter|rättigheter|handlingar|blanketter)'),
  G('vem (?:beslutar|ansvarar|får besluta|ska underrätta)'),
  G('(?:diarienummer|ärendenummer|paragraf|§|lagrum|föreskrift|taxa|avgift)'),
  G('skriv (?:ett|en|om) (?:mejl|brev|beslut|yttrande|tjänsteskrivelse|anteckning)'),
  G('what (?:applies|does it cost|is required|are the requirements|does the (?:law|rule|regulation) say)'),
  G('how (?:does|do i apply|do i appeal|to apply|to appeal|is .{1,30} handled)'),
  G('which (?:rules|requirements|obligations|rights|documents|forms)'),
  G('who (?:decides|is responsible|may decide|must notify)'),
  G('(?:case number|reference number|section|regulation|statute|fee|tariff)'),
  G('write (?:an?|the) (?:email|e-mail|letter|decision|statement|memo|note)'),
];

/// Är den här frågan, i det här samtalet, personlig?
///
/// Frågan själv först, sedan historiken. Ett samtal som börjat i ett
/// äktenskap slutar inte vara personligt för att den fjärde frågan är kort —
/// men det slutar när någon ställer en tydlig arbetsfråga.
export function arPersonlig(fraga, historik = []) {
  const en = t => PERSONLIGT.some(r => r.test(String(t || '')));
  if (en(fraga)) return true;
  if (ARBETE.some(r => r.test(String(fraga || '')))) return false;
  // Tre turer bakåt. Längre tillbaka är det ett annat samtal, även om det står
  // i samma session.
  return historik.slice(-3).some(t => en(t.fraga));
}

/// Vad som läggs till frågan när samtalet är personligt.
///
/// På samma rad som frågan och i användarens röst. Mätt 2026-09-24: en
/// instruktion i systemraden eller som eget meddelande gjorde att modellen
/// tappade sammanhanget och svarade "du har inte bifogat någon text". På
/// frågans sista rad fungerar den.
import { tx } from './sprakstod.mjs';

export const tonvink = (fraga, historik = []) =>
  arPersonlig(fraga, historik) ? tx('pars.ton.vink') : '';

/// Tar bort en fetstilsdom som ändå kom.
///
/// Instruktionen och vinken räcker för 12B men inte alltid för E4B. Raden
/// försvinner inte — fetstilen gör det. Meningen kan vara bra; det är
/// formateringen som gör den till en dom.
///
/// Bara den första raden, och bara om hela raden är fet. En fet fras mitt i
/// ett resonemang är emfas, inte ett domslut.
export function utanDom(svar) {
  const rader = String(svar || '').split('\n');
  const i = rader.findIndex(r => r.trim());
  if (i < 0) return svar;
  const rad = rader[i].trim();
  const m = /^\*\*(.+?)\*\*[.:]?$/s.exec(rad);
  if (!m) return svar;
  rader[i] = rader[i].replace(rad, m[1].trim());
  return rader.join('\n');
}
