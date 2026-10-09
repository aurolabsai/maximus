/// Uppdragets vy (2026-10-05): raden i sidopanelen är vald, det som lagts åt
/// sidan står bakom en knapp, och det du skriver går till uppdraget — inte
/// till ett nytt samtal utan sammanhang. Ett nytt klockslag väcker ett
/// pausat uppdrag.
import { oppna, forbiStarten } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
await api('/api/installningar', { agent: { kalender: { kalendrar: [] }, takt: 15 } });
await api('/api/uppdrag', { titel: 'Provuppdraget', instruktion: 'Håll koll på kalendern.', kallor: [{ typ: 'kalender' }], aterkommande: true, takt: 60 });
const id = (await api('/api/uppdrag')).uppdrag.find(x => x.titel === 'Provuppdraget')?.id;
ok(id, 'uppdraget finns');
await api(`/api/uppdrag/${id}/pausa`, {});
await p.reload({ waitUntil: 'networkidle' });
const antal = async () => (await api('/api/sessioner')).length;
const fore = await antal();
await p.click('#list-uppdrag'); await p.waitForSelector('.uppdragen-rad');
ok(await p.locator('.uppdragen-rad .uppdragen-lage').first().innerText().then(t => /pausad/.test(t)), 'läget står på raden i listan');
await p.click('.uppdragen-rad');
await p.waitForSelector('#mitt button:has-text("Kör nu")', { timeout: 15000 });
ok(await p.locator('#list-uppdrag.vald').count() === 1, 'Uppdrag är valt i sidopanelen');
const fraga = async t => { await p.fill('#fraga', t); await p.keyboard.press('Enter'); await p.waitForTimeout(1500); };
await fraga('varje morgon 08:00');
const u = (await api('/api/uppdrag')).uppdrag.find(x => x.id === id);
ok(u.schema && u.tillstand !== 'pausad', `klockslaget sattes och väckte uppdraget: ${u.schema} · ${u.tillstand}`);
ok(/Klart: .*08:00/.test(await p.evaluate(() => document.querySelector('#mitt').innerText)), 'svaret säger när');
await p.click('#list-uppdrag'); await p.waitForSelector('.uppdragen-rad'); await p.click('.uppdragen-rad');
await p.waitForSelector('#mitt button:has-text("Pausa")', { timeout: 15000 });
await fraga('pausa');
ok((await api('/api/uppdrag')).uppdrag.find(x => x.id === id).tillstand === 'pausad', '"pausa" skrivet pausar uppdraget');
ok(await antal() === fore, 'inget nytt samtal öppnades');
await slut();
