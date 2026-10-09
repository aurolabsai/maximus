/// Fas 29 på riktigt: en bevakning utan adress hittar sina källor, minst
/// fem, och lämnar ett sammandrag.
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
await api('/api/installningar', { agent: { ...(await api('/api/uppstart')).installningar.agent, sidor: true } });
await api('/api/uppdrag', { instruktion: 'Håll koll på AI i offentlig sektor och lyft fram det som är nytt.', kallor: [{ typ: 'amne', fraga: 'AI i offentlig sektor' }], aterkommande: true, takt: 1440 });
const u = (await api('/api/uppdrag')).uppdrag.find(x => x.amne);
ok(u?.amne === 'AI i offentlig sektor', 'uppdraget bevakar ämnet');
const t0 = Date.now();
const r = await api(`/api/uppdrag/${u.id}/kor`, {});
const efter = (await api('/api/uppdrag')).uppdrag.find(x => x.id === u.id);
console.log('  källor:', (efter.kallmangd || []).map(k => `${k.vard}${k.flode ? ' (flöde)' : ''}`).join(', '));
ok((efter.kallmangd || []).length >= 5, `minst fem källor hittades: ${(efter.kallmangd || []).length}, ${Math.round((Date.now() - t0) / 1000)} s`);
ok((efter.kallmangd || []).some(k => k.flode), 'minst en med flöde');
console.log('  varvet:', JSON.stringify(r.varv || r).slice(0, 300));
ok((r.varv?.vagda || 0) > 0, `agenten läste poster ur källorna: ${r.varv?.vagda}`);
ok((r.varv?.fynd || 0) > 0 && r.varv?.samtal, `något lyftes fram, i ett samtal: ${r.varv?.fynd}`);
await slut();
