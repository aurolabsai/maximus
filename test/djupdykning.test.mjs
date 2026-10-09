import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../lib/djupdykning.mjs';

test('adresserna ur mandatet', () => {
  assert.deepEqual(D.adresserUr('Jag ska till https://www.scc.org.uk/events/e-280 . Go.'), ['https://www.scc.org.uk/events/e-280']);
});

test('personerna läses, dubbletter och ensamma förnamn bort, och bara de som står i texten', () => {
  const r = D.lasPersoner('{"amne":"DIF 2026","personer":[{"namn":"Johan Bergqvist","roll":"CFO","org":"Mistral AI","var":"talare"},{"namn":"johan bergqvist"},{"namn":"Anna"},{"namn":"Påhittad Person","org":"X"}]}');
  assert.equal(r.amne, 'DIF 2026');
  assert.deepEqual(r.personer.map(p => p.namn), ['Johan Bergqvist', 'Påhittad Person']);
  assert.deepEqual(D.iTexten(r.personer, 'Panel: Johan Bergqvist, CFO, Mistral').map(p => p.namn), ['Johan Bergqvist']);
});

test('läget: bara fakta med adress räknas', () => {
  const f = D.lasFakta('FAKTA:\n- DSIT lades ned i juli 2026 (källa: https://ukauthority.com/x, 2026-07-29)\n- Något ur minnet utan källa alls här\n');
  assert.equal(f.length, 1);
  assert.equal(f[0].url, 'https://ukauthority.com/x');
  assert.match(f[0].text, /^DSIT lades ned/);
});

test('en akt läses fält för fält, och utan källa sjunker säkerheten', () => {
  const a = D.lasAkt(`ROLL: CFO, Mistral AI
BAKGRUND: Tidigare Spotify och Bolt.
UTTALANDEN:
- "on track toward $1B ARR" (källa: https://reuters.com/a, sep 2026)
VARFÖR: Open-weight går att köra lokalt.
ÖPPNING: How do you reach the long tail?
ASK: En kontakt i nordiska teamet.
SÄKERHET: hög
OVERIFIERAT: om han är svensk`, { namn: 'Johan Bergqvist' });
  assert.equal(a.roll, 'CFO, Mistral AI');
  assert.equal(a.uttalanden[0].url, 'https://reuters.com/a');
  assert.equal(a.sakerhet, 'hög');
  assert.equal(a.overifierat, 'om han är svensk');
  assert.equal(D.lasAkt('ROLL: X\nSÄKERHET: hög', { namn: 'Y Z' }).sakerhet, 'medel', 'hög utan källa blir medel');
  assert.ok(D.lasAkt('ingenting', { namn: 'Y Z' }).tom);
});

test('urvalet: bara personer som finns, och A-listan fylls om modellen tiger', () => {
  const akter = [{ namn: 'A A', roll: 'r', sakerhet: 'låg' }, { namn: 'B B', roll: 'r', sakerhet: 'hög' }];
  assert.deepEqual(D.lasUrval('{"a":["B B","Ingen Alls"],"b":["A A"]}', akter).a.map(x => x.namn), ['B B']);
  assert.deepEqual(D.lasUrval('inget', akter).a.map(x => x.namn), ['B B', 'A A']);
});

test('faktakollen: det som strider, och tal i pitchen utan källa', () => {
  const k = D.lasFaktakoll('{"strider":[{"pastaende":"Labbet kör lokala modeller","regel":"Ingen hårdvara är köpt","istallet":"We are building a small lab"}],"sagInte":["Gratis"]}');
  assert.equal(k.strider[0].istallet, 'We are building a small lab');
  assert.deepEqual(D.talUtanKalla('Over 180 partners and 47 million.', 'AI Sweden har över 180 partners'), ['47']);
});

