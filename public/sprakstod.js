// Språkstödet i webbläsaren (2026-10-09). Samma regler som lib/sprakstod.mjs:
// servern avgör språket (ditt val, annars datorns, annars det närmaste) och
// säger det i /api/uppstart; här läses texterna och sätts in.
//
//   import { t, laddaSprak } from './sprakstod.js';
//   await laddaSprak('en');
//   t('allmant.tillbaka')            → "Back"
//   t('agent.fynd', { n: 3 })        → "3 things to look at"
//
// En nyckel som saknas faller tillbaka på svenskan. Svenskan laddas alltid.
//
// Importeras relativt ('./sprakstod.js') från md.js och fragor.js, som också
// körs i proven under Node. Inget här rör `document` förrän det anropas.

let kod = 'sv';
const lexikon = { sv: {} };

export async function laddaSprak(onskat = 'sv') {
  const hamta = async k => { try { const r = await fetch(`/sprak/${k}.json`); return r.ok ? await r.json() : {}; } catch { return {}; } };
  lexikon.sv = await hamta('sv');
  if (onskat !== 'sv') lexikon[onskat] = await hamta(onskat);
  kod = onskat;
  document.documentElement.lang = kod;
  return kod;
}

/// Texterna utan nätet: för proven, som läser public/sprak/<kod>.json själva.
export function fyllSprak(k, texter) {
  lexikon[k] = { ...texter };
  kod = k;
}

export const sprak = () => kod;

const forma = (v, varden) => {
  const mall = v && typeof v === 'object' ? (Number(varden.n) === 1 ? v.en ?? v.flera : v.flera ?? v.en) : v;
  return String(mall).replace(/\{(\w+)\}/g, (m, k) => (k in varden ? String(varden[k]) : m));
};

/// Texten, eller `reserv` om ingen av ordlistorna har nyckeln.
const slaUpp = (nyckel, varden, reserv) => {
  const v = lexikon[kod]?.[nyckel] ?? lexikon.sv[nyckel];
  return v == null ? reserv : forma(v, varden);
};

export function t(nyckel, varden = {}) {
  return slaUpp(nyckel, varden, nyckel);
}

/// Texten på svenska, oavsett valt språk. För det servern fortfarande skriver
/// på svenska och som koden jämför mot (stegens namn i serverns stegtext).
export function svenska(nyckel, varden = {}) {
  const v = lexikon.sv[nyckel];
  return v == null ? nyckel : forma(v, varden);
}

/// Datum och tal på språkets sätt: sv-SE eller en-US (ordlistan: amerikansk engelska).
export const lokal = () => (kod === 'sv' ? 'sv-SE' : kod === 'en' ? 'en-US' : kod);

// ── Sidan ────────────────────────────────────────────────────────────────
//
// Det fasta i index.html bär sina nycklar som attribut, och svenskan står
// kvar i html:en som reserv:
//
//   data-i18n="nyckel"            elementets egen text — den första textnoden.
//                                 Barnen står kvar: <label>Text <select>…</label>
//                                 och <span>Rad<i>hjälptext</i></span> byter
//                                 bara sin egen text.
//   data-i18n-html="nyckel"       hela innehållet, för text med <b> i. Bara
//                                 våra egna ordlistor, aldrig något inläst.
//   data-i18n-attr="title:a; aria-label:b"   attribut, ett par per nyckel.
//   data-i18n-n="3"               värdet för {n} (plural och siffror).
//
// Det app.js själv skriver i ett element (läget, "Av."/"På." och liknande)
// har ingen markering: det skulle annars skrivas över vid språkbyte.

/// Svenskan i html:en, sparad första gången. Saknas en nyckel i ordlistorna
/// står originalet kvar — aldrig nyckeln.
const ursprung = new WeakMap();
const MARKT = '[data-i18n],[data-i18n-html],[data-i18n-attr]';

export function oversattSidan(rot = document) {
  const lista = [...(rot.matches?.(MARKT) ? [rot] : []), ...rot.querySelectorAll(MARKT)];
  for (const e of lista) {
    const minne = ursprung.get(e) || {};
    ursprung.set(e, minne);
    const varden = e.dataset.i18nN != null ? { n: e.dataset.i18nN } : {};
    if (e.dataset.i18n) {
      const nod = [...e.childNodes].find(n => n.nodeType === 3 && n.data.trim());
      if (nod) {
        minne.text ??= nod.data.trim();
        const [, fore, , efter] = /^(\s*)([\s\S]*?)(\s*)$/.exec(nod.data);
        nod.data = fore + slaUpp(e.dataset.i18n, varden, minne.text) + efter;
      }
    }
    if (e.dataset.i18nHtml) {
      minne.html ??= e.innerHTML;
      e.innerHTML = slaUpp(e.dataset.i18nHtml, varden, minne.html);
    }
    if (e.dataset.i18nAttr) {
      minne.attr ??= {};
      for (const par of e.dataset.i18nAttr.split(';')) {
        const [attr, nyckel] = par.split(':').map(x => x.trim());
        if (!attr || !nyckel) continue;
        minne.attr[attr] ??= e.getAttribute(attr) ?? '';
        e.setAttribute(attr, slaUpp(nyckel, varden, minne.attr[attr]));
      }
    }
  }
}
