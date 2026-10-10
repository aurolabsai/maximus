// Flera mejlkonton och kalendrar, var och en med en etikett (2026-10-10).
//
// Auro 2026-10-10: "E-post och kalender ska vara flerval, och vi ska kunna
// beskriva eller kategorisera dem (privat, professionell). Det här är ganska
// viktigt."
//
// Förut: ett konto och en brevlåda (`epost: { konto, lada }`), kalendrarna
// alla eller inga, och privat eller jobb gissat av modellen per fynd. Den
// visste inte att allt i jobbkontot är jobb. Nu bär källan sin etikett, och
// etiketten är svaret — modellen gissar bara där källan inte säger något.
//
// Etiketten är en kod i datat: 'privat', 'jobb', eller fri text som den
// skrevs ("styrelsen", "familjen"). Privat och Jobb visas på ditt språk
// (Private och Work på engelska); fri text visas som du skrev den.
//
// Formen i installningar.agent:
//
//     epost:    { konton: [{ konto, lador: ['INBOX', ...], etikett }],
//                 konto, lada }          ← det första kontot, för äldre läsare
//     kalender: { kalendrar: [{ id, namn, konto, etikett }] }
//                                        ← tom lista: alla kalendrar, utan etikett
//
// En gammal fil (`{ konto, lada }`, kalendrar som namn) läses som en lista
// med ett konto — ingenting går förlorat, och ingenting behöver skrivas om
// för att fungera. Provet test/konton.test.mjs läser en sådan.
//
// Ren logik: ingenting här rör Mail eller Kalender. Läsningen kommer in som
// en funktion, som i lib/agent.mjs.

import { tx } from './sprakstod.mjs';
import { arNyhetsbrev } from './nyheter.mjs';

const TAK_KONTON = 12, TAK_LADOR = 10, TAK_KALENDRAR = 30;

/// Text ur indata: utan styrtecken, ihoptryckt, med tak.
const text = (v, tak) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, tak);

// ── Etiketten ─────────────────────────────────────────────────────────────

const PRIVAT = /^(privat|private|personlig|personal|privat liv|hem|home)$/i;
const JOBB = /^(jobb|jobbet|work|arbete|tjänst|professionell|professional|job)$/i;

/// En etikett ur det som kom in. 'privat', 'jobb', fri text (högst 40
/// tecken, som den skrevs) eller null — ingen etikett, modellen gissar.
export function etikettUr(v) {
  const t = text(v, 40);
  if (!t) return null;
  if (PRIVAT.test(t)) return 'privat';
  if (JOBB.test(t)) return 'jobb';
  return t;
}

/// Etiketten som den visas, på det språk som gäller. Fri text som den är.
export const etikettNamn = e => (e === 'privat' ? tx('lib.konton.privat') : e === 'jobb' ? tx('lib.konton.jobb') : e ? String(e) : tx('lib.konton.ingen'));

// Adresser hos de stora gratistjänsterna: ett sådant konto är någons eget.
const PUBLIKA = /@(icloud\.com|me\.com|mac\.com|gmail\.com|googlemail\.com|hotmail\.[a-z.]+|outlook\.com|live\.[a-z.]+|msn\.com|yahoo\.[a-z.]+|ymail\.com|aol\.com|proton\.me|protonmail\.(com|ch)|pm\.me|gmx\.[a-z.]+|tutanota\.(com|de)|telia\.com|bredband\.net|comhem\.se|spray\.se|tele2\.se|bahnhof\.se)$/i;
const NAMN_PRIVAT = /\b(icloud|gmail|hotmail|yahoo|privat|private|personal|hem|home|familj|familjen|family|födelsedag\w*|birthdays?)\b/i;
const NAMN_JOBB = /\b(exchange|office\s*365|microsoft\s*365|arbete|work|jobb|jobbet|företag\w*|kontor\w*|office)\b/i;

