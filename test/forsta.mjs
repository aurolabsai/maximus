import { fastPanel } from './hjalpare.mjs';
/// Första sessionen, provad i webbläsaren mot en NY provserver.
///
///   sh scripts/provserver.sh start
///   node test/forsta.mjs <nyckel>
///
/// Går igenom starten (villkor, modeller som redan finns på disk) och sedan
/// samtalet där Maximus skriver först.
import { chromium } from 'playwright';
const N = process.argv[2];
if (!N) { console.error('nyckeln saknas'); process.exit(2); }
const BAS = `http://127.0.0.1:${process.env.MAXIMUS_PROVPORT || 3299}`;
const b = await chromium.launch();
const p = await (await fastPanel(await b.newContext({ viewport: { width: 1280, height: 900 } }))).newPage();
const fel = []; p.on('pageerror', e => fel.push(String(e).slice(0, 160)));
let rott = 0;
const ok = (v, t) => { console.log(`${v ? 'GRÖNT' : 'RÖTT '} · ${t}`); if (!v) rott++; };
const api = vag => p.evaluate(async v => (await fetch(v)).json(), vag);

async function genomStarten(p) {
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
await genomStarten(p);
await p.waitForTimeout(600);

async function vantaManus() {
  // Repliker strömmar sedan 2026-10-04: vänta tills Maximus skrivit klart.
  await p.waitForTimeout(150);
  await p.waitForFunction(() => !document.querySelector('.manus-tanker, .svar[data-strommar]'), null, { timeout: 30000 }).catch(() => {});
}
let prickar = false;
const repliker = async () => { await vantaManus(); return p.locator('.tur.forsta:not(.fran-dig) .svar').allTextContents(); };
let r = await repliker();
ok(/^Hej\. Jag är Maximus, och jag körs på den här datorn/.test(r[0]), 'Maximus skriver först');
ok(await p.evaluate(() => window.__prickar), 'Maximus "skriver" — prickar — innan repliken strömmar fram');
// Fas 49: "vem är du?" — LinkedIn, cv eller en länk, eller en mening.
ok(/Vem är du\?/.test(r[0]) && /LinkedIn/.test(r[0]) && /cv/.test(r[0]), 'och frågar vem du är: LinkedIn, cv eller en länk');
ok((await p.locator('.forsta-val button').allTextContents()).join() === 'Bifoga cv eller LinkedIn-export,Läs min profil i Safari', 'med en fil eller Safari som knappar');
ok(await p.locator('#fraga').isVisible(), 'skrivfältet står där, för en länk eller en mening');
ok(await p.locator('.tom').count() === 0, 'ingen tom startsida bakom');
ok(await p.evaluate(() => getComputedStyle(document.querySelector('main')).opacity) === '1', 'appen syns direkt efter starten, utan en tom yta emellan');
await p.screenshot({ path: '/tmp/maximus-forsta.png' });

// Mitt i: en omladdning ska ge samma fråga, inte hoppa över den.
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(900);
r = await repliker();
ok(/Vem är du\?/.test(r[0]), 'efter omladdning: samma fråga igen');

// En mening duger fortfarande.
await p.fill('#fraga', 'Upphandlare på en kommun, mest IT-avtal');
await p.keyboard.press('Enter');
await p.waitForTimeout(1200);
r = await repliker();
ok(await p.locator('.tur.forsta.fran-dig .fraga').first().textContent() === 'Upphandlare på en kommun, mest IT-avtal', 'svaret står som din replik');
ok((await api('/api/sessioner')).some(x => x.helig?.sort === 'du'), 'Du blir den första heliga sessionen');
ok(/följa det som händer omkring dig, löpande/.test(r.at(-1)) && (await p.locator('.forsta-val button').allTextContents()).join() === 'Ja, följ löpande,Inte nu',
  'Maximus ber om lov att följa löpande');
await p.locator('.forsta-val button', { hasText: 'Inte nu' }).click();
await p.waitForTimeout(800);
r = await repliker();
ok(/^Hur vill du att jag låter\?/.test(r.at(-1)) && /Professionell/.test(r.at(-1)) && /Kaxig/.test(r.at(-1)), 'sedan rösten, med ett exempel per röst');
await p.locator('.forsta-val button', { hasText: 'Kaxig' }).click();
await p.waitForTimeout(800);
r = await repliker();
ok((await api('/api/uppstart')).installningar.persona === 'kaxig', 'rösten sparad');

// Det som lämnar datorn (2026-10-09): ett eget steg, med din text maskerad
// framför dig, nivån, och en extern modell om du vill.
await p.waitForSelector('.moln-prov-ut', { timeout: 15000 });
await p.waitForFunction(() => /\[/.test(document.querySelector('.moln-prov-ut')?.textContent || ''), null, { timeout: 15000 });
const ut = await p.locator('.moln-prov-ut').textContent();
ok(/Det som lämnar datorn/.test((await repliker()).join('\n')) && !/Kalle|Svensson|070-123|Volvo/.test(ut), `steget visar det som går ut, maskerat: ${ut.slice(0, 90)}`);
await p.locator('.moln-maskering [data-lage="personuppgifter"]').click();
await p.waitForFunction(() => /Volvo/.test(document.querySelector('.moln-prov-ut')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
ok(/Volvo/.test(await p.locator('.moln-prov-ut').textContent()) && (await api('/api/moln')).lage?.maskering === 'personuppgifter',
  'Personuppgifter: företaget står kvar, och nivån sparas');
await p.waitForSelector('.forsta-val button:has-text("Nej, allt här")', { timeout: 15000 });
ok((await p.locator('.forsta-val button').allTextContents()).join() === 'Nej, allt här,Ja, koppla en', 'frågan om en extern modell, med nej först');
await p.locator('.forsta-val button', { hasText: 'Nej, allt här' }).click();
await p.waitForTimeout(800);
r = await repliker();
const n = r.length;
ok(/^Snyggt\. Vill du att jag håller koll på grejer/.test(r[n - 2]) && /E-post/.test(r[n - 2]) && /Kalender/.test(r[n - 2]) && /Meddelanden/.test(r[n - 2]) && /Till telefonen/.test(r[n - 2]),
  'resten går i den valda rösten, och apparna räknas upp');
const knappar = () => p.locator('.forsta-val button').allTextContents();
ok(/^E-post — läser dina mejl/.test(r[n - 1] || '') && (await knappar()).join() === 'Ja,Nej', 'en sak i taget: först e-post, med ja och nej');

// Nej, skrivet i fältet i stället för på knappen.
await p.fill('#fraga', 'nej');
await p.keyboard.press('Enter');
await p.waitForTimeout(700);
r = await repliker();
ok(r.some(x => /^E-post av\./.test(x)), 'ett skrivet nej är ett nej, med skälet utskrivet');
ok(/^Kalender — läser dina möten/.test(r.at(-1)), 'sedan kalendern');

// Ja till kalendern: läses på riktigt.
await p.locator('.forsta-val button', { hasText: 'Ja' }).click();
// Nekar macOS kalendern i provmiljön kommer slingan med Systeminställningar; då hoppas den över.
await p.waitForSelector('text=/Kalender på\\.|macOS säger nej till Kalender/', { timeout: 60000 });
const kalNej = await p.locator('text=macOS säger nej till Kalender').count();
if (kalNej) { await p.locator('.forsta-val button', { hasText: 'Hoppa över' }).click(); await p.waitForTimeout(800); }
r = await repliker();
ok(kalNej ? true : r.some(x => /^Kalender på\. .*ändrar aldrig/.test(x)), kalNej ? 'macOS nekade kalendern här: slingan visades och hoppades över' : 'ja: kalendern lästes, och skälet säger vad den aldrig gör');
ok(/^Anteckningar — läser en mapp/.test(r.at(-1)), 'sedan anteckningar');
await p.locator('.forsta-val button', { hasText: 'Nej' }).click();
await p.waitForTimeout(700);
r = await repliker();
// Meddelanden frågas sedan 2026-10-06 också i första sessionen.
ok(/^Meddelanden — läser inkommande/.test(r.at(-1)), 'sedan meddelanden');
await p.locator('.forsta-val button', { hasText: 'Nej' }).click();
await p.waitForTimeout(700);
r = await repliker();
// Påminnelser frågas sedan 2026-10-05 också i första sessionen.
ok(/^Påminnelser — läser dina påminnelser/.test(r.at(-1)), 'sedan påminnelser');
await p.locator('.forsta-val button', { hasText: 'Nej' }).click();
await p.waitForTimeout(700);
r = await repliker();
// Telefonen sist (2026-10-06): en riktig fråga, inte "finns inte än".
ok(/^Till telefonen — så jag kan säga till/.test(r.at(-1)), 'sist: får jag säga till på telefonen?');
await p.locator('.forsta-val button', { hasText: 'Nej' }).click();
await p.waitForTimeout(900);
r = await repliker();
// Och agenten erbjuder en första genomgång, eftersom kalendern är på.
if (!kalNej) {
  ok(r.some(x => /egen session under Grunden/.test(x)), 'varje app med lov får en helig session under Grunden');
  ok((await api('/api/sessioner')).some(x => x.helig?.sort === 'kalender'), 'Kalendern står i Grunden');
  ok(/gå igenom det du gett mig/.test(r.at(-1)), 'agenten erbjuder en första genomgång');
  await p.locator('.forsta-val button', { hasText: 'Inte nu' }).click();
  await p.waitForTimeout(700);
}
r = await repliker();
// Rundturen erbjuds (Fas 49), och går att hoppa över; den finns som /rundtur.
ok(/Vill du se vad jag kan\?/.test(r.at(-1)), 'rundturen erbjuds');
await p.locator('.forsta-val button', { hasText: 'Hoppa över' }).click();
await p.waitForTimeout(900);
r = await repliker();
const allt = async () => { await vantaManus(); return (await p.locator('.tur .svar').allTextContents()).join('\n'); };
ok(/Telefonen av\./.test(await allt()), 'ett nej till telefonen sägs med skälet');
ok(/Då kör vi\./.test(await allt()), 'och Maximus avslutar — i rösten');
ok(await p.locator('.forsta-val').count() === 0, 'inga knappar står kvar');
const t = await api('/api/tillstand');
console.log('        · ' + t.beslut.map(b => `${b.id}:${b.svar}`).join(' · '));
ok(t.beslut.length >= 3 && t.beslut.every(b => b.skal && b.nar), 'besluten loggade, vart och ett med skäl och tid');
ok((kalNej || (await api('/api/uppstart')).installningar.agent?.kalender) && !(await api('/api/uppstart')).installningar.agent?.epost,
  'agentens inställning följer besluten');
await p.screenshot({ path: '/tmp/maximus-tillstand.png', fullPage: true });
const prof = await api('/api/profil');
ok(prof.profil?.vem === 'Upphandlare på en kommun, mest IT-avtal', `svaret blev profilen (${prof.profil?.vem})`);
ok((await api('/api/uppstart')).installningar.forsta?.klar === true, 'första sessionen markerad som gjord');
// Första sessionen sparas som ett samtal och öppnas (Auro 2026-10-04).
await p.waitForTimeout(1500);
const sessioner = await api('/api/sessioner');
const v = sessioner.find(x => x.titel === 'Välkommen till Maximus');
ok(Boolean(v) && sessioner.filter(x => !x.helig).length === 1, 'första sessionen sparades som "Välkommen till Maximus", bredvid Grunden');
const hel = v && await api(`/api/sessioner/${v.id}`);
ok(hel?.turer?.[0]?.fraga === '' && /^Hej\. Jag är Maximus/.test(hel.turer[0].svar), 'första turen är Maximus som talar först, utan fråga');
ok(hel?.turer?.every(t => t.kvitto?.[0]?.vad === 'skrivet i förväg — ingen modell körde'), 'kvittot säger att texten är skriven i förväg');
ok(/Upphandlare på en kommun/.test(hel?.turer?.map(t => t.fraga).join('|')), 'ditt svar står som en fråga i samtalet');
ok((await p.locator('#sesstopp-titel').textContent().catch(() => '')) === 'Välkommen till Maximus', 'samtalet står öppet');

await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(900);
ok(await p.locator('.tur.forsta').count() === 0, 'nästa start: ingen första session igen');

console.log('sidfel:', fel.length ? fel.join(' | ') : 'inga');
await b.close();
process.exit(rott || fel.length ? 1 : 0);
