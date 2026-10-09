/// Fas 50 på riktigt: nyheter ur profilens intressen, med riktiga källor
/// och riktig modell. Går ut på webben (maskerade ämnesord) — det är
/// funktionen. Mot en NY provserver.
///
///   node test/nyheterna.mjs <nyckel>
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2], { bredd: 1400, hojd: 950 });
await forbiStarten(p, api);
await api('/api/installningar', { profil: { vem: 'Affärsutvecklare inom AI i Kronoberg', intressen: 'lokal AI, AI-infrastruktur' } });
ok(await modellUppe(p, api), 'modellen uppe');
const r = await api('/api/nyheter/pa', { pa: true });
ok(r.pa && r.amnen?.length === 2, `på, med ämnena ur profilen: ${r.amnen?.join(', ')}`);
const t0 = Date.now();
let hem = null;
for (let i = 0; i < 90; i++) {
  await p.waitForTimeout(10000);
  hem = await api('/api/hem');
  if (hem.nyheter?.poster?.length) break;
  if (i % 3 === 0) console.log(`  ${Math.round((Date.now() - t0) / 60000)} min · ${hem.nyheter?.senast ? 'varvet klart' : 'läser'}`);
}
const poster = hem?.nyheter?.poster || [];
ok(poster.length > 0, `nyheter efter ${Math.round((Date.now() - t0) / 60000)} min: ${poster.length}`);
for (const x of poster.slice(0, 4)) console.log(`   · [${x.vikt}] ${x.titel.slice(0, 90)} — ${x.fran}${x.varfor ? ` (${x.varfor.slice(0, 80)})` : ''}`);
ok(poster.every(x => /^https?:\/\//.test(x.url)), 'varje nyhet har en adress');
let bilder = 0;
for (const x of poster.slice(0, 4)) { const b = await p.evaluate(async id => (await fetch(`/api/nyheter/bild/${id}`)).status, x.id); if (b === 200) bilder++; }
ok(bilder > 0, `OG-bilder: ${bilder} av ${Math.min(4, poster.length)}`);
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
ok(await p.locator('.nyhetskort .nyhet').count() > 0, 'nyheterna står på hem');
await p.screenshot({ path: '/tmp/maximus-nyheterna.png' });
// Nyheten som underlag: publik text, aldrig maskerad (Auro 2026-10-06).
const ny = await api('/api/sessioner', {});
const fil = await api(`/api/nyheter/${poster[0].id}/bifoga`, { session: ny.id });
ok(fil.omaskerad === true && fil.dolda === 0 && fil.publik?.url === poster[0].url, `nyheten bifogas omaskerad, med sin adress: ${fil.namn}`);
const hel = await api(`/api/sessioner/${ny.id}`);
ok(!/\[(NAMN|ORT|ORGANISATION) [A-Z]+\]/.test(JSON.stringify(hel.filer?.[0] || {})), 'inga platshållare i den publika texten');
const lig = JSON.stringify(await api('/api/liggare'));
ok(/Webb|sök/i.test(lig), 'hämtningarna står i liggaren');
await slut();
