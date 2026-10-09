/// Profilen.
///
/// Det agenten saknade mest: vem den sorterar åt. En sorterare utan profil
/// gissar på det som LÅTER viktigt — stora ord, röda flaggor, brådska — inte
/// på det som faktiskt rör dig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Profil from '../lib/profil.mjs';
import * as Agent from '../lib/agent.mjs';

const P = { vem: 'Enhetschef på ett gruppboende', arbetar: 'Personalärenden och upphandling',
  vill: 'Få igenom skolskjutsupphandlingen utan överprövning' };

test('tomma fält utelämnas, de står inte som streck', () => {
  // En rad som säger att något saknas är en rad modellen försöker tolka.
  const t = Profil.somText({ vem: 'Enhetschef', arbetar: '', vill: '' });
  assert.match(t, /Användaren är: Enhetschef/);
  assert.ok(!/arbetar med/.test(t), 'ett tomt fält stod kvar i prompten');
  assert.equal(Profil.somText(Profil.TOM), '');
});

test('ordningen ligger still', () => {
  // Allt före det första som ändras ligger kvar i KV-cachen. Byter fälten
  // plats räknas allt om, varje slag.
  const t = Profil.somText(P);
  assert.ok(t.indexOf('Användaren är') < t.indexOf('Arbetar med'));
  assert.ok(t.indexOf('Arbetar med') < t.indexOf('Vill uppnå'));
});

test('ett mål ändrar frågan triagen ställer sig', () => {
  // Utan mål: "angår det här uppdraget?" Med mål: "för det henne närmare
  // eller längre från det hon vill?" Det är en annan fråga.
  const utan = Profil.fragan({ vem: 'Chef' }, 'bevaka upphandlingen');
  const med = Profil.fragan(P, 'bevaka upphandlingen');
  assert.match(utan, /angår uppdraget/);
  assert.ok(!/närmare/.test(utan));
  assert.match(med, /närmare eller längre/);
  assert.match(med, /utan överprövning/);
});

test('profilen står först i prompten', () => {
  const p = Agent.triagePrompt({ instruktion: 'bevaka upphandlingen', profil: P,
    poster: [{ id: 'a', titel: 'Anbud', text: 'x' }] });
  assert.ok(p.indexOf('Enhetschef') < p.indexOf('BILAGA'), 'profilen hamnade efter posterna');
  assert.ok(p.indexOf('Enhetschef') < p.indexOf('Uppdraget, ordagrant'),
    'profilen står efter uppdraget — då räknas den om när uppdraget byts');
});

test('en sträng som profil går fortfarande', () => {
  // Äldre anrop skickade `installningar.policy` som en sträng. Den ska inte
  // falla på golvet bara för att formen bytts.
  const p = Agent.triagePrompt({ instruktion: 'x', profil: 'Enhetschef i en kommun',
    poster: [{ id: 'a', titel: 'y' }] });
  assert.match(p, /Enhetschef i en kommun/);
});

test('fälten klipps, och taket är funktion inte sparsamhet', () => {
  // Profilen står först i varje prompt och räknas aldrig om. En profil på
  // tre sidor äter kontexten som posterna behöver.
  const lang = Profil.las({ vem: 'a'.repeat(900) });
  assert.equal(lang.vem.length, Profil.TAK);
});

test('profilen skrivs av dig, inte av modellen', async () => {
  // En profil du inte känner igen dig i är en profil du inte litar på, och
  // det den gör med den blir obegripligt.
  const src = await (await import('node:fs/promises')).readFile(
    new URL('../lib/profil.mjs', import.meta.url), 'utf8');
  assert.match(src, /Den föreslås, aldrig sätts/);
  // Förslaget bygger på det DU döpt saker till, inte på vad en modell tyckte.
  const f = Profil.forslag({ rubriker: ['Klagomål mot medarbetare'], projekt: ['Upphandling'] });
  assert.match(f.underlag, /Projekt: Upphandling/);
  assert.match(f.underlag, /Klagomål mot medarbetare/);
  assert.equal(Profil.forslag({}), null, 'ett förslag utan underlag är en gissning');
});

test('ett oläsbart förslag blir tomt, inte gissat', () => {
  assert.equal(Profil.lasForslag('jag kan tyvärr inte'), null);
  const d = Profil.lasForslag('visst! {"vem":"Chef","arbetar":"HR","vill":"lugn"} hoppas det hjälper');
  assert.deepEqual(d, { vem: 'Chef', arbetar: 'HR', vill: 'lugn', intressen: '' });
});

test('profilen lämnar aldrig datorn', async () => {
  const srv = await (await import('node:fs/promises')).readFile(
    new URL('../server.mjs', import.meta.url), 'utf8');
  // Den får gå till den lokala modellen. Den får inte gå in i en sökfråga.
  const sok = srv.indexOf('anonymSokfraga');
  if (sok > 0) {
    const nara = srv.slice(Math.max(0, sok - 600), sok + 600);
    assert.ok(!/profil/i.test(nara), 'profilen nämns intill sökfrågan');
  }
});

test('det som tar bort framsteg väger lika tungt som det som ger', () => {
  // Blind fläck, mätt 2026-10-03: konsultprofilen missade "Vi pausar
  // uppdraget till efter nyår" mot målet "tre månader bokade före
  // december". Modellen läste "närmare eller längre" och hörde bara
  // "närmare". Att något försvinner är lika mycket en förändring som att
  // något tillkommer, och det måste stå uttryckligen.
  const f = Profil.fragan(P, 'bevaka uppdragen');
  assert.match(f, /TAR BORT framsteg väger lika tungt/);
  assert.match(f, /drar sig ur/);
  // Och den ska säga att artig formulering inte gör något ofarligt.
  assert.match(f, /artigt skrivet/);
});
