import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

/// Migreringen ska skydda allt, inte en lista över vad någon kom ihåg.
///
/// Revisionen 2026-09-28: efter en körd migrera() låg projekt.json,
/// bevakning.json, frister.json, register.json, hjalpfragor.json och
/// liggare/2026-01-01.json kvar som läsbar JSON. Migreringen gick genom fyra
/// utpekade kataloger, och en lista över vad som ska skyddas blir omodern i
/// samma stund någon lägger till en fil.
test('migreringen når allt utom det som uttryckligen ska stå i klartext', async t => {
  const { Maximus, KRYPTERAS_INTE } = await import('../lib/maximus.mjs');

  const kat = await mkdtemp(join(tmpdir(), 'maximus-migrera-'));
  t.after(() => rm(kat, { recursive: true, force: true }));

  // Filer som revisionen hittade i klartext, plus en session i en egen katalog.
  const skall = [
    'projekt.json', 'bevakning.json', 'frister.json',
    'register.json', 'hjalpfragor.json', 'installningar.json',
    'liggare/2026-01-01.json',
    'sessioner/en.json',
    'arkiv/sessioner/gammal.json',
  ];
  for (const rel of skall) {
    await mkdir(join(kat, rel, '..'), { recursive: true });
    await writeFile(join(kat, rel), JSON.stringify({ hemlighet: `KLARTEXT-${rel}` }));
  }
  // Och en som ska lämnas i fred: offentlig författning.
  await mkdir(join(kat, 'lagar'), { recursive: true });
  await writeFile(join(kat, 'lagar', 'sfs.json'), JSON.stringify({ lag: 'offentlig' }));

  const v = new Maximus(kat);
  v.huvudnyckel = randomBytes(32);
  const gjorda = await v.migrera();

  assert.equal(gjorda, skall.length, `${gjorda} filer migrerades, väntade ${skall.length}`);

  for (const rel of skall) {
    const ra = await readFile(join(kat, rel), 'utf8').catch(() => '');
    assert.ok(!ra.includes(`KLARTEXT-${rel}`), `${rel} ligger kvar i klartext`);
    // Och innehållet ska gå att få tillbaka.
    const igen = JSON.parse(await v.lasFil(join(kat, rel)));
    assert.equal(igen.hemlighet, `KLARTEXT-${rel}`, `${rel} gick inte att läsa tillbaka`);
  }

  // Lagtexten är offentlig författning, identisk på varje maskin. Att
  // kryptera den kostar arbete vid varje uppslag utan att dölja något.
  const lag = await readFile(join(kat, 'lagar', 'sfs.json'), 'utf8');
  assert.match(lag, /offentlig/, 'lagtexten krypterades i onödan');
  assert.ok(KRYPTERAS_INTE.includes('lagar'), 'undantaget saknas');
});
