// Var bor den lokala modellen?
//
// Inte på en fast port. Finns en valfri lokal schemaläggare för modeller
// på maskinen (ett program på PATH som delar ut minne till modellprocesser)
// går modelladdningen genom den, och den vet vem som redan serverar vad.
//
// Saknas den används förvalsporten. Programmet ska inte kräva ett verktyg
// för att gå igång.

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { hitta, AR_WINDOWS } from './plattform.mjs';
import { anrop, arSocket, tolka } from './kanal.mjs';
import { join, basename, dirname } from 'node:path';
import { rm, chmod, writeFile, readFile, stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tx, svenska } from './sprakstod.mjs';
import { openSync, closeSync, statSync, renameSync } from 'node:fs';

const kor = promisify(execFile);

/// Modellen som gör allt lokalt arbete: grind, dom och lokala svar.
///
/// Gemma 4 12B QAT, q4_0. Vägen hit gick över två andra:
///
/// Qwen3.5-2B föll som domare 2026-09-21. Tre domar där svaret var uppenbart
/// fel, tre gånger "ja, det besvarar frågan" — inklusive ett svar om
/// bankkonton på en fråga om ett personalärende. Ingen domare, en stämpel.
///
/// Jan-v3-4B dömde rätt men skrev fel. I ett samtal om känslor 2026-09-22
/// moraliserade den, satte betyg i fetstil och gav aldrig mer än två korta
/// stycken hur man än frågade. Gemma tog samma bänk utan en enda anmärkning,
/// och svenskan är inte jämförbar: böjning, sammansättningar och myndighets-
/// språk stämmer.
///
/// Priset är 8,6 GB i stället för 2,5, och det är rätt pris. Det som körs
/// här är det enda som får se personnumren.
export async function modellFinns() {
  try { const { stat } = await import('node:fs/promises'); return (await stat(MODELL)).size > 1e9; }
  catch { return false; }
}

/// Modellfilen MAXIMUS startar när ingen annan svarar.
///
/// Satt utifrån med --modellfil eller MAXIMUS_MODELLFIL. Skillnaden mot
/// --modell är vem som äger processen: en URL pekar på någon annans modell
/// och den rör MAXIMUS inte, en fil är MAXIMUS:s egen att starta och stänga.
let MODELL = join(homedir(), 'models', 'gemma-4-12B-it-qat-q4_0-gguf', 'gemma-4-12b-it-qat-q4_0.gguf');
export const modellfil = () => MODELL;
export function satModellfil(vag) { if (vag) MODELL = String(vag); }

/// Projektorn som ger modellen syn, om den finns bredvid modellen.
///
/// Namnet är inte reglerat. Google skriver mmproj-<modell>.gguf, unsloth
/// skriver mmproj-F16.gguf. Alltså: vilken fil som helst i samma katalog som
/// börjar med mmproj och slutar på .gguf.
export async function hittaMmproj(modellvag = MODELL) {
  try {
    const { readdir } = await import('node:fs/promises');
    const kat = dirname(String(modellvag));
    const f = (await readdir(kat)).find(x => /^mmproj.*\.gguf$/i.test(x));
    return f ? join(kat, f) : null;
  } catch { return null; }
}

/// Ser den modell som körs bilder?
export const serBilder = async () => Boolean(await hittaMmproj());
/// Där modellen svarar när MAXIMUS startat den själv.
///
/// En UNIX-socket, inte en port. Mätt 2026-09-25: modellservern speglar
/// vilken Origin som helst, så vilken webbsida användaren än besöker kunde
/// prata med modellen på hennes dator — läsa av modell och mall, och skjuta
/// in egen text i den process som ser personnumren. En port på loopback är
/// inte privat för användaren heller; varje process på datorn kan öppna den.
///
/// En socket kan en webbsida inte öppna. Rättigheterna är filsystemets, och
/// MAXIMUS sätter dem till 0600 — bara den som äger Maximus.
///
/// Windows namngivna pipes duger inte som `--host` för llama-server, så där
/// blir det loopback med nyckel. Se `nyckelfil`.
let FORVAL = AR_WINDOWS ? 'http://127.0.0.1:23531' : 'unix:/tmp/maximus-modell.sock';
let SOCKETKATALOG = homedir();
export async function satSocket(vag) {
  SOCKETKATALOG = dirname(vag);
  if (vag && !AR_WINDOWS) { FORVAL = `unix:${vag}`; return; }
  // En omstart av MAXIMUS ska inte tappa nyckeln till en modell som fortfarande
  // kör. Den ligger kvar i filen och läses tillbaka.
  modellnyckel = await readFile(nyckelvag(), 'utf8').catch(() => null);
}
export const modelladress = () => FORVAL;

