// Språkstödet (2026-10-09). Maximus skrevs på svenska; engelska är det
// andra språket, och fler ska kunna läggas till utan att koden ändras.
// (lib/sprak.mjs är något annat: den skriver om appens exempel efter dig.)
//
// Auro: "system ska avgöra vilket språk som används och routa till det
// närmsta option som finns." Därför tre steg:
//
//   1. Ditt val, om du gjort ett (Inställningar → Du → Utseende → Språk).
//   2. Annars datorns språk — macOS lista över föredragna språk, i ordning.
//   3. Det närmaste som finns: exakt kod, sedan språket utan region, sedan
//      en släkting (norska och danska läses bäst på svenska), sist engelska.
//
// Texterna bor i public/sprak/<kod>.json, en nyckel per text. En nyckel som saknas
// i ett språk faller tillbaka på svenskan — aldrig på nyckeln själv, som
// ingen människa ska behöva läsa.
import { readFileSync, readdirSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

// Samma filer som webbläsaren läser: public/sprak/<kod>.json.
const HAR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sprak');
// Serverns egna texter (fas 3): lib/texter/<kod>/<område>.json. Felen i
// svaren, notiserna, liggarens rader, stegen, kvittona — det som servern
// säger och webbläsaren bara visar. En fil per område, så att två delar av
// koden inte skriver i samma fil; nycklarna får inte krocka med ytans.
export const SERVERTEXTER = join(dirname(fileURLToPath(import.meta.url)), 'texter');

/// Svenska är grunden: allt finns på svenska.
export const GRUND = 'sv';

/// Språken som finns, ur katalogen.
export function tillgangliga(katalog = HAR) {
  try { return readdirSync(katalog).filter(f => /^[a-z]{2}(-[A-Z]{2})?\.json$/.test(f)).map(f => f.replace('.json', '')); }
  catch { return [GRUND]; }
}

/// Släktingar: ett språk som saknas läses bäst på ett som finns.
export const SLAKT = { nb: 'sv', nn: 'sv', no: 'sv', da: 'sv', fo: 'sv', is: 'sv' };

/// Det närmaste språket för en lista av önskade (BCP 47: "sv-SE", "en-GB",
/// "nb"). Ren funktion.
export function narmast(onskade = [], finns = [GRUND, 'en'], { reserv = 'en' } = {}) {
  const har = new Set(finns);
  for (const o of [].concat(onskade).filter(Boolean)) {
    const kod = String(o).replace('_', '-');
    if (har.has(kod)) return kod;
    const bas = kod.split('-')[0].toLowerCase();
    if (har.has(bas)) return bas;
    if (SLAKT[bas] && har.has(SLAKT[bas])) return SLAKT[bas];
  }
  return har.has(reserv) ? reserv : GRUND;
}

/// macOS föredragna språk, i ordning. Utanför macOS: LANG.
export function datornsSprak() {
  // MAXIMUS_SPRAK styr datorns språk i prov: ett prov ska inte bero på
  // vilket språk maskinen det körs på råkar ha.
  if (process.env.MAXIMUS_SPRAK) return Promise.resolve([process.env.MAXIMUS_SPRAK]);
  if (process.platform !== 'darwin') return Promise.resolve([String(process.env.LANG || '').split('.')[0]].filter(Boolean));
  return new Promise(los => execFile('/usr/bin/defaults', ['read', '-g', 'AppleLanguages'], { timeout: 3000 }, (e, ut) =>
    los(e ? [] : [...String(ut).matchAll(/"?([a-z]{2,3}(?:-[A-Za-z]{2,4})*)"?/g)].map(m => m[1]))));
}

/// Språket som gäller: ditt val, annars datorns, annars det närmaste.
export async function valt(installning, { finns = tillgangliga() } = {}) {
  if (installning && installning !== 'auto') return narmast([installning], finns);
  return narmast(await datornsSprak(), finns);
}

// ── Texterna ─────────────────────────────────────────────────────────────

const lexikon = new Map();

/// Serverns texter på ett språk: alla filer i lib/texter/<kod>/, sammanslagna.
export function servertexter(kod, katalog = SERVERTEXTER) {
  const ut = {};
  let filer = [];
  try { filer = readdirSync(join(katalog, kod)).filter(f => f.endsWith('.json')).sort(); } catch { return ut; }
  for (const f of filer) Object.assign(ut, JSON.parse(readFileSync(join(katalog, kod, f), 'utf8')));
  return ut;
}

function las(kod, katalog = HAR) {
  if (!lexikon.has(kod)) {
    let yta = {};
    try { yta = JSON.parse(readFileSync(join(katalog, `${kod}.json`), 'utf8')); } catch { /* finns inte */ }
    lexikon.set(kod, { ...servertexter(kod), ...yta });
  }
  return lexikon.get(kod);
}

/// En text på ett språk, med {namn} ersatta. Pluralform: värdet är
/// { "en": "…", "flera": "…" } och väljs efter {n}. Saknas nyckeln faller den
/// tillbaka på svenskan; saknas den där också syns nyckeln — ett fel som
/// test/sprakstod.test.mjs fångar innan någon ser det.
export function text(kod, nyckel, varden = {}) {
  const t = las(kod)[nyckel] ?? las(GRUND)[nyckel] ?? nyckel;
  const mall = t && typeof t === 'object' ? (Number(varden.n) === 1 ? t.en ?? t.flera : t.flera ?? t.en) : t;
  return String(mall).replace(/\{(\w+)\}/g, (m, k) => (k in varden ? String(varden[k]) : m));
}

/// En text-funktion bunden till ett språk: `const t = tolk('en'); t('allmant.ja')`.
export const tolk = kod => (nyckel, varden) => text(kod, nyckel, varden);

/// Bara för prov: glöm det inlästa.
export const glom = () => lexikon.clear();

// ── Språket just nu (fas 3) ──────────────────────────────────────────────
//
// Servern vet vilket språk du har: installningar.sprak genom valt(), räknat
// en gång och sparat tills inställningen ändras. Varje anrop körs med sitt
// språk (AsyncLocalStorage), och det som körs utanför ett anrop —
// hjärtslaget, agenten, telefonen — läser det senast kända. Ska ett anrop
// ha ett annat språk sätter det sitt eget med med().
//
// Svenska tills något annat sagts: proven och v1 ser exakt samma text.

const anrop = new AsyncLocalStorage();
let senast = GRUND;
// Bytet räknas. En timer som startats i ett anrop (hjärtslaget ställs om
// i POST /api/installningar) bär anropets språk för alltid; efter ett
// språkbyte gäller det inte längre, och då läses det senast kända.
let byte = 0;

/// Språket som gäller här: anropets, annars det senast kända.
export function aktuellt() {
  const s = anrop.getStore();
  return s && s.byte === byte ? s.kod : senast;
}

/// Sätter det språk som gäller utanför anropen.
export function satt(kod) {
  kod ||= GRUND;
  if (kod !== senast) { senast = kod; byte++; }
  return senast;
}

/// Kör fn med ett språk. Allt fn väntar på ärver det.
export const med = (kod, fn) => anrop.run({ kod: kod || GRUND, byte }, fn);

/// En text på det språk som gäller: tx(nyckel, varden).
export const tx = (nyckel, varden) => text(aktuellt(), nyckel, varden);

/// Är det svenska som gäller? Prompterna är byte för byte v1:s på svenska.
export const svenska = (kod = aktuellt()) => kod === GRUND;

// valt() med minne: datorns språk läses ur macOS högst var femte minut, och
// ett uttryckligt val räknas utan att fråga datorn alls.
let datorn = null;
let datornNar = 0;
export async function valtCachat(installning, { finns = tillgangliga(), nu = Date.now() } = {}) {
  if (installning && installning !== 'auto') return satt(narmast([installning], finns));
  if (!datorn || nu - datornNar > 5 * 60_000) { datorn = await datornsSprak().catch(() => []); datornNar = nu; }
  return satt(narmast(datorn, finns));
}

// ── Modellens språk ──────────────────────────────────────────────────────
//
// Prompterna är skrivna på svenska och står kvar så: på svenska är de v1:s,
// byte för byte. På ett annat språk byts "på svenska" mot språkets namn, och
// en rad läggs till som säger att svaret ska komma på det språket — medan
// markörerna som koden läser (SLUTSATS:, PUNKTER:, utkast-blocket, JSON-
// nycklarna) står kvar exakt som de är skrivna. Markörerna är maskinens
// format, inte text till människor.

const SPRAKNAMN = { sv: 'svenska', en: 'engelska (English)' };

/// "på svenska" / "på engelska (English)".
export const paSprak = (kod = aktuellt()) => `på ${SPRAKNAMN[kod] || SPRAKNAMN.en}`;

/// Byter "på svenska" i en prompt mot språket som gäller. Svenska: orörd.
export function promptPa(prompt, kod = aktuellt()) {
  if (svenska(kod)) return prompt;
  return String(prompt).replace(/på svenska/g, paSprak(kod));
}

/// Raden som läggs sist i en systemprompt på ett annat språk än svenska.
/// Tom på svenska. `markorer`: de exakta markörer som ska stå kvar.
export function sprakrad(kod = aktuellt(), markorer = []) {
  if (svenska(kod)) return '';
  const m = markorer.length ? ` Keep these machine markers exactly as written, in Swedish, even though the rest is in English: ${markorer.join(', ')}.` : '';
  const rad = `LANGUAGE: The user writes in English. Write everything meant for the user in English.${m} JSON keys stay exactly as specified.`;
  if (RADER.size < 500) RADER.add(rad);
  return `\n\n${rad}`;
}

/// Varje språkrad som faktiskt skrivits, ordagrant. Molnets grind lyfter
/// undan Maximus egna rader före maskeringen, och bara de exakta: ett
/// mönster som "LANGUAGE: … JSON keys stay exactly as specified." hade
/// lyft undan allt du själv skrivit mellan orden (granskningen 2026-10-09).
const RADER = new Set();
export const sprakrader = () => [...RADER];

/// Prompt + språkrad, i ett. Svenska: orörd.
export const modellprompt = (prompt, { kod = aktuellt(), markorer = [] } = {}) =>
  svenska(kod) ? prompt : promptPa(prompt, kod) + sprakrad(kod, markorer);
