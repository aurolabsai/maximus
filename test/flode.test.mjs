/// Ditt LinkedIn-flöde (Fas 47 del 2): skriptet i fliken, posterna ur det,
/// och påminnelsen om exporten. Skriptet provas mot en påhittad sida — aldrig
/// mot din riktiga Safari.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import * as Flode from '../lib/flode.mjs';

const S = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const ram = (u, svar) => `${S}\n${u}\n${svar}\n`;

const SIDA = `<html><head><title>Feed | LinkedIn</title></head><body>
<div data-urn="urn:li:activity:111"><span class="update-components-header__text-view">Anna gillar det här</span>
  <span class="update-components-actor__title">Karin Ek</span><span class="update-components-actor__description">Inköpschef, Region Kronoberg</span>
  <div class="update-components-text">Ny ramupphandling av IT-konsulter
Sista dag för anbud är 1 november.</div></div>
<div data-urn="urn:li:activity:222"><span class="update-components-actor__title">Lovable</span>
  <div class="update-components-text">We are hiring a Partnerships Manager.</div></div>
</body></html>`;

test('skriptet i fliken läser inläggen med id, avsändare och text', async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  // Sidan serveras under LinkedIns adress — inget lämnar datorn, routen svarar.
  await p.route('**/*', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: SIDA }));
  await p.goto('https://www.linkedin.com/feed/');
  const ut = await p.evaluate(Flode.SIDSKRIPT);
  // Samma sida under en annan värd läses inte alls.
  await p.goto('https://annan.example/linkedin.com/feed/');
  const annan = await p.evaluate(Flode.SIDSKRIPT);
  await b.close();
  assert.equal(annan, '');
  const d = JSON.parse(ut);
  assert.equal(d.poster.length, 2);
  assert.equal(d.poster[0].id, 'urn:li:activity:111');
  assert.equal(d.poster[0].av, 'Karin Ek');
  assert.match(d.poster[0].text, /ramupphandling/);
  assert.equal(d.poster[0].varfor, 'Anna gillar det här');
});

test('poster: en per inlägg, bara flödes- och aktivitetssidor, inga dubbletter', () => {
  const d = u => ram(u, JSON.stringify({ poster: [{ id: 'urn:li:activity:1', av: 'Karin Ek', om: 'Inköpschef', text: 'Ny upphandling\nmer text' }] }));
  const ut = d('https://www.linkedin.com/feed/') + d('https://www.linkedin.com/feed/') + d('https://www.linkedin.com/jobs/');
  const p = Flode.poster(ut, { skiljare: S });
  assert.equal(p.length, 1);
  assert.equal(p[0].id, 'linkedin:urn:li:activity:1');
  assert.equal(p[0].titel, 'Karin Ek: Ny upphandling');
  assert.match(p[0].text, /^LinkedIn, ditt flöde\./);
  const r = Flode.poster(d('https://www.linkedin.com/in/auro/recent-activity/reactions/'), { skiljare: S });
  assert.match(r[0].text, /det du reagerat på/);
});

test('poster: utan igenkända inlägg blir sidans text block', () => {
  const lang = 'Ett inlägg om upphandling som är tillräckligt långt för att räknas som ett block i flödet, och lite till.';
  const p = Flode.poster(ram('https://www.linkedin.com/feed/', JSON.stringify({ poster: [], text: `Kort\n\n${lang}\n\n${lang} igen` })), { skiljare: S });
  assert.equal(p.length, 2);
  assert.match(p[0].text, /läst som text/);
});

