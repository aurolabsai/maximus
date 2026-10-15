
import { tx } from './sprakstod.mjs';
export function amnenUr(profil = {}) {
  const lista = v => (Array.isArray(v) ? v : String(v || '').split(/[,;\n]| och | and /))
    .map(x => String(x).trim().replace(/\.$/, '')).filter(x => x.length > 1);
  const ut = lista(profil.intressen);
  if (!ut.length) ut.push(...lista(profil.arbetar).slice(0, 2));
  return [...new Set(ut)].slice(0, 5);
}

export const TITEL = 'Nyheter för dig';
export const titel = () => tx('nyheter.titel');
export const TAKT = 180;

export function uppdragFor(amnen, { epost = false } = {}) {
  return {
    titel: titel(), aterkommande: true, takt: TAKT,
    kallor: [...amnen.map(a => ({ typ: 'amne', fraga: a })), ...(epost ? [{ typ: 'epost', nyhetsbrev: true }] : [])],
    instruktion: tx('nyheter.instruktion', { amnen: amnen.join(', '), forsta: amnen[0] || tx('nyheter.amnet') }),
  };
}

export const arNyhetsbrev = (fran, { avregistrering = false } = {}) => {
  const f = String(fran || '');
  if (/(no-?reply|do-?not-?reply|newsletter|nyhetsbrev|nyheter@|news@|news\.|digest|updates?@|substack|beehiiv|mailchimp|mailerlite|convertkit|ghost\.io|medium\.com|redaktion)/i.test(f)) return true;
  return avregistrering === true && /(linkedin\.com|info@|hello@|team@)/i.test(f);
};

export function omAmne(om, amnen = []) {
  const o = String(om || '').toLowerCase().trim();
  if (!o || /^(inget|ingen|none|nej)$/.test(o)) return null;
  return amnen.find(a => o.includes(a.toLowerCase()) || a.toLowerCase().includes(o)) || null;
}

export function urval(fynd = [], uppdragId, { antal = 12 } = {}) {
  const vagda = fynd.filter(f => f.uppdrag === uppdragId && (f.url || f.brev) && !f.obedomd);
  const tunga = vagda.filter(f => (f.vikt || 0) >= 2);
  return (tunga.length ? tunga : vagda)
    .sort((a, b) => (b.vikt || 0) - (a.vikt || 0) || Date.parse(b.skapad || 0) - Date.parse(a.skapad || 0))
    .slice(0, antal)
    .map(f => ({ id: f.id, titel: f.titel, fran: f.fran || vardUr(f.url), url: f.url, tid: f.tid || f.skapad,
      vikt: f.vikt || 1, varfor: f.varfor || null, sett: Boolean(f.sett), session: f.session || null, brev: f.brev || null, amne: f.amne || null }));
}
const vardUr = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };

export function drag({ spar = [], fynd = [], uppdrag = [] } = {}, { antal = 12 } = {}) {
  const ut = [];
  const namn = id => uppdrag.find(u => u.id === id)?.titel || null;
  for (const v of spar) {
    for (const h of v.varv || []) {
      if (h.arbete) ut.push({ tid: v.nar, sort: 'undersokte', titel: h.titel, rad: h.skal || tx('nyheter.undersokte'), session: h.arbete });
      else if (h.fynd > 0) ut.push({ tid: v.nar, sort: 'hittade', titel: h.titel || namn(h.uppdrag), rad: tx('nyheter.attTitta', { n: h.fynd }), session: h.samtal || null, uppdrag: h.uppdrag || null });
      else if (h.fel) ut.push({ tid: v.nar, sort: 'fel', titel: h.titel || namn(h.uppdrag), rad: h.fel, uppdrag: h.uppdrag || null });
    }
  }
  for (const f of fynd) if (f.undersokt && f.undersokning && !ut.some(x => x.session === f.undersokning)) {
    ut.push({ tid: f.undersokt, sort: 'undersokte', titel: f.titel, rad: tx('nyheter.slutsats'), session: f.undersokning });
  }
  return ut.filter(x => x.titel).sort((a, b) => Date.parse(b.tid) - Date.parse(a.tid)).slice(0, antal);
}

export function ogUr(html, bas) {
  const s = String(html || '').slice(0, 400000);
  for (const namn of ['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src']) {
    for (const m of s.matchAll(/<meta\b[^>]*>/gi)) {
      const t = m[0];
      if (!new RegExp(`(property|name)=["']${namn.replace(/:/g, ':')}["']`, 'i').test(t)) continue;
      const c = /content=["']([^"']+)["']/i.exec(t)?.[1];
      if (c) { try { const u = new URL(c.replace(/&amp;/g, '&'), bas); if (/^https?:$/.test(u.protocol)) return u.href; } catch {  } }
    }
  }
  return null;
}
