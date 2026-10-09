// Agenten städar (Fas 41, 2026-10-05).
//
// Auro: "Also 'archived' sessions, this should be done by the agent of
// course." Samtal som är klara läggs i arkivet av agenten — med skäl, och
// det går att ångra. Ingenting raderas; arkivet är en låda, inte en
// papperskorg.
//
// Reglerna är regler, inte en modells bedömning. "Klart" ska gå att
// förklara i en mening och gå att lita på:
//
//   undersökning     klar och orörd i 7 dagar
//   tråd utan uppdrag   uppdraget är borttaget, orörd i 3 dagar
//   engångssökning   körd, och tråden orörd i 7 dagar
//   eget samtal      orört i 30 dagar
//
// Aldrig: fästa, i ett projekt, låsta eller förseglade, Agenten själv, ett
// samtal där något pågår — eller ett som du tagit tillbaka ur arkivet. Det
// du tagit tillbaka har du sagt något om, och agenten rör det inte igen.

import { tx } from './sprakstod.mjs';

export const DAGAR = { undersokning: 7, utanUppdrag: 3, engang: 7, eget: 30 };
const DAG = 864e5;

/// Vad agenten skulle arkivera nu, med skäl. `uppdrag` är listan som den
/// är; `pagar(id)` säger om något körs i samtalet.
export function kandidater(sessioner, { uppdrag = [], nu = new Date(), pagar = () => false } = {}) {
  const ut = [];
  for (const s of sessioner) {
    if (s.arkiverad || s.fast || s.projekt || s.agentsamtal || s.helig || s.las || s.forseglad || s.tillbaka || pagar(s.id)) continue;
    if (!s.turer?.length) continue;
    const dagar = Math.floor((nu - new Date(s.andrad || s.skapad || nu)) / DAG);
    const u = s.uppdrag ? uppdrag.find(x => x.id === s.uppdrag) : uppdrag.find(x => x.session === s.id);
    let skal = null;
    if (s.a2a) {
      if (dagar >= DAGAR.undersokning) skal = tx('lib.stada.undersokning', { n: dagar });
    } else if (s.avAgenten) {
      if (s.uppdrag && !u && dagar >= DAGAR.utanUppdrag) skal = tx('lib.stada.utanUppdrag');
      else if (u && !u.aterkommande && u.senast && dagar >= DAGAR.engang) skal = tx('lib.stada.engang');
    } else if (dagar >= DAGAR.eget) {
      skal = tx('lib.stada.orort', { n: dagar });
    }
    if (skal) ut.push({ id: s.id, titel: s.titel || tx('lib.stada.samtal'), skal });
  }
  return ut;
}

/// Raden i Agenten: vad som arkiverades och varför.
export function rapport(arkiverade) {
  const n = arkiverade.length;
  return `${tx('lib.stada.lade', { n })}\n\n`
    + arkiverade.slice(0, 20).map(a => `- **${a.titel}** — ${a.skal}`).join('\n')
    + (n > 20 ? `\n- ${tx('lib.stada.till', { n: n - 20 })}` : '')
    + `\n\n${tx('lib.stada.inteBorta')}`;
}
