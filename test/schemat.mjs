/// Uppdrag med schema och filter (2026-10-04).
import { oppna, forbiStarten, skriv, svarare, modellUppe, vantaManus } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
await api('/api/installningar', { agent: { kalender: { kalendrar: [] }, takt: 5 } });
ok(await modellUppe(p, api), 'modellen är uppe');
await p.reload({ waitUntil: 'networkidle' });
const svar = svarare(p, api);
await skriv(p, 'Håll koll på min kalender vardagar 8:00 och 15:00 och säg till om möten där ämnet innehåller "styrgrupp".', 300);
await svar();
await p.waitForSelector('.uppdragsforslag', { timeout: 30000 });
const forslag = await p.locator('.uppdragsforslag').innerText();
console.log('  förslaget:', forslag.replace(/\n+/g, ' | '));
ok(/När:\s*vardagar 08:00 och 15:00/.test(forslag) && /Bara:\s*ämnet innehåller "styrgrupp"/.test(forslag), 'förslaget visar schema och filter');
await p.locator('.uppdragsforslag button', { hasText: 'Ja, vardagar 08:00 och 15:00' }).click();
await p.waitForTimeout(3000);
const u = (await api('/api/uppdrag')).uppdrag[0];
console.log('  uppdraget:', JSON.stringify({ schema: u.schema, filter: u.filter, nasta: u.nasta }));
const n = new Date(u.nasta);
ok(u.schema === 'vardagar 08:00 och 15:00' && u.filter === 'ämnet innehåller "styrgrupp"', 'uppdraget har schemat och filtret');
ok([1, 2, 3, 4, 5].includes(n.getDay()) && [8, 15].includes(n.getHours()) && n.getMinutes() === 0, `nästa genomgång på ett schemalagt klockslag: ${n.toLocaleString('sv-SE')}`);
await p.click('#list-uppdrag'); await p.waitForSelector('.uppdragen-rad');
const rad = await p.locator('.uppdragen-rad').first().innerText();
ok(/vardagar 08:00 och 15:00/.test(rad) && /(mån|tis|ons|tors|fre) \d\d:\d\d/.test(rad), `raden i listan: ${rad.replace(/\n/g, ' ')}`);
// Ändra till varje morgon.
await p.click('.uppdragen-rad');
// Uppdraget gavs i ett samtal: in i tråden, och valen i bandet (Fas 40).
await p.waitForSelector('.uppdragsband', { timeout: 10000 });
await p.click('.uppdragsband button:has-text("Läge och val")');
await p.waitForSelector('#mitt button:has-text("Ändra hur ofta")');
await p.locator('#mitt button', { hasText: 'Ändra hur ofta' }).click(); await p.waitForTimeout(400); await vantaManus(p);
await p.locator('#mitt button', { hasText: 'Varje morgon 08:00' }).last().click(); await p.waitForTimeout(800); await vantaManus(p);
const u2 = (await api('/api/uppdrag')).uppdrag[0];
ok(u2.schema === 'varje dag 08:00' && new Date(u2.nasta).getHours() === 8, `ändrat: ${u2.schema}`);
await slut();
