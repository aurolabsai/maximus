/// Nätpolicyn gäller varje anrop från webbläsaren.
///
/// Revisionen 2026-09-29 (M3): `hamta` stoppade en sidas anrop mot
/// 127.0.0.1, men `sok` hade inte samma kontroll — en söksidas javascript
/// nådde en privat adress. Och ett syntetiskt DNS-svar `::ffff:7f00:1`
/// godkändes som publikt, trots att det ÄR 127.0.0.1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tillatenAdress } from '../lib/webb.mjs';

test('IPv4-mappad IPv6 stoppas i varje skrivsätt', async () => {
  // Att räkna upp skrivsätten är fel väg — adressen räknas om till sina
  // fyra byte, och de byten är samma byte hur de än stavades.
  for (const ip of ['::ffff:127.0.0.1', '::ffff:7f00:1', '0:0:0:0:0:ffff:7f00:1',
                    '::ffff:c0a8:1', '::ffff:a00:1', '::ffff:ac10:1', '::1', 'fd00::1', 'fe80::1']) {
    const r = await tillatenAdress(`http://[${ip}]/`);
    assert.equal(r.ok, false, `${ip} släpptes igenom`);
  }
});

test('publika IPv6-adresser släpps', async () => {
  // Ett skydd som stoppar allt används inte.
  for (const ip of ['2001:4860:4860::8888', '::ffff:8.8.8.8']) {
    const r = await tillatenAdress(`http://[${ip}]/`);
    assert.equal(r.ok, true, `${ip} stoppades: ${r.skal}`);
  }
});

test('hakparenteserna hör till URL:en, inte till adressen', async () => {
  const kod = await readFile(new URL('../lib/webb.mjs', import.meta.url), 'utf8');
  // Utan den här raden gick varje IPv6-adress till en DNS-slagning av en
  // sträng som inte är ett namn. Rätt utfall, fel skäl — och en kontroll
  // som aldrig kördes är en kontroll man inte vet något om.
  assert.match(kod, /const vard = u\.hostname\.replace\(/, 'parenteserna städas inte');
  assert.match(kod, /isIP\(vard\)/, 'adressen prövas fortfarande med parenteser');
});

test('söksidan har samma spärr som en hämtad sida', async () => {
  const kod = await readFile(new URL('../lib/webb.mjs', import.meta.url), 'utf8');
  const i = kod.indexOf('export async function sok(');
  const kropp = kod.slice(i, kod.indexOf('export async function', i + 40));
  assert.match(kropp, /sida\.route\('\*\*\/\*'/, 'söksidans anrop prövas inte');
  assert.match(kropp, /tillatenAdress\(url\)/, 'söksidan prövar inte adressen');
  assert.match(kropp, /rutt\.abort\(\)/, 'ett otillåtet anrop stoppas inte');
});

test('file: och interna värdnamn stoppas', async () => {
  for (const a of ['file:///etc/passwd', 'http://localhost/', 'http://x.internal/',
                   'http://y.local/', 'ftp://example.com/']) {
    assert.equal((await tillatenAdress(a)).ok, false, `${a} släpptes`);
  }
});
