/// Gemensamt för webbläsarproven mot provservern (3299).
///
/// Utgångsläget sätts i provet, aldrig förutsätts: `forbiStarten`
/// godkänner villkoren och väljer modellerna genom samma vägar som starten
/// använder, och markerar första sessionen som gjord om man ber om det.
/// Ingen modell laddas — /api/start/hamta väljer bara de filer som redan
/// finns på disk.
import { chromium } from 'playwright';

export const BAS = `http://127.0.0.1:${process.env.MAXIMUS_PROVPORT || 3299}`;

/// Fäster panelen (Fas 48) i en egen webbläsarkontext: proven klickar i
/// listan, och en fri panel är gömd tills musen är på listen.
export async function fastPanel(ctx) {
  await ctx.addInitScript(() => { try { localStorage.setItem('maximus.sidofast', '1'); } catch { /* ingen lagring */ } });
  return ctx;
}

export async function oppna(nyckel, { bredd = 1280, hojd = 900, mikrofon = null, fast = true } = {}) {
  // `mikrofon`: en wav-fil som låtsas vara mikrofonen (Fas 42, diktering).
  const b = await chromium.launch(mikrofon ? { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${mikrofon}%noloop`] } : {});
  const ctx = await b.newContext({ viewport: { width: bredd, height: hojd } });
  // Panelen fäst (Fas 48): proven klickar i listan, och en fri panel är
  // gömd tills musen är på listen.
  if (fast) await ctx.addInitScript(() => { try { localStorage.setItem('maximus.sidofast', '1'); } catch { /* ingen lagring */ } });
  const p = await ctx.newPage();
  const fel = []; p.on('pageerror', e => fel.push(process.env.STACK ? String(e.stack).split('\n').slice(0, 6).join(' | ') : String(e).slice(0, 160)));
  await p.goto(`${BAS}/?n=${nyckel}`, { waitUntil: 'networkidle' });
  let rott = 0;
  const ok = (v, t) => { console.log(`${v ? 'GRÖNT' : 'RÖTT '} · ${t}`); if (!v) rott++; };
  const api = (vag, kropp) => p.evaluate(async ([v, k]) => {
    const r = await fetch(v, k ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' }, body: JSON.stringify(k) } : {});
    return r.json().catch(() => ({ status: r.status }));
  }, [vag, kropp]);
  const slut = async () => {
    console.log('sidfel:', fel.length ? fel.join(' | ') : 'inga');
    await b.close();
    process.exit(rott || fel.length ? 1 : 0);
  };
  return { b, p, ok, api, fel, slut };
}

export async function forbiStarten(p, api, { forsta = true } = {}) {
  // Frågan om nya versioner kommer fyra sekunder efter starten och lägger
  // en ruta över allt. Proven har tagit ställning: nej, ingenting går ut.
  await api('/api/uppdatering', { satt: false });
  const v = await api('/api/villkor');
  await api('/api/villkor', { godkann: true, version: v.version });
  const f = await api('/api/start');
  await api('/api/start/hamta', { tanker: f.tanker.id, hor: f.hor.id });
  for (let i = 0; i < 120; i++) {
    if ((await api('/api/uppstart')).installningar?.modellval) break;
    await p.waitForTimeout(500);
  }
  // Uppstartsvilan står annars i vägen för varje prov. test/vilan.mjs slår på den.
  await api('/api/installningar', { vilaVidStart: false });
  if (forsta) await api('/api/installningar', { forsta: { steg: 'tack', klar: true }, profil: { vem: 'Provare' } });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
}

export async function skriv(p, text, vanta = 700) {
  await p.fill('#fraga', text);
  await p.keyboard.press('Escape');   // kommandomenyn, om den fälldes ut
  await p.keyboard.press('Enter');
  await p.waitForTimeout(vanta);
  await vantaManus(p);
}

export async function vantaManus(p) {
  // Repliker strömmar sedan 2026-10-04: vänta tills Maximus skrivit klart.
  await p.waitForTimeout(150);
  await p.waitForFunction(() => !document.querySelector('.manus-tanker, .svar[data-strommar]'), null, { timeout: 30000 }).catch(() => {});
}

export const repliker = async p => { await vantaManus(p); return p.locator('.tur.forsta:not(.fran-dig) .svar').allTextContents(); };

/// Väntar på en NY tur som blivit klar, i vilken session som helst.
///
/// Att ta översta sessionen i listan gav förra samtalets färdiga svar innan
/// det nya ens skapats — sett i Fas 10. Turer som redan setts räknas inte.
export function svarare(p, api) {
  const sett = new Set();
  return async function svar() {
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
  };
}

/// Startar modellen på provservern och väntar tills den svarar.
export async function modellUppe(p, api) {
  // Svarar den redan: ingen start. Startvägen värmer platserna före svaret,
  // och det tar minuter på en upptagen dator — för en modell som redan är uppe.
  for (let i = 0; i < 120 && !(await api('/api/uppstart')).grind; i++) await p.waitForTimeout(1000);
  if ((await api('/api/uppstart')).grind) return true;
  await api('/api/modell', {});
  for (let i = 0; i < 360 && !(await api('/api/uppstart')).grind; i++) await p.waitForTimeout(1000);
  return Boolean((await api('/api/uppstart')).grind);
}
