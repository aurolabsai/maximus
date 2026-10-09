import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { raden, skrivet, fore, tidszonen } from '../lib/nu.mjs';

const NU = new Date(2026, 8, 27, 21, 52); // söndag 27 september 2026

test('datumet skrivs som en människa skriver det', () => {
  assert.equal(skrivet(NU), 'söndag 27 september 2026, 21.52');
});

test('klockslaget nollfylls', () => {
  assert.equal(skrivet(new Date(2026, 0, 5, 7, 4)), 'måndag 5 januari 2026, 07.04');
});

test('raden säger åt modellen att lita på datumet framför sitt minne', () => {
  const r = raden({ nu: NU, tidszon: 'Europe/Stockholm' });
  assert.match(r, /söndag 27 september 2026/);
  assert.match(r, /Europe\/Stockholm/);
  // Utan den här meningen väger modellen sitt eget minne mot raden, och sitt
  // eget minne känns säkrare för den.
  assert.match(r, /träningsdata slutar tidigare/);
  assert.match(r, /frister/);
});

test('tidszonen finns och är en zon, inte en adress', () => {
  const z = tidszonen();
  assert.ok(z === null || /^[A-Za-z]+\/[A-Za-z_]+/.test(z), `oväntad zon: ${z}`);
});

test('raden läggs före frågan, aldrig efter', () => {
  const t = fore('Hur lång tid har jag på mig?', { nu: NU, tidszon: null });
  assert.ok(t.startsWith('Just nu är det söndag'));
  assert.ok(t.endsWith('Hur lång tid har jag på mig?'));
});

test('ingen tidszon: raden håller ändå', () => {
  const r = raden({ nu: NU, tidszon: null });
  assert.match(r, /söndag 27 september 2026, 21\.52\. Det är dagens datum/);
  assert.ok(!r.includes('()'));
});

/// Tiden får aldrig hamna i systemraden.
///
/// Systemraden jämförs från tecken ett när modellservern avgör vad som kan
/// återanvändas. En klocka där spräcker KV-cachen vid varje fråga: mätt
/// 2026-09-25 blev det 326 omräknade tokens i stället för 24, och i ett långt
/// samtal är det 76 sekunder i stället för 0,9.
test('systemraden står stilla — tiden följer frågan', async () => {
  const src = await readFile(new URL('../lib/lokal.mjs', import.meta.url), 'utf8');
  const instruktion = /const INSTRUKTION = `[\s\S]*?`;/.exec(src)?.[0];
  assert.ok(instruktion, 'hittade inte INSTRUKTION');
  for (const ord of ['Just nu', 'dagens datum', 'raden(', 'fore(', 'Date('])
    assert.ok(!instruktion.includes(ord), `${ord} ligger i systemraden och spräcker cachen`);

  // Och den ska läggas på frågan.
  assert.match(src, /if \(medTid\) fraga = fore\(fraga\)/);
});

/// MAXIMUS skriver aldrig in orten åt användaren.
///
/// Kommun och stad är en maskeringskategori. "En anställd på gruppboendet" är
/// anonymt; samma mening plus en kommun är det inte. Att MAXIMUS självt la orten
/// i varje utgående fråga vore att gå runt sin egen grind.
test('platsen som lämnar datorn är en tidszon, aldrig en ort', async () => {
  const src = await readFile(new URL('../lib/nu.mjs', import.meta.url), 'utf8');
  const kod = src.replace(/^\/\/\/.*$/gm, '');
  for (const otillatet of ['geolocation', 'CoreLocation', 'CLLocation', 'ipapi', 'ip-api', 'geoip'])
    assert.ok(!kod.includes(otillatet), `${otillatet} hämtar en plats som inte ska lämna datorn`);
  // Tidszonen läses ur en inställning som redan står där — inget tillstånd,
  // ingen adress.
  assert.match(kod, /resolvedOptions\(\)\.timeZone/);
});

