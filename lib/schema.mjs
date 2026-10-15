
import { tx } from './sprakstod.mjs';

const DAGNAMN = { måndag: 1, tisdag: 2, onsdag: 3, torsdag: 4, fredag: 5, lördag: 6, söndag: 7,
  mån: 1, tis: 2, ons: 3, tor: 4, tors: 4, fre: 5, lör: 6, sön: 7 };
const ENGNAMN = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
const kort = () => ['', ...tx('pars.schema.dagkort').split(',')];

const F = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';
const ord = (monster, flaggor = 'u') => new RegExp(`${F}(?:${monster})${E}`, flaggor);

const ENG_VARDAGAR = ord('week\\s*days?|every\\s+weekday|work\\s*days?|business\\s+days?|mon(?:day)?\\s*(?:[-–]|to|through|thru)\\s*fri(?:day)?');
const ENG_HELG = ord('week\\s*ends?|sat(?:urday)?s?\\s+and\\s+sun(?:day)?s?');
const ENG_VARJE = ord('every\\s+day|daily|each\\s+day|all\\s+days');

const AMPM = /(?<![\p{L}\p{N}:])(1[0-2]|0?[1-9])(?:[.:]([0-5]\d))?\s*([ap])\.?\s?m\.?(?![\p{L}])/giu;

