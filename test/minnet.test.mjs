// Minnet som val (Fas 10): profilen alltid, tidigare samtal bara på begäran.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as Projekt from '../lib/projekt.mjs';
import * as Profil from '../lib/profil.mjs';

const s = (id, ext = {}) => ({ id, titel: id, turer: [{ fraga: 'f', svar: 's' }], andrad: `2026-10-0${id.length}`, ...ext });

test('tidigare: dina samtal, utom låsta, förseglade, glömda, tomma och samma projekt', () => {
  const nu = s('nu', { projekt: 'p' });
  const alla = [nu, s('a'), s('bb', { las: { styrka: 'last' } }), s('ccc', { forseglad: true }),
    s('dddd', { minne: 'glom' }), s('eeeee', { projekt: 'p' }), { id: 'tom', turer: [] }, s('ffffff')];
  assert.deepEqual(Projekt.tidigare(alla, nu).map(x => x.id), ['ffffff', 'a']);
});

test('ett glömt samtal läses inte heller av projektet', () => {
  const nu = s('nu', { projekt: 'p' });
  assert.deepEqual(Projekt.syskon([nu, s('a', { projekt: 'p', minne: 'glom' }), s('b', { projekt: 'p' })], nu).map(x => x.id), ['b']);
});

test('minnets underlag och kvitto säger varifrån', () => {
  const u = Projekt.underlagUr([{ id: 'x', titel: 'Anbudet', turer: [{ fraga: 'Vad kostar anbudet från Lindqvist?', svar: 'Anbudet är 4 711 000 kronor.' }] }],
    'Vad kostade anbudet?', { rubrik: 'Ur dina tidigare samtal:' });
  assert.match(u.text, /^Ur dina tidigare samtal:/);
  assert.equal(Projekt.kvittot(u, { aktor: 'Minnet' }).aktor, 'Minnet');
  assert.match(Projekt.kvittot(u, { aktor: 'Minnet' }).vad, /läste Anbudet/);
});

test('profilen är könsneutral', () => {
  const t = Profil.somText({ vem: 'Upphandlare', arbetar: 'IT-avtal', vill: 'färre överprövningar' });
  assert.ok(!/\bHon\b|\bhenne\b/.test(t), t);
});

test('profilen står sist i systemblocket, och går in i varje samtal', async () => {
  const lokal = await readFile(new URL('../lib/lokal.mjs', import.meta.url), 'utf8');
  // Språkraden (fas 3) står allra sist, och är tom på svenska.
  assert.match(lokal, /personatext\(persona\)\}\$\{profilblock\(profil\)\}(\$\{sprakrad\([^`]*\)\})?`;/);
  const srv = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(srv, /profil: Profil\.somText\(installningar\.profil\)/);
});
