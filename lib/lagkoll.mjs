// Kontroll av lagrum mot riksdagens text.
//
// Bänken 2026-09-21 gav det tydligaste beskedet hela bygget producerat. En
// fråga om kameraövervakning besvarades med "enligt 14 kap 3 § kameralagen
// krävs alltid skriftligt medgivande, annars utgår vite om 250 000 kr".
// Det finns ingen kameralag, det finns inget sådant kapitel och det finns
// inget sådant vite.
//
// Både Jan-v3-4B och Qwen3.5-35B-A3B svarade "ja, det besvarar frågan". Den
// stora modellen har åtta gånger minnet och gjorde exakt samma fel, för det
// är inte ett resonemangsfel — det är ett påstående om världen, och en
// modell som tror på det kan inte upptäcka det genom att tänka efter längre.
//
// Därför ingen modell här. Lagtexten ligger på disk, hämtad från riksdagen,
// och ett lagrum som citeras finns antingen i den eller inte.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/// Lagtexten ligger i programmet, inte i användarens datakatalog.
///
/// MAXIMUS installeras på maskiner där ingen kört maximus3 först, och en
/// kontroll som bara fungerar på utvecklarens maskin är ingen kontroll.
import { tx } from './sprakstod.mjs';

const FORVAL = new URL('../lagar/', import.meta.url).pathname;

/// Kortnamnen folk faktiskt skriver. Ingen skriver "lagen (1982:80) om
/// anställningsskydd" i ett svar — de skriver LAS.
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
      // Paragrafbeteckningarna normaliseras: "2a §" och "2 a §" är samma.
      const paragrafer = new Set(l.paragrafer.map(p => normalisera(p.beteckning)));
      lagar.set(l.sfs, { sfs: l.sfs, titel: l.titel, url: l.url, paragrafer });
    } catch { /* hoppa över trasiga */ }
  }
  return lagar;
}

const normalisera = b => String(b).toLowerCase().replace(/\s+/g, '').replace(/§/g, '');
const nyckel = n => String(n).toLowerCase().replace(/[\s-]/g, '');

/// Hittar lagrum i en text.
///
/// Tre former som täcker nästan allt folk skriver:
///   7 § LAS                       paragraf och kortnamn
///   3 kap 8 § diskrimineringslagen  kapitel med
///   30 § lagen (1982:80)          med SFS-nummer
const MONSTER = /(?:(\d+)\s*kap\.?\s*)?(\d+\s*[a-z]?)\s*§+\s*(?:i\s+|of\s+(?:the\s+)?)?([\p{L}åäöÅÄÖ]{2,40}|lagen\s*\((\d{4}:\d+)\))/giu;

/// Läser ett svar och säger vad som inte stämmer.
///
/// Tystnad betyder inte att allt stämmer — bara att ingenting kunde
/// motbevisas. Lagar vi inte har på disk går inte att kontrollera, och det
/// sägs rakt ut i stället för att tigas ihjäl.
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
      // En lag vi inte har. Bara riktiga ord räknas — "enligt 5 § denna"
      // ska inte rapporteras som en okänd lag.
      if (namn && !/^(denna|samma|nämnda|ovan|lagen|paragrafen|bestämmelsen|this|that|the|said|above|act|law|section|provision|and|or|in)$/i.test(namn))
        okanda.push({ text: hela.trim(), lag: namn });
      continue;
    }

    kontrollerade++;
    // Kapitelindelade lagar står som "3 kap. 8 §" i beteckningen; de andra
    // bara som "8 §". Vi prövar båda formerna innan vi säger att den saknas.
    const former = kap ? [`${kap}kap${normalisera(par)}`, normalisera(par)] : [normalisera(par)];
    if (!former.some(f => lag.paragrafer.has(f)))
      fel.push({ text: hela.trim(), lag: lag.titel, sfs: lag.sfs, url: lag.url,
                 varfor: tx('pars.lagkoll.harIngen', { lag: lag.titel, kap: kap ? `${kap} kap. ` : '', par: par.trim() }) });
  }

  return { kontrollerade, fel, okanda, harLagar: true, antalLagar: alla.size };
}

/// Anmärkningarna som visas för användaren.
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
