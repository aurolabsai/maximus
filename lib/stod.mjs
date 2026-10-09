// Tankar på att inte vilja leva. Deterministiskt, i alla lägen.
//
// Uppmätt 2026-09-22: fem lokala modeller fick "har börjat tänka att det
// vore lättast om jag bara inte fanns", med en instruktion som uttryckligen
// sa 90101 och 112. En av fem nämnde numren. Jan svarade "Det är ok att
// känna … att det är lättast att inte vara där". Det som måste hända varje
// gång kan inte ligga i en instruktion till en modell som följer den ibland.
//
// Hellre en rad för mycket än en för lite. Den som skriver "vill dö av
// skratt" får en hänvisning den inte behövde; det kostar ingenting. Den som
// skriver att den inte vill finnas och inte får den kostar allt.

// `\b` i JavaScript räknar inte å, ä och ö som bokstäver — "dö\b" matchar
// aldrig. Gränserna skrivs därför ut med Unicode-klasser.
import { tx, svenska } from './sprakstod.mjs';

const G = s => new RegExp(`(?<![\\p{L}\\d])(?:${s})(?![\\p{L}\\d])`, 'iu');
const KRIS = [
  'ta(?:r|git)?\\s+(?:livet\\s+av\\s+(?:mig|sig|dig|oss)|(?:mitt|sitt|ditt)\\s+(?:eget\\s+)?liv)',
  'självmord\\p{L}*|suicid\\p{L}*|självskad\\p{L}*',
  '(?:vill|ville|orkar|orkade)\\s+(?:inte|int|inge)\\s+(?:leva|finnas)',
  '(?:vill|ville)\\s+(?:bara\\s+)?dö',
  '(?:om|att)\\s+jag\\s+(?:bara\\s+)?(?:inte\\s+fanns|försvann\\s+för\\s+alltid|var\\s+död|dog)',
  '(?:inte|aldrig)\\s+vakna(?:r|de)?\\s+(?:upp\\s+)?igen',
  'ingen\\s+mening\\s+(?:med\\s+(?:att\\s+)?(?:livet|leva)|att\\s+leva)',
  '(?:skära|skär|skadar?)\\s+(?:mig|sig|dig)\\s+själv',
  // Engelska (fas 3). Körs alltid, på vilket språk du än har valt: den som
  // skriver engelska i en svensk Maximus ska få raden lika säkert.
  '(?:kill|killing|killed|hurt|hurting|harm|harming|cut|cutting)\\s+(?:my|him|her|them|your)?self|(?:kill|killing)\\s+(?:myself|themselves|ourselves)',
  'suicid\\p{L}*|self[-\\s]?harm\\p{L}*|self[-\\s]?injur\\p{L}*',
  'end(?:s|ed|ing)?\\s+(?:my|his|her|their|your)\\s+(?:own\\s+)?life',
  'take\\s+(?:my|his|her|their|your)\\s+(?:own\\s+)?life',
  "(?:do\\s*n[o']?t|don't|dont|no\\s+longer)\\s+want\\s+to\\s+(?:live|be\\s+alive|exist|be\\s+here\\s+anymore)",
  '(?:want|wanna|wanted)\\s+to\\s+die',
  "(?:better\\s+off|easier)\\s+(?:if\\s+i\\s+(?:were|was)\\s+(?:dead|gone|not\\s+here)|dead|without\\s+me)",
  "(?:never|not)\\s+wake\\s+up\\s+again|(?:wish|hope)\\s+i\\s+(?:could\\s+)?(?:wouldn't|would\\s+not|didn't|did\\s+not|don't)\\s+wake\\s+up",
  'no\\s+(?:point|reason)\\s+(?:in\\s+)?(?:living|to\\s+live|going\\s+on)',
  "(?:can't|cannot|can\\s+not)\\s+go\\s+on\\s+(?:living|anymore|like\\s+this)",
].map(G);

/// Sant om texten rör tankar på att inte vilja leva — egna eller någon annans.
export const kris = text => KRIS.some(r => r.test(String(text || '')));

/// Raden som alltid visas. STOD och TILL_MODELLEN är v1:s svenska; stod()
/// och tillModellen() följer språket. Numren följer landet: de svenska står
/// kvar, och engelskan säger vad den som inte är i Sverige gör. Den gäller både den som skriver om sig själv och
/// handläggaren som skriver om en brukare, så den säger inte vem.
export const STOD = 'Handlar det om tankar på att inte vilja leva — dina egna eller någon annans — '
  + 'finns det hjälp dygnet runt: Självmordslinjen 90101 (chatt på mind.se), eller 1177. '
  + 'Vid akut fara: ring 112.';

/// Det modellen får veta när raden visas, så att svaret går åt samma håll.
export const TILL_MODELLEN = 'Frågan kan röra tankar på att inte vilja leva. Var varm och döm inte. '
  + 'Ta det på allvar utan att dramatisera, och nämn Självmordslinjen 90101 och 112 vid akut fara.';

/// Stödraden på det språk som gäller.
export const stod = () => tx('stod.rad');

/// Det modellen får veta, på det språk som gäller. Svenska: TILL_MODELLEN.
export const tillModellen = () => (svenska() ? TILL_MODELLEN : tx('stod.tillModellen'));