let cache = null, cachad = 0;

/// Vilka flaggor den llama-server som faktiskt ligger här förstår.
///
/// Öppnar loggen för tillägg. Går det inte (läsrättigheter, full disk) startar
/// modellen ändå, utan logg — loggen får aldrig vara skälet att den inte går.
function oppnaLogg(vag, tak = 5 * 1024 * 1024) {
  try {
    try { if (statSync(vag).size > tak) renameSync(vag, `${vag}.1`); } catch {}
    return openSync(vag, 'a', 0o600);
  } catch { return 'ignore'; }
}

/// Flaggorna byter namn mellan byggen. `--mlock` fanns i build 10621 och är
/// borttagen i 11179, där samma sak heter `--load-mode mlock`. MAXIMUS startade
/// modellen med en flagga som inte fanns, servern svarade "invalid argument"
/// och dog, och allt användaren såg var "Den lokala modellen startade inte."
///
/// Att hårdkoda flaggor för det bygge vi råkar packa med gör paketet skört:
/// nästa uppdatering byter namn på något annat. Binären får säga själv vad
/// den kan, en gång per start.
let formagor = null;
async function vadKanDen(llama) {
  if (formagor) return formagor;
  let hjalp = '';
  try { hjalp = (await kor(llama, ['--help'], { timeout: 10000, maxBuffer: 4e6 })).stdout; }
  catch (e) { hjalp = e.stdout || ''; }
  formagor = {
    laddlage: /--load-mode/.test(hjalp),
    mlock: /(^|\s)--mlock\b/.test(hjalp),
    cacheReuse: /--cache-reuse/.test(hjalp),
  };
  return formagor;
}

/// Nyckeln till modellservern, när den måste ligga på en port.
///
/// Bara Windows: där finns ingen UNIX-socket att lyssna på. På macOS och
/// Linux finns ingen port alls, och då behövs ingen nyckel.
let modellnyckel = null;
const nyckelvag = () => join(SOCKETKATALOG, 'modellnyckel');
export const modellhuvuden = () => (modellnyckel ? { Authorization: `Bearer ${modellnyckel}` } : {});

/// Adresser vars vikter redan dragits in i minnet. Se varmKor.
const varmda = new Set();

/// Satt utifrån med --modell eller MAXIMUS_MODELL.
///
/// Den som kör MAXIMUS på egen hårdvara kör den modell hårdvaran bär — en
/// 8 GB-burk tar en 4B, en maskin med 128 GB tar något helt annat. Allt som krävs är en OpenAI-kompatibel endpoint: llama-server,
/// Ollama, vLLM eller LM Studio.
let tvingad = null;
export function satModell(url) {
  tvingad = url ? String(url).replace(/\/+$/, '') : null;
  cache = null;
  takCache.clear();
}

/// En valfri kö framför modellen. Skrivbordet kör utan; servern sätter en
/// bara när den startats med en (se FACK i server.mjs).
let ko = null;
export function satKo(k) { ko = k; }
export function genom(anvandarId, gor, val) {
  return ko ? ko.stall(anvandarId || 'en', gor, val) : gor();
}

export async function lokalUrl() {
  if (tvingad) return tvingad;
  // Tio sekunder räcker: en modell flyttar inte på sig mitt i ett samtal,
  // men den kan startas om mellan två.
  if (cache && Date.now() - cachad < 10000) return cache;
  // MAXIMUS kör sin egen modellserver och lånar aldrig någon annans.
  //
  // Här stod en fråga till schemaläggaren: serverar någon redan samma modell någonstans
  // på maskinen? Gör de det använde MAXIMUS den adressen. Det sparar sju
  // gigabyte och det är fel ändå.
  //
  // Sett skarpt 2026-09-28: MAXIMUS kopplade upp sig mot 127.0.0.1:23552, en
  // llama-server som tillhörde en annan session — samma session som en
  // halvtimme tidigare stängt MAXIMUS:s egen modell för att frigöra minne. Den
  // som äger servern får stänga den när som helst, och då dör MAXIMUS:s samtal
  // mitt i en mening av något ingen i MAXIMUS gjort.
  //
  // Det finns ett skäl till: platserna. MAXIMUS binder samtalet till fack 0,
  // besluten till 1 och efterarbetet till 2 — se PLATSER i lokal.mjs. Delar
  // två program på samma server slår de ut varandras KV-cache, och den som
  // mäter fyra sekunder mot sjuttiotvå tappar just det.
  //
  // Egen socket, alltid. Den kostar minne och är värd det.
  if (arSocket(FORVAL) && await svararPa(FORVAL)) { cache = FORVAL; cachad = Date.now(); return FORVAL; }
  cache = FORVAL; cachad = Date.now();
  return FORVAL;
}

