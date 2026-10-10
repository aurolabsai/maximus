// Kön för Skicka (2026-10-10): tio sekunder att ångra, som Gmail.
//
// Ett tryck på Skicka lägger svaret här, fryst: texten, mottagaren, ämnet
// och avtrycket av texten. Ingenting går till Mail förrän tiden gått. Ångra
// tar bort det ur kön, och då har inget lämnat datorn. Kön finns bara i
// minnet: stängs Maximus under ångra-tiden skickas ingenting, och det är
// rätt — hellre ett svar som inte gick än ett som gick utan att du såg det.
//
// Samma tryck två gånger (ett dubbelklick, ett nätverk som skickar om) har
// samma `nyckel` och blir ett svar, inte två.

import { randomUUID } from 'node:crypto';
import { ANGRA_MS, svarsavtryck } from './svar.mjs';

/// Fler än så här väntar aldrig samtidigt: en kö ska inte gå att fylla.
export const TAK = 10;

/// `skicka(post)` gör själva sändningen; `klar(post)` får veta hur det gick.
export function skapaKo({ skicka, klar = () => {}, vanta = ANGRA_MS, timer = setTimeout, stopp = clearTimeout, nu = () => Date.now() } = {}) {
  const ko = new Map();       // id → post
  const nycklar = new Map();  // nyckel → id

  function begar({ nyckel, konto, lada = 'INBOX', brevId, till = [], amne, text, hash, signatur = null, forslag = null, session = null }) {
    till = Array.isArray(till) ? till.map(String) : [String(till)];
    // Avtrycket ska stämma med ALLT som kom (granskningen 2026-10-10):
    // konto, brev, mottagare, ämne, text och signatur — inte bara texten.
    if (!hash || svarsavtryck({ konto, lada, brevId, till, amne, text, signatur }) !== hash) return { fel: 'avtryck' };
    if (nyckel && nycklar.has(nyckel)) {
      const fore = ko.get(nycklar.get(nyckel));
      // Väntar det: samma post. Redan skickat eller ångrat: inget nytt.
      return fore ? { post: fore, igen: true } : { fel: 'redan' };
    }
    // Ett svar på samma brev väntar redan: det är det, inte ett till.
    const samma = [...ko.values()].find(p => p.konto === konto && p.brevId === brevId);
    // Samma innehåll: samma post. Annat innehåll medan ett väntar: nej —
    // annars svarade kön "skickas" för en text som aldrig går.
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
    // Sista kontrollen: texten som går ut är den som frystes.
    if (svarsavtryck(post) !== post.hash) return klar(post, { fel: 'avtryck' });
    try { klar(post, { resultat: await skicka(post) }); }
    catch (e) { klar(post, { fel: e.message || String(e) }); }
  }

  function angra(id) {
    const post = ko.get(id);
    if (!post) return false;
    stopp(timers.get(id));
    ko.delete(id); timers.delete(id);
    // Nyckeln står kvar: ett omskick av samma tryck ska inte skicka nu.
    return true;
  }

  return { begar, angra, vantar: () => [...ko.values()], finns: id => ko.has(id) };
}
