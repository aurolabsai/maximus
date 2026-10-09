// Granskningen av maskering och dataskydd 2026-10-09 (MSK-2 … MSK-11).
// Varje indata här gick ut omaskerad före rättningen; de står här så att
// ingen av dem kan glida tillbaka.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { maskera, granska, hittaKvar, maskeraKvar } from '../lib/maskering.mjs';
import { utatGrind, grindaArgument } from '../lib/failclosed.mjs';
import { grindaSokfraga, anonymSokfraga } from '../lib/uppslag.mjs';
import { maskeraMeddelanden, LOKALA_VERKTYG, nyttolastText } from '../lib/moln.mjs';
import { vagval } from '../lib/vagval.mjs';
import { importerbar } from '../lib/dela.mjs';
import { arNyhetsbrev } from '../lib/nyheter.mjs';
import { galler } from '../lib/grader.mjs';

const rot = new URL('../', import.meta.url);
const las = f => readFile(new URL(f, rot), 'utf8');
const strikt = t => maskeraMeddelanden([{ role: 'user', content: t }]).meddelanden[0].content;

// Indata och det som inte får stå kvar.
const NUMMER = [
  ['ring mig: 08-123 456 78', '123 456'],
  ['tel +46 (0)70-123 45 67', '123 45'],
  ['tel 0046701234567', '701234567'],
  ['tel 070.123.45.67', '123.45'],
  ['pnr 900101.1234', '900101'],
  ['pnr 900101_1234', '900101'],
  ['pnr 1990-01-01-1234', '1234'],
  ['pnr 9 0 0 1 0 1 1 2 3 4', '1 2 3 4'],
  ['pnr 900101-12 34', '900101'],
  ['pnr x19850813-2399', '19900101'],
  ['pnr 19850813-2399x', '19900101'],
  ['personnummer １９９００１０１－１２３４', '１２３４'],
  ['personnummer ١٩٩٠٠١٠١١٢٣٤', '١٢٣٤'],
  ['konto 33009001011234', '9001011234'],
  ['Utbetalning till Nordea personkonto 33009001011234', '900101'],
  ['konto 8327-9, 123 456 789-0', '789'],
  ['Swedbank 8327-9, 123 456 789-0', '789'],
  ['kortnummer 4111 1111 1111 1111', '1111'],
  ['card 4111111111111111', '4111'],
  ['mail erik.svensson [at] kommun.se', 'svensson'],
  ['erik(at)kommun.se', 'erik'],
  ['erik@kommun', 'erik'],
  ['email john.smith(at)example.com', 'smith'],
  ['Barnet (född 2015-03-04-1234) placeras enligt LVU', '1234'],
  ['Call me on +46 (0)8-123 456 78, regards', '456'],
  ['Patient Nguyen, card 4111 1111 1111 1111', '4111'],
];

test('MSK-2: vanliga svenska format maskeras i alla tre vägarna', () => {
  for (const [in_, kvar] of NUMMER) {
    assert.ok(!maskera(in_).text.includes(kvar), `maskera: ${in_} → ${maskera(in_).text}`);
    assert.ok(!utatGrind(in_, {}).includes(kvar), `grind: ${in_} → ${utatGrind(in_, {})}`);
    assert.ok(!grindaSokfraga(in_).includes(kvar), `sök: ${in_} → ${grindaSokfraga(in_)}`);
    assert.ok(!strikt(in_).includes(kvar), `moln: ${in_} → ${strikt(in_)}`);
  }
});

test('MSK-2: efterkontrollen är oberoende och ser det mönstren missar', () => {
  for (const [in_] of NUMMER) {
    assert.ok(granska(in_).length > 0, `granska såg inget i ${in_}`);
    assert.ok(hittaKvar(in_).length > 0 || /konto 8327|Swedbank/.test(in_), `skuggan såg inget i ${in_}`);
  }
  // Skuggan maskerar själv där den hittar, på rätt plats.
  const m = maskeraKvar('ring 08-123 456 78 nu');
  assert.equal(m.text, 'ring [TELEFON A] nu');
  // Och grindaArgument kastar inte på det grinden redan stängt.
  assert.doesNotThrow(() => grindaArgument({ q: 'ring 08-123 456 78' }));
});

test('MSK-2: datum, tider, belopp och löpnummer är inga identiteter', () => {
  for (const t of ['Möte 2026-10-09 14.30 i rum 3', 'kl 08.15 09.30', 'Sammanlagt 1 840 000 kronor.',
    'datum 01.02.2024', 'Mötet är 9 30 i rum 12.', 'Fakturanummer 2024 05 17 gäller.',
    'version 1.2.3', 'id a1b2c3d4e5f619900101123456']) {
    assert.equal(maskera(t).text, t, t);
    assert.deepEqual(hittaKvar(t), [], t);
    assert.equal(utatGrind(t, {}), t, t);
  }
});

