import { fastPanel } from './hjalpare.mjs';
/// Första sessionen, provad i webbläsaren mot en NY provserver.
///
///   sh scripts/provserver.sh start
///   node test/forsta.mjs <nyckel>
///
/// Går igenom starten (villkor, modeller som redan finns på disk) och sedan
/// samtalet där Maximus skriver först. Sedan 2026-10-10 går varje steg att
/// hoppa över, "Hoppa över resten" avslutar guiden, profilen kan skrivas med
/// egna ord, och saknar agenten något säger tack-steget, Hem-kortet och
/// agentens platser det. Fönstret är 1100×680, det minsta som ska fungera.
///
/// Modellen låtsas här, där det behövs: /api/uppstart får säga att den svarar
/// eller inte, och analysen av din text får ett färdigt förslag. Resten är
/// den riktiga servern.
import { chromium } from 'playwright';
const N = process.argv[2];
if (!N) { console.error('nyckeln saknas'); process.exit(2); }
const BAS = `http://127.0.0.1:${process.env.MAXIMUS_PROVPORT || 3299}`;
const b = await chromium.launch();
const p = await (await fastPanel(await b.newContext({ viewport: { width: 1100, height: 680 } }))).newPage();
const fel = []; p.on('pageerror', e => fel.push(String(e).slice(0, 160)));
let rott = 0;
const ok = (v, t) => { console.log(`${v ? 'GRÖNT' : 'RÖTT '} · ${t}`); if (!v) rott++; };
const api = (vag, kropp) => p.evaluate(async ([v, k]) => {
  const r = await fetch(v, k ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' }, body: JSON.stringify(k) } : {});
  return r.json().catch(() => ({ status: r.status }));
}, [vag, kropp]);

/// Låtsad modell: /api/uppstart säger `grind` som vi vill.
let grind = null;
await p.route('**/api/uppstart', async r => {
  if (grind === null) return r.continue();
  const svar = await r.fetch();
  const j = await svar.json();
  return r.fulfill({ response: svar, json: { ...j, grind } });
});

async function genomStarten() {
  await p.waitForSelector('#borja-villkor', { timeout: 15000 });
  await p.locator('#borja-villkor').check();
  await p.click('#borja-fortsatt');
  await p.waitForSelector('#borja-modeller', { timeout: 15000 });
  await p.click('#borja-modeller');
  await p.waitForSelector('#borja', { state: 'hidden', timeout: 60000 });
}

await p.addInitScript(() => {
  window.__prickar = false;
  new MutationObserver(() => { if (document.querySelector('.manus-tanker')) window.__prickar = true; })
    .observe(document, { subtree: true, childList: true });
});
await p.goto(`${BAS}/?n=${N}`, { waitUntil: 'networkidle' });
await genomStarten();
// Frågan om nya versioner lägger en ruta över allt efter några sekunder.
// Provet har tagit ställning: nej (som forbiStarten i hjalpare.mjs).
await api('/api/uppdatering', { satt: false });
// Uppstartsvilan står annars i vägen efter varje omladdning (test/vilan.mjs provar den).
await api('/api/installningar', { vilaVidStart: false });
await p.waitForTimeout(600);

async function vantaManus() {
  // Repliker strömmar sedan 2026-10-04: vänta tills Maximus skrivit klart.
  await p.waitForTimeout(150);
  await p.waitForFunction(() => !document.querySelector('.manus-tanker, .svar[data-strommar]'), null, { timeout: 30000 }).catch(() => {});
}
const repliker = async () => { await vantaManus(); return p.locator('.tur.forsta:not(.fran-dig) .svar').allTextContents(); };
const knappar = async () => { await vantaManus(); return p.locator('.forsta-val button').allTextContents(); };
const klicka = async text => { await vantaManus(); await p.locator('.forsta-val button', { hasText: text }).first().click(); await p.waitForTimeout(700); };
const ryms = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const allt = async () => { await vantaManus(); return (await p.locator('.tur .svar').allTextContents()).join('\n'); };
/// Väntar på en replik som matchar, i högst `ms`.
const vantaPa = async (re, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (re.test(await allt())) return true; await p.waitForTimeout(300); } return false; };

