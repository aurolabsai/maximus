// Namnmodellen: maskeringens andra nivå (beslutad av
// Auro 2026-10-10).
//
// Reglerna i lib/maskering.mjs och vakterna i lib/failclosed.mjs går alltid
// först, och de avgör allt som har ett format. Det de inte kan se är det som
// saknar format: Thandiwe Mokoena, Sten Strand, Kvarngränd 4, Sahlgrenska,
// Hjo. Där läser en liten tokenklassificerare, `Wismut/nym-pii-multilingual-
// small` (MIT, int8-ONNX, 139 MB), och det den hittar läggs i samma karta och
// får samma sorts platshållare som reglernas. Den valdes 2026-10-10 bland fjorton
// kandidater, provad mot korpusen och 55 nya påhittade fall.
//
// Fyra löften, i den ordning de väger:
//
//   1. Modellen lägger bara till. Den tar aldrig bort en platshållare, och
//      går den inte att ladda — saknas filen, stämmer summan inte, är datorn
//      inte en Mac — gäller reglerna precis som förut. Tyst för den som
//      skriver, men loggat.
//   2. Filen är den vi provat. Hämtad från en låst revision, och storlek och
//      sha256 räknas innan den laddas. Stämmer de inte raderas filen.
//   3. Nivån styr vad den får ta. Personuppgifter: namn, adresser och
//      identitetsnummer. Strikt: därtill orter och arbetsplatser. Aldrig
//      länder. Sorterna i "Vad som döljs" gäller som för reglerna.
//   4. Farten. En kort text tar ca 15 ms. Ett långt dokument körs i fönster
//      en gång, när det läggs till, och resultatet hålls i minnet per stycke
//      — så att inte varje fråga väntar en halv sekund per sida.
//
// Synkront och asynkront skiljs åt med flit. Maskeringen är synkron och
// används på femtio ställen; modellen är asynkron. Därför körs modellen
// före (`forbered`, `iBakgrunden`) och fynden läses sedan synkront ur minnet
// (`fyndFor`). Ett stycke modellen inte hunnit läsa får bara reglerna, som
// i dag.
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir, cpus } from 'node:os';
import { hamtaVerifierad, stammerFil } from './modeller.mjs';
import { etikett } from './maskering.mjs';
import { rensaOsynliga, skydda, maskeraDelar, STOPP, OFARLIGA, VANLIGA } from './failclosed.mjs';
import { tx } from './sprakstod.mjs';

/// Modellen, låst. Revisionen och summorna är lästa ur Hugging Faces
/// LFS-register för commit 4348999c och stämmer med filerna som provet kördes
/// på (2026-10-10). En påhittad summa är en
/// hämtning som faller hos användaren.
export const NAMNMODELL = {
  namn: 'nym-pii-multilingual-small',
  repo: 'Wismut/nym-pii-multilingual-small',
  rev: '4348999cd3c2e20c49615e9af7c6bbb45b64cd85',
  licens: 'MIT',
  filer: [
    { fil: 'int8/model_int8.onnx', byte: 138730982, sha256: '139006aea2cbd8e709d322f056232570de54661f624143be4893aaa387190286' },
    { fil: 'int8/tokenizer.json', byte: 12389891, sha256: 'c299144e68dfec1dc536204a7ae3712710c5c6cade9269a83f5042250d47d8de' },
    { fil: 'int8/config.json', byte: 5688, sha256: '3f07065571e22bb73eba28ddb1fae4509c0cf703762e3bfa7a6ab2111cf7cb88' },
    { fil: 'tokenizer_config.json', byte: 573, sha256: '02055b886266b1a475bc324da83e273fe96e4974002f9d970f26e94aa73e5885' },
  ],
};
const BYTE = NAMNMODELL.filer.reduce((s, f) => s + f.byte, 0);

/// Var den ligger. Bredvid de andra modellerna i ~/models, eller där
/// MAXIMUS_NAMNMODELL pekar (proven pekar på provets kopia).
export const namnmodellKatalog = () => process.env.MAXIMUS_NAMNMODELL
  || join(homedir(), 'models', 'namnmodell', NAMNMODELL.namn);

