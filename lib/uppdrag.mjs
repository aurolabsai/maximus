
import { randomUUID } from 'node:crypto';
import * as Schema from './schema.mjs';
import { tx } from './sprakstod.mjs';

export const KALLOR = ['epost', 'kalender', 'bevakning', 'anteckningar', 'sida', 'meddelanden', 'paminnelser', 'samtal', 'mapp', 'amne', 'sok', 'flode', 'koppling'];

const TAKT = {
  lokal: { minst: 5, forval: 15 },
  sida: { minst: 30, forval: 180 },
};

const SAGT = [
  [/(?<![\p{L}\d])(varje|var)\s+(?:kvart|femtonde\s+minut)(?![\p{L}\d])/iu, 15],
  [/(?<![\p{L}\d])(?:varje\s+halvtimme|var\s+30:?e\s+minut)(?![\p{L}\d])/iu, 30],
  [/(?<![\p{L}\d])(?:varje\s+timme|en\s+gång\s+i\s+timmen|per\s+timme|timvis)(?![\p{L}\d])/iu, 60],
  [/(?<![\p{L}\d])(?:varje\s+morgon|varje\s+dag|dagligen|en\s+gång\s+om\s+dagen|per\s+dag)(?![\p{L}\d])/iu, 1440],
  [/(?<![\p{L}\d])(?:varje\s+vecka|veckovis|en\s+gång\s+i\s+veckan|varje\s+måndag|varje\s+fredag)(?![\p{L}\d])/iu, 10080],
  [/(?<![\p{L}\d])(?:every\s+(?:quarter\s+(?:of\s+an\s+)?hour|15\s+min(?:ute)?s)|every\s+fifteen\s+minutes)(?![\p{L}\d])/iu, 15],
  [/(?<![\p{L}\d])(?:every\s+half\s+(?:an\s+)?hour|every\s+30\s+min(?:ute)?s|every\s+thirty\s+minutes)(?![\p{L}\d])/iu, 30],
  [/(?<![\p{L}\d])(?:every\s+hour|hourly|once\s+an\s+hour|per\s+hour)(?![\p{L}\d])/iu, 60],
  [/(?<![\p{L}\d])(?:every\s+morning|every\s+day|daily|once\s+a\s+day|per\s+day)(?![\p{L}\d])/iu, 1440],
  [/(?<![\p{L}\d])(?:every\s+week|weekly|once\s+a\s+week|every\s+monday|every\s+friday)(?![\p{L}\d])/iu, 10080],
];

const ENGANG = /(?<![\p{L}\d])(en\s+gång|engångs|bara\s+nu|just\s+nu|i\s+dag\s+bara|nu\s+direkt|just\s+once|only\s+once|one[-\s]time|one-off|right\s+now|just\s+(?:for\s+)?today|only\s+today|right\s+away)(?![\p{L}\d])/iu;
const LOPANDE = /(?<![\p{L}\d])(bevaka|bevakning|håll\s+koll|löpande|kontinuerligt|varje|framöver|hädanefter|säg\s+till\s+när|watch(?:\s+for)?|monitor(?:ing)?|keep\s+(?:an\s+eye|tabs)\s+on|keep\s+track|ongoing|continuously|every|from\s+now\s+on|going\s+forward|tell\s+me\s+when|let\s+me\s+know\s+when|whenever|daily|weekly|hourly|once\s+(?:a|an|per)\s+(?:day|week|hour|month))(?![\p{L}\d])/iu;

export function arAterkommande(instruktion) {
  const t = String(instruktion || '');
  if (ENGANG.test(t)) return false;
  if (LOPANDE.test(t)) return true;
  return null;
}

export function taktAv(instruktion, kallor = []) {
  for (const [re, minuter] of SAGT) if (re.test(String(instruktion || ''))) return minuter;
  const sida = kallor.some(k => ['sida', 'amne', 'sok'].includes(typeof k === 'string' ? k : k?.typ));
  return sida ? TAKT.sida.forval : TAKT.lokal.forval;
}

export const minstaTakt = kallor =>
  (kallor.some(k => ['sida', 'amne', 'sok', 'koppling'].includes(typeof k === 'string' ? k : k?.typ)) ? TAKT.sida.minst : TAKT.lokal.minst);

