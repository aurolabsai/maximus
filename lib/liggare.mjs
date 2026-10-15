
import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { raderUr } from './liggarkedja.mjs';
import { tx } from './sprakstod.mjs';

export const forseglat = () => tx('lib.liggare.forseglat');
export const FORSEGLAT = '[förseglad session — innehållet kräver sessionens kod]';

const KOLUMNNYCKLAR = [
  ['tid', 'lib.liggare.kolumn.tid'],
  ['anvandarnamn', 'lib.liggare.kolumn.anvandarnamn'],
  ['anvandare', 'lib.liggare.kolumn.anvandare'],
  ['session', 'lib.liggare.kolumn.session'],
  ['frontier', 'lib.liggare.kolumn.frontier'],
  ['vag', 'lib.liggare.kolumn.vag'],
  ['tecken', 'lib.liggare.kolumn.tecken'],
  ['sekunder', 'lib.liggare.kolumn.sekunder'],
  ['fel', 'lib.liggare.kolumn.fel'],
  ['skickat', 'lib.liggare.kolumn.skickat'],
  ['mottaget', 'lib.liggare.kolumn.mottaget'],
];
const KOLUMNER = () => KOLUMNNYCKLAR.map(([k, n]) => [k, tx(n)]);

export async function las(maximus, dataDir, { dagar = 3650, oppnare = null } = {}) {
  const filer = (await readdir(join(dataDir, 'liggare')).catch(() => []))
    .filter(f => f.endsWith('.json')).sort().reverse().slice(0, dagar);
  const ut = [];
  const luckor = [];
  for (const d of filer) {
    try {
      const rader = raderUr(JSON.parse(await maximus.lasFil(join(dataDir, 'liggare', d))));
      if (!rader) throw new Error(tx('lib.liggare.fel.tomDag'));
      ut.push(...rader);
    } catch (e) {
      luckor.push({ dag: d.replace(/\.json$/, ''), varfor: e.message.slice(0, 120) });
    }
  }
  ut.luckor = luckor;
  ut.sort((a, b) => String(b.tid).localeCompare(String(a.tid)));
  const rader = ut.map(r => {
    if (!r.forseglad) return r;
    const { kuvert, ...resten } = r;
    let inre = null;
    if (kuvert && oppnare) { try { inre = oppnare(r, kuvert); } catch { inre = null; } }
    return inre
      ? { ...resten, ...inre }
      : { ...resten, skickat: null, mottaget: null, last: true };
  });
  rader.luckor = luckor;
  return rader;
}

const FARLIG_INLEDNING = /^[=+\-@\t\r]/;
const arTal = s => s !== '' && Number.isFinite(Number(s));
export const neutralisera = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return FARLIG_INLEDNING.test(s) && !arTal(s) ? `'${s}` : s;
};

