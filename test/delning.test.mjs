import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/// Avsändaren och datumet ska gå att lita på.
///
/// De står utanför kuvertet med flit: den som fått en fil ska kunna se
/// varifrån den kommer innan hon skriver in en kod. Men utanför betyder också
/// oskyddat. Revisionen 2026-09-28 ändrade avsändaren till "Förfalskad
/// avsändare" och datumet till 1900-01-01, och filen öppnades utan invändning
/// med rätt kod.
test('en ändrad avsändare upptäcks vid uppackning', async () => {
  const Dela = await import('../lib/dela.mjs');
  const KOD = 'korg-vante-spis-ljus';

  const paket = await Dela.paketera(
    { id: 's1', titel: 'Ett ärende', turer: [{ fraga: 'x', svar: 'y' }] },
    KOD, { fran: 'Anna Berg' });

  // Oförändrad går den att öppna, och avsändaren kommer med.
  const ok = await Dela.packaUpp(paket, KOD);
  assert.equal(ok.fran, 'Anna Berg');
  assert.equal(ok.session.titel, 'Ett ärende');
  // Den inre kopian ska inte läcka ut som ett vanligt fält.
  assert.ok(!('_fran' in ok.session), 'den inre kopian syns i innehållet');

  // Förfalskad avsändare: filen öppnas inte.
  const h = JSON.parse(String(paket));
  const forfalskad = Buffer.from(JSON.stringify({ ...h, fran: 'Förfalskad avsändare' }), 'utf8');
  await assert.rejects(() => Dela.packaUpp(forfalskad, KOD), /ändrats/,
    'en förfalskad avsändare accepterades');

  // Förfalskat datum likaså.
  const bakdaterad = Buffer.from(JSON.stringify({ ...h, skapad: '1900-01-01T00:00:00.000Z' }), 'utf8');
  await assert.rejects(() => Dela.packaUpp(bakdaterad, KOD), /ändrats/,
    'ett förfalskat datum accepterades');

  // Och fel kod är fortfarande fel kod, inte "ändrad fil".
  await assert.rejects(() => Dela.packaUpp(paket, 'fel-kod-helt-annan'), /Fel kod/);
});

/// Titeln får inte resa i filnamnet.
///
/// Den ligger inuti kuvertet med flit — en rubrik är också innehåll. Men
/// nedladdningsnamnet härleddes ur den, och ett filnamn syns i mappen, i
/// mejlets bilagelista, i transportens metadata och i mottagarens
/// säkerhetskopia. Hela poängen med att kryptera titeln försvann i sista
/// steget.
test('delningens filnamn röjer inte titeln', async () => {
  const src = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  // Fönstret måste rymma hela rutten. Det stod 1600 tecken och nådde inte
  // fram — raden ligger 1717 in, efter kommentaren som förklarar varför.
  const i = src.indexOf('const mDela =');
  const rutt = src.slice(i, src.indexOf('\n    }', i));
  assert.ok(!/namn: `\$\{\(s\.titel/.test(rutt), 'filnamnet härleds fortfarande ur titeln');
  assert.match(rutt, /const namn = `maximus-/, 'filnamnet följer inte det neutrala mönstret');
  // Samma namn på disken (delningsmappen) som i svaret — inget annat.
  assert.match(rutt, /join\(delningsmapp\(\), namn\)/);
});
