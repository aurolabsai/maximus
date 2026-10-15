
import { tx } from './sprakstod.mjs';

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

export function galler(installningar = {}) {
  const valda = Array.isArray(installningar.sorter) && installningar.sorter.length
    ? installningar.sorter
    : PAKET[installningar.paket || FORVAL]?.sorter || PAKET[FORVAL].sorter;
  const last = Object.entries(SORTER).filter(([, v]) => v.last).map(([k]) => k);
  return new Set([...valda, ...last]);
}

export function paketFor(sorter) {
  const a = [...sorter].sort().join(',');
  for (const [id, p] of Object.entries(PAKET)) {
    const b = [...galler({ sorter: p.sorter })].sort().join(',');
    if (a === b) return id;
  }
  return null;
}
