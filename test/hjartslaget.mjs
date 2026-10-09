/// Hjärtslaget skapar sessioner (Fas 12), provat mot den RIKTIGA modellen.
///
///   sh scripts/provserver.sh start
///   node test/hjartslaget.mjs <nyckel>
///
/// Ett uppdrag på en riktig, publik sida; ett riktigt slag; riktig triage;
/// riktig sammanfattning. Hämtningen går ut från provservern och bokförs i
/// dess egen liggare under /tmp.
import { oppna, forbiStarten, modellUppe, vantaManus } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen är uppe');
await api('/api/installningar', { agent: { bevakning: true, takt: 0 } });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(800);
// Ett kort, inte en rubrik (Auro 2026-10-05) — men aldrig tomt.
ok(await p.locator('#mitt .tom.ett > *').count() > 0, 'arbetsytan har sitt kort vid start (den stod tom)');
ok(await p.locator('#sido nav:not([hidden])').count() === 1 && await p.locator('#sessioner').isVisible(), 'panelen visar sessionerna, inget annat');

// Uppdraget sätts upp i chatten, inte i ett rum.
const sist = async () => { await p.waitForTimeout(150); await p.waitForFunction(() => !document.querySelector('.manus-tanker, .svar[data-strommar]'), null, { timeout: 30000 }).catch(() => {}); return (await p.locator('.tur.forsta:not(.fran-dig) .svar').allTextContents()).at(-1) || ''; };
const knapp = async t => { await p.locator('.forsta-val button', { hasText: t }).last().click(); await p.waitForTimeout(400); await vantaManus(p); };
await p.fill('#fraga', '/uppdrag https://www.upphandlingsmyndigheten.se/ allt på startsidan angår mig');
await p.keyboard.press('Enter');
await p.waitForTimeout(700);
ok(/^Får jag hämta sidor du pekar ut\?/.test(await sist()), 'en adress: frågar om lov att hämta sidor');
await knapp('Ja');
for (let i = 0; i < 40 && /^Hämtar /.test(await sist()); i++) await p.waitForTimeout(500);
const alla = await p.locator('.tur.forsta:not(.fran-dig) .svar').allTextContents();
const hamtade = alla.findIndex(x => /^Hämtar https:/.test(x));
ok(hamtade >= 0 && /upphandling/i.test(alla[hamtade + 1] || ''), `sidan provades en gång innan uppdraget skapades (${(alla[hamtade + 1] || '').slice(0, 60)})`);
if (/^Ska jag hålla koll/.test(await sist())) await knapp('Hela tiden');
for (let i = 0; i < 20 && !/^Uppdraget står/.test(await sist()); i++) await p.waitForTimeout(500);
ok(/^Uppdraget står: /.test(await sist()), 'uppdraget står');
const u = (await api('/api/uppdrag')).uppdrag[0];
ok(u?.kallor?.[0]?.startsWith('sida'), 'källan är sidan');
// Titeln skrivs ur instruktionen; provet nedan väntar sig namnet ur den.
await api(`/api/uppdrag/${u.id}/andra`, { titel: 'Upphandlingsmyndigheten' });

