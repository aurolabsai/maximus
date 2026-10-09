// Obevakade körningar och webbvalet i agentslingan (granskningen 2026-10-09).
// Textprov på servern, som telefonens: villkoren ska stå kvar i koden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const srv = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const kropp = namn => { const i = srv.indexOf(namn); assert.ok(i >= 0, namn); return srv.slice(i, srv.indexOf('\n}\n', i)); };

test('agentslingan är obevakad som förval; bara chattens tur är bevakad', () => {
  assert.match(srv, /async function agentSlinga\(\{[^\n]*obevakad = true[^\n]*\} = \{\}\)/);
  const bevakade = [...srv.matchAll(/obevakad: false/g)];
  assert.equal(bevakade.length, 1, 'bara ett anrop är bevakat');
  const i = bevakade[0].index;
  assert.match(srv.slice(srv.lastIndexOf('agentSlinga({', i), i), /uppgift: forberedd\.original/, 'och det är din tur i chatten');
  assert.match(srv, /assistent: \(fraga, om\) => agentSlinga\(\{[^\n]*obevakad: true/, 'undersökningen av ett fynd');
  assert.match(srv, /Grunden\.skanningsUppgift[^\n]*obevakad: true/, 'Grundens skanning');
  assert.match(srv, /agentSlinga\(\{ session: s\.id, tur: gtur\.id, obevakad: true/, 'första genomgången');
});

test('obevakat: alltid ett förslag, ingen genväg körs, las_sida bara sökträffar', () => {
  const a = kropp('async function agentSlinga');
  assert.match(a, /const sjalv = sp === 'far' && !begransad && !obevakad;/);
  assert.match(a, /if \(sjalv\) \{ await utforHandling\(f\);/);
  assert.equal((a.match(/utforHandling\(/g) || []).length, 1, 'inget annat utförande i slingan');
  assert.match(a, /skapaVerktyg\(ctx, a, \{ obevakad \}\)/);
  assert.match(a, /styrning && !obevakad \? styrverktyg\(\{ text: uppgift \}\)/);
});

test('webben: hämtningen följer samma val som sökningen, och samtalets nej', () => {
  const a = kropp('async function agentSlinga');
  const hamta = a.slice(a.indexOf('webbHamta:'), a.indexOf('hamtaSida('));
  assert.match(hamta, /if \(begransad\) throw/);
  assert.match(hamta, /if \(!webb\) throw/);
  assert.match(hamta, /if \(installningar\.webb === 'av' && !a\.sidor\) throw/);
  const sok = a.slice(a.indexOf('webbSok:'), a.indexOf('vagval('));
  assert.match(sok, /if \(!webb\) throw/);
  assert.match(srv, /obevakad: false, webb: Boolean\(s\.agentsamtal\) \|\| !\(kropp\.webb === false \|\| kropp\.webb === 'av' \|\| s\.webb === 'av'\)/);
});

test('styrverktygen pausar bara när din egen text ber om det', () => {
  const s = kropp('function styrverktyg');
  assert.match(s, /const fattPaus = Handlingar\.begarPaus\(text\);/);
  const p = s.slice(s.indexOf("namn: 'pausa_uppdrag'"));
  assert.match(p.slice(0, p.indexOf('hitta_(namn)')), /if \(!fattPaus\) return tx\('srv\.styr\.ingenPaus'\)/);
});
