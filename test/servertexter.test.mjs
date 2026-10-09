/// Serverns texter (fas 3, 2026-10-09): lib/texter/<kod>/<område>.json.
///
/// Samma krav som ytans ordlistor: varje nyckel finns på båda språken,
/// platshållarna stämmer, engelskan har inga svenska bokstäver, och varje
/// nyckel som koden ber om finns. Dessutom: inga nycklar delas mellan
/// områdesfilerna eller med ytans ordlista — en krock skriver över tyst.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as S from '../lib/sprakstod.mjs';

const ROT = new URL('..', import.meta.url).pathname;
const KAT = join(ROT, 'lib', 'texter');
const filer = kod => readdirSync(join(KAT, kod)).filter(f => f.endsWith('.json')).sort();
const las = (kod, f) => JSON.parse(readFileSync(join(KAT, kod, f), 'utf8'));
const ph = v => [...new Set(JSON.stringify(v).match(/\{\w+\}/g))].sort().join();

// Egennamn som får ha svenska bokstäver i engelskan. Läggs till med flit.
const EGENNAMN = ['Försäkringskassan', 'Skatteverket', 'Jämställdhetsmyndigheten', '1177 Vårdguiden', 'Vårdguiden', 'Mind Självmordslinjen', 'Självmordslinjen', 'BRIS', 'Kvinnofridslinjen', 'Jourhavande medmänniska', 'medmänniska', 'Bolagsverket', 'Domstolsverket', 'Länsstyrelsen', 'Förvaltningslagen', 'Offentlighets- och sekretesslagen', 'Arbetsmiljöverket'];

test('samma områdesfiler på svenska och engelska', () => {
  assert.deepEqual(filer('en'), filer('sv'));
});

test('varje nyckel finns på båda språken, och platshållarna stämmer', () => {
  for (const f of filer('sv')) {
    const sv = las('sv', f), en = las('en', f);
    for (const k of Object.keys(sv)) assert.ok(k in en, `${f}: ${k} saknas på engelska`);
    for (const k of Object.keys(en)) assert.ok(k in sv, `${f}: ${k} saknas på svenska`);
    for (const k of Object.keys(sv)) assert.equal(ph(en[k]), ph(sv[k]), `${f}: ${k}: platshållarna skiljer sig`);
  }
});

test('engelskan har inga svenska bokstäver utom i egennamn', () => {
  for (const f of filer('en')) for (const [k, v] of Object.entries(las('en', f))) {
    let s = JSON.stringify(v);
    for (const namn of EGENNAMN) s = s.split(namn).join('');
    assert.ok(!/[åäöÅÄÖ]/.test(s), `${f}: ${k}: ${s}`);
  }
});

test('inga nycklar delas mellan områdena eller med ytan', () => {
  const yta = JSON.parse(readFileSync(join(ROT, 'public', 'sprak', 'sv.json'), 'utf8'));
  const sedda = new Map();
  for (const f of filer('sv')) for (const k of Object.keys(las('sv', f))) {
    assert.ok(!sedda.has(k), `${k} står i både ${sedda.get(k)} och ${f}`);
    assert.ok(!(k in yta), `${k} står både i ${f} och i public/sprak/sv.json`);
    sedda.set(k, f);
  }
});

// Källkoden: server.mjs och lib/**/*.mjs.
function kallor() {
  const ut = [['server.mjs', readFileSync(join(ROT, 'server.mjs'), 'utf8')]];
  const ga = dir => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { if (n !== 'texter') ga(p); }
      else if (n.endsWith('.mjs')) ut.push([p.slice(ROT.length), readFileSync(p, 'utf8')]);
    }
  };
  ga(join(ROT, 'lib'));
  return ut;
}

test('varje nyckel som koden ber om finns på svenska', () => {
  S.glom();
  const sv = S.servertexter('sv');
  const saknas = [];
  for (const [namn, kod] of kallor()) {
    for (const m of kod.matchAll(/\btx\(\s*'([\w.-]+)'/g)) if (!(m[1] in sv)) saknas.push(`${namn}: ${m[1]}`);
  }
  assert.deepEqual(saknas, []);
});

test('varje servernyckel används någonstans', () => {
  const alla = kallor().map(([, k]) => k).join('\n');
  const oanvanda = [];
  for (const f of filer('sv')) for (const k of Object.keys(las('sv', f))) {
    if (!alla.includes(`'${k}'`) && !alla.includes(`"${k}"`) && !alla.includes(`\`${k}\``)) {
      // Nycklar som byggs av delar står med sitt prefix: 'kalla.' + id.
      const prefix = k.slice(0, k.lastIndexOf('.') + 1);
      if (!prefix || !alla.includes(`'${prefix}`) && !alla.includes(`\`${prefix}`)) oanvanda.push(`${f}: ${k}`);
    }
  }
  assert.deepEqual(oanvanda, []);
});

test('språket följer anropet, och det senast kända gäller utanför', async () => {
  S.satt('sv');
  assert.equal(S.aktuellt(), 'sv');
  await S.med('en', async () => {
    await new Promise(r => setTimeout(r, 1));
    assert.equal(S.aktuellt(), 'en', 'det anropet väntar på ärver språket');
  });
  assert.equal(S.aktuellt(), 'sv');
  assert.equal(await S.valtCachat('en'), 'en');
  assert.equal(S.aktuellt(), 'en');
  S.satt('sv');
});

test('prompterna är v1:s på svenska och säger språket på engelska', () => {
  const p = 'Svara kort på svenska.\nSLUTSATS: …';
  assert.equal(S.modellprompt(p, { kod: 'sv', markorer: ['SLUTSATS:'] }), p, 'svenska: byte för byte');
  const en = S.modellprompt(p, { kod: 'en', markorer: ['SLUTSATS:'] });
  assert.match(en, /på engelska \(English\)/);
  assert.doesNotMatch(en, /på svenska/);
  assert.match(en, /in English/);
  assert.match(en, /SLUTSATS:/);
});
