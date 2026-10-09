// Märket: en källa, och varje kopia är samma form (Fas 16).
//
// Det finns i statisk HTML (startskärmen och locket ska synas innan app.js
// laddat), i serverns felsidor och i webbläsartillägget. Kopior som ska
// vara lika är kopior som glider isär — så formen jämförs här.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const las = f => readFile(new URL(`../${f}`, import.meta.url), 'utf8');
const form = s => [...s.matchAll(/class="lab-(?:yttre|inre)" d="([^"]+)"/g)].map(m => m[1]);

test('varje märke är Labyrinten, samma form som marke.svg', async () => {
  const kalla = form(await las('public/marke.svg'));
  assert.equal(kalla.length, 2, 'marke.svg ska ha två ringar');
  for (const f of ['public/index.html', 'public/app.js', 'server.mjs', 'public/favicon.svg',
    'tillagg/panel.html', 'tillagg/installningar.html']) {
    const s = await las(f);
    const kopior = form(s);
    assert.ok(kopior.length >= 2, `${f} saknar märket`);
    for (let i = 0; i < kopior.length; i += 2) assert.deepEqual(kopior.slice(i, i + 2), kalla, `${f}: en annan form`);
    assert.ok(!s.includes('M18 18 32 46 46 18'), `${f}: VALV:s V står kvar`);
  }
});

test('märket är inte en knapp, och bor i öronmärkningen', async () => {
  const html = await las('public/index.html');
  assert.ok(!/id="hem"/.test(html), 'märket i toppraden är fortfarande en knapp');
  // Märket är en knapp sedan 2026-10-04: ett klick lägger Maximus i vila.
  assert.match(html, /<div class="oronmarke" role="button" tabindex="0" aria-label="Vila — dölj allt"/);
});
