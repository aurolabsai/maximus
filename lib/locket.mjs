/// Locket: Maximus stängs, inte skärmen.
///
/// Begärt som en skärmsläckare. Men en skärm över innehållet är teater — den
/// som stänger locket lämnar datorn, och då ska nyckeln vara ur minnet, inte
/// bakom en bild. Locket kallar därför maximus.las_(): huvudnyckeln försvinner,
/// sessionerna töms, och det som ligger på disken är krypterat igen.
///
/// ── Varför koden inte härleder nyckeln direkt ─────────────────────────────
///
/// En sexsiffrig kod är en miljon möjligheter. Tjugo bitar. Ett lösenord på
/// åtta tecken är hundratusentals gånger fler.
///
/// Lät vi koden härleda huvudnyckeln vore Maximuss styrka därmed sänkt till
/// kodens, för alltid — också för den som satt ett långt lösenord. Det vore
/// att ta bort ett skydd och kalla det en bekvämlighet.
///
/// Alltså packar koden IN nyckeln i stället. Huvudnyckeln krypteras med en
/// nyckel härledd ur koden, och kuvertet ligger bredvid låsfilen. Koden
/// öppnar kuvertet; lösenordet öppnar Maximus. Två vägar till samma nyckel,
/// och den svagare vägen går att stänga.
///
/// ── Vad koden skyddar mot, och vad den inte gör ──────────────────────────
///
/// Den skyddar mot en människa vid tangentbordet. Den skyddar inte en
/// kopierad datamapp.
///
/// Revisionen 2026-09-29 (H4) kopierade lockfilen, gjorde tio fel online tills
/// livekuvertet revs, och öppnade sedan kopian med samma PIN. Den återvunna
/// huvudnyckeln var identisk. Att radera livekuvertet kan inte radera någon
/// annans kopia, och räknaren nedanför gäller bara den här processen.
///
/// Sex siffror är en miljon möjligheter. scrypt gör varje gissning dyr, men
/// "dyr" är millisekunder, och den som har filen har all tid i världen.
///
/// Det här går inte att laga med mer kod här — det följer av att kuvertet
/// ligger på disken och att nyckeln som öppnar det har tjugo bitars entropi.
/// Alltså sägs det rakt ut i gränssnittet i stället: koden är ett
/// bekvämlighetslås, och det är LÖSENORDET som skyddar en kopia.
///
/// ── Varför försöken räknas ────────────────────────────────────────────────
///
/// En miljon gissningar är inget för en dator. scrypt gör varje gissning dyr
/// — men "dyr" är millisekunder, och en miljon millisekunder är en kväll.
///
/// En telefon klarar en fyrsiffrig kod därför att kretsen räknar försöken och
/// låser sig. Vi har ingen sådan krets, så räkningen måste göras här: efter
/// ett antal fel RIVS kuvertet. Koden slutar fungera och bara lösenordet — det
/// riktiga skyddet — öppnar Maximus.
///
/// Det betyder att den som glömt sin kod måste kunna sitt lösenord, och det
/// ska stå i gränssnittet innan någon sätter en kod. Ett lås som överraskar
/// sin ägare är ett dåligt lås.
///
/// ── Återställningsfrågan ──────────────────────────────────────────────────
///
/// Samma konstruktion: svaret packar in samma nyckel i ett andra kuvert. Det
/// är INTE en genväg förbi koden — det går inte att svara sig förbi något,
/// bara att öppna samma sak på ett annat sätt.
///
/// Men svaret på "vad hette ditt första husdjur" har sällan mer än femton
/// bitars entropi, och ofta mindre: det är ett vanligt djurnamn, ibland något
/// någon annan känner till. Frågan är alltså den svagaste vägen in, och då är
/// det den som avgör hur säkert Maximus är.
///
/// Därför: samma försöksräkning, och gränssnittet säger rakt ut att frågan är
/// svagare än koden. Den som vill ha en hederlig reservväg ska använda sitt
/// lösenord.
///
/// ── Nyckelringen måste också glömmas ──────────────────────────────────────
///
/// Det här är vad som avgör om locket betyder något.
///
/// Maximus sparar som förval huvudnyckeln i macOS login-nyckelring, så att den
/// som öppnar appen i maj slipper minnas vad hon skrev i mars. Kommentaren i
/// lib/maximus.mjs säger rakt ut vad det kostar: en osignerad process som kör som
/// samma användare läser den posten utan att någon prompt visas.
///
/// Stängde locket bara av skärmen och tömde minnet, låg nyckeln alltså kvar i
/// nyckelringen och vem som helst med tillgång till den inloggade datorn
/// kunde hämta den. Det är precis den situationen locket finns för.
///
/// Alltså: att sätta locket glömmer nyckelringen, och att öppna det lägger
/// tillbaka nyckeln om användaren vill bli ihågkommen. Kodkuvertet ERSÄTTER
/// nyckelringen som bekvämlighet — och till skillnad från nyckelringen kräver
/// kuvertet något användaren vet, och räknar försöken.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tx } from './sprakstod.mjs';

