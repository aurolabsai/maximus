
import { tx } from './sprakstod.mjs';

export const DAGAR = { undersokning: 7, utanUppdrag: 3, engang: 7, eget: 30 };
const DAG = 864e5;

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

export function rapport(arkiverade) {
  const n = arkiverade.length;
  return `${tx('lib.stada.lade', { n })}\n\n`
    + arkiverade.slice(0, 20).map(a => `- **${a.titel}** — ${a.skal}`).join('\n')
    + (n > 20 ? `\n- ${tx('lib.stada.till', { n: n - 20 })}` : '')
    + `\n\n${tx('lib.stada.inteBorta')}`;
}