// ── Varv 1: varje steg hoppas över, profilen skrivs själv (låtsad modell) ──
let r = await repliker();
ok(/^Hej\. Jag är Maximus, och jag körs på den här datorn/.test(r[0]), 'Maximus skriver först');
ok(await p.evaluate(() => window.__prickar), 'Maximus "skriver" — prickar — innan repliken strömmar fram');
ok(/Vem är du\?/.test(r[0]) && /Skriv själv/.test(r[0]) && /cv/.test(r[0]) && /LinkedIn/.test(r[0]), 'och frågar vem du är: skriv själv, cv eller LinkedIn');
ok((await knappar()).join() === 'Skriv själv,Bifoga cv,Läs LinkedIn i Safari,Hoppa över', 'tre likvärdiga val och Hoppa över');
ok(await p.locator('.forsta-val button.primar').count() === 0, 'inget av de tre är framhävt framför de andra');
ok(await p.locator('.forsta-resten').isVisible() && (await p.locator('.forsta-resten').textContent()) === 'Hoppa över resten', '"Hoppa över resten" står där, diskret');
ok(await p.locator('#fraga').isVisible(), 'skrivfältet står där, för en länk eller en mening');
ok(await p.locator('.tom').count() === 0, 'ingen tom startsida bakom');
ok(await ryms(), 'ryms i 1100×680 utan sidled');
await p.screenshot({ path: '/tmp/maximus-forsta.png' });

// Mitt i: en omladdning ska ge samma fråga, inte hoppa över den.
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(900);
r = await repliker();
ok(/Vem är du\?/.test(r[0]), 'efter omladdning: samma fråga igen');

// Skriv själv, med en låtsad modell: samma bekräftelse som för ett cv.
grind = true;
let textKropp = null;
await p.route('**/api/du/text', async rt => {
  textKropp = JSON.parse(rt.request().postData() || '{}');
  return rt.fulfill({ json: { kalla: 'text', sparad: true, forslag: { vem: 'Upphandlare på en kommun', arbetar: 'IT-avtal och ramavtal', vill: 'Inga överprövningar i år', intressen: 'LOU, AI' } } });
});
await klicka('Skriv själv');
await p.waitForSelector('.forsta-text textarea', { timeout: 15000 });
const ta = p.locator('.forsta-text textarea');
ok(/Vad du arbetar med och var\.\nDin roll\.\nVad du vill att Maximus håller koll på\.\nVad som intresserar dig\./.test(await ta.getAttribute('placeholder')), 'textrutan har en vägledande platshållare');
ok(await p.waitForFunction(() => document.activeElement?.matches('.forsta-text textarea'), null, { timeout: 3000 }).then(() => true, () => false), 'fokus står i textrutan');
ok(await p.locator('.forsta-text label').textContent() === 'Om dig, med egna ord', 'och en etikett för skärmläsaren');
ok(await ryms(), 'textrutan ryms i 1100×680');
await ta.fill('Jag leder upphandlingen av IT-avtal på en kommun. Håll koll på överprövningar och nya ramavtal.');
await p.screenshot({ path: '/tmp/maximus-forsta-skriv.png' });
await p.locator('.forsta-text button.primar').click();
await vantaPa(/Så här förstår jag dig/);
r = await repliker();
ok(/Så här förstår jag dig/.test(r.at(-1)) && /Upphandlare på en kommun/.test(r.at(-1)), 'texten analyserades: "Så här förstår jag dig"');
ok(textKropp?.text?.startsWith('Jag leder upphandlingen') && textKropp.analysera === undefined, 'hela texten gick till analysen');
ok((await knappar()).join() === 'Stämmer,Inte riktigt — jag skriver själv', 'med Stämmer och Inte riktigt');
await klicka('Stämmer');
await p.unroute('**/api/du/text');
grind = null;
ok((await api('/api/profil')).profil?.arbetar === 'IT-avtal och ramavtal', 'profilen sparad ur förslaget');
ok((await api('/api/sessioner')).some(x => x.helig?.sort === 'du'), 'Du blir den första heliga sessionen');

