/// Vägen ut: hur MAXIMUS:s uppslag lämnar datorn.
///
/// Maskeringen döljer VAD du frågar. Den döljer inte VEM som frågar.
/// Sökmotorn ser din IP-adress, och för den som frågar om oegentligheter hos
/// sin egen arbetsgivare är adressen hela läckan — frågan kan vara aldrig så
/// anonym när den kommer från företagets nät.
///
/// Alltså ett val av väg, och bara för uppslagen. Den lokala modellen berörs
/// aldrig; den ligger på datorn. En stor modell går sin egen väg, för där är
/// du inloggad ändå och en proxy döljer ingenting.
///
/// ── Tre vägar ────────────────────────────────────────────────────────────
///
///   direkt — som vanligt, din egen uppkoppling.
///   proxy  — en SOCKS5- eller HTTP-proxy du pekar ut. Mullvad och NordVPN
///            har sådana, liksom de flesta företagsnät.
///   tor    — Tor på datorn, 127.0.0.1:9050. Gratis, inget konto.
///
/// ── Varför inte slå på VPN åt användaren ─────────────────────────────────
///
/// För att ett VPN lägger om HELA datorns trafik, och det är inte MAXIMUS:s sak
/// att bestämma. NordVPN har ingen officiell CLI på macOS heller — appen
/// styrs inte utifrån. En proxy för just uppslagen är mindre, ärligare och
/// går att kontrollera: man ser vilken adress som syns på andra sidan.
///
/// ── Varför provet går genom webbläsaren ──────────────────────────────────
///
/// Nodes fetch talar inte SOCKS5 utan ett paket till. Men webbläsaren gör
/// det, och det är ändå den som hämtar sidorna — ett prov som tar en annan
/// väg än sökningarna bevisar fel sak.

import { tx } from './sprakstod.mjs';

export const VAGAR = {
  direkt: {
    get namn() { return tx('lib.vag.direkt.namn'); },
    get om() { return tx('lib.vag.direkt.om'); },
  },
  proxy: {
    namn: 'Proxy',
    get om() { return tx('lib.vag.proxy.om'); },
    get krav() { return tx('lib.vag.proxy.krav'); },
  },
  tor: {
    namn: 'Tor',
    get om() { return tx('lib.vag.tor.om'); },
    get krav() { return tx('lib.vag.tor.krav'); },
    adress: 'socks5://127.0.0.1:9050',
  },
};

/// Proxyn som Playwright vill ha den, eller null för direkt väg.
///
/// Playwright tar `socks5://`, `http://` och `https://`. Lösenord skickas
/// som egna fält och hamnar aldrig i adressen — en adress kan råka loggas.
export function proxyFor(val = {}) {
  const sort = val.vag || 'direkt';
  if (sort === 'direkt') return null;
  const adress = String(sort === 'tor' ? VAGAR.tor.adress : val.adress || '').trim();
  if (!adress) return null;
  let u;
  try { u = new URL(adress); } catch { return null; }
  if (!/^(socks5|socks4|http|https):$/.test(u.protocol)) return null;
  const ut = { server: `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}` };
  // Uppgifterna kan stå i adressen; de flyttas ut ur den.
  const anv = val.anvandare || decodeURIComponent(u.username || '');
  const los = val.losenord || decodeURIComponent(u.password || '');
  if (anv) ut.username = anv;
  if (los) ut.password = los;
  return ut;
}

/// Vägen, prövad. Skiljer "ingen proxy" från "trasig proxy".
///
/// `proxyFor()` returnerar null för båda, och null betyder direkt väg. En
/// vald proxy med en adress som inte går att tolka blev därmed direkttrafik
/// — tyst, utan fel, utan en rad någonstans.
///
/// Revisionen 2026-09-28 (M6) skickade `{vag:'proxy', adress:'invalid'}` och
/// fick `proxy: null`. Den som satt en proxy för att trafiken inte skulle gå
/// från det egna nätet fick den att göra just det, och ingenting sa ifrån.
///
/// Det är den farligaste sortens fel: skyddet finns i inställningarna, syns
/// i gränssnittet, och gäller inte. Ett krav som tyst faller tillbaka på
/// motsatsen är värre än inget krav — då hade användaren vetat.
///
/// Fail closed: väljer någon en väg ut ska den vägen användas, eller
/// ingenting alls.
export function granskaVag(val = {}) {
  const sort = val.vag || 'direkt';
  if (sort === 'direkt') return { ok: true, proxy: null, sort };
  if (!VAGAR[sort]) return { ok: false, proxy: null, sort, fel: tx('lib.vag.okand', { sort }) };

  const adress = String(sort === 'tor' ? VAGAR.tor.adress : val.adress || '').trim();
  if (!adress) return { ok: false, proxy: null, sort, fel: tx('lib.vag.ingenAdress', { namn: VAGAR[sort].namn }) };

  let u;
  try { u = new URL(adress); }
  catch { return { ok: false, proxy: null, sort, fel: tx('lib.vag.tolka', { namn: VAGAR[sort].namn, adress: visaAdress(val) }) }; }
  if (!/^(socks5|socks4|http|https):$/.test(u.protocol)) {
    return { ok: false, proxy: null, sort,
      fel: tx('lib.vag.proxytyp', { typ: u.protocol.replace(':', '') }) };
  }
  const proxy = proxyFor(val);
  if (!proxy) return { ok: false, proxy: null, sort, fel: tx('lib.vag.sattaUpp', { adress: visaAdress(val) }) };
  return { ok: true, proxy, sort };
}