const fore = (await api('/api/sessioner')).length;
const t0 = Date.now();
const r = await api('/api/agent/sla', {});
console.log(`        · slaget: ${JSON.stringify(r).slice(0, 200)} (${Math.round((Date.now() - t0) / 1000)} s)`);
const agent = await api('/api/agent');
console.log(`        · fynd ${agent.fynd?.length || 0} · undanlagt ${agent.undanlagda ?? agent.undanlagt?.length ?? '?'}`);
const lista = await api('/api/sessioner');
// Ett samtal för allt agenten gör (Fas 33): fyndet skrivs i Agenten.
const s = lista.find(x => x.agentsamtal) || lista.find(x => x.avAgenten);
if (!agent.fynd?.length) {
  ok(lista.length === fore, 'inget behållet fynd: inget samtal öppnades');
  console.log('        · triagen behöll ingenting den här gången — provet kan inte se ett samtal öppnas');
  await slut();
}
ok(Boolean(s), `ett fynd blev ett samtal i listan (${s?.titel})`);
// Uppdraget, och vad genomgången hittade (2026-10-04) — inte "— 1 nytt".
// Uppdraget står på turen, i dess kort — samtalet heter Agenten.
const kortet = s ? (await api(`/api/sessioner/${s.id}`)).turer?.at(-1)?.uppdragskort : null;
ok(/^Upphandlingsmyndigheten/.test(kortet?.titel || '') && kortet?.fynd > 0, `turen säger uppdraget och vad det hittade (${kortet?.titel}, ${kortet?.fynd})`);
ok(await p.locator('.fyndnotis').count() === 1, 'en rad där du redan är: "Agenten öppnade ett samtal"');
await p.screenshot({ path: '/tmp/maximus-fyndnotis.png' });
const krock = await p.evaluate(() => {
  const a = document.querySelector('.fyndnotis').getBoundingClientRect();
  const b = document.querySelector('#komp').getBoundingClientRect();
  return !(a.bottom < b.top || a.top > b.bottom || a.right < b.left || a.left > b.right);
});
ok(!krock, 'raden ligger inte över skrivfältet');
await p.locator('.fyndnotis-oppna').click();
await p.waitForTimeout(1200);
const hel = await api(`/api/sessioner/${s.id}`);
const tur = hel.turer.at(-1);
console.log(`        · svar: ${tur.svar.slice(0, 260).replace(/\n/g, ' ')}`);
ok(tur.status === 'klar' && /^Agenten hittade/.test(tur.fraga), 'turen: agenten talar, och den är klar');
ok(tur.svar.split('\n\n').length >= 2 && /- \*\*/.test(tur.svar), 'sammanfattning först, listan över fynden under');
ok(await p.locator('.tur .svar').first().isVisible(), 'samtalet öppnades i arbetsytan');
ok(agent.fynd.every(f => f.samtal === s.id), 'fynden står kvar i inkorgen, med en väg till samtalet');
ok(await p.locator('.fyndnotis').count() === 0, 'raden gick bort när samtalet öppnades');
await p.fill('#fraga', 'Vilken av punkterna är viktigast för en kommun? En mening.');
await p.keyboard.press('Enter');
for (let i = 0; i < 180; i++) {
  const x = await api(`/api/sessioner/${s.id}`);
  if (x.turer.length === 2 && x.turer[1].status === 'klar') { console.log(`        · följdfråga: ${x.turer[1].svar.slice(0, 160).replace(/\n/g, ' ')}`); break; }
  await p.waitForTimeout(1000);
}
ok((await api(`/api/sessioner/${s.id}`)).turer.length === 2, 'du fortsätter i samma ruta');

// /fynd: inkorgen, det undanlagda och senaste varvet.
await p.keyboard.press('Meta+n'); await p.waitForTimeout(600);
await p.fill('#fraga', '/fynd'); await p.keyboard.press('Enter'); await p.waitForTimeout(1000);
const fy = await sist();
ok(/^1 fynd/.test(fy) && /Senaste varvet/.test(fy) && /Upphandlingsmyndigheten/.test(fy), `/fynd: fynden och senaste varvet (${fy.slice(0, 50)})`);
await knapp('Klart');

// /uppdrag: pausa, och läget säger det; ta bort frågar först.
await p.fill('#fraga', '/uppdrag'); await p.keyboard.press('Enter'); await p.waitForTimeout(400); await vantaManus(p);
await knapp('Ändra 1');
await knapp('Pausa');
ok(/^Pausat: /.test(await sist()), 'pausa i chatten');
await p.fill('#fraga', '/uppdrag'); await p.keyboard.press('Enter'); await p.waitForTimeout(400); await vantaManus(p);
ok(/Pausat/.test(await p.locator('.tur.forsta .svar table').last().textContent()), 'listan säger att det är pausat');
await knapp('Ändra 1');
await knapp('Ta bort');
ok(await p.locator('#fragaruta[open]').count() === 1, 'ta bort frågar först');
await p.click('#fragaruta-ok'); await p.waitForTimeout(800);
ok((await api('/api/uppdrag')).uppdrag.length === 0, 'och sedan är det borta');
await slut();
