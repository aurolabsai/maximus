// Webben, när svaret inte finns i rummet.
//
// Två saker, och de är olika farliga.
//
// Att HÄMTA en sida är att läsa något som redan är offentligt. Sidan får veta
// att någon läste den, och inget mer.
//
// Att SÖKA är att lämna ifrån sig frågan. "Vad gäller när en anställd hos
// [NAMN A] har..." säger allt om vad du håller på med, och sökmotorn sparar
// det. Därför går varje sökning genom samma grind som allt annat som lämnar
// datorn: maskerad, godkänd, och nedskriven i liggaren.
//
// Enkla hämtningar räcker inte. Prövat 2026-09-25: lite.duckduckgo.com,
// mojeek, marginalia och bing gav noll externa länkar med curl — blockerade
// eller tomma. Sökmotorer vill ha en webbläsare, så MAXIMUS använder en.

import { chromium } from 'playwright';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { tx, svenska } from './sprakstod.mjs';

// Webbläsarens och sökmotorernas språk följer ditt (fas 3): svenska får
// svenska träffar som förut; engelska får engelska, utan land.
const lokal = () => (svenska() ? 'sv-SE' : 'en-US');

/// Motorerna, i den ordning de prövas.
///
/// En sökmotor som stryper svarar med en captcha, och då finns bara nästa
/// motor. Prövat 2026-09-25: efter femton provsökningar på fem minuter
/// svarade Brave captcha på allt — från både systemets Chrome och
/// Playwrights egen. En enskild handläggare gör inte femton sökningar på
/// fem minuter, men rotationen finns för den dagen det ändå händer.
const MOTORER = [
  { namn: 'Brave', url: q => `https://search.brave.com/search?q=${encodeURIComponent(q)}` },
  { namn: 'Ecosia', url: q => `https://www.ecosia.org/search?q=${encodeURIComponent(q)}` },
  { namn: 'Startpage', url: q => `https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}` },
  { namn: 'DuckDuckGo', url: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}&kl=${svenska() ? 'sv-se' : 'wt-wt'}` },
  { namn: 'Mojeek', url: q => `https://www.mojeek.com/search?q=${encodeURIComponent(q)}` },
  { namn: 'Bing', url: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}${svenska() ? '&setlang=sv&cc=SE' : '&setlang=en'}` },
];

/// Träffarna plockas ur länkarna, inte ur motorns klassnamn.
///
/// Första försöket hade en egen väljare per motor: ".snippet" för Brave,
/// "li.b_algo" för Bing. De slutade stämma mellan två provkörningar samma
/// förmiddag — motorerna bygger om sina sidor, och en produkt som hänger på
/// deras klassnamn går sönder utan förvarning.
///
/// Det som inte ändras är att en träff är en länk ut från motorn, med en
/// rubrik i sig och text omkring sig. Det räcker.
const PLOCKA = varden => {
  const egna = new RegExp(varden, 'i');
  const skrap = /\/(?:preferences|settings|about|privacy|terms|help|support|images|videos|maps|news|shopping|signin|login)\b|javascript:|mailto:/i;
  // Motorns egna appar och konton är inte träffar. De står i sidfoten på en
  // sida som inte gav några resultat alls, och en lista på dem ser ut som
  // ett svar utan att vara det.
  const egnaVardar = /^(?:apps\.apple\.com|play\.google\.com|itunes\.apple\.com|www\.reddit\.com|reddit\.com|x\.com|twitter\.com|www\.facebook\.com|www\.instagram\.com|github\.com|www\.linkedin\.com)$/i;
  const duger = t => t && t.length > 8 && t.length < 180 && !/^https?:/i.test(t) && !t.includes('<') && !/^\W+$/.test(t);
  const sett = new Set();
  const ut = [];
  for (const a of document.querySelectorAll('a[href^="http"]')) {
    let url, vard;
    try { url = new URL(a.href); vard = url.hostname; } catch { continue; }
    if (egna.test(vard) || egnaVardar.test(vard) || skrap.test(a.href)) continue;
    const nyckel = vard + url.pathname;
    if (sett.has(nyckel)) continue;

    // Rubriken står i träffens egen rubrikrad när det finns en. Länktexten
    // är annars ofta brödsmulor ("ivo.se › vard-omsorgsgivare › …") eller
    // ren markup, och en träfflista av adresser säger ingenting.
    const runt = a.closest('li, article, section, div[class]') || a.parentElement;
    const rubrik = [runt?.querySelector('h2, h3, h4')?.innerText, a.innerText, a.textContent]
      .map(t => (t || '').trim().replace(/\s+/g, ' ')).find(duger);
    if (!rubrik) continue;
    sett.add(nyckel);
    const utdrag = ((runt?.innerText || '').replace(/\s+/g, ' ').replace(rubrik, '').trim()).slice(0, 300);
    ut.push({ url: a.href, titel: rubrik, utdrag, vard });
  }
  return ut;
};

/// Knappar som ligger över sidan och måste bort innan något går att läsa.
const SAMTYCKE = [
  'button:has-text("Godkänn alla")', 'button:has-text("Acceptera alla")', 'button:has-text("Godkänn")',
  'button:has-text("Jag godkänner")', 'button:has-text("Tillåt alla")', 'button:has-text("Accept all")',
  'button:has-text("Acceptera")', '#onetrust-accept-btn-handler', '.fc-cta-consent', '[aria-label*="Godkänn"]',
  // Engelska sidor (fas 3), som engelska sökningar landar på oftare.
  'button:has-text("Accept all cookies")', 'button:has-text("Allow all")', 'button:has-text("I agree")',
  'button:has-text("Agree")', 'button:has-text("Accept")', '[aria-label*="Accept"]',
];

let webblasare = null;
let slocknar = null;

/// En webbläsare startas när den behövs och stängs när den stått stilla.
///
/// Den startas aldrig av sig själv: ingenting i MAXIMUS rör webben förrän
/// användaren bett om det.
/// Vägen ut, satt från inställningarna. Se lib/vag.mjs.
///
/// Byts den stängs webbläsaren: en proxy sätts vid start och går inte att
/// ändra på en som redan kör. En inställning som inte gäller förrän nästa
/// gång är en inställning man inte litar på.
let vagen = null;

export async function satVag(ny) {
  const forr = JSON.stringify(vagen || null);
  vagen = ny && ny.vag && ny.vag !== 'direkt' ? ny : null;
  if (JSON.stringify(vagen || null) !== forr) await stangWebben().catch(() => {});
  return vagen;
}

export const vagenNu = () => vagen;

/// Startar en webbläsare med en given proxy. Används av provet i lib/vag.mjs,
/// som behöver en egen så att den inte river den som kanske läser en sida.
export async function egenWebblasare(proxy) {
  const val = await valjWebblasare();
  if (!val) throw new Error(tx('webb.ingenWebblasare'));
  const b = await chromium.launch({ ...(val.kanal ? { channel: val.kanal } : {}), ...(proxy ? { proxy } : {}) });
  const c = await b.newContext({ locale: lokal(), timezoneId: 'Europe/Stockholm' });
  return { newPage: () => c.newPage(), close: () => b.close() };
}

async function ctx() {
  clearTimeout(slocknar);
  slocknar = setTimeout(() => stangWebben().catch(() => {}), 120000);
  if (webblasare) return webblasare.ctx;
  const val = await valjWebblasare();
  if (!val) throw new Error(tx('webb.ingenWebblasareHamta'));
  // Vägen ut prövas innan webbläsaren startas.
  //
  // Här stod `proxyFor(vagen)`, som ger null både när ingen proxy är vald
  // och när den valda är trasig — och null betyder direkt väg. En proxy som
  // inte gick att tolka blev alltså direkttrafik, tyst. Se granskaVag() i
  // lib/vag.mjs.
  //
  // Nu kastar vi i stället. Den som satt en väg ut gjorde det för att
  // trafiken inte skulle gå från det egna nätet, och då är ett fel rätt
  // svar — inte en tyst sändning på den väg hon valde bort.
  const { granskaVag } = await import('./vag.mjs');
  const vagval = granskaVag(vagen || {});
  if (!vagval.ok) {
    const e = new Error(tx('webb.vagfel', { fel: vagval.fel }));
    e.vagfel = true;
    throw e;
  }
  // Ingen egen väg ut: grindproxyn, som prövar adressen vid anslutningen och
  // inte bara före (granskningen 2026-10-09, se grindproxy()).
  const proxy = vagval.proxy || await grindproxy();
  const b = await chromium.launch({
    ...(val.kanal ? { channel: val.kanal } : {}),
    ...(proxy ? { proxy } : {}),
  });
  // Inga service workers (granskningen 2026-10-09): deras anrop går förbi
  // `page.route`, och en sida som registrerar en har ett eget nät.
  const c = await b.newContext({
    locale: lokal(), timezoneId: 'Europe/Stockholm', serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  // Ingenting sparas mellan sessioner: ingen profil, inga kakor kvar.
  webblasare = { b, ctx: c };
  return c;
}

/// Ett nytt spår. Kallas när en ny sökning börjar.
///
/// `chromium.launch()` — till skillnad från `launchPersistentContext()` —
/// kör redan i en temporär profil som Playwright river vid stängning.
/// Användarens egen Chrome rörs aldrig: ingen historik läses, inga kakor
/// skrivs dit, och ingenting av det MAXIMUS gör hamnar i webbläsarens egna spår.
///
/// Men kontexten levde vidare mellan frågorna. Webbläsaren hålls öppen i två
/// minuter för att nästa fråga ska slippa vänta på en uppstart, och i det
/// fönstret delade alla sökningar kakburk. En sida som satte en kaka under
/// fråga ett kände igen besökaren under fråga två, och två frågor som
/// användaren höll isär kunde sättas ihop på andra sidan.
///
/// En ny kontext kostar millisekunder — det är uppstarten av webbläsaren som
/// kostar sekunder, och den behåller vi. Varje sökning får alltså sin egen
/// kakburk, sin egen cache och sin egen historik, och den kastas efteråt.
/// Ett eget spår, som stängs när arbetet är klart.
///
/// Första försöket bytte den DELADE kontexten. Det gav varje sökning en egen
/// kakburk — men bara en i taget: två samtal som sökte samtidigt drog undan
/// varandras kontext mitt i en hämtning. Revisionen 2026-09-29 (M8) påpekade
/// att samtidig webbanvändning kan störa ett annat samtal, och det var just
/// så det gick till.
///
/// Nu får varje sökning en egen kontext som den stänger själv. Webbläsaren
/// hålls kvar — uppstarten kostar sekunder, en kontext millisekunder — och
/// två samtal kan söka samtidigt utan att veta om varandra.
export async function nyttSpar() {
  clearTimeout(slocknar);
  slocknar = setTimeout(() => stangWebben().catch(() => {}), 120000);
  if (!webblasare) await ctx();
  const egen = await webblasare.b.newContext({
    locale: lokal(), timezoneId: 'Europe/Stockholm', serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  return {
    nySida: () => egen.newPage(),
    stang: () => egen.close().catch(() => {}),
  };
}

export async function stangWebben() {
  clearTimeout(slocknar);
  const w = webblasare;
  webblasare = null;
  if (w) await w.b.close().catch(() => {});
}

/// Vilken webbläsare MAXIMUS ska använda.
///
/// Tre svar, i den ordningen:
///
/// 1. Den egna. Chromium headless shell väger 196 MB och packas därför inte
///    med — installeraren skulle dubblas för något många redan har.
/// 2. Systemets Chrome eller Edge, genom Playwrights kanaler. På Windows
///    finns Edge alltid, så där blir det aldrig en nedladdning.
/// 3. Ingen. Då säger MAXIMUS det, och erbjuder sig att hämta.
///
/// Playwright självt packas med — det är 18 MB utan webbläsare, och utan det
/// finns ingen webbfunktion alls i en byggd app.
const KANALER = ['chrome', 'msedge', 'chromium'];

let valdCache = null;
export async function valjWebblasare({ om = false } = {}) {
  if (valdCache && !om) return valdCache;
  try {
    const vag = await chromium.executablePath();
    if (vag) return (valdCache = { sort: 'egen', vag });
  } catch { /* ingen egen — prova systemets */ }
  for (const kanal of KANALER) {
    try {
      // executablePath på en kanal slår upp var systemet lagt den, utan att
      // starta något.
      const vag = chromium.executablePath({ channel: kanal });
      if (vag && await finns(vag)) return (valdCache = { sort: kanal, kanal, vag });
    } catch { /* nästa */ }
  }
  return (valdCache = null);
}

const finns = async vag => {
  try { const { access } = await import('node:fs/promises'); await access(vag); return true; }
  catch { return false; }
};

export const glomWebblasare = () => { valdCache = null; };

/// Hämtar en egen webbläsare, med framsteg.
///
/// Playwright har sitt eget hämtningsverktyg och vet var filerna ska ligga.
/// Att skriva ett eget vore att bygga om något som redan finns och som
/// dessutom måste stämma med den version av Playwright som är installerad.
///
/// `chromium-headless-shell` och inte hela Chromium: MAXIMUS visar aldrig ett
/// webbläsarfönster, och skalet är hälften så stort.
export async function hamtaWebblasare({ onSteg = () => {} } = {}) {
  const { spawn } = await import('node:child_process');
  const { createRequire } = await import('node:module');
  const cli = createRequire(import.meta.url).resolve('playwright/cli.js');

  onSteg({ text: tx('webb.hamtar') });
  await new Promise((klar, fel) => {
    const p = spawn(process.execPath, [cli, 'install', 'chromium-headless-shell'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    // Playwright skriver procenten på egen rad. Den vidarebefordras som den är
    // hellre än att tolkas om — formatet är deras, inte vårt.
    const las = d => {
      const m = String(d).match(/(\d+)%/g);
      if (m) onSteg({ text: tx('webb.hamtarProcent', { p: m.at(-1) }), andel: Number(m.at(-1).replace('%', '')) / 100 });
    };
    p.stdout.on('data', las);
    p.stderr.on('data', las);
    p.on('error', fel);
    p.on('close', k => (k === 0 ? klar() : fel(new Error(tx('webb.hamtningMisslyckades', { k })))));
  });
  glomWebblasare();
  return webblage();
}

export const webbFinns = async () => Boolean(await valjWebblasare());

/// Vad gränssnittet ska säga om webbläsaren.
export async function webblage() {
  const v = await valjWebblasare();
  const NAMN = { egen: tx('webb.egenChromium'), chrome: 'Google Chrome', msedge: 'Microsoft Edge', chromium: 'Chromium' };
  return { finns: Boolean(v), sort: v?.sort || null, namn: v ? NAMN[v.sort] || v.sort : null, vag: v?.vag || null };
}

/// Söker. Frågan ska redan vara maskerad när den kommer hit.
export async function sok(fraga, { antal = 5, signal, liggare, spar = null } = {}) {
  const fel = [];
  for (const m of MOTORER) {
    const t0 = Date.now();
    const sida = spar ? await spar.nySida() : await (await ctx()).newPage();
    // Söksidan prövas som varje annan sida.
    //
    // `hamta` hade den här spärren; `sok` hade den inte. En söksidas
    // javascript kunde alltså nå en intern adress — revisionen 2026-09-29
    // (M3) lät ett syntetiskt anrop mot en privat adress nå transporten.
    //
    // En söksida är inte mer betrodd än en träff. Den kommer från nätet.
    const stoppade = [];
    await sida.route('**/*', async rutt => {
      const url = rutt.request().url();
      const g = await tillatenAdress(url);
      if (!g.ok) {
        if (stoppade.length < 20) stoppade.push(`${url.slice(0, 120)} (${g.skal})`);
        return rutt.abort();
      }
      return rutt.continue();
    });
    try {
      await sida.goto(m.url(fraga), { waitUntil: 'domcontentloaded', timeout: 20000 });
      const titel = await sida.title();
      if (/captcha|robot|are you human|403|forbidden/i.test(titel)) throw new Error(tx('webb.captcha'));
      // Sidorna ritas färdigt med javascript. Att vänta på nätverkstystnad
      // tar för lång tid på sidor med spårare som aldrig tystnar.
      await sida.waitForTimeout(2200);
      const egna = 'brave|duckduckgo|ecosia|startpage|mojeek|bing|google|microsoft|msn|yahoo';
      const traffar = (await sida.evaluate(PLOCKA, egna)).slice(0, antal);
      // En motor som inte ritade sina resultat lämnar ifrån sig sidfoten.
      // Tre olika värdar är den enklaste skiljelinjen mellan en träfflista
      // och en meny.
      if (new Set(traffar.map(t => t.vard)).size < 3) throw new Error(tx('webb.ingenTrafflista'));
      // Liggaren skrivs, men dess fel får aldrig bli sökningens fel: ett
      // obevakat löfte härifrån tog ner hela servern 2026-09-25.
      await skrivLiggare(liggare, { frontier: tx('webb.liggare.sok', { motor: m.namn }), vag: 'webb', skickat: fraga,
        mottaget: traffar.map(t => `${t.titel} — ${t.url}`).join('\n'),
        tecken: fraga.length, sekunder: (Date.now() - t0) / 1000 });
      return { motor: m.namn, traffar };
    } catch (e) {
      fel.push(`${m.namn} ${e.message.split('\n')[0].slice(0, 48)}`);
    } finally { await sida.close().catch(() => {}); }
    if (signal?.aborted) break;
  }
  const e = new Error(tx('webb.ingenMotor', { fel: fel.join(' · ') }));
  e.webbfel = true;
  throw e;
}

/// Skriver en liggarrad, och tiger inte om den inte gick.
///
/// Stod som `.catch(() => {})`. Ett fel i liggaren försvann alltså spårlöst,
/// och det är precis det fel man minst av allt vill förlora: en sändning
/// skedde och boken vet inte om den.
///
/// Raden får inte fälla anropet den bokför — trafiken har redan gått. Men den
/// ska synas.
async function skrivLiggare(liggare, rad) {
  if (typeof liggare !== 'function') return;
  try { await liggare(rad); }
  catch (e) { console.error('liggaren kunde inte skriva om webbtrafik:', e.message); }
}

/// Adresser som aldrig får hämtas.
///
/// Hämtaren tog vilken adress som helst. Revisionen 2026-09-28 visade två
/// följder: `http://127.0.0.1:43210/private` accepterades direkt, och en
/// angriparkontrollerad sida — en sökträff räcker — kunde låta sitt eget
/// JavaScript anropa intranätet från insidan av MAXIMUS:s webbläsare.
///
/// Kontrollen görs på den UPPSLAGNA adressen, inte på namnet. `intern.example`
/// kan peka på 10.0.0.5, och ett namn säger ingenting om var det landar.
///
/// Listan är IANA:s register över specialadresser, inte de fem man kommer på
/// (granskningen 2026-10-09). 198.18.0.0/15, 192.0.0.0/24, 240.0.0.0/4,
/// multicast och flera IPv6-block saknades. Adressen räknas om till byte och
/// prövas mot prefix — ett mönster på text missar skrivsätt, byte gör det inte.
const BLOCK4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],   // 240/4 bär också 255.255.255.255
];

