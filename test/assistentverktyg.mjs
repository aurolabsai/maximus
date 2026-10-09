/// Fas 31: en fråga om dina egna saker besvaras med agentens verktyg, i
/// samtalet, med kvittot som säger vad svaret bygger på. En tillgång som är
/// av sägs som av — inget hittas på.
import { oppna, forbiStarten, modellUppe, skriv } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
await api('/api/installningar', { agent: { kalender: { kalendrar: [] } } });
await p.reload({ waitUntil: 'networkidle' });
const sista = async fraga => {
  for (let i = 0; i < 240; i++) {
    for (const x of (await api('/api/sessioner')).slice(0, 3)) {
      const t = (await api(`/api/sessioner/${x.id}`)).turer?.find(y => y.fraga === fraga);
      if (t?.status === 'klar') return t;
    }
    await p.waitForTimeout(1000);
  }
  return null;
};
await skriv(p, 'Vad har jag för möten i morgon?', 500);
let t = await sista('Vad har jag för möten i morgon?');
console.log('  svar:', String(t?.svar || '').replace(/\n/g, ' ').slice(0, 240), '| kvitto:', JSON.stringify((t?.kvitto || []).map(k => `${k.aktor}: ${k.vad}`)));
ok((t?.kvitto || []).some(k => k.aktor === 'Agenten' && /kalender/.test(k.vad)), 'svaret bygger på kalendern, och kvittot säger det');
ok(!(t?.kvitto || []).some(k => k.aktor === 'Webben'), 'ingen webbsökning om din kalender');
await skriv(p, 'Vad står på mina påminnelser?', 500);
t = await sista('Vad står på mina påminnelser?');
console.log('  svar:', String(t?.svar || '').replace(/\n/g, ' ').slice(0, 240));
ok(/avstängt|inte (gett|tillgång|lov)|slås på|Inställningar/i.test(t?.svar || ''), 'påminnelserna är av, och svaret säger det i stället för att hitta på');
await slut();
