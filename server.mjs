// MAXIMUS 4 — grinden.
//
// Servern gör tre saker: håller sessioner krypterade, kör kedjan, och för
// liggaren. Den har ingen modellhantering, ingen routing och ingen doktrin.
// Allt som är svårt ligger i lib/.

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
import { serBilder, hittaMmproj, modellfil } from './lib/modell.mjs';
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
// Serverns texter på språket som gäller (lib/texter/<kod>/server.json).
const tx = Sprakstod.tx;
/// Datum och klockslag på språkets sätt: 'sv-SE' på svenska, annars 'en-US'.
const lokalNu = () => (Sprakstod.svenska() ? 'sv-SE' : 'en-US');
/// "a, b och c" — på svenska som förut, annars genom Intl.
const ochLista = xs => (Sprakstod.svenska() ? xs.join(' och ') : new Intl.ListFormat('en', { type: 'conjunction' }).format(xs));
const ellerLista = xs => (Sprakstod.svenska() ? xs.join(' eller ') : new Intl.ListFormat('en', { type: 'disjunction' }).format(xs));
/// Källan i bestämd form: "inkorgen", "the inbox".
const KALLTYPER = ['epost', 'kalender', 'anteckningar', 'bevakning', 'sida', 'meddelanden', 'paminnelser', 'samtal', 'mapp'];
const bestamdKalla = typ => (KALLTYPER.includes(typ) ? tx(`srv.kalla.bestamd.${typ}`) : typ);
/// Standardtitlar som inte säger något om samtalet, på båda språken.
const STANDARDTITEL = /^(Ny session|Agenten|Välkommen till Maximus|New session|Agent|Welcome to Maximus)$/;
const arNySession = t => t === 'Ny session' || t === 'New session';

/// Det platserna faktiskt skickar, så att värmningen lägger rätt sak i
/// cachen. Samtalet har ingen fast inledning — det är frågan självt.
const VARMA = { beslut: AVGOR, efterat: FOLJD };

/// Bara en hämtning åt gången. Två parallella sexgigabytesströmmar gör
/// ingendera snabbare och båda långsammare.
let hamtarNu = null;
/// Starten hämtar båda modellerna. Satt medan det pågår — se /api/start/hamta.
let startHamtar = null;
import { GENERALISERA, blevVagare, blevVagt, vadFinns, bedom as bedomRojning } from './lib/rojning.mjs';
import { stycken } from './lib/urval.mjs';
import { tillPdf } from './lib/pdf.mjs';
import { slaUpp, forbjuderSok, avgorWebb, antalKallor, arVarufraga, onskatAntal, grindaSokfraga, planera as planeraSok, anonymSokfraga, byggUnderlag } from './lib/uppslag.mjs';
import * as Kall from './lib/slaupp.mjs';
import * as Rubrik from './lib/rubrik.mjs';
import * as Vag from './lib/vag.mjs';
import * as Granska from './lib/granska.mjs';
import * as Dugerinte from './lib/dugerinte.mjs';
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

/// Sessionen som den skickas ut.
///
/// Bildernas byten stannar. En session med tre foton är tio megabyte, och
/// den hämtas vid varje omritning — bilderna har en egen väg och hämtas när
/// kortet ritas.
const utanBilder = s => ({
  ...s,
  filer: (s.filer || []).map(({ bild, ...f }) => ({ ...f, harBild: Boolean(bild) })),
});

/// Mediatypen ur filnamnet. Webbläsaren behöver veta vad den får.
const typAv = namn => ({
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.heic': 'image/heic', '.tiff': 'image/tiff', '.gif': 'image/gif', '.webp': 'image/webp',
}[String(namn).slice(String(namn).lastIndexOf('.')).toLowerCase()] || 'application/octet-stream');
import { klassa as klassaInfo, kraverGodkannande, arvaKlass, NIVAER } from './lib/klassning.mjs';
import { webbFinns, stangWebben, webblage, hamtaWebblasare, satVag, egenWebblasare, hamta as hamtaSida } from './lib/webb.mjs';
import { SORTER as MASKSORTER, PAKET, FORVAL, galler, paketFor } from './lib/grader.mjs';
import { grindSvarar } from './lib/grind.mjs';
import { sakerstallModell, stoppaModell, pausaModell, fortsattModell, modellFinns, vilkenModell, satModell, satModellfil, satKo, satFack, satKontext, KONTEXTER, kontexten, kontextTak, glomTak, satSocket } from './lib/modell.mjs';
import { dela, sammanfatta } from './lib/minne.mjs';
// `aterkalla` heter redan något här: återkallandet av öppna fönster.
// Två saker med samma namn i samma fil är två saker man blandar ihop.
import { aterkalla as hamtaTillbaka } from './lib/aterkall.mjs';
import * as Uppdatering from './lib/uppdatering.mjs';
import * as Hemvist from './lib/hemvist.mjs';
import * as Tillagg from './lib/tillagg.mjs';
import * as Artefakt from './lib/artefakt.mjs';
import * as Kontor from './lib/kontor.mjs';
import { lasbar } from './lib/meningar.mjs';
import * as Natfel from './lib/natfel.mjs';
import { VERSION } from './lib/version.mjs';

/// Var uppdateringar söks. Tom sträng = avstängt.
///
/// Manifestet är statiskt och innehåller version, datum och en signerad
/// filadress per plattform — formatet som tauri-plugin-updater läser.
const UPPDATERINGSADRESS = Hemvist.UPPDATERING;

/// 'dmg', 'karantan', 'ok' eller null (inte i appen, t.ex. provserver).
function appPlats(app = process.env.MAXIMUS_APP || '') {
  if (!app || !/\.app\//.test(app)) return null;
  if (app.startsWith('/Volumes/')) return 'dmg';
  if (app.includes('/AppTranslocation/')) return 'karantan';
  return 'ok';
}
import { las, granskaUppstart, adresser, HJALP } from './lib/flaggor.mjs';
import { nyckelLika, svarPaUtmaning, tillatenVard, utanHemligheter, notisArgument } from './lib/skydd.mjs';
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
import { utatGrind } from './lib/failclosed.mjs';
import * as Namnmodell from './lib/namnmodell.mjs';
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

/// En valfri utökning: lib/utokning/index.mjs, om den finns.
///
/// Servern fungerar utan den, och utan den är servern exakt det som står i
/// den här filen. Finns den får den haka i på bestämda ställen, och bara
/// där — allt den gör bor i den, också dess texter. Bara just den saknade
/// filen tystas: ett fel INUTI utökningen ska synas, inte se ut som en
/// utgåva utan den.
///
/// Det en utökning kan exportera (allt är valfritt):
///
///   HJALP            text som läggs till `--hjalp`
///   sparr(K)         en text att avbryta uppstarten med, eller null
///   fack(K)          hur många fack modellen ska delas i (förval 1)
///   ko(K, platser)   en kö framför modellen
///   koppla(c)        kopplar in den i servern; se `utokning` nedan
const Utokning = await import('./lib/utokning/index.mjs').catch(e => {
  if (e?.code === 'ERR_MODULE_NOT_FOUND' && String(e.message).includes('lib/utokning/index.mjs')) return null;
  throw e;
});
if (K.hjalp) { console.log(HJALP + (Utokning?.HJALP || '')); process.exit(0); }
// Utökningens spärr före allt annat: ingen data ska röras först.
{ const sparr = Utokning?.sparr?.(K) ?? null;
  if (sparr) { console.error(sparr); process.exit(2); } }

const dataDir = K.data || process.env.MAXIMUS_DATA || datakatalog();
const PORT = K.port;
// Startad av launchd (Fas 26, läget "kör i bakgrunden"): kör appens egen
// server redan väntar vi tills den stängs, och tar över då. Före allt annat
// — två servrar på samma data hade kört samma uppdrag två gånger.
if (process.env.MAXIMUS_LAUNCHD === '1') await Bakgrund.vantaPaPorten(PORT, { logg: m => console.log(m) });
if (K.modell) satModell(K.modell);
if (K.modellfil) satModellfil(K.modellfil);
if (K.kontext) satKontext(K.kontext);

/// Facken i modellen. Ett som förval: skrivbordet ställer en fråga i taget.
/// En utökning kan be om fler, och då en kö framför modellen med lika många
/// platser. Fler platser än fack betyder bara att kön skickar iväg jobb som
/// llama-server ändå ställer i sin egen kö — och där syns de inte för den som
/// väntar.
const FACK = Number(process.env.MAXIMUS_FACK || Utokning?.fack?.(K) || 1);

/// Satt av användaren via strömpanelen. Vakten respekterar båda: en modell
/// som någon stängt av eller pausat ska inte starta om av sig själv.
let modellAvstangd = false;
let modellPausad = false;
satFack(FACK);
const ko = Utokning?.ko?.(K, FACK) ?? null;
if (ko) satKo(ko);


satKatalog(join(dataDir, 'modeller'));
// Modellens socket ligger i Maximuss egen katalog, inte i /tmp: där kan vem som
// helst på datorn skapa filer, och katalogen går att byta ut under fötterna.
await satSocket(join(dataDir, 'modell.sock'));


await mkdir(join(dataDir, 'sessioner'), { recursive: true });
await mkdir(join(dataDir, 'liggare'), { recursive: true });

const maximus = new Maximus(dataDir);
await maximus.ladda().catch(() => {});
if (maximus.skyddat) await maximus.lasUppUrNyckelring().catch(() => {});

/// Felrapporterna (lib/felrapport.mjs). Utkasten och kvittona ligger i
/// Maximus som allt annat, krypterade när ett lösenord är satt.
///
/// Mottagaren är tom tills den är driftsatt, och bara https godtas (eller
/// loopback, för provet): en rapport ska inte kunna gå okrypterad över ett nät.
const rapportadress = (() => {
  try {
    const u = new URL(Hemvist.RAPPORTER);
    return u.protocol === 'https:' || (u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) ? u.href : '';
  } catch { return ''; }
})();
const rapportfil = join(dataDir, 'felrapporter.json');
/// E-postvägens godkända paket: nyckel `ägare:hash`, tio minuter i minnet.
const mejlGodkanda = new Map();
/// Lagret mot Mail. MAXIMUS_PROV_MEJL (bara prov) skriver vad som hade körts
/// till en fil i stället, så att webbläsarprovet inte öppnar riktiga mejl.
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
  // Varje försök står i liggaren med exakt kroppen som gick ut. Ett försök
  // som inte fick kvitto är också trafik.
  liggare: ({ kropp, kvitto, fel, agare, sekunder }) => {
    const ut = JSON.stringify(kropp);
    return liggare({ frontier: tx('srv.felrapport.liggare.mottagare'), vag: 'rapport', skickat: ut,
      mottaget: kvitto ? tx('srv.felrapport.liggare.mottaget', { nummer: kvitto.nummer }) : tx('srv.felrapport.liggare.misslyckades', { fel: fel?.message || '' }),
      tecken: ut.length, sekunder, anvandare: agare && agare !== 'en' ? agare : null, session: null, aktor: tx('srv.helig.duTitel') });
  },
});

/// Utökningen, inkopplad; null utan en. Sammanhanget är funktioner, för
/// flera av namnen deklareras längre ned och läses först när ett anrop kommer.
///
/// Det den kopplade utökningen kan bära (allt är valfritt, och servern frågar
/// bara när `identitet` är sant om det som rör den som frågar):
///
///   identitet                 sant när utökningen säger vem som frågar
///   vemAr(req)                den som frågar, eller null
///   sessionsKatalog(id)       var den personens sessioner bor
///   agare()                   alla som har sessioner
///   far(jag, vad)             om den som frågar får göra `vad`
///   nekad(vad, varden)        beskedet när den inte får det
///   grind(res, vag, jag)      svarar själv (och sant) när vägen är stängd
///   fore(req, res, url, vag)  vägar före nyckeln; sant om den svarat
///   las(req, res, url, vag, jag)          GET-vägar; sant om den svarat
///   rutt(req, res, url, vag, jag, kropp)  vägar med kropp; sant om den svarat
///   utanUpplasning(vag)       vägar som får svara ur ett låst maximus
///   yta                       en modul i public/ som gränssnittet laddar
///   startlogg(), etikett, organisation
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
/// Säger utökningen vem som frågar? Annars är det du: skrivbordet har en
/// användare, ingen inloggning och en enda katalog med sessioner.
const IDENTITET = Boolean(utokning?.identitet);

/// Sessionerna, och var de bor.
///
/// Skrivbordet har en katalog. När utökningen säger vem som frågar har var
/// och en sin, och en sessions id räcker inte för att komma åt den — ägaren
/// kontrolleras vid varje anrop. Utan det hade en gissad UUID varit nyckeln
/// till någon annans ärende.
const sessioner = new Map();
const sessionsKatalog = agare =>
  IDENTITET ? utokning.sessionsKatalog(agare) : join(dataDir, 'sessioner');
/// Är sessionen den som frågar sin? Alltid, när ingen utökning säger vem.
const egen = (s, jag) => !IDENTITET || s.agare === jag?.id;
/// Sessionen jag får röra.
///
/// ── Förseglat är förseglat, som förval ────────────────────────────────────
///
/// Varje väg som läser innehåll hade sin egen `stangd()`-kontroll, och två
/// hade den inte: `/api/forbered` och `/api/tolka`. Revisionen 2026-09-29
/// (H7) skickade en gammal förseglad sessions id till `/api/forbered` och
/// fick **200 och kartoriginalet i svaret** — utan koden. Kartan är svaret
/// på "vem är [NAMN A]", och den lämnades ut ur en session som var låst.
///
/// Felet är inte att någon glömde en rad. Det är att raden måste skrivas
/// för hand på varje väg: en handskriven lista av kontroller bredvid den
/// riktiga strukturen, samma form som bitit åtta gånger förut.
///
/// Alltså vänd: en förseglad session lämnas INTE ut. Den som behöver stubben
/// — upplåsningen, och de vägar som bara rör yttre fält och har sitt eget
/// besked — måste be om den, synligt, i anropet.
/// Får den som frågar göra `vad`? Utan en utökning som säger vem som frågar
/// är svaret alltid ja: på skrivbordet finns bara du, och allt är ditt.
const far = (jag, vad) => !IDENTITET || Boolean(utokning.far?.(jag, vad));

/// Som far(), men svarar själv med 403 och utökningens besked när svaret är
/// nej. Sant betyder att svaret är skickat och vägen ska sluta.
///
/// En funktion och inte en kontroll per väg: tre handskrivna kontroller
/// blev en gång två (revisionen 2026-09-29, H2) — liggarvyn hade sin,
/// exporten hade ingen, och samma innehåll gav olika svar på olika vägar.
function nekas(res, vad, varden = {}, jag = jagNu) {
  if (far(jag, vad)) return false;
  json(res, 403, { error: utokning.nekad?.(vad, varden) || tx('srv.fel.finnsInte') });
  return true;
}

/// Den som frågar just nu. Sätts per anrop, så att nekas() slipper bäras
/// runt som argument genom varje rutt.
let jagNu = null;

const minSession = (id, jag, { forseglad = false } = {}) => {
  const s = sessioner.get(id);
  if (!s) return null;
  if (!egen(s, jag)) return null;
  if (!forseglad && stangd(s)) return null;
  return s;
};
/// Inställningar. Krypterade som allt annat — hur någon vill bli tilltalad
/// är en personuppgift, och att den ligger i en inställningsfil gör den inte
/// till något annat.
/// Inställningarna som de ser ut innan Maximus öppnats.
///
/// Låsningen behöver något att återställa TILL. Objektet bar policytext och
/// proxylösenord kvar i minnet efter ett lås, och ett lås som lämnar kvar det
/// man låste in är ingen låsning. `klar` står kvar: att guiden är genomgången
/// är inte en hemlighet, och utan den möts den som låst sitt maximus av
/// onboardingen igen.
/// Sessionens behandling, alltid en giltig.
///
/// Sessioner sparade före de två kontrollerna bär bara `lage`. De översätts
/// här i stället för att migreras på disk: en migrering som skriver om varje
/// session är en migrering som kan gå sönder halvvägs, och översättningen är
/// billig nog att göra vid läsning.
///
/// `stall()` sist, alltid. Också en session vars fält någon redigerat för
/// hand ska landa på något som får finnas.
function valet(s) {
  if (!s) return { behandling: Behandling.stall(installningar.behandling) };
  return { behandling: Behandling.franGammalt({
    behandling: s.behandling, destination: s.destination,
    lage: s.lage || installningar.lage, utanMask: installningar.utanMask === true }) };
}

/// Behandlingen som gäller just nu: sessionens val när en molnmodell svarar,
/// null när den lokala gör det (Auro 2026-10-10, se Behandling.gallande).
/// Valet står kvar på sessionen och gäller igen när molnet slås på — mitt i
/// ett samtal också, för det här läses vid varje anrop.
///
/// Det som ändå lämnar datorn med den lokala modellen — sökfrågor, sidor,
/// verktygsanrop — läser aldrig det här. Det går genom grinden, alltid.
const behandlingNu = s => Behandling.gallande(valet(s).behandling, { moln: molnPa() });

const TOMMA_INSTALLNINGAR = { namn: '', lage: 'noggrann', policy: '',
  // `uppdateringar` saknas med avsikt (granskningen 2026-10-09): ett förval
  // `true` gjorde att frågan aldrig ställdes och appen ringde hem ändå.
  // Odefinierat = inte frågat än; sökningen är ett ja användaren ger.
  webb: 'auto', sessionsgallring: 0, paket: FORVAL, sorter: null, klar: false, gallring: 0,
  persona: PERSONA_FORVAL,
  // Vilken motor man öppnar i. Tom tills man valt.
  motor: null,
  // Vad agenten fått tillgång till. Allt av från början — se AGENT_AV.
  agent: null,
  // Vem du är, vad du arbetar med, vad du vill uppnå. Se lib/profil.mjs.
  // Den lämnar aldrig datorn.
  profil: null,
  // Appens exempel, omskrivna efter din profil. Se lib/sprak.mjs.
  exempel: null,
  // Vilket öra som skriver av tal. Svenska som förval — appen är svensk.
  ora: 'svensk',
  behandling: Behandling.BEH_FORVAL };

let installningar = { namn: '', lage: 'noggrann', policy: '', webb: 'auto',
  paket: FORVAL, sorter: null, klar: false, persona: PERSONA_FORVAL,
  behandling: Behandling.BEH_FORVAL,
  // Noll betyder att ingenting gallras, och det är förvalet.
  //
  // Varje kommun måste fatta eget gallringsbeslut i egen nämnd efter samråd
  // med arkivmyndigheten — det finns ingen nationell genväg. Produkten
  // fattar inte beslutet, den verkställer det. En organisation som inte
  // fattat något beslut ska inte få ett verkställt åt sig.
  gallring: 0 };
/// Bevakningarna. Se lib/bevakning.mjs.
///
/// Ligger i Maximus som allt annat: en bevakning säger vilka lagrum någon
/// arbetat med, och det är en uppgift om ärendena.
let bevakningar = [];

/// Projekten.
///
/// En mapp som samlar sessioner. Poängen är inte ordning för ordningens
/// skull — det är att en fråga i ett projekt kan få svar ur allt som redan
/// sagts i samma projekt. Femton samtal om samma upphandling är femton
/// halva minnen; tillsammans är de ett.
///
/// Namnet är allt som sparas här. Vilka sessioner som hör till står på
/// sessionerna själva, för det är där de bor — och en session som raderas
/// ska inte lämna ett spår i en lista någon annanstans.
let projekt = [];
const projektfil = () => join(dataDir, 'projekt.json');
const sparaProjekt = async () =>
  maximus.skrivFil(projektfil(), JSON.stringify(projekt)).catch(() => {});

const bevakningsfil = () => join(dataDir, 'bevakning.json');
const sparaBevakning = async () =>
  maximus.skrivFil(bevakningsfil(), JSON.stringify(bevakningar)).catch(() => {});

/// Uppdragen. Se lib/uppdrag.mjs.
///
/// Krypterade som allt annat: ett uppdrag bär instruktionen ordagrant, och
/// "bevaka allt som rör Lindqvist" är en personuppgift lika mycket som
/// brevet det handlar om.
let uppdrag = [];
const uppdragsfil = () => join(dataDir, 'uppdrag.json');
const sparaUppdrag = async () =>
  maximus.skrivFil(uppdragsfil(), JSON.stringify(uppdrag)).catch(() => {});

/// Agentens fynd, och det den lagt åt sidan.
///
/// Två listor och inte en, för att de läses på olika sätt: fynden är det du
/// öppnar appen för, det undanlagda är det du går tillbaka till när du
/// undrar om den missade något. Men BÅDA sparas. Frånvaro ur översikten får
/// aldrig betyda frånvaro ur inkorgen — se lib/agent.mjs.
let fynd = [], undanlagt = [];
const fyndfil = () => join(dataDir, 'fynd.json');
const sparaFynd = async () =>
  maximus.skrivFil(fyndfil(), JSON.stringify({ fynd, undanlagt })).catch(() => {});

/// Taket på vad som sparas. Fynden är en inkorg, inte ett arkiv — det
/// riktiga arkivet är källan de pekar på.
const FYNDTAK = 500, UNDANTAK = 500;

/// Agentens egen liggare: vad varje slag gjorde.
///
/// Regeln är "ingen tyst tystnad". Hoppade den över ett varv, pausade en
/// sida, eller fick inget minne — det ska stå någonstans. Utan den här
/// filen stod det bara i ett svar ingen läste, och en agent som är tyst av
/// fel skäl ser likadan ut som en agent som är tyst av rätt skäl.
///
/// Den är kort med flit. Det här är inte sändliggaren — ingenting här har
/// lämnat datorn — utan ett spår att läsa den dag något gått fel.
let agentspar = [];
const SPARTAK = 200;
const agentsparfil = () => join(dataDir, 'agentspar.json');
const sparaSpar = async () =>
  maximus.skrivFil(agentsparfil(), JSON.stringify(agentspar)).catch(() => {});

/// Fristerna. Se lib/frister.mjs.
///
/// Ingen frist börjar ticka utan att någon sagt när. MAXIMUS läser längden och
/// ankaret ur lagtexten — "tre veckor från den dag du fick del av beslutet" —
/// men vilken dag det var vet bara den som fick brevet.
let frister = [];
const fristfil = () => join(dataDir, 'frister.json');
const sparaFrister = async () =>
  maximus.skrivFil(fristfil(), JSON.stringify(frister)).catch(() => {});

/// Läser inställningarna ur Maximus.
///
/// Egen funktion sedan låset började tömma dem. Låsningen ersätter
/// `installningar` med TOMMA_INSTALLNINGAR — annars låg policytexten och
/// proxylösenordet kvar i minnet efter ett lås — men då måste varje väg
/// TILLBAKA in också läsa om dem, annars öppnar användaren ett maximus där
/// hennes inställningar ser bortglömda ut.
///
/// Det gällde också lösenordsvägen, som aldrig läste om. Buggen syntes inte
/// förrän locket gav en andra väg in och samma sak hände där.
async function aterlasInstallningar() {
  try { installningar = { ...installningar, ...JSON.parse(await maximus.lasFil(join(dataDir, 'installningar.json'))) }; }
  catch { /* första starten, eller inget sparat än */ }
  if (installningar.kontext && !K.kontext) satKontext(installningar.kontext);
  if (installningar.ora) satOra(installningar.ora);
  if (installningar.orafil) satEgetOra(installningar.orafil);
  Namnmodell.satNamnmodell({ pa: installningar.namnmodell });
  await aterstallModellval();
  return installningar;
}

/// Modellen användaren valde, efter en omstart.
///
/// `installningar.modell` skrevs vid varje val och hämtning men lästes
/// aldrig: efter en omstart körde Maximus förvalsfilen igen, vilken modell
/// man än valt. Hittat i Fas 4, 2026-10-03. Flaggan --modellfil vinner —
/// den som startat med den menar det.
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
catch { /* första starten */ }
// Flaggan vinner över inställningen; den som startat med --kontext menar det.
if (installningar.kontext && !K.kontext) satKontext(installningar.kontext);
if (installningar.ora) satOra(installningar.ora);
if (installningar.orafil) satEgetOra(installningar.orafil);
// Namnmodellen (2026-10-10): på om inget annat sagts. Den laddas
// först när maskeringen behöver den, se lib/namnmodell.mjs.
Namnmodell.satNamnmodell({ pa: installningar.namnmodell });
// Språket som gäller utanför anropen (hjärtslaget, agenten) från start.
await Sprakstod.valtCachat(installningar.sprak).catch(() => {});
await aterstallModellval();
const strommar = new Map();
setTimeout(() => aktiveraMoln().catch(() => {}), 0);
const oversikt = new Set();
const korningar = new Map();

/// Läser in allas sessioner. Ägaren står i filen, och kontrollen sker vid
/// varje anrop — inte här.
///
/// Körs om när Maximus låses upp: innan dess går filerna inte att läsa, och
/// det är hela poängen.
async function laddaSessioner() {
  sessioner.clear();
  const agare = IDENTITET ? await utokning.agare() : [null];
  for (const a of agare) {
    const kat = a ? sessionsKatalog(a) : join(dataDir, 'sessioner');
    for (const namn of await readdir(kat).catch(() => [])) {
      if (!namn.endsWith('.json')) continue;
      try {
        // En förseglad session öppnar sig inte här. Rubriken ligger i det
        // yttre kuvertet, innehållet i ett eget som bara koden öppnar.
        const s = await maximus.lasSession(join(kat, namn)).catch(async e => {
          if (!arForsegladUtanKod(e)) throw e;
          const yttre = JSON.parse(await maximus.lasFil(join(kat, namn)));
          const { kropp, ...huvud } = yttre;
          return { ...huvud, turer: [], forseglad: true };
        });
        if (a) s.agare = a;
        sessioner.set(s.id, s);
      } catch { /* Låst eller trasig — hoppa över. */ }
    }
  }
  if (uppstartKlar) await glomGlomda();
}

/// "Glöm efteråt" som inte hann glömmas: fönstret stängdes medan samtalet
/// stod öppet. Det glöms vid nästa start eller upplåsning, i stället för att
/// ligga kvar och se sparat ut (Fas 10).
///
/// Körs inte inifrån laddaSessioner() under själva uppstarten: den körs på
/// rad ~500, och taBortSession() når glomKod som deklareras som `const`
/// långt senare i filen — ett ReferenceError (TDZ) vid första start med ett
/// glömt samtal. Uppstarten kallar den i stället när servern lyssnar.
let uppstartKlar = false;
async function glomGlomda() {
  for (const s of [...sessioner.values()]) if (s.minne === 'glom') await taBortSession(s);
}

/// Ett samtals minne (Fas 10).
///
///   isolerat — förvalet. Samtalet vet bara vad som sägs i det.
///   minns    — det som svarar mot frågan ur dina tidigare samtal följer med,
///              som en bilaga genom samma grind som ett dokument.
///   glom     — samtalet tas bort när du lämnar det, och läses aldrig av
///              ett annat samtal.
///
/// Profilen gäller i alla tre. Den är vad du sagt om dig själv, inte vad du
/// sagt i ett ärende.
const MINNEN = ['isolerat', 'minns', 'glom'];
/// Tomma sessioner som samlats på hög.
///
/// Varje tryck på plus gav förut en ny rad, också när den förra aldrig
/// användes. Trettio rader som alla heter "Ny session" är ingen lista.
///
/// Bara helt orörda tas bort, och den nyaste får stå kvar så att den som
/// startar appen har en ruta att skriva i. Det finns per definition ingenting
/// att förlora i en tom session — men en påbörjad räknas inte som tom, och
/// fästa och låsta rörs aldrig.
async function stadaTomma() {
  const tomma = [...sessioner.values()]
    .filter(s => !(s.turer || []).length && !(s.filer || []).length
      && !s.fast && !s.las && !s.forseglad
      && (arNySession(s.titel) || !s.titel))
    .sort((a, b) => String(b.andrad || b.skapad).localeCompare(String(a.andrad || a.skapad)));
  let bort = 0;
  for (const s of tomma.slice(1)) {
    // sessionsKatalog() och inte en egen hopsatt sökväg. Den första
    // versionen byggde `anvandare/<id>/sessioner` för hand, filen låg
    // någon annanstans, unlink svalde felet — och samma sex sessioner
    // städades bort vid varje omstart utan att någonsin försvinna.
    try {
      await unlink(join(sessionsKatalog(s.agare), `${s.id}.json`));
      sessioner.delete(s.id);
      bort++;
    } catch (e) {
      // Går filen inte att ta bort ska sessionen stå kvar i listan. En rad
      // som försvinner ur gränssnittet men ligger kvar på disken kommer
      // tillbaka nästa start, och då är städningen en lögn.
      if (e.code === 'ENOENT') { sessioner.delete(s.id); bort++; continue; }
      console.log(`  kunde inte ta bort ${s.id}: ${e.message}`);
    }
  }
  return bort;
}

// Vägen ut sätts vid start, inte bara när den ändras. Annars gick första
// uppslaget efter en omstart direkt ut trots att proxyn stod vald.
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

/// Läser bevakningarna och härleder nya ur sessionerna.
///
/// Ingen orkar sätta upp bevakningar. Men varje svar som vilade på ett
/// lagrum ÄR en bevakning som skriver sig själv — MAXIMUS vet redan uri:n, för
/// den citerade den.
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

  // Brus som redan hunnit sparas städas bort en gång.
  //
  // "312 nya avgöranden hänvisar till Jordabalk" lades in innan regeln fanns
  // att räknaren bara gäller en paragraf. De träffarna är sanna men säger
  // ingenting om något ärende, och en lista där sju av sju rader är brus lär
  // användaren att inte titta. Träffar om ÄNDRAD text står kvar — de gäller
  // även en hel lag.
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

/// Kollar de bevakningar som är mogna.
///
/// Bara lagrummet lämnar datorn, aldrig frågan eller ärendet. En bevakning på
/// 6 kap. 7 § arbetsmiljölagen avslöjar inte att någon klämt handen.
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
        // Namnet läses en gång. "1977:1160" säger ingenting i en lista.
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

/// Morgonraden: fristerna först, rättskällan sedan.
///
/// En frist som går ut om tre dagar är viktigare än att en paragraf ändrats.
/// Ordningen i meningen är ordningen man ska läsa dem i.
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

// Var halvtimme, och en gång strax efter start. Rättskällan ändras inte på
// en timme, men den som just öppnat appen ska inte vänta ett dygn på att
// bevakningarna lär sig sitt utgångsläge.
setTimeout(() => kollaBevakningar().catch(() => {}), 20000).unref?.();
setInterval(() => kollaBevakningar().catch(() => {}), 30 * 60e3).unref?.();

// ── Hjärtslaget ───────────────────────────────────────────────────────────
//
// Agenten kör BARA medan appen är öppen. Servern dör när fönstret stängs —
// det byggdes 2026-10-01, nyckeln ur minnet och modellen släppt — och en
// loop som levde vidare hade rivit det. Det är inte en kompromiss:
//
//     MAXIMUS bevakar dig inte när du inte är där.
//
// Plus en ikapp-körning strax efter start: "medan du var borta hände det
// här." Det är ofta det man faktiskt vill ha.

/// Vad agenten fått tillgång till. Allt av från början.
///
/// Den läser din post. Att den gör det ska vara något du sagt ja till en
/// gång per källa, inte något som följde med en uppdatering.
const AGENT_AV = { epost: null, kalender: null, bevakning: false,
  anteckningar: null, sidor: false, behandling: 'maskerad', takt: 5,
  // Får agenten öppna ett samtal och börja arbeta? Av från början: det är
  // skillnaden mellan en sorterare och en kollega, och den ska vara ett val.
  // Självständig som förval (Fas 39); spaken finns kvar under Agenten.
  arbetar: true,
  // Agenten lägger klara samtal i arkivet (Fas 41). På från början.
  stadar: true, tempo: 'normal' };
const agentInst = () => ({ ...AGENT_AV, ...(installningar.agent || {}) });

/// Vad agenten minst behöver (2026-10-10): profilen och en källa. Saknas
/// något arbetar den inte alls — inga halva varv, inga tysta fel. Regeln
/// bor i public/behov.js och läses av gränssnittet också.
const agentBehov = () => agentBehover({ profil: installningar.profil, agent: agentInst() });
/// Beskedet när agenten är av, på det språk som gäller.
const behovText = (b = agentBehov()) => tx('srv.behov.av', { vad: ochLista(b.saknar.map(x => tx(`srv.behov.${x}`))) });
/// 409 med beskedet och vad som saknas, för vägarna som annars hade kört.
const behovSvar = (res, b = agentBehov()) => json(res, 409, { error: behovText(b), behov: b });

/// Läser agentens tillgång ur det som kommit in. Fält för fält.
///
/// Det som inte går att känna igen blir av. En källa agenten inte fått är
/// en källa den inte läser, och tvivelsmålet faller åt det hållet.
function agentUr(v) {
  if (!v || typeof v !== 'object') return null;
  const ut = {};
  // Flera konton och kalendrar, var och en med sin etikett (2026-10-10).
  // Den gamla formen ({ konto, lada }, kalendrar som namn) läses också:
  // lib/konton.mjs gör en lista med ett av den.
  const epost = Konton.epostUr(v.epost);
  if (epost) ut.epost = epost;
  if (v.kalender) ut.kalender = Konton.kalenderUr(v.kalender);
  if (v.anteckningar?.mapp) ut.anteckningar = { konto: String(v.anteckningar.konto || '').slice(0, 120),
    mapp: String(v.anteckningar.mapp).slice(0, 120),
    // Skriv är ett eget beslut per mapp, och förvalet är läs.
    skriv: v.anteckningar.skriv === true };
  ut.bevakning = v.bevakning === true;
  ut.sidor = v.sidor === true;
  if (v.meddelanden === true) ut.meddelanden = true;
  if (v.paminnelser === true) ut.paminnelser = true;
  if (v.samtal === true) ut.samtal = true;
  // Läsa sidan som är öppen i Safari (Fas 46). Av från början.
  if (v.safari === true) ut.safari = true;
  // Följa löpande (Fas 49): LinkedIn och flödet, efter ditt ja. Av från början.
  if (v.lopande === true) ut.lopande = true;
  if (typeof v.mapp?.sokvag === 'string' && v.mapp.sokvag.startsWith('/')) ut.mapp = { sokvag: v.mapp.sokvag.slice(0, 500) };
  // Flera mappar (Fas 35). Sökvägarna prövas som den ensamma: absoluta, och
  // högst trettio.
  if (Array.isArray(v.mappar)) ut.mappar = v.mappar.filter(m => typeof m?.sokvag === 'string' && m.sokvag.startsWith('/'))
    .slice(0, 30).map(m => ({ sokvag: m.sokvag.slice(0, 500), namn: m.namn ? String(m.namn).slice(0, 80) : null }));
  ut.arbetar = v.arbetar !== false;
  ut.stadar = v.stadar !== false;
  // Tempo (2026-10-06): hur hårt den får arbeta själv. Normal som förval.
  ut.tempo = Arbete.tempoUr(v.tempo);
  // Nyheter på hem (Fas 50): ett eget ja. Av från början.
  if (v.nyheter === true) ut.nyheter = true;
  // Till telefonen (2026-10-06): kanal och adress. Av från början.
  if (v.telefon && typeof v.telefon === 'object') {
    const kanal = Telefon.kanalUr(v.telefon.kanal);
    if (kanal !== 'av') ut.telefon = { kanal, till: Telefon.adressUr(v.telefon.till) };
  }
  if (Behandling.arBehandling(v.behandling)) ut.behandling = Behandling.stall(v.behandling);
  // Tempot bestämmer hur ofta agenten tittar (2026-10-09). Ett val, inte två.
  ut.takt = Arbete.TEMPON[ut.tempo].takt;
  // Proven håller klockan still (takt 0) för att styra varven själva.
  if (process.env.MAXIMUS_PROV === '1' && Number(v.takt) === 0) ut.takt = 0;
  return ut;
}

/// Läser en källa. Returnerar poster med `id` — utan id kan de inte kommas
/// ihåg, och då dyker samma brev upp varje slag.
async function lasKalla(k, { nu = new Date() } = {}) {
  const a = agentInst();
  if (k.typ === 'epost') {
    if (!Konton.epostKallor(a.epost).length) throw Agent.avstangd();
    // Varje konto och varje låda (2026-10-10), och varje brev bär sitt konto
    // och kontots etikett: sfären sätts av källan, och ett svar går från
    // just det kontot. Nyheternas källa (2026-10-09) tar bara utskick —
    // brev med List-Unsubscribe, eller en avsändare som är ett utskick.
    // Var brevet ligger, och om det är ett utskick: utskick får aldrig
    // något förslag på svar.
    return Konton.lasEpost(a.epost, { brev: Post.brev, antal: 60, nyhetsbrev: Boolean(k.nyhetsbrev),
      utskick: Svar.forslagsLage(installningar) !== 'av' });
  }
  if (k.typ === 'kalender') {
    if (!a.kalender) throw Agent.avstangd();
    // Två veckor, inte en: ett uppdrag inför ett möte om tio dagar såg det
    // inte förrän veckan innan (sett i genomgången med Auro 2026-10-05).
    const fran = new Date(nu); fran.setHours(0, 0, 0, 0);
    const till = new Date(fran); till.setDate(till.getDate() + 14); till.setHours(23, 59, 59, 0);
    // Bara de valda kalendrarna (2026-10-10), var och en med sin etikett.
    // Inga valda: alla, utan etikett, som förut.
    const h = (await Kalender.handelser({ fran, till })).map(x => ({ ...x, ...Konton.kalenderFor(a.kalender, x) })).filter(x => x.med);
    // `andrad` är med flit: ett möte som flyttas är nytt för dig, med samma
    // id. Se stampel() i lib/agent.mjs.
    // Kalenderhändelser heter `rubrik`, inte `titel`. Här stod x.titel, och
    // agenten såg varje möte som "(utan rubrik)" (sett 2026-10-05). Tid,
    // plats och kallade följer med, så att sorteringen vet vad mötet är.
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
  // En sökning i bakgrunden (Fas 30): samma uppslag som i samtalet, med
  // varor (bild och pris) när det är något att köpa. Sidorna blir poster,
  // och vattenmärket på adressen gör att en bevakning bara säger det nya.
  if (k.typ === 'sok') {
    if (!a.sidor && installningar.webb === 'av') throw Agent.avstangd();
    await modellForAgenten();
    const lig = p => liggare({ ...p, anvandare: null, session: null, aktor: tx('srv.liggare.aktorAgenten') });
    const sidor = k.antal || (k.varor ? 8 : 6);
    // Samma grind som allt som lämnar datorn; agenten har ingen utat().
    const r = await slaUpp(grindaSokfraga(k.fraga, { sorter: galler(installningar) }) || 'sökning', { liggare: lig, varor: k.varor, sidor, minst: Math.min(sidor, k.antal || 3), varv: sidor > 6 ? 4 : 3 });
    return (r.kallor || []).map(x => ({ id: `sok:${x.url}`, titel: x.titel, url: x.url, fran: x.vard, tid: new Date().toISOString(),
      text: `${x.vara?.pris ? `${tx('srv.kalla.pris', { pris: x.vara.pris, valuta: x.vara.valuta || 'kr' })}\n` : ''}${String(x.utdrag || '').slice(0, 1500)}`, vara: x.vara || null }));
  }
  // Ett ämne (Fas 29): källorna hittas första gången och sparas på
  // uppdraget; sedan läses de som flöden eller sidor. Kräver att agenten får
  // läsa webbsidor, eller att webben är på för assistenten.
  if (k.typ === 'amne') {
    // Nyheter (Fas 50) har ett eget ja: det öppnar ämnena i nyhetsuppdraget,
    // inte webben för något annat.
    if (!a.sidor && installningar.webb === 'av' && !(a.nyheter && k.nyheter)) throw Agent.avstangd();
    const lig = p => liggare({ ...p, anvandare: null, session: null, aktor: tx('srv.liggare.aktorAgenten') });
    const ra = url => hamtaRa(url, { liggare: lig });
    if (!k.kallmangd?.length) {
      k.kallmangd = await Amne.hittaKallor(grindaSokfraga(k.fraga, { sorter: galler(installningar) }) || k.fraga, {
        sok: async f => (await webbSokRa(f, { antal: 8, liggare: lig })).traffar || [], hamtaRa: ra });
      // k är samma objekt som i uppdraget: källmängden följer med när det sparas.
      await sparaUppdrag();
    }
    return Amne.lasKallmangd(k.kallmangd, { hamtaRa: ra, hamtaSida: url => hamtaSida(url, { tecken: 6000, liggare: lig }) });
  }
  if (k.typ === 'sida') {
    if (!a.sidor) throw Agent.avstangd();
    // Hämtad sida går genom stängslet som allt annat, och varje hämtning
    // bokförs i liggaren — att hämta en sida är utgående trafik.
    const r = await hamtaSida(k.url, { tecken: 12000,
      liggare: p => liggare({ ...p, anvandare: null, session: null }) });
    const text = String(r?.text || r || '');
    // En sida är EN post. Vattenmärket är dess innehåll: ändras texten är
    // sidan ny, annars inte.
    return [{ id: `sida:${k.url}`, titel: r?.titel || k.url, tid: new Date().toISOString(),
      andrad: createHash('sha256').update(text).digest('hex').slice(0, 16), text }];
  }
  // Meddelanden, samtal och en mapp (2026-10-04). Se lib/meddelanden.mjs
  // och lib/mappar.mjs. Läses på datorn; ingenting skrivs.
  if (k.typ === 'meddelanden') {
    if (!a.meddelanden) throw Agent.avstangd();
    return Meddelanden.meddelanden({ antal: 60 });
  }
  // Påminnelser (2026-10-05). Se lib/paminnelser.mjs.
  if (k.typ === 'paminnelser') {
    if (!a.paminnelser) throw Agent.avstangd();
    return Paminnelser.paminnelser({ dagar: 7 });
  }
  if (k.typ === 'samtal') {
    if (!a.samtal) throw Agent.avstangd();
    return Meddelanden.samtal({ antal: 60 });
  }
  if (k.typ === 'mapp') {
    // En mapp du gett lov till: den uppdraget pekar på, annars förvalet.
    const tillatna = [...(a.mappar || []), ...(a.mapp ? [a.mapp] : [])].map(m => m.sokvag);
    const sv = k.sokvag || a.mapp?.sokvag;
    if (!sv || !tillatna.includes(sv)) throw Agent.avstangd();
    return Mappar.filer(sv);
  }
  // Ditt LinkedIn-flöde (Fas 47 del 2): flikarna i Safari, som de står.
  // Lovet att följa löpande gäller just LinkedIn-flikarna; det allmänna
  // Safari-lovet (vilken flik som helst) krävs inte och ges inte av det.
  if (k.typ === 'flode') {
    if (!a.lopande) throw Agent.avstangd();
    if (process.platform !== 'darwin') return [];
    // Ett nej från Safari sägs som det är, med vägen förbi — samma ord som
    // när profilsidan läses.
    const skiljare = randomBytes(16).toString('hex');
    const ut = await new Promise((klar, fel) => execFileCb('/usr/bin/osascript', ['-e', Flode.applescript(skiljare)], { timeout: 30000, maxBuffer: 8e6 },
      (e, o, err) => (e ? fel(new Error(/JavaScript from Apple Events|Tillåt JavaScript|Allow JavaScript/i.test(String(err))
        ? tx('srv.safari.tillatJs')
        : tx('srv.safari.svaradeInte', { fel: String(err || e.message).trim().slice(0, 160) }))) : klar(String(o || '')))));
    // Ditt namn, så att dina egna inlägg inte läses som någon annans.
    let duNamn = null; try { duNamn = JSON.parse(await maximus.lasFil(join(dataDir, 'du.json')))?.profil?.namn || null; } catch { /* inget inläst */ }
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

/// Hur många sidor ett uppslag läser, och när det får sluta leta. Bad du
/// om ett antal letar den tills det är nått (eller taket), annars räcker
/// tre goda källor. Steget säger vilket som gäller.
function omfang(original) {
  const onskat = onskatAntal(original);
  const sidor = onskat || (arVarufraga(original) ? 8 : antalKallor(original));
  return { sidor, minst: onskat ? sidor : Math.min(3, sidor), varv: onskat && onskat > 6 ? 4 : 3,
    ...(onskat ? { onskat } : {}) };
}

/// Väcker en pausad modell. true om den svarar efter fortsätt; false om
/// den var borta (schemaläggaren tog den efter sina åtta timmar natten till
/// 2026-10-05) och en ny måste startas.
async function vackPausad() {
  let vaken = false;
  try {
    await fortsattModell();
    for (let i = 0; i < 20 && !(vaken = await grindSvarar()); i++) await new Promise(r => setTimeout(r, 250));
  } catch { /* processen finns inte längre */ }
  modellPausad = false;
  modellAvstangd = false;
  return vaken;
}

/// Hjärtslaget behöver modellen, också när vilan pausat den. Auro
/// 2026-10-05: "Hur ska heartbeat funka annars?" Pausad väcks den för
/// varvet och pausas igen efteråt. Borta startas en ny. Avstängd av dig
/// förblir den avstängd: knappen betyder av.
let pausaEfterVarvet = false;
let senastAgentModell = 0;
let fonsterAnslot = () => {};
async function modellForAgenten() {
  senastAgentModell = Date.now();
  // Med molnmodellen behövs ingen lokal modell för agentens varv.
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

// ── Handlingar (Fas 32) ───────────────────────────────────────────────────
// Förslagen som väntar på ditt ja, och det som gjorts. Se lib/handlingar.mjs.
// MAXIMUS_HANDLING_PROV=1 (bara prov): handlingarna skrivs upp men utförs
// inte — ett prov ska aldrig lägga något i användarens Påminnelser eller Mail.
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
const handlingsvagar = () => {
  if (PROV_HANDLING) {
    const prov = vad => async a => ({ id: `prov-${randomUUID().slice(0, 8)}`, prov: true, vad, a });
    return { skriv: (v, a) => prov(v)(a), taBort: async id => ({ borttagen: id, prov: true }), mejlutkast: prov('mejlutkast'), anteckning: prov('anteckning'), genvag: prov('genvag') };
  }
  const a = agentInst();
  return {
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
/// Utför ett förslag, skriver det i liggaren och berättar för fönstret.
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
/// Förslaget står också på turen det hör till, så att samtalet visar läget.
async function speglaHandling(f) {
  const s = f.session && sessioner.get(f.session);
  // Ett förseglat eller låst samtal rörs inte; förslaget lever i listan ändå.
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

// ── Svarsförslag och Skicka (2026-10-10) ─────────────────────────────────
// Agenten föreslår svar på mejl som väntar på dig; du redigerar och trycker
// Skicka. Se lib/svar.mjs (vilka brev, prompterna), lib/svarsko.mjs (tio
// sekunder att ångra) och lib/svarmail.mjs (svaret i Mail). Inget härifrån
// är ett verktyg: agenten och modellen kan skriva förslag, aldrig skicka.
//
// Proven (MAXIMUS_PROV=1 eller MAXIMUS_HANDLING_PROV=1) rör aldrig Mail:
// skripten skrivs upp i `svarProv` och svaret låtsas.
let svarsforslag = [];
try { svarsforslag = JSON.parse(await maximus.lasFil(join(dataDir, 'svarsforslag.json'))); } catch { svarsforslag = []; }
const sparaSvarsforslag = () => maximus.skrivFil(join(dataDir, 'svarsforslag.json'), JSON.stringify(svarsforslag.slice(-200)));
const PROV_SVAR = process.env.MAXIMUS_PROV === '1' || PROV_HANDLING;
const svarProv = { skript: [], fel: null, skickade: 0 };   // skript: { skript, argv }
if (PROV_SVAR) {
  SvarMail.satKorare(async (skript, { argv = [] } = {}) => {
    svarProv.skript.push({ skript, argv });
    // En påhittad signatur, i skriptets egna skiljetecken.
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

/// Kända adresser och kontots egna, en gång i timmen. Bara mottagare läses.
const svarMinne = { kanda: null, mina: new Map(), nar: 0 };
async function svarAdresser(konto) {
  if (PROV_SVAR) return { kanda: new Set(), mina: new Set(['prov@example.com']) };   // proven läser aldrig din Mail
  if (Date.now() - svarMinne.nar > 36e5 || !svarMinne.kanda) {
    svarMinne.kanda = new Set(await Post.skrivitTill().catch(() => []));
    svarMinne.mina = new Map(); svarMinne.nar = Date.now();
  }
  if (!svarMinne.mina.has(konto)) svarMinne.mina.set(konto, new Set(await Post.kontoAdresser(konto).catch(() => [])));
  return { kanda: svarMinne.kanda, mina: svarMinne.mina.get(konto) };
}

/// Inkorgens session i Grunden, annars Agenten.
async function inkorgsSamtalet() {
  const helig = [...sessioner.values()].find(x => x.helig?.sort === 'epost' && !x.las && !x.forseglad && !x.arkiverad);
  return helig || agentSamtalet();
}

/// Den signatur som läggs till för kontot, och alla att välja bland.
async function svarSignatur(konto) {
  const lista = await SvarMail.signaturer().catch(() => []);
  const sparad = installningar.svar?.signaturer?.[konto];
  const vald = SvarMail.valjSignatur(lista, { adresser: [...(await svarAdresser(konto)).mina], sparad });
  return { signaturer: lista.map(x => ({ namn: x.namn, text: x.text.slice(0, 400) })), vald };
}

/// Ett förslag på svar på ett brev. `agenten`: undersök först (a2a) och
/// fråga om brevet alls får ett förslag; annars bad du om det själv.
async function foreslaSvar({ konto, lada = 'INBOX', id, session = null, agenten = false, u = null, text: egen = null }) {
  const fore = svarsforslag.find(f => f.konto === konto && f.brevId === String(id) && f.status === 'forslag');
  if (fore && agenten) return fore;
  const brev = await Post.text(konto, id, { lada });
  if (!brev) throw new Error(tx('srv.post.brevOlasbart'));
  const delat = Post.delaTrad(brev.text);
  const lage = Svar.forslagsLage(installningar);
  if (agenten) {
    const { kanda, mina } = await svarAdresser(konto);
    const b = Svar.behoverSvar({ brev, nytt: delat.nytt || brev.text, lage, kanda, mina, till: brev.till });
    if (!b.ja) return null;
  }
  // Din egen text (ett utkast ur samtalet): inget att fråga modellen om.
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
      // Obevakad: allt agenten vill göra blir förslag som väntar på ja, och
      // ingen handling kan skicka något.
      assistent: (fraga, om) => agentSlinga({ uppgift: fraga, sammanhang: om, session: null, obevakad: true, webb: false }),
    }).catch(() => null);
    slutsats = r?.slutsats?.text || '';
  }
  const text = Svar.lasForslag(await svaraLokalt(Svar.forslagsprompt({ brev, trad: brev.text, profil, slutsats, lage }),
    { plats: 'agent', tak: 700, timeout: 180000 }));
  // Agenten tiger om brevet inte behöver svar; bad du själv får du en tom ruta.
  if (!text && agenten) return null;
  const f = Svar.nyttForslag({ brev, konto, lada, etikett: Konton.kontoEtikett(agentInst().epost, konto), text: text || '', varfor: slutsats, session });
  if (fore) fore.status = 'ersatt';
  svarsforslag.push(f);
  await sparaSvarsforslag();
  return f;
}

/// Agentens förslag för det som just hittats i inkorgen, ett åt gången, i
/// bakgrunden. Raden står i Inkorgen med uppdragskortet.
let foreslar = false;
async function foreslaSvarFor(u, nya, nu = new Date()) {
  if (IDENTITET) return;   // med utökningen: ingen Mail att svara ur
  if (foreslar || Svar.forslagsLage(installningar) === 'av') return;
  const brev = nya.filter(f => f.brev?.konto && f.brev?.id && !f.svarsforslag);
  if (!brev.length) return;
  foreslar = true;
  try {
    for (const f of brev.slice(0, 5)) {
      if (korningar.size > 0) break;   // samtalet har företräde
      f.svarsforslag = 'provat';
      const fs = await foreslaSvar({ konto: f.brev.konto, lada: f.brev.lada || 'INBOX', id: f.brev.id, agenten: true, u }).catch(() => null);
      if (!fs) continue;
      f.svarsforslag = fs.id;
      const s = await inkorgsSamtalet();
      const tid = new Date().toISOString();
      // Inte `const tur = { id: randomUUID()`: sandgrans.test letar upp sändvägen på den raden.
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

/// Kön för Skicka. Ingenting når Mail förrän tio sekunder gått utan Ångra.
/// Kontots egna adresser: de enda som får stå som Bcc i svaret.
const svarEgna = async konto => (PROV_SVAR ? ['prov@example.com'] : Post.kontoAdresser(konto).catch(() => []));
const svarsko = skapaKo({
  skicka: async p => SvarMail.svara({ konto: p.konto, lada: p.lada, id: p.brevId, text: p.text, signatur: p.signatur, amne: p.amne,
    till: p.till, egna: await svarEgna(p.konto), skicka: true }),
  klar: async (p, { resultat, fel }) => {
    const f = p.forslag && svarsforslag.find(x => x.id === p.forslag);
    if (fel) {
      // Inget "skickat" på ett fel. Texten ligger kvar i rutan. Försöket
      // står ändå i liggaren: Mail kan ha fått det, och det ska gå att se.
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

/// Agentslingan med verktygen (Fas 28). Används av arbetet på tunga fynd,
/// av engångsuppdragen och av assistenten. Varje steg som lämnar datorn står
/// i liggaren, märkt som agentens.
///
/// `obevakad` (granskningen 2026-10-09): ingen människa driver slingan —
/// undersökningen av ett fynd, Grundens skanning, första genomgången,
/// djupdykningen. Förvalet är obevakad; bara chattens tur säger annat. Då
/// är varje handling ett förslag som väntar på ja (även "får göra"), ingen
/// genväg körs, och las_sida läser bara träffar ur samma slingas sökningar.
/// `webb: false` är samtalets eller turens eget nej till webben.
/// Ett brev som text: avsändare, ämne, tid, bilagor och brödtexten, med
/// tråden avskild. Samma form när du öppnar ett brev och när assistenten
/// läser originalet bakom ett fynd.
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

/// Originalet bakom ett fynd, via referensen (2026-10-10, lib/underlag.mjs).
///
/// Samma läsare och samma lov som agentens källor: kontot du gett agenten,
/// mappen du pekat ut, kalendern och anteckningarna om de är på. Ingenting
/// lämnar datorn här — ett mejl, en fil, en anteckning läses lokalt. En
/// sida hämtas inte härifrån: det gör verktyget, genom webbens grind.
/// Svarar null när originalet inte går att läsa; då gäller fyndets text.
async function lasOriginal(ref) {
  const a = agentInst();
  if (ref?.sort === 'mejl') {
    // Proven rör aldrig Mail (se PROV_SVAR nedan).
    if (process.env.MAXIMUS_PROV === '1' || process.env.MAXIMUS_HANDLING_PROV === '1') return null;
    // Ett av kontona OCH en av lådorna du gett agenten (granskningen
    // 2026-10-10): en referens till Skickat i samma konto är inte inom lovet.
    if (!Post.finns() || !Konton.epostKallor(a.epost).some(x => x.konto === ref.konto && x.lada === (ref.lada || 'INBOX'))) return null;
    const brev = await Post.text(ref.konto, ref.id, { lada: ref.lada || 'INBOX' });
    return brev ? brevSomText(brev) : null;
  }
  if (ref?.sort === 'fil') {
    // Bara inom mapparna du gett lov till, med verkliga sökvägar på båda
    // sidor (samma regel som las_fil i lib/verktyg.mjs).
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

async function agentSlinga({ uppgift, sammanhang = '', onSteg = () => {}, signal, session = null, tur = null, styrning = false, publika = [], steg = null, begransad = false, obevakad = true, webb = true, underlag = [] } = {}) {
  await modellForAgenten();
  const lig = p => liggare({ ...p, anvandare: null, session, aktor: tx('srv.liggare.aktorAgenten') });
  const a = agentInst();
  const ctx = {
    lasKalla: async typ => {
      const poster = await lasKalla(typeof typ === 'string' ? { typ } : typ);
      // Mejlen bär bara rubriken i listan. De fem första får sin text, så
      // att agenten kan läsa vad som står och inte bara vad det heter.
      // Ur det konto och den låda brevet ligger i (2026-10-10).
      // Samtidigt och med en tidsgräns (punkt 10), som originalen.
      if (typ === 'epost') {
        const med = poster.filter(x => x.brev?.konto).slice(0, 5);
        const texter = await Underlag.lasManga(med, p => Post.text(p.brev.konto, p.brev.id, { lada: p.brev.lada || 'INBOX' }).then(t => String(t?.text || t || '').slice(0, 1500)));
        med.forEach((p, i) => { if (texter[i]) p.text = texter[i]; });
      }
      return poster;
    },
    kalender: o => Kalender.handelser(o),
    webbSok: async fraga => {
      // Webben är av för assistenten och agenten får inte läsa sidor: då
      // söker slingan inte heller. Och aldrig för en text från telefonen.
      if (begransad) throw new Error(tx('srv.verktyg.inteTelefon'));
      if (!webb) throw new Error(tx('srv.verktyg.webbenAv'));
      if (installningar.webb === 'av' && !a.sidor) throw new Error(tx('srv.agent.webbenAv'));
      // Vägvalet (Fas 37): webb eller inte, och original, maskerat eller
      // anonymiserat — efter frågan OCH materialet agenten arbetar med.
      const val = vagval(fraga, { material: `${uppgift}\n${sammanhang}`, publika });
      onSteg({ verktyg: 'vagval', argument: { fraga }, kort: val.webb ? tx('srv.steg.vagvalWebb', { form: val.form, varfor: val.varfor }) : tx('srv.steg.vagvalIngenWebb', { varfor: val.varfor }) });
      if (!val.webb || !val.fraga) return { val, traffar: [] };
      // Den maskerade och den anonymiserade går dessutom genom grinden, som allt annat.
      const ut = val.form === 'original' ? val.fraga : grindaSokfraga(val.fraga, { sorter: galler(installningar) });
      if (!ut) return { val, traffar: [] };
      const r = await webbSokRa(ut, { antal: 8, liggare: lig, signal });
      return { val: { ...val, fraga: ut }, traffar: r.traffar || [] };
    },
    // Samma val som sökningen (granskningen 2026-10-09): förut hämtade
    // slingan sidor med webben av, och en länk i ett mejl blev ett läskvitto.
    webbHamta: async url => {
      if (begransad) throw new Error(tx('srv.verktyg.inteTelefon'));
      if (!webb) throw new Error(tx('srv.verktyg.webbenAv'));
      if (installningar.webb === 'av' && !a.sidor) throw new Error(tx('srv.agent.webbenAv'));
      return hamtaSida(url, { tecken: 6000, liggare: lig, signal });
    },
    // Den främsta fliken i Safari, läst med Apple Events (Fas 46). Kräver att
    // "Tillåt JavaScript från Apple Events" är på i Safari; saknas det säger
    // felet precis det.
    safari: () => (begransad ? Promise.reject(new Error(tx('srv.verktyg.inteTelefon'))) : lasSafari()),
    lasFil: async fil => (await lasDokument(fil.split('/').pop(), await readFile(fil))).text.slice(0, 12000),
    genvagar: () => new Promise(los => execFileCb('/usr/bin/shortcuts', ['list'], { timeout: 15000 }, (e, ut) => los(e ? [] : String(ut).split('\n').filter(Boolean).slice(0, 80)))),
    // Underlaget turen bär (2026-10-10): originalet via kortets referens.
    // En sida går genom webbHamta ovan, med webbens val och liggaren.
    underlag,
    lasUnderlag: k => (k.ref?.sort === 'sida' ? ctx.webbHamta(k.ref.url).then(x => x?.text || k.reserv).catch(() => k.reserv)
      : Underlag.lasHela(k, lasOriginal)),
  };
  // Handlingar (Fas 32): ett förslag, inte en handling — utom när du sagt
  // "får göra" om just den sortens handling.
  const skapade = [];
  ctx.foresla = async (typ, argument) => {
    const sp = Handlingar.spak(installningar, typ);
    if (sp === 'aldrig') return tx('srv.verktyg.aldrigFar', { handling: Handlingar.HANDLINGAR[typ].namn.toLowerCase() });
    const fel = Handlingar.validera(typ, argument, { genvagar: typ === 'genvag' ? await ctx.genvagar() : null });
    if (fel) return tx('srv.verktyg.fel', { fel });
    const f = Handlingar.nyttForslag({ typ, argument, session, tur });
    handlingar.push(f); skapade.push(f);
    // Från telefonen: alltid ett förslag som väntar på ditt ja vid datorn.
    // Obevakat: alltid ett förslag — också en genväg. Texten slingan läst
    // (ett mejl, en sida) kan ha valt både genväg och indata, och ingen ser på.
    const sjalv = sp === 'far' && !begransad && !obevakad;
    if (sjalv) { await utforHandling(f); return f.status === 'gjord' ? tx('srv.verktyg.gjort', { beskrivning: f.beskrivning }) : tx('srv.verktyg.fel', { fel: f.fel }); }
    await sparaHandlingar();
    await speglaHandling(f);
    return tx('srv.verktyg.foreslaget', { beskrivning: f.beskrivning });
  };
  const r = await Slinga({ uppgift, sammanhang, verktyg: [...(styrning && !obevakad ? styrverktyg({ text: uppgift }) : []), ...skapaVerktyg(ctx, a, { obevakad })], signal, onSteg, ...(steg ? { steg } : {}),
    anropa: o => verktygsanrop({ meddelanden: o.meddelanden, verktyg: o.verktyg, signal }) });
  return { ...r, handlingar: skapade };
}

/// Agentens modellanrop. Egen plats i modellen — se PLATSER i lib/lokal.mjs.
// ── Företrädet och varvets tak (punkt 10, 2026-10-10) ──────────────────
//
// Agentens anrop delar modell med samtalet du för. Förut frågades
// företrädet bara innan ett anrop började: en triage eller en
// sammanfattning som redan pågick fick tugga klart i upp till tre minuter
// medan ditt svar väntade. Nu avbryts det agenten håller på med när du
// börjar skriva, och det som avbröts görs nästa varv.
let agentKontroll = new AbortController();
/// Ett fel som säger att samtalet tog över. Visas aldrig som fel.
const foretradeFel = () => Object.assign(new Error('företräde'), { foretrade: true });
/// Samtalet börjar: allt agenten har igång avbryts.
function avbrytAgenten() {
  agentKontroll.abort(foretradeFel());
  agentKontroll = new AbortController();
}
/// Ett av agentens modellanrop, avbrytbart av samtalet. Ett avbrott blir
/// `foretradeFel`, som var och en hanterar som "ett samtal pågår".
async function agentAnrop(prompt, o = {}) {
  const signal = agentKontroll.signal;
  if (korningar.size > 0) throw foretradeFel();
  try { return await svaraLokalt(prompt, { plats: 'agent', timeout: 180000, ...o, signal }); }
  catch (e) { throw signal.aborted ? foretradeFel() : e; }
}
/// Hur länge ett varv får använda modellen innan resten av uppdragen väntar
/// till nästa varv. Ett varv över tjugo uppdrag med triage, sammanfattning,
/// sammanställning och rubriker var annars en halvtimme.
const VARV_MS = 6 * 60e3;

const agentTanka = async (prompt, { tak = 900 } = {}) => {
  await modellForAgenten();
  // Taket följer satsen (Agent.triageTak): 900 klippte 30 poster mitt i.
  return agentAnrop(prompt, { tak });
};

/// Läget i klartext för hjälpen: på eller av, aldrig vilket konto eller vem.
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
/// Klockans varv väntar på att ett pågående varv blir klart (se tick).
let hjartaSkuld = false;
/// Vilket uppdrag ett ensamt varv kör, för sidopanelens puls. null = alla.
let slarBara = null;
/// Ett hjärtslag över alla uppdrag.
///
/// `bara` kör ett enda uppdrag, nu, också om ett samtal pågår: det är du som
/// bett om det (ja till ett uppdrag, eller "Kör nu").
async function slaHjarta({ nu = new Date(), bara = null, handelse = false } = {}) {
  // Två skäl att inte slå, och de får inte se likadana ut utifrån. "Ett slag
  // pågår" och "Maximus är låst" är olika saker att göra något åt, och en
  // knapp som säger fel av dem skickar dig åt fel håll.
  if (slarNu) return { nej: 'pagar' };
  // Samma fråga som laddningen ställer (se raden med `!maximus.skyddat ||
  // maximus.upplast`): har Maximus inget lösenord finns inget att låsa upp.
  // `!upplast` ensamt stämde bara för den som satt ett lösenord, och gjorde
  // hjärtslaget tyst för alla andra — med ett felmeddelande som dessutom sa
  // fel sak.
  if (maximus.skyddat && !maximus.upplast) return { nej: 'last' };
  // Grinden: utan profil och källa inget varv alls. Hjärtslaget, "Kör nu",
  // händelserna, nyheterna och undersökningen går alla genom här.
  const behov = agentBehov();
  if (!behov.klar) return { nej: 'behover', behov };
  slarNu = true;
  // Pausat till ett datum (Fas 33: "pausa allt till måndag"): igång igen
  // när datumet passerat.
  for (const [i, x] of uppdrag.entries()) {
    // Uppdrag som pausades av fel före 2026-10-09 har ingen pausTill: de
    // försöker igen sex timmar efter sista felet, som de nya.
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
  // Det som gör en nyhet eller ett inlägg riktat mot dig (2026-10-10): ditt
  // namn, ditt företag. Läses en gång per varv, ur du.json och profilen.
  let duFil = null; try { duFil = JSON.parse(await maximus.lasFil(join(dataDir, 'du.json'))); } catch { /* inget inläst */ }
  const ankare = Sammanstallning.ankare({ du: duFil, profil: installningar.profil, namn: [installningar.namn] });
  const varvStart = Date.now();
  const overTak = () => !bara && Date.now() - varvStart > VARV_MS;
  // macOS sa nej: en rad per källa och varv, i varvets notis (punkt 10).
  const nekade = new Map();
  try {
    for (let u of [...uppdrag]) {
      if (bara && u.id !== bara) continue;
      // Varvets tak (punkt 10): det som är dags men inte hinns med flyttas
      // inte fram, och körs nästa varv. Det står i spåret.
      if (overTak() && Uppdrag.farKoras(u, nu)) {
        hant.push({ uppdrag: u.id, titel: u.titel, fynd: 0, skal: tx('srv.agent.varvetFullt', { min: VARV_MS / 60e3 }) });
        continue;
      }
      // "Kör nu" kör nu, också ett pausat uppdrag (Auro 2026-10-05: "om jag
      // vill köra nu så vill jag ju köra nu"). Det körs en gång och står
      // kvar som pausat — när det kör av sig självt är fortfarande ditt val.
      const fore = u;
      const varPausad = bara && u.tillstand === 'pausad';
      if (bara) u = { ...u, nasta: new Date(nu).toISOString(), ...(varPausad ? { tillstand: 'vantar' } : {}) };
      // Företrädet frågas om PER UPPDRAG, inte en gång för hela varvet. Ett
      // varv över tjugo uppdrag tar tid, och börjar du skriva i mitten av
      // det ska agenten stiga åt sidan där och då.
      const r = await Agent.slag(u, {
        // Uppdragets filter: bara det som passar läses (lib/schema.mjs).
        las: k => lasKalla(k, { nu }).then(p => (u.filter ? p.filter(x => Schema.passar(x, u.filter)) : p)),
        tanka: agentTanka,
        // Profilen, inte policyn. Policyn är regler för hur något SKRIVS;
        // profilen är vem agenten sorterar åt. De är inte samma sak, och
        // triagen fick fel av de två i en månad.
        profil: malet(u),
        ankare,
        // En händelse väntar in ett pågående samtal, som klockans varv gör;
        // bara "Kör nu" går före.
        samtalArbetar: bara && !handelse ? false : korningar.size > 0,
        nu,
      }).catch(e => ({ fel: e.message || String(e), uppdrag: u, fynd: [] }));

      if (r.inteDags) continue;
      // macOS sa nej till en källa (2026-10-10): säg det EN gång, första
      // gången, med vad som saknas. Raden i listan har knappen till rätt ruta.
      if (r.uppdrag?.fel?.behorighet && r.uppdrag.fel.antal === 1 && !nekade.has(r.uppdrag.fel.behorighet)) nekade.set(r.uppdrag.fel.behorighet, u.titel);
      if (varPausad && r.uppdrag) r.uppdrag = { ...r.uppdrag, tillstand: 'pausad', nasta: fore.nasta };
      const i = uppdrag.findIndex(x => x.id === u.id);
      if (i >= 0 && r.uppdrag !== u) uppdrag[i] = r.uppdrag;
      if (r.fynd?.length) fynd = [...r.fynd, ...fynd].slice(0, FYNDTAK);
      // Ett fynd blir ett samtal (Fas 12). Det agenten behållit — inte det
      // den lagt åt sidan, och inte det den aldrig bedömde.
      const behallna = (r.fynd || []).filter(f => !f.obedomd);
      // Nyheter och flödet (2026-10-10): det som riktas mot dig blir ett eget
      // fynd som förut; resten blir EN sammanställning för varvet.
      const iSamman = behallna.filter(f => f.sammanstallning && !f.riktad);
      const egna = behallna.filter(f => !iSamman.includes(f));
      const oppnaFel = e => { hant.push({ uppdrag: u.id, titel: u.titel, fynd: 0, fel: tx('srv.agent.kundeInteOppnaSamtal', { fel: e.message }) }); return null; };
      const varvet = { vagda: r.vagda || 0, undan: r.undanlagt?.length || 0 };
      const fsEgna = egna.length ? await fyndsamtal(r.uppdrag || u, egna, nu, varvet, { snabb: overTak() }).catch(oppnaFel) : null;
      const fsSamman = iSamman.length ? await fyndsamtal(r.uppdrag || u, iSamman, nu, varvet, { sammanstallning: true, snabb: overTak() }).catch(oppnaFel) : null;
      const fs = fsEgna || fsSamman;
      if (r.undanlagt?.length) undanlagt = [...r.undanlagt, ...undanlagt].slice(0, UNDANTAK);
      // Brev som väntar på svar får ett förslag (2026-10-10), efter varvet.
      if (behallna.some(f => f.brev && !f.brev.utskick) && !(u.kallor || []).some(k => k.nyhetsbrev)) svarJobb.push([r.uppdrag || u, behallna.filter(f => f.brev && !f.brev.utskick)]);
      // Allt som HÄNDE skrivs, också "inget nytt". Det är den raden som
      // skiljer "den tittade och det var tomt" från "den tittade aldrig".
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
    // Notis för det som lyftes fram (Fas 26). I fönstret när det är öppet,
    // annars i macOS Notiscenter, så att något som hänt medan appen var
    // stängd inte bara ligger och väntar.
    // EN notis per varv (punkt 10, 2026-10-10): förut en per uppdrag, en
    // per nekad källa, en för undersökningen och en för kollegan — fyra
    // ljud för ett varv. Till telefonen bara när något av det nya vägde
    // tyngst (vikt 3) — och ur nyheterna och flödet bara det som riktas mot
    // dig (Sammanstallning.narTelefonen).
    const notis = varvetsNotis(hant, nekade, nu);
    if (notis) notifiera(notis.titel, notis.text, notis.session, { viktigt: notis.viktigt });
    ikappSedan = null;
    // Efterarbetet (punkt 10): undersökningen (Fas 38), svarsförslagen och
    // kollegans förslag efter varandra, i bakgrunden — inte tre jobb mot
    // samma modellplats samtidigt. Vart och ett väntar in ett samtal du för.
    // Annars hade "Kör nu" väntat i minuter på något den inte bett om.
    setTimeout(() => efterVarvet({ svarJobb, nu, kollega: !bara && !PROV_KOLLEGA }).catch(() => {}), 1500).unref?.();
    await anslagstavlan(hant, nu);
    // Städningen (Fas 41) på det vanliga varvet, inte när ett enda uppdrag körs.
    if (!bara) await stada(nu).catch(() => {});
    if (!bara) await paminnOmExport(nu).catch(() => {});
    if (!bara) await stadaTelefonen().catch(() => {});
    if (!bara) await sakerstallNyheter().catch(() => {});
    // Slogs Safari på efter onboarding får flödet sitt uppdrag nu.
    if (!bara) await sakerstallFlode([...sessioner.values()].find(x => x.helig?.sort === 'du')).catch(() => {});
    // Samma varv två gånger skrivs en gång, med en räknare.
    //
    // En avstängd källa ger samma rad var femte minut, och tolv identiska
    // rader i timmen gör spåret oläsligt — vilket är samma sak som att inte
    // ha ett spår. Raden ska stå kvar, inte upprepas.
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
    // Vilan hade pausat modellen: tillbaka i paus efter varvet. Väckte du
    // appen under tiden nollställde fortsätt flaggan, och då står den kvar.
    if (pausaEfterVarvet && korningar.size === 0) {
      pausaEfterVarvet = false;
      try { modellAvstangd = true; await pausaModell(); modellPausad = true; sandAlla({ typ: 'modell', uppe: false, pausad: true }); }
      catch { modellAvstangd = false; }
    }
  }
  if (hant.some(h => h.fynd)) sandAlla({ typ: 'agent' });
  return hant;
}

/// Varvets notis: en, vad som än hänt (punkt 10, 2026-10-10). Ett uppdrag
/// med något nytt står med sitt namn; flera står som ett, med namnen i
/// texten. En källa macOS nekade läggs till på slutet. `viktigt` (till
/// telefonen) bara när något av det nya i varvet får gå dit.
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

/// Efter varvet, en sak i taget: undersökningen, svarsförslagen, kollegan.
let efterPagar = false;
async function efterVarvet({ svarJobb = [], nu = new Date(), kollega = true } = {}) {
  if (efterPagar) return;
  efterPagar = true;
  try {
    if (!undersoker) { undersoker = true; try { await arbeta([], new Date()); } catch { /* står i spåret */ } finally { undersoker = false; } }
    for (const [x, f] of svarJobb) await foreslaSvarFor(x, f, nu).catch(() => {});
    // Kollegans förslag (2026-10-10). Den väntar själv in tre timmar mellan
    // varven; proven kör den själva.
    if (kollega) await kollegaForeslar().catch(() => {});
  } finally { efterPagar = false; }
}

// Ikapp-körningen först, sedan takten. Trettio sekunder in: modellen hinner
// upp och den som just öppnat appen ska inte vänta en kvart på att få veta
// vad som hänt medan hon var borta.
//
// Takten är ett SVEP, inte ett schema. Varje uppdrag har sin egen takt (se
// lib/uppdrag.mjs); svepet är bara hur ofta det frågas om någon är dags. Två
// klockor för samma sak hade varit en klocka för mycket.
//
// Noll minuter betyder "bara när jag öppnar appen". Ikapp-körningen sker
// ändå — det är den som bär meningen.
/// Agenten arbetar.
///
/// Auro: "När agenten stöter på ett mail som ligger i mitt intresse så kan
/// den nyttja samtal till att faktiskt bolla."
///
/// Skillnaden mot en sammanfattning är hela poängen. En sammanfattning är
/// något du läser; ett påbörjat arbete är något du TAR ÖVER — det ligger som
/// ett samtal i projektet, med underlaget inlagt och ett resonemang påbörjat,
/// och du fortsätter där den slutade.
///
/// Gränsen går vid datorns kant. Allt som stannar här gör den; allt som
/// lämnar blir en fråga i notisdelen. Du ska kunna vakna till färdigt arbete,
/// inte till en kö av frågor — men ingenting ska ha lämnat datorn.
/// En undersökning av ett fynd (Fas 38): agenten frågar, assistenten svarar
/// med verktygen, högst tre varv, sedan en slutsats. Ett eget samtal, och en
/// rad med länk i Agenten.
async function undersokFynd(f, { nu = new Date() } = {}) {
  await modellForAgenten();
  const u = uppdrag.find(x => x.id === f.uppdrag);
  const tid = new Date(nu).toISOString();
  const s = { id: randomUUID(), titel: tx('srv.undersokning.titel', { titel: f.titel }).slice(0, 80), skapad: tid, andrad: tid, agare: null,
    projekt: u?.projekt || null, turer: [], karta: [], raknare: {}, avAgenten: true, a2a: true, uppdrag: f.uppdrag || null,
    etiketter: f.sfar ? [f.sfar] : [],
    minne: 'isolerat', webb: 'av', behandling: Behandling.stall(installningar.behandling) };
  // Underlaget först (Auro 2026-10-10): det du ser i samtalet är vad
  // agenten undersöker — kortet med referensen till originalet — och inte
  // bara agentens fråga utan det den syftar på. Originalet läses lokalt.
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
    // Kortet följer med, så att assistenten kan läsa resten av originalet
    // (las_underlag) och inte bara det som valdes mot frågan.
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
  const sl = r.slutsats;
  const slut = { id: randomUUID(), tid: new Date().toISOString(), fraga: '', av: 'maximus', avAgenten: true, status: 'klar',
    sager: tx('srv.undersokning.slutsats', { sakerhet: sl.sakerhet, text: sl.text, oppet: sl.oppet ? tx('srv.undersokning.oppet', { oppet: sl.oppet }) : '' }), svar: '', kvitto: [], kallor: [] };
  s.turer.push(slut); s.andrad = slut.tid; await spara(s);
  sand(s.id, { typ: 'agenttur', session: s.id, tur: slut });
  // Raden i Agenten: vad som undersöktes, slutsatsen kort, och länken.
  const ag = await agentSamtalet();
  const rad = { id: randomUUID(), tid: slut.tid, fraga: '', av: 'maximus', avAgenten: true, status: 'klar', uppdrag: f.uppdrag || null,
    sager: tx('srv.undersokning.rad', { titel: f.titel, n: Math.floor(r.rader.length / 2), text: sl.text }),
    undersokning: { session: s.id, sakerhet: sl.sakerhet }, svar: '', kvitto: [], kallor: [] };
  ag.turer.push(rad); ag.andrad = rad.tid; await spara(ag);
  sand(ag.id, { typ: 'agenttur', session: ag.id, tur: rad });
  sandAlla({ typ: 'lista' });
  // I fönstret, inte en notis till: fyndet fick redan varvets notis (och
  // telefonen, om det vägde så). En undersökning är något att läsa när du
  // ändå sitter där (punkt 10: en notis per varv).
  sandAlla({ typ: 'notis', titel: tx('srv.notis.undersokt', { titel: f.titel }), text: sl.text.slice(0, 140), session: s.id });
  await sparaFynd();
  return { session: s.id, slutsats: sl, varv: Math.floor(r.rader.length / 2) };
}

/// Agenten städar (Fas 41): klara samtal till arkivet, med skäl, högst en
/// gång var sjätte timme. Raden i Agenten säger vad och varför, och har en
/// knapp som tar tillbaka allt på en gång.
let senastStadat = 0;
async function stada(nu = new Date(), { tvinga = false } = {}) {
  if (!agentInst().stadar) return [];
  if (!tvinga && Date.now() - senastStadat < 6 * 36e5) return [];
  senastStadat = Date.now();
  const alla = [...sessioner.values()];
  // Låsta och förseglade rörs aldrig — kandidater() hoppar redan över dem,
  // och kontrollen står här också, där registret läses.
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
  // Raden får klockan som den är; `nu` är bara måttstocken för reglerna.
  const rad = { id: randomUUID(), tid: new Date().toISOString(), fraga: '', av: 'maximus', avAgenten: true, status: 'klar',
    sager: Stada.rapport(k), stadning: { ids: k.map(a => a.id) }, svar: '', kvitto: [], kallor: [] };
  ag.turer.push(rad); ag.andrad = rad.tid; await spara(ag);
  sand(ag.id, { typ: 'agenttur', session: ag.id, tur: rad });
  sandAlla({ typ: 'lista' });
  return k;
}

// ── Diktering (Fas 42) ──────────────────────────────────────────────────
// Hjälparen kräver macOS 26. Det paketerade programmet först; ur repot
// kompileras skriptet en gång till en cache, eftersom /usr/bin/swift
// kompilerar om vid varje start och en diktering inte kan vänta på det.
const dikteringar = new Map();
// Mötesanteckningar (Fas 43): en kö per möte, så att delarna skrivs ut i
// tur och ordning medan mötet fortsätter.
const moteKo = new Map();
// Dokument och presentationer som skrivs just nu (Fas 23), per samtal.
const leveranser = new Set();
// Djupdykningar som pågår (Fas 46), per samtal.
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
// Kompilera i förväg, så att första dikteringen inte väntar.
setTimeout(() => dikteraHjalpare().catch(() => {}), 5000).unref?.();
// En diktering som tystnat (fönstret stängt mitt i) stängs efter 30 s.
setInterval(() => {
  for (const [id, d] of dikteringar) if (Date.now() - d.tillstand.senast > 30000) { d.doda(); dikteringar.delete(id); }
}, 15000).unref?.();

/// Profilförslaget ur det du gett (Fas 47/49). Upp till tre försök: strax
/// efter en kall start svarar modellen att den är uppe innan den klarar ett
/// svar, och första analysen blev tom (sett 2026-10-05 i onboarding).
async function duForslag(du) {
  await modellForAgenten();
  for (let i = 0; i < 3; i++) {
    const r = await svaraLokalt(Du.profilPrompt(Du.somText(du)), { plats: 'efterat', tak: 900, timeout: 240000 }).catch(() => '');
    const f = Profil.lasForslag(r);
    if (f && (f.vem || f.arbetar)) {
      // Förslagets avtryck (/du, 2026-10-10): sparar du det som det står
      // vet banken att fältet kom ur LinkedIn eller cv:t, inte ur dig.
      // Bara avtrycket — texten står redan där den ska.
      if (du.kalla && du.kalla !== 'text') {
        await maximus.andraFil(join(dataDir, 'du.json'), d => (d ? { ...d, forslag: { kalla: du.kalla, avtryck: Banken.forslagsavtryck(f) } } : undefined)).catch(() => {});
      }
      return f;
    }
    await new Promise(v => setTimeout(v, 4000));
  }
  return null;
}

// ── Banken: /du (2026-10-10) ──────────────────────────────────────────────
//
// Vad Maximus vet om dig, på ett ställe, och rättat i fri text. Se
// lib/banken.mjs. Inget här lämnar datorn: tolkningen och sammanfattningen
// går till den lokala modellen (baraLokalt), och ett förslag ligger bara i
// minnet tills du sagt ja eller nej.

/// du.json som det står, eller null.
async function lasDu() {
  try { return JSON.parse(await maximus.lasFil(join(dataDir, 'du.json'))); } catch { return null; }
}

/// Det banken består av just nu, och raderna ur det.
async function bankLage(jag) {
  const du = await lasDu();
  const lage = { profil: Profil.las(installningar.profil), du, exempel: installningar.exempel || null };
  const minns = [...sessioner.values()].filter(x => (x.agare || null) === (jag?.id || null) && x.minne === 'minns' && !x.las && !x.forseglad).length;
  const rader = Banken.uppgifter({ ...lage, uppdrag: uppdrag.map(u => ({ id: u.id, titel: u.titel, instruktion: u.instruktion })), minns });
  return { lage, rader };
}

/// Förslag som visats men inte besvarats: id → { ops, avtryck, agare, tid }.
/// Bara i minnet. En omstart glömmer dem, och det är rätt — "glöm allt om
/// Z" ska inte ligga på disk och vänta på ditt ja.
const bankForslag = new Map();
const visatAvtryck = andringar => createHash('sha256').update(JSON.stringify(andringar)).digest('hex');
const BANK_FORSLAG_MS = 30 * 60e3;

/// Det du skrev, som ett förslag på ändringar: { forslag } eller { svar }
/// när inget behöver ändras. Ingenting ändras här. `fraga` är knack-
/// knackens fråga när texten är ett svar på den (lib/kollega.mjs) — samma
/// tolkning och samma godkännande som i /du.
async function bankTolka(jag, text, { fraga = '' } = {}) {
  const { lage, rader } = await bankLage(jag);
  let ops = [];
  const glom = Banken.glomUr(text);
  if (glom) ops = [glom];
  else {
    if (!(await grindSvarar())) return { forslag: null, error: tx('srv.banken.modellenSvararInte') };
    const svar = await svaraLokalt(Banken.tolkPrompt(text, rader, { fraga }), { plats: 'efterat', tak: 700, timeout: 120000, baraLokalt: true }).catch(() => '');
    ops = Banken.lasTolkning(svar, rader, { text: `${fraga}\n${text}` }) || [];
  }
  // Samtalen söks bara när något ska glömmas, och bara dina egna öppna.
  const samtal = ops.some(o => o.gor === 'glom')
    ? [...sessioner.values()].filter(x => (x.agare || null) === (jag?.id || null) && !x.las && !x.forseglad)
      .map(x => ({ titel: x.titel, text: (x.turer || []).map(t => `${t.fraga || ''}\n${t.svar || ''}\n${t.sager || ''}`).join('\n') }))
    : [];
  const r = Banken.tillamp(lage, ops, { uppdrag, samtal });
  const { antal: lager } = await glomAgentLager(ops);
  if (!r.andringar.length && !Object.keys(lager).length) return { forslag: null, svar: [tx('srv.banken.ingetAttAndra'), ...r.ovrigt].join('\n\n'), ovrigt: r.ovrigt };
  const id = randomUUID();
  for (const [k, v] of bankForslag) if (Date.now() - v.tid > BANK_FORSLAG_MS) bankForslag.delete(k);
  // Det du godkänner är exakt det du såg (granskningen 2026-10-10): också
  // ändringarnas avtryck sparas, så att ett "glöm" inte tar mer än
  // förhandsvisningen visade om något nytt hunnit komma in under tiden —
  // i profilen eller i agentens lager (punkt 10).
  bankForslag.set(id, { ops, avtryck: Banken.fingeravtryck(lage), visat: visatAvtryck([r.andringar, lager]), agare: jag?.id || null, tid: Date.now() });
  return { forslag: { id, andringar: r.andringar, ovrigt: r.ovrigt, lager, text: Banken.somText(r.andringar, r.ovrigt, lager) } };
}

/// "Glöm allt om Z" i agentens egna lager (punkt 10, 2026-10-10): fynden,
/// det undanlagda, kollegans minne, svarsförslagen, handlingarna, spåret och
/// raderna om telefonen. Räknas fram på kopior; `spara` skriver dem. Dina
/// samtal rörs inte här — förslaget säger var Z nämns i dem.
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

/// Du-raden i Grunden står kvar med det gamla tills den skrivs om. Den bär
/// profilens fält, och ett fält du tagit bort ska inte stå kvar där heller.
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

// ── Kollegan: förslag med skäl, och knack-knack (2026-10-10) ──────────────
//
// Se lib/kollega.mjs. Förslagen läser det agenten redan hittat — fynden med
// sina kort och etiketter — och kalendern runt i dag. Modellen är den
// lokala (baraLokalt): underlaget är din post och dina möten. Ett förslag
// skickar ingenting; svaret öppnas i svarsrutan, mötet går till Kalender
// som frågar, och ett "hör av dig" är en text att kopiera.
//
// Knacken går bara till fönstret: aldrig notifiera(), som går till
// Notiscenter när fönstret saknas och till telefonen när något är viktigt.

/// Bara proven (MAXIMUS_PROV=1): ett påhittat dygn och en påhittad vila.
/// Proven rör aldrig Kalender: utan påhittade möten finns inga.
const PROV_KOLLEGA = process.env.MAXIMUS_PROV === '1';
// `agent` är konton och kalendrar med etiketter för förslagen: provet ger
// dem här i stället för i inställningarna, där hjärtslaget hade läst Mail.
const kollegaProv = { fynd: null, moten: null, vilaSek: null, agent: null };

/// Det du sagt om förslagen och frågorna (kollega.json). Läses när det
/// behövs: låst finns det inget att läsa, och ett tomt minne som sparades
/// då hade skrivit över ditt.
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

/// Mötena runt i dag, ur de valda kalendrarna med sina etiketter.
async function kollegaMoten(nu = new Date()) {
  if (PROV_KOLLEGA) return kollegaProv.moten || [];
  const a = agentInst();
  if (!a.kalender || !Kalender.finns()) return [];
  const t0 = new Date(nu).getTime();
  const h = await Kalender.handelser({ fran: new Date(t0 - Kollega.DYGN * 864e5), till: new Date(t0 + Kollega.DYGN * 864e5) }).catch(() => []);
  return h.map(x => ({ ...x, ...Konton.kalenderFor(a.kalender, x) })).filter(x => x.med);
}
const kollegaFynd = () => (PROV_KOLLEGA && kollegaProv.fynd) || fynd;

/// Ett varv med förslag. Högst var tredje timme, och inte medan du skriver.
/// Raden står i Agenten: förslagen, varför, och korten på underlaget.
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
    if (underlag.some(x => !x.pakallande)) {
      await modellForAgenten();
      if (!(await grindSvarar())) return { nej: 'modell' };
      let svar = '';
      try {
        svar = await agentAnrop(Kollega.forslagsPrompt({ profil: Profil.somText(installningar.profil) || '', underlag,
          larda: Kollega.lardaRader(fore, { nu }), nu }), { tak: 1400, baraLokalt: true });
      } catch (e) {
        // Ett samtal tog över: inget varv räknas, nästa försök kommer.
        if (e.foretrade) return { nej: 'samtal' };
      }
      // Minnet läses igen: du kan ha svarat på ett förslag medan modellen tänkte.
      lista = Kollega.lasForslag(svar, underlag, { minne: await kollegaMinne(), agent: a, nu }) || [];
    }
    const m = { ...(await kollegaMinne()), senastForslag: new Date(nu).toISOString() };
    if (!lista.length) { await skrivKollega(m); return { forslag: [] }; }
    const s = await agentSamtalet();
    const { underlag: korten, forslag } = Kollega.somTur(lista);
    const tid = new Date().toISOString();
    // Inte `const tur = { id: randomUUID()`: sandgrans.test letar upp sändvägen på den raden.
    const forslagTur = { id: randomUUID(), tid, fraga: '', av: 'maximus', avAgenten: true, status: 'klar', svar: '', kvitto: [], kallor: [],
      sager: tx('srv.kollega.rad', { n: forslag.length }), underlag: korten, kollega: { forslag: [] } };
    for (const f of forslag) { f.session = s.id; f.tur = forslagTur.id; }
    forslagTur.kollega.forslag = forslag.map(Kollega.visas);
    s.turer.push(forslagTur); s.andrad = tid;
    m.forslag = [...m.forslag, ...forslag].slice(-200);
    await spara(s); await skrivKollega(m);
    sand(s.id, { typ: 'agenttur', session: s.id, tur: forslagTur });
    sandAlla({ typ: 'lista' });
    // Bara i fönstret: aldrig till telefonen och inte Notiscenter. Ett
    // förslag är något att titta på när du ändå sitter där, och varvet har
    // redan haft sin notis (punkt 10).
    sandAlla({ typ: 'notis', titel: tx('srv.kollega.notisTitel'), text: tx('srv.kollega.notisText', { n: forslag.length, forsta: forslag[0].titel }), session: s.id });
    return { forslag: forslagTur.kollega.forslag, session: s.id, tur: forslagTur.id };
  } finally { foreslarKollega = false; }
}

/// Förslaget står också på turen, så att samtalet visar läget.
async function speglaKollega(f) {
  const s = f.session && sessioner.get(f.session);
  // Ett förseglat eller låst samtal rörs inte; förslaget lever i minnet ändå.
  const oppet = s && !(s.las?.styrka === 'forseglad') && !s.las && !s.forseglad;
  const t = oppet ? s.turer.find(x => x.id === f.tur) : null;
  if (t?.kollega) {
    t.kollega.forslag = t.kollega.forslag.map(x => (x.id === f.id ? Kollega.visas({ ...f, nr: x.nr }) : x));
    await spara(s);
  }
  sandAlla({ typ: 'kollega', forslag: Kollega.visas(f) });
}

/// Du tog förslaget. Ett svar blir ett svarsförslag från kontot brevet kom
/// till, som du skickar själv; ett möte en händelse som Kalender frågar om;
/// resten en text att kopiera. Inget går någonstans härifrån.
///
/// Ett möte utan tid (mejlet sa ingen) får sin tid av dig: `start` och
/// `slut` som ÅÅÅÅ-MM-DDTHH:MM, lokal tid. Utan den förbereds inget.
async function taKollegaForslag(f, { text = null, start = null, slut = null } = {}) {
  const utkast = text != null ? String(text).slice(0, 4000) : (f.utkast || '');
  if (f.konto && f.brevId) {
    let fs;
    if (PROV_SVAR) {
      // Proven läser aldrig Mail: brevet byggs ur förslaget.
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
    // Agentens samtal, om det står öppet; ett förseglat eller låst får ett nytt.
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

/// Fönstrets närvaro: i vila eller inte, och när det senast hördes av.
let narvaro = null;
let knackMoten = { nar: 0, lista: [] };

/// Knack-knack: får den knacka, och i så fall med vilken fråga. Går bara
/// till fönstret. Svarar { ja, skal } — skälet som kod (lib/kollega.mjs).
async function knacka({ nu = new Date() } = {}) {
  if (IDENTITET) return { ja: false, skal: 'av' };
  if (maximus.skyddat && !maximus.upplast) return { ja: false, skal: 'last' };
  // Under onboardingen frågar Maximus redan, i sin egen ordning.
  if (!installningar.forsta?.klar) return { ja: false, skal: 'start' };
  const m = await kollegaMinne();
  const vila = PROV_KOLLEGA && kollegaProv.vilaSek != null ? kollegaProv.vilaSek : await vilaSek();
  // Närvaron mäts mot klockan den kom med; ett prov som flyttar klockan
  // flyttar den också.
  const n = narvaro && { ...narvaro, nar: new Date(nu).getTime() - (Date.now() - narvaro.nar) };
  const far = Kollega.farKnacka({ lage: Kollega.lage(installningar), fonster: oversikt.size, narvaro: n, vilaSek: vila,
    samtal: korningar.size + dikteringar.size + moteKo.size, minne: m, nu });
  if (!far.ja) return far;
  const k = Kollega.nyKnack(Kollega.knackAmnen({ profil: installningar.profil, du: await lasDu(), fynd: kollegaFynd(), minne: m, nu }), { nu });
  if (!k) return { ja: false, skal: 'inget' };
  // Kalendern sist: den är det enda som kostar något att fråga, och den
  // frågas högst var tionde minut.
  if (PROV_KOLLEGA || Date.now() - knackMoten.nar > 10 * 60e3) knackMoten = { nar: Date.now(), lista: await kollegaMoten(nu).catch(() => []) };
  if (Kollega.motePagar(knackMoten.lista, nu)) return { ja: false, skal: 'mote' };
  await skrivKollega({ ...m, knack: { ...m.knack, oppen: k } });
  sandAlla({ typ: 'knack', knack: { id: k.id, fraga: k.fraga, halsning: Kollega.halsning(k) } });
  return { ja: true, skal: null, knack: k };
}
// Proven knackar själva (/api/kollega/prov), med en klocka de styr.
if (!PROV_KOLLEGA) setInterval(() => knacka().catch(() => {}), 60e3).unref?.();

/// Molnmodellen (Fas 51): läget ur inställningarna, nyckeln ur nyckelringen.
/// Utan nyckel eller avstängd går allt lokalt, som förut.
/// En OpenRouter-inloggning som pågår. En i taget; den gäller tio minuter.
let molnInloggning = null;
const molnModellCache = {};
async function aktiveraMoln() {
  const lage = Moln.lageUr(installningar.moln);
  const nyckel = lage?.pa ? await Moln.lasNyckel(lage.leverantor) : null;
  // Sorterna läses vid varje anrop, så att ett nytt val i "Vad som döljs"
  // gäller direkt (2026-10-09, granskningen).
  satMoln({ lage, nyckel, sorter: () => galler(installningar), liggare: p => liggare({ ...p, anvandare: null, session: null, aktor: tx('srv.liggare.aktorMolnmodell') }) });
  return { lage, harNyckel: Boolean(nyckel) };
}

/// Kundens egen mall (Fas 23): sparad krypterad i datakatalogen, en per
/// sort, och läst på nytt vid varje bygge. Se lib/mallar.mjs.
/// En mall per användare (säkerhetsgranskningen 2026-10-06): i ett
/// läge med flera konton ska ingen kunna byta eller ta bort någon annans mall.
const mallfil = (sort, agare = null) => join(dataDir, 'mallar',
  `${agare ? `${String(agare).replace(/[^\w-]/g, '')}-` : ''}${sort}.json`);
async function kundmallInfo(sort, agare) {
  try { const j = JSON.parse(await maximus.lasFil(mallfil(sort, agare))); return { namn: j.namn, tid: j.tid }; } catch { return null; }
}
async function kundmall(sort, agare) {
  try { const j = JSON.parse(await maximus.lasFil(mallfil(sort, agare))); return await Mallar.lasMall(sort, Buffer.from(j.data, 'base64')); }
  catch { return null; }
}

/// Nyheter (Fas 50): en helig session "Nyheter" och ett uppdrag med en
/// ämneskälla per intresse. Ändras intressena byts ämnena, och källorna
/// letas upp igen. Utan ditt ja finns inget av det.
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
  // Samma ämnen OCH samma instruktion: en skärpt instruktion når också den
  // som redan har nyheterna på.
  const kallnyckel = kallor => JSON.stringify(kallor.map(k => k.fraga || k.typ));
  const samma = u0 && kallnyckel(u0.kallor) === kallnyckel(instr.kallor) && u0.instruktion === instr.instruktion;
  if (u0 && samma) return u0;
  // Bara instruktionen ändrad: samma uppdrag, så att nyheterna på hem står kvar.
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

/// Flödet som uppdrag (Fas 47 del 2): med lovet att följa löpande och
/// Safari påslaget läses LinkedIn-flikarna varannan timme, vägt mot vem du
/// är, och det rapporteras i Du. Ett uppdrag, inte ett per anrop.
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

/// En gång i månaden: läs in LinkedIn-exporten igen, så att inläggen och
/// reaktionerna följer med (Fas 47 del 2). En rad i Du, och en notis.
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

/// Varför Safari sa nej, i klartext — inte en tyst väntan (2026-10-06: den
/// hängde på "Jag läser profilsidan …" när behörigheten saknades).
function safariFel(t) {
  if (/-1743|not authorized|inte behörig|Not allowed to send Apple events/i.test(t)) return tx('srv.safari.ejBehorig');
  if (/JavaScript from Apple Events|Tillåt JavaScript|Allow JavaScript/i.test(t)) return tx('srv.safari.tillatJsLang');
  if (/timed out|ETIMEDOUT|SIGTERM|killed/i.test(t)) return tx('srv.safari.timeout');
  return tx('srv.safari.svaradeInte', { fel: String(t).trim().slice(0, 160) });
}

/// Sidan som är öppen i Safari: adress, titel och text. Lokalt, bara läsa.
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
  // Samtalet har företräde också här. Ett arbete är många modellanrop, och
  // det får aldrig ligga i vägen för den som skriver.
  if (korningar.size > 0) return;

  // Ett tungt fynd blir en undersökning (Fas 38), med eller utan projekt
  // (Fas 39). En per varv: tjugo undersökningar på en gång är inte hjälp,
  // det är en inkorg till — och minnet ska finnas kvar åt den som skriver.
  // Budgeten (2026-10-06): hur många undersökningar i timmen, och om det får
  // ske på batteri. Inställningen heter Tempo under Agenten.
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

/// Delningsmappen: krypterade kuvert som väntar på macOS delningsmeny.
const delningsmapp = () => join(dataDir, 'delningar');

/// Tömmer delningsmappen på det som är äldre än ett dygn.
///
/// Ett kuvert behövs bara tills delningsmenyn läst det. Ett som ligger kvar
/// är en kopia av ett ärende som ingen vet om — krypterad, men ändå en
/// kopia. Körs vid start.
async function stadaDelningar(nu = Date.now()) {
  for (const f of await readdir(delningsmapp()).catch(() => [])) {
    const v = join(delningsmapp(), f);
    const st = await stat(v).catch(() => null);
    if (st && nu - st.mtimeMs > 86400000) await unlink(v).catch(() => {});
  }
}

/// Det agenten vill göra men inte får utan att fråga.
let agentbegaran = [];

/// Ett samtal om det agenten hittade (Fas 12).
///
/// Samtalet finns i listan direkt, med turen igång. Sedan strömmar
/// sammanfattningen på samtalets egen ström — den som öppnar samtalet medan
/// den skrivs ser den växa, och den som öppnar det sedan ser den färdig.
/// Listan över fynden står under, skriven av regler: den är kvittot.
///
/// Samtalet har företräde: skriver du i ett annat samtal skrivs
/// ingen sammanfattning, och samtalet säger det i stället för att vara tyst.
/// Agentens första rad i uppdragets samtal.
///
/// Turen är Maximus, inte du. "Agenten hittade 11 nya saker om Det som rör
/// mig i inkorgen" stod i din bubbla och sa varken vad uppdraget var, vad
/// det letade efter eller vad det vägde mot (Auro 2026-10-04: "okej? av
/// vad? baserat på vad? vad är målet?"). Nu står uppdraget, din instruktion
/// och vad varvet läste först, i Maximus röst.
function agentRad(u, nya, nu, varv = {}) {
  const klocka = new Date(nu).toLocaleTimeString(lokalNu(), { hour: '2-digit', minute: '2-digit' });
  const var_ = ochLista(u.kallor.map(k => bestamdKalla(k.typ)));
  const lasta = varv.vagda ? tx('srv.agentRad.laste', { n: varv.vagda, var: var_ }) : tx('srv.agentRad.gickIgenom', { var: var_ });
  return tx('srv.agentRad.huvud', { titel: u.titel, klocka, instruktion: String(u.instruktion || '').replace(/\s+/g, ' ').slice(0, 400) })
    + tx('srv.agentRad.vagde', { lasta, n: nya.length })
    + `${varv.undan ? tx('srv.agentRad.undan', { n: varv.undan }) : ''}`;
}

/// Namnen på ett uppdrag och dess tråd.
///
/// "Det som rör mig i inkorgen — 9 nya", två gånger i listan, sa ingenting om
/// vad som hittats (Auro 2026-10-04: "Man behöver få en bättre översikt i
/// titeln"). Två namn sätts av modellen när det finns en sammanfattning:
///
///   uppdraget  döps om EN gång, bara om det bär ett generiskt namn ("Det
///              som rör mig i …"), efter instruktionen och vad som hittades.
///   tråden     får rubriken för den senaste genomgången: "AI-agenter —
///              Gemini 4 och Claude i biologin". Raden i listan blir en
///              förhandsvisning, som ämnesraden i en inkorg.
///
/// En tråd du döpt själv rörs inte.
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

/// Agenten som samtal (Fas 33, beslutat av Auro 2026-10-05). Ett löpande
/// samtal där allt agenten rapporterar hamnar, i tidsordning, och där du
/// pratar med den. Skapas första gången det behövs.
async function agentSamtalet() {
  const id = installningar.agentSamtal;
  const finns = id && sessioner.get(id);
  // Ett förseglat eller låst Agenten-samtal används inte; då ett nytt.
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

/// Verktygen för att styra agenten själv, i Agentens samtal: vilka uppdrag
/// som finns, vad som hänt, kör, pausa (till ett datum) och fortsätt.
function styrverktyg({ text = '' } = {}) {
  // Bara det du själv skrev i turen kan pausa (granskningen 2026-10-09).
  const fattPaus = Handlingar.begarPaus(text);
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
        // "Till måndag" sagt en måndag betyder nästa måndag: ett datum som
        // är i dag eller redan passerat flyttas en vecka fram (2026-10-05
        // blev det dagens datum, och pausen hade släppt direkt).
        let t = till && Number.isFinite(+new Date(till)) ? new Date(till) : null;
        if (t) { t.setHours(0, 0, 0, 0); const idag = new Date(); idag.setHours(23, 59, 59, 0); while (t <= idag) t.setDate(t.getDate() + 7); t = t.toISOString(); }
        for (const u of valda) { const i = uppdrag.indexOf(u); uppdrag[i] = { ...u, tillstand: 'pausad', pausTill: t }; }
        await sparaUppdrag(); sandAlla({ typ: 'lista' });
        return tx('srv.styr.pausade', { titlar: valda.map(u => u.titel).join(', '), till: t ? tx('srv.styr.till', { datum: new Date(t).toLocaleDateString(lokalNu(), { weekday: 'long', day: 'numeric', month: 'long' }) }) : '' });
      } },
    { namn: 'fortsatt_uppdrag', om: tx('srv.styr.fortsattOm'), parametrar: { type: 'object', properties: { namn: { type: 'string' } }, required: ['namn'] },
      kor: async ({ namn }) => {
        const valda = hitta_(namn).filter(u => u.tillstand === 'pausad');
        if (!valda.length) return tx('srv.styr.ingetPausat');
        for (const u of valda) { const i = uppdrag.indexOf(u); uppdrag[i] = { ...Uppdrag.aterstall(u), pausTill: null }; }
        await sparaUppdrag(); sandAlla({ typ: 'lista' });
        return tx('srv.styr.igangIgen', { titlar: valda.map(u => u.titel).join(', ') });
      } },
  ];
}

/// Originalen bakom fynden, lästa lokalt via referenserna (2026-10-10): ett
/// mejl bar bara sitt ämne, och sammanfattningen skrevs ur det. De första
/// sex; resten står på sina kort och läses när någon frågar.
///
/// Tre åt gången och högst femton sekunder för alla (punkt 10): sex brev i
/// följd från ett Mail som inte svarar var fyra och en halv minut innan
/// turen syntes. Ett original som försökte styra modellen märker fyndet,
/// också när det läses klart efter tidsgränsen.
async function originalen(nya) {
  const texter = await Underlag.lasManga(nya.slice(0, 6), async f => {
    const k = Underlag.kort(f);
    const t = await Underlag.lasHela(k, lasOriginal);
    if (k.pakallande) f.pakallande = true;
    return t;
  });
  return [...texter, ...nya.slice(6).map(() => '')];
}

/// Sammanställningen av ett varvs nyheter eller inlägg (2026-10-10). Den
/// strömmas inte: modellen svarar med JSON, och varje stycke prövas mot sina
/// källor innan det visas. Utan modell (ett samtal har företräde), eller när
/// inget stycke höll, skriver reglerna en torr — aldrig en påhittad.
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
  // Inte `const tur = { id: randomUUID()`: sandgrans.test letar upp
  // sändvägen på just den raden, och en till före den gömde sändvägen.
  const agentTur = { id: randomUUID(), tid, fraga: sammanstallning ? Sammanstallning.fragan(u, nya) : Fyndsamtal.fragan(u, nya), svar: '', status: 'igang',
    avAgenten: true, av: 'maximus', sager: agentRad(u, nya, nu, varv),
    // Samma sak strukturerat, för kortet: uppdraget, din instruktion, vad
    // varvet läste, och var uppdraget gavs — så att källan går att öppna.
    uppdragskort: { titel: u.titel, instruktion: String(u.instruktion || '').slice(0, 600), tid: new Date(nu).toISOString(),
      var: ochLista(u.kallor.map(k => (k.typ === 'paminnelser' ? k.typ : bestamdKalla(k.typ)))),
      lasta: varv.vagda || 0, fynd: nya.length, undan: varv.undan || 0, ursprung: u.ursprung || (u.session ? { session: u.session } : null),
      // En engångssökning kan bli en bevakning: "fortsätt — bara nya".
      engang: !u.aterkommande, uppdrag: u.id },
    kvitto: [],
    // Ett kort per fynd med referensen till originalet (2026-10-10); följdfrågorna läser det.
    underlag: Fyndsamtal.underlag(nya, texter),
    // En sammanställning: korten följer med assistenten men visas inte, för
    // källrutan visar samma poster (punkt 10).
    ...(sammanstallning ? { sammanstallning: true } : {}),
    // Fynden med länk, bild och pris blir källor och kort, som i ett svar.
    // I en sammanställning har varje källa sitt nummer ur listan, så att [3]
    // i ett stycke pekar på post tre också när post två saknar adress.
    kallor: (sammanstallning ? nya.map((f, i) => [f, i + 1]).filter(([f]) => f.url) : nya.filter(f => f.url).map((f, i) => [f, i + 1]))
      .map(([f, nr]) => ({ nr, titel: f.titel, url: f.url, vard: f.fran || '', niva: 0, etikett: '', ...(f.vara ? { vara: f.vara } : {}) })) };
  // Ett uppdrag har EN tråd (2026-10-04): agenten skriver i uppdragets
  // samtal så länge det finns och varken är låst, förseglat eller arkiverat.
  // Ett samtal för allt agenten gör (Fas 33): Agenten. Uppdragets trådar
  // blir filter i det. Kan det inte användas (låst) faller vi tillbaka på
  // en egen tråd som förut.
  // Grunden (Fas 49): ett uppdrag som hör till en app skriver i appens
  // heliga session. Allt annat i Agenten, som förut.
  const helig = u.grund ? [...sessioner.values()].find(x => x.id === u.grund && x.helig && !x.las) : null;
  const fore = helig || await agentSamtalet();
  agentTur.uppdrag = u.id;
  const s = fore && !(fore.las?.styrka === 'forseglad') && !fore.las && !fore.forseglad && !fore.arkiverad ? fore : { id: randomUUID(), titel: Fyndsamtal.rubrik(u, nya), skapad: tid, andrad: tid,
    agare: null, projekt: u.projekt || null, turer: [], karta: [], raknare: {},
    avAgenten: true, uppdrag: u.id, minne: 'isolerat', webb: 'av',
    behandling: Behandling.stall(installningar.behandling) };
  s.turer.push(agentTur);
  s.andrad = tid;
  // Fyndens sfärer (2026-10-10): samtalet går att filtrera på dem.
  s.etiketter = [...new Set([...(s.etiketter || []), ...nya.map(f => f.sfar).filter(Boolean)])].slice(0, 12);
  sessioner.set(s.id, s);
  await spara(s);
  if (s.id !== u.session) {
    const i = uppdrag.findIndex(x => x.id === u.id);
    if (i >= 0) { uppdrag[i] = { ...uppdrag[i], session: s.id }; await sparaUppdrag(); }
  }
  // Den som har samtalet öppet ser turen komma in.
  sand(s.id, { typ: 'agenttur', tur: agentTur });
  for (const f of nya) f.samtal = s.id;
  sandAlla({ typ: 'lista' });
  // Och en rad där du redan är: samtalet finns, här är det.
  sandAlla({ typ: 'fyndsamtal', id: s.id, titel: s.titel });

  const lista = sammanstallning ? Sammanstallning.kallista(nya, { utanLank: true }) : Fyndsamtal.lista(nya);
  let sammanfattning = '';
  // `snabb` (punkt 10): varvet har nått sitt tak. Listan räcker då; ingen
  // sammanfattning och ingen ny rubrik, så att varvet tar slut.
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

/// Anslagstavlan: sammanställningen i din egen anteckningsmapp.
///
/// Poängen är att den finns DÄR DU REDAN LÄSER — i telefonen, i
/// Anteckningar, utan MAXIMUS öppet. En översikt som bara går att se i appen är
/// en översikt man ser när man ändå hade öppnat appen.
///
/// Den skapar en ny anteckning varje gång och rör aldrig en befintlig. Och
/// den skriver bara när mappen fått skrivrätt — ett eget beslut per mapp,
/// förvalet är läs.
async function anslagstavlan(hant, nu) {
  const a = agentInst();
  if (!a.anteckningar?.mapp || !a.anteckningar.skriv) return;
  const nya = hant.filter(h => h.fynd > 0);
  // Ingenting hänt, ingen lapp. En mapp som får en anteckning varje kvart
  // med texten "inget nytt" är en mapp man slutar öppna.
  if (!nya.length) return;

  const rader = fynd.filter(f => !f.sett).slice(0, 20).map(f =>
    `${'•'.repeat(f.vikt || 1)} ${f.titel}${f.fran ? ` — ${f.fran}` : ''}\n   ${f.varfor}`);
  if (!rader.length) return;
  const stund = new Date(nu).toLocaleString(lokalNu(), { dateStyle: 'short', timeStyle: 'short' });
  try {
    await Anteckningar.skriv(a.anteckningar.mapp, {
      konto: a.anteckningar.konto || null,
      rubrik: tx('srv.anslag.rubrik', { stund }),
      // Texten är agentens egen sammanställning, inte källornas text. Det
      // som ligger i en anteckning kan synkas till iCloud, och då har det
      // lämnat datorn — fast genom din egen tjänst, med ditt eget konto.
      text: [tx('srv.anslag.sakerSedanSist', { n: rader.length }), '', ...rader].join('\n'),
    });
  } catch (e) {
    // Ingen tyst tystnad: går det inte att skriva ska det stå någonstans.
    hant.push({ uppdrag: null, titel: tx('srv.spar.anslagstavlan'), fynd: 0, skal: null,
      fel: tx('srv.spar.anslagFel', { mapp: a.anteckningar.mapp, fel: e.message }) });
  }
}

/// Vad datorn bär, med en kort cache.
///
/// Modellschemaläggaren svarar på millisekunder, men frågan ställs vid varje omritning av
/// hemmet och svaret ändras inte mellan två knapptryck. Trettio sekunder
/// räcker: en modell startar eller stängs inte oftare än så i praktiken,
/// och gör den det är nästa fråga ändå snart.
let kapCache = null, kapNar = 0;
async function kapacitetsvar({ farsk = false } = {}) {
  if (!farsk && kapCache && Date.now() - kapNar < 30000) return kapCache;
  const samtalfil = modellfil();
  // Den lilla modellen för agenten: den minsta hämtade som finns, om någon.
  const liten = await minstaModellen().catch(() => null);
  const d = await Kapacitet.lage({
    samtalfil,
    agentfil: samtalfil,
    agentLitenFil: liten && liten !== samtalfil ? liten : null,
  }).catch(() => null);
  kapCache = d
    ? { lage: d.lage, skal: d.skal, tillgangligt: d.tillgangligt,
        barMaskinen: d.barMaskinen, samtal: d.samtal, agent: d.agent,
        mattAv: d.ledger ? 'schemalaggare' : 'os',
        // Måste man välja? Det är en egenskap hos datorn, inte hos
        // ögonblicket — se avgor() i lib/kapacitet.mjs.
        valjs: d.valjs }
    : { lage: 'en', skal: tx('srv.kapacitet.kundeInteMata'),
        mattAv: null, valjs: true };
  kapNar = Date.now();
  return kapCache;
}

/// Den minsta modellen som faktiskt ligger på disken.
///
/// Agenten behöver inte samma modell som samtalet. En triage är en
/// sorteringsuppgift, och bänken (test/bank.mjs) mäter om en mindre klarar
/// den — missar och brus, inte magkänsla.
async function minstaModellen() {
  const l = await Modeller.laget().catch(() => null);
  const finns = (l?.modeller || []).filter(m => m.finns && m.vag);
  if (!finns.length) return null;
  return finns.slice().sort((a, b) => (a.byte || 0) - (b.byte || 0))[0].vag;
}

/// Profilen som gäller för ETT uppdrag.
///
/// Hör uppdraget till ett projekt är det projektets mål som väger, inte det
/// allmänna. "Få igenom upphandlingen utan överprövning" är ett bättre
/// riktmärke för ett upphandlingsuppdrag än "minska sjuktalen" — och ett
/// sämre för ett arbetsmiljöuppdrag.
///
/// Vem och vad arbetar man med står kvar: de säger vilka ord som är fackord,
/// och det gäller oavsett vilket projekt man är i.
function malet(u) {
  const p = installningar.profil || null;
  if (!u?.projekt) return p;
  const pr = projekt.find(x => x.id === u.projekt);
  if (!pr?.mal) return p;
  return { ...(p || Profil.TOM), vill: pr.mal };
}

/// Veckan, sammanvägd ur kalender, frister och fynd.
///
/// Kalendern läses bara om agenten fått den. Utan kalender blir veckan
/// frister och fynd, och det är fortfarande en vecka — bara en tunnare.
async function veckanNu(nu = new Date()) {
  const a = agentInst();
  let handelser = [];
  if (a.kalender && Kalender.finns()) {
    const { fran, till } = Kalender.veckan(nu);
    handelser = await Kalender.handelser({ fran, till }).catch(() => []);
  }
  return Veckan.veckan({ handelser, frister, fynd, uppdrag, nu });
}

/// Vad agenten behöver säga.
///
/// HÄRLETT, aldrig en egen lista. Ett pausat uppdrag är redan sanningen i
/// uppdragslistan, och en frist är redan sanningen i fristlistan. En andra
/// lista bredvid dem är den buggform som bitit tio gånger i den här koden:
/// en handhållen kopia som glider ifrån det den kopierar.
///
/// Ordningen är den man ska läsa dem i. En frist som går ut i morgon är
/// viktigare än att en sida slutat svara.
function agentnotiser() {
  const ut = [];

  // Frister först. De har ett datum, och ett datum som passerat går inte
  // att ta igen.
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

  // Sedan det som slutat fungera. En bevakning som tyst slutat fungera är
  // värre än ingen bevakning.
  for (const u of uppdrag) {
    if (u.tillstand === 'pausad') {
      ut.push({ sort: 'fel', titel: u.titel, uppdrag: u.id,
        om: tx('srv.notis.pausatEfterFel', { n: u.fel?.antal || 0, varfor: u.fel?.varfor || '' }).trim() });
    } else if ((u.fel?.antal || 0) > 0) {
      ut.push({ sort: 'paus', titel: u.titel, uppdrag: u.id,
        om: tx('srv.notis.forsokMisslyckats', { n: u.fel.antal, grans: Uppdrag.FEL_INNAN_PAUS }) });
    }
  }

  // Och sist: vad som hänt medan du var borta. Bara om något faktiskt
  // hänt — en app som säger "inga nyheter" varje morgon lär dig att inte
  // titta.
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
/// Ett slag på klockan. På batteri glesas varven ut som förval: var tredje
/// slag körs (Fas 26). Valet heter agentBatteri: 'glesare' eller 'samma'.
async function tick() {
  tickNr++;
  if (installningar.agentBatteri !== 'samma' && await paBatteri() && tickNr % 3 !== 0) return;
  const r = await slaHjarta();
  await lasFranTelefonen().catch(e => console.log(`  från telefonen: ${e.message}`));
  // Upptaget av ett ensamt varv (en händelse, "Kör nu"): klockans varv står
  // i kö och körs när det är klart — inte fem minuter senare. Utan kön svalt
  // åtta uppdrag i en kvart medan händelsevakten körde tre (2026-10-06).
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
// Ikapp efter sömn. En dator som sovit i natt har missat varven klockan
// 08:00; uppdragen vars tid passerat körs när den vaknar, och spåret säger
// varför. Vakten märker sömnen på att en minut tog mycket längre än en
// minut.
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

// ── Händelser (Fas 27) ────────────────────────────────────────────────────
// Var trettionde sekund: vilka uppdrag med `handelse` ska titta nu? Se
// lib/handelser.mjs. Signalerna är gratis — en filändring i Meddelandens och
// samtalslistans databaser, och fs.watch på mappen — och väcker direkt.
// Resten tittar med sitt golv. Tittar gör agenten billigt (vattenmärket);
// modellen anropas först när något nytt passar uppdragets filter.
let handelseSenast = {};
const handelseSignaler = {};
const handelseForra = {};
const mappVakter = new Map();
async function vaktaHandelser() {
  // Ett köat klockvarv går först; det läser samma uppdrag ändå.
  if (slarNu || hjartaSkuld || !uppdrag.some(u => u.handelse)) return;
  // En vakt per mapp som något uppdrag läser (Fas 35).
  const vagar = new Set(uppdrag.flatMap(u => u.kallor.filter(k => k.typ === 'mapp').map(k => k.sokvag || installningar.agent?.mapp?.sokvag)).filter(Boolean));
  for (const [v, w] of mappVakter) if (!vagar.has(v)) { w.close(); mappVakter.delete(v); }
  for (const v of vagar) if (!mappVakter.has(v)) {
    try { mappVakter.set(v, fsWatch(v, () => { handelseSignaler[`mapp:${v}`] = Date.now(); handelseSignaler.mapp = Date.now(); })); } catch { /* ingen rätt: golvet gäller */ }
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
    // Upptaget (ett annat varv, låst) betyder: försök igen nästa halvminut.
    if (r?.nej) break;
    handelseSenast = Handelser.stampla(handelseSenast, u);
  }
}
setInterval(() => vaktaHandelser().catch(e => console.log(`  händelser: ${e.message}`)), 30e3).unref?.();
setTimeout(() => slaHjarta().catch(() => {}), 30000).unref?.();
stallHjartat();
// Grinden släpper av sig själv (2026-10-10): när profilen och en källa
// finns slår agenten direkt — ingen omstart, ingen väntan på nästa slag. Och
// gränssnittet får veta, åt båda hållen. Regeln räknar bara på
// inställningarna, så att fråga var femte sekund kostar ingenting.
{
  let varKlar = agentBehov().klar;
  setInterval(() => {
    const nu = agentBehov().klar;
    if (nu !== varKlar) { sandAlla({ typ: 'lista' }); if (nu) slaHjarta().catch(() => {}); }
    varKlar = nu;
  }, 5000).unref?.();
}

/// En notis. Fönstret visar den när det är öppet (händelsen 'notis');
/// utan fönster går den till Notiscenter via osascript.
function notifiera(titel, text, session = null, { viktigt = false } = {}) {
  if (installningar.agentNotiser === false) return;
  // Till telefonen (2026-10-06): bara det viktiga, bara när du är borta.
  if (viktigt) tillTelefonen(titel, text, { session }).catch(e => console.log(`  telefonen: ${e.message}`));
  sandAlla({ typ: 'notis', titel, text, session });
  if (oversikt.size === 0 && process.platform === 'darwin') {
    // Rubrik och text som argv, inte som skriptkälla (granskningen 2026-10-09).
    execFileCb('/usr/bin/osascript', notisArgument(titel, text), () => {});
  }
}

// ── Till telefonen (2026-10-06) ─────────────────────────────────────────
// iMessage eller en påminnelse i listan "Maximus". Se lib/telefon.mjs.
let telefonLogg = { skickade: [], paminnelser: [] };
try { telefonLogg = { ...telefonLogg, ...JSON.parse(await maximus.lasFil(join(dataDir, 'telefon.json'))) }; } catch { /* inget skickat än */ }
const sparaTelefon = () => maximus.skrivFil(join(dataDir, 'telefon.json'), JSON.stringify({
  skickade: telefonLogg.skickade.slice(-50), paminnelser: telefonLogg.paminnelser.slice(-50) }));

/// Hur länge datorn stått orörd, i sekunder (macOS HIDIdleTime).
async function vilaSek() {
  if (process.platform !== 'darwin') return 0;
  const ut = await new Promise(klar => execFileCb('/usr/sbin/ioreg', ['-c', 'IOHIDSystem', '-d', '4'], { maxBuffer: 4e6 }, (e, o) => klar(String(o || ''))));
  const m = /"HIDIdleTime"\s*=\s*(\d+)/.exec(ut);
  return m ? Number(m[1]) / 1e9 : 0;
}

/// Skickar en rad till telefonen. `prov` går förbi borta och taket — det
/// är du som tryckt på knappen.
async function tillTelefonen(titel, text, { prov = false, session = null } = {}) {
  const t = agentInst().telefon || {};
  const kanal = Telefon.kanalUr(t.kanal);
  if (kanal === 'av' || process.platform !== 'darwin') return { skickat: false, skal: tx('srv.telefon.av') };
  if (!prov) {
    if (!Telefon.arBorta(await vilaSek())) return { skickat: false, skal: tx('srv.telefon.vidDatorn') };
    if (!Telefon.inomTak(telefonLogg.skickade)) return { skickat: false, skal: tx('srv.telefon.taket') };
  }
  // Genom grinden innan det går till iCloud (2026-10-09, granskningen):
  // rubriken är ofta ett mejlämne eller ett samtals titel, och ett namn i den
  // låg i klartext hos Apple. Platshållarna står kvar; det riktiga läser du i
  // Maximus.
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
    // Anteckningen säger hur man svarar (2026-10-09): skriv här, bocka av.
    const r = await skrivHjalpare('paminnelse', { titel: rad, anteckning: Telefon.svarsrad(), lista: Telefon.LISTA, skapaLista: true, forfaller: new Date(Date.now() + 30e3).toISOString() });
    if (r?.id) telefonLogg.paminnelser.push({ id: r.id, tid: new Date().toISOString(), session });
  }
  } catch (e) { fel = e; throw e; } finally {
    // Varje ping är en sändning och står i liggaren: kanalen och exakt den
    // text som gick (2026-10-09, granskningen).
    await liggare({ frontier: kanal === 'imessage' ? tx('srv.liggare.telefonMeddelanden') : tx('srv.liggare.telefonPaminnelser'),
      vag: 'telefon', skickat: rad, mottaget: fel ? '' : tx('srv.liggare.levererat'), tecken: rad.length,
      sekunder: (Date.now() - t0) / 1000, ...(fel ? { fel: fel.message.slice(0, 200) } : {}),
      anvandare: null, session, aktor: tx('srv.liggare.aktorAgenten') }).catch(() => {});
  }
  telefonLogg.skickade.push(new Date().toISOString());
  await sparaTelefon();
  return { skickat: true, kanal };
}

/// Tillbaka från telefonen (2026-10-09): listan Maximus läses när agenten
/// tittar. Avbockat blir sett, en anteckning blir ett svar i samtalet
/// påminnelsen kom ifrån, och en egen påminnelse i listan blir ett
/// meddelande till Agenten. Se lib/telefon.mjs.
let lasesFranTelefonen = false;
async function lasFranTelefonen() {
  const t = agentInst().telefon || {};
  if (Telefon.kanalUr(t.kanal) !== 'paminnelse' || process.platform !== 'darwin' || lasesFranTelefonen) return [];
  if (maximus.skyddat && !maximus.upplast) return [];
  lasesFranTelefonen = true;
  try {
    const poster = await Paminnelser.paminnelser({ dagar: 2 }).catch(() => []);
    const handelser = Telefon.iListan(Array.isArray(poster) ? poster : [], telefonLogg);
    if (!handelser.length) return [];
    // Minns först: ett svar som kraschar halvvägs ska inte skickas två gånger.
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
      // Genom minSession, som allt annat: en förseglad session tar inte emot
      // något från telefonen. Då går svaret till Agenten i stället.
      const s = (h.session && minSession(h.session, null)) || await agentSamtalet();
      if (!s) continue;
      // Samma väg som när du skriver i samtalet: allt som gäller där gäller här.
      const r = await fetch(`http://127.0.0.1:${PORT}/api/sessioner/${s.id}/skicka`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1', 'x-maximus-nyckel': NYCKEL },
        body: JSON.stringify({ fraga: tx('srv.telefon.franTelefonen', { text: h.text }), franTelefonen: true, webb: 'av' }),
      }).catch(() => null);
      await r?.text().catch(() => '');
      // Inget ur svaret går tillbaka (granskningen 2026-10-09): listan kan
      // vara delad, och då hade den som skrev frågan läst svaret. Telefonen
      // får veta att svaret finns — det står i Maximus.
      if (s.turer?.at(-1)?.svar) await tillTelefonen(tx('srv.telefon.svaretStar'), s.titel || tx('srv.liggare.aktorAgenten'), { session: s.id }).catch(() => {});
    }
    return handelser;
  } finally { lasesFranTelefonen = false; }
}

/// Påminnelserna Maximus lagt för telefonen tas bort efter ett dygn.
async function stadaTelefonen(nu = Date.now()) {
  const gamla = telefonLogg.paminnelser.filter(x => nu - Date.parse(x.tid) > 864e5);
  if (!gamla.length) return;
  for (const x of gamla) await skrivHjalpare('ta-bort', x.id).catch(() => {});
  telefonLogg.paminnelser = telefonLogg.paminnelser.filter(x => !gamla.includes(x));
  await sparaTelefon();
}

const sand = (id, h) => { for (const r of strommar.get(id) || []) r.write(`data: ${JSON.stringify(h)}\n\n`); };
const sandAlla = h => { for (const r of oversikt) { try { r.write(`data: ${JSON.stringify(h)}\n\n`); } catch { oversikt.delete(r); } } };

/// Vad en session håller på med just nu, för sidopanelen.
///
/// Arbetet syntes bara i samtalet det pågick i. Lämnade man in en
/// inspelning och öppnade ett annat samtal stod raden kvar som "Ny session ·
/// 0 frågor", och ingenting sa att Maximus fortfarande lyssnade på den.
/// Sagt 2026-10-04: "tänk om jag öppnar en annan session som gör något
/// annat?" Ett svar som skrivs syns redan i `korningar`; filerna står här.
const filarbete = new Map();
function satFilarbete(s, vad) {
  if (vad) filarbete.set(s.id, vad); else filarbete.delete(s.id);
  sandAlla({ typ: 'lista', agare: s.agare });
}
const arbeteI = id => filarbete.get(id) || (korningar.has(id) ? tx('srv.sidopanel.svarar') : null);

/// Svar som väntar på användaren. Nyckeln är turens id.
///
/// En sökfråga på nivå två eller tre går inte ut förrän någon sagt ja. Att
/// fråga efteråt är att inte fråga.
/// Nyckeln är turens id, och VÄRDET bär vilken session den hör till.
///
/// Bandet fanns inte. `/webbsvar` läste bara `kropp.tur` och godkände det
/// som väntade — vems det än var. Revisionen 2026-09-28 lät en vanlig
/// användare godkänna en annan användares sökning, alltså bestämma att
/// någon annans uppgifter fick lämna datorn. Ett godkännande som någon annan
/// kan ge är inget godkännande.
const vantande = new Map();
function vantaPaSvar(turId, session, ms = 180000) {
  return new Promise(los => {
    const klocka = setTimeout(() => { vantande.delete(turId); los(false); }, ms);
    vantande.set(turId, { session, svara: svar => { clearTimeout(klocka); vantande.delete(turId); los(svar); } });
  });
}

/// Koderna till de förseglade sessioner som öppnats i den här körningen.
/// De ligger i minnet, aldrig på disk, och försvinner när servern stängs.
const koder = new Map();

/// Sant när sessionen är förseglad och koden inte getts i den här körningen.
const stangd = s => Boolean(s?.forseglad) && !koder.has(s.id);

/// Anonymiseringen av en maskerad text, stycke för stycke.
///
/// Den lokala modellen skriver om det som pekar ut även utan namn — ett exakt
/// belopp, en ovanlig diagnos, ett datum som bara gäller ett ärende — på den
/// MASKERADE texten, så den ser aldrig namnen. Varje stycke prövas: blev det
/// faktiskt vagare? Blev det inte det står det maskerade stycket kvar. En
/// omskrivning som bara låter annorlunda är ingen anonymisering.
///
/// Bruten ur bilagornas väg (/fil/:fid/anonymisera) när samma arbete också
/// skulle gå att be om i samtalet (Auro 2026-10-10). `pa` får det som
/// händer, i samma form som bilagekortet redan ritar: `borjan` med styckena,
/// `letar`, `bit` medan modellen skriver, `klartBlock` per stycke.
///
/// `baraLokalt`: texten når aldrig molnet, vad molninställningen än säger.
/// Den som ber Maximus anonymisera något i samtalet har fått löftet att inget
/// lämnar datorn för det.
async function anonymiseraStycken(maskerad, { pa = () => {}, baraLokalt = false, signal } = {}) {
  const bitar = stycken(maskerad, { minsta: 400, storsta: 2200 });
  const ut = [];
  const vagt = [];
  let lamnade = 0;
  // Styckena skickas i förväg. Kortet i samtalet ritar dem direkt och
  // byter ut ett i taget medan modellen arbetar — som ett dokument som
  // redigeras, inte som en förloppsindikator.
  pa({ borjan: true, block: bitar.length, bitar });
  for (const [i, bit] of bitar.entries()) {
    // Vad stycket innehåller som pekar ut. Skickas innan modellen
    // börjat, så att den som ser på vet vad den letar efter.
    //
    // Modellens eget resonemang vore ett annat sätt att visa arbetet,
    // och det går att strömma. Mätt 2026-09-25: Gemma 4 12B skrev
    // 9 306 tecken tanke om ett enda stycke och hann aldrig fram till
    // svaret innan tiden tog slut. Reglerna vet samma sak på noll tid.
    pa({ letar: vadFinns(bit) });
    const efter = await svaraLokalt(tx('srv.anonym.textenEtikett', { generalisera: GENERALISERA, bit }), {
      onText: t => pa({ bit: t }), baraLokalt, signal,
    });
    // Modellen inleder ibland med "Här är den omskrivna texten…" och
    // en avdelare, trots att instruktionen säger texten och inget
    // annat. Det är prat om arbetet, inte arbetet.
    const d = blevVagare(bit, rensaPrat(efter));
    // Blev stycket inte vagare behålls originalet — men det som redan
    // strömmats ut måste då bytas ut, annars visar rutan något annat
    // än det som sparas.
    ut.push(d.ok ? rensaPrat(efter) : bit);
    if (!d.ok) lamnade++;
    // Vad som faktiskt blev vagare. Det går att granska, till
    // skillnad från en försäkran om att något blev bättre.
    const v = d.ok ? blevVagt(bit, rensaPrat(efter)) : [];
    vagt.push(...v);
    pa({ klartBlock: i + 1, block: bitar.length, behollet: !d.ok, text: ut[ut.length - 1], vagt: v });
  }
  return { text: ut.join('\n\n'), lamnade, block: bitar.length, vagt };
}

/// Maskera och/eller anonymisera på begäran, i samtalet (Auro 2026-10-10).
///
/// "Maskera den här texten: …", "anonymisera bilagan", "anonymize your last
/// answer". Känns igen av lib/maskbegaran.mjs innan någon modell svarat, och
/// görs här med det som redan finns: forbered() med reglerna, namnmodellen
/// och den lokala tolkningen, och anonymiseringen styckevis.
///
/// Inget lämnar datorn för det här. Ingen webb, ingen molnmodell — också
/// när molnet är påslaget, för det du ber om att få maskerat är just det som
/// inte är maskerat än. Liggaren får ingen rad: den för bok över det som
/// lämnat datorn, och ingenting gjorde det.
///
/// Svaret är en tur som alla andra, med kortet i `maskning`: texten, antal
/// per sort och kartan — bara de platshållare som står i den här texten.
/// Kartan visas på begäran, i gränssnittet, och sparas krypterad med
/// sessionen som sessionens egen karta redan gör.
/// Nycklarna, utskrivna: en nyckel som byggs av delar går inte att hitta
/// när någon letar efter var en text används.
const MASKNING_KALLA = { text: 'srv.maskning.kalla.text', citat: 'srv.maskning.kalla.citat', svar: 'srv.maskning.kalla.svar',
  bilaga: 'srv.maskning.kalla.bilaga', fraga: 'srv.maskning.kalla.fraga' };
const MASKNING_TITEL = { maskera: 'srv.maskning.titel.maskera', anonymisera: 'srv.maskning.titel.anonymisera', bada: 'srv.maskning.titel.bada' };

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
        // Ingenting att maskera: säg hur man ber om det, i stället för att
        // gissa vilken text som menas.
        tur.svar = tx(a.kalla === 'bilaga' ? 'srv.maskning.ingenBilaga' : a.kalla === 'svar' ? 'srv.maskning.ingetSvar' : 'srv.maskning.vilkenText');
      } else {
        steg('maskera', tx('srv.maskning.steg.maskerar'));
        const t0 = Date.now();
        const fil = val.fil ? (s.filer || []).find(f => f.id === val.fil) : null;
        // Med den lokala tolkningen: du har bett om just det här, och den
        // körs på datorn (lib/grind.mjs). Svarar modellen inte gäller
        // reglerna och namnmodellen, och kvittot säger det.
        const m = await forbered(val.text, { karta: s.karta || [], raknare: s.raknare || {},
          sorter: galler(installningar), tolka: true, signal: kontroll.signal });
        s.karta = m.karta;
        s.raknare = m.raknare;
        // Bilagans maskerade vy blir den här: den är gjord med hela kartan och
        // den lokala tolkningen, och exporten ska ge det kortet visar. En
        // bilaga som lades till omaskerad (Original mot molnet) får nu en mask
        // — du bad om den. En publik källa rörs inte.
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
            // Genom maskeringen igen, med samma karta. Modellen skrev om
            // texten, och en omskrivning kan råka skriva fram ett namn.
            const karta = new Map(s.karta.map(k => [k.original, k.platshallare]));
            const raknare = new Map(Object.entries(s.raknare || {}));
            const h = maskeraHart(r.text, { karta, raknare, sorter: galler(installningar) });
            text = h.skyddat.aterstall(h.text);
            s.karta = [...karta].map(([original, platshallare]) => ({ original, platshallare }));
            s.raknare = Object.fromEntries(raknare);
            anonym = { block: r.block, lamnade: r.lamnade, vagt: r.vagt.slice(0, 40), rojning: bedomRojning(text) };
            // En bilaga får sin anonymiserade vy, så att exporten
            // (/fil/:fid/export?vy=anonym) och kortet har den.
            if (fil && !fil.publik) { fil.anonym = text; fil.anonymRojning = anonym.rojning; }
            kvitto.push({ tid: new Date().toISOString(), aktor: tx('srv.kvitto.lokalModell'), lokalt: true, ms: Date.now() - t1,
              vad: tx('srv.maskning.kvitto.skrevOm', { n: r.block - r.lamnade, av: r.block }) });
          } catch (e) {
            if (kontroll.signal.aborted) throw e;
            // Fail closed på etiketten, inte på texten: den maskerade texten
            // är fortfarande maskerad. Men den ska inte kallas anonymiserad.
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
      // Rubriken säger vad som gjordes, inte texten: titeln syns i listan,
      // och en rubrik ur originalet vore just det som skulle döljas.
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

/// Tar bort modellens inledande prat om sitt eget arbete.
const rensaPrat = text => String(text || '').trim()
  .replace(/^(?:här (?:är|kommer)|nedan (?:följer|står)|jag har|here (?:is|are|comes)|here's|below (?:is|are))[^\n]*\n+/i, '')
  .replace(/^\s*(?:\*{3,}|-{3,}|_{3,})\s*\n+/, '')
  .trim();

async function spara(s) {
  // Utan koden finns bara rubriken i minnet. Att skriva den vore att skriva
  // över innehållet med ingenting.
  if (stangd(s)) throw new Error(tx('srv.session.forsegladAngeKod'));
  s.andrad = new Date().toISOString();
  const kat = sessionsKatalog(s.agare);
  await mkdir(kat, { recursive: true });
  const { forseglad, ...ren } = s;
  await maximus.skrivSession(join(kat, `${s.id}.json`), ren, koder.get(s.id) || null);
  sandAlla({ typ: 'lista', agare: s.agare });
}


/// Låsningen, som en handling i stället för en gren i en rutt.
///
/// Den stod inne i `/api/maximus` med `vad: las`. Nedstängningen behöver
/// exakt samma sak — nyckeln ur minnet, sessionerna tömda, strömmarna
/// stängda, webbläsaren borta, inställningarna rensade — och en andra
/// kopia av femtio rader som ska hållas i takt för hand är den form som
/// bitit i den här koden tio gånger. Ett ställe, två anropare.
///
/// `token` är kakan som låser och som ska få leva vidare: fönstret måste
/// kunna nå kodrutan efteråt. Vid nedstängning finns inget fönster kvar,
/// och då skickas ingen token alls.
async function lasMaximus(token = null) {
  // ── Låset är en övergång, inte en radering av minnet ──────────
  //
  // Det tog nyckeln, sessionerna och inställningarna — men lät
  // pågående arbete fortsätta. En sändning som redan startat hade
  // sina objekt fångade i sin egen stängning och rullade vidare
  // efter låsningen, och öppna strömmar låg kvar och kunde skriva
  // till fönster som inte längre får läsa.
  //
  // Revisionen 2026-09-29 (M8) kallade det avsaknad av en gemensam
  // serverövergång, och hade rätt: ett lås som bara gäller det som
  // BÖRJAR efter det är inget lås, det är en gräns i tiden som
  // arbete kan stå med ena foten på varsin sida om.
  //
  // Avbryt först, stäng sedan, töm sist.
  for (const k of korningar.values()) k.abort(new Error(tx('srv.session.maximusLastes')));
  korningar.clear();
  for (const set of strommar.values()) {
    for (const r of set) { try { r.end(); } catch { /* redan stängd */ } }
  }
  strommar.clear();
  // Och webbläsaren: en öppen kontext bär kakor och cache från arbete
  // som just låstes in.
  await stangWebben().catch(() => {});

  maximus.las_();
  // Finns ett lock är nyckelringen inte längre en bekvämlighet utan
  // en genväg förbi koden. Den glöms när locket stängs.
  if (await Locket.las(dataDir).catch(() => null)) {
    await maximus.glomINyckelring().catch(() => {});
    // Och kakorna — utom den som låser.
    //
    // Ett lock som lämnar giltiga kakor kvar lämnar en väg in bredvid
    // den kod det just krävde. Men fönstret som låser måste kunna nå
    // kodrutan efteråt, annars är låset en utelåsning.
    //
    // Innehållet är ändå stängt: nyckeln är ur minnet, och varje väg
    // som läser innehåll svarar 423 tills koden är inne.
    // Vid nedstängning finns inget fönster som behöver komma tillbaka till
    // kodrutan, och då återkallas ingenting — allt går ner ändå.
    if (token) aterkalla(token);
  }
  sessioner.clear();
  koder.clear();
  oppnadeNycklar.clear();
  // Och det som de nya delarna håller i minnet (granskningen 2026-10-10):
  // förslag till /du med profilens text i, kollegans minne och dagens möten,
  // namnmodellens fynd per stycke (stycket är nyckeln) och det som väntar på
  // att läsas. Ett lås som lämnar kvar det man låste in är ingen låsning.
  bankForslag.clear();
  kollegaMinnet = null;
  knackMoten = { nar: 0, lista: [] };
  Namnmodell.glomNamnmodell();
  // Inställningarna också.
  //
  // Låset tog nyckeln och sessionerna men lämnade inställningarna i
  // minnet — med användarens policytext och proxylösenordet i klartext.
  // Revisionen 2026-09-28 läste båda via /api/uppstart efter ett lås.
  // Ett lås som lämnar kvar det man låste in är ingen låsning.
  installningar = { ...TOMMA_INSTALLNINGAR, klar: installningar.klar, sprak: installningar.sprak };
}

/// ── Nedstängningen ───────────────────────────────────────────────────────
///
/// Stänger du appen ska ingenting stå kvar. Inte servern, inte nyckeln i
/// minnet, inte modellen som håller tjugo gigabyte.
///
/// Så var det inte. Appen startade servern med Rusts `Command::spawn()`, och
/// en `Child` i Rust dödar INTE sitt barn när den slängs — till skillnad från
/// de flesta andra språk. Det fanns heller ingen avslutshanterare. Fönstret
/// stängdes, servern adopterades av init, och Maximus stod upplåst i en
/// process utan fönster. Sett 2026-10-01: "maximus verkar vara på men inte
/// öppet".
///
/// Locket är en HANDLING användaren utför, inte en timer. Den som stänger
/// fönstret utan att fälla locket hade alltså nyckeln kvar i minnet på
/// obestämd tid.
///
/// ── Varför det inte räcker med en rutt ───────────────────────────────────
///
/// En rutt fångar det snälla fallet: appen avslutas och hinner säga till.
/// Den fångar inte Tvinga avsluta, en krasch eller ett strömavbrott i
/// processen — och det är just då en kvarlämnad nyckel är som värst.
///
/// Därför två lås: appen säger till när den kan, och servern vaktar själv
/// att föräldern lever. Dör appen utan ett ord går servern ner ändå, på
/// samma väg och med samma städning.
let stanger = false;

async function stangNer(varfor) {
  if (stanger) return;
  stanger = true;
  console.log(`MAXIMUS stänger: ${varfor}`);

  // Låset först, och det är hela poängen. Nyckeln ur minnet, sessionerna
  // tömda, strömmarna stängda, webbläsaren borta, inställningarna rensade —
  // samma handling som Locket, för det är samma sak som ska hända.
  await lasMaximus().catch(e => console.log(`  låsningen klagade: ${e.message}`));

  // Modellen håller tiotals gigabyte under ett lease hos schemaläggaren. Lämnas den
  // kvar är den minne ingen längre använder, och nästa sak som vill ladda
  // en modell får vänta på något som inte finns.
  // En pausad modell (vilan, Fas 26) tar inte emot SIGTERM förrän den får
  // gå vidare. Utan fortsätt först blev den hängande: 2026-10-05 låg fyra
  // stoppade modeller på 29 GB kvar efter servrar som dött.
  if (modellPausad) await fortsattModell().catch(() => {});
  await stoppaModell().catch(() => { /* ingen egen modell att stänga */ });

  // Pid-filen ska aldrig överleva processen den pekar på.
  await unlink(join(dataDir, 'server.pid')).catch(() => {});

  // Och ett märke: det här var med flit.
  //
  // scripts/vakta.sh håller MAXIMUS uppe genom att starta om servern när
  // porten tystnar. Den skrevs mot SIGTERM ingen kunde förklara, och den
  // kan inte se skillnad på en krasch och ett avslut — så den väckte det
  // som just stängts. Sett 2026-10-01: nedstängningen körde rent, kod 0,
  // och åtta sekunder senare stod servern uppe igen med modellen laddad.
  //
  // Märket säger vad vakten inte kan gissa. Det tas bort vid nästa start,
  // så det håller bara till dess någon öppnar MAXIMUS igen.
  await writeFile(join(dataDir, 'stangd-med-flit'), new Date().toISOString(), { mode: 0o600 })
    .catch(() => {});
  process.exit(0);
}

for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(signal, () => { stangNer(signal); });
}

/// Servern skriver sin EGEN pid-fil.
///
/// Appen skrev den vid starten och rörde den aldrig igen. Den uppdaterades
/// alltså inte när servern byttes — av scripts/omstart.sh, eller av en app
/// som återanvände en server som redan svarade. Mätt 2026-10-01: filen sa
/// 40394, den som faktiskt lyssnade var 48982, och 40394 fanns inte längre.
///
/// Ett pid-nummer återanvänds av operativsystemet. En städrutin som litat på
/// den filen hade alltså dödat ingenting — eller fel process. Den som vet
/// sitt pid ska skriva det, och ta bort det när den dör.
await writeFile(join(dataDir, 'server.pid'), String(process.pid), { mode: 0o600 });
// Startar MAXIMUS igen är den inte längre stängd med flit.
await unlink(join(dataDir, 'stangd-med-flit')).catch(() => {});

/// Vakten: lever appen som startade oss?
///
/// MAXIMUS_FORALDER är appens pid. Försvinner den har fönstret gått ner utan
/// att hinna säga till — tvångsavslutat, kraschat, eller dödat utifrån — och
/// då ska servern ner på samma väg som annars.
///
/// `kill(pid, 0)` skickar ingen signal; den frågar bara om processen finns
/// och om vi får röra den.
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

/// Liggaren. Varje utgående nyttolast, krypterad, en fil per dygn.
///
/// Det här är inte loggning för felsökning. Det är svaret på frågan ett
/// dataskyddsombud ställer: vad har lämnat den här datorn?
/// Liggaren är organisationens, inte användarens.
///
/// En logg över vad som lämnat datorn är värdelös om den inte säger vem som
/// skickade det, och den hör hemma på ett ställe — dataskyddsombudet ska
/// läsa en fil, inte femhundra.
async function liggare(post) {
  /// Liggaren är ett val, inte en självklarhet.
  ///
  /// En förteckning över allt du skickat är en tillgång för den som ska kunna
  /// visa vad som hänt, och en börda för den som inte ska det. Vilket det är
  /// beror på vem du är, och det vet inte MAXIMUS — så MAXIMUS frågar i stället för
  /// att bestämma.
  ///
  /// Är den av skrivs ingenting. Inte "mindre", inte "bara metadata" — inget.
  /// En halv logg är en logg man tror är av.
  if (installningar.liggare === false) return;

  // Tiden sätts här om den saknas. En anropare som glömmer den ska inte
  // kunna välta liggaren — och en liggare som välter ska inte kunna välta
  // servern. Se skyddsnätet längst ned i filen.
  post.tid = post.tid || new Date().toISOString();

  // En förseglad sessions innehåll hör i dess eget kuvert.
  //
  // Sett 2026-09-25: liggarraden bär `skickat` — hela den maskerade
  // nyttolasten — och `mottaget`, hela svaret. Filen krypteras med
  // huvudnyckeln. En förseglad session krypteras med huvudnyckel OCH kod, och
  // utan koden är den borta för alltid. Men liggarraden gick att läsa med
  // bara lösenordet, och exporten skriver den i klartext med flit.
  //
  // Alltså: allt en förseglad session någonsin skickade gick att läsa utan
  // koden. Förseglingen höll på sessionen och läckte genom loggen.
  //
  // Nu läggs innehållet i ett eget kuvert med sessionens nyckel. Raden finns
  // kvar — att en sändning skedde, när, vart och hur många tecken är själva
  // poängen med en liggare och ska aldrig gå att dölja. Men vad som stod i
  // den kräver koden, precis som sessionen.
  const sess = post.session ? sessioner.get(post.session) : null;
  if (sess?.las?.styrka === 'forseglad') {
    const { skickat, mottaget, ...resten } = post;
    try {
      const nyckel = await maximus.nyckelFor(sess, koder.get(sess.id) || null);
      post = { ...resten, forseglad: true,
        kuvert: maximus.forsegla(JSON.stringify({ skickat, mottaget }), nyckel) };
    } catch {
      // Ingen kod till hands: skriv raden utan innehåll snarare än med. En
      // liggare som saknar en nyttolast är ofullständig; en som läcker en
      // förseglad session är trasig.
      post = { ...resten, forseglad: true, kuvert: null };
    }
  }
  const dag = post.tid.slice(0, 10);
  const vag = join(dataDir, 'liggare', `${dag}.json`);
  // Läs, lägg till, skriv — i ett svep.
  //
  // Här stod de tre stegen var för sig. Skrivningen var serialiserad men
  // läsningen inte, så tolv samtidiga sändningar läste samma tomma fil, la
  // till var sin rad i var sin kopia och skrev över varandra. Elva rader
  // försvann, och de rör utgående trafik.
  //
  // Länken bakåt sätts när dagen ÖPPNAS, inte vid varje rad. En dag som
  // fortfarande tar emot rader har ingen stabil hash; gårdagen har det, och
  // det är gårdagen som låses här. Se lib/liggarkedja.mjs.
  //
  // Räkningen sker inne i `andra`, alltså inne i den serialiserade kedjan för
  // filen. Utanför hade två samtidiga förstarader på en ny dag kunnat räkna
  // var sin länk och skriva över varandras.
  await maximus.andraFil(vag, async gammalt => {
    // Redan kedjad: länken står och ska inte räknas om. Att räkna om den
    // varje rad hade flyttat länken från gårdagens slutliga innehåll till
    // gårdagens innehåll just nu — och gårdagen är slut.
    if (Liggarkedja.arKedjad(gammalt))
      return { ...gammalt, rader: [...gammalt.rader, post] };

    // Ny dag, eller en dag i det gamla listformatet som möter kedjan för
    // första gången. Båda får en riktig länk bakåt: en fil som migreras ska
    // inte se ut som en kedja som saknar början.
    const lank = await Liggarkedja.lankaTill(maximus, dataDir, dag);
    return { k: Liggarkedja.KEDJEVERSION, forra: lank.forra, forraDag: lank.forraDag,
      rader: [...(Liggarkedja.raderUr(gammalt) || []), post] };
  }, { forval: null });
}

/// Hämtningar i liggaren (granskningen 2026-10-09).
///
/// Modell, bilddel, lyssnarmodell, npx-paket och serveradressens prov gick ut
/// över nätet utan en rad. Liggaren ska svara på vad som lämnat och kommit
/// in till datorn, och en gigabyte från Hugging Face är inte mindre trafik
/// för att den kom på begäran.
const hamtningsliggare = jag => p => liggare({ ...p, anvandare: jag?.id || null, session: null, aktor: tx('srv.helig.duTitel') });

/// Karantänmärket på en fil vars innehåll kom utifrån (granskningen 2026-10-09).
///
/// En session kan vara en delning från någon annan, eller bygga på sidor
/// från webben. Filen den blir skrevs och öppnades utan
/// `com.apple.quarantine`, och då öppnar Office den utanför Skyddad vy. Med
/// märket är det Office som avgör, som för en bilaga i ett mejl.
const franUtifran = s => Boolean(s?.delad)
  || (s?.turer || []).some(t => (t.kallor || []).some(k => /^https?:/i.test(String(k?.url || ''))));
const karantan = fil => process.platform !== 'darwin' ? Promise.resolve() : new Promise(klar =>
  execFileCb('/usr/bin/xattr', ['-w', 'com.apple.quarantine', `0081;${Math.floor(Date.now() / 1000).toString(16)};Maximus;`, fil],
    e => { if (e) console.error('karantänmärket gick inte att sätta:', e.message); klar(); }));

/// Öppnar en förseglad liggarrad — om koden är inne just nu.
///
/// Servern är den enda som vet vilka koder som är upplåsta, så öppnandet hör
/// hit och inte i liggarmodulen. Utan kod kommer raden ändå, utan innehåll.
function liggaroppnare(rad, kuvert) {
  const sess = rad.session ? sessioner.get(rad.session) : null;
  if (!sess || !koder.has(sess.id)) return null;
  // nyckelFor är async; här behövs ett synkront svar. Nyckeln till en öppnad
  // session ligger redan i minnet — se `oppnadeNycklar`.
  const nyckel = oppnadeNycklar.get(sess.id);
  if (!nyckel) return null;
  return JSON.parse(maximus.oppnaKuvert(kuvert, nyckel));
}

/// Nycklar till sessioner som är öppna just nu. Försvinner när Maximus låses.
///
/// Koden räcker inte för att öppna en liggarrad synkront — nyckeln härleds med
/// scrypt och det tar tid med flit. Den härleds en gång när sessionen öppnas
/// och ligger kvar så länge den är öppen, aldrig längre.
const oppnadeNycklar = new Map();

async function minnsKod(sess, kod) {
  koder.set(sess.id, kod);
  try { oppnadeNycklar.set(sess.id, await maximus.nyckelFor(sess, kod)); }
  catch { oppnadeNycklar.delete(sess.id); }
}

const glomKod = id => { koder.delete(id); oppnadeNycklar.delete(id); };

/// Tar bort en session helt: ur minnet, artefakterna, filen och koden.
///
/// Egen funktion sedan Fas 2 (2026-10-03): "Rensa allt" och radmenyns "Ta
/// bort" ska radera på samma sätt. Två vägar som raderar var för sig är två
/// vägar där den ena glömmer artefakterna.
///
/// sessionsKatalog(), inte en hopbyggd sökväg. Här stod en gång
/// join(dataDir, 'sessioner', ...) — skrivbordets plats. En session med en
/// ägare bor i ägarens katalog, så raderingen tog bort den ur minnet och
/// lämnade filen kvar. Vid nästa omstart kom den tillbaka.
///
/// Svarar med felet som en mening, eller null. Fanns filen inte är saken
/// ändå utagerad; allt annat är ett besked användaren ska få, inte ett fel
/// som sväljs — hon bad om att bli av med något och har rätt att veta om
/// det ligger kvar.
async function taBortSession(s) {
  korningar.get(s.id)?.abort(new Error(tx('srv.session.borttagen')));
  sessioner.delete(s.id);
  glomKod(s.id);
  // Artefakterna först. En katalog med krypterade filer som ligger kvar
  // efter sitt samtal är material ingen kan nå och ingen vet om.
  await Artefakt.taBortAlla(sessionsKatalog(s.agare), s.id).catch(() => {});
  try { await unlink(join(sessionsKatalog(s.agare), `${s.id}.json`)); }
  catch (e) { if (e.code !== 'ENOENT') return e.message; }
  return null;
}

const json = (res, kod, v) => { res.writeHead(kod, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(v)); };

/// Regelpaketet. Det nyaste giltiga, och det inbyggda om inget finns på disk.
///
/// Reglerna följer med varje ny version av appen. Ett signerat paket som
/// redan ligger på disk används fortfarande; ingen server tillfrågas
/// (öppen källkod, 2026-10-09).
let paket = Regelpaket.valj(await readFile(join(dataDir, 'regelpaket.json'), 'utf8').catch(() => null));
satExtraMonster(Regelpaket.monsterUr(paket));
if (paket.varning) console.log(`  ⚠ regelpaketet: ${paket.varning}`);

/// Det senaste intyget, som det ligger på disk.
let intyget = await maximus.lasFil(join(dataDir, 'intyg.json'))
  .then(t => JSON.parse(t)).catch(() => null);

/// Gränssnittets filer. Lästa ur katalogen, inte uppräknade.
///
/// Här stod en handskriven lista: varje fil i public/ med sin väg och sin
/// typ, och en andra lista över vilka av dem som fick hämtas utan
/// inloggning. Att lägga till en modul krävde alltså att man ändrade på tre
/// ställen och kom ihåg alla tre.
///
/// 2026-10-01 kom public/fragor.js till. Listorna rördes inte. Importen i
/// app.js gav 404, hela modulen slutade köra, och appen stannade på
/// startskärmen — ingen felruta, inget i gränssnittet som sa vad som hänt.
///
/// Det är samma form som har gett fel nio gånger tidigare i den här koden:
/// en lista vid sidan av den riktiga strukturen, som måste hållas i takt för
/// hand. Katalogen ÄR listan. Nu läses den.
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
// Sidan själv svarar på roten också.
statisk['/'] = statisk['/index.html'];

/// Vem frågar?
///
/// Skrivbordet har en användare och behöver ingen kaka. Säger utökningen
/// vem som frågar är det dess sak.
function vemAr(req) {
  if (!IDENTITET) return { id: 'en', namn: installningar.namn };
  return utokning.vemAr(req);
}

/// Nyckeln som skiljer MAXIMUS:s eget gränssnitt från allt annat på datorn.
///
/// Servern lyssnade på 127.0.0.1 och släppte in den som skickade huvudet
/// `x-maximus-local: 1`. Det är ingen hemlighet — det står i källkoden, och
/// vilken process som helst på datorn kunde alltså läsa varje session,
/// liggaren och inställningarna. En port på loopback är inte privat för
/// användaren; den är öppen för allt användaren kör.
///
/// Nu föds en nyckel vid varje start. Den skrivs till Maximuss katalog med
/// 0600 — samma rättigheter som sessionerna — så att skrivbordsskalet kan
/// läsa den, och ingen annan. Skalet öppnar fönstret på `/?n=<nyckel>`,
/// servern sätter en kaka, och resten av anropen bär den.
///
/// Modellen bytte till en socket och slapp portar helt. Gränssnittet kan inte:
/// en webview måste ha en URL. Då får porten en nyckel i stället.
/// Nyckeln överlever en omstart.
///
/// Den slumpades vid varje start, och då blev varje omstart en utelåsning:
/// fönstret som redan stod öppet bar en kaka med den gamla nyckeln och möttes
/// av "Öppna MAXIMUS från appen" i sin egen app. Under utveckling hände det
/// tjugo gånger på en kväll; hos en användare hade det hänt varje gång
/// servern startat om efter en uppdatering.
///
/// Att läsa den ur filen är inte svagare. Filen är 0600 och hotbilden är
/// andra processer på datorn — de kommer inte åt den vare sig den är en
/// timme eller en vecka gammal. Det som skyddar är att den är hemlig, inte
/// att den är ny.
const nyckelfil = join(dataDir, 'nyckel');
const NYCKEL = process.env.MAXIMUS_NYCKEL
  || (await readFile(nyckelfil, 'utf8').catch(() => '')).trim()
  || randomBytes(32).toString('base64url');
if (!IDENTITET) await writeFile(nyckelfil, NYCKEL, { mode: 0o600 });

/// Kakan lever lika länge som nyckeln gör.
///
/// Den stod på 86400 — ett dygn — och då blev varje natt en utelåsning.
/// Fliken som stått öppen sedan i går möttes av "Öppna MAXIMUS från appen" i sin
/// egen app, på sin egen dator, utan att något hade hänt. Sett skarpt
/// 2026-09-28: appen gick inte att öppna efter 28 timmar, och det såg ut som
/// en licensspärr.
///
/// Kortare kaka är inte säkrare här. Hotbilden är andra processer på datorn,
/// och de läser nyckelfilen — inte webbläsarens kakburk. Samma resonemang som
/// står ovanför om varför nyckeln får överleva en omstart: det som skyddar är
/// att den är hemlig, inte att den är ny. En utgångstid som bara låser ute
/// ägaren skyddar ingen.
///
/// 400 dagar är vad webbläsare ändå kapar till. Byts nyckeln i filen slutar
/// den gamla kakan gälla samma sekund — det är där återkallandet sitter.
/// Kakan lever trettio dagar och förnyas när appen används.
///
/// Här stod 400 dagar. Revisionen 2026-09-28 (M11) underkände det som
/// allmänt sessionsskydd, och hade rätt: en delad bärarhemlighet som gäller
/// i över ett år, utan någon väg att återkalla den, är inte en session — det
/// är en nyckel som råkar ligga i en kaka.
///
/// Trettio dagar, förnyade vid varje anrop, betyder att en dator som inte
/// öppnats på en månad kräver appen igen. Den som använder MAXIMUS dagligen
/// märker ingenting.
///
/// `Secure` sätts inte, och det är avsiktligt: det skulle göra kakan oanvänd
/// över http, och loopback ÄR http här. Att sätta attributet på en
/// http-app vore att skriva dit ett skydd som inte finns.
const KAKANS_ALDER = 60 * 60 * 24 * 30;
const nyckelkaka = token => `maximus=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${KAKANS_ALDER}`;

/// Återkallandet som saknades.
///
/// Nyckeln i filen kan inte bytas utan att appen tappar kontakten — Tauri
/// läser den vid start. Men kakan kan det: den bär nyckeln OCH en epok, och
/// en höjd epok gör varje utlämnad kaka obrukbar på en gång.
///
/// Det ger en väg tillbaka som inte fanns: har en kaka hamnat i en skärmdump
/// eller en delad logg går den att döda utan att något annat rivs. Fönstret
/// hämtar en ny nästa gång appen öppnas.
/// ── Kakan bär ingen hemlighet som går att återanvända ────────────────────
///
/// Första försöket gjorde kakan till `NYCKEL.epok` och lät återkallandet
/// höja epoken. Det återkallade kakan men inte den ÅTKOMST kakan bar:
/// revisionen 2026-09-29 (H3) tog hemlighetsdelen ur en återkallad kaka,
/// använde den i `/?n=...`, fick 302 och en ny giltig kaka.
///
/// En återkallelse som går att gå runt genom att läsa det man just
/// återkallade är ingen återkallelse.
///
/// Nu är kakan en egen slumpad token som inte innehåller något annat.
/// Återkallandet glömmer tokens; bootstrapnyckeln i filen rörs inte, för
/// Tauri läser den vid start och skulle annars tappa kontakten. Den som
/// stulit en kaka har därmed en sträng som inte längre betyder något, och
/// inget att härleda ur den.
///
/// Mängden lever i processen: en omstart glömmer allt och varje fönster
/// hämtar en ny genom appens egen adress. Det är strängare, inte svagare.
/// ── Tokens överlever en omstart ──────────────────────────────────────────
///
/// Första försöket höll dem bara i processen. Följden var att varje omstart
/// av servern loggade ut fönstret som stod öppet: kakan pekade på en token
/// som inte fanns längre, och användaren möttes av "Fel nyckel." mitt i ett
/// samtal — utan att ha gjort något.
///
/// Den gamla kakan hade inte det problemet, för den bar NYCKEL, och NYCKEL
/// läses ur filen vid start. Men det var just därför den inte gick att
/// återkalla: hemligheten i kakan var samma hemlighet som öppnade dörren.
///
/// Alltså: egna tokens som INTE innehåller något, sparade bredvid nyckeln
/// med samma rättigheter. En omstart behåller dem; ett återkallande raderar
/// filen. Båda sakerna är sanna samtidigt, vilket de inte var förut.
const tokenfil = () => join(dataDir, 'sessioner.token');
let sessionstoken = new Set();
const TOKENTAK = 50;

try {
  const rader = (await readFile(tokenfil(), 'utf8')).split('\n').map(r => r.trim()).filter(Boolean);
  sessionstoken = new Set(rader.slice(-TOKENTAK));
} catch { /* första starten, eller återkallat */ }

async function sparaToken() {
  try {
    await writeFile(tokenfil(), [...sessionstoken].join('\n'), { mode: 0o600 });
  } catch (e) {
    // Går den inte att spara fungerar allt ändå — tills nästa omstart. Det
    // ska synas i loggen, inte tigas ihjäl.
    console.error('kunde inte spara sessionstoken:', e.message);
  }
}

function nyToken() {
  // Taket är inte ett minnesskydd — det är en gräns för hur många gamla
  // fönster som kan ligga kvar och gälla. Femtio är fler än någon har.
  if (sessionstoken.size >= TOKENTAK) sessionstoken.delete(sessionstoken.values().next().value);
  const t = randomBytes(32).toString('base64url');
  sessionstoken.add(t);
  void sparaToken();
  return t;
}

/// Återkallar. `utom` är den token som får stå kvar.
///
/// Låsningen kallade det här utan undantag, och drog därmed undan mattan
/// under fönstret som just låste: kakan blev ogiltig, sidan laddade om, och
/// användaren möttes av "Öppna MAXIMUS från appen" i stället för kodrutan.
/// Revisionen 2026-09-29 (M1) mätte det — 403 direkt efter låsningen.
///
/// Det är fel sorts spärr. Att låsa Maximus ska ta bort ÅTKOMSTEN TILL
/// INNEHÅLLET, inte vägen till upplåsningen. Den som står vid datorn ska
/// kunna skriva sin kod; det är andra fönster, andra maskiner och gamla
/// kakor som ska förlora sin.
const aterkalla = (utom = null) => {
  const n = sessionstoken.size;
  sessionstoken.clear();
  if (utom) sessionstoken.add(utom);
  if (sessionstoken.size) void sparaToken();
  else void unlink(tokenfil()).catch(() => {});
  return utom ? n - 1 : n;
};

/// Kakan i det här anropet, om den gäller.
const minToken = req => {
  const k = /(?:^|;\s*)maximus=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  return k && sessionstoken.has(k) ? k : null;
};

/// Har den som frågar nyckeln?
///
/// Tre vägar in, och alla tre är samma nyckel: kakan som sätts när fönstret
/// öppnas, huvudet för den som anropar API:t direkt, och `?n=` en enda gång.
function harNyckel(req, url, vag) {
  if (IDENTITET) return true;   // utökningen säger vem som frågar, se vemAr
  // Nyckeln i adressen duger bara för att komma in genom dörren.
  //
  // Förr godtogs `?n=` på VARJE väg. En nyckel i en URL är en nyckel i
  // webbläsarens historik, i en skärmdump, i en proxylogg och i varje
  // felrapport som råkar bära adressen — och den gällde i 400 dagar.
  //
  // Nu gäller den bara på `/`, där den omedelbart växlas mot en kaka och
  // städas bort ur adressfältet. Allt annat kräver kakan eller huvudet.
  // Jämförs i konstant tid (granskningen 2026-10-09): `===` läcker genom
  // svarstiden hur mycket av början som stämde.
  if (vag === '/' && nyckelLika(url.searchParams.get('n'), NYCKEL)) return true;
  if (nyckelLika(req.headers['x-maximus-nyckel'], NYCKEL)) return true;
  const kaka = /(?:^|;\s*)maximus=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  return Boolean(kaka) && sessionstoken.has(kaka);
}

/// Kommer anropet från en annan webbplats?
///
/// Webbläsaren skickar `Sec-Fetch-Site` och den går inte att förfalska från
/// en sida. Kakan är visserligen SameSite=Strict, men ett andra lås som inte
/// kostar något är ett andra lås.
const franAnnanPlats = req => {
  const s = req.headers['sec-fetch-site'];
  return s && s !== 'same-origin' && s !== 'none';
};

/// Svaret när nyckeln saknas.
///
/// `{"error":"Fel nyckel."}` i ett fönster är både obegripligt och fult — den
/// som ser det har inte gjort något fel, hon har bara öppnat adressen i en
/// vanlig webbläsare i stället för i appen. En sida som säger det, på
/// svenska, med appens egna färger.
///
/// Anrop mot API:t får JSON som förut. Det är en maskin som frågar.
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

// Varje anrop vet ditt språk (fas 3): installningar.sprak genom
// Sprakstod.valtCachat — ditt val, annars datorns, räknat en gång och
// sparat. Allt anropet väntar på läser det med Sprakstod.tx(), och det som
// körs utanför ett anrop (hjärtslaget, agenten) läser det senast kända.
const server = createServer(async (req, res) => {
  const kod = await Sprakstod.valtCachat(installningar.sprak).catch(() => Sprakstod.GRUND);
  return Sprakstod.med(kod, () => hanteraAnrop(req, res));
});

async function hanteraAnrop(req, res) {
  try {
    // Skrivbordet svarar bara på sitt eget namn (granskningen 2026-10-09).
    //
    // En sida vars domän byter adress till 127.0.0.1 (DNS-rebinding) blir
    // annars samma ursprung som servern, och når vägarna som går före
    // nyckeln: tilläggets parkod och molninloggningens återhopp. Därför
    // först av allt, före varje väg. En utökning som säger vem som frågar
    // nås under eget namn och prövas inte här.
    if (!IDENTITET && !tillatenVard(req.headers.host, PORT)) {
      res.writeHead(421, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: tx('srv.fel.felVardnamn') }));
    }
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const vag = url.pathname;

    // Skalets fråga innan det lämnar ut nyckeln (granskningen 2026-10-09).
    //
    // Skalet skickade nyckeln till vad som helst som svarade på porten, och
    // en annan användare på datorn kunde binda den först. Nu skickar skalet
    // en ny slumpad utmaning och kräver HMAC-SHA256(nyckel, utmaning) tillbaka
    // — något bara den riktiga servern kan räkna ut. Vägen går före nyckeln,
    // för det är just nyckeln skalet ännu inte vågar skicka. Svaret säger
    // ingenting om nyckeln.
    if (vag === '/api/identitet' && req.method === 'GET') {
      if (IDENTITET) return json(res, 404, { error: tx('srv.fel.finnsInte') });
      const svar = svarPaUtmaning(NYCKEL, url.searchParams.get('utmaning') || '');
      if (!svar) return json(res, 400, { error: tx('srv.fel.utmaning') });
      return json(res, 200, { svar });
    }

    // Tilläggets väg går utanför båda låsen, och har ett eget i stället.
    //
    // Tillägget kör i webbläsaren: det kan inte känna till startnyckeln i
    // appens adressfält, och dess anrop kommer med Sec-Fetch-Site:
    // cross-site. Båda kontrollerna nedan hade stängt ute det.
    //
    // I stället krävs parkoden — ett delat värde användaren flyttar för hand
    // en gång. Och vägen kan EN sak: maskera text. Inga sessioner, inga
    // frågor, ingen liggare. En parkod på avvägar ska inte kunna bli en
    // läsrättighet till någons ärenden. Se lib/tillagg.mjs.
    //
    // Inga CORS-huvuden sätts, med avsikt. Ett tillägg med `host_permissions`
    // mot 127.0.0.1 går förbi CORS; en vanlig webbsida gör det inte och kan
    // därför inte LÄSA svaret även om den skickar anropet.
    if (vag.startsWith('/api/tillagg/')) {
      if (!await Tillagg.gilltig(maximus, dataDir, req.headers['x-maximus-tillagg']))
        return json(res, 403, { error: tx('srv.tillagg.inteIhopparat') });
      if (vag === '/api/tillagg/para') {
        await Tillagg.noteraParning(maximus, dataDir);
        return json(res, 200, { ok: true });
      }
      if (vag === '/api/tillagg/maskera') {
        // Kroppen läses här och inte med den vanliga rutinen: den ligger
        // efter nyckelkontrollen, och tilläggets väg går före den.
        let rå = '';
        for await (const bit of req) {
          rå += bit;
          if (rå.length > 2e6) return json(res, 413, { error: tx('srv.fel.forStorText') });
        }
        const text = String(JSON.parse(rå || '{}')?.text || '').slice(0, 60000);
        if (!text) return json(res, 422, { error: tx('srv.fel.ingenText') });
        // Samma förberedelse som appens egen maskknapp. En andra väg med en
        // egen maskering vore en andra maskering att hålla i takt.
        const f = await forbered(text, { sorter: galler(installningar), tolka: true });
        // Bara platshållarna ut, aldrig originalen. Tillägget behöver veta
        // VAD som byttes för att kunna säga hur mycket — inte vad det var.
        // Kartan tillbaka lämnar aldrig appen, och minst av allt till en
        // webbläsare.
        return json(res, 200, { maskerad: f.maskerad,
          funna: (f.nya || []).map(n => n.platshallare).filter(Boolean) });
      }
      return json(res, 404, { error: tx('srv.fel.okandVag') });
    }

    // Utökningens vägar före nyckeln: ett återhopp från en annan plats bär
    // ingen nyckel, och utökningen skyddar dem själv.
    if (await utokning?.fore?.(req, res, url, vag)) return;

    // Svaret från OpenRouter (2026-10-09). Kommer från din webbläsare, inte
    // från appen, och har därför ingen nyckel: det släpps in av tillståndet,
    // som bara Maximus känner till, gäller tio minuter och en gång.
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

    if (franAnnanPlats(req)) return json(res, 403, { error: tx('srv.fel.annanPlats') });
    if (!harNyckel(req, url, vag)) return utanNyckel(req, res, vag);

    // Kakan förnyas när appen används.
    //
    // Trettio dagar som räknas från senaste anropet, inte från första: den
    // som använder MAXIMUS dagligen möter aldrig en utgången kaka, och en dator
    // som stått orörd i en månad kräver appen igen. Det är skillnaden mellan
    // en session och en nyckel som råkar ligga i en kaka.
    //
    // Förlänger den token som redan gäller. Präglar ingen ny: en ny token
    // per anrop hade fyllt mängden och gjort taket till en utloggning.
    if (!IDENTITET && !res.headersSent) {
      const min = /(?:^|;\s*)maximus=([^;]+)/.exec(req.headers.cookie || '')?.[1];
      if (min && sessionstoken.has(min)) res.setHeader('Set-Cookie', nyckelkaka(min));
    }

    const jag = vemAr(req);
    jagNu = jag;
    if (IDENTITET && utokning.grind?.(res, vag, jag)) return;

    if (req.method === 'GET') {
      // Ett skyddat maximus som inte är upplåst lämnar inte ut något innehåll.
      // Inte sessioner, inte liggaren, inte inställningar.
      //
      // Men skalet är inte innehåll. Första versionen av den här spärren
      // svarade 423 på ALLT utom två api-vägar — också på `/`, `app.js` och
      // `style.css`. Följden var att ett låst maximus inte gick att låsa upp:
      // fönstret fick `{"error":"Maximus är låst."}` i stället för en app, och
      // det fanns ingen ruta att skriva lösenordet i. Ett lås utan nyckelhål.
      //
      // Skalet ligger i programfilen och är lika hemligt som ikonen. Att
      // vägra lämna ut det skyddar ingenting och stänger ute ägaren.
      //
      // Listan är därför vänd rätt: det som SKA ut när Maximus är låst står
      // uppräknat, och allt annat nekas. Samma fel — en handskriven lista av
      // undantag bredvid den riktiga strukturen — har bitit i den här koden
      // fem gånger förut.
      const utanUpplasning = Boolean(statisk[vag])
        || vag === '/api/uppstart'
        || Boolean(utokning?.utanUpplasning?.(vag))
        || vag.startsWith('/api/handelser');
      if (maximus.skyddat && !maximus.upplast && !utanUpplasning)
        return json(res, 423, { error: tx('srv.fel.maximusLast') });

      if (statisk[vag]) {
        // Kom nyckeln i adressen sätts kakan, och adressen städas bort ur
        // fönstrets historik — en nyckel i en URL är en nyckel i en skärmdump.
        if (!IDENTITET && vag === '/' && nyckelLika(url.searchParams.get('n'), NYCKEL)) {
          res.writeHead(302, { Location: '/', 'Set-Cookie': nyckelkaka(nyToken()), 'Cache-Control': 'no-store' });
          return res.end();
        }
        res.writeHead(200, { 'Content-Type': statisk[vag].typ, 'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'" });
        return res.end(statisk[vag].kropp);
      }
      if (vag === '/favicon.ico') { res.writeHead(302, { Location: '/favicon.svg' }); return res.end(); }

      // Utökningens GET-vägar.
      if (await utokning?.las?.(req, res, url, vag, jag)) return;

      if (vag === '/api/uppstart') return json(res, 200, {
        // Var appen körs från (2026-10-10). En app som körs direkt ur DMG:n
        // eller ur macOS karantänkopia (App Translocation) ligger på en
        // skrivskyddad plats, och uppdateringen föll med "Read-only file
        // system (os error 30)". Ytan säger det i förväg i stället.
        appPlats: appPlats(),
        // Vem jag är följer med uppstarten, och utökningens del av
        // gränssnittet om den har en: app.js laddar den modulen bara då.
        utokning: utokning?.yta || null,
        jag: jag ? { id: jag.id, namn: jag.namn, roll: jag.roll } : null,
        // Språket ytan ritas på (2026-10-09): ditt val, annars datorns.
        sprak: await Sprakstod.valt(installningar.sprak),
        grind: await grindSvarar(),
        // Vad agenten saknar för att arbeta, ur samma regel som grinden.
        behov: agentBehov(),
        // Molnmodellen (Fas 51): svarar i stället för den lokala när den är på.
        moln: molnPa() ? { pa: true, namn: molnNamn() } : null,
        pausad: modellPausad,
        // Avstängd av användaren: uppstartsvilan väntar då inte in den.
        avstangd: modellAvstangd,
        maximus: { skyddat: maximus.skyddat, upplast: maximus.upplast, minns: await maximus.minnsINyckelring().catch(() => false) },
        // Locket. Bara läget — aldrig kuvert, aldrig salt.
        locket: Locket.lage(await Locket.las(dataDir).catch(() => null)),
        // Rösterna. Namn, beskrivning och ett exempel — aldrig instruktionen.
        personas: personalista(),
        val: Behandling.listor(),
        // Ur ett låst maximus kommer inga inställningar.
        //
        // De bär policytext och proxylösenord, och uppstartsvägen svarade
        // med dem också efter ett lås. Det som skyddas ska skyddas överallt,
        // annars är skyddet en vy och inte ett lås.
        // Och aldrig hemligheterna, inte ens upplåst (granskningen 2026-10-09):
        // gränssnittet får veta OM en klienthemlighet och proxylösenordet är satta.
        installningar: (maximus.skyddat && !maximus.upplast) ? { klar: installningar.klar } : utanHemligheter(installningar),
        // Villkoren går före allt annat, också före lösenordet: utan
        // godkännande ingen app. Därför följer läget med även ur ett låst
        // Maximus — det bär ingenting som behöver skyddas.
        villkor: await Villkor.las().then(v => ({ version: v.version, datum: v.datum,
          godkant: Villkor.godkant(installningar.villkor, v.version) })).catch(e => ({ fel: e.message })),
        // Det som faktiskt svarar. Jan är bara vad guiden laddar ned när
        // ingenting svarar än.
        modell: { namn: 'Jan v3', storlek: tx('srv.modell.janStorlek'), ...await vilkenModell(), finns: await modellFinns(),
          kontext: kontexten(), kontexter: KONTEXTER, kontextNu: await kontextTak().catch(() => null) },
        orat: await orat(),
        formaga: await formaga(),
        webb: await webbFinns(),
        ko: ko?.lage() || null,
        jag: jag ? { id: jag.id, namn: jag.namn, roll: jag.roll } : null,
        maskering: { sorter: MASKSORTER, paket: PAKET, valda: [...galler(installningar)], paketNu: paketFor(galler(installningar)) },
        namnmodell: await Namnmodell.namnmodellLage(),
      });

      /// Funktionsbeskrivningen. Samma rader som modellen och hjälpen läser.
      if (vag === '/api/funktioner') return json(res, 200, {
        funktioner: Funktioner.FUNKTIONER, tabell: Funktioner.tabell(),
      });

      /// Tillstånden: vad Maximus får läsa, och besluten med sina skäl.
      // Går källan att läsa? Meddelanden och samtal prövas på riktigt —
      // svaret säger om Full skivåtkomst saknas. Mappar: förslagen.
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

      /// Starten: ett förslag på båda modellerna, med varför. Se lib/start.mjs.
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

      /// Inkorgen: konton och rubriker. Aldrig brödtext här.
      ///
      /// Ett mejl bär mer persondata än allt annat i appen. Rubrikerna räcker
      /// för att välja, och brödtexten hämtas först när någon öppnat ett brev
      /// — en inkorg som läser in tusen brödtexter har läst tusen brev ingen
      /// bett om.
      if (vag === '/api/post/konton') {
        if (!Post.finns()) return json(res, 200, { finns: false, konton: [] });
        // Med förvalet för etiketten (2026-10-10): iCloud och Gmail privat, en
        // egen domän jobb, annars null — och då frågar gränssnittet.
        try { return json(res, 200, { finns: true, konton: (await Post.konton()).map(k => ({ ...k, forval: Konton.forvalEtikett(k) })) }); }
        catch (e) { return json(res, 200, { finns: true, konton: [], fel: e.message, tillstand: Boolean(e.tillstand) }); }
      }

      /// Kalendrarna på datorn.
      if (vag === '/api/kalender/kalendrar') {
        if (!Kalender.finns()) return json(res, 200, { finns: false, kalendrar: [] });
        try { return json(res, 200, { finns: true, kalendrar: (await Kalender.kalendrar()).map(k => ({ ...k, forval: Konton.forvalEtikett(k) })) }); }
        catch (e) { return json(res, 200, { finns: true, kalendrar: [], fel: e.message, tillstand: Boolean(e.tillstand) }); }
      }

      /// Händelser i ett fönster.
      ///
      /// Fönstret kommer utifrån och kläms här. Utan tak kan en fråga be om
      /// tio år, och då läser MAXIMUS in tio år för att någon skrev fel i en URL.
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
          // Brev med ett förslag på svar är märkta (2026-10-10).
          for (const b of brev) b.forslag = svarsforslag.find(f => f.konto === konto && f.brevId === b.id && f.status === 'forslag')?.id || null;
          return json(res, 200, { brev });
        } catch (e) { return json(res, 200, { brev: [], fel: e.message, tillstand: Boolean(e.tillstand) }); }
      }

      /// Svarsförslagen, lägena och det som väntar på att gå (2026-10-10).
      /// Inte med utökningen (IDENTITET): förslagen har ingen ägare (granskningen 2026-10-10).
      if (IDENTITET && vag.startsWith('/api/svar')) return json(res, 404, { error: tx('srv.fel.okandVag') });
      if (vag === '/api/svar') {
        return json(res, 200, { forslag: svarsforslag.filter(f => f.status === 'forslag'),
          lage: { forslag: Svar.forslagsLage(installningar), skicka: Svar.skickaLage(installningar) },
          vantar: svarsko.vantar().map(p => ({ id: p.id, forslag: p.forslag, brevId: p.brevId, kvarMs: Math.max(0, p.skickasMs - Date.now()) })) });
      }
      const mSvar = /^\/api\/svar\/([\w-]+)$/.exec(vag);
      if (mSvar && svarsforslag.some(f => f.id === mSvar[1])) return json(res, 200, { forslag: svarsforslag.find(f => f.id === mSvar[1]) });

      /// Signaturen som läggs till: Mails egna, och vilken som är vald.
      if (vag === '/api/svar/signatur') {
        const konto = url.searchParams.get('konto') || '';
        if (!konto || !Post.finns()) return json(res, 200, { signaturer: [], vald: null });
        return json(res, 200, await svarSignatur(konto));
      }

      /// Bevakningarna: vad som följs, vad som hänt, och morgonraden.
      /// Projekten, med hur många samtal var och ett bär.
      if (vag === '/api/projekt') {
        // Bara projekt jag har samtal i.
        //
        // Listan var global: sessionerna filtrerades på ägare men
        // projektNAMNEN gjorde det inte, så ett projekt syntes med sitt namn
        // för den som inte hade något samtal i det. Ett projektnamn är ofta ärendet självt — "Omplacering
        // Norrby" säger tillräckligt.
        //
        // Ett tomt projekt syns bara för den som just skapat det, och det är
        // rätt: ett projekt utan samtal är ingens.
        const mina = [...sessioner.values()].filter(x => (x.agare || null) === (jag?.id || null));
        const har = new Set(mina.map(x => x.projekt).filter(Boolean));
        return json(res, 200, { projekt: projekt
          .filter(p => !IDENTITET || har.has(p.id) || p.agare === (jag?.id || null))
          .map(p => ({ ...p, antal: mina.filter(x => x.projekt === p.id).length })) });
      }

      // Uppdragen, i sammandrag. Hela instruktionen och vattenmärket ligger
      // kvar i filen — listan ska gå att rita utan att läsa allt.
      // Hem som instrumentbräda (Fas 50): nyheterna, tyngst först, och
      // agentens senaste drag.
      if (vag === '/api/hem') {
        const a = agentInst();
        const nu = uppdrag.find(x => x.nyheter);
        return json(res, 200, {
          nyheter: { pa: Boolean(a.nyheter), amnen: Nyheter.amnenUr(Profil.las(installningar.profil) || {}),
            poster: nu ? Nyheter.urval(fynd, nu.id) : [], senast: nu?.senast || null, session: nu?.grund || null, uppdrag: nu?.id || null },
          drag: Nyheter.drag({ spar: agentspar, fynd, uppdrag }),
        });
      }
      // OG-bilden till en nyhet: ur flödet, annars ur sidan. Hämtas en gång
      // och sparas krypterad; varje hämtning står i liggaren.
      const mNyhetsbild = /^\/api\/nyheter\/bild\/([\w-]+)$/.exec(vag);
      if (mNyhetsbild) {
        const f = fynd.find(x => x.id === mNyhetsbild[1] && uppdrag.find(u => u.id === x.uppdrag)?.nyheter);
        if (!f?.url) return json(res, 404, { error: tx('srv.fel.ingenBild') });
        const fil = join(dataDir, 'bilder', `${f.id}.json`);
        let data = null;
        try { data = JSON.parse(await maximus.lasFil(fil)).data; } catch { /* inte hämtad än */ }
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
      // Molnmodellen (Fas 51): läget, vilka nycklar som finns (aldrig nyckeln).
      if (vag === '/api/moln') {
        const har = {};
        for (const l of Object.keys(Moln.LEVERANTORER)) har[l] = Boolean(await Moln.lasNyckel(l));
        return json(res, 200, { lage: Moln.lageUr(installningar.moln), pa: molnPa(), namn: molnNamn(), harNyckel: har,
          maskeringar: Moln.MASKERINGAR,
          leverantorer: Object.fromEntries(Object.entries(Moln.LEVERANTORER).map(([k, v]) => [k, { namn: v.namn, land: v.land, om: v.om, modeller: v.modeller, loggaIn: Boolean(v.loggaIn), experimentell: Boolean(v.experimentell) }])) });
      }
      // Modellerna hos en leverantör. OpenRouters lista är öppen och läses
      // live (en timme i taget); de andra står i lib/moln.mjs.
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
      // Dina mallar (Fas 23): namn och när de lades in. Innehållet stannar.
      if (vag === '/api/mallar') return json(res, 200, { presentation: await kundmallInfo('presentation', jag?.id), dokument: await kundmallInfo('dokument', jag?.id) });
      if (vag === '/api/uppdrag') return json(res, 200, {
        // `korsNu`: sidopanelen pulserar på det uppdrag agenten är i.
        uppdrag: uppdrag.map(u => ({ ...Uppdrag.sammandrag(u), korsNu: slarNu && (!slarBara || slarBara === u.id),
          // Grundens session uppdraget rapporterar i (Fas 52): pluppen där.
          grund: u.grund || null,
          instruktion: String(u.instruktion || '').slice(0, 400),
          // Listan under Uppdrag (Fas 40): hur mycket det hittat, och hur mycket av det som är oläst.
          antalFynd: fynd.filter(f => f.uppdrag === u.id).length,
          nya: fynd.filter(f => f.uppdrag === u.id && !f.sett).length })),
        // Agentens grind (2026-10-10): listan ritar "Agenten är av" ur den.
        behov: agentBehov(),
        // Pluppen på Uppdrag: hur många som har något osett.
        osedda: uppdrag.filter(u => !u.sett).length,
      });

      // ── Agentens hem ──────────────────────────────────────────────────
      //
      // Resultat, inte resonemang. Det agenten TÄNKTE är utvecklararbete och
      // hör hemma hopfällt, för den dag något gått fel — det är inte vad man
      // öppnar appen för.
      //
      // Ordningen ligger still: nyast först, i den ordning de kom in.
      // Rangordningen skedde vid intag (vikten står på raden), inte här. En
      // lista som kastar om sig medan man läser är inte en lista, det är en
      // karusell.
      if (vag === '/api/agent') return json(res, 200, {
        // Vad som faktiskt gäller, ur launchd-filerna — inte bara ur valet.
        korLage: await Bakgrund.lage({ data: dataDir }), korDold: Boolean(installningar.agentDold),
        korFinns: Bakgrund.finns(),
        // Filtret på sfär (2026-10-10): ?etikett=jobb ger bara jobbets fynd.
        fynd: (url.searchParams.get('etikett') ? fynd.filter(f => f.sfar === Konton.etikettUr(url.searchParams.get('etikett'))) : fynd).slice(0, 200),
        osedda: fynd.filter(f => !f.sett).length,
        undanlagda: undanlagt.length,
        uppdrag: uppdrag.map(Uppdrag.sammandrag),
        notiser: agentnotiser(),
        vecka: await veckanNu().catch(() => []),
        // Vad som kör, för pluppen uppe till höger. `vantar` betyder att
        // agenten står tillbaka för samtalet just nu.
        lage: { slar: slarNu, vantar: korningar.size > 0, kallor: agentInst(), behov: agentBehov(), etiketter: Konton.etiketter(agentInst()) },
      });

      // Det undanlagda. Ett klick bort, med skäl — "kassera skit" betyder
      // aldrig dölja, och frånvaro ur översikten får inte betyda frånvaro ur
      // inkorgen.
      if (vag === '/api/agent/undanlagt') return json(res, 200, { undanlagt: undanlagt.slice(0, 300) });

      // Agentens spår. Hopfällt i rummet, i liten text, för den dag något
      // gått fel — det är inte vad man öppnar appen för.
      // ── Vad datorn bär ────────────────────────────────────────────────
      //
      // "Datorn kör en motor i taget" var en konstant skriven som en regel.
      // Det beror på maskinen, och schemaläggaren vet redan svaret. Frågan ställs här
      // så att ytan slipper gissa — och så att svaret går att visa.
      if (vag === '/api/kapacitet') return json(res, 200, await kapacitetsvar());

      // Profilen. Egen rutt för att den inte är en inställning bland andra:
      // den styr vad agenten tycker är viktigt.
      // Exemplen som gäller: dina om de skrivits om, annars de inbyggda.
      // Aldrig tomt — en tom ruta är värre än en ruta som talar till fel
      // person.
      if (vag === '/api/exempel') return json(res, 200, {
        ...Sprak.galler(installningar.exempel),
        egna: Boolean(installningar.exempel?.uppdrag?.length === 3),
      });

      if (vag === '/api/profil') return json(res, 200, {
        profil: installningar.profil || Profil.TOM,
        har: Profil.harNagot(installningar.profil),
      });

      // Banken (/du, 2026-10-10): allt Maximus vet om dig, rad för rad med
      // källa. Raderna och tabellen skrivs av regler (lib/banken.mjs).
      if (vag === '/api/du/banken') {
        const { lage, rader } = await bankLage(jag);
        return json(res, 200, { uppgifter: rader, text: Banken.sammanfattning(rader, { vill: lage.profil.vill }), profil: lage.profil });
      }

      // Kollegan (2026-10-10): inställningen, förslagen som väntar och en
      // knack som väntar på svar.
      if (vag === '/api/kollega') {
        // En användare, en dator: med utökningen (flera konton) finns kollegan inte.
        if (IDENTITET) return json(res, 404, { error: tx('srv.fel.okandVag') });
        const m = await kollegaMinne();
        const k = m.knack.oppen;
        return json(res, 200, { lage: Kollega.lage(installningar), forslag: m.forslag.filter(f => f.status === 'forslag').map(Kollega.visas),
          knack: k ? { id: k.id, fraga: k.fraga, halsning: Kollega.halsning(k) } : null });
      }

      // Det agenten vill göra men inte får utan att fråga.
      if (vag === '/api/agent/fragor') return json(res, 200, { fragor: agentbegaran.filter(b => !b.svar) });

      if (vag === '/api/agent/spar') return json(res, 200, {
        // Avtrycket är bara till för att känna igen ett upprepat varv. Det
        // är dubbelt så stort som raden det identifierar och säger inget.
        spar: agentspar.slice(0, 40).map(({ avtryck, ...x }) => x),
      });

      // Mapparna i Anteckningar, att välja ur. Listan hämtas när man ska
      // välja — inte för att någon öppnat en flik.
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
          // Paragrafen läsbar, räknad en gång och på ett ställe. Regeln bor i
          // lib/bevakning.mjs; en kopia i webbläsaren är en kopia som glider.
          lagrumsnamn: b.lagrum ? Bevakning.lasbart(b.lagrum) : null,
          av: Boolean(b.av), fel: b.fel || null,
          senast: b.senast?.tid || null, hanvisningar: b.senast?.antal ?? null,
          rör: b.rör || [], traffar: b.traffar || [],
        })),
        frister: frister.map(f => ({ ...f, bradska: Frister.brådska(f.forfaller) })),
        morgonrad: morgonraden(),
        kollarNu,
      });

      /// Vägen ut: vad som är valt, och om Tor ens finns på datorn.
      /// Ser modellen bilder, och finns det en bilddel att hämta?
      if (vag === '/api/modell/syn') {
        // Modellen kan ligga var som helst — MAXIMUS_MODELL pekar ut en fil,
        // och den som redan har modeller i ~/models kör dem därifrån. Då
        // säger id:t ingenting men filnamnet gör det.
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

      /// Kopplingarna: vad som finns, vad som är igång, vad som inte går.
      if (vag === '/api/kopplingar') return json(res, 200, {
        inbyggda: Plugins.INBYGGDA.map(k => ({ id: k.id, namn: k.namn, om: k.om, vard: k.vard, licens: k.licens,
          verktyg: k.verktyg.map(v => ({ name: v.name, description: v.description, argument: v.argument })) })),
        katalog: Plugins.MCP_KATALOG,
        igang: Plugins.lagen(),
        inteAn: Plugins.INTE_AN,
        valda: installningar.kopplingar || [],
      });

      /// Hur färska maskeringens regler är.
      ///
      /// Den som ska lita på en maskering ska se hur gammal den är. 340 dagar
      /// ser ut som 340 dagar.
      if (vag === '/api/regler')
        return json(res, 200, Regelpaket.lage(paket));

      /// Intyget som text, för den som vill läsa det innan det exporteras.
      if (vag === '/api/intyg')
        return json(res, 200, intyget
          ? { ...intyget, text: Attest.tillText(intyget, { organisation: installningar.namn || null }) }
          : { finns: false });

      /// Intyget som PDF. Det som läggs på bordet framför någon.
      ///
      /// Okrypterad med avsikt, som liggarens export: ett bevis som bara går
      /// att läsa genom vår programvara är inget bevis. Det bär inget innehåll
      /// — se lib/attest.mjs.
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

      /// Modellerna: hela stegen, vilken datorn bär, och vad som är hämtat.
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
          // Källans etiketter (2026-10-10): listan går att filtrera på dem.
          etiketter: Array.isArray(s.etiketter) ? s.etiketter : [],
          las: s.las?.styrka || null, webb: s.webb || 'av', minne: s.minne || 'isolerat',
          // Stängd betyder "förseglad och koden är inte inne just nu".
          //
          // Gränssnittet fick reda på det först ur strömmens ögonblicksbild
          // — och strömmen nekas numera för en stängd session, så kodrutan
          // visades aldrig. Revisionen 2026-09-29 (M2): en säkerhetsspärr
          // som blivit bättre bröt användarens väg till sina egna data.
          //
          // Listan vet det redan. Den säger det nu.
          stangd: stangd(s),
          // Sessioner sparade före de två kontrollerna bär `lage`. De ska
          // landa på vad de betydde, inte på förvalet — se franLage().
          ...valet(s) })));

      /// Felrapportens läge: finns en mottagare, vad appen vet om sig själv,
      /// och utkast som väntar på ett nytt försök. Läses bara när rutan
      /// öppnas; inget här lämnar datorn.
      if (vag === '/api/felrapport') {
        return json(res, 200, {
          mottagare: rapportor.mottagare(),
          // Utan mottagare: e-postvägen, till den här adressen.
          mejl: rapportor.mottagare() ? null : Hemvist.RAPPORTMEJL,
          tekniskt: await Felrapport.tekniskt({ version: VERSION }),
          funktioner: Felrapport.FUNKTIONER.map(id => ({ id, namn: tx(`srv.felrapport.funktion.${id}`) })),
          tak: Felrapport.TAK,
          rapporter: await rapportor.lage(jag?.id).catch(() => []),
        });
      }

      if (vag === '/api/liggare') {
        // Liggaren bär samma innehåll som sessionerna och skyddas lika
        // (revisionen 2026-09-28). På skrivbordet får du allt.
        if (nekas(res, 'liggaren')) return;
        const rader = await Liggare.las(maximus, dataDir, { dagar: 30, oppnare: liggaroppnare });
        return json(res, 200, {
          rader: rader.slice(0, 200), antal: rader.length,
          // Dagar som inte gick att läsa. En lucka som inte redovisas ser ut
          // som lugn, och liggaren ska kunna svara en granskare.
          luckor: rader.luckor?.length ? rader.luckor : undefined,
          format: Object.fromEntries(Object.entries(Liggare.FORMAT)
            .map(([id, f]) => [id, { namn: f.namn, om: f.om }])),
          gallring: installningar.gallring || 0,
          nasta: await Liggare.forhandsgranska(maximus, dataDir, { dagar: installningar.gallring || 0 }),
          // Kedjan. Utan den kunde en giltig ersättning av en dagsfil inte
          // upptäckas alls — se lib/liggarkedja.mjs för vad den gör och, lika
          // viktigt, vad den inte gör.
          kedja: await Liggarkedja.granska(maximus, dataDir,
            { gallrade: await Liggare.gallrade(maximus, dataDir) }).catch(() => null),
        });
      }

      // Exporten. Okrypterad med avsikt — det är hela poängen.
      //
      // Liggaren blir en allmän handling hos en kommun, och en allmän
      // handling som bara går att läsa genom leverantörens programvara
      // uppfyller inte kravet på att kunna presenteras upprepat.
      const mExport = /^\/api\/liggare\/export\.(csv|json|txt)$/.exec(vag);
      if (mExport) {
        // Samma innehåll som liggarvyn, alltså samma grind. Att den saknades
        // här betydde att 403 på en väg och 200 på en annan gav exakt samma
        // uppgifter.
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

      // Export av en bilaga. Tre vyer, och namnet säger vilken det är.
      /// Ärendemappen: det som backar ett beslut, i ett dokument.
      ///
      /// Liggaren bevisar att MAXIMUS höll sitt löfte. Den bevisar ingenting om
      /// saken. Den som fattat ett beslut behöver ett papper att lämna till
      /// en chef, en revisor eller en kund som frågar vad som ligger bakom.
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

      /// Bilden i en bilaga. Den som dragit in ett foto ska kunna titta på det.
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

      /// Hämtar en artefakt. Okrypterad på vägen ut — det är hela poängen
      /// med en fil man ska kunna lämna ifrån sig.
      ///
      /// GET och inte POST: en webbläsare som följer en download-länk
      /// skickar en GET, och en nedladdning som kräver något annat är en
      /// nedladdning som bara fungerar från vår egen kod.
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
        // Samma spärr som ärendemappen och bilden redan hade. Den här vägen
        // saknade den, och revisionen läste bilagans ORIGINAL ur en förseglad
        // session utan koden. Att fälten numera ligger inne i kuvertet gör
        // vägen tom i stället för läckande — men en spärr som bygger på att
        // något råkar saknas är ingen spärr.
        if (stangd(s)) return json(res, 423, { error: tx('srv.fel.forsegladAngeKoden') });
        const f = (s.filer || []).find(x => x.id === mFilUt[2]);
        if (!f) return json(res, 404, { error: tx('srv.fel.bilaganFinnsInte') });
        const vy = url.searchParams.get('vy') || 'maskerad';
        const text = vy === 'original' ? f.original : vy === 'anonym' ? f.anonym : f.maskerad;
        if (!text) return json(res, 404, { error: tx('srv.fel.vynFinnsInte') });
        const rent = f.namn.replace(/\.[^.]+$/, '').replace(/[^\p{L}\d_-]+/gu, '-').slice(0, 60);
        const sort = { maskerad: tx('srv.bilaga.vy.maskerad'), anonym: tx('srv.bilaga.vy.anonym'), original: tx('srv.bilaga.vy.original') }[vy] || vy;

        // PDF görs här på datorn, av ett par hundra rader utan beroenden. Att
        // skicka ett maskerat dokument till en tjänst för att få det som PDF
        // vore att ge bort precis det MAXIMUS nyss skyddade.
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
        // Både sessionen och dess ström. Strömmen skickar samma ögonblicks-
        // bild som GET, och en spärr som bara sitter på den ena är ingen
        // spärr — revisionen läste innehållet via /handelser.
        //
        // 423 och inte 404: sessionen FINNS, den är stängd. Att låtsas att
        // den inte finns vore att ljuga för sin egen ägare.
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

    // Nyckeln är kontrollerad längst upp. Det här huvudet finns kvar som
    // skydd mot att ett formulär någonstans råkar posta hit — det är en
    // vana, inte ett lås.
    if (req.method !== 'POST' || req.headers['x-maximus-local'] !== '1') return json(res, 403, { error: tx('srv.fel.ogiltigLokal') });

    // Diktering (Fas 42): ljudet kommer som rå kropp, 16 kHz mono PCM, i
    // bitar om en bråkdel av en sekund. Varje svar bär texten hittills.
    if (vag === '/api/diktera') {
      const bin = await dikteraHjalpare();
      if (!bin) return json(res, 501, { error: tx('srv.diktera.kraverMac26') });
      if (dikteringar.size >= 2) for (const [id, d] of dikteringar) { d.doda(); dikteringar.delete(id); }
      // Egna ord som ledtrådar: det du heter, arbetar med och har samtal,
      // projekt och uppdrag om. De lämnar aldrig datorn — hjälparen är lokal.
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
        // Kommandoordet avgörs här och bara här: "skicka" eller "avbryt" sist.
        const k = Diktera.kommando(d.text());
        return json(res, 200, { text: d.text(), gor: k.gor, utan: k.text, fel: d.tillstand.fel });
      }
      dikteringar.delete(mDikt[1]);
      if (mDikt[2] === 'avbryt') { d.doda(); return json(res, 200, { avbruten: true }); }
      const text = await d.avsluta();
      const k = Diktera.kommando(text);
      return json(res, 200, { text, gor: k.gor, utan: k.text });
    }

    // Du (Fas 47): LinkedIn-exporten, ett cv eller profilsidan i Safari blir
    // ett FÖRSLAG till profilen. Underlaget sparas lokalt (du.json); profilen
    // ändras först när du sagt ja (POST /api/installningar { profil }).
    // Din mall (Fas 23): en .potx/.pptx eller .dotx/.docx. Den prövas innan
    // den sparas — en fil som inte går att läsa som mall sägs direkt.
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
          // En sida med nästan ingen text ger ingen bild av någon (sett
          // 2026-10-05: 40 tecken från en annan app i Safari).
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

    // Mötesanteckningar (Fas 43): en del i taget, högst fem minuter, som
    // rå kropp. Delen skrivs ut medan mötet fortsätter och sparas i
    // samtalet direkt — stängs appen mitt i står det som hunnits skrivas.
    // Ljudet sparas inte; texten gör det.
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
      // Svaret väntar inte på utskriften: nästa del ska kunna komma in.
      return json(res, 202, { mote: moteId, nr });
    }

    // Filer kommer som rå kropp med namnet i ett huvud. Base64 i JSON hade
    // gjort varje fil en tredjedel större utan att ge något.
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
        // Avskriften skickas medan den blir till.
        //
        // whisper-cli skriver varje segment så fort det är klart, och vi
        // kastade bort det genom att vänta på hela utdata. Den som lämnat in
        // en timmes inspelning såg ordet "lyssnar" i tjugo minuter och hade
        // ingen aning om det pågick något — eller var i filen den var.
        //
        // Bara var fjärde rad går ut. Whisper klipper vid pauser, alltså
        // flera rader i sekunden på tät dialog, och en händelse per rad gör
        // strömmen till ett eget arbete.
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

        // ── Avskriften som löpande text ──────────────────────────────────
        //
        // Whisper klipper vid PAUSER, inte vid meningar, så en diktering blir
        // en rad per andetag: "Termerna på svenska / I gurkenspråket / Och vi
        // ska". Rätt avskrivet och omöjligt att läsa.
        //
        // Reglerna fogar ihop fragmenten till stycken; modellen sätter punkt
        // och stor bokstav. Och modellens svar GRANSKAS: skiljer sig orden
        // behålls reglernas text. Se lib/meningar.mjs — ett transkript är ett
        // vittnesmål, och ett vittnesmål som en modell putsat är inte längre
        // ett vittnesmål.
        if (arLjud && d.text) {
          sand(sess.id, { typ: 'fil-steg', namn, fas: tx('srv.fil.skriverMeningar') });
          satFilarbete(sess, tx('srv.fil.skriverMeningar'));
          try {
            const r = await lasbar(d.text, {
              svara: (p, o) => svaraLokalt(p, { ...o, plats: 'efterat', tak: 3000 }),
              // Styckena byts ut uppifrån och ner medan resten står kvar
              // som avskriften skrev dem. Annars stod det bara "skriver
              // meningar" i flera minuter på ett timslångt möte.
              pa: (text, klara, av, gjorda) =>
                sand(sess.id, { typ: 'fil-meningar', namn, text, klara, av, gjorda }),
              // Modellens text medan den skrivs, som ett utkast. Högst fyra
              // gånger i sekunden: en händelse per token gör strömmen till
              // ett eget arbete.
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
            // Går formateringen inte vägen står den råa avskriften kvar. Den
            // är hackig men sann, och det är den viktigare egenskapen.
          }
        }

        // Maskeras mot sessionens karta. En person som heter något i frågan
        // ska heta samma sak i bilagan.
        //
        // Utom när sessionen står på Original. Då lämnar ingenting datorn —
        // regeln i lib/behandling.mjs ser till det — så maskeringen vore
        // till för användarens egen skull, och den som drar in sitt eget
        // dokument i sin egen session ska slippa läsa en avskrift av det.
        //
        // Byter sessionen behandling maskeras allt igen nästa gång filen
        // läses, så den som ångrar sitt Original får tillbaka masken.
        //
        // Med den lokala modellen gäller valet inte (Auro 2026-10-10), och då
        // maskeras bilagan som förval: modellen läser originalet ändå, och
        // den maskerade vyn är den du tar med dig eller ber om i samtalet.
        const utanMask = behandlingNu(sess) === 'original';
        const f = utanMask
          ? { maskerad: d.text, karta: sess.karta || [], raknare: sess.raknare || {}, nya: [], rojning: null }
          : await forbered(d.text, { karta: sess.karta || [], raknare: sess.raknare || {},
              sorter: galler(installningar), modelltak: 20000 });
        // Det namnmodellen inte hann med på tjugo sekunder läses i
        // bakgrunden, en gång, så att frågorna om dokumentet inte väntar.
        if (utanMask) Namnmodell.iBakgrunden(d.text);
        sess.karta = f.karta;
        sess.raknare = f.raknare;
        // Bilden behålls.
        //
        // Förut lästes texten ur den med OCR och bytena kastades. Den som
        // dragit in ett foto av ett beslut fick alltså läsa en avskrift av
        // sitt eget foto, och kunde inte se om avskriften stämde. En bild
        // som inte går att titta på är ett underlag man måste tro på.
        //
        // Den ligger i Maximus som allt annat, krypterad när ett lösenord är
        // satt.
        const arBild = String(d.sort).startsWith('bild');
        const fil = { id: randomUUID(), namn: d.namn, sort: d.sort, tecken: d.tecken,
          tid: new Date().toISOString(), original: d.text, maskerad: f.maskerad, dolda: f.nya.length,
          omaskerad: utanMask || undefined,
          ...(arBild && data.length <= 12e6
            ? { bild: data.toString('base64'), bildtyp: typAv(namn) }
            : {}) };
        (sess.filer ||= []).push(fil);
        await spara(sess);
        // Bytena följer inte med i svaret — de hämtas på egen väg när kortet
        // ritas. Ett svar med en inbäddad bild är tre gånger så stort.
        const { original, bild, ...utan } = fil;
        return json(res, 201, { ...utan, harBild: Boolean(bild) });
      } catch (e) {
        return json(res, 422, { error: e.message });
      } finally { satFilarbete(sess, null); }
    }

    let rå = ''; for await (const bit of req) { rå += bit; if (rå.length > 20e6) return json(res, 413, { error: tx('srv.fel.forStorBegaran') }); }
    const kropp = JSON.parse(rå || '{}');

    // ── Grunden (Fas 49): de heliga sessionerna ──────────────────────────
    // Du, och en per app du gett lov till. Agenten skannar appen i sin
    // session, säger vad den ser och sätter upp ett uppdrag i den takt den
    // föreslog; uppdraget rapporterar sedan där. Se lib/grunden.mjs.
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
        let du = null; try { du = JSON.parse(await maximus.lasFil(join(dataDir, 'du.json'))); } catch { /* inget inläst */ }
        // En Du-rad, inte en per anrop: finns den uppdateras den (sett
        // 2026-10-06: två likadana rader efter onboarding).
        const finns = s.turer.findLast?.(t => t.du) || [...s.turer].reverse().find(t => t.du);
        const tur = finns || rad(s, '');
        tur.du = true; tur.sager = Grunden.duRad(Profil.las(installningar.profil), du); tur.tid = new Date().toISOString();
        // Följa löpande (Fas 49): LinkedIns aviseringar kommer som mejl. Med
        // ditt lov och inkorgen påslagen följer ett uppdrag dem, vägt mot
        // vem du är, och rapporterar här i Du.
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
      // Skanningen är ett obevakat agentvarv: samma grind som hjärtslaget.
      if (!agentBehov().klar) return behovSvar(res);
      const s = hitta(sort) || skapa(sort, app.namn);
      await spara(s);
      sandAlla({ typ: 'lista' });
      json(res, 202, { session: s.id });
      (async () => {
        try {
          const r = await agentSlinga({ uppgift: Grunden.skanningsUppgift({ app: sort, profil: Profil.somText(installningar.profil) }), session: s.id, steg: 4, obevakad: true });
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

    // Du ur en länk (Fas 49): en LinkedIn-profil öppnas i Safari, där du
    // redan är inloggad, och läses därifrån — Maximus loggar aldrig in
    // någonstans själv. Andra sidor hämtas som vanligt.
    // Du med egna ord (2026-10-10): det du skriver om dig. Texten sparas
    // direkt i profilen (`egen`) — den är din, och agenten går på den tills
    // den analyserats. Svarar modellen blir det samma förslag som ur ett cv,
    // som du säger ja till; svarar den inte än väntar ingenting på den:
    // `senare` säger att analysen görs när du ber om den.
    if (vag === '/api/du/text') {
      let du;
      try { du = Du.egenText(kropp.text); } catch (e) { return json(res, 422, { error: e.message }); }
      installningar = { ...installningar, profil: Banken.markera(installningar.profil, Profil.las({ ...(installningar.profil || {}), egen: du.text })) };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      if (kropp.analysera === false || !(await grindSvarar())) return json(res, 200, { kalla: 'text', sparad: true, forslag: null, senare: true });
      const forslag = await duForslag(du);
      return json(res, 200, { kalla: 'text', sparad: true, forslag, ...(forslag ? {} : { error: tx('srv.du.ingetForslag') }) });
    }

    // Banken (/du): en kort mening ovanpå tabellen, av den lokala modellen.
    // Svarar den inte står tabellen ensam — den behöver ingen modell.
    if (vag === '/api/du/banken/sammanfatta') {
      const { rader } = await bankLage(jag);
      if (!rader.some(r => r.andras) || !(await grindSvarar())) return json(res, 200, { text: null });
      const r = await svaraLokalt(Banken.sammanfattaPrompt(rader), { plats: 'efterat', tak: 300, timeout: 90000, baraLokalt: true }).catch(() => '');
      return json(res, 200, { text: String(r || '').trim().slice(0, 800) || null });
    }

    // Banken: det du skrev blir ett förslag. Ingenting ändras här — förslaget
    // visas, och ändras först i /api/du/banken/godkann.
    if (vag === '/api/du/banken/tolka') {
      const text = String(kropp.text || '').trim().slice(0, 1500);
      if (!text) return json(res, 422, { error: tx('srv.banken.tomText') });
      return json(res, 200, await bankTolka(jag, text));
    }

    // Banken: ditt ja eller nej. Ja gör samma ändringar som visades — på
    // samma läge, annars inga (409). Ta bort tar bort ur filerna; liggaren
    // får en lokal rad med antal och id:n, aldrig texten.
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
      // Och ur agentens egna lager (punkt 10).
      const { antal: lager } = await glomAgentLager(f.ops, { spara: true });
      await liggare({ frontier: tx('srv.liggare.banken'), vag: 'lokal', skickat: Banken.liggarrad(r.andringar, lager), mottaget: tx('srv.liggare.gjort'),
        tecken: 0, sekunder: 0, anvandare: jag?.id || null, session: null, aktor: tx('srv.helig.duTitel') }).catch(() => {});
      await skrivOmDuRad(lage.profil, lage.du).catch(() => {});
      const { lage: nu, rader } = await bankLage(jag);
      return json(res, 200, { andringar: r.andringar.length + Object.values(lager).reduce((a, b) => a + b, 0), profil: nu.profil, uppgifter: rader, text: Banken.sammanfattning(rader, { vill: nu.profil.vill }) });
    }

    // ── Kollegan (2026-10-10) ───────────────────────────────────────────
    // Minnet och närvaron gäller en användare vid en dator: med utökningen
    // (flera konton) finns kollegan inte.
    if (IDENTITET && vag.startsWith('/api/kollega/')) return json(res, 404, { error: tx('srv.fel.okandVag') });
    // Förslagen nu, inte om tre timmar. Ingenting skickas.
    if (vag === '/api/kollega/foresla') return json(res, 200, await kollegaForeslar({ tvinga: true }));

    // Ditt svar på ett förslag: ta (med din ändrade text) eller avböj med
    // ett skäl. Båda sparas och styr nästa varv; "fråga inte om X" stoppar
    // allt som nämner X. Ta skickar ingenting (se taKollegaForslag).
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

    // Fönstret säger om det står i vila. Utan livstecken i tre minuter
    // räknas det som i vila (lib/kollega.mjs).
    if (vag === '/api/kollega/narvaro') {
      narvaro = { vila: kropp.vila !== false, nar: Date.now() };
      return json(res, 200, { ok: true });
    }

    // Knacken: visad (räknas mot "högst var N:e dag" först nu), inte nu,
    // fråga aldrig om det här, klar, eller stäng av knack-knack helt.
    if (vag === '/api/kollega/knack') {
      const id = String(kropp.id || ''), svar = String(kropp.svar || '');
      // Klockan går bara att flytta i proven ("inte två gånger samma dag").
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

    // Ditt svar på frågan blir ett förslag på ändringar i /du — samma
    // tolkning och samma godkännande (/api/du/banken/godkann). Inget sparas
    // här. Sedan nästa fråga, högst tre i en knack.
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

    // Bara proven: ett påhittat dygn (fynd, möten), vilan, och ett varv
    // eller en knack med en klocka provet styr.
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

    // ── Djupdykning (Fas 46) ─────────────────────────────────────────────
    // Ett jobb i faser, i bakgrunden: källor → personer → läget → akter →
    // urval → brief → faktakoll. Läget sparas efter varje fas och varje
    // akt, så att ett avbrutet jobb fortsätter där det var (`fortsatt`).
    // Se lib/djupdykning.mjs.
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
          // 1. Källorna.
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
          // 2. Personerna — bara de som står i sidtexten.
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
            // Tak: varje akt är minuter på den lokala modellen. Tolv räcker till
            // en A- och B-lista; fler går att be om (`tak`).
            const tak = Math.min(30, Number(kropp.tak) || 12);
            d.hittade = alla.length;
            d.personer = alla.length > tak
              ? Djupdykning.lasGallring(await svaraLokalt(Djupdykning.gallraPrompt({ mandat: d.mandat, personer: alla, tak }), { plats: 'efterat', tak: 800, timeout: 240000 }).catch(() => ''), alla, tak)
              : alla;
            await spara(sess);
          }
          // Ingen person: ingen brief om ingen. Säg det, och vad som hjälper.
          if (!d.personer.length) {
            delete d.personer; delete d.sidtext;
            throw new Error(d.adresser?.length ? tx('srv.djup.ingaPersoner') : tx('srv.djup.geAdress'));
          }
          const publika = d.personer.map(p => p.namn);
          // 3. Läget.
          if (!d.laget) {
            steg('laget');
            const r = await agentSlinga({ uppgift: Djupdykning.lagetUppgift(d), sammanhang: underlag(), session: sess.id, publika, steg: 5 });
            d.kallor = Leverans.kallorUr(r.steg);
            // Bara fakta vars adress slingan faktiskt såg.
            d.lagetRa = String(r.svar || '').slice(0, 6000);
            d.laget = Djupdykning.verifieraFakta(Djupdykning.lasFakta(r.svar, d.kallor), d.kallor);
            await spara(sess);
          }
          // 4. En akt per person, sparad efter varje.
          for (const [nr, p] of d.personer.entries()) {
            if (d.akter.some(a => a.namn === p.namn)) continue;
            steg('akter', { nr, av: d.personer.length, person: p.namn });
            const r = await agentSlinga({ uppgift: Djupdykning.aktUppgift({ person: p, mandat: d.mandat, amne: d.amne }), sammanhang: '', session: sess.id, publika: [p.namn], steg: 4 })
              .catch(e => ({ svar: '', steg: [], fel: e.message }));
            // Råtexten sparas: en bättre tolkning kan läsa om akten utan att söka om.
            d.akter.push({ ...Djupdykning.lasAkt(r.svar, p), kallor: Leverans.kallorUr(r.steg), ra: String(r.svar || '').slice(0, 6000) });
            d.kallor = [...(d.kallor || []), ...Leverans.kallorUr(r.steg)];
            await spara(sess);
          }
          // 5. Urvalet.
          steg('urval');
          // Akterna läses om ur sin råtext med den tolkning som gäller nu.
          d.akter = d.akter.map(a => (a.ra ? { ...Djupdykning.verifiera(Djupdykning.lasAkt(a.ra, a), a.kallor), kallor: a.kallor, ra: a.ra } : a));
          if (d.lagetRa) d.laget = Djupdykning.verifieraFakta(Djupdykning.lasFakta(d.lagetRa, d.kallor), d.kallor);
          const akter = d.akter.filter(a => !a.tom);
          d.urval = Djupdykning.lasUrval(await svaraLokalt(Djupdykning.urvalPrompt({ mandat: d.mandat, akter }), { plats: 'efterat', tak: 2000, timeout: 240000 }).catch(() => ''), akter);
          // 6. Briefens avsnitt.
          steg('brief');
          d.avsnitt = {};
          for (const [id, vad] of Djupdykning.AVSNITT) {
            d.avsnitt[id] = String(await svaraLokalt(Djupdykning.avsnittPrompt({ vad, mandat: d.mandat, amne: d.amne, laget: d.laget, urval: d.urval, akter }),
              { plats: 'efterat', tak: 1800, timeout: 240000 }).catch(() => '')).trim();
          }
          // 7. Faktakollen.
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
          // Läget sparas som fel, med orsaken: annars såg ett fallet jobb ut
          // att stå kvar i sin fas för alltid. `fortsatt` tar vid där det föll.
          d.fas = 'fel'; d.fel = e.message;
          sand(sess.id, { typ: 'djup', fas: 'fel', fel: e.message });
          await spara(sess).catch(() => {});
        } finally { djupjobb.delete(sess.id); sandAlla({ typ: 'lista', agare: sess.agare }); }
      })();
      return;
    }

    // ── Dokument och presentationer (Fas 23) ─────────────────────────────
    // Ett arbete i steg, i ett samtal: disposition → ändra → skriv (i
    // bakgrunden, avsnitt för avsnitt med agentslingan och vägvalet) →
    // granska → bygg. Se lib/leverans.mjs.
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
        // Två försök: modellen svarar ibland med text runt JSON, eller
        // klipper den. Andra gången med bara formen kvar att följa.
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
                sammanhang: underlag(), session: sess.id,
                onSteg: st => sand(sess.id, { typ: 'leverans', fas: 'skriver', nr, av: plan.length, rubrik: a.rubrik, steg: st.verktyg }) });
              // Blev svaret en begäran i stället för ett avsnitt skrivs det om, utan verktyg.
              if (Leverans.arBegaran(r.svar)) {
                const uppg = Leverans.avsnittUppgift({ ...lev, titel, avsnitt: a, nr, alla: plan });
                r.svar = await svaraLokalt(Leverans.skrivUtanVerktyg(uppg, underlag()), { plats: 'efterat', tak: 900, timeout: 180000 }).catch(() => r.svar);
                r.slut = 'utan verktyg';
              }
              klara.push({ rubrik: a.rubrik, ...Leverans.lasAvsnitt(r.svar, lev.sort), kallor: Leverans.kallorUr(r.steg),
                // Råtexten och stegen står kvar, så att det går att se vad varje avsnitt byggde på.
                ra: String(r.svar || '').slice(0, 6000), steg: (r.steg || []).map(x => ({ verktyg: x.verktyg, fel: Boolean(x.fel) })), slut: r.slut });
            }
            sand(sess.id, { typ: 'leverans', fas: 'granskar', av: plan.length });
            const anm = Leverans.lasGranskning(await svaraLokalt(Leverans.granskaPrompt({ titel, avsnitt: klara }), { plats: 'efterat', tak: 600, timeout: 180000 }).catch(() => ''));
            sand(sess.id, { typ: 'leverans', fas: 'bygger', av: plan.length });
            const kallor = [...new Map(klara.flatMap(a => a.kallor).map(k => [k.namn, k])).values()];
            const under = `${lev.mottagare ? tx('srv.leverans.till', { mottagare: lev.mottagare }) : ''}${new Date().toLocaleDateString(lokalNu(), { day: 'numeric', month: 'long', year: 'numeric' })}`;
            // Din egen mall, om du lagt in en (Inställningar → Du → Mallar).
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

    // ── Maximus: huvudlösenordet ─────────────────────────────────────────
    //
    // Utan det ligger sessioner, liggare och inställningar i klartext i
    // hemkatalogen. Det räcker med en kopierad mapp, en backup eller en
    // lånad dator — och MAXIMUS:s hela löfte är att uppgifterna stannar hos
    // den som äger dem.
    //
    // Lösenordet lagras inte. Kvar blir ett salt och ett kontrollvärde, så
    // att en felskrivning kan avvisas utan att någon fil öppnas.
    // Appen stängs. Allt klappas ihop.
    //
    // Svaret går FÖRE nedstängningen, annars dör processen med en halv
    // skickad rad och appen får ett avbrott i stället för ett kvitto.
    if (vag === '/api/stang') {
      json(res, 200, { stanger: true });
      // En tick, så att svaret hinner ut genom sockeln.
      setTimeout(() => stangNer('appen bad om det'), 50);
      return;
    }

    if (vag === '/api/maximus') {
      try {
        if (kropp.vad === 'satt') {
          if (nekas(res, 'losenordet')) return;
          if (maximus.skyddat) return json(res, 409, { error: tx('srv.fel.harRedanLosenord') });
          await maximus.satLosenord(String(kropp.losenord || ''), { kommIhag: kropp.kommIhag !== false });
          // Det som redan skrivits krypteras om. Den som slår på skyddet ska
          // inte behöva börja om för att det gamla ligger kvar oskyddat.
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
          // Dödar varje utlämnad kaka. Fönstret hämtar en ny nästa gång
          // appen öppnas — nyckeln i filen rörs inte, för Tauri läser den
          // vid start och skulle annars tappa kontakten.
          //
          // Det här är återkallandet revisionen saknade: har en kaka hamnat
          // i en skärmdump eller en delad logg går den att döda utan att
          // något annat rivs.
          // Här tas ALLA, också den egna. Den som trycker "Återkalla" ber om
          // att varje utlämnad kaka ska dö — sidan laddar om och hämtar en
          // ny genom appens egen adress.
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

    // Locket: koden som stänger Maximus när datorn lämnas.
    //
    // Ligger före låsspärren nedan, och måste göra det — en väg som bara
    // fungerar när Maximus redan är öppet vore ingen väg in.
    //
    // Se lib/locket.mjs för varför koden packar in nyckeln i stället för att
    // härleda den, och varför försöken räknas.
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
          // Nyckelringen glöms i samma andetag.
          //
          // Annars är locket teater: nyckeln ligger kvar i login-nyckelringen
          // och en process som kör som samma användare hämtar den utan att
          // någon prompt visas (se kommentaren i lib/maximus.mjs). Kodkuvertet
          // ersätter nyckelringen som bekvämlighet — det kräver åtminstone
          // något användaren vet, och det räknar försöken.
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
          // Att ta bort locket kräver ett öppet maximus. Den som inte kan öppna
          // det ska inte kunna ta bort det som håller det stängt.
          if (!maximus.upplast) return json(res, 423, { error: tx('srv.fel.lasUppForst') });
          await Locket.tabort(dataDir);
          return json(res, 200, { locket: { pa: false } });
        }

        if (kropp.vad === 'efter') {
          // Bara tiden, utan att koden sätts om. Den som byter från femton
          // minuter till en timme ska inte behöva välja ny kod.
          if (!maximus.upplast) return json(res, 423, { error: tx('srv.fel.lasUppForst') });
          const d = await Locket.las(dataDir);
          if (!d) return json(res, 422, { error: tx('srv.locket.ingetLock') });
          d.efter = Number.isFinite(Number(kropp.efter)) ? Number(kropp.efter) : null;
          await writeFile(join(dataDir, 'locket.json'), JSON.stringify(d, null, 1), { mode: 0o600 });
          return json(res, 200, { locket: Locket.lage(d) });
        }

        return json(res, 422, { error: tx('srv.fel.okantVal') });
      } catch (e) {
        // Försöksräkningen följer med felet, så gränssnittet kan säga hur
        // många som återstår utan att fråga en gång till.
        return json(res, 422, { error: e.message, forsokKvar: e.forsokKvar ?? null });
      }
    }

    if (maximus.skyddat && !maximus.upplast) return json(res, 423, { error: tx('srv.fel.maximusLast') });

    // Policyn städas av den lokala modellen innan den sparas. Folk skriver
    // en vägg av text, och en modell läser en lista bättre än en vägg.
    if (vag === '/api/policy') {
      const ra = String(kropp.text || '').slice(0, POLICYTAK);
      const stadad = kropp.stada === false ? ra : await stadaPolicy(ra);
      installningar = { ...installningar, policy: stadad };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      return json(res, 200, { policy: stadad });
    }

    // Generalisering: gör texten mindre exakt utan att göra den obesvarbar.
    //
    // Modellen får inte betygsätta sig själv. Blev omskrivningen inte
    // mindre exakt — färre siffror, inga tappade platshållare — förkastas
    // den, och användaren får se varför.
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

    // Anonymiserad tolkning. Körs på den MASKERADE texten, aldrig originalet.
    // Start och stopp för den lokala modellen.
    //
    // Den enda vägen dit gick genom terminalen, och den som stänger appen och
    // öppnar den igen ska inte behöva ett skal för att få tillbaka grinden.
    // Stänger användaren av den ska vakten låta den vara avstängd — annars
    // hade den startat igen inom en minut, och knappen vore en lögn.
    if (vag === '/api/modell') {
      try {
        if (kropp.vad === 'paus') {
          // Inte medan något arbetar i bakgrunden (2026-10-05): vilan slog
          // till efter fem orörda minuter mitt i en djupdykning, pausade
          // modellen, och jobbet stod stilla i tjugo minuter utan att någon
          // visste varför. Vilan döljer skärmen ändå; modellen får göra klart.
          const arbetar = [djupjobb.size && tx('srv.modell.arbetar.djup'), leveranser.size && tx('srv.modell.arbetar.dokument'), korningar.size && tx('srv.modell.arbetar.svar'),
            slarNu && tx('srv.modell.arbetar.agent'), undersoker && tx('srv.modell.arbetar.undersokning')].filter(Boolean);
          if (arbetar.length) return json(res, 409, { error: tx('srv.modell.arbetarPausasInte', { lista: ochLista(arbetar) }), arbetar: true });
          // Vakten skulle annars se en modell som inte svarar och starta en
          // till — sju gigabyte bredvid de sju som ligger frysta.
          modellAvstangd = true;
          try { await pausaModell(); } catch (e) { modellAvstangd = false; throw e; }
          modellPausad = true;
          sandAlla({ typ: 'modell', uppe: false, pausad: true });
          return json(res, 200, { uppe: false, pausad: true });
        }
        if (kropp.vad === 'fortsatt') {
          // En pausad modell kan vara borta när den ska väckas. 2026-10-05
          // låg den pausad över natten, och schemaläggaren tog den efter sina åtta
          // timmar: vilan visade "Väcker modellen … 25 s" medan SIGCONT gick
          // till en process som inte fanns. Vakten startar inte om en pausad
          // modell — det är meningen — så ingen gjorde det.
          //
          // Svarar den inte inom fem sekunder efter fortsätt startas en ny,
          // genom samma väg som knappen Starta.
          pausaEfterVarvet = false;
          if (await vackPausad()) {
            sandAlla({ typ: 'modell', uppe: true, pausad: false });
            return json(res, 200, { uppe: true, pausad: false });
          }
          console.log('  Den pausade modellen svarar inte. Startar en ny…');
          sandAlla({ typ: 'modell', uppe: false, pausad: false, startar: true });
        }
        if (kropp.vad === 'stopp') {
          // Flaggan först, stoppet sedan. Tvärtom hann vakten ticka medan
          // stoppet väntade på att porten skulle tystna, och startade en ny
          // modell sju sekunder efter att användaren stängt av den.
          modellAvstangd = true;
          // En pausad process tar inte emot SIGTERM förrän den får gå vidare.
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
        // Väck i bakgrunden (Fas 49): onboarding väcker modellen när den
        // börjar, och ett anrop som hänger tills modellen är uppe höll
        // fönstrets nät upptaget i minuter. Läget syns i /api/uppstart.
        if (kropp.bakgrund === true) {
          sakerstallModell({ onSteg: h => console.log(`  ${h.text}…`) })
            .then(r => { varmPlatser({ url: r.url, prompter: VARMA }).catch(() => {}); sandAlla({ typ: 'modell', uppe: true, url: r.url, egen: !r.redan }); })
            .catch(() => {});
          return json(res, 202, { startar: true });
        }
        const r = await sakerstallModell({ onSteg: h => console.log(`  ${h.text}…`) });
        // Platserna värms medan användaren ändå ser "startar". Först efter
        // det är modellen snabb på allt, inte bara på det man råkar fråga
        // först.
        await varmPlatser({ url: r.url, prompter: VARMA }).catch(() => {});
        sandAlla({ typ: 'modell', uppe: true, url: r.url, egen: !r.redan });
        return json(res, 200, { uppe: true, url: r.url, redan: r.redan, ...await vilkenModell() });
      } catch (e) { return json(res, 502, { error: e.message }); }
    }

    /// Hämta en modell. Framstegen går ut på översiktsströmmen, för den som
    /// hämtar sex gigabyte ska kunna byta flik utan att tappa räkningen.
    ///
    /// Svaret kommer när hämtningen är klar. En knapp som säger "hämtar" och
    /// en rad som säger hur långt det gått är två olika saker, och båda behövs.
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
        // Den nyss hämtade blir den som används. Att hämta en modell och
        // sedan behöva välja den också vore ett steg för mycket.
        satModellfil(r.vag);
        installningar = { ...installningar, modell: id };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        return json(res, 200, { ...r, id });
      } catch (e) {
        sandAlla({ typ: 'hamtning', id, fel: e.message });
        return json(res, 502, { error: e.message });
      } finally { hamtarNu = null; }
    }

    /// Byt modell. Den måste finnas hämtad — MAXIMUS hämtar inte i smyg.
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

    /// Dela en session: en fil som går att skicka, låst med en kod.
    ///
    /// Koden föreslås av MAXIMUS om ingen anges. Filen lämnar datorn och kan
    /// gissas på hur länge som helst, så koden är hela skyddet — och en kod
    /// som duger som grind i gränssnittet duger inte här.
    const mDela = /^\/api\/sessioner\/([\w-]+)\/dela$/.exec(vag);
    if (mDela) {
      const s = minSession(mDela[1], jag, { forseglad: true });
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      if (stangd(s)) return json(res, 423, { error: tx('srv.fel.forsegladOppnaForst') });
      try {
        // Hela sessionen, inte den i minnet: en förseglad session i listan har
        // ingen kropp förrän den öppnats.
        const hel = await maximus.lasSession(join(sessionsKatalog(s.agare), `${s.id}.json`),
          koder.get(s.id) || null);
        const kod = String(kropp.kod || '').trim() || Dela.foreslaKod();
        const gransk = Dela.granskaKod(kod);
        if (!gransk.ok) return json(res, 422, { error: gransk.varfor });
        const fil = await Dela.paketera({ ...hel, id: s.id }, kod,
          { fran: String(kropp.fran || installningar.namn || '').trim() || null });
        const namn = `maximus-${new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')}${Dela.ANDELSE}`;
        // Filen på disk, för macOS delningsmeny (Mail, Meddelanden, AirDrop…).
        //
        // Menyn delar en FIL, inte bytes i ett anrop — därför läggs kuvertet
        // i en egen mapp och sökvägen går tillbaka. Kuvertet är krypterat med
        // koden, och koden ligger inte här: den visas en gång i appen och
        // ska gå en annan väg än filen. Mappen töms på det som är äldre än
        // ett dygn (stadaDelningar).
        const vag = join(delningsmapp(), namn);
        await mkdir(delningsmapp(), { recursive: true, mode: 0o700 });
        await writeFile(vag, fil, { mode: 0o600 });
        return json(res, 200, {
          kod, egen: Boolean(String(kropp.kod || '').trim()), vag,
          // Filnamnet bär inte titeln.
          //
          // Titeln ligger INUTI kuvertet med flit — en rubrik är också
          // innehåll, och "Uppsägning vid sjukfrånvaro" säger nästan allt om
          // ett ärende. Men nedladdningsnamnet härleddes ur den, och ett
          // filnamn reser: det syns i mappen, i mejlets bilagelista, i
          // transportens metadata och i mottagarens säkerhetskopia.
          //
          // Hela poängen med att kryptera titeln försvann i det sista steget.
          // Datum och tid i stället — de säger vilken fil som är vilken utan
          // att säga vad den handlar om.
          namn,
          fil: fil.toString('base64'),
        });
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    /// Vad är det här för fil? Svaret får inte röja något av innehållet.
    if (vag === '/api/dela/titta') {
      try { return json(res, 200, Dela.titta(Buffer.from(String(kropp.fil || ''), 'base64'))); }
      catch (e) { return json(res, 422, { error: e.message }); }
    }

    /// Öppna en delning och lägg den i det här Maximus som en egen session.
    if (vag === '/api/dela/oppna') {
      try {
        const oppnad = await Dela.packaUpp(
          Buffer.from(String(kropp.fil || ''), 'base64'), String(kropp.kod || ''));
        const { session: inre, fran } = oppnad;

        // Delade bevakningar bär REGELN, aldrig ärendet. Den som får dem vet
        // vad avsändaren följer, men inte vad hon arbetar med — `rör` följde
        // aldrig med ut, och sätts här mot mottagarens egna sessioner.
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

        // Bara tillåtna fält, och alltid en vanlig, isolerad session
        // (2026-10-09, granskningen, MSK-6): se Dela.importerbar.
        const s = {
          ...Dela.importerbar(inre),
          id: randomUUID(),
          agare: jag?.id || null,
          projekt: null,
          delad: { fran: fran || null, nar: new Date().toISOString() },
          skapad: new Date().toISOString(),
        };
        // Bilagorna maskeras om här, med mottagarens regler och en ny karta.
        // Avsändarens maskerade text och hennes omaskerad-flagga följer inte
        // med: det som går ut härifrån maskeras av den som skickar det.
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

    /// Hämta en webbläsare, om datorn saknar en.
    ///
    /// Chromium packas inte med — 196 MB för något många redan har. MAXIMUS
    /// använder systemets Chrome eller Edge när de finns, och hämtar annars
    /// ett headless-skal här.
    if (vag === '/api/webblasare/hamta') {
      // Hämtningen står i liggaren som allt annat som går ut (granskningen
      // 2026-10-09): Playwright laddar Chromium från Microsofts CDN.
      const t0 = Date.now();
      const rad = (mottaget, fel = null) => liggare({ anvandare: jag?.id || null, session: null, aktor: tx('srv.helig.duTitel'),
        frontier: tx('srv.liggare.webblasaren'), vag: 'direkt', skickat: 'GET Chromium (Playwright) · playwright.azureedge.net',
        mottaget, ...(fel ? { fel } : {}), tecken: 0, sekunder: (Date.now() - t0) / 1000 }).catch(e => console.error('liggaren kunde inte skriva om webbläsaren:', e.message));
      try {
        const r = await hamtaWebblasare({ onSteg: h => sandAlla({ typ: 'webblasare', ...h }) });
        await rad(tx('srv.liggare.webblasarenHamtad'));
        sandAlla({ typ: 'webblasare', klar: true, ...r });
        return json(res, 200, r);
      } catch (e) {
        await rad('inget', e.message);
        sandAlla({ typ: 'webblasare', fel: e.message });
        return json(res, 502, { error: e.message });
      }
    }

    /// Tar ut ett intyg över liggaren.
    ///
    /// Görs här, på datorn, och skickas ingenstans. Motsigneringen hos
    /// licensservern försvann med den (öppen källkod, 2026-10-09); hashroten
    /// låter ändå en granskare se att liggaren och intyget hör ihop.
    ///
    /// Sammandraget bär aldrig innehåll — se lib/attest.mjs.
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

    /// Felrapporten. Utkast, granskning och formulering sker här, på datorn.
    /// Bara `/api/felrapport/skicka` når nätet, och bara med en text vars
    /// hash är den du godkände (lib/felrapport.mjs). Ingen av vägarna är ett
    /// verktyg: modellen och agenten har inget sätt att anropa dem.
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
    /// Låt den lokala modellen formulera om dina egna ord. Ingenting annat:
    /// inga orsaker, inga steg. Svaret går genom samma rensning och hamnar i
    /// förhandsvisningen, där du läser det. Kan modellen inte svara står
    /// utkastet kvar som det var.
    if (vag === '/api/felrapport/formulera') {
      try {
        const text = String(kropp.text || '').slice(0, 6000);
        if (!text.trim()) return json(res, 422, { error: tx('srv.felrapport.fel.tom') });
        // Lokalt, eller inte alls: med molnmodellen påslagen hade utkastet
        // lämnat datorn före godkännandet.
        if (molnPa()) return json(res, 409, { error: tx('srv.felrapport.fel.baraLokalt') });
        const instruktion = Sprakstod.modellprompt(tx('srv.felrapport.formulera'));
        const svar = await svaraLokalt(`${instruktion}\n\nTEXTEN:\n${text}`, { plats: 'efterat', tak: 600, timeout: 90000, baraLokalt: true });
        const ren = String(svar?.text ?? svar ?? '').trim();
        if (!ren) return json(res, 503, { error: tx('srv.felrapport.fel.modell') });
        return json(res, 200, Felrapport.rensa(ren));
      } catch (e) { return json(res, 503, { error: tx('srv.felrapport.fel.modell') }); }
    }
    /// Godkännandet fryser paketet i serverns lagring; skicka tar sedan bara
    /// hashen och skickar det som ligger där (granskningen 2026-10-10).
    if (vag === '/api/felrapport/godkann') {
      try {
        // Utan mottagare fryses paketet för e-postvägen, i minnet och bara en
        // stund: mejlet öppnas med det som godkändes här, inte med något nytt.
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
    /// E-postvägen (så länge ingen mottagare är driftsatt): ett nytt, synligt
    /// mejl i Mail med det godkända paketet. Inget skickas härifrån — du
    /// trycker Skicka i Mail. Liggaren säger att ett mejl öppnades, inte att
    /// något gick iväg.
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

    /// Hjälpen. En expert på appen i stället för dokumentation.
    ///
    /// Strömmar som ett vanligt svar, men utan grind och utan liggare:
    /// ingenting lämnar datorn, och en fråga om var citatknappen sitter
    /// innehåller inga personuppgifter.
    if (vag === '/api/hjalp') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
        Connection: 'keep-alive' });
      const skriv = h => { try { res.write(`data: ${JSON.stringify(h)}\n\n`); } catch {} };
      const kontroll = new AbortController();
      req.on('close', () => kontroll.abort());
      try {
        const fragan = String(kropp.fraga || '');
        // Historiken är hjälpens egen, och bara {fraga, svar} går in. Ett
        // annat fält i den hade blivit en väg in i prompten.
        const historik = (Array.isArray(kropp.historik) ? kropp.historik.slice(-6) : [])
          .map(t => ({ fraga: String(t?.fraga || '').slice(0, 2000), svar: String(t?.svar || '').slice(0, 6000) }));
        const svar = await Hjalp.fraga(fragan, {
          historik, lage: hjalpLage(),
          signal: kontroll.signal,
          onText: bit => skriv({ typ: 'text', bit }),
        });
        // Frågan sparas inte.
        //
        // Den sparades förr, och varje fråga blev en rad under "Dina frågor"
        // som låg kvar till nästa start och nästa efter den — en andra
        // sessionslista bredvid den riktiga. Hjälpen är ett
        // samtal om appen som tar slut när man lämnar det.
        skriv({ typ: 'klar', svar });
      } catch (e) {
        skriv({ typ: 'fel', fel: e.message });
      }
      return res.end();
    }

    /// Starta en MCP-koppling.
    ///
    /// Processen körs som användaren och ser det användaren ser. Därför står
    /// det i gränssnittet vad varje koppling får göra innan den startas — och
    /// därför kräver verktyg som skriver ett godkännande per anrop.
    if (vag === '/api/kopplingar/starta') {
      const k = Plugins.MCP_KATALOG.find(x => x.id === kropp.id);
      if (!k) return json(res, 404, { error: tx('srv.kopplingar.okand') });
      // Miljö och argument prövas mot kopplingens egen lista (granskningen
      // 2026-10-09). Förut gick hela `kropp.miljo` in i barnets miljö, och
      // NODE_OPTIONS eller DYLD_INSERT_LIBRARIES gjorde ett API-anrop till
      // kodkörning.
      let arg, miljo;
      try {
        arg = Plugins.kopplingsArgument(k, { mapp: kropp.mapp, url: kropp.url });
        miljo = Plugins.kopplingsMiljo(k, kropp.miljo);
      } catch (e) { return json(res, 422, { error: e.message }); }
      try {
        // npx hämtar paketet från npm om det inte redan ligger i cachen
        // (granskningen 2026-10-09). Raden skrivs före starten: frånvaron av
        // en rad ska betyda frånvaro av trafik, också när starten fallerar.
        // Storleken vet bara npm, och den säger det inte i förväg.
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

    /// Anropa ett verktyg.
    ///
    /// Svaret går tillbaka som text. Ingenting av det hamnar i en fråga utan
    /// att användaren sett det — det är hela skillnaden mot en modell som
    /// själv får ringa ut.
    if (vag === '/api/kopplingar/anropa') {
      try {
        const r = await Plugins.anropa(String(kropp.koppling || ''), String(kropp.verktyg || ''),
          kropp.argument && typeof kropp.argument === 'object' ? kropp.argument : {});
        // En hämtning från en koppling är utgående trafik och hör i liggaren.
        // Argumenten som de faktiskt gick ut, maskerade av grinden i
        // Plugins.anropa, inte kroppen före grinden (2026-10-09, granskningen):
        // liggaren visade namn och nummer som aldrig lämnade datorn, och
        // dolde vad som gjorde det.
        const skickade = r.skickadeArgument ?? {};
        delete r.skickadeArgument;
        await liggare({ frontier: tx('srv.liggare.koppling', { koppling: r.koppling }), vag: 'koppling',
          skickat: `${kropp.verktyg} ${JSON.stringify(skickade)}`.slice(0, 2000),
          mottaget: String(r.text).slice(0, 8000), tecken: String(r.text).length, sekunder: 0 });
        return json(res, 200, r);
      } catch (e) { return json(res, 502, { error: e.message }); }
    }

    if (vag === '/api/modeller/bort') {
      try { return json(res, 200, await taBortModell(String(kropp.id || ''))); }
      catch (e) { return json(res, 409, { error: e.message }); }
    }

    // Hämtar lyssnarmodellen. Enda gången MAXIMUS laddar ned något.
    // Vilka öron som går att välja, och vilket som ligger på disk.
    //
    // Två alternativ, inte fem. Den som ska välja ska kunna läsa båda och
    // förstå skillnaden; en lista på fem är en lista man tar det första ur.
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

    // Vilka sorter som ska maskeras. Paket eller egen blandning.
    if (vag === '/api/maskering') {
      if (kropp.paket && PAKET[kropp.paket]) installningar = { ...installningar, paket: kropp.paket, sorter: null };
      else if (Array.isArray(kropp.sorter)) installningar = { ...installningar, sorter: kropp.sorter, paket: null };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      const g = galler(installningar);
      return json(res, 200, { valda: [...g], paketNu: paketFor(g) });
    }

    // Namnmodellen på/av (Auro 2026-10-10). Av betyder
    // bara reglerna, som före den; på betyder reglerna och modellen.
    if (vag === '/api/namnmodell') {
      if (typeof kropp.pa === 'boolean') {
        installningar = { ...installningar, namnmodell: kropp.pa };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        Namnmodell.satNamnmodell({ pa: kropp.pa });
      }
      return json(res, 200, await Namnmodell.namnmodellLage());
    }
    // Hämtar namnmodellen: låst revision, storlek och sha256 per fil, en rad
    // i liggaren per hämtning. Som örat och modellen — bara på begäran.
    if (vag === '/api/namnmodell/hamta') {
      try {
        const r = await Namnmodell.hamtaNamnmodell({ liggare: hamtningsliggare(jag),
          onFramsteg: f => sandAlla({ typ: 'namnmodell', ...f }) });
        return json(res, 200, { ...(await Namnmodell.namnmodellLage()), redan: r.redan });
      } catch (e) { return json(res, 502, { error: e.message }); }
    }


    // Utökningens vägar med kropp.
    if (await utokning?.rutt?.(req, res, url, vag, jag, kropp)) return;

    // Gallring. Förhandsgranskning först, verkställighet på eget anrop.
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

    /// Parkoden till webbläsartillägget.
    ///
    /// Den här vägen kräver appens vanliga nyckel — koden visas bara inne i
    /// MAXIMUS, och flyttas därifrån för hand. Det är hela parningen: ett delat
    /// värde som passerat en människa.
    if (vag === '/api/tillagg') {
      const d = kropp.nyKod ? await Tillagg.forNya(maximus, dataDir) : await Tillagg.kod(maximus, dataDir);
      return json(res, 200, d);
    }

    /// Finns det en nyare version?
    ///
    /// Det här är ett UTGÅENDE anrop, det tredje och sista i appen. Därför
    /// samma regler som de två andra: det går att stänga av, och det bokförs.
    ///
    /// Nyttolasten är versionen och plattformen. Inget id, inget som skiljer
    /// den här datorn från en annan — en kontroll som kan räkna
    /// installationer är en kontroll som ringer hem.
    // Hämtningen av en ny version, bokförd INNAN den sker. Själva hämtningen
    // gör Tauris uppdaterare i skalet, utanför servern — utan den här raden
    // hade liggaren saknat den enda gång en hel app kom in över nätet.
    if (vag === '/api/uppdatering/hamtar') {
      const v = String(kropp.version || '').slice(0, 40);
      await liggare({ session: null, frontier: tx('srv.liggare.uppdateringskanalen'), vag: 'direkt',
        tecken: 0, sekunder: 0, fel: null,
        skickat: tx('srv.liggare.uppdateringSkickat', { v, plattform: Uppdatering.plattform() }),
        mottaget: tx('srv.liggare.uppdateringMottaget') }).catch(() => {});
      return json(res, 200, { ok: true });
    }

    // Öppnar Program-mappen i Finder, så att appen kan flyttas dit
    // (2026-10-10, se appPlats).
    if (vag === '/api/oppna-program') {
      execFileCb('/usr/bin/open', ['/Applications'], () => {});
      return json(res, 200, { ok: true });
    }
    if (vag === '/api/uppdatering') {
      // Opt-in (2026-10-04). Kontrollen gick förut av sig själv tills någon
      // stängde av den. Nu frågar Maximus en gång, och utan ett ja går
      // ingenting ut — villkoren 4.2 säger "om du valt det".
      const pa = installningar.uppdateringar === true;
      if (kropp.satt !== undefined) {
        installningar = { ...installningar, uppdateringar: kropp.satt === true };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        return json(res, 200, { pa: installningar.uppdateringar, version: VERSION });
      }
      if (!pa || !UPPDATERINGSADRESS) return json(res, 200, { pa: false, version: VERSION,
        // `fragat`: har användaren tagit ställning? Annars frågar appen.
        fragat: typeof installningar.uppdateringar === 'boolean' });

      const r = await Uppdatering.kolla(UPPDATERINGSADRESS, { version: VERSION });
      // Liggaren först, resultatet sedan. Frånvaron av en rad ska betyda
      // frånvaro av trafik — också när kontrollen misslyckades.
      await liggare({ session: null, frontier: tx('srv.liggare.uppdateringskanalen'), vag: 'direkt',
        tecken: (r.skickat || '').length, sekunder: Math.round((r.ms || 0) / 100) / 10,
        fel: r.fel || null, skickat: r.skickat || null,
        mottaget: r.fel ? null : tx('srv.liggare.uppdateringVersion', { v: r.senaste || '—', nyare: r.nyare ? tx('srv.liggare.nyare') : '' }) })
        .catch(() => {});
      return json(res, 200, { ...r, pa: true, version: VERSION });
    }

    /// Gallring av sessionerna. Inte samma sak som liggarens.
    ///
    /// Liggaren är en bokföring. Sessionerna är ARBETET — frågorna, svaren,
    /// dokumenten. Att radera dem är att radera det användaren gjort, och det
    /// går inte att ångra. Därför skriver den här vägen ett protokoll, och
    /// därför kräver den `verkstall` uttryckligen.
    if (vag === '/api/sessionsgallring') {
      if (nekas(res, 'gallring', {}, jag)) return;
      const dagar = Math.max(0, Number(kropp.dagar) || 0);
      if (kropp.spara) {
        installningar = { ...installningar, sessionsgallring: dagar };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      }
      // Bara mina egna: att gallra någon annans sessioner från en
      // inställningsruta vore en knapp som raderar arbete utan att ägaren
      // vet om det. Grunden (Fas 49) gallras aldrig.
      const mina = [...sessioner.values()].filter(s => egen(s, jag) && !s.helig);
      if (!kropp.verkstall)
        return json(res, 200, { gallring: installningar.sessionsgallring || 0,
          ...Sessionsgallring.forhandsgranska(mina, { dagar }) });

      const egna = new Map(mina.map(s => [s.id, s]));
      const r = await Sessionsgallring.gallra(egna, { dagar,
        katalog: sessionsKatalog, glom: id => { korningar.get(id)?.abort(new Error(tx('srv.session.gallrad'))); glomKod(id); } });
      for (const b of r.sessioner) sessioner.delete(b.id);

      // Protokollet. En session som försvann utan spår ser ut som en session
      // som aldrig fanns — och den som ska kunna svara en arkivarie behöver
      // kunna peka på beslutet, inte bara på frånvaron.
      if (r.antal) {
        await maximus.andraFil(join(dataDir, 'sessionsgallring.json'),
          gamla => [...(Array.isArray(gamla) ? gamla : []), r], { forval: [] });
      }
      sandAlla({ typ: 'lista' });
      return json(res, 200, { gallring: installningar.sessionsgallring || 0, ...r });
    }

    /// Vägen ut: provar den och säger vilken adress som syns på andra sidan.
    ///
    /// Ett påstående om att trafiken går någon annanstans är värdelöst om det
    /// inte går att se. Provet tar SAMMA väg som sökningarna — en kontroll
    /// som går en annan väg bevisar fel sak.
    /// Öppnar ett brev som ett samtal.
    ///
    /// Brevet blir en bilaga, inte en fråga. Då går det genom exakt samma
    /// grind som ett dokument man dragit in: maskering mot sessionens karta,
    /// informationsklassning, och användaren ser vad som döljs innan något
    /// skickas. Ett mejl ska inte ha en gräddfil förbi grinden för att det
    /// råkade komma per post.
    /// Originalet bakom ett kort i agentens tur (2026-10-10, lib/underlag.mjs).
    ///
    /// Kortet slås upp i sessionen — referensen kommer härifrån, aldrig ur
    /// anropet. Utan `app` svarar vägen med texten, läst lokalt, för att
    /// visas i samtalet. Med `app` öppnas originalet där det bor: brevet i
    /// Mail, filen i sitt program, sidan i webbläsaren. Ingenting skickas.
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
          // Samma gräns som läsningen: bara inom mapparna du gett lov till.
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
      try { text = await lasOriginal(r); } catch { /* kortets egen text nedan */ }
      return json(res, 200, { titel: k.titel, var: Underlag.beskriv(r), original: Boolean(text), text: String(text || k.reserv || '') });
    }

    if (vag === '/api/post/oppna') {
      if (!Post.finns()) return json(res, 400, { error: tx('srv.fel.mailBaraMac') });
      let brev;
      try { brev = await Post.text(String(kropp.konto || ''), String(kropp.id || ''), { lada: kropp.lada || 'INBOX' }); }
      catch (e) { return json(res, 422, { error: e.message }); }
      if (!brev) return json(res, 404, { error: tx('srv.post.brevOlasbart') });

      const text = brevSomText(brev);

      // Var samtalet kom ifrån.
      //
      // Utan det vet ett utkast inte vem det ska till, och användaren får
      // skriva in adressen igen — i en app vars hela poäng är att hon inte
      // ska behöva skriva samma sak två gånger.
      //
      // Adressen sparas omaskad i sessionen, precis som brevets text redan
      // gör. Den går genom grinden som allt annat när den lämnar datorn.
      const s = { id: randomUUID(), titel: (brev.amne || tx('srv.post.mejlTitel')).slice(0, 60),
        skapad: new Date().toISOString(), agare: jag?.id || null,
        turer: [], karta: [], raknare: {},
        ursprung: { sort: 'mejl', fran: brev.fran || null, namn: brev.namn || null,
                    adress: brev.svarTill?.[0] || brev.adress || null, amne: brev.amne || null,
                    konto: String(kropp.konto || '') || null,
                    // Brevet självt (2026-10-10): ett svar går på originalet.
                    id: String(kropp.id || '') || null, lada: String(kropp.lada || 'INBOX') },
        // Kontots etikett (2026-10-10), så att samtalet går att filtrera på den.
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

    // ── Svar på mejl (2026-10-10) ─────────────────────────────────────────
    // Förslaget, omskrivningen och Skicka. Varje väg här kräver fönstret:
    // kakan, inte `x-maximus-nyckel` (serverns egna anrop, telefonen), inte
    // en utökning, aldrig en annan webbplats (granskningen 2026-10-10: förut
    // bara Skicka och Öppna i Mail). Inget verktyg och ingen modell når dem.
    // Med utökningen (IDENTITET) finns inga svar: Mail är den här datorns,
    // och förslagen har ingen ägare.
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

    // Din text, sparad i förslaget när rutan stängs: ett utkast ligger kvar.
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

    /// Det som går ut tas ur förslaget — konto, låda, brev, mottagare, ämne —
    /// aldrig ur kroppen. Ur kroppen kommer bara din text och signaturen, och
    /// avtrycket måste stämma över allt (granskningen 2026-10-10).
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

    // Läget "Öppna i Mail": svaret öppnas i Mail, och du skickar där.
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

    /// Skicka. Fryser det du såg och lägger det i kön. Ingenting går till
    /// Mail på tio sekunder.
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

    // Bara proven: ett förslag utan Mail, ett fel nästa gång, och skripten.
    if (vag === '/api/svar/prov') {
      if (!PROV_SVAR) return json(res, 404, { error: tx('srv.fel.okandVag') });
      if (kropp.fel) svarProv.fel = String(kropp.fel);
      if (kropp.forslag) {
        const f = Svar.nyttForslag({ brev: { id: kropp.forslag.brevId || randomUUID(), fran: kropp.forslag.fran || 'Prov <prov@example.com>',
          amne: kropp.forslag.amne || 'Prov', namn: kropp.forslag.namn || 'Prov', text: kropp.forslag.brevtext || '' },
          // Kontot och lådan går att välja (2026-10-10): provet med två konton.
          konto: String(kropp.forslag.konto || 'Prov'), lada: String(kropp.forslag.lada || 'INBOX'),
          etikett: Konton.etikettUr(kropp.forslag.etikett), text: kropp.forslag.text || '', session: kropp.forslag.session || null });
        svarsforslag.push(f); await sparaSvarsforslag();
        // Med kortet: raden i Inkorgen (eller Agenten), som agenten skriver den.
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

    /// Ett möte blir underlag till en fråga.
    ///
    /// Samma väg som ett brev: texten byggs lokalt, går genom grinden, och
    /// sessionen föds med underlaget maskerat. Deltagarnas namn är
    /// persondata och maskeras som allt annat — men utan dem är ett möte
    /// bara en rubrik, och då är det inte underlag till någonting.
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
        // Kalenderns etikett (2026-10-10): filtret, och mötesförslag i samtalet
        // hamnar i en kalender med samma etikett.
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

    /// Skapa, byt namn på eller ta bort ett projekt.
    ///
    /// Att ta bort ett projekt tar aldrig bort samtalen i det. En mapp är en
    /// ordning man lagt på sitt material, och att riva ordningen ska inte
    /// riva materialet.
    if (vag === '/api/projekt') {
      const namn = String(kropp.namn || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (kropp.bort) {
        projekt = projekt.filter(p => p.id !== kropp.id);
        for (const x of sessioner.values()) if (x.projekt === kropp.id) { delete x.projekt; await spara(x); }
        await sparaProjekt();
        return json(res, 200, { projekt });
      }
      if (!namn) return json(res, 422, { error: tx('srv.projekt.behoverNamn') });
      // Ett projekt är ett MÅL, inte en mapp.
      //
      // Auro: "Ett projekt kan ju vara ett mål, ett uppdrag. Och innehålla
      // fler sessioner." Målet är det som gör skillnad för agenten: utan det
      // frågar den "angår det här projektet?", med det frågar den "för det
      // här oss närmare eller längre från målet?".
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

    /// Ett beslut om ett tillstånd: ja eller nej, med skälet utskrivet.
    ///
    /// Skälet skrivs här, ur lib/tillstand.mjs, inte i klienten — samma text
    /// i frågan, i svaret och i loggen. Beslutet ändrar agentens inställning
    /// som helhet och ställer om hjärtslaget direkt, som /api/installningar.
    /// Loggen (`installningar.tillstand`) är kvittot: vad, ja eller nej,
    /// varför, när. Ett nej loggas lika mycket som ett ja.
    // Öppnar en ruta i Systeminställningar. Bara de som står här — ett
    // fönster som får öppna valfri adress i systemet vore en öppning för
    // mycket.
    /// När agenten kör (Fas 26): bara med appen, med datorn (appen öppnas
    /// vid inloggning), eller i bakgrunden utan fönster. Se lib/bakgrund.mjs.
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
          // Laddas inte nu — då hade en andra app öppnats. Gäller från nästa inloggning.
          await Bakgrund.slaPa('inloggning', { ...o, ladda: false });
        }
        if (lage === 'bakgrund') await Bakgrund.slaPa('bakgrund', o);
        // Skalet läser flaggan när appen stängs: står den där lämnas servern igång.
        if (lage === 'bakgrund') await writeFile(join(dataDir, 'bakgrund'), '1');
        else await unlink(join(dataDir, 'bakgrund')).catch(() => {});
      } catch (e) { return json(res, 500, { error: tx('srv.agent.kundeInteAndra', { fel: e.message }) }); }
      installningar = { ...installningar, agentStart: lage, agentDold: o.dold };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      return json(res, 200, { lage, dold: o.dold });
    }

    /// Agentens samtal: skapas om det inte finns, så att det går att öppna
    /// från startsidan innan agenten skrivit något.
    if (vag === '/api/agent/samtal') {
      if (maximus.skyddat && !maximus.upplast) return json(res, 423, { error: tx('srv.fel.maximusLast') });
      const s = await agentSamtalet();
      return json(res, 200, { id: s.id });
    }

    /// Första genomgången (2026-10-05). Auro: "när man väl kommer in första
    /// gången - då är allt tomt. Kanske agenten blir det naturliga steget i att
    /// vägleda, föreslå". Agenten läser det du gett den lov till och lämnar
    /// en första överblick i Agentens samtal, med tre förslag på uppdrag.
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
        const r = await agentSlinga({ session: s.id, tur: gtur.id, obevakad: true,
          sammanhang: vem ? tx('srv.forsta.omAnvandaren', { vem }) : '',
          uppgift: tx('srv.forsta.uppgift'),
          onSteg: st => { gtur.insikt = Grunden.insiktFor(st); sand(s.id, { typ: 'steg', turId: gtur.id, steg: 'verktyg', text: st.verktyg }); } });
        gtur.svar = r.svar;
        gtur.insikt = tx('srv.forsta.insikt');
        // Tre förslag på uppdrag, som kort med "Sätt upp". Modellen läser
        // överblicken och föreslår; det blir ett uppdrag först när du sagt ja.
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

    /// Ja, nej eller ångra på ett förslag (Fas 32).
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

    /// En sökning i bakgrunden (Fas 30): "hitta tio klockarmband i läder".
    /// Blir ett engångsuppdrag som körs nu; svaret kommer som en tråd och en
    /// notis när det är klart.
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

    /// Undersök ett fynd nu (Fas 38): knappen i uppdragets vy.
    const mUndersok = /^\/api\/fynd\/([\w-]+)\/undersok$/.exec(vag);
    if (mUndersok) {
      const f = fynd.find(x => x.id === mUndersok[1]);
      if (!f) return json(res, 404, { error: tx('srv.fynd.finnsInte') });
      if (maximus.skyddat && !maximus.upplast) return json(res, 423, { error: tx('srv.fel.maximusLast') });
      // Finns undersökningen redan (och är inte förseglad eller låst) öppnas den.
      const fore = f.undersokning && sessioner.get(f.undersokning);
      if (fore && !(fore.las?.styrka === 'forseglad') && !fore.las) return json(res, 200, { session: f.undersokning, redan: true });
      const p = undersokFynd(f).catch(e => console.log(`  undersökning: ${e.message}`));
      for (let i = 0; i < 40 && !f.undersokning; i++) await new Promise(r => setTimeout(r, 50));
      void p;
      return json(res, 200, { session: f.undersokning || null });
    }

    /// En uppgift till agenten med verktyg (Fas 28). Svar och steg.
    if (vag === '/api/agent/slinga') {
      const uppgift = String(kropp.uppgift || '').trim().slice(0, 2000);
      if (!uppgift) return json(res, 422, { error: tx('srv.agent.vadGora') });
      if (maximus.skyddat && !maximus.upplast) return json(res, 423, { error: tx('srv.fel.maximusLast') });
      try {
        const r = await agentSlinga({ uppgift, sammanhang: String(kropp.sammanhang || '').slice(0, 4000) });
        return json(res, 200, r);
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    // Fönstret har tagit emot en notis men syns inte (dolt, eller en annan
    // app framme): den går till Notiscenter i stället.
    // Provet för telefonen: du trycker, en rad går iväg direkt.
    // Molnmodellen (Fas 51): välj leverantör och modell, lägg nyckeln i
    // nyckelringen, slå på — och prova direkt, maskerat, så att ett ja är ett
    // ja till något som fungerar.
    if (vag === '/api/moln') {
      if (nekas(res, 'molnModell', {}, jag)) return;
      // Bara nivån (2026-10-09): sparas utan prov, och utan att röra av/på.
      if (kropp.baraMaskering) {
        const nu = installningar.moln || { leverantor: 'berget', pa: false };
        installningar = { ...installningar, moln: { ...nu, maskering: Moln.maskeringUr(kropp.maskering) } };
        await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
        await aktiveraMoln();
        return json(res, 200, { maskering: installningar.moln.maskering });
      }
      // Det som inte skickas står kvar: att byta modell ska inte nollställa maskeringen.
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
          // Ett prov som inte går: tillbaka till den lokala modellen, och sägs.
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
    // Så här ser molnet din text (2026-10-09): exakt det som skulle gå ut,
    // med den nivå du väljer. Ingenting skickas.
    if (vag === '/api/moln/forhandsgranska') {
      const text = String(kropp.text || '').slice(0, 2000);
      await Namnmodell.forbered([text]).catch(() => {});
      const { meddelanden, antal } = Moln.maskeraMeddelanden([{ role: 'user', content: text }], { niva: kropp.maskering });
      return json(res, 200, { ut: meddelanden[0].content, antal, maskering: Moln.maskeringUr(kropp.maskering) });
    }
    // Logga in hos OpenRouter: webbläsaren öppnas, och svaret kommer till
    // /moln/openrouter/<tillstånd> här på datorn.
    if (vag === '/api/moln/openrouter/logga-in') {
      if (nekas(res, 'molnModell', {}, jag)) return;
      const p = Moln.paborjaInloggning({ tillbaka: `http://localhost:${PORT}/moln/openrouter` });
      // Nivån du redan valt följer med; utan ett val är den strikt.
      molnInloggning = { ...p, maskering: Moln.maskeringUr(kropp.maskering ?? installningar.moln?.maskering) };
      execFileCb('/usr/bin/open', [p.url], () => {});
      return json(res, 200, { url: p.url });
    }
    // Nyheter på/av (Fas 50). Ett ja sätter upp uppdraget och kör det direkt.
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
    // Samtalet kom ur en nyhet (Fas 52): märks, så att svaren erbjuder
    // handling — bevaka, djupdyk — och inte bara text.
    const mNyhetSamtal = /^\/api\/sessioner\/([\w-]+)\/nyhet$/.exec(vag);
    if (mNyhetSamtal) {
      const ss = minSession(mNyhetSamtal[1], jag);
      const f = fynd.find(x => x.id === String(kropp.fynd || ''));
      if (!ss || !f) return json(res, 404, { error: tx('srv.fel.finnsInte') });
      ss.nyhet = { fynd: f.id, titel: f.titel, url: f.url };
      await spara(ss);
      return json(res, 200, { nyhet: ss.nyhet });
    }
    // En nyhet som underlag i ett samtal (Auro 2026-10-06: "När det är
    // nyhet->session = aldrig maskering eller anonymisering för den
    // citeringen. Punkt."). Sidan är publik; servern hämtar den själv (i
    // liggaren) och lägger den omaskerad, märkt med sin adress. Det är
    // servern som vet att det är en nyhet — sidan kan inte påstå det om en
    // egen fil och slippa masken.
    const mNyhetBifoga = /^\/api\/nyheter\/([\w-]+)\/bifoga$/.exec(vag);
    if (mNyhetBifoga) {
      // Också andra publika webbkällor (2026-10-10): en sida eller en
      // sökträff som agenten läst. Märkt av källan när den lästes.
      const f = fynd.find(x => x.id === mNyhetBifoga[1] && (uppdrag.find(u => u.id === x.uppdrag)?.nyheter || (x.publik === true && !x.brev)));
      const sess = minSession(String(kropp.session || ''), jag);
      if (!f?.url || !sess) return json(res, 404, { error: tx('srv.nyheter.ellerSamtalFinnsInte') });
      let r = null;
      try { r = await hamtaSida(f.url, { tecken: 16000, liggare: p => liggare({ ...p, anvandare: jag?.id || null, session: sess.id, aktor: tx('srv.helig.nyheterTitel') }) }); } catch { /* fynden räcker */ }
      const titel = String(r?.titel || f.titel || tx('srv.nyheter.reservTitel')).slice(0, 160);
      // Föll hämtningen för ett fynd ur inkorgen finns bara brevet kvar, och
      // ett brev är inte publikt (2026-10-09, granskningen, MSK-11): det som
      // läggs omaskerat i sessionen får bara vara ämnet och avsändaren.
      // Sidans text är publik; brevets text är det aldrig.
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
    // En nyhet att prata om: sidan hämtas (i liggaren) och blir underlag.
    const mNyhet = /^\/api\/nyheter\/([\w-]+)\/las$/.exec(vag);
    if (mNyhet) {
      const f = fynd.find(x => x.id === mNyhet[1] && uppdrag.find(u => u.id === x.uppdrag)?.nyheter);
      if (!f?.url) return json(res, 404, { error: tx('srv.nyheter.finnsInte') });
      try {
        const r = await hamtaSida(f.url, { tecken: 16000, liggare: p => liggare({ ...p, anvandare: jag?.id || null, session: null, aktor: tx('srv.helig.nyheterTitel') }) });
        f.sett = true; await sparaFynd();
        // Samma regel som för bifoga: brevets text är ingen reserv.
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
      if (process.platform === 'darwin' && installningar.agentNotiser !== false) {
        // Som argv, se notifiera() (granskningen 2026-10-09).
        execFileCb('/usr/bin/osascript', notisArgument(kropp.titel, kropp.text), () => {});
      }
      return json(res, 200, { ok: true });
    }

    if (vag === '/api/oppna-installning') {
      const adr = { fda: Meddelanden.FDA_URL, filer: 'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders',
        paminnelser: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Reminders',
        // Kalendern och Automatisering (Fas 49): dit ett nej från macOS pekar.
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
      // Flera konton och kalendrar, med etikett (2026-10-10). Läses och
      // prövas i lib/konton.mjs; det som inte känns igen faller bort.
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

    /// Hämta båda modellerna i ett svep.
    ///
    /// 202 direkt; framsteget går på översiktsströmmen som `{typ:'start',
    /// vem:'tanker'|'hor'|'alla', ...}`. En modell som redan ligger på disk
    /// blir klar på en gång — samma väg för den som har och den som inte har,
    /// så att det inte finns en andra väg att hålla i takt.
    ///
    /// `hor: null` är ett nej till örat. Det är ett riktigt val och ska gå
    /// att göra, inte ett fel.
    if (vag === '/api/start/hamta') {
      if (startHamtar || hamtarNu) return json(res, 409, { error: tx('srv.start.hamtningPagar') });
      const tid = String(kropp.tanker || '');
      const hid = kropp.hor === null ? null : String(kropp.hor || '');
      const egen = kropp.egen === true && installningar.modellfil;
      // Molnmodellen vald i starten (Fas 51): den stora modellen hämtas inte.
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
        // En egen fil hämtas inte; den finns redan.
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

      // Namnmodellen följer med starten (Auro
      // 2026-10-10): 150 MB från en låst revision, i liggaren som de andra.
      // Den väntas inte in — går hämtningen inte gäller reglerna, och felet
      // loggas.
      if (process.platform === 'darwin' && installningar.namnmodell !== false) {
        Namnmodell.hamtaNamnmodell({ liggare: hamtningsliggare(jag) })
          .catch(e => console.log(`  namnmodellen: hämtningen gick inte (${e.message}) — bara reglerna gäller`));
      }
      Promise.all([tanker, hor]).then(async () => {
        if (!fel.tanker) {
          // `klar` är det gamla märket för "starten är gjord". Det lästes av
          // guiden och läses fortfarande ur ett låst Maximus; nu sätts det här.
          installningar = { ...installningar, klar: true, modellval: { tanker: startHamtar.tanker, hor: hid,
            nar: new Date().toISOString() } };
          await spara();
        }
        sand('alla', { klar: !fel.tanker, fel: fel.tanker || fel.hor || null });
      }).finally(() => { startHamtar = null; });
      return json(res, 202, { tanker: startHamtar.tanker, hor: hid });
    }

    /// En egen modellfil. Prövas innan den blir vald — se Start.provaEgen.
    // En egen lyssnarmodell (2026-10-06): en whisper.cpp-fil du har.
    if (vag === '/api/start/egetora') {
      // Säkerhetsgranskningen 2026-10-06: sökvägen löses upp (inga länkar
      // till något annat), prövas som en vanlig fil INNAN den öppnas (en
      // FIFO eller en enhet hade hängt servern), och magin måste gå att läsa.
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

    /// Ett manus som samtal (Auro 2026-10-04: första sessionen ska sparas).
    ///
    /// Första sessionen är skriven i förväg och körs utan modell. När den är
    /// klar sparas den som ett vanligt samtal, så att den står i listan och
    /// går att fortsätta i. Repliker från Maximus före första svaret blir en
    /// tur utan fråga; varje svar börjar en ny tur. Kvittot säger rakt ut att
    /// texten är skriven i förväg — den strömmade som modellen gör, men
    /// ingen modell körde.
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

    /// Godkänn villkoren.
    ///
    /// Datumet sätts här och inte i klienten: ett godkännande vars tidpunkt
    /// den godkännande själv skrev är en uppgift, inte ett kvitto. Versionen
    /// måste vara den som gäller nu — den som godkänt en gammal text har
    /// inte godkänt den nya.
    if (vag === '/api/villkor') {
      const v = await Villkor.las();
      if (kropp.godkann !== true || Number(kropp.version) !== v.version)
        return json(res, 422, { error: tx('srv.villkor.godkannVersion', { v: v.version }), version: v.version });
      installningar = { ...installningar, villkor: Villkor.godkannande(v.version) };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      return json(res, 200, { villkor: installningar.villkor, godkant: true });
    }

    /// Rensa allt.
    ///
    /// Det fanns ingen väg att börja om. Sessioner, projekt och agentens
    /// fynd gick bara att ta bort ett i taget, och den som ville nollställa
    /// fick gå i filsystemet.
    ///
    /// Liggaren rörs INTE. Den är bokföringen över vad som lämnat datorn,
    /// hashkedjad; att den går att tömma med en knapp vore att den inte är
    /// någon bokföring. Inställningar, profil, lösenord och modeller står
    /// också kvar — det är hur Maximus är inställt, inte vad du arbetat med.
    ///
    /// Kräver `bekrafta: 'rensa'`. En väg som raderar allt ska inte gå att
    /// träffa av misstag med en tom kropp.
    if (vag === '/api/rensa') {
      if (kropp.bekrafta !== 'rensa') return json(res, 422, { error: tx('srv.rensa.bekrafta') });
      // Var och en rensar sina egna samtal. Projekten och agenten rensas
      // bara av den som får rensa allt — på skrivbordet du.
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
        // Hjälpens sparade frågor från tiden före Fas 2. Ingenting läser
        // filen längre, men den ligger kvar på disk tills någon tar bort den.
        await unlink(join(dataDir, 'hjalpfragor.json')).catch(() => {});
      }
      sandAlla({ typ: 'lista' });
      sandAlla({ typ: 'agent' });
      sandAlla({ typ: 'bevakning' });
      // Ingen tyst tystnad: låg en fil kvar ska det stå.
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

    /// Delar bevakningar som en krypterad fil.
    ///
    /// Regeln reser, ärendet stannar. En person sätter upp bevakningarna för
    /// ett område, resten av laget får dem, och ingen får veta vad de andra
    /// arbetar med.
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
      // Läst betyder läst. En träff som står kvar som ny lär användaren att
      // ignorera märket.
      const b = bevakningar.find(x => x.id === kropp.id);
      if (!b) return json(res, 404, { error: tx('srv.bevakning.finnsInte') });
      if (kropp.vad === 'last') for (const t of b.traffar || []) t.last = true;
      else if (kropp.vad === 'av') b.av = true;
      else if (kropp.vad === 'pa') b.av = false;
      else if (kropp.vad === 'bort') bevakningar = bevakningar.filter(x => x.id !== b.id);
      await sparaBevakning();
      return json(res, 200, { ok: true });
    }

    /// Hämtar modellens bilddel.
    ///
    /// Aldrig av sig själv: den är mellan 175 MB och 1,2 GB, och den som
    /// aldrig skickar en bild ska inte behöva den.
    if (vag === '/api/modell/syn') {
      const m = Modeller.modellAvFil(modellfil());
      const id = String(kropp.id || m?.id || '');
      try {
        const r = await Modeller.hamtaMmproj(id, {
          onFramsteg: h => sandAlla({ typ: 'syn', ...h }), liggare: hamtningsliggare(jag),
        });
        // Modellen måste startas om för att se den.
        await stoppaModell().catch(() => {});
        return json(res, 200, { ok: true, redan: r.redan, vag: r.vag });
      } catch (e) { return json(res, 422, { error: e.message }); }
    }

    if (vag === '/api/vag/prova') {
      const val = { vag: kropp.vag || 'direkt', adress: kropp.adress || '',
        anvandare: kropp.anvandare || '', losenord: kropp.losenord || '' };
      const r = await Vag.prova(val, { startaWebblasare: egenWebblasare });
      // Provet hamnar under Skickat: det ÄR ett nätanrop, och två sidor fick
      // se adressen.
      await liggare({ anvandare: jag?.id || null,
        frontier: tx('srv.liggare.vagprov', { adress: Vag.visaAdress(val) }), vag: 'webb',
        skickat: 'ifconfig.co, check.torproject.org', mottaget: r.ip || r.fel || '',
        tecken: 0, sekunder: r.sekunder }).catch(() => {});
      return json(res, 200, r);
    }

    if (vag === '/api/installningar') {
      // Vissa inställningar är skyddsnivån för hela installationen och inte
      // en smaksak: liggaren, maskeringens omfattning, gallringen och vägen
      // ut. Revisionen 2026-09-28 stängde av liggaren med {"liggare":false}
      // — den som ville slippa bokföring kunde själv stänga boken.
      const GLOBALA = ['liggare', 'gallring', 'paket', 'sorter', 'vag', 'vagAdress',
        'vagAnvandare', 'vagLosenord', 'organisation', 'utanMask'];
      const rort = GLOBALA.filter(n => n in kropp);
      if (rort.length && nekas(res, 'installningar', { falt: rort.join(', ') }, jag)) return;
      // Godkännandet av villkoren sätts bara av /api/villkor, med serverns
      // datum. Genom den blinda sammanslagningen hade en klient kunnat
      // skriva vilket datum och vilken version som helst.
      delete kropp.villkor;
      // Modellvalet likaså: en sökväg som inte prövats av /api/start/egen
      // vore en väg att låta llama-server öppna vilken fil som helst.
      delete kropp.modellfil; delete kropp.modellval;
      // Tillståndsloggen är ett kvitto och skrivs bara av /api/tillstand.
      delete kropp.tillstand;
      // Molnmodellen sätts bara genom /api/moln, som provar den (Fas 51).
      delete kropp.moln;
      // Fälten utökningen själv skriver, bakom sina egna spärrar
      // (granskningen 2026-10-09), går inte att skriva här. Svaren bär bara
      // `harHemlighet`; skickades det tillbaka hade den blinda
      // sammanslagningen raderat hemligheten.
      for (const f of utokning?.installningar || []) delete kropp[f];
      delete kropp.harVagLosenord;
      // Rösten prövas mot listan innan den sparas.
      //
      // Raden nedanför är en blind sammanslagning: allt som skickas hamnar i
      // inställningarna. `personatext()` faller visserligen tillbaka på
      // förvalet vid ett okänt id, så ingen främmande text når prompten — men
      // ett värde som inte betyder något ska inte ligga sparat och se ut som
      // ett val. Den som skickar skräp får förvalet, inte skräpet.
      if ('persona' in kropp && !PERSONAS[kropp.persona]) kropp.persona = PERSONA_FORVAL;
      // Motorn likaså: samtal eller agent, inget annat. Ett värde som inte
      // betyder något ska inte ligga sparat och se ut som ett val.
      // null betyder "inte valt än" och måste gå att sätta tillbaka — annars
      // går valet inte att ångra. Allt ANNAT som inte är ett rum kastas.
      if ('motor' in kropp && kropp.motor !== null
        && !['samtal', 'agent'].includes(kropp.motor)) delete kropp.motor;
      // Agentens tillgång läses fält för fält, aldrig som ett helt objekt.
      //
      // Det här är den enda inställningen som ger något LÄSRÄTT till din
      // post. Ett `{ ...kropp.agent }` hade betytt att vad som helst som
      // ramlar in i en POST blir en rättighet, och en rättighet som smugit
      // in är ingen rättighet man gett.
      if ('agent' in kropp) kropp.agent = agentUr(kropp.agent);
      // Handlingarnas spakar, och Skicka svar (2026-10-10): kända namn och
      // kända lägen, inget annat.
      if ('handlingar' in kropp) kropp.handlingar = Object.fromEntries(Object.entries(kropp.handlingar && typeof kropp.handlingar === 'object' ? kropp.handlingar : {})
        .filter(([k, v]) => (Handlingar.HANDLINGAR[k] && Handlingar.SPAKAR.includes(v)) || (k === 'skickasvar' && Svar.SKICKALAGEN.includes(v))));
      // Svarsförslagen: läget, och signaturen du valt per konto ('' = ingen).
      if ('svar' in kropp) {
        const v = kropp.svar && typeof kropp.svar === 'object' ? kropp.svar : {};
        const sig = { ...(installningar.svar?.signaturer || {}) };
        for (const [k, n] of Object.entries(v.signaturer && typeof v.signaturer === 'object' ? v.signaturer : {})) {
          if (typeof k === 'string' && typeof n === 'string' && k.length <= 200) sig[k] = n.slice(0, 200);
        }
        kropp.svar = { forslag: Svar.FORSLAGSLAGEN.includes(v.forslag) ? v.forslag : Svar.forslagsLage(installningar), signaturer: sig };
      }
      // Kollegan (2026-10-10): förslag på/av, knack-knack på/av och högst var N:e dag.
      if ('kollega' in kropp) kropp.kollega = Kollega.installningUr(kropp.kollega, installningar.kollega);
      // Örat: svensk eller snabb, inget annat.
      if ('ora' in kropp) { if (!['svensk', 'snabb'].includes(kropp.ora)) delete kropp.ora; else satOra(kropp.ora); }
      // Dikteringen (Fas 42): sekunder tystnad som skickar; 0 = bara "skicka".
      if ('diktatTyst' in kropp) { const n = Number(kropp.diktatTyst); if ([0, 2, 3, 5].includes(n)) kropp.diktatTyst = n; else delete kropp.diktatTyst; }
      // Språket: automatiskt eller ett som finns i public/sprak/, inget annat.
      if ('sprak' in kropp && !(kropp.sprak === 'auto' || Sprakstod.tillgangliga().includes(kropp.sprak))) delete kropp.sprak;
      // Profilen läses fält för fält som allt annat. Tre fält, inga andra.
      // Varifrån varje ändrat fält kom (/du): ur förslaget eller ur dig. Det
      // du lagt till i /du ändras bara där — en kopia i gränssnittet som
      // hunnit bli gammal ska inte kunna skriva tillbaka det du tagit bort.
      if ('profil' in kropp) kropp.profil = kropp.profil === null ? null
        : Banken.markera(installningar.profil, Profil.las(kropp.profil), { forslag: (await lasDu())?.forslag || null });
      const stallOmHjartat = 'agent' in kropp;
      installningar = { ...installningar, ...kropp };
      await maximus.skrivFil(join(dataDir, 'installningar.json'), JSON.stringify(installningar));
      // Den som ställer om takten ska inte behöva starta om appen för att
      // den ska gälla. En inställning som först gäller nästa gång är en
      // inställning man tror är trasig.
      if (stallOmHjartat) stallHjartat();
      // Modellens minne sätts när modellen startar. Ändras det medan den kör
      // gäller det först nästa gång — knappen intill säger till.
      if (kropp.kontext) satKontext(kropp.kontext);
      // Vägen ut gäller direkt. En inställning som inte gäller förrän nästa
      // gång är en inställning man inte litar på — webbläsaren stängs och
      // startar om med den nya proxyn.
      if ('vag' in kropp || 'vagAdress' in kropp) {
        await satVag({ vag: installningar.vag || 'direkt', adress: installningar.vagAdress || '',
          anvandare: installningar.vagAnvandare || '', losenord: installningar.vagLosenord || '' });
      }
      return json(res, 200, { ...utanHemligheter(installningar), kontextNu: await kontextTak().catch(() => null) });
    }

    if (vag === '/api/sessioner') {
      // En tom session som redan finns återanvänds. Den som trycker på plus
      // fem gånger vill börja om fem gånger, inte samla fem tomma rader —
      // och en lista där nio av tio rader heter "Ny session" är ingen lista.
      //
      // Bara helt orörda: inga frågor, ingen bilaga, inget namn, inte fäst,
      // inte låst. Så fort något lagts i den är den ett påbörjat ärende.
      const tom = [...sessioner.values()]
        .filter(x => (x.agare || null) === (jag?.id || null)
          && !(x.turer || []).length && !(x.filer || []).length
          && !x.fast && !x.las && !x.forseglad
          && (arNySession(x.titel) || !x.titel))
        .sort((a, b) => String(b.andrad || b.skapad).localeCompare(String(a.andrad || a.skapad)))[0];
      if (tom) {
        // Läget följer det som begärdes: knappen ska göra samma sak vare sig
        // den öppnar en ny ruta eller en tom som råkade ligga kvar.
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
        // Behandlingen följer sessionen, inte appen.
        //
        // Ett samtal om ett personalärende ska inte byta grind för att det
        // förra samtalet gjorde det.
        behandling: Behandling.stall(kropp.behandling ?? installningar.behandling),
        // Rösten fryses här, som behandlingen.
        //
        // Byter man persona i inställningarna ska pågående samtal inte byta
        // ton mitt i — ett svar i en annan röst än det ovanför ser ut som en
        // annan assistent. Och systemblocket måste stå still inom en session,
        // annars räknas hela samtalet om vid nästa fråga (lib/persona.mjs).
        persona: PERSONAS[kropp.persona] ? kropp.persona : (installningar.persona || PERSONA_FORVAL),
        webb: ['av', 'auto', 'pa'].includes(kropp.webb) ? kropp.webb
          : kropp.webb === true ? 'pa' : kropp.webb === false ? 'av' : (installningar.webb || 'av'),
        // Minnet (Fas 10): isolerat som förval. Se MINNEN.
        minne: MINNEN.includes(kropp.minne) ? kropp.minne : 'isolerat' };
      sessioner.set(s.id, s); await spara(s);
      return json(res, 201, s);
    }

    // Steg 1–2: maskera och visa. Ingenting har lämnat datorn än.
/// Vad som följer med frågan, utöver frågan.
///
/// Grinden visade den maskerade FRÅGAN och ingenting annat. Men servern
/// lägger till samtalet så här långt, era regler, bilagor och — i ett
/// projekt — utdrag ur de andra samtalen. Revisionen 2026-09-28 (M4)
/// påpekade det: användaren godkände en sak och en annan gick.
///
/// Allt det går genom samma maskering som frågan, så inget OMASKERAT
/// smiter ut den vägen. Men "det är maskerat" är inte samma löfte som "du
/// ser vad som går ut", och det är det senare MAXIMUS lovar.
///
/// Listan räknas fram med samma anrop som sändvägen använder, inte med en
/// uppskattning bredvid. Det som inte går att veta i förväg står som
/// okänt: webbunderlaget finns inte förrän sökningen körts, och den körs
/// efter godkännandet. Det visas i stället källa för källa medan det
/// hämtas.
async function foljerMed(sess, fraga) {
  // Allt följer med till den lokala modellen också. Det som skiljer är att
  // ingenting av det lämnar datorn — men användaren ska ändå kunna se vad
  // som läggs till hennes fråga, och den maskerade versionen hon kopierar
  // ut bär samma material.
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

  // Projektet räknas med samma anrop som sändvägen gör, så siffran är
  // densamma som den som faktiskt går.
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
    } catch { /* ett projekt som inte går att läsa ska inte fälla grinden */ }
  }

  // Det som inte går att veta förrän efter godkännandet. Sägs ut hellre än
  // utelämnas: en lista som ser komplett ut och inte är det är värre än
  // ingen lista.
  const okant = [];
  if ((sess.webb || 'av') !== 'av') {
    okant.push(tx('srv.foljer.webbOkant'));
  }
  return { poster, okant };
}

    if (vag === '/api/forbered') {
      const f = String(kropp.fraga || '').trim();
      if (!f) return json(res, 422, { error: tx('srv.fel.skrivFraga') });
      // Sessionens karta följer med in, så samma person behåller sin
      // platshållare genom hela samtalet.
      //
      // `tolka` skickas aldrig hit. Reglerna tar fyra millisekunder och
      // modellen kan ta sekunder — att vänta in modellen innan något visas
      // gjorde att gränssnittet stod stilla på "Tolkar frågan" medan
      // användaren undrade om det hängt sig. Modellen får sitt eget anrop
      // och förfinar det som redan står på skärmen.
      const sess = minSession(kropp.session, jag);
      const klar = await forbered(f, { karta: sess?.karta || [], raknare: sess?.raknare || {},
        sorter: galler(installningar) });

      // ── Anonymiserat ska anonymisera ───────────────────────────────────
      //
      // Valet fanns i gränssnittet och gjorde ingenting. Revisionen
      // 2026-09-29 (H5) valde Anonymiserat, skickade en fråga med ett
      // precist belopp, och såg exakt samma maskerade text gå ut som
      // Maskerat hade gett. Användaren trodde att belopp, datum och ovanliga
      // detaljer blivit vagare när det inte hade skett.
      //
      // En etikett som ljuger är värre än ingen etikett: den får någon att
      // skicka något hon annars hade hållit tillbaka.
      //
      // Omskrivningen sker HÄR, i förberedelsen, och inte vid sändning. Då
      // står den i grinden, och det användaren godkänner är det som går.
      // Den kostar sekunder hos den lokala modellen — men den som valt
      // Anonymiserat har bett om just den behandlingen.
      //
      // Bara när en molnmodell svarar (Auro 2026-10-10): mot den lokala
      // gäller valet inte, och då är det maskerade kortet det du får. Vill
      // du ha texten anonymiserad ber du om det i samtalet.
      if (behandlingNu(sess) === 'anonym' && klar.maskerad) {
        try {
          const vagare = await skrivOm(klar.maskerad, {});
          if (vagare && vagare !== klar.maskerad) {
            // Genom serverns egen maskering igen. Modellen skrev om texten,
            // och en omskrivning kan råka skriva fram ett namn.
            const karta = new Map((klar.karta || []).map(k => [k.original, k.platshallare]));
            const raknare = new Map(Object.entries(klar.raknare || {}));
            const h = maskeraHart(vagare, { karta, raknare, sorter: galler(installningar) });
            klar.maskerad = h.skyddat.aterstall(h.text);
            klar.anonymiserad = true;
          } else {
            // Kort fråga, eller ingenting att göra vagare. Det ska synas —
            // annars tror användaren att något hände.
            klar.anonymiserad = false;
            klar.anonymSkal = vagare ? tx('srv.anonym.ingetVagare') : tx('srv.anonym.forKort');
          }
        } catch (e) {
          // Fail closed på etiketten, inte på frågan: den maskerade texten
          // är fortfarande maskerad och går att skicka. Men användaren ska
          // inte tro att den är anonymiserad.
          klar.anonymiserad = false;
          klar.anonymSkal = e.message.slice(0, 120);
        }
      }
      // Och allt annat som följer med. Se foljerMed() för varför.
      return json(res, 200, { ...klar, foljerMed: await foljerMed(sess, f) });
    }

    // Tolkningen, som ett eget steg efter att grinden redan visats.
    if (vag === '/api/tolka') {
      const f = String(kropp.fraga || '').trim();
      if (!f) return json(res, 422, { error: tx('srv.fel.skrivFraga') });
      const sess = minSession(kropp.session, jag);
      return json(res, 200, await forbered(f, {
        tolka: true, karta: sess?.karta || [], raknare: sess?.raknare || {},
      }));
    }

    // En fil bort. Den låg bara i sessionen, så det är allt som behövs.
    // Anonymisering av ett helt dokument.
    //
    // Maskeringen tar bort det som pekar ut någon direkt. Kvar står sådant
    // som pekar ut ändå: ett exakt belopp i en upphandling, en ovanlig
    // diagnos, ett datum som bara gäller ett ärende. Den lokala modellen
    // skriver om det, stycke för stycke, på den MASKERADE texten — den ser
    // alltså aldrig namnen.
    //
    // Ett stycke i taget, och varje stycke prövas: blev det faktiskt vagare?
    // Blev det inte det står originalstycket kvar. En omskrivning som bara
    // låter annorlunda är ingen anonymisering.
    const mAnon = /^\/api\/sessioner\/([\w-]+)\/fil\/([\w-]+)\/anonymisera$/.exec(vag);
    if (mAnon) {
      const s = minSession(mAnon[1], jag);
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      if (stangd(s)) return json(res, 423, { error: tx('srv.fel.forsegladAngeKoden') });
      const f = (s.filer || []).find(x => x.id === mAnon[2]);
      if (!f) return json(res, 404, { error: tx('srv.fel.bilaganFinnsInte') });
      // En publik källa är redan publik (2026-10-10): inget att anonymisera.
      if (f.publik) return json(res, 409, { error: tx('srv.fel.publikKalla') });

      json(res, 202, { igang: true });
      void (async () => {
        try {
          // Alltid den lokala modellen (2026-10-10): knappen lovar att "den
          // lokala modellen skriver om", också när molnet är påslaget.
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

    // Öppnar en förseglad session. Koden prövas mot kontrollvärdet, och
    // innehållet läses först när den stämmer.
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

        // Migrering vid upplåsning.
        //
        // Förseglingen omfattade tidigare bara `turer` och `sammandrag`;
        // kartan, bilagorna och ursprunget låg utanför. Rättelsen gäller vid
        // SKRIVNING, och en session som aldrig skrivs igen står kvar
        // oskyddad hur länge som helst.
        //
        // Här finns koden, och det är det enda ögonblick då den finns. Alltså
        // skrivs sessionen om direkt: fälten flyttar in i kuvertet utan att
        // någon behöver veta att de låg fel.
        //
        // Skrivningen får inte fälla upplåsningen. Går den inte igenom är
        // sessionen ändå öppnad, och nästa ändring migrerar den.
        try { await spara(hel); } catch { /* nästa ändring gör om försöket */ }

        return json(res, 200, hel);
      } catch (e) { return json(res, 422, { error: e.message }); }
    }

    const m3 = /^\/api\/sessioner\/([\w-]+)\/(arkivera|las|fast|lage|val|webb|titel|projekt|minne)$/.exec(vag);
    if (m3) {
      const s = minSession(m3[1], jag, { forseglad: true });
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });

      // Tillståndet läses FÖRE varje ändring, och det är hela poängen.
      //
      // Sett i revisionen 2026-09-28: POST /las med tom kropp körde
      // `delete s.las; delete s.forseglad` och därefter spara(). Spärren i
      // spara() frågar `stangd(s)` — men då var det som gjorde den sann
      // redan borttaget. Rutten passerade spärren genom att först riva det
      // spärren vaktade, och skrev en stängd stubbe med noll turer över den
      // krypterade kroppen. Samtalet var permanent borta.
      //
      // En kontroll som läser tillståndet efter mutationen kontrollerar
      // mutationen, inte tillståndet.
      const varStangd = stangd(s);
      const varForseglad = Boolean(s.forseglad) || s.las?.styrka === 'forseglad';
      if (varStangd) {
        return json(res, 423, { error: tx('srv.session.forsegladAngeKod') });
      }

      // Destinationen och behandlingen, som ett par.
      if (m3[2] === 'val') {
        s.behandling = Behandling.stall(kropp.behandling ?? valet(s).behandling);
        // De gamla fälten tas bort, annars läser valet() dem nästa gång och
        // skriver över det som just valts.
        delete s.lage;
        delete s.destination;
        await spara(s);
        return json(res, 200, { behandling: s.behandling });
      }
      if (m3[2] === 'lage') s.lage = ['lokalt', 'snabb', 'noggrann'].includes(kropp.lage) ? kropp.lage : s.lage;
      // Namnet. Modellen döper sessionen på maskerad text och gissar ibland
      // fel; då ska den som äger ärendet kunna rätta det.
      //
      // `dopt` säger att namnet är satt för hand, så att nästa svar inte
      // döper om det igen. Ett namn man skrivit själv ska stå kvar.
      else if (m3[2] === 'titel') {
        const t = String(kropp.titel || '').replace(/\s+/g, ' ').trim().slice(0, 90);
        if (t) { s.titel = t; s.dopt = true; }
      }
      // Webbsök hör till sessionen och inte till fliken. Ett samtal där man
      // slagit på det ska ha det påslaget nästa gång det öppnas.
      else if (m3[2] === 'webb') s.webb = ['av', 'auto', 'pa'].includes(kropp.pa) ? kropp.pa : (kropp.pa === true ? 'pa' : 'av');
      else if (m3[2] === 'arkivera' && s.helig) return json(res, 409, { error: tx('srv.grund.arkiverasInte') });
      else if (m3[2] === 'arkivera') {
        s.arkiverad = kropp.pa !== false;
        // Tagit tillbaka det agenten arkiverade: då rör den det inte igen (Fas 41).
        if (!s.arkiverad && s.arkiv?.av === 'agenten') s.tillbaka = true;
        if (!s.arkiverad) delete s.arkiv;
      }
      else if (m3[2] === 'minne') {
        if (!MINNEN.includes(kropp.minne)) return json(res, 422, { error: tx('srv.session.minneVal') });
        s.minne = kropp.minne;
      }
      else if (m3[2] === 'fast') s.fast = kropp.pa !== false;
      // Null lyfter ut samtalet ur projektet utan att röra något annat.
      else if (m3[2] === 'projekt') {
        if (kropp.projekt) s.projekt = String(kropp.projekt);
        else delete s.projekt;
      }
      else {
        // Lås. Två styrkor, och skillnaden är vem som kan öppna.
        //
        //   låst        koden är en grind i gränssnittet; huvudlösenordet
        //               öppnar ändå, och en glömd kod kostar ingenting.
        //   förseglad   nyckeln härleds ur huvudnyckel och kod tillsammans.
        //               Glömd kod betyder att sessionen är borta. För alltid.
        // Att ta bort eller byta en försegling kräver den nuvarande koden.
        //
        // Förseglingens hela innebörd är att innehållet inte går att nå utan
        // koden. En väg som river förseglingen utan kod är samma sak som att
        // nå innehållet utan kod — med skillnaden att den förstör det i
        // stället för att visa det.
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
          // Förseglingen sker vid skrivningen, och skrivningen behöver koden.
          if (s.las.styrka === 'forseglad') await minnsKod(s, String(kropp.kod));
          else glomKod(s.id);
        }
      }
      await spara(s);
      return json(res, 200, { id: s.id, titel: s.titel || null, projekt: s.projekt || null,
        arkiverad: !!s.arkiverad, fast: !!s.fast, webb: s.webb || 'av', las: s.las?.styrka || null });
    }

    // En bock i en checklista.
    //
    // Svaret röras inte. Modellen skrev `- [ ] ring kommunen`, och det är
    // vad den skrev — texten i en tur är vittnesmål och skrivs aldrig om i
    // efterhand. Bocken ligger vid sidan av, under punktens egen text som
    // nyckel. Se public/md.js för varför det är texten och inte platsen.
    //
    // Tiden sätts här och inte i webbläsaren. En tidsstämpel som en klient
    // får hitta på är inte en tidsstämpel.
    /// Ja eller nej till ett föreslaget uppdrag (Fas 11).
    ///
    /// Ett ja skapar uppdraget här, på servern, med källorna Maximus får
    /// läsa — inget formulär, inget rumsbyte. Ett nej sparas, så att samma
    /// ämne inte föreslås igen. Båda står kvar på turen.
    // Mötet läggs i Kalender. En .ics med deltagare och påminnelser som
    // Kalender öppnar och frågar om — Maximus skriver aldrig i kalendern.
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

    // Det användaren valde ur planen. Varje val bokförs på planen, så att
    // samtalet visar vad som gjordes när det öppnas igen.
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
        // Finns samtalet redan i ett projekt får projektet datumet, om det
        // inte har ett. Annars ett nytt projekt med planen som mål.
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
        // En fil som Kalender öppnar och frågar om. Det är du som lägger in
        // den — Maximus skriver aldrig i kalendern.
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
      // Ja till ett förslag skapar ett uppdrag: samma grind som /api/uppdrag.
      if (!agentBehov().klar) return behovSvar(res);
      if (uppdrag.length >= 200) return json(res, 409, { error: tx('srv.uppdrag.tak') });
      const a = installningar.agent || {};
      const har = { epost: Boolean(a.epost?.konto), kalender: Boolean(a.kalender), anteckningar: Boolean(a.anteckningar?.mapp),
        meddelanden: Boolean(a.meddelanden), paminnelser: Boolean(a.paminnelser), samtal: Boolean(a.samtal), mapp: Boolean(a.mapp?.sokvag),
        // Nyheternas ja (Fas 50) räcker för en ämnesbevakning: samma sak —
        // ämnesord som söks maskerat, och sidor som läses.
        amne: Boolean(a.sidor) || installningar.webb !== 'av' || Boolean(a.nyheter) };
      // Ett direkt uppdrag läser just de källor du nämnde. Saknas lovet till
      // någon av dem frågar klienten först — ett uppdrag på en källa utan lov
      // är ett uppdrag som tyst aldrig läser något.
      // "Alla mina källor" (Fas 35): allt du gett lov till.
      if (f.direkt && f.kallor.includes('alla')) f.kallor = Object.keys(har).filter(k => har[k] && k !== 'amne');
      if (f.direkt) {
        const saknar = f.kallor.filter(k => !har[k]);
        if (saknar.length) return json(res, 409, { error: tx('srv.forslag.inteLov'), saknar });
      }
      const kallor = f.direkt ? f.kallor : ['bevakning', ...(har.epost ? ['epost'] : []), ...(har.kalender ? ['kalender'] : []),
        ...(har.anteckningar ? ['anteckningar'] : [])];
      // Hur ofta väljs i förslaget: en gång nu, varje timme, en gång om
      // dagen. En engångssökning ("leta igenom inkorgen efter …") är en gång.
      const engang = f.engang || kropp.takt === 'engang';
      const enligtSchema = kropp.takt === 'schema' && f.schema;
      const takt = [15, 60, 240, 1440].includes(Number(kropp.takt)) ? Number(kropp.takt) : 60;
      const u = { ...Uppdrag.nyttUppdrag({ instruktion: f.instruktion,
        kallor: kallor.map(k => (k === 'amne' ? { typ: 'amne', fraga: f.amne || f.instruktion } : k)), aterkommande: !engang,
        // Ämnet om det gick att läsa ut, annars samtalets namn (modellen har
        // redan döpt det efter innehållet), och först sist källan.
        titel: f.amne ? `${f.amne}${f.direkt ? tx('srv.uppdrag.titelI', { var: ochLista(f.var) }) : ''}`
          // Agentens samtal heter "Agenten"; det namnet säger inget om
          // uppdraget (sett 2026-10-05). Då namnet ur dina egna ord.
          : f.direkt ? (s.titel && !arNySession(s.titel) && !s.agentsamtal ? s.titel
            : s.agentsamtal ? Uppdrag.namnUr(f.instruktion) || tx('srv.uppdrag.titelBevakningAv', { var: ochLista(f.var) })
            : tx(engang ? 'srv.uppdrag.titelSokningI' : 'srv.uppdrag.titelBevakningAv', { var: ochLista(f.var) })) : f.amne,
        ...(f.direkt && !engang ? { takt } : {}),
        ...(f.direkt ? { schema: enligtSchema ? f.schema : null, filter: f.filter || null } : {}),
        projekt: projekt.some(x => x.id === s.projekt) ? s.projekt : null }),
        // Uppdragets tråd: det agenten hittar skrivs i samtalet där du gav det.
        session: s.id,
        // Och exakt var: frågan uppdraget kom ur, för källänken i kortet.
        ursprung: { session: s.id, tur: t.id } };
      f.takt = engang ? null : (f.direkt ? takt : u.takt);
      f.valtSchema = enligtSchema ? Schema.somText(f.schema) : null;
      // Går ämnet bara genom nyheternas ja märks källan så, som i nyhetsuppdraget.
      if (a.nyheter) for (const k of u.kallor) if (k.typ === 'amne') k.nyheter = true;
      uppdrag.push(u);
      await sparaUppdrag();
      f.svar = 'ja'; f.uppdrag = u.id;
      // Första varvet går direkt, och säger vad det gjorde. Ett ja som bara
      // ger en bock lämnade dig med "ahapp, nu då?" (Auro 2026-10-04) — och
      // första riktiga svaret hade kommit vid nästa hjärtslag, tyst.
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
      // Utan `forseglad: true`, till skillnad från vägarna som rör yttre
      // fält. En checklista i en förseglad session går inte att se, så den
      // går inte heller att bocka i — och då finns inget att ge ett eget
      // besked om. minSession ger null, och det blir 404.
      const s = minSession(mKryss[1], jag);
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      const nyckel = String(kropp.nyckel || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      if (!nyckel) return json(res, 400, { error: tx('srv.kryss.punktSaknas') });
      s.kryss = s.kryss || {};
      // `i` är om den är ikryssad, `tid` när det blev så. Båda riktningarna
      // tidsstämplas: att något bockades AV klockan tre är lika mycket en
      // uppgift som att det bockades i.
      s.kryss[nyckel] = { i: kropp.i !== false, tid: new Date().toISOString() };
      // Ett tak, så att ett samtal där modellen skriver en ny checklista i
      // varje svar inte växer utan slut. Äldst åker först.
      const nycklar = Object.keys(s.kryss);
      if (nycklar.length > 500) {
        nycklar.sort((a, b) => (s.kryss[a].tid < s.kryss[b].tid ? -1 : 1));
        for (const g of nycklar.slice(0, nycklar.length - 500)) delete s.kryss[g];
      }
      await spara(s);
      return json(res, 200, { kryss: s.kryss });
    }

    // En notering i marginalen.
    //
    // Samma regel som bocken: turen rörs inte. Noteringen är användarens
    // egna ord om en passage, och de ska aldrig kunna förväxlas med vad
    // modellen skrev. De ligger vid sidan av, med passagen de hör till.
    //
    // Passagen sparas som den såg ut när noteringen skrevs. Hittas den inte
    // längre i texten står noteringen kvar ändå — se public/app.js. En
    // anteckning som försvinner för att underlaget ändrades är en
    // anteckning man inte vågar göra.
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
          // Var noteringen hör hemma: 'samtal', eller 'fil:<id>' för en som
          // gjorts i läsvyn för ett underlag. Utan det visades varje
          // notering i varje yta, och en som gjorts i samtalet stod i
          // dokumentets läsvy som "har tappat sitt fäste" — den hade inte
          // tappat något, den hörde till ett annat ställe.
          const plats = /^(samtal|fil:[\w-]{1,40})$/.test(String(kropp.plats || ''))
            ? String(kropp.plats) : 'samtal';
          // Namnet sparas med noteringen, inte slås upp vid visning. Samma
          // skäl som passagen: det ska stå kvar också när filen är borta.
          const platsnamn = String(kropp.platsnamn || '').replace(/\s+/g, ' ').trim().slice(0, 120);
          s.noteringar.push({ id: randomUUID(), plats, platsnamn, passage, text,
            tid: new Date().toISOString() });
        }
      }
      await spara(s);
      return json(res, 200, { noteringar: s.noteringar });
    }

    // ── Uppdrag ──────────────────────────────────────────────────────────
    //
    // Ett uppdrag är en instruktion, källor och en takt. Sidor, bevakningar
    // och "säg till när något ändras" är samma sak med olika källor — se
    // lib/uppdrag.mjs för varför takten räknas ut och inte ställs in.
    // ── Rökprov på en sida ────────────────────────────────────────────────
    //
    // Hämtas en gång, direkt, och du får se vad som kom tillbaka.
    //
    // Utan det är en trasig bevakning tyst: inloggningsvägg, blockering,
    // eller en sida som renderas med JavaScript och ger tom text. Allt det
    // ser likadant ut som "ingenting har hänt", och man undrar först efter
    // tre veckor varför det är så lugnt.
    if (vag === '/api/uppdrag/rokprov') {
      const url = String(kropp.url || '').trim();
      if (!/^https?:\/\//i.test(url)) return json(res, 400, { error: tx('srv.rokprov.adress') });
      if (!agentInst().sidor) return json(res, 200, { ok: false, skal: tx('srv.rokprov.sidorAv') });
      try {
        const r = await hamtaSida(url, { tecken: 4000,
          liggare: p => liggare({ ...p, anvandare: jag?.id || null, session: null }) });
        const text = String(r?.text || r || '').trim();
        // Tom sida är inte ett lyckat prov. Det är den vanligaste tysta
        // bevakningen av alla: adressen svarar, men det står ingenting.
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
      // Ett uppdrag som inte kan köras skapas inte: beskedet säger vad som
      // saknas, i stället för ett uppdrag som sedan misslyckas tyst.
      if (!agentBehov().klar) return behovSvar(res);
      // Vet instruktionen inte om det ska stå och gå frågar agenten — men
      // regeln bor HÄR, inte i webbläsaren. En kopia av den i klienten vore
      // två regler att hålla i takt för hand, och den formen har bitit tio
      // gånger i den här koden.
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
          // Ett uppdrag kan höra till ett projekt. Gör det inte det hör det
          // till dig — båda går, men ett uppdrag i ett projekt väger mot
          // projektets mål i stället för mot sina egna ord.
          projekt: projekt.some(x => x.id === kropp.projekt) ? kropp.projekt : null,
        });
        // Ett tak, så att ett samtal som missförstått sig självt inte fyller
        // listan med tusen bevakningar.
        if (uppdrag.length >= 200) return json(res, 409, { error: tx('srv.uppdrag.tak') });
        // Var uppdraget gavs, om det gavs i ett samtal — för källänken i
        // agentens kort. Bara ett eget samtal.
        const urs = kropp.ursprung && minSession(String(kropp.ursprung.session || ''), jag);
        if (urs) { u.ursprung = { session: urs.id, tur: String(kropp.ursprung.tur || '') || null }; u.session = urs.id; }
        uppdrag.push(u);
        await sparaUppdrag();
        return json(res, 200, { uppdrag: Uppdrag.sammandrag(u), id: u.id });
      } catch (e) {
        // Felet är användarens formulering, inte ett haveri. Det ska gå att
        // läsa och rätta.
        return json(res, 400, { error: e.message });
      }
    }

    // ── Läst och oläst ────────────────────────────────────────────────────
    //
    // Ett klick läser raden. Ett till ångrar. Samma gest båda hållen, ingen
    // dialog, ingen bock att sikta på, ingen bur man måste ta sig ur.
    //
    // `pa` skickas med av klienten så att gesten är ett SKIFTE och inte en
    // växel: två klick som hinner ikapp varandra ska inte ge motsatt svar.
    const mFynd = /^\/api\/agent\/fynd\/([\w-]+)\/sett$/.exec(vag);
    if (mFynd) {
      const f = fynd.find(x => x.id === mFynd[1]);
      if (!f) return json(res, 404, { error: tx('srv.fynd.finnsInte') });
      f.sett = kropp.pa !== false;
      // Uppdragets plupp slocknar när allt dess hittat är läst.
      const u = uppdrag.find(x => x.id === f.uppdrag);
      if (u) u.sett = !fynd.some(x => x.uppdrag === u.id && !x.sett);
      await sparaFynd();
      await sparaUppdrag();
      return json(res, 200, { sett: f.sett, osedda: fynd.filter(x => !x.sett).length });
    }

    // Allt läst på en gång. Den som varit borta en vecka ska inte behöva
    // klicka fyrtio gånger för att få bort pluppen.
    // Ett FÖRSLAG på profil, ur det du redan gjort.
    //
    // Föreslås, aldrig sätts. Den som får en färdig profil hon inte skrivit
    // vet inte vad agenten tror om henne, och då går det inte att förstå
    // varför den gör som den gör.
    //
    // Underlaget är rubriker och projektnamn — det du själv döpt saker
    // till, inte vad en modell tyckte om innehållet.
    // Skriv om appens exempel efter profilen.
    //
    // EN gång, och sedan sparat. Att be modellen om dem varje gång rummet
    // ritas vore tre sekunders väntan på en platshållare — och de skulle
    // byta lydelse mellan två besök, så att man aldrig lärde sig var något
    // stod.
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
          'Du skriver ett förslag på en kort profil åt en handläggare. Svara bara med JSON.',
          '',
          'Underlaget är vad hon själv döpt sina ärenden och projekt till.',
          'Gissa inte namn, arbetsplats eller något som inte står där.',
          '',
          f.underlag,
          '',
          `Svara med exakt: ${f.mall}`,
          'vem = hennes roll. arbetar = vad som ligger på hennes bord.',
          'vill = vad hon rimligen försöker uppnå. En kort mening var.',
        ].join('\n')), { plats: 'agent', tak: 400, timeout: 90000 });
        const d = Profil.lasForslag(svar);
        return json(res, 200, { forslag: d, underlag: f.underlag });
      } catch (e) {
        return json(res, 200, { forslag: null, skal: e.message });
      }
    }

    // Ångra städningen (Fas 41): allt i raden tillbaka, och agenten rör
    // dem inte igen. Bara det agenten själv arkiverat.
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
    // Provar att läsa Safaris främsta flik (Fas 46), innan reglaget slås på.
    // Öppnar din LinkedIn-profil i Safari (Auro 2026-10-06: "varför öppnar
    // den inte linkedin.com och går till profilsidan bara åt oss?").
    // linkedin.com/in/me/ leder den inloggade till sin egen profil. Maximus
    // öppnar en ny flik, väntar tills sidan är laddad, och säger var den
    // hamnade: profilen, eller inloggningen om du inte är inloggad.
    if (vag === '/api/safari/oppna-profil') {
      if (process.platform !== 'darwin') return json(res, 422, { error: tx('srv.safari.baraMac') });
      const as = (skript, timeout = 15000) => new Promise((klar, fel) => execFileCb('/usr/bin/osascript', ['-e', skript], { timeout },
        (e, o, err) => (e ? fel(new Error(String(err || e.message).trim().slice(0, 200))) : klar(String(o).trim()))));
      try {
        await as('tell application "Safari"\nactivate\nif (count of windows) = 0 then make new document\ntell front window to set current tab to (make new tab with properties {URL:"https://www.linkedin.com/in/me/"})\nend tell');
        let url = '', klar = '';
        // Högst ~15 s, sedan ett tydligt besked i stället för tystnad.
        for (let i = 0; i < 24; i++) {
          await new Promise(r => setTimeout(r, 500));
          url = await as('tell application "Safari" to return URL of current tab of front window').catch(() => '');
          klar = await as('tell application "Safari" to do JavaScript "document.readyState" in current tab of front window').catch(() => '');
          if (klar === 'complete' && url && !/\/in\/me\/?$/.test(url)) break;
        }
        // Profilsidan fyller på sitt innehåll efter "complete".
        await new Promise(r => setTimeout(r, 1200));
        if (klar !== 'complete') return json(res, 422, { error: tx('srv.safari.profilTimeout') });
        const s = await lasSafari();
        const profil = /linkedin\.com\/in\/(?!me\/?$)[^/?#]+/i.test(s.url);
        const inloggning = /login|authwall|checkpoint|signup/i.test(s.url);
        // Tillbaka till Maximus när profilen är läst (Auro 2026-10-06: "borde
        // ha hoppat tillbaka till maximus"). Vid inloggningen stannar Safari
        // framme — där ska du logga in. Safaris egen främsta flik är kvar, så
        // läsningen efteråt hittar profilen ändå.
        if (profil) execFileCb('/usr/bin/osascript', ['-e', 'tell application id "ai.aurolabs.maximus" to activate'], { timeout: 5000 }, () => {});
        return json(res, 200, { titel: s.titel || s.url, url: s.url, tecken: s.text.length, profil, inloggning });
      } catch (e) { return json(res, 422, { error: safariFel(e.message) }); }
    }
    if (vag === '/api/safari/prova') {
      try { const s = await lasSafari(); return json(res, 200, { titel: s.titel || s.url, url: s.url, tecken: s.text.length, profil: /linkedin\.com\/in\//i.test(s.url) }); }
      catch (e) { return json(res, 422, { error: e.message }); }
    }
    // Städa nu: samma regler, utan att vänta på nästa varv.
    // MAXIMUS_STADA_PROV=1 (bara prov): `nu` får flytta klockan framåt, så
    // att regeln om 30 dagar går att pröva utan att vänta 30 dagar.
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

    // Slå nu. Knappen finns för att man ska kunna prova att det fungerar
    // utan att vänta fem minuter på nästa slag.
    if (vag === '/api/agent/sla') {
      const hant = await slaHjarta();
      if (hant?.nej === 'behover') return behovSvar(res, hant.behov);
      if (hant?.nej === 'pagar') return json(res, 409, { error: tx('srv.agent.slagPagar') });
      if (hant?.nej === 'last') return json(res, 409, { error: tx('srv.fel.maximusLast') });
      return json(res, 200, { hant, osedda: fynd.filter(f => !f.sett).length });
    }

    // Ett uppdrag, nu. Samma varv som hjärtslaget, för just det här.
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
        // Sett betyder sett: också fynden, så att pluppen på Uppdrag och
        // raden i listan säger samma sak (Fas 40).
        uppdrag[i] = { ...uppdrag[i], sett: true };
        let andrat = false;
        for (const f of fynd) if (f.uppdrag === uppdrag[i].id && !f.sett) { f.sett = true; andrat = true; }
        if (andrat) await sparaFynd();
      }
      else {
        // Ändra: bara det du uttryckligen skickar, och takten hålls över
        // golvet. En sida får inte hämtas var femte minut hur någon än
        // skriver i rutan.
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
        // Dagar och klockslag i egna ord: "vardagar 8 och 15".
        if (typeof kropp.schemaText === 'string') {
          const sc = Schema.schemaUr(kropp.schemaText);
          if (!sc) return json(res, 422, { error: tx('srv.uppdrag.ingetKlockslag') });
          u.schema = sc; u.aterkommande = true;
          u.nasta = Schema.nastaTid(sc, new Date())?.toISOString() || null;
        }
        // En engångssökning blir en bevakning (Fas 30): samma fråga varje
        // dygn, och bara det som inte setts förut lyfts fram.
        // Jämförs mot det sparade: raden ovanför har redan satt aterkommande.
        if (kropp.aterkommande === true && !uppdrag[i].aterkommande) {
          u.aterkommande = true; u.takt = Math.max(u.takt || 1440, Uppdrag.minstaTakt(u.kallor), 1440);
          u.tillstand = 'vantar'; u.nasta = new Date(Date.now() + u.takt * 60000).toISOString();
        }
        // Jobb, privat eller båda (Fas 36).
        // Sedan 2026-10-10 också en egen etikett, som källorna bär ("styrelsen").
        if ('sfar' in kropp) u.sfar = Konton.etikettUr(kropp.sfar);
        // Källorna (Fas 35): vad uppdraget läser, valt i vyn. Bara det du gett
        // lov till; ett ämne och en sida behåller sina inställningar.
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
        // Ett ämnes källor (Fas 29): ta bort en, lägg till en adress.
        const amneK = u.kallor.find(k => k.typ === 'amne');
        if (amneK && Number.isInteger(kropp.kallaBort)) amneK.kallmangd = (amneK.kallmangd || []).filter((_, i) => i !== kropp.kallaBort);
        if (amneK && typeof kropp.kallaTill === 'string') {
          let url; try { url = new URL(kropp.kallaTill.trim()); } catch { return json(res, 422, { error: tx('srv.uppdrag.ingenAdress') }); }
          if (!/^https?:$/.test(url.protocol)) return json(res, 422, { error: tx('srv.uppdrag.httpAdress') });
          if (!(await tillatenAdress(url.href)).ok) return json(res, 422, { error: tx('srv.uppdrag.adressHamtasInte') });
          amneK.kallmangd = [...(amneK.kallmangd || []), { url: url.href, titel: url.hostname, vard: url.hostname.replace(/^www\./, ''), flode: null }];
        }
        if (amneK && kropp.kallorOm === true) amneK.kallmangd = [];
        // När något händer (Fas 27): "när Henrik mejlar". Sant eller falskt
        // går också; ett namn i texten blir filtret.
        if (typeof kropp.handelseText === 'string' || typeof kropp.handelse === 'boolean') {
          const ja = typeof kropp.handelse === 'boolean' ? kropp.handelse : (Schema.handelseUr(kropp.handelseText) || /\bnytt?\b|\bnew\b/i.test(kropp.handelseText));
          u.handelse = ja; if (ja) u.aterkommande = true;
          const f = typeof kropp.handelseText === 'string' ? Schema.filterUr(kropp.handelseText) : null;
          if (f) u.filter = { fran: [...new Set([...(u.filter?.fran || []), ...f.fran])], amne: [...new Set([...(u.filter?.amne || []), ...f.amne])] };
        }
        // Vad som alls läses: "från @kommun.example, ämnet innehåller "upphandling"".
        if (typeof kropp.filterText === 'string') {
          const f = Schema.filterUr(kropp.filterText);
          if (kropp.filterText.trim() && !f) return json(res, 422, { error: tx('srv.uppdrag.ingetFilter') });
          u.filter = f;
        }
        // Den som sätter när ett pausat uppdrag ska köra vill att det kör.
        // 2026-10-05 stod svaret "Nästa genomgång tisdag 08:00" medan
        // uppdraget låg pausat och aldrig skulle ha kört.
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

    // Svaret på en fråga om godkännande: ja eller nej till att söka.
    const mSvar = /^\/api\/sessioner\/([\w-]+)\/webbsvar$/.exec(vag);
    if (mSvar) {
      // Godkännandet gäller EN session, och den måste vara din.
      const s = minSession(mSvar[1], jag);
      if (!s) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });
      const v = vantande.get(String(kropp.tur || ''));
      if (!v || v.session !== s.id) {
        return json(res, 404, { error: tx('srv.webbsvar.vantarInte') });
      }
      v.svara(kropp.ja === true);
      return json(res, 200, { mottaget: true });
    }

    /// Artefakter: det samtalet producerat, som filer.
    ///
    /// Vem som bestämmer att en fil ska finnas: ANVÄNDAREN. MAXIMUS producerar
    /// inte dokument av sig självt, och modellen tillfrågas inte om saken.
    /// Du pekar på ett svar och säger vilket format du vill ha det i — och
    /// filen görs av reglerna i lib/kontor.mjs ur den text som redan står på
    /// skärmen.
    ///
    /// Det är inte försiktighet. En modell som ombeds "gör en tabell av det
    /// här" skriver en NY tabell, och då är det inte längre svaret man
    /// exporterar.
    const mArt = /^\/api\/sessioner\/([\w-]+)\/artefakter$/.exec(vag);
    if (mArt) {
      const s2 = await minSession(mArt[1], jag);
      if (!s2) return json(res, 404, { error: tx('srv.fel.sessionFinnsInte') });

      const sort = String(kropp.sort || '');
      if (!Artefakt.arSort(sort)) return json(res, 422, { error: tx('srv.artefakt.okantFormat') });

      // Texten: den tur man pekat på, annars den sista som har ett svar.
      const tur = kropp.tur
        ? (s2.turer || []).find(t => t.id === kropp.tur)
        : [...(s2.turer || [])].reverse().find(t => t.svar);
      if (!tur?.svar) return json(res, 422, { error: tx('srv.artefakt.ingetSvar') });

      // Utkastet om det finns, annars hela svaret. Den som bett om en text
      // har fått den i ett block, och det är den texten som ska bli filen —
      // inte resonemanget runt omkring.
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
          // Ett kalkylblad behöver en tabell. Finns ingen i svaret finns
          // ingenting att räkna på, och en tom bok vore en fil som ser ut
          // att vara något.
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

    /// Öppnar en fil i sitt program. Skalet laddar bara ned liggarens
    /// exporter, så en presentation eller ett Word-dokument gick inte att
    /// spara i appen alls (2026-10-04). Servern lägger filen i Hämtade filer
    /// och öppnar den — Keynote, PowerPoint, Word. Det är du som bett om
    /// filen, och den ligger där du ser den.
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
        // Namnet saneras igen här och sökvägen måste ligga i Hämtade filer.
        // Det sanerades när filen skapades, men en session kan komma utifrån
        // (en delning), och ett namn som "../../Library/…" får aldrig bli en
        // sökväg utanför mappen.
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

    /// Tar bort en artefakt. Hämtningen ligger på GET — se längre upp.
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

      // Kör om, eller skicka en redigerad fråga: turen och allt efter den
      // tas bort, och frågan ställs på nytt.
      //
      // Liggaren rörs inte. Den för bok över vad som FAKTISKT lämnat datorn,
      // och det gjorde det — att ett samtal ser annorlunda ut efteråt ändrar
      // inte historien. Kartan står också kvar: samma person ska behålla sin
      // platshållare genom hela samtalet, även de omkörda delarna.
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
        // Heliga sessioner (Fas 49) går bara med Rensa allt.
        if (s.helig) return json(res, 409, { error: tx('srv.grund.taBort') });
        const fel = await taBortSession(s);
        if (fel) {
          sandAlla({ typ: 'lista' });
          return json(res, 500, { error: tx('srv.session.filenKvar', { fel }) });
        }
        sandAlla({ typ: 'lista', agare: s.agare });
        return json(res, 200, { bort: true });
      }

      // Destinationen kommer ur SESSIONEN, inte ur anropet.
      //
      // Här stod `kropp.lokalt === true`. Klienten fick alltså bestämma om
      // frågan skulle lämna datorn — och den som skickar ett eget anrop
      // kunde sätta det till vad som helst, oberoende av vad sessionen
      // sagt. Samma sort som `kropp.forberedd` längre ned: en gräns den ena
      // sidan får beskriva åt den andra är ingen gräns.
      //
      // Klienten får fortfarande byta behandling — men då ändras sessionen,
      // synligt, och värdet prövas innan det sparas.
      const val = Behandling.vad(valet(s).behandling);
      // Kvar som namn för att resten av vägen läser det. Ingenting lämnar
      // datorn längre — se lib/behandling.mjs.
      const lokalt = true;
      const djup = kropp.djup === true;

      // Endast lokalt: ingen förberedelse behövs, för ingenting ska ut.
      //
      // Allt annat förbereds HÄR, på servern, och inte av webbvyn.
      //
      // Här stod `kropp.forberedd` — klientens objekt, rakt in. Servern tog
      // emot maskerad text, en karta och ett kvitto och litade på alltihop.
      // Revisionen 2026-09-28 byggde ett förberett objekt för hand med ett
      // namn i `maskerad` och såg det passera sändgränsen. En gräns som den
      // ena sidan kan beskriva åt den andra är ingen gräns.
      //
      // Grinden får däremot fortfarande redigeras — det är en riktig funktion
      // och den ska inte offras. Men en redigering kan bara TA BORT, aldrig
      // lägga tillbaka: texten körs genom serverns egen hårda maskering med
      // serverns egen karta innan den går vidare. Skriver någon in ett namn i
      // rutan maskeras det på nytt.
      //
      // Kartan, räknaren och fynden kommer alltid härifrån. De är svaret på
      // "vem är [NAMN A]", och det svaret får aldrig komma utifrån.
      let forberedd;
      if (lokalt) {
        forberedd = { original: String(kropp.fraga || '').trim(), maskerad: null, karta: [], nya: [], kvitto: [] };
        if (!forberedd.original) return json(res, 422, { error: tx('srv.fel.skrivFraga') });
      } else {
        const original = String(kropp.forberedd?.original || kropp.fraga || '').trim();
        if (!original) return json(res, 422, { error: tx('srv.fel.skrivFraga') });

        forberedd = await forbered(original, {
          karta: s.karta || [], raknare: s.raknare || {},
          // Tolkningen följer behandlingen, inte anropet.
          //
          // "Snabb" var regelstyrd maskering utan den lokala modellen och
          // "Noggrann" var med. Valet var i praktiken "vill du ha sämre
          // maskering för att slippa vänta" — inte en fråga en produkt ska
          // ställa om det som ska skyddas. Modellen går nu alltid när något
          // ska maskeras och den finns.
          sorter: galler(installningar), tolka: val.tolka,
        });

        // Användarens redigering i grinden, om den skiljer sig — genom
        // serverns maskering, med serverns karta.
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

      // "Maskera den här texten: …", "anonymisera bilagan" (Auro 2026-10-10):
      // en begäran om maskering görs här, lokalt, och går aldrig vidare till
      // modellen, webben eller molnet. Se maskeraPaBegaran(). Bara det du
      // skrivit själv — inte Maximus egna frågor och inte telefonens.
      const maskbegaran = kropp.av !== 'maximus' && kropp.franTelefonen !== true
        ? Maskbegaran.avsikt(forberedd.original) : null;
      if (maskbegaran) return maskeraPaBegaran(s, forberedd.original, maskbegaran, res);

      // Behandlingen gäller bara när en molnmodell svarar (Auro 2026-10-10).
      const gallerNu = behandlingNu(s);
      const tur = { id: randomUUID(), tid: new Date().toISOString(), status: 'igang',
        fraga: forberedd.original, maskerad: forberedd.maskerad,
        maskerat: lokalt ? 0 : (forberedd.funna || []).length, svar: '', frontier: null,
        tolka: val.tolka, lokalt, ...(gallerNu ? { behandling: gallerNu } : {}), webb: kropp.webb === true || kropp.webb === 'auto', anmarkningar: [], kvitto: [], kallor: [],
        // Frågor Maximus ställer själv (sammanfattningen av ett nytt
        // underlag). Ritas som Maximus replik med `sager`, inte som din.
        ...(kropp.av === 'maximus' ? { av: 'maximus', sager: String(kropp.sager || '').slice(0, 300) } : {}),
        // Från telefonen (granskningen 2026-10-09): en påminnelselista kan vara
        // delad, så vem som skrev går inte att veta. Texten är obetrodd: ingen
        // webb, inga uppdrag eller möten, och agentens verktyg i begränsat läge.
        // Flaggan kan bara göra en tur snävare, aldrig vidare.
        ...(kropp.franTelefonen === true ? { franTelefonen: true } : {}),
        // En fortsättning Maximus tog själv (Fas 44). Den fortsätter inte igen.
        ...(kropp.av === 'maximus' && kropp.fortsattning === true ? { fortsattning: true } : {}),
        // Stödraden sätts här, av regler, innan någon modell har svarat.
        stod: kris(forberedd.original) ? stod() : null,
        // Vilka bilagor som följde med just den här frågan. Utan
        // originaltexten — den ligger kvar i sessionens filer.
        bilagor: (s.filer || []).map(f => ({ id: f.id, namn: f.namn, sort: f.sort, dolda: f.dolda })) };
      // Kartan växer med sessionen och skrivs krypterat tillsammans med den.
      //
      // Bara när något faktiskt maskerats. I lokalt läge är kartan tom, och
      // en tom karta skriven över sessionens hade raderat varje platshållare
      // samtalet byggt upp — nästa fråga ut hade gett samma person en ny
      // bokstav.
      if (!lokalt) {
        s.karta = forberedd.karta;
        s.raknare = forberedd.raknare || s.raknare;
      }
      s.turer.push(tur);
      await spara(s);
      json(res, 202, { turId: tur.id, stod: tur.stod });

      const kontroll = new AbortController();
      korningar.set(s.id, kontroll);
      // Företrädet (punkt 10): det agenten har igång mot modellen avbryts.
      avbrytAgenten();
      sandAlla({ typ: 'lista', agare: s.agare });
      void (async () => {
        try {
          // ── En karta för hela turen ──────────────────────────────────
          //
          // Kartan är svaret på "vem är [NAMN A]". Den växte på tre ställen
          // och skrevs tillbaka på ett.
          //
          // Projektunderlaget maskerades mot `s.karta`, skrev tillbaka till
          // `s.karta` — och lämnade `forberedd.karta` orörd. Men det är
          // FÖRBEREDDAS karta som skicka() avmaskerar svaret med. Nya
          // platshållare som projektet skapade fanns alltså inte när svaret
          // skulle tolkas tillbaka, och [NAMN D] blev stående som [NAMN D]
          // i det användaren läser.
          //
          // Webbvägen fick kartan som en Map, la till i den när en sökfråga
          // maskerades, och kastade den sedan. Samma person kunde därmed få
          // en bokstav i sökrutan och en annan i frågan.
          //
          // Revisionen 2026-09-28 (M4) såg det första. Rättelsen är att det
          // finns EN karta, att alla tre skriver till den, och att både
          // sessionen och frågans objekt hålls i takt med den.
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

          // Underlaget agenten bifogade (Auro 2026-10-10: "den ena har
          // sammanhanget och den andra inte"). Följdfrågan efter ett fynd
          // eller en undersökning får originalen bakom korten — lästa lokalt
          // via referensen, beskurna mot frågan och inom stängslet — inte
          // bara rubrikerna i agentens lista. Se lib/underlag.mjs.
          const underlagKort = tur.av === 'maximus' || tur.franTelefonen ? [] : Underlag.senaste(s.turer).slice(0, 12);
          const underlagTexter = [];
          // Bara de kort som svarar mot frågan läses (högst fyra): ett brev i
          // Mail tar en stund, och tolv brev för en fråga om ett är tolv för många.
          const lasas = new Set(Underlag.forFragan(underlagKort, underlagKort.map(k => `${k.utdrag} ${k.reserv}`), forberedd.original).map(x => x.nr));
          // Samtidigt och med en tidsgräns (punkt 10): ett Mail som inte
          // svarar ska inte hålla frågan i tre minuter. Det som inte hann
          // läsas står med kortets egen text.
          underlagTexter.push(...await Underlag.lasManga(underlagKort, (k, i) => (lasas.has(i + 1) ? Underlag.lasHela(k, lasOriginal) : '')));

          // Långa samtal lokalt: de äldsta turerna sammanfattas i stället för
          // att kastas. Sammandraget ligger först i prompten och ändras
          // sällan, så modellservern kan återanvända det den redan räknat ut
          // — 0,9 sekunder i stället för 76 för ett samtal på 12 600 tokens.
          //
          // Frontier behöver det inte: där är kontexten tio gånger så stor,
          // och historiken maskeras om på vägen ut ändå.
          let sammandrag = s.sammandrag?.text || '';
          const minnesKvitto = [];
          // Turerna som inte rymdes ordagrant. De lever i sammandraget — men
          // sammandraget är generiskt, och en fråga om ett belopp ur tur 3 av
          // 40 hittar det inte i tolv punkter. Se lib/aterkall.mjs.
          let aterkallat = '';
          if (lokalt) {
            try {
              const tak = await kontextTak();
              // Plats kvar till historiken när instruktion, sammandrag,
              // bilagor, frågan och svaret har fått sitt.
              const budget = Math.max(2000, (tak - 2600) * 3
                - forberedd.original.length - sammandrag.length
                - (s.filer || []).reduce((n, f) => n + Math.min((f.original || '').length, 12000), 0));
              const { gamla, nya } = dela(historik, budget);

              // Pekar frågan på något i det som vek undan hämtas just den
              // turen tillbaka — sist, i frågans eget material, aldrig inne i
              // historiken. Inledningen måste stå still för att modellserverns
              // cache ska hålla: 0,9 sekunder i stället för 76.
              //
              // Reglerna och inte en modell: det här ligger i den varma vägen
              // före varje svar, och ett modellanrop till för att välja
              // vilken gammal tur som är intressant hade kostat mer än det
              // hämtade. Hittar reglerna inget hämtas inget, och då är läget
              // precis som förut.
              if (gamla.length) {
                aterkallat = hamtaTillbaka(gamla, forberedd.original);
                if (aterkallat) {
                  const n = (aterkallat.match(/^FRÅGA: /gm) || []).length || 1;
                  minnesKvitto.push({ aktor: tx('srv.kvitto.denHarDatorn'), lokalt: true, ms: 0,
                    vad: tx('srv.kvitto.hamtadeTillbaka', { n }) });
                }
              }
              // Ryms hela samtalet ordagrant behövs inget sammandrag. Det
              // gäller efter ett byte till ett större fönster: det som en
              // gång sammanfattats ska kunna bli ordagrant igen, annars
              // vore ett större minne bara ett löfte.
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
              // Går sammanfattningen inte att göra ska frågan ändå gå fram.
              // Budgeten i lokal.mjs kortar historiken hårt i stället.
              if (kontroll.signal.aborted) throw e;
              minnesKvitto.push({ aktor: tx('srv.kvitto.denHarDatorn'), lokalt: true, ms: 0, fel: true,
                vad: tx('srv.kvitto.kundeInteSammanfatta') });
            }
          }
          const minLiggare = p => liggare({ ...p, anvandare: jag?.id || null,
            anvandarnamn: jag?.namn || null, session: s.id });
          // Webben, när användaren bett om det.
          //
          // Sökfrågorna görs av den MASKERADE frågan: en sökruta är utgående
          // trafik, och det som lämnar datorn ska ha passerat grinden. Varje
          // sökning och varje hämtad sida hamnar i liggaren.
          // Informationsklassning, på originalet, innan något lämnat datorn.
          // Nivån avgör om en sökning får ske utan att fråga.
          // Klassen bärs av SAMTALET, inte av meningen.
          //
          // Mätt mot facit på 135 frågor: utan arv gick 43 frågor ut helt
          // utan grind fast de skulle haft nivå 2. "Vad händer om hon inte
          // öppnar dörren?" bär inget känsligt ord alls och handlar ändå om
          // en 82-årig kvinna med demens. Med arv: 1.
          const egen = klassaInfo(forberedd.original, { funna: forberedd.funna, rojning: forberedd.rojning });
          const burit = Math.max(0, ...(s.turer || []).map(t => t.klass?.niva || 0));
          const arvd = arvaKlass(egen.niva, burit, forberedd.original);
          const klass = arvd > egen.niva
            ? { ...NIVAER[arvd], niva: arvd,
                skal: [...egen.skal, tx('srv.klass.arvdNiva', { n: burit })] }
            : egen;
          tur.klass = klass;

          let underlag = '', kallor = [];
          // Av, på, eller automatiskt. I automatiskt läge avgör reglerna
          // först och den lokala modellen bara när reglerna tiger — och när
          // ingen av dem vet blir svaret nej. En sökning lämnar frågan
          // ifrån sig, och det ska inte ske på en gissning.
          // ── Texten som får gå ut, också när frågan stannar här ──────
          //
          // I "Stannar här" är `forberedd.maskerad` null: ingenting skulle
          // skickas, så ingenting maskerades. Men en WEBBSÖKNING skickas.
          // Varje `forberedd.maskerad || forberedd.original` nedanför föll
          // därför tillbaka på råtexten, och sökplaneraren fick frågan som
          // användaren skrev den.
          //
          // Sett skarpt 2026-09-29: `Ella Nordin Solgläntan Norrby`
          // och `Leyla Amin Solgläntan Norrby` gick till Brave, och
          // hitta.se hämtades för personen. Namngivna enskilda i ett
          // klagomålsärende — ur en session vars fotrad lovade att
          // ingenting lämnar datorn.
          //
          // "Stannar här" gäller svaret: det skrivs av den lokala modellen.
          // Det gäller inte en sökning, för en sökning ÄR en sändning. Då
          // ska den gå genom samma maskering som allt annat som lämnar
          // datorn, oavsett vad sessionen står på.
          //
          // Räknas bara när den behövs, och med regler — inte med modellen.
          // Reglerna tar millisekunder, och den här texten används bara om
          // något ska sökas.
          let utatCache = null;
          const utat = async () => {
            if (forberedd.maskerad) return forberedd.maskerad;
            if (utatCache === null) {
              const m = await forbered(forberedd.original, {
                karta: s.karta || [], raknare: s.raknare || {}, sorter: galler(installningar) });
              utatCache = m.maskerad;
              // Kartan som maskeringen byggde hör till samtalet.
              //
              // Den kastades: `utat()` maskerade frågan inför webbarbetet och
              // lät de nya platshållarna dö med anropet. Samma person kunde
              // därför få en bokstav i sökrutan och en annan i svaret.
              synka(m.karta, m.raknare);
            }
            return utatCache;
          };

          // ── En karta för hela webbarbetet ────────────────────────────
          //
          // Den skapades inne i den vanliga sökgrenen, men `synka()` kallades
          // i BÅDA grenarna. Djupsökningen kraschade därför med
          // `sokkarta is not defined` — efter att sökningen var gjord, så
          // hela det dyra arbetet gick förlorat på sista raden.
          //
          // En gång, här, delad av båda. Samma fel som bitit nio gånger i den
          // här koden: två ställen som ska hållas i takt, och bara det ena
          // uppdaterat.
          const sokkarta = new Map((s.karta || []).map(k => [k.original, k.platshallare]));
          const sokraknare = new Map(Object.entries(s.raknare || {}));

          // Ett nej i frågan väger tyngre än strömbrytaren.
          //
          // Webbsök är det enda som lämnar datorn. Stod det i frågan att
          // ingenting ska slås upp gäller det — också när webben står på PÅ
          // och också när en djupsökning är vald. De två vägarna gick förbi
          // behovsWebb() helt, och det var där nejet tappades bort: MAXIMUS
          // sökte på ett påhittat scenario som uttryckligen sa åt den att
          // låta bli (2026-10-01).
          //
          // Strömbrytaren är ett förval. Det du skriver i frågan är ett
          // beslut om just den frågan, och det är senare och mer bestämt.
          // En fråga om dina egna saker (Fas 31) besvaras av agentens verktyg
          // ur dina appar, inte av webben: "vad har jag för möten i morgon?"
          // gick förut ut som en sökning. En sökfråga om din kalender ska inte
          // lämna datorn.
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
            // Reglerna svarar på noll tid; tiger de kostar modellens
            // bedömning några sekunder, och då ska det synas att den pågår.
            sand(s.id, { typ: 'steg', turId: tur.id, steg: 'soker', text: tx('srv.steg.avgorWebb') });
            // Djupsökning är ett uttryckligt val. Då frågar MAXIMUS inte om
            // webben behövs — användaren har redan sagt det. (Ett nej i
            // frågan fångas ovan och kommer aldrig hit.)
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

          // Nivå två och tre frågar först, och frågan visar exakt vad som
          // skulle lämna datorn. Utan sökfrågorna vore godkännandet ett
          // löfte om något man inte sett.
          // Djupsökningen planeras alltid i förväg: varv ett ska visas, och
          // det som visas ska vara det som skickas.
          if (sokWebb && djup && !fragor?.length) {
            sand(s.id, { typ: 'steg', turId: tur.id, steg: 'planerar', text: tx('srv.steg.planerarDjup') });
            fragor = (await Djup.forbered(await utat(),
              { signal: kontroll.signal })).fragor;
          }

          if (sokWebb && kraverGodkannande(klass.niva)) {
            sand(s.id, { typ: 'steg', turId: tur.id, steg: 'planerar', text: tx('srv.steg.planerar') });
            // Historiken med, så att 'deras hemsida' kan lösas ut till vems.
            fragor = await planeraSok(await utat(),
              { signal: kontroll.signal, historik });
            // Klass 2 och 3: sökorden anonymiseras innan de ens visas. Det
            // som godkänns ska vara det som skickas, och det som skickas ska
            // inte gå att känna igen som ett bestämt ärende.
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
            // Djupsökning: flera varv, där varje varv söker på det förra
            // varvets luckor. Budgeten står i lib/djup.mjs och syns i
            // godkännandet — en sökning som kan pågå hur länge som helst är
            // en sökning som gör det.
            try {
              const u = await Djup.djupsok(await utat(), {
                signal: kontroll.signal, liggare: minLiggare, fragor,
                budget: Djup.budgetAv(installningar), historik,
                // Samma karta som den vanliga sökningen, och den skrivs
                // tillbaka nedanför.
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
              // Kartan skickas in och skrivs tillbaka. Sökfrågan kan skapa
              // nya platshållare, och de hör till samtalet — inte till
              // sökrutan. Den skapas ovanför, gemensamt med djupgrenen.
              const u = await slaUpp(await utat(), {
                signal: kontroll.signal, liggare: minLiggare, fragor, historik,
                // Något att köpa: fler sidor, och varan ur varje.
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

          // Kopplingarna. En källa kan ha uppgiften som webben bara skriver om:
          // frågar någon vad en paragraf säger är rätt svar lagtexten, inte en
          // sammanfattning på en advokatbyrås blogg.
          //
          // Samma grind som webben, för det är samma sak som händer — ett
          // nätanrop. Sa användaren nej till att lämna datorn gäller det här
          // också; en myndighets API är inte en del av datorn.
          // 'av' och false betyder samma sak. Gränssnittet skickar false, men
          // ett API-anrop kan skicka strängen, och `'av' !== false` hade
          // släppt igenom ett nätanrop som användaren sagt nej till.
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
                  // Det som godkänns ska vara det som skickas: källan och
                  // argumenten, inte verktygets namn.
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
                    // Underlaget byggs om från alla källor, så numren löper
                    // genom både webbträffar och kopplingar.
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

          // Projektminnet: vad som redan sagts i samma mapp.
          //
          // Läggs till som en bilaga och inte i frågan, för då går det genom
          // exakt samma väg som ett dokument man dragit in — urval, grind,
          // liggare. Originalet maskeras om mot sessionens egen karta: text
          // ur ett annat samtal maskerades en gång mot en annan karta, och
          // att lita på den vore att lita på att två kartor råkar stämma.
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

          // Minnet, när du bett om det. Samma väg som projektminnet: en
          // bilaga, ommaskerad mot den här sessionens karta, med ett kvitto
          // som säger vilka samtal som lästes.
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

          // Ett uppdrag i egna ord får en anvisning i själva frågan. Systemtexten
          // säger det redan, men modellen skrev ändå ut "Ja Nej" och
          // "/uppdrag" i svaret — knappar som inte gick att trycka på, under
          // ett förslag som redan stod där. Anvisningen står i frågan och inte
          // i systemblocket, som ska stå still.
          // Fas 52: en bevakning utan ämne får samtalets ämne, och ett svar
          // på ett förslag som ännu inte besvarats läses som dess ämne. Förut
          // sa assistenten "ja, agenten kan hålla koll" och inget kort kom.
          // Titeln är skriven av modellen, ofta ur en främmande sida: den får
          // bara bli ett ämne om den går genom rentAmne (lib/aterkommer.mjs).
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
          // Ett möte att lägga in. Modellen läser ut fälten, koden räknar
          // datumen och granskar, och SVARET skrivs av regler: det som står
          // är det som är gjort — förberett, inte inlagt. Förut skrev
          // modellen ett mejl som sa "Jag har lagt in mötet i kalendern"
          // när ingenting låg där (2026-10-04). Se lib/handelse.mjs.
          const handelse = tur.av !== 'maximus' && !tur.franTelefonen && Handelse.avsikt(forberedd.original)
            ? await Handelse.las(forberedd.original, { signal: kontroll.signal }).catch(() => null) : null;
          // Kalendern med samma etikett som underlaget (2026-10-10): ett möte
          // ur jobbmejlet föreslås i jobbkalendern. Kalender frågar ändå var
          // det ska ligga — Maximus skriver aldrig i kalendern.
          const kalendern = handelse ? Konton.kalenderMedEtikett(agentInst().kalender, (s.etiketter || [])[0]) : null;
          if (handelse) tur.handelse = { ...handelse, id: randomUUID(), gjort: {}, ...(kalendern ? { kalender: kalendern } : {}) };
          // En fråga om dina egna saker (Fas 31): agentslingan med verktygen
          // svarar, ur det den faktiskt läser. Modellen ensam vet ingenting
          // om din kalender. Stegen syns medan de görs, och kvittot säger vad
          // svaret bygger på.
          const medVerktyg = !handelse && !uppdragsavsikt && tur.av !== 'maximus' && !tur.bilagor?.length
            && (Boolean(s.agentsamtal) || Verktygsfraga.avsikt(forberedd.original));
          let slingsvar = null;
          if (medVerktyg) {
            const NAMN = Object.fromEntries(['mejl', 'kalender', 'lediga_tider', 'paminnelser', 'anteckningar', 'meddelanden', 'mapp', 'las_fil',
              'webbsok', 'las_sida', 'rakna', 'genvagar'].map(v => [v, tx(`srv.steg.verktyg.${v}`)]));
            NAMN.las_underlag = tx('srv.steg.verktyg.las_underlag');
            slingsvar = await agentSlinga({ uppgift: forberedd.original, session: s.id, tur: tur.id, signal: kontroll.signal, styrning: Boolean(s.agentsamtal) && !tur.franTelefonen, begransad: Boolean(tur.franTelefonen),
              // Din tur, du vid datorn (granskningen 2026-10-09). I ett vanligt
              // samtal följer webben samtalets och turens val: av är av, också
              // för sidor. I Agentens samtal är s.webb ett fast förval utan
              // reglage; där gäller agentens inställningar (webb, sidor).
              obevakad: false, webb: Boolean(s.agentsamtal) || !(kropp.webb === false || kropp.webb === 'av' || s.webb === 'av'),
              // I Agentens samtal: dina tidigare frågor, inte agentens långa
              // rapporter — fakta om vad den gjort hämtar vad_hande. Rapporterna
              // som sammanhang fick modellen att spåra ur (2026-10-05).
              sammanhang: [s.agentsamtal
                ? `${tx('srv.agentsamtal.sammanhang')}${historik.filter(h => h.fraga && !/^Agenten såg|^Uppdraget|^The agent saw|^The task/.test(h.fraga)).slice(-3).map(h => tx('srv.agentsamtal.tidigareFraga', { fraga: String(h.fraga).slice(0, 200) })).join('')}`
                : historik.slice(-3).map(h => tx('srv.slinga.historikRad', { fraga: String(h.fraga || '').slice(0, 300), svar: String(h.svar || '').slice(0, 400) })).join('\n'),
              Underlag.sammanhang(underlagKort, underlagTexter, { fraga: forberedd.original })].filter(Boolean).join('\n\n'),
              underlag: underlagKort,
              onSteg: st => sand(s.id, { typ: 'steg', turId: tur.id, steg: 'verktyg',
                text: st.verktyg === 'vagval' ? tx('srv.steg.vagval', { kort: st.kort }) : `${NAMN[st.verktyg] || st.verktyg}${st.fel ? tx('srv.steg.gickInte') : ''}`, ...(st.fel ? { fel: true } : {}) }),
            }).catch(e => ({ svar: tx('srv.slinga.komInteAt', { fel: e.message }), steg: [] }));
            sand(s.id, { typ: 'text', turId: tur.id, bit: slingsvar.svar });
          }
          // En väg, inte två. Den utgående grenen är borttagen.
          if (slingsvar?.handlingar?.length) tur.handlingar = slingsvar.handlingar.map(h => ({ ...h }));
          const r = slingsvar ? {
            svar: slingsvar.svar,
            kvitto: [{ tid: new Date().toISOString(), aktor: tx('srv.liggare.aktorAgenten'), lokalt: true, ms: 0,
              vad: slingsvar.steg.length ? tx('srv.kvitto.byggerPa', { verktyg: [...new Set(slingsvar.steg.filter(x => !x.fel).map(x => x.verktyg))].join(', ') || tx('srv.kvitto.ingaVerktyg') }) : tx('srv.kvitto.utanVerktyg') }],
            delar: [],
          } : handelse ? {
            // En rad; uppgifterna står i kortet under. Två listor med samma
            // innehåll var en för mycket.
            svar: tx('srv.handelse.forberett', { titel: handelse.titel, inbjudan: handelse.deltagare.length ? tx('srv.handelse.inbjudan') : '' })
              + (kalendern ? tx('srv.handelse.iKalendern', { kalender: kalendern.namn, etikett: Konton.etikettNamn(kalendern.etikett) }) : ''),
            kvitto: [{ tid: new Date().toISOString(), aktor: tx('srv.kvitto.lokalModell'), lokalt: true, ms: 0,
              vad: tx('srv.kvitto.handelse') }],
            delar: [],
          } : await lokaltSvar(tillModellen, {
                // Profilen gäller alltid (Fas 10). Den står sist i
                // systemblocket — se lib/lokal.mjs.
                profil: Profil.somText(installningar.profil),
                aterkallat,
                // Bilderna till modellen, om den kan se dem. Kan den inte
                // det skickas ingen: llama-server svarar med fel på en bild
                // den inte kan läsa, och ett fel är sämre än en avskrift.
                bilder: await serBilder()
                  ? (s.filer || []).filter(f => f.bild)
                      .slice(-3).map(f => ({ data: f.bild, typ: f.bildtyp }))
                  : null,
                signal: kontroll.signal, historik, sammandrag,
                // Sessionens röst, inte den nuvarande inställningen.
                //
                // Personan fryses när sessionen skapas. Byter man röst i
                // inställningarna ska ett pågående samtal inte byta ton mitt
                // i — och systemblocket ska stå still, annars räknas hela
                // samtalet om vid nästa fråga (se lib/persona.mjs).
                persona: s.persona || installningar.persona,
                bilagor: [...projektfiler, ...(s.filer || []), ...Underlag.bilagor(underlagKort, underlagTexter, { fraga: forberedd.original })], policy: installningar.policy, underlag,
                onSteg: h => sand(s.id, { typ: 'steg', turId: tur.id, ...h }),
                onDel: h => sand(s.id, { typ: 'del', turId: tur.id, ...h }),
                onText: (bit, del) => sand(s.id, { typ: 'text', turId: tur.id, bit, del }),
              });
          // Förslaget står under svaret. En rad i svaret som pekar på
          // `/uppdrag`, eller ett utkastblock runt hela svaret, säger något
          // annat än det som faktiskt händer — reglerna tar bort dem här, och
          // det slutliga svaret ersätter det strömmade när turen är klar.
          if (uppdragsavsikt && r?.svar) {
            r.svar = r.svar.replace(/^\s*```\w*\n([\s\S]*?)\n```\s*$/, '$1')
              .split('\n').filter(rad => !/\/uppdrag\b|^\s*(Ja\s+Nej|\[Ja\]|\[Nej\])\s*$/.test(rad)).join('\n').trim();
          }
          // Stämmer hänvisningarna? Ett svar med [1] och [2] ser kontrollerat
          // ut; numren är bara tecken tills någon sett efter. Idén är lånad
          // från Bastion, som hämtar tillbaka varje siffra den citerat —
          // här ligger källan redan i minnet, så det räcker att jämföra.
          const granskning = kallor.length && installningar.granskaCitat !== false
            ? Granska.granska(r.svar || '', kallor) : null;

          // Tal som ingen räknat ut.
          //
          // MAXIMUS räknar kolumnsummor, snitt och median i kod och skickar med
          // dem. Allt annat adderar modellen i huvudet. Sett skarpt:
          // totalsumman 1 366 050,75 stämde på öret — den var uträknad —
          // medan snittet per godkänd post blev 185 137,58 där det rätta är
          // 129 130,15, skrivet i fetstil utan gardering.
          //
          // Ett stort tal i svaret som inte står någonstans i underlaget är
          // ett tal modellen hittat på.
          // Frister i källorna. Läses ur LAGTEXTEN, inte ur svaret: modellen
          // kan skriva "du har tre veckor på dig" och ha fel, och en frist
          // som är fel är värre än ingen — den som tror sig ha tre veckor
          // slutar räkna dagar.
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

          Object.assign(tur, { status: 'klar', svar: r.svar, frontier: r.frontier, granskning,
            pahittade: pahittade.length ? pahittade : undefined,
            frister: fristforslag.length ? fristforslag.slice(0, 4) : undefined,
            aterstallda: r.aterstallda, anmarkningar: r.anmarkningar || [],
            // Det som lagts på turen under körningen först — projektets och
            // minnets "läste …". Raden skrev över dem: kvittot på vilka
            // samtal som lästes nådde aldrig användaren. Hittat i Fas 10,
            // 2026-10-03, när "minns mig" provades mot den riktiga modellen.
            klass, kvitto: [...(tur.kvitto || []), ...minnesKvitto, ...(kallor.length
              ? [{ aktor: tx('srv.kvitto.webben'), lokalt: false, ms: 0, vad: tx('srv.kvitto.kallorLasta', { n: kallor.length, vardar: kallor.map(k => k.vard).join(', ') }) }]
              : []), ...(r.kvitto || [])], delar: r.delar || [], kallor });
          // Namnet sätts på den MASKERADE frågan. Förut togs originalets
          // första 44 tecken, så ett personnummer i första frågan hamnade i
          // sidopanelen — synligt för var och en som gick förbi skärmen.
          // `dopt` betyder att någon skrivit namnet för hand. Då rör vi det
          // inte: ett namn man satt själv ska inte skrivas över av en modell.
          if (s.turer.length === 1 && !s.dopt) s.titel = Rubrik.avFragan(forberedd.maskerad || forberedd.original);
          await spara(s);
          sand(s.id, { typ: 'klar', turId: tur.id, tur, titel: s.titel });

          // Den riktiga rubriken skrivs av modellen efteråt, aldrig före: ett
          // namn i sidopanelen är inte värt en sekunds väntan på svaret.
          if (s.turer.length === 1 && !s.dopt) {
            Rubrik.rubrik(forberedd.maskerad || forberedd.original, r.svar, { signal: kontroll.signal })
              .then(async namn => {
                if (!namn || namn === s.titel || s.dopt) return;
                s.titel = namn;
                await spara(s);
                sand(s.id, { typ: 'titel', titel: namn });
              })
              .catch(() => { /* namnet från frågans ord står kvar */ });
          }

          // Återkommer det här? Då föreslås ett uppdrag, under svaret (Fas 11).
          //
          // En gång per samtal, aldrig i ett samtal som ska glömmas, och
          // bara när ämnet står i en fråga i ett annat av dina samtal — se
          // lib/aterkommer.mjs. Förslaget sparas på turen så att det står
          // kvar, med sitt svar, när samtalet öppnas igen.
          //
          // Bara i ett samtal som står på "Minns mig". Förslaget bygger på
          // vad du frågat i ANDRA samtal, och ett isolerat samtal ska inte
          // veta något om dem. Sagt 2026-10-04: "hur vet den det om båda
          // chattarna hade isolerat minne?" Av samma skäl räknas bara de
          // andra samtal som själva minns.
          //
          // Och bara frågor du skrivit själv. Maximus egen sammanfattning
          // ("Sammanfatta inspelningen …") stod i två samtal och blev ett
          // ämne du "frågat om" — "inspelningen".
          // Ett uppdrag i dina egna ord ("håll koll på AI-nyheter i min
          // inkorg") föreslås direkt, i vilket minnesläge som helst — det
          // läser inget annat samtal, bara det du nyss skrev. Se avsikt() i
          // lib/aterkommer.mjs.
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

          // Planen. Står ett datum i svaret där något ska hända, lägger
          // Maximus fram vad det kan göra: förbereda, samla i ett projekt,
          // påminna, lägga i kalendern. Se lib/planen.mjs. Ett datum som
          // redan föreslagits i samtalet föreslås inte igen.
          // Presentationen: filen byggs av svaret direkt, så att den som bad om
          // en presentation får en presentation — inte ett svar och en knapp.
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

          // Ett möte som redan förberetts behöver ingen plan om samma datum.
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

          // Följdfrågor. De skrivs av den lokala modellen, efter att svaret
          // är framme, och sparas inte: ett erbjudande i stunden är inte
          // innehåll. Den som tackar för sig får inga — se lib/delar.mjs.
          //
          // Inte när planen eller ett förslag på uppdrag redan säger vad som
          // kommer härnäst. Tre följdfrågor under en plan med egna frågor
          // var tre röster om samma sak (Auro 2026-10-04: "det blir lite
          // overload"). Planen läses först, följdfrågorna sedan.
          //
          // Samma anrop väger vem som har bollen (Fas 44, lib/bollen.mjs):
          // fortsätter Maximus själv, frågar den dig, eller tar agenten det?
          // Bollen sparas på turen; vägarna gör det inte.
          planen
            .then(n => (n || tur.uppdragsforslag || tur.handelse || presentation) ? null
              : efterSvaret(forberedd.original, r.svar, { signal: kontroll.signal, fortsattning: Boolean(tur.fortsattning) }))
            .then(async e => {
              if (!e) return;
              // Ur en nyhet: handlingarna först, sedan modellens förslag.
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

/// Servern öppnar appen. Den startar inte en server, den startar MAXIMUS.
///
/// `--tyst` låter bli, för proven som kör servern i bakgrunden.
/// Startar. Skrivbord på loopback och öppnar appen; annars där det sagts.
const tls = await granskaUppstart(K).catch(e => { console.error('\n' + e.message + '\n'); process.exit(1); });
const lyssnare = tls ? createServerTLS(tls, server.listeners('request')[0]) : server;

/// Ett obevakat löfte tar ner Node, och därmed hela MAXIMUS.
///
/// Sett skarpt 2026-09-25: liggaren skrevs utan tidsstämpel från en
/// webbsökning, kastade, och ingen väntade in anropet. Servern dog mitt i
/// ett svar. En loggning som misslyckas ska synas i terminalen och ingenting
/// annat — det som pågår ska fortsätta pågå.
const nu = () => new Date().toLocaleString('sv-SE');

process.on('unhandledRejection', fel => {
  console.error(`  ⚠ obevakat fel ${nu()}:`, fel?.stack || fel?.message || fel);
});

/// Detsamma för ett kast utanför en begäran. Node tar annars ner processen
/// direkt, och en lokal app som försvinner mitt i ett samtal är värre än en
/// app som fortsätter med ett fel i loggen. Stacken skrivs ut hel: när det
/// här händer är den enda chansen att förstå det.
process.on('uncaughtException', fel => {
  console.error(`  ⚠ ofångat kast ${nu()}:`, fel?.stack || fel);
});

/// Och när den ändå går ner ska det synas vad som tog den. En server som dör
/// tyst kostade en eftermiddags felsökning.
// En signal stänger som allt annat: låset, sedan modellen. Förut avslutade
// SIGTERM processen direkt, och modellen blev kvar utan förälder under ett
// lease hos schemaläggaren. Sett 2026-10-05: varje omstart av servern lämnade en
// modell på 7 GB efter sig. Tio sekunder; hänger nedstängningen går vi ändå.
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
  // Adressen skrivs utan nyckeln (granskningen 2026-10-09). Utskriften hamnar
  // i server.log, och loggen bifogas felrapporter och kopieras av backuper —
  // en nyckel som aldrig byts ska inte ligga där. Den som startat servern
  // från en terminal läser nyckeln ur filen.
  for (const a of adr) console.log(`  ${a}`);
  if (!IDENTITET) console.log(`  nyckeln: ${nyckelfil} (läggs till som /?n=<nyckel>)`);

  await utokning?.startlogg?.();

  if (!IDENTITET && !K.tyst) {
    const { fil, argument } = oppnaKommando(adr[0]);
    spawn(fil, argument, { stdio: 'ignore', detached: true }).unref();
  }

  // Modellen är MAXIMUS:s ansvar, inte en förutsättning MAXIMUS hoppas på.
  //
  // Den kan ligga uppe åt ett annat program, och när det programmet slutar
  // använda den försvinner grinden mitt i ett samtal utan att något säger
  // till. Därför en titt varje minut. En modell som pekats ut utifrån med
  // --modell startar MAXIMUS inte — den tillhör kundens drift.
  let laddar = false;
  const seEfterModellen = async (forsta = false) => {
    if (laddar || modellAvstangd) return;
    // Valdes molnet i starten finns ingen lokal modell att väcka (Fas 51).
    if (molnPa() && installningar.modellval?.tanker === 'moln') return;
    if (!forsta && await grindSvarar()) return;
    laddar = true;
    try {
      const r = await sakerstallModell({ onSteg: h => console.log(`  ${h.text}…`) });
      console.log(`  lokal modell: ${r.url}${r.redan ? '' : ' (startad av MAXIMUS)'}`);
      sandAlla({ typ: 'modell', uppe: true, url: r.url, egen: !r.redan });
      // Vakten startar modellen i bakgrunden, och då ska platserna värmas
      // där också — annars betalar den första frågan notan ändå.
      varmPlatser({ url: r.url, prompter: VARMA }).catch(() => {});
    } catch (e) {
      console.log(`  ⚠ lokal modell: ${e.message}`);
      sandAlla({ typ: 'modell', uppe: false });
    } finally { laddar = false; }
  };
  // I bakgrunden utan fönster (Fas 26) hålls modellen inte i minnet för
  // ingenting: den laddas när ett varv behöver den (modellForAgenten) eller
  // när fönstret ansluter, och släpps efter en kvart utan fönster och utan
  // varv. Med fönster gäller vakten som förut.
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
