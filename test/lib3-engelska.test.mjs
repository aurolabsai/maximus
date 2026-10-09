/// Fas 3 (2026-10-09): de små modulernas texter på engelska, och samma
/// svenska som förut när svenska gäller.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../lib/sprakstod.mjs';
import { natfel } from '../lib/natfel.mjs';
import { lasbart, morgonrad } from '../lib/bevakning.mjs';
import { BEHANDLINGAR } from '../lib/behandling.mjs';
import { granskaKod, SORTNAMN } from '../lib/dela.mjs';
import { drag } from '../lib/nyheter.mjs';
import { kvittot } from '../lib/projekt.mjs';
import { fortsatter, BOLLEN, bollenPrompt } from '../lib/bollen.mjs';
import { arForsegladUtanKod } from '../lib/maximus.mjs';
import { filnamn } from '../lib/artefakt.mjs';

const pa = (kod, fn) => S.med(kod, fn);
const bev = n => ({ traffar: [{ rader: Array(n).fill({}) }], rör: [{ session: 'a' }] });

test('svenskan är som förut', () => pa('sv', () => {
  assert.equal(natfel(new Error('ECONNREFUSED')), 'servern tog inte emot anslutningen');
  assert.equal(lasbart('K6P7'), '6 kap. 7 §');
  assert.equal(lasbart('K3P3a'), '3 kap. 3 a §');
  assert.equal(lasbart('K2'), '2 kap.');
  assert.equal(morgonrad([bev(2)]), 'två saker har hänt i rättskällan sedan sist — det rör ett av dina ärenden.');
  assert.equal(BEHANDLINGAR.maskerad.namn, 'Maskerat');
  assert.equal(SORTNAMN.session, 'ett samtal');
  assert.equal(fortsatter('Skriver klart.'), 'Jag fortsätter: Skriver klart.');
  assert.equal(bollenPrompt(), BOLLEN);
  assert.equal(kvittot({ bitar: [{ titel: 'A' }, { titel: 'B' }], tecken: 9 }).vad, 'läste A och B — 9 tecken följde med frågan');
  assert.equal(filnamn('', 'pdf').startsWith('Utan namn.'), true);
}));

test('engelskan', () => pa('en', () => {
  assert.equal(natfel(new Error('ECONNREFUSED')), 'the server refused the connection');
  assert.equal(lasbart('K6P7'), 'Chapter 6, Section 7');
  assert.equal(morgonrad([bev(1)]), 'one thing has happened in the legal sources since last time — it concerns one of your cases.');
  assert.equal(BEHANDLINGAR.anonym.namn, 'Anonymized');
  assert.equal(JSON.parse(JSON.stringify(BEHANDLINGAR)).maskerad.namn, 'Masked', 'getters följer med i JSON');
  assert.equal(SORTNAMN.bevakning, 'watches');
  assert.match(granskaKod('kort').varfor, /^The code must be at least 12 characters/);
  assert.equal(drag({ spar: [{ nar: '2026-10-09T10:00:00Z', varv: [{ titel: 'X', fynd: 3 }] }] })[0].rad, '3 things to look at');
  assert.equal(kvittot({ bitar: [{ titel: 'A' }, { titel: 'B' }, { titel: 'C' }], tecken: 9 }).vad, 'read A, B and C — 9 characters went along with the question');
  assert.equal(fortsatter('Finishing up.'), 'Continuing: Finishing up.');
  assert.notEqual(bollenPrompt(), BOLLEN);
  assert.match(bollenPrompt(), /in English[\s\S]*"jag"/);
  assert.equal(filnamn('', 'pdf').startsWith('Untitled.'), true);
}));

test('en förseglad session känns igen på koden, inte på språket', () => {
  assert.ok(arForsegladUtanKod(Object.assign(new Error('The session is sealed and requires its code.'), { kod: 'forseglad' })));
  assert.ok(arForsegladUtanKod(new Error('Sessionen är förseglad och kräver sin kod.')));
  assert.ok(!arForsegladUtanKod(new Error('Fel lösenord.')));
});
