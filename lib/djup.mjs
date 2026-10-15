
import { svaraLokalt } from './lokal.mjs';
import { planera, slaUpp, byggUnderlag, renSokfraga, jsonUr } from './uppslag.mjs';
import { tx, modellprompt } from './sprakstod.mjs';

export const BUDGET = { varv: 3, kallor: 12, sekunder: 180 };

export const GRANSER = {
  varv: { minsta: 1, storsta: 6 },
  kallor: { minsta: 4, storsta: 30 },
  sekunder: { minsta: 60, storsta: 900 },
};

export function budgetAv(i = {}) {
  const tal = (v, förval, g) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return förval;
    return Math.max(g.minsta, Math.min(g.storsta, Math.round(n)));
  };
  return {
    varv: tal(i.djupVarv, BUDGET.varv, GRANSER.varv),
    kallor: tal(i.djupKallor, BUDGET.kallor, GRANSER.kallor),
    sekunder: tal(i.djupSekunder, BUDGET.sekunder, GRANSER.sekunder),
  };
}

const LUCKOR = `Du läser underlag som samlats in för att besvara en fråga.

Svara bara med JSON:
{"racker": true}
eller
{"racker": false, "saknas": "vad som fattas, en mening", "fragor": ["sökfråga", "sökfråga"]}

Regler:
- "racker": true när underlaget besvarar frågan. Hellre det än ett varv till på något som redan står där.
- Högst två nya sökfrågor, och de ska gälla det som SAKNAS — inte det som redan hittats.
- Skriv dem som man skriver i en sökruta: nyckelord, inga meningar, inga frågetecken.
- Aldrig hakparenteser eller platshållare. Sök på sak, lagrum, myndighet eller begrepp — aldrig på personer.`;

async function luckor(fraga, kallor, { signal }) {
  const hittills = kallor
    .map(k => `[${k.nr}] ${k.titel}\n${String(k.utdrag).slice(0, 900)}`)
    .join('\n\n');
  try {
    const ra = await svaraLokalt(`${modellprompt(LUCKOR)}\n\nFRÅGAN:\n${fraga}\n\nUNDERLAG:\n${hittills}`,
      { signal, tak: 220 });
    const j = jsonUr(ra);
    if (j?.racker === true) return { racker: true };
    const nya = (j?.fragor || []).map(renSokfraga).filter(f => f.length > 2).slice(0, 2);
    return nya.length ? { racker: false, saknas: j?.saknas || '', fragor: nya } : { racker: true };
  } catch {
    return { racker: true };
  }
}

export async function forbered(maskerad, { signal } = {}) {
  const fragor = await planera(maskerad, { signal });
  return { fragor, budget: BUDGET };
}

export async function djupsok(maskerad, {
  fragor, signal, onSteg = () => {}, onKalla = () => {}, liggare,
  budget = BUDGET, nu = () => Date.now(),
  karta = new Map(), raknare = new Map(), sorter = null,
} = {}) {
  const start = nu();
  const alla = [];
  const varvlogg = [];
  let attSoka = fragor?.length ? fragor : await planera(maskerad, { signal });
  let stoppade = null;

  for (let varv = 1; varv <= budget.varv; varv++) {
    if (!attSoka.length) break;
    if (signal?.aborted) { stoppade = tx('djup.avbruten'); break; }

    const gick = Math.round((nu() - start) / 1000);
    if (gick > budget.sekunder) { stoppade = tx('djup.tiden', { s: gick }); break; }
    if (alla.length >= budget.kallor) { stoppade = tx('djup.kallorRackte', { n: alla.length }); break; }

    onSteg({ steg: 'planerar',
      text: varv === 1
        ? tx('djup.varv1', { max: budget.varv, fragor: attSoka.join(', ') })
        : tx('djup.varvN', { varv, fragor: attSoka.join(', ') }) });

    const kvar = budget.kallor - alla.length;
    const r = await slaUpp(maskerad, {
      signal, onSteg, liggare, fragor: attSoka,
      karta, raknare, sorter,
      sidor: Math.max(2, Math.min(4, kvar)),
      onKalla: k => {
        const egen = { ...k, nr: alla.length + 1, varv };
        alla.push(egen);
        onKalla(egen);
      },
    });
    varvlogg.push({ varv, fragor: attSoka, hittade: r.kallor.length });

    if (varv === budget.varv) { stoppade = tx('djup.varvRackte', { n: budget.varv }); break; }
    if (!alla.length) { stoppade = tx('djup.ingenting'); break; }

    onSteg({ steg: 'laser', text: tx('djup.laser') });
    const l = await luckor(maskerad, alla, { signal });
    if (l.racker) { stoppade = tx('djup.rackte'); break; }
    onSteg({ steg: 'planerar', text: tx('djup.fattas', { saknas: l.saknas }) });
    attSoka = l.fragor;
  }

  return {
    kallor: alla,
    underlag: byggUnderlag(alla),
    varv: varvlogg,
    stoppade,
    sekunder: Math.round((nu() - start) / 1000),
  };
}
