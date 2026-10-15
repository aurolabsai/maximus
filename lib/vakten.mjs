
import { tx, text, tillgangliga } from './sprakstod.mjs';
import { createHash } from 'node:crypto';
import { svarUr, LISTA } from './telefon.mjs';

export const tomtLage = () => ({ avtryck: {}, ko: [], spar: {}, pausat: {}, lov: {}, sagt: {} });
export function lageUr(v) {
  const t = tomtLage();
  if (!v || typeof v !== 'object') return t;
  for (const k of Object.keys(t)) if (v[k] && typeof v[k] === typeof t[k] && Array.isArray(v[k]) === Array.isArray(t[k])) t[k] = v[k];
  return t;
}

export function normalisera(t) {
  return svarUr(String(t ?? '')).normalize('NFKC')
    .replace(/^\s*✓\s*/, '').toLowerCase().replace(/\s+/g, ' ').replace(/[\s.!?…]+$/, '').trim();
}

export function egnaRader(logg = {}, { liggarrader = [] } = {}) {
  const telefonrader = liggarrader.filter(r => r?.vag === 'telefon' && r.skickat && !r.fel);
  return (logg.paminnelser || []).map(x => ({ id: x.id, extern: x.extern || null,
    text: x.text || telefonrader.find(r => Math.abs(Date.parse(r.tid) - Date.parse(x.tid)) < 60e3)?.skickat || '' }));
}

function matcha(poster = [], egna = []) {
  const iListan = poster.filter(p => p?.lista === LISTA);
  const finns = new Set(iListan.flatMap(p => [p.id, p.extern].filter(Boolean)));
  const ut = new Map();
  for (const [i, e] of egna.entries()) {
    const p = iListan.find(q => (e.id && q.id === e.id) || (e.extern && q.extern === e.extern));
    if (p) ut.set(p, { i, saett: 'id' });
  }
  const kandaId = new Set(egna.flatMap(e => [e.id, e.extern].filter(Boolean)));
  for (const [i, e] of egna.entries()) {
    if ((e.id && finns.has(e.id)) || (e.extern && finns.has(e.extern))) continue;
    const n = normalisera(e.text);
    if (n.length < 4) continue;
    const p = iListan.find(q => !ut.has(q) && !kandaId.has(q.id) && normalisera(q.titel) === n);
    if (p) ut.set(p, { i, saett: 'text' });
  }
  return ut;
}

export function eko(poster = [], egna = [], { kalltyp = '' } = {}) {
  if (kalltyp !== 'paminnelser') return { kvar: poster, eko: [] };
  const m = matcha(poster, egna);
  return { kvar: poster.filter(p => !m.has(p)), eko: poster.filter(p => m.has(p)) };
}

export function lagaTelefonlogg(poster = [], logg = {}, { liggarrader = [] } = {}) {
  const egna = egnaRader(logg, { liggarrader });
  const paminnelser = (logg.paminnelser || []).map(x => ({ ...x }));
  let lagade = 0;
  for (const [p, { i, saett }] of matcha(poster, egna)) {
    if (saett !== 'text') continue;
    const x = paminnelser[i];
    x.tidigare = [...new Set([...(x.tidigare || []), x.id, x.extern].filter(Boolean))].slice(-4);
    x.id = p.id;
    if (p.extern) x.extern = p.extern;
    x.text ||= egna[i].text;
    lagade++;
  }
  return { logg: { ...logg, paminnelser }, lagade };
}

export const avtryck = p => createHash('sha256').update(`${normalisera(p?.titel || p?.amne || '')}|${p?.tid || ''}`).digest('hex').slice(0, 16);
export const AVTRYCK_TAK = 1500;

export function minnsAvtryck(sedda = [], poster = []) {
  return [...new Set([...poster.map(avtryck), ...sedda])].slice(0, AVTRYCK_TAK);
}

export function flod({ nya = [], sedda = [], marke = {} } = {}) {
  const kanda = new Set(sedda);
  const sedan = Date.parse(marke.nar || '');
  const efter = p => Number.isFinite(sedan) && Date.parse(p?.tid || '') > sedan;
  const aterkomna = nya.filter(p => kanda.has(avtryck(p)) && !efter(p));
  if (aterkomna.length < 5 || aterkomna.length < nya.length / 2) return null;
  return { sort: Object.keys(marke.sedda || {}).length ? 'idBytta' : 'tappat', antal: aterkomna.length, av: nya.length,
    behall: nya.filter(p => !aterkomna.includes(p)), undan: aterkomna };
}

const MODELLTEXTER = ['lib.lokal.svaradeInte', 'kanal.inteITid', 'lib.modell.ingetMinne', 'lib.modell.startadeInte'];
export function arModellfel(e) {
  if (!e) return false;
  if (e.borde_starta_om || e.modellenSvarar === false) return true;
  const m = String(e.message || e);
  for (const kod of tillgangliga()) for (const k of MODELLTEXTER) { const t = text(kod, k); if (t && t !== k && m.includes(t)) return true; }
  return /ECONNREFUSED|ECONNRESET|socket hang up|fetch failed|Loading model|loading model|\b503\b/.test(m);
}

export const KO_TAK_MS = 2 * 3600e3;
export const KO_MAX = 20;

