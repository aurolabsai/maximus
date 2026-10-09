/// Hem (2026-10-04): Esc stänger samtalet, Tillbaka går hem, också från arkivet.
import { oppna, forbiStarten } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
const a = await api('/api/sessioner/manus', { titel: 'Ett samtal', rader: [{ av: 'du', text: 'hej' }, { av: 'maximus', text: 'hej' }] });
const b = await api('/api/sessioner/manus', { titel: 'Arkiverat', rader: [{ av: 'du', text: 'hej' }, { av: 'maximus', text: 'hej' }] });
await api(`/api/sessioner/${b.id}/arkivera`, {});
await p.reload({ waitUntil: 'networkidle' });
const vald = () => p.evaluate(() => document.querySelector('.sess.vald')?.dataset.sess || null);
await p.click(`.sess[data-sess="${a.id}"] .sess-oppna`); await p.waitForTimeout(600);
ok(await vald() === a.id, 'samtalet öppnat');
await p.click('#mitt'); await p.keyboard.press('Escape'); await p.waitForTimeout(600);
ok(await vald() === null && !(await p.locator('#sesstopp-titel').isVisible().catch(() => false)), 'Esc stänger samtalet');
// Kommandomenyn stängs först, samtalet står kvar.
await p.click(`.sess[data-sess="${a.id}"] .sess-oppna`); await p.waitForTimeout(600);
await p.locator('#fraga').pressSequentially('/'); await p.waitForTimeout(200);
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
ok(await vald() === a.id, 'Esc i kommandomenyn stänger bara menyn');
// Från arkivet, via inställningarna och Tillbaka.
await p.click('#lador [data-lada="arkiv"]'); await p.waitForTimeout(500);
await p.click(`.sess[data-sess="${b.id}"] .sess-oppna`); await p.waitForTimeout(600);
await p.fill('#fraga', '/installningar'); await p.keyboard.press('Escape'); await p.keyboard.press('Enter'); await p.waitForTimeout(1000);
await p.click('#inst-stang'); await p.waitForTimeout(600);
const lada = await p.evaluate(() => document.querySelector('#lador [aria-selected="true"]')?.dataset.lada);
ok(await vald() === null && lada === 'inkorg', `Tillbaka går hem, till pågående (${lada})`);
await slut();
