// En mapp som källa för agenten: Hämtade filer, Dokument, Skrivbordet,
// iCloud Drive eller en du pekar ut (2026-10-04, "filmappar").
//
// Agenten ser de senast ändrade filerna och läser texten i dem som går att
// läsa (PDF, Word, text, kalkylblad) — med samma läsare som när du drar in
// en fil. Den läser på din dator och skriver aldrig i mappen.
//
// macOS frågar själv första gången Maximus öppnar Dokument, Skrivbordet
// eller Hämtade filer. Ingen Full skivåtkomst behövs.

import { readdir, stat, readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { homedir } from 'node:os';
import { lasDokument, SORTER } from './dokument.mjs';
import { tx } from './sprakstod.mjs';

export const FORSLAG = () => [
  [tx('mappar.hamtade'), join(homedir(), 'Downloads')],
  [tx('mappar.dokument'), join(homedir(), 'Documents')],
  [tx('mappar.skrivbordet'), join(homedir(), 'Desktop')],
  ['iCloud Drive', join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs')],
];

/// Ett namn att visa för en sökväg.
export const namnPa = sokvag => FORSLAG().find(([, v]) => v === sokvag)?.[0] || basename(sokvag);

/// De senast ändrade filerna i mappen (och en nivå under), med text ur dem
/// som går att läsa. `id` är sökvägen och `andrad` tiden, så att en fil som
/// ändras räknas som ny (lib/agent.mjs).
export async function filer(sokvag, { antal = 25, last = 12 } = {}) {
  const hittade = [];
  const ga = async (dir, djup) => {
    let poster;
    try { poster = await readdir(dir, { withFileTypes: true }); }
    catch (e) {
      if (e.code === 'EPERM' || e.code === 'EACCES') {
        const f = new Error(tx('mappar.farInte', { mapp: namnPa(sokvag) }));
        f.tillstand = true; throw f;
      }
      if (djup === 0) throw new Error(tx('mappar.finnsInte', { sokvag }));
      return;
    }
    for (const p of poster) {
      if (p.name.startsWith('.')) continue;
      const full = join(dir, p.name);
      if (p.isDirectory() && djup < 1) await ga(full, djup + 1);
      else if (p.isFile()) {
        const s = await stat(full).catch(() => null);
        if (s) hittade.push({ full, namn: p.name, andrad: s.mtime, storlek: s.size });
      }
    }
  };
  await ga(sokvag, 0);
  hittade.sort((a, b) => b.andrad - a.andrad);
  const ut = [];
  for (const [i, f] of hittade.slice(0, antal).entries()) {
    const slut = extname(f.namn).toLowerCase();
    let text = '';
    // Texten bara för de senaste och de som går att läsa — en mapp med
    // hundra PDF:er ska inte läsas om var femte minut.
    if (i < last && SORTER[slut] && SORTER[slut] !== 'bild' && f.storlek < 15e6) {
      try { text = (await lasDokument(f.namn, await readFile(f.full))).text.slice(0, 2000); } catch { /* namnet räcker */ }
    }
    ut.push({ id: `fil:${f.full}`, titel: f.namn, tid: f.andrad.toISOString(), andrad: f.andrad.toISOString(),
      text: text || f.namn, fran: namnPa(sokvag) });
  }
  return ut;
}