// ── Läget ────────────────────────────────────────────────────────────────

/// `installningar.namnmodell`: false är av, allt annat är på. Förvalt på när
/// filen finns — den som hämtat den vill ha den.
let PA = true;
let session = null, tokenizer = null, id2label = null, ORT = null;
let laddar = null;      // löftet medan den laddas
let fel = null;         // varför den inte laddades; nollas av en ny hämtning
let ko = Promise.resolve();

const logg = m => console.log(`  namnmodellen: ${m}`);

/// Bara på Mac, som provet. På andra plattformar gäller reglerna ensamma.
/// MAXIMUS_NAMNMODELL_ALLA=1 släpper spärren för den som provar på annat.
const plattformOk = () => process.platform === 'darwin' || process.env.MAXIMUS_NAMNMODELL_ALLA === '1';

export function satNamnmodell({ pa } = {}) {
  PA = pa !== false;
  // Påslagen prövas filen igen: den kan ha lagts dit sedan förra försöket.
  if (PA && !session) fel = null;
  if (!PA) {
    // Av är av: modellen släpps och det den läst glöms. Fynden är namn ur
    // dina texter, och de ska inte ligga kvar i minnet för en avstängd sak.
    Promise.resolve(session?.release?.()).catch(() => {});
    session = null; tokenizer = null; laddar = null;
    CACHE.clear(); vantar.clear(); bakgrund.length = 0;
  }
}

/// Finns alla filer, med rätt storlek? Bara storleken här — summan räknas
/// en gång, när modellen laddas.
async function filernaFinns() {
  for (const f of NAMNMODELL.filer) {
    const s = await stat(join(namnmodellKatalog(), f.fil)).catch(() => null);
    if (!s?.isFile() || s.size !== f.byte) return false;
  }
  return true;
}

/// Läget för inställningarna.
export async function namnmodellLage() {
  return {
    namn: NAMNMODELL.namn, licens: NAMNMODELL.licens, storlek: `${Math.round(BYTE / 1e6)} MB`,
    pa: PA, finns: await filernaFinns(), plattform: plattformOk(), laddad: Boolean(session), fel,
  };
}

/// Hämtar filerna från den låsta revisionen. Varje fil kontrolleras på
/// storlek och sha256 (hamtaVerifierad); en fil som redan ligger där och
/// stämmer hämtas inte igen. Varje hämtning står i liggaren.
export async function hamtaNamnmodell({ onFramsteg = () => {}, signal, liggare } = {}) {
  const kat = namnmodellKatalog();
  let gjort = 0, redan = true;
  for (const f of NAMNMODELL.filer) {
    const mal = join(kat, f.fil);
    if (await stammerFil(mal, f)) { gjort += f.byte; continue; }
    redan = false;
    await mkdir(dirname(mal), { recursive: true });
    const fore = gjort;
    await hamtaVerifierad(`https://huggingface.co/${NAMNMODELL.repo}/resolve/${NAMNMODELL.rev}/${f.fil}`, mal, {
      byte: f.byte, sha256: f.sha256, vad: tx('lib.namnmodell.vad', { fil: f.fil }), signal, liggare,
      onFramsteg: p => onFramsteg({ gjort: fore + (p.gjort || 0), av: BYTE, andel: (fore + (p.gjort || 0)) / BYTE }),
    });
    gjort += f.byte;
  }
  fel = null;
  onFramsteg({ gjort: BYTE, av: BYTE, andel: 1, klar: true });
  return { redan };
}

/// Laddar modellen, lat och en gång. Svarar sant om den går att använda.
export async function namnmodellRedo() {
  if (!PA || !plattformOk()) return false;
  if (session) return true;
  if (fel) return false;
  laddar ||= ladda().finally(() => { laddar = null; });
  return laddar;
}

