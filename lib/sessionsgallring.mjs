
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

const rord = s => String(s.andrad || s.skapad || '');

export function traffade(sessioner, { dagar = 0, nu = Date.now() } = {}) {
  if (!dagar || dagar < 1) return [];
  const grans = new Date(nu - dagar * 86400000).toISOString();
  return [...sessioner].filter(s => {
    if (s.fast) return false;
    const t = rord(s);
    return t && t < grans;
  });
}

export function forhandsgranska(sessioner, { dagar = 0, nu = Date.now() } = {}) {
  const alla = [...sessioner];
  const traff = traffade(alla, { dagar, nu });
  const fasta = alla.filter(s => s.fast).length;
  const tider = traff.map(rord).filter(Boolean).sort();
  return {
    dagar,
    grans: dagar ? new Date(nu - dagar * 86400000).toISOString().slice(0, 10) : null,
    antal: traff.length,
    fragor: traff.reduce((n, s) => n + (s.turer?.length || 0), 0),
    undantagna: fasta,
    aldst: tider[0]?.slice(0, 10) || null,
    nyast: tider.at(-1)?.slice(0, 10) || null,
    kvar: alla.length - traff.length,
  };
}

export async function gallra(sessioner, { dagar = 0, nu = Date.now(), katalog, glom } = {}) {
  const traff = traffade([...sessioner.values()], { dagar, nu });
  const bort = [];
  const misslyckade = [];

  for (const s of traff) {
    try {
      await unlink(join(katalog(s.agare), `${s.id}.json`));
    } catch (e) {
      if (e.code !== 'ENOENT') { misslyckade.push({ id: s.id, varfor: e.message.slice(0, 120) }); continue; }
    }
    sessioner.delete(s.id);
    glom?.(s.id);
    bort.push({ id: s.id, rord: rord(s).slice(0, 10), fragor: s.turer?.length || 0 });
  }

  return {
    tid: new Date(nu).toISOString(),
    dagar,
    grans: dagar ? new Date(nu - dagar * 86400000).toISOString().slice(0, 10) : null,
    antal: bort.length,
    fragor: bort.reduce((n, b) => n + b.fragor, 0),
    sessioner: bort,
    misslyckade,
  };
}
