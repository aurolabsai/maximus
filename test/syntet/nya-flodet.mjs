/// Det nya flödet, tre användare, allt mätt (PLAN-MAXIMUS Fas 18).
///
///   node test/syntet/nya-flodet.mjs [profil…]
///
/// Startar en egen provserver per profil (port 3299, data under /tmp — aldrig
/// användarens eget Maximus), och går igenom:
///
///   1. starten        villkoren, modellerna            (webbläsaren)
///   2. första sessionen  "Vad jobbar du med?"          (webbläsaren)
///   3. tillstånden    nej e-post · ja kalender · nej anteckningar
///   4. modellen upp   under schemaläggaren, om den finns   (tid till svar)
///   5. ett uppdrag    /uppdrag med profilens egna ord  (webbläsaren)
///   6. en fråga       profilen ska märkas i svaret     (riktig modell)
///   7. agentarbetet   Agent.slag() på profilens sex poster med facit,
///                     och fyndsamtalets sammanfattning (riktig modell)
///
/// Agentarbetet läser profilens poster i stället för en inkorg. Att läsa en
/// riktig inkorg vore att läsa någons riktiga post; poster med facit är det
/// som låter provet säga HUR fel det gick. Allt annat är samma kod som
/// hjärtslaget kör: triagePrompt, lasTriage, Fyndsamtal.prompt.
///
/// Resultatet skrivs till test/syntet/nya-flodet-<datum>.json, och Fas 19:s
/// rapport läses ur den filen — inte ur minnet.

import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import * as Agent from '../../lib/agent.mjs';
import * as Uppdrag from '../../lib/uppdrag.mjs';
import * as Fyndsamtal from '../../lib/fyndsamtal.mjs';
import { svaraLokalt } from '../../lib/lokal.mjs';
import { PROFILER, poster } from '../profiler.mjs';

const ROT = new URL('../../', import.meta.url).pathname;
const BAS = 'http://127.0.0.1:3299';
const MODELL = 'unix:/tmp/maximus-prov/modell.sock';
const valda = process.argv.slice(2).filter(x => PROFILER[x]);
const koran = valda.length ? valda : Object.keys(PROFILER);

