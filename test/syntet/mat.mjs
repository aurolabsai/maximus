/// Mäter klassningen mot facit. Inga modeller, inga nätanrop — bara regler.
///
/// Körs före och efter varje ändring. Ett mått som inte går att köra på en
/// sekund är ett mått ingen kör.

import { SCENARIER } from './scenarier.mjs';
import { FACIT, dom } from './facit.mjs';
import { klassa, arvaKlass } from '../../lib/klassning.mjs';

const arv = process.argv.includes('--arv');

let ratt = 0, lagt = 0, hogt = 0, n = 0;
const missar = [];

for (const s of SCENARIER) {
  if (s.hjalp) continue;
  // Arvet: klassen bärs vidare i samtalet. Utan flaggan mäts dagens läge.
  let burit = 0;
  for (const [i, fraga] of s.turer.entries()) {
    const ska = FACIT[s.id][i];
    const egen = klassa(fraga, { funna: [], rojning: null }).niva;
    const fick = arv ? arvaKlass(egen, burit, fraga) : egen;
    if (arv) burit = Math.max(burit, egen);
    n++;
    const d = dom(fick, ska);
    if (d === 'rätt') ratt++;
    else {
      if (d === 'för lågt') lagt++; else hogt++;
      missar.push({ id: s.id, nr: i + 1, ska, fick, d, fraga });
    }
  }
}

const p = v => `${Math.round((v / n) * 100)} %`;
console.log(`${arv ? 'MED ARV' : 'SOM DET ÄR NU'} — ${n} frågor`);
console.log(`  rätt      ${String(ratt).padStart(3)}  ${p(ratt)}`);
console.log(`  för lågt  ${String(lagt).padStart(3)}  ${p(lagt)}   ← går ut utan grind`);
console.log(`  för högt  ${String(hogt).padStart(3)}  ${p(hogt)}   ← frågar i onödan`);

if (process.argv.includes('--visa')) {
  console.log('\nDe farliga (för lågt), de tjugo första:');
  for (const m of missar.filter(x => x.d === 'för lågt').slice(0, 20))
    console.log(`  ${m.ska}→${m.fick}  ${m.fraga.slice(0, 96)}`);
}
