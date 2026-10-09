#!/usr/bin/env node
/// Härleder de vanliga svenska orden ur lagtexterna vi redan skeppar.
///
/// ── Varför ──────────────────────────────────────────────────────────────
///
/// SCB:s namnregister innehåller ord som också är vanliga svenska ord.
/// "grund" är ett av dem — någon heter faktiskt Grund — och namnvakten
/// maskerade därför "ligga till grund" som "ligga till [NAMN K]".
///
/// lib/failclosed.mjs hade redan rätt avsikt skriven i en kommentar: ett ord
/// som både är ett vanligt ord och ett ovanligt namn ska maskeras bara när
/// det står med versal. Men listan den läste var handskriven, och "grund"
/// stod inte i den.
///
/// Det är nionde gången samma form dyker upp i det här förrådet: en
/// handbyggd lista bredvid den riktiga strukturen. Alltså härleds den i
/// stället, ur text vi redan har.
///
/// ── Varför just lagtexterna ─────────────────────────────────────────────
///
/// De är 844 000 tecken svensk förvaltningsprosa — exakt den sortens språk
/// MAXIMUS:s användare skriver. Ett ord som står i en lagtext är ett ord, inte
/// ett namn, hur många som än råkar heta så.
///
/// Det blir ingen fullständig ordlista. Det ska det inte heller vara: ju
/// fler ord som undantas, desto fler riktiga namn slipper igenom. Golvet på
/// tre förekomster tar bort det som råkat stå där en gång.
///
/// Kör: node scripts/vanliga-ord.mjs

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

// Lagtexterna: svensk förvaltningsprosa, 844 000 tecken.
for (const f of readdirSync(join(ROT, 'lagar')).filter(n => n.endsWith('.json'))) {
  rakna_i(JSON.stringify(JSON.parse(readFileSync(join(ROT, 'lagar', f), 'utf8'))));
}

// ── Och INTE vår egen prosa ────────────────────────────────────────────
//
// Första försöket vägde in hjälptexten och källkommentarerna, för att
// lagtexten är för formell: "igen" står där bara inuti längre ord.
//
// Det gick illa. Kommentarerna i det här förrådet DISKUTERAR maskering, och
// de gör det med exempel: "ella nordin", "leyla amin", "bettan".
// De orden hamnade i ordlistan, och därmed slutade riktiga namn maskeras.
//
// En korpus som innehåller det den ska utesluta är ingen korpus. Lagtexten
// nämner inga personer vid namn — det är precis därför den duger.

const { FORNAMN } = await import(join(ROT, 'lib', 'fornamn.mjs'));

// ── Varför hela ordlistan och inte bara krockarna ───────────────────────
//
// Första versionen skrev bara de ord som BÅDE stod i lagtexten OCH i
// namnregistret — 39 stycken, som "grund" och "till". De räckte för
// förnamnsvakten.
//
// Men efternamnsgissningen har samma hål åt andra hållet: "elisabeth igen"
// tog "igen" som efternamn, eftersom regeln bara frågade om ordet var ett
// stoppord. "igen" är inget namn alls — det är ett vanligt ord, och det
// står i lagtexten.
//
// Alltså: alla ord över golvet. Ett ord som står i svensk förvaltningsprosa
// är ett ord, och ett ord är varken ett förnamn eller ett efternamn.
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
