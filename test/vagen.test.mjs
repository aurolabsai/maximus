/// En vald väg ut gäller, eller så skickas ingenting.
///
/// Revisionen 2026-09-28 (M6): `prova({vag:'proxy', adress:'invalid'})` gav
/// `proxy: null`, och null betyder direkt väg. Den som satt en proxy för att
/// trafiken inte skulle gå från det egna nätet fick den att göra just det,
/// utan ett fel och utan en rad någonstans.
///
/// Det är den farligaste sortens fel: skyddet finns i inställningarna, syns
/// i gränssnittet, och gäller inte.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { granskaVag, kravDirekt, proxyFor } from '../lib/vag.mjs';

test('en trasig proxy blir ett fel, aldrig direkttrafik', () => {
  for (const val of [
    { vag: 'proxy', adress: 'invalid' },
    { vag: 'proxy', adress: '' },
    { vag: 'proxy' },
    { vag: 'proxy', adress: 'ftp://x:1' },
    { vag: 'hittepa' },
  ]) {
    const r = granskaVag(val);
    assert.equal(r.ok, false, `${JSON.stringify(val)} godkändes`);
    assert.equal(r.proxy, null);
    assert.ok(r.fel && r.fel.length > 10, 'skälet ska gå att läsa');
  }
});

test('direkt är direkt, och en giltig proxy går igenom', () => {
  for (const val of [{}, { vag: 'direkt' }]) {
    const r = granskaVag(val);
    assert.equal(r.ok, true);
    assert.equal(r.proxy, null, 'direkt väg har ingen proxy');
  }
  const p = granskaVag({ vag: 'proxy', adress: 'socks5://10.64.0.1:1080' });
  assert.equal(p.ok, true);
  assert.equal(p.proxy.server, 'socks5://10.64.0.1:1080');
  // Tor har sin egen adress och behöver ingen.
  assert.equal(granskaVag({ vag: 'tor' }).ok, true);
});

test('lösenordet hamnar aldrig i adressen', () => {
  const p = proxyFor({ vag: 'proxy', adress: 'http://anna:hemligt@10.0.0.1:8080' });
  assert.ok(!p.server.includes('hemligt'), 'en adress kan råka loggas');
  assert.ok(!p.server.includes('anna'));
  assert.equal(p.username, 'anna');
  assert.equal(p.password, 'hemligt');
});

test('webbläsaren startas inte när vägen är trasig', async () => {
  const webb = await readFile(new URL('../lib/webb.mjs', import.meta.url), 'utf8');
  const kod = webb.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
  const i = kod.indexOf('const vagval = granskaVag(');
  assert.ok(i > 0, 'ctx() ska pröva vägen');
  const block = kod.slice(i, kod.indexOf('chromium.launch(', i));
  assert.match(block, /if \(!vagval\.ok\)/, 'ett trasigt vägval ska stoppa uppstarten');
  assert.match(block, /throw e;/, 'det ska kasta, inte fortsätta');
  // Och den gamla, tysta vägen ska vara borta.
  assert.ok(!/const proxy = proxyFor\(vagen/.test(kod),
    'proxyFor() direkt i ctx() ger null för en trasig proxy — alltså direkttrafik');
});

test('nyttolasten går inte direkt förbi en vald proxy', async () => {
  // Nodes fetch kan inte gå via proxy i den här byggnaden, och MAXIMUS har ett
  // körtidsberoende. Då är att inte skicka det enda ärliga alternativet.
  assert.throws(() => kravDirekt({ vag: 'proxy', adress: 'socks5://1.2.3.4:1080' }, 'Frågan'),
    /Ingenting skickades/);
  assert.throws(() => kravDirekt({ vag: 'tor' }, 'Frågan'), /Tor/);
  // Direkt väg passerar tyst.
  assert.doesNotThrow(() => kravDirekt({ vag: 'direkt' }));
  assert.doesNotThrow(() => kravDirekt({}));
  assert.doesNotThrow(() => kravDirekt(null));
});

test('den väg som fortfarande går ut prövar sitt vägval', async () => {
  // Frontier-anropet bar nyttolasten och prövade vägen först. Den vägen är
  // borttagen (2026-09-29). Kvar går webbsökningen ut, och den startar inte
  // webbläsaren alls på ett trasigt vägval.
  const webb = await readFile(new URL('../lib/webb.mjs', import.meta.url), 'utf8');
  const kod = webb.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
  const i = kod.indexOf('const vagval = granskaVag(');
  assert.ok(i > 0, 'vägen prövas inte');
  assert.ok(i < kod.indexOf('chromium.launch(', i),
    'vägen ska prövas innan webbläsaren startas');

  // Och frontier-modulen ska vara borta.
  const finns = await readFile(new URL('../lib/frontier.mjs', import.meta.url), 'utf8')
    .then(() => true, () => false);
  assert.equal(finns, false, 'lib/frontier.mjs ligger kvar');
});
