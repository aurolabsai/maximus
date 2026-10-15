
import { VANLIGA } from './failclosed.mjs';
import { rensaPakallande } from './uppslag.mjs';
import { tx } from './sprakstod.mjs';

const FRAGEORD = new Set(['vilket', 'vilken', 'vilka', 'varför', 'hurdan', 'snälla', 'tack',
  'gärna', 'skriv', 'svara', 'förklara', 'sammanfatta', 'berätta', 'hjälp', 'fråga', 'frågan',
  'svaret', 'kort', 'bara', 'något', 'någon', 'några', 'också', 'kanske', 'mening', 'meningar',
  'text', 'texten', 'mejl', 'mejlet', 'brev', 'brevet', 'idag', 'imorgon', 'igår']);

const FRAGEORD_EN = new Set(`what which where when whom whose why how could would should shall might
must will just please thanks thank help tell explain summarize summarise describe write answer reply
question questions about with from into onto than then that this these those there their they them
have has had having been being were does doing done make made know want need like also some something
someone anything anyone everything everyone nothing very much many more most less least only even
still again ever never always often sometimes today tomorrow yesterday week month year your yours mine
ours here over under after before between because while until since upon text email mail letter
message short long good well able other others another each every same such what's it's don't
doesn't isn't aren't can't won't i'm you're we're they're let's find show give take look keep
said says say saying think thought going get got gets getting come comes came work works right
sure okay yeah hello maybe kind sort thing things time times people way ways part last next
first second new old big small great little own both either neither whether within without
around against during through across along among toward towards`.split(/\s+/));

const ordlista = text => [...String(text || '').matchAll(/[\p{L}][\p{L}\d-]*/gu)].map(m => m[0]);

export function amnen(text) {
  const ut = new Map();
  const ord = ordlista(text);
  ord.forEach((o, i) => {
    const g = o.toLowerCase();
    if (g.length < 4 || VANLIGA.has(g) || FRAGEORD.has(g) || FRAGEORD_EN.has(g) || /^\d/.test(g)) return;
    const namn = i > 0 && /^\p{Lu}/u.test(o);
    if (!ut.has(g) || namn) ut.set(g, { ord: g, visas: o, namn });
  });
  return [...ut.values()];
}

