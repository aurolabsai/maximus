/// Assistenten föreslår uppdrag (Fas 11), provat mot den RIKTIGA modellen.
///
///   sh scripts/provserver.sh start
///   node test/forslag.mjs <nyckel>
import { oppna, forbiStarten, skriv, svarare, modellUppe } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen är uppe');
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(800);
const svar = svarare(p, api);
// Förslag bygger på andra samtal, så de kommer bara i "Minns mig"
// (2026-10-04). Varje nytt samtal sätts dit; `isolerat` låter det stå.
const minne = async id => { await p.click('#lage-knapp'); await p.click(`#meny-minne [data-val="${id}"]`); await p.waitForTimeout(200); };
const nytt = async ({ isolerat = false } = {}) => { await p.keyboard.press('Meta+n'); await p.waitForTimeout(600); if (!isolerat) await minne('minns'); };
await minne('minns');
const fraga = async text => { await skriv(p, text, 300); const r = await svar(); await p.waitForTimeout(1500); return r; };

let { t } = await fraga('Vad kostade anbudet från Byggfirman Ekdal? Svara kort, du vet inte.');
ok(!t.uppdragsforslag && await p.locator('.uppdragsforslag').count() === 0, 'första gången: inget förslag');

await nytt();
({ t } = await fraga('Hur lång är avtalsspärren i upphandlingen där Ekdal lämnade anbud? Svara kort.'));
ok(t.uppdragsforslag?.amne === 'Ekdal', `andra samtalet om Ekdal: förslag (${t.uppdragsforslag?.amne})`);
const ruta = p.locator('.uppdragsforslag');
ok(await ruta.count() === 1 && /frågat om i ett annat samtal.*Ekdal\?/.test(await ruta.textContent()), 'förslaget står under svaret, med varför');
await p.screenshot({ path: '/tmp/maximus-forslag.png' });
ok((await p.locator('#sesstopp-titel').textContent()) !== 'Ny session', `toppraden har samtalets namn (${await p.locator('#sesstopp-titel').textContent()})`);
await ruta.locator('button', { hasText: 'Ja' }).click();
await p.waitForTimeout(800);
ok(/^Uppdrag: jag säger till när något nytt kommer om Ekdal\./.test(await p.locator('.uppdragsforslag').textContent()), 'ja: det står vad som bestämdes');
const u = await api('/api/uppdrag');
ok(u.uppdrag.length === 1 && u.uppdrag[0].titel === 'Ekdal' && u.uppdrag[0].aterkommande, 'ja: uppdraget finns, utan formulär');
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(600);
await p.locator('.sess-oppna').first().click();
await p.waitForTimeout(800);
ok(/^Uppdrag: /.test(await p.locator('.uppdragsforslag').first().textContent().catch(() => '')), 'beslutet står kvar när samtalet öppnas igen');

await nytt();
({ t } = await fraga('Vad händer med Ekdal nu? Svara kort.'));
ok(!t.uppdragsforslag, 'uppdraget finns redan: inget nytt förslag om Ekdal');

await nytt();
await fraga('Vem är Lindqvistbolaget? Svara kort, du vet inte.');
await nytt();
({ t } = await fraga('Har Lindqvistbolaget skickat sin offert? Svara kort.'));
ok(t.uppdragsforslag?.ord === 'lindqvistbolaget', 'ett nytt ämne som återkommer: förslag');
await p.locator('.uppdragsforslag button', { hasText: 'Nej' }).click();
await p.waitForTimeout(700);
ok(/Jag föreslår det inte igen/.test(await p.locator('.uppdragsforslag').textContent()), 'nej: det står, och det sägs att det inte kommer igen');
await nytt();
({ t } = await fraga('Lindqvistbolaget igen — något nytt? Svara kort.'));
ok(!t.uppdragsforslag, 'efter ett nej: inget förslag om samma ämne');
ok((await api('/api/uppdrag')).uppdrag.length === 1, 'nej skapade inget uppdrag');

// Isolerat vet inget om andra samtal, och föreslår därför inget.
await nytt({ isolerat: true });
await fraga('Vem är Sandbergs Måleri? Svara kort, du vet inte.');
await nytt({ isolerat: true });
({ t } = await fraga('Har Sandbergs Måleri svarat? Svara kort.'));
ok(!t.uppdragsforslag, 'isolerat: inget förslag, fast ämnet står i ett annat samtal');
await slut();
