// Bevakning efter instruktion (Fas 29, 2026-10-05).
//
// Auro: "nyhetskoll ... du URL + instruktion som egentligen kunde vara
// webbsök -> hitta rätt källor som är relevant -> osv". En bevakning
// behöver ingen adress: "håll koll på AI i offentlig sektor" räcker.
//
//   1. Första varvet hittar agenten källorna: några sökningar, träffarna
//      rangordnade efter nivå (myndighet före forum, se lib/kallor.mjs), en
//      per värd, och för varje ett flöde (RSS eller Atom) om sidan har ett.
//   2. Källmängden sparas på uppdraget och syns där. Du kan ta bort och
//      lägga till.
//   3. Varje varv läser agenten flödena (en post per artikel) och sidorna
//      utan flöde (en post per sida, ny när texten ändras). Det nya går
//      genom sorteringen mot instruktionen som allt annat, och dubbletter
//      faller på vattenmärket.
//
// Ingen modell i den här filen. Sökningen och hämtningen kommer utifrån.

import { klassa, ordning, garAttLasa } from './kallor.mjs';
import { createHash } from 'node:crypto';
import { tx } from './sprakstod.mjs';

export const KALLTAK = 8;

/// Sökfrågorna för att hitta källor till ett ämne.
export const sokfragor = amne => [amne, `${amne} ${tx('pars.amne.nyheter')}`, `${amne} rss`].map(s => s.trim()).filter(Boolean);

/// Flödet i en HTML-sida: <link rel="alternate" type="application/rss+xml">.
export function flodeI(html, bas) {
  for (const m of String(html || '').matchAll(/<link\b[^>]*>/gi)) {
    const tagg = m[0];
    if (!/rel=["']?alternate/i.test(tagg) || !/type=["']?application\/(rss|atom)\+xml/i.test(tagg)) continue;
    const href = /href=["']([^"']+)["']/i.exec(tagg)?.[1];
    if (href) { try { return new URL(href, bas).href; } catch { /* nästa */ } }
  }
  return null;
}

// Rymda tecken först, taggar sedan: en beskrivning är ofta HTML som rymts
// en gång (&lt;p&gt;), och den ska bli text, inte taggar.
const avtagg = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const falt = (blk, ...namn) => {
  for (const n of namn) {
    const m = new RegExp(`<${n}\\b[^>]*>([\\s\\S]*?)</${n}>`, 'i').exec(blk);
    if (m) return avtagg(m[1]);
  }
  return '';
};

/// Artiklarna i ett RSS- eller Atomflöde. Tolerant: ett flöde som är halvt
/// trasigt ger det som går att läsa.
export function lasFlode(xml, { kalla = '' } = {}) {
  const ut = [];
  for (const m of String(xml || '').matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const b = m[0];
    const lank = falt(b, 'link') || /<link\b[^>]*href=["']([^"']+)["']/i.exec(b)?.[1] || '';
    const id = falt(b, 'guid', 'id') || lank;
    const titel = falt(b, 'title');
    if (!id && !titel) continue;
    const tid = falt(b, 'pubDate', 'published', 'updated', 'dc:date');
    const t = new Date(tid);
    // Bilden i flödet (Fas 50): media:content, media:thumbnail eller en
    // bild som bilaga. Saknas den hämtas sidans OG-bild först när kortet visas.
    const bild = /<media:(?:content|thumbnail)\b[^>]*url=["']([^"']+)["']/i.exec(b)?.[1]
      || /<enclosure\b[^>]*type=["']image\/[^"']+["'][^>]*url=["']([^"']+)["']/i.exec(b)?.[1]
      || /<enclosure\b[^>]*url=["']([^"']+\.(?:jpe?g|png|webp|gif))["']/i.exec(b)?.[1] || null;
    ut.push({ id: `amne:${id || titel}`, titel: titel || lank, url: lank, fran: kalla, bild: /^https?:\/\//i.test(bild || '') ? bild.replace(/&amp;/g, '&') : null,
      tid: Number.isFinite(+t) ? t.toISOString() : new Date().toISOString(),
      text: falt(b, 'description', 'summary', 'content', 'content:encoded').slice(0, 1200) });
  }
  return ut.slice(0, 20);
}

/// Hittar källorna för ett ämne. `sok(fraga)` → [{ titel, url }],
/// `hamtaRa(url)` → { text, url, typ }.
export async function hittaKallor(amne, { sok, hamtaRa, tak = KALLTAK, onSteg = () => {} } = {}) {
  const traffar = [];
  for (const f of sokfragor(amne)) {
    onSteg(tx('pars.amne.soker', { fraga: f }));
    try { traffar.push(...(await sok(f))); } catch { /* nästa fråga */ }
  }
  // En per värd, i nivåordning — en myndighet före en blogg om samma sak.
  const sedda = new Set();
  const valda = traffar
    .filter(t => t?.url && garAttLasa(t.url))
    .map(t => ({ ...t, ...klassa(t.url, t.titel) }))
    .sort(ordning)
    .filter(t => { const v = new URL(t.url).hostname.replace(/^www\./, ''); if (sedda.has(v)) return false; sedda.add(v); return true; })
    .slice(0, tak);
  const ut = [];
  for (const t of valda) {
    let flode = null;
    // Ett flöde som söktes fram direkt är redan ett flöde.
    try {
      const r = await hamtaRa(t.url);
      if (/xml|rss|atom/i.test(r.typ) || /^\s*<\?xml[\s\S]{0,300}<(rss|feed)\b/i.test(r.text)) flode = r.url;
      else flode = flodeI(r.text, r.url);
    } catch { /* sidan utan flöde */ }
    onSteg(`${t.vard || t.url}${flode ? tx('pars.amne.medFlode') : ''}`);
    ut.push({ url: t.url, titel: String(t.titel || t.url).slice(0, 120), vard: t.vard || new URL(t.url).hostname, flode });
  }
  return ut;
}

/// Ett varv över källmängden: flödena som artiklar, sidorna som en post var.
export async function lasKallmangd(kallmangd, { hamtaRa, hamtaSida }) {
  const ut = [];
  for (const k of kallmangd || []) {
    try {
      if (k.flode) ut.push(...lasFlode((await hamtaRa(k.flode)).text, { kalla: k.vard }));
      else {
        const s = await hamtaSida(k.url);
        const text = String(s?.text || '');
        ut.push({ id: `amne:${k.url}`, titel: s?.titel || k.titel, url: k.url, fran: k.vard, tid: new Date().toISOString(),
          andrad: createHash('sha256').update(text).digest('hex').slice(0, 16), text: text.slice(0, 1500) });
      }
    } catch { /* en källa som inte svarar i dag är ingen krasch */ }
  }
  return ut;
}