export function tillCsv(rader, { avskiljare = ';' } = {}) {
  const fly = v => {
    const s = neutralisera(v);
    return /["\n\r;,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const kolumner = KOLUMNER();
  const ut = [kolumner.map(([, namn]) => fly(namn)).join(avskiljare)];
  for (const r of rader.map(forExport)) ut.push(kolumner.map(([k]) => fly(r[k])).join(avskiljare));
  return '﻿' + ut.join('\r\n') + '\r\n';
}

const forExport = r => !r.last ? r : { ...r, skickat: forseglat(), mottaget: forseglat() };

export function tillJson(rader, { organisation = null, kedja = null } = {}) {
  return JSON.stringify({
    om: tx('lib.liggare.json.om'),
    organisation,
    kedja: kedja || undefined,
    teckenkodning: 'UTF-8',
    tidsformat: 'ISO 8601, UTC',
    anmarkning: tx('lib.liggare.json.anmarkning'),
    uttaget: new Date().toISOString(),
    kolumner: Object.fromEntries(KOLUMNER()),
    antal: rader.length,
    rader: rader.map(forExport),
  }, null, 2);
}

export function tillText(rader, { organisation = null, kedja = null } = {}) {
  const huvud = [
    tx('lib.liggare.text.rubrik'),
    organisation ? tx('lib.liggare.text.organisation', { organisation }) : null,
    tx('lib.liggare.text.uttaget', { tid: new Date().toISOString() }),
    tx('lib.liggare.text.teckenkodning'),
    tx('lib.liggare.text.tidsformat'),
    tx('lib.liggare.text.antal', { n: rader.length }),
    kedja?.huvud ? tx('lib.liggare.text.huvud', { dag: kedja.huvudDag, huvud: kedja.huvud }) : null,
    kedja && !kedja.hel ? tx('lib.liggare.text.varning', { brott: kedja.brott.length, olasliga: kedja.olasliga.length + kedja.undanlagda.length }) : null,
    kedja?.huvud ? '' : null,
    kedja?.huvud ? tx('lib.liggare.text.skrivNed') : null,
    '',
    tx('lib.liggare.text.varjePost'),
    '='.repeat(72), '',
  ].filter(Boolean);

  for (const r of rader.map(forExport)) {
    huvud.push(`${r.tid}  ${r.frontier || '—'}  ${r.anvandarnamn || r.anvandare || '—'}`);
    if (r.fel) huvud.push(tx('lib.liggare.text.fel', { fel: r.fel }));
    huvud.push(tx('lib.liggare.text.post', { tecken: r.tecken, sekunder: r.sekunder, vag: r.vag || '—' }));
    huvud.push('', tx('lib.liggare.text.skickat'), String(r.skickat || ''), '');
    if (r.mottaget) huvud.push(tx('lib.liggare.text.mottaget'), String(r.mottaget), '');
    huvud.push('-'.repeat(72), '');
  }
  return huvud.join('\n');
}

export const FORMAT = {
  csv: { namn: 'CSV', typ: 'text/csv; charset=utf-8', slut: 'csv', gor: tillCsv,
         get om() { return tx('lib.liggare.format.csv'); } },
  json: { namn: 'JSON', typ: 'application/json; charset=utf-8', slut: 'json', gor: tillJson,
          get om() { return tx('lib.liggare.format.json'); } },
  txt: { get namn() { return tx('lib.liggare.format.txtNamn'); }, typ: 'text/plain; charset=utf-8', slut: 'txt', gor: tillText,
         get om() { return tx('lib.liggare.format.txt'); } },
};

export async function gallra(maximus, dataDir, { dagar = 0, nu = Date.now() } = {}) {
  if (!dagar || dagar < 1) return { gallrat: 0, dagar: 0, filer: [] };
  const grans = new Date(nu - dagar * 86400000).toISOString().slice(0, 10);
  const kat = join(dataDir, 'liggare');
  const bort = [];
  let gallrat = 0;

  for (const f of await readdir(kat).catch(() => [])) {
    if (!f.endsWith('.json')) continue;
    const dag = f.slice(0, 10);
    if (dag >= grans) continue;
    try {
      gallrat += (raderUr(JSON.parse(await maximus.lasFil(join(kat, f)))) || []).length;
    } catch {  }
    await unlink(join(kat, f)).catch(() => {});
    bort.push(f);
  }

  if (bort.length) {
    await maximus.andraFil(join(dataDir, 'gallring.json'),
      gamla => [...(Array.isArray(gamla) ? gamla : []),
        { tid: new Date(nu).toISOString(), dagar, grans, gallrat,
          dagarBorta: bort.map(f => f.slice(0, 10)) }],
      { forval: [] });
  }
  return { gallrat, dagar, grans, filer: bort };
}

export async function gallrade(maximus, dataDir) {
  try {
    const d = JSON.parse(await maximus.lasFil(join(dataDir, 'gallring.json')));
    return Array.isArray(d) ? d.flatMap(g => g.dagarBorta || []) : [];
  } catch { return []; }
}

export async function forhandsgranska(maximus, dataDir, { dagar = 0, nu = Date.now() } = {}) {
  if (!dagar || dagar < 1) return { skulleGallras: 0, aldst: null, dagar: 0 };
  const grans = new Date(nu - dagar * 86400000).toISOString().slice(0, 10);
  const kat = join(dataDir, 'liggare');
  let skulleGallras = 0, aldst = null;
  for (const f of await readdir(kat).catch(() => [])) {
    if (!f.endsWith('.json')) continue;
    const dag = f.slice(0, 10);
    if (!aldst || dag < aldst) aldst = dag;
    if (dag >= grans) continue;
    try { skulleGallras += (raderUr(JSON.parse(await maximus.lasFil(join(kat, f)))) || []).length; } catch {}
  }
  return { skulleGallras, aldst, grans, dagar };
}
