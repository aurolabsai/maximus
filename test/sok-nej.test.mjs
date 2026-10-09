/// Ett nej i frågan stoppar det enda som lämnar datorn.
///
/// MAXIMUS:s löfte har ett undantag, och det är webbsök. Allt annat stannar.
/// Står det i frågan att ingenting ska slås upp är det därför inte en
/// preferens — det är ett besked om vad som får gå ut.
///
/// Sett skarpt 2026-10-01: ett påhittat scenario matades in med uttrycklig
/// instruktion att INTE söka, och MAXIMUS sökte ändå. Det fanns en regel för
/// "sök upp det här" men ingen för motsatsen; det enda som fanns var en
/// strömbrytare i en meny. Att svara "du kunde ju stängt av webben" på
/// någon som redan skrivit att det inte ska sökas är att be användaren
/// upprepa sig för att få sin vilja igenom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { forbjuderSok, behovsWebb } from '../lib/uppslag.mjs';

const NEJ = [
  'Sök inte på nätet.', 'sök inte', 'googla inte det här', 'slå inte upp något',
  'Svara utan att söka.', 'utan webbsök tack', 'ingen sökning behövs',
  'Du ska inte söka på internet.', 'använd inte webben', 'Inget webbsök.',
  'du får inte googla', 'utan att slå upp något', 'inga sökningar',
  'do not search', 'answer without searching', "don't google this",
];

const JA = [
  'sök upp vad som gäller', 'googla det här åt mig', 'kan du leta mer?',
  'vad gäller vid orosanmälan?', 'sökningen gav inget',
  // Undantaget som bevisar regeln: det här är en begäran om BREDARE sökning.
  'sök inte bara på lagen utan också på förarbetena',
];

test('vägran känns igen', () => {
  for (const t of NEJ) assert.ok(forbjuderSok(t), `missade vägran: ${t}`);
});

test('en begäran om sökning läses inte som en vägran', () => {
  for (const t of JA) assert.ok(!forbjuderSok(t), `falsk vägran: ${t}`);
});

test('vägran går före varje annan regel', () => {
  // BER_OM_SOK, LANK och FARSKT ger alla ja. Vägran står före dem alla.
  const b = behovsWebb('Sök inte. Vad gäller enligt https://riksdagen.se just nu?');
  assert.equal(b.ja, false);
  assert.match(b.varfor, /inte ska slås upp/);
  // Och den gäller även när frågan annars hade gett ett tydligt ja.
  assert.equal(behovsWebb('Googla inte, men vad säger senaste domen?').ja, false);
});

test('skälet syns för användaren', () => {
  // Steget i gränssnittet skriver ut `varfor`. Ett "söker inte" utan skäl
  // går inte att lita på nästa gång.
  assert.equal(behovsWebb('sök inte').varfor, 'du skrev att det inte ska slås upp');
});

test('servern låter nejet gå före strömbrytaren', async () => {
  // Två vägar gick förbi behovsWebb() helt: webben på PÅ, och djupsökning.
  // Det var där nejet tappades bort.
  const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(kod, /const sagtNej = forbjuderSok\(forberedd\.original\);/);
  assert.match(kod, /let sokWebb = kropp\.webb === true && !sagtNej;/,
    'strömbrytaren PÅ går fortfarande förbi nejet');
  // Och den automatiska bedömningen ska inte ens köras när nejet står där.
  assert.match(kod, /if \(sagtNej\) \{[\s\S]{0,400}?\}\s*\n\s*else if \(kropp\.webb === 'auto'/,
    'den automatiska bedömningen körs trots nejet');
});

test('varje väg ut vaktas av sokWebb', async () => {
  // Djupsökningen, den vanliga sökningen och planeringen. Missar en av dem
  // sin vakt går texten ut ändå.
  const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const i = kod.indexOf('const sagtNej = forbjuderSok');
  const block = kod.slice(i, i + 7500);
  for (const anrop of ['Djup.forbered(', 'Djup.djupsok(', 'slaUpp(', 'planeraSok(']) {
    const j = block.indexOf(anrop);
    assert.ok(j > 0, `${anrop} hittades inte`);
    // Närmaste `if` ovanför anropet måste nämna sokWebb.
    const fore = block.slice(0, j);
    const villkor = fore.slice(fore.lastIndexOf('if ('));
    assert.match(villkor, /sokWebb/, `${anrop} vaktas inte av sokWebb`);
  }
});

// Fas 18, 2026-10-04: frågor om ditt eget arbete gick ut på webben för att
// de nämnde "den här veckan" eller "i dag", och svaren byggde på skräp.
test('en fråga om vad DU ska göra slås inte upp — utom om du ber om det', async () => {
  const { behovsWebb } = await import('../lib/uppslag.mjs');
  for (const f of ['Vad borde jag ta tag i först den här veckan?', 'Vad ska jag prioritera i dag?',
    'Hjälp mig planera min vecka', 'Hur ska jag lägga upp nästa vecka?'])
    assert.equal(behovsWebb(f).ja, false, f);
  for (const f of ['Vad är prisbasbeloppet 2027?', 'Vad händer ikväll i Stockholm?',
    'Sök upp vad jag ska prioritera i dag', 'Vad ska jag betala i skatt 2027?'])
    assert.equal(behovsWebb(f).ja, true, f);
});

// ── Engelska (fas 3) ─────────────────────────────────────────────────────
//
// Vägran på engelska stoppar på samma sätt, på vilket språk ytan än står.
test('engelsk vägran känns igen', () => {
  for (const t of [
    "Don't search the web for this.", 'dont search', 'Do not look it up.', 'please do not google this',
    'Never look anything up.', 'no web search please', 'Answer without searching.',
    'without looking it up', 'without using the internet', 'no internet', 'no lookups',
    'offline only', 'Stay offline.', 'Keep it offline.', 'You must not search for this.',
    'you should not use the internet', 'do not use the web', "Don't browse.", 'answer without any web search',
  ]) assert.ok(forbjuderSok(t), `missade vägran: ${t}`);
});

test('en engelsk begäran om sökning läses inte som en vägran', () => {
  for (const t of [
    'search for the latest rules', 'look up the price of a used Volvo', 'can you google this for me?',
    "don't just search the statute, check the case law too", 'what is the current interest rate?',
  ]) assert.ok(!forbjuderSok(t), `falsk vägran: ${t}`);
});

test('engelska frågor väger som svenska', () => {
  assert.equal(behovsWebb("Don't search. What applies according to https://example.gov right now?").ja, false);
  assert.equal(behovsWebb('Can you search for more information about him?').ja, true);
  assert.equal(behovsWebb('What is the latest interest rate?').ja, true);
  assert.equal(behovsWebb("What's happening in Boston tonight?").ja, true);
  assert.equal(behovsWebb('What should I prioritize this week?').ja, false);
  assert.equal(behovsWebb('How does a power of attorney work?').ja, false);
});

test('skälet följer språket', async () => {
  const S = await import('../lib/sprakstod.mjs');
  S.med('en', () => assert.equal(behovsWebb("don't search").varfor, 'you wrote that nothing should be looked up'));
  S.med('sv', () => assert.equal(behovsWebb("don't search").varfor, 'du skrev att det inte ska slås upp'));
});
