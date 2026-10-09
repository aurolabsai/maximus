/// Modellerna MAXIMUS kan hämta, och vilken av dem den här datorn ska ha.
///
/// Hela poängen med MAXIMUS är att modellen körs här. Då måste den också komma
/// hit, och den som installerar ska inte behöva veta vad en GGUF är, vilken
/// kvantisering som är rätt eller hur mycket minne en 26B behöver. Datorn vet
/// redan hur mycket minne den har. Frågan är ställd och besvarad innan någon
/// hinner undra.
///
/// Allt i katalogen är apache-2.0 och öppet hos Google — ingen inloggning,
/// ingen licensgrind, inget konto. Kontrollerat 2026-09-25 mot Hugging Faces
/// API: `gated: false` på alla fem. Det är ett krav, inte en tillfällighet:
/// en installation som kräver ett konto hos tredje part är ingen turn-key.

import { createHash } from 'node:crypto';
import { tx } from './sprakstod.mjs';
import { createWriteStream } from 'node:fs';
import { mkdir, stat, rename, unlink, readdir } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';
import os from 'node:os';
import { statfs } from 'node:fs/promises';
import { datakatalog } from './plattform.mjs';

const VARD = 'https://huggingface.co';

/// Stegen, från minsta till största.
///
/// `minne` är hur mycket RAM datorn måste ha för att modellen ska vara ett
/// rimligt val — inte hur stor filen är. Mätt 2026-09-25 på 12B:an: filen är
/// 6,5 GB, men processen håller 7,2–9,8 GB när kontexten är uppe och
/// platserna är tre. Tumregeln blir filen gånger två, plus plats för allt
/// annat datorn ska göra samtidigt.
///
/// `niva` är vad modellen heter i gränssnittet: Bas, Pro, Max.
///
/// "Gemma 4 E4B QAT q4_0" säger ingenting till den som ska välja. Den som vill
/// veta får se det riktiga namnet i finstilt under, och skälet när hon hovrar
/// — men valet ska gå att göra på tre ord.
///
/// De två största har ingen nivå. De är oprövade och hör hemma under "fler
/// modeller", inte i en stege som påstår att de är nästa steg upp.
///
/// `varfor` är den meningen: varför just den här, på just den här datorn.
///
/// `provad` är om MAXIMUS är utprovad på modellen — omdömesbänken i
/// test/omdome.mjs, maskeringen, krisdetektionen, svarslängden. Bara en
/// provad modell väljs automatiskt. De större finns att välja, och sägs vara
/// vad de är: mer kunskap, oprövat omdöme.
///
/// Det är inte försiktighet för sakens skull. Jan-v3-4B dömde rätt och skrev
/// fel — moraliserade, satte betyg i fetstil — och det syntes först när någon
/// ställde en känslig fråga. En modell som ingen provat på svenska
/// myndighetsärenden är ett löfte, inte en egenskap.
/// Katalogen är inte en rangordning av ett hus.
///
/// Den bestod av fem Gemma-modeller, och gränssnittet skrev ut "Google" på
/// varje rad — bokstavligen hårdkodat. Det är en produkt som säger sig låta
/// användaren äga sin egen modell och sedan bara erbjuder en leverantörs.
///
/// Nu finns minst tre alternativ per minnesnivå, från olika hus och under
/// olika licenser. Varje post är hämtad ur HuggingFaces eget API — filnamn,
/// storlek och sha256 — och aldrig skriven på gissning. En påhittad hash är
/// en nedladdning som faller vid verifieringen hos användaren.
///
/// `provad` skiljer det MAXIMUS mätt från det MAXIMUS bara erbjuder. Gemma 12B och
/// E4B är körda mot omdömesbänken; de andra är inte det, och då ska det stå.
/// Att rekommendera efter minne är inte samma sak som att gå i god för ett
/// omdöme, och de två får inte se likadana ut.
///
/// `mmproj.rev` och `mmproj.sha256` (granskningen 2026-10-09): projektorn
/// hämtades från `resolve/main` och kontrollerades bara på storlek. En fil
/// med samma storlek är lätt att göra, och den tolkas av C-kod i
/// llama-server. Nu hämtas den från en fast commit och räknas mot sha256 ur
/// Hugging Faces LFS-register (api/models/<repo>/tree/<rev>, läst
/// 2026-10-09). Google publicerar alltså visst en summa — den står där.
export const KATALOG = [
  {
    id: 'e2b',
    niva: 'Bas',
    get varfor() { return tx('lib.modeller.e2b.varfor'); },
    namn: 'Gemma 4 E2B',
    hus: 'Google',
    licens: 'Gemma',
    repo: 'google/gemma-4-E2B-it-qat-q4_0-gguf',
    mmproj: { fil: 'gemma-4-E2B-it-mmproj.gguf', byte: 986833664, rev: '675cff42a74c774d6cb76f76d8eacb49b48c9b93',
      sha256: '021059cce659fe7f9170d5599761d7bbaf644b798dab9503aca30dc43e6beb14' },
    fil: 'gemma-4-E2B_q4_0-it.gguf',
    byte: 3349516256,
    sha256: 'fa401b55b07ee70a54c6dae3903c783a6e65064312529ea57175cb5f8dec6634',
    minne: 8,
    provad: false,
    get om() { return tx('lib.modeller.e2b.om'); },
  },
  {
    id: 'e4b',
    niva: 'Pro',
    get varfor() { return tx('lib.modeller.e4b.varfor'); },
    namn: 'Gemma 4 E4B',
    hus: 'Google',
    licens: 'Gemma',
    repo: 'google/gemma-4-E4B-it-qat-q4_0-gguf',
    mmproj: { fil: 'gemma-4-E4B-it-mmproj.gguf', byte: 991552256, rev: '4b4a2c1d584be7264f87aac328a1bc739ce81b6c',
      sha256: '7498a37cb619e55f2fcf87eb931f56e99389ed6d432e4c5c66110694c0d65578' },
    fil: 'gemma-4-E4B_q4_0-it.gguf',
    byte: 5154941280,
    sha256: '676c35070db6dbe52f93e9c864ee0fba4eddea94b9c875d9cb10daff453fbaee',
    minne: 16,
    provad: true,
    get matt() { return tx('lib.modeller.e4b.matt'); },
    get om() { return tx('lib.modeller.e4b.om'); },
  },
  {
    id: '12b',
    niva: 'Max',
    get varfor() { return tx('lib.modeller.12b.varfor'); },
    namn: 'Gemma 4 12B',
    hus: 'Google',
    licens: 'Gemma',
    repo: 'google/gemma-4-12B-it-qat-q4_0-gguf',
    mmproj: { fil: 'mmproj-gemma-4-12b-it-qat-q4_0.gguf', byte: 175115616, rev: '29d097773436b69ff9feafd636ab4cf873786537',
      sha256: 'cb018338a7538a9814d994bfe54644c71eb7ed54e31eae2f721e45fd3c260da7' },
    fil: 'gemma-4-12b-it-qat-q4_0.gguf',
    byte: 6975879296,
    sha256: '93567e57a8fe10b23569b9d9ec38cd005deedf71e29477c421a4b83f418a538b',
    minne: 24,
    provad: true,
    get matt() { return tx('lib.modeller.12b.matt'); },
    get om() { return tx('lib.modeller.12b.om'); },
  },
  {
    id: '26b',
    niva: null,
    get varfor() { return tx('lib.modeller.26b.varfor'); },
    namn: 'Gemma 4 26B A4B',
    hus: 'Google',
    licens: 'Gemma',
    repo: 'google/gemma-4-26B-A4B-it-qat-q4_0-gguf',
    mmproj: { fil: 'gemma-4-26B-it-mmproj.gguf', byte: 1194828160, rev: 'd1c082be9cf3c8a514acf63b8761f4b41935842e',
      sha256: 'a359953a076b877db30c31dbbb4c6d93b4a6e017ee5db5784247e4d4c0dd4f3b' },
    fil: 'gemma-4-26B_q4_0-it.gguf',
    byte: 14439363584,
    sha256: '3eca3b8f6d7baf218a7dd6bba5fb59a56ee25fe2d567b6f5f589b4f697eca51d',
    minne: 48,
    provad: false,
    get om() { return tx('lib.modeller.26b.om'); },
  },
  {
    id: '31b',
    niva: null,
    get varfor() { return tx('lib.modeller.31b.varfor'); },
    namn: 'Gemma 4 31B',
    hus: 'Google',
    licens: 'Gemma',
    repo: 'google/gemma-4-31B-it-qat-q4_0-gguf',
    fil: 'gemma-4-31B_q4_0-it.gguf',
    byte: 17651001568,
    sha256: '179cfb99212709597eae5929112cfca677e1bbf566178b479ae1da0c4772874b',
    minne: 64,
    provad: false,
    get om() { return tx('lib.modeller.31b.om'); },
  },
  {
    id: 'qwen3-4b',
    niva: 'Bas',
    get varfor() { return tx('lib.modeller.qwen3-4b.varfor'); },
    namn: 'Qwen3 4B',
    hus: 'Alibaba',
    licens: 'Apache 2.0',
    repo: 'Qwen/Qwen3-4B-GGUF',
    fil: 'Qwen3-4B-Q4_K_M.gguf',
    byte: 2497280256,
    sha256: '7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5',
    minne: 8,
    provad: false,
    get om() { return tx('lib.modeller.qwen3-4b.om'); },
  },
  {
    id: 'llama32-3b',
    niva: 'Bas',
    get varfor() { return tx('lib.modeller.llama32-3b.varfor'); },
    namn: 'Llama 3.2 3B',
    hus: 'Meta',
    licens: 'Llama 3.2',
    repo: 'unsloth/Llama-3.2-3B-Instruct-GGUF',
    fil: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    byte: 2019377600,
    sha256: '6c99cc00ae910f6a532a80022cb4bc1939094527a089c29294b841c0bd87f74d',
    minne: 8,
    provad: false,
    get om() { return tx('lib.modeller.llama32-3b.om'); },
  },
  {
    id: 'qwen3-8b',
    niva: 'Pro',
    get varfor() { return tx('lib.modeller.qwen3-8b.varfor'); },
    namn: 'Qwen3 8B',
    hus: 'Alibaba',
    licens: 'Apache 2.0',
    repo: 'Qwen/Qwen3-8B-GGUF',
    fil: 'Qwen3-8B-Q4_K_M.gguf',
    byte: 5027783488,
    sha256: 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785',
    minne: 16,
    provad: false,
    get om() { return tx('lib.modeller.qwen3-8b.om'); },
  },
  {
    id: 'llama31-8b',
    niva: 'Pro',
    get varfor() { return tx('lib.modeller.llama31-8b.varfor'); },
    namn: 'Llama 3.1 8B',
    hus: 'Meta',
    licens: 'Llama 3.1',
    repo: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
    fil: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    byte: 4920739232,
    sha256: '7b064f5842bf9532c91456deda288a1b672397a54fa729aa665952863033557c',
    minne: 16,
    provad: false,
    get om() { return tx('lib.modeller.llama31-8b.om'); },
  },
  {
    id: 'qwen3-14b',
    niva: 'Max',
    get varfor() { return tx('lib.modeller.qwen3-14b.varfor'); },
    namn: 'Qwen3 14B',
    hus: 'Alibaba',
    licens: 'Apache 2.0',
    repo: 'Qwen/Qwen3-14B-GGUF',
    fil: 'Qwen3-14B-Q4_K_M.gguf',
    byte: 9001752960,
    sha256: '500a8806e85ee9c83f3ae08420295592451379b4f8cf2d0f41c15dffeb6b81f0',
    minne: 24,
    provad: false,
    get om() { return tx('lib.modeller.qwen3-14b.om'); },
  },
  {
    id: 'mistral-nemo',
    niva: 'Max',
    get varfor() { return tx('lib.modeller.mistral-nemo.varfor'); },
    namn: 'Mistral Nemo 12B',
    hus: 'Mistral AI',
    licens: 'Apache 2.0',
    repo: 'MaziyarPanahi/Mistral-Nemo-Instruct-2407-GGUF',
    fil: 'Mistral-Nemo-Instruct-2407.Q4_K_M.gguf',
    byte: 7477204928,
    sha256: '5964f3e6d9c17b99e3d2174022048f3ec58b12ee8fefa987888e0562d070d52e',
    minne: 24,
    provad: false,
    get om() { return tx('lib.modeller.mistral-nemo.om'); },
  },
  {
    id: 'mistral-small',
    niva: 'Stor',
    get varfor() { return tx('lib.modeller.mistral-small.varfor'); },
    namn: 'Mistral Small 24B',
    hus: 'Mistral AI',
    licens: 'Apache 2.0',
    repo: 'MaziyarPanahi/Mistral-Small-24B-Instruct-2501-GGUF',
    fil: 'Mistral-Small-24B-Instruct-2501.Q4_K_M.gguf',
    byte: 14333908416,
    sha256: 'fd7ffad78e7a43dc2fdbefdc5c9467ce572b29f3de8894db3e3354129d9d84df',
    minne: 48,
    provad: false,
    get om() { return tx('lib.modeller.mistral-small.om'); },
  },
  {
    id: 'qwen3-32b',
    niva: 'Stor',
    get varfor() { return tx('lib.modeller.qwen3-32b.varfor'); },
    namn: 'Qwen3 32B',
    hus: 'Alibaba',
    licens: 'Apache 2.0',
    repo: 'Qwen/Qwen3-32B-GGUF',
    fil: 'Qwen3-32B-Q4_K_M.gguf',
    byte: 19762149024,
    sha256: 'efd971561896866f0e910cce52761ca77b1b138090c7f15fe284676d57d1f689',
    minne: 48,
    provad: false,
    get om() { return tx('lib.modeller.qwen3-32b.om'); },
  },
];