test('MSK-2: efternamn i lägen vakten inte såg', () => {
  const fall = [
    ['Hej, ring Lena på 08-123 456 78 om Hedströms sjukskrivning.', /Hedström|Lena|123/],
    ['Signatur: Lena Hedström | +46 (0)70-123 45 67 | lena.hedstrom [at] kommun.se', /Hedström|hedstrom|123/],
    ['- Hedström: ansvarig handläggare', /Hedström/],
    ['ring andersson om orosanmälan', /andersson/],
    ['lex Maria Svensson på avdelning 41', /Svensson/],
    ['Mötet med  Hedström gick bra', /Hedström/],
    ['rum 3 Hedström', /Hedström/],
    ['kl 14  Hedström ringer', /Hedström/],
    ['Svensson/Hedström har sagt upp sig', /Svensson|Hedström/],
    ['Se https://www.facebook.com/erik.svensson.77', /erik/],
  ];
  for (const [t, re] of fall) {
    assert.doesNotMatch(utatGrind(t, {}), re, `grind: ${t} → ${utatGrind(t, {})}`);
    assert.doesNotMatch(strikt(t), re, `moln: ${t} → ${strikt(t)}`);
  }
  // Den strikta molnvakten tar också det som saknar ändelse.
  for (const [t, re] of [['Möte med  Wendt imorgon', /Wendt/], ['Hedström & Wendt Advokatbyrå', /Hedström|Wendt/],
    ['Dear Mrs. O’Brien,', /Brien/], ['**Hedström** ringde', /Hedström/]]) {
    assert.doesNotMatch(strikt(t), re, `moln: ${t} → ${strikt(t)}`);
  }
  // Begreppet står kvar när inget namn följer.
  assert.match(utatGrind('lex Maria tidsfrist', {}), /lex Maria/);
});

test('MSK-2: vanliga ord blir inte efternamn', () => {
  for (const t of ['elströmmen bröts', 'informationsströmmen växer', 'en lektion om lesson plans',
    'Kan vi omplacera henne?', 'Vi skriver till rektorn i morgon. Tidplanen flyttas en vecka.']) {
    assert.equal(utatGrind(t, {}), t, t);
  }
});

test('MSK-3: den anonyma sökningen stryker namnen, också efternamn', () => {
  const fall = [
    ['Hedström sjukskrivning depression Försäkringskassan', /Hedström/],
    ['andersson orosanmälan barn Kiruna', /andersson|Kiruna/],
    ['Patient Jönsson och Ek LVU placering', /Jönsson|\bEk\b/],
  ];
  for (const [f, re] of fall) {
    const v = vagval(f);
    assert.equal(v.form, 'anonym', f);
    assert.doesNotMatch(v.fraga, re, `${f} → ${v.fraga}`);
  }
  // Ett namn ur materialet går inte ut i frågan heller.
  assert.doesNotMatch(anonymSokfraga('sjukskrivning rutin bodil', { material: 'Bodil Rehnström är sjukskriven' }), /bodil/i);
  // Det allmänna står kvar.
  assert.match(vagval('Hedström sjukskrivning depression Försäkringskassan').fraga, /sjukskrivning depression/);
});

test('MSK-4: inget lokalt verktyg räknar om ett återställt värde', () => {
  assert.ok(!LOKALA_VERKTYG.has('rakna'));
});

