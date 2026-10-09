/// Villkoren: en fil, och godkännandet med datum och version.
///
/// Texten bor i data/villkor.md och ingen annanstans. Versionen står i
/// filens egen huvudkommentar — en version i koden bredvid texten i filen
/// vore två saker att hålla i takt, och den dag någon ändrar
/// texten men inte konstanten frågar appen inte om på nytt.
import { readFile } from 'node:fs/promises';

const FIL = new URL('../data/villkor.md', import.meta.url);

/// Läser villkoren. `{ version, datum, text }`; texten utan huvudkommentaren.
export async function las(fil = FIL) {
  const ra = await readFile(fil, 'utf8');
  const huvud = /^<!--([\s\S]*?)-->/.exec(ra)?.[1] || '';
  const version = Number(/^\s*version:\s*(\d+)/m.exec(huvud)?.[1]);
  const datum = /^\s*datum:\s*(\d{4}-\d{2}-\d{2})/m.exec(huvud)?.[1] || null;
  if (!Number.isInteger(version) || version < 1) throw new Error('Villkoren saknar version.');
  return { version, datum, text: ra.replace(/^<!--[\s\S]*?-->\s*/, '').trim() };
}

/// Villkoren på ett språk (slutgenomgången 2026-10-09).
///
/// Versionen och datumet är alltid den svenska filens: det är den som
/// godkänns. En översättning (data/villkor.<kod>.md) lämnas ut bara om dess
/// huvud säger samma version — en översättning som släpar efter är inte
/// villkoren, och då står den svenska texten kvar hellre än en gammal.
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

/// Gäller godkännandet de villkor som står nu?
///
/// Ett godkännande av version 1 är inget godkännande av version 2. Ett
/// godkännande utan datum är inget godkännande alls.
export function godkant(sparat, version) {
  return Boolean(sparat && sparat.datum && Number(sparat.version) === Number(version));
}

/// Godkännandet som sparas: versionen och när, satt av servern.
export const godkannande = (version, nu = new Date()) => ({ version: Number(version), datum: nu.toISOString() });
