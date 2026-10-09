/// Fas 23: en presentation att lämna ifrån sig. /presentation → mål,
/// mottagare, längd → disposition → godkänn → avsnitt för avsnitt (med
/// förlopp) → granskning → en PowerPoint med talarmanus i samtalet.
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
// Webben av: avsnitten byggs på modellen och samtalet. Gäller på servern —
// ingen omladdning (den kan söva modellen bakom startskärmen).
await api('/api/installningar', { webb: 'av' });
await p.fill('#fraga', '/presentation'); await p.press('#fraga', 'Enter');
const svara = async t => { await p.waitForSelector('#fragaruta[open]', { timeout: 15000 }); await p.fill('#fragaruta-svar', t); await p.click('#fragaruta-ok'); await p.waitForTimeout(400); };
await svara('Få ledningsgruppen att välja en gratisversion av appen som första steg');
await svara('Ledningsgruppen');
await p.click('#mitt button:has-text("Kort — 5 bilder")');
const t0 = Date.now();
const kom = await p.waitForSelector('#mitt button:has-text("Skriv presentationen")', { timeout: 420000 }).catch(() => null);
if (!kom) {
  console.log('  i samtalet:', (await p.evaluate(() => document.querySelector('#mitt').innerText)).slice(-500).replace(/\n+/g, ' | '));
  console.log('  vilar:', await p.evaluate(() => Boolean(document.querySelector('.vila:not([hidden]), #vila:not([hidden])'))));
  ok(false, 'dispositionen kom'); await slut();
}
// Listan ritas som en riktig lista: punkterna räknas, inte siffror i texten.
const n = await p.evaluate(() => [...document.querySelectorAll('#mitt .tur.forsta')].at(-1)?.querySelectorAll('ol > li').length || 0);
ok(n === 5, `en disposition i fem avsnitt, på ${Math.round((Date.now() - t0) / 1000)} s`);
const sid = await p.evaluate(() => document.querySelector('.sess.vald')?.dataset.sess);
await p.click('#mitt button:has-text("Skriv presentationen")');
let sag = '';
for (let i = 0; i < 60 && !sag; i++) { await p.waitForTimeout(1000); sag = await p.evaluate(() => document.querySelector('.leverans-live')?.innerText || ''); }
ok(/Avsnitt \d av 5/.test(sag), `förloppet syns: ${sag.replace(/\n/g, ' ')}`);
let tur = null;
const t1 = Date.now();
for (let i = 0; i < 1200 && !tur; i++) { await p.waitForTimeout(1000); tur = (await api(`/api/sessioner/${sid}`)).turer?.find(t => t.artefakt?.sort === 'pptx'); }
ok(Boolean(tur), `en PowerPoint i samtalet, skriven på ${Math.round((Date.now() - t1) / 1000)} s: ${tur?.artefakt?.om}`);
console.log('  sager:', (tur?.sager || '').slice(0, 300).replace(/\n/g, ' '));
if (tur) {
  const fil = await p.evaluate(async u => { const r = await fetch(u); const b = new Uint8Array(await r.arrayBuffer()); return { pk: String.fromCharCode(b[0], b[1]), noter: new TextDecoder('latin1').decode(b).includes('ppt/notesSlides/'), n: b.length }; },
    `/api/sessioner/${sid}/artefakter/${tur.artefakt.id}`);
  ok(fil.pk === 'PK' && fil.noter, `filen är en riktig PowerPoint med talarmanus (${fil.n} byte)`);
  ok(/Granskningen/.test(tur.sager), 'granskningen står i raden');
  const lev = (await api(`/api/sessioner/${sid}`)).leverans;
  const tomma = (lev?.avsnitt || []).filter(x => !(x.punkter || []).join(' ').trim() || /aktivera|inställningar/i.test(x.ra || ''));
  ok(lev?.avsnitt?.length === 5 && !tomma.length, `fem riktiga avsnitt, ingen begäran om inställningar: ${(lev?.avsnitt || []).map(x => x.punkter?.[0]?.slice(0, 40)).join(' | ')}`);
}
await slut();
