/// Grinden ska visa vad som går, inte bara frågan.
///
/// Revisionen 2026-09-28 (M4): användaren ser den aktuella frågans
/// `maskerad`, men servern lägger till historik, policy, projektunderlag och
/// webbunderlag. Användaren godkände en sak och en annan gick.
///
/// Allt det går genom samma maskering, så inget omaskerat smiter ut den
/// vägen. Men "det är maskerat" är inte samma löfte som "du ser vad som går
/// ut", och det är det senare MAXIMUS lovar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const kod = server.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

test('förberedelsen räknar med allt som följer med', () => {
  const i = kod.indexOf('async function foljerMed(');
  assert.ok(i > 0, 'manifestet ska finnas');
  const kropp = kod.slice(i, kod.indexOf("if (vag === '/api/forbered')", i));
  for (const [vad, monster] of [
    ['historiken', /sort: 'historik'/],
    ['policyn', /sort: 'policy'/],
    ['bilagorna', /sort: 'bilaga'/],
    ['projektunderlaget', /sort: 'projekt'/],
  ]) assert.match(kropp, monster, `${vad} saknas i manifestet`);
});

test('projektet räknas med samma anrop som sändvägen använder', () => {
  // Inte en uppskattning bredvid: siffran i grinden ska vara den som
  // faktiskt går.
  const i = kod.indexOf('async function foljerMed(');
  const kropp = kod.slice(i, kod.indexOf("if (vag === '/api/forbered')", i));
  assert.match(kropp, /Projekt\.syskon\(/, 'samma urval som sändvägen');
  assert.match(kropp, /Projekt\.underlagUr\(/, 'samma underlag som sändvägen');
});

test('det som inte går att veta står som okänt, inte utelämnat', () => {
  const i = kod.indexOf('async function foljerMed(');
  const kropp = kod.slice(i, kod.indexOf("if (vag === '/api/forbered')", i));
  assert.match(kropp, /const okant = \[\]/, 'webbunderlaget finns inte förrän sökningen körts');
  assert.match(kropp, /tx\('srv\.foljer\.webbOkant'\)/);
  assert.match(kropp, /return \{ poster, okant \}/);
});

test('manifestet gäller varje fråga nu', () => {
  // Förr hoppades det över i lokalt läge, för då gick ingenting ut. Med
  // destinationen borta går ingenting ut alls — men allt följer fortfarande
  // med till modellen, och till den maskerade versionen man kopierar ut.
  // Användaren ska se vad som läggs till hennes fråga.
  const i = kod.indexOf('async function foljerMed(');
  assert.ok(i > 0);
  const kropp = kod.slice(i, i + 500);
  assert.ok(!/if \(lokalt \|\| !sess\)/.test(kropp), 'lokalt hoppar fortfarande över');
  assert.match(kropp, /if \(!sess\) return \{ poster: \[\], okant: \[\] \}/);
});

test('grinden ritar manifestet', () => {
  assert.match(app, /function ritaFoljer\(fm\)/, 'grinden ska kunna rita listan');
  assert.match(app, /f\.foljerMed\?\.poster\?\.length \|\| f\.foljerMed\?\.okant\?\.length/,
    'listan ska visas när det finns något att visa');
});

test('kartan är en, och alla tre vägar skriver till den', () => {
  // Projektunderlaget skrev till s.karta men lämnade forberedd.karta orörd
  // — och det är förberedas karta som svaret avmaskeras med. Webbvägen fick
  // kartan som en Map och kastade den.
  const i = kod.indexOf('const synka = (karta, raknare)');
  assert.ok(i > 0, 'det ska finnas ett ställe som håller kartorna i takt');
  const kropp = kod.slice(i, kod.indexOf('};', i));
  assert.match(kropp, /s\.karta = lista/, 'sessionen ska uppdateras');
  assert.match(kropp, /forberedd = \{ \.\.\.forberedd, karta: lista/, 'frågans objekt ska uppdateras');

  // Och båda vägarna ska gå genom den.
  assert.match(kod, /synka\(sokkarta, sokraknare\)/, 'webbvägen skriver inte tillbaka sin karta');
  assert.match(kod, /synka\(pm\.karta, pm\.raknare\)/, 'projektvägen skriver inte tillbaka sin karta');
  assert.ok(!/\n\s*s\.karta = pm\.karta;/.test(kod),
    'den gamla enkelriktade skrivningen ska vara borta');
});
