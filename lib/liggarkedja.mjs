
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tx } from './sprakstod.mjs';

export const KEDJEVERSION = 1;

export const hasha = text => createHash('sha256').update(String(text), 'utf8').digest('hex');

export async function dagfiler(dataDir) {
  return (await readdir(join(dataDir, 'liggare')).catch(() => []))
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
}

export async function lasDag(maximus, dataDir, fil) {
  const text = await maximus.lasFil(join(dataDir, 'liggare', fil));
  const d = JSON.parse(text);
  if (Array.isArray(d)) return { rader: d, forra: null, forraDag: null, kedjad: false, text };
  if (!Array.isArray(d?.rader)) throw new Error(tx('lib.liggare.fel.tomDag'));
  return { rader: d.rader, forra: d.forra ?? null, forraDag: d.forraDag ?? null, kedjad: true, text };
}

export const raderUr = d => (Array.isArray(d) ? d : Array.isArray(d?.rader) ? d.rader : null);

export const arKedjad = d => !Array.isArray(d) && Array.isArray(d?.rader);

export async function lankaTill(maximus, dataDir, dag) {
  const filer = (await dagfiler(dataDir)).filter(f => f.slice(0, 10) < dag);
  const forra = filer.at(-1);
  if (!forra) return { forra: null, forraDag: null };
  try {
    const { text } = await lasDag(maximus, dataDir, forra);
    return { forra: hasha(text), forraDag: forra.slice(0, 10) };
  } catch {
    return { forra: null, forraDag: forra.slice(0, 10), trasig: true };
  }
}

export async function granska(maximus, dataDir, { gallrade = [] } = {}) {
  const filer = await dagfiler(dataDir);

  const undanlagda = (await readdir(join(dataDir, 'liggare')).catch(() => []))
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json\.skadad-/.test(f))
    .map(f => ({ dag: f.slice(0, 10), fil: f }))
    .sort((a, b) => a.fil.localeCompare(b.fil));
  const gallradeDagar = new Set(gallrade.map(g => String(g).slice(0, 10)));
  const dagar = [];
  const brott = [];
  const okedjade = [];
  const olasliga = [];

  const hash = new Map();
  for (const f of filer) {
    try {
      const d = await lasDag(maximus, dataDir, f);
      hash.set(f.slice(0, 10), hasha(d.text));
      dagar.push({ dag: f.slice(0, 10), ...d, rader: d.rader.length });
    } catch (e) {
      olasliga.push({ dag: f.slice(0, 10), varfor: e.message.slice(0, 120) });
    }
  }

  for (const [i, d] of dagar.entries()) {
    if (!d.kedjad) { okedjade.push(d.dag); continue; }
    const foregaende = dagar.slice(0, i).at(-1);
    if (!d.forraDag) {
      if (foregaende && foregaende.kedjad) {
        brott.push({ dag: d.dag, sort: 'saknad-lank',
          varfor: tx('lib.liggarkedja.saknadLank', { dag: foregaende.dag }) });
      }
      continue;
    }
    const vantad = hash.get(d.forraDag);
    if (vantad === undefined) {
      if (!gallradeDagar.has(d.forraDag)) {
        brott.push({ dag: d.dag, sort: 'borta',
          varfor: tx('lib.liggarkedja.borta', { dag: d.forraDag }) });
      }
      continue;
    }
    if (vantad !== d.forra) {
      brott.push({ dag: d.dag, sort: 'andrad', pekarPa: d.forraDag,
        varfor: tx('lib.liggarkedja.andrad', { forra: d.forraDag, dag: d.dag }) });
    }
  }

  const sista = dagar.at(-1);
  return {
    dagar: dagar.map(d => ({ dag: d.dag, rader: d.rader, kedjad: d.kedjad })),
    brott, okedjade, olasliga, undanlagda,
    huvud: sista ? hash.get(sista.dag) : null,
    huvudDag: sista?.dag || null,
    hel: brott.length === 0 && olasliga.length === 0 && undanlagda.length === 0,
  };
}

export async function huvud(maximus, dataDir) {
  const filer = await dagfiler(dataDir);
  const sista = filer.at(-1);
  if (!sista) return null;
  try { return hasha((await lasDag(maximus, dataDir, sista)).text); }
  catch { return null; }
}
