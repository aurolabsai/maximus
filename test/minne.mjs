/// Minnet som val, provat i webbläsaren mot den RIKTIGA modellen.
///
///   sh scripts/provserver.sh start
///   node test/minne.mjs <nyckel>
///
/// Startar modellen på provservern (under schemaläggaren) och ställer riktiga frågor.
/// Tar några minuter.
import { oppna, forbiStarten, skriv } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);

await forbiStarten(p, api);
await api('/api/installningar', { profil: { vem: 'Upphandlare på Ljungby kommun', arbetar: 'IT-avtal', vill: '' } });
await api('/api/modell', {});
for (let i = 0; i < 360 && !(await api('/api/uppstart')).grind; i++) await p.waitForTimeout(1000);
ok((await api('/api/uppstart')).grind, 'modellen är uppe');
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(800);

/// Väntar på en NY tur som blivit klar, i vilken session som helst.
///
/// Första versionen tog översta sessionen i listan och dess sista tur — och
/// fick förra samtalets färdiga svar innan det nya ens hunnit skapas.
const sett = new Set();
async function svar() {
  for (let i = 0; i < 300; i++) {
    for (const rad of await api('/api/sessioner')) {
      if (!rad.antal) continue;
      const s = await api(`/api/sessioner/${rad.id}`);
      const t = s?.turer?.at(-1);
      if (t && !sett.has(t.id) && t.status !== 'igang' && t.svar) { sett.add(t.id); return { s, t }; }
    }
    await p.waitForTimeout(1000);
  }
  return {};
}
const valjMinne = async namn => {
  await p.click('#lage-knapp');
  await p.locator('#meny-minne button', { hasText: namn }).click();
  await p.waitForTimeout(300);
};
const nytt = async () => { await p.keyboard.press('Meta+n'); await p.waitForTimeout(600); };

// 1. Profilen gäller alltid — också i ett isolerat samtal.
await skriv(p, 'Vad är det jag jobbar med? Svara med en mening.', 300);
let { s: a, t } = await svar();
console.log(`        · svar: ${t?.svar?.slice(0, 140).replace(/\n/g, ' ')}`);
ok(/upphandl/i.test(t?.svar || ''), 'profilen gäller i ett isolerat samtal');
await skriv(p, 'Anteckna: anbudet från Byggfirman Ekdal är på 4 711 000 kronor. Svara bara "Noterat".', 300);
await svar();

// 2. Isolerat: ett nytt samtal vet inget om det förra.
await nytt();
ok((await p.locator('#lage-minne').textContent()) === 'Isolerat' && await p.locator('#lage-minne').isVisible(), 'isolerat är förvalet, och det syns på knappen');
await skriv(p, 'Vilket belopp hade anbudet från Ekdal? Vet du inte, säg det.', 300);
({ t } = await svar());
ok(!(t?.kvitto || []).some(k => k.aktor === 'Minnet'), 'isolerat: inga tidigare samtal lästes');

// 3. Minns mig: det förra följer med, och det syns.
await nytt();
await valjMinne('Minns mig');
ok((await p.locator('#lage-minne').textContent()) === 'Minns', 'märket på knappen säger Minns');
await skriv(p, 'Vilket belopp hade anbudet från Ekdal?', 300);
let s;
({ s, t } = await svar());
const kv = (t?.kvitto || []).find(k => k.aktor === 'Minnet');
console.log(`        · kvitto: ${kv?.vad}`);
console.log(`        · svar: ${t?.svar?.slice(0, 160).replace(/\n/g, ' ')}`);
ok(Boolean(kv) && /läste/.test(kv.vad), 'minns: kvittot säger vilka samtal som lästes');
ok(/4[\s ]?711[\s ]?000|4,7 miljoner/.test(t?.svar || ''), 'minns: svaret har beloppet ur det tidigare samtalet');
ok(s?.minne === 'minns', 'valet sparat på samtalet');

// 4. Glöm efteråt: borta när man lämnar det.
await nytt();
await valjMinne('Glöm efteråt');
ok(/glöms när du lämnar/.test(await p.locator('#fotnot').textContent()), 'raden under skrivfältet säger att samtalet glöms');
await skriv(p, 'Säg bara hej.', 300);
const { s: g } = await svar();
ok(g?.minne === 'glom', 'samtalet är markerat att glömmas');
await nytt();
await p.waitForTimeout(800);
ok(!(await api('/api/sessioner')).some(x => x.id === g.id), 'lämnat: samtalet är borta');
await slut();
