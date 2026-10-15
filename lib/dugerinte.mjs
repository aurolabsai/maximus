import { granska } from './maskering.mjs';
import { tx, aktuellt } from './sprakstod.mjs';

const ADRESS = /^\s*https?:\/\/\S+\s*$/;
const BETECKNING = /^\s*(SOU|Prop\.|Ds|Dir\.|Bet\.|SFS|NJA|RÅ|HFD|MÖD|AD)\s*\d{4}/i;

const BARANDE = [
  /\d+\s*§/,
  /\d+\s*kap\./i,
  /[.!?]\s+[A-ZÅÄÖ]/,
];

export function ärLista(text) {
  const rader = String(text || '').split('\n').map(r => r.trim()).filter(Boolean);
  if (rader.length < 3) return false;
  const lank = rader.filter(r => ADRESS.test(r) || BETECKNING.test(r)).length;
  return lank / rader.length >= 0.4;
}

export function duger(text, { minsta = 200 } = {}) {
  const t = String(text || '').trim();
  if (!t) return tx('pars.dugerinte.tom');
  if (t.length < minsta) return tx('pars.dugerinte.forLite');
  if (ärLista(t)) return tx('pars.dugerinte.lista');

  const brod = t.replace(/^\s*https?:\/\/\S+\s*$/gm, '');
  if (!BARANDE.some(r => r.test(brod))) return tx('pars.dugerinte.rubriker');
  return null;
}

const TAL = /(?<![\w.,:])(?<!\d{4}:)(\d{1,3}(?:[\s ]\d{3})+|\d{4,})(?:[,.]\d+)?(?![\w:])/g;

const TAL_EN = /(?<![\w.,:])(\d{1,3}(?:,\d{3}){2,}(?:\.\d+)?|\d{1,3},\d{3}\.\d+)(?![\w:,]|\.\d)/g;
const TAL_EN_ETT = /(?<![\w.,:])(\d{1,3},\d{3})(?![\w:,.])/g;
const talen = text => {
  const t = String(text || '');
  const en = [...t.matchAll(TAL_EN), ...(aktuellt() === 'en' ? [...t.matchAll(TAL_EN_ETT)] : [])];
  const sv = [...t.matchAll(TAL)].filter(m => !en.some(e => m.index >= e.index && m.index < e.index + e[0].length));
  return [...en.map(m => ({ text: m[0], tal: m[0].replace(/,/g, '') })), ...sv.map(m => ({ text: m[0], tal: normalisera(m[0]) }))];
};

const normalisera = t => String(t).replace(/[\s ]/g, '').replace(',', '.');

function arIdentifierare(text) {
  const kvar = granska(String(text || ''));
  if (!kvar.length) return () => false;
  const siffror = new Set();
  for (const k of kvar) {
    const varde = String(k.varde ?? '');
    const rent = varde.replace(/\D/g, '');
    if (rent.length >= 4) siffror.add(rent);
    for (const bit of varde.split(/\D+/)) if (bit.length >= 4) siffror.add(bit);
  }
  return tal => siffror.has(String(tal).replace(/\D/g, ''));
}

export function opåkomnaTal(svar, underlag, { minsta = 1000 } = {}) {
  const fanns = new Set();
  for (const m of talen(underlag)) fanns.add(String(Number(m.tal)));
  const identifierare = arIdentifierare(svar);
  const ut = [];
  for (const { text: hel, tal } of talen(svar)) {
    const m = [hel];
    const n = Number(tal);
    if (identifierare(m[0])) continue;
    if (!Number.isFinite(n) || n < minsta) continue;
    if (/^\d{4}$/.test(m[0]) && n >= 1900 && n <= 2100) continue;
    if (!fanns.has(String(n))) ut.push(m[0]);
  }
  return [...new Set(ut)];
}
