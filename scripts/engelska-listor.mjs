// Bygger de engelska ord- och namnlistorna som maskeringen läser (fas 3,
// 2026-10-09). Källorna och deras licenser står i data/README.md.
//
//   node scripts/engelska-listor.mjs <moby-katalog> <baby-names.csv> <Names_2010Census.csv>
//
//   <moby-katalog>          common.txt ur Moby Word Lists
//                           (Grady Ward, public domain; gutenberg.org/ebooks/3201)
//   <baby-names.csv>        SSA:s förnamn, de 1000 vanligaste per år 1880–2008
//                           (US Social Security Administration, public domain;
//                           spegeln github.com/hadley/data-baby-names)
//   <Names_2010Census.csv>  US Census Bureau 2010 surnames (public domain;
//                           www2.census.gov/topics/genealogy/2010surnames/)
//
// Ut i data/:
//   engelska-ord.txt        vanliga engelska ord som inte är namn i någon av
//                           listorna (gemena, bara bokstäver)
//   engelska-namnord.txt    vanliga engelska ord som OCKSÅ är namn (will, rose,
//                           grace, smith, brown …)
//   engelska-fornamn.txt    förnamn med högsta andel något år (namn \t andel)
//   engelska-efternamn.txt  de 2 000 vanligaste efternamnen (namn \t rang)
//
// Ändra inte listorna för hand — kör om skriptet.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [moby, baby, census] = process.argv.slice(2);
if (!census) { console.error('node scripts/engelska-listor.mjs <moby-katalog> <baby-names.csv> <Names_2010Census.csv>'); process.exit(1); }

const rader = f => readFileSync(f, 'latin1').split(/\r\n|\r|\n/).map(r => r.trim()).filter(Boolean);
const ord = new Set(rader(join(moby, 'common.txt')).filter(r => /^[a-z]+$/.test(r) && r.length >= 2));

const fornamn = new Map();
for (const r of rader(baby).slice(1)) {
  const [, namn, andel] = r.split(',').map(x => x.replace(/"/g, ''));
  const n = namn.toLowerCase();
  if (!/^[a-z]+$/.test(n)) continue;
  fornamn.set(n, Math.max(fornamn.get(n) || 0, Number(andel)));
}

const efternamn = new Map();
for (const r of rader(census).slice(1)) {
  const [namn, rang] = r.split(',');
  const n = namn.toLowerCase();
  if (/^[a-z]+$/.test(n) && Number(rang) <= 2000) efternamn.set(n, Number(rang));
}

// Moby:s names.txt är inte med: den har "the" och "can" som namn.
const arNamn = o => fornamn.has(o) || efternamn.has(o);
const rena = [...ord].filter(o => !arNamn(o)).sort();
const namnord = [...ord].filter(arNamn).sort();

const huvud = (vad, kalla) => `# ${vad}\n# Byggd av scripts/engelska-listor.mjs ur ${kalla}. Se data/README.md.\n# Ändra inte för hand — kör om skriptet.\n`;
const MOBY = 'Moby Word Lists (public domain)';
writeFileSync('data/engelska-ord.txt', huvud('Vanliga engelska ord som inte är namn.', `${MOBY}, SSA, US Census`) + rena.join('\n') + '\n');
writeFileSync('data/engelska-namnord.txt', huvud('Vanliga engelska ord som också är namn.', `${MOBY}, SSA, US Census`) + namnord.join('\n') + '\n');
writeFileSync('data/engelska-fornamn.txt', huvud('Engelska förnamn: namn, högsta andel av årets födda något år 1880–2008.', 'US Social Security Administration (public domain)')
  + [...fornamn].sort((a, b) => a[0].localeCompare(b[0])).map(([n, a]) => `${n}\t${a}`).join('\n') + '\n');
writeFileSync('data/engelska-efternamn.txt', huvud('Engelska efternamn: de 2 000 vanligaste, med rang.', 'US Census Bureau 2010 surnames (public domain)')
  + [...efternamn].sort((a, b) => a[1] - b[1]).map(([n, r]) => `${n}\t${r}`).join('\n') + '\n');
console.log(`ord ${rena.length}, namnord ${namnord.length}, förnamn ${fornamn.size}, efternamn ${efternamn.size}`);
