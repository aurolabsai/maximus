import { readFile } from 'node:fs/promises';

const FIL = new URL('../data/villkor.md', import.meta.url);

export async function las(fil = FIL) {
  const ra = await readFile(fil, 'utf8');
  const huvud = /^<!--([\s\S]*?)-->/.exec(ra)?.[1] || '';
  const version = Number(/^\s*version:\s*(\d+)/m.exec(huvud)?.[1]);
  const datum = /^\s*datum:\s*(\d{4}-\d{2}-\d{2})/m.exec(huvud)?.[1] || null;
  if (!Number.isInteger(version) || version < 1) throw new Error('Villkoren saknar version.');
  return { version, datum, text: ra.replace(/^<!--[\s\S]*?-->\s*/, '').trim() };
}

export async function lasPa(kod, fil = FIL) {
  const v = await las(fil);
  if (!kod || kod === 'sv') return { ...v, sprak: 'sv' };
  try {
    const ra = await readFile(new URL(`villkor.${kod}.md`, fil), 'utf8');
    const huvud = /^<!--([\s\S]*?)-->/.exec(ra)?.[1] || '';
    if (Number(/^\s*version:\s*(\d+)/m.exec(huvud)?.[1]) !== v.version) return { ...v, sprak: 'sv' };
    return { ...v, text: ra.replace(/^<!--[\s\S]*?-->\s*/, '').trim(), sprak: kod };
  } catch { return { ...v, sprak: 'sv' }; }
}

export function godkant(sparat, version) {
  return Boolean(sparat && sparat.datum && Number(sparat.version) === Number(version));
}

export const godkannande = (version, nu = new Date()) => ({ version: Number(version), datum: nu.toISOString() });
