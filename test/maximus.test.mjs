// Prov för Maximus: lås, upplåsning, migrering, och att innehållet faktiskt
// är oläsbart på disk. Ingen modell inblandad, så det kan köras varje gång.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Maximus } from '../lib/maximus.mjs';

async function nyttMaximus() {
  const d = await mkdtemp(join(tmpdir(), 'maximus-prov-'));
  await mkdir(join(d, 'sessioner'), { recursive: true });
  await mkdir(join(d, 'filer'), { recursive: true });
  return d;
}

test('ett nytt maximus är oskyddat tills ett lösenord sätts', async () => {
  const d = await nyttMaximus();
  const v = new Maximus(d);
  await v.ladda();
  assert.equal(v.skyddat, false);
  await v.satLosenord('tillrackligt-langt', { kommIhag: false });
  assert.equal(v.skyddat, true);
  assert.equal(v.upplast, true);
  await rm(d, { recursive: true, force: true });
});

test('för kort lösenord avvisas', async () => {
  const d = await nyttMaximus();
  await assert.rejects(() => new Maximus(d).satLosenord('kort'), /minst 8/);
  await rm(d, { recursive: true, force: true });
});

test('rätt lösenord låser upp, fel gör det inte', async () => {
  const d = await nyttMaximus();
  const a = new Maximus(d);
  await a.satLosenord('Sommaren2026!', { kommIhag: false });

  const b = new Maximus(d);
  await b.ladda();
  await assert.rejects(() => b.lasUpp('fel losenord'), /Fel lösenord/);
  assert.equal(b.upplast, false);
  await b.lasUpp('Sommaren2026!');
  assert.equal(b.upplast, true);
  await rm(d, { recursive: true, force: true });
});

test('låsfilen innehåller varken lösenord eller nyckel', async () => {
  const d = await nyttMaximus();
  const v = new Maximus(d);
  await v.satLosenord('Hemligheten123', { kommIhag: false });
  const ra = await readFile(join(d, 'las.json'), 'utf8');
  assert.ok(!ra.includes('Hemligheten123'), 'lösenordet får inte ligga där');
  assert.ok(!ra.includes(v.huvudnyckel.toString('base64')), 'nyckeln får inte ligga där');
  await rm(d, { recursive: true, force: true });
});

test('en sparad session är oläsbar på disk', async () => {
  const d = await nyttMaximus();
  const v = new Maximus(d);
  await v.satLosenord('Sommaren2026!', { kommIhag: false });
  const hemligt = JSON.stringify({ turer: [{ fraga: 'personnummer 19850813-2399', svar: 'en diagnos' }] });
  const vag = join(d, 'sessioner', 'a.json');
  await v.skrivFil(vag, hemligt);

  const ra = await readFile(vag);
  assert.ok(!ra.toString('latin1').includes('19900101'), 'innehållet ska inte gå att läsa');
  assert.ok(!ra.toString('latin1').includes('diagnos'), 'innehållet ska inte gå att läsa');
  assert.equal(await v.lasFil(vag), hemligt, 'men Maximus självt ska kunna läsa den');
  await rm(d, { recursive: true, force: true });
});

test('ett låst maximus vägrar läsa', async () => {
  const d = await nyttMaximus();
  const v = new Maximus(d);
  await v.satLosenord('Sommaren2026!', { kommIhag: false });
  const vag = join(d, 'sessioner', 'a.json');
  await v.skrivFil(vag, '{"hemligt":true}');
  v.las_();
  await assert.rejects(() => v.lasFil(vag), /låst/);
  await rm(d, { recursive: true, force: true });
});

