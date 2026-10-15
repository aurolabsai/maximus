
import { randomBytes, createCipheriv, createDecipheriv, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { tx } from './sprakstod.mjs';

const scryptAsync = promisify(scrypt);

const SCRYPT = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

export const MAGI = Buffer.from('MAXIMUS1\0');
const SALT_L = 16, NONCE_L = 12, TAG_L = 16;

export async function nyckelUrLosenord(losenord, salt) {
  if (typeof losenord !== 'string' || !losenord) throw new Error(tx('krypto.losenordSaknas'));
  return scryptAsync(losenord.normalize('NFKC'), salt, 32, SCRYPT);
}

export function nyttSalt() { return randomBytes(SALT_L); }
export function nyNyckel() { return randomBytes(32); }

export function forsegla(klartext, nyckel) {
  if (!Buffer.isBuffer(nyckel) || nyckel.length !== 32) throw new Error(tx('krypto.nyckel32'));
  const nonce = randomBytes(NONCE_L);
  const c = createCipheriv('aes-256-gcm', nyckel, nonce);
  const ct = Buffer.concat([c.update(Buffer.from(klartext, 'utf8')), c.final()]);
  return Buffer.concat([MAGI, nonce, c.getAuthTag(), ct]);
}

export function oppna(kuvert, nyckel) {
  const b = Buffer.isBuffer(kuvert) ? kuvert : Buffer.from(kuvert);
  if (b.length < MAGI.length + NONCE_L + TAG_L) throw new Error(tx('krypto.forKort'));
  if (!b.subarray(0, MAGI.length).equals(MAGI)) throw new Error(tx('krypto.inteKuvert'));
  const nonce = b.subarray(MAGI.length, MAGI.length + NONCE_L);
  const tagg = b.subarray(MAGI.length + NONCE_L, MAGI.length + NONCE_L + TAG_L);
  const ct = b.subarray(MAGI.length + NONCE_L + TAG_L);
  const d = createDecipheriv('aes-256-gcm', nyckel, nonce);
  d.setAuthTag(tagg);
  try { return Buffer.concat([d.update(ct), d.final()]).toString('utf8'); }
  catch { throw new Error(tx('krypto.felLosenord')); }
}

export function oppnaRa(kuvert, nyckel) {
  const b = Buffer.isBuffer(kuvert) ? kuvert : Buffer.from(kuvert);
  if (b.length < MAGI.length + NONCE_L + TAG_L) throw new Error(tx('krypto.forKort'));
  if (!b.subarray(0, MAGI.length).equals(MAGI)) throw new Error(tx('krypto.inteKuvert'));
  const nonce = b.subarray(MAGI.length, MAGI.length + NONCE_L);
  const tagg = b.subarray(MAGI.length + NONCE_L, MAGI.length + NONCE_L + TAG_L);
  const ct = b.subarray(MAGI.length + NONCE_L + TAG_L);
  const d = createDecipheriv('aes-256-gcm', nyckel, nonce);
  d.setAuthTag(tagg);
  try { return Buffer.concat([d.update(ct), d.final()]); }
  catch { throw new Error(tx('krypto.felLosenord')); }
}

export function arForseglad(buffert) {
  const b = Buffer.isBuffer(buffert) ? buffert : Buffer.from(buffert || '');
  return b.length >= MAGI.length && b.subarray(0, MAGI.length).equals(MAGI);
}

export async function sessionsnyckel(huvudnyckel, kod, salt) {
  if (!Buffer.isBuffer(huvudnyckel) || huvudnyckel.length !== 32) throw new Error(tx('krypto.huvudnyckel32'));
  const normaliserad = String(kod || '').normalize('NFKC').toUpperCase().trim();
  if (!normaliserad) throw new Error(tx('krypto.kodSaknas'));
  const underlag = Buffer.concat([huvudnyckel, Buffer.from(normaliserad, 'utf8')]);
  return scryptAsync(underlag, salt, 32, SCRYPT);
}

export function kontrollvarde(nyckel) {
  return createHash('sha256').update(Buffer.concat([Buffer.from('maximus-kontroll'), nyckel])).digest();
}

export function stammerKontroll(nyckel, sparat) {
  const a = kontrollvarde(nyckel);
  const b = Buffer.isBuffer(sparat) ? sparat : Buffer.from(sparat || '', 'base64');
  return a.length === b.length && timingSafeEqual(a, b);
}
