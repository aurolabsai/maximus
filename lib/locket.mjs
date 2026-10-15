
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tx } from './sprakstod.mjs';

const scrypt = promisify(scryptCb);
const FIL = 'locket.json';

export const FORSOK = 10;

const KOSTNAD = { N: 2 ** 16, r: 8, p: 1, maxmem: 128 * 2 ** 16 * 8 * 2 };

const nyckelUr = (hemlighet, salt) =>
  scrypt(String(hemlighet).normalize('NFKC'), salt, 32, KOSTNAD);

export function granskaKod(kod) {
  const k = String(kod ?? '').trim();
  if (!/^\d{6}$/.test(k)) return { ok: false, varfor: tx('lib.locket.sexSiffror') };
  if (/^(\d)\1{5}$/.test(k)) return { ok: false, varfor: tx('lib.locket.sammaSiffra') };
  if ('0123456789'.includes(k) || '9876543210'.includes(k)) {
    return { ok: false, varfor: tx('lib.locket.iRad') };
  }
  return { ok: true };
}

export const stadaSvar = svar => String(svar ?? '')
  .normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

const vag = dataDir => join(dataDir, FIL);

export async function las(dataDir) {
  try { return JSON.parse(await readFile(vag(dataDir), 'utf8')); }
  catch { return null; }
}

async function skriv(dataDir, d) {
  await writeFile(vag(dataDir), JSON.stringify(d, null, 1), { mode: 0o600 });
}

export function lage(d) {
  if (!d) return { pa: false };
  return {
    pa: true,
    fraga: d.fraga || null,
    harSvar: Boolean(d.svarkuvert),
    forsokKvar: Math.max(0, FORSOK - (d.fel || 0)),
    svarForsokKvar: d.svarkuvert ? Math.max(0, FORSOK - (d.svarfel || 0)) : 0,
    efter: d.efter ?? null,
  };
}

export async function satt(dataDir, huvudnyckel, { kod, fraga = null, svar = null, efter = null }) {
  if (!Buffer.isBuffer(huvudnyckel) || huvudnyckel.length !== 32) {
    throw new Error(tx('lib.locket.upplast'));
  }
  const g = granskaKod(kod);
  if (!g.ok) throw new Error(g.varfor);

  const { forsegla } = await import('./krypto.mjs');
  const salt = randomBytes(16);
  const kn = await nyckelUr(kod, salt);

  const d = {
    v: 1,
    salt: salt.toString('base64'),
    kuvert: forsegla(huvudnyckel.toString('base64'), kn).toString('base64'),
    fel: 0,
    efter: efter ?? null,
    skapad: new Date().toISOString(),
  };

  if (fraga && svar) {
    const s = stadaSvar(svar);
    if (s.length < 3) throw new Error(tx('lib.locket.kortSvar'));
    const svarSalt = randomBytes(16);
    d.fraga = String(fraga).trim().slice(0, 120);
    d.svarsalt = svarSalt.toString('base64');
    d.svarkuvert = forsegla(huvudnyckel.toString('base64'), await nyckelUr(s, svarSalt)).toString('base64');
    d.svarfel = 0;
  }

  await skriv(dataDir, d);
  return lage(d);
}

let ko = Promise.resolve();
const iTur = uppgift => {
  const mitt = ko.then(uppgift, uppgift);
  ko = mitt.then(() => {}, () => {});
  return mitt;
};

export async function oppna(dataDir, val = {}) {
  return iTur(() => oppnaNu(dataDir, val));
}

async function oppnaNu(dataDir, { kod = null, svar = null } = {}) {
  const d = await las(dataDir);
  if (!d) throw new Error(tx('lib.locket.ingetLock'));
  const { oppna: oppnaKuvert } = await import('./krypto.mjs');

  const medSvar = svar != null;
  const kuvert = medSvar ? d.svarkuvert : d.kuvert;
  const salt = medSvar ? d.svarsalt : d.salt;
  const felfalt = medSvar ? 'svarfel' : 'fel';

  if (!kuvert) {
    throw new Error(medSvar
      ? tx('lib.locket.ingenFraga')
      : tx('lib.locket.kodenFungerarInte'));
  }
  if ((d[felfalt] || 0) >= FORSOK) {
    throw new Error(tx('lib.locket.forManga'));
  }

  const n = await nyckelUr(medSvar ? stadaSvar(svar) : String(kod ?? ''), Buffer.from(salt, 'base64'));
  let nyckel = null;
  try { nyckel = Buffer.from(oppnaKuvert(Buffer.from(kuvert, 'base64'), n), 'base64'); }
  catch { nyckel = null; }

  if (!nyckel || nyckel.length !== 32) {
    d[felfalt] = (d[felfalt] || 0) + 1;
    const slut = d[felfalt] >= FORSOK;
    if (slut) {
      if (medSvar) { delete d.svarkuvert; delete d.svarsalt; delete d.fraga; }
      else { delete d.kuvert; delete d.salt; }
    }
    await skriv(dataDir, d);
    const kvar = Math.max(0, FORSOK - d[felfalt]);
    const e = new Error(slut
      ? tx('lib.locket.stangd')
      : tx(medSvar ? 'lib.locket.felSvar' : 'lib.locket.felKod', { n: kvar }));
    e.forsokKvar = kvar;
    throw e;
  }

  if (d[felfalt]) { d[felfalt] = 0; await skriv(dataDir, d); }
  return nyckel;
}

export async function tabort(dataDir) {
  await unlink(vag(dataDir)).catch(() => {});
}

export const lika = (a, b) =>
  Buffer.isBuffer(a) && Buffer.isBuffer(b) && a.length === b.length && timingSafeEqual(a, b);