/// Svarar någon på den adressen?
async function svararPa(adress) {
  try { return (await anrop(adress, '/v1/models', { timeout: 2000, headers: modellhuvuden() })).ok; }
  catch { return false; }
}

/// Svarar någon där?
export const lokalSvarar = async () => svararPa(await lokalUrl());


/// Vilken modell som faktiskt svarar, enligt modellservern själv.
///
/// Inställningarna sa "Jan v3 · igång" medan Gemma 4 12B svarade — namnet
/// var en fast sträng i servern. En rad som säger vilken modell som läser
/// dina ärenden ska komma från modellen, inte från det vi tänkte oss.
export async function vilkenModell() {
  try {
    const r = await anrop(await lokalUrl(), '/v1/models', { timeout: 2000, headers: modellhuvuden() });
    const m = (await r.json()).data?.[0];
    if (!m?.id) return null;
    const byte = m.meta?.size;
    return { namn: modellnamn(m.id), ...(byte ? { storlek: `${svenska() ? (byte / 1e9).toFixed(1).replace('.', ',') : (byte / 1e9).toFixed(1)} GB` } : {}) };
  } catch { return null; }
}

/// "gemma-4-12b-it-qat-q4_0.gguf" → "Gemma 4 12B". Filnamnet är det enda
/// alla modellservrar har gemensamt.
export const modellnamn = id => basename(String(id || ''))
  .replace(/\.gguf$/i, '')
  .split(/-(?:it|instruct|base|chat)(?![a-z])/i)[0]
  .replace(/[-_](?:q\d|iq\d|f16|bf16|qat)[\w.]*$/i, '')
  .replace(/[-_]+/g, ' ')
  .replace(/(?<![\w.])(e?)(\d+(?:\.\d+)?)b(?!\w)/gi, (_, e, n) => `${e.toUpperCase()}${n}B`)
  .replace(/^\p{Ll}/u, c => c.toUpperCase());

/// Hur mycket kontext modellen faktiskt har, enligt modellservern själv.
///
/// Att gissa den är att gissa var gränsen går, och gränsen syns först som
/// HTTP 400 mitt i ett svar. Den frågas en gång per adress och sparas.
const takCache = new Map();
export async function kontextTak(url) {
  url ||= await lokalUrl();
  if (takCache.has(url)) return takCache.get(url);
  // Två försök: en modell som just väckts ur vilan eller är mitt i ett svar
  // hann inte på två sekunder, och då föll taket till 8192 — en fjärdedel av
  // vad den har. En avskrift på tio tusen tecken klipptes i mitten utan att
  // behöva det (sett 2026-10-06, LBE Arkitekt 2).
  for (const timeout of [2000, 6000]) {
    try {
      const r = await anrop(url, '/v1/models', { timeout, headers: modellhuvuden() });
      const n = (await r.json()).data?.[0]?.meta?.n_ctx;
      if (Number(n) > 0) { takCache.set(url, Number(n)); return Number(n); }
    } catch { /* ett försök till */ }
  }
  // Svarar den inte alls: det MAXIMUS själv startade den med, per plats.
  return egen ? (fack > 1 ? 8192 : kontext) : 8192;
}
export const glomTak = () => takCache.clear();

/// Processen MAXIMUS startade, om MAXIMUS startade någon.
let egen = null;

/// Stänger av den lokala modellen.
///
/// Bara den MAXIMUS äger. En modell som pekats ut med --modell tillhör kundens
/// drift, och en som redan körde när MAXIMUS startade tillhör någon annan på
/// maskinen — att stänga den vore att slå av något man inte satt på.
export async function stoppaModell() {
  if (tvingad) throw new Error(tx('lib.modell.erStanger', { var: tvingad }));
  // Nästa modell är kall igen, vad den än heter.
  varmda.clear();
  const url = await lokalUrl();
  if (url !== FORVAL)
    throw new Error(tx('lib.modell.inteStartad', { url }));

  // Efter en omstart av MAXIMUS finns inget barn att minnas. Adressen är MAXIMUS:s
  // egen — den som lyssnar där är den MAXIMUS startade. En socket har ingen port
  // att slå upp, men den som lyssnar på den går att hitta med lsof.
  const mal = tolka(url);
  const pid = egen || await omslaget(mal.socket
    ? await pidPaSocket(mal.socket)
    : await pidPaPorten(mal.port));
  if (!pid) throw new Error(tx('lib.modell.ingenAttStanga'));
  try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch { /* redan borta */ } }
  egen = null;

  for (let i = 0; i < 20; i++) {
    cache = null;
    if (!(await lokalSvarar())) return { stoppad: true };
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(tx('lib.modell.villeInte'));
}