export const modell = id => KATALOG.find(m => m.id === id) || null;

/// Modellen som faktiskt körs, matchad på filnamn.
///
/// Den kan ligga var som helst: MAXIMUS_MODELL pekar ut en fil, och den som
/// redan har modeller i ~/models kör dem därifrån. Id:t säger då ingenting,
/// men filnamnet gör det.
export const modellAvFil = vag => {
  const f = basename(String(vag || '')).toLowerCase();
  return KATALOG.find(m => m.fil.toLowerCase() === f) || null;
};

/// Vad datorn har att jobba med.
///
/// Diskutrymmet läses med statfs och inte med `df`: en app startad från
/// Finder har inget skal, och ett kommando som inte finns är ett fel som
/// syns först hos den som installerar.
export async function kapacitet(dit = katalogen()) {
  let disk = null;
  try {
    const f = await statfs(dit).catch(() => statfs(homedir()));
    disk = f.bsize * f.bavail;
  } catch { /* okänd disk är inte ett hinder, bara okänt */ }
  return {
    minne: os.totalmem(),
    minneGB: Math.round(os.totalmem() / 2 ** 30),
    karnor: os.cpus().length,
    arkitektur: os.arch(),
    plattform: os.platform(),
    disk,
    diskGB: disk === null ? null : Math.round(disk / 2 ** 30),
  };
}

