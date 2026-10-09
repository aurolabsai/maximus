// Maskeringsgrader. Vad som ska döljas är inte samma sak i alla ärenden.
//
// En handläggare på socialtjänsten behöver dölja personuppgifter men vill
// gärna att lagrum, belopp och datum står kvar — de bär frågan. En
// säkerhetsansvarig som frågar om en incident behöver tvärtom dölja
// servernamn, IP-adresser och sökvägar, medan personnamnen kanske är
// oviktiga. En upphandlare behöver dölja anbudssummor men vill att
// diarienumret följer med.
//
// Därför sorter, inte en nivå. Varje sort går att slå på och av var för sig,
// och paketen är bara förvalda kombinationer med ett namn man känner igen.
//
// Två sorter går aldrig att stänga av: personnummer och organisationsnummer.
// De är produktens löfte, och ett löfte med en strömbrytare är inget löfte.

import { tx } from './sprakstod.mjs';

// Namnen läses på det språk som gäller (getters).
export const SORTER = {
  personnummer:        { get namn() { return tx('lib.grader.sort.personnummer.namn'); }, get om() { return tx('lib.grader.sort.personnummer.om'); }, last: true },
  organisationsnummer: { get namn() { return tx('lib.grader.sort.organisationsnummer.namn'); }, get om() { return tx('lib.grader.sort.organisationsnummer.om'); }, last: true },
  epost:               { get namn() { return tx('lib.grader.sort.epost.namn'); }, get om() { return tx('lib.grader.sort.epost.om'); } },
  telefon:             { get namn() { return tx('lib.grader.sort.telefon.namn'); }, get om() { return tx('lib.grader.sort.telefon.om'); } },
  kontonummer:         { get namn() { return tx('lib.grader.sort.kontonummer.namn'); }, get om() { return tx('lib.grader.sort.kontonummer.om'); } },
  namn:                { get namn() { return tx('lib.grader.sort.namn.namn'); }, get om() { return tx('lib.grader.sort.namn.om'); } },
  ort:                 { get namn() { return tx('lib.grader.sort.ort.namn'); }, get om() { return tx('lib.grader.sort.ort.om'); } },
  organisation:        { get namn() { return tx('lib.grader.sort.organisation.namn'); }, get om() { return tx('lib.grader.sort.organisation.om'); } },
  diarienummer:        { get namn() { return tx('lib.grader.sort.diarienummer.namn'); }, get om() { return tx('lib.grader.sort.diarienummer.om'); } },
  belopp:              { get namn() { return tx('lib.grader.sort.belopp.namn'); }, get om() { return tx('lib.grader.sort.belopp.om'); } },
  datum:               { get namn() { return tx('lib.grader.sort.datum.namn'); }, get om() { return tx('lib.grader.sort.datum.om'); } },
  url:                 { get namn() { return tx('lib.grader.sort.url.namn'); }, get om() { return tx('lib.grader.sort.url.om'); } },
  ip:                  { get namn() { return tx('lib.grader.sort.ip.namn'); }, get om() { return tx('lib.grader.sort.ip.om'); } },
  server:              { get namn() { return tx('lib.grader.sort.server.namn'); }, get om() { return tx('lib.grader.sort.server.om'); } },
  sokvag:              { get namn() { return tx('lib.grader.sort.sokvag.namn'); }, get om() { return tx('lib.grader.sort.sokvag.om'); } },
  nyckel:              { get namn() { return tx('lib.grader.sort.nyckel.namn'); }, get om() { return tx('lib.grader.sort.nyckel.om'); } },
};

/// Paketen. Namn man känner igen, inte grader man måste tolka.
export const PAKET = {
  standard: {
    get namn() { return tx('lib.grader.paket.standard.namn'); },
    get om() { return tx('lib.grader.paket.standard.om'); },
    sorter: ['personnummer', 'organisationsnummer', 'epost', 'telefon', 'kontonummer', 'namn', 'ort', 'organisation'],
  },
  myndighet: {
    get namn() { return tx('lib.grader.paket.myndighet.namn'); },
    get om() { return tx('lib.grader.paket.myndighet.om'); },
    sorter: ['personnummer', 'organisationsnummer', 'epost', 'telefon', 'kontonummer', 'namn', 'ort',
             'organisation', 'diarienummer', 'url'],
  },
  upphandling: {
    get namn() { return tx('lib.grader.paket.upphandling.namn'); },
    get om() { return tx('lib.grader.paket.upphandling.om'); },
    sorter: ['personnummer', 'organisationsnummer', 'epost', 'telefon', 'kontonummer', 'namn',
             'organisation', 'belopp'],
  },
  sakerhet: {
    get namn() { return tx('lib.grader.paket.sakerhet.namn'); },
    get om() { return tx('lib.grader.paket.sakerhet.om'); },
    sorter: ['personnummer', 'organisationsnummer', 'epost', 'ip', 'server', 'sokvag', 'nyckel', 'url', 'organisation'],
  },
  allt: {
    get namn() { return tx('lib.grader.paket.allt.namn'); },
    get om() { return tx('lib.grader.paket.allt.om'); },
    sorter: Object.keys(SORTER),
  },
};

export const FORVAL = 'standard';

/// Sorterna som gäller. Låsta sorter är alltid med, oavsett vad som valts.
export function galler(installningar = {}) {
  const valda = Array.isArray(installningar.sorter) && installningar.sorter.length
    ? installningar.sorter
    : PAKET[installningar.paket || FORVAL]?.sorter || PAKET[FORVAL].sorter;
  const last = Object.entries(SORTER).filter(([, v]) => v.last).map(([k]) => k);
  return new Set([...valda, ...last]);
}

/// Vilket paket motsvarar en uppsättning sorter? Null om det är en egen.
export function paketFor(sorter) {
  const a = [...sorter].sort().join(',');
  for (const [id, p] of Object.entries(PAKET)) {
    const b = [...galler({ sorter: p.sorter })].sort().join(',');
    if (a === b) return id;
  }
  return null;
}
