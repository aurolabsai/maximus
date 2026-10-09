import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validera, beskriv, spak, nyttForslag, angra, HANDLINGAR, detaljer, begarPaus } from '../lib/handlingar.mjs';
import { avsikt } from '../lib/verktygsfraga.mjs';
import { skapaVerktyg } from '../lib/verktyg.mjs';
import { medSvenska } from './svenskan.mjs';

test('förslaget prövas och beskrivs innan det visas', () => {
  assert.equal(validera('mote', { titel: 'X' }), 'Mötet behöver en starttid.');
  assert.equal(validera('mote', { titel: 'X', start: '2030-10-06T10:00', slut: '2030-10-06T09:00' }), 'Mötet slutar innan det börjar.');
  assert.equal(validera('mejlutkast', { amne: 'a', text: 'b', till: 'inte en adress' }), 'Mottagaren är ingen e-postadress.');
  assert.equal(validera('genvag', { namn: 'Finns ej' }, { genvagar: ['Annan'] }), 'Det finns ingen genväg som heter "Finns ej".');
  assert.equal(validera('paminnelse', { titel: 'Ring Henrik' }), null);
  assert.match(beskriv('mejlutkast', { till: 'r@x.se', amne: 'Hej', text: 't' }), /skickas inte/);
});

test('spaken: fråga är förval; ångra bara det som går', async () => {
  assert.equal(spak({}, 'paminnelse'), 'fraga');
  assert.equal(spak({ handlingar: { genvag: 'aldrig' } }, 'genvag'), 'aldrig');
  assert.equal(spak({ handlingar: { genvag: 'rm -rf' } }, 'genvag'), 'fraga', 'skräp blir förvalet');
  const f = nyttForslag({ typ: 'mejlutkast', argument: { amne: 'a', text: 'b' } });
  f.status = 'gjord';
  await assert.rejects(() => angra(f, {}), /går inte att ångra/);
});

test('handlingarna är verktyg bara när servern ger en väg för förslag', () => {
  assert.ok(!skapaVerktyg({}, {}).some(v => v.handling));
  const v = skapaVerktyg({ foresla: async () => 'ok' }, {});
  assert.deepEqual(v.filter(x => x.handling).map(x => x.namn).sort(), Object.values(HANDLINGAR).map(h => h.verktyg).sort());
});

test('"påminn mig" och "skapa en påminnelse" går till agentens verktyg', () => {
  assert.ok(avsikt('Påminn mig att ringa Henrik i morgon klockan 9').kallor.includes('handling'));
  assert.ok(avsikt('Skapa en påminnelse: köp mjölk').kallor.includes('handling'));
  assert.equal(avsikt('skriv ett mejl till Henrik'), null);
});

test('utkastet skickas aldrig; läsarna har fortfarande inga skrivverb', async () => {
  const u = await readFile(new URL('../lib/utkastmail.mjs', import.meta.url), 'utf8');
  const kod = u.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
  assert.doesNotMatch(kod, /\bsend\b/i, 'utkastmail.mjs får inte kunna skicka');
  const post = await readFile(new URL('../lib/post.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(post, /make new outgoing|\bsend\b|\bsave\b/i);
  for (const f of ['kalender.swift', 'paminnelser.swift']) {
    const t = await readFile(new URL(`../verktyg/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(t, /\.save\(|\.remove\(/, `${f} skriver`);
  }
});

// Granskningen 2026-10-09: kortet visar allt som utförs, inte bara en mening.
test('kortets fält: allt som skickas, också genvägens indata och utkastets text', () => {
  assert.deepEqual(detaljer('genvag', { namn: 'Skicka', indata: 'hemligt' }), [['Genväg', 'Skicka'], ['Indata', 'hemligt']]);
  assert.deepEqual(detaljer('mejlutkast', { till: 'a@b.se', amne: 'Hej', text: 'Brödtext' }), [['Till', 'a@b.se'], ['Ämne', 'Hej'], ['Text', 'Brödtext']]);
  assert.deepEqual(detaljer('anteckning', { rubrik: 'R', text: 'T' }), [['Rubrik', 'R'], ['Text', 'T']]);
  const m = detaljer('mote', { titel: 'M', start: '2026-10-12T09:00', slut: '2026-10-12T10:00', plats: 'P', anteckning: 'A' });
  assert.deepEqual(m.map(x => x[0]), ['Rubrik', 'Start', 'Slut', 'Plats', 'Anteckning']);
  assert.deepEqual(detaljer('paminnelse', { titel: 'P', forfaller: '2026-10-12T09:00', anteckning: 'dold' }).map(x => x[0]), ['Rubrik', 'Tid', 'Anteckning']);
  assert.deepEqual(nyttForslag({ typ: 'genvag', argument: { namn: 'X', indata: 'in' } }).detaljer, [['Genväg', 'X'], ['Indata', 'in']]);
});

test('paus bara när du själv bad om den', () => {
  for (const t of ['pausa allt till måndag', 'Pausa bevakningen', 'stoppa uppdraget om LOU', 'stop all tasks', 'vänta med inkorgen', 'hold everything', 'pause the jobs']) assert.ok(begarPaus(t), t);
  for (const t of ['vad hände i natt?', 'vad väntar på mig?', 'sammanfatta mejlen', '', 'kör uppdraget nu']) assert.ok(!begarPaus(t), t);
});

test('kortet ritar fälten som text, med Visa allt för lång text', async () => {
  const app = medSvenska(await readFile(new URL('../public/app.js', import.meta.url), 'utf8'));
  const i = app.indexOf('function ritaHandlingsdetaljer');
  const f = app.slice(i, app.indexOf('\n}\n', i));
  assert.match(f, /textContent: text/);
  assert.match(f, /Visa allt/);
  assert.doesNotMatch(f, /innerHTML/);
  assert.match(app, /const detalj = ritaHandlingsdetaljer\(h\);/);
});
