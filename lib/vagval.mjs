
import { utatGrind, rensaOsynliga } from './failclosed.mjs';
import { renSokfraga, anonymSokfraga } from './uppslag.mjs';
import { tx } from './sprakstod.mjs';

export const KANSLIGT = /(?<![\p{L}])(diagnos\p{L}*|sjukdom\p{L}*|sjukskriv\p{L}*|hälsotillstånd\p{L}*|psykisk\p{L}*|psykiatri\p{L}*|depression|adhd|autism|missbruk\p{L}*|beroende|medicin\p{L}*|läkemedel\p{L}*|graviditet\p{L}*|abort\p{L}*|funktionsnedsättning\p{L}*|lvu|lvm|socialtjänst\p{L}*|orosanmälan\p{L}*|placering\p{L}*|vårdnad\p{L}*|umgänge\p{L}*|försörjningsstöd\p{L}*|brott\p{L}*|misstänkt\p{L}*|dömd|dom\s+i|straff\p{L}*|polisanmälan\p{L}*|religion\p{L}*|religiös\p{L}*|etnisk\p{L}*|sexuell\p{L}*|fackförening\p{L}*|facklig\p{L}*|diagnos[ei]s|diagnosed|illness\p{L}*|disease\p{L}*|sick leave|medical condition\p{L}*|health condition\p{L}*|mental health|mental illness|psychiatr\p{L}*|addiction\p{L}*|addicted|substance abuse|pregnan\p{L}*|disabilit\p{L}*|disabled|social services|child protective services|child protection|custody|foster care|welfare benefits?|crimes?|criminal\p{L}*|convicted|conviction\p{L}*|police report\p{L}*|religious|ethnic\p{L}*|sexual\p{L}*|trade unions?|labou?r unions?|union members?\p{L}*)(?![\p{L}])/iu;
export const PERSONNUMMER = /\b(?:19|20)?\d{6}[-+\u2010-\u2015\u2212]?\d{4}\b/;

export function bararData(fraga) {
  const f = String(fraga || '');
  if (/:\/\//.test(f)) return tx('lib.vagval.adress');
  if (/\bwww\./i.test(f)) return tx('lib.vagval.adress');
  if (/\b[\p{L}\d-]+(?:\.[\p{L}\d-]+)*\.[a-z]{2,}\/\S*/iu.test(f)) return tx('lib.vagval.adress');
  const utanNamn = f.replace(/(?<![\p{L}\d_])\p{L}{1,4}&\p{L}{1,4}(?![\p{L}\d_])/gu, ' ');
  if (/[=@]/.test(f) || /\?(?=\S)/.test(f) || /\S&|&\S/.test(utanNamn)) return tx('lib.vagval.formular');
  for (const t of f.split(/\s+/)) {
    if (t.length > 60) return tx('lib.vagval.lang');
    if (t.length > 30 && !/^[\p{L}-]+[.,;:!?]?$/u.test(t)) return tx('lib.vagval.lang');
    if (t.length >= 20 && /^[A-Za-z0-9+/_=-]+$/.test(t) && /\d/.test(t) && /[A-Za-z]/.test(t)) return tx('lib.vagval.nyckel');
  }
  return null;
}

export function vagval(fraga_, { material: material_ = '', publika: publika_ = [] } = {}) {
  const fraga = rensaOsynliga(fraga_);
  const material = rensaOsynliga(material_);
  const publika = (publika_ || []).map(rensaOsynliga);
  const data = bararData(fraga);
  if (data) return { webb: false, form: null, varfor: tx('lib.vagval.data', { data }) };
  const allt = `${fraga}\n${material}`;
  if (PERSONNUMMER.test(allt)) {
    return { webb: false, form: null, varfor: tx('lib.vagval.personnummer') };
  }
  if (KANSLIGT.test(allt)) {
    const anonym = renSokfraga(anonymSokfraga(renSokfraga(utatGrind(fraga)), { material: `${fraga}\n${material}` })
      .replace(/\b\d+\b(?!\s*(?:kap|§))/g, ' ').replace(/\s+/g, ' '));
    if (!anonym || anonym.split(/\s+/).length < 2) return { webb: false, form: null, varfor: tx('lib.vagval.kansligtTomt') };
    return { webb: true, form: 'anonym', fraga: anonym, varfor: tx('lib.vagval.kansligt') };
  }
  if (publika.length) {
    const utan = publika.reduce((t, n) => t.split(n).join(' '), fraga);
    if (publika.some(n => fraga.includes(n)) && renSokfraga(utatGrind(utan)) === renSokfraga(utan)) {
      return { webb: true, form: 'original', fraga: renSokfraga(fraga), varfor: tx('lib.vagval.publika') };
    }
  }
  const maskerad = renSokfraga(utatGrind(fraga));
  if (maskerad !== renSokfraga(fraga)) {
    if (!maskerad) return { webb: false, form: null, varfor: tx('lib.vagval.baraNamn') };
    return { webb: true, form: 'maskerad', fraga: maskerad, varfor: tx('lib.vagval.maskerad') };
  }
  return { webb: true, form: 'original', fraga: renSokfraga(fraga), varfor: tx('lib.vagval.original') };
}

export const FORMNAMN = {
  get original() { return tx('lib.vagval.form.original'); },
  get maskerad() { return tx('lib.vagval.form.maskerad'); },
  get anonym() { return tx('lib.vagval.form.anonym'); },
};