const BLOCK6 = [
  ['::', 128], ['::1', 128], ['::', 96],             // ospecificerad, loopback, IPv4-kompatibel
  ['64:ff9b:1::', 48], ['100::', 64],                // lokal NAT64, discard
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], // IETF-block med Teredo, dokumentation, 6to4
  ['3fff::', 20], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
];

const byte4 = ip => {
  const d = ip.split('.').map(Number);
  return d.length === 4 && d.every(x => Number.isInteger(x) && x >= 0 && x <= 255) ? d : null;
};

/// En IPv6-adress som sexton byte, oavsett hur den skrivs.
///
/// `::ffff:127.0.0.1` och `::ffff:7f00:1` är SAMMA adress. Den första
/// fångades, den andra inte: revisionen 2026-09-29 (M3) lät ett syntetiskt
/// DNS-svar `::ffff:7f00:1` passera som publikt. Att räkna upp skrivsätten
/// är fel väg — byten är samma byte hur de än stavades.
function byte6(ip) {
  let v = ip.toLowerCase().replace(/%.*$/, '');
  let svans = [];
  const punkt = /(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (punkt) {
    const b = byte4(punkt[1]);
    if (!b) return null;
    svans = b;
    v = v.slice(0, -punkt[1].length) + '0:0';
  }
  const [fore, efter, ...mer] = v.split('::');
  if (mer.length) return null;
  const grupper = s => (s ? s.split(':') : []);
  const f = grupper(fore), e = efter === undefined ? [] : grupper(efter);
  const fyll = efter === undefined ? 0 : 8 - f.length - e.length;
  if (fyll < 0 || (efter === undefined && f.length !== 8)) return null;
  const alla = [...f, ...Array(fyll).fill('0'), ...e];
  if (alla.length !== 8 || !alla.every(g => /^[0-9a-f]{1,4}$/.test(g))) return null;
  const ut = alla.flatMap(g => { const n = parseInt(g, 16); return [n >> 8, n & 255]; });
  if (svans.length) ut.splice(12, 4, ...svans);
  return ut;
}

const iPrefix = (b, nat, bitar) => {
  for (let i = 0; i < bitar; i++) {
    const mask = 0x80 >> (i % 8);
    if ((b[i >> 3] & mask) !== (nat[i >> 3] & mask)) return false;
  }
  return true;
};

const B4 = BLOCK4.map(([n, l]) => [byte4(n), l]);
const B6 = BLOCK6.map(([n, l]) => [byte6(n), l]);

function privatIP(ip) {
  if (!ip) return true;
  const typ = isIP(String(ip).replace(/%.*$/, ''));
  if (typ === 4) { const b = byte4(ip); return !b || B4.some(([n, l]) => iPrefix(b, n, l)); }
  if (typ !== 6) return true;
  const b = byte6(ip);
  if (!b) return true;
  // IPv4 bakom IPv6 prövas som IPv4: mappad (::ffff:0:0/96) och NAT64
  // (64:ff9b::/96). 127.0.0.1 är 127.0.0.1 också i en IPv6-adress.
  const mappad = iPrefix(b, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255], 96);
  const nat64 = iPrefix(b, [0, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0], 96);
  if (mappad || nat64) return privatIP(b.slice(12).join('.'));
  return B6.some(([n, l]) => iPrefix(b, n, l));
}

