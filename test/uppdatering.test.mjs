/// Uppdateringskanalen.
///
/// Fanns inte. En app som inte kan uppdatera sig är en engångsprodukt: dagen
/// ett fel hittas går det inte att rätta hos någon som redan installerat.
///
/// Och den är MAXIMUS:s tredje utgående anrop. Proven vaktar att den beter sig
/// som de två andra — går att stänga av, bär inget som pekar ut datorn, och
/// lämnar ett spår också när den misslyckas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jamfor, kolla, plattform, nyttolast } from '../lib/uppdatering.mjs';

test('versioner jämförs som versioner, inte som text', () => {
  assert.ok(jamfor('4.1.0', '4.0.9') > 0);
  assert.ok(jamfor('4.10.0', '4.9.0') > 0, '10 är större än 9, också som text-fälla');
  assert.equal(jamfor('4.0.0', '4.0.0'), 0);
  assert.equal(jamfor('v4.0.0', '4.0.0'), 0, 'ett v framför är samma version');
  assert.ok(jamfor('4.1', '4.0.9') > 0, 'utelämnade siffror är nollor');
});

test('en förhandsversion är äldre än samma version utan suffix', () => {
  // Det är vad suffixet betyder. Utan regeln hade 4.1.0-rc.1 sett nyare ut
  // än 4.1.0 och erbjudit en nedgradering som en uppdatering.
  assert.ok(jamfor('4.1.0', '4.1.0-rc.1') > 0);
  assert.ok(jamfor('4.1.0-rc.2', '4.1.0-rc.1') > 0);
  assert.ok(jamfor('4.1.0-rc.1', '4.0.9') > 0);
});

test('nyttolasten bär versionen och plattformen — inget mer', () => {
  // En kontroll som kan räkna installationer är en kontroll som ringer hem.
  const n = nyttolast('4.0.0', 'darwin-aarch64');
  assert.match(n, /4\.0\.0/);
  assert.match(n, /darwin-aarch64/);
  assert.ok(n.length < 120, 'nyttolasten ska vara så liten att den går att läsa i liggaren');
});

test('plattformsnyckeln följer manifestets stavning', () => {
  assert.equal(plattform({ platform: 'darwin', arch: 'arm64' }), 'darwin-aarch64');
  assert.equal(plattform({ platform: 'win32', arch: 'x64' }), 'windows-x86_64');
  assert.equal(plattform({ platform: 'linux', arch: 'x64' }), 'linux-x86_64');
});

const MANIFEST = {
  version: '4.1.0', notes: 'Rättade maskeringen av samordningsnummer.',
  pub_date: '2026-10-05T09:00:00Z',
  platforms: { 'darwin-aarch64': { url: 'https://aurolabs.ai/maximus/Maximus_4.1.0.dmg', signature: 'abc' } },
};

test('en nyare version hittas, med adress och signaturbesked', async () => {
  const r = await kolla('https://exempel/uppdatering.json',
    { version: '4.0.0', plats: 'darwin-aarch64', hamtaJson: async () => MANIFEST });
  assert.equal(r.nyare, true);
  assert.equal(r.senaste, '4.1.0');
  assert.match(r.url, /\.dmg$/);
  assert.equal(r.signerad, true);
  assert.match(r.om, /samordningsnummer/);
});

test('samma version är ingen uppdatering', async () => {
  const r = await kolla('https://exempel/uppdatering.json',
    { version: '4.1.0', plats: 'darwin-aarch64', hamtaJson: async () => MANIFEST });
  assert.equal(r.nyare, false);
});

test('ingen byggd fil för plattformen är inte samma sak som ingen uppdatering', async () => {
  const r = await kolla('https://exempel/uppdatering.json',
    { version: '4.0.0', plats: 'linux-x86_64', hamtaJson: async () => MANIFEST });
  assert.equal(r.nyare, true, 'versionen finns');
  assert.equal(r.url, null, 'men inte för den här datorn');
  assert.equal(r.signerad, false);
});

test('avstängt betyder att ingenting går ut', async () => {
  let rort = false;
  const r = await kolla('', { version: '4.0.0', hamtaJson: async () => { rort = true; return MANIFEST; } });
  assert.equal(r.av, true);
  assert.equal(rort, false, 'ett anrop gjordes trots att kanalen var av');
});

test('ett misslyckat anrop är också ett anrop och lämnar sitt spår', async () => {
  // Frånvaron av en rad i liggaren ska betyda frånvaro av trafik. Ett
  // misslyckat anrop som inte bokförs gör den regeln osann.
  const r = await kolla('https://exempel/uppdatering.json',
    { version: '4.0.0', hamtaJson: async () => { throw new Error('servern svarade 503'); } });
  assert.match(r.fel, /503/);
  assert.ok(r.skickat, 'nyttolasten ska finnas att bokföra också vid fel');
  assert.equal(r.nyare, undefined);
});

test('ett manifest utan version ger ingen uppdatering', async () => {
  const r = await kolla('https://exempel/uppdatering.json',
    { version: '4.0.0', hamtaJson: async () => ({}) });
  assert.equal(r.nyare, false);
  assert.equal(r.senaste, null);
});
