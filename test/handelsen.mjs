/// Fas 27 på riktigt: en fil i en bevakad mapp väcker uppdraget — inom en
/// minut, fast schemat säger en gång om dygnet.
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
const mapp = '/tmp/maximus-handelse-mapp';
await rm(mapp, { recursive: true, force: true }); await mkdir(mapp, { recursive: true });
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
const t = await api('/api/tillstand', { id: 'mapp', svar: 'ja', sokvag: mapp });
ok(!t.error, `mappen påslagen ${t.error || ''}`);
await api('/api/uppdrag', { instruktion: 'Så fort något nytt hamnar i mappen, säg till om det handlar om offerter.', kallor: [{ typ: 'mapp' }], aterkommande: true, takt: 1440 });
let u = (await api('/api/uppdrag')).uppdrag.find(x => x.kallor.includes('mapp'));
ok(u?.handelse === true, 'uppdraget väcks av händelser');
// Första varvet sätter vattenmärket (tom mapp).
await api(`/api/uppdrag/${u.id}/kor`, {});
const fore = (await api('/api/uppdrag')).uppdrag.find(x => x.id === u.id).senast;
await p.waitForTimeout(31000); // golvet
const t0 = Date.now();
await writeFile(`${mapp}/offert-nordal.txt`, 'Offerten till Nordal ska in på fredag. Pris 240 000 kr.');
let efter = fore;
for (let i = 0; i < 180 && efter === fore; i++) { await p.waitForTimeout(1000); efter = (await api('/api/uppdrag')).uppdrag.find(x => x.id === u.id).senast; }
ok(efter !== fore, `filen väckte uppdraget efter ${Math.round((Date.now() - t0) / 1000)} s`);
const a = await api('/api/agent');
ok((a.fynd || []).some(f => /offert/i.test(f.titel || '')), `offerten lyftes fram: ${(a.fynd || []).map(f => f.titel).join(', ')}`);
await rm(mapp, { recursive: true, force: true });
await slut();