/// Den största modellen datorn bär.
///
/// "Bär" betyder att den får plats i minnet med marginal och att filen får
/// plats på disken. Hittas ingen — en dator med fyra gigabyte — blir svaret
/// den minsta ändå, med `racker: false`. Att svara "din dator duger inte" och
/// stanna där vore att lämna någon utan väg framåt; MAXIMUS säger hellre vad det
/// innebär och låter dem bestämma.
export function valjModell(kap) {
  const minneGB = kap.minneGB ?? Math.round((kap.minne || 0) / 2 ** 30);
  const diskByte = kap.disk ?? Infinity;
  const ryms = m => m.minne <= minneGB && m.byte * 1.15 <= diskByte;
  // Den största provade som får plats. Finns ingen provad som ryms tas den
  // största som ryms över huvud taget — en oprövad modell är bättre än ingen,
  // men den ska aldrig väljas framför en provad.
  // Störst först, och vid lika storlek den MAXIMUS kan mest om.
  //
  // Det stod `.at(-1)` och förutsatte att katalogen var sorterad på minne.
  // Den är inte det längre: varje nivå har flera modeller från olika hus, och
  // då avgjorde insättningsordningen vilken dator som fick vilken modell.
  //
  // Tiebreak på hus är inte leverantörsfavorisering. MAXIMUS:s instruktioner är
  // utprovade mot ett visst hus modeller, och på en dator som inte orkar med
  // någon provad modell är det enda vi vet något om. Användaren kan byta —
  // det är hela poängen med att katalogen har alternativ.
  const husMedProvad = new Set(KATALOG.filter(m => m.provad).map(m => m.hus));
  const storst = lista => [...lista].sort((a, b) =>
    b.minne - a.minne
    || (husMedProvad.has(b.hus) ? 1 : 0) - (husMedProvad.has(a.hus) ? 1 : 0)
    || b.byte - a.byte)[0];

  const provade = KATALOG.filter(m => m.provad && ryms(m));
  if (provade.length) return { ...storst(provade), racker: true };
  const passar = KATALOG.filter(ryms);
  if (passar.length) return { ...storst(passar), racker: true, oprovad: true };
  const minsta = KATALOG[0];
  return {
    ...minsta,
    racker: false,
    varfor: minsta.byte * 1.15 > diskByte
      ? tx('lib.modeller.disk', { kvar: Math.round(diskByte / 2 ** 30), behover: Math.ceil(minsta.byte / 2 ** 30) })
      : tx('lib.modeller.minne', { har: minneGB, vill: minsta.minne }),
  };
}