test('migrering krypterar det som redan fanns, utan att tappa något', async () => {
  const d = await nyttMaximus();
  const innan = { turer: [{ fraga: 'gammal fråga', svar: 'gammalt svar' }] };
  await writeFile(join(d, 'sessioner', 'gammal.json'), JSON.stringify(innan));
  await writeFile(join(d, 'filer', 'policy.json'), JSON.stringify({ namn: 'resepolicy.txt' }));
  await writeFile(join(d, 'installningar.json'), JSON.stringify({ profil: { namn: 'Henrik' } }));

  const v = new Maximus(d);
  await v.satLosenord('Sommaren2026!', { kommIhag: false });
  const antal = await v.migrera();
  assert.equal(antal, 3, 'tre filer skulle krypteras');

  const ra = await readFile(join(d, 'sessioner', 'gammal.json'), 'utf8');
  assert.ok(!ra.includes('gammal fråga'), 'gammalt innehåll ska inte längre synas');
  assert.deepEqual(JSON.parse(await v.lasFil(join(d, 'sessioner', 'gammal.json'))), innan, 'men det ska gå att läsa tillbaka');

  // En andra körning ska inte kryptera om det som redan är krypterat.
  assert.equal(await v.migrera(), 0);
  await rm(d, { recursive: true, force: true });
});

test('låst session öppnas med lösenordet, förseglad kräver koden', async () => {
  const d = await nyttMaximus();
  const v = new Maximus(d);
  await v.satLosenord('Sommaren2026!', { kommIhag: false });

  const last = { las: { styrka: 'last' } };
  assert.ok((await v.nyckelFor(last, null)).equals(v.huvudnyckel), 'låst använder huvudnyckeln');

  const { nyttSalt } = await import('../lib/krypto.mjs');
  const forseglad = { las: { styrka: 'forseglad', salt: nyttSalt().toString('base64') } };
  await assert.rejects(() => v.nyckelFor(forseglad, null), /kräver sin kod/);

  const medKod = await v.nyckelFor(forseglad, '4721');
  const medFelKod = await v.nyckelFor(forseglad, '4722');
  assert.ok(!medKod.equals(medFelKod));
  assert.ok(!medKod.equals(v.huvudnyckel), 'förseglad ska inte gå att öppna med bara huvudnyckeln');
  await rm(d, { recursive: true, force: true });
});

test('oskyddade filer går fortfarande att läsa under migreringen', async () => {
  const d = await nyttMaximus();
  await writeFile(join(d, 'sessioner', 'gammal.json'), '{"turer":[]}');
  const v = new Maximus(d);
  await v.satLosenord('Sommaren2026!', { kommIhag: false });
  assert.equal(await v.lasFil(join(d, 'sessioner', 'gammal.json')), '{"turer":[]}');
  await rm(d, { recursive: true, force: true });
});

test('samtidiga skrivningar bevarar sista versionen utan krockande temporärfiler', async () => {
  const d = await nyttMaximus(), v = new Maximus(d), path = join(d, 'filer', 'samtidigt.json');
  try {
    await Promise.all(Array.from({ length: 40 }, (_, n) => v.skrivFil(path, JSON.stringify({ version: n }))));
    assert.equal(JSON.parse(await v.lasFil(path)).version, 39);
    assert.equal(v.skrivningar.size, 0);
  } finally { await rm(d, { recursive: true, force: true }); }
});

test('en bakgrundsskrivning efter låsning får aldrig bli klartext', async () => {
  const d = await nyttMaximus(), v = new Maximus(d), path = join(d, 'filer', 'hemligt.json');
  try {
    await v.satLosenord('Sommaren2026!', { kommIhag: false });
    await v.skrivFil(path, 'bevarat innehåll');
    const fore = await readFile(path);
    v.las_();
    await assert.rejects(v.skrivFil(path, 'hemligt nytt innehåll'), /låst/);
    assert.deepEqual(await readFile(path), fore);
  } finally { await rm(d, { recursive: true, force: true }); }
});

// ── Förseglade sessioner ────────────────────────────────────────────────
//
// Låset i gränssnittet var en etikett: servern lämnade ut hela sessionen
// utan att fråga efter koden, och ingenting var krypterat eftersom inget
// lösenord någonsin sattes. Proven nedan är det som gör låset till ett lås.

