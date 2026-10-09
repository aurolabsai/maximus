/// Fas 27 mot riktiga Mail (läser bara, med Auros ja 2026-10-05): ett uppdrag
/// som väcks av händelser tittar i inkorgen av sig självt inom golvet
/// (varannan minut), fast schemat säger en gång om dygnet.
import { oppna, forbiStarten } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
const konto = process.argv[3] || 'Aurolabs';
await api('/api/installningar', { agent: { epost: { konto, lada: 'INBOX' } } });
await api('/api/uppdrag', { instruktion: 'Säg till när någon mejlar om fakturor.', kallor: [{ typ: 'epost' }], aterkommande: true, takt: 1440 });
const u = (await api('/api/uppdrag')).uppdrag.find(x => x.kallor.includes('epost'));
ok(u?.handelse, 'uppdraget väcks av händelser');
const forsta = (await api('/api/uppdrag')).uppdrag.find(x => x.id === u.id).senast;
const t0 = Date.now();
let senast = forsta, ganger = 0, forra = forsta;
for (let i = 0; i < 400 && ganger < 2; i++) {
  await p.waitForTimeout(1500);
  senast = (await api('/api/uppdrag')).uppdrag.find(x => x.id === u.id).senast;
  if (senast && senast !== forra) { ganger++; console.log(`  tittade ${ganger}: ${Math.round((Date.now() - t0) / 1000)} s`); forra = senast; }
}
ok(ganger >= 2, `tittade i den riktiga inkorgen två gånger av sig själv på ${Math.round((Date.now() - t0) / 1000)} s`);
const spar = await api('/api/agent');
console.log('  osedda:', spar.osedda, 'fynd:', (spar.fynd || []).length);
await slut();
