/// Informationsklassningen på svenska och engelska (fas 3, 2026-10-09).
///
/// Domänlistorna körs alltid båda två: den som skriver engelska i en svensk
/// Maximus ska få samma grind som den som skriver svenska.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { klassa, arvaKlass, NIVAER } from '../lib/klassning.mjs';
import * as S from '../lib/sprakstod.mjs';

const niva = t => klassa(t).niva;

test('svenska fall står kvar', () => {
  assert.equal(niva('Hon har skyddad identitet och bor på skyddat boende.'), 3);
  assert.equal(niva('Brukaren har demens och hemtjänst två gånger om dagen.'), 2);
  assert.equal(niva('Han har dömts för olaga hot.'), 2);
  assert.equal(niva('Vad är skillnaden mellan lex Sarah och lex Maria?'), 2);
  assert.equal(niva('Vår kund vill ha offerten på fredag.'), 1);
  assert.equal(niva('Hur skriver jag en bra rubrik?'), 0);
});

test('svenska ord med å, ä och ö först fångas (Unicode-gränser)', () => {
  assert.equal(niva('ångest och oro sedan i våras'), 2);
  assert.equal(niva('ätstörning hos en elev'), 2);
  assert.equal(niva('åtal väcktes i går'), 2);
});

test('engelska: nivå 3', () => {
  for (const t of [
    'She has a protected identity and lives in a safe house.',
    'He received death threats from her ex-partner.',
    'The case involves domestic violence and a restraining order.',
    'The memo contains classified information about national security.',
    'Suspected human trafficking at the site.',
  ]) assert.equal(niva(t), 3, t);
});

test('engelska: nivå 2', () => {
  for (const t of [
    'My client was diagnosed with dementia last year.',
    'The patient is on sick leave for depression.',
    'Child protective services opened a case about the family.',
    'He is a member of the trade union and active in the shop steward network.',
    'She has a criminal record and is on probation.',
    'I suspect the supplier is involved in fraud.',
    'We paid 14 invoices but nothing was ever delivered.',
    'There is a custody dispute over the four-year-old.',
    'An employee was fired after reporting harassment.',
    'Her SSN is 123-45-6789.',
    'His NI number is AB 12 34 56 C.',
    'We had a personal data breach last week.',
    'She joined the Teamsters last spring.',
  ]) assert.equal(niva(t), 2, t);
});

test('engelska: nivå 1', () => {
  assert.equal(niva('Our client wants the quote by Friday.'), 1);
  assert.equal(niva('The tenant has not paid the rent.'), 1);
});

test('engelskt vardagsspråk klassas inte', () => {
  for (const t of [
    'How do I write a good headline?',
    'Please be patient while the report loads.',
    'We will race to finish the slides.',
    'What is the capital of France?',
    'The meeting is at 10 on Tuesday.',
  ]) assert.equal(niva(t), 0, t);
});

test('arvet: en allmän engelsk fråga går ett steg ned, ett pronomen ärver', () => {
  assert.equal(arvaKlass(0, 2, 'What is the difference between a will and a trust?'), 1);
  assert.equal(arvaKlass(0, 2, 'What happens if she does not open the door?'), 2);
});

test('etiketterna och skälen följer språket', () => {
  S.med('sv', () => {
    assert.equal(klassa('Han har dömts för olaga hot.').etikett, 'Känslig');
    assert.deepEqual(klassa('Han har dömts för olaga hot.').skal, ['lagöverträdelser']);
    assert.equal({ ...NIVAER[3] }.etikett, 'Skyddad');
  });
  S.med('en', () => {
    assert.equal(klassa('He has a criminal record.').etikett, 'Sensitive');
    assert.deepEqual(klassa('He has a criminal record.').skal, ['criminal offenses']);
    assert.equal({ ...NIVAER[3] }.etikett, 'Protected');
  });
});
