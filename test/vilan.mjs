/// Vilan (2026-10-04): klick på märket eller Esc två gånger dimmar allt;
/// mellanslag, Enter eller klick tillbaka — med lösenord om det finns.
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
p.on('console', m => { if (m.type() === 'error') console.log('  konsol:', m.text().slice(0, 200)); });
p.on('pageerror', e => console.log('  sidfel:', String(e).slice(0, 200)));
await forbiStarten(p, api);
await p.reload({ waitUntil: 'networkidle' });
const synlig = () => p.evaluate(() => !document.querySelector('#vila').hidden);
await p.click('.oronmarke'); await p.waitForTimeout(400);
ok(await synlig() && await p.evaluate(() => document.querySelector('#komp').closest('[inert]') !== null || document.querySelector('.komp-yta')?.inert), 'klick på märket: vilan, och resten går inte att nå');
ok(/Mellanslag/.test(await p.locator('#vila-om').textContent()), 'den säger hur man kommer tillbaka');
await p.keyboard.press('Space');
// Kom modellen upp under tiden pausar vilan den, och tillbaka väntar in den.
await p.waitForFunction(() => document.querySelector('#vila').hidden, null, { timeout: 60000 }).catch(() => {});
ok(!await synlig(), 'mellanslag: tillbaka');
await p.click('#mitt'); await p.keyboard.press('Escape'); await p.waitForTimeout(120); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
ok(await synlig(), 'Esc två gånger: vilan');
await p.keyboard.press('Enter');
await p.waitForFunction(() => document.querySelector('#vila').hidden, null, { timeout: 60000 }).catch(() => {});
ok(!await synlig(), 'Enter: tillbaka');
// Med modellen uppe: vilan pausar den, och tillbaka väntar in den med förlopp.
ok(await modellUppe(p, api), 'modellen uppe');
await p.reload({ waitUntil: 'networkidle' });
await p.click('.oronmarke'); await p.waitForTimeout(800);
ok((await api('/api/uppstart')).pausad === true, 'vilan pausar modellen');
await p.keyboard.press('Enter'); await p.waitForTimeout(60);
ok(await synlig() && await p.locator('#vila-forlopp:not([hidden])').count() === 1 && /Väcker modellen/.test(await p.locator('#vila-om').textContent()),
  'Enter: vilan står kvar med förlopp och "Väcker modellen"');
await p.waitForFunction(() => document.querySelector('#vila').hidden, null, { timeout: 60000 });
const u = await api('/api/uppstart');
ok(u.grind && !u.pausad, 'vilan släpper först när modellen svarar');
// Uppstarten öppnar i vilan; Enter för att komma in.
await api('/api/installningar', { vilaVidStart: true });
await p.reload({ waitUntil: 'networkidle' });
ok(await synlig() && /komma in/.test(await p.locator('#vila-om').textContent()), 'uppstart: vilan, och Enter för att komma in');
await p.keyboard.press('Enter');
await p.waitForFunction(() => document.querySelector('#vila').hidden, null, { timeout: 60000 });
ok(await p.evaluate(() => !document.querySelector('#komp').closest('[inert]')), 'Enter: inne, och appen går att nå');
await api('/api/installningar', { vilaVidStart: false });
// Med lösenord: ett riktigt lås.
await api('/api/maximus', { vad: 'satt', losenord: 'provlosen-123', kommIhag: false });
// Ett tidigare prov kan ha lämnat lösenordet i nyckelringen; då låser Maximus upp sig själv.
await api('/api/maximus', { vad: 'glom' });
await p.reload({ waitUntil: 'networkidle' });
await p.click('.oronmarke'); await p.waitForTimeout(800);
const m = (await api('/api/uppstart')).maximus || {};
ok(m.skyddat && !m.upplast, 'med lösenord: Maximus låses när vilan börjar');
await p.mouse.click(400, 400); await p.waitForTimeout(600);
ok(await p.locator('#lasupp[open]').count() === 1, 'tillbaka kräver lösenordet');
// Inte ihågkommet: då låser Maximus upp sig själv vid start, och det finns ingen kod att skriva.
await p.uncheck('#lasupp-minns');
await p.fill('#lasupp-ord', 'provlosen-123'); await p.keyboard.press('Enter');
await p.waitForFunction(() => document.querySelector('#vila').hidden, null, { timeout: 60000 });
ok(true, 'lösenordet: vilan släpper');
// Uppstart med lösenord: koden först, sedan rakt in.
await api('/api/maximus', { vad: 'las' });
await p.reload({ waitUntil: 'load' });
await p.waitForSelector('#lasupp[open]', { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(800);
const lage = { ...(await p.evaluate(() => ({ vila: !document.querySelector('#vila').hidden, lasupp: document.querySelector('#lasupp').open }))), ...(await api('/api/uppstart')).maximus };
if (!lage.vila) console.log('läge:', JSON.stringify(lage));
ok(await synlig(), 'uppstart låst: vilan står bakom');
ok(await p.locator('#lasupp[open]').count() === 1, 'uppstart låst: lösenordet först');
await p.fill('#lasupp-ord', 'provlosen-123'); await p.keyboard.press('Enter');
await p.waitForFunction(() => document.querySelector('#vila').hidden, null, { timeout: 60000 });
ok((await api('/api/uppstart')).maximus?.upplast, 'efter lösenordet: inne, utan ett Enter till');
await api('/api/maximus', { vad: 'glom' });
await slut();
