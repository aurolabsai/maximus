/// Fas 35: källorna väljs per uppdrag, också flera mappar. Ett uppdrag på
/// kalendern får två mappar via dialogen "Välj källor", och nästa varv läser
/// alla tre.
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
const A = '/tmp/maximus-kallval-a', B = '/tmp/maximus-kallval-b';
for (const m of [A, B]) { await rm(m, { recursive: true, force: true }); await mkdir(m, { recursive: true }); }
await writeFile(`${A}/offert-nordal.txt`, 'Offerten till Nordal inför mötet: 240 000 kr.');
await writeFile(`${B}/agenda-vaxjo.txt`, 'Agenda för mötet med Jens på Nordal i Växjö: upphandling, tidplan, pris.');
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
await api('/api/installningar', { agent: { kalender: { kalendrar: [] } } });
for (const m of [A, B]) await api('/api/tillstand', { id: 'mapp', svar: 'ja', sokvag: m });
const ag = (await api('/api/uppstart')).installningar.agent;
ok((ag.mappar || []).length === 2, `två mappar med lov: ${(ag.mappar || []).map(m => m.sokvag).join(', ')}`);
await api('/api/uppdrag', { titel: 'Inför Nordal', instruktion: 'Håll koll på allt inför mötet med Jens på Nordal.', kallor: [{ typ: 'kalender' }], aterkommande: true, takt: 1440 });
await p.reload({ waitUntil: 'networkidle' });
await p.click('#list-uppdrag'); await p.waitForSelector('.uppdragen-rad'); await p.click('.uppdragen-rad');
await p.waitForSelector('#mitt button:has-text("Välj källor")', { timeout: 20000 });
await p.click('#mitt button:has-text("Välj källor")');
await p.waitForSelector('dialog.kallval[open]');
const rader = await p.locator('dialog.kallval .vaxelrad span').allTextContents();
console.log('  i dialogen:', rader.join(' | '));
ok(rader.some(r => /maximus-kallval-a/.test(r)) && rader.some(r => /maximus-kallval-b/.test(r)), 'båda mapparna går att välja');
for (const c of await p.locator('dialog.kallval input[data-nyckel^="mapp:"]').all()) await c.check();
await p.click('dialog.kallval button:has-text("Spara")');
await p.waitForTimeout(1500);
const u = (await api('/api/uppdrag')).uppdrag.find(x => x.titel === 'Inför Nordal');
ok(u.kallval.length === 3 && u.kallval.filter(k => k.typ === 'mapp').length === 2, `uppdraget läser tre källor: ${u.kallval.map(k => k.sokvag || k.typ).join(', ')}`);
const r = await api(`/api/uppdrag/${u.id}/kor`, {});
console.log('  varvet:', JSON.stringify(r.varv).slice(0, 200));
const f = ((await api('/api/agent')).fynd || []).filter(x => x.uppdrag === u.id).map(x => x.titel);
console.log('  fynd:', f.join(' | '));
ok(f.some(t => /offert/i.test(t)) && f.some(t => /agenda/i.test(t)), 'varvet läste båda mapparna');
for (const m of [A, B]) await rm(m, { recursive: true, force: true });
await slut();
