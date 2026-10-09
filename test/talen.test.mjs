/// Siffror som pekar ut någon är inga belopp.
///
/// Sett skarpt 2026-09-29. Rutan under svaret sa:
///
///   "2 tal står i svaret men inte i underlaget: 19880614, 3372.
///    Räkna om innan du använder dem."
///
/// Det första är ett födelsedatum i personnummerform. Två fel i ett:
/// kontrollen bad användaren räkna om ett personnummer, vilket är
/// obegripligt — och den skrev ut det i klartext i en ruta som ligger kvar i
/// svaret, i en produkt vars hela uppgift är att sådana siffror inte ska stå
/// framme.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opåkomnaTal } from '../lib/dugerinte.mjs';

test('ett personnummer flaggas aldrig som ett tal att räkna om', () => {
  const svar = 'Ella Nordin, 19850812-2382, har fått klagomål. Beloppet blev 45000 kronor.';
  const ut = opåkomnaTal(svar, 'Inget underlag med siffror.');
  // Båda halvorna av personnumret står i svaret som egna tal.
  assert.ok(!ut.includes('19880614'), `födelsedatumet flaggades: ${ut.join(', ')}`);
  assert.ok(!ut.includes('3372'), `de fyra sista flaggades: ${ut.join(', ')}`);
  // Men beloppet ska fortfarande flaggas — det är kontrollens uppgift.
  assert.ok(ut.includes('45000'), 'beloppet slutade flaggas');
});

test('också utan bindestreck', () => {
  const ut = opåkomnaTal('Numret 198508122382 står i akten. Summan 45000.', 'Inget underlag.');
  assert.ok(!ut.includes('198508122382'));
  assert.ok(ut.includes('45000'));
});

test('organisationsnummer och kontonummer likaså', () => {
  const a = opåkomnaTal('Bolaget 556677-8899 fakturerade 92000 kronor.', 'text');
  assert.ok(!a.includes('556677') && !a.includes('8899'), a.join(', '));
  assert.ok(a.includes('92000'));
});

test('ingen identifierare hamnar i listan som skrivs på skärmen', () => {
  // Rutan skriver ut varje tal i listan ordagrant. Listan är alltså en
  // utskriftslista, och inget som pekar ut någon får stå i den.
  const svar = [
    'Personnummer 19850812-2382 och 19850813-2399.',
    'Organisationsnummer 556677-8899.',
    'Telefon 070-174 06 05.',
    'Summan blev 185137,58 kronor.',
  ].join('\n');
  const ut = opåkomnaTal(svar, 'Inget underlag.');
  const text = ut.join(' ').replace(/\D/g, '');
  for (const id of ['19880614', '3372', '19900101', '1234', '556677', '8899']) {
    assert.ok(!text.includes(id), `${id} skulle ha skrivits ut: ${ut.join(', ')}`);
  }
  assert.ok(ut.includes('185137,58'), 'det riktiga beloppet ska stå kvar');
});

test('de gamla undantagen gäller fortfarande', () => {
  // Årtal är inga belopp.
  assert.deepEqual(opåkomnaTal('Enligt 7 § från 2026 gäller detta.', 'text'), []);
  // SFS-nummer heller — andra halvan ser ut som ett fyrsiffrigt belopp.
  assert.deepEqual(opåkomnaTal('Se lagen 1977:1160 om arbetsmiljö.', 'text'), []);
  // Och ett tal som finns i underlaget är inte påhittat.
  assert.deepEqual(opåkomnaTal('Summan blev 45000 kronor.', 'Fakturan på 45000 kronor.'), []);
});
