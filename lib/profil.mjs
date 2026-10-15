
export const TOM = { vem: '', arbetar: '', vill: '', intressen: '', egen: '', fakta: [], kallor: {} };

export const TAK = 400;

const rent = t => String(t || '').replace(/\s+/g, ' ').trim().slice(0, TAK);

export const EGEN_TAK = 4000;
const egenText = t => String(t || '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, EGEN_TAK);

export const FAKTA_TAK = 20;

export const KALLSORTER = ['linkedin', 'cv', 'safari', 'lank', 'du', 'samtal'];
const kalla = k => (k && KALLSORTER.includes(k.sort)
  ? { sort: k.sort, ...(k.forslag ? { forslag: true } : {}), ...(/^\d{4}-\d\d-\d\d/.test(k.nar || '') ? { nar: String(k.nar).slice(0, 24) } : {}) }
  : null);

export function las(v) {
  if (!v || typeof v !== 'object') return { ...TOM, fakta: [], kallor: {} };
  const fakta = (Array.isArray(v.fakta) ? v.fakta : [])
    .map(x => (typeof x === 'string' ? { text: x } : x || {}))
    .map(x => ({ text: rent(x.text), ...(kalla(x.kalla) ? { kalla: kalla(x.kalla) } : {}) }))
    .filter(x => x.text).slice(0, FAKTA_TAK);
  const kallor = {};
  for (const f of ['vem', 'arbetar', 'vill', 'intressen', 'egen']) { const k = kalla(v.kallor?.[f]); if (k) kallor[f] = k; }
  return { vem: rent(v.vem), arbetar: rent(v.arbetar), vill: rent(v.vill), intressen: rent(v.intressen), egen: egenText(v.egen), fakta, kallor };
}

export const harNagot = p => Boolean(p && (p.vem || p.arbetar || p.vill || p.intressen || p.egen || p.fakta?.length));

export const harFalt = p => Boolean(p && (p.vem || p.arbetar || p.vill || p.intressen));

export function somText(p) {
  if (!harNagot(p)) return '';
  const rader = [];
  const fakta = p.fakta?.length ? `Också om användaren: ${p.fakta.map(x => x.text || x).join('; ')}` : '';
  if (!harFalt(p)) return [p.egen && `Användaren beskriver sig själv: ${String(p.egen).replace(/\s+/g, ' ').slice(0, TAK * 2)}`, fakta].filter(Boolean).join('\n');
  if (p.vem) rader.push(`Användaren är: ${p.vem}`);
  if (p.arbetar) rader.push(`Arbetar med: ${p.arbetar}`);
  if (p.vill) rader.push(`Vill uppnå: ${p.vill}`);
  if (p.intressen) rader.push(`Intresserad av: ${p.intressen}`);
  if (fakta) rader.push(fakta);
  return rader.join('\n');
}

export function fragan(p, instruktion) {
  const i = String(instruktion || '').trim();
  if (!p?.vill) return `För varje numrerad post avgör du om den angår uppdraget: ${i}`;
  return [
    `För varje numrerad post avgör du TVÅ saker:`,
    `  1. Angår den uppdraget: ${i}`,
    `  2. För den personen närmare eller längre från: ${p.vill}`,
    '',
    'Det som TAR BORT framsteg väger lika tungt som det som ger framsteg.',
    'En inställd bokning, ett pausat uppdrag, en avbeställd order, en kund',
    'som drar sig ur — allt sådant för personen LÄNGRE från målet och ska',
    'behållas, även när det låter lugnt och artigt skrivet.',
    '',
    'Något som angår uppdraget men varken för personen närmare eller längre är',
    'värt att veta, inte att se i dag.',
  ].join('\n');
}

export function forslag({ rubriker = [], projekt = [] } = {}) {
  const r = rubriker.filter(Boolean).slice(0, 40);
  const p = projekt.filter(Boolean).slice(0, 10);
  if (!r.length && !p.length) return null;
  return {
    underlag: [
      p.length ? `Projekt: ${p.join(', ')}` : '',
      r.length ? `Rubriker på personens samtal: ${r.join(' · ')}` : '',
    ].filter(Boolean).join('\n'),
    mall: '{"vem":"...","arbetar":"...","vill":"..."}',
  };
}

export function lasForslag(text) {
  const s = String(text || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { const f = las(JSON.parse(s.slice(a, b + 1))); delete f.egen; delete f.fakta; delete f.kallor; return f; } catch { return null; }
}
