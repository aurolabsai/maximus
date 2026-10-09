/// En skadad fil läker inte sig själv.
///
/// Revisionen 2026-09-29 (M4): en oläsbar dagsfil rapporterades som lucka,
/// och efter nästa skrivning var luckan borta — `andraFil` fångade alla
/// läsfel som om filen saknades och la en ny giltig fil ovanpå.
///
/// För en liggare är det den värsta sortens fel. Den som ska kunna säga "de
/// här dagarna går inte att läsa" sa i stället ingenting.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Maximus } from '../lib/maximus.mjs';

const nyMapp = () => mkdtemp(join(tmpdir(), 'maximus-skadad-'));

test('en saknad fil är bara en saknad fil', async () => {
  const d = await nyMapp();
  const v = new Maximus(d);
  await v.ladda();
  await v.andraFil(join(d, 'ny.json'), nu => [...(nu || []), { a: 1 }], { forval: [] });
  assert.deepEqual(JSON.parse(await v.lasFil(join(d, 'ny.json'))), [{ a: 1 }]);
  // Ingenting lades undan — det fanns ingenting att lägga undan.
  assert.equal((await readdir(d)).filter(f => f.includes('skadad')).length, 0);
});

test('en skadad fil läggs undan med sitt datum, inte över', async () => {
  const d = await nyMapp();
  const v = new Maximus(d);
  await v.ladda();
  const vag = join(d, 'dag.json');
  await writeFile(vag, '{ detta är inte json');

  await v.andraFil(vag, nu => [...(nu || []), { ny: true }], { forval: [] });

  // Den nya filen finns och går att läsa.
  assert.deepEqual(JSON.parse(await v.lasFil(vag)), [{ ny: true }]);

  // Och den skadade står kvar, med sitt innehåll orört.
  const undan = (await readdir(d)).filter(f => f.startsWith('dag.json.skadad-'));
  assert.equal(undan.length, 1, 'den skadade filen sparades inte undan');
  assert.match(await readFile(join(d, undan[0]), 'utf8'), /detta är inte json/,
    'beviset skrevs över');
});

test('skadan syns i namnet, så två skador inte skriver över varandra', async () => {
  const d = await nyMapp();
  const v = new Maximus(d);
  await v.ladda();
  const vag = join(d, 'dag.json');
  await writeFile(vag, 'trasig ett');
  await v.andraFil(vag, () => [{ a: 1 }], { forval: [] });
  await writeFile(vag, 'trasig tva');
  await v.andraFil(vag, () => [{ b: 2 }], { forval: [] });
  const undan = (await readdir(d)).filter(f => f.startsWith('dag.json.skadad-'));
  assert.equal(undan.length, 2, `${undan.length} undanlagda, väntade 2`);
});

test('ett krypterat maximus beter sig likadant', async () => {
  const d = await nyMapp();
  const v = new Maximus(d);
  await v.satLosenord('ettlangtlosenord', { kommIhag: false });
  const vag = join(d, 'dag.json');
  // Ett kuvert som inte går att öppna är också en skadad fil.
  await writeFile(vag, Buffer.from('MAXIMUS1\0inte-ett-riktigt-kuvert-alls-men-langt-nog-for-att-passera'));
  await v.andraFil(vag, nu => [...(nu || []), { ny: true }], { forval: [] });
  assert.deepEqual(JSON.parse(await v.lasFil(vag)), [{ ny: true }]);
  assert.equal((await readdir(d)).filter(f => f.startsWith('dag.json.skadad-')).length, 1);
});

// ── Låset vinner över en upplåsning som pågår (2026-10-06) ──────────────
test('en låsning medan en upplåsning räknar: Maximus förblir låst', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maximus-las-'));
  const m = new Maximus(dir);
  await m.satLosenord('provlosen-123', { kommIhag: false });
  m.las_();
  const upp = m.lasUpp('provlosen-123');   // nyckeln härleds, ~300 ms
  m.las_();                                // låst under tiden
  await assert.rejects(upp, /låstes medan/);
  assert.equal(m.upplast, false);
  await m.lasUpp('provlosen-123');         // en ny upplåsning efteråt går
  assert.equal(m.upplast, true);
});