/// Var modellerna bor.
///
/// Förvalet ligger bredvid MAXIMUS:s egen data, så att avinstallation tar med
/// sig allt och så att det fungerar likadant på Windows. Men en dator som
/// redan har modeller i ~/models ska inte ladda ned dem en gång till — se
/// `hittaFil`.
let KATALOGEN = null;
export const satKatalog = v => { KATALOGEN = v || null; };
export const katalogen = () => KATALOGEN || join(datakatalog(), 'modeller');

/// Filen om den redan finns, annars null.
///
/// Letar först där MAXIMUS lägger sina, sedan i ~/models — den katalog var och
/// varannan som kört en lokal modell redan har. Sex gigabyte som redan är
/// hämtade ska inte hämtas igen bara för att de ligger på fel ställe.
export async function hittaFil(m) {
  const kandidater = [
    join(katalogen(), m.fil),
    join(homedir(), 'models', basename(m.repo), m.fil),
    join(homedir(), 'models', m.fil),
  ];
  for (const v of kandidater) {
    const s = await stat(v).catch(() => null);
    // Halva filer räknas inte. En avbruten hämtning ligger kvar som .delvis.
    if (s?.isFile() && s.size === m.byte) return v;
  }
  return null;
}

/// Vad som finns hämtat, med storlek och allt.
export async function laget() {
  const kap = await kapacitet();
  const vald = valjModell(kap);
  const rader = [];
  for (const m of KATALOG) {
    const vag = await hittaFil(m);
    rader.push({ ...m, finns: Boolean(vag), vag, passar: m.minne <= kap.minneGB });
  }
  return { kapacitet: kap, rekommenderad: vald.id, racker: vald.racker, varfor: vald.varfor, modeller: rader };
}

