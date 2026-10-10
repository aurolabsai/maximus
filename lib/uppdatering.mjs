/// Uppdateringskanalen.
///
/// Det fanns ingen. En app som inte kan uppdatera sig är en engångsprodukt:
/// dagen ett fel hittas går det inte att rätta hos någon som redan
/// installerat, och dagen en modell blir bättre får ingen den.
///
/// ── Att det här är ett utgående anrop ────────────────────────────────────
///
/// MAXIMUS:s löfte är att ingenting lämnar datorn. Exakt två saker gjorde det
/// ändå: sökfrågor och modellnedladdningen (docs/security.md). Det här blir det
/// tredje, och det ska behandlas som de andra två — inte som ett undantag.
///
/// Alltså:
///
///   Det går att stänga av. En kontroll man inte kan stänga av är en
///   kontroll man inte valt.
///
///   Den bokförs i liggaren. Varje nyttolast som lämnar datorn står där, och
///   ett undantag "för att det bara är en versionskontroll" är ett undantag
///   som gör liggaren till en ungefärlig lista.
///
///   Den bär bara versionen och plattformen. Inget id, ingen licens, inget
///   som skiljer den här datorn från en annan. En kontroll som kan räkna
///   installationer är en kontroll som ringer hem, och den hade vi sagt nej
///   till på licenssidan av samma skäl.
///
/// ── Varför den inte installerar själv ────────────────────────────────────
///
/// Signaturkontrollen sköts av tauri-plugin-updater, som kräver ett
/// nyckelpar. Den privata nyckeln är utgivarens och får aldrig ligga i
/// källkoden. Tills den finns säger MAXIMUS att det finns en nyare version och
/// var den hämtas — se scripts/slapp.mjs, som ställer i ordning resten.
///
/// En uppdatering som installerar sig utan signaturkontroll vore en
/// bakdörr med ett vänligt gränssnitt.

import { natfel } from './natfel.mjs';
import { tx } from './sprakstod.mjs';

/// Jämför två versioner. Positivt om `a` är nyare.
///
/// Tar `4.0.0`, `4.0.1-rc.2` och `v4.1`. Förhandsversioner räknas som ÄLDRE
/// än samma version utan suffix — 4.1.0-rc.1 kommer före 4.1.0, vilket är
/// vad suffixet betyder.
export function jamfor(a, b) {
  const dela = v => {
    const [tal, fore = ''] = String(v || '').replace(/^v/i, '').split('-');
    return { tal: tal.split('.').map(n => Number(n) || 0), fore };
  };
  const x = dela(a), y = dela(b);
  for (let i = 0; i < 3; i++) {
    const d = (x.tal[i] || 0) - (y.tal[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  if (x.fore === y.fore) return 0;
  // Utan suffix är nyare än med. Tom sträng vinner.
  if (!x.fore) return 1;
  if (!y.fore) return -1;
  return x.fore > y.fore ? 1 : -1;
}

/// Plattformsnyckeln i manifestet, som tauri-plugin-updater skriver den.
export function plattform(process_ = process) {
  const os = { darwin: 'darwin', win32: 'windows', linux: 'linux' }[process_.platform] || process_.platform;
  const arch = { arm64: 'aarch64', x64: 'x86_64' }[process_.arch] || process_.arch;
  return `${os}-${arch}`;
}

/// Vad en kontroll skickade. Går till liggaren.
export const nyttolast = (version, plats) =>
  tx('uppdatering.nyttolast', { version, plats });

/// Finns det något nyare?
///
/// `hamtaJson` är inlagd som argument för att provet ska kunna svara utan
/// nät. Ett prov som når ut är ett prov som fallerar när nätet gör det.
export async function kolla(adress, { version, plats = plattform(), hamtaJson, signal } = {}) {
  if (!adress) return { av: true };
  const t0 = Date.now();
  const hamta = hamtaJson || (async url => {
    const r = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(tx('uppdatering.svarade', { status: r.status }));
    return r.json();
  });

  let m;
  try {
    m = await hamta(adress);
  } catch (e) {
    // Ett misslyckat anrop är också ett anrop. Det ska bokföras, annars
    // betyder frånvaron av en rad inte frånvaro av trafik.
    //
    // "fetch failed" säger ingenting åt den som läser. Samma klagomål som
    // lib/lokal.mjs redan har om "terminated": ett fel som bara namnger
    // anropsfunktionen är ett fel man inte kan göra något åt.
    return { fel: natfel(e, tx('uppdatering.servern')), ms: Date.now() - t0, skickat: nyttolast(version, plats) };
  }

  const senaste = String(m?.version || '');
  const nyare = Boolean(senaste) && jamfor(senaste, version) > 0;
  return {
    ms: Date.now() - t0,
    skickat: nyttolast(version, plats),
    // `senaste` och inte `version`: anroparen har redan en `version` — den
    // som körs — och två fält med samma namn för två olika saker blir förr
    // eller senare ett fält som skriver över det andra.
    senaste: senaste || null,
    nyare,
    om: String(m?.notes || '').slice(0, 8000) || null,
    tid: m?.pub_date || null,
    // Adressen till just den här plattformens fil. Saknas den finns ingen
    // byggd version för den här datorn, och det är inte samma sak som att
    // det inte finns en uppdatering.
    url: m?.platforms?.[plats]?.url || null,
    signerad: Boolean(m?.platforms?.[plats]?.signature),
  };
}