const star = (ord, text) => new RegExp(`(^|[^\\p{L}])${ord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(text);

export function forslag({ fraga, tidigare = [], uppdrag = [], avbojt = [] } = {}) {
  const nej = new Set(avbojt.map(a => String(a).toLowerCase()));
  let bast = null;
  for (const a of amnen(fraga)) {
    if (nej.has(a.ord)) continue;
    if (uppdrag.some(u => star(a.ord, u))) continue;
    const traffar = tidigare.filter(s => s.fragor.some(f => star(a.ord, f)));
    if (!traffar.length) continue;
    const poang = traffar.length * 2 + (a.namn ? 1 : 0);
    if (!bast || poang > bast.poang) bast = { ...a, poang, sessioner: traffar.map(s => s.id) };
  }
  if (!bast) return null;
  return {
    amne: bast.visas,
    ord: bast.ord,
    antal: bast.sessioner.length,
    sessioner: bast.sessioner,
    instruktion: tx('pars.aterkommer.instruktion', { amne: bast.visas }),
  };
}

const BEVAKA = /(?<![\p{L}\d])(h[åa]ll(?:a)?\s+koll|h[åa]lla\s+ögonen|bevakning(?:ar|en|arna)?|bevaka|följa?\s+(?:nyheterna|utvecklingen|det\s+här|detta)|säg(?:a)?\s+till\s+(?:när|om|så\s+fort)|sålla|sortera|filtrera|plocka\s+ut|lyft(?:a)?\s+fram|meddela\s+mig|påminn(?:a)?\s+mig\s+om)(?![\p{L}\d])/iu;
const BEVAKA_EN = /(?<![\p{L}\d])(keep\s+(?:an\s+eye|eyes|tabs|watch)\s+on|keep\s+track\s+of|keep\s+me\s+(?:posted|updated)|watch\s+(?:for|out\s+for|over|this|that|it)|monitor(?:ing)?|track\s+(?:the\s+)?(?:news|developments|mentions)|follow\s+(?:the\s+news|developments|this|that)|stay\s+on\s+top\s+of|tell\s+me\s+as\s+soon\s+as|let\s+me\s+know\s+(?:when|as\s+soon\s+as)|notify\s+me|alert\s+me|remind\s+me\s+about)(?![\p{L}\d])/iu;
const SALLA_EN = /(?<![\p{L}\d])(sift(?:\s+through)?|filter|pick\s+out|highlight|flag)(?![\p{L}\d])/iu;
const bevakar = (t, medKalla = false) => BEVAKA.test(t) || BEVAKA_EN.test(t) || (medKalla && SALLA_EN.test(t));

export const KALLOR = [
  ['epost', /(?<![\p{L}\d])(inkorg\p{L}*|mejl\p{L}*|mail\p{L}*|e-?post\p{L}*|nyhetsbrev\p{L}*|inbox(?:es)?|e-?mails?|newsletters?)(?![\p{L}\d])/iu, 'pars.aterkommer.var.epost'],
  ['kalender', /(?<![\p{L}\d])(kalender\p{L}*|mina\s+möten|möten\s+jag|calendars?|my\s+meetings|meetings\s+I)(?![\p{L}\d])/iu, 'pars.aterkommer.var.kalender'],
  ['anteckningar', /(?<![\p{L}\d])(anteckning\p{L}*|my\s+notes|the\s+notes|notes\s+app)(?![\p{L}\d])/iu, 'pars.aterkommer.var.anteckningar'],
  ['meddelanden', /(?<![\p{L}\d])(sms\p{L}*|imessage\p{L}*|mina\s+meddelanden|meddelandena|text\s+messages|my\s+messages|my\s+texts)(?![\p{L}\d])/iu, 'pars.aterkommer.var.meddelanden'],
  ['paminnelser', /(?<![\p{L}\d])(påminnelse\p{L}*|reminders?|att\s*göra-lista\p{L}*|to-?do\s+list\p{L}*)(?![\p{L}\d])/iu, 'pars.aterkommer.var.paminnelser'],
  ['samtal', /(?<![\p{L}\d])(missade\s+samtal|samtalslista\p{L}*|vem\s+som\s+ringt|mina\s+samtal|missed\s+calls|call\s+(?:history|log)|who\s+(?:has\s+)?called|my\s+calls)(?![\p{L}\d])/iu, 'pars.aterkommer.var.samtal'],
  ['mapp', /(?<![\p{L}\d])(hämtade\s+filer|nedladdningar|min\s+mapp|mappen|dokumentmapp\p{L}*|skrivbordet|downloads(?:\s+folder)?|my\s+folder|the\s+folder|documents\s+folder|my\s+desktop)(?![\p{L}\d])/iu, 'pars.aterkommer.var.mapp'],
  ['alla', /(?<![\p{L}\d])(alla\s+mina\s+källor|allt\s+du\s+har\s+tillgång\s+till|överallt|alla\s+mina\s+appar|all\s+my\s+sources|everything\s+you\s+(?:have\s+access\s+to|can\s+(?:see|read))|everywhere|all\s+my\s+apps)(?![\p{L}\d])/iu, 'pars.aterkommer.var.alla'],
];

const SOKA = /(?<![\p{L}\d])(leta\s+(?:igenom|i|efter|upp|fram)|hitta|sök(?:a)?\s+(?:igenom|i|efter|fram)|gå\s+igenom|kolla\s+(?:igenom|i)|look\s+(?:through|for|in)|search\s+(?:through|for|in|my)|find|go\s+through|dig\s+through|check\s+(?:through|my|in)|scan)(?![\p{L}\d])/iu;

export function avsikt(text) {
  const t = String(text || '').replace(/^(>[^\n]*\n?)+/, '');
  const kallor = KALLOR.filter(([, re]) => re.test(t));
  const bevaka = bevakar(t, kallor.length > 0);
  if (!bevaka && !SOKA.test(t)) return null;
  if (!kallor.length) {
    if (!bevaka) return null;
    const begaran = /(?<![\p{L}\d])(sätt(?:a)?\s+upp|skapa|starta|lägg(?:a)?\s+(?:till|upp)|kan\s+(?:du|vi|jag|man)|vill\s+(?:jag|att\s+du|ha)|ska\s+vi|gör\s+en|set\s+up|create|start|add|can\s+(?:you|we|i)|could\s+you|i\s+want|i(?:'|’)?d\s+like|let(?:'|’)?s|make\s+a)(?![\p{L}\d])/iu.test(t);
    const m = /(?:koll\s+på|ögonen\s+på|bevaka)\s+(?:nyheter\s+om\s+|utvecklingen\s+(?:inom|av|kring)\s+|vad\s+som\s+händer\s+(?:inom|kring|med)\s+)?([^.,;!?\n]{3,70}?)(?=\s+(?:och\s+(?:sammanfatta|säg|skicka|lyft|ge)|varje|en\s+gång|varannan)\b|[.,;!?\n]|$)/iu.exec(t)
      || /(?:eye\s+on|eyes\s+on|tabs\s+on|watch\s+on|track\s+of|watch\s+for|watch(?=\s+(?:this|that|it)\b)|monitor|on\s+top\s+of|follow)\s+(?:the\s+)?(?:news\s+(?:about|on)\s+|developments\s+(?:in|on|around)\s+|what(?:'|’)?s\s+happening\s+(?:in|around|with)\s+)?([^.,;!?\n]{3,70}?)(?=\s+(?:and\s+(?:summarize|tell|send|highlight|give)|every|once|each)\b|[.,;!?\n]|$)/iu.exec(t);
    const amne = (m?.[1] || '').trim();
    if (amne.length < 3 || /^(det|detta|den|dem|honom|henne|saken|läget|det\s+här|it|this|that|them|him|her|the\s+situation|this\s+one)$/i.test(amne)) {
      return begaran || /^(det|detta|det\s+här|it|this|that)$/i.test(amne) ? { kallor: ['amne'], var: [tx('pars.aterkommer.var.webben')], amne: null, utanAmne: true } : null;
    }
    return { kallor: ['amne'], var: [tx('pars.aterkommer.var.webben')], amne };
  }
  const m = /(?:koll\s+på|ögonen\s+på|bevaka|sålla|sortera|filtrera|plocka\s+ut|lyfta?\s+fram|hitta|leta\s+(?:efter|upp|fram)|sök(?:a)?\s+efter)\s+([^.,;!?\n]{3,60}?)(?=\s+(?:som|i|när|och|så)\b|\s+från\s+(?:min|mina|mitt)\b|[.,;!?\n]|$)/iu.exec(t)
    || /(?:eye\s+on|eyes\s+on|tabs\s+on|track\s+of|watch\s+for|monitor|sift(?:\s+through)?|filter|pick\s+out|highlight|flag|find|look\s+for|search\s+for)\s+([^.,;!?\n]{3,60}?)(?=\s+(?:that|which|in|when|and|so|from|on)\b|[.,;!?\n]|$)/iu.exec(t);
  let amne = (m?.[1] || '').trim().replace(/^(alla|de|det|all|the|any)\s+/i, '');
  if (KALLOR.some(([, re]) => re.test(amne)) || /^min[at]?\b/i.test(amne) || /^my\b/i.test(amne)) amne = '';
  return { kallor: kallor.map(([k]) => k), var: kallor.map(([, , n]) => tx(n)), amne: amne || null,
    ...(bevaka ? {} : { engang: true }) };
}

export function amneUrBeskrivning(text, samtalet = '') {
  let t = String(text || '').replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '');
  t = t.replace(/^(?:ja,?\s*)?(?:h[åa]ll(?:a)?(?:\s+koll)?\s+på|bevaka|följ(?:a)?|kolla)\s+/iu, '')
    .replace(/^(?:nyheter|ämnen|saker|allt)\s+(?:som\s+(?:berör|rör|handlar\s+om|gäller)|om|kring|inom)\s+/iu, '')
    .replace(/^(?:yes,?\s*(?:please,?\s*)?)?(?:keep\s+(?:an\s+eye|tabs)\s+on|keep\s+track\s+of|watch(?:\s+for)?|monitor|follow|track|check)\s+/iu, '')
    .replace(/^(?:news|topics|things|anything|everything)\s+(?:that\s+(?:concerns?|touch(?:es)?\s+on|deals?\s+with|relates?\s+to)|related\s+to|regarding|about|on|around|within)\s+/iu, '');
  const rent = rentAmne(samtalet);
  if (rent) t = t.replace(/(?<![\p{L}\d])(detta|det\s+här|den\s+här\s+nyheten|nyheten|this\s+news(?:\s+item)?|this\s+story|the\s+news\s+item|this)(?![\p{L}\d])/giu, rent);
  if (/^(det|detta|det\s+här|den\s+här\s+nyheten|nyheten|this|that|it|this\s+news|this\s+story)$/i.test(t)) return null;
  return t.length >= 3 && t.length <= 160 && !/[[\]{}<>`]/.test(t) && rensaPakallande(t).antal === 0 ? t : null;
}

export function rentAmne(text) {
  const t = String(text || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/[\[\]{}<>"`|\\]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length < 3 || t.length > 80) return null;
  if (t.split(' ').length > 12 || /[!?;:]/.test(t)) return null;
  if (rensaPakallande(t).antal > 0) return null;
  if (/(?<![\p{L}\d])(ignore|ignorera|instruktion\p{L}*|instructions?|system\s*prompt|prompt|you\s+are|du\s+är\s+nu|skicka|send|mejla|e-?posta|radera|delete)(?![\p{L}\d])/iu.test(t)) return null;
  return t;
}