/// Kalendern läser och skriver aldrig.
///
/// Samma löfte som inkorgen, och samma sorts granskning: verben ska inte
/// finnas i filen. EventKit kan spara, radera och svara på inbjudningar —
/// MAXIMUS anropar ingenting av det.
test('påminnelserna läses och skrivs aldrig', async () => {
  const swift = await readFile(new URL('../verktyg/paminnelser.swift', import.meta.url), 'utf8');
  for (const verb of [/\bsave\b/, /\bremove\b/, /\.commit\(/, /EKReminder\(/,
                      /setValue/, /\.title\s*=/, /\.isCompleted\s*=/, /\.notes\s*=/, /\.dueDateComponents\s*=/])
    assert.ok(!verb.test(swift), `paminnelser.swift får inte kunna ${verb}`);
  assert.match(swift, /vanta\.wait\(timeout:/, 'tillståndsfrågan saknar tidsgräns');
});

test('kalendern läser och skriver aldrig', async () => {
  const swift = await readFile(new URL('../verktyg/kalender.swift', import.meta.url), 'utf8');
  for (const verb of [/\bsave\b/, /\bremove\b/, /\.commit\(/, /EKEvent\(/,
                      /setValue/, /\.title\s*=/, /\.startDate\s*=/, /\.notes\s*=/])
    assert.ok(!verb.test(swift), `kalender.swift får inte kunna ${verb}`);

  // Och den ska inte kunna hänga. En tillståndsfråga som aldrig besvaras —
  // för att dialogen inte kan visas — lämnade förut semaforen väntande i
  // evighet, och den som väntade fick en snurra utan slut.
  assert.match(swift, /vanta\.wait\(timeout:/, 'tillståndsfrågan saknar tidsgräns');

  const K = await import('../lib/kalender.mjs');

  // Fönstret är ett krav. Utan det läses hela kalendern.
  await assert.rejects(() => K.handelser({ fran: 'inte ett datum', till: new Date() }),
    /Ogiltigt tidsfönster/);

  // Veckan är sju dygn inklusive idag, räknat från dygnets början och inte
  // från klockslaget. Stod +7 dagar och blev åtta.
  const v = K.veckan(new Date(2026, 8, 28, 14, 30));
  assert.equal(v.fran.getHours(), 0);
  assert.equal(v.fran.getDate(), 28);
  assert.equal(v.till.getDate(), 4, 'veckan ska sluta sju dygn senare');
  assert.ok((v.till - v.fran) / 86400000 < 7, 'veckan är längre än en vecka');

  // Underlaget är text för en människa att läsa i grinden.
  const t = K.somText({ rubrik: 'Möte med facket', start: '2026-10-01T14:00',
    slut: '2026-10-01T15:00', kalender: 'Work', plats: 'Rum 3',
    deltagare: ['Anna Berg'], text: 'Ta med underlaget.' });
  assert.match(t, /^Möte med facket/);
  assert.match(t, /När: 2026-10-01 14:00–15:00/);
  assert.match(t, /Var: Rum 3/);
  assert.match(t, /Kallade: Anna Berg/);
  // Etiketten får inte se ut som ett namn. "Kalender: Svenska helgdagar"
  // maskerades till "[NAMN A]: Svenska helgdagar" — ett ord med versal
  // först på raden följt av kolon är precis vad namnvakten letar efter.
  assert.ok(!/^Kalender:/m.test(t), 'etiketten ser ut som ett namn');
  assert.match(t, /Ur kalendern: Work/);

  // Osynlig utfyllnad och inbjudningsfotnoter bort.
  assert.equal(K.stada('Möte​​\n\n\n\nsedan fika'), 'Möte\n\nsedan fika');
  assert.equal(K.stada('Vad det gäller\n-::~:~::~:~ Google Meet ~::~:~::~-\nlänkar'), 'Vad det gäller');
});

/// MAXIMUS skickar aldrig ett mejl.
///
/// Utkastet lämnas över till operativsystemet som en mailto-adress — samma
/// sak som att klicka på en länk. Skillnaden mot AppleScript är inte teknisk
/// finess: samma gränssnitt som kan lägga ett brev i Mails utkastmapp kan
/// skicka det, och den gränsen hade suddats ut av en enda bekvämlighet.
test('utkastet lämnas över, aldrig skickas', async () => {
  const js = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const fn = /function tillMail\([\s\S]*?\n}/.exec(js)?.[0];
  assert.ok(fn, 'hittade inte tillMail');

  // Vägen ut är mailto och ingenting annat.
  assert.match(fn, /mailto:/);
  for (const otillatet of [/osascript/, /AppleScript/, /outgoing message/, /\bsend\b/])
    assert.ok(!otillatet.test(fn), `tillMail får inte kunna ${otillatet}`);

  // Texten läggs alltid på urklipp: långa utkast klipps av operativsystemet,
  // och ett brev som tystnar mitt i en mening är värre än ett tomt fönster.
  assert.match(fn, /kopiera\(text/);
  assert.match(fn, /1800/, 'inget tak för mailto-längden');

  // Och inkorgens löfte står kvar: post.mjs skriver fortfarande ingenting.
  const post = await readFile(new URL('../lib/post.mjs', import.meta.url), 'utf8');
  for (const verb of [/\bsend\b/, /\bdelete\b/, /make new/, /outgoing message/])
    assert.ok(!verb.test(post), `post.mjs får inte kunna ${verb}`);
});
