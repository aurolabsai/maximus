// Namnmodellen på riktigt (Auro 2026-10-10).
//
// De 55 fallen ur provet med svensk NER (2026-10-10,
// här kopierade till test/korpus/namnmodell-fall.json så att provet följer
// med utan modellbänken), och hela korpusen på 372 fall, genom de fem
// vägarna med modellen påslagen. Kraven:
//
//   1. Strikt släpper ingenting i de 55 fallen. Personuppgifter släpper bara
//      orter och arbetsplatser — det är vad nivån lovar att låta stå.
//   2. Modellen tar aldrig bort: allt reglerna maskerar ensamma är maskerat
//      också med modellen, i varje väg.
//   3. Ofarliga meningar får inte fler platshållare än reglerna ger dem.
//   4. Korpusens tre krav (test/maskering-korpus.test.mjs) håller med modellen.
//   5. En kort text tar några tiotal millisekunder; ett långt dokument läses
//      i bakgrunden, en gång, och nästa fråga hittar fynden utan att vänta.
//
// Hoppar över sig själv när modellfilen saknas. Den letas där appen lägger
// den (~/models/namnmodell/…), där MAXIMUS_NAMNMODELL pekar, och i
// modellbänkens kopia (~/models/svensk-ner/…).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MODELLFIL = 'int8/model_int8.onnx';
const kandidater = [process.env.MAXIMUS_NAMNMODELL, join(homedir(), 'models', 'namnmodell', 'nym-pii-multilingual-small'),
  join(homedir(), 'models', 'svensk-ner', 'Wismut_nym-pii-multilingual-small')].filter(Boolean);
const katalog = kandidater.find(k => { try { return statSync(join(k, MODELLFIL)).size === 138730982; } catch { return false; } });
const hoppa = process.platform !== 'darwin' ? 'namnmodellen körs bara på Mac'
  : !katalog ? 'modellfilen saknas (hämta den, eller sätt MAXIMUS_NAMNMODELL)' : false;
if (katalog) process.env.MAXIMUS_NAMNMODELL = katalog;

const rot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { korpus, vagarFor, star, platshallare, VAGAR } = await import('./korpus/fall.mjs');
const N = await import('../lib/namnmodell.mjs');
const M = await import('../lib/moln.mjs');
const facit = JSON.parse(readFileSync(new URL('./korpus/facit.json', import.meta.url), 'utf8'));
const utmaning = JSON.parse(readFileSync(new URL('./korpus/namnmodell-fall.json', import.meta.url), 'utf8'))
  .map(f => ({ ...f, vagar: VAGAR, ofarlig: f.kansliga.length === 0 }));
const fall = korpus();
const kor = await vagarFor(rot);

// Reglerna ensamma först, innan modellen läst något: då är fynden tomma.
const regler = new Map();
if (!hoppa) for (const f of [...utmaning, ...fall]) for (const v of VAGAR) regler.set(`${v}\u0000${f.text}`, kor(f, v));

// Sedan läser modellen allt, och tiden per kort text mäts.
const tider = [];
if (!hoppa) {
  assert.equal(await N.namnmodellRedo(), true, 'modellen ska gå att ladda');
  for (const f of [...utmaning, ...fall]) {
    const t0 = performance.now();
    await N.forbered([f.text], { tak: Infinity });
    tider.push(performance.now() - t0);
  }
}

// Orter och arbetsplatser: det Personuppgifter med flit låter stå.
const MA_STA = new Set(utmaning.filter(f => ['ort', 'arbetsplats'].includes(f.kategori)).flatMap(f => f.kansliga)
  .concat(['Mora', 'Kalix', 'Ljungby', 'Croydon', 'Uddevalla', 'Stockholm']));

test('de 55 fallen: Strikt och kedjan släpper ingenting', { skip: hoppa }, () => {
  const fel = [];
  for (const f of utmaning.filter(x => !x.ofarlig)) for (const v of ['strikt', 'maskeraHart']) {
    const ut = kor(f, v);
    const kvar = f.kansliga.filter(o => star(ut, o));
    if (kvar.length) fel.push(`${v}: ${JSON.stringify(f.text)} → ${JSON.stringify(ut)} (${kvar.join(', ')})`);
  }
  assert.deepEqual(fel, []);
});

test('de 55 fallen: Personuppgifter tar namn och adresser, och låter orter och arbetsplatser stå', { skip: hoppa }, () => {
  const fel = [];
  let fore = 0, efter = 0;
  for (const f of utmaning.filter(x => !x.ofarlig)) {
    fore += f.kansliga.filter(o => star(regler.get(`personuppgifter\u0000${f.text}`), o)).length;
    const ut = kor(f, 'personuppgifter');
    const kvar = f.kansliga.filter(o => star(ut, o));
    efter += kvar.length;
    const fel_ = kvar.filter(o => !MA_STA.has(o));
    if (fel_.length) fel.push(`${JSON.stringify(f.text)} → ${JSON.stringify(ut)} (${fel_.join(', ')})`);
  }
  assert.deepEqual(fel, []);
  // Provet 2026-10-10: 27 kvar med reglerna, 16 med modellen (alla orter
  // eller arbetsplatser).
  assert.ok(efter < fore, `modellen ska ta mer än reglerna (${fore} → ${efter})`);
  assert.ok(efter <= 16, `${efter} kvar`);
});

