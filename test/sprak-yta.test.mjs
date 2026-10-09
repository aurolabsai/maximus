/// Ytan på engelska (språkstödet fas 2, 2026-10-09).
///
/// Två slags prov. De statiska läser app.js och ordlistorna: varje t('…')
/// som app.js anropar ska finnas på båda språken, med samma platshållare som
/// anropet ger värden till, och engelskan ska inte ha svenska bokstäver.
///
/// Det andra ritar sidan i en riktig Chromium, utan Maximus-servern: en
/// statisk server lämnar ut public/, och varje /api/-anrop får ett tomt svar
/// (eller en uppstart som säger engelska). Inget som rör användarens data,
/// ingen modell. Sedan läses det som syns — startens villkor, första
/// sessionen, den tomma hemvyn, hjälpen och varje flik i inställningarna —
/// och där ska ingen svenska stå. Svenska som kommer från servern prövas inte
/// här: stubbarna skickar ingen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUB = fileURLToPath(new URL('../public/', import.meta.url));
const las = f => readFile(join(PUB, f), 'utf8');
const app = await las('app.js');
const sv = JSON.parse(await las('sprak/sv.json'));
const en = JSON.parse(await las('sprak/en.json'));

// ── Statiskt ──────────────────────────────────────────────────────────────

/// Varje t('nyckel', { a, b: … }) i app.js: nyckeln och namnen på värdena.
/// Anropen är enkla nog att läsas med ett mönster — värdena är ett platt
/// objekt, och namnen står först på varje rad i det.
function anrop() {
  const ut = [];
  for (const m of app.matchAll(/\bt\('([\w.-]+)'(\s*,\s*\{)?/g)) {
    const namn = new Set();
    if (m[2]) {
      // Fram till den måsvinge som stänger objektet.
      let i = m.index + m[0].length, djup = 1, del = '', citat = null;
      for (; i < app.length && djup; i++) {
        const c = app[i];
        if (citat) { if (c === '\\') i++; else if (c === citat) citat = null; continue; }
        if (c === "'" || c === '"' || c === '`') citat = c;
        else if ('({['.includes(c)) djup++;
        else if (')}]'.includes(c)) djup--;
        if (djup === 1) del += c; else if (djup === 0) break; else del += ' ';
      }
      for (const bit of del.split(',')) {
        const k = /^\s*(\w+)\s*(?::|$)/.exec(bit);
        if (k) namn.add(k[1]);
      }
    }
    ut.push({ nyckel: m[1], namn, rad: app.slice(0, m.index).split('\n').length });
  }
  return ut;
}
const platshallare = v => new Set([...JSON.stringify(v ?? '').matchAll(/\{(\w+)\}/g)].map(m => m[1]));

test('varje nyckel app.js använder finns på svenska och engelska', () => {
  const alla = anrop();
  assert.ok(alla.length > 1500, `bara ${alla.length} anrop till t() — har app.js slutat använda språkstödet?`);
  for (const { nyckel, rad } of alla) {
    assert.ok(nyckel in sv, `${nyckel} (rad ${rad}) saknas i sv.json`);
    assert.ok(nyckel in en, `${nyckel} (rad ${rad}) saknas i en.json`);
  }
});

test('anropet ger ett värde till varje platshållare, och plural har sitt n', () => {
  for (const { nyckel, namn, rad } of anrop()) {
    for (const p of new Set([...platshallare(sv[nyckel]), ...platshallare(en[nyckel])]))
      assert.ok(namn.has(p), `${nyckel} (rad ${rad}): {${p}} får inget värde`);
    const plural = [sv[nyckel], en[nyckel]].some(v => v && typeof v === 'object');
    if (plural) assert.ok(namn.has('n'), `${nyckel} (rad ${rad}): pluralen väljs på n, och n saknas`);
  }
});

test('engelskan har inga svenska bokstäver', () => {
  for (const [k, v] of Object.entries(en)) assert.doesNotMatch(JSON.stringify(v), /[åäöÅÄÖ]/, k);
});

test('pluralerna har båda formerna', () => {
  for (const [namn, lista] of [['sv', sv], ['en', en]])
    for (const [k, v] of Object.entries(lista))
      if (v && typeof v === 'object') assert.ok(typeof v.en === 'string' && typeof v.flera === 'string', `${namn}: ${k}`);
});

// ── I en webbläsare ───────────────────────────────────────────────────────

/// Svenska som syns. Bokstäverna å, ä och ö räcker långt; orden fångar det
/// som saknar dem ("Klart", "Inget", "och").
const SVENSKA = /[åäöÅÄÖ]|(?<![\p{L}])(och|inte|det|att|är|för|med|som|eller|inget|ingen|klart|samtal|uppdrag|frågor?|svaret|sidan|webben|datorn|inställningar)(?![\p{L}])/iu;

/// Rader som får vara svenska: namn och det som inte går att översätta.
const TILLATET = [/^Maximus$/i, /lagen\.nu/, /Berget AI/];

async function oppnaSidan(t, uppstart) {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch { t.skip('playwright saknas'); return null; }
  const TYP = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
  const srv = http.createServer(async (q, s) => {
    const vag = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    try {
      const b = await readFile(join(PUB, vag === '/' ? 'index.html' : vag));
      s.writeHead(200, { 'Content-Type': TYP[extname(vag)] || 'text/html' });
      s.end(b);
    } catch { s.writeHead(404); s.end(); }
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  let b;
  try { b = await chromium.launch(); } catch (e) { srv.close(); t.skip(`Chromium startar inte: ${e.message.split('\n')[0]}`); return null; }
  const sida = await b.newPage();
  const fel = [];
  sida.on('pageerror', e => fel.push(e.message));
  // Allt under /api/ svarar tomt: ingen server, inga data.
  await sida.route('**/api/**', r => {
    const v = new URL(r.request().url()).pathname;
    const d = v === '/api/uppstart' ? uppstart : v === '/api/sessioner' ? [] : v === '/api/installningar' ? uppstart.installningar : {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  });
  await sida.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil: 'load' });
  await sida.waitForTimeout(1500);
  const synligt = async () => (await sida.evaluate(() => document.body.innerText)).split('\n').map(x => x.trim()).filter(Boolean);
  const stang = async () => { await b.close(); srv.close(); };
  return { sida, fel, synligt, stang };
}

const lacker = rader => rader.filter(r => SVENSKA.test(r) && !TILLATET.some(x => x.test(r)));
/// En nyckel som syns i stället för sin text: t() hittade den inte.
const NYCKLAR = Object.keys(sv).filter(k => k.includes('.'));
const nycklar = rader => rader.filter(r => NYCKLAR.some(k => r.includes(k)));

const UPPSTART = (installningar = {}, mer = {}) => ({
  sprak: 'en', grind: true, frontiers: [], maximus: { skyddat: false }, locket: { pa: false }, modell: { namn: 'Modell' },
  val: { behandlingar: [{ id: 'maskerad', namn: 'Masked', om: 'Names and numbers are hidden.' }] }, moln: { pa: false },
  installningar: { namn: 'Anna', sprak: 'en', ...installningar }, ...mer,
});

test('på engelska: startens villkor', async t => {
  const s = await oppnaSidan(t, UPPSTART());
  if (!s) return;
  try {
    const rader = await s.synligt();
    assert.ok(rader.some(r => /terms/i.test(r)), `villkoren syns inte: ${rader.join(' | ')}`);
    assert.deepEqual(lacker(rader), [], 'svenska på startskärmen');
    assert.deepEqual(s.fel, []);
  } finally { await s.stang(); }
});

test('på engelska: första sessionen', async t => {
  const s = await oppnaSidan(t, UPPSTART({ modellval: { tanker: 'x' }, vilaVidStart: false }, { villkor: { godkant: true } }));
  if (!s) return;
  try {
    await s.sida.waitForTimeout(2500);
    const rader = await s.synligt();
    assert.ok(rader.some(r => /Hi|Hello|welcome|what do you/i.test(r)), `första sessionen syns inte: ${rader.join(' | ')}`);
    assert.deepEqual(lacker(rader), [], 'svenska i första sessionen');
    assert.deepEqual(s.fel, []);
  } finally { await s.stang(); }
});

test('på engelska: hem, hjälpen och inställningarna', async t => {
  const s = await oppnaSidan(t, UPPSTART({ modellval: { tanker: 'x' }, forsta: { klar: true }, vilaVidStart: false, klar: true },
    { villkor: { godkant: true } }));
  if (!s) return;
  try {
    const hem = await s.synligt();
    assert.deepEqual(lacker(hem), [], 'svenska på hemskärmen');

    // Hjälpen: listan, och ett ämne.
    await s.sida.evaluate(() => document.querySelector('#oppna-hjalp').click());
    await s.sida.waitForTimeout(300);
    const hjalp = await s.synligt();
    assert.ok(hjalp.some(r => /What is MAXIMUS\?/.test(r)), 'hjälpens ämnen syns inte');
    await s.sida.evaluate(() => [...document.querySelectorAll('#hjalpfragor .sess-oppna')][2]?.click());
    await s.sida.waitForTimeout(300);
    assert.deepEqual(lacker([...hjalp, ...await s.synligt()]), [], 'svenska i hjälpen');

    // Inställningarna: varje flik.
    await s.sida.evaluate(() => document.querySelector('#oppna-installningar').click());
    await s.sida.waitForTimeout(400);
    const flikar = await s.sida.evaluate(() => [...document.querySelectorAll('#instnav [data-flik]')].map(e => e.dataset.flik));
    assert.equal(flikar.length, 7);
    const svenskt = [];
    for (const f of flikar) {
      await s.sida.evaluate(id => document.querySelector(`#instnav [data-flik="${id}"] button`).click(), f);
      await s.sida.waitForTimeout(300);
      for (const r of lacker(await s.synligt())) svenskt.push(`${f}: ${r}`);
    }
    assert.deepEqual([...new Set(svenskt)], [], 'svenska i inställningarna');
    assert.deepEqual(nycklar(await s.synligt()), [], 'en nyckel syns i stället för sin text');
    // Fel i sidan prövas inte här: inställningarna läser mer än stubbarna
    // svarar med (tomma listor, inga modeller), och felen är stubbarnas.
  } finally { await s.stang(); }
});

test('på svenska: samma vyer, och ingen nyckel syns i stället för sin text', async t => {
  const s = await oppnaSidan(t, UPPSTART({ sprak: 'sv', modellval: { tanker: 'x' }, forsta: { klar: true }, vilaVidStart: false, klar: true },
    { sprak: 'sv', villkor: { godkant: true } }));
  if (!s) return;
  try {
    const sett = [...await s.synligt()];
    await s.sida.evaluate(() => document.querySelector('#oppna-hjalp').click());
    await s.sida.waitForTimeout(300);
    sett.push(...await s.synligt());
    assert.ok(sett.some(r => /Vad är MAXIMUS\?/.test(r)), 'hjälpens ämnen syns inte på svenska');
    await s.sida.evaluate(() => document.querySelector('#oppna-installningar').click());
    await s.sida.waitForTimeout(400);
    for (const f of await s.sida.evaluate(() => [...document.querySelectorAll('#instnav [data-flik]')].map(e => e.dataset.flik))) {
      await s.sida.evaluate(id => document.querySelector(`#instnav [data-flik="${id}"] button`).click(), f);
      await s.sida.waitForTimeout(300);
      sett.push(...await s.synligt());
    }
    assert.deepEqual([...new Set(nycklar(sett))], []);
  } finally { await s.stang(); }
});

test('datum och tal på engelska är amerikanska (en-US), på svenska sv-SE', async () => {
  // Ordlistan valde amerikansk engelska; ytan skrev en-GB och servern en-US
  // (slutgenomgången 2026-10-09).
  const { fyllSprak, lokal } = await import('../public/sprakstod.js');
  fyllSprak('en', en); assert.equal(lokal(), 'en-US');
  fyllSprak('sv', sv); assert.equal(lokal(), 'sv-SE');
});
