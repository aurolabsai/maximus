
import { tx } from './sprakstod.mjs';

const ORD_EN = {
  one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fortyfive: 45, sixty: 60, ninety: 90,
};

const ORD = {
  en: 1, ett: 1, två: 2, tre: 3, fyra: 4, fem: 5, sex: 6, sju: 7, åtta: 8,
  nio: 9, tio: 10, elva: 11, tolv: 12, fjorton: 14, femton: 15, tjugo: 20,
  trettio: 30, sextio: 60, nittio: 90,
};

const ENHETER = {
  dag: 'dagar', dagar: 'dagar', dygn: 'dagar',
  arbetsdagar: 'arbetsdagar', vardagar: 'arbetsdagar',
  vecka: 'veckor', veckor: 'veckor', veckas: 'veckor',
  månad: 'månader', månader: 'månader', månaders: 'månader',
  år: 'år', års: 'år',
  day: 'dagar', days: 'dagar', "day's": 'dagar', "days'": 'dagar',
  'business days': 'arbetsdagar', 'working days': 'arbetsdagar', 'business day': 'arbetsdagar', 'working day': 'arbetsdagar',
  week: 'veckor', weeks: 'veckor', "week's": 'veckor', "weeks'": 'veckor',
  month: 'månader', months: 'månader', "month's": 'månader', "months'": 'månader',
  year: 'år', years: 'år', "year's": 'år', "years'": 'år',
};

const tal = t => {
  const s = String(t).toLowerCase().trim();
  return ORD[s] ?? ORD_EN[s.replace(/[\s-]+/g, '')] ?? (/^\d{1,4}$/.test(s) ? Number(s) : null);
};

export function stadaAnkare(rå) {
  let a = String(rå || '').replace(/\s+/g, ' ').trim()
    .replace(/^(från|efter|räknat från|att räkna från|from|after|of|counting from|calculated from)\s+/i, '')
    .replace(/\bthe (?:appellant|applicant|claimant|complainant|employee)\b/gi, 'you')
    .replace(/\bden som överklagar\b/gi, 'du')
    .replace(/\bklaganden\b/gi, 'du')
    .replace(/\bsökanden\b/gi, 'du')
    .replace(/\barbetstagaren\b/gi, 'du')
    .replace(/\bfick del av\b/gi, 'fick del av')
    .replace(/[,;].*$/, '')
    .trim();
  a = a.replace(/\s+(och|samt|dock|om|när|såvida|förutsatt|and|unless|provided|if|however)\b.*$/i, '')
    .replace(/\s+(genom|via|hos|enligt|i enlighet med|through|by way of|under|pursuant to|in accordance with)\b.*$/i, '')
    .trim();
  return a.length > 4 && a.length < 120 ? a : null;
}

