// Kollegan: förslag med skäl, och knack-knack (2026-10-10).
//
// Auro 2026-10-10: "Agenten ska bli smartare: utifrån LinkedIn-flödet,
// meddelanden, kalendern och mejlen faktiskt föreslå handlingar, vem man kan
// höra av sig till och varför. Ibland ska den göra en 'knack-knack' till oss
// (när vi sitter vid datorn, inte när skärmsläckaren är på) för att få mer
// återkoppling, typ 'Hej! Hur går allt?', och fortsätta därifrån genom att
// fråga och ta fram mer information så att banken (/du) hålls aktuell."
//
// ── Förslagen ─────────────────────────────────────────────────────────────
//
// Agenten har redan läst och vägt allt: fynden bär sin referens, sitt kort
// och sin etikett (lib/underlag.mjs, lib/konton.mjs). Kollegan läser inte
// källorna en gång till. Den lägger fynden från de senaste dygnen och
// mötena runt i dag i en prompt, och modellen föreslår handlingar: svara,
// boka, höra av sig, följa upp. Varje förslag pekar på sina poster med
// nummer och säger varför.
//
// Modellen väljer VAD. Reglerna här bestämmer resten:
//
//   - Ett förslag utan skäl eller utan underlag finns inte.
//   - Ett svar går från kontot brevet kom till, ur posten — aldrig ur det
//     modellen skrev. Ett "svara" på något som inte är ett mejl faller bort.
//   - Ett möte föreslås i kalendern med samma etikett som underlaget.
//   - En post som försökte styra modellen bär inget förslag.
//   - Det du avböjt eller redan tagit kommer inte tillbaka, och "fråga inte
//     om X" stoppar allt som nämner X.
//
// Inget här skickar något. Ett förslag är ett utkast: svaret öppnas i
// svarsrutan där du trycker Skicka, mötet går till Kalender som frågar, och
// ett "hör av dig till X" är en text att kopiera. Maximus tar aldrig kontakt
// med någon i ditt namn.
//
// ── Knack-knack ───────────────────────────────────────────────────────────
//
// Ibland en fråga: "Hej! Hur går det med X?". Frågorna skrivs av regler ur
// banken — luckor, gamla uppgifter, nya mönster i källorna — inte av
// modellen, och de är sakliga. Svaret tolkas till ändringar i /du och
// visas före och efter (lib/banken.mjs); inget sparas utan ditt ja.
//
// När den får knacka avgörs här, av en funktion som går att prova utan en
// dator: du sitter vid den, appen är inte i vila, inget samtal pågår, inget
// möte pågår, och det har gått minst N dagar. Aldrig till telefonen.
//
// Ren logik: läsningen, modellen och klockan kommer utifrån.

import { randomUUID } from 'node:crypto';
import { byggBilaga, rensaPakallande } from './uppslag.mjs';
import * as Underlag from './underlag.mjs';
import * as Konton from './konton.mjs';
import { tx, modellprompt } from './sprakstod.mjs';

/// Förslagens sorter.
export const SORTER = ['svara', 'boka', 'hora_av', 'folj_upp'];
/// Skälen till ett nej, som knapparna ger dem.
export const SKAL = ['inte_relevant', 'redan_gjort', 'fraga_inte'];
/// Högst så många förslag per varv. Fem är en lista man läser; femton är en kö.
export const TAK = 5;
/// Högst så många poster i underlaget.
export const UNDERLAG_TAK = 24;
/// Fynd från så många dygn tillbaka, och möten så långt bakåt och framåt.
export const DYGN = 2;
/// Ett nytt varv högst så här ofta.
export const FORSLAG_MS = 3 * 36e5;
/// Svaren minns så här länge. Ett nej för två månader sedan styr inte i dag.
export const MINNE_DAGAR = 60;
/// Aktiv vid datorn: orörd högst så här många sekunder.
export const AKTIV_SEK = 120;
/// Appens närvaro gäller så här länge efter senaste livstecknet.
export const NARVARO_MS = 3 * 60e3;
/// Högst så många frågor i en knack-knack. Sedan räcker det.
export const FRAGOR_PER_KNACK = 3;
/// Samma ämne frågas inte igen förrän så här många dagar gått.
export const AMNE_DAGAR = 30;

