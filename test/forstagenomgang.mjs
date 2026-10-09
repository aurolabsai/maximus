/// Agenten som första steg (2026-10-05): genomgången lägger en överblick i
/// Agentens samtal med tre förslag på uppdrag; "Sätt upp" gör förslaget till
/// ett uppdrag direkt (2026-10-06).
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
await api('/api/installningar', { agent: { kalender: { kalendrar: [] } }, profil: { vem: 'Upphandlare på en kommun, mest IT-avtal' } });
const g = await api('/api/agent/forsta', {});
ok(g.session, 'genomgången startade');
let t;
for (let i = 0; i < 240; i++) { t = (await api(`/api/sessioner/${g.session}`)).turer?.find(x => x.id === g.tur); if (t?.status === 'klar') break; await p.waitForTimeout(1000); }
console.log('  svar:', String(t?.svar || '').replace(/\n/g, ' ').slice(0, 300));
console.log('  förslag:', JSON.stringify(t?.forslag));
ok(/Det närmaste/i.test(t?.svar || '') && /väntar/i.test(t?.svar || ''), 'överblicken har sina delar');
ok((t?.forslag || []).length >= 2, `förslag på uppdrag: ${(t?.forslag || []).length}`);
await p.reload({ waitUntil: 'networkidle' });
await p.click('#list-agenten'); await p.waitForTimeout(800);
ok(await p.locator('.forslag-ett').count() >= 2, 'förslagen syns som kort');
const fore = (await api('/api/uppdrag')).uppdrag?.length || 0;
await p.locator('.forslag-ett button').first().click();
await p.waitForTimeout(1200);
const efter = (await api('/api/uppdrag')).uppdrag || [];
ok(efter.length === fore + 1 && /^Håll koll på/i.test(efter.at(-1)?.instruktion || ''), `"Sätt upp" blev ett uppdrag: ${efter.at(-1)?.instruktion}`);
ok(await p.locator('.forslag-ett button', { hasText: 'Uppsatt' }).count() === 1, 'knappen säger att det är gjort');
await p.screenshot({ path: '/tmp/forstagenomgang.png' });
await slut();
