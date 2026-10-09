/// Parningen mot webbläsartillägget.
///
/// Tillägget kommer utifrån alla appens vanliga lås: det kan inte känna till
/// startnyckeln, och dess anrop är cross-site. Det behöver en egen väg in —
/// och en egen väg in är en ny yta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Maximus } from '../lib/maximus.mjs';
import { nyKod, stammer, kod, forNya, gilltig, noteraParning } from '../lib/tillagg.mjs';

async function bo() {
  const d = await mkdtemp(join(tmpdir(), 'maximus-tillagg-'));
  const v = new Maximus(d);
  await v.ladda();
  return { d, v };
}

test('koden går att läsa upp i telefon', () => {
  // Den flyttas för hand. Tecken som läses fel när någon skriver av dem —
  // 0/O, 1/I/L — får inte finnas i den.
  for (let i = 0; i < 50; i++) {
    const k = nyKod();
    assert.match(k, /^MAXIMUS-[A-Z2-9]{4}-[A-Z2-9]{4}$/, k);
    assert.ok(!/[01OIL]/.test(k.slice(5)), `${k} har ett tecken som läses fel`);
  }
});

test('två koder är inte samma kod', () => {
  const set = new Set(Array.from({ length: 200 }, nyKod));
  assert.equal(set.size, 200);
});

test('jämförelsen läcker inte hur långt man kom', () => {
  assert.equal(stammer('MAXIMUS-AAAA-BBBB', 'MAXIMUS-AAAA-BBBB'), true);
  assert.equal(stammer('MAXIMUS-AAAA-BBBB', 'MAXIMUS-AAAA-BBBC'), false);
  assert.equal(stammer('MAXIMUS-AAAA-BBBB', 'MAXIMUS-AAAA'), false, 'olika längd är inte lika');
  assert.equal(stammer('', ''), false, 'tomt är aldrig giltigt');
  assert.equal(stammer(null, undefined), false);
});

test('koden skapas en gång och står still', async () => {
  const { d, v } = await bo();
  const a = await kod(v, d);
  const b = await kod(v, d);
  assert.equal(a.kod, b.kod, 'varje anrop får inte ge en ny kod — då parar man aldrig ihop sig');
  assert.equal(a.parad, null);
});

test('en ny kod stänger ute den gamla direkt', async () => {
  const { d, v } = await bo();
  const gammal = (await kod(v, d)).kod;
  assert.equal(await gilltig(v, d, gammal), true);
  const ny = (await forNya(v, d)).kod;
  assert.notEqual(ny, gammal);
  assert.equal(await gilltig(v, d, gammal), false, 'den gamla koden gäller fortfarande');
  assert.equal(await gilltig(v, d, ny), true);
});

test('fel kod, tom kod och ingen kod släpps aldrig in', async () => {
  const { d, v } = await bo();
  await kod(v, d);
  for (const fel of ['', null, undefined, 'MAXIMUS-XXXX-XXXX', 'x'.repeat(200)]) {
    assert.equal(await gilltig(v, d, fel), false, `${fel} släpptes in`);
  }
});

test('utan en skapad kod släpps ingenting in', async () => {
  // Den som aldrig öppnat inställningarna har ingen kod, och då finns ingen
  // väg in för ett tillägg.
  const { d, v } = await bo();
  assert.equal(await gilltig(v, d, 'MAXIMUS-AAAA-BBBB'), false);
});

test('parningen noteras utan att ändra koden', async () => {
  const { d, v } = await bo();
  const k = (await kod(v, d)).kod;
  await noteraParning(v, d);
  const efter = await kod(v, d);
  assert.equal(efter.kod, k);
  assert.ok(efter.parad, 'det ska gå att se att någon parat ihop sig');
  assert.equal(await gilltig(v, d, k), true);
});

test('vägen kan en sak, och det står i serverkoden', async () => {
  // En parkod på avvägar ska inte kunna bli en läsrättighet till någons
  // ärenden. Provet vaktar att tilläggsvägen inte växer.
  const { readFile } = await import('node:fs/promises');
  const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const i = server.indexOf("vag.startsWith('/api/tillagg/')");
  assert.ok(i > 0, 'hittade inte tilläggsvägen');
  // Snittet slutar där tilläggsblocket slutar, inte vid nästa kontroll —
  // mellan dem har det hunnit komma in annat, och ett prov som läser
  // grannens kod faller på grannens ändringar.
  const slut = server.indexOf("return json(res, 404, { error: tx('srv.fel.okandVag') });", i);
  assert.ok(slut > i, 'tilläggsblocket slutar inte som det ska');
  const block = server.slice(i, slut);
  const vagar = [...block.matchAll(/vag === '(\/api\/tillagg\/[a-z]+)'/g)].map(m => m[1]);
  assert.deepEqual(vagar.sort(), ['/api/tillagg/maskera', '/api/tillagg/para'],
    'tilläggsvägen har fått fler vägar — varje ny är en ny yta utanför appens lås');
  assert.ok(!/sessioner|liggare|skicka/.test(block),
    'tilläggsvägen rör något den inte ska röra');
});
