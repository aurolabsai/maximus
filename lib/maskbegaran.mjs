/// Be assistenten maskera och/eller anonymisera en text.
///
/// Auro 2026-10-10: "jobbar vi mot lokal modell = onödigt, det ska alltid
/// vara av. Däremot ska vi kunna skriva och BE assistenten i en session att
/// maskera och/eller anonymisera en text."
///
/// Valet i skrivfältet svarar på vad som händer med det som GÅR UT. Det här
/// svarar på något annat: du har en text och vill ha den maskerad, för att ta
/// med dig. "Maskera den här texten: …", "anonymisera bilagan", "mask this",
/// "anonymize your last answer".
///
/// Reglerna först, på båda språken, som uppdragsavsikten i lib/aterkommer.mjs:
/// en begäran börjar med verbet (eller en artig inledning och verbet), och
/// pekar på en text. "Hur fungerar maskeringen?" och "Mask is required in
/// hospitals" är inga begäranden. Ingen modell avgör det — en modell som
/// gissar fel här skickar en fråga till fel väg, och det ska inte bero på en
/// gissning.
///
/// Arbetet görs av det som redan finns, och lokalt: maskeringen är
/// forbered() i lib/kedja.mjs (reglerna och namnmodellen, med det du valt
/// under "Vad som döljs"), anonymiseringen är omskrivningen styckevis som
/// bilagorna redan har (server.mjs, anonymiseraStycken). Den här modulen
/// känner igen begäran, väljer texten och räknar resultatet.
import { rensaOsynliga } from './failclosed.mjs';

// ── Begäran ──────────────────────────────────────────────────────────────

/// Verben, och vad de betyder. Maskera byter det som pekar ut någon direkt
/// mot platshållare; anonymisera skriver dessutom om det som pekar ut ändå.
const MASKERA = /^(?:maskera|maska|pseudonymisera|mask|redact|pseudonymi[sz]e)$/iu;
const ANONYMISERA = /^(?:anonymisera|avidentifiera|anonymi[sz]e|de-?identify)$/iu;
const VERB = '(maskera|maska|pseudonymisera|anonymisera|avidentifiera|mask|redact|pseudonymi[sz]e|anonymi[sz]e|de-?identify)';

/// Artiga inledningar som får stå före verbet: "kan du snälla", "please",
/// "jag vill att du". Bara inledningar — står verbet mitt i en mening är det
/// en mening om maskering, inte en begäran.
const INLEDNING = '(?:(?:snälla|kan\\s+du|kan\\s+ni|skulle\\s+du\\s+kunna|vill\\s+du|jag\\s+vill\\s+att\\s+du|jag\\s+vill|jag\\s+skulle\\s+vilja\\s+att\\s+du|hjälp\\s+mig(?:\\s+att)?|kan\\s+vi|nu|ok(?:ej)?|och|please|pls|can\\s+you|could\\s+you|would\\s+you|will\\s+you|i\\s+want\\s+you\\s+to|i(?:\'|’)?d\\s+like\\s+you\\s+to|i\\s+want\\s+to|help\\s+me|kindly|now|and)[,\\s]+)*';

const BEGARAN = new RegExp(`^\\s*${INLEDNING}${VERB}(?:\\s*(?:,|och|and|&|/|samt|eller|or|plus|\\+)\\s*${VERB})?(?![\\p{L}\\d-])(.*)$`, 'isu');

/// Ord som pekar på en text. Står verbet ensamt ("maskera!") räcker det;
/// står något annat efter verbet måste det peka på en text, annars är det en
/// mening som råkar börja med ett verb ("Mask is required in hospitals").
const PEKAR = /(?<![\p{L}])(text\p{L}*|det\s+här|den\s+här|de\s+här|detta|denna|dessa|det|den|dem|bilag\p{L}*|dokument\p{L}*|fil(?:en|erna|er)?|pdf\p{L}*|mejl\p{L}*|mail\p{L}*|e-?post\p{L}*|brev\p{L}*|meddelande\p{L}*|svar\p{L}*|stycke\p{L}*|avsnitt\p{L}*|ovan|ovanför|nedan|inklistr\p{L}*|citat\p{L}*|protokoll\p{L}*|anteckning\p{L}*|utkast\p{L}*|this|that|these|it|attachment\p{L}*|attached|documents?|files?|emails?|e-mails?|letters?|messages?|answers?|repl(?:y|ies)|responses?|paragraphs?|above|below|pasted|quoted?|notes?|drafts?|minutes)(?![\p{L}])/iu;