async function ladda() {
  const t0 = Date.now();
  const kat = namnmodellKatalog();
  for (const f of NAMNMODELL.filer) {
    const vag = join(kat, f.fil);
    if (await stammerFil(vag, f)) continue;
    // En fil som finns men inte stämmer körs aldrig: den raderas, och
    // reglerna gäller tills en ny hämtats.
    if (await stat(vag).catch(() => null)) {
      await unlink(vag).catch(() => {});
      fel = 'summa';
      logg(`${f.fil} stämde inte mot den låsta summan och raderades — bara reglerna gäller`);
    } else {
      fel = 'saknas';
      logg('filen saknas — bara reglerna gäller');
    }
    return false;
  }
  try {
    const ort = (await import('onnxruntime-node')).default;
    const { Tokenizer } = await import('@huggingface/tokenizers');
    const las = async f => JSON.parse(await readFile(join(kat, f), 'utf8'));
    const [tok, tokKonf, konf] = await Promise.all([las('int8/tokenizer.json'), las('tokenizer_config.json'), las('int8/config.json')]);
    tokenizer = new Tokenizer(tok, tokKonf);
    id2label = konf.id2label;
    // Fyra trådar räcker för en mening, och lämnar resten åt det du gör.
    session = await ort.InferenceSession.create(join(kat, 'int8/model_int8.onnx'),
      { intraOpNumThreads: Math.min(4, cpus().length), graphOptimizationLevel: 'all' });
    ORT = ort;
    // Avstängd medan den laddades: släpps direkt.
    if (!PA) { Promise.resolve(session.release?.()).catch(() => {}); session = null; return false; }
    logg(`laddad på ${Date.now() - t0} ms`);
    return true;
  } catch (e) {
    fel = 'laddning';
    session = null; tokenizer = null;
    logg(`gick inte att ladda (${e.message}) — bara reglerna gäller`);
    return false;
  }
}

// ── Modellen på en text ──────────────────────────────────────────────────

/// Modellens etiketter i Maximus grupper. Till varje grupp hör en sort i
/// "Vad som döljs" som måste vara på (SORT) och platshållarens etikett
/// (ETIKETT). Länder (COUNTRY) och delstater är med flit inte med: de pekar
/// inte ut någon.
const GRUPP = {
  GIVEN_NAME: 'namn', SURNAME: 'namn',
  STREET_ADDRESS: 'adress', STREET_NAME: 'adress', BUILDING_NUMBER: 'adress', ZIP_CODE: 'adress', SECONDARY_ADDRESS: 'adress',
  CITY: 'ort', COMPANY_NAME: 'organisation',
  SSN: 'id', GOVERNMENT_ID: 'id', TAX_ID: 'id', PASSPORT: 'id', DRIVERS_LICENSE: 'id', CUSTOMER_ID: 'id',
  EMPLOYEE_ID: 'id', MEDICAL_RECORD_NUMBER: 'id', LICENSE_PLATE: 'id',
  PHONE: 'telefon', FAX_NUMBER: 'telefon', EMAIL: 'epost',
  ACCOUNT_NUMBER: 'konto', IBAN: 'konto', ROUTING_NUMBER: 'konto', CREDIT_DEBIT_CARD: 'konto',
};
const SORT = { namn: 'namn', adress: 'ort', ort: 'ort', organisation: 'organisation', id: 'personnummer',
  telefon: 'telefon', epost: 'epost', konto: 'kontonummer' };
const ETIKETT = { namn: 'NAMN', adress: 'ADRESS', ort: 'ORT', organisation: 'ORGANISATION', id: 'IDNR',
  telefon: 'TELEFON', epost: 'E-POST', konto: 'KONTO' };

/// Vad varje nivå lovar (lib.moln.*.om): Personuppgifter döljer namn,
/// nummer och adresser och låter företag och orter stå; Strikt tar också
/// orter och arbetsplatser.
export const NIVAGRUPPER = {
  personuppgifter: ['namn', 'adress', 'id', 'telefon', 'epost', 'konto'],
  strikt: ['namn', 'adress', 'id', 'telefon', 'epost', 'konto', 'ort', 'organisation'],
};

