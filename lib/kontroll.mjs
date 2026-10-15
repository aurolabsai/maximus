
import { tx } from './sprakstod.mjs';

export const LAGEN = ['av', 'forval', 'strikt'];
export const lage = inst => (LAGEN.includes(inst?.kontroll) ? inst.kontroll : 'forval');

const SMAORD = new Set(`och eller men att som är var vara det den de en ett jag du vi ni
har hade kan ska skall kunde skulle vill bör borde måste får fick finns fanns gör gjorde
detta dessa denna vilket vilken vilka man sig sin sitt själv samt även dock alltså mig min mitt mina
för till från med på av om under över mellan utan efter före vid per där här när vem vad hur
inte icke ingen inget inga mycket mer mest flera andra samma sådan sådant varje
också då så nu sedan först därefter sist slutligen avsluta börja
that this these those with from into have has had been were was being which what who whom whose
when where while there their they them then than also only very more most such my me your
some other upon about would could should shall will must does done first finally next lastly
whether after before finish start begin end`.split(/\s+/).filter(Boolean));

const VERB = new Set(`gör lista nämn säg ange skriv avsluta börja föreslå sammanfatta förklara
berätta ta upp kolla läs svara ge beskriv redogör jämför visa räkna tala presentera
list mention say state write finish end start begin suggest propose summarise summarize explain
tell check read reply give describe compare show count include present answer note
protokollet protokoll mejlet brevet texten dokumentet underlaget filen enligt kort kortfattat
minutes email letter document text material file according short brief
mejl mail e-post utkast draft svar reply message meddelande`.split(/\s+/));

const stam = o => o.toLowerCase().normalize('NFC').slice(0, 5);
const ordUr = t => String(t || '').toLowerCase().normalize('NFC').split(/[^\p{L}\d]+/u).filter(Boolean);
const innehall = t => [...new Set(ordUr(t).filter(o => o.length > 3 && !SMAORD.has(o) && !VERB.has(o)).map(stam))];
const stammar = t => new Set(ordUr(t).filter(o => o.length > 2).map(stam));

const SV_ORD = /(?<![\p{L}])(och|att|det|jag|vi|är|inte|för|med|på|hej|tack|gärna|som|har|ett|av|till|om|kan|ska|du|den|vill)(?![\p{L}])/giu;
const EN_ORD = /(?<![\p{L}])(and|the|to|is|not|for|with|on|hi|thanks|would|will|you|that|of|in|be|can|have|are|it|this)(?![\p{L}])/giu;
export function sprakAv(text) {
  const t = String(text || '');
  const s = (t.match(SV_ORD) || []).length, e = (t.match(EN_ORD) || []).length;
  if (s + e < 4) return null;
  return s > e * 1.3 ? 'sv' : e > s * 1.3 ? 'en' : null;
}

const TALORD = { en: 1, ett: 1, one: 1, två: 2, two: 2, tre: 3, three: 3, fyra: 4, four: 4, fem: 5, five: 5, sex: 6, six: 6,
  sju: 7, seven: 7, åtta: 8, eight: 8, nio: 9, nine: 9, tio: 10, ten: 10 };
const talAv = t => (/^\d+$/.test(t) ? Number(t) : TALORD[String(t).toLowerCase()] || null);
const TALMONSTER = `(\\d+|${Object.keys(TALORD).join('|')})`;

const SPRAKBEGARAN = /(?<![\p{L}])(på|till|in|into)\s+(svenska|engelska|swedish|english)(?![\p{L}])/giu;
const ANTAL = new RegExp(`(?<![\\p{L}])(?:i|in|med|with|som|as|använd|use)\\s+(?:exakt\\s+|precis\\s+|exactly\\s+|just\\s+|only\\s+|bara\\s+)?${TALMONSTER}\\s+(punkter|punkt|bullet\\s*points?|bullets?|points?|meningar|mening|sentences?)(?![\\p{L}])`, 'iu');
const MAXORD = new RegExp(`(?<![\\p{L}])(?:högst|max(?:imalt)?|at\\s+most|no\\s+more\\s+than|under|within|less\\s+than|kortare\\s+än|inom)\\s+${TALMONSTER}\\s+(ord|words)(?![\\p{L}])`, 'iu');
const SLUT = '(?=[,.;:!?]|\\s+(?:och|men|utan|samt|and|but|or|eller)\\s|$)';
const FORBUD = [
  new RegExp(`(?<![\\p{L}])(?:nämn|skriv|ta\\s+upp|ta\\s+med|ange|använd|skriv\\s+om)\\s+inte\\s+(.+?)${SLUT}`, 'giu'),
  new RegExp(`(?<![\\p{L}])(?:inte|aldrig)\\s+(?:nämna|ta\\s+upp|skriva\\s+om|ta\\s+med)\\s+(.+?)${SLUT}`, 'giu'),
  new RegExp(`(?<![\\p{L}])utan\\s+att\\s+(?:nämna|ta\\s+upp|skriva\\s+om)\\s+(.+?)${SLUT}`, 'giu'),
  new RegExp(`(?<![\\p{L}])men\\s+inte\\s+(.+?)${SLUT}`, 'giu'),
  new RegExp(`(?<![\\p{L}])(?:do\\s+not|don't|never|avoid)\\s+(?:mention(?:ing)?|include|including|bring\\s+up|write\\s+about|refer\\s+to)\\s+(.+?)${SLUT}`, 'giu'),
  new RegExp(`(?<![\\p{L}])without\\s+mentioning\\s+(.+?)${SLUT}`, 'giu'),
  new RegExp(`(?<![\\p{L}])but\\s+not\\s+(.+?)${SLUT}`, 'giu'),
];
const ORDNINGSORD = /(?<![\p{L}])(först|sedan|därefter|efter\s+det|därpå|till\s+sist|sist|slutligen|avsluta\s+med|börja\s+med|first|then|after\s+that|afterwards|next|finally|lastly|end\s+with|finish\s+with|start\s+with|begin\s+with)(?![\p{L}])/iu;
const LASVERB = /^(?:\s*(?:och|and))?\s*(?:kolla|läs|titta\s+i|gå\s+igenom|check|read|look\s+at|go\s+through)(?![\p{L}])/iu;
const KALLOR = [
  ['kalender', /kalender|calendar|schema\b|schedule/iu, ['kalender', 'lediga_tider']],
  ['mejl', /mejl|mail|inkorg|brev|inbox|email/iu, ['mejl']],
  ['paminnelser', /påminnelse|reminder/iu, ['paminnelser']],
  ['anteckningar', /anteckning|note/iu, ['anteckningar']],
  ['meddelanden', /meddelande|sms|message/iu, ['meddelanden']],
  ['mapp', /mapp|fil(?:en|er)?\b|folder|file/iu, ['mapp', 'las_fil']],
  ['webb', /webb|nätet|web|internet/iu, ['webbsok', 'las_sida']],
];
const ARFORM = t => ANTAL.test(t) || MAXORD.test(t) || FORBUD.some(re => new RegExp(re.source, 'iu').test(t))
  || (new RegExp(SPRAKBEGARAN.source, 'iu').test(t) && t.split(/\s+/).length <= 5);