export function koa(lage, sak, nu = new Date()) {
  const ny = !lage.ko.length;
  const ko = [...lage.ko.filter(x => x.id !== sak.id), { ...sak, koad: sak.koad || new Date(nu).toISOString() }].slice(-KO_MAX);
  return { lage: { ...lage, ko }, ny };
}

export function nastaIKon(lage, nu = new Date()) {
  const t = new Date(nu).getTime();
  const gavUpp = lage.ko.filter(x => t - Date.parse(x.koad) > KO_TAK_MS);
  const ko = lage.ko.filter(x => !gavUpp.includes(x));
  return { lage: { ...lage, ko }, nasta: ko[0] || null, gavUpp };
}
export const urKon = (lage, id) => ({ ...lage, ko: lage.ko.filter(x => x.id !== id) });

export const LOOP_GANGER = 3;
export const LOOP_FONSTER_MS = 2 * 3600e3;
export const LOOP_PAUS_MS = 6 * 3600e3;

export function upprepning(lage, nyckel, avtryck, nu = new Date(), { ganger = LOOP_GANGER, fonster = LOOP_FONSTER_MS } = {}) {
  const t = new Date(nu).getTime();
  const a = normalisera(avtryck).slice(0, 200);
  if (!a) return { lage, ganger: 0, loop: false };
  const fore = (lage.spar[nyckel] || []).filter(x => t - Date.parse(x.tid) < fonster);
  const lista = [...fore, { a, tid: new Date(nu).toISOString() }].slice(-30);
  const antal = lista.filter(x => x.a === a).length;
  const spar = { ...lage.spar, [nyckel]: lista };
  const nycklar = Object.keys(spar);
  if (nycklar.length > 200) for (const k of nycklar.slice(0, nycklar.length - 200)) delete spar[k];
  return { lage: { ...lage, spar }, ganger: antal, loop: antal >= ganger };
}

export const pausa = (lage, kalla, nu = new Date(), ms = LOOP_PAUS_MS) =>
  ({ ...lage, pausat: { ...lage.pausat, [kalla]: new Date(new Date(nu).getTime() + ms).toISOString() } });
export const arPausad = (lage, kalla, nu = new Date()) =>
  Boolean(lage.pausat[kalla] && Date.parse(lage.pausat[kalla]) > new Date(nu).getTime());

export function lovBorta(lage, { nekade = [], fungerar = [] } = {}, nu = new Date()) {
  const lov = { ...lage.lov };
  for (const k of fungerar) delete lov[k];
  const nya = [];
  for (const k of new Set(nekade)) if (!lov[k]) { lov[k] = new Date(nu).toISOString(); nya.push(k); }
  return { lage: { ...lage, lov }, nya };
}

export const SAGT_MS = 6 * 3600e3;
export function farSagas(lage, nyckel, nu = new Date()) {
  const t = new Date(nu).getTime();
  const sagt = Object.fromEntries(Object.entries(lage.sagt).filter(([, v]) => t - Date.parse(v) < SAGT_MS));
  if (sagt[nyckel]) return { lage: { ...lage, sagt }, ja: false };
  return { lage: { ...lage, sagt: { ...sagt, [nyckel]: new Date(nu).toISOString() } }, ja: true };
}

export function lagning(sort, varden = {}) {
  const v = { ...varden };
  const L = {
    eko: () => ({ vad: tx('vakten.eko.vad', { n: v.n }), gjorde: tx('vakten.eko.gjorde') }),
    ekoTelefon: () => ({ vad: tx('vakten.eko.telefonVad', { n: v.n }), gjorde: tx('vakten.eko.telefonGjorde') }),
    idBytta: () => ({ vad: tx('vakten.flod.idBytta', { kalla: v.kalla, n: v.antal, av: v.av }), gjorde: tx('vakten.flod.gjorde') }),
    tappat: () => ({ vad: tx('vakten.flod.tappat', { kalla: v.kalla, n: v.antal }), gjorde: tx('vakten.flod.gjorde') }),
    modell: () => ({ vad: tx('vakten.modell.vad', { vad: v.vad }), gjorde: tx('vakten.modell.gjorde') }),
    modellGavUpp: () => ({ vad: tx('vakten.modell.gavUppVad', { timmar: Math.round(KO_TAK_MS / 3600e3) }), gjorde: tx('vakten.modell.gavUppGjorde', { n: v.n }), rapport: true }),
    lov: () => ({ vad: tx('vakten.lov.vad', { kalla: v.kalla }), gjorde: tx('vakten.lov.gjorde') }),
    dubbletter: () => ({ vad: tx('vakten.loop.fyndVad', { titel: v.titel, n: v.n }), gjorde: tx('vakten.loop.fyndGjorde') }),
    dubbletterTelefon: () => ({ vad: tx('vakten.loop.telefonVad', { n: v.n }), gjorde: tx('vakten.loop.telefonGjorde') }),
    loopSvar: () => ({ vad: tx('vakten.loop.svarVad', { n: v.n }), gjorde: tx('vakten.loop.svarGjorde', { timmar: LOOP_PAUS_MS / 3600e3 }) }),
  };
  const r = (L[sort] || (() => ({ vad: String(v.vad || sort), gjorde: '', rapport: true })))();
  return { sort, ...r, rapport: Boolean(r.rapport) };
}

export const rad = l => tx('vakten.rad', { vad: l.vad, gjorde: l.gjorde }).trim();

export const rapportText = l => tx('vakten.rapport', { vad: l.vad, sort: l.sort });