test('en förseglad session går inte att läsa med bara huvudlösenordet', async () => {
  const d = await nyttMaximus();
  const v = new Maximus(d);
  await v.satLosenord('Sommaren2026!', { kommIhag: false });
  const { nyttSalt } = await import('../lib/krypto.mjs');
  const salt = nyttSalt();
  const session = { id: 'a', titel: 'Ett ärende', las: { styrka: 'forseglad', salt: salt.toString('base64') },
    turer: [{ fraga: 'Gunvor Rehnström 19850815-2397', svar: 'Ett svar om henne.' }] };
  session.las.kontroll = await v.kodkontroll('4721', salt);
  const vag = join(d, 'sessioner', 'a.json');
  await v.skrivSession(vag, session, '4721');

  const ra = await readFile(vag);
  assert.ok(!ra.toString('latin1').includes('Gunvor'), 'innehållet ska inte gå att läsa på disk');

  // Utan kod: rubriken går att läsa, innehållet inte.
  await assert.rejects(() => v.lasSession(vag), /kräver sin kod/);
  const yttre = JSON.parse(await v.lasFil(vag));
  assert.equal(yttre.titel, 'Ett ärende');
  assert.ok(yttre.kropp, 'innehållet ligger i ett eget kuvert');

  // Fel kod öppnar ingenting, rätt kod öppnar allt.
  assert.equal(await v.stammerKod(session.las, '0000'), false);
  assert.equal(await v.stammerKod(session.las, '4721'), true);
  await assert.rejects(() => v.lasSession(vag, '0000'));
  const hel = await v.lasSession(vag, '4721');
  assert.equal(hel.turer[0].fraga, 'Gunvor Rehnström 19850815-2397');
  await rm(d, { recursive: true, force: true });
});

test('en låst session följer huvudnyckeln, en förseglad gör det inte', async () => {
  const d = await nyttMaximus();
  const v = new Maximus(d);
  await v.satLosenord('Sommaren2026!', { kommIhag: false });
  const vag = join(d, 'sessioner', 'b.json');
  // "Låst" är en grind i gränssnittet: huvudlösenordet öppnar ändå.
  await v.skrivSession(vag, { id: 'b', las: { styrka: 'last' }, turer: [{ fraga: 'x', svar: 'y' }] });
  assert.equal((await v.lasSession(vag)).turer.length, 1);
  await rm(d, { recursive: true, force: true });
});

test('liggaren läcker inte en förseglad session', async () => {
  // Sett 2026-09-25: liggarraden bär hela den maskerade nyttolasten och hela
  // svaret, och filen krypteras med huvudnyckeln. En förseglad session
  // krypteras med huvudnyckel OCH kod, och utan koden är den borta för alltid
  // — men raden gick att läsa med bara lösenordet, och exporten skriver den i
  // klartext med flit. Allt en förseglad session någonsin skickat låg alltså
  // öppet. Förseglingen höll på sessionen och läckte genom loggen.
  const Liggare = await import('../lib/liggare.mjs');
  const d = await nyttMaximus();
  await mkdir(join(d, 'liggare'), { recursive: true });
  const v = new Maximus(d);
  await v.ladda();
  await v.satLosenord('Sommaren2026!', { kommIhag: false });

  const salt = (await import('../lib/krypto.mjs')).nyttSalt();
  const sess = { id: 's1', las: { styrka: 'forseglad', salt: salt.toString('base64') } };
  const nyckel = await v.nyckelFor(sess, '4711');

  const HEMLIGT = 'Ärendet gäller [NAMN A] och ett omhändertagande.';
  await writeFile(join(d, 'liggare', '2026-09-25.json'), await (async () => {
    const rad = { tid: '2026-09-25T10:00:00.000Z', frontier: 'ChatGPT', session: 's1',
      tecken: HEMLIGT.length, sekunder: 1.2, vag: 'api', forseglad: true,
      kuvert: v.forsegla(JSON.stringify({ skickat: HEMLIGT, mottaget: 'Svaret.' }), nyckel) };
    return JSON.stringify([rad]);
  })());
  // Filen skrivs oförseglad här för att provet ska gå att läsa; poängen är det
  // inre kuvertet, inte det yttre.

  // Utan kod: raden finns, innehållet inte.
  const utan = await Liggare.las(v, d);
  assert.equal(utan.length, 1);
  assert.equal(utan[0].frontier, 'ChatGPT', 'att en sändning skedde ska alltid synas');
  assert.equal(utan[0].tecken, HEMLIGT.length, 'antalet tecken är metadata, inte innehåll');
  assert.equal(utan[0].skickat, null, 'nyttolasten får inte komma ut utan koden');
  assert.equal(utan[0].mottaget, null);
  assert.equal(utan[0].last, true);
  assert.ok(!('kuvert' in utan[0]), 'den krypterade texten ska inte lämna liggaren alls');

  // Ingen export får bära innehållet heller — de är allmänna handlingar.
  for (const [namn, gor] of [['csv', Liggare.tillCsv], ['json', Liggare.tillJson], ['text', Liggare.tillText]]) {
    const ut = gor(utan);
    assert.ok(!ut.includes(HEMLIGT), `${namn}-exporten läcker nyttolasten`);
    assert.ok(ut.includes('förseglad'), `${namn}-exporten säger inte varför fältet är tomt`);
  }

  // Med kod: allt kommer fram.
  const med = await Liggare.las(v, d, { oppnare: (_, kuvert) => JSON.parse(v.oppnaKuvert(kuvert, nyckel)) });
  assert.equal(med[0].skickat, HEMLIGT);
  assert.equal(med[0].mottaget, 'Svaret.');

  // Fel kod ger ingenting, inte ett halvt svar.
  const felNyckel = await v.nyckelFor(sess, '0000');
  const fel = await Liggare.las(v, d, { oppnare: (_, kuvert) => JSON.parse(v.oppnaKuvert(kuvert, felNyckel)) });
  assert.equal(fel[0].skickat, null);

  await rm(d, { recursive: true, force: true });
});

