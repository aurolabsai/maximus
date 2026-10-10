/// Felrapporten: "det här fungerar inte" blir en rapport du läst innan den går.
///
/// Ingen GitHub-inloggning, ingen blankett, ingen telemetri. Det som går ut
/// är texten du själv godkänt i förhandsvisningen, byte för byte, och en
/// e-postadress om du skrev en. Inget annat följer med automatiskt: inget
/// samtal, inget dokument, ingen skärmbild, ingen sökväg.
///
/// Tre regler bär hela modulen:
///
/// 1. Överföringen är en appfunktion bakom en knapp. Den är inget verktyg —
///    ingen modell och ingen agent kan anropa den, och inget i ett samtal, ett
///    dokument eller en hämtad sida kan utlösa den. Den enda vägen in är
///    `skicka()` här, och den anropas bara från `/api/felrapport/skicka`.
/// 2. Det granskade utkastet ändras inte tyst. Klienten fryser texten när du
///    trycker på knappen och skickar den med sin SHA-256; här räknas hashen om,
///    och stämmer den inte skickas ingenting. Hittar maskeringen något nytt
///    i en redigerad text går den tillbaka till dig i stället för ut.
/// 3. Kvitto först när mottagaren sagt ja, med ett rapportnummer. Ett nätfel
///    lämnar utkastet kvar på datorn; inget skickas i bakgrunden när nätet
///    kommer tillbaka. Det finns inga timrar i den här filen.
///
/// Så länge ingen mottagare är konfigurerad (MAXIMUS_RAPPORTER, tom som
/// förval) finns bara Kopiera och Spara i ytan, och `skicka()` vägrar.
import { createHash, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { hostname, userInfo, platform, arch } from 'node:os';

import { utatGrind } from './failclosed.mjs';
import { granska } from './maskering.mjs';
import { tx } from './sprakstod.mjs';

/// Största paket som skickas: text och e-post, i byte. En rapport som behöver
/// mer är en rapport med en inklistrad logg, och loggar följer inte med.
export const TAK = 16_384;

/// Hur länge överföringen får ta innan den räknas som misslyckad.
export const TIDSGRANS = 15_000;

/// Arbetsbeviset mottagaren kräver: så många inledande nollbitar i
/// SHA-256(nyckel:texthash:bevis). Omkring en kvarts miljon försök, under en
/// sekund här, och lika mycket för den som vill skicka tusen rapporter.
export const SVARIGHET = 18;

/// Funktionerna man kan peka ut. Fast lista: berörd funktion ska komma från
/// appen eller ditt val, aldrig från modellens gissning.
export const FUNKTIONER = ['samtal', 'hjalp', 'agenten', 'uppdrag', 'dokument', 'mote', 'installningar', 'skickat', 'start', 'annat'];

const EPOST = /^[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{2,}$/;

// ── Det som lämnar datorn får inte bära datorn ──────────────────────────────

/// Mönster som utatGrind inte har: sådant som pekar ut en dator snarare än en
/// människa. Ordningen spelar roll — nycklar före långa koder, så att en
/// nyckel blir en nyckel och inte en kod.
const DATORMONSTER = [
  ['nyckel', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g],
  ['nyckel', /\b(?:sk-(?:proj-|or-v1-|ant-)?[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abpr]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}|hf_[A-Za-z0-9]{20,}|vk_[\w-]{16,})/g],
  ['nyckel', /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi],
  ['nyckel', /\b(?:api[_ -]?key|apinyckel|token|secret|hemlighet|password|passwd|lösenord|losenord)\b(\s*[:=]\s*)["']?[^\s"']{4,}["']?/gi],
  ['sokvag', /(?:~|\/Users|\/home|\/Volumes|\/private\/var|\/var\/folders)\/[^\s"'<>)\]]*/g],
  ['sokvag', /\b[A-Za-z]:\\(?:Users|Documents and Settings)\\[^\s"'<>]*/g],
  ['id', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi],
  ['ip', /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  ['ip', /\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/gi],
  // Långa slumpsträngar: hashar, nycklar utan känt prefix, kakor.
  ['kod', /\b(?=[A-Za-z0-9_+/=-]*\d)(?=[A-Za-z0-9_+/=-]*[A-Za-z])[A-Za-z0-9_+/=-]{32,}\b/g],
  // Serienummer: tio till fjorton versaler och siffror blandat (Apples form).
  ['kod', /\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{10,14}\b/g],
];

const etikett = sort => `[${tx(`srv.felrapport.dolt.${sort}`)}]`;
const flyRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/// Datorns egna namn: användarnamnet och datornamnet, som de faktiskt är.
/// Läses här och ingen annanstans, och bara för att kunna stryka dem.
///
/// Förvalda namn pekar inte ut någon och är vanliga ord: "min Mac kraschade"
/// ska inte bli "min [ANVÄNDARNAMN] kraschade".
const ALLMANNA = /^(?:mac|admin|administrator|user|guest|root|home|mac-?(?:book|mini|studio|pro)(?:-(?:pro|air))?|imac|localhost)(?:-\d+)?$/i;
function egnaNamn() {
  const ut = [];
  try { const u = userInfo().username; if (u && u.length >= 3 && !ALLMANNA.test(u)) ut.push(['anvandare', u]); } catch { /* ingen användare */ }
  try {
    const h = hostname().replace(/\.(local|lan|home)$/i, '');
    if (h && h.length >= 3 && !ALLMANNA.test(h)) ut.push(['dator', h]);
  } catch { /* inget namn */ }
  return ut;
}

/// Rensar en text före förhandsvisningen.
///
/// Datorns spår först (sökvägar, nycklar, användar- och datornamn), sedan
/// samma utgående grind som allt annat som lämnar datorn: namn,
/// personnummer, telefon, e-post. Maskering är ett skydd, inte en garanti,
/// och ytan säger det; därför går texten alltid genom en förhandsvisning.
///
/// `dolda` är hur många ställen som ändrades — det står i förhandsvisningen.
export function rensa(text, { egna = egnaNamn() } = {}) {
  let ut = String(text ?? '').replace(/\r\n?/g, '\n');
  let dolda = 0;
  for (const [sort, re] of DATORMONSTER) {
    ut = ut.replace(re, (traff, mellan) => {
      dolda++;
      // "lösenord: hemligt" behåller ordet; det är värdet som ska bort.
      if (sort === 'nyckel' && typeof mellan === 'string' && /[:=]/.test(mellan)) return traff.slice(0, traff.indexOf(mellan) + mellan.length) + etikett(sort);
      return etikett(sort);
    });
  }
  // Namnen efter mönstren: en sökväg med användarnamnet i ska bli en
  // sökväg, inte en halv sökväg runt ett namn.
  for (const [sort, namn] of egna) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${flyRe(namn)}(?![\\p{L}\\p{N}])`, 'giu');
    ut = ut.replace(re, () => { dolda++; return etikett(sort); });
  }
  const karta = new Map();
  ut = utatGrind(ut, { karta });
  dolda += karta.size;
  // Fail closed: står något identitetslikt kvar efter grinden går texten
  // inte vidare. Grinden maskerar själv det efterkontrollen hittar, så det
  // här ska aldrig hända — och gör det något, ska det märkas.
  const kvar = granska(ut);
  if (kvar.length) {
    const e = new Error(tx('srv.felrapport.fel.kvar'));
    e.status = 422;
    throw e;
  }
  return { text: ut, dolda };
}

// ── Teknisk information: ur appen och datorn, aldrig ur modellen ─────────────

const kor = (fil, arg) => new Promise(los => {
  execFile(fil, arg, { timeout: 2000 }, (fel, ut) => los(fel ? '' : String(ut).trim()));
});

/// Chipfamiljen, inte modellen: "Apple M2 Pro" blir "Apple M2". Familjen
/// räcker för att återskapa ett fel och pekar ut färre datorer.
export function chipfamilj(marke) {
  const s = String(marke || '');
  const m = /Apple (M\d+)/.exec(s);
  if (m) return `Apple ${m[1]}`;
  if (/Intel/i.test(s)) return 'Intel';
  return s ? s.split(/\s+/)[0].slice(0, 20) : '';
}

let tekniskCache = null;

/// Appversion, macOS-version, chipfamilj. Läses en gång per körning.
///
/// Inget serienummer, inget datornamn, ingen modellbeteckning. Det som
/// saknas står inte med, i stället för att gissas.
export async function tekniskt({ version, las = kor, os = platform() } = {}) {
  if (tekniskCache && !las.prov) return { ...tekniskCache, appversion: version };
  const macos = os === 'darwin' ? await las('/usr/bin/sw_vers', ['-productVersion']) : '';
  const marke = os === 'darwin' ? await las('/usr/sbin/sysctl', ['-n', 'machdep.cpu.brand_string']) : '';
  const ut = {
    appversion: version,
    macos: /^\d+(\.\d+){0,2}$/.test(macos) ? macos : '',
    chip: chipfamilj(marke) || (os === 'darwin' && arch() === 'arm64' ? 'Apple' : ''),
  };
  if (!las.prov) tekniskCache = ut;
  return ut;
}

/// Raderna i förhandsvisningen, var för sig valbara.
export function teknikrader(teknik, funktion) {
  const rader = [];
  if (teknik?.appversion) rader.push({ id: 'appversion', rad: tx('srv.felrapport.rad.appversion', { v: teknik.appversion }) });
  if (teknik?.macos) rader.push({ id: 'macos', rad: tx('srv.felrapport.rad.macos', { v: teknik.macos }) });
  if (teknik?.chip) rader.push({ id: 'chip', rad: tx('srv.felrapport.rad.chip', { v: teknik.chip }) });
  if (FUNKTIONER.includes(funktion)) rader.push({ id: 'funktion', rad: tx('srv.felrapport.rad.funktion', { v: tx(`srv.felrapport.funktion.${funktion}`) }) });
  return rader;
}

/// Utkastet, på enkel svenska eller engelska.
///
/// Användarens egna ord, rensade, under två rubriker. Ingen orsak, inget steg
/// och ingen logg läggs till: det som inte sagts står inte där.
export function utkast({ vad = '', istallet = '', funktion = '', teknik = null } = {}) {
  const v = rensa(String(vad).trim().slice(0, 4000));
  const i = rensa(String(istallet).trim().slice(0, 4000));
  const delar = [];
  if (v.text) delar.push(`${tx('srv.felrapport.rubrik.vad')}\n${v.text}`);
  if (i.text) delar.push(`${tx('srv.felrapport.rubrik.istallet')}\n${i.text}`);
  const rader = teknikrader(teknik, funktion);
  return {
    text: delar.join('\n\n'),
    teknikrubrik: tx('srv.felrapport.rubrik.teknik'),
    rader,
    dolda: v.dolda + i.dolda,
  };
}

// ── Paketet ──────────────────────────────────────────────────────────────────

/// Paketet som det godkändes: texten och e-posten, i en bestämd form.
/// Klienten räknar samma hash över samma sträng (public/felrapport.js).
export const paket = ({ text, epost = '' }) => JSON.stringify({ text: String(text ?? ''), epost: String(epost ?? '') });
export const hashAv = p => createHash('sha256').update(typeof p === 'string' ? p : paket(p)).digest('hex');

export const giltigEpost = e => e === '' || (typeof e === 'string' && e.length <= 200 && EPOST.test(e));

const fel = (sort, status, extra = {}) => Object.assign(new Error(tx(`srv.felrapport.fel.${sort}`)), { sort, status, ...extra });

/// Prövar ett godkänt paket utan att röra nätet.
export function prova({ text, epost = '', hash }) {
  if (typeof text !== 'string' || !text.trim()) throw fel('tom', 422);
  if (!giltigEpost(epost)) throw fel('epost', 422);
  if (Buffer.byteLength(paket({ text, epost })) > TAK) throw fel('stor', 413);
  // Stämmer inte hashen har texten ändrats efter godkännandet, någonstans
  // mellan knappen och hit. Då går ingenting.
  if (typeof hash !== 'string' || hash !== hashAv({ text, epost })) throw fel('andrad', 409);
  // En redigerad text maskeras om. Ändras den av det, går den tillbaka för
  // en ny granskning — aldrig ut i en form du inte sett.
  const r = rensa(text);
  if (r.text !== text) throw fel('omaskerat', 409, { text: r.text, dolda: r.dolda });
}

const nollbitar = buf => {
  let n = 0;
  for (const b of buf) { if (b === 0) { n += 8; continue; } n += Math.clz32(b) - 24; break; }
  return n;
};

/// Hur länge en idempotensnyckel gäller hos mottagaren, i dagar. Nyckeln bär
/// sin tid (`tid`, bunden i beviset), och mottagaren avvisar äldre nycklar —
/// så att en raderad rapport inte kan återskapas när mottagarens minne av
/// raderingen (gravstenen) väl gallrats. Appen byter nyckel i god tid före.
export const NYCKEL_DAGAR = 30;
const NYCKEL_SLUT = (NYCKEL_DAGAR - 5) * 86400;

/// Arbetsbeviset. I bitar om tjugotusen försök, så att servern svarar
/// under tiden. `nyckel` är `<uuid>:<tid>`: tiden kan inte ändras utan nytt bevis.
export async function bevisa(nyckel, text, svarighet = SVARIGHET) {
  const th = createHash('sha256').update(text).digest('hex');
  for (let b = 0; ; b++) {
    if (nollbitar(createHash('sha256').update(`${nyckel}:${th}:${b}`).digest()) >= svarighet) return b;
    if (b % 20000 === 19999) await new Promise(r => setImmediate(r));
  }
}
export const giltigtBevis = (nyckel, text, bevis, svarighet = SVARIGHET) =>
  Number.isSafeInteger(bevis) && bevis >= 0
  && nollbitar(createHash('sha256').update(`${nyckel}:${createHash('sha256').update(text).digest('hex')}:${bevis}`).digest()) >= svarighet;

/// En överföring. Kvittot är mottagarens svar, och bara ett 2xx med ett
/// rapportnummer är ett kvitto — allt annat är ett fel som säger vad det var.
export async function overfor(adress, kropp, { hamta = fetch, tidsgrans = TIDSGRANS } = {}) {
  const kontroll = new AbortController();
  const tid = setTimeout(() => kontroll.abort(new Error('timeout')), tidsgrans);
  let r;
  try {
    r = await hamta(adress, {
      method: 'POST', signal: kontroll.signal, redirect: 'error',
      headers: { 'content-type': 'application/json', 'idempotency-key': kropp.nyckel },
      body: JSON.stringify(kropp),
    });
  } catch (e) {
    // Nådde anropet aldrig fram (ingen adress, vägrad anslutning) vet vi att
    // mottagaren inte har rapporten. Allt annat — tidsgräns, en anslutning som
    // bröts — kan ha kommit fram utan att svaret gjorde det.
    const kod = e?.cause?.code || e?.code || '';
    const framme = kontroll.signal.aborted || !/^(ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|CERT_|UNABLE_TO|ERR_TLS)/.test(kod);
    throw fel(kontroll.signal.aborted ? 'tid' : 'nat', 503, { orsak: String(e?.message || e).slice(0, 160), kanskeFramme: framme });
  } finally { clearTimeout(tid); }
  const svar = await r.json().catch(() => null);
  // 410: mottagaren har raderat rapporten, eller nyckeln är för gammal.
  if (r.status === 410) throw fel(svar?.sort === 'gammal' ? 'gammal' : 'raderadHos', 409, { kod: 410 });
  // Ett 4xx är ett nej till just den här kroppen: inget sparades. Ett 5xx kan
  // ha sparat och fallerat efteråt.
  if (!r.ok) throw fel(r.status === 429 ? 'takt' : 'avvisad', 502, { kod: r.status, kanskeFramme: r.status >= 500 });
  const nummer = typeof svar?.nummer === 'string' && /^[A-Z0-9-]{4,40}$/.test(svar.nummer) ? svar.nummer : null;
  if (!nummer) throw fel('ingetNummer', 502, { kod: r.status, kanskeFramme: true });
  return {
    nummer,
    raderingskod: typeof svar.raderingskod === 'string' ? svar.raderingskod.slice(0, 80) : null,
    sparasTill: typeof svar.sparas_till === 'string' ? svar.sparas_till.slice(0, 40) : null,
    mottaget: new Date().toISOString(),
  };
}

// ── E-postvägen: så länge ingen mottagare är driftsatt ───────────────────────
//
// Ingenting skickas härifrån. Mail får ett nytt, SYNLIGT mejl med mottagare,
// ämne och exakt den godkända texten, och det är du som trycker Skicka. Det
// finns inget `send` i skriptet, och ett prov ser efter det. Svarar inte
// Mail öppnas en mailto:-länk i det e-postprogram systemet valt, och hela
// texten läggs på urklippet — en mailto kan kortas av på vägen.

/// AppleScript-strängar: bakstreck och citattecken, inget annat behövs.
const as = v => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/// Skriptet som öppnar mejlet. Bara `make new outgoing message`, `visible:true`
/// och `activate` — aldrig `send`, aldrig `save` till en annan brevlåda.
export function mejlskript({ till, amne, text }) {
  return [
    'tell application "Mail"',
    `\tset m to make new outgoing message with properties {subject:${as(amne)}, content:${as(text)}, visible:true}`,
    `\ttell m to make new to recipient at end of to recipients with properties {address:${as(till)}}`,
    '\tactivate',
    'end tell',
  ].join('\n');
}

/// Hur lång en mailto-länk får bli innan texten kortas. Gränsen hos
/// e-postprogrammen varierar; kortare är säkrare.
export const MAILTO_TAK = 1800;

export function mailto({ till, amne, text }) {
  let kropp = String(text);
  let avkortad = false;
  const lank = k => `mailto:${encodeURIComponent(till).replace(/%40/g, '@')}?subject=${encodeURIComponent(amne)}&body=${encodeURIComponent(k)}`;
  while (lank(kropp).length > MAILTO_TAK && kropp.length > 0) { kropp = kropp.slice(0, Math.floor(kropp.length * 0.8)); avkortad = true; }
  if (avkortad) kropp = `${kropp.trimEnd()}\n[…]`;
  return { adress: lank(kropp), avkortad };
}

const korFil = (fil, arg, { indata, tid = 20000 } = {}) => new Promise((klar, fel) => {
  const b = spawn(fil, arg, { stdio: [indata === undefined ? 'ignore' : 'pipe', 'ignore', 'pipe'] });
  let err = '';
  const t = setTimeout(() => { b.kill(); fel(new Error('timeout')); }, tid);
  b.stderr.on('data', d => { err += d; });
  b.on('error', e => { clearTimeout(t); fel(e); });
  b.on('close', kod => { clearTimeout(t); kod === 0 ? klar() : fel(new Error(err.trim().slice(0, 200) || `kod ${kod}`)); });
  if (indata !== undefined) b.stdin.end(indata);
});

/// Det riktiga lagret mot datorn. Proven byter ut det.
export const MACLAGER = {
  mail: skript => korFil('/usr/bin/osascript', ['-e', skript]),
  oppna: adress => korFil('/usr/bin/open', [adress]),
  urklipp: text => korFil('/usr/bin/pbcopy', [], { indata: text }),
};

/// Öppnar mejlet. Anropas bara med ett godkänt paket (prova()).
/// Svarar med vilken väg som användes, aldrig med att något skickats.
export async function oppnaMejl({ text, hash, till, amne }, { lager = MACLAGER } = {}) {
  prova({ text, epost: '', hash });
  if (!EPOST.test(String(till || ''))) throw fel('epost', 422);
  try {
    await lager.mail(mejlskript({ till, amne, text }));
    return { vag: 'mail', till };
  } catch {
    const m = mailto({ till, amne, text });
    await lager.urklipp(text).catch(() => {});
    await lager.oppna(m.adress);
    return { vag: 'mailto', till, avkortad: m.avkortad };
  }
}

/// Rapporterna på den här datorn: godkända utkast, utkast som väntar och kvitton.
///
/// `lagring` läser och skriver ett objekt (krypterat i servern som allt
/// annat). `liggare` får en rad per försök — ett försök är trafik vare sig det
/// lyckades eller ej, och raden bär exakt kroppen som gick ut.
///
/// Godkännandet och sändningen är två steg (granskningen 2026-10-10): paketet
/// fryses HÄR vid godkännandet, och `skicka` tar bara hashen. Varje post bär
/// sin ägare (den som frågar enligt servern); var och en ser, skickar och
/// slänger bara sina egna.
///
/// En rapport skickas en gång (granskningen 2026-10-10, andra varvet):
/// - Fick den kvitto, eller säger mottagaren att den raderats, hamnar hashen i
///   `skickade`, som överlever att posten själv rensas ut. Samma text kan
///   inte godkännas igen; en ny rapport kräver en ny text.
/// - Nyckeln byts aldrig tyst. Blir den för gammal stannar sändningen
///   (`utgangen`), och bara ett nytt godkännande ger en ny nyckel — och bara
///   för ett utkast som säkert aldrig nått mottagaren. Kan ett försök ha kommit
///   fram (tidsgräns, bruten anslutning, 5xx) stängs utkastet i stället: en ny
///   nyckel hade kunnat bli en andra rapport.
///
/// Inga timrar och inget återförsök: ett misslyckat utkast ligger kvar tills
/// du trycker igen eller slänger det.
export function rapportor({ lagring, adress = '', hamta = fetch, tidsgrans = TIDSGRANS, liggare = async () => {}, svarighet = SVARIGHET }) {
  const pagar = new Map();
  let ko = Promise.resolve();
  const tom = () => ({ rapporter: [], skickade: {} });
  // Läs-ändra-skriv i tur och ordning: två samtidiga försök ska inte kunna
  // skriva över varandras rader.
  // Ett nej inne i en ändring (godkännandet vägrar) skrivs inte, och får inte
  // fastna i kön för nästa.
  const andra = gor => { const steg = ko.then(async () => {
    const d = { ...tom(), ...((await lagring.las().catch(() => null)) || {}) };
    const ut = await gor(d);
    // Taket per ägare, så att en användare inte kan trycka ut en annans kvitton.
    const per = new Map();
    d.rapporter = d.rapporter.reverse().filter(p => { const n = (per.get(p.agare) || 0) + 1; per.set(p.agare, n); return n <= 30; }).reverse();
    for (const a of Object.keys(d.skickade)) d.skickade[a] = d.skickade[a].slice(-1000);
    await lagring.skriv(d);
    return ut;
  }); ko = steg.catch(() => {}); return steg; };
  const las = async () => ({ ...tom(), ...((await lagring.las().catch(() => null)) || {}) });
  const agaren = a => String(a ?? 'en');
  const hitta = (d, agare, hash) => d.rapporter.find(x => x.agare === agare && x.hash === hash);
  const markSkickad = (d, agare, hash) => { const l = (d.skickade[agare] ||= []); if (!l.includes(hash)) l.push(hash); };
  const sek = () => Math.floor(Date.now() / 1000);

  async function forsok(agare, hash) {
    const post = await andra(d => {
      const p = hitta(d, agare, hash);
      if (!p) return null;
      if (p.kvitto || p.tillstand === 'stangd' || p.tillstand === 'utgangen') return { ...p };
      // För gammal nyckel: stanna här, före nätet.
      if (!Number.isSafeInteger(p.tid) || sek() - p.tid > NYCKEL_SLUT) {
        p.tillstand = p.kanskeFramme ? 'stangd' : 'utgangen';
        return { ...p };
      }
      p.tillstand = 'skickas';
      return { ...p };
    });
    if (!post) throw fel('ejGodkant', 404);
    // Samma utkast har redan ett kvitto: dubbelklick eller omstart. Inget
    // skickas igen, kvittot visas igen.
    if (post.kvitto) return { ...post.kvitto, igen: true };
    if (post.tillstand === 'stangd') throw fel('stangd', 409);
    if (post.tillstand === 'utgangen') throw fel('utgangen', 409, { text: post.text, epost: post.epost });
    // Det lagrade paketet är det som skickas; hashen prövas mot det, inte mot
    // något klienten säger.
    if (hashAv({ text: post.text, epost: post.epost }) !== hash) throw fel('andrad', 409);
    const { text, epost } = post;

    if (!Number.isSafeInteger(post.bevis)) {
      post.bevis = await bevisa(`${post.nyckel}:${post.tid}`, text, svarighet);
      await andra(d => { const p = hitta(d, agare, hash); if (p) p.bevis = post.bevis; });
    }
    const kropp = { nyckel: post.nyckel, tid: post.tid, text, ...(epost ? { epost } : {}), bevis: post.bevis };
    const borjan = Date.now();
    try {
      const kvitto = await overfor(adress, kropp, { hamta, tidsgrans });
      await andra(d => {
        const p = hitta(d, agare, hash);
        if (p) { p.tillstand = 'skickad'; p.kvitto = kvitto; delete p.fel; }
        markSkickad(d, agare, hash);
      });
      await liggare({ kropp, kvitto, agare, sekunder: (Date.now() - borjan) / 1000 }).catch(() => {});
      return kvitto;
    } catch (e) {
      await andra(d => {
        const p = hitta(d, agare, hash);
        if (!p) return;
        p.fel = e.sort || 'nat';
        if (e.kanskeFramme) p.kanskeFramme = true;
        if (e.sort === 'raderadHos') { p.tillstand = 'stangd'; markSkickad(d, agare, hash); }
        else if (e.sort === 'gammal') p.tillstand = p.kanskeFramme ? 'stangd' : 'utgangen';
        else p.tillstand = 'misslyckad';
      });
      await liggare({ kropp, fel: e, agare, sekunder: (Date.now() - borjan) / 1000 }).catch(() => {});
      throw e;
    }
  }

  return {
    mottagare: () => { try { return adress ? new URL(adress).host : null; } catch { return null; } },
    /// Det ytan behöver för att erbjuda ett nytt försök efter en omstart —
    /// bara ägarens egna.
    async lage(agare) {
      const a = agaren(agare);
      return (await las()).rapporter.filter(p => p.agare === a).map(p => ({ hash: p.hash, text: p.text, epost: p.epost || '', skapad: p.skapad,
        tillstand: p.tillstand === 'skickas' ? 'misslyckad' : p.tillstand, fel: p.fel || null, kvitto: p.kvitto || null }));
    },
    /// Godkännandet: paketet prövas (hash, storlek, maskering) och fryses här.
    /// Det är också det enda stället en ny nyckel föds — för ett nytt utkast,
    /// eller för ett vars nyckel gått ut utan att något nått mottagaren.
    async godkann({ text, epost = '', hash, agare }) {
      if (!this.mottagare()) throw fel('ingenMottagare', 409);
      prova({ text, epost, hash });
      const a = agaren(agare);
      return andra(d => {
        const p = hitta(d, a, hash);
        if (p?.kvitto) return { hash };
        if (p?.tillstand === 'stangd') throw fel('stangd', 409);
        if (!p && (d.skickade[a] || []).includes(hash)) throw fel('redanSkickad', 409);
        if (p?.tillstand === 'utgangen') {
          Object.assign(p, { nyckel: randomUUID(), tid: sek(), bevis: null, tillstand: 'godkant' });
          delete p.fel;
        } else if (!p) {
          d.rapporter.push({ agare: a, hash, nyckel: randomUUID(), tid: sek(), text, epost, skapad: new Date().toISOString(), tillstand: 'godkant' });
        }
        return { hash };
      });
    },
    /// Skickar ett godkänt paket. Bara hashen kommer från klienten.
    async skicka({ hash, agare }) {
      if (!this.mottagare()) throw fel('ingenMottagare', 409);
      if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) throw fel('ejGodkant', 404);
      const a = agaren(agare);
      // Ett dubbelklick är samma försök, inte två.
      const k = `${a}:${hash}`;
      if (!pagar.has(k)) pagar.set(k, forsok(a, hash).finally(() => pagar.delete(k)));
      return pagar.get(k);
    },
    /// Släng ett utkast som inte gått iväg. Ett kvitto ligger kvar: det är
    /// ditt enda bevis på rapportnumret och raderingskoden. Ett utkast som kan
    /// ha nått mottagaren lämnar sin hash i `skickade`.
    async glom(hash, agare) {
      const a = agaren(agare);
      return andra(d => {
        for (const p of d.rapporter) if (p.agare === a && p.hash === hash && !p.kvitto && p.kanskeFramme) markSkickad(d, a, hash);
        d.rapporter = d.rapporter.filter(p => p.agare !== a || p.hash !== hash || p.kvitto);
        return true;
      });
    },
  };
}
