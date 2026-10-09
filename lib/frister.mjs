/// Frister: tiden som rinner.
///
/// Den starkaste känslan i hela målgruppen är inte nyfikenhet. Det är rädslan
/// att missa något. En överklagandetid som gått ut går inte att laga.
///
/// ── Varför fristen läses ur LAGEN och inte ur svaret ──────────────────────
///
/// Modellen skriver "du har tre veckor på dig". Den kan ha fel, och en frist
/// som är fel är värre än ingen frist alls — den som tror sig ha tre veckor
/// slutar räkna dagar.
///
/// Lagtexten säger det exakt: "Ett överklagande ska ha kommit in till
/// beslutsmyndigheten inom tre veckor från den dag då den som överklagar
/// fick del av beslutet." Där står både LÄNGDEN och ANKARET, och MAXIMUS hämtar
/// ändå den texten. Alltså läses fristen därifrån, och den kan peka på sin
/// paragraf.
///
/// ── Varför användaren måste sätta startdagen ──────────────────────────────
///
/// "Tre veckor från den dag du fick del av beslutet" — vilken dag var det?
/// Det vet bara den som fick brevet. En app som gissar startdagen räknar fram
/// ett datum som ser exakt ut och är fel, och då är den farligare än inget.
///
/// MAXIMUS föreslår fristen och frågar efter dagen. Ingen frist börjar ticka
/// utan att någon sagt när.

import { tx } from './sprakstod.mjs';

// Engelska (fas 3, 2026-10-09): fristerna läses på svenska OCH engelska,
// alltid — "within three weeks from the date on which the appellant
// received the decision", "a notice period of three months". Enheterna
// sparas med sina svenska id:n ('dagar', 'veckor' …); det är data, inte text.
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

/// Ankaret: dagen fristen räknas från.
///
/// Städas till något en människa känner igen. "från den dag då den som
/// överklagar fick del av beslutet" blir "den dag du fick del av beslutet" —
/// det är den frågan som ska ställas.
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
  // Klipp vid nästa bisats: ankaret är en dag, inte ett stycke.
  a = a.replace(/\s+(och|samt|dock|om|när|såvida|förutsatt|and|unless|provided|if|however)\b.*$/i, '')
    // "den dag då du fick del av beslutet genom den myndigheten" — allt efter
    // själva händelsen är precisering som inte hjälper den som ska välja ett
    // datum i en kalender.
    .replace(/\s+(genom|via|hos|enligt|i enlighet med|through|by way of|under|pursuant to|in accordance with)\b.*$/i, '')
    .trim();
  return a.length > 4 && a.length < 120 ? a : null;
}

/// Texten utan markdown. Länkarna städas FÖRE meningen letas upp, annars
/// börjar den mitt i en adress: "nu/2017:900#P43S1) inom tre veckor …".
export const renText = t => String(t || '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\*\*|__|`/g, '')
  .replace(/[ \t]+/g, ' ');

/// Meningen fristen står i, för den som vill läsa själv.
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

/// Ett stabilt namn på en frist, så att samma frist inte läggs in två gånger.
export const nyckelnFor = f =>
  `${f.antal}${f.enhet}:${(f.ankare || f.sort || '').toLowerCase().slice(0, 40)}:${f.lagrum || ''}`;

/// Frister i en text. Tänkt för lagtext, men fungerar på vad som helst.
export function hittaFrister(text, { kalla = null, lagrum = null } = {}) {
  const t = renText(text);
  const ut = [];
  const sett = new Set();

  // "inom tre veckor från den dag då …" — längden och ankaret i ett svep.
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

  // Engelska: "within three weeks from the date on which …", "no later than
  // 30 days after …".
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

  // "en uppsägningstid om tre månader" — längden utan ankare.
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

  // "a notice period of three months" — längden utan ankare, på engelska.
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

/// Fristen i ord. "3 veckor från den dag du fick del av beslutet".
export function lasbar(f) {
  const t = tx(`pars.frister.enhet.${f.enhet}`, { n: f.antal });
  return f.ankare ? tx('pars.frister.fran', { tid: t, ankare: f.ankare }) : f.sort ? tx('pars.frister.sort', { sort: f.sort, tid: t }) : t;
}

/// När går den ut?
///
/// Arbetsdagar hoppar över lördag och söndag. Helgdagar räknas inte bort —
/// MAXIMUS vet inte vilka som är helgdagar, och att låtsas är värre än att säga
/// att man inte vet. Den som har en frist på arbetsdagar får en varning om
/// att röda dagar kan flytta den.
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

/// Dagar kvar. Negativt betyder passerad.
export const dagarKvar = (datum, nu = Date.now()) =>
  Math.ceil((Date.parse(`${datum}T12:00:00Z`) - nu) / 86400e3);

/// Raden som visas. Den ska kunna läsas i förbifarten.
export function brådska(datum, nu = Date.now()) {
  const d = dagarKvar(datum, nu);
  if (d < 0) return { niva: 'passerad', text: tx('pars.frister.gickUt', { n: -d }) };
  if (d === 0) return { niva: 'idag', text: tx('pars.frister.idag') };
  if (d === 1) return { niva: 'nara', text: tx('pars.frister.imorgon') };
  if (d <= 7) return { niva: 'nara', text: tx('pars.frister.om', { n: d }) };
  if (d <= 30) return { niva: 'snart', text: tx('pars.frister.om', { n: d }) };
  return { niva: 'lugnt', text: tx('pars.frister.om', { n: d }) };
}
