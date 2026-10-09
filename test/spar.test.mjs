/// Sökningarna delar inte kakburk.
///
/// `chromium.launch()` kör redan i en temporär profil som rivs vid stängning
/// — användarens egen Chrome rörs aldrig. Men kontexten levde vidare mellan
/// frågorna: webbläsaren hålls öppen i två minuter, och i det fönstret
/// delade alla sökningar kakburk. En sida som satte en kaka under fråga ett
/// kände igen besökaren under fråga två.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const webb = await readFile(new URL('../lib/webb.mjs', import.meta.url), 'utf8');
const upp = await readFile(new URL('../lib/uppslag.mjs', import.meta.url), 'utf8');
const kod = webb.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');

test('ingen beständig profil — aldrig launchPersistentContext', () => {
  assert.ok(!kod.includes('launchPersistentContext'),
    'en beständig kontext skulle skriva kakor och historik till disk');
  assert.ok(!/userDataDir/.test(kod),
    'en egen profilkatalog är precis det vi inte vill ha');
  assert.match(kod, /chromium\.launch\(/, 'webbläsaren ska startas utan profil');
});

test('varje sökning börjar i ett nytt spår', () => {
  assert.match(upp, /await nyttSpar\(\)/, 'slaUpp ska öppna ett spår innan den söker');
  // Före den första sökningen, inte efter.
  assert.ok(upp.indexOf('await nyttSpar()') < upp.indexOf('const r = await sok('),
    'spåret ska öppnas innan något hämtas');
});

test('varje sökning får en EGEN kontext, inte en delad som byts', () => {
  // Första försöket bytte den delade kontexten. Det gav varje sökning en
  // egen kakburk — men bara en i taget: två samtal som sökte samtidigt drog
  // undan varandras kontext mitt i en hämtning.
  const i = kod.indexOf('export async function nyttSpar');
  assert.ok(i > 0);
  const kropp = kod.slice(i, kod.indexOf('\n}', i));
  assert.match(kropp, /const egen = await webblasare\.b\.newContext\(/,
    'spåret ska ha en egen kontext');
  assert.match(kropp, /nySida:/, 'spåret ska kunna ge sidor');
  assert.match(kropp, /stang:/, 'spåret ska gå att stänga');
  assert.ok(!/webblasare\.ctx =/.test(kropp),
    'den delade kontexten får inte bytas — då stör två samtal varandra');
  assert.ok(!/\.b\.close\(\)/.test(kropp),
    'webbläsaren ska INTE stängas — uppstarten kostar sekunder, kontexten millisekunder');
});

test('spåret stängs när uppslaget är klart', () => {
  assert.match(upp, /await spar\?\.stang\(\)/, 'kakburken kastas aldrig');
  assert.match(upp, /spar = await nyttSpar\(\)/, 'spåret skapas inte');
  // Och det används av både sökningen och hämtningen.
  assert.match(upp, /sok\(f, \{ antal: (5|perSok), signal, liggare, spar \}\)/);
  assert.match(upp, /hamta\(t\.url, \{ signal, liggare, spar(, vara: varor)? \}\)/);
});

test('den gräver när det är tunt, inte när taket inte nåtts', async () => {
  const upp = await readFile(new URL('../lib/uppslag.mjs', import.meta.url), 'utf8');
  const kod = upp.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
  const i = kod.indexOf('await las(nasta(');
  const block = kod.slice(i, kod.indexOf('koande = await planeraOm', i));
  // Fem goda källor och ett tak på sex fick den att söka i två varv till,
  // fyrtio sekunder per varv, innan modellen fick börja skriva.
  assert.match(block, /if \(kallor\.length >= minst\) break;/,
    'tröskeln ska avbryta grävandet, inte bara taket');
  assert.match(block, /if \(kallor\.length >= sidor\) break;/,
    'taket ska också avbryta');
});
