/// Djupsökningen: flera varv, inte ett.
///
/// Ett vanligt uppslag söker en gång, läser fyra sidor och svarar. Det räcker
/// för "vad är prisbasbeloppet". Det räcker inte för "vad gäller när en
/// fullmakt missbrukas och vem ska underrättas" — den frågan har flera delar,
/// och svaret på den första avgör vad man ska leta efter i nästa.
///
/// Alltså varv. Sök, läs, se vad som fortfarande saknas, sök igen på det.
/// Modellen skriver frågorna; reglerna avgör när det räcker.
///
/// ── Varför inte bara fler sidor i ett svep ────────────────────────────────
///
/// För att den andra sökningen ska ställas på vad den första hittade. Tjugo
/// sidor om samma sökord är tjugo versioner av samma svar; fyra sidor, en
/// avläsning av vad som fattas, och fyra till är något annat.
///
/// ── Budget ────────────────────────────────────────────────────────────────
///
/// Tre tak, och det som slår först vinner: varv, källor, sekunder. En sökning
/// som kan pågå hur länge som helst är en sökning som gör det. Taken syns i
/// godkännandet innan något lämnar datorn — den som säger ja ska veta vad hon
/// säger ja till.
///
/// ── Vad som lämnar datorn ─────────────────────────────────────────────────
///
/// Sökfrågorna, och ingenting annat. De görs på den maskerade texten och
/// anonymiseras ytterligare vid känslig klassning, precis som ett vanligt
/// uppslag. Varje sökning och varje hämtad sida hamnar i liggaren.

import { svaraLokalt } from './lokal.mjs';
import { planera, slaUpp, byggUnderlag, renSokfraga, jsonUr } from './uppslag.mjs';
import { tx, modellprompt } from './sprakstod.mjs';

/// Taken.
///
/// Stod förut som en fast rad med motiveringen att en budget man kan skruva
/// på är en budget som skruvas upp. Det håller inte: den som utreder ett
/// ärende på riktigt behöver fler varv än den som kollar en taxa, och ett
/// tak som aldrig går att flytta är ett tak man går runt genom att fråga
/// fem gånger.
///
/// Gränserna nedan är hårda ändå. En sökning som kan pågå hur länge som
/// helst är en sökning som gör det.
export const BUDGET = { varv: 3, kallor: 12, sekunder: 180 };

export const GRANSER = {
  varv: { minsta: 1, storsta: 6 },
  kallor: { minsta: 4, storsta: 30 },
  sekunder: { minsta: 60, storsta: 900 },
};

/// Budgeten ur inställningarna, klämd inom gränserna.
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

/// Vad som fattas efter ett varv.
///
/// Modellen får läsa det som samlats och säga om det räcker. Svarar den inte
/// begripligt stannar vi — en djupsökning som fortsätter för att den inte
/// förstod svaret är en djupsökning som aldrig tar slut.
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

/// Vad användaren ska godkänna innan något lämnar datorn.
///
/// Sökfrågorna för första varvet, och vad som kommer att hända sedan. Den som
/// godkänner en djupsökning godkänner inte en sökning — hon godkänner att
/// MAXIMUS får söka igen på det den hittar, upp till taken.
export async function forbered(maskerad, { signal } = {}) {
  const fragor = await planera(maskerad, { signal });
  return { fragor, budget: BUDGET };
}

/// Kör djupsökningen.
///
/// `fragor` kommer från forbered() och är godkända. Varv två och tre planeras
/// under körningen — de går inte att godkänna i förväg, för de beror på vad
/// varv ett hittar. Därför står det i godkännandet att de kommer, och därför
/// visas varje sökfråga i steget när den ställs.
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
      // Kartan följer med in i VARJE varv.
      //
      // Revisionen 2026-09-28: första varvet hade en grind, andra varvet
      // ingen. Luckplaneraren läser rå källtext och skriver nya sökfrågor av
      // den — alltså är varv två den väg där en uppgift ur en hämtad sida
      // kan bli en sökfråga mot tredje part. Utan karta här hade varvet
      // grindats svagare än det första, och det är precis tvärtom mot vad
      // risken säger.
      karta, raknare, sorter,
      sidor: Math.max(2, Math.min(4, kvar)),
      onKalla: k => {
        // Numren ska löpa genom hela djupsökningen, inte börja om varje varv:
        // svaret hänvisar till [7] och då måste [7] finnas.
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
