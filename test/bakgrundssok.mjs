/// Fas 30 på riktigt: en sökning i bakgrunden blir ett engångsuppdrag med
/// fynd (bild, pris, länk) i en tråd; "fortsätt bevaka" gör den till en
/// bevakning, och nästa varv säger bara det nya.
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
await api('/api/installningar', { agent: { ...(await api('/api/uppstart')).installningar.agent, sidor: true } });
const t0 = Date.now();
const b = await api('/api/uppdrag/bakgrund', { fraga: 'hitta 6 klockarmband i läder till salu' });
ok(b.id, `uppdraget skapades: ${b.titel}`);
let u;
for (let i = 0; i < 400; i++) { u = (await api('/api/uppdrag')).uppdrag.find(x => x.id === b.id); if (u?.senast) break; await p.waitForTimeout(1500); }
ok(u?.senast, `sökningen kördes klart i bakgrunden: ${Math.round((Date.now() - t0) / 1000)} s`);
const a = await api('/api/agent');
const forsta = (a.fynd || []).filter(f => f.uppdrag === b.id);
console.log('  fynd:', forsta.map(f => `${f.titel.slice(0, 50)}${f.vara?.bild ? ' [bild]' : ''}${f.vara?.pris ? ` [${f.vara.pris}]` : ''}`).join(' | '));
ok(forsta.length >= 2, `fynd lyftes fram: ${forsta.length}`);
const s = await api(`/api/sessioner/${u.session}`);
const tur = (s.turer || []).at(-1);
ok(tur?.kallor?.length >= 2 && tur.uppdragskort?.engang, 'tråden har fynden som källor och kortet erbjuder att fortsätta');
ok(tur?.kallor?.some(k => k.vara?.bild), 'minst ett fynd med bild');
await api(`/api/uppdrag/${b.id}/andra`, { aterkommande: true });
u = (await api('/api/uppdrag')).uppdrag.find(x => x.id === b.id);
ok(u.aterkommande && u.takt >= 1440, `fortsätt bevaka: en gång om dygnet (${u.takt} min)`);
await api(`/api/uppdrag/${b.id}/kor`, {});
const andra = ((await api('/api/agent')).fynd || []).filter(f => f.uppdrag === b.id && !forsta.some(x => x.id === f.id));
const sedda = new Set(forsta.map(f => f.url));
ok(!andra.some(f => sedda.has(f.url)), `andra varvet: bara nya (${andra.length} nya, inget upprepat)`);
await slut();
