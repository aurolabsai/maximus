/// Ett personnamn lämnar aldrig datorn i en sökruta.
///
/// Sett skarpt 2026-09-29. MAXIMUS skickade till Brave:
///
///   Ella Nordin
///   Ella Nordin Solgläntan Norrby
///   Ella Nordin klagomål
///   Leyla Amin Solgläntan Norrby
///
/// och hämtade därefter hitta.se för personen. Namngivna enskilda i ett
/// klagomålsärende, ut i en sökruta, kopplat till den här datorns adress.
///
/// Två fel samtidigt: sökgrinden körde bara mönstren — och mönstren fångar
/// personnummer och telefonnummer, aldrig namn — och planerarens regel om
/// att inte söka på personer hade tagits bort med argumentet att grinden
/// ändå maskerade. Grinden gjorde inte det.
///
/// Båda är lagade. Provet finns för att de ska förbli lagade: det är en rad
/// att ta bort vardera, och båda raderna ser onödiga ut.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { grindaSokfraga } from '../lib/uppslag.mjs';

/// De faktiska frågorna ur liggaren, plus varianter.
const FARLIGA = [
  'Ella Nordin',
  'Ella Nordin Solgläntan Norrby',
  'Ella Nordin klagomål',
  'Leyla Amin Solgläntan Norrby',
  'Erik Svensson arbetsskada',
  'Maria Andersson klagomål',
  'anmälan mot Anna Persson',
  'Lars Johansson hemtjänst beslut',
];

/// Det som måste överleva. Ett skydd som gör sökfunktionen oanvändbar stängs
/// av, och skyddar då ingenting.
const SKA_OVERLEVA = [
  ['vad kostar bygglov i Malmö', /Malmö/],
  ['Skolverket kontaktuppgifter', /Skolverket/],
  ['lex Maria tidsfrist vårdgivare', /lex\s+Maria/i],
  ['Lex Sarah anmälan socialtjänsten', /Lex\s+Sarah/i],
  ['C.Gambino bakgrund karriär', /C\.Gambino/],
  ['Socialstyrelsen föreskrift HSLF-FS', /Socialstyrelsen/],
];

test('inget personnamn går ut i en sökfråga', () => {
  for (const f of FARLIGA) {
    const ut = grindaSokfraga(f, {});
    for (const ord of ['Nordin', 'Elisabeth', 'Fatima', 'Yusuf', 'Svensson', 'Erik',
                       'Andersson', 'Persson', 'Johansson', 'Lars']) {
      assert.ok(!ut.includes(ord), `"${ord}" gick ut i sökfrågan "${ut}" (från "${f}")`);
    }
  }
});

test('och inga hakparenteser heller', () => {
  // En sökruta med [NAMN A] i säger två saker till sökmotorn: att något
  // maskerats, och var.
  for (const f of [...FARLIGA, 'vad gäller för [NAMN A] och [PERSONNUMMER B]']) {
    assert.ok(!grindaSokfraga(f, {}).includes('['), `hakparentes i "${f}"`);
  }
});

test('det som inte pekar ut någon överlever', () => {
  for (const [f, monster] of SKA_OVERLEVA) {
    const ut = grindaSokfraga(f, {});
    assert.match(ut, monster, `"${f}" ströps till "${ut}"`);
  }
});

test('sessionens karta gäller också i sökrutan', () => {
  const karta = new Map([['Erik Svensson', '[NAMN A]']]);
  const ut = grindaSokfraga('Erik Svensson arbetsskada', { karta });
  assert.ok(!ut.includes('Erik') && !ut.includes('Svensson'));
  assert.ok(!ut.includes('[NAMN A]'));
  assert.match(ut, /arbetsskada/);
});

