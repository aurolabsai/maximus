/// Startsidan (2026-10-05): ett kort i taget som byts av sig självt, en meny
/// med allt assistenten och agenten kan, agentens kort skriver uppdraget i
/// rutan — och Esc ur ett uppdrags vy går hem.
import { oppna, forbiStarten } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
await p.reload({ waitUntil: 'networkidle' });
ok(await p.locator('.ett-kort').count() === 1 && await p.locator('.tom h1').count() === 0, 'ett kort, ingen rubrik');
await p.waitForTimeout(2500); await p.screenshot({ path: '/tmp/startkortet.png' });
const forsta = await p.locator('.ett-rubrik').innerText();
ok(await p.locator('.list #appmeny').isVisible(), 'Allt Maximus kan nås ur listens "…" (Fas 48)');
await p.mouse.move(900, 5);
await p.waitForTimeout(7800);
const andra = await p.locator('.ett-rubrik').innerText();
ok(forsta !== andra, `kortet byts av sig självt: "${forsta}" → "${andra}"`);
await p.hover('.ett-kort');
await p.waitForTimeout(7800);
ok(await p.locator('.ett-rubrik').innerText() === andra, 'står still medan musen vilar på det');
await p.click('#appmeny'); await p.click('.radmeny-val:has-text("Allt Maximus kan")');
const meny = await p.locator('.ett-meny').innerText();
ok(/ASSISTENTEN|Assistenten/.test(meny) && /AGENTEN|Agenten/.test(meny) && /inkorgen/.test(meny), 'menyn visar assistenten och agenten');
const r = await p.locator('.ett-meny').boundingBox();
ok(r && r.x >= 0 && r.y >= 0 && r.x + r.width <= 1280 && r.y + r.height <= 900, `panelen ryms i fönstret: ${Math.round(r?.x)},${Math.round(r?.y)} ${Math.round(r?.width)}×${Math.round(r?.height)}`);
await p.screenshot({ path: '/tmp/allt.png' });
await p.fill('.ett-sok', 'kalend');
ok(await p.locator('.ett-menyrad:visible').count() >= 1 && await p.locator('.ett-menyrad:visible').count() <= 3, 'sökningen filtrerar');
await p.fill('.ett-sok', '');
await p.click('.ett-menyrad:has-text("Låt agenten gå igenom inkorgen")');
ok(/Håll koll på min inkorg/.test(await p.inputValue('#fraga')), 'agentens kort skriver uppdraget i rutan');
await p.fill('#fraga', '');
// Esc ur ett uppdrags vy.
await api('/api/uppdrag', { titel: 'Provuppdraget', instruktion: 'Håll koll på kalendern.', kallor: [{ typ: 'kalender' }], aterkommande: true, takt: 60 });
await p.reload({ waitUntil: 'networkidle' });
await p.click('#list-uppdrag'); await p.waitForSelector('.uppdragen-rad'); await p.click('.uppdragen-rad');
await p.waitForSelector('#mitt button:has-text("Kör nu")', { timeout: 15000 });
await p.click('#mitt'); await p.keyboard.press('Escape'); await p.waitForTimeout(700);
ok(await p.locator('.ett-kort').count() === 1 && await p.locator('#list-uppdrag.vald').count() === 0, 'Esc ur uppdraget: hem');
await slut();
