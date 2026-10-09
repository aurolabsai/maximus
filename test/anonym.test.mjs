/// Anonymiserat ska anonymisera, eller säga att det inte gjorde det.
///
/// Revisionen 2026-09-29 (H5), bevisat i serverflöde och UI: användaren valde
/// Anonymiserat, skickade en fråga med ett precist belopp, och exakt samma
/// maskerade text gick ut som Maskerat hade gett. Ingen omskrivning startade.
///
/// En etikett som ljuger är värre än ingen etikett: den får någon att skicka
/// något hon annars hade hållit tillbaka.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { medSvenska } from './svenskan.mjs';

const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const rent = server.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
const app = medSvenska(await readFile(new URL('../public/app.js', import.meta.url), 'utf8'));

test('förberedelsen skriver om när Anonymiserat är valt', () => {
  const i = rent.indexOf("if (vag === '/api/forbered')");
  assert.ok(i > 0);
  const block = rent.slice(i, i + 2600);
  assert.match(block, /valt\.behandling === 'anonym'/, 'valet styr ingenting');
  assert.match(block, /await skrivOm\(klar\.maskerad/, 'ingen omskrivning sker');
});

test('omskrivningen går genom serverns maskering igen', () => {
  // Modellen skrev om texten, och en omskrivning kan råka skriva fram ett
  // namn som maskeringen just tagit bort.
  const i = rent.indexOf("valt.behandling === 'anonym'");
  const block = rent.slice(i, i + 1400);
  assert.match(block, /maskeraHart\(vagare/, 'den omskrivna texten maskeras inte om');
  assert.ok(block.indexOf('await skrivOm(') < block.indexOf('maskeraHart(vagare'),
    'maskeringen ska ske EFTER omskrivningen');
});

test('en utebliven anonymisering sägs ut, den tigs inte ihjäl', () => {
  const i = rent.indexOf("valt.behandling === 'anonym'");
  const block = rent.slice(i, i + 1600);
  assert.match(block, /anonymiserad = false/, 'utfallet ska gå att se');
  assert.match(block, /anonymSkal/, 'skälet ska följa med');
  // Och ett fel i omskrivningen får inte fälla frågan — texten är maskerad.
  assert.match(block, /catch \(e\)/, 'ett fel ska fångas');
});

test('grinden visar vad som faktiskt skedde', () => {
  assert.match(app, /f\.anonymiserad/, 'grinden läser inte utfallet');
  assert.match(app, /Inte anonymiserad/, 'en utebliven behandling ska stå i grinden');
  assert.match(app, /anonymrad/, 'raden ska ritas');
});

test('anonymiseringen körs på valet, inte på en destination', () => {
  // Destinationen är borta (2026-09-29). Anonymiserat betyder nu att MAXIMUS
  // ger dig en vagare version att ta med dig — den lokala modellen ser
  // originalet ändå, för den kör här.
  const i = rent.indexOf("valt.behandling === 'anonym'");
  assert.ok(i > 0, 'valet styr ingenting');
  const block = rent.slice(i, i + 160);
  assert.ok(!/destination/.test(block), 'destinationen finns inte längre');
  assert.match(block, /klar\.maskerad/, 'det är den maskerade texten som skrivs om');
});
