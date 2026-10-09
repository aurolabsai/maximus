import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaUr, nastaTid, somText, filterUr, passar, filterText } from '../lib/schema.mjs';

test('schemat ur egna ord', () => {
  assert.deepEqual(schemaUr('kolla inkorgen mån-fre, 2 ggr om dagen 8:00 och 15:00'), { dagar: [1, 2, 3, 4, 5], tider: ['08:00', '15:00'] });
  assert.deepEqual(schemaUr('vardagar 8 och 15'), { dagar: [1, 2, 3, 4, 5], tider: ['08:00', '15:00'] });
  assert.deepEqual(schemaUr('varje måndag kl 9'), { dagar: [1], tider: ['09:00'] });
  assert.deepEqual(schemaUr('varje morgon'), { dagar: [1, 2, 3, 4, 5, 6, 7], tider: ['08:00'] });
  assert.equal(schemaUr('håll koll på inkorgen'), null);
  assert.equal(somText({ dagar: [1, 2, 3, 4, 5], tider: ['08:00', '15:00'] }), 'vardagar 08:00 och 15:00');
});

test('nästa tillfälle', () => {
  const s = { dagar: [1, 2, 3, 4, 5], tider: ['08:00', '15:00'] };
  // Söndag 4 oktober 21:00 → måndag 5 oktober 08:00.
  let n = nastaTid(s, new Date('2026-10-04T21:00:00'));
  assert.equal(n.getDate(), 5); assert.equal(n.getHours(), 8);
  // Måndag 10:00 → måndag 15:00.
  n = nastaTid(s, new Date('2026-10-05T10:00:00'));
  assert.equal(n.getDate(), 5); assert.equal(n.getHours(), 15);
  // Fredag 16:00 → måndag 08:00.
  n = nastaTid(s, new Date('2026-10-09T16:00:00'));
  assert.equal(n.getDate(), 12); assert.equal(n.getHours(), 8);
});

test('filtret: avsändare och ämne', () => {
  const f = filterUr('bara mejl från @kommun.example och henrik.lindgren@kommun.example med ämnet innehåller "upphandling"');
  assert.deepEqual(f.fran, ['henrik.lindgren@kommun.example', '@kommun.example']);
  assert.deepEqual(f.amne, ['upphandling']);
  assert.ok(passar({ fran: 'Henrik <henrik.lindgren@kommun.example>', titel: 'Upphandling av AI' }, f));
  assert.ok(!passar({ fran: 'news@alphasignal.ai', titel: 'Upphandling' }, f));
  assert.ok(!passar({ fran: 'x@kommun.example', titel: 'Lunch' }, f));
  assert.ok(passar({ fran: 'vem som helst', titel: 'vad som helst' }, null));
  assert.equal(filterText(f), 'från henrik.lindgren@kommun.example eller @kommun.example · ämnet innehåller "upphandling"');
  assert.equal(filterUr('håll koll på AI-nyheter'), null);
});