test('briefen har sina avsnitt, källor och det overifierade', () => {
  const akt = { namn: 'Johan Bergqvist', roll: 'CFO', bakgrund: 'Spotify', uttalanden: [{ text: '"$1B"', url: 'https://r.com' }], varfor: 'Lokalt', oppning: 'Hi', ask: 'Kontakt', sakerhet: 'hög', overifierat: 'svensk?' };
  const md = D.briefMarkdown({ amne: 'DIF 2026', mandat: 'Sätta Växjö på kartan.', laget: [{ text: 'DSIT nedlagt', url: 'https://u.com', datum: 'juli 2026' }],
    akter: [akt], urval: { a: [akt], b: [], matris: [{ fokus: 'Lokal infrastruktur', vem: 'Johan Bergqvist', varfor: 'Open-weight' }], rad: 'Supply side.' },
    avsnitt: { plan: '1. Ankomst' }, koll: { strider: [], sagInte: ['Gratis'], tal: ['47'] }, kallor: [{ namn: 'u.com', url: 'https://u.com' }] });
  for (const r of ['## 0. Mandatet', '## 1. Läget', '| **Lokal infrastruktur** |', '### A-listan', '## 8. Säg INTE', '## 9. Trestegsplanen', 'svensk?', '[källa](https://r.com)']) assert.ok(md.includes(r), r);
});

test('gallringen tar modellens val först och fyller upp till taket', () => {
  const p = ['A A', 'B B', 'C C', 'D D'].map(namn => ({ namn }));
  assert.deepEqual(D.lasGallring('{"valda":["C C","Okänd X"]}', p, 3).map(x => x.namn), ['C C', 'A A', 'B B']);
});

test('en akt med fältnamnen i fetstil läses ändå fält för fält', () => {
  const a = D.lasAkt('ROLL: ** CFO, Mistral AI\n**BAKGRUND:** Spotify och Bolt.\n**VARFÖR:** Lokalt.\n**SÄKERHET:** medel', { namn: 'Johan Bergqvist' });
  assert.equal(a.roll, 'CFO, Mistral AI');
  assert.equal(a.bakgrund, 'Spotify och Bolt.');
  assert.equal(a.varfor, 'Lokalt.');
});

test('läget söker nyheter om organisationerna, inte eventet', () => {
  const t = D.lagetUppgift({ amne: 'DIF', mandat: 'x', personer: [{ org: 'Mistral AI' }, { org: 'Ericsson' }] });
  assert.match(t, /Mistral AI, Ericsson/);
  assert.match(t, /sök INTE på evenemanget/);
});

test('citat och fakta utan spårbar källa plockas bort och sägs', () => {
  const akt = { namn: 'J B', sakerhet: 'hög', overifierat: '', uttalanden: [{ text: '"Påhittat"', url: null }, { text: '"Läst"', url: 'https://r.com/a' }, { text: '"Annan sida"', url: 'https://x.com' }] };
  const v = D.verifiera(akt, [{ url: 'https://r.com/a' }]);
  assert.deepEqual(v.uttalanden.map(u => u.text), ['"Läst"']);
  assert.match(v.overifierat, /bortplockade: "Påhittat" · "Annan sida"/);
  assert.equal(D.verifiera(akt, []).sakerhet, 'medel', 'inget spårbart: inte hög säkerhet');
  assert.deepEqual(D.verifieraFakta([{ text: 'a', url: 'https://u.com/1' }, { text: 'b', url: 'https://ej.com' }], [{ url: 'https://u.com/1' }]).map(f => f.text), ['a']);
});

