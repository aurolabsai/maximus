import { fastPanel } from './hjalpare.mjs';
/// Modellvalet i starten, provat i webbläsaren mot en NY provserver.
///
///   sh scripts/provserver.sh start
///   node test/modellval.mjs <nyckel>              modellerna finns redan på disk
///
///   HOME=/tmp/maximus-tomt-hem sh scripts/provserver.sh start
///   node test/modellval.mjs <nyckel> hamta        riktig hämtning: minsta
///                                                 modellen + den snabba lyssnaren
import { chromium } from 'playwright';
const [N, lage] = process.argv.slice(2);
if (!N) { console.error('nyckeln saknas'); process.exit(2); }
const BAS = `http://127.0.0.1:${process.env.MAXIMUS_PROVPORT || 3299}`;
const b = await chromium.launch();
const p = await (await fastPanel(await b.newContext({ viewport: { width: 1280, height: 900 } }))).newPage();
const fel = []; p.on('pageerror', e => fel.push(String(e).slice(0, 160)));
let rott = 0;
const ok = (v, t) => { console.log(`${v ? 'GRÖNT' : 'RÖTT '} · ${t}`); if (!v) rott++; };
const api = vag => p.evaluate(async v => (await fetch(v)).json(), vag);

await p.goto(`${BAS}/?n=${N}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
if (!(await p.locator('#borja-villkor').count())) { console.error('provservern är inte ny'); process.exit(2); }
await p.locator('#borja-villkor').check();
await p.click('#borja-fortsatt');
await p.waitForSelector('#borja-modeller', { timeout: 15000 });
await p.waitForTimeout(400);

const kort = await p.locator('.borja-modell').allTextContents();
console.log('        · ' + kort.map(k => k.replace(/\s+/g, ' ').slice(0, 150)).join('\n        · '));
ok(kort.length === 2, 'två modeller i ett förslag');
ok(/Modellen som tänker/i.test(kort[0]) && /Datorn har \d+ GB minne/.test(kort[0]), 'den som tänker: vilken och varför, ur datorns minne');
ok(/Modellen som hör/i.test(kort[1]) && kort[1].length > 60, 'den som hör: vilken och varför');
ok(await p.locator('.borja-egen summary', { hasText: 'Välj egen' }).count() === 1, '"Välj egen" finns');
await p.screenshot({ path: '/tmp/maximus-modeller.png' });

// En egen fil som inte duger ska säga varför.
await p.locator('.borja-egen summary').click();
await p.fill('#borja-egen-fil', '/finns/inte.gguf');
await p.locator('.borja-fil button').click();
await p.waitForTimeout(300);
ok(/finns inte/.test(await p.locator('.borja-lista small.fel').textContent().catch(() => '')), 'en egen fil som inte finns får ett skäl');

if (lage === 'hamta') {
  await p.locator('input[name=borja-tanker][value=llama32-3b]').check();
  await p.locator('input[name=borja-hor][value=snabb]').check();
}
const knapp = await p.locator('#borja-modeller').textContent();
console.log(`        · knappen: ${knapp}`);
ok(lage === 'hamta' ? /^Hämta \d/.test(knapp) : true, 'knappen säger hur mycket som hämtas');
// Snabbvägen (allt finns redan) lämnar över på några millisekunder. Det
// som ritades spelas in i stället för att provet ska hinna se det.
await p.evaluate(() => {
  window.__sett = [];
  new MutationObserver(() => {
    const h = document.querySelector('#borja h2')?.textContent;
    const m = document.querySelectorAll('.borja-matare').length;
    const t = [...document.querySelectorAll('.borja-matare em')].map(e => e.textContent).join(' | ');
    window.__sett.push({ h, m, t });
  }).observe(document.querySelector('#borja'), { subtree: true, childList: true, characterData: true, attributes: true });
});
await p.click('#borja-modeller');
await p.waitForTimeout(1500);
const sett = await p.evaluate(() => window.__sett);
ok(sett.some(x => x.h === 'Laddar in modellerna'), 'en text: "Laddar in modellerna"');
ok(sett.some(x => x.m === 2), 'två förloppsmätare');
console.log(`        · sist på mätarna: ${sett.filter(x => x.t).at(-1)?.t}`);

// Följ mätarna. En mätare som rör sig ska röra sig framåt.
let forra = { tanker: 0, hor: 0 }, bakat = false, steg = new Set();
const t0 = Date.now();
while (Date.now() - t0 < 30 * 60_000) {
  if (await p.locator('#borja').isHidden()) break;
  for (const vem of ['tanker', 'hor']) {
    const w = await p.evaluate(v => parseFloat(document.querySelector(`#borja-${v} .borja-spar i`)?.style.width || '0'), vem).catch(() => 0);
    if (w < forra[vem]) bakat = true;
    forra[vem] = w;
    steg.add(`${vem}:${Math.round(w / 10) * 10}`);
  }
  if (lage === 'hamta' && (Date.now() - t0) % 15000 < 600)
    console.log(`        · ${Math.round((Date.now() - t0) / 1000)} s · tänker ${forra.tanker}% · hör ${forra.hor}% · ${(await p.locator('#borja-tanker em').textContent().catch(() => ''))}`);
  if (await p.locator('.borja .fel:not([hidden])').count()) { console.log('        · fel:', await p.locator('.borja .fel:not([hidden])').first().textContent()); break; }
  await p.waitForTimeout(500);
}
ok(await p.locator('#borja').isHidden(), 'startytan lämnar över när båda är klara');
ok(!bakat, 'mätarna gick aldrig bakåt');
if (lage === 'hamta') ok([...steg].filter(x => x.startsWith('tanker')).length > 3, `mätaren rörde sig i steg (${[...steg].join(' ')})`);
const inst = (await api('/api/uppstart')).installningar;
ok(inst.modellval?.tanker && inst.modellval?.nar, `valet sparat (${JSON.stringify(inst.modellval)})`);
if (lage === 'hamta') ok(inst.modell === 'llama32-3b' && inst.ora === 'snabb', 'den valda modellen och lyssnaren är de som gäller');

console.log('sidfel:', fel.length ? fel.join(' | ') : 'inga');
await b.close();
process.exit(rott || fel.length ? 1 : 0);