/// Vilken text det gäller, ur orden. Svaret går först: "mejlet i ditt förra
/// svar" gäller svaret. Bilagan sedan, och sist det du skrev tidigare.
const SVARET = /(?<![\p{L}])(svar\p{L}*|answers?|repl(?:y|ies)|responses?)(?![\p{L}])/iu;
const BILAGAN = /(?<![\p{L}])(bilag\p{L}*|dokument\p{L}*|fil(?:en|erna|er)?|pdf\p{L}*|attachment\p{L}*|attached|documents?|files?)(?![\p{L}])/iu;
const TIDIGARE = /(?<![\p{L}])(ovan|ovanför|förra|föregående|tidigare|senaste|mejl\p{L}*|mail\p{L}*|e-?post\p{L}*|brev\p{L}*|meddelande\p{L}*|inklistr\p{L}*|above|previous|earlier|last|emails?|e-mails?|letters?|messages?|pasted)(?![\p{L}])/iu;

/// Instruktionen före texten får vara kort. En lång mening som börjar med
/// "maskera" är något annat än en begäran.
const TAK_INSTRUKTION = 140;

/// Verbet som subjekt i en mening om ordet: "Anonymisera är ett verb …",
/// "Mask is required …". Då är det inte en begäran, vad som än följer.
const OM_ORDET = /^(?:är|var|blir|betyder|innebär|används|fungerar|funkar|kan\s+(?:betyda|innebära)|is|was|are|means|meant|works|refers)(?![\p{L}])/iu;

/// Ordet som pekar på texten står tidigt: "maskera [det här]", "anonymize
/// [the attached document]". Längre bort är det en annan sorts mening.
const pekarTidigt = instruktion => {
  const m = PEKAR.exec(instruktion);
  return Boolean(m) && m.index <= 40;
};

/// Ber texten om maskering eller anonymisering? Ger vad, vilken text och
/// den inklistrade texten om den står efter ett kolon eller en radbrytning —
/// annars null.
///
/// `gor`: 'maskera', 'anonymisera' eller 'bada'. Anonymiseringen görs alltid
/// på den maskerade texten (den lokala modellen ser aldrig namnen), så
/// 'bada' och 'anonymisera' gör samma arbete; skillnaden är vad du bad om,
/// och det ska svaret säga.
///
/// `kalla`: 'text' (inklistrad), 'citat' (det du markerat och citerat),
/// 'svar', 'bilaga', 'fraga' (det du skrev tidigare) eller null (välj själv).
export function avsikt(text_) {
  const hel = rensaOsynliga(String(text_ || '')).replace(/\r\n?/g, '\n');
  // Ett citat står först, som rader med ">" (markera i ett svar → Citera).
  // Det är texten, och begäran står efter den.
  const citat = /^((?:>[^\n]*\n?)+)/.exec(hel);
  const efterCitat = citat ? hel.slice(citat[1].length) : hel;
  const m = BEGARAN.exec(efterCitat);
  if (!m) return null;
  const [, v1, v2, rest = ''] = m;
  const verb = [v1, v2].filter(Boolean);
  const maskera = verb.some(v => MASKERA.test(v));
  const anonymisera = verb.some(v => ANONYMISERA.test(v));
  const gor = maskera && anonymisera ? 'bada' : anonymisera ? 'anonymisera' : 'maskera';

  // Texten efter första kolonet eller radbrytningen, om instruktionen före
  // den är kort.
  const sep = /[:\n]/.exec(rest);
  const instruktion = (sep ? rest.slice(0, sep.index) : rest).trim();
  if (instruktion.length > TAK_INSTRUKTION) return null;
  const inklistrad = sep ? rest.slice(sep.index + 1).trim() : '';
  const ensamt = !instruktion.replace(/[\s.!?…,;-]+/g, '');
  if (OM_ORDET.test(instruktion)) return null;
  // Utan inklistrad text måste instruktionen peka på en text eller vara tom;
  // med en inklistrad text också — "Mask: på" i en mening om något annat
  // är ingen begäran.
  if (!ensamt && !pekarTidigt(instruktion)) return null;

  const kalla = inklistrad ? 'text'
    : citat ? 'citat'
      : SVARET.test(instruktion) ? 'svar'
        : BILAGAN.test(instruktion) ? 'bilaga'
          : TIDIGARE.test(instruktion) ? 'fraga'
            : null;
  return {
    gor, kalla, instruktion,
    text: kalla === 'text' ? inklistrad : kalla === 'citat' ? citat[1].replace(/^>\s?/gm, '').trim() : null,
  };
}