// ── Källor som domän (2026-10-06) ────────────────────────────────────────
test('en källa som bara är en domän knyts till sidan som lästes där', () => {
  const kallor = [{ url: 'https://www.ericsson.com/en/reports-and-papers/mobility-report' }, { url: 'https://www.ericsson.com/en/news/2026/6/national-test-center-for-5g-6g-and-ai' },
    { url: 'https://blog.arelion.com/2026/01/05/nordic-blueprint/' }];
  const f = D.lasFakta([
    'FAKTA:',
    '- **Ericsson** har lanserat ett nationellt testcenter för 5G, 6G och AI (källa: ericsson.com, 2026-06-01).',
    '- Arelion har lanserat The Nordic Blueprint för Europas AI-infrastruktur (källa: blog.arelion.com, 2026-04-21).',
    '- Mistral har tagit in 4,4 miljarder dollar i en ny runda (källa: straitstimes.com, 2026-09-15).',
  ].join('\n'), kallor);
  assert.equal(f.length, 2, 'en domän slingan aldrig såg räknas inte');
  assert.equal(f[0].url, 'https://www.ericsson.com/en/news/2026/6/national-test-center-for-5g-6g-and-ai', 'sidan vars adress passar påståendet');
  assert.doesNotMatch(f[0].text, /källa/);
  assert.equal(D.verifieraFakta(f, kallor).length, 2);
});

test('ett uttalande med domän som källa står kvar om domänen lästes', () => {
  const a = D.lasAkt('ROLL: VD på X\nUTTALANDEN:\n- "Vi bygger lokalt" (källa: x.se, 2026)\n- inga\nVARFÖR: passar', { namn: 'A' });
  assert.equal(a.uttalanden.length, 1, '"inga" är inget uttalande');
  const v = D.verifiera(a, [{ url: 'https://www.x.se/intervju' }]);
  assert.equal(v.uttalanden[0].url, 'https://www.x.se/intervju');
  assert.equal(D.verifiera(a, [{ url: 'https://annan.se/' }]).uttalanden.length, 0);
});

test('långa och trasiga rader tar ingen tid och kraschar inget', () => {
  const t0 = Date.now();
  for (const r of ['källa: ' + 'a'.repeat(50000), 'källa: ' + 'a.'.repeat(30000) + '!', 'källa: ' + 'a-'.repeat(40000)]) D.kallaPaRad(r);
  assert.ok(Date.now() - t0 < 200, `tog ${Date.now() - t0} ms`);
  assert.equal(D.forankra('x.se', [{ url: 'https://x.se/%E0%A4%A' }, { url: 'https://x.se/budget-rapport' }, { url: 'inte en adress' }], 'Budget rapport'), 'https://x.se/budget-rapport');
  assert.equal(D.kallaPaRad('(källa: x.se, 2026)').doman, 'x.se');
  assert.equal(D.kallaPaRad('(källa: blog.arelion.com, 2026)').doman, 'blog.arelion.com');
});

// Engelska (fas 3)
test('akten läses med engelska markörer, och briefen följer språket', async () => {
  const S = await import('../lib/sprakstod.mjs');
  const a = D.lasAkt('ROLE: CFO, Mistral AI\nBACKGROUND: Was at Google.\nSTATEMENTS:\n- "We build sovereign AI" (source: https://x.com/a, 2026)\nWHY: Fits the mandate.\nOPENING: "Hi"\nASK: A meeting\nCONFIDENCE: high\nUNVERIFIED: nothing', { namn: 'A B' });
  assert.equal(a.roll, 'CFO, Mistral AI');
  assert.equal(a.bakgrund, 'Was at Google.');
  assert.equal(a.uttalanden[0].url, 'https://x.com/a');
  assert.equal(a.sakerhet, 'hög');
  assert.equal(a.overifierat, '');
  S.med('en', () => {
    assert.equal(D.FASNAMN.akter, 'Writing the profiles');
    assert.match(D.aktUppgift({ person: { namn: 'A B' }, mandat: 'M', amne: 'E' }), /ROLL:[\s\S]*in English[\s\S]*ROLL:/);
    const md = D.briefMarkdown({ amne: 'E', mandat: 'M', laget: [], akter: [], urval: { a: [], b: [], matris: [], rad: '' }, avsnitt: {}, koll: { strider: [], sagInte: [] }, kallor: [] });
    assert.match(md, /## 0\. The mandate/);
    assert.doesNotMatch(md, /[åäö]/);
  });
  S.med('sv', () => assert.equal(D.FASNAMN.akter, 'Skriver akterna'));
});
