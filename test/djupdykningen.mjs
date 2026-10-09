/// Fas 46: djupdykningen med Auros riktiga prompt mot DIF 2026 (SCC UK).
/// Facit: BRIEF_DIF_2026-10-07. Mäter, tycker inte: vilka som hittas, vem
/// som hamnar på A-listan, läget med källa, faktakollen mot SAFE_TO_SAY.
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
import { readFile } from 'node:fs/promises';
const PROMPT = `Jag jobbar ju som Partner Manager för AI Sweden Kronoberg via Växjö Linnaeus Science Park (där jag är anställd som "affärsutvecklare" på tidsbegränsat uppdrag). Nu har jag blivit ombedd att delta på: https://www.scc.org.uk/events/e-280 . Allt är betalat, ETA är fixad, biljetter och hotell bokat. Och ett mål finns: Min chef, Sandra Ruuda, har tillsammans med min kollega, Kristian Andersson, på VLSP uttryckt två saker: 1) Vi ska sätta Växjö på kartan i AI frågan. och 2) Vårt uppdrag här är att internationalisera oss. Det finns specifika intressen för två saker: Deltagare, Talare, Personligheter. Det vi ser i regionen är en stark efterfrågan på "lokal infrastruktur", säkerhet, data och privacy frågor samt en framåt anda bland entreprenörer att faktiskt jobba proaktivt med AI. Folk bygger, folk testar, folk implementerar, folk vågar. Och det skiljer oss åt. Jag vill därför ha en gedigen research med background audit, hitta details bland deltagare, bland gästare och representanter, fånga matchning mot vad vårt mål är här och se till att ge mig en konkret tre-stegs plan för kvällens event den 7e oktober.`;
const FACIT_A = ['Bergqvist', 'Allen', 'Wernvik', 'Ståhlberg'];
const FACIT_ALLA = ['Bergqvist', 'Allen', 'Wernvik', 'Ståhlberg', 'Davidson', 'Davies', 'Greaves', 'Roffe', 'Fridström', 'Granö', 'Evans', 'Cary', 'Saraceni', 'Warneryd', 'Dalemo'];
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
// Vilan på timer pausar inte modellen mitt i ett jobb längre (Fas 46), men
// provet ska inte vila alls: det tittar på förloppet.
await api('/api/installningar', { vilaEfter: 0 });
ok(await modellUppe(p, api), 'modellen uppe');
const s = await api('/api/sessioner', {});
// Underlaget anges med MAXIMUS_DJUP_UNDERLAG (en egen fil om ditt ämne).
// Utan den: ett kort, påhittat underlag, så att provet går att köra av alla.
const sakert = process.env.MAXIMUS_DJUP_UNDERLAG ? await readFile(process.env.MAXIMUS_DJUP_UNDERLAG)
  : Buffer.from('# Det vi får säga\n\nVi bygger en lokal AI-arbetsyta för kunskapsarbetare. Den körs på datorn och maskerar det som lämnar den.\n');
await p.evaluate(async ([id, text]) => fetch(`/api/sessioner/${id}/fil`, { method: 'POST', headers: { 'X-Maximus-Local': '1', 'X-Maximus-Namn': 'SAFE_TO_SAY.md' }, body: text }), [s.id, sakert.toString()]);
await p.reload({ waitUntil: 'networkidle' });
await p.keyboard.press('Enter').catch(() => {});
await p.waitForTimeout(1500);
await p.click(`.sess[data-sess="${s.id}"] .sess-oppna`).catch(() => {});
await p.waitForTimeout(1500);
await p.evaluate(() => { globalThis.DJUP_TAK = 10; });
await p.fill('#fraga', `/djupdykning ${PROMPT}`); await p.press('#fraga', 'Enter');
let kort = '';
for (let i = 0; i < 60 && !kort; i++) { await p.waitForTimeout(1000); kort = await p.evaluate(() => document.querySelector('.leverans-live')?.innerText || ''); }
ok(/Djupdykning/i.test(kort), `förloppet syns: ${kort.replace(/\n/g, ' ')}`);
const t0 = Date.now();
let tur = null, d = null;
for (let i = 0; i < 360 && !tur; i++) {
  await p.waitForTimeout(10000);
  const x = await api(`/api/sessioner/${s.id}`);
  d = x.djup; tur = x.turer?.find(t => t.djupdykning);
  if (i % 6 === 0) console.log(`  ${Math.round((Date.now() - t0) / 60000)} min · ${d?.fas} · ${d?.akter?.length || 0}/${d?.personer?.length || '?'} akter`);
}
ok(Boolean(tur), `briefen kom efter ${Math.round((Date.now() - t0) / 60000)} min`);
if (tur) {
  const hittade = FACIT_ALLA.filter(n => d.personer.some(x => x.namn.includes(n)));
  ok(hittade.length >= 6, `personer ur eventsidan: ${d.personer.length}, varav ur facit ${hittade.length}/${FACIT_ALLA.length} (${hittade.join(', ')})`);
  const a = d.urval.a.map(x => x.namn);
  const traff = FACIT_A.filter(n => a.some(x => x.includes(n)));
  console.log(`  A-listan: ${a.join(', ')} · facit ${FACIT_A.join(', ')} · träff ${traff.length}/4`);
  ok(traff.length >= 1, `A-listan träffar facit: ${traff.length}/4`);
  const medKalla = d.akter.filter(x => x.uttalanden?.some(u => u.url)).length;
  ok(medKalla >= d.akter.length / 3, `akter med minst ett uttalande med källa: ${medKalla}/${d.akter.length}`);
  ok(d.laget.length >= 3, `läget: ${d.laget.length} fakta med källa`);
  ok(/## 8\. Säg INTE/.test(tur.svar), 'faktakollen mot SAFE_TO_SAY gav "Säg INTE"');
  ok(/## 9\. Trestegsplanen/.test(tur.svar) && tur.artefakt?.sort === 'docx', 'trestegsplanen, och briefen som Word');
  console.log('\n----- BRIEFEN -----\n' + tur.svar.slice(0, 6000));
}
await slut();
