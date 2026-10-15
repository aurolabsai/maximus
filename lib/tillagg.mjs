
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';

const FIL = 'tillagg.json';

const TECKEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function nyKod() {
  const b = randomBytes(8);
  const delar = [];
  for (let i = 0; i < 8; i += 4) {
    delar.push([...b.slice(i, i + 4)].map(x => TECKEN[x % TECKEN.length]).join(''));
  }
  return `MAXIMUS-${delar.join('-')}`;
}

export function stammer(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  if (!x.length || x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export async function kod(maximus, dataDir) {
  const vag = join(dataDir, FIL);
  try {
    const d = JSON.parse(await maximus.lasFil(vag));
    if (d?.kod) return d;
  } catch {  }
  const ny = { kod: nyKod(), skapad: new Date().toISOString(), parad: null };
  await maximus.skrivFil(vag, JSON.stringify(ny));
  return ny;
}

export async function forNya(maximus, dataDir) {
  const ny = { kod: nyKod(), skapad: new Date().toISOString(), parad: null };
  await maximus.skrivFil(join(dataDir, FIL), JSON.stringify(ny));
  return ny;
}

export async function gilltig(maximus, dataDir, visad) {
  if (!visad) return false;
  try {
    const d = JSON.parse(await maximus.lasFil(join(dataDir, FIL)));
    return stammer(d?.kod, visad);
  } catch { return false; }
}

export async function noteraParning(maximus, dataDir) {
  const vag = join(dataDir, FIL);
  try {
    const d = JSON.parse(await maximus.lasFil(vag));
    await maximus.skrivFil(vag, JSON.stringify({ ...d, parad: new Date().toISOString() }));
  } catch {  }
}