// ── Vilken text ──────────────────────────────────────────────────────────

/// En tur som själv är ett maskeringsresultat räknas inte som "det förra":
/// "anonymisera ditt förra svar" efter en maskering gäller svaret före.
const vanlig = t => t && !t.maskning;

/// Texten begäran gäller, ur samtalet. `turer` är samtalets turer FÖRE den
/// här begäran; `filer` är sessionens bilagor.
///
/// Ger `{ kalla, text, namn?, fil? }`, eller null när ingenting finns att
/// maskera — då frågar svaret vilken text det gäller.
export function valjText(a, { turer = [], filer = [] } = {}) {
  if (!a) return null;
  if (a.text) return { kalla: a.kalla, text: a.text };
  const svaret = () => {
    const t = [...turer].reverse().find(x => vanlig(x) && x.status === 'klar' && String(x.svar || '').trim());
    return t ? { kalla: 'svar', text: String(t.svar), tur: t.id } : null;
  };
  const fragan = () => {
    const t = [...turer].reverse().find(x => vanlig(x) && x.av !== 'maximus' && x.av !== 'agent' && String(x.fraga || '').trim());
    return t ? { kalla: 'fraga', text: String(t.fraga), tur: t.id } : null;
  };
  const bilagan = () => {
    const lasbara = filer.filter(f => String(f.original || f.maskerad || '').trim());
    if (!lasbara.length) return null;
    // Namngiven i begäran? "anonymisera rapport.pdf" eller "bilagan avtal".
    const ord = String(a.instruktion || '').toLowerCase();
    const namngiven = lasbara.find(f => {
      const namn = String(f.namn || '').toLowerCase();
      const stam = namn.replace(/\.[^.]+$/, '');
      return (namn && ord.includes(namn)) || (stam.length >= 3 && ord.includes(stam));
    });
    const f = namngiven || lasbara[lasbara.length - 1];
    return { kalla: 'bilaga', text: String(f.original || f.maskerad), namn: f.namn, fil: f.id };
  };
  if (a.kalla === 'svar') return svaret();
  if (a.kalla === 'bilaga') return bilagan();
  if (a.kalla === 'fraga') return fragan();
  // Inget pekade ut någon text: bilagan om det finns en, annars det du
  // skrev senast. Svaret väljs bara när du ber om det — det är Maximus text,
  // inte din.
  return bilagan() || fragan();
}

// ── Resultatet ───────────────────────────────────────────────────────────

/// Sorten i en platshållare: "[NAMN A]" → "NAMN", "[PERSONNUMMER B]" →
/// "PERSONNUMMER". Det sista ordet är bokstaven.
export const sortAv = platshallare => String(platshallare || '').replace(/^\[|\]$/g, '').trim()
  .split(/\s+/).slice(0, -1).join(' ') || String(platshallare || '');

/// Kartans poster som står i texten — och bara de. Sessionens karta bär hela
/// samtalets personer; den här texten ska visa sina egna.
export function kartanI(text, karta = []) {
  const t = String(text || '');
  const lista = Array.isArray(karta) ? karta
    : [...karta].map(([original, platshallare]) => ({ original, platshallare }));
  return lista.filter(k => k.platshallare && t.includes(k.platshallare))
    .map(k => ({ platshallare: k.platshallare, original: k.original }))
    .sort((a, b) => a.platshallare.localeCompare(b.platshallare, 'sv'));
}

/// Antal ersatta uppgifter per sort, flest först. Räknas ur kartan — inte ur
/// hakparenteser i texten, som du kan ha skrivit själv.
export function perSort(text, karta = []) {
  const n = new Map();
  for (const k of kartanI(text, karta)) n.set(sortAv(k.platshallare), (n.get(sortAv(k.platshallare)) || 0) + 1);
  return [...n].map(([sort, antal]) => ({ sort, antal }))
    .sort((a, b) => b.antal - a.antal || a.sort.localeCompare(b.sort, 'sv'));
}
