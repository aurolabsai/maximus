/// Känner igen det som återkommer, och föreslår att agenten håller koll.
///
/// I VALV var agenten ett rum man gick till och skrev ett uppdrag i. Den som
/// inte visste att rummet fanns fick aldrig något uppdrag. Här föreslår
/// assistenten det mitt i samtalet, när det är relevant (PLAN-MAXIMUS Fas 11):
///
///   Du  Hur ser avtalsspärren ut för upphandlingen från Ekdal?
///   Maximus  [svar]
///            Det här har du frågat om förut. Vill du att jag säger till
///            när något nytt kommer om Ekdal?  [Ja] [Nej]
///
/// "Återkommer" mäts, det gissas inte: ett ämnesord ur frågan som också står
/// i en fråga i minst ett ANNAT av dina samtal. Ingen modell avgör det — en
/// modell som tycker att något "verkar återkommande" föreslår uppdrag om
/// allt, och ett förslag som kommer varje gång är ett förslag man lär sig
/// klicka bort.
///
/// Ämnesord är ord som inte är vanliga svenska ord. Listan är densamma som
/// maskeringen använder (data/vanliga-ord.txt, härledd ur lagtexterna) — en
/// egen lista här vore en lista till att hålla i takt.

import { VANLIGA } from './failclosed.mjs';
import { rensaPakallande } from './uppslag.mjs';
import { tx } from './sprakstod.mjs';

/// Ord som är vanliga i FRÅGOR men inte i lagtext, och därför inte står i
/// listan. Frågeorden och artighetsfraserna säger ingenting om ämnet.
const FRAGEORD = new Set(['vilket', 'vilken', 'vilka', 'varför', 'hurdan', 'snälla', 'tack',
  'gärna', 'skriv', 'svara', 'förklara', 'sammanfatta', 'berätta', 'hjälp', 'fråga', 'frågan',
  'svaret', 'kort', 'bara', 'något', 'någon', 'några', 'också', 'kanske', 'mening', 'meningar',
  'text', 'texten', 'mejl', 'mejlet', 'brev', 'brevet', 'idag', 'imorgon', 'igår']);

/// Engelska (fas 3, 2026-10-09): frågeord, artighet och vanliga ord på
/// fyra bokstäver eller fler, som inte säger något om ämnet. Läses alltid,
/// vid sidan av den svenska listan.
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

/// Ämnesorden i en text: `{ ord, visas, namn }`. `ord` är jämförelseformen
/// (gemener), `visas` som det skrevs, `namn` om det skrevs med versal mitt i
/// en mening — ett egennamn, en organisation, en förkortning.
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

