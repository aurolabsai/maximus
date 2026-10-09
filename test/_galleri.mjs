import { chromium } from 'playwright';
const N = process.argv[2], UT = process.argv[3];
const BAS = `http://127.0.0.1:${process.env.MAXIMUS_PROVPORT || 3299}`;
const b = await chromium.launch();
async function sida(bredd, tema) {
  const ctx = await b.newContext({ viewport: { width: bredd, height: Math.round(bredd * 0.64) }, colorScheme: tema, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('maximus.sidofast', '1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto(`${BAS}/?n=${N}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  return { p, ctx };
}
const api = (p, v, k) => p.evaluate(async ([v, k]) => { const r = await fetch(v, k ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' }, body: JSON.stringify(k) } : {}); return r.json().catch(() => ({})); }, [v, k]);
// Data att visa: ett samtal, ett uppdrag, Grunden.
{
  const { p, ctx } = await sida(1400, 'light');
  await api(p, '/api/uppdatering', { satt: false });
  const v = await api(p, '/api/villkor'); await api(p, '/api/villkor', { godkann: true, version: v.version });
  const f = await api(p, '/api/start'); await api(p, '/api/start/hamta', { tanker: f.tanker.id, hor: f.hor.id });
  for (let i = 0; i < 120; i++) { if ((await api(p, '/api/uppstart')).installningar?.modellval) break; await p.waitForTimeout(500); }
  await api(p, '/api/installningar', { vilaVidStart: false, forsta: { steg: 'tack', klar: true }, profil: { vem: 'Affärsutvecklare inom AI', intressen: 'lokal AI, AI-infrastruktur' } });
  await api(p, '/api/sessioner/manus', { titel: 'Upphandling av AI-plattform', rader: [
    { av: 'du', text: 'Vilka krav bör vi ställa på en lokal AI-plattform i en kommun?' },
    { av: 'maximus', text: '**Tre krav går före allt annat.**\n\n1. **Data stannar i Sverige** — helst på egen hårdvara.\n2. **Spårbarhet** — varje svar ska gå att följa till sin källa.\n3. **Maskering** — personuppgifter ska aldrig lämna organisationen i klartext.\n\nVill du att jag gör en kravlista som Word-dokument?' }] });
  await api(p, '/api/uppdrag', { instruktion: 'Håll koll på offerter i min kalender', kallor: ['kalender'], aterkommande: true });
  await ctx.close();
}
const vyer = [
  ['hem', async p => {}],
  ['samtal', async p => { await p.evaluate(() => document.querySelector('.sess[data-sess] .sess-oppna')?.click()); }],
  ['uppdrag', async p => { await p.evaluate(() => document.querySelector('#list-uppdrag')?.click()); }],
  ['installningar', async p => { await p.evaluate(() => document.querySelector('#oppna-installningar')?.click()); }],
  ['installningar-agenten', async p => { await p.evaluate(() => { document.querySelector('#oppna-installningar')?.click(); setTimeout(() => document.querySelector('#inst-flikar [data-flik="agent"]')?.click(), 200); }); }],
];
for (const bredd of [1400, 900]) for (const tema of ['light', 'dark']) {
  const { p, ctx } = await sida(bredd, tema);
  for (const [namn, gor] of vyer) {
    await p.evaluate(() => document.querySelector('#list-hem')?.click()); await p.waitForTimeout(400);
    await gor(p); await p.waitForTimeout(900);
    await p.screenshot({ path: `${UT}/${namn}-${bredd}-${tema}.png` });
  }
  await ctx.close();
}
await b.close(); process.exit(0);