/// Modellservern körs under schemaläggaren, och det är omslaget som håller minnet.
///
/// Dödar man bara llama-server står schemaläggaren kvar med ett lease på minne som
/// ingen längre använder — "ghost" i schemaläggarens status. Hela ledet ska ner, så
/// signalen går till omslaget när det är förälder.
async function omslaget(pid) {
  if (!pid || process.platform === 'win32') return pid;
  try {
    const { stdout } = await kor('/bin/ps', ['-o', 'ppid=', '-p', String(pid)], { timeout: 4000 });
    const far = Number(stdout.trim());
    if (!far) return pid;
    const { stdout: namn } = await kor('/bin/ps', ['-o', 'command=', '-p', String(far)], { timeout: 4000 });
    return /loco\b/.test(namn) ? far : pid;
  } catch { return pid; }
}

/// Pausar modellen utan att släppa minnet.
///
/// SIGSTOP fryser hela ledet: modellen ligger kvar laddad, slutar räkna och
/// slutar dra ström. Det är skillnaden mot att stänga av — sju gigabyte tar
/// fyrtio sekunder att läsa in igen, men en paus återupptas på en sekund.
/// Den som behöver kärnorna till något annat ska inte behöva betala den
/// laddningen två gånger.
export async function pausaModell() { return signalera('SIGSTOP', 'pausa'); }
export async function fortsattModell() { return signalera('SIGCONT', 'återuppta'); }

async function signalera(signal, vad) {
  if (tvingad) throw new Error(tx('lib.modell.erRor', { var: tvingad }));
  const mal = tolka(FORVAL);
  const pid = egen || await omslaget(mal.socket
    ? await pidPaSocket(mal.socket)
    : await pidPaPorten(mal.port));
  if (!pid) throw new Error(tx(vad === 'pausa' ? 'lib.modell.ingenAttPausa' : 'lib.modell.ingenAttAteruppta'));
  try { process.kill(-pid, signal); } catch { process.kill(pid, signal); }
  return { pid };
}

/// Vem lyssnar på porten. lsof på macOS och Linux, netstat på Windows.
/// Vem lyssnar på socketen?
///
/// lsof tar en sökväg lika bra som en port. Det behövs efter en omstart av
/// MAXIMUS, när minnet av barnprocessen är borta men socketen finns kvar.
async function pidPaSocket(vag) {
  try {
    const { stdout } = await kor('/usr/sbin/lsof', ['-t', '-nP', '--', vag], { timeout: 4000 });
    return Number(stdout.trim().split('\n')[0]) || null;
  } catch { return null; }
}

async function pidPaPorten(port) {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await kor('netstat', ['-ano', '-p', 'tcp'], { timeout: 4000 });
      const rad = stdout.split('\n').find(r => /LISTENING/i.test(r) && new RegExp(`:${port}\\b`).test(r));
      return rad ? Number(rad.trim().split(/\s+/).pop()) : null;
    }
    const { stdout } = await kor('/usr/sbin/lsof', ['-t', '-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { timeout: 4000 });
    return Number(stdout.trim().split('\n')[0]) || null;
  } catch { return null; }
}

/// Ser till att modellen finns. Laddar den bara om ingen annan redan gör det.
///
/// MAXIMUS startar sin egen och lånar aldrig någon annans. `--unique` fanns här
/// och sparade minne genom att återanvända vilken instans som helst på
/// maskinen — men den som äger servern får stänga den, och det hände.
///
/// Förbikopplingen på det inre kommandot (miljövariabeln i starta()): annars
/// tar schemaläggarens egen PATH-skugga ett andra lease för samma laddning,
/// och 2,5 GB bokförs som 5.
/// Hur många fack modellen ska ha. Skrivbordet ställer en fråga i taget och
/// behöver ett; fler fack delar kontexten och kan svara på flera samtidigt.
let fack = 1;
export function satFack(n) { fack = Math.max(1, Number(n) || 1); }

