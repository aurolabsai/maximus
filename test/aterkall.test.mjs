/// Återkallningen: en gammal tur som frågan faktiskt pekar på.
///
/// Sammandraget i lib/minne.mjs är generiskt — det skrevs utan att veta vad
/// nästa fråga skulle handla om, och har tolv punkter till hela samtalets
/// förfogande. Frågar någon om ett belopp ur tur 3 av 40 finns det inte kvar.
///
/// Det som INTE får hända: att urvalet ändrar inledningen på prompten. Då
/// faller cachen och samtalet kostar 76 sekunder i stället för 0,9.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valj, block, aterkalla } from '../lib/aterkall.mjs';

const GAMLA = [
  { fraga: 'Vad gäller vid uppsägning av personliga skäl?',
    svar: 'Saklig grund krävs enligt 7 § LAS. Omplaceringsskyldigheten ska prövas först.' },
  { fraga: 'Hur mycket kostade upphandlingen av skolskjutsen i Malmö?',
    svar: 'Anbudssumman landade på 4 720 000 kronor för avtalsperioden 2024–2027.' },
  { fraga: 'Kan du sammanfatta mötet med facket?',
    svar: 'Facket motsatte sig förändringen och begärde förhandling enligt 11 § MBL.' },
  { fraga: 'Vilken tid gäller för överklagande?',
    svar: 'Tre veckor från den dag du fick del av beslutet, enligt 44 § förvaltningslagen.' },
];

test('en fråga om ett belopp hämtar turen där beloppet stod', () => {
  const t = valj(GAMLA, 'Vad var anbudssumman för skolskjutsen egentligen?');
  assert.equal(t.length >= 1, true, 'ingenting hämtades');
  assert.match(t[0].svar, /4 720 000/);
});

test('ett egennamn väger tyngre än ett vanligt ord', () => {
  const t = valj(GAMLA, 'Vad sa vi om upphandlingen i Malmö?');
  assert.match(t[0].fraga, /Malmö/);
});

test('en fråga som inte pekar på något hämtar ingenting', () => {
  // Att hämta något irrelevant är värre än att hämta inget — det är brus
  // modellen kan fastna på.
  assert.deepEqual(valj(GAMLA, 'Vad blir det för väder imorgon?'), []);
  assert.deepEqual(valj(GAMLA, 'Tack, det var allt!'), []);
});

test('ett enda delat ord räcker inte', () => {
  // "gäller" finns i två av turerna och betyder ingenting om vilken.
  assert.deepEqual(valj(GAMLA, 'Vad gäller?'), []);
});

test('lagrum och paragrafer hittar sin tur', () => {
  const t = valj(GAMLA, 'Du nämnde förhandling enligt MBL — vilken paragraf var det?');
  assert.match(t[0].svar, /11 § MBL/);
});

test('inga gamla turer ger ingenting', () => {
  assert.deepEqual(valj([], 'vad som helst'), []);
  assert.deepEqual(valj(null, 'vad som helst'), []);
  assert.equal(aterkalla([], 'vad som helst'), '');
});

test('blocket säger varför det står där', () => {
  // Utan den raden ser det ut som att användaren skrivit om sig själv, och
  // modellen svarar på fel fråga.
  const b = block([GAMLA[1]]);
  assert.match(b, /Ur tidigare i samtalet/);
  assert.match(b, /inte en ny fråga/);
  assert.match(b, /bakgrund/);
  assert.match(b, /4 720 000/);
});

test('blocket läggs SIST — inledningen måste stå still', () => {
  const fraga = 'Vad var anbudssumman?';
  const hel = fraga + aterkalla(GAMLA, 'Vad var anbudssumman för skolskjutsen?');
  assert.ok(hel.startsWith(fraga), 'frågan ska stå först, blocket efter');
});

test('en lång tur vinner inte på massa', () => {
  const langt = { fraga: 'Berätta allt', svar: 'ord '.repeat(4000) + 'skolskjuts anbudssumma' };
  const t = valj([...GAMLA, langt], 'Vad var anbudssumman för skolskjutsen?');
  assert.match(t[0].svar, /4 720 000/, 'den korta och träffsäkra ska vinna');
});

test('högst så många som ombetts', () => {
  const t = valj(GAMLA, 'Vad gäller vid uppsägning och överklagande av beslutet?', { antal: 1 });
  assert.ok(t.length <= 1);
});

test('turerna lämnas orörda — inga arbetsfält kvar', () => {
  // Turerna är sessionens egna objekt och sparas till disk. Ett `_ord`-fält
  // som blir kvar hamnar i sessionsfilen och växer den för varje fråga.
  const kopia = GAMLA.map(t => ({ ...t }));
  valj(kopia, 'Vad var anbudssumman för skolskjutsen?');
  for (const t of kopia) assert.deepEqual(Object.keys(t).sort(), ['fraga', 'svar']);
});
