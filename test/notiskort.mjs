// Agentens notiskort (Auro 2026-10-10): de tonar ut av sig själva, och i
// vilan visas inget kort — det räknas i en plupp vid märket och visas när
// du kommer tillbaka.
//
// Händelseströmmen fångas och matas med påhittade "fyndsamtal", så provet
// inte behöver en agent som råkar hitta något.
//
//   sh scripts/provserver.sh start   → PORT och NYCKEL
//   node test/notiskort.mjs <nyckel>
import { oppna, forbiStarten } from './hjalpare.mjs';

const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);

const koe = [];
await p.route('**/api/handelser', route => {
  const h = koe.shift();
  route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' },
    body: `retry: 400\n\n${h ? `data: ${JSON.stringify(h)}\n\n` : ''}` });
});
koe.push({ typ: 'fyndsamtal', id: 'prov-a', titel: 'Prov A' });
await p.reload({ waitUntil: 'domcontentloaded' });

await p.waitForSelector('.fyndnotis', { timeout: 8000 }).catch(() => {});
ok(await p.locator('.fyndnotis').count() === 1, 'kortet visas');
await p.waitForTimeout(9500);
ok(await p.locator('.fyndnotis').count() === 0, 'kortet tonade ut av sig självt efter åtta sekunder');

// Musen på kortet håller kvar det.
koe.push({ typ: 'fyndsamtal', id: 'prov-h', titel: 'Prov hovra' });
await p.waitForSelector('.fyndnotis', { timeout: 8000 }).catch(() => {});
await p.hover('.fyndnotis');
await p.waitForTimeout(9500);
ok(await p.locator('.fyndnotis').count() === 1, 'musen på kortet håller kvar det');
await p.mouse.move(5, 5);
await p.waitForTimeout(9000);
ok(await p.locator('.fyndnotis').count() === 0, 'och det tonar ut när musen går');

// I vilan: inget kort, en plupp.
await p.click('.oronmarke');
await p.waitForTimeout(600);
koe.push({ typ: 'fyndsamtal', id: 'prov-b', titel: 'Prov B' });
koe.push({ typ: 'fyndsamtal', id: 'prov-c', titel: 'Prov C' });
await p.waitForFunction(() => document.querySelector('#vila .plupp')?.textContent === '2', null, { timeout: 8000 }).catch(() => {});
ok(await p.locator('.fyndnotis').count() === 0, 'i vilan visas inget kort ovanpå skärmsläckaren');
ok((await p.locator('#vila .plupp').textContent().catch(() => '')) === '2', 'pluppen vid märket räknar två nya');

// Tillbaka: de nya visas, pluppen är borta.
await p.keyboard.press('Enter');
await p.waitForFunction(() => document.querySelectorAll('.fyndnotis').length === 2, null, { timeout: 60000 }).catch(() => {});
ok(await p.locator('.fyndnotis').count() === 2, 'tillbaka: de två nya visas');
ok(await p.locator('#vila .plupp').count() === 0, 'pluppen är borta');
await p.screenshot({ path: '/tmp/maximus-notiskort.png' });
await slut();