test('en delad session går bara att öppna med sin kod', async () => {
  const D = await import('../lib/dela.mjs');
  const session = { id: 'abc', titel: 'Omhändertagande', agare: 'u1',
    las: { styrka: 'forseglad', salt: 'xx' },
    turer: [{ fraga: 'Vad gäller för [NAMN A]?', svar: 'Enligt 6 kap...' }] };

  const kod = D.foreslaKod();
  assert.match(kod, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/, 'koden ska gå att läsa upp');
  assert.ok(!/[01IOl]/.test(kod), 'tecken som blandas ihop hör inte hemma i en kod');

  const fil = await D.paketera(session, kod, { fran: 'Anna på socialförvaltningen' });

  // Ingenting av innehållet får synas i filen.
  const ra = String(fil);
  for (const hemligt of ['Omhändertagande', 'NAMN A', '6 kap'])
    assert.ok(!ra.includes(hemligt), `delningsfilen läcker "${hemligt}"`);

  // Men avsändaren ska synas innan man skriver en kod.
  const v = D.titta(fil);
  assert.equal(v.fran, 'Anna på socialförvaltningen');

  // Rätt kod öppnar.
  const { session: ut } = await D.packaUpp(fil, kod);
  assert.equal(ut.titel, 'Omhändertagande');
  assert.equal(ut.turer[0].svar, 'Enligt 6 kap...');
  assert.equal(ut.ursprung, 'abc', 'varifrån den kom ska följa med');
  assert.ok(!('las' in ut), 'mottagarens maximus sätter sitt eget lås');
  assert.ok(!('agare' in ut), 'avsändarens användar-id hör inte hemma i ett annat maximus');

  // Fel kod säger att den är fel, inte något obegripligt.
  await assert.rejects(() => D.packaUpp(fil, 'HELT-FEL-KOD-HAR'), /Fel kod/);

  // En kod som duger som grind i gränssnittet duger inte på en fil som mejlas.
  await assert.rejects(() => D.paketera(session, '4711'), /minst 12 tecken/);

  // Och en fil som inte är en delning ska säga det.
  assert.throws(() => D.titta(Buffer.from('{"hej":1}')), /ingen MAXIMUS-delning/);
  assert.throws(() => D.titta(Buffer.from('inte ens json')), /ingen MAXIMUS-delning/);
});