export function krav(instruktion, { sprak = null } = {}) {
  const text = String(instruktion || '').replace(/^(>[^\n]*\n?)+/, '').trim();
  const ut = { steg: [], inte: [], ordning: false, sprak: null, punkter: null, meningar: null, maxOrd: null };
  if (!text) return ut;
  let sist = null;
  for (const m of text.matchAll(SPRAKBEGARAN)) sist = /svenska|swedish/i.test(m[2]) ? 'sv' : 'en';
  ut.sprak = sist || sprakAv(text) || sprak;
  const a = ANTAL.exec(text);
  if (a) { const n = talAv(a[1]); if (n && n <= 20) ut[/mening|sentence/i.test(a[2]) ? 'meningar' : 'punkter'] = n; }
  const mo = MAXORD.exec(text);
  if (mo) ut.maxOrd = talAv(mo[1]);
  for (const re of FORBUD) for (const m of text.matchAll(re)) {
    const fras = m[1].replace(/^(?:om\s+|the\s+|den\s+|det\s+|de\s+|någon\s+|any\s+)/i, '').trim();
    const st = innehall(fras).slice(0, 3);
    if (st.length && !ut.inte.some(x => x.fras === fras)) ut.inte.push({ fras, stammar: st });
  }
  ut.ordning = ORDNINGSORD.test(text);
  let kropp = text;
  const kolon = kropp.indexOf(':');
  if (kolon > 0 && kolon < kropp.length / 2 && ORDNINGSORD.test(kropp.slice(kolon))) kropp = kropp.slice(kolon + 1);
  const bitar = kropp.split(/\n+|(?<=[.;!?])\s+|,\s*(?:och\s+|and\s+)?|\s+(?:och|and)\s+(?=(?:sedan|därefter|avsluta|then|finally|finish|end|säg|nämn|mention|say|läs|kolla|read|check)(?![\p{L}]))/iu)
    .map(b => b.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim()).filter(b => b.length > 2);
  const kandidater = [];
  for (const b of bitar) {
    if (ARFORM(b)) {
      const fore = b.split(/\s+(?:men|but)\s+(?:inte|not)\s+/iu)[0];
      if (fore !== b && /(?<![\p{L}])(nämn|ta\s+med|mention|include)(?![\p{L}])/iu.test(fore)) kandidater.push(fore);
      continue;
    }
    kandidater.push(b);
  }
  const nämn = /(?<![\p{L}])(nämn|ta\s+med|ange|säg|mention|include|state|say)(?![\p{L}])/iu;
  if (kandidater.length >= 2 || kandidater.some(k => nämn.test(k))) {
    for (const b of kandidater) {
      const las = LASVERB.test(b) ? KALLOR.find(([, re]) => re.test(b)) : null;
      if (las) { ut.steg.push({ nr: ut.steg.length + 1, text: b, las: las[0], verktyg: las[2] }); continue; }
      const st = innehall(b.replace(ORDNINGSORD, ' '));
      if (kandidater.length < 2 && !nämn.test(b)) continue;
      ut.steg.push({ nr: ut.steg.length + 1, text: b, stammar: st });
    }
  }
  if (ut.steg.length < 2) ut.ordning = false;
  const skrivet = sprakAv(text);
  ut.tvarsprak = Boolean(sist && skrivet && sist !== skrivet);
  return ut;
}

