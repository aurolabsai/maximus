/// Fas 2, provad i webbläsaren: de fem felen i arvet.
///
///   sh scripts/provserver.sh start
///   node test/stadat.mjs <nyckel>
///
/// Kör mot provservern på 3299 — aldrig mot användarens eget Maximus.
import { chromium } from 'playwright';
import { forbiStarten, fastPanel } from './hjalpare.mjs';
const N = process.argv[2];
if (!N) { console.error('nyckeln saknas: node test/stadat.mjs <nyckel>'); process.exit(2); }
const BAS = `http://127.0.0.1:${process.env.MAXIMUS_PROVPORT || 3299}`;
const b = await chromium.launch();
const s = await fastPanel(await b.newContext({ viewport: { width: 1280, height: 900 } }));
const p = await s.newPage();
const fel = []; p.on('pageerror', e => fel.push(String(e).slice(0, 160)));
let rott = 0;
const ok = (villkor, text) => { console.log(`${villkor ? 'GRÖNT' : 'RÖTT '} · ${text}`); if (!villkor) rott++; };
const api = (vag, kropp) => p.evaluate(async ([v, k]) => {
  const r = await fetch(v, k ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' }, body: JSON.stringify(k) } : {});
  return { status: r.status, d: await r.json().catch(() => null) };
}, [vag, kropp]);

await p.goto(`${BAS}/?n=${N}`, { waitUntil: 'networkidle' });
// Utgångsläget sätts i provet, inte förutsätts: förbi starten (villkor,
// modeller, första sessionen) genom samma vägar som starten använder.
await forbiStarten(p, async (v, k) => (await api(v, k)).d);

// 1. En meny i taget. Rumsmenyn är borta (Fas 13); de som finns kvar är
// appmenyn, plusmenyn, lägesmenyn och strömpanelen.
const oppen = async () => ({
  app: await p.locator('.radmeny').count(), ny: await p.locator('#nyval.oppen').count(),
  lage: await p.locator('#lagesval.oppen').count(), strom: await p.locator('#strompanel.oppen').count() });
await p.click('#appmeny'); await p.waitForTimeout(150);
ok((await oppen()).app === 1, 'appmenyn öppnas');
await p.click('#ny'); await p.waitForTimeout(150);
let o = await oppen();
ok(o.ny === 1 && o.app === 0, 'plusmenyn öppnas (den var död: två hanterare), och appmenyn stängdes');
const synlig = await p.evaluate(() => {
  const m = document.querySelector('#ny-meny').getBoundingClientRect();
  const traff = document.elementFromPoint(m.right - 6, m.top + m.height / 2);
  return { bredd: Math.round(m.width), hel: Boolean(traff?.closest('#ny-meny')) && m.right <= innerWidth };
});
ok(synlig.hel, `plusmenyn syns hel, inte avklippt av panelen (${synlig.bredd} px bred)`);
await p.click('#lage-knapp'); await p.waitForTimeout(150);
o = await oppen();
ok(o.lage === 1 && o.ny === 0, 'lägesmenyn öppnas, och plusmenyn stängdes');
await p.click('#strom-knapp'); await p.waitForTimeout(150);
o = await oppen();
ok(o.strom === 1 && o.lage === 0, 'strömpanelen öppnas, och lägesmenyn stängdes');
await p.click('#appmeny'); await p.waitForTimeout(150);
o = await oppen();
ok(o.app === 1 && o.strom === 0, 'appmenyn öppnas igen, och strömpanelen stängdes');
await p.keyboard.press('Escape');
await p.mouse.click(700, 400);

// 2. ⌘+ skalar allt, inte bara samtalstexten — och menyerna hamnar rätt.
const matt = () => p.evaluate(() => {
  const k = document.querySelector('#appmeny').getBoundingClientRect();
  return {
    rot: parseFloat(getComputedStyle(document.documentElement).fontSize),
    knapp: document.querySelector('#ny').getBoundingClientRect().width,
    falt: document.querySelector('#fraga').getBoundingClientRect().height,
    panel: document.querySelector('#sido').getBoundingClientRect().width,
    appmeny: k.bottom, appmenyTopp: k.top, appmenyHoger: k.right,
  };
});
const fore = await matt();
for (let i = 0; i < 4; i++) await p.keyboard.press('Meta+=');
await p.waitForTimeout(250);
const efter = await matt();
const innerHeightVid160 = await p.evaluate(() => innerHeight);
const kvot = efter.rot / fore.rot;
ok(Math.abs(kvot - 1.6) < 0.01, `⌘+ fyra gånger: roten ${fore.rot} → ${efter.rot} px (×${kvot.toFixed(2)})`);
for (const [namn, a, b] of [['knapparna', fore.knapp, efter.knapp], ['skrivfältet', fore.falt, efter.falt], ['panelen', fore.panel, efter.panel]])
  ok(b / a > 1.45, `${namn} växer med (${a.toFixed(0)} → ${b.toFixed(0)} px)`);
await p.click('#appmeny'); await p.waitForTimeout(250);
// Fas 48: "…" står i listen, och menyn öppnas till höger om knappen.
const meny = await p.evaluate(() => { const r = document.querySelector('.radmeny').getBoundingClientRect(); return { left: r.left, top: r.top, bottom: r.bottom }; });
ok(Math.abs(meny.left - (efter.appmenyHoger + 8)) < 2 && meny.bottom <= innerHeightVid160 + 1,
  `appmenyn ligger bredvid sin knapp vid 160 % (${meny.left.toFixed(0)} mot ${(efter.appmenyHoger + 8).toFixed(0)})`);
await p.keyboard.press('Escape');
const ikon = await p.evaluate(() => document.querySelector('#ny svg').getBoundingClientRect().width);
ok(ikon > 27, `ikonerna växer med (${ikon.toFixed(1)} px vid 160 %; de stod på 18)`);
await p.click('#lage-knapp'); await p.waitForTimeout(250);
const topp = await p.evaluate(() => document.querySelector('#lage-meny').getBoundingClientRect().top);
ok(topp >= 0, `lägesmenyn håller sig inom fönstret vid 160 % (topp ${topp.toFixed(0)})`);
// Stänger menyn med ett klick på sidan själv — inte på en punkt: på (900, 300)
// står numera ett kort på hem, och klicket startade det (2026-10-09).
await p.keyboard.press('Escape'); await p.evaluate(() => document.body.click());
await p.keyboard.press('Meta+0');
await p.waitForTimeout(150);
ok((await matt()).rot === fore.rot, '⌘0 återställer');

// 3. Hjälpen: ⌘N stannar i hjälpen, och inga sparade frågor.
await p.evaluate(() => document.querySelector('#oppna-hjalp').click());
await p.waitForTimeout(300);
ok(await p.evaluate(() => document.body.dataset.vy) === 'hjalp', 'hjälpen öppnas');
await p.keyboard.press('Meta+n');
await p.waitForTimeout(200);
ok(await p.evaluate(() => document.body.dataset.vy) === 'hjalp', '⌘N i hjälpen stannar i hjälpen');
ok(await p.locator('#hjalpfragor .listrubrik', { hasText: 'Dina frågor' }).count() === 0, 'ingen lista med sparade frågor');
ok((await api('/api/hjalp/fragor')).status === 404, 'vägen till sparade frågor finns inte längre');
await p.evaluate(() => document.querySelector('#hjalp-tillbaka').click());

// 4. Namnet.
ok(!(await p.content()).includes('Frister och paragrafer'), '"Frister och paragrafer" är borta');

// 5. Rensa allt.
await api('/api/projekt', { namn: 'Provprojekt' });
for (let i = 0; i < 2; i++) {
  const r = await api('/api/sessioner', {});
  // En tom session återanvänds; ge varje en tur så att de blir två.
  await api(`/api/sessioner/${r.d.id}/titel`, { titel: `Prov ${i}` });
}
const fore5 = await api('/api/sessioner');
ok((await api('/api/rensa', {})).status === 422, 'rensa utan bekräftelse vägras');
await p.evaluate(() => document.querySelector('#oppna-installningar').click());
await p.waitForTimeout(300);
// Rensa står under Dina data sedan 2026-10-09 (förut under Skydd).
await p.evaluate(() => document.querySelector('#inst-flikar [data-flik="data"]').click()); await p.waitForTimeout(200);
await p.locator('#rensa summary').click();
await p.click('#rensa-kor');
await p.waitForTimeout(200);
ok(await p.locator('#fragaruta[open]').count() === 1, 'rensa frågar först');
await p.click('#fragaruta-ok');
await p.waitForTimeout(600);
const efter5 = await api('/api/sessioner');
const proj = await api('/api/projekt');
console.log(`        · före: ${fore5.d.length} sessioner · efter: ${efter5.d.length} · projekt: ${proj.d.projekt?.length}`);
ok(efter5.d.length === 0 && (proj.d.projekt || []).length === 0, 'allt är borta');
ok(/Liggaren står kvar/.test(await p.locator('#rensa-svar').textContent()), 'svaret säger vad som försvann och att liggaren står kvar');

// Öronmärkningen (Fas 16) nere till höger: ingen text under den, i någon bredd.
for (const w of [1440, 1100, 760]) {
  await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(200);
  const krock = await p.evaluate(() => {
    const a = document.querySelector('.oronmarke').getBoundingClientRect(); let n = 0;
    for (const e of document.querySelectorAll('body *')) {
      if (!e.offsetParent || e.closest('.oronmarke')) continue;
      for (const t of e.childNodes) if (t.nodeType === 3 && t.textContent.trim()) {
        const rg = document.createRange(); rg.selectNodeContents(t);
        for (const x of rg.getClientRects()) if (!(x.right <= a.left || x.left >= a.right || x.bottom <= a.top || x.top >= a.bottom)) n++;
      }
    }
    return n;
  });
  ok(krock === 0, `öronmärkningen ligger fritt vid ${w} px`);
}
await p.setViewportSize({ width: 1280, height: 900 });

// Minnet syns alltid på knappen, också förvalet.
await p.click('#inst-stang'); await p.waitForTimeout(300);
ok(await p.locator('#lage-minne').isVisible() && (await p.locator('#lage-minne').textContent()) === 'Isolerat', 'knappen säger Isolerat från start');
await p.click('#lage-knapp'); await p.locator('#meny-minne button', { hasText: 'Glöm efteråt' }).click(); await p.waitForTimeout(200);
ok((await p.locator('#lage-minne').textContent()) === 'Glöms', 'och Glöms när det valts');
await p.click('#lage-knapp'); await p.locator('#meny-minne button', { hasText: 'Isolerat' }).click(); await p.waitForTimeout(200);
await p.screenshot({ path: '/tmp/lage-knapp.png', clip: { x: 360, y: 790, width: 520, height: 80 } });


console.log('sidfel:', fel.length ? fel.join(' | ') : 'inga');
await b.close();
process.exit(rott || fel.length ? 1 : 0);
