
import { randomUUID } from 'node:crypto';
import { byggBilaga, rensaPakallande } from './uppslag.mjs';
import { pakallandeFor } from './injektion.mjs';
import * as Underlag from './underlag.mjs';
import * as Konton from './konton.mjs';
import { tx, modellprompt } from './sprakstod.mjs';

export const SORTER = ['svara', 'boka', 'hora_av', 'folj_upp'];
export const SKAL = ['inte_relevant', 'redan_gjort', 'fraga_inte'];
export const TAK = 5;
export const UNDERLAG_TAK = 24;
export const DYGN = 2;
export const FORSLAG_MS = 3 * 36e5;
export const MINNE_DAGAR = 60;
export const AKTIV_SEK = 120;
export const NARVARO_MS = 3 * 60e3;
export const FRAGOR_PER_KNACK = 3;
export const AMNE_DAGAR = 30;

const s = v => String(v ?? '');
const rent = t => rensaPakallande(s(t)).text;
const mening = (t, n = 180) => rent(t).replace(/\s+/g, ' ').trim().slice(0, n);
const norm = t => s(t).toLowerCase().replace(/<[^>]*>/g, '').replace(/["'«»”“]/g, '').replace(/\s+/g, ' ').trim();
const dag = 864e5;
const tidText = t => { const d = new Date(t); return Number.isFinite(+d) ? `${d.toISOString().slice(0, 10)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : s(t); };
const lokalIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export const FORVAL = { forslag: true, knack: true, dagar: 1 };
export const DAGAR = [1, 2, 3, 7, 14];

export function installningUr(v, fore = FORVAL) {
  const x = v && typeof v === 'object' ? v : {};
  const f = { ...FORVAL, ...(fore && typeof fore === 'object' ? fore : {}) };
  return {
    forslag: typeof x.forslag === 'boolean' ? x.forslag : f.forslag !== false,
    knack: typeof x.knack === 'boolean' ? x.knack : f.knack !== false,
    dagar: DAGAR.includes(Number(x.dagar)) ? Number(x.dagar) : (DAGAR.includes(Number(f.dagar)) ? Number(f.dagar) : 1),
  };
}

export const lage = installningar => installningUr(installningar?.kollega);

export const tomtMinne = () => ({ forslag: [], svar: [], aldrig: [], senastForslag: null,
  knack: { senast: null, uppskjuten: null, aldrig: [], fragat: {}, oppen: null } });

export function minneUr(v) {
  const t = tomtMinne();
  if (!v || typeof v !== 'object') return t;
  const k = v.knack && typeof v.knack === 'object' ? v.knack : {};
  return {
    forslag: Array.isArray(v.forslag) ? v.forslag.slice(-200) : [],
    svar: Array.isArray(v.svar) ? v.svar.slice(-300) : [],
    aldrig: Array.isArray(v.aldrig) ? v.aldrig.filter(x => x?.om).slice(-100) : [],
    senastForslag: v.senastForslag || null,
    knack: {
      senast: k.senast || null, uppskjuten: k.uppskjuten || null,
      aldrig: Array.isArray(k.aldrig) ? k.aldrig.map(s).slice(-100) : [],
      fragat: k.fragat && typeof k.fragat === 'object' ? k.fragat : {},
      oppen: k.oppen && typeof k.oppen === 'object' ? k.oppen : null,
    },
  };
}

export function underlagUr({ fynd = [], moten = [], epost = null, nu = new Date(), dygn = DYGN, tak = UNDERLAG_TAK } = {}) {
  const t0 = new Date(nu).getTime();
  const nya = (fynd || []).filter(f => f && !f.obedomd && t0 - Date.parse(f.skapad || f.tid || 0) <= dygn * dag)
    .sort((a, b) => (b.vikt || 0) - (a.vikt || 0) || Date.parse(b.skapad || 0) - Date.parse(a.skapad || 0));
  const ut = [];
  for (const f of nya.slice(0, Math.max(0, tak - Math.min(8, (moten || []).length)))) {
    const kort = Underlag.kort(f);
    const etikett = f.brev?.konto ? (Konton.kontoEtikett(epost, f.brev.konto) || (f.sfarAv === 'kalla' ? f.sfar : null))
      : (f.sfarAv === 'kalla' ? f.sfar : null);
    ut.push({ kort, sort: kort.ref?.sort || 'annat', etikett: etikett || null, vem: f.fran || null, tid: f.tid || f.skapad || null,
      titel: f.titel || '', text: f.text || '', varfor: f.varfor || '', pakallande: Boolean(f.pakallande),
      brev: f.brev?.konto && f.brev?.id ? { ...f.brev } : null,
      svarFinns: Boolean(f.svarsforslag && f.svarsforslag !== 'provat') });
  }
  for (const m of (moten || []).filter(m => m?.start && !m.heldag && Math.abs(Date.parse(m.start) - t0) <= dygn * dag)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).slice(0, 8)) {
    const text = [m.plats ? tx('lib.kollega.mote.plats', { plats: m.plats }) : '',
      m.deltagare?.length ? tx('lib.kollega.mote.kallade', { vem: m.deltagare.join(', ') }) : '', m.text || ''].filter(Boolean).join('\n');
    const pakallande = pakallandeFor(`${m.rubrik || ''}\n${text}`);
    const kort = Underlag.kort({ id: `kalender:${m.id || `${m.rubrik}@${m.start}`}`, titel: m.rubrik || tx('lib.kollega.mote.utanRubrik'),
      kalla: 'kalender', tid: m.start, text, pakallande, ref: { sort: 'kalender', id: s(m.id || `${m.rubrik}@${m.start}`), tid: s(m.start) } });
    const start = Date.parse(m.start), slut = Date.parse(m.slut || m.start);
    ut.push({ kort, sort: 'kalender', etikett: m.etikett || null, vem: null, tid: m.start, titel: m.rubrik || '', text, varfor: '', pakallande,
      mote: { start: m.start, slut: m.slut || null, deltagare: m.deltagare || [], lage: slut < t0 ? 'forbi' : start <= t0 ? 'pagar' : 'kommer' } });
  }
  return ut.map((x, i) => ({ nr: i + 1, ...x }));
}

function postRad(x) {
  const huvud = [
    `nr ${x.nr}`,
    { mejl: 'mejl', kalender: 'möte i kalendern', flode: 'LinkedIn-flödet', meddelande: 'meddelande' }[x.sort] || x.sort,
    x.etikett ? `etikett: ${rent(Konton.etikettNamn(x.etikett))}` : null,
    x.vem ? `från: ${mening(x.vem, 120)}` : null,
    x.tid ? `tid: ${tidText(x.tid)}` : null,
    x.mote ? ({ forbi: 'har varit', pagar: 'pågår nu', kommer: 'kommande' })[x.mote.lage] : null,
    x.svarFinns ? 'ett svarsförslag finns redan' : null,
  ].filter(Boolean).join(' · ');
  if (x.pakallande) return `${huvud}\n(texten utelämnad: den försökte styra modellen)`;
  return [huvud, mening(x.titel, 160), rent(x.text).slice(0, 600), x.varfor ? `agentens bedömning: ${mening(x.varfor)}` : ''].filter(Boolean).join('\n');
}

export function lardaRader(minne, { nu = new Date() } = {}) {
  const m = minneUr(minne);
  const t0 = new Date(nu).getTime();
  const SKALORD = { inte_relevant: 'inte relevant', redan_gjort: 'redan gjort', fraga_inte: 'fråga inte om det här' };
  const rader = m.svar.filter(x => t0 - Date.parse(x.nar || 0) <= MINNE_DAGAR * dag).slice(-12).reverse()
    .map(x => (x.tagen ? `Tog förslaget: «${mening(x.titel, 120)}».` : `Tackade nej till «${mening(x.titel, 120)}» (${SKALORD[x.skal] || 'inget skäl'}).`));
  const aldrig = m.aldrig.map(x => mening(x.om, 80)).filter(Boolean);
  if (aldrig.length) rader.push(`Föreslå aldrig något som rör: ${[...new Set(aldrig)].join(', ')}.`);
  return rader;
}

export function forslagsPrompt({ profil = '', underlag = [], larda = [], nu = new Date(), tak = TAK } = {}) {
  return modellprompt([
    'Du är användarens kollega och föreslår vad hen kan göra. Du svarar bara med JSON.',
    profil ? rent(profil) : '',
    `Nu är det ${tidText(nu)}.`,
    `Läs underlaget och föreslå högst ${tak} konkreta saker användaren själv kan göra i dag eller de närmaste dagarna: svara på ett mejl, boka in något, höra av sig till en person, följa upp ett möte.`,
    'Varje förslag bygger på underlaget. Skriv i "nr" numren på de poster som pekar dit, och i "varfor" en mening om vad i underlaget som pekar dit: vem som skrev vad, vilket möte, vilket inlägg. Konkret, inget beröm, inga gissningar.',
    'Hellre inga förslag än svaga. Inget för reklam, nyhetsbrev eller automatiska notiser.',
    'Sorterna: "svara" (bara på ett mejl i underlaget), "boka" (något att lägga in i kalendern; skriv "start" och "slut" som ÅÅÅÅ-MM-DDTHH:MM bara när dagen och tiden står i underlaget, annars tomma), "hora_av" (höra av sig till en person; skriv vem i "vem"), "folj_upp" (följa upp ett möte eller en tråd).',
    'Ber ett mejl uttryckligen om ett möte eller en tid ("kan vi ses", "har du tid", "can we meet"): föreslå både "svara" och "boka" för det mejlet, med samma nr. Hitta aldrig på en tid: står ingen dag och tid i mejlet lämnar du start och slut tomma, och användaren väljer.',
    'Skriv för svara, hora_av och folj_upp ett kort utkast i "utkast" på svenska, i användarens röst (jag-form). Användaren läser, ändrar och skickar själv. Du skickar aldrig något och tar aldrig kontakt med någon.',
    ...(larda.length ? ['Det här har användaren sagt om tidigare förslag. Följ det:', ...larda.map(r => `- ${rent(r)}`)] : []),
    'Svara med exakt detta och inget annat:',
    '{"forslag":[{"sort":"hora_av","nr":[2],"vem":"...","titel":"...","varfor":"...","utkast":"...","start":"","slut":""}]}',
    '',
    byggBilaga('underlag att föreslå ur', (underlag || []).map(postRad).join('\n\n')),
  ].filter(x => x !== '').join('\n'), { markorer: ['"forslag"', '"svara"', '"boka"', '"hora_av"', '"folj_upp"'] });
}

export function nyckel(f) {
  if (f.sort === 'hora_av' && f.vem) return `hora_av:${norm(f.vem).replace(/@.*$/, '')}`;
  const r = f.underlag?.[0]?.ref;
  const id = r ? `${r.sort}:${r.konto ? `${r.konto}/` : ''}${r.id || r.url || r.sokvag || ''}` : norm(f.underlag?.[0]?.titel);
  return `${f.sort}:${id}`;
}

const namner = om => {
  const z = s(om).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!z) return () => false;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${z}`, 'iu');
  return t => re.test(s(t));
};

export const omFor = f => mening(f.vem || f.underlag?.[0]?.fran || f.underlag?.[0]?.titel || f.titel, 80);

export function stoppas(minne, f, { nu = new Date() } = {}) {
  const m = minneUr(minne);
  const t0 = new Date(nu).getTime();
  const k = f.nyckel || nyckel(f);
  if (m.svar.some(x => x.nyckel === k && t0 - Date.parse(x.nar || 0) <= MINNE_DAGAR * dag)) return 'besvarat';
  if (m.forslag.some(x => x.nyckel === k && x.status === 'forslag' && t0 - Date.parse(x.skapad || 0) < 7 * dag)) return 'oppet';
  const texter = [f.vem, f.titel, ...(f.underlag || []).flatMap(u => [u.titel, u.fran])];
  for (const a of m.aldrig) if (texter.some(namner(a.om))) return 'aldrig';
  return null;
}

const tidUr = v => {
  const m = /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)/.exec(s(v).trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isFinite(+d) ? d : null;
};

const MOTESFRAGA = new RegExp([
  String.raw`\bkan (?:vi|du|ni) (?:ses|träffas|höras|ringas|ta ett (?:möte|samtal)|boka)`,
  String.raw`\bskulle (?:vi|du|ni) kunna (?:ses|träffas|höras|ta ett möte)`,
  String.raw`\b(?:boka|bokar|sätta upp|lägga in) (?:in )?(?:ett |en )?(?:möte|samtal|tid|avstämning)`,
  String.raw`\bhar (?:du|ni) tid\b`, String.raw`\b(?:ses|träffas) (?:vi|gärna)\b`, String.raw`\bvill (?:gärna )?(?:ses|träffas|boka)`,
  String.raw`\bföreslår (?:ett möte|att vi ses|att vi träffas)`,
  String.raw`\bcan (?:we|you) (?:meet|schedule|set up|book|have a (?:call|chat|meeting)|hop on|talk)`,
  String.raw`\b(?:could|shall) we (?:meet|schedule|set up|have a (?:call|meeting))`,
  String.raw`\b(?:schedule|set up|book|arrange) (?:a |an )?(?:call|meeting|time|chat)`,
  String.raw`\b(?:do|would) you have (?:some )?time\b`, String.raw`\bare you (?:free|available)\b`, String.raw`\blet'?s (?:meet|have a call|set up)`,
].join('|'), 'iu');
export const motesfraga = t => MOTESFRAGA.test(s(t));

const VECKODAGAR = [['söndag', 'sunday'], ['måndag', 'monday'], ['tisdag', 'tuesday'], ['onsdag', 'wednesday'], ['torsdag', 'thursday'], ['fredag', 'friday'], ['lördag', 'saturday']];
const MANADER = [['januari', 'january', 'jan'], ['februari', 'february', 'feb'], ['mars', 'march', 'mar'], ['april', 'apr'], ['maj', 'may'], ['juni', 'june', 'jun'],
  ['juli', 'july', 'jul'], ['augusti', 'august', 'aug'], ['september', 'sept', 'sep'], ['oktober', 'october', 'okt', 'oct'], ['november', 'nov'], ['december', 'dec']];
const DELAR_AV_DAGEN = [[/förmiddag|morgon|morning/iu, 7, 11], [/lunch/iu, 11, 13], [/eftermiddag|afternoon/iu, 12, 17], [/kväll|evening/iu, 17, 21]];

export function tidenStar(start, text, nu = new Date()) {
  const t = s(text).toLowerCase();
  const d = new Date(start);
  if (!Number.isFinite(+d)) return false;
  const ord = o => new RegExp(`(?<![\\p{L}])${o}(?![\\p{L}])`, 'iu').test(t);
  const morgon = new Date(nu); morgon.setDate(morgon.getDate() + 1);
  const samma = (a, b) => a.toDateString() === b.toDateString();
  const dagen = VECKODAGAR[d.getDay()].some(o => ord(`${o}(?:en|s)?`))
    || MANADER[d.getMonth()].some(m => new RegExp(`(?<!\\d)${d.getDate()}(?:e|:e|st|nd|rd|th)?\\.?\\s+${m}|${m}\\.?\\s+${d.getDate()}(?!\\d)`, 'iu').test(t))
    || t.includes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    || new RegExp(`(?<![\\d/])${d.getDate()}/${d.getMonth() + 1}(?![\\d])`).test(t)
    || (samma(d, morgon) && (ord('i morgon') || ord('imorgon') || ord('tomorrow')))
    || (samma(d, new Date(nu)) && (ord('i dag') || ord('idag') || ord('today')));
  if (!dagen) return false;
  const slag = [];
  for (const m of t.matchAll(/(?<![\d:.])(\d{1,2})(?:[:.](\d\d))?\s*(am|pm|a\.m\.|p\.m\.)|(?:\bkl\.?\s*(\d{1,2})(?:[:.](\d\d))?)|(?<![\d:.])(\d{1,2})[:.](\d\d)(?![\d])/giu)) {
    let h = Number(m[1] ?? m[4] ?? m[6]); const min = Number(m[2] ?? m[5] ?? m[7] ?? 0);
    if (m[3] && /^p/i.test(m[3]) && h < 12) h += 12;
    if (m[3] && /^a/i.test(m[3]) && h === 12) h = 0;
    if (h <= 23 && min <= 59) slag.push(h * 60 + min);
  }
  const kl = d.getHours() * 60 + d.getMinutes();
  if (slag.length) return slag.includes(kl) || (kl >= 720 && slag.includes(kl - 720));
  return DELAR_AV_DAGEN.some(([re, fran, till]) => re.test(t) && d.getHours() >= fran && d.getHours() <= till);
}

function bokaUr(p, { agent, t0 }) {
  const vem = mening(s(p.vem).replace(/<[^>]*>/g, ''), 100) || null;
  const namn = vem || tx('lib.kollega.boka.avsandaren');
  const etikett = (p.brev?.konto && Konton.kontoEtikett(agent?.epost, p.brev.konto)) || p.etikett || null;
  return { id: randomUUID(), sort: 'boka', titel: mening(tx('lib.kollega.boka.titel', { vem: namn }), 140),
    varfor: mening(tx('lib.kollega.boka.varfor', { vem: namn, amne: mening(p.titel, 100) }), 280), vem, utkast: '',
    underlag: [p.kort], etikett, status: 'forslag', skapad: new Date(t0).toISOString(), start: null, slut: null,
    kalender: Konton.kalenderMedEtikett(agent?.kalender, etikett), brevMote: String(p.brev?.id || '') };
}

export function lasForslag(svar, underlag = [], { minne = null, agent = {}, nu = new Date(), tak = TAK } = {}) {
  const t = s(svar);
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  let d; try { d = JSON.parse(t.slice(a, b + 1)); } catch { return null; }
  const lista = Array.isArray(d?.forslag) ? d.forslag : [];
  const perNr = new Map((underlag || []).map(x => [Number(x.nr), x]));
  const ut = [], nycklar = new Set();
  const t0 = new Date(nu).getTime();
  for (const x of lista.slice(0, 12)) {
    if (!x || typeof x !== 'object' || !SORTER.includes(x.sort)) continue;
    const nr = [...new Set([].concat(x.nr ?? []).map(Number))].filter(n => perNr.has(n));
    const poster = nr.map(n => perNr.get(n)).filter(p => !p.pakallande);
    if (!poster.length) continue;
    const varfor = mening(x.varfor, 280);
    if (!varfor) continue;
    const vem = mening(x.vem, 100) || null;
    const fran = vem && poster.find(p => p.sort === 'mejl' && p.brev?.konto && p.brev?.id && !p.brev.utskick
      && norm(vem).split(/[\s,]+/).some(o => o.length >= 3 && norm(p.vem).includes(o)));
    const sort = x.sort === 'hora_av' && fran ? 'svara' : x.sort;
    const f = { id: randomUUID(), sort, titel: mening(x.titel, 140), varfor, vem, utkast: rent(x.utkast).trim().slice(0, 1500),
      underlag: poster.map(p => p.kort), etikett: poster[0].etikett || null, status: 'forslag', skapad: new Date(t0).toISOString() };
    const mejl = fran || poster.find(p => p.sort === 'mejl' && p.brev?.konto && p.brev?.id && !p.brev.utskick);
    if (sort === 'svara' && mejl?.svarFinns) continue;
    if (sort === 'svara' || (sort === 'folj_upp' && mejl)) {
      if (!mejl || !Konton.harKonto(agent?.epost, mejl.brev.konto)) { if (sort === 'svara') continue; }
      else {
        f.konto = mejl.brev.konto; f.lada = mejl.brev.lada || 'INBOX'; f.brevId = String(mejl.brev.id);
        f.fran = mejl.vem || null;
        f.etikett = Konton.kontoEtikett(agent?.epost, mejl.brev.konto) || mejl.etikett || null;
        f.underlag = [mejl.kort, ...poster.filter(p => p !== mejl).map(p => p.kort)];
        if (!vem) f.vem = mening(s(mejl.vem).replace(/<[^>]*>/g, ''), 100) || null;
      }
    }
    if (sort === 'boka') {
      let start = tidUr(x.start);
      if (start && +start < t0) continue;
      const kalltext = poster.map(p => `${p.titel}\n${p.text}`).join('\n');
      if (start && !tidenStar(start, kalltext, new Date(t0))) start = null;
      if (start) {
        let slut = tidUr(x.slut);
        if (!slut || +slut <= +start || +slut - +start > 12 * 36e5) slut = new Date(+start + 3600e3);
        f.start = lokalIso(start); f.slut = lokalIso(slut);
      } else { f.start = null; f.slut = null; }
      const fragar = poster.find(p => p.sort === 'mejl' && p.brev?.id && !p.brev.utskick && motesfraga(`${p.titel}\n${p.text}`));
      if (fragar) {
        f.brevMote = String(fragar.brev.id);
        f.etikett = (fragar.brev.konto && Konton.kontoEtikett(agent?.epost, fragar.brev.konto)) || f.etikett;
        if (!f.vem) f.vem = mening(s(fragar.vem).replace(/<[^>]*>/g, ''), 100) || null;
      }
      f.kalender = Konton.kalenderMedEtikett(agent?.kalender, f.etikett);
    }
    if (sort === 'hora_av') {
      f.vem = vem || mening(s(poster.find(p => p.vem)?.vem).replace(/<[^>]*>/g, ''), 100) || null;
      const kallorna = norm(poster.map(p => `${p.vem || ''} ${p.titel} ${p.text}`).join(' '));
      if (!f.vem || !norm(f.vem).split(/[\s,]+/).some(o => o.length >= 3 && kallorna.includes(o))) continue;
    }
    if (!f.titel) f.titel = mening(poster[0].titel, 140);
    f.nyckel = nyckel(f);
    f.om = omFor(f);
    if (nycklar.has(f.nyckel) || stoppas(minne, f, { nu })) continue;
    nycklar.add(f.nyckel);
    ut.push(f);
  }
  for (const p of underlag || []) {
    if (p.sort !== 'mejl' || p.pakallande || !p.brev?.id || p.brev.utskick || !motesfraga(`${p.titel}\n${p.text}`)) continue;
    if (ut.some(f => f.sort === 'boka' && f.brevMote === String(p.brev.id))) continue;
    const f = bokaUr(p, { agent, t0 });
    f.nyckel = nyckel(f);
    f.om = omFor(f);
    if (nycklar.has(f.nyckel) || stoppas(minne, f, { nu })) continue;
    nycklar.add(f.nyckel);
    ut.push(f);
  }
  const ordning = [];
  for (const f of ut.filter(f => !(f.sort === 'boka' && f.brevMote && ut.some(g => g.sort === 'svara' && g.brevId === f.brevMote)))) {
    ordning.push(f);
    if (f.sort === 'svara') ordning.push(...ut.filter(g => g.sort === 'boka' && g.brevMote === f.brevId));
  }
  const behall = new Set(ordning.slice(0, tak));
  for (const f of ordning.filter(f => f.sort === 'boka' && f.brevMote && !behall.has(f))) {
    const sista = [...behall].reverse().find(g => !(g.sort === 'boka' && g.brevMote) && !(g.sort === 'svara' && ordning.some(b => b.sort === 'boka' && b.brevMote === g.brevId)));
    if (sista) { behall.delete(sista); behall.add(f); }
  }
  return ordning.filter(f => behall.has(f));
}

export function somTur(forslag) {
  const korten = [], nummer = new Map();
  const nrFor = k => {
    const id = JSON.stringify([k.ref, k.titel, k.fynd]);
    if (!nummer.has(id)) { korten.push(k); nummer.set(id, korten.length); }
    return nummer.get(id);
  };
  const lista = forslag.map(f => ({ ...f, nr: (f.underlag || []).map(nrFor) }));
  return { underlag: korten, forslag: lista };
}

export const visas = ({ underlag, nyckel: _n, ...f }) => f;

const svarRad = (f, nu) => ({ nyckel: f.nyckel || nyckel(f), sort: f.sort, titel: mening(f.titel, 140), vem: f.vem || null, nar: new Date(nu).toISOString() });

export function tag(minne, f, { nu = new Date() } = {}) {
  const m = minneUr(minne);
  m.svar = [...m.svar, { ...svarRad(f, nu), tagen: true }].slice(-300);
  m.forslag = m.forslag.map(x => (x.id === f.id ? { ...x, status: 'tagen', besvarad: new Date(nu).toISOString() } : x));
  return m;
}

export function avboj(minne, f, skal, { nu = new Date() } = {}) {
  const m = minneUr(minne);
  const sk = SKAL.includes(skal) ? skal : 'inte_relevant';
  m.svar = [...m.svar, { ...svarRad(f, nu), tagen: false, skal: sk }].slice(-300);
  if (sk === 'fraga_inte') {
    const om = omFor(f);
    if (om && !m.aldrig.some(a => norm(a.om) === norm(om))) m.aldrig = [...m.aldrig, { om, nar: new Date(nu).toISOString() }];
  }
  m.forslag = m.forslag.map(x => (x.id === f.id ? { ...x, status: 'avbojd', skal: sk, besvarad: new Date(nu).toISOString() } : x));
  return m;
}

const dagarMellan = (a, b) => {
  const x = new Date(a); x.setHours(0, 0, 0, 0);
  const y = new Date(b); y.setHours(0, 0, 0, 0);
  return Math.round((y - x) / dag);
};

export const motePagar = (moten = [], nu = new Date()) => {
  const t0 = new Date(nu).getTime();
  return (moten || []).some(m => m && !m.heldag && Date.parse(m.start) <= t0 && t0 < Date.parse(m.slut || m.start));
};

export function farKnacka({ lage: l = FORVAL, fonster = 0, narvaro = null, vilaSek = 0, samtal = 0, mote = false, minne = null, nu = new Date() } = {}) {
  const m = minneUr(minne);
  const t0 = new Date(nu).getTime();
  if (!l?.knack) return { ja: false, skal: 'av' };
  if (!fonster) return { ja: false, skal: 'fonster' };
  if (!narvaro || narvaro.vila !== false || t0 - Number(narvaro.nar || 0) > NARVARO_MS) return { ja: false, skal: 'vila' };
  if (!(Number(vilaSek) < AKTIV_SEK)) return { ja: false, skal: 'borta' };
  if (samtal > 0) return { ja: false, skal: 'samtal' };
  if (mote) return { ja: false, skal: 'mote' };
  const oppen = m.knack.oppen;
  if (oppen && t0 - Date.parse(oppen.visad || oppen.nar || 0) < (oppen.visad ? 6 * 36e5 : 2 * 60e3)) return { ja: false, skal: 'oppen' };
  if (m.knack.uppskjuten && Date.parse(m.knack.uppskjuten) > t0) return { ja: false, skal: 'uppskjuten' };
  if (m.knack.senast && dagarMellan(m.knack.senast, nu) < Math.max(1, Number(l.dagar) || 1)) return { ja: false, skal: 'idag' };
  return { ja: true, skal: null };
}

export function knackAmnen({ profil = null, du = null, fynd = [], minne = null, nu = new Date() } = {}) {
  const m = minneUr(minne);
  const t0 = new Date(nu).getTime();
  const p = profil || {};
  const ut = [];
  const lagg = (amne, fraga, om = '') => ut.push({ amne, fraga, om });
  const bank = norm([p.vem, p.arbetar, p.vill, p.intressen, p.egen, ...(p.fakta || []).map(f => f?.text || f),
    JSON.stringify(du?.profil || {}), JSON.stringify(du?.roller || [])].join(' '));

  if (!s(p.vill).trim()) lagg('lucka:vill', tx('lib.kollega.knack.luckaVill'));
  const nuvarande = (du?.roller || []).find(r => r && !r.till && (r.titel || r.org));
  if (!s(p.arbetar).trim() && !nuvarande) lagg('lucka:arbetar', tx('lib.kollega.knack.luckaArbetar'));

  const perVem = new Map();
  for (const f of fynd || []) {
    if (!f?.fran || f.pakallande || t0 - Date.parse(f.skapad || f.tid || 0) > 7 * dag) continue;
    if (f.publik || ['fil', 'kalender', 'anteckning', 'paminnelse', 'sida', 'bevakning'].includes(Underlag.referens(f, f.kalla)?.sort)) continue;
    const namn = mening(s(f.fran).replace(/<[^>]*>/g, ''), 80);
    if (!namn) continue;
    const k = norm(namn);
    perVem.set(k, { namn, n: (perVem.get(k)?.n || 0) + 1 });
  }
  for (const [k, v] of [...perVem].sort((a, b) => b[1].n - a[1].n)) {
    if (v.n >= 3 && !bank.includes(k)) lagg(`monster:${k}`, tx('lib.kollega.knack.monster', { vem: v.namn, n: v.n }), v.namn);
  }

  const inlagg = (du?.inlagg || []).filter(x => x?.text && Date.parse(x.datum));
  const nya = inlagg.filter(x => t0 - Date.parse(x.datum) <= 60 * dag);
  if (nya.length) {
    for (const om of s(p.intressen).split(/\s*[,;]\s*/).map(x => x.trim()).filter(x => x.length >= 2)) {
      const traff = namner(om);
      if (inlagg.some(x => t0 - Date.parse(x.datum) > 60 * dag && traff(x.text)) && !nya.some(x => traff(x.text)))
        lagg(`slutat:${norm(om)}`, tx('lib.kollega.knack.slutat', { om }), om);
    }
  }

  if (du?.inlast && t0 - Date.parse(du.inlast) > 120 * dag) lagg('gammal:du', tx('lib.kollega.knack.gammal', { datum: s(du.inlast).slice(0, 10) }));

  const arbete = mening(s(p.arbetar).split(/(?<=[.!?])\s/)[0], 90) || (nuvarande ? tx('lib.kollega.knack.rollen', { titel: nuvarande.titel || '—', org: nuvarande.org || '—' }) : '');
  if (arbete) lagg(`hur:${norm(arbete).slice(0, 60)}`, tx('lib.kollega.knack.hurGar', { om: arbete.replace(/[.!?]+$/, '') }), arbete);

  return ut.filter(x => !m.knack.aldrig.includes(x.amne)
    && !(m.knack.fragat[x.amne] && t0 - Date.parse(m.knack.fragat[x.amne]) < AMNE_DAGAR * dag));
}

export function nyKnack(amnen, { nu = new Date(), fragade = [] } = {}) {
  const a = (amnen || []).find(x => !fragade.includes(x.amne));
  if (!a) return null;
  return { id: randomUUID(), amne: a.amne, fraga: a.fraga, om: a.om || '', nar: new Date(nu).toISOString(), fragade: [...fragade, a.amne] };
}

export const halsning = k => tx('lib.kollega.knack.hej', { fraga: k.fraga });

export function knackVisad(minne, id, { nu = new Date() } = {}) {
  const m = minneUr(minne);
  if (m.knack.oppen?.id !== id) return m;
  m.knack.senast = new Date(nu).toISOString();
  m.knack.oppen = { ...m.knack.oppen, visad: m.knack.senast };
  return m;
}

export function knackSvar(minne, id, svar, { nu = new Date(), uppskjut = 4 * 36e5 } = {}) {
  const m = minneUr(minne);
  const k = m.knack.oppen;
  if (!k || k.id !== id) return m;
  const nar = new Date(nu).toISOString();
  if (svar === 'inte_nu') { m.knack.uppskjuten = new Date(new Date(nu).getTime() + uppskjut).toISOString(); m.knack.oppen = null; }
  else if (svar === 'aldrig') { m.knack.aldrig = [...new Set([...m.knack.aldrig, k.amne])]; m.knack.fragat[k.amne] = nar; m.knack.oppen = null; }
  else if (svar === 'besvarad') m.knack.fragat[k.amne] = nar;
  else if (svar === 'klar') m.knack.oppen = null;
  return m;
}
