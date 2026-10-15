
import { createServer } from 'node:http';
import { createServer as createServerTLS } from 'node:https';
import { readFile, writeFile, appendFile, mkdir, readdir, unlink, stat, access, open, realpath, lstat, constants } from 'node:fs/promises';
import { join, dirname, extname, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { nyttSalt } from './lib/krypto.mjs';
import { spawn, execFile as execFileCb } from 'node:child_process';
import { homedir, release as osRelease } from 'node:os';
import { Maximus, arForsegladUtanKod } from './lib/maximus.mjs';
import { forbered, lokaltSvar, maskeraHart } from './lib/kedja.mjs';
import { serBilder, hittaMmproj, modellfil, modellnamn } from './lib/modell.mjs';
import { lasDokument, transkribera, SORTER, LJUD, orat, hamtaOrat, oronlage, satOra, satEgetOra } from './lib/dokument.mjs';
import { stada as stadaPolicy, TAK as POLICYTAK } from './lib/policy.mjs';
import { skrivOm } from './lib/omskrivning.mjs';
import { svaraLokalt, varmPlatser, satMoln, molnPa, molnNamn } from './lib/lokal.mjs';
import * as Moln from './lib/moln.mjs';
import { AVGOR } from './lib/uppslag.mjs';
import { laget as modellaget, hamtaModell, taBort as taBortModell, modell as modellUr, satKatalog } from './lib/modeller.mjs';
import * as Modeller from './lib/modeller.mjs';
import { FOLJD } from './lib/delar.mjs';
import * as Uppdrag from './lib/uppdrag.mjs';
import * as Agent from './lib/agent.mjs';
import * as Anteckningar from './lib/anteckningar.mjs';
import * as Kapacitet from './lib/kapacitet.mjs';
import * as Profil from './lib/profil.mjs';
import * as Arbete from './lib/arbete.mjs';
import * as Veckan from './lib/veckan.mjs';
import * as Sprak from './lib/sprak.mjs';
import * as Sprakstod from './lib/sprakstod.mjs';
const tx = Sprakstod.tx;
const lokalNu = () => (Sprakstod.svenska() ? 'sv-SE' : 'en-US');
const ochLista = xs => (Sprakstod.svenska() ? xs.join(' och ') : new Intl.ListFormat('en', { type: 'conjunction' }).format(xs));
const ellerLista = xs => (Sprakstod.svenska() ? xs.join(' eller ') : new Intl.ListFormat('en', { type: 'disjunction' }).format(xs));
const KALLTYPER = ['epost', 'kalender', 'anteckningar', 'bevakning', 'sida', 'meddelanden', 'paminnelser', 'samtal', 'mapp', 'koppling'];
const bestamdKalla = typ => (KALLTYPER.includes(typ) ? tx(`srv.kalla.bestamd.${typ}`) : typ);
const STANDARDTITEL = /^(Ny session|Agenten|Välkommen till Maximus|New session|Agent|Welcome to Maximus)$/;
const arNySession = t => t === 'Ny session' || t === 'New session';

const VARMA = { beslut: AVGOR, efterat: FOLJD };

let hamtarNu = null;
let startHamtar = null;
import { GENERALISERA, blevVagare, blevVagt, vadFinns, bedom as bedomRojning } from './lib/rojning.mjs';
import { stycken } from './lib/urval.mjs';
import { tillPdf } from './lib/pdf.mjs';
import { slaUpp, forbjuderSok, avgorWebb, antalKallor, arVarufraga, onskatAntal, grindaSokfraga, planera as planeraSok, anonymSokfraga, byggUnderlag } from './lib/uppslag.mjs';
import { utanLurapastaende, rensadeRader, provwebb, anvandaKallor } from './lib/uppslag.mjs';
import { duForm } from './lib/tilltal.mjs';
if (process.env.MAXIMUS_PROV === '1' && process.env.MAXIMUS_PROV_WEBB) provwebb(process.env.MAXIMUS_PROV_WEBB);
import * as Kall from './lib/slaupp.mjs';
import * as Rubrik from './lib/rubrik.mjs';
import * as Vag from './lib/vag.mjs';
import * as Granska from './lib/granska.mjs';
import * as Dugerinte from './lib/dugerinte.mjs';
import * as Kontroll from './lib/kontroll.mjs';
import * as Bevakning from './lib/bevakning.mjs';
import * as Frister from './lib/frister.mjs';
import * as Planen from './lib/planen.mjs';
import * as Handelse from './lib/handelse.mjs';
import * as Presentation from './lib/presentation.mjs';
import * as Schema from './lib/schema.mjs';
import * as Meddelanden from './lib/meddelanden.mjs';
import * as Paminnelser from './lib/paminnelser.mjs';
import * as Mappar from './lib/mappar.mjs';
import * as Post from './lib/post.mjs';
import * as Kalender from './lib/kalender.mjs';
import * as Konton from './lib/konton.mjs';
import * as Projekt from './lib/projekt.mjs';
import * as Arende from './lib/arende.mjs';

const utanBilder = s => ({
  ...s,
  filer: (s.filer || []).map(({ bild, ...f }) => ({ ...f, harBild: Boolean(bild) })),
});

const typAv = namn => ({
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.heic': 'image/heic', '.tiff': 'image/tiff', '.gif': 'image/gif', '.webp': 'image/webp',
}[String(namn).slice(String(namn).lastIndexOf('.')).toLowerCase()] || 'application/octet-stream');
import { klassa as klassaInfo, kraverGodkannande, arvaKlass, NIVAER } from './lib/klassning.mjs';
import { webbFinns, stangWebben, webblage, rensaGammalWebblasare, satVag, egenWebblasare, hamta as hamtaSida } from './lib/webb.mjs';
import { SORTER as MASKSORTER, PAKET, FORVAL, galler, paketFor } from './lib/grader.mjs';
import { grindSvarar } from './lib/grind.mjs';
import { sakerstallModell, stoppaModell, pausaModell, fortsattModell, modellFinns, vilkenModell, satModell, satModellfil, satKo, satFack, satKontext, KONTEXTER, kontexten, kontextTak, glomTak, satSocket } from './lib/modell.mjs';
import { dela, sammanfatta } from './lib/minne.mjs';
import { aterkalla as hamtaTillbaka } from './lib/aterkall.mjs';
import * as Uppdatering from './lib/uppdatering.mjs';
import * as Hemvist from './lib/hemvist.mjs';
import * as Tillagg from './lib/tillagg.mjs';
import * as Artefakt from './lib/artefakt.mjs';
import * as Kontor from './lib/kontor.mjs';
import { lasbar } from './lib/meningar.mjs';
import * as Natfel from './lib/natfel.mjs';
import { VERSION } from './lib/version.mjs';

const UPPDATERINGSADRESS = Hemvist.UPPDATERING;

async function behorighetsKontroll({ vanta = 20000 } = {}) {
  const a = agentInst();
  const inom = (lofte, ms = vanta) => Promise.race([lofte, new Promise(k => setTimeout(() => k('tid'), ms).unref?.())]);
  const nej = async (fn) => { try { const r = await inom(fn()); return r === 'tid' ? false : Boolean(r?.tillstand && r.ok === false); } catch (e) { return Boolean(e?.tillstand); } };
  const prov = [];
  if (a.kalender) prov.push(['kalender', 'kalender', () => Kalender.kalendrar()]);
  if (a.paminnelser) prov.push(['paminnelser', 'paminnelser', () => Paminnelser.prova()]);
  if (a.meddelanden) prov.push(['meddelanden', 'fda', () => Meddelanden.prova('meddelanden')]);
  if (Konton.epostKallor(a.epost).length) prov.push(['epost', 'automation', () => Post.konton()]);
  if (a.anteckningar?.mapp) prov.push(['anteckningar', 'automation', () => Anteckningar.mappar()]);
  for (const m of [...(a.mappar || []), ...(a.mapp ? [a.mapp] : [])])
    if (m?.sokvag) prov.push(['mapp', 'filer', async () => { try { await readdir(m.sokvag); return { ok: true }; } catch (e) { return { ok: false, tillstand: /EPERM|EACCES/.test(e.code || '') }; } }]);
  const svar = await Promise.all(prov.map(async ([kalla, ruta, fn]) => ((await nej(fn)) ? { kalla, ruta } : null)));
  const ut = [];
  for (const x of svar.filter(Boolean)) if (!ut.some(y => y.ruta === x.ruta)) ut.push(x);
  return ut;
}

const TCC_TJANST = { kalender: 'Calendar', paminnelser: 'Reminders', automation: 'AppleEvents', fda: 'SystemPolicyAllFiles' };
async function nollstallLov(rutor) {
  if (process.platform !== 'darwin' || process.env.MAXIMUS_PROV === '1' || appPlats() === null) return [];
  const gjort = [];
  for (const ruta of new Set(rutor)) {
    const tjanst = TCC_TJANST[ruta];
    if (!tjanst) continue;
    await new Promise(k => execFileCb('/usr/bin/tccutil', ['reset', tjanst, 'ai.aurolabs.maximus'], { timeout: 10000 }, e => { if (!e) gjort.push(ruta); k(); }));
  }
  return gjort;
}

function appPlats(app = process.env.MAXIMUS_APP || '') {
  if (!app || !/\.app\//.test(app)) return null;
  if (app.startsWith('/Volumes/')) return 'dmg';
  if (app.includes('/AppTranslocation/')) return 'karantan';
  return 'ok';
}
import { las, granskaUppstart, adresser, HJALP } from './lib/flaggor.mjs';
import { nyckelLika, svarPaUtmaning, tillatenVard, utanHemligheter, notisArgument, systemnotis as systemnotisVag } from './lib/skydd.mjs';
import { formaga, oppnaKommando, datakatalog, hitta } from './lib/plattform.mjs';
import * as Liggare from './lib/liggare.mjs';
import * as Liggarkedja from './lib/liggarkedja.mjs';
import * as Sessionsgallring from './lib/sessionsgallring.mjs';
import * as Dela from './lib/dela.mjs';
import * as Regelpaket from './lib/regelpaket.mjs';
import { satExtraMonster } from './lib/maskering.mjs';
import * as Attest from './lib/attest.mjs';
import * as Villkor from './lib/villkor.mjs';
import * as Start from './lib/start.mjs';
import * as Tillstand from './lib/tillstand.mjs';
import { agentBehover } from './public/behov.js';
import * as Funktioner from './lib/funktioner.mjs';
import * as Aterkommer from './lib/aterkommer.mjs';
import * as Fyndsamtal from './lib/fyndsamtal.mjs';
import * as Underlag from './lib/underlag.mjs';
import * as Sammanstallning from './lib/sammanstallning.mjs';
import * as Hjalp from './lib/hjalp.mjs';
import * as Felrapport from './lib/felrapport.mjs';
import * as Djup from './lib/djup.mjs';
import * as Plugins from './lib/plugins.mjs';
import * as Mcp from './lib/mcpkoppling.mjs';
import * as McpGranska from './lib/mcpgranska.mjs';
import * as McpRegister from './lib/mcpregister.mjs';
import * as McpOauth from './lib/mcpoauth.mjs';
import * as McpSok from './lib/mcpsok.mjs';
import * as McpPlan from './lib/mcpplan.mjs';
import * as McpInstall from './lib/mcpinstall.mjs';
import { byggBilaga as mcpBilaga, rensaPakallande as mcpRensa } from './lib/uppslag.mjs';
import { grindaArgument as mcpGrinda } from './lib/failclosed.mjs';
import { kris, stod } from './lib/stod.mjs';
import { efterSvaret } from './lib/delar.mjs';
import * as Locket from './lib/locket.mjs';
import { PERSONAS, FORVAL as PERSONA_FORVAL, lista as personalista } from './lib/persona.mjs';
import * as Behandling from './lib/behandling.mjs';
import * as Maskbegaran from './lib/maskbegaran.mjs';
import * as Bakgrund from './lib/bakgrund.mjs';
import * as Handelser from './lib/handelser.mjs';
import { slinga as Slinga } from './lib/slinga.mjs';
import * as Verktygsfraga from './lib/verktygsfraga.mjs';
import { vagval } from './lib/vagval.mjs';
import * as A2A from './lib/a2a.mjs';
import * as Stada from './lib/stada.mjs';
import * as Diktera from './lib/diktera.mjs';
import * as Mote from './lib/mote.mjs';
import * as Leverans from './lib/leverans.mjs';
import * as Djupdykning from './lib/djupdykning.mjs';
import * as Du from './lib/du.mjs';
import * as Banken from './lib/banken.mjs';
import * as Kollega from './lib/kollega.mjs';
import * as Flode from './lib/flode.mjs';
import * as Telefon from './lib/telefon.mjs';
import * as Vakten from './lib/vakten.mjs';
import { utatGrind } from './lib/failclosed.mjs';
import * as Namnmodell from './lib/namnmodell.mjs';
import * as Injektion from './lib/injektion.mjs';
import { slappModeller } from './lib/modellkorare.mjs';
import * as Smitta from './lib/smitta.mjs';
import * as Mallar from './lib/mallar.mjs';
import * as Nyheter from './lib/nyheter.mjs';
import * as Grunden from './lib/grunden.mjs';
import * as Handlingar from './lib/handlingar.mjs';
import { utkast as mejlutkast } from './lib/utkastmail.mjs';
import * as Svar from './lib/svar.mjs';
import * as SvarMail from './lib/svarmail.mjs';
import { skapaKo } from './lib/svarsko.mjs';
import { skapaVerktyg } from './lib/verktyg.mjs';
import { verktygsanrop } from './lib/lokal.mjs';
import { sok as webbSokRa, hamtaRa, tillatenAdress, bildSomData } from './lib/webb.mjs';
import * as Amne from './lib/amne.mjs';
import { watch as fsWatch } from 'node:fs';

const HAR = dirname(fileURLToPath(import.meta.url));

const K = las();

const Utokning = await import('./lib/utokning/index.mjs').catch(e => {
  if (e?.code === 'ERR_MODULE_NOT_FOUND' && String(e.message).includes('lib/utokning/index.mjs')) return null;
  throw e;
});
if (K.hjalp) { console.log(HJALP + (Utokning?.HJALP || '')); process.exit(0); }
{ const sparr = Utokning?.sparr?.(K) ?? null;
  if (sparr) { console.error(sparr); process.exit(2); } }

const dataDir = K.data || process.env.MAXIMUS_DATA || datakatalog();
const PORT = K.port;
if (process.env.MAXIMUS_LAUNCHD === '1') await Bakgrund.vantaPaPorten(PORT, { logg: m => console.log(m) });
if (K.modell) satModell(K.modell);
if (K.modellfil) satModellfil(K.modellfil);
if (K.kontext) satKontext(K.kontext);

const FACK = Number(process.env.MAXIMUS_FACK || Utokning?.fack?.(K) || 1);

let modellAvstangd = false;
let modellPausad = false;
satFack(FACK);
const ko = Utokning?.ko?.(K, FACK) ?? null;
if (ko) satKo(ko);

satKatalog(join(dataDir, 'modeller'));
await satSocket(join(dataDir, 'modell.sock'));

await mkdir(join(dataDir, 'sessioner'), { recursive: true });
await mkdir(join(dataDir, 'liggare'), { recursive: true });

const maximus = new Maximus(dataDir);
await maximus.ladda().catch(() => {});
if (maximus.skyddat) await maximus.lasUppUrNyckelring().catch(() => {});

const rapportadress = (() => {
  try {
    const u = new URL(Hemvist.RAPPORTER);
    return u.protocol === 'https:' || (u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) ? u.href : '';
  } catch { return ''; }
})();
const rapportfil = join(dataDir, 'felrapporter.json');
const mejlGodkanda = new Map();
const mejllager = process.env.MAXIMUS_PROV_MEJL
  ? Object.fromEntries(['mail', 'oppna', 'urklipp'].map(vad => [vad, async v => {
    await appendFile(process.env.MAXIMUS_PROV_MEJL, `${JSON.stringify({ vad, v })}\n`);
    if (vad === 'mail' && process.env.MAXIMUS_PROV_MEJL_NERE) throw new Error('Mail svarar inte (provet)');
  }]))
  : Felrapport.MACLAGER;
const rapportor = Felrapport.rapportor({
  adress: rapportadress,
  lagring: {
    las: async () => JSON.parse(await maximus.lasFil(rapportfil)),
    skriv: d => maximus.skrivFil(rapportfil, JSON.stringify(d)),
  },
  liggare: ({ kropp, kvitto, fel, agare, sekunder }) => {
    const ut = JSON.stringify(kropp);
    return liggare({ frontier: tx('srv.felrapport.liggare.mottagare'), vag: 'rapport', skickat: ut,
      mottaget: kvitto ? tx('srv.felrapport.liggare.mottaget', { nummer: kvitto.nummer }) : tx('srv.felrapport.liggare.misslyckades', { fel: fel?.message || '' }),
      tecken: ut.length, sekunder, anvandare: agare && agare !== 'en' ? agare : null, session: null, aktor: tx('srv.helig.duTitel') });
  },
});

const utokning = Utokning?.koppla ? await Utokning.koppla({
  K, dataDir, maximus, json: (...a) => json(...a), ko,
  statisk: () => statisk,
  sessioner: () => sessioner,
  installningar: () => installningar,
  sparaInstallningar: async ny => {
    installningar = ny;
    await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
  },
  jag: () => jagNu,
  liggare: p => liggare(p),
}) : null;
const IDENTITET = Boolean(utokning?.identitet);

const sessioner = new Map();
const sessionsKatalog = agare =>
  IDENTITET ? utokning.sessionsKatalog(agare) : join(dataDir, 'sessioner');
const egen = (s, jag) => !IDENTITET || s.agare === jag?.id;
const far = (jag, vad) => !IDENTITET || Boolean(utokning.far?.(jag, vad));

function nekas(res, vad, varden = {}, jag = jagNu) {
  if (far(jag, vad)) return false;
  json(res, 403, { error: utokning.nekad?.(vad, varden) || tx('srv.fel.finnsInte') });
  return true;
}

let jagNu = null;

const minSession = (id, jag, { forseglad = false } = {}) => {
  const s = sessioner.get(id);
  if (!s) return null;
  if (!egen(s, jag)) return null;
  if (!forseglad && stangd(s)) return null;
  return s;
};
function valet(s) {
  if (!s) return { behandling: Behandling.stall(installningar.behandling) };
  return { behandling: Behandling.franGammalt({
    behandling: s.behandling, destination: s.destination,
    lage: s.lage || installningar.lage, utanMask: installningar.utanMask === true }) };
}

const behandlingNu = s => Behandling.gallande(valet(s).behandling, { moln: molnPa() });

const TOMMA_INSTALLNINGAR = { namn: '', lage: 'noggrann', policy: '',
  webb: 'auto', sessionsgallring: 0, paket: FORVAL, sorter: null, klar: false, gallring: 0,
  persona: PERSONA_FORVAL,
  motor: null,
  agent: null,
  profil: null,
  exempel: null,
  ora: 'svensk',
  behandling: Behandling.BEH_FORVAL };

let installningar = { namn: '', lage: 'noggrann', policy: '', webb: 'auto',
  paket: FORVAL, sorter: null, klar: false, persona: PERSONA_FORVAL,
  behandling: Behandling.BEH_FORVAL,
  gallring: 0 };
let bevakningar = [];

let projekt = [];
const projektfil = () => join(dataDir, 'projekt.json');
const sparaProjekt = async () =>
  maximus.skrivFil(projektfil(), JSON.stringify(projekt)).catch(() => {});

const bevakningsfil = () => join(dataDir, 'bevakning.json');
const sparaBevakning = async () =>
  maximus.skrivFil(bevakningsfil(), JSON.stringify(bevakningar)).catch(() => {});

let uppdrag = [];
const uppdragsfil = () => join(dataDir, 'uppdrag.json');
const sparaUppdrag = async () =>
  maximus.skrivFil(uppdragsfil(), JSON.stringify(uppdrag)).catch(() => {});

let fynd = [], undanlagt = [];
const fyndfil = () => join(dataDir, 'fynd.json');
const sparaFynd = async () =>
  maximus.skrivFil(fyndfil(), JSON.stringify({ fynd, undanlagt })).catch(() => {});

const FYNDTAK = 500, UNDANTAK = 500;

let agentspar = [];
const SPARTAK = 200;
const agentsparfil = () => join(dataDir, 'agentspar.json');
const sparaSpar = async () =>
  maximus.skrivFil(agentsparfil(), JSON.stringify(agentspar)).catch(() => {});

let frister = [];
const fristfil = () => join(dataDir, 'frister.json');
const sparaFrister = async () =>
  maximus.skrivFil(fristfil(), JSON.stringify(frister)).catch(() => {});

async function aterlasInstallningar() {
  try { installningar = { ...installningar, ...JSON.parse(await maximus.lasFil(join(dataDir, 'installningar.json'))) }; }
  catch {  }
  if (installningar.kontext && !K.kontext) satKontext(installningar.kontext);
  if (installningar.ora) satOra(installningar.ora);
  if (installningar.orafil) satEgetOra(installningar.orafil);
  Namnmodell.satNamnmodell({ pa: installningar.namnmodell });
  Injektion.satInjektionsmodell({ pa: installningar.injektionsvakt });
  await aterstallModellval();
  return installningar;
}

async function aterstallModellval() {
  if (K.modellfil) return;
  if (installningar.modellfil) {
    const f = await stat(installningar.modellfil).catch(() => null);
    if (f?.isFile()) return satModellfil(installningar.modellfil);
  }
  const m = installningar.modell && Modeller.modell(installningar.modell);
  const vag = m && await Modeller.hittaFil(m);
  if (vag) satModellfil(vag);
}

try { installningar = { ...installningar, ...JSON.parse(await maximus.lasFil(join(dataDir, 'installningar.json'))) }; }
catch {  }
if (installningar.kontext && !K.kontext) satKontext(installningar.kontext);
if (installningar.ora) satOra(installningar.ora);
if (installningar.orafil) satEgetOra(installningar.orafil);
Namnmodell.satNamnmodell({ pa: installningar.namnmodell });
Injektion.satInjektionsmodell({ pa: installningar.injektionsvakt });
await Sprakstod.valtCachat(installningar.sprak).catch(() => {});
await aterstallModellval();
const strommar = new Map();
setTimeout(() => aktiveraMoln().catch(() => {}), 0);
const oversikt = new Set();
const korningar = new Map();

async function laddaSessioner() {
  sessioner.clear();
  const agare = IDENTITET ? await utokning.agare() : [null];
  for (const a of agare) {
    const kat = a ? sessionsKatalog(a) : join(dataDir, 'sessioner');
    for (const namn of await readdir(kat).catch(() => [])) {
      if (!namn.endsWith('.json')) continue;
      try {
        const s = await maximus.lasSession(join(kat, namn)).catch(async e => {
          if (!arForsegladUtanKod(e)) throw e;
          const yttre = JSON.parse(await maximus.lasFil(join(kat, namn)));
          const { kropp, ...huvud } = yttre;
          return { ...huvud, turer: [], forseglad: true };
        });
        if (a) s.agare = a;
        sessioner.set(s.id, s);
      } catch {  }
    }
  }
  if (uppstartKlar) await glomGlomda();
}

let uppstartKlar = false;
async function glomGlomda() {
  for (const s of [...sessioner.values()]) if (s.minne === 'glom') await taBortSession(s);
}

const MINNEN = ['isolerat', 'minns', 'glom'];
async function stadaTomma() {
  const tomma = [...sessioner.values()]
    .filter(s => !(s.turer || []).length && !(s.filer || []).length
      && !s.fast && !s.las && !s.forseglad
      && (arNySession(s.titel) || !s.titel))
    .sort((a, b) => String(b.andrad || b.skapad).localeCompare(String(a.andrad || a.skapad)));
  let bort = 0;
  for (const s of tomma.slice(1)) {
    try {
      await unlink(join(sessionsKatalog(s.agare), `${s.id}.json`));
      sessioner.delete(s.id);
      bort++;
    } catch (e) {
      if (e.code === 'ENOENT') { sessioner.delete(s.id); bort++; continue; }
      console.log(`  kunde inte ta bort ${s.id}: ${e.message}`);
    }
  }
  return bort;
}

await satVag({ vag: installningar.vag || 'direkt', adress: installningar.vagAdress || '',
  anvandare: installningar.vagAnvandare || '', losenord: installningar.vagLosenord || '' })
  .catch(() => {});

if (!maximus.skyddat || maximus.upplast) {
  await laddaSessioner();
  const bort = await stadaTomma();
  if (bort) console.log(`  ${bort} tomma sessioner städades bort`);
  await laddaBevakning();
  try { frister = JSON.parse(await maximus.lasFil(fristfil())); } catch { frister = []; }
  if (!Array.isArray(frister)) frister = [];
}

async function laddaBevakning() {
  try { projekt = JSON.parse(await maximus.lasFil(projektfil())); }
  catch { projekt = []; }
  if (!Array.isArray(projekt)) projekt = [];

  try { bevakningar = JSON.parse(await maximus.lasFil(bevakningsfil())); }
  catch { bevakningar = []; }
  if (!Array.isArray(bevakningar)) bevakningar = [];

  try { uppdrag = JSON.parse(await maximus.lasFil(uppdragsfil())); }
  catch { uppdrag = []; }
  if (!Array.isArray(uppdrag)) uppdrag = [];

  try {
    const d = JSON.parse(await maximus.lasFil(fyndfil()));
    fynd = Array.isArray(d?.fynd) ? d.fynd : [];
    undanlagt = Array.isArray(d?.undanlagt) ? d.undanlagt : [];
  } catch { fynd = []; undanlagt = []; }

  try { agentspar = JSON.parse(await maximus.lasFil(agentsparfil())); }
  catch { agentspar = []; }
  if (!Array.isArray(agentspar)) agentspar = [];

  let stadade = 0;
  for (const b of bevakningar) {
    if (b.lagrum || !b.traffar?.length) continue;
    const kvar = b.traffar
      .map(t => ({ ...t, rader: (t.rader || []).filter(r => r.vad !== 'hanvisning') }))
      .filter(t => t.rader.length);
    stadade += b.traffar.length - kvar.length;
    b.traffar = kvar;
  }
  if (stadade) console.log(`  ${stadade} hänvisningsträffar på hela lagar städades bort`);

  const fore = bevakningar.length;
  for (const s of sessioner.values()) bevakningar = Bevakning.sla(bevakningar, Bevakning.harledUr(s));
  if (bevakningar.length !== fore || stadade) {
    await sparaBevakning();
    console.log(`  ${bevakningar.length - fore} nya bevakningar härledda ur sessionerna`);
  }
}

let kollarNu = false;
async function kollaBevakningar({ alla = false } = {}) {
  if (kollarNu) return { hoppade: true };
  const kandidater = alla ? bevakningar.filter(b => !b.av) : Bevakning.mogna(bevakningar);
  if (!kandidater.length) return { kollade: 0, traffar: 0 };
  kollarNu = true;
  let traffar = 0;
  try {
    for (const b of kandidater) {
      if (b.sort !== 'lagrum') continue;
      const t0 = Date.now();
      try {
        const r = await Bevakning.kollaLagrum(b, {
          anropa: async (k, v, a) => (await Plugins.anropa(k, v, a, {})).text,
        });
        b.senast = r.senast;
        if (r.namn && !b.namn) {
          b.namn = r.namn;
          b.etikett = b.lagrum ? `${Bevakning.lasbart(b.lagrum)} ${r.namn}` : r.namn;
        }
        if (r.traff) { (b.traffar ||= []).unshift(r.traff); b.traffar = b.traffar.slice(0, 30); traffar++; }
        b.fel = null;
        await liggare({ anvandare: null, frontier: tx('srv.liggare.bevakning', { etikett: b.etikett }), vag: 'webb',
          skickat: b.uri + (b.lagrum ? ` ${b.lagrum}` : ''),
          mottaget: r.traff ? r.traff.rader.map(x => x.text).join(' · ') : tx('srv.liggare.oforandrat'),
          tecken: 0, sekunder: (Date.now() - t0) / 1000 }).catch(() => {});
      } catch (e) {
        b.fel = e.message.slice(0, 160);
      }
    }
    await sparaBevakning();
    if (traffar) sandAlla({ typ: 'bevakning' });
  } finally { kollarNu = false; }
  return { kollade: kandidater.length, traffar };
}

function morgonraden() {
  const nara = frister
    .filter(f => !f.klar && Frister.dagarKvar(f.forfaller) <= 14)
    .sort((a, b) => a.forfaller.localeCompare(b.forfaller));
  const lag = Bevakning.morgonrad(bevakningar);
  if (!nara.length) return lag;
  const f = nara[0];
  const om = Frister.brådska(f.forfaller);
  const del = nara.length === 1
    ? tx('srv.morgon.enFrist', { om: om.text })
    : tx('srv.morgon.flerFrister', { n: nara.length, om: om.text });
  return lag ? `${del}. Och ${lag[0].toLowerCase()}${lag.slice(1)}` : `${del}.`;
}

setTimeout(() => kollaBevakningar().catch(() => {}), 20000).unref?.();
setInterval(() => kollaBevakningar().catch(() => {}), 30 * 60e3).unref?.();

const AGENT_AV = { epost: null, kalender: null, bevakning: false,
  anteckningar: null, sidor: false, behandling: 'maskerad', takt: 5,
  arbetar: true,
  stadar: true, tempo: 'normal' };
const agentInst = () => ({ ...AGENT_AV, ...(installningar.agent || {}) });

const agentBehov = () => agentBehover({ profil: installningar.profil, agent: agentInst() });
const behovText = (b = agentBehov()) => tx('srv.behov.av', { vad: ochLista(b.saknar.map(x => tx(`srv.behov.${x}`))) });
const behovSvar = (res, b = agentBehov()) => json(res, 409, { error: behovText(b), behov: b });

function agentUr(v) {
  if (!v || typeof v !== 'object') return null;
  const ut = {};
  const epost = Konton.epostUr(v.epost);
  if (epost) ut.epost = epost;
  if (v.kalender) ut.kalender = Konton.kalenderUr(v.kalender);
  if (v.anteckningar?.mapp) ut.anteckningar = { konto: String(v.anteckningar.konto || '').slice(0, 120),
    mapp: String(v.anteckningar.mapp).slice(0, 120),
    skriv: v.anteckningar.skriv === true };
  ut.bevakning = v.bevakning === true;
  ut.sidor = v.sidor === true;
  if (v.meddelanden === true) ut.meddelanden = true;
  if (v.paminnelser === true) ut.paminnelser = true;
  if (v.samtal === true) ut.samtal = true;
  if (v.safari === true) ut.safari = true;
  if (v.lopande === true) ut.lopande = true;
  if (typeof v.mapp?.sokvag === 'string' && v.mapp.sokvag.startsWith('/')) ut.mapp = { sokvag: v.mapp.sokvag.slice(0, 500) };
  if (Array.isArray(v.mappar)) ut.mappar = v.mappar.filter(m => typeof m?.sokvag === 'string' && m.sokvag.startsWith('/'))
    .slice(0, 30).map(m => ({ sokvag: m.sokvag.slice(0, 500), namn: m.namn ? String(m.namn).slice(0, 80) : null }));
  ut.arbetar = v.arbetar !== false;
  ut.stadar = v.stadar !== false;
  ut.tempo = Arbete.tempoUr(v.tempo);
  if (v.nyheter === true) ut.nyheter = true;
  if (v.telefon && typeof v.telefon === 'object') {
    const kanal = Telefon.kanalUr(v.telefon.kanal);
    if (kanal !== 'av') ut.telefon = { kanal, till: Telefon.adressUr(v.telefon.till) };
  }
  if (Behandling.arBehandling(v.behandling)) ut.behandling = Behandling.stall(v.behandling);
  ut.takt = Arbete.TEMPON[ut.tempo].takt;
  if (process.env.MAXIMUS_PROV === '1' && Number(v.takt) === 0) ut.takt = 0;
  return ut;
}

async function lasKalla(k, { nu = new Date() } = {}) {
  const a = agentInst();
  if (k.typ === 'epost') {
    if (!Konton.epostKallor(a.epost).length) throw Agent.avstangd();
    return Konton.lasEpost(a.epost, { brev: Post.brev, antal: 60, nyhetsbrev: Boolean(k.nyhetsbrev),
      utskick: Svar.forslagsLage(installningar) !== 'av' });
  }
  if (k.typ === 'kalender') {
    if (!a.kalender) throw Agent.avstangd();
    const fran = new Date(nu); fran.setHours(0, 0, 0, 0);
    const till = new Date(fran); till.setDate(till.getDate() + 14); till.setHours(23, 59, 59, 0);
    const h = (await Kalender.handelser({ fran, till })).map(x => ({ ...x, ...Konton.kalenderFor(a.kalender, x) })).filter(x => x.med);
    return h.map(x => ({ id: x.id || `${x.rubrik}@${x.start}`, titel: x.rubrik || x.titel || tx('srv.kalla.utanRubrik'),
      tid: x.start, andrad: x.andrad || x.start, ...(x.etikett ? { etikett: x.etikett } : {}),
      text: [Kalender.somText(x), x.text || ''].filter(Boolean).join('\n').slice(0, 1500) }));
  }
  if (k.typ === 'bevakning') {
    if (!a.bevakning) throw Agent.avstangd();
    return bevakningar.flatMap(b => (b.traffar || []).map((t, i) => ({
      id: `${b.id}:${t.tid}:${i}`, titel: `${b.namn || b.lagrum || b.uri}`,
      tid: t.tid, text: (t.rader || []).map(r => r.vad).join(', ') })));
  }
  if (k.typ === 'sok') {
    if (!a.sidor && installningar.webb === 'av') throw Agent.avstangd();
    await modellForAgenten();
    const lig = p => liggare({ ...p, anvandare: null, session: null, aktor: tx('srv.liggare.aktorAgenten') });
    const sidor = k.antal || (k.varor ? 8 : 6);
    const r = await slaUpp(grindaSokfraga(k.fraga, { sorter: galler(installningar) }) || 'sökning', { liggare: lig, varor: k.varor, sidor, minst: Math.min(sidor, k.antal || 3), varv: sidor > 6 ? 4 : 3 });
    return (r.kallor || []).map(x => ({ id: `sok:${x.url}`, titel: x.titel, url: x.url, fran: x.vard, tid: new Date().toISOString(),
      text: `${x.vara?.pris ? `${tx('srv.kalla.pris', { pris: x.vara.pris, valuta: x.vara.valuta || 'kr' })}\n` : ''}${String(x.utdrag || '').slice(0, 1500)}`, vara: x.vara || null }));
  }
  if (k.typ === 'amne') {
    if (!a.sidor && installningar.webb === 'av' && !(a.nyheter && k.nyheter)) throw Agent.avstangd();
    const lig = p => liggare({ ...p, anvandare: null, session: null, aktor: tx('srv.liggare.aktorAgenten') });
    const ra = url => hamtaRa(url, { liggare: lig });
    if (!k.kallmangd?.length) {
      k.kallmangd = await Amne.hittaKallor(grindaSokfraga(k.fraga, { sorter: galler(installningar) }) || k.fraga, {
        sok: async f => (await webbSokRa(f, { antal: 8, liggare: lig })).traffar || [], hamtaRa: ra });
      await sparaUppdrag();
    }
    return Amne.lasKallmangd(k.kallmangd, { hamtaRa: ra, hamtaSida: url => hamtaSida(url, { tecken: 6000, liggare: lig }) });
  }
  if (k.typ === 'sida') {
    if (!a.sidor) throw Agent.avstangd();
    const r = await hamtaSida(k.url, { tecken: 12000,
      liggare: p => liggare({ ...p, anvandare: null, session: null }) });
    const text = String(r?.text || r || '');
    return [{ id: `sida:${k.url}`, titel: r?.titel || k.url, tid: new Date().toISOString(),
      andrad: createHash('sha256').update(text).digest('hex').slice(0, 16), text }];
  }
  if (k.typ === 'meddelanden') {
    if (!a.meddelanden) throw Agent.avstangd();
    return Meddelanden.meddelanden({ antal: 60 });
  }
  if (k.typ === 'paminnelser') {
    if (!a.paminnelser) throw Agent.avstangd();
    return Paminnelser.paminnelser({ dagar: 7 });
  }
  if (k.typ === 'samtal') {
    if (!a.samtal) throw Agent.avstangd();
    return Meddelanden.samtal({ antal: 60 });
  }
  if (k.typ === 'mapp') {
    const tillatna = [...(a.mappar || []), ...(a.mapp ? [a.mapp] : [])].map(m => m.sokvag);
    const sv = k.sokvag || a.mapp?.sokvag;
    if (!sv || !tillatna.includes(sv)) throw Agent.avstangd();
    return Mappar.filer(sv);
  }
  if (k.typ === 'koppling') {
    const post = mcpPost(k.id);
    if (!post?.pa || post.andrad) throw Agent.avstangd();
    await mcpIgang(post);
    const ut = [];
    for (const namn of k.verktyg || []) {
      const v = (post.verktyg || []).find(x => x.namn === namn);
      if (!v || v.sort !== 'las') continue;
      const r = await mcpAnrop(post, namn, {}, {});
      if (r.fel) continue;
      ut.push(...Mcp.posterUr(post, namn, mcpRensa(String(r.text || '')).text));
    }
    return ut;
  }
  if (k.typ === 'flode') {
    if (!a.lopande) throw Agent.avstangd();
    if (process.platform !== 'darwin') return [];
    const skiljare = randomBytes(16).toString('hex');
    const ut = await new Promise((klar, fel) => execFileCb('/usr/bin/osascript', ['-e', Flode.applescript(skiljare)], { timeout: 30000, maxBuffer: 8e6 },
      (e, o, err) => (e ? fel(new Error(/JavaScript from Apple Events|Tillåt JavaScript|Allow JavaScript/i.test(String(err))
        ? tx('srv.safari.tillatJs')
        : tx('srv.safari.svaradeInte', { fel: String(err || e.message).trim().slice(0, 160) }))) : klar(String(o || '')))));
    let duNamn = null; try { duNamn = JSON.parse(await maximus.lasFil(join(dataDir, 'du.json')))?.profil?.namn || null; } catch {  }
    return Flode.poster(ut, { skiljare, jag: [duNamn, installningar.profil?.namn, installningar.namn].filter(Boolean) });
  }
  if (k.typ === 'anteckningar') {
    if (!a.anteckningar?.mapp) throw Agent.avstangd();
    const not = await Anteckningar.anteckningar(a.anteckningar.mapp,
      { konto: a.anteckningar.konto || null, antal: 50 });
    return not.map(x => ({ id: x.id, titel: x.titel, tid: x.tid,
      andrad: x.andrad, text: x.text }));
  }
  throw new Error(tx('srv.agent.okandKalla', { typ: k.typ }));
}

function omfang(original) {
  const onskat = onskatAntal(original);
  const sidor = onskat || (arVarufraga(original) ? 8 : antalKallor(original));
  return { sidor, minst: onskat ? sidor : Math.min(3, sidor), varv: onskat && onskat > 6 ? 4 : 3,
    ...(onskat ? { onskat } : {}) };
}

async function vackPausad() {
  let vaken = false;
  try {
    await fortsattModell();
    for (let i = 0; i < 20 && !(vaken = await grindSvarar()); i++) await new Promise(r => setTimeout(r, 250));
  } catch {  }
  modellPausad = false;
  modellAvstangd = false;
  return vaken;
}

let pausaEfterVarvet = false;
let senastAgentModell = 0;
let fonsterAnslot = () => {};
async function modellForAgenten() {
  senastAgentModell = Date.now();
  if (molnPa()) return;
  if (modellPausad) {
    pausaEfterVarvet = true;
    if (!await vackPausad()) await sakerstallModell({ onSteg: () => {} });
    sandAlla({ typ: 'modell', uppe: true, pausad: false });
  } else if (!modellAvstangd && !await grindSvarar()) {
    await sakerstallModell({ onSteg: () => {} });
    sandAlla({ typ: 'modell', uppe: true, pausad: false });
  }
}

let handlingar = [];
try { handlingar = JSON.parse(await maximus.lasFil(join(dataDir, 'handlingar.json'))); } catch { handlingar = []; }
const sparaHandlingar = () => maximus.skrivFil(join(dataDir, 'handlingar.json'), JSON.stringify(handlingar.slice(-300)));
const PROV_HANDLING = process.env.MAXIMUS_HANDLING_PROV === '1';
const skrivHjalpare = async (vad, arg) => {
  const bin = await hitta('maximus-skriv');
  const argv = [vad, typeof arg === 'string' ? arg : JSON.stringify(arg)];
  const ut = await new Promise((klar, fel) => execFileCb(bin || '/usr/bin/swift', bin ? argv : [join(HAR, 'verktyg', 'skriv.swift'), ...argv],
    { timeout: 60000 }, (e, o) => (String(o || '').trim() ? klar(o) : fel(new Error(e?.message || tx('srv.handling.skrivhjalparenSvaradeInte'))))));
  const d = JSON.parse(String(ut).trim().split(/\r?\n/).at(-1));
  if (d.fel) throw new Error(d.fel);
  return d;
};
const mcpEfterJa = async o => {
  const post = mcpPost(o.koppling);
  if (!post?.pa || post.andrad) throw new Error(tx('srv.mcp.avstangd'));
  if (!(post.verktyg || []).some(v => v.namn === o.verktyg)) throw new Error(tx('srv.mcp.inteGodkant', { verktyg: o.verktyg }));
  await mcpIgang(post);
  const schema = (post.verktyg || []).find(v => v.namn === o.verktyg)?.schema;
  const r = await mcpAnrop(post, o.verktyg, McpGranska.rensaArgument(schema, o.argument || {}), { tillatSkriv: true });
  if (r.fel) throw new Error(mcpRensa(String(r.text || '')).text.slice(0, 300) || tx('srv.mcp.svaradeFel'));
  return { id: null, text: mcpRensa(String(r.text || '')).text.slice(0, 4000) };
};
const handlingsvagar = () => {
  if (PROV_HANDLING) {
    const prov = vad => async a => ({ id: `prov-${randomUUID().slice(0, 8)}`, prov: true, vad, a });
    return { skriv: (v, a) => prov(v)(a), taBort: async id => ({ borttagen: id, prov: true }), mejlutkast: prov('mejlutkast'), anteckning: prov('anteckning'), genvag: prov('genvag'), mcp: mcpEfterJa };
  }
  const a = agentInst();
  return {
    mcp: mcpEfterJa,
    skriv: (vad, arg) => skrivHjalpare(vad, arg),
    taBort: id => skrivHjalpare('ta-bort', id),
    mejlutkast: o => mejlutkast(o),
    anteckning: o => {
      if (!a.anteckningar?.mapp) throw new Error(tx('srv.handling.ingenAnteckningsmapp'));
      return Anteckningar.skriv(a.anteckningar.mapp, { rubrik: o.rubrik, text: o.text, konto: a.anteckningar.konto || null });
    },
    genvag: o => new Promise((klar, fel) => {
      const p = execFileCb('/usr/bin/shortcuts', ['run', o.namn, ...(o.indata ? ['-i', '-'] : [])], { timeout: 120000 },
        (e, ut) => (e ? fel(new Error(tx('srv.handling.genvagenSvarade', { fel: e.message }))) : klar({ id: null, ut: String(ut || '').slice(0, 500) })));
      if (o.indata) p.stdin.end(String(o.indata));
    }),
  };
};
async function utforHandling(f) {
  try {
    f.resultat = await Handlingar.utfor(f, handlingsvagar());
    f.status = 'gjord';
  } catch (e) { f.status = 'fel'; f.fel = e.message; }
  f.gjord = new Date().toISOString();
  await liggare({ frontier: tx('srv.liggare.handling'), vag: 'lokal', skickat: f.beskrivning, mottaget: f.status === 'gjord' ? tx('srv.liggare.gjort') : tx('srv.liggare.fel', { fel: f.fel }),
    tecken: f.beskrivning.length, sekunder: 0, anvandare: null, session: f.session, aktor: tx('srv.liggare.aktorAgenten') }).catch(() => {});
  await sparaHandlingar();
  await speglaHandling(f);
  return f;
}
async function speglaHandling(f) {
  const s = f.session && sessioner.get(f.session);
  const oppet = s && !(s.las?.styrka === 'forseglad') && !s.las && !s.forseglad;
  const t = oppet ? s.turer?.find(x => x.id === f.tur) : null;
  if (t) {
    t.handlingar = (t.handlingar || []).map(h => (h.id === f.id ? { ...f } : h));
    if (!t.handlingar.some(h => h.id === f.id)) t.handlingar.push({ ...f });
    await spara(s);
  }
  sandAlla({ typ: 'handling', handling: f });
  if (f.session) sand(f.session, { typ: 'handling', handling: f });
}

const mcpPoster = () => (Array.isArray(installningar.mcp) ? installningar.mcp : []);
const mcpPost = id => mcpPoster().find(p => p.id === id) || null;
const mcpAndraNamn = () => mcpPoster().flatMap(p => (p.verktyg || []).map(v => v.namn));
async function sparaMcp(lista) {
  installningar = { ...installningar, mcp: lista };
  await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
}
let mcpInloggning = null;
const mcpForeslagna = new Map();
const mcpSortnamn = sort => ({ las: tx('srv.mcp.sort.las'), skriv: tx('srv.mcp.sort.skriv'), skicka: tx('srv.mcp.sort.skicka'),
  betala: tx('srv.mcp.sort.betala'), radera: tx('srv.mcp.sort.radera') }[sort] || tx('srv.mcp.sort.skriv'));

const mcpAuktorisering = post => Mcp.auktoriseringFor(post, {
  onFornyad: async utgar => {
    await sparaMcp(mcpPoster().map(p => (p.id === post.id ? { ...p, oauth: { ...p.oauth, utgar } } : p)));
  },
});

async function mcpIgang(post) {
  if (Plugins.arIgang(post.id)) return;
  try {
    const r = await Mcp.starta(post, { auktorisering: mcpAuktorisering(post) });
    if (r.forsta) {
      if (r.forsta.vagras) {
        r.koppling.stang();
        await sparaMcp(mcpPoster().map(p => (p.id === post.id ? { ...p, pa: false, andrad: true, skal: r.forsta.skal } : p)));
        throw new Error(tx('srv.mcp.lokalStyrde', { namn: post.namn }));
      }
      const verktyg = r.forsta.verktyg.map(v => ({ namn: v.namn, om: v.om, sort: v.sort, forval: v.sort, schema: v.schema, hash: v.hash, far: false }));
      const ny = { ...post, verktyg, fingeravtryck: r.forsta.fingeravtryck };
      await sparaMcp(mcpPoster().map(p => (p.id === post.id ? ny : p)));
      Mcp.begransa(r.koppling, ny);
    }
    Plugins.lagIn(post.id, r.koppling);
  } catch (e) {
    if (e.andrad || e.summa) {
      await sparaMcp(mcpPoster().map(p => (p.id === post.id ? { ...p, pa: false, andrad: true, andringar: e.andringar || [] } : p)));
      sandAlla({ typ: 'kopplingar' });
    }
    throw e;
  }
}

async function mcpAnrop(post, verktyg, argument, { tillatSkriv = false, session = null } = {}) {
  const t0 = Date.now();
  const r = await Plugins.anropa(post.id, verktyg, argument, { sorter: galler(installningar), tillatSkriv, timeout: 60000 });
  const skickade = r.skickadeArgument ?? {};
  await liggare({ frontier: tx('srv.liggare.koppling', { koppling: post.namn }), vag: 'koppling',
    skickat: `${verktyg} ${JSON.stringify(skickade)}`.slice(0, 2000), mottaget: String(r.text).slice(0, 8000),
    tecken: String(r.text).length, sekunder: Math.round((Date.now() - t0) / 1000), session, anvandare: null,
    aktor: tx('srv.liggare.aktorAgenten') }).catch(e => console.error('liggaren kunde inte skriva kopplingen:', e.message));
  return { ...r, skickade };
}

function mcpVerktygFor(session, uppgift = '') {
  const poster = mcpPoster().filter(p => p.pa && !p.andrad && (p.overallt || p.session === session));
  const namnd = p => [p.namn, p.registernamn, p.behov].filter(Boolean).some(n => String(uppgift).toLowerCase().includes(String(n).toLowerCase().split(/[\s/]/).pop()));
  const antal = poster.reduce((n, p) => n + (p.verktyg || []).length, 0);
  const valda = antal > 12 ? poster.filter(namnd) : poster;
  const sett = new Set();
  return valda.flatMap(p => (p.verktyg || []).map(v => {
    const t = { namn: McpGranska.verktygsnamn(p.id, v.namn), verktyg: v.namn, koppling: p.id, kopplingsnamn: p.namn,
      sort: v.sort, sortnamn: mcpSortnamn(v.sort), far: Boolean(v.far && v.sort === 'las'),
      parametrar: v.schema && typeof v.schema === 'object' && v.schema.type === 'object' ? v.schema : { type: 'object', properties: {} } };
    t.beskrivning = tx('lib.verktyg.om.mcp', { koppling: p.namn, sort: t.sortnamn, om: v.om || v.namn });
    const g = McpGranska.granskaModellform({ name: t.namn, description: t.beskrivning, parameters: t.parametrar });
    if (!g.ok) { console.error(`koppling ${p.id}: ${v.namn} stoppades före modellen: ${g.skal.varfor}`); return null; }
    return t;
  })).filter(v => v && !sett.has(v.namn) && sett.add(v.namn));
}

async function sokKoppling(behov, { session = null } = {}) {
  const ord = grindaSokfraga(behov.sok, { sorter: galler(installningar) }) || '';
  if (!ord.trim()) return null;
  const t0 = Date.now();
  const r = await McpRegister.sok(ord, { behov });
  await liggare({ frontier: tx('srv.liggare.mcpRegister'), vag: 'register', skickat: r.adresser.join(' ').slice(0, 2000),
    mottaget: r.forslag.map(f => `${f.registernamn} · ${f.url}`).join('\n') || tx('srv.mcp.ingaForslag'),
    tecken: 0, sekunder: Math.round((Date.now() - t0) / 1000), session, anvandare: null, aktor: tx('srv.liggare.aktorAgenten') }).catch(() => {});
  for (const f of r.forslag) mcpForeslagna.set(f.url, f);
  return { behov: behov.sok, allmant: Boolean(behov.allmant), sok: ord, forslag: r.forslag, totalt: r.totalt };
}

const mcpGranskningsrad = (kort, session = null) => liggare({ frontier: tx('srv.liggare.mcpGranskning', { vard: kort.vard || kort.url }), vag: 'koppling',
  skickat: 'initialize · tools/list', mottaget: kort.status === 'fel' ? String(kort.fel || '') : tx('srv.mcp.liggareVerktyg', { n: kort.verktyg.length, status: kort.status }),
  tecken: 0, sekunder: 0, session, anvandare: null, aktor: tx('srv.helig.duTitel') }).catch(() => {});

async function speglaKort(kort) {
  const s = kort.session && sessioner.get(kort.session);
  const oppet = s && !(s.las?.styrka === 'forseglad') && !s.las && !s.forseglad;
  const t = oppet ? s.turer?.find(x => x.id === kort.tur) : null;
  if (t) { t.kopplingskort = Mcp.somKort(kort); await spara(s); }
  sandAlla({ typ: 'kopplingskort', kort: Mcp.somKort(kort) });
  if (kort.session) sand(kort.session, { typ: 'kopplingskort', kort: Mcp.somKort(kort) });
}

function mcpSvar(kort) {
  const n = kort.verktyg.length, l = kort.verktyg.filter(v => v.sort === 'las').length;
  if (kort.status === 'klar') return tx('srv.mcp.svar.klar', { namn: kort.namn, n, las: l, andra: n - l });
  if (kort.status === 'vagras') return tx('srv.mcp.svar.vagras', { namn: kort.namn || kort.vard, n: kort.skal.length });
  if (kort.status === 'inloggning') return tx('srv.mcp.svar.inloggning', { vard: kort.vard });
  if (kort.status === 'nyckel') return tx('srv.mcp.svar.nyckel', { vard: kort.vard });
  if (kort.status === 'tom') return tx('srv.mcp.svar.tom', { namn: kort.namn || kort.vard });
  return tx('srv.mcp.svar.fel', { fel: kort.fel || '' });
}

let svarsforslag = [];
try { svarsforslag = JSON.parse(await maximus.lasFil(join(dataDir, 'svarsforslag.json'))); } catch { svarsforslag = []; }
const sparaSvarsforslag = () => maximus.skrivFil(join(dataDir, 'svarsforslag.json'), JSON.stringify(svarsforslag.slice(-200)));
const PROV_SVAR = process.env.MAXIMUS_PROV === '1' || PROV_HANDLING;
const svarProv = { skript: [], fel: null, skickade: 0 };
if (PROV_SVAR) {
  SvarMail.satKorare(async (skript, { argv = [] } = {}) => {
    svarProv.skript.push({ skript, argv });
    if (/repeat with s in signatures/.test(skript)) {
      const [F, R] = [/"(~F[0-9a-f]+~)"/.exec(skript)?.[1], /"(~R[0-9a-f]+~)"/.exec(skript)?.[1]];
      return `Prov${F}Med vänlig hälsning\nProvare\nprov@example.com${R}`;
    }
    if (svarProv.fel) { const f = svarProv.fel; svarProv.fel = null; throw new Error(f); }
    if (argv[6] !== '1') return 'oppnat';
    svarProv.skickade++;
    return 'skickat';
  });
}

const svarMinne = { kanda: null, mina: new Map(), nar: 0 };
async function svarAdresser(konto) {
  if (PROV_SVAR) return { kanda: new Set(), mina: new Set(['prov@example.com']) };
  if (Date.now() - svarMinne.nar > 36e5 || !svarMinne.kanda) {
    svarMinne.kanda = new Set(await Post.skrivitTill().catch(() => []));
    svarMinne.mina = new Map(); svarMinne.nar = Date.now();
  }
  if (!svarMinne.mina.has(konto)) svarMinne.mina.set(konto, new Set(await Post.kontoAdresser(konto).catch(() => [])));
  return { kanda: svarMinne.kanda, mina: svarMinne.mina.get(konto) };
}

async function inkorgsSamtalet() {
  const helig = [...sessioner.values()].find(x => x.helig?.sort === 'epost' && !x.las && !x.forseglad && !x.arkiverad);
  return helig || agentSamtalet();
}

async function svarSignatur(konto) {
  const lista = await SvarMail.signaturer().catch(() => []);
  const sparad = installningar.svar?.signaturer?.[konto];
  const vald = SvarMail.valjSignatur(lista, { adresser: [...(await svarAdresser(konto)).mina], sparad });
  return { signaturer: lista.map(x => ({ namn: x.namn, text: x.text.slice(0, 400) })), vald };
}

async function foreslaSvar({ konto, lada = 'INBOX', id, session = null, agenten = false, u = null, text: egen = null }) {
  const fore = svarsforslag.find(f => f.konto === konto && f.brevId === String(id) && f.status === 'forslag');
  if (fore && agenten) return fore;
  const brev = await Post.text(konto, id, { lada });
  if (!brev) throw new Error(tx('srv.post.brevOlasbart'));
  const delat = Post.delaTrad(brev.text);
  const lage = Svar.forslagsLage(installningar);
  if (installningar.injektionsvakt !== false) {
    await Injektion.forbered([`${brev.amne || ''}\n${delat.nytt || brev.text || ''}`, `${brev.amne || ''}\n${brev.text || ''}`], { tak: 5000 }).catch(() => {});
  }
  if (agenten) {
    const { kanda, mina } = await svarAdresser(konto);
    const b = Svar.behoverSvar({ brev, nytt: delat.nytt || brev.text, lage, kanda, mina, till: brev.till });
    if (!b.ja) return null;
  }
  if (egen != null && !agenten) {
    const f = Svar.nyttForslag({ brev, konto, lada, etikett: Konton.kontoEtikett(agentInst().epost, konto), text: egen, session });
    if (fore) fore.status = 'ersatt';
    svarsforslag.push(f); await sparaSvarsforslag();
    return f;
  }
  await modellForAgenten();
  const profil = Profil.somText(u ? malet(u) : installningar.profil) || '';
  let slutsats = '';
  if (agenten) {
    const a = agentInst();
    const tillgang = [a.kalender && bestamdKalla('kalender'), a.epost?.konto && bestamdKalla('epost')].filter(Boolean).join(', ');
    const r = await A2A.undersok({ fynd: { titel: brev.amne, fran: brev.fran, varfor: tx('srv.svar.varfor'), text: brev.text },
      uppdrag: Svar.undersokningsUppdrag(), profil, tillgang, varv: 2,
      agent: o => verktygsanrop({ meddelanden: o.meddelanden, verktyg: [], tak: 400 }),
      assistent: (fraga, om) => agentSlinga({ uppgift: fraga, sammanhang: om, session: null, obevakad: true, webb: false }),
    }).catch(() => null);
    const kollad = r?.slutsats ? Kontroll.undersokningKontroll(r.slutsats, { lage: Kontroll.lage(installningar),
      underlag: `${brev.fran || ''}\n${brev.amne || ''}\n${brev.text || ''}\n${(r.rader || []).map(x => x.text).join('\n')}` }).slutsats : null;
    slutsats = kollad?.sakerhet === 'låg' && kollad !== r.slutsats ? '' : (kollad?.text || '');
  }
  const prompt = Svar.forslagsprompt({ brev, trad: brev.text, profil, slutsats, lage });
  let text = Svar.lasForslag(await svaraLokalt(prompt, { plats: 'agent', tak: 700, timeout: 180000 }));
  if (!text && agenten) return null;
  const harkomst = Smitta.meningarsHarkomst(text || '', { brev: `${brev.amne || ''}\n${brev.text || ''}`, kallor: [
    { kalla: tx('lib.smitta.kalla.undersokning'), text: slutsats },
    { kalla: tx('lib.smitta.kalla.profil'), text: profil },
  ] });
  let kontrollen = null;
  if (text && Kontroll.lage(installningar) !== 'av') {
    const k = await Kontroll.efterkontroll({ svar: text, lage: Kontroll.lage(installningar),
      kontext: { underlag: `${brev.fran || ''}\n${brev.amne || ''}\n${brev.text || ''}\n${slutsats}`, profil, form: 'utkast', gjort: [],
        sprak: Kontroll.sprakAv(brev.text) || Sprakstod.aktuellt() },
      forsok: async rattelse => Svar.lasForslag(await svaraLokalt(`${prompt}\n\n${rattelse}`, { plats: 'agent', tak: 700, timeout: 180000 })) || null,
    }).catch(() => null);
    if (k) { text = k.svar; kontrollen = k.kontroll; }
  }
  const f = Svar.nyttForslag({ brev, konto, lada, etikett: Konton.kontoEtikett(agentInst().epost, konto), text: text || '', varfor: slutsats, harkomst, session });
  if (kontrollen && !kontrollen.ok) f.kontroll = kontrollen;
  if (fore) fore.status = 'ersatt';
  svarsforslag.push(f);
  await sparaSvarsforslag();
  return f;
}

let foreslar = false;
async function foreslaSvarFor(u, nya, nu = new Date()) {
  if (IDENTITET) return;
  if (foreslar || Svar.forslagsLage(installningar) === 'av') return;
  const brev = nya.filter(f => f.brev?.konto && f.brev?.id && !f.svarsforslag);
  if (!brev.length) return;
  foreslar = true;
  try {
    for (const f of brev.slice(0, 5)) {
      if (korningar.size > 0) break;
      f.svarsforslag = 'provat';
      const fs = await foreslaSvar({ konto: f.brev.konto, lada: f.brev.lada || 'INBOX', id: f.brev.id, agenten: true, u }).catch(() => null);
      if (!fs) continue;
      f.svarsforslag = fs.id;
      const s = await inkorgsSamtalet();
      const tid = new Date().toISOString();
      const svarTur = { id: randomUUID(), tid, fraga: '', av: 'maximus', avAgenten: true, status: 'klar', svar: '', kvitto: [], kallor: [], uppdrag: u.id,
        sager: tx('srv.svar.rad', { namn: fs.namn || fs.till, amne: fs.original }),
        uppdragskort: { titel: tx('srv.svar.kortTitel'), instruktion: String(u.instruktion || '').slice(0, 600), tid: new Date(nu).toISOString(),
          var: bestamdKalla('epost'), lasta: 1, fynd: 1, undan: 0, ursprung: null, engang: false, uppdrag: u.id },
        svarsforslag: fs };
      s.turer.push(svarTur); s.andrad = tid;
      fs.session = s.id;
      await spara(s); await sparaSvarsforslag();
      sand(s.id, { typ: 'agenttur', session: s.id, tur: svarTur });
      sandAlla({ typ: 'svar', forslag: fs });
      sandAlla({ typ: 'lista' });
    }
    await sparaFynd();
  } finally { foreslar = false; }
}

const svarEgna = async konto => (PROV_SVAR ? ['prov@example.com'] : Post.kontoAdresser(konto).catch(() => []));
const svarsko = skapaKo({
  skicka: async p => SvarMail.svara({ konto: p.konto, lada: p.lada, id: p.brevId, text: p.text, signatur: p.signatur, amne: p.amne,
    till: p.till, egna: await svarEgna(p.konto), skicka: true }),
  klar: async (p, { resultat, fel }) => {
    const f = p.forslag && svarsforslag.find(x => x.id === p.forslag);
    if (fel) {
      await liggare({ frontier: tx('srv.liggare.skickatEpost', { till: p.till.join(', ') }), vag: 'epost',
        skickat: tx('srv.liggare.skickatText', { till: p.till.join(', '), amne: p.amne, text: p.text, signatur: p.signatur || tx('srv.svar.ingenSignatur') }),
        mottaget: tx('srv.liggare.skickatFel', { fel }), tecken: p.text.length, sekunder: 0, anvandare: null, session: p.session || null,
        aktor: tx('srv.liggare.aktorDu') }).catch(() => {});
      sandAlla({ typ: 'svar', skickat: { id: p.id, forslag: p.forslag, fel } });
      return;
    }
    const nar = new Date().toISOString();
    if (f) { f.status = 'skickat'; f.skickat = nar; f.text = p.text; await sparaSvarsforslag().catch(() => {}); }
    await liggare({ frontier: tx('srv.liggare.skickatEpost', { till: p.till.join(', ') }), vag: 'epost', tid: nar,
      skickat: tx('srv.liggare.skickatText', { till: p.till.join(', '), amne: p.amne, text: p.text, signatur: p.signatur || tx('srv.svar.ingenSignatur') }),
      mottaget: tx('srv.liggare.skickatMail', { mottagare: (resultat?.mottagare || p.till).join(', ') }),
      tecken: p.text.length, sekunder: 0, anvandare: null, session: p.session || null, aktor: tx('srv.liggare.aktorDu') }).catch(() => {});
    sandAlla({ typ: 'svar', skickat: { id: p.id, forslag: p.forslag, klart: true, nar } });
  },
});

function brevSomText(brev) {
  const delat = Post.delaTrad(brev.text);
  return [
    tx('srv.post.fran', { v: brev.fran }),
    tx('srv.post.amne', { v: brev.amne }),
    brev.tid ? tx('srv.post.tid', { v: brev.tid }) : null,
    brev.bilagor.length ? tx('srv.post.bilagor', { v: brev.bilagor.join(', ') }) : null,
    '',
    delat.nytt || brev.text,
    delat.citerat ? tx('srv.post.tidigareITraden', { citerat: delat.citerat }) : '',
  ].filter(v => v !== null).join('\n').trim();
}

async function lasOriginal(ref) {
  const a = agentInst();
  if (ref?.sort === 'mejl') {
    if (process.env.MAXIMUS_PROV === '1' || process.env.MAXIMUS_HANDLING_PROV === '1') return null;
    if (!Post.finns() || !Konton.epostKallor(a.epost).some(x => x.konto === ref.konto && x.lada === (ref.lada || 'INBOX'))) return null;
    const brev = await Post.text(ref.konto, ref.id, { lada: ref.lada || 'INBOX' });
    return brev ? brevSomText(brev) : null;
  }
  if (ref?.sort === 'fil') {
    const fil = await realpath(String(ref.sokvag || '')).catch(() => null);
    for (const m of [...(a.mappar || []), ...(a.mapp ? [a.mapp] : [])]) {
      const rot = await realpath(m.sokvag).catch(() => null);
      if (rot && fil && fil.startsWith(rot + sep)) return (await lasDokument(basename(fil), await readFile(fil))).text.slice(0, 60000);
    }
    return null;
  }
  if (ref?.sort === 'anteckning') {
    if (!a.anteckningar?.mapp) return null;
    const n = (await Anteckningar.anteckningar(a.anteckningar.mapp, { konto: a.anteckningar.konto || null, antal: 200 })).find(x => String(x.id) === ref.id);
    return n ? `${n.titel}\n\n${n.text}` : null;
  }
  if (ref?.sort === 'kalender') {
    if (!a.kalender || !ref.tid || Number.isNaN(Date.parse(ref.tid))) return null;
    const t = Date.parse(ref.tid);
    const h = (await Kalender.handelser({ fran: new Date(t - 864e5), till: new Date(t + 864e5) })).find(x => (x.id || `${x.rubrik}@${x.start}`) === ref.id);
    return h ? Kalender.somText(h) : null;
  }
  return null;
}

async function agentSlinga({ uppgift, sammanhang = '', onSteg = () => {}, signal, session = null, tur = null, styrning = false, publika = [], steg = null, begransad = false, obevakad = true, webb = true, underlag = [], egen = null, fran = [], kontrollera = null, betrodd = {} } = {}) {
  await modellForAgenten();
  const lig = p => liggare({ ...p, anvandare: null, session, aktor: tx('srv.liggare.aktorAgenten') });
  const a = agentInst();
  const uppgiftBetrodd = betrodd.uppgift ?? (!obevakad && !begransad);
  const smitta = Smitta.nySmitta({ egen: egen ?? (uppgiftBetrodd ? uppgift : ''),
    fran: [...fran,
      ...(uppgiftBetrodd ? [] : [{ text: uppgift, kalla: tx('lib.smitta.kalla.uppgift') }]),
      ...(sammanhang && !betrodd.sammanhang ? [{ text: sammanhang, kalla: tx('lib.smitta.kalla.sammanhang') }] : []),
      ...underlag.map(k => ({ text: `${k.titel || ''}\n${k.utdrag || k.reserv || ''}`, kalla: tx('lib.smitta.kalla.underlag', { titel: String(k.titel || '').slice(0, 60) }) }))],
    bedom: installningar.injektionsvakt === false ? null : t => Injektion.bedom(t, { tak: 5000 }) });
  const ctx = {
    smitta,
    lasKalla: async typ => {
      const poster = await lasKalla(typeof typ === 'string' ? { typ } : typ);
      if (typ === 'epost') {
        const med = poster.filter(x => x.brev?.konto).slice(0, 5);
        const texter = await Underlag.lasManga(med, p => Post.text(p.brev.konto, p.brev.id, { lada: p.brev.lada || 'INBOX' }).then(t => String(t?.text || t || '').slice(0, 1500)));
        med.forEach((p, i) => { if (texter[i]) p.text = texter[i]; });
      }
      return poster;
    },
    kalender: o => Kalender.handelser(o),
    webbSok: async fraga => {
      if (begransad) throw new Error(tx('srv.verktyg.inteTelefon'));
      if (!webb) throw new Error(tx('srv.verktyg.webbenAv'));
      if (installningar.webb === 'av' && !a.sidor) throw new Error(tx('srv.agent.webbenAv'));
      const val = vagval(fraga, { material: `${uppgift}\n${sammanhang}`, publika });
      onSteg({ verktyg: 'vagval', argument: { fraga }, kort: val.webb ? tx('srv.steg.vagvalWebb', { form: val.form, varfor: val.varfor }) : tx('srv.steg.vagvalIngenWebb', { varfor: val.varfor }) });
      if (!val.webb || !val.fraga) return { val, traffar: [] };
      const ut = val.form === 'original' ? val.fraga : grindaSokfraga(val.fraga, { sorter: galler(installningar) });
      if (!ut) return { val, traffar: [] };
      const r = await webbSokRa(ut, { antal: 8, liggare: lig, signal });
      return { val: { ...val, fraga: ut }, traffar: r.traffar || [] };
    },
    webbHamta: async url => {
      if (begransad) throw new Error(tx('srv.verktyg.inteTelefon'));
      if (!webb) throw new Error(tx('srv.verktyg.webbenAv'));
      if (installningar.webb === 'av' && !a.sidor) throw new Error(tx('srv.agent.webbenAv'));
      return hamtaSida(url, { tecken: 6000, liggare: lig, signal });
    },
    safari: () => (begransad ? Promise.reject(new Error(tx('srv.verktyg.inteTelefon'))) : lasSafari()),
    lasFil: async fil => (await lasDokument(fil.split('/').pop(), await readFile(fil))).text.slice(0, 12000),
    genvagar: () => new Promise(los => execFileCb('/usr/bin/shortcuts', ['list'], { timeout: 15000 }, (e, ut) => los(e ? [] : String(ut).split('\n').filter(Boolean).slice(0, 80)))),
    underlag,
    lasUnderlag: k => (k.ref?.sort === 'sida' ? ctx.webbHamta(k.ref.url).then(x => x?.text || k.reserv).catch(() => k.reserv)
      : Underlag.lasHela(k, lasOriginal)),
  };
  const skapade = [];
  ctx.arSmittad = () => smitta.smittad;
  ctx.smittkallor = () => smitta.kallor;
  ctx.foresla = async (typ, argument, granskning = {}) => {
    const sp = Handlingar.spak(installningar, typ);
    if (sp === 'aldrig') return tx('srv.verktyg.aldrigFar', { handling: Handlingar.HANDLINGAR[typ].namn.toLowerCase() });
    const fel = Handlingar.validera(typ, argument, { genvagar: typ === 'genvag' ? await ctx.genvagar() : null });
    if (fel) return tx('srv.verktyg.fel', { fel });
    const smittad = Boolean(granskning.smittad || smitta.smittad);
    const f = Handlingar.nyttForslag({ typ, argument, session, tur,
      harkomst: granskning.harkomst || {}, smittad: smittad ? (granskning.kallor || smitta.kallor) : null });
    handlingar.push(f); skapade.push(f);
    const sjalv = Handlingar.utforDirekt({ spak: sp, begransad, obevakad, smittad });
    if (sjalv) { await utforHandling(f); return f.status === 'gjord' ? tx('srv.verktyg.gjort', { beskrivning: f.beskrivning }) : tx('srv.verktyg.fel', { fel: f.fel }); }
    await sparaHandlingar();
    await speglaHandling(f);
    return tx('srv.verktyg.foreslaget', { beskrivning: f.beskrivning });
  };
  if (!begransad) {
    ctx.mcpVerktyg = mcpVerktygFor(session, uppgift);
    ctx.mcpKor = async (t, ra) => {
      const post = mcpPost(t.koppling);
      if (!post?.pa || post.andrad) return `Fel: ${tx('srv.mcp.avstangd')}`;
      const arg = McpGranska.rensaArgument(t.parametrar, ra);
      const g = smitta.kopplingsanrop({ server: post.id, verktyg: t.verktyg, lasande: t.sort === 'las', argument: arg });
      if (g.stopp) return `Fel: ${g.stopp}`;
      if (t.far && t.sort === 'las' && !obevakad && !g.kravJa) {
        try {
          await mcpIgang(post);
          const svar = await mcpAnrop(post, t.verktyg, arg, { session });
          const text = await smitta.las(String(svar.text || '').slice(0, 6000), { verktyg: `koppling:${post.id}`, kalla: Smitta.kopplingsKalla(post.namn) });
          if (svar.fel) return `Fel: ${mcpRensa(text).text.slice(0, 300)}`;
          return mcpBilaga(`${post.namn} · ${t.verktyg}`, text, { om: tx('srv.mcp.svarFranKoppling') });
        } catch (e) { return `Fel: ${e.message}`; }
      }
      let grindat;
      try { grindat = mcpGrinda(arg, { karta: new Map(), raknare: new Map(), sorter: galler(installningar) }); }
      catch (e) { return `Fel: ${e.message}`; }
      const f = Handlingar.nyttForslag({ typ: 'mcp', argument: { koppling: post.id, kopplingsnamn: post.namn, verktyg: t.verktyg, sort: t.sort, argument: grindat }, session, tur,
        harkomst: Object.fromEntries(Object.entries(g.falt || {}).map(([k, v]) => [`argument.${k}`, v])),
        smittad: smitta.smittad ? smitta.kallor : null });
      handlingar.push(f); skapade.push(f);
      await sparaHandlingar();
      await speglaHandling(f);
      return tx('srv.verktyg.foreslaget', { beskrivning: f.beskrivning });
    };
  }
  if (!obevakad && !begransad && session) {
    ctx.hittaKoppling = async tjanst => {
      const t = String(tjanst || '').trim();
      const kand = McpGranska.behovAv(`i ${t}`) || McpGranska.behovAv(`mitt ${t}`)
        || (/^[\p{L}][\p{L} .-]{1,30}$/u.test(t) && t.split(/\s+/).length <= 3 ? { sok: t.toLowerCase(), allmant: false } : null);
      if (!kand) return `Fel: ${tx('srv.mcp.hittaVad')}`;
      if (McpGranska.tacker(mcpPoster(), kand)) return tx('srv.mcp.redanInkopplad', { tjanst: kand.sok });
      const r = await sokKoppling(kand, { session }).catch(e => ({ fel: e.message }));
      if (r?.fel) return `Fel: ${r.fel}`;
      if (!r?.forslag?.length) return tx('srv.mcp.ingetIRegistret', { tjanst: kand.sok });
      hittadeKopplingar = r;
      return tx('srv.mcp.foreslog', { n: r.forslag.length, namn: r.forslag.map(f => f.titel).join(', ') });
    };
  }
  let hittadeKopplingar = null;
  const r = await Slinga({ uppgift, sammanhang, verktyg: [...(styrning && !obevakad ? styrverktyg({ text: egen ?? uppgift, smitta }) : []), ...skapaVerktyg(ctx, a, { obevakad })], signal, onSteg, ...(steg ? { steg } : {}), kontrollera,
    smitta, markera: DATAMARKERING,
    anropa: o => verktygsanrop({ meddelanden: o.meddelanden, verktyg: o.verktyg, signal }) });
  const rader = smitta.rader();
  for (const f of smitta.forsok) {
    await lig({ frontier: tx('srv.liggare.skydd'), vag: 'lokal', skickat: tx('srv.liggare.skyddRad', { slag: f.slag, kalla: f.kalla || '-', grund: f.regel ? tx('srv.liggare.skyddRegel') : f.poang != null ? String(Math.round(f.poang * 100) / 100) : '-' }),
      mottaget: tx('srv.liggare.skyddStoppat'), tecken: 0, sekunder: 0 }).catch(() => {});
  }
  return { ...r, handlingar: skapade, kopplingsforslag: hittadeKopplingar,
    skydd: { smittad: smitta.smittad ? smitta.kallor : [], rader, texter: smitta.texter() } };
}

const DATAMARKERING = false;

let agentKontroll = new AbortController();
const foretradeFel = () => Object.assign(new Error('företräde'), { foretrade: true });
function avbrytAgenten() {
  agentKontroll.abort(foretradeFel());
  agentKontroll = new AbortController();
}
async function agentAnrop(prompt, o = {}) {
  const signal = agentKontroll.signal;
  if (korningar.size > 0) throw foretradeFel();
  try { return await svaraLokalt(prompt, { plats: 'agent', timeout: 180000, ...o, signal }); }
  catch (e) { throw signal.aborted ? foretradeFel() : e; }
}
const VARV_MS = 6 * 60e3;

const agentTanka = async (prompt, { tak = 900 } = {}) => {
  try { await modellForAgenten(); return await agentAnrop(prompt, { tak }); }
  catch (e) { if (!e?.foretrade && Vakten.arModellfel(e)) e.vanta = true; throw e; }
};

function hjalpLage() {
  const a = agentInst();
  const pa = v => (v ? tx('srv.hjalpLage.pa') : tx('srv.hjalpLage.av'));
  return [
    tx('srv.hjalpLage.agentenLaser', { epost: pa(a.epost), kalender: pa(a.kalender), anteckningar: pa(a.anteckningar), meddelanden: pa(a.meddelanden), paminnelser: pa(a.paminnelser), samtal: pa(a.samtal), mapp: pa(a.mapp), safari: pa(a.safari), sidor: pa(a.sidor), nyheter: pa(a.nyheter) }),
    tx('srv.hjalpLage.tempo', { tempo: a.tempo, takt: a.takt, arbetar: pa(a.arbetar), kanal: a.telefon?.kanal || tx('srv.hjalpLage.av') }),
    tx('srv.hjalpLage.natet', { webb: installningar.webb || 'auto', moln: molnPa() ? tx('srv.hjalpLage.paMed', { namn: molnNamn() }) : tx('srv.hjalpLage.av'), losen: maximus.skyddat ? tx('srv.hjalpLage.satt') : tx('srv.hjalpLage.inget') }),
    tx('srv.hjalpLage.antalUppdrag', { n: uppdrag.length }),
  ].join('\n');
}

let slarNu = false;
let hjartaSkuld = false;
let slarBara = null;
async function slaHjarta({ nu = new Date(), bara = null, handelse = false } = {}) {
  if (slarNu) return { nej: 'pagar' };
  if (maximus.skyddat && !maximus.upplast) return { nej: 'last' };
  const behov = agentBehov();
  if (!behov.klar) return { nej: 'behover', behov };
  slarNu = true;
  for (const [i, x] of uppdrag.entries()) {
    const till = x.pausTill || (x.fel?.antal >= Uppdrag.FEL_INNAN_PAUS && x.fel?.senast
      ? new Date(Date.parse(x.fel.senast) + Uppdrag.ATERFORSOK_EFTER_PAUS).toISOString() : null);
    if (x.tillstand === 'pausad' && till && new Date(till) <= nu) {
      uppdrag[i] = { ...Uppdrag.aterstall(x, nu), pausTill: null };
    }
  }

  slarBara = bara;
  sandAlla({ typ: 'lista' });
  const hant = [];
  const svarJobb = [];
  let duFil = null; try { duFil = JSON.parse(await maximus.lasFil(join(dataDir, 'du.json'))); } catch {  }
  const ankare = Sammanstallning.ankare({ du: duFil, profil: installningar.profil, namn: [installningar.namn] });
  const varvStart = Date.now();
  const overTak = () => !bara && Date.now() - varvStart > VARV_MS;
  const nekade = new Map();
  const lagningar = [], vaktUndanlagt = [];
  const lovNej = [], lovJa = [];
  try {
    await vaktLasLiggaren().catch(() => {});
    for (let u of [...uppdrag]) {
      if (bara && u.id !== bara) continue;
      if (overTak() && Uppdrag.farKoras(u, nu)) {
        hant.push({ uppdrag: u.id, titel: u.titel, fynd: 0, skal: tx('srv.agent.varvetFullt', { min: VARV_MS / 60e3 }) });
        continue;
      }
      const fore = u;
      const varPausad = bara && u.tillstand === 'pausad';
      if (bara) u = { ...u, nasta: new Date(nu).toISOString(), ...(varPausad ? { tillstand: 'vantar' } : {}) };
      const r = await Agent.slag(u, {
        las: k => lasKalla(k, { nu }).then(p => (u.filter ? p.filter(x => Schema.passar(x, u.filter)) : p)),
        tanka: agentTanka,
        profil: malet(u),
        ankare,
        forbered: installningar.injektionsvakt === false ? null : t => Injektion.forbered(t, { tak: 3000 }),
        samtalArbetar: bara && !handelse ? false : korningar.size > 0,
        vakt: vaktForUppdrag(u, nu, lagningar, vaktUndanlagt),
        nu,
      }).catch(e => ({ fel: e.message || String(e), uppdrag: u, fynd: [] }));

      if (r.inteDags) continue;
      if (r.modellen) lagningar.push([Vakten.lagning('modell', { vad: tx('vakten.modell.triage', { titel: u.titel }) }), 'modell']);
      if (r.uppdrag?.fel?.behorighet && r.fel) lovNej.push(r.uppdrag.fel.behorighet);
      else if (!r.fel && !r.hoppade) lovJa.push(...u.kallor.map(k => k.typ));
      if (r.fynd?.length) {
        const lp = vaktLoopFynd(u, r.fynd, nu, lagningar);
        r.fynd = lp.rader;
        vaktUndanlagt.push(...lp.dubbletter);
      }
      if (vaktUndanlagt.length) r.undanlagt = [...(r.undanlagt || []), ...vaktUndanlagt.splice(0)];
      if (r.uppdrag?.fel?.behorighet && r.uppdrag.fel.antal === 1 && !nekade.has(r.uppdrag.fel.behorighet)) nekade.set(r.uppdrag.fel.behorighet, u.titel);
      if (varPausad && r.uppdrag) r.uppdrag = { ...r.uppdrag, tillstand: 'pausad', nasta: fore.nasta };
      const i = uppdrag.findIndex(x => x.id === u.id);
      if (i >= 0 && r.uppdrag !== u) uppdrag[i] = r.uppdrag;
      if (r.fynd?.length) fynd = [...r.fynd, ...fynd].slice(0, FYNDTAK);
      const behallna = (r.fynd || []).filter(f => !f.obedomd);
      const iSamman = behallna.filter(f => f.sammanstallning && !f.riktad);
      const egna = behallna.filter(f => !iSamman.includes(f));
      const oppnaFel = e => { hant.push({ uppdrag: u.id, titel: u.titel, fynd: 0, fel: tx('srv.agent.kundeInteOppnaSamtal', { fel: e.message }) }); return null; };
      const varvet = { vagda: r.vagda || 0, undan: r.undanlagt?.length || 0 };
      const fsEgna = egna.length ? await fyndsamtal(r.uppdrag || u, egna, nu, varvet, { snabb: overTak() }).catch(oppnaFel) : null;
      const fsSamman = iSamman.length ? await fyndsamtal(r.uppdrag || u, iSamman, nu, varvet, { sammanstallning: true, snabb: overTak() }).catch(oppnaFel) : null;
      const fs = fsEgna || fsSamman;
      if (r.undanlagt?.length) undanlagt = [...r.undanlagt, ...undanlagt].slice(0, UNDANTAK);
      if (behallna.some(f => f.brev && !f.brev.utskick) && !(u.kallor || []).some(k => k.nyhetsbrev)) svarJobb.push([r.uppdrag || u, behallna.filter(f => f.brev && !f.brev.utskick)]);
      hant.push({ uppdrag: u.id, titel: u.titel, fynd: r.fynd?.length || 0,
        undan: r.undanlagt?.length || 0, skal: r.skal || r.delvis || null, fel: r.fel || null, delvis: r.delvis || null,
        vantar: r.vantar || 0, kvar: r.kvar || 0, obedomda: r.oklara || 0,
        ...(iSamman.length ? { sammanstallning: iSamman.length, riktade: egna.length } : {}),
        trasigt: Boolean(r.trasigt), samtal: fs?.id || null, samtalstitel: fs?.titel || null,
        vagda: r.vagda || 0,
        nasta: (r.uppdrag || u).nasta || null });
    }
    await sparaUppdrag();
    await sparaFynd();
    {
      const l = Vakten.lovBorta(vaktLage, { nekade: lovNej, fungerar: lovJa.filter(k => !lovNej.includes(k)) }, nu);
      vaktLage = l.lage;
      if (l.nya.length) {
        installningar = { ...installningar, behorighetVersion: null };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar)).catch(() => {});
        sandAlla({ typ: 'behorighet' });
        for (const k of l.nya) lagningar.push([Vakten.lagning('lov', { kalla: bestamdKalla(k) }), `lov:${k}`]);
      }
      await sparaVakt();
      for (const [l2, nyckel] of lagningar) await vaktSager(l2, { nyckel, nu }).catch(() => {});
    }
    const notis = varvetsNotis(hant, nekade, nu);
    if (notis) notifiera(notis.titel, notis.text, notis.session, { viktigt: notis.viktigt });
    ikappSedan = null;
    setTimeout(() => efterVarvet({ svarJobb, nu, kollega: !bara && !PROV_KOLLEGA }).catch(() => {}), 1500).unref?.();
    await anslagstavlan(hant, nu);
    if (!bara) await stada(nu).catch(() => {});
    if (!bara) await paminnOmExport(nu).catch(() => {});
    if (!bara) await stadaTelefonen().catch(() => {});
    if (!bara) await sakerstallNyheter().catch(() => {});
    if (!bara) await sakerstallFlode([...sessioner.values()].find(x => x.helig?.sort === 'du')).catch(() => {});
    if (hant.length) {
      const avtryck = JSON.stringify(hant);
      if (agentspar[0]?.avtryck === avtryck) {
        agentspar[0] = { ...agentspar[0], nar: new Date(nu).toISOString(),
          ganger: (agentspar[0].ganger || 1) + 1 };
      } else {
        agentspar = [{ nar: new Date(nu).toISOString(), varv: hant, avtryck, ganger: 1 },
          ...agentspar].slice(0, SPARTAK);
      }
      await sparaSpar();
    }
  } finally {
    slarNu = false; slarBara = null; sandAlla({ typ: 'lista' });
    if (hjartaSkuld) { hjartaSkuld = false; setTimeout(() => slaHjarta().catch(() => {}), 1000).unref?.(); }
    if (pausaEfterVarvet && korningar.size === 0) {
      pausaEfterVarvet = false;
      try { modellAvstangd = true; await pausaModell(); modellPausad = true; sandAlla({ typ: 'modell', uppe: false, pausad: true }); }
      catch { modellAvstangd = false; }
    }
  }
  if (hant.some(h => h.fynd)) sandAlla({ typ: 'agent' });
  return hant;
}

function varvetsNotis(hant, nekade = new Map(), nu = new Date()) {
  const nya = hant.filter(h => h.fynd > 0 && h.samtal);
  const ikapp = ikappSedan ? tx('srv.notis.ikapp') : '';
  const lov = [...nekade].map(([kalla, titel]) => tx('srv.notis.behorighetText', { titel, kalla: bestamdKalla(kalla) }));
  if (!nya.length) {
    if (!lov.length) return null;
    return { titel: tx('srv.notis.behorighetTitel', { kalla: [...nekade.keys()].map(bestamdKalla).join(', ') }), text: lov.join(' '), session: null, viktigt: false };
  }
  const t0 = new Date(nu).getTime() - 6e4;
  const viktigt = fynd.some(f => nya.some(h => h.uppdrag === f.uppdrag) && Sammanstallning.narTelefonen(f) && Date.parse(f.skapad) >= t0);
  let titel, text;
  if (nya.length === 1) {
    const h = nya[0];
    titel = h.titel;
    text = h.sammanstallning && !h.riktade ? tx('srv.notis.sammanstallning', { n: h.sammanstallning, ikapp }) : tx('srv.notis.sakerAttTitta', { n: h.fynd, ikapp });
  } else {
    titel = tx('srv.notis.fleraTitel', { n: nya.length });
    text = tx('srv.notis.fleraText', { n: nya.reduce((a, h) => a + h.fynd, 0), uppdrag: nya.map(h => h.titel).join(', '), ikapp });
  }
  return { titel, text: [text, ...lov].join(' '), session: nya[0].samtal, viktigt };
}

let efterPagar = false;
async function efterVarvet({ svarJobb = [], nu = new Date(), kollega = true } = {}) {
  if (efterPagar) return;
  efterPagar = true;
  try {
    if (!undersoker) { undersoker = true; try { await arbeta([], new Date()); } catch {  } finally { undersoker = false; } }
    for (const [x, f] of svarJobb) await foreslaSvarFor(x, f, nu).catch(() => {});
    if (kollega) await kollegaForeslar().catch(() => {});
  } finally { efterPagar = false; }
}

async function undersokFynd(f, { nu = new Date() } = {}) {
  await modellForAgenten();
  const u = uppdrag.find(x => x.id === f.uppdrag);
  const tid = new Date(nu).toISOString();
  const s = { id: randomUUID(), titel: tx('srv.undersokning.titel', { titel: f.titel }).slice(0, 80), skapad: tid, andrad: tid, agare: null,
    projekt: u?.projekt || null, turer: [], karta: [], raknare: {}, avAgenten: true, a2a: true, uppdrag: f.uppdrag || null,
    etiketter: f.sfar ? [f.sfar] : [],
    minne: 'isolerat', webb: 'av', behandling: Behandling.stall(installningar.behandling) };
  const kort = Underlag.kort(f);
  const [original] = await Underlag.lasManga([kort], k => Underlag.lasHela(k, lasOriginal));
  if (!kort.pakallande && original) kort.utdrag = Underlag.kort(f, { text: original }).utdrag;
  s.turer.push({ id: randomUUID(), tid, fraga: '', av: 'maximus', avAgenten: true, status: 'klar', svar: '',
    sager: tx('srv.undersokning.underlag', { titel: f.titel }), underlag: [kort], kvitto: [], kallor: [] });
  sessioner.set(s.id, s); await spara(s);
  f.session = s.id; f.undersokning = s.id; f.undersokt = tid;
  sandAlla({ typ: 'lista' });
  let oppen = null;
  const a = agentInst();
  const tillgang = [a.epost?.konto && bestamdKalla('epost'), a.kalender && bestamdKalla('kalender'), a.paminnelser && bestamdKalla('paminnelser'), a.anteckningar?.mapp && bestamdKalla('anteckningar'),
    a.meddelanden && bestamdKalla('meddelanden'), (a.mappar?.length || a.mapp) && tx('srv.kalla.mapparna', { mappar: [...(a.mappar || []), ...(a.mapp ? [a.mapp] : [])].map(m => m.sokvag.split('/').pop()).filter((v, i, x) => x.indexOf(v) === i).join(', ') }),
    (a.sidor || installningar.webb !== 'av') && tx('srv.kalla.webben')].filter(Boolean).join(', ');
  const r = await A2A.undersok({ fynd: f, underlag: { kort, text: original }, uppdrag: u?.instruktion || '', profil: Profil.somText(malet(u)) || '', tillgang,
    agent: o => verktygsanrop({ meddelanden: o.meddelanden, verktyg: [], tak: 400 }),
    assistent: (fraga, om) => agentSlinga({ uppgift: fraga, sammanhang: om, session: s.id, obevakad: true, underlag: [kort] }),
    onRad: async rad => {
      if (rad.av === 'agent') {
        oppen = { id: randomUUID(), tid: new Date().toISOString(), fraga: rad.text, av: 'agent', avAgenten: true, svar: '', status: 'igang', kvitto: [], kallor: [] };
        s.turer.push(oppen);
      } else if (oppen) {
        oppen.svar = rad.text; oppen.status = 'klar';
        oppen.kvitto = [{ tid: new Date().toISOString(), aktor: tx('srv.kvitto.assistenten'), lokalt: true, ms: 0,
          vad: rad.steg?.length ? tx('srv.kvitto.byggerPa', { verktyg: [...new Set(rad.steg.filter(x => !x.fel).map(x => x.verktyg))].join(', ') || tx('srv.kvitto.ingaVerktyg') }) : tx('srv.kvitto.utanVerktyg') }];
      }
      s.andrad = new Date().toISOString(); await spara(s);
      sand(s.id, { typ: 'agenttur', session: s.id, tur: s.turer.at(-1) });
    },
  });
  const kollad = Kontroll.undersokningKontroll(r.slutsats, { lage: Kontroll.lage(installningar),
    underlag: `${f.titel || ''}\n${f.fran || ''}\n${kort.pakallande ? '' : original || f.text || ''}\n${(r.rader || []).map(x => x.text).join('\n')}` });
  const sl = kollad.slutsats;
  const slut = { id: randomUUID(), tid: new Date().toISOString(), fraga: '', av: 'maximus', avAgenten: true, status: 'klar',
    sager: tx('srv.undersokning.slutsats', { sakerhet: sl.sakerhet, text: sl.text, oppet: sl.oppet ? tx('srv.undersokning.oppet', { oppet: sl.oppet }) : '' }), svar: '', kvitto: [], kallor: [],
    ...(kollad.kontroll && !kollad.kontroll.ok ? { kontroll: kollad.kontroll } : {}) };
  s.turer.push(slut); s.andrad = slut.tid; await spara(s);
  sand(s.id, { typ: 'agenttur', session: s.id, tur: slut });
  const ag = await agentSamtalet();
  const rad = { id: randomUUID(), tid: slut.tid, fraga: '', av: 'maximus', avAgenten: true, status: 'klar', uppdrag: f.uppdrag || null,
    sager: tx('srv.undersokning.rad', { titel: f.titel, n: Math.floor(r.rader.length / 2), text: sl.text }),
    undersokning: { session: s.id, sakerhet: sl.sakerhet }, svar: '', kvitto: [], kallor: [] };
  ag.turer.push(rad); ag.andrad = rad.tid; await spara(ag);
  sand(ag.id, { typ: 'agenttur', session: ag.id, tur: rad });
  sandAlla({ typ: 'lista' });
  sandAlla({ typ: 'notis', titel: tx('srv.notis.undersokt', { titel: f.titel }), text: sl.text.slice(0, 140), session: s.id });
  await sparaFynd();
  return { session: s.id, slutsats: sl, varv: Math.floor(r.rader.length / 2) };
}

let senastStadat = 0;
async function stada(nu = new Date(), { tvinga = false } = {}) {
  if (!agentInst().stadar) return [];
  if (!tvinga && Date.now() - senastStadat < 6 * 36e5) return [];
  senastStadat = Date.now();
  const alla = [...sessioner.values()];
  const k = Stada.kandidater(alla, { uppdrag, nu, pagar: id => Boolean(arbeteI(id)) })
    .filter(a => { const s = alla.find(x => x.id === a.id); return s && !s.las && !s.forseglad; });
  if (!k.length) return [];
  for (const a of k) {
    const s = alla.find(x => x.id === a.id);
    s.arkiverad = true;
    s.arkiv = { av: 'agenten', skal: a.skal, tid: new Date().toISOString() };
    await spara(s);
  }
  const ag = await agentSamtalet();
  const rad = { id: randomUUID(), tid: new Date().toISOString(), fraga: '', av: 'maximus', avAgenten: true, status: 'klar',
    sager: Stada.rapport(k), stadning: { ids: k.map(a => a.id) }, svar: '', kvitto: [], kallor: [] };
  ag.turer.push(rad); ag.andrad = rad.tid; await spara(ag);
  sand(ag.id, { typ: 'agenttur', session: ag.id, tur: rad });
  sandAlla({ typ: 'lista' });
  return k;
}

const dikteringar = new Map();
const moteKo = new Map();
const leveranser = new Set();
const djupjobb = new Set();
let dikteraBin = null;
async function dikteraHjalpare() {
  if (dikteraBin) return dikteraBin;
  if (process.platform !== 'darwin' || Number(osRelease().split('.')[0]) < 25) return null;
  const packad = await hitta('maximus-diktera');
  if (packad) return (dikteraBin = packad);
  const kalla = join(HAR, 'verktyg', 'diktera.swift');
  const kod = await readFile(kalla).catch(() => null);
  if (!kod) return null;
  const ut = join(homedir(), 'Library', 'Caches', 'Maximus', `maximus-diktera-${createHash('sha256').update(kod).digest('hex').slice(0, 12)}`);
  if (await access(ut).then(() => true, () => false)) return (dikteraBin = ut);
  await mkdir(dirname(ut), { recursive: true });
  const ok = await new Promise(klar => execFileCb('/usr/bin/swiftc', ['-O', kalla, '-o', ut], { timeout: 180000 }, e => klar(!e)));
  return ok ? (dikteraBin = ut) : null;
}
setTimeout(() => dikteraHjalpare().catch(() => {}), 5000).unref?.();
setInterval(() => {
  for (const [id, d] of dikteringar) if (Date.now() - d.tillstand.senast > 30000) { d.doda(); dikteringar.delete(id); }
}, 15000).unref?.();

async function duForslag(du) {
  await modellForAgenten();
  for (let i = 0; i < 3; i++) {
    const r = await svaraLokalt(Du.profilPrompt(Du.somText(du)), { plats: 'efterat', tak: 900, timeout: 240000 }).catch(() => '');
    const f = Profil.lasForslag(r);
    if (f && (f.vem || f.arbetar)) {
      if (du.kalla && du.kalla !== 'text') {
        await maximus.andraFil(join(dataDir, 'du.json'), d => (d ? { ...d, forslag: { kalla: du.kalla, avtryck: Banken.forslagsavtryck(f) } } : undefined)).catch(() => {});
      }
      return f;
    }
    await new Promise(v => setTimeout(v, 4000));
  }
  return null;
}

async function lasDu() {
  try { return JSON.parse(await maximus.lasFil(join(dataDir, 'du.json'))); } catch { return null; }
}

async function bankLage(jag) {
  const du = await lasDu();
  const lage = { profil: Profil.las(installningar.profil), du, exempel: installningar.exempel || null };
  const minns = [...sessioner.values()].filter(x => (x.agare || null) === (jag?.id || null) && x.minne === 'minns' && !x.las && !x.forseglad).length;
  const rader = Banken.uppgifter({ ...lage, uppdrag: uppdrag.map(u => ({ id: u.id, titel: u.titel, instruktion: u.instruktion })), minns });
  return { lage, rader };
}

const bankForslag = new Map();
const visatAvtryck = andringar => createHash('sha256').update(JSON.stringify(andringar)).digest('hex');
const BANK_FORSLAG_MS = 30 * 60e3;

async function bankTolka(jag, text, { fraga = '' } = {}) {
  const { lage, rader } = await bankLage(jag);
  let ops = [];
  let duKontrollen = null;
  const glom = Banken.glomUr(text);
  if (glom) ops = [glom];
  else {
    if (!(await grindSvarar())) return { forslag: null, error: tx('srv.banken.modellenSvararInte') };
    const svar = await svaraLokalt(Banken.tolkPrompt(text, rader, { fraga }), { plats: 'efterat', tak: 700, timeout: 120000, baraLokalt: true }).catch(() => '');
    ops = Banken.lasTolkning(svar, rader, { text: `${fraga}\n${text}` }) || [];
    const k = Kontroll.duKontroll(ops, { text: `${fraga}\n${text}`.trim(), rader, lage: Kontroll.lage(installningar) });
    ops = k.ops; duKontrollen = k.kontroll;
  }
  const samtal = ops.some(o => o.gor === 'glom')
    ? [...sessioner.values()].filter(x => (x.agare || null) === (jag?.id || null) && !x.las && !x.forseglad)
      .map(x => ({ titel: x.titel, text: (x.turer || []).map(t => `${t.fraga || ''}\n${t.svar || ''}\n${t.sager || ''}`).join('\n') }))
    : [];
  const r = Banken.tillamp(lage, ops, { uppdrag, samtal });
  const { antal: lager } = await glomAgentLager(ops);
  if (!r.andringar.length && !Object.keys(lager).length) return { forslag: null, svar: [tx('srv.banken.ingetAttAndra'), ...r.ovrigt].join('\n\n'), ovrigt: r.ovrigt };
  const id = randomUUID();
  for (const [k, v] of bankForslag) if (Date.now() - v.tid > BANK_FORSLAG_MS) bankForslag.delete(k);
  bankForslag.set(id, { ops, avtryck: Banken.fingeravtryck(lage), visat: visatAvtryck([r.andringar, lager]), agare: jag?.id || null, tid: Date.now() });
  const kontrollrad = Kontroll.rad(duKontrollen);
  return { forslag: { id, andringar: r.andringar, ovrigt: r.ovrigt, lager, text: [Banken.somText(r.andringar, r.ovrigt, lager), kontrollrad].filter(Boolean).join('\n\n'),
    ...(kontrollrad ? { kontroll: duKontrollen } : {}) } };
}

async function glomAgentLager(ops, { spara: skriv = false } = {}) {
  const glom = (ops || []).filter(o => o.gor === 'glom');
  if (!glom.length) return { antal: {} };
  let lager = { fynd, undanlagt, kollega: await kollegaMinne(), svarsforslag, handlingar, spar: agentspar, telefon: telefonLogg };
  const antal = {};
  for (const o of glom) {
    const g = Banken.glomILager(lager, o.om);
    lager = g.lager;
    for (const [k, n] of Object.entries(g.antal)) antal[k] = (antal[k] || 0) + n;
  }
  if (skriv) {
    if (antal.fynd || antal.undanlagt) { fynd = lager.fynd; undanlagt = lager.undanlagt; await sparaFynd(); }
    if (antal.kollega) await skrivKollega(Kollega.minneUr(lager.kollega));
    if (antal.svarsforslag) { svarsforslag = lager.svarsforslag; await sparaSvarsforslag(); }
    if (antal.handlingar) { handlingar = lager.handlingar; await sparaHandlingar(); }
    if (antal.spar) { agentspar = lager.spar; await sparaSpar(); }
    if (antal.telefon) { telefonLogg = lager.telefon; await sparaTelefon(); }
    if (Object.keys(antal).length) sandAlla({ typ: 'agent' });
  }
  return { antal };
}

async function skrivOmDuRad(foreProfil, foreDu) {
  const s = [...sessioner.values()].find(x => x.helig?.sort === 'du');
  if (!s) return;
  const nyDu = await lasDu();
  const gammal = Grunden.duRad(Profil.las(foreProfil), foreDu);
  const ny = Grunden.duRad(Profil.las(installningar.profil), nyDu);
  let andrad = false;
  for (const t of s.turer) {
    if (!t.du || typeof t.sager !== 'string') continue;
    t.sager = t.sager.includes(gammal) ? t.sager.replace(gammal, () => ny) : ny;
    andrad = true;
  }
  if (andrad) { s.andrad = new Date().toISOString(); await spara(s); sandAlla({ typ: 'lista' }); }
}

const PROV_KOLLEGA = process.env.MAXIMUS_PROV === '1';
const kollegaProv = { fynd: null, moten: null, vilaSek: null, agent: null };

let kollegaMinnet = null;
async function kollegaMinne() {
  if (kollegaMinnet) return kollegaMinnet;
  if (maximus.skyddat && !maximus.upplast) return Kollega.tomtMinne();
  try { kollegaMinnet = Kollega.minneUr(JSON.parse(await maximus.lasFil(join(dataDir, 'kollega.json')))); }
  catch { kollegaMinnet = Kollega.tomtMinne(); }
  return kollegaMinnet;
}
async function skrivKollega(m) {
  kollegaMinnet = m;
  await maximus.skrivFil(join(dataDir, 'kollega.json'), JSON.stringify(m));
}

async function kollegaMoten(nu = new Date()) {
  if (PROV_KOLLEGA) return kollegaProv.moten || [];
  const a = agentInst();
  if (!a.kalender || !Kalender.finns()) return [];
  const t0 = new Date(nu).getTime();
  const h = await Kalender.handelser({ fran: new Date(t0 - Kollega.DYGN * 864e5), till: new Date(t0 + Kollega.DYGN * 864e5) }).catch(() => []);
  return h.map(x => ({ ...x, ...Konton.kalenderFor(a.kalender, x) })).filter(x => x.med);
}
const kollegaFynd = () => (PROV_KOLLEGA && kollegaProv.fynd) || fynd;

let foreslarKollega = false;
async function kollegaForeslar({ nu = new Date(), tvinga = false } = {}) {
  if (IDENTITET || !Kollega.lage(installningar).forslag) return { nej: 'av' };
  if (maximus.skyddat && !maximus.upplast) return { nej: 'last' };
  if (foreslarKollega) return { nej: 'pagar' };
  if (korningar.size > 0) return { nej: 'samtal' };
  const fore = await kollegaMinne();
  if (!tvinga && fore.senastForslag && new Date(nu) - Date.parse(fore.senastForslag) < Kollega.FORSLAG_MS) return { nej: 'nyss' };
  foreslarKollega = true;
  try {
    const a = (PROV_KOLLEGA && kollegaProv.agent) || agentInst();
    const underlag = Kollega.underlagUr({ fynd: kollegaFynd(), moten: await kollegaMoten(nu), epost: a.epost, nu });
    let lista = [];
    let kollegaKontrollen = null;
    if (underlag.some(x => !x.pakallande)) {
      await modellForAgenten();
      if (!(await grindSvarar())) return { nej: 'modell' };
      let svar = '';
      try {
        svar = await agentAnrop(Kollega.forslagsPrompt({ profil: Profil.somText(installningar.profil) || '', underlag,
          larda: Kollega.lardaRader(fore, { nu }), nu }), { tak: 1400, baraLokalt: true });
      } catch (e) {
        if (e.foretrade) return { nej: 'samtal' };
      }
      lista = Kollega.lasForslag(svar, underlag, { minne: await kollegaMinne(), agent: a, nu }) || [];
      const k = Kontroll.kollegaKontroll(lista, { underlag, profil: Profil.somText(installningar.profil) || '', sprak: Sprakstod.aktuellt(), lage: Kontroll.lage(installningar), nu });
      lista = k.lista; kollegaKontrollen = k.kontroll;
    }
    const m = { ...(await kollegaMinne()), senastForslag: new Date(nu).toISOString() };
    if (!lista.length) { await skrivKollega(m); return { forslag: [] }; }
    const s = await agentSamtalet();
    const { underlag: korten, forslag } = Kollega.somTur(lista);
    const tid = new Date().toISOString();
    const forslagTur = { id: randomUUID(), tid, fraga: '', av: 'maximus', avAgenten: true, status: 'klar', svar: '', kvitto: [], kallor: [],
      sager: tx('srv.kollega.rad', { n: forslag.length }), underlag: korten, kollega: { forslag: [] },
      ...(kollegaKontrollen && !kollegaKontrollen.ok ? { kontroll: kollegaKontrollen } : {}) };
    for (const f of forslag) { f.session = s.id; f.tur = forslagTur.id; }
    forslagTur.kollega.forslag = forslag.map(Kollega.visas);
    s.turer.push(forslagTur); s.andrad = tid;
    m.forslag = [...m.forslag, ...forslag].slice(-200);
    await spara(s); await skrivKollega(m);
    sand(s.id, { typ: 'agenttur', session: s.id, tur: forslagTur });
    sandAlla({ typ: 'lista' });
    sandAlla({ typ: 'notis', titel: tx('srv.kollega.notisTitel'), text: tx('srv.kollega.notisText', { n: forslag.length, forsta: forslag[0].titel }), session: s.id });
    return { forslag: forslagTur.kollega.forslag, session: s.id, tur: forslagTur.id };
  } finally { foreslarKollega = false; }
}

async function speglaKollega(f) {
  const s = f.session && sessioner.get(f.session);
  const oppet = s && !(s.las?.styrka === 'forseglad') && !s.las && !s.forseglad;
  const t = oppet ? s.turer.find(x => x.id === f.tur) : null;
  if (t?.kollega) {
    t.kollega.forslag = t.kollega.forslag.map(x => (x.id === f.id ? Kollega.visas({ ...f, nr: x.nr }) : x));
    await spara(s);
  }
  sandAlla({ typ: 'kollega', forslag: Kollega.visas(f) });
}

async function taKollegaForslag(f, { text = null, start = null, slut = null } = {}) {
  const utkast = text != null ? String(text).slice(0, 4000) : (f.utkast || '');
  if (f.konto && f.brevId) {
    let fs;
    if (PROV_SVAR) {
      fs = Svar.nyttForslag({ brev: { id: f.brevId, fran: f.fran || f.vem || '', amne: f.underlag?.[0]?.titel || f.titel, namn: f.vem || null, text: '' },
        konto: f.konto, lada: f.lada || 'INBOX', etikett: f.etikett || null, text: utkast, varfor: f.varfor, session: f.session || null });
      svarsforslag.push(fs); await sparaSvarsforslag();
    } else fs = await foreslaSvar({ konto: f.konto, lada: f.lada || 'INBOX', id: f.brevId, session: f.session || null, text: utkast });
    return { svarsforslag: fs };
  }
  if (f.sort === 'boka') {
    const lokal = v => { const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(String(v || '')); const d = m && new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]); return d && Number.isFinite(+d) ? d : null; };
    const s0 = lokal(start) || lokal(f.start);
    if (!s0) throw new Error(tx('srv.kollega.valjTid'));
    let s1 = lokal(start) ? lokal(slut) : lokal(slut) || lokal(f.slut);
    if (!s1 || +s1 <= +s0 || +s1 - +s0 > 12 * 36e5) s1 = new Date(+s0 + 3600e3);
    f = { ...f, start: s0, slut: s1 };
    const fore = f.session && sessioner.get(f.session);
    const s = fore && !(fore.las?.styrka === 'forseglad') && !fore.las && !fore.forseglad && !fore.arkiverad ? fore : await agentSamtalet();
    const h = { id: randomUUID(), titel: f.titel, start: new Date(f.start).toISOString(), slut: new Date(f.slut).toISOString(), plats: null,
      deltagare: [], paminnelser: [], obligatoriskt: false, anteckning: f.varfor, gjort: {}, ...(f.kalender ? { kalender: f.kalender } : {}) };
    const motesTur = { id: randomUUID(), tid: new Date().toISOString(), fraga: '', av: 'maximus', avAgenten: true, status: 'klar', svar: '', kvitto: [], kallor: [],
      sager: tx('srv.kollega.bokaRad', { titel: f.titel }), handelse: h };
    s.turer.push(motesTur); s.andrad = motesTur.tid; await spara(s);
    sand(s.id, { typ: 'agenttur', session: s.id, tur: motesTur });
    return { session: s.id, tur: motesTur };
  }
  return { kopiera: utkast };
}

let narvaro = null;
let knackMoten = { nar: 0, lista: [] };

async function knacka({ nu = new Date() } = {}) {
  if (IDENTITET) return { ja: false, skal: 'av' };
  if (maximus.skyddat && !maximus.upplast) return { ja: false, skal: 'last' };
  if (!installningar.forsta?.klar) return { ja: false, skal: 'start' };
  const m = await kollegaMinne();
  const vila = PROV_KOLLEGA && kollegaProv.vilaSek != null ? kollegaProv.vilaSek : await vilaSek();
  const n = narvaro && { ...narvaro, nar: new Date(nu).getTime() - (Date.now() - narvaro.nar) };
  const far = Kollega.farKnacka({ lage: Kollega.lage(installningar), fonster: oversikt.size, narvaro: n, vilaSek: vila,
    samtal: korningar.size + dikteringar.size + moteKo.size, minne: m, nu });
  if (!far.ja) return far;
  const k = Kollega.nyKnack(Kollega.knackAmnen({ profil: installningar.profil, du: await lasDu(), fynd: kollegaFynd(), minne: m, nu }), { nu });
  if (!k) return { ja: false, skal: 'inget' };
  if (PROV_KOLLEGA || Date.now() - knackMoten.nar > 10 * 60e3) knackMoten = { nar: Date.now(), lista: await kollegaMoten(nu).catch(() => []) };
  if (Kollega.motePagar(knackMoten.lista, nu)) return { ja: false, skal: 'mote' };
  await skrivKollega({ ...m, knack: { ...m.knack, oppen: k } });
  sandAlla({ typ: 'knack', knack: { id: k.id, fraga: k.fraga, halsning: Kollega.halsning(k) } });
  return { ja: true, skal: null, knack: k };
}
if (!PROV_KOLLEGA) setInterval(() => knacka().catch(() => {}), 60e3).unref?.();

let molnInloggning = null;
const molnModellCache = {};
async function aktiveraMoln() {
  const lage = Moln.lageUr(installningar.moln);
  const nyckel = lage?.pa ? await Moln.lasNyckel(lage.leverantor) : null;
  satMoln({ lage, nyckel, sorter: () => galler(installningar), liggare: p => liggare({ ...p, anvandare: null, session: null, aktor: tx('srv.liggare.aktorMolnmodell') }) });
  return { lage, harNyckel: Boolean(nyckel) };
}

const mallfil = (sort, agare = null) => join(dataDir, 'mallar',
  `${agare ? `${String(agare).replace(/[^\w-]/g, '')}-` : ''}${sort}.json`);
async function kundmallInfo(sort, agare) {
  try { const j = JSON.parse(await maximus.lasFil(mallfil(sort, agare))); return { namn: j.namn, tid: j.tid }; } catch { return null; }
}
async function kundmall(sort, agare) {
  try { const j = JSON.parse(await maximus.lasFil(mallfil(sort, agare))); return await Mallar.lasMall(sort, Buffer.from(j.data, 'base64')); }
  catch { return null; }
}

async function sakerstallNyheter() {
  const a = agentInst();
  const u0 = uppdrag.find(x => x.nyheter);
  if (!a.nyheter) return u0 || null;
  const amnen = Nyheter.amnenUr(Profil.las(installningar.profil) || {});
  if (!amnen.length) return null;
  let s = [...sessioner.values()].find(x => x.helig?.sort === 'nyheter');
  if (!s) {
    const tid = new Date().toISOString();
    s = { id: randomUUID(), titel: tx('srv.helig.nyheterTitel'), dopt: true, skapad: tid, andrad: tid, agare: null, turer: [], karta: [], raknare: {},
      behandling: Behandling.stall(installningar.behandling), persona: installningar.persona || PERSONA_FORVAL, webb: 'av', minne: 'isolerat',
      helig: { sort: 'nyheter' } };
    sessioner.set(s.id, s);
    s.turer.push({ id: randomUUID(), tid, fraga: '', av: 'maximus', status: 'klar', svar: '', kvitto: [], kallor: [],
      sager: tx('srv.nyheter.forstaTur', { amnen: amnen.join('**, **') }) });
    await spara(s);
    sandAlla({ typ: 'lista' });
  }
  const instr = Nyheter.uppdragFor(amnen, { epost: Boolean(a.epost?.konto) });
  const kallnyckel = kallor => JSON.stringify(kallor.map(k => k.fraga || k.typ));
  const samma = u0 && kallnyckel(u0.kallor) === kallnyckel(instr.kallor) && u0.instruktion === instr.instruktion;
  if (u0 && samma) return u0;
  if (u0 && kallnyckel(u0.kallor) === kallnyckel(instr.kallor)) {
    u0.instruktion = instr.instruktion; await sparaUppdrag(); return u0;
  }
  if (u0) { uppdrag.splice(uppdrag.indexOf(u0), 1); }
  const u = Uppdrag.nyttUppdrag(instr);
  u.kallor.forEach(k => { k.nyheter = true; });
  u.nyheter = true; u.grund = s.id; u.session = s.id;
  uppdrag.push(u); await sparaUppdrag();
  return u;
}

async function sakerstallFlode(du) {
  const a = agentInst();
  if (!a.lopande || !du) return false;
  if (uppdrag.some(x => x.grund === du.id && x.kallor.some(k => k.typ === 'flode'))) return false;
  const u = Uppdrag.nyttUppdrag({ titel: tx('srv.flode.uppdragTitel'), aterkommande: true, takt: 120, kallor: [{ typ: 'flode' }],
    instruktion: tx('srv.flode.uppdragInstruktion') });
  u.grund = du.id; u.session = du.id;
  uppdrag.push(u); await sparaUppdrag();
  return true;
}

async function paminnOmExport(nu = new Date()) {
  const du = [...sessioner.values()].find(x => x.helig?.sort === 'du');
  if (!du) return;
  let d = null; try { d = JSON.parse(await maximus.lasFil(join(dataDir, 'du.json'))); } catch { return; }
  if (!Flode.paminnaOmExport(d, { senast: du.exportPaminnelse || null, nu })) return;
  du.exportPaminnelse = new Date(nu).toISOString();
  const paminn = { id: randomUUID(), tid: du.exportPaminnelse, fraga: '', av: 'maximus', status: 'klar', svar: '', kvitto: [], kallor: [],
    sager: tx('srv.du.paminnExport', { vad: d.kalla === 'linkedin' ? tx('srv.du.dinExport') : tx('srv.du.detDuGav') }) };
  du.turer.push(paminn); du.andrad = paminn.tid; await spara(du);
  sand(du.id, { typ: 'agenttur', session: du.id, tur: paminn });
  sandAlla({ typ: 'lista' });
  notifiera(tx('srv.notis.linkedinIgenTitel'), tx('srv.notis.linkedinIgenText'), du.id);
}

function safariFel(t) {
  if (/-1743|not authorized|inte behörig|Not allowed to send Apple events/i.test(t)) return tx('srv.safari.ejBehorig');
  if (/JavaScript from Apple Events|Tillåt JavaScript|Allow JavaScript/i.test(t)) return tx('srv.safari.tillatJsLang');
  if (/timed out|ETIMEDOUT|SIGTERM|killed/i.test(t)) return tx('srv.safari.timeout');
  return tx('srv.safari.svaradeInte', { fel: String(t).trim().slice(0, 160) });
}

async function lasSafari() {
  if (process.platform !== 'darwin') throw new Error(tx('srv.safari.baraMac'));
  const skript = 'tell application "Safari"\nif (count of windows) = 0 then error "' + tx('srv.safari.ingetFonster') + '"\nset t to current tab of front window\nset u to URL of t\nset n to name of t\nset x to do JavaScript "document.body.innerText" in t\nreturn u & linefeed & n & linefeed & x\nend tell';
  const ut = await new Promise((klar, fel) => execFileCb('/usr/bin/osascript', ['-e', skript], { timeout: 15000, maxBuffer: 8e6 },
    (e, o, err) => (e ? fel(new Error(safariFel(`${err || ''} ${e.killed ? 'killed' : ''} ${e.message}`))) : klar(String(o)))));
  const [url, titel, ...resten] = ut.split('\n');
  return { url: url.trim(), titel: titel.trim(), text: resten.join('\n').trim() };
}

let undersoker = false;
async function arbeta(hant, nu) {
  const a = agentInst();
  if (!a.arbetar) return;
  if (korningar.size > 0) return;

  const budget = Arbete.inomBudget({ tempo: a.tempo, gjorda: fynd.map(f => f.undersokt).filter(Boolean), paBatteri: await paBatteri() });
  if (!budget.ja) return;
  const gjorda = new Set(fynd.filter(f => f.session).flatMap(f => [f.kallid || f.id, Arbete.titelnyckel(f.titel)]));
  for (const f of fynd.filter(x => !x.sett && !x.session)) {
    const u = uppdrag.find(x => x.id === f.uppdrag);
    const pr = u?.projekt ? projekt.find(x => x.id === u.projekt) : null;
    const far = Arbete.farArbeta(f, { projekt: pr, redanArbetat: gjorda, uppdrag: u });
    if (!far.ja) continue;
    try {
      const r = await undersokFynd(f, { nu });
      hant.push({ uppdrag: u?.id || null, titel: f.titel, fynd: 0, arbete: r.session,
        skal: tx('srv.spar.undersokte', { n: r.varv, sakerhet: r.slutsats.sakerhet }) });
      gjorda.add(f.kallid || f.id);
    } catch (e) {
      hant.push({ uppdrag: u?.id || null, titel: f.titel, fynd: 0, fel: tx('srv.spar.kundeInteUndersoka', { fel: e.message }) });
    }
    break;
  }
}

const delningsmapp = () => join(dataDir, 'delningar');

async function stadaDelningar(nu = Date.now()) {
  for (const f of await readdir(delningsmapp()).catch(() => [])) {
    const v = join(delningsmapp(), f);
    const st = await stat(v).catch(() => null);
    if (st && nu - st.mtimeMs > 86400000) await unlink(v).catch(() => {});
  }
}

let agentbegaran = [];

function agentRad(u, nya, nu, varv = {}) {
  const klocka = new Date(nu).toLocaleTimeString(lokalNu(), { hour: '2-digit', minute: '2-digit' });
  const var_ = ochLista(u.kallor.map(k => bestamdKalla(k.typ)));
  const lasta = varv.vagda ? tx('srv.agentRad.laste', { n: varv.vagda, var: var_ }) : tx('srv.agentRad.gickIgenom', { var: var_ });
  return tx('srv.agentRad.huvud', { titel: u.titel, klocka, instruktion: String(u.instruktion || '').replace(/\s+/g, ' ').slice(0, 400) })
    + tx('srv.agentRad.vagde', { lasta, n: nya.length })
    + `${varv.undan ? tx('srv.agentRad.undan', { n: varv.undan }) : ''}`;
}

const GENERISKT = /^(Det som rör mig i|Bevakning av|Sökning i|What concerns me in|Watching|Search in)\b/i;
async function namngeTraden(u, s, sammanfattning) {
  if (!sammanfattning || korningar.size > 0) return;
  let titel = u.titel;
  if (GENERISKT.test(titel)) {
    const ny = await Rubrik.rubrik(String(u.instruktion || ''), sammanfattning, { signal: agentKontroll.signal });
    if (ny && !GENERISKT.test(ny)) {
      titel = ny;
      const i = uppdrag.findIndex(x => x.id === u.id);
      if (i >= 0) { uppdrag[i] = { ...uppdrag[i], titel }; await sparaUppdrag(); }
    }
  }
  if (s.dopt) return;
  if (korningar.size > 0) return;
  const vad = await Rubrik.rubrik(tx('srv.rubrik.vadHittade'), sammanfattning, { signal: agentKontroll.signal });
  s.titel = (vad && vad !== titel ? tx('srv.trad.titelDatum', { titel, datum: vad }) : tx('srv.trad.titelDatum', { titel, datum: new Date().toLocaleDateString(lokalNu(), { day: 'numeric', month: 'short' }) })).slice(0, 90);
  await spara(s);
  sand(s.id, { typ: 'titel', titel: s.titel });
  sandAlla({ typ: 'lista' });
}

async function agentSamtalet() {
  const id = installningar.agentSamtal;
  const finns = id && sessioner.get(id);
  if (finns && !(finns.las?.styrka === 'forseglad') && !finns.las && !finns.forseglad && !finns.arkiverad) return finns;
  const tid = new Date().toISOString();
  const s = { id: randomUUID(), titel: tx('srv.liggare.aktorAgenten'), skapad: tid, andrad: tid, agare: null, projekt: null, turer: [],
    karta: [], raknare: {}, avAgenten: true, agentsamtal: true, dopt: true, minne: 'isolerat', webb: 'av',
    behandling: Behandling.stall(installningar.behandling) };
  sessioner.set(s.id, s);
  await spara(s);
  installningar = { ...installningar, agentSamtal: s.id };
  await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
  sandAlla({ typ: 'lista' });
  return s;
}

function styrverktyg({ text = '', smitta = null } = {}) {
  const fattPaus = Handlingar.begarPaus(text);
  const farKora = () => !smitta?.smittad || Handlingar.begarKorning(text);
  const hitta_ = namn => {
    const q = String(namn || '').toLowerCase().trim();
    if (!q || /^(allt|alla|all|everything)$/.test(q)) return uppdrag;
    return uppdrag.filter(u => u.titel.toLowerCase().includes(q) || u.instruktion.toLowerCase().includes(q) || u.kallor.some(k => k.typ.includes(q)));
  };
  const rad = u => `- ${u.titel} · ${u.tillstand}${u.pausTill ? tx('srv.styr.till', { datum: u.pausTill.slice(0, 10) }) : ''}${u.schema ? ` · ${Schema.somText(u.schema)}` : ''}${u.handelse ? tx('srv.styr.narNytt') : ''}${tx('srv.styr.senast', { nar: u.senast ? new Date(u.senast).toLocaleString(lokalNu()) : tx('srv.styr.aldrig') })}`;
  return [
    { namn: 'uppdragen', om: tx('srv.styr.uppdragenOm'), parametrar: { type: 'object', properties: {} },
      kor: async () => (uppdrag.length ? uppdrag.map(rad).join('\n') : tx('srv.styr.ingaUppdrag')) },
    { namn: 'vad_hande', om: tx('srv.styr.vadHandeOm'),
      parametrar: { type: 'object', properties: { timmar: { type: 'integer', description: tx('srv.styr.timmarBesk') } } },
      kor: async ({ timmar = 24 }) => {
        const sedan = Date.now() - Math.min(24 * 30, Number(timmar) || 24) * 3600e3;
        const varv = agentspar.filter(x => new Date(x.nar) >= sedan);
        const f = fynd.filter(x => new Date(x.skapad) >= sedan);
        if (!varv.length && !f.length) return tx('srv.styr.ingetHant');
        return [tx('srv.styr.varv', { n: varv.length }), ...varv.slice(0, 15).flatMap(x => x.varv.map(h => tx('srv.styr.varvRad', { tid: new Date(x.nar).toLocaleString(lokalNu()), titel: h.titel, lasta: h.vagda || 0, lyfte: h.fynd || 0, undan: h.undan || 0, fel: h.fel ? tx('srv.styr.varvFel', { fel: h.fel }) : '' }))),
          ...(f.length ? [tx('srv.styr.lyftFram'), ...f.slice(0, 15).map(x => `- ${x.titel}${x.fran ? ` (${x.fran})` : ''} — ${x.varfor || ''}`)] : [])].join('\n');
      } },
    { namn: 'kor_uppdrag', om: tx('srv.styr.korOm'), parametrar: { type: 'object', properties: { namn: { type: 'string' } }, required: ['namn'] },
      kor: async ({ namn }) => {
        if (!farKora()) return `Fel: ${tx('srv.styr.inteKoraSmittad')}`;
        const u = hitta_(namn)[0];
        if (!u) return tx('srv.styr.ingetUppdragHeter', { namn });
        const r = await slaHjarta({ bara: u.id });
        if (r?.nej === 'behover') return behovText(r.behov);
        const h = r?.find?.(x => x.uppdrag === u.id) || (Array.isArray(r) ? r[0] : null);
        return h ? tx('srv.styr.korde', { titel: u.titel, lasta: h.vagda || 0, lyfte: h.fynd || 0, undan: h.undan || 0 }) : tx('srv.styr.kundeInteKora', { nej: r?.nej || tx('srv.styr.okant') });
      } },
    { namn: 'pausa_uppdrag', om: tx('srv.styr.pausaOm'),
      parametrar: { type: 'object', properties: { namn: { type: 'string' }, till: { type: 'string', description: tx('srv.styr.tillBesk') } }, required: ['namn'] },
      kor: async ({ namn, till }) => {
        if (!fattPaus) return tx('srv.styr.ingenPaus');
        const valda = hitta_(namn);
        if (!valda.length) return tx('srv.styr.ingetUppdragHeter', { namn });
        let t = till && Number.isFinite(+new Date(till)) ? new Date(till) : null;
        if (t) { t.setHours(0, 0, 0, 0); const idag = new Date(); idag.setHours(23, 59, 59, 0); while (t <= idag) t.setDate(t.getDate() + 7); t = t.toISOString(); }
        for (const u of valda) { const i = uppdrag.indexOf(u); uppdrag[i] = { ...u, tillstand: 'pausad', pausTill: t }; }
        await sparaUppdrag(); sandAlla({ typ: 'lista' });
        return tx('srv.styr.pausade', { titlar: valda.map(u => u.titel).join(', '), till: t ? tx('srv.styr.till', { datum: new Date(t).toLocaleDateString(lokalNu(), { weekday: 'long', day: 'numeric', month: 'long' }) }) : '' });
      } },
    { namn: 'fortsatt_uppdrag', om: tx('srv.styr.fortsattOm'), parametrar: { type: 'object', properties: { namn: { type: 'string' } }, required: ['namn'] },
      kor: async ({ namn }) => {
        if (!farKora()) return `Fel: ${tx('srv.styr.inteKoraSmittad')}`;
        const valda = hitta_(namn).filter(u => u.tillstand === 'pausad');
        if (!valda.length) return tx('srv.styr.ingetPausat');
        for (const u of valda) { const i = uppdrag.indexOf(u); uppdrag[i] = { ...Uppdrag.aterstall(u), pausTill: null }; }
        await sparaUppdrag(); sandAlla({ typ: 'lista' });
        return tx('srv.styr.igangIgen', { titlar: valda.map(u => u.titel).join(', ') });
      } },
  ];
}

async function originalen(nya) {
  const texter = await Underlag.lasManga(nya.slice(0, 6), async f => {
    const k = Underlag.kort(f);
    const t = await Underlag.lasHela(k, lasOriginal);
    if (k.pakallande) f.pakallande = true;
    return t;
  });
  return [...texter, ...nya.slice(6).map(() => '')];
}

async function skrivSammanstallning(u, nya, { snabb = false } = {}) {
  let stycken = [];
  if (korningar.size === 0 && !snabb) {
    const profil = Profil.somText(malet(u));
    const svar = await agentAnrop(Sammanstallning.prompt(u, nya, { profil }), { tak: 1200 }).catch(() => '');
    ({ stycken } = Sammanstallning.las(svar, nya, { profil }));
  }
  return stycken.length ? Sammanstallning.somText(stycken) : Sammanstallning.reserv(nya);
}

async function fyndsamtal(u, nya, nu, varv = {}, { sammanstallning = false, snabb = false } = {}) {
  const tid = new Date(nu).toISOString();
  const texter = await originalen(nya);
  const agentTur = { id: randomUUID(), tid, fraga: sammanstallning ? Sammanstallning.fragan(u, nya) : Fyndsamtal.fragan(u, nya), svar: '', status: 'igang',
    avAgenten: true, av: 'maximus', sager: agentRad(u, nya, nu, varv),
    uppdragskort: { titel: u.titel, instruktion: String(u.instruktion || '').slice(0, 600), tid: new Date(nu).toISOString(),
      var: ochLista(u.kallor.map(k => (k.typ === 'paminnelser' ? k.typ : bestamdKalla(k.typ)))),
      lasta: varv.vagda || 0, fynd: nya.length, undan: varv.undan || 0, ursprung: u.ursprung || (u.session ? { session: u.session } : null),
      engang: !u.aterkommande, uppdrag: u.id },
    kvitto: [],
    underlag: Fyndsamtal.underlag(nya, texter),
    ...(sammanstallning ? { sammanstallning: true } : {}),
    kallor: (sammanstallning ? nya.map((f, i) => [f, i + 1]).filter(([f]) => f.url) : nya.filter(f => f.url).map((f, i) => [f, i + 1]))
      .map(([f, nr]) => ({ nr, titel: f.titel, url: f.url, vard: f.fran || '', niva: 0, etikett: '', ...(f.vara ? { vara: f.vara } : {}) })) };
  const helig = u.grund ? [...sessioner.values()].find(x => x.id === u.grund && x.helig && !x.las) : null;
  const fore = helig || await agentSamtalet();
  agentTur.uppdrag = u.id;
  const s = fore && !(fore.las?.styrka === 'forseglad') && !fore.las && !fore.forseglad && !fore.arkiverad ? fore : { id: randomUUID(), titel: Fyndsamtal.rubrik(u, nya), skapad: tid, andrad: tid,
    agare: null, projekt: u.projekt || null, turer: [], karta: [], raknare: {},
    avAgenten: true, uppdrag: u.id, minne: 'isolerat', webb: 'av',
    behandling: Behandling.stall(installningar.behandling) };
  s.turer.push(agentTur);
  s.andrad = tid;
  s.etiketter = [...new Set([...(s.etiketter || []), ...nya.map(f => f.sfar).filter(Boolean)])].slice(0, 12);
  sessioner.set(s.id, s);
  await spara(s);
  if (s.id !== u.session) {
    const i = uppdrag.findIndex(x => x.id === u.id);
    if (i >= 0) { uppdrag[i] = { ...uppdrag[i], session: s.id }; await sparaUppdrag(); }
  }
  sand(s.id, { typ: 'agenttur', tur: agentTur });
  for (const f of nya) f.samtal = s.id;
  sandAlla({ typ: 'lista' });
  sandAlla({ typ: 'fyndsamtal', id: s.id, titel: s.titel });

  const lista = sammanstallning ? Sammanstallning.kallista(nya, { utanLank: true }) : Fyndsamtal.lista(nya);
  let sammanfattning = '';
  if (sammanstallning) {
    sammanfattning = await skrivSammanstallning(u, nya, { snabb });
    sand(s.id, { typ: 'text', turId: agentTur.id, bit: sammanfattning });
  } else if (korningar.size > 0) {
    sammanfattning = tx('srv.fyndsamtal.ingenSammanfattning');
    sand(s.id, { typ: 'text', turId: agentTur.id, bit: sammanfattning });
  } else if (snabb) {
    sammanfattning = tx('srv.fyndsamtal.varvetFullt');
    sand(s.id, { typ: 'text', turId: agentTur.id, bit: sammanfattning });
  } else {
    try {
      sammanfattning = await agentAnrop(Fyndsamtal.prompt(u, nya, { profil: Profil.somText(malet(u)), texter }), {
        tak: 500, onText: bit => sand(s.id, { typ: 'text', turId: agentTur.id, bit }),
      });
    } catch (e) {
      sammanfattning = e.foretrade ? tx('srv.fyndsamtal.ingenSammanfattning') : tx('srv.fyndsamtal.sammanfattningFel', { fel: e.message });
    }
  }
  sammanfattning = duForm(String(sammanfattning), { kalla: [...nya.map(f => `${f.titel || ''}\n${f.fran || ''}\n${f.text || ''}`), ...(texter || [])].join('\n') });
  agentTur.svar = `${String(sammanfattning).trim()}\n\n${lista}`.trim();
  agentTur.status = 'klar';
  if (!snabb) await namngeTraden(u, s, sammanfattning).catch(() => {});
  agentTur.kvitto = [{ tid: new Date().toISOString(), aktor: tx('srv.liggare.aktorAgenten'), lokalt: true, ms: 0,
    vad: sammanstallning ? tx('srv.kvitto.sammanstallningUr', { n: nya.length, titel: u.titel }) : tx('srv.kvitto.fyndUr', { n: nya.length, titel: u.titel }) }];
  await spara(s);
  sand(s.id, { typ: 'klar', turId: agentTur.id, tur: agentTur, titel: s.titel });
  sandAlla({ typ: 'lista' });
  return s;
}

async function anslagstavlan(hant, nu) {
  const a = agentInst();
  if (!a.anteckningar?.mapp || !a.anteckningar.skriv) return;
  const nya = hant.filter(h => h.fynd > 0);
  if (!nya.length) return;

  const rader = fynd.filter(f => !f.sett).slice(0, 20).map(f =>
    `${'•'.repeat(f.vikt || 1)} ${f.titel}${f.fran ? ` — ${f.fran}` : ''}\n   ${f.varfor}`);
  if (!rader.length) return;
  const stund = new Date(nu).toLocaleString(lokalNu(), { dateStyle: 'short', timeStyle: 'short' });
  try {
    await Anteckningar.skriv(a.anteckningar.mapp, {
      konto: a.anteckningar.konto || null,
      rubrik: tx('srv.anslag.rubrik', { stund }),
      text: [tx('srv.anslag.sakerSedanSist', { n: rader.length }), '', ...rader].join('\n'),
    });
  } catch (e) {
    hant.push({ uppdrag: null, titel: tx('srv.spar.anslagstavlan'), fynd: 0, skal: null,
      fel: tx('srv.spar.anslagFel', { mapp: a.anteckningar.mapp, fel: e.message }) });
  }
}

let kapCache = null, kapNar = 0;
async function kapacitetsvar({ farsk = false } = {}) {
  if (!farsk && kapCache && Date.now() - kapNar < 30000) return kapCache;
  const d = await Kapacitet.lage().catch(() => null);
  kapCache = d
    ? { lage: d.lage, skal: d.skal, tillgangligt: d.tillgangligt,
        barMaskinen: d.barMaskinen, samtal: d.samtal, agent: d.agent,
        mattAv: 'os',
        valjs: d.valjs }
    : { lage: 'en', skal: tx('srv.kapacitet.kundeInteMata'),
        mattAv: null, valjs: true };
  kapNar = Date.now();
  return kapCache;
}

function malet(u) {
  const p = installningar.profil || null;
  if (!u?.projekt) return p;
  const pr = projekt.find(x => x.id === u.projekt);
  if (!pr?.mal) return p;
  return { ...(p || Profil.TOM), vill: pr.mal };
}

async function veckanNu(nu = new Date()) {
  const a = agentInst();
  let handelser = [];
  if (a.kalender && Kalender.finns()) {
    const { fran, till } = Kalender.veckan(nu);
    handelser = await Kalender.handelser({ fran, till }).catch(() => []);
  }
  return Veckan.veckan({ handelser, frister, fynd, uppdrag, nu });
}

function agentnotiser() {
  const ut = [];

  for (const f of frister.filter(x => !x.klar)) {
    const kvar = Frister.dagarKvar(f.forfaller);
    if (kvar > 14) continue;
    ut.push({
      sort: kvar <= 2 ? 'fel' : 'paus',
      titel: f.vad || f.lagrum || tx('srv.notis.frist'),
      om: tx('srv.notis.fristOm', { bradska: Frister.brådska(f.forfaller).text, om: f.om || '' }).trim(),
      nar: f.forfaller,
    });
  }

  for (const u of uppdrag) {
    if (u.tillstand === 'pausad') {
      ut.push({ sort: 'fel', titel: u.titel, uppdrag: u.id,
        om: tx('srv.notis.pausatEfterFel', { n: u.fel?.antal || 0, varfor: u.fel?.varfor || '' }).trim() });
    } else if ((u.fel?.antal || 0) > 0) {
      ut.push({ sort: 'paus', titel: u.titel, uppdrag: u.id,
        om: tx('srv.notis.forsokMisslyckats', { n: u.fel.antal, grans: Uppdrag.FEL_INNAN_PAUS }) });
    }
  }

  const osedda = fynd.filter(f => !f.sett).length;
  const sedanSist = agentspar[0]?.nar;
  if (osedda && sedanSist) {
    ut.push({ sort: 'nytt', titel: tx('srv.notis.olasta', { n: osedda }),
      om: tx('srv.notis.medanBorta'), nar: sedanSist });
  }
  return ut.slice(0, 30);
}

let hjartat = null;
let tickNr = 0;
async function tick() {
  tickNr++;
  if (installningar.agentBatteri !== 'samma' && await paBatteri() && tickNr % 3 !== 0) return;
  const r = await slaHjarta();
  await lasFranTelefonen().catch(e => console.log(`  från telefonen: ${e.message}`));
  if (r?.nej === 'pagar') hjartaSkuld = true;
}

let batteriSvar = { nar: 0, pa: false };
async function paBatteri() {
  if (process.platform !== 'darwin') return false;
  if (Date.now() - batteriSvar.nar < 5 * 60e3) return batteriSvar.pa;
  const { stdout } = await new Promise(los => execFileCb('/usr/bin/pmset', ['-g', 'batt'], (e, out) => los({ stdout: out || '' })));
  batteriSvar = { nar: Date.now(), pa: /Battery Power/.test(stdout) };
  return batteriSvar.pa;
}
function stallHjartat() {
  if (hjartat) clearInterval(hjartat);
  const takt = Number(agentInst().takt);
  hjartat = takt > 0 ? setInterval(() => tick().catch(() => {}), takt * 60e3) : null;
  hjartat?.unref?.();
}
{
  let senast = Date.now();
  setInterval(() => {
    const nuMs = Date.now();
    if (nuMs - senast > 3 * 60e3) {
      console.log(`  vaknade efter ${Math.round((nuMs - senast) / 60e3)} min — kör ikapp det som missats`);
      ikappSedan = new Date(senast).toISOString();
      slaHjarta().catch(() => {});
    }
    senast = nuMs;
  }, 60e3).unref?.();
}
let ikappSedan = null;

let handelseSenast = {};
const handelseSignaler = {};
const handelseForra = {};
const mappVakter = new Map();
async function vaktaHandelser() {
  if (slarNu || hjartaSkuld || !uppdrag.some(u => u.handelse)) return;
  const vagar = new Set(uppdrag.flatMap(u => u.kallor.filter(k => k.typ === 'mapp').map(k => k.sokvag || installningar.agent?.mapp?.sokvag)).filter(Boolean));
  for (const [v, w] of mappVakter) if (!vagar.has(v)) { w.close(); mappVakter.delete(v); }
  for (const v of vagar) if (!mappVakter.has(v)) {
    try { mappVakter.set(v, fsWatch(v, () => { handelseSignaler[`mapp:${v}`] = Date.now(); handelseSignaler.mapp = Date.now(); })); } catch {  }
  }
  for (const [typ, fil] of [['meddelanden', Meddelanden.CHATT()], ['samtal', Meddelanden.SAMTAL()]]) {
    let m = 0;
    for (const f of [fil, `${fil}-wal`]) { const st = await stat(f).catch(() => null); if (st) m = Math.max(m, st.mtimeMs); }
    if (m && handelseForra[typ] && m > handelseForra[typ]) handelseSignaler[typ] = Date.now();
    if (m) handelseForra[typ] = m;
  }
  for (const id of Handelser.attKolla(uppdrag, { senast: handelseSenast, signaler: handelseSignaler })) {
    const u = uppdrag.find(x => x.id === id);
    if (!u) continue;
    const r = await slaHjarta({ bara: id, handelse: true }).catch(() => null);
    if (r?.nej) break;
    handelseSenast = Handelser.stampla(handelseSenast, u);
  }
}
setInterval(() => vaktaHandelser().catch(e => console.log(`  händelser: ${e.message}`)), 30e3).unref?.();
setTimeout(() => slaHjarta().catch(() => {}), 30000).unref?.();
stallHjartat();
{
  let varKlar = agentBehov().klar;
  setInterval(() => {
    const nu = agentBehov().klar;
    if (nu !== varKlar) { sandAlla({ typ: 'lista' }); if (nu) slaHjarta().catch(() => {}); }
    varKlar = nu;
  }, 5000).unref?.();
}

async function namnmodellErbjuds() {
  if (!installningar.forsta?.klar || installningar.namnmodell === false
    || installningar.namnmodellErbjuden === VERSION) return false;
  const l = await Namnmodell.namnmodellLage();
  return Boolean(l.plattform && !l.finns);
}

function notifiera(titel, text, session = null, { viktigt = false } = {}) {
  if (installningar.agentNotiser === false) return;
  if (viktigt) tillTelefonen(titel, text, { session }).catch(e => console.log(`  telefonen: ${e.message}`));
  sandAlla({ typ: 'notis', titel, text, session });
  if (oversikt.size === 0) systemnotis(titel, text);
}

function systemnotis(titel, text) {
  if (process.env.MAXIMUS_PROV === '1') return;
  systemnotisVag({ titel, text, app: process.env.MAXIMUS_APP || '', server: join(HAR, 'server.mjs'),
    logg: m => console.log(`  notisen: ${m}`) });
}

let telefonLogg = { skickade: [], paminnelser: [] };
try { telefonLogg = { ...telefonLogg, ...JSON.parse(await maximus.lasFil(join(dataDir, 'telefon.json'))) }; } catch {  }
const sparaTelefon = () => maximus.skrivFil(join(dataDir, 'telefon.json'), JSON.stringify({
  skickade: telefonLogg.skickade.slice(-50), paminnelser: telefonLogg.paminnelser.slice(-50), egna: (telefonLogg.egna || []).slice(-500) }));

async function vilaSek() {
  if (process.platform !== 'darwin') return 0;
  const ut = await new Promise(klar => execFileCb('/usr/sbin/ioreg', ['-c', 'IOHIDSystem', '-d', '4'], { maxBuffer: 4e6 }, (e, o) => klar(String(o || ''))));
  const m = /"HIDIdleTime"\s*=\s*(\d+)/.exec(ut);
  return m ? Number(m[1]) / 1e9 : 0;
}

async function tillTelefonen(titel, text, { prov = false, session = null } = {}) {
  const t = agentInst().telefon || {};
  const kanal = Telefon.kanalUr(t.kanal);
  if (kanal === 'av' || process.platform !== 'darwin') return { skickat: false, skal: tx('srv.telefon.av') };
  if (!prov) {
    if (!Telefon.arBorta(await vilaSek())) return { skickat: false, skal: tx('srv.telefon.vidDatorn') };
    if (!Telefon.inomTak(telefonLogg.skickade)) return { skickat: false, skal: tx('srv.telefon.taket') };
  }
  const karta = new Map(), raknare = new Map();
  const rad = Telefon.rad(utatGrind(titel, { karta, raknare, sorter: galler(installningar) }),
    utatGrind(text, { karta, raknare, sorter: galler(installningar) }));
  const t0 = Date.now();
  let fel = null;
  try {
  if (kanal === 'imessage') {
    const till = Telefon.adressUr(t.till);
    if (!till) throw new Error(tx('srv.telefon.ingenAdress'));
    await new Promise((klar, fel) => execFileCb('/usr/bin/osascript', ['-e', Telefon.IMESSAGE_SKRIPT, '--', till, rad], { timeout: 20000 },
      (e, o, err) => (e ? fel(new Error(tx('srv.telefon.meddelandenSvaradeInte', { fel: String(err || e.message).trim().slice(0, 160) }))) : klar())));
  } else {
    const r = await skrivHjalpare('paminnelse', { titel: rad, anteckning: Telefon.svarsrad(), lista: Telefon.LISTA, skapaLista: true, forfaller: new Date(Date.now() + 30e3).toISOString() });
    if (r?.id) telefonLogg.paminnelser.push({ id: r.id, ...(r.extern ? { extern: r.extern } : {}), tid: new Date().toISOString(), session, text: rad });
  }
  } catch (e) { fel = e; throw e; } finally {
    await liggare({ frontier: kanal === 'imessage' ? tx('srv.liggare.telefonMeddelanden') : tx('srv.liggare.telefonPaminnelser'),
      vag: 'telefon', skickat: rad, mottaget: fel ? '' : tx('srv.liggare.levererat'), tecken: rad.length,
      sekunder: (Date.now() - t0) / 1000, ...(fel ? { fel: fel.message.slice(0, 200) } : {}),
      anvandare: null, session, aktor: tx('srv.liggare.aktorAgenten') }).catch(() => {});
  }
  telefonLogg.skickade.push(new Date().toISOString());
  await sparaTelefon();
  return { skickat: true, kanal };
}

let lasesFranTelefonen = false;
async function lasFranTelefonen() {
  const t = agentInst().telefon || {};
  if (Telefon.kanalUr(t.kanal) !== 'paminnelse' || process.platform !== 'darwin' || lasesFranTelefonen) return [];
  if (maximus.skyddat && !maximus.upplast) return [];
  lasesFranTelefonen = true;
  try {
    const poster = await Paminnelser.paminnelser({ dagar: 2 }).catch(() => []);
    const lista = Array.isArray(poster) ? poster : [];
    await vaktLasLiggaren().catch(() => {});
    const lagad = Vakten.lagaTelefonlogg(lista, telefonLogg, { liggarrader: vaktLiggarrader });
    if (lagad.lagade) {
      telefonLogg = lagad.logg;
      await sparaTelefon();
      await vaktSager(Vakten.lagning('ekoTelefon', { n: lagad.lagade }), { nyckel: 'ekoTelefon' }).catch(() => {});
    }
    let handelser = Telefon.iListan(lista, telefonLogg);
    const dubbletter = [];
    let ganger = 0;
    for (const h of handelser.filter(x => x.sort !== 'sett')) {
      const u = Vakten.upprepning(vaktLage, 'telefon', h.text);
      vaktLage = u.lage;
      if (u.loop) { dubbletter.push(h); ganger = Math.max(ganger, u.ganger); }
    }
    if (dubbletter.length) {
      telefonLogg = Telefon.minns(telefonLogg, dubbletter);
      await sparaTelefon();
      handelser = handelser.filter(h => !dubbletter.includes(h));
      await vaktSager(Vakten.lagning('dubbletterTelefon', { n: ganger }), { nyckel: 'dubbletterTelefon' }).catch(() => {});
    }
    await sparaVakt();
    if (!handelser.length) return [];
    telefonLogg = Telefon.minns(telefonLogg, handelser);
    await sparaTelefon();
    for (const h of handelser) {
      if (h.sort === 'sett') {
        const fore = Date.parse(h.tid || 0) + 6e4;
        for (const f of fynd) if (f.samtal === h.session && !f.sett && Date.parse(f.skapad || 0) <= fore) f.sett = true;
        await sparaFynd();
        sandAlla({ typ: 'lista' });
        continue;
      }
      const s = (h.session && minSession(h.session, null)) || await agentSamtalet();
      if (!s) continue;
      const r = await fetch(`http://127.0.0.1:${PORT}/api/sessioner/${s.id}/skicka`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1', 'x-maximus-nyckel': NYCKEL },
        body: JSON.stringify({ fraga: tx('srv.telefon.franTelefonen', { text: h.text }), franTelefonen: true, webb: 'av' }),
      }).catch(() => null);
      await r?.text().catch(() => '');
      if (s.turer?.at(-1)?.svar && !Vakten.arPausad(vaktLage, 'telefonsvar')) await tillTelefonen(tx('srv.telefon.svaretStar'), s.titel || tx('srv.liggare.aktorAgenten'), { session: s.id }).catch(() => {});
    }
    return handelser;
  } finally { lasesFranTelefonen = false; }
}

async function stadaTelefonen(nu = Date.now()) {
  const gamla = telefonLogg.paminnelser.filter(x => nu - Date.parse(x.tid) > 864e5);
  if (!gamla.length) return;
  for (const x of gamla) await skrivHjalpare('ta-bort', x.id).catch(() => {});
  telefonLogg.paminnelser = telefonLogg.paminnelser.filter(x => !gamla.includes(x));
  await sparaTelefon();
}

let vaktLage = Vakten.tomtLage();
try { vaktLage = Vakten.lageUr(JSON.parse(await maximus.lasFil(join(dataDir, 'vakten.json')))); } catch {  }
const sparaVakt = () => maximus.skrivFil(join(dataDir, 'vakten.json'), JSON.stringify(vaktLage)).catch(() => {});

let vaktLiggarrader = [], vaktLast = 0;
async function vaktLasLiggaren({ farsk = false } = {}) {
  if (!farsk && Date.now() - vaktLast < 60e3) return vaktLiggarrader;
  vaktLast = Date.now();
  try { vaktLiggarrader = (await Liggare.las(maximus, dataDir, { dagar: 3 })).filter(r => r.vag === 'telefon'); } catch { vaktLiggarrader = []; }
  return vaktLiggarrader;
}

async function vaktSager(l, { nyckel = l.sort, nu = new Date() } = {}) {
  const f = Vakten.farSagas(vaktLage, nyckel, nu);
  vaktLage = f.lage;
  await sparaVakt();
  if (!f.ja) return null;
  const text = Vakten.rad(l);
  console.log(`  vakten: ${text}`);
  const ag = await agentSamtalet().catch(() => null);
  if (ag) {
    const vaktTur = { id: randomUUID(), tid: new Date().toISOString(), fraga: '', av: 'maximus', avAgenten: true, status: 'klar', svar: '', kvitto: [], kallor: [],
      sager: text, vakten: { sort: l.sort, ...(l.rapport ? { rapport: Vakten.rapportText(l) } : {}) } };
    ag.turer.push(vaktTur); ag.andrad = vaktTur.tid; await spara(ag);
    sand(ag.id, { typ: 'agenttur', session: ag.id, tur: vaktTur });
    sandAlla({ typ: 'lista' });
  }
  await liggare({ frontier: tx('vakten.liggare'), vag: 'lokal', skickat: text, mottaget: tx('srv.liggare.gjort'),
    tecken: 0, sekunder: 0, anvandare: null, session: null, aktor: tx('srv.liggare.aktorAgenten') }).catch(() => {});
  return text;
}

function vaktForUppdrag(u, nu, lagningar, undan) {
  return async ({ kalla: k, nyckel, poster, nya, marke }) => {
    const bkey = `${u.id}:${nyckel}`;
    const namn = bestamdKalla(k.typ);
    const e = Vakten.eko(nya, Vakten.egnaRader(telefonLogg, { liggarrader: vaktLiggarrader }), { kalltyp: k.typ });
    let kvar = e.kvar;
    if (e.eko.length) lagningar.push([Vakten.lagning('eko', { n: e.eko.length }), `eko:${bkey}`]);
    const sedda = vaktLage.avtryck[bkey] || [];
    const f = Vakten.flod({ nya: kvar, sedda, marke });
    if (f) {
      kvar = f.behall;
      undan.push(...f.undan.map(p => vaktUndan(u, p, tx('vakten.undan.sett'), nu)));
      lagningar.push([Vakten.lagning(f.sort, { kalla: namn, antal: f.antal, av: f.av }), `flod:${bkey}`]);
    }
    vaktLage = { ...vaktLage, avtryck: { ...vaktLage.avtryck, [bkey]: Vakten.minnsAvtryck(sedda, Array.isArray(poster) ? poster : []) } };
    return { nya: kvar };
  };
}
const vaktUndan = (u, p, varfor, nu) => ({ uppdrag: u.id, titel: String(p.titel || p.amne || '').slice(0, 120), kalla: p.kalla || null,
  kallid: p.id ? String(p.id) : null, varfor, sfar: p.sfar || null, skapad: new Date(nu).toISOString() });

function vaktLoopFynd(u, rader, nu, lagningar) {
  const kvar = [], dubbletter = [];
  let ganger = 0;
  for (const f of rader || []) {
    const r = Vakten.upprepning(vaktLage, `fynd:${u.id}`, `${f.titel} ${f.fran || ''} ${String(f.text || '').slice(0, 300)}`, nu);
    vaktLage = r.lage;
    if (r.loop) { dubbletter.push(vaktUndan(u, f, tx('vakten.undan.dubblett'), nu)); ganger = Math.max(ganger, r.ganger); } else kvar.push(f);
  }
  if (dubbletter.length) lagningar.push([Vakten.lagning('dubbletter', { titel: u.titel, n: ganger }), `dubbletter:${u.id}`]);
  return { rader: kvar, dubbletter };
}

async function vaktKoa(s, tur, kropp) {
  tur.status = 'klar';
  tur.svar = tx('vakten.iKo');
  tur.vakten = { ko: true };
  await spara(s).catch(() => {});
  sand(s.id, { typ: 'klar', turId: tur.id, tur, titel: s.titel });
  const k = Vakten.koa(vaktLage, { id: tur.id, session: s.id, fraga: tur.fraga, franTelefonen: Boolean(tur.franTelefonen),
    av: tur.av || null, sager: tur.sager || '', fortsattning: Boolean(tur.fortsattning), webb: kropp.webb ?? 'av',
    ...(typeof kropp.vaktKoad === 'string' && Number.isFinite(Date.parse(kropp.vaktKoad)) ? { koad: kropp.vaktKoad } : {}) });
  vaktLage = k.lage;
  await sparaVakt();
  await vaktSager(Vakten.lagning('modell', { vad: tur.franTelefonen ? tx('vakten.modell.franTelefonen') : tx('vakten.modell.eget') }), { nyckel: 'modell' });
}

let provarKon = false;
async function provaKon(nu = new Date()) {
  if (provarKon || !vaktLage.ko.length || korningar.size > 0) return;
  if (maximus.skyddat && !maximus.upplast) return;
  provarKon = true;
  try {
    const r = Vakten.nastaIKon(vaktLage, nu);
    vaktLage = r.lage;
    if (r.gavUpp.length) {
      await sparaVakt();
      await vaktSager(Vakten.lagning('modellGavUpp', { n: r.gavUpp.length }), { nyckel: 'modellGavUpp', nu });
    }
    if (!r.nasta || !(await grindSvarar().catch(() => false))) return;
    const x = r.nasta;
    vaktLage = Vakten.urKon(vaktLage, x.id);
    await sparaVakt();
    const s = minSession(x.session, null);
    if (!s || s.las || s.forseglad || s.arkiverad) return;
    s.turer = s.turer.filter(t => t.id !== x.id);
    await spara(s);
    const svar = await fetch(`http://127.0.0.1:${PORT}/api/sessioner/${s.id}/skicka`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1', 'x-maximus-nyckel': NYCKEL },
      body: JSON.stringify({ fraga: x.fraga, webb: x.webb, vaktKoad: x.koad,
        ...(x.franTelefonen ? { franTelefonen: true } : {}),
        ...(x.av === 'maximus' ? { av: 'maximus', sager: x.sager, ...(x.fortsattning ? { fortsattning: true } : {}) } : {}) }),
    }).catch(() => null);
    await svar?.text().catch(() => '');
    sandAlla({ typ: 'lista' });
  } finally { provarKon = false; }
}
setInterval(() => provaKon().catch(e => console.log(`  vakten: ${e.message}`)), 30e3).unref?.();

async function vaktSvarFranTelefonen(tur) {
  const r = Vakten.upprepning(vaktLage, 'telefonsvar', tur.svar || '');
  vaktLage = r.lage;
  if (r.loop) {
    vaktLage = Vakten.pausa(vaktLage, 'telefonsvar');
    await vaktSager(Vakten.lagning('loopSvar', { n: r.ganger }), { nyckel: 'loopSvar' });
  }
  await sparaVakt();
}

const sand = (id, h) => { for (const r of strommar.get(id) || []) r.write(`data: ${JSON.stringify(h)}\n\n`); };
const sandAlla = h => { for (const r of oversikt) { try { r.write(`data: ${JSON.stringify(h)}\n\n`); } catch { oversikt.delete(r); } } };

const filarbete = new Map();
function satFilarbete(s, vad) {
  if (vad) filarbete.set(s.id, vad); else filarbete.delete(s.id);
  sandAlla({ typ: 'lista', agare: s.agare });
}
const arbeteI = id => filarbete.get(id) || (korningar.has(id) ? tx('srv.sidopanel.svarar') : null);

const vantande = new Map();
function vantaPaSvar(turId, session, ms = 180000) {
  return new Promise(los => {
    const klocka = setTimeout(() => { vantande.delete(turId); los(false); }, ms);
    vantande.set(turId, { session, svara: svar => { clearTimeout(klocka); vantande.delete(turId); los(svar); } });
  });
}

const koder = new Map();

const stangd = s => Boolean(s?.forseglad) && !koder.has(s.id);

async function anonymiseraStycken(maskerad, { pa = () => {}, baraLokalt = false, signal } = {}) {
  const bitar = stycken(maskerad, { minsta: 400, storsta: 2200 });
  const ut = [];
  const vagt = [];
  let lamnade = 0;
  pa({ borjan: true, block: bitar.length, bitar });
  for (const [i, bit] of bitar.entries()) {
    pa({ letar: vadFinns(bit) });
    const efter = await svaraLokalt(tx('srv.anonym.textenEtikett', { generalisera: GENERALISERA, bit }), {
      onText: t => pa({ bit: t }), baraLokalt, signal,
    });
    const d = blevVagare(bit, rensaPrat(efter));
    ut.push(d.ok ? rensaPrat(efter) : bit);
    if (!d.ok) lamnade++;
    const v = d.ok ? blevVagt(bit, rensaPrat(efter)) : [];
    vagt.push(...v);
    pa({ klartBlock: i + 1, block: bitar.length, behollet: !d.ok, text: ut[ut.length - 1], vagt: v });
  }
  return { text: ut.join('\n\n'), lamnade, block: bitar.length, vagt };
}

const MASKNING_KALLA = { text: 'srv.maskning.kalla.text', citat: 'srv.maskning.kalla.citat', svar: 'srv.maskning.kalla.svar',
  bilaga: 'srv.maskning.kalla.bilaga', fraga: 'srv.maskning.kalla.fraga' };
const MASKNING_TITEL = { maskera: 'srv.maskning.titel.maskera', anonymisera: 'srv.maskning.titel.anonymisera', bada: 'srv.maskning.titel.bada' };

async function kopplaInPaBegaran(s, fraga, a, res) {
  const tur = { id: randomUUID(), tid: new Date().toISOString(), status: 'igang', fraga, maskerad: null,
    maskerat: 0, svar: '', frontier: null, lokalt: true, webb: false, anmarkningar: [], kvitto: [], kallor: [], bilagor: [] };
  s.turer.push(tur);
  await spara(s);
  json(res, 202, { turId: tur.id, stod: null });
  const kontroll = new AbortController();
  korningar.set(s.id, kontroll);
  sandAlla({ typ: 'lista', agare: s.agare });
  void (async () => {
    try {
      sand(s.id, { typ: 'steg', turId: tur.id, steg: 'koppling', text: tx('srv.mcp.steg.ansluter', { vard: (() => { try { return new URL(a.url).host; } catch { return a.url; } })() }) });
      const t0 = Date.now();
      const kort = await Mcp.granska(a.url, { kalla: 'lank', session: s.id, tur: tur.id, andraNamn: mcpAndraNamn() });
      await mcpGranskningsrad(kort, s.id);
      tur.kopplingskort = Mcp.somKort(kort);
      tur.svar = mcpSvar(kort);
      tur.kvitto = [{ tid: new Date().toISOString(), aktor: tx('srv.mcp.kvitto.granskningen'), lokalt: false, ms: Date.now() - t0,
        vad: tx('srv.mcp.kvitto.laste', { vard: kort.vard || a.url, n: kort.verktyg.length }) }];
      tur.status = 'klar';
      if (s.turer.length === 1 && !s.dopt) s.titel = tx('srv.mcp.titel');
      await spara(s);
      sand(s.id, { typ: 'klar', turId: tur.id, tur, titel: s.titel });
    } catch (e) {
      tur.status = kontroll.signal.aborted ? 'stoppad' : 'fel';
      tur.fel = kontroll.signal.aborted ? tx('srv.session.stoppad') : e.message;
      await spara(s).catch(() => {});
      sand(s.id, { typ: 'fel', turId: tur.id, meddelande: tur.fel });
    } finally { korningar.delete(s.id); sandAlla({ typ: 'lista', agare: s.agare }); }
  })();
}

async function kopplaTjanstPaBegaran(s, fraga, a, res) {
  const tur = { id: randomUUID(), tid: new Date().toISOString(), status: 'igang', fraga, maskerad: null,
    maskerat: 0, svar: '', frontier: null, lokalt: true, webb: false, anmarkningar: [], kvitto: [], kallor: [], bilagor: [] };
  s.turer.push(tur);
  await spara(s);
  json(res, 202, { turId: tur.id, stod: null });
  const kontroll = new AbortController();
  korningar.set(s.id, kontroll);
  sandAlla({ typ: 'lista', agare: s.agare });
  void (async () => {
    const steg = text => sand(s.id, { typ: 'steg', turId: tur.id, steg: 'koppling', text });
    try {
      const t0 = Date.now();
      const ord = grindaSokfraga(a.tjanst.toLowerCase(), { sorter: galler(installningar) }) || '';
      steg(tx('srv.mcp.steg.letar', { tjanst: a.tjanst }));
      const r = ord ? await McpSok.sokBrett(ord, { behov: { sok: ord } }) : { traffar: [], adresser: [] };
      await liggare({ frontier: tx('srv.liggare.mcpSok'), vag: 'register', skickat: r.adresser.join(' ').slice(0, 3000),
        mottaget: r.traffar.map(x => `${x.kalla}: ${x.namn}`).join('\n') || tx('srv.mcp.ingaForslag'), tecken: 0,
        sekunder: Math.round((Date.now() - t0) / 1000), session: s.id, anvandare: null, aktor: tx('srv.liggare.aktorAgenten') }).catch(() => {});
      const basta = r.traffar[0];
      let kort = null;
      if (!basta) {
        tur.svar = tx('srv.mcp.svar.ingenting', { tjanst: a.tjanst });
      } else if (basta.korning === 'fjarr' && basta.url) {
        steg(tx('srv.mcp.steg.ansluter', { vard: (() => { try { return new URL(basta.url).host; } catch { return basta.url; } })() }));
        const forslag = { registernamn: basta.namn, titel: basta.titel, utgivare: basta.utgivare, franTjansten: basta.officiell, repo: basta.repo, behov: ord };
        mcpForeslagna.set(basta.url, forslag);
        kort = await Mcp.granska(basta.url, { kalla: 'register', register: forslag, session: s.id, tur: tur.id, andraNamn: mcpAndraNamn() });
        Object.assign(kort, { bevaka: a.bevaka, fraga, traffar: r.traffar.map(McpSok.somTraff) });
        await mcpGranskningsrad(kort, s.id);
        tur.svar = mcpSvar(kort);
      } else {
        steg(tx('srv.mcp.steg.laser', { namn: basta.namn }));
        const kod = await McpSok.lasKallkod(basta);
        await liggare({ frontier: tx('srv.liggare.mcpKallkod', { namn: basta.namn }), vag: 'register', skickat: kod.adresser.join(' ').slice(0, 3000),
          mottaget: tx('srv.mcp.liggareKallkod', { tecken: kod.readme.length, sha: kod.sha || '-' }), tecken: kod.readme.length, sekunder: 0,
          session: s.id, anvandare: null, aktor: tx('srv.liggare.aktorAgenten') }).catch(() => {});
        const plan = McpPlan.bygg(basta, kod);
        const sagt = /(?<![\p{L}])(?:varje|var|dagligen|timvis|veckovis|every|daily|hourly|weekly)(?![\p{L}])/iu.test(fraga);
        const takt = a.bevaka ? (sagt ? Math.max(60, Uppdrag.taktAv(fraga, [{ typ: 'koppling' }])) : 1440) : null;
        kort = Mcp.planKort({ plan, traffar: r.traffar.map(McpSok.somTraff), bevaka: a.bevaka, takt, fraga, session: s.id, tur: tur.id,
          text: McpPlan.somText(plan, { bevaka: a.bevaka ? hurOftaText(takt) : null }) });
        tur.svar = plan.stopp.length ? tx('srv.mcp.svar.planStoppad', { namn: plan.namn, n: plan.stopp.length }) : `${kort.text}\n\n${tx('srv.mcp.svar.planFraga')}`;
      }
      if (kort) tur.kopplingskort = Mcp.somKort(kort);
      tur.kvitto = [{ tid: new Date().toISOString(), aktor: tx('srv.mcp.kvitto.sokningen'), lokalt: false, ms: Date.now() - t0,
        vad: tx('srv.mcp.kvitto.sokte', { n: r.traffar.length }) }];
      tur.status = 'klar';
      if (s.turer.length === 1 && !s.dopt) s.titel = tx('srv.mcp.titel');
      await spara(s);
      sand(s.id, { typ: 'klar', turId: tur.id, tur, titel: s.titel });
    } catch (e) {
      tur.status = kontroll.signal.aborted ? 'stoppad' : 'fel';
      tur.fel = kontroll.signal.aborted ? tx('srv.session.stoppad') : e.message;
      await spara(s).catch(() => {});
      sand(s.id, { typ: 'fel', turId: tur.id, meddelande: tur.fel });
    } finally { korningar.delete(s.id); sandAlla({ typ: 'lista', agare: s.agare }); }
  })();
}

const hurOftaText = m => (Number(m) >= 1440 ? tx('srv.mcp.takt.dag') : Number(m) >= 60 ? tx('srv.mcp.takt.timme', { n: Math.round(Number(m) / 60) }) : tx('srv.mcp.takt.minut', { n: Number(m) || 60 }));

async function genomforPlan(kort) {
  const steg = async text => { kort.steg = text; await speglaKort(kort); };
  try {
    const t0 = Date.now();
    const inst = await McpInstall.installera(kort.plan, { dataDir, id: kort.kopplingsId, onSteg: t => { steg(t).catch(() => {}); } });
    await liggare({ frontier: tx('srv.liggare.mcpInstallation', { namn: kort.plan.namn }), vag: 'register', skickat: inst.kalla,
      mottaget: tx('srv.mcp.liggareInstallerad', { summa: inst.summa.slice(0, 23), katalog: inst.katalog }), tecken: 0,
      sekunder: Math.round((Date.now() - t0) / 1000), session: kort.session || null, anvandare: null, aktor: tx('srv.liggare.aktorAgenten') }).catch(() => {});
    kort.installation = inst;
    await steg(tx('srv.mcp.steg.startar'));
    let ny;
    if (inst.transport === 'http') {
      const url = await McpInstall.startaProcess(kort.kopplingsId, inst);
      ny = await Mcp.granska(url, { kalla: 'plan', session: kort.session, tur: kort.tur, andraNamn: mcpAndraNamn() });
      Mcp.glomKort(ny.id);
    } else {
      const r = await Mcp.starta({ id: kort.kopplingsId, namn: kort.plan.namn, installation: inst, fingeravtryck: null });
      r.koppling.stang();
      const g = r.forsta;
      ny = { ...kort, verktyg: g.verktyg, skal: g.skal, vagras: g.vagras, fingeravtryck: g.fingeravtryck, status: g.vagras ? 'vagras' : g.verktyg.length ? 'klar' : 'tom' };
    }
    Object.assign(ny, { id: kort.id, kopplingsId: kort.kopplingsId, plan: kort.plan, installation: inst, planJa: true, bevaka: kort.bevaka,
      takt: kort.takt, fraga: kort.fraga, text: kort.text, traffar: kort.traffar, namn: kort.plan.namn, kalla: 'plan', steg: null,
      utgivare: { ...kort.plan.utgivare, officiell: kort.plan.officiell, repo: kort.plan.repo } });
    Mcp.ersatt(ny);
    if (ny.status === 'inloggning' || ny.status === 'nyckel') { await speglaKort(ny); return; }
    await slutforPlan(ny);
  } catch (e) {
    kort.status = 'fel'; kort.fel = e.message; kort.steg = null;
    await McpInstall.taBort(dataDir, kort.kopplingsId, kort.installation).catch(() => {});
    await speglaKort(kort).catch(() => {});
  }
}

async function slutforPlan(kort) {
  if (kort.status !== 'klar') {
    if (kort.installation) await McpInstall.taBort(dataDir, kort.kopplingsId, kort.installation).catch(() => {});
    await speglaKort(kort);
    return;
  }
  const post = { ...Mcp.postFran(kort, { far: [], overallt: true }), installation: kort.installation, kalla: 'plan',
    plan: { repo: kort.plan.repo, kod: kort.plan.kod, officiell: kort.plan.officiell, licens: kort.plan.licens } };
  Plugins.stoppa(post.id);
  await sparaMcp([...mcpPoster().filter(p => p.id !== post.id), post]);
  await liggare({ frontier: tx('srv.liggare.mcpInkopplad', { namn: post.namn }), vag: 'lokal', skickat: post.plan.repo || post.namn,
    mottaget: tx('srv.mcp.liggareGodkand', { n: post.verktyg.length, far: 0 }), tecken: 0, sekunder: 0,
    session: kort.session || null, anvandare: null, aktor: tx('srv.helig.duTitel') }).catch(() => {});
  const utanArg = v => v.sort === 'las' && !(v.schema?.required || []).length;
  const prov = post.verktyg.filter(utanArg).sort((x, y) => Mcp.provvikt(y.namn) - Mcp.provvikt(x.namn))[0];
  if (prov) {
    try {
      await mcpIgang(post);
      const r = await mcpAnrop(post, prov.namn, {}, { session: kort.session });
      kort.provanrop = { verktyg: prov.namn, text: mcpRensa(String(r.text || '')).text.slice(0, 800), fel: Boolean(r.fel) };
    } catch (e) { kort.provanrop = { verktyg: prov.namn, text: e.message, fel: true }; }
  }
  if (kort.bevaka) {
    const valda = post.verktyg.filter(utanArg).filter(v => Mcp.provvikt(v.namn) > 0 && !/status|capabilit|sync|health/i.test(v.namn)).slice(0, 3).map(v => v.namn);
    if (valda.length) {
      const u = Uppdrag.nyttUppdrag({ instruktion: kort.fraga, titel: tx('srv.mcp.uppdragTitel', { namn: post.namn }),
        kallor: [{ typ: 'koppling', id: post.id, namn: post.namn, verktyg: valda }], takt: kort.takt || null, aterkommande: true });
      uppdrag.push(u);
      await sparaUppdrag();
      kort.uppdrag = { id: u.id, titel: u.titel, takt: u.takt, verktyg: valda };
      sandAlla({ typ: 'lista' });
    }
  }
  kort.status = 'godkand';
  Mcp.glomKort(kort.id);
  await speglaKort(kort);
  sandAlla({ typ: 'kopplingar' });
}

async function mcpTaBortAllt(post) {
  Plugins.stoppa(post.id);
  if (post.installation) await McpInstall.taBort(dataDir, post.id, post.installation).catch(() => {});
  await McpOauth.glomHemligheter(post.id);
  let andrat = false;
  for (const u of [...uppdrag]) {
    const kvar = (u.kallor || []).filter(k => !(k.typ === 'koppling' && k.id === post.id));
    if (kvar.length === (u.kallor || []).length) continue;
    andrat = true;
    if (kvar.length) u.kallor = kvar; else uppdrag.splice(uppdrag.indexOf(u), 1);
  }
  if (andrat) { await sparaUppdrag(); sandAlla({ typ: 'lista' }); }
}

async function maskeraPaBegaran(s, fraga, a, res) {
  const val = Maskbegaran.valjText(a, { turer: s.turer, filer: s.filer || [] });
  const tur = { id: randomUUID(), tid: new Date().toISOString(), status: 'igang', fraga, maskerad: null,
    maskerat: 0, svar: '', frontier: null, lokalt: true, webb: false, anmarkningar: [], kvitto: [], kallor: [],
    maskbegaran: a.gor, bilagor: [] };
  s.turer.push(tur);
  await spara(s);
  json(res, 202, { turId: tur.id, stod: null });

  const kontroll = new AbortController();
  korningar.set(s.id, kontroll);
  sandAlla({ typ: 'lista', agare: s.agare });
  void (async () => {
    const kvitto = [];
    const steg = (namn, text) => sand(s.id, { typ: 'steg', turId: tur.id, steg: namn, text });
    try {
      if (!val) {
        tur.svar = tx(a.kalla === 'bilaga' ? 'srv.maskning.ingenBilaga' : a.kalla === 'svar' ? 'srv.maskning.ingetSvar' : 'srv.maskning.vilkenText');
      } else {
        steg('maskera', tx('srv.maskning.steg.maskerar'));
        const t0 = Date.now();
        const fil = val.fil ? (s.filer || []).find(f => f.id === val.fil) : null;
        const m = await forbered(val.text, { karta: s.karta || [], raknare: s.raknare || {},
          sorter: galler(installningar), tolka: true, signal: kontroll.signal });
        s.karta = m.karta;
        s.raknare = m.raknare;
        if (fil && !fil.publik) {
          fil.maskerad = m.maskerad;
          fil.dolda = Maskbegaran.kartanI(m.maskerad, m.karta).length;
          delete fil.omaskerad;
        }
        kvitto.push({ tid: new Date().toISOString(), aktor: tx('srv.maskning.kvitto.maskeringen'), lokalt: true, ms: Date.now() - t0,
          vad: tx('srv.maskning.kvitto.maskerade', { n: Maskbegaran.kartanI(m.maskerad, m.karta).length }) });
        if (m.varning) kvitto.push({ tid: new Date().toISOString(), aktor: tx('srv.kvitto.lokalModell'), lokalt: true, ms: 0, fel: true, vad: m.varning });

        let text = m.maskerad, anonym = null, fel = null;
        if (a.gor !== 'maskera') {
          steg('anonymiserar', tx('srv.maskning.steg.anonymiserar'));
          const t1 = Date.now();
          try {
            const r = await anonymiseraStycken(m.maskerad, { baraLokalt: true, signal: kontroll.signal,
              pa: h => { if (h.klartBlock) steg('anonymiserar', tx('srv.maskning.steg.stycke', { klara: h.klartBlock, av: h.block })); } });
            const karta = new Map(s.karta.map(k => [k.original, k.platshallare]));
            const raknare = new Map(Object.entries(s.raknare || {}));
            const h = maskeraHart(r.text, { karta, raknare, sorter: galler(installningar) });
            text = h.skyddat.aterstall(h.text);
            s.karta = [...karta].map(([original, platshallare]) => ({ original, platshallare }));
            s.raknare = Object.fromEntries(raknare);
            anonym = { block: r.block, lamnade: r.lamnade, vagt: r.vagt.slice(0, 40), rojning: bedomRojning(text) };
            if (fil && !fil.publik) { fil.anonym = text; fil.anonymRojning = anonym.rojning; }
            kvitto.push({ tid: new Date().toISOString(), aktor: tx('srv.kvitto.lokalModell'), lokalt: true, ms: Date.now() - t1,
              vad: tx('srv.maskning.kvitto.skrevOm', { n: r.block - r.lamnade, av: r.block }) });
          } catch (e) {
            if (kontroll.signal.aborted) throw e;
            fel = String(e.message || e).slice(0, 160);
            kvitto.push({ tid: new Date().toISOString(), aktor: tx('srv.kvitto.lokalModell'), lokalt: true, ms: Date.now() - t1, fel: true,
              vad: tx('srv.maskning.kvitto.gickInte', { fel }) });
          }
        }
        const antal = Maskbegaran.perSort(text, s.karta);
        const n = antal.reduce((x, y) => x + y.antal, 0);
        const vad = tx(MASKNING_KALLA[val.kalla] || MASKNING_KALLA.text, { namn: val.namn || '' });
        tur.maskning = { gor: a.gor, kalla: val.kalla, namn: val.namn || null, fil: fil?.id || null, text, antal,
          karta: Maskbegaran.kartanI(text, s.karta), anonymiserad: Boolean(anonym), anonym, fel };
        tur.maskerat = n;
        tur.svar = fel ? tx('srv.maskning.svar.anonymFel', { vad, n, fel })
          : anonym ? tx(a.gor === 'bada' ? 'srv.maskning.svar.bada' : 'srv.maskning.svar.anonym', { vad, n, stycken: anonym.block - anonym.lamnade, av: anonym.block })
            : tx('srv.maskning.svar.maskera', { vad, n });
      }
      tur.status = 'klar';
      tur.kvitto = kvitto;
      if (s.turer.length === 1 && !s.dopt) s.titel = tx(MASKNING_TITEL[a.gor]);
      await spara(s);
      sand(s.id, { typ: 'klar', turId: tur.id, tur, titel: s.titel });
    } catch (e) {
      tur.status = kontroll.signal.aborted ? 'stoppad' : 'fel';
      tur.fel = kontroll.signal.aborted ? tx('srv.session.stoppad') : e.message;
      await spara(s).catch(() => {});
      sand(s.id, { typ: 'fel', turId: tur.id, meddelande: tur.fel });
    } finally { korningar.delete(s.id); sandAlla({ typ: 'lista', agare: s.agare }); }
  })();
}

const rensaPrat = text => String(text || '').trim()
  .replace(/^(?:här (?:är|kommer)|nedan (?:följer|står)|jag har|here (?:is|are|comes)|here's|below (?:is|are))[^\n]*\n+/i, '')
  .replace(/^\s*(?:\*{3,}|-{3,}|_{3,})\s*\n+/, '')
  .trim();

async function spara(s) {
  if (stangd(s)) throw new Error(tx('srv.session.forsegladAngeKod'));
  s.andrad = new Date().toISOString();
  const kat = sessionsKatalog(s.agare);
  await mkdir(kat, { recursive: true });
  const { forseglad, ...ren } = s;
  await maximus.skrivSession(join(kat, `${s.id}.json`), ren, koder.get(s.id) || null);
  sandAlla({ typ: 'lista', agare: s.agare });
}

async function lasMaximus(token = null) {
  for (const k of korningar.values()) k.abort(new Error(tx('srv.session.maximusLastes')));
  korningar.clear();
  for (const set of strommar.values()) {
    for (const r of set) { try { r.end(); } catch {  } }
  }
  strommar.clear();
  await stangWebben().catch(() => {});

  maximus.las_();
  if (await Locket.las(dataDir).catch(() => null)) {
    await maximus.glomINyckelring().catch(() => {});
    if (token) aterkalla(token);
  }
  sessioner.clear();
  koder.clear();
  oppnadeNycklar.clear();
  bankForslag.clear();
  kollegaMinnet = null;
  knackMoten = { nar: 0, lista: [] };
  Namnmodell.glomNamnmodell();
  installningar = { ...TOMMA_INSTALLNINGAR, klar: installningar.klar, sprak: installningar.sprak };
}

let stanger = false;

async function stangNer(varfor) {
  if (stanger) return;
  stanger = true;
  console.log(`MAXIMUS stänger: ${varfor}`);

  await lasMaximus().catch(e => console.log(`  låsningen klagade: ${e.message}`));

  if (modellPausad) await fortsattModell().catch(() => {});
  await stoppaModell().catch(e => console.log(`  modellen stängdes inte: ${e?.code || e?.message || e}`));

  await slappModeller().catch(() => {});

  await unlink(join(dataDir, 'server.pid')).catch(() => {});

  await writeFile(join(dataDir, 'stangd-med-flit'), new Date().toISOString(), { mode: 0o600 })
    .catch(() => {});
  process.exit(0);
}

for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(signal, () => { stangNer(signal); });
}

await writeFile(join(dataDir, 'server.pid'), String(process.pid), { mode: 0o600 });
await unlink(join(dataDir, 'stangd-med-flit')).catch(() => {});

{
  const foralder = Number(process.env.MAXIMUS_FORALDER || 0);
  if (foralder > 0) {
    const vakt = setInterval(() => {
      try { process.kill(foralder, 0); }
      catch { stangNer('appen är borta'); }
    }, 2000);
    vakt.unref();
  }
}

async function liggare(post) {
  if (installningar.liggare === false) return;

  post.tid = post.tid || new Date().toISOString();

  const sess = post.session ? sessioner.get(post.session) : null;
  if (sess?.las?.styrka === 'forseglad') {
    const { skickat, mottaget, ...resten } = post;
    try {
      const nyckel = await maximus.nyckelFor(sess, koder.get(sess.id) || null);
      post = { ...resten, forseglad: true,
        kuvert: maximus.forsegla(JSON.stringify({ skickat, mottaget }), nyckel) };
    } catch {
      post = { ...resten, forseglad: true, kuvert: null };
    }
  }
  const dag = post.tid.slice(0, 10);
  const vag = join(dataDir, 'liggare', `${dag}.json`);
  await maximus.andraFil(vag, async gammalt => {
    if (Liggarkedja.arKedjad(gammalt))
      return { ...gammalt, rader: [...gammalt.rader, post] };

    const lank = await Liggarkedja.lankaTill(maximus, dataDir, dag);
    return { k: Liggarkedja.KEDJEVERSION, forra: lank.forra, forraDag: lank.forraDag,
      rader: [...(Liggarkedja.raderUr(gammalt) || []), post] };
  }, { forval: null });
}

const hamtningsliggare = jag => p => liggare({ ...p, anvandare: jag?.id || null, session: null, aktor: tx('srv.helig.duTitel') });

const franUtifran = s => Boolean(s?.delad)
  || (s?.turer || []).some(t => (t.kallor || []).some(k => /^https?:/i.test(String(k?.url || ''))));
const karantan = fil => process.platform !== 'darwin' ? Promise.resolve() : new Promise(klar =>
  execFileCb('/usr/bin/xattr', ['-w', 'com.apple.quarantine', `0081;${Math.floor(Date.now() / 1000).toString(16)};Maximus;`, fil],
    e => { if (e) console.error('karantänmärket gick inte att sätta:', e.message); klar(); }));

function liggaroppnare(rad, kuvert) {
  const sess = rad.session ? sessioner.get(rad.session) : null;
  if (!sess || !koder.has(sess.id)) return null;
  const nyckel = oppnadeNycklar.get(sess.id);
  if (!nyckel) return null;
  return JSON.parse(maximus.oppnaKuvert(kuvert, nyckel));
}

const oppnadeNycklar = new Map();

async function minnsKod(sess, kod) {
  koder.set(sess.id, kod);
  try { oppnadeNycklar.set(sess.id, await maximus.nyckelFor(sess, kod)); }
  catch { oppnadeNycklar.delete(sess.id); }
}

const glomKod = id => { koder.delete(id); oppnadeNycklar.delete(id); };

async function taBortSession(s) {
  korningar.get(s.id)?.abort(new Error(tx('srv.session.borttagen')));
  sessioner.delete(s.id);
  glomKod(s.id);
  await Artefakt.taBortAlla(sessionsKatalog(s.agare), s.id).catch(() => {});
  try { await unlink(join(sessionsKatalog(s.agare), `${s.id}.json`)); }
  catch (e) { if (e.code !== 'ENOENT') return e.message; }
  return null;
}

const json = (res, kod, v) => { res.writeHead(kod, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(v)); };

let paket = Regelpaket.valj(await readFile(join(dataDir, 'regelpaket.json'), 'utf8').catch(() => null));
satExtraMonster(Regelpaket.monsterUr(paket));
if (paket.varning) console.log(`  ⚠ regelpaketet: ${paket.varning}`);

let intyget = await maximus.lasFil(join(dataDir, 'intyg.json'))
  .then(t => JSON.parse(t)).catch(() => null);

const TYPER = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const statisk = {};
for (const namn of await readdir(join(HAR, 'public'), { recursive: true })) {
  const typ = TYPER[extname(namn).toLowerCase()];
  if (!typ) continue;
  statisk[`/${namn.split(sep).join('/')}`] = { kropp: await readFile(join(HAR, 'public', namn)), typ };
}
statisk['/'] = statisk['/index.html'];

function vemAr(req) {
  if (!IDENTITET) return { id: 'en', namn: installningar.namn };
  return utokning.vemAr(req);
}

const nyckelfil = join(dataDir, 'nyckel');
const NYCKEL = process.env.MAXIMUS_NYCKEL
  || (await readFile(nyckelfil, 'utf8').catch(() => '')).trim()
  || randomBytes(32).toString('base64url');
if (!IDENTITET) await writeFile(nyckelfil, NYCKEL, { mode: 0o600 });

const KAKANS_ALDER = 60 * 60 * 24 * 30;
const nyckelkaka = token => `maximus=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${KAKANS_ALDER}`;

const tokenfil = () => join(dataDir, 'sessioner.token');
let sessionstoken = new Set();
const TOKENTAK = 50;

try {
  const rader = (await readFile(tokenfil(), 'utf8')).split('\n').map(r => r.trim()).filter(Boolean);
  sessionstoken = new Set(rader.slice(-TOKENTAK));
} catch {  }

async function sparaToken() {
  try {
    await writeFile(tokenfil(), [...sessionstoken].join('\n'), { mode: 0o600 });
  } catch (e) {
    console.error('kunde inte spara sessionstoken:', e.message);
  }
}

function nyToken() {
  if (sessionstoken.size >= TOKENTAK) sessionstoken.delete(sessionstoken.values().next().value);
  const t = randomBytes(32).toString('base64url');
  sessionstoken.add(t);
  void sparaToken();
  return t;
}

const aterkalla = (utom = null) => {
  const n = sessionstoken.size;
  sessionstoken.clear();
  if (utom) sessionstoken.add(utom);
  if (sessionstoken.size) void sparaToken();
  else void unlink(tokenfil()).catch(() => {});
  return utom ? n - 1 : n;
};

const minToken = req => {
  const k = /(?:^|;\s*)maximus=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  return k && sessionstoken.has(k) ? k : null;
};

function harNyckel(req, url, vag) {
  if (IDENTITET) return true;
  if (vag === '/' && nyckelLika(url.searchParams.get('n'), NYCKEL)) return true;
  if (nyckelLika(req.headers['x-maximus-nyckel'], NYCKEL)) return true;
  const kaka = /(?:^|;\s*)maximus=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  return Boolean(kaka) && sessionstoken.has(kaka);
}

const franAnnanPlats = req => {
  const s = req.headers['sec-fetch-site'];
  return s && s !== 'same-origin' && s !== 'none';
};

function utanNyckel(req, res, vag) {
  if (vag.startsWith('/api/')) return json(res, 403, { error: tx('srv.fel.felNyckel') });
  res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  return res.end(`<!doctype html><html lang="${Sprakstod.aktuellt()}"><head><meta charset="utf-8">
<title>MAXIMUS</title><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  :root { color-scheme: dark }
  body { margin: 0; min-height: 100vh; display: grid; place-content: center; gap: 18px;
    background: #212121; color: #ececec; text-align: center; padding: 40px 24px;
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
  svg { width: 46px; height: 46px; margin: 0 auto; color: #ececec }
  h1 { font-size: 21px; font-weight: 550; letter-spacing: -.4px; margin: 0 }
  p { margin: 0; color: #b4b4b4; max-width: 30rem }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px;
    background: #ffffff0f; padding: 2px 6px; border-radius: 5px; color: #ececec }
</style></head><body>
<svg viewBox="0 0 64 64" aria-label="MAXIMUS"><g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="butt"><path class="lab-yttre" d="M32 56A24 24 0 1 1 50.39 47.43"/><path class="lab-inre" d="M32 20.5A11.5 11.5 0 1 1 22.58 25.4"/></g><circle cx="32" cy="32" r="3.6" fill="currentColor"/></svg>
<h1>${tx('srv.utanNyckel.rubrik')}</h1>
<p>${tx('srv.utanNyckel.text')}</p>
<p>${tx('srv.utanNyckel.starta')}</p>
</body></html>`);
}

const server = createServer(async (req, res) => {
  const kod = await Sprakstod.valtCachat(installningar.sprak).catch(() => Sprakstod.GRUND);
  return Sprakstod.med(kod, () => hanteraAnrop(req, res));
});

async function hanteraAnrop(req, res) {
  try {
    if (!IDENTITET && !tillatenVard(req.headers.host, PORT)) {
      res.writeHead(421, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: tx('srv.fel.felVardnamn') }));
    }
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const vag = url.pathname;

    if (vag === '/api/identitet' && req.method === 'GET') {
      if (IDENTITET) return json(res, 404, { error: tx('srv.fel.finnsInte') });
      const svar = svarPaUtmaning(NYCKEL, url.searchParams.get('utmaning') || '');
      if (!svar) return json(res, 400, { error: tx('srv.fel.utmaning') });
      return json(res, 200, { svar });
    }

    if (vag.startsWith('/api/tillagg/')) {
      if (!await Tillagg.gilltig(maximus, dataDir, req.headers['x-maximus-tillagg']))
        return json(res, 403, { error: tx('srv.tillagg.inteIhopparat') });
      if (vag === '/api/tillagg/para') {
        await Tillagg.noteraParning(maximus, dataDir);
        return json(res, 200, { ok: true });
      }
      if (vag === '/api/tillagg/maskera') {
        let rå = '';
        for await (const bit of req) {
          rå += bit;
          if (rå.length > 2e6) return json(res, 413, { error: tx('srv.fel.forStorText') });
        }
        const text = String(JSON.parse(rå || '{}')?.text || '').slice(0, 60000);
        if (!text) return json(res, 422, { error: tx('srv.fel.ingenText') });
        const f = await forbered(text, { sorter: galler(installningar), tolka: true });
        return json(res, 200, { maskerad: f.maskerad,
          funna: (f.nya || []).map(n => n.platshallare).filter(Boolean) });
      }
      return json(res, 404, { error: tx('srv.fel.okandVag') });
    }

    if (await utokning?.fore?.(req, res, url, vag)) return;

    const mOr = /^\/moln\/openrouter\/([\w-]{20,64})$/.exec(vag);
    if (mOr && req.method === 'GET') {
      const p = molnInloggning;
      const sida = (rubrik, text) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(`<!doctype html><html lang="${Sprakstod.aktuellt()}"><meta charset="utf-8"><title>Maximus</title><body style="font:16px -apple-system,system-ui;max-width:32rem;margin:15vh auto;padding:0 1rem"><h1 style="font-size:1.4rem">${rubrik}</h1><p>${text}</p></body>`); };
      if (!p || p.tillstand !== mOr[1] || Date.now() > p.giltigTill) return sida(tx('srv.moln.inloggningenGickInte'), tx('srv.moln.lankenGallerInte'));
      molnInloggning = null;
      try {
        const nyckel = await Moln.bytKod(url.searchParams.get('code'), p.verifierare);
        await Moln.sparaNyckel('openrouter', nyckel);
        installningar = { ...installningar, moln: Moln.lageUr({ ...(installningar.moln?.leverantor === 'openrouter' ? installningar.moln : {}), leverantor: 'openrouter', maskering: p.maskering, pa: true }) };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        await aktiveraMoln();
        await liggare({ frontier: tx('srv.liggare.molnOpenrouter'), vag: 'moln', skickat: tx('srv.liggare.inloggningKodByttes'), mottaget: tx('srv.liggare.nyckelINyckelring'), anvandare: null, session: null, aktor: tx('srv.liggare.aktorMolnmodell') }).catch(() => {});
        sandAlla({ typ: 'moln', pa: molnPa(), namn: molnNamn() });
        execFileCb('/usr/bin/open', ['-b', 'ai.aurolabs.maximus'], () => {});
        return sida(tx('srv.moln.inloggad'), tx('srv.moln.inloggadText'));
      } catch (e) {
        sandAlla({ typ: 'moln', pa: molnPa(), namn: molnNamn(), fel: e.message });
        return sida(tx('srv.moln.inloggningenGickInte'), e.message.replace(/[<>&]/g, ''));
      }
    }

    const mMcp = /^\/mcp\/oauth$/.exec(vag);
    if (mMcp && req.method === 'GET') {
      const p = mcpInloggning;
      const sida = (rubrik, text) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(`<!doctype html><html lang="${Sprakstod.aktuellt()}"><meta charset="utf-8"><title>Maximus</title><body style="font:16px -apple-system,system-ui;max-width:32rem;margin:15vh auto;padding:0 1rem"><h1 style="font-size:1.4rem">${rubrik}</h1><p>${text}</p></body>`); };
      if (!p || p.tillstand !== url.searchParams.get('state') || Date.now() > p.giltigTill) return sida(tx('srv.mcp.oauth.gickInte'), tx('srv.moln.lankenGallerInte'));
      mcpInloggning = null;
      const kort = Mcp.kortet(p.kort);
      try {
        if (!kort) throw new Error(tx('srv.mcp.kortetBorta'));
        const t = await McpOauth.bytKod(p.vag, { klient: p.klient, tillbaka: p.tillbaka, kod: url.searchParams.get('code'), verifierare: p.verifierare });
        const s2 = await McpOauth.sparaToken(kort.kopplingsId, t);
        const oauthPost = { klient: p.klient, vag: p.vag, utgar: s2.utgar };
        const ny = await Mcp.granska(kort.url, { kalla: kort.kalla, session: kort.session, tur: kort.tur,
          register: kort.registernamn ? mcpForeslagna.get(kort.url) : null,
          auktorisering: Mcp.auktoriseringFor({ id: kort.kopplingsId, namn: kort.namn || kort.vard, oauth: oauthPost }) });
        Mcp.glomKort(ny.id);
        Object.assign(ny, { id: kort.id, oauthPost, kopplingsId: kort.kopplingsId },
          kort.plan ? { plan: kort.plan, installation: kort.installation, planJa: kort.planJa, bevaka: kort.bevaka, takt: kort.takt,
            fraga: kort.fraga, text: kort.text, traffar: kort.traffar, namn: kort.plan.namn, kalla: 'plan', utgivare: kort.utgivare } : {},
          kort.bevaka != null && !kort.plan ? { bevaka: kort.bevaka, fraga: kort.fraga } : {});
        Mcp.ersatt(ny);
        await liggare({ frontier: tx('srv.liggare.mcpInloggning', { vard: kort.inloggning?.vard || kort.vard }), vag: 'koppling',
          skickat: tx('srv.liggare.inloggningKodByttes'), mottaget: tx('srv.mcp.liggareToken'), tecken: 0, sekunder: 0,
          session: kort.session || null, anvandare: null, aktor: tx('srv.helig.duTitel') }).catch(() => {});
        await mcpGranskningsrad(ny, kort.session);
        if (ny.planJa) await slutforPlan(ny); else await speglaKort(ny);
        if (process.env.MAXIMUS_PROV !== '1') execFileCb('/usr/bin/open', ['-b', 'ai.aurolabs.maximus'], () => {});
        return sida(tx('srv.mcp.oauth.inloggad'), tx('srv.mcp.oauth.inloggadText'));
      } catch (e) {
        if (kort) { kort.fel = e.message; await speglaKort(kort).catch(() => {}); }
        return sida(tx('srv.mcp.oauth.gickInte'), e.message.replace(/[<>&]/g, ''));
      }
    }

    if (franAnnanPlats(req)) return json(res, 403, { error: tx('srv.fel.annanPlats') });
    if (!harNyckel(req, url, vag)) return utanNyckel(req, res, vag);

    if (!IDENTITET && !res.headersSent) {
      const min = /(?:^|;\s*)maximus=([^;]+)/.exec(req.headers.cookie || '')?.[1];
      if (min && sessionstoken.has(min)) res.setHeader('Set-Cookie', nyckelkaka(min));
    }

    const jag = vemAr(req);
    jagNu = jag;
    if (IDENTITET && utokning.grind?.(res, vag, jag)) return;

    if (req.method === 'GET') {
      const utanUpplasning = Boolean(statisk[vag])
        || vag === '/api/uppstart'
        || Boolean(utokning?.utanUpplasning?.(vag))
        || vag.startsWith('/api/handelser');
      if (maximus.skyddat && !maximus.upplast && !utanUpplasning)
        return json(res, 423, { error: tx('srv.fel.maximusLast') });

      if (statisk[vag]) {
        if (!IDENTITET && vag === '/' && nyckelLika(url.searchParams.get('n'), NYCKEL)) {
          res.writeHead(302, { Location: '/', 'Set-Cookie': nyckelkaka(nyToken()), 'Cache-Control': 'no-store' });
          return res.end();
        }
        res.writeHead(200, { 'Content-Type': statisk[vag].typ, 'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'" });
        return res.end(statisk[vag].kropp);
      }
      if (vag === '/favicon.ico') { res.writeHead(302, { Location: '/favicon.svg' }); return res.end(); }

      if (await utokning?.las?.(req, res, url, vag, jag)) return;

      if (vag === '/api/uppstart') return json(res, 200, {
        appPlats: appPlats(),
        behorighetKoll: Boolean(installningar.forsta?.klar) && installningar.behorighetVersion !== VERSION,
        namnmodellErbjud: await namnmodellErbjuds(),
        utokning: utokning?.yta || null,
        jag: jag ? { id: jag.id, namn: jag.namn, roll: jag.roll } : null,
        sprak: await Sprakstod.valt(installningar.sprak),
        grind: await grindSvarar(),
        behov: agentBehov(),
        moln: molnPa() ? { pa: true, namn: molnNamn() } : null,
        pausad: modellPausad,
        avstangd: modellAvstangd,
        maximus: { skyddat: maximus.skyddat, upplast: maximus.upplast, minns: await maximus.minnsINyckelring().catch(() => false) },
        locket: Locket.lage(await Locket.las(dataDir).catch(() => null)),
        personas: personalista(),
        val: Behandling.listor(),
        installningar: (maximus.skyddat && !maximus.upplast) ? { klar: installningar.klar } : utanHemligheter(installningar),
        villkor: await Villkor.las().then(v => ({ version: v.version, datum: v.datum,
          godkant: Villkor.godkant(installningar.villkor, v.version) })).catch(e => ({ fel: e.message })),
        modell: { namn: Modeller.modellAvFil(modellfil())?.namn || modellnamn(modellfil()), ...await vilkenModell(), finns: await modellFinns(),
          kontext: kontexten(), kontexter: KONTEXTER, kontextNu: await kontextTak().catch(() => null) },
        orat: await orat(),
        formaga: await formaga(),
        webb: await webbFinns(),
        ko: ko?.lage() || null,
        jag: jag ? { id: jag.id, namn: jag.namn, roll: jag.roll } : null,
        maskering: { sorter: MASKSORTER, paket: PAKET, valda: [...galler(installningar)], paketNu: paketFor(galler(installningar)) },
        namnmodell: await Namnmodell.namnmodellLage(),
        injektionsmodell: await Injektion.injektionsmodellLage(),
      });

      if (vag === '/api/funktioner') return json(res, 200, {
        funktioner: Funktioner.FUNKTIONER, tabell: Funktioner.tabell(),
      });

      if (vag === '/api/tillstand/prova') {
        const vad = url.searchParams.get('vad');
        if (vad === 'meddelanden' || vad === 'samtal') return json(res, 200, { ...(await Meddelanden.prova(vad)), installning: Meddelanden.FDA_URL });
        if (vad === 'paminnelser') return json(res, 200, { ...(await Paminnelser.prova()), installning: 'paminnelser' });
        if (vad === 'mapp') return json(res, 200, { forslag: Mappar.FORSLAG().map(([namn, sokvag]) => ({ namn, sokvag })) });
        return json(res, 404, { error: tx('srv.fel.okandKalla') });
      }

      if (vag === '/api/tillstand') return json(res, 200, {
        tillstand: Tillstand.lage(installningar.agent || {}),
        beslut: (installningar.tillstand || []).slice(-50),
      });

      if (vag === '/api/start') {
        const lage = await modellaget();
        const f = Start.forslag(lage.kapacitet);
        const finns = new Set(lage.modeller.filter(m => m.finns).map(m => m.id));
        const oron = await oronlage();
        return json(res, 200, {
          ...f,
          tanker: { ...f.tanker, finns: finns.has(f.tanker.id) },
          hor: { ...f.hor, finns: Boolean(oron.find(o => o.id === f.hor.id)?.finns) },
          alternativ: Start.alternativ(f.minneGB, finns),
          oron: oron.map(o => ({ id: o.id, namn: o.namn, hus: o.hus, byte: o.byte, storlek: o.storlek, om: o.om, finns: o.finns })),
          valt: installningar.modellval || null,
          egen: installningar.modellfil || null,
          hamtar: startHamtar,
        });
      }

      if (vag === '/api/villkor') {
        const v = await Villkor.lasPa(Sprakstod.aktuellt());
        return json(res, 200, { ...v, godkant: Villkor.godkant(installningar.villkor, v.version),
          sparat: installningar.villkor || null });
      }

      if (vag === '/api/webblasare') return json(res, 200, await webblage());

      if (vag === '/api/post/konton') {
        if (!Post.finns()) return json(res, 200, { finns: false, konton: [] });
        try { return json(res, 200, { finns: true, konton: (await Post.konton()).map(k => ({ ...k, forval: Konton.forvalEtikett(k) })) }); }
        catch (e) { return json(res, 200, { finns: true, konton: [], fel: e.message, tillstand: Boolean(e.tillstand) }); }
      }

      if (vag === '/api/kalender/kalendrar') {
        if (!Kalender.finns()) return json(res, 200, { finns: false, kalendrar: [] });
        try { return json(res, 200, { finns: true, kalendrar: (await Kalender.kalendrar()).map(k => ({ ...k, forval: Konton.forvalEtikett(k) })) }); }
        catch (e) { return json(res, 200, { finns: true, kalendrar: [], fel: e.message, tillstand: Boolean(e.tillstand) }); }
      }

      if (vag === '/api/kalender/handelser') {
        if (!Kalender.finns()) return json(res, 400, { error: tx('srv.fel.kalenderBaraMac') });
        const dagar = Math.max(1, Math.min(180, Number(url.searchParams.get('dagar')) || 7));
        const bakat = Math.max(0, Math.min(180, Number(url.searchParams.get('bakat')) || 0));
        const fran = new Date(); fran.setHours(0, 0, 0, 0); fran.setDate(fran.getDate() - bakat);
        const till = new Date(fran); till.setDate(till.getDate() + bakat + dagar - 1); till.setHours(23, 59, 59, 0);
        try {
          return json(res, 200, { handelser: await Kalender.handelser({ fran, till,
            kalender: url.searchParams.get('kalender') || null }) });
        } catch (e) {
          return json(res, 200, { handelser: [], fel: e.message, tillstand: Boolean(e.tillstand) });
        }
      }

      if (vag === '/api/post/brev') {
        if (!Post.finns()) return json(res, 400, { error: tx('srv.fel.mailBaraMac') });
        const konto = url.searchParams.get('konto') || '';
        if (!konto) return json(res, 422, { error: tx('srv.fel.valjKonto') });
        try {
          const brev = await Post.brev(konto, {
            lada: url.searchParams.get('lada') || 'INBOX',
            antal: Number(url.searchParams.get('antal')) || 40,
          });
          for (const b of brev) b.forslag = svarsforslag.find(f => f.konto === konto && f.brevId === b.id && f.status === 'forslag')?.id || null;
          return json(res, 200, { brev });
        } catch (e) { return json(res, 200, { brev: [], fel: e.message, tillstand: Boolean(e.tillstand) }); }
      }

      if (IDENTITET && vag.startsWith('/api/svar')) return json(res, 404, { error: tx('srv.fel.okandVag') });
      if (vag === '/api/svar') {
        return json(res, 200, { forslag: svarsforslag.filter(f => f.status === 'forslag'),
          lage: { forslag: Svar.forslagsLage(installningar), skicka: Svar.skickaLage(installningar) },
          vantar: svarsko.vantar().map(p => ({ id: p.id, forslag: p.forslag, brevId: p.brevId, kvarMs: Math.max(0, p.skickasMs - Date.now()) })) });
      }
      const mSvar = /^\/api\/svar\/([\w-]+)$/.exec(vag);
      if (mSvar && svarsforslag.some(f => f.id === mSvar[1])) return json(res, 200, { forslag: svarsforslag.find(f => f.id === mSvar[1]) });

      if (vag === '/api/svar/signatur') {
        const konto = url.searchParams.get('konto') || '';
        if (!konto || !Post.finns()) return json(res, 200, { signaturer: [], vald: null });
        return json(res, 200, await svarSignatur(konto));
      }

      if (vag === '/api/projekt') {
        const mina = [...sessioner.values()].filter(x => (x.agare || null) === (jag?.id || null));
        const har = new Set(mina.map(x => x.projekt).filter(Boolean));
        return json(res, 200, { projekt: projekt
          .filter(p => !IDENTITET || har.has(p.id) || p.agare === (jag?.id || null))
          .map(p => ({ ...p, antal: mina.filter(x => x.projekt === p.id).length })) });
      }

      if (vag === '/api/hem') {
        const a = agentInst();
        const nu = uppdrag.find(x => x.nyheter);
        return json(res, 200, {
          nyheter: { pa: Boolean(a.nyheter), amnen: Nyheter.amnenUr(Profil.las(installningar.profil) || {}),
            poster: nu ? Nyheter.urval(fynd, nu.id) : [], senast: nu?.senast || null, session: nu?.grund || null, uppdrag: nu?.id || null },
          drag: Nyheter.drag({ spar: agentspar, fynd, uppdrag }),
        });
      }
      const mNyhetsbild = /^\/api\/nyheter\/bild\/([\w-]+)$/.exec(vag);
      if (mNyhetsbild) {
        const f = fynd.find(x => x.id === mNyhetsbild[1] && uppdrag.find(u => u.id === x.uppdrag)?.nyheter);
        if (!f?.url) return json(res, 404, { error: tx('srv.fel.ingenBild') });
        const fil = join(dataDir, 'bilder', `${f.id}.json`);
        let data = null;
        try { data = JSON.parse(await maximus.lasFil(fil)).data; } catch {  }
        if (data === null || data === undefined) {
          const lig = p => liggare({ ...p, anvandare: null, session: null, aktor: tx('srv.helig.nyheterTitel') });
          try {
            let adress = f.bild;
            if (!adress) { const r = await hamtaRa(f.url, { liggare: lig }); adress = Nyheter.ogUr(r.text, r.url); }
            data = adress ? (await bildSomData(adress, { liggare: lig }).catch(() => null)) || '' : '';
          } catch { data = ''; }
          await mkdir(join(dataDir, 'bilder'), { recursive: true });
          await maximus.skrivFil(fil, JSON.stringify({ data, tid: new Date().toISOString() })).catch(() => {});
        }
        const m = /^data:(image\/(?:jpeg|png|webp|gif|avif));base64,(.+)$/.exec(data || '');
        if (!m) return json(res, 404, { error: tx('srv.fel.ingenBild') });
        res.writeHead(200, { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
        return res.end(Buffer.from(m[2], 'base64'));
      }
      if (vag === '/api/moln') {
        const har = {};
        for (const l of Object.keys(Moln.LEVERANTORER)) har[l] = Boolean(await Moln.lasNyckel(l));
        return json(res, 200, { lage: Moln.lageUr(installningar.moln), pa: molnPa(), namn: molnNamn(), harNyckel: har,
          maskeringar: Moln.MASKERINGAR,
          leverantorer: Object.fromEntries(Object.entries(Moln.LEVERANTORER).map(([k, v]) => [k, { namn: v.namn, land: v.land, om: v.om, modeller: v.modeller, loggaIn: Boolean(v.loggaIn), experimentell: Boolean(v.experimentell) }])) });
      }
      if (vag === '/api/moln/modeller') {
        const lev = url.searchParams.get('lev');
        if (!Moln.arLeverantor(lev)) return json(res, 404, { error: tx('srv.fel.okandLeverantor') });
        const L = Moln.LEVERANTORER[lev];
        if (!L.listaModeller) return json(res, 200, { modeller: L.modeller });
        if (!molnModellCache[lev] || Date.now() - molnModellCache[lev].nar > 36e5) {
          try {
            const r = await fetch(L.listaModeller, { signal: AbortSignal.timeout(10000) });
            const j = await r.json();
            molnModellCache[lev] = { nar: Date.now(), modeller: [...L.modeller, ...(j.data || []).map(m => String(m.id)).filter(id => /^[\w./:@-]+$/.test(id)).slice(0, 400)] };
            await liggare({ frontier: tx('srv.liggare.molnmodell', { namn: L.namn }), vag: 'moln', skickat: tx('srv.liggare.hamtadeModellista'), mottaget: tx('srv.liggare.nModeller', { n: molnModellCache[lev].modeller.length }), anvandare: null, session: null, aktor: tx('srv.liggare.aktorMolnmodell') }).catch(() => {});
          } catch { return json(res, 200, { modeller: L.modeller }); }
        }
        return json(res, 200, { modeller: molnModellCache[lev].modeller });
      }
      if (vag === '/api/mallar') return json(res, 200, { presentation: await kundmallInfo('presentation', jag?.id), dokument: await kundmallInfo('dokument', jag?.id) });
      if (vag === '/api/uppdrag') return json(res, 200, {
        uppdrag: uppdrag.map(u => ({ ...Uppdrag.sammandrag(u), korsNu: slarNu && (!slarBara || slarBara === u.id),
          grund: u.grund || null,
          instruktion: String(u.instruktion || '').slice(0, 400),
          antalFynd: fynd.filter(f => f.uppdrag === u.id).length,
          nya: fynd.filter(f => f.uppdrag === u.id && !f.sett).length })),
        behov: agentBehov(),
        osedda: uppdrag.filter(u => !u.sett).length,
      });

      if (vag === '/api/agent') return json(res, 200, {
        korLage: await Bakgrund.lage({ data: dataDir }), korDold: Boolean(installningar.agentDold),
        korFinns: Bakgrund.finns(),
        fynd: (url.searchParams.get('etikett') ? fynd.filter(f => f.sfar === Konton.etikettUr(url.searchParams.get('etikett'))) : fynd).slice(0, 200),
        osedda: fynd.filter(f => !f.sett).length,
        undanlagda: undanlagt.length,
        uppdrag: uppdrag.map(Uppdrag.sammandrag),
        notiser: agentnotiser(),
        vecka: await veckanNu().catch(() => []),
        lage: { slar: slarNu, vantar: korningar.size > 0, kallor: agentInst(), behov: agentBehov(), etiketter: Konton.etiketter(agentInst()) },
      });

      if (vag === '/api/agent/undanlagt') return json(res, 200, { undanlagt: undanlagt.slice(0, 300) });

      if (vag === '/api/kapacitet') return json(res, 200, await kapacitetsvar());

      if (vag === '/api/exempel') return json(res, 200, {
        ...Sprak.galler(installningar.exempel),
        egna: Boolean(installningar.exempel?.uppdrag?.length === 3),
      });

      if (vag === '/api/profil') return json(res, 200, {
        profil: installningar.profil || Profil.TOM,
        har: Profil.harNagot(installningar.profil),
      });

      if (vag === '/api/du/banken') {
        const { lage, rader } = await bankLage(jag);
        return json(res, 200, { uppgifter: rader, text: Banken.sammanfattning(rader, { vill: lage.profil.vill }), profil: lage.profil });
      }

      if (vag === '/api/kollega') {
        if (IDENTITET) return json(res, 404, { error: tx('srv.fel.okandVag') });
        const m = await kollegaMinne();
        const k = m.knack.oppen;
        return json(res, 200, { lage: Kollega.lage(installningar), forslag: m.forslag.filter(f => f.status === 'forslag').map(Kollega.visas),
          knack: k ? { id: k.id, fraga: k.fraga, halsning: Kollega.halsning(k) } : null });
      }

      if (vag === '/api/agent/fragor') return json(res, 200, { fragor: agentbegaran.filter(b => !b.svar) });

      if (vag === '/api/agent/spar') return json(res, 200, {
        spar: agentspar.slice(0, 40).map(({ avtryck, ...x }) => x),
      });

      if (vag === '/api/anteckningar/mappar') {
        if (!Anteckningar.finns()) return json(res, 200, { finns: false, mappar: [] });
        try { return json(res, 200, { finns: true, mappar: await Anteckningar.mappar() }); }
        catch (e) { return json(res, 200, { finns: true, mappar: [], fel: e.message, tillstand: Boolean(e.tillstand) }); }
      }

      const mUpp = /^\/api\/uppdrag\/([\w-]+)$/.exec(vag);
      if (mUpp) {
        const u = uppdrag.find(x => x.id === mUpp[1]);
        if (!u) return json(res, 404, { error: tx('srv.fel.uppdragFinnsInte') });
        return json(res, 200, { uppdrag: u });
      }

      if (vag === '/api/bevakning') return json(res, 200, {
        bevakningar: bevakningar.map(b => ({
          id: b.id, sort: b.sort, etikett: b.etikett, namn: b.namn || null, uri: b.uri, lagrum: b.lagrum,
          lagrumsnamn: b.lagrum ? Bevakning.lasbart(b.lagrum) : null,
          av: Boolean(b.av), fel: b.fel || null,
          senast: b.senast?.tid || null, hanvisningar: b.senast?.antal ?? null,
          rör: b.rör || [], traffar: b.traffar || [],
        })),
        frister: frister.map(f => ({ ...f, bradska: Frister.brådska(f.forfaller) })),
        morgonrad: morgonraden(),
        kollarNu,
      });

      if (vag === '/api/modell/syn') {
        const m = Modeller.modellAvFil(modellfil());
        return json(res, 200, {
          ser: await serBilder(),
          finns: Boolean(m?.mmproj),
          byte: m?.mmproj?.byte || null,
          modell: m?.namn || null,
        });
      }

      if (vag === '/api/vag') return json(res, 200, {
        vagar: Vag.VAGAR,
        vald: installningar.vag || 'direkt',
        adress: Vag.visaAdress({ vag: installningar.vag, adress: installningar.vagAdress }),
        harAdress: Boolean(installningar.vagAdress),
        torLever: await Vag.torLever(),
      });

      if (vag === '/api/kopplingar') return json(res, 200, {
        inbyggda: Plugins.INBYGGDA.map(k => ({ id: k.id, namn: k.namn, om: k.om, vard: k.vard, licens: k.licens,
          verktyg: k.verktyg.map(v => ({ name: v.name, description: v.description, argument: v.argument })) })),
        katalog: Plugins.MCP_KATALOG,
        igang: Plugins.lagen(),
        inteAn: Plugins.INTE_AN,
        valda: installningar.kopplingar || [],
        mcp: mcpPoster().map(p => ({ ...p, igang: Plugins.arIgang(p.id), rad: p.rad?.visas || null,
          oauth: p.oauth ? { inloggad: true, utgar: p.oauth.utgar || null } : null,
          verktyg: (p.verktyg || []).map(v => ({ namn: v.namn, om: v.om, sort: v.sort, forval: v.forval || v.sort, far: Boolean(v.far) })) })),
        register: McpRegister.registret(),
      });

      if (vag === '/api/regler')
        return json(res, 200, Regelpaket.lage(paket));

      if (vag === '/api/intyg')
        return json(res, 200, intyget
          ? { ...intyget, text: Attest.tillText(intyget, { organisation: installningar.namn || null }) }
          : { finns: false });

      if (vag === '/api/intyg.pdf') {
        if (!intyget) return json(res, 404, { error: tx('srv.intyg.ingetHamtat') });
        const text = Attest.tillText(intyget, { organisation: installningar.namn || null });
        const pdf = tillPdf(text, {
          rubrik: tx('srv.intyg.pdfRubrik'),
          fot: intyget.signatur ? tx('srv.intyg.motsignerat', { intygat: intyget.sammandrag?.intygat || '' }) : tx('srv.intyg.inteMotsignerat'),
        });
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="maximus-intyg-${intyget.sammandrag?.till || 'utan-datum'}.pdf"`,
          'Cache-Control': 'no-store',
        });
        return res.end(pdf);
      }

      if (vag === '/api/modeller') return json(res, 200, await modellaget());

      if (vag === '/api/handelser') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(': ansluten\n\n');
        oversikt.add(res);
        fonsterAnslot();
        const puls = setInterval(() => { try { res.write(': puls\n\n'); } catch {} }, 15000);
        req.on('close', () => { clearInterval(puls); oversikt.delete(res); });
        return;
      }

      if (vag === '/api/sessioner') return json(res, 200, [...sessioner.values()]
        .filter(s => egen(s, jag))
        .sort((a, b) => (b.andrad || '').localeCompare(a.andrad || ''))
        .map(s => ({ id: s.id, titel: s.las ? tx('srv.session.lastTitel') : s.titel, andrad: s.andrad,
          antal: s.turer.length, arkiverad: !!s.arkiverad, fast: !!s.fast, projekt: s.projekt || null,
          arkivSkal: s.arkiverad && s.arkiv?.av === 'agenten' ? s.arkiv.skal : null,
          helig: s.helig || null,
          avAgenten: !!s.avAgenten, agentsamtal: !!s.agentsamtal, a2a: !!s.a2a, uppdrag: s.uppdrag || null, arbete: arbeteI(s.id),
          etiketter: Array.isArray(s.etiketter) ? s.etiketter : [],
          las: s.las?.styrka || null, webb: s.webb || 'av', minne: s.minne || 'isolerat',
          stangd: stangd(s),
          ...valet(s) })));

      if (vag === '/api/felrapport') {
        return json(res, 200, {
          mottagare: rapportor.mottagare(),
          mejl: rapportor.mottagare() ? null : Hemvist.RAPPORTMEJL,
          tekniskt: await Felrapport.tekniskt({ version: VERSION }),
          funktioner: Felrapport.FUNKTIONER.map(id => ({ id, namn: tx(`srv.felrapport.funktion.${id}`) })),
          tak: Felrapport.TAK,
          rapporter: await rapportor.lage(jag?.id).catch(() => []),
        });
      }

      if (vag === '/api/liggare') {
        if (nekas(res, 'liggaren')) return;
        const rader = await Liggare.las(maximus, dataDir, { dagar: 30, oppnare: liggaroppnare });
        return json(res, 200, {
          rader: rader.slice(0, 200), antal: rader.length,
          luckor: rader.luckor?.length ? rader.luckor : undefined,
          format: Object.fromEntries(Object.entries(Liggare.FORMAT)
            .map(([id, f]) => [id, { namn: f.namn, om: f.om }])),
          gallring: installningar.gallring || 0,
          nasta: await Liggare.forhandsgranska(maximus, dataDir, { dagar: installningar.gallring || 0 }),
          kedja: await Liggarkedja.granska(maximus, dataDir,
            { gallrade: await Liggare.gallrade(maximus, dataDir) }).catch(() => null),
        });
      }

      const mExport = /^\/api\/liggare\/export\.(csv|json|txt)$/.exec(vag);
      if (mExport) {
        if (nekas(res, 'liggaren')) return;
        const f = Liggare.FORMAT[mExport[1]];
        const rader = await Liggare.las(maximus, dataDir, { oppnare: liggaroppnare });
        const namn = `maximus-liggare-${new Date().toISOString().slice(0, 10)}.${f.slut}`;
        res.writeHead(200, {
          'Content-Type': f.typ,
          'Content-Disposition': `attachment; filename="${namn}"`,
          'Cache-Control': 'no-store',
        });
        const kedja = await Liggarkedja.granska(maximus, dataDir,
          { gallrade: await Liggare.gallrade(maximus, dataDir) }).catch(() => null);
        return res.end(f.gor(rader, { organisation: utokning?.organisation ?? null, kedja }));
      }

      const mMapp = /^\/api\/sessioner\/([\w-]+)\/arendemapp$/.exec(vag);
      if (mMapp) {
        const s = minSession(mMapp[1], jag);
        if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
        if (stangd(s)) return json(res, 423, { error: tx('srv.fel.forsegladAngeKoden') });
        const rader = await Liggare.las(maximus, dataDir, { oppnare: liggaroppnare }).catch(() => []);
        const text = Arende.bygg(s, { liggare: rader, frister,
          organisation: installningar.organisation || null });
        const namn = Arende.filnamn(s);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${namn}"`,
        });
        return res.end(tillPdf(text, { rubrik: s.titel || tx('srv.arendemapp.rubrik'),
          fot: tx('srv.arendemapp.fot') }));
      }

      const mBild = /^\/api\/sessioner\/([\w-]+)\/fil\/([\w-]+)\/bild$/.exec(vag);
      if (mBild) {
        const s = minSession(mBild[1], jag);
        if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
        if (stangd(s)) return json(res, 423, { error: tx('srv.fel.forseglad') });
        const f = (s.filer || []).find(x => x.id === mBild[2]);
        if (!f?.bild) return json(res, 404, { error: tx('srv.fel.ingenBild') });
        const bin = Buffer.from(f.bild, 'base64');
        res.writeHead(200, { 'Content-Type': f.bildtyp || 'image/png',
          'Content-Length': bin.length, 'Cache-Control': 'private, max-age=3600' });
        return res.end(bin);
      }

      const mArtUt = /^\/api\/sessioner\/([\w-]+)\/artefakter\/([\w-]+)$/.exec(vag);
      if (mArtUt) {
        const s = minSession(mArtUt[1], jag);
        if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
        const post = (s.artefakter || []).find(a => a.id === mArtUt[2]);
        if (!post) return json(res, 404, { error: tx('srv.fel.filenFinnsInte') });
        try {
          const data = await Artefakt.las(maximus, sessionsKatalog(s.agare), s.id, post.id);
          res.writeHead(200, {
            'Content-Type': Artefakt.SORTER[post.sort]?.typ || 'application/octet-stream',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(post.namn)}`,
            'Content-Length': data.length,
            'Cache-Control': 'no-store',
          });
          return res.end(data);
        } catch (e) { return json(res, 500, { error: e.message }); }
      }

      const mFilUt = /^\/api\/sessioner\/([\w-]+)\/fil\/([\w-]+)\/export$/.exec(vag);
      if (mFilUt) {
        const s = minSession(mFilUt[1], jag);
        if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
        if (stangd(s)) return json(res, 423, { error: tx('srv.fel.forsegladAngeKoden') });
        const f = (s.filer || []).find(x => x.id === mFilUt[2]);
        if (!f) return json(res, 404, { error: tx('srv.fel.bilaganFinnsInte') });
        const vy = url.searchParams.get('vy') || 'maskerad';
        const text = vy === 'original' ? f.original : vy === 'anonym' ? f.anonym : f.maskerad;
        if (!text) return json(res, 404, { error: tx('srv.fel.vynFinnsInte') });
        const rent = f.namn.replace(/\.[^.]+$/, '').replace(/[^\p{L}\d_-]+/gu, '-').slice(0, 60);
        const sort = { maskerad: tx('srv.bilaga.vy.maskerad'), anonym: tx('srv.bilaga.vy.anonym'), original: tx('srv.bilaga.vy.original') }[vy] || vy;

        if (url.searchParams.get('format') === 'pdf') {
          const pdf = tillPdf(text, {
            rubrik: `${f.namn} · ${sort}`,
            fot: `MAXIMUS · ${new Date().toISOString().slice(0, 10)}`,
          });
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${rent}-${vy}.pdf"`,
            'Content-Length': pdf.length,
            'Cache-Control': 'no-store',
          });
          return res.end(pdf);
        }

        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${rent}-${vy}.txt"`,
          'Cache-Control': 'no-store',
        });
        return res.end(text);
      }

      const m = /^\/api\/sessioner\/([\w-]+)(\/handelser)?$/.exec(vag);
      if (m) {
        const s = minSession(m[1], jag);
        if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
        if (stangd(s)) return json(res, 423, { error: tx('srv.fel.forsegladAngeKoden') });
        if (m[2]) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
          res.write(`data: ${JSON.stringify({ typ: 'ogonblicksbild', session: utanBilder(s) })}\n\n`);
          if (!strommar.has(s.id)) strommar.set(s.id, new Set());
          strommar.get(s.id).add(res);
          const puls = setInterval(() => { try { res.write(': puls\n\n'); } catch {} }, 15000);
          req.on('close', () => { clearInterval(puls); strommar.get(s.id)?.delete(res); });
          return;
        }
        return json(res, 200, utanBilder(s));
      }
      return json(res, 404, { error: tx('srv.fel.finnsInte') });
    }

    if (req.method !== 'POST' || req.headers['x-maximus-local'] !== '1') return json(res, 403, { error: tx('srv.fel.ogiltigLokal') });

    if (vag === '/api/diktera') {
      const bin = await dikteraHjalpare();
      if (!bin) return json(res, 501, { error: tx('srv.diktera.kraverMac26') });
      if (dikteringar.size >= 2) for (const [id, d] of dikteringar) { d.doda(); dikteringar.delete(id); }
      const pr = installningar.profil || {};
      const ord = Diktera.ordUr({
        namn: [...projekt.map(x => x.namn), ...uppdrag.map(u => u.titel), ...(agentInst().mappar || []).map(m => m.namn || m.sokvag.split('/').pop())],
        fritt: [pr.vem, pr.arbetar, pr.vill, installningar.namn,
          ...[...sessioner.values()].filter(x => egen(x, jag)).slice(-40).map(x => x.titel),
          ...fynd.slice(-60).map(f => f.titel)],
      });
      const d = Diktera.nyDiktering({ bin, argv: [String(installningar.diktersprak || lokalNu()), JSON.stringify(ord)] });
      await d.vantaRedo(d.tillstand.laddar ? 120000 : 30000);
      if (d.tillstand.fel || !d.tillstand.redo) { d.doda(); return json(res, 503, { error: d.tillstand.fel || tx('srv.diktera.startadeInte') }); }
      const id = randomUUID();
      dikteringar.set(id, d);
      return json(res, 200, { id });
    }
    const mDikt = /^\/api\/diktera\/([\w-]+)\/(ljud|slut|avbryt)$/.exec(vag);
    if (mDikt) {
      const d = dikteringar.get(mDikt[1]);
      if (!d) return json(res, 404, { error: tx('srv.diktera.slut') });
      if (mDikt[2] === 'ljud') {
        const bitar = []; let n = 0;
        for await (const bit of req) { n += bit.length; if (n > 2e6) return json(res, 413, { error: tx('srv.diktera.forStorLjudbit') }); bitar.push(bit); }
        d.ljud(Buffer.concat(bitar));
        const k = Diktera.kommando(d.text());
        return json(res, 200, { text: d.text(), gor: k.gor, utan: k.text, fel: d.tillstand.fel });
      }
      dikteringar.delete(mDikt[1]);
      if (mDikt[2] === 'avbryt') { d.doda(); return json(res, 200, { avbruten: true }); }
      const text = await d.avsluta();
      const k = Diktera.kommando(text);
      return json(res, 200, { text, gor: k.gor, utan: k.text });
    }

    const mMall = /^\/api\/mallar\/(presentation|dokument)$/.exec(vag);
    if (mMall && req.method === 'POST') {
      const sort = mMall[1];
      const namn = decodeURIComponent(req.headers['x-maximus-namn'] || 'mall');
      if (!Mallar.tillaten(sort, namn)) return json(res, 422, { error: tx('srv.mall.felFiltyp', { sort: Mallar.SORTER[sort].namn, filer: ellerLista(Mallar.SORTER[sort].filer) }) });
      const bitar = []; let n = 0;
      for await (const bit of req) { n += bit.length; if (n > 50e6) return json(res, 413, { error: tx('srv.mall.forStor') }); bitar.push(bit); }
      const buf = Buffer.concat(bitar);
      let las;
      try { las = await Mallar.lasMall(sort, buf); } catch (e) { return json(res, 422, { error: e.message }); }
      await mkdir(join(dataDir, 'mallar'), { recursive: true });
      const tid = new Date().toISOString();
      await maximus.skrivFil(mallfil(sort, jag?.id), JSON.stringify({ namn: namn.slice(0, 120), tid, data: buf.toString('base64') }));
      return json(res, 200, { sort, namn, tid, typsnitt: las.typsnitt, farger: las.farger });
    }

    if (vag === '/api/du/las' || vag === '/api/du/safari') {
      let du;
      try {
        if (vag === '/api/du/safari') {
          const s = await lasSafari();
          if (s.text.length < 300) return json(res, 422, { error: tx('srv.du.safariIngenText', { sida: s.titel || s.url }) });
          du = { kalla: 'safari', url: s.url, text: s.text.slice(0, 20000) };
        } else {
          const namn = decodeURIComponent(req.headers['x-maximus-namn'] || 'fil');
          const bitar = []; let n = 0;
          for await (const bit of req) { n += bit.length; if (n > 200e6) return json(res, 413, { error: tx('srv.fel.filStorre200') }); bitar.push(bit); }
          const data = Buffer.concat(bitar);
          du = /\.zip$/i.test(namn) ? await Du.lasExport(data) : { kalla: 'cv', namn, text: (await lasDokument(namn, data)).text.slice(0, 30000) };
        }
      } catch (e) { return json(res, 422, { error: e.message }); }
      await maximus.skrivFil(join(dataDir, 'du.json'), JSON.stringify({ ...Du.sammandrag(du), text: du.text ? String(du.text).slice(0, 30000) : undefined }));
      const forslag = await duForslag(du);
      return json(res, 200, { kalla: du.kalla, forslag, antal: Du.sammandrag(du).antal, profil: du.profil || null, ...(forslag ? {} : { error: tx('srv.du.ingetForslag') }) });
    }

    const mMote = /^\/api\/sessioner\/([\w-]+)\/(mote)(?:\/([\w-]+)\/klar)?$/.exec(vag);
    if (mMote) {
      const sess = minSession(mMote[1], jag);
      if (!sess) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      if (stangd(sess)) return json(res, 423, { error: tx('srv.fel.forsegladAngeKoden') });
      if (mMote[3]) {
        await (moteKo.get(mMote[3]) || Promise.resolve());
        moteKo.delete(mMote[3]);
        const m = (sess.moten || []).find(x => x.id === mMote[3]);
        if (!m) return json(res, 404, { error: tx('srv.mote.finnsInte') });
        m.klart = new Date().toISOString();
        await spara(sess);
        return json(res, 200, { namn: Mote.namn(m.borjade, Number(req.headers['x-maximus-langd']) || 0), text: Mote.avskrift(m.delar), delar: m.delar.length });
      }
      const moteId = String(req.headers['x-maximus-mote'] || '').replace(/[^\w-]/g, '').slice(0, 64);
      const nr = Math.max(0, Math.floor(Number(req.headers['x-maximus-nr']) || 0));
      const fran = Math.max(0, Number(req.headers['x-maximus-fran']) || 0);
      const slut = /^\.(m4a|webm|ogg|wav|mp3)$/.test(String(req.headers['x-maximus-slut'])) ? req.headers['x-maximus-slut'] : '.m4a';
      if (!moteId) return json(res, 422, { error: tx('srv.mote.saknarId') });
      const bitar = []; let n = 0;
      for await (const bit of req) { n += bit.length; if (n > 100e6) return json(res, 413, { error: tx('srv.mote.delForStor') }); bitar.push(bit); }
      const data = Buffer.concat(bitar);
      let m = (sess.moten ||= []).find(x => x.id === moteId);
      if (!m) { m = { id: moteId, borjade: new Date(Date.now() - fran * 1000).toISOString(), delar: [] }; sess.moten.push(m); }
      const jobb = (moteKo.get(moteId) || Promise.resolve()).then(async () => {
        sand(sess.id, { typ: 'mote', mote: moteId, nr, fas: 'skriver ut' });
        const d = await transkribera(`del-${nr}${slut}`, data).catch(e => ({ text: '', fel: e.message }));
        const del = { nr, fran, text: d.text || '', ...(d.fel && !/Inget tal|No speech/.test(d.fel) ? { fel: d.fel } : {}) };
        m.delar = [...m.delar.filter(x => x.nr !== nr), del];
        await spara(sess);
        sand(sess.id, { typ: 'mote', mote: moteId, nr, fas: 'klar', avskrift: Mote.avskrift(m.delar), fel: del.fel || null });
        return del;
      });
      moteKo.set(moteId, jobb.catch(() => {}));
      return json(res, 202, { mote: moteId, nr });
    }

    const mFil = /^\/api\/sessioner\/([\w-]+)\/fil$/.exec(vag);
    if (mFil) {
      const sess = minSession(mFil[1], jag);
      if (!sess) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      const namn = decodeURIComponent(req.headers['x-maximus-namn'] || 'fil');
      const bitar = [];
      let storlek = 0;
      for await (const bit of req) {
        storlek += bit.length;
        if (storlek > 500e6) return json(res, 413, { error: tx('srv.fel.filStorre500') });
        bitar.push(bit);
      }
      const data = Buffer.concat(bitar);
      const arLjud = LJUD.includes(namn.slice(namn.lastIndexOf('.')).toLowerCase());
      try {
        satFilarbete(sess, arLjud ? tx('srv.sidopanel.lyssnar') : tx('srv.sidopanel.laser'));
        if (arLjud) sand(sess.id, { typ: 'fil-steg', namn, fas: 'lyssnar' });
        let sedan = 0;
        const d = arLjud
          ? await transkribera(namn, data, {
            pa: (rad, n) => {
              if (n - sedan < 4 && n > 1) return;
              sedan = n;
              sand(sess.id, { typ: 'fil-text', namn, rad, rader: n });
            },
          })
          : await lasDokument(namn, data);

        if (arLjud && d.text) {
          sand(sess.id, { typ: 'fil-steg', namn, fas: tx('srv.fil.skriverMeningar') });
          satFilarbete(sess, tx('srv.fil.skriverMeningar'));
          try {
            const r = await lasbar(d.text, {
              svara: (p, o) => svaraLokalt(p, { ...o, plats: 'efterat', tak: 3000 }),
              pa: (text, klara, av, gjorda) =>
                sand(sess.id, { typ: 'fil-meningar', namn, text, klara, av, gjorda }),
              strom: (() => {
                let sist = 0;
                return (utkast, tider, gjorda) => {
                  const nu = Date.now();
                  if (nu - sist < 250) return;
                  sist = nu;
                  sand(sess.id, { typ: 'fil-utkast', namn, utkast, tider, gjorda });
                };
              })(),
            });
            d.text = r.text;
            d.tecken = r.text.length;
            d.om = tx('srv.fil.stycken', { n: r.stycken, utan: r.formaterade ? '' : tx('srv.fil.reglerna') });
          } catch {
          }
        }

        const utanMask = behandlingNu(sess) === 'original';
        const f = utanMask
          ? { maskerad: d.text, karta: sess.karta || [], raknare: sess.raknare || {}, nya: [], rojning: null }
          : await forbered(d.text, { karta: sess.karta || [], raknare: sess.raknare || {},
              sorter: galler(installningar), modelltak: 20000 });
        if (utanMask) Namnmodell.iBakgrunden(d.text);
        sess.karta = f.karta;
        sess.raknare = f.raknare;
        const arBild = String(d.sort).startsWith('bild');
        const fil = { id: randomUUID(), namn: d.namn, sort: d.sort, tecken: d.tecken,
          tid: new Date().toISOString(), original: d.text, maskerad: f.maskerad, dolda: f.nya.length,
          omaskerad: utanMask || undefined,
          ...(arBild && data.length <= 12e6
            ? { bild: data.toString('base64'), bildtyp: typAv(namn) }
            : {}) };
        (sess.filer ||= []).push(fil);
        await spara(sess);
        const { original, bild, ...utan } = fil;
        return json(res, 201, { ...utan, harBild: Boolean(bild) });
      } catch (e) {
        return json(res, 422, { error: e.message });
      } finally { satFilarbete(sess, null); }
    }

    let rå = ''; for await (const bit of req) { rå += bit; if (rå.length > 20e6) return json(res, 413, { error: tx('srv.fel.forStorBegaran') }); }
    const kropp = JSON.parse(rå || '{}');

    if (vag === '/api/grund') {
      const sort = String(kropp.sort || '');
      const hitta = n => [...sessioner.values()].find(x => x.helig?.sort === n && egen(x, jag));
      const skapa = (n, titel) => {
        const tid = new Date().toISOString();
        const s = { id: randomUUID(), titel, dopt: true, skapad: tid, andrad: tid, agare: jag?.id || null, turer: [], karta: [], raknare: {},
          behandling: Behandling.stall(installningar.behandling), persona: installningar.persona || PERSONA_FORVAL, webb: 'av', minne: 'isolerat',
          helig: { sort: n } };
        sessioner.set(s.id, s);
        return s;
      };
      const rad = (s, sager) => { const grundTur = { id: randomUUID(), tid: new Date().toISOString(), fraga: '', av: 'maximus', status: 'klar', svar: '', kvitto: [], kallor: [], sager };
        s.turer.push(grundTur); s.andrad = grundTur.tid; return grundTur; };
      if (sort === 'du') {
        const s = hitta('du') || skapa('du', tx('srv.helig.duTitel'));
        let du = null; try { du = JSON.parse(await maximus.lasFil(join(dataDir, 'du.json'))); } catch {  }
        const finns = s.turer.findLast?.(t => t.du) || [...s.turer].reverse().find(t => t.du);
        const tur = finns || rad(s, '');
        tur.du = true; tur.sager = Grunden.duRad(Profil.las(installningar.profil), du); tur.tid = new Date().toISOString();
        const a = agentInst();
        if (a.lopande && a.epost?.konto && !uppdrag.some(x => x.grund === s.id)) {
          const u = Uppdrag.nyttUppdrag({ titel: tx('srv.grund.linkedinTillDigTitel'), aterkommande: true, takt: 60, kallor: [{ typ: 'epost' }],
            instruktion: tx('srv.grund.linkedinTillDigInstr') });
          u.filter = Schema.filterUr('från @linkedin.com och @e.linkedin.com'); u.grund = s.id; u.session = s.id;
          uppdrag.push(u); await sparaUppdrag();
          tur.sager += tx('srv.grund.lopande');
        }
        if (await sakerstallFlode(s)) tur.sager += tx('srv.grund.flodet');
        await spara(s);
        sand(s.id, { typ: 'agenttur', session: s.id, tur });
        sandAlla({ typ: 'lista' });
        return json(res, 200, { session: s.id });
      }
      const app = Grunden.APPAR[sort];
      if (!app) return json(res, 422, { error: tx('srv.grund.okandDel') });
      const a = agentInst();
      const pa = { epost: a.epost?.konto, kalender: a.kalender, paminnelser: a.paminnelser, anteckningar: a.anteckningar?.mapp, meddelanden: a.meddelanden }[sort];
      if (!pa) return json(res, 409, { error: tx('srv.grund.intePaslagen', { app: app.namn }) });
      if (!agentBehov().klar) return behovSvar(res);
      const s = hitta(sort) || skapa(sort, app.namn);
      await spara(s);
      sandAlla({ typ: 'lista' });
      json(res, 202, { session: s.id });
      (async () => {
        try {
          const r = await agentSlinga({ uppgift: Grunden.skanningsUppgift({ app: sort, profil: Profil.somText(installningar.profil) }), session: s.id, steg: 4, obevakad: true, betrodd: { uppgift: true } });
          const sk = Grunden.lasSkanning(r.svar, sort);
          let u = uppdrag.find(x => x.grund === s.id);
          if (!u) {
            u = Uppdrag.nyttUppdrag({ titel: app.namn, instruktion: tx('srv.grund.uppdragInstr', { hur: app.hur, lyft: sk.lyft ? `: ${sk.lyft}` : '' }),
              kallor: [{ typ: sort }], aterkommande: true, takt: sk.takt });
            u.grund = s.id; u.session = s.id;
            uppdrag.push(u);
          } else Object.assign(u, { takt: sk.takt });
          await sparaUppdrag();
          const tur = rad(s, Grunden.skanningsRad(sort, sk));
          tur.uppdrag = u.id;
          await spara(s);
          sand(s.id, { typ: 'agenttur', session: s.id, tur });
          sandAlla({ typ: 'lista' });
        } catch (e) {
          const tur = rad(s, tx('srv.grund.kundeInteSkanna', { hur: app.hur, fel: e.message }));
          await spara(s).catch(() => {});
          sand(s.id, { typ: 'agenttur', session: s.id, tur });
        }
      })();
      return;
    }

    if (vag === '/api/du/text') {
      let du;
      try { du = Du.egenText(kropp.text); } catch (e) { return json(res, 422, { error: e.message }); }
      installningar = { ...installningar, profil: Banken.markera(installningar.profil, Profil.las({ ...(installningar.profil || {}), egen: du.text })) };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      if (kropp.analysera === false || !(await grindSvarar())) return json(res, 200, { kalla: 'text', sparad: true, forslag: null, senare: true });
      const forslag = await duForslag(du);
      return json(res, 200, { kalla: 'text', sparad: true, forslag, ...(forslag ? {} : { error: tx('srv.du.ingetForslag') }) });
    }

    if (vag === '/api/du/banken/sammanfatta') {
      const { rader } = await bankLage(jag);
      if (!rader.some(r => r.andras) || !(await grindSvarar())) return json(res, 200, { text: null });
      const r = await svaraLokalt(Banken.sammanfattaPrompt(rader), { plats: 'efterat', tak: 300, timeout: 90000, baraLokalt: true }).catch(() => '');
      return json(res, 200, { text: String(r || '').trim().slice(0, 800) || null });
    }

    if (vag === '/api/du/banken/tolka') {
      const text = String(kropp.text || '').trim().slice(0, 1500);
      if (!text) return json(res, 422, { error: tx('srv.banken.tomText') });
      return json(res, 200, await bankTolka(jag, text));
    }

    if (vag === '/api/du/banken/godkann') {
      const id = String(kropp.id || '');
      const f = bankForslag.get(id);
      bankForslag.delete(id);
      if (!f || f.agare !== (jag?.id || null) || Date.now() - f.tid > BANK_FORSLAG_MS) return json(res, 410, { error: tx('srv.banken.forslagetBorta') });
      if (kropp.ja !== true) return json(res, 200, { avbrutet: true });
      const { lage } = await bankLage(jag);
      if (Banken.fingeravtryck(lage) !== f.avtryck) return json(res, 409, { error: tx('srv.banken.andratsSedan') });
      const r = Banken.tillamp(lage, f.ops, { uppdrag });
      if (visatAvtryck([r.andringar, (await glomAgentLager(f.ops)).antal]) !== f.visat) return json(res, 409, { error: tx('srv.banken.andratsSedan') });
      installningar = { ...installningar, profil: Profil.las(r.lage.profil), exempel: r.lage.exempel };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      if (lage.du && r.lage.du) await maximus.skrivFil(join(dataDir, 'du.json'), JSON.stringify(r.lage.du));
      const { antal: lager } = await glomAgentLager(f.ops, { spara: true });
      await liggare({ frontier: tx('srv.liggare.banken'), vag: 'lokal', skickat: Banken.liggarrad(r.andringar, lager), mottaget: tx('srv.liggare.gjort'),
        tecken: 0, sekunder: 0, anvandare: jag?.id || null, session: null, aktor: tx('srv.helig.duTitel') }).catch(() => {});
      await skrivOmDuRad(lage.profil, lage.du).catch(() => {});
      const { lage: nu, rader } = await bankLage(jag);
      return json(res, 200, { andringar: r.andringar.length + Object.values(lager).reduce((a, b) => a + b, 0), profil: nu.profil, uppgifter: rader, text: Banken.sammanfattning(rader, { vill: nu.profil.vill }) });
    }

    if (IDENTITET && vag.startsWith('/api/kollega/')) return json(res, 404, { error: tx('srv.fel.okandVag') });
    if (vag === '/api/kollega/foresla') return json(res, 200, await kollegaForeslar({ tvinga: true }));

    if (vag === '/api/kollega/svar') {
      const m = await kollegaMinne();
      const f = m.forslag.find(x => x.id === String(kropp.id || ''));
      if (!f) return json(res, 404, { error: tx('srv.kollega.finnsInte') });
      if (f.status !== 'forslag') return json(res, 409, { error: tx('srv.kollega.redanBesvarat') });
      if (kropp.svar === 'avboj') {
        const ny = Kollega.avboj(m, f, String(kropp.skal || ''));
        await skrivKollega(ny);
        const g = ny.forslag.find(x => x.id === f.id);
        await speglaKollega(g);
        return json(res, 200, { forslag: Kollega.visas(g) });
      }
      if (kropp.svar !== 'ta') return json(res, 422, { error: tx('srv.kollega.taEllerAvboj') });
      let r;
      try { r = await taKollegaForslag(f, { text: typeof kropp.text === 'string' ? kropp.text : null, start: kropp.start || null, slut: kropp.slut || null }); }
      catch (e) { return json(res, 200, { error: e.message }); }
      const ny = Kollega.tag(await kollegaMinne(), f);
      await skrivKollega(ny);
      const g = ny.forslag.find(x => x.id === f.id);
      await speglaKollega(g);
      return json(res, 200, { forslag: Kollega.visas(g), ...r });
    }

    if (vag === '/api/kollega/narvaro') {
      narvaro = { vila: kropp.vila !== false, nar: Date.now() };
      return json(res, 200, { ok: true });
    }

    if (vag === '/api/kollega/knack') {
      const id = String(kropp.id || ''), svar = String(kropp.svar || '');
      const nu = PROV_KOLLEGA && kropp.nu ? new Date(kropp.nu) : new Date();
      let m = await kollegaMinne();
      if (svar === 'stang') {
        installningar = { ...installningar, kollega: { ...Kollega.lage(installningar), knack: false } };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        m = Kollega.knackSvar(m, id, 'klar');
      } else if (svar === 'visad') m = Kollega.knackVisad(m, id, { nu });
      else if (['inte_nu', 'aldrig', 'klar'].includes(svar)) m = Kollega.knackSvar(m, id, svar, { nu });
      else return json(res, 422, { error: tx('srv.kollega.knackSvar') });
      await skrivKollega(m);
      return json(res, 200, { lage: Kollega.lage(installningar) });
    }

    if (vag === '/api/kollega/knack/svar') {
      const m = await kollegaMinne();
      const k = m.knack.oppen;
      if (!k || k.id !== String(kropp.id || '')) return json(res, 410, { error: tx('srv.kollega.knackBorta') });
      const text = String(kropp.text || '').trim().slice(0, 1500);
      if (!text) return json(res, 422, { error: tx('srv.banken.tomText') });
      const r = await bankTolka(jag, text, { fraga: k.fraga });
      const efter = Kollega.knackSvar(await kollegaMinne(), k.id, 'besvarad');
      const nasta = (k.fragade || []).length < Kollega.FRAGOR_PER_KNACK
        ? Kollega.nyKnack(Kollega.knackAmnen({ profil: installningar.profil, du: await lasDu(), fynd: kollegaFynd(), minne: efter }), { fragade: k.fragade || [] }) : null;
      efter.knack.oppen = nasta ? { ...nasta, id: k.id, visad: k.visad || new Date().toISOString() } : null;
      await skrivKollega(efter);
      return json(res, 200, { ...r, ...(r.forslag || r.error ? {} : { svar: tx('srv.kollega.knackNoterat') }), foljd: nasta ? nasta.fraga : null });
    }

    if (vag === '/api/kollega/prov') {
      if (!PROV_KOLLEGA) return json(res, 404, { error: tx('srv.fel.okandVag') });
      if ('fynd' in kropp) kollegaProv.fynd = Array.isArray(kropp.fynd) ? kropp.fynd : null;
      if ('moten' in kropp) kollegaProv.moten = Array.isArray(kropp.moten) ? kropp.moten : null;
      if ('vilaSek' in kropp) kollegaProv.vilaSek = kropp.vilaSek == null ? null : Number(kropp.vilaSek);
      if ('agent' in kropp) kollegaProv.agent = kropp.agent ? { ...AGENT_AV, ...agentUr(kropp.agent) } : null;
      const nu = kropp.nu ? new Date(kropp.nu) : new Date();
      if (kropp.knacka) return json(res, 200, await knacka({ nu }));
      if (kropp.foresla) return json(res, 200, await kollegaForeslar({ nu, tvinga: true }));
      return json(res, 200, { ok: true });
    }

    if (vag === '/api/du/lank') {
      const url = String(kropp.url || '').trim();
      if (!/^https?:\/\//i.test(url)) return json(res, 422, { error: tx('srv.du.inteAdress') });
      let du;
      try {
        if (/linkedin\.com\//i.test(url)) {
          await new Promise(klar => execFileCb('/usr/bin/open', ['-a', 'Safari', url], () => klar()));
          await new Promise(r => setTimeout(r, 6000));
          const s = await lasSafari();
          du = { kalla: 'lank', url, text: s.text.slice(0, 20000) };
        } else {
          const s = await hamtaSida(url, { tecken: 20000, dolt: true, liggare: p => liggare({ ...p, anvandare: jag?.id || null, session: null, aktor: tx('srv.helig.duTitel') }) });
          du = { kalla: 'lank', url, text: s.text };
        }
      } catch (e) { return json(res, 422, { error: e.message }); }
      await maximus.skrivFil(join(dataDir, 'du.json'), JSON.stringify({ ...Du.sammandrag(du), url, text: du.text }));
      const forslag = await duForslag(du);
      return json(res, 200, { kalla: 'lank', forslag, antal: {}, ...(forslag ? {} : { error: tx('srv.du.ingetForslag') }) });
    }

    const mDjup = /^\/api\/sessioner\/([\w-]+)\/(djupdykning)$/.exec(vag);
    if (mDjup) {
      const sess = minSession(mDjup[1], jag);
      if (!sess) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      if (stangd(sess)) return json(res, 423, { error: tx('srv.fel.forsegladAngeKoden') });
      if (djupjobb.has(sess.id)) return json(res, 409, { error: tx('srv.djup.pagar') });
      const mandat = String(kropp.mandat || sess.djup?.mandat || '').trim().slice(0, 6000);
      if (!mandat) return json(res, 422, { error: tx('srv.djup.vadSka') });
      const sakertFil = (sess.filer || []).find(f => /safe.?to.?say|s[äa]kert.?att.?s[äa]ga/i.test(f.namn));
      const sakert = String(kropp.sakert || sakertFil?.original || sess.djup?.sakert || '').slice(0, 8000);
      if (!kropp.fortsatt || !sess.djup) sess.djup = { id: randomUUID(), mandat, sakert, fas: 'kallor', akter: [], borjade: new Date().toISOString() };
      else { delete sess.djup.fel; }
      await spara(sess);
      djupjobb.add(sess.id);
      json(res, 202, { id: sess.djup.id });
      (async () => {
        const d = sess.djup;
        const steg = (fas, mer = {}) => { d.fas = fas; sand(sess.id, { typ: 'djup', fas, namn: Djupdykning.FASNAMN[fas], ...mer }); };
        const lig = p => liggare({ ...p, anvandare: null, session: sess.id, aktor: tx('srv.liggare.aktorDjupdykningen') });
        const underlag = () => [tx('srv.djup.mandatEtikett', { mandat: d.mandat }), ...(sess.filer || []).filter(f => f !== sakertFil).slice(0, 3)
          .map(f => `[${f.namn}]\n${String(f.original || f.maskerad || '').slice(0, 2500)}`)].join('\n\n');
        try {
          if (!d.sidtext) {
            steg('kallor');
            const adresser = [...Djupdykning.adresserUr(d.mandat), ...(Array.isArray(kropp.adresser) ? kropp.adresser : [])].slice(0, 6);
            const sidor = [];
            for (const u of adresser) {
              const s = await hamtaSida(u, { tecken: 40000, liggare: lig, dolt: true }).catch(e => ({ url: u, fel: e.message }));
              if (s.text) sidor.push(`[${s.titel || u}] ${u}\n${s.text}`);
            }
            d.adresser = adresser;
            d.sidtext = sidor.join('\n\n').slice(0, 40000);
            await spara(sess);
          }
          await modellForAgenten();
          if (!d.personer) {
            steg('personer');
            const delar = d.sidtext ? d.sidtext.match(/[\s\S]{1,13000}/g).slice(0, 3) : [];
            const alla = [];
            let amne = '';
            for (const del of delar) {
              const r = Djupdykning.lasPersoner(await svaraLokalt(Djupdykning.personerPrompt(del), { plats: 'efterat', tak: 2500, timeout: 240000 }).catch(() => ''));
              amne ||= r.amne;
              for (const p of Djupdykning.iTexten(r.personer, d.sidtext)) if (!alla.some(x => x.namn.toLowerCase() === p.namn.toLowerCase())) alla.push(p);
            }
            d.amne = amne || d.mandat.split('\n')[0].slice(0, 120);
            const tak = Math.min(30, Number(kropp.tak) || 12);
            d.hittade = alla.length;
            d.personer = alla.length > tak
              ? Djupdykning.lasGallring(await svaraLokalt(Djupdykning.gallraPrompt({ mandat: d.mandat, personer: alla, tak }), { plats: 'efterat', tak: 800, timeout: 240000 }).catch(() => ''), alla, tak)
              : alla;
            await spara(sess);
          }
          if (!d.personer.length) {
            delete d.personer; delete d.sidtext;
            throw new Error(d.adresser?.length ? tx('srv.djup.ingaPersoner') : tx('srv.djup.geAdress'));
          }
          const publika = d.personer.map(p => p.namn);
          if (!d.laget) {
            steg('laget');
            const r = await agentSlinga({ uppgift: Djupdykning.lagetUppgift(d), sammanhang: underlag(), session: sess.id, publika, steg: 5, betrodd: { uppgift: true } });
            d.kallor = Leverans.kallorUr(r.steg);
            d.lagetRa = String(r.svar || '').slice(0, 6000);
            d.laget = Djupdykning.verifieraFakta(Djupdykning.lasFakta(r.svar, d.kallor), d.kallor);
            await spara(sess);
          }
          for (const [nr, p] of d.personer.entries()) {
            if (d.akter.some(a => a.namn === p.namn)) continue;
            steg('akter', { nr, av: d.personer.length, person: p.namn });
            const r = await agentSlinga({ uppgift: Djupdykning.aktUppgift({ person: p, mandat: d.mandat, amne: d.amne }), sammanhang: '', session: sess.id, publika: [p.namn], steg: 4, betrodd: { uppgift: true } })
              .catch(e => ({ svar: '', steg: [], fel: e.message }));
            d.akter.push({ ...Djupdykning.lasAkt(r.svar, p), kallor: Leverans.kallorUr(r.steg), ra: String(r.svar || '').slice(0, 6000) });
            d.kallor = [...(d.kallor || []), ...Leverans.kallorUr(r.steg)];
            await spara(sess);
          }
          steg('urval');
          d.akter = d.akter.map(a => (a.ra ? { ...Djupdykning.verifiera(Djupdykning.lasAkt(a.ra, a), a.kallor), kallor: a.kallor, ra: a.ra } : a));
          if (d.lagetRa) d.laget = Djupdykning.verifieraFakta(Djupdykning.lasFakta(d.lagetRa, d.kallor), d.kallor);
          const akter = d.akter.filter(a => !a.tom);
          d.urval = Djupdykning.lasUrval(await svaraLokalt(Djupdykning.urvalPrompt({ mandat: d.mandat, akter }), { plats: 'efterat', tak: 2000, timeout: 240000 }).catch(() => ''), akter);
          steg('brief');
          d.avsnitt = {};
          for (const [id, vad] of Djupdykning.AVSNITT) {
            d.avsnitt[id] = String(await svaraLokalt(Djupdykning.avsnittPrompt({ vad, mandat: d.mandat, amne: d.amne, laget: d.laget, urval: d.urval, akter }),
              { plats: 'efterat', tak: 1800, timeout: 240000 }).catch(() => '')).trim();
          }
          steg('faktakoll');
          const utkast = Djupdykning.briefMarkdown({ ...d, akter, koll: { strider: [], sagInte: [], tal: [] }, kallor: [] });
          const koll = d.sakert
            ? Djupdykning.lasFaktakoll(await svaraLokalt(Djupdykning.faktakollPrompt({ sakert: d.sakert, brief: utkast }), { plats: 'efterat', tak: 1800, timeout: 240000 }).catch(() => ''))
            : { strider: [], sagInte: [] };
          koll.tal = Djupdykning.talUtanKalla(d.avsnitt.pitch, `${d.mandat}\n${d.sidtext}\n${JSON.stringify(d.laget)}\n${JSON.stringify(akter)}\n${d.sakert}`);
          const kallor = [...new Map((d.kallor || []).map(k => [k.namn, k])).values()];
          const md = Djupdykning.briefMarkdown({ ...d, akter, koll, kallor });
          const nyckel = sess.las?.styrka === 'forseglad' ? await maximus.nyckelFor(sess, koder.get(sess.id) || null) : null;
          const post = await Artefakt.lagg(maximus, sessionsKatalog(sess.agare), sess,
            { sort: 'docx', rubrik: tx('srv.djup.briefRubrik', { amne: d.amne }).slice(0, 120), data: Kontor.tillDocx(md, { rubrik: tx('srv.djup.briefRubrik', { amne: d.amne }) }), om: tx('srv.djup.artefaktOm', { n: akter.length, m: d.laget.length }), nyckel });
          (sess.artefakter ||= []).push(post);
          const tid = new Date().toISOString();
          const briefTur = { id: randomUUID(), tid, fraga: '', av: 'maximus', status: 'klar', svar: md, kvitto: [], kallor: [], artefakt: post, djupdykning: true,
            sager: tx('srv.djup.klar', { n: akter.length, a: d.urval.a.length, m: d.laget.length, strider: koll.strider.length ? tx('srv.djup.strider', { k: koll.strider.length }) : '' }) };
          sess.turer.push(briefTur); sess.andrad = tid;
          d.fas = 'klar'; d.klar = tid;
          await spara(sess);
          sand(sess.id, { typ: 'agenttur', session: sess.id, tur: briefTur });
          steg('klar');
          notifiera(tx('srv.notis.djupKlar'), d.amne.slice(0, 120), sess.id, { viktigt: true });
        } catch (e) {
          d.fas = 'fel'; d.fel = e.message;
          sand(sess.id, { typ: 'djup', fas: 'fel', fel: e.message });
          await spara(sess).catch(() => {});
        } finally { djupjobb.delete(sess.id); sandAlla({ typ: 'lista', agare: sess.agare }); }
      })();
      return;
    }

    const mLev = /^\/api\/sessioner\/([\w-]+)\/(leverans)$/.exec(vag);
    if (mLev) {
      const sess = minSession(mLev[1], jag);
      if (!sess) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      if (stangd(sess)) return json(res, 423, { error: tx('srv.fel.forsegladAngeKoden') });
      const underlag = () => [
        ...(sess.filer || []).slice(0, 4).map(f => `[${f.namn}]\n${String(f.original || f.maskerad || '').slice(0, 2500)}`),
        ...sess.turer.slice(-4).map(t => tx('srv.leverans.underlagTur', { fraga: t.fraga, svar: String(t.svar || '').slice(0, 1200) })),
      ].join('\n\n');
      const steg = String(kropp.steg || '');
      if (steg === 'disposition' || steg === 'andra') {
        await modellForAgenten();
        const lev = steg === 'andra' ? sess.leverans : {
          id: randomUUID(), sort: Leverans.SORTER.includes(kropp.sort) ? kropp.sort : 'presentation',
          mal: String(kropp.mal || '').slice(0, 400), mottagare: String(kropp.mottagare || '').slice(0, 200),
          langd: Leverans.LANGDER[kropp.langd] ? kropp.langd : 'mellan' };
        if (!lev) return json(res, 409, { error: tx('srv.leverans.ingenDisposition') });
        if (!lev.mal) return json(res, 422, { error: tx('srv.leverans.vadAstadkomma') });
        const prompt = steg === 'andra'
          ? Leverans.andraPrompt({ disposition: lev.disposition, andring: String(kropp.andring || '').slice(0, 600) })
          : Leverans.dispositionPrompt({ ...lev, underlag: underlag() });
        let d = null;
        for (let forsok = 0; forsok < 2 && !d; forsok++) {
          const svar = await svaraLokalt(forsok ? `${prompt}${tx('srv.leverans.endastJson')}` : prompt,
            { plats: 'efterat', tak: 2500, timeout: 180000 }).catch(e => { throw new Error(tx('srv.fel.modellenSvaradeInte', { fel: e.message })); });
          d = Leverans.lasDisposition(svar);
        }
        if (!d) return json(res, 502, { error: tx('srv.leverans.ingenDispositionModell') });
        sess.leverans = { ...lev, disposition: d };
        await spara(sess);
        return json(res, 200, { leverans: sess.leverans });
      }
      if (steg === 'skriv') {
        const lev = sess.leverans;
        if (!lev?.disposition) return json(res, 409, { error: tx('srv.leverans.godkannForst') });
        if (leveranser.has(sess.id)) return json(res, 409, { error: tx('srv.leverans.skrivsRedan') });
        leveranser.add(sess.id);
        json(res, 202, { startad: true });
        (async () => {
          const { titel, avsnitt: plan } = lev.disposition;
          const klara = [];
          try {
            for (const [nr, a] of plan.entries()) {
              sand(sess.id, { typ: 'leverans', fas: 'skriver', nr, av: plan.length, rubrik: a.rubrik });
              const r = await agentSlinga({ uppgift: Leverans.avsnittUppgift({ ...lev, titel, avsnitt: a, nr, alla: plan }),
                sammanhang: underlag(), session: sess.id, betrodd: { uppgift: true },
                onSteg: st => sand(sess.id, { typ: 'leverans', fas: 'skriver', nr, av: plan.length, rubrik: a.rubrik, steg: st.verktyg }) });
              if (Leverans.arBegaran(r.svar)) {
                const uppg = Leverans.avsnittUppgift({ ...lev, titel, avsnitt: a, nr, alla: plan });
                r.svar = await svaraLokalt(Leverans.skrivUtanVerktyg(uppg, underlag()), { plats: 'efterat', tak: 900, timeout: 180000 }).catch(() => r.svar);
                r.slut = 'utan verktyg';
              }
              klara.push({ rubrik: a.rubrik, ...Leverans.lasAvsnitt(r.svar, lev.sort), kallor: Leverans.kallorUr(r.steg),
                ra: String(r.svar || '').slice(0, 6000), steg: (r.steg || []).map(x => ({ verktyg: x.verktyg, fel: Boolean(x.fel) })), slut: r.slut });
            }
            sand(sess.id, { typ: 'leverans', fas: 'granskar', av: plan.length });
            const anm = Leverans.lasGranskning(await svaraLokalt(Leverans.granskaPrompt({ titel, avsnitt: klara }), { plats: 'efterat', tak: 600, timeout: 180000 }).catch(() => ''));
            sand(sess.id, { typ: 'leverans', fas: 'bygger', av: plan.length });
            const kallor = [...new Map(klara.flatMap(a => a.kallor).map(k => [k.namn, k])).values()];
            const under = `${lev.mottagare ? tx('srv.leverans.till', { mottagare: lev.mottagare }) : ''}${new Date().toLocaleDateString(lokalNu(), { day: 'numeric', month: 'long', year: 'numeric' })}`;
            const mall = await kundmall(lev.sort === 'dokument' ? 'dokument' : 'presentation', sess.agare);
            const data = lev.sort === 'dokument'
              ? await Leverans.byggDocx({ titel, undertitel: under, avsnitt: klara, mall })
              : await Leverans.byggPptx({ titel, undertitel: under, avsnitt: klara, kallor, mall });
            const nyckel = sess.las?.styrka === 'forseglad' ? await maximus.nyckelFor(sess, koder.get(sess.id) || null) : null;
            const post = await Artefakt.lagg(maximus, sessionsKatalog(sess.agare), sess,
              { sort: lev.sort === 'dokument' ? 'docx' : 'pptx', rubrik: titel, data,
                om: lev.sort === 'dokument' ? tx('srv.leverans.omDokument', { n: klara.length }) : tx('srv.leverans.omPresentation', { n: klara.length + 1 + (kallor.length ? 1 : 0) }), nyckel });
            (sess.artefakter ||= []).push(post);
            const tid = new Date().toISOString();
            const klarTur = { id: randomUUID(), tid, fraga: '', av: 'maximus', status: 'klar', svar: '', kvitto: [], kallor: [], artefakt: post,
              sager: [tx(lev.sort === 'dokument' ? 'srv.leverans.klarDokument' : 'srv.leverans.klarPresentation', { titel, n: klara.length, mottagare: lev.mottagare || tx('srv.leverans.mottagaren') }),
                kallor.length ? tx('srv.leverans.kallor', { n: kallor.length, lista: kallor.slice(0, 8).map(k => k.url ? `[${k.namn.replace(/^https?:\/\//, '').slice(0, 50)}](${k.url})` : k.namn).join(' · ') }) : tx('srv.leverans.ingaKallor'),
                anm.length ? tx('srv.leverans.granskningen', { anm: anm.map(x => `- ${x}`).join('\n') }) : tx('srv.leverans.granskningenInget')].join('\n\n') };
            sess.turer.push(klarTur); sess.andrad = tid;
            sess.leverans = { ...lev, klar: tid, avsnitt: klara };
            await spara(sess);
            sand(sess.id, { typ: 'agenttur', session: sess.id, tur: klarTur });
            sand(sess.id, { typ: 'leverans', fas: 'klar' });
          } catch (e) {
            sand(sess.id, { typ: 'leverans', fas: 'fel', fel: e.message });
          } finally { leveranser.delete(sess.id); sandAlla({ typ: 'lista', agare: sess.agare }); }
        })();
        return;
      }
      return json(res, 422, { error: tx('srv.fel.okantSteg') });
    }

    if (vag === '/api/stang') {
      json(res, 200, { stanger: true });
      setTimeout(() => stangNer('appen bad om det'), 50);
      return;
    }

    if (vag === '/api/maximus') {
      try {
        if (kropp.vad === 'satt') {
          if (nekas(res, 'losenordet')) return;
          if (maximus.skyddat) return json(res, 409, { error: tx('srv.fel.harRedanLosenord') });
          await maximus.satLosenord(String(kropp.losenord || ''), { kommIhag: kropp.kommIhag !== false });
          const gjorda = await maximus.migrera();
          await laddaSessioner();
          await stadaTomma();
          return json(res, 200, { skyddat: true, upplast: true, migrerade: gjorda,
            minns: await maximus.minnsINyckelring() });
        }
        if (kropp.vad === 'lasupp') {
          await maximus.lasUpp(String(kropp.losenord || ''));
          if (kropp.kommIhag) await maximus.sparaINyckelring().catch(() => {});
          await laddaSessioner();
          await aterlasInstallningar();
          await stadaTomma();
          return json(res, 200, { skyddat: true, upplast: true, minns: await maximus.minnsINyckelring() });
        }
        if (kropp.vad === 'las') {
          if (nekas(res, 'lasa')) return;
          await lasMaximus(minToken(req));
          return json(res, 200, { skyddat: maximus.skyddat, upplast: false });
        }
        if (kropp.vad === 'aterkalla') {
          if (nekas(res, 'aterkalla')) return;
          const antal = aterkalla();
          return json(res, 200, { aterkallad: true, fonster: antal });
        }
        if (kropp.vad === 'glom') {
          if (nekas(res, 'nyckelringen')) return;
          await maximus.glomINyckelring();
          return json(res, 200, { minns: false });
        }
        if (kropp.vad === 'minns') {
          if (nekas(res, 'nyckelringen')) return;
          await maximus.sparaINyckelring();
          return json(res, 200, { minns: true });
        }
        return json(res, 422, { error: tx('srv.fel.okantVal') });
      } catch (e) { return json(res, 422, { error: e.message }); }
    }

    if (vag === '/api/locket') {
      try {
        if (kropp.vad === 'satt') {
          if (!maximus.upplast) return json(res, 423, { error: tx('srv.fel.lasUppForst') });
          const l = await Locket.satt(dataDir, maximus.huvudnyckel, {
            kod: String(kropp.kod || ''),
            fraga: kropp.fraga ? String(kropp.fraga) : null,
            svar: kropp.svar ? String(kropp.svar) : null,
            efter: Number.isFinite(Number(kropp.efter)) ? Number(kropp.efter) : null,
          });
          await maximus.glomINyckelring().catch(() => {});
          return json(res, 200, { locket: l, minns: false });
        }

        if (kropp.vad === 'oppna') {
          const medSvar = kropp.svar != null;
          const nyckel = await Locket.oppna(dataDir, medSvar
            ? { svar: String(kropp.svar) }
            : { kod: String(kropp.kod || '') });
          await maximus.lasUppMedNyckel(nyckel);
          await laddaSessioner();
          await aterlasInstallningar();
          return json(res, 200, { upplast: true, locket: Locket.lage(await Locket.las(dataDir)) });
        }

        if (kropp.vad === 'tabort') {
          if (!maximus.upplast) return json(res, 423, { error: tx('srv.fel.lasUppForst') });
          await Locket.tabort(dataDir);
          return json(res, 200, { locket: { pa: false } });
        }

        if (kropp.vad === 'efter') {
          if (!maximus.upplast) return json(res, 423, { error: tx('srv.fel.lasUppForst') });
          const d = await Locket.las(dataDir);
          if (!d) return json(res, 422, { error: tx('srv.locket.ingetLock') });
          d.efter = Number.isFinite(Number(kropp.efter)) ? Number(kropp.efter) : null;
          await writeFile(join(dataDir, 'locket.json'), JSON.stringify(d, null, 1), { mode: 0o600 });
          return json(res, 200, { locket: Locket.lage(d) });
        }

        return json(res, 422, { error: tx('srv.fel.okantVal') });
      } catch (e) {
        return json(res, 422, { error: e.message, forsokKvar: e.forsokKvar ?? null });
      }
    }

    if (maximus.skyddat && !maximus.upplast) return json(res, 423, { error: tx('srv.fel.maximusLast') });

    if (vag === '/api/policy') {
      const ra = String(kropp.text || '').slice(0, POLICYTAK);
      const stadad = kropp.stada === false ? ra : await stadaPolicy(ra);
      installningar = { ...installningar, policy: stadad };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      return json(res, 200, { policy: stadad });
    }

    if (vag === '/api/generalisera') {
      const fore = String(kropp.maskerad || '');
      try {
        const efter = await skrivOm(fore, { instruktion: GENERALISERA, anvandare: jag?.id });
        if (!efter) return json(res, 200, { text: null, fel: tx('srv.generalisera.tomt') });
        const d = blevVagare(fore, efter);
        if (!d.ok) return json(res, 200, { text: null, fel: d.varfor });
        return json(res, 200, { text: efter, siffror: { fore: d.fore, efter: d.efter },
          rojning: bedomRojning(efter) });
      } catch (e) { return json(res, 200, { text: null, fel: e.message }); }
    }

    if (vag === '/api/modell') {
      try {
        if (kropp.vad === 'paus') {
          const arbetar = [djupjobb.size && tx('srv.modell.arbetar.djup'), leveranser.size && tx('srv.modell.arbetar.dokument'), korningar.size && tx('srv.modell.arbetar.svar'),
            slarNu && tx('srv.modell.arbetar.agent'), undersoker && tx('srv.modell.arbetar.undersokning')].filter(Boolean);
          if (arbetar.length) return json(res, 409, { error: tx('srv.modell.arbetarPausasInte', { lista: ochLista(arbetar) }), arbetar: true });
          modellAvstangd = true;
          try { await pausaModell(); } catch (e) { modellAvstangd = false; throw e; }
          modellPausad = true;
          sandAlla({ typ: 'modell', uppe: false, pausad: true });
          return json(res, 200, { uppe: false, pausad: true });
        }
        if (kropp.vad === 'fortsatt') {
          pausaEfterVarvet = false;
          if (await vackPausad()) {
            sandAlla({ typ: 'modell', uppe: true, pausad: false });
            return json(res, 200, { uppe: true, pausad: false });
          }
          console.log('  Den pausade modellen svarar inte. Startar en ny…');
          sandAlla({ typ: 'modell', uppe: false, pausad: false, startar: true });
        }
        if (kropp.vad === 'stopp') {
          modellAvstangd = true;
          if (modellPausad) await fortsattModell().catch(() => {});
          try { await stoppaModell(); }
          catch (e) { modellAvstangd = false; throw e; }
          modellPausad = false;
          sandAlla({ typ: 'modell', uppe: false });
          return json(res, 200, { uppe: false });
        }
        modellAvstangd = false;
        modellPausad = false;
        glomTak();
        if (kropp.bakgrund === true) {
          sakerstallModell({ onSteg: h => console.log(`  ${h.text}…`) })
            .then(r => { varmPlatser({ url: r.url, prompter: VARMA }).catch(() => {}); sandAlla({ typ: 'modell', uppe: true, url: r.url, egen: !r.redan }); })
            .catch(() => {});
          return json(res, 202, { startar: true });
        }
        const r = await sakerstallModell({ onSteg: h => console.log(`  ${h.text}…`) });
        await varmPlatser({ url: r.url, prompter: VARMA }).catch(() => {});
        sandAlla({ typ: 'modell', uppe: true, url: r.url, egen: !r.redan });
        return json(res, 200, { uppe: true, url: r.url, redan: r.redan, ...await vilkenModell() });
      } catch (e) { return json(res, 502, { error: e.message }); }
    }

    if (vag === '/api/modeller/hamta') {
      const id = String(kropp.id || '');
      if (hamtarNu) return json(res, 409, { error: tx('srv.modeller.hamtarRedan', { id: hamtarNu }) });
      const m = modellUr(id);
      if (!m) return json(res, 404, { error: tx('srv.modeller.okand') });
      hamtarNu = id;
      try {
        const r = await hamtaModell(id, {
          onFramsteg: f => sandAlla({ typ: 'hamtning', id, ...f }), liggare: hamtningsliggare(jag),
        });
        sandAlla({ typ: 'hamtning', id, klar: true });
        satModellfil(r.vag);
        installningar = { ...installningar, modell: id };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        return json(res, 200, { ...r, id });
      } catch (e) {
        sandAlla({ typ: 'hamtning', id, fel: e.message });
        return json(res, 502, { error: e.message });
      } finally { hamtarNu = null; }
    }

    if (vag === '/api/modeller/valj') {
      const id = String(kropp.id || '');
      const rader = (await modellaget()).modeller;
      const m = rader.find(x => x.id === id);
      if (!m) return json(res, 404, { error: tx('srv.modeller.okand') });
      if (!m.finns) return json(res, 409, { error: tx('srv.modeller.inteHamtad') });
      satModellfil(m.vag);
      installningar = { ...installningar, modell: id };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      return json(res, 200, { id, vag: m.vag, omstart: tx('srv.modeller.bytsVidOmstart') });
    }

    const mDela = /^\/api\/sessioner\/([\w-]+)\/dela$/.exec(vag);
    if (mDela) {
      const s = minSession(mDela[1], jag, { forseglad: true });
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      if (stangd(s)) return json(res, 423, { error: tx('srv.fel.forsegladOppnaForst') });
      try {
        const hel = await maximus.lasSession(join(sessionsKatalog(s.agare), `${s.id}.json`),
          koder.get(s.id) || null);
        const kod = String(kropp.kod || '').trim() || Dela.foreslaKod();
        const gransk = Dela.granskaKod(kod);
        if (!gransk.ok) return json(res, 422, { error: gransk.varfor });
        const fil = await Dela.paketera({ ...hel, id: s.id }, kod,
          { fran: String(kropp.fran || installningar.namn || '').trim() || null });
        const namn = `maximus-${new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')}${Dela.ANDELSE}`;
        const vag = join(delningsmapp(), namn);
        await mkdir(delningsmapp(), { recursive: true, mode: 0o700 });
        await writeFile(vag, fil, { mode: 0o600 });
        return json(res, 200, {
          kod, egen: Boolean(String(kropp.kod || '').trim()), vag,
          namn,
          fil: fil.toString('base64'),
        });
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    if (vag === '/api/dela/titta') {
      try { return json(res, 200, Dela.titta(Buffer.from(String(kropp.fil || ''), 'base64'))); }
      catch (e) { return json(res, 422, { error: e.message }); }
    }

    if (vag === '/api/dela/oppna') {
      try {
        const oppnad = await Dela.packaUpp(
          Buffer.from(String(kropp.fil || ''), 'base64'), String(kropp.kod || ''));
        const { session: inre, fran } = oppnad;

        if (oppnad.sort === 'bevakning') {
          const inkomna = (oppnad.innehall?.bevakningar || []).map(b => ({
            ...b, session: null, sessionstitel: null, fraga: null,
            delad: { fran: fran || null, nar: new Date().toISOString() },
          }));
          const fore = bevakningar.length;
          bevakningar = Bevakning.sla(bevakningar, inkomna);
          await sparaBevakning();
          sandAlla({ typ: 'bevakning' });
          return json(res, 201, { sort: 'bevakning',
            nya: bevakningar.length - fore, totalt: inkomna.length, fran: fran || null });
        }

        const s = {
          ...Dela.importerbar(inre),
          id: randomUUID(),
          agare: jag?.id || null,
          projekt: null,
          delad: { fran: fran || null, nar: new Date().toISOString() },
          skapad: new Date().toISOString(),
        };
        for (const f of s.filer) {
          const m = await forbered(f.original, { karta: s.karta, raknare: s.raknare, sorter: galler(installningar) });
          s.karta = m.karta; s.raknare = m.raknare;
          f.maskerad = m.maskerad; f.dolda = m.nya.length;
        }
        sessioner.set(s.id, s);
        await spara(s);
        sandAlla({ typ: 'lista' });
        return json(res, 201, s);
      } catch (e) { return json(res, 422, { error: e.message }); }
    }

    if (vag === '/api/webblasare/rensa') {
      const t0 = Date.now();
      try {
        const r = await rensaGammalWebblasare();
        await liggare({ anvandare: jag?.id || null, session: null, aktor: tx('srv.helig.duTitel'),
          frontier: tx('srv.liggare.gammalWebblasare'), vag: 'lokal', skickat: '',
          mottaget: tx('srv.liggare.gammalWebblasareMb', { mb: Math.round(r.byte / 1e6), vag: r.vag }),
          tecken: 0, sekunder: (Date.now() - t0) / 1000 }).catch(e => console.error('liggaren kunde inte skriva om webbläsaren:', e.message));
        return json(res, 200, { ...r, ...await webblage() });
      } catch (e) {
        return json(res, 500, { error: e.message });
      }
    }

    if (vag === '/api/intyg') {
      try {
        const rader = await Liggare.las(maximus, dataDir, { oppnare: liggaroppnare });
        const s = Attest.sammandrag(rader, {
          installningar: { ...installningar, sorter: [...galler(installningar)] },
          modell: (await vilkenModell())?.namn || null,
          version: VERSION,
        });
        intyget = { sammandrag: s };
        await maximus.skrivFil(join(dataDir, 'intyg.json'), JSON.stringify(intyget));
        return json(res, 200, { ...intyget,
          text: Attest.tillText(intyget, { organisation: installningar.namn || null }) });
      } catch (e) { return json(res, 502, { error: e.message }); }
    }

    if (vag === '/api/felrapport/utkast') {
      try {
        const teknik = await Felrapport.tekniskt({ version: VERSION });
        return json(res, 200, Felrapport.utkast({ vad: kropp.vad, istallet: kropp.istallet, funktion: String(kropp.funktion || ''), teknik }));
      } catch (e) { return json(res, e.status || 422, { error: e.message }); }
    }
    if (vag === '/api/felrapport/granska') {
      try { return json(res, 200, Felrapport.rensa(String(kropp.text ?? '').slice(0, Felrapport.TAK * 2))); }
      catch (e) { return json(res, e.status || 422, { error: e.message }); }
    }
    if (vag === '/api/felrapport/formulera') {
      try {
        const text = String(kropp.text || '').slice(0, 6000);
        if (!text.trim()) return json(res, 422, { error: tx('srv.felrapport.fel.tom') });
        if (molnPa()) return json(res, 409, { error: tx('srv.felrapport.fel.baraLokalt') });
        const instruktion = Sprakstod.modellprompt(tx('srv.felrapport.formulera'));
        const svar = await svaraLokalt(`${instruktion}\n\nTEXTEN:\n${text}`, { plats: 'efterat', tak: 600, timeout: 90000, baraLokalt: true });
        const ren = String(svar?.text ?? svar ?? '').trim();
        if (!ren) return json(res, 503, { error: tx('srv.felrapport.fel.modell') });
        return json(res, 200, Felrapport.rensa(ren));
      } catch (e) { return json(res, 503, { error: tx('srv.felrapport.fel.modell') }); }
    }
    if (vag === '/api/felrapport/godkann') {
      try {
        if (!rapportor.mottagare()) {
          Felrapport.prova({ text: kropp.text, epost: '', hash: kropp.hash });
          mejlGodkanda.set(`${jag?.id ?? 'en'}:${kropp.hash}`, { text: kropp.text, tid: Date.now() });
          return json(res, 200, { hash: kropp.hash, mejl: true });
        }
        return json(res, 200, await rapportor.godkann({ text: kropp.text, epost: String(kropp.epost || ''), hash: kropp.hash, agare: jag?.id }));
      } catch (e) {
        return json(res, e.status || 422, { error: e.message, sort: e.sort || null, ...(e.text ? { text: e.text, dolda: e.dolda } : {}) });
      }
    }
    if (vag === '/api/felrapport/mejl') {
      const nyckel = `${jag?.id ?? 'en'}:${String(kropp.hash || '')}`;
      const fryst = mejlGodkanda.get(nyckel);
      if (rapportor.mottagare() || !fryst || Date.now() - fryst.tid > 10 * 60 * 1000)
        return json(res, 404, { error: tx('srv.felrapport.fel.ejGodkant'), sort: 'ejGodkant' });
      mejlGodkanda.delete(nyckel);
      try {
        const till = Hemvist.RAPPORTMEJL;
        const r = await Felrapport.oppnaMejl({ text: fryst.text, hash: kropp.hash, till, amne: tx('srv.felrapport.mejl.amne', { version: VERSION }) },
          { lager: mejllager });
        await liggare({ frontier: tx('srv.felrapport.mejl.mottagare', { till }), vag: 'epost', skickat: fryst.text,
          mottaget: tx(r.vag === 'mail' ? 'srv.felrapport.mejl.oppnat' : 'srv.felrapport.mejl.oppnatMailto', { till }),
          tecken: fryst.text.length, sekunder: 0, anvandare: jag?.id && jag.id !== 'en' ? jag.id : null, session: null,
          aktor: tx('srv.helig.duTitel') }).catch(() => {});
        return json(res, 200, r);
      } catch (e) { return json(res, e.status || 502, { error: tx('srv.felrapport.fel.mejl'), sort: 'mejl' }); }
    }
    if (vag === '/api/felrapport/skicka') {
      try {
        const kvitto = await rapportor.skicka({ hash: String(kropp.hash || ''), agare: jag?.id });
        return json(res, 200, { kvitto });
      } catch (e) {
        return json(res, e.status || 502, { error: e.message, sort: e.sort || null, ...(e.text ? { text: e.text, dolda: e.dolda } : {}) });
      }
    }
    if (vag === '/api/felrapport/glom') {
      await rapportor.glom(String(kropp.hash || ''), jag?.id).catch(() => {});
      return json(res, 200, { ok: true });
    }

    if (vag === '/api/hjalp') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
        Connection: 'keep-alive' });
      const skriv = h => { try { res.write(`data: ${JSON.stringify(h)}\n\n`); } catch {} };
      const kontroll = new AbortController();
      req.on('close', () => kontroll.abort());
      try {
        const fragan = String(kropp.fraga || '');
        const historik = (Array.isArray(kropp.historik) ? kropp.historik.slice(-6) : [])
          .map(t => ({ fraga: String(t?.fraga || '').slice(0, 2000), svar: String(t?.svar || '').slice(0, 6000) }));
        const svar = await Hjalp.fraga(fragan, {
          historik, lage: hjalpLage(),
          signal: kontroll.signal,
          onText: bit => skriv({ typ: 'text', bit }),
        });
        skriv({ typ: 'klar', svar });
      } catch (e) {
        skriv({ typ: 'fel', fel: e.message });
      }
      return res.end();
    }

    if (vag === '/api/kopplingar/starta') {
      const k = Plugins.MCP_KATALOG.find(x => x.id === kropp.id);
      if (!k) return json(res, 404, { error: tx('srv.kopplingar.okand') });
      let arg, miljo;
      try {
        arg = Plugins.kopplingsArgument(k, { mapp: kropp.mapp, url: kropp.url });
        miljo = Plugins.kopplingsMiljo(k, kropp.miljo);
      } catch (e) { return json(res, 422, { error: e.message }); }
      try {
        if (k.kommando === 'npx') {
          const paket = k.argument.find(a => !a.startsWith('-')) || k.id;
          await liggare({ anvandare: jag?.id || null, session: null, aktor: tx('srv.helig.duTitel'),
            frontier: tx('srv.liggare.npx', { namn: k.namn }), vag: 'direkt',
            skickat: `npx -y ${paket} · registry.npmjs.org`,
            mottaget: tx('srv.liggare.npxMottaget'),
            tecken: 0, sekunder: 0 }).catch(e => console.error('liggaren kunde inte skriva om npx:', e.message));
        }
        const lage = await Plugins.starta(k.id, {
          namn: k.namn, kommando: k.kommando, argument: arg, miljo,
        });
        return json(res, 200, lage);
      } catch (e) { return json(res, 502, { error: e.message }); }
    }

    if (vag === '/api/kopplingar/stoppa')
      return json(res, 200, Plugins.stoppa(String(kropp.id || '')));

    if (vag === '/api/kopplingar/anropa') {
      try {
        const r = await Plugins.anropa(String(kropp.koppling || ''), String(kropp.verktyg || ''),
          kropp.argument && typeof kropp.argument === 'object' ? kropp.argument : {});
        const skickade = r.skickadeArgument ?? {};
        delete r.skickadeArgument;
        await liggare({ frontier: tx('srv.liggare.koppling', { koppling: r.koppling }), vag: 'koppling',
          skickat: `${kropp.verktyg} ${JSON.stringify(skickade)}`.slice(0, 2000),
          mottaget: String(r.text).slice(0, 8000), tecken: String(r.text).length, sekunder: 0 });
        return json(res, 200, r);
      } catch (e) { return json(res, 502, { error: e.message }); }
    }

    if (vag === '/api/kopplingar/granska') {
      if (kropp.rad) {
        const kort = await Mcp.granskaLokal(String(kropp.rad).slice(0, 400));
        return json(res, 200, { kort: Mcp.somKort(kort) });
      }
      const url = String(kropp.url || '').slice(0, 500);
      const forslag = kropp.forslag ? mcpForeslagna.get(url) : null;
      if (kropp.forslag && !forslag) return json(res, 404, { error: tx('srv.mcp.okantForslag') });
      const sess = kropp.session ? minSession(String(kropp.session), jag) : null;
      const kort = await Mcp.granska(url, { kalla: forslag ? 'register' : 'lank', register: forslag, andraNamn: mcpAndraNamn(),
        session: sess?.id || null, tur: sess && kropp.tur ? String(kropp.tur) : null });
      await mcpGranskningsrad(kort, sess?.id || null);
      if (sess && kropp.tur) await speglaKort(kort);
      return json(res, 200, { kort: Mcp.somKort(kort) });
    }

    if (vag === '/api/kopplingar/svar') {
      const kort = Mcp.kortet(kropp.kort);
      if (!kort) return json(res, 404, { error: tx('srv.mcp.kortetBorta') });
      if (kropp.svar === 'nej') {
        kort.status = 'nekad';
        Mcp.glomKort(kort.id);
        await speglaKort(kort);
        return json(res, 200, { kort: Mcp.somKort(kort) });
      }
      if (kropp.svar !== 'ja') return json(res, 422, { error: tx('srv.handling.svaraJaNej') });
      if (kort.status === 'lokal' && kropp.forstar !== true) return json(res, 422, { error: tx('srv.mcp.forstarKravs') });
      if (!['klar', 'lokal'].includes(kort.status)) return json(res, 409, { error: tx('srv.mcp.kanInteJa') });
      const far = Array.isArray(kropp.far) ? kropp.far.map(String) : [];
      const sorter = kropp.sorter && typeof kropp.sorter === 'object' ? kropp.sorter : {};
      const post = Mcp.postFran(kort, { far, sorter, overallt: kort.session ? kropp.overallt === true : true });
      const krock = Mcp.krockar(post, mcpPoster());
      if (krock.length) return json(res, 409, { error: tx('srv.mcp.krock', { namn: krock.slice(0, 3).join(', ') }) });
      Plugins.stoppa(post.id);
      await sparaMcp([...mcpPoster().filter(p => p.id !== post.id), post]);
      if (kort.status === 'lokal') {
        try { await mcpIgang(post); }
        catch (e) {
          kort.status = 'vagras'; kort.fel = e.message;
          kort.skal = mcpPost(post.id)?.skal || [];
          await sparaMcp(mcpPoster().filter(p => p.id !== post.id));
          await speglaKort(kort);
          return json(res, 200, { kort: Mcp.somKort(kort) });
        }
        kort.verktyg = (mcpPost(post.id)?.verktyg || []).map(v => ({ ...v, schema: undefined }));
      }
      if (kort.bevaka) {
        const valda = post.verktyg.filter(v => v.sort === 'las' && !(v.schema?.required || []).length && Mcp.provvikt(v.namn) > 0 && !/status|capabilit|sync|health/i.test(v.namn)).slice(0, 3).map(v => v.namn);
        if (valda.length) {
          const u = Uppdrag.nyttUppdrag({ instruktion: kort.fraga || post.namn, titel: tx('srv.mcp.uppdragTitel', { namn: post.namn }),
            kallor: [{ typ: 'koppling', id: post.id, namn: post.namn, verktyg: valda }], aterkommande: true });
          uppdrag.push(u);
          await sparaUppdrag();
          kort.uppdrag = { id: u.id, titel: u.titel, takt: u.takt, verktyg: valda };
          sandAlla({ typ: 'lista' });
        }
      }
      kort.status = 'godkand';
      Mcp.glomKort(kort.id);
      await liggare({ frontier: tx('srv.liggare.mcpInkopplad', { namn: post.namn }), vag: 'lokal', skickat: post.url || post.rad?.visas || post.namn,
        mottaget: tx('srv.mcp.liggareGodkand', { n: post.verktyg.length, far: post.verktyg.filter(v => v.far).length }),
        tecken: 0, sekunder: 0, session: kort.session || null, anvandare: null, aktor: tx('srv.helig.duTitel') }).catch(() => {});
      await speglaKort(kort);
      sandAlla({ typ: 'kopplingar' });
      return json(res, 200, { kort: Mcp.somKort(kort), post: { id: post.id } });
    }

    if (vag === '/api/kopplingar/plan') {
      const kort = Mcp.kortet(kropp.kort);
      if (!kort || kort.status !== 'plan') return json(res, 404, { error: tx('srv.mcp.kortetBorta') });
      if (kropp.svar === 'nej') { kort.status = 'nekad'; Mcp.glomKort(kort.id); await speglaKort(kort); return json(res, 200, { kort: Mcp.somKort(kort) }); }
      if (kropp.svar !== 'ja') return json(res, 422, { error: tx('srv.handling.svaraJaNej') });
      if (kort.plan.korning === 'lokal' && kropp.forstar !== true) return json(res, 422, { error: tx('srv.mcp.forstarKravs') });
      if (typeof kropp.bevaka === 'boolean') kort.bevaka = kropp.bevaka;
      kort.status = 'installerar';
      kort.planJa = true;
      await speglaKort(kort);
      genomforPlan(kort).catch(e => console.error('planen:', e.message));
      return json(res, 202, { kort: Mcp.somKort(kort) });
    }

    if (vag === '/api/kopplingar/logga-in') {
      const kort = Mcp.kortet(kropp.kort);
      if (!kort || kort.status !== 'inloggning' || !kort.inloggning?.vag) return json(res, 409, { error: tx('srv.mcp.kanInteLoggaIn') });
      try {
        const tillbaka = `http://localhost:${PORT}/mcp/oauth`;
        const reg = await McpOauth.registrera(kort.inloggning.vag, tillbaka);
        const p = McpOauth.paborja(kort.inloggning.vag, reg.klient, tillbaka);
        mcpInloggning = { ...p, kort: kort.id, klient: reg.klient, tillbaka, vag: kort.inloggning.vag };
        await liggare({ frontier: tx('srv.liggare.mcpInloggning', { vard: kort.inloggning.vard }), vag: 'koppling',
          skickat: tx('srv.mcp.liggareRegistrering'), mottaget: tx('srv.mcp.liggareKlient'), tecken: 0, sekunder: 0,
          session: kort.session || null, anvandare: null, aktor: tx('srv.helig.duTitel') }).catch(() => {});
        if (process.env.MAXIMUS_PROV !== '1') execFileCb('/usr/bin/open', [p.url], () => {});
        return json(res, 200, { url: p.url });
      } catch (e) { return json(res, 502, { error: e.message }); }
    }

    if (vag === '/api/kopplingar/nyckel') {
      const kort = Mcp.kortet(kropp.kort);
      if (!kort || kort.status !== 'nyckel') return json(res, 409, { error: tx('srv.mcp.kanInteLoggaIn') });
      try {
        await McpOauth.sparaHemlighet(kort.kopplingsId, 'nyckel', String(kropp.nyckel || '').trim());
        const nyckelHuvud = { namn: 'authorization', mall: 'Bearer {nyckel}' };
        const ny = await Mcp.granska(kort.url, { kalla: kort.kalla, session: kort.session, tur: kort.tur,
          register: kort.registernamn ? mcpForeslagna.get(kort.url) : null,
          auktorisering: Mcp.auktoriseringFor({ id: kort.kopplingsId, namn: kort.namn || kort.vard, nyckelHuvud }) });
        Mcp.glomKort(ny.id);
        Object.assign(ny, { id: kort.id, nyckelHuvud });
        Mcp.ersatt(ny);
        await mcpGranskningsrad(ny, kort.session);
        if (ny.status === 'nyckel' || ny.status === 'inloggning') { ny.status = 'fel'; ny.fel = tx('srv.mcp.nyckelNej'); }
        await speglaKort(ny);
        return json(res, 200, { kort: Mcp.somKort(ny) });
      } catch (e) { return json(res, 422, { error: e.message }); }
    }

    if (vag === '/api/kopplingar/mcp') {
      const post = mcpPost(String(kropp.id || ''));
      if (!post) return json(res, 404, { error: tx('srv.kopplingar.okand') });
      if (kropp.bort === true) {
        await mcpTaBortAllt(post);
        await sparaMcp(mcpPoster().filter(p => p.id !== post.id));
        await liggare({ frontier: tx('srv.liggare.mcpBorttagen', { namn: post.namn }), vag: 'lokal', skickat: post.url || post.namn,
          mottaget: tx('srv.mcp.liggareBorttagen'), tecken: 0, sekunder: 0, anvandare: null, session: null, aktor: tx('srv.helig.duTitel') }).catch(() => {});
        sandAlla({ typ: 'kopplingar' });
        return json(res, 200, { bort: true });
      }
      const ny = { ...post };
      if (typeof kropp.pa === 'boolean') {
        if (kropp.pa && post.andrad) return json(res, 409, { error: tx('srv.mcp.granskaIgen') });
        ny.pa = kropp.pa;
        if (!kropp.pa) { Plugins.stoppa(post.id); McpInstall.stoppaProcess(post.id); }
      }
      if (typeof kropp.overallt === 'boolean') { ny.overallt = kropp.overallt; if (kropp.overallt) ny.session = null; }
      if (kropp.sort && typeof kropp.sort === 'object') {
        ny.verktyg = (ny.verktyg || []).map(v => (['las', 'skriv', 'skicka', 'betala', 'radera'].includes(kropp.sort[v.namn])
          ? { ...v, sort: kropp.sort[v.namn], far: kropp.sort[v.namn] === 'las' ? v.far : false } : v));
      }
      if (kropp.far && typeof kropp.far === 'object') {
        ny.verktyg = (ny.verktyg || []).map(v => (v.namn in kropp.far ? { ...v, far: v.sort === 'las' && kropp.far[v.namn] === true } : v));
      }
      await sparaMcp(mcpPoster().map(p => (p.id === post.id ? ny : p)));
      sandAlla({ typ: 'kopplingar' });
      return json(res, 200, { post: { id: ny.id, pa: ny.pa, overallt: ny.overallt } });
    }

    if (vag === '/api/modeller/bort') {
      try { return json(res, 200, await taBortModell(String(kropp.id || ''))); }
      catch (e) { return json(res, 409, { error: e.message }); }
    }

    if (vag === '/api/oron') {
      if ('valj' in kropp && ['svensk', 'snabb'].includes(kropp.valj)) {
        satOra(kropp.valj);
        installningar = { ...installningar, ora: kropp.valj };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      }
      return json(res, 200, { oron: await oronlage() });
    }

    if (vag === '/api/orat') {
      try {
        const r = await hamtaOrat({ liggare: hamtningsliggare(jag) });
        sandAlla({ typ: 'orat', ...(await orat()) });
        return json(res, 200, { ...(await orat()), redan: r.redan });
      } catch (e) { return json(res, 502, { error: e.message }); }
    }

    if (vag === '/api/maskering') {
      if (kropp.paket && PAKET[kropp.paket]) installningar = { ...installningar, paket: kropp.paket, sorter: null };
      else if (Array.isArray(kropp.sorter)) installningar = { ...installningar, sorter: kropp.sorter, paket: null };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      const g = galler(installningar);
      return json(res, 200, { valda: [...g], paketNu: paketFor(g) });
    }

    if (vag === '/api/namnmodell') {
      if (typeof kropp.pa === 'boolean') {
        installningar = { ...installningar, namnmodell: kropp.pa };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        Namnmodell.satNamnmodell({ pa: kropp.pa });
      }
      if (kropp.erbjuden === true) {
        installningar = { ...installningar, namnmodellErbjuden: VERSION };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      }
      return json(res, 200, await Namnmodell.namnmodellLage());
    }
    if (vag === '/api/injektionsmodell') {
      if (typeof kropp.pa === 'boolean') {
        installningar = { ...installningar, injektionsvakt: kropp.pa };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        Injektion.satInjektionsmodell({ pa: kropp.pa });
      }
      return json(res, 200, await Injektion.injektionsmodellLage());
    }
    if (vag === '/api/injektionsmodell/hamta') {
      try {
        const r = await Injektion.hamtaInjektionsmodell({ liggare: hamtningsliggare(jag),
          onFramsteg: f => sandAlla({ typ: 'injektionsmodell', ...f }) });
        return json(res, 200, { ...(await Injektion.injektionsmodellLage()), redan: r.redan });
      } catch (e) { return json(res, 502, { error: e.message }); }
    }
    if (vag === '/api/namnmodell/hamta') {
      try {
        const r = await Namnmodell.hamtaNamnmodell({ liggare: hamtningsliggare(jag),
          onFramsteg: f => sandAlla({ typ: 'namnmodell', ...f }) });
        return json(res, 200, { ...(await Namnmodell.namnmodellLage()), redan: r.redan });
      } catch (e) { return json(res, 502, { error: e.message }); }
    }

    if (await utokning?.rutt?.(req, res, url, vag, jag, kropp)) return;

    if (vag === '/api/gallring') {
      if (nekas(res, 'gallring', {}, jag)) return;
      const dagar = Math.max(0, Number(kropp.dagar) || 0);
      if (kropp.spara) {
        installningar = { ...installningar, gallring: dagar };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      }
      if (!kropp.verkstall)
        return json(res, 200, { gallring: installningar.gallring,
          ...(await Liggare.forhandsgranska(maximus, dataDir, { dagar })) });
      const r = await Liggare.gallra(maximus, dataDir, { dagar });
      return json(res, 200, { gallring: installningar.gallring, ...r });
    }

    if (vag === '/api/tillagg') {
      const d = kropp.nyKod ? await Tillagg.forNya(maximus, dataDir) : await Tillagg.kod(maximus, dataDir);
      return json(res, 200, d);
    }

    if (vag === '/api/uppdatering/hamtar') {
      const v = String(kropp.version || '').slice(0, 40);
      await liggare({ session: null, frontier: tx('srv.liggare.uppdateringskanalen'), vag: 'direkt',
        tecken: 0, sekunder: 0, fel: null,
        skickat: tx('srv.liggare.uppdateringSkickat', { v, plattform: Uppdatering.plattform() }),
        mottaget: tx('srv.liggare.uppdateringMottaget') }).catch(() => {});
      return json(res, 200, { ok: true });
    }

    if (vag === '/api/tillstand/kontroll') {
      let nollstallt = [];
      if (kropp.fragaIgen === true) nollstallt = await nollstallLov((await behorighetsKontroll()).map(x => x.ruta));
      const saknas = await behorighetsKontroll(nollstallt.length ? { vanta: 60000 } : {});
      if (!saknas.length || kropp.klar === true) {
        installningar = { ...installningar, behorighetVersion: VERSION };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      }
      return json(res, 200, { saknas, nollstallt });
    }

    if (vag === '/api/oppna-program') {
      execFileCb('/usr/bin/open', ['/Applications'], () => {});
      return json(res, 200, { ok: true });
    }
    if (vag === '/api/uppdatering') {
      const pa = installningar.uppdateringar === true;
      if (kropp.satt !== undefined) {
        installningar = { ...installningar, uppdateringar: kropp.satt === true };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        return json(res, 200, { pa: installningar.uppdateringar, version: VERSION });
      }
      if (!pa || !UPPDATERINGSADRESS) return json(res, 200, { pa: false, version: VERSION,
        fragat: typeof installningar.uppdateringar === 'boolean' });

      const r = await Uppdatering.kolla(UPPDATERINGSADRESS, { version: VERSION });
      await liggare({ session: null, frontier: tx('srv.liggare.uppdateringskanalen'), vag: 'direkt',
        tecken: (r.skickat || '').length, sekunder: Math.round((r.ms || 0) / 100) / 10,
        fel: r.fel || null, skickat: r.skickat || null,
        mottaget: r.fel ? null : tx('srv.liggare.uppdateringVersion', { v: r.senaste || '—', nyare: r.nyare ? tx('srv.liggare.nyare') : '' }) })
        .catch(() => {});
      return json(res, 200, { ...r, pa: true, version: VERSION });
    }

    if (vag === '/api/sessionsgallring') {
      if (nekas(res, 'gallring', {}, jag)) return;
      const dagar = Math.max(0, Number(kropp.dagar) || 0);
      if (kropp.spara) {
        installningar = { ...installningar, sessionsgallring: dagar };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      }
      const mina = [...sessioner.values()].filter(s => egen(s, jag) && !s.helig);
      if (!kropp.verkstall)
        return json(res, 200, { gallring: installningar.sessionsgallring || 0,
          ...Sessionsgallring.forhandsgranska(mina, { dagar }) });

      const egna = new Map(mina.map(s => [s.id, s]));
      const r = await Sessionsgallring.gallra(egna, { dagar,
        katalog: sessionsKatalog, glom: id => { korningar.get(id)?.abort(new Error(tx('srv.session.gallrad'))); glomKod(id); } });
      for (const b of r.sessioner) sessioner.delete(b.id);

      if (r.antal) {
        await maximus.andraFil(join(dataDir, 'sessionsgallring.json'),
          gamla => [...(Array.isArray(gamla) ? gamla : []), r], { forval: [] });
      }
      sandAlla({ typ: 'lista' });
      return json(res, 200, { gallring: installningar.sessionsgallring || 0, ...r });
    }

    if (vag === '/api/underlag/original') {
      const s = minSession(String(kropp.session || ''), jag);
      const k = s?.turer.find(t => t.id === String(kropp.tur || ''))?.underlag?.[Math.trunc(Number(kropp.nr)) - 1];
      if (!k) return json(res, 404, { error: tx('srv.fel.finnsInte') });
      const r = k.ref || {};
      if (kropp.app === true) {
        let mal = null;
        if (r.sort === 'mejl' && r.id) mal = `message://${encodeURIComponent(`<${r.id.replace(/^<|>$/g, '')}>`)}`;
        else if ((r.sort === 'sida' || r.sort === 'flode') && /^https?:\/\//i.test(r.url || '')) mal = r.url;
        else if (r.sort === 'fil') {
          const a = agentInst();
          const fil = await realpath(String(r.sokvag || '')).catch(() => null);
          for (const m of [...(a.mappar || []), ...(a.mapp ? [a.mapp] : [])]) {
            const rot = await realpath(m.sokvag).catch(() => null);
            if (rot && fil && fil.startsWith(rot + sep)) { mal = fil; break; }
          }
        }
        if (!mal) return json(res, 422, { error: tx('srv.underlag.ingenApp') });
        if (process.env.MAXIMUS_PROV !== '1') execFileCb('/usr/bin/open', [mal], () => {});
        return json(res, 200, { oppnat: r.sort });
      }
      let text = null;
      try { text = await lasOriginal(r); } catch {  }
      return json(res, 200, { titel: k.titel, var: Underlag.beskriv(r), original: Boolean(text), text: String(text || k.reserv || '') });
    }

    if (vag === '/api/post/oppna') {
      if (!Post.finns()) return json(res, 400, { error: tx('srv.fel.mailBaraMac') });
      let brev;
      try { brev = await Post.text(String(kropp.konto || ''), String(kropp.id || ''), { lada: kropp.lada || 'INBOX' }); }
      catch (e) { return json(res, 422, { error: e.message }); }
      if (!brev) return json(res, 404, { error: tx('srv.post.brevOlasbart') });

      const text = brevSomText(brev);

      const s = { id: randomUUID(), titel: (brev.amne || tx('srv.post.mejlTitel')).slice(0, 60),
        skapad: new Date().toISOString(), agare: jag?.id || null,
        turer: [], karta: [], raknare: {},
        ursprung: { sort: 'mejl', fran: brev.fran || null, namn: brev.namn || null,
                    adress: brev.svarTill?.[0] || brev.adress || null, amne: brev.amne || null,
                    konto: String(kropp.konto || '') || null,
                    id: String(kropp.id || '') || null, lada: String(kropp.lada || 'INBOX') },
        etiketter: [Konton.kontoEtikett(agentInst().epost, String(kropp.konto || ''))].filter(Boolean),
        lage: installningar.lage, webb: installningar.webb || 'av' };

      const f = await forbered(text, { karta: [], raknare: {}, sorter: galler(installningar) });
      s.karta = f.karta;
      s.raknare = f.raknare;
      s.filer = [{ id: randomUUID(), namn: tx('srv.post.bilagaNamn', { amne: (brev.amne || tx('srv.post.utanAmne')).slice(0, 50) }),
        sort: 'mejl', tecken: text.length, tid: new Date().toISOString(),
        original: text, maskerad: f.maskerad, dolda: f.nya.length }];

      sessioner.set(s.id, s);
      await spara(s);
      const { original, ...utanOriginal } = s.filer[0];
      return json(res, 201, { session: s.id, titel: s.titel, fil: utanOriginal,
        klass: klassaInfo(text, { funna: f.nya, rojning: f.rojning }) });
    }

    const franFonstret = () => !IDENTITET && !req.headers['x-maximus-nyckel'] && !req.headers['x-maximus-tillagg'] && !franAnnanPlats(req)
      && /(?:^|;\s*)maximus=/.test(req.headers.cookie || '');
    if (IDENTITET && vag.startsWith('/api/svar')) return json(res, 404, { error: tx('srv.fel.okandVag') });

    if (vag === '/api/svar/forslag') {
      if (!franFonstret()) return json(res, 403, { error: tx('srv.svar.baraKnappen') });
      if (!Post.finns()) return json(res, 400, { error: tx('srv.fel.mailBaraMac') });
      const konto = String(kropp.konto || ''), id = String(kropp.id || '');
      if (!konto || !id) return json(res, 422, { error: tx('svar.fel.ofullstandigt') });
      try {
        const f = await foreslaSvar({ konto, lada: String(kropp.lada || 'INBOX'), id, session: kropp.session || null,
          text: typeof kropp.text === 'string' ? kropp.text.slice(0, 20000) : null });
        return json(res, 201, { forslag: f });
      } catch (e) { return json(res, 422, { error: e.message }); }
    }

    if (vag === '/api/svar/omskriv') {
      if (!franFonstret()) return json(res, 403, { error: tx('srv.svar.baraKnappen') });
      const prompt = Svar.omskrivPrompt(kropp.text, kropp.stil);
      if (!prompt || !String(kropp.text || '').trim()) return json(res, 422, { error: tx('srv.svar.ingenText') });
      try {
        await modellForAgenten();
        const text = Svar.lasOmskrivning(await svaraLokalt(prompt, { plats: 'agent', tak: 700, timeout: 120000 }));
        if (!text) return json(res, 422, { error: tx('srv.svar.omskrivningTom') });
        return json(res, 200, { text });
      } catch (e) { return json(res, 422, { error: e.message }); }
    }

    if (vag === '/api/svar/spara') {
      if (!franFonstret()) return json(res, 403, { error: tx('srv.svar.baraKnappen') });
      const f = svarsforslag.find(x => x.id === kropp.id);
      if (!f) return json(res, 404, { error: tx('srv.svar.finnsInte') });
      if (f.status !== 'forslag') return json(res, 409, { error: tx('srv.svar.redan') });
      if (typeof kropp.text === 'string') f.text = kropp.text.slice(0, 20000);
      if (kropp.avfarda === true) f.status = 'avfard';
      await sparaSvarsforslag();
      sandAlla({ typ: 'svar', forslag: f });
      return json(res, 200, { forslag: f });
    }

    const fryst = () => {
      const f = svarsforslag.find(x => x.id === kropp.forslag);
      if (!f) return { kod: 404, error: tx('srv.svar.finnsInte') };
      if (f.status === 'skickat') return { kod: 409, error: tx('srv.svar.redan'), fel: 'redan' };
      const till = Array.isArray(f.till) ? f.till : [f.till];
      if (!till.length || !till.every(Svar.giltigAdress)) return { kod: 422, error: tx('svar.fel.mottagare') };
      const text = String(kropp.text ?? '');
      if (!text.trim()) return { kod: 422, error: tx('svar.fel.ofullstandigt') };
      const p = { konto: f.konto, lada: f.lada || 'INBOX', brevId: f.brevId, till, amne: f.amne, text,
        signatur: kropp.signatur ? String(kropp.signatur) : null, forslag: f.id, session: f.session || null };
      if (String(kropp.hash || '') !== Svar.svarsavtryck(p)) return { kod: 409, error: tx('srv.svar.avtryck'), fel: 'avtryck' };
      return { p };
    };

    if (vag === '/api/svar/mail') {
      if (!franFonstret()) return json(res, 403, { error: tx('srv.svar.baraKnappen') });
      const r = fryst();
      if (r.error) return json(res, r.kod, { error: r.error, kod: r.fel });
      try {
        await SvarMail.svara({ konto: r.p.konto, lada: r.p.lada, id: r.p.brevId, text: r.p.text, signatur: r.p.signatur, amne: r.p.amne,
          till: r.p.till, egna: await svarEgna(r.p.konto), skicka: false });
        return json(res, 200, { oppnat: true });
      } catch (e) { return json(res, 422, { error: e.message }); }
    }

    if (vag === '/api/svar/skicka') {
      if (!franFonstret()) return json(res, 403, { error: tx('srv.svar.baraKnappen') });
      const lage = Svar.skickaLage(installningar);
      if (!lage) return json(res, 409, { error: tx('srv.svar.valjForst'), kod: 'valj' });
      if (lage === 'aldrig') return json(res, 409, { error: tx('srv.svar.lageMail'), kod: 'mail' });
      const r = fryst();
      if (r.error) return json(res, r.kod, { error: r.error, kod: r.fel });
      const k = svarsko.begar({ ...r.p, nyckel: String(kropp.nyckel || '') || null, hash: String(kropp.hash) });
      if (k.fel) return json(res, 409, { error: tx(`srv.svar.ko.${k.fel}`), kod: k.fel });
      return json(res, 202, { id: k.post.id, kvarMs: Math.max(0, k.post.skickasMs - Date.now()), igen: Boolean(k.igen) });
    }

    if (vag === '/api/svar/angra') {
      if (!franFonstret()) return json(res, 403, { error: tx('srv.svar.baraKnappen') });
      return json(res, 200, { angrat: svarsko.angra(String(kropp.id || '')) });
    }

    if (vag === '/api/svar/prov') {
      if (!PROV_SVAR) return json(res, 404, { error: tx('srv.fel.okandVag') });
      if (kropp.fel) svarProv.fel = String(kropp.fel);
      if (kropp.forslag) {
        const f = Svar.nyttForslag({ brev: { id: kropp.forslag.brevId || randomUUID(), fran: kropp.forslag.fran || 'Prov <prov@example.com>',
          amne: kropp.forslag.amne || 'Prov', namn: kropp.forslag.namn || 'Prov', text: kropp.forslag.brevtext || '' },
          konto: String(kropp.forslag.konto || 'Prov'), lada: String(kropp.forslag.lada || 'INBOX'),
          etikett: Konton.etikettUr(kropp.forslag.etikett), text: kropp.forslag.text || '', session: kropp.forslag.session || null });
        svarsforslag.push(f); await sparaSvarsforslag();
        if (kropp.kort) {
          const s = await inkorgsSamtalet();
          const provTur = { id: randomUUID(), tid: f.skapad, fraga: '', av: 'maximus', avAgenten: true, status: 'klar', svar: '', kvitto: [], kallor: [],
            sager: tx('srv.svar.rad', { namn: f.namn || f.till, amne: f.original }), svarsforslag: f };
          s.turer.push(provTur); s.andrad = provTur.tid; f.session = s.id;
          await spara(s); await sparaSvarsforslag();
          sand(s.id, { typ: 'agenttur', session: s.id, tur: provTur });
          sandAlla({ typ: 'lista' });
          return json(res, 201, { forslag: f, session: s.id });
        }
        return json(res, 201, { forslag: f });
      }
      return json(res, 200, { skript: svarProv.skript, sant: svarProv.skickade });
    }

    if (vag === '/api/kalender/oppna') {
      if (!Kalender.finns()) return json(res, 400, { error: tx('srv.fel.kalenderBaraMac') });
      const h = kropp.handelse || null;
      if (!h?.rubrik) return json(res, 422, { error: tx('srv.kalender.ingenHandelse') });

      const text = Kalender.somText(h);
      const s = { id: randomUUID(), titel: String(h.rubrik).slice(0, 60),
        skapad: new Date().toISOString(), agare: jag?.id || null,
        turer: [], karta: [], raknare: {},
        ursprung: { sort: 'möte', rubrik: h.rubrik || null, start: h.start || null,
                    deltagare: Array.isArray(h.deltagare) ? h.deltagare.slice(0, 20) : [] },
        etiketter: [Konton.kalenderFor(agentInst().kalender, { kalender: String(h.kalender || ''), kalenderId: h.kalenderId || null }).etikett].filter(Boolean),
        lage: installningar.lage, webb: installningar.webb || 'av' };

      const f = await forbered(text, { karta: [], raknare: {}, sorter: galler(installningar) });
      s.karta = f.karta;
      s.raknare = f.raknare;
      s.filer = [{ id: randomUUID(), namn: tx('srv.kalender.bilagaNamn', { rubrik: String(h.rubrik).slice(0, 50) }),
        sort: 'möte', tecken: text.length, tid: new Date().toISOString(),
        original: text, maskerad: f.maskerad, dolda: f.nya.length }];

      sessioner.set(s.id, s);
      await spara(s);
      const { original, ...utanOriginal } = s.filer[0];
      return json(res, 201, { session: s.id, titel: s.titel, fil: utanOriginal,
        klass: klassaInfo(text, { funna: f.nya, rojning: f.rojning }) });
    }

    if (vag === '/api/projekt') {
      const namn = String(kropp.namn || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (kropp.bort) {
        projekt = projekt.filter(p => p.id !== kropp.id);
        for (const x of sessioner.values()) if (x.projekt === kropp.id) { delete x.projekt; await spara(x); }
        await sparaProjekt();
        return json(res, 200, { projekt });
      }
      if (!namn) return json(res, 422, { error: tx('srv.projekt.behoverNamn') });
      const mal = String(kropp.mal || '').replace(/\s+/g, ' ').trim().slice(0, 400);
      const frist = /^\d{4}-\d{2}-\d{2}$/.test(String(kropp.frist || '')) ? kropp.frist : null;
      if (kropp.id) {
        const p = projekt.find(x => x.id === kropp.id);
        if (!p) return json(res, 404, { error: tx('srv.projekt.finnsInte') });
        p.namn = namn;
        if ('mal' in kropp) p.mal = mal;
        if ('frist' in kropp) p.frist = frist;
      } else {
        projekt.push({ id: randomUUID(), namn, mal, frist, skapad: new Date().toISOString() });
      }
      await sparaProjekt();
      return json(res, 200, { projekt });
    }

    if (vag === '/api/agent/lage') {
      if (nekas(res, 'agentLage')) return;
      const lage = String(kropp.lage || '');
      if (!Bakgrund.LAGEN.includes(lage)) return json(res, 422, { error: tx('srv.fel.okantLage') });
      if (lage !== 'oppen' && !Bakgrund.finns()) return json(res, 422, { error: tx('srv.fel.baraMac') });
      const o = { data: dataDir, node: process.execPath, server: HAR, resurser: process.env.MAXIMUS_RESURSER || '',
        port: PORT, stig: process.env.PATH || '/usr/bin:/bin', app: process.env.MAXIMUS_APP || '', dold: kropp.dold === true };
      try {
        for (const sort of ['bakgrund', 'inloggning']) if (sort !== lage) await Bakgrund.slaAv(sort, { data: dataDir });
        if (lage === 'inloggning') {
          if (!o.app) return json(res, 422, { error: tx('srv.agent.appSokvagOkand') });
          await Bakgrund.slaPa('inloggning', { ...o, ladda: false });
        }
        if (lage === 'bakgrund') await Bakgrund.slaPa('bakgrund', o);
        if (lage === 'bakgrund') await writeFile(join(dataDir, 'bakgrund'), '1');
        else await unlink(join(dataDir, 'bakgrund')).catch(() => {});
      } catch (e) { return json(res, 500, { error: tx('srv.agent.kundeInteAndra', { fel: e.message }) }); }
      installningar = { ...installningar, agentStart: lage, agentDold: o.dold };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      return json(res, 200, { lage, dold: o.dold });
    }

    if (vag === '/api/agent/samtal') {
      if (maximus.skyddat && !maximus.upplast) return json(res, 423, { error: tx('srv.fel.maximusLast') });
      const s = await agentSamtalet();
      return json(res, 200, { id: s.id });
    }

    if (vag === '/api/agent/forsta') {
      if (maximus.skyddat && !maximus.upplast) return json(res, 423, { error: tx('srv.fel.maximusLast') });
      if (!agentBehov().klar) return behovSvar(res);
      const s = await agentSamtalet();
      const tid = new Date().toISOString();
      const gtur = { id: randomUUID(), tid, fraga: tx('srv.forsta.fraga'), svar: '', status: 'igang', av: 'maximus', avAgenten: true,
        sager: tx('srv.forsta.sager'), kvitto: [], kallor: [] };
      s.turer.push(gtur); s.andrad = tid; await spara(s);
      sand(s.id, { typ: 'agenttur', session: s.id, tur: gtur });
      sandAlla({ typ: 'lista' });
      json(res, 200, { session: s.id, tur: gtur.id });
      try {
        const vem = Profil.somText(installningar.profil) || '';
        const r = await agentSlinga({ session: s.id, tur: gtur.id, obevakad: true, betrodd: { uppgift: true, sammanhang: true },
          sammanhang: vem ? tx('srv.forsta.omAnvandaren', { vem }) : '',
          uppgift: tx('srv.forsta.uppgift'),
          onSteg: st => { gtur.insikt = Grunden.insiktFor(st); sand(s.id, { typ: 'steg', turId: gtur.id, steg: 'verktyg', text: st.verktyg }); } });
        gtur.svar = r.svar;
        gtur.insikt = tx('srv.forsta.insikt');
        const f = await verktygsanrop({ meddelanden: [
          { role: 'system', content: tx('srv.forsta.forslagSystem') },
          { role: 'user', content: `${vem ? `${tx('srv.forsta.omAnvandaren', { vem })}\n\n` : ''}${tx('srv.forsta.forslagPrompt', { svar: r.svar })}` },
        ], verktyg: [], tak: 500 }).catch(() => ({ text: '' }));
        let forslag = [];
        try { forslag = (JSON.parse(/\{[\s\S]*\}/.exec(f.text)?.[0] || '{}').forslag || []).filter(x => x?.text).slice(0, 3)
          .map(x => ({ titel: String(x.titel || x.text).slice(0, 60), text: String(x.text).slice(0, 240) })); } catch { forslag = []; }
        gtur.forslag = forslag;
        delete gtur.insikt;
        gtur.status = 'klar';
        gtur.kvitto = [{ tid: new Date().toISOString(), aktor: tx('srv.liggare.aktorAgenten'), lokalt: true, ms: 0,
          vad: r.steg.length ? tx('srv.kvitto.laste', { verktyg: [...new Set(r.steg.filter(x => !x.fel).map(x => x.verktyg))].join(', ') || tx('srv.kvitto.ingenting') }) : tx('srv.kvitto.lasteIngenting') }];
      } catch (e) { gtur.svar = tx('srv.forsta.fel', { fel: e.message }); gtur.status = 'klar'; }
      await spara(s);
      sand(s.id, { typ: 'agenttur', session: s.id, tur: gtur });
      sandAlla({ typ: 'lista' });
      notifiera(tx('srv.forsta.fraga'), tx('srv.notis.forstaText'), s.id);
      return;
    }

    const mHandling = /^\/api\/handlingar\/([\w-]+)(\/angra)?$/.exec(vag);
    if (mHandling) {
      const f = handlingar.find(x => x.id === mHandling[1]);
      if (!f) return json(res, 404, { error: tx('srv.handling.finnsInte') });
      if (maximus.skyddat && !maximus.upplast) return json(res, 423, { error: tx('srv.fel.maximusLast') });
      if (mHandling[2]) {
        try { await Handlingar.angra(f, handlingsvagar()); f.status = 'angrad'; }
        catch (e) { return json(res, 422, { error: e.message }); }
        await sparaHandlingar(); await speglaHandling(f);
        return json(res, 200, { handling: f });
      }
      if (f.status !== 'vantar') return json(res, 409, { error: tx('srv.handling.redanBesvarat'), handling: f });
      if (kropp.svar === 'nej') { f.status = 'nej'; await sparaHandlingar(); await speglaHandling(f); return json(res, 200, { handling: f }); }
      if (kropp.svar !== 'ja') return json(res, 422, { error: tx('srv.handling.svaraJaNej') });
      return json(res, 200, { handling: await utforHandling(f) });
    }

    if (vag === '/api/uppdrag/bakgrund') {
      const fraga = String(kropp.fraga || '').trim().slice(0, 300);
      if (fraga.length < 4) return json(res, 422, { error: tx('srv.bakgrund.vadLeta') });
      if (maximus.skyddat && !maximus.upplast) return json(res, 423, { error: tx('srv.fel.maximusLast') });
      if (!agentBehov().klar) return behovSvar(res);
      if (!(installningar.agent?.sidor) && installningar.webb === 'av') return json(res, 409, { error: tx('srv.bakgrund.ingenWebb'), saknar: ['amne'] });
      const u = Uppdrag.nyttUppdrag({ instruktion: tx('srv.bakgrund.instruktion', { fraga }), titel: fraga.slice(0, 70),
        kallor: [{ typ: 'sok', fraga, varor: arVarufraga(fraga), antal: onskatAntal(fraga) }], aterkommande: false });
      uppdrag.push(u);
      await sparaUppdrag();
      sandAlla({ typ: 'lista' });
      slaHjarta({ bara: u.id }).catch(e => console.log(`  bakgrund: ${e.message}`));
      return json(res, 200, { id: u.id, titel: u.titel });
    }

    const mUndersok = /^\/api\/fynd\/([\w-]+)\/undersok$/.exec(vag);
    if (mUndersok) {
      const f = fynd.find(x => x.id === mUndersok[1]);
      if (!f) return json(res, 404, { error: tx('srv.fynd.finnsInte') });
      if (maximus.skyddat && !maximus.upplast) return json(res, 423, { error: tx('srv.fel.maximusLast') });
      const fore = f.undersokning && sessioner.get(f.undersokning);
      if (fore && !(fore.las?.styrka === 'forseglad') && !fore.las) return json(res, 200, { session: f.undersokning, redan: true });
      const p = undersokFynd(f).catch(e => console.log(`  undersökning: ${e.message}`));
      for (let i = 0; i < 40 && !f.undersokning; i++) await new Promise(r => setTimeout(r, 50));
      void p;
      return json(res, 200, { session: f.undersokning || null });
    }

    if (vag === '/api/agent/slinga') {
      const uppgift = String(kropp.uppgift || '').trim().slice(0, 2000);
      if (!uppgift) return json(res, 422, { error: tx('srv.agent.vadGora') });
      if (maximus.skyddat && !maximus.upplast) return json(res, 423, { error: tx('srv.fel.maximusLast') });
      try {
        const r = await agentSlinga({ uppgift, sammanhang: String(kropp.sammanhang || '').slice(0, 4000) });
        return json(res, 200, r);
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    if (vag === '/api/moln') {
      if (nekas(res, 'molnModell', {}, jag)) return;
      if (kropp.baraMaskering) {
        const nu = installningar.moln || { leverantor: 'berget', pa: false };
        installningar = { ...installningar, moln: { ...nu, maskering: Moln.maskeringUr(kropp.maskering) } };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        await aktiveraMoln();
        return json(res, 200, { maskering: installningar.moln.maskering });
      }
      const lage = Moln.lageUr({ ...(installningar.moln || {}), ...kropp, pa: kropp.pa === true });
      if (!lage) return json(res, 422, { error: tx('srv.moln.valjLeverantor') });
      try { if (kropp.nyckel) await Moln.sparaNyckel(lage.leverantor, kropp.nyckel); }
      catch (e) { return json(res, 422, { error: e.message }); }
      if (lage.pa && !(await Moln.lasNyckel(lage.leverantor))) return json(res, 422, { error: tx('srv.moln.laggInNyckel', { leverantor: Moln.LEVERANTORER[lage.leverantor].namn }) });
      installningar = { ...installningar, moln: lage };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      await aktiveraMoln();
      let prov = null;
      if (lage.pa) {
        try { const r = await verktygsanrop({ meddelanden: [{ role: 'user', content: tx('srv.moln.provPrompt') }], tak: 10, timeout: 30000 }); prov = { ok: true, svar: r.text.slice(0, 40) }; }
        catch (e) {
          prov = { ok: false, fel: e.message };
          installningar = { ...installningar, moln: { ...lage, pa: false } };
          await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
          await aktiveraMoln();
        }
      }
      sandAlla({ typ: 'moln', pa: molnPa(), namn: molnNamn() });
      return json(res, 200, { lage: Moln.lageUr(installningar.moln), pa: molnPa(), namn: molnNamn(), prov });
    }
    const mMolnGlom = /^\/api\/moln\/([a-z]+)\/glom$/.exec(vag);
    if (mMolnGlom && Moln.arLeverantor(mMolnGlom[1])) {
      if (nekas(res, 'molnKort', {}, jag)) return;
      await Moln.glomNyckel(mMolnGlom[1]);
      if (installningar.moln?.leverantor === mMolnGlom[1]) {
        installningar = { ...installningar, moln: { ...installningar.moln, pa: false } };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        await aktiveraMoln();
      }
      return json(res, 200, { glomd: mMolnGlom[1], pa: molnPa() });
    }
    if (vag === '/api/moln/forhandsgranska') {
      const text = String(kropp.text || '').slice(0, 2000);
      await Namnmodell.forbered([text]).catch(() => {});
      const { meddelanden, antal } = Moln.maskeraMeddelanden([{ role: 'user', content: text }], { niva: kropp.maskering });
      return json(res, 200, { ut: meddelanden[0].content, antal, maskering: Moln.maskeringUr(kropp.maskering) });
    }
    if (vag === '/api/moln/openrouter/logga-in') {
      if (nekas(res, 'molnModell', {}, jag)) return;
      const p = Moln.paborjaInloggning({ tillbaka: `http://localhost:${PORT}/moln/openrouter` });
      molnInloggning = { ...p, maskering: Moln.maskeringUr(kropp.maskering ?? installningar.moln?.maskering) };
      execFileCb('/usr/bin/open', [p.url], () => {});
      return json(res, 200, { url: p.url });
    }
    if (vag === '/api/nyheter/pa') {
      const pa = kropp.pa === true;
      installningar = { ...installningar, agent: agentUr({ ...(installningar.agent || {}), nyheter: pa }) };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      const u = await sakerstallNyheter();
      if (!pa && u) { uppdrag.splice(uppdrag.indexOf(u), 1); await sparaUppdrag(); }
      if (pa && !u) return json(res, 422, { error: tx('srv.nyheter.vetInteIntresse') });
      if (pa && u) slaHjarta({ bara: u.id }).catch(e => console.log(`  nyheter: ${e.message}`));
      return json(res, 200, { pa, amnen: Nyheter.amnenUr(Profil.las(installningar.profil) || {}) });
    }
    const mNyhetSamtal = /^\/api\/sessioner\/([\w-]+)\/nyhet$/.exec(vag);
    if (mNyhetSamtal) {
      const ss = minSession(mNyhetSamtal[1], jag);
      const f = fynd.find(x => x.id === String(kropp.fynd || ''));
      if (!ss || !f) return json(res, 404, { error: tx('srv.fel.finnsInte') });
      ss.nyhet = { fynd: f.id, titel: f.titel, url: f.url };
      await spara(ss);
      return json(res, 200, { nyhet: ss.nyhet });
    }
    const mNyhetBifoga = /^\/api\/nyheter\/([\w-]+)\/bifoga$/.exec(vag);
    if (mNyhetBifoga) {
      const f = fynd.find(x => x.id === mNyhetBifoga[1] && (uppdrag.find(u => u.id === x.uppdrag)?.nyheter || (x.publik === true && !x.brev)));
      const sess = minSession(String(kropp.session || ''), jag);
      if (!f?.url || !sess) return json(res, 404, { error: tx('srv.nyheter.ellerSamtalFinnsInte') });
      let r = null;
      try { r = await hamtaSida(f.url, { tecken: 16000, liggare: p => liggare({ ...p, anvandare: jag?.id || null, session: sess.id, aktor: tx('srv.helig.nyheterTitel') }) }); } catch {  }
      const titel = String(r?.titel || f.titel || tx('srv.nyheter.reservTitel')).slice(0, 160);
      const reserv = f.brev ? '' : String(f.text || '');
      const text = `${titel}\n${f.url}\n${f.fran ? `${tx('srv.nyheter.kalla', { fran: f.fran })}\n` : ''}\n${String(r?.text || reserv)}`;
      const fil = { id: randomUUID(), namn: `${titel.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80)}.txt`, sort: 'webbsida (publik)', tecken: text.length,
        tid: new Date().toISOString(), original: text, maskerad: text, dolda: 0, omaskerad: true, publik: { url: f.url, fran: f.fran || null } };
      (sess.filer ||= []).push(fil);
      sess.nyhet = { fynd: f.id, titel: f.titel, url: f.url };
      f.sett = true;
      await spara(sess); await sparaFynd();
      const { original, ...utan } = fil; void original;
      return json(res, 201, utan);
    }
    const mNyhet = /^\/api\/nyheter\/([\w-]+)\/las$/.exec(vag);
    if (mNyhet) {
      const f = fynd.find(x => x.id === mNyhet[1] && uppdrag.find(u => u.id === x.uppdrag)?.nyheter);
      if (!f?.url) return json(res, 404, { error: tx('srv.nyheter.finnsInte') });
      try {
        const r = await hamtaSida(f.url, { tecken: 16000, liggare: p => liggare({ ...p, anvandare: jag?.id || null, session: null, aktor: tx('srv.helig.nyheterTitel') }) });
        f.sett = true; await sparaFynd();
        return json(res, 200, { titel: r?.titel || f.titel, url: f.url, fran: f.fran, text: String(r?.text || (f.brev ? '' : f.text) || '') });
      } catch (e) { return json(res, 200, { titel: f.titel, url: f.url, fran: f.fran, text: f.brev ? '' : String(f.text || ''), fel: e.message }); }
    }
    const mMallBort = /^\/api\/mallar\/(presentation|dokument)\/bort$/.exec(vag);
    if (mMallBort) {
      await unlink(mallfil(mMallBort[1], jag?.id)).catch(() => {});
      return json(res, 200, { sort: mMallBort[1], borta: true });
    }
    if (vag === '/api/telefon/prova') {
      try { return json(res, 200, await tillTelefonen(tx('srv.telefon.provTitel'), tx('srv.telefon.provText'), { prov: true })); }
      catch (e) { return json(res, 422, { error: e.message }); }
    }
    if (vag === '/api/notis/system') {
      if (installningar.agentNotiser !== false) systemnotis(kropp.titel, kropp.text);
      return json(res, 200, { ok: true });
    }

    if (vag === '/api/oppna-installning') {
      const adr = { fda: Meddelanden.FDA_URL, filer: 'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders',
        paminnelser: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Reminders',
        kalender: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars',
        automation: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation' }[String(kropp.vad || '')];
      if (!adr) return json(res, 422, { error: tx('srv.fel.okandInstallning') });
      const { fil, argument } = oppnaKommando(adr);
      spawn(fil, argument, { stdio: 'ignore', detached: true }).unref();
      return json(res, 200, { ok: true });
    }

    if (vag === '/api/tillstand') {
      const id = String(kropp.id || ''), svar = String(kropp.svar || '');
      const d = { konto: String(kropp.konto || '').slice(0, 120), lada: String(kropp.lada || 'INBOX').slice(0, 120),
        mapp: String(kropp.mapp || '').slice(0, 120), sokvag: String(kropp.sokvag || '').slice(0, 500) };
      if (d.sokvag) d.namn = Mappar.namnPa(d.sokvag);
      if (Array.isArray(kropp.konton)) d.konton = kropp.konton.slice(0, 12);
      if (Array.isArray(kropp.kalendrar)) d.kalendrar = kropp.kalendrar.slice(0, 30);
      if ('etikett' in kropp) d.etikett = Konton.etikettUr(kropp.etikett);
      const b = Tillstand.beslut(id, svar, d);
      if (!b.ok) return json(res, 422, { error: b.fel });
      if (id === 'mapp' && svar === 'ja') {
        try { await Mappar.filer(d.sokvag, { antal: 1, last: 0 }); }
        catch (e) { return json(res, 422, { error: e.message, tillstand: Boolean(e.tillstand) }); }
      }
      const agent = agentUr(Tillstand.agentEfter(installningar.agent, id, svar, d));
      const rad = { id, svar, skal: b.skal, nar: new Date().toISOString() };
      installningar = { ...installningar, agent, tillstand: [...(installningar.tillstand || []), rad].slice(-200) };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      stallHjartat();
      return json(res, 200, { beslut: rad, agent, tillstand: Tillstand.lage(agent) });
    }

    if (vag === '/api/start/hamta') {
      if (startHamtar || hamtarNu) return json(res, 409, { error: tx('srv.start.hamtningPagar') });
      const tid = String(kropp.tanker || '');
      const hid = kropp.hor === null ? null : String(kropp.hor || '');
      const egen = kropp.egen === true && installningar.modellfil;
      const molnet = kropp.moln === true && molnPa();
      if (!egen && !molnet && !Modeller.modell(tid)) return json(res, 404, { error: tx('srv.modeller.okand') });
      if (hid && !['svensk', 'snabb', 'egen'].includes(hid)) return json(res, 404, { error: tx('srv.start.okandLyssnare') });
      if (hid === 'egen' && !installningar.orafil) return json(res, 422, { error: tx('srv.start.valjFilen') });
      startHamtar = { tanker: molnet ? 'moln' : egen ? 'egen' : tid, hor: hid };
      const sand = (vem, h) => sandAlla({ typ: 'start', vem, ...h });
      const spara = () => maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      const fel = {};

      const tanker = egen || molnet ? Promise.resolve().then(() => sand('tanker', { andel: 1, klar: true, redan: true }))
        : (async () => {
          hamtarNu = tid;
          try {
            const r = await hamtaModell(tid, { onFramsteg: f => sand('tanker', f), liggare: hamtningsliggare(jag) });
            satModellfil(r.vag);
            installningar = { ...installningar, modell: tid, modellfil: null };
            await spara();
            sand('tanker', { andel: 1, klar: true, redan: r.redan });
          } catch (e) { fel.tanker = e.message; sand('tanker', { fel: e.message }); }
          finally { hamtarNu = null; }
        })();

      const hor = !hid ? Promise.resolve().then(() => sand('hor', { andel: 1, klar: true, bortvald: true }))
        : hid === 'egen' ? Promise.resolve().then(() => sand('hor', { andel: 1, klar: true, redan: true }))
        : (async () => {
          try {
            const r = await hamtaOrat({ id: hid, onFramsteg: f => sand('hor', f), liggare: hamtningsliggare(jag) });
            satOra(hid);
            installningar = { ...installningar, ora: hid };
            await spara();
            sand('hor', { andel: 1, klar: true, redan: r.redan });
            sandAlla({ typ: 'orat', ...(await orat()) });
          } catch (e) { fel.hor = e.message; sand('hor', { fel: e.message }); }
        })();

      if (process.platform === 'darwin' && installningar.namnmodell !== false) {
        Namnmodell.hamtaNamnmodell({ liggare: hamtningsliggare(jag) })
          .catch(e => console.log(`  namnmodellen: hämtningen gick inte (${e.message}) — bara reglerna gäller`));
      }
      Promise.all([tanker, hor]).then(async () => {
        if (!fel.tanker) {
          installningar = { ...installningar, klar: true, modellval: { tanker: startHamtar.tanker, hor: hid,
            nar: new Date().toISOString() } };
          await spara();
        }
        sand('alla', { klar: !fel.tanker, fel: fel.tanker || fel.hor || null });
      }).finally(() => { startHamtar = null; });
      return json(res, 202, { tanker: startHamtar.tanker, hor: hid });
    }

    if (vag === '/api/start/egetora') {
      const v0 = String(kropp.vag || '').trim();
      const v = v0.startsWith('/') ? await realpath(v0).catch(() => v0) : v0;
      const st = await lstat(v).catch(() => null);
      const forst = Start.provaEgetOra(v, st);
      if (!forst.ok) return json(res, 422, { error: forst.skal });
      let huvud = '';
      try { const fh = await open(v, constants.O_RDONLY | constants.O_NONBLOCK); try { const b = Buffer.alloc(4); await fh.read(b, 0, 4, 0); huvud = b.toString('latin1'); } finally { await fh.close(); } }
      catch { return json(res, 422, { error: tx('srv.start.filenOlasbar') }); }
      const p = Start.provaEgetOra(v, st, huvud);
      if (!p.ok) return json(res, 422, { error: p.skal });
      satEgetOra(p.vag);
      installningar = { ...installningar, orafil: p.vag };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      sandAlla({ typ: 'orat', ...(await orat()) });
      return json(res, 200, p);
    }
    if (vag === '/api/start/egen') {
      const v = String(kropp.vag || '').trim();
      const p = Start.provaEgen(v, await stat(v).catch(() => null));
      if (!p.ok) return json(res, 422, { error: p.skal });
      satModellfil(p.vag);
      installningar = { ...installningar, modellfil: p.vag, modell: Modeller.modellAvFil(p.vag)?.id || null };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      return json(res, 200, p);
    }

    if (vag === '/api/sessioner/manus') {
      const rader = (Array.isArray(kropp.rader) ? kropp.rader : []).slice(0, 120)
        .filter(r => r && (r.av === 'du' || r.av === 'maximus') && String(r.text || '').trim())
        .map(r => ({ av: r.av, text: String(r.text).slice(0, 20000) }));
      if (!rader.length) return json(res, 422, { error: tx('srv.manus.tomt') });
      const tid = new Date().toISOString();
      const kvitto = [{ tid, aktor: 'Maximus', lokalt: true, ms: 0,
        vad: tx('srv.manus.kvitto') }];
      const turer = [];
      for (const r of rader) {
        if (r.av === 'du' || !turer.length) turer.push({ id: randomUUID(), tid, status: 'klar', lokalt: true,
          fraga: r.av === 'du' ? r.text : '', svar: '', kvitto, kallor: [], anmarkningar: [], manus: true });
        if (r.av === 'maximus') { const t = turer.at(-1); t.svar = t.svar ? `${t.svar}\n\n${r.text}` : r.text; }
      }
      const s = { id: randomUUID(), titel: String(kropp.titel || tx('srv.manus.titel')).slice(0, 90), dopt: true,
        skapad: tid, andrad: tid, agare: jag?.id || null, turer, karta: [], raknare: {},
        behandling: Behandling.stall(installningar.behandling), persona: installningar.persona || PERSONA_FORVAL,
        webb: installningar.webb || 'av', minne: 'isolerat' };
      sessioner.set(s.id, s); await spara(s);
      sandAlla({ typ: 'lista' });
      return json(res, 201, { id: s.id, titel: s.titel, turer: turer.length });
    }

    if (vag === '/api/villkor') {
      const v = await Villkor.las();
      if (kropp.godkann !== true || Number(kropp.version) !== v.version)
        return json(res, 422, { error: tx('srv.villkor.godkannVersion', { v: v.version }), version: v.version });
      installningar = { ...installningar, villkor: Villkor.godkannande(v.version) };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      return json(res, 200, { villkor: installningar.villkor, godkant: true });
    }

    if (vag === '/api/rensa') {
      if (kropp.bekrafta !== 'rensa') return json(res, 422, { error: tx('srv.rensa.bekrafta') });
      const allt = far(jag, 'rensaAllt');
      const kvar = [];
      let samtal = 0;
      for (const x of [...sessioner.values()]) {
        if (!egen(x, jag)) continue;
        const fel = await taBortSession(x);
        if (fel) kvar.push(fel); else samtal++;
      }
      const svar = { samtal, projekt: 0, uppdrag: 0, fynd: 0, frister: 0, bevakningar: 0 };
      if (allt) {
        svar.projekt = projekt.length; projekt = []; await sparaProjekt();
        svar.uppdrag = uppdrag.length; uppdrag = []; await sparaUppdrag();
        svar.fynd = fynd.length + undanlagt.length; fynd = []; undanlagt = []; await sparaFynd();
        agentspar = []; await sparaSpar();
        agentbegaran = [];
        svar.frister = frister.length; frister = []; await sparaFrister();
        svar.bevakningar = bevakningar.length; bevakningar = []; await sparaBevakning();
        await unlink(join(dataDir, 'hjalpfragor.json')).catch(() => {});
      }
      sandAlla({ typ: 'lista' });
      sandAlla({ typ: 'agent' });
      sandAlla({ typ: 'bevakning' });
      return json(res, kvar.length ? 500 : 200, { ...svar, kvar, liggarenKvar: true,
        ...(kvar.length ? { error: tx('srv.rensa.kundeInteRadera', { n: kvar.length, fel: kvar[0] }) } : {}) });
    }

    if (vag === '/api/frister/ny') {
      const f = kropp.frist || {};
      const start = String(kropp.start || '').slice(0, 10);
      const forfaller = Frister.forfaller(f, start);
      if (!forfaller) return json(res, 422, { error: tx('srv.frist.startdatum') });
      const id = `${Frister.nyckelnFor(f)}|${start}`;
      if (!frister.some(x => x.id === id)) {
        frister.unshift({ id, ...f, start, forfaller, session: kropp.session || null,
          sessionstitel: kropp.titel || null, skapad: new Date().toISOString() });
        await sparaFrister();
        sandAlla({ typ: 'bevakning' });
      }
      return json(res, 200, { ok: true, forfaller });
    }

    if (vag === '/api/frister/lag') {
      const f = frister.find(x => x.id === kropp.id);
      if (!f) return json(res, 404, { error: tx('srv.frist.finnsInte') });
      if (kropp.vad === 'klar') f.klar = new Date().toISOString();
      else if (kropp.vad === 'bort') frister = frister.filter(x => x.id !== f.id);
      else if (kropp.vad === 'start') {
        f.start = String(kropp.start || '').slice(0, 10);
        f.forfaller = Frister.forfaller(f, f.start) || f.forfaller;
      }
      await sparaFrister();
      sandAlla({ typ: 'bevakning' });
      return json(res, 200, { ok: true });
    }

    if (vag === '/api/bevakning/dela') {
      const valda = Array.isArray(kropp.ids) && kropp.ids.length
        ? bevakningar.filter(b => kropp.ids.includes(b.id))
        : bevakningar.filter(b => !b.av);
      if (!valda.length) return json(res, 422, { error: tx('srv.bevakning.ingaAttDela') });
      const kod = Dela.foreslaKod();
      const fil = await Dela.paketeraBevakningar(valda, kod,
        { fran: installningar.organisation || installningar.namn || null });
      return json(res, 200, { kod, antal: valda.length,
        namn: `maximus-bevakningar-${new Date().toISOString().slice(0, 10)}${Dela.ANDELSE}`,
        fil: fil.toString('base64') });
    }

    if (vag === '/api/bevakning/kolla') {
      const r = await kollaBevakningar({ alla: kropp.alla === true });
      return json(res, 200, r);
    }

    if (vag === '/api/bevakning/lag') {
      const b = bevakningar.find(x => x.id === kropp.id);
      if (!b) return json(res, 404, { error: tx('srv.bevakning.finnsInte') });
      if (kropp.vad === 'last') for (const t of b.traffar || []) t.last = true;
      else if (kropp.vad === 'av') b.av = true;
      else if (kropp.vad === 'pa') b.av = false;
      else if (kropp.vad === 'bort') bevakningar = bevakningar.filter(x => x.id !== b.id);
      await sparaBevakning();
      return json(res, 200, { ok: true });
    }

    if (vag === '/api/modell/syn') {
      const m = Modeller.modellAvFil(modellfil());
      const id = String(kropp.id || m?.id || '');
      try {
        const r = await Modeller.hamtaMmproj(id, {
          onFramsteg: h => sandAlla({ typ: 'syn', ...h }), liggare: hamtningsliggare(jag),
        });
        await stoppaModell().catch(() => {});
        return json(res, 200, { ok: true, redan: r.redan, vag: r.vag });
      } catch (e) { return json(res, 422, { error: e.message }); }
    }

    if (vag === '/api/vag/prova') {
      const val = { vag: kropp.vag || 'direkt', adress: kropp.adress || '',
        anvandare: kropp.anvandare || '', losenord: kropp.losenord || '' };
      const r = await Vag.prova(val, { startaWebblasare: egenWebblasare });
      await liggare({ anvandare: jag?.id || null,
        frontier: tx('srv.liggare.vagprov', { adress: Vag.visaAdress(val) }), vag: 'webb',
        skickat: 'ifconfig.co, check.torproject.org', mottaget: r.ip || r.fel || '',
        tecken: 0, sekunder: r.sekunder }).catch(() => {});
      return json(res, 200, r);
    }

    if (vag === '/api/installningar') {
      const GLOBALA = ['liggare', 'gallring', 'paket', 'sorter', 'vag', 'vagAdress',
        'vagAnvandare', 'vagLosenord', 'organisation', 'utanMask'];
      const rort = GLOBALA.filter(n => n in kropp);
      if (rort.length && nekas(res, 'installningar', { falt: rort.join(', ') }, jag)) return;
      delete kropp.villkor;
      delete kropp.modellfil; delete kropp.modellval;
      delete kropp.tillstand;
      delete kropp.moln;
      for (const f of utokning?.installningar || []) delete kropp[f];
      delete kropp.harVagLosenord;
      if ('persona' in kropp && !PERSONAS[kropp.persona]) kropp.persona = PERSONA_FORVAL;
      if ('motor' in kropp && kropp.motor !== null
        && !['samtal', 'agent'].includes(kropp.motor)) delete kropp.motor;
      if ('agent' in kropp) kropp.agent = agentUr(kropp.agent);
      if ('handlingar' in kropp) kropp.handlingar = Object.fromEntries(Object.entries(kropp.handlingar && typeof kropp.handlingar === 'object' ? kropp.handlingar : {})
        .filter(([k, v]) => (Handlingar.HANDLINGAR[k] && Handlingar.SPAKAR.includes(v)) || (k === 'skickasvar' && Svar.SKICKALAGEN.includes(v))));
      if ('svar' in kropp) {
        const v = kropp.svar && typeof kropp.svar === 'object' ? kropp.svar : {};
        const sig = { ...(installningar.svar?.signaturer || {}) };
        for (const [k, n] of Object.entries(v.signaturer && typeof v.signaturer === 'object' ? v.signaturer : {})) {
          if (typeof k === 'string' && typeof n === 'string' && k.length <= 200) sig[k] = n.slice(0, 200);
        }
        kropp.svar = { forslag: Svar.FORSLAGSLAGEN.includes(v.forslag) ? v.forslag : Svar.forslagsLage(installningar), signaturer: sig };
      }
      if ('kollega' in kropp) kropp.kollega = Kollega.installningUr(kropp.kollega, installningar.kollega);
      if ('kontroll' in kropp && !Kontroll.LAGEN.includes(kropp.kontroll)) delete kropp.kontroll;
      if ('ora' in kropp) { if (!['svensk', 'snabb'].includes(kropp.ora)) delete kropp.ora; else satOra(kropp.ora); }
      if ('diktatTyst' in kropp) { const n = Number(kropp.diktatTyst); if ([0, 2, 3, 5].includes(n)) kropp.diktatTyst = n; else delete kropp.diktatTyst; }
      if ('sprak' in kropp && !(kropp.sprak === 'auto' || Sprakstod.tillgangliga().includes(kropp.sprak))) delete kropp.sprak;
      if ('profil' in kropp) kropp.profil = kropp.profil === null ? null
        : Banken.markera(installningar.profil, Profil.las(kropp.profil), { forslag: (await lasDu())?.forslag || null });
      const stallOmHjartat = 'agent' in kropp;
      installningar = { ...installningar, ...kropp };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      if (stallOmHjartat) stallHjartat();
      if (kropp.kontext) satKontext(kropp.kontext);
      if ('vag' in kropp || 'vagAdress' in kropp) {
        await satVag({ vag: installningar.vag || 'direkt', adress: installningar.vagAdress || '',
          anvandare: installningar.vagAnvandare || '', losenord: installningar.vagLosenord || '' });
      }
      return json(res, 200, { ...utanHemligheter(installningar), kontextNu: await kontextTak().catch(() => null) });
    }

    if (vag === '/api/sessioner') {
      const tom = [...sessioner.values()]
        .filter(x => (x.agare || null) === (jag?.id || null)
          && !(x.turer || []).length && !(x.filer || []).length
          && !x.fast && !x.las && !x.forseglad
          && (arNySession(x.titel) || !x.titel))
        .sort((a, b) => String(b.andrad || b.skapad).localeCompare(String(a.andrad || a.skapad)))[0];
      if (tom) {
        if (['lokalt', 'snabb', 'noggrann'].includes(kropp.lage)) tom.lage = kropp.lage;
        if (['av', 'auto', 'pa'].includes(kropp.webb)) tom.webb = kropp.webb;
        tom.minne = MINNEN.includes(kropp.minne) ? kropp.minne : 'isolerat';
        tom.skapad = new Date().toISOString();
        await spara(tom);
        return json(res, 200, tom);
      }
      const s = { id: randomUUID(), titel: tx('srv.session.nyTitel'), skapad: new Date().toISOString(),
        agare: jag?.id || null,
        turer: [], karta: [], raknare: {},
        behandling: Behandling.stall(kropp.behandling ?? installningar.behandling),
        persona: PERSONAS[kropp.persona] ? kropp.persona : (installningar.persona || PERSONA_FORVAL),
        webb: ['av', 'auto', 'pa'].includes(kropp.webb) ? kropp.webb
          : kropp.webb === true ? 'pa' : kropp.webb === false ? 'av' : (installningar.webb || 'av'),
        minne: MINNEN.includes(kropp.minne) ? kropp.minne : 'isolerat' };
      sessioner.set(s.id, s); await spara(s);
      return json(res, 201, s);
    }

async function foljerMed(sess, fraga) {
  if (!sess) return { poster: [], okant: [] };
  const poster = [];

  const historik = (sess.turer || []).filter(t => t.status === 'klar' && t.svar);
  if (historik.length) {
    const tecken = historik.reduce((n, t) => n + (t.fraga || '').length + (t.svar || '').length, 0);
    poster.push({ sort: 'historik', namn: tx('srv.foljer.historikNamn'),
      om: tx('srv.foljer.historikOm', { n: historik.length }),
      tecken, maskeras: true });
  }

  if (installningar.policy) {
    poster.push({ sort: 'policy', namn: tx('srv.foljer.policyNamn'),
      om: tx('srv.foljer.policyOm'), tecken: installningar.policy.length, maskeras: true });
  }

  for (const f of (sess.filer || [])) {
    poster.push({ sort: 'bilaga', namn: f.namn,
      om: tx('srv.foljer.bilagaOm', { n: f.dolda || 0 }), tecken: (f.maskerad || '').length, maskeras: false });
  }

  if (sess.projekt) {
    try {
      const syskon = Projekt.syskon([...sessioner.values()]
        .filter(x => (x.agare || null) === (sess.agare || null)), sess);
      const u = Projekt.underlagUr(syskon, fraga);
      if (u) {
        const namn = projekt.find(x => x.id === sess.projekt)?.namn || tx('srv.foljer.projektReserv');
        poster.push({ sort: 'projekt', namn: tx('srv.foljer.projektNamn', { namn }),
          om: tx('srv.foljer.projektOm', { n: u.bitar.length }),
          tecken: u.tecken, maskeras: true });
      }
    } catch {  }
  }

  const okant = [];
  if ((sess.webb || 'av') !== 'av') {
    okant.push(tx('srv.foljer.webbOkant'));
  }
  return { poster, okant };
}

    if (vag === '/api/forbered') {
      const f = String(kropp.fraga || '').trim();
      if (!f) return json(res, 422, { error: tx('srv.fel.skrivFraga') });
      const sess = minSession(kropp.session, jag);
      const klar = await forbered(f, { karta: sess?.karta || [], raknare: sess?.raknare || {},
        sorter: galler(installningar) });

      if (behandlingNu(sess) === 'anonym' && klar.maskerad) {
        try {
          const vagare = await skrivOm(klar.maskerad, {});
          if (vagare && vagare !== klar.maskerad) {
            const karta = new Map((klar.karta || []).map(k => [k.original, k.platshallare]));
            const raknare = new Map(Object.entries(klar.raknare || {}));
            const h = maskeraHart(vagare, { karta, raknare, sorter: galler(installningar) });
            klar.maskerad = h.skyddat.aterstall(h.text);
            klar.anonymiserad = true;
          } else {
            klar.anonymiserad = false;
            klar.anonymSkal = vagare ? tx('srv.anonym.ingetVagare') : tx('srv.anonym.forKort');
          }
        } catch (e) {
          klar.anonymiserad = false;
          klar.anonymSkal = e.message.slice(0, 120);
        }
      }
      return json(res, 200, { ...klar, foljerMed: await foljerMed(sess, f) });
    }

    if (vag === '/api/tolka') {
      const f = String(kropp.fraga || '').trim();
      if (!f) return json(res, 422, { error: tx('srv.fel.skrivFraga') });
      const sess = minSession(kropp.session, jag);
      return json(res, 200, await forbered(f, {
        tolka: true, karta: sess?.karta || [], raknare: sess?.raknare || {},
      }));
    }

    const mAnon = /^\/api\/sessioner\/([\w-]+)\/fil\/([\w-]+)\/anonymisera$/.exec(vag);
    if (mAnon) {
      const s = minSession(mAnon[1], jag);
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      if (stangd(s)) return json(res, 423, { error: tx('srv.fel.forsegladAngeKoden') });
      const f = (s.filer || []).find(x => x.id === mAnon[2]);
      if (!f) return json(res, 404, { error: tx('srv.fel.bilaganFinnsInte') });
      if (f.publik) return json(res, 409, { error: tx('srv.fel.publikKalla') });

      json(res, 202, { igang: true });
      void (async () => {
        try {
          const a = await anonymiseraStycken(f.maskerad, { baraLokalt: true, pa: h => sand(s.id, { typ: 'anonym', fil: f.id, ...h }) });
          f.anonym = a.text;
          f.anonymRojning = bedomRojning(f.anonym);
          await spara(s);
          sand(s.id, { typ: 'anonym', fil: f.id, klar: true, text: f.anonym, lamnade: a.lamnade,
            rojning: f.anonymRojning });
        } catch (e) {
          sand(s.id, { typ: 'anonym', fil: f.id, fel: e.message });
        }
      })();
      return;
    }

    const mBort = /^\/api\/sessioner\/([\w-]+)\/fil\/([\w-]+)\/bort$/.exec(vag);
    if (mBort) {
      const sess = minSession(mBort[1], jag);
      if (!sess) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      sess.filer = (sess.filer || []).filter(f => f.id !== mBort[2]);
      await spara(sess);
      return json(res, 200, { bort: true });
    }

    const mOppna = /^\/api\/sessioner\/([\w-]+)\/oppna$/.exec(vag);
    if (mOppna) {
      const s = minSession(mOppna[1], jag, { forseglad: true });
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      const kod = String(kropp.kod || '');
      if (!(await maximus.stammerKod(s.las, kod))) return json(res, 403, { error: tx('srv.session.felKod') });
      try {
        const hel = await maximus.lasSession(join(sessionsKatalog(s.agare), `${s.id}.json`), kod);
        if (s.agare) hel.agare = s.agare;
        sessioner.set(s.id, hel);
        await minnsKod(hel, kod);

        try { await spara(hel); } catch {  }

        return json(res, 200, hel);
      } catch (e) { return json(res, 422, { error: e.message }); }
    }

    const m3 = /^\/api\/sessioner\/([\w-]+)\/(arkivera|las|fast|lage|val|webb|titel|projekt|minne)$/.exec(vag);
    if (m3) {
      const s = minSession(m3[1], jag, { forseglad: true });
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });

      const varStangd = stangd(s);
      const varForseglad = Boolean(s.forseglad) || s.las?.styrka === 'forseglad';
      if (varStangd) {
        return json(res, 423, { error: tx('srv.session.forsegladAngeKod') });
      }

      if (m3[2] === 'val') {
        s.behandling = Behandling.stall(kropp.behandling ?? valet(s).behandling);
        delete s.lage;
        delete s.destination;
        await spara(s);
        return json(res, 200, { behandling: s.behandling });
      }
      if (m3[2] === 'lage') s.lage = ['lokalt', 'snabb', 'noggrann'].includes(kropp.lage) ? kropp.lage : s.lage;
      else if (m3[2] === 'titel') {
        const t = String(kropp.titel || '').replace(/\s+/g, ' ').trim().slice(0, 90);
        if (t) { s.titel = t; s.dopt = true; }
      }
      else if (m3[2] === 'webb') s.webb = ['av', 'auto', 'pa'].includes(kropp.pa) ? kropp.pa : (kropp.pa === true ? 'pa' : 'av');
      else if (m3[2] === 'arkivera' && s.helig) return json(res, 409, { error: tx('srv.grund.arkiverasInte') });
      else if (m3[2] === 'arkivera') {
        s.arkiverad = kropp.pa !== false;
        if (!s.arkiverad && s.arkiv?.av === 'agenten') s.tillbaka = true;
        if (!s.arkiverad) delete s.arkiv;
      }
      else if (m3[2] === 'minne') {
        if (!MINNEN.includes(kropp.minne)) return json(res, 422, { error: tx('srv.session.minneVal') });
        s.minne = kropp.minne;
      }
      else if (m3[2] === 'fast') s.fast = kropp.pa !== false;
      else if (m3[2] === 'projekt') {
        if (kropp.projekt) s.projekt = String(kropp.projekt);
        else delete s.projekt;
      }
      else {
        if (varForseglad && !(await maximus.stammerKod(s.las, kropp.nuvarandeKod ?? kropp.kod))) {
          return json(res, 403, { error: tx('srv.session.felKodForsegling') });
        }

        if (!kropp.kod) {
          delete s.las;
          delete s.forseglad;
          glomKod(s.id);
        } else {
          const salt = nyttSalt();
          s.las = { styrka: kropp.styrka === 'forseglad' ? 'forseglad' : 'last',
                    salt: salt.toString('base64') };
          s.las.kontroll = await maximus.kodkontroll(kropp.kod, salt);
          if (s.las.styrka === 'forseglad') await minnsKod(s, String(kropp.kod));
          else glomKod(s.id);
        }
      }
      await spara(s);
      return json(res, 200, { id: s.id, titel: s.titel || null, projekt: s.projekt || null,
        arkiverad: !!s.arkiverad, fast: !!s.fast, webb: s.webb || 'av', las: s.las?.styrka || null });
    }

    const mHandelse = /^\/api\/sessioner\/([\w-]+)\/handelse$/.exec(vag);
    if (mHandelse) {
      const s = minSession(mHandelse[1], jag);
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      const t = s.turer.find(x => x.id === kropp.tur);
      const h = t?.handelse;
      if (!h) return json(res, 404, { error: tx('srv.mote.finnsInte') });
      const mapp = join(dataDir, 'kalender');
      await mkdir(mapp, { recursive: true });
      const fil = join(mapp, `${h.id}.ics`);
      await writeFile(fil, Handelse.ics(h, { id: h.id }), { mode: 0o600 });
      if (s.delad) await karantan(fil);
      if (kropp.oppna !== false) {
        const { fil: k, argument } = oppnaKommando(fil);
        spawn(k, argument, { stdio: 'ignore', detached: true }).unref();
      }
      h.gjort = { ...(h.gjort || {}), kalender: new Date().toISOString() };
      await spara(s);
      return json(res, 200, { handelse: h });
    }

    const mPlan = /^\/api\/sessioner\/([\w-]+)\/planen$/.exec(vag);
    if (mPlan) {
      const s = minSession(mPlan[1], jag);
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      const t = s.turer.find(x => x.id === kropp.tur);
      const p = t?.planen?.find(x => x.id === kropp.plan);
      if (!p) return json(res, 404, { error: tx('srv.plan.finnsInte') });
      const nu = new Date().toISOString();
      const om = [p.vad, ...(p.forbered.length ? ['', tx('srv.plan.innanDess'), ...p.forbered.map(x => `- ${x}`)] : [])].join('\n');
      if (kropp.gor === 'projekt') {
        let pr = projekt.find(x => x.id === s.projekt);
        if (pr) { if (!pr.frist) pr.frist = p.datum; }
        else {
          pr = { id: randomUUID(), namn: (s.titel && !arNySession(s.titel) ? s.titel : p.vad).slice(0, 60),
            mal: tx('srv.trad.titelDatum', { titel: p.vad, datum: Planen.somText(p.datum) }), frist: p.datum, skapad: nu };
          projekt.push(pr);
          s.projekt = pr.id;
        }
        await sparaProjekt();
        p.gjort.projekt = { tid: nu, id: pr.id, namn: pr.namn };
        sandAlla({ typ: 'lista', agare: s.agare });
      } else if (kropp.gor === 'paminn') {
        const id = `plan|${p.id}`;
        if (!frister.some(x => x.id === id)) {
          frister.unshift({ id, vad: p.vad, start: nu.slice(0, 10), forfaller: p.datum,
            session: s.id, sessionstitel: s.titel || null, skapad: nu });
          await sparaFrister();
          sandAlla({ typ: 'bevakning' });
        }
        p.gjort.paminn = { tid: nu };
      } else if (kropp.gor === 'kalender') {
        const mapp = join(dataDir, 'kalender');
        await mkdir(mapp, { recursive: true });
        const fil = join(mapp, `${p.id}.ics`);
        await writeFile(fil, Planen.ics({ id: p.id, datum: p.datum, vad: p.vad, om }), { mode: 0o600 });
        if (kropp.oppna !== false) {
          const { fil: k, argument } = oppnaKommando(fil);
          spawn(k, argument, { stdio: 'ignore', detached: true }).unref();
        }
        p.gjort.kalender = { tid: nu };
      } else if (kropp.gor === 'forbered' || kropp.gor === 'nej') {
        p.gjort[kropp.gor] = { tid: nu };
      } else return json(res, 422, { error: tx('srv.fel.okantVal') });
      await spara(s);
      return json(res, 200, { plan: p, projekt: s.projekt || null });
    }

    const mForslag = /^\/api\/sessioner\/([\w-]+)\/uppdragsforslag$/.exec(vag);
    if (mForslag) {
      const s = minSession(mForslag[1], jag);
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      const t = s.turer.find(x => x.id === kropp.tur);
      if (!t?.uppdragsforslag) return json(res, 404, { error: tx('srv.forslag.ingetPaTuren') });
      if (t.uppdragsforslag.svar) return json(res, 409, { error: tx('srv.forslag.redanBesvarat') });
      if (kropp.svar !== 'ja' && kropp.svar !== 'nej') return json(res, 422, { error: tx('srv.handling.svaraJaNej') });
      const f = t.uppdragsforslag;
      if (kropp.svar === 'nej') {
        f.svar = 'nej';
        if (f.ord) installningar = { ...installningar, avbojt: [...new Set([...(installningar.avbojt || []), f.ord])].slice(-200) };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        await spara(s);
        return json(res, 200, { forslag: f });
      }
      if (!agentBehov().klar) return behovSvar(res);
      if (uppdrag.length >= 200) return json(res, 409, { error: tx('srv.uppdrag.tak') });
      const a = installningar.agent || {};
      const har = { epost: Boolean(a.epost?.konto), kalender: Boolean(a.kalender), anteckningar: Boolean(a.anteckningar?.mapp),
        meddelanden: Boolean(a.meddelanden), paminnelser: Boolean(a.paminnelser), samtal: Boolean(a.samtal), mapp: Boolean(a.mapp?.sokvag),
        amne: Boolean(a.sidor) || installningar.webb !== 'av' || Boolean(a.nyheter) };
      if (f.direkt && f.kallor.includes('alla')) f.kallor = Object.keys(har).filter(k => har[k] && k !== 'amne');
      if (f.direkt) {
        const saknar = f.kallor.filter(k => !har[k]);
        if (saknar.length) return json(res, 409, { error: tx('srv.forslag.inteLov'), saknar });
      }
      const kallor = f.direkt ? f.kallor : ['bevakning', ...(har.epost ? ['epost'] : []), ...(har.kalender ? ['kalender'] : []),
        ...(har.anteckningar ? ['anteckningar'] : [])];
      const engang = f.engang || kropp.takt === 'engang';
      const enligtSchema = kropp.takt === 'schema' && f.schema;
      const takt = [15, 60, 240, 1440].includes(Number(kropp.takt)) ? Number(kropp.takt) : 60;
      const u = { ...Uppdrag.nyttUppdrag({ instruktion: f.instruktion,
        kallor: kallor.map(k => (k === 'amne' ? { typ: 'amne', fraga: f.amne || f.instruktion } : k)), aterkommande: !engang,
        titel: f.amne ? `${f.amne}${f.direkt ? tx('srv.uppdrag.titelI', { var: ochLista(f.var) }) : ''}`
          : f.direkt ? (s.titel && !arNySession(s.titel) && !s.agentsamtal ? s.titel
            : s.agentsamtal ? Uppdrag.namnUr(f.instruktion) || tx('srv.uppdrag.titelBevakningAv', { var: ochLista(f.var) })
            : tx(engang ? 'srv.uppdrag.titelSokningI' : 'srv.uppdrag.titelBevakningAv', { var: ochLista(f.var) })) : f.amne,
        ...(f.direkt && !engang ? { takt } : {}),
        ...(f.direkt ? { schema: enligtSchema ? f.schema : null, filter: f.filter || null } : {}),
        projekt: projekt.some(x => x.id === s.projekt) ? s.projekt : null }),
        session: s.id,
        ursprung: { session: s.id, tur: t.id } };
      f.takt = engang ? null : (f.direkt ? takt : u.takt);
      f.valtSchema = enligtSchema ? Schema.somText(f.schema) : null;
      if (a.nyheter) for (const k of u.kallor) if (k.typ === 'amne') k.nyheter = true;
      uppdrag.push(u);
      await sparaUppdrag();
      f.svar = 'ja'; f.uppdrag = u.id;
      f.forstaVarv = { pagar: true };
      const turId = t.id;
      slaHjarta({ bara: u.id })
        .then(h => (h?.nej ? { fel: h.nej === 'pagar' ? tx('srv.forslag.forstaVarvPagar') : h.nej === 'behover' ? behovText(h.behov) : tx('srv.fel.maximusLast') } : (h?.[0] || { fel: tx('srv.forslag.ingetVarv') })))
        .catch(e => ({ fel: e.message }))
        .then(async v => {
          f.forstaVarv = { ...v, pagar: false, klart: new Date().toISOString() };
          await spara(s).catch(() => {});
          sand(s.id, { typ: 'uppdragsforslag', turId, forslag: f });
        });
      await spara(s);
      sandAlla({ typ: 'lista', agare: s.agare });
      return json(res, 200, { forslag: f, uppdrag: Uppdrag.sammandrag(u) });
    }

    const mKryss = /^\/api\/sessioner\/([\w-]+)\/kryss$/.exec(vag);
    if (mKryss) {
      const s = minSession(mKryss[1], jag);
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      const nyckel = String(kropp.nyckel || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      if (!nyckel) return json(res, 400, { error: tx('srv.kryss.punktSaknas') });
      s.kryss = s.kryss || {};
      s.kryss[nyckel] = { i: kropp.i !== false, tid: new Date().toISOString() };
      const nycklar = Object.keys(s.kryss);
      if (nycklar.length > 500) {
        nycklar.sort((a, b) => (s.kryss[a].tid < s.kryss[b].tid ? -1 : 1));
        for (const g of nycklar.slice(0, nycklar.length - 500)) delete s.kryss[g];
      }
      await spara(s);
      return json(res, 200, { kryss: s.kryss });
    }

    const mNot = /^\/api\/sessioner\/([\w-]+)\/noteringar$/.exec(vag);
    if (mNot) {
      const s = minSession(mNot[1], jag);
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      s.noteringar = Array.isArray(s.noteringar) ? s.noteringar : [];
      const id = String(kropp.id || '').slice(0, 40);

      if (kropp.bort) {
        s.noteringar = s.noteringar.filter(n => n.id !== id);
      } else {
        const passage = String(kropp.passage || '').replace(/\s+/g, ' ').trim().slice(0, 400);
        const text = String(kropp.text || '').trim().slice(0, 2000);
        if (!text) return json(res, 400, { error: tx('srv.notering.tom') });
        const fanns = id ? s.noteringar.find(n => n.id === id) : null;
        if (fanns) { fanns.text = text; fanns.andrad = new Date().toISOString(); }
        else {
          if (!passage) return json(res, 400, { error: tx('srv.notering.passageSaknas') });
          if (s.noteringar.length >= 300) {
            return json(res, 409, { error: tx('srv.notering.tak') });
          }
          const plats = /^(samtal|fil:[\w-]{1,40})$/.test(String(kropp.plats || ''))
            ? String(kropp.plats) : 'samtal';
          const platsnamn = String(kropp.platsnamn || '').replace(/\s+/g, ' ').trim().slice(0, 120);
          s.noteringar.push({ id: randomUUID(), plats, platsnamn, passage, text,
            tid: new Date().toISOString() });
        }
      }
      await spara(s);
      return json(res, 200, { noteringar: s.noteringar });
    }

    if (vag === '/api/uppdrag/rokprov') {
      const url = String(kropp.url || '').trim();
      if (!/^https?:\/\//i.test(url)) return json(res, 400, { error: tx('srv.rokprov.adress') });
      if (!agentInst().sidor) return json(res, 200, { ok: false, skal: tx('srv.rokprov.sidorAv') });
      try {
        const r = await hamtaSida(url, { tecken: 4000,
          liggare: p => liggare({ ...p, anvandare: jag?.id || null, session: null }) });
        const text = String(r?.text || r || '').trim();
        if (text.length < 80) {
          return json(res, 200, { ok: false, titel: r?.titel || null,
            skal: tx('srv.rokprov.ingenText') });
        }
        return json(res, 200, { ok: true, titel: r?.titel || null, tecken: text.length,
          smak: text.replace(/\s+/g, ' ').slice(0, 240) });
      } catch (e) {
        return json(res, 200, { ok: false, skal: e.message || tx('srv.rokprov.kundeInteHamta') });
      }
    }

    if (vag === '/api/uppdrag') {
      if (!agentBehov().klar) return behovSvar(res);
      if (typeof kropp.aterkommande !== 'boolean'
        && Uppdrag.arAterkommande(String(kropp.instruktion || '')) === null) {
        return json(res, 200, { fraga: 'aterkommande' });
      }
      try {
        const u = Uppdrag.nyttUppdrag({
          instruktion: kropp.instruktion,
          kallor: Array.isArray(kropp.kallor) ? kropp.kallor : [],
          aterkommande: typeof kropp.aterkommande === 'boolean' ? kropp.aterkommande : null,
          takt: kropp.takt,
          titel: kropp.titel,
          projekt: projekt.some(x => x.id === kropp.projekt) ? kropp.projekt : null,
        });
        if (uppdrag.length >= 200) return json(res, 409, { error: tx('srv.uppdrag.tak') });
        const urs = kropp.ursprung && minSession(String(kropp.ursprung.session || ''), jag);
        if (urs) { u.ursprung = { session: urs.id, tur: String(kropp.ursprung.tur || '') || null }; u.session = urs.id; }
        uppdrag.push(u);
        await sparaUppdrag();
        return json(res, 200, { uppdrag: Uppdrag.sammandrag(u), id: u.id });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    const mFynd = /^\/api\/agent\/fynd\/([\w-]+)\/sett$/.exec(vag);
    if (mFynd) {
      const f = fynd.find(x => x.id === mFynd[1]);
      if (!f) return json(res, 404, { error: tx('srv.fynd.finnsInte') });
      f.sett = kropp.pa !== false;
      const u = uppdrag.find(x => x.id === f.uppdrag);
      if (u) u.sett = !fynd.some(x => x.uppdrag === u.id && !x.sett);
      await sparaFynd();
      await sparaUppdrag();
      return json(res, 200, { sett: f.sett, osedda: fynd.filter(x => !x.sett).length });
    }

    if (vag === '/api/exempel/skriv') {
      const p = installningar.profil;
      if (!Sprak.garAttSkriva(p)) {
        return json(res, 200, { ok: false, skal: tx('srv.exempel.fyllProfil') });
      }
      try {
        const svar = await svaraLokalt(Sprak.prompt(p), { plats: 'agent', tak: 600, timeout: 120000 });
        const d = Sprak.las(svar);
        if (!d) return json(res, 200, { ok: false, skal: tx('srv.exempel.otydligt') });
        installningar = { ...installningar, exempel: d };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        return json(res, 200, { ok: true, ...d });
      } catch (e) {
        return json(res, 200, { ok: false, skal: e.message });
      }
    }

    if (vag === '/api/profil/forslag') {
      const mina = [...sessioner.values()].filter(x => (x.agare || null) === (jag?.id || null));
      const f = Profil.forslag({
        rubriker: mina.map(x => x.titel).filter(Boolean),
        projekt: projekt.map(x => x.namn).filter(Boolean),
      });
      if (!f) return json(res, 200, { forslag: null, skal: tx('srv.profil.forLite') });
      try {
        const svar = await svaraLokalt(Sprakstod.modellprompt([
          'Du skriver ett förslag på en kort profil åt användaren. Svara bara med JSON.',
          '',
          'Underlaget är vad personen själv döpt sina ärenden och projekt till.',
          'Gissa inte namn, arbetsplats eller något som inte står där.',
          '',
          f.underlag,
          '',
          `Svara med exakt: ${f.mall}`,
          'vem = personens roll. arbetar = vad som ligger på personens bord.',
          'vill = vad personen rimligen försöker uppnå. En kort mening var.',
        ].join('\n')), { plats: 'agent', tak: 400, timeout: 90000 });
        const d = Profil.lasForslag(svar);
        return json(res, 200, { forslag: d, underlag: f.underlag });
      } catch (e) {
        return json(res, 200, { forslag: null, skal: e.message });
      }
    }

    if (vag === '/api/agent/stada/angra') {
      const ids = Array.isArray(kropp.ids) ? kropp.ids.map(String).slice(0, 200) : [];
      let antal = 0;
      for (const id of ids) {
        const s = minSession(id, jag);
        if (!s || !s.arkiverad || s.arkiv?.av !== 'agenten') continue;
        s.arkiverad = false; s.tillbaka = true; delete s.arkiv;
        await spara(s); antal++;
      }
      const ag = await agentSamtalet();
      const rad = ag?.turer.find(t => t.stadning && ids.every(i => t.stadning.ids.includes(i)));
      if (rad) { rad.stadning.angrad = true; await spara(ag); sand(ag.id, { typ: 'agenttur', session: ag.id, tur: rad }); }
      sandAlla({ typ: 'lista' });
      return json(res, 200, { antal });
    }
    if (vag === '/api/safari/oppna-profil') {
      if (process.platform !== 'darwin') return json(res, 422, { error: tx('srv.safari.baraMac') });
      const as = (skript, timeout = 15000) => new Promise((klar, fel) => execFileCb('/usr/bin/osascript', ['-e', skript], { timeout },
        (e, o, err) => (e ? fel(new Error(String(err || e.message).trim().slice(0, 200))) : klar(String(o).trim()))));
      try {
        await as('tell application "Safari"\nactivate\nif (count of windows) = 0 then make new document\ntell front window to set current tab to (make new tab with properties {URL:"https://www.linkedin.com/in/me/"})\nend tell');
        let url = '', klar = '';
        for (let i = 0; i < 24; i++) {
          await new Promise(r => setTimeout(r, 500));
          url = await as('tell application "Safari" to return URL of current tab of front window').catch(() => '');
          klar = await as('tell application "Safari" to do JavaScript "document.readyState" in current tab of front window').catch(() => '');
          if (klar === 'complete' && url && !/\/in\/me\/?$/.test(url)) break;
        }
        await new Promise(r => setTimeout(r, 1200));
        if (klar !== 'complete') return json(res, 422, { error: tx('srv.safari.profilTimeout') });
        const s = await lasSafari();
        const profil = /linkedin\.com\/in\/(?!me\/?$)[^/?#]+/i.test(s.url);
        const inloggning = /login|authwall|checkpoint|signup/i.test(s.url);
        if (profil) execFileCb('/usr/bin/osascript', ['-e', 'tell application id "ai.aurolabs.maximus" to activate'], { timeout: 5000 }, () => {});
        return json(res, 200, { titel: s.titel || s.url, url: s.url, tecken: s.text.length, profil, inloggning });
      } catch (e) { return json(res, 422, { error: safariFel(e.message) }); }
    }
    if (vag === '/api/safari/prova') {
      try { const s = await lasSafari(); return json(res, 200, { titel: s.titel || s.url, url: s.url, tecken: s.text.length, profil: /linkedin\.com\/in\//i.test(s.url) }); }
      catch (e) { return json(res, 422, { error: e.message }); }
    }
    if (vag === '/api/agent/stada') {
      const nu = process.env.MAXIMUS_STADA_PROV === '1' && kropp.nu ? new Date(kropp.nu) : new Date();
      return json(res, 200, { arkiverade: await stada(nu, { tvinga: true }) });
    }

    if (vag === '/api/agent/allt-sett') {
      for (const f of fynd) f.sett = true;
      for (const u of uppdrag) u.sett = true;
      await sparaFynd();
      await sparaUppdrag();
      return json(res, 200, { osedda: 0 });
    }

    if (vag === '/api/agent/sla') {
      const hant = await slaHjarta();
      if (hant?.nej === 'behover') return behovSvar(res, hant.behov);
      if (hant?.nej === 'pagar') return json(res, 409, { error: tx('srv.agent.slagPagar') });
      if (hant?.nej === 'last') return json(res, 409, { error: tx('srv.fel.maximusLast') });
      return json(res, 200, { hant, osedda: fynd.filter(f => !f.sett).length });
    }

    const mKor = /^\/api\/uppdrag\/([\w-]+)\/kor$/.exec(vag);
    if (mKor) {
      if (!uppdrag.some(u => u.id === mKor[1])) return json(res, 404, { error: tx('srv.fel.uppdragFinnsInte') });
      const hant = await slaHjarta({ bara: mKor[1] });
      if (hant?.nej === 'behover') return behovSvar(res, hant.behov);
      if (hant?.nej === 'pagar') return json(res, 409, { error: tx('srv.agent.garIgenom') });
      if (hant?.nej === 'last') return json(res, 409, { error: tx('srv.fel.maximusLast') });
      return json(res, 200, { varv: hant[0] || null });
    }

    const mUppAtg = /^\/api\/uppdrag\/([\w-]+)\/(pausa|aterstall|sett|bort|andra)$/.exec(vag);
    if (mUppAtg) {
      const i = uppdrag.findIndex(x => x.id === mUppAtg[1]);
      if (i < 0) return json(res, 404, { error: tx('srv.fel.uppdragFinnsInte') });
      const vad = mUppAtg[2];

      if (vad === 'bort') uppdrag.splice(i, 1);
      else if (vad === 'pausa') uppdrag[i] = { ...uppdrag[i], tillstand: 'pausad', nasta: null };
      else if (vad === 'aterstall') uppdrag[i] = Uppdrag.aterstall(uppdrag[i]);
      else if (vad === 'sett') {
        uppdrag[i] = { ...uppdrag[i], sett: true };
        let andrat = false;
        for (const f of fynd) if (f.uppdrag === uppdrag[i].id && !f.sett) { f.sett = true; andrat = true; }
        if (andrat) await sparaFynd();
      }
      else {
        const u = { ...uppdrag[i] };
        if (typeof kropp.instruktion === 'string' && kropp.instruktion.trim()) {
          u.instruktion = kropp.instruktion.trim();
        }
        if (typeof kropp.titel === 'string') u.titel = kropp.titel.trim().slice(0, 90) || u.titel;
        if (typeof kropp.aterkommande === 'boolean') {
          u.aterkommande = kropp.aterkommande;
          if (!u.aterkommande) { u.takt = null; u.nasta = null; }
        }
        if (Number(kropp.takt) > 0 && u.aterkommande) {
          u.takt = Math.max(Math.round(Number(kropp.takt)), Uppdrag.minstaTakt(u.kallor));
          u.schema = null;
          u.nasta = new Date(Date.now() + u.takt * 60000).toISOString();
        }
        if (typeof kropp.schemaText === 'string') {
          const sc = Schema.schemaUr(kropp.schemaText);
          if (!sc) return json(res, 422, { error: tx('srv.uppdrag.ingetKlockslag') });
          u.schema = sc; u.aterkommande = true;
          u.nasta = Schema.nastaTid(sc, new Date())?.toISOString() || null;
        }
        if (kropp.aterkommande === true && !uppdrag[i].aterkommande) {
          u.aterkommande = true; u.takt = Math.max(u.takt || 1440, Uppdrag.minstaTakt(u.kallor), 1440);
          u.tillstand = 'vantar'; u.nasta = new Date(Date.now() + u.takt * 60000).toISOString();
        }
        if ('sfar' in kropp) u.sfar = Konton.etikettUr(kropp.sfar);
        if (Array.isArray(kropp.kallor)) {
          const a = agentInst();
          const tillatna = [...(a.mappar || []), ...(a.mapp ? [a.mapp] : [])].map(m => m.sokvag);
          const nya = [];
          for (const k of kropp.kallor) {
            const typ = typeof k === 'string' ? k : k?.typ;
            if (!Uppdrag.KALLOR.includes(typ)) return json(res, 422, { error: tx('srv.agent.okandKalla', { typ }) });
            const fore = u.kallor.find(x => x.typ === typ && (typ !== 'mapp' || x.sokvag === k.sokvag));
            if (typ === 'mapp' && k.sokvag && !tillatna.includes(k.sokvag)) return json(res, 422, { error: tx('srv.uppdrag.mappInteLov') });
            nya.push(fore || (typ === 'mapp' ? { typ, ...(k.sokvag ? { sokvag: String(k.sokvag) } : {}) } : typ === 'amne' ? { typ, fraga: u.instruktion, kallmangd: [] } : typ === 'sok' ? { typ, fraga: u.instruktion, varor: false } : { typ }));
          }
          if (!nya.length) return json(res, 422, { error: tx('srv.uppdrag.minstEnKalla') });
          u.kallor = nya;
        }
        const amneK = u.kallor.find(k => k.typ === 'amne');
        if (amneK && Number.isInteger(kropp.kallaBort)) amneK.kallmangd = (amneK.kallmangd || []).filter((_, i) => i !== kropp.kallaBort);
        if (amneK && typeof kropp.kallaTill === 'string') {
          let url; try { url = new URL(kropp.kallaTill.trim()); } catch { return json(res, 422, { error: tx('srv.uppdrag.ingenAdress') }); }
          if (!/^https?:$/.test(url.protocol)) return json(res, 422, { error: tx('srv.uppdrag.httpAdress') });
          if (!(await tillatenAdress(url.href)).ok) return json(res, 422, { error: tx('srv.uppdrag.adressHamtasInte') });
          amneK.kallmangd = [...(amneK.kallmangd || []), { url: url.href, titel: url.hostname, vard: url.hostname.replace(/^www\./, ''), flode: null }];
        }
        if (amneK && kropp.kallorOm === true) amneK.kallmangd = [];
        if (typeof kropp.handelseText === 'string' || typeof kropp.handelse === 'boolean') {
          const ja = typeof kropp.handelse === 'boolean' ? kropp.handelse : (Schema.handelseUr(kropp.handelseText) || /\bnytt?\b|\bnew\b/i.test(kropp.handelseText));
          u.handelse = ja; if (ja) u.aterkommande = true;
          const f = typeof kropp.handelseText === 'string' ? Schema.filterUr(kropp.handelseText) : null;
          if (f) u.filter = { fran: [...new Set([...(u.filter?.fran || []), ...f.fran])], amne: [...new Set([...(u.filter?.amne || []), ...f.amne])] };
        }
        if (typeof kropp.filterText === 'string') {
          const f = Schema.filterUr(kropp.filterText);
          if (kropp.filterText.trim() && !f) return json(res, 422, { error: tx('srv.uppdrag.ingetFilter') });
          u.filter = f;
        }
        const nyTid = typeof kropp.schemaText === 'string' || Number(kropp.takt) > 0;
        if (nyTid && u.tillstand === 'pausad') {
          const nasta = u.nasta;
          Object.assign(u, Uppdrag.aterstall(u));
          u.nasta = nasta;
        }
        uppdrag[i] = u;
      }
      await sparaUppdrag();
      return json(res, 200, { uppdrag: uppdrag.map(Uppdrag.sammandrag),
        osedda: uppdrag.filter(u => !u.sett).length });
    }

    const mSvar = /^\/api\/sessioner\/([\w-]+)\/webbsvar$/.exec(vag);
    if (mSvar) {
      const s = minSession(mSvar[1], jag);
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      const v = vantande.get(String(kropp.tur || ''));
      if (!v || v.session !== s.id) {
        return json(res, 404, { error: tx('srv.webbsvar.vantarInte') });
      }
      v.svara(kropp.ja === true);
      return json(res, 200, { mottaget: true });
    }

    const mArt = /^\/api\/sessioner\/([\w-]+)\/artefakter$/.exec(vag);
    if (mArt) {
      const s2 = await minSession(mArt[1], jag);
      if (!s2) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });

      const sort = String(kropp.sort || '');
      if (!Artefakt.arSort(sort)) return json(res, 422, { error: tx('srv.artefakt.okantFormat') });

      const tur = kropp.tur
        ? (s2.turer || []).find(t => t.id === kropp.tur)
        : [...(s2.turer || [])].reverse().find(t => t.svar);
      if (!tur?.svar) return json(res, 422, { error: tx('srv.artefakt.ingetSvar') });

      const utkast = Kontor.utkasten(tur.svar);
      const text = utkast.length ? utkast.map(u => u.text).join('\n\n') : tur.svar;
      const rubrik = String(kropp.rubrik || s2.titel || tx('srv.artefakt.reservRubrik')).slice(0, 120);

      let data;
      let om = '';
      try {
        if (sort === 'md') { data = text; om = tx('srv.artefakt.omTecken', { n: text.length }); }
        else if (sort === 'docx') { data = Kontor.tillDocx(text, { rubrik }); om = tx('srv.artefakt.omDocx'); }
        else if (sort === 'pdf') { data = tillPdf(text, { rubrik }); om = tx('srv.artefakt.omPdf'); }
        else if (sort === 'pptx') {
          const bilder = Kontor.bilderAvMarkdown(text, { rubrik, under: s2.titel || '' });
          data = Kontor.tillPptx(bilder);
          om = tx('srv.artefakt.omPptx', { n: bilder.length });
        } else if (sort === 'xlsx') {
          const tab = Kontor.tabeller(text);
          if (!tab.length) return json(res, 422, { error: tx('srv.artefakt.ingenTabell') });
          const blad = tab.map((t, i) => Kontor.bladAvTabell(t, tab.length === 1 ? tx('srv.artefakt.blad1') : tx('srv.artefakt.tabell', { i: i + 1 })));
          data = Kontor.tillXlsx(blad);
          const summor = blad.filter(b => b.rader.some(r => r.some(c => c?.formel))).length;
          om = summor ? tx('srv.artefakt.omXlsxSummor', { n: blad.length }) : tx('srv.artefakt.omXlsx', { n: blad.length });
        }
      } catch (e) {
        return json(res, 500, { error: tx('srv.artefakt.gickInte', { fel: e.message }) });
      }

      try {
        const nyckel = s2.las?.styrka === 'forseglad'
          ? await maximus.nyckelFor(s2, koder.get(s2.id) || null) : null;
        const post = await Artefakt.lagg(maximus, sessionsKatalog(s2.agare), s2,
          { sort, rubrik, data, om, nyckel });
        (s2.artefakter ||= []).push(post);
        await spara(s2);
        sandAlla({ typ: 'lista' });
        return json(res, 201, { artefakt: post });
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    const mArtOppna = /^\/api\/sessioner\/([\w-]+)\/artefakter\/([\w-]+)\/oppna$/.exec(vag);
    if (mArtOppna) {
      const s = minSession(mArtOppna[1], jag);
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      const post = (s.artefakter || []).find(a => a.id === mArtOppna[2]);
      if (!post) return json(res, 404, { error: tx('srv.fel.filenFinnsInte') });
      try {
        const data = await Artefakt.las(maximus, sessionsKatalog(s.agare), s.id, post.id);
        const ned = join(homedir(), 'Downloads');
        await mkdir(ned, { recursive: true });
        const namn = basename(Artefakt.filnamn(String(post.namn || '').replace(/\.[^.]*$/, ''), post.sort));
        const punkt = namn.lastIndexOf('.');
        const stam = punkt > 0 ? namn.slice(0, punkt) : namn, slut = punkt > 0 ? namn.slice(punkt) : '';
        let fil = join(ned, namn);
        for (let i = 2; i < 100 && await stat(fil).then(() => true, () => false); i++) fil = join(ned, `${stam} (${i})${slut}`);
        if (dirname(fil) !== ned) return json(res, 400, { error: tx('srv.artefakt.ogiltigtNamn') });
        await writeFile(fil, data, { mode: 0o600 });
        if (franUtifran(s)) await karantan(fil);
        if (kropp.oppna !== false) {
          const { fil: k, argument } = oppnaKommando(fil);
          spawn(k, argument, { stdio: 'ignore', detached: true }).unref();
        }
        return json(res, 200, { sokvag: fil, namn: basename(fil) });
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    const mArtBort = /^\/api\/sessioner\/([\w-]+)\/artefakter\/([\w-]+)\/bort$/.exec(vag);
    if (mArtBort) {
      const s2 = await minSession(mArtBort[1], jag);
      if (!s2) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      const post = (s2.artefakter || []).find(a => a.id === mArtBort[2]);
      if (!post) return json(res, 404, { error: tx('srv.fel.filenFinnsInte') });
      await Artefakt.taBort(sessionsKatalog(s2.agare), s2.id, post.id);
      s2.artefakter = (s2.artefakter || []).filter(a => a.id !== post.id);
      await spara(s2);
      return json(res, 200, { bort: post.id });
    }

    const m2 = /^\/api\/sessioner\/([\w-]+)\/(skicka|stopp|bort|backa)$/.exec(vag);
    if (m2) {
      const s = minSession(m2[1], jag);
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      if (stangd(s) && m2[2] !== 'bort') return json(res, 423, { error: tx('srv.fel.forsegladAngeKoden') });

      if (m2[2] === 'stopp') { korningar.get(s.id)?.abort(new Error(tx('srv.session.stoppad'))); return json(res, 200, { stoppad: true }); }

      if (m2[2] === 'backa') {
        korningar.get(s.id)?.abort(new Error(tx('srv.session.stoppad')));
        const i = s.turer.findIndex(t => t.id === kropp.tur);
        if (i < 0) return json(res, 404, { error: tx('srv.session.turFinnsInte') });
        const bort = s.turer.splice(i);
        await spara(s);
        sandAlla({ typ: 'lista' });
        return json(res, 200, { session: s, fraga: bort[0].fraga, bort: bort.length });
      }
      if (m2[2] === 'bort') {
        if (s.helig) return json(res, 409, { error: tx('srv.grund.taBort') });
        const fel = await taBortSession(s);
        if (fel) {
          sandAlla({ typ: 'lista' });
          return json(res, 500, { error: tx('srv.session.filenKvar', { fel }) });
        }
        sandAlla({ typ: 'lista', agare: s.agare });
        return json(res, 200, { bort: true });
      }

      const val = Behandling.vad(valet(s).behandling);
      const lokalt = true;
      const djup = kropp.djup === true;

      let forberedd;
      if (lokalt) {
        forberedd = { original: String(kropp.fraga || '').trim(), maskerad: null, karta: [], nya: [], kvitto: [] };
        if (!forberedd.original) return json(res, 422, { error: tx('srv.fel.skrivFraga') });
      } else {
        const original = String(kropp.forberedd?.original || kropp.fraga || '').trim();
        if (!original) return json(res, 422, { error: tx('srv.fel.skrivFraga') });

        forberedd = await forbered(original, {
          karta: s.karta || [], raknare: s.raknare || {},
          sorter: galler(installningar), tolka: val.tolka,
        });

        const redigerad = String(kropp.forberedd?.maskerad || '');
        if (redigerad && redigerad !== forberedd.maskerad) {
          const karta = new Map((forberedd.karta || []).map(k => [k.original, k.platshallare]));
          const raknare = new Map(Object.entries(forberedd.raknare || {}));
          const h = maskeraHart(redigerad, { karta, raknare, sorter: galler(installningar) });
          forberedd = { ...forberedd, maskerad: h.skyddat.aterstall(h.text), redigerad: true };
        }
        s.karta = forberedd.karta;
        s.raknare = forberedd.raknare;
      }

      const maskbegaran = kropp.av !== 'maximus' && kropp.franTelefonen !== true
        ? Maskbegaran.avsikt(forberedd.original) : null;
      if (maskbegaran) return maskeraPaBegaran(s, forberedd.original, maskbegaran, res);

      const mcpLank = kropp.av !== 'maximus' && kropp.franTelefonen !== true
        ? McpGranska.avsiktLank(forberedd.original) : null;
      if (mcpLank) return kopplaInPaBegaran(s, forberedd.original, mcpLank, res);
      const mcpTjanst = kropp.av !== 'maximus' && kropp.franTelefonen !== true
        ? McpGranska.avsiktTjanst(forberedd.original) : null;
      if (mcpTjanst && !McpGranska.tacker(mcpPoster(), { sok: mcpTjanst.tjanst.toLowerCase() }))
        return kopplaTjanstPaBegaran(s, forberedd.original, mcpTjanst, res);

      const gallerNu = behandlingNu(s);
      const tur = { id: randomUUID(), tid: new Date().toISOString(), status: 'igang',
        fraga: forberedd.original, maskerad: forberedd.maskerad,
        maskerat: lokalt ? 0 : (forberedd.funna || []).length, svar: '', frontier: null,
        tolka: val.tolka, lokalt, ...(gallerNu ? { behandling: gallerNu } : {}), webb: kropp.webb === true || kropp.webb === 'auto', anmarkningar: [], kvitto: [], kallor: [],
        ...(kropp.av === 'maximus' ? { av: 'maximus', sager: String(kropp.sager || '').slice(0, 300) } : {}),
        ...(kropp.franTelefonen === true ? { franTelefonen: true } : {}),
        ...(kropp.av === 'maximus' && kropp.fortsattning === true ? { fortsattning: true } : {}),
        stod: kris(forberedd.original) ? stod() : null,
        bilagor: (s.filer || []).map(f => ({ id: f.id, namn: f.namn, sort: f.sort, dolda: f.dolda })) };
      if (!lokalt) {
        s.karta = forberedd.karta;
        s.raknare = forberedd.raknare || s.raknare;
      }
      s.turer.push(tur);
      await spara(s);
      json(res, 202, { turId: tur.id, stod: tur.stod });

      const kontroll = new AbortController();
      korningar.set(s.id, kontroll);
      avbrytAgenten();
      const automatisk = Boolean(tur.franTelefonen) || tur.av === 'maximus';
      sandAlla({ typ: 'lista', agare: s.agare });
      void (async () => {
        try {
          const mcpBehov = tur.av !== 'maximus' && !tur.franTelefonen ? McpGranska.behovAv(forberedd.original) : null;
          const mcpBehovP = mcpBehov && !McpGranska.tacker(mcpPoster(), mcpBehov)
            ? sokKoppling(mcpBehov, { session: s.id }).catch(e => { console.log(`  registret: ${e.message}`); return null; }) : null;

          const synka = (karta, raknare) => {
            const lista = Array.isArray(karta) ? karta
              : [...karta].map(([original, platshallare]) => ({ original, platshallare }));
            const r = raknare instanceof Map ? Object.fromEntries(raknare) : (raknare || {});
            s.karta = lista;
            s.raknare = r;
            forberedd = { ...forberedd, karta: lista, raknare: r };
            return lista;
          };

          let historik = s.turer.filter(t => t.status === 'klar' && t.svar).map(t => ({ fraga: t.fraga, svar: t.svar }));

          const underlagKort = tur.av === 'maximus' || tur.franTelefonen ? [] : Underlag.senaste(s.turer).slice(0, 12);
          const underlagTexter = [];
          const lasas = new Set(Underlag.forFragan(underlagKort, underlagKort.map(k => `${k.utdrag} ${k.reserv}`), forberedd.original).map(x => x.nr));
          underlagTexter.push(...await Underlag.lasManga(underlagKort, (k, i) => (lasas.has(i + 1) ? Underlag.lasHela(k, lasOriginal) : '')));

          let sammandrag = s.sammandrag?.text || '';
          const minnesKvitto = [];
          let aterkallat = '';
          if (lokalt) {
            try {
              const tak = await kontextTak();
              const budget = Math.max(2000, (tak - 2600) * 3
                - forberedd.original.length - sammandrag.length
                - (s.filer || []).reduce((n, f) => n + Math.min((f.original || '').length, 12000), 0));
              const { gamla, nya } = dela(historik, budget);

              if (gamla.length) {
                aterkallat = hamtaTillbaka(gamla, forberedd.original);
                if (aterkallat) {
                  const n = (aterkallat.match(/^FRÅGA: /gm) || []).length || 1;
                  minnesKvitto.push({ aktor: tx('srv.kvitto.denHarDatorn'), lokalt: true, ms: 0,
                    vad: tx('srv.kvitto.hamtadeTillbaka', { n }) });
                }
              }
              if (!gamla.length) sammandrag = '';
              if (gamla.length) {
                sand(s.id, { typ: 'steg', turId: tur.id, steg: 'minns',
                  text: tx('srv.steg.sammanfattar', { n: gamla.length }) });
                const t0 = Date.now();
                sammandrag = await sammanfatta(sammandrag, gamla, { signal: kontroll.signal });
                s.sammandrag = { text: sammandrag, antal: (s.sammandrag?.antal || 0) + gamla.length,
                  tid: new Date().toISOString() };
                await spara(s);
                historik = nya;
                minnesKvitto.push({ aktor: tx('srv.kvitto.lokalModell'), lokalt: true, ms: Date.now() - t0,
                  vad: tx('srv.kvitto.sammanfattade', { n: s.sammandrag.antal }) });
              }
            } catch (e) {
              if (kontroll.signal.aborted) throw e;
              minnesKvitto.push({ aktor: tx('srv.kvitto.denHarDatorn'), lokalt: true, ms: 0, fel: true,
                vad: tx('srv.kvitto.kundeInteSammanfatta') });
            }
          }
          const minLiggare = p => liggare({ ...p, anvandare: jag?.id || null,
            anvandarnamn: jag?.namn || null, session: s.id });
          const egen = klassaInfo(forberedd.original, { funna: forberedd.funna, rojning: forberedd.rojning });
          const burit = Math.max(0, ...(s.turer || []).map(t => t.klass?.niva || 0));
          const arvd = arvaKlass(egen.niva, burit, forberedd.original);
          const klass = arvd > egen.niva
            ? { ...NIVAER[arvd], niva: arvd,
                skal: [...egen.skal, tx('srv.klass.arvdNiva', { n: burit })] }
            : egen;
          tur.klass = klass;

          let underlag = '', kallor = [];
          let utatCache = null;
          const utat = async () => {
            if (forberedd.maskerad) return forberedd.maskerad;
            if (utatCache === null) {
              const m = await forbered(forberedd.original, {
                karta: s.karta || [], raknare: s.raknare || {}, sorter: galler(installningar) });
              utatCache = m.maskerad;
              synka(m.karta, m.raknare);
            }
            return utatCache;
          };

          const sokkarta = new Map((s.karta || []).map(k => [k.original, k.platshallare]));
          const sokraknare = new Map(Object.entries(s.raknare || {}));

          const egnaSaker = !djup && tur.av !== 'maximus' && !(s.filer || []).length
            && !Aterkommer.avsikt(forberedd.original) && (Boolean(s.agentsamtal) || Boolean(Verktygsfraga.avsikt(forberedd.original)));
          const sagtNej = forbjuderSok(forberedd.original);
          let sokWebb = kropp.webb === true && !sagtNej;
          let fragor = null;
          if (sagtNej) {
            tur.webb = false;
            tur.webbVarfor = tx('srv.webb.varforNej');
            sand(s.id, { typ: 'steg', turId: tur.id, steg: 'soker',
              text: tx('srv.steg.sokerInteNej') });
          }
          else if (kropp.webb === 'auto' && egnaSaker || kropp.webb === undefined && egnaSaker) {
            tur.webb = false;
            tur.webbVarfor = tx('srv.webb.varforEgna');
            sand(s.id, { typ: 'steg', turId: tur.id, steg: 'soker', text: tx('srv.steg.sokerInteEgna') });
          }
          else if (kropp.webb === 'auto' || kropp.webb === undefined) {
            sand(s.id, { typ: 'steg', turId: tur.id, steg: 'soker', text: tx('srv.steg.avgorWebb') });
            const b = djup
                ? { ja: true, varfor: tx('srv.webb.varforDjup') }
                : await avgorWebb(await utat(),
                  { bilagor: (s.filer || []).length, signal: kontroll.signal });
            sokWebb = b.ja === true;
            tur.webb = sokWebb;
            tur.webbVarfor = b.varfor;
            sand(s.id, { typ: 'steg', turId: tur.id, steg: 'soker',
              text: sokWebb ? tx('srv.steg.slarUpp', { varfor: b.varfor }) : tx('srv.steg.sokerInte', { varfor: b.varfor }) });
          }

          if (sokWebb && djup && !fragor?.length) {
            sand(s.id, { typ: 'steg', turId: tur.id, steg: 'planerar', text: tx('srv.steg.planerarDjup') });
            fragor = (await Djup.forbered(await utat(),
              { signal: kontroll.signal })).fragor;
          }

          if (sokWebb && kraverGodkannande(klass.niva)) {
            sand(s.id, { typ: 'steg', turId: tur.id, steg: 'planerar', text: tx('srv.steg.planerar') });
            fragor = await planeraSok(await utat(),
              { signal: kontroll.signal, historik });
            fragor = [...new Set(fragor
              .map(f => anonymSokfraga(f, { karta: forberedd.karta || [] }))
              .filter(f => f.split(/\s+/).filter(Boolean).length >= 2))];
            if (!fragor.length) sokWebb = false;
            else {
              sand(s.id, { typ: 'webbgrind', turId: tur.id, fragor, klass,
                djup: djup ? Djup.budgetAv(installningar) : null });
              const ja = await vantaPaSvar(tur.id, s.id);
              sokWebb = ja;
              tur.webb = ja;
              tur.webbVarfor = ja
                ? tx('srv.webb.varforGodkande', { niva: klass.niva, etikett: klass.etikett.toLowerCase() })
                : tx('srv.webb.varforAvstod', { niva: klass.niva, etikett: klass.etikett.toLowerCase() });
              sand(s.id, { typ: 'steg', turId: tur.id, steg: 'soker', text: ja ? tx('srv.steg.godkantSoker') : tx('srv.steg.ingenSokning') });
            }
          }

          if (sokWebb && djup) {
            try {
              const u = await Djup.djupsok(await utat(), {
                signal: kontroll.signal, liggare: minLiggare, fragor,
                budget: Djup.budgetAv(installningar), historik,
                karta: sokkarta,
                raknare: sokraknare,
                sorter: galler(installningar),
                onSteg: h => sand(s.id, { typ: 'steg', turId: tur.id, ...h }),
                onKalla: k => sand(s.id, { typ: 'kalla', turId: tur.id, kalla: k }),
              });
              underlag = u.underlag;
              kallor = u.kallor;
              synka(sokkarta, sokraknare);
              tur.djup = { varv: u.varv, stoppade: u.stoppade, sekunder: u.sekunder };
              sand(s.id, { typ: 'steg', turId: tur.id, steg: 'soker',
                text: tx('srv.steg.djupKlar', { varv: u.varv.length, kallor: u.kallor.length, s: u.sekunder, stoppade: u.stoppade }) });
            } catch (e) {
              if (kontroll.signal.aborted) throw e;
              sand(s.id, { typ: 'steg', turId: tur.id, steg: 'soker', text: e.message.slice(0, 160), fel: true });
            }
          } else if (sokWebb) {
            try {
              const u = await slaUpp(await utat(), {
                signal: kontroll.signal, liggare: minLiggare, fragor, historik,
                varor: arVarufraga(forberedd.original),
                ...omfang(forberedd.original),
                karta: sokkarta,
                raknare: sokraknare,
                sorter: galler(installningar),
                onSteg: h => sand(s.id, { typ: 'steg', turId: tur.id, ...h }),
                onKalla: k => sand(s.id, { typ: 'kalla', turId: tur.id, kalla: k }),
              });
              underlag = u.underlag;
              kallor = u.kallor;
              synka(sokkarta, sokraknare);
            } catch (e) {
              if (kontroll.signal.aborted) throw e;
              sand(s.id, { typ: 'steg', turId: tur.id, steg: 'soker', text: e.message.slice(0, 160), fel: true });
            }
          }

          const fardigMedWebben = kropp.webb === false || kropp.webb === 'av';
          if (!fardigMedWebben && !kontroll.signal.aborted) {
            try {
              const anrop = await Kall.valjVerktyg(await utat(), {
                tillatna: installningar.kopplingar?.length ? installningar.kopplingar : null,
                signal: kontroll.signal,
              });
              if (anrop.length) {
                let ja = true;
                if (kraverGodkannande(klass.niva)) {
                  sand(s.id, { typ: 'kallgrind', turId: tur.id, klass,
                    anrop: anrop.map(a => ({ namn: a.namn, varfor: a.varfor, visa: Kall.beskriv(a) })) });
                  ja = await vantaPaSvar(tur.id, s.id);
                  sand(s.id, { typ: 'steg', turId: tur.id, steg: 'soker',
                    text: ja ? tx('srv.steg.godkantKalla') : tx('srv.steg.ingenKalla') });
                }
                if (ja) {
                  const kk = await Kall.hamtaKallor(anrop, {
                    signal: kontroll.signal, liggare: minLiggare, nrFran: kallor.length + 1,
                    fraga: await utat(),
                    onSteg: h => sand(s.id, { typ: 'steg', turId: tur.id, ...h }),
                    onKalla: k => sand(s.id, { typ: 'kalla', turId: tur.id, kalla: k }),
                  });
                  if (kk.length) {
                    kallor = [...kallor, ...kk];
                    underlag = byggUnderlag(kallor);
                    tur.kopplingar = kk.map(k => ({ koppling: k.koppling, titel: k.titel, licens: k.licens }));
                  }
                }
              }
            } catch (e) {
              if (kontroll.signal.aborted) throw e;
              sand(s.id, { typ: 'steg', turId: tur.id, steg: 'soker', text: e.message.slice(0, 160), fel: true });
            }
          }

          let projektfiler = [];
          if (s.projekt) {
            const syskon = Projekt.syskon([...sessioner.values()]
              .filter(x => (x.agare || null) === (jag?.id || null)), s);
            const u = Projekt.underlagUr(syskon, forberedd.original);
            if (u) {
              const pm = await forbered(u.text, { karta: s.karta || [], raknare: s.raknare || {},
                sorter: galler(installningar) });
              synka(pm.karta, pm.raknare);
              const namn = projekt.find(x => x.id === s.projekt)?.namn || tx('srv.foljer.projektReserv');
              projektfiler = [{ namn: tx('srv.foljer.projektNamn', { namn }), maskerad: pm.maskerad, original: u.text }];
              const kv = Projekt.kvittot(u);
              if (kv) tur.kvitto = [...(tur.kvitto || []), kv];
              sand(s.id, { typ: 'steg', turId: tur.id, steg: 'laser', text: kv.vad });
            }
          }

          if (s.minne === 'minns') {
            const tidigare = Projekt.tidigare([...sessioner.values()]
              .filter(x => (x.agare || null) === (jag?.id || null)), s);
            const u = Projekt.underlagUr(tidigare, forberedd.original, { rubrik: tx('srv.minne.rubrik') });
            if (u) {
              const pm = await forbered(u.text, { karta: s.karta || [], raknare: s.raknare || {},
                sorter: galler(installningar) });
              synka(pm.karta, pm.raknare);
              projektfiler = [...projektfiler, { namn: tx('srv.minne.bilagaNamn'), maskerad: pm.maskerad, original: u.text }];
              const kv = Projekt.kvittot(u, { aktor: tx('srv.kvitto.minnet') });
              if (kv) tur.kvitto = [...(tur.kvitto || []), kv];
              sand(s.id, { typ: 'steg', turId: tur.id, steg: 'laser', text: kv.vad });
            }
          }

          const samtaletsAmne = s.titel && !STANDARDTITEL.test(s.titel) ? Aterkommer.rentAmne(s.titel) : null;
          let uppdragsavsikt = tur.av !== 'maximus' ? Aterkommer.avsikt(forberedd.original) : null;
          if (uppdragsavsikt?.utanAmne) uppdragsavsikt = samtaletsAmne ? { ...uppdragsavsikt, amne: samtaletsAmne, utanAmne: false, instruktion: tx('srv.uppdrag.hallKollNyheter', { amne: samtaletsAmne }) } : null;
          const oppetForslag = [...s.turer].reverse().find(x => x.id !== tur.id && x.uppdragsforslag)?.uppdragsforslag;
          if (!uppdragsavsikt && tur.av !== 'maximus' && oppetForslag?.direkt && !oppetForslag.svar && oppetForslag.kallor?.includes('amne') && !/\?\s*$/.test(forberedd.original)) {
            const amne = Aterkommer.amneUrBeskrivning(forberedd.original, Aterkommer.rentAmne(oppetForslag.amne) || samtaletsAmne || '');
            if (amne) { uppdragsavsikt = { kallor: ['amne'], var: ['webben'], amne, instruktion: tx('srv.uppdrag.hallKoll', { amne }) }; oppetForslag.ersatt = true; }
          }
          if (tur.franTelefonen) uppdragsavsikt = null;
          const presentation = tur.av !== 'maximus' && !tur.franTelefonen && Presentation.avsikt(forberedd.original);
          const tillModellen = presentation
            ? `${forberedd.original}\n\n${Presentation.ANVISNING}`
            : uppdragsavsikt?.engang
            ? `${forberedd.original}\n\n${tx('srv.anvisning.engang', { var: ochLista(uppdragsavsikt.var) })}`
            : uppdragsavsikt
            ? `${forberedd.original}\n\n${tx('srv.anvisning.uppdrag')}`
            : forberedd.original;
          const handelse = tur.av !== 'maximus' && !tur.franTelefonen && Handelse.avsikt(forberedd.original)
            ? await Handelse.las(forberedd.original, { signal: kontroll.signal }).catch(() => null) : null;
          const kalendern = handelse ? Konton.kalenderMedEtikett(agentInst().kalender, (s.etiketter || [])[0]) : null;
          if (handelse) tur.handelse = { ...handelse, id: randomUUID(), gjort: {}, ...(kalendern ? { kalender: kalendern } : {}) };
          const mcpNamnd = !tur.franTelefonen && McpGranska.namnIText(forberedd.original, mcpPoster().filter(p => p.pa && !p.andrad && (p.overallt || p.session === s.id))).length > 0;
          const medVerktyg = !handelse && !uppdragsavsikt && tur.av !== 'maximus' && !tur.bilagor?.length
            && (Boolean(s.agentsamtal) || Verktygsfraga.avsikt(forberedd.original) || mcpNamnd);
          let slingsvar = null;
          if (medVerktyg) {
            const NAMN = Object.fromEntries(['mejl', 'kalender', 'lediga_tider', 'paminnelser', 'anteckningar', 'meddelanden', 'mapp', 'las_fil',
              'webbsok', 'las_sida', 'rakna', 'genvagar'].map(v => [v, tx(`srv.steg.verktyg.${v}`)]));
            NAMN.las_underlag = tx('srv.steg.verktyg.las_underlag');
            NAMN.hitta_koppling = tx('srv.steg.verktyg.hitta_koppling');
            slingsvar = await agentSlinga({ uppgift: forberedd.original, session: s.id, tur: tur.id, signal: kontroll.signal, styrning: Boolean(s.agentsamtal) && !tur.franTelefonen, begransad: Boolean(tur.franTelefonen),
              obevakad: false, webb: Boolean(s.agentsamtal) || !(kropp.webb === false || kropp.webb === 'av' || s.webb === 'av'),
              sammanhang: [s.agentsamtal
                ? `${tx('srv.agentsamtal.sammanhang')}${historik.filter(h => h.fraga && !/^Agenten såg|^Uppdraget|^The agent saw|^The task/.test(h.fraga)).slice(-3).map(h => tx('srv.agentsamtal.tidigareFraga', { fraga: String(h.fraga).slice(0, 200) })).join('')}`
                : historik.slice(-3).map(h => tx('srv.slinga.historikRad', { fraga: String(h.fraga || '').slice(0, 300), svar: String(h.svar || '').slice(0, 400) })).join('\n'),
              Underlag.sammanhang(underlagKort, underlagTexter, { fraga: forberedd.original })].filter(Boolean).join('\n\n'),
              underlag: underlagKort,
              betrodd: { uppgift: Smitta.arDinTur(tur), sammanhang: true },
              egen: [...(Smitta.arDinTur(tur) ? [forberedd.original] : []), ...Smitta.sammanhangsTurer(s, tur).filter(Smitta.arDinTur).map(t => String(t.fraga || ''))].join('\n'),
              fran: [
                ...underlagKort.map((k, i) => ({ text: `${k.titel || ''}\n${k.pakallande ? '' : underlagTexter?.[i] || k.utdrag || k.reserv || ''}`, kalla: tx('lib.smitta.kalla.underlag', { titel: String(k.titel || '').slice(0, 60) }) })),
                ...Smitta.sammanhangsTurer(s, tur).flatMap(t => Smitta.turensKallor(t).map(kalla => ({ text: `${t.fraga || ''}\n${t.svar || ''}`, kalla }))),
              ],
              kontrollera: Kontroll.forSlingan({ instruktion: forberedd.original, profil: Profil.somText(installningar.profil), sprak: Sprakstod.aktuellt(), lage: Kontroll.lage(installningar),
                modell: Kontroll.lage(installningar) === 'av' ? null : Kontroll.modellDomare(svaraLokalt) }),
              onSteg: st => sand(s.id, { typ: 'steg', turId: tur.id, steg: 'verktyg',
                text: st.verktyg === 'vagval' ? tx('srv.steg.vagval', { kort: st.kort }) : `${NAMN[st.verktyg] || st.verktyg}${st.fel ? tx('srv.steg.gickInte') : ''}`, ...(st.fel ? { fel: true } : {}) }),
            }).catch(e => {
              if (automatisk && !kontroll.signal.aborted && Vakten.arModellfel(e)) throw e;
              return { svar: tx('srv.slinga.komInteAt', { fel: e.message }), steg: [] };
            });
            sand(s.id, { typ: 'text', turId: tur.id, bit: slingsvar.svar });
          }
          if (slingsvar?.handlingar?.length) tur.handlingar = slingsvar.handlingar.map(h => ({ ...h }));
          if (slingsvar) tur.smittad = slingsvar.skydd?.smittad || [];
          if (slingsvar?.skydd?.texter?.length) tur.skydd = { texter: slingsvar.skydd.texter };
          const r = slingsvar ? {
            svar: slingsvar.svar,
            kvitto: [{ tid: new Date().toISOString(), aktor: tx('srv.liggare.aktorAgenten'), lokalt: true, ms: 0,
              vad: slingsvar.steg.length ? tx('srv.kvitto.byggerPa', { verktyg: [...new Set(slingsvar.steg.filter(x => !x.fel).map(x => x.verktyg))].join(', ') || tx('srv.kvitto.ingaVerktyg') }) : tx('srv.kvitto.utanVerktyg') }],
            delar: [],
          } : handelse ? {
            svar: tx('srv.handelse.forberett', { titel: handelse.titel, inbjudan: handelse.deltagare.length ? tx('srv.handelse.inbjudan') : '' })
              + (kalendern ? tx('srv.handelse.iKalendern', { kalender: kalendern.namn, etikett: Konton.etikettNamn(kalendern.etikett) }) : ''),
            kvitto: [{ tid: new Date().toISOString(), aktor: tx('srv.kvitto.lokalModell'), lokalt: true, ms: 0,
              vad: tx('srv.kvitto.handelse') }],
            delar: [],
          } : await lokaltSvar(tillModellen, {
                profil: Profil.somText(installningar.profil),
                aterkallat,
                bilder: await serBilder()
                  ? (s.filer || []).filter(f => f.bild)
                      .slice(-3).map(f => ({ data: f.bild, typ: f.bildtyp }))
                  : null,
                signal: kontroll.signal, historik, sammandrag,
                persona: s.persona || installningar.persona,
                bilagor: [...projektfiler, ...(s.filer || []), ...Underlag.bilagor(underlagKort, underlagTexter, { fraga: forberedd.original })], policy: installningar.policy, underlag,
                onSteg: h => sand(s.id, { typ: 'steg', turId: tur.id, ...h }),
                onDel: h => sand(s.id, { typ: 'del', turId: tur.id, ...h }),
                onText: (bit, del) => sand(s.id, { typ: 'text', turId: tur.id, bit, del }),
              });
          if (uppdragsavsikt && r?.svar) {
            r.svar = r.svar.replace(/^\s*```\w*\n([\s\S]*?)\n```\s*$/, '$1')
              .split('\n').filter(rad => !/\/uppdrag\b|^\s*(Ja\s+Nej|\[Ja\]|\[Nej\])\s*$/.test(rad)).join('\n').trim();
          }
          let svarskontroll = slingsvar?.kontroll || null;
          if (!slingsvar && !handelse && r?.svar && Kontroll.lage(installningar) !== 'av') {
            const kl = Kontroll.lage(installningar);
            sand(s.id, { typ: 'steg', turId: tur.id, steg: 'laser', text: tx('srv.steg.kontrollerar') });
            const k = await Kontroll.efterkontroll({ svar: r.svar, lage: kl,
              kontext: { instruktion: forberedd.original, sprak: Sprakstod.aktuellt(), profil: Profil.somText(installningar.profil),
                underlag: [underlag, ...kallor.map(k => k.utdrag || ''), ...projektfiler.map(f => f.original || ''), ...(s.filer || []).map(f => f.original || f.maskerad || ''),
                  Underlag.sammanhang(underlagKort, underlagTexter, { fraga: forberedd.original })].filter(Boolean).join('\n'),
                historik: historik.slice(-3).map(h => `${h.fraga || ''}\n${h.svar || ''}`).join('\n'),
                gjort: [...projektfiler, ...(s.filer || []), ...underlagKort].length || kallor.length ? [{ sort: 'last', vad: 'bilaga' }] : [] },
              modell: Kontroll.modellDomare(svaraLokalt),
              forsok: r.delar?.length ? null : rattelse => lokaltSvar(`${tillModellen}\n\n${rattelse}`, {
                profil: Profil.somText(installningar.profil), aterkallat, signal: kontroll.signal, historik, sammandrag,
                persona: s.persona || installningar.persona,
                bilagor: [...projektfiler, ...(s.filer || []), ...Underlag.bilagor(underlagKort, underlagTexter, { fraga: forberedd.original })], policy: installningar.policy, underlag,
                planera: false,
              }).then(x => x.svar).catch(() => null) }).catch(() => null);
            if (k) { r.svar = k.svar; svarskontroll = k.kontroll; }
          }
          if (kallor.length && r?.svar && !slingsvar) r.svar = utanLurapastaende(r.svar, { rensade: rensadeRader(kallor) });
          if (svarskontroll?.rattat?.length) sand(s.id, { typ: 'steg', turId: tur.id, steg: 'laser', text: tx('srv.steg.kontrollRattade', { vad: svarskontroll.rattat.join(' · ') }) });
          if (svarskontroll && !svarskontroll.ok) sand(s.id, { typ: 'steg', turId: tur.id, steg: 'laser', fel: true, text: Kontroll.rad(svarskontroll) });

          const granskning = kallor.length && installningar.granskaCitat !== false
            ? Granska.granska(r.svar || '', kallor) : null;

          const fristforslag = [];
          for (const k of kallor) {
            if (!/lagen\.nu|riksdagen/i.test(`${k.koppling || ''} ${k.vard || ''}`)) continue;
            for (const f of Frister.hittaFrister(k.utdrag || '', { kalla: k.nr, lagrum: k.titel || null })) {
              const n = Frister.nyckelnFor(f);
              if (fristforslag.some(x => Frister.nyckelnFor(x) === n)) continue;
              fristforslag.push({ ...f, text: Frister.lasbar(f) });
            }
          }

          const underlaget = [
            ...kallor.map(k => k.utdrag || ''),
            ...(s.filer || []).map(f => f.original || f.maskerad || ''),
          ].join('\n');
          const pahittade = underlaget && installningar.granskaCitat !== false
            ? Dugerinte.opåkomnaTal(r.svar || '', underlaget) : [];

          if (granskning?.antal) {
            sand(s.id, { typ: 'steg', turId: tur.id, steg: 'laser',
              text: Granska.sammanfatta(granskning),
              fel: granskning.saknas + granskning['fel nr'] > 0 });
          }
          if (pahittade.length) {
            sand(s.id, { typ: 'steg', turId: tur.id, steg: 'laser', fel: true,
              text: tx('srv.steg.pahittadeTal', { n: pahittade.length, tal: pahittade.slice(0, 4).join(', ') }) });
          }

          const { anvanda: kallorUnder, oanvanda } = anvandaKallor(r.svar || '', kallor);
          if (oanvanda.length) sand(s.id, { typ: 'steg', turId: tur.id, steg: 'laser',
            text: tx('srv.steg.kallorSallade', { n: oanvanda.length, vardar: oanvanda.map(k => k.vard).filter(Boolean).join(', ') }) });
          const kf = slingsvar?.kopplingsforslag || (mcpBehovP ? await mcpBehovP : null);
          if (kf?.forslag?.length) tur.kopplingsforslag = kf;
          Object.assign(tur, { status: 'klar', svar: r.svar, frontier: r.frontier, granskning, kontroll: svarskontroll || undefined,
            pahittade: pahittade.length ? pahittade : undefined,
            frister: fristforslag.length ? fristforslag.slice(0, 4) : undefined,
            aterstallda: r.aterstallda, anmarkningar: r.anmarkningar || [],
            klass, kvitto: [...(tur.kvitto || []), ...minnesKvitto, ...(kallor.length
              ? [{ aktor: tx('srv.kvitto.webben'), lokalt: false, ms: 0, vad: tx('srv.kvitto.kallorLasta', { n: kallor.length, vardar: kallor.map(k => k.vard).join(', ') }) }]
              : []), ...(r.kvitto || [])], delar: r.delar || [], kallor: kallorUnder,
            ...(oanvanda.length ? { kallorOanvanda: oanvanda.map(k => ({ nr: k.nr, titel: k.titel, url: k.url, vard: k.vard })) } : {}) });
          if (s.turer.length === 1 && !s.dopt) s.titel = Rubrik.avFragan(forberedd.maskerad || forberedd.original);
          await spara(s);
          sand(s.id, { typ: 'klar', turId: tur.id, tur, titel: s.titel });
          if (tur.franTelefonen) vaktSvarFranTelefonen(tur).catch(() => {});

          if (s.turer.length === 1 && !s.dopt) {
            Rubrik.rubrik(forberedd.maskerad || forberedd.original, r.svar, { signal: kontroll.signal })
              .then(async namn => {
                if (!namn || namn === s.titel || s.dopt) return;
                s.titel = namn;
                await spara(s);
                sand(s.id, { typ: 'titel', titel: namn });
              })
              .catch(() => {  });
          }

          const avsikten = tur.handelse ? null : uppdragsavsikt;
          if (avsikten && !uppdrag.some(u => u.instruktion === (avsikten.instruktion || forberedd.original))) {
            tur.uppdragsforslag = { direkt: true, engang: Boolean(avsikten.engang), amne: avsikten.amne, var: avsikten.var, kallor: avsikten.kallor,
              schema: avsikten.engang ? null : Schema.schemaUr(forberedd.original), filter: Schema.filterUr(forberedd.original),
              schemaText: avsikten.engang ? null : Schema.somText(Schema.schemaUr(forberedd.original)), filterText: Schema.filterText(Schema.filterUr(forberedd.original)),
              handelseText: !avsikten.engang && Schema.handelseUr(forberedd.original) ? tx('srv.forslag.handelseText') : null,
              ord: null, antal: 0, instruktion: avsikten.instruktion || forberedd.original };
            await spara(s);
            sand(s.id, { typ: 'uppdragsforslag', turId: tur.id, forslag: tur.uppdragsforslag });
          }
          if (!avsikten && !tur.handelse && s.minne === 'minns' && tur.av !== 'maximus' && !s.turer.some(x => x.uppdragsforslag)) {
            const f = Aterkommer.forslag({
              fraga: forberedd.original,
              tidigare: [...sessioner.values()]
                .filter(x => x.id !== s.id && (x.agare || null) === (jag?.id || null)
                  && !x.las && !x.forseglad && x.minne === 'minns' && (x.turer || []).length)
                .map(x => ({ id: x.id, fragor: x.turer.filter(t => t.av !== 'maximus').map(t => t.fraga || '') })),
              uppdrag: uppdrag.map(u => u.instruktion),
              avbojt: installningar.avbojt || [],
            });
            if (f) {
              tur.uppdragsforslag = { amne: f.amne, ord: f.ord, antal: f.antal, instruktion: f.instruktion };
              await spara(s);
              sand(s.id, { typ: 'uppdragsforslag', turId: tur.id, forslag: tur.uppdragsforslag });
            }
          }

          if (presentation && r.svar) {
            try {
              const rubrik = (/^#\s+(.+)$/m.exec(r.svar)?.[1] || s.titel || tx('srv.presentation.reservRubrik')).slice(0, 120);
              const bilder = Kontor.bilderAvMarkdown(r.svar, { rubrik, under: new Date().toLocaleDateString(lokalNu(), { day: 'numeric', month: 'long', year: 'numeric' }) });
              const nyckel = s.las?.styrka === 'forseglad' ? await maximus.nyckelFor(s, koder.get(s.id) || null) : null;
              const post = await Artefakt.lagg(maximus, sessionsKatalog(s.agare), s,
                { sort: 'pptx', rubrik, data: Kontor.tillPptx(bilder), om: tx('srv.artefakt.omPptxKort', { n: bilder.length }), nyckel });
              (s.artefakter ||= []).push(post);
              tur.artefakt = post;
              await spara(s);
              sand(s.id, { typ: 'artefakt', turId: tur.id, artefakt: post });
            } catch (e) {
              tur.artefakt = { fel: tx('srv.presentation.gickInte', { fel: e.message }) };
              sand(s.id, { typ: 'artefakt', turId: tur.id, artefakt: tur.artefakt });
            }
          }

          const planen = !tur.handelse && !presentation && s.minne !== 'glom' && Planen.harDatum(`${forberedd.original}\n${r.svar}`)
            ? Planen.las(forberedd.original, r.svar, { signal: kontroll.signal })
              .then(async planer => {
                const redan = new Set(s.turer.flatMap(t => (t.planen || []).map(p => p.datum)));
                planer = planer.filter(p => !redan.has(p.datum));
                if (!planer.length) return 0;
                tur.planen = planer.map(p => ({ ...p, id: randomUUID(), gjort: {} }));
                await spara(s);
                sand(s.id, { typ: 'planen', turId: tur.id, planen: tur.planen });
                return planer.length;
              })
              .catch(() => 0)
            : Promise.resolve(0);

          planen
            .then(n => (n || tur.uppdragsforslag || tur.handelse || presentation) ? null
              : efterSvaret(forberedd.original, r.svar, { signal: kontroll.signal, fortsattning: Boolean(tur.fortsattning) }))
            .then(async e => {
              if (!e) return;
              if (s.nyhet && !uppdrag.some(u => u.session === s.id)) {
                const amne = Aterkommer.rentAmne(s.titel && !arNySession(s.titel) ? s.titel : s.nyhet.titel) || tx('srv.nyhet.amneReserv');
                e.forslag = [{ text: tx('srv.nyhet.bevaka'), skicka: tx('srv.nyhet.bevaka') }, { text: tx('srv.nyhet.djupdyk'), skicka: `/djupdykning ${amne}` },
                  ...e.forslag.filter(x => !/bevaka|djupdyk|watch|deep dive/i.test(x))].slice(0, 4);
              }
              if (e.forslag.length) sand(s.id, { typ: 'forslag', turId: tur.id, forslag: e.forslag });
              if (e.bollen !== 'klar') {
                tur.bollen = { vem: e.bollen, vad: e.vad };
                await spara(s);
                sand(s.id, { typ: 'bollen', turId: tur.id, bollen: tur.bollen });
              }
            })
            .catch(() => {});
        } catch (e) {
          if (automatisk && !kontroll.signal.aborted && Vakten.arModellfel(e)) {
            await vaktKoa(s, tur, kropp).catch(() => {});
            return;
          }
          tur.status = kontroll.signal.aborted ? 'stoppad' : 'fel';
          tur.fel = kontroll.signal.aborted ? tx('srv.session.stoppad') : e.message;
          await spara(s).catch(() => {});
          sand(s.id, { typ: 'fel', turId: tur.id, meddelande: tur.fel });
        } finally { korningar.delete(s.id); sandAlla({ typ: 'lista', agare: s.agare }); }
      })();
      return;
    }

    return json(res, 404, { error: tx('srv.fel.finnsInte') });
  } catch (e) {
    if (!res.headersSent) json(res, 422, { error: e.message });
    else res.end();
  }
}

const tls = await granskaUppstart(K).catch(e => { console.error('\n' + e.message + '\n'); process.exit(1); });
const lyssnare = tls ? createServerTLS(tls, server.listeners('request')[0]) : server;

const nu = () => new Date().toLocaleString('sv-SE');

process.on('unhandledRejection', fel => {
  console.error(`  ⚠ obevakat fel ${nu()}:`, fel?.stack || fel?.message || fel);
});

process.on('uncaughtException', fel => {
  console.error(`  ⚠ ofångat kast ${nu()}:`, fel?.stack || fel);
});

for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP'])
  process.on(sig, () => {
    console.error(`  ── ${sig} ${nu()}, stänger ──`);
    setTimeout(() => process.exit(0), 10000).unref();
    stangNer(sig).catch(() => process.exit(0));
  });
process.on('exit', kod => console.error(`  ── avslutad ${nu()} med kod ${kod} ──`));

lyssnare.listen(PORT, K.bind, async () => {
  uppstartKlar = true;
  await stadaDelningar().catch(() => {});
  await glomGlomda().catch(e => console.log(`  kunde inte glömma: ${e.message}`));
  const adr = adresser(K);
  console.log(`MAXIMUS ${VERSION}${utokning?.etikett || ''}`);
  for (const a of adr) console.log(`  ${a}`);
  if (!IDENTITET) console.log(`  nyckeln: ${nyckelfil} (läggs till som /?n=<nyckel>)`);

  await utokning?.startlogg?.();

  if (process.platform === 'darwin' && process.env.MAXIMUS_PROV !== '1' && appPlats() === 'ok' && installningar.ikonVersion !== VERSION) {
    const app = process.env.MAXIMUS_APP.replace(/(\.app)\/.*$/, '$1');
    execFileCb('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', app], { timeout: 20000 }, async e => {
      if (e) return console.log(`  ikonen: ${e.message}`);
      installningar = { ...installningar, ikonVersion: VERSION };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar)).catch(() => {});
    });
  }

  if (!IDENTITET && !K.tyst) {
    const { fil, argument } = oppnaKommando(adr[0]);
    spawn(fil, argument, { stdio: 'ignore', detached: true }).unref();
  }

  let laddar = false;
  const seEfterModellen = async (forsta = false) => {
    if (laddar || modellAvstangd) return;
    if (molnPa() && installningar.modellval?.tanker === 'moln') return;
    if (!forsta && await grindSvarar()) return;
    laddar = true;
    try {
      const r = await sakerstallModell({ onSteg: h => console.log(`  ${h.text}…`) });
      console.log(`  lokal modell: ${r.url}${r.redan ? '' : ' (startad av MAXIMUS)'}`);
      sandAlla({ typ: 'modell', uppe: true, url: r.url, egen: !r.redan });
      varmPlatser({ url: r.url, prompter: VARMA }).catch(() => {});
    } catch (e) {
      console.log(`  ⚠ lokal modell: ${e.message}`);
      sandAlla({ typ: 'modell', uppe: false });
    } finally { laddar = false; }
  };
  const utanFonster = () => process.env.MAXIMUS_LAUNCHD === '1' && oversikt.size === 0;
  if (!utanFonster()) seEfterModellen(true);
  setInterval(async () => {
    if (!utanFonster()) return seEfterModellen();
    if (!slarNu && Date.now() - senastAgentModell > 15 * 60e3 && await grindSvarar()) {
      console.log('  inget fönster och inget varv på en kvart — släpper modellen');
      await stoppaModell().catch(() => {});
    }
  }, 60000).unref();
  fonsterAnslot = () => { if (process.env.MAXIMUS_LAUNCHD === '1') seEfterModellen(); };
});
