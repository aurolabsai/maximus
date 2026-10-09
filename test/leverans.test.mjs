import { test } from 'node:test';
import assert from 'node:assert/strict';
import { antal, lasDisposition, lasAvsnitt, kallorUr, lasGranskning, byggPptx, byggDocx, dispositionPrompt, avsnittUppgift } from '../lib/leverans.mjs';

test('längden ger antalet avsnitt', () => {
  assert.equal(antal('presentation', 'kort'), 5);
  assert.equal(antal('dokument', 'lang'), 8);
  assert.match(dispositionPrompt({ sort: 'presentation', mal: 'Få ja', mottagare: 'Styrelsen', langd: 'mellan' }), /Antal avsnitt: 8/);
});

test('dispositionen läses, och skräp blir null', () => {
  const d = lasDisposition('Här: {"titel":"Lansering","avsnitt":[{"rubrik":"Läget","vad":"Var vi står"},{"rubrik":""}]}');
  assert.deepEqual(d, { titel: 'Lansering', avsnitt: [{ rubrik: 'Läget', vad: 'Var vi står' }] });
  assert.equal(lasDisposition('inget json'), null);
});

test('ett avsnitt i en presentation: punkter och manus', () => {
  const a = lasAvsnitt('PUNKTER:\n- Gratis ger spridning\n- Care bär intäkten\nMANUS:\nVi börjar med varför.', 'presentation');
  assert.deepEqual(a, { punkter: ['Gratis ger spridning', 'Care bär intäkten'], manus: 'Vi börjar med varför.' });
  assert.equal(lasAvsnitt('Två stycken.\n\nAndra.', 'dokument').text, 'Två stycken.\n\nAndra.');
  assert.match(avsnittUppgift({ sort: 'presentation', titel: 'T', mal: 'm', mottagare: 'x', avsnitt: { rubrik: 'R', vad: 'v' }, nr: 0, alla: [{ rubrik: 'R' }] }), /PUNKTER:/);
});

test('källorna ur slingans steg', () => {
  const k = kallorUr([
    { verktyg: 'las_sida', argument: { url: 'https://a.se/x' } },
    { verktyg: 'webbsok', argument: { fraga: 'x' }, kort: '1. A — https://b.se/y\n2. B — https://a.se/x' },
    { verktyg: 'mejl', argument: {} },
    { verktyg: 'las_fil', argument: { fil: '/tmp/mapp/offert.pdf' } },
    { verktyg: 'las_sida', argument: { url: 'https://c.se' }, fel: true },
  ]);
  assert.deepEqual(k.map(x => x.namn), ['https://a.se/x', 'https://b.se/y', 'Inkorgen', 'offert.pdf']);
});

test('granskningen läses', () => assert.deepEqual(lasGranskning('{"anmarkningar":["Avsnitt 2 och 4 säger samma sak."]}'), ['Avsnitt 2 och 4 säger samma sak.']));

test('filerna byggs: PowerPoint och Word', async () => {
  const pptx = await byggPptx({ titel: 'Lansering', undertitel: 'Till styrelsen', avsnitt: [{ rubrik: 'Läget', punkter: ['A', 'B'], manus: 'Säg A.' }], kallor: [{ namn: 'https://a.se', url: 'https://a.se' }] });
  assert.equal(pptx.slice(0, 2).toString(), 'PK');
  const docx = await byggDocx({ titel: 'Lansering', avsnitt: [{ rubrik: 'Läget', text: 'Ett.\n\nTvå.', kallor: [{ namn: 'Inkorgen' }] }] });
  assert.equal(docx.slice(0, 2).toString(), 'PK');
  assert.ok(docx.length > 3000);
});

test('en begäran om inställningar är inget avsnitt', async () => {
  const { arBegaran } = await import('../lib/leverans.mjs');
  assert.ok(arBegaran('För att kunna utföra uppgiften behöver du aktivera mappen för Anteckningar i inställningarna (Inställningar → Agenten).'));
  assert.ok(!arBegaran('PUNKTER:\n- Gratis sänker tröskeln för att prova\n- Betalt kommer när värdet är bevisat\nMANUS:\nVi börjar med varför.'));
});

test('källorna tar alla adresser i ett sökresultat, inte bara de första 300 tecknen', async () => {
  const { kallorUr } = await import('../lib/leverans.mjs');
  const k = kallorUr([{ verktyg: 'webbsok', argument: {}, kort: 'kort', adresser: ['https://a.se', 'https://b.se', 'https://c.se'] }]);
  assert.deepEqual(k.map(x => x.url), ['https://a.se', 'https://b.se', 'https://c.se']);
});

// Engelska (fas 3): markörerna står kvar på svenska i prompten, och de
// engelska läses om modellen skriver dem ändå.
test('avsnittet läses med svenska och engelska markörer', async () => {
  const { lasAvsnitt, avsnittUppgift, kallorUr } = await import('../lib/leverans.mjs');
  const S = await import('../lib/sprakstod.mjs');
  const en = lasAvsnitt('POINTS:\n- One\n- Two\nSCRIPT:\nSay this.', 'presentation');
  assert.deepEqual(en.punkter, ['One', 'Two']);
  assert.equal(en.manus, 'Say this.');
  const sv = lasAvsnitt('PUNKTER:\n- Ett\nMANUS:\nSäg så.', 'presentation');
  assert.deepEqual(sv.punkter, ['Ett']);
  const arg = { sort: 'presentation', titel: 'T', mal: 'M', mottagare: 'R', avsnitt: { rubrik: 'A', vad: 'B' }, nr: 0, alla: [{ rubrik: 'A' }] };
  S.med('en', () => {
    const p = avsnittUppgift(arg);
    assert.match(p, /PUNKTER:/);
    assert.match(p, /Keep these machine markers exactly as written[^\n]*PUNKTER:, MANUS:/);
    assert.equal(kallorUr([{ verktyg: 'mejl' }])[0].namn, 'Inbox');
  });
  S.med('sv', () => assert.doesNotMatch(avsnittUppgift(arg), /English/));
});