export function sfarUr(text) {
  const t = String(text || '');
  if (/\bbara\s+(?:det\s+som\s+(?:rör|gäller)\s+)?(jobb\p{L}*|arbete\p{L}*|tjänst\p{L}*)|\binget\s+privat|\bjobbrelaterat\b/iu.test(t)) return 'jobb';
  if (/\bbara\s+(?:det\s+)?privat\p{L}*|\binget\s+jobb/iu.test(t)) return 'privat';
  if (/\bonly\s+(?:(?:things|stuff|what(?:'s|\s+is)?)\s+(?:related\s+to|about)\s+)?(?:my\s+)?(?:work|job)\b|\b(?:work|job)(?:-related)?\s+only\b|\bnothing\s+(?:personal|private)\b/i.test(t)) return 'jobb';
  if (/\bonly\s+(?:my\s+)?(?:personal|private)\b|\b(?:personal|private)\s+only\b|\bnothing\s+(?:work|job)(?:-related)?\b/i.test(t)) return 'privat';
  return null;
}

export function namnUr(text) {
  let t = String(text || '').trim()
    .replace(/^(håll\s+koll\s+på|bevaka|säg\s+till\s+när|hitta|leta\s+efter)\s+/i, '')
    .replace(/^(?:please\s+)?(keep\s+(?:an\s+eye|tabs)\s+on|keep\s+track\s+of|watch(?:\s+for)?|monitor|tell\s+me\s+when|let\s+me\s+know\s+when|find|look\s+for)\s+/i, '')
    .split(/\s+(för\s+att|så\s+att|och\s+(?:säg|lyft|sammanfatta|ge)|so\s+that|in\s+order\s+to|and\s+(?:tell|highlight|summarize|give))\b|[.,;!?]/i)[0]
    .replace(/^my\s+/i, '')
    .replace(/^(min|mina|mitt)\s+(\p{L}+)/iu, (_, __, o) => o.endsWith('n') || o.endsWith('r') ? o : o)
    .trim();
  t = t.replace(/^kalender\b/i, 'kalendern').replace(/^inkorg\b/i, 'inkorgen');
  if (!t) return '';
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.length > 60 ? `${t.slice(0, 58).replace(/\s+\S*$/, '')}…` : t;
}

export function nyttUppdrag({ instruktion, kallor = [], aterkommande = null, takt = null, titel = '', projekt = null, schema, filter, handelse, nu = new Date() } = {}) {
  const text = String(instruktion || '').trim();
  if (!text) throw new Error(tx('pars.uppdrag.utanInstruktion'));

  const rena = [];
  for (const k of kallor) {
    const typ = typeof k === 'string' ? k : k?.typ;
    if (!KALLOR.includes(typ)) throw new Error(tx('pars.uppdrag.okandKalla', { typ }));
    rena.push(typ === 'sida' ? { typ: 'sida', url: String(k.url || '').trim() }
      : typ === 'amne' ? { typ: 'amne', fraga: String(k.fraga || text).slice(0, 160), kallmangd: Array.isArray(k.kallmangd) ? k.kallmangd : [] }
      : typ === 'sok' ? { typ: 'sok', fraga: String(k.fraga || text).slice(0, 300), varor: Boolean(k.varor), antal: Number(k.antal) || null }
      : typ === 'mapp' && k?.sokvag ? { typ: 'mapp', sokvag: String(k.sokvag) }
      : typ === 'koppling' ? { typ: 'koppling', id: String(k.id || ''), namn: String(k.namn || '').slice(0, 80), verktyg: (Array.isArray(k.verktyg) ? k.verktyg : []).map(String).slice(0, 4) }
      : { typ });
  }
  if (!rena.length) throw new Error(tx('pars.uppdrag.utanKalla'));
  for (const k of rena) if (k.typ === 'sida' && !/^https?:\/\//i.test(k.url)) {
    throw new Error(tx('pars.uppdrag.sidaAdress'));
  }

  const ater = aterkommande ?? arAterkommande(text) ?? true;
  const bad = Number(takt) > 0 ? Math.round(Number(takt)) : taktAv(text, rena);
  const vald = Math.max(bad, minstaTakt(rena));

  return {
    id: randomUUID(),
    skapad: nu.toISOString(),
    projekt: projekt || null,
    titel: String(titel || '').trim().slice(0, 90) || text.slice(0, 60),
    instruktion: text,
    schema: ater ? (schema === undefined ? Schema.schemaUr(text) : schema) : null,
    filter: filter === undefined ? Schema.filterUr(text) : filter,
    sfar: sfarUr(text),
    handelse: ater ? (handelse === undefined ? Schema.handelseUr(text) : Boolean(handelse)) : false,
    kallor: rena,
    aterkommande: ater,
    takt: ater ? vald : null,
    nasta: nu.toISOString(),
    senast: null,
    tillstand: 'vantar',
    fel: { antal: 0, senast: null, varfor: null },
    vattenmarke: {},
    sett: false,
  };
}

export function farKoras(u, nu = new Date()) {
  if (!u || u.tillstand === 'pausad') return false;
  if (!u.aterkommande && u.senast) return false;
  return !u.nasta || new Date(u.nasta) <= nu;
}

export const FEL_INNAN_PAUS = 3;

export const ATERFORSOK_EFTER_PAUS = 6 * 3600_000;

export const BEHORIGHET_RUTA = { kalender: 'kalender', paminnelser: 'paminnelser', meddelanden: 'fda',
  epost: 'automation', anteckningar: 'automation', mapp: 'filer' };

export function efterKorning(u, { fel = null, behorighet = null, vattenmarke = null, fynd = 0, nu = new Date() } = {}) {
  const ny = { ...u, senast: nu.toISOString(), fel: { ...u.fel } };
  if (vattenmarke) ny.vattenmarke = { ...u.vattenmarke, ...vattenmarke };

  if (fel) {
    ny.fel = { antal: (u.fel?.antal || 0) + 1, senast: nu.toISOString(), varfor: String(fel), ...(behorighet ? { behorighet } : {}) };
    ny.tillstand = ny.fel.antal >= FEL_INNAN_PAUS ? 'pausad' : 'vantar';
  } else {
    ny.fel = { antal: 0, senast: null, varfor: null };
    ny.tillstand = u.aterkommande ? 'vantar' : 'klar';
  }
  if (fynd > 0) ny.sett = false;

  ny.nasta = ny.aterkommande && ny.tillstand !== 'pausad'
    ? (ny.schema ? Schema.nastaTid(ny.schema, nu)?.toISOString() || null
      : new Date(nu.getTime() + (ny.takt || 15) * 60000).toISOString())
    : null;
  if (fel && ny.tillstand === 'pausad') ny.pausTill = new Date(nu.getTime() + ATERFORSOK_EFTER_PAUS).toISOString();
  return ny;
}

export const aterstall = (u, nu = new Date()) => ({
  ...u,
  tillstand: 'vantar',
  fel: { antal: 0, senast: null, varfor: null },
  nasta: nu.toISOString(),
});

export const sammandrag = u => ({
  id: u.id,
  titel: u.titel,
  projekt: u.projekt || null,
  kallor: u.kallor.map(k => (k.typ === 'sida' ? `sida: ${varden(k.url)}` : k.typ)),
  kallval: u.kallor.map(k => ({ typ: k.typ, ...(k.sokvag ? { sokvag: k.sokvag } : {}), ...(k.url ? { url: k.url } : {}) })),
  ...(u.kallor.some(k => k.typ === 'amne') ? { amne: u.kallor.find(k => k.typ === 'amne').fraga,
    kallmangd: (u.kallor.find(k => k.typ === 'amne').kallmangd || []).map(x => ({ titel: x.titel, vard: x.vard, url: x.url, flode: Boolean(x.flode) })) } : {}),
  aterkommande: u.aterkommande,
  takt: u.takt,
  schema: u.schema ? Schema.somText(u.schema) : null,
  filter: u.filter ? Schema.filterText(u.filter) : null,
  handelse: Boolean(u.handelse),
  sfar: u.sfar || null,
  tillstand: u.tillstand,
  pausTill: u.pausTill || null,
  senast: u.senast,
  nasta: u.nasta,
  fel: u.fel?.antal || 0,
  ...(u.fel?.varfor ? { felVarfor: String(u.fel.varfor).slice(0, 300) } : {}),
  ...(u.fel?.behorighet && BEHORIGHET_RUTA[u.fel.behorighet] ? { felBehorighet: BEHORIGHET_RUTA[u.fel.behorighet], felKalla: u.fel.behorighet } : {}),
  sett: Boolean(u.sett),
  session: u.session || null,
});

function varden(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return String(url).slice(0, 40); }
}