export const renText = t => String(t || '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\*\*|__|`/g, '')
  .replace(/[ \t]+/g, ' ');

const meningen = (text, index) => {
  const fore = text.lastIndexOf('.', index);
  const efter = text.indexOf('.', index);
  return text.slice(fore + 1, efter > 0 ? efter + 1 : index + 200)
    .replace(/\s+/g, ' ')
    .trim();
};

const SIFFRA = '(\\d{1,4}|en|ett|två|tre|fyra|fem|sex|sju|åtta|nio|tio|elva|tolv|fjorton|femton|tjugo|trettio|sextio|nittio)';
const ENHET = '(dagar|dag|dygn|arbetsdagar|vardagar|veckor|vecka|veckas|månader|månad|månaders|år|års)';
const SIFFRA_EN = "(\\d{1,4}|one|an?|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty(?:[\\s-]five)?|sixty|ninety)(?:\\s*\\(\\d{1,4}\\))?";
const ENHET_EN = "((?:business|working)\\s+days?|days?'?s?|weeks?'?s?|months?'?s?|years?'?s?)";

export const nyckelnFor = f =>
  `${f.antal}${f.enhet}:${(f.ankare || f.sort || '').toLowerCase().slice(0, 40)}:${f.lagrum || ''}`;

export function hittaFrister(text, { kalla = null, lagrum = null } = {}) {
  const t = renText(text);
  const ut = [];
  const sett = new Set();

  const med = new RegExp(`\\b(?:inom|senast)\\s+${SIFFRA}\\s*${ENHET}\\b\\s*((?:från|efter|räknat från)[^.;:]{0,90})?`, 'gi');
  for (const m of t.matchAll(med)) {
    const antal = tal(m[1]);
    const enhet = ENHETER[String(m[2]).toLowerCase()];
    if (!antal || !enhet) continue;
    const nyckel = `${antal}${enhet}${(m[3] || '').slice(0, 30)}`;
    if (sett.has(nyckel)) continue;
    sett.add(nyckel);
    ut.push({
      antal, enhet,
      ankare: stadaAnkare(m[3]),
      mening: meningen(t, m.index),
      kalla, lagrum,
    });
  }

  const medEn = new RegExp(`\\b(?:within|no\\s+later\\s+than|not\\s+later\\s+than)\\s+${SIFFRA_EN}\\s*${ENHET_EN}(?![\\w])\\s*((?:from|after|of|counting\\s+from)[^.;:]{0,90})?`, 'gi');
  for (const m of t.matchAll(medEn)) {
    const antal = tal(m[1]);
    const enhet = ENHETER[String(m[2]).toLowerCase().replace(/\s+/g, ' ')];
    if (!antal || !enhet) continue;
    const nyckel = `${antal}${enhet}${(m[3] || '').slice(0, 30)}`;
    if (sett.has(nyckel)) continue;
    sett.add(nyckel);
    ut.push({ antal, enhet, ankare: stadaAnkare(m[3]), mening: meningen(t, m.index), kalla, lagrum });
  }

  const utan = new RegExp(`\\b(uppsägningstid|överklagandetid|preskriptionstid|klagotid|svarstid|anmälningsfrist|besvärstid)\\w*\\s*(?:om|på|är|löper\\s+(?:på|om))?\\s*${SIFFRA}\\s*${ENHET}\\b`, 'gi');
  for (const m of t.matchAll(utan)) {
    const antal = tal(m[2]);
    const enhet = ENHETER[String(m[3]).toLowerCase()];
    if (!antal || !enhet) continue;
    const nyckel = `${antal}${enhet}${m[1]}`;
    if (sett.has(nyckel)) continue;
    sett.add(nyckel);
    ut.push({ antal, enhet, sort: m[1].toLowerCase(), ankare: null, mening: meningen(t, m.index), kalla, lagrum });
  }

  const utanEn = new RegExp(`\\b(notice\\s+period|appeal\\s+period|period\\s+of\\s+limitation|limitation\\s+period|complaint\\s+period|response\\s+time|reporting\\s+deadline|time\\s+limit\\s+for\\s+appeal)\\s*(?:of|is|runs\\s+for)?\\s*${SIFFRA_EN}\\s*${ENHET_EN}(?![\\w])`, 'gi');
  for (const m of t.matchAll(utanEn)) {
    const antal = tal(m[2]);
    const enhet = ENHETER[String(m[3]).toLowerCase().replace(/\s+/g, ' ')];
    if (!antal || !enhet) continue;
    const sort = m[1].toLowerCase().replace(/\s+/g, ' ');
    const nyckel = `${antal}${enhet}${sort}`;
    if (sett.has(nyckel)) continue;
    sett.add(nyckel);
    ut.push({ antal, enhet, sort, ankare: null, mening: meningen(t, m.index), kalla, lagrum });
  }

  return ut;
}

export function lasbar(f) {
  const t = tx(`pars.frister.enhet.${f.enhet}`, { n: f.antal });
  return f.ankare ? tx('pars.frister.fran', { tid: t, ankare: f.ankare }) : f.sort ? tx('pars.frister.sort', { sort: f.sort, tid: t }) : t;
}

export function forfaller(f, startdatum) {
  const d = new Date(`${startdatum}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (f.enhet === 'dagar') d.setUTCDate(d.getUTCDate() + f.antal);
  else if (f.enhet === 'veckor') d.setUTCDate(d.getUTCDate() + f.antal * 7);
  else if (f.enhet === 'månader') d.setUTCMonth(d.getUTCMonth() + f.antal);
  else if (f.enhet === 'år') d.setUTCFullYear(d.getUTCFullYear() + f.antal);
  else if (f.enhet === 'arbetsdagar') {
    let kvar = f.antal;
    while (kvar > 0) {
      d.setUTCDate(d.getUTCDate() + 1);
      const v = d.getUTCDay();
      if (v !== 0 && v !== 6) kvar--;
    }
  } else return null;
  return d.toISOString().slice(0, 10);
}

export const dagarKvar = (datum, nu = Date.now()) =>
  Math.ceil((Date.parse(`${datum}T12:00:00Z`) - nu) / 86400e3);

export function brådska(datum, nu = Date.now()) {
  const d = dagarKvar(datum, nu);
  if (d < 0) return { niva: 'passerad', text: tx('pars.frister.gickUt', { n: -d }) };
  if (d === 0) return { niva: 'idag', text: tx('pars.frister.idag') };
  if (d === 1) return { niva: 'nara', text: tx('pars.frister.imorgon') };
  if (d <= 7) return { niva: 'nara', text: tx('pars.frister.om', { n: d }) };
  if (d <= 30) return { niva: 'snart', text: tx('pars.frister.om', { n: d }) };
  return { niva: 'lugnt', text: tx('pars.frister.om', { n: d }) };
}