/// Står ordet i texten? Början av ett ord räcker — "Ekdals" är Ekdal, och
/// "upphandlingen" är upphandling.
const star = (ord, text) => new RegExp(`(^|[^\\p{L}])${ord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(text);

/// Ett förslag, eller null.
///
/// `tidigare` är dina ANDRA samtal som `{ id, fragor: [text] }` — aldrig ett
/// låst, förseglat eller glömt (det väljer anroparen). `uppdrag` är
/// instruktionerna som redan finns, `avbojt` de ämnen du sagt nej till.
/// Förslaget gäller ämnet med flest andra samtal; vid lika vinner ett namn.
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

// ── Ett uppdrag i dina egna ord ───────────────────────────────────────────
//
// "Vill nog hålla koll på AI-nyheter som droppar in i min inkorg hela
// tiden. Sålla, sortera, utifrån det som är relevant för mig och min roll."
// Det är inte en fråga, det är ett uppdrag. Den gick ut på webben, eftersom
// "nyheter" lät som något färskt, och Maximus läste elevenlabs.io medan
// inkorgen låg orörd (Auro 2026-10-04).
//
// Två saker måste stå: en bevakning (håll koll, sålla, säg till när …) och
// en av dina EGNA källor (inkorgen, kalendern, anteckningarna). Bara det
// ena är inte nog — "håll koll på räntan" är ingen inkorg, och "vad står i
// min inkorg" ber inte om någon bevakning.

const BEVAKA = /(?<![\p{L}\d])(h[åa]ll(?:a)?\s+koll|h[åa]lla\s+ögonen|bevakning(?:ar|en|arna)?|bevaka|följa?\s+(?:nyheterna|utvecklingen|det\s+här|detta)|säg(?:a)?\s+till\s+(?:när|om|så\s+fort)|sålla|sortera|filtrera|plocka\s+ut|lyft(?:a)?\s+fram|meddela\s+mig|påminn(?:a)?\s+mig\s+om)(?![\p{L}\d])/iu;
// Engelska, alltid vid sidan av svenskan (fas 3, 2026-10-09). "watch" och
// "track" ensamma är för vanliga ("watch a film", "track my order"); de
// räknas med ett ord efter som gör dem till en bevakning.
const BEVAKA_EN = /(?<![\p{L}\d])(keep\s+(?:an\s+eye|eyes|tabs|watch)\s+on|keep\s+track\s+of|keep\s+me\s+(?:posted|updated)|watch\s+(?:for|out\s+for|over|this|that|it)|monitor(?:ing)?|track\s+(?:the\s+)?(?:news|developments|mentions)|follow\s+(?:the\s+news|developments|this|that)|stay\s+on\s+top\s+of|tell\s+me\s+as\s+soon\s+as|let\s+me\s+know\s+(?:when|as\s+soon\s+as)|notify\s+me|alert\s+me|remind\s+me\s+about)(?![\p{L}\d])/iu;
// Sålla och sortera på engelska räknas bara när en egen källa står med:
// "filter this list" är ingen bevakning, "filter my inbox for AI news" är det.
const SALLA_EN = /(?<![\p{L}\d])(sift(?:\s+through)?|filter|pick\s+out|highlight|flag)(?![\p{L}\d])/iu;
const bevakar = (t, medKalla = false) => BEVAKA.test(t) || BEVAKA_EN.test(t) || (medKalla && SALLA_EN.test(t));

// Källorna: id, mönster (svenska och engelska), och nyckeln till namnet som
// visas ("inkorgen" / "your inbox") — läst när det behövs, på ditt språk.
export const KALLOR = [
  ['epost', /(?<![\p{L}\d])(inkorg\p{L}*|mejl\p{L}*|mail\p{L}*|e-?post\p{L}*|nyhetsbrev\p{L}*|inbox(?:es)?|e-?mails?|newsletters?)(?![\p{L}\d])/iu, 'pars.aterkommer.var.epost'],
  ['kalender', /(?<![\p{L}\d])(kalender\p{L}*|mina\s+möten|möten\s+jag|calendars?|my\s+meetings|meetings\s+I)(?![\p{L}\d])/iu, 'pars.aterkommer.var.kalender'],
  ['anteckningar', /(?<![\p{L}\d])(anteckning\p{L}*|my\s+notes|the\s+notes|notes\s+app)(?![\p{L}\d])/iu, 'pars.aterkommer.var.anteckningar'],
  ['meddelanden', /(?<![\p{L}\d])(sms\p{L}*|imessage\p{L}*|mina\s+meddelanden|meddelandena|text\s+messages|my\s+messages|my\s+texts)(?![\p{L}\d])/iu, 'pars.aterkommer.var.meddelanden'],
  ['paminnelser', /(?<![\p{L}\d])(påminnelse\p{L}*|reminders?|att\s*göra-lista\p{L}*|to-?do\s+list\p{L}*)(?![\p{L}\d])/iu, 'pars.aterkommer.var.paminnelser'],
  ['samtal', /(?<![\p{L}\d])(missade\s+samtal|samtalslista\p{L}*|vem\s+som\s+ringt|mina\s+samtal|missed\s+calls|call\s+(?:history|log)|who\s+(?:has\s+)?called|my\s+calls)(?![\p{L}\d])/iu, 'pars.aterkommer.var.samtal'],
  ['mapp', /(?<![\p{L}\d])(hämtade\s+filer|nedladdningar|min\s+mapp|mappen|dokumentmapp\p{L}*|skrivbordet|downloads(?:\s+folder)?|my\s+folder|the\s+folder|documents\s+folder|my\s+desktop)(?![\p{L}\d])/iu, 'pars.aterkommer.var.mapp'],
  // Allt du gett lov till (Fas 35). Ja-vägen byter "alla" mot källorna.
  ['alla', /(?<![\p{L}\d])(alla\s+mina\s+källor|allt\s+du\s+har\s+tillgång\s+till|överallt|alla\s+mina\s+appar|all\s+my\s+sources|everything\s+you\s+(?:have\s+access\s+to|can\s+(?:see|read))|everywhere|all\s+my\s+apps)(?![\p{L}\d])/iu, 'pars.aterkommer.var.alla'],
];

/// Ber texten om ett uppdrag i dina egna källor? Ger källorna och ett ämne,
/// eller null.
/// En sökning en gång: "leta igenom min inkorg och hitta …".
const SOKA = /(?<![\p{L}\d])(leta\s+(?:igenom|i|efter|upp|fram)|hitta|sök(?:a)?\s+(?:igenom|i|efter|fram)|gå\s+igenom|kolla\s+(?:igenom|i)|look\s+(?:through|for|in)|search\s+(?:through|for|in|my)|find|go\s+through|dig\s+through|check\s+(?:through|my|in)|scan)(?![\p{L}\d])/iu;

export function avsikt(text) {
  const t = String(text || '').replace(/^(>[^\n]*\n?)+/, '');
  const kallor = KALLOR.filter(([, re]) => re.test(t));
  const bevaka = bevakar(t, kallor.length > 0);
  if (!bevaka && !SOKA.test(t)) return null;
  // Ingen egen källa men ett ämne att bevaka: "håll koll på AI i offentlig
  // sektor". Då letar agenten själv upp källorna på webben (Fas 29).
  if (!kallor.length) {
    if (!bevaka) return null;
    // "Kan vi sätta upp en bevakning?" — en begäran utan ämne (Fas 52, sett
    // 2026-10-06 i ett samtal ur en nyhet: assistenten sa ja, inget kort
    // kom). Ämnet är då samtalets; servern fyller i det.
    const begaran = /(?<![\p{L}\d])(sätt(?:a)?\s+upp|skapa|starta|lägg(?:a)?\s+(?:till|upp)|kan\s+(?:du|vi|jag|man)|vill\s+(?:jag|att\s+du|ha)|ska\s+vi|gör\s+en|set\s+up|create|start|add|can\s+(?:you|we|i)|could\s+you|i\s+want|i(?:'|’)?d\s+like|let(?:'|’)?s|make\s+a)(?![\p{L}\d])/iu.test(t);
    const m = /(?:koll\s+på|ögonen\s+på|bevaka)\s+(?:nyheter\s+om\s+|utvecklingen\s+(?:inom|av|kring)\s+|vad\s+som\s+händer\s+(?:inom|kring|med)\s+)?([^.,;!?\n]{3,70}?)(?=\s+(?:och\s+(?:sammanfatta|säg|skicka|lyft|ge)|varje|en\s+gång|varannan)\b|[.,;!?\n]|$)/iu.exec(t)
      || /(?:eye\s+on|eyes\s+on|tabs\s+on|watch\s+on|track\s+of|watch\s+for|watch(?=\s+(?:this|that|it)\b)|monitor|on\s+top\s+of|follow)\s+(?:the\s+)?(?:news\s+(?:about|on)\s+|developments\s+(?:in|on|around)\s+|what(?:'|’)?s\s+happening\s+(?:in|around|with)\s+)?([^.,;!?\n]{3,70}?)(?=\s+(?:and\s+(?:summarize|tell|send|highlight|give)|every|once|each)\b|[.,;!?\n]|$)/iu.exec(t);
    const amne = (m?.[1] || '').trim();
    if (amne.length < 3 || /^(det|detta|den|dem|honom|henne|saken|läget|det\s+här|it|this|that|them|him|her|the\s+situation|this\s+one)$/i.test(amne)) {
      return begaran || /^(det|detta|det\s+här|it|this|that)$/i.test(amne) ? { kallor: ['amne'], var: [tx('pars.aterkommer.var.webben')], amne: null, utanAmne: true } : null;
    }
    return { kallor: ['amne'], var: [tx('pars.aterkommer.var.webben')], amne };
  }
  // Ämnet: det som står efter "koll på" / "bevaka" fram till nästa bisats.
  const m = /(?:koll\s+på|ögonen\s+på|bevaka|sålla|sortera|filtrera|plocka\s+ut|lyfta?\s+fram|hitta|leta\s+(?:efter|upp|fram)|sök(?:a)?\s+efter)\s+([^.,;!?\n]{3,60}?)(?=\s+(?:som|i|när|och|så)\b|\s+från\s+(?:min|mina|mitt)\b|[.,;!?\n]|$)/iu.exec(t)
    || /(?:eye\s+on|eyes\s+on|tabs\s+on|track\s+of|watch\s+for|monitor|sift(?:\s+through)?|filter|pick\s+out|highlight|flag|find|look\s+for|search\s+for)\s+([^.,;!?\n]{3,60}?)(?=\s+(?:that|which|in|when|and|so|from|on)\b|[.,;!?\n]|$)/iu.exec(t);
  let amne = (m?.[1] || '').trim().replace(/^(alla|de|det|all|the|any)\s+/i, '');
  // "Sortera mina mejl efter …" har inget ämne, bara källan.
  if (KALLOR.some(([, re]) => re.test(amne)) || /^min[at]?\b/i.test(amne) || /^my\b/i.test(amne)) amne = '';
  // Bevakar den, eller letar den en gång? "Håll koll" är en bevakning även
  // om "hitta" också står där.
  return { kallor: kallor.map(([k]) => k), var: kallor.map(([, , n]) => tx(n)), amne: amne || null,
    ...(bevaka ? {} : { engang: true }) };
}

/// Ett svar på "vad ska jag hålla koll på?" som ämne (Fas 52). "detta" och
/// "det här" är samtalets ämne; inledningen ("håll koll på ämnen som berör")
/// skalas bort. Sett 2026-10-06: "Håll på ämnen som berör detta och
/// datasäkerhet inom såväl EU som Sverige".
export function amneUrBeskrivning(text, samtalet = '') {
  let t = String(text || '').replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '');
  t = t.replace(/^(?:ja,?\s*)?(?:h[åa]ll(?:a)?(?:\s+koll)?\s+på|bevaka|följ(?:a)?|kolla)\s+/iu, '')
    .replace(/^(?:nyheter|ämnen|saker|allt)\s+(?:som\s+(?:berör|rör|handlar\s+om|gäller)|om|kring|inom)\s+/iu, '')
    // Engelska: "yes, keep an eye on topics related to this and data security".
    .replace(/^(?:yes,?\s*(?:please,?\s*)?)?(?:keep\s+(?:an\s+eye|tabs)\s+on|keep\s+track\s+of|watch(?:\s+for)?|monitor|follow|track|check)\s+/iu, '')
    .replace(/^(?:news|topics|things|anything|everything)\s+(?:that\s+(?:concerns?|touch(?:es)?\s+on|deals?\s+with|relates?\s+to)|related\s+to|regarding|about|on|around|within)\s+/iu, '');
  const rent = rentAmne(samtalet);
  if (rent) t = t.replace(/(?<![\p{L}\d])(detta|det\s+här|den\s+här\s+nyheten|nyheten|this\s+news(?:\s+item)?|this\s+story|the\s+news\s+item|this)(?![\p{L}\d])/giu, rent);
  // Ett pronomen som inte gick att byta ut är inget ämne.
  if (/^(det|detta|det\s+här|den\s+här\s+nyheten|nyheten|this|that|it|this\s+news|this\s+story)$/i.test(t)) return null;
  // Det färdiga ämnet prövas som helhet — inte bara titeln det byggdes av.
  return t.length >= 3 && t.length <= 160 && !/[[\]{}<>`]/.test(t) && rensaPakallande(t).antal === 0 ? t : null;
}

/// Ett ämne som kommer ur något modellen eller en främmande sida skrivit —
/// samtalets titel, en nyhets rubrik — blir ett agentuppdrag och en sökfråga
/// (säkerhetsgranskningen 2026-10-06). Det får bara vara ett ämne: en rad,
/// högst 80 tecken, inga klamrar eller citattecken, och ingenting som
/// stängslet läser som ett försök att styra modellen. Annars inget ämne.
export function rentAmne(text) {
  const t = String(text || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/[\[\]{}<>"`|\\]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length < 3 || t.length > 80) return null;
  // Ett ämne är några ord, inte en mening med uppmaningar i.
  if (t.split(' ').length > 12 || /[!?;:]/.test(t)) return null;
  if (rensaPakallande(t).antal > 0) return null;
  if (/(?<![\p{L}\d])(ignore|ignorera|instruktion\p{L}*|instructions?|system\s*prompt|prompt|you\s+are|du\s+är\s+nu|skicka|send|mejla|e-?posta|radera|delete)(?![\p{L}\d])/iu.test(t)) return null;
  return t;
}
