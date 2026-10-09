/// Fas 32 i samtalet, i provläge (MAXIMUS_HANDLING_PROV=1 — ingenting skrivs
/// i användarens Påminnelser): agenten föreslår, ingenting görs före ja, ja
/// utför, ångra ångrar; med spaken på "aldrig" föreslås ingenting.
import { oppna, forbiStarten, modellUppe, skriv } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
await p.reload({ waitUntil: 'networkidle' });
const turen = async fraga => {
  for (let i = 0; i < 240; i++) {
    for (const x of (await api('/api/sessioner')).slice(0, 3)) {
      const t = (await api(`/api/sessioner/${x.id}`)).turer?.find(y => y.fraga === fraga);
      if (t?.status === 'klar') return t;
    }
    await p.waitForTimeout(1000);
  }
  return null;
};
const F1 = 'Skapa en påminnelse: ring Henrik i morgon klockan 9.';
await skriv(p, F1, 500);
let t = await turen(F1);
const h = t?.handlingar?.[0];
console.log('  svar:', String(t?.svar || '').replace(/\n/g, ' ').slice(0, 200), '| förslag:', h?.beskrivning);
ok(h?.typ === 'paminnelse' && /Henrik/i.test(h.beskrivning) && h.status === 'vantar', 'agenten föreslog påminnelsen, och den väntar på ja');
await p.waitForSelector(`[data-handling="${h.id}"] button:has-text("Ja, gör det")`, { timeout: 15000 });
await p.click(`[data-handling="${h.id}"] button:has-text("Ja, gör det")`);
await p.waitForSelector(`[data-handling="${h.id}"].handling-gjord`, { timeout: 30000 });
ok(/prov — ingenting skrevs/.test(await p.locator(`[data-handling="${h.id}"]`).innerText()), 'ja: gjord (provläge, ingenting skrevs)');
await p.click(`[data-handling="${h.id}"] button:has-text("Ångra")`);
await p.waitForSelector(`[data-handling="${h.id}"].handling-angrad`, { timeout: 15000 });
ok(true, 'ångra: ångrad');
await api('/api/installningar', { handlingar: { paminnelse: 'aldrig' } });
const F2 = 'Skapa en påminnelse: köp mjölk.';
await skriv(p, F2, 500);
t = await turen(F2);
console.log('  svar:', String(t?.svar || '').replace(/\n/g, ' ').slice(0, 200));
ok(!(t?.handlingar || []).length, 'spaken på aldrig: inget förslag');
await slut();