test('MSK-5: huvudnyckeln går genom stdin, aldrig som argument', async () => {
  const src = await las('lib/maximus.mjs');
  assert.doesNotMatch(src, /'-w',\s*this\.huvudnyckel/);
  assert.match(src, /spawn\('\/usr\/bin\/security', \['-i'\]/);
});

test('MSK-6: en importerad session är en vanlig, isolerad session', async () => {
  const s = importerbar({
    titel: 'Vårt samtal', projekt: 'offrets-projekt', helig: { sort: 'du' }, minne: 'minns',
    behandling: 'original', djup: { personer: ['X'] }, nyhet: { url: 'https://x' }, agentsamtal: true,
    las: { styrka: 'forseglad' }, karta: [{ original: 'ord', platshallare: '[NAMN A]' }], dopt: true,
    turer: [{ id: 'gammal', fraga: 'Hej', svar: 'Svar', av: 'agent', behandling: 'original', avAgenten: true }],
    filer: [{ id: 'f', namn: 'a.txt', original: 'Lena Hedström', maskerad: 'Lena Hedström', omaskerad: true, publik: { url: 'x' } }],
  });
  for (const k of ['projekt', 'helig', 'minne', 'behandling', 'djup', 'nyhet', 'agentsamtal', 'las', 'dopt'])
    assert.ok(!(k in s), `${k} följde med`);
  assert.deepEqual(s.karta, []);
  assert.equal(s.titel, 'Vårt samtal');
  assert.equal(s.turer[0].fraga, 'Hej');
  assert.notEqual(s.turer[0].id, 'gammal');
  for (const k of ['av', 'behandling', 'avAgenten']) assert.ok(!(k in s.turer[0]), `tur.${k} följde med`);
  for (const k of ['omaskerad', 'publik', 'maskerad']) assert.ok(!(k in s.filer[0]), `fil.${k} följde med`);
  const srv = await las('server.mjs');
  assert.match(srv, /\.\.\.Dela\.importerbar\(inre\)/);
  assert.doesNotMatch(srv, /\.\.\.inre,/);
});

test('molnet: liggaren får nyttolasten, och ditt val av sorter gäller', async () => {
  const ut = maskeraMeddelanden([{ role: 'user', content: 'Se https://intra.kommun.se/arende/77 och ring 08-123 456 78' }],
    { niva: 'personuppgifter', sorter: galler({ paket: 'myndighet' }) }).meddelanden;
  assert.doesNotMatch(ut[0].content, /https:|123 456/);
  // Standard är golvet: ett snålare val tar inte bort telefonnumret.
  const snalt = maskeraMeddelanden([{ role: 'user', content: 'ring 08-123 456 78' }], { sorter: galler({ paket: 'sakerhet' }) }).meddelanden;
  assert.doesNotMatch(snalt[0].content, /123 456/);
  const text = nyttolastText(ut);
  assert.match(text, /^\[user\] Se \[LÄNK A\]/);
  assert.ok(nyttolastText([{ role: 'user', content: 'x'.repeat(9000) }]).length < 8100);
  const lokal = await las('lib/lokal.mjs');
  assert.match(lokal, /skickat: Moln\.nyttolastText\(meddelanden\)/);
  assert.doesNotMatch(lokal, /meddelanden, maskerade`/);
  assert.match(lokal, /sorter: moln\.sorter\?\.\(\)/);
});

test('telefonen och kopplingarna: liggaren visar det som faktiskt gick ut', async () => {
  const srv = await las('server.mjs');
  const tel = srv.slice(srv.indexOf('async function tillTelefonen'), srv.indexOf('let lasesFranTelefonen'));
  assert.match(tel, /utatGrind\(titel/);
  assert.match(tel, /vag: 'telefon', skickat: rad/);
  const kop = srv.slice(srv.indexOf("vag === '/api/kopplingar/anropa'"), srv.indexOf("vag === '/api/modeller/bort'"));
  assert.match(kop, /JSON\.stringify\(skickade\)/);
  assert.doesNotMatch(kop, /JSON\.stringify\(kropp\.argument/);
  assert.match(await las('lib/plugins.mjs'), /skickadeArgument: argument/);
});

test('MSK-11: brevets text följer aldrig med som publik nyhet', async () => {
  assert.ok(!arNyhetsbrev('Kollega <team@kommun.se>'));
  assert.ok(!arNyhetsbrev('Anna via LinkedIn <anna@linkedin.com>'));
  assert.ok(arNyhetsbrev('Team <team@startup.io>', { avregistrering: true }));
  assert.ok(arNyhetsbrev('noreply@openai.com'));
  const srv = await las('server.mjs');
  assert.match(srv, /const reserv = f\.brev \? '' : String\(f\.text \|\| ''\);/);
});

// ── ReDoS (2026-10-09, säkerhetsgranskningen av rättningen) ─────────────
// E-postmönstren började på `\b`, som finns mellan varje tecken i
// "a.a.a.…" och "1-1-1-…": varje start läste raden till slutet, elva
// sekunder på 50 000 tecken. Namnvakterna gick igenom hela kartan per ord.
test('ReDoS: varje grind är linjär på fientlig indata', async () => {
  const { maskeraOkanda } = await import('../lib/failclosed.mjs');
  const { FORNAMN } = await import('../lib/fornamn.mjs');
  const N = 50000;
  const namn = [...FORNAMN].slice(0, 6000).map(x => x[0].toUpperCase() + x.slice(1));
  const fientliga = {
    'ettor och mellanslag': '1 '.repeat(N / 2),
    'ettor och streck': '1-'.repeat(N / 2),
    'a.a.a…@': 'a.'.repeat(N / 2) + '@',
    'a.a.a…': 'a.'.repeat(N / 2),
    'blandade avskiljare': Array.from({ length: N / 2 }, (_, i) => '1' + ' .-_('[i % 5]).join(''),
    'lång sifferrad': '1'.repeat(N),
    'siffror och (0)': '1(0)'.repeat(N / 4) + '²',
    'helbredda siffror': '１'.repeat(N),
    'matematiska siffror': '𝟏'.repeat(N / 2),
    'bindestreck': 'Aa' + '-Aa'.repeat(N / 3) + '1',
    'versala ord': 'Abc '.repeat(N / 4),
    'olika förnamn': namn.join(', ').slice(0, N),
    'förnamn och efternamn': namn.map(x => `${x} Svensson`).join('. ').slice(0, N),
    'at-omskrivningar': 'a [at] '.repeat(N / 7),
    'snedstreck': 'Ab/'.repeat(N / 3),
    'base64': 'A1'.repeat(N / 2),
    'apostrofer': 'O’'.repeat(N / 2),
  };
  const allt = galler({ paket: 'allt' });
  for (const [vad, t] of Object.entries(fientliga)) {
    for (const [fn, kor] of Object.entries({
      maskera: () => maskera(t), maskeraAllt: () => maskera(t, { sorter: allt }), utatGrind: () => utatGrind(t, {}),
      granska: () => granska(t), hittaKvar: () => hittaKvar(t), maskeraOkanda: () => maskeraOkanda(t, {}),
    })) {
      const t0 = performance.now();
      kor();
      const ms = performance.now() - t0;
      assert.ok(ms < 300, `${fn} på ${vad}: ${Math.round(ms)} ms`);
    }
  }
});

// ── Kringgåenden (samma granskning) ─────────────────────────────────────
test('kringgående: tecken utanför ASCII, platshållare intill, länkar och markdown', () => {
  const fall = [
    ['pnr 𝟏𝟗𝟗𝟎𝟎𝟏𝟎𝟏-𝟏𝟐𝟑𝟒', /𝟏𝟐𝟑𝟒|1234/],                 // matematiska siffror
    ['pnr １9900１01-1234', /1234|１/],                      // blandat helbrett och ASCII
    ['ｅｒｉｋ＠ｋｏｍｍｕｎ．ｓｅ', /ｅｒｉｋ|erik/],             // helbredd adress
    ['mejla åsa.öberg@kommun.se', /åsa|öberg|kommun/],      // å först i adressen
    ['[NAMN A]19850813-2399', /1234/],
    ['[NAMN A]0701740605', /0701740605/],
    ['[E-POST A]erik@kommun.se', /erik/],
    ['https://x.se/?pnr=198508132399&tel=0701740605', /198508132399|0701740605/],
    ['tel:+46701740605', /701234567/],
    ['[länk](mailto:erik@kommun.se)', /erik/],
    ['**19850813-2399**', /1234/],
    ['_0701740605_', /0701740605/],
    ['`erik@kommun.se`', /erik/],
    ['- 070-174 06 05', /123 45/],
  ];
  for (const [t, re] of fall) {
    assert.doesNotMatch(utatGrind(t, {}), re, `grind: ${t} → ${utatGrind(t, {})}`);
    assert.doesNotMatch(strikt(t), re, `moln: ${t} → ${strikt(t)}`);
  }
  // Efterkontrollen pekar på rätt ställe också efter tecken som är två
  // kodenheter långa.
  assert.equal(maskeraKvar('a 𝟏𝟗𝟗𝟎𝟎𝟏𝟎𝟏-𝟏𝟐𝟑𝟒 b').text, 'a [PERSONNUMMER A] b');
  assert.equal(maskeraKvar('𝟏 ring 08-123 456 78').text, '𝟏 ring [TELEFON A]');
});

test('kringgående: namnvakten släpper inget den tog förut', async () => {
  const { maskeraOkanda } = await import('../lib/failclosed.mjs');
  const ok = t => maskeraOkanda(t, {}).text;
  // Apostrof och citattecken före namnet stoppade aldrig vakten.
  assert.doesNotMatch(ok("'Hedström' ringde"), /Hedström/);
  assert.doesNotMatch(ok('"Hedström" ringde'), /Hedström/);
  assert.doesNotMatch(ok('[NAMN A] Hedström'), /Hedström/);
  // Ett namn över en radbrytning är fortfarande ett namn: "Ring" först på
  // raden är ett efternamn här, inte en uppmaning.
  assert.doesNotMatch(ok('Lena\nRing ringde'), /Ring/);
  // En del av ett namn ur en adress maskeras på andra ställen också.
  assert.doesNotMatch(utatGrind('Se erik.svensson på bilden. Svensson ringde.', {}), /svensson/i);
});
