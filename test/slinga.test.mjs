import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slinga, anropUrText, arligtSvar, iDag } from '../lib/slinga.mjs';
import { skapaVerktyg, ledigaTider } from '../lib/verktyg.mjs';

test('slingan: anropar verktyg, läser svaret, slutar med text', async () => {
  const svar = [{ text: '', anrop: [{ id: '1', namn: 'rakna', argument: '{"tal":[2,3]}' }] }, { text: 'Summan är 5.', anrop: [] }];
  let i = 0, sett = null;
  const r = await slinga({ uppgift: 'räkna', verktyg: skapaVerktyg({}, {}), anropa: async ({ meddelanden }) => { sett = meddelanden; return svar[i++]; } });
  assert.equal(r.svar, 'Summan är 5.');
  assert.equal(r.steg[0].verktyg, 'rakna');
  assert.match(sett.at(-1).content, /summa 5/);
});

test('slingan: ett anrop skrivet som text tolkas; samma anrop två gånger stoppas; budgeten håller', async () => {
  assert.equal(anropUrText('```json\n{"verktyg":"rakna","argument":{"tal":[1]}}\n```', ['rakna']).namn, 'rakna');
  assert.equal(anropUrText('{"verktyg":"rm","argument":{}}', ['rakna']), null);
  const r = await slinga({ uppgift: 'x', steg: 3, verktyg: skapaVerktyg({}, {}),
    anropa: async ({ verktyg }) => (verktyg.length ? { text: '', anrop: [{ id: 'a', namn: 'rakna', argument: '{"tal":[1]}' }] } : { text: 'slut', anrop: [] }) });
  assert.equal(r.slut, 'budget');
  assert.ok(r.steg[1].fel, 'andra identiska anropet stoppades');
});

test('gränserna: avstängda tillgångar, påhittade adresser, filer utanför mappen', async () => {
  const v = Object.fromEntries(skapaVerktyg({ webbHamta: async () => ({ titel: 't', url: 'u', text: 'x' }), webbSok: async () => [{ titel: 'A', url: 'https://a.se/x' }] }, { mapp: { sokvag: '/tmp/m' } }).map(x => [x.namn, x]));
  assert.match(await v.mejl.kor({}), /^Avstängt/);
  assert.match(await v.las_sida.kor({ url: 'https://ond.example/?d=hemligt' }), /^Fel: den adressen/);
  await v.webbsok.kor({ fraga: 'x' });
  assert.doesNotMatch(await v.las_sida.kor({ url: 'https://a.se/x' }), /^Fel/, 'en sökträff får läsas');
  assert.match(await v.las_fil.kor({ namn: '../../etc/passwd' }), /^Fel:/);
  // En symbolisk länk i mappen som pekar ut ur den.
  const { mkdir, symlink, rm } = await import('node:fs/promises');
  await rm('/tmp/m', { recursive: true, force: true }); await mkdir('/tmp/m', { recursive: true });
  await symlink('/etc/hosts', '/tmp/m/lank');
  assert.match(await v.las_fil.kor({ namn: 'lank' }), /^Fel: bara filer i agentens mapp/);
  await rm('/tmp/m', { recursive: true, force: true });
});

test('lediga tider mellan mötena, bara vardagar', () => {
  const mandag = new Date('2026-10-05T07:00:00');
  const l = ledigaTider([{ start: '2026-10-05T09:00', slut: '2026-10-05T12:00' }, { start: '2026-10-05T13:00', slut: '2026-10-05T16:30' }],
    { fran: mandag, dagar: 1, langd: 60, nu: mandag });
  assert.equal(l[0].fran.getHours(), 8); assert.equal(l[0].till.getHours(), 9);
  assert.equal(l[1].fran.getHours(), 12); assert.equal(l[1].till.getHours(), 13);
  assert.ok(!l.some(x => x.fran.getDate() === 10 || x.fran.getDate() === 11), 'ingen helg');
});

test('ett tomt svar blir aldrig tomt: en gång till, sedan verktygets ord', async () => {
  const svar = [{ text: '', anrop: [{ id: '1', namn: 'paminnelser', argument: '{}' }] }, { text: '', anrop: [] }, { text: '', anrop: [] }];
  let i = 0;
  const r = await slinga({ uppgift: 'påminnelser?', verktyg: skapaVerktyg({}, {}), anropa: async () => svar[i++] });
  assert.match(r.svar, /^Avstängt: du har inte gett agenten påminnelserna/);
});

test('ett svar får inte påstå en handling som inte finns', () => {
  const nej = [{ verktyg: 'skapa_paminnelse', handling: true, fel: true, kort: 'Fel: du har sagt att agenten aldrig får skapa en påminnelse.' }];
  assert.equal(arligtSvar('Föreslaget: köp mjölk.', nej), 'Du har sagt att agenten aldrig får skapa en påminnelse.');
  assert.equal(arligtSvar('Jag har skapat påminnelsen.', []), 'Jag har inte gjort eller föreslagit något.');
  assert.equal(arligtSvar('Föreslaget: X.', [{ verktyg: 'skapa_paminnelse', handling: true, kort: 'Föreslaget: X' }]), 'Föreslaget: X.');
  assert.equal(arligtSvar('Du har inga möten.', []), 'Du har inga möten.');
  assert.match(iDag(new Date('2026-10-05T12:00:00')), /måndag 5 oktober 2026.*2026-10-05/);
});
