import { rensaOsynliga } from './failclosed.mjs';

const MASKERA = /^(?:maskera|maska|pseudonymisera|mask|redact|pseudonymi[sz]e)$/iu;
const ANONYMISERA = /^(?:anonymisera|avidentifiera|anonymi[sz]e|de-?identify)$/iu;
const VERB = '(maskera|maska|pseudonymisera|anonymisera|avidentifiera|mask|redact|pseudonymi[sz]e|anonymi[sz]e|de-?identify)';

const INLEDNING = '(?:(?:snälla|kan\\s+du|kan\\s+ni|skulle\\s+du\\s+kunna|vill\\s+du|jag\\s+vill\\s+att\\s+du|jag\\s+vill|jag\\s+skulle\\s+vilja\\s+att\\s+du|hjälp\\s+mig(?:\\s+att)?|kan\\s+vi|nu|ok(?:ej)?|och|please|pls|can\\s+you|could\\s+you|would\\s+you|will\\s+you|i\\s+want\\s+you\\s+to|i(?:\'|’)?d\\s+like\\s+you\\s+to|i\\s+want\\s+to|help\\s+me|kindly|now|and)[,\\s]+)*';

const BEGARAN = new RegExp(`^\\s*${INLEDNING}${VERB}(?:\\s*(?:,|och|and|&|/|samt|eller|or|plus|\\+)\\s*${VERB})?(?![\\p{L}\\d-])(.*)$`, 'isu');

const PEKAR = /(?<![\p{L}])(text\p{L}*|det\s+här|den\s+här|de\s+här|detta|denna|dessa|det|den|dem|bilag\p{L}*|dokument\p{L}*|fil(?:en|erna|er)?|pdf\p{L}*|mejl\p{L}*|mail\p{L}*|e-?post\p{L}*|brev\p{L}*|meddelande\p{L}*|svar\p{L}*|stycke\p{L}*|avsnitt\p{L}*|ovan|ovanför|nedan|inklistr\p{L}*|citat\p{L}*|protokoll\p{L}*|anteckning\p{L}*|utkast\p{L}*|this|that|these|it|attachment\p{L}*|attached|documents?|files?|emails?|e-mails?|letters?|messages?|answers?|repl(?:y|ies)|responses?|paragraphs?|above|below|pasted|quoted?|notes?|drafts?|minutes)(?![\p{L}])/iu;

const SVARET = /(?<![\p{L}])(svar\p{L}*|answers?|repl(?:y|ies)|responses?)(?![\p{L}])/iu;
const BILAGAN = /(?<![\p{L}])(bilag\p{L}*|dokument\p{L}*|fil(?:en|erna|er)?|pdf\p{L}*|attachment\p{L}*|attached|documents?|files?)(?![\p{L}])/iu;
const TIDIGARE = /(?<![\p{L}])(ovan|ovanför|förra|föregående|tidigare|senaste|mejl\p{L}*|mail\p{L}*|e-?post\p{L}*|brev\p{L}*|meddelande\p{L}*|inklistr\p{L}*|above|previous|earlier|last|emails?|e-mails?|letters?|messages?|pasted)(?![\p{L}])/iu;

const TAK_INSTRUKTION = 140;

const OM_ORDET = /^(?:är|var|blir|betyder|innebär|används|fungerar|funkar|kan\s+(?:betyda|innebära)|is|was|are|means|meant|works|refers)(?![\p{L}])/iu;

const pekarTidigt = instruktion => {
  const m = PEKAR.exec(instruktion);
  return Boolean(m) && m.index <= 40;
};

export function avsikt(text_) {
  const hel = rensaOsynliga(String(text_ || '')).replace(/\r\n?/g, '\n');
  const citat = /^((?:>[^\n]*\n?)+)/.exec(hel);
  const efterCitat = citat ? hel.slice(citat[1].length) : hel;
  const m = BEGARAN.exec(efterCitat);
  if (!m) return null;
  const [, v1, v2, rest = ''] = m;
  const verb = [v1, v2].filter(Boolean);
  const maskera = verb.some(v => MASKERA.test(v));
  const anonymisera = verb.some(v => ANONYMISERA.test(v));
  const gor = maskera && anonymisera ? 'bada' : anonymisera ? 'anonymisera' : 'maskera';

  const sep = /[:\n]/.exec(rest);
  const instruktion = (sep ? rest.slice(0, sep.index) : rest).trim();
  if (instruktion.length > TAK_INSTRUKTION) return null;
  const inklistrad = sep ? rest.slice(sep.index + 1).trim() : '';
  const ensamt = !instruktion.replace(/[\s.!?…,;-]+/g, '');
  if (OM_ORDET.test(instruktion)) return null;
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

const vanlig = t => t && !t.maskning;

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
  return bilagan() || fragan();
}

export const sortAv = platshallare => String(platshallare || '').replace(/^\[|\]$/g, '').trim()
  .split(/\s+/).slice(0, -1).join(' ') || String(platshallare || '');

export function kartanI(text, karta = []) {
  const t = String(text || '');
  const lista = Array.isArray(karta) ? karta
    : [...karta].map(([original, platshallare]) => ({ original, platshallare }));
  return lista.filter(k => k.platshallare && t.includes(k.platshallare))
    .map(k => ({ platshallare: k.platshallare, original: k.original }))
    .sort((a, b) => a.platshallare.localeCompare(b.platshallare, 'sv'));
}

export function perSort(text, karta = []) {
  const n = new Map();
  for (const k of kartanI(text, karta)) n.set(sortAv(k.platshallare), (n.get(sortAv(k.platshallare)) || 0) + 1);
  return [...n].map(([sort, antal]) => ({ sort, antal }))
    .sort((a, b) => b.antal - a.antal || a.sort.localeCompare(b.sort, 'sv'));
}
