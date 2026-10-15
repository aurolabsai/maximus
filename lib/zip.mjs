
import { inflateRawSync, deflateRawSync } from 'node:zlib';
import { tx } from './sprakstod.mjs';

export function las(buf) {
  let slut = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { slut = i; break; }
  }
  if (slut < 0) throw new Error(tx('zip.inteZip'));
  const antal = buf.readUInt16LE(slut + 10);
  let p = buf.readUInt32LE(slut + 16);

  const ut = new Map();
  for (let i = 0; i < antal; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const metod = buf.readUInt16LE(p + 10);
    const packad = buf.readUInt32LE(p + 20);
    const nLangd = buf.readUInt16LE(p + 28);
    const eLangd = buf.readUInt16LE(p + 30);
    const kLangd = buf.readUInt16LE(p + 32);
    const start = buf.readUInt32LE(p + 42);
    const namn = buf.toString('utf8', p + 46, p + 46 + nLangd);
    p += 46 + nLangd + eLangd + kLangd;

    if (buf.readUInt32LE(start) !== 0x04034b50) continue;
    const lN = buf.readUInt16LE(start + 26);
    const lE = buf.readUInt16LE(start + 28);
    const data = buf.subarray(start + 30 + lN + lE, start + 30 + lN + lE + packad);
    ut.set(namn, metod === 0 ? data : inflateRawSync(data));
  }
  return ut;
}

const TABELL = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABELL[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

export function skriv(filer) {
  const poster = filer instanceof Map ? [...filer] : Object.entries(filer);
  const lokala = [];
  const katalog = [];
  let plats = 0;

  for (const [namn, innehall] of poster) {
    const rå = Buffer.isBuffer(innehall) ? innehall : Buffer.from(String(innehall), 'utf8');
    const namnB = Buffer.from(namn, 'utf8');
    const summa = crc32(rå);

    const packad = deflateRawSync(rå, { level: 6 });
    const komprimerad = packad.length < rå.length;
    const data = komprimerad ? packad : rå;
    const metod = komprimerad ? 8 : 0;

    const huvud = Buffer.alloc(30);
    huvud.writeUInt32LE(0x04034b50, 0);
    huvud.writeUInt16LE(20, 4);
    huvud.writeUInt16LE(0x0800, 6);
    huvud.writeUInt16LE(metod, 8);
    huvud.writeUInt16LE(0, 10);
    huvud.writeUInt16LE(0x21, 12);
    huvud.writeUInt32LE(summa, 14);
    huvud.writeUInt32LE(data.length, 18);
    huvud.writeUInt32LE(rå.length, 22);
    huvud.writeUInt16LE(namnB.length, 26);
    huvud.writeUInt16LE(0, 28);

    lokala.push(huvud, namnB, data);

    const k = Buffer.alloc(46);
    k.writeUInt32LE(0x02014b50, 0);
    k.writeUInt16LE(20, 4);
    k.writeUInt16LE(20, 6);
    k.writeUInt16LE(0x0800, 8);
    k.writeUInt16LE(metod, 10);
    k.writeUInt16LE(0, 12);
    k.writeUInt16LE(0x21, 14);
    k.writeUInt32LE(summa, 16);
    k.writeUInt32LE(data.length, 20);
    k.writeUInt32LE(rå.length, 24);
    k.writeUInt16LE(namnB.length, 28);
    k.writeUInt32LE(plats, 42);
    katalog.push(k, namnB);

    plats += huvud.length + namnB.length + data.length;
  }

  const katalogB = Buffer.concat(katalog);
  const slut = Buffer.alloc(22);
  slut.writeUInt32LE(0x06054b50, 0);
  slut.writeUInt16LE(poster.length, 8);
  slut.writeUInt16LE(poster.length, 10);
  slut.writeUInt32LE(katalogB.length, 12);
  slut.writeUInt32LE(plats, 16);

  return Buffer.concat([...lokala, katalogB, slut]);
}

