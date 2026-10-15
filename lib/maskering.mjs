import { galler } from './grader.mjs';
import { aktuellt } from './sprakstod.mjs';

const STRECK = '\\u2010-\\u2015\\u2212\\uFE63\\uFF0D-';

const BLANK = '\\s\\u00A0\\u2007\\u202F';

const AVSKILJARE = STRECK + BLANK;
const AVSKILJARE_U = BLANK + STRECK;

const SKRAP = new RegExp(`[+._()${AVSKILJARE}]`, 'g');
const rent = t => String(t).replace(SKRAP, '');

export function arFodelsedag(s) {
  const m = Number(s.slice(2, 4)), d = Number(s.slice(4, 6));
  return m >= 1 && m <= 12 && ((d >= 1 && d <= 31) || (d >= 61 && d <= 91));
}

export const MONSTER = [
  {
    typ: 'personnummer',
    re: new RegExp(`\\b(?:19|20)?\\d{6}[+${AVSKILJARE}]?\\d{4}\\b`, 'g'),
    giltig: v => { const s = rent(v); return (s.length === 10 || s.length === 12) && arFodelsedag(s.slice(-10)); },
  },
  {
    typ: 'personnummer',
    re: new RegExp(`(?<!\\p{N})(?:19|20)?\\d{2}(?:[-.]?\\d{2}){2}[+._${STRECK}]?\\d{4}(?!\\p{N})`, 'gu'),
    giltig: v => { const s = rent(v); return (s.length === 10 || s.length === 12) && arFodelsedag(s.slice(-10)); },
  },
  {
    typ: 'personkonto',
    re: new RegExp(`(?<!\\p{N})3300[${AVSKILJARE_U}]?(?:19|20)?\\d{6}[-+${AVSKILJARE_U}]?\\d{4}(?!\\p{N})`, 'gu'),
    giltig: v => { const s = rent(v); return (s.length === 14 || s.length === 16) && arFodelsedag(s.slice(-10)); },
  },
  {
    typ: 'organisationsnummer',
    re: new RegExp(`\\b\\d{6}[${AVSKILJARE}]?\\d{4}\\b`, 'g'),
    giltig: v => { const s = rent(v); return s.length === 10 && Number(s[2]) >= 2; },
  },
  {
    typ: 'identitetsnummer',
    re: /\b\d{6}[-+]\d{4}\b/g,
  },
  { typ: 'ssn', re: new RegExp(`(?<![\\p{N}-])(?!000|666|9\\d\\d)\\d{3}([${AVSKILJARE_U}])(?!00)\\d{2}\\1(?!0000)\\d{4}(?![\\p{N}-])`, 'gu') },
  { typ: 'ssn', re: /(?<=\b(?:SSN|SS#|social security(?: number| no\.?| #)?)[\s:#.]{0,3})(?!000|666|9\d\d)\d{3}[\s.-]?(?!00)\d{2}[\s.-]?(?!0000)\d{4}(?!\p{N})/giu },
  { typ: 'ni', re: /(?<![\p{L}\p{N}])(?!BG|GB|KN|NK|NT|TN|ZZ)[A-Z]{2} ?\d{2} ?\d{2} ?\d{2} ?[A-D](?![\p{L}\p{N}])/gu },
  { typ: 'epost', re: /(?<![\w\u00C0-\u024F.+-])[\w\u00C0-\u024F.+-]+@[\w-]+\.[\w.-]+\b/g },
  { typ: 'epost', re: /(?<![\w\u00C0-\u024F.+-])[\w\u00C0-\u024F.+-]+(?:\s*(?:\[at\]|\(at\)|\{at\})\s*|@)[\w-]+(?:(?:\.|\s*(?:\[dot\]|\(dot\))\s*)[\w-]+)*/gi },
  { typ: 'telefon', re: new RegExp(`(?<!\\d)(?<!\\d[${AVSKILJARE}])(?:\\+46|0)[${AVSKILJARE}]?[1-9]\\d{0,2}[${AVSKILJARE}]?\\d{2,3}[${AVSKILJARE}]?\\d{2}(?:[${AVSKILJARE}]?\\d{2})?\\b`, 'g'),
    giltig: v => { const n = rent(v).replace(/^46/, '0').length; return n >= 8 && n <= 11; } },
  { typ: 'telefon',
    re: new RegExp(`(?<![\\p{N}+])(?<!\\p{N}[${AVSKILJARE_U}])(?:\\+46[${BLANK}]*(?:\\(0\\)[${BLANK}]*)?|0046[${AVSKILJARE_U}]?|0)[1-9](?:[.${AVSKILJARE_U}]?\\d){5,9}(?!\\p{N})`, 'gu'),
    giltig: v => telefonGiltig(v) },
  { typ: 'telefon', re: new RegExp(`(?<![\\p{N}+])(?:(?:\\+|00)?1[.${AVSKILJARE_U}]?)?(?:\\([2-9]\\d{2}\\)|[2-9]\\d{2})[.${AVSKILJARE_U}]?[2-9]\\d{2}[.${AVSKILJARE_U}]\\d{4}(?!\\p{N})`, 'gu'),
    giltig: v => !DATUMLIK.test(v.trim()) && /^1?\d{10}$/.test(v.replace(/\D/g, '').replace(/^00/, '')) },
  { typ: 'telefon', re: new RegExp(`(?<![\\p{N}+])(?:\\+44[${BLANK}]?(?:\\(0\\)[${BLANK}]?)?|0044[${BLANK}]?|0)[1235789](?:[.${AVSKILJARE_U}]?\\d){8,9}(?!\\p{N})`, 'gu'),
    giltig: v => brittisktTelefon(v) },
  { typ: 'iban', re: /\b[A-Z]{2}\d{2}[\sA-Z0-9]{10,30}\b/g, giltig: v => rent(v).length >= 15 },
  { typ: 'kontonummer', re: new RegExp(`\\b\\d{4}[${AVSKILJARE}]\\d{6,10}\\b`, 'g') },
  { typ: 'kort', re: /(?<!\p{N})(?:\d{4}(?:[ -]\d{4}){2,3}(?:[ -]\d{1,3})?|[3-6]\d{14,15})(?!\p{N})/gu,
    giltig: v => { const s = v.replace(/\D/g, ''); return s.length >= 13 && s.length <= 19 && luhn(s); } },
  { typ: 'kontonummer', re: /(?<!\p{N})8\d{3}-\d,?\s?\d{1,3}(?:[ .]?\d{3}){1,3}(?:-\d)?(?!\p{N})/gu },
  { typ: 'kontonummer',
    re: /(?<=\b(?:kontonummer|kontonr|bankkonto|personkonto|konto|bankgiro|plusgiro|clearingnummer|clearing)\b[\s:]{0,3})\d[\d\s,.-]{3,28}\d/gi },

  { typ: 'personnummer', re: /\b\d{2,4}(?: \d{2,4}){2,5}\b/g,
    giltig: v => { const s = rent(v); return (s.length === 10 || s.length === 12) && arFodelsedag(s.slice(-10)); } },
  { typ: 'organisationsnummer', re: /\b\d{2,4}(?: \d{2,4}){2,5}\b/g,
    giltig: v => { const s = rent(v); return s.length === 10 && Number(s[2]) >= 2; } },
  { typ: 'personnummer', re: new RegExp(`(?<!\\p{N})\\d(?:[._${AVSKILJARE_U}]?\\d){9,11}(?!\\p{N})`, 'gu'),
    giltig: v => { const s = rent(v); return (s.length === 10 || s.length === 12) && arFodelsedag(s.slice(-10)) && !DATUMLIK.test(v); } },
  { typ: 'diarienummer', re: new RegExp(`\\b[A-ZÅÄÖ]{1,4}[${AVSKILJARE}]?\\d{4}[/:${STRECK}]\\d{1,6}\\b`, 'g') },
  { typ: 'adress', re: /(?<![\p{L}\p{N}_])\p{Lu}\p{Ll}+(?:gatan|vägen|gränd|torget|plan|allén)\s+\d+(?:\p{L}(?!\p{L}))?(?!\p{N})/gu },
  { typ: 'adress', re: /\b\d{3}\s?\d{2}\s+\p{Lu}[\p{L}-]+\b/gu },
  { typ: 'adress', re: /(?<![\p{L}\p{N}])\d{1,5}[A-Z]?\s+(?:[NSEW]\.?\s+)?(?:\p{Lu}[\p{L}'’-]*\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Way|Terrace|Parkway|Pkwy|Highway|Hwy|Square|Sq|Close|Crescent|Gardens|Row|Mews|Circle|Cir)\b\.?(?:,?\s+(?:Apt|Apartment|Suite|Ste|Unit|Flat)\.?\s*#?[\w-]{1,6}|\s+#[\w-]{1,6})?/gu },
  { typ: 'postnummer', re: /(?<![\p{L}\p{N}])(?:[A-Z]{1,2}\d[A-Z\d]?|GIR) ?\d[ABD-HJLNP-UW-Z]{2}(?![\p{L}\p{N}])/gu },
  { typ: 'postnummer', re: /(?<![\p{N}-])\d{5}-\d{4}(?![\p{N}-])/g },
  { typ: 'postnummer', re: /(?<=\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY),?\s)\d{5}(?:-\d{4})?(?!\p{N})/gu },
  { typ: 'url', re: /\bhttps?:\/\/[^\s<>"]+/g },

  { typ: 'nyckel', re: /\b(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|(?:[A-Za-z0-9+/]{32,}={0,2}))\b/g,
    giltig: v => v.length >= 24 && /\d/.test(v) && /[A-Za-z]/.test(v) },
  { typ: 'ip', re: /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?\b|\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/gi,
    giltig: v => !/^\d+\.\d+\.\d+$/.test(v) && v.split('.').every(d => Number(d.split(':')[0]) <= 255 || d.includes(':')) },
  { typ: 'sokvag', re: /(?<![\w/])(?:\/(?:Users|home|var|etc|opt|srv|mnt|data)\/[\w./-]+|[A-Z]:\\[\w\\.-]+|\\\\[\w.-]+\\[\w\\.-]+)/g },
  { typ: 'server', re: /\b(?:srv|vm|db|app|web|api|prod|test|stage|dc|fs|ad)[-_]?[a-z0-9]{1,12}(?:\.[a-z0-9-]+){1,3}\b/gi },
  { typ: 'belopp', re: /\b\d{1,3}(?:[ .]\d{3})+(?:[,.]\d{1,2})?\s*(?:kr|kronor|SEK|EUR|USD|€|\$)|\b\d+(?:[,.]\d{1,2})?\s*(?:kr|kronor|SEK|EUR|USD|€|\$)|(?:€|\$)\s?\d[\d ., ]*/gi },
  { typ: 'datum', re: /\b(?:(?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])|(?:0?[1-9]|[12]\d|3[01])[ /](?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)(?:\s+(?:19|20)\d{2})?|\b(?:19|20)\d{2})\b/gi },
];

function luhn(s) {
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    let d = Number(s[s.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

const DATUMLIK = /^(?:\d{4}[-./]\d{1,2}[-./]\d{1,2}(?:[ T]\d{1,2}[.:]\d{2}(?:[.:]\d{2})?)?|\d{1,2}[-./]\d{1,2}[-./]\d{2,4}(?:\s\d{1,2}[.:]\d{2})?|\d{1,2}[.:]\d{2}(?:\s+\d{1,2}[.:]\d{2})*)$/;

function brittisktTelefon(v) {
  if (DATUMLIK.test(v.trim())) return false;
  let s = String(v).replace(/\D/g, '');
  if (s.startsWith('0044')) s = s.slice(4);
  else if (s.startsWith('440')) s = s.slice(3);
  else if (/^\s*\+/.test(v) && s.startsWith('44')) s = s.slice(2);
  else if (s.startsWith('0')) s = s.slice(1);
  else return false;
  return (s.length === 9 || s.length === 10) && /^[1235789]/.test(s);
}

function telefonGiltig(v) {
  if (DATUMLIK.test(v.trim())) return false;
  let s = String(v).replace(/\D/g, '');
  if (s.startsWith('460')) s = s.slice(2);
  else if (s.startsWith('0046')) s = '0' + s.slice(4);
  else if (/^\s*\+/.test(v) && s.startsWith('46')) s = '0' + s.slice(2);
  return s.length >= 8 && s.length <= 10 && s[0] === '0' && s[1] !== '0';
}

const ETIKETT = {
  personnummer: 'PERSONNUMMER', organisationsnummer: 'ORGNR', epost: 'E-POST',
  telefon: 'TELEFON', iban: 'KONTO', kontonummer: 'KONTO', diarienummer: 'DIARIENR', identitetsnummer: 'IDNR',
  adress: 'ADRESS', url: 'LÄNK', namn: 'PERSON', ort: 'ORT', organisation: 'ORGANISATION',
  personkonto: 'KONTO', kort: 'KORT',
  belopp: 'BELOPP', datum: 'DATUM', ip: 'ADRESS', server: 'SERVER', sokvag: 'SÖKVÄG', nyckel: 'NYCKEL',
  ssn: 'PERSONNUMMER', ni: 'PERSONNUMMER', postnummer: 'ADRESS',
};

export const ETIKETT_EN = {
  PERSONNUMMER: 'ID NUMBER', ORGNR: 'ORG NUMBER', 'E-POST': 'EMAIL', TELEFON: 'PHONE',
  KONTO: 'ACCOUNT', DIARIENR: 'CASE NUMBER', IDNR: 'ID', ADRESS: 'ADDRESS', 'LÄNK': 'LINK',
  PERSON: 'PERSON', NAMN: 'NAME', ORT: 'PLACE', ORGANISATION: 'ORGANIZATION', KORT: 'CARD',
  BELOPP: 'AMOUNT', DATUM: 'DATE', SERVER: 'SERVER', 'SÖKVÄG': 'PATH', NYCKEL: 'KEY',
  ROLL: 'ROLE', UPPGIFT: 'DETAIL',
};
const ETIKETT_SV = Object.fromEntries(Object.entries(ETIKETT_EN).map(([sv, en]) => [en, sv]));

export const etikett = (svensk, kod = aktuellt()) => (kod === 'sv' ? svensk : ETIKETT_EN[svensk] || svensk);

const tillSvensk = p => p.replace(/^\[([^\]]*?)\s+([A-Z]+)\](:?s)?$/, (hela, e, b, g) => `[${ETIKETT_SV[e.trim().toUpperCase()] || e} ${b}]${g || ''}`);

export const MONSTERSORT = {
  personnummer: 'personnummer', organisationsnummer: 'organisationsnummer',
  identitetsnummer: 'organisationsnummer', epost: 'epost', telefon: 'telefon',
  personkonto: 'personnummer', kort: 'kontonummer', ssn: 'personnummer', ni: 'personnummer', postnummer: 'ort',
  iban: 'kontonummer', kontonummer: 'kontonummer', diarienummer: 'diarienummer',
  adress: 'ort', url: 'url', belopp: 'belopp', datum: 'datum',
  ip: 'ip', server: 'server', sokvag: 'sokvag', nyckel: 'nyckel',
};

let EXTRA = [];
export const satExtraMonster = m => { EXTRA = Array.isArray(m) ? m : []; };
export const extraMonster = () => EXTRA.length;

export function maskera(text, { karta = new Map(), raknare = new Map(), sorter } = {}) {
  sorter ||= galler({});
  let ut = siffrorTillAscii(String(text || ''));
  const funna = [];

  for (const m of [...MONSTER, ...EXTRA]) {
    if (!sorter.has(MONSTERSORT[m.typ] || m.typ)) continue;
    ut = ut.replace(new RegExp(m.re.source, m.re.flags), traff => {
      if (m.giltig && !m.giltig(traff)) return traff;
      if (karta.has(traff)) return karta.get(traff);
      const e = etikett(ETIKETT[m.typ] || m.typ.toUpperCase());
      const n = (raknare.get(e) || 0) + 1;
      raknare.set(e, n);
      const platshallare = `[${e} ${bokstav(n)}]`;
      karta.set(traff, platshallare);
      funna.push({ typ: m.typ, original: traff, platshallare });
      return platshallare;
    });
  }
  return { text: ut, karta, raknare, funna };
}

function bokstav(n) {
  let s = '';
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

const genitiv = namn => /[sxzSXZ]$/.test(namn) ? namn : `${namn}s`;

const nyckel = p => p.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();

function kort(p) {
  const bitar = p.replace(/[[\]]/g, '').trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!bitar.length) return null;
  return bitar[0][0] + bitar.at(-1);
}

export function avmaskera(text, karta) {
  let ut = String(text || '');
  const par = [...karta.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [original, platshallare] of par) {
    ut = ut.split(`${platshallare}:s`).join(genitiv(original));
    ut = ut.split(`${platshallare}s`).join(genitiv(original));
    ut = ut.split(platshallare).join(original);
  }

  const efterNyckel = new Map(), efterKort = new Map();
  for (const [original, platshallare0] of karta) {
    const platshallare = tillSvensk(platshallare0);
    const nk = nyckel(platshallare);
    efterNyckel.set(nk, efterNyckel.has(nk) && efterNyckel.get(nk) !== original ? null : original);
    const k = kort(platshallare);
    if (k) efterKort.set(k, efterKort.has(k) && efterKort.get(k) !== original ? null : original);
  }
  ut = ut.replace(/\[[^\]\n]{1,40}\](:?s)?/g, (hela, bojning) => {
    const rent = tillSvensk(hela.replace(/(:?s)$/, ''));
    const original = efterNyckel.get(nyckel(rent)) || efterKort.get(kort(rent));
    if (!original) return hela;
    return bojning ? genitiv(original) : original;
  });
  return ut;
}

export function ommaskera(text, karta) {
  let ut = String(text || '');
  for (const [original, platshallare] of [...karta.entries()].sort((a, b) => b[0].length - a[0].length)) {
    ut = ut.split(original).join(platshallare);
  }
  return ut;
}

function normalisera(text) {
  const t = String(text ?? '');
  let ut = '';
  const fran = [];
  for (let i = 0; i < t.length;) {
    const k = t.codePointAt(i);
    const bredd = k > 0xFFFF ? 2 : 1;
    let c = String.fromCodePoint(k);
    if (k >= 0xFF01 && k <= 0xFF5E) c = String.fromCharCode(k - 0xFEE0);
    else if (k === 0x3000) c = ' ';
    else if (k >= 0x80 && /\p{Nd}/u.test(c)) {
      let noll = k;
      while (k - noll < 100 && /\p{Nd}/u.test(String.fromCodePoint(noll - 1))) noll--;
      c = String((k - noll) % 10);
    }
    for (let j = 0; j < c.length; j++) fran.push(i);
    ut += c;
    i += bredd;
  }
  fran.push(t.length);
  return { text: ut, fran };
}
export const siffrorTillAscii = text => normalisera(text).text;

export function hittaKvar(text) {
  const norm = normalisera(text);
  const skugga = norm.text;
  const ursprung = (i, n) => {
    const start = norm.fran[i], sista = norm.fran[i + n - 1];
    const slut = sista + (String(text).codePointAt(sista) > 0xFFFF ? 2 : 1);
    return { start, slut, varde: String(text).slice(start, slut) };
  };
  const fynd = [];
  const kropp = /(?<!\p{N})(?<![\p{L}\p{N}]\p{L})(?:\+\s?)?\d(?:(?:\s?\(0\)\s?|[ ._()\u00A0\u2007\u202F\u2010-\u2015\u2212\uFE63\uFF0D+-])?\d)*(?!\p{N})/gu;
  for (const m of skugga.matchAll(kropp)) {
    const v = m[0], s = v.replace(/\D/g, '');
    if (s.length < 7 || DATUMLIK.test(v.replace(/^\+\s?/, ''))) continue;
    let typ = null;
    if ((s.length === 10 || s.length === 12) && arFodelsedag(s.slice(-10)) && !(s.length === 12 && !/^(?:19|20)/.test(s))) typ = 'personnummer';
    else if ((s.length === 14 || s.length === 16) && s.startsWith('3300') && arFodelsedag(s.slice(-10))) typ = 'personkonto';
    else if (telefonGiltig(v)) typ = 'telefon';
    else if (s.length === 9 && /^\d{3}[ .\-\u2010-\u2015\u2212]\d{2}[ .\-\u2010-\u2015\u2212]\d{4}$/.test(v) && !/^(?:000|666|9)/.test(s) && !/^\d{3}00/.test(s) && !s.endsWith('0000')) typ = 'ssn';
    else if (/^\+\s?1|^001|^1[ .\-]/.test(v) ? /^1[2-9]\d{2}[2-9]\d{6}$/.test(s.replace(/^00/, '')) : (s.length === 10 && /^\(?[2-9]\d{2}\)?[ .\-]?[2-9]\d{2}[ .\-]\d{4}$/.test(v))) typ = 'telefon';
    else if (/^(?:\+\s?44|0044)/.test(v) && brittisktTelefon(v)) typ = 'telefon';
    else if (s.length >= 13 && s.length <= 19 && luhn(s) && (/^\d{4}(?:[ -]\d{4}){2,}/.test(v) || /^[3-6]\d{14,15}$/.test(v))) typ = 'kort';
    if (typ) fynd.push({ typ, ...ursprung(m.index, v.length) });
  }
  const post = /(?<![\w\u00C0-\u024F.+-])[\w\u00C0-\u024F.+-]+(?:\s*(?:\[at\]|\(at\)|\{at\}|\[snabel-a\])\s*|[@\uFF20])[\w-]+(?:(?:\.|\s*(?:\[dot\]|\(dot\)|\[punkt\])\s*)[\w-]+)*/giu;
  for (const m of skugga.matchAll(post)) {
    fynd.push({ typ: 'epost', ...ursprung(m.index, m[0].length) });
  }
  return fynd.sort((a, b) => a.start - b.start);
}

export function maskeraKvar(text, { karta = new Map(), raknare = new Map(), sorter } = {}) {
  sorter ||= galler({});
  let ut = String(text ?? '');
  const funna = [];
  for (const f of hittaKvar(ut).reverse()) {
    if (!sorter.has(MONSTERSORT[f.typ] || f.typ)) continue;
    if (/^\[[^\]]*\]$/.test(f.varde)) continue;
    let p = karta.get(f.varde);
    if (!p) {
      const e = etikett(ETIKETT[f.typ] || f.typ.toUpperCase());
      const n = (raknare.get(e) || 0) + 1;
      raknare.set(e, n);
      p = `[${e} ${bokstav(n)}]`;
      karta.set(f.varde, p);
      funna.push({ typ: f.typ, original: f.varde, platshallare: p });
    }
    ut = ut.slice(0, f.start) + p + ut.slice(f.slut);
  }
  return { text: ut, karta, raknare, funna };
}

export function granska(text, sorter) {
  sorter ||= galler({});
  const kvar = [];
  for (const m of MONSTER) {
    if (!['personnummer', 'personkonto', 'organisationsnummer', 'identitetsnummer', 'epost', 'telefon', 'iban', 'kontonummer', 'kort', 'nyckel', 'ssn', 'ni'].includes(m.typ)) continue;
    if (!sorter.has(MONSTERSORT[m.typ] || m.typ)) continue;
    for (const t of String(text || '').match(new RegExp(m.re.source, m.re.flags)) || []) {
      if (m.giltig && !m.giltig(t)) continue;
      if (kvar.some(k => k.varde.includes(t) || t.includes(k.varde))) continue;
      kvar.push({ typ: m.typ, varde: t });
    }
  }
  for (const f of hittaKvar(text)) {
    if (!sorter.has(MONSTERSORT[f.typ] || f.typ)) continue;
    if (!kvar.some(k => k.varde.includes(f.varde) || f.varde.includes(k.varde))) kvar.push({ typ: f.typ, varde: f.varde });
  }
  return kvar;
}
