/// Fas 52: "Kan vi sätta upp en bevakning?" i ett samtal ur en nyhet ger ett
/// kort med samtalets ämne — inte ett ja i text och inget mer (Auro
/// 2026-10-06, samtalet om Konrad Albers). Ett svar på kortet blir dess
/// ämne, och ja ger ett uppdrag. Riktig modell, mot en NY provserver.
///
///   node test/bevakanyhet.mjs <nyckel>
import { oppna, forbiStarten, skriv, svarare, modellUppe } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
await api('/api/installningar', { agent: { nyheter: true } });
ok(await modellUppe(p, api), 'modellen uppe');
const s = await api('/api/sessioner', {});
await api(`/api/sessioner/${s.id}/titel`, { titel: 'Gripande av Konrad Albers' });
const artikel = 'Tidigare myndighetschef gripen\nhttps://www.dn.se/varlden/x\n\nDen tidigare myndighetschefen Konrad Albers har gripits misstänkt för att ha lämnat ut uppgifter. ' + 'Utredningen gäller säkerhetsskyddet i Europa. '.repeat(20);
await p.evaluate(async ([id, text]) => fetch(`/api/sessioner/${id}/fil`, { method: 'POST', headers: { 'X-Maximus-Local': '1', 'X-Maximus-Namn': 'Tidigare myndighetschef gripen.txt' }, body: text }), [s.id, artikel]);
await p.reload({ waitUntil: 'networkidle' });
await p.click(`.sess[data-sess="${s.id}"] .sess-oppna`); await p.waitForTimeout(1200);
const svar = svarare(p, api);

await skriv(p, 'Kan vi sätta upp en bevakning?', 300);
await svar();
await p.waitForSelector('.uppdragsforslag', { timeout: 60000 }).catch(() => {});
let kort = await p.locator('.uppdragsforslag').last().textContent().catch(() => '');
console.log('   kort:', kort.replace(/\s+/g, ' ').slice(0, 220));
ok(/Konrad Albers/.test(kort), 'frågan gav ett kort, med samtalets ämne');

await skriv(p, 'Håll på ämnen som berör detta och datasäkerhet inom såväl EU som Sverige', 300);
await svar();
await p.waitForTimeout(1500);
kort = await p.locator('.uppdragsforslag').last().textContent().catch(() => '');
console.log('   kort 2:', kort.replace(/\s+/g, ' ').slice(0, 260));
ok(/datasäkerhet inom såväl EU som Sverige/.test(kort) && /Konrad Albers/.test(kort), 'svaret blev kortets ämne, med "detta" som samtalets ämne');

const ja = p.locator('.uppdragsforslag').last().locator('button.primar').first();
console.log('   ja-knappen:', await ja.textContent());
await ja.click(); await p.waitForTimeout(2500);
const u = (await api('/api/uppdrag')).uppdrag.find(x => /datasäkerhet/.test(x.titel || x.amne || ''));
ok(Boolean(u), `uppdraget finns: ${u?.titel}`);
ok(u?.kallor.includes('amne') && /Konrad Albers/.test(u?.amne || ''), `det letar själv upp källor om ämnet: ${u?.amne}`);
await p.screenshot({ path: '/tmp/maximus-bevakanyhet.png' });
await slut();
