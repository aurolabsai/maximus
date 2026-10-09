/// Kartan skrivs tillbaka i VARJE gren som söker.
///
/// Revisionen 2026-09-29 (M6): djupsökningen anropade
/// `synka(sokkarta, sokraknare)` i en gren där variablerna inte fanns, och
/// kraschade med `sokkarta is not defined` — efter att sökningen var gjord,
/// så hela det dyra arbetet gick förlorat på sista raden.
///
/// Orsaken var att kartan skapades inne i den ena grenen medan anropet
/// hamnade i den andra: två ställen som ska hållas i takt, och bara det ena
/// uppdaterat. Nionde gången samma buggform i den här koden.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const rent = kod.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');

test('kartan skapas en gång, ovanför båda grenarna', () => {
  assert.equal((rent.match(/const sokkarta = new Map\(/g) || []).length, 1,
    'två kartor är två kartor som glider isär');
  // Och före båda användningarna.
  const def = rent.indexOf('const sokkarta = new Map(');
  assert.ok(def > 0);
  for (const m of rent.matchAll(/karta: sokkarta/g)) {
    assert.ok(m.index > def, 'kartan används före den finns');
  }
});

test('båda sökgrenarna skriver tillbaka', () => {
  const anrop = (rent.match(/synka\(sokkarta, sokraknare\)/g) || []).length;
  assert.equal(anrop, 2, `${anrop} grenar synkar, väntade 2 (djup och vanlig)`);
});

test('maskeringen inför webbarbetet sparar sin karta', () => {
  // `utat()` maskerar frågan när sessionen står på Original. De nya
  // platshållarna hör till samtalet — annars får samma person en bokstav i
  // sökrutan och en annan i svaret.
  const i = rent.indexOf('const utat = async ()');
  const kropp = rent.slice(i, rent.indexOf('\n          };', i));
  assert.match(kropp, /synka\(m\.karta, m\.raknare\)/,
    'den maskerade frågans karta kastas');
});

test('inget anrop till synka med odefinierade variabler', () => {
  // Varje namn som skickas till synka() ska finnas i filen som en
  // deklaration. Det här hade fångat kraschen.
  for (const m of rent.matchAll(/synka\((\w+)[,)]/g)) {
    const namn = m[1];
    assert.ok(new RegExp(`(?:const|let|var)\\s+${namn}\\b`).test(rent)
      || new RegExp(`\\b${namn}\\s*=`).test(rent.slice(0, m.index)),
      `synka(${namn}) — ${namn} deklareras aldrig`);
  }
});