test('modellen tar aldrig bort: det reglerna maskerar är maskerat också med modellen', { skip: hoppa }, () => {
  const fel = [];
  for (const f of [...utmaning, ...fall]) for (const v of VAGAR) {
    const fore = regler.get(`${v}\u0000${f.text}`), ut = kor(f, v);
    const tappade = f.kansliga.filter(o => !star(fore, o) && star(ut, o));
    if (tappade.length) fel.push(`${v}: ${JSON.stringify(f.text)} → ${JSON.stringify(ut)} (${tappade.join(', ')})`);
  }
  assert.deepEqual(fel, []);
});

test('ofarliga meningar får inte fler platshållare än reglerna ger dem', { skip: hoppa }, () => {
  const fel = [];
  for (const f of [...utmaning, ...fall].filter(x => x.ofarlig)) for (const v of VAGAR) {
    const ut = kor(f, v);
    if (platshallare(ut) > platshallare(regler.get(`${v}\u0000${f.text}`))) fel.push(`${v}: ${JSON.stringify(f.text)} → ${JSON.stringify(ut)}`);
  }
  assert.deepEqual(fel, []);
  // lex Maria och lex Sarah är lagar, inga personer: modellen märker dem
  // som förnamn, men ändrar ingenting i dem utöver vad reglerna gör.
  for (const t of ['Hur lång är fristen för lex Maria?', 'Anmälan enligt lex Sarah kom i går.', 'Vad gäller vid en lex Maria-anmälan?'])
    for (const v of VAGAR) assert.equal(kor({ sprak: 'sv', text: t }, v), regler.get(`${v}\u0000${t}`), `${v}: ${t}`);
  for (const v of ['personuppgifter', 'utatGrind', 'maskeraHart'])
    assert.match(kor({ sprak: 'sv', text: 'Hur lång är fristen för lex Maria?' }, v), /lex Maria/, v);
});

test('korpusen (372 fall) håller med modellen: inget läcker, inget tappas, inga fler i ofarliga', { skip: hoppa }, () => {
  const fel = [];
  for (const f of fall) {
    for (const v of f.vagar) {
      const ut = kor(f, v);
      const kvar = f.kansliga.filter(o => star(ut, o));
      if (kvar.length) fel.push(`läcker ${v}: ${JSON.stringify(f.text)} → ${JSON.stringify(ut)} (${kvar.join(', ')})`);
    }
    for (const v of VAGAR) {
      const ut = kor(f, v);
      const tappade = (facit[f.text]?.[v]?.maskerade || []).filter(o => star(ut, o));
      if (tappade.length) fel.push(`tappar ${v}: ${JSON.stringify(f.text)} → ${JSON.stringify(ut)} (${tappade.join(', ')})`);
      if (f.ofarlig && platshallare(ut) > facit[f.text][v].platshallare) fel.push(`ofarlig ${v}: ${JSON.stringify(f.text)} → ${JSON.stringify(ut)}`);
    }
  }
  assert.deepEqual(fel, []);
});

test('fart: en kort text tar några tiotal millisekunder', { skip: hoppa }, () => {
  const s = [...tider].sort((a, b) => a - b);
  const median = s[s.length >> 1];
  // Provet mätte 13–15 ms på en belastad maskin; taket här är generöst
  // för en dator som gör annat samtidigt.
  assert.ok(median < 60, `median ${median.toFixed(1)} ms`);
});

test('ett långt dokument läses i bakgrunden, en gång, och nästa fråga väntar inte', { skip: hoppa }, async () => {
  const stycken = utmaning.filter(f => f.sprak === 'sv' && !f.ofarlig).map((f, i) => `Avsnitt ${i + 1}. ${f.text} Ärendet fortsätter enligt plan och följs upp.`);
  // Ett dokument som ingen av meningarna ovan: nya namn i varje stycke.
  const dokument = stycken.map((s, i) => s.replace(/\.$/, '') + ` Kontaktperson Ebba Qvarnhjelm-${i}.`).join('\n\n');
  // Ingen tid alls nu: allt ska läsas i bakgrunden.
  const r = await N.forbered([dokument], { tak: 0 });
  assert.equal(r.aktiv, true);
  assert.ok(r.kvar > 0, 'stycken ska ha lagts i bakgrunden');
  const t0 = Date.now();
  while (Date.now() - t0 < 60000 && N.fyndFor(dokument).filter(f => /Qvarnhjelm/.test(f.fras)).length < stycken.length) {
    await new Promise(k => setTimeout(k, 100));
  }
  assert.ok(N.fyndFor(dokument).some(f => f.fras === 'Ebba Qvarnhjelm-0' || /Qvarnhjelm/.test(f.fras)), 'bakgrunden hittade namnen');
  // Dokumentet i en fråga: styckena är redan lästa, inget körs igen.
  const fraga = `Sammanfatta det här:\n\n${dokument}`;
  const t1 = performance.now();
  const r2 = await N.forbered([fraga]);
  assert.ok(r2.lasta <= 1, `bara frågans eget stycke ska läsas (${r2.lasta})`);
  assert.ok(performance.now() - t1 < 500);
  const ut = M.maskeraMeddelanden([{ role: 'user', content: fraga }], { niva: 'personuppgifter' }).meddelanden[0].content;
  assert.doesNotMatch(ut, /Qvarnhjelm|Nyamwasa|Petrović|Kvarngränd/);
});

test('avstängd: bara reglerna, och det modellen läst glöms', { skip: hoppa }, () => {
  const f = utmaning.find(x => x.text.startsWith('Rose Berg'));
  N.satNamnmodell({ pa: false });
  try {
    assert.deepEqual(N.fyndFor(f.text), []);
    for (const v of VAGAR) assert.equal(kor(f, v), regler.get(`${v}\u0000${f.text}`), v);
  } finally { N.satNamnmodell({ pa: true }); }
});
