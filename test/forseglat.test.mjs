/// En förseglad session lämnar inte ut något, på någon väg.
///
/// Revisionen 2026-09-29 (H7), bevisat: en gammal förseglad session vars
/// karta ligger kvar i det yttre formatet. Vanligt sessions-GET spärrades,
/// men `/api/forbered` saknade motsvarande kontroll. Att skicka sessionens
/// id dit gav 200 och kartoriginalet i svaret — utan koden.
///
/// Felet var inte att någon glömde en rad. Det var att raden måste skrivas
/// för hand på varje väg: en handskriven lista av kontroller bredvid den
/// riktiga strukturen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const rader = kod.split('\n').filter(r => !/^\s*\/\//.test(r));
const rent = rader.join('\n');

test('minSession vägrar en förseglad session som förval', () => {
  const i = rent.indexOf('const minSession =');
  assert.ok(i > 0);
  const kropp = rent.slice(i, rent.indexOf('\n};', i));
  assert.match(kropp, /forseglad = false/, 'förvalet ska vara att neka');
  assert.match(kropp, /!forseglad && stangd\(s\)/,
    'en förseglad session ska inte lämnas ut utan att någon ber om det');
});

test('bara de tre vägar som måste be om stubben gör det', () => {
  // Upplåsningen behöver den — den ska kunna ta emot koden. Delningen och
  // vägarna som bara rör yttre fält har sitt eget besked med rätt
  // felmeddelande, vilket är bättre än ett "finns inte".
  const ber = rader.filter(r => r.includes('minSession(') && r.includes('forseglad: true'));
  assert.equal(ber.length, 3, `${ber.length} vägar ber om stubben:\n${ber.join('\n')}`);
  for (const namn of ['mOppna', 'm3', 'mDela']) {
    assert.ok(rent.includes(`minSession(${namn}[1], jag, { forseglad: true })`),
      `${namn} ska be uttryckligen`);
  }
});

test('forbered och tolka får inte stubben', () => {
  // De två vägar som saknade kontrollen. De ska nu få null och svara 404.
  for (const rutt of ["'/api/forbered'", "'/api/tolka'"]) {
    const i = rent.indexOf(`vag === ${rutt}`);
    assert.ok(i > 0, `${rutt} hittades inte`);
    const block = rent.slice(i, i + 700);
    assert.match(block, /minSession\(kropp\.session, jag\)/, `${rutt} ska gå genom minSession`);
    assert.ok(!block.includes('forseglad: true'), `${rutt} ber om en förseglad stubbe`);
  }
});

test('ingen rutt läser sessionsregistret förbi minSession', () => {
  // Två direkta läsningar är liggarens egna förseglingsfunktioner: de hämtar
  // sessionen just för att kontrollera koden, och släpper ingenting utan
  // den. Allt annat ska gå genom minSession, annars finns kontrollen inte.
  const direkta = rader
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.includes('sessioner.get('));
  assert.ok(direkta.length >= 1, 'minSession måste läsa registret någonstans');
  for (const { r, i } of direkta) {
    const iMinSession = rader.slice(Math.max(0, i - 3), i).some(x => x.includes('const minSession'));
    const runt = rader.slice(Math.max(0, i - 2), i + 8).join('\n');
    const kollarKod = /koder\.(has|get)\(|las\?\.styrka === 'forseglad'/.test(runt);
    assert.ok(iMinSession || kollarKod,
      `rad ${i + 1} läser registret utan att kontrollera kod eller försegling: ${r.trim()}`);
  }
});
