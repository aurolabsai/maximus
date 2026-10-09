/// Fas 33: tre uppdrag rapporterar i samma samtal, Agenten; där besvaras
/// "vad hände?" ur spåret, och "pausa allt till måndag" pausar till måndag.
import { oppna, forbiStarten, modellUppe, skriv } from './hjalpare.mjs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
const mapp = '/tmp/maximus-agentsamtal-mapp';
await rm(mapp, { recursive: true, force: true }); await mkdir(mapp, { recursive: true });
await writeFile(`${mapp}/offert.txt`, 'Offerten till Nordal: 240 000 kr, ska in på fredag.');
await writeFile(`${mapp}/faktura.txt`, 'Faktura 1041 från Kontorab, att betala 12 400 kr senast 15 oktober.');
await writeFile(`${mapp}/protokoll.txt`, 'Protokoll från styrgruppen: beslut om ny AI-policy i november.');
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
await api('/api/tillstand', { id: 'mapp', svar: 'ja', sokvag: mapp });
for (const [titel, instr] of [['Offerter', 'Lyft fram offerter i mappen.'], ['Fakturor', 'Lyft fram fakturor i mappen.'], ['Protokoll', 'Lyft fram protokoll i mappen.']]) {
  await api('/api/uppdrag', { titel, instruktion: instr, kallor: [{ typ: 'mapp' }], aterkommande: true, takt: 1440 });
}
for (const u of (await api('/api/uppdrag')).uppdrag) await api(`/api/uppdrag/${u.id}/kor`, {});
const l = await api('/api/sessioner');
const agenten = l.find(x => x.agentsamtal);
ok(agenten, 'Agenten finns som ett samtal');
const s = await api(`/api/sessioner/${agenten.id}`);
const uppdragIRapporterna = new Set(s.turer.map(t => t.uppdrag).filter(Boolean));
ok(uppdragIRapporterna.size === 3, `tre uppdrag rapporterade i samma samtal: ${uppdragIRapporterna.size}`);
// Undersökningar (Fas 38) är egna samtal med flit; rapporterna är det inte.
ok(!l.some(x => x.avAgenten && !x.agentsamtal && !x.a2a && x.uppdrag), 'inga egna trådar per uppdrag');
await p.reload({ waitUntil: 'networkidle' });
await p.click('#list-agenten');
await p.waitForTimeout(800);
const turen = async fraga => {
  for (let i = 0; i < 240; i++) {
    const t = (await api(`/api/sessioner/${agenten.id}`)).turer?.find(y => y.fraga === fraga);
    if (t?.status === 'klar') return t;
    await p.waitForTimeout(1000);
  }
  return null;
};
const F1 = 'Vad hände den senaste timmen?';
await skriv(p, F1, 500);
let t = await turen(F1);
console.log('  svar:', String(t?.svar || '').replace(/\n/g, ' ').slice(0, 300));
ok(/offert|faktura|protokoll/i.test(t?.svar || ''), 'svaret bygger på spåret');
const F2 = 'Pausa allt till måndag.';
await skriv(p, F2, 500);
t = await turen(F2);
console.log('  svar:', String(t?.svar || '').replace(/\n/g, ' ').slice(0, 200));
const u = (await api('/api/uppdrag')).uppdrag;
ok(u.every(x => x.tillstand === 'pausad'), 'alla tre pausade');
const mandag = new Date(); mandag.setDate(mandag.getDate() + ((8 - mandag.getDay()) % 7 || 7)); mandag.setHours(0, 0, 0, 0);
ok(u.every(x => x.pausTill && new Date(x.pausTill).toDateString() === mandag.toDateString()), `till nästa måndag: ${u[0]?.pausTill}`);
// Sidopanelen: Agenten överst med antalet nya; i samtalet syns dagens rapporter.
await p.reload({ waitUntil: 'networkidle' });
ok(await p.locator('#list-agenten').isVisible(), 'Agenten i listen, alltid där (Fas 48)');
await p.click('#list-agenten'); await p.waitForTimeout(800);
ok(await p.locator('#mitt .tur').count() >= 3, 'dagens rapporter syns i samtalet');
await p.screenshot({ path: '/tmp/agentsamtalet.png' });
await rm(mapp, { recursive: true, force: true });
await slut();
