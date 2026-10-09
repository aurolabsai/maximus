// Till telefonen (2026-10-06): kanalen, borta, taket, raden och adressen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as Telefon from '../lib/telefon.mjs';

test('kanalen: bara de kända, annars av', () => {
  assert.equal(Telefon.kanalUr('imessage'), 'imessage');
  assert.equal(Telefon.kanalUr('sms'), 'av');
});

test('borta efter tio orörda minuter', () => {
  assert.equal(Telefon.arBorta(599), false);
  assert.equal(Telefon.arBorta(600), true);
});

test('taket: fyra i timmen, tolv per dygn', () => {
  const nu = Date.parse('2026-10-06T12:00:00Z');
  const min = m => new Date(nu - m * 60e3).toISOString();
  assert.equal(Telefon.inomTak([min(5), min(10), min(20)], nu), true);
  assert.equal(Telefon.inomTak([min(5), min(10), min(20), min(50)], nu), false);
  assert.equal(Telefon.inomTak(Array.from({ length: 12 }, (_, i) => min(70 + i * 60)), nu), false);
  assert.equal(Telefon.inomTak([min(61), min(62), min(63), min(64)], nu), true);
});

test('raden: rubrik och text, kort, på en rad', () => {
  assert.equal(Telefon.rad('Undersökt: X', 'Slutsats\nmed radbrytning'), 'Maximus · Undersökt: X — Slutsats med radbrytning');
  assert.ok(Telefon.rad('a', 'b'.repeat(1000)).length <= 280);
});

test('adressen: nummer eller e-post, inget annat', () => {
  assert.equal(Telefon.adressUr('+46 70-174 06 05'), '+46701740605');
  assert.equal(Telefon.adressUr('auro@example.com'), 'auro@example.com');
  assert.equal(Telefon.adressUr('" & do shell script "x'), null);
  assert.equal(Telefon.adressUr(''), null);
});

test('iMessage-skriptet tar adress och text som argument och kompilerar', () => {
  assert.doesNotMatch(Telefon.IMESSAGE_SKRIPT, /\$\{/);
  assert.match(Telefon.IMESSAGE_SKRIPT, /on run argv/);
  const dir = mkdtempSync(join(tmpdir(), 'tel-'));
  writeFileSync(join(dir, 's.applescript'), Telefon.IMESSAGE_SKRIPT);
  execFileSync('/usr/bin/osacompile', ['-o', join(dir, 's.scpt'), join(dir, 's.applescript')]);
});

// ── Tillbaka från telefonen (2026-10-09) ─────────────────────────────────
test('ett svar i anteckningen, en avbockning och en egen påminnelse', () => {
  const logg = { paminnelser: [{ id: 'a', tid: '2026-10-09T08:00:00Z', session: 's1' }, { id: 'b', tid: '2026-10-09T08:00:00Z', session: 's2' }] };
  const poster = [
    { id: 'a', lista: 'Maximus', titel: 'Maximus · Inkorgen', text: `${Telefon.SVARSRAD}\nUndersök det här, och boka ett möte.`, klar: false },
    { id: 'b', lista: 'Maximus', titel: 'Maximus · Kalendern', text: Telefon.SVARSRAD, klar: true },
    { id: 'c', lista: 'Maximus', titel: 'Vad har jag i morgon?', klar: false },
    { id: 'd', lista: 'Inköp', titel: 'Mjölk', klar: false },
  ];
  const h = Telefon.iListan(poster, logg);
  assert.deepEqual(h.map(x => `${x.sort}:${x.id}`), ['svar:a', 'sett:b', 'nytt:c']);
  assert.equal(h[0].text, 'Undersök det här, och boka ett möte.');
  assert.equal(h[0].session, 's1');
  // Samma läge en gång till: inget nytt att göra.
  assert.deepEqual(Telefon.iListan(poster, Telefon.minns(logg, h)), []);
});

test('Maximus egen rad är aldrig ett svar', () => {
  assert.equal(Telefon.svarUr(Telefon.SVARSRAD), '');
  assert.deepEqual(Telefon.iListan([{ id: 'a', lista: 'Maximus', text: Telefon.SVARSRAD, klar: false }], { paminnelser: [{ id: 'a' }] }), []);
});

test('ett ändrat svar räknas igen, ett oförändrat inte', () => {
  const logg = { paminnelser: [{ id: 'a', svar: 'ja' }] };
  assert.deepEqual(Telefon.iListan([{ id: 'a', lista: 'Maximus', text: 'ja', klar: false }], logg), []);
  assert.equal(Telefon.iListan([{ id: 'a', lista: 'Maximus', text: 'nej, vänta', klar: false }], logg)[0].text, 'nej, vänta');
});

// Granskningen 2026-10-09: en påminnelselista kan vara delad. En text från
// telefonen är obetrodd, och inget ur svaret går tillbaka dit.
test('en text från telefonen får ingen webb, inga uppdrag, inga handlingar — och inget svar tillbaka', async () => {
  const { readFile } = await import('node:fs/promises');
  const srv = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(srv, /franTelefonen: true, webb: 'av'/, 'telefonens text skickas med webben av');
  assert.match(srv, /if \(tur\.franTelefonen\) uppdragsavsikt = null;/, 'inga uppdrag ur telefonen');
  assert.match(srv, /!tur\.franTelefonen && Handelse\.avsikt/, 'inga möten ur telefonen');
  assert.match(srv, /begransad: Boolean\(tur\.franTelefonen\)/, 'verktygen i begränsat läge');
  assert.match(srv, /if \(begransad\) throw new Error\(tx\('srv\.verktyg\.inteTelefon'\)\);/, 'ingen webbsökning');
  assert.match(srv, /sp === 'far' && !begransad/, 'handlingar väntar alltid på ja');
  const i = srv.indexOf('async function lasFranTelefonen');
  const kropp = srv.slice(i, srv.indexOf('\n}\n', i));
  assert.doesNotMatch(kropp, /\.svar\)?\.(slice|split|replace)/, 'inget ur svaret till telefonen');
  assert.match(kropp, /minSession\(h\.session, null\)/, 'sessionen genom minSession');
});

// Engelska (fas 3): raden följer språket, och båda språkens rad räknas
// aldrig som ditt svar — också efter ett språkbyte.
test('svarsraden på båda språken räknas aldrig som svar', async () => {
  const S = await import('../lib/sprakstod.mjs');
  const en = S.med('en', () => Telefon.svarsrad());
  assert.match(en, /^Reply to Maximus/);
  assert.equal(S.med('sv', () => Telefon.svarsrad()), Telefon.SVARSRAD);
  assert.equal(Telefon.svarUr(`${en}\nBook the meeting.`), 'Book the meeting.');
  assert.equal(Telefon.svarUr(`${Telefon.SVARSRAD}\nBoka mötet.`), 'Boka mötet.');
});
