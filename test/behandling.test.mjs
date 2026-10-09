/// Behandlingen: vad texten blir.
///
/// Destinationen är borta. MAXIMUS hade en egen väg ut — maskera, skicka till
/// en frontier, återställ namnen i svaret — och den vägen togs bort
/// 2026-09-29: MAXIMUS är grinden, inte röret.
///
/// Kvar är ett löfte utan undantag. Ingenting lämnar datorn. Webbsök är det
/// enda som går ut, det är ett eget val, och varje sökfråga maskeras och
/// bokförs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BEHANDLINGAR, BEH_FORVAL, arBehandling, stall, vad, franGammalt, listor }
  from '../lib/behandling.mjs';

test('tre behandlingar, och ett förval', () => {
  assert.deepEqual(Object.keys(BEHANDLINGAR).sort(), ['anonym', 'maskerad', 'original']);
  assert.ok(BEHANDLINGAR[BEH_FORVAL], 'förvalet ska finnas');
  for (const [id, b] of Object.entries(BEHANDLINGAR)) {
    assert.ok(b.namn && b.om, `${id} saknar namn eller beskrivning`);
  }
});

test('skräp ger förvalet, inte ett undantag', () => {
  for (const x of [null, undefined, '', 'hittepa', 1, {}]) {
    assert.equal(stall(x), BEH_FORVAL);
  }
  assert.equal(arBehandling('maskerad'), true);
  assert.equal(arBehandling('chatgpt'), false, 'destinationen är inte en behandling');
});

test('vad() översätter valet till handling', () => {
  assert.deepEqual(vad('original'),
    { behandling: 'original', lokalt: true, maskera: false, anonymisera: false, tolka: false });
  assert.deepEqual(vad('maskerad'),
    { behandling: 'maskerad', lokalt: true, maskera: true, anonymisera: false, tolka: true });
  assert.deepEqual(vad('anonym'),
    { behandling: 'anonym', lokalt: true, maskera: true, anonymisera: true, tolka: true });
});

test('allt är lokalt nu — det finns ingen annan väg', () => {
  for (const b of Object.keys(BEHANDLINGAR)) {
    assert.equal(vad(b).lokalt, true, `${b} pekar någon annanstans`);
  }
});

test('gamla sessioner landar på vad de betydde', () => {
  // En session som stod på ChatGPT blir Maskerat: det var vad som skickades,
  // och nu är det vad du får att kopiera.
  assert.equal(franGammalt({ destination: 'chatgpt' }), 'maskerad');
  assert.equal(franGammalt({ destination: 'har' }), 'maskerad');
  assert.equal(franGammalt({ destination: 'har', utanMask: true }), 'original');
  // Och ännu äldre, från de tre lägena.
  assert.equal(franGammalt({ lage: 'lokalt' }), 'maskerad');
  assert.equal(franGammalt({ lage: 'lokalt', utanMask: true }), 'original');
  assert.equal(franGammalt({ lage: 'snabb' }), 'maskerad');
  assert.equal(franGammalt({ lage: 'noggrann' }), 'maskerad');
  // En redan satt behandling vinner över allt gammalt.
  assert.equal(franGammalt({ behandling: 'anonym', destination: 'chatgpt' }), 'anonym');
  assert.equal(franGammalt({}), BEH_FORVAL);
  // utanMask gällde bara lokalt, och får inte smitta.
  assert.equal(franGammalt({ lage: 'snabb', utanMask: true }), 'maskerad');
});

test('listan till gränssnittet bär namn och beskrivning', () => {
  const l = listor();
  assert.equal(l.behandlingar.length, 3);
  assert.equal(l.destinationer, undefined, 'destinationen ska vara borta');
  for (const b of l.behandlingar) assert.ok(b.id && b.namn && b.om);
});

test('den utgående vägen finns inte kvar i koden', async () => {
  // En borttagen väg som ligger kvar i filerna är en väg någon kopplar in
  // igen av misstag.
  const kedja = await readFile(new URL('../lib/kedja.mjs', import.meta.url), 'utf8');
  assert.ok(!/export async function skicka\(/.test(kedja), 'skicka() lever kvar');
  assert.ok(!/from '\.\/frontier\.mjs'/.test(kedja), 'frontier importeras fortfarande');

  const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.ok(!/from '\.\/lib\/frontier\.mjs'/.test(server), 'servern importerar frontier');
  assert.ok(!/await skicka\(/.test(server), 'servern anropar fortfarande skicka()');
});