function stegetI(steg, svar, svarsstammar) {
  if (!steg.stammar?.length) return null;
  const traff = steg.stammar.filter(s => svarsstammar.has(s));
  if (traff.length < Math.max(1, Math.ceil(steg.stammar.length / 2))) return -1;
  const lagt = String(svar).toLowerCase();
  return Math.min(...traff.map(s => { const i = lagt.search(new RegExp(`(?<![\\p{L}])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u')); return i < 0 ? Infinity : i; }));
}

const VECKODAGAR = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const DAGRE = new RegExp(`(?<![\\p{L}])(${[...VECKODAGAR, ...WEEKDAYS].join('|')})(?:en)?(?![\\p{L}])`, 'giu');
const MANADRE = new RegExp(`(?<![\\p{L}])(${[...new Set([...MANADER, ...MONTHS])].join('|')})(?![\\p{L}])`, 'giu');
const VANLIGA = new Set(['sek', 'kr', 'eur', 'usd', 'jag', 'du', 'vi', 'hej', 'hi', 'hello', 'dear', 'best', 'regards', 'mvh', 'tack', 'thanks', 'kind', 'maximus',
  'med', 'vänliga', 'hälsningar', 'ok', 'the', 'this', 'that', 'subject', 'ämne', 'note', 'obs', 'please', 'sincerely', 'cheers']);

const siffror = t => String(t).replace(/\D/g, '');
const TALRE = /\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d+)?|\d+(?:[.,:]\d+)*(?:[-–/]\d+(?:[.,:]\d+)*)*/g;
const lower = t => String(t || '').toLowerCase().normalize('NFC');

function datumMedVeckodag(svar, nu = new Date()) {
  const ok = [], fel = [];
  const dagar = [...VECKODAGAR, ...WEEKDAYS].join('|');
  const man = [...new Set([...MANADER, ...MONTHS])].join('|');
  const re = new RegExp(`(?<![\\p{L}])(${dagar})(?:en)?,?\\s+(?:(?:den|the)\\s+)?(?:(\\d{1,2})(?::e|st|nd|rd|th)?\\s+(?:of\\s+)?(${man})|(${man})\\s+(\\d{1,2})(?:st|nd|rd|th)?)(?:,?\\s+(\\d{4}))?`, 'giu');
  for (const m of String(svar).matchAll(re)) {
    const vd = lower(m[1]);
    const veckodag = VECKODAGAR.includes(vd) ? VECKODAGAR.indexOf(vd) : WEEKDAYS.indexOf(vd);
    const d = Number(m[2] || m[5]);
    const mn = lower(m[3] || m[4]);
    const manad = MANADER.includes(mn) ? MANADER.indexOf(mn) : MONTHS.indexOf(mn);
    const iAr = new Date(nu.getFullYear(), manad, d);
    const ar = m[6] ? [Number(m[6])] : [+iAr >= +nu - 7 * 864e5 ? nu.getFullYear() : nu.getFullYear() + 1];
    if (ar.some(y => new Date(y, manad, d).getDay() === veckodag)) ok.push({ text: m[0], dag: String(d), ar: m[6] || null });
    else fel.push(m[0]);
  }
  return { ok, fel };
}

const tal = t => Number(String(t).replace(/[\s ]/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, ''));
function utrakningar(svar) {
  const ut = [];
  for (const m of String(svar).matchAll(/(\d[\d\s.,]*)\s*([+\-*/×x÷−])\s*(\d[\d\s.,]*)\s*=\s*(?:ca\.?\s*|≈\s*)?(\d[\d\s.,]*\d|\d)/g)) {
    const [a, op, b, r] = [tal(m[1]), m[2], tal(m[3]), tal(m[4])];
    const v = { '+': a + b, '-': a - b, '−': a - b, '*': a * b, '×': a * b, x: a * b, '/': a / b, '÷': a / b }[op];
    if (Number.isFinite(v) && Math.abs(v - r) <= Math.max(1, Math.abs(v) * 0.01)) ut.push({ fran: [m[1].trim(), m[3].trim()], resultat: m[4].trim() });
  }
  return ut;
}

export function utanStod(svar, kalla, { nu = new Date() } = {}) {
  const t = String(svar || '');
  const k = lower(kalla);
  const skalade = [...String(kalla).matchAll(/(\d+(?:[.,]\d+)?)\s*(miljoner|miljon|million|millions|mkr|msek|mn|tusen|thousand)(?![\p{L}])/giu)]
    .map(m => String(Math.round(Number(m[1].replace(',', '.')) * (/^(tusen|thousand)/i.test(m[2]) ? 1e3 : 1e6))));
  const kTal = new Set(skalade);
  for (const m of String(kalla).matchAll(TALRE)) {
    kTal.add(siffror(m[0]));
    for (const d of m[0].split(/[^\d]+/)) if (d) kTal.add(d);
  }
  const kSiffror = { includes: x => kTal.has(x) || (x.length >= 4 && [...kTal].some(y => y.length > x.length && y.includes(x))) };
  const datum = datumMedVeckodag(t, nu);
  const harlett = new Set(datum.ok.flatMap(d => [d.dag, ...(d.ar ? [d.ar] : [])]));
  for (const u of utrakningar(t)) if (u.fran.every(x => kSiffror.includes(siffror(x)) || (/^\d{1,3}$/.test(x) && Number(x) <= 100))) { harlett.add(siffror(u.resultat)); for (const x of u.fran) harlett.add(siffror(x)); }
  const talen = [];
  for (const m of t.matchAll(TALRE)) {
    const raw = m[0].trim();
    const d = siffror(raw);
    if (d.length < 2) continue;
    const fore = t.slice(Math.max(0, m.index - 1), m.index);
    if (/[\p{L}]/u.test(fore)) continue;
    if (/^\d{1,2}$/.test(raw) && /^\s*[.)]/.test(t.slice(m.index + raw.length)) && /(^|\n)\s*$/.test(t.slice(0, m.index))) continue;
    if (harlett.has(d)) continue;
    const delar = raw.split(/[\s–\-/:]+/).map(siffror).filter(x => x.length >= 2);
    const finns = x => kSiffror.includes(x) || harlett.has(x) || (x.length === 4 && /00$/.test(x) && kTal.has(x.slice(0, 2)))
      || (/^0\d$/.test(x) && kTal.has(x.slice(1))) || kTal.has(`${x}00`) || kTal.has(`0${x}`);
    if (finns(d) || (delar.length > 1 && delar.every(finns))) continue;
    talen.push(raw);
  }
  const namn = [];
  for (const mening of t.split(/(?<=[.!?:;])\s+|\n+/)) {
    const ord = mening.replace(/\*\*|__|[#>*`•]/g, ' ').replace(/^\s*(?:\d+[.)]|-)\s+/, '').trim().split(/\s+/).slice(1);
    for (const o of ord) {
      const r = o.replace(/^[^\p{L}]+|[^\p{L}\p{N}]+$/gu, '');
      if (r.length < 3 || !/^\p{Lu}/u.test(r) || VANLIGA.has(lower(r))) continue;
      const l = lower(r);
      if ([...VECKODAGAR, ...WEEKDAYS, ...MANADER, ...MONTHS].includes(l)) continue;
      const bas = l.replace(/(?::s|'s|s)$/u, '');
      if (k.includes(l) || (bas.length >= 3 && k.includes(bas))) continue;
      if (new RegExp(`(?<![\\p{L}])${l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u').test(t.replace(new RegExp(`(?<![\\p{L}])${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gu'), ''))) continue;
      namn.push(r);
    }
  }
  const dagar = [];
  const iDatum = new Set(datum.ok.map(d => lower(d.text)));
  const dagIndex = l => (VECKODAGAR.includes(l) ? VECKODAGAR.indexOf(l) : WEEKDAYS.indexOf(l));
  for (const m of t.matchAll(DAGRE)) {
    const l = lower(m[1]);
    const i = dagIndex(l);
    if (k.includes(VECKODAGAR[i]) || k.includes(WEEKDAYS[i]) || [...iDatum].some(x => x.includes(l))) continue;
    dagar.push(m[1]);
  }
  for (const m of t.matchAll(MANADRE)) {
    const l = lower(m[1]);
    const nr = String((MANADER.includes(l) ? MANADER.indexOf(l) : MONTHS.indexOf(l)) + 1).padStart(2, '0');
    const n = Number(nr) - 1;
    if (k.includes(MANADER[n]) || k.includes(MONTHS[n]) || [...iDatum].some(x => x.includes(l)) || new RegExp(`\\d{4}-${nr}(?:-\\d\\d)?`).test(k)) continue;
    dagar.push(m[1]);
  }
  return { tal: [...new Set(talen)], namn: [...new Set(namn)], dagar: [...new Set(dagar)], felDatum: datum.fel };
}

const SORTER = [
  ['skicka', 'skickat|mejlat|svarat|vidarebefordrat|meddelat|kontaktat|ringt', 'skickade|mejlade|svarade|vidarebefordrade|meddelade|kontaktade|ringde',
    'skickats|skickat|vidarebefordrats|besvarats', 'sent|emailed|e-mailed|replied|forwarded|notified|contacted|called|messaged', 'sent|emailed|forwarded'],
  ['boka', 'bokat|lagt\\s+in|schemalagt|bekräftat', 'bokade|lade\\s+in|la\\s+in|bekräftade',
    'bokats|bokat|lagts\\s+in|inlagd|inlagt|bekräftats', 'booked|scheduled|confirmed|put\\s+(?:it\\s+)?in', 'booked|added\\s+to\\s+(?:your|the)\\s+calendar'],
  ['skapa', 'skapat|sparat|lagt\\s+till|skrivit\\s+in', 'skapade|sparade|lade\\s+till|la\\s+till',
    'skapats|skapad|skapat|sparats|sparad|sparat|lagts\\s+till|tillagd|tillagt', 'created|saved|added|set\\s+up', 'created|saved|added'],
  ['bifoga', 'bifogat', 'bifogar|bifogade', 'bifogad|bifogat|bifogas', 'attached|enclosed', 'attached|enclosed'],
  ['betala', 'betalat|beställt', 'betalade|beställde', 'betalats|betald|betalt|beställts', 'paid|ordered', 'paid|ordered'],
  ['andra', 'ändrat|tagit\\s+bort|raderat|flyttat|avbokat|ställt\\s+in', 'ändrade|tog\\s+bort|raderade|flyttade|avbokade|ställde\\s+in',
    'ändrats|raderats|flyttats|avbokats|avbokad|inställd|borttagen|borttaget', 'changed|deleted|removed|moved|cancell?ed|rescheduled', 'changed|deleted|removed|moved|cancell?ed|rescheduled'],
  ['las', 'läst|kollat|tittat\\s+(?:i|på)|gått\\s+igenom|sökt\\s+i|hittat', 'läste|kollade|tittade\\s+(?:i|på)|gick\\s+igenom|hittade',
    '', 'read|checked|looked\\s+(?:at|in|through)|gone\\s+through|searched|found', ''],
];
const PASTA = SORTER.map(([sort, perf, pret, passiv, en, enPassiv]) => [sort, new RegExp([
  `(?<![\\p{L}])(?:jag|vi)\\s+har\\s+(?:nu\\s+|redan\\s+|också\\s+|just\\s+|precis\\s+)?(?:${perf})(?![\\p{L}])`,
  `(?<![\\p{L}])(?:jag|vi)\\s+(?:${pret})(?![\\p{L}])`,
  ...(passiv ? [`(?<![\\p{L}])(?:är|har|blev|blivit)\\s+(?:nu\\s+|redan\\s+)?(?:${passiv})(?![\\p{L}])`] : []),
  `(?<![\\p{L}])(?:i|we)(?:'ve|’ve|\\s+have)\\s+(?:now\\s+|just\\s+|already\\s+|also\\s+)?(?:${en})(?![\\p{L}])`,
  `(?<![\\p{L}])(?:i|we)\\s+(?:${en})(?![\\p{L}])`,
  ...(enPassiv ? [`(?<![\\p{L}])(?:has|have)\\s+been\\s+(?:${enPassiv})(?![\\p{L}])`, `(?<![\\p{L}])(?:is|are)\\s+(?:now\\s+)?(?:${enPassiv})(?![\\p{L}])(?!\\s+(?:no\\s+later|by|before|within|until|on\\s+time))`] : []),
  ...(sort === 'bifoga' ? ['(?<![\\p{L}])(?:please\\s+find\\s+attached|i\\s+(?:am\\s+)?attaching)'] : []),
].join('|'), 'iu')]);
const NEKAT = /(?<![\p{L}])(inte|ej|aldrig|kan|kunde|ska|skall|skulle|kommer\s+att|vill|not|never|n't|cannot|can|could|will|would|should|shall|going\s+to|om|if|innan|before|när|when)(?![\p{L}])[^.!?\n]{0,25}$/iu;
const LASER = { kalender: 'kalender', lediga_tider: 'kalender', mejl: 'mejl', paminnelser: 'paminnelser', anteckningar: 'anteckningar',
  meddelanden: 'meddelanden', mapp: 'mapp', las_fil: 'mapp', webbsok: 'webb', las_sida: 'webb', safari_sida: 'webb', las_underlag: 'underlag' };
const HANDLINGSVERKTYG = { skapa_paminnelse: 'paminnelse', lagg_in_mote: 'mote', mejlutkast: 'mejlutkast', skriv_anteckning: 'anteckning', kor_genvag: 'genvag' };

export function gjortUrSteg(steg = []) {
  const ut = [];
  for (const s of steg) {
    if (s.fel) continue;
    if (LASER[s.verktyg]) ut.push({ sort: 'last', vad: LASER[s.verktyg] });
    else if (HANDLINGSVERKTYG[s.verktyg] || s.handling) {
      const gjord = /^(?:Gjort|Done):/i.test(String(s.kort || ''));
      ut.push({ sort: gjord ? 'gjort' : 'foreslaget', vad: HANDLINGSVERKTYG[s.verktyg] || s.verktyg });
    }
  }
  return ut;
}

export function pastaddaHandlingar(svar) {
  const ut = [];
  for (const mening of String(svar || '').split(/(?<=[.!?])\s+|\n+/)) {
    for (const [sort, re] of PASTA) {
      const m = re.exec(mening);
      if (!m) continue;
      if (NEKAT.test(mening.slice(0, m.index + (/^(?:är|har|is|are|has|have)\b/i.test(m[0]) ? 0 : 0)))) continue;
      if (/(förslag|utkast\s+till\s+förslag|proposal|suggestion|suggested|proposed)/iu.test(mening.slice(m.index, m.index + m[0].length + 30)) && sort === 'skapa') {
        ut.push({ sort: 'foresla', mening: mening.trim().slice(0, 200) }); break;
      }
      ut.push({ sort, mening: mening.trim().slice(0, 200) });
      break;
    }
  }
  return ut;
}

function handlingarUtanStod(svar, gjort = [], { form = 'svar' } = {}) {
  const lasta = new Set(gjort.filter(g => g.sort === 'last').map(g => g.vad));
  const gjorda = gjort.filter(g => g.sort === 'gjort');
  const foreslagna = gjort.filter(g => g.sort === 'foreslaget');
  const ut = [];
  for (const p of pastaddaHandlingar(svar)) {
    if (p.sort === 'foresla') { if (!foreslagna.length && !gjorda.length) ut.push({ ...p, foreslaget: false }); continue; }
    if (p.sort === 'las') {
      if (form === 'utkast' || lasta.size) continue;
      ut.push(p); continue;
    }
    const passar = { boka: ['mote'], skapa: ['paminnelse', 'anteckning', 'mejlutkast', 'mote'], skicka: [], bifoga: [], betala: [], andra: [] }[p.sort] || [];
    if (gjorda.some(g => passar.includes(g.vad) || (!passar.length && false))) continue;
    ut.push({ ...p, foreslaget: foreslagna.some(g => passar.includes(g.vad)) });
  }
  return ut;
}

const punkterAv = t => String(t).split('\n').filter(r => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(r)).length;
const meningarAv = t => String(t).replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '').replace(/\n+/g, ' ')
  .split(/(?<=[.!?])\s+(?=[\p{Lu}\d])/u).filter(x => /\p{L}{2}/u.test(x)).length;
const ordAv = t => String(t).split(/\s+/).filter(o => /\p{L}|\d/u.test(o)).length;

const VIKT = { handling: 4, datum: 3, tal: 3, forbud: 3, steg: 2, sprak: 2, namn: 1, dag: 1, form: 1, verktyg: 2 };
export const poang = fel => fel.reduce((s, f) => s + (VIKT[f.kod] || 1), 0);

export async function prova(svar, kontext = {}, { lage: l = 'forval', modell = null } = {}) {
  const t = String(svar || '');
  const fel = [];
  const k = kontext.krav || krav(kontext.instruktion || '', { sprak: kontext.sprak });
  const ss = stammar(t);
  const lagt = lower(t);
  const platser = [];
  const saknas = [];
  for (const s of k.steg) {
    if (s.las) {
      const last = (kontext.gjort || []).some(g => g.sort === 'last' && (g.vad === s.las || g.vad === 'bilaga' || g.vad === 'underlag'));
      const korda = kontext.verktyg ? s.verktyg.some(v => kontext.verktyg.includes(v)) : null;
      if (korda === false || (korda === null && !last && kontext.gjort)) fel.push({ lager: 'krav', kod: 'verktyg', varde: s.text, nr: s.nr, las: s.las });
      continue;
    }
    if (k.tvarsprak) { if (s.stammar?.length) saknas.push(s); continue; }
    const i = stegetI(s, t, ss);
    if (i === null) continue;
    if (i < 0) saknas.push(s); else platser.push({ s, i });
  }
  let domt = false;
  if (modell && k.steg.length && (saknas.length || l === 'strikt')) {
    const fraga = l === 'strikt' ? k.steg.filter(s => !s.las) : saknas;
    const svarat = await modell({ instruktion: kontext.instruktion, svar: t, steg: fraga }).catch(() => null);
    if (Array.isArray(svarat)) {
      domt = true;
      const bort = saknas.filter(s => !svarat.includes(s.nr));
      for (const s of bort) saknas.splice(saknas.indexOf(s), 1);
      if (l === 'strikt') for (const nr of svarat) { const s = fraga.find(x => x.nr === nr); if (s && !saknas.includes(s)) saknas.push(s); }
    }
  }
  if (k.tvarsprak && !domt) saknas.length = 0;
  for (const s of saknas) fel.push({ lager: 'krav', kod: 'steg', varde: s.text, nr: s.nr });
  if (k.ordning && platser.length >= 2 && !saknas.length) {
    const sorterad = [...platser].sort((a, b) => a.s.nr - b.s.nr);
    const fore = sorterad.find((p, i) => i > 0 && p.i < sorterad[i - 1].i);
    if (fore) fel.push({ lager: 'krav', kod: 'steg', varde: fore.s.text, nr: fore.s.nr, ordning: true });
  }
  for (const f of k.inte) if (f.stammar.every(s => new RegExp(`(?<![\\p{L}])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(lagt))) fel.push({ lager: 'krav', kod: 'forbud', varde: f.fras });
  if (String(kontext.underlag || '').trim()) {
    const kalla = [kontext.underlag, kontext.instruktion, kontext.profil, kontext.historik].filter(Boolean).join('\n');
    const u = utanStod(t, kalla, { nu: kontext.nu || new Date() });
    for (const x of u.tal) fel.push({ lager: 'fakta', kod: 'tal', varde: x });
    for (const x of u.felDatum) fel.push({ lager: 'fakta', kod: 'datum', varde: x });
    for (const x of u.dagar) fel.push({ lager: 'fakta', kod: 'dag', varde: x });
    if (l === 'strikt') for (const x of u.namn) fel.push({ lager: 'fakta', kod: 'namn', varde: x });
  } else {
    for (const x of datumMedVeckodag(t, kontext.nu || new Date()).fel) fel.push({ lager: 'fakta', kod: 'datum', varde: x });
  }
  for (const p of handlingarUtanStod(t, kontext.gjort || [], { form: kontext.form })) fel.push({ lager: 'handling', kod: 'handling', varde: p.mening, sort: p.sort, foreslaget: p.foreslaget });
  const ruta = /```[^\n]*\n([\s\S]*?)(?:\n```|$)/.exec(t);
  const karna = ruta && ruta[1].trim().length > 40 ? ruta[1].replace(/^\s*(utkast|sammanfattning|draft|summary|text)\s*\n/i, '') : t;
  const sprak = k.sprak || kontext.sprak;
  const har = sprakAv(karna);
  if (sprak && har && har !== sprak) fel.push({ lager: 'form', kod: 'sprak', varde: sprak, har });
  if (k.punkter && punkterAv(karna) !== k.punkter) fel.push({ lager: 'form', kod: 'form', varde: 'punkter', vill: k.punkter, har: punkterAv(karna) });
  if (k.meningar && meningarAv(karna) !== k.meningar) fel.push({ lager: 'form', kod: 'form', varde: 'meningar', vill: k.meningar, har: meningarAv(karna) });
  if (k.maxOrd && ordAv(karna) > k.maxOrd) fel.push({ lager: 'form', kod: 'form', varde: 'ord', vill: k.maxOrd, har: ordAv(karna) });
  return { fel, krav: k };
}

const vartForsok = (fel, l) => fel.some(f => l === 'strikt' || f.kod !== 'dag');

export function rattelse(fel, svar, { medSvar = true } = {}) {
  const rader = fel.map(f => {
    switch (f.kod) {
      case 'steg': return f.ordning ? tx('kontroll.rattelse.ordning', { nr: f.nr, steg: f.varde }) : tx('kontroll.rattelse.steg', { nr: f.nr, steg: f.varde });
      case 'verktyg': return tx('kontroll.rattelse.verktyg', { steg: f.varde });
      case 'forbud': return tx('kontroll.rattelse.forbud', { fras: f.varde });
      case 'tal': return tx('kontroll.rattelse.tal', { tal: f.varde });
      case 'datum': return tx('kontroll.rattelse.datum', { datum: f.varde });
      case 'dag': return tx('kontroll.rattelse.dag', { dag: f.varde });
      case 'namn': return tx('kontroll.rattelse.namn', { namn: f.varde });
      case 'handling': return f.foreslaget ? tx('kontroll.rattelse.foreslaget', { mening: f.varde }) : tx('kontroll.rattelse.handling', { mening: f.varde });
      case 'sprak': return tx(f.varde === 'en' ? 'kontroll.rattelse.engelska' : 'kontroll.rattelse.svenska');
      case 'form': return tx(`kontroll.rattelse.${f.varde}`, { vill: f.vill, har: f.har });
      default: return null;
    }
  }).filter(Boolean);
  return [tx('kontroll.rattelse.inledning'), ...(medSvar ? [byggTidigare(svar)] : []), ...rader.map(r => `- ${r}`), tx('kontroll.rattelse.avslutning')].join('\n');
}
const byggTidigare = svar => tx('kontroll.rattelse.tidigare', { svar: String(svar || '').slice(0, 4000) });

export function visas(f) {
  switch (f.kod) {
    case 'steg': return f.ordning ? tx('kontroll.visas.ordning', { nr: f.nr, steg: kort(f.varde) }) : tx('kontroll.visas.steg', { nr: f.nr, steg: kort(f.varde) });
    case 'verktyg': return tx('kontroll.visas.verktyg', { steg: kort(f.varde) });
    case 'forbud': return tx('kontroll.visas.forbud', { fras: kort(f.varde) });
    case 'tal': return tx('kontroll.visas.tal', { tal: f.varde });
    case 'datum': return tx('kontroll.visas.datum', { datum: f.varde });
    case 'dag': return tx('kontroll.visas.dag', { dag: f.varde });
    case 'namn': return tx('kontroll.visas.namn', { namn: f.varde });
    case 'handling': return f.foreslaget ? tx('kontroll.visas.foreslaget', { mening: kort(f.varde) }) : tx('kontroll.visas.handling', { mening: kort(f.varde) });
    case 'sprak': return tx(f.varde === 'en' ? 'kontroll.visas.engelska' : 'kontroll.visas.svenska');
    case 'form': return tx(`kontroll.visas.${f.varde}`, { vill: f.vill, har: f.har });
    default: return String(f.varde || '');
  }
}
const kort = (t, n = 80) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

const resultat = ({ l, fore = [], efter, forsok, t0 }) => ({
  lage: l, ok: !efter.length, forsok, ms: Date.now() - t0,
  rattat: fore.filter(f => !efter.some(e => e.kod === f.kod && e.varde === f.varde)).map(visas).slice(0, 6),
  kvar: efter.map(f => ({ lager: f.lager, kod: f.kod, text: visas(f) })).slice(0, 8),
});

const META = /(utelämna|uteslut|nämner\s+inte|nämnt\s+inte|inte\s+nämnt|inte\s+tagit\s+med|som\s+du\s+bad|enligt\s+dina\s+instruktioner|omit|exclud|left\s+out|not\s+mention|without\s+mentioning|as\s+(?:you\s+)?requested|as\s+per\s+your)/iu;
export function utanMetaForbud(svar, k) {
  if (!k?.inte?.length) return svar;
  const traff = m => k.inte.some(f => f.stammar.every(st => new RegExp(`(?<![\\p{L}])${st.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(m)));
  const ut = String(svar).split('\n').map(rad => rad.split(/(?<=[.!?])\s+/).filter(m => !(traff(m) && META.test(m))).join(' '))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return ut || svar;
}

export async function efterkontroll({ svar: forstaSvar, kontext = {}, lage: l = 'forval', forsok = null, modell = null }) {
  let svar = forstaSvar;
  if (l === 'av' || !String(svar || '').trim()) return { svar, kontroll: null };
  const t0 = Date.now();
  const a = await prova(svar, kontext, { lage: l, modell });
  if (!a.fel.length) return { svar, kontroll: resultat({ l, efter: [], forsok: 0, t0 }) };
  const lagat = utanMetaForbud(svar, a.krav);
  if (lagat !== svar) {
    const c = await prova(lagat, { ...kontext, krav: a.krav }, { lage: l, modell });
    if (poang(c.fel) < poang(a.fel) && !vartForsok(c.fel, l)) return { svar: lagat, kontroll: resultat({ l, fore: a.fel, efter: c.fel, forsok: 0, t0 }) };
    if (poang(c.fel) < poang(a.fel)) { svar = lagat; a.fel = c.fel; }
  }
  if (!forsok || !vartForsok(a.fel, l)) return { svar, kontroll: resultat({ l, efter: a.fel, forsok: 0, t0 }) };
  let nytt = null;
  try { nytt = await forsok(rattelse(a.fel, svar)); } catch { nytt = null; }
  if (!String(nytt || '').trim()) return { svar, kontroll: resultat({ l, efter: a.fel, forsok: 1, t0 }) };
  const b = await prova(nytt, { ...kontext, krav: a.krav }, { lage: l, modell });
  const battre = poang(b.fel) <= poang(a.fel);
  return battre
    ? { svar: nytt, kontroll: resultat({ l, fore: a.fel, efter: b.fel, forsok: 1, t0 }) }
    : { svar, kontroll: resultat({ l, efter: a.fel, forsok: 1, t0 }) };
}

export function modellDomare(svara, o = {}) {
  return async ({ instruktion, svar, steg }) => {
    if (!steg?.length) return [];
    const prompt = [
      tx('kontroll.domare.inledning'),
      `${tx('kontroll.domare.instruktion')}\n${String(instruktion || '').slice(0, 1500)}`,
      `${tx('kontroll.domare.svaret')}\n${String(svar || '').slice(0, 2500)}`,
      `${tx('kontroll.domare.stegen')}\n${steg.map(s => `${s.nr}. ${s.text}`).join('\n')}`,
      tx('kontroll.domare.fraga'),
    ].join('\n\n');
    const r = await svara(prompt, { plats: 'efterat', tak: 40, timeout: 90000, baraLokalt: true, ...o });
    const m = /\{[\s\S]*\}/.exec(String(r || ''));
    if (!m) return null;
    try {
      const d = JSON.parse(m[0]);
      return Array.isArray(d.saknas) ? d.saknas.map(Number).filter(n => steg.some(s => s.nr === n)) : null;
    } catch { return null; }
  };
}

export function forSlingan({ instruktion, profil = '', historik = '', sprak = null, lage: l = 'forval', modell = null } = {}) {
  if (l === 'av') return null;
  return async (svar, { steg = [], resultat: res = [], sammanhang = '', nu = new Date() } = {}) => {
    const kontext = { instruktion, profil, historik, sprak, nu,
      underlag: [sammanhang, ...res].filter(Boolean).join('\n'),
      gjort: gjortUrSteg(steg), verktyg: steg.filter(s => !s.fel).map(s => s.verktyg) };
    if (!kontext.underlag.trim()) kontext.underlag = `${instruktion}\n${sammanhang}` || ' ';
    const r = await prova(svar, kontext, { lage: l, modell });
    return { fel: r.fel, krav: r.krav, varde: vartForsok(r.fel, l) };
  };
}
export const slingresultat = ({ lage: l = 'forval', fore = [], efter = [], forsok = 0, t0 = Date.now() }) => resultat({ l, fore, efter, forsok, t0 });

export function duKontroll(ops = [], { text = '', rader = [], lage: l = 'forval' } = {}) {
  if (l === 'av') return { ops, kontroll: null };
  const t0 = Date.now();
  const kvar = [], borta = [];
  const ut = [];
  for (const o of ops) {
    const nytext = o.text || '';
    if (!nytext || o.gor === 'bort' || o.gor === 'glom') { ut.push(o); continue; }
    const rad = rader.find(r => r.id === o.id);
    const u = utanStod(nytext, `${text}\n${rad?.text || ''}\n${rader.map(r => r.text).join('\n')}`);
    const fel = [...u.tal.map(x => ({ kod: 'tal', varde: x })), ...u.namn.map(x => ({ kod: 'namn', varde: x }))];
    if (fel.some(f => f.kod === 'tal')) { borta.push(...fel); continue; }
    ut.push(o);
  }
  const delar = String(text).split(/,\s*(?:och|and)\s+|;\s*|\.\s+|\s+(?:och|and)\s+(?=(?:jag|i)\s)/iu).map(x => x.trim()).filter(x => innehall(x).length);
  if (delar.length >= 2) {
    const ops_ = ut.map(o => { const r = rader.find(x => x.id === o.id); return `${o.text || o.om || ''} ${o.rad ? Object.values(o.rad).join(' ') : ''} ${r?.text || ''}`; }).join('\n');
    const ss = stammar(ops_);
    delar.forEach((d, i) => {
      const st = innehall(d).filter(s => !['jobba', 'arbet', 'work', 'numer', 'längr', 'longe'].includes(s));
      if (st.length && !st.some(s => ss.has(s))) kvar.push({ lager: 'krav', kod: 'steg', varde: d, nr: i + 1 });
    });
  }
  return { ops: ut, kontroll: resultat({ l, fore: borta, efter: [...kvar, ...borta], forsok: 0, t0 }) };
}

export function kollegaKontroll(lista = [], { underlag = [], profil = '', sprak = null, lage: l = 'forval', nu = new Date() } = {}) {
  if (l === 'av') return { lista, kontroll: null };
  const t0 = Date.now();
  const kalla = `${underlag.map(u => `${u.vem || ''}\n${u.titel || ''}\n${u.text || ''}\n${u.tid || ''}\n${u.mote ? `${u.mote.start} ${u.mote.slut || ''}` : ''}`).join('\n')}\n${profil}`;
  const fel = [];
  const ut = [];
  for (const f of lista) {
    const u = utanStod(`${f.titel || ''}. ${f.varfor || ''}`, kalla, { nu });
    if (u.tal.length || u.felDatum.length) { fel.push(...u.tal.map(x => ({ lager: 'fakta', kod: 'tal', varde: x })), ...u.felDatum.map(x => ({ lager: 'fakta', kod: 'datum', varde: x }))); continue; }
    let x = f;
    if (f.utkast) {
      const uu = utanStod(f.utkast, kalla, { nu });
      const h = handlingarUtanStod(f.utkast, [], { form: 'utkast' });
      const har = sprakAv(f.utkast);
      const sprakfel = sprak && har && har !== sprak;
      if (uu.tal.length || h.length || sprakfel) {
        fel.push(...uu.tal.map(v => ({ lager: 'fakta', kod: 'tal', varde: v })), ...h.map(p => ({ lager: 'handling', kod: 'handling', varde: p.mening })),
          ...(sprakfel ? [{ lager: 'form', kod: 'sprak', varde: sprak, har }] : []));
        x = { ...f, utkast: '' };
      }
    }
    ut.push(x);
  }
  return { lista: ut, kontroll: resultat({ l, fore: fel, efter: fel, forsok: 0, t0 }) };
}

export function undersokningKontroll(slutsats, { underlag = '', lage: l = 'forval', nu = new Date() } = {}) {
  if (l === 'av' || !slutsats?.text) return { slutsats, kontroll: null };
  const t0 = Date.now();
  const text = `${slutsats.text}\n${slutsats.oppet || ''}`;
  const u = utanStod(text, underlag, { nu });
  const fel = [...u.tal.map(x => ({ lager: 'fakta', kod: 'tal', varde: x })), ...u.felDatum.map(x => ({ lager: 'fakta', kod: 'datum', varde: x })),
    ...handlingarUtanStod(text, [], {}).filter(p => p.sort !== 'las').map(p => ({ lager: 'handling', kod: 'handling', varde: p.mening }))];
  if (!fel.length) return { slutsats, kontroll: resultat({ l, efter: [], forsok: 0, t0 }) };
  const k = resultat({ l, efter: fel, forsok: 0, t0 });
  return { slutsats: { ...slutsats, sakerhet: 'låg', oppet: [slutsats.oppet, ...k.kvar.map(x => x.text)].filter(Boolean).join(' ') }, kontroll: k };
}

export function rad(k) {
  if (!k || k.ok || !k.kvar?.length) return null;
  return tx('kontroll.rad', { vad: k.kvar.map(x => x.text).join(' · ') });
}