/// Hämta en modell, med framsteg och kvitto.
///
/// Tre saker som en `fetch` till en fil inte ger:
///
/// 1. Den fortsätter. Sex gigabyte över ett kontorsnät hinner brytas, och
///    att börja om från noll är inte ett alternativ. Hugging Face svarar på
///    Range — kontrollerat 2026-09-25, HTTP 206 — så en halv fil är en
///    utgångspunkt, inte skräp.
/// 2. Den räknar. Den som väntar på 6,5 GB ska se att det går framåt, hur
///    fort, och hur länge till.
/// 3. Den kontrollräknar. sha256 kommer från Hugging Faces eget LFS-register
///    och jämförs mot det som faktiskt landade. En modell är kod som körs på
///    materialet som aldrig får lämna datorn; att lita på att bytena kom
///    fram vore att lita på fel sak.
///
/// Samma maskineri bär nu modellen, projektorn och örat (granskningen
/// 2026-10-09). Förut kontrollräknade bara modellen; projektorn räknades på
/// storlek och örat inte alls, båda från `resolve/main`. Alla tre är filer
/// som C-kod tolkar, och en fil som ingen räknat på är en fil vem som helst
/// med skrivrätt till repot kan byta ut.
///
/// En summa som inte stämmer tar bort filen och säger det. En halv fil som
/// ligger kvar och ser hel ut är värre än ingen fil.
///
/// `liggare` får en rad per nätanrop: vad, varifrån, hur stort och hur det
/// gick. En nedladdning på en gigabyte är trafik som dataskyddsombudet ska
/// kunna se, också när den misslyckades.
export async function hamtaVerifierad(url, mal, { byte, sha256, vad = basename(mal), onFramsteg = () => {}, signal, liggare } = {}) {
  if (!/^[0-9a-f]{64}$/.test(String(sha256 || ''))) throw new Error(tx('lib.modeller.fel.summa', { vad }));
  const delvis = `${mal}.delvis`;
  let fran = (await stat(delvis).catch(() => null))?.size || 0;
  if (byte && fran >= byte) { await unlink(delvis).catch(() => {}); fran = 0; }

  const t0 = Date.now();
  let gjort = fran, start = 0, fel = null;
  try {
    const r = await fetch(url, {
      signal,
      headers: { 'User-Agent': 'MAXIMUS/4.0', ...(fran ? { Range: `bytes=${fran}-` } : {}) },
    });
    if (!r.ok && r.status !== 206)
      throw new Error(tx('lib.modeller.fel.http', { status: r.status }));

    // Servern kan ignorera Range. Då börjar vi om, hellre än att skriva ny data
    // ovanpå gammal och få en fil som ser hel ut men inte är det.
    start = r.status === 206 ? fran : 0;
    gjort = start;

    const summa = createHash('sha256');
    if (start) {
      // Det som redan ligger på disk måste räknas in i summan, annars kan den
      // aldrig stämma.
      //
      // Inte genom pipeline: ett sista steg som är en async-generator ger en
      // ström ingen konsumerar, och hämtningen hängde tyst på en halv fil.
      // Att bara läsa och räkna är både kortare och det som faktiskt menas.
      const { createReadStream } = await import('node:fs');
      for await (const bit of createReadStream(delvis, { end: start - 1 })) summa.update(bit);
    }

    const av = byte || Number(r.headers.get('content-length')) + start || 0;
    let sist = 0;
    await pipeline(
      Readable.fromWeb(r.body),
      async function* (bitar) {
        for await (const b of bitar) {
          summa.update(b);
          gjort += b.length;
          // En server som skickar mer än filen är stor ska inte få fylla disken.
          if (byte && gjort > byte) throw new Error(tx('lib.modeller.fel.storre', { vad }));
          const nu = Date.now();
          // Tio gånger i sekunden räcker för ett öga och belastar ingenting.
          if (nu - sist > 100) {
            sist = nu;
            const fart = (gjort - start) / Math.max(1, (nu - t0) / 1000);
            onFramsteg({ gjort, av, andel: av ? Math.min(1, gjort / av) : 0, fart,
              kvar: fart > 0 && av ? Math.round((av - gjort) / fart) : null });
          }
          yield b;
        }
      },
      createWriteStream(delvis, { flags: start ? 'a' : 'w', mode: 0o600 }),
    );

    if (byte && gjort !== byte) {
      await unlink(delvis).catch(() => {});
      throw new Error(tx('lib.modeller.fel.storlek', { vad, gjort, byte }));
    }
    if (summa.digest('hex') !== sha256) {
      await unlink(delvis).catch(() => {});
      throw new Error(tx('lib.modeller.fel.summaFel', { vad }));
    }
    await rename(delvis, mal);
    onFramsteg({ gjort, av: gjort, andel: 1, fart: 0, kvar: 0 });
    return mal;
  } catch (e) { fel = e; throw e; }
  finally {
    if (typeof liggare === 'function') {
      try {
        await liggare({ session: null, frontier: tx('lib.modeller.liggare.hamtning', { vad }), vag: 'direkt',
          skickat: `GET ${url}${start ? tx('lib.modeller.liggare.franByte', { start }) : ''}`,
          mottaget: fel ? null : tx('lib.modeller.liggare.mottaget', { n: gjort - start, gjort, sha: sha256.slice(0, 16) }),
          tecken: 0, sekunder: Math.round((Date.now() - t0) / 100) / 10, fel: fel ? fel.message : null });
      } catch (e) { console.error('liggaren kunde inte skriva om hämtningen:', e.message); }
    }
  }
}