const scrypt = promisify(scryptCb);
const FIL = 'locket.json';

/// Hur många gissningar en väg tål innan den rivs.
///
/// Tio är inte en avvägning mellan bekvämlighet och säkerhet — det är vad som
/// får en miljon möjligheter att räcka. Den som skriver fel tio gånger i rad
/// skriver inte fel; någon annan gissar.
export const FORSOK = 10;

/// Kostnaden per gissning.
///
/// Samma parametrar som Maximuss lösenord. En kod är kortare och behöver
/// därför MER kostnad per gissning, inte mindre — men kostnaden betalas också
/// av den som skriver rätt, varje gång hon låser upp. 2^16 landar på strax
/// under en sekund på en M1, vilket är vad en människa tål och vad en
/// gissningsmaskin inte gör en miljon gånger.
const KOSTNAD = { N: 2 ** 16, r: 8, p: 1, maxmem: 128 * 2 ** 16 * 8 * 2 };

const nyckelUr = (hemlighet, salt) =>
  scrypt(String(hemlighet).normalize('NFKC'), salt, 32, KOSTNAD);

/// Koden: sex siffror, och inget annat.
///
/// Inte "minst sex" — exakt sex. En kod som får vara olika lång är en kod där
/// längden avslöjar något, och sex är vad locket lovar.
export function granskaKod(kod) {
  const k = String(kod ?? '').trim();
  if (!/^\d{6}$/.test(k)) return { ok: false, varfor: tx('lib.locket.sexSiffror') };
  // Trivialt gissade koder. Inte en fullständig lista — ett hinder, inte en
  // spärr, och det ska sägas som det är.
  if (/^(\d)\1{5}$/.test(k)) return { ok: false, varfor: tx('lib.locket.sammaSiffra') };
  if ('0123456789'.includes(k) || '9876543210'.includes(k)) {
    return { ok: false, varfor: tx('lib.locket.iRad') };
  }
  return { ok: true };
}

/// Svaret på återställningsfrågan.
///
/// Städas hårt innan det används: gemener, trimmat, kollapsade mellanslag.
/// Den som svarar "Fido" i maj ska komma in med "fido " i september —
/// annars är reservvägen en fälla i stället för en väg.
export const stadaSvar = svar => String(svar ?? '')
  .normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

const vag = dataDir => join(dataDir, FIL);

export async function las(dataDir) {
  try { return JSON.parse(await readFile(vag(dataDir), 'utf8')); }
  catch { return null; }
}

async function skriv(dataDir, d) {
  await writeFile(vag(dataDir), JSON.stringify(d, null, 1), { mode: 0o600 });
}

/// Vad gränssnittet får veta utan att något låses upp.
///
/// Aldrig kuverten, aldrig salterna. Bara vad som finns och hur många försök
/// som återstår — den som ska skriva en kod ska veta vad som står på spel.
export function lage(d) {
  if (!d) return { pa: false };
  return {
    pa: true,
    fraga: d.fraga || null,
    harSvar: Boolean(d.svarkuvert),
    forsokKvar: Math.max(0, FORSOK - (d.fel || 0)),
    svarForsokKvar: d.svarkuvert ? Math.max(0, FORSOK - (d.svarfel || 0)) : 0,
    efter: d.efter ?? null,
  };
}

/// Sätter locket: packar in huvudnyckeln med koden, och med svaret om ett
/// sådant getts.
export async function satt(dataDir, huvudnyckel, { kod, fraga = null, svar = null, efter = null }) {
  if (!Buffer.isBuffer(huvudnyckel) || huvudnyckel.length !== 32) {
    throw new Error(tx('lib.locket.upplast'));
  }
  const g = granskaKod(kod);
  if (!g.ok) throw new Error(g.varfor);

  const { forsegla } = await import('./krypto.mjs');
  const salt = randomBytes(16);
  const kn = await nyckelUr(kod, salt);

  const d = {
    v: 1,
    salt: salt.toString('base64'),
    kuvert: forsegla(huvudnyckel.toString('base64'), kn).toString('base64'),
    fel: 0,
    efter: efter ?? null,
    skapad: new Date().toISOString(),
  };

  // Återställningsfrågan, om den valts. Samma nyckel, andra kuvertet.
  if (fraga && svar) {
    const s = stadaSvar(svar);
    if (s.length < 3) throw new Error(tx('lib.locket.kortSvar'));
    const svarSalt = randomBytes(16);
    d.fraga = String(fraga).trim().slice(0, 120);
    d.svarsalt = svarSalt.toString('base64');
    d.svarkuvert = forsegla(huvudnyckel.toString('base64'), await nyckelUr(s, svarSalt)).toString('base64');
    d.svarfel = 0;
  }

  await skriv(dataDir, d);
  return lage(d);
}

