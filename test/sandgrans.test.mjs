import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/// Allt som byggs in i nyttolasten ska ha varit i grinden.
///
/// Revisionen 2026-09-28 la det syntetiska namnet "Erik Svensson" i tre fält
/// och såg alla tre nå sändgränsen oförändrade:
///
///   policy          användarens egna regler
///   bilagans namn   "Erik Svensson sjukskrivning.txt"
///   webbunderlag    text hämtad från nätet
///
/// Nyttolastens huvud fanns i skicka(), och skicka() är borttagen.
///
/// Fälten som kom utifrån — policyn, filnamnen, webbunderlaget — maskerades
/// på vägen IN i en sändning. Nu finns ingen sändning: den lokala modellen
/// ser originalet, för den kör här.
///
/// Det som återstår av det skyddet ligger där det fortfarande behövs: i
/// sökfrågan och i verktygsargumenten, som är det enda som lämnar datorn.
/// Se test/sokgrinden.test.mjs och test/natgransen.test.mjs.
test('den utgående nyttolasten finns inte längre', async () => {
  const src = await readFile(new URL('../lib/kedja.mjs', import.meta.url), 'utf8');
  assert.ok(!/export async function skicka\(/.test(src), 'skicka() lever kvar');
  assert.ok(!/const huvud = \[/.test(src), 'nyttolastens huvud lever kvar');
  // Och maskeringen som byggde den finns kvar — den används av det som
  // faktiskt går ut.
  assert.match(src, /export function maskeraHart\(/, 'maskeringen ska finnas kvar');
});

/// Grinden sitter vid transporten, inte vid planeringen.
test('varje sökfråga grindas vid sok(), och varje djupvarv får kartan', async () => {
  const upp = await readFile(new URL('../lib/uppslag.mjs', import.meta.url), 'utf8');
  // Varje sökning går genom sok1(), också de som planerats i ett senare
  // varv. Det är den sista platsen innan frågan lämnar datorn.
  const i = upp.indexOf('const sok1 = async rå =>');
  assert.ok(i > 0, 'hittade inte sökvägen');
  const loop = upp.slice(i, upp.indexOf('const r = await sok(', i));
  assert.match(loop, /grindaSokfraga\(rå/, 'frågan grindas inte precis före sok()');

  // En fråga som bara bestod av dolda uppgifter ska inte ställas alls.
  assert.match(loop, /return;/, 'en tom sökfråga ställs ändå');

  // Och det finns bara EN väg till sok(). Fanns det två kunde den ena sakna
  // grinden, och varv två skulle då grindas svagare än varv ett.
  assert.equal(upp.split('await sok(').length - 1, 1,
    'mer än ett anrop till sok() — grinden måste sitta på varje');

  const djup = await readFile(new URL('../lib/djup.mjs', import.meta.url), 'utf8');
  const varv = djup.slice(djup.indexOf('const r = await slaUpp('), djup.indexOf('varvlogg.push'));
  assert.match(varv, /karta, raknare, sorter/,
    'djupsökningens varv får ingen karta — varv två grindas svagare än varv ett');
});

/// Servern förbereder, inte webbvyn.
///
/// Revisionen 2026-09-28 byggde ett förberett objekt för hand med ett namn i
/// `maskerad` och såg det passera sändgränsen. Servern tog emot maskerad
/// text, en karta och ett kvitto från klienten och litade på alltihop.
///
/// En gräns som den ena sidan kan beskriva åt den andra är ingen gräns.
test('servern förbereder själv och litar inte på klientens objekt', async () => {
  const kalla = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const kod = kalla.replace(/^\s*\/\/.*$/gm, '');

  const start = kod.indexOf('const val = Behandling.vad(');
  assert.ok(start > 0, 'hittade inte sändvägen');
  // Från sändvägens början: maskeraPaBegaran() längre upp bygger också en tur.
  const skicka = kod.slice(start, kod.indexOf('const tur = { id: randomUUID()', start));

  // Klienten får inte avgöra vad som händer med texten.
  assert.ok(!/kropp\.lokalt/.test(skicka), 'klienten avgör fortfarande destinationen');
  assert.ok(!/tolka: kropp\.tolka/.test(skicka),
    'klienten får inte välja bort den lokala modellens hjälp med maskeringen');
  assert.match(skicka, /Behandling\.vad\(valet\(s\)\.behandling\)/,
    'behandlingen ska komma ur sessionen');

  // Objektet får inte tas rakt av.
  assert.ok(!/=\s*kropp\.forberedd;/.test(skicka),
    'servern använder klientens förberedda objekt rakt av');
  assert.match(skicka, /forberedd = await forbered\(original,/,
    'servern förbereder inte själv');
  assert.match(skicka, /s\.karta = forberedd\.karta/,
    'sessionens karta sätts inte från serverns egen förberedelse');
  assert.match(skicka, /redigerad !== forberedd\.maskerad/,
    'en redigering i grinden tappas bort');
});


/// Slutkontrollen körs före VARJE sändning, inte bara den första.
///
/// Det visade sig redan gälla: fraga() granskar vid varje anrop, och båda
/// sändvägarna — ett flerdelat svar och ett enkelt — går genom den. Testet
/// finns för att det ska fortsätta gälla.
test('det som fortfarande lämnar datorn granskas', async () => {
  // Frontier-sändningen granskades före transporten: hittade granskaren ett
  // personnummer i nyttolasten avbröts allt. Den vägen är borttagen.
  //
  // Kvar går två saker ut: sökfrågor och verktygsargument. Båda granskas,
  // och båda fail closed — det som inte går att granska skickas inte.
  const fc = await readFile(new URL('../lib/failclosed.mjs', import.meta.url), 'utf8');
  const i = fc.indexOf('export function grindaArgument(');
  assert.ok(i > 0, 'verktygsargumenten har ingen grind');
  const kropp = fc.slice(i, fc.indexOf('\n}', fc.indexOf('return ut;', i)));
  assert.match(kropp, /const kvar = granska\(/, 'argumenten granskas inte');
  assert.match(kropp, /throw e;/, 'granskningen stoppar inte anropet');

  // Och frontier-modulen ska vara borta, inte bara oanvänd.
  const finns = await readFile(new URL('../lib/frontier.mjs', import.meta.url), 'utf8')
    .then(() => true, () => false);
  assert.equal(finns, false, 'lib/frontier.mjs ligger kvar');
});

