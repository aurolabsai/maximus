/// Appens exempel skrivs om efter dig.
///
/// En produkt som bara talar till en marknad är en produkt som bara säljs
/// till den.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Sprak from '../lib/sprak.mjs';

const ai = { vem: 'Ansvarig för AI-införande på ett teknikbolag',
  arbetar: 'Pilotprojekt och verktygsval', vill: 'Tre avdelningar i daglig drift' };

test('de inbyggda är breda, inte en bransch', () => {
  // De ska visa vad FORMEN är, inte peka på ett yrke. Står det
  // "skolskjutsupphandling" i rutan har den som inför AI redan slutat läsa.
  const alla = Sprak.INBYGGDA.uppdrag.map(x => x.text).join(' ').toLowerCase();
  for (const ord of ['skolskjuts', 'kommun', 'handläggare', 'ivo', 'upphandling']) {
    assert.ok(!alla.includes(ord), `de inbyggda exemplen säger "${ord}"`);
  }
  assert.equal(Sprak.INBYGGDA.uppdrag.length, 3);
});

test('prompten förbjuder myndighetssvenska uttryckligen', () => {
  // Utan förbudet faller modellen tillbaka på det den sett mest av.
  const p = Sprak.prompt(ai);
  assert.match(p, /hennes fackord, inte myndighetssvenska/);
  assert.match(p, /AI-införande/);
  assert.match(p, /Tre OLIKA saker/);
});

test('en halv lista blir ingen lista', () => {
  // Ett av tre trasiga exempel ser ut som en bugg i appen. De inbyggda är
  // alltid hela.
  assert.equal(Sprak.las('{"uppdrag":[{"text":"bevaka pilotprojektet","om":"läser post"}]}'), null);
  assert.equal(Sprak.las('jag kan tyvärr inte'), null);
  const bra = Sprak.las(`{"uppdrag":[
    {"text":"bevaka pilotprojektet och säg till när något hotar tidplanen","om":"läser post och kalender"},
    {"text":"säg till när en avdelning slutar logga in","om":"följer användningen"},
    {"text":"https://ai.gov — bevaka regleringen","om":"hämtar sidan"}]}`);
  assert.equal(bra.uppdrag.length, 3);
});

test('utan profil skrivs ingenting om', () => {
  // En modell som ombeds skriva personligt utan att veta om vem skriver
  // generiskt — bara längre.
  assert.equal(Sprak.garAttSkriva(null), false);
  assert.equal(Sprak.garAttSkriva({ vill: 'något' }), false);
  assert.equal(Sprak.garAttSkriva(ai), true);
});

test('faller tillbaka på de inbyggda, aldrig på tomt', () => {
  // En tom ruta är värre än en ruta som talar till fel person.
  assert.equal(Sprak.galler(null), Sprak.INBYGGDA);
  assert.equal(Sprak.galler({ uppdrag: [] }), Sprak.INBYGGDA);
  const mina = { uppdrag: [{ text: 'a'.repeat(20), om: 'x' }, { text: 'b'.repeat(20), om: 'y' }, { text: 'c'.repeat(20), om: 'z' }] };
  assert.equal(Sprak.galler(mina), mina);
});

test('text och om klipps', () => {
  const d = Sprak.las(JSON.stringify({ uppdrag: Array.from({ length: 3 }, (_, i) =>
    ({ text: `${i}`.padEnd(400, 'x'), om: 'o'.repeat(200) })) }));
  assert.ok(d.uppdrag[0].text.length <= 160);
  assert.ok(d.uppdrag[0].om.length <= 60);
});
