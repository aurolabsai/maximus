import { valjModell, KATALOG } from './modeller.mjs';
import { ORON } from './dokument.mjs';
import { tx, svenska } from './sprakstod.mjs';

const gb = byte => { const s = (byte / 2 ** 30).toFixed(1); return svenska() ? s.replace('.', ',') : s; };

export function valjOra({ minneGB, disk }, tankerByte = 0) {
  const ledigt = disk ?? Infinity;
  const svensk = ORON.svensk, snabb = ORON.snabb;
  if (minneGB < 16)
    return { ...snabb, varfor: tx('lib.start.ora.litetMinne', { gb: minneGB }) };
  if (!svenska()) return { ...snabb, varfor: tx('lib.start.ora.allman') };
  if ((tankerByte + svensk.byte) * 1.15 > ledigt)
    return { ...snabb, varfor: tx('lib.start.ora.litenDisk', { gb: Math.round(ledigt / 2 ** 30) }) };
  return { ...svensk, varfor: tx('lib.start.ora.svensk') };
}

export function forslag(kap) {
  const minneGB = kap.minneGB ?? Math.round((kap.minne || 0) / 2 ** 30);
  const m = valjModell({ ...kap, minneGB });
  const varfor = !m.racker
    ? m.varfor
    : m.oprovad
      ? tx('lib.start.oprovad', { gb: minneGB, varfor: m.varfor })
      : tx('lib.start.ryms', { gb: minneGB, namn: m.namn, varfor: m.varfor });
  const tanker = { id: m.id, namn: m.namn, hus: m.hus, licens: m.licens, byte: m.byte,
    storlek: `${gb(m.byte)} GB`, provad: Boolean(m.provad), varfor };
  const o = valjOra({ minneGB, disk: kap.disk ?? null }, m.byte);
  const hor = { id: o.id, namn: o.namn, hus: o.hus, byte: o.byte, storlek: o.storlek, varfor: o.varfor };
  return { tanker, hor, minneGB, diskGB: kap.diskGB ?? null, racker: m.racker !== false,
    summaByte: m.byte + o.byte };
}

export const alternativ = (minneGB, finns = new Set()) => [...KATALOG]
  .sort((a, b) => a.minne - b.minne || a.byte - b.byte)
  .map(m => ({ id: m.id, namn: m.namn, hus: m.hus, licens: m.licens, byte: m.byte, storlek: `${gb(m.byte)} GB`,
    minne: m.minne, passar: m.minne <= minneGB, provad: Boolean(m.provad), finns: finns.has(m.id), om: m.om }));

export function provaEgetOra(vag, stat, huvud = null) {
  const v = String(vag || '').trim();
  if (!v) return { ok: false, skal: tx('lib.start.ora.skriv') };
  if (!v.startsWith('/')) return { ok: false, skal: tx('lib.start.ora.snedstreck') };
  if (!/\.bin$/i.test(v)) return { ok: false, skal: tx('lib.start.ora.bin') };
  if (!stat) return { ok: false, skal: tx('lib.start.finnsInte') };
  if (!stat.isFile()) return { ok: false, skal: stat.isDirectory?.() ? tx('lib.start.mapp') : tx('lib.start.ingenFil') };
  if (stat.size < 30e6) return { ok: false, skal: tx('lib.start.ora.liten', { mb: (stat.size / 1e6).toFixed(0) }) };
  if (huvud !== null && !['lmgg', 'ggml', 'GGUF'].includes(huvud)) return { ok: false, skal: tx('lib.start.ora.ingenWhisper') };
  return { ok: true, vag: v, storlek: stat.size >= 1e9 ? `${gb(stat.size)} GB` : `${Math.round(stat.size / 1e6)} MB` };
}

export function provaEgen(vag, stat) {
  const v = String(vag || '').trim();
  if (!v) return { ok: false, skal: tx('lib.start.egen.skriv') };
  if (!v.startsWith('/')) return { ok: false, skal: tx('lib.start.egen.snedstreck') };
  if (!/\.gguf$/i.test(v)) return { ok: false, skal: tx('lib.start.egen.gguf') };
  if (!stat) return { ok: false, skal: tx('lib.start.finnsInte') };
  if (!stat.isFile()) return { ok: false, skal: tx('lib.start.mapp') };
  if (stat.size < 1e9) return { ok: false, skal: tx('lib.start.egen.liten', { mb: (stat.size / 1e6).toFixed(0) }) };
  return { ok: true, vag: v, storlek: `${gb(stat.size)} GB` };
}
