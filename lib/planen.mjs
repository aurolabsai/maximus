
import { svaraLokalt } from './lokal.mjs';
import { tx, aktuellt, svenska, modellprompt } from './sprakstod.mjs';

export const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli',
  'augusti', 'september', 'oktober', 'november', 'december'];
const DAGAR = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];

export const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];
export const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const ORDNING = '(?:st|nd|rd|th)?';
const DATE_EN = new RegExp(
  `\\b${MONTH}\\.?\\s+\\d{1,2}${ORDNING}\\b`
  + `|\\b\\d{1,2}${ORDNING}\\s+(?:of\\s+)?${MONTH}\\b`
  + `|\\b(?:on|next|this|coming)\\s+(?:${DAYS.join('|')})\\b`
  + `|\\b(?:tomorrow|day\\s+after\\s+tomorrow)\\b`
  + `|\\bin\\s+\\d{1,2}\\s+days?\\b`
  + `|\\b\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?\\b`, 'i');

export function snedstreck(a, b, kod = aktuellt()) {
  a = +a; b = +b;
  const usa = kod === 'en';
  let [manad, dag] = usa ? [a, b] : [b, a];
  if (manad > 12 && dag <= 12) [manad, dag] = [dag, manad];
  return manad >= 1 && manad <= 12 && dag >= 1 && dag <= 31 ? { manad, dag } : null;
}

const MANAD = '(?:jan(?:uari)?|feb(?:ruari)?|mars?|apr(?:il)?|maj|jun(?:i)?|jul(?:i)?|aug(?:usti)?|sep(?:t(?:ember)?)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATUM = new RegExp(
  `\\b\\d{4}-\\d{2}-\\d{2}\\b`
  + `|\\b\\d{1,2}(?::?e|:a)?\\s+${MANAD}\\b`
  + `|\\b(?:på|nästa|kommande|i)\\s+(?:${DAGAR.join('|')})(?:s?)\\b`
  + `|\\b(?:i\\s*morgon|imorgon|i\\s+övermorgon)\\b`, 'i');

