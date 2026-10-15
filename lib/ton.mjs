
const G = m => new RegExp(`(?<![\\p{L}\\d])(?:${m})(?![\\p{L}\\d])`, 'iu');

const PERSONLIGT = [
  G('jag (?:känner mig|mår|är ledsen|är arg|är rädd|är orolig|är stressad|är ensam|är kär|orkar inte|vet inte vad jag ska|skäms|ångrar|sörjer|saknar)'),
  G('(?:sorg|sorgen|ångest|ensamhet|utbränd|utmattad|deprimerad|panikångest|skuldkänslor|svartsjuk)'),
  G('(?:har gått bort|gick bort|har dött|fått en diagnos|allvarligt sjuk)'),
  G('(?:känslor|förälskad|kär) (?:för|i)'),
  G('min (?:partner|man|fru|sambo|pojkvän|flickvän|mamma|pappa|dotter|son|bror|syster|vän|familj)'),
  G('mitt (?:förhållande|mående)'),
  G('(?:bråkar|grälar) (?:med|hemma)|konflikt (?:i familjen|hemma)'),
  G('känns (?:fel|jobbigt|tungt|hopplöst|ensamt|meningslöst)'),
  G('stress(?:ad|en) på jobbet|går på knäna'),
  G("i (?:feel|am sad|am angry|am scared|am afraid|am worried|am lonely|am stressed|am in love|can't cope|don't know what to do|am ashamed|regret|miss)|i'm (?:sad|angry|scared|afraid|worried|lonely|stressed|in love|ashamed|struggling|grieving)"),
  G('(?:grief|grieving|anxiety|loneliness|burned out|burnt out|depressed|panic attacks|jealous)'),
  G('(?:passed away|has died|got a diagnosis|seriously ill)'),
  G('(?:feelings|in love) (?:for|with)'),
  G('my (?:partner|husband|wife|boyfriend|girlfriend|mom|mum|mother|dad|father|daughter|son|brother|sister|friend|family)'),
  G('my (?:relationship|wellbeing|well-being|mental health)'),
  G('(?:fighting|arguing) (?:with|at home)|conflict (?:in the family|at home)'),
  G('(?:it )?feels (?:wrong|hard|heavy|hopeless|lonely|pointless)'),
  G('stress(?:ed)? at work|ashamed|guilt'),
];

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

export function arPersonlig(fraga, historik = []) {
  const en = t => PERSONLIGT.some(r => r.test(String(t || '')));
  if (en(fraga)) return true;
  if (ARBETE.some(r => r.test(String(fraga || '')))) return false;
  return historik.slice(-3).some(t => en(t.fraga));
}

import { tx } from './sprakstod.mjs';

export const tonvink = (fraga, historik = []) =>
  arPersonlig(fraga, historik) ? tx('pars.ton.vink') : '';

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