/// Stämmer en fil som redan ligger på disk?
///
/// Storleken först, för den är gratis. Summan sedan, en gång: en fil som
/// redan ligger där MAXIMUS lägger sina kan vara hämtad av en äldre version
/// från `resolve/main` utan kontroll (granskningen 2026-10-09).
export async function stammerFil(vag, { byte, sha256 }) {
  const s = await stat(vag).catch(() => null);
  if (!s?.isFile() || (byte && s.size !== byte)) return false;
  const { createReadStream } = await import('node:fs');
  const summa = createHash('sha256');
  for await (const bit of createReadStream(vag)) summa.update(bit);
  return summa.digest('hex') === sha256;
}

/// Projektorn som ger modellen syn.
///
/// Gemma 4 är multimodal, men GGUF-filen bär bara språkdelen. Synen ligger i
/// en egen fil — mmproj — som llama-server tar med --mmproj. Utan den läses
/// en bild med OCR och modellen får en avskrift; med den ser den bilden.
///
/// Laddas aldrig av sig själv. Den är mellan 175 MB och 1,2 GB beroende på
/// modell, och den som aldrig skickar en bild ska inte behöva hämta den.
export async function hamtaMmproj(id, { onFramsteg = () => {}, signal, liggare } = {}) {
  const m = modell(id);
  if (!m?.mmproj) throw new Error(tx('lib.modeller.fel.ingenBild'));

  // Bredvid modellfilen, för det är där modell.mjs letar.
  const modellvag = await hittaFil(m);
  const dit = modellvag ? dirname(modellvag) : katalogen();
  await mkdir(dit, { recursive: true });
  const mal = join(dit, m.mmproj.fil);
  // En fil med rätt storlek räknas också (granskningen 2026-10-09). Stämmer
  // den inte hämtas en ny ovanpå; den gamla körs aldrig.
  if (await stammerFil(mal, m.mmproj)) return { vag: mal, redan: true };

  await hamtaVerifierad(`${VARD}/${m.repo}/resolve/${m.mmproj.rev}/${m.mmproj.fil}`, mal,
    { byte: m.mmproj.byte, sha256: m.mmproj.sha256, vad: `bilddelen till ${m.namn}`, onFramsteg, signal, liggare });
  return { vag: mal, redan: false };
}