// Följa löpande: Hoppa över.
await vantaPa(/följa det som händer omkring dig, löpande/);
ok((await knappar()).join() === 'Ja, följ löpande,Hoppa över', 'löpande: ja eller Hoppa över');
await klicka('Hoppa över');
// Rösten: Hoppa över, förvalet står kvar.
await vantaPa(/Hur vill du att jag låter\?/);
ok((await knappar()).at(-1) === 'Hoppa över', 'rösten går att hoppa över');
const personaFore = (await api('/api/uppstart')).installningar.persona;
await klicka('Hoppa över');
ok((await api('/api/uppstart')).installningar.persona === personaFore, 'rösten orörd');
// Det som lämnar datorn: "Nej, allt här" är vägen förbi.
await p.waitForSelector('.forsta-val button:has-text("Nej, allt här")', { timeout: 20000 });
await klicka('Nej, allt här');
// Tillgångarna: hela steget hoppas över från första frågan.
await vantaPa(/E-post — läser dina mejl/);
ok((await knappar()).join() === 'Ja,Nej,Hoppa över tillgångarna', 'tillgångarna: ja, nej eller hoppa över hela steget');
await klicka('Hoppa över tillgångarna');
ok(!(await repliker()).some(x => /^(Kalender|Anteckningar|Meddelanden|Påminnelser) — /.test(x)), 'inga fler frågor om tillgång');
ok((await api('/api/tillstand')).beslut.length === 0, 'inget beslut loggat');
// Rundturen: Hoppa över. Genomgången erbjuds inte — ingen källa.
await vantaPa(/Vill du se vad jag kan\?/);
ok(!/gå igenom det du gett mig/.test(await allt()), 'ingen genomgång utan källa');
await klicka('Hoppa över');
await vantaPa(/En sak till/);
let text = await allt();
ok(/En sak till: agenten arbetar inte än — den behöver minst en källa att läsa\./.test(text) && /Inställningar → Agenten → Källor/.test(text),
  'tack säger vad som saknas och var det ordnas');
ok(!/veta vem du är/.test(text.split('En sak till')[1] || ''), 'profilen saknas inte — den nämns inte');
ok(await p.locator('.forsta-val').count() === 0 && await p.locator('.forsta-resten').count() === 0, 'inga knappar står kvar');
ok((await api('/api/uppstart')).installningar.forsta?.klar === true, 'första sessionen markerad som gjord');
await p.waitForTimeout(1500);
const sessioner = await api('/api/sessioner');
const v = sessioner.find(x => x.titel === 'Välkommen till Maximus');
ok(Boolean(v), 'första sessionen sparades som "Välkommen till Maximus"');
const hel = v && await api(`/api/sessioner/${v.id}`);
ok(hel?.turer?.[0]?.fraga === '' && /^Hej\. Jag är Maximus/.test(hel.turer[0].svar), 'första turen är Maximus som talar först, utan fråga');
ok(/Jag leder upphandlingen/.test(hel?.turer?.map(t => t.fraga).join('|')), 'din text står som din replik i samtalet');

// ── Agentens läge: listen, Hem-kortet, Uppdrag och /uppdrag ──────────────
const lista = p.locator('#list-agenten');
ok(await lista.evaluate(e => e.classList.contains('av')) && /Agenten är av — den behöver minst en källa att läsa/.test(await lista.getAttribute('aria-label')),
  'listen: Agenten är av, och varför, också för skärmläsaren');
