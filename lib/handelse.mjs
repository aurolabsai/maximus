
import { svaraLokalt } from './lokal.mjs';
import { star, MANADER, DAYS, snedstreck } from './planen.mjs';
import { tx, aktuellt, svenska, modellprompt } from './sprakstod.mjs';

const DAGAR = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];

const LAGG_IN = /(?<![\p{L}\d])(sätt|sätta|lägg|lägga|boka|skapa|planera\s+in)(\s+in|\s+upp)?\b[\s\S]{0,80}?\b(möte\p{L}*|händelse\p{L}*|lunch\p{L}*|träff\p{L}*|kalender\p{L}*|tid\b|bokning\p{L}*)/iu;
const NAR = /\b\d{1,2}[.:]\d{2}\b|\bkl\.?\s*\d|\b\d{1,2}\/\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}(?::?e|:a)?\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)|\b(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag|i\s*morgon|imorgon)\b/i;

const LAGG_IN_EN = /(?<![\p{L}\d])(put|add|book|schedule|create|set\s+up|plan|enter|pencil|arrange)(\s+in|\s+up)?\b[\s\S]{0,80}?\b(meetings?|events?|lunch\w*|calls?|appointments?|calendar|slot|sessions?|catch-?up)\b/iu;
const NAR_EN = /\bat\s+\d|\b\d{1,2}(?::\d{2})?\s*[ap]\.?m\b|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;

export const avsikt = text => {
  const t = String(text || '');
  return (LAGG_IN.test(t) || LAGG_IN_EN.test(t)) && (NAR.test(t) || NAR_EN.test(t));
};

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dagenStar(datum, text, nu = new Date()) {
  if (star(datum, text, nu)) return true;
  const d = new Date(`${datum}T12:00:00`);
  for (const m of String(text || '').matchAll(/\b(\d{1,2})\/(\d{1,2})\b/g)) {
    const x = snedstreck(m[1], m[2]);
    if (x && x.manad === d.getMonth() + 1 && x.dag === d.getDate()) return true;
  }
  return false;
}

const INSTRUKTION = (idag) => `Läs ut ett möte som ska läggas in i kalendern. Idag är ${idag}.

Svara bara med JSON:
{"titel":"", "datum":"ÅÅÅÅ-MM-DD", "start":"HH:MM", "slut":"HH:MM eller tomt", "plats":"", "deltagare":[{"namn":"", "epost":""}], "obligatoriskt":false, "paminnelser":[{"typ":"fore","minuter":60} eller {"typ":"veckodag","veckodag":"måndag","tid":"HH:MM eller tomt"} eller {"typ":"datum","datum":"ÅÅÅÅ-MM-DD","tid":"HH:MM eller tomt"}], "anteckning":""}

Regler:
- "titel": vad mötet är, högst 60 tecken.
- "datum": räkna fram året från dagens datum. "15/10" är 15 oktober.
- "deltagare": bara e-postadresser som står i texten. Hitta aldrig på en adress.
- "obligatoriskt": true om texten säger att närvaro är obligatorisk (mandatory, obligatoriskt, måste).
- "paminnelser": "30 minuter före" är {"typ":"fore","minuter":30}. "tisdag samma vecka" är {"typ":"veckodag","veckodag":"tisdag"}. Räkna inte ut datum för påminnelser själv.
- Saknas något: lämna det tomt.`;