export async function hamtaModell(id, { onFramsteg = () => {}, signal, liggare } = {}) {
  const m = modell(id);
  if (!m) throw new Error(tx('lib.modeller.fel.okand', { id }));

  const redan = await hittaFil(m);
  if (redan) return { vag: redan, redan: true, byte: m.byte };

  const dit = katalogen();
  await mkdir(dit, { recursive: true });
  const mal = join(dit, m.fil);
  await hamtaVerifierad(`${VARD}/${m.repo}/resolve/main/${m.fil}`, mal,
    { byte: m.byte, sha256: m.sha256, vad: m.namn, onFramsteg, signal, liggare });
  return { vag: mal, redan: false, byte: m.byte };
}

/// Ta bort en hämtad modell. Sex gigabyte är sex gigabyte.
export async function taBort(id) {
  const m = modell(id);
  if (!m) throw new Error(tx('lib.modeller.fel.okand', { id }));
  const vag = await hittaFil(m);
  if (!vag) return { bort: false };
  // Bara det MAXIMUS själv lagt dit. Ligger filen i ~/models är den någon
  // annans, och MAXIMUS städar inte i andras mappar.
  if (!vag.startsWith(katalogen())) throw new Error(tx('lib.modeller.fel.utanfor'));
  await unlink(vag);
  return { bort: true };
}

