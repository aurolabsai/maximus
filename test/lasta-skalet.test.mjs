/// Ett låst maximus måste fortfarande kunna låsas upp.
///
/// Spärren för ett låst maximus svarade 423 på allt utom två api-vägar — också
/// på `/`, `app.js` och `style.css`. Fönstret fick då JSON i stället för en
/// app, och det fanns ingen ruta att skriva lösenordet i.
///
/// Provet läser serverkoden, för den delen går inte att starta utan ett helt
/// maximus. Det som kontrolleras är listan: skalet ska stå bland det som lämnas
/// ut, och innehållet ska inte.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kod = (await readFile(new URL('../server.mjs', import.meta.url), 'utf8'))
  .split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');

test('skalet lämnas ut även när Maximus är låst', () => {
  const i = kod.indexOf('const utanUpplasning');
  assert.ok(i > 0, 'listan över vad som får passera ett låst maximus ska finnas');
  const block = kod.slice(i, i + 400);
  assert.match(block, /statisk\[vag\]/, 'statiska filer ska passera — annars går Maximus inte att låsa upp');
  assert.match(block, /\/api\/uppstart/, 'uppstart ska passera, annars vet sidan inte att den är låst');
});

test('spärren är en lista över vad som släpps igenom, inte över vad som nekas', () => {
  const i = kod.indexOf('const utanUpplasning');
  const spärr = kod.slice(i, kod.indexOf('\n', kod.indexOf("tx('srv.fel.maximusLast')", i)));
  // Vänd rätt: `!utanUpplasning`. En spärr skriven som en rad undantag med
  // `vag !== …` är samma bugg som redan bitit fem gånger i den här koden.
  assert.match(spärr, /!maximus\.upplast && !utanUpplasning/);
  assert.doesNotMatch(spärr, /vag !== '\/api\//, 'inga handskrivna undantag i villkoret');
});

test('innehållsvägar står inte i listan', () => {
  const i = kod.indexOf('const utanUpplasning');
  const block = kod.slice(i, i + 400);
  for (const v of ['/api/sessioner', '/api/liggare', '/api/installningar', '/api/projekt']) {
    assert.ok(!block.includes(v), `${v} är innehåll och får inte passera ett låst maximus`);
  }
});
