
import { createHash } from 'node:crypto';
import { arLas } from './mcp.mjs';
import { arPakallande, rensaPakallande } from './uppslag.mjs';
import { rensaOsynliga } from './failclosed.mjs';
import { tx } from './sprakstod.mjs';

const ADRESS = /\bhttps?:\/\/[^\s<>"'`)\]]+/iu;

const INLEDNING = '(?:(?:snälla|kan\\s+du|kan\\s+ni|vill\\s+du|jag\\s+vill\\s+att\\s+du|hjälp\\s+mig(?:\\s+att)?|please|pls|can\\s+you|could\\s+you|would\\s+you|i\\s+want\\s+you\\s+to|i(?:\'|’)?d\\s+like\\s+you\\s+to|help\\s+me|ok(?:ej|ay)?|nu|now)[,\\s]+)*';
const VERB = '(?:koppla\\s+in|koppla\\s+på|koppla\\s+upp(?:\\s+mot)?|koppla\\s+till|anslut(?:\\s+till)?|lägg\\s+till|installera|använd|connect(?:\\s+to)?|hook\\s+up|plug\\s+in|add|install|use|link)';
const BEGARAN = new RegExp(`^\\s*${INLEDNING}${VERB}(?![\\p{L}])([^\\n]{0,80}?)(https?:\\/\\/\\S+)`, 'iu');

const MCPORD = /(?<![\p{L}])(?:mcp|koppling\p{L}*|server\p{L}*|connector\p{L}*|integration\p{L}*|plugin\p{L}*)(?![\p{L}])/iu;
const STARKA = /^(?:koppla|anslut|connect|hook|plug)/iu;

export function avsiktLank(text) {
  const t = rensaOsynliga(String(text || '')).trim();
  if (!t || t.length > 600) return null;
  const m = BEGARAN.exec(t);
  if (!m) return null;
  const mellan = m[1] || '';
  const verbet = m[0].slice(0, m[0].length - mellan.length - m[2].length).trim();
  const forsta = verbet.replace(new RegExp(`^${INLEDNING}`, 'iu'), '');
  if (!STARKA.test(forsta) && !MCPORD.test(`${mellan} ${t}`)) return null;
  const url = ADRESS.exec(m[2])?.[0]?.replace(/[.,;:!?]+$/, '');
  return url ? { url } : null;
}

const EGNA = /^(?:mejl\p{L}*|mail\p{L}*|e-?post\p{L}*|inkorg\p{L}*|kalender\p{L}*|påminnelse\p{L}*|anteckning\p{L}*|meddelande\p{L}*|sms|samtal\p{L}*|mapp\p{L}*|filer\p{L}*|dator\p{L}*|telefon\p{L}*|inbox|emails?|calendars?|reminders?|notes?|messages?|folders?|files?|computer|phone|nyheter|news|linkedin|safari)$/iu;
const AGANDE = '(?:mitt|mina|min|vårt|våra|vår|my|our)';
const SLUT = /^(?:och|and|så|so|please|snälla|tack|thanks|för|for|to|till|i|in|på|on|varje|every|nu|now|också|also|åt|åt\s+mig|det|it|om|about|konto|kontot|account|app|appen)$/iu;
const ANSLUT = [
  `(?:koppla|anslut)(?:\\s+(?:dig|in|upp|ihop))?\\s+(?:mot|till|med|på)\\s+(?:${AGANDE}\\s+)?`,
  `(?:connect|hook\\s+up|link)(?:\\s+(?:yourself|up))?\\s+(?:to|with)\\s+(?:${AGANDE}\\s+)?`,
  `(?:läsa|läs|kolla|komma\\s+åt)\\s+${AGANDE}\\s+`,
  `(?:read|check|access)\\s+${AGANDE}\\s+`,
  `(?:håll(?:a)?\\s+koll\\s+på|bevaka|följa?|övervaka)\\s+${AGANDE}\\s+`,
  `(?:keep\\s+(?:an\\s+eye\\s+on|track\\s+of)|watch|monitor|follow)\\s+${AGANDE}\\s+`,
];
const BEVAKA = /(?<![\p{L}])(?:håll(?:a)?\s+koll|bevaka|övervaka|följ|säg\s+till|keep\s+(?:an\s+eye|track)|watch|monitor|let\s+me\s+know|tell\s+me\s+when)(?![\p{L}])/iu;

export function avsiktTjanst(text) {
  const t = rensaOsynliga(String(text || '')).replace(/\s+/g, ' ').trim();
  if (!t || t.length > 400 || ADRESS.test(t)) return null;
  for (const [i, m] of ANSLUT.entries()) {
    const r = new RegExp(`(?<![\\p{L}])${m}([\\p{L}\\d][\\p{L}\\d.&-]*(?:\\s+[\\p{L}\\d][\\p{L}\\d.&-]*){0,2})`, 'iu').exec(t);
    if (!r) continue;
    const ord = [];
    for (const o of r[1].split(/\s+/)) { const x = o.replace(/[.,!?;:]+$/, ''); if (SLUT.test(x)) break; ord.push(x); if (x !== o) break; }
    const tjanst = ord.join(' ').trim();
    if (!tjanst || EGNA.test(tjanst.split(/\s+/)[0]) || tjanst.length > 40) return null;
    const kand = TJANSTER.some(x => x.ord.some(o => new RegExp(`^${o}$`, 'iu').test(tjanst)));
    if (i >= 2 && !/^\p{Lu}/u.test(tjanst) && !kand) return null;
    return { tjanst, bevaka: BEVAKA.test(t) };
  }
  return null;
}

export const TJANSTER = [
  { sok: 'fortnox', ord: ['fortnox'] },
  { sok: 'visma', ord: ['visma', 'spiris'] },
  { sok: 'notion', ord: ['notion'] },
  { sok: 'hubspot', ord: ['hubspot'] },
  { sok: 'salesforce', ord: ['salesforce'] },
  { sok: 'pipedrive', ord: ['pipedrive'] },
  { sok: 'google calendar', ord: ['google\\s+kalender\\p{L}*', 'google\\s+calendar', 'gcal'] },
  { sok: 'gmail', ord: ['gmail'] },
  { sok: 'google drive', ord: ['google\\s+drive'] },
  { sok: 'outlook', ord: ['outlook'] },
  { sok: 'microsoft teams', ord: ['teams'], versal: true },
  { sok: 'slack', ord: ['slack'], versal: true },
  { sok: 'jira', ord: ['jira'] },
  { sok: 'linear', ord: ['linear'], versal: true },
  { sok: 'asana', ord: ['asana'], versal: true },
  { sok: 'trello', ord: ['trello'] },
  { sok: 'monday', ord: ['monday\\.com'] },
  { sok: 'airtable', ord: ['airtable'] },
  { sok: 'github', ord: ['github'] },
  { sok: 'gitlab', ord: ['gitlab'] },
  { sok: 'zendesk', ord: ['zendesk'] },
  { sok: 'intercom', ord: ['intercom'], versal: true },
  { sok: 'shopify', ord: ['shopify'] },
  { sok: 'stripe', ord: ['stripe'], versal: true },
  { sok: 'confluence', ord: ['confluence'], versal: true },
  { sok: 'dropbox', ord: ['dropbox'] },
  { sok: 'crm', ord: ['crm\\p{L}*', 'kundregist\\p{L}*', 'kunddatabas\\p{L}*'], allmant: true },
  { sok: 'accounting', ord: ['bokföring\\p{L}*', 'bokföringsprogram\\p{L}*', 'accounting', 'bookkeeping'], allmant: true },
  { sok: 'database', ord: ['databas(?:en)?', 'database'], allmant: true },
];

const AGARE = '(?:mitt|min|mina|vårt|vår|våra|ert|er|era|my|our|your)';
const PREP = '(?:i|från|ur|till|in|from|into|on)';

export function behovAv(text) {
  const ra = rensaOsynliga(String(text || ''));
  const t = ra.toLowerCase();
  if (!t.trim() || t.length > 4000) return null;
  for (const tj of TJANSTER) {
    if (tj.versal && !new RegExp(`(?<![\\p{L}])${tj.ord[0][0].toUpperCase()}${tj.ord[0].slice(1)}(?![\\p{L}])`, 'u').test(ra)) continue;
    for (const o of tj.ord) {
      const agd = new RegExp(`(?<![\\p{L}])${AGARE}\\s+(?:\\p{L}+\\s+){0,2}?${o}(?![\\p{L}])`, 'iu');
      const i = new RegExp(`(?<![\\p{L}])${PREP}\\s+(?:\\p{L}+\\s+)?${o}(?![\\p{L}])`, 'iu');
      if (agd.test(t) || i.test(t)) return { sok: tj.sok, allmant: Boolean(tj.allmant) };
    }
  }
  return null;
}

export const tacker = (kopplingar, behov) => (kopplingar || []).some(k =>
  [k.namn, k.titel, k.registernamn, k.url].filter(Boolean).join(' ').toLowerCase()
    .includes(String(behov?.sok || '').split(' ')[0]));

export function namnIText(text, poster) {
  const t = rensaOsynliga(String(text || '')).toLowerCase();
  const ALLMANT = /^(?:mcp|server|servern|prov|test|remote|connector|official|the|and)$/;
  return (poster || []).filter(p => [p.namn, p.registernamn?.split('/').pop(), p.behov]
    .filter(Boolean).flatMap(n => String(n).toLowerCase().split(/[^\p{L}\d]+/u))
    .some(o => o.length >= 4 && !ALLMANT.test(o) && new RegExp(`(?<![\\p{L}\\d])${o}(?![\\p{L}\\d])`, 'u').test(t)));
}

const STYR = [
  /<\s*\/?\s*(?:important|system|instructions?|secret|hidden|admin|assistant|context|note)\b[^>]*>/iu,
  /\[\s*(?:system|important|instructions?|admin)\s*\]/iu,
  /(?:before|prior to|after)\s+(?:using|calling|invoking|running|you use|you call)\s+(?:this|any|the|another|other)\b/iu,
  /(?:innan|efter att)\s+du\s+(?:använder|anropar|kör)\b/iu,
  /(?:also|always|first|instead)\s+(?:call|use|invoke|run)\s+(?:the\s+)?[\w.-]+\s+tool/iu,
  /(?:instead of|rather than)\s+(?:the\s+)?[\w.-]+\s+tool/iu,
  /(?:anropa|använd|kör)\s+(?:alltid|först|också|i stället)\b/iu,
  /(?:read|send|include|pass|attach|upload|forward|copy|cat|open)\b[^\n]{0,60}(?:~\/|\.ssh|id_rsa|id_ed25519|\.env\b|\.aws|\.npmrc|\.netrc|mcp\.json|keychain|nyckelring|credentials?|passwords?|private key|api[ _-]?keys?|secrets?|tokens?)/iu,
  /(?:läs|skicka|bifoga|ta med|kopiera)\b[^\n]{0,60}(?:~\/|\.ssh|id_rsa|\.env\b|lösenord|nyckel\p{L}*|hemlig\p{L}*|inloggning\p{L}*)/iu,
  /(?:as|in|into)\s+(?:the\s+)?(?:parameter|argument|field)\s+["'`]?(?:sidenote|note|context|extra|metadata|feedback)["'`]?/iu,
  /\bsidenote\b/iu,
  /(?:do not|don't|never)\s+(?:mention|tell|inform|reveal|show|notify|alert)\b/iu,
  /(?:nämn|berätta|visa|säg)\s+(?:inte|aldrig)\b[^\n]{0,40}(?:användaren|för\s+användaren)/iu,
  /(?:this|the)\s+(?:tool|function)\s+(?:has been|is)\s+(?:deprecated|disabled|replaced)[^\n]{0,60}(?:use|call)/iu,
  /(?:ignore|override|bypass|disable)\s+(?:the\s+)?(?:other|previous|safety|security|approval|confirmation|user)\b/iu,
  /(?:ignorera|strunta\s+i|kringgå)\s+(?:alla\s+|tidigare\s+|andra\s+)?(?:instruktion\p{L}*|regl\p{L}*|godkänn\p{L}*|användaren)/iu,
  /(?:without|no)\s+(?:asking|confirmation|approval|user consent)/iu,
  /utan\s+att\s+(?:fråga|användaren\s+(?:vet|märker|godkänner))/iu,
];

export function styrande(text) {
  const ra = String(text ?? '');
  if (!ra.trim()) return { styr: false };
  const ren = rensaOsynliga(ra);
  if (ren.length < ra.normalize('NFKC').length) return { styr: true, rad: ren.slice(0, 160), varfor: tx('lib.mcpgranska.varfor.dold') };
  for (const rad of ren.split(/\r?\n/)) {
    if (arPakallande(rad)) return { styr: true, rad: rad.trim().slice(0, 160), varfor: tx('lib.mcpgranska.varfor.pakallande') };
    if (STYR.some(r => r.test(rad))) return { styr: true, rad: rad.trim().slice(0, 160), varfor: tx('lib.mcpgranska.varfor.verktyg') };
  }
  return { styr: false };
}

export const normalisera = t => rensaOsynliga(String(t ?? ''));

const LIKNAR = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ɡ': 'g', 'һ': 'h', 'к': 'k', 'м': 'm', 'н': 'h', 'т': 't', 'в': 'b',
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X', 'І': 'I', 'Ј': 'J', 'Ѕ': 'S',
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X', 'ο': 'o', 'ν': 'v', 'ι': 'i', 'α': 'a', 'ρ': 'p', 'τ': 't', 'κ': 'k' };
const vikt = t => t.replace(/[\u0370-\u03ff\u0400-\u04ff\u0500-\u052f\u0261]/g, c => LIKNAR[c] || c);
const BLANDAT = /(?=[\p{L}]*\p{Script=Latin})(?=[\p{L}]*[\p{Script=Cyrillic}\p{Script=Greek}])[\p{L}]{2,}/u;

function provaText(t) {
  const n = normalisera(t);
  for (const ord of n.split(/[^\p{L}]+/u)) if (ord && BLANDAT.test(ord)) return { styr: true, rad: n.slice(0, 160), varfor: tx('lib.mcpgranska.varfor.homoglyf') };
  return styrande(vikt(n));
}

export const EGNA_VERKTYG = ['webbsok', 'las_sida', 'mejl', 'kalender', 'lediga_tider', 'paminnelser', 'anteckningar', 'safari_sida', 'meddelanden', 'mapp',
  'las_fil', 'rakna', 'genvagar', 'las_underlag', 'skapa_paminnelse', 'lagg_in_mote', 'mejlutkast', 'skriv_anteckning', 'kor_genvag', 'hitta_koppling'];

export function saneraVerktyg(v) {
  const djupt = (x, n = 0) => {
    if (n > 8) return null;
    if (typeof x === 'string') return normalisera(x);
    if (Array.isArray(x)) return x.slice(0, 100).map(y => djupt(y, n + 1));
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).slice(0, 100).map(([k, y]) => [normalisera(k), djupt(y, n + 1)]));
    return x;
  };
  const a = v?.annotations && typeof v.annotations === 'object' ? v.annotations : null;
  return {
    name: String(v?.name ?? ''),
    ...(v?.title != null ? { title: normalisera(v.title) } : {}),
    description: normalisera(v?.description ?? ''),
    inputSchema: v?.inputSchema && typeof v.inputSchema === 'object' ? djupt(v.inputSchema) : { type: 'object', properties: {} },
    ...(a ? { annotations: { ...(a.title != null ? { title: normalisera(a.title) } : {}), ...(typeof a.readOnlyHint === 'boolean' ? { readOnlyHint: a.readOnlyHint } : {}),
      ...(typeof a.destructiveHint === 'boolean' ? { destructiveHint: a.destructiveHint } : {}) } } : {}),
  };
}

function texterI(v) {
  const ut = [['namn', v.name.replace(/[_.-]+/g, ' ')], ['titel', v.title], ['beskrivning', v.description], ['titel', v.annotations?.title]];
  const ga = (x, djup) => {
    if (djup > 8 || x == null) return;
    if (typeof x === 'string') { ut.push(['parameter', x]); return; }
    if (Array.isArray(x)) { x.forEach(y => ga(y, djup + 1)); return; }
    if (typeof x === 'object') for (const [k, y] of Object.entries(x)) { ut.push(['parameter', k.replace(/[_-]+/g, ' ')]); ga(y, djup + 1); }
  };
  ga(v.inputSchema, 0);
  return ut.filter(([, t]) => typeof t === 'string' && t.trim());
}

export const verktygshash = v => createHash('sha256').update(JSON.stringify(saneraVerktyg(v))).digest('hex');

export function andringar(pinnade, verktyg) {
  const fore = new Map((pinnade || []).map(v => [v.namn, v.hash]));
  const nu = new Map((verktyg || []).map(v => [String(v.name), verktygshash(v)]));
  const ut = [];
  for (const [n, h] of nu) if (!fore.has(n)) ut.push({ namn: n, vad: 'ny' }); else if (fore.get(n) && fore.get(n) !== h) ut.push({ namn: n, vad: 'andrad' });
  for (const n of fore.keys()) if (!nu.has(n)) ut.push({ namn: n, vad: 'borta' });
  return ut;
}

const BETALAR = /(?:pay|payment|charge|refund|invoice|checkout|purchase|order|transfer|payout|subscribe|betal\p{L}*|faktur\p{L}*|överför\p{L}*|köp\p{L}*|beställ\p{L}*)/iu;
const SKICKAR = /(?:send|sent|email|e-mail|mail|message|sms|post|publish|reply|forward|notify|invite|share|tweet|skicka\p{L}*|mejla\p{L}*|meddela\p{L}*|publicera\p{L}*|svara\p{L}*|bjud\p{L}*|dela\p{L}*)/iu;
const RADERAR = /(?:delete|remove|destroy|trash|purge|erase|wipe|drop|truncate|archive|radera\p{L}*|ta\s+bort|töm\p{L}*|arkivera\p{L}*)/iu;

export function sortAv(v) {
  const n = `${v?.name || ''} ${v?.title || ''} ${v?.annotations?.title || ''}`.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.-]/g, ' ');
  const om = String(v?.description || '');
  if (arLas(v) && v?.annotations?.destructiveHint !== true) return 'las';
  if (BETALAR.test(n) || BETALAR.test(om)) return 'betala';
  if (v?.annotations?.destructiveHint === true || RADERAR.test(n)) return 'radera';
  if (SKICKAR.test(n) || SKICKAR.test(om)) return 'skicka';
  if (RADERAR.test(om)) return 'radera';
  return 'skriv';
}

