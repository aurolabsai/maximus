
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

export const kris = text => KRIS.some(r => r.test(String(text || '')));

export const STOD = 'Handlar det om tankar på att inte vilja leva — dina egna eller någon annans — '
  + 'finns det hjälp dygnet runt: Självmordslinjen 90101 (chatt på mind.se), eller 1177. '
  + 'Vid akut fara: ring 112.';

export const TILL_MODELLEN = 'Frågan kan röra tankar på att inte vilja leva. Var varm och döm inte. '
  + 'Ta det på allvar utan att dramatisera, och nämn Självmordslinjen 90101 och 112 vid akut fara.';

export const stod = () => tx('stod.rad');

export const tillModellen = () => (svenska() ? TILL_MODELLEN : tx('stod.tillModellen'));
