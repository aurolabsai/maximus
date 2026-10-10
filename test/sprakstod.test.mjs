/// Språkstödet (2026-10-09): närmaste språk, reserv och pluralform.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../lib/sprakstod.mjs';

test('det närmaste språket: exakt, utan region, släkting, sist engelska', () => {
  const finns = ['sv', 'en'];
  assert.equal(S.narmast(['sv-SE'], finns), 'sv');
  assert.equal(S.narmast(['en-US'], finns), 'en');
  assert.equal(S.narmast(['nb-NO'], finns), 'sv', 'norska läses bäst på svenska');
  assert.equal(S.narmast(['da'], finns), 'sv');
  assert.equal(S.narmast(['de-DE', 'fr'], finns), 'en', 'utan träff: engelska');
  assert.equal(S.narmast(['de-DE', 'sv'], finns), 'sv', 'ordningen i listan gäller');
  assert.equal(S.narmast([], ['sv']), 'sv', 'bara svenska finns: svenska');
});

test('ditt val går före datorns', async () => {
  assert.equal(await S.valt('en', { finns: ['sv', 'en'] }), 'en');
  assert.equal(await S.valt('sv', { finns: ['sv', 'en'] }), 'sv');
});

test('varje nyckel på engelska finns på svenska, och platshållarna stämmer', async () => {
  const { readFile } = await import('node:fs/promises');
  const sv = JSON.parse(await readFile(new URL('../public/sprak/sv.json', import.meta.url), 'utf8'));
  const en = JSON.parse(await readFile(new URL('../public/sprak/en.json', import.meta.url), 'utf8'));
  const ph = v => [...new Set(JSON.stringify(v).match(/\{\w+\}/g))].sort().join();
  for (const k of Object.keys(en)) {
    assert.ok(k in sv, `${k} finns på engelska men inte på svenska`);
    assert.equal(ph(en[k]), ph(sv[k]), `${k}: platshållarna skiljer sig`);
  }
});

// ── Sidan och ordlistorna (fas 1, 2026-10-09) ───────────────────────────────
//
// index.html bär sina nycklar som data-i18n, data-i18n-html och
// data-i18n-attr (public/sprakstod.js, oversattSidan). En nyckel som saknas
// syns inte som ett fel — svenskan i html:en står kvar — och därför prövas det
// här: varje nyckel ska finnas på båda språken, och svenskan i ordlistan ska
// vara samma som den i html:en, annars glider de isär utan att någon ser det.
{
  const { readFile } = await import('node:fs/promises');
  const las = f => readFile(new URL(`../${f}`, import.meta.url), 'utf8');
  const sv = JSON.parse(await las('public/sprak/sv.json'));
  const en = JSON.parse(await las('public/sprak/en.json'));
  const html = await las('public/index.html');
  const rent = s => String(s).replace(/\s+/g, ' ').trim();
  const avkoda = s => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const forma = (v, n) => {
    const m = v && typeof v === 'object' ? (Number(n) === 1 ? v.en ?? v.flera : v.flera ?? v.en) : v;
    return n == null ? m : String(m).replace(/\{n\}/g, n);
  };

  // Varje starttagg med en markering, och texten fram till nästa tagg.
  const taggar = [...html.matchAll(/<([a-z][\w-]*)\b([^>]*\bdata-i18n[^>]*)>([^<]*)/g)].map(([, tagg, attr, text]) => {
    const a = {};
    for (const [, k, v] of attr.matchAll(/([\w-]+)="([^"]*)"/g)) a[k] = avkoda(v);
    return { tagg, a, text: avkoda(text) };
  });

  test('varje nyckel i index.html finns på svenska och engelska', () => {
    assert.ok(taggar.length > 250, `bara ${taggar.length} markerade element`);
    const nycklar = new Set();
    for (const { a } of taggar) {
      if (a['data-i18n']) nycklar.add(a['data-i18n']);
      if (a['data-i18n-html']) nycklar.add(a['data-i18n-html']);
      for (const par of (a['data-i18n-attr'] || '').split(';').filter(x => x.trim())) {
        const [attr, nyckel] = par.split(':').map(x => x.trim());
        assert.ok(attr && nyckel, `trasigt par "${par}"`);
        nycklar.add(nyckel);
      }
    }
    for (const k of nycklar) {
      assert.ok(k in sv, `${k} saknas i sv.json`);
      assert.ok(k in en, `${k} saknas i en.json`);
    }
  });

  test('svenskan i ordlistan är svenskan i html:en', () => {
    for (const { a, text } of taggar) {
      const n = a['data-i18n-n'];
      if (a['data-i18n'] && rent(text)) assert.equal(rent(forma(sv[a['data-i18n']], n)), rent(text), a['data-i18n']);
      for (const par of (a['data-i18n-attr'] || '').split(';').filter(x => x.trim())) {
        const [attr, nyckel] = par.split(':').map(x => x.trim());
        assert.equal(forma(sv[nyckel], n), a[attr], `${nyckel} (${attr})`);
      }
    }
  });

  test('varje nyckel i ordlistorna används, och engelskan är komplett', async () => {
    const kallor = html + (await Promise.all(['public/app.js', 'public/demo.js', 'public/md.js', 'public/fragor.js', 'public/felrapport.js'].map(las))).join('\n');
    for (const k of Object.keys(sv)) {
      assert.ok(kallor.includes(`'${k}'`) || kallor.includes(`"${k}"`) || kallor.includes(`:${k}`), `${k} används inte`);
      assert.ok(k in en, `${k} saknas på engelska`);
    }
  });

  // Egennamn som får ha svenska bokstäver i den engelska ordlistan. Tom i
  // dag; ett namn läggs till här med flit, inte av misstag.
  const EGENNAMN = [];

  test('engelskan har inga svenska bokstäver utom i egennamn', () => {
    for (const [k, v] of Object.entries(en)) {
      let s = JSON.stringify(v);
      for (const namn of EGENNAMN) s = s.split(namn).join('');
      assert.ok(!/[åäöÅÄÖ]/.test(s), `${k}: ${s}`);
    }
  });

  test('det app.js skriver själv bär ingen markering', () => {
    // Ett element vars text app.js sätter skulle skrivas tillbaka till
    // html:ens text vid språkbyte — "Av." där det är på.
    const app = String(html);
    for (const id of ['fotnot', 'ag-post-om', 'inst-modell-knapp', 'lage-minne', 'liggare-om']) {
      const m = new RegExp(`<[^>]*\\bid="${id}"[^>]*>`).exec(app);
      assert.ok(m, `#${id} finns inte`);
      assert.ok(!/data-i18n=/.test(m[0]), `#${id} är markerad men skrivs av app.js`);
    }
  });
}
