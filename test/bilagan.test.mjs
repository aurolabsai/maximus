/// En bilaga lämnar aldrig datorn omaskerad.
///
/// Revisionen 2026-09-29 (H1), bevisat vid sändgränsen: lägg till en fil i
/// ett lokalt Original-samtal, byt destination till ChatGPT, och filens
/// originaltext gick ut under etiketten Maskerat.
///
/// Filen sparas med `omaskerad: true` och med RÅTEXTEN i fältet `maskerad`.
/// Serverns bilagemappning skickade bara `namn` och `maskerad` och tappade
/// flaggan, så sändkedjan behandlade råtexten som redan behandlad. Den sista
/// identifierarkontrollen sa noll kvar — den fångar former, inte namn.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { maskeraHart } from '../lib/kedja.mjs';

test('maskeringen är idempotent — därför behövs ingen flagga', () => {
  // Det är den egenskapen hela rättelsen vilar på: kan vi maskera om allt
  // utan att förstöra det som redan är maskerat, finns ingen proveniens att
  // tappa.
  const rå = 'Erik Svensson är kund. Personnummer 19850813-2399.';
  const en = maskeraHart(rå, {});
  const tva = maskeraHart(en.text, { karta: en.karta, raknare: en.raknare });
  assert.equal(en.text, tva.text, 'en andra maskering ändrade texten');
  assert.ok(!en.text.includes('Erik Svensson'));
  assert.ok(!en.text.includes('19900101'));
  // Också utan kartan ska platshållarna stå kvar orörda.
  assert.equal(maskeraHart(en.text, {}).text, en.text);
});

test('den väg som kunde läcka finns inte längre', async () => {
  // H1 krävde en utgående väg: en fil med råtext i fältet `maskerad`, en
  // mappning som tappade flaggan, och en transport som trodde på den.
  //
  // Transporten är borttagen (2026-09-29). Bilagan går nu bara till den
  // lokala modellen, som ändå ser originalet. Det som ligger kvar är
  // egenskapen rättelsen vilade på — maskeringen är idempotent — och den
  // gäller den maskerade versionen användaren kopierar ut.
  const kedja = await readFile(new URL('../lib/kedja.mjs', import.meta.url), 'utf8');
  assert.ok(!/export async function skicka\(/.test(kedja),
    'den utgående vägen lever kvar — då gäller H1 igen');
  const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.ok(!/await skicka\(/.test(server));
});
