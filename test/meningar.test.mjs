/// Avskriften som löpande text.
///
/// Whisper klipper vid PAUSER, inte vid meningar, så en diktering blir en rad
/// per andetag. Rätt avskrivet och omöjligt att läsa.
///
/// Det som proven vaktar är inte att det blir snyggt — det är att orden är
/// kvar. Ett transkript är ett vittnesmål, och ett vittnesmål som en modell
/// putsat är inte längre ett vittnesmål.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stycken, klocka, orden, sammaOrd, formatera, lasbar } from '../lib/meningar.mjs';

const RA = `[11:33] Termerna på svenska
[11:34] I gurkenspråket
[11:35] Och vi ska
[11:38] Bygga detta
[11:52] Session 4
[11:53] Där vi då`;

test('fragment fogas till stycken vid långa pauser', () => {
  const s = stycken(RA);
  assert.equal(s.length, 3, JSON.stringify(s));
  assert.equal(s[0].text, 'Termerna på svenska i gurkenspråket och vi ska');
  assert.equal(s[2].text, 'Session 4 där vi då');
});

test('versalen tas bort när fragmentet fortsätter en mening', () => {
  // Whisper gissar på var den hörde en paus, inte på grammatik.
  assert.match(stycken(RA)[0].text, / i gurkenspråket/);
});

test('men förkortningar behåller sina versaler', () => {
  // Ett ensamt versalt I är prepositionen "i" — romerska siffror står inte
  // mitt i en diktering. LAS och MBL gör det.
  const s = stycken('[0:00] det följer av\n[0:01] LAS och\n[0:02] MBL');
  assert.match(s[0].text, /LAS och MBL/);
});

test('inga ord ändras av reglerna', () => {
  const fore = orden(RA.replace(/\[[\d:]+\]/g, ''));
  const efter = orden(stycken(RA).map(s => s.text).join(' '));
  assert.deepEqual(efter, fore);
});

test('tiden skrivs som en klocka', () => {
  assert.equal(klocka(0), '0:00');
  assert.equal(klocka(693), '11:33');
  assert.equal(klocka(3725), '1:02:05');
  assert.equal(klocka(null), '');
});

test('ordjämförelsen ser skillnad på formatering och ändring', () => {
  assert.equal(sammaOrd('och vi ska bygga', 'Och vi ska bygga.'), true);
  assert.equal(sammaOrd('i gurkenspråket', 'i gurkspråket'), false, 'en rättad fackterm är en ändring');
  assert.equal(sammaOrd('det var det det', 'det var det'), false, 'en borttagen upprepning är en ändring');
});

test('en modell som ändrar orden får inte formatera', async () => {
  // Det här är hela granskningen. En modell som ombeds städa en text städar
  // gärna bort ett ord den tycker är överflödigt.
  const r = await formatera('i gurkenspråket och vi ska',
    { svara: async () => 'I gurkspråket, och vi ska.' });
  assert.equal(r.formaterad, false);
  assert.match(r.skal, /ändrade orden/);
  assert.equal(r.text, 'i gurkenspråket och vi ska', 'råtexten ska stå kvar');
});

test('en modell som bara formaterar släpps fram', async () => {
  const r = await formatera('och vi ska bygga detta',
    { svara: async () => 'Och vi ska bygga detta.' });
  assert.equal(r.formaterad, true);
  assert.equal(r.text, 'Och vi ska bygga detta.');
});

test('en modell som tiger eller faller ändrar ingenting', async () => {
  assert.equal((await formatera('x y z', { svara: async () => '' })).formaterad, false);
  const trasig = await formatera('x y z', { svara: async () => { throw new Error('nere'); } });
  assert.equal(trasig.formaterad, false);
  assert.equal(trasig.text, 'x y z');
});

test('slår modellen ihop stycken behålls tiderna', async () => {
  // En tidsstämpel som pekar fel är sämre än ingen. Kommer färre stycken
  // tillbaka än vi skickade vet vi inte längre vad som hör till vad.
  const r = await lasbar(RA, { svara: async () => 'Allt i ett enda stycke nu.' });
  assert.equal(r.formaterade, 0);
  assert.equal(r.stycken, 3);
  assert.match(r.text, /\[11:33\]/);
});

test('utan modell blir det ändå läsbart', async () => {
  const r = await lasbar(RA, { svara: null });
  assert.equal(r.stycken, 3);
  assert.equal(r.formaterade, 0);
  assert.match(r.text, /^\[11:33\] Termerna/);
  // Tre stycken med tom rad emellan, inte sex rader.
  assert.equal(r.text.split(/\n{2,}/).length, 3);
});

test('tom avskrift ger tom text, inte ett fel', async () => {
  assert.equal((await lasbar('', { svara: null })).stycken, 0);
});