await p.click('#list-hem');
await p.waitForTimeout(800);
const kort = p.locator('.behovkort');
ok(await kort.isVisible() && /Agenten behöver något att läsa/.test(await kort.textContent()), 'Hem: ett lugnt kort — Agenten behöver något att läsa');
ok(await ryms(), 'Hem ryms i 1100×680');
await p.screenshot({ path: '/tmp/maximus-hem-behov.png' });
await kort.locator('button', { hasText: 'Sätt upp' }).click();
await p.waitForTimeout(800);
ok(await p.locator('#vy-installningar .flik[data-flik="agent"]').isVisible(), 'Sätt upp leder till Inställningar → Agenten → Källor');
await p.click('#inst-stang');
await p.click('#list-uppdrag');
await p.waitForTimeout(800);
const band = p.locator('.uppdragen .behov-band');
ok(await band.isVisible() && /Agenten är av — den behöver minst en källa att läsa/.test(await band.textContent())
  && (await band.locator('button').allTextContents()).join() === 'Välj källor', 'Uppdrag: Agenten är av, med en knapp till källorna');
// Ett uppdrag skapas inte: ett lugnt besked i stället.
await p.click('#list-hem');
await p.waitForTimeout(500);
await p.fill('#fraga', '/uppdrag håll koll på nya ramavtal');
await p.keyboard.press('Escape');
await p.keyboard.press('Enter');
await vantaPa(/Agenten är av — den behöver minst en källa att läsa/);
ok(/Agenten är av — den behöver minst en källa att läsa/.test(await allt()) && (await knappar()).join() === 'Välj källor,Okej', '/uppdrag: beskedet, och vägen dit');
ok((await api('/api/uppdrag')).uppdrag.length === 0, 'inget uppdrag skapades');
await klicka('Välj källor');
ok(await p.locator('#vy-installningar .flik[data-flik="agent"]').isVisible(), 'knappen öppnar källorna');
await p.click('#inst-stang');
// Dölj kortet: borta, och ihågkommet.
await p.click('#list-hem');
await p.waitForTimeout(600);
await p.locator('.behovkort button', { hasText: 'Dölj kortet' }).click();
await p.waitForTimeout(600);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(900);
await p.click('#list-hem');
await p.waitForTimeout(600);
ok(await p.locator('.behovkort').count() === 0 && (await api('/api/uppstart')).installningar.behovStangt === true, 'dolt kort förblir dolt');
// En källa: agenten är på, utan omladdning.
await api('/api/installningar', { behovStangt: false });
await api('/api/installningar', { agent: { bevakning: true } });
await p.waitForFunction(() => !document.querySelector('#list-agenten')?.classList.contains('av'), null, { timeout: 15000 }).catch(() => {});
ok(!(await lista.evaluate(e => e.classList.contains('av'))), 'en källa på: listen säger inte längre av');
await p.click('#list-hem');
await p.waitForTimeout(600);
ok(await p.locator('.behovkort').count() === 0, 'och Hem-kortet är borta');

