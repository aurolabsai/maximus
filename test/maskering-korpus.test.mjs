// Differentiellt maskeringsprov (2026-10-09, granskningen). En korpus på
// några hundra fall — namn i alla positioner, personnummer, telefon, e-post
// och adresser i varianter, och ofarliga meningar — genom alla fem vägarna.
//
// 1. Ingen väg som ska ta ett känsligt ord släpper det.
// 2. Regressionsvakt: allt som versionen före granskningens rättelser
//    (e4839ae) maskerade maskeras fortfarande, i varje väg (test/korpus/facit.json).
// 3. Ofarliga meningar får inte fler platshållare än förut.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { korpus, vagarFor, star, platshallare, VAGAR } from './korpus/fall.mjs';

const facit = JSON.parse(readFileSync(new URL('./korpus/facit.json', import.meta.url), 'utf8'));
const fall = korpus();
const kor = await vagarFor(new URL('..', import.meta.url).pathname.replace(/\/$/, ''));

test(`korpusen: ${fall.length} fall, och facit täcker dem`, () => {
  assert.ok(fall.length >= 300);
  assert.equal(new Set(fall.map(f => f.text)).size, fall.length, 'dubbletter i korpusen');
  for (const f of fall) assert.ok(facit[f.text], `saknas i facit: ${JSON.stringify(f.text)}`);
});

test('ingen väg släpper ett känsligt ord', () => {
  const fel = [];
  for (const f of fall) for (const v of f.vagar) {
    const ut = kor(f, v);
    const kvar = f.kansliga.filter(o => star(ut, o));
    if (kvar.length) fel.push(`${v}: ${JSON.stringify(f.text)} → ${JSON.stringify(ut)} (${kvar.join(', ')})`);
  }
  assert.deepEqual(fel, []);
});

test('regressionsvakt: det som maskerades förut maskeras fortfarande', () => {
  const fel = [];
  for (const f of fall) for (const v of VAGAR) {
    const ut = kor(f, v);
    const tappade = (facit[f.text]?.[v]?.maskerade || []).filter(o => star(ut, o));
    if (tappade.length) fel.push(`${v}: ${JSON.stringify(f.text)} → ${JSON.stringify(ut)} (${tappade.join(', ')})`);
  }
  assert.deepEqual(fel, []);
});

test('ofarliga meningar får inte fler platshållare än förut', () => {
  const fel = [];
  for (const f of fall.filter(x => x.ofarlig)) for (const v of VAGAR) {
    const ut = kor(f, v);
    if (platshallare(ut) > facit[f.text][v].platshallare) fel.push(`${v}: ${JSON.stringify(f.text)} → ${JSON.stringify(ut)}`);
  }
  assert.deepEqual(fel, []);
});
