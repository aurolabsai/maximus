import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rader, avskrift, namn, arMote, DEL_MS } from '../lib/mote.mjs';

test('tiden räknas från mötets början, inte från delens', () => {
  const r = rader('[00:00:04.000 --> 00:00:08.000]  Vi bestämmer budgeten.\n[00:01:10.000 --> 00:01:12.000]  Anna tar det.', 300);
  assert.deepEqual(r.map(x => x.sek), [304, 370]);
  assert.equal(r[1].text, 'Anna tar det.');
});

test('delarna fogas i ordning, också när de kom fel', () => {
  const t = avskrift([
    { nr: 1, fran: 300, text: '[00:00:02.000 --> 00:00:03.000]  Andra delen.' },
    { nr: 0, fran: 0, text: '[00:00:01.000 --> 00:00:02.000]  Första delen.' },
  ]);
  assert.equal(t, '[0:01] Första delen.\n[5:02] Andra delen.');
});

test('rader utan stämpel får delens början', () => {
  assert.deepEqual(rader('Hej\n\nhopp', 60).map(x => x.sek), [60, 60]);
});

test('namnet säger när och hur länge, och känns igen', () => {
  const n = namn('2026-10-05T14:03:00', 3725);
  assert.match(n, /^Mötesanteckningar 2026-10-05 14\.03 \(1:02:05\)\.txt$/);
  assert.ok(arMote(n));
  assert.equal(DEL_MS, 300000);
});
