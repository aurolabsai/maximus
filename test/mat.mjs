// Mäter grinden under en MacBook Airs villkor.
//
// Tre begränsningar simuleras, och alla tre är konservativa — de gör maskinen
// långsammare än en riktig MBA, inte snabbare:
//
//   minne     en ballong äter RAM tills bara det en 16 GB-maskin har kvar
//             efter macOS, Chrome och Teams står till MAXIMUS:s förfogande.
//
//   kärna     `taskpolicy -b` binder processen till M1 Max effektivitetskärnor,
//             som går på ~2,06 GHz. Varje MBA-prestandakärna är snabbare än så:
//             M2 3,5 · M3 4,05 · M4 4,4 GHz. Mätningen är alltså ett golv.
//
//   bandbredd modellvägen är bandbreddsbunden, inte beräkningsbunden. M1 Max
//             har 400 GB/s, MBA M2 och M3 har 100, M4 har 120, M5 har 153.
//             Mätt genomströmning skalas med kvoten.

import { readFileSync } from 'node:fs';
import { forbered } from '../lib/kedja.mjs';

const BANDBREDD = { 'M1 Max (denna)': 400, 'MBA M2': 100, 'MBA M3': 100, 'MBA M4': 120, 'MBA M5': 153 };
const prompter = JSON.parse(readFileSync(new URL('./prompter.json', import.meta.url), 'utf8'));

const tolka = process.argv.includes('--tolka');
const varv = Number(process.argv.find(a => a.startsWith('--varv='))?.slice(7) || 3);

// Värm upp — första körningen betalar för JIT och reguljäruttrycken.
await forbered(prompter[0].text, { tolka: false });

const matt = [];
for (const { rubrik, text } of prompter) {
  const tider = [];
  for (let i = 0; i < varv; i++) {
    const t0 = process.hrtime.bigint();
    const f = await forbered(text, { tolka });
    tider.push(Number(process.hrtime.bigint() - t0) / 1e6);
    if (i === 0) matt.push({ rubrik, tecken: text.length, maskerat: f.karta.length, kvar: f.kvar.length, tider });
  }
  matt.at(-1).tider = tider;
}

const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`\n${tolka ? 'MED TOLKNING' : 'SNABBVÄG (förval)'} · ${varv} varv · ${process.env.MBA_LAGE || 'obegränsat'}\n`);
console.log('  fråga                          tecken   median     värst  maskerat  kvar');
for (const m of matt) {
  console.log(`  ${m.rubrik.slice(0, 29).padEnd(30)} ${String(m.tecken).padStart(6)} ` +
    `${median(m.tider).toFixed(1).padStart(8)} ${Math.max(...m.tider).toFixed(1).padStart(9)} ` +
    `${String(m.maskerat).padStart(9)} ${String(m.kvar).padStart(5)}`);
}
const alla = matt.flatMap(m => m.tider);
const p50 = median(alla), p95 = [...alla].sort((a, b) => a - b)[Math.floor(alla.length * 0.95)];
console.log(`\n  median ${p50.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · värst ${Math.max(...alla).toFixed(1)} ms`);
console.log(`  kvar efter granskning: ${matt.reduce((s, m) => s + m.kvar, 0)} (ska vara 0)`);

if (tolka) {
  console.log('\n  skalat till andra maskiner (bandbreddsbundet):');
  for (const [namn, bb] of Object.entries(BANDBREDD)) {
    const k = 400 / bb;
    console.log(`    ${namn.padEnd(16)} median ${(p50 * k / 1000).toFixed(1)} s · värst ${(Math.max(...alla) * k / 1000).toFixed(1)} s`);
  }
}