export const harDatum = text => DATUM.test(String(text || '')) || DATE_EN.test(String(text || ''));

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const midnatt = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export function star(datum, text, nu = new Date()) {
  const d = new Date(`${datum}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return false;
  const t = String(text || '').toLowerCase();
  if (t.includes(datum)) return true;
  const manad = MANADER[d.getMonth()];
  const dag = d.getDate();
  if (new RegExp(`\\b${dag}(?::?e|:a)?\\s+${manad.slice(0, 3)}`, 'i').test(t)) return true;
  const dit = Math.round((midnatt(d) - midnatt(nu)) / 864e5);
  if (dit === 1 && /\bi\s*morgon\b|\bimorgon\b/.test(t)) return true;
  if (dit === 2 && /\bi\s+övermorgon\b/.test(t)) return true;
  if (dit >= 0 && dit <= 7 && new RegExp(`\\b${DAGAR[d.getDay()]}`, 'i').test(t)) return true;
  const month = MONTHS[d.getMonth()].slice(0, 3);
  if (new RegExp(`\\b${month}[a-z]*\\.?\\s+0?${dag}${ORDNING}\\b`, 'i').test(t)) return true;
  if (new RegExp(`\\b0?${dag}${ORDNING}\\s+(?:of\\s+)?${month}`, 'i').test(t)) return true;
  if (dit === 1 && /\btomorrow\b/.test(t) && !/\bday\s+after\s+tomorrow\b/.test(t)) return true;
  if (dit === 2 && /\bday\s+after\s+tomorrow\b/.test(t)) return true;
  if (dit >= 1 && new RegExp(`\\bin\\s+${dit}\\s+days?\\b`).test(t)) return true;
  if (dit >= 0 && dit <= 7 && new RegExp(`\\b${DAYS[d.getDay()]}`, 'i').test(t)) return true;
  for (const m of t.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) {
    const x = snedstreck(m[1], m[2]);
    if (x && x.manad === d.getMonth() + 1 && x.dag === dag) return true;
  }
  return false;
}

export function somText(datum, nu = new Date()) {
  const d = new Date(`${datum}T12:00:00`);
  if (!svenska()) return d.toLocaleDateString(aktuellt() === 'en' ? 'en-US' : aktuellt(),
    { month: 'long', day: 'numeric', ...(d.getFullYear() !== nu.getFullYear() ? { year: 'numeric' } : {}) });
  return `${d.getDate()} ${MANADER[d.getMonth()]}${d.getFullYear() !== nu.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

export function dit(datum, nu = new Date()) {
  const n = Math.round((midnatt(new Date(`${datum}T12:00:00`)) - midnatt(nu)) / 864e5);
  return n <= 0 ? tx('pars.planen.idag') : n === 1 ? tx('pars.planen.imorgon') : n < 14 ? tx('pars.planen.omDagar', { n }) : tx('pars.planen.omVeckor', { n: Math.round(n / 7) });
}

const INSTRUKTION = (idag) => `Du läser ett samtal och hittar det som ska HÄNDA på ett bestämt datum: möten, sessioner, leveranser, frister, besök. Idag är ${idag}.

För varje sådant datum:
- "datum": ÅÅÅÅ-MM-DD. Räkna fram året från dagens datum.
- "vad": vad som händer, högst 60 tecken, utan datumet. Skriv som en rubrik: "Planeringsmöte 2 med leverantören".
- "forbered": det som behöver vara klart INNAN, högst 3 korta punkter. Bara sådant som följer av texten.
- "fragor": det du skulle behöva veta för att kunna hjälpa till att förbereda, högst 3 korta frågor till användaren.

Bara datum som står i texten. Inga datum som redan passerat. Högst 2.
Svara bara med JSON: {"planer":[{"datum":"","vad":"","forbered":[],"fragor":[]}]}
Finns inget: {"planer":[]}`;

function jsonUr(text) {
  const m = /\{[\s\S]*\}/.exec(String(text || ''));
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

const rad = (x, tak) => String(x || '').replace(/\s+/g, ' ').trim().slice(0, tak);

export async function las(fraga, svar, { svara = svaraLokalt, nu = new Date(), signal } = {}) {
  const kalla = `${fraga || ''}\n${svar || ''}`;
  if (!harDatum(kalla)) return [];
  const idag = `${DAGAR[nu.getDay()]} ${iso(nu)}`;
  let ra;
  try {
    ra = await svara(`${modellprompt(INSTRUKTION(idag))}\n\nFRÅGAN:\n${String(fraga || '').slice(0, 1500)}\n\nSVARET:\n${String(svar || '').slice(0, 6000)}`,
      { signal, plats: 'efterat', tak: 600 });
  } catch { return []; }
  const j = jsonUr(ra);
  const idagMidnatt = midnatt(nu);
  const sedda = new Set();
  return (Array.isArray(j?.planer) ? j.planer : [])
    .map(p => ({ datum: rad(p?.datum, 10), vad: rad(p?.vad, 60),
      forbered: (Array.isArray(p?.forbered) ? p.forbered : []).map(x => rad(x, 140)).filter(Boolean).slice(0, 3),
      fragor: (Array.isArray(p?.fragor) ? p.fragor : []).map(x => rad(x, 140)).filter(Boolean).slice(0, 3) }))
    .filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.datum) && p.vad)
    .filter(p => {
      const d = midnatt(new Date(`${p.datum}T12:00:00`));
      return d >= idagMidnatt && d - idagMidnatt <= 400 * 864e5;
    })
    .filter(p => star(p.datum, kalla, nu))
    .filter(p => !sedda.has(p.datum) && sedda.add(p.datum))
    .slice(0, 2);
}

export function ics({ id, datum, vad, om = '' }, nu = new Date()) {
  const dag = datum.replace(/-/g, '');
  const nasta = iso(new Date(new Date(`${datum}T12:00:00`).getTime() + 864e5)).replace(/-/g, '');
  const stamp = nu.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, m => `\\${m}`).replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aurolabs//Maximus//SV', 'BEGIN:VEVENT',
    `UID:${id}@maximus`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${dag}`, `DTEND;VALUE=DATE:${nasta}`,
    `SUMMARY:${esc(vad)}`, ...(om ? [`DESCRIPTION:${esc(om)}`] : []),
    'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}