/// Varje tokens plats i texten. Tokeniseraren ger inga positioner, så de
/// läses fram: ▁ är ett mellanslag (och det första kan vara påhittat), och
/// en följd <0xNN> är bytes i ett tecken tokeniseraren inte har.
function positioner(text, tokens) {
  const ut = new Array(tokens.length).fill(null);
  let p = 0;
  const las = yta => {
    let start = -1;
    for (const c of yta) {
      if (text.startsWith(c, p)) { if (start < 0 && !/\s/.test(c)) start = p; p += c.length; continue; }
      if (/\s/.test(c)) continue;
      // Ur synk (en normalisering vi inte ser): leta tecknet strax framför.
      const j = text.indexOf(c, p);
      if (j >= 0 && j - p <= 8) { if (start < 0) start = j; p = j + c.length; }
    }
    return start < 0 ? null : [start, p];
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^<[a-z_]+>$/.test(t)) continue;
    if (/^<0x[0-9A-F]{2}>$/.test(t)) {
      let j = i;
      const bytes = [];
      while (j < tokens.length && /^<0x[0-9A-F]{2}>$/.test(tokens[j])) bytes.push(parseInt(tokens[j++].slice(3, 5), 16));
      const s = las(Buffer.from(bytes).toString('utf8').replace(/�/g, ''));
      for (let k = i; k < j; k++) ut[k] = s;
      i = j - 1;
      continue;
    }
    ut[i] = las(t.replace(/▁/g, ' '));
  }
  return ut;
}

