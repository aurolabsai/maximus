/// Hem som instrumentbräda (Fas 50): Nyheter och agentens drag under
/// förslaget, som vertikala karuseller. /api/hem och bilderna fångas i
/// webbläsaren — provet ritar och klickar, det hämtar inga nyheter.
///
///   node test/hembordet.mjs <nyckel>
import { oppna, forbiStarten } from './hjalpare.mjs';
import { readFile } from 'node:fs/promises';
const { p, ok, api, slut } = await oppna(process.argv[2], { bredd: 1400, hojd: 950 });
await forbiStarten(p, api);
const bild = await readFile(new URL('../src-tauri/icons/128x128.png', import.meta.url));
const tid = m => new Date(Date.now() - m * 60e3).toISOString();
let pa = false;
const HEM = () => ({
  nyheter: { pa, amnen: ['Artificiell intelligens', 'Automatisering', 'Orkestrering av autonoma agenter'], senast: tid(30), poster: pa ? [
    { id: 'n1', titel: 'Regeringen vill skärpa kraven på AI i offentlig sektor', fran: 'dn.se', url: 'https://www.dn.se/a', tid: tid(40), vikt: 3, varfor: 'Rör upphandling av AI-tjänster, ditt område.' },
    { id: 'n2', titel: 'Ny vägledning från IMY om språkmodeller', fran: 'imy.se', url: 'https://www.imy.se/b', tid: tid(120), vikt: 3, varfor: 'Dataskydd och lokal AI.' },
    { id: 'n3', titel: 'Kommuner bygger egen AI-infrastruktur', fran: 'computersweden.se', url: 'https://cs.se/c', tid: tid(300), vikt: 2, varfor: 'Lokal infrastruktur i regionen.' },
  ] : [] },
  drag: [
    { tid: tid(5), sort: 'undersokte', titel: 'Avtalet med Nordal', rad: 'Undersökte det, 2 frågor: säkerhet medel.', session: null },
    { tid: tid(25), sort: 'hittade', titel: 'Inkorgen', rad: '3 saker att titta på', session: null },
    { tid: tid(90), sort: 'fel', titel: 'Sidan', rad: 'Svarade 500.', session: null },
  ],
});
await p.route('**/api/hem', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(HEM()) }));
await p.route('**/api/nyheter/bild/**', r => r.fulfill({ contentType: 'image/png', body: bild }));
await p.route('**/api/nyheter/pa', r => { pa = true; return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ pa: true }) }); });
// Påhittade nyheter finns inte på servern: bifogningen fångas här. Den riktiga
// vägen (omaskerad, publik) provas i test/nyheterna.mjs.
await p.route('**/api/nyheter/*/bifoga', r => r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'x', namn: 'Regeringen vill skärpa kraven.txt', omaskerad: true, dolda: 0 }) }));
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);

ok(await p.locator('.ett-kort').isVisible() && await p.locator('.hem-bord .hem-kort').count() === 2, 'två kort under förslaget');
ok(/Slå på nyheter/.test(await p.locator('.nyhetskort').textContent()), 'nyheterna är av tills du säger ja');
ok(/Undersökte/.test(await p.locator('.dragkort .vk-rad').first().textContent()), 'agentens senaste drag står överst');
// Inget går utanför sitt kort (Auro 2026-10-06), också med långa ämnen.
const utanfor = await p.evaluate(() => [...document.querySelectorAll('.hem-kort')].flatMap(k => {
  const r = k.getBoundingClientRect();
  return [...k.querySelectorAll('*')].filter(n => { const b = n.getBoundingClientRect(); return b.width && (b.right > r.right + 1 || b.left < r.left - 1); }).map(n => n.className || n.tagName);
}));
ok(!utanfor.length, `inget går utanför korten${utanfor.length ? `: ${utanfor.slice(0, 4).join(', ')}` : ''}`);
await p.screenshot({ path: '/tmp/maximus-hembord-av.png' });

await p.click('.nyhetskort .hem-knapp'); await p.waitForTimeout(1200);
ok(await p.locator('.nyhetskort .nyhet').count() === 3, 'efter ja: nyheterna, tyngst först');
ok(await p.locator('.nyhetskort .nyhet img').first().evaluate(i => i.complete && i.naturalWidth > 0), 'med OG-bild');
await p.screenshot({ path: '/tmp/maximus-hembord.png' });

// Den vertikala karusellen glider uppåt av sig själv, och stannar under musen.
const lage = () => p.locator('.nyhetskort .vk').getAttribute('data-i');
await p.mouse.move(5, 5);
await p.waitForTimeout(7600);
ok(await lage() === '1', 'karusellen gled till nästa nyhet');
await p.hover('.nyhetskort .vk'); const fore = await lage();
await p.waitForTimeout(7600);
ok(await lage() === fore, 'och stannar medan musen är över');
await p.click('.dragkort .vk-prickar button:nth-child(3)'); await p.waitForTimeout(700);
ok(await p.locator('.dragkort .vk').getAttribute('data-i') === '2', 'prickarna flyttar till en viss rad');

// En nyhet blir ett samtal med sidan som underlag och frågan i rutan.
await p.click('.nyhetskort .vk-prickar button:nth-child(1)'); await p.waitForTimeout(600);
await p.click('.nyhetskort .nyhet >> nth=0'); await p.waitForTimeout(3000);
const s = await api('/api/sessioner');
ok(s.length === 1, 'nyheten öppnade ett samtal');
ok(/Vad betyder det här för mig/.test(await p.inputValue('#fraga')), 'frågan står i rutan, oskickad');
await p.screenshot({ path: '/tmp/maximus-hembord-samtal.png' });
await slut();
