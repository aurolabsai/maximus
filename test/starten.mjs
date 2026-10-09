/// Starten, provad i webbläsaren mot en tom provserver.
///
///   sh scripts/provserver.sh start
///   node test/starten.mjs <nyckel>
///
/// Provservern måste vara NY: provet sätter sitt utgångsläge genom att
/// kräva att villkoren inte är godkända, och säger till om de är det.
import { chromium } from 'playwright';
const N = process.argv[2];
if (!N) { console.error('nyckeln saknas'); process.exit(2); }
const BAS = 'http://127.0.0.1:3299';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const fel = []; p.on('pageerror', e => fel.push(String(e).slice(0, 160)));
let rott = 0;
const ok = (v, t) => { console.log(`${v ? 'GRÖNT' : 'RÖTT '} · ${t}`); if (!v) rott++; };
const api = vag => p.evaluate(async v => (await fetch(v)).json(), vag);

await p.goto(`${BAS}/?n=${N}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
const fore = await api('/api/villkor');
if (fore.godkant) { console.error('provservern är inte ny — villkoren redan godkända'); process.exit(2); }

ok(await p.locator('#borja:not([hidden])').isVisible(), 'startytan står där');
ok(await p.locator('#borja h1').textContent() === 'Maximus', 'rubriken');
ok(await p.locator('#borja p').first().isVisible(), 'ett stycke');
ok(await p.locator('#guide[open]').count() === 0, 'ingen guide ovanpå villkoren');
ok(await p.locator('#borja-fortsatt').isDisabled(), 'utan kryss: knappen går inte att trycka');
await p.locator('.borja-villkor summary').click();
ok(await p.locator('.borja-text h2', { hasText: 'Vad som lämnar datorn' }).isVisible(), 'hela texten går att läsa');
ok(!(await p.locator('.borja-text').textContent()).includes('JURISTÖVERSYN'), 'interna anteckningar syns inte');
await p.screenshot({ path: '/tmp/maximus-villkor.png' });
await p.locator('#borja-villkor').check();
ok(await p.locator('#borja-fortsatt').isEnabled(), 'med kryss: knappen går att trycka');
await p.click('#borja-fortsatt');
await p.waitForTimeout(800);
const efter = await api('/api/villkor');
ok(efter.godkant && efter.sparat?.version === efter.version && /^\d{4}-\d{2}-\d{2}T/.test(efter.sparat?.datum),
  `sparat med version och datum (${efter.sparat?.version} · ${efter.sparat?.datum})`);
const forsok = await p.evaluate(async () => (await fetch('/api/installningar', { method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' },
  body: JSON.stringify({ villkor: { version: 99, datum: '1999-01-01' } }) })).status);
ok((await api('/api/villkor')).sparat.datum === efter.sparat.datum, `godkännandet går inte att skriva över via inställningarna (${forsok})`);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(900);
ok(await p.locator('#borja-villkor').count() === 0, 'efter omladdning frågas inte villkoren igen');

console.log('sidfel:', fel.length ? fel.join(' | ') : 'inga');
await b.close();
process.exit(rott || fel.length ? 1 : 0);
