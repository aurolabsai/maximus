/// Listen och panelen (Fas 48): listen alltid där, panelen fälls ut ur den
/// vid hovring och in när musen går, ett val fäller in den, knapparna går
/// dit de säger och visar var man är, och panelen går att fästa.
///
///   node test/listen.mjs <nyckel>
import { oppna, forbiStarten } from './hjalpare.mjs';
// Utan provets fästning: det är den fria panelen som provas.
const { p, ok, api, slut, b } = await oppna(process.argv[2], { fast: false });
await forbiStarten(p, api);
await api('/api/sessioner/manus', { titel: 'Ett samtal', rader: [{ av: 'du', text: 'Hej' }, { av: 'maximus', text: 'Hej.' }] });
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
const flyt = () => p.evaluate(() => document.body.classList.contains('flyt'));
const ute = () => p.evaluate(() => document.querySelector('#sido').classList.contains('ute'));
ok(await flyt(), 'fri panel som förval');
ok(await p.locator('#list .list-knapp').count() >= 7 && await p.locator('#list #strompanel, #list #ny, #list #appmeny, #list .oronmarke').count() === 4,
  'listen har sina knappar, lampan, plus, "…" och märket');
ok(!(await ute()), 'panelen är inne');
await p.hover('#list-samtal'); await p.waitForTimeout(400);
ok(await ute(), 'hovring på listen fäller ut panelen');
await p.mouse.move(1200, 500); await p.waitForTimeout(700);
ok(!(await ute()), 'panelen glider in när musen går');
await p.hover('#list-samtal'); await p.waitForTimeout(400);
await p.hover('#sido'); await p.waitForTimeout(400);
ok(await ute(), 'den står kvar medan musen är på panelen');
await p.click('#sido .sess .sess-oppna >> nth=0'); await p.waitForTimeout(900);
ok(!(await ute()), 'ett val i panelen fäller in den');
ok(await p.locator('#list-samtal.vald').count() === 1, 'listen visar att ett samtal är öppet');
await p.click('#list-hem'); await p.waitForTimeout(600);
ok(await p.locator('#list-hem.vald').count() === 1 && await p.locator('.ett-kort').count() === 1, 'Hem tar hem, och visar det');
await p.click('#list-uppdrag'); await p.waitForTimeout(800);
ok(await p.locator('.uppdragen').count() === 1 && await p.locator('#list-uppdrag.vald').count() === 1, 'Uppdrag öppnar listan');
await p.click('#list-inst'); await p.waitForTimeout(800);
ok(await p.locator('#list-inst.vald').count() === 1, 'Inställningar visar att man står där');
await p.click('#list-hem'); await p.waitForTimeout(300);
// Fäst ur den utfällda panelens eget huvud, där musen redan är.
await p.hover('#list-samtal'); await p.waitForTimeout(400);
await p.click('#sido-fast'); await p.waitForTimeout(500);
ok(!(await flyt()) && await p.locator('#sido').isVisible(), 'panelen fästs ur sitt eget huvud');
await p.mouse.move(1200, 500);
await p.click('#sido-vaxel'); await p.waitForTimeout(500);
ok(await flyt(), 'och lossar den igen');
void b;
await slut();
