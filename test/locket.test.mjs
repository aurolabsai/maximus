/// Locket: att koden öppnar, att fel kod räknas, och att den svaga vägen
/// rivs innan en miljon gissningar hinner bli en kväll.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { satt, oppna, las, lage, tabort, granskaKod, stadaSvar, FORSOK } from '../lib/locket.mjs';

const nyMapp = () => mkdtemp(join(tmpdir(), 'maximus-locket-'));

test('koden öppnar kuvertet och ger tillbaka samma huvudnyckel', async () => {
  const d = await nyMapp();
  const nyckel = randomBytes(32);
  await satt(d, nyckel, { kod: '481629' });
  const ut = await oppna(d, { kod: '481629' });
  assert.equal(ut.length, 32, 'nyckeln ska vara 32 byte');
  assert.ok(ut.equals(nyckel), 'samma nyckel som lades in');
});

test('fel kod ger inte nyckeln, och räknas', async () => {
  const d = await nyMapp();
  await satt(d, randomBytes(32), { kod: '481629' });
  await assert.rejects(() => oppna(d, { kod: '000001' }), /Fel kod/);
  assert.equal(lage(await las(d)).forsokKvar, FORSOK - 1);
  // Rätt kod nollställer räknaren — gårdagens felskrivning ska inte straffa.
  await oppna(d, { kod: '481629' });
  assert.equal(lage(await las(d)).forsokKvar, FORSOK);
});

test('tio fel river kodvägen — Maximus finns kvar, koden gör det inte', async () => {
  const d = await nyMapp();
  const nyckel = randomBytes(32);
  await satt(d, nyckel, { kod: '481629' });
  for (let i = 0; i < FORSOK; i++) {
    await assert.rejects(() => oppna(d, { kod: '000001' }));
  }
  // Kuvertet ska vara borta ur filen, inte bara flaggat.
  const rad = JSON.parse(await readFile(join(d, 'locket.json'), 'utf8'));
  assert.equal(rad.kuvert, undefined, 'kuvertet ska vara raderat');
  assert.equal(rad.salt, undefined, 'saltet ska vara raderat');
  // Och rätt kod hjälper inte längre. Det är hela poängen.
  await assert.rejects(() => oppna(d, { kod: '481629' }), /lösenordet/);
});

test('återställningssvaret öppnar samma nyckel — ingen genväg, en annan väg', async () => {
  const d = await nyMapp();
  const nyckel = randomBytes(32);
  await satt(d, nyckel, { kod: '481629', fraga: 'Första husdjuret?', svar: 'Fido' });
  // Städat: skrivs annorlunda i september än i maj.
  const ut = await oppna(d, { svar: '  FIDO  ' });
  assert.ok(ut.equals(nyckel));
  // Svarets räknare är sin egen — fel svar ska inte bränna kodförsök.
  await assert.rejects(() => oppna(d, { svar: 'Misse' }));
  const l = lage(await las(d));
  assert.equal(l.forsokKvar, FORSOK, 'kodvägen orörd');
  assert.equal(l.svarForsokKvar, FORSOK - 1, 'svarsvägen räknad');
});

test('läget avslöjar aldrig kuvert eller salt', async () => {
  const d = await nyMapp();
  await satt(d, randomBytes(32), { kod: '481629', fraga: 'Husdjur?', svar: 'Fido', efter: 15 });
  const l = lage(await las(d));
  const text = JSON.stringify(l);
  assert.ok(!('kuvert' in l) && !('salt' in l) && !('svarkuvert' in l) && !('svarsalt' in l));
  assert.ok(!text.includes('svarsalt'));
  assert.equal(l.fraga, 'Husdjur?');
  assert.equal(l.harSvar, true);
  assert.equal(l.efter, 15);
});

test('koden är sex siffror, och inte sex likadana', () => {
  assert.equal(granskaKod('481629').ok, true);
  assert.equal(granskaKod('48162').ok, false, 'fem siffror');
  assert.equal(granskaKod('4816290').ok, false, 'sju siffror');
  assert.equal(granskaKod('48162a').ok, false, 'bokstav');
  assert.equal(granskaKod('111111').ok, false);
  assert.equal(granskaKod('123456').ok, false);
  assert.equal(granskaKod('654321').ok, false);
  assert.equal(granskaKod('').ok, false);
  assert.equal(granskaKod(null).ok, false);
});

test('ett manipulerat kuvert öppnas inte — GCM fångar ändringen', async () => {
  const d = await nyMapp();
  await satt(d, randomBytes(32), { kod: '481629' });
  const f = join(d, 'locket.json');
  const rad = JSON.parse(await readFile(f, 'utf8'));
  const b = Buffer.from(rad.kuvert, 'base64');
  b[b.length - 1] ^= 0xff;
  rad.kuvert = b.toString('base64');
  await writeFile(f, JSON.stringify(rad));
  await assert.rejects(() => oppna(d, { kod: '481629' }), /Fel kod/);
});

test('ett lock kräver ett upplåst maximus', async () => {
  const d = await nyMapp();
  await assert.rejects(() => satt(d, null, { kod: '481629' }), /upplåst/);
  await assert.rejects(() => satt(d, randomBytes(16), { kod: '481629' }), /upplåst/);
});

test('borttaget lock är borta', async () => {
  const d = await nyMapp();
  await satt(d, randomBytes(32), { kod: '481629' });
  await tabort(d);
  assert.equal(await las(d), null);
  assert.equal(lage(await las(d)).pa, false);
  await assert.rejects(() => oppna(d, { kod: '481629' }), /Inget lock/);
});

test('stadaSvar gör samma sak av samma svar', () => {
  assert.equal(stadaSvar('  Fido '), 'fido');
  assert.equal(stadaSvar('Lilla   Fido'), 'lilla fido');
  assert.equal(stadaSvar(null), '');
});

test('fyra samtidiga felgissningar räknas som fyra', async () => {
  // Revisionen 2026-09-29 (H4): läs–ändra–skriv utan lås är inget lås. Fyra
  // parallella anrop gav lagrad räknare 1, inte 4 — alla fyra läste samma
  // fil innan någon hann skriva. Då är tiogränsen en gräns man går runt
  // genom att fråga fler gånger samtidigt.
  const d = await nyMapp();
  await satt(d, randomBytes(32), { kod: '481629' });
  await Promise.allSettled([1, 2, 3, 4].map(() => oppna(d, { kod: '000001' })));
  assert.equal(lage(await las(d)).forsokKvar, FORSOK - 4);
});

test('samtidiga försök river vägen vid tionde, inte efter', async () => {
  const d = await nyMapp();
  await satt(d, randomBytes(32), { kod: '481629' });
  await Promise.allSettled(Array.from({ length: 12 }, () => oppna(d, { kod: '000001' })));
  await assert.rejects(() => oppna(d, { kod: '481629' }), /lösenordet/);
});

test('koden beskrivs som ett bekvämlighetslås, inte som ett kryptoskydd', async () => {
  // Den skyddar mot en människa vid tangentbordet, inte mot en kopierad
  // datamapp: räknaren gäller bara den här processen, och sex siffror är en
  // miljon möjligheter för den som har filen.
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const i = html.indexOf('id="lockruta"');
  const ruta = html.slice(i, html.indexOf('</dialog>', i));
  assert.match(ruta, /kopierad datamapp/, 'rutan ska säga vad koden inte skyddar mot');
  assert.match(ruta, /lösenord/i, 'och vad som gör det i stället');
});