// ── Varv 2: skriv själv utan modell, sedan "Hoppa över resten" ───────────
const nollstall = async () => {
  await api('/api/installningar', { forsta: { steg: 'fraga', klar: false }, profil: null, agent: {}, behovStangt: false });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
};
grind = false;
await nollstall();
await vantaPa(/Vem är du\?/);
await klicka('Skriv själv');
await p.waitForSelector('.forsta-text textarea', { timeout: 15000 });
// Bara tangentbordet: fokus står i rutan av sig själv.
await p.waitForFunction(() => document.activeElement?.matches('.forsta-text textarea'), null, { timeout: 5000 }).catch(() => {});
await p.keyboard.type('Projektledare på ett energibolag i Luleå. Följ elpriset och nya upphandlingar.');
await p.keyboard.press('Meta+Enter');
await vantaPa(/Sparat\. Modellen startar fortfarande/);
ok(/Sparat\. Modellen startar fortfarande, så jag läser texten senare/.test(await allt()), 'utan modell: texten sparad direkt, analysen senare — ingen väntan');
const egen = (await api('/api/profil')).profil?.egen;
ok(egen === 'Projektledare på ett energibolag i Luleå. Följ elpriset och nya upphandlingar.', 'texten står i profilen, hel');
await vantaPa(/löpande/);
ok(await p.locator('.forsta-resten').isVisible(), '"Hoppa över resten" står kvar i nästa steg');
await p.locator('.forsta-resten').focus();
await p.keyboard.press('Enter');
await vantaPa(/En sak till/);
text = await allt();
ok(!/Hur vill du att jag låter/.test(text) && /En sak till: agenten arbetar inte än — den behöver minst en källa att läsa/.test(text), 'Hoppa över resten (med tangentbordet): direkt till tack');
ok((await api('/api/uppstart')).installningar.forsta?.klar === true, 'guiden är gjord');
// I Inställningar → Du → Profil står texten, redigerbar, och sägs oanalyserad.
await p.click('#list-inst');
await p.waitForTimeout(800);
ok(/Projektledare på ett energibolag/.test(await p.locator('#pr-egen').inputValue()), 'Profil: "Skriv om dig själv" visar din text');
ok(/sparad men inte analyserad/.test(await p.locator('#pr-egen-om').textContent()), 'och säger att den inte är analyserad än');
ok(await p.locator('#du-analysera').isVisible(), 'med Analysera bredvid cv och Safari');
// Servern säger att modellen inte svarar än (låtsat: provservern kan ha en modell uppe).
await p.route('**/api/du/text', rt => rt.fulfill({ json: { kalla: 'text', sparad: true, forslag: null, senare: true } }));
await p.locator('#du-analysera').click();
await p.waitForFunction(() => /svarar inte än|Prova|förslag/i.test(document.querySelector('#pr-svar')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
ok(/Modellen svarar inte än/.test(await p.locator('#pr-svar').textContent()), 'Analysera utan modell: sparad, försök igen om en stund');
await p.unroute('**/api/du/text');
await p.click('#inst-stang');
grind = null;

// ── Varv 3: "Hoppa över resten" direkt — allt saknas ─────────────────────
await nollstall();
await vantaPa(/Vem är du\?/);
await p.locator('.forsta-resten').click();
await vantaPa(/En sak till/);
text = await allt();
ok(/den behöver veta vem du är och minst en källa att läsa/.test(text) && /Inställningar → Du → Profil och Inställningar → Agenten → Källor/.test(text),
  'hoppat över allt: tack säger båda, och var');
await p.waitForTimeout(1500);
await p.click('#list-hem');
await p.waitForTimeout(800);
ok(/Agenten behöver veta vem du är och ha något att läsa/.test(await p.locator('.behovkort').textContent().catch(() => '')), 'Hem-kortet säger båda');
ok((await p.locator('.behovkort button').allTextContents()).join() === 'Sätt upp,Välj källor,Dölj kortet', 'Sätt upp (profilen först), källorna, och dölj');
await p.locator('.behovkort button', { hasText: 'Sätt upp' }).click();
await p.waitForTimeout(800);
ok(await p.locator('#vy-installningar .flik[data-flik="du"]').isVisible(), 'Sätt upp leder till profilen först');

await p.click('#inst-stang');

// ── Varv 4: en mening i rutan är din text; resten hoppas över en gång ────
grind = false;
await nollstall();
await vantaPa(/Vem är du\?/);
await p.fill('#fraga', 'Upphandlare på en kommun, mest IT-avtal');
await p.keyboard.press('Enter');
await vantaPa(/Sparat\. Modellen startar fortfarande/);
ok(await p.locator('.tur.forsta.fran-dig .fraga').first().textContent() === 'Upphandlare på en kommun, mest IT-avtal', 'meningen står som din replik');
ok((await api('/api/profil')).profil?.egen === 'Upphandlare på en kommun, mest IT-avtal', 'och sparas som din egen text, inte avkapad i Vem');
await vantaPa(/löpande/);
await p.locator('.forsta-resten').click();
await vantaPa(/En sak till/);
await p.waitForTimeout(1500);
const v4 = (await api('/api/sessioner')).filter(x => x.titel === 'Välkommen till Maximus');
const sista = v4.length && await api(`/api/sessioner/${v4.at(-1).id}`);
ok((sista?.turer || []).filter(t => /En sak till/.test(t.svar)).length === 1, 'ett tack, inte två — frågan som stod obesvarad leder inte vidare');
grind = null;

console.log('sidfel:', fel.length ? fel.join(' | ') : 'inga');
await b.close();
process.exit(rott || fel.length ? 1 : 0);
