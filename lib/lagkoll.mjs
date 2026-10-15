
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { tx } from './sprakstod.mjs';

const FORVAL = new URL('../lagar/', import.meta.url).pathname;

const KORTNAMN = {
  las: '1982:80', mbl: '1976:580', aml: '1977:1160', osl: '2009:400',
  semesterlagen: '1977:480', diskrimineringslagen: '2008:567',
  arbetsmiljölagen: '1977:1160', anställningsskyddslagen: '1982:80',
  medbestämmandelagen: '1976:580', säkerhetsskyddslagen: '2018:585',
  offentlighetsochsekretesslagen: '2009:400', cybersäkerhetslagen: '2025:1506',
  dataskyddslagen: '2018:218',
};

let lagar = null;

export async function ladda(katalog = FORVAL) {
  if (lagar) return lagar;
  lagar = new Map();
  for (const namn of await readdir(katalog).catch(() => [])) {
    if (!namn.endsWith('.json')) continue;
    try {
      const l = JSON.parse(await readFile(join(katalog, namn), 'utf8'));
      const paragrafer = new Set(l.paragrafer.map(p => normalisera(p.beteckning)));
      lagar.set(l.sfs, { sfs: l.sfs, titel: l.titel, url: l.url, paragrafer });
    } catch {  }
  }
  return lagar;
}

const normalisera = b => String(b).toLowerCase().replace(/\s+/g, '').replace(/§/g, '');
const nyckel = n => String(n).toLowerCase().replace(/[\s-]/g, '');

const MONSTER = /(?:(\d+)\s*kap\.?\s*)?(\d+\s*[a-z]?)\s*§+\s*(?:i\s+|of\s+(?:the\s+)?)?([\p{L}åäöÅÄÖ]{2,40}|lagen\s*\((\d{4}:\d+)\))/giu;

export async function kolla(text, { katalog = FORVAL } = {}) {
  const alla = await ladda(katalog);
  if (!alla.size) return { kontrollerade: 0, fel: [], okanda: [], harLagar: false };

  const fel = [], okanda = [];
  let kontrollerade = 0;

  for (const m of String(text || '').matchAll(MONSTER)) {
    const [hela, kap, par, namn, sfsIParentes] = m;
    const sfs = sfsIParentes || KORTNAMN[nyckel(namn)] || (/^\d{4}:\d+$/.test(namn) ? namn : null);
    const lag = sfs ? alla.get(sfs) : null;

    if (!lag) {
      if (namn && !/^(denna|samma|nämnda|ovan|lagen|paragrafen|bestämmelsen|this|that|the|said|above|act|law|section|provision|and|or|in)$/i.test(namn))
        okanda.push({ text: hela.trim(), lag: namn });
      continue;
    }

    kontrollerade++;
    const former = kap ? [`${kap}kap${normalisera(par)}`, normalisera(par)] : [normalisera(par)];
    if (!former.some(f => lag.paragrafer.has(f)))
      fel.push({ text: hela.trim(), lag: lag.titel, sfs: lag.sfs, url: lag.url,
                 varfor: tx('pars.lagkoll.harIngen', { lag: lag.titel, kap: kap ? `${kap} kap. ` : '', par: par.trim() }) });
  }

  return { kontrollerade, fel, okanda, harLagar: true, antalLagar: alla.size };
}

export function anmarkningar(resultat) {
  const ut = [];
  for (const f of resultat.fel)
    ut.push(tx('pars.lagkoll.fel', { text: f.text, varfor: f.varfor }));
  if (resultat.okanda.length) {
    const namn = [...new Set(resultat.okanda.map(o => o.lag))];
    ut.push(tx('pars.lagkoll.okand', { lista: resultat.okanda.map(o => o.text).join(', '),
      namn: namn.length === 1 ? namn[0] : tx('pars.lagkoll.deLagarna') }));
  }
  return ut;
}