/// Öppnar locket med koden, eller med svaret på frågan.
///
/// Ger tillbaka huvudnyckeln. Fel gissning räknas, och när försöken är slut
/// rivs den vägen — inte Maximus. Lösenordet öppnar alltid.
/// Försöken serialiseras.
///
/// Läs–ändra–skriv utan lås är inget lås. Revisionen 2026-09-29 (H4) körde
/// fyra samtidiga felgissningar och fick den lagrade räknaren till **1**, inte
/// 4: alla fyra läste samma fil innan någon hann skriva.
///
/// Det gör tiogränsen till en gräns man går runt genom att fråga fler gånger
/// samtidigt — alltså ingen gräns. Och hela PIN-koden vilar på att tio är
/// tio: sex siffror är en miljon, och en miljon parallella gissningar är
/// inget arbete alls.
///
/// En kedja av löften räcker här. Processen är en, och ett lås mellan
/// processer skulle inte hjälpa mot den som ändå kan läsa filen — se
/// filhuvudet om vad PIN-koden är och inte är.
let ko = Promise.resolve();
const iTur = uppgift => {
  const mitt = ko.then(uppgift, uppgift);
  // Kön får inte dö av ett avvisat löfte: nästa försök ska köras oavsett hur
  // det förra gick.
  ko = mitt.then(() => {}, () => {});
  return mitt;
};

export async function oppna(dataDir, val = {}) {
  return iTur(() => oppnaNu(dataDir, val));
}

async function oppnaNu(dataDir, { kod = null, svar = null } = {}) {
  const d = await las(dataDir);
  if (!d) throw new Error(tx('lib.locket.ingetLock'));
  const { oppna: oppnaKuvert } = await import('./krypto.mjs');

  const medSvar = svar != null;
  const kuvert = medSvar ? d.svarkuvert : d.kuvert;
  const salt = medSvar ? d.svarsalt : d.salt;
  const felfalt = medSvar ? 'svarfel' : 'fel';

  if (!kuvert) {
    throw new Error(medSvar
      ? tx('lib.locket.ingenFraga')
      : tx('lib.locket.kodenFungerarInte'));
  }
  if ((d[felfalt] || 0) >= FORSOK) {
    throw new Error(tx('lib.locket.forManga'));
  }

  const n = await nyckelUr(medSvar ? stadaSvar(svar) : String(kod ?? ''), Buffer.from(salt, 'base64'));
  // Kuvertet innehåller nyckeln som base64, inte som bytes: krypto.oppna()
  // lämnar tillbaka en UTF8-sträng, och råa nyckelbytes överlever inte den
  // vändan — hälften av dem är inga giltiga tecken.
  let nyckel = null;
  try { nyckel = Buffer.from(oppnaKuvert(Buffer.from(kuvert, 'base64'), n), 'base64'); }
  catch { nyckel = null; }

  if (!nyckel || nyckel.length !== 32) {
    // Fel gissning. Räkna, och riv vägen när den är förbrukad.
    //
    // Kuvertet raderas, inte Maximus. Den som glömt sin kod har fortfarande
    // sitt lösenord — och den som gissar har inget kvar att gissa på.
    d[felfalt] = (d[felfalt] || 0) + 1;
    const slut = d[felfalt] >= FORSOK;
    if (slut) {
      if (medSvar) { delete d.svarkuvert; delete d.svarsalt; delete d.fraga; }
      else { delete d.kuvert; delete d.salt; }
    }
    await skriv(dataDir, d);
    const kvar = Math.max(0, FORSOK - d[felfalt]);
    const e = new Error(slut
      ? tx('lib.locket.stangd')
      : tx(medSvar ? 'lib.locket.felSvar' : 'lib.locket.felKod', { n: kvar }));
    e.forsokKvar = kvar;
    throw e;
  }

  // Rätt. Räknaren nollställs — tre fel i går ska inte straffa den som minns
  // rätt idag.
  if (d[felfalt]) { d[felfalt] = 0; await skriv(dataDir, d); }
  return nyckel;
}

/// Tar bort locket helt.
export async function tabort(dataDir) {
  await unlink(vag(dataDir)).catch(() => {});
}

/// Jämför två kontrollvärden utan att läcka var de skiljer sig.
export const lika = (a, b) =>
  Buffer.isBuffer(a) && Buffer.isBuffer(b) && a.length === b.length && timingSafeEqual(a, b);
