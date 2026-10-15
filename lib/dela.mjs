
import { randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';
import {
  forsegla, oppna, nyttSalt, nyckelUrLosenord, kontrollvarde,
} from './krypto.mjs';
import { tx } from './sprakstod.mjs';

export const FORMAT = 1;
export const ANDELSE = '.maximus';

const TECKEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function foreslaKod() {
  const b = randomBytes(16);
  const t = [...b].map(v => TECKEN[v % TECKEN.length]).join('');
  return t.match(/.{4}/g).join('-');
}

export const MINSTA_KOD = 12;

export function granskaKod(kod) {
  const k = String(kod || '').trim();
  if (k.length < MINSTA_KOD)
    return { ok: false, varfor: tx('dela.kodKort', { minsta: MINSTA_KOD }) };
  return { ok: true };
}

export async function paketeraBevakningar(bevakningar, kod, { fran = null } = {}) {
  const rena = (bevakningar || []).map(b => ({
    sort: b.sort, uri: b.uri, lagrum: b.lagrum || null,
    etikett: b.etikett, namn: b.namn || null,
  }));
  return kuvertera({ sort: 'bevakning', kropp: { bevakningar: rena }, kod, fran });
}

export async function paketera(session, kod, { fran = null } = {}) {
  const gransk = granskaKod(kod);
  if (!gransk.ok) throw new Error(gransk.varfor);

  const salt = nyttSalt();
  const nyckel = await nyckelUrLosenord(String(kod).trim(), salt);

  const { las, agare, id, forseglad, ...rent } = session;
  const kropp = {
    ...rent,
    ursprung: id || null,
  };

  return kuvertera({ sort: 'session', kropp, kod, fran, salt, nyckel });
}

async function kuvertera({ sort, kropp, kod, fran, salt = null, nyckel = null }) {
  if (!salt) {
    const g = granskaKod(kod);
    if (!g.ok) throw new Error(g.varfor);
    salt = nyttSalt();
    nyckel = await nyckelUrLosenord(String(kod).trim(), salt);
  }
  const skapad = new Date().toISOString();

  const kropp_ = { ...kropp, _fran: fran ?? null, _skapad: skapad };

  return Buffer.from(JSON.stringify({
    maximus: FORMAT,
    sort,
    skapad,
    fran,
    salt: salt.toString('base64'),
    kontroll: kontrollvarde(nyckel).toString('base64'),
    kuvert: forsegla(JSON.stringify(kropp_), nyckel).toString('base64'),
  }, null, 2), 'utf8');
}

export const SORTNAMN = {
  get session() { return tx('dela.sort.session'); },
  get bevakning() { return tx('dela.sort.bevakning'); },
};

export function titta(buffert) {
  let h;
  try { h = JSON.parse(String(buffert)); }
  catch { throw new Error(tx('dela.ingenDelning')); }
  if (h.maximus !== FORMAT || !SORTNAMN[h.sort] || !h.kuvert || !h.salt)
    throw new Error(h.maximus > FORMAT
      ? tx('dela.nyareVersion')
      : tx('dela.ingenDelning'));
  return { format: h.maximus, sort: h.sort, skapad: h.skapad || null, fran: h.fran || null };
}

export async function packaUpp(buffert, kod) {
  const h = JSON.parse(String(buffert));
  titta(buffert);
  const nyckel = await nyckelUrLosenord(String(kod || '').trim(), Buffer.from(h.salt, 'base64'));

  if (h.kontroll) {
    const vantat = Buffer.from(h.kontroll, 'base64');
    const fick = kontrollvarde(nyckel);
    if (vantat.length !== fick.length || !timingSafeEqual(vantat, fick))
      throw new Error(tx('dela.felKod'));
  }

  let inre;
  try { inre = JSON.parse(oppna(Buffer.from(h.kuvert, 'base64'), nyckel)); }
  catch { throw new Error(tx('dela.felKodSkadad')); }

  const { _fran, _skapad, ...kropp } = inre;
  const fran = _fran ?? null;
  const skapad = _skapad ?? null;
  const utsidan = h.fran ?? null;
  if (_skapad !== undefined && (utsidan !== fran || (h.skapad || null) !== skapad)) {
    const e = new Error(tx('dela.andrad'));
    e.forfalskad = { visade: { fran: utsidan, skapad: h.skapad || null }, verkligt: { fran, skapad } };
    throw e;
  }

  return { sort: h.sort, innehall: kropp, session: kropp, fran, skapad };
}

const TAK = 200_000;
const strang = (v, tak = TAK) => (typeof v === 'string' ? v.slice(0, tak) : '');
const tidpunkt = v => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

export function importerbar(inre) {
  const i = inre && typeof inre === 'object' ? inre : {};
  const nu = new Date().toISOString();
  const turer = (Array.isArray(i.turer) ? i.turer : []).slice(0, 2000)
    .filter(t => t && typeof t === 'object')
    .map(t => ({
      id: randomUUID(),
      tid: tidpunkt(t.tid) || nu,
      fraga: strang(t.fraga),
      svar: strang(t.svar),
      status: 'klar',
      ...(t.av === 'maximus' ? { av: 'maximus', sager: strang(t.sager, 2000) } : {}),
      kallor: (Array.isArray(t.kallor) ? t.kallor : []).slice(0, 40)
        .filter(k => k && typeof k === 'object' && /^https?:\/\//.test(String(k.url || '')))
        .map(k => ({ titel: strang(k.titel, 300), url: strang(k.url, 2000) })),
      kvitto: [], anmarkningar: [],
    }));
  const filer = (Array.isArray(i.filer) ? i.filer : []).slice(0, 200)
    .filter(f => f && typeof f === 'object' && typeof f.original === 'string')
    .map(f => ({
      id: randomUUID(),
      namn: strang(f.namn, 300) || 'bilaga',
      sort: strang(f.sort, 40),
      tecken: Math.min(f.original.length, TAK),
      tid: tidpunkt(f.tid) || nu,
      original: strang(f.original),
    }));
  return {
    titel: strang(i.titel, 200) || 'Delat samtal',
    turer, filer,
    andrad: tidpunkt(i.andrad) || nu,
    karta: [], raknare: {},
  };
}
