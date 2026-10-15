
import { tx } from './sprakstod.mjs';
import { arNyhetsbrev } from './nyheter.mjs';

const TAK_KONTON = 12, TAK_LADOR = 10, TAK_KALENDRAR = 30;

const text = (v, tak) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, tak);

const PRIVAT = /^(privat|private|personlig|personal|privat liv|hem|home)$/i;
const JOBB = /^(jobb|jobbet|work|arbete|tjänst|professionell|professional|job)$/i;

export function etikettUr(v) {
  const t = text(v, 40);
  if (!t) return null;
  if (PRIVAT.test(t)) return 'privat';
  if (JOBB.test(t)) return 'jobb';
  return t;
}

export const etikettNamn = e => (e === 'privat' ? tx('lib.konton.privat') : e === 'jobb' ? tx('lib.konton.jobb') : e ? String(e) : tx('lib.konton.ingen'));

const PUBLIKA = /@(icloud\.com|me\.com|mac\.com|gmail\.com|googlemail\.com|hotmail\.[a-z.]+|outlook\.com|live\.[a-z.]+|msn\.com|yahoo\.[a-z.]+|ymail\.com|aol\.com|proton\.me|protonmail\.(com|ch)|pm\.me|gmx\.[a-z.]+|tutanota\.(com|de)|telia\.com|bredband\.net|comhem\.se|spray\.se|tele2\.se|bahnhof\.se)$/i;
const NAMN_PRIVAT = /\b(icloud|gmail|hotmail|yahoo|privat|private|personal|hem|home|familj|familjen|family|födelsedag\w*|birthdays?)\b/i;
const NAMN_JOBB = /\b(exchange|office\s*365|microsoft\s*365|arbete|work|jobb|jobbet|företag\w*|kontor\w*|office)\b/i;

export function forvalEtikett({ namn = '', adress = '', konto = '' } = {}) {
  const a = String(adress || '').trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) return PUBLIKA.test(a) ? 'privat' : 'jobb';
  const k = String(konto || '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k)) return PUBLIKA.test(k.toLowerCase()) ? 'privat' : 'jobb';
  for (const s of [namn, k]) {
    if (NAMN_JOBB.test(String(s || ''))) return 'jobb';
    if (NAMN_PRIVAT.test(String(s || ''))) return 'privat';
  }
  return null;
}

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
  return { konton, konto: konton[0].konto, lada: konton[0].lador[0] };
}

export const epostKallor = epost => (epostUr(epost)?.konton || [])
  .flatMap(k => k.lador.map(lada => ({ konto: k.konto, lada, etikett: k.etikett })));

export const harKonto = (epost, konto) => Boolean(konto) && (epostUr(epost)?.konton || []).some(k => k.konto === konto);

export const kontoEtikett = (epost, konto) => (epostUr(epost)?.konton || []).find(k => k.konto === konto)?.etikett || null;

const postId = (i, kalla, id) => (i === 0 ? String(id) : `${kalla.konto}/${kalla.lada}:${id}`);

export async function lasEpost(epost, { brev, antal = 60, utskick = false, nyhetsbrev = false } = {}) {
  const kallor = epostKallor(epost);
  const ut = [], fel = [];
  for (const [i, k] of kallor.entries()) {
    let lista;
    try { lista = await brev(k.konto, { lada: k.lada, antal, utskick: utskick || nyhetsbrev }); }
    catch (e) { fel.push({ kalla: `${k.konto} · ${k.lada}`, fel: e.message || String(e), e }); continue; }
    for (const b of lista || []) {
      if (nyhetsbrev && !(b.utskick || arNyhetsbrev(b.fran, { avregistrering: b.utskick }))) continue;
      ut.push({ id: postId(i, k, b.id), titel: b.amne, fran: b.fran, tid: b.tid, text: b.amne,
        ...(k.etikett ? { etikett: k.etikett } : {}),
        brev: nyhetsbrev ? { konto: k.konto, id: b.id, lada: k.lada } : { konto: k.konto, id: b.id, lada: k.lada, utskick: b.utskick } });
    }
  }
  if (kallor.length && fel.length === kallor.length) throw (fel.find(x => x.e?.tillstand) || fel[0]).e;
  return Object.assign(ut, { kallfel: fel.map(({ kalla, fel: f, e }) => ({ kalla, fel: f, ...(e?.tillstand ? { tillstand: true } : {}) })) });
}

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

export function kalenderFor(kalender, h) {
  const lista = kalenderUr(kalender)?.kalendrar || [];
  if (!lista.length) return { med: true, etikett: null };
  const k = lista.find(x => x.id && h?.kalenderId && x.id === h.kalenderId)
    || lista.find(x => x.namn === h?.kalender && (!x.id || !h?.kalenderId));
  return k ? { med: true, etikett: k.etikett } : { med: false, etikett: null };
}

export function kalenderMedEtikett(kalender, etikett) {
  if (!etikett) return null;
  const k = (kalenderUr(kalender)?.kalendrar || []).find(x => x.etikett === etikett);
  return k ? { id: k.id, namn: k.namn, etikett: k.etikett } : null;
}

export function etiketter(agent = {}) {
  const ut = [];
  for (const k of epostUr(agent?.epost)?.konton || []) if (k.etikett && !ut.includes(k.etikett)) ut.push(k.etikett);
  for (const k of kalenderUr(agent?.kalender)?.kalendrar || []) if (k.etikett && !ut.includes(k.etikett)) ut.push(k.etikett);
  return ut;
}

export const somText = lista => lista.map(k => (k.etikett ? `${k.namn} (${etikettNamn(k.etikett)})` : k.namn)).join(', ');