/// Halvfärdiga hämtningar, för den som vill veta vad som tar plats.
export async function paborjade() {
  const filer = await readdir(katalogen()).catch(() => []);
  const ut = [  {
    id: 'qwen3-4b',
    niva: 'Bas',
    get varfor() { return tx('lib.modeller.qwen3-4b.varfor'); },
    namn: 'Qwen3 4B',
    hus: 'Alibaba',
    licens: 'Apache 2.0',
    repo: 'Qwen/Qwen3-4B-GGUF',
    fil: 'Qwen3-4B-Q4_K_M.gguf',
    byte: 2497280256,
    sha256: '7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5',
    minne: 8,
    provad: false,
    get om() { return tx('lib.modeller.qwen3-4b.om'); },
  },
  {
    id: 'llama32-3b',
    niva: 'Bas',
    get varfor() { return tx('lib.modeller.llama32-3b.varfor'); },
    namn: 'Llama 3.2 3B',
    hus: 'Meta',
    licens: 'Llama 3.2',
    repo: 'unsloth/Llama-3.2-3B-Instruct-GGUF',
    fil: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    byte: 2019377600,
    sha256: '6c99cc00ae910f6a532a80022cb4bc1939094527a089c29294b841c0bd87f74d',
    minne: 8,
    provad: false,
    get om() { return tx('lib.modeller.llama32-3b.om'); },
  },
  {
    id: 'qwen3-8b',
    niva: 'Pro',
    get varfor() { return tx('lib.modeller.qwen3-8b.varfor'); },
    namn: 'Qwen3 8B',
    hus: 'Alibaba',
    licens: 'Apache 2.0',
    repo: 'Qwen/Qwen3-8B-GGUF',
    fil: 'Qwen3-8B-Q4_K_M.gguf',
    byte: 5027783488,
    sha256: 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785',
    minne: 16,
    provad: false,
    get om() { return tx('lib.modeller.qwen3-8b.om'); },
  },
  {
    id: 'llama31-8b',
    niva: 'Pro',
    get varfor() { return tx('lib.modeller.llama31-8b.varfor'); },
    namn: 'Llama 3.1 8B',
    hus: 'Meta',
    licens: 'Llama 3.1',
    repo: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
    fil: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    byte: 4920739232,
    sha256: '7b064f5842bf9532c91456deda288a1b672397a54fa729aa665952863033557c',
    minne: 16,
    provad: false,
    get om() { return tx('lib.modeller.llama31-8b.om'); },
  },
  {
    id: 'qwen3-14b',
    niva: 'Max',
    get varfor() { return tx('lib.modeller.qwen3-14b.varfor'); },
    namn: 'Qwen3 14B',
    hus: 'Alibaba',
    licens: 'Apache 2.0',
    repo: 'Qwen/Qwen3-14B-GGUF',
    fil: 'Qwen3-14B-Q4_K_M.gguf',
    byte: 9001752960,
    sha256: '500a8806e85ee9c83f3ae08420295592451379b4f8cf2d0f41c15dffeb6b81f0',
    minne: 24,
    provad: false,
    get om() { return tx('lib.modeller.qwen3-14b.om'); },
  },
  {
    id: 'mistral-nemo',
    niva: 'Max',
    get varfor() { return tx('lib.modeller.mistral-nemo.varfor'); },
    namn: 'Mistral Nemo 12B',
    hus: 'Mistral AI',
    licens: 'Apache 2.0',
    repo: 'MaziyarPanahi/Mistral-Nemo-Instruct-2407-GGUF',
    fil: 'Mistral-Nemo-Instruct-2407.Q4_K_M.gguf',
    byte: 7477204928,
    sha256: '5964f3e6d9c17b99e3d2174022048f3ec58b12ee8fefa987888e0562d070d52e',
    minne: 24,
    provad: false,
    get om() { return tx('lib.modeller.mistral-nemo.om'); },
  },
  {
    id: 'mistral-small',
    niva: 'Stor',
    get varfor() { return tx('lib.modeller.mistral-small.varfor'); },
    namn: 'Mistral Small 24B',
    hus: 'Mistral AI',
    licens: 'Apache 2.0',
    repo: 'MaziyarPanahi/Mistral-Small-24B-Instruct-2501-GGUF',
    fil: 'Mistral-Small-24B-Instruct-2501.Q4_K_M.gguf',
    byte: 14333908416,
    sha256: 'fd7ffad78e7a43dc2fdbefdc5c9467ce572b29f3de8894db3e3354129d9d84df',
    minne: 48,
    provad: false,
    get om() { return tx('lib.modeller.mistral-small.om'); },
  },
  {
    id: 'qwen3-32b',
    niva: 'Stor',
    get varfor() { return tx('lib.modeller.qwen3-32b.varfor'); },
    namn: 'Qwen3 32B',
    hus: 'Alibaba',
    licens: 'Apache 2.0',
    repo: 'Qwen/Qwen3-32B-GGUF',
    fil: 'Qwen3-32B-Q4_K_M.gguf',
    byte: 19762149024,
    sha256: 'efd971561896866f0e910cce52761ca77b1b138090c7f15fe284676d57d1f689',
    minne: 48,
    provad: false,
    get om() { return tx('lib.modeller.qwen3-32b.om'); },
  },
];
  for (const f of filer.filter(f => f.endsWith('.delvis'))) {
    const s = await stat(join(katalogen(), f)).catch(() => null);
    if (s) ut.push({ fil: f.replace(/\.delvis$/, ''), byte: s.size });
  }
  return ut;
}
