/// Frågorna modellen ställer tillbaka.
///
/// Felet som gör funktionen värdelös är inte att den missar en fråga — det
/// är att den hittar på en. Ett svarsfält under "Vad händer om nämnden
/// avslår?" ber dig svara på något modellen själv besvarar två rader ned,
/// och efter tre sådana slutar man titta på panelen.
///
/// Därför prövas de falska positiva hårdare än de falska negativa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fragorna, sammanstall } from '../public/fragor.js';
import { readFileSync } from 'node:fs';
import { fyllSprak } from '../public/sprakstod.js';

// Meddelandet till modellen bor i public/sprak/ sedan 2026-10-09. I
// webbläsaren läser laddaSprak() filerna; här läses de för hand.
const ordlista = k => JSON.parse(readFileSync(new URL(`../public/sprak/${k}.json`, import.meta.url), 'utf8'));
fyllSprak('sv', ordlista('sv'));

test('frågor till användaren hittas', () => {
  const f = fragorna('För att gå vidare behöver jag veta:\n\n'
    + '- Vilket datum fick du del av beslutet?\n'
    + '- Har du överklagat tidigare?\n'
    + '- Gäller det en nybyggnad eller en tillbyggnad?');
  assert.equal(f.length, 3);
  assert.equal(f[0], 'Vilket datum fick du del av beslutet?');
  // Punktlistans frågor räknas också utan "du" i sig.
  assert.equal(f[2], 'Gäller det en nybyggnad eller en tillbyggnad?');
});

test('en ensam fråga i löpande text räknas när den riktas till dig', () => {
  assert.deepEqual(fragorna('Vill du att jag skriver ett utkast?'),
    ['Vill du att jag skriver ett utkast?']);
});

test('retoriska frågor räknas inte', () => {
  // Ingen andra person, ingen punktform: modellen talar till sig själv.
  assert.deepEqual(fragorna('Vad händer om nämnden avslår? Då går ärendet vidare.'), []);
  assert.deepEqual(fragorna('Men hur ser lagen på saken?'), []);
});

test('rubriker räknas inte', () => {
  assert.deepEqual(fragorna('## Vad behöver du göra nu?\n\nTre saker.'), []);
  assert.deepEqual(fragorna('### Har du rätt att överklaga?'), []);
});

test('citat räknas inte', () => {
  assert.deepEqual(fragorna('> Har du läst beslutet?\n\nDet stod i deras brev.'), []);
});

test('kodblock räknas inte', () => {
  // Med språk. En naken ``` är i MAXIMUS en utkastruta och inte kod — se
  // arUtkast() i md.js — så kodfallet måste vara märkt som kod.
  assert.deepEqual(fragorna('```js\nif (x) { // Vill du köra vidare?\n}\n```'), []);
  // Och raden efter blocket räknas igen.
  assert.equal(fragorna('```js\nkod\n```\n\nVill du att jag förklarar koden?').length, 1);
});

test('bara sista meningen på raden blir frågan', () => {
  assert.deepEqual(fragorna('- Det är oklart vem som äger marken. Vet du det?'),
    ['Vet du det?']);
});

test('punkten i en förkortning är inget meningsslut', () => {
  // Första versionen klippte vid varje punkt, och den här frågan blev
  // "tjänsteavtal, köpeavtal)?" — ett fält som ber om svar på en halv fras.
  assert.deepEqual(fragorna('- Vilken typ av avtal rör det sig om (t.ex. tjänsteavtal, köpeavtal)?'),
    ['Vilken typ av avtal rör det sig om (t.ex. tjänsteavtal, köpeavtal)?']);
  assert.deepEqual(fragorna('- Gäller det bl.a. moms, eller bara avgifter?'),
    ['Gäller det bl.a. moms, eller bara avgifter?']);
});

test('MAXIMUS:s egna rutor är prosa, inte kod', () => {
  // ```utkast, ```mejl, ```underlag är kopierbara texter. 2026-10-01 la
  // modellen alla sina sju frågor i en utkastruta och panelen hittade noll.
  const i = '```utkast\nJag behöver veta:\n\n- Vilka är parterna i avtalet?\n- Vad ska levereras?\n```';
  assert.equal(fragorna(i).length, 2);
  assert.equal(fragorna('```mejl\n- Vill du att jag skickar det i dag?\n```').length, 1);
  // Riktig kod räknas fortfarande inte.
  assert.deepEqual(fragorna('```js\nif (x) // Vill du köra vidare?\n```'), []);
  assert.deepEqual(fragorna('```python\n# Har du installerat paketet?\n```'), []);
});

