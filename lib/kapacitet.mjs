
import os from 'node:os';
import { tx } from './sprakstod.mjs';

const minnet = () => ({
  total: os.totalmem(), reserv: 0, utlanat: 0,
  fritt: Math.max(0, os.freemem()), verkligt: Math.max(0, os.freemem()), leaser: [],
  gissat: true,
});

export const LAGEN = {
  bada: 'bada',
  en: 'en',
  liten: 'liten',
  knapp: 'knapp',
};

const MARGINAL = 1.15;

export function avgor({ ledger: l, samtal, agent, agentLiten = null }) {
  const m = l || minnet();

  const barMaskinen = Math.max(0, (m.total || 0) - (m.reserv || 0));
  const haller = (m.leaser || []).reduce((a, x) => a + (x.faktiskt || 0), 0);
  const nu = Math.max(0, Math.min(m.fritt + haller, m.verkligt + haller));

  const ryms = (tak, ...behov) => behov.reduce((a, b) => a + b, 0) * MARGINAL <= tak;
  const bas = { tillgangligt: nu, barMaskinen };

  if (!samtal) return { ...bas, lage: LAGEN.knapp, valjs: true,
    skal: tx('kapacitet.vetInte') };

  if (agent && ryms(barMaskinen, samtal, agent)) {
    return { ...bas, lage: LAGEN.bada, samtal, agent, valjs: false,
      skal: tx('kapacitet.bada') };
  }
  if (agentLiten && ryms(barMaskinen, samtal, agentLiten)) {
    return { ...bas, lage: LAGEN.liten, samtal, agent: agentLiten, valjs: false,
      skal: tx('kapacitet.liten') };
  }
  if (ryms(barMaskinen, samtal)) {
    return { ...bas, lage: LAGEN.en, samtal, agent: null, valjs: true,
      skal: tx('kapacitet.en') };
  }
  return { ...bas, lage: LAGEN.knapp, samtal, agent: null, valjs: true,
    skal: tx('kapacitet.knapp') };
}

export function rymsNu({ ledger: l, behov }) {
  const m = l || minnet();
  const haller = (m.leaser || []).reduce((a, x) => a + (x.faktiskt || 0), 0);
  const nu = Math.max(0, Math.min(m.fritt + haller, m.verkligt + haller));
  if (!behov) return { ja: true, tillgangligt: nu };
  return { ja: behov * MARGINAL <= nu, tillgangligt: nu, behov };
}

export async function lage() {
  return { ...avgor({ ledger: null, samtal: null }), ledger: null };
}

export const gb = b => `${Math.round((Number(b) || 0) / 2 ** 30)} GB`;