/// Modellens minne, i tokens. Väljs i inställningarna.
///
/// Mätt 2026-09-23 på Gemma 4 12B, en M1 Max: 16k 7,1 GB · 32k 7,2 GB ·
/// 64k 7,5 GB · 128k 8,0 GB. Glidande fönster gör KV-cachen billig, så
/// valet handlar mindre om minne och mer om hur länge det tar att läsa in
/// ett långt samtal första gången.
export const KONTEXTER = [16384, 32768, 65536, 131072];
let kontext = 32768;
export function satKontext(n) {
  const v = Number(n);
  if (KONTEXTER.includes(v)) kontext = v;
}
export const kontexten = () => kontext;

/// En start i taget.
///
/// Sett skarpt 2026-09-27: schemaläggaren köade MAXIMUS:s laddning, MAXIMUS väntade nittio
/// sekunder, gav upp — och lämnade schemaläggarens körning kvar i kön. Nästa försök
/// startade ett nytt, som hamnade SIST i kön bakom det förra. Efter en
/// förmiddag stod tio köplatser från samma MAXIMUS och svalt varandra.
///
/// Två fel i ett: den som väntar ska vänta på det som redan är på väg, och
/// den som ger upp ska städa efter sig. Löftet nedan löser det första.
let pagaende = null;

export async function sakerstallModell({ onSteg = () => {} } = {}) {
  if (await lokalSvarar()) {
    const url = await lokalUrl();
    await varmKor(url, onSteg);
    return { redan: true, url };
  }
  // Startar den redan? Vänta in den i stället för att starta en till.
  if (pagaende) return pagaende;
  pagaende = starta({ onSteg }).finally(() => { pagaende = null; });
  return pagaende;
}