const ORDTECKEN = /[\p{L}\p{N}]/u;
/// Ett spann avrundat till hela ord: "ström]" blir "Boström", "-Sven" blir
/// "Karl-Sven". Tokeniseraren limmar skiljetecken mot ordet, och en bokstav
/// som blir kvar utanför platshållaren är en bokstav för mycket.
function helaOrd(text, a, b) {
  while (a < b && !ORDTECKEN.test(text[a])) a++;
  while (b > a && !ORDTECKEN.test(text[b - 1])) b--;
  if (a >= b) return null;
  const inne = i => ORDTECKEN.test(text[i] || '') || (/[-'’]/.test(text[i] || '') && ORDTECKEN.test(text[i - 1] || '') && ORDTECKEN.test(text[i + 1] || ''));
  while (a > 0 && inne(a - 1)) a--;
  while (b < text.length && inne(b)) b++;
  return [a, b];
}

/// Kör modellen på en bit (högst ca 1200 tecken) och ger spannen som
/// [start, slut, grupp, typ], avrundade och ihopslagna.
async function spannI(text) {
  const enc = tokenizer.encode(text);
  const n = enc.ids.length;
  const ids = new ORT.Tensor('int64', BigInt64Array.from(enc.ids, BigInt), [1, n]);
  const mask = new ORT.Tensor('int64', new BigInt64Array(n).fill(1n), [1, n]);
  // En körning i taget. Två samtidigt på samma kärnor går inte fortare.
  const korning = ko.then(() => session.run({ input_ids: ids, attention_mask: mask }));
  ko = korning.catch(() => {});
  const svar = await korning;
  const { data, dims } = svar.logits;
  const k = dims[2];
  const pos = positioner(text, enc.tokens);
  const spann = [];
  let nu = null;
  for (let i = 0; i < n; i++) {
    let bast = 0;
    for (let j = 1; j < k; j++) if (data[i * k + j] > data[i * k + bast]) bast = j;
    const lab = id2label[bast] || 'O';
    const typ = lab === 'O' ? null : lab.replace(/^[BI]-/, '');
    const p = pos[i];
    const grupp = typ && GRUPP[typ];
    if (!p || !grupp) { if (p) nu = null; continue; }
    // Fortsättning: samma typ och I-, eller en ordbit utan ▁ framför.
    const fortsatt = nu && nu[3] === typ && (lab.startsWith('I-') || !enc.tokens[i].startsWith('▁'));
    if (fortsatt) nu[1] = p[1];
    else { nu = [p[0], p[1], grupp, typ]; spann.push(nu); }
  }
  // Avrundade, och ihop: förnamn + efternamn och gata + nummer med bara
  // mellanslag emellan blir ett namn och en adress, inte två.
  const hela = [];
  for (const [a0, b0, grupp, typ] of spann) {
    const r = helaOrd(text, a0, b0);
    if (!r) continue;
    const forra = hela.at(-1);
    if (forra && (forra[2] === grupp && r[0] <= forra[1] + 1 && /^[ \t]*$/.test(text.slice(forra[1], r[0]))
      && (grupp === 'namn' || grupp === 'adress') || r[0] < forra[1])) { forra[1] = Math.max(forra[1], r[1]); continue; }
    hela.push([r[0], r[1], grupp, typ]);
  }
  return hela;
}

/// Ord som aldrig är en person, en plats eller en arbetsplats i den här
/// meningen: stopporden och de ofarliga ur failclosed (myndigheter, länder,
/// roller, lagar). Bestämd form och genitiv räknas, som i vakterna.
const ANDELSER = [/s$/, /n$/, /en$/, /et$/, /na$/, /arna$/, /erna$/, /orna$/];
const ofarligt = o => {
  if (STOPP.has(o) || OFARLIGA.has(o)) return true;
  for (const re of ANDELSER) { const s = o.replace(re, ''); if (s.length >= 3 && (STOPP.has(s) || OFARLIGA.has(s))) return true; }
  return false;
};

/// Ett fynd modellen får lägga till, eller null.
function fynd(fras, grupp) {
  // "lex Maria" är en lag. Modellen tar ibland med ordet lex i namnet; det
  // ska aldrig maskeras, och skydda() i maskeringen lyfter undan resten.
  fras = fras.trim().replace(/^lex\s+/i, '');
  if (fras.length < 2 || /[[\]]/.test(fras)) return null;
  const ord = fras.split(/\s+/);
  // Undantagen: ett fynd där varje ord är ett känt ofarligt ord (Sverige,
  // Försäkringskassan, Norden) läggs inte till. Ett ensamt gement ord som
  // är ett vanligt svenskt ord ("sten och sand") inte heller.
  if (ord.every(o => ofarligt(o.toLowerCase()))) return null;
  if (ord.length === 1 && /^\p{Ll}/u.test(fras) && VANLIGA.has(fras)) return null;
  // En ort eller ett företag som står i lagtexterna (Stockholm) är ett ord
  // reglerna med flit låter stå i Strikt; modellen ska inte vända det.
  if ((grupp === 'ort' || grupp === 'organisation') && ord.every(o => VANLIGA.has(o.toLowerCase()))) return null;
  // Nummer måste ha siffror. Ett ord som modellen kallar kundnummer är ett ord.
  if (['id', 'telefon', 'konto'].includes(grupp) && !/\p{N}/u.test(fras)) return null;
  if (grupp === 'epost' && !/@|\(at\)|\[at\]/i.test(fras)) return null;
  return { fras, grupp };
}

// ── Styckena och minnet ──────────────────────────────────────────────────

/// Stycken: det som står mellan tomma rader. Ett dokument som klistras in i
/// en fråga bär samma stycken som när det lades till, och då hittas fynden
/// igen utan att modellen körs.
const stycken = text => String(text).split(/\n[ \t]*\n/).map(s => s.trim()).filter(s => /\p{L}/u.test(s));

/// Bitarna modellen läser: hela meningar upp till ca 1200 tecken (ca 400
/// tokens), och en mening som är längre delas vid ett mellanslag.
const BIT = 1200;
function bitar(stycke) {
  if (stycke.length <= BIT) return [stycke];
  const ut = [];
  let nu = '';
  for (let m of stycke.split(/(?<=[.!?:;])\s+|\n/)) {
    while (m.length > BIT) {
      const i = m.lastIndexOf(' ', BIT);
      const d = i > BIT / 2 ? i : BIT;
      if (nu) { ut.push(nu); nu = ''; }
      ut.push(m.slice(0, d));
      m = m.slice(d).trim();
    }
    if (nu && nu.length + m.length + 1 > BIT) { ut.push(nu); nu = ''; }
    nu = nu ? `${nu} ${m}` : m;
  }
  if (nu) ut.push(nu);
  return ut;
}

const nyckel = s => (s.length <= 200 ? s : createHash('sha256').update(s).digest('hex'));
/// Fynden per stycke, i minnet och bara där: de är namn ur dina texter.
const CACHE = new Map();
const TAK_CACHE = 20000;
const vantar = new Set();
const bakgrund = [];
let bakgrundIgang = false;

async function korStycke(s) {
  const k = nyckel(s);
  if (CACHE.has(k)) return;
  const ut = [];
  for (const b of bitar(s)) {
    for (const [a, z, grupp] of await spannI(b)) {
      const f = fynd(b.slice(a, z), grupp);
      if (f && !ut.some(x => x.fras === f.fras && x.grupp === f.grupp)) ut.push(f);
    }
  }
  if (!PA) return;
  CACHE.set(k, ut);
  if (CACHE.size > TAK_CACHE) CACHE.delete(CACHE.keys().next().value);
}

/// Läser texterna med modellen nu, inom `tak` millisekunder. Det som inte
/// hinns med läses i bakgrunden, så att nästa fråga har det. Svarar med hur
/// många stycken som lästes och hur många som fick vänta.
///
/// `helt: true` för det som ska LÄMNA datorn (granskningen 2026-10-10): då
/// finns ingen tidsgräns. Modellen väntas in och läser allt; bara en modell
/// som saknas eller inte går att ladda lämnar texten åt reglerna. En text
/// som går ut får aldrig ett svagare skydd för att modellen var långsam.
export async function forbered(texter, { tak = 1500, helt = false } = {}) {
  const lista = (Array.isArray(texter) ? texter : [texter]).filter(t => typeof t === 'string' && t);
  if (!lista.length || !PA || !plattformOk()) return { lasta: 0, kvar: 0, aktiv: false };
  // Första gången laddas modellen (summan räknas, ca 1–3 s). Den väntas in
  // högst fem sekunder; blir den inte klar läses texterna i bakgrunden när
  // den är det, och reglerna gäller för just den här frågan.
  const redo = helt ? await namnmodellRedo()
    : await Promise.race([namnmodellRedo(), new Promise(k => setTimeout(k, Math.min(Math.max(tak, 5000), 2 ** 31 - 1), 'vantar').unref?.())]);
  if (redo === 'vantar') { iBakgrunden(lista.join('\n\n')); return { lasta: 0, kvar: 0, aktiv: false }; }
  if (!redo) return { lasta: 0, kvar: 0, aktiv: false };
  // Tiden räknas från att modellen är laddad.
  const t0 = Date.now();
  const nya = [...new Set(lista.flatMap(t => stycken(rensaOsynliga(t))))].filter(s => !CACHE.has(nyckel(s)));
  let lasta = 0;
  const kvar = [];
  for (const s of nya) {
    if (!helt && Date.now() - t0 > tak) { kvar.push(s); continue; }
    try { await korStycke(s); lasta++; } catch (e) { logg(`ett stycke gick inte (${e.message}) — reglerna gäller för det`); }
  }
  if (kvar.length) {
    logg(`${kvar.length} stycken läses i bakgrunden (tidsgränsen ${tak} ms) — reglerna gäller för dem tills dess`);
    lagIBakgrunden(kvar);
  }
  return { lasta, kvar: kvar.length, aktiv: true };
}

/// Läser en text i bakgrunden, en bit i taget. Ett dokument som läggs till
/// läses så, en gång.
export function iBakgrunden(text) {
  if (!PA || !plattformOk() || typeof text !== 'string') return;
  lagIBakgrunden(stycken(rensaOsynliga(text)).filter(s => !CACHE.has(nyckel(s))));
}

function lagIBakgrunden(lista) {
  for (const s of lista) { const k = nyckel(s); if (!vantar.has(k)) { vantar.add(k); bakgrund.push(s); } }
  if (bakgrundIgang || !bakgrund.length) return;
  bakgrundIgang = true;
  (async () => {
    try {
      if (!(await namnmodellRedo())) { bakgrund.length = 0; vantar.clear(); return; }
      while (bakgrund.length) {
        const s = bakgrund.shift();
        vantar.delete(nyckel(s));
        try { await korStycke(s); } catch (e) { logg(`ett stycke gick inte (${e.message})`); }
        await new Promise(r => setImmediate(r));
      }
    } finally { bakgrundIgang = false; }
  })();
}

/// Det modellen redan hittat i en text, synkront ur minnet. Tomt när
/// modellen är av eller inte hunnit läsa — då gäller reglerna ensamma.
export function fyndFor(text) {
  if (!PA || !CACHE.size) return [];
  const ut = [];
  for (const s of stycken(rensaOsynliga(text))) {
    for (const f of CACHE.get(nyckel(s)) || []) if (!ut.some(x => x.fras === f.fras && x.grupp === f.grupp)) ut.push(f);
  }
  return ut;
}

/// Glömmer det som lästs. För proven, och när modellen stängs av.
export const glomNamnmodell = () => { CACHE.clear(); vantar.clear(); bakgrund.length = 0; };

// ── Fynden in i maskeringen ──────────────────────────────────────────────

function bokstav(n) { let s = ''; while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Platshållare lyfts undan med tecken ur privata området: inga bokstäver,
// inga siffror, så att ett fynd som "12" aldrig träffar inuti en token.
const SIFFROR = '';
const token = i => `${[...String(i)].map(d => SIFFROR[Number(d)]).join('')}`;
const TOKEN = /([-]+)/g;

/// Lägger modellens fynd i texten, efter reglerna och med samma karta.
///
/// Fynden är fraser, inte positioner: texten har redan fått reglernas
/// platshållare, och en fras som står kvar som hela ord är det modellen såg.
/// lex Maria och lex Sarah lyfts undan först, som i grinden.
export function maskeraNamnmodell(text, fyndLista, { karta = new Map(), raknare = new Map(), grupper = NIVAGRUPPER.strikt, sorter = null } = {}) {
  const funna = [];
  const valda = (fyndLista || []).filter(f => grupper.includes(f.grupp) && (!sorter || sorter.has(SORT[f.grupp])));
  if (!valda.length) return { text: String(text ?? ''), karta, raknare, funna };
  const skydd = skydda(String(text ?? ''));
  // Kartans platshållare lyfts undan, en token per platshållare, så att ett
  // fynd aldrig träffar inuti en och så att ett ord reglerna redan tagit
  // kan kännas igen i frasen: "Länsförsäkringar [NAMN B]" är fortfarande
  // "Länsförsäkringar Bergslagen".
  const verkliga = new Set(karta.values());
  const lyfta = [], plats = new Map();
  const lyft = p => { if (!plats.has(p)) plats.set(p, lyfta.push(p) - 1); return token(plats.get(p)); };
  let ut = skydd.text.replace(/\[[^\]\n]{1,40}\]/g, p => (verkliga.has(p) ? lyft(p) : p));

  const platshallare = (fras, grupp) => {
    if (karta.has(fras)) return karta.get(fras);
    const e = etikett(ETIKETT[grupp]);
    const n = (raknare.get(e) || 0) + 1;
    raknare.set(e, n);
    const p = `[${e} ${bokstav(n)}]`;
    karta.set(fras, p);
    funna.push({ typ: 'namnmodell', grupp, original: fras, platshallare: p });
    return p;
  };
  // Frasen som hela ord. Ett ord som redan har en platshållare får stå som
  // den; hela frasen får då en egen, bredare platshållare ovanpå. Det som
  // var maskerat förblir maskerat.
  const monster = fras => new RegExp(`(?<![\\p{L}\\p{N}_@.-])${fras.split(/\s+/).map(o => {
    const p = karta.get(o);
    return p && plats.has(p) ? `(?:${esc(o)}|${esc(token(plats.get(p)))})` : esc(o);
  }).join('\\s+')}(?![\\p{L}\\p{N}_@-])`, 'gu');

  // Längsta först: "Ylva Björk" före "Björk".
  for (const { fras, grupp } of [...valda].sort((a, b) => b.fras.length - a.fras.length)) {
    if (monster(fras).test(ut)) ut = ut.replace(monster(fras), () => platshallare(fras, grupp));
  }
  ut = ut.replace(TOKEN, (m, s) => lyfta[Number([...s].map(c => SIFFROR.indexOf(c)).join(''))] ?? m);
  // Lösa delar av ett namn modellen just tog ("Mokoena" längre ned) får
  // samma platshållare, som för reglernas namn.
  const delar = maskeraDelar(ut, karta);
  funna.push(...delar.funna);
  return { text: skydd.aterstall(delar.text), karta, raknare, funna };
}