const s = v => String(v ?? '');
const rent = t => rensaPakallande(s(t)).text;
const mening = (t, n = 180) => rent(t).replace(/\s+/g, ' ').trim().slice(0, n);
const norm = t => s(t).toLowerCase().replace(/<[^>]*>/g, '').replace(/["'«»”“]/g, '').replace(/\s+/g, ' ').trim();
const dag = 864e5;
const tidText = t => { const d = new Date(t); return Number.isFinite(+d) ? `${d.toISOString().slice(0, 10)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : s(t); };
const lokalIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// ── Inställningen ─────────────────────────────────────────────────────────

/// Förslag och knack-knack på, högst en knack om dagen.
export const FORVAL = { forslag: true, knack: true, dagar: 1 };
/// Dagarna att välja mellan för "högst var N:e dag".
export const DAGAR = [1, 2, 3, 7, 14];

/// Inställningen ur det som kom in, fält för fält. Det som inte känns igen
/// behåller det som gällde.
export function installningUr(v, fore = FORVAL) {
  const x = v && typeof v === 'object' ? v : {};
  const f = { ...FORVAL, ...(fore && typeof fore === 'object' ? fore : {}) };
  return {
    forslag: typeof x.forslag === 'boolean' ? x.forslag : f.forslag !== false,
    knack: typeof x.knack === 'boolean' ? x.knack : f.knack !== false,
    dagar: DAGAR.includes(Number(x.dagar)) ? Number(x.dagar) : (DAGAR.includes(Number(f.dagar)) ? Number(f.dagar) : 1),
  };
}

/// Läget ur inställningarna.
export const lage = installningar => installningUr(installningar?.kollega);

// ── Minnet: det du sagt om förslagen och frågorna ─────────────────────────

/// Tomt minne.
export const tomtMinne = () => ({ forslag: [], svar: [], aldrig: [], senastForslag: null,
  knack: { senast: null, uppskjuten: null, aldrig: [], fragat: {}, oppen: null } });

/// Minnet som det lästes från disk, med det som saknas ifyllt.
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

// ── Underlaget ────────────────────────────────────────────────────────────

/// Underlaget för ett varv: fynden från de senaste dygnen och mötena runt
/// i dag, var och en med sitt kort. Ordningen är vikt, sedan tid.
///
/// `fynd` är agentens fynd som de sparas (lib/agent.mjs), `moten` kalenderns
/// händelser ({ id, rubrik, start, slut, plats, deltagare, kalender, etikett,
/// text }), `epost` agentens e-postinställning — för kontots etikett.
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
      // Agenten har redan skrivit ett svarsförslag på brevet (lib/svar.mjs):
      // samma svar en gång till är samma sak två gånger i Agenten (punkt 10).
      svarFinns: Boolean(f.svarsforslag && f.svarsforslag !== 'provat') });
  }
  for (const m of (moten || []).filter(m => m?.start && !m.heldag && Math.abs(Date.parse(m.start) - t0) <= dygn * dag)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).slice(0, 8)) {
    const text = [m.plats ? tx('lib.kollega.mote.plats', { plats: m.plats }) : '',
      m.deltagare?.length ? tx('lib.kollega.mote.kallade', { vem: m.deltagare.join(', ') }) : '', m.text || ''].filter(Boolean).join('\n');
    const pakallande = rensaPakallande(`${m.rubrik || ''}\n${text}`).antal > 0;
    const kort = Underlag.kort({ id: `kalender:${m.id || `${m.rubrik}@${m.start}`}`, titel: m.rubrik || tx('lib.kollega.mote.utanRubrik'),
      kalla: 'kalender', tid: m.start, text, pakallande, ref: { sort: 'kalender', id: s(m.id || `${m.rubrik}@${m.start}`), tid: s(m.start) } });
    const start = Date.parse(m.start), slut = Date.parse(m.slut || m.start);
    ut.push({ kort, sort: 'kalender', etikett: m.etikett || null, vem: null, tid: m.start, titel: m.rubrik || '', text, varfor: '', pakallande,
      mote: { start: m.start, slut: m.slut || null, deltagare: m.deltagare || [], lage: slut < t0 ? 'forbi' : start <= t0 ? 'pagar' : 'kommer' } });
  }
  return ut.map((x, i) => ({ nr: i + 1, ...x }));
}

/// En post i prompten. Främmande text går genom stängslet (rent); en post
/// som försökte styra modellen står med sin sort och utan text.
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

/// Det du sagt om tidigare förslag, som rader i prompten. De senaste först.
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

/// Prompten. Profilen och reglerna först, underlaget sist (KV-cachen, som
/// triagen i lib/agent.mjs).
export function forslagsPrompt({ profil = '', underlag = [], larda = [], nu = new Date(), tak = TAK } = {}) {
  return modellprompt([
    'Du är användarens kollega och föreslår vad hen kan göra. Du svarar bara med JSON.',
    profil ? rent(profil) : '',
    `Nu är det ${tidText(nu)}.`,
    `Läs underlaget och föreslå högst ${tak} konkreta saker användaren själv kan göra i dag eller de närmaste dagarna: svara på ett mejl, boka in något, höra av sig till en person, följa upp ett möte.`,
    'Varje förslag bygger på underlaget. Skriv i "nr" numren på de poster som pekar dit, och i "varfor" en mening om vad i underlaget som pekar dit: vem som skrev vad, vilket möte, vilket inlägg. Konkret, inget beröm, inga gissningar.',
    'Hellre inga förslag än svaga. Inget för reklam, nyhetsbrev eller automatiska notiser.',
    'Sorterna: "svara" (bara på ett mejl i underlaget), "boka" (något att lägga in i kalendern; skriv "start" och "slut" som ÅÅÅÅ-MM-DDTHH:MM bara när dagen och tiden står i underlaget, annars tomma), "hora_av" (höra av sig till en person; skriv vem i "vem"), "folj_upp" (följa upp ett möte eller en tråd).',
    // Prov med riktiga Gemma (punkt 10, 2026-10-10): Anna bad om ett möte och
    // fick bara ett svar, med en tid ingen sagt.
    'Ber ett mejl uttryckligen om ett möte eller en tid ("kan vi ses", "har du tid", "can we meet"): föreslå både "svara" och "boka" för det mejlet, med samma nr. Hitta aldrig på en tid: står ingen dag och tid i mejlet lämnar du start och slut tomma, och användaren väljer.',
    'Skriv för svara, hora_av och folj_upp ett kort utkast i "utkast" på svenska, i användarens röst (jag-form). Användaren läser, ändrar och skickar själv. Du skickar aldrig något och tar aldrig kontakt med någon.',
    ...(larda.length ? ['Det här har användaren sagt om tidigare förslag. Följ det:', ...larda.map(r => `- ${rent(r)}`)] : []),
    'Svara med exakt detta och inget annat:',
    '{"forslag":[{"sort":"hora_av","nr":[2],"vem":"...","titel":"...","varfor":"...","utkast":"...","start":"","slut":""}]}',
    '',
    byggBilaga('underlag att föreslå ur', (underlag || []).map(postRad).join('\n\n')),
  ].filter(x => x !== '').join('\n'), { markorer: ['"forslag"', '"svara"', '"boka"', '"hora_av"', '"folj_upp"'] });
}

// ── Svaret, läst strängt ──────────────────────────────────────────────────

/// Förslagets nyckel: det som gör två förslag till samma förslag. Hör av dig
/// till en person är samma förslag vad underlaget än är; resten gäller sin post.
export function nyckel(f) {
  if (f.sort === 'hora_av' && f.vem) return `hora_av:${norm(f.vem).replace(/@.*$/, '')}`;
  const r = f.underlag?.[0]?.ref;
  const id = r ? `${r.sort}:${r.konto ? `${r.konto}/` : ''}${r.id || r.url || r.sokvag || ''}` : norm(f.underlag?.[0]?.titel);
  return `${f.sort}:${id}`;
}

/// Nämner texten X? Från ordets början, utan skiftläge — samma regel som
/// "glöm allt om Z" i lib/banken.mjs.
const namner = om => {
  const z = s(om).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!z) return () => false;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${z}`, 'iu');
  return t => re.test(s(t));
};

/// Vad "fråga inte om det här" gäller: personen, annars posten.
export const omFor = f => mening(f.vem || f.underlag?.[0]?.fran || f.underlag?.[0]?.titel || f.titel, 80);

/// Stoppas förslaget av något du sagt? Skälet som kod, annars null.
export function stoppas(minne, f, { nu = new Date() } = {}) {
  const m = minneUr(minne);
  const t0 = new Date(nu).getTime();
  const k = f.nyckel || nyckel(f);
  if (m.svar.some(x => x.nyckel === k && t0 - Date.parse(x.nar || 0) <= MINNE_DAGAR * dag)) return 'besvarat';
  // Ett förslag som står obesvarat föreslås inte en gång till — i en vecka.
  if (m.forslag.some(x => x.nyckel === k && x.status === 'forslag' && t0 - Date.parse(x.skapad || 0) < 7 * dag)) return 'oppet';
  const texter = [f.vem, f.titel, ...(f.underlag || []).flatMap(u => [u.titel, u.fran])];
  for (const a of m.aldrig) if (texter.some(namner(a.om))) return 'aldrig';
  return null;
}

/// Tiden ur modellens svar: lokal tid som ÅÅÅÅ-MM-DDTHH:MM, eller null.
const tidUr = v => {
  const m = /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)/.exec(s(v).trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isFinite(+d) ? d : null;
};

// ── Boka: ett mejl som ber om ett möte ────────────────────────────────────
//
// Prov med riktiga Gemma (punkt 10, 2026-10-10): Anna bad om ett möte ("kan
// vi ses nästa vecka?") och kollegan föreslog aldrig "boka" — svarsutkastet
// föreslog en tid i stället. Ett mejl som uttryckligen ber om ett möte eller
// en tid får nu ett eget förslag "Boka in" bredvid "Svara", av modellen eller
// av regeln här. Tiden kommer ur mejlet eller från dig, aldrig ur luften.

/// Ber texten uttryckligen om ett möte eller en tid? Svenska och engelska.
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

/// Står tiden i texten? Dagen (veckodagen, datumet, "i morgon") och tiden
/// (klockslaget, eller förmiddag/eftermiddag) måste båda gå att läsa där.
/// "Nästa vecka" räcker inte: då väljer du.
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
  // Klockslagen i texten: "kl 10", "10:30", "10.30", "10 am", "3pm".
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

/// Ett boka-förslag ur regeln: posten är ett mejl som ber om ett möte.
function bokaUr(p, { agent, t0 }) {
  const vem = mening(s(p.vem).replace(/<[^>]*>/g, ''), 100) || null;
  const namn = vem || tx('lib.kollega.boka.avsandaren');
  const etikett = (p.brev?.konto && Konton.kontoEtikett(agent?.epost, p.brev.konto)) || p.etikett || null;
  return { id: randomUUID(), sort: 'boka', titel: mening(tx('lib.kollega.boka.titel', { vem: namn }), 140),
    varfor: mening(tx('lib.kollega.boka.varfor', { vem: namn, amne: mening(p.titel, 100) }), 280), vem, utkast: '',
    underlag: [p.kort], etikett, status: 'forslag', skapad: new Date(t0).toISOString(), start: null, slut: null,
    kalender: Konton.kalenderMedEtikett(agent?.kalender, etikett), brevMote: String(p.brev?.id || '') };
}

/// Modellens svar som förslag. Det som inte håller faller bort:
///
/// - okänd sort, inget skäl, inga giltiga nummer;
/// - bara poster som försökte styra modellen;
/// - "svara" utan ett mejl bland posterna, eller från ett konto agenten
///   inte fått läsa — kontot tas ur posten, aldrig ur svaret;
/// - "boka" med en tid som redan varit. En tid som inte står i underlaget
///   (`tidenStar`) är modellens gissning: förslaget står kvar utan tid, och
///   du väljer den;
/// - "hora_av" utan en person;
/// - det du sagt nej till, redan tagit eller bett den inte fråga om.
///
/// `agent` är agentens inställningar (epost, kalender) för konton och
/// kalendrar med etikett.
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
    // "Hör av dig till Jonas" om ett brev från Jonas är ett svar på brevet,
    // från kontot det kom till — inte en text att kopiera (punkt 10, prov
    // med riktiga Gemma 2026-10-10: överprövningen blev ett "hör av dig").
    const fran = vem && poster.find(p => p.sort === 'mejl' && p.brev?.konto && p.brev?.id && !p.brev.utskick
      && norm(vem).split(/[\s,]+/).some(o => o.length >= 3 && norm(p.vem).includes(o)));
    const sort = x.sort === 'hora_av' && fran ? 'svara' : x.sort;
    const f = { id: randomUUID(), sort, titel: mening(x.titel, 140), varfor, vem, utkast: rent(x.utkast).trim().slice(0, 1500),
      underlag: poster.map(p => p.kort), etikett: poster[0].etikett || null, status: 'forslag', skapad: new Date(t0).toISOString() };
    // Ett mejl bland posterna: svaret går från kontot det kom till.
    const mejl = fran || poster.find(p => p.sort === 'mejl' && p.brev?.konto && p.brev?.id && !p.brev.utskick);
    // Ett svar agenten redan föreslagit står redan i Agenten.
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
      // Mejlet som bad om mötet: förslaget står bredvid svaret på det.
      const fragar = poster.find(p => p.sort === 'mejl' && p.brev?.id && !p.brev.utskick && motesfraga(`${p.titel}\n${p.text}`));
      if (fragar) {
        f.brevMote = String(fragar.brev.id);
        f.etikett = (fragar.brev.konto && Konton.kontoEtikett(agent?.epost, fragar.brev.konto)) || f.etikett;
        if (!f.vem) f.vem = mening(s(fragar.vem).replace(/<[^>]*>/g, ''), 100) || null;
      }
      // Kalendern med samma etikett som underlaget (lib/konton.mjs). Ingen
      // med den etiketten: du väljer i Kalender.
      f.kalender = Konton.kalenderMedEtikett(agent?.kalender, f.etikett);
    }
    if (sort === 'hora_av') {
      f.vem = vem || mening(s(poster.find(p => p.vem)?.vem).replace(/<[^>]*>/g, ''), 100) || null;
      // Personen står i underlaget. En modell som hittar på en kontakt
      // föreslår att du hör av dig till någon som inte finns.
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
  // Regeln: ett mejl som ber om ett möte får ett "boka", också när modellen
  // bara föreslog ett svar.
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
  // Boka står direkt efter svaret på samma mejl ("Svara Anna", "Boka in med
  // Anna"), och ett mejl som bad om ett möte står inte utanför taket.
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

/// Förslagen som en tur: korten en gång var, numrerade, och varje förslag
/// med numren på sina kort. Samma kort som i resten av appen — "Visa hela"
/// och assistentens följdfrågor läser dem som de läser fyndens.
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

/// Förslaget som det visas: utan korten (de står på turen) och utan nyckeln.
export const visas = ({ underlag, nyckel: _n, ...f }) => f;

// ── Svaren ────────────────────────────────────────────────────────────────

const svarRad = (f, nu) => ({ nyckel: f.nyckel || nyckel(f), sort: f.sort, titel: mening(f.titel, 140), vem: f.vem || null, nar: new Date(nu).toISOString() });

/// Du tog förslaget. Det kommer inte tillbaka, och nästa varv vet det.
export function tag(minne, f, { nu = new Date() } = {}) {
  const m = minneUr(minne);
  m.svar = [...m.svar, { ...svarRad(f, nu), tagen: true }].slice(-300);
  m.forslag = m.forslag.map(x => (x.id === f.id ? { ...x, status: 'tagen', besvarad: new Date(nu).toISOString() } : x));
  return m;
}

/// Du avböjde, med ett skäl. "Fråga inte om X" gäller allt som nämner X.
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

// ── Knack-knack ───────────────────────────────────────────────────────────

/// Kalenderdagar mellan två tider, i lokal tid.
const dagarMellan = (a, b) => {
  const x = new Date(a); x.setHours(0, 0, 0, 0);
  const y = new Date(b); y.setHours(0, 0, 0, 0);
  return Math.round((y - x) / dag);
};

/// Pågår ett möte nu? Heldagar räknas inte — en födelsedag är inget möte.
export const motePagar = (moten = [], nu = new Date()) => {
  const t0 = new Date(nu).getTime();
  return (moten || []).some(m => m && !m.heldag && Date.parse(m.start) <= t0 && t0 < Date.parse(m.slut || m.start));
};

/// Får agenten knacka nu? { ja, skal } — skälet som kod när svaret är nej:
///
///   av          knack-knack är avstängt
///   fonster     inget fönster öppet: ingen sitter vid Maximus
///   vila        appen står i vila (skärmsläckaren), eller har inte hörts av
///   borta       datorn har stått orörd (HIDIdleTime)
///   samtal      ett samtal pågår (ett svar skrivs, en diktering, ett möte spelas in)
///   mote        ett möte pågår i kalendern
///   uppskjuten  du sa "inte nu"
///   idag        det har knackat inom de senaste N dagarna
///   oppen       en knack väntar redan på svar
///
/// Ordningen spelar ingen roll för svaret, bara för vilket skäl som sägs.
export function farKnacka({ lage: l = FORVAL, fonster = 0, narvaro = null, vilaSek = 0, samtal = 0, mote = false, minne = null, nu = new Date() } = {}) {
  const m = minneUr(minne);
  const t0 = new Date(nu).getTime();
  if (!l?.knack) return { ja: false, skal: 'av' };
  if (!fonster) return { ja: false, skal: 'fonster' };
  if (!narvaro || narvaro.vila !== false || t0 - Number(narvaro.nar || 0) > NARVARO_MS) return { ja: false, skal: 'vila' };
  if (!(Number(vilaSek) < AKTIV_SEK)) return { ja: false, skal: 'borta' };
  if (samtal > 0) return { ja: false, skal: 'samtal' };
  if (mote) return { ja: false, skal: 'mote' };
  // En knack som väntar: visad gäller den i sex timmar; sågs den aldrig
  // (fönstret stod i vila när den kom) är den borta efter två minuter.
  const oppen = m.knack.oppen;
  if (oppen && t0 - Date.parse(oppen.visad || oppen.nar || 0) < (oppen.visad ? 6 * 36e5 : 2 * 60e3)) return { ja: false, skal: 'oppen' };
  if (m.knack.uppskjuten && Date.parse(m.knack.uppskjuten) > t0) return { ja: false, skal: 'uppskjuten' };
  if (m.knack.senast && dagarMellan(m.knack.senast, nu) < Math.max(1, Number(l.dagar) || 1)) return { ja: false, skal: 'idag' };
  return { ja: true, skal: null };
}

/// Frågorna ur banken, i den ordning de är värda att ställa. Regler, inte
/// modellen: varje fråga säger vad den bygger på, och ingen är gullig.
///
/// - luckor: målet eller arbetet saknas;
/// - nya mönster: flera fynd från samma avsändare den senaste veckan, och
///   banken säger inget om hen;
/// - "du har slutat skriva om Y": ett intresse som stod i dina inlägg men
///   inte de senaste två månaderna;
/// - gamla uppgifter: LinkedIn eller cv:t lästes in för länge sedan;
/// - hur det går: det du arbetar med just nu.
///
/// Ämnen du sagt "fråga aldrig" om, och ämnen som frågats den senaste
/// månaden, är borta.
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

  // Nya mönster: samma avsändare i minst tre fynd den senaste veckan.
  const perVem = new Map();
  for (const f of fynd || []) {
    if (!f?.fran || f.pakallande || t0 - Date.parse(f.skapad || f.tid || 0) > 7 * dag) continue;
    // Bara det en person skrivit. En mapp har mappens namn som avsändare,
    // och "Dokumenten har dykt upp tre gånger" var ingen fråga
    // (skärmbilderna, punkt 10); inte heller en kalender eller en webbsida.
    if (f.publik || ['fil', 'kalender', 'anteckning', 'paminnelse', 'sida', 'bevakning'].includes(Underlag.referens(f, f.kalla)?.sort)) continue;
    const namn = mening(s(f.fran).replace(/<[^>]*>/g, ''), 80);
    if (!namn) continue;
    const k = norm(namn);
    perVem.set(k, { namn, n: (perVem.get(k)?.n || 0) + 1 });
  }
  for (const [k, v] of [...perVem].sort((a, b) => b[1].n - a[1].n)) {
    if (v.n >= 3 && !bank.includes(k)) lagg(`monster:${k}`, tx('lib.kollega.knack.monster', { vem: v.namn, n: v.n }), v.namn);
  }

  // Slutat skriva om: ett intresse i äldre inlägg, inget i de senaste 60 dagarna.
  const inlagg = (du?.inlagg || []).filter(x => x?.text && Date.parse(x.datum));
  const nya = inlagg.filter(x => t0 - Date.parse(x.datum) <= 60 * dag);
  if (nya.length) {
    for (const om of s(p.intressen).split(/\s*[,;]\s*/).map(x => x.trim()).filter(x => x.length >= 2)) {
      const traff = namner(om);
      if (inlagg.some(x => t0 - Date.parse(x.datum) > 60 * dag && traff(x.text)) && !nya.some(x => traff(x.text)))
        lagg(`slutat:${norm(om)}`, tx('lib.kollega.knack.slutat', { om }), om);
    }
  }

  // Gamla uppgifter: inläst för mer än fyra månader sedan.
  if (du?.inlast && t0 - Date.parse(du.inlast) > 120 * dag) lagg('gammal:du', tx('lib.kollega.knack.gammal', { datum: s(du.inlast).slice(0, 10) }));

  // Hur det går: det du arbetar med, med dina ord.
  const arbete = mening(s(p.arbetar).split(/(?<=[.!?])\s/)[0], 90) || (nuvarande ? tx('lib.kollega.knack.rollen', { titel: nuvarande.titel || '—', org: nuvarande.org || '—' }) : '');
  if (arbete) lagg(`hur:${norm(arbete).slice(0, 60)}`, tx('lib.kollega.knack.hurGar', { om: arbete.replace(/[.!?]+$/, '') }), arbete);

  return ut.filter(x => !m.knack.aldrig.includes(x.amne)
    && !(m.knack.fragat[x.amne] && t0 - Date.parse(m.knack.fragat[x.amne]) < AMNE_DAGAR * dag));
}

/// En knack: den första frågan som inte redan ställts i den här.
export function nyKnack(amnen, { nu = new Date(), fragade = [] } = {}) {
  const a = (amnen || []).find(x => !fragade.includes(x.amne));
  if (!a) return null;
  return { id: randomUUID(), amne: a.amne, fraga: a.fraga, om: a.om || '', nar: new Date(nu).toISOString(), fragade: [...fragade, a.amne] };
}

/// Hälsningen: "Hej! Hur går det med X?". Bara på den första frågan.
export const halsning = k => tx('lib.kollega.knack.hej', { fraga: k.fraga });

/// Knacken visades: räknas mot "högst var N:e dag" först nu, när du sett den.
export function knackVisad(minne, id, { nu = new Date() } = {}) {
  const m = minneUr(minne);
  if (m.knack.oppen?.id !== id) return m;
  m.knack.senast = new Date(nu).toISOString();
  m.knack.oppen = { ...m.knack.oppen, visad: m.knack.senast };
  return m;
}

/// Ditt svar på knacken: 'inte_nu' skjuter upp (ämnet frågas igen en annan
/// gång), 'aldrig' stänger ämnet för gott, 'besvarad' räknar det som frågat.
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