async function starta({ onSteg = () => {} } = {}) {
  // En modell som pekats ut utifrån startar MAXIMUS inte. Den tillhör kundens
  // drift, och att köra igång en andra kopia vore att ta över något vi inte
  // äger.
  if (tvingad) throw new Error(tx('lib.modell.erSvararInte', { var: tvingad }));

  onSteg({ steg: 'laddar', text: tx('lib.modell.startar') });
  const llama = await hitta('llama-server');
  if (!llama) throw new Error(tx('lib.modell.llamaSaknas'));
  const schemalaggare = await hitta('loco');
  const port = new URL(FORVAL).port;
  const kan = await vadKanDen(llama);
  const mal = tolka(FORVAL);
  // Socketen läggs där bara den som äger Maximus kommer åt den. llama-server
  // skapar den med umask, så rättigheterna sätts om direkt efteråt.
  const vagen = mal.socket
    ? ['--host', mal.socket]
    : ['--host', '127.0.0.1', '--port', String(mal.port)];
  if (mal.socket) await rm(mal.socket, { force: true }).catch(() => {});

  // Windows har ingen socket att lyssna på, så där blir det loopback — och
  // då måste porten ha ett lås. Nyckeln läggs i en fil med 0600 och ges till
  // servern med --api-key-file: hade den stått som --api-key hade den synts
  // i `ps` för varje process på datorn.
  if (!mal.socket) {
    modellnyckel ||= randomBytes(32).toString('base64url');
    await writeFile(nyckelvag(), modellnyckel, { mode: 0o600 });
    vagen.push('--api-key-file', nyckelvag());
  }
  // mmap+mlock: kartlägg filen och lås den. Utan mmap läses hela modellen in
  // en gång till vid start; utan lås komprimerar macOS den medan man tänker.
  const lasFlaggor = kan.laddlage ? ['--load-mode', 'mmap+mlock'] : kan.mlock ? ['--mlock'] : [];
  // Schemaläggaren är valfri och finns oftast inte. Utan den startas
  // modellservern direkt — minnesgrinden är en bekvämlighet, inte ett krav.
  // Ser modellen bilder?
  //
  // Gemma 4 är multimodal, men GGUF-filen bär bara språkdelen. Synen ligger
  // i en egen projektor — mmproj — som llama-server tar med --mmproj. Utan
  // den läses en bild med OCR och modellen får en avskrift; med den ser den
  // bilden.
  //
  // Filen letas bredvid modellen och laddas aldrig av sig själv: den är
  // ungefär en gigabyte, och den som inte skickar bilder ska inte behöva
  // hämta den.
  const mmproj = await hittaMmproj(MODELL);

  const argument = [
    llama, '-m', MODELL,
    ...(mmproj ? ['--mmproj', mmproj] : ['--no-mmproj']),
    // Socket där det går, loopback med nyckel där det inte går.
    //
    // `--host` tar en socketsökväg, och det är hela skyddet: en webbsida kan
    // inte öppna en socket, och rättigheterna är filsystemets. Utan den
    // speglade modellservern vilken Origin som helst.
    ...vagen,
    '--jinja',
    // CORS stängs ändå, för TCP-fallet och för att förvalet är '*'.
    '--cors-origins', 'maximus://lokalt',
    // Kontexten delas lika mellan facken, så den skalas med dem: 8k var,
    // vilket räcker för en fråga med ett dokument bifogat.
    //
    // Mätt 2026-09-21 på Jan-v3-4B, en M1 Max:
    //
    //    1 fack, 16k    3,9 GB    1 samtidig,  2,0 s till klart svar
    //    8 fack, 64k    7,5 GB    8 samtidiga, 11 s, första tecknet 95 ms
    //   16 fack, 128k  12,2 GB   24 samtidiga, 15 s, första tecknet 144 ms
    //
    // Över antalet fack köar llama-server själv, och vid trettiotvå blev
    // första tecknet 9,6 sekunder. Därför köar MAXIMUS före den, så att den som
    // väntar får veta var i kön hon står i stället för att titta på en
    // frusen ruta.
    // Mätt 2026-09-23 på Gemma 4 12B, en M1 Max: 8k 7,0 GB, 16k 7,1 GB,
    // 32k 7,2 GB. KV-cachen kostar nästan ingenting eftersom modellen
    // använder glidande fönster i de flesta lager — och 8k räckte inte:
    // del tre av ett flerdelat svar föll med HTTP 400 mitt i skrivningen.
    //
    // Med fler än ett fack behålls 8k per fack. Där delas kontexten mellan
    // samtidiga frågor, och antalet fack är redan det som styr minnet.
    // Mätt 2026-09-23 på Gemma 4 12B, en M1 Max:
    //
    //    8k   7,0 GB     32k  7,2 GB
    //   16k   7,1 GB     64k  7,5 GB · 128k 8,0 GB
    //
    // Fönstret kostar nästan ingenting; glidande fönster gör KV-cachen
    // billig. Det som kostar är att läsa in ett långt samtal på nytt: 76
    // sekunder för 12 600 tokens, mot 0,9 när inledningen är oförändrad.
    // Därför ett rejält fönster och en prompt som växer på slutet — se
    // lib/minne.mjs.
    // Skrivbord får två platser, inte en.
    //
    // Ett svar består av flera modellanrop: webbeslut, själva svaret,
    // följdfrågorna. Med en enda plats delar de KV-cache, och anropet efter
    // svaret slängde ut samtalet som nästa fråga behövde. Mätt 2026-09-25 i
    // en tråd med tre frågor: fråga två skickade 1041 tokens och fick
    // återanvända 109. Alltså läste den om hela samtalet, varje gång, i
    // precis de trådar som redan hunnit bli långa.
    //
    // Nu har samtalet en plats för sig själv, besluten före svaret en andra
    // och efterarbetet en tredje — se `plats` i lokal.mjs. Med bara två
    // köade nästa frågas webbeslut bakom förra turens följdfrågor, och
    // första tecknet dröjde 7,5 sekunder.
    //
    // Kontexten skalas med platserna så att samtalet behåller hela sitt
    // fönster. Det kostar nästan ingenting: glidande fönster gör KV-cachen
    // billig, 8k 7,0 GB mot 32k 7,2 GB.
    '--ctx-size', String(fack > 1 ? 8192 * fack : kontext * 3),
    '--parallel', String(fack > 1 ? fack : 3),
    // Kvantiserad KV-cache. Mätt 2026-09-21:
    //
    //   16k fp16 KV   4,91 GB
    //    8k fp16 KV   3,79 GB
    //   16k q8   KV   3,86 GB
    //
    // Samma minne som halva kontexten kostade förut, med hela kontexten
    // kvar. Provat under ballong ner till 5,7 GB ledigt, där grind, dom och
    // Whisper alla höll.
    '-ctk', 'q8_0', '-ctv', 'q8_0',
    // Vikterna låses i RAM.
    //
    // Mätt 2026-09-25, och det här var hela gåtan bakom "45–116 sekunder i
    // Arbetar": modellen räknar 24,7 tokens i sekunden, men medan man
    // funderar på nästa fråga komprimerar macOS de sju gigabyten, och
    // första anropet efter en paus betalar 37 sekunder i uppackning innan
    // ett enda tecken räknas. Tre anrop i rad efter varandra: 3,5 s. Samma
    // anrop efter en stunds tystnad: 42 s. Inget av det syns i modellens
    // egna tidmätningar, för den mäter först när sidorna är på plats.
    //
    // mlock säger till kärnan att de här sidorna inte får komprimeras.
    // Kostar att vi håller minnet på riktigt i stället för på låtsas — men
    // det är precis vad schemaläggarens lease redan lovar omvärlden.
    ...lasFlaggor,
    // Att en gammal tur rullar ut ur fönstret ska inte kosta hela samtalet.
    // Utan det här ogiltigförklarar varje ändring mitt i prompten allt som
    // kommer efter den, och ett långt samtal räknas om från början varje
    // gång. Med KV-skift återanvänds svansen i bitar om minst 256 tokens.
    ...(kan.cacheReuse ? ['--cache-reuse', '256'] : []),
  ];

  // Genom schemaläggaren om den finns, så att en instans som redan körs återanvänds.
  // Förbikopplingen på det inre kommandot, annars tar schemaläggarens egen PATH-skugga ett
  // andra lease för samma laddning.
  // Modellserverns egen utskrift går till modell.log i datamappen (2026-10-09).
  // Förut kastades den, och när modellen hängde under en inspelning gick det
  // inte att skilja "långsam för att grafikkortet var upptaget" från "fastnat".
  // llama-server skriver laddning, fack och tider — inte frågor eller svar, så
  // länge --verbose inte är på, och det är det aldrig här. Över 5 MB flyttas
  // den till modell.log.1; mer än så sparas inte.
  const logg = oppnaLogg(join(SOCKETKATALOG, 'modell.log'));
  const barn = schemalaggare
    // Minnet bokas på vad DEN HÄR körningen behöver.
    //
    // Sett skarpt 2026-09-25: MAXIMUS bad om 4 GB för en modell som tar tio,
    // och bad dessutom att få bli utslängd. När en annan process ville ha
    // minne krympte schemaläggaren MAXIMUS:s lease till 3,9 GB, resten hamnade i
    // kompressorn, och farten föll från 21 till 8 tecken per sekund mitt i
    // ett samtal. Användaren märkte det som att allt plötsligt tog evigheter.
    // Att be om för lite är alltså värre än att vänta.
    //
    // Därefter stod det 'auto', och det är för lite information åt andra
    // hållet. Sett skarpt 2026-09-27: schemaläggaren reserverade 24 GB för en modell
    // som MAXIMUS själv mätt till 7,2 — 'auto' slår upp den högsta toppen någon
    // körning någonsin nått, och en topp från en serverkörning med sexton fack
    // säger ingenting om ett skrivbord med tre. MAXIMUS köade bakom fyra och en
    // halv gigabyte som den här körningen aldrig skulle ha rört.
    //
    // Nu räknas behovet av det som faktiskt styr det: filen, fönstret, facken
    // och bilddelen. Se behovet().
    //
    // Inte evictable heller: den som väntar på ett svar ska inte få vänta
    // för att något annat ville ha plats.
    // Inget --unique. Flaggan är maskinbred — "if this model already answers
    // somewhere" — och tar alltså vilken sessions server som helst. MAXIMUS ska
    // ha sin egen; se lokalUrl() för vad som hände när den inte hade det.
    ? spawn(schemalaggare, ['run', '--model', MODELL, '--need', await behovet(mmproj),
        '--max-hold', '8h', '--prio', '1', '--tag', 'maximus', '--', ...argument],
        { env: { ...process.env, LOCO_BYPASS: '1' }, stdio: ['ignore', logg, logg], detached: true })
    : spawn(argument[0], argument.slice(1), { stdio: ['ignore', logg, logg], detached: true });
  if (typeof logg === 'number') closeSync(logg);
  barn.unref();
  // Det MAXIMUS startat får MAXIMUS också stänga. Detached gör barnet till egen
  // grupp, så att hela ledet — schemaläggaren och modellservern under den — går ner
  // tillsammans när gruppen får signalen.
  egen = barn.pid;

  // Vänta in den. En kall laddning av sju gigabyte tar sin tid, och att svara
  // "modellen är nere" medan den startar vore fel — den är på väg.
  cache = null;
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 1000));
    cache = null;
    if (await lokalSvarar()) {
      const url = await lokalUrl();
      // Socketen skapas med umask, vilket ger den läsbara rättigheter för
      // andra. En socket går bara att koppla upp mot med skrivrätt, men att
      // förlita sig på det är att förlita sig på någon annans umask.
      if (mal.socket) await chmod(mal.socket, 0o600).catch(() => {});
      await varmKor(url, onSteg);
      return { redan: false, url };
    }
  }

  // Tiden gick ut. Städa efter dig.
  //
  // Barnet lämnades förut kvar, och det är värre än det låter: står laddningen
  // i schemaläggarens kö fortsätter den stå där, och nästa försök ställer sig BAKOM den.
  // Tio försök gav tio köplatser som väntade på varandra.
  //
  // Detached gör barnet till en egen processgrupp, så minustecknet tar hela
  // ledet — schemaläggaren och modellservern under den — i ett svep.
  const levde = barn.pid ? döda(-barn.pid) : false;
  egen = null;

  // Lever ledet ännu efter att vi bett det gå? Då dog det inte av ett fel —
  // det stod och väntade på minne. Det är inte samma sak som att inte starta,
  // och det ska inte heta samma sak.
  throw new Error(levde
    ? tx('lib.modell.ingetMinne')
    : tx('lib.modell.startadeInte'));
}

