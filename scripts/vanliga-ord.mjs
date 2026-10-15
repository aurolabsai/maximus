#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GOLV = 3;

const rakna = new Map();
let tecken = 0;
const rakna_i = text => {
  tecken += text.length;
  for (const m of text.toLowerCase().matchAll(/(?<![\p{L}])[a-zåäöéü]{3,}(?![\p{L}])/gu)) {
    rakna.set(m[0], (rakna.get(m[0]) || 0) + 1);
  }
};

for (const f of readdirSync(join(ROT, 'lagar')).filter(n => n.endsWith('.json'))) {
  rakna_i(JSON.stringify(JSON.parse(readFileSync(join(ROT, 'lagar', f), 'utf8'))));
}

const { FORNAMN } = await import(join(ROT, 'lib', 'fornamn.mjs'));

const orden = [...rakna].filter(([, n]) => n >= GOLV).sort((a, b) => b[1] - a[1]);
const krockar = orden.filter(([o]) => FORNAMN.has(o));

const vag = join(ROT, 'data', 'vanliga-ord.txt');
writeFileSync(vag, `# Vanliga svenska ord, härledda ur lagar/ av scripts/vanliga-ord.mjs.
# Ändra inte för hand — kör om skriptet.
#
# Används av lib/failclosed.mjs på två ställen:
#   · ett ord härifrån som OCKSÅ står i namnregistret maskeras bara med versal
#   · ett ord härifrån tas aldrig som efternamn
#
# ${tecken.toLocaleString('sv-SE')} tecken lagtext · ${rakna.size} unika ord
# ${orden.length} över golvet ${GOLV} · varav ${krockar.length} också registrerade namn
${orden.map(([o, n]) => `${o}\t${n}`).join('\n')}\n`);

console.log(`${orden.length} ord skrivna, varav ${krockar.length} krockar med namnregistret`);
console.log(krockar.slice(0, 12).map(([o, n]) => `  ${o.padEnd(16)} ${n}`).join('\n'));