test('öppen källkod: ingen spärr, ingen kassa, ingen licensserver', async () => {
  // Apache-2.0 (2026-10-09). Allt ska bara finnas. En kvarglömd 402 eller
  // ett anrop till licensservern vore en betalvägg som ingen längre kan öppna.
  const { readFile: las } = await import('node:fs/promises');
  const server = await las(new URL('../server.mjs', import.meta.url), 'utf8');
  const app = await las(new URL('../public/app.js', import.meta.url), 'utf8');
  for (const ord of ['kraverLicens', 'harRatt(', 'json(res, 402', '/api/licens', 'fornya.mjs', 'licens.mjs'])
    assert.ok(!server.includes(ord), `servern har kvar ${ord}`);
  for (const ord of ['betalvagg', '/api/licens', 'status === 402', 'ritaLicens'])
    assert.ok(!app.includes(ord), `appen har kvar ${ord}`);
});

test('intyget bevisar liggaren utan att bära dess innehåll', async () => {
  const A = await import('../lib/attest.mjs');

  const rader = [
    { tid: '2026-09-01T08:00:00Z', frontier: 'ChatGPT', vag: 'api', tecken: 412,
      skickat: 'Ärendet gäller [NAMN A] och ett omhändertagande.', mottaget: 'Enligt 6 kap…' },
    { tid: '2026-09-14T13:30:00Z', frontier: 'Claude', vag: 'api', tecken: 980,
      skickat: 'Yttrande om [ORG B] och avgiften.', mottaget: 'Svaret.' },
    { tid: '2026-09-20T09:15:00Z', frontier: 'Webbsök (Brave)', vag: 'webb', tecken: 38,
      skickat: 'prisbasbelopp 2026', mottaget: '' },
  ];
  const s = A.sammandrag(rader, {
    installningar: { sorter: ['personnummer', 'namn'], lage: 'noggrann', webb: 'auto' },
    modell: 'Gemma 4 12B', version: '4.0.0',
  });

  // Det som ska stå i intyget.
  assert.equal(s.antal, 3);
  assert.equal(s.fran, '2026-09-01');
  assert.equal(s.till, '2026-09-20');
  assert.equal(s.tecken, 412 + 980 + 38);
  assert.deepEqual(s.perMottagare, { ChatGPT: 1, Claude: 1, 'Webbsök (Brave)': 1 });
  assert.match(s.rot, /^[0-9a-f]{64}$/);
  assert.match(s.konfig, /^[0-9a-f]{64}$/);

  // Det som ALDRIG får stå i det. Ett intyg som bär innehåll är en läcka med
  // fin inramning.
  const ra = JSON.stringify(s);
  for (const hemligt of ['NAMN A', 'omhändertagande', 'ORG B', '6 kap', 'prisbasbelopp', 'Svaret'])
    assert.ok(!ra.includes(hemligt), `intyget läcker "${hemligt}"`);

  // Roten ska vara oberoende av läsordning — annars ger två uttag ur samma
  // liggare olika rot, och intyget är oanvändbart som bevis.
  const omvand = A.sammandrag([...rader].reverse(), {
    installningar: { sorter: ['namn', 'personnummer'], lage: 'noggrann', webb: 'auto' },
    modell: 'Gemma 4 12B', version: '4.0.0',
  });
  assert.equal(omvand.rot, s.rot, 'roten beror på ordningen');
  assert.equal(omvand.konfig, s.konfig, 'konfigfingret beror på ordningen i sorter');

  // En granskare får liggaren och intyget och kan se att de hör ihop.
  assert.deepEqual(A.stammer(rader, s), { rot: true, antal: true, period: true });

  // Ändras en enda post stämmer roten inte längre.
  const pillat = structuredClone(rader);
  pillat[1].skickat = 'Yttrande om [ORG B] och en helt annan avgift.';
  assert.equal(A.stammer(pillat, s).rot, false, 'en ändrad post ska synas');

  // Och tas en post bort syns det på både antal och rot.
  assert.equal(A.stammer(rader.slice(0, 2), s).rot, false);
  assert.equal(A.stammer(rader.slice(0, 2), s).antal, false);

  // Texten ska säga om det är motsignerat eller inte. Ett osignerat intyg som
  // ser signerat ut är värre än inget intyg.
  assert.match(A.tillText(s), /INTE MOTSIGNERAT/);
  assert.match(A.tillText({ sammandrag: s, signatur: 'abc' }), /Motsignerat av Aurolabs AB/);
});
