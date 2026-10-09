/// Noteringar i marginalen.
///
/// En notering är användarens egna ord om en passage i ett svar. Två saker
/// måste hålla, och båda är tysta när de brister:
///
///   1. Turen rörs aldrig. Noteringen får inte kunna hamna i texten och
///      läsas som något modellen skrev.
///   2. Ingenting försvinner. Passagen sparas ordagrant, och hittas den inte
///      längre står noteringen kvar ändå. En anteckning som försvinner för
///      att underlaget ändrades är en anteckning man inte vågar göra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const i = kod.indexOf('const mNot =');
assert.ok(i > 0, 'rutten finns inte');
const RUTT = kod.slice(i, kod.indexOf("// Svaret på en fråga om godkännande", i));

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

test('rutten rör inte turerna', () => {
  assert.ok(!/s\.turer/.test(RUTT), 'rutten skriver i turerna');
  assert.ok(!/\.svar\s*=/.test(RUTT), 'rutten skriver i ett svar');
});

test('passagen och tiden sätts av servern', () => {
  assert.match(RUTT, /passage = String\(kropp\.passage \|\| ''\)[\s\S]*?\.slice\(0, 400\)/);
  assert.match(RUTT, /tid: new Date\(\)\.toISOString\(\)/);
  // Ingen notering utan passage: utan den går den inte att hitta igen.
  assert.match(RUTT, /if \(!passage\) return json\(res, 400/);
});

test('platsen är en av två former, aldrig vad som helst', () => {
  // `plats` väljer vilken yta noteringen visas i. En klient som skickar
  // något annat ska landa på samtalet, inte skapa en yta som inte finns.
  const m = /\/\^\(samtal\|fil:\[\\\\?w-\]\{1,40\}\)\$\//.exec(RUTT)
    || /test\(String\(kropp\.plats/.test(RUTT);
  assert.ok(m, 'platsen kontrolleras inte');
  assert.match(RUTT, /\? String\(kropp\.plats\) : 'samtal'/);
});

test('ett tak som inte kan passeras', () => {
  assert.match(RUTT, /s\.noteringar\.length >= 300/);
  // Taket måste gälla NYA noteringar. En ändring av en befintlig ska gå
  // igenom också vid taket — annars låses det man redan skrivit.
  const nya = RUTT.indexOf('>= 300');
  const fanns = RUTT.indexOf('if (fanns)');
  assert.ok(fanns > 0 && fanns < nya, 'taket stoppar även ändringar');
});

test('en förseglad session ber inte om stubben', () => {
  // Samma regel som bocken: bara de tre vägar som måste be gör det.
  assert.ok(!/forseglad: true/.test(RUTT));
});

test('uppritningen river sina egna påhäng först', () => {
  // malaNoteringar körs om vid varje uppritning. Lägger den märken ovanpå
  // märken växer HTML:en för varje svar som kommer, och passagen hittas
  // till slut inte alls.
  const j = app.indexOf('function malaNoteringar');
  const f = app.slice(j, j + 600);
  assert.match(f, /querySelectorAll\('mark\.not-mark'\)/);
  assert.match(f, /replaceWith\(\.\.\.m\.childNodes\)/);
  assert.match(f, /rot\.normalize\(\)/, 'texten slås inte ihop igen');
});

test('noteringar utan plats räknas som samtalets', () => {
  // De skrevs innan läsvyn fanns. Utan reservvärdet blir de osynliga.
  assert.match(app, /\(n\.plats \|\| 'samtal'\) === plats/);
});