// stderr kopplas bort: provservern startar en fristående process som ärver
// röret, och execFileSync väntar då tills den dör — det gör den aldrig.
const provserver = vad => execFileSync('sh', [`${ROT}scripts/provserver.sh`, vad], { cwd: ROT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const tid = async f => { const t0 = Date.now(); const v = await f(); return [v, Date.now() - t0]; };

const resultat = [];

for (const nyckel of koran) {
  const pr = PROFILER[nyckel];
  const r = { profil: nyckel, namn: pr.namn, steg: {}, fel: [] };
  resultat.push(r);
  console.log(`\n${'═'.repeat(70)}\n${pr.namn}\n${'═'.repeat(70)}`);
  const nyck = /NYCKEL=(\w+)/.exec(provserver('start'))?.[1];
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const sidfel = []; p.on('pageerror', e => sidfel.push(String(e).slice(0, 160)));
  const api = (v, k) => p.evaluate(async ([v, k]) => {
    const x = await fetch(v, k ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' }, body: JSON.stringify(k) } : {});
    return x.json().catch(() => ({ status: x.status }));
  }, [v, k]);
  async function vantaManus() {
  // Repliker strömmar sedan 2026-10-04: vänta tills Maximus skrivit klart.
  await p.waitForTimeout(150);
  await p.waitForFunction(() => !document.querySelector('.manus-tanker, .svar[data-strommar]'), null, { timeout: 30000 }).catch(() => {});
}
const repliker = async () => { await vantaManus(); return p.locator('.tur.forsta:not(.fran-dig) .svar').allTextContents(); };
  const sist = async () => (await repliker()).at(-1) || '';
  const knapp = async t => { await p.locator('.forsta-val button', { hasText: t }).last().click(); await p.waitForTimeout(500); };
  const skriv = async t => { await p.fill('#fraga', t); await p.keyboard.press('Enter'); await p.waitForTimeout(500); };
  const notera = (steg, ms, ok, om = '') => {
    r.steg[steg] = { ms, ok, om };
    console.log(`  ${ok ? 'GRÖNT' : 'RÖTT '} ${steg.padEnd(16)} ${String(ms).padStart(7)} ms  ${om}`);
    if (!ok) r.fel.push(steg);
  };

  try {
    // 1. Starten.
    let ms;
    [, ms] = await tid(async () => {
      await p.goto(`${BAS}/?n=${nyck}`, { waitUntil: 'networkidle' });
      await p.waitForSelector('#borja-villkor', { timeout: 15000 });
    });
    notera('öppnar', ms, true, 'villkoren står där');
    [, ms] = await tid(async () => {
      await p.locator('#borja-villkor').check();
      await p.click('#borja-fortsatt');
      await p.waitForSelector('#borja-modeller', { timeout: 15000 });
    });
    const forslag = (await p.locator('.borja-modell b').allTextContents()).join(' + ');
    notera('villkor→modeller', ms, Boolean(forslag), forslag);
    [, ms] = await tid(async () => {
      await p.click('#borja-modeller');
      await p.waitForSelector('#borja', { state: 'hidden', timeout: 30 * 60_000 });
    });
    notera('modellerna', ms, true, 'fanns på disk — snabbvägen');

    // 2. Första sessionen.
    await p.waitForSelector('.tur.forsta', { timeout: 10000 });
    const hej = /Vad jobbar du med\?/.test(await sist());
    [, ms] = await tid(async () => {
      await skriv(pr.profil.vem);
      for (let i = 0; i < 20 && !/^E-post — /.test(await sist()); i++) await p.waitForTimeout(250);
    });
    const vem = (await api('/api/profil')).profil?.vem;
    notera('första session', ms, hej && vem === pr.profil.vem, `profilen: ${vem}`);

    // 3. Tillstånden, ett i taget.
    [, ms] = await tid(async () => {
      await knapp('Nej');                                   // e-post
      await knapp('Ja');                                    // kalender — läses på riktigt
      for (let i = 0; i < 120 && !/^Anteckningar — /.test(await sist()); i++) await p.waitForTimeout(250);
      await knapp('Nej');                                   // anteckningar
      for (let i = 0; i < 20 && !/^Det var allt/.test(await sist()); i++) await p.waitForTimeout(250);
    });
    const besl = (await api('/api/tillstand')).beslut.map(x => `${x.id}:${x.svar}`).join(' ');
    notera('tillstånd', ms, besl === 'epost:nej kalender:ja anteckningar:nej', besl);

    // 4. Modellen upp.
    [, ms] = await tid(async () => {
      await api('/api/modell', {});
      for (let i = 0; i < 360 && !(await api('/api/uppstart')).grind; i++) await p.waitForTimeout(1000);
    });
    const uppe = (await api('/api/uppstart')).grind;
    notera('modellen upp', ms, uppe, uppe ? (await api('/api/uppstart')).modell?.namn : 'kom inte upp');

    // 5. Ett uppdrag, i profilens egna ord.
    await p.keyboard.press('Meta+n'); await p.waitForTimeout(500);
    [, ms] = await tid(async () => {
      await skriv(`/uppdrag ${pr.uppdrag}`);
      if (/^Var ska jag titta/.test(await sist())) await knapp('Överallt jag får');
      if (/^Ska jag hålla koll/.test(await sist())) await knapp('Hela tiden');
      for (let i = 0; i < 20 && !/^Uppdraget står/.test(await sist()); i++) await p.waitForTimeout(250);
    });
    const u = (await api('/api/uppdrag')).uppdrag?.[0];
    notera('uppdrag', ms, Boolean(u), u ? `${u.titel} · ${u.kallor.join(', ')} · ${u.aterkommande ? 'löpande' : 'en gång'}` : 'inget');

    // 6. En fråga. Profilen ska märkas utan att den sägs.
    await p.keyboard.press('Meta+n'); await p.waitForTimeout(500);
    const fore = new Set((await api('/api/sessioner')).map(s => s.id));
    let svar = '', forsta = null;
    [, ms] = await tid(async () => {
      const t0 = Date.now();
      await skriv('Vad borde jag ta tag i först den här veckan? Svara med två meningar.');
      for (let i = 0; i < 600; i++) {
        if (forsta === null && (await p.locator('.tur .svar').last().textContent().catch(() => '')).trim().length > 5) forsta = Date.now() - t0;
        const ny = (await api('/api/sessioner')).find(s => !fore.has(s.id) && s.antal);
        const t = ny && (await api(`/api/sessioner/${ny.id}`)).turer?.at(-1);
        if (t && t.status !== 'igang' && t.svar) { svar = t.svar; break; }
        await p.waitForTimeout(500);
      }
    });
    const ord = [...new Set(`${pr.profil.vem} ${pr.profil.arbetar}`.toLowerCase().match(/[a-zåäö]{5,}/g))];
    const traff = ord.filter(o => svar.toLowerCase().includes(o.slice(0, 6)));
    notera('fråga', ms, Boolean(svar), `första tecknet ${forsta ?? '?'} ms · profilord i svaret: ${traff.slice(0, 4).join(', ') || 'inga'}`);
    r.svar = svar;
    r.forstaTecken = forsta;
    r.profilord = traff;

    // 7. Agentarbetet: samma kod som hjärtslaget, profilens poster som källa.
    const post = poster(nyckel);
    const uppd = Uppdrag.nyttUppdrag({ instruktion: pr.uppdrag, kallor: ['epost'], aterkommande: true });
    const profil = { ...pr.profil, vill: pr.projekt.mal };
    let slag;
    [slag, ms] = await tid(() => Agent.slag(uppd, {
      las: async () => post.map((x, i) => ({ id: x.id, titel: x.titel, fran: x.fran, text: x.text,
        tid: new Date(Date.now() - i * 3600_000).toISOString() })),
      tanka: prompt => svaraLokalt(prompt, { url: MODELL, plats: 'agent', tak: 900, timeout: 180000 }),
      profil,
    }));
    const behallna = new Set((slag.fynd || []).filter(f => !f.obedomd).map(f => f.kallid));
    const missar = post.filter(x => x.behall && !behallna.has(x.id)).map(x => x.titel);
    const brus = post.filter(x => !x.behall && behallna.has(x.id)).map(x => x.titel);
    notera('agentens triage', ms, !slag.fel && missar.length === 0,
      `missar ${missar.length}/${post.filter(x => x.behall).length} · brus ${brus.length}/${post.filter(x => !x.behall).length}${slag.fel ? ` · fel: ${slag.fel}` : ''}`);
    r.triage = { missar, brus, fynd: (slag.fynd || []).map(f => ({ titel: f.titel, vikt: f.vikt, varfor: f.varfor })),
      undanlagt: (slag.undanlagt || []).map(f => ({ titel: f.titel, varfor: f.varfor })) };

    let sammanf = '';
    const behallnaFynd = (slag.fynd || []).filter(f => !f.obedomd);
    [sammanf, ms] = await tid(() => behallnaFynd.length
      ? svaraLokalt(Fyndsamtal.prompt(uppd, behallnaFynd, { profil: `Användaren är: ${pr.profil.vem}` }),
        { url: MODELL, plats: 'agent', tak: 500, timeout: 180000 })
      : Promise.resolve(''));
    const meningar = (String(sammanf).match(/[.!?](\s|$)/g) || []).length;
    notera('fyndsamtalet', ms, Boolean(sammanf) && meningar <= 5, `${meningar} meningar`);
    r.sammanfattning = sammanf;
    r.sidfel = sidfel;
    if (sidfel.length) { r.fel.push('sidfel'); console.log(`  RÖTT  sidfel: ${sidfel.join(' | ')}`); }
  } catch (e) {
    r.fel.push(`avbrott: ${e.message.split('\n')[0]}`);
    console.log(`  AVBROTT ${e.message.split('\n')[0]}`);
  } finally {
    await b.close();
    provserver('stop');
  }
}

// Lokalt datum: toISOString är UTC, och en körning efter midnatt fick gårdagens namn.
const datum = new Date().toLocaleDateString('sv-SE');
const fil = new URL(`nya-flodet-${datum}.json`, import.meta.url);
await writeFile(fil, JSON.stringify({ datum: new Date().toISOString(), resultat }, null, 2));

console.log(`\n${'═'.repeat(70)}\nSAMMANSTÄLLNING\n${'═'.repeat(70)}`);
for (const r of resultat) {
  const s = r.steg;
  console.log(`  ${r.namn.padEnd(26)} ${r.fel.length ? `RÖTT: ${r.fel.join(', ')}` : 'allt grönt'}`);
  console.log(`  ${''.padEnd(26)} fråga ${s['fråga']?.ms ?? '?'} ms · triage ${s['agentens triage']?.ms ?? '?'} ms · ${s['agentens triage']?.om ?? ''}`);
}
console.log(`\n  ${fil.pathname}`);
process.exit(resultat.some(r => r.fel.length) ? 1 : 0);
