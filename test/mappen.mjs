/// En mapp som källa (2026-10-04): uppdraget i egna ord, mappvalet, lovet,
/// och första genomgången som hittar fakturan.
import { oppna, forbiStarten, skriv, svarare, modellUppe, vantaManus } from './hjalpare.mjs';
const [nyckel, mapp] = process.argv.slice(2);
const { p, ok, api, slut } = await oppna(nyckel);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen är uppe');
await p.reload({ waitUntil: 'networkidle' });
const svar = svarare(p, api);
await skriv(p, 'Håll koll på mappen och säg till när en faktura dyker upp.', 300);
await svar();
await p.waitForSelector('.uppdragsforslag button:has-text("Varje timme")', { timeout: 30000 });
ok(/mappen/.test(await p.locator('.uppdragsforslag').innerText()), 'förslaget gäller mappen');
await p.locator('.uppdragsforslag button', { hasText: 'Varje timme' }).click();
// Lovet saknas: först Ja, sedan vilken mapp.
await p.waitForSelector('#mitt button:has-text("Ja")', { timeout: 10000 }); await vantaManus(p);
await p.locator('#mitt .forsta-val button', { hasText: 'Ja' }).last().click(); await p.waitForTimeout(500); await vantaManus(p);
await p.locator('#mitt button', { hasText: 'En annan' }).last().click();
await p.waitForSelector('#fragaruta[open]');
await p.fill('#fragaruta-svar', mapp); await p.click('#fragaruta-ok');
await p.waitForFunction(() => /Första genomgången: /.test(document.querySelector('.uppdragsforslag')?.textContent || ''), null, { timeout: 240000 });
const rapport = await p.locator('.uppdragsforslag').innerText();
console.log('  ', rapport.replace(/\n+/g, ' | ').slice(0, 300));
const a = (await api('/api/uppstart')).installningar.agent;
ok(a.mapp?.sokvag === mapp, 'lovet till mappen sparat');
const u = (await api('/api/uppdrag')).uppdrag[0];
ok(u?.kallor.includes('mappen') || u?.kallor.includes('mapp'), `uppdraget läser mappen: ${u?.kallor}`);
ok(/Jag läste 2|lyfts fram|det fanns inget/i.test(rapport), 'första genomgången säger vad den gjorde');
await slut();