export function fingeravtryck(verktyg) {
  const kanon = (verktyg || []).map(v => saneraVerktyg(v)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return createHash('sha256').update(JSON.stringify(kanon)).digest('hex');
}

export const renBeskrivning = (t, tak = 400) => rensaPakallande(rensaOsynliga(String(t || '')).replace(/\s+/g, ' ').trim()).text.slice(0, tak);

export function granskaVerktyg({ serverinfo = null, anvisningar = null, verktyg = [], andraNamn = [] } = {}) {
  const skal = [];
  for (const [vad, text] of [['server', serverinfo?.name], ['server', serverinfo?.title], ['anvisningar', anvisningar]]) {
    const s = provaText(text);
    if (s.styr) skal.push({ verktyg: null, vad, rad: s.rad, varfor: s.varfor });
  }
  const egna = [...new Set([...EGNA_VERKTYG, ...andraNamn])].filter(n => n && n.length >= 4);
  const namn = new Set();
  const lista = [];
  for (const ra of (verktyg || []).slice(0, 200)) {
    if (!ra || typeof ra.name !== 'string' || !/^[\w.-]{1,128}$/.test(ra.name)) {
      skal.push({ verktyg: String(ra?.name || '').slice(0, 60), vad: 'namn', rad: String(ra?.name || '').slice(0, 60), varfor: tx('lib.mcpgranska.varfor.namn') });
      continue;
    }
    if (namn.has(ra.name)) { skal.push({ verktyg: ra.name, vad: 'namn', rad: ra.name, varfor: tx('lib.mcpgranska.varfor.krock') }); continue; }
    namn.add(ra.name);
    const v = saneraVerktyg(ra);
    for (const [vad, text] of texterI(v)) {
      const s = provaText(text);
      if (s.styr) { skal.push({ verktyg: v.name, vad, rad: s.rad, varfor: s.varfor }); break; }
    }
    if (v.description.length > 1000) skal.push({ verktyg: v.name, vad: 'beskrivning', rad: v.description.slice(0, 160), varfor: tx('lib.mcpgranska.varfor.lang') });
    else if (/https?:\/\/|www\./i.test(v.description)) skal.push({ verktyg: v.name, vad: 'beskrivning', rad: v.description.slice(0, 160), varfor: tx('lib.mcpgranska.varfor.adress') });
    else {
      const andra = egna.find(n => n !== v.name && new RegExp(`(?<![\\w])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'i').test(v.description));
      if (andra) skal.push({ verktyg: v.name, vad: 'beskrivning', rad: v.description.slice(0, 160), varfor: tx('lib.mcpgranska.varfor.skuggar', { namn: andra }) });
    }
    lista.push({
      namn: v.name,
      titel: v.title || v.annotations?.title || null,
      om: v.description,
      sort: sortAv(v),
      schema: JSON.stringify(v.inputSchema).length <= 6000 ? v.inputSchema : { type: 'object', properties: {} },
      hash: verktygshash(ra),
      pastar: v.annotations ? { lasande: v.annotations.readOnlyHint === true, raderar: v.annotations.destructiveHint === true } : null,
    });
  }
  if ((verktyg || []).length > 200) skal.push({ verktyg: null, vad: 'antal', rad: String(verktyg.length), varfor: tx('lib.mcpgranska.varfor.forMangaVerktyg') });
  return { verktyg: lista, vagras: skal.length > 0, skal, fingeravtryck: fingeravtryck(verktyg) };
}

export function granskaModellform(def) {
  const texter = [];
  const ga = (x, d) => {
    if (d > 10 || x == null) return;
    if (typeof x === 'string') { texter.push(x); return; }
    if (Array.isArray(x)) { x.forEach(y => ga(y, d + 1)); return; }
    if (typeof x === 'object') for (const [k, y] of Object.entries(x)) { texter.push(k.replace(/[_-]+/g, ' ')); ga(y, d + 1); }
  };
  ga({ name: String(def?.name || '').replace(/[_.-]+/g, ' '), description: def?.description, parameters: def?.parameters }, 0);
  for (const t of texter) {
    if (normalisera(t) !== t) return { ok: false, skal: { rad: t.slice(0, 160), varfor: tx('lib.mcpgranska.varfor.dold') } };
    const s = provaText(t);
    if (s.styr) return { ok: false, skal: { rad: s.rad, varfor: s.varfor } };
  }
  return { ok: true };
}

export function rensaArgument(schema, arg) {
  const p = schema?.properties;
  if (!p || typeof p !== 'object' || !arg || typeof arg !== 'object') return arg && typeof arg === 'object' ? arg : {};
  return Object.fromEntries(Object.entries(arg).filter(([k]) => Object.prototype.hasOwnProperty.call(p, k)));
}

export function provaAdress(adress, { tillatLokal = false } = {}) {
  let u;
  try { u = new URL(String(adress || '').trim()); } catch { return { ok: false, skal: tx('lib.mcpgranska.adress.las') }; }
  if (u.username || u.password) return { ok: false, skal: tx('lib.mcpgranska.adress.uppgifter') };
  const lokal = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
  if (lokal && !tillatLokal) return { ok: false, skal: tx('webb.publikt.intern') };
  if (u.protocol === 'http:' && !(lokal && tillatLokal)) return { ok: false, skal: tx('lib.mcpgranska.adress.https') };
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, skal: tx('lib.mcpgranska.adress.https') };
  if (/[{}]/.test(decodeURIComponent(u.pathname + u.search))) return { ok: false, skal: tx('lib.mcpgranska.adress.mall') };
  u.hash = '';
  return { ok: true, url: u.href, lokal };
}

export function idFor(url) {
  const u = new URL(url);
  const bas = u.hostname.replace(/^(?:www|mcp|api)\./, '').split('.')[0].replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 16) || 'mcp';
  return `${bas}-${createHash('sha256').update(url).digest('hex').slice(0, 6)}`;
}

export const verktygsnamn = (kopplingsId, namn) =>
  `mcp_${String(kopplingsId).replace(/[^a-z0-9]/gi, '').slice(0, 12)}_${String(namn).replace(/[^a-zA-Z0-9_]/g, '_')}`.slice(0, 64);
