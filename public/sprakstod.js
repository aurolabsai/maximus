
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

export function fyllSprak(k, texter) {
  lexikon[k] = { ...texter };
  kod = k;
}

export const sprak = () => kod;

const forma = (v, varden) => {
  const mall = v && typeof v === 'object' ? (Number(varden.n) === 1 ? v.en ?? v.flera : v.flera ?? v.en) : v;
  return String(mall).replace(/\{(\w+)\}/g, (m, k) => (k in varden ? String(varden[k]) : m));
};

const slaUpp = (nyckel, varden, reserv) => {
  const v = lexikon[kod]?.[nyckel] ?? lexikon.sv[nyckel];
  return v == null ? reserv : forma(v, varden);
};

export function t(nyckel, varden = {}) {
  return slaUpp(nyckel, varden, nyckel);
}

export function svenska(nyckel, varden = {}) {
  const v = lexikon.sv[nyckel];
  return v == null ? nyckel : forma(v, varden);
}

export const lokal = () => (kod === 'sv' ? 'sv-SE' : kod === 'en' ? 'en-US' : kod);

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