test('formatering hör till formen, inte till frågan', () => {
  assert.deepEqual(fragorna('- **Vilket datum** fick du beslutet?'),
    ['Vilket datum fick du beslutet?']);
  assert.deepEqual(fragorna('- Har du läst [beslutet](https://x.se)?'),
    ['Har du läst beslutet?']);
});

test('samma fråga två gånger blir ett fält', () => {
  assert.equal(fragorna('- Vilket datum fick du beslutet?\n- Vilket datum fick du beslutet?').length, 1);
});

test('ett tak på antalet', () => {
  const rader = Array.from({ length: 12 }, (_, i) => `- Fråga nummer ${i} till dig?`).join('\n');
  assert.equal(fragorna(rader).length, 6);
  assert.equal(fragorna(rader, { hogst: 2 }).length, 2);
});

test('för korta och för långa rader räknas inte', () => {
  assert.deepEqual(fragorna('- Du?'), []);
  assert.deepEqual(fragorna(`- ${'a'.repeat(260)} du?`), []);
});

test('sammanställningen visar vad som besvarades', () => {
  const ut = sammanstall([
    { fraga: 'Vilket datum?', svar: '12 september' },
    { fraga: 'Har du överklagat?', svar: '  ' },
  ]);
  // Frågan står över sitt svar: ett meddelande med bara "12 september" är
  // obegripligt tre dagar senare.
  assert.match(ut, /^> Vilket datum\?\n\n12 september/);
  // Och det obesvarade sägs rakt ut, i stället för att tigas ihjäl.
  assert.match(ut, /Den här har jag inget svar på än: Har du överklagat\?/);
});

test('inget svar alls ger inget meddelande', () => {
  assert.equal(sammanstall([{ fraga: 'Vilket datum?', svar: '' }]), '');
  assert.equal(sammanstall([]), '');
});

test('modellens upprepning av din egen fråga är ingen begäran', () => {
  // Modellen skriver ofta om uppdraget överst innan den löser det. Sett
  // 2026-10-01: fyra fält som bad användaren svara på frågor hon själv
  // ställt och redan fått svar på. "hur ska JAG svara på de frågorna?"
  const fraga = 'Hur ska detta göras? Vad behövs? Och hur kan vi skapa en prompt utifrån dom svaren?';
  const svar = '1. Hur ska detta göras?\n2. Vad behövs?\n3. Hur kan vi skapa en prompt utifrån dessa svar?\n\n'
    + 'Svaret följer här. '.repeat(120);
  assert.deepEqual(fragorna(svar, { fraga }), []);
  // Och omskrivningen i förbifarten — "dom svaren" blir "dessa svar" —
  // får inte få jämförelsen att missa.
  assert.deepEqual(fragorna('- Hur kan vi skapa en prompt utifrån dessa svar?', { fraga }), []);
});

test('frågor till dig står sist, inte som innehållsförteckning', () => {
  const rubriker = '1. Vad behövs?\n2. Vad behöver beaktas?\n\n' + 'Och här är svaren. '.repeat(120);
  assert.deepEqual(fragorna(rubriker), [], 'rubriker överst lästes som frågor');
  // Samma frågor sist i samma längd är en begäran.
  const sist = 'Här är planen. '.repeat(120) + '\n\n- Vad behövs från er?\n- Vad behöver beaktas hos er?';
  assert.equal(fragorna(sist).length, 2);
  // Och ett kort svar som nästan BARA är frågor har ingen senare del att
  // stå i — det är just vad panelen finns för.
  assert.equal(fragorna('Jag behöver veta:\n\n- Vilket datum fick du beslutet?\n- Vilken kommun?').length, 2);
});

test('på engelska: frågor till dig hittas, och det obesvarade sägs på engelska', () => {
  const f = fragorna('Before I go on I need to know. When did you receive the decision?');
  assert.deepEqual(f, ['When did you receive the decision?']);
  // Meningsgränsen är språkneutral: versalen efter punkten, vilken som helst.
  assert.deepEqual(fragorna('Det här vet jag. Är det din fastighet?'), ['Är det din fastighet?']);
  fyllSprak('en', ordlista('en'));
  try {
    const ut = sammanstall([{ fraga: 'Which date?', svar: 'The 12th' }, { fraga: 'Did you appeal?', svar: '' }]);
    assert.match(ut, /I don't have an answer to this one yet: Did you appeal\?/);
  } finally { fyllSprak('sv', ordlista('sv')); }
});
