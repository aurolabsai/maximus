
import { arUtkast } from './md.js';
import { t } from './sprakstod.js';

const DU = /\b(du|dig|din|ditt|dina|ni|er|ert|era|you|your|yours|yourself|yourselves)\b/i;
const PUNKT = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;

const ren = t => String(t)
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[*_`~]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export function fragorna(svar, { hogst = 6, fraga = '' } = {}) {
  const text = String(svar ?? '').replace(/\r/g, '');
  const rader = text.split('\n');
  const ut = [];
  const sedda = new Set();
  const egna = delfragor(fraga);
  let iBlock = false;
  let langst = 0;

  for (const rad of rader) {
    if (/^\s*```/.test(rad)) {
      iBlock = iBlock ? false : !arUtkast(rad.trim().slice(3).trim());
      continue;
    }
    if (iBlock) continue;
    if (/^\s*#{1,6}\s/.test(rad)) continue;
    if (/^\s*>/.test(rad)) continue;

    const punkt = PUNKT.exec(rad);
    const radtext = ren(punkt ? punkt[2] : rad);
    if (!radtext.endsWith('?')) continue;
    const delar = radtext.split(/(?<=[.!?])\s+(?=\p{Lu})/u);
    const fragan = delar[delar.length - 1].trim();
    if (fragan.length < 10 || fragan.length > 220) continue;
    if (!punkt && !DU.test(fragan)) continue;

    const nyckel = normalisera(fragan);
    if (sedda.has(nyckel)) continue;
    if (arEko(nyckel, egna)) continue;
    sedda.add(nyckel);
    langst = Math.max(langst, text.indexOf(rad));
    ut.push(fragan);
    if (ut.length >= hogst) break;
  }

  if (text.length > 1200 && langst < text.length * 0.5) return [];
  return ut;
}

function delfragor(t) {
  return String(t ?? '')
    .split(/(?<=\?)\s+/)
    .map(d => normalisera(d))
    .filter(d => d.length >= 8)
    .map(d => new Set(d.split(' ').filter(Boolean)));
}

function arEko(kandidat, egna) {
  const a = new Set(String(kandidat).split(' ').filter(Boolean));
  if (!a.size) return false;
  for (const b of egna) {
    let traff = 0;
    for (const o of a) if (b.has(o)) traff++;
    if (traff / a.size >= 0.75) return true;
  }
  return false;
}

const normalisera = t => String(t ?? '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/(?<![\p{L}\d])(och|samt|men|dom|dessa|dom här|de|den|det|dessa|just|and|but|also|the|a|an|these|those|this|that)(?![\p{L}\d])/giu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export function sammanstall(par) {
  const svarade = par.filter(p => p.svar?.trim());
  if (!svarade.length) return '';
  const stycken = svarade.map(p => `> ${p.fraga}\n\n${p.svar.trim()}`);
  const kvar = par.filter(p => !p.svar?.trim()).map(p => p.fraga);
  if (kvar.length) {
    stycken.push(kvar.length === 1
      ? t('fragor.oneUnanswered', { fraga: kvar[0] })
      : t('fragor.manyUnanswered', { fragor: kvar.map(f => `- ${f}`).join('\n') }));
  }
  return stycken.join('\n\n');
}
