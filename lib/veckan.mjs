
import { tx, svenska } from './sprakstod.mjs';

export const TAK = 5;

export const DAGAR = 7;

const dag = d => new Date(d).toISOString().slice(0, 10);
const dygnTill = (datum, nu) =>
  Math.round((new Date(dag(datum)) - new Date(dag(nu))) / 86400000);

export function veckan({ handelser = [], frister = [], fynd = [], uppdrag = [], nu = new Date() } = {}) {
  const rader = [];

  for (const f of frister) {
    if (f.klar) continue;
    const d = dygnTill(f.forfaller, nu);
    if (d < 0 || d > DAGAR) continue;
    rader.push({
      sort: 'frist', nar: f.forfaller, dygn: d,
      vad: f.vad || f.lagrum || tx('lib.veckan.frist'),
      vikt: d <= 1 ? 3 : d <= 3 ? 2 : 1,
      om: f.sessionstitel ? tx('lib.veckan.horTill', { titel: f.sessionstitel }) : '',
      session: f.session || null,
    });
  }

  for (const h of handelser) {
    const d = dygnTill(h.start || h.tid, nu);
    if (d < 0 || d > DAGAR) continue;
    const nara = rader.some(r => r.sort === 'frist' && Math.abs(r.dygn - d) <= 1);
    rader.push({
      sort: 'mote', nar: h.start || h.tid, dygn: d,
      vad: h.titel || tx('lib.veckan.mote'),
      vikt: nara ? 2 : 1,
      om: nara ? tx('lib.veckan.intill') : '',
    });
  }

  for (const f of fynd) {
    if (f.sett || (f.vikt || 1) < 3) continue;
    rader.push({
      sort: 'fynd', nar: f.skapad, dygn: dygnTill(f.skapad, nu),
      vad: f.titel, vikt: 3, om: f.varfor || '',
      session: f.session || null,
    });
  }

  rader.sort((a, b) => (b.vikt - a.vikt) || (a.dygn - b.dygn));
  return rader.slice(0, TAK);
}

export function somText(rader, nu = new Date()) {
  return rader.map(r => `${nartext(r.dygn, r.nar, nu)} · ${r.vad}${r.om ? ` — ${r.om}` : ''}`);
}

export function nartext(dygn, nar, nu = new Date()) {
  if (dygn <= 0) return tx('lib.veckan.idag');
  if (dygn === 1) return tx('lib.veckan.imorgon');
  const d = new Date(nar);
  if (Number.isNaN(+d)) return tx('lib.veckan.omDagar', { n: dygn });
  const veckodag = d.toLocaleDateString(svenska() ? 'sv-SE' : 'en-US', { weekday: 'long' });
  return dygn <= 6 ? veckodag : tx('lib.veckan.dagOmDagar', { veckodag, n: dygn });
}

export const harNagot = rader => Array.isArray(rader) && rader.length > 0;