/// Förvalet ur kontots namn och adress, när det är uppenbart: en adress hos
/// iCloud eller Gmail är privat, en egen domän är jobb. Ett namn som säger
/// det ("Arbete", "Hem") räcker också. Annars null — och då frågar
/// gränssnittet i stället för att gissa.
export function forvalEtikett({ namn = '', adress = '', konto = '' } = {}) {
  const a = String(adress || '').trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) return PUBLIKA.test(a) ? 'privat' : 'jobb';
  // En kalender ärver ofta sitt konto: "iCloud", eller kontots adress.
  const k = String(konto || '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k)) return PUBLIKA.test(k.toLowerCase()) ? 'privat' : 'jobb';
  for (const s of [namn, k]) {
    if (NAMN_JOBB.test(String(s || ''))) return 'jobb';
    if (NAMN_PRIVAT.test(String(s || ''))) return 'privat';
  }
  return null;
}

// ── E-posten ──────────────────────────────────────────────────────────────

/// E-postens inställning, i den nya formen, ur vilken form som helst: den
/// gamla (`{ konto, lada }`) eller den nya (`{ konton: [...] }`). Null när
/// inget konto finns — då är e-posten av.
export function epostUr(v) {
  if (!v || typeof v !== 'object') return null;
  const lista = Array.isArray(v.konton) ? v.konton
    : v.konto ? [{ konto: v.konto, lador: [v.lada || 'INBOX'], etikett: v.etikett }] : [];
  const konton = [];
  for (const k of lista) {
    if (konton.length >= TAK_KONTON) break;
    const konto = text(k?.konto, 120);
    if (!konto || konton.some(x => x.konto === konto)) continue;
    const in_ = Array.isArray(k.lador) ? k.lador : [k.lada || 'INBOX'];
    const lador = [...new Set(in_.map(l => text(l, 120)).filter(Boolean))].slice(0, TAK_LADOR);
    konton.push({ konto, lador: lador.length ? lador : ['INBOX'], etikett: etikettUr(k.etikett) });
  }
  if (!konton.length) return null;
  // Det första kontot också i den gamla formen: äldre läsare (och en äldre
  // version av appen) ser då ett konto i stället för inget.
  return { konton, konto: konton[0].konto, lada: konton[0].lador[0] };
}

/// Varje brevlåda agenten läser, med sitt konto och sin etikett.
export const epostKallor = epost => (epostUr(epost)?.konton || [])
  .flatMap(k => k.lador.map(lada => ({ konto: k.konto, lada, etikett: k.etikett })));

/// Är kontot ett av dem agenten fått läsa?
export const harKonto = (epost, konto) => Boolean(konto) && (epostUr(epost)?.konton || []).some(k => k.konto === konto);

/// Kontots etikett, eller null.
export const kontoEtikett = (epost, konto) => (epostUr(epost)?.konton || []).find(k => k.konto === konto)?.etikett || null;

/// Postens id i vattenmärket. Den första lådan behåller brevets eget id —
/// så såg märket ut när det bara fanns en, och en uppdatering ska inte göra
/// hela inkorgen ny. De andra får kontot och lådan framför, så att samma
/// brev i två konton är två poster.
const postId = (i, kalla, id) => (i === 0 ? String(id) : `${kalla.konto}/${kalla.lada}:${id}`);

