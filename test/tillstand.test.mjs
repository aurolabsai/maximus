// Tillstånden: en källa för frågan, skälet och vad ett beslut gör.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../lib/tillstand.mjs';

test('tillstånden, i planens ordning', () => {
  // Meddelanden, samtal och mapp sedan 2026-10-04 — utanför första
  // sessionen; de frågas bara när någon väljer dem.
  assert.deepEqual(T.TILLSTAND.map(t => t.id), ['epost', 'kalender', 'anteckningar', 'meddelanden', 'paminnelser', 'samtal', 'mapp', 'telefon']);
  // Påminnelser frågas i första sessionen sedan 2026-10-05; Meddelanden och
  // telefonen sedan 2026-10-06.
  assert.deepEqual(T.lage({}).filter(t => t.forsta).map(t => t.id), ['epost', 'kalender', 'anteckningar', 'meddelanden', 'paminnelser', 'telefon']);
});

test('varje skäl säger vad Maximus aldrig gör', () => {
  assert.match(T.beslut('epost', 'ja', { konto: 'Jobb' }).skal, /skickar aldrig/);
  assert.match(T.beslut('kalender', 'ja').skal, /ändrar aldrig/);
  assert.match(T.beslut('anteckningar', 'ja', { mapp: 'Ärenden' }).skal, /skriver inte/);
  for (const id of ['epost', 'kalender', 'anteckningar']) assert.ok(T.beslut(id, 'nej').skal.length > 10);
});

test('ett ja utan konto eller mapp är inget beslut', () => {
  assert.equal(T.beslut('epost', 'ja', {}).ok, false);
  assert.equal(T.beslut('anteckningar', 'ja', {}).ok, false);
  assert.equal(T.beslut('epost', 'kanske', { konto: 'x' }).ok, false);
  assert.equal(T.beslut('okänt', 'ja').ok, false);
});

test('telefonen: ett ja är en påminnelse via iCloud, ett nej tar bort den', () => {
  const b = T.beslut('telefon', 'ja');
  assert.equal(b.ok, true);
  assert.match(b.skal, /Maximus/);
  const a = T.agentEfter({ kalender: { kalendrar: [] } }, 'telefon', 'ja');
  assert.deepEqual(a.telefon, { kanal: 'paminnelse', till: null });
  assert.ok(a.kalender, 'rör inget annat');
  assert.equal(T.agentEfter(a, 'telefon', 'nej').telefon, undefined);
  assert.equal(T.lage(a).find(t => t.id === 'telefon').pa, true);
});

test('ett beslut rör bara sitt eget fält, och skrivrätt ges aldrig här', () => {
  const fore = { kalender: { kalendrar: [] }, bevakning: true, takt: 30 };
  const a = T.agentEfter(fore, 'anteckningar', 'ja', { mapp: 'Ärenden', konto: 'iCloud' });
  assert.deepEqual(a.kalender, { kalendrar: [] });
  assert.equal(a.bevakning, true);
  assert.equal(a.takt, 30);
  assert.equal(a.anteckningar.skriv, false);
  const b = T.agentEfter(a, 'kalender', 'nej');
  assert.equal(b.kalender, undefined);
  assert.equal(b.anteckningar.mapp, 'Ärenden');
});

test('läget läses ur inställningen, inte ur loggen', () => {
  const l = T.lage({ epost: { konto: 'Jobb', lada: 'INBOX' } });
  assert.equal(l.find(t => t.id === 'epost').pa, true);
  assert.equal(l.find(t => t.id === 'kalender').pa, false);
});
