import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harDatum, star, las, somText, dit, ics } from '../lib/planen.mjs';

const nu = new Date('2026-10-04T16:00:00');

test('datum hittas av regler', () => {
  assert.ok(harDatum('Session 4 äger rum den 16 oktober.'));
  assert.ok(harDatum('Leverans 2026-11-02'));
  assert.ok(harDatum('Vi ses på fredag'));
  assert.ok(harDatum('Skicka det i morgon'));
  assert.ok(!harDatum('Vi körde tre sessioner med ett arkitektbolag.'));
  assert.ok(!harDatum('Det kostar 16 kronor'));
});

test('ett datum måste stå i texten', () => {
  assert.ok(star('2026-10-16', 'Plan för session 4 (16 oktober)', nu));
  assert.ok(star('2026-10-16', 'den 16:e okt', nu));
  assert.ok(star('2026-10-09', 'Anna skickar offerten på fredag', nu));
  assert.ok(star('2026-10-05', 'gör det i morgon', nu));
  assert.ok(!star('2026-10-17', 'Plan för session 4 (16 oktober)', nu));
  // En fredag om tre veckor är inte "på fredag".
  assert.ok(!star('2026-10-23', 'Anna skickar offerten på fredag', nu));
});

test('modellens planer granskas', async () => {
  const svara = async () => JSON.stringify({ planer: [
    { datum: '2026-10-16', vad: 'Session 4 med arkitektbolaget', forbered: ['Mall för Gherkin'], fragor: ['Vilka deltagare?'] },
    { datum: '2026-10-20', vad: 'Påhittat möte', forbered: [], fragor: [] },
    { datum: '2026-09-01', vad: 'Redan passerat', forbered: [], fragor: [] },
    { datum: '2026-10-16', vad: 'Dubblett', forbered: [], fragor: [] },
  ] });
  const p = await las('Sammanfatta', 'Session 4 genomförs den 16 oktober. Den 1 september var start.', { svara, nu });
  assert.deepEqual(p.map(x => x.datum), ['2026-10-16']);
  assert.equal(p[0].vad, 'Session 4 med arkitektbolaget');
  assert.deepEqual(p[0].fragor, ['Vilka deltagare?']);
});

test('inget datum, inget modellanrop', async () => {
  let anrop = 0;
  const p = await las('Sammanfatta', 'Ett möte utan datum.', { svara: async () => { anrop++; return '{}'; }, nu });
  assert.deepEqual(p, []);
  assert.equal(anrop, 0);
});

test('modellen som inte svarar ger inga planer', async () => {
  assert.deepEqual(await las('x', 'den 16 oktober', { svara: async () => { throw new Error('nere'); }, nu }), []);
  assert.deepEqual(await las('x', 'den 16 oktober', { svara: async () => 'inget json', nu }), []);
});

test('text och avstånd', () => {
  assert.equal(somText('2026-10-16', nu), '16 oktober');
  assert.equal(somText('2027-01-05', nu), '5 januari 2027');
  assert.equal(dit('2026-10-16', nu), 'om 12 dagar');
  assert.equal(dit('2026-10-05', nu), 'i morgon');
});

test('kalenderfilen är en heldagshändelse', () => {
  const t = ics({ id: 'abc', datum: '2026-10-16', vad: 'Session 4, arkitektbolaget' }, nu);
  assert.match(t, /DTSTART;VALUE=DATE:20261016/);
  assert.match(t, /DTEND;VALUE=DATE:20261017/);
  assert.match(t, /SUMMARY:Session 4\\, arkitektbolaget/);
});
