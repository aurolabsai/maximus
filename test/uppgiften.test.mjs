/// MAXIMUS läser vad frågan ber om att FÅ, inte bara hur svaret ska låta.
///
/// Sett skarpt 2026-09-29. Frågan var: "Kanske ska vi vinkla om det från LO
/// till SvDs artikel… de där punktformerna ogillar jag, det är en LI post,
/// inte en rapport." MAXIMUS delade upp den i fyra frågor och svarade på var
/// och en med RÅD om hur man gör: "du bör byta ut punktformerna mot ett mer
/// flytande format."
///
/// Användaren fick sedan skriva: "Bra, langa en fullständig text nu då…"
///
/// Planen blev en plan för modellen själv, lämnad kvar på skärmen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { uppgiften, uppgiftsvink, slutlig } from '../lib/uppgift.mjs';

/// Frågor som ber om något att kopiera.
const BER_OM_TEXT = [
  'Kanske ska vi vinkla om det från LO till SvDs artikel. Och de där punktformerna.. ogillar. det är en LI post, inte en rapport.',
  'Skriv ett mejl till Anna om mötet.',
  'Bra, langa en fullständig text nu då',
  'Korta ner det här till hälften',
  'Formulera ett yttrande till nämnden',
  'Gör om det till ett LinkedIn-inlägg',
  'Vi borde skriva om inledningen',
  'Översätt det till engelska',
];

/// Frågor som ber om ett resonemang, flera med skrivverb i sig.
const BER_OM_RAD = [
  'Hur skriver jag ett bra mejl?',
  'Vad gäller när jag skriver ett beslut?',
  'Vilka regler gäller för tjänsteanteckningar?',
  'Varför blev han skjuten?',
  'vem var c.gambino?',
  'Vad kostar ett bygglov i Malmö?',
  'Kan jag skriva under åt min chef?',
  'Hur kan man formulera ett avslag?',
  'Måste vi skriva en tjänsteanteckning?',
  'Vad säger lagen om orosanmälan?',
];

test('en begäran om en text känns igen', () => {
  const missade = BER_OM_TEXT.filter(f => !uppgiften(f));
  assert.deepEqual(missade, [], `lästes som råd: ${missade.join(' | ')}`);
});

test('en fråga om hur man gör är inte en begäran om en text', () => {
  // Ett utkast man inte bad om är sämre än inget svar — det ser ut som ett
  // svar.
  const falska = BER_OM_RAD.filter(f => uppgiften(f));
  assert.deepEqual(falska, [], `lästes som text: ${falska.join(' | ')}`);
});

test('frågetecknet skiljer en fråga från ett förslag', () => {
  // "Kan jag skriva under?" är en fråga. "Kanske ska vi vinkla om det" är
  // ett förslag om vad som ska göras. Orden är desamma.
  assert.equal(uppgiften('Kan vi skriva om det?'), null);
  assert.ok(uppgiften('Kan vi skriva om det'), 'ett förslag utan tecken är en begäran');
});

test('sorten läses ut när den står i frågan', () => {
  assert.equal(uppgiften('Skriv ett mejl till Anna').sort, 'ett mejl');
  assert.equal(uppgiften('Gör om det till ett LinkedIn-inlägg').sort, 'ett inlägg');
  assert.equal(uppgiften('det är en LI post, skriv om den').sort, 'ett inlägg');
  assert.equal(uppgiften('Formulera ett yttrande').sort, 'ett yttrande');
  // Och står den inte där gissas ingenting.
  assert.equal(uppgiften('Korta ner det här').sort, null);
});

test('citatet räknas inte — det är något man pekar på', () => {
  // Ett citat ur ett tidigare svar innehåller ofta ordet "skriv".
  assert.equal(uppgiften('> Du bör skriva ett mejl till henne\n\nVarför då?'), null);
});

test('vinken ber om texten, inte om råd', () => {
  const v = uppgiftsvink('Gör om det till ett LinkedIn-inlägg');
  assert.match(v, /ett inlägg/);
  assert.match(v, /inte råd om hur man skriver/);
  assert.match(v, /utkastblock/);
  // Och den är tom när frågan inte ber om något att kopiera.
  assert.equal(uppgiftsvink('Vad gäller vid orosanmälan?'), '');
});

test('planen slutar i produkten när frågan bad om en', async () => {
  const kod = await readFile(new URL('../lib/kedja.mjs', import.meta.url), 'utf8');
  const rent = kod.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
  assert.match(rent, /if \(uppgiften\(fraga_\)\) \{/, 'planen slutar inte i något');
  assert.match(rent, /slutlig\(fraga_\)/, 'det sista steget saknar sin instruktion');
  // Delarna ska stå kvar under — de är resonemanget.
  // Rubrikerna står i lib/texter (språkstödet fas 3).
  assert.match(rent, /tx\('lib\.kedja\.fardigaTexten'\)/);
  // Och rubriken ska säga vilken sorts produkt det blev.
  assert.match(rent, /lib\.kedja\.beslutsunderlaget/, 'sista delen heter samma sak oavsett vad som bads om');
});

test('slutinstruktionen säger att delarna är arbete, inte svaret', () => {
  const t = slutlig('skriv om texten');
  assert.match(t, /arbetsmaterial, inte svaret/);
  assert.match(t, /utkast/);
  // Och att texten ska stå för sig själv.
  assert.match(t, /läst delarna/);
});

test('sammanfattningen får inte dra slutsatser', () => {
  const t = slutlig('sammanfatta dokumentet');
  assert.match(t, /arbetsmaterial, inte svaret/);
  assert.match(t.replace(/\s+/g, ' '), /inga slutsatser du dragit själv/i);
  assert.match(t, /motstridiga/, 'att välja mellan motstridiga uppgifter är inte att sammanfatta');
  assert.match(t, /utelämnade/, 'en sammanfattning utan den raden ser ut som att inget saknas');
});

test('beslutsunderlaget rekommenderar ingenting', () => {
  // Det viktigaste förbudet i hela filen. En handläggare som ber om underlag
  // och får en rekommendation har fått något hon inte kan lämna vidare.
  const t = slutlig('ta fram ett beslutsunderlag');
  assert.match(t, /Rekommendera ingenting/);
  assert.match(t, /Beslutet är inte ditt/);
  // Osäkerheten före argumenten: den som läser uppifrån ska se vad som är
  // ovisst innan hon börjar väga.
  assert.ok(t.indexOf('Vad som är osäkert') < t.indexOf('Vad som talar för'),
    'osäkerheten ska stå före argumenten');
  assert.match(t, /jämnlånga/, 'listor som balanseras med påhittade skäl förstör underlaget');
});

test('tre uppgifter, tre olika instruktioner', () => {
  const t = new Set([slutlig('skriv om texten'), slutlig('sammanfatta det'),
    slutlig('vad talar för och emot?')]);
  assert.equal(t.size, 3, 'instruktionerna ska skilja sig åt');
  assert.equal(slutlig('Vad gäller vid orosanmälan?'), '', 'en sakfråga har ingen slutprodukt');
});

test('vägen som finns läser uppgiften', async () => {
  // Det fanns två: en lokal och en ut. Den utgående är borttagen.
  const kod = await readFile(new URL('../lib/kedja.mjs', import.meta.url), 'utf8');
  const rent = kod.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
  assert.match(rent, /uppgiftsvink\(fraga_\)/, 'vägen läser inte uppgiften');
  assert.ok(!/export async function skicka\(/.test(rent), 'den utgående vägen lever kvar');
});