/// Tar ned en processgrupp och säger om den fanns.
function döda(mal) {
  try { process.kill(mal, 'SIGTERM'); return true; }
  catch { return false; }
}

/// Hur mycket minne den här körningen behöver, i gigabyte.
///
/// Fyra poster, och alla går att peka på:
///
///   Vikterna      filen på disken, plus tio procent för det llama-server
///                 lägger bredvid dem.
///   KV-cachen     MAXIMUS:s egen mätning 2026-09-23 på Gemma 4 12B: 7,0 GB vid
///                 8k och 8,0 vid 128k, med vikterna inräknade. Alltså ungefär
///                 en gigabyte per hundratusen tokens — glidande fönster gör
///                 cachen billig. Facken delar fönstret, så de kostar inget
///                 extra i sig; de tas med som en halv gigabyte var för det
///                 llama-server håller per fack.
///   Bilddelen     mmproj, om den finns. Filens storlek.
///   Marginal      två gigabyte. En lease som tar slut mitt i ett svar är
///                 värre än en lease som är lite för stor.
///
/// Hellre en gigabyte för mycket än en för lite: det som händer när MAXIMUS ber
/// om för lite står i kommentaren vid spawn ovan.
async function behovet(mmproj) {
  const gb = b => b / 1024 ** 3;
  let vikter = 8;
  try { vikter = gb((await stat(MODELL)).size) * 1.1; } catch { /* okänd fil, gissa högt */ }
  let syn = 0;
  if (mmproj) { try { syn = gb((await stat(mmproj)).size); } catch { syn = 1; } }
  const kv = kontext / 131072;
  const summa = vikter + kv + fack * 0.5 + syn + 2;
  return `${Math.ceil(summa)}G`;
}

