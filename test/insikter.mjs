/// 2026-10-06: medan Maximus arbetar i onboardingen syns samma stegrad som i
/// samtalen — små besked på tre–fem ord och sekunderna — inga prickar.
import { oppna } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await api('/api/uppdatering', { satt: false });
await p.waitForSelector('#borja-villkor', { timeout: 15000 });
await p.locator('#borja-villkor').check(); await p.click('#borja-fortsatt');
await p.waitForSelector('#borja-modeller', { timeout: 15000 }); await p.click('#borja-modeller');
await p.waitForSelector('#borja', { state: 'hidden', timeout: 120000 });
await p.waitForSelector('.forsta-val button', { timeout: 30000 });
const [v] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.forsta-val button', { hasText: 'Bifoga' }).click()]);
await v.setFiles('/tmp/maximus-prov-cv.txt');
const sett = new Set();
let prickar = false;
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(700);
  const t = await p.locator('.manus-arbete .steg-nu').textContent().catch(() => null);
  if (t) sett.add(t);
  if (await p.locator('.manus-arbete').count() && await p.locator('.manus-arbete ~ .manus-tanker, .tur:has(.manus-arbete) .manus-tanker').count()) prickar = true;
  if (sett.size >= 3) break;
}
await p.screenshot({ path: '/tmp/maximus-insikter.png' });
console.log('   besked:', [...sett].join(' → '));
ok(sett.size >= 2, `beskeden byts medan analysen pågår (${sett.size})`);
ok([...sett].every(t => t.split(/\s+/).length <= 5), 'tre–fem ord');
ok(!prickar, 'inga prickar bredvid stegraden');
ok(await p.locator('.manus-arbete .tick').count() === 1, 'sekunderna står där, som i samtalen');
await slut();