/// Slår upp ett namn och ger tillbaka EN adress att ansluta till, eller kastar.
///
/// Alla svar måste vara publika. Ett namn som pekar på både en publik och en
/// privat adress är ett namn som kan landa fel.
async function publikAdress(vard) {
  if (/^(localhost|.*\.localhost|.*\.internal|.*\.local)$/i.test(vard)) throw Object.assign(new Error(tx('webb.skal.interntNamn')), { skal: tx('webb.skal.interntNamn') });
  let adr;
  if (isIP(vard)) adr = [{ address: vard, family: isIP(vard) }];
  else {
    try { adr = await lookup(vard, { all: true }); }
    catch { throw Object.assign(new Error(tx('webb.skal.uppslag')), { skal: tx('webb.skal.uppslag') }); }
  }
  if (!adr.length || adr.some(a => privatIP(a.address))) throw Object.assign(new Error(tx('webb.skal.intern')), { skal: tx('webb.skal.intern') });
  return adr[0];
}

export async function tillatenAdress(adress) {
  let u;
  try { u = new URL(adress); } catch { return { ok: false, skal: tx('webb.skal.ogiltig') }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, skal: tx('webb.skal.protokoll', { protokoll: u.protocol }) };
  }
  // Hakparenteserna hör till URL:en, inte till adressen.
  //
  // `u.hostname` för `http://[::1]/` är `[::1]` MED parenteser, och
  // `isIP('[::1]')` är 0. Varje IPv6-adress gick därför till en DNS-slagning
  // av en sträng som inte är ett namn, misslyckades, och avvisades med
  // "namnet gick inte att slå upp". Rätt utfall, fel skäl — och en kontroll
  // som aldrig kördes är en kontroll man inte vet något om.
  const vard = u.hostname.replace(/^\[|\]$/g, '');
  try { await publikAdress(vard); }
  catch (e) { return { ok: false, skal: e.skal || tx('webb.skal.intern') }; }
  return { ok: true };
}