/// Första frågan efter en start kostar 42 sekunder. Alla efterföljande
/// kostar två.
///
/// Servern svarar på /health så fort den lyssnar, men vikterna är då inte
/// framme i minnet — det är första genomräkningen som drar in dem, och den
/// notan hamnade på den som råkade ställa den första frågan. Mätt
/// 2026-09-25: 42,4 s på fråga ett, 4,9 på två, 1,9 på tre.
///
/// En token räcker: ett svar rör hela modellen. MAXIMUS betalar alltså notan
/// själv, medan det ändå står "startar den lokala modellen".
///
/// Det gäller också en modell MAXIMUS inte startade. Vakten startar den i
/// bakgrunden, och då var den "uppe" långt innan den var framme i minnet —
/// notan hamnade ändå på första frågan. Varje adress värms en gång.
async function varmKor(url, onSteg = () => {}) {
  if (!url || varmda.has(url)) return;
  varmda.add(url);
  onSteg({ steg: 'laddar', text: tx('lib.modell.vacker') });
  // Servern svarar långt innan den kan räkna. Under laddningen svarar den
  // "loading model" med en felkod, och ett första försök som nöjde sig med
  // ett svar var därför genast klart — varpå notan ändå hamnade på första
  // frågan. Värmningen är klar först när ett riktigt tecken kommit tillbaka.
  const slut = Date.now() + 300000;
  while (Date.now() < slut) {
    try {
      const r = await anrop(url, '/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...modellhuvuden() },
        body: JSON.stringify({ model: 'maximus', messages: [{ role: 'user', content: 'Hej' }],
          max_tokens: 1, stream: false }),
        timeout: 300000,
      });
      if (r.ok && (await r.json())?.choices?.length) return;
    } catch { /* servern är inte framme än */ }
    await new Promise(r => setTimeout(r, 2000));
  }
  varmda.delete(url);
}

/// Glöm värmningen. En modell som stängts av måste värmas på nytt.
export const glomVarmning = () => varmda.clear();
