/// Löftet på hemskärmen måste vara sant när det visas.
///
/// Raden löd, utan villkor: "Ingen leverantör, ingen kollega, ingen server.
/// Ärendena ligger krypterade på din disk och öppnas bara av dig."
///
/// Men lib/maximus.mjs skrivFil() gör
///
///     const data = k ? forsegla(text, k) : Buffer.from(text, 'utf8');
///
/// — utan huvudnyckel skrivs KLARTEXT. Och huvudnyckeln finns bara om ett
/// lösenord satts. Sett 2026-10-01 på den här maskinen: las.json saknades,
/// och sessionsfilen på disken började med
///
///     {"id":"…","titel":"Ny session","karta":[{"original":"Henrik",
///      "platshallare":"[NAMN A]"},…
///
/// Kartan som avanonymiserar hela samtalet, i klartext.
///
/// Hjälpen sa det rätta hela tiden — "krypterade på disken OM du satt ett
/// lösenord". Hemskärmen sa det utan villkor, och det är hemskärmen man
/// läser. Det är samma regel som gäller överallt annars här: en synlig rad
/// får inte ljuga.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { medSvenska } from './svenskan.mjs';

const app = medSvenska(await readFile(new URL('../public/app.js', import.meta.url), 'utf8'));
const maximus = await readFile(new URL('../lib/maximus.mjs', import.meta.url), 'utf8');

test('klartext utan lösenord är fortfarande hur det fungerar', () => {
  // Går den här sönder är det för att skrivningen ändrats — och då ska
  // rubriken ändras med den, inte tvärtom.
  assert.match(maximus, /const data = k \? forsegla\(text, k\) : Buffer\.from\(text, 'utf8'\);/);
  assert.match(maximus, /get skyddat\(\) \{ return Boolean\(this\.las\?\.kontroll\); \}/);
});

test('löftet är märkt som villkorat', () => {
  const i = app.indexOf("rubrik: 'Ingen annan läser det här.'");
  assert.ok(i > 0, 'raden finns inte längre — flytta provet med den');
  assert.match(app.slice(i, i + 220), /kravLosenord: true/,
    'löftet om krypterad disk är omärkt och visas alltså även utan lösenord');
});

test('utan lösenord visas något annat, och det säger vad man gör', () => {
  assert.match(app, /return r\.kravLosenord && !upp\.maximus\?\.skyddat \? UTAN_LOSENORD\(\) : r;/);
  const i = app.indexOf('const UTAN_LOSENORD');
  const f = app.slice(i, i + 420);
  assert.match(f, /klartext/, 'ersättaren säger inte vad som faktiskt gäller');
  assert.match(f, /lösenord/, 'ersättaren säger inte vad man gör åt det');
});

test('inget annat löfte på hemskärmen påstår kryptering', () => {
  // Fem andra rubriker står kvar och roterar. Ingen av dem får bära samma
  // påstående omärkt.
  const i = app.indexOf('const RUBRIKER');
  const block = app.slice(i, app.indexOf('const UTAN_LOSENORD', i));
  for (const m of block.matchAll(/\{ rubrik:([\s\S]*?)\n  \},/g)) {
    if (!/krypterad/i.test(m[1])) continue;
    assert.match(m[1], /kravLosenord: true/,
      `omärkt krypteringslöfte: ${m[1].slice(0, 60).trim()}`);
  }
});