/// Läser alla lådor. `brev(konto, { lada, antal, utskick })` är lib/post.mjs
/// eller provets ersättare. Varje post bär sitt konto och sin etikett.
///
/// En låda som inte går att läsa stoppar inte de andra: felen följer med på
/// listan (`kallfel`), och lib/agent.mjs säger dem. Först när INGEN gick
/// kastas det första felet, som när det bara fanns en.
export async function lasEpost(epost, { brev, antal = 60, utskick = false, nyhetsbrev = false } = {}) {
  const kallor = epostKallor(epost);
  const ut = [], fel = [];
  for (const [i, k] of kallor.entries()) {
    let lista;
    try { lista = await brev(k.konto, { lada: k.lada, antal, utskick: utskick || nyhetsbrev }); }
    catch (e) { fel.push({ kalla: `${k.konto} · ${k.lada}`, fel: e.message || String(e), e }); continue; }
    for (const b of lista || []) {
      // Nyheternas källa (2026-10-09): bara utskick, aldrig personlig post.
      if (nyhetsbrev && !(b.utskick || arNyhetsbrev(b.fran, { avregistrering: b.utskick }))) continue;
      ut.push({ id: postId(i, k, b.id), titel: b.amne, fran: b.fran, tid: b.tid, text: b.amne,
        ...(k.etikett ? { etikett: k.etikett } : {}),
        // Var brevet ligger, så att ett svar går från just det kontot.
        brev: nyhetsbrev ? { konto: k.konto, id: b.id, lada: k.lada } : { konto: k.konto, id: b.id, lada: k.lada, utskick: b.utskick } });
    }
  }
  // Med flera konton (punkt 10): sa macOS nej till något av dem är det det
  // som sägs — inte ett annat kontos tidsgräns — så att raden i listan får
  // knappen till rätt ruta i Systeminställningar.
  if (kallor.length && fel.length === kallor.length) throw (fel.find(x => x.e?.tillstand) || fel[0]).e;
  return Object.assign(ut, { kallfel: fel.map(({ kalla, fel: f, e }) => ({ kalla, fel: f, ...(e?.tillstand ? { tillstand: true } : {}) })) });
}

// ── Kalendrarna ───────────────────────────────────────────────────────────

/// Kalenderns inställning ur vilken form som helst. Namn som strängar (den
/// gamla formen) blir kalendrar utan etikett. Tom lista: alla kalendrar.
export function kalenderUr(v) {
  if (!v || typeof v !== 'object') return null;
  const kalendrar = [];
  for (const x of Array.isArray(v.kalendrar) ? v.kalendrar : []) {
    if (kalendrar.length >= TAK_KALENDRAR) break;
    const k = typeof x === 'string' ? { namn: x } : (x && typeof x === 'object' ? x : null);
    const namn = text(k?.namn, 120), id = text(k?.id, 200) || null;
    if (!namn && !id) continue;
    if (kalendrar.some(y => (id && y.id === id) || (!id && !y.id && y.namn === namn))) continue;
    kalendrar.push({ id, namn: namn || id, konto: text(k.konto, 120) || null, etikett: etikettUr(k.etikett) });
  }
  return { kalendrar };
}

/// Hör händelsen till en vald kalender, och med vilken etikett? På id när
/// händelsen har ett (två kalendrar kan heta "Kalender"), annars på namn.
/// Inga valda kalendrar: alla läses, utan etikett — så som förut.
export function kalenderFor(kalender, h) {
  const lista = kalenderUr(kalender)?.kalendrar || [];
  if (!lista.length) return { med: true, etikett: null };
  const k = lista.find(x => x.id && h?.kalenderId && x.id === h.kalenderId)
    || lista.find(x => x.namn === h?.kalender && (!x.id || !h?.kalenderId));
  return k ? { med: true, etikett: k.etikett } : { med: false, etikett: null };
}

/// Kalendern för ett mötesförslag: den första valda med samma etikett som
/// underlaget. Null när ingen har den — då väljer du i Kalender.
export function kalenderMedEtikett(kalender, etikett) {
  if (!etikett) return null;
  const k = (kalenderUr(kalender)?.kalendrar || []).find(x => x.etikett === etikett);
  return k ? { id: k.id, namn: k.namn, etikett: k.etikett } : null;
}

// ── Allt ihop ─────────────────────────────────────────────────────────────

/// Etiketterna som finns bland källorna, i den ordning de står. För
/// filtren och för uppdragets "bara jobb".
export function etiketter(agent = {}) {
  const ut = [];
  for (const k of epostUr(agent?.epost)?.konton || []) if (k.etikett && !ut.includes(k.etikett)) ut.push(k.etikett);
  for (const k of kalenderUr(agent?.kalender)?.kalendrar || []) if (k.etikett && !ut.includes(k.etikett)) ut.push(k.etikett);
  return ut;
}

/// Källorna i ord: "Jobb (Jobb), iCloud (Privat)". För beskeden.
export const somText = lista => lista.map(k => (k.etikett ? `${k.namn} (${etikettNamn(k.etikett)})` : k.namn)).join(', ');
