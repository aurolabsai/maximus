/// Fas 40: Uppdrag som en egen plats. En rad i sidopanelen med pluppen,
/// listan i arbetsytan med läge, senast, nästa och nytt, och ett klick går
/// in i uppdraget som i ett samtal.
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
const mapp = '/tmp/maximus-uppdragen-mapp';
await rm(mapp, { recursive: true, force: true }); await mkdir(mapp, { recursive: true });
await writeFile(`${mapp}/offert.txt`, 'Offerten till Nordal: 240 000 kr, ska in på fredag.');
await writeFile(`${mapp}/faktura.txt`, 'Faktura 1041 från Kontorab, att betala 12 400 kr senast 15 oktober.');
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
await api('/api/tillstand', { id: 'mapp', svar: 'ja', sokvag: mapp });
for (const [titel, instr] of [['Offerter', 'Lyft fram offerter i mappen.'], ['Fakturor', 'Lyft fram fakturor i mappen.']]) {
  await api('/api/uppdrag', { titel, instruktion: instr, kallor: [{ typ: 'mapp' }], aterkommande: true, takt: 1440 });
}
await api('/api/uppdrag', { titel: 'Vilande', instruktion: 'Håll koll på mappen.', kallor: [{ typ: 'mapp' }], aterkommande: true, takt: 1440 });
const vilande = (await api('/api/uppdrag')).uppdrag.find(u => u.titel === 'Vilande');
await api(`/api/uppdrag/${vilande.id}/pausa`, {});
for (const u of (await api('/api/uppdrag')).uppdrag.filter(x => x.titel !== 'Vilande')) await api(`/api/uppdrag/${u.id}/kor`, {});
const d = await api('/api/uppdrag');
const medNytt = d.uppdrag.filter(u => u.nya > 0);
ok(medNytt.length >= 1, `servern räknar nytt per uppdrag: ${d.uppdrag.map(u => `${u.titel} ${u.nya}/${u.antalFynd}`).join(', ')}`);
await p.reload({ waitUntil: 'networkidle' });
ok(await p.locator('.uppdragsrad').count() === 0, 'sidopanelen listar inte uppdragen ett och ett');
const plupp = await p.locator('#list-plupp').innerText().catch(() => '');
ok(plupp === String(medNytt.length), `pluppen på Uppdrag: ${plupp}`);
await p.click('#list-uppdrag');
await p.waitForSelector('.uppdragen-rad');
const rader = await p.locator('.uppdragen-rad').allInnerTexts();
ok(rader.length === 3, `listan i arbetsytan: ${rader.length} rader`);
ok(/pausad/.test(rader.join('\n')) && /igång/.test(rader.join('\n')), 'läget står i listan');
ok(rader[0] && (await p.locator('.uppdragen-rad').first().locator('.plupp').count()) === 1, 'det med nytt står först, med sin plupp');
ok(await p.locator('#list-uppdrag.vald').count() === 1, 'Uppdrag är valt i sidopanelen');
const forsta = medNytt.sort((a, b) => new Date(b.senast) - new Date(a.senast))[0];
await p.locator('.uppdragen-rad').first().click();
await p.waitForSelector('.uppdragsband', { timeout: 10000 });
const mitt = await p.evaluate(() => document.querySelector('#mitt').innerText);
ok(/Bara /.test(mitt) && /Läge och val/.test(mitt), 'in i uppdraget: dess rader och bandet med valen');
await p.waitForTimeout(800);
const efter = (await api('/api/uppdrag')).uppdrag;
ok(efter.filter(u => u.nya > 0).length === medNytt.length - 1, 'det man gått in i räknas som sett');
await p.click('.uppdragsband button:has-text("Alla uppdrag")');
await p.waitForSelector('.uppdragen-rad');
ok(await p.locator('.uppdragen-rad').count() === 3, '"Alla uppdrag" tillbaka till listan');
// Skrivfältet i Uppdrag är för ett nytt uppdrag, inte ett samtal (2026-10-06).
ok(await p.getAttribute('#fraga', 'placeholder') === 'Nytt uppdrag — t.ex. håll koll på mejl från Nordal varje morgon', 'skrivfältet säger "Nytt uppdrag"');
ok(!(await p.locator('#lagesval').isVisible()) && !(await p.locator('.komp-varning').isVisible()), 'samtalets val står inte där');
await p.click('#mitt'); await p.keyboard.press('Escape'); await p.waitForTimeout(700);
await p.screenshot({ path: '/tmp/maximus-esc.png' });
console.log('  efter Esc:', await p.locator('.uppdragen').count(), await p.locator('#list-uppdrag.vald').count(), await p.evaluate(() => document.activeElement?.id || document.activeElement?.className));
ok(await p.locator('.uppdragen').count() === 0 && await p.locator('#list-uppdrag.vald').count() === 0, 'Esc ur listan: hem');
ok(await p.getAttribute('#fraga', 'placeholder') === 'Skriv din fråga' && await p.locator('#lagesval').isVisible(), 'hemma igen: ett vanligt skrivfält');
void forsta;
await slut();
