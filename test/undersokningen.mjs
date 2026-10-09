/// Fas 38–39 mot den riktiga modellen: ett tungt fynd blir en undersökning
/// där agenten frågar och assistenten svarar med verktygen, och en slutsats.
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
const M = '/tmp/maximus-a2a-mapp';
await rm(M, { recursive: true, force: true }); await mkdir(M, { recursive: true });
await writeFile(`${M}/anbud-vaxjo.txt`, 'Anbudet till Växjö kommun, upphandling AI-assistent, ska vara inne fredag 9 oktober kl 12.00. Saknas fortfarande: referensuppdrag och prisbilaga. Kontakt: upphandling@kommun.example.');
await writeFile(`${M}/prisbilaga-utkast.txt`, 'Prisbilaga, utkast: licens 180 000 kr per år, införande 60 000 kr. Ej klar — saknar pris för support.');
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
await api('/api/tillstand', { id: 'mapp', svar: 'ja', sokvag: M });
ok((await api('/api/uppstart')).installningar.agent?.arbetar !== false, 'självständig som förval');
await api('/api/uppdrag', { titel: 'Anbud', instruktion: 'Lyft fram anbud och upphandlingar med frister som rör mig, särskilt det som saknas.', kallor: [{ typ: 'mapp', sokvag: M }], aterkommande: true, takt: 1440 });
const u = (await api('/api/uppdrag')).uppdrag.find(x => x.titel === 'Anbud');
await api(`/api/uppdrag/${u.id}/kor`, {});
const f = ((await api('/api/agent')).fynd || []).filter(x => x.uppdrag === u.id);
console.log('  fynd:', f.map(x => `${x.titel} (vikt ${x.vikt})`).join(' | '));
ok(f.length >= 1, 'fynd');
// Självständigt: väntar på en undersökning som startar av sig själv, annars knappen.
let sess = null;
for (let i = 0; i < 20 && !sess; i++) { await p.waitForTimeout(1500); sess = (await api('/api/sessioner')).find(x => x.a2a); }
const sjalv = Boolean(sess);
if (!sess) { const top = [...f].sort((a, b) => b.vikt - a.vikt)[0]; await api(`/api/fynd/${top.id}/undersok`, {}); }
let s;
for (let i = 0; i < 400; i++) {
  sess = (await api('/api/sessioner')).find(x => x.a2a);
  s = sess && await api(`/api/sessioner/${sess.id}`);
  if (s?.turer?.some(t => /Slutsats/.test(t.sager || ''))) break;
  await p.waitForTimeout(1500);
}
console.log(`  startade av sig själv: ${sjalv}`);
for (const t of s?.turer || []) console.log(`  ${t.av === 'agent' ? 'AGENTEN' : 'MAXIMUS'}: ${(t.fraga || t.sager || '').replace(/\n/g, ' ').slice(0, 140)}${t.svar ? `\n    ASSISTENTEN: ${t.svar.replace(/\n/g, ' ').slice(0, 200)} [${t.kvitto?.[0]?.vad || ''}]` : ''}`);
const fragor = (s?.turer || []).filter(t => t.av === 'agent');
ok(fragor.length >= 1 && fragor.every(t => t.svar), `agenten frågade ${fragor.length} gånger och fick svar`);
ok((s?.turer || []).some(t => /Slutsats/.test(t.sager || '')), 'en slutsats med säkerhet');
const ag = (await api('/api/sessioner')).find(x => x.agentsamtal);
const agt = ag && await api(`/api/sessioner/${ag.id}`);
ok(agt?.turer?.some(t => t.undersokning?.session === sess.id), 'raden i Agenten länkar till undersökningen');
await rm(M, { recursive: true, force: true });
await slut();