/// Kastar om trafiken inte kan följa den valda vägen.
///
/// Webbläsaren tar en proxy; Nodes inbyggda `fetch` gör det inte. Den här
/// byggnaden har varken `undici` eller en inbyggd flagga för det, och MAXIMUS
/// har ett körtidsberoende och ska ha ett.
///
/// Alternativen var alltså att skicka direkt ändå eller att inte skicka.
/// Att skicka direkt vore att bryta det enda löfte inställningen ger —
/// särskilt för frontier-anropet, som bär själva nyttolasten. Den som satt
/// en väg ut gjorde det för att trafiken inte skulle gå från det egna nätet.
///
/// Alltså: fel, med skälet. Ett fel går att förstå och åtgärda. En tyst
/// sändning på fel väg upptäcks aldrig.
export function kravDirekt(val = {}, vad = tx('lib.vag.detHarAnropet')) {
  const sort = val?.vag || 'direkt';
  if (sort === 'direkt') return;
  const namn = VAGAR[sort]?.namn || sort;
  const e = new Error(tx('lib.vag.kravDirekt', { vad, namn }));
  e.vagfel = true;
  throw e;
}

/// Adressen som den får visas: aldrig med lösenord.
export const visaAdress = (val = {}) => {
  const sort = val.vag || 'direkt';
  if (sort === 'direkt') return tx('lib.vag.dinEgen');
  if (sort === 'tor') return VAGAR.tor.adress;
  try {
    const u = new URL(String(val.adress || ''));
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
  } catch { return String(val.adress || '').slice(0, 60); }
};

const SVAR = /"ip"\s*:\s*"([^"]+)"/i;
const LAND = /"country"\s*:\s*"([^"]+)"/i;
const ARTOR = /"IsTor"\s*:\s*(true|false)/i;

/// Provar vägen och säger vilken adress som syns på andra sidan.
///
/// Det här är hela poängen: ett påstående om att trafiken går någon annanstans
/// är värdelöst om det inte går att se. Provet öppnar en egen webbläsare med
/// proxyn, hämtar två sidor som säger vad de ser, och stänger den.
///
/// `startaWebblasare` skickas in i stället för att importeras, så att den här
/// filen inte drar in Playwright i varje test som råkar läsa den.
export async function prova(val, { startaWebblasare, timeout = 25000 } = {}) {
  // Vägen prövas INNAN webbläsaren startas.
  //
  // Här stod `proxyFor(val)`, vars null betyder direkt väg. Revisionen
  // 2026-09-29 (M7) provade `{vag:'proxy', adress:'invalid'}`: webbläsaren
  // startades med proxy null, två sidor hämtades direkt, och provet svarade
  // **ok: true, vag: 'proxy'**.
  //
  // Det är den värsta sortens fel i just den här knappen. Knappen finns för
  // att svara på frågan "går trafiken verkligen den väg jag valt", och den
  // svarade ja när svaret var nej — samtidigt som den röjde den direkta
  // adressen den skulle dölja.
  const vagval = granskaVag(val);
  if (!vagval.ok) {
    return { ok: false, vag: val?.vag || 'direkt', fel: vagval.fel, ms: 0 };
  }
  const proxy = vagval.proxy;
  const t0 = Date.now();
  let b = null;
  try {
    b = await startaWebblasare(proxy);
    const sida = await b.newPage();
    // ifconfig.co säger adress och land, check.torproject.org säger om det
    // faktiskt ÄR Tor — en proxy som påstår sig vara Tor men inte är det är
    // värre än ingen proxy alls.
    const las = async url => {
      const r = await sida.goto(url, { waitUntil: 'domcontentloaded', timeout });
      return (await sida.content()).slice(0, 4000);
    };
    const a = await las('https://ifconfig.co/json');
    const ip = SVAR.exec(a)?.[1] || null;
    const land = LAND.exec(a)?.[1] || null;
    let tor = null;
    try { tor = ARTOR.exec(await las('https://check.torproject.org/api/ip'))?.[1] === 'true'; }
    catch { /* frågan om Tor är en bonus, inte ett krav */ }
    return {
      ok: Boolean(ip), ip, land, tor,
      sekunder: Math.round((Date.now() - t0) / 100) / 10,
      vag: val.vag || 'direkt', adress: visaAdress(val),
    };
  } catch (e) {
    return { ok: false, fel: e.message.split('\n')[0].slice(0, 160),
      vag: val.vag || 'direkt', adress: visaAdress(val),
      sekunder: Math.round((Date.now() - t0) / 100) / 10 };
  } finally {
    if (b) await b.close?.().catch(() => {});
  }
}

/// Är Tor igång på datorn?
///
/// En ren tcp-anslutning, inget mer. Att fråga Tor om något innan vi vet att
/// den finns ger ett trettio sekunders timeout i stället för ett svar.
export async function torLever({ timeout = 1200 } = {}) {
  const { connect } = await import('node:net');
  return new Promise(klar => {
    const s = connect({ host: '127.0.0.1', port: 9050 });
    const av = ok => { try { s.destroy(); } catch { /* redan stängd */ } klar(ok); };
    s.setTimeout(timeout, () => av(false));
    s.on('connect', () => av(true));
    s.on('error', () => av(false));
  });
}
