// Funktionsbeskrivningen: en källa för /help, modellen och hjälpen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FUNKTIONER, KOMMANDON, tabell } from '../lib/funktioner.mjs';
import { JAG } from '../lib/jag.mjs';
import { avsnitten } from '../lib/hjalp.mjs';

const js = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const klient = (() => {
  const i = js.indexOf('const KOMMANDON = {');
  const block = js.slice(i, js.indexOf('\n};\n', i));
  return [...block.matchAll(/^  '(\/[a-zåäö]+)':/gm)].map(m => m[1]);
})();

test('varje rad har vad du skriver, vad som händer och vad det kostar', () => {
  for (const f of FUNKTIONER) {
    assert.ok(f.skriv && f.gor && f.kostar, JSON.stringify(f));
    assert.ok(!/\n/.test(f.gor + f.kostar), 'en rad är en rad');
  }
});

test('kommandona i tabellen är kommandona i appen — åt båda hållen', () => {
  assert.deepEqual([...klient].sort(), [...KOMMANDON].sort());
});

test('/help skriver ut en tabell per grupp, kommandona först, och varje rad finns med', async () => {
  const { GRUPPER } = await import('../lib/funktioner.mjs');
  const t = tabell();
  assert.match(t, /^### Kommandon\n\n\| Du skriver \| Det händer \| Det kostar \|/);
  for (const g of GRUPPER) assert.ok(t.includes(`### ${g}`), g);
  for (const f of FUNKTIONER) assert.ok(GRUPPER.includes(f.grupp), `${f.skriv} saknar grupp`);
  assert.equal(t.split('\n').filter(r => r.startsWith('| ') && !/^\| Du (skriver|gör) \|/.test(r)).length, FUNKTIONER.length);
});

test('modellen läser samma rader — ingen egen lista i systemblocket', () => {
  for (const f of FUNKTIONER) assert.ok(JAG.includes(f.gor), `JAG saknar: ${f.skriv}`);
  assert.ok(!/- Läsa dokument som dras in: PDF, Word, RTF, ODT, bilder\./.test(JAG), 'den gamla handskrivna listan står kvar');
});

test('hjälpen har tabellen som första avsnitt', async () => {
  const a = await avsnitten();
  assert.equal(a[0].rubrik, 'Vad Maximus kan');
  assert.ok(a[0].text.includes(tabell()));
});