/// Grinden vid anslutningen, inte bara före (granskningen 2026-10-09).
///
/// `tillatenAdress` slog upp namnet, och sedan slog webbläsaren upp det igen
/// när den anslöt. En DNS-server med TTL 0 kunde svara en publik adress till
/// kontrollen och 127.0.0.1 till anslutningen — DNS-rebinding. Kontrollen
/// var riktig och anslutningen gick ändå fel.
///
/// Nu går webbläsarens trafik, och Playwrights egna hämtningar i samma
/// kontext, genom en liten proxy på 127.0.0.1 när ingen egen väg ut är vald.
/// Proxyn slår upp namnet EN gång, prövar adressen och ansluter till just den
/// adressen. TLS går orört genom tunneln, så sidorna ser samma webbläsare som
/// förut. Det täcker också det `page.route` aldrig såg: WebSocket och
/// service workers går genom samma proxy. Playwright skickar själv loopback
/// genom proxyn (`<-loopback>`), annars hade 127.0.0.1 gått förbi.
///
/// Med en egen proxy eller Tor slår den proxyn upp namnen, och då är det den
/// som avgör var trafiken landar. Det är så valet är tänkt.
let grind = null;
function grindproxy() {
  if (grind) return grind;
  grind = (async () => {
    const { createServer, request } = await import('node:http');
    const { connect } = await import('node:net');
    const srv = createServer(async (req, res) => {
      // Vanlig http genom proxyn: adressen kommer hel i begäran.
      let u;
      try { u = new URL(req.url); } catch { res.writeHead(400).end(); return; }
      if (u.protocol !== 'http:') { res.writeHead(400).end(); return; }
      let mal;
      try { mal = await publikAdress(u.hostname.replace(/^\[|\]$/g, '')); }
      catch (e) { res.writeHead(403, { 'content-type': 'text/plain' }).end(`MAXIMUS: ${e.skal || 'stoppad'}`); return; }
      const huvud = { ...req.headers };
      delete huvud['proxy-connection']; delete huvud['proxy-authorization'];
      const ut = request({ host: mal.address, family: mal.family, port: u.port || 80, method: req.method,
        path: u.pathname + u.search, headers: huvud, setHost: false }, svar => {
        res.writeHead(svar.statusCode || 502, svar.headers);
        svar.pipe(res);
      });
      ut.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      req.pipe(ut);
    });
    // https och WebSocket: en tunnel till den prövade adressen.
    srv.on('connect', async (req, klient, huvud) => {
      klient.on('error', () => {});
      const m = /^\[?([^\]]+?)\]?:(\d+)$/.exec(req.url || '');
      if (!m) { klient.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
      let mal;
      try { mal = await publikAdress(m[1]); }
      catch { klient.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
      const fram = connect({ host: mal.address, port: Number(m[2]), family: mal.family }, () => {
        klient.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (huvud?.length) fram.write(huvud);
        fram.pipe(klient); klient.pipe(fram);
      });
      fram.on('error', () => klient.destroy());
      klient.on('close', () => fram.destroy());
    });
    srv.on('clientError', (e, s) => s.destroy());
    await new Promise((klar, fel) => { srv.once('error', fel); srv.listen(0, '127.0.0.1', klar); });
    srv.unref();
    return { server: `http://127.0.0.1:${srv.address().port}` };
  })().catch(e => { grind = null; throw e; });
  return grind;
}

/// Hämtar en sida och ger tillbaka läsbar text.
/// En fil som text, utan att rendera den: ett RSS- eller Atomflöde, eller
/// sidans HTML för att hitta flödet (Fas 29). Samma väg ut som allt annat
/// (webbläsarens kontext, med proxyn), varje omdirigering prövad som det
/// första hoppet, en rad i liggaren. Högst 1,5 MB.
export async function hamtaRa(adress, { liggare, signal } = {}) {
  const t0 = Date.now();
  let ok = false, storlek = 0, url = adress;
  const c = await ctx();
  try {
    let r = null;
    for (let hopp = 0; hopp < 4; hopp++) {
      if (signal?.aborted) throw new Error(tx('webb.avbrutet'));
      const g = await tillatenAdress(url);
      if (!g.ok) { const e = new Error(tx('webb.hamtasInte', { skal: g.skal })); e.webbfel = true; throw e; }
      r = await c.request.get(url, { timeout: 15000, maxRedirects: 0 });
      if (![301, 302, 303, 307, 308].includes(r.status())) break;
      const vidare = r.headers().location;
      if (!vidare) break;
      url = new URL(vidare, url).href;
      r = null;
    }
    if (!r || !r.ok()) throw new Error(r ? tx('webb.svarade', { status: r.status() }) : tx('webb.svaradeInte'));
    if (Number(r.headers()['content-length']) > 1_500_000) throw new Error(tx('webb.forStor'));
    const b = await r.body();
    storlek = b.length;
    if (b.length > 1_500_000) throw new Error(tx('webb.forStor'));
    ok = true;
    return { url, typ: (r.headers()['content-type'] || '').split(';')[0].trim(), text: b.toString('utf8') };
  } finally {
    await skrivLiggare(liggare, { frontier: tx('webb.liggare.hamtning'), vag: 'webb', skickat: adress,
      mottaget: ok ? `${Math.round(storlek / 1024)} kB` : tx('webb.liggare.ingenting'), tecken: adress.length, sekunder: (Date.now() - t0) / 1000 });
  }
}

/// Varans bild, som data: — fönstret får aldrig själv kontakta butiken
/// (CSP:n släpper bara in data:-bilder), och bilden ska följa med samtalet
/// också när sidan är borta. Samma adresskontroll som allt annat, och en
/// rad i liggaren. Högst 350 kB; en större bild är inte värd det.
async function hamtaBild(sida, adress, { liggare } = {}) {
  const t0 = Date.now();
  let ok = false, storlek = 0;
  try {
    // Omdirigeringar följs för hand, och varje hopp prövas som det första.
    // Med maxRedirects hade en butiks bildadress kunnat skicka hämtningen
    // vidare till en intern adress utan att grinden såg det (säkerhets-
    // granskningen 2026-10-05).
    let r = null, url = adress;
    for (let hopp = 0; hopp < 4; hopp++) {
      if (!(await tillatenAdress(url)).ok) return null;
      r = await sida.request.get(url, { timeout: 8000, maxRedirects: 0 });
      if (![301, 302, 303, 307, 308].includes(r.status())) break;
      const vidare = r.headers().location;
      if (!vidare) return null;
      url = new URL(vidare, url).href;
      r = null;
    }
    if (!r) return null;
    const typ = (r.headers()['content-type'] || '').split(';')[0].trim();
    if (!r.ok() || !/^image\/(jpeg|png|webp|gif|avif)$/.test(typ)) return null;
    // Storleken före läsningen, när servern säger den.
    if (Number(r.headers()['content-length']) > 350_000) return null;
    const b = await r.body();
    storlek = b.length;
    if (b.length > 350_000) return null;
    ok = true;
    return `data:${typ};base64,${b.toString('base64')}`;
  } finally {
    await skrivLiggare(liggare, { frontier: tx('webb.liggare.bild'), vag: 'webb', skickat: adress,
      mottaget: ok ? tx('webb.liggare.bildKb', { kb: Math.round(storlek / 1024) }) : tx('webb.liggare.ingenBild'), tecken: adress.length,
      sekunder: (Date.now() - t0) / 1000 });
  }
}

/// En bild som data-adress (Fas 50: nyheternas OG-bilder). Samma grind som
/// allt annat: adressen prövas för varje hopp, bara bildtyper, högst 350 kB,
/// och hämtningen står i liggaren.
export async function bildSomData(adress, { liggare } = {}) {
  const c = await ctx();
  return hamtaBild(c, adress, { liggare });
}

export async function hamta(adress, { tecken = 12000, signal, liggare, spar = null, vara = false, dolt = false } = {}) {
  const t0 = Date.now();

  // Adressen prövas innan webbläsaren ens får se den.
  const grind = await tillatenAdress(adress);
  if (!grind.ok) {
    const e = new Error(tx('webb.hamtasInte', { skal: grind.skal }));
    e.webbfel = true;
    throw e;
  }

  let hamtat = '';
  const sida = spar ? await spar.nySida() : await (await ctx()).newPage();
  // Varje anrop sidan gör, inte bara det första.
  //
  // `goto` prövade ingenting, och sidans egna resurser och omdirigeringar
  // gick helt förbi kontrollen. Revisionen såg en fixtursida anropa
  // 127.0.0.1 med sitt eget JavaScript, och en spårpixel mot tredje part.
  // Liggaren såg tre av fem anrop.
  //
  // Här prövas allt, och allt räknas — också det som stoppas. Ett blockerat
  // försök är information: någon försökte.
  const anrop = { slappta: 0, stoppade: [] };
  await sida.route('**/*', async rutt => {
    const url = rutt.request().url();
    const g = await tillatenAdress(url);
    if (!g.ok) {
      if (anrop.stoppade.length < 20) anrop.stoppade.push(`${url.slice(0, 120)} (${g.skal})`);
      return rutt.abort();
    }
    anrop.slappta++;
    return rutt.continue();
  });

  try {
    await sida.goto(adress, { waitUntil: 'domcontentloaded', timeout: 25000 });
    // Samtyckesrutan ligger över allt annat och måste bort innan sidan går
    // att läsa. Ett klick på "godkänn" är vad en människa också gör.
    for (const v of SAMTYCKE) {
      const knapp = sida.locator(v).first();
      if (await knapp.count().catch(() => 0)) { await knapp.click({ timeout: 2500 }).catch(() => {}); break; }
    }
    await sida.waitForTimeout(600);
    // Varan, när frågan gäller något att köpa (2026-10-05, Auro: "förslag
    // med URL och gärna ... OG-bild"). Läses ur sidans egna märkningar —
    // og:-taggarna och schema.org-produkten — innan skripten rensas bort,
    // för JSON-LD ligger i en script-tagg.
    const varan = vara ? await sida.evaluate(() => {
      const meta = n => document.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.content || '';
      let pris = meta('product:price:amount') || meta('og:price:amount') || document.querySelector('[itemprop="price"]')?.getAttribute('content') || '';
      let valuta = meta('product:price:currency') || meta('og:price:currency') || document.querySelector('[itemprop="priceCurrency"]')?.getAttribute('content') || '';
      let bild = meta('og:image') || meta('twitter:image') || '';
      for (const sk of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const d = [JSON.parse(sk.textContent)].flat().flatMap(x => x['@graph'] || [x]);
          const p = d.find(x => /Product/i.test(String(x['@type'])));
          if (!p) continue;
          const o = [p.offers].flat()[0] || {};
          pris = pris || String(o.price ?? o.lowPrice ?? '');
          valuta = valuta || o.priceCurrency || '';
          bild = bild || [p.image].flat()[0]?.url || [p.image].flat()[0] || '';
        } catch { /* trasig JSON-LD: nästa */ }
      }
      return { bild: bild ? new URL(bild, location.href).href : '', pris, valuta,
        beskrivning: (meta('og:description') || meta('description')).slice(0, 240) };
    }).catch(() => null) : null;
    if (varan?.bild) varan.bilddata = await hamtaBild(sida, varan.bild, { liggare }).catch(() => null);
    // `dolt` (Fas 46): också text i dolda flikar. En eventsida lägger
    // talarna under "Speakers" och partners under "Partners", dolda tills
    // man klickar — och innerText läser bara det synliga. Då kom bara
    // översikten med, och djupdykningen hittade ingen enda person.
    const ut = await sida.evaluate(dolt => {
      for (const v of ['script', 'style', 'noscript', 'svg', 'nav', 'header', 'footer', 'aside', 'form', ...(dolt ? [] : ['[aria-hidden="true"]'])])
        document.querySelectorAll(v).forEach(n => n.remove());
      const huvud = (dolt ? null : document.querySelector('main, article, [role="main"], #content, .content')) || document.body;
      if (dolt) {
        // Ett block per rad, så att namn och titlar inte flyter ihop.
        for (const n of huvud.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, br, td, section, article')) n.append(document.createTextNode('\n'));
        return { titel: document.title || '', text: huvud.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim() };
      }
      return { titel: document.title || '', text: huvud.innerText.replace(/\n{3,}/g, '\n\n').trim() };
    }, dolt);
    const text = ut.text.slice(0, tecken);
    hamtat = text;
    return { url: sida.url(), titel: ut.titel, text, kapad: ut.text.length > tecken, ...(varan ? { vara: varan } : {}) };
  } finally {
    // Raden skrivs i finally, inte efter lyckad bearbetning.
    //
    // Den stod sist i try-blocket. Gick sidan att hämta men bearbetningen
    // sedan fel — en tom sida, ett fel i utläsningen, en avbruten körning —
    // skrevs ingen rad, fast trafiken redan lämnat datorn. Liggaren svarar på
    // frågan vad som HAR lämnat maskinen, inte vad som lämnat den och kom
    // tillbaka i användbart skick.
    //
    // Raden säger också hur många anrop sidan faktiskt gjorde. En sida är
    // inte ett anrop — den är så många den vill.
    await skrivLiggare(liggare, { frontier: tx('webb.liggare.hamtning'), vag: 'webb', skickat: adress,
      mottaget: hamtat.slice(0, 2000), tecken: adress.length, sekunder: (Date.now() - t0) / 1000,
      anrop: anrop.slappta, stoppade: anrop.stoppade.length || undefined,
      stoppadeMal: anrop.stoppade.length ? anrop.stoppade : undefined });
    await sida.close().catch(() => {});
  }
}
