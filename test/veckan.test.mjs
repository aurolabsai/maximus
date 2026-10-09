/// Veckan.
///
/// Kalendern visar möten, bevakningen frister, agenten fynd. Tre listor som
/// var för sig är sanna och tillsammans säger ingenting om vad man ska göra
/// på måndag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Veckan from '../lib/veckan.mjs';

const nu = new Date('2026-10-05T08:00:00Z'); // en måndag
const om = d => new Date(+nu + d * 86400000).toISOString();

test('en frist i morgon väger tyngre än ett möte i dag', () => {
  // En plan sorterad på enbart datum sätter ett kaffemöte före en frist.
  const r = Veckan.veckan({
    frister: [{ forfaller: om(1), vad: 'Yttrande till IVO' }],
    handelser: [{ start: om(0), titel: 'Kaffe med Karin' }],
    nu,
  });
  assert.equal(r[0].vad, 'Yttrande till IVO');
  assert.equal(r[0].sort, 'frist');
});

test('brådskan är en egenskap hos dagen, inte hos texten', () => {
  const r = Veckan.veckan({ frister: [
    { forfaller: om(1), vad: 'Nära' },
    { forfaller: om(6), vad: 'Längre bort' },
  ], nu });
  assert.equal(r.find(x => x.vad === 'Nära').vikt, 3);
  assert.equal(r.find(x => x.vad === 'Längre bort').vikt, 1);
});

test('ett möte intill en frist väger tyngre än ett ensamt', () => {
  // Ett möte är inte viktigt i sig. Det blir viktigt när något ska vara
  // klart till det.
  const r = Veckan.veckan({
    frister: [{ forfaller: om(3), vad: 'Svar till leverantören' }],
    handelser: [{ start: om(3), titel: 'Kommunstyrelsen' }, { start: om(6), titel: 'Lunch' }],
    nu,
  });
  const ks = r.find(x => x.vad === 'Kommunstyrelsen');
  const lunch = r.find(x => x.vad === 'Lunch');
  assert.ok(ks.vikt > lunch.vikt, 'mötet intill fristen vägde inte tyngre');
  assert.match(ks.om, /intill en frist/);
});

test('det som passerat ligger inte i veckan', () => {
  const r = Veckan.veckan({ frister: [{ forfaller: om(-3), vad: 'Gick ut i torsdags' }], nu });
  assert.equal(r.length, 0, 'en passerad frist låg kvar i planen');
});

test('veckan är sju dagar, inte fem', () => {
  // En frist som går ut på lördag är fortfarande en frist.
  const r = Veckan.veckan({ frister: [{ forfaller: om(6), vad: 'Lördag' }], nu });
  assert.equal(r.length, 1);
  assert.equal(Veckan.veckan({ frister: [{ forfaller: om(9), vad: 'Nästa vecka' }], nu }).length, 0);
});

test('fem rader, inte tjugo', () => {
  // Det som inte får plats på fem rader var inte veckans viktigaste.
  const manga = Array.from({ length: 20 }, (_, i) => ({ forfaller: om(i % 7), vad: `Frist ${i}` }));
  assert.equal(Veckan.veckan({ frister: manga, nu }).length, Veckan.TAK);
});

test('bara det agenten hittat som MÅSTE ses', () => {
  const r = Veckan.veckan({ fynd: [
    { titel: 'Anbudet kom in', vikt: 3, sett: false, skapad: om(0), varfor: 'Sista anbudet.' },
    { titel: 'Nyhetsbrev', vikt: 2, sett: false, skapad: om(0) },
    { titel: 'Redan läst', vikt: 3, sett: true, skapad: om(0) },
  ], nu });
  assert.equal(r.length, 1);
  assert.equal(r[0].vad, 'Anbudet kom in');
});

test('språket läses, det räknas inte ut', () => {
  // "2026-10-07" räknas ut; "om fyra dagar" läses.
  assert.equal(Veckan.nartext(0, om(0), nu), 'i dag');
  assert.equal(Veckan.nartext(1, om(1), nu), 'i morgon');
  assert.match(Veckan.nartext(3, om(3), nu), /dag$/);
  assert.match(Veckan.nartext(9, om(9), nu), /om 9 dagar/);
});

test('en tom vecka ger inget kort', () => {
  // En app som säger "inga nyheter" varje måndag lär dig att inte titta.
  assert.equal(Veckan.harNagot(Veckan.veckan({ nu })), false);
});

test('veckan räknar, den frågar ingen modell', async () => {
  // En modell som sorterar datum gör det sämre än en jämförelse och dyrare.
  const src = await (await import('node:fs/promises')).readFile(
    new URL('../lib/veckan.mjs', import.meta.url), 'utf8');
  assert.ok(!/svaraLokalt|anropa|fetch\(/.test(src), 'veckan anropar en modell');
});
