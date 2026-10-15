
import { randomUUID } from 'node:crypto';
import { ANGRA_MS, svarsavtryck } from './svar.mjs';

export const TAK = 10;

export function skapaKo({ skicka, klar = () => {}, vanta = ANGRA_MS, timer = setTimeout, stopp = clearTimeout, nu = () => Date.now() } = {}) {
  const ko = new Map();
  const nycklar = new Map();

  function begar({ nyckel, konto, lada = 'INBOX', brevId, till = [], amne, text, hash, signatur = null, forslag = null, session = null }) {
    till = Array.isArray(till) ? till.map(String) : [String(till)];
    if (!hash || svarsavtryck({ konto, lada, brevId, till, amne, text, signatur }) !== hash) return { fel: 'avtryck' };
    if (nyckel && nycklar.has(nyckel)) {
      const fore = ko.get(nycklar.get(nyckel));
      return fore ? { post: fore, igen: true } : { fel: 'redan' };
    }
    const samma = [...ko.values()].find(p => p.konto === konto && p.brevId === brevId);
    if (samma) return samma.hash === hash ? { post: samma, igen: true } : { fel: 'vantar' };
    if (ko.size >= TAK) return { fel: 'fullt' };
    const id = randomUUID();
    const post = Object.freeze({ id, nyckel: nyckel || id, konto, lada, brevId, till: Object.freeze([...till]), amne, text, hash, signatur, forslag, session,
      tryckt: new Date(nu()).toISOString(), skickasMs: nu() + vanta });
    ko.set(id, post);
    if (nyckel) nycklar.set(nyckel, id);
    const h = timer(() => gaUt(id), vanta);
    h?.unref?.();
    timers.set(id, h);
    return { post };
  }

  const timers = new Map();
  async function gaUt(id) {
    const post = ko.get(id);
    if (!post) return;
    ko.delete(id); timers.delete(id);
    if (svarsavtryck(post) !== post.hash) return klar(post, { fel: 'avtryck' });
    try { klar(post, { resultat: await skicka(post) }); }
    catch (e) { klar(post, { fel: e.message || String(e) }); }
  }

  function angra(id) {
    const post = ko.get(id);
    if (!post) return false;
    stopp(timers.get(id));
    ko.delete(id); timers.delete(id);
    return true;
  }

  return { begar, angra, vantar: () => [...ko.values()], finns: id => ko.has(id) };
}