function jsonUr(text) {
  const m = /\{[\s\S]*\}/.exec(String(text || ''));
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

const tid = t => (/^\d{1,2}[.:]\d{2}$/.test(String(t || '').trim()) ? String(t).trim().replace('.', ':').padStart(5, '0') : null);
const rad = (x, tak) => String(x || '').replace(/\s+/g, ' ').trim().slice(0, tak);

export async function las(text, { svara = svaraLokalt, nu = new Date(), signal } = {}) {
  if (!avsikt(text)) return null;
  const idag = `${DAGAR[nu.getDay()]} ${iso(nu)}`;
  let ra;
  try {
    const instruktion = svenska() ? INSTRUKTION(idag)
      : modellprompt(INSTRUKTION(idag).replace('"15/10" är 15 oktober.', aktuellt() === 'en' ? '"10/15" är 15 oktober (månad/dag, amerikansk ordning); "15/10" också.' : '"15/10" är 15 oktober.'),
        { markorer: ['"fore"', '"veckodag"', '"datum"'] });
    ra = await svara(`${instruktion}\n\nTEXTEN:\n${String(text).slice(0, 2000)}`, { signal, plats: 'efterat', tak: 500 });
  } catch { return null; }
  const j = jsonUr(ra);
  if (!j) return null;

  const datum = rad(j.datum, 10);
  const start = tid(j.start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !start) return null;
  if (!dagenStar(datum, text, nu)) return null;
  const borjar = new Date(`${datum}T${start}:00`);
  if (!Number.isFinite(borjar.getTime()) || borjar < nu) return null;
  const slut = tid(j.slut) && tid(j.slut) > start ? tid(j.slut) : null;
  const slutar = slut ? new Date(`${datum}T${slut}:00`) : new Date(borjar.getTime() + 60 * 60e3);

  const kalla = String(text).toLowerCase();
  const deltagare = (Array.isArray(j.deltagare) ? j.deltagare : [])
    .map(d => ({ namn: rad(d?.namn, 60), epost: rad(d?.epost, 120).toLowerCase() }))
    .filter(d => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.epost) && kalla.includes(d.epost))
    .slice(0, 20);

  const paminnelser = [];
  for (const p of Array.isArray(j.paminnelser) ? j.paminnelser : []) {
    let nar = null;
    if (p?.typ === 'fore' && Number(p.minuter) > 0) nar = new Date(borjar.getTime() - Number(p.minuter) * 60e3);
    else if (p?.typ === 'veckodag') {
      const vd = String(p.veckodag || '').toLowerCase();
      const v = DAGAR.includes(vd) ? DAGAR.indexOf(vd) : DAYS.indexOf(vd);
      if (v >= 0) {
        const d = new Date(borjar); d.setHours(0, 0, 0, 0);
        const fran = (d.getDay() + 6) % 7, till = (v + 6) % 7;
        d.setDate(d.getDate() - fran + till);
        const [h, m] = (tid(p.tid) || '09:00').split(':').map(Number);
        d.setHours(h, m, 0, 0);
        nar = d;
      }
    } else if (p?.typ === 'datum' && /^\d{4}-\d{2}-\d{2}$/.test(p.datum || '')) {
      nar = new Date(`${p.datum}T${tid(p.tid) || '09:00'}:00`);
    }
    if (nar && Number.isFinite(nar.getTime()) && nar < borjar && nar > nu) paminnelser.push(nar.toISOString());
  }

  return {
    titel: rad(j.titel, 60) || tx('pars.handelse.mote'),
    start: borjar.toISOString(), slut: slutar.toISOString(),
    plats: rad(j.plats, 120),
    deltagare, obligatoriskt: Boolean(j.obligatoriskt),
    paminnelser: [...new Set(paminnelser)].sort(),
    anteckning: rad(j.anteckning, 400),
  };
}

const lokalen = () => (svenska() ? 'sv-SE' : aktuellt() === 'en' ? 'en-US' : aktuellt());
const kl = d => d.toLocaleTimeString(lokalen(), { hour: '2-digit', minute: '2-digit' });
const dag = (d, nu = new Date()) => (svenska()
  ? `${DAGAR[d.getDay()]} ${d.getDate()} ${MANADER[d.getMonth()]}${d.getFullYear() !== nu.getFullYear() ? ` ${d.getFullYear()}` : ''}`
  : d.toLocaleDateString(lokalen(), { weekday: 'long', month: 'long', day: 'numeric', ...(d.getFullYear() !== nu.getFullYear() ? { year: 'numeric' } : {}) }));

export function somText(h, nu = new Date()) {
  const s = new Date(h.start), e = new Date(h.slut);
  return [
    `**${h.titel}**`,
    `${dag(s, nu)}, ${kl(s)}–${kl(e)}`,
    ...(h.plats ? [h.plats] : []),
    ...(h.deltagare.length ? [tx('pars.handelse.deltagare', { vilka: h.deltagare.map(d => d.epost).join(', '), obligatoriskt: h.obligatoriskt ? tx('pars.handelse.obligatoriskt') : '' })] : []),
    ...(h.paminnelser.length ? [tx('pars.handelse.paminnelser', { nar: h.paminnelser.map(p => { const d = new Date(p); return `${dag(d, nu)} ${kl(d)}`; }).join(tx('pars.handelse.och')) })] : []),
  ].join('\n');
}

export function ics(h, { id, nu = new Date() } = {}) {
  const lokal = d => { const x = new Date(d); return `${iso(x).replace(/-/g, '')}T${String(x.getHours()).padStart(2, '0')}${String(x.getMinutes()).padStart(2, '0')}00`; };
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, m => `\\${m}`).replace(/\n/g, '\\n');
  const stamp = nu.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const start = new Date(h.start);
  const rader = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aurolabs//Maximus//SV', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${id}@maximus`, `DTSTAMP:${stamp}`, `DTSTART:${lokal(h.start)}`, `DTEND:${lokal(h.slut)}`,
    `SUMMARY:${esc(h.titel)}`,
    ...(h.plats ? [`LOCATION:${esc(h.plats)}`] : []),
    ...(h.anteckning ? [`DESCRIPTION:${esc(h.anteckning)}`] : []),
    ...h.deltagare.map(d => `ATTENDEE;ROLE=${h.obligatoriskt ? 'REQ-PARTICIPANT' : 'OPT-PARTICIPANT'};RSVP=TRUE${d.namn ? `;CN=${esc(d.namn)}` : ''}:mailto:${d.epost}`)];
  for (const p of h.paminnelser) {
    const min = Math.round((start - new Date(p)) / 60e3);
    rader.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(h.titel)}`, `TRIGGER:-PT${min}M`, 'END:VALARM');
  }
  rader.push('END:VEVENT', 'END:VCALENDAR', '');
  return rader.join('\r\n');
}
