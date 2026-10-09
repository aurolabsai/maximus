// Skapar facit för maskeringskorpusen ur äldre versioner av lib/
// (2026-10-09, granskningen). Kör: node test/korpus/facit.mjs <rot> [<rot> …]
// där varje <rot> har en gammal lib/ och data/ (git archive <commit> lib data
// public/sprak). Facit är unionen: det någon av dem maskerade, och det
// högsta antalet platshållare i en ofarlig mening.
import { writeFileSync } from 'node:fs';
import { korpus, vagarFor, star, platshallare, VAGAR } from './fall.mjs';

const rotter = process.argv.slice(2);
if (!rotter.length) { console.error('ange roten för minst en gammal version'); process.exit(1); }
const facit = {};
for (const rot of rotter) {
  const kor = await vagarFor(rot);
  for (const f of korpus()) {
    const rad = facit[f.text] ||= {};
    for (const v of VAGAR) {
      const ut = kor(f, v);
      const r = rad[v] ||= { maskerade: [], platshallare: 0 };
      r.maskerade = [...new Set([...r.maskerade, ...f.kansliga.filter(o => !star(ut, o))])];
      r.platshallare = Math.max(r.platshallare, platshallare(ut));
    }
  }
}
writeFileSync(new URL('./facit.json', import.meta.url), `${JSON.stringify(facit, null, 1)}\n`);
console.log(`${Object.keys(facit).length} fall`);
