/// Fas 41: agenten lägger klara samtal i arkivet, med skäl, och det går att
/// ångra. Det du tagit tillbaka rör den inte igen. Ingen modell behövs.
///
///   MAXIMUS_STADA_PROV=1 sh scripts/provserver.sh start   (klockan får flyttas)
///   node test/stadningen.mjs <nyckel>
import { oppna, forbiStarten } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
const ny = async titel => (await api('/api/sessioner/manus', { titel, rader: [{ av: 'du', text: 'Hej' }, { av: 'maximus', text: 'Hej.' }] })).id;
const gammal = await ny('Gammalt samtal');
const fast = await ny('Fäst samtal');
await api(`/api/sessioner/${fast}/fast`, { pa: true });
const om = d => new Date(Date.now() + d * 864e5).toISOString();
const r0 = await api('/api/agent/stada', { nu: om(1) });
ok(r0.arkiverade?.length === 0, 'ett samtal från i går rörs inte');
const r = await api('/api/agent/stada', { nu: om(31) });
const ids = r.arkiverade?.map(x => x.id) || [];
ok(ids.includes(gammal) && !ids.includes(fast), `efter 31 dagar: det ofästa, inte det fästa (${r.arkiverade?.map(x => x.titel).join(', ')})`);
const skal = r.arkiverade?.find(x => x.id === gammal)?.skal || '';
ok(/inte rört på 31 dagar/.test(skal), `skälet: ${skal}`);
const lista = await api('/api/sessioner');
ok(lista.find(x => x.id === gammal)?.arkiverad && lista.find(x => x.id === gammal)?.arkivSkal, 'arkiverat, med skälet i listan');
await p.reload({ waitUntil: 'networkidle' });
await p.click('#list-agenten'); await p.waitForTimeout(800);
const mitt = await p.evaluate(() => document.querySelector('#mitt').innerText);
ok(/lade .* i arkivet/.test(mitt) && /Gammalt samtal/.test(mitt) && /Ingenting är borta/.test(mitt), 'raden i Agenten säger vad och varför');
await p.click('[data-lada="arkiv"]'); await p.waitForTimeout(600);
const ark = await p.locator(`.sess[data-sess="${gammal}"] .sess-meta`).innerText();
ok(/agenten: inte rört/.test(ark), `i Arkiv: ${ark.replace(/\n/g, ' ')}`);
await p.click('[data-lada="inkorg"]'); await p.waitForTimeout(400);
await p.click('#list-agenten'); await p.waitForTimeout(600);
await p.click('#mitt button:has-text("Ta tillbaka")'); await p.waitForTimeout(1000);
ok(!(await api('/api/sessioner')).find(x => x.id === gammal)?.arkiverad, '"Ta tillbaka" tar tillbaka');
ok(/Dem rör jag inte igen/.test(await p.evaluate(() => document.querySelector('#mitt').innerText)), 'raden säger att det är ångrat');
const r2 = await api('/api/agent/stada', { nu: om(60) });
ok(!r2.arkiverade?.some(x => x.id === gammal), 'det tillbakatagna rörs inte igen');
await slut();
