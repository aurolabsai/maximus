import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avsikt, las, ics, somText, dagenStar } from '../lib/handelse.mjs';

const nu = new Date('2026-10-04T21:00:00');
const AURO = 'Sätt in möte i kalendern: Möte med Jens på Nordal. Torsdag 15/10 14.30, växjö linnaeus science park. Vidarebefordra till Henrik.lindgren@kommun.example samt sätt påminnelse måndag samma vecka och 1 timme före eventet som mandatory.';

test('ett möte att lägga in känns igen', () => {
  assert.ok(avsikt(AURO));
  assert.ok(avsikt('Boka lunch med Sara på fredag 12.00'));
  assert.ok(!avsikt('Vad står i min kalender på fredag?'));
  assert.ok(!avsikt('Sätt upp en mall för protokoll'));
});

test('dagen måste stå i texten, också som 15/10', () => {
  assert.ok(dagenStar('2026-10-15', 'Torsdag 15/10 14.30', nu));
  assert.ok(!dagenStar('2026-10-16', 'Torsdag 15/10 14.30', nu));
});

test('Auros möte: datumen räknas av koden, adressen måste stå i texten', async () => {
  const svara = async () => JSON.stringify({ titel: 'Möte med Jens på Nordal', datum: '2026-10-15', start: '14.30', slut: '',
    plats: 'Växjö, Linnaeus Science Park', obligatoriskt: true,
    deltagare: [{ namn: 'Henrik Lindgren', epost: 'Henrik.lindgren@kommun.example' }, { namn: 'Jens', epost: 'jens@nordal.example' }],
    paminnelser: [{ typ: 'veckodag', veckodag: 'måndag' }, { typ: 'fore', minuter: 60 }] });
  const h = await las(AURO, { svara, nu });
  assert.equal(new Date(h.start).getDate(), 15);
  assert.equal(new Date(h.start).getHours(), 14);
  assert.equal(new Date(h.start).getMinutes(), 30);
  // Bara Henrik: jens@nordal.example står inte i texten.
  assert.deepEqual(h.deltagare.map(d => d.epost), ['henrik.lindgren@kommun.example']);
  assert.equal(h.obligatoriskt, true);
  const p = h.paminnelser.map(x => new Date(x));
  // Måndag samma vecka = 12 oktober, 09:00. En timme före = torsdag 13:30.
  assert.equal(p[0].getDate(), 12); assert.equal(p[0].getHours(), 9);
  assert.equal(p[1].getDate(), 15); assert.equal(p[1].getHours(), 13); assert.equal(p[1].getMinutes(), 30);
  const t = ics(h, { id: 'x', nu });
  assert.match(t, /DTSTART:20261015T143000/);
  assert.match(t, /ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE;CN=Henrik Lindgren:mailto:henrik\.lindgren@kommun\.example/);
  assert.match(t, /TRIGGER:-PT60M/);
  assert.match(t, /TRIGGER:-PT4650M/);
  assert.match(somText(h, nu), /torsdag 15 oktober, 14:30–15:30/);
});

test('ett datum som inte står i texten blir ingenting', async () => {
  const svara = async () => JSON.stringify({ titel: 'X', datum: '2026-10-16', start: '14:30', deltagare: [], paminnelser: [] });
  assert.equal(await las(AURO, { svara, nu }), null);
});