const tid = (h, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

export function schemaUr(text) {
  let t = String(text || '').toLowerCase();
  let dagar = null;
  if (/\b(vardag\w*|mån(dag)?\s*[-–]\s*fre(dag)?|måndag\s+till\s+fredag|arbetsdag\w*)\b/.test(t) || ENG_VARDAGAR.test(t)) dagar = [1, 2, 3, 4, 5];
  else if (/\b(helg\w*|lör(dag)?\s+och\s+sön(dag)?)\b/.test(t) || ENG_HELG.test(t)) dagar = [6, 7];
  else if (/\b(varje\s+dag|dagligen|alla\s+dagar)\b/.test(t) || ENG_VARJE.test(t)) dagar = [1, 2, 3, 4, 5, 6, 7];
  else {
    const namn = [...t.matchAll(/\b(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)(?:ar)?\b/g)].map(m => DAGNAMN[m[1]]);
    for (const m of t.matchAll(/(?<![\p{L}])(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?(?![\p{L}])/gu)) namn.push(ENGNAMN[m[1]]);
    if (namn.length) dagar = [...new Set(namn)].sort();
  }
  const tider = [];
  for (const m of t.matchAll(AMPM)) {
    let h = +m[1] % 12;
    if (m[3].toLowerCase() === 'p') h += 12;
    tider.push(tid(h, +(m[2] || 0)));
  }
  t = t.replace(AMPM, ' ');
  for (const m of t.matchAll(/\b(?:kl\.?\s*)?([01]?\d|2[0-3])[.:]([0-5]\d)\b/g)) tider.push(tid(+m[1], +m[2]));
  for (const m of t.matchAll(/\b(?:kl\.?|klockan|at)\s*([01]?\d|2[0-3])\b(?![.:]\d)/g)) tider.push(tid(+m[1]));
  if (dagar && !tider.length) {
    const m = /\b([01]?\d|2[0-3])\s+(?:och|and)\s+([01]?\d|2[0-3])\b(?![.:]\d)/.exec(t);
    if (m) tider.push(tid(+m[1]), tid(+m[2]));
  }
  if ((/\bmorgon\w*\b/.test(t) || /\bmornings?\b/.test(t)) && !tider.length) tider.push('08:00');
  if (/\b(?:noon|midday|lunchtime)\b/.test(t)) tider.push('12:00');
  if (/\beftermiddag\w*\b/.test(t) || /\bafternoons?\b/.test(t)) tider.push('15:00');
  if (/\bkväll\w*\b/.test(t) || /\bevenings?\b/.test(t)) tider.push('18:00');
  const unika = [...new Set(tider)].sort();
  if (!unika.length) return null;
  return { dagar: dagar || [1, 2, 3, 4, 5, 6, 7], tider: unika };
}

export function nastaTid(schema, nu = new Date()) {
  if (!schema?.tider?.length) return null;
  for (let dag = 0; dag < 8; dag++) {
    const d = new Date(nu); d.setDate(d.getDate() + dag);
    const iso = ((d.getDay() + 6) % 7) + 1;
    if (!(schema.dagar || []).includes(iso)) continue;
    for (const t of schema.tider) {
      const [h, m] = t.split(':').map(Number);
      const x = new Date(d); x.setHours(h, m, 0, 0);
      if (x > nu) return x;
    }
  }
  return null;
}

const lista = (xs, eller = false) => xs.length > 1
  ? tx(eller ? 'pars.schema.listaEller' : 'pars.schema.listaOch', { forsta: xs.slice(0, -1).join(', '), sista: xs.at(-1) })
  : String(xs[0] ?? '');

export function somText(schema) {
  if (!schema?.tider?.length) return '';
  const d = [...(schema.dagar || [])].sort().join(',');
  const k = kort();
  const dagar = d === '1,2,3,4,5' ? tx('pars.schema.vardagar') : d === '6,7' ? tx('pars.schema.helger') : d === '1,2,3,4,5,6,7' ? tx('pars.schema.varjeDag')
    : schema.dagar.map(x => k[x]).join(', ');
  return `${dagar} ${lista(schema.tider)}`;
}

const HANDELSE_EN = /(?<![\p{L}])(when(?:ever)?|as\s+soon\s+as|every\s+time|each\s+time|right\s+when|once)\s+(?!(?:it(?:'|’)?s|it\s+is)\s+(?:\d|morning|evening|noon|night)|the\s+clock)[^.!?\n]{0,60}?(e-?mails|mails|writes|replies|responds|answers|gets\s+in\s+touch|reaches\s+out|calls|phones|arrives|comes\s+in|lands|shows\s+up|appears|changes|(?:is|gets)\s+(?:updated|changed|added|published)|expires|is\s+due|new)(?![\p{L}])/iu;
const HANDELSE = /(?<![\p{L}])(när|så\s+fort|varje\s+gång|direkt\s+när|med\s+en\s+gång\s+när)\s+(?!klockan|det\s+är\s+(?:morgon|kväll))[^.!?\n]{0,60}?(mejlar|mailar|e-?postar|skriver|svarar|hör\s+av\s+sig|ringer|kommer|hamnar|dyker\s+upp|ändras|uppdateras|läggs\s+(?:till|in)|förfaller|publiceras|nytt|ny)(?![\p{L}])/iu;
export const handelseUr = text => HANDELSE.test(String(text || '')) || HANDELSE_EN.test(String(text || ''));

export function filterUr(text) {
  const t = String(text || '');
  const namn = [...t.matchAll(/(?<![\p{L}])(?:när|från|om)\s+(\p{Lu}[\p{L}-]+(?:\s+\p{Lu}[\p{L}-]+)?)\s*(?=mejlar|mailar|skriver|svarar|hör|ringer|$|[,.]| och)/gu)]
    .map(m => m[1].toLowerCase()).filter(n => !/^(jag|du|vi|maximus|mail|kalendern)$/.test(n));
  const ENGINTE = /^(i|you|we|me|my|maximus|mail|email|gmail|outlook|the|calendar|inbox|linkedin|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|today|tomorrow|now)( |$)/;
  for (const m of t.matchAll(/(?<![\p{L}])(?:when|from)\s+(\p{Lu}[\p{L}'-]+(?:\s+\p{Lu}[\p{L}'-]+)?)\s*(?=e-?mails|mails|writes|replies|responds|gets|calls|sends|$|[,.]| and| or)/gu)) {
    const n = m[1].toLowerCase();
    if (!ENGINTE.test(n)) namn.push(n);
  }
  const fran = [...new Set([
    ...[...t.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)].map(m => m[0].toLowerCase()),
    ...[...t.matchAll(/(?<![\w.+-])@[\w-]+(?:\.[\w-]+)+/g)].map(m => m[0].toLowerCase()),
    ...namn,
  ])];
  const amne = [...new Set([
    ...[...t.matchAll(/(?:ämne[t]?|rubrik(?:en)?)\s*(?:innehåller|är|:)?\s*["”“']([^"”“']{2,60})["”“']/gi)].map(m => m[1].trim()),
    ...[...t.matchAll(/(?:ämne[t]?|rubrik(?:en)?)\s+(?:innehåller|med)\s+([\p{L}\d][\p{L}\d -]{1,40})/giu)].map(m => m[1].trim()),
    ...[...t.matchAll(/(?<![\p{L}])(?:subject(?:\s+line)?|title)\s*(?:contains|includes|mentions|is|:)?\s*["”“']([^"”“']{2,60})["”“']/giu)].map(m => m[1].trim()),
    ...[...t.matchAll(/(?<![\p{L}])(?:subject(?:\s+line)?|title)\s+(?:contains|includes|mentions|with)\s+([\p{L}\d][\p{L}\d -]{1,40})/giu)].map(m => m[1].trim()),
  ])];
  if (!fran.length && !amne.length) return null;
  return { fran, amne };
}

export function passar(post, filter) {
  if (!filter || (!filter.fran?.length && !filter.amne?.length)) return true;
  const fran = String(post?.fran || '').toLowerCase();
  const titel = String(post?.titel || post?.text || '').toLowerCase();
  const franOk = !filter.fran?.length || post?.fran == null || filter.fran.some(f => fran.includes(f.toLowerCase()));
  const amneOk = !filter.amne?.length || filter.amne.some(a => titel.includes(a.toLowerCase()));
  return franOk && amneOk;
}

export function filterText(filter) {
  if (!filter) return '';
  const eller = xs => xs.join(tx('pars.schema.eller'));
  return [filter.fran?.length ? tx('pars.schema.fran', { vem: eller(filter.fran) }) : '',
    filter.amne?.length ? tx('pars.schema.amne', { vad: eller(filter.amne.map(a => `"${a}"`)) }) : '']
    .filter(Boolean).join(' · ');
}