test('AppleScriptet går att kompilera och startar aldrig Safari', () => {
  const dir = mkdtempSync(join(tmpdir(), 'flode-'));
  const f = join(dir, 's.applescript');
  writeFileSync(f, Flode.applescript(S));
  execFileSync('/usr/bin/osacompile', ['-o', join(dir, 's.scpt'), f]);
  assert.match(Flode.applescript(S), /if application "Safari" is not running then return ""/);
  assert.match(Flode.applescript(S), /u starts with "https:\/\/www\.linkedin\.com\/"/);
  assert.throws(() => Flode.applescript(''));
  assert.doesNotMatch(Flode.SIDSKRIPT, /click\(|scroll|submit|\.value\s*=/);
});

test('påminnelsen om exporten: efter en månad, och sedan en gång i månaden', () => {
  const nu = new Date('2026-11-10T08:00:00Z');
  assert.equal(Flode.paminnaOmExport({ inlast: '2026-10-20T00:00:00Z' }, { nu }), false);
  assert.equal(Flode.paminnaOmExport({ inlast: '2026-10-01T00:00:00Z' }, { nu }), true);
  assert.equal(Flode.paminnaOmExport({ inlast: '2026-10-01T00:00:00Z' }, { senast: '2026-11-01T00:00:00Z', nu }), false);
  assert.equal(Flode.paminnaOmExport(null, { nu }), false);
});

test('arFlode tolkar adressen: värden ska vara LinkedIn', () => {
  assert.equal(Flode.arFlode('https://www.linkedin.com/feed/'), true);
  assert.equal(Flode.arFlode('https://linkedin.com/in/auro/recent-activity/comments/'), true);
  assert.equal(Flode.arFlode('https://annan.se/?x=linkedin.com/feed'), false);
  assert.equal(Flode.arFlode('https://annan.se/linkedin.com/feed/'), false);
  assert.equal(Flode.arFlode('https://linkedin.com.annan.se/feed/'), false);
  assert.equal(Flode.arFlode('http://www.linkedin.com/feed/'), false);
  assert.equal(Flode.arFlode('https://www.linkedin.com/jobs/'), false);
  // Posterna från en sida som utger sig för att vara flödet släpps inte in.
  assert.equal(Flode.poster(ram('https://annan.se/linkedin.com/feed', JSON.stringify({ poster: [{ id: 'x', text: 'hej' }] })), { skiljare: S }).length, 0);
  // En sida som påstår sig vara LinkedIn i sitt eget svar räknas inte:
  // adressen kommer från Safari, inte från sidan.
  assert.equal(Flode.poster(ram('https://annan.se/', JSON.stringify({ url: 'https://www.linkedin.com/feed/', poster: [{ id: 'x', text: 'hej' }] })), { skiljare: S }).length, 0);
  // En sida som gissar på en avgränsare och lägger en påhittad LinkedIn-flik
  // efter den: avgränsaren är slumpad per läsning, så det blir en enda
  // ogiltig del.
  const falsk = `{}\n-----MAXIMUS-----\nhttps://www.linkedin.com/feed/\n${JSON.stringify({ poster: [{ id: 'x', text: 'falskt' }] })}`;
  assert.equal(Flode.poster(ram('https://annan.se/', falsk), { skiljare: S }).length, 0);
  // Utan skiljare läses ingenting.
  assert.equal(Flode.poster(ram('https://www.linkedin.com/feed/', '{"poster":[{"id":"1","text":"x"}]}')).length, 0);
});

test('dina egna inlägg läses inte som någon annans', () => {
  const svar = JSON.stringify({ jag: 'Henrik Lindgren', poster: [
    { id: 'urn:li:activity:1', av: 'Henrik Lindgren', text: 'Mitt inlägg om distribution' },
    { id: 'urn:li:activity:2', av: 'Amir Nasser Nasser', text: 'Om automation och AI-infrastruktur' }] });
  const p = Flode.poster(ram('https://www.linkedin.com/feed/', svar), { skiljare: S });
  assert.deepEqual(p.map(x => x.id), ['linkedin:urn:li:activity:2']);
  // Namnet kan också komma ur profilen, och skrivas med accenter eller titel.
  const svar2 = JSON.stringify({ poster: [{ id: 'urn:li:activity:3', av: 'Hénrik Lindgren, Business Developer', text: 'x' }] });
  assert.equal(Flode.poster(ram('https://www.linkedin.com/feed/', svar2), { skiljare: S, jag: ['Henrik Lindgren'] }).length, 0);
  assert.equal(Flode.arMitt('Henrik', ['Henrik Lindgren']), false, 'ett förnamn ensamt är inte du');
});
