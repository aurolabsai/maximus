/// Fas 51: molnet i starten, för den vars dator inte bär modellen. Mot en
/// provserver med låtsasleverantören (se test/molnet.mjs för env).
import { oppna } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await api('/api/uppdatering', { satt: false });
await p.waitForSelector('#borja-villkor', { timeout: 15000 });
await p.locator('#borja-villkor').check();
await p.click('#borja-fortsatt');
await p.waitForSelector('#borja-modeller', { timeout: 15000 });
const summary = p.locator('.borja-moln summary');
ok(await summary.count() === 1, `molnet erbjuds i starten: "${await summary.textContent()}"`);
if (!(await p.locator('.borja-moln').getAttribute('open') !== null)) await summary.click();
await p.selectOption('#borja-moln-lev', 'berget');
await p.fill('#borja-moln-nyckel', 'prov-nyckel-1234567890');
await p.locator('.borja-moln button', { hasText: 'Använd molnet' }).click();
await p.waitForTimeout(1500);
const svar = await p.locator('.borja-moln small.fotnotis').last().textContent();
ok(/^Valt: Berget AI/.test(svar), `valt: ${svar}`);
ok(await p.locator('#borja-modeller').textContent() === 'Fortsätt' || /Hämta/.test(await p.locator('#borja-modeller').textContent()), `knappen: ${await p.locator('#borja-modeller').textContent()}`);
await p.click('#borja-modeller');
await p.waitForSelector('#borja', { state: 'hidden', timeout: 120000 }).catch(() => {});
const u = await api('/api/uppstart');
ok(u.installningar?.modellval?.tanker === 'moln', `starten klar med molnet: ${JSON.stringify(u.installningar?.modellval)}`);
ok(u.moln?.pa === true, 'molnet svarar');
await slut();