test('personnamnsvakten körs i grinden, inte bara mönstren', async () => {
  // Grinden delas nu med verktygsargumenten: en sökfråga och ett
  // verktygsargument är samma sorts sändning. Två kopior av en gräns hinner
  // bli två olika gränser, och den ena hinner bli den svagare — precis vad
  // som hände när sökrutan fick sin grind och verktygen inte fick någon.
  const upp = await readFile(new URL('../lib/uppslag.mjs', import.meta.url), 'utf8');
  const i = upp.indexOf('export function grindaSokfraga');
  const kropp = upp.slice(i, upp.indexOf('\n}', i));
  assert.match(kropp, /utatGrind\(/, 'sökgrinden ska gå genom den delade grinden');

  const fc = await readFile(new URL('../lib/failclosed.mjs', import.meta.url), 'utf8');
  const j = fc.indexOf('export function utatGrind');
  const delad = fc.slice(j, fc.indexOf('\n}', j));
  assert.match(delad, /maskeraFornamn\(/, 'utan förnamnsvakten fångas inga namn alls');
  assert.match(delad, /maskeraDelar\(/, 'delar av kända namn ska också bort');
  // Mönstren ensamma fångar aldrig ett namn — det var hela felet.
  assert.ok(delad.indexOf('maskera(kant') < delad.indexOf('maskeraFornamn('),
    'mönstren först, namnvakten sedan');
});

test('verktygsargument går genom samma grind som sökrutan', async () => {
  const { grindaArgument } = await import('../lib/failclosed.mjs');
  // Revisionen skickade namn och personnummer oförändrade i en URL-parameter
  // till riksdagens koppling. Argumenten kommer från modellen, inte från den
  // maskerade frågan.
  const ut = grindaArgument({ sok: 'Ella Nordin klagomål', antal: 5,
    djup: { q: 'Leyla Amin Solgläntan' } }, {});
  const text = JSON.stringify(ut);
  for (const ord of ['Elisabeth', 'Nordin', 'Fatima', 'Yusuf']) {
    assert.ok(!text.includes(ord), `${ord} gick ut i ett verktygsargument: ${text}`);
  }
  assert.equal(ut.antal, 5, 'tal ska inte röras');
  assert.ok(!text.includes('['), 'platshållare hör inte hemma i ett argument heller');
  // Och begreppen överlever, precis som i sökrutan.
  assert.match(grindaArgument({ sok: 'arbetsmiljö lex Maria' }, {}).sok, /lex Maria/i);
});

test('plugins grindar argumenten vid transporten', async () => {
  const kod = await readFile(new URL('../lib/plugins.mjs', import.meta.url), 'utf8');
  const i = kod.indexOf('export async function anropa(');
  const kropp = kod.slice(i, kod.indexOf('const inb = inbyggd', i));
  assert.match(kropp, /grindaArgument\(argument/, 'argumenten grindas inte vid anropet');
});

test('planeraren har sin regel kvar som andra lås', async () => {
  const kod = await readFile(new URL('../lib/uppslag.mjs', import.meta.url), 'utf8');
  const i = kod.indexOf('const PLAN = `');
  const plan = kod.slice(i, kod.indexOf('`;', i));
  assert.match(plan, /SÖK ALDRIG PÅ EN PRIVATPERSON/,
    'grinden missar ett efternamn utan känt förnamn — planeraren är andra låset');
  // Och den ska skilja på en privatperson och ett offentligt namn, annars
  // ströps varje fråga om en namngiven person i ett offentligt sammanhang.
  assert.match(plan, /offentligt kända personer/, 'regeln får inte stänga ute allt');
  assert.match(plan, /Är du osäker/, 'tveksamma fall ska falla åt rätt håll');
});

test('webbvägarna får aldrig råtexten, inte ens när frågan stannar här', async () => {
  // I "Stannar här" är forberedd.maskerad null — ingenting skulle skickas,
  // så ingenting maskerades. Men en webbsökning SKICKAS, och varje
  // `forberedd.maskerad || forberedd.original` föll tillbaka på råtexten.
  const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const rent = kod.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');

  assert.match(rent, /const utat = async \(\) => \{/, 'det ska finnas en text som får gå ut');

  // Varje väg som kan lämna datorn ska använda den.
  // Varje förekomst, inte bara den första. Agentens sökning (Fas 30) har
  // ingen utat() — den går genom grindaSokfraga, samma grind.
  for (const anrop of ['avgorWebb(', 'planeraSok(', 'slaUpp(', 'Djup.djupsok(',
                       'Djup.forbered(', 'Kall.valjVerktyg(']) {
    const traffar = [...rent.matchAll(new RegExp(anrop.replace(/[.(]/g, '\\$&'), 'g'))].filter(m => !/(function|import|\{)\s*$/.test(rent.slice(m.index - 20, m.index)));
    assert.ok(traffar.length > 0, `${anrop} hittades inte`);
    for (const m of traffar) {
      const bit = rent.slice(m.index, m.index + 90);
      assert.match(bit, /await utat\(\)|grindaSokfraga\(/, `${anrop} får råtexten i lokalt läge`);
    }
  }

  // Och ingen utåtriktad väg får ha kvar reservfallet.
  const kvar = [...rent.matchAll(/forberedd\.maskerad \|\| forberedd\.original/g)]
    .map(m => rent.slice(Math.max(0, m.index - 60), m.index));
  for (const fore of kvar) {
    assert.match(fore, /Rubrik\./,
      'bara rubriksättningen får råtexten — den går till den lokala modellen');
  }
});
